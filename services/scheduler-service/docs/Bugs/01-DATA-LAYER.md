# Bug Report: Data Layer (Layer 1)

**Audit Date:** 2026-04-12  
**Layer:** Data models, schema consistency, MongoDB collections  
**Status:** CRITICAL — active data corruption in production

---

## C1 — Three incompatible schemas writing to the same `cointransactions` collection {#c1}
> **Status:** ✅ FIXED

**Severity:** CRITICAL  
**Impact:** Active data corruption. Balance calculations include malformed records.

**What is happening:**  
Three separate services all write to the MongoDB collection `cointransactions` with completely different document schemas:

| Service | Fields written | Fields missing |
|---------|---------------|----------------|
| `rezbackend` | `coinType`, `source`, `description`, `balance`, `coinStatus` | — |
| `rez-wallet-service` | `coinType`, `source`, `description`, `balanceBefore`, `balanceAfter`, `sourceId` | `balance`, `coinStatus` |
| `rez-merchant-service` | `coins`, `storeId`, `orderId`, `reason`, `status` | `coinType`, `source`, `description` |

The merchant service writes `coins` (a Number) directly — not `coinType`. It never sets `coinType`, `source`, or `description`, all of which are `required: true` in the backend's model.

**Files involved:**
- `rezbackend/rez-backend-master/src/models/CoinTransaction.ts`
- `rez-wallet-service/src/models/CoinTransaction.ts`
- `rez-merchant-service/src/models/CoinTransaction.ts`

**Fix:**  
Create a single canonical `CoinTransaction` schema in `rez-shared/`. All three services import from it. Run a one-time migration to normalize existing merchant-service-written documents.

---

## C2 — `cashback` and `referral` coin types: valid in CoinTransaction, invisible everywhere else {#c2}
> **Status:** ✅ FIXED

**Severity:** CRITICAL  
**Impact:** Reconciliation mathematically impossible for 2 of 6 coin types. Financial liability undercount.

**What is happening:**  
`coinTypes.ts` declares 6 coin types: `rez`, `prive`, `branded`, `promo`, `cashback`, `referral`.  
But two of them are excluded from critical models:

| Model | Supports `cashback`? | Supports `referral`? |
|-------|---------------------|---------------------|
| `rezbackend/CoinTransaction.coinType` | YES | YES |
| `rez-wallet-service/CoinTransaction.coinType` | YES | YES |
| `rezbackend/Wallet.coins[].type` | YES | YES |
| `rez-wallet-service/Wallet.coins[].type` | NO | NO |
| `LedgerEntry.coinType` (wallet-service) | NO | NO |

Every cashback or referral coin credit creates a `CoinTransaction` record with no matching `LedgerEntry` and no matching wallet coin bucket (in the wallet service). Double-entry accounting is broken.

**Files involved:**
- `rezbackend/rez-backend-master/src/constants/coinTypes.ts` (line 15 — declares all 6)
- `rez-wallet-service/src/models/Wallet.ts` (line 60 — missing cashback, referral)
- `rezbackend/rez-backend-master/src/models/LedgerEntry.ts` (line 49 — missing cashback, referral)

**Fix:**  
Add `cashback` and `referral` to:
1. `LedgerEntry.coinType` enum
2. `rez-wallet-service/Wallet.coins[].type` enum
3. `CURRENCY_RULES` in `currencyRules.ts` (expiry, priority)
4. `rewardConfig.ts` (expiry days)

---

## H6 — `merchant` vs `merchantId` collision breaks uniqueness in `merchantwallets` {#h6}
> **Status:** ✅ FIXED

**Severity:** HIGH  
**Impact:** Duplicate wallet records per merchant, no detection, no reconciliation path.

**What is happening:**  
- `rez-wallet-service/MerchantWallet.ts` (line 9): canonical field is `merchant: ObjectId`, with `{ merchant: 1 }` unique index
- `rez-merchant-service/MerchantWallet.ts` (lines 7–8): declares BOTH `merchant` AND `merchantId` as `Schema.Types.Mixed`

When merchant service writes using `merchantId` as the key, the unique index on `merchant` does not fire. Duplicate merchant wallets accumulate silently.

**Files involved:**
- `rez-wallet-service/src/models/MerchantWallet.ts` (line 9, 45)
- `rez-merchant-service/src/models/MerchantWallet.ts` (lines 7–8)

**Fix:**  
Remove `merchantId` from merchant-service `MerchantWallet`. Use `merchant: ObjectId` only, matching the wallet-service schema. Run a migration to remove duplicate wallet records.

---

## H7 — Two separate Cashback collections with incompatible schemas and no reconciliation {#h7}
> **Status:** ✅ FIXED

**Severity:** HIGH  
**Impact:** Cashback paid to users has zero traceability to merchant-side approval.

**What is happening:**  
| Service | Collection | Key fields |
|---------|-----------|------------|
| `rezbackend` | `cashbackrequests` | `requestNumber`, `cashbackRate`, `calculationBreakdown`, `riskScore`, `fraudFlags`, approval workflow, `timeline` |
| `rez-merchant-service` | `cashbacks` | `percentage`, `minOrderAmount`, `validFrom`, `validTo`, `approvedAmount`, `rejectionReason`, `paidAt` |

These are completely different collections. A cashback approval in the merchant portal writes to `cashbacks`. A cashback credit in the backend reads from `cashbackrequests`. Neither service knows the other exists.

**Files involved:**
- `rezbackend/rez-backend-master/src/models/Cashback.ts` (line 120 — exports as `CashbackRequest`, collection `cashbackrequests`)
- `rez-merchant-service/src/models/Cashback.ts` (line 27–31 — collection `cashbacks`)

**Fix:**  
Option A: Unify into a single `cashbackrequests` collection with the full schema.  
Option B: Create a reconciliation job that links `cashbacks._id` → `cashbackrequests.merchantCashbackId` via a shared reference field.

---

## H8 — `UserLoyalty.coins.available` is a phantom balance never synced with actual wallet {#h8}
> **Status:** ✅ FIXED

**Severity:** HIGH  
**Impact:** Loyalty dashboard shows users incorrect coin balances. Mission thresholds operate on stale data.

**What is happening:**  
`UserLoyalty.ts` (lines 49–58) maintains its own `coins.available` counter with a local `history[]` array. `CoinTransaction.getUserBalance()` was redirected to read from `Wallet.balance.available`. There is no code path that keeps `UserLoyalty.coins.available` in sync with either:
- `Wallet.balance.available`
- CoinTransaction aggregates

Any UI component displaying `UserLoyalty.coins.available` shows potentially incorrect data.

**Files involved:**
- `rezbackend/rez-backend-master/src/models/UserLoyalty.ts` (lines 49–58)
- `rezbackend/rez-backend-master/src/models/CoinTransaction.ts` (line 386–389)

**Fix:**  
Deprecate `UserLoyalty.coins.available` as a stored field. Compute it on-the-fly from `Wallet.balance.available` in the loyalty query resolver, or add a post-save hook on `Wallet` that updates `UserLoyalty.coins.available`.

---

## H11 — `prive` coins silently reclassified as `rez` in ledger writes {#h11}
> **Status:** ✅ FIXED

**Severity:** HIGH  
**Impact:** Prive coin liabilities invisible in audit trails. Premium coin semantics lost. Ledger schema differs between monolith and microservice.

**What is happening:**  
`rezbackend/src/services/walletService.ts` (lines 68–71) normalizes `prive → rez` before writing ledger entries:
```typescript
const coinType: LedgerCoinType = rawCoinType === 'prive' ? 'rez' : (rawCoinType as LedgerCoinType);
```
The wallet microservice does NOT apply this normalization. So:
- Backend-written ledger entries: prive coins show as `rez`
- Microservice-written ledger entries: prive coins show as `prive`

Two different ledger schemas for the same coin type, in the same collection.

**Files involved:**
- `rezbackend/rez-backend-master/src/services/walletService.ts` (lines 68–71)
- `rez-wallet-service/src/services/walletService.ts` (no normalization)

**Fix:**  
Remove the `prive → rez` normalization from the monolith. `LedgerEntry.coinType` already includes `prive` as a valid value — use it correctly.

---

## H13 — `Wallet.currency` default mismatch between backend and wallet-service {#h13}
> **Status:** ✅ FIXED

**Severity:** HIGH  
**Impact:** Backend rejects wallet-service-created documents on re-save. Mixed currency values in production.

**What is happening:**  
- `rezbackend/Wallet.ts` (line 279): `enum: ['RC', 'NC', 'REZ_COIN', 'INR']`, default `'RC'`
- `rez-wallet-service/Wallet.ts` (line 80): `default: 'REZ_COIN'`, no enum constraint

Wallets created by the wallet service default to `'REZ_COIN'`. When the backend reads and re-saves such a document, the `enum` validator passes (REZ_COIN is in the list). However, the default mismatch means existing production data has mixed `'RC'` and `'REZ_COIN'` values, causing inconsistent filtering.

**Files involved:**
- `rezbackend/rez-backend-master/src/models/Wallet.ts` (line 279)
- `rez-wallet-service/src/models/Wallet.ts` (line 80)

**Fix:**  
Standardize on `'REZ_COIN'` as the canonical value. Update backend default to `'REZ_COIN'`. Run migration to normalize existing `'RC'` values.

---

## M5 — `MerchantLoyaltyConfig` schema duplicated byte-for-byte in two services {#m5}
> **Status:** ⏳ DEFERRED — rez-shared migration requires coordinated deploy; tracked as tech debt

**Severity:** MEDIUM  
**Impact:** One missed migration = permanent divergence. No single source of truth.

**What is happening:**  
`rezbackend/src/models/MerchantLoyaltyConfig.ts` and `rez-merchant-service/src/models/MerchantLoyaltyConfig.ts` are byte-for-byte identical. They target the same implied collection name (`merchantloyaltyconfigs`). Any schema migration must be applied in both places. There is no enforcement mechanism.

**Fix:**  
Move to `rez-shared/src/models/MerchantLoyaltyConfig.ts`. Both services import from shared.

---

## M6 — `LoyaltyReward` uses `customerPhone` + `storeSlug` as identifiers instead of ObjectIds {#m6}
> **Status:** ⏳ DEFERRED — requires data migration; no LoyaltyReward writes in active use currently

**Severity:** MEDIUM  
**Impact:** Breaks on phone number format change, store rebrand, or international number prefix update. Orphaned reward records silently.

**What is happening:**  
`rezbackend/src/models/LoyaltyReward.ts` (lines 7–10):
```typescript
customerPhone: { type: String, required: true }
storeSlug: { type: String, required: true }
```
Every other loyalty/user model uses `Types.ObjectId` for user and store references. `storeSlug` is a mutable string — if a store rebrands, all its `LoyaltyReward` records are orphaned.

**Fix:**  
Replace `customerPhone` with `userId: ObjectId` (ref: `User`). Replace `storeSlug` with `storeId: ObjectId` (ref: `Store`). Provide a lookup path for legacy records via phone.

---

## Additional Schema Issues (No-Fix-Yet Category)

### Wallet fields missing from rez-wallet-service
The wallet microservice's `Wallet` model is missing 15+ fields that the backend uses:

| Category | Missing Fields |
|----------|---------------|
| Limits | `limits.dailySpend`, `limits.monthlySpend`, `limits.singleTransaction`, `limits.coinRedemptionPerTxn`, `limits.coinRedemptionPerDay`, `limits.withdrawalPerDay` |
| Settings | `settings.autoRedemption`, `settings.redemptionThreshold`, `settings.preferredCoinType`, `settings.notificationsEnabled`, `settings.roundUpEnabled`, `settings.roundUpCoinType`, `settings.savingsAutoSweep` |
| Audit | `frozenReason`, `frozenAt`, `lastTransactionAt` |
| Intelligence | `categoryBalances` (Map), `savingsInsights.topCategory`, `savingsInsights.topMerchant`, `savingsInsights.monthlyTrend`, `savingsInsights.weeklySpend` |
| Display | `coins[].color`, `coins[].label`, `coins[].lastUsed`, `coins[].lastEarned`, `coins[].promoDetails` |
| Branded | `brandedCoins[].merchantLogo`, `brandedCoins[].merchantColor`, `brandedCoins[].lastUsed` |

### CoinTransaction fields divergence between services

| Field | Backend | Wallet Service | Merchant Service |
|-------|---------|---------------|-----------------|
| `coinType` | YES (required) | YES (required) | NO (uses `coins: Number`) |
| `balance` | YES (required) | NO | NO |
| `balanceBefore` | NO | YES (required) | NO |
| `balanceAfter` | NO | YES (required) | NO |
| `coinStatus` | YES (locked/active/consumed/reversed) | NO | NO |
| `sourceId` | NO | YES (indexed) | NO |
| `settlementDate` | YES | NO | NO |

### Parallel fiat + coin ledger with no linking FK
`Transaction.ts` (fiat) and `CoinTransaction.ts` (coins) are separate collections with no foreign key. When a cashback is credited (CoinTransaction) and the fiat Transaction is recorded simultaneously, there is no transactional guarantee. They can diverge permanently.
