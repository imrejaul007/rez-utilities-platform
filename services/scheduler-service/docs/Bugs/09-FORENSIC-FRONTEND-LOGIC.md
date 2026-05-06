# REZ Forensic Audit — Frontend Logic Bugs

**Audit Date:** 2026-04-13
**Coverage:** Consumer (rezapp), Admin (rezadmin), Merchant (rezmerchant)
**Scope:** Wrong enum values in conditionals, dead conditions, incorrect status checks, broken data mappings

---

## FL-01 — Consumer: `earn-from-social-media.tsx:204` checks UPPERCASE `'COMPLETED'`
> **Status:** ✅ FIXED (prior sprint — ENUM-13) — check now uses lowercase `'completed'`

**Severity:** ❌ HIGH
**File:** `rezapp/rez-master/app/earn-from-social-media.tsx:204`

```typescript
if (txn.status === 'COMPLETED') {
  // show success confirmation
}
```

**Backend sends:** `'completed'` (lowercase)

**Result:** This condition NEVER fires. Social media earning confirmation UI is permanently broken. Users submit content, backend processes it successfully, but the success screen never appears.

---

## FL-02 — Consumer: `app/offers/[id].tsx:200` checks `r.status === 'pending'` — should be `'pending_approval'`
> **Status:** ✅ FIXED

**Severity:** ❌ HIGH
**File:** `rezapp/rez-master/app/offers/[id].tsx:200`

```typescript
r.status === 'active' || r.status === 'pending'
```

**Backend virtual status values:** `'active'|'inactive'|'pending_approval'|'rejected'`

`'pending'` does NOT exist as an offer status. Offers awaiting admin approval return `status: 'pending_approval'`. The `=== 'pending'` check never matches. Offers in the approval queue are incorrectly treated as ineligible.

---

## FL-03 — Consumer: `my-bookings.tsx:373` checks `status === 'hold'` — not in schema
> **Status:** ✅ FIXED (prior sprint — ENUM-10) — `'hold'` removed from cancel condition and status map

**Severity:** ⚠️ MEDIUM
**File:** `rezapp/rez-master/app/my-bookings.tsx:373`

```typescript
status === 'confirmed' || status === 'hold'   // table booking cancel condition
```

`'hold'` is not a valid `ServiceBooking.status` value. This branch is permanently dead. Table bookings in `'confirmed'` state can be cancelled; no additional `'hold'` protection was ever needed.

---

## FL-04 — Consumer: `my-bookings.tsx` uses `'no_show'` in past bookings filter — not in query API
> **Status:** ✅ FIXED (2026-04-13) — backend `getUserBookings` now handles `'upcoming'`/`'past'` pseudo-statuses and includes `no_show` in the past filter

**Severity:** ⚠️ RISK
**File:** `rezapp/rez-master/app/my-bookings.tsx:163`

```typescript
status === 'completed' || status === 'cancelled' || status === 'no_show'
```

`'no_show'` IS a valid stored booking status. However, if the bookings query API does not include `no_show` in its filterable values, these bookings may not appear in the fetched list and the local check never fires.

---

## FL-05 — Consumer: `payment.tsx` and `bill-payment.tsx` use `'processing'` and `'completed'` — correct but fragile
> **Status:** ⏳ DEFERRED — finance-service terminal status fix tracked with F-C6; bill payment path not yet via finance-service

**Severity:** ⚠️ LOW
**Files:**
- `rezapp/rez-master/app/payment.tsx:344-357`
- `rezapp/rez-master/app/bill-payment.tsx:359-540`

Status checks:
```typescript
status === 'processing'  // start polling
status === 'completed'   // success
status === 'failed'      // error
```

These values are correct for `Payment.status`. However, if a bill payment goes through `rez-finance-service`, the terminal status is `'success'` not `'completed'`. Bill payments via finance-service will poll forever (no `'completed'` state ever arrives).

---

## FL-06 — Consumer: `my-deals.tsx` does not handle `'pending'` deal redemption status in counts
> **Status:** ⏳ DEFERRED — deal count accuracy tracked with consumer UI polish sprint

**Severity:** ⚠️ RISK
**File:** `rezapp/rez-master/app/my-deals.tsx:144-146`

```typescript
if (r.status === 'active') acc.active++;
else if (r.status === 'used') acc.used++;
else if (r.status === 'expired') acc.expired++;
// 'pending' and 'cancelled' are not counted
```

`DealRedemption.status` includes `'pending'` (paid deal awaiting payment confirmation) and `'cancelled'`. These are silently excluded from all counts. User's deal count totals are understated.

---

## FL-07 — Consumer: `WalletTransaction.type` uses `'transfer'` and `'gift'` — not in DB
> **Status:** ⏳ DEFERRED — consumer wallet type cleanup tracked; no active transfer/gift flows

**Severity:** ⚠️ RISK
**File:** `rezapp/rez-master/types/wallet.ts`

```typescript
type: 'earned' | 'spent' | 'expired' | 'bonus' | 'transfer' | 'gift'
```

DB `CoinTransaction.type` values: `'earned'|'spent'|'expired'|'refunded'|'bonus'|'branded_award'`

`'transfer'` and `'gift'` do not exist in the DB enum. Any conditional based on these values will never match real data.
`'refunded'` and `'branded_award'` exist in DB but not in consumer type — those transactions may not render correctly.

---

## FL-08 — Consumer: `loyaltyTier: 'diamond'` missing from `UnifiedUser` TypeScript type
> **Status:** ✅ MISJUDGMENT — not a real bug

**Severity:** ❌ HIGH
**File:** `rezapp/rez-master/types/unified/User.ts:73`

```typescript
loyaltyTier?: 'bronze' | 'silver' | 'gold' | 'platinum';
// 'diamond' is NOT here
```

Backend returns `'Diamond'`, normalized to `'diamond'`. TypeScript assignment fails at compile time. Runtime: diamond users see blank tier badges; tier-based benefits are not shown.

---

## FL-09 — Consumer: `OfflineQueueContext.tsx` bill status `'uploading'` — not in DB
> **Status:** ⏳ DEFERRED — client-side only state; no server confusion; documented as intentional

**Severity:** ⚠️ LOW
**File:** `rezapp/rez-master/contexts/OfflineQueueContext.tsx:332-365`

```typescript
bill?.status === 'uploading'
```

`'uploading'` is a client-side only state tracked in the offline queue. It is never returned by the API. The check is valid for local state management but should not be confused with server-side bill status.

---

## FL-10 — Admin: `users.tsx` normalization maps `DIAMOND → 'platinum'` — loses Diamond distinction permanently
> **Status:** ✅ FIXED

**Severity:** ❌ HIGH
**File:** `rezadmin/rez-admin-main/app/(dashboard)/users.tsx:214-227`

```typescript
case 'DIAMOND': return 'platinum';
```

Diamond users (10,000+ loyalty points, 3x earning multiplier) are permanently indistinguishable from Platinum users (5,000 points, 2.5x multiplier) in the Admin panel.

Admin analytics, segmentation, and manual actions cannot distinguish the top tier. Any Diamond-exclusive admin action is impossible to target correctly.

---

## FL-11 — Admin: `LoyaltyUser.brandLoyalty[].tier` type accepts both `'Bronze'` and `'bronze'`
> **Status:** ⏳ DEFERRED — tier case normalization tracked with ENUM-05; low risk

**Severity:** ⚠️ RISK
**File:** `rezadmin/rez-admin-main/services/api/loyalty.ts:24`

```typescript
tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'bronze' | 'silver' | 'gold' | 'platinum'
```

Admin has both cases in the union type. This means the admin type is aware of the inconsistency but doesn't resolve it — leaving case-sensitive comparisons to each component.
Any component doing `tier === 'Bronze'` will miss `'bronze'` entries and vice versa.

---

## FL-12 — Admin: `Order.totals.delivery` vs `totals.deliveryFee` — Admin code comment says use `delivery`
> **Status:** ✅ FIXED

**Severity:** ❌ HIGH
**File:** `rezadmin/rez-admin-main/services/api/orders.ts:36`

**Code comment:**
> "NOTE: field is 'delivery' NOT 'deliveryFee'"

Any admin component that uses `totals.deliveryFee` instead of `totals.delivery` will show `undefined` for delivery fees on all orders.

---

## FL-13 — Admin: Campaign `status` filter sends `'active'|'inactive'` but Campaign model uses `isActive: Boolean`
> **Status:** ⏳ DEFERRED — backend translation should exist; tracked for campaign filter audit

**Severity:** ⚠️ RISK
**File:** `rezadmin/rez-admin-main/services/api/campaigns.ts`

**Admin filter query:** `?status=active` or `?status=inactive`

**Campaign model:** Has no `status` field. Uses `isActive: Boolean`. Backend must translate `status=active → {isActive: true}`. If this translation is missing or removed, campaigns cannot be filtered by status.

---

## FL-14 — Merchant: POS `store-payment/quick-bill` uses `amount` field; `create-bill` uses `totalAmount`
> **Status:** ⏳ DEFERRED — field naming tracked with POS API standardization sprint

**Severity:** ⚠️ RISK
**File:** `rezmerchant/rez-merchant-master/services/api/pos.ts`

**`/create-bill` REQUIRED field:** `totalAmount`
**`/quick-bill` REQUIRED field:** `amount`

Two different field names for the same concept on two endpoints in the same service. Code comment documents the fix for `totalAmount` (was causing all create-bill calls to 400). Quick-bill using `amount` adds to the confusion.

---

## FL-15 — Merchant: `TransactionType` in notifications uses `NotificationType.ORDER = 'order'` (object enum) — different from string union
> **Status:** ✅ FIXED (2026-04-13) — converted to const object + string union type

**Severity:** ⚠️ LOW
**File:** `rezmerchant/rez-merchant-master/types/notifications.ts:20-31`

```typescript
enum NotificationType {
  ORDER = 'order',
  PRODUCT = 'product',
  ...
}
```

This is a TypeScript `enum` (object-based). All other type definitions in the codebase use string literal unions. Mixing patterns creates interop issues: `NotificationType.ORDER === 'order'` is `true` in TypeScript, but `notification.type === NotificationType.ORDER` fails if `notification.type` comes from JSON (which deserializes to string `'order'`, not the enum object).

---

## FL-16 — Consumer: `SubscriptionStore` active statuses: `'trial'` included but subscription screen may not handle it
> **Status:** ⏳ DEFERRED — payment_failed recovery UI tracked with subscription feature sprint

**Severity:** ⚠️ LOW
**File:** `rezapp/rez-master/stores/subscriptionStore.ts:196-208`

```typescript
const activeStatuses = ['active', 'trial', 'grace_period'];
isSubscribed = tier !== 'free' && activeStatuses.includes(status)
```

The `SubscriptionStatus` enum includes `'payment_failed'`. The store correctly excludes it from `activeStatuses`. However, the subscription UI must explicitly handle `'payment_failed'` to show a payment recovery prompt. If no such branch exists, users with failed payments see no UI feedback.

---

## FL-17 — Merchant: `Offer.validity.isActive` is required in creation payload but can silently default
> **Status:** ⏳ DEFERRED — merchant offer draft state tracked with offer creation UI improvements

**Severity:** ⚠️ LOW
**File:** `rezmerchant/rez-merchant-master/services/api/offers.ts:78`

```typescript
"validity": {
  "startDate": string,
  "endDate": string,
  "isActive": true    // hardcoded true in the type
}
```

`isActive` is always `true` in the creation payload — it is never exposed as a user-controlled field. This means merchants cannot create offers in a "draft/inactive" state. All offers go live immediately upon creation (pending admin approval). There is no "save as draft" concept for merchant offers.

---

## FL-18 — Consumer: `verification status 'pending'` vs `'rejected'` checks in zones — correct but fragile
> **Status:** ⏳ DEFERRED — implicit approved state logic tracked for explicit check refactor

**Severity:** ⚠️ LOW
**File:** `rezapp/rez-master/app/offers/zones/student.tsx:126-127`

```typescript
verificationStatus?.status === 'pending'
verificationStatus?.status === 'rejected'
```

These values are consistent with the backend `VerificationStatus` enum (`'pending'|'approved'|'rejected'`). However there is no check for `'approved'` — the absence of `pending` or `rejected` is used as the implicit `approved` signal. If a fourth status is ever added (e.g., `'revoked'`), these zones will silently show the wrong UI.

---

## FL-19 — Consumer: Stock status checks use UPPERCASE in Socket context
> **Status:** ⏳ DEFERRED — socket schema needs verification; tracked for real-time stock update audit

**Severity:** ⚠️ LOW
**File:** `rezapp/rez-master/contexts/SocketContext.tsx:671-701`

```typescript
payload.status === 'OUT_OF_STOCK'
payload.status === 'LOW_STOCK'
payload.status === 'IN_STOCK'
```

These are UPPERCASE. If the backend WebSocket payload sends lowercase (`'out_of_stock'`, `'low_stock'`, `'in_stock'`), these checks never match. Real-time stock updates would be silently ignored.

**No backend socket schema was found to confirm which case is sent.** If backend sends lowercase (as is convention for all other enums in this codebase), this is a breaking bug.

---

## FL-20 — Merchant: `getActiveStore()` picks `data[0]` — multi-store merchants always use first store
> **Status:** ⏳ DEFERRED — multi-store support not yet in scope; single-store assumption documented

**Severity:** ⚠️ RISK
**File:** `rezmerchant/rez-merchant-master/services/api/stores.ts:207-232`

```typescript
const activeStore = response.data.stores?.[0];
// or
const store = Array.isArray(data) ? data[0] : data;
```

All POS operations (bill creation, order management, coin awards) use `activeStore`. For merchants with 2+ active stores, only store[0] is ever used. All other stores are unreachable via POS.

---

## Summary Table

| ID | File | Condition Type | Bug |
|----|------|----------------|-----|
| FL-01 | earn-from-social-media.tsx:204 | Wrong case | `'COMPLETED'` never matches `'completed'` |
| FL-02 | offers/[id].tsx:200 | Wrong value | `'pending'` never matches `'pending_approval'` |
| FL-03 | my-bookings.tsx:373 | Dead value | `'hold'` not in schema |
| FL-04 | my-bookings.tsx:163 | Risk | `'no_show'` may not be fetched |
| FL-05 | bill-payment.tsx:359 | Finance mismatch | `'completed'` vs `'success'` from finance-service |
| FL-06 | my-deals.tsx:144 | Missing case | `'pending'` deals not counted |
| FL-07 | types/wallet.ts | Dead types | `'transfer'|'gift'` not in DB |
| FL-08 | unified/User.ts:73 | Missing type | `'diamond'` not in loyaltyTier union |
| FL-09 | OfflineQueueContext.tsx | Client-only state | `'uploading'` is local, not server |
| FL-10 | admin/users.tsx:214 | Data loss | DIAMOND→platinum loses tier |
| FL-11 | admin/loyalty.ts:24 | Dual case | Both 'Bronze' and 'bronze' in union |
| FL-12 | admin/orders.ts:36 | Wrong field | `deliveryFee` vs `delivery` |
| FL-13 | admin/campaigns.ts | Abstraction leak | `status=active` vs `isActive: Boolean` |
| FL-14 | pos.ts | Different field names | `totalAmount` vs `amount` for same concept |
| FL-15 | notifications.ts | Enum type mismatch | Object enum vs string union |
| FL-16 | subscriptionStore.ts | Missing UI branch | `payment_failed` state not handled |
| FL-17 | merchant/offers.ts | UX gap | Cannot create draft offers |
| FL-18 | zones/student.tsx | Implicit approval | Absence used as approval signal |
| FL-19 | SocketContext.tsx | Wrong case | UPPERCASE vs lowercase stock status |
| FL-20 | stores.ts:207 | Array[0] | Multi-store merchants always use first store |
