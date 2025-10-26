# Introduction

NeonBinder is a unified platform built to serve collectors — whether they’re managing a personal collection or selling across multiple marketplaces. The system combines computer vision, structured hobby data, and marketplace APIs to automate the process of identifying, cataloging, and managing trading cards.

While NeonBinder will eventually power end-to-end sales across platforms like eBay, SportLots, BuySportsCards, MySlabs, and MyCardPost, its first release focuses on the collector — providing a rich, personal space to track and celebrate their collection. Collectors can organize their inventory, build lists from official checklists, or create personalized “Go Get It” collections that express what makes their collection unique.

Agents writing code for NeonBinder should design systems that treat collection management and marketplace selling as one continuous experience. The same underlying data, models, and UX principles should support both — ensuring that a collector who starts by tracking their collection can easily transition into selling, and vice versa.

NeonBinder’s agents are expected to produce high-quality, maintainable TypeScript and JavaScript (Node.js + React/React Native), emphasizing:
	•	Data integrity across personal and marketplace use cases
	•	Performance for managing large, image-rich collections
	•	Consistency in shared UI/UX patterns across collection and selling workflows
	•	Extensibility, supporting future expansion into other collectible categories like Pokémon, comics, and memorabilia

⸻

# Core Principles for Agents

NeonBinder’s success depends on consistent, high-quality contributions from intelligent agents. Every agent working in this repository — whether focused on frontend UI, backend logic, or automation — should follow these principles to ensure the system evolves as a cohesive product.

1. One Unified Platform

All code must reinforce the idea that collection management and selling are part of the same ecosystem.
Whether a user is tracking cards, completing a checklist, or syncing listings to marketplaces, they should feel like they’re using one continuous application.
Agents should reuse models, data flows, and design tokens whenever possible.

2. Data Integrity First

Card data is the heart of NeonBinder. Every component that touches a card — from image recognition to marketplace syncing — must maintain consistent identifiers and relationships.

Agents should:
	•	Use shared schemas and types for all entities (cards, collections, listings, marketplaces).
	•	Avoid duplicating data or logic.
	•	Prioritize synchronization accuracy between the local state, Convex backend, and external APIs.

3. Extensible by Design

Agents should design every system as if more collectible types (Pokémon, comics, memorabilia) will join tomorrow.
Favor modular structures and dependency injection over hard-coded logic.
When adding a new feature, always ask: “Could this be reused for another category later?”

4. Human-Readable Code

NeonBinder is an open-source project — your code will be read, extended, and modified by others (human and AI alike).

Agents should:
	•	Write clean, typed code in TypeScript whenever possible.
	•	Prefer clear naming over brevity.
	•	Keep functions small and self-documenting.
	•	Include concise docstrings or comments where intent may not be obvious.

5. Performance and Responsiveness

The platform will process large batches of images and manage thousands of cards.

Agents should:
	•	Optimize for minimal client-side latency and efficient backend queries.
	•	Use background jobs for slow tasks like image processing or marketplace updates.
	•	Profile and test performance-critical code paths regularly.

6. Progressive Enhancement

Agents should prioritize graceful degradation — ensure core experiences (viewing, adding, searching collections) work even if optional systems like marketplaces or AI recognition are unavailable.

7. Personality and Delight

NeonBinder is a hobby-first product with a nostalgic, 90s-inspired aesthetic.
Agents should infuse UI and copy with warmth and personality while maintaining a modern technical foundation.
Code should support theming, animation, and other enhancements that make the app feel alive and personal.

# AGENTS.md

# System Overview

NeonBinder is a **modular, multi-repository platform** built for scalability, automation, and cross-platform consistency.  
Agents working in this ecosystem should understand how each repository fits into the larger system and how data, automation, and UI layers interact.

---

## 🧠 1. Core Architecture

NeonBinder is composed of several coordinated repositories, each with a clearly defined role:

| Repository | Purpose | Key Technologies |
|-------------|----------|------------------|
| **`neonbinder_web`** | The core application — includes the main **Next.js website** (collector + seller UI) and the **Convex backend** for data persistence and real-time sync. | Next.js, React, Convex, TypeScript |
| **`neonbinder_browser`** | A GCP-deployed **Puppeteer automation service** responsible for browser manipulation, scraping, and headless interactions with external marketplaces. Stores sensitive credentials in **Google Secret Manager**. | Node.js, Puppeteer, Google Cloud Functions, GCP Secrets Manager |
| **`neonbinder_app`** | The **React Native mobile client** (Expo-based) that mirrors and extends the core web experience for collectors on the go. Designed for feature parity with `neonbinder_web`. | React Native, Expo, NativeWind, GlueStack UI |
| **`neonbinder_terraform`** | Infrastructure-as-code repository defining all cloud provisioning for the NeonBinder stack. | Terraform, Google Cloud Platform (GCP), CI/CD scripts |

These repositories together form the complete NeonBinder platform.  
Agents should always ensure cross-repo consistency — particularly in shared models, design tokens, and environment configuration.

---

## 🧩 2. Functional Layers

| Layer | Description | Responsibilities |
|-------|--------------|------------------|
| **Frontend (Web + Mobile)** | Collector and seller interfaces for managing collections, listings, and checklists. | Data display, search, and user interaction. |
| **Backend / API Layer** | Real-time data sync and persistence through Convex. | Collections, card data, and marketplace sync logic. |
| **Browser Automation** | Headless browser service for marketplaces that lack APIs. | Puppeteer scripts, credential handling, and automation triggers. |
| **Infrastructure** | Terraform provisioning and CI/CD workflows. | Environment setup, secret management, and GCP deployment. |
| **AI & Image Processing** | Optional offloaded services for image recognition and classification. | Card detection, background cropping, and dataset matching. |

---

## 🔄 3. Data Flow

NeonBinder’s unified data model ensures that collectors and sellers operate on the same foundation.  

```
Image → Recognition → Structured Card → Collection → (Optional) Listing
```

- **Images** uploaded from the web or app are processed and matched to known sets.  
- **Card data** (player, set, variation, etc.) is stored in Convex.  
- **Collections** represent ownership and checklist progress.  
- **Listings** extend collections with pricing and marketplace metadata.  
- **Automation agents** handle periodic updates, pricing sync, and reconciliation across systems.

---

## ⚙️ 4. Agents and Automation

Agents (both autonomous and scheduled) coordinate background operations across repositories.

Examples:
- `neonbinder_browser` runs **headless marketplace syncs**.  
- `neonbinder_web` triggers **Convex background jobs** for pricing, listing updates, and AI enrichment.  
- `neonbinder_app` may include **client-side assistant logic** for scanning, tagging, or user prompts.  

All agents should log their activity clearly and use **shared identifiers** (user ID, card ID, listing ID) to ensure consistency and traceability.

---

## 🧱 5. Modular Boundaries

Each repository maintains its own internal modules, following a consistent domain-driven structure:

```
/src
  /cards
  /collections
  /marketplaces
  /images
  /users
  /agents
```

Common logic (schemas, types, and design tokens) should be shared through a centralized **package or workspace module** (e.g., `@neonbinder/shared`) to reduce duplication.

---

## 🌐 6. Platform Cohesion

All NeonBinder clients — web, mobile, or automation — must feel like **one continuous experience**.  

Agents should:
- Reuse the same **schemas**, **component tokens**, and **theme configuration**.  
- Keep UX terminology consistent between “Collect” and “Sell.”  
- Ensure all user actions flow seamlessly across devices and environments.  

**Guiding Principle:** *Build once, adapt everywhere.*

# Directory & File Conventions

Consistent structure and naming are critical for maintainability and for allowing agents to work effectively across the NeonBinder ecosystem.  
All repositories should follow a **modular, domain-driven structure**, with predictable naming, clear boundaries, and composable utilities.

---

## 🧩 1. General Directory Structure

Each repository should organize source files by **domain**, not by technical type.  

```
/src
  /cards
    /components
    /services
    /types
  /collections
  /marketplaces
  /users
  /images
  /agents
  /lib
  /hooks
  /utils
  /theme
```

- **Domain folders** (e.g., `/cards`, `/collections`, `/marketplaces`) contain everything related to that feature.  
- **Shared utilities** belong under `/lib` or `/utils`.  
- **UI-level hooks** go in `/hooks`.  
- **Global theming** (colors, typography, spacing, etc.) belongs in `/theme`.  

This structure should mirror between `neonbinder_web` and `neonbinder_app` wherever possible to maintain parity across platforms.

---

## 📦 2. File Naming Conventions

Use **kebab-case** for file names and **PascalCase** for component exports.

| Type | File Name | Example |
|------|------------|----------|
| React Component | `CardDetail.tsx` | ✅ Good |
| Hook | `use-card-lookup.ts` | ✅ Good |
| Utility | `image-utils.ts` | ✅ Good |
| Schema or Type | `card.types.ts` | ✅ Good |
| Service or API | `marketplace-service.ts` | ✅ Good |

**Do not use** uppercase directories or underscores in file names.  

Example structure:
```
/cards
  CardDetail.tsx
  use-card-lookup.ts
  card.types.ts
  card-service.ts
```

---

## 🧱 3. Shared Code and Packages

Any shared logic between repositories (schemas, types, constants, design tokens, etc.) should be extracted into a common workspace package, typically named:

```
@neonbinder/shared
```

Within that package:
```
/shared
  /types
  /schemas
  /constants
  /theme
```

- **Types** define shared interfaces (Card, Collection, MarketplaceListing, etc.)  
- **Schemas** define validation (e.g., Zod for Convex).  
- **Constants** define static values (e.g., supported marketplaces, condition codes).  
- **Theme** defines global tokens for colors, spacing, and typography.  

This ensures consistency and allows both the web and mobile apps to evolve together.

---

## ⚙️ 4. Environment Configuration

Each repository should store environment variables in a `.env` file (never checked into git).  
Sensitive data belongs in **GCP Secret Manager**, not in local `.env` files.

| Repository | Environment Location | Notes |
|-------------|----------------------|-------|
| `neonbinder_web` | `.env.local` | Convex, API keys, public URLs |
| `neonbinder_browser` | GCP Secret Manager | Marketplace credentials and cookies |
| `neonbinder_app` | `.env` or app config | Mobile API URLs and analytics keys |
| `neonbinder_terraform` | Terraform variables | Used to provision GCP secrets and resources |

Agents should use typed environment validation (e.g., `zod` schemas) for safety.

---

## 🧠 5. Code Style and Patterns

NeonBinder code should follow these consistent style rules across all repositories:

- **Language:** TypeScript (strict mode enabled).  
- **Imports:** Use absolute imports with path aliases (`@/components`, `@/lib`, etc.).  
- **Formatting:** Enforced with **Prettier** and **ESLint**.  
- **React Components:** Prefer functional components and hooks over class components.  
- **State Management:** Use React Query or Convex hooks for server state; keep local state minimal.  
- **Async Workflows:** Always use `async/await` with proper error handling and logging.  
- **Tests:** Co-locate test files using the `.test.ts` or `.test.tsx` suffix.

Example:
```
/cards
  CardDetail.tsx
  CardDetail.test.tsx
```

---

## 🧩 6. Cross-Platform Component Patterns

To maintain UI consistency between the web and app:
- Use shared design tokens for color, spacing, and typography.  
- Keep components platform-agnostic where possible (e.g., `CardImage` should work on both).  
- When necessary, use platform-specific files:  
  - `Component.web.tsx`  
  - `Component.native.tsx`  

---

## 🧾 7. Documentation and Comments

Agents should document **why** something exists, not just **what** it does.  
Prefer short docstrings above functions or exported modules.  

Example:
```ts
// Matches an uploaded image to a known card using ML recognition
export async function matchCardFromImage(image: Buffer): Promise<CardMatchResult> { ... }
```

When introducing new domains, include a brief README.md within that directory describing its purpose.

---

## 🤖 8. AI Agent File Behavior

AI agents contributing to NeonBinder should adhere to the following principles when creating or modifying files:

1. **Follow Established Patterns**  
   Before writing new code, search the repo for similar patterns or structures.  
   New files should mirror naming, layout, and dependency patterns from existing modules.

2. **Prefer Extending Over Replacing**  
   When adding new logic, extend or wrap existing modules rather than rewriting them.  
   This preserves human-written intent and minimizes merge conflicts.

3. **Refactor Intelligently**  
   Only refactor when:  
   - The change clearly improves readability or reduces duplication.  
   - The refactor does not alter external behavior or break existing APIs.  
   - You can verify correctness through type safety or existing tests.

4. **Keep Atomic Commits**  
   Each commit should represent a clear, single-purpose change.  
   For multi-file updates (e.g., adding a new feature), group logically related files only.

5. **Avoid Code Drift Between Agents**  
   Always read from the latest branch before committing changes.  
   If two agents modify the same area, prefer additive changes (e.g., new file or export) over overwriting existing code.

6. **Respect Human Intent**  
   Preserve existing comments, TODOs, and code style decisions unless explicitly outdated.  
   When in doubt, leave an inline note rather than deleting unexplained logic.

7. **Generate With Context Awareness**  
   AI agents should always consider where the file lives and which repository it’s part of:
   - In `neonbinder_web`: focus on full-stack Next.js and Convex logic.  
   - In `neonbinder_app`: follow Expo/React Native conventions and mobile UI standards.  
   - In `neonbinder_browser`: focus on Puppeteer automation and GCP deployment.  
   - In `neonbinder_terraform`: use Terraform syntax and follow infrastructure naming conventions.  

8. **Annotate AI-Generated Code**  
   When generating new modules, include a brief comment header like:

   ```ts
   // Generated by NeonBinder AI Agent
   // Purpose: [one-sentence description]
   ```

   This ensures transparency and makes it easier for human maintainers to review and evolve the code.

# Error Handling & Logging Standards

NeonBinder uses **Sentry** as the unified observability platform for error tracking, performance monitoring, and structured logging across all layers.  
This approach provides complete visibility — from backend automation and web APIs to mobile runtime and native crashes — while keeping costs efficient.

| Layer | Primary Tool | Purpose |
|--------|---------------|----------|
| Web (Next.js + Convex) | **Sentry** | Application and API error tracking, performance tracing, structured logging |
| Backend (Node/Puppeteer) | **Sentry** | Job and automation error tracking, structured logging |
| Mobile (Expo / React Native) | **Sentry** | JS/runtime errors, API failures, UI exceptions, structured logging |
| Mobile Native Layer | **Firebase Crashlytics** | Native iOS/Android crash reporting |

---

## 🧠 Goals
- **Unified visibility:** Sentry handles all error tracking, performance monitoring, and structured logging across web, backend, and mobile JS layers.  
- **Complete observability:** All errors, warnings, and info-level events flow through Sentry with consistent metadata.  
- **Privacy-first:** No raw PII in logs or error contexts.  
- **Correlated diagnostics:** Each error/log includes consistent metadata (`requestId`, `userId`, `repo`, `service`, etc.).

---

## 🧩 Common Conventions (All Repos)

**Correlation**
- Generate a `requestId` (UUID) per request or job; pass it through all layers.  
- Include the following keys on all Sentry events:
  - `requestId`, `userId`, `repo`, `service`, `env`, `version`, and any contextual identifiers (`marketplace`, `cardId`, `job`).

**Logging with Sentry**
Use Sentry's structured logging for all events, errors, and informational messages.

**Never log raw PII.**  
Redact or hash user identifiers, card images, tokens, and cookies.

---

## ⚠️ Sentry (Primary Error Tracking)

### `neonbinder_web` (Next.js + Convex)
```bash
pnpm add @sentry/nextjs
pnpm dlx @sentry/wizard -i nextjs
```

```ts
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  tracesSampleRate: 0.1
});
```

**API wrapper example with structured logging**
```ts
import { withSentry } from '@sentry/nextjs';
import * as Sentry from '@sentry/nextjs';

export default withSentry(async function handler(req, res) {
  const requestId = req.headers['x-request-id'] ?? crypto.randomUUID();
  Sentry.setTag('requestId', requestId);
  Sentry.setTag('repo', 'neonbinder_web');
  Sentry.setTag('service', 'next-api');
  
  try {
    // Log info events
    Sentry.addBreadcrumb({
      message: 'collection.add.started',
      level: 'info',
      data: { userId: req.userId }
    });
    
    // business logic
    
    Sentry.addBreadcrumb({
      message: 'collection.add.completed',
      level: 'info',
      data: { added: 3, skipped: 1, durationMs: 183 }
    });
    
    res.status(200).json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ ok: false });
  }
});
```

### `neonbinder_app` (Expo / React Native)
```bash
npx expo install @sentry/react-native
```

```ts
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_ENV,
  release: process.env.EXPO_PUBLIC_APP_VERSION,
});

export function withSentryContext(requestId: string, userId?: string) {
  Sentry.setTag('requestId', requestId);
  if (userId) Sentry.setUser({ id: userId });
}
```

- Use Sentry for all **JS-level exceptions**, including Convex API calls, rendering errors, and unhandled rejections.  
- Upload source maps to Sentry automatically via EAS builds.

### `neonbinder_browser` (Node / Puppeteer)
```bash
pnpm add @sentry/node
```

```ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  tracesSampleRate: 0.0 // disable for long-running jobs
});

// Example: structured logging for marketplace automation
export async function syncMarketplace(marketplace: string, job: string) {
  const requestId = crypto.randomUUID();
  Sentry.setTag('requestId', requestId);
  Sentry.setTag('marketplace', marketplace);
  Sentry.setTag('job', job);
  
  try {
    Sentry.addBreadcrumb({
      message: 'marketplace.sync.started',
      level: 'info',
      data: { marketplace, job }
    });
    
    // automation logic
    
    Sentry.addBreadcrumb({
      message: 'marketplace.sync.completed',
      level: 'info',
      data: { processed: 10, errors: 0 }
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
```

Each Puppeteer job should use Sentry breadcrumbs to log its `jobName`, `requestId`, and marketplace for complete observability.

---

## 📱 Firebase Crashlytics (Native Mobile Layer)

Crashlytics supplements Sentry by capturing **native iOS and Android crashes** that occur outside the React Native JS runtime.

**Setup**
```bash
npx expo install firebase
```

**Initialize**
```ts
import crashlytics from '@react-native-firebase/crashlytics';

// Log handled errors
try {
  await uploadCardImage();
} catch (e) {
  crashlytics().recordError(e);
}
```

**When to use Crashlytics**
- Memory corruption, native bridge, or low-level device issues.  
- iOS/Android-only exceptions that Sentry (JS) doesn’t catch.  
- Always disable Crashlytics logging in dev builds.

Crashlytics data stays in Firebase Console; you can optionally export to BigQuery if deeper analysis is needed.

---

## 📜 Structured Logging with Sentry

Sentry provides comprehensive logging capabilities through breadcrumbs and events. Use Sentry for all structured logging needs.

**Basic Logging Pattern**
```ts
// Add breadcrumbs for info-level events
Sentry.addBreadcrumb({
  message: 'operation.completed',
  level: 'info',
  data: { key: 'value' }
});

// Log errors
Sentry.captureException(error);

// Set context for operations
Sentry.setContext('operation', {
  marketplace: 'ebay',
  cardCount: 10,
  durationMs: 1500
});
```

**Helper Function for Convenience**
```ts
export function logInfo(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    level: 'info',
    data
  });
}

export function logError(error: Error, context?: Record<string, any>) {
  if (context) {
    Sentry.setContext('error_context', context);
  }
  Sentry.captureException(error);
}
```

**Usage**
```ts
logInfo('marketplace.sync.started', { marketplace: 'ebay', job: 'priceUpdate' });
logInfo('marketplace.sync.completed', { processed: 10, errors: 0 });

try {
  // operation
} catch (error) {
  logError(error, { marketplace: 'ebay', operation: 'sync' });
  throw error;
}
```

---

## 🚨 Alerts & Dashboards

**Sentry**
- Alerts for *new issues*, *regressions*, *error rate spikes*.  
- Tag-based routing (`repo`, `service`, `marketplace`).  
- Create custom dashboards for error rates, warnings, and job latency.  
- Error budget: alert when `error/total > 2%` over 15 minutes.  
- Integrate with Slack `#neonbinder-alerts`.

**Crashlytics**
- Use Firebase Console for native crash stats; integrate Slack or email alerts if desired.

---

## 🧱 Terraform & Secrets

- Store Sentry DSNs in **GCP Secret Manager**.  
- Provision Sentry credentials via `neonbinder_terraform`.  
- CI/CD injects environment variables into Cloud Run, GCP Functions, and Expo builds.

---

## ⚙️ Sampling & Noise Control
- **Sentry:** Start with `tracesSampleRate: 0.1` on web, `0.0` on long jobs.  
- **Breadcrumbs:** Add breadcrumbs for critical info events; Sentry will automatically sample if volume is high.  
- **Crashlytics:** Disabled in local/dev builds to avoid noise.

---

## 🔒 Security & Redaction
- Strip or hash PII (emails, auth tokens, cookies).  
- Log metadata only — not card images or raw marketplace payloads.  
- For debugging, use redacted hashes (`user_hash`, `card_hash`) for correlation.

---

## ✅ Quick Setup Checklist

- [ ] Add Sentry DSN and environment variables via secrets.  
- [ ] Initialize Sentry in web, app, and browser repos.  
- [ ] Add Crashlytics to mobile native builds.  
- [ ] Replace `console.log` with Sentry breadcrumbs for logging.  
- [ ] Set up Sentry alerts routed to Slack.  
- [ ] Create Sentry dashboards for error rates and job latency.  
- [ ] Verify correlation IDs appear in Sentry events and breadcrumbs.

# Testing & Validation Standards

Testing in NeonBinder ensures that collectors and sellers have a reliable, high-performance experience — whether on web, mobile, or through automation services.  
All code written by agents should be **verifiable**, **repeatable**, and **safe to deploy** through automated validation pipelines.

---

# 🧪 1. Testing Philosophy

NeonBinder’s approach to testing is pragmatic:  
- **Test what matters most** — core business logic, data transformations, and integrations.  
- **Automate what can break silently** — schema validation, marketplace syncs, and image recognition.  
- **Mock what’s external** — do not rely on live API calls for CI tests.  
- **Keep tests fast** — short, parallelized test suites are preferred over large end-to-end monoliths.  

---

## 🧱 2. Test Types

Each repository has its own testing focus area:

| Repository | Test Focus | Notes |
|-------------|-------------|-------|
| **`neonbinder_web`** | Unit, Integration, and Convex Schema tests | Includes API routes, React components, and data flows |
| **`neonbinder_app`** | Component & Hook tests, Navigation flow, E2E UI testing | Uses Jest and Expo testing libraries |
| **`neonbinder_browser`** | Puppeteer job verification and marketplace automation mocks | Never execute live listings during test runs |
| **`neonbinder_terraform`** | Terraform plan validation and environment simulation | Validate resource syntax using `terraform validate` or CI-based drift checks |

---

## 🧩 3. Tooling

NeonBinder standardizes on these testing tools:

| Purpose | Tool | Notes |
|----------|------|-------|
| **Unit Testing** | Jest | Default framework across all TypeScript repos |
| **React Testing** | React Testing Library | For component rendering, hooks, and state verification |
| **E2E (Web)** | Playwright | Used for browser-based UI and Convex API flow testing |
| **E2E (Mobile)** | Detox (optional) | For simulated device UI testing via Expo |
| **Type Safety** | TypeScript + Zod | Runtime schema validation and build-time type enforcement |
| **Infrastructure Validation** | Terraform Validate, tflint | Ensures Terraform consistency pre-deploy |

---

## ⚙️ 4. CI/CD Validation

All tests should run automatically via CI pipelines.  
Each repository should include a `test` job or step that enforces validation gates before deployment.

Minimum CI requirements:
- ✅ Run all test suites (`pnpm test` or `npm run test`).  
- ✅ Run `eslint` and `prettier --check` for code quality.  
- ✅ Run `tsc --noEmit` to ensure TypeScript correctness.  
- ✅ For Convex: run `npx convex codegen` and `npx convex check`.  
- ✅ For Terraform: run `terraform validate` and `terraform fmt -check`.  

CI should fail fast and block merges on test or lint errors.

---

## 🔄 5. Mocking & Stubs

Agents should never rely on live APIs, credentials, or secrets during automated tests.

Mocking strategy:
- Use `msw` (Mock Service Worker) or lightweight stubs for external HTTP calls.  
- Use `jest.mock()` for local dependencies.  
- Use **fixtures** for card data, listings, and marketplace responses under `/tests/fixtures`.  

Example:
```ts
import { mockCard } from '@/tests/fixtures/card-fixture';

test('maps uploaded image to card record', async () => {
  const result = await matchCardFromImage(mockCard.image);
  expect(result.set).toBe('Topps 2022');
});
```

---

## 🧩 6. Test File Placement

Tests should live **alongside the code** they validate.

```
/cards
  card-service.ts
  card-service.test.ts
```

- Unit and integration tests live beside implementation files.  
- Cross-domain integration tests (e.g., collection + marketplace syncs) go in `/tests/integration`.  
- Global mocks and test setup scripts go in `/tests/setup.ts`.

---

## 🧠 7. AI Agent Testing Behavior

When generating code, AI agents must ensure **tests exist and pass** before considering a task complete.

AI agents should:
1. Automatically create a corresponding `.test.ts` or `.test.tsx` file when adding a new module.  
2. Use descriptive test names and mirror real-world workflows (e.g., *"adds card to Go Get It collection"*).  
3. Mock all external services or APIs by default.  
4. Run type checking and lint validation before completing their task.  
5. When refactoring, update tests in the same commit to maintain parity.  
6. If adding new dependencies for testing, ensure they’re minimal and align with existing project standards (prefer Jest + React Testing Library).

---

## 🧾 8. Testing Data & Fixtures

All mock data used in tests should be:
- Stored under `/tests/fixtures` in JSON or TypeScript.  
- Stripped of any real user or credential data.  
- Representative of realistic card and collection structures.  

Naming examples:
```
card-fixture.ts
marketplace-listing-fixture.ts
user-collection-fixture.ts
```

---

## 🧰 9. Test Coverage & Quality Goals

Each repository should strive for the following minimums:
- **Unit Test Coverage:** 80%+  
- **Integration Test Coverage:** 70%+  
- **Critical Path E2E:** 100% of collector → collection → listing flow covered  

Agents should favor **test clarity** over exhaustive coverage — a clear test that verifies a meaningful behavior is better than boilerplate that passes trivially.

# UI Development (Builder.io Fusion)

NeonBinder’s UI is built for **composability** and **reusability** inside Builder.io’s Fusion environment. We separate basic building blocks (**Primitives**) from higher-level, reusable compositions (**Modules**) to keep the design system clean and scalable across pages/screens.

## 📁 Directory Structure

```
/src/components
  /primitives     // headless or lightly-styled building blocks
    Button.tsx
    Text.tsx
    Heading.tsx
    Badge.tsx
    Input.tsx
    Select.tsx
    Switch.tsx
    Icon.tsx
    Card.tsx
    Image.tsx
  /modules        // composed from primitives; reusable across pages
    CardTile.tsx
    CollectionGrid.tsx
    ChecklistProgress.tsx
    MarketplaceStatus.tsx
    HeroSection.tsx
    EmptyState.tsx
```

- **Primitives**:  
  - Small surface area, stable props, **no app-specific business logic**.  
  - Prefer **headless** or **lightly styled** with theme tokens.  
  - Accept `className`, `style`, and accessible props (`aria-*`, `role`, `as` where appropriate).

- **Modules**:  
  - Compose multiple primitives; **no external data fetching** (data passed via props).  
  - Reused across pages/screens (e.g., card lists, progress widgets).  
  - Provide **sensible defaults** and **variant props** to minimize page-level customization.

---

## 🧩 Component Authoring Rules (Fusion-friendly)

- **Default export a React component** from each file.  
- Expose **stable, typed props** (TypeScript).  
- Keep **visual variants** as string unions: `variant="primary" | "secondary" | "ghost" | "cancel"`.  
- Always support `className` passthrough for Builder to apply layout overrides.  
- **No business logic** (API calls, Convex mutations) inside primitives/modules.  
- Avoid hard-coded spacing/colors; prefer **theme tokens** (see below).  
- Ensure **tab order** and **focus states** are visible; include `aria-label` where text is not explicit.

---

## 🎨 Theming (Fonts, Colors, Tokens)

### Fonts
- **Primary:** `Lexend` for headings and UI text.  
- **Fallbacks:** `system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`.

```css
:root {
  --font-sans: "Lexend", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
}
html, body { font-family: var(--font-sans); }
```

### Colors
| Token | Purpose | Example |
|--------|----------|----------|
| `--color-primary` | Primary Neon Green | `#00D558` |
| `--color-cancel` | Destructive/Cancel Neon Pink | `#FF2EB3` |
| `--color-accent` | Accent Blue | `#00B7FF` |
| `--color-muted` | Neutral Gray | `#B3B3B3` |
| `--color-bg` | Background | `#000000` |
| `--color-fg` | Foreground/Text | `#FFFFFF` |

Tailwind example:

```ts
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      bg: "var(--color-bg)",
      fg: "var(--color-fg)",
      primary: { DEFAULT: "var(--color-primary)" },
      cancel: { DEFAULT: "var(--color-cancel)" },
      accent: { DEFAULT: "var(--color-accent)" },
      muted: "var(--color-muted)",
    },
    fontFamily: { sans: "var(--font-sans)" },
    borderRadius: { xl: "1rem", "2xl": "1.25rem" }
  }
}
```

### Typography & Spacing
| Token | Description | Value |
|--------|--------------|--------|
| `--space-1` | XS | `4px` |
| `--space-2` | SM | `8px` |
| `--space-3` | MD | `16px` |
| `--space-4` | LG | `24px` |
| `--radius` | Default border radius | `16px` (`1rem`) |
| `--radius-lg` | Larger surfaces | `20px` (`1.25rem`) |
| `--shadow` | Card/Button hover shadow | `0 0 8px rgba(0, 213, 88, 0.4)` |

---

## 🧱 Primitive Example (Button)

```tsx
import * as React from "react";
import clsx from "clsx";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "cancel";
  size?: "sm" | "md" | "lg";
  block?: boolean;
};

const sizeMap = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base",
  lg: "h-12 px-6 text-lg",
};

const variantMap = {
  primary: "bg-primary text-black hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary",
  secondary: "bg-fg text-bg hover:opacity-90 focus-visible:ring-2 focus-visible:ring-fg",
  ghost: "bg-transparent text-fg border border-border hover:bg-white/5",
  cancel: "bg-cancel text-black hover:opacity-90 focus-visible:ring-2 focus-visible:ring-cancel",
};

export default function Button({ variant = "primary", size = "md", block, className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-2xl transition-colors outline-none",
        sizeMap[size],
        variantMap[variant],
        block && "w-full",
        className
      )}
      {...props}
    />
  );
}
```

---

## 🧩 Primitive Example (Badge)

```tsx
import * as React from "react";
import clsx from "clsx";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "primary" | "accent" | "cancel" | "muted";
};

const variantMap = {
  primary: "bg-primary text-black",
  accent: "bg-accent text-black",
  cancel: "bg-cancel text-black",
  muted: "bg-muted text-bg",
};

export default function Badge({ variant = "muted", className, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide",
        variantMap[variant],
        className
      )}
      {...props}
    />
  );
}
```

---

## 🧩 Primitive Example (Heading)

```tsx
import * as React from "react";
import clsx from "clsx";

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  as?: "h1" | "h2" | "h3" | "h4";
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "text-lg font-semibold",
  md: "text-2xl font-semibold",
  lg: "text-4xl font-bold",
};

export default function Heading({ as: Tag = "h2", size = "md", className, ...props }: HeadingProps) {
  return <Tag className={clsx("font-sans text-fg", sizeMap[size], className)} {...props} />;
}
```

---

## 🧰 Module Example (CardTile)

```tsx
import * as React from "react";
import Image from "@/components/primitives/Image";
import Heading from "@/components/primitives/Heading";
import Badge from "@/components/primitives/Badge";
import Button from "@/components/primitives/Button";

type CardTileProps = {
  title: string;
  subtitle?: string;
  imageUrl: string;
  badgeText?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
  className?: string;
};

export default function CardTile({
  title,
  subtitle,
  imageUrl,
  badgeText,
  onPrimary,
  onSecondary,
  primaryLabel = "View",
  secondaryLabel = "Add",
  className,
}: CardTileProps) {
  return (
    <div className={`rounded-2xl border border-border bg-bg/60 p-4 ${className ?? ""}`}>
      <div className="relative overflow-hidden rounded-xl">
        <Image src={imageUrl} alt={title} className="aspect-[4/3] object-cover" />
        {badgeText ? (
          <div className="absolute left-3 top-3">
            <Badge>{badgeText}</Badge>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <Heading as="h3" size="md" className="text-fg">
          {title}
        </Heading>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>

      <div className="mt-4 flex gap-2">
        {onPrimary && <Button onClick={onPrimary}>{primaryLabel}</Button>}
        {onSecondary && <Button variant="secondary" onClick={onSecondary}>{secondaryLabel}</Button>}
      </div>
    </div>
  );
}
```

---

## 🧭 Vibe & Visual Language

NeonBinder blends a **90s hobby-shop neon aesthetic** with **modern minimalism**:

- **Dark UI default** with **neon accents** (not overwhelming).  
- **High contrast** for readability; neon colors guide attention.  
- **Playful micro-interactions** with soft glows/shadows.  
- **Clean typography** via Lexend for modern, legible geometry.  
- **Cards feel physical** — soft borders, layered depth, subtle motion.

| Element | Primary Color | Usage |
|----------|----------------|-------|
| Primary Actions | Neon Green | CTAs, confirm buttons |
| Cancel/Destructive | Neon Pink | Cancel, remove, delete |
| Secondary/Links | Neon Blue | Interactive but non-destructive |
| Muted/Supportive | Neutral Gray | Subtext, dividers, placeholders |

---

## ♿ Accessibility

- All interactive primitives must have **focus-visible styles**.  
- Provide **`aria-label`** for icon-only buttons.  
- Maintain **4.5:1** contrast ratio for text vs background.  
- Respect **prefers-reduced-motion** and **reduced-transparency** system settings.

---

## 🔌 Fusion Integration Tips

- Keep primitives **headless/lightly-styled** for Builder flexibility.  
- Expose props matching Fusion input types (string, boolean, enum).  
- Always export a **default component**.  
- Use **human-readable prop names** (`primaryLabel`, `showBadge`, etc.).  
- No business logic; props in → UI out.  

---

## ✅ Quick Checklist (UI)

- [ ] New UI starts as a **Primitive**, then compose into a **Module** if reused.  
- [ ] Props are **typed**, minimal, and token-based.  
- [ ] No business logic or external data calls.  
- [ ] `className` passthrough for Fusion control.  
- [ ] Include focus/aria accessibility support.  
- [ ] Use **Lexend** + **NeonBinder tokens** only (no hard-coded colors).  
