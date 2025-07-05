import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get the current user's profile
 */
export const getUserProfile = query({
  args: {},
  returns: v.union(
    v.object({
      userId: v.id("users"),
      siteCredentials: v.optional(v.array(v.object({
        site: v.string(),
        hasCredentials: v.boolean(),
        lastUpdated: v.optional(v.string()),
      }))),
      preferences: v.optional(v.object({
        defaultSport: v.optional(v.string()),
        defaultYear: v.optional(v.number()),
        theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
      })),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      return null;
    }

    return {
      userId: profile.userId,
      siteCredentials: profile.siteCredentials || [],
      preferences: profile.preferences,
    };
  },
});

/**
 * Update user profile with site credential references
 */
export const updateUserProfile = mutation({
  args: {
    siteCredentials: v.optional(v.array(v.object({
      site: v.string(),
      hasCredentials: v.boolean(),
      lastUpdated: v.optional(v.string()),
    }))),
    preferences: v.optional(v.object({
      defaultSport: v.optional(v.string()),
      defaultYear: v.optional(v.number()),
      theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
    })),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get existing profile or create new one
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    // Prepare update data
    const updateData: {
      siteCredentials?: Array<{
        site: string;
        hasCredentials: boolean;
        lastUpdated?: string;
      }>;
      preferences?: {
        defaultSport?: string;
        defaultYear?: number;
        theme?: "light" | "dark";
      };
    } = {};
    
    if (args.siteCredentials !== undefined) {
      updateData.siteCredentials = args.siteCredentials;
    }
    
    if (args.preferences !== undefined) {
      updateData.preferences = args.preferences;
    }

    if (profile) {
      // Update existing profile
      await ctx.db.patch(profile._id, updateData);
    } else {
      // Create new profile
      await ctx.db.insert("userProfiles", {
        userId,
        ...updateData,
      });
    }

    return true;
  },
});

/**
 * Update a specific site's credential status
 */
export const updateSiteCredentialStatus = mutation({
  args: {
    site: v.string(),
    hasCredentials: v.boolean(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const currentCredentials = profile?.siteCredentials || [];
    const existingIndex = currentCredentials.findIndex(cred => cred.site === args.site);
    
    const updatedCredentials = [...currentCredentials];
    
    if (existingIndex >= 0) {
      // Update existing entry
      updatedCredentials[existingIndex] = {
        ...updatedCredentials[existingIndex],
        hasCredentials: args.hasCredentials,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      // Add new entry
      updatedCredentials.push({
        site: args.site,
        hasCredentials: args.hasCredentials,
        lastUpdated: new Date().toISOString(),
      });
    }

    if (profile) {
      await ctx.db.patch(profile._id, {
        siteCredentials: updatedCredentials,
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userId,
        siteCredentials: updatedCredentials,
      });
    }

    return true;
  },
});

/**
 * Remove a site's credential status
 */
export const removeSiteCredentialStatus = mutation({
  args: {
    site: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (profile && profile.siteCredentials) {
      const updatedCredentials = profile.siteCredentials.filter(
        cred => cred.site !== args.site
      );

      await ctx.db.patch(profile._id, {
        siteCredentials: updatedCredentials,
      });
    }

    return true;
  },
}); 