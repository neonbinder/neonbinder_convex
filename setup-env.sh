#!/bin/bash

# This script runs before dev to sync environment variables with Convex

echo "🔄 Syncing environment variables with Convex..."

# Check if FUSION_ENV_ORIGIN is set and update Convex
if [ -n "$FUSION_ENV_ORIGIN" ]; then
  echo "🔄 Updating Convex with FUSION_ENV_ORIGIN: $FUSION_ENV_ORIGIN"
  npx convex env set FUSION_ENV_ORIGIN "$FUSION_ENV_ORIGIN"
  echo "✅ FUSION_ENV_ORIGIN synced to Convex"
else
  echo "ℹ️  FUSION_ENV_ORIGIN not set, skipping Convex env sync"
fi

# Set SITE_URL based on environment
if [ -n "$FUSION_ENV_ORIGIN" ]; then
  echo "🔄 Setting SITE_URL to VM URL: $FUSION_ENV_ORIGIN"
  npx convex env set SITE_URL "$FUSION_ENV_ORIGIN"
  echo "✅ SITE_URL set to VM URL"
else
  echo "🔄 Setting SITE_URL to localhost for local development"
  npx convex env set SITE_URL "http://localhost:3000"
  echo "✅ SITE_URL set to localhost:3000"
fi

echo "✅ Environment sync complete"

