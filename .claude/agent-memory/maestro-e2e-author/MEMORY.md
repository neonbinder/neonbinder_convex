# Maestro E2E Author — Memory Index

- [UI text and layout patterns](ui-patterns.md): Exact button text, column headings, empty states, and modal text for set-selector and profile credential pages. Includes the CRITICAL sync form auto-fire pattern (no "Sync from Marketplaces" button), 6-level hierarchy (Variant Types at level 5, Variants at level 6), BaseSetPicker modal, ReconciliationModal, and VariantMetadataEditor.
- [Auth and navigation patterns](auth-patterns.md): How testing sign-in works, the `/testing/sign-in?redirect=` URL pattern, and credential setup reusable flows.
- [Search input index pattern](feedback_search_input_index_pattern.md): After typing in EntitySelector search box, use `index: 1` to tap the result button (not the input value at index 0).
- [Sync form timing](feedback_sync_form_timing.md): Auto-fire sync forms complete too fast to assert the loading heading — use combined regex `".*Syncing X|Sync X.*"` to catch both states.
