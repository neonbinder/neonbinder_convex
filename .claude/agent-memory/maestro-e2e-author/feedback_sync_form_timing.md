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

**Exception — SetForm (Sync Sets):** "Sync Sets" does NOT reappear once data is populated.
For SetForm only, use `extendedWaitUntil: notVisible: "Syncing Sets"` as the completion signal:
```yaml
- tapOn: "Sync Sets"
- extendedWaitUntil:
    notVisible: "Syncing Sets"
    timeout: 90000
```

**Why:** The form fires on mount. With cached Convex data, the round-trip can be < 1s, faster than
Maestro's first check cycle. The "Sync X" button's return to the screen is the authoritative signal.

**How to apply:** Every `tapOn: "Sync X"` (except SetForm) — skip any intermediate loading state
assertion and go straight to `scrollUntilVisible: "Sync X"` with a generous timeout.

Confirmed working in util-drill-to-2024-topps-chrome.yaml and all three canonical variant flows.
