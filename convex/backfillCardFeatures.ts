/**
 * NEO-25: one-time backfill that fills auto-derivable marketplace features
 * (league / era / vintage / manufacturer / cardType / isReprint, plus the
 * card-observed isRookie / isRelic / signedBy / parallelName) onto EXISTING
 * `cardChecklist` rows. New rows already get these at sync/add time via
 * `commitCardChecklist` / `addCustomCard`; this drains the rows created
 * before that logic landed so a freshly-opened card detail panel isn't blank.
 *
 * Gap-fill only: `deriveBackfillFeatures` lets each row's EXISTING feature
 * values win, so operator overrides (setCardFeature) and already-derived keys
 * are never clobbered. Idempotent — a second pass produces no diffs.
 *
 * Trigger once with the public `runCardFeaturesBackfill` mutation (admin
 * only); it schedules the internal batch, which paginates the whole table and
 * self-reschedules until done.
 */

import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./auth";
import {
  deriveBackfillFeatures,
  type SetLevelFeatureInputs,
} from "./features/deriveCardFeatures";

/**
 * Walk the parent chain once, capturing the hierarchy levels needed to derive
 * set-level features. 16-step depth cutoff matches the commitCardChecklist
 * walk so a cycle can't deadlock the mutation.
 */
async function resolveSetLevelInputs(
  ctx: { db: { get: (id: Id<"selectorOptions">) => Promise<any> } },
  selectorOptionId: Id<"selectorOptions">,
): Promise<SetLevelFeatureInputs> {
  const out: SetLevelFeatureInputs = {};
  let cursor: Id<"selectorOptions"> | undefined = selectorOptionId;
  let depth = 0;
  let isLeaf = true;
  while (cursor && depth < 16) {
    const node = await ctx.db.get(cursor);
    if (!node) break;
    if (isLeaf) {
      out.leafLevel = node.level;
      out.leafIsInsert = node.metadata?.isInsert ?? undefined;
      out.leafIsParallel = node.metadata?.isParallel ?? undefined;
      isLeaf = false;
    }
    if (node.level === "sport") out.sport = node.value;
    if (node.level === "year") out.year = node.value;
    if (node.level === "manufacturer") out.manufacturer = node.value;
    cursor = node.parentId;
    depth += 1;
  }
  return out;
}

function sameFeatures(
  a: Record<string, string> | undefined,
  b: Record<string, string>,
): boolean {
  const ak = Object.keys(a ?? {});
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of bk) {
    if ((a ?? {})[k] !== b[k]) return false;
  }
  return true;
}

export const backfillCardFeaturesBatch = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
  },
  returns: v.object({
    updated: v.number(),
    scanned: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const numItems = args.numItems ?? 200;
    const page = await ctx.db
      .query("cardChecklist")
      .paginate({ cursor: args.cursor, numItems });

    // Cache ancestor resolution per selectorOption within the batch so a set
    // with hundreds of cards only walks its chain once.
    const ancestorCache = new Map<string, SetLevelFeatureInputs>();
    let updated = 0;

    for (const row of page.page) {
      const key = row.selectorOptionId as unknown as string;
      let setInputs = ancestorCache.get(key);
      if (!setInputs) {
        setInputs = await resolveSetLevelInputs(ctx, row.selectorOptionId);
        ancestorCache.set(key, setInputs);
      }

      const next = deriveBackfillFeatures(
        setInputs,
        {
          isRookie: row.isRookie,
          isRelic: row.isRelic,
          autographType: row.autographType,
          cardVariation: row.cardVariation,
          attributes: row.attributes,
        },
        row.features,
      );

      if (!sameFeatures(row.features, next)) {
        await ctx.db.patch(row._id, {
          features: next,
          lastUpdated: Date.now(),
        });
        updated += 1;
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.backfillCardFeatures.backfillCardFeaturesBatch,
        { cursor: page.continueCursor, numItems },
      );
    }

    return { updated, scanned: page.page.length, isDone: page.isDone };
  },
});

/**
 * Admin-triggered entry point. Schedules the first batch; the batch
 * self-reschedules until the whole table is drained. Safe to re-run (the
 * gap-fill is idempotent).
 */
export const runCardFeaturesBackfill = mutation({
  args: { numItems: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.scheduler.runAfter(
      0,
      internal.backfillCardFeatures.backfillCardFeaturesBatch,
      { cursor: null, numItems: args.numItems },
    );
    return null;
  },
});
