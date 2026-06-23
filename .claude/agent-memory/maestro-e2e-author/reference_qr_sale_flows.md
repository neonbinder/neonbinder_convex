---
name: qr-sale-flows
description: Validated patterns for the /qr-code generator and /u/:username/sale running-total flows (NEO-53/54) — account-matching for getMyPublicProfile, off-fold QR content, reset-on-pay is not testable
metadata:
  type: reference
---

QR + Sale E2E (flows: `qr-code/generate-qr`, `qr-code/no-profile-empty-state`,
`sale/running-total`; producer `profile/fill-profile-data`). All validated GREEN
headless, first attempt, parallelism=1.

**Account matching is load-bearing.** `getMyPublicProfile` is keyed by the
SIGNED-IN Clerk user (`by_user` index). `fill-profile-data.yaml` saves the
profile on the `new-profile` account. So any flow that reads `getMyPublicProfile`
and expects that saved profile (e.g. `qr-code/generate-qr`) MUST sign in with
`account=new-profile` too — otherwise it reads a DIFFERENT (empty) user and the
page shows the empty state. The public `sale` page uses
`getPublicProfileByUsername` (global by-username lookup), so it just needs the
profile to exist for `${TEST_USERNAME}` — no account match needed (it's public,
no sign-in).

**requires/provides chain used (parallel-safe, no deadlock):**
- `no-profile-empty-state` → `provides:profile-empty-checked` (resets new-profile
  via /testing/reset and asserts the empty state FIRST).
- `fill-profile-data` → `requires:profile-empty-checked` + `provides:profile-filled`
  (so it can never fill the shared new-profile account between empty-state's reset
  and its assert).
- `generate-qr` + `running-total` → `requires:profile-filled` (read-only, run in
  parallel with each other safely).
Confirmed via `npm run test:e2e:plan` — levels 0→1→2, no cycle.

**QR generated content renders BELOW the 1024×629 fold.** After "Generate QR
Code", the big white QR box pushes the encoded-URL `<p>` text and Download/Print
buttons off the bottom. `assertVisible` on the URL fails until you
`scrollUntilVisible {text:"Download", centerElement:true}` first (Download sits
just below the URL `<p>`, so it surfaces the URL too). Integer amounts render
bare: amt=8 → URL `.../sale?amt=8` (not 8.00). `id:"amount"` correctly resolves
the bare HTML id (see [[maestro-id-matches-html-id]]).

**Reset-on-pay is NOT testable in maestro-web (de-scoped).** The only trigger for
`reset()` → $0.00 on the sale page is tapping a payment button, whose handler does
`window.open(href,"_blank")` to the EXTERNAL payment site (cash.app etc.).
maestro-web FOLLOWS into the new tab, so the original sale tab (where $0.00 would
render) is unreachable — the run lands on the external site (a cash.app 404 in our
run). Sale-page payment buttons also expose NO sr-only href (unlike the
public-profile page), so the total-in-href isn't assertable either. `running-total`
covers accumulation ($5→$8), persistence across reloads, and the three
button-render asserts (visible labels "PayPal (F&F)" / "Venmo" / "Cash App"); the
reset assertion was removed with a de-scope comment. A clean test would need a
product change (non-navigating reset affordance or sr-only total).
