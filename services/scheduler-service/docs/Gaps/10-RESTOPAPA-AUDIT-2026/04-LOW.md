# Gen 14 — LOW Severity Issues (17 issues)

**Generated:** 2026-04-16 | **Status:** All OPEN

---

## Enum Issues

### RP-L01: Order Confirmation Checks 'paid' but Canonical Uses 'completed'
**File:** `rez-app-consumer/app/order/[storeSlug]/confirmation.tsx:253`
**Issue:** `{order.status !== 'cancelled' && !['pending_payment', 'paid'].includes(order.status)` — this checks for `'paid'` but the canonical schema uses `'completed'`. If backend returns `'completed'`, the confirmation screen shows prematurely.
**Est. Fix:** 0.25h — Normalize to canonical `'completed'` and update filter.

### RP-L02: Creator Payout Uses 'paid' vs Canonical 'completed'
**File:** `rez-app-admin/app/(dashboard)/creators.tsx:614-624`
**Issue:** Creator payouts use `item.status === 'paid'` while canonical uses `'completed'`. Creator payout status filters could miss records.
**Est. Fix:** 0.25h — Align with canonical statuses.

### RP-L03: Creator Payout Status Uses 'PAID' (Uppercase) vs 'Paid'
**File:** `rez-app-admin/app/(dashboard)/creators.tsx` (payroll section)
**Issue:** `'PAID'` (uppercase) vs `'Paid'` (title case) inconsistency. Payroll processes use uppercase, display uses mixed case.
**Est. Fix:** 0.25h — Standardize to one casing convention.

### RP-L04: Multiple normalizeOrderStatus Implementations
**Issue:** Three competing `normalizeOrderStatus` implementations across the codebase, each with slightly different behavior.
**Est. Fix:** 1h — Merge to single shared implementation in `@rez/shared`.

---

## Architecture Issues

### RP-L05: Batch Stats Route Uses Raw MongoDB Aggregation
**File:** `rez-karma-service/src/routes/batchRoutes.ts`
**Issue:** Batch stats endpoint uses raw MongoDB aggregation pipeline instead of a service layer.
**Est. Fix:** 0.5h — Move aggregation to service layer.

### RP-L06: Duplicate Package in Two Paths
**Files:** `/rez-shared/src/` + `/packages/rez-shared/src/`
**Issue:** Two npm packages contain identical source files. Currently identical by coincidence. Any unmirrored change causes silent type divergence.
**Est. Fix:** 2h — Consolidate to one package. Migrate all consumers to the canonical path.

### RP-L07: startOfWeek IST Offset Not Applied in Weekly Cap Decay
**File:** `rez-karma-service/src/services/karmaService.ts`
**Issue:** Streak workers use IST helper functions (`getISTDateString()`, `isNextISTDay()`) but weekly cap computation uses UTC dates. Cap resets ~11h off for Indian users.
**Est. Fix:** 0.5h — Apply IST offset consistently across all date computations.

### RP-L08: Karma Conversion Rate Hardcoded Instead of Engine Call
**File:** `rez-karma-service/src/routes/karmaRoutes.ts`
**Issue:** Inline hardcoded conversion rate values (L1→0.25, L2→0.5, L3→0.75, L4→1.0) instead of calling `getConversionRate()` from engine. Two sources of truth.
**Est. Fix:** 0.5h — Same as RP-H11, consolidate here.

### RP-L09: Wallet Microservice Missing 3+ Fields Truncated on Write
**File:** `rez-wallet-service/models/Wallet.ts`
**Issue:** Wallet microservice is missing `categoryBalances`, `limits`, `settings`, `savingsInsights`, `statistics` fields. Present in monolith, absent in microservice.
**Est. Fix:** 2h — Add missing fields to microservice schema. Migrate existing documents.

### RP-L10: Duplicate startOfWeek Computation
**File:** `rez-karma-service/src/services/karmaService.ts:128 and 195`
**Issue:** `startOfWeek` computed twice in the same function.
**Est. Fix:** 0.25h — Compute once at top of function.

---

## Edge Case Issues

### RP-L11: Math.random() in Jitter Logic (Non-Security)
**File:** `rez-app-consumer/services/billUploadQueueService.ts:724`
**Issue:** Uses `Math.random()` for retry jitter. Minor — jitter is cosmetic and non-security-critical.
**Est. Fix:** 0h — No fix needed for non-security jitter. Note: for anything security-sensitive, use `crypto.getRandomValues()`.

### RP-L12: Large Amount Transactions Not Validated
**Issue:** No upper bound validation on transaction amounts. Very large amounts could cause integer overflow or precision issues in some contexts.
**Est. Fix:** 0.5h — Add maximum amount validation.

### RP-L13: Zero Amount Transactions Accepted
**Issue:** Zero-amount transactions are accepted and processed. This is wasteful and could cause infinite loops in retry scenarios.
**Est. Fix:** 0.25h — Reject zero-amount transactions at validation layer.

---

## Data Sync Issues

### RP-L14: Phantom coins.available Balance Never Synced
**File:** `rezbackend/src/models/UserLoyalty.ts`
**Issue:** `UserLoyalty.coins.available` is maintained locally but never synced with actual wallet balance. UI using this field shows incorrect data.
**Est. Fix:** 1h — Remove phantom field or implement synchronization.

### RP-L15: Coin Type Normalization Lost in Service Writes
**File:** `rez-wallet-service/models/Wallet.ts`
**Issue:** Coin type normalization is lost when wallet service writes documents. Some coin types get reclassified.
**Est. Fix:** 1h — Add coin type validation at write time.

### RP-L16: Ledger Entry Missing for Prive Coin Transactions
**File:** `walletService.ts` (backend ledger)
**Issue:** Prive coin transactions are not recorded in the ledger. Audit trail is incomplete for prive coins.
**Est. Fix:** 0.5h — Add prive to LedgerEntry.coinType enum.

### RP-L17: Inconsistent Pagination Across Endpoints
**Issue:** Some endpoints use cursor-based pagination, others use offset-based. No consistent pagination strategy.
**Est. Fix:** 1h — Define and enforce a platform-wide pagination standard.
