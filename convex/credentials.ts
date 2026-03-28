"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { getCurrentUserId } from "./auth";

const MAX_INPUT_LENGTH = 256;
const SUPPORTED_SITES = ["buysportscards", "sportlots"];

function browserUrl() {
  return process.env.NEONBINDER_BROWSER_URL || "http://localhost:8080";
}

function credKey(site: string, userId: string) {
  return `${site}-credentials-${userId}`;
}

function internalHeaders() {
  return {
    "Content-Type": "application/json",
    "x-internal-key": process.env.INTERNAL_API_KEY || "",
  };
}

function validateInputLength(value: string, fieldName: string) {
  if (value.length > MAX_INPUT_LENGTH) {
    throw new Error(`${fieldName} exceeds maximum length of ${MAX_INPUT_LENGTH} characters`);
  }
}

/**
 * Store username/password credentials for a site.
 * Sends to browser service which stores in GCP and validates login.
 */
export const storeSiteCredentials = action({
  args: {
    site: v.string(),
    username: v.string(),
    password: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    secretId: v.optional(v.string()),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    validateInputLength(args.username, "Username");
    validateInputLength(args.password, "Password");

    try {
      const key = credKey(args.site, userId);

      // Store credentials without marketplace validation.
      // Use "Test Credentials" to validate against the marketplace separately.
      const response = await fetch(`${browserUrl()}/credentials/${key}`, {
        method: "PUT",
        headers: internalHeaders(),
        body: JSON.stringify({
          username: args.username,
          password: args.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        return {
          success: false,
          message: (errorData as { error?: string }).error || `Failed to store credentials for ${args.site}`,
        };
      }

      return {
        success: true,
        secretId: key,
        message: `Credentials stored successfully for ${args.site}`,
      };
    } catch (error) {
      console.error(`Failed to store credentials for ${args.site}`);
      return {
        success: false,
        message: "Failed to store credentials securely",
      };
    }
  },
});

/**
 * Get credential metadata for a site (no secrets — safe for frontend use).
 */
export const getSiteCredentials = action({
  args: {
    site: v.string(),
  },
  returns: v.union(
    v.object({
      username: v.string(),
      site: v.string(),
      hasToken: v.boolean(),
      expiresAt: v.optional(v.float64()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    try {
      const key = credKey(args.site, userId);
      const response = await fetch(`${browserUrl()}/credentials/${key}/metadata`, {
        method: "GET",
        headers: internalHeaders(),
      });

      if (response.status === 404) return null;
      if (!response.ok) return null;

      const data = await response.json() as {
        username?: string;
        hasToken?: boolean;
        expiresAt?: number;
      };

      return {
        username: data.username || "",
        site: args.site,
        hasToken: !!data.hasToken,
        ...(data.expiresAt && { expiresAt: data.expiresAt }),
      };
    } catch (error) {
      console.error(`Failed to retrieve credential metadata for ${args.site}`);
      return null;
    }
  },
});

/**
 * Get site token from browser service (internal use only — for Convex adapters).
 * Returns only the token, never username/password.
 */
export const getSiteToken = action({
  args: {
    site: v.string(),
  },
  returns: v.union(
    v.object({
      token: v.string(),
      expiresAt: v.optional(v.float64()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    try {
      const key = credKey(args.site, userId);
      const response = await fetch(`${browserUrl()}/credentials/${key}/token`, {
        method: "GET",
        headers: internalHeaders(),
      });

      if (response.status === 404) return null;
      if (!response.ok) return null;

      return await response.json() as { token: string; expiresAt?: number };
    } catch (error) {
      console.error(`Failed to retrieve token for ${args.site}`);
      return null;
    }
  },
});

/**
 * Delete credentials for a site via browser service.
 */
export const deleteSiteCredentials = action({
  args: {
    site: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    try {
      const key = credKey(args.site, userId);
      const response = await fetch(`${browserUrl()}/credentials/${key}`, {
        method: "DELETE",
        headers: internalHeaders(),
      });

      if (!response.ok) {
        return {
          success: false,
          message: "Failed to delete credentials",
        };
      }

      return {
        success: true,
        message: `Credentials deleted successfully for ${args.site}`,
      };
    } catch (error) {
      console.error(`Failed to delete credentials for ${args.site}`);
      return {
        success: false,
        message: "Failed to delete credentials",
      };
    }
  },
});

/**
 * List all sites with stored credentials for the current user.
 */
export const listUserSites = action({
  args: {},
  returns: v.array(
    v.object({
      site: v.string(),
      hasCredentials: v.boolean(),
    }),
  ),
  handler: async (ctx): Promise<Array<{ site: string; hasCredentials: boolean }>> => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) return [];

    try {
      const keys = SUPPORTED_SITES.map((site) => credKey(site, userId));
      const response = await fetch(`${browserUrl()}/credentials/check`, {
        method: "POST",
        headers: internalHeaders(),
        body: JSON.stringify({ keys }),
      });

      if (!response.ok) return [];

      const data = await response.json() as { results: Record<string, boolean> };

      return SUPPORTED_SITES.map((site) => ({
        site,
        hasCredentials: data.results[credKey(site, userId)] || false,
      }));
    } catch (error) {
      console.error("Failed to list user credentials");
      return [];
    }
  },
});

/**
 * Test credentials for a site — dispatches to adapter test functions.
 */
export const testSiteCredentials = action({
  args: {
    site: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    details: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string; details?: string }> => {
    console.log(`[testSiteCredentials] Starting credential test for site: ${args.site}`);
    try {
      switch (args.site) {
        case "buysportscards": {
          console.log("[testSiteCredentials] Dispatching to authenticateBsc");
          const result = await ctx.runAction(
            api.credentials.authenticateBsc,
            {},
          );
          console.log(`[testSiteCredentials] authenticateBsc returned: success=${result.success}`);
          return result;
        }

        case "ebay": {
          console.log("[testSiteCredentials] Dispatching to ebay.testCredentials");
          const result = await ctx.runAction(api.adapters.ebay.testCredentials, {});
          console.log(`[testSiteCredentials] ebay.testCredentials returned: success=${result.success}`);
          return result;
        }

        case "sportlots": {
          console.log("[testSiteCredentials] Dispatching to authenticateSportlots");
          const result = await ctx.runAction(
            api.credentials.authenticateSportlots,
            {},
          );
          console.log(`[testSiteCredentials] authenticateSportlots returned: success=${result.success}`);
          return result;
        }

        default:
          console.log(`[testSiteCredentials] Unsupported site: ${args.site}`);
          return {
            success: false,
            message: `Unsupported site: ${args.site}`,
          };
      }
    } catch (error) {
      console.error(`[testSiteCredentials] Error testing credentials for ${args.site}:`, error);
      return {
        success: false,
        message: "Authentication test failed. Please check your credentials and try again.",
      };
    }
  },
});

/**
 * Authenticate BSC credentials via the browser service.
 * Reads credentials from GCP, sends to browser service for Puppeteer login,
 * which extracts the bearer token and stores it back in GCP.
 */
export const authenticateBsc = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    details: v.optional(v.string()),
  }),
  handler: async (ctx): Promise<{ success: boolean; message: string; details?: string }> => {
    console.log("[authenticateBsc] Starting BSC authentication");
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      console.log("[authenticateBsc] Not authenticated - no userId");
      throw new Error("Not authenticated");
    }

    try {
      const key = credKey("buysportscards", userId);
      const url = browserUrl();
      console.log(`[authenticateBsc] Using browser URL: ${url}, key: ${key}`);

      // Call browser service to log in — it reads credentials from Secret Manager internally
      console.log("[authenticateBsc] Calling browser service POST /login/bsc");
      const response = await fetch(`${url}/login/bsc`, {
        method: "POST",
        headers: internalHeaders(),
        body: JSON.stringify({ key }),
      });
      console.log(`[authenticateBsc] Login response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        const detail = (errorData as { error?: string }).error || response.statusText;
        await ctx.runAction(internal.posthog.captureEvent, {
          distinctId: userId,
          event: "credential_test_failed",
          properties: { platform: "buysportscards", reason: detail },
        }).catch(() => {});
        return {
          success: false,
          message: "BSC login failed. Please check your credentials and try again.",
        };
      }

      const loginResult = await response.json() as { success: boolean; message?: string; storeName?: string };

      if (!loginResult.success) {
        const detail = loginResult.message || "Login failed";
        await ctx.runAction(internal.posthog.captureEvent, {
          distinctId: userId,
          event: "credential_test_failed",
          properties: { platform: "buysportscards", reason: detail },
        }).catch(() => {});
        return {
          success: false,
          message: "BSC login failed. Please check your credentials and try again.",
        };
      }

      return {
        success: true,
        message: "BSC account authenticated successfully! Token stored.",
        details: loginResult.storeName ? `Store: ${loginResult.storeName}` : undefined,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      await ctx.runAction(internal.posthog.captureEvent, {
        distinctId: userId,
        event: "credential_test_failed",
        properties: { platform: "buysportscards", reason: detail },
      }).catch(() => {});
      console.error("Failed to authenticate BSC");
      return {
        success: false,
        message: "BSC authentication failed. Please try again.",
      };
    }
  },
});

/**
 * Authenticate SportLots credentials via the browser service.
 * Reads credentials from GCP, sends to browser service for HTTP login,
 * which extracts JS-set cookies and stores them back in GCP as a token.
 */
export const authenticateSportlots = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    details: v.optional(v.string()),
  }),
  handler: async (ctx): Promise<{ success: boolean; message: string; details?: string }> => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    try {
      const key = credKey("sportlots", userId);

      // Call browser service to log in — it reads credentials from Secret Manager internally
      const response = await fetch(`${browserUrl()}/login/sportlots`, {
        method: "POST",
        headers: internalHeaders(),
        body: JSON.stringify({ key }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        const detail = (errorData as { error?: string }).error || response.statusText;
        await ctx.runAction(internal.posthog.captureEvent, {
          distinctId: userId,
          event: "credential_test_failed",
          properties: { platform: "sportlots", reason: detail },
        }).catch(() => {});
        return {
          success: false,
          message: "SportLots login failed. Please check your credentials and try again.",
        };
      }

      const loginResult = await response.json() as { success: boolean; message?: string };

      if (!loginResult.success) {
        const detail = loginResult.message || "Login failed";
        await ctx.runAction(internal.posthog.captureEvent, {
          distinctId: userId,
          event: "credential_test_failed",
          properties: { platform: "sportlots", reason: detail },
        }).catch(() => {});
        return {
          success: false,
          message: "SportLots login failed. Please check your credentials and try again.",
        };
      }

      return {
        success: true,
        message: "SportLots account authenticated successfully! Session cookie stored.",
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      await ctx.runAction(internal.posthog.captureEvent, {
        distinctId: userId,
        event: "credential_test_failed",
        properties: { platform: "sportlots", reason: detail },
      }).catch(() => {});
      console.error("Failed to authenticate SportLots");
      return {
        success: false,
        message: "SportLots authentication failed. Please try again.",
      };
    }
  },
});
