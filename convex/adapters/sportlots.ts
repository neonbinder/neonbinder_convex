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

const SL_FETCH_TIMEOUT_MS = 30_000;

async function slFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(SL_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(
        `SportLots request timed out after ${SL_FETCH_TIMEOUT_MS / 1000}s: ${url}`,
      );
    }
    throw err;
  }
}

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
    // Pre-resolved SportLots platform values keyed by level (e.g., { sport: "BB", year: "2024" }).
    // When provided, these are used directly instead of resolving via DB lookup.
    platformFilters: v.optional(v.record(v.string(), v.string())),
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

      // setName and variantType: BSC-only levels in NB's hierarchy.
      // SL doesn't have separate set or variant-type concepts.
      if (args.level === "setName" || args.level === "variantType") {
        return { success: true, options: [] };
      }

      // insert level (NB "Variant"): SL's dealsets.tpl set list maps here.
      // SL combines set+variant into a flat list of set names.
      if (args.level === "insert") {
        return await fetchSetNames(ctx, sessionCookie, args.parentFilters, args.platformFilters);
      }

      // sport, year, manufacturer: POST to newinven.tpl and parse select options
      const formData = new URLSearchParams();

      // Use pre-resolved platform slugs when available, otherwise fall back to DB lookup
      if (args.parentFilters.sport) {
        const platformSport = args.platformFilters?.sport
          ?? await resolveSportLotsPlatformValue(ctx, "sport", args.parentFilters.sport);
        formData.set("sprt", platformSport);
      }
      if (args.parentFilters.year) {
        const platformYear = args.platformFilters?.year
          ?? await resolveSportLotsPlatformValue(ctx, "year", args.parentFilters.year);
        formData.set("yr", platformYear);
      }
      if (args.parentFilters.manufacturer) {
        const platformBrand = args.platformFilters?.manufacturer
          ?? await resolveSportLotsPlatformValue(ctx, "manufacturer", args.parentFilters.manufacturer);
        formData.set("brd", platformBrand);
      }

      const response = await slFetch(NEWINVEN_URL, {
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
  platformFilters?: Record<string, string>,
): Promise<{ success: boolean; options: Array<{ value: string; platformValue: string }>; message?: string }> {
  // Use pre-resolved platform slugs when available, otherwise fall back to DB lookup
  let platformSport = "";
  let platformYear = "";
  let platformBrand = "";

  if (parentFilters.sport) {
    platformSport = platformFilters?.sport
      ?? await resolveSportLotsPlatformValue(ctx, "sport", parentFilters.sport);
  }
  if (parentFilters.year) {
    platformYear = platformFilters?.year
      ?? await resolveSportLotsPlatformValue(ctx, "year", parentFilters.year);
  }
  if (parentFilters.manufacturer) {
    platformBrand = platformFilters?.manufacturer
      ?? await resolveSportLotsPlatformValue(ctx, "manufacturer", parentFilters.manufacturer);
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
  const response = await slFetch(DEALSETS_URL, {
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
 * Tokenize a SportLots card description for known attribute markers.
 * Returns the tokens to lift onto attributes[], the printRun if present,
 * and the residual text (description with markers stripped) for use as
 * cardName.
 *
 * SL descriptions are free-form ("Mike Trout LAA RC", "Aaron Judge AU /99");
 * we conservatively detect only well-known tokens to avoid corrupting
 * cardName with false positives. Team extraction is intentionally NOT
 * attempted here — SL's 2-3 letter team abbreviations vary by sport and
 * BSC supplies the canonical team in the merged record anyway.
 */
function tokenizeSlDescription(desc: string): {
  attributes: string[];
  printRun?: number;
  residual: string;
} {
  const attributes: string[] = [];
  let printRun: number | undefined;
  let residual = desc;

  // /N print run pattern (e.g. "/99", "/150"). Strip from residual.
  const numMatch = residual.match(/\/(\d{1,5})\b/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    if (Number.isFinite(n)) {
      printRun = n;
      attributes.push("NUM");
    }
    residual = residual.replace(numMatch[0], "");
  }

  // Token pattern: case-insensitive whole-word match on known markers.
  // Order matters — match longer tokens first to avoid AU shadowing AUTO.
  const tokenMap: Array<[RegExp, string]> = [
    [/\bAUTO\b/i, "AU"],
    [/\bAU\b/i, "AU"],
    [/\bROOKIE\b/i, "RC"],
    [/\bRC\b/i, "RC"],
    [/\bRELIC\b/i, "RELIC"],
    [/\bPATCH\b/i, "RELIC"],
    [/\bJSY\b/i, "RELIC"],
    [/\bJERSEY\b/i, "RELIC"],
    [/\bSP\b/i, "SP"],
    [/\bSSP\b/i, "SSP"],
  ];
  for (const [pattern, token] of tokenMap) {
    if (pattern.test(residual)) {
      if (!attributes.includes(token)) attributes.push(token);
      residual = residual.replace(pattern, "");
    }
  }

  residual = residual.replace(/\s+/g, " ").trim();
  return { attributes, printRun, residual };
}

/**
 * Fetch card checklist from SportLots for a specific set.
 *
 * Returns rows in the same shape as fetchBscChecklist (most rich fields
 * left empty since SL's HTML doesn't expose structured per-card metadata).
 * The reconciler in fetchCardChecklist merges a SL row's attributes into
 * the BSC row when card numbers match — so even sparse SL data still
 * cross-validates the BSC scrape.
 */
export const fetchSportLotsChecklist = action({
  args: {
    parentFilters: v.record(v.string(), v.string()),
    // Pre-resolved SportLots platform values keyed by level.
    platformFilters: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.object({
    success: v.boolean(),
    cards: v.array(
      v.object({
        cardNumber: v.string(),
        cardName: v.string(),
        team: v.optional(v.string()),
        teams: v.optional(v.array(v.string())),
        players: v.optional(v.array(v.string())),
        attributes: v.optional(v.array(v.string())),
        printRun: v.optional(v.number()),
        autographType: v.optional(v.string()),
        cardVariation: v.optional(v.string()),
        platformRef: v.optional(v.string()),
        sportlotsRef: v.optional(v.string()),
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

      // Look up the set's platformData.sportlots (the radio button ID)
      let setRadioId = args.platformFilters?.setName || args.parentFilters.setName || "";

      // Fall back to DB lookup if we don't have a pre-resolved platform value
      if (!args.platformFilters?.setName && args.parentFilters.setName) {
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

      const response = await slFetch(LISTCARDS_URL, {
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
        teams?: string[];
        players?: string[];
        attributes?: string[];
        printRun?: number;
        autographType?: string;
        cardVariation?: string;
        platformRef?: string;
        sportlotsRef?: string;
      }> = [];
      let match;

      while ((match = cardRegex.exec(html)) !== null) {
        const cardNumber = match[1].trim();
        const fullDescription = match[2].trim();

        if (!cardNumber || !fullDescription) continue;

        // Strip a leading "#NNN" if the description echoes the card number,
        // then run the token tokenizer to lift attributes / print run.
        let working = fullDescription;
        const echo = working.indexOf(`#${cardNumber}`);
        if (echo !== -1) {
          working = working.substring(echo + cardNumber.length + 1).trim();
        }

        const { attributes, printRun, residual } = tokenizeSlDescription(working);
        const cardName = residual || fullDescription;

        cards.push({
          cardNumber,
          cardName,
          attributes: attributes.length ? attributes : undefined,
          printRun,
          autographType: attributes.includes("AU") ? "Unknown" : undefined,
          platformRef: cardNumber,
          sportlotsRef: cardNumber,
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
      const response = await slFetch(NEWINVEN_URL, {
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
