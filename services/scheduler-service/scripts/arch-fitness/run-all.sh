#!/bin/bash
# run-all.sh — runs all architecture fitness tests in sequence
# Returns exit code 1 if any test fails, 0 if all pass

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "============================================"
echo " Architecture Fitness Tests — Full Run"
echo "============================================"
echo ""

PASS=0
FAIL=0
SKIP=0

for test in "$SCRIPT_DIR"/no-*.sh; do
  if [ -f "$test" ]; then
    name=$(basename "$test" .sh)

    # Skip install-hooks.sh in the run-all sequence
    if [ "$name" = "install-hooks" ]; then
      SKIP=$((SKIP + 1))
      continue
    fi

    echo "--- Running: $name ---"
    if bash "$test"; then
      PASS=$((PASS + 1))
    else
      FAIL=$((FAIL + 1))
    fi
    echo ""
  fi
done

echo "============================================"
echo " Results: $PASS passed, $FAIL failed, $SKIP skipped"
echo "============================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi

exit 0
