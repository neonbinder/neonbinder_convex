"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

// Get BSC token from Google Secret Manager
export const getBscToken = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    token: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async () => {
    try {
      // For now, return a mock token since we don't have access to Secret Manager from Convex
      // In a real implementation, you would need to set up proper credentials
      return {
        success: true,
        token: "mock-bsc-token",
      };
    } catch (error) {
      console.error("[getBscToken] Error:", error);
      return {
        success: false,
        error: `Failed to get BSC token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

// Get available set parameters from BSC API
export const getAvailableSetParameters = action({
  args: {
    partialParams: v.optional(v.object({
      sport: v.optional(v.string()),
      year: v.optional(v.number()),
      manufacturer: v.optional(v.string()),
      setName: v.optional(v.string()),
      variantType: v.optional(v.union(
        v.literal("base"),
        v.literal("parallel"),
        v.literal("insert"),
        v.literal("parallel_of_insert")
      )),
    })),
  },
  returns: v.object({
    availableOptions: v.object({
      sports: v.optional(v.array(v.object({
        site: v.string(),
        values: v.array(v.object({
          label: v.string(),
          value: v.string(),
        })),
      }))),
      years: v.optional(v.array(v.object({
        site: v.string(),
        values: v.array(v.object({
          label: v.string(),
          value: v.string(),
        })),
      }))),
      manufacturers: v.optional(v.array(v.object({
        site: v.string(),
        values: v.array(v.object({
          label: v.string(),
          value: v.string(),
        })),
      }))),
      setNames: v.optional(v.array(v.object({
        site: v.string(),
        values: v.array(v.object({
          label: v.string(),
          value: v.string(),
        })),
      }))),
      variantNames: v.optional(v.array(v.object({
        site: v.string(),
        values: v.array(v.object({
          label: v.string(),
          value: v.string(),
        })),
      }))),
    }),
    currentParams: v.optional(v.object({
      sport: v.optional(v.string()),
      year: v.optional(v.number()),
      manufacturer: v.optional(v.string()),
      setName: v.optional(v.string()),
      variantType: v.optional(v.union(
        v.literal("base"),
        v.literal("parallel"),
        v.literal("insert"),
        v.literal("parallel_of_insert")
      )),
    })),
  }),
  handler: async (ctx, args) => {
    try {
      console.log(`[getAvailableSetParameters] Getting BSC options with filters:`, args.partialParams);

      // Get BSC token
      const tokenResult = await ctx.runAction(api.adapters.buysportscards.getBscToken, {});
      if (!tokenResult.success || !tokenResult.token) {
        throw new Error(`Failed to get BSC token: ${tokenResult.error}`);
      }

      // For now, return fallback data since we don't have the actual BSC API endpoint
      // In a real implementation, you would call the BSC API here
      const availableOptions: {
        sports?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
        years?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
        manufacturers?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
        setNames?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
        variantNames?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
      } = {};
      
      if (!args.partialParams?.sport) {
        availableOptions.sports = [{
          site: "BSC",
          values: [
            { label: "Football", value: "football" },
            { label: "Baseball", value: "baseball" },
            { label: "Basketball", value: "basketball" },
            { label: "Hockey", value: "hockey" },
          ],
        }];
      } else if (!args.partialParams?.year) {
        availableOptions.years = [{
          site: "BSC",
          values: [
            { label: "2024", value: "2024" },
            { label: "2023", value: "2023" },
            { label: "2022", value: "2022" },
            { label: "2021", value: "2021" },
          ],
        }];
      } else if (!args.partialParams?.manufacturer) {
        availableOptions.manufacturers = [{
          site: "BSC",
          values: [
            { label: "Panini", value: "panini" },
            { label: "Topps", value: "topps" },
            { label: "Upper Deck", value: "upper-deck" },
            { label: "Donruss", value: "donruss" },
          ],
        }];
      } else if (!args.partialParams?.setName) {
        availableOptions.setNames = [{
          site: "BSC",
          values: [
            { label: "Donruss Elite", value: "donruss-elite" },
            { label: "Panini Prizm", value: "panini-prizm" },
            { label: "Topps Chrome", value: "topps-chrome" },
            { label: "Upper Deck Series 1", value: "upper-deck-series-1" },
          ],
        }];
      } else if (!args.partialParams?.variantType) {
        availableOptions.variantNames = [{
          site: "BSC",
          values: [
            { label: "Base", value: "base" },
            { label: "Insert", value: "insert" },
            { label: "Parallel", value: "parallel" },
          ],
        }];
      }

      return {
        availableOptions,
        currentParams: args.partialParams,
      };
    } catch (error) {
      console.error(`[getAvailableSetParameters] Error:`, error);
      
      // Return fallback data for testing
      const availableOptions: {
        sports?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
        years?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
        manufacturers?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
        setNames?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
        variantNames?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
      } = {};
      
      if (!args.partialParams?.sport) {
        availableOptions.sports = [{
          site: "BSC",
          values: [
            { label: "Football", value: "football" },
            { label: "Baseball", value: "baseball" },
            { label: "Basketball", value: "basketball" },
            { label: "Hockey", value: "hockey" },
          ],
        }];
      } else if (!args.partialParams?.year) {
        availableOptions.years = [{
          site: "BSC",
          values: [
            { label: "2024", value: "2024" },
            { label: "2023", value: "2023" },
            { label: "2022", value: "2022" },
            { label: "2021", value: "2021" },
          ],
        }];
      } else if (!args.partialParams?.manufacturer) {
        availableOptions.manufacturers = [{
          site: "BSC",
          values: [
            { label: "Panini", value: "panini" },
            { label: "Topps", value: "topps" },
            { label: "Upper Deck", value: "upper-deck" },
            { label: "Donruss", value: "donruss" },
          ],
        }];
      } else if (!args.partialParams?.setName) {
        availableOptions.setNames = [{
          site: "BSC",
          values: [
            { label: "Donruss Elite", value: "donruss-elite" },
            { label: "Panini Prizm", value: "panini-prizm" },
            { label: "Topps Chrome", value: "topps-chrome" },
            { label: "Upper Deck Series 1", value: "upper-deck-series-1" },
          ],
        }];
      } else if (!args.partialParams?.variantType) {
        availableOptions.variantNames = [{
          site: "BSC",
          values: [
            { label: "Base", value: "base" },
            { label: "Insert", value: "insert" },
            { label: "Parallel", value: "parallel" },
          ],
        }];
      }

      return {
        availableOptions,
        currentParams: args.partialParams,
      };
    }
  },
});
