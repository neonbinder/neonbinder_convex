// Per-user state reset for E2E test isolation.
//
// Problem: NEW_PROFILE_TEST_EMAIL_<worker> and TEST_EMAIL_<worker> resolve to
// fixed Clerk users that are reused across CI runs. After a flow successfully
// saves profile data, the next run's `assertVisible "→ paypal.me/<expected>"`
// step sees the *previous* run's handle and Maestro `inputText` (which
// appends rather than replaces) produces concatenated garbage.
//
// Fix: between every test sign-in, wipe the per-user state for the resolved
// Clerk user. This preserves the worker-parallel-safety guarantee (each
// worker only touches its own user) while making the `# account=new-profile
// guarantees empty fields` invariant in fill-profile-data.yaml actually true.
//
// Security posture:
// - The mutation is `internalMutation`, so it does NOT appear in the public
//   `api` surface that gets bundled with client code. Only Convex-internal
//   callers (the HTTP action below) can reach it.
// - The HTTP action is the trust boundary: it checks an `x-testing-reset-secret`
//   header against `TESTING_RESET_SECRET`. The secret is set on Convex
//   preview/dev deployments only; production has no value set, so any call
//   from prod fails closed.
// - The secret name deliberately has no VITE_ prefix so it can't be bundled
//   to the browser.
// - `clerkUserId` is shape-guarded to Clerk's `user_<alphanum>` format so
//   even a leaked secret can't be used to pass arbitrary keys that happen to
//   match other tables' userId fields.
// - Deletes are strictly scoped to the three per-user tables via the
//   `by_user` index. No bulk wipe paths.

import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Matches Clerk's `user_<base62>` format. Anchored to prevent embedding of
// stray characters that could surprise downstream consumers of the value.
const CLERK_USER_ID_PATTERN = /^user_[A-Za-z0-9]{8,64}$/;

export const resetUserStateForTesting = internalMutation({
  args: {
    clerkUserId: v.string(),
  },
  returns: v.object({
    publicProfiles: v.number(),
    userProfiles: v.number(),
    prizePool: v.number(),
  }),
  handler: async (ctx, args) => {
    if (!CLERK_USER_ID_PATTERN.test(args.clerkUserId)) {
      throw new Error("Invalid clerkUserId");
    }

    const publicProfiles = await ctx.db
      .query("publicProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkUserId))
      .collect();
    for (const row of publicProfiles) {
      await ctx.db.delete(row._id);
    }

    const userProfiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkUserId))
      .collect();
    for (const row of userProfiles) {
      await ctx.db.delete(row._id);
    }

    const prizePool = await ctx.db
      .query("prizePool")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkUserId))
      .collect();
    for (const row of prizePool) {
      await ctx.db.delete(row._id);
    }

    return {
      publicProfiles: publicProfiles.length,
      userProfiles: userProfiles.length,
      prizePool: prizePool.length,
    };
  },
});

// POST /testing/reset-user-state
// Body: { clerkUserId: string }
// Header: x-testing-reset-secret: <TESTING_RESET_SECRET>
//
// Fails closed when TESTING_RESET_SECRET is unset (prod posture).
export const resetUserStateHttp = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const expectedSecret = process.env.TESTING_RESET_SECRET;
  const providedSecret = request.headers.get("x-testing-reset-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const clerkUserId =
    typeof body === "object" && body !== null && "clerkUserId" in body
      ? (body as { clerkUserId: unknown }).clerkUserId
      : undefined;
  if (typeof clerkUserId !== "string" || !CLERK_USER_ID_PATTERN.test(clerkUserId)) {
    return new Response(JSON.stringify({ error: "invalid_clerk_user_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const counts = await ctx.runMutation(
    internal.testing.resetUserStateForTesting,
    { clerkUserId },
  );

  return new Response(JSON.stringify(counts), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
