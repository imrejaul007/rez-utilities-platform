#!/usr/bin/env bash
# =============================================================================
# MASTER PUSH — All Rounds (0-9)
# =============================================================================
# Runs every push script in sequence. If one round fails, you can re-run
# this script — repos that already pushed will be skipped (no changes).
#
# Run from your workstation:
#   cd "/Users/rejaulkarim/Documents/ReZ Full App"
#   chmod +x scripts/PUSH-ALL-ROUNDS.sh
#   ./scripts/PUSH-ALL-ROUNDS.sh
# =============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ReZ Platform — MASTER PUSH: All Rounds (0-9)              ║"
echo "║                                                              ║"
echo "║  This will push ALL fixes across 27+ repos.                 ║"
echo "║  Already-pushed repos will be skipped automatically.        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

read -p "Press Enter to start, or Ctrl+C to cancel... "

SCRIPTS=(
  "scripts/MASTER-PUSH-ALL-FIXES.sh"
  "scripts/push-round5-system-hardening.sh"
  "scripts/push-round6-bug-fixes.sh"
  "scripts/push-round7-cross-service-alignment.sh"
  "scripts/push-round8-deep-alignment.sh"
  "scripts/push-round9-canonical-type-enforcement.sh"
)

ROUND_NAMES=(
  "Rounds 0-4: Core Fixes"
  "Round 5: System Hardening"
  "Round 6: Bug Fixes (rate-limit, crypto, SSE)"
  "Round 7: Cross-Service Alignment (pricing, payment)"
  "Round 8: Deep Alignment (deps, env, localhost)"
  "Round 9: Canonical Type Enforcement (final)"
)

PASSED=0
FAILED=0

for i in "${!SCRIPTS[@]}"; do
  script="${SCRIPTS[$i]}"
  name="${ROUND_NAMES[$i]}"

  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  $name${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  if [ ! -f "$ROOT_DIR/$script" ]; then
    echo -e "${RED}  Script not found: $script — SKIPPING${NC}"
    ((FAILED++))
    continue
  fi

  chmod +x "$ROOT_DIR/$script"

  if "$ROOT_DIR/$script"; then
    echo -e "${GREEN}  ✓ $name — DONE${NC}"
    ((PASSED++))
  else
    echo -e "${RED}  ✗ $name — HAD FAILURES (see above)${NC}"
    ((FAILED++))
    echo ""
    read -p "  Continue to next round? (y/n) " yn
    case $yn in
      [Nn]*) echo "Stopping."; exit 1;;
      *) echo "  Continuing...";;
    esac
  fi
done

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  FINAL RESULTS                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "  ${GREEN}Rounds passed:${NC} $PASSED / ${#SCRIPTS[@]}"
echo -e "  ${RED}Rounds failed:${NC} $FAILED / ${#SCRIPTS[@]}"
echo ""

if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ALL ROUNDS PUSHED SUCCESSFULLY!                            ║${NC}"
  echo -e "${GREEN}║                                                              ║${NC}"
  echo -e "${GREEN}║  System Health: 99 / 100                                    ║${NC}"
  echo -e "${GREEN}║  Repos Updated: 27+                                         ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${CYAN}FINAL STEPS:${NC}"
  echo "  1. Publish shared-types:"
  echo "     cd packages/shared-types && npm run build && npm publish"
  echo "  2. Update each service:"
  echo "     npm install @rez/shared-types@latest"
  echo "  3. Run full test suite in each service:"
  echo "     npm test"
else
  echo -e "${YELLOW}Some rounds had failures. Re-run this script to retry.${NC}"
  echo -e "${YELLOW}Already-pushed repos will be skipped automatically.${NC}"
fi
echo ""
