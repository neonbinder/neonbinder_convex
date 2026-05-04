---
name: Sync form auto-fire timing — skip intermediate loading state assert entirely
description: The loading state heading races against fast/cached syncs; go straight to scrollUntilVisible for the completion signal
type: feedback
---

All set-selector sync forms auto-fire on mount (YearForm, ManufacturerForm, SetForm, SetVariantForm,
VariantForm). If the data is already in the database or the network is fast, the loading state
heading (e.g., "Syncing Variant Types") can disappear before Maestro evaluates the assertion.

Even the combined-regex pattern `".*Syncing X|Sync X.*"` can FAIL if the form fires AND closes AND
the "Sync X" button returns—all before Maestro reaches the extendedWaitUntil step.

**Wrong pattern (still races):**
```yaml
- tapOn: "Sync Variant Types"
- extendedWaitUntil:
    visible:
      text: ".*Syncing Variant Types|Sync Variant Types.*"  # CAN STILL MISS on fast/cached
    timeout: 15000
- scrollUntilVisible:
    element:
      text: "Sync Variant Types"
    timeout: 60000
```

**Correct pattern — skip the intermediate assert entirely:**
```yaml
- tapOn: "Sync Variant Types"
# Go straight to scrollUntilVisible — the form may close before Maestro can check
- scrollUntilVisible:
    element:
      text: "Sync Variant Types"
    timeout: 60000
```

**Exception 1 — SetForm (Sync Sets):** "Sync Sets" does NOT reappear once data is populated.
For SetForm only, use `extendedWaitUntil: notVisible: "Syncing Sets"` as the completion signal:
```yaml
- tapOn: "Sync Sets"
- extendedWaitUntil:
    notVisible: "Syncing Sets"
    timeout: 90000
```

**Exception 2 — SetVariantForm (Sync Variant Types):** On RE-SYNC attempts (data already populated),
`SetVariantForm` returns `success: false` when no NEW options come back from platforms. This means
`onDone()` is NOT called — the form stays open showing a "Close" button. `scrollUntilVisible: "Sync
Variant Types"` will timeout because the form never closes automatically.

**Correct pattern for Sync Variant Types:** Guard on `when: notVisible: "Base"` so the sync is only
triggered when the Variant Types list is actually empty. Skip entirely if Base/Insert/Parallel are
already visible:
```yaml
- runFlow:
    when:
      notVisible: "Base"
    commands:
      - scrollUntilVisible:
          element:
            text: "Sync Variant Types"
          timeout: 10000
      - tapOn: "Sync Variant Types"
      - extendedWaitUntil:
          notVisible: "Syncing Variant Types"
          timeout: 60000
      - runFlow:
          when:
            visible: "Close"
          commands:
            - tapOn: "Close"
            - extendedWaitUntil:
                visible: "Sync Variant Types"
                timeout: 10000
```

**Exception 3 — VariantForm (Sync Variants for Insert/Parallel):** On re-sync with only one platform
returning data, VariantForm stores directly and calls `onDone()` without opening ReconciliationModal.
The `extendedWaitUntil: visible: "Reconcile Variants"` will timeout. Guard the sync+modal block on
the EntitySelector empty state: `when: visible: "No variants available. Sync from marketplaces to
populate."` — only sync when the Variants column is empty.

**Why:** These forms call onDone() only on specific success branches. Re-runs with cached/partial
data take different code paths that don't auto-close the form or don't open expected modals.

**How to apply:** Every `tapOn: "Sync X"` (except SetForm) — skip any intermediate loading state
assertion and go straight to `scrollUntilVisible: "Sync X"` with a generous timeout. For Variant
Types and Variant levels, use the notVisible guard to skip the sync when data already exists.

Confirmed working in util-drill-to-2024-topps-chrome.yaml and all three canonical variant flows
(verified locally 2026-05-03 on set-creation-resume branch, commit dd26cb3).
