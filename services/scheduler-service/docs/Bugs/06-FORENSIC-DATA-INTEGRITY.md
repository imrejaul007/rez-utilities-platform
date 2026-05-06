# REZ Forensic Audit — Data Integrity Bugs

**Audit Date:** 2026-04-13
**Audit Method:** 6-agent parallel full-stack forensic (backend schema, backend API, consumer, admin, merchant, microservices)
**ID Prefix:** F-C (Critical), F-H (High), F-M (Medium), F-L (Low)

---

## F-C1 — wallet-service `Wallet.coins[].type` missing `'cashback'` and `'referral'`
> **Status:** ✅ FIXED

**Severity:** CRITICAL — Active data loss in production
**File:** `rez-wallet-service/src/models/Wallet.ts:4`

**What the code says:**
```typescript
interface ICoinBalance {
  type: 'rez' | 'prive' | 'branded' | 'promo';  // 4 values
}
```

**What it should be:**
```typescript
type: 'rez' | 'prive' | 'branded' | 'promo' | 'cashback' | 'referral';  // 6 values
```

**Canonical source:** `rezbackend/src/constants/coinTypes.ts` — defines all 6.
**rez-shared canonical:** `rez-shared/src/types/wallet.types.ts:32` lists `WalletCoinType` as `'rez'|'prive'|'branded'|'promo'|'cashback'` (5 — referral intentionally excluded as tx-only bucket).

**Impact:**
- Any `cashback` or `referral` coin award written via `rez-wallet-service` triggers Mongoose `ValidationError` at `ICoinBalance` schema level.
- The `CoinTransaction` is created successfully (it uses full 6-value enum) but `Wallet.coins[]` balance bucket is NEVER updated.
- User earns cashback coins → `CoinTransaction` shows the credit → wallet balance shows 0.
- Silent data loss: no error returned to caller, no retry, no alert.

**Proof — data flow:**
```
walletService.creditCoins(userId, {type:'cashback', amount:50})
  → CoinTransaction.create({coinType:'cashback', ...})  ← succeeds ✅
  → Wallet.updateOne({coins.type:'cashback'}, {$inc:{coins.$.amount:50}})
      ← Mongoose: 'cashback' not in enum → ValidationError ❌
      ← Wallet.balance.cashback unchanged
```

---

## F-C2 — `LedgerEntry.coinType` missing `'cashback'` and `'referral'` — financial audit trail incomplete
> **Status:** ✅ FIXED

**Severity:** CRITICAL — Double-entry ledger has holes
**Files:**
- `rez-wallet-service/src/models/LedgerEntry.ts:49,84`
- `rezbackend/src/models/LedgerEntry.ts:49` (same restriction)

**What both say:**
```typescript
type LedgerCoinType = 'rez' | 'promo' | 'prive' | 'branded';  // 4 values only
```

**Impact:**
- Cashback and referral coin transactions have `CoinTransaction` records but NO `LedgerEntry`.
- The reconciliation endpoint (`GET /internal/reconcile`) computes balance from ledger entries. For cashback/referral coin holders: ledger sum ≠ wallet sum → every such user shows as a "discrepancy".
- Any financial audit will flag these users as having phantom balances.
- `GET /internal/reconcile` will return false positives for every user who has ever earned cashback or referral coins via the wallet-service path.

---

## F-C3 — Payment FSM split-brain between `rezbackend` and `rez-payment-service`
> **Status:** ✅ FIXED

**Severity:** CRITICAL — Unrecoverable payment states, broken refund pipeline
**Files:**
- `rezbackend/src/config/financialStateMachine.ts`
- `rez-payment-service/src/models/Payment.ts:36-47`

**Disagreement:**

| Transition | rezbackend | rez-payment-service |
|-----------|-----------|---------------------|
| `processing → cancelled` | ❌ NOT ALLOWED | ✅ ALLOWED |
| `failed → pending` (retry) | ✅ ALLOWED (up to 3x) | ❌ NOT ALLOWED (terminal) |

**Impact (processing→cancelled):**
1. Razorpay bank timeout → payment-service marks `processing → cancelled`.
2. rezbackend webhook handler receives Razorpay `payment.failed` event.
3. Backend tries transition `processing → failed` — allowed, executes.
4. NOW: payment-service DB says `cancelled`; rezbackend DB says `failed`.
5. Refund webhook from Razorpay → one service processes it, other rejects as invalid state.
6. Customer is charged; both services disagree on whether a refund should happen.

**Impact (failed→terminal):**
1. Payment fails in rez-payment-service → marked terminal.
2. Backend FSM allows `failed → pending` → backend retries.
3. Retry succeeds in backend → payment-service still has `failed`.
4. Double-charge risk: Razorpay captures twice, payment-service doesn't know.

---

## F-C4 — `rez-merchant-service` OfferType adds 5 values that fail Mongoose schema validation
> **Status:** ✅ FIXED

**Severity:** CRITICAL — Offers silently not persisted
**File:** `rez-merchant-service/src/utils/offerValidator.ts:14`

**What merchant-service allows:**
```
'discount' | 'cashback' | 'deal' | 'flash_sale' | 'loyalty' | 'gift_card' | 'voucher' | 'dynamic_pricing'
```

**What DB schema allows:**
```
'cashback' | 'discount' | 'voucher' | 'combo' | 'special' | 'walk_in'
```

**Invalid values (5):** `deal`, `flash_sale`, `loyalty`, `gift_card`, `dynamic_pricing`
**Missing from merchant-service (3):** `combo`, `special`, `walk_in`

**Impact:**
- Merchant creates offer with `type: 'deal'` → passes merchant-service validation ✅
- Request forwarded to rezbackend/MongoDB → Mongoose throws `ValidationError` on `type` field ❌
- Offer is NOT saved. Merchant UI shows no error (fire-and-forget or error silently swallowed).
- Merchant thinks offer is live. It does not exist in DB. Admin never sees it. Consumer never sees it.

---

## F-C5 — Order cancellation authority split between `rez-merchant-service` and backend
> **Status:** ✅ FIXED

**Severity:** CRITICAL — State split, refunds never triggered
**Files:**
- `rez-merchant-service/src/utils/orderStateMachine.ts:41-52`
- `rezbackend/src/config/orderStateMachine.ts` (canonical)

**rez-merchant-service MERCHANT_TRANSITIONS (wrong):**
```
placed    → ['confirmed', 'cancelled']
confirmed → ['preparing', 'cancelled']
preparing → ['ready', 'cancelled']
ready     → ['dispatched', 'cancelled']
```

**rezbackend canonical MERCHANT_TRANSITIONS:**
Merchants CANNOT cancel. Only the platform (admin/system) can cancel.

**Impact:**
1. Merchant cancels `confirmed` order via merchant-service → merchant-service marks `cancelled` in its local DB.
2. Backend receives sync/webhook → rejects transition (not in allowed transitions for merchants).
3. `rezbackend` `orders` collection still shows `confirmed`.
4. Consumer app polls `GET /api/orders/:id` → sees `confirmed` (from monolith).
5. Merchant dashboard shows `cancelled`.
6. **State split is permanent**: no reconciliation mechanism exists.
7. Refund pipeline (which lives in monolith) is never triggered → customer's money is held indefinitely.

---

## F-C6 — `rez-finance-service` uses `'success'` as terminal status; every other service uses `'completed'`
> **Status:** ✅ FIXED

**Severity:** CRITICAL — Finance transactions invisible to all other services
**File:** `rez-finance-service/src/models/FinanceTransaction.ts:4`

**finance-service FinanceTxStatus:**
```typescript
type FinanceTxStatus = 'pending' | 'success' | 'failed' | 'refunded';
```

**Every other service uses:** `'completed'` as the terminal positive status.

**`rez-shared/src/statusCompat.ts` normalization map:**
```
'completed' → 'paid'   (for order payment context)
```
This normalization would INCORRECTLY transform `FinanceTxStatus 'success'` if a status from the wrong service passes through it.

**Impact:**
- Admin filtering: `GET /admin/finance/transactions?status=completed` → returns 0 results (finance uses `'success'`).
- Consumer checking `financeTransaction.status === 'completed'` → always `false`.
- Refund eligibility checks that look for terminal status `'completed'` will never find finance transactions eligible for refund.
- Bill payment receipts that check `.status` will never show "paid" status.

---

## F-H1 — Legacy `'nuqta'` coin type in MongoDB documents fails Mongoose validation on update
> **Status:** ✅ FIXED

**Severity:** HIGH — Document update failures for legacy users
**Files:**
- `rez-shared/src/constants/coins.ts:29` (documents the issue)
- `rez-shared/src/types/wallet.types.ts:172` (documents the issue)
- `rezbackend/src/constants/coinTypes.ts` (does NOT include 'nuqta')

**What exists in MongoDB:**
Legacy coin transactions with `coinType: 'nuqta'` (prior to rebrand to REZ).

**What Mongoose schema enforces:**
```
COIN_TYPE_VALUES = ['rez', 'prive', 'branded', 'promo', 'cashback', 'referral']
// 'nuqta' is NOT in this list
```

**Impact:**
- Any `findOneAndUpdate`, `save()`, or `updateOne` on a document where `coinType === 'nuqta'` triggers Mongoose `ValidationError`.
- Legacy users who have pre-migration coin documents cannot have their wallet records updated.
- Coin expiry jobs, balance sync jobs, and admin adjustments will fail silently for these users.

**Note:** `rez-merchant-service/src/models/CoinTransaction.ts` uses `strict: false` — so it will happily re-write `nuqta` without error, creating schema divergence.

---

## F-H2 — `User.referralTier` enum and `REFERRAL_CONFIG.tiers` keys are completely different enumerations
> **Status:** ✅ FIXED

**Severity:** HIGH — Reward config never matches stored user tiers
**Files:**
- `rezbackend/src/models/User.ts:666` — `referralTier` field
- `rezbackend/src/config/rewardConfig.ts:96-134` — reward lookup config

**User.referralTier stored values:**
```
'STARTER' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND'
```

**REFERRAL_CONFIG.tiers keys:**
```
'STARTER' | 'PRO' | 'ELITE' | 'CHAMPION' | 'LEGEND'
```

**Overlap:** Only `'STARTER'` matches. All other tier names are different.

**Impact:**
- When referral reward logic does `REFERRAL_CONFIG.tiers[user.referralTier]` and `user.referralTier === 'BRONZE'`:
  - `REFERRAL_CONFIG.tiers['BRONZE']` → `undefined`
  - Referral reward calculation returns `undefined` → no reward given
- Only `STARTER` tier users get correct referral reward amounts.
- All other 5 tier levels (BRONZE through DIAMOND) silently return `undefined` reward configs.

---

## F-H3 — `User.profile.gender` schema has 4 values; TypeScript interface declares 3
> **Status:** ✅ FIXED

**Severity:** HIGH (subtle) — TypeScript type guard failures for 'prefer_not_to_say' users
**File:** `rezbackend/src/models/User.ts`

**Interface IUserProfile (line 13):**
```typescript
gender?: 'male' | 'female' | 'other';
```

**Schema enum (line 318):**
```typescript
enum: ['male', 'female', 'other', 'prefer_not_to_say']
```

**Impact:**
- Users who selected `prefer_not_to_say` at registration have a value stored in DB.
- TypeScript casts the document to `IUserProfile` — `gender` becomes typed as `'male'|'female'|'other'`.
- TypeScript `switch` or exhaustive checks on `gender` will not have a branch for `prefer_not_to_say`.
- Runtime: `gender === undefined` is false (value exists), but TypeScript tooling signals an unreachable type.
- Any logic that loops over allowed gender values from the interface (e.g., form validation) will reject this legitimate value.

---

## F-H4 — `User.profile.verificationStatus` exists in interface but NOT in Mongoose schema
> **Status:** ✅ FIXED

**Severity:** HIGH — Interface documents a field that is never persisted
**File:** `rezbackend/src/models/User.ts`

**IUserProfile interface (line 35):**
```typescript
verificationStatus?: 'pending' | 'approved' | 'rejected';
```

**Mongoose UserSchema:**
This field does NOT appear. It is never defined as a schema path.

**Impact:**
- Any code that writes `user.profile.verificationStatus = 'approved'` and calls `.save()` — the value is silently discarded (Mongoose `strict: true` by default strips unknown paths).
- Code that reads `user.profile.verificationStatus` will always get `undefined`.
- Verification status logic built on this field is a complete no-op.

---

## F-H5 — Three suspension state fields on User with no single source of truth
> **Status:** ✅ FIXED

**Severity:** HIGH — Admin and consumer may disagree on user suspension state
**File:** `rezbackend/src/models/User.ts`

**Three separate fields:**
```typescript
isActive: Boolean   // default: true   — canonical field
isSuspended: Boolean // default: false — legacy duplicate
status: String      // undefined in schema — legacy string field
```

**Admin UI check (users.tsx:334):**
```typescript
item.isSuspended || item.status === 'suspended' || item.isActive === false
```

**Consumer UI check:**
Only checks `isActive`.

**Impact scenario:**
1. Admin suspends user via one API path → only sets `isSuspended = true`, leaves `isActive = true`.
2. Consumer app checks `user.isActive` → still `true` → user can still use the app.
3. Admin sees user as suspended. Consumer sees user as active. State split.

Which field to set depends on which route was called. No single "suspend user" operation sets all three consistently.

---

## F-H6 — `loyaltyTier: 'diamond'` missing from Consumer `UnifiedUser` type
> **Status:** ✅ FIXED

**Severity:** HIGH — TypeScript error + undefined behavior for Diamond tier users
**File:** `rezapp/rez-master/types/unified/User.ts:73`

**What the type says:**
```typescript
loyaltyTier?: 'bronze' | 'silver' | 'gold' | 'platinum';
```

**What the loyalty system returns:**
`'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond'` (after normalization → `'diamond'`)

**Impact:**
- TypeScript: assigning `'diamond'` to `loyaltyTier` is a type error.
- Runtime: `'diamond'` users may hit `undefined` in any switch/conditional that uses this type.
- Diamond tier users see no badge, no special benefits displayed, appear as Platinum in UI.
- Diamond is a real tier with a 3x earning multiplier (10,000+ points). These users get no visual feedback of their tier.

---

## F-H7 — Admin normalizes `DIAMOND → 'platinum'` — Diamond tier information permanently lost
> **Status:** ✅ FIXED

**Severity:** HIGH — Diamond tier users treated as Platinum in admin panel
**File:** `rezadmin/rez-admin-main/app/(dashboard)/users.tsx:214-227`

**Admin normalization:**
```typescript
case 'DIAMOND': return 'platinum';  // loses 'diamond' entirely
```

**Impact:**
- Admin cannot distinguish Diamond users from Platinum users.
- Tier-based admin actions (e.g., rewards, segmentation, analytics) treat Diamond = Platinum.
- Diamond multiplier (3.0x) vs Platinum (2.5x) — admin analytics show wrong tier distribution.

---

## F-H8 — `priveTier` values in Merchant app are completely wrong
> **Status:** ✅ FIXED

**Severity:** HIGH — Merchant cannot target correct Prive tier users
**File:** `rezmerchant/rez-merchant-master/services/api/priveCampaigns.ts:14`

**Merchant app PriveTierRequired:**
```typescript
'none' | 'silver' | 'gold' | 'platinum'
```

**DB canonical `User.priveTier`:**
```typescript
'none' | 'entry' | 'signature' | 'elite'
```

**Impact:**
- Merchant sets campaign `priveTierRequired: 'gold'`.
- Backend checks `user.priveTier === 'gold'` → always `false` (no user has `priveTier: 'gold'`).
- Zero users are eligible for any Prive campaign created by merchants.
- Campaigns appear to run but no consumer ever qualifies.

---

## F-H9 — Offer category enum has 3 values missing from Merchant app
> **Status:** ✅ FIXED

**Severity:** HIGH — Merchants cannot create offers in 3 valid categories
**File:** `rezmerchant/rez-merchant-master/services/api/offers.ts:12-18`

**Merchant app offer categories (8):**
```
'mega' | 'student' | 'new_arrival' | 'trending' | 'food' | 'fashion' | 'electronics' | 'general'
```

**DB canonical (11):**
```
above + 'entertainment' | 'beauty' | 'wellness'
```

**Impact:**
- Merchants in entertainment, beauty, or wellness verticals cannot categorize their offers correctly.
- They must use an incorrect category (e.g., `'general'`) or leave it blank.
- Consumer category filters for these 3 categories return no merchant-created offers.

---

## F-H10 — `Wallet.statistics` field mismatch between wallet-service and canonical definition
> **Status:** ✅ FIXED

**Severity:** HIGH — Analytics show wrong totals; reconciliation fails
**Files:**
- `rez-wallet-service/src/models/Wallet.ts:36`
- `rezbackend/src/models/Wallet.ts` (6 fields — canonical)
- `rez-shared/src/types/wallet.types.ts:86` (6 fields — canonical)

**wallet-service has (4 fields):**
```typescript
{ totalEarned, totalSpent, totalCashback, transactionCount }
```

**Canonical has (6 fields):**
```typescript
{ totalEarned, totalSpent, totalCashback, totalRefunds, totalTopups, totalWithdrawals }
```

**Differences:**
- wallet-service is MISSING: `totalRefunds`, `totalTopups`, `totalWithdrawals`
- wallet-service ADDS: `transactionCount` (not in canonical, not in rez-shared)

**Impact:**
- Admin wallet analytics for `totalRefunds`, `totalTopups`, `totalWithdrawals` → `undefined` for wallet-service-written documents.
- Any aggregation pipeline summing these fields will under-count.
- `transactionCount` is written by wallet-service but read by nobody (orphaned field).

---

## F-H11 — `rez-merchant-service` writes to shared `cointransactions` collection with `strict: false`
> **Status:** ✅ FIXED

**Severity:** HIGH — Arbitrary data can corrupt the shared coins ledger
**File:** `rez-merchant-service/src/models/CoinTransaction.ts`

**What the code does:**
```typescript
const CoinTransactionSchema = new Schema({ ... }, { strict: false });
// strict: false means ANY field with ANY value is accepted and persisted
```

**Canonical:** `rezbackend/src/models/CoinTransaction.ts` enforces full enum validation on `type` (6 values), `coinType` (6 values), `source` (52 values), `coinStatus` (4 values).

**Both models write to the same MongoDB collection:** `cointransactions`

**Impact:**
- Merchant-service can write `coinType: 'nuqta'`, `source: 'whatever'`, `status: 'random_value'` → all persisted.
- rezbackend reads this collection and expects enum-validated data.
- Idempotency index `achievement_idempotency_idx` (partial filter on `metadata.achievementId`) may not match merchant-written documents → duplicate awards.
- Data integrity of the entire coin ledger depends on all writers enforcing the same schema.

---

## F-M1 — `User.profile.timezone` default `'Asia/Kolkata'` hardcoded but internationalization planned
> **Status:** ⏳ DEFERRED — i18n/multi-region timezone support not yet in scope; tracked for Phase 2

**Severity:** MEDIUM
**File:** `rezbackend/src/models/User.ts`
**Issue:** Default timezone is `'Asia/Kolkata'`. Dubai region (`x-rez-region: dubai`) users get IST timezone by default. Streak calculations and scheduled drops use this timezone. Dubai users' streaks reset at IST midnight, not UAE midnight.

---

## F-M2 — `Wallet.currency` enum has unused values `'NC'` and `'REZ_COIN'`
> **Status:** ⏳ DEFERRED — dead enum cleanup requires migration; low risk, tracked as tech debt

**Severity:** MEDIUM
**File:** `rezbackend/src/models/Wallet.ts`
**What exists:** `enum: ['RC', 'NC', 'REZ_COIN', 'INR']`, default `'RC'`
**What's used:** Only `'RC'` in practice (code comments confirm this)
**Impact:** If any code path accidentally sets `currency: 'NC'` or `'REZ_COIN'`, currency conversion logic that checks `currency === 'RC'` will fail. Dead enum values create maintenance confusion.

---

## F-M3 — `offer.status === 'pending'` in Consumer vs actual value `'pending_approval'`
> **Status:** ✅ FIXED (see FL-02 in 09-FORENSIC-FRONTEND-LOGIC.md — already fixed in prior sprint)

**Severity:** MEDIUM — Redemption check never triggers for pending-approval offers
**File:** `rezapp/rez-master/app/offers/[id].tsx:200`

**Consumer code:**
```typescript
r.status === 'active' || r.status === 'pending'
```

**Backend returns:** `'pending_approval'` (not `'pending'`)

**Impact:** Offers awaiting admin approval → status is `'pending_approval'` → consumer check for `'pending'` never matches → these offers are incorrectly treated as ineligible for redemption display.

---

## F-M4 — Booking status `'hold'` used in UI but not in Mongoose schema
> **Status:** ✅ FIXED (prior sprint — ENUM-10) — `'hold'` removed from cancel condition in my-bookings.tsx

**Severity:** MEDIUM — Dead conditional, confusing code
**File:** `rezapp/rez-master/app/my-bookings.tsx:373`

**Consumer code:**
```typescript
status === 'confirmed' || status === 'hold'   // table cancel condition
```

**ServiceBooking schema statuses:**
```
'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'refunded' | 'expired'
```

`'hold'` is NOT in the schema. No booking can ever have this status. The `|| status === 'hold'` branch is permanently dead code.

---

## F-M5 — `'upcoming'` and `'past'` used as booking status filter values — not real statuses
> **Status:** ✅ FIXED (2026-04-13) — backend now translates pseudo-statuses to date-range queries

**Severity:** MEDIUM — Filter semantics unclear; may cause backend query errors
**File:** `rezapp/rez-master/services/bookingApi.ts`

**Consumer sends:**
```typescript
status?: 'upcoming' | 'past' | 'cancelled' | 'completed'
```

**DB schema statuses:** No `'upcoming'` or `'past'` values exist.

**Impact:** If backend passes `status` filter directly to MongoDB query: `{status: 'upcoming'}` → 0 results. Backend must explicitly handle these as computed filters (date-based), not enum values. If not handled, consumer's booking list is always empty for these tabs.

**Fix applied:** Updated `getUserBookings` in `rezbackend/.../controllers/serviceBookingController.ts` to intercept `'upcoming'` and `'past'` before building the MongoDB query. `upcoming` maps to `$or: [{bookingDate: {$gte: now}}, {status: {$in: ['pending','confirmed','assigned','in_progress']}}]`. `past` maps to terminal statuses plus past-dated bookings. Real status enum values pass through unchanged.

---

## F-M6 — `earn-from-social-media.tsx` checks UPPERCASE `'COMPLETED'` — will never match
> **Status:** ✅ FIXED (prior sprint — ENUM-13) — check now uses lowercase `'completed'`

**Severity:** MEDIUM — Social media earning confirmation never triggers
**File:** `rezapp/rez-master/app/earn-from-social-media.tsx:204`

**Consumer code:**
```typescript
txn.status === 'COMPLETED'
```

**Backend Transaction.status values:** `'pending'|'processing'|'completed'|'failed'|'cancelled'|'reversed'`

All lowercase. `'COMPLETED'` never matches `'completed'`.

**Impact:** The confirmation UI for social media earnings never shows, even when the transaction is complete. Users are left in limbo — coins credited but no confirmation shown.

---

## F-M7 — `'rezcoins'` payment method must be converted to `'wallet'` before API call
> **Status:** ⏳ DEFERRED — transformation is documented in code; enforcement to be added at order creation boundary

**Severity:** MEDIUM — Could cause order creation to fail
**File:** `rezapp/rez-master/types/payment.types.ts:8`

**Comment in code:**
> `'rezcoins'` is a UI-only concept. Before calling Order API, must map to `'wallet'`.

**Backend `Order.payment.method` enum:**
```
'wallet' | 'card' | 'upi' | 'cod' | 'netbanking' | 'razorpay' | 'stripe'
```
No `'rezcoins'` value exists.

**Risk:** If any code path sends `paymentMethod: 'rezcoins'` to `POST /api/orders` → Mongoose `ValidationError` → order not created. The transformation is documented but relies on every caller knowing to do it.

---

## F-M8 — `breakdown.cashback` vs `breakdown.cashbackBalance` fallback chain
> **Status:** ⏳ DEFERRED — fallback works today; legacy field removal scheduled with next wallet API cleanup

**Severity:** MEDIUM — Fragile dual-path reading
**File:** `rezapp/rez-master/services/walletApi.ts:56-121`

**Consumer reads:**
```typescript
breakdown.cashback ?? breakdown.cashbackBalance
breakdown.pending ?? breakdown.pendingRewards
```

**Backend sends:** `cashbackBalance` and `pendingRewards` (canonical field names).
`breakdown.cashback` and `breakdown.pending` are legacy field names that are no longer sent.

**Impact:** Works now only because of the `??` fallback. If the fallback is ever removed during a refactor, cashback and pending amounts show as `0` for all users.

---

## F-M9 — `User.role` in Consumer app has invented `'moderator'` value not in DB schema
> **Status:** ✅ FIXED (prior sprint) — `rezapp/rez-master/types/unified/User.ts` role field now correctly lists `'user' | 'merchant' | 'admin' | 'support' | 'operator' | 'super_admin'` (no `'moderator'`)

**Severity:** MEDIUM
**File:** `rezapp/rez-master/types/unified/User.ts:66`

**Consumer type:**
```typescript
role: 'user' | 'merchant' | 'admin' | 'moderator';
```

**DB schema User.role:**
```
'user' | 'admin' | 'merchant' | 'support' | 'operator' | 'super_admin'
```

**Inconsistency:**
- `'moderator'` does not exist in DB — it is invented in the frontend type.
- `'support'`, `'operator'`, `'super_admin'` exist in DB but not in the consumer type.
- Any backend user with `role: 'support'` appears as an unknown role in the consumer app.

---

## F-M10 — Offer `saleTag: 'mega_sale'` and `bogoType: 'buy2get50'` missing from Consumer types
> **Status:** ⏳ DEFERRED — offer type extension tracked with next consumer UI sprint

**Severity:** MEDIUM — These offers render without correct badge/label
**Files:**
- `rezapp/rez-master/types/offers.types.ts`

**Consumer SaleOffer tag:**
```typescript
'clearance' | 'sale' | 'last_pieces'
```

**DB schema (Offer.ts:469):** adds `'mega_sale'` — consumer type missing it.

**Consumer BOGOOffer:**
```typescript
'buy1get1' | 'buy2get1' | 'buy1get50'
```

**DB schema (Offer.ts:479):** adds `'buy2get50'` — consumer type missing it.

**Impact:** Offers with `saleTag: 'mega_sale'` or `bogoType: 'buy2get50'` render without the correct promotional badge.

---

## F-M11 — `wasilCoins` field in Order creation validator — orphaned, no DB model counterpart
> **Status:** ✅ HANDLED — `wasilCoins` is retained in Order model as a legacy field with `// Legacy field - kept for backward compatibility`. Migration 007 removes `null/0` values from DB. All coin debit paths fall back to `rezCoins || wasilCoins || 0`. Field is not orphaned — it has an explicit DB schema path and backward-compat code coverage.

**Severity:** MEDIUM
**File:** `rezbackend/src/middleware/validation.ts` (orderSchemas.createOrder)

**Order creation `coinsUsed`:**
```typescript
{ rezCoins, wasilCoins, promoCoins, storePromoCoins, totalCoinsValue }
```

**Wallet model and CoinTransaction model:** No `wasilCoins` field. No `WalletCoinType` of `'wasil'`.

**Impact:** `wasilCoins` is accepted by validator but has nowhere to go. Any coins specified here are accepted, validated, then silently ignored in the debit logic.

---

## F-L1 — `total` and `totalCount` duplicate fields in Merchant orders response
> **Status:** ⏳ DEFERRED — redundant field cleanup; tracked as tech debt

**Severity:** LOW
**File:** `rez-merchant-service/src/routes/orders.ts`
Response includes both `total: number` and `totalCount: number` with identical values.
Clients may use either field. If one is removed in a future update, clients using the other break.

---

## F-L2 — `dateStart`/`dateEnd` vs `dateFrom`/`dateTo` inconsistency
> **Status:** ⏳ DEFERRED — naming standardization tracked with API contract cleanup sprint

**Severity:** LOW
**Files:** Merchant analytics (`dateStart`/`dateEnd`) vs Consumer order list (`dateFrom`/`dateTo`)
Clients consuming both APIs must remember which naming convention each uses.

---

## F-L3 — Campaign type `'new-user'` uses hyphen; every other enum uses underscore
> **Status:** ⏳ DEFERRED — cosmetic enum inconsistency; migration required to rename; low risk

**Severity:** LOW
**File:** `rezbackend/src/models/Campaign.ts:38`
`type: 'new-user'` — the only hyphen-separated enum value in the codebase. All others use `_` (e.g., `'new_arrival'`, `'flash_sale'`). Creates inconsistency in URL query param encoding and string comparisons.

---

## F-L4 — Double `success` field in `POST /api/wallet/redeem-coins` response
> **Status:** ⏳ DEFERRED — redundant response field; no client broken today, tracked as cleanup

**Severity:** LOW
**File:** `rezbackend/src/controllers/walletRedeemController.ts`
Response: `{ success: true, data: { success: true, coinsRedeemed, discountApplied, newBalance } }`
The inner `success: true` inside `data` is redundant. Clients may be checking `data.success` instead of the outer `success`, which will cause subtle issues if the inner field is ever removed.

---

## F-L5 — `POST /api/wallet/confirm-payment` returns 501
> **Status:** ⏳ DEFERRED — Stripe disabled by design; 501 gate is intentional until Stripe integration completes

**Severity:** LOW
**File:** `rezbackend/src/routes/walletRoutes.ts`
Stripe payment confirmation is disabled (501 response). The route exists, giving the impression the feature is available. Clients that attempt Stripe confirmation receive a confusing `501 Not Implemented` with no indication of the correct alternative.

---

## F-L6 — `PriveMembership.tier` is an untyped String — no enum enforcement
> **Status:** ✅ FIXED (2026-04-13) — enum added with canonical Prive tier values

**Severity:** LOW
**File:** `rez-merchant-service/src/models/PriveMembership.ts:9`
```typescript
tier: String   // no enum, any value accepted
```
Any string can be written as a Prive tier. Combined with F-H8 (wrong tier values used in merchant app), this means merchant Prive memberships can have arbitrary tier strings that will never match `User.priveTier` values.

**Fix applied:** Added `enum: ['none', 'entry', 'signature', 'elite']` to the `tier` field to enforce the canonical `User.priveTier` values. Arbitrary strings are now rejected at the Mongoose schema level.

---

## F-L7 — `GET /merchant/stores/active` returns array; service normalizes to `[0]`
> **Status:** ⏳ DEFERRED — multi-store support not yet in scope; single-store assumption documented

**Severity:** LOW
**File:** `rezmerchant/rez-merchant-master/services/api/stores.ts:207-232`
Endpoint returns an array. Service code picks `data[0]` as the "active store". If a merchant has multiple active stores (possible), all but the first are silently ignored.

---

## F-L8 — `GET /api/wallet/conversion-rate` — different response shapes in monolith vs wallet-service
> **Status:** ⏳ DEFERRED — response shape divergence tracked with wallet API unification sprint

**Severity:** LOW
**Monolith response:** `{ coinToRupeeRate: 1 }`
**Wallet-service response:** `{ coinToRupeeRate: 1, exampleConversion: { coins: 100, rupees: 100 } }`
Same logical route, different shapes. Consumer depending on `exampleConversion` will get `undefined` if routed through monolith.

---

## F-L9 — Internal auth route returns 10-digit phone; all other routes return E.164
> **Status:** ⏳ DEFERRED — internal route only; normalize with next internal auth API cleanup

**Severity:** LOW
**File:** `rezbackend/src/routes/authRoutes.ts` (`/internal/auth/user/:id`)
Returns phone as `'9876543210'` (10 digits, +91 stripped). All other auth responses return E.164 (`'+919876543210'`).
Services calling this internal route and expecting E.164 format will get phone numbers that fail E.164 validation.

---

## F-L10 — `Marketing campaign status` and `Ad campaign status` have same field name, zero shared values
> **Status:** ⏳ DEFERRED — naming confusion only; no shared query path today; tracked as tech debt

**Severity:** LOW (naming confusion risk)
**Files:**
- `rez-marketing-service/src/models/MarketingCampaign.ts:21`: `'draft'|'scheduled'|'sending'|'sent'|'failed'|'cancelled'`
- `rez-shared/src/types/campaign.types.ts:99` AdCampaignStatus: `'draft'|'pending_review'|'active'|'paused'|'rejected'|'completed'`

Both use `status` field. Zero values overlap (except `'draft'`). Admin tooling that treats any campaign entity uniformly by `status` field will silently apply wrong logic depending on which type it encounters.
