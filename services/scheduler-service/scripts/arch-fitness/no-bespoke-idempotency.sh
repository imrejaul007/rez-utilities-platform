#!/usr/bin/env bash
##
## Architecture Fitness Test: no-bespoke-idempotency.sh
## Fails CI if any service defines idempotencyKey without importing from rez-shared/idempotency.
##
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[arch-fitness] Checking for bespoke idempotency definitions..."

# Find files with idempotencyKey that don't import from rez-shared
VIOLATIONS=""
while IFS= read -r file; do
  # Check if file contains idempotencyKey
  if grep -q "idempotencyKey" "$file"; then
    # Check if it imports from rez-shared/idempotency
    if ! grep -q "from ['\"].*rez-shared.*idempotency" "$file"; then
      VIOLATIONS+="$file"$'\n'
    fi
  fi
done < <(find "$REPO_ROOT" \
  -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" 2>/dev/null)

if [ -n "$VIOLATIONS" ]; then
  echo "[arch-fitness] FAIL: Found bespoke idempotencyKey without rez-shared import:"
  echo "$VIOLATIONS" | sed 's/^/  /'
  echo ""
  echo "Fix: Import idempotencyKey from rez-shared/idempotency"
  exit 1
fi

echo "[arch-fitness] PASS: All idempotencyKey imports verified"
exit 0
