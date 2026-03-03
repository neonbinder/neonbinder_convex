import { NextResponse } from "next/server";

// This endpoint is only available when CLERK_TESTING_ENABLED=true.
// Set that env var in preview environments only — never production.
export async function POST() {
  if (process.env.CLERK_TESTING_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  const testEmail = process.env.TEST_EMAIL;

  if (!secretKey || !testEmail) {
    return NextResponse.json(
      { error: "CLERK_SECRET_KEY and TEST_EMAIL must be set" },
      { status: 500 },
    );
  }

  // Look up test user by email
  const usersRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(testEmail)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  );
  const usersData = await usersRes.json();
  const users = usersData.data ?? usersData;

  if (!users.length) {
    return NextResponse.json(
      { error: `No Clerk user found for ${testEmail}` },
      { status: 404 },
    );
  }

  const userId = users[0].id;

  // Generate both tokens in parallel
  const [signInTokenRes, testingTokenRes] = await Promise.all([
    // Sign-in token — lets the user sign in without a password (ticket strategy)
    fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId, expires_in_seconds: 120 }),
    }),
    // Testing token — bypasses Clerk's bot detection on FAPI requests
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
    return NextResponse.json(
      { error: "Failed to create sign-in token", detail: signInToken },
      { status: 500 },
    );
  }

  return NextResponse.json({
    signInToken: signInToken.token,
    testingToken: testingToken.token,
  });
}
