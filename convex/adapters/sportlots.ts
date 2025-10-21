"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { BaseAdapter } from "./base";
import { api } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

export class SportlotsAdapter extends BaseAdapter {
  private baseUrl = "https://www.sportlots.com";
}

// Convex action to test Sportlots credentials
export const testCredentials = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    details: v.optional(v.string()),
  }),
  handler: async (
    ctx,
  ): Promise<{ success: boolean; message: string; details?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        success: false,
        message: "Not authenticated",
        details: "Please sign in to test credentials",
      };
    }

    // Get stored credentials to verify they exist
    const credentials: {
      username: string;
      password: string;
      site: string;
      userId: string;
      createdAt: string;
    } | null = await ctx.runAction(
      api.adapters.secret_manager.getSiteCredentials,
      {
        site: "sportlots",
      },
    );

    if (!credentials) {
      return {
        success: false,
        message: "No credentials found for Sportlots",
        details:
          "Please save your credentials for Sportlots before testing. Go to the credentials section and enter your username and password.",
      };
    }

    try {
      // Call the browser service to test login using the Secret Manager key
      const browserServiceUrl =
        process.env.BROWSER_SERVICE_URL ||
        "https://neonbinder-browser-117170654588.us-central1.run.app";
      const secretKey = `sportlots-credentials-${userId}`;

      const response = await fetch(`${browserServiceUrl}/login/sportlots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: secretKey,
        }),
      });

      if (!response.ok) {
        let errorDetails = "";
        try {
          const errorData = await response.json();
          errorDetails = errorData.error || JSON.stringify(errorData);
        } catch {
          errorDetails = `HTTP ${response.status}`;
        }
        return {
          success: false,
          message: "Failed to test Sportlots credentials",
          details: `Browser service error: ${errorDetails}`,
        };
      }

      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          message: result.message || "Successfully logged into Sportlots",
          details: `Login test completed successfully for ${credentials.username}`,
        };
      } else {
        return {
          success: false,
          message: "Sportlots login test failed",
          details: result.error || "Unknown error occurred during login test",
        };
      }
    } catch (error) {
      console.error("Error testing Sportlots credentials:", error);
      return {
        success: false,
        message: "Failed to test Sportlots credentials",
        details: `Error: ${error instanceof Error ? error.message : "Unknown error"}. Make sure the browser service is running at ${process.env.BROWSER_SERVICE_URL || "https://neonbinder-browser-117170654588.us-central1.run.app"}`,
      };
    }
  },
});
