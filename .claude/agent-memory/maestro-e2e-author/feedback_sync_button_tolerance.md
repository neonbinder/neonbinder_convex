---
name: Sync button tolerance — never hard-tap "Sync X" in set-selector flows
description: All set-selector sync steps must use runFlow when: visible to tolerate pre-populated state
type: feedback
---

Never write a bare `tapOn: "Sync Sports"` (or any Sync X button) in set-selector flows.
When flows run in the same CI suite, an earlier flow may have already synced that level,
replacing the "Sync X" button with the populated list. The bare tapOn then fails with
"Element not found".

**Why:** PR #24 run 25278469299 — `sync-set-end-to-end.yaml` failed because `base-set-picker.yaml`
ran first (alphabetically) and synced Sports. When sync-set-end-to-end navigated to /set-selector
and tried `tapOn: "Sync Sports"`, the button was gone.

CRITICAL: "Sync X" buttons do NOT reappear after the sync completes and data is populated.
`extendedWaitUntil visible: "Sync X"` as the sync-complete signal is WRONG. Use data-appearance
waits instead:
- Sports: `extendedWaitUntil visible: "Baseball"`
- Years: `extendedWaitUntil visible: text: ".*20[0-9][0-9].*"`
- Manufacturers: `extendedWaitUntil visible: "Bowman"` (Bowman is in every sport/year)
- Sets: `extendedWaitUntil notVisible: "Syncing Sets"` (search input may not appear for small manufacturers)
- Variant Types: `extendedWaitUntil visible: "Base"` (Base is in every set's variant types)
- Variants: `extendedWaitUntil visible: text: ".*Select Base Set|Search variants.*"`

**How to apply:** Always wrap sync steps in a conditional with data-appearance completion:
```yaml
- runFlow:
    when:
      visible: "Sync Sports"
    commands:
      - tapOn: "Sync Sports"
      - extendedWaitUntil:
          visible:
            text: ".*Syncing Sport Options|Sync Sports.*"
          timeout: 15000
      - extendedWaitUntil:
          visible: "Baseball"
          timeout: 45000
# Then unconditionally select the item (scrollUntilVisible + tapOn)
```

This pattern applies to ALL 6 hierarchy levels. Each level's sync button becomes absent
once that level is already populated for the current selection path.

Exception: `set-selector-smoke.yaml` and `custom-entry-survives-resync.yaml` intentionally
trigger sync as a core assertion — those hard taps are correct. But even there, use
data-appearance waits (wait for "Baseball", not "Sync Sports").

Exception: `sync-without-credentials.yaml` also intentionally requires the sync path.

Do NOT hardcode "Topps" as the manufacturer to tap — Topps may not be present in SL data
for all sport/year combinations. Use `tapOn: text: ".*" index: 0` to pick the first item,
or scroll+search for Topps only in flows that specifically require it (sync-set-end-to-end).

The "+ Custom" button in a populated list may be below the fold — always use
`scrollUntilVisible` before `tapOn: "+ Custom"`.
