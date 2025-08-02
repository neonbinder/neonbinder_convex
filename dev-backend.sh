#!/bin/bash

# Check if a URL was provided as the first argument
if [ -n "$1" ]; then
  echo "Setting NEONBINDER_BROWSER_URL to: $1"
  npx convex env set NEONBINDER_BROWSER_URL "$1"
  echo "✅ Environment variable set successfully"
else
  echo "No browser URL provided, skipping environment variable setup"
fi

# Run the Convex dev command
echo "Starting Convex dev server..."
dotenv -e .env.convex -- convex dev 