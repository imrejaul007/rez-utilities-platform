#!/usr/bin/env bash
##
## Architecture Fitness Test: no-bespoke-enums.sh
## Fails CI if any enum duplicates a name in rez-shared/enums/.
##
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SHARED_ENUMS_PATH="rez-shared/enums"

echo "[arch-fitness] Checking for enum duplication..."

# Extract all enum names from rez-shared/enums
SHARED_ENUM_NAMES=$(find "$REPO_ROOT/$SHARED_ENUMS_PATH" \
  -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec grep -ho "export enum [A-Za-z_][A-Za-z0-9_]*" {} \; 2>/dev/null | sed 's/export enum //' | sort -u)

if [ -z "$SHARED_ENUM_NAMES" ]; then
  echo "[arch-fitness] No shared enums found, skipping check"
  exit 0
fi

echo "[arch-fitness] Found shared enums: $(echo $SHARED_ENUM_NAMES | tr '\n' ' ')"

# Search for duplicate enum definitions outside rez-shared/enums
VIOLATIONS=""
for enum_name in $SHARED_ENUM_NAMES; do
  # Find all enum definitions with this name outside shared enums
  DUPLICATES=$(find "$REPO_ROOT" \
    -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "*/$SHARED_ENUMS_PATH/*" \
    ! -path "*/node_modules/*" \
    ! -path "*/dist/*" \
    -exec grep -l "export enum $enum_name" {} \; 2>/dev/null || true)

  if [ -n "$DUPLICATES" ]; then
    VIOLATIONS+="Enum '$enum_name' duplicated in:"$'\n'"$DUPLICATES"$'\n'
  fi
done

if [ -n "$VIOLATIONS" ]; then
  echo "[arch-fitness] FAIL: Found duplicate enum definitions:"
  echo "$VIOLATIONS" | sed 's/^/  /'
  echo ""
  echo "Fix: Use enums from rez-shared/enums instead of defining duplicates"
  exit 1
fi

echo "[arch-fitness] PASS: No duplicate enum definitions found"
exit 0
