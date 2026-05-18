import { query, mutation, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { getCurrentUserId, requireAdmin } from "./auth";

// ===== LEVEL VALIDATOR (reused across functions) =====
const levelValidator = v.union(
  v.literal("sport"),
  v.literal("year"),
  v.literal("manufacturer"),
  v.literal("setName"),
  v.literal("variantType"),
  v.literal("insert"),
  v.literal("parallel"),
);

const metadataValidator = v.optional(v.object({
  cardNumberPrefix: v.optional(v.string()),
  isInsert: v.optional(v.boolean()),
  isParallel: v.optional(v.boolean()),
}));

type Level =
  | "sport"
  | "year"
  | "manufacturer"
  | "setName"
  | "variantType"
  | "insert"
  | "parallel";

// ===== QUERIES =====

export const getSelectorOptions = query({
  args: {
    level: levelValidator,
    parentId: v.optional(v.id("selectorOptions")),
  },
  returns: v.array(
    v.object({
      _id: v.id("selectorOptions"),
      _creationTime: v.number(),
      level: levelValidator,
      value: v.string(),
      platformData: v.object({
        bsc: v.optional(v.union(v.string(), v.array(v.string()))),
        sportlots: v.optional(v.union(v.string(), v.array(v.string()))),
      }),
      parentId: v.optional(v.id("selectorOptions")),
      children: v.optional(v.array(v.id("selectorOptions"))),
      isCustom: v.optional(v.boolean()),
      createdByUserId: v.optional(v.string()),
      metadata: metadataValidator,
      lastUpdated: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { level, parentId } = args;

    if (parentId) {
      return await ctx.db
        .query("selectorOptions")
        .withIndex("by_level_and_parent", (q) =>
          q.eq("level", level).eq("parentId", parentId),
        )
        .collect();
    } else {
      return await ctx.db
        .query("selectorOptions")
        .withIndex("by_level_and_parent", (q) =>
          q.eq("level", level).eq("parentId", undefined),
        )
        .collect();
    }
  },
});

// Returns all identifiers (display values + platform values) already used by
// inserts under the given setId, across every variantType sibling. Useful for
// excluding already-linked sets from reconciliation/picker dialogs.
export const getUsedInsertIdentifiersBySet = query({
  args: {
    setId: v.id("selectorOptions"),
    // When set, inserts under this variantType are *not* counted as "used".
    // ReconciliationModal passes its own variantTypeId so re-running the
    // same variantType still surfaces previously-saved rows (allowing the
    // user to prune them via the keep shelf). Items under sibling
    // variantTypes remain blocked so they aren't double-claimed.
    excludeVariantTypeId: v.optional(v.id("selectorOptions")),
  },
  returns: v.object({
    values: v.array(v.string()),
    slPlatformValues: v.array(v.string()),
    bscPlatformValues: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variantTypes = await ctx.db
      .query("selectorOptions")
      .withIndex("by_level_and_parent", (q) =>
        q.eq("level", "variantType").eq("parentId", args.setId),
      )
      .collect();

    const values: string[] = [];
    const slPlatformValues: string[] = [];
    const bscPlatformValues: string[] = [];

    for (const vt of variantTypes) {
      if (args.excludeVariantTypeId && vt._id === args.excludeVariantTypeId) {
        continue;
      }
      const inserts = await ctx.db
        .query("selectorOptions")
        .withIndex("by_level_and_parent", (q) =>
          q.eq("level", "insert").eq("parentId", vt._id),
        )
        .collect();
      for (const ins of inserts) {
        values.push(ins.value);
        if (typeof ins.platformData.sportlots === "string") {
          slPlatformValues.push(ins.platformData.sportlots);
        }
        const bsc = ins.platformData.bsc;
        if (typeof bsc === "string") {
          bscPlatformValues.push(bsc);
        } else if (Array.isArray(bsc)) {
          bscPlatformValues.push(...bsc);
        }
      }
    }

    return { values, slPlatformValues, bscPlatformValues };
  },
});

// Returns the Base variantType row for a given setId, if one exists.
// Base is treated as a terminal node — it carries the SL/BSC platform
// mapping directly on the variantType row (no child insert). Used by
// VariantForm to seed the SL prefix filter when reconciling sibling
// Insert/Parallel variantTypes — the Base anchor's SportLots name is a
// tighter SL-side prefix than the BSC set name.
export const getBaseVariantBySet = query({
  args: { setId: v.id("selectorOptions") },
  returns: v.union(
    v.null(),
    v.object({
      value: v.string(),
      platformData: v.object({
        bsc: v.optional(v.union(v.string(), v.array(v.string()))),
        sportlots: v.optional(v.union(v.string(), v.array(v.string()))),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variantTypes = await ctx.db
      .query("selectorOptions")
      .withIndex("by_level_and_parent", (q) =>
        q.eq("level", "variantType").eq("parentId", args.setId),
      )
      .collect();
    const baseVariantType = variantTypes.find(
      (vt) => vt.value.toLowerCase().trim() === "base",
    );
    if (!baseVariantType) return null;
    return {
      value: baseVariantType.value,
      platformData: baseVariantType.platformData,
    };
  },
});

export const getSelectorOptionById = query({
  args: { id: v.id("selectorOptions") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("selectorOptions"),
      _creationTime: v.number(),
      level: levelValidator,
      value: v.string(),
      platformData: v.object({
        bsc: v.optional(v.union(v.string(), v.array(v.string()))),
        sportlots: v.optional(v.union(v.string(), v.array(v.string()))),
      }),
      parentId: v.optional(v.id("selectorOptions")),
      children: v.optional(v.array(v.id("selectorOptions"))),
      isCustom: v.optional(v.boolean()),
      createdByUserId: v.optional(v.string()),
      metadata: metadataValidator,
      lastUpdated: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

export const findByLevelAndValue = query({
  args: {
    level: levelValidator,
    value: v.string(),
    parentId: v.optional(v.id("selectorOptions")),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("selectorOptions"),
      _creationTime: v.number(),
      level: levelValidator,
      value: v.string(),
      platformData: v.object({
        bsc: v.optional(v.union(v.string(), v.array(v.string()))),
        sportlots: v.optional(v.union(v.string(), v.array(v.string()))),
      }),
      parentId: v.optional(v.id("selectorOptions")),
      children: v.optional(v.array(v.id("selectorOptions"))),
      isCustom: v.optional(v.boolean()),
      createdByUserId: v.optional(v.string()),
      metadata: metadataValidator,
      lastUpdated: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const options = await ctx.db
      .query("selectorOptions")
      .withIndex("by_level_and_parent", (q) =>
        q.eq("level", args.level).eq("parentId", args.parentId),
      )
      .collect();

    const normalizedTarget = args.value.toLowerCase().trim();
    return options.find((o) => o.value.toLowerCase().trim() === normalizedTarget) || null;
  },
});

export const getAncestorChain = query({
  args: { id: v.id("selectorOptions") },
  returns: v.array(
    v.object({
      _id: v.id("selectorOptions"),
      level: levelValidator,
      value: v.string(),
      platformData: v.object({
        bsc: v.optional(v.union(v.string(), v.array(v.string()))),
        sportlots: v.optional(v.union(v.string(), v.array(v.string()))),
      }),
      metadata: metadataValidator,
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const chain: Array<{
      _id: Id<"selectorOptions">;
      level: Level;
      value: string;
      platformData: { bsc?: string | string[]; sportlots?: string };
      metadata?: { cardNumberPrefix?: string; isInsert?: boolean; isParallel?: boolean };
    }> = [];
    let currentId: Id<"selectorOptions"> | undefined = args.id;

    while (currentId) {
      const option: any = await ctx.db.get(currentId);
      if (!option) break;
      chain.unshift({
        _id: option._id,
        level: option.level,
        value: option.value,
        platformData: option.platformData || {},
        metadata: option.metadata,
      });
      currentId = option.parentId;
    }

    return chain;
  },
});

export const getCardChecklist = query({
  args: { selectorOptionId: v.id("selectorOptions") },
  returns: v.array(
    v.object({
      _id: v.id("cardChecklist"),
      _creationTime: v.number(),
      selectorOptionId: v.id("selectorOptions"),
      cardNumber: v.string(),
      cardName: v.string(),
      team: v.optional(v.string()),
      playerIds: v.optional(v.array(v.id("players"))),
      teamOnCardIds: v.optional(v.array(v.id("teams"))),
      attributes: v.optional(v.array(v.string())),
      isRookie: v.optional(v.boolean()),
      isRelic: v.optional(v.boolean()),
      printRun: v.optional(v.number()),
      autographType: v.optional(v.string()),
      cardVariation: v.optional(v.string()),
      imageUrls: v.optional(v.object({
        front: v.optional(v.string()),
        back: v.optional(v.string()),
      })),
      platformData: v.object({
        bsc: v.optional(v.string()),
        sportlots: v.optional(v.string()),
      }),
      sourcePlatformIds: v.optional(v.object({
        bsc: v.optional(v.string()),
        sportlots: v.optional(v.string()),
      })),
      isCustom: v.optional(v.boolean()),
      pendingPlayerNames: v.optional(v.array(v.string())),
      pendingTeamNames: v.optional(v.array(v.string())),
      sortOrder: v.number(),
      lastUpdated: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("cardChecklist")
      .withIndex("by_selector_option", (q) =>
        q.eq("selectorOptionId", args.selectorOptionId),
      )
      .collect();
  },
});

// ===== MUTATIONS =====

export const storeSelectorOptions = mutation({
  args: {
    level: levelValidator,
    options: v.array(
      v.object({
        value: v.string(),
        platformData: v.object({
          bsc: v.optional(v.union(v.string(), v.array(v.string()))),
          sportlots: v.optional(v.union(v.string(), v.array(v.string()))),
        }),
      }),
    ),
    parentId: v.optional(v.id("selectorOptions")),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    optionsCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { level, options, parentId } = args;

    // Get existing non-custom options for this level and parent
    const existingOptions = await ctx.db
      .query("selectorOptions")
      .withIndex("by_level_and_parent", (q) =>
        q.eq("level", level).eq("parentId", parentId),
      )
      .collect();

    // Build a map of existing options by normalized value
    const existingByValue = new Map<
      string,
      (typeof existingOptions)[0]
    >();
    for (const opt of existingOptions) {
      existingByValue.set(opt.value.toLowerCase().trim(), opt);
    }

    // Upsert: update existing, insert new
    const processedValues = new Set<string>();
    const insertedIds: Id<"selectorOptions">[] = [];

    // Levels where downstream fetches require a BSC slug. SL is excluded
    // — its adapter doesn't filter on setName and does its own DB lookup
    // for the radio-button ID, so a setName row legitimately can lack
    // platformData.sportlots. A missing BSC slug at sport/year/setName
    // *will* cause fetchCardChecklist / fetchRawOptions to fail the
    // precondition, so warn early to make the cascade upstream visible.
    const BSC_REQUIRED_LEVELS = new Set(["sport", "year", "setName"]);
    const warnIfIncomplete = (
      rowId: Id<"selectorOptions"> | "new",
      value: string,
      pd: { bsc?: string | string[]; sportlots?: string | string[] },
    ) => {
      if (!BSC_REQUIRED_LEVELS.has(level)) return;
      if (pd.bsc) return;
      console.warn(
        `[storeSelectorOptions] row missing BSC platform slug — level=${level} ` +
          `value=${value} id=${rowId}. Downstream BSC fetches will hit the ` +
          `missing-slug precondition.`,
      );
    };

    for (const option of options) {
      const normalizedValue = option.value.toLowerCase().trim();
      processedValues.add(normalizedValue);

      const existing = existingByValue.get(normalizedValue);
      if (existing) {
        // Merge platformData onto existing (preserves custom entries)
        const mergedPlatformData = {
          ...existing.platformData,
          ...option.platformData,
        };
        warnIfIncomplete(existing._id, option.value, mergedPlatformData);
        await ctx.db.patch(existing._id, {
          platformData: mergedPlatformData,
          lastUpdated: Date.now(),
        });
        insertedIds.push(existing._id);
      } else {
        warnIfIncomplete("new", option.value, option.platformData);
        const id = await ctx.db.insert("selectorOptions", {
          level,
          value: option.value,
          platformData: option.platformData,
          parentId,
          children: [],
          lastUpdated: Date.now(),
        });
        insertedIds.push(id);
      }
    }

    // Delete old non-custom options that weren't in the new set
    // Only delete if we actually received new options — an empty sync should not wipe data
    if (options.length > 0) {
      for (const existing of existingOptions) {
        const normalizedValue = existing.value.toLowerCase().trim();
        if (!processedValues.has(normalizedValue) && !existing.isCustom) {
          await ctx.db.delete(existing._id);
        }
      }
    }

    // Update parent's children array
    if (parentId && insertedIds.length > 0) {
      // Get remaining custom options to include in children
      const customIds = existingOptions
        .filter(
          (o) =>
            o.isCustom &&
            !processedValues.has(o.value.toLowerCase().trim()),
        )
        .map((o) => o._id);
      await ctx.db.patch(parentId, {
        children: [...insertedIds, ...customIds],
      });
    }

    return {
      success: true,
      message: `Successfully stored ${insertedIds.length} ${level} options`,
      optionsCount: insertedIds.length,
    };
  },
});

export const addCustomSelectorOption = mutation({
  args: {
    level: levelValidator,
    value: v.string(),
    parentId: v.optional(v.id("selectorOptions")),
    userId: v.optional(v.string()),
  },
  returns: v.id("selectorOptions"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { level, value, parentId, userId } = args;

    // Check for duplicate by normalized value
    const existing = await ctx.db
      .query("selectorOptions")
      .withIndex("by_level_and_parent", (q) =>
        q.eq("level", level).eq("parentId", parentId),
      )
      .collect();

    const normalizedValue = value.toLowerCase().trim();
    const duplicate = existing.find(
      (o) => o.value.toLowerCase().trim() === normalizedValue,
    );

    if (duplicate) {
      return duplicate._id;
    }

    const id = await ctx.db.insert("selectorOptions", {
      level,
      value,
      platformData: {},
      parentId,
      children: [],
      isCustom: true,
      createdByUserId: userId,
      lastUpdated: Date.now(),
    });

    // Update parent's children array
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (parent) {
        await ctx.db.patch(parentId, {
          children: [...(parent.children || []), id],
        });
      }
    }

    return id;
  },
});

// ===== NEO-6 phase 1: multi-source attachment =====
//
// Caps. Both are admin-gated so they're not a security boundary — they're
// guard rails against operator-induced footguns (fan-out DoS against the
// SportLots adapter, label-quality drift, etc).
const MAX_ATTACHED_PER_SIDE = 10;
const MAX_LABEL_LENGTH = 200;
//
// A canonical NeonBinder variant (variantType / insert / parallel row) can
// map to multiple BSC and/or SL set IDs. The reconciliation primary is
// recorded in `primaryPlatformId`; operator-attached extras live alongside
// it in `platformData.<side>` (as an array) with human-readable labels in
// `platformLabels.<side>`. The mutations below are the only path operators
// use to attach / detach / rename extras — they patch a single row, and
// they refuse to touch the primary (which is owned by reconciliation).

const platformSideValidator = v.union(
  v.literal("bsc"),
  v.literal("sportlots"),
);

// Normalize platformData side to an array. Mirrors the helper in
// setReconciliation.ts but kept local to avoid a cross-file import.
function pdSideToArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function packPdSide(ids: string[]): string | string[] | undefined {
  if (ids.length === 0) return undefined;
  if (ids.length === 1) return ids[0];
  return ids;
}

/**
 * Attach one or more BSC/SL set IDs to an existing canonical row, with
 * editable human labels. Skips IDs already attached (including the
 * primary). Only valid on variant levels (variantType / insert / parallel).
 */
export const attachPlatformIds = mutation({
  args: {
    selectorOptionId: v.id("selectorOptions"),
    additions: v.object({
      bsc: v.optional(
        v.array(v.object({ id: v.string(), label: v.string() })),
      ),
      sportlots: v.optional(
        v.array(v.object({ id: v.string(), label: v.string() })),
      ),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    attachedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.selectorOptionId);
    if (!row) {
      throw new Error(
        `selectorOptions row not found: ${args.selectorOptionId}`,
      );
    }
    if (
      row.level !== "variantType" &&
      row.level !== "insert" &&
      row.level !== "parallel"
    ) {
      throw new Error(
        `attachPlatformIds only valid on variantType/insert/parallel rows (got level=${row.level})`,
      );
    }

    // Validate every label and id up-front so a malformed batch fails
    // atomically instead of half-applying. Labels must be non-empty after
    // trim and within MAX_LABEL_LENGTH — same shape `renamePlatformLabel`
    // enforces. Empty IDs are silently skipped (treated as no-op).
    for (const side of ["bsc", "sportlots"] as const) {
      const additions = args.additions[side] ?? [];
      for (const { id, label } of additions) {
        if (!id) continue;
        const trimmed = label.trim();
        if (!trimmed) {
          throw new Error(
            `attachPlatformIds: label is required (side=${side}, id=${id})`,
          );
        }
        if (trimmed.length > MAX_LABEL_LENGTH) {
          throw new Error(
            `attachPlatformIds: label exceeds ${MAX_LABEL_LENGTH} chars (side=${side}, id=${id})`,
          );
        }
      }
    }

    const mergedPD: { bsc?: string | string[]; sportlots?: string | string[] } = {
      bsc: row.platformData.bsc,
      sportlots: row.platformData.sportlots,
    };
    const mergedLabels: {
      bsc?: Record<string, string>;
      sportlots?: Record<string, string>;
    } = {
      bsc: { ...(row.platformLabels?.bsc ?? {}) },
      sportlots: { ...(row.platformLabels?.sportlots ?? {}) },
    };

    let attached = 0;
    for (const side of ["bsc", "sportlots"] as const) {
      const additions = args.additions[side] ?? [];
      if (additions.length === 0) continue;
      const current = pdSideToArray(mergedPD[side]);
      const currentSet = new Set(current);
      for (const { id, label } of additions) {
        if (!id) continue;
        if (!currentSet.has(id)) {
          if (current.length >= MAX_ATTACHED_PER_SIDE) {
            throw new Error(
              `attachPlatformIds: cap of ${MAX_ATTACHED_PER_SIDE} attached IDs per side reached (side=${side})`,
            );
          }
          current.push(id);
          currentSet.add(id);
          attached += 1;
        }
        // Label overwrites are intentional — operator may re-attach with a
        // cleaner label and expect it to stick. We've already validated
        // non-empty + length in the pass above.
        mergedLabels[side]![id] = label.trim();
      }
      mergedPD[side] = packPdSide(current);
    }

    // Strip empty label objects so we don't write `{ bsc: {} }`.
    const labelsPatch: {
      bsc?: Record<string, string>;
      sportlots?: Record<string, string>;
    } = {};
    if (Object.keys(mergedLabels.bsc ?? {}).length > 0) {
      labelsPatch.bsc = mergedLabels.bsc;
    }
    if (Object.keys(mergedLabels.sportlots ?? {}).length > 0) {
      labelsPatch.sportlots = mergedLabels.sportlots;
    }

    await ctx.db.patch(row._id, {
      platformData: mergedPD,
      platformLabels:
        Object.keys(labelsPatch).length > 0 ? labelsPatch : undefined,
      lastUpdated: Date.now(),
    });

    return {
      success: true,
      message: `Attached ${attached} new platform ID(s)`,
      attachedCount: attached,
    };
  },
});

/**
 * Detach a single non-primary platform ID. Refuses to detach the
 * reconciliation primary (operator must re-run set reconciliation to
 * change that). Removes the associated label entry as well.
 */
export const detachPlatformId = mutation({
  args: {
    selectorOptionId: v.id("selectorOptions"),
    side: platformSideValidator,
    id: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.selectorOptionId);
    if (!row) {
      throw new Error(
        `selectorOptions row not found: ${args.selectorOptionId}`,
      );
    }
    const current = pdSideToArray(row.platformData[args.side]);
    const primary =
      row.primaryPlatformId?.[args.side] ?? current[0];
    if (args.id === primary) {
      throw new Error(
        `Refusing to detach the reconciliation primary (${args.side}=${args.id}). ` +
          `Re-run set reconciliation to change the primary.`,
      );
    }
    if (!current.includes(args.id)) {
      return { success: true, message: "Nothing to detach (id not attached)" };
    }
    const remaining = current.filter((x) => x !== args.id);
    const newLabels = { ...(row.platformLabels?.[args.side] ?? {}) };
    delete newLabels[args.id];

    const labelsPatch: {
      bsc?: Record<string, string>;
      sportlots?: Record<string, string>;
    } = { ...(row.platformLabels ?? {}) };
    if (Object.keys(newLabels).length > 0) {
      labelsPatch[args.side] = newLabels;
    } else {
      delete labelsPatch[args.side];
    }

    await ctx.db.patch(row._id, {
      platformData: {
        ...row.platformData,
        [args.side]: packPdSide(remaining),
      },
      platformLabels:
        Object.keys(labelsPatch).length > 0 ? labelsPatch : undefined,
      lastUpdated: Date.now(),
    });
    return { success: true, message: "Detached" };
  },
});

/**
 * Rename a platformLabels entry. Works for primary OR extras — the label
 * is presentation-only, so renaming the primary's label is harmless.
 */
export const renamePlatformLabel = mutation({
  args: {
    selectorOptionId: v.id("selectorOptions"),
    side: platformSideValidator,
    id: v.string(),
    label: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.selectorOptionId);
    if (!row) {
      throw new Error(
        `selectorOptions row not found: ${args.selectorOptionId}`,
      );
    }
    const attached = pdSideToArray(row.platformData[args.side]);
    if (!attached.includes(args.id)) {
      throw new Error(
        `Cannot rename label for unattached id (${args.side}=${args.id})`,
      );
    }
    const trimmed = args.label.trim();
    if (!trimmed) {
      throw new Error("Label cannot be empty");
    }

    const sideLabels = {
      ...(row.platformLabels?.[args.side] ?? {}),
      [args.id]: trimmed,
    };
    const labelsPatch: {
      bsc?: Record<string, string>;
      sportlots?: Record<string, string>;
    } = { ...(row.platformLabels ?? {}) };
    labelsPatch[args.side] = sideLabels;

    await ctx.db.patch(row._id, {
      platformLabels: labelsPatch,
      lastUpdated: Date.now(),
    });
    return { success: true, message: "Renamed" };
  },
});

/**
 * Validator for the rich per-card payload that storeCardChecklist accepts.
 * Mirrors the shape returned by fetchBscChecklist + fetchSportLotsChecklist
 * after reconciliation. Player/team strings have already been resolved to
 * IDs by the time this runs (commitCardChecklist handles findOrCreate and
 * passes IDs in here).
 */
const richChecklistCardValidator = v.object({
  cardNumber: v.string(),
  cardName: v.string(),
  team: v.optional(v.string()),
  playerIds: v.optional(v.array(v.id("players"))),
  teamOnCardIds: v.optional(v.array(v.id("teams"))),
  attributes: v.optional(v.array(v.string())),
  isRookie: v.optional(v.boolean()),
  isRelic: v.optional(v.boolean()),
  printRun: v.optional(v.number()),
  autographType: v.optional(v.string()),
  cardVariation: v.optional(v.string()),
  platformData: v.object({
    bsc: v.optional(v.string()),
    sportlots: v.optional(v.string()),
  }),
});

/**
 * Natural-numeric comparator for card numbers.
 *
 * Card numbers are short strings like "1", "1a", "1b", "2", "10", "DK-1",
 * "9001". Lexicographic sort gives "10" before "2"; pure numeric sort can't
 * handle the letter suffixes. This splits each number into a leading-digit
 * portion and a tail, comparing numerically first then lexicographically on
 * the tail.
 *
 * Pure-letter card numbers (e.g. "DK-1") with no leading digits fall back
 * to lexicographic comparison against each other and sort AFTER any numeric
 * card. Custom cards like "9001" naturally end up at the bottom relative
 * to typical marketplace card numbers (1-500), which matches user
 * expectations for an appended custom slot.
 */
function compareCardNumbers(a: string, b: string): number {
  const aMatch = a.match(/^(\d+)(.*)/);
  const bMatch = b.match(/^(\d+)(.*)/);
  if (aMatch && bMatch) {
    const aNum = parseInt(aMatch[1], 10);
    const bNum = parseInt(bMatch[1], 10);
    if (aNum !== bNum) return aNum - bNum;
    return aMatch[2].localeCompare(bMatch[2]);
  }
  if (aMatch && !bMatch) return -1;
  if (!aMatch && bMatch) return 1;
  return a.localeCompare(b);
}

/**
 * Re-stamp `sortOrder` on every row in this selectorOption's checklist so
 * the values reflect natural cardNumber order. Called at the end of any
 * mutation that adds/updates rows so the client can sort by sortOrder and
 * trust the result without re-doing the natural-sort itself.
 *
 * Note: this writes to every row whose new sortOrder differs from current,
 * which can be many writes after a fresh marketplace commit. Convex bundles
 * these into the same transaction, so query subscribers see exactly one
 * invalidation regardless of how many rows changed.
 */
async function restampCardChecklistSortOrders(
  ctx: { db: { query: any; patch: any } },
  selectorOptionId: Id<"selectorOptions">,
): Promise<void> {
  const all = await ctx.db
    .query("cardChecklist")
    .withIndex("by_selector_option", (q: any) =>
      q.eq("selectorOptionId", selectorOptionId),
    )
    .collect();
  const sorted = [...all].sort((a, b) => compareCardNumbers(a.cardNumber, b.cardNumber));
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].sortOrder !== i) {
      await ctx.db.patch(sorted[i]._id, { sortOrder: i });
    }
  }
}

export const storeCardChecklist = mutation({
  args: {
    selectorOptionId: v.id("selectorOptions"),
    cards: v.array(richChecklistCardValidator),
  },
  returns: v.object({
    success: v.boolean(),
    count: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { selectorOptionId, cards } = args;

    // Get existing cards for this variant
    const existingCards = await ctx.db
      .query("cardChecklist")
      .withIndex("by_selector_option", (q) =>
        q.eq("selectorOptionId", selectorOptionId),
      )
      .collect();

    const existingByNumber = new Map<string, (typeof existingCards)[0]>();
    for (const card of existingCards) {
      existingByNumber.set(card.cardNumber, card);
    }

    const processedNumbers = new Set<string>();

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      processedNumbers.add(card.cardNumber);

      const existing = existingByNumber.get(card.cardNumber);
      if (existing) {
        // Merge platform data — keep prior IDs if the new payload omits one side
        const mergedPlatformData = {
          ...existing.platformData,
          ...card.platformData,
        };
        await ctx.db.patch(existing._id, {
          cardName: card.cardName,
          team: card.team,
          playerIds: card.playerIds,
          teamOnCardIds: card.teamOnCardIds,
          attributes: card.attributes,
          isRookie: card.isRookie,
          isRelic: card.isRelic,
          printRun: card.printRun,
          autographType: card.autographType,
          cardVariation: card.cardVariation,
          platformData: mergedPlatformData,
          sortOrder: i,
          lastUpdated: Date.now(),
        });
      } else {
        await ctx.db.insert("cardChecklist", {
          selectorOptionId,
          cardNumber: card.cardNumber,
          cardName: card.cardName,
          team: card.team,
          playerIds: card.playerIds,
          teamOnCardIds: card.teamOnCardIds,
          attributes: card.attributes,
          isRookie: card.isRookie,
          isRelic: card.isRelic,
          printRun: card.printRun,
          autographType: card.autographType,
          cardVariation: card.cardVariation,
          platformData: card.platformData,
          sortOrder: i,
          lastUpdated: Date.now(),
        });
      }
    }

    // Delete non-custom cards that weren't in the new set
    for (const existing of existingCards) {
      if (!processedNumbers.has(existing.cardNumber) && !existing.isCustom) {
        await ctx.db.delete(existing._id);
      }
    }

    // Re-stamp sortOrder by natural cardNumber so custom cards (which were
    // inserted with a snapshot-of-empty-checklist sortOrder of 0) interleave
    // correctly with the just-committed marketplace rows. Without this, a
    // custom card added when the checklist was empty stays at sortOrder=0
    // and ties with marketplace card index 0, making the visual ordering
    // unpredictable.
    await restampCardChecklistSortOrders(ctx, selectorOptionId);

    return { success: true, count: cards.length };
  },
});

export const addCustomCard = mutation({
  args: {
    selectorOptionId: v.id("selectorOptions"),
    cardNumber: v.string(),
    cardName: v.string(),
    team: v.optional(v.string()),
    attributes: v.optional(v.array(v.string())),
    // Player names the user wants linked to this custom card. Surface as
    // unknownPlayers on the next fetchCardChecklist run so the user can
    // confirm Wikidata enrichment via the UnknownEntitiesDialog.
    // commitCardChecklist clears confirmed names from pendingPlayerNames
    // so the dialog doesn't re-prompt for the same player.
    players: v.optional(v.array(v.string())),
    // Team names — same flow as players, but for the teams table.
    teams: v.optional(v.array(v.string())),
  },
  returns: v.id("cardChecklist"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const pendingPlayerNames = args.players
      ?.map((n) => n.trim())
      .filter((n) => n.length > 0);
    const pendingTeamNames = args.teams
      ?.map((n) => n.trim())
      .filter((n) => n.length > 0);

    // Insert with a placeholder sortOrder; restampCardChecklistSortOrders
    // below assigns the correct natural-cardNumber position. This way a
    // user can add #42 to a set already containing #1..#100 and the new
    // row slots between #41 and #43 instead of appended at the end.
    const id = await ctx.db.insert("cardChecklist", {
      selectorOptionId: args.selectorOptionId,
      cardNumber: args.cardNumber,
      cardName: args.cardName,
      team: args.team,
      attributes: args.attributes,
      platformData: {},
      isCustom: true,
      ...(pendingPlayerNames && pendingPlayerNames.length > 0
        ? { pendingPlayerNames }
        : {}),
      ...(pendingTeamNames && pendingTeamNames.length > 0
        ? { pendingTeamNames }
        : {}),
      sortOrder: 0,
      lastUpdated: Date.now(),
    });

    await restampCardChecklistSortOrders(ctx, args.selectorOptionId);

    return id;
  },
});

export const updateCard = mutation({
  args: {
    id: v.id("cardChecklist"),
    cardNumber: v.optional(v.string()),
    cardName: v.optional(v.string()),
    team: v.optional(v.string()),
    attributes: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, { ...filtered, lastUpdated: Date.now() });
    }
    return null;
  },
});

export const deleteCard = mutation({
  args: { id: v.id("cardChecklist") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

// Returns all `level=insert` rows under a variantType, each with its own
// `level=parallel` children inlined. Powers ParallelGroupingModal — one
// round trip pulls the full tree for the modal to render and diff against.
export const getInsertTreeByVariantType = query({
  args: { variantTypeId: v.id("selectorOptions") },
  returns: v.array(
    v.object({
      insert: v.object({
        _id: v.id("selectorOptions"),
        _creationTime: v.number(),
        level: levelValidator,
        value: v.string(),
        platformData: v.object({
          bsc: v.optional(v.union(v.string(), v.array(v.string()))),
          sportlots: v.optional(v.union(v.string(), v.array(v.string()))),
        }),
        parentId: v.optional(v.id("selectorOptions")),
        children: v.optional(v.array(v.id("selectorOptions"))),
        isCustom: v.optional(v.boolean()),
        createdByUserId: v.optional(v.string()),
        metadata: metadataValidator,
        lastUpdated: v.number(),
      }),
      parallels: v.array(
        v.object({
          _id: v.id("selectorOptions"),
          _creationTime: v.number(),
          level: levelValidator,
          value: v.string(),
          platformData: v.object({
            bsc: v.optional(v.union(v.string(), v.array(v.string()))),
            sportlots: v.optional(v.union(v.string(), v.array(v.string()))),
          }),
          parentId: v.optional(v.id("selectorOptions")),
          children: v.optional(v.array(v.id("selectorOptions"))),
          isCustom: v.optional(v.boolean()),
          createdByUserId: v.optional(v.string()),
          metadata: metadataValidator,
          lastUpdated: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const inserts = await ctx.db
      .query("selectorOptions")
      .withIndex("by_level_and_parent", (q) =>
        q.eq("level", "insert").eq("parentId", args.variantTypeId),
      )
      .collect();

    const tree: Array<{
      insert: (typeof inserts)[number];
      parallels: (typeof inserts)[number][];
    }> = [];
    for (const ins of inserts) {
      const parallels = await ctx.db
        .query("selectorOptions")
        .withIndex("by_level_and_parent", (q) =>
          q.eq("level", "parallel").eq("parentId", ins._id),
        )
        .collect();
      tree.push({ insert: ins, parallels });
    }
    return tree;
  },
});

// Atomic batch re-parenting for inserts/parallels under a single variantType.
//
// `promotions`: each entry moves an insert row down to be a parallel of a
// target insert under the same variantType. Source must be level=insert with
// no existing parallel children (otherwise we'd orphan a level — parallels
// are always terminal).
//
// `demotions`: each entry moves a parallel back up to be a top-level insert
// under the variantType.
//
// All assertions run before any patches so a partial failure rejects cleanly.
// Children arrays on parents are kept consistent.
export const applyParallelGroupings = mutation({
  args: {
    variantTypeId: v.id("selectorOptions"),
    promotions: v.array(
      v.object({
        insertId: v.id("selectorOptions"),
        targetInsertId: v.id("selectorOptions"),
      }),
    ),
    demotions: v.array(
      v.object({
        parallelId: v.id("selectorOptions"),
      }),
    ),
    // A parallel that's already under one insert moving to a different
    // insert's parallel list. Single patch (parentId), level stays.
    reparentings: v.optional(
      v.array(
        v.object({
          parallelId: v.id("selectorOptions"),
          newInsertId: v.id("selectorOptions"),
        }),
      ),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    promoted: v.number(),
    demoted: v.number(),
    reparented: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const variantType = await ctx.db.get(args.variantTypeId);
    if (!variantType) {
      throw new Error("Variant type not found");
    }
    if (variantType.level !== "variantType") {
      throw new Error(
        `applyParallelGroupings target must be a variantType row; got ${variantType.level}`,
      );
    }

    // Track in-memory children sets keyed by row id so multiple promotions/
    // demotions touching the same parent compose correctly without re-reading.
    const childrenMap = new Map<Id<"selectorOptions">, Set<Id<"selectorOptions">>>();
    const getChildren = async (
      id: Id<"selectorOptions">,
    ): Promise<Set<Id<"selectorOptions">>> => {
      let set = childrenMap.get(id);
      if (!set) {
        const row = await ctx.db.get(id);
        set = new Set(row?.children ?? []);
        childrenMap.set(id, set);
      }
      return set;
    };

    const now = Date.now();

    // ---- Validate everything first ----
    const promotionTargets: Array<{
      sourceId: Id<"selectorOptions">;
      targetId: Id<"selectorOptions">;
    }> = [];
    for (const p of args.promotions) {
      const source = await ctx.db.get(p.insertId);
      if (!source) throw new Error(`Source insert ${p.insertId} not found`);
      if (source.level !== "insert") {
        throw new Error(
          `Source ${p.insertId} is not an insert (level=${source.level})`,
        );
      }
      if (source.parentId !== args.variantTypeId) {
        throw new Error(
          `Source ${p.insertId} is not under variantType ${args.variantTypeId}`,
        );
      }
      const target = await ctx.db.get(p.targetInsertId);
      if (!target) throw new Error(`Target insert ${p.targetInsertId} not found`);
      if (target.level !== "insert") {
        throw new Error(
          `Target ${p.targetInsertId} is not an insert (level=${target.level})`,
        );
      }
      if (target.parentId !== args.variantTypeId) {
        throw new Error(
          `Target ${p.targetInsertId} is not under variantType ${args.variantTypeId}`,
        );
      }
      // Defensive: refuse to promote an insert that already has parallels
      // beneath it (would create parallels-of-parallels).
      const existingParallels = await ctx.db
        .query("selectorOptions")
        .withIndex("by_level_and_parent", (q) =>
          q.eq("level", "parallel").eq("parentId", p.insertId),
        )
        .first();
      if (existingParallels) {
        throw new Error(
          `Cannot promote insert "${source.value}" to parallel — it already has parallels beneath it.`,
        );
      }
      promotionTargets.push({ sourceId: p.insertId, targetId: p.targetInsertId });
    }

    const demotionTargets: Array<{
      parallelId: Id<"selectorOptions">;
      oldParentId: Id<"selectorOptions">;
    }> = [];
    for (const d of args.demotions) {
      const row = await ctx.db.get(d.parallelId);
      if (!row) throw new Error(`Parallel ${d.parallelId} not found`);
      if (row.level !== "parallel") {
        throw new Error(
          `Source ${d.parallelId} is not a parallel (level=${row.level})`,
        );
      }
      if (!row.parentId) {
        throw new Error(`Parallel ${d.parallelId} has no parent`);
      }
      demotionTargets.push({ parallelId: d.parallelId, oldParentId: row.parentId });
    }

    const reparentingTargets: Array<{
      parallelId: Id<"selectorOptions">;
      oldParentId: Id<"selectorOptions">;
      newParentId: Id<"selectorOptions">;
    }> = [];
    for (const r of args.reparentings ?? []) {
      const row = await ctx.db.get(r.parallelId);
      if (!row) throw new Error(`Parallel ${r.parallelId} not found`);
      if (row.level !== "parallel") {
        throw new Error(
          `Reparent source ${r.parallelId} is not a parallel (level=${row.level})`,
        );
      }
      if (!row.parentId) {
        throw new Error(`Parallel ${r.parallelId} has no parent`);
      }
      if (row.parentId === r.newInsertId) {
        // No-op: same parent. Skip silently.
        continue;
      }
      const target = await ctx.db.get(r.newInsertId);
      if (!target) throw new Error(`New insert ${r.newInsertId} not found`);
      if (target.level !== "insert") {
        throw new Error(
          `Reparent target ${r.newInsertId} is not an insert (level=${target.level})`,
        );
      }
      if (target.parentId !== args.variantTypeId) {
        throw new Error(
          `Reparent target ${r.newInsertId} is not under variantType ${args.variantTypeId}`,
        );
      }
      reparentingTargets.push({
        parallelId: r.parallelId,
        oldParentId: row.parentId,
        newParentId: r.newInsertId,
      });
    }

    // ---- Apply promotions ----
    const variantTypeChildren = await getChildren(args.variantTypeId);
    for (const { sourceId, targetId } of promotionTargets) {
      await ctx.db.patch(sourceId, {
        level: "parallel",
        parentId: targetId,
        lastUpdated: now,
      });
      variantTypeChildren.delete(sourceId);
      const targetChildren = await getChildren(targetId);
      targetChildren.add(sourceId);
    }

    // ---- Apply demotions ----
    for (const { parallelId, oldParentId } of demotionTargets) {
      await ctx.db.patch(parallelId, {
        level: "insert",
        parentId: args.variantTypeId,
        lastUpdated: now,
      });
      const oldParentChildren = await getChildren(oldParentId);
      oldParentChildren.delete(parallelId);
      variantTypeChildren.add(parallelId);
    }

    // ---- Apply reparentings ----
    for (const { parallelId, oldParentId, newParentId } of reparentingTargets) {
      await ctx.db.patch(parallelId, {
        parentId: newParentId,
        lastUpdated: now,
      });
      const oldChildren = await getChildren(oldParentId);
      oldChildren.delete(parallelId);
      const newChildren = await getChildren(newParentId);
      newChildren.add(parallelId);
    }

    // ---- Flush children-array updates ----
    for (const [id, set] of childrenMap) {
      await ctx.db.patch(id, { children: Array.from(set), lastUpdated: now });
    }

    return {
      success: true,
      promoted: promotionTargets.length,
      demoted: demotionTargets.length,
      reparented: reparentingTargets.length,
    };
  },
});

// Patches platformData (and optional metadata) onto a Base variantType row.
// Base is the terminal node in the cascade — its platform mapping lives on
// the variantType row itself, not on a child insert. Asserts the target is
// actually variantType=Base to prevent misuse on Insert/Parallel rows
// (which go through `storeReconciledOptions`).
export const setVariantTypePlatformData = mutation({
  args: {
    variantTypeId: v.id("selectorOptions"),
    platformData: v.object({
      bsc: v.optional(v.union(v.string(), v.array(v.string()))),
      sportlots: v.optional(v.union(v.string(), v.array(v.string()))),
    }),
    metadata: v.optional(v.object({
      cardNumberPrefix: v.optional(v.string()),
      isInsert: v.optional(v.boolean()),
      isParallel: v.optional(v.boolean()),
    })),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.variantTypeId);
    if (!row) {
      throw new Error("Variant type row not found");
    }
    if (row.level !== "variantType") {
      throw new Error(
        `setVariantTypePlatformData only operates on variantType rows; got ${row.level}`,
      );
    }
    if (row.value.toLowerCase().trim() !== "base") {
      throw new Error(
        `setVariantTypePlatformData only operates on Base variantTypes; got "${row.value}"`,
      );
    }
    const merged: Record<string, unknown> = {
      platformData: { ...row.platformData, ...args.platformData },
      lastUpdated: Date.now(),
    };
    if (args.metadata) {
      merged.metadata = { ...(row.metadata || {}), ...args.metadata };
    }
    await ctx.db.patch(args.variantTypeId, merged);
    return { success: true, message: "Stored Base mapping" };
  },
});

export const updateSelectorOptionMetadata = mutation({
  args: {
    id: v.id("selectorOptions"),
    metadata: v.object({
      cardNumberPrefix: v.optional(v.string()),
      isInsert: v.optional(v.boolean()),
      isParallel: v.optional(v.boolean()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Selector option not found");
    }
    await ctx.db.patch(args.id, {
      metadata: { ...(existing.metadata || {}), ...args.metadata },
      lastUpdated: Date.now(),
    });
    return null;
  },
});

// ===== ADMIN UTILITIES =====

/**
 * Full reset of Set Builder data. Deletes every row in `selectorOptions`
 * and `cardChecklist`. Intended for dev cleanup between test runs.
 *
 * Two layers of safety (enforced in the internal mutations below):
 * 1. requireAdmin — only the admin role can call this from a signed-in session.
 * 2. ALLOW_RESET_SET_BUILDER_DATA env var — must be set to "true" on the
 *    Convex deployment. Set on dev + preview + integration-test deployments
 *    (where E2E tests reset state between runs); unset on production.
 *    Without this gate, the admin user could accidentally wipe production
 *    data by clicking "Reset Set Builder Data" while pointed at prod.
 *
 * Implementation: this is an action that loops a paginated internal
 * mutation. A single mutation has a per-execution read limit of 4096
 * rows; on dev deployments where selectorOptions has accumulated many
 * thousands of rows from prior test runs, a single-pass `.collect()`
 * was throwing "Too many reads in a single function execution".
 */
const RESET_BATCH_SIZE = 500;

export const resetSetBuilderData = action({
  args: {},
  returns: v.object({
    selectorOptionsDeleted: v.number(),
    cardChecklistDeleted: v.number(),
    playersDeleted: v.number(),
    teamsDeleted: v.number(),
  }),
  handler: async (
    ctx,
  ): Promise<{
    selectorOptionsDeleted: number;
    cardChecklistDeleted: number;
    playersDeleted: number;
    teamsDeleted: number;
  }> => {
    // Auth and env-var gate are enforced in the internal mutations called
    // below — keeping the destructive guard as close to the actual delete
    // as possible. If either check fails on the first batch, the loop
    // exits before any rows are deleted.

    let selectorOptionsDeleted = 0;
    while (true) {
      const result = await ctx.runMutation(
        internal.selectorOptions.resetSelectorOptionsBatch,
        {},
      );
      selectorOptionsDeleted += result.deleted;
      if (!result.hasMore) break;
    }

    let cardChecklistDeleted = 0;
    while (true) {
      const result = await ctx.runMutation(
        internal.selectorOptions.resetCardChecklistBatch,
        {},
      );
      cardChecklistDeleted += result.deleted;
      if (!result.hasMore) break;
    }

    // Players + teams are populated alongside cardChecklist by the
    // commitCardChecklist flow. Wipe them too so subsequent dev/test
    // runs see a clean "unknown entities" state and the
    // UnknownEntitiesDialog re-opens for confirmation. Without this,
    // E2E flows that rely on the dialog appearing fail because the
    // entities from prior runs are already known.
    let playersDeleted = 0;
    while (true) {
      const result = await ctx.runMutation(
        internal.selectorOptions.resetPlayersBatch,
        {},
      );
      playersDeleted += result.deleted;
      if (!result.hasMore) break;
    }

    let teamsDeleted = 0;
    while (true) {
      const result = await ctx.runMutation(
        internal.selectorOptions.resetTeamsBatch,
        {},
      );
      teamsDeleted += result.deleted;
      if (!result.hasMore) break;
    }

    return { selectorOptionsDeleted, cardChecklistDeleted, playersDeleted, teamsDeleted };
  },
});

/**
 * Internal: delete up to RESET_BATCH_SIZE rows from selectorOptions.
 * Used by resetSetBuilderData (action) in a loop until no rows remain.
 */
export const resetSelectorOptionsBatch = internalMutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    if (process.env.ALLOW_RESET_SET_BUILDER_DATA !== "true") {
      throw new Error(
        "Reset Set Builder Data is not enabled in this environment. " +
          "Set ALLOW_RESET_SET_BUILDER_DATA=true on the Convex deployment to enable.",
      );
    }
    const rows = await ctx.db.query("selectorOptions").take(RESET_BATCH_SIZE);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { deleted: rows.length, hasMore: rows.length === RESET_BATCH_SIZE };
  },
});

/**
 * Internal: delete up to RESET_BATCH_SIZE rows from cardChecklist.
 * Used by resetSetBuilderData (action) in a loop until no rows remain.
 */
export const resetCardChecklistBatch = internalMutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    if (process.env.ALLOW_RESET_SET_BUILDER_DATA !== "true") {
      throw new Error(
        "Reset Set Builder Data is not enabled in this environment. " +
          "Set ALLOW_RESET_SET_BUILDER_DATA=true on the Convex deployment to enable.",
      );
    }
    const rows = await ctx.db.query("cardChecklist").take(RESET_BATCH_SIZE);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { deleted: rows.length, hasMore: rows.length === RESET_BATCH_SIZE };
  },
});

/**
 * Internal: delete up to RESET_BATCH_SIZE rows from players.
 * Used by resetSetBuilderData (action) in a loop until no rows remain.
 */
export const resetPlayersBatch = internalMutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    if (process.env.ALLOW_RESET_SET_BUILDER_DATA !== "true") {
      throw new Error(
        "Reset Set Builder Data is not enabled in this environment. " +
          "Set ALLOW_RESET_SET_BUILDER_DATA=true on the Convex deployment to enable.",
      );
    }
    const rows = await ctx.db.query("players").take(RESET_BATCH_SIZE);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { deleted: rows.length, hasMore: rows.length === RESET_BATCH_SIZE };
  },
});

/**
 * Internal: delete up to RESET_BATCH_SIZE rows from teams.
 * Used by resetSetBuilderData (action) in a loop until no rows remain.
 */
export const resetTeamsBatch = internalMutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    if (process.env.ALLOW_RESET_SET_BUILDER_DATA !== "true") {
      throw new Error(
        "Reset Set Builder Data is not enabled in this environment. " +
          "Set ALLOW_RESET_SET_BUILDER_DATA=true on the Convex deployment to enable.",
      );
    }
    const rows = await ctx.db.query("teams").take(RESET_BATCH_SIZE);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { deleted: rows.length, hasMore: rows.length === RESET_BATCH_SIZE };
  },
});

/**
 * One-time cleanup: deletes legacy child rows under Base variantTypes.
 *
 * Before Base became a terminal node, the sync flow created a single
 * `level=insert` row under each Base variantType to hold the SL/BSC
 * platform mapping and any synced cardChecklist. This mutation removes
 * those orphan rows (and any parallels under them, plus their checklist
 * entries) so the Base variantType row itself can carry the platform
 * mapping. Custom cards/inserts under those rows are dropped — by user
 * direction.
 *
 * Re-runnable: idempotent. After the first run, no Base variantTypes will
 * have children and subsequent runs are no-ops.
 */
export const wipeLegacyBaseChildren = mutation({
  args: {},
  returns: v.object({
    baseVariantTypesScanned: v.number(),
    insertsDeleted: v.number(),
    parallelsDeleted: v.number(),
    cardChecklistRowsDeleted: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const baseVariantTypes = (
      await ctx.db.query("selectorOptions").withIndex("by_level").collect()
    ).filter(
      (row) =>
        row.level === "variantType" &&
        row.value.toLowerCase().trim() === "base",
    );

    let insertsDeleted = 0;
    let parallelsDeleted = 0;
    let cardChecklistRowsDeleted = 0;

    for (const baseVT of baseVariantTypes) {
      const inserts = await ctx.db
        .query("selectorOptions")
        .withIndex("by_level_and_parent", (q) =>
          q.eq("level", "insert").eq("parentId", baseVT._id),
        )
        .collect();

      for (const ins of inserts) {
        const parallels = await ctx.db
          .query("selectorOptions")
          .withIndex("by_level_and_parent", (q) =>
            q.eq("level", "parallel").eq("parentId", ins._id),
          )
          .collect();

        for (const par of parallels) {
          const parCards = await ctx.db
            .query("cardChecklist")
            .withIndex("by_selector_option", (q) =>
              q.eq("selectorOptionId", par._id),
            )
            .collect();
          for (const c of parCards) {
            await ctx.db.delete(c._id);
            cardChecklistRowsDeleted += 1;
          }
          await ctx.db.delete(par._id);
          parallelsDeleted += 1;
        }

        const insCards = await ctx.db
          .query("cardChecklist")
          .withIndex("by_selector_option", (q) =>
            q.eq("selectorOptionId", ins._id),
          )
          .collect();
        for (const c of insCards) {
          await ctx.db.delete(c._id);
          cardChecklistRowsDeleted += 1;
        }
        await ctx.db.delete(ins._id);
        insertsDeleted += 1;
      }

      await ctx.db.patch(baseVT._id, { children: [], lastUpdated: Date.now() });
    }

    return {
      baseVariantTypesScanned: baseVariantTypes.length,
      insertsDeleted,
      parallelsDeleted,
      cardChecklistRowsDeleted,
    };
  },
});

// ===== ACTIONS (Orchestrators) =====

export const fetchAggregatedOptions = action({
  args: {
    level: levelValidator,
    parentId: v.optional(v.id("selectorOptions")),
    parentFilters: v.optional(
      v.object({
        sport: v.optional(v.string()),
        year: v.optional(v.string()),
        manufacturer: v.optional(v.string()),
        setName: v.optional(v.string()),
        variantType: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    optionsCount: v.number(),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string; optionsCount: number }> => {
    // Admin check is outside the try/catch so authorization errors surface
    // cleanly to the client instead of being rewritten as "Failed to fetch
    // options: Admin access required" by the generic catch below.
    await requireAdmin(ctx);
    try {
      const { level, parentId, parentFilters } = args;

      console.log(
        `[fetchAggregatedOptions] Fetching ${level} options with filters:`,
        parentFilters,
      );

      // Build platform-specific filters from the ancestor chain so each
      // adapter receives its own slugs instead of display labels. Catch
      // missing slugs for BSC at the levels it actually filters on; SL
      // is intentionally not preconditioned because its adapter does its
      // own DB lookup / has no setName-level concept (see fetchCardChecklist).
      let slPlatformFilters: Record<string, string> | undefined;
      let bscPlatformFilters: Record<string, string[]> | undefined;
      const aggMissingBsc: string[] = [];

      if (parentId) {
        const chain = await ctx.runQuery(
          api.selectorOptions.getAncestorChain,
          { id: parentId },
        );

        slPlatformFilters = {};
        bscPlatformFilters = {};

        const BSC_REQUIRED = new Set(["sport", "year", "setName"]);

        for (const ancestor of chain) {
          const lvl = ancestor.level;
          if (ancestor.platformData?.sportlots) {
            slPlatformFilters[lvl] = ancestor.platformData.sportlots;
          }
          if (ancestor.platformData?.bsc) {
            const bscVal = ancestor.platformData.bsc;
            bscPlatformFilters[lvl] = Array.isArray(bscVal) ? bscVal : [bscVal];
          } else if (BSC_REQUIRED.has(lvl)) {
            aggMissingBsc.push(`${lvl}=${ancestor.value}`);
          } else if (ancestor.value) {
            // Display-value fallback acceptable for non-required levels
            // only (manufacturer/variantType-style display passthroughs).
            bscPlatformFilters[lvl] = [ancestor.value.toLowerCase()];
          }
        }

        console.log(
          `[fetchAggregatedOptions] Resolved platform filters — SL:`,
          slPlatformFilters,
          `BSC:`,
          bscPlatformFilters,
        );
      }

      if (aggMissingBsc.length > 0) {
        const msg =
          `Cannot sync ${level} options — ancestor rows are missing BSC platform ` +
          `slugs on: ${aggMissingBsc.join(", ")}. Upstream selectorOptions ` +
          `hydration did not write the BSC slugs we need.`;
        console.error(`[fetchAggregatedOptions] precondition failed: ${msg}`);
        return {
          success: false,
          message: msg,
          optionsCount: 0,
        };
      }

      const allOptions: Array<{
        value: string;
        platformData: {
          bsc?: string | string[];
          sportlots?: string;
        };
      }> = [];

      const platformErrors: Record<string, string> = {};

      // Fetch SportLots and BSC in parallel. Sequential awaits gave a worst-
      // case latency of SL_TIMEOUT + BSC_TIMEOUT (~60s) and overran the
      // 10s UI budget on cold Cloud Run revisions of the browser service.
      // Promise.allSettled keeps one slow/failing platform from blocking
      // the other; per-platform errors are still captured into
      // platformErrors for the PostHog event + warning suffix.
      const [slSettled, bscSettled] = await Promise.allSettled([
        ctx.runAction(api.adapters.sportlots.fetchSportLotsSelectorOptions, {
          level,
          parentFilters: parentFilters || {},
          ...(slPlatformFilters ? { platformFilters: slPlatformFilters } : {}),
        }),
        ctx.runAction(api.adapters.buysportscards.fetchBscSelectorOptions, {
          level,
          parentFilters: parentFilters || {},
          ...(bscPlatformFilters ? { platformFilters: bscPlatformFilters } : {}),
        }),
      ]);

      if (slSettled.status === "fulfilled") {
        const sportlotsOptions = slSettled.value;
        if (sportlotsOptions.success && sportlotsOptions.options) {
          allOptions.push(
            ...sportlotsOptions.options.map((o: { value: string; platformValue: string }) => ({
              value: o.value,
              platformData: { sportlots: o.platformValue },
            })),
          );
        } else if (!sportlotsOptions.success) {
          platformErrors.sportlots = sportlotsOptions.message || "Unknown error";
        }
      } else {
        const msg = slSettled.reason instanceof Error ? slSettled.reason.message : "Unknown error";
        platformErrors.sportlots = msg;
        console.error(`[fetchAggregatedOptions] SportLots error:`, slSettled.reason);
      }

      if (bscSettled.status === "fulfilled") {
        const bscOptions = bscSettled.value;
        if (bscOptions.success && bscOptions.options) {
          allOptions.push(
            ...bscOptions.options.map((o: { value: string; platformValue: string }) => ({
              value: o.value,
              platformData: { bsc: o.platformValue },
            })),
          );
        } else if (!bscOptions.success) {
          platformErrors.bsc = bscOptions.message || "Unknown error";
        }
      } else {
        const msg = bscSettled.reason instanceof Error ? bscSettled.reason.message : "Unknown error";
        platformErrors.bsc = msg;
        console.error(`[fetchAggregatedOptions] BSC error:`, bscSettled.reason);
      }

      // Debug: log platform errors and result counts
      if (Object.keys(platformErrors).length > 0) {
        console.error(`[fetchAggregatedOptions] Platform errors for ${level}:`, JSON.stringify(platformErrors));
      }

      // 3. Deduplicate by normalized value
      const valueMap = new Map<
        string,
        {
          value: string;
          platformData: { bsc?: string | string[]; sportlots?: string };
        }
      >();

      for (const option of allOptions) {
        const normalizedValue = option.value.toLowerCase().trim();
        const existing = valueMap.get(normalizedValue);

        if (existing) {
          // Merge platform data
          if (option.platformData.sportlots) {
            existing.platformData.sportlots = option.platformData.sportlots;
          }
          if (option.platformData.bsc) {
            existing.platformData.bsc = option.platformData.bsc;
          }
        } else {
          valueMap.set(normalizedValue, {
            value: option.value,
            platformData: { ...option.platformData },
          });
        }
      }

      const deduped = Array.from(valueMap.values());

      // 4. Log adapter errors to PostHog if any adapter failed
      if (Object.keys(platformErrors).length > 0) {
        let userId = "anonymous";
        try {
          userId = await getCurrentUserId(ctx) || "anonymous";
        } catch {
          // auth context may not be available
        }
        await ctx.runAction(internal.posthog.captureEvent, {
          distinctId: userId,
          event: "selector_sync_failed",
          properties: {
            level,
            platformErrors,
            parentFilters: parentFilters || {},
            totalOptionsReturned: deduped.length,
          },
        }).catch((err: unknown) => {
          console.error("[fetchAggregatedOptions] Failed to send PostHog event:", err);
        });
      }

      // 5. If no options were fetched from any platform, report failure
      if (deduped.length === 0) {
        return {
          success: false,
          message: `No ${level} options returned from any platform. Check that credentials are configured for BSC and SportLots.`,
          optionsCount: 0,
        };
      }

      // 5. Store via mutation
      const result: { success: boolean; message: string; optionsCount: number } = await ctx.runMutation(
        api.selectorOptions.storeSelectorOptions,
        {
          level,
          options: deduped,
          parentId,
        },
      );

      // Surface partial-failure warnings in the user-visible message.
      // Without this, a platform that silently returns zero options looks
      // indistinguishable from "platform disabled" and regressions go
      // unnoticed until someone reads the PostHog dashboard.
      const warningSuffix =
        Object.keys(platformErrors).length > 0
          ? ` (Warnings: ${Object.entries(platformErrors)
              .map(([plat, err]) => `${plat}: ${err}`)
              .join("; ")})`
          : "";

      return {
        success: result.success,
        message: result.message + warningSuffix,
        optionsCount: result.optionsCount,
      };
    } catch (error) {
      console.error(`[fetchAggregatedOptions] Error:`, error);
      return {
        success: false,
        message: `Failed to fetch options: ${error instanceof Error ? error.message : "Unknown error"}`,
        optionsCount: 0,
      };
    }
  },
});

/**
 * Fetch BSC sets for a sport/year and distribute them across existing
 * manufacturer parents by matching the set name prefix. Unmatched sets
 * go under "All Brands".
 */
export const syncSetsAcrossManufacturers = action({
  args: {
    yearId: v.id("selectorOptions"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    totalSets: v.number(),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string; totalSets: number }> => {
    await requireAdmin(ctx);
    try {
      // 1. Build ancestor chain from yearId to get sport/year values + BSC slugs
      const chain: Array<{
        _id: Id<"selectorOptions">;
        level: Level;
        value: string;
        platformData: { bsc?: string | string[]; sportlots?: string };
      }> = await ctx.runQuery(
        api.selectorOptions.getAncestorChain,
        { id: args.yearId },
      );

      const sportAncestor = chain.find((a: { level: string }) => a.level === "sport");
      const yearAncestor = chain.find((a: { level: string }) => a.level === "year");
      if (!sportAncestor || !yearAncestor) {
        return { success: false, message: "Could not resolve sport/year ancestors", totalSets: 0 };
      }

      // Build BSC filters (sport + year only)
      const bscPlatformFilters: Record<string, string[]> = {};
      if (sportAncestor.platformData?.bsc) {
        const v = sportAncestor.platformData.bsc;
        bscPlatformFilters.sport = Array.isArray(v) ? v : [v];
      } else {
        bscPlatformFilters.sport = [sportAncestor.value.toLowerCase()];
      }
      if (yearAncestor.platformData?.bsc) {
        const v = yearAncestor.platformData.bsc;
        bscPlatformFilters.year = Array.isArray(v) ? v : [v];
      } else {
        bscPlatformFilters.year = [yearAncestor.value.toLowerCase()];
      }

      // 2. Fetch sets from BSC
      const bscResult: { success: boolean; options: Array<{ value: string; platformValue: string }>; message?: string } = await ctx.runAction(
        api.adapters.buysportscards.fetchBscSelectorOptions,
        {
          level: "setName",
          parentFilters: {
            sport: sportAncestor.value,
            year: yearAncestor.value,
          },
          platformFilters: bscPlatformFilters,
        },
      );

      if (!bscResult.success || bscResult.options.length === 0) {
        return {
          success: false,
          message: bscResult.message || "No sets returned from BSC",
          totalSets: 0,
        };
      }

      console.log(`[syncSetsAcrossManufacturers] BSC returned ${bscResult.options.length} sets`);

      // 3. Get all manufacturers for this year
      const manufacturers = await ctx.runQuery(
        api.selectorOptions.getSelectorOptions,
        { level: "manufacturer", parentId: args.yearId },
      );

      // Build a lookup: normalized manufacturer name → manufacturer doc
      const mfrLookup = new Map<string, { _id: Id<"selectorOptions">; value: string }>();
      let allBrandsId: Id<"selectorOptions"> | null = null;

      for (const mfr of manufacturers) {
        const norm = mfr.value.toLowerCase().trim();
        mfrLookup.set(norm, { _id: mfr._id, value: mfr.value });
        if (norm === "all brands") {
          allBrandsId = mfr._id;
        }
      }

      // Create "All Brands" if it doesn't exist
      if (!allBrandsId) {
        allBrandsId = await ctx.runMutation(
          api.selectorOptions.addCustomSelectorOption,
          {
            level: "manufacturer",
            value: "All Brands",
            parentId: args.yearId,
          },
        );
      }

      // 4. Match each BSC set to a manufacturer by prefix
      // Sort manufacturers by name length descending so "Upper Deck" matches
      // before "Upper" and more specific names win.
      const sortedMfrs = [...mfrLookup.entries()].sort(
        (a, b) => b[0].length - a[0].length,
      );

      const grouped = new Map<string, Array<{ value: string; platformValue: string }>>();

      for (const set of bscResult.options) {
        const setNameLower = set.value.toLowerCase().trim();
        let matchedMfrId: string | null = null;

        for (const [mfrName, mfr] of sortedMfrs) {
          if (mfrName === "all brands") continue;
          if (setNameLower.startsWith(mfrName + " ") || setNameLower === mfrName) {
            matchedMfrId = mfr._id;
            break;
          }
        }

        const parentId = matchedMfrId || allBrandsId!;
        if (!grouped.has(parentId)) {
          grouped.set(parentId, []);
        }
        grouped.get(parentId)!.push(set);
      }

      // 5. Store sets under each manufacturer
      let totalStored = 0;
      for (const [parentId, sets] of grouped) {
        const result = await ctx.runMutation(
          api.selectorOptions.storeSelectorOptions,
          {
            level: "setName",
            parentId: parentId as Id<"selectorOptions">,
            options: sets.map((s) => ({
              value: s.value,
              platformData: { bsc: s.platformValue },
            })),
          },
        );
        totalStored += result.optionsCount;
      }

      // Build summary
      const summary: string[] = [];
      for (const [parentId, sets] of grouped) {
        const mfr = manufacturers.find((m: { _id: string }) => m._id === parentId);
        const name = mfr?.value || "All Brands";
        summary.push(`${name}: ${sets.length}`);
      }

      return {
        success: true,
        message: `Distributed ${totalStored} sets across manufacturers (${summary.join(", ")})`,
        totalSets: totalStored,
      };
    } catch (error) {
      console.error("[syncSetsAcrossManufacturers] Error:", error);
      return {
        success: false,
        message: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        totalSets: 0,
      };
    }
  },
});

/**
 * Lowercase + strip punctuation + token-sort. Same shape as
 * normalizePlayerName/normalizeTeamName in convex/players.ts and
 * convex/teams.ts — kept inline here to avoid pulling those modules into
 * the action runtime (Convex bundles per-file). Used both for fuzzy
 * matching during reconciliation and for matching against the existing
 * players/teams tables.
 */
function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,'"`’]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/**
 * Jaro similarity between two strings. Returns 0..1. Implementation
 * follows the canonical algorithm: count matching characters within a
 * window of floor(max(|a|,|b|)/2)-1 positions, then count transpositions.
 */
function jaroSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matches = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (
    (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3
  );
}

/**
 * Jaro-Winkler — Jaro plus a prefix bonus that rewards strings sharing
 * an initial prefix. Used for player-name reconciliation across BSC and
 * SportLots when card numbers don't match (parallels, inserts with
 * different numbering schemes between marketplaces).
 *
 * Threshold of 0.92 picks up "Mike Trout" ≈ "Michael Trout" while
 * keeping "Mike Trout" and "Mike Stanton" distinct.
 */
function jaroWinkler(a: string, b: string): number {
  const jaro = jaroSimilarity(a, b);
  let prefix = 0;
  const max = Math.min(4, a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

interface ReconciledCard {
  cardNumber: string;
  cardName: string;
  team?: string;
  teams?: string[];
  players?: string[];
  attributes?: string[];
  isRookie?: boolean;
  isRelic?: boolean;
  printRun?: number;
  autographType?: string;
  cardVariation?: string;
  platformData: { bsc?: string; sportlots?: string };
  // NEO-6: per-card source set IDs when the variant has multiple attached.
  // Drives the "Series 1 / Series 2" filter and the per-card source badge.
  sourcePlatformIds?: { bsc?: string; sportlots?: string };
  /**
   * Reconciliation marker for cards that landed on only one side. UI
   * surfaces these as needing human review; reconciled cards (from both
   * sides) carry no such tag.
   */
  unmatched?: "bsc" | "sl";
}

const previewCardValidator = v.object({
  cardNumber: v.string(),
  cardName: v.string(),
  team: v.optional(v.string()),
  teams: v.optional(v.array(v.string())),
  players: v.optional(v.array(v.string())),
  attributes: v.optional(v.array(v.string())),
  isRookie: v.optional(v.boolean()),
  isRelic: v.optional(v.boolean()),
  printRun: v.optional(v.number()),
  autographType: v.optional(v.string()),
  cardVariation: v.optional(v.string()),
  platformData: v.object({
    bsc: v.optional(v.string()),
    sportlots: v.optional(v.string()),
  }),
  // NEO-6: source set IDs per side (only populated when variant has
  // multiple attached IDs on that side).
  sourcePlatformIds: v.optional(
    v.object({
      bsc: v.optional(v.string()),
      sportlots: v.optional(v.string()),
    }),
  ),
  unmatched: v.optional(v.union(v.literal("bsc"), v.literal("sl"))),
});

/**
 * Action — fetch reconciled checklist preview without persisting.
 *
 * Pipeline:
 *   1. Resolve ancestor chain → sport, year, set/variant filters
 *   2. Fetch BSC + SL in parallel; tolerate single-side failure
 *   3. Reconcile by cardNumber (with cardNumberPrefix from selectorOption
 *      metadata applied), then BSC→SL cross-ref via BSC.sportlotsRef,
 *      then Jaro-Winkler ≥ 0.92 fuzzy match on player names
 *   4. Bucket player/team names against existing players/teams tables
 *      → return `unknownPlayers` / `unknownTeams` for the dialog
 *
 * Persistence happens in commitCardChecklist after the user confirms
 * unknowns. Splitting fetch/commit lets the dialog gate entity creation
 * — per the explicit requirement that the user confirm new players/
 * teams before they hit the database.
 */
export const fetchCardChecklist = action({
  args: {
    selectorOptionId: v.id("selectorOptions"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    sport: v.optional(v.string()),
    cards: v.array(previewCardValidator),
    unknownPlayers: v.array(v.string()),
    unknownTeams: v.array(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    message: string;
    sport?: string;
    cards: Array<{
      cardNumber: string;
      cardName: string;
      team?: string;
      teams?: string[];
      players?: string[];
      attributes?: string[];
      isRookie?: boolean;
      isRelic?: boolean;
      printRun?: number;
      autographType?: string;
      cardVariation?: string;
      platformData: { bsc?: string; sportlots?: string };
      sourcePlatformIds?: { bsc?: string; sportlots?: string };
      unmatched?: "bsc" | "sl";
    }>;
    unknownPlayers: string[];
    unknownTeams: string[];
  }> => {
    try {
      // Resolve ancestor chain → filter map + sport + cardNumberPrefix
      const chain = await ctx.runQuery(
        api.selectorOptions.getAncestorChain,
        { id: args.selectorOptionId },
      );

      const filters: Record<string, string> = {};
      // NEO-6: both sides may now be arrays at any level. We keep the
      // arrays here and fan out / pass through downstream.
      const slPlatformFilters: Record<string, string[]> = {};
      const bscPlatformFilters: Record<string, string[]> = {};
      let sport: string | undefined;
      let cardNumberPrefix: string | undefined;

      for (const ancestor of chain) {
        filters[ancestor.level] = ancestor.value;
        if (ancestor.level === "sport") sport = ancestor.value.toLowerCase();
        if (ancestor.metadata?.cardNumberPrefix) {
          cardNumberPrefix = ancestor.metadata.cardNumberPrefix;
        }
        if (ancestor.platformData?.sportlots) {
          const slVal = ancestor.platformData.sportlots;
          slPlatformFilters[ancestor.level] = Array.isArray(slVal) ? slVal : [slVal];
        }
        if (ancestor.platformData?.bsc) {
          const bscVal = ancestor.platformData.bsc;
          bscPlatformFilters[ancestor.level] = Array.isArray(bscVal) ? bscVal : [bscVal];
        }
      }

      // Data-integrity precondition for BSC only. BSC is a stable service
      // that consistently returns data for properly-filtered queries; a
      // 0-card result almost always means our filter was incomplete.
      // Surface this loudly instead of silently sending an under-filtered
      // request and treating the empty response as "the marketplace had
      // nothing".
      //
      // Required BSC platform data: sport, year, setName. These are the
      // levels where BSC has a canonical slug (per LEVEL_TO_BSC_FACET in
      // adapters/buysportscards.ts) AND where the slug is required for a
      // properly filtered query.
      //
      // Insert is NOT required: users can create custom insert variants
      // (e.g. "Prizm Gold") that BSC has no slug for. In that case we
      // fall back to filtering only by variantType — BSC returns the
      // wider set and reconciliation matches cards by cardNumber against
      // SL's narrower custom-variant result.
      //
      // SL is not preconditioned: per `sportlots.ts:160-164`, SL
      // deliberately returns no options at setName/variantType (SL's
      // data model combines set+variant at the "insert" level), and
      // `fetchSportLotsChecklist` resolves the radio-button ID itself
      // when no SL slug is passed in.
      const BSC_REQUIRED_LEVELS = new Set(["sport", "year", "setName"]);
      const missingBsc: string[] = [];
      for (const ancestor of chain) {
        if (BSC_REQUIRED_LEVELS.has(ancestor.level) && !ancestor.platformData?.bsc) {
          missingBsc.push(`${ancestor.level}=${ancestor.value}`);
        }
      }
      if (missingBsc.length > 0) {
        const msg =
          `Cannot fetch checklist — ancestor rows are missing BSC platform slugs ` +
          `on: ${missingBsc.join(", ")}. Upstream selectorOptions hydration did ` +
          `not write the BSC slugs we need (this is a bug in our sync pipeline, ` +
          `not a marketplace issue).`;
        console.error(`[fetchCardChecklist] precondition failed: ${msg}`);
        return {
          success: false,
          message: msg,
          sport,
          cards: [],
          unknownPlayers: [],
          unknownTeams: [],
        };
      }

      console.log(
        `[fetchCardChecklist] sport=${sport} prefix=${cardNumberPrefix}`,
        `filters:`, filters,
      );

      // NEO-6: SL adapter takes one set ID at a time. When the active
      // SL level has multiple attached IDs (operator-attached extras),
      // fan out one call per ID and tag each returned card with its
      // source set ID. Dedup by cardNumber across the merged result —
      // first source wins, conflicts are logged.
      type SlCard = {
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
        sourceSlSetId?: string;
      };

      // Find which level (if any) has multiple attached SL IDs. Phase 1
      // expects this only at variantType/insert/parallel rows; warn if it
      // appears elsewhere so we notice unexpected data shape.
      //
      // Cap to MAX_SL_FAN_OUT to bound the number of parallel SL HTTP
      // calls per fetch (matches `MAX_ATTACHED_PER_SIDE` on the attach
      // path; defense-in-depth in case extras were attached pre-cap).
      const MAX_SL_FAN_OUT = 10;
      const slFanOut: { level: string; ids: string[] } | null = (() => {
        for (const [lvl, ids] of Object.entries(slPlatformFilters)) {
          if (ids.length > 1) {
            if (!["variantType", "insert", "parallel"].includes(lvl)) {
              console.warn(
                `[fetchCardChecklist] unexpected multi-SL at level=${lvl} (phase-1 expects variant levels only)`,
              );
            }
            const cappedIds = ids.slice(0, MAX_SL_FAN_OUT);
            if (cappedIds.length < ids.length) {
              console.warn(
                `[fetchCardChecklist] SL fan-out capped at ${MAX_SL_FAN_OUT} (had ${ids.length} attached at level=${lvl})`,
              );
            }
            return { level: lvl, ids: cappedIds };
          }
        }
        return null;
      })();

      const callSl = async (
        perCallFilters: Record<string, string>,
        sourceId: string | undefined,
      ): Promise<SlCard[]> => {
        const result = await ctx.runAction(
          api.adapters.sportlots.fetchSportLotsChecklist,
          {
            parentFilters: filters,
            platformFilters: perCallFilters,
          },
        ).catch((err) => {
          console.error(`[fetchCardChecklist] SportLots error:`, err);
          return { success: false, cards: [] as SlCard[], message: String(err) };
        });
        if (!result.success) return [];
        return (result.cards as SlCard[]).map((c) => ({
          ...c,
          sourceSlSetId: sourceId,
        }));
      };

      const slCardsRaw: SlCard[] = await (async () => {
        // Adapter signature is record<string,string>; flatten single-ID
        // entries down to scalars. Multi-ID entries are handled by fanning
        // out one call per ID at the fan-out level.
        const singletonFilters: Record<string, string> = {};
        for (const [lvl, ids] of Object.entries(slPlatformFilters)) {
          if (ids.length === 1) singletonFilters[lvl] = ids[0];
        }
        if (!slFanOut) {
          // No fan-out needed; single call (still tag source id when
          // exactly one SL set is attached at a variant level).
          const variantSlIds = ["variantType", "insert", "parallel"]
            .map((lvl) => slPlatformFilters[lvl]?.[0])
            .filter(Boolean) as string[];
          const sourceId =
            variantSlIds.length > 0 ? variantSlIds[variantSlIds.length - 1] : undefined;
          return await callSl(singletonFilters, sourceId);
        }
        // Multi-ID fan-out: one call per ID at the fan-out level.
        const perIdResults = await Promise.all(
          slFanOut.ids.map((slId) => {
            const perCall = { ...singletonFilters, [slFanOut.level]: slId };
            return callSl(perCall, slId);
          }),
        );
        // Dedup by cardNumber — first occurrence wins.
        const dedup = new Map<string, SlCard>();
        for (const cards of perIdResults) {
          for (const c of cards) {
            const existing = dedup.get(c.cardNumber);
            if (!existing) {
              dedup.set(c.cardNumber, c);
            } else if (existing.sourceSlSetId !== c.sourceSlSetId) {
              console.warn(
                `[fetchCardChecklist] SL cardNumber collision: ${c.cardNumber} ` +
                  `keptSource=${existing.sourceSlSetId} skippedSource=${c.sourceSlSetId}`,
              );
            }
          }
        }
        return Array.from(dedup.values());
      })();

      // BSC's bulk-upload API accepts multi-value facets in one call and
      // tags each card with its source set slug — no fan-out needed.
      const bscResult = await ctx.runAction(
        api.adapters.buysportscards.fetchBscChecklist,
        {
          parentFilters: filters,
          platformFilters: bscPlatformFilters,
        },
      ).catch((err) => {
        console.error(`[fetchCardChecklist] BSC error:`, err);
        return { success: false, cards: [] as any[], message: String(err) };
      });

      const slCards = slCardsRaw;
      const bscCards = (bscResult.success ? bscResult.cards : []) as Array<{
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
        sourceBscSetSlug?: string;
      }>;

      // Index SL by both cardNumber and (after prefix-strip) for prefix-aware
      // BSC matching, AND by sportlotsRef so BSC's built-in cross-reference
      // can short-circuit fuzzy matching.
      const slByNumber = new Map<string, typeof slCards[0]>();
      const slByRef = new Map<string, typeof slCards[0]>();
      for (const c of slCards) {
        slByNumber.set(c.cardNumber, c);
        if (c.sportlotsRef) slByRef.set(c.sportlotsRef, c);
      }

      const out: ReconciledCard[] = [];
      const claimedSlNumbers = new Set<string>();

      // 1. Walk BSC, attach matching SL data
      for (const bsc of bscCards) {
        const stripped = cardNumberPrefix && bsc.cardNumber.startsWith(cardNumberPrefix)
          ? bsc.cardNumber.slice(cardNumberPrefix.length)
          : bsc.cardNumber;

        let sl: typeof slCards[0] | undefined =
          (bsc.sportlotsRef && slByRef.get(bsc.sportlotsRef))
          || slByNumber.get(bsc.cardNumber)
          || slByNumber.get(stripped);

        // 2. Fuzzy fallback: pick the unclaimed SL card whose first player
        //    name is most similar to BSC's first player. Threshold 0.92.
        if (!sl && bsc.players?.[0]) {
          const target = normalizeName(bsc.players[0]);
          let best: { card: typeof slCards[0]; score: number } | null = null;
          for (const candidate of slCards) {
            if (claimedSlNumbers.has(candidate.cardNumber)) continue;
            const candName = candidate.cardName ? normalizeName(candidate.cardName) : "";
            if (!candName) continue;
            const score = jaroWinkler(target, candName);
            if (score >= 0.92 && (!best || score > best.score)) {
              best = { card: candidate, score };
            }
          }
          if (best) sl = best.card;
        }

        if (sl) claimedSlNumbers.add(sl.cardNumber);

        const attributes = Array.from(new Set([
          ...(bsc.attributes ?? []),
          ...(sl?.attributes ?? []),
        ]));
        const printRun = bsc.printRun ?? sl?.printRun;
        const players = bsc.players ?? (sl?.players ?? undefined);
        const teamsArr = bsc.teams ?? (sl?.teams ?? undefined);

        const sourcePlatformIds =
          bsc.sourceBscSetSlug || sl?.sourceSlSetId
            ? {
                bsc: bsc.sourceBscSetSlug,
                sportlots: sl?.sourceSlSetId,
              }
            : undefined;

        out.push({
          cardNumber: bsc.cardNumber,
          cardName: bsc.cardName || sl?.cardName || `Card #${bsc.cardNumber}`,
          team: bsc.team ?? sl?.team,
          teams: teamsArr,
          players,
          attributes: attributes.length ? attributes : undefined,
          isRookie: attributes.includes("RC") || undefined,
          isRelic: attributes.includes("RELIC") || undefined,
          printRun,
          autographType: bsc.autographType ?? sl?.autographType,
          cardVariation: bsc.cardVariation,
          platformData: {
            bsc: bsc.platformRef,
            sportlots: sl?.platformRef,
          },
          sourcePlatformIds,
        });
      }

      // 3. SL cards never claimed by BSC: emit as unmatched-bsc rows so
      //    a human can review (they may be valid cards BSC's seller catalog
      //    doesn't carry, or genuine numbering mismatches we should fix).
      for (const sl of slCards) {
        if (claimedSlNumbers.has(sl.cardNumber)) continue;
        out.push({
          cardNumber: sl.cardNumber,
          cardName: sl.cardName || `Card #${sl.cardNumber}`,
          team: sl.team,
          teams: sl.teams,
          players: sl.players,
          attributes: sl.attributes,
          isRookie: sl.attributes?.includes("RC") || undefined,
          isRelic: sl.attributes?.includes("RELIC") || undefined,
          printRun: sl.printRun,
          autographType: sl.autographType,
          platformData: { sportlots: sl.platformRef },
          sourcePlatformIds: sl.sourceSlSetId
            ? { sportlots: sl.sourceSlSetId }
            : undefined,
          unmatched: "bsc",
        });
      }

      // 4. Bucket unique player + team names against existing tables.
      //    Skip bucketing entirely if we can't infer sport (sets without
      //    a sport ancestor — shouldn't happen but guard anyway).
      const unknownPlayers: string[] = [];
      const unknownTeams: string[] = [];
      if (sport) {
        const playerSet = new Set<string>();
        const teamSet = new Set<string>();
        for (const c of out) {
          for (const p of c.players ?? []) if (p.trim()) playerSet.add(p.trim());
          for (const t of c.teams ?? []) if (t.trim()) teamSet.add(t.trim());
          if (c.team && c.team.trim() && !c.teams?.length) teamSet.add(c.team.trim());
        }

        // Custom cards (added via addCustomCard) can declare pending player /
        // team names that should also be surfaced as unknown until the user
        // confirms them via the dialog. Without this pass, users who add a
        // custom card for a brand-new player would never get prompted to
        // enrich that player via the standard confirmation flow.
        const customRows = await ctx.runQuery(
          api.selectorOptions.getCardChecklist,
          { selectorOptionId: args.selectorOptionId },
        );
        for (const r of customRows) {
          for (const p of r.pendingPlayerNames ?? []) {
            if (p.trim()) playerSet.add(p.trim());
          }
          for (const t of r.pendingTeamNames ?? []) {
            if (t.trim()) teamSet.add(t.trim());
          }
        }

        for (const name of playerSet) {
          const existing = await ctx.runQuery(api.players.findByNameAndSport, { name, sport });
          if (!existing) unknownPlayers.push(name);
        }
        for (const name of teamSet) {
          const existing = await ctx.runQuery(api.teams.findByNameAndSport, { name, sport });
          if (!existing) unknownTeams.push(name);
        }
      }

      console.log(
        `[fetchCardChecklist] reconciled ${out.length} cards`,
        `(${unknownPlayers.length} new players, ${unknownTeams.length} new teams)`,
      );

      return {
        success: true,
        message: `Found ${out.length} cards${unknownPlayers.length || unknownTeams.length ? `; ${unknownPlayers.length} new players + ${unknownTeams.length} new teams need confirmation` : ""}`,
        sport,
        cards: out,
        unknownPlayers,
        unknownTeams,
      };
    } catch (error) {
      console.error(`[fetchCardChecklist] Error:`, error);
      return {
        success: false,
        message: `Failed to fetch checklist: ${error instanceof Error ? error.message : "Unknown error"}`,
        cards: [],
        unknownPlayers: [],
        unknownTeams: [],
      };
    }
  },
});

/**
 * Mutation — commit a fetched checklist preview. Confirmed unknowns are
 * created via findOrCreate (player/team), card playerIds/teamOnCardIds
 * are resolved, the checklist is persisted, and Wikidata enrichment is
 * scheduled in the background for newly created entities.
 *
 * confirmedNewPlayers / confirmedNewTeams: subset of unknownPlayers/
 * unknownTeams the user approved in the dialog. Skipped names are kept
 * as free-text on the card (`team`) and DON'T get an entity row.
 */
export const commitCardChecklist = mutation({
  args: {
    selectorOptionId: v.id("selectorOptions"),
    sport: v.string(),
    cards: v.array(previewCardValidator),
    confirmedNewPlayers: v.array(v.string()),
    confirmedNewTeams: v.array(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    count: v.number(),
    createdPlayerIds: v.array(v.id("players")),
    createdTeamIds: v.array(v.id("teams")),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    count: number;
    createdPlayerIds: Array<Id<"players">>;
    createdTeamIds: Array<Id<"teams">>;
  }> => {
    await requireAdmin(ctx);
    const userId = await getCurrentUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Helper — same normalization as players.ts/teams.ts
    const norm = (s: string) =>
      s.toLowerCase()
        .replace(/[.,'"`’]/g, "")
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .sort()
        .join(" ");

    // Resolve every player/team name appearing on any card to an Id where
    // possible. Build name → Id maps so the per-card resolution below is
    // O(1) instead of repeated DB lookups.
    const allPlayerNames = new Set<string>();
    const allTeamNames = new Set<string>();
    for (const c of args.cards) {
      for (const p of c.players ?? []) if (p.trim()) allPlayerNames.add(p.trim());
      for (const t of c.teams ?? []) if (t.trim()) allTeamNames.add(t.trim());
      if (c.team && c.team.trim() && !c.teams?.length) allTeamNames.add(c.team.trim());
    }

    // Fold in pending* names from custom cards on this variant. Those rows
    // aren't in args.cards (which is the BSC/SL fetch preview), so without
    // this pass a confirmedNewPlayers entry pointing at a custom card's
    // pending player would never get inserted into the players table.
    const existingForPending = await ctx.db
      .query("cardChecklist")
      .withIndex("by_selector_option", (q) =>
        q.eq("selectorOptionId", args.selectorOptionId),
      )
      .collect();
    for (const r of existingForPending) {
      if (!r.isCustom) continue;
      for (const p of r.pendingPlayerNames ?? []) {
        if (p.trim()) allPlayerNames.add(p.trim());
      }
      for (const t of r.pendingTeamNames ?? []) {
        if (t.trim()) allTeamNames.add(t.trim());
      }
    }

    const confirmedPlayersNorm = new Set(args.confirmedNewPlayers.map(norm));
    const confirmedTeamsNorm = new Set(args.confirmedNewTeams.map(norm));

    const playerIdByName = new Map<string, Id<"players">>();
    const createdPlayerIds: Array<Id<"players">> = [];
    for (const name of allPlayerNames) {
      const normalized = norm(name);
      // Compound index returns 0 or 1 row per lookup — independent of how
      // many cross-sport duplicates of this normalized name exist.
      const existing = await ctx.db
        .query("players")
        .withIndex("by_name_normalized_and_sport", (q) =>
          q.eq("nameNormalized", normalized).eq("primarySport", args.sport),
        )
        .first();
      if (existing) {
        playerIdByName.set(name, existing._id);
      } else if (confirmedPlayersNorm.has(normalized)) {
        const id = await ctx.db.insert("players", {
          name: name.trim(),
          nameNormalized: normalized,
          primarySport: args.sport,
          createdByUserId: userId,
          lastUpdated: Date.now(),
        });
        playerIdByName.set(name, id);
        createdPlayerIds.push(id);
      }
      // else: user skipped this name — leave unresolved; card keeps free-text
    }

    const teamIdByName = new Map<string, Id<"teams">>();
    const createdTeamIds: Array<Id<"teams">> = [];
    for (const name of allTeamNames) {
      const normalized = norm(name);
      const existing = await ctx.db
        .query("teams")
        .withIndex("by_name_normalized_and_sport", (q) =>
          q.eq("nameNormalized", normalized).eq("sport", args.sport),
        )
        .first();
      if (existing) {
        teamIdByName.set(name, existing._id);
      } else if (confirmedTeamsNorm.has(normalized)) {
        const id = await ctx.db.insert("teams", {
          name: name.trim(),
          nameNormalized: normalized,
          sport: args.sport,
          lastUpdated: Date.now(),
        });
        teamIdByName.set(name, id);
        createdTeamIds.push(id);
      }
    }

    // Resolve per-card playerIds / teamOnCardIds. Cards whose names are
    // all skipped end up with empty arrays (left undefined).
    const richCards = args.cards.map((c) => {
      const playerIds: Array<Id<"players">> = [];
      for (const p of c.players ?? []) {
        const id = playerIdByName.get(p.trim());
        if (id) playerIds.push(id);
      }
      const teamOnCardIds: Array<Id<"teams">> = [];
      const teamSources = c.teams?.length ? c.teams : c.team ? [c.team] : [];
      for (const t of teamSources) {
        const id = teamIdByName.get(t.trim());
        if (id) teamOnCardIds.push(id);
      }
      return {
        cardNumber: c.cardNumber,
        cardName: c.cardName,
        team: c.team,
        playerIds: playerIds.length ? playerIds : undefined,
        teamOnCardIds: teamOnCardIds.length ? teamOnCardIds : undefined,
        attributes: c.unmatched
          ? Array.from(new Set([...(c.attributes ?? []), `unmatched-${c.unmatched}`]))
          : c.attributes,
        isRookie: c.isRookie,
        isRelic: c.isRelic,
        printRun: c.printRun,
        autographType: c.autographType,
        cardVariation: c.cardVariation,
        platformData: c.platformData,
        sourcePlatformIds: c.sourcePlatformIds,
      };
    });

    // Same delete-stale-rows behavior as before, inlined here so we can
    // keep the rich-card persistence path under a single mutation entry.
    const existingCards = await ctx.db
      .query("cardChecklist")
      .withIndex("by_selector_option", (q) =>
        q.eq("selectorOptionId", args.selectorOptionId),
      )
      .collect();
    const existingByNumber = new Map<string, typeof existingCards[0]>();
    for (const card of existingCards) existingByNumber.set(card.cardNumber, card);
    const processedNumbers = new Set<string>();

    // Pre-compute the target sortOrder for every card that will be in this
    // selectorOption after the upsert: incoming richCards (marketplace) PLUS
    // preserved custom cards (existing rows with isCustom=true that are not
    // being overwritten by a new marketplace card with the same cardNumber).
    // Sort by natural cardNumber so custom cards like "9001" land after
    // marketplace cards "1".."335". Done in-memory from data we already
    // hold — re-querying would push past Convex's 4096-read mutation limit
    // on sets with thousands of cross-set custom cards in the table.
    const incomingNumbers = new Set(richCards.map((c) => c.cardNumber));
    const allFinalNumbers: string[] = [
      ...richCards.map((c) => c.cardNumber),
      ...existingCards
        .filter((c) => c.isCustom && !incomingNumbers.has(c.cardNumber))
        .map((c) => c.cardNumber),
    ];
    allFinalNumbers.sort(compareCardNumbers);
    const targetSortOrder = new Map<string, number>();
    allFinalNumbers.forEach((cn, idx) => targetSortOrder.set(cn, idx));

    for (let i = 0; i < richCards.length; i++) {
      const card = richCards[i];
      processedNumbers.add(card.cardNumber);
      const newSortOrder = targetSortOrder.get(card.cardNumber) ?? i;
      const existing = existingByNumber.get(card.cardNumber);
      if (existing) {
        const mergedPlatformData = {
          ...existing.platformData,
          ...card.platformData,
        };
        await ctx.db.patch(existing._id, {
          cardName: card.cardName,
          team: card.team,
          playerIds: card.playerIds,
          teamOnCardIds: card.teamOnCardIds,
          attributes: card.attributes,
          isRookie: card.isRookie,
          isRelic: card.isRelic,
          printRun: card.printRun,
          autographType: card.autographType,
          cardVariation: card.cardVariation,
          platformData: mergedPlatformData,
          sourcePlatformIds: card.sourcePlatformIds,
          sortOrder: newSortOrder,
          lastUpdated: Date.now(),
        });
      } else {
        await ctx.db.insert("cardChecklist", {
          selectorOptionId: args.selectorOptionId,
          cardNumber: card.cardNumber,
          cardName: card.cardName,
          team: card.team,
          playerIds: card.playerIds,
          teamOnCardIds: card.teamOnCardIds,
          attributes: card.attributes,
          isRookie: card.isRookie,
          isRelic: card.isRelic,
          printRun: card.printRun,
          autographType: card.autographType,
          cardVariation: card.cardVariation,
          platformData: card.platformData,
          sourcePlatformIds: card.sourcePlatformIds,
          sortOrder: newSortOrder,
          lastUpdated: Date.now(),
        });
      }
    }

    for (const existing of existingCards) {
      if (!processedNumbers.has(existing.cardNumber) && !existing.isCustom) {
        await ctx.db.delete(existing._id);
      }
    }

    // Patch preserved custom cards whose sortOrder shifted because of the
    // marketplace upsert above. No reads here — works from data already
    // loaded into `existingCards`.
    for (const existing of existingCards) {
      if (!existing.isCustom) continue;
      if (incomingNumbers.has(existing.cardNumber)) continue; // not preserved; replaced
      const target = targetSortOrder.get(existing.cardNumber);
      if (target !== undefined && existing.sortOrder !== target) {
        await ctx.db.patch(existing._id, { sortOrder: target });
      }
    }

    // Clear pendingPlayerNames / pendingTeamNames entries on custom cards
    // for names that are now resolved (either pre-existing in players/teams
    // or just created via the confirmed-new lists). Without this, every
    // subsequent fetchCardChecklist would keep re-prompting for the same
    // custom-card player names because they'd stay in pending* forever.
    for (const existing of existingCards) {
      if (!existing.isCustom) continue;
      const patch: {
        pendingPlayerNames?: string[];
        pendingTeamNames?: string[];
      } = {};
      if (existing.pendingPlayerNames && existing.pendingPlayerNames.length > 0) {
        const stillPending = existing.pendingPlayerNames.filter(
          (n) => !playerIdByName.has(n.trim()),
        );
        if (stillPending.length !== existing.pendingPlayerNames.length) {
          patch.pendingPlayerNames =
            stillPending.length > 0 ? stillPending : undefined;
        }
      }
      if (existing.pendingTeamNames && existing.pendingTeamNames.length > 0) {
        const stillPending = existing.pendingTeamNames.filter(
          (n) => !teamIdByName.has(n.trim()),
        );
        if (stillPending.length !== existing.pendingTeamNames.length) {
          patch.pendingTeamNames =
            stillPending.length > 0 ? stillPending : undefined;
        }
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }
    }

    // Schedule Wikidata enrichment as a single chained queue rather than
    // N parallel actions. processEnrichmentQueue serializes requests
    // globally (one entity at a time, with INTER_ENTITY_DELAY_MS between
    // each) so a 300-player fetch doesn't burst-429 Wikidata.
    if (createdPlayerIds.length > 0 || createdTeamIds.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.adapters.wikidata.processEnrichmentQueue,
        { playerIds: createdPlayerIds, teamIds: createdTeamIds },
      );
    }

    return {
      success: true,
      count: richCards.length,
      createdPlayerIds,
      createdTeamIds,
    };
  },
});
