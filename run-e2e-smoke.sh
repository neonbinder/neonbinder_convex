#!/bin/bash
# Runs E2E flows across N parallel workers using a tag-driven scheduler.
#
# Each Maestro flow declares its scheduling profile via tags in its `tags:`
# block. Three families exist:
#
#   - `isolated:true` (or legacy `serial-global`) — flow mutates global Convex
#     tables (selectorOptions / cardChecklist / players / teams) by clicking
#     "Reset Set Builder Data" or otherwise touching cross-user data. These
#     flows must serialize alone and cannot run concurrently with the cascade
#     (see below).
#
#   - `serial-marketplace` — flow hits /login/bsc or /login/sportlots on the
#     browser service. The browser service returns 503 on concurrent
#     marketplace logins, so these serialize on a dedicated worker. They CAN
#     run concurrently with isolated and with the cascade — they only conflict
#     with each other.
#
#   - `requires:<state>` and `provides:<state>` — the dependency graph. A flow
#     tagged `requires:X` only runs after every flow tagged `provides:X` has
#     completed. States are author-defined strings (e.g. `setup-done`,
#     `sets-loaded`, `cards-loaded`). Future feature flows plug into this
#     graph by declaring their own requires/provides — no runner changes.
#
# Untagged flows are parallel-safe and distributed round-robin across workers.
#
# Execution model:
#   Phase 1 (concurrent across all workers):
#     - Lane I: isolated flows        (serial on dedicated worker)
#     - Lane M: marketplace flows     (serial on dedicated worker)
#     - Lane P: independent flows     (parallel, distributed)
#     Wait for Lane I (and Lane M) to finish before Phase 2 starts. Lane P
#     keeps running concurrently with Phase 2 if it's still going.
#
#   Phase 2 (cascade levels in order):
#     For each level 0..N: distribute that level's depgraph flows across all
#     currently-free workers and wait for the level to finish before the next.
#
# Each worker passes WORKER_INDEX through to flows; flows append
# &worker=${WORKER_INDEX} to their /testing/sign-in URLs so the testing
# endpoint resolves TEST_EMAIL_${worker} / NEW_PROFILE_TEST_EMAIL_${worker}.
#
# Usage:
#   ./run-e2e-smoke.sh                           # all flows, default parallelism
#   ./run-e2e-smoke.sh smoke                     # only flows tagged "smoke"
#   MAESTRO_PARALLELISM=1 ./run-e2e-smoke.sh     # serial fallback (debugging)
#   MAESTRO_PARALLELISM=4 ./run-e2e-smoke.sh     # 4 workers
#   MAESTRO_DISABLE_DEP_GRAPH=1 ./run-e2e-smoke.sh   # rollback to static-lane behavior

set -e

# Load .env.test if it exists — but don't override vars already set in the
# calling environment. `set -a; source` would overwrite, so read line-by-line
# and only export when the key is unset.
if [ -f .env.test ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    key="${line%%=*}"
    [ -z "$key" ] && continue
    if [ -z "${!key+x}" ]; then
      value="${line#*=}"
      # Strip matching surrounding quotes
      case "$value" in
        \"*\") value="${value#\"}"; value="${value%\"}" ;;
        \'*\') value="${value#\'}"; value="${value%\'}" ;;
      esac
      export "$key=$value"
    fi
  done < .env.test
fi

MAESTRO="$HOME/.maestro/bin/maestro"
CONFIG=".maestro/config.yaml"
APP_URL="${APP_URL:-https://localhost:3000}"
# Unique username per run to avoid "already taken" in profile flows.
# Must match the profile validation regex ^[a-z0-9-]+$ (no underscores).
TEST_USERNAME="${TEST_USERNAME:-neontester-$(date +%s)}"
# Credential env vars (real credentials for dev@neonbinder.io accounts).
# Only the marketplace-lane worker receives these.
SPORTLOTS_USERNAME="${SPORTLOTS_USERNAME:-}"
SPORTLOTS_PASSWORD="${SPORTLOTS_PASSWORD:-}"
BSC_USERNAME="${BSC_USERNAME:-}"
BSC_PASSWORD="${BSC_PASSWORD:-}"
# NOTE: per-user test-state reset is NOT driven by a Maestro env secret. Flows
# that need a clean slate route their sign-in through /testing/reset, which
# calls the auth-scoped resetMyTestState Convex mutation from the browser. No
# reset secret is passed via -e (Maestro serializes the full -e env map into its
# debug artifacts, so passing secrets there would leak them).
# Per-flow JUnit + screenshot artifacts land here; the CI workflow publishes them
# as a PR check (JUnit) and uploads the directory as an Actions artifact.
REPORT_DIR="${REPORT_DIR:-maestro-report}"
mkdir -p "$REPORT_DIR/junit" "$REPORT_DIR/artifacts" "$REPORT_DIR/logs" "$REPORT_DIR/debug"
# Per-flow hard timeout (seconds). Maestro 2.2.0 has a Jackson/Kotlin reflection
# bug (FasterXML/jackson-module-kotlin#296) that can hang the JVM indefinitely
# while writing debug output after a failed flow — the exception kills `main`
# but a non-daemon heartbeat thread keeps the JVM alive. Without this wrapper,
# one hung flow blocks every other worker. Use `gtimeout` (GNU coreutils) on
# macOS, plain `timeout` on Linux/CI. Override with MAESTRO_FLOW_TIMEOUT_SEC.
FLOW_TIMEOUT_SEC="${MAESTRO_FLOW_TIMEOUT_SEC:-600}"
if command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_CMD="gtimeout"
elif command -v timeout >/dev/null 2>&1; then
  TIMEOUT_CMD="timeout"
else
  echo "WARNING: no gtimeout/timeout command available — a hung maestro JVM will block the suite." >&2
  TIMEOUT_CMD=""
fi
# Per-worker JVM "user.home" override. Maestro's DebugLogStore writes to
# {user.home}/Library/Logs/maestro/{timestamp}/ and tries to zip+remove it on
# exit — concurrent workers race in that shared dir and one process hangs in
# DebugLogStore.finalizeRun with NoSuchFileException. Giving each worker its
# own user.home (via MAESTRO_OPTS=-Duser.home=...) isolates the log dirs so
# no two maestro JVMs ever touch the same path. The maestro wrapper script
# locates its own install via $HOME (env var, not user.home), so it still
# finds ~/.maestro/lib/ correctly.
rm -rf "$REPORT_DIR/maestro-home"
mkdir -p "$REPORT_DIR/maestro-home"

# Truncate per-worker log/results files up-front so Phase 0 output is
# preserved through Phases 1 and 2 (the lane runners now append rather than
# truncate). Truncate up to a generous worker count — extra files just stay
# empty and the final dump skips them by existence check.
for ((w = 0; w < 16; w++)); do
  : > "$REPORT_DIR/logs/worker-${w}.log"
  : > "$REPORT_DIR/logs/worker-${w}.results"
done

# Parallelism. Default 3; clamp to >=1.
PARALLELISM="${MAESTRO_PARALLELISM:-3}"
if ! [[ "$PARALLELISM" =~ ^[0-9]+$ ]] || [ "$PARALLELISM" -lt 1 ]; then
  PARALLELISM=1
fi

# Rollback flag: if anything misbehaves with the dep-graph scheduler, set
# MAESTRO_DISABLE_DEP_GRAPH=1 to fall back to static-lane behavior. The
# dep-graph and isolated lanes both collapse into a single "serial" bucket.
DISABLE_DEP_GRAPH="${MAESTRO_DISABLE_DEP_GRAPH:-}"

# --platform web required so launchApp navigates to each flow's url:
# (config cannot set platform). WORKER_INDEX is appended per-worker below.
# Headless by default. Set MAESTRO_HEADLESS=0 to watch the browser run.
ARGS_BASE=(--platform web --config "$CONFIG" -e "APP_URL=$APP_URL" -e "TEST_USERNAME=$TEST_USERNAME")
if [ "${MAESTRO_HEADLESS:-1}" != "0" ]; then
  ARGS_BASE+=(--headless)
fi

TAG="${1:-}"

# ─── Flow discovery ─────────────────────────────────────────────────────────
# Filter by tag if provided, otherwise every yaml file in .maestro/flows/
# except ones tagged `util` or `wip`:
#  - util: reusable fragments invoked via runFlow from other flows. They
#    assume the caller has done launchApp + sign-in, so they fail standalone.
#  - wip:  temporarily broken flows parked behind a feature that is still
#    in-progress on another branch. Re-enable by removing the tag once fixed.
# The config.yaml excludeTags rule only applies when Maestro discovers
# flows from a directory; we pass flows to it one at a time, so we have to
# exclude them here.
SMOKE_FLOWS=()
if [ -n "$TAG" ]; then
  while IFS= read -r f; do
    SMOKE_FLOWS+=("$f")
  done < <(grep -rlE "^[[:space:]]*-[[:space:]]+${TAG}$" .maestro/flows/ --include="*.yaml" | sort)
else
  while IFS= read -r f; do
    if grep -qE "^[[:space:]]*-[[:space:]]+(util|wip)$" "$f"; then
      continue
    fi
    SMOKE_FLOWS+=("$f")
  done < <(find .maestro/flows/ -name "*.yaml" | sort)
fi

if [ ${#SMOKE_FLOWS[@]} -eq 0 ]; then
  echo "No flows found${TAG:+ tagged \"$TAG\"} in .maestro/flows/"
  exit 0
fi

# ─── Tag parsing & categorization ───────────────────────────────────────────
# flow_tags <flow.yaml> — emits one tag per line (the text after `- ` in the
# top-level `tags:` block, before the `---` separator).
flow_tags() {
  awk '
    /^---$/ { exit }
    /^tags:/ { intags=1; next }
    intags && /^[[:space:]]+-[[:space:]]+/ {
      sub(/^[[:space:]]+-[[:space:]]+/, "")
      sub(/[[:space:]]+$/, "")
      print
      next
    }
    intags && !/^[[:space:]]/ { intags=0 }
  ' "$1"
}

# Parallel indexed arrays keyed by SMOKE_FLOWS position. Bash 3.2 compatible
# (macOS ships 3.2; no associative arrays). Look up via flow_idx_of() if you
# only have the path.
FLOW_REQUIRES_LIST=()   # space-separated state names per flow
FLOW_PROVIDES_LIST=()
FLOW_CATEGORY_LIST=()   # isolated | marketplace | depgraph | independent
FLOW_LEVEL_LIST=()      # depgraph: integer level; others: empty

flow_idx_of() {
  local target=$1
  local i
  for i in "${!SMOKE_FLOWS[@]}"; do
    if [ "${SMOKE_FLOWS[$i]}" = "$target" ]; then
      echo "$i"
      return 0
    fi
  done
  echo "-1"
  return 1
}

for i in "${!SMOKE_FLOWS[@]}"; do
  flow="${SMOKE_FLOWS[$i]}"
  req=""
  prov=""
  is_isolated=false
  is_marketplace=false
  has_dep=false
  while IFS= read -r tag; do
    case "$tag" in
      requires:*)         req="$req ${tag#requires:}";  has_dep=true ;;
      provides:*)         prov="$prov ${tag#provides:}"; has_dep=true ;;
      isolated|isolated:true) is_isolated=true ;;
      serial-global)      is_isolated=true ;;   # legacy alias for backwards compat
      serial-marketplace) is_marketplace=true ;;
    esac
  done < <(flow_tags "$flow")
  FLOW_REQUIRES_LIST[$i]="${req# }"
  FLOW_PROVIDES_LIST[$i]="${prov# }"
  FLOW_LEVEL_LIST[$i]=""

  # Categorization. With DISABLE_DEP_GRAPH, depgraph flows fold into isolated
  # so the runner falls back to today's static-lane behavior (everything that
  # would be cascade just runs serially in the isolated lane).
  if [ -n "$DISABLE_DEP_GRAPH" ] && $has_dep; then
    is_isolated=true
    has_dep=false
  fi
  if $is_isolated; then
    FLOW_CATEGORY_LIST[$i]="isolated"
  elif $is_marketplace; then
    FLOW_CATEGORY_LIST[$i]="marketplace"
  elif $has_dep; then
    FLOW_CATEGORY_LIST[$i]="depgraph"
  else
    FLOW_CATEGORY_LIST[$i]="independent"
  fi
done

# Bucket flows by category. We keep these as flow paths (not indices) for
# easy iteration in the lane runners.
ISOLATED_FLOWS=()
MARKETPLACE_FLOWS=()
DEPGRAPH_FLOWS=()
INDEPENDENT_FLOWS=()
for i in "${!SMOKE_FLOWS[@]}"; do
  case "${FLOW_CATEGORY_LIST[$i]}" in
    isolated)    ISOLATED_FLOWS+=("${SMOKE_FLOWS[$i]}") ;;
    marketplace) MARKETPLACE_FLOWS+=("${SMOKE_FLOWS[$i]}") ;;
    depgraph)    DEPGRAPH_FLOWS+=("${SMOKE_FLOWS[$i]}") ;;
    independent) INDEPENDENT_FLOWS+=("${SMOKE_FLOWS[$i]}") ;;
  esac
done

# ─── Level computation for the dep-graph cascade ────────────────────────────
# Iterative topological sort. For each pending flow, level = 1 + max(level of
# every producer of every required state). Flows with no requires are level 0.
# Cycle / unproducible-state detection: if a round produces no progress, abort.
MAX_LEVEL=-1
if [ ${#DEPGRAPH_FLOWS[@]} -gt 0 ]; then
  pending=("${DEPGRAPH_FLOWS[@]}")
  current_level=0
  while [ ${#pending[@]} -gt 0 ]; do
    promoted=()
    next_pending=()
    for flow in "${pending[@]}"; do
      flow_i=$(flow_idx_of "$flow")
      satisfied=true
      for state in ${FLOW_REQUIRES_LIST[$flow_i]}; do
        # Has every producer of this state been assigned a level already?
        for producer in "${DEPGRAPH_FLOWS[@]}"; do
          producer_i=$(flow_idx_of "$producer")
          if [[ " ${FLOW_PROVIDES_LIST[$producer_i]} " == *" $state "* ]]; then
            if [ -z "${FLOW_LEVEL_LIST[$producer_i]}" ]; then
              satisfied=false
              break 2
            fi
          fi
        done
      done
      if $satisfied; then
        promoted+=("$flow")
      else
        next_pending+=("$flow")
      fi
    done
    if [ ${#promoted[@]} -eq 0 ]; then
      echo "ERROR: dep-graph has a cycle or required state has no producer." >&2
      for flow in "${pending[@]}"; do
        flow_i=$(flow_idx_of "$flow")
        echo "  unscheduled: $flow (requires: ${FLOW_REQUIRES_LIST[$flow_i]})" >&2
      done
      exit 2
    fi
    for flow in "${promoted[@]}"; do
      flow_i=$(flow_idx_of "$flow")
      FLOW_LEVEL_LIST[$flow_i]=$current_level
    done
    [ "$current_level" -gt "$MAX_LEVEL" ] && MAX_LEVEL=$current_level
    pending=("${next_pending[@]}")
    current_level=$((current_level + 1))
  done
fi

# ─── Plan summary ───────────────────────────────────────────────────────────
echo "Found ${#SMOKE_FLOWS[@]} flow(s)${TAG:+ tagged \"$TAG\"}"
echo "  Isolated:    ${#ISOLATED_FLOWS[@]}"
echo "  Marketplace: ${#MARKETPLACE_FLOWS[@]}"
echo "  Independent: ${#INDEPENDENT_FLOWS[@]}"
echo "  Dep-graph:   ${#DEPGRAPH_FLOWS[@]} (levels 0..$MAX_LEVEL)"
echo "Parallelism: $PARALLELISM worker(s)${DISABLE_DEP_GRAPH:+ — DEP_GRAPH DISABLED}"
if [ ${#ISOLATED_FLOWS[@]} -gt 0 ]; then
  echo "  Isolated lane:"
  for f in "${ISOLATED_FLOWS[@]}"; do echo "    $f"; done
fi
if [ ${#MARKETPLACE_FLOWS[@]} -gt 0 ]; then
  echo "  Marketplace lane:"
  for f in "${MARKETPLACE_FLOWS[@]}"; do echo "    $f"; done
fi
if [ ${#INDEPENDENT_FLOWS[@]} -gt 0 ]; then
  echo "  Independent lane:"
  for f in "${INDEPENDENT_FLOWS[@]}"; do echo "    $f"; done
fi
if [ ${#DEPGRAPH_FLOWS[@]} -gt 0 ]; then
  for ((lvl = 0; lvl <= MAX_LEVEL; lvl++)); do
    echo "  Cascade level $lvl:"
    for flow in "${DEPGRAPH_FLOWS[@]}"; do
      flow_i=$(flow_idx_of "$flow")
      if [ "${FLOW_LEVEL_LIST[$flow_i]}" = "$lvl" ]; then
        provs="${FLOW_PROVIDES_LIST[$flow_i]:-(no provides)}"
        reqs="${FLOW_REQUIRES_LIST[$flow_i]:-(no requires)}"
        echo "    $flow  [requires: $reqs] [provides: $provs]"
      fi
    done
  done
fi
echo ""

# ─── Worker runner ──────────────────────────────────────────────────────────
# run_flow_on_worker <worker_index> <flow>
# Runs a single maestro test, appends its outcome to that worker's results
# file. Idempotent on results — appends one PASS/FAIL line per call.
run_flow_on_worker() {
  local worker_index=$1
  local flow=$2
  local log_file="$REPORT_DIR/logs/worker-${worker_index}.log"
  local results_file="$REPORT_DIR/logs/worker-${worker_index}.results"
  local worker_home="$PWD/$REPORT_DIR/maestro-home/worker-$worker_index"
  mkdir -p "$worker_home"
  export MAESTRO_OPTS="-Duser.home=$worker_home"

  local worker_args=("${ARGS_BASE[@]}" -e "WORKER_INDEX=$worker_index")
  # Every worker receives shared marketplace credentials so the per-worker
  # Phase 0 bootstrap can save them under its own Clerk user. The previous
  # restriction (only worker 0 / marketplace flows) made any per-worker
  # credential preflight on a non-zero worker silently no-op the inputs.
  worker_args+=(
    -e "SPORTLOTS_USERNAME=$SPORTLOTS_USERNAME"
    -e "SPORTLOTS_PASSWORD=$SPORTLOTS_PASSWORD"
    -e "BSC_USERNAME=$BSC_USERNAME"
    -e "BSC_PASSWORD=$BSC_PASSWORD"
  )

  local slug
  slug=$(echo "$flow" | sed -e 's|^\.maestro/flows/||' -e 's|/|_|g' -e 's|\.yaml$||')
  local report_args=(
    --format JUNIT
    --output "$REPORT_DIR/junit/$slug.xml"
    --test-suite-name "$slug"
    --test-output-dir "$REPORT_DIR/artifacts/$slug"
    --debug-output "$REPORT_DIR/debug/$slug"
    --flatten-debug-output
  )
  # Build a sanitized command line for logging — redact marketplace
  # credential values so they never land in maestro-report artifacts /
  # CI logs. The real worker_args (with real values) is used to invoke
  # maestro below.
  local logged_args=()
  local i=0
  while [ $i -lt ${#worker_args[@]} ]; do
    local arg="${worker_args[$i]}"
    if [ "$arg" = "-e" ] && [ $((i + 1)) -lt ${#worker_args[@]} ]; then
      local kv="${worker_args[$((i + 1))]}"
      case "$kv" in
        BSC_USERNAME=*|BSC_PASSWORD=*|SPORTLOTS_USERNAME=*|SPORTLOTS_PASSWORD=*)
          logged_args+=("-e" "${kv%%=*}=<redacted>")
          ;;
        *)
          logged_args+=("-e" "$kv")
          ;;
      esac
      i=$((i + 2))
    else
      logged_args+=("$arg")
      i=$((i + 1))
    fi
  done
  {
    echo "▶ [w$worker_index] $flow"
    if [ -n "$TIMEOUT_CMD" ]; then
      echo "$TIMEOUT_CMD" --kill-after=30 "$FLOW_TIMEOUT_SEC" "$MAESTRO" test "${logged_args[@]}" "${report_args[@]}" "$flow"
    else
      echo "$MAESTRO" test "${logged_args[@]}" "${report_args[@]}" "$flow"
    fi
  } >> "$log_file"
  # Run with 1 retry on non-timeout failures. The Maestro CDP web driver
  # has documented intermittent failures ("null cannot be cast to non-null
  # type kotlin.Int", "Failed to execute JS") that happen between successful
  # scrollUntilVisible and the immediately-following tap on the same element.
  # The JVM has also been observed to SIGSEGV/SIGBUS mid-flow. These
  # infrastructure flakes do not reflect product bugs and almost always
  # succeed on a second attempt. Retry is bounded to 1 (worst case: 2x
  # runtime per flow) and is skipped for timeout codes since those usually
  # mean a slow/hung product path that retry won't help.
  local exit_code=0
  local attempt=1
  local max_attempts="${MAESTRO_FLOW_RETRIES:-2}"
  while [ "$attempt" -le "$max_attempts" ]; do
    exit_code=0
    if [ "$attempt" -gt 1 ]; then
      echo "↻ [w$worker_index] Retry attempt $attempt/$max_attempts: $flow" >> "$log_file"
    fi
    # Per-attempt unique ID. Flows that add cards to the global
    # cardChecklist table reference ${ATTEMPT_ID} in their card
    # numbers + player names so attempt 2 doesn't collide with the
    # rows attempt 1 left behind (setup.yaml's resetSetBuilderData
    # only runs once per CI run, not between in-run retries).
    local attempt_id="w${worker_index}-a${attempt}-${RANDOM}"
    local attempt_args=("${worker_args[@]}" -e "ATTEMPT_ID=$attempt_id")
    if [ -n "$TIMEOUT_CMD" ]; then
      # --kill-after=30: after SIGTERM, give 30s, then SIGKILL — covers the
      # Maestro JVM's non-daemon heartbeat thread that ignores main's exit.
      "$TIMEOUT_CMD" --kill-after=30 "$FLOW_TIMEOUT_SEC" "$MAESTRO" test "${attempt_args[@]}" "${report_args[@]}" "$flow" >> "$log_file" 2>&1 || exit_code=$?
    else
      "$MAESTRO" test "${attempt_args[@]}" "${report_args[@]}" "$flow" >> "$log_file" 2>&1 || exit_code=$?
    fi
    if [ "$exit_code" -eq 0 ]; then
      break
    fi
    # Don't retry on timeout — usually indicates a slow/hung path that
    # won't recover, and the runtime cost of a second attempt is high.
    if [ "$exit_code" -eq 124 ] || [ "$exit_code" -eq 137 ]; then
      break
    fi
    attempt=$((attempt + 1))
  done
  if [ "$exit_code" -eq 0 ]; then
    if [ "$attempt" -gt 1 ]; then
      echo "✅ [w$worker_index] Passed on retry: $flow" >> "$log_file"
    else
      echo "✅ [w$worker_index] Passed: $flow" >> "$log_file"
    fi
    echo "PASS $flow" >> "$results_file"
  elif [ "$exit_code" -eq 124 ] || [ "$exit_code" -eq 137 ]; then
    # 124 = SIGTERM by timeout; 137 = SIGKILL after grace period.
    echo "⏱  [w$worker_index] TIMEOUT after ${FLOW_TIMEOUT_SEC}s: $flow" >> "$log_file"
    echo "FAIL $flow (timeout)" >> "$results_file"
  else
    echo "❌ [w$worker_index] Failed after $max_attempts attempts: $flow" >> "$log_file"
    echo "FAIL $flow" >> "$results_file"
  fi
  echo "" >> "$log_file"
}

# run_serial_lane <worker_index> <flow...>
# Runs a list of flows sequentially on one worker. Appends to the worker's
# log/results files (which are truncated once at script init), so Phase 0
# bootstrap output remains visible alongside Phase 1 / 2 output.
run_serial_lane() {
  local worker_index=$1
  shift
  for flow in "$@"; do
    run_flow_on_worker "$worker_index" "$flow"
  done
}

# run_parallel_batch <flow...>
# Runs the given flows in parallel, one per worker, capped at PARALLELISM.
# Worker indices are reused: with PARALLELISM=3 and 5 flows, flows 1..3 run on
# workers 0..2, then flows 4..5 run on workers 0..1. Per-worker log/results
# files are appended to (preserving prior runs in the same lane file).
# Worker 0 is reserved for the SERIAL_WORKER_INDEX during phase 1 — pass a
# starting index to avoid collisions if needed.
run_parallel_batch() {
  local flows=("$@")
  if [ ${#flows[@]} -eq 0 ]; then return 0; fi
  local pids=()
  local worker_index_offset="${WORKER_INDEX_OFFSET:-0}"
  for i in "${!flows[@]}"; do
    local w=$(( (i + worker_index_offset) % PARALLELISM ))
    run_flow_on_worker "$w" "${flows[$i]}" &
    pids+=($!)
    # Cap concurrent maestro processes at PARALLELISM
    if [ "${#pids[@]}" -ge "$PARALLELISM" ]; then
      wait "${pids[0]}" || true
      pids=("${pids[@]:1}")
    fi
  done
  for pid in "${pids[@]}"; do
    wait "$pid" || true
  done
}

# ─── Phase 0: per-worker bootstrap ──────────────────────────────────────────
# Each worker signs in as TEST_EMAIL_${WORKER_INDEX} and saves the shared
# BSC + SL credentials under that Clerk user in Secret Manager. Idempotent —
# the underlying setup-bsc-credentials.yaml / setup-sportlots-credentials.yaml
# helpers short-circuit when "Clear Credentials" is visible, so reruns are
# cheap and never trigger a fresh marketplace login (rate-limit risk).
#
# Why this is required: each Maestro worker drives a distinct Clerk test
# user (TEST_EMAIL_${WORKER_INDEX}). Marketplace adapter calls (BSC / SL)
# fetch session tokens from Secret Manager keyed by the Clerk user ID.
# Without per-worker bootstrap, only the worker that ran setup.yaml had
# its credentials saved; other workers' adapter calls hit NOT_FOUND, both
# options arrays return empty, the ReconciliationModal silently never
# opens, and tests time out.
BOOTSTRAP_FLOW=".maestro/flows/profile/worker-bootstrap.yaml"
if [ -f "$BOOTSTRAP_FLOW" ]; then
  echo "Phase 0: per-worker bootstrap (sign-in + save BSC + SL creds for every worker)"
  # SERIAL by default. Concurrent JVM startup of multiple maestro CLI processes
  # has triggered JIT-compiler SIGSEGVs in kotlin.reflect on JDK 23 / macOS
  # aarch64 (deterministic across runs; different code paths each time).
  # Phase 1/2 parallelism is unaffected — JVMs stagger naturally after the
  # initial Phase 0 ramp. Set MAESTRO_PHASE0_PARALLEL=true to opt back into
  # parallel bootstrap (useful where JVM is stable, e.g. Linux CI runners).
  if [ "${MAESTRO_PHASE0_PARALLEL:-false}" = "true" ]; then
    bootstrap_pids=()
    for w in $(seq 0 $((PARALLELISM - 1))); do
      run_flow_on_worker "$w" "$BOOTSTRAP_FLOW" &
      bootstrap_pids+=($!)
    done
    for pid in "${bootstrap_pids[@]}"; do
      wait "$pid" || true
    done
  else
    for w in $(seq 0 $((PARALLELISM - 1))); do
      run_flow_on_worker "$w" "$BOOTSTRAP_FLOW"
    done
  fi
  # Fail fast if any worker failed to bootstrap — every subsequent flow on
  # that worker would hit Secret Manager NOT_FOUND and time out silently.
  bootstrap_failed=false
  for w in $(seq 0 $((PARALLELISM - 1))); do
    if grep -q "^FAIL $BOOTSTRAP_FLOW" "$REPORT_DIR/logs/worker-${w}.results" 2>/dev/null; then
      echo "ERROR: Phase 0 bootstrap failed on worker $w. See $REPORT_DIR/logs/worker-${w}.log" >&2
      bootstrap_failed=true
    fi
  done
  if $bootstrap_failed; then
    echo "Aborting: bootstrap must succeed on every worker before Phase 1 can run safely." >&2
    exit 1
  fi
  echo "Phase 0 complete."
  echo ""
fi

# ─── Phase 1: static lanes (concurrent) ─────────────────────────────────────
# Lanes claim workers dynamically based on which lanes have any flows. The
# isolated lane gets the lowest worker index (or worker 0 alone if it's the
# only lane); marketplace gets the next; independent uses everything left.
# The cascade in phase 2 is gated on the isolated lane finishing — marketplace
# and independent lanes can keep running concurrently with the cascade.
#
# Special case PARALLELISM=1: everything serial on worker 0 in order
# isolated → marketplace → independent → cascade.
phase1_pids=()
ISOLATED_PID=""
MARKETPLACE_PID=""
INDEPENDENT_PID=""

if [ "$PARALLELISM" -eq 1 ]; then
  if [ ${#ISOLATED_FLOWS[@]} -gt 0 ];    then run_serial_lane 0 "${ISOLATED_FLOWS[@]}";    fi
  if [ ${#MARKETPLACE_FLOWS[@]} -gt 0 ]; then run_serial_lane 0 "${MARKETPLACE_FLOWS[@]}"; fi
  if [ ${#INDEPENDENT_FLOWS[@]} -gt 0 ]; then run_serial_lane 0 "${INDEPENDENT_FLOWS[@]}"; fi
else
  next_worker=0
  ind_workers=()

  # Lane I: claim a worker
  if [ ${#ISOLATED_FLOWS[@]} -gt 0 ]; then
    isolated_worker=$next_worker
    next_worker=$((next_worker + 1))
    (run_serial_lane "$isolated_worker" "${ISOLATED_FLOWS[@]}") &
    ISOLATED_PID=$!
    phase1_pids+=("$ISOLATED_PID")
  fi

  # Lane M: claim the next worker (if any are left after I)
  if [ ${#MARKETPLACE_FLOWS[@]} -gt 0 ]; then
    if [ "$next_worker" -lt "$PARALLELISM" ]; then
      marketplace_worker=$next_worker
      next_worker=$((next_worker + 1))
    else
      # All workers reserved by I — fall back to running marketplace on the
      # last reserved worker AFTER I finishes.
      marketplace_worker=$((next_worker - 1))
    fi
    if [ "$marketplace_worker" = "$isolated_worker" ] 2>/dev/null && [ -n "$ISOLATED_PID" ]; then
      (wait "$ISOLATED_PID" || true; run_serial_lane "$marketplace_worker" "${MARKETPLACE_FLOWS[@]}") &
    else
      (run_serial_lane "$marketplace_worker" "${MARKETPLACE_FLOWS[@]}") &
    fi
    MARKETPLACE_PID=$!
    phase1_pids+=("$MARKETPLACE_PID")
  fi

  # Lane P: all workers from next_worker..PARALLELISM-1
  if [ ${#INDEPENDENT_FLOWS[@]} -gt 0 ]; then
    for ((w = next_worker; w < PARALLELISM; w++)); do ind_workers+=("$w"); done
    if [ ${#ind_workers[@]} -eq 0 ]; then
      # No free worker — fall back to running independent on the marketplace
      # worker after marketplace finishes (or isolated worker if no marketplace).
      fallback_worker=${marketplace_worker:-${isolated_worker:-0}}
      fallback_pid=${MARKETPLACE_PID:-${ISOLATED_PID:-}}
      if [ -n "$fallback_pid" ]; then
        (wait "$fallback_pid" || true; run_serial_lane "$fallback_worker" "${INDEPENDENT_FLOWS[@]}") &
      else
        (run_serial_lane "$fallback_worker" "${INDEPENDENT_FLOWS[@]}") &
      fi
      INDEPENDENT_PID=$!
      phase1_pids+=("$INDEPENDENT_PID")
    else
      # Stripe round-robin across ind_workers. Log files were truncated once
      # at script init; we append here so prior phases' output is preserved.
      (
        ind_count=${#ind_workers[@]}
        sub_pids=()
        for i in "${!INDEPENDENT_FLOWS[@]}"; do
          w="${ind_workers[$((i % ind_count))]}"
          run_flow_on_worker "$w" "${INDEPENDENT_FLOWS[$i]}" &
          sub_pids+=($!)
          if [ "${#sub_pids[@]}" -ge "$ind_count" ]; then
            wait "${sub_pids[0]}" || true
            sub_pids=("${sub_pids[@]:1}")
          fi
        done
        for pid in "${sub_pids[@]}"; do wait "$pid" || true; done
      ) &
      INDEPENDENT_PID=$!
      phase1_pids+=("$INDEPENDENT_PID")
    fi
  fi
fi

# Wait for the isolated lane specifically (the cascade can't start until it's done).
if [ -n "$ISOLATED_PID" ]; then
  wait "$ISOLATED_PID" || true
fi

# ─── Phase 2: cascade levels ────────────────────────────────────────────────
# For each level 0..N: run that level's depgraph flows in parallel across all
# workers and wait before moving to the next level.
#
# All PARALLELISM workers are eligible. The marketplace and independent lanes
# might still be running (they own workers 1 and 2..N-1 respectively); using
# the same indices is fine because run_flow_on_worker just appends to that
# worker's log file. Maestro instances per worker remain serialized at the
# lane level (each lane has at most one maestro process at a time), but across
# lanes the OS can run multiple concurrently up to its scheduling limits.
#
# To keep concurrency bounded by PARALLELISM, we wait for any in-flight
# phase-1 background lane PIDs whose worker indices the cascade wants to use.
# Simpler approach: just cap cascade concurrency at PARALLELISM via the batch
# helper. The phase-1 lanes naturally finish during the cascade because each
# cascade level forks its own set of maestro processes.
# ─── Cascade prerequisite tracking ──────────────────────────────────────────
# Before NEO-23: if a level-N producer flow failed, level-N+1 flows ran anyway
# with state that didn't match what the test expected. That made local↔CI
# divergence noisy: a flake at level N changed downstream behavior in subtle
# ways (e.g. cards-insert "passing" locally only because sets-inserts SIGSEGV'd
# and didn't write reconciliation rows that would have tripped a validator bug
# in CI). Now: track which provides-states have at least one PASSing producer.
# Any flow whose requires can't be satisfied gets SKIPped and recorded as
# FAIL (the test wasn't run, but the cascade is broken — surface it).
#
# Opt out via MAESTRO_CASCADE_PERMISSIVE=true if you want the old run-anyway
# behavior (e.g. for debugging a single failing flow at level 0).
CASCADE_PERMISSIVE="${MAESTRO_CASCADE_PERMISSIVE:-}"

# Set of satisfied states, stored as a space-delimited string with sentinel
# spaces on both ends so simple `case` glob membership tests don't need
# tricky escaping. (Why not `declare -A`: macOS ships bash 3.2.57 which
# doesn't support associative arrays, and we want this script to run on
# dev macOS as well as Linux CI. Tracked as a follow-up to drop the bash
# wrapper entirely in favor of native Maestro orchestration.)
STATE_SATISFIED=" "

# state_is_satisfied <state> → exit 0 if at least one producer of <state>
# has passed, exit 1 otherwise. Membership test on STATE_SATISFIED.
state_is_satisfied() {
  case "$STATE_SATISFIED" in
    *" $1 "*) return 0 ;;
    *)        return 1 ;;
  esac
}

# Check whether a flow appears as PASS in any worker's results.
flow_passed_in_results() {
  local flow="$1"
  for ((w = 0; w < PARALLELISM; w++)); do
    if grep -qE "^PASS ${flow}\$" "$REPORT_DIR/logs/worker-${w}.results" 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

if [ "$MAX_LEVEL" -ge 0 ]; then
  for ((lvl = 0; lvl <= MAX_LEVEL; lvl++)); do
    level_flows=()
    skipped_flows=()
    for flow in "${DEPGRAPH_FLOWS[@]}"; do
      flow_i=$(flow_idx_of "$flow")
      if [ "${FLOW_LEVEL_LIST[$flow_i]}" = "$lvl" ]; then
        # Check every required state has at least one passed producer.
        # (Level 0 flows have no requires, so this loop is a no-op for them.)
        missing_state=""
        if [ -z "$CASCADE_PERMISSIVE" ]; then
          for state in ${FLOW_REQUIRES_LIST[$flow_i]}; do
            if ! state_is_satisfied "$state"; then
              missing_state="$state"
              break
            fi
          done
        fi
        if [ -n "$missing_state" ]; then
          skipped_flows+=("$flow:$missing_state")
        else
          level_flows+=("$flow")
        fi
      fi
    done

    # Record skips before running this level so the worker-0 log shows them
    # in the right order. Each skip counts as a FAIL in the aggregate so the
    # cascade-broken state is visible in the sticky PR comment.
    for entry in "${skipped_flows[@]}"; do
      flow="${entry%%:*}"
      state="${entry##*:}"
      log_file="$REPORT_DIR/logs/worker-0.log"
      results_file="$REPORT_DIR/logs/worker-0.results"
      echo "⏭️  [w0] Skipped (missing prerequisite \"$state\"): $flow" >> "$log_file"
      echo "FAIL $flow (skipped: prerequisite \"$state\" not satisfied)" >> "$results_file"
    done

    if [ ${#level_flows[@]} -gt 0 ]; then
      run_parallel_batch "${level_flows[@]}"
    fi

    # After the level finishes, record any newly-satisfied states. A state is
    # satisfied iff at least one of its producers PASSed at this level (or
    # earlier; STATE_SATISFIED is monotonic-add).
    for flow in "${level_flows[@]}"; do
      if flow_passed_in_results "$flow"; then
        flow_i=$(flow_idx_of "$flow")
        for state in ${FLOW_PROVIDES_LIST[$flow_i]}; do
          # Skip duplicate-add: monotonic-add semantics, idempotent on repeat.
          if ! state_is_satisfied "$state"; then
            STATE_SATISFIED="${STATE_SATISFIED}${state} "
          fi
        done
      fi
    done
  done
fi

# Final wait: any phase-1 background lanes that didn't finish yet.
for pid in "${phase1_pids[@]}"; do
  wait "$pid" || true
done

# ─── Stream worker logs ─────────────────────────────────────────────────────
for ((w = 0; w < PARALLELISM; w++)); do
  log_file="$REPORT_DIR/logs/worker-${w}.log"
  if [ -f "$log_file" ]; then
    echo "━━━━━━ Worker $w ━━━━━━"
    cat "$log_file"
  fi
done

# ─── Aggregate results ──────────────────────────────────────────────────────
PASSED=0
FAILED=0
FAILURES=()
for ((w = 0; w < PARALLELISM; w++)); do
  results_file="$REPORT_DIR/logs/worker-${w}.results"
  [ -f "$results_file" ] || continue
  while IFS= read -r line; do
    case "$line" in
      "PASS "*) PASSED=$((PASSED + 1)) ;;
      "FAIL "*)
        FAILED=$((FAILED + 1))
        FAILURES+=("${line#FAIL }")
        ;;
    esac
  done < "$results_file"
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASSED passed, $FAILED failed (parallelism=$PARALLELISM)"
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "  Failed flows:"
  for f in "${FAILURES[@]}"; do echo "    - $f"; done
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Build the markdown summary once and write it to $REPORT_DIR/summary.md so
# the CI workflow can post it as a sticky PR comment. Also append it to
# $GITHUB_STEP_SUMMARY so it renders on the Actions run page.
SUMMARY_FILE="$REPORT_DIR/summary.md"
{
  echo "## Maestro E2E results"
  echo ""
  echo "**$PASSED passed · $FAILED failed** (${#SMOKE_FLOWS[@]} total${TAG:+, tag \`$TAG\`}, parallelism $PARALLELISM)"
  echo ""
  echo "| Status | Flow |"
  echo "| :---: | --- |"
  for flow in "${SMOKE_FLOWS[@]}"; do
    if printf '%s\n' "${FAILURES[@]}" | grep -Fxq "$flow"; then
      echo "| ❌ | \`$flow\` |"
    else
      echo "| ✅ | \`$flow\` |"
    fi
  done
} > "$SUMMARY_FILE"

if [ -n "$GITHUB_STEP_SUMMARY" ]; then
  cat "$SUMMARY_FILE" >> "$GITHUB_STEP_SUMMARY"
fi

if [ ${#FAILURES[@]} -gt 0 ]; then
  exit 1
fi
