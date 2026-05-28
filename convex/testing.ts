// Per-user state reset for E2E test isolation.
//
// Problem: NEW_PROFILE_TEST_EMAIL_<worker> and TEST_EMAIL_<worker> resolve to
// fixed Clerk users that are reused across CI runs. After a flow successfully
// saves profile data, the next run's `assertVisible "→ paypal.me/<expected>"`
// step sees the *previous* run's handle and Maestro `inputText` (which appends
// rather than replaces) produces concatenated garbage.
//
// Fix: a test flow signs the user in, then calls this mutation to wipe that
// user's own per-user state before the assertions run.
//
// Security posture — why this is safe as a *public* mutation:
// - It is scoped to the CALLER: it deletes only rows owned by
//   getCurrentUserId(ctx). A signed-in user can only wipe their own data, never
//   anyone else's. There is no clerkUserId argument to spoof.
// - It is gated by the presence of the TESTING_RESET_SECRET env var on the
//   Convex deployment. That var is set on dev + preview deployments only;
//   production has no value, so the mutation throws there and real users'
//   profiles can never be deleted. (We check presence, not the value — it's
//   purely an on/off flag here. The value is never sent to the client, so it
//   can't leak through the bundle the way a Maestro `-e` secret would.)
// - Deletes are strictly scoped to the three per-user tables via the by_user
//   index. No bulk-wipe paths, no cross-user reach.

import { mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { getCurrentUserId } from "./auth";

export const resetMyTestState = mutation({
  args: {},
  returns: v.object({
    publicProfiles: v.number(),
    userProfiles: v.number(),
    prizePool: v.number(),
  }),
  handler: async (ctx) => {
    // Fail closed in production: the enabling flag is unset there.
    if (!process.env.TESTING_RESET_SECRET) {
      throw new Error("Test reset is not enabled on this deployment");
    }

    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const publicProfiles = await ctx.db
      .query("publicProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of publicProfiles) {
      await ctx.db.delete(row._id);
    }

    const userProfiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of userProfiles) {
      await ctx.db.delete(row._id);
    }

    const prizePool = await ctx.db
      .query("prizePool")
      .withIndex("by_user", (q) => q.eq("userId", userId))
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

// Server-side marketplace-credential seeding for E2E test isolation (NEO-29).
//
// Problem: Maestro flows used to receive real BSC/SportLots passwords via `-e`
// env, which Maestro serializes into its public CI debug artifacts. Instead,
// the dev test user's credentials are now seeded server-side from Convex env
// vars and never touch Maestro at all.
//
// Same security posture as resetMyTestState: scoped to the CALLER (seeds only
// getCurrentUserId's own credentials), gated by presence of TESTING_RESET_SECRET
// (set on dev + preview only — fails closed in production), and reads the secret
// values exclusively from server env (DEV_*), never from client arguments. The
// returned summary is booleans only — no username/password/token is echoed.
const SEED_SITE_ENV: Record<string, { username: string; password: string }> = {
  buysportscards: { username: "DEV_BSC_USERNAME", password: "DEV_BSC_PASSWORD" },
  sportlots: { username: "DEV_SPORTLOTS_USERNAME", password: "DEV_SPORTLOTS_PASSWORD" },
};

export const seedMyTestCredentials = action({
  args: { sites: v.optional(v.array(v.string())) },
  returns: v.object({
    seeded: v.array(
      v.object({
        site: v.string(),
        stored: v.boolean(),
        skipped: v.optional(v.boolean()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    // Fail closed in production: the enabling flag is unset there.
    if (!process.env.TESTING_RESET_SECRET) {
      throw new Error("Test credential seeding is not enabled on this deployment");
    }

    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const sites = args.sites ?? ["buysportscards", "sportlots"];
    const seeded: Array<{
      site: string;
      stored: boolean;
      skipped?: boolean;
    }> = [];

    for (const site of sites) {
      const envKeys = SEED_SITE_ENV[site];
      const username = envKeys ? process.env[envKeys.username] : undefined;
      const password = envKeys ? process.env[envKeys.password] : undefined;
      if (!username || !password) {
        // No dev creds configured for this site on this deployment — skip
        // rather than failing the whole seed call.
        seeded.push({ site, stored: false, skipped: true });
        continue;
      }

      const storeResult = await ctx.runAction(api.credentials.storeSiteCredentials, {
        site,
        username,
        password,
      });

      // Store the creds and flip the hasCredentials flag — but do NOT
      // authenticate here. A real Puppeteer marketplace login takes 30-65s
      // (Cloud Run cold start), and this action is awaited by the
      // /testing/seed-credentials page before it redirects, so authenticating
      // here would block the redirect well past the flows' post-redirect wait
      // budget (NEO-29 CI run 26575751575: every seed-routed flow died on the
      // stuck "Seeding marketplace credentials" page). Token warming is done
      // separately, where a flow can afford the latency, by tapping
      // "Test Credentials" (see util-login-to-bsc / util-login-to-sportlots);
      // adapters also mint a token lazily via getSiteToken on first fetch.
      if (storeResult.success) {
        await ctx.runMutation(api.userProfile.updateSiteCredentialStatus, {
          site,
          hasCredentials: true,
        });
      }

      seeded.push({ site, stored: storeResult.success });
    }

    return { seeded };
  },
});
