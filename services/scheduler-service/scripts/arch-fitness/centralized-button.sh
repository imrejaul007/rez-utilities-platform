#!/bin/bash
# AF-7: centralized-button.sh — fail if Button component is defined outside @rez/rez-ui
# All Button components must come from the shared @rez/rez-ui package

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "AF-7: Checking for bespoke Button implementations..."

# Find files that export a Button component outside shared locations
FOUND=$(find . -name "*.tsx" 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v "rez-ui" | \
  grep -v "shared-types" | \
  xargs grep -l "export.*Button\|export { Button" 2>/dev/null | head -20 || true)

if [ -n "$FOUND" ]; then
  echo "FAIL: Custom Button exports found outside @rez/rez-ui:"
  echo "$FOUND" | sort -u
  echo ""
  echo "Use Button from @rez/rez-ui instead of bespoke implementations"
  exit 1
fi

echo "PASS: No bespoke Button components found"
exit 0
