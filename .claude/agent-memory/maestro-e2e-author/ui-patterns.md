---
name: Set selector UI text and layout patterns
description: Exact visible text, button labels, headings, and empty states for the /set-selector page and its components
type: reference
---

## Set Selector page heading
- Page title: "Set Selector" (appears twice — once in the page `<h1>` and once inside the SetSelector component)

## Column titles (EntitySelector title prop)
- Sports, Years, Manufacturers, Sets, Set Variants, Cards

## Sync button text per column (EntityColumn addButtonText prop)
- "Sync Sports", "Sync Years", "Sync Manufacturers", "Sync Sets", "Sync Variants"

## Custom entry button
- Label: "+ Custom" (requires regex escape in tapOn: `"\\+ Custom"`)
- assertVisible also needs the escape: `"\\+ Custom"`

## Sync form headings (the panel that opens when Sync button is tapped)
- "Sync Sport Options"
- "Sync Year Options"
- "Sync Manufacturer Options"
- "Sync Set Options"
- "Sync Set Variant Options"

## Sync form description text (examples)
- SportForm: "Fetch the latest sport options from all connected platforms."
- YearForm: "Fetch year options for [sport] from all connected platforms."
- Others follow the pattern: "Fetch [level] options for [context] from all connected platforms."

## Sync form buttons
- Primary: "Sync from Marketplaces" (while loading shows "Syncing...")
- Cancel: "Cancel"

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

## Cards column (CardChecklist)
- Column heading: "Cards" (with count in parentheses when items exist, e.g., "Cards (42)")
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

## Column visibility rules
- Sports column: always visible
- Years column: visible only after a sport is selected
- Manufacturers column: visible only after a year is selected
- Sets column: visible only after a manufacturer is selected
- Set Variants column: visible only after a set is selected
- Cards column: visible only after a variant is selected

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
