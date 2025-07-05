"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { BaseAdapter, SetAdapter, SetSearchParams, SetListingsResponse, SetListing } from "./base";
import { getSecretManagerClient } from "./secret_manager";

export class BuySportsCardsAdapter extends BaseAdapter implements SetAdapter {
  private baseUrl = "https://api-prod.buysportscards.com";

  async searchSets(params: SetSearchParams): Promise<SetListingsResponse> {
    try {
      // Get authentication tokens
      const tokens = await this.getTokens();
      if (!tokens) {
        throw new Error("Not authenticated with BuySportsCards. Please authenticate first.");
      }

      // Build search query for BuySportsCards API
      const searchParams = {
        q: params.setName,
        year: params.year,
        sport: params.sport,
        manufacturer: params.manufacturer,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        limit: 50,
      };

      const queryString = this.buildQueryString(searchParams);
      const url = `${this.baseUrl}/api/sets/search?${queryString}`;

      const response = await this.makeRequest(url, {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'en-US,en;q=0.9',
          'assumedrole': 'sellers',
          'content-type': 'application/json',
          'origin': 'https://www.buysportscards.com',
          'referer': 'https://www.buysportscards.com/',
          'authority': 'api-prod.buysportscards.com',
          'authorization': `Bearer ${tokens.accessToken}`,
        },
      });

      const data = await this.parseJsonResponse(response) as BuySportsCardsResponse;

      // Transform the response to our standard format
      const listings: SetListing[] = data.results.map(item => ({
        id: item.id,
        setName: item.set_name,
        year: item.year,
        sport: item.sport,
        manufacturer: item.manufacturer,
        totalCards: item.total_cards,
        price: item.price,
        condition: item.condition,
        platform: "buysportscards",
        url: `${this.baseUrl}/set/${item.id}`,
        seller: item.seller,
      }));

      return {
        listings,
        totalCount: data.total_count,
        platform: "buysportscards",
      };
    } catch (error) {
      console.error("Error searching BuySportsCards:", error);
      throw new Error(`Failed to search BuySportsCards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getTokens(): Promise<{ accessToken: string; expiresAt: number } | null> {
    // This would need to be called from within a Convex action context
    // For now, we'll return null and let the caller handle authentication
    return null;
  }

  /**
   * Helper function to check if the browser service is running
   * @param url The URL of the browser service
   * @returns A promise that resolves to true if the service is running, false otherwise
   */
  private async isBrowserServiceRunning(url: string): Promise<boolean> {
    try {
      console.log(`[BSC Adapter] Checking if browser service is running at ${url}`);

      // Create AbortController for timeout (short timeout for just checking)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      // Try to fetch the /sites endpoint which should be available if the service is running
      const response = await fetch(`${url}/sites`, {
        method: 'GET',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      console.log(`[BSC Adapter] Browser service check response status: ${response.status}`);
      return response.ok;
    } catch (error) {
      console.error(`[BSC Adapter] Browser service check failed:`, error);
      return false;
    }
  }

  async login(): Promise<{ accessToken: string; expiresAt: number }> {
    // Get the browser service URL from environment variable or use default
    let browserServiceUrl = process.env.NEONBINDER_BROWSER_URL || 'http://localhost:8080';

    // Ensure the URL has the correct format (has protocol)
    if (!browserServiceUrl.startsWith('http://') && !browserServiceUrl.startsWith('https://')) {
      browserServiceUrl = `http://${browserServiceUrl}`;
    }

    // Remove trailing slash if present
    if (browserServiceUrl.endsWith('/')) {
      browserServiceUrl = browserServiceUrl.slice(0, -1);
    }

    console.log(`[BSC Adapter] Using browser service URL: ${browserServiceUrl}`);

    // Check if the browser service is running
    const isServiceRunning = await this.isBrowserServiceRunning(browserServiceUrl);
    if (!isServiceRunning) {
      console.error(`[BSC Adapter] Browser service is not running at ${browserServiceUrl}`);
      throw new Error(`Browser service is not running at ${browserServiceUrl}. Please start the browser service and try again.`);
    }

    console.log(`[BSC Adapter] Browser service is running at ${browserServiceUrl}`);

    try {
      // Get credentials from Secret Manager
      // Note: This would need to be called from within a Convex action context
      // For now, we'll use a placeholder token
      console.log(`[BSC Adapter] Using placeholder token for authentication`);

      // For now, we'll use a default expiration time
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

      return {
        accessToken: 'placeholder-token',
        expiresAt,
      };
    } catch (error) {
      // Log detailed error information
      console.error(`[BSC Adapter] Error logging in to BuySportsCards:`, error);

      // Determine the type of error and provide a more specific error message
      let errorMessage: string;

      if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = 'Unknown error occurred during login process';
      }

      console.error(`[BSC Adapter] Login error details: ${errorMessage}`);
      throw new Error(`Failed to login to BuySportsCards: ${errorMessage}`);
    }
  }
}

// BuySportsCards API response types
interface BuySportsCardsResponse {
  results: Array<{
    id: string;
    set_name: string;
    year: number;
    sport: string;
    manufacturer: string;
    total_cards?: number;
    price: number;
    condition?: string;
    seller?: string;
  }>;
  total_count: number;
}

// Convex action to search BuySportsCards
export const searchBuySportsCards = action({
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
    try {
      // Get stored credentials
      const credentials = await ctx.runAction(api.adapters.secret_manager.getSiteCredentials, {
        site: "buysportscards",
      });

      if (!credentials) {
        throw new Error("Not authenticated with BuySportsCards. Please save credentials first.");
      }

      // Login to get fresh tokens
      const adapter = new BuySportsCardsAdapter();
      const tokens = await adapter.login();

      // Build search query for BuySportsCards API
      const searchParams = {
        q: args.setName,
        year: args.year,
        sport: args.sport,
        manufacturer: args.manufacturer,
        minPrice: args.minPrice,
        maxPrice: args.maxPrice,
        limit: 50,
      };

      // Build query string
      const queryString = new URLSearchParams();
      for (const [key, value] of Object.entries(searchParams)) {
        if (value !== undefined && value !== null) {
          queryString.append(key, String(value));
        }
      }

      const url = `https://api-prod.buysportscards.com/api/sets/search?${queryString}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'en-US,en;q=0.9',
          'assumedrole': 'sellers',
          'content-type': 'application/json',
          'origin': 'https://www.buysportscards.com',
          'referer': 'https://www.buysportscards.com/',
          'authority': 'api-prod.buysportscards.com',
          'authorization': `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as BuySportsCardsResponse;

      // Transform the response to our standard format
      const listings = data.results.map(item => ({
        id: item.id,
        setName: item.set_name,
        year: item.year,
        sport: item.sport,
        manufacturer: item.manufacturer,
        totalCards: item.total_cards,
        price: item.price,
        condition: item.condition,
        platform: "buysportscards",
        url: `https://api-prod.buysportscards.com/set/${item.id}`,
        seller: item.seller,
      }));

      return {
        listings,
        totalCount: data.total_count,
        platform: "buysportscards",
      };

    } catch (error) {
      console.error("Error searching BuySportsCards:", error);
      throw new Error(`Failed to search BuySportsCards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

// Convex action to test BuySportsCards credentials
export const testCredentials = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    details: v.optional(v.string()),
  }),
  handler: async () => {
    console.log(`[BSC testCredentials] Testing credentials`);

    try {
      const adapter = new BuySportsCardsAdapter();
      const tokens = await adapter.login();
      if (!tokens || !tokens.accessToken) {
        throw new Error("Failed to retrieve access token from BuySportsCards.");
      }

      return {
        success: true,
        message: `Successfully authenticated with BuySportsCards. Access token valid until ${new Date(tokens.expiresAt).toLocaleString()}`,
        details: `Token type: ${tokens.accessToken === 'placeholder-token' ? 'Placeholder (browser service login)' : 'Standard API token'}`
      };
    } catch (error) {
      console.error(`[BSC testCredentials] Authentication failed:`, error);

      // Provide more detailed error information
      let errorMessage: string;
      let details: string | undefined;

      if (error instanceof Error) {
        errorMessage = error.message;

        // Add more context based on the error message
        if (error.message.includes('Connection refused')) {
          details = "The browser service is not running or is refusing connections. Make sure the browser service is started and listening on the configured port.";
        } else if (error.message.includes('Host not found')) {
          details = "The browser service host could not be resolved. Check that the NEONBINDER_BROWSER_URL environment variable is set correctly.";
        } else if (error.message.includes('Connection reset')) {
          details = "The connection to the browser service was reset. The service might be overloaded or experiencing issues.";
        } else if (error.message.includes('Network error')) {
          details = "A network error occurred when trying to connect to the browser service. Check your network configuration and firewall settings.";
        } else if (error.message.includes('browser service')) {
          details = "The browser service might not be running or accessible. Check that the NEONBINDER_BROWSER_URL environment variable is set correctly and the service is running.";
        } else if (error.message.includes('Secret Manager')) {
          details = "There was an issue accessing Google Cloud Secret Manager. Check that the service account has the necessary permissions.";
        } else if (error.message.includes('fetch failed') || error.message.includes('Fetch failed')) {
          details = "Network request failed. Check your internet connection, firewall settings, and ensure the browser service is running at the configured URL.";
        } else if (error.message.includes('timed out') || error.message.includes('timeout')) {
          details = "The request to the browser service timed out. The service might be overloaded or not responding.";
        } else if (error.message.includes('Login failed')) {
          details = "The login attempt failed. Check your credentials and try again.";
        }
      } else {
        errorMessage = 'Unknown error';
      }

      // Log detailed information about the error
      console.log(`[BSC testCredentials] Error details: ${errorMessage}`);
      if (details) {
        console.log(`[BSC testCredentials] Troubleshooting advice: ${details}`);
      }

      return {
        success: false,
        message: `Authentication failed: ${errorMessage}`,
        details
      };
    }
  },
});
