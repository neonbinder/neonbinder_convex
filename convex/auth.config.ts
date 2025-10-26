import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      // Your Clerk Issuer URL from your "convex" JWT template
      // This is your Clerk Frontend API URL
      domain: "https://moved-kingfish-65.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
