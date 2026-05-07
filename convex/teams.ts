import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Lowercase + strip punctuation + token-sort. Same shape as the player
 * normalizer — keeps "Yankees, New York" and "New York Yankees" deduped
 * to one row. Used as the dedup key on `teams.nameNormalized`.
 */
export function normalizeTeamName(raw: string): string {
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
 * Teams are intentionally globally-shared rows: a single (name, sport)
 * key resolves to the same `teams._id` regardless of which user
 * triggered the row's creation. Yankees are Yankees. Do NOT add
 * per-user fields to this table — push user-specific data onto
 * separate per-user join tables instead. See the analogous note in
 * `convex/players.ts`.
 */
const teamDocValidator = v.object({
  _id: v.id("teams"),
  _creationTime: v.number(),
  name: v.string(),
  nameNormalized: v.string(),
  sport: v.string(),
  league: v.optional(v.string()),
  city: v.optional(v.string()),
  yearsActive: v.optional(v.object({
    from: v.number(),
    to: v.optional(v.number()),
  })),
  externalIds: v.optional(v.object({
    wikidataId: v.optional(v.string()),
  })),
  lastUpdated: v.number(),
});

export const findByNameAndSport = query({
  args: {
    name: v.string(),
    sport: v.string(),
  },
  returns: v.union(teamDocValidator, v.null()),
  handler: async (ctx, args) => {
    const normalized = normalizeTeamName(args.name);
    const matches = await ctx.db
      .query("teams")
      .withIndex("by_name_normalized", (q) => q.eq("nameNormalized", normalized))
      .collect();
    return matches.find((t) => t.sport === args.sport) ?? null;
  },
});

export const findOrCreate = mutation({
  args: {
    name: v.string(),
    sport: v.string(),
  },
  returns: v.id("teams"),
  handler: async (ctx, args): Promise<Id<"teams">> => {
    const normalized = normalizeTeamName(args.name);
    const matches = await ctx.db
      .query("teams")
      .withIndex("by_name_normalized", (q) => q.eq("nameNormalized", normalized))
      .collect();
    const existing = matches.find((t) => t.sport === args.sport);
    if (existing) return existing._id;

    return await ctx.db.insert("teams", {
      name: args.name.trim(),
      nameNormalized: normalized,
      sport: args.sport,
      lastUpdated: Date.now(),
    });
  },
});

export const list = query({
  args: {
    sport: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(teamDocValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    if (args.sport) {
      return await ctx.db
        .query("teams")
        .withIndex("by_sport", (q) => q.eq("sport", args.sport!))
        .take(limit);
    }
    return await ctx.db.query("teams").take(limit);
  },
});

export const get = query({
  args: { id: v.id("teams") },
  returns: v.union(teamDocValidator, v.null()),
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

/**
 * Internal `get` and `findOrCreate` for actions that run outside user
 * auth (e.g. Wikidata enrichment). The Wikidata player adapter resolves
 * each P54 team membership through findOrCreateInternal, which is why
 * enriching one player can spawn many team rows in a single pass.
 */
export const getInternal = internalQuery({
  args: { id: v.id("teams") },
  returns: v.union(teamDocValidator, v.null()),
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const findOrCreateInternal = internalMutation({
  args: {
    name: v.string(),
    sport: v.string(),
  },
  returns: v.id("teams"),
  handler: async (ctx, args): Promise<Id<"teams">> => {
    const normalized = normalizeTeamName(args.name);
    const matches = await ctx.db
      .query("teams")
      .withIndex("by_name_normalized", (q) => q.eq("nameNormalized", normalized))
      .collect();
    const existing = matches.find((t) => t.sport === args.sport);
    if (existing) return existing._id;

    return await ctx.db.insert("teams", {
      name: args.name.trim(),
      nameNormalized: normalized,
      sport: args.sport,
      lastUpdated: Date.now(),
    });
  },
});

export const applyEnrichmentInternal = internalMutation({
  args: {
    id: v.id("teams"),
    league: v.optional(v.string()),
    city: v.optional(v.string()),
    yearsActive: v.optional(v.object({
      from: v.number(),
      to: v.optional(v.number()),
    })),
    wikidataId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;

    const patch: {
      league?: string;
      city?: string;
      yearsActive?: { from: number; to?: number };
      externalIds?: { wikidataId?: string };
      lastUpdated: number;
    } = { lastUpdated: Date.now() };

    if (args.league !== undefined) patch.league = args.league;
    if (args.city !== undefined) patch.city = args.city;
    if (args.yearsActive !== undefined) patch.yearsActive = args.yearsActive;
    if (args.wikidataId !== undefined) {
      patch.externalIds = { ...(existing.externalIds ?? {}), wikidataId: args.wikidataId };
    }
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const enrichFromWikidata = action({
  args: { id: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    try {
      await ctx.runAction(internal.adapters.wikidata.enrichTeam, { teamId: args.id });
    } catch (error) {
      console.error("[teams.enrichFromWikidata] failed:", error);
    }
    return null;
  },
});
