import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Persist one row to `bscFetchLog` for every BSC bulk-upload fetch
 * attempt. Lets us inspect post-hoc what BSC returned to a given
 * request — critical when log retention drops the live `convex logs`
 * line we'd otherwise have to inspect during the run.
 *
 * Called fire-and-forget from `fetchBscChecklist` (action). Should not
 * throw / block the parent path.
 */
export const logBscFetch = internalMutation({
  args: {
    filters: v.string(),
    responseStatus: v.number(),
    cardsReturned: v.number(),
    bodyPreview: v.optional(v.string()),
    durationMs: v.number(),
    userId: v.optional(v.string()),
    attempt: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("bscFetchLog", args);
    return null;
  },
});
