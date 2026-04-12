"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

// Real BSC filter endpoint (ported from cardlister-server/script-frontend/src/listing-sites/bsc.ts).
// The earlier www.buysportscards.com URL was a webpage path, not an API — CloudFront returned 403.
const BSC_API_BASE = "https://api-prod.buysportscards.com";
const BSC_FILTERS_PATH = "/search/bulk-upload/filters";

// Map our levels to BSC API aggregation keys. BSC does NOT expose a
// `manufacturer` aggregation — manufacturer is embedded in setName. Leaving
// it out means fetchAggregatedOptions will simply get no BSC contribution
// at the manufacturer level, which is correct.
const LEVEL_TO_BSC_FACET: Record<string, string> = {
  sport: "sport",
  year: "year",
  setName: "setName",
  variantType: "variant",
};

// Browser-mimicking headers required by the BSC API (without these CloudFront
// rejects requests as bot traffic). `assumedrole: sellers` is mandatory and
// scopes the session to a seller context.
function bscHeaders(bearerToken: string): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    assumedrole: "sellers",
    "content-type": "application/json",
    origin: "https://www.buysportscards.com",
    referer: "https://www.buysportscards.com/",
    "Sec-Ch-Ua":
      '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": "macOS",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    authority: "api-prod.buysportscards.com",
    authorization: `Bearer ${bearerToken}`,
  };
}

/**
 * Get BSC bearer token from Secret Manager (browser service extraction)
 */
export const getBscToken = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    token: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx): Promise<{ success: boolean; token?: string; error?: string }> => {
    try {
      const tokenResult = await ctx.runAction(
        api.credentials.getSiteToken,
        { site: "buysportscards" },
      );

      if (tokenResult?.token) {
        return { success: true, token: tokenResult.token };
      }

      return {
        success: false,
        error: "No BSC token available. Connect your BSC account first.",
      };
    } catch (error) {
      console.error("[getBscToken] Error:", error);
      return {
        success: false,
        error: `Failed to get BSC token: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * Call the BSC bulk-upload API to get available filter options for a level
 */
export const fetchBscSelectorOptions = action({
  args: {
    level: v.string(),
    parentFilters: v.object({
      sport: v.optional(v.string()),
      year: v.optional(v.string()),
      manufacturer: v.optional(v.string()),
      setName: v.optional(v.string()),
      variantType: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    options: v.array(
      v.object({
        value: v.string(),
        platformValue: v.string(),
      }),
    ),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; options: Array<{ value: string; platformValue: string }>; message?: string }> => {
    try {
      // Get BSC token
      const tokenResult: { success: boolean; token?: string; error?: string } = await ctx.runAction(
        api.adapters.buysportscards.getBscToken,
        {},
      );

      if (!tokenResult.success || !tokenResult.token) {
        return {
          success: false,
          options: [],
          message: tokenResult.error || "No BSC token available",
        };
      }

      // Build nested filters matching the BSC bulk-upload/filters shape.
      // BSC expects `{ filters: { sport: [...], year: [...], setName: [...], variant: [...] } }`.
      // Manufacturer is not a BSC facet — it's embedded in setName — so we
      // drop that parent filter rather than sending an invalid key.
      const filters: Record<string, string[]> = {};
      if (args.parentFilters.sport) {
        filters.sport = [args.parentFilters.sport];
      }
      if (args.parentFilters.year) {
        filters.year = [args.parentFilters.year];
      }
      if (args.parentFilters.setName) {
        filters.setName = [args.parentFilters.setName];
      }
      if (args.parentFilters.variantType) {
        filters.variant = [args.parentFilters.variantType];
      }

      const facetKey = LEVEL_TO_BSC_FACET[args.level];
      if (!facetKey) {
        return {
          success: false,
          options: [],
          message: `BSC has no aggregation for level: ${args.level}`,
        };
      }

      const response = await fetch(`${BSC_API_BASE}${BSC_FILTERS_PATH}`, {
        method: "POST",
        headers: bscHeaders(tokenResult.token),
        body: JSON.stringify({ filters }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error(
          `[fetchBscSelectorOptions] BSC API ${response.status}: ${errText.slice(0, 300)}`,
        );
        return {
          success: false,
          options: [],
          message: `BSC API error: ${response.status}`,
        };
      }

      // Response shape: { aggregations: { sport: Filter[], year: Filter[], ... } }
      // where Filter = { label: string, slug: string, count: number, active: boolean }
      const data = await response.json() as {
        aggregations?: Record<
          string,
          Array<{ label?: string; slug?: string; count?: number; active?: boolean }>
        >;
      };
      const levelFacet = data.aggregations?.[facetKey] ?? [];

      const options: Array<{ value: string; platformValue: string }> = [];
      for (const item of levelFacet) {
        // Skip facet entries with zero inventory — BSC returns them but
        // they're not actually available options.
        if (typeof item.count === "number" && item.count <= 0) continue;
        const label = item.label?.trim();
        const slug = item.slug?.trim();
        if (!label || !slug) continue;
        options.push({
          value: label,
          platformValue: slug,
        });
      }

      return {
        success: true,
        options,
        message: `Found ${options.length} ${args.level} options from BSC`,
      };
    } catch (error) {
      console.error("[fetchBscSelectorOptions] Error:", error);
      return {
        success: false,
        options: [],
        message: `BSC error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * Fetch card checklist from BSC for a specific set
 */
export const fetchBscChecklist = action({
  args: {
    parentFilters: v.record(v.string(), v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    cards: v.array(
      v.object({
        cardNumber: v.string(),
        cardName: v.string(),
        team: v.optional(v.string()),
        platformRef: v.optional(v.string()),
      }),
    ),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; cards: Array<{ cardNumber: string; cardName: string; team?: string; platformRef?: string }>; message?: string }> => {
    try {
      const tokenResult: { success: boolean; token?: string; error?: string } = await ctx.runAction(
        api.adapters.buysportscards.getBscToken,
        {},
      );

      if (!tokenResult.success || !tokenResult.token) {
        return {
          success: false,
          cards: [],
          message: tokenResult.error || "No BSC token available",
        };
      }

      // Build filters from parent filters
      const filters: Record<string, string[]> = {};
      if (args.parentFilters.sport) {
        filters.sport = [args.parentFilters.sport.toLowerCase()];
      }
      if (args.parentFilters.year) {
        filters.year = [args.parentFilters.year];
      }
      if (args.parentFilters.manufacturer) {
        filters.manufacturer = [args.parentFilters.manufacturer];
      }
      if (args.parentFilters.setName) {
        filters.setName = [args.parentFilters.setName];
      }
      if (args.parentFilters.variantType) {
        filters.variant = [args.parentFilters.variantType];
      }

      // TODO(BSC-card-checklist): port this to the real endpoint used by
      // cardlister-server/script-frontend/src/listing-sites/bsc.ts#getBSCCards —
      // POST {BSC_API_BASE}/search/seller/results with a seller-scoped body.
      // Blocked on obtaining the current user's BSC sellerId. Leaving the
      // previous call shape behind a constant so the file compiles; this
      // function is not exercised by the smoke test and is known-broken.
      const BSC_LEGACY_CHECKLIST_URL =
        "https://www.buysportscards.com/seller/bulk-upload/results";
      const response = await fetch(BSC_LEGACY_CHECKLIST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenResult.token}`,
        },
        body: JSON.stringify({
          condition: "near_mint",
          currentListings: false,
          productType: "raw",
          filters,
          page: 1,
          pageSize: 500, // Get as many cards as possible
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          cards: [],
          message: `BSC API error: ${response.status}`,
        };
      }

      const data = await response.json();
      const results = data.results || data.cards || [];
      const cards: Array<{
        cardNumber: string;
        cardName: string;
        team?: string;
        platformRef?: string;
      }> = [];

      for (const result of results) {
        const cardNumber =
          result.cardNumber ||
          result.number ||
          result.cardNo ||
          "";
        const cardName =
          result.playerName ||
          result.name ||
          result.cardName ||
          result.title ||
          "";

        if (cardNumber) {
          cards.push({
            cardNumber: String(cardNumber),
            cardName: cardName || `Card #${cardNumber}`,
            team: result.team || result.teamName,
            platformRef: result.id || result.productId,
          });
        }
      }

      return {
        success: true,
        cards,
        message: `Found ${cards.length} cards from BSC`,
      };
    } catch (error) {
      console.error("[fetchBscChecklist] Error:", error);
      return {
        success: false,
        cards: [],
        message: `BSC error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

// Keep the legacy getAvailableSetParameters for backward compatibility during migration
export const getAvailableSetParameters = action({
  args: {
    partialParams: v.optional(
      v.object({
        sport: v.optional(v.string()),
        year: v.optional(v.number()),
        manufacturer: v.optional(v.string()),
        setName: v.optional(v.string()),
        variantType: v.optional(
          v.union(
            v.literal("base"),
            v.literal("parallel"),
            v.literal("insert"),
            v.literal("parallel_of_insert"),
          ),
        ),
      }),
    ),
  },
  returns: v.object({
    availableOptions: v.object({
      sports: v.optional(
        v.array(
          v.object({
            site: v.string(),
            values: v.array(
              v.object({ label: v.string(), value: v.string() }),
            ),
          }),
        ),
      ),
      years: v.optional(
        v.array(
          v.object({
            site: v.string(),
            values: v.array(
              v.object({ label: v.string(), value: v.string() }),
            ),
          }),
        ),
      ),
      manufacturers: v.optional(
        v.array(
          v.object({
            site: v.string(),
            values: v.array(
              v.object({ label: v.string(), value: v.string() }),
            ),
          }),
        ),
      ),
      setNames: v.optional(
        v.array(
          v.object({
            site: v.string(),
            values: v.array(
              v.object({ label: v.string(), value: v.string() }),
            ),
          }),
        ),
      ),
      variantNames: v.optional(
        v.array(
          v.object({
            site: v.string(),
            values: v.array(
              v.object({ label: v.string(), value: v.string() }),
            ),
          }),
        ),
      ),
    }),
    currentParams: v.optional(
      v.object({
        sport: v.optional(v.string()),
        year: v.optional(v.number()),
        manufacturer: v.optional(v.string()),
        setName: v.optional(v.string()),
        variantType: v.optional(
          v.union(
            v.literal("base"),
            v.literal("parallel"),
            v.literal("insert"),
            v.literal("parallel_of_insert"),
          ),
        ),
      }),
    ),
  }),
  handler: async (ctx, args): Promise<any> => {
    // Delegate to the new fetchBscSelectorOptions for actual data
    // This wrapper maintains backward compatibility
    const parentFilters: Record<string, string> = {};
    if (args.partialParams?.sport)
      parentFilters.sport = args.partialParams.sport;
    if (args.partialParams?.year)
      parentFilters.year = String(args.partialParams.year);
    if (args.partialParams?.manufacturer)
      parentFilters.manufacturer = args.partialParams.manufacturer;
    if (args.partialParams?.setName)
      parentFilters.setName = args.partialParams.setName;
    if (args.partialParams?.variantType)
      parentFilters.variantType = args.partialParams.variantType;

    // Determine which level to fetch
    let level = "sport";
    if (args.partialParams?.sport && !args.partialParams?.year)
      level = "year";
    else if (args.partialParams?.year && !args.partialParams?.manufacturer)
      level = "manufacturer";
    else if (
      args.partialParams?.manufacturer &&
      !args.partialParams?.setName
    )
      level = "setName";
    else if (
      args.partialParams?.setName &&
      !args.partialParams?.variantType
    )
      level = "variantType";

    const result: { success: boolean; options: Array<{ value: string; platformValue: string }>; message?: string } = await ctx.runAction(
      api.adapters.buysportscards.fetchBscSelectorOptions,
      {
        level,
        parentFilters: {
          sport: parentFilters.sport,
          year: parentFilters.year,
          manufacturer: parentFilters.manufacturer,
          setName: parentFilters.setName,
          variantType: parentFilters.variantType,
        },
      },
    );

    // Convert to legacy format
    const availableOptions: Record<string, unknown> = {};
    const levelToKey: Record<string, string> = {
      sport: "sports",
      year: "years",
      manufacturer: "manufacturers",
      setName: "setNames",
      variantType: "variantNames",
    };

    const key = levelToKey[level];
    if (key && result.options.length > 0) {
      availableOptions[key] = [
        {
          site: "BSC",
          values: result.options.map((o: { value: string; platformValue: string }) => ({
            label: o.value,
            value: o.platformValue,
          })),
        },
      ];
    }

    return {
      availableOptions: availableOptions as any,
      currentParams: args.partialParams,
    };
  },
});
