# REZ Forensic Audit — Enum Mismatches (Complete Registry)

**Audit Date:** 2026-04-13
**Coverage:** All enums across DB schema, rez-shared, rezbackend, rez-wallet-service, rez-payment-service, rez-merchant-service, rez-finance-service, rez-marketing-service, Consumer, Admin, Merchant

---

## ENUM-01 — CoinType: `'cashback'` and `'referral'` missing from wallet-service Wallet model
> **Status:** ✅ FIXED

| Layer | Values |
|-------|--------|
| DB canonical (rezbackend) | `'rez'|'prive'|'branded'|'promo'|'cashback'|'referral'` |
| rez-shared COIN_TYPES | `'rez'|'prive'|'branded'|'promo'|'cashback'|'referral'` |
| rez-wallet-service `ICoinBalance.type` | `'rez'|'prive'|'branded'|'promo'` — **MISSING 2** |
| rez-wallet-service `LedgerEntry.coinType` | `'rez'|'promo'|'branded'|'prive'` — **MISSING 2** |
| Consumer `CoinType` (wallet.ts) | `'rez'|'branded'|'promo'|'prive'` — **MISSING 2** |

**Severity:** ❌ BREAKING (see F-C1, F-C2)
**File references:** `rez-wallet-service/src/models/Wallet.ts:4`, `rez-wallet-service/src/models/LedgerEntry.ts:49`, `rezapp/rez-master/types/wallet.ts:5`

---

## ENUM-02 — TransactionStatus: `'success'` (finance-service) vs `'completed'` (everywhere else)
> **Status:** ✅ FIXED

| Layer | Terminal Positive Status |
|-------|--------------------------|
| rezbackend Transaction.status | `'completed'` |
| rez-shared BackendTransactionStatus | `'completed'` |
| rez-payment-service Payment.status | `'completed'` |
| rez-wallet-service MerchantWalletTx.status | `'completed'` |
| **rez-finance-service FinanceTxStatus** | **`'success'`** ← WRONG |
| Consumer wallet.types.ts TransactionStatus | `'success'` ← WRONG (matches finance, not canonical) |

**Severity:** ❌ BREAKING (see F-C6)
**File references:** `rez-finance-service/src/models/FinanceTransaction.ts:4`, `rezapp/rez-master/types/wallet.types.ts`

---

## ENUM-03 — OfferType: merchant-service adds 5 invalid values
> **Status:** ✅ FIXED

| Layer | Values |
|-------|--------|
| DB canonical (rezbackend Offer.ts) | `cashback|discount|voucher|combo|special|walk_in` |
| rez-shared offer.types.ts | `cashback|discount|voucher|combo|special|walk_in` |
| **rez-merchant-service offerValidator.ts** | `discount|cashback|deal|flash_sale|loyalty|gift_card|voucher|dynamic_pricing` |

**Missing from merchant-service:** `combo`, `special`, `walk_in`
**Invalid in merchant-service (will fail Mongoose):** `deal`, `flash_sale`, `loyalty`, `gift_card`, `dynamic_pricing`

**Severity:** ❌ BREAKING (see F-C4)
**File reference:** `rez-merchant-service/src/utils/offerValidator.ts:14`

---

## ENUM-04 — Payment FSM: `processing` and `failed` transitions disagree
> **Status:** ✅ FIXED

| Transition | rezbackend | rez-payment-service |
|-----------|-----------|---------------------|
| `processing` exits to | `['completed', 'failed']` | `['completed', 'failed', 'cancelled']` |
| `failed` exits to | `['pending']` (retryable) | `[]` (terminal) |
| `cancelled` exits to | `[]` (terminal) | `[]` (terminal) |

**Severity:** ❌ BREAKING (see F-C3)
**File references:** `rezbackend/src/config/financialStateMachine.ts`, `rez-payment-service/src/models/Payment.ts:36`

---

## ENUM-05 — LoyaltyTier: three incompatible case conventions
> **Status:** ⚠️ PARTIAL FIX — `normalizeTier()` function added in `User.ts` maps SCREAMING_CASE → lowercase at runtime. `loyaltyTier` schema uses lowercase. `referralTier` schema still accepts SCREAMING_CASE. Requires migration + schema tightening for full fix.

| Layer | Values | Convention |
|-------|--------|-----------|
| DB `UserLoyalty.brandLoyalty[].tier` | `'Bronze'|'Silver'|'Gold'|'Platinum'|'Diamond'` | PascalCase |
| DB `User.referralTier` | `'STARTER'|'BRONZE'|'SILVER'|'GOLD'|'PLATINUM'|'DIAMOND'` | SCREAMING_CASE |
| rez-shared `Store.offers.partnerLevel` | `'bronze'|'silver'|'gold'|'platinum'` | lowercase |
| Consumer `loyaltyApi.ts` LoyaltyTier | `'Bronze'|'Silver'|'Gold'|'Platinum'|'Diamond'` | PascalCase |
| Consumer `UnifiedUser.loyaltyTier` | `'bronze'|'silver'|'gold'|'platinum'` | lowercase — **MISSING diamond** |
| Admin `users.tsx` normalized | `BRONZE→'bronze'`, `DIAMOND→'platinum'` | lowercase — **LOSES diamond** |
| Admin `loyalty.ts` brandLoyalty[].tier | Accepts both `'Bronze'` AND `'bronze'` | BOTH |

**Severity:** ❌ BREAKING for Diamond tier; ⚠️ RISK for all tier comparisons

---

## ENUM-06 — PriveTier: merchant app uses completely different values
> **Status:** ✅ FIXED

| Layer | Values |
|-------|--------|
| DB `User.priveTier` | `'none'|'entry'|'signature'|'elite'` |
| rez-shared `OfferEligibility.priveTiers` | `'none'|'entry'|'signature'|'elite'` |
| **Merchant app `PriveTierRequired`** | **`'none'|'silver'|'gold'|'platinum'`** |
| **Admin `PriveOffer.tierRequired`** | **`'none'|'entry'|'signature'|'elite'`** |

**Merchant app vs DB:** Zero overlap beyond `'none'`.

**Severity:** ❌ BREAKING (see F-H8)
**File reference:** `rezmerchant/rez-merchant-master/services/api/priveCampaigns.ts:14`

---

## ENUM-07 — User Role: consumer adds `'moderator'`; DB has `'support'|'operator'|'super_admin'` not in consumer
> **Status:** ✅ FIXED — `rezapp/rez-master/types/unified/User.ts` role updated to `'user' | 'merchant' | 'admin' | 'support' | 'operator' | 'super_admin'`; `moderator` removed (see also FM-29)

| Layer | Values |
|-------|--------|
| DB schema | `'user'|'admin'|'merchant'|'support'|'operator'|'super_admin'` |
| Consumer UnifiedUser | `'user'|'merchant'|'admin'|'moderator'` |
| Admin | `'support'|'operator'|'admin'|'super_admin'` |
| Merchant | always `'merchant'` (hardcoded) |

**`'moderator'` does NOT exist in DB.** `'support'`, `'operator'`, `'super_admin'` exist in DB but not in consumer type.

**Severity:** ⚠️ RISK
**File reference:** `rezapp/rez-master/types/unified/User.ts:66`

---

## ENUM-08 — TransactionType: UPPERCASE in wallet.types.ts vs lowercase in walletApi.ts (same file scope)
> **Status:** ⏳ DEFERRED — display vs wire format distinction; tracked for consumer wallet type cleanup

| File | Values |
|------|--------|
| `rezapp/rez-master/types/wallet.types.ts` | `'PAYMENT'|'REFUND'|'CASHBACK'|'REWARD'|'TRANSFER'|'TOPUP'|'WITHDRAWAL'` |
| `rezapp/rez-master/services/walletApi.ts` | `'credit'|'debit'` (backend wire format) |
| Backend `Transaction.type` | `'credit'|'debit'` |

The UPPERCASE enum in `wallet.types.ts` is a display/UI concept, but it is typed as `TransactionType` — the same name could be confused with the backend `type` field.

**Severity:** ⚠️ RISK

---

## ENUM-09 — CoinTransaction type: DB values vs user-facing API values vs consumer types
> **Status:** ⏳ DEFERRED — API boundary rename (spent→redeemed) is intentional; consumer type cleanup tracked

| Layer | Values |
|-------|--------|
| DB `CoinTransaction.type` | `'earned'|'spent'|'expired'|'refunded'|'bonus'|'branded_award'` |
| User-facing API (`/api/user/transactions` type filter) | `'earned'|'redeemed'|'expired'` |
| Consumer `WalletTransaction.type` (wallet.ts) | `'earned'|'spent'|'expired'|'bonus'|'transfer'|'gift'` |

**`'spent'` → renamed `'redeemed'` at API boundary** — undocumented.
**`'bonus'` and `'branded_award'`** — exist in DB but not in user-facing filter (both lumped into `'earned'` in summary).
Consumer `WalletTransaction.type` uses `'transfer'` and `'gift'` — not in DB `CoinTransaction.type`.

**Severity:** ⚠️ RISK

---

## ENUM-10 — Booking status: `'hold'` used in UI, not in schema
> **Status:** ✅ FIXED — removed dead `status === 'hold'` condition from `my-bookings.tsx`; no schema impact

| Layer | `'hold'` |
|-------|---------|
| ServiceBooking schema | ❌ NOT PRESENT |
| Consumer `my-bookings.tsx:373` | ✅ `status === 'hold'` — dead condition |

**Severity:** ⚠️ (dead code — see F-M4)
**File:** `rezapp/rez-master/app/my-bookings.tsx:373`

---

## ENUM-11 — Campaign type: `'new-user'` uses hyphen vs underscore convention
> **Status:** ⏳ DEFERRED — cosmetic naming fix; migration required; low risk

| Enum | Convention |
|------|-----------|
| `Campaign.type: 'new-user'` | hyphen `-` |
| All other enums | underscore `_` (e.g., `'new_arrival'`, `'flash_sale'`, `'out_for_delivery'`) |

**Severity:** ⚠️ LOW (see F-L3)

---

## ENUM-12 — BookingStatus query filter: `'upcoming'` and `'past'` are not real statuses
> **Status:** ⏳ DEFERRED — backend filter handler needs explicit date-range logic; tracked

| Layer | Values |
|-------|--------|
| ServiceBooking.status (DB) | `pending|confirmed|assigned|in_progress|completed|cancelled|no_show|refunded|expired` |
| Consumer bookingApi.ts query param | `'upcoming'|'past'|'cancelled'|'completed'` |

`'upcoming'` and `'past'` are date-derived computed groupings, not stored status values. If backend passes them directly to MongoDB query, returns 0 results.

**Severity:** ⚠️ RISK (see F-M5)

---

## ENUM-13 — `earn-from-social-media.tsx` checks UPPERCASE `'COMPLETED'` — never matches
> **Status:** ✅ FIXED — `earn-from-social-media.tsx:204` updated to check lowercase `'completed'` matching backend Transaction.status

| Layer | Value |
|-------|-------|
| Backend Transaction.status | `'completed'` (lowercase) |
| Consumer `earn-from-social-media.tsx:204` | checks `=== 'COMPLETED'` (UPPERCASE) |

**Severity:** ❌ HIGH (see F-M6)

---

## ENUM-14 — Referral tier schema vs reward config keys are different enumerations
> **Status:** ✅ FIXED

| Field | Values |
|-------|--------|
| `User.referralTier` (DB schema) | `'STARTER'|'BRONZE'|'SILVER'|'GOLD'|'PLATINUM'|'DIAMOND'` |
| `REFERRAL_CONFIG.tiers` keys | `'STARTER'|'PRO'|'ELITE'|'CHAMPION'|'LEGEND'` |

Only `'STARTER'` overlaps. Reward config lookup by `user.referralTier` returns `undefined` for all non-STARTER tiers.

**Severity:** ❌ HIGH (see F-H2)

---

## ENUM-15 — Marketing campaign status vs Ad campaign status — same field name, zero overlap
> **Status:** ⏳ DEFERRED — naming confusion only; no shared query path today; tracked as tech debt

| Type | Status values |
|------|--------------|
| MarketingCampaign (rez-marketing-service) | `draft|scheduled|sending|sent|failed|cancelled` |
| AdCampaign (rez-shared / rez-merchant-service) | `draft|pending_review|active|paused|rejected|completed` |

Both use field named `status`. A system treating all campaigns uniformly will apply wrong logic.

**Severity:** ⚠️ RISK (see F-L10)

---

## ENUM-16 — Gender: interface has 3 values, schema has 4
> **Status:** ✅ FIXED

| Layer | Values |
|-------|--------|
| DB schema `User.profile.gender` | `'male'|'female'|'other'|'prefer_not_to_say'` |
| TypeScript `IUserProfile.gender` | `'male'|'female'|'other'` |

**Severity:** ⚠️ RISK (see F-H3)

---

## ENUM-17 — Offer `saleTag` and `bogoType` incomplete in Consumer
> **Status:** ✅ FIXED — `offers.types.ts` updated: `SaleOffer.tag` now includes `mega_sale`; `BOGOOffer.bogoType` now includes `buy2get50`; matches DB schema and `realOffersApi.ts`

| Field | DB schema | Consumer type |
|-------|-----------|---------------|
| `saleTag` | `clearance|sale|last_pieces|mega_sale` | `clearance|sale|last_pieces` — missing `mega_sale` |
| `bogoType` | `buy1get1|buy2get1|buy1get50|buy2get50` | `buy1get1|buy2get1|buy1get50` — missing `buy2get50` |

**Severity:** ⚠️ LOW (see F-M10)

---

## ENUM-18 — Offer exclusive zone: DB has 11 values; Consumer ExclusiveZoneOffer zone has 4
> **Status:** ⏳ DEFERRED — 7 exclusive zone types not yet surfaced in consumer UI; tracked for expansion

| Layer | Values |
|-------|--------|
| DB `Offer.exclusiveZone` | `corporate|women|birthday|student|senior|defence|healthcare|teacher|government|differently-abled|first-time` |
| Consumer `ExclusiveZoneOffer.zone` | `student|corporate|women|birthday` |

7 exclusive zone types (`senior`, `defence`, `healthcare`, `teacher`, `government`, `differently-abled`, `first-time`) exist in DB but have no consumer rendering logic.

**Severity:** ⚠️ RISK

---

## ENUM-19 — `Offer.visibleTo` enum not surfaced in any frontend
> **Status:** ⏳ DEFERRED — visibleTo filtering logic not yet implemented in consumer/admin; tracked

| Layer | Values |
|-------|--------|
| DB `Offer.visibleTo` | `'all'|'followers'|'premium'` |
| Consumer, Admin, Merchant | Not referenced — always treated as `'all'` |

Offers set to `visibleTo: 'followers'` or `'premium'` will appear to all users if no filtering logic exists.

**Severity:** ⚠️ RISK

---

## ENUM-20 — Order cashback status differs from shared CashbackStatus
> **Status:** ⏳ DEFERRED — three cashback status enums need product-level consolidation; tracked

| Field | DB values |
|-------|-----------|
| `Order.cashback.status` | `'pending'|'credited'|'reversed'` |
| `src/types/shared.ts CashbackStatus` | `'pending'|'under_review'|'approved'|'rejected'|'paid'|'expired'|'cancelled'` |
| Merchant `CashbackStatus` | `'pending'|'approved'|'rejected'|'paid'|'expired'` |

These are three incompatible cashback status enumerations for what should be the same concept.

**Severity:** ⚠️ RISK

---

## Complete Enum Inventory — Cross-Service Summary

| Enum | Source of Truth | Services in sync | Services out of sync |
|------|----------------|-----------------|---------------------|
| CoinType (6 values) | rezbackend/coinTypes.ts | rezbackend ✅, rez-shared ✅ | rez-wallet-service Wallet ❌, consumer ❌ |
| OrderStatus (11 values) | rez-shared/orderStatuses.ts | All services ✅ | None ✅ |
| OrderPaymentStatus (8 values) | rez-shared/paymentStatuses.ts | rezbackend ✅, merchant ✅, admin ✅ | — |
| StandalonePaymentStatus (10 values) | rez-shared/paymentStatuses.ts | rezbackend ✅, payment-service ✅ | finance-service ❌ |
| OfferType (6 values) | Offer.ts | rezbackend ✅, admin ✅ | merchant-service ❌ |
| OfferStatus (virtual, 4 values) | Offer.ts virtual | rezbackend ✅ | consumer checks wrong value ❌ |
| LoyaltyTier | UserLoyalty.ts (PascalCase) | DB ✅ | consumer type missing diamond ❌, admin loses diamond ❌ |
| PriveTier (4 values) | User.ts | rezbackend ✅, admin ✅ | merchant app ❌ |
| BookingStatus (9 values) | ServiceBooking.ts | rezbackend ✅ | consumer uses 'hold' (dead) ❌ |
| CampaignType (8 values) | Campaign.ts | rezbackend ✅ | 'new-user' uses hyphen ⚠️ |
| MarketingCampaignStatus | MarketingCampaign.ts | marketing-service only | completely different from AdCampaignStatus ❌ |
| UserRole (6 values) | User.ts | rezbackend ✅, admin ✅ | consumer adds 'moderator' ❌ |
| ReferralTier schema | User.ts | rezbackend ✅ | rewardConfig keys mismatch ❌ |
