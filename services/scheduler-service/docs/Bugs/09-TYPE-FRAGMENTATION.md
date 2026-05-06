# Bug Report: Type Fragmentation & Enum Conflicts (Layer 9)

**Audit Date:** 2026-04-13
**Audit Method:** 5-agent parallel deep audit
**Layer:** TypeScript interfaces, shared type definitions, enum values, cross-app type consistency
**Status:** HIGH — wrong types cause silent data loss, unreachable code, and broken UI states

---

## TF-01 — `CoinType` has 4, 5, or 6 values across 6 different files {#tf-01}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** `cashback` and `referral` coin types from the backend are silently ignored by the wallet microservice and consumer app. Users cannot see referral coin balances. Cashback coins are invisible in wallet history.

**Complete conflict map:**

| File | CoinType Values | Count |
|---|---|---|
| `rez-shared/src/constants/coins.ts` (canonical) | `rez, prive, branded, promo, cashback, referral` | **6** |
| `rezadmin/rez-admin-main/rez-shared-types.ts` (inlined) | `rez, prive, branded, promo, cashback, referral` | 6 ✓ |
| `rez-shared/src/types/wallet.types.ts WalletCoinType` | `rez, prive, branded, promo, cashback` | **5** (missing `referral`) |
| `rez-wallet-service/models/Wallet.ts ICoinBalance.type` | `rez, prive, branded, promo` | **4** (missing `cashback`, `referral`) |
| `rezapp/rez-master/types/wallet.ts CoinType` | `rez, branded, promo, prive` | **4** (missing `cashback`, `referral`) |
| `rezapp/rez-master/types/rez-shared-types.ts` (inlined) | `rez, prive, branded, promo, category` | **5** (`'category'` doesn't exist anywhere in backend) |

**Direct consequences:**
- Wallet microservice `coins[].type` cannot store `cashback` or `referral` coins — they have no bucket
- Consumer app wallet display ignores `cashback` and `referral` coin entries from API responses
- `'category'` in consumer inlined types will never match any coin type from the backend

**Files involved:**
- `rezapp/rez-master/types/wallet.ts`
- `rezapp/rez-master/types/rez-shared-types.ts`
- `rez-wallet-service/src/models/Wallet.ts`
- `rez-shared/src/types/wallet.types.ts`

---

## TF-02 — `TransactionType` casing: lowercase (backend) vs SCREAMING_CASE (consumer UI) {#tf-02}
> **Status:** ⏳ DEFERRED — display type vs wire type distinction; tracked for consumer wallet type cleanup

**Severity:** HIGH
**Impact:** Consumer wallet transaction type display always fails to match. Transaction filtering by type never works. `type === 'PAYMENT'` never equals `type === 'payment'` from the backend.

| Location | Type Values |
|---|---|
| `rezbackend CoinTransaction.type` | `'earned'`, `'spent'`, `'expired'`, `'refunded'`, `'bonus'`, `'branded_award'` |
| `rez-wallet-service CoinTransaction.type` | same lowercase |
| `rez-shared BackendCoinTransactionType` | same lowercase |
| `rezapp/types/wallet.types.ts TransactionType` | `'PAYMENT'`, `'REFUND'`, `'CASHBACK'`, `'REWARD'`, `'TRANSFER'`, `'TOPUP'`, `'WITHDRAWAL'` |

The consumer wallet transaction list `switch(transaction.type)` never matches any backend value. All transactions display under a default/unknown case.

**Files involved:**
- `rezapp/rez-master/types/wallet.types.ts`

---

## TF-03 — `User.role` in consumer unified types missing 3 valid roles, adds 1 fake role {#tf-03}
> **Status:** ⏳ DEFERRED — consumer role type cleanup; no moderator role in production

**Severity:** HIGH
**Impact:** Support staff, operators, and super-admins are not recognized by consumer app role-gated UI. `'moderator'` case in any consumer `switch(user.role)` never fires — the role doesn't exist.

| Location | Role Values |
|---|---|
| `rez-shared User.role` | `user, admin, merchant, support, operator, super_admin` (6) |
| DB `User.role` | same 6 |
| `rezapp/types/unified/User.ts role` | `user, merchant, admin, moderator` (4 — missing `support`, `operator`, `super_admin`; adds fake `moderator`) |

**Files involved:**
- `rezapp/rez-master/types/unified/User.ts`

---

## TF-04 — `Booking.bookingType` discriminant values differ between rez-shared and backend {#tf-04}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** All booking-type-based routing and display logic fails silently. `bookingType === 'table'` never matches data from the backend which sends `'table_booking'`.

| Location | Values |
|---|---|
| `rez-shared BookingType` | `'table'`, `'service'`, `'event'`, `'ota'`, `'trial'` |
| `rezbackend BookingSource` | `'table_booking'`, `'service_booking'`, `'ota_booking'`, `'event_booking'`, `'trial_booking'` |

**Files involved:**
- `rez-shared/src/types/booking.types.ts`
- `rezbackend/rez-backend-master/src/types/booking.types.ts`

---

## TF-05 — `PaymentStatus` name used for two different state machines in same codebase {#tf-05}
> **Status:** ✅ FIXED — Both FSMs kept as canonical for their domain. Bridge function `paymentStatusToOrderPayment()` added to `rez-shared/src/statusCompat.ts`. Standalone PaymentStatus (10 values) = financial lifecycle; OrderPaymentStatus (8 values) = consumer-facing.

**Severity:** HIGH
**Impact:** Importing `PaymentStatus` gives different values depending on which file it came from. FSM transition checks that compare against canonical `PaymentStatus` values will allow/reject different statuses than intended.

| Location | Values (count) | Machine |
|---|---|---|
| `rez-shared/paymentStatuses.ts PaymentStatus` | 10 | Standalone payment FSM |
| `rezbackend/types/order.ts PaymentStatus` | 8 | Order payment sub-document |
| `rezmerchant/types/api.ts PaymentStatus` | 8 | Order payment sub-document |
| `rezapp/types/order.ts PaymentStatus` | 8 | Order payment sub-document |
| `rezapp/types/payment.types.ts PaymentStatus` | 6 | Subset (missing 4 transition states) |

**Files involved:**
- `rez-shared/src/paymentStatuses.ts`
- `rezbackend/rez-backend-master/src/types/order.ts`
- `rezapp/rez-master/types/payment.types.ts`

---

## TF-06 — Consumer app `User.email` required in unified types, optional in rez-shared and backend {#tf-06}
> **Status:** ⏳ DEFERRED — consumer unified type needs email optional; tracked for next consumer type audit

**Severity:** MEDIUM
**Impact:** Consumer code using the unified `User` type that assumes `email` is always present will crash for users who signed up via phone only (no email). Phone-only user accounts are valid in the backend.

| Location | `email` |
|---|---|
| `rez-shared User` | `email?: string` (optional) |
| Backend `IUser` | `email?: string` (optional) |
| `rezapp/types/unified/User.ts` | `email: string` (required) |

**Files involved:**
- `rezapp/rez-master/types/unified/User.ts`

---

## TF-07 — Consumer `Offer._id` vs `Offer.id` across two type files in the same app {#tf-07}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Components importing from `types/offers.types.ts` use `offer.id`. Components importing from `realOffersApi.ts` use `offer._id`. Passing an offer from one source to a component expecting the other results in `undefined` ID. Offer actions (like/share/view) break.

| File | ID Field |
|---|---|
| `rezapp/rez-master/types/offers.types.ts` (deprecated API) | `id: string` |
| `rezapp/rez-master/services/realOffersApi.ts Offer` | `_id: string` |

**Files involved:**
- `rezapp/rez-master/types/offers.types.ts`
- `rezapp/rez-master/services/realOffersApi.ts`

---

## TF-08 — Zod `createOfferSchema.offerType` values don't match `OfferType` TypeScript enum {#tf-08}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** TypeScript compilation passes but runtime validation rejects valid TS-typed offer types (`'combo'`, `'special'`, `'walk_in'`) and accepts invalid ones (`'deal'`, `'flash_sale'`, etc.) that will fail DB insert.

| Status | Values |
|---|---|
| Zod only (not in TS type or DB) | `deal`, `flash_sale`, `loyalty`, `gift_card`, `dynamic_pricing` |
| TS type + DB only (not in Zod) | `combo`, `special`, `walk_in` |
| All three agree | `discount`, `cashback`, `voucher` |

**Files involved:**
- `packages/rez-shared/src/schemas/validationSchemas.ts`
- `rez-shared/src/types/offer.types.ts OfferType`

---

## TF-09 — `isSuspended` (canonical) vs `isBanned` (consumer unified type) {#tf-09}
> **Status:** ⏳ DEFERRED — consumer unified type rename tracked; no active ban UI flows broken

**Severity:** MEDIUM
**Impact:** Consumer app code using unified `User` type to check suspension uses `isBanned`. Backend always sends `isSuspended`. Suspension state is always `undefined` in the consumer unified type path.

| Location | Field |
|---|---|
| `rez-shared User` | `isSuspended?: boolean` |
| Backend `IUser` | `isSuspended: boolean` |
| `rezapp/types/unified/User.ts` | `isBanned?: boolean` |

**Files involved:**
- `rezapp/rez-master/types/unified/User.ts`

---

## TF-10 — Admin app inlines `rez-shared` types instead of importing the package {#tf-10}
> **Status:** ✅ FIXED — Admin app now uses `@rez/shared` npm package via `types/index.ts` shim. Local `rez-shared-types.ts` removed. Type drift eliminated.

**Severity:** MEDIUM
**Impact:** Admin app types will silently drift from the canonical package on every update. No compiler error — the admin app uses its own local copy. A shared type change only propagates to admin on the next manual copy-paste.

**What is happening:**
`rezadmin/rez-admin-main/rez-shared-types.ts` is a local copy of rez-shared types. The admin app `tsconfig.json` uses a path alias to resolve `@rez/shared` to this local file instead of the npm package.

**Files involved:**
- `rezadmin/rez-admin-main/rez-shared-types.ts`

---

## TF-11 — `OrderDTO.payment.method` uses `'online'` and `'mixed'` — not in DB, not in Zod, not in any frontend type {#tf-11}
> **Status:** ⏳ DEFERRED — rez-shared DTO alignment tracked; no active consumer uses online/mixed path

**Severity:** MEDIUM
**Impact:** Any code using `OrderDTO` (from rez-shared dtos.ts) for payment method checks or display will incorrectly handle orders. `'online'` and `'mixed'` are not accepted by the backend, not stored in DB, and not in any other type definition.

| Location | Values |
|---|---|
| `rez-shared/src/dtos.ts OrderDTO.payment.method` | `'cod'|'online'|'wallet'|'mixed'` |
| DB `Order.payment.method` enum | `wallet, card, upi, cod, netbanking, razorpay, stripe` |
| Zod `createOrderSchema.paymentMethod` | `cod, wallet, razorpay, upi, card, netbanking` |

**Files involved:**
- `rez-shared/src/dtos.ts`

---

## TF-12 — User ID: 3 different field name conventions across the system {#tf-12}
> **Status:** ✅ FIXED — `normalizeUserId()` utility added to `rez-shared`. `OrderDTO._id` → `OrderDTO.id`. All entity DTOs now use `id` (REST convention). `id` everywhere in rez-shared DTOs.

**Severity:** HIGH
**Impact:** Cross-panel or cross-service code passing user IDs uses the wrong field name, getting `undefined`.

| Location | ID Field |
|---|---|
| DB `User._id` | `_id` |
| `rez-shared User._id` | `_id` |
| `rezapp/types/unified/User.ts` | `id` |
| `rezapp/types/profile.types.ts` | `id` |
| `rezbackend/src/types/api.ts UserProfile` | `id` |
| `rezmerchant/types/api.ts User` | `id` |
| `rezadmin/services/api/users.ts AdminUser` | `_id` |

Consumer app uses `id`. Admin uses `_id`. Backend API response uses `id`. DB model is `_id`. Any shared utility that handles the ID must accommodate both — and currently none do systematically.

**Files involved:**
- Multiple — see list above

---

## TF-13 — `Order.createdAt` type: `Date` (backend models) vs `string` (rez-shared) vs `string | Date` (consumer unified) {#tf-13}
> **Status:** ✅ FIXED — `normalizeUserId()` in `rez-shared/src/utils` also normalizes `createdAt` to ISO string via Date→ISO converter. All API boundary DTOs return `string` for timestamps.

**Severity:** MEDIUM
**Impact:** Date comparison and display code that calls `.toLocaleDateString()` on a `Date` object fails when it receives a `string`. `new Date(order.createdAt)` is required everywhere but not consistently applied.

| Location | `createdAt` type |
|---|---|
| `rez-shared Order.createdAt` | `string` (ISO) |
| `rezbackend/models/Order.ts` | `Date` |
| `rezbackend/types/order.ts` merchant DTO | `Date` |
| `rezapp/types/unified/Order.ts` | `string \| Date` (union) |

**Files involved:**
- `rez-shared/src/types/order.types.ts`
- `rezapp/rez-master/types/unified/Order.ts`

---

## TF-14 — `Merchant.phone` required in DB and rez-shared, optional in merchant app type {#tf-14}
> **Status:** ✅ FIXED — `phone: string` required in `types/api.ts`. DB schema alignment complete.

**Severity:** MEDIUM
**Impact:** Merchant app code treats `phone` as optional — renders empty phone field. Merchant registration form may submit without phone when the DB model requires it, causing a backend validation error that appears as a generic failure.

| Location | `phone` |
|---|---|
| DB `IMerchant.phone` | required |
| `rez-shared Merchant.phone` | `phone: string` (required) |
| `rezmerchant/types/api.ts Merchant.phone?` | optional |

**Files involved:**
- `rezmerchant/rez-merchant-master/types/api.ts`

---

## TF-15 — `Merchant.businessAddress` required in DB and rez-shared, optional in merchant app type {#tf-15}
> **Status:** ✅ FIXED — `businessAddress: {...}` required in `types/api.ts`. DB schema alignment complete.

**Severity:** MEDIUM
**Impact:** Same as TF-14 — merchant app allows submitting without a business address. DB will reject the document.

| Location | `businessAddress` |
|---|---|
| DB `IMerchant.businessAddress.*` | all sub-fields required |
| `rez-shared Merchant.businessAddress` | required |
| `rezmerchant/types/api.ts Merchant.businessAddress?` | optional |

**Files involved:**
- `rezmerchant/rez-merchant-master/types/api.ts`

---

## TF-16 — Merchant app `Merchant.verificationStatus` typed as `string`, not the canonical enum {#tf-16}
> **Status:** ⏳ DEFERRED — type safety improvement; no runtime impact today

**Severity:** LOW
**Impact:** Merchant app code doing `if (merchant.verificationStatus === 'verified')` works, but any typo or invalid string passes TypeScript without error. Autocomplete doesn't suggest valid values.

| Location | Type |
|---|---|
| `rez-shared Merchant.verificationStatus` | `'pending'|'verified'|'rejected'` |
| DB enum | same 3 values |
| `rezmerchant/types/api.ts Merchant.verificationStatus?` | `string` |

**Files involved:**
- `rezmerchant/rez-merchant-master/types/api.ts`

---

## TF-17 — `loyaltyTier`: three different field names + value sets for the same concept across the system {#tf-17}
> **Status:** ⏳ DEFERRED — multi-tier system normalization requires product decision; tracked

**Severity:** HIGH
**Impact:** Consumer app UI rendering loyalty tier reads from different fields depending on component. Some show subscription tier, some show gamification tier, some show nothing.

| Location | Field + Values |
|---|---|
| `rez-shared User.rezPlusTier` | `'free'|'premium'|'vip'` |
| `rezapp/types/unified/User.ts loyaltyTier` | `'bronze'|'silver'|'gold'|'platinum'` |
| `rezapp/types/profile.types.ts subscriptionTier` | `string` |
| `API_CONTRACTS.md /api/user/profile tier` | `'bronze'|'silver'|'gold'|'platinum'|'diamond'` |
| `rezbackend/models/User.ts rezPlusTier` | `'free'|'premium'|'vip'` |

**Files involved:**
- `rezapp/rez-master/types/unified/User.ts`
- `rez-shared/src/types/user.types.ts`
- `rezbackend/rez-backend-master/API_CONTRACTS.md`
