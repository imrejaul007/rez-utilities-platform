# REZ Platform — Full Transaction Flow Audit

> **Scope:** Search → Product Detail → Cart → Checkout → Payment → Order Confirmation → Social Sharing Cashback
> **Date:** March 27, 2026
> **Method:** Full autonomous code audit across frontend (rezapp) and backend (rezbackend)

---

## Overall Verdict

| Stage | Status | Notes |
|---|:---:|---|
| 🔍 Search | ✅ Working | Minor edge cases |
| 📦 Product Detail | ⚠️ Broken (critical) | Missing `storeId` on Add to Cart |
| 🛒 Cart | ⚠️ Broken (critical) | `storeId` never sent; interface missing field |
| 💳 Checkout | ⚠️ Partial | Price drift, rate limiting disabled |
| 💰 Payment | ⚠️ Partial | Amount never validated against order total |
| ✅ Order Confirmation | ✅ Working | Displays correctly |
| 📱 Social Share Cashback | ❌ Broken | Coins created but **never credited to wallet** |

---

## Stage 1 — Search

**Files:** `app/search.tsx`, `services/searchApi.ts`, `hooks/useSearchPage.ts`

### Working
- Debounced search (350ms, min 2 chars)
- Grouped search results with seller comparison
- Error state with retry
- Autocomplete, "Did you mean?", search history
- 6 API endpoints all correctly wired

### Bugs Found

#### 🔴 Empty ID bypasses navigation guard (`search.tsx:174`)
```typescript
const resultId = result.id || result.productId || result.storeId || '';
if (!resultId) return; // ← '' is falsy BUT passes when all three are undefined
```
If the backend returns a result with none of the three ID fields, `resultId` becomes `''` (empty string) which is falsy — so the guard fires. **Actually this is fine**, but if any field is `null` instead of `undefined`, the OR chain stops and `resultId = null`, bypassing the guard.

**Fix:**
```typescript
if (!resultId || !resultId.trim()) return;
```

#### 🟡 `storeId` not passed for regular search results (`search.tsx:180-183`)
Regular search results navigate without `storeId`. Seller comparison cards correctly pass it. This means product pages opened from regular search results won't have store context.

#### 🟡 No stale response prevention
Rapid typing triggers parallel API calls with no request ID tracking. The last response to arrive (potentially an older query) can overwrite newer results.

#### 🟡 No response null-guard in `searchApi.ts:334`
```typescript
return apiClient.get('/search/products-grouped', params);
// No null check on response.data.groupedProducts
```
If backend returns `{}` or `{ data: null }`, the destructure in `useSearchPage.ts:245` crashes silently.

---

## Stage 2 — Product Detail

**Files:** `app/product-page.tsx`, `services/productsApi.ts`

### Working
- Product data fetched from `/products/{id}`
- Price, rating, inventory, variants all mapped
- Lock Price modal
- Analytics tracking (fire-and-forget)
- Error state on fetch failure

### Bugs Found

#### 🔴 CRITICAL — `storeId` missing from Add to Cart call (`product-page.tsx:534`)
```typescript
const cartResponse = await cartApi.addToCart({
  productId: productId!,
  quantity: quantity,
  variant: cardData.selectedVariant as any,
  // ← storeId IS available as cardData?.store?._id but NOT passed
});
```
The store data IS loaded into `cardData.store._id` but is never sent to the cart API. Without `storeId`, the backend cannot group cart items by store, calculate store-specific delivery fees, or enforce store policies.

**Fix:** Pass `storeId` in the call:
```typescript
const cartResponse = await cartApi.addToCart({
  productId: productId!,
  storeId: cardData?.store?._id || (cardData as any)?.storeId,
  quantity: quantity,
  variant: cardData.selectedVariant as any,
});
```

#### 🔴 No authentication check before Add to Cart (`product-page.tsx:524`)
The `handleBuyPress` function makes the API call without checking `isAuthenticated`. The backend rejects with 401, but the user sees a generic error instead of a helpful "Please sign in" prompt.

**Fix:**
```typescript
const handleBuyPress = useCallback(async () => {
  if (!isAuthenticated) {
    platformAlertConfirm('Sign In Required', 'Please sign in to add items to cart',
      () => router.push('/sign-in'), 'Sign In');
    return;
  }
  // ... rest of handler
}, [...]);
```

#### 🟡 No inventory pre-check before Add to Cart
If `cardData.stock = 2` and `quantity = 5`, the backend rejects the request but the frontend has no pre-validation. Add a guard:
```typescript
if (cardData?.stock !== undefined && cardData.stock < quantity) {
  platformAlertSimple('Insufficient Stock', `Only ${cardData.stock} items available`);
  return;
}
```

#### 🟡 Quantity not merged on re-add
If user has 3 of an item in cart, navigates away, returns — the quantity input resets to 1. Tapping "Add" adds 1 more instead of prompting to update. Should detect existing cart item and show "Update quantity" instead.

#### 🟡 `cardData` not pre-passed from search
Search results have enough data to show the product page instantly, but `search.tsx` never serializes and passes `cardData` as a param. The product page already supports this via `params.cardData` (line 436-445) but nothing populates it.

---

## Stage 3 — Cart

**Files:** `app/cart.tsx`, `services/cartApi.ts`, `stores/cartStore.ts`

### Working
- Cart renders items with quantities, prices, totals
- Remove item, update quantity
- Locked items section
- Applied offers section
- Price recalculation from scratch (BUG FIX #7 — prevents price drift in UI)
- Coupon/promo code application

### Bugs Found

#### 🔴 CRITICAL — `storeId` field missing from `AddToCartRequest` interface (`cartApi.ts:201-220`)
```typescript
export interface AddToCartRequest {
  productId: string;
  quantity: number;
  // ← NO storeId field
  itemType?: 'product' | 'service' | 'event';
  variant?: { type: string; value: string };
}
```
Even if product-page.tsx passes `storeId`, the TypeScript interface rejects it. Multi-store cart is architecturally broken.

**Fix — add to interface:**
```typescript
export interface AddToCartRequest {
  productId: string;
  storeId?: string;   // ← ADD THIS
  quantity: number;
  itemType?: 'product' | 'service' | 'event';
  variant?: { type: string; value: string };
  serviceBookingDetails?: ServiceBookingDetails;
  metadata?: { ... };
}
```

#### 🟡 Checkout proceeds with invalid items (`cart.tsx:395-420`)
If `validateCart()` fails but there are *some* valid items, a modal shows but the "Proceed" path still navigates to checkout. Only fully-valid carts should proceed.

#### 🟡 Cart not persisted across app restarts
No persistence layer in `cartStore.ts`. User loses cart on app restart and must re-add everything. Easy to fix with Zustand `persist` middleware.

#### 🟡 Cart store defaults to no-ops if `CartProvider` is missing
All cart actions are `noop`/`noopAsync` by default. If `CartProvider` fails to mount (e.g., a crash during auth), cart actions silently do nothing with no error.

#### 🟡 4 API methods stub-only (`cartApi.ts:774-825`)
`getShippingEstimates()`, `moveToWishlist()`, `saveCartForLater()`, `mergeCart()` all return `"not yet available"`. Not blocking now but will cause UX issues when these screens are activated.

---

## Stage 4 — Checkout

**Files:** `app/checkout.tsx`, `services/ordersApi.ts`, `src/controllers/orderCreateController.ts`

### Working
- Delivery address form with regex validation
- Delivery slot picker (Morning/Afternoon/Evening/Night)
- Coin redemption toggle (REZ coins, promo coins, store promo coins)
- Coupon code application
- Fulfillment type selector (delivery/pickup/dine-in)
- Cart re-validation every 30 seconds
- Idempotency key on order creation (prevents duplicate orders on retry)
- Batch product fetch (no N+1 queries)
- Atomic stock deduction

### Bugs Found

#### 🔴 CRITICAL — Rate limiting disabled on order routes (`orderRoutes.ts:39-72`)
```typescript
// router.use(orderRateLimiter); ← COMMENTED OUT "for development"
```
Every order route — including order creation and status updates — is unprotected against DoS/spam in the current deployed state.

#### 🔴 Payment amount never validated against order total
`createPaymentOrder()` in `paymentController.ts` creates a Razorpay order but does not verify the Razorpay amount matches the stored order total. A customer could manipulate the amount field and pay less.

**Fix:**
```typescript
if (Math.abs(razorpayAmount - order.totals.total * 100) > 1) {
  return sendBadRequest(res, 'Payment amount mismatch');
}
```

#### 🟡 Price drift allowed up to 1% (`orderCreateController.ts:612`)
```typescript
const priceDiff = Math.abs(currentPrice - cartPrice) / currentPrice;
if (priceDiff > 0.01) return sendBadRequest(res, 'Price has changed');
// ↑ Allows up to 1% price manipulation
```
For a ₹10,000 order, this allows ₹100 in undetected price manipulation. Reduce to `0.001` (0.1%).

#### 🟡 Frontend checkout total may differ from backend enforced total
Backend validates individual item prices but not the final order total including platform fees and taxes. Frontend sends its own calculated total which the backend trusts.

#### 🟡 Idempotency key not consistently passed from frontend (`ordersApi.ts:269`)
```typescript
const key = idempotencyKey || `order-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
```
If the caller doesn't pass `idempotencyKey`, a new random key is generated per call. Network retry = new key = duplicate order. The caller (`useCheckout`) must generate and store a stable key per checkout session.

#### 🟡 Promo coin expiry check duplicated (`orderCreateController.ts:523-548`)
Both the legacy wallet path and the CoinTransaction path check promo coin expiry, but with slightly different logic. Could cause one path to allow expired coins that the other rejects.

---

## Stage 5 — Payment

**Files:** `app/payment.tsx`, `src/controllers/paymentController.ts`, `src/routes/paymentRoutes.ts`

### Working
- Razorpay integration (create order → verify signature → handle success)
- Stripe integration (create checkout session → verify)
- Webhook handler with signature verification and raw body parsing
- Idempotency middleware on all payment routes
- Fraud check on bank_offer bonus
- Audit trail (payment attempt logged before verification)
- Stock deduction on successful payment

### Bugs Found

#### 🔴 Razorpay payment amount not verified (`paymentController.ts:95-236`)
The `verifyPayment()` function verifies the **signature** (that the payment came from Razorpay) but does NOT verify the **amount** (that the customer paid the right amount). These are two different checks. Both are required.

#### 🟡 Stripe publishable key failure is silent (`payment.tsx:40-44`)
```typescript
if (!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  console.error('Stripe key missing');
  // ← Stripe UI still renders, just fails when user tries to pay
}
```
Should disable the Stripe payment option entirely if the key is missing.

#### 🟡 No payment processing timeout
The payment loading spinner has no timeout. If Razorpay/Stripe hangs (network issue, gateway down), the user is stuck on a loading screen indefinitely. Add a 30-second timeout that shows "Payment is taking longer than expected. Check your order history."

#### 🟡 Webhook doesn't handle all Razorpay event types
The webhook switch only handles `payment.captured`, `payment.failed`, `order.paid`. Missing: `refund.created`, `refund.processed`, `dispute.created`. These will be silently dropped.

---

## Stage 6 — Order Confirmation

**File:** `app/order-confirmation.tsx`

### Working
- Fetches order details from `/orders/{id}`
- Shows order summary, items, total, delivery address
- Displays `RewardsBreakdownCard` with earned cashback + coins
- Review eligibility logic (immediate for dine-in/pickup, after delivery for delivery orders)
- Share & Earn button navigates to `/earn-from-social-media`

### Issues
- Share button is shown immediately after order placement, but backend rejects shares until `status === 'delivered'`. User taps share, gets an error. Should show share button conditionally based on order status or fulfillment type.
- Order data is not pre-passed to the earn-from-social-media page — causes a double API fetch.

---

## Stage 7 — Social Sharing Cashback

**Files:** `app/earn-from-social-media.tsx`, `hooks/usePostOrderRewards.ts`, `src/services/shareService.ts`, `src/models/PendingCoinReward.ts`

### Working
- User can submit Instagram/Facebook/Twitter/TikTok post URL or media proof
- Backend validates post URLs
- Fraud prevention: duplicate URL check, daily (5 shares), weekly (200), monthly (500) limits
- 5% cashback calculation: `coinsEarned = Math.floor(orderTotal * 0.05)`
- `PendingCoinReward` record created for admin approval
- Socket notification sent to admin dashboard

### Bugs Found

#### 🔴 CRITICAL — Coins are created but **never credited to wallet**
This is the most important bug in this entire flow. The path is:

```
User submits share
  → shareService creates PendingCoinReward { status: 'pending' }
  → Admin approves → { status: 'approved' }
  → .creditCoins() must be called → { status: 'credited' }
  → coinService.awardCoins() → wallet balance increases ✅
```

**The problem:** Step 3 (`creditCoins()`) is **never triggered automatically.** No scheduled job, no webhook, no trigger calls `.creditCoins()` after admin approval. The only way coins get credited is via a manual admin endpoint:
```
POST /api/social-media/admin/fix-missing-credits
```
The existence of this "fix" endpoint (with comments like "posts marked 'credited' but have no CoinTransaction") confirms this is a known bug that has never been properly resolved.

**Fix:** Add a post-save hook or a cron job:
```typescript
// Option A: Mongoose post-save hook in PendingCoinReward model
PendingCoinRewardSchema.post('save', async function() {
  if (this.status === 'approved' && !this.creditedAt) {
    await this.creditCoins();
  }
});

// Option B: Cron job every 5 minutes
// SELECT * FROM pending_coin_rewards WHERE status='approved' AND creditedAt IS NULL
// → call .creditCoins() on each
```

#### 🔴 Share button shown before order is delivered
`usePostOrderRewards.ts` marks share as "always available" (line 226), but `shareService.ts` requires `order.status === 'delivered'` (line 352). User taps share on a pending/preparing order and gets a backend error.

**Fix:** In `usePostOrderRewards.ts`:
```typescript
const isShareable = ['delivered', 'dine_in', 'pickup', 'drive_thru'].includes(
  order?.status === 'delivered' ? 'delivered' : order?.fulfillmentType
);
```

#### 🟡 UI shows coins as "Earned" when they are actually "Pending"
`RewardsBreakdownCard.tsx` labels social share coins as earned. They are pending admin approval and may never be credited. Should show "Pending approval" until `PendingCoinReward.status === 'credited'`.

#### 🟡 Share status checked via two different endpoints
- MongoDB orders → `/api/shares/can-share/:orderId`
- StorePayment orders → `/api/social-media/shared-status`

These two paths can get out of sync. Consolidate to one endpoint.

#### 🟡 Frontend shows no daily limit warning
Backend enforces 5 purchase shares/day but frontend doesn't warn the user or disable the button. User gets a 429 error on the 6th attempt with no explanation.

---

## Priority Fix List

### Fix Now (blocks core functionality)

| # | Fix | File | Effort |
|---|---|---|:---:|
| 1 | Add `storeId` to `AddToCartRequest` interface | `cartApi.ts` | 15 min |
| 2 | Pass `storeId` in `handleBuyPress` on product page | `product-page.tsx` | 15 min |
| 3 | Re-enable rate limiting on order routes | `orderRoutes.ts` | 5 min |
| 4 | Validate Razorpay amount matches order total | `paymentController.ts` | 1 hr |
| 5 | Auto-trigger `creditCoins()` after admin approval | `PendingCoinReward.ts` or cron job | 2 hrs |

### Fix Before Launch

| # | Fix | File | Effort |
|---|---|---|:---:|
| 6 | Add auth check before Add to Cart | `product-page.tsx` | 30 min |
| 7 | Add inventory pre-check before Add to Cart | `product-page.tsx` | 30 min |
| 8 | Hide share button until order is delivered | `usePostOrderRewards.ts` | 30 min |
| 9 | Label pending coins as "Pending" not "Earned" | `RewardsBreakdownCard.tsx` | 15 min |
| 10 | Generate stable idempotency key per checkout session | `useCheckout.ts` | 1 hr |
| 11 | Reduce price drift tolerance from 1% to 0.1% | `orderCreateController.ts` | 5 min |
| 12 | Add 30s payment processing timeout | `payment.tsx` | 1 hr |
| 13 | Disable Stripe UI if publishable key is missing | `payment.tsx` | 30 min |

### Post-Launch Polish

| # | Fix | File | Effort |
|---|---|---|:---:|
| 14 | Persist cart across app restarts (Zustand persist) | `cartStore.ts` | 1 hr |
| 15 | Pre-pass `cardData` from search to product page | `search.tsx` | 1 hr |
| 16 | Add null-guard on search API response | `searchApi.ts` | 15 min |
| 17 | Add request cancellation for stale search | `useSearchPage.ts` | 2 hrs |
| 18 | Add front-end daily share limit warning | `earn-from-social-media.tsx` | 1 hr |
| 19 | Unify share status to single endpoint | Backend + frontend | 2 hrs |
| 20 | Handle missing Razorpay webhook events | `paymentController.ts` | 1 hr |

---

## What's Fully Working End-to-End

- Search with autocomplete, filters, seller comparison ✅
- Product detail page loading with all data ✅
- Single-store cart add/remove/update ✅
- Coupon and promo code application ✅
- Coin redemption at checkout ✅
- Delivery address + slot selection ✅
- Razorpay payment creation and signature verification ✅
- Order idempotency (no duplicate orders on retry) ✅
- Order confirmation screen ✅
- Review eligibility and routing ✅
- Social media post submission and fraud prevention ✅
- 5% cashback calculation ✅

## What's Broken or Incomplete

- Multi-store cart (`storeId` never sent) ❌
- Social sharing cashback actually reaching the wallet ❌
- Payment amount verification ❌
- Rate limiting on orders in production ❌
- Share button shown before order is delivered ❌

---

*REZ Transaction Flow Audit — March 27, 2026*
