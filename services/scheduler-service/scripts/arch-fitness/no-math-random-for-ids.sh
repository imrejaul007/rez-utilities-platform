#!/usr/bin/env bash
##
## Architecture Fitness Test: no-math-random-for-ids.sh
## Fails CI if Math.random() is used for any variable whose name contains "id" or "key" or "token".
##
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[arch-fitness] Checking for Math.random() used for IDs/keys/tokens..."

# This is a heuristic: look for patterns like:
#   const xxxId = Math.random()
#   let xxxKey = Math.random()
#   var xxxToken = Math.random()
# We'll search for these patterns and report violations.

VIOLATIONS=$(find "$REPO_ROOT" \
  -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  -exec grep -n "\(const\|let\|var\) [a-zA-Z_][a-zA-Z0-9_]*\(Id\|id\|Key\|key\|Token\|token\)[a-zA-Z0-9_]* *=.*Math\.random" {} + 2>/dev/null || true)

if [ -n "$VIOLATIONS" ]; then
  echo "[arch-fitness] FAIL: Found Math.random() used for ID/key/token generation:"
  echo "$VIOLATIONS" | sed 's/^/  /'
  echo ""
  echo "Fix: Use uuid, crypto.randomUUID(), or a proper ID generation library"
  exit 1
fi

echo "[arch-fitness] PASS: No Math.random() for ID/key/token generation found"
exit 0
