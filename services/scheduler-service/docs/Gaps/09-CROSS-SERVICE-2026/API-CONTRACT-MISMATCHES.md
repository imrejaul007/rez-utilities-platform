# Cross-Service: API Contract Mismatches

**Date:** 2026-04-16
**Updated:** 2026-04-17 (Gen 16 vesper-app + API sweep added)
**Severity:** 3 CRITICAL, 15 HIGH, 8 MEDIUM (was: 3 CRITICAL, 14 HIGH, 6 MEDIUM)

---

## Overview

Frontend and backend don't agree on request/response shapes. 82 service files implement their own response-unwrapping heuristics. No shared contract enforcement.

---

## CS-A1 — Three Competing VoucherBrand Types (CRITICAL)

**Files:** `rez-app-admin/services/api/vouchers.ts` · `services/api/cashStore.ts`
**Also affects:** `A10-C2`

**Finding:**
Same `admin/vouchers` endpoint, three different field sets.

**Crosses:** admin frontend → backend

**Impact:** Runtime crash on pages using the wrong type definition.

---

## CS-A2 — CoinDrop Type Divergence (CRITICAL)

**Files:** `services/api/extraRewards.ts` · `services/api/cashStore.ts`
**Also affects:** `A10-H2`

**Finding:**
`storeId` is `string | object` in one, `string` only in the other.

**Crosses:** admin frontend → backend

**Impact:** Type mismatch causes crash.

---

## CS-A3 — DoubleCashbackCampaign minOrderValue Required vs Optional (HIGH)

**Files:** `services/api/extraRewards.ts` · `services/api/cashStore.ts`
**Also affects:** `A10-H3`

**Finding:**
`minOrderValue` is optional in `extraRewards.ts` but required in `cashStore.ts`.

**Crosses:** admin frontend → backend

**Impact:** Create/edit forms have inconsistent validation.

---

## CS-A4 — Same Endpoint, Opposite Query Param Names (HIGH)

**Files:** `services/api/extraRewards.ts` · `services/api/cashStore.ts`
**Also affects:** `A10-C3`

**Finding:**
`admin/coin-drops/stores` receives `?q=search` from one file and `?search=search` from another.

**Crosses:** admin frontend → backend

**Impact:** Store search always returns unfiltered results for whichever file is wrong.

---

## CS-A5 — Order Refund Modal Field Names Wrong (HIGH)

**File:** `app/(dashboard)/orders.tsx:971, 973, 979`
**Also affects:** `A10-C8`

**Finding:**
- `selectedOrder.id` → should be `selectedOrder._id` or `orderNumber`
- `selectedOrder.totalAmount` → should be `selectedOrder.totals.total`
- `selectedOrder.customerName` → doesn't exist at all

**Crosses:** admin frontend ← backend

**Impact:** Admin sees "Order #undefined, Total: Rs. 0" before confirming refund.

---

## CS-A6 — Finance Service Wired to Non-Existent Routes (HIGH)

**File:** `rez-finance-service/src/services/creditIntelligenceService.ts:161`
**Also affects:** `CODEBASE_ISSUES_AUDIT.md` SEC-5A

**Finding:**
Finance calls `/internal/wallet/:userId` and `/internal/orders/summary/:userId` but wallet exposes `/internal/balance/:userId` and order doesn't expose the summary route.

**Crosses:** finance → wallet, order

**Impact:** Finance behavioral scoring silently falls back to zeros.

---

## CS-A7 — Finance Rewards Hook Wrong Endpoint + Wrong Fields (HIGH)

**File:** `rez-finance-service/src/services/rewardsHookService.ts:35`
**Also affects:** `CODEBASE_ISSUES_AUDIT.md` SEC-5A

**Finding:**
Finance posts to `/internal/coins/credit` but wallet exposes `/internal/credit` with required `coinType` field. Finance sends `event` field.

**Crosses:** finance → wallet

**Impact:** Coin rewards for loans, EMI bonuses, bill pay, recharge all fail silently.

---

## CS-A8 — Search Homepage Reads Non-Existent Wallet Fields (MEDIUM)

**File:** `rez-search-service/src/routes/homepageRoutes.ts:49`
**Also affects:** `CODEBASE_ISSUES_AUDIT.md` SEC-7A

**Finding:**
`/api/homepage/user-context` reads `coinBalance` and `totalSaved` from wallet root but wallet stores them as `balance.available` and `savingsInsights.totalSaved`.

**Crosses:** search → wallet

**Impact:** Homepage shows zero wallet balance even when wallet has funds.

---

## CS-A9 — Finance Approval Stats Uses Wrong Field (MEDIUM)

**File:** `rez-finance-service/src/services/loanService.ts:68`
**Also affects:** `CODEBASE_ISSUES_AUDIT.md` SEC-5A

**Finding:**
`partnerOfferId: application.partnerId` but `partnerOfferId` stores external offer ID while `application.partnerId` is the provider slug.

**Crosses:** finance internal

**Impact:** Approval metrics on partner offers always zero.

---

## CS-A10 — Coupon Store Search Wrong Param (MEDIUM)

**File:** `services/api/cashStore.ts:308`
**Also affects:** `A10-H1` (cache invalidation)

**Finding:**
`?q=search` sent but endpoint likely expects `?search=search`.

**Crosses:** admin frontend → backend

**Impact:** Coupon store search always returns all stores.

---

## CS-A11 — Order Status Filter Type Missing `'pending'` (MEDIUM)

**File:** `app/(dashboard)/orders.tsx:24`
**Also affects:** `A10-H4`

**Finding:**
`StatusFilter` type doesn't include `'pending'` but backend returns pending counts.

**Crosses:** admin frontend ← backend

**Impact:** Admins can't filter to pending orders.

---

## CS-A12 — `@/types/unified` Does Not Exist (CRITICAL)

**Files:** 7 consumer app files
**Gap ID:** NA-CRIT-04
**Severity:** CRITICAL

**Finding:**
`services/ordersApi.ts`, `services/cartApi.ts`, `services/storesApi.ts`, `services/productsApi.ts`, `services/authApi.ts`, `contexts/AuthContext.tsx`, `contexts/CartContext.tsx` all import from `@/types/unified`. This file **does not exist**.

**Crosses:** consumer app (build failure)

**Impact:** TypeScript compilation fails on all 7 files. App will not build.

---

## CS-A13 — 3 Independent Coin Sources with No Cross-Verification (HIGH)

**Files:** `services/walletApi.ts` · `services/pointsApi.ts` · `services/gamificationActions`
**Gap ID:** NA-MED-02
**Severity:** HIGH

**Finding:**
Wallet coins, Points API, and Gamification each maintain separate coin balances fetched independently. `pointsApi.getBalance()` falls back to wallet on 404, making comparison meaningless.

**Crosses:** consumer app (internal fragmentation)

**Impact:** Users see different coin balances in different places. No single source of truth.

---

## CS-A14 — Duplicate `TransactionMetadata` Interface Twice in Same File (MEDIUM)

**Files:** `services/walletApi.ts:130-156` AND `services/walletApi.ts:278-304`
**Gap ID:** NA-MED-09
**Severity:** MEDIUM

**Finding:**
Same `TransactionMetadata` interface defined twice in the same 1147-line file.

**Crosses:** consumer app (internal duplication)

---

## CS-A15 — hotelOtaApi Bypasses All API Infrastructure (HIGH)

**Files:** `services/hotelOtaApi.ts:156-168`
**Gap ID:** NA-HIGH-15
**Severity:** HIGH

**Finding:**
`otaFetch()` uses raw `fetch()` with **no timeout, no retry, no auth token injection, no Sentry reporting, no circuit breaker**.

**Crosses:** consumer app → Hotel OTA service

**Impact:** App hangs indefinitely if Hotel OTA is slow or down. Failed requests not reported.

---

## CS-A16 — 56 `any` Types Across 17 Store Files (HIGH)

**Files:** Every store file
**Gap ID:** NA-HIGH-14
**Severity:** HIGH

**Finding:**
`brandedCoins: any[]`, `variant: any`, raw API responses cast to `any`. TypeScript's type system bypassed entirely.

**Crosses:** consumer app (type safety)

**Impact:** Backend changes silently corrupt in-memory state.

---

## CS-A17 — Duplicate Service Pairs — Migration Never Completed (HIGH)

**Files:**
- `services/orderApi.ts` + `services/ordersApi.ts`
- `services/productApi.ts` + `services/productsApi.ts`
- `services/reviewApi.ts` + `services/reviewsApi.ts`
**Gap ID:** NA-HIGH-11
**Severity:** HIGH

**Finding:**
Three pairs of overlapping services. Deprecations only in comments — nothing prevents importing the wrong one.

**Crosses:** consumer app (internal architecture)

---

## Merchant App Gen 10 API Contract Issues

## CS-A-M1 — Order Type Mismatch in Two Interfaces (HIGH)

**File:** `rezmerchant/services/api/orders.ts:240`
**Also affects:** `G-MA-H22`

**Finding:**
Two separate `Order` interfaces in the same file have mismatched field names and types. The wrong interface is used in API calls.

**Crosses:** merchant app → backend

**Impact:** Order display/filter breaks silently when backend returns fields not in the active interface definition.

---

## CS-A-M2 — updateProfile Name Mapping Broken (HIGH)

**File:** `rezmerchant/services/api/auth.ts:183`
**Also affects:** `G-MA-H23`

**Finding:**
`updateProfile` maps `name` field to a different backend field name than what the auth endpoint expects. Backend silently ignores the mismatched field.

**Crosses:** merchant app → backend

**Impact:** Merchant profile name updates appear to succeed but never persist.

---

## CS-A-M3 — socialMediaService Wrong Response Path (HIGH)

**File:** `rezmerchant/services/api/socialMedia.ts:105`
**Also affects:** `G-MA-H24`

**Finding:**
`socialMediaService.getPostStats()` reads `result.data.stats` but the backend returns `result.stats` directly. Response unwrapping hits `undefined`.

**Crosses:** merchant app → backend

**Impact:** Social media analytics always show zero/empty data.

---

## CS-A-M4 — Export Bypasses apiClient (HIGH)

**File:** `rezmerchant/services/api/products.ts:375`
**Also affects:** `G-MA-H25`

**Finding:**
Bulk export uses raw `fetch()` instead of the centralized `apiClient` wrapper. This bypasses auth token injection, retry logic, and error handling.

**Crosses:** merchant app → backend

**Impact:** Bulk exports fail silently on auth expiry or network errors.

---

## CS-A-M5 — getVisitStats Throws Instead of Fallback (HIGH)

**File:** `rezmerchant/services/api/storeVisits.ts:79`
**Also affects:** `G-MA-H26`

**Finding:**
`getVisitStats()` throws when the backend returns a non-2xx response instead of returning a graceful fallback (zero values or cached data).

**Crosses:** merchant app → backend

**Impact:** Analytics page crashes and shows nothing instead of graceful degradation.

---

## CS-A-M6 — storeId Query Param Never Sent (HIGH)

**File:** `rezmerchant/services/api/orders.ts:104`
**Also affects:** `G-MA-H27`

**Finding:**
Orders API calls omit `storeId` from query params. Backend returns orders for all stores, not just the authenticated merchant's store.

**Crosses:** merchant app → backend

**Impact:** Merchant sees orders from other stores. Data leak + incorrect order counts.

---

## Status Table

| ID | Title | Severity | Crosses | Status |
|----|-------|---------|---------|--------|
| CS-A1 | Three VoucherBrand types | CRITICAL | admin → backend | ACTIVE |
| CS-A2 | CoinDrop type divergence | CRITICAL | admin → backend | ACTIVE |
| CS-A12 | @/types/unified doesn't exist | CRITICAL | consumer (build) | ACTIVE |
| CS-A3 | DoubleCashbackCampaign minOrderValue | HIGH | admin → backend | ACTIVE |
| CS-A4 | Opposite query param names | HIGH | admin → backend | ACTIVE |
| CS-A5 | Order refund modal field names wrong | HIGH | admin ← backend | ACTIVE |
| CS-A6 | Finance wired to non-existent routes | HIGH | finance → wallet/order | ACTIVE |
| CS-A7 | Finance rewards hook wrong endpoint+fields | HIGH | finance → wallet | ACTIVE |
| CS-A13 | 3 independent coin sources | HIGH | consumer (internal) | ACTIVE |
| CS-A15 | hotelOtaApi bypasses all infra | HIGH | consumer → OTA | ACTIVE |
| CS-A16 | 56 `any` types in stores | HIGH | consumer (type safety) | ACTIVE |
| CS-A17 | Duplicate service pairs | HIGH | consumer (architecture) | ACTIVE |
| CS-A-M1 | Order type mismatch (2 interfaces) | HIGH | merchant → backend | ACTIVE |
| CS-A-M2 | updateProfile name mapping broken | HIGH | merchant → backend | ACTIVE |
| CS-A-M3 | socialMediaService wrong response path | HIGH | merchant → backend | ACTIVE |
| CS-A-M4 | Export bypasses apiClient | HIGH | merchant → backend | ACTIVE |
| CS-A-M5 | getVisitStats throws instead of fallback | HIGH | merchant → backend | ACTIVE |
| CS-A-M6 | storeId query param never sent | HIGH | merchant → backend | ACTIVE |
| CS-A8 | Non-existent wallet fields read | MEDIUM | search → wallet | ACTIVE |
| CS-A9 | Finance approval stats wrong field | MEDIUM | finance (internal) | ACTIVE |
| CS-A10 | Coupon store search wrong param | MEDIUM | admin → backend | ACTIVE |
| CS-A11 | Order status filter missing 'pending' | MEDIUM | admin ← backend | ACTIVE |
| CS-A14 | TransactionMetadata defined twice | MEDIUM | consumer (internal) | ACTIVE |
| CS-A18 | 4 different pagination response shapes across services | HIGH | All services → All apps | ACTIVE |
| CS-A19 | IOrderTotals field name mismatches between surfaces | HIGH | Admin/Merchant/Consumer | ACTIVE |
| CS-A20 | Vesper API unwrapping crashes on null responses | MEDIUM | vesper-app | ACTIVE |
| CS-A21 | Finance service wired to non-existent wallet routes | HIGH | finance → wallet | ACTIVE |

---

## CS-A18 — 4 Different Pagination Response Shapes Across Services (HIGH)

**Files:** Multiple backend services + multiple frontend apps
**Severity:** HIGH

**Finding:**
Each service defines its own pagination response shape. Frontends cannot use a single pagination parser.

| Service | Shape |
|---------|-------|
| Order service | `{ data: T[], total: number, page: number }` |
| Wallet service | `{ items: T[], count: number, limit: number }` |
| Product service | `{ results: T[], totalCount: number }` |
| User service | `{ docs: T[], total: number, pages: number }` |

**Crosses:** All backend services → All frontend apps

**Impact:** Each frontend screen implements its own pagination parser. New endpoints require new parsers. Pagination logic is duplicated 4x.

**Fix:** Create canonical `PaginatedResponse<T>`:
```typescript
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
```
Enforce via Zod schema at the API boundary.

---

## CS-A19 — IOrderTotals Field Name Mismatches Between Surfaces (HIGH)

**Files:** `services/api/orders.ts` · `services/api/adminOrders.ts` · `types/api.ts`
**Severity:** HIGH

**Finding:**
The `IOrderTotals` type is defined with different field names across surfaces:
- Surface A: `{ subtotal, tax, discount, total, lockFee }`
- Surface B: `{ subTotal, taxAmount, discountAmount, grandTotal, platformFee }`
- Backend returns: `{ itemsSubtotal, tax, lockFeeDiscount, finalAmount }`

No surface matches the backend response shape exactly.

**Crosses:** Admin app → Merchant app → Consumer app → Backend

**Impact:** Order totals display incorrectly on one or more surfaces. `total` vs `grandTotal` causes 2-5% revenue discrepancies in reporting.

---

## CS-A20 — Vesper API Unwrapping Crashes on Null Responses (MEDIUM)

**File:** `vesper-app/src/api/client.ts:11`
**Gap ID:** VS-M4
**Severity:** MEDIUM

**Finding:**
```ts
return res.data.data ?? res.data;
```
If backend returns `{ data: { data: null } }`, the result is `null` cast to `T`. Components calling `.map()` or accessing `.length` crash.

**Crosses:** vesper-app (mobile → server)

**Impact:** Any null response from server causes runtime crash in mobile app.

---

## CS-A21 — Finance Service Wired to Non-Existent Wallet Routes (HIGH)

**File:** `rez-finance-service/src/services/creditIntelligenceService.ts:161`
**Gap ID:** NA-HIGH-18
**Also affects:** `CS-A6`

**Finding:**
Finance calls `/internal/wallet/:userId` and `/internal/orders/summary/:userId`. The wallet service exposes `/internal/balance/:userId` instead. The order service doesn't expose the summary route.

**Crosses:** finance service → wallet service, order service

**Impact:** Credit intelligence scoring silently falls back to zero values. BNPL eligibility reports are empty.
