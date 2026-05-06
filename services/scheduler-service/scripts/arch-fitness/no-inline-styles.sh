#!/bin/bash
# AF-9: no-inline-styles.sh — warn about JSX inline style usage
# Prefer Tailwind utility classes or CSS modules over style={{}}

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "AF-9: Checking for JSX inline styles..."

FOUND=$(find . -name "*.tsx" 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v "\.test\." | \
  grep -v "\.spec\." | \
  xargs grep -n "style={{" 2>/dev/null | \
  grep -v "eslint-disable" | \
  grep -v "// noinspection" | \
  head -20 || true)

if [ -n "$FOUND" ]; then
  echo "WARN: Inline styles found (prefer Tailwind or CSS modules):"
  echo "$FOUND"
  echo ""
  echo "Use Tailwind classes or CSS modules instead of inline style={{}}"
  exit 1
fi

echo "PASS: No inline styles found"
exit 0
