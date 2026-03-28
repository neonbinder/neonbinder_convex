import { verifyToken } from "@clerk/backend";

/**
 * Get the current user's Clerk identity from the Convex context
 * For actions ("use node"), we need to manually extract and verify the token
 */
export async function getCurrentUserId(ctx: any) {
  // For queries and mutations, use Convex's built-in auth
  if (ctx.auth) {
    const identity = await ctx.auth.getUserIdentity();
    if (identity && identity.subject) {
      return identity.subject;
    }
  }

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
