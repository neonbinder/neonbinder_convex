// Shared logic for minting Clerk sign-in + testing tokens so that Maestro
// E2E flows can bypass the password form and Clerk's bot detection.
//
// Used by:
// - Vite dev-server middleware (vite.config.ts) for local `vite dev`
// - Vercel serverless function (api/auth/testing.ts) for Vercel preview deploys

export type IssueResult =
  | { ok: true; signInToken: string; testingToken: string | undefined }
  | { ok: false; status: number; error: string; detail?: unknown };

export interface IssueEnv {
  clerkSecretKey: string | undefined;
  testEmail: string | undefined;
}

export async function issueClerkTestingTokens(
  env: IssueEnv,
): Promise<IssueResult> {
  const { clerkSecretKey, testEmail } = env;

  if (!clerkSecretKey || !testEmail) {
    return {
      ok: false,
      status: 500,
      error: "CLERK_SECRET_KEY and TEST_EMAIL must be set",
    };
  }

  const usersRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(testEmail)}`,
    { headers: { Authorization: `Bearer ${clerkSecretKey}` } },
  );
  const usersData = (await usersRes.json()) as unknown;
  const users = Array.isArray(usersData)
    ? usersData
    : ((usersData as { data?: unknown }).data ?? usersData);
  if (!Array.isArray(users) || users.length === 0) {
    return {
      ok: false,
      status: 404,
      error: `No Clerk user found for ${testEmail}`,
    };
  }
  const userId = (users[0] as { id: string }).id;

  const [signInTokenRes, testingTokenRes] = await Promise.all([
    fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        expires_in_seconds: 120,
      }),
    }),
    fetch("https://api.clerk.com/v1/testing_tokens", {
      method: "POST",
      headers: { Authorization: `Bearer ${clerkSecretKey}` },
    }),
  ]);

  const [signInToken, testingToken] = await Promise.all([
    signInTokenRes.json() as Promise<{ token?: string }>,
    testingTokenRes.json() as Promise<{ token?: string }>,
  ]);

  if (!signInToken.token) {
    return {
      ok: false,
      status: 500,
      error: "Failed to create sign-in token",
      detail: signInToken,
    };
  }

  return {
    ok: true,
    signInToken: signInToken.token,
    testingToken: testingToken.token,
  };
}
