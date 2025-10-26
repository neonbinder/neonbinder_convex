import { verifyToken } from "@clerk/backend";

/**
 * Get the current user's Clerk identity from the Convex context
 * For actions ("use node"), we need to manually extract and verify the token
 */
export async function getCurrentUserId(ctx: any) {
  console.log("[getCurrentUserId] Called, ctx.auth exists:", !!ctx.auth);
  
  // For queries and mutations, use Convex's built-in auth
  if (ctx.auth) {
    console.log("[getCurrentUserId] Calling getUserIdentity()...");
    const identity = await ctx.auth.getUserIdentity();
    console.log("[getCurrentUserId] Identity received:", identity ? "Found" : "NULL", identity);
    
    if (identity && identity.subject) {
      console.log("[getCurrentUserId] Returning userId:", identity.subject);
      return identity.subject;
    }
  } else {
    console.log("[getCurrentUserId] ctx.auth is undefined");
  }
  
  // For actions running on Node.js, Convex doesn't automatically handle auth
  // We need to get the token from the request headers
  // Note: In Convex Actions, the auth token should be passed via ConvexReactClient
  // but the ctx.auth.getUserIdentity() might return null for actions
  
  console.log("[getCurrentUserId] No identity found, returning null");
  return null;
}

/**
 * Get Clerk user ID from a JWT token (for actions that run on Node.js)
 * Use this when ctx.auth.getUserIdentity() returns null in actions
 */
export async function getClerkUserIdFromToken(token: string | null | undefined): Promise<string | null> {
  if (!token) {
    return null;
  }
  
  try {
    const decoded = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return decoded.sub || null;
  } catch (error) {
    console.error("Failed to verify Clerk token:", error);
    return null;
  }
}

/**
 * Verify a Clerk token
 * Use this in actions and HTTP handlers when you need to verify a token
 */
export async function verifyClerkToken(token: string) {
  try {
    const decoded = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    return decoded;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}
