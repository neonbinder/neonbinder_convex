"use node";

import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { GoogleAuth, IdTokenClient } from "google-auth-library";
import {
  TCDB_FEATURE_KEY_MAP,
  mapTcdbResponseToSetData,
  type TcdbRawMetadata,
} from "../features/tcdbMapping";

/**
 * NEO-24 Stage 3b — TCDB enrichment adapter.
 *
 * `enrichSetFromTcdb` is an internal action invoked (typically via
 * `ctx.scheduler.runAfter(0, ...)`) from setName-level sync paths in
 * `selectorOptions.ts` / `setReconciliation.ts`. It calls the
 * neonbinder_browser Cloud Run service's Puppeteer-backed TCDB routes
 * to:
 *
 *   1. find the most likely TCDB SID for a setName row (if not cached)
 *   2. fetch the set's metadata (release date, totalCardCount, block,
 *      sourceUrl, additionalFeatures)
 *   3. patch `selectorOptions.setMetadata` with that data
 *   4. fill any missing `selectorOptions.features[key]` for known feature
 *      keys (without clobbering admin-set values)
 *
 * The action is intentionally tolerant of TCDB outages — when the
 * browser service reports `tcdb-unavailable` (Cloudflare interstitial),
 * we return a structured failure instead of throwing. The triggering
 * sync flow stays responsive; Stage 4's SetFeaturesPanel will surface
 * the missing fields to the operator.
 *
 * Auth: this action talks to a Cloud Run service that gates with IAM.
 * We mint an OIDC ID token (audience = service URL) via the
 * neonbinder-convex service account, same pattern as `credentials.ts`'s
 * `/login/bsc`, `/login/sportlots`, and `/credentials/*` calls.
 */

// TODO: swap to unsuffixed dev URL once browser PR #32 merges
const TCDB_BROWSER_URL =
  process.env.NEONBINDER_TCDB_URL ||
  "https://pr-32---neonbinder-browser-xxlo66yxuq-uc.a.run.app";

const TCDB_FETCH_TIMEOUT_MS = 30_000;
const MIN_MATCH_SCORE = 0.7;

// `TCDB_FEATURE_KEY_MAP` (TCDB label → NeonBinder feature key) is now shared
// from ../features/tcdbMapping and imported above. Keep the import so the
// legacy `enrichSetFromTcdb` backfill keeps the same mapping semantics.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

let cachedIdTokenClient: { audience: string; client: IdTokenClient } | null =
  null;

async function getIdTokenClient(
  audience: string,
): Promise<IdTokenClient | null> {
  if (!audience.startsWith("https://")) {
    let host = "";
    try {
      host = new URL(audience).hostname;
    } catch {
      throw new Error(`TCDB_BROWSER_URL is not a valid URL: ${audience}`);
    }
    if (LOOPBACK_HOSTS.has(host)) return null;
    throw new Error(
      `TCDB_BROWSER_URL must use https:// for non-loopback hosts; got ${audience}.`,
    );
  }

  if (cachedIdTokenClient && cachedIdTokenClient.audience === audience) {
    return cachedIdTokenClient.client;
  }

  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64;
  if (!b64) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_B64 not set — required to authenticate to the browser service",
    );
  }
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const auth = new GoogleAuth({ credentials });
  const client = await auth.getIdTokenClient(audience);
  cachedIdTokenClient = { audience, client };
  return client;
}

async function tcdbAuthHeaders(): Promise<Record<string, string>> {
  const client = await getIdTokenClient(TCDB_BROWSER_URL);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!client) return headers;
  const authHeaders = await client.getRequestHeaders();
  for (const [k, val] of Object.entries(authHeaders)) {
    if (typeof val === "string") headers[k] = val;
  }
  return headers;
}

async function tcdbFetch(path: string, body: unknown): Promise<Response> {
  return await fetch(`${TCDB_BROWSER_URL}${path}`, {
    method: "POST",
    headers: await tcdbAuthHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TCDB_FETCH_TIMEOUT_MS),
  });
}

type TcdbSearchMatch = {
  tcdbSetId: string;
  name: string;
  year: number;
  sport: string;
  url: string;
  score: number;
};

// Raw /tcdb/get-set metadata shape — aliased to the shared type from the pure
// mapper module so the two never drift.
type TcdbMetadata = TcdbRawMetadata;

// ===========================================================================
// NEO-38: in-band TCDB fetch (concurrent with BSC/SL during the preview).
// ===========================================================================

/**
 * Public action conforming to the BSC/SL adapter shape. Given a set's
 * `{ sport, year, setName }`, it:
 *   1. POST /tcdb/search → pick the highest-confidence match (≥ MIN_MATCH_SCORE)
 *   2. POST /tcdb/get-set → pull the set metadata
 *   3. map the result to `{ setMetadata, features }` via the pure mapper
 *
 * NEVER throws. On Cloudflare interstitial (`reason: "tcdb-unavailable"`), HTTP
 * error, network/timeout, or no confident match, returns
 * `{ success: false, tcdbUnavailable: true, message }` so the caller's
 * `Promise.allSettled` fan-out treats TCDB as best-effort. (We set
 * `tcdbUnavailable: true` for any non-success so the preview can show a single
 * "TCDB data unavailable" affordance regardless of the specific reason.)
 */
export const fetchTcdbSetData = action({
  args: {
    sport: v.string(),
    year: v.string(),
    setName: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    tcdbUnavailable: v.boolean(),
    message: v.optional(v.string()),
    setMetadata: v.optional(
      v.object({
        releaseDate: v.optional(v.string()),
        totalCardCount: v.optional(v.number()),
        block: v.optional(v.string()),
        tcdbSetId: v.optional(v.string()),
        sourceUrl: v.optional(v.string()),
        lastSyncedAt: v.optional(v.number()),
      }),
    ),
    features: v.optional(v.record(v.string(), v.string())),
  }),
  handler: async (
    _ctx,
    args,
  ): Promise<{
    success: boolean;
    tcdbUnavailable: boolean;
    message?: string;
    setMetadata?: {
      releaseDate?: string;
      totalCardCount?: number;
      block?: string;
      tcdbSetId?: string;
      sourceUrl?: string;
      lastSyncedAt?: number;
    };
    features?: Record<string, string>;
  }> => {
    // Parse a numeric year for the /tcdb/search contract (it expects a number).
    const yearNum = (() => {
      const m = args.year.match(/\d{4}/);
      return m ? parseInt(m[0], 10) : NaN;
    })();
    try {
      // ----- 1. search -----
      const searchResp = await tcdbFetch("/tcdb/search", {
        sport: args.sport,
        year: Number.isFinite(yearNum) ? yearNum : args.year,
        setName: args.setName,
      });
      if (!searchResp.ok) {
        return {
          success: false,
          tcdbUnavailable: true,
          message: `tcdb-search-http-${searchResp.status}`,
        };
      }
      const searchJson = (await searchResp.json()) as {
        matches?: TcdbSearchMatch[];
        reason?: string;
      };
      if (searchJson.reason === "tcdb-unavailable") {
        return { success: false, tcdbUnavailable: true, message: "tcdb-unavailable" };
      }
      const matches = (searchJson.matches ?? []).filter(
        (m) => typeof m.score === "number" && m.score >= MIN_MATCH_SCORE,
      );
      if (matches.length === 0) {
        return {
          success: false,
          tcdbUnavailable: true,
          message: "no-confident-match",
        };
      }
      matches.sort((a, b) => b.score - a.score);
      const tcdbSetId = matches[0].tcdbSetId;

      // ----- 2. get-set -----
      const getResp = await tcdbFetch("/tcdb/get-set", { tcdbSetId });
      if (!getResp.ok) {
        return {
          success: false,
          tcdbUnavailable: true,
          message: `tcdb-get-http-${getResp.status}`,
        };
      }
      const getJson = (await getResp.json()) as {
        metadata?: TcdbMetadata | null;
        reason?: string;
      };
      if (getJson.reason === "tcdb-unavailable" || !getJson.metadata) {
        return {
          success: false,
          tcdbUnavailable: true,
          message: getJson.reason ?? "tcdb-no-metadata",
        };
      }

      // ----- 3. map -----
      const { setMetadata, features } = mapTcdbResponseToSetData(
        getJson.metadata,
      );
      return { success: true, tcdbUnavailable: false, setMetadata, features };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[fetchTcdbSetData] failed: ${detail}`);
      return {
        success: false,
        tcdbUnavailable: true,
        message: "tcdb-network-error",
      };
    }
  },
});

export const enrichSetFromTcdb = internalAction({
  args: { selectorOptionId: v.id("selectorOptions") },
  returns: v.object({
    matched: v.boolean(),
    tcdbSetId: v.optional(v.string()),
    featuresAdded: v.number(),
    setMetadataApplied: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    matched: boolean;
    tcdbSetId?: string;
    featuresAdded: number;
    setMetadataApplied: boolean;
    reason?: string;
  }> => {
    try {
      // ----- 1. Resolve the setName row + walk ancestors for sport/year. -----
      const chain = await ctx.runQuery(
        internal.selectorOptions._getTcdbEnrichmentChain,
        { selectorOptionId: args.selectorOptionId },
      );
      if (!chain) {
        return {
          matched: false,
          featuresAdded: 0,
          setMetadataApplied: false,
          reason: "selector-option-not-found",
        };
      }
      if (chain.level !== "setName") {
        return {
          matched: false,
          featuresAdded: 0,
          setMetadataApplied: false,
          reason: "not-setname-level",
        };
      }

      const { sport, year, setName, cachedTcdbSetId, existingFeatures } =
        chain;
      if (!sport || !year) {
        return {
          matched: false,
          featuresAdded: 0,
          setMetadataApplied: false,
          reason: "missing-sport-or-year",
        };
      }

      // ----- 2. Pick a TCDB SID (cached or via search). -----
      let tcdbSetId: string | undefined = cachedTcdbSetId;
      if (!tcdbSetId) {
        const searchResp = await tcdbFetch("/tcdb/search", {
          sport,
          year,
          setName,
        });
        if (!searchResp.ok) {
          return {
            matched: false,
            featuresAdded: 0,
            setMetadataApplied: false,
            reason: `tcdb-search-http-${searchResp.status}`,
          };
        }
        const searchJson = (await searchResp.json()) as {
          matches?: TcdbSearchMatch[];
          reason?: string;
        };
        if (searchJson.reason === "tcdb-unavailable") {
          return {
            matched: false,
            featuresAdded: 0,
            setMetadataApplied: false,
            reason: "tcdb-unavailable",
          };
        }
        const matches = (searchJson.matches ?? []).filter(
          (m) => typeof m.score === "number" && m.score >= MIN_MATCH_SCORE,
        );
        if (matches.length === 0) {
          return {
            matched: false,
            featuresAdded: 0,
            setMetadataApplied: false,
            reason: "no-confident-match",
          };
        }
        // Highest score wins. Search endpoint already filters by ≥0.7 per
        // contract; re-filter defensively.
        matches.sort((a, b) => b.score - a.score);
        tcdbSetId = matches[0].tcdbSetId;
      }

      // ----- 3. Pull the set metadata. -----
      const getResp = await tcdbFetch("/tcdb/get-set", { tcdbSetId });
      if (!getResp.ok) {
        return {
          matched: !!tcdbSetId,
          tcdbSetId,
          featuresAdded: 0,
          setMetadataApplied: false,
          reason: `tcdb-get-http-${getResp.status}`,
        };
      }
      const getJson = (await getResp.json()) as {
        metadata?: TcdbMetadata | null;
        reason?: string;
      };
      if (getJson.reason === "tcdb-unavailable" || !getJson.metadata) {
        return {
          matched: !!tcdbSetId,
          tcdbSetId,
          featuresAdded: 0,
          setMetadataApplied: false,
          reason: getJson.reason ?? "tcdb-no-metadata",
        };
      }
      const meta = getJson.metadata;

      // ----- 4. Patch setMetadata. -----
      const metadataToPatch: {
        releaseDate?: string;
        totalCardCount?: number;
        block?: string;
        tcdbSetId?: string;
        sourceUrl?: string;
        lastSyncedAt?: number;
      } = {
        tcdbSetId: meta.tcdbSetId,
        sourceUrl: meta.sourceUrl,
        lastSyncedAt: Date.now(),
      };
      if (meta.releaseDate) metadataToPatch.releaseDate = meta.releaseDate;
      if (typeof meta.totalCardCount === "number") {
        metadataToPatch.totalCardCount = meta.totalCardCount;
      }
      if (meta.block) metadataToPatch.block = meta.block;

      await ctx.runMutation(api.selectorOptions.setSetMetadata, {
        selectorOptionId: args.selectorOptionId,
        metadata: metadataToPatch,
      });

      // ----- 5. Backfill missing features. Don't clobber operator values. -----
      let featuresAdded = 0;
      const additional = meta.additionalFeatures ?? {};
      for (const [rawKey, rawValue] of Object.entries(additional)) {
        if (typeof rawValue !== "string") continue;
        const value = rawValue.trim();
        if (!value) continue;
        const mappedKey = TCDB_FEATURE_KEY_MAP[rawKey.toLowerCase()] ?? null;
        if (!mappedKey) continue;
        if (existingFeatures && existingFeatures[mappedKey] !== undefined) {
          // Operator (or prior enrichment) already set this; don't clobber.
          continue;
        }
        await ctx.runMutation(api.selectorOptions.setSelectorOptionFeature, {
          selectorOptionId: args.selectorOptionId,
          key: mappedKey,
          value,
        });
        featuresAdded += 1;
      }

      return {
        matched: true,
        tcdbSetId,
        featuresAdded,
        setMetadataApplied: true,
      };
    } catch (err) {
      // Network/timeout — log and degrade gracefully. TCDB outage must NOT
      // block the calling sync flow.
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[enrichSetFromTcdb] failed: ${detail}`);
      return {
        matched: false,
        featuresAdded: 0,
        setMetadataApplied: false,
        reason: "tcdb-network-error",
      };
    }
  },
});
