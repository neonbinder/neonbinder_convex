---
name: project_test_infrastructure
description: Vitest setup, project layout, and component test patterns for neonbinder_web
metadata:
  type: project
---

## Test runner: Vitest v4 with two projects

Config at `neonbinder_web/vitest.config.ts`:

- **convex-lib** — `environment: "node"`, `include: ["convex/**/*.test.ts", "lib/**/*.test.ts"]`
- **components** — `environment: "happy-dom"`, `include: ["components/**/*.test.tsx"]`

Both projects resolve `@` to the project root via `resolve.alias`.

## Running tests

No `npm test` script exists. Invoke vitest directly:

```bash
# Run a specific file
npx vitest run components/SetSelector/EntityColumn.field-class.test.tsx

# Run all component tests
npx vitest run --project components

# Run all convex/lib tests
npx vitest run --project convex-lib
```

Tests are NOT in CI — unit tests must be run manually for now. A `"test": "vitest run"` script in package.json would be a low-effort improvement worth raising with the user.

## Standard mocking pattern (component tests)

From `EntityColumn.custom-select.test.tsx` and `EntityColumn.field-class.test.tsx`:

```typescript
vi.mock("../../convex/_generated/api", () => ({
  api: {
    selectorOptions: {
      getSelectorOptions: "getSelectorOptions",
      addCustomSelectorOption: "addCustomSelectorOption",
    },
  },
}));

const mockAddCustom = vi.fn();
const mockQuery = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockAddCustom,
  useQuery: () => mockQuery(),
}));
```

- `api` members are used only as identity keys — plain strings work fine.
- `useMutation` always returns the same spy regardless of which mutation key is passed.
- `useQuery` returns whatever `mockQuery()` returns — configure per test or in `beforeEach`.

## Key gotcha: EntityColumn auto-sync

Return `mockQuery.mockReturnValue(undefined)` (not `[]`) to keep EntityColumn in idle mode. See [[feedback_autosync_idle_mode]].
