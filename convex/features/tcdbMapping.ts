/**
 * NEO-38: pure mapping from a raw TCDB browser-service response (search match
 * + get-set metadata) into NeonBinder's `{ setMetadata, features }` shape.
 *
 * Extracted into its own pure module (no Convex / Node imports) so it can be:
 *   - imported by the `"use node"` adapter `convex/adapters/tcdb.ts`, and
 *   - unit-tested directly without dragging in `google-auth-library`.
 *
 * `TCDB_FEATURE_KEY_MAP` mirrors the case-insensitive label→feature-key map
 * the original `enrichSetFromTcdb` used. In addition we derive `era` and
 * `vintage` from the set's release date so the feature panel isn't blank when
 * TCDB has a date but no explicit era label.
 */

import { eraForYear } from "./deriveCardFeatures";

/** Case-insensitive TCDB additionalFeatures label → NeonBinder feature key. */
export const TCDB_FEATURE_KEY_MAP: Record<string, string> = {
  manufacturer: "manufacturer",
  block: "block",
  league: "league",
  era: "era",
  "card type": "cardType",
  reprint: "isReprint",
  "is reprint": "isReprint",
};

/** Subset of the browser service's /tcdb/get-set metadata we consume. */
export type TcdbRawMetadata = {
  tcdbSetId: string;
  name: string;
  releaseDate?: string;
  totalCardCount?: number;
  block?: string;
  sourceUrl: string;
  additionalFeatures?: Record<string, string>;
};

/** Set-level metadata in the schema's `setMetadata` shape. */
export type TcdbSetMetadata = {
  releaseDate?: string;
  totalCardCount?: number;
  block?: string;
  tcdbSetId?: string;
  sourceUrl?: string;
  lastSyncedAt?: number;
};

export type TcdbMappedSetData = {
  setMetadata: TcdbSetMetadata;
  features: Record<string, string>;
};

/** Parse a leading 4-digit year out of a release-date / year string. */
function parseYearFromDate(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/\d{4}/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return n > 1000 && n < 3000 ? n : null;
}

/**
 * Map a raw TCDB get-set metadata payload into `{ setMetadata, features }`.
 *
 * @param meta the /tcdb/get-set `metadata` object
 * @param now  injected timestamp (so the result is deterministic in tests)
 */
export function mapTcdbResponseToSetData(
  meta: TcdbRawMetadata,
  now: number = Date.now(),
): TcdbMappedSetData {
  // ----- setMetadata -----
  const setMetadata: TcdbSetMetadata = {
    tcdbSetId: meta.tcdbSetId,
    sourceUrl: meta.sourceUrl,
    lastSyncedAt: now,
  };
  if (meta.releaseDate) setMetadata.releaseDate = meta.releaseDate;
  if (typeof meta.totalCardCount === "number") {
    setMetadata.totalCardCount = meta.totalCardCount;
  }
  if (meta.block) setMetadata.block = meta.block;

  // ----- features -----
  const features: Record<string, string> = {};

  // `block` is both setMetadata and a feature key (TCDB surfaces it as a
  // labelled feature). Mirror it into features when present so the panel can
  // show it even before additionalFeatures is consulted.
  if (meta.block) features.block = meta.block;

  // Mapped additionalFeatures (case-insensitive labels → our keys).
  const additional = meta.additionalFeatures ?? {};
  for (const [rawKey, rawValue] of Object.entries(additional)) {
    if (typeof rawValue !== "string") continue;
    const value = rawValue.trim();
    if (!value) continue;
    const mappedKey = TCDB_FEATURE_KEY_MAP[rawKey.toLowerCase()] ?? null;
    if (!mappedKey) continue;
    features[mappedKey] = value;
  }

  // Derive era + vintage from the release date when TCDB didn't give an
  // explicit `era` label. Authoritative-but-cheap: the release year is enough
  // to bucket the era and decide vintage (≤1979).
  const yearNum = parseYearFromDate(meta.releaseDate);
  if (yearNum !== null) {
    if (features.era === undefined) features.era = eraForYear(yearNum);
    if (features.vintage === undefined) {
      features.vintage = yearNum <= 1979 ? "true" : "false";
    }
  }

  return { setMetadata, features };
}
