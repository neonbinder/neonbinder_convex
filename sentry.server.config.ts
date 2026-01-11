// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  // Sample 10% of transactions in production
  // This reduces costs while maintaining sufficient observability
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Do not automatically send PII to comply with privacy-first standards
  // If you need user data, explicitly add it via tags or context
  // sendDefaultPii: false, // default value is false, explicitly set here for clarity
});
