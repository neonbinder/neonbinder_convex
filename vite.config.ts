import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
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
