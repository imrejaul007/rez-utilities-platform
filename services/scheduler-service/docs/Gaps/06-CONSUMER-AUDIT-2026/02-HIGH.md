# Gaps: Consumer App HIGH Issues — Audit 2026-04-16

**24 HIGH Issues — Fix within 1 sprint**

---

## Financial Logic

### NA-HIGH-01: Coin Formula Off by Factor of 10 in REZ Now

**Severity:** HIGH
**File:** `rez-now/app/[storeSlug]/pay/checkout/page.tsx:126`
**Category:** Business Logic
**Gap ID:** NA-HIGH-01
**Status:** FIXED (2026-04-17) — Removed spurious `/ 10` from coin formula in rez-now checkout
**Est Fix:** 10 minutes
**Related:** CA-GAM-### (prior gamification)

### Description
Formula: `Math.floor((effectiveAmount / 100 / 10) * ((baseCashbackPercent || 0) / 100))`
Divides by 100 AND by 10. For a Rs.100 payment with 10% cashback: `(100/100/10)*(10/100) = 0.1` coins (floors to 0).

### Root Cause
Accidental double-division. The `/ 100` converts paise to rupees. The extra `/ 10` was likely a copy-paste error.

### Impact
All estimated coin previews on Scan & Pay checkout show **0 or near-0 coins** for most payment amounts. Users see misleading "You'll earn ~0 REZ coins" messages.

### Fix Direction
Remove the `/ 10`: `Math.floor((effectiveAmount / 100) * ((baseCashbackPercent || 0) / 100))`

---

### NA-HIGH-02: `rewardsPreview` Formula Up to 50% Inaccurate

**Severity:** HIGH
**File:** `hooks/usePaymentFlow.ts:185-202`
**Category:** Business Logic
**Gap ID:** NA-HIGH-02
**Status:** ACTIVE
**Est Fix:** 3 hours
**Related:** CA-GAM-### (prior gamification)

### Description
`rewardsPreview.coinsToEarn` computed as `Math.floor((billAmount * baseRatePct) / 100)` using only `store.rewardRules.baseCashbackPercent`. The backend's `cashbackEngine` applies category baseRate (2.5-6%), subscription multiplier (1x-3x), Prive multiplier (1x-2x), and a 15% hard cap. The discrepancy can be up to 50%.

### Root Cause
No shared calculation library. Each module implements its own financial math. A TODO at lines 195-197 says: "Replace with a server-side preview call."

### Impact
Users see "You will earn X coins" estimate that is materially wrong. A user expecting 50 coins based on displayed estimate but earning only 25 (due to the 15% cap) feels cheated.

### Fix Direction
Replace flat formula with server-side preview: `GET /api/wallet/cashback-preview?billAmount=X&storeId=Y&category=Z` returning `{ estimatedCoins, appliedRate, multiplier }`. Until that endpoint exists, show a range.

---

### NA-HIGH-03: karma Credits `'rez'` Coins But Queries `'karma_points'`

**Severity:** HIGH
**File:** `rez-karma-service/src/services/walletIntegration.ts:115-134`
**Category:** Business Logic / Type Drift
**Gap ID:** NA-HIGH-03
**Status:** FIXED (2026-04-17) — Same fix as P0-FIX-4: walletIntegration.ts now queries `CoinType.REZ`, karmaRoutes.ts added
**Est Fix:** 30 minutes
**Related:** G-KS-B### (karma backend), G-CR-X### (cross-ref)

### Description
`getKarmaBalance()` queries the wallet service for `coinType: 'karma_points'` (line 120), but `creditUserWallet()` credits coins with `coinType: 'rez'` (called from batchService with `'rez'`). These are **two different `CoinType` values**.

### Root Cause
The karma-to-coin conversion credits `rez` coins but the balance query looks for `karma_points`. These are not the same `CoinType`.

### Impact
`getKarmaBalance()` will **always return 0** because it queries the wrong coin type. Any display of karma coin balance in the consumer app is always wrong.

### Fix Direction
Align coinType across both functions. Check the wallet service's actual `CoinType` enum and use the correct value in both places.

---

### NA-HIGH-04: `adjustBalance` Can Go Negative

**Severity:** HIGH
**File:** `stores/walletStore.ts:70-88`
**Category:** Edge Case / Missing Validation
**Gap ID:** NA-HIGH-04
**Status:** FIXED (2026-04-17) — Added `Math.max(0, ...)` floor guard on all 4 balance fields in walletStore adjustBalance
**Est Fix:** 15 minutes
**Related:** CA-PAY-004 (prior wallet)

### Description
`adjustBalance(delta)` adds `delta` to `rezBalance`, `totalBalance`, and `availableBalance` **without checking if the result would go negative**. No floor check at `Math.max(0, ...)`.

### Root Cause
Optimistic update applies delta blindly.

### Impact
A race condition where `adjustBalance(-500)` is called but the backend only approved 100 coins could leave the client showing a **negative balance**.

### Fix Direction
Add guard: `const newBalance = Math.max(0, currentBalance + delta);`

---

### NA-HIGH-05: Visit Milestone Dedup Key Has 1-Second Collision Window

**Severity:** HIGH
**File:** `rez-wallet-service/src/services/walletService.ts`; `rez-gamification-service/src/httpServer.ts`
**Category:** Race Condition
**Gap ID:** NA-HIGH-05
**Status:** ACTIVE
**Est Fix:** 30 minutes

### Description
`Math.floor(Date.now() / 1000)` resets the dedup key every second. Two concurrent visit events for the same user and milestone within the same second produce **identical dedup keys**.

### Root Cause
The 1-second resolution creates a collision window. If the wallet service credits coins while the gamification service processes the same visit, the second event within the same second gets silently deduplicated, preventing the milestone reward from being credited.

### Impact
Users **lose milestone coin rewards** when multiple visits are recorded within the same second. Coins owed are silently lost.

### Fix Direction
Use `Date.now()` at millisecond resolution or append a UUID component to the dedup key.

---

### NA-HIGH-06: Rewards Hook Idempotency Silent Drop

**Severity:** HIGH
**File:** `rez-finance-service/src/services/rewardsHookService.ts`
**Category:** Race Condition / Financial
**Gap ID:** NA-HIGH-06
**Status:** ACTIVE
**Est Fix:** 2 hours

### Description
Idempotency key is built from `[event, userId, referenceId]`. If the first call to the wallet service fails (network timeout), the caller retries. The retry uses the same idempotency key — the second call succeeds at rewardsHook level but the wallet service already processed it. However, if the wallet service timed out **without writing the ledger entry**, the retry silently drops.

### Root Cause
The idempotency check is applied BEFORE the wallet service call, not as a distributed two-phase commit. The key is written (claiming idempotency) even if the downstream write fails.

### Impact
Users **do not receive coins** from financial events (loan disbursement, credit card signup, BNPL activation) when the wallet service call fails on first attempt.

### Fix Direction
Use idempotency as a check AFTER the downstream call succeeds, or use a distributed transaction pattern where the wallet service owns the idempotency key for its own writes.

---

### NA-HIGH-07: Floating-Point Truncation on Coin Redemption

**Severity:** HIGH
**File:** `app/bill-payment.tsx`
**Category:** Business Logic / Rounding
**Gap ID:** NA-HIGH-07
**Status:** FIXED (2026-04-17) — Replaced all 4 `Math.floor` with `Math.round` on redemption cap calculations in bill-payment.tsx
**Est Fix:** 1 hour
**Related:** CA-PAY-002 (prior float precision)

### Description
`Math.floor((fetchedBill.amount * (selectedProvider.maxRedemptionPercent / 100)))` uses raw floating-point arithmetic. `1000 * 0.07 = 70.0000000004`, `Math.floor` truncates to 70 (off by 1 from the mathematically correct 71). For amounts like `577 * 0.05 = 28.85`, users see 28 redeemable coins instead of expected 29.

### Root Cause
IEEE 754 floating point does not exactly represent most decimal fractions. `Math.floor` truncates the tiny epsilon upward error downward.

### Impact
Users told they can redeem fewer coins than the provider's percentage allows. At scale (millions of transactions), this creates **systematic under-redemption**.

### Fix Direction
Use integer arithmetic: `(fetchedBill.amountInPaise * maxRedemptionPercent) / 100`, then `Math.round` (not floor).

---

### NA-HIGH-08: Hardcoded Day Reward Values

**Severity:** HIGH
**File:** `services/gamificationApi.ts`
**Category:** Business Logic / Hardcoded
**Gap ID:** NA-HIGH-08
**Status:** FIXED (2026-04-17) — Removed hardcoded dayRewards fallback in gamificationApi.ts; returns empty array on failure
**Est Fix:** 1 hour

### Description
`dayRewards: [10, 15, 20, 25, 30, 40, 100]` are hardcoded as fallback values when the server does not return check-in data. The server may have updated these values, but the app ignores the server response.

### Impact
Users see incorrect coin reward amounts. If rewards were reduced server-side, users continue expecting higher amounts.

### Fix Direction
Remove hardcoded fallback entirely. Show "Rewards unavailable" when server is unreachable.

---

### NA-HIGH-09: Leaderboard Rank Off-by-One

**Severity:** HIGH
**File:** `rez-gamification-service/src/httpServer.ts`
**Category:** Business Logic / Formula
**Gap ID:** NA-HIGH-09
**Status:** ACTIVE
**Est Fix:** 1 hour

### Description
Users see their leaderboard rank as **1 higher than their actual position**. The formula `rank: start + i + 1` creates a 1-off error throughout the slice.

### Impact
Every user sees their displayed rank as 1 higher (worse) than reality. Users may think they need more activity to reach a tier.

### Fix Direction
Compute absolute rank directly from the sorted array index. Change `rank: start + i + 1` to `rank: userIndex + 1`.

---

## Architecture & Code Quality

### NA-HIGH-10: Missing `utils/apiUtils.ts` — 6+ Services Crash

**Severity:** HIGH
**Files:** `services/authApi.ts:6`, `services/cartApi.ts`, `services/offersApi.ts`, `services/wishlistApi.ts`, `services/profileApi.ts`, `services/productApi.ts`, `services/homepageApi.ts`
**Category:** Missing File / Build Failure
**Gap ID:** NA-HIGH-10
**Status:** ACTIVE
**Est Fix:** 1 hour

### Description
All these files import `withRetry`, `createErrorResponse`, `logApiRequest`, `logApiResponse` from `@/utils/apiUtils`. This file **does not exist**.

### Impact
TypeScript compilation fails or runtime crashes on every API call in these services.

### Fix Direction
Create `utils/apiUtils.ts` exporting these utilities, or wire them into existing `logger.ts`/`errorReporter.ts` and update all imports.

---

### NA-HIGH-11: Duplicate Service Pairs — Migration Never Completed

**Severity:** HIGH
**Files:**
- `services/orderApi.ts` + `services/ordersApi.ts` (orderApi is `@deprecated`)
- `services/productApi.ts` + `services/productsApi.ts` (productApi is homepage-only)
- `services/reviewApi.ts` + `services/reviewsApi.ts` (reviewApi is `@deprecated`)

**Category:** Architecture / Duplicate Code
**Gap ID:** NA-HIGH-11
**Status:** ACTIVE
**Est Fix:** 2 hours

### Description
Three pairs of services with overlapping functionality. Deprecations are only documented in comments — nothing prevents new code from importing the wrong one.

### Impact
Developers accidentally import deprecated service, get wrong types or inconsistent data.

### Fix Direction
Delete deprecated files. Add a build-time check that errors on deprecated imports.

---

### NA-HIGH-12: Wallet Store + WalletContext Conflicting Data Sources

**Severity:** HIGH
**Files:** `stores/walletStore.ts` + `contexts/WalletContext.tsx`
**Category:** Architecture / No Source of Truth
**Gap ID:** NA-HIGH-12
**Status:** ACTIVE
**Est Fix:** 4 hours
**Related:** G-KS-A### (karma backend), CA-INF-### (prior infra)

### Description
`walletStore.ts` comment at line 6 says "State types (mirrors WalletContext)". The store has `refreshWallet` defined as a **noop `async () => {}`** — the real implementation lives in `WalletContext`. But `_setFromProvider` overwrites everything on every render, meaning the store is only as fresh as the context's render cycle.

### Root Cause
Zustand was introduced for selector performance but underlying state still lives in Context, creating a two-layer architecture with undefined priority.

### Impact
If `WalletContext` fails to mount, the store retains stale data with noop actions. Any code calling `useWalletStore.getState().refreshWallet()` silently does nothing.

### Fix Direction
Consolidate to ONE source: either Zustand store with actual API calls, or Context with Zustand selectors. Remove the dual-pattern entirely.

---

### NA-HIGH-13: Duplicate Coin Calculation Logic in 4+ Locations

**Severity:** HIGH
**Files:** `services/earningsCalculationService.ts`, `hooks/usePaymentFlow.ts`, `hooks/useCheckoutUI.ts`, `services/paymentService.ts`
**Category:** Architecture / Duplicate Code
**Gap ID:** NA-HIGH-13
**Status:** ACTIVE
**Est Fix:** 3 hours
**Related:** NA-HIGH-01, NA-HIGH-02 (prior), CA-GAM-### (prior)

### Description
Coin/cashback calculations scattered across 4+ locations. `usePaymentFlow.rewardsPreview` has an explicit TODO: "Replace with a server-side preview call." Current formula can be off by up to 50%.

### Impact
Different parts of the app show different "coins earned" values.

### Fix Direction
Create a single `coinCalculationService` in `rez-shared` with canonical formulas. All consumers import from one place.

---

### NA-HIGH-14: 56 `any` Type Occurrences Across 17 Store Files

**Severity:** HIGH
**Files:** Every store file (`brandedCoins: any[]`, `variant: any`, raw API responses cast to `any`)
**Category:** Type Safety
**Gap ID:** NA-HIGH-14
**Status:** ACTIVE
**Est Fix:** 8+ hours
**Related:** CA-API-### (prior API contracts)

### Description
`any` bypasses TypeScript's type system entirely. Unvalidated API response data is stored without type checking.

### Impact
A backend change adding a new field with wrong type silently corrupts in-memory state with no TypeScript error.

### Fix Direction
Define strict interfaces for all API response shapes. Use `zod` for runtime validation. Replace `any` with discriminated unions.

---

### NA-HIGH-15: `hotelOtaApi.ts` Bypasses All API Infrastructure

**Severity:** HIGH
**File:** `services/hotelOtaApi.ts:156-168`
**Category:** Integration / Missing Infrastructure
**Gap ID:** NA-HIGH-15
**Status:** ACTIVE
**Est Fix:** 30 minutes
**Related:** CA-API-### (prior API contracts)

### Description
`otaFetch()` uses raw `fetch()` with **no timeout, no retry, no auth token injection, no Sentry reporting, no circuit breaker**.

### Impact
If Hotel OTA is slow or down, the app hangs indefinitely with no error shown. Failed requests are not reported to Sentry.

### Fix Direction
Add `AbortController` timeout (15s), retry once on 5xx errors, wrap errors with Sentry reporting.

---

### NA-HIGH-16: Silent Error Swallowing Across All Service Files

**Severity:** HIGH
**Files:** ALL service files (`cacheService.ts`, `homepageDataService.ts`, `imageCacheManager.ts`, `imageCacheService.ts`, `productCacheService.ts`, `searchCacheService.ts`, `gamificationCacheService.ts`, etc.)
**Category:** UX / Error Handling
**Gap ID:** NA-HIGH-16
**Status:** ACTIVE
**Est Fix:** 4-6 hours
**Related:** CA-INF-### (prior infra)

### Description
Every async operation wraps errors with `catch (_error) { /* silently handle */ }`. Cache misses, API failures, and storage errors are **completely invisible** to users and developers.

### Impact
Users see blank screens with no explanation. Developers cannot debug production issues.

### Fix Direction
Replace silent catches with error reporting via centralized logger, surface user-friendly messages, add error boundaries for cache service failures.

---

### NA-HIGH-17: Inconsistent 0-Amount Validation

**Severity:** HIGH
**Files:** `app/payment.tsx` (has `amount > 0` check) vs `app/pay-in-store/enter-amount.tsx` (no lower-bound)
**Category:** Edge Case / Missing Validation
**Gap ID:** NA-HIGH-17
**Status:** ACTIVE
**Est Fix:** 1 hour
**Related:** CA-PAY-005 (prior validation)

### Description
Some screens reject 0-amount, others silently pass it to the backend.

### Impact
Zero-amount transactions could bypass payment processing, creating free coin credits.

### Fix Direction
Create a shared `validateAmount` utility in `rez-shared/utils` and enforce at the `apiClient` layer for payment endpoints.

---

### NA-HIGH-18: Store Visit Queue Button Permanently Disabled

**Severity:** HIGH
**File:** `app/store-visit.tsx`
**Category:** Functional
**Gap ID:** NA-HIGH-18
**Status:** ACTIVE
**Est Fix:** 1 hour
**Related:** CA-CMC-### (prior commerce)

### Description
"Get Queue" button uses `(gettingQueue || !!queueNumber) && styles.buttonDisabled` — once `queueNumber` is set, the button remains visually disabled **permanently**. Payment method preference is also never sent to any API call.

### Impact
Users cannot get a new queue number on the same session. Payment method preference is silently ignored.

### Fix Direction
Separate loading state from result state. Use `isLoading` for the disabled condition. Include `paymentMethod` in API payloads.

---

## Security

### NA-HIGH-19: MD5 Used for Image Integrity Hash

**Severity:** HIGH
**File:** `services/billVerificationService.ts`; `services/imageHashService.ts:342`
**Category:** Security / Broken Crypto
**Gap ID:** NA-HIGH-19
**Status:** ACTIVE
**Est Fix:** 1 hour
**Related:** CA-SEC-002 (prior encryption)

### Description
`md5(imageBuffer)` used for bill image integrity hashing. MD5 is cryptographically broken — collision attacks are trivial.

### Exploit
Attacker creates two different images with the same MD5 hash, bypassing integrity check. Combined with NA-CRIT-02 (client-controlled amount), this enables mass cashback fraud.

### Fix Direction
Replace with SHA-256 or use the existing perceptual hash (which exists but appears unreachable in the current code path).

---

### NA-HIGH-20: IDOR on Bill and Transaction Access

**Severity:** HIGH
**Files:** `services/billVerificationService.ts`, `services/walletApi.ts`
**Category:** Security / IDOR
**Gap ID:** NA-HIGH-20
**Status:** ACTIVE
**Est Fix:** 2 hours
**Related:** CA-SEC-### (prior security)

### Description
`getBillById` and `getTransactionById` accept any bill/transaction ID **without verifying the authenticated user owns that record**.

### Impact
Any authenticated user can read any bill or transaction record by guessing or scraping IDs. GDPR/PDPA violation.

### Fix Direction
Add `userId: authenticatedUserId` to all query filters at the service layer.

---

### NA-HIGH-21: Auth Tokens Stored in localStorage (XSS-Vulnerable)

**Severity:** HIGH
**File:** `services/authStorage.ts:153-197`
**Category:** Security / Token Storage
**Gap ID:** NA-HIGH-21
**Status:** ACTIVE
**Est Fix:** 2 hours
**Related:** CA-SEC-003 (prior auth storage)

### Description
On web, `saveAuthToken` and `saveRefreshToken` write to `localStorage`. Any XSS vulnerability exposes all tokens immediately.

### Impact
XSS = full account takeover. JWT stored in localStorage accessible to any JavaScript on the page.

### Fix Direction
Use `httpOnly; Secure; SameSite=Strict` cookies for token storage. Or use `sessionStorage` (cleared on tab close) with short token rotation.

---

### NA-HIGH-22: Client-Side Fraud Detection with Complete Fail-Open

**Severity:** HIGH
**File:** `services/fraudDetectionService.ts:502,632`
**Category:** Security / Fail-Open
**Gap ID:** NA-HIGH-22
**Status:** ACTIVE
**Est Fix:** 3 hours
**Related:** CA-SEC-### (prior security)

### Description
`verifyInstagramAccount()` returns `isVerified: true` by default without any actual verification. `performFraudCheck()` returns `allowed: true` on any error — **complete fail-open**.

### Impact
An attacker who triggers any error in a fraud check is allowed through. Fake social media engagement drives earning rewards.

### Fix Direction
All fraud checks must be server-side. Client-side checks can exist for UX but must never be authoritative.

---

### NA-HIGH-23: Device Fingerprint Stored in AsyncStorage (Tamperable)

**Severity:** HIGH
**File:** `services/securityService.ts:191-204`
**Category:** Security / Device Trust
**Gap ID:** NA-HIGH-23
**Status:** ACTIVE
**Est Fix:** 2 hours
**Related:** CA-SEC-004 (prior device fingerprint)

### Description
Device fingerprint generated client-side using djb2 hash of simple properties, stored in AsyncStorage. Any app with same permissions can extract, modify, and reinstall.

### Impact
Device fingerprinting used for fraud detection is trivially spoofed. Multi-account fraud, device-banning evasion.

### Fix Direction
Device fingerprint must be signed or HMAC-verified by the server. Server should maintain device reputation based on behavioral signals.

---

### NA-HIGH-24: Circular Store Imports in `selectors.ts`

**Severity:** HIGH
**File:** `stores/selectors.ts:1-219`
**Category:** Architecture / Tight Coupling
**Gap ID:** NA-HIGH-24
**Status:** ACTIVE
**Est Fix:** 2 hours

### Description
`selectors.ts` imports from 8 different stores. This is the highest-concentration import point in the codebase. Any circular import in a store **breaks ALL selectors**.

### Impact
A circular dependency in any one store would crash the entire selector module, breaking all components that import any selector.

### Fix Direction
Split into per-store selector files (`auth.selectors.ts`, `wallet.selectors.ts`, etc.). Only import what each component needs. This limits blast radius.

---

## Status Table

| ID | Status | Fix Priority | Owner |
|----|--------|-------------|-------|
| NA-HIGH-01 | ACTIVE | P1 | ? |
| NA-HIGH-02 | ACTIVE | P1 | ? |
| NA-HIGH-03 | ACTIVE | P1 | ? |
| NA-HIGH-04 | **FIXED** | — | 2026-04-17 |
| NA-HIGH-05 | ACTIVE | P1 | ? |
| NA-HIGH-06 | ACTIVE | P1 | ? |
| NA-HIGH-07 | **FIXED** | — | 2026-04-17 |
| NA-HIGH-08 | **FIXED** | — | 2026-04-17 |
| NA-HIGH-09 | ACTIVE | P1 | ? |
| NA-HIGH-10 | ACTIVE | P1 | ? |
| NA-HIGH-11 | ACTIVE | P1 | ? |
| NA-HIGH-12 | ACTIVE | P1 | ? |
| NA-HIGH-13 | ACTIVE | P1 | ? |
| NA-HIGH-14 | ACTIVE | P2 | ? |
| NA-HIGH-15 | ACTIVE | P1 | ? |
| NA-HIGH-16 | ACTIVE | P2 | ? |
| NA-HIGH-17 | ACTIVE | P1 | ? |
| NA-HIGH-18 | ACTIVE | P1 | ? |
| NA-HIGH-19 | ACTIVE | P1 | ? |
| NA-HIGH-20 | ACTIVE | P1 | ? |
| NA-HIGH-21 | ACTIVE | P1 | ? |
| NA-HIGH-22 | ACTIVE | P2 | ? |
| NA-HIGH-23 | ACTIVE | P2 | ? |
| NA-HIGH-24 | ACTIVE | P2 | ? |
