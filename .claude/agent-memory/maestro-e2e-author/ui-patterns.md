---
name: Set selector UI text and layout patterns
description: Exact visible text, button labels, headings, and empty states for the /set-selector page and its components
type: reference
---

## Set Selector page heading
- Page title: "Set Selector" (appears twice — once in the page `<h1>` and once inside the SetSelector component)

## Hierarchy — 6 levels (plus optional level 7)
Level 1: Sports
Level 2: Years
Level 3: Manufacturers
Level 4: Sets
Level 5: Variant Types  (formerly "Set Variants" — renamed)
Level 6: Variants       (new — was combined with level 5 before)
Level 7: Sub-Variants   (optional, only shown after a Variant is selected)
Cards panel: full-width below the selector row (not a column), visible after selecting a Variant

## Column titles (EntitySelector title prop)
- Sports, Years, Manufacturers, Sets, Variant Types, Variants, Sub-Variants

## Sync button text per column (EntityColumn addButtonText prop)
- "Sync Sports", "Sync Years", "Sync Manufacturers", "Sync Sets",
  "Sync Variant Types", "Sync Variants", "Sync Sub-Variants"

## CRITICAL: Sync form auto-fire pattern (changed from old "Sync from Marketplaces" button)
All sync forms auto-fire immediately when opened — there is NO "Sync from Marketplaces" button.

Correct pattern:
```yaml
- tapOn: "Sync Sports"
- extendedWaitUntil:
    visible: "Syncing Sport Options"
    timeout: 5000
- extendedWaitUntil:
    visible: "Sync Sports"   # returns when form auto-closes on success
    timeout: 45000
```

On ERROR the form stays open and shows "Retry" + "Cancel" buttons (not "Close").
On SUCCESS the form auto-closes (calls onDone()) and the idle button returns.

## Sync form headings (shown during the auto-fire)
- SportForm: "Syncing Sport Options"
- YearForm: "Syncing Year Options"
- ManufacturerForm: "Syncing Manufacturer Options"
- SetForm: "Syncing Sets"
- SetVariantForm (level 5): "Syncing Variant Types"
- VariantForm (level 6): "Syncing Variants" (or "Select Base Set" if variantType is "Base")

## Sync form buttons after completion
- Success: "Close" button (tapping closes the form)
- Error: "Retry" + "Cancel" buttons

## VariantForm special cases (level 6 — "Sync Variants")
- For "Base" variant type: shows BaseSetPicker modal ("Select Base Set" heading)
- For Insert/Parallel with data on BOTH platforms: shows ReconciliationModal ("Reconcile Variants" heading)
- For single-platform data: auto-stores and closes (same as other levels)

## BaseSetPicker modal
- Heading: "Select Base Set" (same as VariantForm heading for Base type — not unique enough to assert modal is open)
- Subtext: "Choose the base set for **[setName]** on each platform. The rest will be discarded."
  Use regex `".*Choose the base set for.*"` to confirm the modal is open.
- Search input (only if >8 SL options): placeholder "Search SportLots sets..."
- "SPORTLOTS BASE" label (uppercase purple, via CSS): text in DOM is "SportLots base" — use `".*SportLots base.*"` or `"SportLots base"` (check visibility, CSS uppercases it)
- "BSC base" section: ONLY shown when BSC has variantName options. For Base variant type, BSC's variantName facet is often empty — the BSC section will NOT appear. Do not assert "BSC base".
- "likely match" badge (green text): shown on SL option with score >= 795; also shown on BSC options with score >= 795 in the BSC section (if visible)
- Auto-selected SL option: highlighted in green. "Chrome" is auto-selected for Topps Chrome.
- Confirm button: "Confirm Base Set"
- Cancel button: "Cancel"

## ReconciliationModal
- Heading: "Reconcile Variants" (level="insert") or "Reconcile Variants of Variants" (level="parallel")
- Subtext: "[N] matched, [N] BSC-only, [N] SL-only ([N] total)"
  e.g., "25 matched, 22 BSC-only, 2504 SL-only (2551 total)"
- Matched section (collapsible): "Matched (N) — click to review"
- Unmatched section header: "Unmatched — drag to link, or drag down to "keep as platform-only""
  Use regex `".*Unmatched.*drag to link.*"` for robustness
- BSC column label: "BSC (N)" — assert with `".*BSC.*"` (uppercase in DOM)
- SL column label: "SPORTLOTS (N OF M)" — assert with `".*SPORTLOTS.*"` (uppercase in DOM)
- SL filter input: placeholder = `Starts with "[setName]"` or `Starts with "[setName]" or "[stripped]"`
  For 2024 Topps Chrome: `Starts with "topps chrome" or "chrome"`
  Use regex `'.*Starts with ".*[Tt]opps [Cc]hrome.*".*'`
- SAVE/confirm button: "Save N matched" (NOT "Confirm N Items" — changed)
  Use regex `".*Save [0-9]+ matched.*"`
- Cancel button: "Cancel"

## VariantMetadataEditor (appears below Variants list after a Variant is selected)
- Section heading: "Metadata" (small caps, gray)
- Insert checkbox: label "Insert" (read-only/disabled)
- Parallel checkbox: label "Parallel" (read-only/disabled)
- Prefix field: label "Prefix:", input placeholder "e.g. DK-"
- Save button: "Save" — only visible when the Prefix field is dirty (has unsaved changes)
- After save: "Save" disappears, dirty flag clears

## Custom entry button
- Label: "+ Custom" (requires regex escape in tapOn: `"\\+ Custom"`)
- assertVisible also needs the escape: `"\\+ Custom"`

## Custom entry form
- Heading: "Add Custom Entry"
- Input placeholder: "Enter custom value..."
- Submit button: "Add"
- Cancel button: "Cancel"
- Error banner (on failure): shown in a red box, text varies

## Platform badges on items
- "SL" — SportLots
- "BSC" — BuySportsCards
- "Custom" — user-created entry (blue badge)

## Empty state text (EntitySelector, no items, no search)
- Pattern: "No [title.toLowerCase()] available. Sync from marketplaces to populate."
- Example: "No sports available. Sync from marketplaces to populate."

## Search field (appears when list has more than 8 items)
- Placeholder: "Search [title.toLowerCase()]..."
- Example: "Search sports..."

## No search results text
- "No matches found"

## Loading state
- "Loading [title.toLowerCase()]..." (while Convex query is fetching)

## Cards panel (CardChecklist) — full-width below selector row
- Panel heading: "Cards" (with count in parentheses when items exist, e.g., "Cards (42)")
- Empty state: "No cards in this checklist yet." + button "Fetch from Marketplaces"
- While fetching: button label changes to "Fetching..."
- Last synced text: "Last synced: [date]"
- Stale indicator (if >7 days old): "(stale)" in amber
- Sync message banner: shown in a blue box after fetch completes
- Refresh button (visible once cards exist): "Refresh"
- Add card button: "Add Card"

## Add Card form (CardChecklist)
- Card number field placeholder: "#"
- Player name field placeholder: "Player name"
- Team field placeholder: "Team (optional)"
- Submit button: "Add"
- Cancel button: "Cancel"

## Card row (CardChecklistItem)
- Card number shown as: "#[number]" (e.g., "#42")
- Actions revealed on hover: "Edit", "Del"
- Delete confirm prompt: "Confirm?" (replaces "Del" button)
- Edit form fields: "Card name" placeholder, "Team" placeholder
- Edit form buttons: "Save", "Cancel"

## EntitySelector column — internal scroll container (IMPORTANT)
Each column (Sports, Years, Manufacturers, etc.) has its OWN internal scroll container.
`scrollUntilVisible` at the page level CANNOT reach items inside the column's internal scroll.
To find items that may be off-screen within a column: USE THE SEARCH BOX.
- The search box placeholder is "Search [column name]..." (e.g., "Search sports...")
- Tap the placeholder text to focus, `inputText: "keyword"` to filter
- The item will appear even if it would normally require internal scrolling
- After searching: reload the page (`openLink: .../set-selector`) to reset the search state
  (You cannot reliably tap the search input by text when it has a value, because the
  placeholder text is not visible in Maestro's DOM when the field has content)

## Column visibility rules
- Sports column: always visible
- Years column: visible only after a sport is selected
- Manufacturers column: visible only after a year is selected
- Sets column: visible only after a manufacturer is selected
- Variant Types column: visible only after a set is selected
- Variants column: visible only after a variant type is selected
- Sub-Variants column: visible only after a variant is selected (optional)
- Cards panel: visible only after a variant (or sub-variant) is selected

## Collapsed selector pill
- When a value is selected and the column collapses, shows the selected value text and a chevron-down icon
- Tapping the pill re-expands the column

## Profile credential pages (relevant text)
- Platform selector: "Select Platform" (label), "BuySportsCards" (default), "Sportlots" (option)
- Platform selector id: "site-select"
- BSC username field: "BuySportsCards Username" (label), id="username"
- BSC password field: id="password"
- Sportlots username field: "Sportlots Username" (label), id="username"
- Save button: "Save Credentials"
- Saved state banner: ".*Credentials saved.*" (BSC), ".*Credentials saved for Sportlots.*" (SL)
- Clear button: "Clear Credentials"
- Clear confirm: "Yes, Clear"
- Cleared confirmation: ".*Credentials cleared.*"
- Test button: "Test Credentials"
- BSC test success: ".*BSC account authenticated successfully.*"
- SL test success: ".*Successfully logged into SportLots.*"
