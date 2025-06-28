import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Write your Convex functions in any file inside this directory (`convex`).
// See https://docs.convex.dev/functions for more.

// You can read data from the database via a query:
export const listNumbers = query({
  // Validators for arguments.
  args: {
    count: v.number(),
  },

  // Query implementation.
  handler: async (ctx, args) => {
    //// Read the database as many times as you need here.
    //// See https://docs.convex.dev/database/reading-data.
    const numbers = await ctx.db
      .query("numbers")
      // Ordered by _creationTime, return most recent
      .order("desc")
      .take(args.count);
    const userId = await getAuthUserId(ctx);
    const user = userId === null ? null : await ctx.db.get(userId);
    return {
      viewer: user?.email ?? null,
      numbers: numbers.reverse().map((number) => number.value),
    };
  },
});

// You can write data to the database via a mutation:
export const addNumber = mutation({
  // Validators for arguments.
  args: {
    value: v.number(),
  },

  // Mutation implementation.
  handler: async (ctx, args) => {
    //// Insert or modify documents in the database here.
    //// Mutations can also read from the database like queries.
    //// See https://docs.convex.dev/database/writing-data.

    const id = await ctx.db.insert("numbers", { value: args.value });

    console.log("Added new document with id:", id);
    // Optionally, return a value from your mutation.
    // return id;
  },
});

// You can fetch data from and send data to third-party APIs via an action:
export const myAction = action({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },
  returns: v.null(),
  // Action implementation.
  handler: async (ctx, args) => {
    //// Use the browser-like `fetch` API to send HTTP requests.
    //// See https://docs.convex.dev/functions/actions#calling-third-party-apis-and-using-npm-packages.
    // const response = await ctx.fetch("https://api.thirdpartyservice.com");
    // const data = await response.json();

    //// Query data by running Convex queries.
    const data = await ctx.runQuery(api.myFunctions.listNumbers, {
      count: 10,
    });
    console.log(data);

    //// Write data by running Convex mutations.
    await ctx.runMutation(api.myFunctions.addNumber, {
      value: args.first,
    });
  },
});

// ===== YEAR MANAGEMENT =====

export const createYear = mutation({
  args: {
    year: v.number(),
    description: v.optional(v.string()),
  },
  returns: v.id("years"),
  handler: async (ctx, args) => {
    // Check if year already exists
    const existingYear = await ctx.db
      .query("years")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .unique();
    
    if (existingYear) {
      throw new Error(`Year ${args.year} already exists`);
    }

    return await ctx.db.insert("years", {
      year: args.year,
      description: args.description,
    });
  },
});

export const getYears = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("years"),
      _creationTime: v.number(),
      year: v.number(),
      description: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db
      .query("years")
      .withIndex("by_year")
      .order("desc")
      .collect();
  },
});

export const getYear = query({
  args: { yearId: v.id("years") },
  returns: v.union(
    v.object({
      _id: v.id("years"),
      _creationTime: v.number(),
      year: v.number(),
      description: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.yearId);
  },
});

// ===== MANUFACTURER MANAGEMENT =====

export const createManufacturer = mutation({
  args: {
    yearId: v.id("years"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("manufacturers"),
  handler: async (ctx, args) => {
    // Verify year exists
    const year = await ctx.db.get(args.yearId);
    if (!year) {
      throw new Error("Year not found");
    }

    return await ctx.db.insert("manufacturers", {
      yearId: args.yearId,
      name: args.name,
      description: args.description,
    });
  },
});

export const getManufacturersByYear = query({
  args: { yearId: v.id("years") },
  returns: v.array(
    v.object({
      _id: v.id("manufacturers"),
      _creationTime: v.number(),
      yearId: v.id("years"),
      name: v.string(),
      description: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("manufacturers")
      .withIndex("by_year", (q) => q.eq("yearId", args.yearId))
      .order("asc")
      .collect();
  },
});

export const getManufacturer = query({
  args: { manufacturerId: v.id("manufacturers") },
  returns: v.union(
    v.object({
      _id: v.id("manufacturers"),
      _creationTime: v.number(),
      yearId: v.id("years"),
      name: v.string(),
      description: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.manufacturerId);
  },
});

// ===== SET MANAGEMENT =====

export const createSet = mutation({
  args: {
    manufacturerId: v.id("manufacturers"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("sets"),
  handler: async (ctx, args) => {
    // Verify manufacturer exists
    const manufacturer = await ctx.db.get(args.manufacturerId);
    if (!manufacturer) {
      throw new Error("Manufacturer not found");
    }

    return await ctx.db.insert("sets", {
      manufacturerId: args.manufacturerId,
      name: args.name,
      description: args.description,
    });
  },
});

export const getSetsByManufacturer = query({
  args: { manufacturerId: v.id("manufacturers") },
  returns: v.array(
    v.object({
      _id: v.id("sets"),
      _creationTime: v.number(),
      manufacturerId: v.id("manufacturers"),
      name: v.string(),
      description: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sets")
      .withIndex("by_manufacturer", (q) => q.eq("manufacturerId", args.manufacturerId))
      .order("asc")
      .collect();
  },
});

export const getSet = query({
  args: { setId: v.id("sets") },
  returns: v.union(
    v.object({
      _id: v.id("sets"),
      _creationTime: v.number(),
      manufacturerId: v.id("manufacturers"),
      name: v.string(),
      description: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.setId);
  },
});

// ===== SET VARIANT MANAGEMENT =====

export const createSetVariant = mutation({
  args: {
    setId: v.id("sets"),
    name: v.string(),
    description: v.optional(v.string()),
    variantType: v.union(
      v.literal("base"),
      v.literal("parallel"),
      v.literal("insert"),
      v.literal("parallel_of_insert")
    ),
    parentVariantId: v.optional(v.id("setVariants")),
    parallelName: v.optional(v.string()),
    insertName: v.optional(v.string()),
  },
  returns: v.id("setVariants"),
  handler: async (ctx, args) => {
    // Verify set exists
    const set = await ctx.db.get(args.setId);
    if (!set) {
      throw new Error("Set not found");
    }

    // Validate variant type specific fields
    if (args.variantType === "parallel" && !args.parallelName) {
      throw new Error("Parallel name is required for parallel variants");
    }
    if (args.variantType === "insert" && !args.insertName) {
      throw new Error("Insert name is required for insert variants");
    }
    if (args.variantType === "parallel_of_insert" && (!args.parentVariantId || !args.parallelName)) {
      throw new Error("Parent variant ID and parallel name are required for parallel of insert variants");
    }

    return await ctx.db.insert("setVariants", {
      setId: args.setId,
      name: args.name,
      description: args.description,
      variantType: args.variantType,
      parentVariantId: args.parentVariantId,
      parallelName: args.parallelName,
      insertName: args.insertName,
    });
  },
});

export const getSetVariantsBySet = query({
  args: { setId: v.id("sets") },
  returns: v.array(
    v.object({
      _id: v.id("setVariants"),
      _creationTime: v.number(),
      setId: v.id("sets"),
      name: v.string(),
      description: v.optional(v.string()),
      variantType: v.union(
        v.literal("base"),
        v.literal("parallel"),
        v.literal("insert"),
        v.literal("parallel_of_insert")
      ),
      parentVariantId: v.optional(v.id("setVariants")),
      parallelName: v.optional(v.string()),
      insertName: v.optional(v.string()),
      cardCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const variants = await ctx.db
      .query("setVariants")
      .withIndex("by_set", (q) => q.eq("setId", args.setId))
      .order("asc")
      .collect();

    const variantsWithCardCount = await Promise.all(
      variants.map(async (variant) => {
        const cardCount = await ctx.db
          .query("cards")
          .withIndex("by_set_variant", (q) => q.eq("setVariantId", variant._id))
          .collect()
          .then(cards => cards.length);

        return {
          ...variant,
          cardCount,
        };
      })
    );

    return variantsWithCardCount;
  },
});

export const getSetVariant = query({
  args: { variantId: v.id("setVariants") },
  returns: v.union(
    v.object({
      _id: v.id("setVariants"),
      _creationTime: v.number(),
      setId: v.id("sets"),
      name: v.string(),
      description: v.optional(v.string()),
      variantType: v.union(
        v.literal("base"),
        v.literal("parallel"),
        v.literal("insert"),
        v.literal("parallel_of_insert")
      ),
      parentVariantId: v.optional(v.id("setVariants")),
      parallelName: v.optional(v.string()),
      insertName: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.variantId);
  },
});

// ===== CARD MANAGEMENT =====

export const createCard = mutation({
  args: {
    setVariantId: v.id("setVariants"),
    cardNumber: v.string(),
    playerName: v.optional(v.string()),
    team: v.optional(v.string()),
    position: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  returns: v.id("cards"),
  handler: async (ctx, args) => {
    // Verify set variant exists
    const setVariant = await ctx.db.get(args.setVariantId);
    if (!setVariant) {
      throw new Error("Set variant not found");
    }

    return await ctx.db.insert("cards", {
      setVariantId: args.setVariantId,
      cardNumber: args.cardNumber,
      playerName: args.playerName,
      team: args.team,
      position: args.position,
      description: args.description,
      imageUrl: args.imageUrl,
    });
  },
});

export const getCardsBySetVariant = query({
  args: { setVariantId: v.id("setVariants") },
  returns: v.array(
    v.object({
      _id: v.id("cards"),
      _creationTime: v.number(),
      setVariantId: v.id("setVariants"),
      cardNumber: v.string(),
      playerName: v.optional(v.string()),
      team: v.optional(v.string()),
      position: v.optional(v.string()),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cards")
      .withIndex("by_set_variant", (q) => q.eq("setVariantId", args.setVariantId))
      .order("asc")
      .collect();
  },
});

export const getCard = query({
  args: { cardId: v.id("cards") },
  returns: v.union(
    v.object({
      _id: v.id("cards"),
      _creationTime: v.number(),
      setVariantId: v.id("setVariants"),
      cardNumber: v.string(),
      playerName: v.optional(v.string()),
      team: v.optional(v.string()),
      position: v.optional(v.string()),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.cardId);
  },
});

// ===== HIERARCHICAL QUERIES =====

export const getFullHierarchy = query({
  args: { yearId: v.id("years") },
  returns: v.object({
    year: v.object({
      _id: v.id("years"),
      _creationTime: v.number(),
      year: v.number(),
      description: v.optional(v.string()),
    }),
    manufacturers: v.array(
      v.object({
        _id: v.id("manufacturers"),
        _creationTime: v.number(),
        yearId: v.id("years"),
        name: v.string(),
        description: v.optional(v.string()),
        sets: v.array(
          v.object({
            _id: v.id("sets"),
            _creationTime: v.number(),
            manufacturerId: v.id("manufacturers"),
            name: v.string(),
            description: v.optional(v.string()),
            variants: v.array(
              v.object({
                _id: v.id("setVariants"),
                _creationTime: v.number(),
                setId: v.id("sets"),
                name: v.string(),
                description: v.optional(v.string()),
                variantType: v.union(
                  v.literal("base"),
                  v.literal("parallel"),
                  v.literal("insert"),
                  v.literal("parallel_of_insert")
                ),
                parentVariantId: v.optional(v.id("setVariants")),
                parallelName: v.optional(v.string()),
                insertName: v.optional(v.string()),
                cardCount: v.number(),
              })
            ),
          })
        ),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const year = await ctx.db.get(args.yearId);
    if (!year) {
      throw new Error("Year not found");
    }

    const manufacturers = await ctx.db
      .query("manufacturers")
      .withIndex("by_year", (q) => q.eq("yearId", args.yearId))
      .order("asc")
      .collect();

    const manufacturersWithSets = await Promise.all(
      manufacturers.map(async (manufacturer) => {
        const sets = await ctx.db
          .query("sets")
          .withIndex("by_manufacturer", (q) => q.eq("manufacturerId", manufacturer._id))
          .order("asc")
          .collect();

        const setsWithVariants = await Promise.all(
          sets.map(async (set) => {
            const variants = await ctx.db
              .query("setVariants")
              .withIndex("by_set", (q) => q.eq("setId", set._id))
              .order("asc")
              .collect();

            const variantsWithCardCount = await Promise.all(
              variants.map(async (variant) => {
                const cardCount = await ctx.db
                  .query("cards")
                  .withIndex("by_set_variant", (q) => q.eq("setVariantId", variant._id))
                  .collect()
                  .then(cards => cards.length);

                return {
                  ...variant,
                  cardCount,
                };
              })
            );

            return {
              ...set,
              variants: variantsWithCardCount,
            };
          })
        );

        return {
          ...manufacturer,
          sets: setsWithVariants,
        };
      })
    );

    return {
      year,
      manufacturers: manufacturersWithSets,
    };
  },
});

export const searchCardSets = query({
  args: {
    searchTerm: v.string(),
    variantType: v.optional(v.union(
      v.literal("base"),
      v.literal("parallel"),
      v.literal("insert"),
      v.literal("parallel_of_insert")
    )),
  },
  returns: v.array(
    v.object({
      _id: v.id("setVariants"),
      _creationTime: v.number(),
      setId: v.id("sets"),
      name: v.string(),
      description: v.optional(v.string()),
      variantType: v.union(
        v.literal("base"),
        v.literal("parallel"),
        v.literal("insert"),
        v.literal("parallel_of_insert")
      ),
      parentVariantId: v.optional(v.id("setVariants")),
      parallelName: v.optional(v.string()),
      insertName: v.optional(v.string()),
      set: v.object({
        _id: v.id("sets"),
        name: v.string(),
        manufacturerId: v.id("manufacturers"),
      }),
      manufacturer: v.object({
        _id: v.id("manufacturers"),
        name: v.string(),
        yearId: v.id("years"),
      }),
      year: v.object({
        _id: v.id("years"),
        year: v.number(),
      }),
    })
  ),
  handler: async (ctx, args) => {
    // Get all set variants and filter by search term and variant type
    const allVariants = await ctx.db.query("setVariants").collect();
    
    const filteredVariants = allVariants.filter(variant => {
      const matchesSearch = 
        variant.name.toLowerCase().includes(args.searchTerm.toLowerCase()) ||
        (variant.parallelName && variant.parallelName.toLowerCase().includes(args.searchTerm.toLowerCase())) ||
        (variant.insertName && variant.insertName.toLowerCase().includes(args.searchTerm.toLowerCase()));
      
      const matchesType = !args.variantType || variant.variantType === args.variantType;
      
      return matchesSearch && matchesType;
    });

    // Get set, manufacturer and year info for each variant
    const variantsWithHierarchy = await Promise.all(
      filteredVariants.map(async (variant) => {
        const set = await ctx.db.get(variant.setId);
        if (!set) throw new Error("Set not found");
        
        const manufacturer = await ctx.db.get(set.manufacturerId);
        if (!manufacturer) throw new Error("Manufacturer not found");
        
        const year = await ctx.db.get(manufacturer.yearId);
        if (!year) throw new Error("Year not found");

        return {
          ...variant,
          set: {
            _id: set._id,
            name: set.name,
            manufacturerId: set.manufacturerId,
          },
          manufacturer: {
            _id: manufacturer._id,
            name: manufacturer.name,
            yearId: manufacturer.yearId,
          },
          year: {
            _id: year._id,
            year: year.year,
          },
        };
      })
    );

    return variantsWithHierarchy;
  },
});
