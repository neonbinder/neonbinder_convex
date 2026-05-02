---
name: Sync form auto-fire timing — loading state can be missed
description: extendedWaitUntil for the loading state heading races against fast/cached syncs; use combined regex instead
type: feedback
---

All set-selector sync forms auto-fire on mount (YearForm, ManufacturerForm, SetForm, SetVariantForm,
VariantForm). If the data is already in the database or the network is fast, the loading state
heading (e.g., "Syncing Variant Types") can disappear before Maestro evaluates the assertion.

`extendedWaitUntil: visible: "Syncing Variant Types"` will FAIL if the form has already closed.

**Wrong pattern:**
```yaml
- tapOn: "Sync Variant Types"
- extendedWaitUntil:
    visible: "Syncing Variant Types"   # RACES — can miss it
    timeout: 15000
- extendedWaitUntil:
    visible: "Sync Variant Types"
    timeout: 60000
```

**Correct pattern — combined regex catches both states:**
```yaml
- tapOn: "Sync Variant Types"
- extendedWaitUntil:
    visible:
      text: ".*Syncing Variant Types|Sync Variant Types.*"
    timeout: 60000
```

Or if you want to assert a result exists (e.g., "Base" appearing in the list):
```yaml
- tapOn: "Sync Variant Types"
- extendedWaitUntil:
    visible:
      text: ".*Sync Variant Types|Base.*"
    timeout: 60000
```

**Why:** The form fires on mount. With cached Convex data, the round-trip can be < 1s, faster than
Maestro's first check cycle.

**How to apply:** Every `tapOn: "Sync X"` followed by an intermediate loading state assertion.
Replace the two-step pattern (assert loading, assert done) with a single combined regex that
matches EITHER the loading state OR the completion signal.

This pattern was verified working in `sync-set-end-to-end.yaml` for all six levels.
