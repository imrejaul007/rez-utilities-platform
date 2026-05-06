# Cross-Service: Enum & Status Fragmentation

**Date:** 2026-04-16
**Updated:** 2026-04-17 (Gen 16 vesper-app + enum sweep added)
**Severity:** 4 CRITICAL, 9 HIGH, 10 MEDIUM (was: 2 CRITICAL, 6 HIGH, 7 MEDIUM)

---

## Overview

Status strings are defined in 3+ places across all surfaces with inconsistent casing, missing values, and incomplete color/label maps. Gen 11 audit found 8 additional enum mismatches across consumer app, rez-now, and karma service.

---

## CS-E9 — WebOrderStatus 6 Values vs Canonical OrderStatus 15 Values (CRITICAL)

**Files:** `rez-now/lib/types/index.ts:119` · `rez-shared/src/orderStatuses.ts:24`
**Gap ID:** XREP-02
**Severity:** CRITICAL

**Finding:**
```typescript
// rez-now — only 6 values:
WebOrderStatus = 'pending_payment' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'

// canonical — 15 values:
ORDER_STATUSES = 'placed', 'dispatched', 'out_for_delivery', 'failed_delivery',
  'return_requested', 'returned', 'refunded', and 8 more
```

**Crosses:** rez-now → rez-shared → backend

**Impact:** Values like `'out_for_delivery'`, `'return_requested'`, `'refunded'` render as raw strings in rez-now. Order history is incomplete.

---

## CS-E10 — Payment Status `'completed'` vs Canonical `'paid'` (CRITICAL)

**Files:** `rez-app-consumer/services/paymentService.ts:243` · `rez-shared/src/paymentStatuses.ts`
**Gap IDs:** NA-CRIT-08, XREP-09
**Severity:** CRITICAL

**Finding:**
Payment polling checks for terminal states as:
```typescript
status === 'completed' || status === 'failed' || status === 'cancelled'
```
But canonical `PaymentStatus` uses `'paid'` as terminal success. If backend returns `'paid'`, polling runs until 30-attempt timeout (90 seconds).

**Crosses:** consumer app → rez-shared → payment backend

**Impact:** Users see spinner for 90 seconds after successful payment, then timeout error.

---

## CS-E11 — karma Credits `'rez'` But Queries `'karma_points'` (HIGH)

**File:** `rez-karma-service/src/services/walletIntegration.ts:115-134`
**Gap IDs:** NA-HIGH-03, XREP-07
**Severity:** HIGH

**Finding:**
```typescript
// creditUserWallet() credits with:
coinType: 'rez'

// getKarmaBalance() queries with:
coinType: 'karma_points'
```

**Crosses:** karma service → wallet service

**Impact:** `getKarmaBalance()` always returns 0 because it queries the wrong coin type.

---

## CS-E12 — normalizeLoyaltyTier Has Two Opposite Behaviors (HIGH)

**Files:** `rez-shared/src/constants/coins.ts:139` · `rez-shared/src/enums.ts:20`
**Gap IDs:** XREP-03, NA-MED-14
**Severity:** HIGH

**Finding:**
```typescript
// coins.ts:
'DIAMOND' → 'platinum'   // diamond normalizes to platinum

// enums.ts:
'DIAMOND' → 'diamond'    // diamond is a distinct tier
```

Both files are in the same shared package. Two different P0-ENUM-3 fixes created conflicting mappings.

**Crosses:** rez-shared (internal package conflict)

**Impact:** Same user loyalty tier normalizes to different values depending on which module consumes it.

---

## CS-E13 — PaymentStatusResult 6 Values vs Canonical PaymentStatus 10 Values (MEDIUM)

**Files:** `rez-now/lib/api/scanPayment.ts:49` · `rez-shared/src/paymentStatuses.ts`
**Gap ID:** XREP-06
**Severity:** MEDIUM

**Finding:**
```typescript
// rez-now:
PaymentStatusResult.status = 'initiated' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired'

// canonical:
PaymentStatus = 10 values including 'refund_initiated', 'refund_processing', 'refunded', 'refund_failed'
```

**Crosses:** rez-now → rez-shared → payment backend

---

## CS-E14 — AddressType SCREAMING_CASE vs Canonical lowercase (MEDIUM)

**Files:** `rez-app-consumer/services/addressApi.ts:6-10` · `rez-shared`
**Gap IDs:** XREP-10, NA-MED-07
**Severity:** MEDIUM

**Finding:**
```typescript
// consumer app:
HOME = 'HOME', WORK = 'WORK', OTHER = 'OTHER'

// canonical:
'home' | 'work' | 'other'
```

**Crosses:** consumer app → rez-shared → address backend

**Impact:** Address CRUD sends wrong enum values. Backend silently misclassifies or rejects addresses.

---

## CS-E15 — CoinType `'branded_coin'` vs Canonical `'branded'` (HIGH)

**Files:** `rez-app-consumer` · `rez-shared/src/enums/coin.ts`
**Gap ID:** XREP-12
**Severity:** HIGH

**Finding:**
Consumer app uses `CoinType.branded_coin`. Canonical uses `CoinType.branded`.

**Crosses:** consumer app → rez-shared → wallet backend

**Impact:** Branded coin config never matches. Branded coins shown with wrong styling or hidden entirely.

---

## CS-E16 — BookingStatus 4 Values vs Canonical 9 Values (MEDIUM)

**Files:** `rez-app-consumer/services/bookingApi.ts:22` · `rez-shared`
**Gap IDs:** XREP-15, NA-MED-08
**Severity:** MEDIUM

**Finding:**
```typescript
// consumer app: 4 values
'pending' | 'confirmed' | 'cancelled' | 'completed'

// canonical: 9 values
'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'no_show' | 'cancelled' | 'completed' | 'refunded' | 'expired'
```

**Crosses:** consumer app → rez-shared → booking backend

---

## CS-E17 — WalletTransaction.type Simplified vs Rich (MEDIUM)

**Files:** `rez-now` · `rez-shared`
**Gap ID:** XREP-14
**Severity:** MEDIUM

**Finding:**
```typescript
// rez-now:
WalletTransaction.type = 'credit' | 'debit'

// canonical:
CoinTransactionType = 'earned' | 'spent' | 'expired' | 'refunded' | 'bonus' | 'branded_award'
```

**Crosses:** rez-now → rez-shared → wallet backend

---

## CS-E18 — Week Boundary: locale `startOf('week')` vs ISO `startOf('isoWeek')` (MEDIUM)

**Files:** `rez-karma-service/src/services/karmaService.ts:128` · `rez-karma-service/src/services/batchService.ts:577`
**Gap IDs:** XREP-05, NA-MED-13
**Severity:** MEDIUM

**Finding:**
```typescript
// karmaService.addKarma():
moment().startOf('week')    // locale-dependent (typically Sunday)

// batchService.getWeeklyCoinsUsed():
moment(weekOf).startOf('isoWeek')  // always Monday
```

**Crosses:** karma service (internal — same service, two modules)

**Impact:** Weekly cap boundary differs between earning and spending. Users may be incorrectly capped or uncapped by up to 2 days.

---

## CS-E19 — Merchant App: OrderStatus Fragmented Across 7 Locations (CRITICAL)

**File:** `types/api.ts:485` (canonical) + 6 consumer locations
**Gap IDs:** G-MA-C14, G-MA-H28, G-MA-H34, CR-M1
**Severity:** CRITICAL
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
| Location | Values | Issue |
|----------|--------|-------|
| `types/api.ts` (canonical) | placed, confirmed, preparing, ready, out_for_delivery, delivered, cancelled, cancelling, refunded | CORRECT — source of truth |
| `app/orders/live.tsx` | pending, confirmed, preparing, ready, dispatched, delivered, cancelled, returned | MISSING placed, EXTRA pending |
| `app/(dashboard)/aggregator-orders.tsx` | pending, accepted, preparing, ready, picked_up, delivered, cancelled | DIFFERENT set — no canonical |
| `app/kds/index.tsx` | new, preparing, ready | SHORT list — 6 statuses missing |
| `app/kds/rez-now-orders.tsx` | pending, confirmed, preparing, ready | MISSING 6 statuses |
| Consumer App Gen 11 | pending, confirmed, preparing, completed | Uses `completed` not `delivered`, `placed` not `pending` |
| Admin App Gen 10 | 3 separate implementations | 3 normalizeOrderStatus variants |

**Crosses:** Merchant App Gen 10 → Consumer App Gen 11 → Admin App Gen 10 → Backend

**Impact:** Pending orders tab always shows zero (G-MA-C14). Order filters miss entire categories. Same order renders differently across surfaces.

---

## CS-E20 — Merchant App: PaymentStatus `'completed'` vs Canonical `'paid'` (CRITICAL)

**File:** `app/(dashboard)/payments.tsx:21,34,46` + `utils/paymentValidation.ts:33`
**Gap IDs:** G-MA-H02, G-MA-H29, CR-M2
**Severity:** CRITICAL
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
| Location | Values | Issue |
|----------|--------|-------|
| `types/api.ts` (canonical) | pending, awaiting_payment, processing, authorized, paid, failed, refunded, partially_refunded | CORRECT |
| `app/(dashboard)/payments.tsx` | `'completed'` (UI sends wrong value) | Should be `'paid'` |
| `utils/paymentValidation.ts` | pending, completed, failed, cancelled | WRONG whitelist |
| Consumer App Gen 11 | `'completed'` in polling check | NA-CRIT-08 |
| Admin App | Unknown — check A10-H5 | TBD |

**Crosses:** Merchant App Gen 10 → Consumer App Gen 11 → Admin App

**Impact:** Payment filter sends `'completed'` to backend — backend has no such status. Payment history shows zero results. User cannot filter by completed payments.

---

## CS-E21 — CashbackStatus Query Hooks Missing `'approved'` and `'expired'` (HIGH)

**File:** `hooks/queries/useCashback.ts:23` + `types/api.ts` + `shared/types/cashback.ts`
**Gap IDs:** G-MA-H30, CR-M3
**Severity:** HIGH
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
| Location | Values | Issue |
|----------|--------|-------|
| `types/api.ts` (canonical) | pending, approved, rejected, paid, expired | CORRECT |
| `hooks/queries/useCashback.ts` | pending, paid, rejected | MISSING approved, expired |
| `shared/types/cashback.ts` | pending, approved, rejected, paid, expired, created, reviewed, flagged | EXTENDED but superset |
| Consumer App Gen 11 | TBD | Check NA-### docs |

**Crosses:** Merchant App Gen 10 → Consumer App Gen 11

**Impact:** UI can never query for `'approved'` or `'expired'` cashback requests. Approved cashback requests are invisible to the merchant app. Expired requests are invisible.

---

## CS-E22 — Merchant App: Order Status Filter Maps Incorrectly (HIGH)

**File:** `hooks/useOrdersDashboard.ts:222-240` + `app/(dashboard)/live-monitor.tsx`
**Gap IDs:** G-MA-C14, G-MA-H28
**Severity:** HIGH
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
```typescript
// useOrdersDashboard.ts:222
const counts: Record<string, number> = {
  pending: 0,    // 'pending' is NOT in OrderStatus — matches NOTHING
  placed: 0,     // canonical starting state — but UI tab says "pending"
};

// Filter: activeFilter === 'pending'
const filteredOrders = orders.filter(o => o.status === 'pending');
// Results: empty set every time
```

**Crosses:** Merchant App Gen 10 (UI → type mismatch)

**Impact:** Pending orders tab is permanently empty. Merchants see zero orders regardless of actual state.

---

## CS-E23 — Merchant App: Socket Hardcodes 'placed' on New Order Events (MEDIUM)

**File:** `app/(dashboard)/live-monitor.tsx:445`
**Gap ID:** G-MA-H28
**Severity:** MEDIUM
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
```typescript
socketService.onNewOrder(({ orderId, merchantName, amount }) => {
  setLiveOrderFeed(prev => [{
    ...
    status: 'placed', // HARDCODED — ignores actual status from event
  }, ...]);
});
```

**Crosses:** Merchant App Gen 10

**Impact:** New order events always show `'placed'` regardless of actual order status. Status color is wrong from the moment the order arrives.

---

## CS-E24 — Merchant App: Status Normalization Duplicated 7x (HIGH)

**File:** Multiple surfaces in merchant app
**Gap IDs:** G-MA-H34, G-MA-H35, G-MA-H36, G-MA-H37
**Severity:** HIGH
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
| Pattern | Count | Locations |
|---------|-------|-----------|
| OrderStatus definition | 7x | types/api.ts + 6 screens |
| OrderFilters definition | 3x | types/api.ts:485 + 2 surfaces |
| CashbackRequest type | 3x | Multiple files |
| Product type | 3x | Multiple files |
| PaymentStatus type | 3x | Multiple files |

Each surface defines its own normalizer with potentially different mappings. No shared import.

**Crosses:** Merchant App Gen 10 (internal fragmentation)

---

## Status Table

| ID | Title | Severity | Crosses | Status |
|----|-------|---------|---------|--------|
| CS-E1 | Three normalizeOrderStatus implementations | CRITICAL | All surfaces | ACTIVE |
| CS-E9 | WebOrderStatus 6 vs canonical 15 | CRITICAL | rez-now → shared | ACTIVE |
| CS-E10 | Payment status 'completed' vs 'paid' | CRITICAL | consumer → shared | ACTIVE |
| CS-E19 | Merchant OrderStatus fragmented 7x | CRITICAL | Merchant App | ACTIVE |
| CS-E20 | Merchant PaymentStatus 'completed' vs 'paid' | CRITICAL | Merchant App | ACTIVE |
| CS-E2 | Payment status colors missing 7 states | HIGH | All surfaces | ACTIVE |
| CS-E3 | Order status colors missing 2 states | HIGH | All surfaces | ACTIVE |
| CS-E4 | Invalid status transition dispatched→delivered | HIGH | Admin, merchant | ACTIVE |
| CS-E5 | Non-canonical 'pending' and 'completed' | HIGH | Consumer, admin | ACTIVE |
| CS-E11 | karma credits 'rez' but queries 'karma_points' | HIGH | Karma → wallet | ACTIVE |
| CS-E12 | normalizeLoyaltyTier opposite in two files | HIGH | rez-shared (internal) | ACTIVE |
| CS-E15 | CoinType branded_coin vs branded | HIGH | Consumer → shared | ACTIVE |
| CS-E21 | CashbackStatus query missing approved/expired | HIGH | Merchant App | ACTIVE |
| CS-E22 | Order status filter maps to wrong value | HIGH | Merchant App | ACTIVE |
| CS-E24 | Status normalization duplicated 7x | HIGH | Merchant App | ACTIVE |
| CS-E13 | PaymentStatusResult 6 vs canonical 10 | MEDIUM | rez-now → shared | ACTIVE |
| CS-E14 | AddressType SCREAMING_CASE vs lowercase | MEDIUM | Consumer → shared | ACTIVE |
| CS-E16 | BookingStatus 4 vs canonical 9 values | MEDIUM | Consumer → shared | ACTIVE |
| CS-E17 | WalletTransaction.type simplified vs rich | MEDIUM | rez-now → shared | ACTIVE |
| CS-E18 | Week boundary locale vs ISO | MEDIUM | Karma service | ACTIVE |
| CS-E23 | Socket hardcodes 'placed' on new order | MEDIUM | Merchant App | ACTIVE |
| CS-E6 | normalizePaymentStatus exists but never used | MEDIUM | All surfaces | ACTIVE |
| CS-E7 | Socket hardcoded 'placed' in new order | MEDIUM | Admin | ACTIVE |
| CS-E8 | Lock fee calculation wrong field | MEDIUM | Admin | ACTIVE |
| CS-E9 (orig) | Consumer uses 'completed' not 'delivered' | MEDIUM | Consumer → backend | ACTIVE |
| CS-E25 | Vesper OrderStatus incompatible with REZ canonical | CRITICAL | vesper-app → shared | ACTIVE |
| CS-E26 | Vesper PaymentStatus incompatible with REZ canonical | CRITICAL | vesper-app → shared | ACTIVE |
| CS-E27 | PaymentStatus SCREAMING_CASE vs lowercase across all surfaces | HIGH | All surfaces | ACTIVE |
| CS-E28 | normalizeOrderStatus defined 10+ times across all repos | HIGH | All surfaces | ACTIVE |

---

## CS-E25 — Vesper OrderStatus Incompatible with REZ Canonical (CRITICAL)

**File:** `vesper-app/server/src/types/index.ts:12`
**Gap ID:** VS-C2
**Severity:** CRITICAL

**Finding:**
```typescript
// vesper-app server:
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';

// canonical (rez-shared):
// 'placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered',
// 'dispatched', 'cancelled', 'cancelling', 'refunded'
```

**Crosses:** vesper-app server → REZ shared types

**Impact:** If vesper orders sync to REZ ecosystem, all status queries return empty sets. Values like `'processing'` and `'shipped'` don't exist in canonical.

---

## CS-E26 — Vesper PaymentStatus Incompatible with REZ Canonical (CRITICAL)

**File:** `vesper-app/server/src/types/index.ts:17`
**Gap ID:** VS-C3
**Severity:** CRITICAL

**Finding:**
```typescript
// vesper-app server:
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';

// canonical (rez-shared):
// 'pending', 'awaiting_payment', 'processing', 'authorized', 'paid',
// 'failed', 'refunded', 'partially_refunded', 'expired', 'cancelled'
```

**Crosses:** vesper-app server → REZ shared types

**Impact:** `'success'` never matches `'paid'`. All payment queries return zero results when syncing with REZ.

---

## CS-E27 — PaymentStatus `'completed'` vs `'paid'` Across All Surfaces (HIGH)

**Updated:** 2026-04-16 (Gen 10 merchant + vesper-app)

**Finding:**
| Codebase | File | Uses | Issue |
|----------|------|------|-------|
| Merchant Gen 10 | `app/(dashboard)/payments.tsx:21` | `'completed'` | Should be `'paid'` |
| Merchant Gen 10 | `utils/paymentValidation.ts:33` | `'completed'` in whitelist | Not in canonical |
| Consumer Gen 11 | `services/paymentService.ts:243` | `status === 'completed'` | Never matches |
| Admin Gen 10 | Multiple files | `'completed'` | Wrong value |
| rez-now | `lib/api/scanPayment.ts:49` | `'completed'` in enum | Not in canonical |
| vesper-app | `server/src/types/index.ts:17` | `'success'` | Should be `'paid'` |

**Crosses:** ALL surfaces

**Impact:** Payment filters always return zero results. Users cannot filter by payment status.

**Root Cause:** RC-1 (no canonical source) + RC-33 (frontend/backend evolved separately)

---

## CS-E28 — normalizeOrderStatus Defined 10+ Times Across All Repos (HIGH)

**Updated:** 2026-04-16 (Gen 10 merchant + consumer + admin + vesper-app)

**Finding:**
| Codebase | Locations | Status Values |
|----------|---------|---------------|
| REZ backend | `shared/enums/order.ts`, `backend/models/Order.js`, GraphQL resolver | CORRECT canonical |
| Merchant App Gen 10 | `types/api.ts:485` + 6 screens | 3 different sets |
| Consumer Gen 11 | Multiple screens | `'completed'` not `'delivered'` |
| Admin Gen 10 | 3 separate implementations | Different normalizations |
| rez-now | `lib/types/index.ts:119` | Only 6 values |
| vesper-app | `server/src/types/index.ts:12` | `'processing'`, `'shipped'` not canonical |

**Impact:** 10+ independent definitions guarantee drift. The canonical order status FSM is ignored by most surfaces.

**Single fix:** Create `shared/constants/orderStatus.ts` with canonical values. Enforce via arch fitness test.

---

## CS-E29 — normalizeOrderStatus Conflicting Implementations in Admin App (HIGH)

**Files:** `constants/orderStatuses.ts` · `types/index.ts` · `types/rez-shared-types.ts`
**Also affects:** `A10-H6`
**Severity:** HIGH

**Finding:**
Each has a `LEGACY_STATUS_MAP` with the same approach but potentially different maps. `orders.tsx` imports from `constants/orderStatuses.ts`, not the canonical `@rez/shared` shim.

**Crosses:** Admin Gen 10 (internal fragmentation)

**Impact:** Same order status renders differently across admin screens.

---

## CS-E30 — Multiple normalizePaymentStatus Definitions with Conflicting Logic (MEDIUM)

**Files:** `types/rez-shared-types.ts` · `constants/paymentStatuses.ts` · `utils/paymentValidation.ts`
**Severity:** MEDIUM

**Finding:**
Three `normalizePaymentStatus` implementations with different mapping logic. The canonical `normalizePaymentStatus` in `types/rez-shared-types.ts` is exported but has zero consumers.

**Crosses:** Admin Gen 10, Merchant Gen 10

**Impact:** Payment status normalization is inconsistent across surfaces.

---

## — Three Competing normalizeOrderStatus Implementations (CRITICAL)

**Files:** `constants/orderStatuses.ts` · `types/index.ts` · `types/rez-shared-types.ts`
**Also affects:** `A10-H6`

**Finding:**
Each has a `LEGACY_STATUS_MAP` with the same approach but potentially different maps. `orders.tsx` imports from `constants/orderStatuses.ts`, not the canonical `@rez/shared` shim.

**Crosses:** All 5 surfaces

**Impact:** Same order status renders differently across surfaces.

---

## CS-E2 — Payment Status Colors Missing 7 of 11 Canonical States (HIGH)

**File:** `app/(dashboard)/orders.tsx:252`
**Also affects:** `A10-H5`

**Finding:**
`getPaymentStatusColor` only handles `'paid'`, `'pending'`, `'failed'`, `'refunded'`. Missing: `'awaiting_payment'`, `'processing'`, `'authorized'`, `'partially_refunded'`, `'expired'`, `'cancelled'`, `'unknown'`.

**Crosses:** admin, consumer, merchant apps

**Impact:** Payment states show as gray (indistinguishable from errors).

---

## CS-E3 — Order Status Colors Missing `out_for_delivery` and `cancelling` (HIGH)

**File:** `app/(dashboard)/live-monitor.tsx:137, 152`
**Also affects:** `A10-H8`

**Finding:**
Both `orderStatusColor` and `orderStatusLabel` missing these two canonical statuses.

**Crosses:** admin, consumer, merchant apps

**Impact:** Live feed shows gray "out_for_delivery" for all in-transit orders.

---

## CS-E4 — Status Transition Map Allows Invalid `dispatched→delivered` (HIGH)

**File:** `app/(dashboard)/orders.tsx:61`
**Also affects:** `A10-H7`

**Finding:**
`dispatched: ['out_for_delivery', 'delivered', 'cancelled']` — allows skipping `out_for_delivery`.

**Crosses:** admin, merchant apps

**Impact:** Orders can bypass delivery confirmation step.

---

## CS-E5 — rez-now-orders Uses Non-Canonical `'pending'` and `'completed'` (HIGH)

**File:** `app/(dashboard)/rez-now-orders.tsx:115`
**Also affects:** `A10-H7`

**Finding:**
Uses `'pending'` (should be `'placed'`) and `'completed'` (should be `'delivered'`). Missing 6 canonical statuses entirely.

**Crosses:** consumer app, admin app

**Impact:** Status colors wrong for entire order history.

---

## CS-E6 — normalizePaymentStatus Exists But Never Used (MEDIUM)

**File:** `types/rez-shared-types.ts`
**Also affects:** `A10-H5`

**Finding:**
Canonical `normalizePaymentStatus` is exported but has zero consumers in the codebase.

**Crosses:** All surfaces

**Impact:** Each surface implements its own payment status normalization.

---

## CS-E7 — Status Hardcoded as `'placed'` in Socket New Order (MEDIUM)

**File:** `app/(dashboard)/live-monitor.tsx:445`
**Also affects:** `A10-H8`

**Finding:**
```ts
socketService.onNewOrder(({ orderId, merchantName, amount }) => {
  setLiveOrderFeed(prev => [{
    ...
    status: 'placed', // HARDCODED
  }, ...]);
});
```

**Crosses:** admin app

**Impact:** New order event always shows `'placed'` regardless of actual status.

---

## CS-E8 — Lock Fee Calculation Sums Item Discounts Instead of Using totals.lockFeeDiscount (MEDIUM)

**File:** `app/(dashboard)/orders.tsx:566`
**Also affects:** `A10-H7`

**Finding:**
```ts
const lockFee = item.items?.reduce((sum, i) => sum + (i.discount || 0), 0) || 0;
```

Backend provides `totals.lockFeeDiscount` as canonical source. Summing item discounts may not match.

**Crosses:** admin app ← backend

**Impact:** Lock fee display may not match actual charge.

---

## CS-E9 — Consumer App Uses `completed` Instead of `delivered` (MEDIUM)

**File:** Multiple consumer app screens
**Also affects:** `A10-H5`

**Finding:**
Consumer app uses `'completed'` throughout while backend canonical is `'delivered'`.

**Crosses:** consumer app ↔ backend

**Impact:** Status comparisons fail silently.
