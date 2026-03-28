import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const posthogKey = import.meta.env.VITE_POSTHOG_KEY;

    if (!posthogKey) {
      console.warn(
        "PostHog key not found. PostHog analytics will not be initialized.",
      );
      return;
    }

    posthog.init(posthogKey, {
      api_host:
        import.meta.env.VITE_POSTHOG_HOST || "https://us.posthog.com",
      ui_host: "https://us.posthog.com",
      capture_exceptions: true,
      debug: import.meta.env.MODE === "development",
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
