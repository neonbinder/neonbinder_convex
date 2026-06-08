# NEO-46 resume worklog — 2026-06-08 (after laptop crash)

Branch: `jburich/neo-46-scale-out-e2e-regression-across-multiple-free-runners-matrix` · PR #51
Plan: `~/.claude/plans/overnight-you-were-working-compiled-cherny.md`

## Root cause of the red on `d52b25c` (NOT sharding)
The "single setup track" refactor (`c8af6af`→`90bc204`→…) dropped `provides:setup-done` from the
producer but left `requires:setup-done` dangling on ~13 consumer flows → dep-graph skips them
("prerequisite not satisfied" = 13 of 14 failures). The uncommitted edits correctly FINISHED
removing the dangling `requires:` tags + excluded `setup` from threads — but the pre-matrix seed
job that replaces in-matrix setup didn't exist yet. That's the missing half.

## DECISION (user-confirmed 2026-06-08)
Pre-matrix **seed job** + **full cross-shard distribution** (not "keep setup on shard 0"). Setup
seeds the shared per-PR Convex preview once before the matrix fans out; every flow is independent.
Also confirmed: **dedup = propose & wait** (no autonomous deletes); **parallelism tuning is in scope**.

## User guidance while away (2026-06-08)
- Individual flows must keep passing (p=1) as I convert. Parallel (p=2) failures are EXPECTED/OK until Phase 5.
- Swap Phase 4 & 5: do commit/verify/drive-green FIRST, dedup LAST (still needs approval). "We can dedup later."

## Phase order (adjusted): 1 → 2 → 3 → 5 → 6 → 4(dedup, await approval)

---

## ✅ PHASE 1 — Pre-matrix seed infrastructure (DONE, validated plan-only)
- **`run-e2e-smoke.sh`**: added `setup` SELECT_MODE = the ONLY entry point that runs setup-tagged flows.
  Selects exactly `setup.yaml → setup-insert.yaml → setup-parallel.yaml` in EXPLICIT order (skips `sort -u`),
  forces `PARALLELISM=1` (single ordered writer; global reset must not race). Kept the uncommitted
  setup-exclusion in all/tag/grep modes + flat `is_distributable_flow() return 0`.
- **`.github/actions/maestro-runner/action.yml`** (NEW composite): bypass proxy + pinned Java/Chrome/Xvfb/Maestro.
  Shared by `seed` and `e2e` so runner prep never drifts. Faithful copy of the old inlined e2e steps.
- **`.github/workflows/e2e-tests.yml`**: new `seed` job (needs setup; runs `npm run test:e2e -- setup` at p=1,
  uploads `maestro-report-seed`); `e2e` refactored to use the composite + `needs: [setup, seed]`.
- **Verified resetMyTestState is per-user** (convex/testing.ts:30 — deletes only caller's publicProfiles/
  userProfiles/prizePool; NEVER touches global selectorOptions/cardChecklist/players/teams). So the matrix
  legs' Phase-0 worker-bootstrap (/testing/reset) can't wipe the seeded baseline. Seed-then-matrix is sound.
- **Validation (plan-only)**: `bash -n` clean; `setup` → 3 flows in order, p=1, all independent;
  shard0/shard1 partition disjoint + exhaustive (union 43 = single-shard total), NO setup leak,
  marketplace backbone (12) shard-0-only, global worker indexing shard0→EMAIL_0..1 / shard1→EMAIL_2..3.
- **Not yet committed.** Workflow YAML parses; job graph setup→seed→e2e→report correct. (actionlint
  download blocked by sandbox; relied on YAML parse + faithful copy.)

## ✅ PHASE 2 — Isolation correctness (DONE — already correct, NO edits needed)
- **Global-reset hazard = FALSE ALARM.** Only `setup.yaml:75` actually `tapOn: "Reset Set Builder Data"`.
  The checklist-fetch-cancel-dialog match was a COMMENT (line 28, local-run note). That flow also already
  engineers around a populated players/teams table (adds a uniquely-named custom player to force the dialog),
  so it's compatible with the seeded baseline. (Stale FRESH-DB comment can be cleaned in Phase 3.)
- **Per-worker namespacing CORRECT.** util-drill-to-custom-set.yaml uses `E2E Test Sport ${WORKER_INDEX}`
  throughout; WORKER_INDEX is the GLOBAL index (run_flow_on_worker passes global_worker) → shard0=...0/1,
  shard1=...2/3, no cross-shard collision. It already uses `below:{id:"Search sets"}` (not index:).
- **Credential restore CONFIRMED.** test-/save- bsc/sl flows all end with /testing/seed-credentials?redirect=/profile.

## Phase 3 precise scope (REAL index: selectors, comments excluded): 7 set-selector flows
  features-propagation, multi-source-panel-opens-dialog, set-attributes-edit, team-picker,
  topps-chrome-marketplace-read, tcdb-auto-enrich, topps-chrome-add-feature. (utils already converted.)
  Plus extendedWaitUntil{timeout} → 7s default where not marketplace/cold-sync. Delegate to maestro-e2e-author.

## Commits this session
- Pushing infra + tag-sweep NOW (before Phase 3) to validate the SEED job (keystone) early in CI.
  Matrix legs expected to fail on unconverted flows — that's OK (user: parallel-fail OK until Phase 5).
