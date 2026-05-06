# Cross-Service: Type Drift

**Date:** 2026-04-16
**Updated:** 2026-04-17 (Gen 16 vesper-app added)
**Severity:** 6 CRITICAL, 7 HIGH, 6 MEDIUM (was: 4 CRITICAL, 6 HIGH, 5 MEDIUM)

---

## Overview

Local TypeScript types diverge from canonical shared types. This causes runtime crashes when backend returns canonical shapes that local types don't anticipate. Gen 11 consumer audit found 5+ type mismatches. Gen 10 merchant audit found additional drift issues across wallet types and order types.

---

## CS-T10 — Merchant App: Wallet Balance ×100 Inflation — Unit Ambiguity (CRITICAL)

**File:** `app/payouts/index.tsx:276` + `services/api/wallet.ts`
**Gap IDs:** G-MA-C01, G-MA-H04, G-MA-H05, CR-17
**Severity:** CRITICAL
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
```typescript
// Display layer — Paise inflation:
walletData.balance.available * 100  // ×100 multiplies the number

// formatRupees divides by 100:
export function formatRupees(paise: number): string {
  return `₹${(amount / 100).toFixed(2)}`;
}
```

`formatRupees` expects paise input. But `balance.available` is already in rupees. The `* 100` cancels the division, displaying the raw number. If API sends 5000 (rupees) → shows ₹5000. If API sends 500000 (paise) → shows ₹5000. The merchant app cannot determine which unit the API returns.

**Same pattern in:**
- `services/api/wallet.ts` — withdrawal amounts not unit-annotated
- `app/(cashback)/[id].tsx` — cashback approval amounts
- `app/pos/index.tsx` — coin discount calculations

**Crosses:** Merchant App Gen 10 → Backend (wallet service)

**Impact:** Merchant sees wrong balance. Withdrawal requests debit 100x the intended amount. Backend may interpret withdrawal as paise when it sent rupees.

---

## CS-T11 — Merchant App: Order Type Mismatch — Two Incompatible Interfaces (HIGH)

**File:** `services/api/orders.ts:240` + `types/api.ts`
**Gap IDs:** G-MA-H22
**Severity:** HIGH
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
The `Order` type returned by `getOrderById` has a different shape than the `Order` type used in `OrderFilters` and list queries. The `storeId` field is optional in one but required in the other. The `items` array type differs. The `totals` object structure differs.

**Crosses:** Merchant App Gen 10 (internal type conflict)

**Impact:** Type casting between list view and detail view is unsafe. Fields present in one type are absent in the other.

---

## CS-T12 — Merchant App: CashbackRequest Defined 3x (HIGH)

**File:** `types/api.ts` + `services/api/cashback.ts` + `hooks/queries/useCashback.ts`
**Gap IDs:** G-MA-H36
**Severity:** HIGH
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
| Location | Fields | Issue |
|----------|--------|-------|
| `types/api.ts` | id, status, amount, storeId, createdAt | CORRECT |
| `services/api/cashback.ts` | id, status, amount, requesterId | MISSING storeId, EXTRA requesterId |
| `hooks/queries/useCashback.ts` | id, status, approvedAmount | DIFFERENT — partial type |

Three different `CashbackRequest` interfaces. No shared import. Each surface assumes its own shape.

**Crosses:** Merchant App Gen 10 (internal fragmentation)

---

## CS-T13 — Merchant App: Product Type Defined 3x (HIGH)

**File:** `services/api/products.ts` + `types/api.ts` + `hooks/queries/useProducts.ts`
**Gap IDs:** G-MA-H37
**Severity:** HIGH
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
Three `Product` type definitions with different field sets. Same pattern as CashbackRequest.

**Crosses:** Merchant App Gen 10 (internal fragmentation)

---

## CS-T6 — WalletBalance Has 3 Completely Different Shapes (CRITICAL)

**Files:**
- `rez-now/lib/types/index.ts:184`
- `rez-shared/src/types/wallet.ts:5`
- `rez-shared/src/types/wallet.types.ts:77`
**Gap IDs:** XREP-01
**Severity:** CRITICAL

**Finding:**
```typescript
// Shape A — rez-now:
WalletBalance = { coins: number, rupees: number, tier: 'bronze'|'silver'|'gold'|'platinum'|null }

// Shape B — rez-shared/wallet.ts:
WalletBalance = { rez: number, prive: number, promo: number, branded: number, cashback: number, total: number }

// Shape C — rez-shared/wallet.types.ts:
WalletBalance = { total: number, available: number, pending: number, cashback: number }
```

**Crosses:** rez-now → rez-shared → wallet backend

**Impact:** Any code reading `.coins` or `.rupees` from shared's canonical shape breaks. Three different types for the same concept in the same package.

---

## CS-T7 — rez-now Has Zero Imports from `@karim4987498/shared` (CRITICAL)

**Files:** `rez-now/package.json` · ALL `rez-now/lib/**/*.ts`
**Gap IDs:** XREP-04, SYS-ROOT-01
**Severity:** CRITICAL

**Finding:**
`rez-now` defines ALL types locally. Zero imports from `@karim4987498/shared`. `package.json` has no dependency on the shared package.

**Crosses:** rez-now → ALL other repos

**Impact:** 16 duplicate enum/type definitions. Type drift guaranteed to accumulate. WebOrderStatus, PaymentStatusResult, WalletBalance, AddressType, BookingStatus, and WalletTransaction.type all defined locally with different values than canonical.

---

## CS-T8 — KarmaProfile Has 6 Canonical Fields Missing (HIGH)

**Files:** `rez-app-consumer/stores/karmaProfileStore.ts` · `rez-shared/src/entities/karma.ts`
**Gap IDs:** XREP-08, XREP-11
**Severity:** HIGH

**Finding:**
Consumer app `KarmaProfile` has 14 fields. Canonical `IKarmaProfile` has 20 fields.

Missing: `_id`, `eventsJoined`, `checkIns`, `approvedCheckIns`, `lastActivityAt`, `levelHistory`, `conversionHistory`, `thisWeekKarmaEarned`, `weekOfLastKarmaEarned`, `avgEventDifficulty`, `avgConfidenceScore`, `activityHistory`, `createdAt`, `updatedAt`.

**Crosses:** consumer app → rez-shared → karma backend

**Impact:** Components accessing canonical fields crash or show undefined. Data loss when consuming server responses.

---

## CS-T9 — Karma Profile Missing `userTimezone` in Schema (MEDIUM)

**Files:** `rez-karma-service/src/models/KarmaProfile.ts` · `rez-karma-service/src/karmaEngine.ts`
**Gap IDs:** XREP-16
**Severity:** MEDIUM

**Finding:**
`applyDailyDecay()` accepts `userTimezone` parameter but `KarmaProfile` schema doesn't have `userTimezone` field.

**Crosses:** karma service (internal — schema vs engine)

**Impact:** Decay calculations always fall back to UTC. For non-UTC timezones, decay boundary is wrong by up to several hours.

---

## CS-T1 — KarmaProfile vs IKarmaProfile (CRITICAL)

**Consumer App:** `services/karmaService.ts:13-25`
**Canonical:** `packages/shared-types/src/entities/karma.ts:106-131`
**Also affects:** `docs/Gaps/03-CROSS-REF/TYPE-DIVERGENCE.md` (G-CR-X1)

**Finding:**
Local `KarmaProfile` is missing 14 canonical fields (`_id`, `eventsJoined`, `levelHistory`, `conversionHistory`, etc.) and has 3 extra client-only fields.

**Crosses:** consumer app → shared types → karma backend

**Impact:** Runtime crash when backend returns canonical profile shape.

---

## CS-T2 — KarmaEvent vs IKarmaEvent (HIGH)

**Consumer App:** `services/karmaService.ts:43-75`
**Canonical:** `packages/shared-types/src/entities/karma.ts:137-155`
**Also affects:** `docs/Gaps/03-CROSS-REF/TYPE-DIVERGENCE.md` (G-CR-X2)

**Finding:**
`difficulty` is `'easy'|'medium'|'hard'` locally but `number` (0-1) canonically. Missing canonical fields: `karmaReward`, `maxAttendees`, `currentAttendees`, `startTime`, `endTime`.

**Crosses:** consumer app → shared types → karma backend

**Impact:** Type mismatch causes incorrect difficulty rendering.

---

## CS-T3 — CoinDrop Type Mismatch Between Admin Screens (HIGH)

**Files:** `services/api/extraRewards.ts` · `services/api/cashStore.ts`
**Also affects:** `A10-H2`, `A10-C2`

**Finding:**
`storeId` is `string | { _id, name, logo }` in one, `string` only in the other.

**Crosses:** admin app (two screens)

**Impact:** Runtime crash when data from one screen is used by the other.

---

## CS-T4 — Order Type Missing `_id` vs `id` (MEDIUM)

**File:** `app/(dashboard)/orders.tsx:971`
**Also affects:** `A10-C8`

**Finding:**
`Order` interface defines `_id` but refund modal accesses `.id` (non-existent).

**Crosses:** admin app ← backend

**Impact:** "Order #undefined" display.

---

## CS-T5 — DoubleCashbackCampaign minOrderValue Optional vs Required (MEDIUM)

**Files:** `services/api/extraRewards.ts` · `services/api/cashStore.ts`
**Also affects:** `A10-H3`

**Finding:**
`minOrderValue` is optional in one type, required in the other.

**Crosses:** admin app (two screens)

**Impact:** Validation inconsistency.

---

## Status Table

| ID | Title | Severity | Crosses | Status |
|----|-------|---------|---------|--------|
| CS-T6 | WalletBalance 3 different shapes | CRITICAL | rez-now → shared → wallet | ACTIVE |
| CS-T7 | rez-now zero imports from shared | CRITICAL | rez-now → all repos | ACTIVE |
| CS-T1 | KarmaProfile vs IKarmaProfile | CRITICAL | consumer → shared | ACTIVE |
| CS-T10 | Merchant wallet balance ×100 inflation | CRITICAL | Merchant → backend | ACTIVE |
| CS-T8 | KarmaProfile 6 canonical fields missing | HIGH | consumer → shared | ACTIVE |
| CS-T2 | KarmaEvent vs IKarmaEvent | HIGH | consumer → shared | ACTIVE |
| CS-T3 | CoinDrop storeId type mismatch | HIGH | admin (two screens) | ACTIVE |
| CS-T11 | Merchant Order type mismatch | HIGH | Merchant App (internal) | ACTIVE |
| CS-T12 | Merchant CashbackRequest 3x definitions | HIGH | Merchant App (internal) | ACTIVE |
| CS-T13 | Merchant Product type 3x definitions | HIGH | Merchant App (internal) | ACTIVE |
| CS-T4 | Order ._id vs .id | MEDIUM | admin ← backend | ACTIVE |
| CS-T5 | DoubleCashbackCampaign optional vs required | MEDIUM | admin (two screens) | ACTIVE |
| CS-T9 | userTimezone not in schema but used | MEDIUM | karma service | ACTIVE |
| CS-T14 | Vesper OrderStatus type incompatible with REZ | CRITICAL | vesper-app → shared | ACTIVE |
| CS-T15 | Vesper PaymentStatus type incompatible with REZ | CRITICAL | vesper-app → shared | ACTIVE |
| CS-T16 | Vesper API client has no null-safety on unwrap | MEDIUM | vesper-app (internal) | ACTIVE |

---

## CS-T14 — Vesper OrderStatus Type Incompatible with REZ (CRITICAL)

**File:** `vesper-app/server/src/types/index.ts:12`
**Gap ID:** VS-C2
**Severity:** CRITICAL

**Finding:**
```typescript
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
```

Vesper defines its own `OrderStatus` locally. The canonical REZ `OrderStatus` (from `rez-shared`) uses `'placed'`, `'preparing'`, `'out_for_delivery'`, `'dispatched'` — none in the vesper set. Values like `'processing'` and `'shipped'` don't exist canonically.

**Crosses:** vesper-app → REZ shared types

**Impact:** If vesper orders sync to REZ, all order status queries return empty sets.

---

## CS-T15 — Vesper PaymentStatus Type Incompatible with REZ (CRITICAL)

**File:** `vesper-app/server/src/types/index.ts:17`
**Gap ID:** VS-C3
**Severity:** CRITICAL

**Finding:**
```typescript
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';
```

Vesper uses `'success'` as terminal success. REZ canonical uses `'paid'`. Missing 6 canonical values.

**Crosses:** vesper-app → REZ shared types

**Impact:** Payment status detection always fails when syncing with REZ.

---

## CS-T16 — Vesper API Client Has No Null-Safety on Response Unwrap (MEDIUM)

**File:** `vesper-app/src/api/client.ts:11`
**Gap ID:** VS-M4
**Severity:** MEDIUM

**Finding:**
```typescript
return res.data.data ?? res.data;
```

If backend returns `{ data: { data: null } }`, the result is `null` cast to `T`. Components accessing `.map()` or `.length` crash.

**Crosses:** vesper-app (mobile → server)

**Impact:** Any null response causes runtime crash.
