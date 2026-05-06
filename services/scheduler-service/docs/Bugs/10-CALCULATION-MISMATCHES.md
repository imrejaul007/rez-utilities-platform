# Bug Report: Calculation Mismatches & Formula Inconsistencies

**Audit Date:** 2026-04-13
**Layer:** Consumer app, checkout, wallet API, coin config, shared packages
**Status:** CRITICAL — users see wrong financial values on every transaction

---

## C12 — Frontend cashback preview formula is completely different from backend calculation {#c12}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Every single transaction ends with a coin award that does not match the preview. Users feel cheated on every purchase.

**What is happening:**

**Frontend (`usePaymentFlow.ts:191`):**
```typescript
const coinsToEarn = Math.floor(billAmount / 10); // 1 coin per ₹10, flat rate
```

**Backend (`cashbackEngine.ts:95-141`):**
```typescript
const baseCashback = (billAmount × baseRate) / 100;         // baseRate = 2.5–6% by category
const afterSub     = baseCashback × cashbackMultiplier;      // 1× to 3× for premium/VIP
const afterPrive   = afterSub × priveCoinMultiplier;         // 1× to 2× for Privé tier
const maxAllowed   = Math.floor(billAmount × 15 / 100);      // 15% hard cap
const final        = Math.floor(Math.min(afterPrive, maxAllowed));
```

**Calculation example for a ₹1,000 grocery bill, base 5%, no multipliers:**
- Frontend shows: **100 coins** (`floor(1000/10)`)
- Backend credits: **50 coins** (`floor(1000 × 0.05)`)
- User receives 50% less than shown

**For a premium user with 2× subscription and 1.5× Privé:**
- Backend would credit: `floor(1000 × 0.05 × 2 × 1.5) = 150 coins`
- Frontend still shows: **100 coins** (ignores multipliers entirely)
- In this case user receives 50% MORE than shown

The preview is wrong in both directions depending on the user's tier.

**Files involved:**
- `rezapp/rez-master/hooks/usePaymentFlow.ts:191` — wrong formula
- `rezbackend/rez-backend-master/src/services/entitlement/cashbackEngine.ts:95-141` — correct formula

**Fix:**
Remove the local calculation from `usePaymentFlow.ts`. Add a backend endpoint:
```
GET /api/wallet/cashback-preview?billAmount=1000&storeId=xxx&category=groceries
```
That returns `{ estimatedCoins: 50, appliedRate: 5, multiplier: 1.0 }`. The app renders this server-provided preview.

---

## C13 — Coin value contradicted in 3 places simultaneously — users cannot trust displayed value {#c13}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Users planning a redemption see ₹0.50 per coin in the FAQ, but the transaction processes at ₹1.00 per coin. For large balances, the displayed rupee value is 2× the actual value.

**What is happening:**

| Location | Coin value stated |
|----------|------------------|
| Consumer app FAQ (`app/help/index.tsx`) | **₹0.50 per coin** (1 coin = ₹0.50) |
| Backend `WalletConfig.coinConversion.rezToInr` | **₹1.00 per coin** (default) |
| `earningsNotificationService.ts:149` | `coinValue = Math.round(amount / 10)` → implies **₹0.10 per coin** |
| `checkout.config.ts` | `conversionRate: 1` → **₹1.00 per coin** |

The `WalletConfig` rate is dynamic (admin-configurable) and is the authoritative rate. The FAQ text is hardcoded and will never update when admin changes the rate.

**Files involved:**
- `rezapp/rez-master/app/help/index.tsx` — hardcoded "₹0.50" text
- `rezbackend/rez-backend-master/src/models/WalletConfig.ts` — `coinConversion.rezToInr` (authoritative)
- `rezbackend/rez-backend-master/src/services/earningsNotificationService.ts:149` — inconsistent implied rate

**Fix:**
1. Remove the hardcoded value from the FAQ. Fetch the live rate:
   ```typescript
   const rate = await walletApi.getConversionRate(); // /wallet/conversion-rate
   // Display: `1 coin = ₹${rate.rezToInr}`
   ```
2. Fix `earningsNotificationService.ts:149` to use `WalletConfig.coinConversion.rezToInr`

---

## H29 — Privé coins are missing from the `coinUsageOrder` field in the wallet balance API response {#h29}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Consumer app logic that renders redemption order from the API omits Privé coins. Privé coin holders may have their Privé coins spent after REZ coins, losing the priority benefit they paid for.

**What is happening:**
`walletBalanceController.ts:310`:
```typescript
coinUsageOrder: ['promo', 'branded', 'rez']  // Privé (prive) missing
```

Actual engine (`rewardEngine.ts` + `Wallet.getCoinUsageOrder()`):
```typescript
return ['promo', ...brandedCoins, 'prive', 'rez']
```

Any consumer app component that renders coin order or applies it locally will apply the wrong order.

**Files involved:**
- `rezbackend/rez-backend-master/src/controllers/walletBalanceController.ts:310`

**Fix:**
```typescript
coinUsageOrder: ['promo', 'branded', 'prive', 'rez']
```
Or better: call `wallet.getCoinUsageOrder()` and serialize its output.

---

## H30 — Promo coin redemption cap: 20% in backend vs 30% in consumer app checkout config {#h30}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Consumer app checkout allows 30% promo coin redemption. Backend enforces 20%. Users select 30%, backend rejects or overrides silently. User confusion.

**What is happening:**

| Location | Promo coin cap |
|----------|---------------|
| `rezbackend/CURRENCY_RULES.promo.maxUsagePct` | **20%** |
| `storePaymentController.ts` auto-optimization Step 1 | **20%** |
| `rezapp/rez-master/config/checkout.config.ts PROMO_COIN_MAX_USAGE_PERCENTAGE` | **20%** (platform promo) |
| `rezapp/rez-master/config/checkout.config.ts STORE_PROMO_COIN_MAX_USAGE_PERCENTAGE` | **30%** (store promo coins) |
| `promoCoins.config.ts DEFAULT_PROMO_COINS_CONFIG.redemption.maxUsagePercentage` | **30%** |

For "store promo coins", the consumer app allows up to 30% redemption, but the backend `CURRENCY_RULES` applies a 20% cap universally.

**Files involved:**
- `rezbackend/rez-backend-master/src/config/currencyRules.ts` — `maxUsagePct: 20`
- `rezapp/rez-master/config/checkout.config.ts` — `STORE_PROMO_COIN_MAX_USAGE_PERCENTAGE: 30`
- `rezbackend/rez-backend-master/src/config/promoCoins.config.ts` — `maxUsagePercentage: 30`

**Fix:**
Decide the canonical cap. If store promo coins should have a different cap than platform promo coins, add a `storePromoMaxUsagePct` field to `CURRENCY_RULES` and enforce it separately in the backend. Remove the frontend constant — cap enforcement belongs in the backend only.

---

## H36 — `rez-shared` declares `COIN_EXPIRY_DAYS.promo = 7` — contradicts all other configs {#h36}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Any service importing from `rez-shared` will expire promo coins in 7 days. All other configs say 30–90 days. Promo coin holders using services built on `rez-shared` lose coins 4–13× faster than documented.

**What is happening:**
`packages/rez-shared/src/constants/coins.ts`:
```typescript
export const COIN_EXPIRY_DAYS = {
  rez: 365,       // ← also contradicts backend "never expire"
  prive: 365,
  promo: 7,       // ← CRITICAL: 7 days vs 90 days everywhere else
  branded: 90,    // ← also contradicts backend 180 days
  cashback: 30,
  referral: 90
};
```

Compare to `currencyRules.ts`: `promo.expiryDays = 90`, `branded.expiryDays = 180`.

**Files involved:**
- `packages/rez-shared/src/constants/coins.ts` — `COIN_EXPIRY_DAYS` (7d promo, 90d branded)
- `rezbackend/rez-backend-master/src/config/currencyRules.ts` — (90d promo, 180d branded)
- `rezbackend/rez-backend-master/src/config/coinExpiryPolicy.ts` — (30d promo, 60d branded)

**Expiry discrepancy matrix:**

| Coin | currencyRules.ts | coinExpiryPolicy.ts | rez-shared | WalletConfig default |
|------|-----------------|--------------------|-----------|--------------------|
| REZ | 0 (never) | 90d | 365d | 0 (never) |
| Promo | 90d | 30d | **7d** | 90d |
| Branded | 180d | 60d | 90d | 180d |
| Privé | 365d | (not handled) | 365d | 365d |

**Fix:**
1. Delete `coinExpiryPolicy.ts` (redundant, wrong values)
2. Delete the expiry constants from `rez-shared` (wrong values)
3. Declare expiry days only in `WalletConfig` (DB, admin-configurable) with `currencyRules.ts` as the hardcoded fallback
4. All services that need expiry days must call `GET /wallet/config` or import from `currencyRules.ts` only

---

## M20 — Loyalty state is fragmented across 4 collections with no join — no complete loyalty history queryable {#m20}
> **Status:** ⏳ DEFERRED (PARTIAL) — UserLoyaltySummary denormalization deferred for Phase 2. The sub-issue of `UserLoyalty.coins.available` not being updated after wallet debits (which bypassed Mongoose post-save hooks via `findOneAndUpdate`) was fixed in `walletService.ts` debit() method: a fire-and-forget `UserLoyalty.findOneAndUpdate()` now syncs `coins.available` after every successful atomic debit.

**Severity:** MEDIUM
**Impact:** A user's complete loyalty record (visits, streaks, coins earned, tier) requires joining 4 collections. No single query returns it. Analytics and customer support cannot audit a user's loyalty history.

**What is happening:**
Loyalty state lives in:
1. `UserStreak` — streak counts and dates
2. `CoinTransaction` — individual coin earn/spend events
3. `Wallet.statistics` — aggregate totals (totalEarned, totalSpent)
4. `Achievement/Challenge` models — milestone completions

There is no dedicated `Loyalty` or `LoyaltyHistory` collection. Querying "show me everything about this user's loyalty" requires 4 separate queries and manual joins.

**Files involved:**
- No single `Loyalty` model exists in the codebase

**Fix:**
Create a `UserLoyaltySummary` collection that is updated (denormalized) on each loyalty event:
```typescript
{
  userId,
  currentTier,
  totalVisits,
  currentStreak,
  lifetimeCoinsEarned,
  lifetimeCoinsSpent,
  milestoneHistory: [{ milestone, earnedAt, coinsAwarded }],
  lastActivityAt,
  updatedAt
}
```
Keep this as a read-optimized view. Update it via events from the gamification service.

---

## M21 — Reward rates, streak milestones, and coin earn amounts are hardcoded in service files, not in shared config {#m21}
> **Status:** ✅ PARTIALLY FIXED — cashback cap, base rate, coins-per-rupee, and Privé multiplier ceiling are now env-configurable in `cashbackEngine.ts` (CASHBACK_MAX_RATE_PCT, CASHBACK_BASE_RATE, REZ_COINS_PER_RUPEE, PRIVE_MULTIPLIER). Loyalty tier thresholds are env-configurable in `coinService.ts` (LOYALTY_TIER_SILVER/GOLD/PLATINUM_THRESHOLD). Full migration of streak milestone coin amounts to WalletConfig remains deferred for admin panel Phase 2.

**Severity:** MEDIUM
**Impact:** Changing any reward rate requires a code deploy and cannot be adjusted by the ops/product team without engineering involvement.

**What is happening:**
Values hardcoded in service files:
- `streakService.ts` — `STREAK_MILESTONES` object with all coin values per day threshold
- `instantRewardService.ts` — `COIN_AMOUNTS` object
- `storeVisitStreakWorker.ts` — hardcoded 50/150/500 coins for 3/7/30-day streaks

These are not in `WalletConfig` (admin-configurable) or `rez-shared`. Changing a 3-day streak reward from 50 to 100 coins requires a code change, review, and deploy.

**Files involved:**
- `rezbackend/rez-backend-master/src/services/streakService.ts` — `STREAK_MILESTONES`
- `rezbackend/rez-backend-master/src/services/instantRewardService.ts` — `COIN_AMOUNTS`
- `rez-gamification-service/src/workers/storeVisitStreakWorker.ts` — hardcoded milestone values

**Fix:**
Store reward rates in `WalletConfig` (already the pattern for `coinConversion` rates). Admin can tune values without a deploy. Services fetch config on startup and cache with TTL.

---

## M22 — Two separate merchant payout systems write to different collections with no mutual exclusion {#m22}
> **Status:** ⏳ DEFERRED (PARTIAL) — `MERCHANT_SETTLEMENT_RATE` constant added to `economicsConfig.ts` as env-configurable (default 0.9705 = 97.05% = 100% - 2.5% commission - 18% GST-on-commission). Dual payout path consolidation (deleting `payoutRoutes.ts` in favour of `merchantWalletService.requestWithdrawal()`) remains deferred; requires merchant wallet service migration tracked with C10.

**Severity:** MEDIUM (financial integrity — see also C10)
**Impact:** Even if C10's race condition is fixed in `payoutRoutes.ts`, the existence of two parallel payout paths (`merchantpayouts` vs `MerchantWalletTransaction`) means the true outstanding payout balance cannot be determined from either collection alone.

**What is happening:**
Path A: `payoutRoutes.ts` → `merchantpayouts` collection (raw MongoDB, no Mongoose schema)
Path B: `merchantWalletService.requestWithdrawal()` → `MerchantWalletTransaction` (Mongoose)

Both debit from the same `MerchantWallet.balance.available`. A payout requested via Path A and one via Path B for the same merchant at the same time both see the full balance with no cross-path lock.

**Fix:**
Delete Path A (`payoutRoutes.ts`). All payout requests route through `merchantWalletService.requestWithdrawal()` which is already atomic and properly modeled. Add the `merchantpayouts` query functionality (status check, admin view) to the `MerchantWalletTransaction` model.
