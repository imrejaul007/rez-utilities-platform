#!/usr/bin/env bash
##
## Architecture Fitness Test: no-console-log.sh
## Fails CI if any console.log|error|warn|info appears outside packages/rez-shared/telemetry/.
## Enforce using the centralized logger.
##
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TELEMETRY_PATH="packages/rez-shared/telemetry"

echo "[arch-fitness] Checking for unauthorized console calls..."

# Search for console.log, console.error, console.warn, console.info in all files,
# excluding the telemetry package itself and node_modules, dist.
VIOLATIONS=$(find "$REPO_ROOT" \
  -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/$TELEMETRY_PATH/*" \
  -exec grep -n "console\.\(log\|error\|warn\|info\)" {} + 2>/dev/null || true)

if [ -n "$VIOLATIONS" ]; then
  echo "[arch-fitness] FAIL: Found unauthorized console calls:"
  echo "$VIOLATIONS" | sed 's/^/  /'
  echo ""
  echo "Fix: Use logger from rez-shared/telemetry instead"
  exit 1
fi

echo "[arch-fitness] PASS: No unauthorized console calls found"
exit 0
