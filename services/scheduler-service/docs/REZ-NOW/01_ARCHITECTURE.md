# REZ Now — System Architecture

> **Version**: 1.0 | **Date**: 2026-04-14 | **Domain**: `now.rez.money`
> This document is the canonical engineering reference for the REZ Now web platform.
> It should be read alongside `REZ_NOW_PRODUCT_TRUTH.md` and `REZ_NOW_FEATURE_REFERENCE.md`.

---

## 1. System Overview

### What REZ Now Is

REZ Now is a **zero-install, browser-based transaction layer** for offline merchants. A customer scans a QR code, their phone opens `now.rez.money/<storeSlug>` in a browser, and they can order food, pay a bill, call a waiter, or make a UPI payment -- without downloading any app.

The platform serves three distinct user flows:

| Flow | Trigger | Experience |
|------|---------|------------|
| **Order & Pay** | Merchant has a menu | Browse categories, add to cart, customize items, checkout via Razorpay |
| **Scan & Pay** | Merchant has no menu | Enter an amount manually, pay via UPI/Razorpay/NFC |
| **Both** | Program merchant | Full access: coins, wallet, order tracking, kitchen chat, staff dashboard |

Feature gates are driven by `store.isProgramMerchant` on the `Store` model. Non-program merchants get Scan & Pay only.

### High-Level Component Diagram

```
                          ┌──────────────────────────────────────────────────────┐
                          │                    CUSTOMER (Browser)                 │
                          │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
                          │  │  REZ App     │  │  REZ Now Web │  │ Merchant  │  │
                          │  │ (Native/iOS) │  │ (now.rez.$)  │  │ Panel    │  │
                          │  └──────┬───────┘  └──────┬───────┘  └────┬─────┘  │
                          └─────────┼─────────────────┼────────────────┼───────┘
                                    │                 │                │
                          ┌─────────┴─────────────────┴────────────────┴───────┐
                          │                 Vercel Edge Network                  │
                          │              (Next.js 16 App Router)                 │
                          │  ┌──────────────────────────────────────────────┐  │
                          │  │  Static Assets / SSR Pages / API Routes        │  │
                          │  │  - /_next/static/*  (cache-first)             │  │
                          │  │  - /api/web-ordering/* (network-only)          │  │
                          │  │  - /sitemap.xml / /robots.txt                  │  │
                          │  └──────────────────────────┬───────────────────────┘  │
                          └─────────────────────────────┼───────────────────────────┘
                                                    │
                                    ┌───────────────┴────────────────┐
                                    │        REZ Backend (Express)    │
                                    │   api.rezapp.com (Render/VPS)  │
                                    │                                │
                                    │  ┌─────────────────────────┐  │
                                    │  │   Route Layer (150+)    │  │
                                    │  │   webOrderingRoutes.ts  │  │
                                    │  │   storePaymentRoutes.ts │  │
                                    │  │   walletRoutes.ts       │  │
                                    │  │   razorpayRoutes.ts     │  │
                                    │  │   authRoutes.ts        │  │
                                    │  └───────────┬─────────────┘  │
                                    │              │                │
                                    │  ┌───────────┴─────────────┐  │
                                    │  │    Service Layer        │  │
                                    │  │  - WalletService       │  │
                                    │  │  - CoinService         │  │
                                    │  │  - GamificationService  │  │
                                    │  │  - WebPushService      │  │
                                    │  │  - SMSService          │  │
                                    │  └───────────┬─────────────┘  │
                                    │              │                │
                                    │  ┌───────────┴─────────────┐  │
                                    │  │    Data Layer           │  │
                                    │  │  MongoDB (atlas)       │  │
                                    │  │  Redis  (cache/socket)  │  │
                                    │  └─────────────────────────┘  │
                                    └───────────────────────────────┘
                                                    │
                    ┌───────────────┬───────────────┼───────────────┬───────────────┐
                    │               │               │               │               │
             ┌──────┴─────┐ ┌──────┴─────┐ ┌──────┴─────┐ ┌──────┴─────┐ ┌──────┴─────┐
             │ Razorpay   │ │ WhatsApp   │ │ Wallet     │ │ Gamification│ │ Analytics  │
             │ (Payments) │ │ Business   │ │ Service    │ │ Service     │ │ Events     │
             └────────────┘ └────────────┘ └────────────┘ └─────────────┘ └────────────┘
```

### Tech Stack Summary

| Layer | Technology | Details |
|-------|------------|---------|
| **Frontend** | Next.js 16 (App Router) | TypeScript strict, Tailwind CSS v4 |
| **State** | Zustand | `authStore` (persisted `rez-auth`), `cartStore` (persisted `rez-cart`), `uiStore` (memory) |
| **Real-time** | Socket.IO v4 | Namespaces: `/` (main), `/table`, `/kds` |
| **Payments** | Razorpay SDK + UPI deep links | Amounts in paise throughout |
| **Offline** | Service Worker + IndexedDB | `rez-now-offline` DB, `pending-orders` store |
| **PWA** | `manifest.json` + `sw.js` | VAPID Web Push, offline fallback page |
| **i18n** | next-intl | EN + HI, locale in `NEXT_LOCALE` cookie |
| **Analytics** | Fire-and-forget `fetch` | 13 event types, `useTrack()` hook |
| **Error tracking** | Sentry | 10% traces, 100% replays on error |
| **Auth** | JWT (localStorage) | `rez_access_token` / `rez_refresh_token`, interceptors |
| **Deploy** | Vercel | bom1 (Mumbai) region |

---

## 2. Data Flow

### 2.1 Customer Scans a QR Code

```
[QR Code] → [Customer Camera / Browser]
  QR encodes: https://now.rez.money/<storeSlug>
  OR: https://now.rez.money/<storeSlug>?t=<tableNumber>

Browser opens: now.rez.money/<storeSlug>
  │
  ├─ Next.js SSR: fetches /api/web-ordering/store/<slug> via publicClient
  │    Returns: { store: StoreInfo, categories: MenuCategory[] }
  │    HTTP GET /api/web-ordering/store/:slug
  │
  ├─ Checks store.hasMenu
  │    true  → renders StorePageClient.tsx with full menu (Order & Pay)
  │    false → renders Scan & Pay flow (amount entry page)
  │
  └─ Sets cartStore: storeSlug, tableNumber
```

### 2.2 Menu Ordering Flow

```
[Browse Menu] → [Add to Cart] → [Checkout]
  │
  ├─ cartStore.setStore(slug, tableNumber)
  │    Persisted to localStorage key `rez-cart`
  │    If switching to a different store → cart is cleared
  │
  ├─ cartStore.addItem(item, customizations)
  │    Deduplication key: `${itemId}__${sorted customizations JSON}`
  │    Same item + same customizations → increments quantity
  │
  ├─ POST /api/web-ordering/cart/validate { storeSlug, items }
  │    Returns: { validItems, unavailableItems }
  │
  └─ POST /api/web-ordering/razorpay/create-order { cart payload }
       Creates Razorpay order on backend
       Returns: { razorpayOrderId, amount, currency }
```

### 2.3 Scan & Pay Flow

```
[Amount Entry] → [Quick amounts: ₹100-1000] → [Checkout]
  │
  ├─ POST /api/store-payment/razorpay/create-order
  │    Body: { storeSlug, amount: paise }
  │    Backend: storePaymentRoutes.ts → initiateStorePayment()
  │    Applies: qrCooldown, validateDistance(5km), merchantScanAnomaly
  │
  ├─ Razorpay SDK opens (or UPI intent on mobile)
  │    UPI fallback: 2s timeout → redirect to Razorpay checkout
  │
  ├─ POST /api/store-payment/payment/verify
  │    Body: { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
  │    Signature verification: HMAC-SHA256(razorpayOrderId|razorpayPaymentId, secret)
  │
  ├─ POST /api/store-payment/coins/credit { paymentId }
  │    Credits REZ coins to user wallet
  │    Coins = amount / 100 (1 coin per rupee)
  │
  └─ POST /api/store-payment/emit-payment
       Internal call (INTERNAL_SERVICE_TOKEN auth)
       Triggers: Socket.IO `payment:received` to Payment Kiosk
```

### 2.4 Backend-to-Downstream Service Calls

All backend-to-service calls from `rez-backend-master` follow this pattern:

```
REZ Now Frontend (Vercel)
    │
    │ HTTP POST /api/web-ordering/orders
    │ Authorization: Bearer <jwt from authStore>
    │
    ▼
rez-backend-master (Express)
    │
    ├─ authenticate() middleware
    │    Decodes JWT with JWT_SECRET
    │    Attaches req.userId, req.user
    │
    ├─ idempotencyMiddleware()
    │    Prevents duplicate order creation on retry
    │
    ├─ webOrderingController.createOrder()
    │    │
    │    ├─ MongoDB: WebOrder.create()
    │    │
    │    ├─ Socket.IO emit: `web-order:status-update`
    │    │    Namespace: / (default)
    │    │    Room: `order:${orderNumber}`
    │    │    Payload: { orderNumber, status, updatedAt }
    │    │
    │    ├─ WebPushService.send(userId, payload)
    │    │    VAPID push via Web-Push lib
    │    │    Sent to all registered endpoints for userId
    │    │
    │    └─ WhatsApp Business API (optional)
    │         If WHATSAPP_BUSINESS_ACCOUNT_ID set
    │
    └─ razorpayRoutes.ts (Razorpay SDK)
         Creates order: razorpay.orders.create({ amount, currency, receipt })
         Verifies payment: razorpay.utility.verifyPaymentSignature()
```

---

## 3. REZ Ecosystem Connections

### 3.1 REZ App (Consumer Native App)

| Shared Resource | Mechanism | Sync Direction |
|---------------|-----------|---------------|
| User account | Same `User` model in MongoDB via `userId` | Bidirectional |
| Wallet balance | `GET /api/wallet/balance` from both web and app | App is source of truth |
| Coins | `POST /api/wallet/transactions` credit/debit | Real-time on both |
| Order history | `GET /api/web-ordering/orders/history` | Web syncs from same collection |
| Auth tokens | JWT (`accessToken`, `refreshToken`) | Same issuer/secret |

**Critical invariant**: The `userId` from REZ Now's JWT must match the `userId` in REZ App's token. Both systems use the same `authenticate()` middleware backed by the same `JWT_SECRET`. If tokens diverge, wallet coins will appear inconsistent between web and app.

### 3.2 REZ Merchant (Merchant Dashboard)

| Resource | REZ Merchant Action | REZ Now Impact |
|---------|---------------------|----------------|
| Store profile | Update name, logo, hours | Reflects on `now.rez.money/<slug>` on next SSR |
| Menu items | Add/edit/delete in `Menu` collection | `GET /api/web-ordering/store/:slug/menu` |
| QR code | Generate/regenerate via `POST /api/store-payment/generate-qr/:storeId` | QR URL encodes new `now.rez.money/<slug>` |
| Payment Kiosk | View live feed at `/<slug>/merchant/pay-display` | Socket.IO `payment:received` event |
| Staff calls | Acknowledge/resolve waiter calls | `PATCH /api/web-ordering/waiter/call/:requestId` |

The Payment Kiosk (`PayDisplayClient.tsx`) connects to Socket.IO with the main namespace and joins room `merchant:${storeSlug}`. It listens for `payment:received` events:

```typescript
// lib/api/waiterStaff.ts — staff reads active calls
// GET /api/web-ordering/store/:storeSlug/waiter-calls
// PATCH /api/web-ordering/waiter/call/:requestId { status: 'acknowledged'|'resolved' }
```

### 3.3 REZ Backend Services

The `rez-backend-master` is a monolithic Express app that houses all service logic. Key service connections:

```
walletRoutes.ts        → WalletService        → LedgerEntry model (coin balance, transactions)
unifiedGamificationRoutes → GamificationService → Achievement, Streak, Leaderboard models
razorpayRoutes.ts      → Razorpay SDK        → razorpay.orders.create(), verifyPaymentSignature()
SMSService.ts          → Msg91 / Twilio      → OTP delivery on /api/user/auth/send-otp
webPushService.ts      → Web-Push lib        → VAPID push to service worker endpoints
redisService.ts        → Redis (Upstash)     → Socket.IO adapter, session cache, rate limit
```

**Coin credit flow after scan-pay**:
```
POST /api/store-payment/coins/credit { paymentId }
  → walletRoutes.creditCoins()
  → WalletService.creditCoins(userId, amount, { source: 'scan_pay', paymentId })
  → LedgerEntry.create({ type: 'credit', amount, source, referenceId })
  → Redis pub/sub: `wallet:${userId}` channel
  → REZ App (if open) receives push via WebPushService
```

---

## 4. Request Lifecycle

### 4.1 Full Menu Order Lifecycle (Order & Pay)

```
Step 1: Page Load
  GET /api/web-ordering/store/<slug>
    → webOrderingRoutes GET /store/:slug/menu
    → MongoDB: Store.findOne({ slug }) + Menu.find({ storeId })
    → Response: { store, categories, items }
    → SSR renders page (server-side, cached by Next.js)
    → Service Worker caches menu response (stale-while-revalidate, 24h max-age)

Step 2: Add to Cart (client-side only)
  cartStore.addItem({ itemId, name, price, customizations })
    → Persisted to localStorage key `rez-cart`
    → CartSummaryBar re-renders with updated count + subtotal

Step 3: Proceed to Checkout
  Client navigates: /<slug>/cart → /<slug>/checkout
  Optional: POST /api/web-ordering/coupon/validate { couponCode, storeSlug, subtotal }

Step 4: Payment Initiation
  POST /api/web-ordering/razorpay/create-order
    Body: { storeSlug, tableNumber?, orderType, items, subtotal, tip, donation }
    → validateCart() — check item availability
    → razorpay.orders.create({ amount: subtotal+paise, currency: 'INR', receipt })
    → WebOrder.create({ orderNumber, status: 'pending_payment', razorpayOrderId })
    → Response: { orderNumber, razorpayOrderId, amount }

Step 5: Payment
  Razorpay SDK opens in modal
  Customer pays via UPI/Card/Wallet
  Razorpay webhook fires to backend (optional)
  OR: Customer completes in SDK → handler(response) called

Step 6: Verify Payment
  POST /api/web-ordering/payment/verify
    Body: { orderNumber, razorpayOrderId, razorpayPaymentId, razorpaySignature }
    → verifyPaymentSignature() — HMAC-SHA256
    → WebOrder.update({ status: 'confirmed' })
    → Emit Socket.IO: `web-order:status-update` { orderNumber, status: 'confirmed' }
    → Push notification via WebPushService

Step 7: Order Tracking
  Customer navigates to /<slug>/order/<orderNumber>
  useOrderSocket(orderNumber) connects to Socket.IO
  Listens for: `web-order:status-update`
  Fallback (if socket disconnects): useOrderPolling with exponential backoff
  Status progression: pending_payment → confirmed → preparing → ready → completed

Step 8: Coins Credited
  POST /api/web-ordering/coins/credit { orderNumber }
    → GamificationService.calculateCoins(orderTotal)
    → WalletService.creditCoins(userId, coinsEarned, { source: 'web_order', orderNumber })
```

### 4.2 Scan & Pay Lifecycle

```
Step 1: Amount Entry
  Customer at /<slug>/pay
  Quick amounts: ₹100, ₹200, ₹300, ₹500, ₹1000
  Custom amount input
  POST /api/store-payment/razorpay/create-order { storeSlug, amount: paise }

Step 2: Payment Checkout
  /<slug>/pay/checkout
  useRazorpay() loads checkout.js dynamically
  Options passed to Razorpay SDK:
    {
      key: NEXT_PUBLIC_RAZORPAY_KEY_ID,
      order_id: razorpayOrderId,
      amount: paise,
      currency: 'INR',
      name: 'REZ Now',
      prefill: { contact: user.phone, name: user.name }
    }
  OR (mobile): buildUPILinks() generates UPI intent URL
    `phonepe://pay?pa=<vpa>&pn=<name>&am=<rupees>&cu=INR&tn=<note>&tr=<txnRef>`

Step 3: Verify + Confirm
  POST /api/store-payment/payment/verify
  → Signature verification
  → StorePayment.create({ status: 'completed' })
  → POST /api/store-payment/coins/credit { paymentId }
  → Coins credited to wallet
  → POST /api/store-payment/emit-payment (internal, INTERNAL_SERVICE_TOKEN)
  → Socket.IO `payment:received` to merchant Kiosk
  → Redirect to /<slug>/pay/confirm/<paymentId>

Step 4: Confirmation Page
  Shows: amount paid, coins earned, wallet balance
  CTA: "Open REZ App to track your coins"
```

---

## 5. Authentication Flow

### 5.1 Architecture

```
Browser localStorage
  rez_access_token   → JWT (15 min expiry by default)
  rez_refresh_token → Opaque refresh token (30 days)
  rez-cart          → Zustand persisted cart state
  rez-ref           → Referral code (cleared after use)

Zustand authStore (key: `rez-auth`)
  Persisted to localStorage (user object, isLoggedIn flag)
  NOT persisted: accessToken, refreshToken (stored directly via setTokens())
```

### 5.2 Phone OTP Flow

```
Step 1: Send OTP
  LoginModal → handleSendOtp()
  POST /api/user/auth/send-otp { phone: '98XXXXXXXX', countryCode: '+91', channel: 'sms' }
  → authRoutes.sendOtp()
  → SMSService.send(phone, otp) via Msg91
  → Returns: { success: true, isNewUser, hasPIN }
  → If hasPIN: route to 'pin' step
  → Else: route to 'otp' step

Step 2: Verify OTP
  POST /api/user/auth/verify-otp { phone, otp, countryCode }
  → bcrypt.compare(otp, hashedOtp) or check against Redis OTP cache
  → jwt.sign({ userId, phone }, JWT_SECRET, { expiresIn: '15m' })
  → jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '30d' })
  → Returns: { success: true, accessToken, refreshToken, user }
  → authStore.setSession(accessToken, refreshToken, user)
     setTokens(accessToken, refreshToken) → localStorage

Step 3: PIN Fallback (returning users)
  POST /api/user/auth/login-pin { phone, pin, countryCode }
  → bcrypt.compare(pin, hashedPin) via authRoutes.loginPin()
  → Same token response
  → "Forgot PIN?" → falls back to OTP

Step 4: Referral Tracking
  On successful new-user login:
  recordReferral(userId) → POST /api/web-ordering/referral { referralCode, newUserId }
  Reads from localStorage key `rez-ref` (set by referral links)
```

### 5.3 Token Refresh Interceptor

```
authClient interceptor (lib/api/client.ts):

  Request phase:
    Every authClient request gets: Authorization: Bearer <accessToken>
    Token stored in localStorage key `rez_access_token`
    Effective URL guard: only attaches token for requests to BASE_URL (prevents token leakage)

  Response phase (401 handling):
    if (status === 401 && !_retried):
      if (isRefreshing):
        Queue request in refreshQueue[]
        Return promise that resolves after refresh
      else:
        isRefreshing = true
        POST /auth/token/refresh { refreshToken }
        setTokens(newAccessToken, newRefreshToken)
        Flush refreshQueue with newToken
        Retry original request with new Authorization header

    if refresh fails:
      clearTokens() → removes both localStorage keys
      window.dispatchEvent(new CustomEvent('rez:session-expired'))
      LoginModal opens (uiStore.loginModalOpen = true)
```

### 5.4 Session Expiry Event

```
CustomEvent('rez:session-expired') → dispatched on window
  → Caught by any listener (e.g., useAuthStore subscription)
  → uiStore.loginModalOpen = true (triggers LoginModal render)
  → cartStore state preserved (orders can still be placed by logging in)
```

---

## 6. Real-Time Architecture

### 6.1 Socket.IO Setup

```
Server side (rez-backend-master):
  Socket.IO server attached to Express app
  Adapter: Redis adapter (redisService)
  Namespaces: / (default), /table, /kds

Client side (lib/hooks/useOrderSocket.ts):
  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://api.rezapp.com'
  io(SOCKET_URL, {
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })
```

### 6.2 Events Reference

| Event Name | Namespace | Direction | Payload Shape | Triggered By |
|-----------|-----------|-----------|---------------|-------------|
| `web-order:status-update` | Main `/` | Server → Client | `{ orderNumber: string, status: WebOrderStatus }` | `webOrderingController.updateOrderStatus()` |
| `payment:received` | Main `/` | Server → Client | `{ storeSlug: string, amount: number, customerName: string, timestamp: string }` | `POST /api/store-payment/emit-payment` |
| `table:message` | `/table` | Client → Server | `{ storeSlug, tableNumber, message, customerName }` | `KitchenChatDrawer.handleSend()` |
| `table:message:ack` | `/table` | Server → Client | `{ id: string, timestamp: string }` | Server on successful emit |
| `table:message:error` | `/table` | Server → Client | `{ message: string }` | Server on validation failure |
| `order:mark-preparing` | `/kds` | Client → Server | `{ orderNumber }` | Kitchen display system |
| `order:mark-ready` | `/kds` | Client → Server | `{ orderNumber }` | Kitchen display system |

### 6.3 Room Architecture

```typescript
// Order tracking: customer joins their own order room
socket.emit('join', `order:${orderNumber}`)
socket.on('web-order:status-update', (data) => {
  if (data.orderNumber === orderNumber) onStatusUpdate(data.status)
})

// Merchant Payment Kiosk: merchant joins their store room
socket.emit('join', `merchant:${storeSlug}`)
socket.on('payment:received', (data) => {
  if (data.storeSlug === storeSlug) appendPayment(data)
})

// Kitchen chat: customer joins table room
socket.emit('join', `table:${storeSlug}:${tableNumber}`)
socket.on('table:message', (data) => {
  appendKitchenMessage(data)
})
```

### 6.4 Polling Fallback

When Socket.IO disconnects (poor network, airplane mode), `useOrderPolling` activates:

```typescript
// lib/hooks/useOrderPolling.ts
const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000]  // exponential, capped
const MAX_ATTEMPTS = 20
const TERMINAL_STATUSES = ['completed', 'cancelled']

// Poll immediately on disconnect
// GET /api/web-ordering/order/:orderNumber
// Stop polling when: MAX_ATTEMPTS reached OR terminal status OR socket reconnects
```

---

## 7. Offline Architecture

### 7.1 Service Worker Strategy (public/sw.js)

```
Cache names:
  CACHE_NAME          = 'rez-now-v2'         (navigation shell)
  MENU_CACHE_NAME     = 'rez-now-menu-v1'   (menu API responses)
  STATIC_CACHE_NAME   = 'rez-now-static-v2'  (/_next/static/*, assets)

Fetch strategies by request type:

  Static assets (/_\next/static/*, *.js, *.css, *.png):
    Cache-first → network
    Cache: STATIC_CACHE_NAME
    Fallback: network

  Menu API (GET /api/web-ordering/store/*/menu):
    Stale-while-revalidate
    Cache: MENU_CACHE_NAME with 24h max-age header
    'sw-cached-at' header tracks freshness
    Fallback: serve stale if offline + cached

  Navigation (HTML page loads):
    Network-first
    Fallback: cached shell → /offline page

  API routes (/api/* except menu):
    Network-only (no caching)
    Background sync handles offline order submission

  Everything else:
    Network-first → cache fallback
```

### 7.2 IndexedDB Offline Queue

```
Database: rez-now-offline
Object store: pending-orders
Schema:
  {
    id: string          (UUID: `${Date.now()}-${random}`)
    storeSlug: string
    payload: unknown    (full order payload)
    createdAt: number   (Date.now())
    retries: number     (0-3, auto-discard at 3)
  }
Indexes: createdAt (for ordered processing)

API (lib/utils/offlineQueue.ts):
  queueOrder(storeSlug, payload)  → generates ID, persists, returns ID
  getPendingOrders()             → sorted oldest-first via createdAt index
  removeOrder(id)                → delete after successful sync
  incrementRetry(id)             → auto-discards at MAX_RETRIES (3)
  getQueueCount()               → count for UI badge
```

### 7.3 Background Sync Flow

```
User submits order while offline:
  │
  ├─ navigator.serviceWorker.ready
  │    Gets active ServiceWorkerRegistration
  │
  ├─ registration.sync.register('sync-orders')
  │    Registers Background Sync tag
  │
  ├─ ServiceWorker 'sync' event fires when connectivity returns:
  │    │
  │    ├─ openOfflineDB() → reads all pending orders
  │    │
  │    ├─ For each order:
  │    │    fetch('/api/web-ordering/orders', { method: 'POST', body: JSON })
  │    │    On success:
  │    │      deleteOrder(db, id)
  │    │      self.clients.matchAll() → postMessage({ type: 'ORDER_SYNCED' })
  │    │      self.registration.showNotification('Order placed!')
  │    │    On failure:
  │    │      incrementOrderRetry(order) → auto-discards at MAX_RETRIES
  │    │
  │    └─ 'ORDER_SYNCED' message → client tab updates UI
  │
  └─ Offline queue page: /<slug>/order/queued
       Shows: queue ID, connectivity status, pending order count
```

### 7.4 Offline UI Components

```
NetworkStatusBanner.tsx     → Shows browser online/offline status
OfflineBanner.tsx            → Amber banner when offline detected
/offline/page.tsx            → Dedicated offline fallback page with reload button
ReloadButton.tsx             → Calls navigator.serviceWorker.controller?.postMessage('SKIP_WAITING')
```

---

## 8. CDN / Deploy Architecture

### 8.1 Vercel Deployment

```
now.rez.money
  │
  ├─ Vercel Edge Network (bom1 region — Mumbai)
  │    ┌─────────────────────────────────────────────┐
  │    │  Edge Middleware (vercel.json)              │
  │    │  - CSP headers                              │
  │    │  - Security headers (X-Frame-Options, etc.)  │
  │    │  - Rate limiting (Vercel Edge Config)       │
  │    └─────────────────────────────────────────────┘
  │
  ├─ Next.js 16 App Router
  │    ┌─────────────────────────────────────────────┐
  │    │  SSR Pages (with generateMetadata)           │
  │    │  - /[storeSlug]/page.tsx (SSR)              │
  │    │  - /[storeSlug]/order/[orderNumber] (SSR)   │
  │    │  - /orders, /profile, /wallet (SSR)        │
  │    │                                             │
  │    │  Static Pages                                │
  │    │  - / (landing page)                         │
  │    │  - /search                                   │
  │    │  - /offline                                  │
  │    │                                             │
  │    │  API Routes (Next.js Route Handlers)        │
  │    │  - /api/health                              │
  │    │  - /api/set-locale                          │
  │    │  - /.well-known/assetlinks.json             │
  │    │  - /.well-known/apple-app-site-association  │
  │    └─────────────────────────────────────────────┘
  │
  └─ Static Asset CDN
       /_next/static/*     → immutable, hashed filenames
       /icon, /apple-icon  → generated via Next.js icon.tsx
       /manifest.json      → PWA manifest
```

### 8.2 App Links (Deep Linking)

```
Android (App Links):
  intent://now.rez.money/<slug>
    → Checks Digital Asset Links at: now.rez.money/.well-known/assetlinks.json
    → assetlinks.json contains: ANDROID_SHA256_CERT_FINGERPRINT
    → If match: opens REZ App at deeplink URI
    → No match: opens browser (now.rez.money/<slug>)

iOS (Universal Links):
  https://now.rez.money/<slug>
    → Checks apple-app-site-association at: now.rez.money/.well-known/apple-app-site-association
    → Contains: APPLE_TEAM_ID + IOS_BUNDLE_ID
    → If match: opens REZ App via associated domain
    → No match: renders web page normally

.env vars required:
  ANDROID_SHA256_CERT_FINGERPRINT
  ANDROID_PACKAGE_NAME
  APPLE_TEAM_ID
  IOS_BUNDLE_ID
```

### 8.3 Security Headers (vercel.json)

```
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "..." },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(self), microphone=(self), payment=(self)" }
      ]
    }
  ]
}
```

---

## 9. External Integrations

### 9.1 Razorpay

```
SDK Loading (lib/hooks/useRazorpay.ts):
  Dynamically loads: https://checkout.razorpay.com/v1/checkout.js
  Only loads when user reaches payment step (lazy)
  Failed loads cached: window.__razorpayLoadFailed = true

Order Creation (POST /api/web-ordering/razorpay/create-order):
  razorpay.orders.create({
    amount: number,        // in paise
    currency: 'INR',
    receipt: string,      // orderNumber
    notes: { storeSlug, userId, orderType }
  })

Payment Verification (POST /api/web-ordering/payment/verify):
  razorpay.utility.verifyPaymentSignature({
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string
  })
  Uses: crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
  The signature is: HMAC_SHA256(order_id|payment_id, secret)

UPI Intent Flow (lib/utils/upi.ts):
  buildUPILinks() generates 4 UPI URLs:
    phonepe://pay?pa=<vpa>&pn=<name>&am=<rupees>&cu=INR&tn=<note>&tr=<txnRef>
    tez://upi/pay?...  (Google Pay)
    paytmmp://pay?...  (Paytm)
    upi://pay?...      (generic fallback)
  openUPIApp() with 2s timeout → falls back to Razorpay checkout

NFC Tap-to-Pay (lib/hooks/useNfc.ts):
  Uses: window.NDEFReader (Web NFC API, Chrome Android only)
  startScan() → 10s timeout → setStatus('scanning'|'read'|'error'|'idle')
  on NFC read → extracts NDEF record data → triggers payment confirmation
```

### 9.2 WhatsApp Business API

```
OTP Channel (auth.ts → sendOtp):
  channel: 'whatsapp' → POST /api/user/auth/send-otp { channel: 'whatsapp' }
  → SMSService routes to WhatsApp Business API instead of SMS
  → Requires: WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_KEY

Receipt Delivery (orders.ts → sendReceipt):
  POST /api/web-ordering/receipt/send { orderNumber, via: 'whatsapp' }
  → backend generates receipt HTML/PDF
  → WhatsApp Business API sends document message
  → Requires: WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN

Referral Tracking (LoginModal.tsx):
  Referral code stored in localStorage key `rez-ref`
  On successful new-user login: POST /api/web-ordering/referral { referralCode, newUserId }
```

### 9.3 Apple Pay / Google Pay

```
These are handled natively by the Razorpay SDK:
  Razorpay SDK on iOS Safari → Apple Pay button appears if:
    - Merchant has Apple Pay configured in Razorpay dashboard
    - Device supports Apple Pay
  Razorpay SDK on Android Chrome → Google Pay button appears if:
    - Google Pay is configured in Razorpay dashboard
    - play-services-wallet available

The SDK's UPI handling:
  Razorpay SDK receives UPI apps list from device
  Presents native UPI app picker
  On completion: calls handler() with razorpay_order_id, razorpay_payment_id, razorpay_signature
```

### 9.4 Web Push Notifications

```
Subscription Flow:
  1. subscribeToPush() in lib/push/webPush.ts
  2. Notification.requestPermission() → 'granted'
  3. PushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })
  4. POST /api/web-ordering/push/subscribe { subscription }
     → WebPushSubscription.create({ userId, endpoint, keys: { p256dh, auth } })

Service Worker (sw.js):
  self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {}
    event.waitUntil(
      registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon',
        badge: '/icon',
        data: { url: data.url }
      })
    )
  })

  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    event.waitUntil(clients.openWindow(event.notification.data.url))
  })

VAPID Key:
  NEXT_PUBLIC_VAPID_PUBLIC_KEY — stored in Vercel env vars
  Corresponding private key stored in backend (webPushService uses it)
  Keys generated via: web-push generateVAPIDKeys()
```

---

## 10. State Management (Zustand)

### 10.1 Store Comparison

| Store | File | Persistence | Contents |
|-------|------|-------------|---------|
| `authStore` | `lib/store/authStore.ts` | `rez-auth` key in localStorage | `user`, `isLoggedIn` (tokens in separate localStorage keys) |
| `cartStore` | `lib/store/cartStore.ts` | `rez-cart` key in localStorage | `storeSlug`, `tableNumber`, `items`, `groupOrderId`, `scheduledFor` |
| `uiStore` | `lib/store/uiStore.ts` | Memory only | `loginModalOpen`, `loginModalCallback`, `toast` |

### 10.2 Cart Deduplication Key

```typescript
// cartStore uses a stable key for item deduplication
function cartKey(itemId: string, customizations: Record<string, string[]>): string {
  const sorted = Object.entries(customizations)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, [...v].sort()])
  return `${itemId}__${JSON.stringify(sorted)}`
}
// Same item + same customizations = same key → quantity increments
```

### 10.3 Cross-Store Considerations

```
Store switching:
  cartStore.setStore(newSlug) checks:
    if (current storeSlug !== newSlug) → clear cart, items[], groupOrderId
  This prevents ordering from two different stores in one session

Table number:
  Set on store entry (from URL ?t= parameter or QR scan)
  Persisted in cartStore
  Used in: callWaiter(), KitchenChatDrawer, reservation creation

Group orders:
  groupOrderId set for multi-person ordering
  Allows multiple customers to add to the same order
```

---

## 11. API Response Shape

All API responses from `rez-backend-master` follow this shape:

```typescript
// Success
{ success: true, data?: T, message?: string }

// Error
{ success: false, message: string, code?: string }

// Paginated
{
  success: true,
  data: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    hasNext: boolean,
    hasPrev: boolean
  }
}
```

All frontend API clients check `data.success` before returning:

```typescript
// Example from lib/api/orders.ts
const { data } = await authClient.get(`/api/web-ordering/order/${orderNumber}`)
if (!data.success) throw new Error(data.message || 'Order not found')
return data.data as WebOrder
```

---

## 12. Rate Limiting (Backend)

Applied at `webOrderingRoutes.ts` and `storePaymentRoutes.ts`:

| Endpoint | Limit | Window | Reason |
|---------|-------|--------|--------|
| `GET /api/web-ordering/store/:slug/menu` | 120 req | 60s | Menu is heavily cached; prevent scraping |
| `POST /api/web-ordering/orders` | 10 req | 60s | Prevent order flooding |
| `POST /api/user/auth/send-otp` | 5 req | 60s | OTP abuse prevention |
| `POST /api/store-payment/initiate` | 10 req | 60s | Payment abuse |
| `GET /api/web-ordering/search` | 30 req | 60s | Search scraping prevention |
| `GET /api/store-payment/lookup/:qrCode` | 30 req | 60s | QR code enumeration |

Additionally: `qrCooldown()` middleware prevents the same user from scanning the same QR code within 60 seconds. `validateDistance(5)` enforces the customer must be within 5km of the merchant (geolocation check).

---

## 13. Key Files Reference

### Frontend (rez-now/)

| File | Purpose |
|------|---------|
| `lib/api/client.ts` | `publicClient` (no auth), `authClient` (JWT + refresh interceptor), token helpers |
| `lib/api/auth.ts` | `sendOtp`, `verifyOtp`, `verifyPin`, `refreshToken` |
| `lib/api/orders.ts` | `getOrder`, `cancelOrder`, `rateOrder`, `creditCoins`, `sendReceipt` |
| `lib/api/payment.ts` | `createRazorpayOrder`, `verifyPayment`, `addTip`, `splitBill` |
| `lib/api/scanPayment.ts` | `createScanPayOrder`, `verifyScanPayment`, `creditScanPayCoins` |
| `lib/api/wallet.ts` | `getWalletBalance`, `getWalletTransactions` |
| `lib/api/waiter.ts` | `callWaiter`, `getWaiterCallStatus` (public, no auth) |
| `lib/api/waiterStaff.ts` | `getActiveCalls`, `updateCallStatus` (staff/merchant) |
| `lib/hooks/useOrderSocket.ts` | Socket.IO for live order status (`web-order:status-update`) |
| `lib/hooks/useOrderPolling.ts` | Exponential backoff polling fallback (2s-30s, 20 attempts) |
| `lib/hooks/useRazorpay.ts` | Dynamic checkout.js loader, `openPayment()` |
| `lib/hooks/useNfc.ts` | Web NFC API wrapper (NDEFReader, 10s timeout) |
| `lib/utils/offlineQueue.ts` | IndexedDB queue: `queueOrder`, `getPendingOrders`, `removeOrder` |
| `lib/utils/pushNotifications.ts` | VAPID push subscription helpers |
| `lib/utils/upi.ts` | `buildUPILinks`, `isUPIAvailable`, `openUPIApp` (2s fallback) |
| `lib/analytics/events.ts` | Fire-and-forget track(), `useTrack()` hook, 13 event types |
| `lib/store/authStore.ts` | Zustand: user, isLoggedIn, setSession, clearSession |
| `lib/store/cartStore.ts` | Zustand: items, storeSlug, tableNumber, groupOrderId, scheduledFor |
| `lib/store/uiStore.ts` | Zustand: loginModal, toast (memory only) |
| `public/sw.js` | Service worker: 5-cache strategy, background sync, push notifications |
| `app/[storeSlug]/layout.tsx` | SSR store fetch, StoreContext, header nav, LanguageSwitcher |

### Backend (rez-backend-master/src/)

| File | Purpose |
|------|---------|
| `routes/webOrderingRoutes.ts` | All web QR ordering endpoints + rate limiters |
| `routes/storePaymentRoutes.ts` | Scan & pay, QR generation, POS billing, GST invoices |
| `routes/razorpayRoutes.ts` | Razorpay webhook handler, order creation |
| `routes/walletRoutes.ts` | Coin balance, transactions, credit/debit |
| `routes/authRoutes.ts` | OTP send/verify, PIN login, token refresh |
| `middleware/auth.ts` | `authenticate()`, `verifyToken()`, `requireAdmin()` |
| `middleware/rateLimiter.ts` | `createRateLimiter()`, `generalLimiter`, `adminLimiter` |
| `middleware/qrAbuseProtection.ts` | `qrCooldown()`, `validateDistance(5)`, `merchantScanAnomaly()` |
| `services/webPushService.ts` | VAPID push sending to registered endpoints |
| `services/SMSService.ts` | Msg91/Twilio OTP delivery |
| `services/redisService.ts` | Redis client, Socket.IO adapter, session cache |
| `models/WebOrder.ts` | Mongoose schema for web orders |
| `models/StorePayment.ts` | Mongoose schema for scan-pay payments |
| `models/WebPushSubscription.ts` | Mongoose schema for push notification endpoints |

---

## 14. Environment Variables

### Frontend (Vercel)

| Variable | Example Value | Purpose |
|---------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | `https://api.rezapp.com` | Backend base URL for all API calls |
| `NEXT_PUBLIC_SOCKET_URL` | `https://api.rezapp.com` | Socket.IO connection URL |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `rzp_test_XXXXXXXXXXXX` | Razorpay public key |
| `NEXT_PUBLIC_APP_URL` | `https://now.rez.money` | Self-referential URL |
| `NEXT_PUBLIC_ANALYTICS_URL` | `https://analytics.rezapp.com` | Fire-and-forget event sink |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `BEl62iUYg...` | VAPID push public key |
| `ANDROID_SHA256_CERT_FINGERPRINT` | `XX:XX:...` | Android App Links verification |
| `ANDROID_PACKAGE_NAME` | `com.rez.now` | Android App Links |
| `APPLE_TEAM_ID` | `XXXXXXXXXX` | iOS Universal Links |
| `IOS_BUNDLE_ID` | `com.rez.now` | iOS Universal Links |

### Backend (rez-backend-master)

| Variable | Purpose |
|---------|---------|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay API credentials |
| `JWT_SECRET` | Consumer JWT signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `REDIS_URL` | Redis connection string |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `INTERNAL_SERVICE_TOKEN` | Auth for internal API calls (emit-payment) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business API |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number |
| `WHATSAPP_API_KEY` | WhatsApp API authentication |
| `VAPID_PRIVATE_KEY` | VAPID private key (web push sender) |
| `CLAUDE_API_KEY` | Anthropic API (Phase R3 AI Chatbot) |
| `MSG91_API_KEY` / `MSG91_SENDER_ID` | SMS OTP delivery |

---

## 15. Data Models (Frontend Types)

```typescript
// lib/types/index.ts — canonical type definitions

interface AuthUser {
  id: string
  phone: string
  name?: string
  email?: string
  avatarUrl?: string
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
}

interface StoreInfo {
  id: string
  slug: string
  name: string
  logo: string | null
  storeType: StoreType          // 'restaurant' | 'cafe' | 'salon' | 'retail' | ...
  hasMenu: boolean
  isProgramMerchant: boolean    // gates: coins, wallet, kitchen chat, staff
  isOpen: boolean
  address: string
  phone: string
  rating?: number
  cuisine?: string
}

interface CartItem {
  itemId: string
  name: string
  price: number                // in paise
  quantity: number
  customizations: Record<string, string[]>
  image?: string
  isVeg?: boolean
  isAvailable?: boolean
}

interface WebOrder {
  orderNumber: string
  storeSlug: string
  status: WebOrderStatus       // 'pending_payment' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
  items: CartItem[]
  subtotal: number
  tip: number
  total: number
  razorpayOrderId?: string
  createdAt: string
  scheduledFor?: string
}

type WebOrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled'

interface WalletBalance {
  coins: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  pendingCoins: number
}

interface WalletTransaction {
  id: string
  type: 'credit' | 'debit'
  amount: number
  source: string
  referenceId?: string
  createdAt: string
}
```

---

*End of REZ Now System Architecture v1.0*
