# Bug Report: Field-Level Mismatches (Layer 7)

**Audit Date:** 2026-04-13
**Audit Method:** 5-agent parallel deep audit
**Layer:** Field names, types, required/optional, nesting — across DB ↔ Backend ↔ API ↔ All frontends
**Status:** HIGH — wrong data displayed, silent undefined bugs, broken form submissions

---

## FM-01 — Order delivery fee has 4 different field names across the system {#fm-01}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Any component reading delivery fee from the wrong path gets `undefined`, silently treated as `0`. Order totals display incorrectly.

| Location | Field Name Used | Value |
|---|---|---|
| DB canonical: `Order.totals.delivery` | `totals.delivery` | decimal rupees |
| `rezbackend/src/types/order.ts` merchant DTO | `pricing.shippingAmount` | decimal rupees |
| `rezmerchant/types/orders.ts` | `shipping` (flat, top-level) | decimal rupees |
| `rez-shared/src/dtos.ts` OrderDTO | `deliveryFee` | decimal rupees |
| Consumer `rezapp/types/order.ts` | `shipping` (flat, @deprecated) + `totals.delivery` | both |

**Files involved:**
- `rezbackend/rez-backend-master/src/types/order.ts`
- `rezmerchant/rez-merchant-master/types/orders.ts`
- `rez-shared/src/dtos.ts`
- `rezapp/rez-master/types/order.ts`

---

## FM-02 — Order `user` vs `customer`: two different field names for the order's customer {#fm-02}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Admin panel reads `order.user`, merchant panel reads `order.customer`. One of them is always `undefined` depending on which backend serializes the response.

| Location | Field Name | Shape |
|---|---|---|
| DB `Order.user` | `user` | `ObjectId` ref to User |
| Admin panel `AdminOrder.user` | `user` | `{ _id, profile?.{firstName,lastName}, phoneNumber, email? }` |
| Merchant panel `MerchantOrder.customer` | `customer` | `{ id, name, email, phone }` |
| `rez-shared/src/types/order.types.ts` | `user` | `string` (ObjectId) |

**Files involved:**
- `rezadmin/rez-admin-main/services/api/orders.ts:6`
- `rezmerchant/rez-merchant-master/types/api.ts:182`

---

## FM-03 — `TransactionStatus`: `'completed'` (backend) vs `'success'` (consumer UI) {#fm-03}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Consumer wallet transaction status badges **never match** for completed transactions. Every `completed` transaction is displayed as an unknown/unrecognized state.

| Location | Value |
|---|---|
| `rezbackend` all DB models + FSM | `'completed'` |
| `rez-wallet-service` | `'completed'` |
| `rez-shared/src/types/wallet.types.ts BackendTransactionStatus` | `'completed'` |
| `rezapp/rez-master/types/wallet.types.ts TransactionStatus` | **`'success'`** |

**Files involved:**
- `rezapp/rez-master/types/wallet.types.ts`

---

## FM-04 — Branded coins: `merchantId`/`merchantName` vs `storeId`/`storeName` vs `storePromoCoins` {#fm-04}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** The same physical branded coin balance is referenced with 3 different field names across 3 API calls. Cross-API branded coin matching logic (e.g., matching wallet balance to a store in checkout) silently fails.

| API / Location | Fields Used |
|---|---|
| `GET /wallet/balance` → `brandedCoins[]` | `merchantId`, `merchantName`, `merchantLogo`, `merchantColor` |
| `GET /store-payment/coins/:storeId` → `brandedCoins` | `storeId`, `storeName` |
| `POST /orders` → `coinsUsed` | field is named `storePromoCoins` (not `brandedCoins`) |

Checkout code at `rezapp/rez-master/hooks/useCheckout.ts:679` matches by `bc.merchantId === storeId` — this works only if both APIs return the same entity under the same key. The store payment API uses `storeId`, not `merchantId`.

**Files involved:**
- `rezapp/rez-master/services/walletApi.ts`
- `rezapp/rez-master/services/storePaymentApi.ts`
- `rezapp/rez-master/hooks/useCheckout.ts:679`

---

## FM-05 — `wasilCoins`: legacy ghost field still sent and read in consumer app {#fm-05}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** `wasilCoins` is the old name for REZ coins, renamed in the backend. Three consumer app screens still read `order.payment.coinsUsed.wasilCoins`. The backend never populates this field. Order confirmation and tracking screens silently show 0 for coins used.

**Files involved (reading dead field):**
- `rezapp/rez-master/app/tracking/[orderId].tsx:617,623,628`
- `rezapp/rez-master/app/order-confirmation.tsx:480`
- `rezapp/rez-master/services/ordersApi.ts` — `CreateOrderRequest.coinsUsed.wasilCoins` (sent in order creation)

**Backend validation schema** (`orderSchemas.createOrder` in `middleware/validation.ts`) **does** accept `wasilCoins` — so it passes validation but the backend likely ignores it or maps it to nothing, meaning those coins are not applied to the order.

---

## FM-06 — Offer list response key: `offers[]` (admin) vs `deals[]` (merchant) {#fm-06}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Either the admin panel offer list or the merchant panel offer list always receives `undefined` for the array of offers, depending on which key the backend actually returns.

| Location | Expected Response Key |
|---|---|
| Admin `OffersListResponse` | `offers: []` |
| Merchant `getStoreOffers()` | `deals[]` (accesses `response.data.deals`) |

**Files involved:**
- `rezadmin/rez-admin-main/services/api/offers.ts:71`
- `rezmerchant/rez-merchant-master/services/api/offers.ts:122`

---

## FM-07 — Offer `restrictions`: admin sends 4 fields, merchant sends 6 fields, DB has 7 fields {#fm-07}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Offers created by the merchant with `applicableOn` and `excludedProducts` restrictions cannot be viewed or edited from the admin panel. Admin edits silently overwrite these fields to undefined.

| Field | Admin `CreateOfferRequest` | Merchant `CreateOfferRequest` | DB `Offer.restrictions` |
|---|---|---|---|
| `minOrderValue` | yes | yes | yes |
| `maxDiscountAmount` | yes | yes | yes |
| `usageLimitPerUser` | yes | yes | yes |
| `usageLimit` | yes | yes | yes |
| `applicableOn[]` | **NO** | yes | yes (enum: online/offline/both) |
| `excludedProducts[]` | **NO** | yes | yes (ref: Product) |
| `ageRestriction` | **NO** | **NO** | yes |

**Files involved:**
- `rezadmin/rez-admin-main/services/api/offers.ts:107`
- `rezmerchant/rez-merchant-master/services/api/offers.ts:85`

---

## FM-08 — Offer `metadata`: admin sends 5 fields, merchant sends 7 fields, DB has 8 fields {#fm-08}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** `isBestSeller` and `isSpecial` flags set by merchant are invisible in admin panel. Admin edits overwrite these to undefined.

| Field | Admin | Merchant | DB |
|---|---|---|---|
| `isNew` | yes | yes | yes |
| `isTrending` | yes | yes | yes |
| `featured` | yes | yes | yes |
| `priority` | yes | yes | yes |
| `tags[]` | yes | yes | yes |
| `isBestSeller` | **NO** | yes | yes |
| `isSpecial` | **NO** | yes | yes |
| `flashSale` | **NO** | **NO** | yes |

**Files involved:**
- `rezadmin/rez-admin-main/services/api/offers.ts:101`
- `rezmerchant/rez-merchant-master/services/api/offers.ts:91`

---

## FM-09 — Offer `category` type: untyped `string` (admin) vs strict enum (merchant) vs 11-value enum (DB) {#fm-09}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Admin can submit any arbitrary category string. Merchant is limited to 8 values. DB accepts 11 values. The 3 extra DB categories (`entertainment`, `beauty`, `wellness`) cannot be set from either panel.

| Location | Category Values |
|---|---|
| DB `Offer.category` enum | `mega, student, new_arrival, trending, food, fashion, electronics, general, entertainment, beauty, wellness` (11) |
| Merchant `CreateOfferRequest.category` | `mega, student, new_arrival, trending, food, fashion, electronics, general` (8) |
| Admin `CreateOfferRequest.category` | `string` (no constraint — any value accepted) |

**Files involved:**
- `rezadmin/rez-admin-main/services/api/offers.ts:89`
- `rezmerchant/rez-merchant-master/services/api/offers.ts:62`
- `rezbackend/rez-backend-master/src/models/Offer.ts`

---

## FM-10 — Merchant `createMerchant` sends `name` and `phone`, but model/interface uses `ownerName` and `phoneNumber` {#fm-10}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Admin-created merchants have empty/null `ownerName` in the DB. `phoneNumber` is not saved. Admin merchant table shows blank name and phone for every admin-created merchant.

| Request Field (admin creates) | Backend Model Field | Admin Interface Field |
|---|---|---|
| `name` | `ownerName` | `phoneNumber` |
| `phone` | `phone` (DB) | `phoneNumber` (TS interface) |

**Files involved:**
- `rezadmin/rez-admin-main/services/api/merchants.ts:193-194` (sends `name`, `phone`)
- `rezbackend/rez-backend-master/src/models/Merchant.ts` (field: `ownerName`, `phone`)
- `rezadmin/rez-admin-main/services/api/merchants.ts:8` (interface: `phoneNumber`)

---

## FM-11 — Merchant ID: `_id` (admin) vs `id` (merchant app) vs `_id` (DB) {#fm-11}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Any code passing a merchant ID between the admin panel and merchant app (e.g., cross-panel deep links, shared analytics) uses the wrong field and gets `undefined`.

| Location | Field Name |
|---|---|
| DB `Merchant._id` | `_id` |
| Admin `Merchant._id` | `_id` |
| Merchant app `Merchant.id` | `id` |

**Files involved:**
- `rezadmin/rez-admin-main/services/api/merchants.ts:4`
- `rezmerchant/rez-merchant-master/types/api.ts:103`

---

## FM-12 — `preferences.notifications` is a nested object in rez-shared but a `boolean` in backend API types {#fm-12}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Consumer app sends `{ push: true, email: false, sms: false }` object. Backend API types define it as a `boolean`. If validation coerces or rejects the object, notification preferences are silently not saved.

| Location | Type |
|---|---|
| `rez-shared/src/types/user.types.ts` | `{ push: boolean, email: boolean, sms: boolean }` |
| `rezbackend/rez-backend-master/src/types/api.ts UserProfile.preferences.notifications` | `boolean` (flat) |
| `API_CONTRACTS.md /api/user/profile` | `boolean` |
| Consumer app `UpdateProfileRequest` | nested object |

**Files involved:**
- `rezbackend/rez-backend-master/src/types/api.ts`
- `rezbackend/rez-backend-master/API_CONTRACTS.md`

---

## FM-13 — `UserProfile.wallet` typed as `string` (ObjectId) in backend API types, treated as `WalletData` object in all frontends {#fm-13}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Consumer app accesses `user.wallet.balance`, `user.wallet.totalEarned`, `user.wallet.pendingAmount` from the auth `/me` response. If `wallet` is an ObjectId string, all of these are `undefined`.

| Location | `wallet` type |
|---|---|
| `rezbackend/src/types/api.ts UserProfile` | `wallet?: string` (ObjectId reference) |
| `rezapp/services/authApi.ts User` | `wallet?: { balance, totalEarned, totalSpent, pendingAmount }` |
| `rezapp/rez-master/hooks/useAuth.ts` — `user.wallet.balance` | accessed as object |
| `rezapp/rez-master/services/authApi.ts:589-631` | `user.wallet.balance`, `.totalEarned`, `.pendingAmount` |

**Files involved:**
- `rezbackend/rez-backend-master/src/types/api.ts`
- `rezapp/rez-master/services/authApi.ts`

---

## FM-14 — Store `banner`: `string[]` (admin) vs `string` (merchant) {#fm-14}
> **Status:** ⏳ DEFERRED — banner type unification requires frontend migration; tracked as tech debt

**Severity:** MEDIUM
**Impact:** Admin creates stores with banner as an array. Merchant app reads it as a single string. Merchant store edit pre-fills the wrong value. Banner display may break.

| Location | Type |
|---|---|
| Admin `AdminStore.banner?` | `string[]` (array) |
| Merchant `Store.banner?` | `string` (single string) |
| Merchant `CreateStoreData.banner?` | `string` (single) |

**Files involved:**
- `rezadmin/rez-admin-main/services/api/stores.ts:12`
- `rezmerchant/rez-merchant-master/services/api/stores.ts:93`

---

## FM-15 — Store `location.pincode`: present in merchant, absent in admin {#fm-15}
> **Status:** ✅ MISJUDGMENT — admin store pincode field tracked with admin panel next sprint; consumer app pincode filtering is not active in production yet

**Severity:** MEDIUM
**Impact:** Admin panel cannot view or set store pincode. Stores created/edited by admin have no pincode in DB. Consumer app location filtering by pincode fails for admin-managed stores.

| Location | `location.pincode` |
|---|---|
| Merchant `StoreLocation.pincode` | present |
| Admin `AdminStore.location` | `{ city?, address? }` only — no pincode |

**Files involved:**
- `rezmerchant/rez-merchant-master/services/api/stores.ts:7`
- `rezadmin/rez-admin-main/services/api/stores.ts:29`

---

## FM-16 — Address `postalCode` vs `pincode`: manual translation in checkout {#fm-16}
> **Status:** ⏳ DEFERRED — fallback works; tracked for address API standardization sprint

**Severity:** MEDIUM
**Impact:** If the address API response field is ever renamed, the manual fallback `addr.postalCode || addr.pincode` silently returns `undefined`, causing order creation to fail (pincode is required).

| Location | Field Name |
|---|---|
| `Address` type (address API response) | `postalCode` |
| `CreateOrderRequest.deliveryAddress` | `pincode` (6-digit, required) |
| `useCheckout.ts:822` | manual: `addr.postalCode \|\| addr.pincode` |

**Files involved:**
- `rezapp/rez-master/hooks/useCheckout.ts:822`
- `rezapp/rez-master/services/addressApi.ts`

---

## FM-17 — OTA coins: snake_case paise values vs camelCase rupee values {#fm-17}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** OTA hotel booking flow reads coin balances as paise (`ota_coin_balance_paise`). If displayed directly against main wallet (in rupees), user sees 100x inflated balance. Coin burn requests send paise values to the OTA but the consumer app coin amount is in rupees — no conversion applied.

| Location | Field Name | Unit |
|---|---|---|
| OTA SSO response `data.user` | `ota_coin_balance_paise`, `rez_coin_balance_paise` | **paise** (1/100 rupee) |
| Main wallet API `coins[type='rez'].amount` | `amount` | **rupees** |
| OTA burn request | `rez_coin_requested_paise`, `hotel_brand_coin_requested_paise` | **paise** |
| Consumer app checkout | `coinsUsed.rezCoins` | **rupees** |

**Files involved:**
- `rezapp/rez-master/services/hotelOtaApi.ts`

---

## FM-18 — `PaymentStatus` name collision: 10-state FSM vs 8-state order sub-document FSM {#fm-18}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** The same TypeScript type name `PaymentStatus` refers to two different state machines depending on which file is imported. Code importing the wrong definition allows/rejects wrong transitions.

| Location | States |
|---|---|
| `rez-shared/src/paymentStatuses.ts PaymentStatus` (standalone payment) | 10: pending/processing/completed/failed/cancelled/expired/refund_initiated/refund_processing/refunded/refund_failed |
| `rezbackend/src/types/order.ts PaymentStatus` (order sub-doc) | 8: pending/awaiting_payment/processing/authorized/paid/failed/refunded/partially_refunded |
| `rezmerchant/types/api.ts PaymentStatus` | 8-state order version |
| `rezapp/types/order.ts PaymentStatus` | 8-state order version |
| `rezapp/types/payment.types.ts PaymentStatus` | 6 values (missing `expired`, `refund_initiated`, `refund_processing`, `refund_failed`) |

**Files involved:**
- `rez-shared/src/paymentStatuses.ts`
- `rezbackend/rez-backend-master/src/types/order.ts`
- `rezapp/rez-master/types/payment.types.ts`

---

## FM-19 — `bookingType` discriminant: `'table'` (rez-shared) vs `'table_booking'` (backend) {#fm-19}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Every `switch(booking.bookingType)` across the frontend/backend boundary silently falls through. No booking type is ever matched by rez-shared consumers reading backend data.

| Location | Value Set |
|---|---|
| `rez-shared/src/types/booking.types.ts BookingType` | `'table'`, `'service'`, `'event'`, `'ota'`, `'trial'` |
| `rezbackend/src/types/booking.types.ts BookingSource` | `'table_booking'`, `'service_booking'`, `'ota_booking'`, `'event_booking'`, `'trial_booking'` |

**Files involved:**
- `rez-shared/src/types/booking.types.ts`
- `rezbackend/rez-backend-master/src/types/booking.types.ts`

---

## FM-20 — Two merchant profile update endpoints with different field allowlists {#fm-20}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** A merchant updating their `logo` via `/auth/profile` sends `logo`. A component reading via `/profile` gets `logoUrl`. The same DB field is read/written via different key names through two different endpoints.

| Endpoint | Allowed Fields |
|---|---|
| `PUT /api/merchant/auth/profile` | `logo`, `coverImage`, `socialMedia`, `gstin`, `pan`, `preferences`, `notificationSettings` |
| `PUT /api/merchant/profile` | `logoUrl`, `coverImageUrl`, `socialLinks`, `gstNumber`, `panNumber`, `website`, `cuisine`, `tags` |

Same DB document, different key names for same underlying fields (`logo` vs `logoUrl`, `gstin` vs `gstNumber`, `socialMedia` vs `socialLinks`).

**Files involved:**
- `rez-merchant-service/src/routes/auth.ts:318`
- `rez-merchant-service/src/routes/merchants.ts:22`

---

## FM-21 — Admin merchant `create` sends `storeAddress` but merchant model uses `businessAddress` {#fm-21}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Admin-created merchants store the business address under `storeAddress` in the request, but the DB model stores it as `businessAddress`. The address is silently dropped.

| Location | Field Name |
|---|---|
| Admin `createMerchant` payload | `storeAddress.{street,city,state,zipCode,country}` |
| DB `Merchant.businessAddress` | `businessAddress.{street,city,state,zipCode,country}` |

**Files involved:**
- `rezadmin/rez-admin-main/services/api/merchants.ts`
- `rezbackend/rez-backend-master/src/models/Merchant.ts`

---

## FM-22 — Merchant login response shape: `data.merchant` vs `data.user` {#fm-22}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Merchant auth context expects `data.token` + `data.merchant`. Admin auth context expects `data.user` + `data.token`. Any shared auth utility used across both panels reads the wrong key.

| Panel | Login Response Expected |
|---|---|
| Admin | `{ data: { user: AdminUser, token, refreshToken? } }` |
| Merchant | `{ data: { token, refreshToken?, merchant: Merchant } }` |

The merchant app client-side synthesizes a `user` object from the `merchant` data (lines 21–28 of merchant `auth.ts`). This synthesized user is not the backend's user.

**Files involved:**
- `rezadmin/rez-admin-main/services/api/auth.ts:94-98`
- `rezmerchant/rez-merchant-master/services/api/auth.ts:19-28`

---

## FM-23 — Order cancel: `POST .../cancel` (admin) vs `PUT .../status` with `{status: 'cancelled'}` (merchant) {#fm-23}
> **Status:** ⏳ DEFERRED — different cancel endpoints by design; consolidation tracked as API cleanup

**Severity:** MEDIUM
**Impact:** Different HTTP methods, different endpoints, different payload shapes for the same action. If the backend route handler changes, only one panel breaks.

| Panel | Method + Endpoint | Payload |
|---|---|---|
| Admin | `POST admin/orders/:id/cancel` | `{ reason }` |
| Merchant | `PUT merchant/orders/:id/status` | `{ status: 'cancelled', notes?, notifyCustomer: true }` |

**Files involved:**
- `rezadmin/rez-admin-main/services/api/orders.ts:262`
- `rezmerchant/rez-merchant-master/services/api/orders.ts:378`

---

## FM-24 — Order status update response: `{success, message}` (admin) vs full `Order` object (merchant) {#fm-24}
> **Status:** ⏳ DEFERRED — response shape standardization tracked with API contract cleanup sprint

**Severity:** MEDIUM
**Impact:** If the admin and merchant apps share any order status update logic, one will receive `undefined` for the order object.

| Panel | `updateOrderStatus` response |
|---|---|
| Admin | `{ success: boolean, message: string }` |
| Merchant | Full `Order` object |

**Files involved:**
- `rezadmin/rez-admin-main/services/api/orders.ts:234`
- `rezmerchant/rez-merchant-master/services/api/orders.ts:199`

---

## FM-25 — `loyaltyTier` naming: 3 different tier systems using 3 different key names {#fm-25}
> **Status:** ⏳ DEFERRED — multi-tier system normalization requires product decision; tracked

**Severity:** MEDIUM
**Impact:** Any component trying to display the user's tier reads from the wrong field. `rezPlusTier` (subscription), `loyaltyTier` (gamification), and `tier` (API contract) are three different things but displayed in the same UI.

| Location | Field + Values |
|---|---|
| `rez-shared User.rezPlusTier` | `'free'|'premium'|'vip'` (subscription tier) |
| `rezapp/types/unified/User.ts loyaltyTier` | `'bronze'|'silver'|'gold'|'platinum'` (gamification) |
| `API_CONTRACTS.md /api/user/profile tier` | `'bronze'|'silver'|'gold'|'platinum'|'diamond'` (includes `diamond` which exists nowhere else) |
| `rezapp/types/profile.types.ts subscriptionTier` | `string` (free-form) |

**Files involved:**
- `rez-shared/src/types/user.types.ts`
- `rezapp/rez-master/types/unified/User.ts`
- `rezbackend/rez-backend-master/API_CONTRACTS.md`

---

## FM-26 — `Offer.store.id` optional in consumer type, required in rez-shared canonical {#fm-26}
> **Status:** ⏳ DEFERRED — consumer type tightening tracked with offer type cleanup sprint

**Severity:** MEDIUM
**Impact:** Consumer code passes offer objects with `store.id` absent. Any downstream code using the canonical rez-shared type that expects `store.id` to exist will get `undefined`.

| Location | `store.id` |
|---|---|
| `rez-shared/src/types/offer.types.ts OfferStoreRef` | `id: string` (required) |
| `rezapp/rez-master/types/offers.types.ts` | `store: { id?, name, rating?, verified? }` (optional) |

**Files involved:**
- `rez-shared/src/types/offer.types.ts`
- `rezapp/rez-master/types/offers.types.ts`

---

## FM-27 — `Offer._id` vs `Offer.id` across two type files in consumer app {#fm-27}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Two type files in the same app define `Offer` with different ID field names. Components switching between the deprecated API and new real API reference the wrong ID field.

| File | ID Field |
|---|---|
| `rezapp/rez-master/types/offers.types.ts` (used by deprecated `offersApi.ts`) | `id: string` |
| `rezapp/rez-master/services/realOffersApi.ts Offer interface` | `_id: string` |

**Files involved:**
- `rezapp/rez-master/types/offers.types.ts`
- `rezapp/rez-master/services/realOffersApi.ts`

---

## FM-28 — `isSuspended` (rez-shared/backend) vs `isBanned` (consumer unified types) {#fm-28}
> **Status:** ✅ FIXED — `rezapp/rez-master/types/unified/User.ts` updated to use `isSuspended?: boolean` matching backend field name

**Severity:** MEDIUM
**Impact:** Consumer unified User type uses `isBanned` and `banReason`. The backend model uses `isSuspended` and `suspendReason`. Suspension status always appears as `undefined` to code using the unified type.

| Location | Field |
|---|---|
| `rez-shared User.isSuspended` | `isSuspended?: boolean` |
| `rezbackend/models/User.ts IUser.isSuspended` | `isSuspended: boolean` |
| `rezapp/types/unified/User.ts` | `isBanned?: boolean`, `banReason?: string` |

**Files involved:**
- `rezapp/rez-master/types/unified/User.ts`

---

## FM-29 — `User.role` values differ: consumer unified type missing `support`, `operator`, `super_admin`; adds non-existent `moderator` {#fm-29}
> **Status:** ✅ FIXED — `rezapp/rez-master/types/unified/User.ts` role updated to `'user' | 'merchant' | 'admin' | 'support' | 'operator' | 'super_admin'` matching DB and rez-shared; `moderator` removed

**Severity:** MEDIUM
**Impact:** Consumer code rendering UI based on `user.role` will fail to match admin/operator users. `switch(user.role)` with a 'moderator' case will never match any real user (role doesn't exist in DB).

| Location | Role Values |
|---|---|
| `rez-shared User.role` | `'user'|'admin'|'merchant'|'support'|'operator'|'super_admin'` (6) |
| DB `User.role` | same 6 values |
| `rezapp/types/unified/User.ts role` | `'user'|'merchant'|'admin'|'moderator'` (4 — missing 3, adds 1 fake) |

**Files involved:**
- `rezapp/rez-master/types/unified/User.ts`

---

## FM-30 — `OrderDTO.payment.method` in dtos.ts uses `'online'` and `'mixed'` — not valid in any other definition {#fm-30}
> **Status:** ✅ MISJUDGMENT — `OrderDTO` is an internal shared DTO; no active consumer path uses online/mixed; the values are harmless legacy entries in the DTO that don't affect runtime

**Severity:** MEDIUM
**Impact:** Any code using `OrderDTO.payment.method` for payment method checks/display will incorrectly handle `'online'` and `'mixed'` values, which are not in the backend DB enum, not in the Zod validation schema, and not in any frontend type.

| Location | Values |
|---|---|
| `rez-shared/src/dtos.ts OrderDTO.payment.method` | `'cod'|'online'|'wallet'|'mixed'` |
| DB `Order.payment.method` | `'wallet'|'card'|'upi'|'cod'|'netbanking'|'razorpay'|'stripe'` |
| Zod `createOrderSchema.paymentMethod` | `'cod'|'wallet'|'razorpay'|'upi'|'card'|'netbanking'` |
| Consumer `CreateOrderRequest.paymentMethod` | `'wallet'|'card'|'upi'|'cod'|'netbanking'|'razorpay'` |

**Files involved:**
- `rez-shared/src/dtos.ts`
