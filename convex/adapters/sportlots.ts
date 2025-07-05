"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { BaseAdapter, SetAdapter, SetSearchParams, SetListingsResponse, SetListing } from "./base";
import { api } from "../_generated/api";

export class SportlotsAdapter extends BaseAdapter implements SetAdapter {
  private baseUrl = "https://www.sportlots.com";

  async searchSets(params: SetSearchParams): Promise<SetListingsResponse> {
    try {
      // Build search query for Sportlots
      const searchParams = {
        search: params.setName,
        year: params.year,
        sport: params.sport,
        brand: params.manufacturer,
        min_price: params.minPrice,
        max_price: params.maxPrice,
      };

      const queryString = this.buildQueryString(searchParams);
      const url = `${this.baseUrl}/search?${queryString}`;

      const response = await this.makeRequest(url);
      const data = await this.parseJsonResponse(response) as SportlotsResponse;

      // Transform the response to our standard format
      const listings: SetListing[] = data.sets.map(item => ({
        id: item.set_id,
        setName: item.set_name,
        year: item.year,
        sport: item.sport,
        manufacturer: item.brand,
        totalCards: item.card_count,
        price: item.price,
        condition: item.condition,
        platform: "sportlots",
        url: `${this.baseUrl}/set/${item.set_id}`,
        seller: item.seller,
      }));

      return {
        listings,
        totalCount: data.total_sets,
        platform: "sportlots",
      };
    } catch (error) {
      console.error("Error searching Sportlots:", error);
      throw new Error(`Failed to search Sportlots: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Sportlots API response types
interface SportlotsResponse {
  sets: Array<{
    set_id: string;
    set_name: string;
    year: number;
    sport: string;
    brand: string;
    card_count?: number;
    price: number;
    condition?: string;
    seller?: string;
  }>;
  total_sets: number;
}

// Convex action to search Sportlots
export const searchSportlots = action({
  args: {
    setName: v.string(),
    year: v.optional(v.number()),
    sport: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    maxPrice: v.optional(v.number()),
    minPrice: v.optional(v.number()),
  },
  returns: v.object({
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
    platform: v.string(),
  }),
  handler: async (ctx, args) => {
    const adapter = new SportlotsAdapter();
    return await adapter.searchSets(args);
  },
});

// Convex action to test Sportlots credentials
export const testCredentials = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    details: v.optional(v.string()),
  }),
  handler: async (ctx): Promise<{ success: boolean; message: string; details?: string }> => {
    // Get stored credentials
    const credentials: { username: string; password: string; site: string; userId: string; createdAt: string } | null = await ctx.runAction(api.adapters.secret_manager.getSiteCredentials, {
      site: "sportlots",
    });

    if (!credentials) {
      return {
        success: false,
        message: "No credentials found for Sportlots",
        details: "Please save your credentials for Sportlots before testing. Go to the credentials section and enter your username and password."
      };
    }

    // Placeholder - implement actual Sportlots login test
    return {
      success: true,
      message: `Sportlots credentials found for ${credentials.username}. Login testing not yet implemented.`,
      details: "This is a placeholder. Actual Sportlots login testing will be implemented in a future update."
    };
  },
});
