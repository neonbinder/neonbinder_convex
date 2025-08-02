// Test file to demonstrate the buildSetParameters functionality with BSC API
import { BuySportsCardsAdapter } from "./buysportscards";

// Test the buildSetParameters function
async function testBuildSetParameters() {
  console.log("Testing BSC buildSetParameters functionality...\n");

  // Create adapter instance
  const bscAdapter = new BuySportsCardsAdapter();

  try {
    // Test 1: Minimal parameters - just sport and year
    console.log("Test 1: Minimal parameters (sport and year)");
    const minimalParams = await bscAdapter.buildSetParameters({
      sport: "baseball",
      year: 2023
    });
    console.log("Result:", minimalParams);
    console.log();

    // Test 2: With manufacturer added
    console.log("Test 2: Adding manufacturer");
    const withManufacturer = await bscAdapter.buildSetParameters({
      sport: "baseball",
      year: 2023,
      manufacturer: "Topps"
    });
    console.log("Result:", withManufacturer);
    console.log();

    // Test 3: With set name
    console.log("Test 3: Adding set name");
    const withSetName = await bscAdapter.buildSetParameters({
      sport: "baseball",
      year: 2023,
      manufacturer: "Topps",
      setName: "Chrome"
    });
    console.log("Result:", withSetName);
    console.log();

    // Test 4: With variant type
    console.log("Test 4: Adding variant type");
    const withVariantType = await bscAdapter.buildSetParameters({
      sport: "baseball",
      year: 2023,
      manufacturer: "Topps",
      setName: "Chrome",
      variantType: "base"
    });
    console.log("Result:", withVariantType);
    console.log();

    // Test 5: With insert
    console.log("Test 5: Adding insert");
    const withInsert = await bscAdapter.buildSetParameters({
      sport: "baseball",
      year: 2023,
      manufacturer: "Topps",
      setName: "Chrome",
      variantType: "insert",
      insertName: "Refractors"
    });
    console.log("Result:", withInsert);
    console.log();

    console.log("All tests completed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Export for potential use in other files
export { testBuildSetParameters }; 