import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      // Your Clerk Issuer URL from your "convex" JWT template
      // This is your Clerk Frontend API URL
      domain: "https://clerk.neonbinder.io/.well-known/jwks.json",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
