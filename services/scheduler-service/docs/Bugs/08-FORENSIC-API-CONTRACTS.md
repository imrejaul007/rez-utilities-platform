# REZ Forensic Audit — API Contract Bugs

**Audit Date:** 2026-04-13
**Coverage:** rezbackend, rez-wallet-service, rez-payment-service, rez-merchant-service; verified against Consumer, Admin, and Merchant app clients

---

## API-01 — `POST /api/orders`: Deprecated validator coexists with active schema; `stripUnknown` silently discards fields
> **Status:** ✅ FIXED

**Severity:** ❌ HIGH
**Files:**
- `rezbackend/src/validators/orderValidators.ts` — DEPRECATED (explicitly labeled, still present)
- `rezbackend/src/middleware/validation.ts` — ACTIVE (correct)

**Deprecated schema (wrong field names):**
```
shippingAddress, useWalletBalance
```

**Active schema (correct field names):**
```
deliveryAddress, coinsUsed, fulfillmentType
```

**How it breaks:**
Joi validator runs with `stripUnknown: true`. Any client sending `shippingAddress` (old field) has it silently dropped. `deliveryAddress` becomes `undefined`. Order delivery address is lost. Order created with no delivery address.

No error is returned. The client has no indication the address was discarded.

**Evidence:** Explicit comment in `orderValidators.ts`:
> "DEPRECATED: This schema uses the old field names. Do not use or import this schema."

**Risk:** Copy-paste during future development will pick up the deprecated file. The deprecated file should be deleted.

---

## API-02 — `POST /api/wallet/payment` (monolith) vs `POST /wallet/debit` (wallet-service): incompatible required fields
> **Status:** ✅ FIXED

**Severity:** ❌ HIGH

**Monolith `POST /api/wallet/payment` expects:**
```json
{ "amount": number, "orderId"?: string, "storeId"?: string, "storeName"?: string, "description"?: string }
// coinType NOT required
```

**Wallet-service `POST /wallet/debit` expects:**
```json
{ "amount": number, "coinType": string (REQUIRED), "source": string (REQUIRED), "description": string (REQUIRED) }
// orderId/storeId fields IGNORED
```

**Impact:**
- Consumer app built against monolith interface sends `{amount, orderId, storeId}` → wallet-service returns 400 (`coinType required`).
- If routed to wallet-service, all coin debit operations from the consumer fail with 400.
- No graceful fallback or adapter exists at the API gateway level.

---

## API-03 — `GET /wallet/transactions` pagination shape differs between monolith and wallet-service
> **Status:** ⏳ DEFERRED — pagination shape standardization tracked with wallet API unification sprint

**Severity:** ⚠️ RISK

**Monolith pagination envelope:**
```json
{ "pagination": { "page", "limit", "total", "totalPages", "hasMore" } }
```

**Wallet-service pagination envelope:**
```json
{ "pagination": { "total", "page", "hasMore" } }
// Missing: limit, totalPages
```

**Impact:**
Consumer app reading `pagination.totalPages` gets `undefined` from wallet-service. Page navigation UI breaks (cannot compute last page). The consumer may loop infinitely trying to load pages.

---

## API-04 — `GET /api/wallet/conversion-rate` response shape differs between monolith and wallet-service
> **Status:** ⏳ DEFERRED — response shape divergence tracked with wallet API unification sprint

**Severity:** ⚠️ RISK

**Monolith response:**
```json
{ "success": true, "data": { "coinToRupeeRate": 1 } }
```

**Wallet-service response:**
```json
{ "success": true, "data": { "coinToRupeeRate": 1, "exampleConversion": { "coins": 100, "rupees": 100 } } }
```

Consumer code that reads `data.exampleConversion` gets `undefined` when routed to the monolith.

---

## API-05 — `POST /api/wallet/redeem-coins`: double `success` field in response
> **Status:** ⏳ DEFERRED — redundant field; no client broken today, tracked as cleanup

**Severity:** ⚠️ LOW
**File:** `rezbackend/src/controllers/walletRedeemController.ts`

```json
{
  "success": true,      ← outer wrapper (from sendSuccess helper)
  "data": {
    "success": true,    ← redundant inner field
    "coinsRedeemed": 50,
    "discountApplied": 5.00,
    "newBalance": 200
  }
}
```

Clients checking `response.data.success` as the authoritative field will work now. If the inner `success` is removed in future, those clients break.

---

## API-06 — `POST /pay/initiate`: `purpose` field only accepts `'order'` on client-facing route
> **Status:** ⏳ DEFERRED — schema/handler divergence documented; other purposes not yet in active use

**Severity:** ⚠️ RISK
**File:** `rez-payment-service/src/routes/paymentRoutes.ts`

**Zod schema allows:**
```
purpose: 'order' | 'wallet_topup' | 'subscription' | 'refund' | 'other'
```

**Route-level restriction (not in schema, checked in handler):**
Only `purpose: 'order'` is accepted. All other purposes return 400.

**Impact:** Client sending `purpose: 'wallet_topup'` receives 400 with no indication that the field value is the problem. The schema implies all values are valid; the handler restricts silently.

---

## API-07 — `POST /wallet/credit` (wallet-service): role check is inside async handler, not middleware
> **Status:** ✅ FIXED

**Severity:** ❌ HIGH (security)
**File:** `rez-wallet-service/src/routes/walletRoutes.ts`

```typescript
router.post('/credit', authenticate, async (req, res) => {
  if (!isAdminOrOperator(req.user.role)) {    // ← check INSIDE handler
    return res.status(403)...
  }
  // credit logic
})
```

**Risk:** Auth middleware can theoretically be bypassed at the framework level (misconfiguration, middleware ordering bug). Role check should be at route registration level via dedicated middleware, not inside the async handler. Any future middleware refactor that accidentally skips `authenticate` would expose unlimited coin crediting to any caller.

---

## API-08 — `GET /internal/auth/user/:id`: phone returned as 10-digit string, not E.164
> **Status:** ⏳ DEFERRED — internal route; normalize with next internal auth API cleanup

**Severity:** ⚠️ RISK
**File:** `rezbackend/src/routes/authRoutes.ts`

Internal route returns:
```json
{ "userId": "string", "phone": "9876543210" }  // 10 digits, +91 stripped
```

All other auth endpoints return:
```json
{ "_id": "ObjectId", "phoneNumber": "+919876543210" }  // E.164
```

**Impact:**
- Services calling the internal route and passing `phone` to E.164 validators → validation failure.
- Caller expecting `_id` gets `userId` (different field name AND type: string vs ObjectId).

---

## API-09 — `POST /api/wallet/confirm-payment` returns 501 (Stripe disabled)
> **Status:** ⏳ DEFERRED — Stripe disabled by design; 501 gate intentional until Stripe integration completes

**Severity:** ⚠️ LOW
**File:** `rezbackend/src/routes/walletRoutes.ts`

Route exists, returns:
```
501 Not Implemented: "Payment confirmation via Stripe is not available. Use Razorpay or wallet payment methods."
```

Client receiving 501 has no way to know which gateway to use instead. Route should either be removed or return a 410 Gone with a redirect hint.

---

## API-10 — `POST /api/wallet/initiate-payment`: `paymentMethodType` was previously missing from Joi schema
> **Status:** ✅ FIXED

**Severity:** ⚠️ RISK (historical, documented as fixed but left as evidence)
**File:** `rezbackend/src/routes/walletRoutes.ts`
**Code comment (ISSUE-02):**
> "`paymentMethodType` was previously missing from the Joi schema. With `stripUnknown: true`, it was silently stripped before the controller read it, causing every call to fail with 400."

**Current status:** Fixed. However, this is an exact pattern of how silent field-stripping causes bugs that are impossible to diagnose from the client side. The same pattern exists in API-01 with `shippingAddress`.

---

## API-11 — Merchant order analytics: `dateStart`/`dateEnd` vs `dateFrom`/`dateTo` inconsistency
> **Status:** ⏳ DEFERRED — both aliases accepted; tracked for API contract cleanup sprint

**Severity:** ⚠️ LOW

| Endpoint | Date params |
|----------|------------|
| `GET /api/orders` (consumer) | `dateFrom`, `dateTo` |
| `GET merchant/orders/analytics` | `dateStart`/`dateFrom`, `dateEnd`/`dateTo` (both aliases) |

Both aliases accepted in analytics is a workaround for an inconsistency. Future removal of one alias breaks clients.

---

## API-12 — `POST store-payment/create-bill`: `totalAmount` was never sent (BUG-FIX documented in code)
> **Status:** ✅ FIXED

**Severity:** ⚠️ RISK (historical, documented in code)
**File:** `rezmerchant/rez-merchant-master/services/api/pos.ts:238-241`

Code comment:
> "BUG-FIX: `totalAmount` was never sent to backend — caused every POS bill to 400"

Now fixed. But `totalAmount` is documented as REQUIRED and backend returns 400 without it. Any future refactor that touches this payload must preserve `totalAmount`.

---

## API-13 — `GET /merchant/stores/active`: returns array, code normalizes to `[0]`
> **Status:** ⏳ DEFERRED — multi-store support not yet in scope; single-store assumption documented

**Severity:** ⚠️ RISK
**File:** `rezmerchant/rez-merchant-master/services/api/stores.ts:207-232`

Response: `[store1, store2, ...]` (array)
Client code: `return data[0]` — picks first store only.

For merchants with multiple active stores (a valid state), only the first store is used for all POS operations. All other stores are unreachable via this code path.

---

## API-14 — Merchant orders response: `total` and `totalCount` are identical duplicate fields
> **Status:** ⏳ DEFERRED — redundant field cleanup; tracked as tech debt

**Severity:** ⚠️ LOW
**File:** `rez-merchant-service/src/routes/orders.ts`

```json
{
  "total": 156,
  "totalCount": 156    // identical to total
}
```

Clients may be built against either field. If one is removed, they break.

---

## API-15 — `amountPaise` unit inconsistency: payout routes use paise, all others use rupees/coins
> **Status:** ⏳ DEFERRED — unit convention documented; paise routes are marked; tracked for standardization

**Severity:** ⚠️ RISK

| Endpoint | Amount unit |
|----------|------------|
| `POST /payouts/request` (wallet-service) | `amountPaise` (paise = 1/100 rupee) |
| `POST /internal/wallet/debit` (Hotel OTA) | `amountPaise` |
| `POST /api/wallet/payment` (monolith) | `amount` (coins, implied rupees) |
| `POST /merchant/wallet/withdraw` | `amount` (rupees) |
| `POST /pay/initiate` (payment-service) | `amount` (rupees) |

No consistent unit convention. A developer calling `POST /payouts/request` with `amount: 500` (intending ₹500) will actually request a ₹5 payout.

---

## API-16 — `merchant/auth/register`: password is optional — creates permanently OTP-only merchants
> **Status:** ⏳ DEFERRED — OTP-only path is acceptable MVP; set-initial-password endpoint tracked for Phase 2

**Severity:** ⚠️ RISK
**File:** `rez-merchant-service/src/routes/auth.ts`

```typescript
password: z.string().min(8).max(128).optional()   // optional
```

Merchant can register with no password. They can only authenticate via OTP forever, unless they later call `PUT /auth/change-password` (which requires a `currentPassword` — but they have none).

There is no `set-initial-password` endpoint. A password-less merchant is permanently locked into OTP auth with no upgrade path.

---

## API-17 — Campaign deals: `campaignId` param is `string` but `dealIndex` is a `digit string` (not integer)
> **Status:** ⏳ DEFERRED — JS coercion works today; strict type parsing tracked as cleanup

**Severity:** ⚠️ LOW
**File:** `rezbackend/src/routes/campaignRoutes.ts`
`POST /api/campaigns/:campaignId/deals/:dealIndex/redeem`

`dealIndex` is validated as a digit string regex, not parsed as an integer. Backend accesses `campaign.deals[dealIndex]` — JavaScript coerces string to integer for array access. This works but is fragile; any future strict typing will break.

---

## API-18 — `POST /api/orders` `coinsUsed.wasilCoins` field accepted but has no model counterpart
> **Status:** ⏳ DEFERRED — wasilCoins is legacy pre-migration artifact; removal tracked with order schema cleanup

**Severity:** ⚠️ MEDIUM
**File:** `rezbackend/src/middleware/validation.ts` (orderSchemas.createOrder)

```typescript
coinsUsed: {
  rezCoins: number,
  wasilCoins: number,   // ← accepted by validator
  promoCoins: number,
  ...
}
```

No `wasilCoins` field exists in `Wallet`, `CoinTransaction`, or `WalletCoinType`. Any value provided is accepted, then silently ignored in the debit logic.

---

## API-19 — `GET /api/loyalty/points/balance` tier thresholds hardcoded in controller, not in shared config
> **Status:** ✅ PARTIALLY FIXED — tier thresholds in `coinService.ts` `upgradeLoyaltyTierIfNeeded()` are now env-configurable (LOYALTY_TIER_SILVER_THRESHOLD=500, LOYALTY_TIER_GOLD_THRESHOLD=2000, LOYALTY_TIER_PLATINUM_THRESHOLD=10000). The inline thresholds in `loyaltyRedemptionController.ts` `{ Bronze:0, Silver:500, Gold:2000, Platinum:5000, Diamond:10000 }` should import from the same env-backed constants to ensure consistency; full centralization tracked for gamification service refactor.

**Severity:** ⚠️ RISK
**File:** `rezbackend/src/controllers/loyaltyRedemptionController.ts`

Tier thresholds defined inline:
```typescript
{ Bronze: 0, Silver: 500, Gold: 2000, Platinum: 5000, Diamond: 10000 }
```

If thresholds change, only this controller is updated. Other services computing tier eligibility (e.g., gamification-service, merchant-service) would have stale thresholds.

---

## API-20 — `POST /api/wallet/dev-topup` accepts `type: 'cashback'` but wallet-service Wallet model rejects it
> **Status:** ⏳ DEFERRED — dev topup route; ENUM-01 fix (F-C1) resolves the underlying wallet model rejection

**Severity:** ⚠️ RISK
**File:** `rezbackend/src/routes/walletRoutes.ts`

```typescript
type: Joi.string().valid('rez', 'promo', 'cashback')
```

Allows `type: 'cashback'` in dev topup. If this goes through rez-wallet-service path → `Wallet.coins[].type` validation fails (see ENUM-01). Dev topups of cashback type silently fail without error to developer.
