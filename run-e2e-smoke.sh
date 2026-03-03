#!/bin/bash
# Runs E2E flows sequentially to avoid Clerk concurrent sign-in throttling.
# Each flow signs in independently; parallel execution triggers "Too many requests".
# Flows are discovered dynamically from .maestro/flows/ based on an optional tag filter.
#
# Usage:
#   ./run-e2e-smoke.sh           # run all flows
#   ./run-e2e-smoke.sh smoke     # run only flows tagged "smoke"

set -e

MAESTRO="$HOME/.maestro/bin/maestro"
CONFIG=".maestro/config.yaml"
APP_URL="${APP_URL:-http://localhost:3000}"
# --platform web required so launchApp navigates to each flow's url: (config cannot set platform)
ARGS=(--platform web --config "$CONFIG" -e "APP_URL=$APP_URL")
TAG="${1:-}"

# Discover flows: filter by tag if provided, otherwise find all yaml files.
SMOKE_FLOWS=()
if [ -n "$TAG" ]; then
  while IFS= read -r f; do
    SMOKE_FLOWS+=("$f")
  done < <(grep -rl "$TAG" .maestro/flows/ --include="*.yaml" | sort)
else
  while IFS= read -r f; do
    SMOKE_FLOWS+=("$f")
  done < <(find .maestro/flows/ -name "*.yaml" | sort)
fi

if [ ${#SMOKE_FLOWS[@]} -eq 0 ]; then
  echo "No flows found${TAG:+ tagged \"$TAG\"} in .maestro/flows/"
  exit 0
fi

echo "Found ${#SMOKE_FLOWS[@]} flow(s)${TAG:+ tagged \"$TAG\"}:"
for f in "${SMOKE_FLOWS[@]}"; do echo "  $f"; done
echo ""

PASSED=0
FAILED=0
FAILURES=()

for flow in "${SMOKE_FLOWS[@]}"; do
  echo "▶ Running: $flow"
  echo "$MAESTRO" test "${ARGS[@]}" "$flow"
  if "$MAESTRO" test "${ARGS[@]}" "$flow"; then
    echo "✅ Passed: $flow"
    ((PASSED++))
  else
    echo "❌ Failed: $flow"
    ((FAILED++))
    FAILURES+=("$flow")
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASSED passed, $FAILED failed"
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "  Failed flows:"
  for f in "${FAILURES[@]}"; do echo "    - $f"; done
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
