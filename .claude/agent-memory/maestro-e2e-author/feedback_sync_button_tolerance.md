---
name: Sync button tolerance — completion signals in set-selector flows
description: How to correctly wait for sync completion at each hierarchy level; "Sync X" buttons DO reappear after sync, just below the fold
type: feedback
---

Never write a bare `tapOn: "Sync X"` (or any Sync X button) in set-selector flows without a `when: visible:` guard.
When flows run in the same CI suite, an earlier flow may have already synced that level,
replacing the "Sync X" button with the populated list. The bare tapOn then fails with
"Element not found".

**CRITICAL CORRECTION (2026-05-02):** "Sync X" buttons DO reappear after the sync
completes and data is populated — they appear BELOW the populated list. The earlier
claim that "Sync X buttons do not reappear after data populates" was WRONG.

CI run 25281041627 screenshot confirmed: "Sync Sports" is visible at the bottom of the
Sports column beneath the full populated list. The previous "data-appearance" completion
signals (wait for Baseball, Bowman, Base, etc.) were incorrect — they fire as soon as the
FIRST platform (SportLots) returns data, before BSC has merged in.

**Correct completion pattern (Pattern A — use this everywhere):**

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
      # Button reappears BELOW the populated list once ALL platforms have responded.
      # Scroll to find it — this is the cross-platform completion signal.
      - scrollUntilVisible:
          element:
            text: "Sync Sports"
          timeout: 60000
# Then unconditionally select the item (scrollUntilVisible + tapOn)
```

Apply this pattern at ALL 6 hierarchy levels:
- Sports: `scrollUntilVisible: text: "Sync Sports"`
- Years: `scrollUntilVisible: text: "Sync Years"`
- Manufacturers: `scrollUntilVisible: text: "Sync Manufacturers"`
- Sets: `extendedWaitUntil notVisible: "Syncing Sets"` (Sets has no reliable "Sync Sets" reappear signal; notVisible of the loading indicator is correct here)
- Variant Types: `scrollUntilVisible: text: "Sync Variant Types"`
- Variants: `scrollUntilVisible: text: ".*Sync Variants|Select Base Set.*"` (Base variant type opens BaseSetPicker modal instead of returning the button)

**Why extendedWaitUntil with data items was wrong:**
- `extendedWaitUntil visible: "Baseball"` fires as soon as SportLots returns sport data
- BSC is still in flight; the list shows only [SL] badges
- The next assertion (`assertVisible: "BSC"`) then fails
- The correct signal is the button returning, which only happens after all platforms merge

**Exception flows that intentionally hard-tap the sync button:**
`set-selector-smoke.yaml` and `custom-entry-survives-resync.yaml` test sync as a core
assertion, so they use a direct `tapOn: "Sync Sports"` (with a preceding `scrollUntilVisible`
to handle pre-populated state). Even these MUST use the `scrollUntilVisible: "Sync Sports"`
completion signal — NOT the data-appearance signal.

**Do NOT hardcode "Topps" as the manufacturer to tap** — Topps may not be present in SL data
for all sport/year combinations. Use `tapOn: text: ".*" index: 0` to pick the first item,
or scroll+search for Topps only in flows that specifically require it (sync-set-end-to-end).

The "+ Custom" button in a populated list may be below the fold — always use
`scrollUntilVisible` before `tapOn: "+ Custom"`.
