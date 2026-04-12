"use node";

import { action, ActionCtx } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { getCurrentUserId, requireAdmin } from "../auth";
import { Id } from "../_generated/dataModel";

type Level = "sport" | "year" | "manufacturer" | "setName" | "variantType" | "insert" | "parallel";

const SPORTLOTS_BASE_URL = "https://www.sportlots.com";
const NEWINVEN_URL = `${SPORTLOTS_BASE_URL}/inven/dealbin/newinven.tpl`;
const DEALSETS_URL = `${SPORTLOTS_BASE_URL}/inven/dealbin/dealsets.tpl`;
const LISTCARDS_URL = `${SPORTLOTS_BASE_URL}/inven/dealbin/listcards.tpl`;

// Map selector levels to SportLots form field names
const LEVEL_TO_TARGET_SELECT: Record<string, string> = {
  sport: "sprt",
  year: "yr",
  manufacturer: "brd",
};

/**
 * Get stored SportLots session cookie from credentials.
 * Same pattern as getBscToken in buysportscards.ts.
 */
async function getSportLotsCookie(ctx: ActionCtx): Promise<string | null> {
  const tokenResult = await ctx.runAction(
    api.credentials.getSiteToken,
    { site: "sportlots" },
  );
  return tokenResult?.token || null;
}

/**
 * Check if a response body indicates a stale/expired session.
 */
function isSessionExpired(html: string): boolean {
  return html.includes("login.tpl") || html.includes("signin.tpl");
}

/**
 * Parse <option> elements from an HTML <select> element.
 * SportLots uses unclosed option tags: <Option value="BB">Baseball
 */
function parseSelectOptions(
  html: string,
  selectName: string,
): Array<{ value: string; label: string }> {
  const selectRegex = new RegExp(
    `<select[^>]*name="${selectName}"[^>]*>([\\s\\S]*?)<\\/select>`,
    "i",
  );
  const selectMatch = html.match(selectRegex);

  if (!selectMatch) {
    console.log(
      `[parseSelectOptions] No select element found for name="${selectName}"`,
    );
    return [];
  }

  const selectContent = selectMatch[1];

  // Fixed regex: SportLots uses unclosed <Option> tags, capture label up to newline or next tag
  const optionRegex = /<Option\s+value="([^"]*)"[^>]*>\s*([^\n<]+)/gi;
  const options: Array<{ value: string; label: string }> = [];
  let match;

  while ((match = optionRegex.exec(selectContent)) !== null) {
    const value = match[1].trim();
    const label = match[2].trim();

    if (value && label && value !== "" && label !== "Select") {
      options.push({ value, label });
    }
  }

  return options;
}

/**
 * Resolve a display value (e.g., "Baseball") to a SportLots platform value (e.g., "BB")
 * by looking up the selectorOptions table.
 */
async function resolveSportLotsPlatformValue(
  ctx: ActionCtx,
  level: Level,
  displayValue: string,
  parentId?: Id<"selectorOptions">,
): Promise<string> {
  try {
    const option: any = await ctx.runQuery(
      api.selectorOptions.findByLevelAndValue,
      { level, value: displayValue, parentId },
    );
    return option?.platformData?.sportlots || displayValue;
  } catch {
    return displayValue;
  }
}

/**
 * Fetch selector options from SportLots via HTTP
 */
export const fetchSportLotsSelectorOptions = action({
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
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    try {
      const sessionCookie = await getSportLotsCookie(ctx);
      if (!sessionCookie) {
        return {
          success: false,
          options: [],
          message: "No SportLots session cookie. Re-authenticate from Profile.",
        };
      }

      // variantType level: SportLots doesn't have variants in its flow
      if (args.level === "variantType") {
        return { success: true, options: [] };
      }

      // setName level: uses the multi-page dealsets flow
      if (args.level === "setName") {
        return await fetchSetNames(ctx, sessionCookie, args.parentFilters);
      }

      // sport, year, manufacturer: POST to newinven.tpl and parse select options
      const formData = new URLSearchParams();

      // Resolve display values to platform values for parent filters
      if (args.parentFilters.sport) {
        const platformSport = await resolveSportLotsPlatformValue(ctx, "sport", args.parentFilters.sport);
        formData.set("sprt", platformSport);
      }
      if (args.parentFilters.year) {
        const platformYear = await resolveSportLotsPlatformValue(ctx, "year", args.parentFilters.year);
        formData.set("yr", platformYear);
      }
      if (args.parentFilters.manufacturer) {
        const platformBrand = await resolveSportLotsPlatformValue(ctx, "manufacturer", args.parentFilters.manufacturer);
        formData.set("brd", platformBrand);
      }

      const response = await fetch(NEWINVEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: sessionCookie,
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        return {
          success: false,
          options: [],
          message: `SportLots HTTP error: ${response.status}`,
        };
      }

      const html = await response.text();

      if (isSessionExpired(html)) {
        return {
          success: false,
          options: [],
          message: "SportLots session expired. Re-authenticate from Profile.",
        };
      }

      const targetSelect = LEVEL_TO_TARGET_SELECT[args.level];
      if (!targetSelect) {
        return {
          success: false,
          options: [],
          message: `Unknown level: ${args.level}`,
        };
      }

      const parsedOptions = parseSelectOptions(html, targetSelect);

      return {
        success: true,
        options: parsedOptions.map((o) => ({
          value: o.label,
          platformValue: o.value,
        })),
      };
    } catch (error) {
      console.error("[fetchSportLotsSelectorOptions] Error:", error);
      return {
        success: false,
        options: [],
        message: `SportLots error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * Fetch set names from SportLots using the dealsets.tpl multi-page flow.
 * 1. POST to newinven.tpl with sport/year/brand + required fields
 * 2. POST to dealsets.tpl — returns radio buttons for sets
 * 3. Parse radio buttons and return set name + radio ID
 */
async function fetchSetNames(
  ctx: ActionCtx,
  sessionCookie: string,
  parentFilters: {
    sport?: string;
    year?: string;
    manufacturer?: string;
  },
): Promise<{ success: boolean; options: Array<{ value: string; platformValue: string }>; message?: string }> {
  // Resolve display values to platform values
  let platformSport = "";
  let platformYear = "";
  let platformBrand = "";

  if (parentFilters.sport) {
    platformSport = await resolveSportLotsPlatformValue(ctx, "sport", parentFilters.sport);
  }
  if (parentFilters.year) {
    platformYear = await resolveSportLotsPlatformValue(ctx, "year", parentFilters.year);
  }
  if (parentFilters.manufacturer) {
    platformBrand = await resolveSportLotsPlatformValue(ctx, "manufacturer", parentFilters.manufacturer);
  }

  const commonFields: Record<string, string> = {
    sprt: platformSport,
    yr: platformYear,
    brd: platformBrand,
    dcond: "NM",
    dbin: "1",
    dval: "0.18",
    dentry: "ADD",
    pricing: "OLD",
  };

  // POST to dealsets.tpl to get set radio buttons
  const formData = new URLSearchParams(commonFields);
  const response = await fetch(DEALSETS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: sessionCookie,
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    return {
      success: false,
      options: [],
      message: `SportLots dealsets HTTP error: ${response.status}`,
    };
  }

  const html = await response.text();

  if (isSessionExpired(html)) {
    return {
      success: false,
      options: [],
      message: "SportLots session expired. Re-authenticate from Profile.",
    };
  }

  // Parse radio buttons: <input type="radio" Name="selset" Value="12345"> </td> <td>123  Set Name Here</td>
  const radioRegex = /<input\s+type="radio"\s+Name="selset"\s+Value="(\d+)"[^>]*>\s*<\/td>\s*<td>\d+\s+([^<]+)<\/td>/gi;
  const options: Array<{ value: string; platformValue: string }> = [];
  let match;

  while ((match = radioRegex.exec(html)) !== null) {
    const radioId = match[1].trim();
    let setName = match[2].trim();

    // Strip brand prefix from set name if present
    if (parentFilters.manufacturer) {
      const brandPrefix = parentFilters.manufacturer.trim();
      if (setName.startsWith(brandPrefix)) {
        setName = setName.substring(brandPrefix.length).trim();
      }
    }

    if (radioId && setName) {
      options.push({ value: setName, platformValue: radioId });
    }
  }

  return {
    success: true,
    options,
    message: `Found ${options.length} sets from SportLots`,
  };
}

/**
 * Fetch card checklist from SportLots for a specific set
 */
export const fetchSportLotsChecklist = action({
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
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    try {
      const sessionCookie = await getSportLotsCookie(ctx);
      if (!sessionCookie) {
        return {
          success: false,
          cards: [],
          message: "No SportLots session cookie. Re-authenticate from Profile.",
        };
      }

      // Look up the set's platformData.sportlots (the radio button ID) from the database
      let setRadioId = args.parentFilters.setName || "";

      // Try to resolve from selectorOptions if it's a display name
      if (args.parentFilters.setName) {
        const platformValue = await resolveSportLotsPlatformValue(
          ctx, "setName", args.parentFilters.setName,
        );
        if (platformValue !== args.parentFilters.setName) {
          setRadioId = platformValue;
        }
      }

      if (!setRadioId) {
        return {
          success: false,
          cards: [],
          message: "No set identifier available for SportLots",
        };
      }

      // POST to listcards.tpl with the set radio ID
      const formData = new URLSearchParams({
        selset: setRadioId,
        dcond: "NM",
        dbin: "1",
        dval: "0.18",
        dentry: "ADD",
        pricing: "OLD",
        start: "1",
      });

      const response = await fetch(LISTCARDS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: sessionCookie,
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        return {
          success: false,
          cards: [],
          message: `SportLots HTTP error: ${response.status}`,
        };
      }

      const html = await response.text();

      if (isSessionExpired(html)) {
        return {
          success: false,
          cards: [],
          message: "SportLots session expired. Re-authenticate from Profile.",
        };
      }

      // Parse card table rows
      // Pattern: <td class="smallleft">CARD_NUMBER</td> ... <td class="smallleft">DESCRIPTION</td>
      const cardRegex = /<td class="smallleft">([^<]+)<\/td>\s*<td class="smallleft">([^<]+)<\/td>/gi;
      const cards: Array<{
        cardNumber: string;
        cardName: string;
        team?: string;
        platformRef?: string;
      }> = [];
      let match;

      while ((match = cardRegex.exec(html)) !== null) {
        const cardNumber = match[1].trim();
        const fullDescription = match[2].trim();

        if (!cardNumber || !fullDescription) continue;

        // Extract player name from description
        // Description format often includes the card number prefix, take text after it
        let cardName = fullDescription;
        const numberInDesc = fullDescription.indexOf(`#${cardNumber}`);
        if (numberInDesc !== -1) {
          cardName = fullDescription.substring(numberInDesc + cardNumber.length + 1).trim();
        }

        // Fallback: if cardName is still the full description, just use it
        if (!cardName) cardName = fullDescription;

        cards.push({
          cardNumber,
          cardName,
          platformRef: cardNumber,
        });
      }

      return {
        success: true,
        cards,
        message: `Found ${cards.length} cards from SportLots`,
      };
    } catch (error) {
      console.error("[fetchSportLotsChecklist] Error:", error);
      return {
        success: false,
        cards: [],
        message: `SportLots error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * Test SportLots credentials by checking stored cookie validity.
 */
export const testCredentials = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    details: v.optional(v.string()),
  }),
  handler: async (
    ctx,
  ): Promise<{ success: boolean; message: string; details?: string }> => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      return {
        success: false,
        message: "Not authenticated",
        details: "Please sign in to test credentials",
      };
    }

    const sessionCookie = await getSportLotsCookie(ctx);

    if (!sessionCookie) {
      return {
        success: false,
        message: "No SportLots session cookie found",
        details:
          "Please authenticate your SportLots account from Profile.",
      };
    }

    try {
      // Validate by fetching a protected page
      const response = await fetch(NEWINVEN_URL, {
        method: "GET",
        headers: { Cookie: sessionCookie },
      });

      const html = await response.text();

      if (isSessionExpired(html)) {
        return {
          success: false,
          message: "SportLots session expired",
          details: "Re-authenticate from Profile to get a fresh session cookie.",
        };
      }

      return {
        success: true,
        message: "SportLots session is active",
        details: "Session cookie is valid.",
      };
    } catch (error) {
      console.error("Error testing Sportlots credentials:", error);
      return {
        success: false,
        message: "Failed to test Sportlots credentials",
        details: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
