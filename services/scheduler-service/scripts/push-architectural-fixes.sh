#!/usr/bin/env bash
# =============================================================================
# PUSH SCRIPT — Architectural Fixes 2026-04-16 (Round 4)
# =============================================================================
# Creates @rez/shared-types package, standardizes product pricing/images,
# unifies campaign interfaces, adds Zod validation + strict:true to models,
# aligns all frontend app types with canonical definitions.
#
# Run from your workstation:
#   cd "/Users/rejaulkarim/Documents/ReZ Full App"
#   chmod +x scripts/push-architectural-fixes.sh
#   ./scripts/push-architectural-fixes.sh
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
echo "  ReZ Architectural Fixes — 2026-04-16 (Round 4)"
echo "  @rez/shared-types + Zod + strict:true + type alignment"
echo "========================================================"

# ── @rez/shared-types package (NEW)
commit_and_push "packages/shared-types" "main" \
  "feat: create @rez/shared-types package with 12 entity interfaces + Zod schemas

New package providing canonical TypeScript interfaces for ALL 12 core
entities: User, Order, Payment, Product, Wallet, Campaign, Notification,
Merchant, Offer, Finance, Gamification, Analytics.

Includes:
- 91+ exported types/interfaces across 14 source files
- Zod validation schemas for all API boundaries (8 schema files)
- Unified BaseCampaign interface with Marketing/Ad/Merchant extensions
- Canonical pricing format: pricing.selling + pricing.mrp
- COIN_PRIORITY: promo > branded > prive > cashback > referral > rez
- All 11 order statuses + 11 payment statuses
- All 7 user roles + gender with prefer_not_to_say
- Migration guide (MIGRATION.md) for incremental service adoption
- 30+ shared enums consolidating from deprecated shared-enums"

# ── Order Service (strict:true + Zod validation)
commit_and_push "rez-order-service" "main" \
  "feat: add strict:true + Zod validation to Order model

- Changed Order schema from strict:false to strict:true
- Added explicit field definitions for all 20+ fields
- Created Zod validation schemas (orderSchemas.ts) with 8 schemas
- Added validation middleware to 4 routes
- Added zod dependency
- Defense in depth: Zod at boundary + strict:true at storage"

# ── Catalog Service (strict:true + Zod + canonical pricing)
commit_and_push "rez-catalog-service" "main" \
  "feat: add strict:true + Zod validation + canonical pricing format

- Changed Product schema from strict:false to strict:true
- Standardized pricing to canonical: pricing.selling + pricing.mrp
- Standardized images to canonical: Array<{url, alt?, isPrimary?}>
- Created Zod validation schemas (productSchemas.ts) with 7 schemas
- Added validation middleware to 5 routes
- Added zod dependency"

# ── Consumer App (type alignment + canonical formats)
commit_and_push "rez-app-consumer" "main" \
  "feat: align all types with @rez/shared-types canonical definitions

- Updated product types to canonical pricing.selling/mrp format
- Updated productDataNormalizer to output canonical format
- Added canonical reference comments to all 9 type files
- Enhanced PaymentStatus with all 10 canonical states
- Added OrderPaymentStatus (8 states)
- Verified COIN_USAGE_ORDER (6 types), OrderStatus (11 states)
- All types ready for migration to @rez/shared-types imports"

# ── Merchant App (type alignment + canonical formats)
# Note: The merchant app folder might be 'rez-app-marchant' or 'rezmerchant'
if [ -d "$ROOT_DIR/rezmerchant" ]; then
  commit_and_push "rezmerchant" "main" \
    "feat: align types with @rez/shared-types canonical definitions

- Migrated pricing from price.regular/sale to pricing.mrp/selling
- Updated order types with canonical totals object
- Enhanced payment status enums (8 canonical states)
- Extracted canonical OfferType (6 values) and OfferCategory (11 values)
- Updated API service request bodies to use canonical field names
- Backward compatibility maintained with deprecated legacy fields"
fi

if [ -d "$ROOT_DIR/rez-app-marchant" ]; then
  commit_and_push "rez-app-marchant" "main" \
    "feat: align types with @rez/shared-types canonical definitions

- Migrated pricing from price.regular/sale to pricing.mrp/selling
- Updated order types with canonical totals object
- Enhanced payment status enums (8 canonical states)
- Backward compatibility maintained with deprecated legacy fields"
fi

# ── Marketing Service (campaign reference + channel fix)
commit_and_push "rez-marketing-service" "main" \
  "feat: add @rez/shared-types canonical reference to campaign model

Added canonical type reference comments to MarketingCampaign model.
Campaign status and channel enums verified against shared types."

# ── Ads Service (campaign reference)
commit_and_push "rez-ads-service" "main" \
  "feat: add @rez/shared-types canonical reference to AdCampaign model

Marked as canonical source for ad campaign definitions.
Added shared-types reference for future migration."

# ── Merchant Service (campaign references)
commit_and_push "rez-merchant-service" "main" \
  "feat: add @rez/shared-types references to campaign models

Added canonical references to AdCampaign, CampaignRule,
KarmaCampaign, and Broadcast models. Clarified shared
MongoDB collection between ads-service and merchant-service."

# ── Auth Service (type reference)
commit_and_push "rez-auth-service" "main" \
  "feat: add @rez/shared-types canonical reference to user types

Added reference comment to user.types.ts pointing to
@rez/shared-types/entities/user for future migration."

# ── Payment Service (partially_refunded status + reference)
commit_and_push "rez-payment-service" "main" \
  "feat: add partially_refunded status + @rez/shared-types reference

Added 11th payment status (partially_refunded) with FSM transitions.
Added canonical reference comment to Payment model."

# ── Wallet Service (references)
commit_and_push "rez-wallet-service" "main" \
  "feat: add @rez/shared-types canonical references to models

Added reference comments to CoinTransaction and Wallet models.
Verified 6 coin types and 3 transaction statuses match shared types."

# ── Finance Service (reference)
commit_and_push "rez-finance-service" "main" \
  "feat: add @rez/shared-types canonical reference to FinanceTransaction

Added reference comment. Verified 'success' status removed
and canonical 'completed' is the only success state."

# ── Notification Events (reference)
commit_and_push "rez-notification-events" "main" \
  "feat: add @rez/shared-types canonical reference to event schemas

Added reference comment. Verified 5 channels (including in_app)
and email resolution fallback are present."

# ── Root push (scripts + docs)
cd "$ROOT_DIR"
git add scripts/push-architectural-fixes.sh 2>/dev/null || true
git commit -m "$(cat <<'EOF'
scripts: add architectural fixes push script (round 4)

Push script for @rez/shared-types package creation and type
alignment across 14 repos. Creates shared types + Zod schemas,
standardizes product pricing, unifies campaign interfaces,
enables strict:true on Order/Product models.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" && git push origin main 2>&1 && log "Pushed root (scripts)" && ((SUCCESS++)) || { err "Push failed: root"; ((FAIL++)); }

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
  echo -e "${GREEN}All architectural fixes pushed successfully!${NC}"
fi
