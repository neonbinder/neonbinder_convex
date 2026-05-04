import type { VercelRequest, VercelResponse } from "@vercel/node";
import { issueClerkTestingTokens } from "../../lib/testing/issue-clerk-tokens.js";

// POST /api/auth/testing — mints Clerk sign-in + testing tokens for E2E runs.
//
// Body: optional { account: "main" | "new-profile" }. Defaults to "main".
//   - main         → process.env.TEST_EMAIL (pre-provisioned account)
//   - new-profile  → process.env.NEW_PROFILE_TEST_EMAIL (always-empty account
//                    used by profile-creation/edit tests that need a fresh
//                    starting state)
//
// Security layers:
// 1. Vercel env-var scoping: CLERK_TESTING_ENABLED, TEST_EMAIL, CLERK_SECRET_KEY,
//    and TESTING_ENDPOINT_SECRET are set only on Preview + Development envs,
//    never Production. Without CLERK_SECRET_KEY, production cannot issue tokens.
// 2. Runtime VERCEL_ENV check — 404 if not preview/development.
// 3. Shared-secret header x-testing-auth must match TESTING_ENDPOINT_SECRET.
// 4. Email allowlist — only the requested account's *_EMAIL env var can be
//    used. Unknown account values are rejected.
// 5. 120s sign-in-token TTL (in issueClerkTestingTokens).
// 6. Logs each issuance for audit (includes which account was selected).

type TestAccount = "main" | "new-profile";

const TEST_ACCOUNTS = ["main", "new-profile"] as const satisfies readonly TestAccount[];

function isTestAccount(value: unknown): value is TestAccount {
  return typeof value === "string" && (TEST_ACCOUNTS as readonly string[]).includes(value);
}

function resolveTestEmail(account: TestAccount): string | undefined {
  switch (account) {
    case "main":
      return process.env.TEST_EMAIL;
    case "new-profile":
      return process.env.NEW_PROFILE_TEST_EMAIL;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Layer 2: hard 404 outside preview/development. Covers the case where
  // someone forgets to scope env vars and the endpoint ends up in prod.
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv && vercelEnv !== "preview" && vercelEnv !== "development") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Layer 1: gate on explicit opt-in env var.
  if (process.env.CLERK_TESTING_ENABLED !== "true") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Layer 3: shared-secret header. Without TESTING_ENDPOINT_SECRET set on
  // the server, no request can succeed (strict comparison with undefined).
  const expectedSecret = process.env.TESTING_ENDPOINT_SECRET;
  const providedSecret = req.headers["x-testing-auth"];
  if (!expectedSecret || providedSecret !== expectedSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Layer 4: account selector — restrict to the explicit allowlist of
  // known accounts; reject anything else. VercelRequest auto-parses JSON
  // bodies when Content-Type is application/json.
  const requestedAccount = (req.body as { account?: unknown } | undefined)?.account;
  const account: TestAccount = requestedAccount === undefined ? "main" : (
    isTestAccount(requestedAccount) ? requestedAccount : "main"
  );
  if (requestedAccount !== undefined && !isTestAccount(requestedAccount)) {
    res.status(400).json({ error: "Unknown account" });
    return;
  }
  const testEmail = resolveTestEmail(account);
  if (!testEmail) {
    res.status(500).json({
      error: `${account === "main" ? "TEST_EMAIL" : "NEW_PROFILE_TEST_EMAIL"} not configured for account "${account}"`,
    });
    return;
  }

  const result = await issueClerkTestingTokens({
    clerkSecretKey: process.env.CLERK_SECRET_KEY,
    testEmail,
  });

  // Layer 6: audit log (visible in Vercel logs).
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (forwardedFor ?? "unknown");
  const deploymentUrl = req.headers["x-vercel-deployment-url"] ?? "unknown";
  console.log(
    JSON.stringify({
      event: "testing_tokens_issued",
      ok: result.ok,
      ip,
      account,
      email: testEmail,
      deploymentUrl,
      vercelEnv,
      ts: new Date().toISOString(),
    }),
  );

  if (!result.ok) {
    res.status(result.status).json({ error: result.error, detail: result.detail });
    return;
  }

  res.status(200).json({
    signInToken: result.signInToken,
    testingToken: result.testingToken,
  });
}
