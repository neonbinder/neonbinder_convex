import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

// A faulty API route to test Sentry's error monitoring
export function GET(request: Request) {
  // Generate a request ID for correlation across systems
  const requestId = crypto.randomUUID();

  // Set Sentry tags for better observability (per AGENTS.md standards)
  Sentry.setTag("requestId", requestId);
  Sentry.setTag("repo", "neonbinder_web");
  Sentry.setTag("service", "next-api");
  Sentry.setTag("endpoint", "/api/sentry-example-api");

  // Add breadcrumbs for context (per AGENTS.md lines 556-609)
  Sentry.addBreadcrumb({
    message: "api.example.started",
    level: "info",
    data: { method: "GET" },
  });

  try {
    // Simulate business logic
    throw new SentryExampleAPIError(
      "This error is raised on the backend called by the example page.",
    );
  } catch (error) {
    // Capture exception with context (per AGENTS.md lines 590-608)
    Sentry.captureException(error);
    throw error;
  }

  return NextResponse.json({ data: "Testing Sentry Error..." });
}
