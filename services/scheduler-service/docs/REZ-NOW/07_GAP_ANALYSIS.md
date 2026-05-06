# REZ Now — Gap Analysis

> **Status: AUDIT COMPLETE** | Date: 2026-04-14
> Audited repos: `rez-now` (frontend), `rezbackend/rez-backend-master` (backend)
> Audit scope: Bugs, duplicates, missing wiring, partial features, security, performance, tests, docs

---

## Table of Contents

1. [Critical Issues (Must Fix Before Launch)](#1-critical-issues)
2. [Bugs](#2-bugs)
3. [Duplicates](#3-duplicates)
4. [Missing Wiring](#4-missing-wiring)
5. [Partial Features](#5-partial-features)
6. [Security Gaps](#6-security-gaps)
7. [Performance Gaps](#7-performance-gaps)
8. [Test Coverage Gaps](#8-test-coverage-gaps)
9. [Documentation Gaps](#9-documentation-gaps)
10. [Status Summary](#10-status-summary)

---

## 1. Critical Issues

### CRIT-1: Payment Kiosk Frontend Does Not Exist (P0)

**Severity:** Critical

The `REZ_NOW_FEATURE_REFERENCE.md` Section 13 (Roadmap) and `REZ_NOW_SWIPE_MACHINE_REPLACEMENT.md` Section 7 both mark "Payment Kiosk Mode" as **BUILT** under Phase R1. The backend `emit-payment` endpoint exists at `webOrderingRoutes.ts:4185`, and `today-payments` API is listed as built. But the frontend component does not exist:

```
// Claimed built:
app/[storeSlug]/merchant/pay-display/page.tsx
app/[storeSlug]/merchant/pay-display/PayDisplayClient.tsx

// Searched entire rez-now tree — ZERO matches:
$ grep -r "PayDisplay" rez-now/
$ grep -r "pay-display" rez-now/
$ ls rez-now/app/[storeSlug]/merchant/
# Directory does not exist
```

**Impact:** Merchants cannot view live payment feeds on a tablet. The entire Payment Kiosk feature is non-functional for customers despite being marked complete.

**Fix:** Build `app/[storeSlug]/merchant/pay-display/page.tsx` and `PayDisplayClient.tsx`. The client must:
- Connect to Socket.IO namespace
- Listen for `payment:received` events on `store-{slug}` room
- Show Web Audio API "ding" on each payment
- Display today's total and transaction list
- Fetch historical `today-payments` on load

---

### CRIT-2: `emit-payment` Is Never Called (P0)

**Severity:** Critical

The `POST /api/web-ordering/store/:storeSlug/emit-payment` endpoint exists at `rezbackend/.../webOrderingRoutes.ts:4185-4218` and correctly emits `payment:received` to the Socket.IO room. However, it is **never called from any webhook handler or payment confirmation path**.

Searched all backend controllers:
```
rezbackend/.../src/controllers/razorpayController.ts:
  handleRazorpayWebhook() → dispatches to paymentQueue, push notification
  → NO emit-payment call

rezbackend/.../src/controllers/storePaymentController.ts:
  confirmPayment() → emits gamificationEventBus 'store_payment_confirmed'
  → NO emit-payment call

rezbackend/.../src/controllers/webhookController.ts:
  handleRazorpayWebhook() → emits 'payment-confirmed' via orderSocketService
  → NO payment:received to store-{slug} room

rezbackend/.../src/routes/webOrderingRoutes.ts:1213:
  /payment/verify → emits 'web-order:new' to merchant-{merchantId}
  → NOT 'payment:received' to store-{slug}
```

The `storePaymentController.ts` does emit `payment-confirmed` via `orderSocketService.emitToMerchant()` (line 1427), but that event name differs from what `emit-payment` sends (`payment:received`), and it emits to `merchant-{merchantId}`, not `store-{slug}`.

**Impact:** Even if the PayDisplay frontend existed, it would never receive live payment events.

**Fix:** Call `POST /api/web-ordering/store/:slug/emit-payment` from the payment webhook handler after `storePaymentController.confirmPayment()` completes successfully. Pass `paymentId`, `amount`, `customerName`, `customerPhone`, `razorpayPaymentId`. Alternatively, emit directly in the controller using `(global as any).io`.

---

### CRIT-3: `item.name` Used as `itemId` in Reorder (P0)

**File:** `rez-now/app/[storeSlug]/history/page.tsx:55`

```typescript
const cartItem: Omit<CartItem, 'quantity'> = {
  itemId: item.name, // history items only carry name; use name as best-effort id
  name: item.name,
  ...
};
```

**Problem:** `OrderHistoryItem` (from `lib/types/index.ts:161-169`) only stores `name`, not `id`. The reorder function uses `item.name` as the cart `itemId`. Two items with the same name (e.g., "Butter Chicken" from two different categories) would collide in the cart deduplication key.

The `cartStore.ts` uses `cartKey(itemId, customizations)` as the deduplication key (line 28-33). If two menu items share the same name, adding the second won't work correctly.

**Fix:** `getOrder()` returns `WebOrder` (not `OrderHistoryItem`) which has item-level data. The `doReorder` function already calls `getOrder(order.orderNumber)` — it should use `fullOrder.items[i].id` if available. If `WebOrder.items` also lacks IDs, the backend `WebOrder` model needs to be updated to include `itemId`.

---

## 2. Bugs

### BUG-1: Push Notification Subscribe Endpoints Mismatch (Medium)

**Files:**
- `rez-now/lib/push/webPush.ts:47` → `POST /api/web-ordering/push/subscribe`
- `rez-now/lib/utils/pushNotifications.ts:55` → `POST /api/notifications/push-subscribe`

Both files export `subscribeToPush()`. One sends to `/api/web-ordering/push/subscribe`, the other to `/api/notifications/push-subscribe`. These are two different backend routes. Both files are likely used in different parts of the app.

Additionally, `pushNotifications.ts:80` sends unsubscribe to `/api/notifications/push-unsubscribe` while `webPush.ts` has no unsubscribe function.

**Impact:** Push subscription state can be inconsistent. If the frontend uses both files, the backend may have subscriptions from one route but not the other.

**Fix:** Consolidate to a single file. Determine which backend route is canonical and remove the other.

---

### BUG-2: Checkout CouponInput Client-Side Validation Bypass (Medium)

**Files:**
- `rez-now/components/cart/CouponInput.tsx` — server-side validation via `validateCoupon()` API call
- `rez-now/components/checkout/CouponInput.tsx:41-68` — client-side only validation against a pre-fetched list

The checkout `CouponInput` fetches available coupons via `getStoreCoupons()` (line 31) and validates locally (`applyCode`, lines 41-68). This means:
1. The discount is computed client-side with `calculateCouponDiscount(match, subtotal)` (line 63) — not server-verified
2. If the coupon list is stale, a valid coupon won't appear
3. If the user manipulates the `subtotal` prop, the discount could be wrong

The cart version correctly calls the backend via `validateCoupon()` which returns `CouponValidateResponse`.

**Fix:** Replace the checkout `CouponInput.applyCode()` to call `validateCoupon()` from `lib/api/cart.ts` instead of client-side validation, matching the cart component's approach.

---

### BUG-3: `sw.js` Caches `/_next/static/` With No Versioning (Low)

**File:** `rez-now/public/sw.js:89-114`

Static asset caching uses `cache-first` with no cache versioning. Next.js fingerprinting (hashed filenames) handles content changes, but the cache itself accumulates old static assets from previous deployments indefinitely. The `activate` handler (lines 20-34) only removes caches not in `knownCaches` — and the three named caches (`CACHE_NAME`, `MENU_CACHE_NAME`, `STATIC_CACHE_NAME`) are never version-bumped.

**Impact:** Disk space growth over time. Old JS/CSS chunks stay cached until manual SW unregistration.

**Fix:** Append a deployment hash to cache names, or use `cache.delete()` for known old cache names in the activate handler.

---

### BUG-4: Duplicate `urlBase64ToUint8Array` Return Type Inconsistency (Low)

**Files:**
- `rez-now/lib/push/webPush.ts:9-20` → returns `Uint8Array<ArrayBuffer>` (TypeScript generic + double-cast)
- `rez-now/lib/utils/pushNotifications.ts:14-23` → returns `ArrayBuffer`

The two implementations have incompatible return types for the same function. `PushManager.subscribe()` accepts `ArrayBuffer | Uint8Array`, so both work at runtime, but the TypeScript types diverge.

---

### BUG-5: `cartStore.ts` Reorder Key Uses `customizations` Reference (Low)

**File:** `rez-now/lib/store/cartStore.ts:28-33`

```typescript
function cartKey(itemId: string, customizations: Record<string, string[]>): string {
  const sorted = Object.entries(customizations)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [...v].sort());
  return `${itemId}__${JSON.stringify(sorted)}`;
}
```

The `customizations` parameter is typed as `Record<string, string[]>`. The `sameItem` function (line 35-37) calls `cartKey(a.itemId, a.customizations)` where `a.customizations` is `Record<string, string[]>`. This works. However, in `history/page.tsx:59`, customizations are set to `item.customizations ?? {}` where `item` is from `WebOrder.items` — which has type `Record<string, string[]>` from the `WebOrder` interface. This is consistent but fragile.

---

### BUG-6: `webPush.ts` Uses `window.atob` (Node/Browser Only) (Low)

**File:** `rez-now/lib/push/webPush.ts:12`

```typescript
const rawData = window.atob(base64);
```

`window.atob` is not available in non-browser environments. If this file is ever imported server-side (e.g., in an API route), it will throw. The other file `pushNotifications.ts:17` uses `atob()` (global, not `window.atob`), which is slightly more portable. Both should use the global `atob()`.

---

## 3. Duplicates

### DUP-1: `lib/push/webPush.ts` vs `lib/utils/pushNotifications.ts`

| Aspect | `webPush.ts` | `pushNotifications.ts` |
|--------|-------------|----------------------|
| Subscribe endpoint | `/api/web-ordering/push/subscribe` | `/api/notifications/push-subscribe` |
| Unsubscribe | Not implemented | Implemented |
| `urlBase64ToUint8Array` return | `Uint8Array<ArrayBuffer>` | `ArrayBuffer` |
| Permission check | `Notification.requestPermission()` + `'serviceWorker' in navigator` | Same |
| `atob` usage | `window.atob` | `atob` (global) |

**Recommendation:** Deprecate `lib/push/webPush.ts`. Keep `lib/utils/pushNotifications.ts` as canonical. Audit all import sites to confirm no split-brain subscription state.

---

### DUP-2: `components/cart/CouponInput.tsx` vs `components/checkout/CouponInput.tsx`

Both components implement coupon input for the same purpose. The cart version (line 45) calls `validateCoupon()` (server validation). The checkout version (lines 41-68) validates client-side against a pre-fetched list.

**Functional difference:**
- Cart: server-authoritative, correct
- Checkout: client-side only, potentially bypassable

**Recommendation:** Remove checkout `CouponInput`. Use the cart `CouponInput` in both locations, or create a shared `CouponField` component that accepts `onValidate: (code) => Promise<CouponValidateResponse>`.

---

### DUP-3: Redundant `/.well-known/apple-app-site-association` Route

**File:** `rez-now/app/.well-known/apple-app-site-association/route.ts`

A Next.js route handler at `.well-known/apple-app-site-association/route.ts` that generates the Apple App Site Association JSON. However, `REZ_NOW_FEATURE_REFERENCE.md` Section 12 correctly notes this is handled by Vercel's `vercel.json` rewrite.

**Issue:** The route also has `const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID ?? 'XXXXXXXXXX'` (line 3) — the placeholder is hardcoded in the fallback, which is a security concern for the source file itself.

**Recommendation:** Remove the route handler. Configure the AASA file as a static asset in `public/.well-known/`, or rely entirely on Vercel rewrites.

---

## 4. Missing Wiring

### WIRING-1: `emit-payment` Not Called from Any Payment Flow (Critical)

See CRIT-2 above. This is the root cause of the Payment Kiosk being non-functional.

---

### WIRING-2: Payment Kiosk Frontend Missing (Critical)

See CRIT-1 above. Even if `emit-payment` were wired, there is no frontend to consume the events.

---

### WIRING-3: WhatsApp Receipt Not Wired from Frontend (Medium)

**Backend:** `sendReorderWhatsApp()` is called in `webOrderingRoutes.ts:1254` after payment verification (fire-and-forget).

**Frontend:** No UI control for sending WhatsApp receipts. The `sendReceipt()` function exists in `lib/api/orders.ts:55-60` but is not called from any page (checkout success page, order confirmation page, receipt page).

**Fix:** Add "Send WhatsApp Receipt" button to the order confirmation page at `app/[storeSlug]/pay/confirm/[paymentId]/page.tsx`.

---

### WIRING-4: Loyalty Stamps Not Wired to Frontend (Medium)

**Backend:** `getLoyaltyStatus` and `redeemStamps` exist in `lib/api/loyalty.ts`.
**Frontend:** `LoyaltyWidget.tsx` component exists in `components/order/`. But it is not imported or used in any page. No store page or checkout page renders the loyalty widget.

**Fix:** Import and render `LoyaltyWidget` in `StorePageClient.tsx` and/or `CheckoutPage` when the store is a REZ program merchant (`store.isProgramMerchant`).

---

### WIRING-5: Service Worker Not Registered in App (Medium)

**File:** `rez-now/public/sw.js` exists with full caching, background sync, and push event handling.

**Issue:** No code in the Next.js app calls `navigator.serviceWorker.register('/sw.js')`. The service worker is never activated.

**Fix:** Add service worker registration in a root layout or a `useEffect` in a shared component:
```typescript
// In app/layout.tsx or a client component
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
}, []);
```

---

### WIRING-6: `INTERNAL_SERVICE_TOKEN` Not in Frontend Env Vars (Low)

**File:** `rez-now/.env.local` (not committed)

The `emit-payment` endpoint at `webOrderingRoutes.ts:4189` uses `requireInternalToken` middleware. This requires `INTERNAL_SERVICE_TOKEN` env var on the backend. While this is a backend concern, the frontend needs to know this token exists for future internal API calls.

Currently the `NEXT_PUBLIC_` env vars for rez-now (from `REZ_NOW_FEATURE_REFERENCE.md` Section 10) do not include any internal service token configuration.

---

### WIRING-7: Socket.IO URL Env Var Missing (Low)

The `useOrderSocket.ts:7` uses `NEXT_PUBLIC_SOCKET_URL` with a fallback to `https://api.rezapp.com`. This env var is documented in Section 10 but not confirmed as set in Vercel.

---

## 5. Partial Features

### PART-1: Bill Builder — Split-Only (Not Full Bill Entry)

**File:** `rez-now/app/[storeSlug]/bill/page.tsx`

The bill page exists and provides:
- Per-person split (2-10 people)
- GST calculation
- Share bill link
- QR placeholder (dashed box with "QR" text — no actual QR)

**Missing (Phase R2):**
- Merchant-side item entry (Bill Builder)
- Actual QR code generation tied to the bill total
- `POST /api/web-ordering/bill` backend endpoint
- Bill state management (`lib/store/billStore.ts`)

**Impact:** The Bill Builder is listed as Phase R2 and was never started. The bill page is useful for split-bill sharing but not for the core "merchant rings up items" use case.

---

### PART-2: NFC Tap-to-Pay (Chrome Android Only)

**File:** `rez-now/components/payment/NfcPayButton.tsx`

The NFC button exists and is imported in `app/[storeSlug]/pay/checkout/page.tsx`. The `useNfc.ts` hook provides NDEFReader wrapping with 10s timeout.

**Issue:** Web NFC API is only supported on Chrome for Android (since Chrome 89). iOS Safari, desktop browsers, and Samsung Internet do not support it. The button will show on unsupported browsers with no graceful degradation — it may fail silently or show an error.

**Fix:** Add `useNfcSupport()` hook that returns `{ supported: boolean }` and conditionally render the button. On unsupported browsers, hide the button entirely or show a tooltip explaining NFC requirements.

---

### PART-3: `displayMode` Universal Catalog Not Implemented

**File:** `REZ_NOW_UNIVERSAL_PLATFORM.md` Sections 3-4 define a universal catalog with `displayMode: 'menu' | 'catalog' | 'services' | 'appointments'`.

**Reality:** The store page (`app/[storeSlug]/StorePageClient.tsx`) only renders the menu-based UI. There are no `ProductCard`, `ServiceCard`, `VariantSelector`, `AppointmentSlotPicker`, or `BulkPricingBadge` components. The catalog-specific components listed in Section 5 of the universal platform doc do not exist.

**Impact:** REZ Now only supports restaurant/food ordering. Retail (kirana), salon, clinic, and service-based merchants cannot use the platform with appropriate UI.

---

### PART-4: Staff Dashboard — Partial

**File:** `rez-now/app/[storeSlug]/staff/page.tsx` + `StaffDashboardClient.tsx`

Exists but limited. Only supports waiter call queue. No shift management, no per-staff sales tracking, no cash float management.

---

## 6. Security Gaps

### SEC-1: Hardcoded Apple Team ID Placeholder in Source (Medium)

**File:** `rez-now/app/.well-known/apple-app-site-association/route.ts:3`

```typescript
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID ?? 'XXXXXXXXXX';
```

While `.env` defaults are common, the `XXXXXXXXXX` placeholder in the source file is a git-committed secret placeholder. Replace with a runtime check that throws if not configured.

---

### SEC-2: Cart Items Not Server-Validated on Reorder (Medium)

**File:** `rez-now/app/[storeSlug]/history/page.tsx:47-74`

When a user reorders, `doReorder()` calls `getOrder()` then directly populates `cartStore` with items. There is no call to `validateCart()` from `lib/api/cart.ts` to verify that menu items are still available, priced correctly, or not out of stock.

A malicious user could modify the cart store in localStorage to change prices before checkout, and the checkout page may not re-validate the cart server-side before payment.

**Fix:** After populating the cart from reorder, call `validateCart(storeSlug, items)` and reconcile the response with the cart. Show a warning if items are unavailable or priced changed.

---

### SEC-3: emit-payment Endpoint Has No Rate Limiting (Medium)

**File:** `rezbackend/.../webOrderingRoutes.ts:4189`

The `emit-payment` route uses `requireInternalToken` but has no `financialWriteRateLimit` or similar rate limiter. An attacker with the internal token could spam this endpoint.

**Fix:** Add `rateLimitMiddleware({ windowMs: 60000, max: 100 })` to the route.

---

### SEC-4: Order Verify Endpoint Accepts `sessionToken` (Legacy) (Low)

**File:** `rezbackend/.../webOrderingRoutes.ts:1143`

The `payment/verify` handler (line 1143) accepts `sessionToken` alongside the JWT Bearer header. `sessionToken` is a legacy auth mechanism. Supporting it alongside JWT creates a dual auth path. The `resolveCustomerPhone` function (line 1155) must handle both paths, which increases the attack surface.

**Fix:** Deprecate `sessionToken`. Remove from the API contract and route handler. Only accept JWT Bearer tokens.

---

### SEC-5: No CSRF Protection on State-Changing GET Requests (Low)

Several API routes use GET for potentially sensitive data without CSRF tokens. While Cookie-based CSRF is less relevant for Bearer token auth, the API does not set `SameSite=Strict` cookies for the `rez-auth` cookie (Zustand persist), leaving it potentially vulnerable to CSRF on older browsers.

**Fix:** Ensure `rez-auth` cookie has `SameSite=Lax` or `SameSite=Strict` and `Secure` flags.

---

### SEC-6: `authClient` Sends Bearer Token to Non-Base-URL Hosts (Low)

**File:** `rez-now/lib/api/client.ts:83-90`

The auth client interceptor checks for absolute URLs starting with `http://` or `https://` and skips the token if the URL doesn't start with `BASE_URL`. This is correct but fragile — any misconfiguration of `BASE_URL` could cause token leakage. The comment acknowledges this.

---

## 7. Performance Gaps

### PERF-1: No Route-Level Code Splitting (Medium)

All pages are bundled together. Merchant-specific pages (`staff/`, `merchant/`, `bill/`) are loaded even for customers who never access them. Next.js App Router handles server components automatically, but client components in these routes are still bundled.

**Fix:** Use `next/dynamic` with `ssr: false` for `StaffDashboardClient`, `PayDisplayClient` (when built), and `BillBuilderClient`.

---

### PERF-2: Socket.IO Connection Per Page Mount (Medium)

**File:** `rez-now/lib/hooks/useOrderSocket.ts`

Each page that mounts `useOrderSocket` creates a new Socket.IO connection. For users navigating between order tracking and checkout, multiple socket connections can be open simultaneously.

**Fix:** Extract socket management to a context provider that holds a single shared connection, scoped to the current order's room.

---

### PERF-3: No Image Optimization for Menu Photos (Low)

Menu item images are loaded via `next/image` with `StoreImage` wrapper. However, there is no CDN-level resizing or WebP conversion. Images from the backend may be served at full resolution.

**Fix:** Ensure the backend's image URLs point through a CDN that supports resizing (e.g., Cloudinary, Imgix, or a custom sharp-based loader).

---

### PERF-4: Menu API Stale-While-Revalidate Works But Cache TTL Is 24h (Low)

**File:** `rez-now/public/sw.js:7`

`MENU_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000` (24 hours) is very aggressive. Menu changes (price updates, item availability) won't reflect for up to 24 hours for repeat visitors.

**Fix:** Reduce to 1-4 hours for active stores. Or add a manual cache invalidation mechanism (e.g., `navigator.serviceWorker.controller.postMessage({ type: 'INVALIDATE_MENU', slug })`) triggered when the store page loads.

---

### PERF-5: `deduplicatedGet` in `client.ts` Uses Module-Level Map (Low)

**File:** `rez-now/lib/api/client.ts:10`

The `_inflightGets` Map is module-level and never cleaned up if a request hangs. Entries accumulate indefinitely if promises never settle (network issues). Memory leak on long-lived sessions.

**Fix:** Add a `finally` clause to remove the key on settle, or use a `AbortController` to cancel stale requests.

---

## 8. Test Coverage Gaps

### TEST-1: Zero Unit Tests for Zustand Stores (Critical)

`lib/store/authStore.ts`, `lib/store/cartStore.ts`, and `lib/store/uiStore.ts` have no unit tests. These are critical state management files that contain business logic (cart deduplication key, auth persistence, token refresh).

**Coverage needed:**
- `cartStore.addItem()`: adds quantity when item exists, creates new item otherwise
- `cartStore.removeItem()`: removes correct item
- `cartStore.updateQuantity()`: decreases to 0 removes item
- `cartStore.subtotal()`: correct arithmetic
- `authStore`: token persistence, logout
- `cartKey()` deduplication: same item, different customization, same name different id

---

### TEST-2: No E2E Tests for Payment Kiosk (Critical)

The Playwright config exists at `rez-now/playwright.config.ts`. E2E specs exist for:
- `store-menu.spec.ts`
- `scan-pay.spec.ts`
- `checkout.spec.ts`
- `order-tracking.spec.ts`
- `order-history.spec.ts`
- `cancellation.spec.ts`
- `staff.spec.ts`
- `delivery.spec.ts`
- `search.spec.ts`
- `store-search.spec.ts`

**Missing E2E tests:**
- Payment kiosk live feed (`merchant/pay-display`)
- QR code scanning flow
- Offline order queuing and sync
- Coupon application in checkout
- NFC tap-to-pay (manual only)

---

### TEST-3: No Tests for Offline Queue (`lib/utils/offlineQueue.ts`) (Medium)

Unit tests exist at `__tests__/utils/offlineQueue.test.ts` but they are minimal. The service worker `syncPendingOrders()` function is not tested.

---

### TEST-4: No API Client Tests (Medium)

`__tests__/api/client.test.ts` exists but does not cover:
- Token refresh queue (multiple concurrent 401s)
- `deduplicatedGet` promise deduplication
- Non-base-URL URL interception

---

### TEST-5: No Snapshot/Integration Tests for Key Pages (Low)

No visual regression or snapshot tests for:
- Store page with empty menu, open store, closed store
- Checkout page with all payment methods
- Order confirmation page
- Wallet page with zero balance, high balance

---

## 9. Documentation Gaps

### DOC-1: No Deployment Runbook

`REZ_NOW_FEATURE_REFERENCE.md` Section 11 lists env vars and deployment checklist, but there is no:
- Step-by-step Vercel deployment guide
- Domain configuration (`now.rez.money` DNS, Vercel project settings)
- Environment variable population guide (where to get each key)
- Post-deploy verification checklist
- Rollback procedure

---

### DOC-2: No API Documentation

The 17 API client modules in `lib/api/` have JSDoc comments but no generated API reference. The backend endpoints (`webOrderingRoutes.ts` has 4220+ lines with no structured API docs) lack OpenAPI/Swagger specs.

---

### DOC-3: No Troubleshooting Guide

No runbook for common issues:
- "Payment shows pending but customer says they paid"
- "Socket.IO not connecting on mobile"
- "Push notifications not working on Chrome"
- "QR code not scanning"
- "Coins not credited after payment"

---

### DOC-4: Feature Reference Has Incorrect Status

`REZ_NOW_FEATURE_REFERENCE.md` Section 13 (Roadmap) marks several items as "BUILT" that are not built:
- `emit-payment` endpoint: built (exists) but NOT wired
- Payment Kiosk: NOT built (frontend missing)
- Bill Builder: NOT built (only split-bill share exists)

---

## 10. Status Summary

### Fix Priority Matrix

| ID | Issue | Severity | Effort | Owner |
|----|-------|---------|--------|-------|
| CRIT-1 | Payment Kiosk frontend missing | P0 | High | rez-now |
| CRIT-2 | emit-payment never called | P0 | Medium | rezbackend |
| CRIT-3 | item.name as itemId in reorder | P0 | Low | rez-now |
| WIRING-4 | Loyalty stamps not wired | P1 | Low | rez-now |
| WIRING-5 | Service worker not registered | P1 | Low | rez-now |
| WIRING-3 | WhatsApp receipt not wired | P1 | Low | rez-now |
| BUG-1 | Push subscribe endpoint mismatch | P1 | Low | rez-now |
| BUG-2 | Checkout coupon bypass | P1 | Medium | rez-now |
| SEC-2 | Cart items not validated on reorder | P1 | Medium | rez-now |
| PART-2 | NFC button on unsupported browsers | P2 | Low | rez-now |
| WIRING-6 | INTERNAL_SERVICE_TOKEN missing | P2 | Low | infra |
| DUP-1 | webPush vs pushNotifications duplicate | P2 | Low | rez-now |
| DUP-2 | cart vs checkout CouponInput duplicate | P2 | Medium | rez-now |
| PART-1 | Bill Builder not built | P3 | High | rez-now |
| PART-3 | displayMode universal catalog | P3 | High | rez-now |
| TEST-1 | Zustand store unit tests | P1 | Medium | rez-now |
| TEST-2 | Payment kiosk E2E tests | P1 | Medium | rez-now |
| DOC-1 | Deployment runbook | P2 | Low | docs |
| DOC-4 | Feature reference corrections | P2 | Low | docs |

### What Is Actually Complete

The following Phase R1 items are genuinely complete and functional:

- Menu browsing and cart (`app/[storeSlug]/page.tsx`, `cart/page.tsx`)
- Checkout with Razorpay UPI (`checkout/page.tsx`)
- Order tracking with Socket.IO + polling fallback (`order/[orderNumber]/page.tsx`)
- Scan & Pay flow (`pay/page.tsx`, `pay/checkout/page.tsx`)
- Order history with reorder (`history/page.tsx`, `orders/page.tsx`)
- Wallet page (`wallet/page.tsx`)
- Profile page (`profile/page.tsx`)
- Store search (`search/page.tsx`)
- Reservation flow (`reserve/page.tsx`)
- Staff waiter call dashboard (`staff/page.tsx`)
- Split bill share (`bill/page.tsx` — split-only, not full bill builder)
- Auth: phone OTP flow with silent JWT refresh
- Offline: IndexedDB queue + service worker scaffolding
- Push: VAPID subscription (one of two competing implementations)
- i18n: EN/HI with next-intl
- PWA: manifest.json, offline fallback page
- SEO: sitemap, robots.txt, JSON-LD, OG images

### What Needs Building

- Payment Kiosk merchant display (Phase R1)
- emit-payment wiring into webhook (Phase R1)
- Full Bill Builder with merchant item entry + QR generation (Phase R2)
- Universal catalog (`displayMode` for retail/services/appointments) (Phase R2)
- AI chatbot (Phase R3)
- Sub-2s payment settlement (Phase R4)

---

*Audit performed: 2026-04-14 | Auditor: Claude Code | Tools: grep, glob, file read | Scope: rez-now (frontend), rez-backend-master (backend)*
