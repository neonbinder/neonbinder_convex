# SetSelector sync redesign — design plan (2026-06-14)

## Why (root cause, evidence-backed)
#28's stuck "Syncing Variant Types" (custom column never shows "+ Custom") is a **symptom**, not the disease:
- The backend custom-subtree skip is an **18ms no-op** — proven via Convex logs (`error_class:"skipped_custom_subtree", duration_ms:18`). Not a slow backend.
- The column still hangs in `mode="sync"` for 45s because the FE **`onDone` (sync→idle) handoff is occasionally dropped** (`useSelectorSync` discards a result via its `mountedRef`/`runId` guard if the form is torn down/superseded before the fast result resolves). Intermittent — the same drill passed on a re-run.

**The disease: the FE-driven sync state-machine in `EntityColumn` + the per-form `onDone` handoff.** It's a fragile seam present on every column.

### Owner decisions (2026-06-14)
- "Custom subtrees don't read marketplaces" must live **wholly in the backend** (it already does: `isCustomSubtree` in `fetchAggregatedOptions`). Do NOT add a duplicate FE check — it saves ~18ms and adds drift risk.
- Preferred model: **FE reads from Convex (reactive + cached); only when the table is empty does the backend run the full marketplace sync.** (This is already ~the model — the refinement is moving the sync *trigger* out of the fragile FE state-machine.)
- **Governing principle (2026-06-14, crystallized): a marketplace-agnostic FE.** The FE represents only NB's *canonical* hierarchy shape and calls the backend with what NB knows — its **position** in the hierarchy (`level` + `parentId`, transitively the whole ancestor chain). The backend owns EVERYTHING about how to get (or skip) the data for each level + each marketplace: which adapters to call, the **SL-set ↔ BSC-Base-variant mapping**, manufacturer prefix-matching, the custom-subtree skip, merge-vs-reconcile. **Adding a marketplace must be a backend-only change** — the FE never learns marketplaces exist; it only changes when NB's own model of "a set" changes. (The existing cross-taxonomy stitching is KEPT — it just lives wholly in the backend.)

## Current architecture
**Read side (good — keep):** `EntityColumn` renders `items = useQuery(getSelectorOptions,{level,parentId})` — reactive, client-cached. Sync results are persisted to the `selectorOptions` table, so data is already cached server + client side.

**Sync side (fragile — the target):** `EntityColumn` is a 3-mode state-machine (`idle`/`sync`/`custom`) with 4 refs (`autoSyncedRef`, `hasSyncedRef`, `prevModeRef`, `wasVisibleRef`) and effects for: scroll-into-view, first-sync latch, parent-change reset, freeze-on-interaction, and auto-sync-on-empty. On an empty column it flips `mode="sync"`, renders a per-level `*Form`, and depends on that form calling `onDone()` to return to `idle` (the only mode where "+ Custom"/"Sync" render).

**Three sync backends behind that one seam** (see table in chat). All share the failure mode: EntityColumn → sync mode → form runs async → `onDone` flips back; a dropped/late `onDone` strands the column in sync with no "+ Custom". `drill-forms-onDone.test.tsx` already exists — this handoff is load-bearing.

**Must preserve:** the recoverable-error UX (Retry/Cancel on sync failure) + `selector_sync_fe_timeout` PostHog telemetry; `requireAdmin` + prod fail-closed gating on any marketplace-fetch entry point.

## Target architecture — decouple READ from POPULATE; backend owns the decision
1. **Read (unchanged):** `getSelectorOptions` query drives display.
2. **Populate trigger (one door, marketplace-agnostic args):** one backend **mutation** `ensureSelectorOptions({level, parentId, force?})`, called once when a column opens. The FE passes ONLY its canonical position — no `parentFilters`, no per-marketplace hints. The backend expands the ancestor chain from `parentId` and **decides everything via an internal per-level dispatcher** (NOT three app-facing actions): rows present → no-op; custom subtree → no-op (`isCustomSubtree`); else run the level's strategy and `ctx.scheduler` the work. Returns immediately. (Mutations can schedule actions; queries can't — that's why the trigger is a mutation, not a magic query.)
   - Per-level strategies behind the dispatcher (collapse today's 3 actions): **aggregate** (SL+BSC merge) for sport/year/manufacturer/variantType; **sets** (BSC-by-year + SL-Base mapping + manufacturer prefix-match) for setName — KEPT as-is, just behind the door; **reconcile** (raw + auto-match + human-resolve) for insert/parallel.
3. **Reactive sync status (new):** a small `selectorSyncStatus` table keyed by (level, parentId) → `{status:"syncing"|"error", message, requestId}`, written by `ensureSelectorOptions` (syncing) and the sync action (clear/error). FE reads it via `useQuery` and derives loading/error/Retry — replacing the FE mode flag. Retry = `ensureSelectorOptions(force:true)`.
4. **EntityColumn:** drop the `sync` mode + the sync refs + auto-sync/onDone machinery. Keep: render `items`/empty-state, a *derived* loading/error indicator, and the `custom` add form (synchronous — no async race). "+ Custom"/"Sync" render whenever not loading.

**Net:** no `onDone` handoff to drop → the stuck-sync class is gone; all sync-decision logic (incl. custom-skip) is backend-only; Convex reactivity drives the UI.

## Migration (phased)
- **Phase 1 — 4 aggregator levels** (sport/year/manufacturer/variantType via `fetchAggregatedOptions`+`useSelectorSync`). Uniform, well-understood, and where #28/#30/#31 live. Build `ensureSelectorOptions` + `selectorSyncStatus`; migrate these 4 forms + EntityColumn; validate cluster + must-stay-green.
- **Phase 2 — setName** (`syncSets`). Same pattern, one backend.
- **Phase 3 — insert/parallel reconciliation** (`fetchRawOptions`/ReconciliationModal). Most complex (multi-step modal). Needs its own analysis — likely keeps the modal but routes the populate-trigger through `ensureSelectorOptions`. Deepest risk; do last.

## Risk / validation
- Most-tested, most-fragile core (per NEO-46/47 history). Validate every phase through the local queue harness: **must-stay-green** = #27 features-propagation, #32 set-attributes-edit, team-picker, sets-base, setup cascade; **should-go-green** = #28/#30/#31.
- Update/keep `drill-forms-onDone.test.tsx` + `EntityColumn.*.test.tsx`.
- security-auditor review on `ensureSelectorOptions` (gates marketplace fetches).
- This is a product change to the Set Builder heart — bigger than a flow fix. Worth it: kills a bug class, not one flow.

## Open questions
- `selectorSyncStatus` as a new table vs fields elsewhere (empty column has no natural row → a dedicated table is cleaner).
- Does freeze-on-interaction / collaborative background re-sync still have a purpose once the mode-machine is gone? (Likely drop; reactivity covers collaborative updates.)
- Can the insert/parallel ReconciliationModal fit the ensure-trigger, or stay bespoke (just remove its onDone-strand risk)?
- Manual "Sync" button → maps to `ensureSelectorOptions(force:true)` (keep refresh capability).

## Phase 1 — IMPLEMENTED (2026-06-14, on jburich/sync-maestro-agent-memory; NOT pushed)
Commits: `39841c4` backend · `f225b4a` FE · `ba19e01` new-path test · `f168f2f` auth fix.
- **Backend:** `selectorSyncStatus` table; `getSelectorSyncStatus` query; `setSelectorSyncStatus` internalMutation; `ensureSelectorOptions` **action** — one door: already-populated → no-op; custom-subtree → no-op (uniform skip); else mark "syncing", run `fetchAggregatedOptions` inline via `ctx.runAction`, clear/error status. Derives `parentFilters` from the chain (FE passes none).
- **FE:** `EntityColumn` guarded dual-path (`useEnsureSync`) — reactive `selectorSyncStatus` drives loading/error; `ensureSelectorOptions` fired on empty; NO sync mode / `onDone`. Wired on sport/year/manufacturer/variantType (`syncingLabel` matches the legacy "Syncing X" headings the flows assert). setName/insert/parallel keep the legacy path → Phases 2-3.
- **GOTCHA (cost a debug cycle, worth remembering):** `ensureSelectorOptions` MUST be an action, not a mutation + `ctx.scheduler`. **Scheduled functions run with NO auth** → `fetchAggregatedOptions`' `requireAdmin` threw "Not authenticated", the sync silently errored, and the loading box flashed syncing→error (so #26's "Syncing Sport Options" assert missed it). `ctx.runAction` from an authenticated action PROPAGATES the identity; the scheduler does not.
- **Validation:** 19 component tests green (old path byte-identical + new path: auto-ensure once, loading box, idle "+ Custom", error-not-stranded). E2E (local queue harness): #26 + #28 + team-picker green after the auth fix; coverage batch (#27/#32/#30/#31/sets-base) in progress. Deterministic proof of the core fix: no `onDone` handoff ⇒ the dropped-result stuck-sync race is structurally impossible.

## Resolved decisions (2026-06-14, owner)
1. **insert/parallel stays always-manual reconciliation.** Auto-match is UI assistance only; a human confirms. (Do NOT auto-write high-confidence matches.)
2. **`selectorSyncStatus` = a new dedicated table.**
3. **Drop freeze-on-interaction** (and the background re-sync) once the mode-machine is gone — Convex reactivity covers collaborative updates.

## Audit findings — insert/parallel ("is anything else in there?", 2026-06-14)
Confirmed the *only* sync-level difference for insert/parallel is reconciliation: `fetchRawOptions` fetches SL+BSC from the chain (same pattern), returns raw + `autoMatched`/`unmatchedBsc`/`unmatchedSl`, the human resolves in `ReconciliationModal`, and `storeReconciledOptions` persists the matched SL↔BSC pairs (incl. SL-Base-prefix stripping via `baseSlPrefix`). Two notes:
- **BUG/inconsistency to fix in the unified model:** `fetchRawOptions` is MISSING the `isCustomSubtree` skip that `fetchAggregatedOptions` + `syncSetsAcrossManufacturers` have. A custom insert/parallel column therefore trips the "missing BSC slugs" precondition and returns an *error* instead of skipping cleanly (a 2nd manifestation of the stuck-column class). The unified `ensureSelectorOptions` dispatcher must apply `isCustomSubtree` to ALL levels.
- **Out of scope — leave alone:** `parallelDetection.ts` / `ParallelGroupingModal` is a separate adjacent feature (prefix auto-grouping of existing inserts into parent/parallel — the "Group Parallels" UI tested by #28/#30/#31). NOT marketplace sync; the sync redesign does not touch it.
