#!/bin/bash
# AF-6: no-bespoke-status.sh — fail if hardcoded order status strings are used
# Order statuses must come from canonical enum in shared-types

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "AF-6: Checking for hardcoded order status strings..."

VIOLATIONS=0

# Find files with status strings, then check if they import from shared
STATUS_FILES=$(find . \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | \
  grep -v "node_modules" | \
  xargs grep -l "'placed'\|'completed'\|'delivered'\|'out_for_delivery'\|'pending'\|'cancelled'" 2>/dev/null | \
  grep -v "\.test\." | \
  grep -v "\.spec\." | \
  grep -v "__tests__" | \
  head -30 || true)

for f in $STATUS_FILES; do
  # Check if file imports status from shared-types or enums
  IMPORTS_CANONICAL=$(grep -n "import.*from.*shared.*status\|import.*OrderStatus\|import.*Status.*from.*enums" "$f" 2>/dev/null || true)
  if [ -z "$IMPORTS_CANONICAL" ]; then
    VIOLATIONS=$((VIOLATIONS + 1))
    echo "FAIL: $f has hardcoded status strings but no canonical import"
    grep -n "'placed'\|'completed'\|'delivered'\|'out_for_delivery'\|'pending'\|'cancelled'" "$f" 2>/dev/null | head -3
    echo ""
  fi
done

if [ $VIOLATIONS -gt 0 ]; then
  echo "Found $VIOLATIONS file(s) with hardcoded status strings"
  echo "Use canonical status from packages/shared-types/src/enums/"
  exit 1
fi

echo "PASS: No bespoke status strings found"
exit 0
