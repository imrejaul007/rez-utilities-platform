#!/bin/bash
# AF-8: centralized-api-client.sh — warn about direct fetch usage
# All API calls should go through the centralized apiClient from rez-shared

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "AF-8: Checking for direct fetch usage (review for apiClient usage)..."

VIOLATIONS=0

# Find direct fetch() calls not going through apiClient
FOUND=$(find . \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v "\.test\." | \
  grep -v "\.spec\." | \
  xargs grep -n "fetch(" 2>/dev/null | \
  grep -v "apiClient\|api-client\|axios\|got\|node-fetch" | \
  grep -v "eslint-disable" | \
  grep -v "// noinspection" | \
  head -20 || true)

if [ -n "$FOUND" ]; then
  echo "WARN: Direct fetch() found (verify apiClient usage):"
  echo "$FOUND"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo "Use the centralized apiClient from rez-shared/src/api-client"
  echo "for consistent auth headers, error handling, and retry logic"
  exit 1
fi

echo "PASS: No direct fetch usage detected"
exit 0
