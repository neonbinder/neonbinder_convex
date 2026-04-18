#!/bin/bash
# Runs E2E flows sequentially to avoid Clerk concurrent sign-in throttling.
# Each flow signs in independently; parallel execution triggers "Too many requests".
# Flows are discovered dynamically from .maestro/flows/ based on an optional tag filter.
#
# Usage:
#   ./run-e2e-smoke.sh           # run all flows
#   ./run-e2e-smoke.sh smoke     # run only flows tagged "smoke"

set -e

# Load .env.test if it exists (won't override vars already set in the environment)
if [ -f .env.test ]; then
  set -a
  source .env.test
  set +a
fi

MAESTRO="$HOME/.maestro/bin/maestro"
CONFIG=".maestro/config.yaml"
APP_URL="${APP_URL:-http://localhost:3000}"
# Unique username per run to avoid "already taken" in profile flows
TEST_USERNAME="${TEST_USERNAME:-neontester_$(date +%s)}"
# Credential env vars (real credentials for dev@neonbinder.io accounts)
SPORTLOTS_USERNAME="${SPORTLOTS_USERNAME:-}"
SPORTLOTS_PASSWORD="${SPORTLOTS_PASSWORD:-}"
BSC_USERNAME="${BSC_USERNAME:-}"
BSC_PASSWORD="${BSC_PASSWORD:-}"
# Per-flow JUnit + screenshot artifacts land here; the CI workflow publishes them
# as a PR check (JUnit) and uploads the directory as an Actions artifact.
REPORT_DIR="${REPORT_DIR:-maestro-report}"
mkdir -p "$REPORT_DIR/junit" "$REPORT_DIR/artifacts"
# --platform web required so launchApp navigates to each flow's url: (config cannot set platform)
ARGS=(--platform web --config "$CONFIG" -e "APP_URL=$APP_URL" -e "TEST_USERNAME=$TEST_USERNAME" -e "SPORTLOTS_USERNAME=$SPORTLOTS_USERNAME" -e "SPORTLOTS_PASSWORD=$SPORTLOTS_PASSWORD" -e "BSC_USERNAME=$BSC_USERNAME" -e "BSC_PASSWORD=$BSC_PASSWORD")
TAG="${1:-}"

# Discover flows: filter by tag if provided, otherwise find all yaml files.
SMOKE_FLOWS=()
if [ -n "$TAG" ]; then
  while IFS= read -r f; do
    SMOKE_FLOWS+=("$f")
  done < <(grep -rlE "^[[:space:]]*-[[:space:]]+${TAG}$" .maestro/flows/ --include="*.yaml" | sort)
else
  while IFS= read -r f; do
    SMOKE_FLOWS+=("$f")
  done < <(find .maestro/flows/ -name "*.yaml" | sort)
fi

if [ ${#SMOKE_FLOWS[@]} -eq 0 ]; then
  echo "No flows found${TAG:+ tagged \"$TAG\"} in .maestro/flows/"
  exit 0
fi

echo "Found ${#SMOKE_FLOWS[@]} flow(s)${TAG:+ tagged \"$TAG\"}:"
for f in "${SMOKE_FLOWS[@]}"; do echo "  $f"; done
echo ""

PASSED=0
FAILED=0
FAILURES=()

for flow in "${SMOKE_FLOWS[@]}"; do
  slug=$(echo "$flow" | sed -e 's|^\.maestro/flows/||' -e 's|/|_|g' -e 's|\.yaml$||')
  REPORT_ARGS=(--format JUNIT --output "$REPORT_DIR/junit/$slug.xml" --test-suite-name "$slug" --test-output-dir "$REPORT_DIR/artifacts/$slug")
  echo "▶ Running: $flow"
  echo "$MAESTRO" test "${ARGS[@]}" "${REPORT_ARGS[@]}" "$flow"
  if "$MAESTRO" test "${ARGS[@]}" "${REPORT_ARGS[@]}" "$flow"; then
    echo "✅ Passed: $flow"
    PASSED=$((PASSED + 1))
  else
    echo "❌ Failed: $flow"
    FAILED=$((FAILED + 1))
    FAILURES+=("$flow")
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASSED passed, $FAILED failed"
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "  Failed flows:"
  for f in "${FAILURES[@]}"; do echo "    - $f"; done
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Emit a markdown summary for GitHub Actions runs (harmless locally).
if [ -n "$GITHUB_STEP_SUMMARY" ]; then
  {
    echo "## Maestro E2E results"
    echo ""
    echo "**$PASSED passed · $FAILED failed** (${#SMOKE_FLOWS[@]} total${TAG:+, tag \`$TAG\`})"
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
  } >> "$GITHUB_STEP_SUMMARY"
fi

if [ ${#FAILURES[@]} -gt 0 ]; then
  exit 1
fi
