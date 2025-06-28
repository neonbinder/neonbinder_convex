import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  numbers: defineTable({
    value: v.number(),
  }),

  // New top-level: Sports
  sports: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
  }).index("by_name", ["name"]),

  years: defineTable({
    sportId: v.id("sports"),
    year: v.number(),
    description: v.optional(v.string()),
  }).index("by_sport", ["sportId"]).index("by_year", ["year"]),

  manufacturers: defineTable({
    yearId: v.id("years"),
    name: v.string(),
    description: v.optional(v.string()),
  }).index("by_year", ["yearId"]),

  sets: defineTable({
    manufacturerId: v.id("manufacturers"),
    name: v.string(),
    description: v.optional(v.string()),
  }).index("by_manufacturer", ["manufacturerId"]),

  setVariants: defineTable({
    setId: v.id("sets"),
    name: v.string(),
    description: v.optional(v.string()),
    variantType: v.union(
      v.literal("base"),
      v.literal("parallel"),
      v.literal("insert"),
      v.literal("parallel_of_insert")
    ),
    parentVariantId: v.optional(v.id("setVariants")), // For parallels of inserts
    parallelName: v.optional(v.string()), // For parallel variants
    insertName: v.optional(v.string()),   // For insert variants
  }).index("by_set", ["setId"]),

  cards: defineTable({
    setVariantId: v.id("setVariants"),
    cardNumber: v.string(),
    playerName: v.optional(v.string()),
    team: v.optional(v.string()),
    position: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index("by_set_variant", ["setVariantId"]),
});
