# Bug Report: Schema Divergence & Model Collision (Layer 6)

**Audit Date:** 2026-04-13
**Audit Method:** 5-agent parallel deep audit (DB models, API contracts, consumer app, admin/merchant panels, shared types)
**Layer:** MongoDB schema definitions, Mongoose models, cross-service model duplication
**Status:** CRITICAL — active DB corruption + data loss paths in production

---

## SD-01 — `TransactionAuditLog` same Mongoose model name, two incompatible schemas, same MongoDB collection {#sd-01}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Financial audit log data is actively corrupted. Compliance and fraud investigation queries return mixed, malformed documents.

**What is happening:**
Two separate services both register a Mongoose model named `"TransactionAuditLog"` but with completely different field schemas:

| Service | Fields | Purpose |
|---|---|---|
| `rezbackend` | userId, walletId, walletType, operation (11 types), amount, currency, balanceBefore/After (total/available/pending/cashback), reference, metadata, requestId, deviceFingerprint, ipAddress, geoLocation, ledgerPairId, status | Wallet audit trail — every coin debit/credit |
| `rez-payment-service` | action (10 types), paymentId, userId, merchantId, amount, previousStatus, newStatus, gatewayResponse, metadata, ipAddress, userAgent | Payment-specific audit trail |

Both write to the **same** MongoDB collection (Mongoose default: `transactionauditlogs`). A query on this collection returns a mix of wallet-op documents and payment-op documents. Fields like `walletId`, `operation`, `balanceBefore` are absent on payment documents. Fields like `paymentId`, `previousStatus`, `newStatus` are absent on wallet documents.

**Files involved:**
- `rezbackend/rez-backend-master/src/models/TransactionAuditLog.ts`
- `rez-payment-service/src/models/TransactionAuditLog.ts`

**Consequence:**
- Any audit report iterating over `transactionauditlogs` will throw runtime errors accessing missing fields
- Fraud detection queries that filter on `operation` or `balanceBefore` will silently exclude all payment-service entries
- Regulatory queries for a specific user's financial history are incomplete

**Fix required:**
Rename one model. Recommended:
- `rezbackend` model stays as `TransactionAuditLog` (collection: `transactionauditlogs`)
- `rez-payment-service` model renamed to `PaymentAuditLog` (collection: `paymentauditlogs`)
- One-time migration to move existing payment-service entries out of `transactionauditlogs`

---

## SD-02 — `Wallet` schema: 3 fields exist only in monolith, truncated on every microservice write {#sd-02}
> **Status:** ⏳ DEFERRED — full Wallet schema unification requires rez-shared migration; tracked for Phase 2

**Severity:** CRITICAL
**Impact:** User wallet intelligence data (spending limits, settings, category breakdowns) is permanently zeroed whenever the wallet microservice handles a write.

**What is happening:**

| Field | `rezbackend/models/Wallet.ts` | `rez-wallet-service/models/Wallet.ts` |
|---|---|---|
| `categoryBalances` | Map<string, {available, earned, spent}> | **ABSENT** |
| `limits` | {maxBalance, minWithdrawal, dailySpendLimit, dailySpent, lastResetDate} | **ABSENT** |
| `settings` | {autoTopup, autoTopupThreshold, autoTopupAmount, lowBalanceAlert, lowBalanceThreshold, smartAlertsEnabled, expiringCoinsAlertDays} | **ABSENT** |
| `statistics.totalRefunds` | present | **ABSENT** |
| `statistics.totalTopups` | present | **ABSENT** |
| `statistics.totalWithdrawals` | present | **ABSENT** |
| `savingsInsights.topCategory` | present | **ABSENT** |
| `savingsInsights.topMerchant` | present | **ABSENT** |
| `savingsInsights.monthlyTrend` | 12-item array | **ABSENT** |
| `savingsInsights.weeklySpend` | present | **ABSENT** |
| `savingsInsights.savedVsAvgUser` | present | **ABSENT** |
| `savingsInsights.potentialMissedSavings` | present | **ABSENT** |
| `savingsInsights.favoriteStores` | array | **ABSENT** |
| `currency` default | `'RC'` | `'REZ_COIN'` |
| `coins[].type` | CoinType (6 values) | `'rez'|'prive'|'branded'|'promo'` (4 values) |

When the wallet microservice writes a wallet document, all absent fields are either unset or their existing values are not preserved. The monolith later reads empty/null for `categoryBalances`, `limits`, and `settings`.

**Files involved:**
- `rezbackend/rez-backend-master/src/models/Wallet.ts`
- `rez-wallet-service/src/models/Wallet.ts`

**Fix required:**
Move canonical `Wallet` schema to `rez-shared`. Both services import from it. Never define schema fields independently per service.

---

## SD-03 — `CoinTransaction` schema: idempotency non-unique in wallet microservice {#sd-03}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Coin double-credits possible via the wallet microservice path. Idempotency protection works only on monolith path.

**What is happening:**

| Field | `rezbackend/models/CoinTransaction.ts` | `rez-wallet-service/models/CoinTransaction.ts` |
|---|---|---|
| `idempotencyKey` index | unique sparse | **non-unique** (just indexed, not unique) |
| `balance` (legacy snapshot) | present, required for backward compat | **ABSENT** |
| `coinStatus` | `'locked'|'active'|'consumed'|'reversed'` | **ABSENT** |
| `settlementDate` | present | **ABSENT** |
| `category` | 12 MainCategory slugs | **ABSENT** |
| `sixHourWarningSent` | present | **ABSENT** |
| `twentyFourHourWarningSent` | present | **ABSENT** |
| `idempotencyKey` uniqueness | enforced | NOT enforced |

A retry of the same coin credit through the wallet microservice path will insert a duplicate record. The monolith path correctly rejects duplicates.

**Files involved:**
- `rezbackend/rez-backend-master/src/models/CoinTransaction.ts`
- `rez-wallet-service/src/models/CoinTransaction.ts`

---

## SD-04 — Ghost `User` proxy in `rez-merchant-service` writes directly to `users` collection with `strict: false` {#sd-04}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** The merchant service can write arbitrary, unvalidated fields directly into user documents. Any field name collision overwrites legitimate user data silently.

**What is happening:**
`rez-merchant-service/src/models/User.ts` defines a Mongoose User model with `strict: false`. This means any fields passed to this model's `save()`/`updateOne()` are written as-is to the `users` MongoDB collection — bypassing all validation, required checks, and type enforcement defined in the canonical `rezbackend/models/User.ts`.

The file itself contains a comment flagging this as "DB-02 audit issue." It writes `patchTests` data into the shared `users` collection via this unvalidated path.

**Files involved:**
- `rez-merchant-service/src/models/User.ts` (ghost proxy, `strict: false`)
- `rezbackend/rez-backend-master/src/models/User.ts` (canonical, strictly validated)

**Fix required:**
Remove the ghost User model from rez-merchant-service. All user writes must go through the monolith's `/api/user` service layer. The merchant service must call the monolith's internal API, not write to `users` directly.

---

## SD-05 — `MerchantWallet` embedded `transactions` array: migration half-applied {#sd-05}
> **Status:** ⏳ DEFERRED — monolith schema cleanup requires coordinated migration; ongoing

**Severity:** HIGH
**Impact:** MerchantWallet documents read by the monolith include embedded `transactions[]`. Documents written/updated by the wallet microservice lose the embedded array. Both coexist in the same collection with inconsistent document shapes.

**What is happening:**
MW-FIX-001 migration removed the embedded `transactions` array from `MerchantWallet` in the wallet microservice. The monolith still has the embedded array for backward compatibility. Documents have divergent structure depending on which service last touched them.

**Files involved:**
- `rezbackend/rez-backend-master/src/models/MerchantWallet.ts` (still has `transactions[]`)
- `rez-wallet-service/src/models/MerchantWallet.ts` (already removed `transactions[]`)

**Fix required:**
Complete the migration: remove embedded `transactions[]` from the monolith's `MerchantWallet` schema. Ensure the separate `MerchantWalletTransaction` collection is used exclusively.

---

## SD-06 — `Payment` FSM: state machine enforcement split across two services {#sd-06}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** A payment status transition that is allowed by one service but not the other will succeed via one path and fail via another. Race conditions in payment state are possible.

**What is happening:**
The `VALID_TRANSITIONS` FSM for Payment status is defined in two places:
- `rezbackend/models/Payment.ts`: imports from `shared/financialStateMachine.ts`
- `rez-payment-service/models/Payment.ts`: defines its own local `VALID_TRANSITIONS` map

The two maps may differ. If the monolith allows a transition that the payment service blocks (or vice versa), concurrent calls to both services produce inconsistent payment states.

**Files involved:**
- `rezbackend/rez-backend-master/src/models/Payment.ts`
- `rez-payment-service/src/models/Payment.ts`
- `rezbackend/rez-backend-master/src/shared/financialStateMachine.ts`

**Fix required:**
Export `VALID_TRANSITIONS` from `rez-shared`. Both services import from this single definition. Delete the local copy in `rez-payment-service`.

---

## SD-07 — `Wallet.currency` default value mismatch: `'RC'` vs `'REZ_COIN'` {#sd-07}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Mixed `currency` values across wallet documents in the same collection. Any query filtering `currency === 'RC'` misses wallet-service-created documents. Any query filtering `currency === 'REZ_COIN'` misses monolith-created documents.

**What is happening:**
- `rezbackend/models/Wallet.ts`: `currency: { type: String, required: true, default: 'RC' }`
- `rez-wallet-service/models/Wallet.ts`: `currency: { type: String, default: 'REZ_COIN' }`

Both services write to the same `wallets` collection. The field has two different values depending on which service created the document.

**Files involved:**
- `rezbackend/rez-backend-master/src/models/Wallet.ts`
- `rez-wallet-service/src/models/Wallet.ts`

---

## SD-08 — Duplicate `rez-shared` package in two paths — one change away from silent type split {#sd-08}
> **Status:** ⏳ DEFERRED — package consolidation requires build pipeline changes; tracked

**Severity:** MEDIUM
**Impact:** Any unmirrored change to either package causes silent type divergence across all frontends without compilation errors.

**What is happening:**
Two npm packages contain identical source files:
- `/rez-shared/src/` 
- `/packages/rez-shared/src/`

Currently identical by coincidence. If one is updated and the other is not (e.g., a PR updates `/rez-shared/` but not `/packages/rez-shared/`), all apps importing from the non-updated package silently use stale types.

**Files involved:**
- `/rez-shared/src/types/`
- `/packages/rez-shared/src/types/`

**Fix required:**
Delete one package. Make the remaining one the single canonical source. Update all `package.json` imports to reference it. Add a CI check that prevents both packages from existing simultaneously.

---

## SD-09 — Merchant model duplicated in `rez-merchant-service`: `lastLogin` deprecation inconsistency {#sd-09}
> **Status:** ⏳ DEFERRED — low risk; cleanup tracked as tech debt

**Severity:** LOW
**Impact:** `lastLogin` is populated by the merchant service (not deprecated), but the monolith's copy is marked `@deprecated` pointing to `lastLoginAt`. Merchant documents will have stale/wrong `lastLogin` values depending on write path.

**What is happening:**
- `rezbackend/models/Merchant.ts`: `lastLogin` marked `@deprecated`, canonical field is `lastLoginAt`
- `rez-merchant-service/models/Merchant.ts`: `lastLogin` still in active use (not deprecated)

Any login handled by the merchant service updates `lastLogin`. Monolith code reading `lastLoginAt` sees stale data for those sessions.

**Files involved:**
- `rezbackend/rez-backend-master/src/models/Merchant.ts`
- `rez-merchant-service/src/models/Merchant.ts`
