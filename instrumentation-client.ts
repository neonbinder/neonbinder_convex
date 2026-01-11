// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Sample 10% of transactions in production
  // This reduces costs while maintaining sufficient observability
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Do not automatically send PII to comply with privacy-first standards
  // If you need user data, explicitly add it via tags or context
  // sendDefaultPii: false, // default value is false, explicitly set here for clarity
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
