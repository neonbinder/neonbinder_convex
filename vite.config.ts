import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "path";
import { issueClerkTestingTokens } from "./lib/testing/issue-clerk-tokens";

// Dev-only middleware that mirrors api/auth/testing.ts so that Maestro E2E
// flows can hit /testing/sign-in against `vite dev` without needing a full
// `vercel dev` setup. Same security layers as the Vercel handler.
function clerkTestingApiPlugin(): Plugin {
  return {
    name: "clerk-testing-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/auth/testing", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        if (process.env.CLERK_TESTING_ENABLED !== "true") {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Not found" }));
          return;
        }
        const expectedSecret = process.env.TESTING_ENDPOINT_SECRET;
        const providedSecret = req.headers["x-testing-auth"];
        if (!expectedSecret || providedSecret !== expectedSecret) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }
        const result = await issueClerkTestingTokens({
          clerkSecretKey: process.env.CLERK_SECRET_KEY,
          testEmail: process.env.TEST_EMAIL,
        });
        res.setHeader("Content-Type", "application/json");
        if (!result.ok) {
          res.statusCode = result.status;
          res.end(JSON.stringify({ error: result.error, detail: result.detail }));
          return;
        }
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            signInToken: result.signInToken,
            testingToken: result.testingToken,
          }),
        );
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load .env* into process.env for server-side code (Vite only populates
  // import.meta.env.VITE_* by default; the dev-only Clerk testing middleware
  // reads CLERK_SECRET_KEY, TEST_EMAIL, etc. from process.env).
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.VITE_DEV_DISABLE_HTTPS ? [] : [basicSsl()]),
    clerkTestingApiPlugin(),
    sentryVitePlugin({
      org: "neon-binder",
      project: "javascript-nextjs",
      sourcemaps: {
        filesToDeleteAfterUpload: ["./dist/**/*.map"],
      },
      silent: !process.env.CI,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  build: {
    sourcemap: true,
  },
  server: {
    port: 3000,
    proxy: {
      "/ingest/static": {
        target: "https://us-assets.i.posthog.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ingest\/static/, "/static"),
      },
      "/ingest": {
        target: "https://us.i.posthog.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ingest/, ""),
      },
      "/monitoring": {
        target: "https://o4510257330520064.ingest.us.sentry.io",
        changeOrigin: true,
      },
    },
  },
  };
});
