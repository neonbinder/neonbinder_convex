import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getCurrentUserId } from "./auth";

// Write your Convex functions in any file inside this directory (`convex`).
// See https://docs.convex.dev/functions for more.

// You can read data from the database via a query:
export const listNumbers = query({
  // Validators for arguments.
  args: {
    count: v.number(),
  },

  // Query implementation.
  handler: async (ctx, args) => {
    //// Read the database as many times as you need here.
    //// See https://docs.convex.dev/database/reading-data.
    const numbers = await ctx.db
      .query("numbers")
      // Ordered by _creationTime, return most recent
      .order("desc")
      .take(args.count);
    const userId = await getCurrentUserId(ctx);
    // For Clerk, we don't need to fetch a user from the database
    // The userId is the Clerk user ID (string)
    return {
      viewer: userId, // Just return the Clerk user ID
      numbers: numbers.reverse().map((number) => number.value),
    };
  },
});

// Test authentication endpoint
export const testAuth = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    console.log("Auth identity:", identity);
    return {
      authenticated: !!identity,
      userId: identity?.subject || "not authenticated",
      email: identity?.email || "no email",
      name: identity?.name || "no name",
    };
  },
});

// You can write data to the database via a mutation:
export const addNumber = mutation({
  // Validators for arguments.
  args: {
    value: v.number(),
  },

  // Mutation implementation.
  handler: async (ctx, args) => {
    //// Insert or modify documents in the database here.
    //// Mutations can also read from the database like queries.
    //// See https://docs.convex.dev/database/writing-data.

    const id = await ctx.db.insert("numbers", { value: args.value });

    console.log("Added new document with id:", id);
    // Optionally, return a value from your mutation.
    // return id;
  },
});

// You can fetch data from and send data to third-party APIs via an action:
export const myAction = action({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },
  returns: v.null(),
  // Action implementation.
  handler: async (ctx, args) => {
    //// Use the browser-like `fetch` API to send HTTP requests.
    //// See https://docs.convex.dev/functions/actions#calling-third-party-apis-and-using-npm-packages.
    // const response = await ctx.fetch("https://api.thirdpartyservice.com");
    // const data = await response.json();

    //// Query data by running Convex queries.
    const data = await ctx.runQuery(api.myFunctions.listNumbers, {
      count: 10,
    });
    console.log(data);

    //// Write data by running Convex mutations.
    await ctx.runMutation(api.myFunctions.addNumber, {
      value: args.first,
    });
  },
});

// ===== SET SELECTIONS MANAGEMENT =====

export const createSetSelection = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    sport: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
    year: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
    manufacturer: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
    setName: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
    variantType: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
    insert: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
    parallel: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
  },
  returns: v.id("setSelections"),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("setSelections", {
      name: args.name,
      description: args.description,
      sport: args.sport,
      year: args.year,
      manufacturer: args.manufacturer,
      setName: args.setName,
      variantType: args.variantType,
      insert: args.insert,
      parallel: args.parallel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  },
});

export const updateSetSelection = mutation({
  args: {
    id: v.id("setSelections"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    sport: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
    year: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
    manufacturer: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
    setName: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
    variantType: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
    insert: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
    parallel: v.optional(
      v.array(v.object({ site: v.string(), value: v.string() })),
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const getSetSelection = query({
  args: { id: v.id("setSelections") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("setSelections"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.string(),
      sport: v.optional(
        v.array(v.object({ site: v.string(), value: v.string() })),
      ),
      year: v.optional(
        v.array(v.object({ site: v.string(), value: v.string() })),
      ),
      manufacturer: v.optional(
        v.array(v.object({ site: v.string(), value: v.string() })),
      ),
      setName: v.optional(
        v.array(v.object({ site: v.string(), value: v.string() })),
      ),
      variantType: v.optional(
        v.array(v.object({ site: v.string(), value: v.string() })),
      ),
      insert: v.optional(
        v.array(v.object({ site: v.string(), value: v.string() })),
      ),
      parallel: v.optional(
        v.array(v.object({ site: v.string(), value: v.string() })),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listSetSelections = query({
  handler: async (ctx) => {
    return await ctx.db.query("setSelections").order("desc").collect();
  },
});

// ===== SELECTOR OPTIONS MANAGEMENT =====

// Update selector options from all platforms
export const updateSelectorOptions = action({
  args: {
    level: v.union(
      v.literal("sport"),
      v.literal("year"),
      v.literal("manufacturer"),
      v.literal("setName"),
      v.literal("variantType"),
      v.literal("insert"),
      v.literal("parallel"),
    ),
    parentFilters: v.optional(
      v.object({
        sport: v.optional(v.string()),
        year: v.optional(v.number()),
        manufacturer: v.optional(v.string()),
        setName: v.optional(v.string()),
        variantType: v.optional(
          v.union(
            v.literal("base"),
            v.literal("parallel"),
            v.literal("insert"),
            v.literal("parallel_of_insert"),
          ),
        ),
      }),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    optionsCount: v.number(),
  }),
  handler: async (ctx, args) => {
    try {
      const { level, parentFilters } = args;

      // Default to sport if no level specified
      const selectorLevel = level || "sport";

      console.log(
        `[updateSelectorOptions] Updating ${selectorLevel} options with filters:`,
        parentFilters,
      );

      // Get options from BSC API
      let bscOptions: Array<{ value: string; platformData: any }> = [];
      try {
        const bscResult = await ctx.runAction(
          api.adapters.buysportscards.getAvailableSetParameters,
          {
            partialParams: parentFilters || {},
          },
        );

        if (bscResult.availableOptions) {
          const levelKey =
            selectorLevel === "sport"
              ? "sports"
              : selectorLevel === "year"
                ? "years"
                : selectorLevel === "manufacturer"
                  ? "manufacturers"
                  : selectorLevel === "setName"
                    ? "setNames"
                    : selectorLevel === "variantType"
                      ? "variantNames"
                      : selectorLevel;

          const options =
            bscResult.availableOptions[
              levelKey as keyof typeof bscResult.availableOptions
            ];
          if (options && Array.isArray(options) && options.length > 0) {
            bscOptions = options.flatMap((siteOption: any) =>
              siteOption.values.map((value: any) => ({
                value: value.label,
                platformData: { bsc: value.value },
              })),
            );
          }
        }
      } catch (error) {
        console.error(`[updateSelectorOptions] BSC error:`, error);
      }

      // Get options from SportLots via browser service
      let sportlotsOptions: Array<{ value: string; platformData: any }> = [];
      try {
        const browserServiceUrl =
          process.env.NEONBINDER_BROWSER_URL || "http://localhost:8080";

        // For now, skip SportLots since we can't make HTTP requests from Convex actions
        // In a real implementation, you would need to use a different approach
        console.log(
          `[updateSelectorOptions] SportLots browser service not available from Convex actions`,
        );
      } catch (error) {
        console.error(`[updateSelectorOptions] SportLots error:`, error);
      }

      // Combine and deduplicate options
      const allOptions = [...bscOptions, ...sportlotsOptions];
      const valueMap = new Map<string, { value: string; platformData: any }>();

      allOptions.forEach((option) => {
        const normalizedValue = option.value.toLowerCase().trim();
        const existing = valueMap.get(normalizedValue);

        if (existing) {
          // Merge platform data
          existing.platformData = {
            ...existing.platformData,
            ...option.platformData,
          };
        } else {
          valueMap.set(normalizedValue, {
            value: option.value,
            platformData: option.platformData,
          });
        }
      });

      // Convert to array for storage
      const optionsToStore = Array.from(valueMap.values());

      // Store the options using a mutation
      const result: {
        success: boolean;
        message: string;
        optionsCount: number;
      } = await ctx.runMutation(api.myFunctions.storeSelectorOptions, {
        level: selectorLevel,
        options: optionsToStore,
        parentFilters: parentFilters || {},
      });

      console.log(
        `[updateSelectorOptions] Successfully updated ${result.optionsCount} ${selectorLevel} options`,
      );

      return {
        success: true,
        message: `Successfully updated ${result.optionsCount} ${selectorLevel} options`,
        optionsCount: result.optionsCount,
      };
    } catch (error) {
      console.error(`[updateSelectorOptions] Error:`, error);
      return {
        success: false,
        message: `Failed to update selector options: ${error instanceof Error ? error.message : "Unknown error"}`,
        optionsCount: 0,
      };
    }
  },
});

// Store selector options in the database
export const storeSelectorOptions = mutation({
  args: {
    level: v.union(
      v.literal("sport"),
      v.literal("year"),
      v.literal("manufacturer"),
      v.literal("setName"),
      v.literal("variantType"),
      v.literal("insert"),
      v.literal("parallel"),
    ),
    options: v.array(
      v.object({
        value: v.string(),
        platformData: v.object({
          bsc: v.optional(v.union(v.string(), v.array(v.string()))),
          sportlots: v.optional(v.string()),
        }),
      }),
    ),
    parentFilters: v.object({
      sport: v.optional(v.string()),
      year: v.optional(v.number()),
      manufacturer: v.optional(v.string()),
      setName: v.optional(v.string()),
      variantType: v.optional(
        v.union(
          v.literal("base"),
          v.literal("parallel"),
          v.literal("insert"),
          v.literal("parallel_of_insert"),
        ),
      ),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    optionsCount: v.number(),
  }),
  handler: async (ctx, args) => {
    try {
      const { level, options, parentFilters } = args;

      // Find parent option if we have filters
      let parentId: any = undefined;
      if (parentFilters) {
        const parentLevel =
          level === "year"
            ? "sport"
            : level === "manufacturer"
              ? "year"
              : level === "setName"
                ? "manufacturer"
                : level === "variantType"
                  ? "setName"
                  : undefined;

        if (parentLevel) {
          const parentValue =
            parentFilters[parentLevel as keyof typeof parentFilters];
          if (parentValue) {
            const parentOption = await ctx.db
              .query("selectorOptions")
              .withIndex("by_level", (q) => q.eq("level", parentLevel))
              .filter((q) => q.eq(q.field("value"), parentValue))
              .first();

            if (parentOption) {
              parentId = parentOption._id;
            }
          }
        }
      }

      // Clear existing options for this level and parent
      const existingOptions = await ctx.db
        .query("selectorOptions")
        .withIndex("by_level", (q) => q.eq("level", level))
        .filter((q) => q.eq(q.field("parentId"), parentId))
        .collect();

      for (const option of existingOptions) {
        await ctx.db.delete(option._id);
      }

      // Insert new options
      const insertedOptions: any[] = [];
      for (const option of options) {
        const optionId = await ctx.db.insert("selectorOptions", {
          level: level,
          value: option.value,
          platformData: option.platformData,
          parentId: parentId,
          children: [],
          lastUpdated: Date.now(),
        });
        insertedOptions.push(optionId);
      }

      // Update parent's children array if we have a parent
      if (parentId && insertedOptions.length > 0) {
        await ctx.db.patch(parentId, {
          children: insertedOptions,
        });
      }

      return {
        success: true,
        message: `Successfully stored ${insertedOptions.length} ${level} options`,
        optionsCount: insertedOptions.length,
      };
    } catch (error) {
      console.error(`[storeSelectorOptions] Error:`, error);
      return {
        success: false,
        message: `Failed to store selector options: ${error instanceof Error ? error.message : "Unknown error"}`,
        optionsCount: 0,
      };
    }
  },
});

// Get selector options for a specific level
export const getSelectorOptions = query({
  args: {
    level: v.union(
      v.literal("sport"),
      v.literal("year"),
      v.literal("manufacturer"),
      v.literal("setName"),
      v.literal("variantType"),
      v.literal("insert"),
      v.literal("parallel"),
    ),
    parentId: v.optional(v.id("selectorOptions")),
  },
  returns: v.array(
    v.object({
      _id: v.id("selectorOptions"),
      _creationTime: v.number(),
      level: v.union(
        v.literal("sport"),
        v.literal("year"),
        v.literal("manufacturer"),
        v.literal("setName"),
        v.literal("variantType"),
        v.literal("insert"),
        v.literal("parallel"),
      ),
      value: v.string(),
      platformData: v.object({
        bsc: v.optional(v.union(v.string(), v.array(v.string()))),
        sportlots: v.optional(v.string()),
      }),
      parentId: v.optional(v.id("selectorOptions")),
      children: v.optional(v.array(v.id("selectorOptions"))),
      lastUpdated: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const { level, parentId } = args;

    if (parentId) {
      return await ctx.db
        .query("selectorOptions")
        .withIndex("by_level", (q) => q.eq("level", level))
        .filter((q) => q.eq(q.field("parentId"), parentId))
        .collect();
    } else {
      return await ctx.db
        .query("selectorOptions")
        .withIndex("by_level", (q) => q.eq("level", level))
        .filter((q) => q.eq(q.field("parentId"), undefined))
        .collect();
    }
  },
});

// ===== AGGREGATED SELECTOR OPTIONS =====

export const getAggregatedSelectorOptions = action({
  args: {
    level: v.union(
      v.literal("sport"),
      v.literal("year"),
      v.literal("manufacturer"),
      v.literal("setName"),
      v.literal("variantType"),
      v.literal("insert"),
      v.literal("parallel"),
    ),
    parentFilters: v.optional(
      v.object({
        sport: v.optional(v.string()),
        year: v.optional(v.number()),
        manufacturer: v.optional(v.string()),
        setName: v.optional(v.string()),
        variantType: v.optional(
          v.union(
            v.literal("base"),
            v.literal("parallel"),
            v.literal("insert"),
            v.literal("parallel_of_insert"),
          ),
        ),
      }),
    ),
    loginKey: v.string(), // For SportLots credentials
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    optionsCount: v.number(),
    options: v.array(
      v.object({
        value: v.string(),
        platformData: v.object({
          sportlots: v.optional(v.string()),
          bsc: v.optional(v.array(v.string())),
        }),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    try {
      console.log(
        `[getAggregatedSelectorOptions] Getting ${args.level} options with filters:`,
        args.parentFilters,
      );

      const aggregatedOptions: Array<{
        value: string;
        platformData: {
          sportlots?: string;
          bsc?: string[];
        };
      }> = [];

      // 1. Get SportLots options from neonbinder_browser service
      let sportlotsOptions: Array<{
        value: string;
        platformData: { sportlots: string };
      }> = [];
      try {
        const browserServiceUrl =
          process.env.BROWSER_SERVICE_URL || "http://localhost:8080";
        const sportlotsResponse = await fetch(
          `${browserServiceUrl}/get-selector-options`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              level: args.level,
              parentFilters: args.parentFilters,
              loginKey: args.loginKey,
            }),
          },
        );

        if (sportlotsResponse.ok) {
          const sportlotsData = await sportlotsResponse.json();
          if (sportlotsData.success) {
            sportlotsOptions = sportlotsData.options;
            console.log(
              `[getAggregatedSelectorOptions] Got ${sportlotsOptions.length} SportLots options`,
            );
          }
        } else {
          console.error(
            `[getAggregatedSelectorOptions] SportLots API error: ${sportlotsResponse.status}`,
          );
        }
      } catch (error) {
        console.error(`[getAggregatedSelectorOptions] SportLots error:`, error);
      }

      // 2. Get BSC options using the BSC API
      let bscOptions: Array<{
        value: string;
        platformData: { bsc: string[] };
      }> = [];
      try {
        // Get BSC token from Secret Manager
        const tokenResult = await ctx.runAction(
          api.adapters.secret_manager.getSiteCredentials,
          {
            site: "buysportscards",
          },
        );

        if (tokenResult && tokenResult.token) {
          // Build BSC filters based on parentFilters
          const bscFilters: {
            sport?: string[];
            year?: string[];
            setName?: string[];
            variant?: string[];
          } = {};

          if (args.parentFilters?.sport) {
            bscFilters.sport = [args.parentFilters.sport.toLowerCase()];
          }
          if (args.parentFilters?.year) {
            bscFilters.year = [args.parentFilters.year.toString()];
          }
          if (args.parentFilters?.manufacturer) {
            bscFilters.setName = [
              args.parentFilters.manufacturer.toLowerCase(),
            ];
          }
          if (args.parentFilters?.setName) {
            bscFilters.setName = [args.parentFilters.setName.toLowerCase()];
          }
          if (args.parentFilters?.variantType) {
            bscFilters.variant = [args.parentFilters.variantType];
          }

          // Call BSC API
          const bscApiUrl =
            "https://www.buysportscards.com/seller/bulk-upload/results";
          const bscResponse = await fetch(bscApiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tokenResult.token}`,
            },
            body: JSON.stringify({
              condition: "near_mint",
              currentListings: true,
              productType: "raw",
              filters: bscFilters,
            }),
          });

          if (bscResponse.ok) {
            const bscData = await bscResponse.json();

            // Process BSC response to extract available options based on level
            // This is a simplified example - you'll need to adapt based on actual BSC API response structure
            if (args.level === "sport" && !args.parentFilters?.sport) {
              // Extract unique sports from BSC response
              const sports = new Set<string>();
              // Process bscData to extract sports - this is placeholder logic
              // In a real implementation, you would parse bscData to extract available sports
              if (bscData && typeof bscData === "object") {
                // Placeholder: extract sports from bscData
                // This would need to be adapted based on the actual BSC API response structure
                console.log(
                  `[getAggregatedSelectorOptions] BSC data received:`,
                  bscData,
                );
              }

              bscOptions = Array.from(sports).map((sport) => ({
                value: sport.charAt(0).toUpperCase() + sport.slice(1), // Capitalize first letter
                platformData: { bsc: [sport.toLowerCase()] },
              }));
            } else if (args.level === "year" && !args.parentFilters?.year) {
              // Extract unique years from BSC response
              const years = new Set<string>();
              // Process bscData to extract years - this is placeholder logic
              if (bscData && typeof bscData === "object") {
                // Placeholder: extract years from bscData
                console.log(
                  `[getAggregatedSelectorOptions] BSC data received:`,
                  bscData,
                );
              }

              bscOptions = Array.from(years).map((year) => ({
                value: year,
                platformData: { bsc: [year] },
              }));
            }
            // Add similar logic for other levels

            console.log(
              `[getAggregatedSelectorOptions] Got ${bscOptions.length} BSC options`,
            );
          } else {
            console.error(
              `[getAggregatedSelectorOptions] BSC API error: ${bscResponse.status}`,
            );
          }
        } else {
          console.error(
            `[getAggregatedSelectorOptions] No BSC token available`,
          );
        }
      } catch (error) {
        console.error(`[getAggregatedSelectorOptions] BSC error:`, error);
      }

      // 3. Combine and deduplicate options
      const valueMap = new Map<
        string,
        { value: string; platformData: { sportlots?: string; bsc?: string[] } }
      >();

      // Add SportLots options
      sportlotsOptions.forEach((option) => {
        const normalizedValue = option.value.toLowerCase();
        if (!valueMap.has(normalizedValue)) {
          valueMap.set(normalizedValue, {
            value: option.value,
            platformData: { sportlots: option.platformData.sportlots },
          });
        } else {
          // Merge with existing entry
          const existing = valueMap.get(normalizedValue)!;
          existing.platformData.sportlots = option.platformData.sportlots;
        }
      });

      // Add BSC options
      bscOptions.forEach((option) => {
        const normalizedValue = option.value.toLowerCase();
        if (!valueMap.has(normalizedValue)) {
          valueMap.set(normalizedValue, {
            value: option.value,
            platformData: { bsc: option.platformData.bsc },
          });
        } else {
          // Merge with existing entry
          const existing = valueMap.get(normalizedValue)!;
          existing.platformData.bsc = option.platformData.bsc;
        }
      });

      // Convert map back to array
      aggregatedOptions.push(...Array.from(valueMap.values()));

      console.log(
        `[getAggregatedSelectorOptions] Successfully combined ${aggregatedOptions.length} options`,
      );

      return {
        success: true,
        message: `Successfully found ${aggregatedOptions.length} ${args.level} options from SportLots and BSC`,
        optionsCount: aggregatedOptions.length,
        options: aggregatedOptions,
      };
    } catch (error) {
      console.error(`[getAggregatedSelectorOptions] Error:`, error);
      return {
        success: false,
        message: `Failed to get aggregated selector options: ${error instanceof Error ? error.message : "Unknown error"}`,
        optionsCount: 0,
        options: [],
      };
    }
  },
});
