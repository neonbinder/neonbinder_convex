import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import mkcert from "vite-plugin-mkcert";
import path from "path";

// Dev-only handler for POST /api/auth/testing — generates Clerk sign-in +
// testing tokens so Maestro flows can bypass the password form. This was a
// Next.js API route before the Vite migration; see commit 52cb8d1.
function clerkTestingApiPlugin(): Plugin {
  let env: Record<string, string> = {};
  return {
    name: "clerk-testing-api",
    apply: "serve",
    configResolved(config) {
      env = loadEnv(config.mode, config.root, "");
    },
    configureServer(server) {
      server.middlewares.use(
        "/api/auth/testing",
        async (req, res, next) => {
          if (req.method !== "POST") return next();

          const sendJson = (status: number, body: unknown) => {
            res.statusCode = status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(body));
          };

          if (env.CLERK_TESTING_ENABLED !== "true") {
            return sendJson(404, { error: "Not found" });
          }

          const secretKey = env.CLERK_SECRET_KEY;
          const testEmail = env.TEST_EMAIL;
          if (!secretKey || !testEmail) {
            return sendJson(500, {
              error: "CLERK_SECRET_KEY and TEST_EMAIL must be set",
            });
          }

          try {
            const usersRes = await fetch(
              `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(testEmail)}`,
              { headers: { Authorization: `Bearer ${secretKey}` } },
            );
            const usersData = await usersRes.json();
            const users = usersData.data ?? usersData;
            if (!Array.isArray(users) || users.length === 0) {
              return sendJson(404, {
                error: `No Clerk user found for ${testEmail}`,
              });
            }
            const userId = users[0].id;

            const [signInTokenRes, testingTokenRes] = await Promise.all([
              fetch("https://api.clerk.com/v1/sign_in_tokens", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${secretKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  user_id: userId,
                  expires_in_seconds: 120,
                }),
              }),
              fetch("https://api.clerk.com/v1/testing_tokens", {
                method: "POST",
                headers: { Authorization: `Bearer ${secretKey}` },
              }),
            ]);
            const [signInToken, testingToken] = await Promise.all([
              signInTokenRes.json(),
              testingTokenRes.json(),
            ]);

            if (!signInToken.token) {
              return sendJson(500, {
                error: "Failed to create sign-in token",
                detail: signInToken,
              });
            }

            return sendJson(200, {
              signInToken: signInToken.token,
              testingToken: testingToken.token,
            });
          } catch (e) {
            return sendJson(500, {
              error: e instanceof Error ? e.message : String(e),
            });
          }
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    mkcert(),
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
});
