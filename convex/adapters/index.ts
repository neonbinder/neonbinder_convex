"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { CardListingsResponse, SetListingsResponse } from "./base";

// Unified search function for all platforms that support card searches
export const searchAllCardPlatforms = action({
  args: {
    cardName: v.string(),
    year: v.optional(v.number()),
    sport: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    condition: v.optional(v.string()),
    maxPrice: v.optional(v.number()),
    minPrice: v.optional(v.number()),
    platforms: v.optional(v.array(v.union(
      v.literal("ebay"),
      v.literal("myslabs"),
      v.literal("mycardpost")
    ))),
    ebayAppId: v.optional(v.string()),
  },
  returns: v.object({
    results: v.array(v.object({
      platform: v.string(),
      listings: v.array(v.object({
        id: v.string(),
        title: v.string(),
        price: v.number(),
        condition: v.optional(v.string()),
        quantity: v.optional(v.number()),
        imageUrl: v.optional(v.string()),
        platform: v.string(),
        url: v.string(),
        seller: v.optional(v.string()),
        shipping: v.optional(v.number()),
      })),
      totalCount: v.number(),
    })),
    totalResults: v.number(),
  }),
  handler: async (ctx, args) => {
    const platforms = args.platforms || ["ebay", "myslabs", "mycardpost"];
    const results: Array<{ platform: string; listings: CardListingsResponse['listings']; totalCount: number }> = [];

    // Search each platform in parallel
    const searchPromises = platforms.map(async (platform) => {
      try {
        let result: CardListingsResponse;
        
        switch (platform) {
          case "ebay":
            if (!args.ebayAppId) {
              throw new Error("eBay App ID is required for eBay searches");
            }
            result = await ctx.runAction(api.adapters.ebay.searchEbay, {
              ...args,
              appId: args.ebayAppId,
            });
            break;
          case "myslabs":
            result = await ctx.runAction(api.adapters.myslabs.searchMySlabs, args);
            break;
          case "mycardpost":
            result = await ctx.runAction(api.adapters.mycardpost.searchMyCardPost, args);
            break;
          default:
            throw new Error(`Unsupported platform: ${platform}`);
        }

        return {
          platform,
          listings: result.listings,
          totalCount: result.totalCount,
        };
      } catch (error) {
        console.error(`Error searching ${platform}:`, error);
        return {
          platform,
          listings: [],
          totalCount: 0,
        };
      }
    });

    const platformResults = await Promise.all(searchPromises);
    results.push(...platformResults);

    const totalResults = results.reduce((sum, result) => sum + result.totalCount, 0);

    return {
      results,
      totalResults,
    };
  },
});

// Unified search function for all platforms that support set searches
export const searchAllSetPlatforms = action({
  args: {
    setName: v.string(),
    year: v.optional(v.number()),
    sport: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    maxPrice: v.optional(v.number()),
    minPrice: v.optional(v.number()),
    platforms: v.optional(v.array(v.union(
      v.literal("buysportscards"),
      v.literal("sportlots")
    ))),
  },
  returns: v.object({
    results: v.array(v.object({
      platform: v.string(),
      listings: v.array(v.object({
        id: v.string(),
        setName: v.string(),
        year: v.number(),
        sport: v.string(),
        manufacturer: v.string(),
        totalCards: v.optional(v.number()),
        price: v.number(),
        condition: v.optional(v.string()),
        platform: v.string(),
        url: v.string(),
        seller: v.optional(v.string()),
      })),
      totalCount: v.number(),
    })),
    totalResults: v.number(),
  }),
  handler: async (ctx, args) => {
    const platforms = args.platforms || ["buysportscards", "sportlots"];
    const results: Array<{ platform: string; listings: SetListingsResponse['listings']; totalCount: number }> = [];

    // Search each platform in parallel
    const searchPromises = platforms.map(async (platform) => {
      try {
        let result: SetListingsResponse;
        
        switch (platform) {
          case "buysportscards":
            result = await ctx.runAction(api.adapters.buysportscards.searchBuySportsCards, args);
            break;
          case "sportlots":
            result = await ctx.runAction(api.adapters.sportlots.searchSportlots, args);
            break;
          default:
            throw new Error(`Unsupported platform: ${platform}`);
        }

        return {
          platform,
          listings: result.listings,
          totalCount: result.totalCount,
        };
      } catch (error) {
        console.error(`Error searching ${platform}:`, error);
        return {
          platform,
          listings: [],
          totalCount: 0,
        };
      }
    });

    const platformResults = await Promise.all(searchPromises);
    results.push(...platformResults);

    const totalResults = results.reduce((sum, result) => sum + result.totalCount, 0);

    return {
      results,
      totalResults,
    };
  },
}); 