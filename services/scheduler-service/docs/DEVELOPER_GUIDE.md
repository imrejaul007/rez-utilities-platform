# REZ System — Developer Guide

> Complete onboarding reference for new developers. Read this before touching any code.

---

## Table of Contents

1. [What Is REZ?](#1-what-is-rez)
2. [System Architecture](#2-system-architecture)
3. [Repository Map](#3-repository-map)
4. [Consumer App (rez-master)](#4-consumer-app-rez-master)
5. [Merchant App (rez-merchant-master)](#5-merchant-app-rez-merchant-master)
6. [Admin App (rez-admin-main)](#6-admin-app-rez-admin-main)
7. [Web Menu PWA (rez-web-menu)](#7-web-menu-pwa-rez-web-menu)
8. [Backend API (rez-backend-master)](#8-backend-api-rez-backend-master)
9. [Microservices](#9-microservices)
10. [Key Data Models](#10-key-data-models)
11. [API Route Reference](#11-api-route-reference)
12. [Authentication Flow](#12-authentication-flow)
13. [Payment Flow](#13-payment-flow)
14. [REZ Coin & Loyalty Economy](#14-rez-coin--loyalty-economy)
15. [Real-Time Features (Socket.IO)](#15-real-time-features-socketio)
16. [Background Jobs (BullMQ)](#16-background-jobs-bullmq)
17. [Infrastructure & Services](#17-infrastructure--services)
18. [Environment Variables](#18-environment-variables)
19. [Local Dev Setup](#19-local-dev-setup)
20. [Build & Deploy](#20-build--deploy)
21. [Testing](#21-testing)
22. [Git Workflow](#22-git-workflow)
23. [Common Patterns & Conventions](#23-common-patterns--conventions)
24. [Known Gotchas](#24-known-gotchas)

---

## 1. What Is REZ?

REZ is a hyperlocal commerce + loyalty platform for India. It connects consumers with local stores (restaurants, retail, services) via:

- **Discovery** — find stores, deals, events near you
- **Ordering** — food delivery, pickup, dine-in, bookings
- **Payments** — Razorpay checkout, wallet (REZ Cash), coins/rewards
- **Loyalty** — REZ Score, coins, tiers, challenges, cashback
- **Merchant Tools** — POS, inventory, analytics, CRM, staff, settlements
- **QR Ordering** — web-based dine-in ordering via QR code (no app install)

There are three end-user apps, a web PWA, and a shared backend composed of a monolith + 12 microservices behind an nginx API gateway.

---

## 2. System Architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│ Consumer App │  │ Merchant App │  │  Admin App   │  │  Web Menu PWA    │
│ React Native │  │ React Native │  │  React Native│  │  React + Vite    │
│  Expo SDK 53 │  │  Expo SDK 53 │  │  Expo SDK 53 │  │  (rez-web-menu)  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘
       │                 │                  │                   │
       └─────────────────┴──────────────────┴───────────────────┘
                                    │ HTTPS
                                    ▼
                      ┌─────────────────────────┐
                      │    nginx API Gateway     │
                      │   (rez-api-gateway)      │
                      │  Strangler Fig routing   │
                      └────────────┬────────────┘
                                   │
              ┌────────────────────┼──────────────────────┐
              │                    │                       │
              ▼                    ▼                       ▼
   ┌──────────────────┐  ┌─────────────────┐   ┌──────────────────┐
   │   REZ Monolith   │  │  Microservices  │   │  Microservices   │
   │ rez-backend-master│  │  (auth, wallet) │   │ (order, catalog, │
   │  Express + TS    │  │  (payment, mktg)│   │  search, media,  │
   │  MongoDB + Redis │  │  (gamification) │   │  analytics, etc) │
   └──────┬───────────┘  └────────┬────────┘   └────────┬─────────┘
          │                       │                       │
   ┌──────┴──────────────────────┴───────────────────────┴──────┐
   │  MongoDB Atlas │ Upstash Redis │ Cloudinary │ BullMQ Queues │
   └─────────────────────────────────────────────────────────────┘
          │
   Twilio (SMS) │ SendGrid (Email) │ Razorpay (Payments)
   Firebase (Push) │ Sentry (Errors)
```

### Strangler Fig Pattern

The nginx gateway routes specific paths to microservices; everything else falls through to the monolith. This allows incremental extraction of services without a big-bang rewrite.

**Routing rules (summarised):**

| Path prefix | Routed to |
|-------------|-----------|
| `/api/search/`, `/api/stores/search`, `/api/stores/nearby`, `/api/stores/trending`, `/api/products/search`, `/api/homepage`, `/api/recommendations/` | rez-search-service |
| `/api/user/auth/` | rez-auth-service |
| `/api/payment/`, `/api/razorpay/` | rez-payment-service |
| `/api/wallet/`, `/api/merchant/wallet/` | rez-wallet-service |
| `/api/merchant/pos/` | rez-merchant-service |
| `/api/merchant/broadcasts/` | rez-marketing-service |
| `/api/merchant/` (other) | rez-merchant-service |
| Everything else | REZ monolith (BACKEND_URL) |

**API base URL (production):** `https://api.rezapp.com/api`

---

## 3. Repository Map

| Folder | Repo | What It Is |
|--------|------|------------|
| `rezapp/rez-master/` | Consumer App | React Native app for end users |
| `rezmerchant/rez-merchant-master/` | Merchant App | React Native app for store owners |
| `rezadmin/rez-admin-main/` | Admin App | React Native web admin dashboard |
| `rez-web-menu/` | Web Menu PWA | Vite/React QR-code ordering PWA |
| `rezbackend/rez-backend-master/` | Backend API | Node.js REST API + WebSockets (monolith) |
| `rez-api-gateway/` | API Gateway | nginx Docker container, routes traffic |
| `rez-auth-service/` | Auth Service | OTP, JWT issuance/refresh |
| `rez-wallet-service/` | Wallet Service | REZ Cash balance, transfers |
| `rez-payment-service/` | Payment Service | Razorpay integration |
| `rez-order-service/` | Order Service | Order lifecycle, SSE streaming |
| `rez-catalog-service/` | Catalog Service | Product/menu CRUD |
| `rez-search-service/` | Search Service | Elasticsearch / search + recommendations |
| `rez-gamification-service/` | Gamification | Achievements, streaks, leaderboard |
| `rez-marketing-service/` | Marketing | Campaign broadcasts, BullMQ fanout |
| `rez-notification-events/` | Notifications | Push/SMS/email workers + DLQ |
| `rez-media-events/` | Media | File upload, Cloudinary, static serve |
| `analytics-events/` | Analytics | Event ingestion, merchant analytics |
| `rez-merchant-service/` | Merchant Service | POS, merchant-specific APIs |

All repos live inside the `ReZ Full App/` workspace folder.

---

## 4. Consumer App (rez-master)

### Tech Stack
- **Framework:** React Native 0.79.6 + Expo SDK 53
- **Navigation:** Expo Router v4 (file-based routing, like Next.js)
- **State:** React Context API (no Redux)
- **Payments:** Razorpay React Native SDK
- **Push Notifications:** Firebase Cloud Messaging via `expo-notifications`
- **Styling:** StyleSheet (no Tailwind)
- **Build:** EAS Build (Expo Application Services)

### Folder Structure

```
rez-master/
├── app/                    ← All screens (file = route)
│   ├── (tabs)/             ← Bottom tab navigator screens
│   │   ├── index.tsx       ← Home screen
│   │   ├── categories.tsx
│   │   ├── search.tsx
│   │   └── more.tsx
│   ├── onboarding/         ← First-launch flow + interests selection
│   ├── sign-in.tsx         ← Auth screen
│   ├── checkout.tsx
│   ├── payment-razorpay.tsx
│   ├── wallet/             ← REZ Cash wallet
│   ├── orders/             ← Order history & tracking
│   ├── booking/            ← Table/event bookings
│   ├── games/              ← Gamification screens
│   ├── achievements/       ← Achievement grid
│   ├── transaction-history/ ← Cursor-paginated coin/wallet history
│   ├── checkin-history/    ← Streak timeline
│   ├── notifications/      ← Notification inbox
│   ├── premium/            ← REZ Premium subscription
│   ├── group-buy/          ← Group purchase flow
│   ├── bill-simulator/     ← Savings calculator
│   ├── map/                ← Nearby stores map view
│   ├── help/               ← FAQ + support tickets
│   └── ...                 ← 100+ more screens
├── components/             ← Shared UI components
│   ├── common/             ← ErrorBoundary, OfflineBanner
│   ├── skeletons/          ← SkeletonCard, SkeletonList
│   ├── ui/                 ← EmptyState, Toast
│   └── homepage/           ← Home feed cards
├── contexts/               ← React Contexts
│   ├── AuthContext.tsx      ← JWT token + user state
│   ├── CartContext.tsx      ← Shopping cart state
│   ├── ToastContext.tsx     ← Global toasts
│   ├── ThemeContext.tsx     ← Dark/light mode + AsyncStorage persist
│   └── WishlistContext.tsx
├── services/               ← API call functions (axios wrappers)
├── config/
│   └── env.ts              ← All EXPO_PUBLIC_* env vars, typed
├── utils/setup/
│   └── AppProviders.tsx    ← Wraps entire app with all providers
├── app.config.js           ← Expo config (permissions, plugins)
└── eas.json                ← Build profiles (dev/preview/production)
```

### Navigation Pattern

Expo Router uses the filesystem as the route tree:
- `app/(tabs)/index.tsx` → `/` (home tab)
- `app/checkout.tsx` → `/checkout`
- `app/store/[id].tsx` → `/store/:id`

Deep links: `rezapp://invite`, `rezapp://checkin`

### Key Contexts

| Context | Purpose |
|---------|---------|
| `AuthContext` | JWT access token, refresh token, user object. Handles login/logout. |
| `CartContext` | In-memory cart items. Synced to backend on checkout. |
| `ToastContext` | `showToast(msg, type)`. Use `showGlobalToast(msg)` outside React tree. |
| `ThemeContext` | Light/dark palette, `toggleTheme()`, persisted to AsyncStorage. |
| `WishlistContext` | Wishlist items, persisted via API. |

### API Calls

All API functions are in `services/`. They use axios with the base URL from `config/env.ts`:

```typescript
import { api } from '../config/env';
// api.prodUrl = process.env.EXPO_PUBLIC_PROD_API_URL
```

Auth token attached by `AuthContext` via axios interceptor.

---

## 5. Merchant App (rez-merchant-master)

### Tech Stack
- Same as Consumer App: React Native 0.79.6 + Expo SDK 53 + Expo Router
- Additional: Bluetooth printing (`react-native-ble-manager`), POS, offline queue

### Folder Structure

```
rez-merchant-master/
├── app/
│   ├── (auth)/             ← Login / register
│   ├── (dashboard)/        ← Main dashboard tabs
│   │   ├── index.tsx       ← Home: Today at a Glance card + metrics
│   │   └── growth.tsx      ← Growth intelligence dashboard
│   ├── analytics/
│   │   ├── offer-performance.tsx  ← Redemption stats + 7-day bar chart
│   │   ├── comparison.tsx         ← Month-over-month % change
│   │   ├── cohorts.tsx            ← Week 0/1/2/4 retention
│   │   └── peak-hours.tsx         ← 7×24 heatmap
│   ├── orders/live.tsx     ← SSE live order stream + haptic alerts
│   ├── pos/                ← Point of sale terminal (offline-capable)
│   ├── inventory/alerts.tsx← Low stock / out-of-stock alerts
│   ├── customers/
│   │   ├── segments.tsx    ← 3-tab customer segmentation
│   │   ├── insights.tsx    ← CRM analytics
│   │   └── message.tsx     ← Segment broadcast with template picker
│   ├── payouts/index.tsx   ← Payout history + request payout
│   ├── qr-generator/       ← Store check-in QR
│   ├── marketing/templates.tsx ← Template CRUD + live preview
│   ├── settings/
│   │   ├── staff.tsx       ← Invite/remove staff
│   │   ├── business-hours.tsx ← Per-day open/close times
│   │   ├── profile.tsx     ← Logo upload, unsaved guard
│   │   ├── notifications.tsx ← Push + email preference toggles
│   │   └── about.tsx       ← App version, support, store links
│   ├── goals/index.tsx     ← Monthly revenue/visits targets
│   ├── reports/export.tsx  ← CSV export (expo-file-system + expo-sharing)
│   ├── disputes/index.tsx  ← Approve/reject disputes
│   ├── catalog/index.tsx   ← Product CRUD + stock badges
│   ├── stores/locations.tsx← Multi-store + active store switch
│   ├── aov-rewards/        ← Average order value reward programs
│   ├── rez-capital/        ← Working capital loans/financing
│   └── onboarding/merchant-checklist.tsx ← 5-step onboarding
├── services/api/           ← API calls by domain
├── services/printer.ts     ← Bluetooth receipt printer (native)
├── services/offlinePOSQueue.ts ← Queue orders when offline
├── config/                 ← Env vars, payment config
└── eas.json
```

### Merchant-Specific Features

| Feature | Location | Notes |
|---------|----------|-------|
| POS Terminal | `app/pos/` | Offline-capable, BullMQ queue |
| Offline Queue | `services/offlinePOSQueue.ts` | Syncs when back online |
| Receipt Printer | `services/printer.ts` | BLE thermal printers |
| Floor Plan | `app/floor-plan/` | Table layout management |
| KDS | `app/kds/` | Kitchen Display System |
| REZ Capital | `app/rez-capital/` | Working capital loans |
| Khata | `app/khata/` | Credit/debit ledger |
| Live Orders | `app/orders/live.tsx` | SSE stream, 5s poll, haptic alert |

### Authentication

Merchants log in with email + password. Backend returns `merchantToken` (JWT). Signed with `JWT_MERCHANT_SECRET` — separate from consumer JWT.

---

## 6. Admin App (rez-admin-main)

### Tech Stack
- **Framework:** React Native (Expo Router) compiled as a web app
- **Navigation:** Expo Router v4 file-based, rendered in browser
- **Styling:** NativeWind / StyleSheet
- **Auth:** Admin JWT (role-based: `admin`, `super_admin`, `viewer`)

### What It Is

A web-based operations dashboard for the REZ team. Not customer-facing — internal ops tool. Accessed at the admin web URL.

### Admin Screens (128 screens in `app/(dashboard)/`)

Key screens by category:

| Category | Screens |
|----------|---------|
| **Users** | `users.tsx`, `users/[id].tsx` — list, search, suspend, user detail |
| **Fraud** | `fraud-queue.tsx`, `fraud-reports.tsx`, `fraud-alerts.tsx`, `fraud-config.tsx` |
| **Moderation** | `reviews.tsx`, `stores-moderation.tsx`, `ugc-moderation.tsx`, `photo-moderation.tsx`, `comments-moderation.tsx` |
| **Finance** | `revenue.tsx`, `wallet.tsx`, `wallet-adjustment.tsx`, `reconciliation.tsx`, `merchant-withdrawals.tsx` |
| **Merchants** | `merchants.tsx`, `merchant-flags/`, `merchant-plan-analytics.tsx` |
| **Coins/Loyalty** | `coin-governor.tsx`, `coin-rewards.tsx`, `coin-gifts.tsx`, `cashback-rules.tsx`, `loyalty.tsx`, `gamification-economy.tsx` |
| **Broadcasts** | `broadcast.tsx`, `notification-management.tsx`, `campaign-management.tsx` |
| **System** | `system-health.tsx`, `job-monitor.tsx`, `api-latency.tsx`, `live-monitor.tsx`, `audit-log.tsx` |
| **Config** | `admin-settings.tsx`, `feature-flags.tsx`, `platform-config.tsx` |
| **Content** | `offers.tsx`, `voucher-management.tsx`, `categories.tsx`, `flash-sales.tsx` |

### Admin Authentication

Admin token is a consumer JWT with `role: 'admin'` or `role: 'super_admin'`. The `requireAdmin` middleware on the backend checks `req.user.role`.

### Key Backend Routes (Admin)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/admin/stats` | Platform KPIs (users, merchants, revenue, WAU) |
| `GET /api/admin/users` | Paginated user list with search + status filter |
| `GET /api/admin/users/:id` | User detail + transaction history |
| `POST /api/admin/users/:id/suspend` | Suspend / unsuspend with reason |
| `GET /api/admin/fraud-queue` | Users flagged by coin velocity z-score |
| `POST /api/admin/users/:id/clear-fraud-flag` | Clear fraud flag |
| `POST /api/admin/users/:id/reset-streak` | Reset user streak to 0 |
| `GET /api/admin/reviews` | Paginated reviews with status filter |
| `PATCH /api/admin/reviews/:id` | Approve / reject review |
| `PATCH /api/admin/reviews/bulk-approve` | Approve all pending |
| `GET /api/admin/stores` | Store list with search + active/inactive filter |
| `PATCH /api/admin/stores/:id/status` | Activate / deactivate store |
| `GET /api/admin/broadcast/estimate` | Count users matching audience |
| `POST /api/admin/broadcast/send` | Platform-wide broadcast (BullMQ fanout) |
| `GET /api/admin/broadcasts` | Broadcast history |
| `GET /api/admin/revenue` | 7-day revenue + transactions |
| `GET /api/admin/top-merchants` | Top merchants by revenue |
| `GET /api/admin/user-tiers` | Bronze/Silver/Gold/Platinum counts |
| `GET /api/admin/audit-log` | Paginated admin action log |
| `GET /api/admin/export/revenue` | CSV revenue export |

---

## 7. Web Menu PWA (rez-web-menu)

### What It Is

A Progressive Web App that lets diners scan a restaurant QR code and order/pay without installing anything. Works on any mobile browser.

### Tech Stack
- **Framework:** React 18 + TypeScript + Vite 5
- **Routing:** React Router v6
- **State:** Zustand (persisted cart)
- **Styling:** Tailwind CSS
- **PWA:** Service worker, Web App Manifest, installable

### QR Ordering Flow

```
1. Merchant generates QR: rez-web-menu.onrender.com/:storeSlug?table=3

2. Diner scans → MenuPage loads
   - fetchStoreMenu(storeSlug) → menu data
   - storeData cached in cartStore (Zustand persist)

3. Diner browses, filters (veg/non-veg/vegan/jain), searches

4. Add items → CartPage → CheckoutPage

5. CheckoutPage:
   - Send OTP → verify OTP (consumer auth)
   - Apply coupon / REZ Coins / REZ Cash
   - Razorpay payment sheet
   - POST /api/web-ordering/orders

6. OrderConfirmPage:
   - Exponential backoff polling (2→4→8→16→30s)
   - Real-time status: pending → confirmed → preparing → ready → completed

7. RequestBillPage: request bill for table
8. ReceiptPage: printable digital receipt (token-authenticated URL)
```

### Folder Structure

```
rez-web-menu/src/
├── pages/
│   ├── MenuPage.tsx          ← Main menu (1100+ lines — largest file)
│   ├── CartPage.tsx          ← Cart with upsell + per-item notes
│   ├── CheckoutPage.tsx      ← OTP auth + payment (1300+ lines)
│   ├── OrderConfirmPage.tsx  ← Live order tracking with backoff polling
│   ├── OrderHistoryPage.tsx  ← Past orders + reorder
│   ├── StoreFrontPage.tsx    ← Public storefront (uses cartStore cache)
│   ├── RequestBillPage.tsx   ← Request bill for table
│   ├── ReceiptPage.tsx       ← Printable receipt
│   └── NotFoundPage.tsx
├── components/
│   ├── MenuItemCard.tsx      ← Grid + compact list mode (compact prop)
│   ├── CartFAB.tsx           ← Floating cart button (always above BottomNav)
│   ├── BottomNav.tsx         ← Menu / Cart / My Order / Waiter / Bill tabs
│   ├── QuantitySelector.tsx
│   ├── CustomisationModal.tsx ← Variant + modifier bottom sheet
│   ├── GroupOrderModal.tsx   ← Group buy flow
│   ├── TipSelector.tsx
│   ├── RezCoinsBanner.tsx
│   └── ...
├── store/
│   ├── cartStore.ts          ← Zustand + persist (cart, auth session, storeData)
│   └── rezCoinsStore.ts      ← Coin balance
├── hooks/
│   ├── useDarkMode.ts        ← localStorage dark mode toggle
│   └── useAnalytics.ts       ← sendBeacon fire-and-forget event tracking
├── api/
│   └── client.ts             ← Axios instances + GET cache (stale-while-revalidate)
└── types.ts
```

### Key UX Features (all implemented)

| Feature | Detail |
|---------|--------|
| Dark mode | `useDarkMode` hook, localStorage persist |
| Veg/Non-Veg filter | 6 options: All, Veg, Non-Veg, Vegan, Gluten-Free, Jain |
| Search | Persists when query non-empty, clear button |
| Overflow menu | ⋯ button collapses dark mode + group order + share |
| Accessibility | Aa button → font size (A-/A/A+) + high contrast popover |
| List/Grid toggle | LayoutList icon in category bar → compact `MenuItemCard` |
| Back to top | Appears after 300px scroll, smooth scroll |
| AI recommendations | Horizontal scroll in MenuPage + CartPage upsell |
| Per-item notes | Inline textarea in CartPage, saved via `updateCustomisation` |
| Clear cart confirm | Inline red confirmation banner before clearing |
| PWA shortcuts | Long-press icon → My Orders, View Cart |

### Service Worker Strategy

- Static assets: cache-first
- Menu API (`/api/web-ordering/menu/*`, `/api/stores/*/menu`): stale-while-revalidate
- All other API calls: network-only

### Analytics Events

Tracked via `useAnalytics.ts` → `POST /api/analytics/web-events`:

| Event | Fired when |
|-------|-----------|
| `menu_viewed` | Menu data loads |
| `add_to_cart` | Item added (from CartPage upsell) |
| `checkout_started` | User reaches paying step |
| `otp_requested` | User requests OTP |
| `coupon_applied` | Coupon validated successfully |
| `order_placed` | Order confirmed by backend |

---

## 8. Backend API (rez-backend-master)

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ + TypeScript |
| Framework | Express.js |
| Database | MongoDB (Mongoose ODM) |
| Cache | Redis (ioredis + Upstash) |
| Auth | JWT (access + refresh tokens) |
| Queues | BullMQ (background jobs) |
| Real-time | Socket.IO |
| Images | Cloudinary |
| SMS/OTP | Twilio |
| Email | SendGrid |
| Payments | Razorpay + Stripe |
| Push | Firebase Admin SDK |
| Monitoring | Sentry + Prometheus (prom-client) |
| Logging | Winston + daily rotate |

### Entry Points

```
src/server.ts               ← Starts HTTP server (PORT env var)
src/worker.ts               ← BullMQ worker process (run separately)
src/config/
  ├── database.ts           ← MongoDB connection
  ├── middleware.ts         ← CORS, helmet, compression, rate limits, X-Response-Time
  ├── routes.ts             ← ALL route registrations (app.use())
  ├── socketSetup.ts        ← Socket.IO event handlers
  ├── cronJobs.ts           ← node-cron scheduled tasks
  └── validateEnv.ts        ← Startup env var validation (exits on missing required)
```

### Directory Structure

```
src/
├── controllers/            ← Request handlers (thin, delegate to services)
├── services/               ← Business logic
├── models/                 ← Mongoose schemas
├── routes/                 ← Express routers
├── middleware/             ← Auth, rate limiting, validation, security headers
├── types/                  ← TypeScript interfaces
├── utils/                  ← Helpers (asyncHandler, etc.)
├── validators/             ← express-validator rule sets
├── jobs/                   ← Cron jobs (fraud detection, coin expiry)
├── workers/                ← BullMQ processors
└── scripts/                ← Seed data, migrations, load test
```

### Rate Limiters (tiered)

| Limiter | Rate | Applied to |
|---------|------|-----------|
| `strictLimiter` | 10 req/min per IP | OTP, auth endpoints |
| `generalLimiter` | 60 req/min per IP | Most routes |
| `bulkLimiter` | 100 req/min per IP | Feed, search endpoints |
| Merchant writes | 30 req/min per Authorization header | Merchant write routes |

### Health Endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /health` | `{ status, uptime, memoryUsage, nodeVersion, env, db, redis }` |
| `GET /health/ready` | Readiness probe (DB + Redis checks) |
| `GET /metrics` | Prometheus plain-text metrics |

---

## 9. Microservices

Each microservice is a standalone Node.js + TypeScript Express app deployed on Render. They share MongoDB Atlas and Upstash Redis. Inter-service calls use `INTERNAL_SERVICE_TOKEN` in the `Authorization: Bearer` header.

### Service Overview

| Service | Port (local) | Handles | Prometheus `/metrics` |
|---------|-------------|---------|----------------------|
| `rez-auth-service` | 5010 | OTP send/verify, JWT issuance, token refresh, Redis blacklist | No |
| `rez-wallet-service` | 5011 | REZ Cash balance, credit/debit, transfers | Yes |
| `rez-payment-service` | 5012 | Razorpay order create, webhook verify | No |
| `rez-order-service` | 5013 | Order lifecycle, `GET /orders/stream` SSE | No |
| `rez-catalog-service` | 5014 | Merchant product CRUD | No |
| `rez-search-service` | 5015 | Full-text search, nearby, trending, recommendations (60s cache) | No |
| `rez-gamification-service` | 5016 | Achievements, streaks, leaderboard, BullMQ workers | Yes |
| `rez-marketing-service` | 5017 | Campaign broadcasts, BullMQ fanout to notification queue | No |
| `rez-notification-events` | 5018 | Push/SMS/email delivery workers, exponential backoff, DLQ | No |
| `rez-media-events` | 5019 | `POST /upload` (multer 10MB), Cloudinary upload, static serve | No |
| `analytics-events` | 5020 | Event ingestion, `GET /analytics/merchant/:id/coin-summary` | No |
| `rez-merchant-service` | 5021 | POS transactions, merchant-specific APIs | No |
| `rez-finance-service` | 4005 | BNPL, personal loans, ReZ Score, bill pay, partner offers | No |

### Health Check Pattern

Every microservice exposes:
- `GET /health` — full status with dependency checks
- `GET /health/live` — liveness probe (process up)
- `GET /health/ready` — readiness probe (MongoDB/Redis connected)

### Internal Service Communication

**Standard pattern** — use `x-internal-token` + `x-internal-service` headers:

```typescript
// Preferred: scoped identity (allows per-caller token via INTERNAL_SERVICE_TOKENS_JSON)
const response = await axios.get(`${process.env.WALLET_SERVICE_URL}/internal/balance/${userId}`, {
  headers: {
    'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN,
    'x-internal-service': 'rez-order-service',
  },
});
```

The receiving service checks `INTERNAL_SERVICE_TOKENS_JSON` first for a scoped token keyed by `x-internal-service`, then falls back to the shared `INTERNAL_SERVICE_TOKEN`. Both sides use `crypto.timingSafeEqual` with SHA-256 hashing. Missing config fails closed with `503`.

### W3C Tracing

All services inject a `traceparent` header on every response and propagate inbound `traceparent` / `x-trace-id` / `x-correlation-id` headers. `res.locals.traceId` and `res.locals.spanId` are available in all route handlers.

### SSE (Server-Sent Events) — Order Service

`GET /api/orders/stream?storeSlug=X` — merchants subscribe to live order updates:
- Polls MongoDB every 3 seconds for new orders
- Sends `heartbeat` every 15 seconds to keep connection alive
- Client reconnects automatically on disconnect

---

## 10. Key Data Models

All models in `src/models/`. Each is a Mongoose schema with TypeScript interface.

### Core Models

| Model | Collection | Description |
|-------|-----------|-------------|
| `User` | users | Consumer accounts (phone/email, JWT refresh, fraudFlags, tier) |
| `Merchant` | merchants | Store owner accounts |
| `Store` | stores | Physical store/restaurant (operatingHours, ratings) |
| `Product` | products | Items for sale |
| `Order` | orders | Purchase orders (delivery/pickup/dine-in) |
| `Cart` | carts | Active shopping carts |
| `Wallet` | wallets | REZ Cash balance |
| `Transaction` | transactions | All wallet movements |
| `Offer` | offers | Deals & discounts |
| `Voucher` | vouchers | Redeemable coupons |
| `Review` | reviews | Store/product reviews (status: pending/approved/rejected) |
| `Notification` | notifications | Push notification log |
| `Address` | addresses | Saved user addresses |
| `Booking` | bookings | Table/service/event bookings |

### Loyalty & Gamification Models

| Model | Collection | Description |
|-------|-----------|-------------|
| `CoinTransaction` | cointransactions | Every coin earn/spend event |
| `UserStreak` | userstreaks | Check-in streak (day-diff logic) |
| `Achievement` | achievements | Unlocked achievement records |
| `Challenge` | challenges | Gamification challenges |
| `UserSubscription` | usersubscriptions | REZ Premium (plan, renewsAt, coinMultiplier) |

### Merchant Models

| Model | Collection | Description |
|-------|-----------|-------------|
| `MerchantPayout` | merchantpayouts | Payout requests + status |
| `MerchantStaff` | merchantstaff | Staff members (role, isActive) |
| `MerchantTemplate` | merchanttemplates | Message templates (title, body, variables) |
| `MerchantGoal` | merchantgoals | Monthly revenue/visits targets |
| `MerchantInvoice` | merchantinvoices | Auto-numbered INV-YYYY-NNNN |
| `MerchantDispute` | merchantdisputes | Dispute type/status/notes |

### Social & Group Models

| Model | Collection | Description |
|-------|-----------|-------------|
| `GroupBuy` | groupbuys | Group purchase (inviteCode, members[], expiresAt) |
| `KhataEntry` | khataentries | Credit ledger entries |
| `GiftCard` | giftcards | Gift card issuance/redemption |

### Admin Models

| Model | Collection | Description |
|-------|-----------|-------------|
| `AuditLog` | auditlogs | Admin action trail |
| `AdminBroadcast` | adminbroadcasts | Platform-wide broadcast history (audience, sentAt, userCount) |

### Compound Indexes (hot query paths)

Defined in `src/jobs/ensureIndexes.ts` and run at startup:

| Collection | Index |
|-----------|-------|
| `cointransactions` | `{ userId: 1, createdAt: -1 }` |
| `userstreaks` | `{ userId: 1 }` (unique) |
| `stores` | `{ location: '2dsphere' }`, `{ merchantId: 1 }` |
| `notifications` | `{ userId: 1, isRead: 1, createdAt: -1 }` |

---

## 11. API Route Reference

### Consumer Routes (`/api/`)

| Prefix | Domain |
|--------|--------|
| `/api/user/auth` | Login, register, OTP, refresh token |
| `/api/products` | Product listing, search, detail |
| `/api/categories` | Category tree |
| `/api/stores` | Store listing, detail, feed (distance/offer/rating/trending score) |
| `/api/cart` | Cart CRUD |
| `/api/orders` | Place order, order history, tracking |
| `/api/wallet` | REZ Cash balance, top-up, transfers |
| `/api/wallet/gift-cards` | Gift card redemption |
| `/api/offers` | Deals, offers listing |
| `/api/vouchers` | Voucher listing/redemption |
| `/api/wishlist` | Save/remove from wishlist |
| `/api/notifications` | Notification inbox, mark read |
| `/api/reviews` | Write/read reviews |
| `/api/favorites` | Saved stores |
| `/api/analytics` | User-facing analytics events |
| `/api/location` | Geolocation, area lookup |
| `/api/score` | REZ Score breakdown |
| `/api/goals` | Savings goals |
| `/api/rewards/instant` | Instant reward claims |
| `/api/consumer/khata` | Consumer credit ledger |
| `/api/user/savings` | Savings insights + best-nearby |
| `/api/user/activity-feed` | Friend check-ins + achievements |
| `/api/user/subscription` | REZ Premium subscribe/cancel |
| `/api/user/settings` | Notification toggles, data export, delete request |
| `/api/group-buy` | Create/join group buy, confirm + coin distribution |
| `/api/transaction-history` | Cursor-paginated coin/wallet history |

### Merchant Routes (`/api/merchant/`)

| Prefix | Domain |
|--------|--------|
| `/api/merchant/auth` | Merchant login/register |
| `/api/merchant/stores` | Store profile, multi-store switch |
| `/api/merchant/products` | Product CRUD, bulk import |
| `/api/merchant/orders` | Incoming orders + live SSE stream |
| `/api/merchant/inventory` | Stock alerts, threshold, peak hours |
| `/api/merchant/analytics` | Business analytics, coin summary, offer performance |
| `/api/merchant/team` | Staff management |
| `/api/merchant/staff-shifts` | Shift scheduling |
| `/api/merchant/customers` | CRM, customer list, segments |
| `/api/merchant/customer-insights` | Advanced CRM analytics |
| `/api/merchant/khata` | Business credit ledger |
| `/api/merchant/rez-capital` | Loan applications |
| `/api/merchant/discounts` | Discount rules |
| `/api/merchant/pos` | POS transaction processing |
| `/api/merchant/floor-plan` | Table/seating layout |
| `/api/merchant/campaigns` | Marketing campaigns |
| `/api/merchant/broadcasts` | Segment broadcast (1/hr rate limit) |
| `/api/merchant/disputes` | Dispute management |
| `/api/merchant/invoices` | Invoice generation (INV-YYYY-NNNN) |
| `/api/merchant/payouts` | Payout requests |
| `/api/merchant/qr` | QR payload + template CRUD |
| `/api/merchant/export` | CSV export (transactions/customers/payouts) |
| `/api/merchant/goals` | Monthly revenue/visits targets |
| `/api/merchant/settings` | Notification preferences |
| `/api/merchant/growth` | Growth intelligence |

### Admin Routes (`/api/admin/`)

All require `requireAuth` + `requireAdmin` middleware.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/admin/stats` | Platform KPIs |
| `GET/POST /api/admin/users` | User list + add admin |
| `POST /api/admin/users/:id/suspend` | Suspend/unsuspend |
| `GET /api/admin/fraud-queue` | Flagged users |
| `POST /api/admin/users/:id/clear-fraud-flag` | Clear z-score flag |
| `POST /api/admin/users/:id/reset-streak` | Reset streak |
| `GET /api/admin/reviews` | Paginated reviews |
| `PATCH /api/admin/reviews/:id` | Approve/reject |
| `PATCH /api/admin/reviews/bulk-approve` | Bulk approve pending |
| `GET /api/admin/stores` | Store list with search + filter |
| `PATCH /api/admin/stores/:id/status` | Activate/deactivate |
| `GET /api/admin/broadcast/estimate` | Audience size estimate |
| `POST /api/admin/broadcast/send` | Platform broadcast |
| `GET /api/admin/broadcasts` | Broadcast history |
| `GET /api/admin/revenue` | Revenue by date range |
| `GET /api/admin/top-merchants` | Top merchants |
| `GET /api/admin/user-tiers` | Tier distribution |
| `GET /api/admin/audit-log` | Admin action log |
| `GET /api/admin/export/revenue` | CSV revenue download |

### Web Ordering Routes (`/api/web-ordering/`)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/web-ordering/menu/:storeSlug` | Full menu + store info |
| `POST /api/web-ordering/orders` | Place order (web checkout) |
| `GET /api/web-ordering/orders/:orderNumber` | Order status |
| `POST /api/web-ordering/auth/send-otp` | Send OTP (web) |
| `POST /api/web-ordering/auth/verify-otp` | Verify OTP (web) |
| `GET /api/web-ordering/coins/balance` | REZ Coin balance |

### Ops Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/admin` | BullBoard queue dashboard (auth required) |
| `/health` | Full health check (DB, Redis, uptime, memory) |
| `/health/ready` | Readiness probe |
| `/metrics` | Prometheus metrics (plain text) |
| `GET /` | `{ status: 'ok' }` |

---

## 12. Authentication Flow

### Consumer (Phone OTP)

```
1. POST /api/user/auth/send-otp   { phone }
   → Rate limited: 3 attempts per 10 min (strictLimiter)
   → Twilio sends 6-digit SMS OTP

2. POST /api/user/auth/verify-otp  { phone, otp }
   ← { accessToken, refreshToken, user }

3. All requests: Authorization: Bearer <accessToken>

4. POST /api/user/auth/refresh-token  { refreshToken }
   ← { accessToken }
   → Old refresh token blacklisted in Redis (rotation)
```

Access token: short-lived (15–60 min).
Refresh token: 30 days, stored in MongoDB + Redis blacklist on rotation.

### Merchant (Email + Password)

```
1. POST /api/merchant/auth/login  { email, password }
   ← { merchantToken, merchant }

2. All merchant requests: Authorization: Bearer <merchantToken>
```

Signed with `JWT_MERCHANT_SECRET` — a consumer token is rejected by merchant endpoints.

### Web Menu (Phone OTP — cookie-based)

```
1. POST /api/web-ordering/auth/send-otp  { phone }
2. POST /api/web-ordering/auth/verify-otp  { phone, otp }
   ← Sets httpOnly cookie: rez_access_token
   → All subsequent requests send cookie automatically (withCredentials: true)
```

### Middleware

| Middleware | Validates | Attaches |
|-----------|-----------|---------|
| `authTokenMiddleware` | Consumer JWT | `req.user` |
| `merchantAuthMiddleware` | Merchant JWT | `req.merchant` |
| `requireAdminMiddleware` | `req.user.role === 'admin'` | — |
| `webOrderingAuthMiddleware` | httpOnly cookie | `req.webUser` |

---

## 13. Payment Flow

### Consumer Checkout

```
1. App creates order: POST /api/orders
   ← { orderId, amount }

2. App calls: POST /api/wallet/razorpay/create-order
   ← { razorpayOrderId, amount, currency }

3. Razorpay SDK opens payment sheet in app

4. On success, Razorpay calls webhook: POST /api/webhook/razorpay
   → Backend verifies HMAC signature
   → Marks order paid, credits cashback (coin/wallet)

5. App confirms: POST /api/orders/:id/confirm
```

**Live mode detection:** `RAZORPAY_KEY_ID.startsWith('rzp_live_')` — automatic. Never hardcode.

### REZ Wallet (REZ Cash)

Internal virtual currency. 1 REZ Cash = ₹1.
- Top up via Razorpay
- Use at checkout for partial/full payment
- Cashback credited as REZ Cash
- Balance in `rez-wallet-service`

### Web Menu Checkout

Same flow but cookie-authenticated. Razorpay payment sheet opens in mobile browser. Webhook handling is identical.

---

## 14. REZ Coin & Loyalty Economy

### Coin Basics

- **Earn:** Coins credited on purchase (rate: `DEFAULT_CASHBACK_RATE` env var, e.g. `0.02` = 2%)
- **Redeem:** 1 coin = ₹1 at checkout (capped at 50% of order value)
- **Expiry:** Coins expire 365 days after earning. 7-day warning notifications sent by `coinExpiry` cron job (runs at 1 AM)

### User Tiers

| Tier | Threshold (coins earned lifetime) | Coin multiplier |
|------|----------------------------------|-----------------|
| Bronze | 0+ | 1× |
| Silver | 500+ | 1.25× |
| Gold | 2000+ | 1.5× |
| Platinum | 5000+ | 2× |

REZ Premium subscribers get an additional `coinMultiplier` from their `UserSubscription`.

### Check-in Streaks

- Users earn bonus coins for consecutive daily check-ins at stores
- Streak logic: `dayDiff = floor((today - lastCheckin) / 86400000)`
  - `dayDiff === 1` → streak continues
  - `dayDiff > 1` → streak resets to 1
  - `dayDiff === 0` → already checked in today, no change
- Stored in `UserStreak` model

### Fraud Detection

Coin velocity z-score check (runs daily via node-cron in `src/jobs/fraudDetection.ts`):
- Calculates mean + stddev of coins earned per user in last 24h
- Users with z-score > 3 are flagged in `user.fraudFlags.coinVelocity`
- Admins review in the fraud queue screen

### Group Buy

- Creator sets `targetAmountPaise` and `expiresAt`
- Members join via 6-char `inviteCode`
- On confirm: coins distributed proportionally to all members
- Status: `open` → `confirmed` → `expired`

---

## 15. Real-Time Features (Socket.IO)

Backend runs Socket.IO on the same HTTP server. Rooms isolate events per entity.

| Event | Direction | Room | Purpose |
|-------|-----------|------|---------|
| `orderUpdate` | Server → Client | `order:{orderId}` | Order status changed |
| `newOrder` | Server → Merchant | `merchant:{merchantId}` | New order received |
| `dineInUpdate` | Server → Client | `user:{userId}` | Table status update |
| `notification` | Server → Client | `user:{userId}` | Live push notification |

Setup: `src/config/socketSetup.ts`

Socket timeout: 15000ms. Do not reduce — false disconnects on slow mobile.

### SSE (Order Streaming)

`rez-order-service` exposes `GET /orders/stream`:
- Polls MongoDB every 3s for pending orders
- Heartbeat every 15s (`data: heartbeat\n\n`)
- Used by merchant app live orders screen

---

## 16. Background Jobs (BullMQ)

### Monolith Workers (`src/worker.ts`)

| Queue | Jobs |
|-------|-----|
| `emailQueue` | SendGrid transactional emails |
| `smsQueue` | Twilio SMS |
| `notificationQueue` | Firebase push notifications |
| `orderQueue` | Post-order: cashback, rewards |
| `analyticsQueue` | Analytics event ingestion |
| `reportQueue` | Merchant report generation |

**Run separately:** `npm run start:worker`

**BullBoard UI:** `GET /admin` (admin auth required)

### Gamification Service Workers (`rez-gamification-service`)

| Worker | Purpose |
|--------|---------|
| Achievement worker | Process achievement unlock events |
| Streak worker | Update check-in streaks |
| Leaderboard worker | Compute leaderboard rankings |

Prometheus metrics on `/metrics`: `gamification_jobs_processed_total`, `gamification_jobs_failed_total`, `gamification_job_duration_seconds`.

### Notification Service Workers (`rez-notification-events`)

- **Exponential backoff:** 5 attempts, 2s base, on failure
- **Rate limiter:** max 10 notifications/second
- **Dead Letter Queue (DLQ):** failed jobs after all retries → `dlqWorker.ts` → logs to `dlq_log` MongoDB collection

### Marketing Service Workers (`rez-marketing-service`)

- Segment fanout: resolves user IDs, enqueues `push_notification` jobs in batches
- Rate limit: 1 broadcast per merchant per hour

### Cron Jobs (Monolith)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `fraudDetection` | Daily | Coin velocity z-score check |
| `coinExpiry` | 1 AM daily | 7-day warning + bulk expire expired coins |
| `ensureIndexes` | Startup | Create/verify compound DB indexes |

---

## 17. Infrastructure & Services

| Service | Provider | Purpose |
|---------|---------|---------|
| All backend hosting | Render.com | Node.js web services (auto-deploy on push to main) |
| API Gateway | Render.com (Docker) | nginx container |
| Database | MongoDB Atlas | Primary data store |
| Cache + Queues | Upstash Redis | Rate limiting, sessions, BullMQ |
| Image storage | Cloudinary | Product/store/logo images |
| SMS / OTP | Twilio | Phone number verification |
| Email | SendGrid | Transactional emails |
| Payments | Razorpay | INR payments + webhooks |
| Payments (intl) | Stripe | International cards (future) |
| Push notifications | Firebase (FCM) | Mobile push + web push |
| Error tracking | Sentry | Exception monitoring (order/catalog/analytics services) |
| Mobile builds | EAS (Expo) | iOS + Android EAS Build |
| Metrics scraping | Prometheus | Wallet + gamification `/metrics` endpoints |

### Render Deployment

Each service has a `render.yaml` in its repo root. Key services:

| Render service name | Repo | Type |
|--------------------|------|------|
| `rez-api-gateway` | `rez-api-gateway` | Docker web |
| `rez-backend-8dfu` | `rezbackend` | Node web |
| `rez-order-service` | `rez-order-service` | Node web |
| `rez-catalog-service` | `rez-catalog-service` | Node web |
| `rez-gamification-service` | `rez-gamification-service` | Node web |
| `rez-wallet-service` | `rez-wallet-service` | Node web |
| `rez-auth-service` | `rez-auth-service` | Node web |
| `rez-marketing-service` | `rez-marketing-service` | Node web |

---

## 18. Environment Variables

### Backend (`rezbackend`) — Required

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `REDIS_URL` | Upstash Redis URL |
| `JWT_SECRET` | Consumer access token signing key |
| `JWT_REFRESH_SECRET` | Consumer refresh token signing key |
| `JWT_MERCHANT_SECRET` | Merchant token signing key |
| `FRONTEND_URL` | Consumer app URL (CORS) |
| `NODE_ENV` | `production` or `development` |

### Backend — Recommended

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio — OTP SMS |
| `TWILIO_AUTH_TOKEN` | Twilio auth |
| `TWILIO_PHONE_NUMBER` | Sender number |
| `SENDGRID_API_KEY` | Email delivery |
| `RAZORPAY_KEY_ID` | Payment gateway (test: `rzp_test_*`, live: `rzp_live_*`) |
| `RAZORPAY_KEY_SECRET` | Payment gateway secret |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC verification |
| `CLOUDINARY_CLOUD_NAME` | Image uploads |
| `CLOUDINARY_API_KEY` | Cloudinary auth |
| `CLOUDINARY_API_SECRET` | Cloudinary auth |
| `SENTRY_DSN` | Error tracking |
| `MERCHANT_FRONTEND_URL` | Merchant app URL (CORS) |
| `SMS_TEST_MODE` | `true` = log OTP to console, skip Twilio |
| `ENABLE_CRON` | `true` = run cron jobs on this dyno |
| `DEFAULT_CASHBACK_RATE` | Default cashback %, e.g. `0.02` |
| `INTERNAL_SERVICE_TOKEN` | Shared secret for inter-service calls |
| `CATALOG_SERVICE_URL` | rez-catalog-service base URL |
| `MARKETING_SERVICE_URL` | rez-marketing-service base URL |

### API Gateway (`rez-api-gateway`)

| Variable | Value |
|----------|-------|
| `BACKEND_URL` | `https://api.rezapp.com` |
| `GAMIFICATION_SERVICE_URL` | Gamification service URL |
| `WALLET_SERVICE_URL` | Wallet service URL |
| `PAYMENT_SERVICE_URL` | Payment service URL |
| `CATALOG_SERVICE_URL` | Catalog service URL |
| `ORDER_SERVICE_URL` | Order service URL |
| `ANALYTICS_SERVICE_URL` | Analytics service URL |
| `SEARCH_SERVICE_URL` | Search service URL |
| `MARKETING_SERVICE_URL` | Marketing service URL |
| `MEDIA_SERVICE_URL` | Media service URL |
| `AUTH_SERVICE_URL` | Auth service URL |
| `NOTIFICATION_SERVICE_URL` | Notification service URL |
| `MERCHANT_SERVICE_URL` | Merchant service URL |

### Consumer App (Expo `EXPO_PUBLIC_*`)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_PROD_API_URL` | Backend API base URL |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | Razorpay public key for checkout |
| `EXPO_PUBLIC_IOS_APP_STORE_URL` | App Store listing URL |
| `EXPO_PUBLIC_PLAY_STORE_URL` | Play Store listing URL |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN |

### Merchant App (Expo `EXPO_PUBLIC_*`)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend API base URL |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | Razorpay public key |
| `EXPO_PUBLIC_IOS_APP_STORE_URL` | App Store listing URL |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN |

### Web Menu (Vite)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL (required in production) |

> Use `.env.dev` templates in each repo. Never use production secrets locally.

---

## 19. Local Dev Setup

### Backend

```bash
cd rezbackend/rez-backend-master
cp .env.dev .env           # fill in dev credentials
npm install
npm run dev                # nodemon + ts-node, hot reload on :5000
# Second terminal:
npm run start:worker       # BullMQ worker process
```

**Requires:** Node.js 18+, MongoDB Atlas URI, Upstash Redis URL.

**With Docker (local Mongo + Redis):**
```bash
docker-compose up          # starts MongoDB + Redis
npm run dev
```

**Load testing:**
```bash
npm run load-test          # scripts/loadTest.ts — 50 concurrent, 30s, p50/p95/p99
```

### Consumer App

```bash
cd rezapp/rez-master
cp .env.dev .env.local
npm install
npx expo start             # Expo Dev Server
# 'a' → Android emulator, 'i' → iOS simulator, scan QR for device
```

Point `EXPO_PUBLIC_PROD_API_URL` to local backend: `http://192.168.x.x:5000/api`

### Merchant App

```bash
cd rezmerchant/rez-merchant-master
cp .env.dev .env.local
npm install
npx expo start
```

### Admin App

```bash
cd rezadmin/rez-admin-main
npm install
npx expo start --web       # Opens browser at localhost:8081
```

### Web Menu

```bash
cd rez-web-menu
cp .env.dev .env.local
# Set VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                # Vite dev server at localhost:3100
```

Proxy: `vite.config.ts` proxies `/api` → `http://localhost:5001` in dev.

### Running a Microservice

```bash
cd rez-order-service
npm install
NODE_ENV=development MONGODB_URI=... REDIS_URL=... npm run dev
```

Each service reads its own env vars. They share the same MongoDB + Redis as the monolith.

---

## 20. Build & Deploy

### Backend

```bash
npm run build              # TypeScript → dist/
npm start                  # runs dist/server.js
```

Deployed on Render. Push to `main` → auto-deploy.

### Mobile Apps (EAS)

```bash
npm install -g eas-cli
eas login

# Android APK (internal testing)
eas build --platform android --profile preview

# iOS TestFlight
eas build --platform ios --profile preview

# Production (App Store / Play Store)
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

**EAS profiles** (`eas.json`):

| Profile | Bundle ID | Purpose |
|---------|-----------|---------|
| `development` | dev bundle | Dev client, local API |
| `preview` | preview bundle | Internal APK/IPA |
| `production` | `money.rez.app` | App Store / Play Store |

### Web Menu

```bash
npm run build              # tsc + vite build → dist/
# dist/404.html is a copy of index.html for SPA fallback
```

Deployed on Render as a static site. `_redirects` file handles SPA routing.

### API Gateway

```bash
# Build Docker image
docker build -t rez-api-gateway .

# Local test (needs all SERVICE_URL env vars)
docker run -p 80:80 --env-file .env rez-api-gateway
```

---

## 21. Testing

### Running Tests

```bash
# Backend
cd rezbackend/rez-backend-master
npm test                   # Jest integration tests

# Consumer App
cd rezapp/rez-master
npm test                   # Jest + @testing-library/react-native

# Merchant App
cd rezmerchant/rez-merchant-master
npm test

# Admin App
cd rezadmin/rez-admin-main
npm test                   # 78 service-layer tests

# Web Menu
cd rez-web-menu
npm test                   # Vitest
npm run test:coverage      # Coverage report
```

### Test Structure

**Backend integration tests** (`src/__tests__/integration/`):
- `coinTransaction.test.ts` — coin earn/spend/expiry logic
- `groupBuy.test.ts` — group buy flow + coin distribution
- `webhook.test.ts` — Razorpay HMAC signature verification

**Consumer App** (`__tests__/integration/`):
- `authFlow.test.ts` — OTP + token refresh
- `coinsFlow.test.ts` — earn + redeem
- `savingsFlow.test.ts` — savings insights

**Merchant App** (`__tests__/integration/`):
- `orderFlow.test.ts`
- `analyticsFlow.test.ts`
- `payoutFlow.test.ts`

### Testing Patterns

**Backend:** Uses real MongoDB (test DB) and Redis. No mocking of DB — integration tests catch schema/query issues.

**Mobile:** `@testing-library/react-native`. Mock API calls with `jest.mock()`. Context providers wrapped in test utilities.

**Web Menu:** Vitest + jsdom. Components tested with `@testing-library/react`.

### TypeScript Check

Always run before committing:
```bash
npx tsc --noEmit           # zero errors required
```

---

## 22. Git Workflow

### Branch Strategy

```
main          ← production-ready, auto-deploys to Render
feature/xxx   ← feature branches, PRed to main
fix/xxx       ← bug fix branches
```

### Commit Message Convention

```
feat(scope): short description     ← new feature
fix(scope): short description      ← bug fix
chore(scope): short description    ← dependency/config
perf(scope): short description     ← performance improvement
refactor(scope): short description ← code cleanup
```

**Scope examples:** `backend`, `consumer`, `merchant`, `admin`, `web-menu`, `infra`

### PR Process

1. Branch from `main`
2. `npx tsc --noEmit` passes
3. `npm test` passes
4. PR title matches commit convention
5. Squash merge to `main`

---

## 23. Common Patterns & Conventions

### TypeScript

- Strict mode enabled everywhere
- All public API functions must have typed parameters and return types
- Mongoose models use `I<ModelName>` interface + `strict: false` for shared collections

### Error Handling (Backend)

```typescript
// Always use asyncHandler — never raw try/catch in routes
import { asyncHandler } from '../utils/asyncHandler';

router.get('/path', requireAuth, asyncHandler(async (req, res) => {
  const result = await someService.doThing();
  return res.json({ success: true, data: result });
  // asyncHandler catches throws → 500 with { success: false, message: 'Internal server error' }
}));
```

Never send raw error objects or stack traces to clients.

### Logging

```typescript
import { logger } from '../config/logger';
logger.info('Something happened', { userId, action });
logger.error('Something failed', { error, context });
```

In React Native: wrap dev logs in `if (__DEV__)`.

### Fire-and-Forget Async (Non-Critical)

```typescript
// Don't await non-critical operations in the request path
someService.sendNotification(userId, data).catch(() => {});
```

### A/B Feature Flags

djb2 hash of userId → cohort assignment. No external service needed:
```typescript
const hash = djb2(userId);
const cohort = hash % 100; // 0-99
const inExperiment = cohort < 50; // 50% in treatment
```

### Rate Limiting (Merchant Writes)

Per-merchant nginx rate limit keyed by `Authorization` header — 30 req/min. Configured in `rez-api-gateway/nginx.conf`.

### Cursor Pagination

Transaction history uses cursor-based pagination (not page numbers):
```
GET /api/transaction-history?cursor=<lastId>&limit=20
← { items: [...], nextCursor: '<id>' | null }
```

### Image Placeholders

Use `placehold.co` — `via.placeholder.com` is dead.
```
https://placehold.co/400x300/png
```

### Status Bar (Mobile)

```tsx
import { StatusBar } from 'expo-status-bar';
// Dark screens (navy bg): style="light"  (white icons)
// Light screens: style="dark"  (dark icons)
```

---

## 24. Known Gotchas

| Issue | Detail |
|-------|--------|
| **Android 15 edge-to-edge** | `edgeToEdgeEnabled: true` required in `app.config.js` when `newArchEnabled: true`. Already set. |
| **Android permissions** | Use `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`. `READ_EXTERNAL_STORAGE` deprecated Android 13+. |
| **Firebase App ID** | EAS needs native Android App ID (`1:...:android:...`), NOT the web App ID (`1:...:web:...`). |
| **Razorpay live keys** | `rzp_test_*` in dev. Production MUST use `rzp_live_*`. Auto-detected via key prefix — no code change needed. |
| **OTP bypass** | `NODE_ENV=development` enables OTP bypass in `authController`. Always set `NODE_ENV=production` on Render. |
| **Redis required** | `REDIS_URL` required in ALL environments. Rate limiting + session locking depend on it. |
| **JWT default secrets** | Server exits on startup if `JWT_SECRET` equals the placeholder string. Use real secrets. |
| **Node heap** | Start script uses `--max-old-space-size=4096`. Never reduce below 1024 or worker OOMs. |
| **Worker process** | `src/worker.ts` must run separately from `src/server.ts`. Jobs pile up if worker is down. |
| **Socket timeout** | Both apps use 15000ms. Shorter values cause false disconnects on slow mobile. |
| **EAS Apple credentials** | `eas.json` uses `${EXPO_APPLE_ID}` env var syntax — set as EAS secrets, not hardcoded. |
| **`via.placeholder.com`** | Dead domain. Use `placehold.co` everywhere. |
| **Merchant token ≠ consumer token** | Two separate JWT secrets. Cross-token use is rejected by middleware. |
| **`SMS_TEST_MODE=true`** | In dev, OTPs log to console instead of Twilio. Set `false` in production. |
| **Firebase service account** | Never commit `firebase-service-account.json`. Inject via secret manager or mounted volume. |
| **Mongoose `strict: false`** | Microservice models that share MongoDB collections with the monolith use `strict: false` to avoid stripping fields written by the other service. |
| **INTERNAL_SERVICE_TOKEN** | All inter-service HTTP calls must include this token. Missing it = 401 from the receiving service. |
| **nginx envsubst** | The API gateway `start.sh` must include ALL `$SERVICE_URL` variables in the `envsubst` call. Missing one = nginx startup error: "unknown variable". |
| **Web menu bundle ID** | Consumer and merchant share `money.rez.app` bundle prefix. Admin is a web-only app with no native bundle. |
| **CartFAB and BottomNav** | CartFAB must always be rendered with `aboveNav` (or `aboveNav !== false`) to sit above BottomNav. Default is now true. |
