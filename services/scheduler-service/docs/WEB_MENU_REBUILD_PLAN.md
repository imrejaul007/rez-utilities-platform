# REZ Web Menu — Complete Rebuild Plan

> Written: 2026-04-11  
> Purpose: Full architecture + implementation plan for rebuilding rez-web-menu from source  
> Goal: Production-grade QR ordering platform that competes with UPI apps + Zomato table ordering  
> Rule: Build from source, never patch bundles again

---

## Table of Contents

1. [Why Rebuild](#1-why-rebuild)
2. [Tech Stack Decision](#2-tech-stack-decision)
3. [Complete Feature Inventory](#3-complete-feature-inventory)
4. [All Backend Routes (Mapped)](#4-all-backend-routes-mapped)
5. [All Connections (Admin + Merchant + Backend)](#5-all-connections)
6. [File & Folder Structure](#6-file--folder-structure)
7. [Environment Variables](#7-environment-variables)
8. [Implementation Phases](#8-implementation-phases)
9. [Page-by-Page Spec](#9-page-by-page-spec)
10. [State Management](#10-state-management)
11. [Auth Flow](#11-auth-flow)
12. [Payment Flow](#12-payment-flow)
13. [Socket.IO Integration](#13-socketio-integration)
14. [Error Handling Standards](#14-error-handling-standards)
15. [Testing Plan](#15-testing-plan)
16. [Deployment](#16-deployment)
17. [Known Risks](#17-known-risks)

---

## 1. Why Rebuild

| Problem | Impact |
|---------|--------|
| No source code in repo — only compiled bundles | Cannot rebuild, every fix is brittle bundle patching |
| App crashes on load if env var not server-injected | 100% downtime in any non-Vercel deploy |
| `clearSession()` called `getToken()` — JWT never cleared | Expired sessions cause cascading 401 errors |
| No 401 interceptor | Users get generic errors, no re-auth flow |
| Dispute + review buttons threw "Not implemented" | Core features completely broken for users |
| Not SEO-indexed | Store menus invisible to Google — zero organic discovery |
| No UPI deep links | Slower checkout than competitor apps |

---

## 2. Tech Stack Decision

**Next.js 14 (App Router) + TypeScript**

| Choice | Reason |
|--------|--------|
| Next.js App Router | SSR → store menus indexed by Google. No env var injection hacks. |
| TypeScript strict | Catches type mismatches (like `coinType: 'nuqta'` vs `'rez'`) at compile time |
| Zustand | Already used in current app — same pattern, no relearning |
| Axios | Already used — same interceptor pattern |
| Socket.IO client | Already configured on backend |
| Tailwind CSS | Already used — same design tokens |
| Vercel | Zero-config deploy, env vars in dashboard |

**NOT using:**
- React Query (overkill for this app size)
- tRPC (backend is Express REST, not tRPC)
- Redux (too heavy)

---

## 3. Complete Feature Inventory

### Currently Working (must preserve exactly)
- [ ] Store menu browse (categories + items + veg filter)
- [ ] Cart (add/remove/quantity)
- [ ] OTP phone login (guest session)
- [ ] Razorpay checkout
- [ ] REZ Coins balance display
- [ ] Coupon/promo code apply
- [ ] Bill splitting (equal split)
- [ ] Tip selection
- [ ] Group ordering (one QR, multiple people add items)
- [ ] Order confirmation + status polling
- [ ] Socket.IO live status updates (`web-order:status-update`)
- [ ] Order history
- [ ] Receipt (WhatsApp/email)
- [ ] Waiter call
- [ ] Bill request (request to pay at table)
- [ ] Loyalty stamps display
- [ ] Store review (star rating + comment)
- [ ] Feedback survey (post-order)
- [ ] Donations (round-up or fixed)
- [ ] Parcel/takeaway request
- [ ] AI recommendations
- [ ] REZ Coins earn (credit after order)
- [ ] Estimated prep time badge
- [ ] REZ Program / coin UI gating (isProgramMerchant)

### Bugs Fixed in Bundles (rebuild must include these fixes)
- [ ] 401/403 response interceptor → clear session + reload
- [ ] `clearSession()` removes both `rez_web_jwt` + `rez_web_refresh`
- [ ] Dispute report calls `/feedback` endpoint (not throw)
- [ ] Store review calls `/rate` endpoint (not throw)
- [ ] Coupon validate checks `!success` before returning
- [ ] Socket `connect_error` logged (not silently swallowed)
- [ ] Polling timeout (20 attempts) shows user message
- [ ] Razorpay SDK load failure surfaces error message
- [ ] Unauthenticated history page shows actionable message

### New Features (Phase 2+)
- [ ] UPI deep links (PhonePe, GPay, Paytm direct)
- [ ] PWA — offline support + "Add to Home Screen"
- [ ] Pre-order / schedule for later
- [ ] One-tap repeat last order
- [ ] Table-side chat with kitchen
- [ ] Per-person bill split (not just equal)
- [ ] Full loyalty tier view in order confirm
- [ ] Google Maps review CTA
- [ ] Direct URL access (no QR required) → `menu.rez.money/store-slug`
- [ ] Multi-language (Hindi priority)

---

## 4. All Backend Routes (Mapped)

**Base:** `https://api.rezapp.com/api/web-ordering`  
**Auth types:**
- `none` — no token needed
- `session` — `x-session-token` header (web OTP JWT)
- `internal` — `x-internal-token` header (backend-only)

| Method | Path | Auth | Used In |
|--------|------|------|---------|
| GET | `/store/:storeSlug` | none | MenuPage — loads store + menu |
| POST | `/otp/send` | none | LoginModal — send OTP to phone |
| POST | `/otp/verify` | none | LoginModal — verify OTP, returns JWT |
| GET | `/orders/history` | session | OrderHistoryPage |
| GET | `/order/:orderNumber` | session | OrderConfirmPage — status polling |
| POST | `/order/:orderNumber/cancel` | session | OrderConfirmPage |
| POST | `/order/:orderNumber/rate` | session | OrderConfirmPage — star rating |
| POST | `/order/:orderNumber/feedback` | session | OrderConfirmPage — survey + dispute |
| POST | `/order/:orderNumber/donate` | session | CheckoutPage — donation round-up |
| POST | `/order/:orderNumber/parcel` | session | CheckoutPage |
| PUT | `/order/:orderNumber/update-status` | internal | NOT called by web menu directly |
| POST | `/razorpay/create-order` | session | CheckoutPage — create Razorpay order |
| POST | `/payment/verify` | session | CheckoutPage — verify signature |
| POST | `/cart/validate` | none | CartPage — stock/availability check |
| POST | `/coupon/validate` | session | CartPage/CheckoutPage |
| GET | `/coins/balance` | session | CheckoutPage, OrderConfirmPage |
| POST | `/coins/credit` | session | OrderConfirmPage — credit coins after payment |
| POST | `/bill/request` | none | RequestBillPage |
| POST | `/bill/split` | session | CheckoutPage — split bill |
| GET | `/bill/:billId/split-status` | session | CheckoutPage |
| POST | `/group/create` | session | MenuPage — create group order |
| POST | `/group/join` | session | MenuPage — join group order |
| GET | `/group/:groupId` | session | MenuPage — group order status |
| POST | `/group/:groupId/add-items` | session | MenuPage |
| POST | `/group/:groupId/checkout` | session | CartPage |
| POST | `/receipt/send` | session | OrderConfirmPage — WhatsApp/email receipt |
| GET | `/recommendations` | none | MenuPage — AI recommended items |
| POST | `/waiter/call` | none | MenuPage |
| GET | `/loyalty/stamps` | session | OrderConfirmPage — stamp card |
| POST | `/tip` | session | CheckoutPage |
| POST | `/loyalty/stamps/issue` | session | Post-order stamp issue |
| GET | `/coins/balance` | session | Balance display |

**Merchant routes (called by merchant app, NOT web menu):**
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/merchant/web-orders` | Merchant app only |
| GET | `/api/merchant/web-orders/:orderNumber` | Merchant app only |
| PATCH | `/api/merchant/web-orders/:orderNumber/status` | Triggers `web-order:status-update` socket |

**Admin routes (affect web menu behavior):**
| Method | Path | Effect on web menu |
|--------|------|-------------------|
| PATCH | `/api/admin/stores/:id/program` | Sets `isProgramMerchant` → shows/hides coin UI |
| PATCH | `/api/admin/stores/:id/settings` | Sets `estimatedPrepMinutes` → shows wait time badge |

---

## 5. All Connections

### Web Menu → Backend
```
web menu (Next.js)
  └── lib/api/client.ts (axios, base: NEXT_PUBLIC_API_URL)
        ├── public client (no auth) → /store/:slug, /otp/*, /cart/validate, /waiter/call
        └── session client (x-session-token header) → all authenticated routes
              └── response interceptor: 401 → clearSession() + redirect to /:storeSlug
```

### Web Menu → Socket.IO
```
OrderConfirmPage mounts
  └── connect to NEXT_PUBLIC_SOCKET_URL
        └── join room (auto, by orderNumber)
              └── listen: 'web-order:status-update' { orderNumber, status, storeId }
                    └── update order status in UI
```

### Merchant App → Status Update → Web Menu
```
Merchant taps "Mark Ready" in [orderNumber].tsx
  └── PATCH /api/merchant/web-orders/:orderNumber/status
        └── backend updates WebOrder.status
        └── io.emit('web-order:status-update', { orderNumber, status, storeId })
        └── setImmediate: WhatsApp "order ready" to customerPhone
  Web menu OrderConfirmPage receives socket event → updates status live
```

### Admin → Web Menu Behavior
```
Admin toggles isProgramMerchant in merchants.tsx
  └── PATCH /api/admin/stores/:id/program { isProgramMerchant, baseCashbackPercent }
        └── Store.isProgramMerchant updated in MongoDB
  Next store menu fetch (GET /api/web-ordering/store/:slug) returns updated isProgramMerchant
  Web menu MenuPage shows/hides REZ Coins UI based on isProgramMerchant

Admin sets estimatedPrepMinutes
  └── PATCH /api/admin/stores/:id/settings { estimatedPrepMinutes }
  Web menu MenuPage shows "⏱ Ready in ~X mins" badge when > 0
```

### Data Types Contract (shared, must match backend exactly)

```typescript
// Store (from GET /store/:storeSlug)
interface StoreInfo {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  banner: string | null;
  address: string;
  phone: string;
  operatingHours: Record<string, { open: string; close: string }>;
  gstEnabled: boolean;
  gstPercent: number;
  googlePlaceId: string | null;
  isProgramMerchant: boolean;       // controls coin UI visibility
  estimatedPrepMinutes: number;     // 0 = don't show badge
  rewardRules: {
    baseCashbackPercent: number;
    coinsEnabled: boolean;
  };
}

// Order status flow (matches backend WEB_ORDER_TRANSITIONS)
type WebOrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

// Session token (stored in localStorage as 'rez_web_jwt')
// Refresh token (stored in localStorage as 'rez_web_refresh')
// BOTH must be removed on clearSession()
```

---

## 6. File & Folder Structure

```
rez-web-menu/                        ← root of new repo
├── .env.local                       ← local dev (gitignored)
├── .env.example                     ← committed template
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json                      ← rewrite rules (SPA-style for dynamic routes)
│
├── app/
│   ├── layout.tsx                   ← root layout (fonts, global providers)
│   ├── not-found.tsx                ← 404 page
│   │
│   ├── [storeSlug]/                 ← store namespace (all pages scoped to store)
│   │   ├── page.tsx                 ← MenuPage (store menu + categories + items)
│   │   ├── layout.tsx               ← store layout (loads store data, provides context)
│   │   ├── cart/
│   │   │   └── page.tsx             ← CartPage
│   │   ├── checkout/
│   │   │   └── page.tsx             ← CheckoutPage (Razorpay + coupon + tip + split)
│   │   ├── order/
│   │   │   └── [orderNumber]/
│   │   │       └── page.tsx         ← OrderConfirmPage (status + socket + receipt)
│   │   ├── history/
│   │   │   └── page.tsx             ← OrderHistoryPage
│   │   ├── receipt/
│   │   │   └── [orderNumber]/
│   │   │       └── page.tsx         ← ReceiptPage
│   │   └── bill/
│   │       └── page.tsx             ← RequestBillPage
│   │
│   └── api/                         ← Next.js API routes (thin proxies if needed)
│       └── health/
│           └── route.ts
│
├── components/
│   ├── ui/                          ← atoms: Button, Input, Badge, Spinner, Modal
│   ├── menu/
│   │   ├── MenuHeader.tsx           ← store name, logo, wait-time badge, status
│   │   ├── CategoryNav.tsx          ← horizontal scroll category tabs
│   │   ├── MenuItem.tsx             ← item card (name, price, veg icon, add button)
│   │   ├── SearchBar.tsx
│   │   └── CartSummaryBar.tsx       ← sticky bottom bar (X items · ₹Y → View Cart)
│   ├── cart/
│   │   ├── CartItem.tsx
│   │   ├── CartSummary.tsx          ← subtotal, GST, total
│   │   └── CouponInput.tsx
│   ├── checkout/
│   │   ├── TipSelector.tsx
│   │   ├── SplitBillModal.tsx
│   │   ├── GroupOrderModal.tsx
│   │   ├── PaymentOptions.tsx       ← Razorpay + UPI deep links
│   │   └── DonationToggle.tsx
│   ├── order/
│   │   ├── OrderStatusBar.tsx       ← live status with step indicators
│   │   ├── OrderItemList.tsx
│   │   ├── ReceiptActions.tsx       ← WhatsApp/email receipt
│   │   ├── RatingModal.tsx
│   │   ├── DisputeModal.tsx
│   │   └── StampCard.tsx
│   ├── auth/
│   │   └── LoginModal.tsx           ← phone input + OTP verify
│   └── shared/
│       ├── BottomNav.tsx
│       ├── RezCoinsBanner.tsx
│       └── WaiterCallButton.tsx
│
├── lib/
│   ├── api/
│   │   ├── client.ts                ← axios instances (public + session) + interceptors
│   │   ├── store.ts                 ← store menu API calls
│   │   ├── auth.ts                  ← OTP send/verify/logout
│   │   ├── orders.ts                ← order create, status, cancel, rate, feedback
│   │   ├── cart.ts                  ← validate, coupon
│   │   ├── coins.ts                 ← balance, credit
│   │   ├── payment.ts               ← razorpay create + verify
│   │   ├── bill.ts                  ← split, request
│   │   ├── group.ts                 ← group order CRUD
│   │   ├── receipt.ts               ← send receipt
│   │   └── loyalty.ts              ← stamps, tier
│   │
│   ├── store/                       ← Zustand stores
│   │   ├── cartStore.ts             ← items, session, storeSlug, tableNumber
│   │   ├── authStore.ts             ← phone, jwt, refreshToken
│   │   └── uiStore.ts               ← modals open/close state
│   │
│   ├── hooks/
│   │   ├── useOrderSocket.ts        ← Socket.IO live updates
│   │   ├── useOrderPolling.ts       ← fallback polling (exponential backoff)
│   │   └── useRazorpay.ts           ← SDK load + payment handler
│   │
│   ├── types/
│   │   └── index.ts                 ← ALL shared types (StoreInfo, Order, Cart, etc.)
│   │
│   └── utils/
│       ├── currency.ts              ← formatINR()
│       ├── time.ts                  ← formatTime()
│       └── upi.ts                   ← UPI deep link generators (PhonePe, GPay, Paytm)
│
└── public/
    ├── manifest.json                ← PWA manifest
    ├── sw.js                        ← service worker (offline support)
    └── icons/
```

---

## 7. Environment Variables

### `.env.example` (committed to repo)
```env
# Backend API base URL — no trailing slash
NEXT_PUBLIC_API_URL=https://api.rezapp.com

# Socket.IO server URL
NEXT_PUBLIC_SOCKET_URL=https://api.rezapp.com

# Razorpay public key (safe to expose)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx

# App metadata
NEXT_PUBLIC_APP_NAME=REZ Menu
NEXT_PUBLIC_APP_URL=https://menu.rez.money
```

### Vercel Dashboard (set per environment)
```
NEXT_PUBLIC_API_URL         = https://api.rezapp.com
NEXT_PUBLIC_SOCKET_URL      = https://api.rezapp.com
NEXT_PUBLIC_RAZORPAY_KEY_ID = rzp_live_xxx
```

**No secrets in env — all `NEXT_PUBLIC_*` keys are safe to expose in browser.**

---

## 8. Implementation Phases

### Phase 1 — Foundation + Feature Parity (Week 1-2)
Build everything the current bundles do, correctly, from source.

| Day | Task |
|-----|------|
| 1 | Scaffold Next.js app, folder structure, env, Vercel deploy |
| 1 | `lib/api/client.ts` — axios instances, interceptors (401 handling, session clear) |
| 1 | `lib/store/` — cartStore, authStore (with proper clearSession) |
| 2 | `app/[storeSlug]/layout.tsx` — load store data, provide context |
| 2 | `components/menu/` — MenuHeader, CategoryNav, MenuItem, CartSummaryBar |
| 2 | `app/[storeSlug]/page.tsx` — MenuPage |
| 3 | `components/auth/LoginModal.tsx` — OTP send + verify |
| 3 | `app/[storeSlug]/cart/page.tsx` — CartPage + CouponInput |
| 4 | `app/[storeSlug]/checkout/page.tsx` — TipSelector, SplitBillModal, PaymentOptions |
| 4 | `lib/hooks/useRazorpay.ts` — SDK load with `__razorpayLoadFailed` guard |
| 5 | `lib/hooks/useOrderSocket.ts` — Socket.IO + fallback polling |
| 5 | `app/[storeSlug]/order/[orderNumber]/page.tsx` — OrderConfirmPage |
| 5 | Receipt send (with phone guard), RatingModal, DisputeModal |
| 6 | OrderHistoryPage, ReceiptPage, RequestBillPage |
| 6 | Group ordering flow |
| 7 | PWA (manifest + service worker + offline page) |
| 7 | Full QA pass against all 30 backend routes |

### Phase 2 — Competitive Features (Week 3-4)
| Feature | Files |
|---------|-------|
| UPI deep links (PhonePe/GPay/Paytm) | `lib/utils/upi.ts`, `components/checkout/PaymentOptions.tsx` |
| Per-person bill split | `components/checkout/SplitBillModal.tsx` |
| Pre-order / schedule | `app/[storeSlug]/checkout/page.tsx` — datetime picker |
| One-tap repeat order | `app/[storeSlug]/history/page.tsx` |
| Loyalty tier widget | `components/order/LoyaltyWidget.tsx` |
| Google Maps review CTA | `components/order/OrderConfirm` — after rating |
| Direct URL (no QR needed) | Already works with `[storeSlug]` routing |
| Multi-language | `next-intl` library — Hindi first |

### Phase 3 — Analytics + Kitchen Chat (Month 2)
| Feature | Notes |
|---------|-------|
| Table-side chat with kitchen | Socket.IO new event type `table:message` |
| Web menu analytics per store | Admin `web-menu-analytics.tsx` screen |
| WhatsApp-only reorder | Backend webhook → parse reply → create order |

---

## 9. Page-by-Page Spec

### MenuPage (`/[storeSlug]?table=X`)
**Data loaded:** `GET /api/web-ordering/store/:storeSlug`  
**Renders:**
- Store header: logo, name, open/closed badge, wait-time badge (if `estimatedPrepMinutes > 0`)
- Promotions carousel (if `promotions.length > 0`)
- Veg/Non-Veg toggle filter
- Search bar
- Horizontal category tabs (sticky on scroll)
- Item cards: name, description, price, originalPrice (strikethrough if different), veg icon, spicy level, add button
- REZ Coins banner (only if `isProgramMerchant === true`)
- Group order join modal (if `?group=xxx` in URL)
- Waiter call button (if `tableNumber` set)
- Sticky bottom cart bar

**State:**
- `cartStore.items[]` — persisted in localStorage
- `cartStore.storeSlug` — to detect store change (clear cart on slug change)
- `cartStore.tableNumber` — from `?table=` query param

### CartPage (`/[storeSlug]/cart`)
**Actions:** validate cart (`POST /cart/validate`), apply coupon (`POST /coupon/validate`)  
**Renders:**
- Cart items with quantity controls
- Coupon input + validation result
- Cart summary (subtotal + GST + coupon discount + total)
- "Proceed to Checkout" button
- Empty cart state with "Back to Menu"

### CheckoutPage (`/[storeSlug]/checkout`)
**Actions:** create Razorpay order, verify payment, UPI deep links  
**Renders:**
- Order summary
- Tip selector (0%, 10%, 15%, custom)
- Donation toggle (round up to nearest ₹10)
- Bill split button → SplitBillModal
- Group order checkout
- Payment options:
  - Razorpay (UPI/Card/NetBanking via SDK)
  - UPI deep links: PhonePe / GPay / Paytm (Phase 2)
- Razorpay SDK failure fallback message

### OrderConfirmPage (`/[storeSlug]/order/[orderNumber]`)
**Real-time:** Socket.IO `web-order:status-update` + fallback polling  
**Status flow:** `pending_payment` → `confirmed` → `preparing` → `ready` → `completed`  
**Renders:**
- Live status bar with step indicators + animated progress
- Estimated time remaining (from `estimatedPrepMinutes`)
- Order items list
- Total with tip/split breakdown
- REZ Coins earned (after `POST /coins/credit`)
- Stamp card progress (if `isProgramMerchant`)
- Actions:
  - Send Receipt (WhatsApp/email) — guarded: only if `customerPhone` exists
  - Rate order (1-5 stars + comment)
  - Report problem (dispute → `/feedback`)
  - Cancel order (if status is `confirmed` only)
- Polling timeout message (after 20 attempts / 8.5 min)

---

## 10. State Management

### `authStore.ts`
```typescript
interface AuthState {
  phone: string | null;
  jwt: string | null;           // localStorage key: 'rez_web_jwt'
  refreshToken: string | null;  // localStorage key: 'rez_web_refresh'
  isLoggedIn: boolean;
  setSession: (phone: string, jwt: string, refresh: string) => void;
  clearSession: () => void;     // removes BOTH localStorage keys
}
```

### `cartStore.ts`
```typescript
interface CartState {
  storeSlug: string | null;
  tableNumber: string | null;
  items: CartItem[];
  groupOrderId: string | null;
  addItem / removeItem / updateQuantity / clearCart: ...
}
// Persisted to localStorage key: 'rez_cart'
// On storeSlug change: clearCart() automatically
```

### `uiStore.ts`
```typescript
interface UIState {
  loginModalOpen: boolean;
  loginModalCallback: (() => void) | null;  // what to do after login
  openLoginModal: (callback?: () => void) => void;
  closeLoginModal: () => void;
}
```

---

## 11. Auth Flow

```
User opens /[storeSlug]?table=3
  └── MenuPage loads store data (public, no auth)
  └── User taps "Add to Cart" → works, no auth needed
  └── User taps "Checkout" → CartPage
  └── User taps "Proceed to Checkout" → CheckoutPage
      └── IF no JWT in authStore → open LoginModal
            └── Enter phone → POST /otp/send
            └── Enter OTP → POST /otp/verify
                  └── Response: { jwt, refreshToken, phone }
                  └── authStore.setSession(phone, jwt, refreshToken)
                  └── localStorage.setItem('rez_web_jwt', jwt)
                  └── localStorage.setItem('rez_web_refresh', refreshToken)
                  └── Close modal → continue checkout
      └── IF JWT exists → proceed normally

JWT Expiry:
  └── Any API call returns 401
  └── axios response interceptor catches 401
  └── authStore.clearSession()
      └── localStorage.removeItem('rez_web_jwt')
      └── localStorage.removeItem('rez_web_refresh')
  └── uiStore.openLoginModal(retryCallback)
  └── After re-login, retryCallback() re-executes the original action
```

---

## 12. Payment Flow

```
CheckoutPage taps "Pay ₹XXX"
  └── Razorpay SDK check:
        └── IF window.__razorpayLoadFailed → show error "Pay at counter"
        └── IF typeof window.Razorpay === 'undefined' → show loading
  └── POST /razorpay/create-order { amount, storeSlug, tableNumber, items, tip, donation }
        └── Returns: { razorpayOrderId, amount, currency, keyId, orderNumber }
  └── Open Razorpay modal:
        {
          key: NEXT_PUBLIC_RAZORPAY_KEY_ID,
          order_id: razorpayOrderId,
          amount, currency,
          name: storeName,
          description: "Order #" + orderNumber,
          prefill: { contact: phone },
          handler: (response) => verifyPayment(response)
        }
  └── handler fires on success:
        └── POST /payment/verify { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderNumber }
        └── On success → navigate to /[storeSlug]/order/[orderNumber]
        └── On failure → show "Payment failed, try again"
  └── Razorpay modal dismiss → show "Payment cancelled"
```

---

## 13. Socket.IO Integration

```typescript
// lib/hooks/useOrderSocket.ts
export function useOrderSocket(orderNumber: string, onStatusUpdate: (status: string) => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const jwt = authStore.getState().jwt;
    if (!jwt) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      transports: ['websocket', 'polling'],
      timeout: 15_000,
      withCredentials: true,
      auth: { token: jwt },
    });

    socket.on('web-order:status-update', (data) => {
      if (data.orderNumber === orderNumber) {
        onStatusUpdate(data.status);
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[REZ Socket] Connection failed — polling active:', err.message);
      // fallback polling (useOrderPolling hook) handles updates
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [orderNumber]);
}
```

**Fallback polling (`useOrderPolling.ts`):**
- Intervals: `[2s, 4s, 8s, 16s, 30s]` then every 30s
- Max attempts: 20 (≈8.5 min total)
- Stops polling on: `completed`, `cancelled`, or max attempts
- On max attempts: shows user message (not silent timeout)

---

## 14. Error Handling Standards

| Scenario | Behavior |
|----------|----------|
| 401 from any API | Clear session, open LoginModal with retry callback |
| 404 store not found | Redirect to `/not-found` with "Store not found" message |
| Cart validate fails (item unavailable) | Show which items are unavailable, remove them |
| Coupon invalid | Show backend error message inline (not toast) |
| Razorpay SDK not loaded | Show "Pay at counter" message (not broken button) |
| Payment verification fails | Show "Payment failed" with retry + WhatsApp support link |
| Socket connect_error | Log warning, fallback polling continues silently |
| Polling timeout (20 attempts) | Show "Refresh or ask staff" with Retry button |
| Receipt send, no phone | Show "Enter phone to receive WhatsApp receipt" |
| Network offline | PWA service worker shows offline page |

---

## 15. Testing Plan

### Unit Tests (Jest + Testing Library)
- `authStore.clearSession()` → removes both localStorage keys
- `cartStore` → storeSlug change clears cart
- `formatINR()` → handles 0, negative, large numbers
- `generateUpiDeepLink()` → correct URL schemes per app

### Integration Tests (Playwright)
- Full order flow: open menu → add items → OTP login → checkout → Razorpay mock → confirm page
- Socket update: mock socket event → status bar updates
- Session expiry: mock 401 → login modal opens → re-login → original action resumes
- Coupon: invalid code → error shown; valid code → discount applied

### Manual QA Checklist (before deploy)
- [ ] All 30+ backend routes return expected shape
- [ ] `isProgramMerchant=false` → no coin UI shown
- [ ] `isProgramMerchant=true` → coin UI shown, coins credited after order
- [ ] Merchant marks order "ready" → web menu status updates live (socket)
- [ ] Admin changes `estimatedPrepMinutes` → wait-time badge shows/hides on next load
- [ ] Razorpay payment succeeds → redirects to order confirm → coins credited
- [ ] WhatsApp receipt sent (check WHATSAPP_TOKEN + WHATSAPP_PHONE_ID set on Render)
- [ ] Expired JWT → all pages redirect to login modal (not blank/error screen)
- [ ] Table number from `?table=X` persists through checkout to order
- [ ] Group order: 2 people scan same QR → both add items → one pays → order created

---

## 16. Deployment

### Vercel Configuration
```json
// vercel.json
{
  "rewrites": [{ "source": "/((?!_next|api|public).*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; connect-src 'self' https://api.rezapp.com wss://api.rezapp.com https://checkout.razorpay.com https://api.razorpay.com; frame-src https://api.razorpay.com https://checkout.razorpay.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com"
        }
      ]
    }
  ]
}
```

### Deploy Steps
1. Push to `main` branch → Vercel auto-deploys
2. Set all `NEXT_PUBLIC_*` env vars in Vercel dashboard
3. Point `menu.rez.money` custom domain to Vercel project
4. Verify `https://menu.rez.money/any-store-slug` loads correctly
5. Run manual QA checklist

### Backend (no changes needed for rebuild)
- All routes already exist
- `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` must be set on Render for WhatsApp to fire
- Socket.IO already emits `web-order:status-update` — no backend changes needed

---

## 17. Known Risks

| Risk | Mitigation |
|------|------------|
| Source code for current bundles is lost | Rebuild from scratch — use bundle audit as spec |
| Razorpay test/live key confusion | Use `NEXT_PUBLIC_RAZORPAY_KEY_ID` env var — never hardcode |
| Socket.IO CORS on new domain | Add `menu.rez.money` to backend CORS origins in `server.ts` |
| Redis session keys from old app | Old `rez_web_jwt` keys in localStorage still work (same JWT format). No migration needed |
| GST calculation precision | Use integer arithmetic (paise), never floating point |
| Group order race condition | Backend is authoritative — web menu just reads group state, not writes cart server-side |
| `coinType: 'nuqta'` in consumer app | Not web menu's bug — note it, don't copy it |

---

## Pre-Build Checklist

Before writing the first line of code:

- [ ] Confirm `NEXT_PUBLIC_API_URL` value (production backend URL)
- [ ] Confirm `NEXT_PUBLIC_SOCKET_URL` value (same as API URL)
- [ ] Get Razorpay live key ID from dashboard
- [ ] Add `menu.rez.money` to backend CORS allowed origins
- [ ] Confirm `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` set on Render
- [ ] Create new GitHub repo: `imrejaul007/rez-web-menu-v2` (or replace current)
- [ ] Create Vercel project linked to that repo
- [ ] Set all env vars in Vercel before first deploy

---

*Once this plan is approved, implementation starts with Phase 1 Day 1.*
