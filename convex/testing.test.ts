// Unit tests for the `resetUserStateForTesting` internalMutation. Verifies
// per-user scoping across publicProfiles / userProfiles / prizePool, plus the
// clerkUserId shape guard. The secret gate lives in the HTTP action (see
// convex/testing.ts) and is exercised end-to-end in CI; pure-Convex unit tests
// only cover the mutation surface.

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = (import.meta as unknown as {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("./**/*.*s");

const USER_A = "user_aaaabbbbcccc";
const USER_B = "user_ddddeeeeffff";

async function seedUser(
  t: ReturnType<typeof convexTest>,
  userId: string,
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("publicProfiles", {
      userId,
      username: userId,
      createdAt: 0,
      updatedAt: 0,
    });
    await ctx.db.insert("userProfiles", {
      userId,
      preferences: { defaultSport: "Baseball" },
    });
    await ctx.db.insert("prizePool", {
      userId,
      prizeName: "test-prize",
      percentage: 10,
      createdAt: 0,
      updatedAt: 0,
    });
  });
}

async function countRows(
  t: ReturnType<typeof convexTest>,
  userId: string,
): Promise<{
  publicProfiles: number;
  userProfiles: number;
  prizePool: number;
}> {
  // Use collect() + manual filter instead of `.withIndex()` to sidestep
  // schema-aware index typing on `ReturnType<typeof convexTest>` (which
  // falls back to SystemIndexes). Test data is tiny so the table scan is
  // fine.
  return t.run(async (ctx) => {
    const pp = (await ctx.db.query("publicProfiles").collect()).filter(
      (r) => r.userId === userId,
    );
    const up = (await ctx.db.query("userProfiles").collect()).filter(
      (r) => r.userId === userId,
    );
    const pz = (await ctx.db.query("prizePool").collect()).filter(
      (r) => r.userId === userId,
    );
    return {
      publicProfiles: pp.length,
      userProfiles: up.length,
      prizePool: pz.length,
    };
  });
}

describe("resetUserStateForTesting", () => {
  test("deletes per-user rows across publicProfiles, userProfiles, and prizePool", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, USER_A);

    const result = await t.mutation(
      internal.testing.resetUserStateForTesting,
      { clerkUserId: USER_A },
    );

    expect(result).toEqual({
      publicProfiles: 1,
      userProfiles: 1,
      prizePool: 1,
    });
    expect(await countRows(t, USER_A)).toEqual({
      publicProfiles: 0,
      userProfiles: 0,
      prizePool: 0,
    });
  });

  test("leaves other users' rows untouched", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, USER_A);
    await seedUser(t, USER_B);

    await t.mutation(internal.testing.resetUserStateForTesting, {
      clerkUserId: USER_A,
    });

    expect(await countRows(t, USER_A)).toEqual({
      publicProfiles: 0,
      userProfiles: 0,
      prizePool: 0,
    });
    expect(await countRows(t, USER_B)).toEqual({
      publicProfiles: 1,
      userProfiles: 1,
      prizePool: 1,
    });
  });

  test("zero-count happy path when the user has no rows", async () => {
    const t = convexTest(schema, modules);

    const result = await t.mutation(
      internal.testing.resetUserStateForTesting,
      { clerkUserId: USER_A },
    );

    expect(result).toEqual({
      publicProfiles: 0,
      userProfiles: 0,
      prizePool: 0,
    });
  });

  test("rejects clerkUserId that doesn't match the user_<alphanum> shape", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, USER_A);

    await expect(
      t.mutation(internal.testing.resetUserStateForTesting, {
        clerkUserId: "not-a-clerk-id",
      }),
    ).rejects.toThrow(/Invalid clerkUserId/);

    // Existing rows must be untouched.
    expect(await countRows(t, USER_A)).toEqual({
      publicProfiles: 1,
      userProfiles: 1,
      prizePool: 1,
    });
  });

  test("rejects empty clerkUserId", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(internal.testing.resetUserStateForTesting, {
        clerkUserId: "",
      }),
    ).rejects.toThrow(/Invalid clerkUserId/);
  });

  test("rejects clerkUserId with a non-Clerk prefix even if the rest is valid", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(internal.testing.resetUserStateForTesting, {
        clerkUserId: "sess_abcdef0123",
      }),
    ).rejects.toThrow(/Invalid clerkUserId/);
  });
});
