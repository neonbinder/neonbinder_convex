import { PostHog } from "posthog-node";

// NOTE: This is a Node.js client, so you can use it for sending events from the server side to PostHog.
export default function PostHogClient() {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  
  if (!posthogKey) {
    console.warn("PostHog key not found. Server-side PostHog client will not be initialized.");
    return null;
  }

  const posthogClient = new PostHog(posthogKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });

  return posthogClient;
}
