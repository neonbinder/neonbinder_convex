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
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const chain: Array<{
      _id: Id<"selectorOptions">;
      level: Level;
      value: string;
    }> = [];
    let currentId: Id<"selectorOptions"> | undefined = args.id;

    while (currentId) {
      const option: any = await ctx.db.get(currentId);
      if (!option) break;
      chain.unshift({
        _id: option._id,
        level: option.level,
        value: option.value,
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

      const allOptions: Array<{
        value: string;
        platformData: {
          bsc?: string | string[];
          sportlots?: string;
        };
      }> = [];

      const platformErrors: Record<string, string> = {};

      // 1. Fetch from SportLots via HTTP
      try {
        const sportlotsOptions = await ctx.runAction(
          api.adapters.sportlots.fetchSportLotsSelectorOptions,
          {
            level,
            parentFilters: parentFilters || {},
          },
        );
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
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        platformErrors.sportlots = msg;
        console.error(`[fetchAggregatedOptions] SportLots error:`, error);
      }

      // 2. Fetch from BSC API
      try {
        const bscOptions = await ctx.runAction(
          api.adapters.buysportscards.fetchBscSelectorOptions,
          {
            level,
            parentFilters: parentFilters || {},
          },
        );
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
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        platformErrors.bsc = msg;
        console.error(`[fetchAggregatedOptions] BSC error:`, error);
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
      for (const ancestor of chain) {
        filters[ancestor.level] = ancestor.value;
      }

      console.log(
        `[fetchCardChecklist] Fetching checklist for:`,
        filters,
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
          { parentFilters: filters },
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
          { parentFilters: filters },
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
