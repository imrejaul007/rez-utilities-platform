# REZ Now — Complete Rebuild Plan (DEPRECATED)

> **DEPRECATED — DO NOT USE FOR REFERENCE**
> Superseded by: `REZ_NOW_FEATURE_REFERENCE.md` (accurate current state)
> Also see: `REZ_NOW_SWIPE_MACHINE_REPLACEMENT.md` (Phase R1-R4 roadmap)
> Also see: `REZ_NOW_UNIVERSAL_PLATFORM.md` (universal platform architecture)

> Written: 2026-04-11
> Product name: **REZ Now**
> Domain: **now.rez.money**
> Repo: **separate repo** (new GitHub repo, not rez-web-menu)
> Goal: Universal merchant payment platform — Order & Pay + Scan & Pay — competing with UPI apps

> **This document was the pre-build planning spec.** The rebuild is now **fully complete**. Refer to `REZ_NOW_FEATURE_REFERENCE.md` for accurate, ground-truth documentation of what was actually built.

---

## Table of Contents

1. [What REZ Now Is](#1-what-rez-now-is)
2. [Separate Repo + Domain Decision](#2-separate-repo--domain-decision)
3. [Tech Stack](#3-tech-stack)
4. [Two Core Flows](#4-two-core-flows)
5. [Merchant Types + UI Variants](#5-merchant-types--ui-variants)
6. [isProgramMerchant — Coin Gate Logic](#6-isprogrammerchant--coin-gate-logic)
7. [All Backend Routes (Mapped)](#7-all-backend-routes-mapped)
8. [Consumer App Deep Link Integration](#8-consumer-app-deep-link-integration)
9. [File & Folder Structure](#9-file--folder-structure)
10. [Environment Variables](#10-environment-variables)
11. [Data Types Contract](#11-data-types-contract)
12. [All Connections (Full Map)](#12-all-connections-full-map)
13. [State Management](#13-state-management)
14. [Auth Flow](#14-auth-flow)
15. [Order & Pay Flow (Full)](#15-order--pay-flow-full)
16. [Scan & Pay Flow (Full)](#16-scan--pay-flow-full)
17. [Socket.IO Integration](#17-socketio-integration)
18. [Error Handling Standards](#18-error-handling-standards)
19. [Page-by-Page Spec](#19-page-by-page-spec)
20. [Implementation Phases](#20-implementation-phases)
21. [PWA Spec](#21-pwa-spec)
22. [Testing Plan](#22-testing-plan)
23. [Deployment Checklist](#23-deployment-checklist)
24. [Changes Needed in Other Repos](#24-changes-needed-in-other-repos)
25. [Known Risks](#25-known-risks)

---

## 1. What REZ Now Is

REZ Now is a **universal merchant payment web app** — not a restaurant app, not just UPI, but both. Any merchant on the REZ platform gets a QR code that opens `now.rez.money/<slug>`. What the customer sees depends on the merchant type and flow.

### Two entry points

| Entry | URL | Who uses it |
|-------|-----|-------------|
| QR scan at merchant | `now.rez.money/<slug>?table=3` | Customer scans QR at table/counter |
| Direct URL / consumer app deep link | `now.rez.money/<slug>` | Customer taps link in REZ consumer app |

### Two flows

| Flow | Trigger | Use case |
|------|---------|---------|
| **Order & Pay** | Merchant has menu (`hasMenu: true`) | Restaurant, café, cloud kitchen |
| **Scan & Pay** | Merchant has no menu (`hasMenu: false`) | Salon, retail, hotel, service, any fixed-amount payment |

### One coin system

- `isProgramMerchant: true` → REZ Coins UI visible (earn/redeem)
- `isProgramMerchant: false` → coin UI hidden, purely payment

---

## 2. REZ Auth + REZ Wallet + Scan & Pay (Architecture Decision)

REZ Now uses the **same authentication, wallet, and payment infrastructure as the REZ consumer app** — not the isolated web-ordering session system.

### What this means

| Layer | Old web menu | REZ Now |
|-------|-------------|---------|
| Auth | `/api/web-ordering/otp/send` → `x-session-token` (isolated, no REZ account) | `/auth/otp/send` → `accessToken` (Bearer JWT, real REZ account) |
| Token header | `x-session-token: <jwt>` | `Authorization: Bearer <accessToken>` |
| User identity | Anonymous web session | Full REZ user (userId, profile, history) |
| Wallet | `/api/web-ordering/coins/*` (store-scoped only) | `/api/wallet/*` (full REZ Wallet — balance, transactions, earn, burn) |
| Scan & Pay | Not supported | `/api/store-payment/*` (already uses Bearer auth) |

### Microservices REZ Now uses

All requests go through `https://api.rezapp.com` (nginx API gateway → `rez-api-gateway`).

| Microservice | Repo | Gateway route | REZ Now usage |
|-------------|------|---------------|---------------|
| **rez-auth-service** | `rez-auth-service` | `/api/auth`, `/auth/*` | OTP login, PIN login, token refresh |
| **rez-wallet-service** | `rez-wallet-service` | `/api/wallet` | Coin balance, transaction history |
| **rez-backend-master** | `rezbackend/rez-backend-master` | `/api/web-ordering`, `/api/store-payment` | Order & Pay menu + checkout, Scan & Pay payment |
| **rez-notification-events** | `rez-notification-events` | called internally by backend | WhatsApp receipt (backend calls, not REZ Now directly) |
| **rez-payment-service** | `rez-payment-service` | `/api/payment` | Razorpay order + verify (may route here or to backend — check gateway) |

### Auth service endpoints (`/api/auth` → rez-auth-service)

```
POST /api/user/auth/send-otp     { phone, countryCode?, channel? }
→ { success, isNewUser, hasPIN }
  — hasPIN=true means existing REZ user with PIN. Show PIN entry, not OTP.

POST /api/user/auth/verify-otp   { phone, countryCode?, otp }
→ { success, accessToken, refreshToken, user, deviceRisk }
  — accessToken = Bearer JWT (same as consumer app)
  — user = { id, name, phone, role, isOnboarded }

POST /auth/pin/verify            { phone, countryCode?, pin }
→ { success, accessToken, refreshToken, user }

POST /auth/token/refresh         { refreshToken }
→ { success, accessToken, refreshToken }
```

**PIN login:** Returning REZ users who set a PIN (via consumer app) skip OTP. Faster, no SMS cost. REZ Now must support this — show PIN input when `hasPIN: true` is returned.

### Wallet service endpoints (`/api/wallet` → rez-wallet-service)

```
GET  /api/wallet/balance         → { data: { coins, rupees, tier } }
GET  /api/wallet/transactions    → { data: [...], pagination }
GET  /api/wallet/summary         → { data: { totalEarned, totalSpent } }
```

All require `Authorization: Bearer <accessToken>`.

### Backend change required for Order & Pay

`/api/web-ordering/*` routes currently check `x-session-token` (old web menu's isolated auth). REZ Now sends `Authorization: Bearer <token>` (real REZ JWT). These two tokens are signed differently.

**Required backend change (rez-backend-master `webOrderingRoutes.ts`):**
```typescript
// Update session auth middleware to accept BOTH:
// 1. Authorization: Bearer <token> → verify with JWT_SECRET (REZ Now)
// 2. x-session-token: <jwt>        → verify with WEB_JWT_SECRET (old web menu legacy)
```

Non-breaking — old `menu.rez.money` keeps working with its session tokens. REZ Now uses proper Bearer auth.

---

## 3. Separate Repo + Domain Decision

**Why separate repo:**
- Clean git history — no contamination from rez-web-menu bundle patches
- Independent CI/CD — Vercel project separate from current web menu
- Can be open-sourced or white-labeled later
- Consumer-facing product deserves own identity

**Repo name:** `rez-now` (GitHub: `imrejaul007/rez-now`)  
**Vercel project:** `rez-now`  
**Domain:** `now.rez.money` → Vercel production domain  
**Dev domain:** `rez-now-dev.vercel.app`

**Old rez-web-menu:**
- Keep alive during transition (don't delete)
- Redirect `menu.rez.money/<slug>` → `now.rez.money/<slug>` via Vercel redirect
- Retire once REZ Now is stable in production (Phase 1 complete + 2 weeks no incidents)

---

## 3. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 15 App Router** | SSR → Google indexes store menus. No env var injection. |
| Language | **TypeScript strict** | Catches type mismatches at compile time |
| Styling | **Tailwind CSS v4** | Same tokens as existing REZ apps |
| State | **Zustand** | Already used in web menu — same pattern |
| HTTP | **Axios** | Interceptors for 401/403 handling |
| Real-time | **Socket.IO client** | Backend already uses Socket.IO |
| Payments | **Razorpay** | Already integrated, live keys exist |
| Deploy | **Vercel** | Zero-config, env vars in dashboard, edge functions |
| PWA | **next-pwa** | Service worker + offline support + "Add to Home Screen" |

**Not using:** React Query, tRPC, Redux, Vite (Next.js only)

---

## 4. Two Core Flows

### Flow A — Order & Pay

Triggered when: `store.hasMenu === true`

```
Customer scans QR → now.rez.money/<slug>?table=3
  └── MenuPage loads (SSR) → store + menu from /api/web-ordering/store/:slug
  └── Browse categories + items
  └── Add to cart
  └── CartPage → coupon + validation
  └── CheckoutPage → OTP login (if not logged in) → tip → split → pay
        └── Razorpay modal → success
  └── OrderConfirmPage → live status via Socket.IO
  └── Done
```

Pages: MenuPage → CartPage → CheckoutPage → OrderConfirmPage → (receipt / rate / history)

### Flow B — Scan & Pay

Triggered when: `store.hasMenu === false` OR customer taps "Pay Here" in consumer app

```
Customer scans QR → now.rez.money/<slug>
  OR consumer app deep link → launches consumer app → pay-in-store screen
  └── ScanPayPage (now.rez.money/<slug>)
        └── Shows store name + logo
        └── Optionally: recent visits / amount suggestions
  └── Enter amount
  └── OTP login (if not logged in)
  └── PaymentPage → Razorpay modal
        └── success → show confirmation + coins earned
  └── Done
```

Pages: ScanPayPage → ScanPayCheckoutPage → ScanPayConfirmPage

### How the app decides which flow

```typescript
// In [storeSlug]/layout.tsx (server component)
const store = await fetchStore(slug);
if (store.hasMenu) {
  // → renders Order & Pay layout + MenuPage
} else {
  // → renders Scan & Pay layout (simpler, amount-entry focused)
}
```

---

## 5. Merchant Types + UI Variants

The `storeType` field on the store object changes UI copy and icons only — NOT the flow logic (that's controlled by `hasMenu`).

| storeType | Flow | UI label for "Add to cart" | Order confirm copy |
|-----------|------|---------------------------|--------------------|
| `restaurant` | Order & Pay | "Add" | "Your food is being prepared" |
| `cafe` | Order & Pay | "Add" | "Your order is being prepared" |
| `cloud_kitchen` | Order & Pay | "Add" | "Your order is confirmed" |
| `retail` | Order & Pay | "Add to bag" | "Your order is confirmed" |
| `salon` | Scan & Pay | — | "Thank you for visiting" |
| `hotel` | Both (menu + pay) | "Add" / "Pay" | "Thank you for your stay" |
| `service` | Scan & Pay | — | "Payment received" |
| `general` | Both | "Add" / "Pay" | "Payment confirmed" |

**Rule:** `storeType` is display-only. Business logic depends only on `hasMenu` and `isProgramMerchant`.

---

## 6. isProgramMerchant — Coin Gate Logic

Every REZ merchant is either a Program Merchant (pays subscription) or not. This single boolean gates the entire coin/loyalty UI.

```
store.isProgramMerchant = true
  ├── MenuPage: REZ Coins earn banner visible
  ├── CartPage: "Redeem coins" toggle visible
  ├── CheckoutPage: coins balance + redeem option visible
  ├── OrderConfirmPage: "You earned X coins" visible
  ├── OrderConfirmPage: Stamp card visible
  └── All coin API calls active (GET /coins/balance, POST /coins/credit, etc.)

store.isProgramMerchant = false
  ├── All coin/loyalty UI hidden
  ├── No coin API calls made
  └── Pure payment experience
```

**Scan & Pay — same rule:**
```
isProgramMerchant = true  → show "You'll earn X REZ coins for this payment"
isProgramMerchant = false → show nothing about coins
```

**Set by:** `PATCH /api/admin/stores/:id/program { isProgramMerchant, baseCashbackPercent }`

---

## 7. All Backend Routes (Mapped)

### 7A — Web Ordering Routes (Order & Pay)

**Base:** `https://api.rezapp.com/api/web-ordering`

| Method | Path | Auth | Used In |
|--------|------|------|---------|
| GET | `/store/:storeSlug` | none | layout.tsx — loads store + menu |
| POST | `/api/user/auth/send-otp` | none | LoginModal (rez-auth-service) |
| POST | `/api/user/auth/verify-otp` | none | LoginModal → returns accessToken (rez-auth-service) |
| POST | `/auth/pin/verify` | none | LoginModal PIN path (rez-auth-service) |
| POST | `/auth/token/refresh` | none | Silent token refresh (rez-auth-service) |
| POST | `/cart/validate` | none | CartPage — stock check |
| POST | `/coupon/validate` | session | CartPage / CheckoutPage |
| POST | `/razorpay/create-order` | session | CheckoutPage |
| POST | `/payment/verify` | session | CheckoutPage — signature verify |
| POST | `/tip` | session | CheckoutPage |
| POST | `/order/:orderNumber/donate` | session | CheckoutPage |
| POST | `/order/:orderNumber/parcel` | session | CheckoutPage |
| GET | `/order/:orderNumber` | session | OrderConfirmPage — status poll |
| POST | `/order/:orderNumber/cancel` | session | OrderConfirmPage |
| POST | `/order/:orderNumber/rate` | session | OrderConfirmPage — star rating |
| POST | `/order/:orderNumber/feedback` | session | OrderConfirmPage — dispute/survey |
| GET | `/orders/history` | session | OrderHistoryPage |
| POST | `/receipt/send` | session | OrderConfirmPage — WhatsApp/email |
| GET | `/api/wallet/balance` | Bearer | CheckoutPage + OrderConfirmPage (rez-wallet-service) |
| POST | `/coins/credit` | Bearer | OrderConfirmPage — triggers wallet credit via backend |
| POST | `/bill/request` | none | RequestBillPage |
| POST | `/bill/split` | session | CheckoutPage |
| GET | `/bill/:billId/split-status` | session | CheckoutPage |
| POST | `/group/create` | session | MenuPage |
| POST | `/group/join` | session | MenuPage |
| GET | `/group/:groupId` | session | MenuPage |
| POST | `/group/:groupId/add-items` | session | MenuPage |
| POST | `/group/:groupId/checkout` | session | CartPage |
| GET | `/recommendations` | none | MenuPage — AI items |
| POST | `/waiter/call` | none | MenuPage |
| GET | `/loyalty/stamps` | session | OrderConfirmPage |
| POST | `/loyalty/stamps/issue` | session | OrderConfirmPage |

### 7B — Store Payment Routes (Scan & Pay)

**Base:** `https://api.rezapp.com/api/store-payment`

| Method | Path | Auth | Used In |
|--------|------|------|---------|
| GET | `/store/:storeSlug` | none | ScanPayPage — load store info |
| POST | `/api/user/auth/send-otp` | none | LoginModal — shared with Order & Pay |
| POST | `/api/user/auth/verify-otp` | none | LoginModal → accessToken |
| POST | `/razorpay/create-order` | session | ScanPayCheckoutPage |
| POST | `/payment/verify` | session | ScanPayCheckoutPage |
| GET | `/api/wallet/balance` | Bearer | ScanPayCheckoutPage (rez-wallet-service) |
| POST | `/coins/credit` | Bearer | ScanPayConfirmPage — triggers wallet credit |
| GET | `/history` | session | ScanPayHistoryPage |
| GET | `/payment/:paymentId` | session | ScanPayConfirmPage |

**Note:** Both route bases use the same auth pattern (`x-session-token` header). The token from `/web-ordering/otp/verify` works for both.

### 7C — Merchant Routes (called by merchant app, NOT REZ Now)

| Method | Path | Effect on REZ Now |
|--------|------|-------------------|
| GET | `/api/merchant/web-orders` | — |
| GET | `/api/merchant/web-orders/:orderNumber` | — |
| PATCH | `/api/merchant/web-orders/:orderNumber/status` | Triggers `web-order:status-update` socket → REZ Now updates live |

### 7D — Admin Routes (affect REZ Now behavior)

| Method | Path | Effect |
|--------|------|--------|
| PATCH | `/api/admin/stores/:id/program` | Sets `isProgramMerchant` → coin UI on/off |
| PATCH | `/api/admin/stores/:id/settings` | Sets `estimatedPrepMinutes`, `hasMenu`, `storeType` |

---

## 8. Consumer App Deep Link Integration

### Current state (before REZ Now)
Consumer app handles `menu.rez.money/<slug>` → routes to `/pay-in-store/enter-amount` (Scan & Pay).

### Required changes for REZ Now

The consumer app needs to handle `now.rez.money/<slug>` URLs and distinguish the two flows:

| URL pattern | Intent | Consumer app action |
|-------------|--------|---------------------|
| `now.rez.money/<slug>` | Scan & Pay | Open in consumer app → `/pay-in-store/enter-amount` |
| `now.rez.money/<slug>?table=N` | Order & Pay (dine-in) | Open REZ Now in browser (full menu experience) |
| `now.rez.money/<slug>?scan=1` | Explicit Scan & Pay | Open in consumer app → `/pay-in-store/enter-amount` |

**Rule:** If `?table=` is in URL → browser (full menu). If no table or `?scan=1` → consumer app intercepts.

### File: `rezapp/nuqta-master/app.config.js`

**Add to `associatedDomains`:**
```javascript
associatedDomains: [
  'applinks:rezapp.in',
  'applinks:menu.rez.money',
  'applinks:now.rez.money',    // ← ADD THIS
],
```

**Add to Android `intentFilters`:**
```javascript
{
  action: 'VIEW',
  autoVerify: true,
  data: [
    { scheme: 'https', host: 'now.rez.money', pathPrefix: '/' },
  ],
  category: ['BROWSABLE', 'DEFAULT'],
},
```

### File: `rezapp/nuqta-master/app/_layout.tsx`

**In `handleDeepLink()`, add after the `menuMatch` block:**

```typescript
// now.rez.money universal links
// Without ?table= → Scan & Pay in-app
// With ?table=N → open full Order & Pay in browser (don't intercept)
const nowMatch = url.match(/https?:\/\/now\.rez\.money\/([a-z0-9][a-z0-9-]*[a-z0-9]?)(?:\?(.*))?$/i);
if (nowMatch) {
  const slug = nowMatch[1].toLowerCase();
  const queryStr = nowMatch[2] || '';
  const params = new URLSearchParams(queryStr);
  const tableNumber = params.get('table') || undefined;
  const scanMode = params.get('scan');

  // If table= is set, this is Order & Pay → let browser handle it
  if (tableNumber && !scanMode) {
    // Don't intercept — iOS/Android will open in browser
    return;
  }

  // Scan & Pay — intercept and route to pay-in-store
  const store = await lookupStoreBySlug(slug);
  if (store) {
    router.push({
      pathname: '/pay-in-store/enter-amount',
      params: {
        storeId: (store as any)._id || (store as any).id,
        storeName: store.name,
        storeLogo: store.logo || '',
      },
    } as any);
  } else {
    router.push('/pay-in-store' as any);
  }
  return;
}
```

**Place this block immediately AFTER the existing `menuMatch` block** (around line 155 in `_layout.tsx`).

### File: `rez-now/public/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "money.rez.app",
        "paths": [
          "NOT /*?table=*",
          "/*"
        ]
      }
    ]
  }
}
```

**`NOT /*?table=*`** — excludes dine-in Order & Pay URLs from being intercepted by the app. Order & Pay always opens in browser for full menu experience.

### File: `rez-now/public/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "money.rez.app",
      "sha256_cert_fingerprints": [
        "REPLACE_WITH_ACTUAL_SHA256_FROM_PLAY_CONSOLE"
      ]
    }
  }
]
```

**Action required:** Get SHA256 from Play Console → App signing → App signing key certificate.

---

## 9. File & Folder Structure

```
rez-now/                                 ← NEW separate repo
├── .env.local                           ← gitignored
├── .env.example                         ← committed
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
│
├── app/
│   ├── layout.tsx                       ← root: fonts, providers, PWA meta
│   ├── not-found.tsx
│   │
│   ├── [storeSlug]/                     ← store namespace
│   │   ├── layout.tsx                   ← SERVER: loads store, decides flow (Order vs Scan)
│   │   │
│   │   ├── page.tsx                     ← MenuPage (Order & Pay — hasMenu=true)
│   │   ├── cart/
│   │   │   └── page.tsx                 ← CartPage
│   │   ├── checkout/
│   │   │   └── page.tsx                 ← CheckoutPage (Order & Pay payment)
│   │   ├── order/
│   │   │   └── [orderNumber]/
│   │   │       └── page.tsx             ← OrderConfirmPage (live status)
│   │   ├── history/
│   │   │   └── page.tsx                 ← OrderHistoryPage
│   │   ├── receipt/
│   │   │   └── [orderNumber]/
│   │   │       └── page.tsx             ← ReceiptPage
│   │   ├── bill/
│   │   │   └── page.tsx                 ← RequestBillPage
│   │   │
│   │   └── pay/                         ← Scan & Pay sub-route (hasMenu=false)
│   │       ├── page.tsx                 ← ScanPayPage (amount entry)
│   │       ├── checkout/
│   │       │   └── page.tsx             ← ScanPayCheckoutPage
│   │       └── confirm/
│   │           └── [paymentId]/
│   │               └── page.tsx         ← ScanPayConfirmPage
│   │
│   └── api/
│       └── health/
│           └── route.ts
│
├── components/
│   ├── ui/                              ← atoms: Button, Input, Badge, Spinner, Modal, Toast
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── Spinner.tsx
│   │   ├── Modal.tsx
│   │   └── Toast.tsx
│   │
│   ├── menu/                            ← Order & Pay components
│   │   ├── MenuHeader.tsx               ← logo, name, open badge, wait-time
│   │   ├── CategoryNav.tsx              ← sticky horizontal scroll tabs
│   │   ├── MenuItem.tsx                 ← item card (veg icon, price, add button)
│   │   ├── SearchBar.tsx
│   │   └── CartSummaryBar.tsx           ← sticky bottom: "3 items · ₹450 →"
│   │
│   ├── cart/
│   │   ├── CartItem.tsx
│   │   ├── CartSummary.tsx
│   │   └── CouponInput.tsx
│   │
│   ├── checkout/
│   │   ├── TipSelector.tsx
│   │   ├── SplitBillModal.tsx
│   │   ├── GroupOrderModal.tsx
│   │   ├── PaymentOptions.tsx           ← Razorpay + UPI deep links (Phase 2)
│   │   └── DonationToggle.tsx
│   │
│   ├── order/
│   │   ├── OrderStatusBar.tsx           ← animated step progress
│   │   ├── OrderItemList.tsx
│   │   ├── ReceiptActions.tsx
│   │   ├── RatingModal.tsx
│   │   ├── DisputeModal.tsx
│   │   └── StampCard.tsx
│   │
│   ├── scan-pay/                        ← Scan & Pay components
│   │   ├── StoreHeader.tsx              ← store name + logo (minimal)
│   │   ├── AmountInput.tsx              ← large number pad or text input
│   │   ├── AmountSuggestions.tsx        ← quick amounts (₹100, ₹200, ₹500)
│   │   ├── CoinPreview.tsx              ← "You'll earn ~X coins" (if isProgramMerchant)
│   │   └── PayConfirm.tsx               ← success screen with coins earned
│   │
│   ├── auth/
│   │   └── LoginModal.tsx               ← phone + OTP (shared by both flows)
│   │
│   └── shared/
│       ├── RezCoinsBanner.tsx           ← shown only if isProgramMerchant
│       ├── WaiterCallButton.tsx
│       └── BottomNav.tsx
│
├── lib/
│   ├── api/
│   │   ├── client.ts                    ← publicClient + authClient (Bearer) + 401→refresh interceptor
│   │   ├── store.ts                     ← GET /store/:slug (both flows)
│   │   ├── auth.ts                      ← send-otp, verify-otp, pin-verify, token-refresh (rez-auth-service)
│   │   ├── wallet.ts                    ← GET /api/wallet/balance + transactions (rez-wallet-service)
│   │   ├── orders.ts                    ← create, status, cancel, rate, feedback
│   │   ├── cart.ts                      ← validate, coupon
│   │   ├── payment.ts                   ← razorpay create + verify (Order & Pay)
│   │   ├── scanPayment.ts               ← razorpay create + verify (Scan & Pay)
│   │   ├── bill.ts                      ← split, request
│   │   ├── group.ts                     ← group order CRUD
│   │   ├── receipt.ts                   ← send WhatsApp/email receipt
│   │   └── loyalty.ts                   ← stamps, tier
│   │
│   ├── store/                           ← Zustand stores
│   │   ├── authStore.ts
│   │   ├── cartStore.ts
│   │   └── uiStore.ts
│   │
│   ├── hooks/
│   │   ├── useOrderSocket.ts            ← Socket.IO for Order & Pay
│   │   ├── useOrderPolling.ts           ← fallback exponential backoff
│   │   └── useRazorpay.ts               ← SDK load + window.__razorpayLoadFailed guard
│   │
│   ├── types/
│   │   └── index.ts                     ← ALL shared types
│   │
│   └── utils/
│       ├── currency.ts                  ← formatINR(amount)
│       ├── time.ts                      ← formatTime()
│       ├── upi.ts                       ← UPI deep link generators (Phase 2)
│       └── storeType.ts                 ← getUICopy(storeType) → labels/icons
│
└── public/
    ├── manifest.json                    ← PWA
    ├── sw.js                            ← service worker
    ├── icons/
    └── .well-known/
        ├── apple-app-site-association   ← iOS universal links
        └── assetlinks.json              ← Android app links
```

---

## 10. Environment Variables

### `.env.example` (committed)

```env
# Web Ordering API base (Order & Pay)
NEXT_PUBLIC_API_URL=https://api.rezapp.com

# Socket.IO server
NEXT_PUBLIC_SOCKET_URL=https://api.rezapp.com

# Razorpay public key
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx

# App identity
NEXT_PUBLIC_APP_NAME=REZ Now
NEXT_PUBLIC_APP_URL=https://now.rez.money
```

### Vercel Dashboard (production)

```
NEXT_PUBLIC_API_URL         = https://api.rezapp.com
NEXT_PUBLIC_SOCKET_URL      = https://api.rezapp.com
NEXT_PUBLIC_RAZORPAY_KEY_ID = rzp_live_xxx
NEXT_PUBLIC_APP_URL         = https://now.rez.money
```

All `NEXT_PUBLIC_*` — safe to expose in browser. No secrets here.

---

## 11. Data Types Contract

These types must match the backend exactly. Any change to the backend schema requires updating these.

```typescript
// From GET /api/web-ordering/store/:storeSlug
// AND GET /api/store-payment/store/:storeSlug
interface StoreInfo {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  banner: string | null;
  address: string;
  phone: string;
  storeType: 'restaurant' | 'cafe' | 'cloud_kitchen' | 'retail' | 'salon' | 'hotel' | 'service' | 'general';
  hasMenu: boolean;                    // true = Order & Pay; false = Scan & Pay only
  isProgramMerchant: boolean;          // true = show coin UI
  estimatedPrepMinutes: number;        // 0 = don't show wait badge
  gstEnabled: boolean;
  gstPercent: number;
  operatingHours: Record<string, { open: string; close: string }>;
  googlePlaceId: string | null;
  rewardRules: {
    baseCashbackPercent: number;
    coinsEnabled: boolean;
  };
}

// Order status (matches backend WEB_ORDER_TRANSITIONS)
type WebOrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

// Cart item
interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  customizations?: Record<string, string>;
  isVeg: boolean;
}

// Socket event from backend
interface OrderStatusUpdateEvent {
  orderNumber: string;
  status: WebOrderStatus;
  storeId: string;
}

// Auth tokens
// localStorage key 'rez_web_jwt'     → session JWT
// localStorage key 'rez_web_refresh' → refresh token
// clearSession() MUST remove BOTH
```

---

## 12. All Connections (Full Map)

```
REZ Now (now.rez.money)
  │
  ├── publicClient (no auth, base: NEXT_PUBLIC_API_URL)
  │     → GET  /api/web-ordering/store/:slug      (menu load)
  │     → GET  /api/store-payment/store/:slug     (scan & pay store load)
  │     → POST /api/user/auth/send-otp             (rez-auth-service)
  │     → POST /api/user/auth/verify-otp           (rez-auth-service)
  │     → POST /auth/pin/verify                    (rez-auth-service)
  │     → POST /auth/token/refresh                 (rez-auth-service)
  │     → POST /api/web-ordering/waiter/call
  │     → POST /api/web-ordering/bill/request
  │
  ├── authClient (Authorization: Bearer <accessToken>)
  │     → all /api/web-ordering/* authenticated routes (Order & Pay)
  │     → all /api/store-payment/* routes (Scan & Pay)
  │     → all /api/wallet/* routes (rez-wallet-service)
  │     └── 401 interceptor:
  │           → try POST /auth/token/refresh (silent refresh)
  │           → success → update token + retry original request
  │           → failure → clearSession() + openLoginModal(retryCallback)
  │
  ├── Socket.IO (NEXT_PUBLIC_SOCKET_URL)
  │     └── OrderConfirmPage: connect → join room → 'web-order:status-update'
  │           └── fallback: useOrderPolling.ts (2s→4s→8s→16s→30s, 20 attempts max)
  │
  └── Razorpay SDK (external)
        └── loaded via <Script src="https://checkout.razorpay.com/v1/checkout.js">
              └── window.__razorpayLoadFailed = true on error
              └── if failed: show "Pay at counter" message

Merchant App (rez-merchant-master)
  └── PATCH /api/merchant/web-orders/:orderNumber/status
        └── Backend emits 'web-order:status-update'
        └── REZ Now OrderConfirmPage receives live update

Admin App (rez-admin-main)
  └── PATCH /api/admin/stores/:id/program { isProgramMerchant }
        └── Next store load → isProgramMerchant changes → coin UI shows/hides
  └── PATCH /api/admin/stores/:id/settings { estimatedPrepMinutes, hasMenu, storeType }

Consumer App (nuqta-master)
  └── QR scan → now.rez.money/<slug>
        ├── ?table=N → browser intercept blocked → opens in browser (Order & Pay)
        └── no table → consumer app intercepts → /pay-in-store/enter-amount (Scan & Pay)
```

---

## 13. State Management

### `authStore.ts`

```typescript
interface AuthState {
  phone: string | null;
  userId: string | null;
  accessToken: string | null;       // localStorage key: 'rez_access_token'
  refreshToken: string | null;      // localStorage key: 'rez_refresh_token'
  user: { id: string; name: string; phone: string; isOnboarded: boolean } | null;
  isLoggedIn: boolean;
  setSession: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  clearSession: () => void;         // removes BOTH localStorage keys
}

// clearSession MUST be:
clearSession: () => {
  try {
    localStorage.removeItem('rez_access_token');
    localStorage.removeItem('rez_refresh_token');
  } catch {}
  set({ accessToken: null, refreshToken: null, userId: null, phone: null, user: null, isLoggedIn: false });
}
```

**Token storage keys:** `rez_access_token` + `rez_refresh_token` (same as consumer app's AsyncStorage keys, just web localStorage equivalent)

### `cartStore.ts`

```typescript
interface CartState {
  storeSlug: string | null;
  tableNumber: string | null;
  items: CartItem[];
  groupOrderId: string | null;
  addItem: (item: CartItem) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, qty: number) => void;
  clearCart: () => void;
  setStoreSlug: (slug: string) => void;  // clears cart if slug changes
  setTableNumber: (table: string) => void;
}
// Persisted to localStorage 'rez_cart'
// storeSlug change → clearCart() automatically
```

### `uiStore.ts`

```typescript
interface UIState {
  loginModalOpen: boolean;
  loginModalCallback: (() => void) | null;
  openLoginModal: (callback?: () => void) => void;
  closeLoginModal: () => void;
}
```

---

## 14. Auth Flow

```
Any action requiring auth (checkout, history, wallet balance, receipt)
  └── Check authStore.isLoggedIn
        └── false → openLoginModal(retryCallback)
              └── LoginModal renders
                    Step 1: Enter phone number
                      └── POST /api/user/auth/send-otp { phone }
                            └── { hasPIN: true }  → show PIN input (returning REZ user)
                            └── { hasPIN: false } → show OTP input (new user / forgot PIN)

                    Step 2a: PIN login (returning user)
                      └── POST /auth/pin/verify { phone, pin }
                            └── { success, accessToken, refreshToken, user }

                    Step 2b: OTP login (new / forgot PIN)
                      └── POST /api/user/auth/verify-otp { phone, otp }
                            └── { success, accessToken, refreshToken, user }

                    On success:
                      └── authStore.setSession(accessToken, refreshToken, user)
                      └── localStorage.setItem('rez_access_token', accessToken)
                      └── localStorage.setItem('rez_refresh_token', refreshToken)
                      └── Close modal → retryCallback() → original action continues
        └── true → proceed with Authorization: Bearer <accessToken>

Token expiry mid-session:
  └── Any API call returns 401
  └── axios interceptor fires
        └── Attempt silent refresh: POST /auth/token/refresh { refreshToken }
              └── Success → update authStore.accessToken + localStorage → retry original request
              └── Failure (refresh expired too) → authStore.clearSession() → openLoginModal(retryCallback)
```

---

## 15. Order & Pay Flow (Full)

```
1. Customer scans QR at table
   URL: now.rez.money/chai-point?table=4

2. [storeSlug]/layout.tsx (server)
   - Fetch store: GET /api/web-ordering/store/chai-point
   - store.hasMenu = true → Order & Pay layout

3. MenuPage
   - Display categories + items (SSR — Google indexed)
   - storeType = 'cafe' → "Add" buttons
   - isProgramMerchant = true → REZ Coins earn banner
   - estimatedPrepMinutes = 8 → "⏱ Ready in ~8 mins"
   - table=4 stored in cartStore

4. Cart interactions
   - Add items → cartStore.items[]
   - CartSummaryBar shows item count + total

5. CartPage
   - POST /api/web-ordering/cart/validate → check availability
   - POST /api/web-ordering/coupon/validate → apply promo

6. CheckoutPage
   - Auth check → LoginModal if needed
   - Tip selector (0%, 5%, 10%, custom)
   - Donation toggle
   - Split bill → SplitBillModal → POST /api/web-ordering/bill/split
   - Group order → GroupOrderModal
   - "Pay ₹540" button
     - Check window.Razorpay / window.__razorpayLoadFailed
     - POST /api/web-ordering/razorpay/create-order → { razorpayOrderId, orderNumber }
     - Open Razorpay modal
     - On success handler: POST /api/web-ordering/payment/verify
     - Navigate to /chai-point/order/ORD-12345

7. OrderConfirmPage
   - Socket.IO connect → listen 'web-order:status-update'
   - Status: pending_payment → confirmed → preparing → ready → completed
   - Poll fallback: useOrderPolling (exponential backoff 2s→30s, 20 attempts)
   - isProgramMerchant: POST /api/web-ordering/coins/credit → show coins earned
   - GET /api/web-ordering/loyalty/stamps → show stamp card
   - Actions: Send Receipt, Rate, Report Problem, Cancel (if confirmed)
```

---

## 16. Scan & Pay Flow (Full)

### A — Via REZ Now browser (now.rez.money/<slug>)

```
1. Merchant QR opens: now.rez.money/apex-salon
   store.hasMenu = false → Scan & Pay layout

2. ScanPayPage
   - Store name + logo
   - Amount input (large numpad-style)
   - Quick amounts: ₹100, ₹200, ₹500
   - isProgramMerchant: "You'll earn ~X coins for this payment"

3. ScanPayCheckoutPage
   - Auth check → LoginModal
   - Order summary: Store name + Amount
   - Coins balance (if isProgramMerchant)
   - "Pay ₹500" button
     - POST /api/store-payment/razorpay/create-order
     - Razorpay modal
     - POST /api/store-payment/payment/verify
     - Navigate to /apex-salon/pay/confirm/PAY-56789

4. ScanPayConfirmPage
   - "Payment successful ✓"
   - Amount paid + merchant name
   - Coins earned (if isProgramMerchant): POST /api/store-payment/coins/credit
   - Receipt via WhatsApp option
   - "Pay again" button
```

### B — Via Consumer App deep link

```
1. Consumer app already has pay-in-store screen
   (app/pay-in-store/enter-amount.tsx)

2. now.rez.money/<slug> (no ?table=) scanned
   → iOS: apple-app-site-association blocks browser, opens consumer app
   → Android: assetlinks.json verified → opens consumer app
   → handleDeepLink() in _layout.tsx: nowMatch fires
   → lookupStoreBySlug(slug) → router.push('/pay-in-store/enter-amount', { storeId, storeName })

3. Consumer app handles entire Scan & Pay flow internally
   (existing store-payment API integration)
```

### C — When consumer app NOT installed

```
User does not have REZ app installed
→ Universal link cannot intercept
→ Opens now.rez.money/<slug> in browser
→ ScanPayPage renders (Flow A above)
→ Full experience still works — no app required
```

---

## 17. Socket.IO Integration

### `lib/hooks/useOrderSocket.ts`

```typescript
export function useOrderSocket(orderNumber: string, onUpdate: (status: WebOrderStatus) => void) {
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected, joining order room:', orderNumber);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error, falling back to polling:', err.message);
      // Do NOT throw — let useOrderPolling take over
    });

    socket.on('web-order:status-update', (data: OrderStatusUpdateEvent) => {
      if (data.orderNumber === orderNumber) {
        onUpdate(data.status);
      }
    });

    return () => { socket.disconnect(); };
  }, [orderNumber]);
}
```

### `lib/hooks/useOrderPolling.ts` (fallback)

```typescript
// Exponential backoff: 2s → 4s → 8s → 16s → 30s (cap), max 20 attempts
// On timeout: show "Unable to get live updates. Ask the restaurant for your order status."
```

---

## 18. Error Handling Standards

| Scenario | Behavior |
|----------|---------|
| API 401/403 | interceptor: clearSession() → LoginModal (retry original action) |
| API 500 | Toast: "Something went wrong. Please try again." |
| Network offline | Toast: "No internet connection" + cached store data from service worker |
| Razorpay SDK fails to load | `window.__razorpayLoadFailed = true` → show "Pay at counter" |
| Socket connect_error | Log warning → polling fallback activates automatically |
| Polling timeout (20 attempts) | "Unable to get live updates. Please ask the restaurant for your order status." |
| Cart item unavailable | CartPage: highlight unavailable item, disable checkout |
| Coupon invalid | Inline error under coupon input: show `response.message` |
| Payment verify fails | "Payment verification failed. Contact support with order #XXX" |
| Store not found (404) | `/not-found.tsx` with "This store is not available on REZ Now" |
| Store closed | MenuPage: "Store is currently closed" banner, disable add-to-cart |

---

## 19. Page-by-Page Spec

### `/[storeSlug]` — MenuPage

**Trigger:** `store.hasMenu === true`  
**Data:** SSR via `GET /api/web-ordering/store/:storeSlug`

Renders:
- Store header: logo, name, open/closed badge, `estimatedPrepMinutes` badge
- Promotions carousel (if any)
- Veg/Non-Veg toggle + search bar
- Sticky horizontal category tabs
- Item cards: name, description, price (strikethrough if discounted), veg icon, add button
- REZ Coins earn banner (only if `isProgramMerchant`)
- Waiter call button (if `tableNumber` set)
- Sticky CartSummaryBar (bottom)

---

### `/[storeSlug]/pay` — ScanPayPage

**Trigger:** `store.hasMenu === false`  
**Data:** SSR via `GET /api/store-payment/store/:storeSlug`

Renders:
- Store name + logo (centered, minimal)
- Large amount input with numpad
- Quick amount suggestions: ₹50, ₹100, ₹200, ₹500
- Coin earn preview (if `isProgramMerchant`): "You'll earn ~X coins"
- "Proceed to Pay" button

---

### `/[storeSlug]/cart` — CartPage

Renders:
- Cart items + quantity controls
- Coupon input + live validation
- Cart summary (subtotal + GST + discount + total)
- Empty state: "Your cart is empty. Back to Menu"

---

### `/[storeSlug]/checkout` — CheckoutPage

Renders:
- Order summary
- Tip selector (0%, 5%, 10%, custom)
- Donation toggle
- Bill split button → SplitBillModal
- Coins redeem (if `isProgramMerchant + isLoggedIn`)
- Payment button (with Razorpay SDK guard)

---

### `/[storeSlug]/order/[orderNumber]` — OrderConfirmPage

Real-time via Socket.IO + polling fallback.

Status flow: `pending_payment` → `confirmed` → `preparing` → `ready` → `completed`

Renders:
- Animated status progress bar
- Estimated time (from `estimatedPrepMinutes`)
- Item list + total
- REZ Coins earned (if `isProgramMerchant`)
- Stamp card (if `isProgramMerchant`)
- Actions: Receipt, Rate, Report, Cancel (confirmed only)

---

### `/[storeSlug]/pay/confirm/[paymentId]` — ScanPayConfirmPage

Renders:
- Large checkmark + "Payment Successful"
- Amount + merchant name
- Coins earned (if `isProgramMerchant`)
- "Pay again" + "View History" buttons

---

### `/[storeSlug]/history` — OrderHistoryPage

Unauthenticated state: "Scan the QR code at the restaurant to log in and view your order history"

Authenticated:
- List of past orders (date, items summary, total, status)
- Tap → OrderConfirmPage or ReceiptPage

---

## 20. Implementation Phases

### Phase 1 — Core + Feature Parity (2 weeks)

| Day | Task |
|-----|------|
| 1 | Create GitHub repo `rez-now`, scaffold Next.js 15, configure Tailwind, setup Vercel project with `now.rez.money` |
| 1 | `lib/api/client.ts` — axios instances, 401 interceptor, session client |
| 1 | `lib/store/authStore.ts` + `cartStore.ts` + `uiStore.ts` |
| 1 | `lib/types/index.ts` — all TypeScript types |
| 2 | `app/[storeSlug]/layout.tsx` — server: fetch store, decide Order vs Scan flow |
| 2 | `components/menu/` — MenuHeader, CategoryNav, MenuItem, CartSummaryBar |
| 2 | `app/[storeSlug]/page.tsx` — MenuPage (Order & Pay) |
| 3 | `components/auth/LoginModal.tsx` — OTP flow |
| 3 | `app/[storeSlug]/cart/page.tsx` — CartPage + CouponInput |
| 4 | `app/[storeSlug]/checkout/page.tsx` — TipSelector, SplitBill, payment |
| 4 | `lib/hooks/useRazorpay.ts` — SDK with `__razorpayLoadFailed` guard |
| 5 | `lib/hooks/useOrderSocket.ts` + `useOrderPolling.ts` |
| 5 | `app/[storeSlug]/order/[orderNumber]/page.tsx` — OrderConfirmPage |
| 5 | RatingModal + DisputeModal + receipt send |
| 6 | OrderHistoryPage + ReceiptPage + RequestBillPage |
| 6 | Group ordering flow |
| 7 | **Scan & Pay flow**: ScanPayPage + ScanPayCheckoutPage + ScanPayConfirmPage |
| 7 | `lib/utils/storeType.ts` — UI copy variants per storeType |
| 8 | `isProgramMerchant` gating across all pages |
| 8 | PWA: `public/manifest.json` + service worker |
| 9 | `.well-known/apple-app-site-association` + `assetlinks.json` |
| 9 | Full QA: every backend route tested, every error scenario tested |
| 10 | Deploy to `now.rez.money` production |

### Phase 2 — Competitive Features (2 weeks after Phase 1 stable)

| Feature | Files |
|---------|-------|
| UPI deep links (PhonePe/GPay/Paytm) | `lib/utils/upi.ts`, `components/checkout/PaymentOptions.tsx` |
| Per-person bill split | `components/checkout/SplitBillModal.tsx` |
| Pre-order / schedule | datetime picker in CheckoutPage |
| One-tap repeat order | OrderHistoryPage |
| Loyalty tier widget | `components/order/LoyaltyWidget.tsx` |
| Google Maps review CTA | after rating in OrderConfirmPage |
| Multi-language (Hindi) | `next-intl` |
| Amount history in Scan & Pay | recent payment suggestions per store |

### Phase 3 — Analytics + Advanced (Month 2)

| Feature | Notes |
|---------|-------|
| Table-side chat with kitchen | Socket.IO `table:message` event |
| Web analytics per store | Admin screen |
| WhatsApp reorder | Backend webhook flow |
| Offline menu caching | Service worker background sync |
| NFC tap-to-pay support | Web NFC API (Chrome Android) |

---

## 21. PWA Spec

### `public/manifest.json`

```json
{
  "name": "REZ Now",
  "short_name": "REZ Now",
  "description": "Order, pay, earn — at any store",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#6366f1",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service worker capabilities

- Cache store menu (stale-while-revalidate) → offline browsing works
- Cache static assets
- Offline fallback page: "You're offline. Your cart is saved. Reconnect to complete your order."
- Background sync: queue order if placed offline → sync when online

---

## 22. Testing Plan

### Before each deploy

- [ ] `GET /api/web-ordering/store/:slug` returns correct `isProgramMerchant`, `hasMenu`, `storeType`
- [ ] OTP login completes → JWT stored in localStorage
- [ ] clearSession() removes BOTH `rez_web_jwt` AND `rez_web_refresh`
- [ ] 401 response → clearSession() called + LoginModal opens
- [ ] Cart adds/removes correctly + persists on reload
- [ ] Coupon validates correctly (success + failure cases)
- [ ] Razorpay modal opens with correct `key`, `order_id`, `amount`
- [ ] Payment verify succeeds → navigates to OrderConfirmPage
- [ ] Socket.IO receives `web-order:status-update` → status updates live
- [ ] Polling fallback activates when Socket.IO fails
- [ ] Polling timeout (20 attempts) → user message shown
- [ ] isProgramMerchant=false → ZERO coin UI visible anywhere
- [ ] isProgramMerchant=true → coin earn + balance + stamps visible
- [ ] hasMenu=false → ScanPayPage renders (not MenuPage)
- [ ] storeType=salon → correct UI copy
- [ ] Scan & Pay: amount entry → checkout → confirm flow completes
- [ ] Consumer app: now.rez.money/<slug> (no table) → opens in consumer app
- [ ] Consumer app: now.rez.money/<slug>?table=2 → opens in browser
- [ ] `apple-app-site-association` served from `/.well-known/` with correct Content-Type
- [ ] PWA: manifest loads, "Add to Home Screen" works on iOS + Android

---

## 23. Deployment Checklist

### One-time setup

- [ ] Create GitHub repo `imrejaul007/rez-now`
- [ ] Create Vercel project → import repo → set domain `now.rez.money`
- [ ] Add DNS CNAME: `now` → `cname.vercel-dns.com` in Cloudflare/domain registrar
- [ ] Set Vercel env vars (see Section 10)
- [ ] Set `NEXT_PUBLIC_RAZORPAY_KEY_ID` in Vercel (live key)
- [ ] Verify `/.well-known/apple-app-site-association` loads with `Content-Type: application/json`
- [ ] Get Android SHA256 fingerprint from Play Console → update `assetlinks.json`
- [ ] Submit consumer app update with new `associatedDomains` + `intentFilters` changes

### Per-deploy

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` clean
- [ ] All test scenarios in Section 22 pass
- [ ] Vercel preview URL tested before promoting to production

### Old menu.rez.money redirect

**Do NOT redirect yet.** Both `menu.rez.money` and `now.rez.money` run independently until REZ Now is fully production-ready and battle-tested. Redirect is a manual action taken only after sign-off.

When the time comes (future decision):
```json
// In old rez-web-menu/vercel.json — DO NOT ADD YET:
{
  "redirects": [
    {
      "source": "/:slug",
      "destination": "https://now.rez.money/:slug",
      "permanent": true
    }
  ]
}
```

---

## 24. Changes Needed in Other Repos

### `rezapp/nuqta-master` (Consumer App)

**File: `app.config.js`**
- Add `'applinks:now.rez.money'` to `associatedDomains`
- Add `now.rez.money` to Android `intentFilters` (see Section 8)

**File: `app/_layout.tsx`**
- Add `nowMatch` block in `handleDeepLink()` (exact code in Section 8)
- Place immediately after the existing `menuMatch` block

**Deploy:** New Expo OTA update or app store submission depending on whether `app.config.js` changes require a native rebuild. `associatedDomains` + `intentFilters` are native entitlements → **requires new app store submission**.

### `rezbackend/rez-backend-master`

- Add `storeType` and `hasMenu` fields to `GET /api/web-ordering/store/:slug` response if not already present
- Add `storeType` and `hasMenu` to `GET /api/store-payment/store/:slug` response if not already present
- Verify `PATCH /api/admin/stores/:id/settings` accepts and persists `hasMenu` + `storeType`

### `rezadmin/rez-admin-main`

- Add `storeType` dropdown to store settings screen
- Add `hasMenu` toggle to store settings screen

### `rez-web-menu` (old repo)

- Keep running as-is on `menu.rez.money` — no redirect until REZ Now is fully production-ready
- Redirect is a deliberate future action, not automatic — requires explicit sign-off
- Do NOT touch `rez-web-menu` while REZ Now is being built

---

## 25. Known Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Consumer app native build required for `associatedDomains` | High | Plan App Store submission alongside Phase 1 deploy |
| SHA256 fingerprint wrong → Android links don't work | Medium | Verify in Play Console before going live |
| Backend `hasMenu` + `storeType` fields not yet in API response | Medium | Check backend schema; add migration if needed |
| Razorpay live key vs test key confusion | Medium | Separate Vercel env per deployment environment |
| Old `menu.rez.money` QR codes in wild (printed menus, stickers) | High | No redirect until REZ Now fully ready — both run in parallel until then |
| Socket.IO CORS blocking `now.rez.money` origin | Medium | Add `now.rez.money` to Socket.IO CORS allowed origins in backend |
| Apple CDN caches `apple-app-site-association` for 24h | Low | Test on staging domain before DNS cutover |

---

*REZ Now — Universal merchant payment platform. Order & Pay for menus, Scan & Pay for everything else. One link, every store.*
