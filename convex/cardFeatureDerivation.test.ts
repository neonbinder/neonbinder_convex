/**
 * NEO-25: integration test that the addCustomCard path walks the ancestor
 * chain and auto-derives marketplace features onto the new row, so a card
 * isn't blank in the detail panel. Mirrors the commitCardChecklist new-card
 * derivation; this is the cheaper path to exercise end-to-end.
 */

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = (import.meta as unknown as {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("./**/*.*s");

const ADMIN_IDENTITY = {
  subject: "admin_user_001",
  issuer: "https://clerk.example.com",
  tokenIdentifier: "clerk|admin_user_001",
  name: "Admin User",
  role: "admin",
};

describe("addCustomCard auto-derives features (NEO-25)", () => {
  test("new custom card inherits set-level + observed features", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);

    const variantTypeId = await t.run(async (ctx) => {
      const sportId = await ctx.db.insert("selectorOptions", {
        level: "sport",
        value: "Baseball",
        platformData: { bsc: "x", sportlots: "y" },
        children: [],
        lastUpdated: Date.now(),
      });
      const yearId = await ctx.db.insert("selectorOptions", {
        level: "year",
        value: "2024",
        platformData: { bsc: "x", sportlots: "y" },
        parentId: sportId,
        children: [],
        lastUpdated: Date.now(),
      });
      const mfrId = await ctx.db.insert("selectorOptions", {
        level: "manufacturer",
        value: "Topps",
        platformData: { bsc: "x", sportlots: "y" },
        parentId: yearId,
        children: [],
        lastUpdated: Date.now(),
      });
      const setNameId = await ctx.db.insert("selectorOptions", {
        level: "setName",
        value: "Topps Chrome",
        platformData: { bsc: "x", sportlots: "y" },
        parentId: mfrId,
        children: [],
        lastUpdated: Date.now(),
      });
      return await ctx.db.insert("selectorOptions", {
        level: "variantType",
        value: "Base",
        platformData: { bsc: "x", sportlots: "y" },
        parentId: setNameId,
        children: [],
        lastUpdated: Date.now(),
      });
    });

    await asAdmin.mutation(api.selectorOptions.addCustomCard, {
      selectorOptionId: variantTypeId,
      cardNumber: "1",
      cardName: "Aaron Judge",
      attributes: ["RC"],
    });

    const cards = await asAdmin.query(api.selectorOptions.getCardChecklist, {
      selectorOptionId: variantTypeId,
    });
    expect(cards).toHaveLength(1);
    const f = cards[0].features ?? {};

    expect(f.league).toBe("MLB");
    expect(f.era).toBe("Modern (1980-Now)");
    expect(f.vintage).toBe("false");
    expect(f.manufacturer).toBe("Topps");
    expect(f.cardType).toBe("Base");
    expect(f.isReprint).toBe("false");
    // RC attribute → observed rookie.
    expect(f.isRookie).toBe("true");
  });

  test("operator-set ancestor feature beats the derived default", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);

    const variantTypeId = await t.run(async (ctx) => {
      const sportId = await ctx.db.insert("selectorOptions", {
        level: "sport",
        value: "Baseball",
        platformData: { bsc: "x", sportlots: "y" },
        children: [],
        lastUpdated: Date.now(),
      });
      // Operator overrode league at the setName level (e.g. a Japanese set).
      const setNameId = await ctx.db.insert("selectorOptions", {
        level: "setName",
        value: "BBM",
        platformData: { bsc: "x", sportlots: "y" },
        parentId: sportId,
        children: [],
        features: { league: "NPB" },
        lastUpdated: Date.now(),
      });
      return await ctx.db.insert("selectorOptions", {
        level: "variantType",
        value: "Base",
        platformData: { bsc: "x", sportlots: "y" },
        parentId: setNameId,
        children: [],
        lastUpdated: Date.now(),
      });
    });

    await asAdmin.mutation(api.selectorOptions.addCustomCard, {
      selectorOptionId: variantTypeId,
      cardNumber: "1",
      cardName: "Player",
    });

    const cards = await asAdmin.query(api.selectorOptions.getCardChecklist, {
      selectorOptionId: variantTypeId,
    });
    // Inherited operator value wins over the sport-derived "MLB".
    expect((cards[0].features ?? {}).league).toBe("NPB");
  });
});
