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
- `setup-bsc-credentials.yaml` — saves BSC credentials; uses env vars BSC_USERNAME, BSC_PASSWORD
- `setup-sportlots-credentials.yaml` — saves SL credentials; uses env vars SPORTLOTS_USERNAME, SPORTLOTS_PASSWORD

Both flows:
- Are tagged `util` (not smoke/regression — they are helpers, not standalone tests)
- Assume the browser is already on the `/profile` page
- Idempotently handle the case where credentials already exist (clears then re-saves)
- End with the credentials saved state confirmed

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
