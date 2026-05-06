#!/bin/bash
# AF-3: no-as-any.sh — fail if 'as any' cast is used without eslint-disable

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "AF-3: Checking for 'as any' casts..."

# Find 'as any' without eslint-disable on the same line
FOUND=$(find . \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | \
  grep -v "node_modules" | \
  xargs grep -n "as any" 2>/dev/null | \
  grep -v "eslint-disable" | \
  grep -v "// noinspection" | \
  grep -v "/\* eslint-disable" || true)

if [ -n "$FOUND" ]; then
  echo "FAIL: Found 'as any' casts without eslint-disable:"
  echo "$FOUND"
  echo ""
  echo "Use a proper typed assertion or @ts-ignore with justification comment"
  exit 1
fi

echo "PASS: No 'as any' casts found"
exit 0
