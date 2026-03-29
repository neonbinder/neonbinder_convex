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
    isCustom: v.optional(v.boolean()), // Distinguishes user-added entries from marketplace data
    createdByUserId: v.optional(v.string()), // Audit trail for custom entries
    lastUpdated: v.number(),
  })
    .index("by_level", ["level"])
    .index("by_parent", ["parentId"])
    .index("by_value", ["value"])
    .index("by_level_and_parent", ["level", "parentId"]),

  // Card Checklist - stores individual cards within a set variant
  cardChecklist: defineTable({
    selectorOptionId: v.id("selectorOptions"), // Points to variant-level option
    cardNumber: v.string(),
    cardName: v.string(),
    team: v.optional(v.string()),
    attributes: v.optional(v.array(v.string())), // ["RC", "AU", "SP"]
    platformData: v.object({
      bsc: v.optional(v.string()),
      sportlots: v.optional(v.string()),
    }),
    isCustom: v.optional(v.boolean()),
    sortOrder: v.number(),
    lastUpdated: v.number(),
  })
    .index("by_selector_option", ["selectorOptionId"])
    .index("by_selector_option_and_number", ["selectorOptionId", "cardNumber"]),

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

  // Public profiles for the Linktree-style collector page at /u/[username]
  publicProfiles: defineTable({
    userId: v.string(),             // Clerk user ID
    username: v.string(),           // URL slug, unique, lowercase a-z0-9-
    displayName: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    tagline: v.optional(v.string()),
    brandColor1: v.optional(v.string()),   // hex e.g. "#00D558"
    brandColor2: v.optional(v.string()),   // hex e.g. "#A44AFF"
    // Marketplace full URLs
    ebayUrl: v.optional(v.string()),
    buySportsCardsUrl: v.optional(v.string()),
    sportlotsUrl: v.optional(v.string()),
    mySlabsUrl: v.optional(v.string()),
    myCardPostUrl: v.optional(v.string()),
    // Payment handles (links constructed at render time)
    paypalUsername: v.optional(v.string()),
    paypalEmail: v.optional(v.string()),     // PayPal email for G&S payments
    venmoUsername: v.optional(v.string()),
    cashAppUsername: v.optional(v.string()),
    // Social media full URLs
    twitterUrl: v.optional(v.string()),
    instagramUrl: v.optional(v.string()),
    tiktokUrl: v.optional(v.string()),
    youtubeUrl: v.optional(v.string()),
    facebookUrl: v.optional(v.string()),
    threadsUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_username", ["username"]),

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
