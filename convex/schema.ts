import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Using Clerk for authentication - users are identified by Clerk user IDs
export default defineSchema({
  // Users table for storing Clerk user data
  users: defineTable({
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    // Store the Clerk user ID as a string (not as a Convex ID)
    clerkUserId: v.optional(v.string()),
  }).index("by_clerk_user_id", ["clerkUserId"]),

  numbers: defineTable({
    value: v.number(),
  }),

  // User profiles for storing site credential references and preferences
  // Using Clerk user IDs as strings
  userProfiles: defineTable({
    userId: v.string(), // Clerk user ID as string
    siteCredentials: v.optional(v.array(v.object({
      site: v.string(),
      hasCredentials: v.boolean(),
      lastUpdated: v.optional(v.string()),
    }))),
    preferences: v.optional(v.object({
      defaultSport: v.optional(v.string()),
      defaultYear: v.optional(v.number()),
      theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
    })),
  }).index("by_user", ["userId"]),

  // Selector Options - stores all possible values for each selector level
  selectorOptions: defineTable({
    level: v.union(
      v.literal("sport"),
      v.literal("year"),
      v.literal("manufacturer"),
      v.literal("setName"),
      v.literal("variantType"),
      v.literal("insert"),
      v.literal("parallel")
    ),
    value: v.string(), // Display value (e.g., "Football")
    platformData: v.object({
      bsc: v.optional(v.union(v.string(), v.array(v.string()))),
      sportlots: v.optional(v.string()),
    }),
    parentId: v.optional(v.id("selectorOptions")), // For hierarchical relationships
    children: v.optional(v.array(v.id("selectorOptions"))), // Child options
    lastUpdated: v.number(),
  }).index("by_level", ["level"]).index("by_parent", ["parentId"]).index("by_value", ["value"]),

  // Set Selections - stores user's selected set parameters
  setSelections: defineTable({
    name: v.string(),
    description: v.string(),
    sport: v.optional(v.array(v.object({ site: v.string(), value: v.string() }))),
    year: v.optional(v.array(v.object({ site: v.string(), value: v.string() }))),
    manufacturer: v.optional(v.array(v.object({ site: v.string(), value: v.string() }))),
    setName: v.optional(v.array(v.object({ site: v.string(), value: v.string() }))),
    variantType: v.optional(v.array(v.object({ site: v.string(), value: v.string() }))),
    insert: v.optional(v.array(v.object({ site: v.string(), value: v.string() }))),
    parallel: v.optional(v.array(v.object({ site: v.string(), value: v.string() }))),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // Prize Pool - stores prizes for the wheel of fortune spin
  prizePool: defineTable({
    userId: v.string(), // Clerk user ID as string
    prizeName: v.string(),
    percentage: v.number(), // 0-100, represents the likelihood of winning this prize
    pokemonImageUrl: v.optional(v.string()), // URL to the Pokemon variant image stored in Google Cloud Storage
    sportsImageUrls: v.optional(v.array(v.string())), // Array of URLs to sports variant images stored in Google Cloud Storage
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
