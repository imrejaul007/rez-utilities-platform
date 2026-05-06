#!/usr/bin/env bash
# =============================================================================
# PUSH SCRIPT — Deep Verification Bug Fixes 2026-04-16 (Round 3)
# =============================================================================
# 16 real bugs fixed, 13 misjudgments identified across 10 repos
#
# Run from your workstation:
#   cd "/Users/rejaulkarim/Documents/ReZ Full App"
#   chmod +x scripts/push-deep-verification-fixes.sh
#   ./scripts/push-deep-verification-fixes.sh
# =============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
SUCCESS=0
FAIL=0

log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!!]${NC} $1"; }
err()  { echo -e "${RED}[XX]${NC} $1"; }

commit_and_push() {
  local dir="$1"
  local branch="$2"
  local msg="$3"

  echo ""
  echo "------------------------------------------------------------"
  echo "  Processing: $dir ($branch)"
  echo "------------------------------------------------------------"

  if [ ! -d "$ROOT_DIR/$dir" ]; then
    err "Directory not found: $dir"
    ((FAIL++))
    return
  fi

  cd "$ROOT_DIR/$dir"

  if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    log "No changes: $dir"
    cd "$ROOT_DIR"
    return
  fi

  git add -A

  git commit -m "$(cat <<EOF
$msg

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
  )" || { warn "Nothing to commit in $dir"; cd "$ROOT_DIR"; return; }

  if git push origin "$branch" 2>&1; then
    log "Pushed $dir"
    ((SUCCESS++))
  else
    err "Push failed: $dir"
    ((FAIL++))
  fi

  cd "$ROOT_DIR"
}

echo ""
echo "========================================================"
echo "  ReZ Deep Verification Fixes — 2026-04-16 (Round 3)"
echo "  29 bugs investigated, 16 real fixes, 13 misjudgments"
echo "========================================================"

# ── Auth Service Fixes (BUG-1, BUG-2, BUG-25)
commit_and_push "rez-auth-service" "main" \
  "fix: correct isVerified hardcode, restore profile fields, remove type escape hatch

BUG-1 (BREAKING): buildUserResponse() hardcoded isVerified:true — now
uses actual user.auth.isVerified value with false default.

BUG-2 (HIGH): Profile fields (bio, website, location, timezone) were
stripped by buildUserResponse() — now spreads all profile fields.

BUG-25 (HIGH): AuthServiceUser interface had [key:string]:any escape
hatch defeating type safety — removed."

# ── Consumer App Fixes (BUG-3, BUG-4, BUG-6, BUG-26)
commit_and_push "rez-app-consumer" "main" \
  "fix: complete role/gender enums, fix coin priority, remove stale wallet types

BUG-3 (HIGH): User role type only had 3 of 7 backend roles — added
support, operator, super_admin, consumer.

BUG-4 (HIGH): Gender enum missing prefer_not_to_say — added.

BUG-6 (BREAKING): COIN_USAGE_ORDER had 4 types, backend has 6 — added
cashback and referral in correct priority position.

BUG-26 (CRITICAL): User interface still declared removed wallet sub-doc
from DM-L4 migration — removed stale wallet types."

# ── Wallet Service Fix (BUG-7)
commit_and_push "rez-wallet-service" "main" \
  "fix: add status field to CoinTransaction model (BUG-7)

CoinTransaction model had no status field but consumer app expects
status: completed|pending|failed. Added status field with enum
validation and default 'completed' for backward compatibility."

# ── Order Service Fixes (BUG-9, BUG-10, BUG-11)
commit_and_push "rez-order-service" "main" \
  "fix: add status enum types to Order and payment sub-doc (BUG-9, BUG-10, BUG-11)

BUG-9 (CRITICAL): Order.status was plain string with no validation —
added TypeScript union type with 11 canonical statuses.

BUG-10 (HIGH): Order.payment.status only tracked 8 of 11 Payment
service states — added all 10 payment states including refund lifecycle.

BUG-11 (MEDIUM): Added optional currency field for future multi-currency."

# ── Catalog Service Fix (BUG-12)
commit_and_push "rez-catalog-service" "main" \
  "fix: replace [key:string]:any with proper IProduct interface (BUG-12)

Replaced overly permissive index signature with explicitly typed
interface reflecting actual product fields (name, description, price,
images, ratings, etc). Preserves strict:false for MongoDB compat."

# ── Marketing Service Fix (BUG-15)
commit_and_push "rez-marketing-service" "main" \
  "fix: add in_app to campaign channel validation (BUG-15)

Route validation rejected channel=in_app despite model supporting it.
Added 'in_app' to validChannels array in campaign routes."

# ── Notification Events Fix (BUG-16)
commit_and_push "rez-notification-events" "main" \
  "fix: add email resolution fallback in notification worker (BUG-16)

Generic event schema skips email validation but worker requires it.
Added 3-step email resolution: payload.data.email -> payload.to ->
MongoDB User lookup by userId. Prevents silent delivery failures."

# ── Finance Service Fix (BUG-18)
commit_and_push "rez-finance-service" "main" \
  "fix: remove dual-value status enum, canonicalize to completed (BUG-18)

FinanceTxStatus allowed both 'success' and 'completed' causing query
inconsistency. Removed 'success' from enum, kept pre-save hook as
safety net for legacy data normalization."

# ── Backend Monolith Fixes (BUG-22, BUG-24)
commit_and_push "rezbackend/rez-backend-master" "main" \
  "fix: remove stale wallet.coins index, improve email notification logging (BUG-22, BUG-24)

BUG-22 (HIGH): Removed stale index on wallet.coins — sub-doc was
removed in DM-L4, wallet data now in rez-wallet-service.

BUG-24 (MEDIUM): Enhanced email notification job with explicit user
lookup failure check and structured warning logs for null email."

# ── Merchant Service (no changes — BUG-19, BUG-20 were misjudgments)

# ── Root push (scripts + docs)
cd "$ROOT_DIR"
git add scripts/push-deep-verification-fixes.sh docs/DEEP-DATA-MODEL-VERIFICATION-REPORT.docx 2>/dev/null || true
git commit -m "$(cat <<'EOF'
scripts+docs: add deep verification fixes push script and report

Push script for 16 bug fixes across 9 repos from 10-phase deep
data model verification. Also includes the DOCX verification report.

29 bugs investigated: 16 real (fixed), 13 misjudgments (documented).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" && git push origin main 2>&1 && log "Pushed root" && ((SUCCESS++)) || { err "Push failed: root"; ((FAIL++)); }

echo ""
echo "========================================================"
echo "  RESULTS"
echo "========================================================"
echo -e "  ${GREEN}Pushed:${NC} $SUCCESS repos"
echo -e "  ${RED}Failed:${NC} $FAIL repos"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${YELLOW}Some pushes failed. Check errors above and retry manually.${NC}"
  exit 1
else
  echo -e "${GREEN}All deep verification fixes pushed successfully!${NC}"
fi
