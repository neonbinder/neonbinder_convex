---
name: Search input index pattern for EntitySelector
description: When typing in a search input and tapping the result, use index 1 to avoid tapping the input value text
type: feedback
---

After typing a search term (e.g., "Topps") into an EntitySelector search box, there are now two
elements on screen with the matching text: the value inside the search `<input>` (index 0) and the
result button below it (index 1).

Using `tapOn: "Topps"` without an index taps index 0 — the input value — which does nothing.

**Correct pattern:**
```yaml
- tapOn:
    text: ".*Search manufacturers.*"
- inputText: "Topps"
- extendedWaitUntil:
    visible:
      text: "Topps"
      index: 1
    timeout: 10000
- tapOn:
    text: "Topps"
    index: 1
```

**Why:** Maestro's `tapOn` resolves text matches in DOM order. The `<input>` element with the typed
value appears before the list button in the DOM, so it wins without the index.

**How to apply:** Any time the user types into a search input whose placeholder matches
`".*Search [entity].*"` (manufacturers, sets, variant types, etc.) — always use `index: 1` for
the result tap.
