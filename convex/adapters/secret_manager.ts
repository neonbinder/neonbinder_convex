"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserId } from "../auth";
import { SecretManagerServiceClient, protos } from "@google-cloud/secret-manager";
import { api } from "../_generated/api";

// Initialize Secret Manager client with credentials from base64 environment variable
export const getSecretManagerClient = () => {
  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64;
  if (!b64) throw new Error("GOOGLE_APPLICATION_CREDENTIALS_B64 not set");
  const credentialsJson = Buffer.from(b64, "base64").toString("utf8");
  const credentials = JSON.parse(credentialsJson);
  return new SecretManagerServiceClient({ credentials });
};

/**
 * Store credentials for any site in Secret Manager
 */
export const storeSiteCredentials = action({
  args: {
    site: v.string(), // e.g., "buysportscards", "ebay", "sportlots"
    username: v.string(),
    password: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    secretId: v.optional(v.string()),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    console.log("[storeSiteCredentials] Starting handler, args:", args);
    console.log("[storeSiteCredentials] Getting user identity from ctx.auth...");
    const identity = await ctx.auth.getUserIdentity();
    console.log("[storeSiteCredentials] Identity:", identity ? "Found" : "NULL", identity);
    
    const userId = await getCurrentUserId(ctx);
    console.log("[storeSiteCredentials] getCurrentUserId returned:", userId);
    
    if (!userId) {
      console.error("[storeSiteCredentials] No userId found - authentication failed");
      return {
        success: false,
        message: "Not authenticated",
      };
    }

    // Check if GCP features are enabled
    if (process.env.GCP_FEATURES_ENABLED !== 'true') {
      return {
        success: false,
        message: "Credential storage is coming soon!",
      };
    }

    console.log("[storeSiteCredentials] Authentication successful, userId:", userId);

    try {
      const secretManager = getSecretManagerClient();

      // Create a unique secret ID for this user and site
      const secretId = `${args.site}-credentials-${userId}`;

      // Create or update the secret
      const [secret] = await secretManager.createSecret({
        parent: `projects/neonbinder`,
        secretId,
        secret: {
          replication: {
            automatic: {},
          },
        },
      });

      // Add the secret version with credentials
      const credentials = JSON.stringify({
        username: args.username,
        password: args.password,
        site: args.site,
        userId: userId,
        createdAt: new Date().toISOString(),
      });

      await secretManager.addSecretVersion({
        parent: secret.name,
        payload: {
          data: Buffer.from(credentials, 'utf8'),
        },
      });

      return {
        success: true,
        secretId,
        message: `Credentials stored successfully for ${args.site}`,
      };
    } catch (error) {
      console.error("Failed to store credentials in Secret Manager:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to store credentials securely",
      };
    }
  },
});

/**
 * Get credentials for a specific site from Secret Manager
 */
export const getSiteCredentials = action({
  args: {
    site: v.string(), // e.g., "buysportscards", "ebay", "sportlots"
  },
  returns: v.union(
    v.object({
      username: v.string(),
      password: v.string(),
      site: v.string(),
      userId: v.string(),
      createdAt: v.string(),
      expiresAt: v.optional(v.float64()),
      token: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      console.log("[getSiteCredentials] No userId found in context");
      return null;
    }

    // Check if GCP features are enabled
    if (process.env.GCP_FEATURES_ENABLED !== 'true') {
      return null;
    }

    try {
      // Get the secret from Secret Manager
      const secretId = `${args.site}-credentials-${userId}`;
      const secretPath = `projects/neonbinder/secrets/${secretId}/versions/latest`;
      console.log(`[getSiteCredentials] Looking up secret for userId: ${userId}, secretId: ${secretId}`);

      const [version] = await getSecretManagerClient().accessSecretVersion({
        name: secretPath,
      });

      if (!version.payload?.data) {
        console.log(`[getSiteCredentials] No data found for secretId: ${secretId}`);
        return null;
      }

      const storedData = JSON.parse(version.payload.data.toString());

      // Sanitize the returned data to ensure it matches the validator
      // Provide defaults for missing required fields
      const credentials = {
        username: storedData.username || "",
        password: storedData.password || "",
        site: storedData.site || args.site,
        userId: storedData.userId || userId,
        createdAt: storedData.createdAt || new Date().toISOString(),
        ...(storedData.expiresAt && { expiresAt: Number(storedData.expiresAt) }),
        ...(storedData.token && { token: storedData.token }),
      };

      return credentials;
    } catch (error) {
      console.error("Failed to retrieve credentials from Secret Manager:", error);
      return null;
    }
  },
});

/**
 * Delete credentials for a specific site from Secret Manager
 */
export const deleteSiteCredentials = action({
  args: {
    site: v.string(), // e.g., "buysportscards", "ebay", "sportlots"
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      return {
        success: false,
        message: "Not authenticated",
      };
    }

    // Check if GCP features are enabled
    if (process.env.GCP_FEATURES_ENABLED !== 'true') {
      return {
        success: false,
        message: "Credential management is coming soon!",
      };
    }

    try {
      const secretManager = getSecretManagerClient();

      // Delete the secret from Secret Manager
      const secretId = `${args.site}-credentials-${userId}`;
      const secretPath = `projects/neonbinder/secrets/${secretId}`;

      await secretManager.deleteSecret({
        name: secretPath,
      });

      return {
        success: true,
        message: `Credentials deleted successfully for ${args.site}`,
      };
    } catch (error) {
      console.error("Failed to delete secret from Secret Manager:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete credentials",
      };
    }
  },
});

/**
 * List all sites that have stored credentials for the current user
 */
export const listUserSites = action({
  args: {},
  returns: v.array(v.object({
    site: v.string(),
    hasCredentials: v.boolean(),
  })),
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      return [];
    }

    // Check if GCP features are enabled
    if (process.env.GCP_FEATURES_ENABLED !== 'true') {
      return [];
    }

    try {
      const secretManager = getSecretManagerClient();

      // List all secrets for this user
      const [secrets] = await secretManager.listSecrets({
        parent: `projects/neonbinder`,
        filter: `name:${userId}`,
      });

      const sites = secrets
        .filter((secret: protos.google.cloud.secretmanager.v1.ISecret) => secret.name?.includes('-credentials-'))
        .map((secret: protos.google.cloud.secretmanager.v1.ISecret) => {
          const site = secret.name?.split('-credentials-')[0]?.split('/').pop() || '';
          return {
            site,
            hasCredentials: true,
          };
        });

      return sites;
    } catch (error) {
      console.error("Failed to list secrets from Secret Manager:", error);
      return [];
    }
  },
});

/**
 * Test credentials for any site - generic dispatcher
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
    console.log('[testSiteCredentials] Starting test for site:', args.site);

    // Check if GCP features are enabled
    if (process.env.GCP_FEATURES_ENABLED !== 'true') {
      return {
        success: false,
        message: "Credential testing is coming soon!",
      };
    }

    try {
      // Dispatch to site-specific test functions
      // Each site-specific test function will retrieve its own credentials
      switch (args.site) {
        case "buysportscards":
          const bscResult = await ctx.runAction(api.adapters.buysportscards.getBscToken, {});
          return {
            success: bscResult.success,
            message: bscResult.success ? "BSC token retrieved successfully" : bscResult.error || "Failed to get BSC token",
            details: bscResult.token ? "Token available" : undefined,
          };

        case "ebay":
          return await ctx.runAction(api.adapters.ebay.testCredentials, {});

        case "sportlots":
          return await ctx.runAction(api.adapters.sportlots.testCredentials, {});

        default:
          return {
            success: false,
            message: `Unsupported site: ${args.site}`,
            details: `The site "${args.site}" is not currently supported for credential testing. Supported sites include: buysportscards, ebay, and sportlots.`,
          };
      }
    } catch (error) {
      console.error(`Error testing credentials for ${args.site}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let details: string | undefined;

      // Provide more specific details based on the error
      if (error instanceof Error) {
        if (errorMessage.includes('Secret Manager')) {
          details = `There was an issue accessing Google Cloud Secret Manager. Please check that the service account has the necessary permissions.`;
        } else {
          details = `Please check your credentials and try again. If the issue persists, contact support.`;
        }
      }

      return {
        success: false,
        message: `Authentication failed: ${errorMessage}`,
        details,
      };
    }
  },
});
