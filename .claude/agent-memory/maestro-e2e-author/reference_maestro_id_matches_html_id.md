---
name: maestro-id-matches-html-id
description: maestro-web `id:` matcher resolves a bare HTML `id` attribute when an element has no aria-label/resource-id — so `id:` works for plain `<input id="amount">`, not only aria-labels
metadata:
  type: reference
---

In maestro-web, the `id:` selector matches against the element's **resource-id**,
which is populated from the element's **aria-label** when present, and otherwise
falls through to the element's **bare HTML `id` attribute**.

Evidence (in-repo, CI-green): `profile/fill-profile-data.yaml` targets the
public-profile inputs via `tapOn: { id: "pub-paypal" }`, `id: "pub-venmo"`,
`id: "pub-cashapp"`, etc. Those inputs (in `components/modules/PublicProfileEditor.tsx`)
have **only** `id="pub-paypal"` (HTML id) and NO aria-label — yet the taps work
and the flow passes in CI. Same for `/qr-code`'s amount input
(`<input id="amount" …>`, no aria-label): `tapOn: { id: "amount" }` is the
correct selector (used in `qr-code/generate-qr.yaml`).

So the agent rule "never use HTML id" is too strong for maestro-web inputs: a
**bare `id:`** matcher IS the right tool when the element has a stable HTML id and
no visible-text/aria handle. Prefer visible text / aria-label first; fall back to
`id:"<html-id>"` for inputs that have no accessible name (number/text fields with
only a `<label htmlFor>` — the label is a sibling, not the input's accessible
name, so text matchers won't reach the input itself).

Caveat (still true): the `text:` matcher only sees rendered DOM text, and an
`<a href>` exposes its `href` as matchable text ONLY if the markup also renders it
(e.g. an `sr-only` span). The public-profile payment buttons DO
(`<span class="sr-only">{href}</span>` in `app/u/[username]/page.tsx`); the
`/u/:username/sale` payment buttons do NOT (just a favicon img + visible label in
`app/u/[username]/sale/page.tsx`), so on the sale page assert the visible label
("Venmo" / "PayPal (F&F)" / "Cash App"), not the href.
