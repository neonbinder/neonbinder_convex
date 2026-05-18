import { defineConfig } from "vitest/config";
import path from "path";

// `environmentMatchGlobs` is the field convex-test docs recommend but it's
// not in the current Vitest types. Cast so tsc stays clean — runtime
// behavior is unaffected.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["convex/**/*.test.ts"],
    ...({ environmentMatchGlobs: [["convex/**", "edge-runtime"]] } as Record<string, unknown>),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
