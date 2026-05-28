// Unit tests for the `resetMyTestState` mutation. Verifies caller-scoped
// deletes across publicProfiles / userProfiles / prizePool, the auth gate
// (must be signed in), and the production fail-closed gate (mutation throws
// unless TESTING_RESET_SECRET is present on the deployment).

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = (import.meta as unknown as {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("./**/*.*s");

const USER_A = "user_aaaabbbbcccc";
const USER_B = "user_ddddeeeeffff";

beforeEach(() => {
  // Enabling flag — present on dev/preview, absent on prod.
  process.env.TESTING_RESET_SECRET = "test-enabled";
});

afterEach(() => {
  delete process.env.TESTING_RESET_SECRET;
});

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

describe("resetMyTestState", () => {
  test("deletes the caller's own rows across all three tables", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, USER_A);

    const result = await t
      .withIdentity({ subject: USER_A })
      .mutation(api.testing.resetMyTestState, {});

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

    await t
      .withIdentity({ subject: USER_A })
      .mutation(api.testing.resetMyTestState, {});

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

  test("zero-count happy path when the caller has no rows", async () => {
    const t = convexTest(schema, modules);

    const result = await t
      .withIdentity({ subject: USER_A })
      .mutation(api.testing.resetMyTestState, {});

    expect(result).toEqual({
      publicProfiles: 0,
      userProfiles: 0,
      prizePool: 0,
    });
  });

  test("throws when the caller is not authenticated", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, USER_A);

    await expect(
      t.mutation(api.testing.resetMyTestState, {}),
    ).rejects.toThrow(/Not authenticated/);

    // Existing rows must be untouched.
    expect(await countRows(t, USER_A)).toEqual({
      publicProfiles: 1,
      userProfiles: 1,
      prizePool: 1,
    });
  });

  test("throws (fails closed) when TESTING_RESET_SECRET is unset", async () => {
    delete process.env.TESTING_RESET_SECRET;
    const t = convexTest(schema, modules);
    await seedUser(t, USER_A);

    await expect(
      t
        .withIdentity({ subject: USER_A })
        .mutation(api.testing.resetMyTestState, {}),
    ).rejects.toThrow(/not enabled/);

    expect(await countRows(t, USER_A)).toEqual({
      publicProfiles: 1,
      userProfiles: 1,
      prizePool: 1,
    });
  });
});
