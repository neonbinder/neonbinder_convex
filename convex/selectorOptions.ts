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
        sportlots: v.optional(v.string()),
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
        sportlots: v.optional(v.string()),
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
        sportlots: v.optional(v.string()),
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
        sportlots: v.optional(v.string()),
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
        sportlots: v.optional(v.string()),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const chain: Array<{
      _id: Id<"selectorOptions">;
      level: Level;
      value: string;
      platformData: { bsc?: string | string[]; sportlots?: string };
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
      attributes: v.optional(v.array(v.string())),
      platformData: v.object({
        bsc: v.optional(v.string()),
        sportlots: v.optional(v.string()),
      }),
      isCustom: v.optional(v.boolean()),
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
          sportlots: v.optional(v.string()),
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
        await ctx.db.patch(existing._id, {
          platformData: mergedPlatformData,
          lastUpdated: Date.now(),
        });
        insertedIds.push(existing._id);
      } else {
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

export const storeCardChecklist = mutation({
  args: {
    selectorOptionId: v.id("selectorOptions"),
    cards: v.array(
      v.object({
        cardNumber: v.string(),
        cardName: v.string(),
        team: v.optional(v.string()),
        attributes: v.optional(v.array(v.string())),
        platformData: v.object({
          bsc: v.optional(v.string()),
          sportlots: v.optional(v.string()),
        }),
      }),
    ),
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
        // Merge platform data
        const mergedPlatformData = {
          ...existing.platformData,
          ...card.platformData,
        };
        await ctx.db.patch(existing._id, {
          cardName: card.cardName,
          team: card.team,
          attributes: card.attributes,
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
          attributes: card.attributes,
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
  },
  returns: v.id("cardChecklist"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Get current max sort order
    const existing = await ctx.db
      .query("cardChecklist")
      .withIndex("by_selector_option", (q) =>
        q.eq("selectorOptionId", args.selectorOptionId),
      )
      .collect();

    const maxSortOrder = existing.reduce(
      (max, card) => Math.max(max, card.sortOrder),
      -1,
    );

    return await ctx.db.insert("cardChecklist", {
      selectorOptionId: args.selectorOptionId,
      cardNumber: args.cardNumber,
      cardName: args.cardName,
      team: args.team,
      attributes: args.attributes,
      platformData: {},
      isCustom: true,
      sortOrder: maxSortOrder + 1,
      lastUpdated: Date.now(),
    });
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
          sportlots: v.optional(v.string()),
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
            sportlots: v.optional(v.string()),
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
      sportlots: v.optional(v.string()),
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
  }),
  handler: async (
    ctx,
  ): Promise<{ selectorOptionsDeleted: number; cardChecklistDeleted: number }> => {
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

    return { selectorOptionsDeleted, cardChecklistDeleted };
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
      // adapter receives its own slugs instead of display labels.
      // When an ancestor has no platformData for a given platform, fall back
      // to the display value — this handles cross-platform levels (e.g. year
      // may only have SL slug but BSC still needs the year filter).
      let slPlatformFilters: Record<string, string> | undefined;
      let bscPlatformFilters: Record<string, string[]> | undefined;

      if (parentId) {
        const chain = await ctx.runQuery(
          api.selectorOptions.getAncestorChain,
          { id: parentId },
        );

        slPlatformFilters = {};
        bscPlatformFilters = {};

        for (const ancestor of chain) {
          const lvl = ancestor.level;
          if (ancestor.platformData?.sportlots) {
            slPlatformFilters[lvl] = ancestor.platformData.sportlots;
          }
          if (ancestor.platformData?.bsc) {
            const bscVal = ancestor.platformData.bsc;
            bscPlatformFilters[lvl] = Array.isArray(bscVal) ? bscVal : [bscVal];
          } else if (ancestor.value) {
            // Fall back to display value (e.g. year "2022") when no BSC slug stored
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

export const fetchCardChecklist = action({
  args: {
    selectorOptionId: v.id("selectorOptions"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    count: v.number(),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string; count: number }> => {
    try {
      // Get the ancestor chain to build parent filters
      const chain = await ctx.runQuery(
        api.selectorOptions.getAncestorChain,
        { id: args.selectorOptionId },
      );

      const filters: Record<string, string> = {};
      const slPlatformFilters: Record<string, string> = {};
      const bscPlatformFilters: Record<string, string[]> = {};

      for (const ancestor of chain) {
        filters[ancestor.level] = ancestor.value;
        if (ancestor.platformData?.sportlots) {
          slPlatformFilters[ancestor.level] = ancestor.platformData.sportlots;
        }
        if (ancestor.platformData?.bsc) {
          const bscVal = ancestor.platformData.bsc;
          bscPlatformFilters[ancestor.level] = Array.isArray(bscVal) ? bscVal : [bscVal];
        }
      }

      console.log(
        `[fetchCardChecklist] Fetching checklist for:`,
        filters,
        `SL slugs:`, slPlatformFilters,
        `BSC slugs:`, bscPlatformFilters,
      );

      const allCards: Array<{
        cardNumber: string;
        cardName: string;
        team?: string;
        attributes?: string[];
        platformData: { bsc?: string; sportlots?: string };
      }> = [];

      // Fetch from SportLots
      try {
        const slCards = await ctx.runAction(
          api.adapters.sportlots.fetchSportLotsChecklist,
          { parentFilters: filters, platformFilters: slPlatformFilters },
        );
        if (slCards.success && slCards.cards) {
          allCards.push(
            ...slCards.cards.map((c: { cardNumber: string; cardName: string; team?: string; platformRef?: string }) => ({
              cardNumber: c.cardNumber,
              cardName: c.cardName,
              team: c.team,
              platformData: { sportlots: c.platformRef },
            })),
          );
        }
      } catch (error) {
        console.error(`[fetchCardChecklist] SportLots error:`, error);
      }

      // Fetch from BSC
      try {
        const bscCards = await ctx.runAction(
          api.adapters.buysportscards.fetchBscChecklist,
          { parentFilters: filters, platformFilters: bscPlatformFilters },
        );
        if (bscCards.success && bscCards.cards) {
          for (const card of bscCards.cards) {
            // Try to merge with existing by card number
            const existing = allCards.find(
              (c) => c.cardNumber === card.cardNumber,
            );
            if (existing) {
              existing.platformData.bsc = card.platformRef;
              if (!existing.cardName && card.cardName) {
                existing.cardName = card.cardName;
              }
            } else {
              allCards.push({
                cardNumber: card.cardNumber,
                cardName: card.cardName,
                team: card.team,
                platformData: { bsc: card.platformRef },
              });
            }
          }
        }
      } catch (error) {
        console.error(`[fetchCardChecklist] BSC error:`, error);
      }

      if (allCards.length === 0) {
        return {
          success: true,
          message: "No cards found from marketplace APIs",
          count: 0,
        };
      }

      // Store via mutation
      const result: { success: boolean; count: number } = await ctx.runMutation(
        api.selectorOptions.storeCardChecklist,
        {
          selectorOptionId: args.selectorOptionId,
          cards: allCards,
        },
      );

      return {
        success: result.success,
        message: `Fetched ${result.count} cards from marketplaces`,
        count: result.count,
      };
    } catch (error) {
      console.error(`[fetchCardChecklist] Error:`, error);
      return {
        success: false,
        message: `Failed to fetch checklist: ${error instanceof Error ? error.message : "Unknown error"}`,
        count: 0,
      };
    }
  },
});
