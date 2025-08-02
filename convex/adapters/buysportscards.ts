"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { BaseAdapter, SetAdapter, SetParameters } from "./base";
import axios, { AxiosInstance } from "axios";

// Types for BSC API responses
interface Filter {
  label: string;
  slug: string;
  count: number;
}

interface Aggregations {
  aggregations: {
    [key: string]: Filter[];
  };
}

interface FilterParams {
  filters: {
    [key: string]: string[];
  };
}

export class BuySportsCardsAdapter extends BaseAdapter implements SetAdapter {
  private baseUrl = "https://api-prod.buysportscards.com";
  private _api: AxiosInstance | null = null;

  private get api(): AxiosInstance {
    if (!this._api) {
      this.login();
      if (!this._api) {
        throw new Error("API not initialized. Call login() first to get authentication token.");
      }
    }
    return this._api;
  }

  private async initializeApi(token: string): Promise<void> {
    this._api = axios.create({
      baseURL: 'https://api-prod.buysportscards.com/',
      headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        assumedrole: 'sellers',
        'content-type': 'application/json',
        origin: 'https://www.buysportscards.com',
        referer: 'https://www.buysportscards.com/',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': 'macOS',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        authority: 'api-prod.buysportscards.com',
        authorization: `Bearer ${token}`,
      },
    });
  }

  /**
   * Build set parameters by calling the BSC filters API
   * This method helps build the primary key for identifying sets
   */
  async buildSetParameters(partial: Partial<SetParameters>): Promise<Partial<SetParameters>> {
    try {
      // Start with the provided partial parameters
      const result: Partial<SetParameters> = { ...partial };

      // If we have sport, year, and manufacturer, we can get set options
      if (result.sport && result.year && result.manufacturer) {
        const filterParams: FilterParams = {
          filters: {
            sport: [result.sport],
            year: [result.year.toString()],
            manufacturer: [result.manufacturer],
          }
        };

        // Call the BSC filters API to get available sets
        const response = await this.api.post<Aggregations>('search/bulk-upload/filters', filterParams);
        const setOptions = response.data.aggregations.setName?.filter(option => option.count > 0) || [];

        // If we have a setName in partial, validate it exists
        if (result.setName) {
          const matchingSet = setOptions.find(option => option.label === result.setName);
          if (!matchingSet) {
            console.warn(`[BSC Adapter] Set name "${result.setName}" not found in available options`);
          }
        }

        // If we have a setName and variantType, we can get variant options
        if (result.setName && result.variantType) {
          const variantFilterParams: FilterParams = {
            filters: {
              ...filterParams.filters,
              setName: [result.setName],
            }
          };

          const variantResponse = await this.api.post<Aggregations>('search/bulk-upload/filters', variantFilterParams);
          const variantOptions = variantResponse.data.aggregations.variantName?.filter(option => option.count > 0) || [];

          // Handle different variant types
          if (result.variantType === 'base') {
            const baseVariant = variantOptions.find(option => option.label.toLowerCase() === 'base');
            if (baseVariant) {
              result.variantType = 'base';
            }
          } else if (result.variantType === 'insert' && result.insertName) {
            const insertVariant = variantOptions.find(option => option.label === result.insertName);
            if (insertVariant) {
              result.insertName = insertVariant.label;
            }
          } else if (result.variantType === 'parallel' && result.parallelName) {
            const parallelVariant = variantOptions.find(option => option.label === result.parallelName);
            if (parallelVariant) {
              result.parallelName = parallelVariant.label;
            }
          } else if (result.variantType === 'parallel_of_insert' && result.insertName && result.parallelName) {
            // For parallel_of_insert, we need to find the insert first, then its parallels
            const insertVariant = variantOptions.find(option => option.label === result.insertName);
            if (insertVariant) {
              result.insertName = insertVariant.label;
              // Note: For parallel_of_insert, we might need an additional API call
              // to get the parallels of a specific insert
            }
          }
        }
      }

      return result;
    } catch (error) {
      console.error(`[BSC Adapter] Error building set parameters:`, error);
      throw new Error(`Failed to build set parameters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available options for a specific parameter type
   * This method calls the BSC filters API and returns available options
   */
  async getAvailableOptions(partial: Partial<SetParameters>): Promise<{
    availableOptions: {
      sports?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
      years?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
      manufacturers?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
      setNames?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
      variantNames?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
    };
    currentParams: Partial<SetParameters>;
  }> {
    try {
      const result: Partial<SetParameters> = { ...partial };
      const availableOptions: {
        sports?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
        years?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
        manufacturers?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
        setNames?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
        variantNames?: Array<{ site: string; values: Array<{ label: string; value: string }> }>;
      } = {};

      // Get sports if no sport is selected
      if (!result.sport) {
        const response = await this.api.post<Aggregations>('search/bulk-upload/filters', { filters: {} });
        const sports = response.data.aggregations.sport?.filter(option => option.count > 0) || [];
        availableOptions.sports = [{
          site: "BSC",
          values: sports.map(sport => ({
            label: sport.slug,
            value: sport.slug
          }))
        }];
      }

      // Get years if sport is selected but no year
      if (result.sport && !result.year) {
        const filterParams: FilterParams = {
          filters: { sport: [result.sport] }
        };
        const response = await this.api.post<Aggregations>('search/bulk-upload/filters', filterParams);
        const years = response.data.aggregations.year?.filter(option => option.count > 0) || [];
        availableOptions.years = [{
          site: "BSC",
          values: years.map(year => ({
            label: year.slug,
            value: year.slug
          }))
        }];
      }

      // Get manufacturers if sport and year are selected but no manufacturer
      if (result.sport && result.year && !result.manufacturer) {
        const filterParams: FilterParams = {
          filters: {
            sport: [result.sport],
            year: [result.year.toString()]
          }
        };
        const response = await this.api.post<Aggregations>('search/bulk-upload/filters', filterParams);
        const manufacturers = response.data.aggregations.manufacturer?.filter(option => option.count > 0) || [];
        availableOptions.manufacturers = [{
          site: "BSC",
          values: manufacturers.map(manufacturer => ({
            label: manufacturer.slug,
            value: manufacturer.slug
          }))
        }];
      }

      // Get set names if sport, year, and manufacturer are selected but no set name
      if (result.sport && result.year && result.manufacturer && !result.setName) {
        const filterParams: FilterParams = {
          filters: {
            sport: [result.sport],
            year: [result.year.toString()],
            manufacturer: [result.manufacturer]
          }
        };
        const response = await this.api.post<Aggregations>('search/bulk-upload/filters', filterParams);
        const setNames = response.data.aggregations.setName?.filter(option => option.count > 0) || [];
        availableOptions.setNames = [{
          site: "BSC",
          values: setNames.map(setName => ({
            label: setName.slug,
            value: setName.slug
          }))
        }];
      }

      // Get variant names if all previous parameters are selected but no variant type
      if (result.sport && result.year && result.manufacturer && result.setName && !result.variantType) {
        const filterParams: FilterParams = {
          filters: {
            sport: [result.sport],
            year: [result.year.toString()],
            manufacturer: [result.manufacturer],
            setName: [result.setName]
          }
        };
        const response = await this.api.post<Aggregations>('search/bulk-upload/filters', filterParams);
        const variantNames = response.data.aggregations.variantName?.filter(option => option.count > 0) || [];
        availableOptions.variantNames = [{
          site: "BSC",
          values: variantNames.map(variantName => ({
            label: variantName.slug,
            value: variantName.slug
          }))
        }];
      }

      return {
        availableOptions,
        currentParams: result
      };
    } catch (error) {
      console.error(`[BSC Adapter] Error getting available options:`, error);
      throw new Error(`Failed to get available options: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Example method showing how to use the API object
   * This demonstrates making authenticated requests to BuySportsCards
   */
  async makeAuthenticatedRequest(endpoint: string): Promise<unknown> {
    try {
      const response = await this.api.get(endpoint);
      return response.data;
    } catch (error) {
      console.error(`[BSC Adapter] API request failed:`, error);
      throw new Error(`Failed to make authenticated request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
      console.log(`[BSC Adapter] Checking if browser service is running at ${url}/sites`);
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
      // Call the browser automation service to get the token
      const response = await fetch(`${browserServiceUrl}/bsc-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: process.env.BSC_EMAIL,
          password: process.env.BSC_PASSWORD,
        }),
      });
      if (!response.ok) throw new Error("Failed to login to BuySportsCards via browser service");
      const { token, expiresAt } = await response.json();

      // Initialize the API with the token
      console.log("token", token);
      await this.initializeApi(token);

      return {
        accessToken: token,
        expiresAt,
      };
    } catch (error) {
      // Log detailed error information
      console.error(`[BSC Adapter] Error logging in to BuySportsCards:`, error);
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

// Convex action to get available set parameters from BSC
export const getAvailableSetParameters = action({
  args: {
    partialParams: v.object({
      sport: v.optional(v.string()),
      year: v.optional(v.number()),
      manufacturer: v.optional(v.string()),
      setName: v.optional(v.string()),
      variantType: v.optional(v.union(
        v.literal("base"),
        v.literal("insert"),
        v.literal("parallel"),
        v.literal("parallel_of_insert")
      )),
      insertName: v.optional(v.string()),
      parallelName: v.optional(v.string()),
    }),
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
    currentParams: v.object({
      sport: v.optional(v.string()),
      year: v.optional(v.number()),
      manufacturer: v.optional(v.string()),
      setName: v.optional(v.string()),
      variantType: v.optional(v.union(
        v.literal("base"),
        v.literal("insert"),
        v.literal("parallel"),
        v.literal("parallel_of_insert")
      )),
      insertName: v.optional(v.string()),
      parallelName: v.optional(v.string()),
    }),
  }),
  handler: async (ctx, args) => {
    try {
      const adapter = new BuySportsCardsAdapter();
      
      // Login to get authentication
      await adapter.login();
      
      // Get available options using the adapter
      const result = await adapter.getAvailableOptions(args.partialParams);
      
      return {
        availableOptions: result.availableOptions,
        currentParams: result.currentParams,
      };
    } catch (error) {
      console.error("Error getting available set parameters:", error);
      throw new Error(`Failed to get available set parameters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});
