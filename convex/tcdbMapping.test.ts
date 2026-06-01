/**
 * NEO-38: unit tests for the pure TCDB response mapper. No Convex / Node /
 * network — exercises `mapTcdbResponseToSetData` directly.
 */

import { describe, expect, test } from "vitest";
import {
  mapTcdbResponseToSetData,
  TCDB_FEATURE_KEY_MAP,
} from "./features/tcdbMapping";

const NOW = 1_700_000_000_000;

describe("mapTcdbResponseToSetData", () => {
  test("maps full metadata + additionalFeatures into setMetadata + features", () => {
    const { setMetadata, features } = mapTcdbResponseToSetData(
      {
        tcdbSetId: "27845",
        name: "2024 Topps Chrome Baseball",
        releaseDate: "2024-08-21",
        totalCardCount: 220,
        block: "Topps Chrome",
        sourceUrl: "https://www.tcdb.com/Checklist.cfm/sid/27845",
        additionalFeatures: {
          Manufacturer: "Topps",
          "Card Type": "Base",
          League: "MLB",
        },
      },
      NOW,
    );

    expect(setMetadata).toEqual({
      tcdbSetId: "27845",
      sourceUrl: "https://www.tcdb.com/Checklist.cfm/sid/27845",
      releaseDate: "2024-08-21",
      totalCardCount: 220,
      block: "Topps Chrome",
      lastSyncedAt: NOW,
    });

    // Mapped additionalFeatures (case-insensitive labels).
    expect(features.manufacturer).toBe("Topps");
    expect(features.cardType).toBe("Base");
    expect(features.league).toBe("MLB");
    // `block` mirrored into features.
    expect(features.block).toBe("Topps Chrome");
    // era + vintage derived from the 2024 release date.
    expect(features.era).toBe("Modern (1980-Now)");
    expect(features.vintage).toBe("false");
  });

  test("derives vintage=true + correct era for a 1975 set", () => {
    const { features } = mapTcdbResponseToSetData(
      {
        tcdbSetId: "1",
        name: "1975 Topps",
        releaseDate: "1975-03-01",
        sourceUrl: "https://x",
      },
      NOW,
    );
    expect(features.era).toBe("Vintage (1970-79)");
    expect(features.vintage).toBe("true");
  });

  test("omits optional setMetadata fields when absent", () => {
    const { setMetadata, features } = mapTcdbResponseToSetData(
      {
        tcdbSetId: "9",
        name: "Bare Set",
        sourceUrl: "https://x",
      },
      NOW,
    );
    expect(setMetadata).toEqual({
      tcdbSetId: "9",
      sourceUrl: "https://x",
      lastSyncedAt: NOW,
    });
    expect(setMetadata.releaseDate).toBeUndefined();
    expect(setMetadata.totalCardCount).toBeUndefined();
    expect(setMetadata.block).toBeUndefined();
    // No releaseDate → no derived era/vintage.
    expect(features.era).toBeUndefined();
    expect(features.vintage).toBeUndefined();
  });

  test("an explicit TCDB `era` label is not overwritten by date-derived era", () => {
    const { features } = mapTcdbResponseToSetData(
      {
        tcdbSetId: "9",
        name: "Set",
        releaseDate: "2024-01-01",
        sourceUrl: "https://x",
        additionalFeatures: { Era: "Custom Era Label" },
      },
      NOW,
    );
    expect(features.era).toBe("Custom Era Label");
    // vintage still derived (no explicit vintage label given).
    expect(features.vintage).toBe("false");
  });

  test("ignores unmapped labels and non-string / empty values", () => {
    const { features } = mapTcdbResponseToSetData(
      {
        tcdbSetId: "9",
        name: "Set",
        sourceUrl: "https://x",
        additionalFeatures: {
          "Some Unknown Label": "ignored",
          Manufacturer: "   ", // empty after trim → skipped
          // @ts-expect-error — exercising a non-string value defensively.
          League: 123,
        },
      },
      NOW,
    );
    expect(features.manufacturer).toBeUndefined();
    expect(features.league).toBeUndefined();
    expect(Object.keys(features)).not.toContain("Some Unknown Label");
  });

  test("the shared key map covers the known TCDB labels", () => {
    expect(TCDB_FEATURE_KEY_MAP["card type"]).toBe("cardType");
    expect(TCDB_FEATURE_KEY_MAP["is reprint"]).toBe("isReprint");
    expect(TCDB_FEATURE_KEY_MAP["manufacturer"]).toBe("manufacturer");
  });
});
