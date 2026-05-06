#!/usr/bin/env bash
##
## Architecture Fitness Test: no-bespoke-buttons.sh
## Fails CI if any client app imports a local Button.tsx instead of @rez/rez-ui Button.
## Allowlist: packages/rez-ui itself is exempt.
##
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ALLOW_LIST="packages/rez-ui|node_modules"

echo "[arch-fitness] Checking for bespoke Button imports..."

# Search for any import/require of ./Button or ../Button in TypeScript/TSX files,
# excluding the rez-ui package itself and node_modules.
VIOLATIONS=$(find "$REPO_ROOT" \
  -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/$ALLOW_LIST/*" \
  -exec grep -l "from ['\"]\..*Button\|from ['\"]\.\..*Button" {} \; 2>/dev/null || true)

if [ -n "$VIOLATIONS" ]; then
  echo "[arch-fitness] FAIL: Found bespoke Button imports:"
  echo "$VIOLATIONS" | sed 's/^/  /'
  echo ""
  echo "Fix: Import Button from @rez/rez-ui instead"
  exit 1
fi

echo "[arch-fitness] PASS: No bespoke Button imports found"
exit 0
