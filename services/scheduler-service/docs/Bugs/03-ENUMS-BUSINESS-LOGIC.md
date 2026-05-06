# Bug Report: Enums & Business Logic Layer (Layer 3)

**Audit Date:** 2026-04-12  
**Layer:** Enums, constants, coin system, cashback, streak/loyalty logic  
**Status:** Financial integrity issues + user-facing wrong payouts

---

## C3 — REZ coins silently expire after 90 days (spec: never expire) {#c3}
> **Status:** ✅ FIXED

**Severity:** CRITICAL  
**Impact:** Users losing "permanent" REZ coins after 90 days with no notification. Trust and legal risk.

**What is happening:**  
Three configs exist for coin expiry, with conflicting values for REZ coins:

| Config file | REZ coins expiry |
|-------------|----------------|
| `coinTypes.ts` (comment/doc) | "never expire" |
| `currencyRules.ts` `CURRENCY_RULES.rez.expiryDays` | `0` (never — correct) |
| `rewardConfig.ts` `REWARD_REZ_EXPIRY` | `parseInt(process.env.REWARD_REZ_EXPIRY_DAYS \|\| '90', 10)` → **90 days** if env not set |

`coinService.ts`'s `calculateExpiryDate()` reads from `WalletConfig.coinExpiryConfig[coinType]` first, then falls back to `CURRENCY_RULES`. But `rewardConfig.ts` is imported and used in other code paths. If any code path uses `rewardConfig.ts` values, users' REZ coins expire after 90 days.

**Immediate action:**  
Set `REWARD_REZ_EXPIRY_DAYS=0` in ALL production environment variables **immediately**.

**Files involved:**
- `rezbackend/rez-backend-master/src/config/rewardConfig.ts` (line 31)
- `rezbackend/rez-backend-master/src/config/currencyRules.ts` (line 20)
- `rezbackend/rez-backend-master/src/constants/coinTypes.ts`

**Fix:**  
Remove the `|| '90'` default from `rewardConfig.ts` line 31. Change to `|| '0'` to match the spec. Add an explicit comment. Better yet, delete `rewardConfig.ts` expiry values entirely and source them only from `currencyRules.ts`.

---

## H9 — 7-day streak milestone pays different coin amounts from two services {#h9}
> **Status:** ✅ FIXED

**Severity:** HIGH  
**Impact:** Users receive 150 to 350 coins (instead of a fixed amount) for the same 7-day streak milestone, depending on which service fires first.

**What is happening:**  
| Service | 7-day milestone | 3-day milestone | 14/30-day milestone |
|---------|----------------|----------------|---------------------|
| `rezbackend/streakService.ts` `STREAK_MILESTONES.login` | **200 coins** | 50 coins | 500 coins (day 14) |
| `rez-gamification-service/workers/storeVisitStreakWorker.ts` | **150 coins** | 50 coins | 500 coins (day 30) |

Both services write to the same user wallet via the wallet service. If both fire for the same user action (a store visit can trigger both a `login` streak in the backend and a `store_visit` streak in the gamification worker), the user receives a combined 350 coins for day 7 instead of the intended amount.

**Files involved:**
- `rezbackend/rez-backend-master/src/services/streakService.ts` (STREAK_MILESTONES — login section)
- `rez-gamification-service/src/workers/storeVisitStreakWorker.ts` (milestone coin amounts)

**Fix:**  
Extract streak milestone config into `rez-shared/src/config/streakMilestones.ts`. Both services import from this single file. Align milestone days and coin amounts to one canonical spec.

---

## H10 — IST vs UTC streak timezone bug {#h10}
> **Status:** ✅ FIXED

**Severity:** HIGH  
**Impact:** Users in India active between 00:00–05:30 IST lose streaks they legitimately earned. The gamification worker sees their early-morning visit as "same UTC day" and refuses to increment.

**What is happening:**  
| Service | Day boundary calculation | Timezone |
|---------|------------------------|----------|
| `rezbackend/streakService.ts` | `getISTDayStart()`, `isNextISTDay()` | IST (UTC+5:30) |
| `rez-gamification-service/storeVisitStreakWorker.ts` | `toISOString().split('T')[0]` | UTC |

Example scenario:
- User visits store at **11:30 PM IST Day 1** (= 6:00 PM UTC Day 1)
- User visits store at **12:30 AM IST Day 2** (= 7:00 PM UTC Day 1)

Backend sees: IST Day 1 → IST Day 2 = next day → **streak increments**  
Gamification worker sees: UTC Day 1 → UTC Day 1 = same day → **streak rejected**

The user loses their streak even though they visited on consecutive Indian calendar days.

**Files involved:**
- `rezbackend/rez-backend-master/src/services/streakService.ts` (lines 8–26, `getISTDayStart`)
- `rez-gamification-service/src/workers/storeVisitStreakWorker.ts` (lines 32–38, UTC split)

**Fix:**  
Copy `getISTDayStart()` and `isNextISTDay()` from `streakService.ts` into a shared utility in `rez-shared/src/utils/timezone.ts`. Import in `storeVisitStreakWorker.ts`. Replace UTC-based day comparison.

---

## H11 — `prive` coins silently reclassified as `rez` in ledger {#h11}
> **Status:** ✅ FIXED

**Severity:** HIGH — also documented in [01-DATA-LAYER.md](01-DATA-LAYER.md#h11)  
**Impact:** Prive coin financial liability invisible in ledger. Audit trail corrupted.

**What is happening:**  
`rezbackend/src/services/walletService.ts` (lines 68–71):
```typescript
const coinType: LedgerCoinType = rawCoinType === 'prive' ? 'rez' : (rawCoinType as LedgerCoinType);
```

Prive coins (premium tier, 12-month expiry, different redemption rules) are written to the ledger as `rez` coins. Any prive-specific reporting, liability calculation, or audit will be wrong.

**Files involved:**
- `rezbackend/rez-backend-master/src/services/walletService.ts` (lines 68–71)

**Fix:**  
Remove the normalization. `LedgerEntry.coinType` already supports `'prive'` — use it.

---

## M1 — No coin expiry job exists {#m1}
> **Status:** ⏳ DEFERRED — requires dedicated cron infrastructure; notification pipeline not yet built

**Severity:** MEDIUM  
**Impact:** Expired coins still show in `balance.available`. Users see incorrect available balance. No expiry notifications sent.

**What is happening:**  
Coin expiry is defined in `currencyRules.ts` (`prive: 365 days`, `branded: 180 days`, `promo: 90 days`). The wallet service checks expiry at debit-time (`debitCoins()`). But:
- No scheduled job proactively marks expired coins
- No job moves balances to the `expired_pool` ledger account (`'000000000000000000000003'`)
- No job notifies users before expiry
- `Wallet.balance.available` still shows expired coins as spendable until a debit attempt fails

**Files involved:**
- `rez-wallet-service/src/services/walletService.ts` (`debitCoins` — only checks at debit time)
- `rezbackend/rez-backend-master/src/models/LedgerEntry.ts` (line defining `expired_pool` — referenced but never written to)

**Fix:**  
Create a nightly cron job (`scripts/expireCoinsCron.ts`):
1. Query all wallets with `coins[].expiryDate < now` and `coins[].amount > 0`
2. For each expired coin bucket: set `amount = 0`, create a `LedgerEntry` debit from user account → `expired_pool`
3. Create a `CoinTransaction` record with `source: 'expiry'`
4. Send notification (push + in-app) 7 days before expiry and on expiry

---

## M2 — Admin order status mapper only in frontend — backend misses pre-migration documents {#m2}
> **Status:** ⏳ DEFERRED — requires one-time MongoDB migration script; scheduled for next maintenance window

**Severity:** MEDIUM  
**Impact:** Admin backend queries miss any order document that was created before the status enum was normalized.

**What is happening:**  
`rezadmin/rez-admin-main/constants/orderStatuses.ts` maps legacy → canonical:
- `pending → placed`
- `completed → delivered`
- `done → delivered`
- `rejected → cancelled`

This normalization only runs in the admin **frontend**. The backend admin order queries use canonical values (`placed`, `delivered`, `cancelled`). Any MongoDB document still containing the legacy values (`pending`, `completed`, `done`, `rejected`) will not be returned by backend queries that filter by canonical status.

Also: `cancelling` is a valid canonical status with no legacy alias — if any legacy documents used `cancelling`, they become invisible.

**Fix:**  
Run a one-time MongoDB migration:
```javascript
db.orders.updateMany({ status: 'pending' }, { $set: { status: 'placed' } });
db.orders.updateMany({ status: 'completed' }, { $set: { status: 'delivered' } });
db.orders.updateMany({ status: 'done' }, { $set: { status: 'delivered' } });
db.orders.updateMany({ status: 'rejected' }, { $set: { status: 'cancelled' } });
```
Remove the legacy mapper from the frontend after migration.

---

## M7 — Branded coins: spec says 6-month expiry, `rewardConfig.ts` defaults to never {#m7}
> **Status:** ✅ FIXED

**Severity:** MEDIUM  
**Impact:** Branded coins never expire if `REWARD_BRANDED_EXPIRY_DAYS` is not set. Merchants paying for branded coins expect them to have 6-month expiry per contract.

**What is happening:**  
| Config | Branded coin expiry |
|--------|-------------------|
| `coinTypes.ts` (comment/doc) | "6-month expiry" |
| `currencyRules.ts` | `expiryDays: 180` |
| `rewardConfig.ts` | `parseInt(process.env.REWARD_BRANDED_EXPIRY_DAYS \|\| '0', 10)` → **0 (never)** if env not set |

Opposite of the REZ coin issue — here the rewardConfig defaults to no expiry when the spec requires expiry.

**Immediate action:**  
Set `REWARD_BRANDED_EXPIRY_DAYS=180` in all production environments.

**Fix:**  
Same as C3 — remove conflicting defaults from `rewardConfig.ts`. Source all expiry values from `currencyRules.ts` only.

---

## M8 — No `debitInPriorityOrder()` in monolith — all coin debits default to `rez` {#m8}
> **Status:** ✅ FIXED

**Severity:** MEDIUM  
**Impact:** Users with `promo` or `branded` coins (which should be spent first) have their `rez` coins debited instead. Promo coins expire unused.

**What is happening:**  
`rez-wallet-service/src/services/walletService.ts` implements `debitInPriorityOrder()` which debits in this order: `promo → branded → prive → rez`.

The monolith's `walletService.deduct()` requires the caller to explicitly specify a `coinType`. If a caller passes `coinType: 'rez'` when the user has promo coins, those promo coins sit unused until they expire.

**Files involved:**
- `rez-wallet-service/src/services/walletService.ts` (`debitInPriorityOrder`)
- `rezbackend/rez-backend-master/src/services/walletService.ts` (`deductCoins` — no priority logic)

**Fix:**  
Port `debitInPriorityOrder()` to the monolith's `walletService.ts`. Update all monolith callers of `deductCoins()` that don't explicitly specify a coin type to use the priority-ordered deduction.

---

## M9 — Campaign eligibility not centralized {#m9}
> **Status:** ⏳ DEFERRED — eligibility service refactor is large; tracked as technical debt

**Severity:** MEDIUM  
**Impact:** Different campaigns apply different eligibility rules. Users can join campaigns they shouldn't, or be blocked from campaigns they qualify for.

**What is happening:**  
`campaignService.ts` checks only: `isActive`, `startsAt/endsAt`, `targetCity`. No check for:
- User tier eligibility
- Subscription level requirement
- Past participation limits
- Maximum participants reached

Individual campaign worker files embed their own eligibility logic. There is no shared eligibility interface.

**Fix:**  
Create `src/services/campaignEligibilityService.ts` with a single `checkEligibility(userId, campaignId): EligibilityResult` function. All campaign join paths call this service. Individual workers stop implementing their own eligibility checks.

---

## Enum Conflict Summary Table

| Enum | Backend value | Frontend/Other value | Risk |
|------|-------------|---------------------|------|
| Order status | `placed`, `delivered` | `pending`, `completed` (legacy frontend mapper) | Data query misses |
| Merchant role | `owner\|admin\|manager\|staff\|cashier` | — | — |
| Admin role | `super_admin\|admin\|operator\|support` | — | String `"admin"` appears in both → collision |
| Payment status | `pending\|paid\|failed\|refunded` | `pending\|processed\|failed\|cancelled` (cashback) | Cross-query misses |
| Coin type (wallet bucket) | 6 types | 4 types (wallet service) | cashback/referral orphaned |
| `Wallet.currency` | `RC` (default) | `REZ_COIN` (wallet service default) | Mixed values |

---

## Three-Way Coin Expiry Conflict

| Coin | `coinTypes.ts` doc | `currencyRules.ts` | `rewardConfig.ts` default | Effective behavior |
|------|-------------------|-------------------|--------------------------|-------------------|
| `rez` | never | 0 days | **90 days** | WRONG — expires if env not set |
| `prive` | 12 months | 365 days | 365 days | Consistent |
| `branded` | 6 months | 180 days | **0 days** | WRONG — never expires if env not set |
| `promo` | campaign-based | 90 days | 90 days | Consistent |
| `cashback` | not documented | not in rules | not configured | No expiry logic at all |
| `referral` | not documented | not in rules | not configured | No expiry logic at all |
