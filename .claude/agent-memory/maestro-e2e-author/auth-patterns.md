---
name: Auth and navigation patterns for Maestro flows
description: How testing sign-in works, URL patterns, and reusable credential setup flows
type: reference
---

## Testing sign-in URL pattern
The app exposes a testing-only sign-in endpoint that bypasses Clerk bot protection:
  `${APP_URL || "http://localhost:3000"}/testing/sign-in?redirect=[destination]`

This URL is placed in the `url:` header of a flow file (not in a `launchApp` step).
After `launchApp` the browser opens this URL which signs the test user in and
redirects to `[destination]`.

## Flow header pattern for authenticated flows
```yaml
url: ${APP_URL || "http://localhost:3000"}/testing/sign-in?redirect=/some-page
name: Descriptive name
tags:
  - tag1
---
- launchApp
- extendedWaitUntil:
    visible: "Neon Binder"
    timeout: 45000
```

The `extendedWaitUntil: visible: "Neon Binder"` is the standard guard for
confirming the app has loaded and the user is authenticated.

## Reusable credential setup flows
Located in `neonbinder_web/.maestro/flows/profile/`:

**Idempotent helpers** (use for set-selector flows and any flow that just NEEDS creds to exist):
- `setup-bsc-credentials.yaml` — skips save if "Clear Credentials" already visible; uses BSC_USERNAME, BSC_PASSWORD
- `setup-sportlots-credentials.yaml` — skips save if "Clear Credentials" already visible; uses SPORTLOTS_USERNAME, SPORTLOTS_PASSWORD

**Destructive helpers** (use for cred-test flows that must test the full save+auth cycle):
- `clear-then-setup-bsc-credentials.yaml` — always clears then re-saves; same env vars
- `clear-then-setup-sportlots-credentials.yaml` — always clears then re-saves; same env vars

All four flows:
- Are tagged `util` (not smoke/regression — they are helpers, not standalone tests)
- Assume the browser is already on the `/profile` page
- End with the credentials saved state confirmed

CRITICAL: Calling setup-* repeatedly with the destructive variant hits BSC/SportLots login
endpoints on every call. With 10 set-selector flows × 2 platforms = 20 fresh logins per run,
this triggers rate-limiting. Always use the idempotent variant for set-selector flows.

## Pattern for flows that need credentials before navigating to a feature page
```yaml
url: ${APP_URL || "http://localhost:3000"}/testing/sign-in?redirect=/profile
...
- launchApp
- extendedWaitUntil:
    visible: "Neon Binder"
    timeout: 45000

- runFlow:
    file: ../profile/setup-bsc-credentials.yaml
    env:
      BSC_USERNAME: ${BSC_USERNAME}
      BSC_PASSWORD: ${BSC_PASSWORD}

# CRITICAL: reload /profile between BSC and Sportlots setup.
# After BSC setup completes, the page is scrolled down to the BSC credentials
# section — "Select Platform" is now ABOVE the viewport.
# setup-sportlots-credentials.yaml starts with scrollUntilVisible "Select Platform",
# which only scrolls DOWN and will never find it. Reloading resets scroll to top.
- openLink: ${APP_URL || "http://localhost:3000"}/profile
- extendedWaitUntil:
    visible: ".*Select Platform.*"
    timeout: 15000

- runFlow:
    file: ../profile/setup-sportlots-credentials.yaml
    env:
      SPORTLOTS_USERNAME: ${SPORTLOTS_USERNAME}
      SPORTLOTS_PASSWORD: ${SPORTLOTS_PASSWORD}

# Navigate to the actual feature page after credentials are set
- openLink: ${APP_URL || "http://localhost:3000"}/set-selector
- extendedWaitUntil:
    visible: "Set Selector"
    timeout: 15000
```

Key: the `url:` header must point to `/profile` (not the feature page) so the
browser lands on profile where the credential setup flows can do their work.
Then `openLink` takes the user to the feature page.

## Environment variables for credentials
- `BSC_USERNAME`, `BSC_PASSWORD` — BuySportsCards credentials
- `SPORTLOTS_USERNAME`, `SPORTLOTS_PASSWORD` — SportLots credentials
- `TEST_EMAIL`, `TEST_PASSWORD` — Clerk test user (used by the testing sign-in endpoint)
- `APP_URL` — base URL, defaults to `http://localhost:3000`

## Tags convention
- `smoke` — runs on every PR; fast; happy path only
- `regression` — runs nightly / post-preview; full coverage including edge cases
- `set-selector` — feature group for set hierarchy tests
- `auth` — authentication tests
- `profile` — profile page tests
- `credentials` — credential save/clear/test flows
- `util` — reusable helper flows, not standalone test runs
