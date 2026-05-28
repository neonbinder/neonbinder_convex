/**
 * NEO-24 Stage 3b — unit tests for `adapters/tcdb.enrichSetFromTcdb`.
 *
 * Covers:
 *   - happy path: search → get-set → setMetadata patched + missing
 *     features filled
 *   - cached tcdbSetId: skips /tcdb/search
 *   - tcdb-unavailable from /tcdb/search: returns reason, writes nothing
 *   - tcdb-unavailable from /tcdb/get-set: returns reason, writes nothing
 *   - no confident match (empty matches): returns reason, writes nothing
 *   - existing operator-set features are not clobbered by enrichment
 *   - wrong-level row (variantType instead of setName): returns reason
 *
 * `fetch` is stubbed via `vi.stubGlobal` so we never touch the network
 * or the Google auth library. We point the adapter at a loopback URL via
 * `NEONBINDER_TCDB_URL` so the OIDC code path no-ops (per the adapter's
 * LOOPBACK_HOSTS check).
 */

// Force the adapter onto the loopback short-circuit before importing.
process.env.NEONBINDER_TCDB_URL = "http://localhost:9999";

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("./**/*.*s");

const ADMIN_IDENTITY = {
  subject: "admin_user_001",
  issuer: "https://clerk.example.com",
  tokenIdentifier: "clerk|admin_user_001",
  name: "Admin User",
  role: "admin",
};

type SeedIds = {
  sportId: Id<"selectorOptions">;
  yearId: Id<"selectorOptions">;
  setNameId: Id<"selectorOptions">;
};

async function seedSetChain(
  t: ReturnType<typeof convexTest>,
  opts: {
    setName?: string;
    sport?: string;
    year?: string;
    setMetadata?: Record<string, unknown>;
    features?: Record<string, string>;
  } = {},
): Promise<SeedIds> {
  return t.run(async (ctx) => {
    const sportId = await ctx.db.insert("selectorOptions", {
      level: "sport",
      value: opts.sport ?? "Baseball",
      platformData: {},
      children: [],
      lastUpdated: Date.now(),
    });
    const yearId = await ctx.db.insert("selectorOptions", {
      level: "year",
      value: opts.year ?? "2024",
      platformData: {},
      parentId: sportId,
      children: [],
      lastUpdated: Date.now(),
    });
    await ctx.db.patch(sportId, { children: [yearId] });
    const setNameId = await ctx.db.insert("selectorOptions", {
      level: "setName",
      value: opts.setName ?? "Topps Chrome",
      platformData: {},
      parentId: yearId,
      children: [],
      ...(opts.setMetadata ? { setMetadata: opts.setMetadata } : {}),
      ...(opts.features ? { features: opts.features } : {}),
      lastUpdated: Date.now(),
    });
    await ctx.db.patch(yearId, { children: [setNameId] });
    return { sportId, yearId, setNameId };
  });
}

type FetchStub = (
  url: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  // Clear any prior global fetch stubs so tests don't leak into each other.
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("enrichSetFromTcdb", () => {
  test("happy path: searches, fetches set, patches metadata + features", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);
    const { setNameId } = await seedSetChain(t, {
      setName: "Topps Chrome",
    });

    const calls: Array<{ url: string; body: unknown }> = [];
    const fakeFetch: FetchStub = async (url, init) => {
      const u = String(url);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url: u, body });
      if (u.endsWith("/tcdb/search")) {
        return jsonResponse({
          matches: [
            {
              tcdbSetId: "27845",
              name: "2024 Topps Chrome Baseball",
              year: 2024,
              sport: "Baseball",
              url: "https://www.tcdb.com/Checklist.cfm/sid/27845",
              score: 0.95,
            },
          ],
        });
      }
      if (u.endsWith("/tcdb/get-set")) {
        return jsonResponse({
          metadata: {
            tcdbSetId: "27845",
            name: "2024 Topps Chrome Baseball",
            releaseDate: "2024-08-21",
            totalCardCount: 220,
            block: "Topps Chrome",
            sourceUrl: "https://www.tcdb.com/Checklist.cfm/sid/27845",
            additionalFeatures: {
              Manufacturer: "Topps",
              "Card Type": "Base",
            },
          },
        });
      }
      throw new Error(`unexpected fetch: ${u}`);
    };
    vi.stubGlobal("fetch", fakeFetch);

    const result = await asAdmin.action(
      internal.adapters.tcdb.enrichSetFromTcdb,
      { selectorOptionId: setNameId },
    );

    expect(result.matched).toBe(true);
    expect(result.tcdbSetId).toBe("27845");
    expect(result.setMetadataApplied).toBe(true);
    expect(result.featuresAdded).toBe(2); // manufacturer + cardType
    expect(result.reason).toBeUndefined();

    // Confirm we hit both endpoints with sane bodies.
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("/tcdb/search");
    expect(calls[0].body).toMatchObject({
      sport: "Baseball",
      year: 2024,
      setName: "Topps Chrome",
    });
    expect(calls[1].url).toContain("/tcdb/get-set");
    expect(calls[1].body).toMatchObject({ tcdbSetId: "27845" });

    // Re-read the row and confirm the patch landed.
    const row = await asAdmin.query(api.selectorOptions.getSelectorOptionById, {
      id: setNameId,
    });
    expect(row).not.toBeNull();
    expect(row!.setMetadata?.tcdbSetId).toBe("27845");
    expect(row!.setMetadata?.releaseDate).toBe("2024-08-21");
    expect(row!.setMetadata?.totalCardCount).toBe(220);
    expect(row!.setMetadata?.block).toBe("Topps Chrome");
    expect(row!.setMetadata?.sourceUrl).toBe(
      "https://www.tcdb.com/Checklist.cfm/sid/27845",
    );
    expect(row!.setMetadata?.lastSyncedAt).toBeGreaterThan(0);
    expect(row!.features?.manufacturer).toBe("Topps");
    expect(row!.features?.cardType).toBe("Base");
  });

  test("uses cached tcdbSetId — skips /tcdb/search", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);
    const { setNameId } = await seedSetChain(t, {
      setMetadata: { tcdbSetId: "27845" },
    });

    const calls: string[] = [];
    const fakeFetch: FetchStub = async (url) => {
      const u = String(url);
      calls.push(u);
      if (u.endsWith("/tcdb/get-set")) {
        return jsonResponse({
          metadata: {
            tcdbSetId: "27845",
            name: "Topps Chrome",
            sourceUrl: "https://www.tcdb.com/Checklist.cfm/sid/27845",
          },
        });
      }
      throw new Error(`unexpected fetch: ${u}`);
    };
    vi.stubGlobal("fetch", fakeFetch);

    const result = await asAdmin.action(
      internal.adapters.tcdb.enrichSetFromTcdb,
      { selectorOptionId: setNameId },
    );

    expect(result.matched).toBe(true);
    expect(result.tcdbSetId).toBe("27845");
    expect(calls).toEqual([
      "http://localhost:9999/tcdb/get-set",
    ]);
  });

  test("tcdb-unavailable on search short-circuits without writing", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);
    const { setNameId } = await seedSetChain(t);

    const fakeFetch: FetchStub = async (url) => {
      if (String(url).endsWith("/tcdb/search")) {
        return jsonResponse({ matches: [], reason: "tcdb-unavailable" });
      }
      throw new Error(`unexpected fetch`);
    };
    vi.stubGlobal("fetch", fakeFetch);

    const result = await asAdmin.action(
      internal.adapters.tcdb.enrichSetFromTcdb,
      { selectorOptionId: setNameId },
    );

    expect(result.matched).toBe(false);
    expect(result.reason).toBe("tcdb-unavailable");
    expect(result.setMetadataApplied).toBe(false);
    expect(result.featuresAdded).toBe(0);

    // Confirm no setMetadata was written.
    const row = await asAdmin.query(api.selectorOptions.getSelectorOptionById, {
      id: setNameId,
    });
    expect(row!.setMetadata).toBeUndefined();
  });

  test("no confident match returns reason, writes nothing", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);
    const { setNameId } = await seedSetChain(t);

    vi.stubGlobal("fetch", (async (url: string) => {
      if (url.endsWith("/tcdb/search")) {
        return jsonResponse({ matches: [] });
      }
      throw new Error("unexpected fetch");
    }) as FetchStub);

    const result = await asAdmin.action(
      internal.adapters.tcdb.enrichSetFromTcdb,
      { selectorOptionId: setNameId },
    );

    expect(result.matched).toBe(false);
    expect(result.reason).toBe("no-confident-match");
    expect(result.setMetadataApplied).toBe(false);
  });

  test("tcdb-unavailable on get-set: returns reason, no metadata patched", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);
    const { setNameId } = await seedSetChain(t);

    vi.stubGlobal("fetch", (async (url: string) => {
      const u = String(url);
      if (u.endsWith("/tcdb/search")) {
        return jsonResponse({
          matches: [
            {
              tcdbSetId: "27845",
              name: "X",
              year: 2024,
              sport: "Baseball",
              url: "https://x",
              score: 0.95,
            },
          ],
        });
      }
      if (u.endsWith("/tcdb/get-set")) {
        return jsonResponse({ metadata: null, reason: "tcdb-unavailable" });
      }
      throw new Error("unexpected fetch");
    }) as FetchStub);

    const result = await asAdmin.action(
      internal.adapters.tcdb.enrichSetFromTcdb,
      { selectorOptionId: setNameId },
    );

    expect(result.matched).toBe(true);
    expect(result.tcdbSetId).toBe("27845");
    expect(result.setMetadataApplied).toBe(false);
    expect(result.reason).toBe("tcdb-unavailable");

    const row = await asAdmin.query(api.selectorOptions.getSelectorOptionById, {
      id: setNameId,
    });
    expect(row!.setMetadata).toBeUndefined();
  });

  test("preserves operator-set features instead of clobbering", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);
    const { setNameId } = await seedSetChain(t, {
      features: { manufacturer: "Donruss" }, // operator-set; should not change
    });

    vi.stubGlobal("fetch", (async (url: string) => {
      const u = String(url);
      if (u.endsWith("/tcdb/search")) {
        return jsonResponse({
          matches: [
            {
              tcdbSetId: "27845",
              name: "X",
              year: 2024,
              sport: "Baseball",
              url: "https://x",
              score: 0.95,
            },
          ],
        });
      }
      if (u.endsWith("/tcdb/get-set")) {
        return jsonResponse({
          metadata: {
            tcdbSetId: "27845",
            name: "X",
            sourceUrl: "https://x",
            additionalFeatures: {
              Manufacturer: "Topps", // would clobber if we weren't careful
              "Card Type": "Base", // new key — should be added
            },
          },
        });
      }
      throw new Error("unexpected fetch");
    }) as FetchStub);

    const result = await asAdmin.action(
      internal.adapters.tcdb.enrichSetFromTcdb,
      { selectorOptionId: setNameId },
    );

    expect(result.featuresAdded).toBe(1); // only cardType, not manufacturer

    const row = await asAdmin.query(api.selectorOptions.getSelectorOptionById, {
      id: setNameId,
    });
    expect(row!.features?.manufacturer).toBe("Donruss"); // preserved
    expect(row!.features?.cardType).toBe("Base");
  });

  test("non-setName-level row returns reason without calling TCDB", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);
    // Seed a variantType row; pass it directly.
    const ids = await t.run(async (ctx) => {
      const sportId = await ctx.db.insert("selectorOptions", {
        level: "sport",
        value: "Baseball",
        platformData: {},
        children: [],
        lastUpdated: Date.now(),
      });
      const variantTypeId = await ctx.db.insert("selectorOptions", {
        level: "variantType",
        value: "Base",
        platformData: {},
        parentId: sportId,
        children: [],
        lastUpdated: Date.now(),
      });
      return { variantTypeId };
    });

    let fetchCalled = false;
    vi.stubGlobal("fetch", (async () => {
      fetchCalled = true;
      throw new Error("should not be called");
    }) as FetchStub);

    const result = await asAdmin.action(
      internal.adapters.tcdb.enrichSetFromTcdb,
      { selectorOptionId: ids.variantTypeId },
    );

    expect(result.matched).toBe(false);
    expect(result.reason).toBe("not-setname-level");
    expect(fetchCalled).toBe(false);
  });

  test("network error returns tcdb-network-error without throwing", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity(ADMIN_IDENTITY);
    const { setNameId } = await seedSetChain(t);

    vi.stubGlobal("fetch", (async () => {
      throw new Error("ECONNREFUSED");
    }) as FetchStub);

    const result = await asAdmin.action(
      internal.adapters.tcdb.enrichSetFromTcdb,
      { selectorOptionId: setNameId },
    );

    expect(result.matched).toBe(false);
    expect(result.reason).toBe("tcdb-network-error");
    expect(result.setMetadataApplied).toBe(false);
  });
});
