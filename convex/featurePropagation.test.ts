/**
 * NEO-24 Stage 2: unit tests for the feature propagation engine.
 *
 * Covers `setSelectorOptionFeature`, `setCardFeature`, and the
 * `commitCardChecklist` ancestor-feature inheritance merge.
 *
 * Test matrix:
 *  - Set at sport level → cards under multiple sets all inherit
 *  - Cards with explicit overrides don't change
 *  - Re-set same value → no-op idempotency (counts surface zero changes)
 *  - Change value: cards still matching the old value follow; overridden don't
 *  - commitCardChecklist merges ancestor features into new card
 */

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

const modules = (import.meta as unknown as {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("./**/*.*s");

// ---------------------------------------------------------------------------
// Auth identities
// ---------------------------------------------------------------------------

const ADMIN_IDENTITY = {
  subject: "admin_user_001",
  issuer: "https://clerk.example.com",
  tokenIdentifier: "clerk|admin_user_001",
  name: "Admin User",
  role: "admin",
};

// ---------------------------------------------------------------------------
// Builder: seed a sport → setName → variantType subtree with cards under
// the variantType. Returns every id the test will need.
// ---------------------------------------------------------------------------

type SubtreeIds = {
  sportId: Id<"selectorOptions">;
  setNameId: Id<"selectorOptions">;
  variantTypeId: Id<"selectorOptions">;
  cardIds: Array<Id<"cardChecklist">>;
};

async function seedSubtree(
  t: ReturnType<typeof convexTest>,
  opts?: { cardFeaturesPerIndex?: Record<number, Record<string, string>> },
): Promise<SubtreeIds> {
  return t.run(async (ctx) => {
    const sportId = await ctx.db.insert("selectorOptions", {
      level: "sport",
      value: "Baseball",
      platformData: { bsc: "bsc-baseball", sportlots: "sl-baseball" },
      children: [],
      lastUpdated: Date.now(),
    });
    const setNameId = await ctx.db.insert("selectorOptions", {
      level: "setName",
      value: "2024 Topps",
      platformData: { bsc: "bsc-2024-topps", sportlots: "sl-2024-topps" },
      parentId: sportId,
      children: [],
      lastUpdated: Date.now(),
    });
    await ctx.db.patch(sportId, { children: [setNameId] });
    const variantTypeId = await ctx.db.insert("selectorOptions", {
      level: "variantType",
      value: "Base",
      platformData: { bsc: "bsc-2024-topps-base", sportlots: "sl-base" },
      parentId: setNameId,
      children: [],
      lastUpdated: Date.now(),
    });
    await ctx.db.patch(setNameId, { children: [variantTypeId] });

    const cardIds: Array<Id<"cardChecklist">> = [];
    for (let i = 0; i < 3; i++) {
      const features = opts?.cardFeaturesPerIndex?.[i];
      const id = await ctx.db.insert("cardChecklist", {
        selectorOptionId: variantTypeId,
        cardNumber: String(i + 1),
        cardName: `Card ${i + 1}`,
        platformData: {},
        sortOrder: i,
        lastUpdated: Date.now(),
        ...(features ? { features } : {}),
      });
      cardIds.push(id);
    }

    return { sportId, setNameId, variantTypeId, cardIds };
  });
}

// Builder: add a second setName + variantType under the same sport, with a
// few of its own cards. Used to confirm cross-set propagation when setting a
// feature at the sport root.
async function addSecondSet(
  t: ReturnType<typeof convexTest>,
  sportId: Id<"selectorOptions">,
): Promise<{
  setNameId: Id<"selectorOptions">;
  variantTypeId: Id<"selectorOptions">;
  cardIds: Array<Id<"cardChecklist">>;
}> {
  return t.run(async (ctx) => {
    const setNameId = await ctx.db.insert("selectorOptions", {
      level: "setName",
      value: "2024 Topps Chrome",
      platformData: { bsc: "bsc-2024-topps-chrome", sportlots: "sl-chrome" },
      parentId: sportId,
      children: [],
      lastUpdated: Date.now(),
    });
    const variantTypeId = await ctx.db.insert("selectorOptions", {
      level: "variantType",
      value: "Base",
      platformData: { bsc: "bsc-chrome-base", sportlots: "sl-chrome-base" },
      parentId: setNameId,
      children: [],
      lastUpdated: Date.now(),
    });
    await ctx.db.patch(setNameId, { children: [variantTypeId] });

    const sport = await ctx.db.get(sportId);
    const existingChildren = sport?.children ?? [];
    await ctx.db.patch(sportId, {
      children: [...existingChildren, setNameId],
    });

    const cardIds: Array<Id<"cardChecklist">> = [];
    for (let i = 0; i < 2; i++) {
      const id = await ctx.db.insert("cardChecklist", {
        selectorOptionId: variantTypeId,
        cardNumber: `C${i + 1}`,
        cardName: `Chrome ${i + 1}`,
        platformData: {},
        sortOrder: i,
        lastUpdated: Date.now(),
      });
      cardIds.push(id);
    }

    return { setNameId, variantTypeId, cardIds };
  });
}

// ===========================================================================
// setSelectorOptionFeature: propagation
// ===========================================================================

describe("setSelectorOptionFeature", () => {
  test("propagates a sport-level feature to cards under multiple sets", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);

    const subtree = await seedSubtree(t);
    const second = await addSecondSet(t, subtree.sportId);

    const result = await asAdmin.mutation(
      api.selectorOptions.setSelectorOptionFeature,
      { selectorOptionId: subtree.sportId, key: "league", value: "MLB" },
    );

    // 3 cards under the first set + 2 under the second = 5.
    expect(result.propagatedToCardCount).toBe(5);
    expect(result.skippedAsOverridden).toBe(0);

    // Verify every card has league=MLB.
    const everyCard = [...subtree.cardIds, ...second.cardIds];
    for (const id of everyCard) {
      const card = await t.run(async (ctx) => ctx.db.get(id));
      expect(card!.features?.league).toBe("MLB");
    }

    // Root row also has league=MLB.
    const root = await t.run(async (ctx) => ctx.db.get(subtree.sportId));
    expect(root!.features?.league).toBe("MLB");
  });

  test("leaves cards with explicit overrides untouched and counts them", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);

    // Pre-override one card's `league` to "NPB" (Japanese league override).
    const subtree = await seedSubtree(t, {
      cardFeaturesPerIndex: { 1: { league: "NPB" } },
    });

    const result = await asAdmin.mutation(
      api.selectorOptions.setSelectorOptionFeature,
      { selectorOptionId: subtree.sportId, key: "league", value: "MLB" },
    );

    expect(result.propagatedToCardCount).toBe(2); // cards 0 and 2
    expect(result.skippedAsOverridden).toBe(1);   // card 1

    const card0 = await t.run(async (ctx) => ctx.db.get(subtree.cardIds[0]));
    const card1 = await t.run(async (ctx) => ctx.db.get(subtree.cardIds[1]));
    const card2 = await t.run(async (ctx) => ctx.db.get(subtree.cardIds[2]));

    expect(card0!.features?.league).toBe("MLB");
    expect(card1!.features?.league).toBe("NPB"); // override preserved
    expect(card2!.features?.league).toBe("MLB");
  });

  test("re-setting the same value is a no-op (idempotent counts)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);

    const subtree = await seedSubtree(t);

    // First write: 3 cards get league=MLB.
    const first = await asAdmin.mutation(
      api.selectorOptions.setSelectorOptionFeature,
      { selectorOptionId: subtree.sportId, key: "league", value: "MLB" },
    );
    expect(first.propagatedToCardCount).toBe(3);

    // Second write of the same value: cards already match -> neither
    // propagated (already equal) nor skipped-as-overridden.
    const second = await asAdmin.mutation(
      api.selectorOptions.setSelectorOptionFeature,
      { selectorOptionId: subtree.sportId, key: "league", value: "MLB" },
    );
    expect(second.propagatedToCardCount).toBe(0);
    expect(second.skippedAsOverridden).toBe(0);
  });

  test("changing value: cards matching old value follow; overridden don't", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);

    const subtree = await seedSubtree(t);

    // Initial set: 3 cards get league=MLB.
    await asAdmin.mutation(api.selectorOptions.setSelectorOptionFeature, {
      selectorOptionId: subtree.sportId,
      key: "league",
      value: "MLB",
    });

    // Now operator overrides card 1 to MiLB on its own.
    await asAdmin.mutation(api.selectorOptions.setCardFeature, {
      cardChecklistId: subtree.cardIds[1],
      key: "league",
      value: "MiLB",
    });

    // Change set-level value to "MLB-International". Cards 0 and 2 still
    // match the OLD value ("MLB") so they follow; card 1 differs from both
    // undefined and the OLD value ("MLB"), so it's now an override and
    // counted as skipped.
    const result = await asAdmin.mutation(
      api.selectorOptions.setSelectorOptionFeature,
      {
        selectorOptionId: subtree.sportId,
        key: "league",
        value: "MLB-International",
      },
    );
    expect(result.propagatedToCardCount).toBe(2);
    expect(result.skippedAsOverridden).toBe(1);

    const card0 = await t.run(async (ctx) => ctx.db.get(subtree.cardIds[0]));
    const card1 = await t.run(async (ctx) => ctx.db.get(subtree.cardIds[1]));
    const card2 = await t.run(async (ctx) => ctx.db.get(subtree.cardIds[2]));

    expect(card0!.features?.league).toBe("MLB-International");
    expect(card1!.features?.league).toBe("MiLB");
    expect(card2!.features?.league).toBe("MLB-International");
  });
});

// ===========================================================================
// commitCardChecklist inheritance merge
// ===========================================================================

describe("commitCardChecklist (ancestor feature inheritance)", () => {
  test("new cards inherit merged ancestor features (deeper overrides shallower)", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);

    // Seed a subtree but no cards yet — commitCardChecklist will insert them.
    const subtreeIds = await t.run(async (ctx) => {
      const sportId = await ctx.db.insert("selectorOptions", {
        level: "sport",
        value: "Baseball",
        platformData: { bsc: "bsc-baseball", sportlots: "sl-baseball" },
        features: { league: "MLB", era: "Modern" },
        children: [],
        lastUpdated: Date.now(),
      });
      const setNameId = await ctx.db.insert("selectorOptions", {
        level: "setName",
        value: "2024 Topps",
        platformData: { bsc: "bsc-2024-topps", sportlots: "sl-2024-topps" },
        // Override era at the set level — deeper ancestors win.
        features: { era: "Modern-2020s", cardType: "Base Card" },
        parentId: sportId,
        children: [],
        lastUpdated: Date.now(),
      });
      await ctx.db.patch(sportId, { children: [setNameId] });
      const variantTypeId = await ctx.db.insert("selectorOptions", {
        level: "variantType",
        value: "Base",
        platformData: { bsc: "bsc-base", sportlots: "sl-base" },
        parentId: setNameId,
        children: [],
        lastUpdated: Date.now(),
      });
      await ctx.db.patch(setNameId, { children: [variantTypeId] });
      return { sportId, setNameId, variantTypeId };
    });

    // Commit two preview cards via the public mutation.
    await asAdmin.mutation(api.selectorOptions.commitCardChecklist, {
      selectorOptionId: subtreeIds.variantTypeId,
      sport: "Baseball",
      cards: [
        {
          cardNumber: "1",
          cardName: "Mike Trout",
          team: undefined,
          teams: [],
          players: ["Mike Trout"],
          attributes: [],
          isRookie: false,
          isRelic: false,
          printRun: undefined,
          autographType: undefined,
          cardVariation: undefined,
          platformData: { bsc: "bsc-card-1" },
          sourcePlatformIds: undefined,
          unmatched: undefined,
        },
        {
          cardNumber: "2",
          cardName: "Aaron Judge",
          team: undefined,
          teams: [],
          players: ["Aaron Judge"],
          attributes: [],
          isRookie: false,
          isRelic: false,
          printRun: undefined,
          autographType: undefined,
          cardVariation: undefined,
          platformData: { bsc: "bsc-card-2" },
          sourcePlatformIds: undefined,
          unmatched: undefined,
        },
      ],
      // Confirm names so commitCardChecklist actually creates the player
      // rows and resolves them — exercises the realistic write path.
      confirmedNewPlayers: ["Mike Trout", "Aaron Judge"],
      confirmedNewTeams: [],
    });

    const cards = await t.run(async (ctx) =>
      ctx.db
        .query("cardChecklist")
        .withIndex("by_selector_option", (q) =>
          q.eq("selectorOptionId", subtreeIds.variantTypeId),
        )
        .collect(),
    );

    expect(cards).toHaveLength(2);
    for (const card of cards) {
      // sport-level `league=MLB` survives.
      expect(card.features?.league).toBe("MLB");
      // set-level `era` overrides sport-level.
      expect(card.features?.era).toBe("Modern-2020s");
      // set-level new key flows through.
      expect(card.features?.cardType).toBe("Base Card");
    }
  });
});
