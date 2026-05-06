# REZ Ecosystem — Full Architecture & Interconnection Guide

> Last updated: 2026-04-10  
> Covers: REZ Platform · Hotel OTA · Hotel PMS · AdBazaar · API Gateway · All Microservices · Resturistan · Rendez
>
> For precise developer-facing maps, see the MASTER_* docs in this directory:
> - [MASTER_API_MAP.md](MASTER_API_MAP.md) — every endpoint with method, path, auth, handler
> - [MASTER_SCREEN_MAP.md](MASTER_SCREEN_MAP.md) — every screen in every app
> - [MASTER_SERVICE_DEPENDENCY_MAP.md](MASTER_SERVICE_DEPENDENCY_MAP.md) — service call graph + BullMQ flows
> - [MASTER_ENV_VARS_MAP.md](MASTER_ENV_VARS_MAP.md) — all environment variables
> - [MASTER_ISSUE_TRACKER.md](MASTER_ISSUE_TRACKER.md) — consolidated bug registry (REZ-001…)

---

## 1. System Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND / CLIENTS                                  │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │  REZ Consumer│  │ REZ Merchant │  │  Hotel OTA   │  │  Hotel PMS      │ │
│  │  App         │  │  App         │  │  Web (Next)  │  │  Frontend (Vite)│ │
│  │ (rez-master│  │(rez-merchant │  │  + Mobile    │  │  hotel-mgmt-    │ │
│  │  React Native│  │ React Native)│  │  (React Nav) │  │  master/frontend│ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
└─────────┼─────────────────┼─────────────────┼───────────────────┼──────────┘
          │                 │                 │                   │
          ▼                 ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND SERVICES                                    │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ REZ Auth     │  │ REZ Wallet   │  │  Hotel OTA   │  │  Hotel PMS      │ │
│  │ Service      │  │  Service     │  │  API         │  │  Backend        │ │
│  │(rez-auth-    │  │(rez-wallet-  │  │(apps/api     │  │(hotel-mgmt-     │ │
│  │ service)     │  │ service)     │  │ PostgreSQL)  │  │ master/backend  │ │
│  │  MongoDB     │  │  MongoDB     │  │  + Redis     │  │  MongoDB+Redis) │ │
│  │  Redis       │  │  Redis       │  │              │  │                 │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ REZ Order    │  │ REZ Merchant │  │ REZ Search   │  │ REZ Finance     │ │
│  │  Service     │  │  Service     │  │  Service     │  │  Service        │ │
│  │  MongoDB     │  │  MongoDB     │  │  MongoDB     │  │  MongoDB+Redis  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
│                                                        + 5 more services    │
└─────────────────────────────────────────────────────────────────────────────┘
          │                 │                 │                   │
          └─────────────────┴────────┬────────┴───────────────────┘
                                     ▼
                           ┌──────────────────┐
                           │  Internal Auth   │
                           │  Scoped Service  │
                           │  Tokens (HMAC)   │
                           └──────────────────┘
```

---

## 2. Service Directory

### REZ Core Platform

| Service | Repo | DB | Render URL | Status |
|---------|------|----|-----------|--------|
| **REZ Backend (Monolith)** | `imrejaul007/rez-backend` | MongoDB | `https://api.rezapp.com/api` | ✅ Live |
| **API Gateway** | `imrejaul007/rez-api-gateway` | — (nginx) | `https://rez-api-gateway.onrender.com` | ✅ Live |
| **rez-auth-service** | `imrejaul007/rez-auth-service` | MongoDB + Redis | `https://rez-auth-service.onrender.com` | ✅ Live |
| **rez-wallet-service** | `imrejaul007/rez-wallet-service` | MongoDB + Redis | `https://rez-wallet-service-36vo.onrender.com` | ✅ Live |
| **rez-payment-service** | `imrejaul007/rez-payment-service` | MongoDB | `https://rez-payment-service.onrender.com` | ✅ Live |
| **rez-gamification-service** | `imrejaul007/rez-gamification-service` | MongoDB | `https://rez-gamification-service-3b5d.onrender.com` | ✅ Live |
| **rez-merchant-service** | `imrejaul007/rez-merchant-service` | MongoDB | `https://rez-merchant-service-n3q2.onrender.com` | ✅ Live |
| **rez-catalog-service** | `imrejaul007/rez-catalog-service` | MongoDB | `https://rez-catalog-service-1.onrender.com` | ✅ Live |
| **rez-search-service** | `imrejaul007/rez-search-service` | MongoDB | `https://rez-search-service.onrender.com` | ✅ Live |
| **rez-marketing-service** | `imrejaul007/rez-marketing-service` | MongoDB | `https://rez-marketing-service.onrender.com` | ✅ Live |
| **analytics-events** | `imrejaul007/analytics-events` | MongoDB | `https://analytics-events-37yy.onrender.com` | ✅ Live |
| **rez-finance-service** | `imrejaul007/rez-finance-service` | MongoDB + Redis | `https://rez-finance-service.onrender.com` | ✅ Live |
| **rez-order-service** | `imrejaul007/rez-order-service` | MongoDB | Not on Render yet (port 4005) | ⚠️ HTTP built, deploy pending |
| **rez-ads-service** | `imrejaul007/rez-ads-service` | MongoDB | Not deployed (port 4007) | ⚠️ Built, deploy pending |
| **rez-notification-events** | `imrejaul007/rez-notification-events` | MongoDB | Health only on port 3001 | ✅ Worker live |
| **rez-media-events** | `imrejaul007/rez-media-events` | MongoDB | BullMQ worker + HTTP upload | ✅ Worker live |

### Hotel Vertical

| Service | Repo | DB | Render URL | Status |
|---------|------|----|-----------|--------|
| **Hotel OTA API** | `imrejaul007/hotel-ota` (apps/api) | PostgreSQL + Redis | `https://hotel-ota-api.onrender.com` | ✅ Live |
| **Hotel PMS Backend** | hotel-ota/hotel-pms submodule | MongoDB + Redis | `https://hotel-management-xcsx.onrender.com` | ✅ Live |
| **StayOwn (OTA Frontend)** | hotel-ota/apps/ota-web | — | `https://hotel-ota-ota-web-five.vercel.app` | ✅ Live |
| **OTA Admin** | hotel-ota/apps/admin | — | `https://hotel-ota-admin.vercel.app` | ✅ Live |
| **Hotel PMS Frontend** | hotel-pms/frontend | — | `https://rez-hotel-pms.onrender.com` | ✅ Live |

### AdBazaar

| Service | Repo | DB | URL | Status |
|---------|------|----|-----|--------|
| **AdBazaar** | `imrejaul007/adBazaar` | Supabase Postgres | `https://ad-bazaar.vercel.app` | ✅ Live |

### Mobile Apps

| App | Repo | Platform | Notes |
|-----|------|----------|-------|
| **REZ Consumer App** | `imrejaul007/rez-app-consumer` (nuqta-master) | Expo EAS | iOS + Android |
| **REZ Merchant App** | `imrejaul007/rez-app-marchant` | Expo EAS + Vercel | Mobile + web |
| **REZ Admin App** | `imrejaul007/rez-app-admin` | Expo EAS + Vercel | Mobile + web |
| **REZ Web Menu** | `imrejaul007/rez-web-menu` | Next.js / Vercel | `https://menu.rez.money` |

---

## 3. Authentication Architecture

### 3.1 REZ SSO → Hotel OTA (Users)

A REZ consumer logs into Hotel OTA without creating a new account.

```
REZ App → POST /v1/auth/rez-sso  { rez_access_token }
              │
              ├─1─▶ REZ Auth: GET /auth/validate (Bearer token)
              │         confirms signature + Redis blacklist
              │         returns { valid, userId }
              │
              ├─2─▶ REZ Auth: GET /internal/auth/user/:userId (x-internal-token)
              │         returns { phone, name, role }
              │
              ├─3─▶ OTA PostgreSQL: findOrCreate User by phone (10-digit normalized)
              │         links rezUserId, sets attributionSource='rez_app'
              │
              ├─4─▶ REZ Wallet: GET /internal/balance/:rezUserId
              │         syncs rezCoinBalancePaise into OTA DB
              │
              └─5─▶ Returns OTA JWT { userId, phone, tier }
                        + { access_token, refresh_token, user }
```

**File:** `Hotel OTA/apps/api/src/services/rez-integration.service.ts`  
**Route:** `Hotel OTA/apps/api/src/routes/auth.routes.ts` → `POST /v1/auth/rez-sso`

### 3.2 REZ SSO → Hotel PMS (Staff/Guests)

Same 2-step flow for PMS staff logging in with REZ credentials.

```
PMS Login → rezOtaConnector.verifyRezTokenForPms(rezAccessToken)
              │
              ├─1─▶ REZ Auth: GET /auth/validate
              └─2─▶ REZ Auth: GET /internal/auth/user/:userId
                        returns { rezUserId, phone, name, role }
```

**File:** `hotel-pms/hotel-management-master/backend/src/services/rezOtaConnector.js`

### 3.3 Token Security

```
Secret / Header              Used By                        Verified By
────────────────────────────────────────────────────────────────────────────────
JWT_SECRET                   REZ Auth (issues tokens)       REZ Auth /auth/validate
INTERNAL_SERVICE_TOKENS_JSON Core REZ service callers       Scoped token resolver
x-internal-service           Core REZ service callers       Service identity selector
PMS_WEBHOOK_SECRET           Hotel OTA (signs webhooks)     Hotel PMS (verifies HMAC)
REZ_OTA_INTERNAL_TOKEN       Hotel PMS                      Hotel OTA /v1/partner/pms/*
```

All server-to-server calls use either:
- `x-internal-service` + `x-internal-token` (core REZ scoped service auth)
- `x-webhook-signature` HMAC-SHA256 on JSON body

---

## 3.4 Finance Service — Internal Auth Surface

`rez-finance-service` follows the same two-layer pattern (`x-internal-token` + `x-internal-service`). Partner-facing webhook routes use a separate per-partner HMAC secret.

```
Secret                           Used By                  Verified By
────────────────────────────────────────────────────────────────────────
INTERNAL_SERVICE_TOKENS_JSON     Scoped callers           resolveExpectedInternalToken()
PARTNER_WEBHOOK_SECRET_FINBOX    FinBox (signs body)      verifyPartnerSignature() HMAC-SHA256
```

Finance routes access other services as:
- `GET /internal/balance/:userId` → `rez-wallet-service` (coin balance)
- `GET /internal/orders/summary/:userId` → `rez-order-service` (order history)
- `POST /internal/credit` → `rez-wallet-service` (coin award)

---

## 4. Wallet & Coin Architecture

### 4.0 REZ Coin Taxonomy

| Coin Type | Where | Used For |
|-----------|-------|---------|
| `nuqta` | rez-wallet-service (MongoDB) | Primary consumer coins earned via visits, orders, referrals |
| `rez` | Legacy alias → maps to `nuqta` | Old API callers, still accepted |
| `prive` | rez-wallet-service | Premium tier coins |
| `branded` | rez-wallet-service | Brand-specific coins from merchant campaigns |
| `promo` | rez-wallet-service | Promotional/campaign coins |
| `ota` (OTA Travel Coins) | Hotel OTA PostgreSQL CoinWallet | Hotel platform coins |
| `hotel_brand` | Hotel OTA HotelBrandCoinBalance | Per-hotel loyalty coins |

**Conversion:** 1 nuqta coin = ₹0.50 (configurable via `REZ_COIN_TO_RUPEE_RATE`)  
**OTA rate:** 1 REZ coin = ₹0.50 (configurable via `REZ_COIN_TO_RUPEE_RATE` in OTA env)

### 4.0b REZ Score (Credit Intelligence)

REZ Score is calculated in `rez-wallet-service` (CreditScoreCalculator) and exposed via `rez-finance-service`:
- Inputs: order history (30d spend), wallet balance, transaction frequency, cashback behavior
- Range: 0–850 (credit bureau style)
- Used by `rez-finance-service` to determine BNPL eligibility and pre-approved loan offers
- Checking score daily earns coins (gamified credit health)

### 4.1 Three-Level Coin System (Hotel Vertical)

```
┌─────────────────────────────────────────────────────────────┐
│                     USER WALLET                              │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │   OTA Coins      │  │   REZ Coins      │                 │
│  │  (platform-wide) │  │ (synced from REZ │                 │
│  │  PostgreSQL flat │  │  wallet service) │                 │
│  │  column          │  │  PostgreSQL flat │                 │
│  │  CoinWallet      │  │  column          │                 │
│  └──────────────────┘  └──────────────────┘                 │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │   Hotel Brand Coins  (1 entry per hotel)               │  │
│  │   HotelBrandCoinBalance { userId, hotelId, balance }   │  │
│  │   Junction table — N hotels × M users                  │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 REZ Coin Sync

```
At SSO login:        OTA syncs REZ wallet balance (blocking)
On GET /v1/wallet:   OTA fires background sync (fire-and-forget, cached result shown)
On GET /v1/user/profile: fire-and-forget background sync
Explicit:            POST /v1/user/rez-sync (user triggers manual sync)
REZ push:            POST /v1/partner/rez/wallet/sync (REZ server pushes balance)
```

**Conversion:** `rezCoinBalancePaise = Math.round(balance.available × REZ_COIN_TO_RUPEE_RATE × 100)`  
Default rate: `0.50` (1 REZ coin = ₹0.50)

### 4.3 Hotel Brand Coin Lifecycle

```
Hotel Admin (OTA)   → PATCH /v1/admin/hotels/:id/brand-coin  { enabled: true }
Hotel Staff (Panel) → PUT /v1/hotel/brand-coin/program  { earn_pct, max_burn_pct }

Guest books hotel   → hold()   → CoinService.checkBurn() applies brand cap
Guest pays          → confirm() → CoinService.earnCoins(hotel_brand) on confirmation
Guest cancels       → cancel() → CoinService.reverseBurn() returns brand coins

PMS guest checkout  → POST /v1/partner/pms/coins/earn
                          → CoinService.earnCoins(hotel_brand) 
```

### 4.4 Burn Waterfall (checkBurn)

```
Total discount cap: 40% of booking value

Step 1: OTA Coins   (applied first, highest priority)
Step 2: REZ Coins   (applied second)
Step 3: Hotel Brand (applied last, reduced first if cap exceeded)

If total > 40% cap:
  → Reduce hotel_brand first
  → Then rez
  → OTA coins never reduced
```

---

## 5. Booking Flow — End to End

### 5.1 REZ Consumer App Booking

```
REZ App
  │
  ├─ SSO login → GET OTA JWT
  │
  ├─ Search: GET /v1/hotels/search (via partner API or direct)
  │
  ├─ Hold: POST /v1/partner/rez/bookings/hold
  │          ├─ Finds/creates OTA user by rezUserId
  │          ├─ Locks inventory (SELECT FOR UPDATE)
  │          ├─ checkBurn() validates coin discount
  │          ├─ Creates Razorpay order
  │          └─ Burns coins immediately (escrow)
  │
  ├─ Payment: Razorpay checkout in-app
  │
  ├─ Confirm: POST /v1/partner/rez/bookings/confirm
  │             ├─ Verifies Razorpay signature
  │             ├─ Earns OTA + Hotel Brand coins
  │             ├─ REZ coin earn → webhook to REZ
  │             ├─ Settlement entry created
  │             ├─ SMS notification sent
  │             └─ PMS webhook fired (booking_confirmed) ──▶ Hotel PMS
  │
  └─ Cancel: POST /v1/bookings/:id/cancel
               ├─ Releases inventory
               ├─ Reverses all coin burns (OTA + REZ + brand)
               ├─ Razorpay refund triggered
               └─ PMS webhook fired (booking_cancelled) ──▶ Hotel PMS
```

### 5.2 Hotel OTA Web / Mobile Booking

Same flow using user JWT (not partner API).  
Route: `POST /v1/bookings/hold` → `POST /v1/bookings/confirm`

### 5.3 PMS Receives OTA Booking

```
Hotel OTA confirms booking
  │
  └─ PmsWebhookService.notifyBookingConfirmed()
       │
       POST /api/v1/ota-webhooks/rez-ota
         { event: 'booking_confirmed', data: { bookingId, hotelId, ... } }
         │
         ├─ verifyOtaWebhookSignature (HMAC-SHA256)
         └─ rezOtaConnector.handleOtaBookingConfirmed()
              ├─ Finds PMS hotel via otaConnections.rezOta.hotelId
              ├─ Deduplicates by channelBookingId
              └─ Creates Booking in PMS MongoDB
                   { source: 'ota', channel: 'rez_ota', channelBookingId: ... }
```

---

## 6. PMS ↔ Hotel OTA Data Flows

```
Direction          Trigger                 Endpoint                     Auth
─────────────────────────────────────────────────────────────────────────────
OTA → PMS          Booking confirmed       POST /api/v1/ota-webhooks/    HMAC sig
                                           rez-ota
OTA → PMS          Booking cancelled       POST /api/v1/ota-webhooks/    HMAC sig
                                           rez-ota
PMS → OTA          Guest checkout          POST /v1/partner/pms/         x-internal
                   (earn brand coins)      coins/earn                    -token
PMS → OTA          Room avail/rate         PUT /v1/partner/pms/          x-internal
                   change                 inventory/:hotel/:room/:date   -token
PMS → OTA          REZ SSO verify          (internal call, no HTTP)      —
```

**Hotel linking:** Each PMS Hotel document must have:
```json
{
  "otaConnections": {
    "rezOta": {
      "hotelId": "<OTA hotel UUID>",
      "isEnabled": true
    }
  }
}
```

---

## 7. REZ Platform Internal Services

```
rez-auth-service
  ├─ POST /auth/otp/send         → send OTP (MSG91)
  ├─ POST /auth/otp/verify       → verify OTP, issue JWT + refresh token
  ├─ GET  /auth/validate         → verify JWT + Redis blacklist
  ├─ POST /auth/logout           → add token to Redis blacklist
  └─ GET  /internal/auth/user/:id → (internal) fetch user profile

rez-wallet-service
  ├─ GET  /wallet/balance        → user's own balance
  ├─ POST /wallet/credit         → credit coins (earn)
  ├─ POST /wallet/debit          → debit coins (burn)
  └─ GET  /internal/balance/:userId → (internal) fetch balance for OTA sync

rez-order-service
  └─ Manages food/product orders; hotel bookings are separate (Hotel OTA)

rez-merchant-service
  └─ Merchant onboarding, loyalty rules, settlement for REZ merchants

rez-payment-service
  └─ Razorpay integration for REZ platform payments
```

---

## 8. Earn & Burn Rules

Rules are stored in Hotel OTA's PostgreSQL and apply to all coin types:

```
EarnRule {
  coinType:    'ota' | 'rez' | 'hotel_brand'
  hotelId:     nullable (null = all hotels)
  channelSource: 'rez_app' | 'ota_web' | 'mobile' | 'all'
  userTier:    'bronze' | 'silver' | 'gold' | 'all'
  earnPct:     e.g. 5.0  (5% of booking value)
  validFrom/Until: date range
}

BurnRule {
  coinType:    'ota' | 'rez' | 'hotel_brand'
  hotelId:     nullable
  maxBurnPct:  e.g. 20.0  (max 20% of booking can be paid with coins)
  userTier:    ...
}
```

**Hotel brand rules always have `hotelId` set.**  
Admin sets them via `POST /v1/admin/earn-rules` or hotel staff via `PUT /v1/hotel/brand-coin/program`.

---

## 9. Environment Variables — Complete Reference

### Hotel OTA API (`Hotel OTA/.env`)

```env
# Database
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=
JWT_EXPIRY=3600
REFRESH_TOKEN_SECRET=
REFRESH_TOKEN_EXPIRY=2592000
ADMIN_JWT_SECRET=

# Payment
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Redis & SMS
REDIS_URL=redis://...
MSG91_API_KEY=
MSG91_SENDER_ID=

# REZ Integration
REZ_AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
REZ_WALLET_SERVICE_URL=https://rez-wallet-service-36vo.onrender.com
INTERNAL_SERVICE_TOKENS_JSON={"hotel-ota-api":"<token>"}
REZ_COIN_TO_RUPEE_RATE=0.50
REZ_API_KEY=<partner API key>
REZ_API_BASE_URL=
REZ_WEBHOOK_SECRET=

# Hotel PMS Integration
PMS_API_URL=https://hotel-management-xcsx.onrender.com
PMS_WEBHOOK_SECRET=<shared with PMS>
REZ_OTA_INTERNAL_TOKEN=<PMS uses this to call OTA>

# AWS S3
AWS_ACCESS_KEY=
AWS_SECRET_KEY=
AWS_S3_BUCKET=
AWS_REGION=ap-south-1

# Email
SENDGRID_API_KEY=
```

### Hotel PMS Backend (`hotel-pms/hotel-management-master/.env`)

```env
# Core
MONGO_URI=mongodb+srv://...
REDIS_URL=redis://...
PORT=4000
NODE_ENV=production
JWT_SECRET=
JWT_EXPIRES_IN=7d

# Payment
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RAZORPAY_KEY_ID=       # (if using Razorpay instead of Stripe)

# Email / VAPID
SMTP_HOST=smtp.gmail.com
SMTP_USER=
SMTP_PASS=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@hotel.com

# REZ OTA Integration (NEW)
REZ_OTA_API_URL=https://your-hotel-ota-api.onrender.com
REZ_OTA_INTERNAL_TOKEN=<same as REZ_OTA_INTERNAL_TOKEN in OTA>
REZ_OTA_WEBHOOK_SECRET=<same as PMS_WEBHOOK_SECRET in OTA>

# REZ Auth (for PMS SSO)
REZ_AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
INTERNAL_SERVICE_TOKENS_JSON={"hotel-pms-backend":"<token>"}

# Existing OTA channels
BOOKINGCOM_API_BASE=https://api.sandbox.booking.com
BOOKINGCOM_CLIENT_ID=
BOOKINGCOM_CLIENT_SECRET=
```

### REZ Auth Service (`rez-auth-service/.env`)

```env
MONGO_URI=
REDIS_URL=
JWT_SECRET=             # ← ALL services that verify REZ tokens need to call /auth/validate
JWT_EXPIRES_IN=7d
INTERNAL_SERVICE_TOKENS_JSON= # ← scoped map used for /internal/* auth resolution
MSG91_API_KEY=
```

### REZ Wallet Service (`rez-wallet-service/.env`)

```env
MONGO_URI=
REDIS_URL=
INTERNAL_SERVICE_TOKENS_JSON= # ← scoped map used by wallet internal auth
```

---

## 10. API Route Reference

### Hotel OTA Public / User Routes

```
POST /v1/auth/otp/send
POST /v1/auth/otp/verify
POST /v1/auth/refresh
POST /v1/auth/rez-sso            ← REZ SSO login

GET  /v1/hotels/search
GET  /v1/hotels/:id
GET  /v1/hotels/:id/rooms

POST /v1/bookings/hold
POST /v1/bookings/confirm
GET  /v1/bookings
GET  /v1/bookings/:id
POST /v1/bookings/:id/cancel

GET  /v1/wallet/
GET  /v1/wallet/transactions
POST /v1/wallet/check-burn       ← supports hotel_brand coins

GET  /v1/user/profile
POST /v1/user/rez-sync           ← manual REZ wallet sync
```

### Hotel OTA Partner Routes (API key auth)

```
GET  /v1/partner/rez/hotels/search
POST /v1/partner/rez/bookings/hold
POST /v1/partner/rez/bookings/confirm
GET  /v1/partner/rez/bookings/:id
POST /v1/partner/rez/wallet/sync
```

### Hotel OTA Internal Routes (x-internal-token auth — PMS only)

```
POST /v1/partner/pms/coins/earn           ← PMS checkout → earn brand coins
PUT  /v1/partner/pms/inventory/:h/:r/:d   ← PMS updates OTA inventory
```

### Hotel OTA Hotel Panel Routes (hotel staff JWT)

```
GET  /v1/hotel/dashboard
GET  /v1/hotel/bookings
GET  /v1/hotel/inventory
PUT  /v1/hotel/inventory/:roomTypeId/:date
POST /v1/hotel/bookings/:id/checkin
POST /v1/hotel/bookings/:id/checkout
GET  /v1/hotel/brand-coin/program
PUT  /v1/hotel/brand-coin/program
GET  /v1/hotel/brand-coin/members
GET  /v1/hotel/settlement
```

### Hotel OTA Admin Routes (admin JWT)

```
GET  /v1/admin/overview
GET  /v1/admin/users
GET  /v1/admin/hotels
PUT  /v1/admin/hotels/:id/status
PATCH /v1/admin/hotels/:id/brand-coin     ← enable/disable brand coin program
GET  /v1/admin/earn-rules
POST /v1/admin/earn-rules
PUT  /v1/admin/earn-rules/:id
GET  /v1/admin/burn-rules
POST /v1/admin/burn-rules
GET  /v1/admin/coin-liability
GET  /v1/admin/bookings
GET  /v1/admin/settlements
```

### Hotel PMS New Routes (added in integration)

```
POST /api/v1/ota-webhooks/rez-ota   ← receives OTA booking events (HMAC verified)
```

---

## 11. Data Model Relationships

```
PostgreSQL (Hotel OTA)
─────────────────────
User
  ├─ rezUserId → links to REZ user identity
  ├─ CoinWallet (1:1)
  │    ├─ otaCoinBalancePaise
  │    └─ rezCoinBalancePaise   ← synced from REZ wallet service
  ├─ HotelBrandCoinBalance[] (1:N, one per hotel)
  │    ├─ balancePaise
  │    ├─ lifetimeEarnedPaise
  │    └─ lifetimeBurnedPaise
  └─ Booking[]
       ├─ otaCoinBurnedPaise
       ├─ rezCoinBurnedPaise
       └─ hotelBrandCoinBurnedPaise

Hotel
  ├─ brandCoinEnabled: Boolean
  ├─ brandCoinName: String
  ├─ brandCoinSymbol: String
  ├─ HotelBrandCoinBalance[] (back-relation)
  └─ EarnRule[] / BurnRule[] (coinType='hotel_brand')

CoinTransaction
  ├─ coinType: 'ota' | 'rez' | 'hotel_brand'
  ├─ hotelId → nullable (set for hotel_brand)
  └─ bookingId → links to Booking

MongoDB (Hotel PMS)
───────────────────
Hotel
  └─ otaConnections.rezOta.hotelId → Hotel OTA hotel UUID

Booking
  ├─ source.channel: 'rez_ota'   ← OTA-originated bookings
  ├─ channelBookingId             ← OTA booking UUID (dedup key)
  └─ channelData.{otaCoinBurnedPaise, rezCoinBurnedPaise, hotelBrandCoinBurnedPaise}

MongoDB (REZ)
─────────────
User.phone → same 10-digit as OTA User.phone (normalized via normalizePhone())
Wallet.balance.available → converted to paise via REZ_COIN_TO_RUPEE_RATE
```

---

## 12. Deployment Topology

```
                          ┌─────────────────┐
                          │   Render.com    │
                          └────────┬────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────────┐   ┌────────────────────┐
│  rez-auth-      │    │   Hotel OTA API     │   │  Hotel PMS Backend │
│  service        │    │   (Node/TS)         │   │  (Node/ESM)        │
│  :5001          │    │   :3000             │   │  :4000             │
│  MongoDB+Redis  │    │   PostgreSQL+Redis  │   │  MongoDB+Redis     │
└─────────────────┘    └─────────────────────┘   └────────────────────┘
         │                         │                         │
         └─────────────────────────┴─────────────────────────┘
                                   │
                       All on shared Redis Cloud
                       (redis-cloud.com)
                       and separate MongoDB Atlas clusters
```

### Shared Infrastructure

| Resource | Used By |
|----------|---------|
| Redis Cloud | REZ Auth (token blacklist), REZ Wallet, Hotel OTA (BullMQ jobs), Hotel PMS (cache + queues) |
| MongoDB Atlas (REZ cluster) | rez-auth-service, rez-wallet-service, rez-merchant-service, rez-order-service |
| MongoDB Atlas (PMS cluster) | hotel-management-master backend |
| PostgreSQL (OTA cluster) | Hotel OTA API (bookings, wallets, hotel brand coins) |
| Razorpay | Hotel OTA payments |
| Stripe | Hotel PMS payments |
| MSG91 | Hotel OTA SMS notifications |
| AWS S3 | Hotel OTA image uploads |

---

## 13. Security Model

### Boundary Types

```
Public (no auth)       → hotel search, health checks
User JWT               → booking, wallet, profile
Hotel Staff JWT        → hotel panel, inventory, brand coin management
Admin JWT              → admin dashboard, coin rules, hotel enable/disable
Partner API Key        → REZ App → Hotel OTA (server-to-server)
x-internal-service + token
                        → Core REZ service-to-service calls
x-internal-token       → PMS → Hotel OTA /partner/pms/* (legacy integration surface)
x-webhook-signature    → Hotel OTA → Hotel PMS (HMAC-SHA256 on body)
```

### Token Rotation

- OTA JWT: 1 hour access + 30-day refresh
- REZ JWT: 7 days (managed by REZ Auth Service)
- `INTERNAL_SERVICE_TOKENS_JSON`: scoped service-token map, rotate by service identity

---

## 14. Local Development Setup

### Start Order (dependencies matter)

```bash
# 1. Infrastructure
redis-server &
# Start MongoDB locally or use Atlas connection string

# 2. REZ Auth Service
cd rez-auth-service && npm run dev   # :5001

# 3. REZ Wallet Service  
cd rez-wallet-service && npm run dev  # :5002

# 4. Hotel OTA API
cd "Hotel OTA" && npm run dev         # :3000

# 5. Hotel PMS Backend
cd hotel-pms/hotel-management-master/backend && npm run dev   # :4000

# 6. Hotel PMS Frontend
cd hotel-pms/hotel-management-master/frontend && npm run dev  # :3000 (or 5173)
```

### Hotel OTA `.env` for local dev

```env
DATABASE_URL=postgresql://localhost:5432/hotel_ota
REDIS_URL=redis://localhost:6379
REZ_AUTH_SERVICE_URL=http://localhost:5001
REZ_WALLET_SERVICE_URL=http://localhost:5002
INTERNAL_SERVICE_TOKENS_JSON={"hotel-ota-api":"local-dev-secret"}
PMS_API_URL=http://localhost:4000
PMS_WEBHOOK_SECRET=local-dev-webhook-secret
REZ_OTA_INTERNAL_TOKEN=local-dev-internal-token
```

### Hotel PMS `.env` for local dev

```env
MONGO_URI=mongodb://localhost:27017/hotel-pms
REDIS_URL=redis://localhost:6379
REZ_OTA_API_URL=http://localhost:3000
REZ_OTA_INTERNAL_TOKEN=local-dev-internal-token
REZ_OTA_WEBHOOK_SECRET=local-dev-webhook-secret
REZ_AUTH_SERVICE_URL=http://localhost:5001
INTERNAL_SERVICE_TOKENS_JSON={"hotel-pms-backend":"local-dev-secret"}
```

### Run Hotel OTA Tests

```bash
cd "Hotel OTA/apps/api"
npm test           # 26 tests, hits real PostgreSQL
npx tsc --noEmit   # TypeScript check
```

### Run Hotel PMS Tests

```bash
cd hotel-pms/hotel-management-master
npm run test:e2e   # Playwright E2E
cd backend && npm test
```

---

## 15. Key Integration Files

| File | Purpose |
|------|---------|
| `Hotel OTA/apps/api/src/services/rez-integration.service.ts` | REZ SSO + wallet sync for Hotel OTA |
| `Hotel OTA/apps/api/src/services/coin.service.ts` | All coin operations (OTA + REZ + hotel brand) |
| `Hotel OTA/apps/api/src/services/booking.service.ts` | Booking hold/confirm/cancel + PMS webhook push |
| `Hotel OTA/apps/api/src/services/pms-webhook.service.ts` | Pushes booking events to Hotel PMS |
| `Hotel OTA/apps/api/src/routes/partner-pms.routes.ts` | Internal API for PMS to earn coins + update inventory |
| `Hotel OTA/apps/api/src/routes/partner-rez.routes.ts` | REZ App partner API (search, hold, confirm) |
| `Hotel OTA/apps/api/src/routes/auth.routes.ts` | Includes `/rez-sso` endpoint |
| `hotel-pms/.../services/rezOtaConnector.js` | PMS ↔ OTA bridge + PMS REZ SSO |
| `hotel-pms/.../routes/rezOtaWebhooks.js` | PMS receives OTA booking events |
| `Hotel OTA/packages/database/prisma/schema.prisma` | Full data model with hotel brand coins |

---

## 16. API Gateway Routing Table

Gateway: `https://rez-api-gateway.onrender.com` (nginx, Strangler Fig pattern)

| Path Prefix | Routes To | Env Var | Cache TTL | Notes |
|-------------|-----------|---------|-----------|-------|
| `/api/search` | rez-search-service | `SEARCH_SERVICE_URL` | 5 min GET | |
| `/api/catalog` | rez-catalog-service | `CATALOG_SERVICE_URL` | 10 min GET | |
| `/api/orders` | rez-order-service | `ORDER_SERVICE_URL` | None | SSE stream, no buffering |
| `/api/merchant` | rez-merchant-service | `MERCHANT_SERVICE_URL` | None | Merchant-keyed rate limit |
| `/api/auth` | rez-auth-service | `AUTH_SERVICE_URL` | None | 20 req/min strict |
| `/api/payment` | rez-payment-service | `PAYMENT_SERVICE_URL` | None | No retries (payment idempotency) |
| `/api/wallet` | rez-wallet-service | `WALLET_SERVICE_URL` | 3 min auth-keyed | Per-user cache |
| `/api/analytics` | analytics-events | `ANALYTICS_SERVICE_URL` | 15 min GET | Reporting data |
| `/api/gamification` | rez-gamification-service | `GAMIFICATION_SERVICE_URL` | 5 min auth-keyed | |
| `/api/finance` | rez-finance-service | `FINANCE_SERVICE_URL` | None (no-store) | Always auth'd |
| `/api/admin/*` | REZ Monolith | `MONOLITH_URL` | None | Stricter rate limit |
| `/*` (catch-all) | REZ Monolith | `MONOLITH_URL` | 5 min unauthenticated GET | |

**Rate limits:** Global 50 req/s · Auth 20 req/min · Merchant 100 req/s  
**CORS:** `*.rez.money`, `*.vercel.app`, `ad-bazaar.vercel.app`  
**Tracing:** `X-Correlation-ID` / `X-Request-ID` propagated to all upstreams

---

## 17. Microservice API Surfaces (not yet in routing docs)

### rez-order-service (HTTP ready, not yet on Render as web service)

All routes require `X-Internal-Token`.

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/health` | Liveness |
| `GET` | `/health/ready` | MongoDB + Redis readiness |
| `GET` | `/orders` | List orders (query: merchantId, userId, status, page, limit) |
| `GET` | `/orders/stream` | SSE stream for merchant dashboard (3s poll, 5min max lifetime) |
| `GET` | `/orders/:id` | Single order |
| `PATCH` | `/orders/:id/status` | State-machine status transition |
| `POST` | `/orders/:id/cancel` | Cancel order |
| `GET` | `/orders/summary/:userId` | 30-day spend summary |
| `GET` | `/internal/orders/summary/:userId` | Same, alternate path |

**State machine:** `placed → confirmed → preparing → ready → dispatched → out_for_delivery → delivered → returned/refunded`

### rez-ads-service (built, not yet deployed to Render)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/health` | None | Liveness |
| `GET/POST` | `/merchant/ads/*` | Merchant JWT | Create/manage ad campaigns |
| `GET/POST` | `/admin/ads/*` | Admin JWT | Approve/manage campaigns |
| `GET` | `/ads/*` | None | Serve ads to consumer/merchant apps |

**DB:** MongoDB (`ADS_MONGO_URI` or `MONGO_URI`)  
**To deploy:** Create Render web service, set `PORT=4007`, add `appId` to AdCampaign when sister apps launch.

### rez-media-events (HTTP + BullMQ worker)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/health` | None | Liveness |
| `POST` | `/upload` | `X-User-ID` header | Multipart upload (jpeg/png/webp, max 10MB) |
| `GET` | `/uploads/:filename` | None | Serve uploaded file |

### rez-notification-events (BullMQ worker only)

No REST API. Health server on port 3001 (`GET /health`).

**Queues consumed:**
- `notifications` — push notifications to users
- Streak-at-risk scheduler (cron within the process)
- DLQ handler (dead-letter queue for failed jobs)

### rez-wallet-service — Complete API Surface

**Consumer routes** (JWT auth):

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/balance` | User coin balances |
| `GET` | `/transactions` | Transaction history (page, limit, coinType) |
| `GET` | `/summary` | Transaction summary |
| `POST` | `/credit` | Direct credit (admin/operator role only) |
| `POST` | `/debit` | Burn coins (rate limited: 10/min) |
| `POST` | `/welcome-coins` | Claim 50 welcome coins (once per user) |
| `GET` | `/conversion-rate` | Current coin-to-rupee rate |

**Merchant routes** (merchant/admin JWT):

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/merchant/wallet` | Merchant wallet balance |
| `GET` | `/api/merchant/wallet/transactions` | Merchant transaction history |

**Internal routes** (`X-Internal-Token`):

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/internal/credit` | Credit coins (called by payment/order services) |
| `POST` | `/internal/debit` | Debit coins (called by order services) |
| `GET` | `/internal/balance/:userId` | Get balance (called by Hotel OTA at SSO) |
| `POST` | `/internal/merchant/credit` | Credit merchant wallet on order completion |
| `GET` | `/internal/reconcile` | Wallet reconciliation check (admin use) |
| `GET` | `/payouts` | Merchant payout history |

**Coin types:** `nuqta` (main), `prive`, `branded`, `promo`  
**Legacy:** `rez` maps to `nuqta` automatically

### rez-finance-service — Complete API Surface

**Consumer routes** (`/finance/*`, JWT auth):

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/finance/borrow/offers` | Pre-approved loan/card/BNPL offers |
| `POST` | `/finance/borrow/apply` | Apply for loan or credit card |
| `GET` | `/finance/borrow/applications` | User's applications |
| `GET` | `/finance/borrow/applications/:id` | Single application |
| `POST` | `/finance/borrow/bnpl/check` | BNPL eligibility check (at checkout) |
| `POST` | `/finance/borrow/bnpl/create` | Create BNPL order |
| `GET` | `/finance/credit/score` | REZ Score + eligibility |
| `POST` | `/finance/credit/score/check` | Trigger score check (earns coins, once/day) |
| `POST` | `/finance/credit/score/refresh` | Force refresh score |
| `GET/POST` | `/finance/pay/*` | Pay routes (UPI/wallet/BNPL at POS) |

**Partner webhook routes** (`/finance/partner/webhook/*`, per-partner HMAC):

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/finance/partner/webhook/finbox` | FinBox credit bureau webhook |

**Internal routes** (`/internal/finance/*`, `X-Internal-Token`):

| Method | Route | Purpose |
|--------|-------|---------|
| Various | `/internal/finance/*` | Service-to-service finance queries |

**External dependencies:**
- `rez-wallet-service` — awards coins on score check, reads balance
- `rez-order-service` — reads 30-day spend for credit intelligence
- **FinBox** — credit aggregator (disabled if `FINBOX_API_KEY` not set, runs in stub mode)

**Background job:** `offerRefresh` — periodically re-fetches partner offers from FinBox

---

## 18. AdBazaar Integration

### REZ ↔ AdBazaar connection points

```
AdBazaar vendor scans → Supabase records booking
  → AdBazaar API calls REZ Backend:
    POST https://api.rezapp.com/api/adbazaar/scan
    { rez_merchant_id, qr_code_id, campaign_id }
    → credits coins to REZ merchant

REZ Backend → AdBazaar (attribution):
  POST {ADBAZAAR_WEBHOOK_URL}
  { eventType: 'visit' | 'purchase', userId, campaignId, merchantId }
  Header: X-Signature: HMAC-SHA256(payload, ADBAZAAR_WEBHOOK_SECRET)

AdBazaar → REZ (merchant summary):
  GET https://api.rezapp.com/api/merchant/summary (internal)
  → REZ backend pulls attribution stats
```

### AdBazaar Supabase Migrations

Run all 6 in Supabase SQL Editor before going live:
`001_init.sql` → `002_profiles.sql` → `003_bookings.sql` → `004_payouts.sql` → `005_disputes.sql` → `006_qr_analytics.sql`

### AdBazaar env vars (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
RESEND_API_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
REZ_BACKEND_URL=https://api.rezapp.com
REZ_WEBHOOK_SECRET
```

---

## 19. BullMQ Queue Topology

All queues use the shared Upstash Redis instance. This is the complete producer → consumer map:

| Queue | Producer(s) | Consumer(s) | Job Types |
|-------|------------|-------------|-----------|
| `gamification-events` | rezbackend (visit check-in) | rez-gamification-service | `visit_checked_in` → achievement evaluation |
| `store-visit-events` | rezbackend | rez-gamification-service (streakWorker) | visit events → streak milestones |
| `notification-events` | rez-gamification-service, rez-marketing-service, rezbackend | rez-notification-events | push, email, SMS, WhatsApp sends |
| `catalog-events` | rez-catalog-service (write ops), rez-merchant-service | rez-catalog-service (catalogWorker) | `product.created/updated/deleted`, `stock.updated/low`, `bulk.imported` |
| `merchant-aggregation-scheduler` | cron inside analytics-events | analytics-events (merchantAggregationWorker) | nightly 2am UTC aggregation |

**BullBoard UI:** `/admin` (not `/api/admin`) on the rezbackend monolith — live queue monitoring dashboard with admin auth + rate limiting.  
**DLQ API:** `GET /api/admin/dlq` — programmatic dead-letter queue management.

---

## 20. rez-auth-service — Full API

All routes have dual-path aliases: native `/auth/*` + monolith-compat `/api/user/auth/*`.

### OTP Flow
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/auth/otp/send` | Send OTP via SMS (MSG91) |
| `POST` | `/auth/otp/send-whatsapp` | Send OTP via WhatsApp |
| `POST` | `/auth/otp/verify` | Verify OTP, issue JWT + refresh token |

### PIN Flow
| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/auth/has-pin` | Check if phone has a PIN set (pre-login) |
| `POST` | `/auth/set-pin` | Set 4–6 digit PIN after OTP verification |
| `POST` | `/auth/login-pin` | PIN-based login for returning users |

### Session Management
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/auth/refresh` | Rotate refresh token (new access + refresh pair) |
| `POST` | `/auth/token/refresh` | Alternate refresh path |
| `POST` | `/auth/logout` | Invalidate token (blacklist in Redis) |
| `GET` | `/auth/validate` | Verify JWT + Redis blacklist check |
| `GET` | `/auth/me` | Current user's profile |

### Profile & Account
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/auth/complete-onboarding` | Mark user onboarded, set profile + preferences |
| `PATCH` | `/auth/profile` | Update firstName, lastName, avatar, etc. |
| `DELETE` | `/auth/account` | Soft-delete (sets `isActive: false`), blacklists current token |
| `POST` | `/auth/change-phone/request` | OTP to old phone to begin phone-number change |
| `POST` | `/auth/change-phone/verify` | Confirm new phone OTP, update phone field |
| `POST` | `/auth/email/verify/request` | Send email verification link |
| `GET` | `/auth/email/verify/:token` | Click-through email verification confirm |

### Special Auth
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/auth/guest` | Issue guest JWT for web-menu (tableId + storeId, role=`guest`) |
| `POST` | `/auth/admin/login` | Email + password admin login (separate from OTP flow) |

### Internal (X-Internal-Token)
| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/internal/auth/user/:id` | Fetch user profile by userId (called by Hotel OTA, Hotel PMS) |

### Security Mechanisms
- **PIN lockout:** 5 failed attempts → 15-minute lockout via Redis keys `pin-lock:` / `pin-fail:`
- **Common PIN blocklist:** 17 weak PINs rejected (0000, 1234, 1111, etc.)
- **Device fingerprinting + risk scoring:** Every OTP verify + PIN login runs `deviceService.computeFingerprint()` and `deviceService.assessRisk()`. `deviceRisk` flag returned in login response.
- **Admin password auto-upgrade:** Legacy plaintext passwords rehashed to bcrypt on first login.
- **Token blacklist on account delete:** `tokenService.blacklistToken()` called on soft-delete.

---

## 21. rez-payment-service — Full API

All routes have dual-path aliases.

### Consumer Routes (JWT auth)
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/pay/initiate` | Create payment (client-facing: `purpose=order` only) |
| `POST` | `/pay/capture` | Capture Razorpay payment (replay-prevention nonce check) |
| `POST` | `/pay/refund` | Initiate refund (merchant/admin role) |
| `GET` | `/pay/status/:paymentId` | Payment status + full audit trail |
| `GET` | `/api/razorpay/config` | Returns Razorpay `key_id` for client SDK init |
| `POST` | `/api/razorpay/create-order` | Create Razorpay order (server-side amount assertion) |
| `GET` | `/pay/merchant/settlements` | Paginated settlement history (merchant/admin) |

### Webhook (HMAC verified, no auth)
| Method | Route | Events Handled |
|--------|-------|---------------|
| `POST` | `/pay/webhook/razorpay` | `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed` |

### Internal (X-Internal-Token)
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/internal/pay/deduct` | Service-to-service deduct |
| `GET` | `/internal/pay/:paymentId` | Internal status lookup |
| `POST` | `/pay/verify` | Razorpay signature oracle — internal only |

### Security & Reliability Mechanisms
- **Replay-prevention nonce store:** Captured `razorpayPaymentId` stored in Redis with 25-hour TTL (`pay:nonce:<id>`). Second capture returns HTTP 409. Falls back to in-process Map when Redis is unavailable.
- **Server-side authoritative amount assertion:** `assertAuthoritativeOrderAmount()` called before Razorpay order creation. Amount mismatch from client → request rejected.
- **Cron reconciliation jobs (node-cron, inside process):**
  - Every 15 min: `runReconciliation()` — fix stuck-in-processing payments
  - Every 5 min: `recoverStuckPayments()` — expire stuck pending payments

### Stripe (Travel Payments)
The rezbackend monolith uses **Stripe** (not Razorpay) for travel payments (`/api/travel-payment`).  
Supported currencies: INR, AED, USD, EUR, GBP, CAD, AUD.  
Razorpay is used for all other payment flows (orders, bookings, web-ordering).

---

## 22. rez-marketing-service — Full API

### Campaigns
| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/campaigns` | List campaigns (merchantId, status, page, limit) |
| `GET` | `/campaigns/:id` | Single campaign |
| `POST` | `/campaigns` | Create campaign (estimates audience first) |
| `PATCH` | `/campaigns/:id` | Update draft campaign |
| `POST` | `/campaigns/:id/launch` | Launch campaign immediately |
| `POST` | `/campaigns/:id/schedule` | Schedule campaign for future time |
| `POST` | `/campaigns/:id/pause` | Pause active campaign |
| `GET` | `/campaigns/:id/analytics` | Campaign performance metrics |

### Broadcasts
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/broadcasts/send` | Segment-based broadcast (high_value / at_risk / new_users / all) |
| `GET` | `/broadcasts/:merchantId` | List past broadcasts with stats |
| `POST` | `/broadcasts/:id/schedule` | Schedule for future time |
| `POST` | `/broadcasts` | Create and send immediately |

**Rate limit:** 1 broadcast per merchant per hour (Redis enforced)

### Audience
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/audience/estimate` | Estimate audience size for a filter before campaign creation |
| `GET` | `/audience/interests` | Interest tags with user counts |
| `GET` | `/audience/locations` | Top cities/areas with user counts |

### Search Ads / Keywords
| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/keywords` | List keyword bids for a merchant |
| `POST` | `/keywords` | Create keyword bid (CPC/CPM, matchType: broad/exact/phrase) |
| `PATCH` | `/keywords/:id` | Update bid |
| `DELETE` | `/keywords/:id` | Delete bid |

### Analytics
| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/analytics/summary` | Merchant-level campaign summary (configurable day range) |
| `GET` | `/analytics/campaign/:id` | Per-campaign metrics |
| `POST` | `/analytics/track/open` | Track message open |
| `POST` | `/analytics/track/click` | Track link click |
| `POST` | `/analytics/track/conversion` | Track conversion event |

### AdBazaar Integration (x-internal-key)
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/adbazaar/broadcast` | AdBazaar triggers broadcast to REZ users for a merchant booking |
| `GET` | `/adbazaar/status/:broadcastId` | Status of AdBazaar-triggered broadcast |

### Webhooks
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/webhooks/whatsapp` | None | Meta webhook challenge verification |
| `POST` | `/webhooks/whatsapp` | `X-Hub-Signature-256` HMAC | WhatsApp delivery receipts (sent/delivered/read/failed) |

### Background Workers
- **`campaignWorker.ts`** — BullMQ consumer: executes scheduled/immediate campaign sends, enqueues jobs to `notification-events` queue
- **`interestSyncWorker.ts`** — keeps `userinterestprofiles` collection in sync

### Delivery Channels
`EmailChannel.ts` · `PushChannel.ts` · `SMSChannel.ts` · `WhatsAppChannel.ts`

---

## 23. rez-catalog-service — Full API

Write operations are **internal-only**. Reads are public.

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/products` | None | List products (storeId, category, search, page) |
| `GET` | `/products/featured` | None | Featured products, optional geo filter |
| `GET` | `/products/merchant/:merchantId` | None | Products for a specific merchant |
| `GET` | `/products/:productId` | None | Single product detail |
| `GET` | `/categories` | None | List categories |
| `GET` | `/categories/:categoryId/products` | None | Products by category |
| `POST` | `/products` | X-Internal-Token | Create product |
| `PATCH` | `/products/:id` | X-Internal-Token | Update product |
| `DELETE` | `/products/:id` | X-Internal-Token | Delete product |

Gateway strips `/api/` prefix — callers use `/api/products/*` and `/api/categories/*`.

**BullMQ `catalog-events` worker — job types:**
`product.created` · `product.updated` · `product.deleted` · `stock.updated` · `stock.low` · `bulk.imported`

Actions: Redis cache invalidation (`products:list`, `products:featured`, `products:trending`), analytics tracking, stock-alert dispatch, aggregator sync.

**Security note:** User-supplied search strings are sanitised with `escapeRegex()` before MongoDB `$regex` use (ReDoS protection).

---

## 24. rez-search-service — Full API

All routes have monolith compat aliases (e.g. `/search/stores` + `/api/stores/search`).

### Search
| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/search/stores` | Full-text + geo store search (q, lat, lng, radius, category) |
| `GET` | `/api/stores/nearby` | Geo-only nearby stores |
| `GET` | `/search/products` | Product search (q, storeId, category, price range) |
| `GET` | `/search/filters` | Available filter facets |
| `GET` | `/search/trending` | Top trending stores |
| `GET` | `/search/trending-by-category` | Top 5 categories × top 3 stores each |
| `GET` | `/search/suggestions` | Fast prefix-match on store + category names |
| `GET` | `/search/suggest` | Fuzzy + category-aware autocomplete |

### Search History
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `POST` | `/search/history` | JWT | Save a search query |
| `GET` | `/search/history` | JWT | User's recent searches |
| `GET` | `/search/history/popular` | None | Platform-wide popular searches |

### Homepage Feed (served by rez-search-service, not monolith)
| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/home/feed` | Personalised homepage feed (lat, lng, city, userId optional) |
| `GET` | `/home/sections` | Homepage section config |
| `GET` | `/api/homepage/user-context` | Aggregated wallet/vouchers/cart/offers for homepage |

### Recommendations
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/recommend/personalized` | JWT | Personalised store recommendations |
| `GET` | `/recommend/store/:storeId` | None | Similar-store recommendations |
| `GET` | `/recommend/trending` | None | Trending stores (city, category) |

**Caching tiers:**
- Prefix suggestions: 60-second in-process Map
- Autocomplete: 5-minute Redis cache
- Trending-by-category: 10-minute in-process Map

---

## 25. rez-gamification-service — Full API

All routes require `X-Internal-Token`.

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/achievements/:userId` | Earned + locked achievements with check status |
| `GET` | `/streak/:userId` | Current streak, milestone history |
| `GET` | `/leaderboard` | Top 20 users by lifetime coins (5-min in-memory cache) |
| `GET` | `/leaderboard/me` | Caller's rank + surrounding users |
| `POST` | `/internal/visit` | Record store visit event → triggers streak + achievement processing |
| `GET` | `/internal/dlq/:queueName` | Inspect dead-letter queue jobs |
| `GET` | `/metrics` | Prometheus-style job metrics (processed/failed/duration per job name) |

**BullMQ Workers:**
- **`achievementWorker`** — `gamification-events` queue. Evaluates 6+ achievements on `visit_checked_in`. Awards coins via wallet ledger. Enqueues `achievement_unlocked` to `notification-events`.
- **`storeVisitStreakWorker`** — `store-visit-events` queue. Streak milestones: 3-day/50 coins, 7-day/150 coins, 30-day/500 coins. Enqueues `coin_earned` notification on milestone.

**Achievement catalogue (hardcoded in worker):**
First Visit (25 coins) · Regular (75 coins) · Loyal Customer (150 coins) + 3+ more.

**Redis pub/sub:** Service subscribes to `game-config:updated` channel. Admin config changes hot-reload without service restart.

---

## 26. analytics-events — Full API

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/benchmarks/:merchantId` | X-Internal-Token | Peer benchmarks for a merchant |
| `GET` | `/benchmarks/peer-group` | X-Internal-Token | Peer group stats for city + cuisine combination |
| `GET` | `/api/analytics/merchant/:merchantId/summary` | Internal | Aggregated merchant analytics (30d, 90d, 1y) |

**BullMQ worker — `merchantAggregationWorker`:**
Repeatable job on `merchant-aggregation-scheduler`. Runs nightly at 2am UTC.
Computes: daily revenue, customer visit frequency, top products by revenue, new vs returning ratio. Writes to `merchantanalytics` collection keyed by `{ merchantId, date }`.

**Anonymization Pipeline:**
Before peer benchmarking, `merchantId` is replaced with deterministic HMAC-derived opaque key. Customer PII (names, emails, phones) stripped. Amounts and rates preserved. Privacy-by-design for competitive benchmarking.

---

## 27. REZ Backend — Additional Verticals

The monolith (`https://api.rezapp.com/api`) includes these verticals beyond the core routes already documented:

### Dining & Ordering
| Mount | Purpose |
|-------|---------|
| `/api/web-ordering` | QR-scan-to-order (no-app required, REZ's DotPe competitor). Full Razorpay + OTP guest flow. |
| `/api/table-bookings` | Restaurant table reservations with pre-order support |
| `/api/table-sessions` | Live table sessions: open, add-order, request-bill, pay (sessionToken-based, multi-party) |
| `/api/menu` | In-app restaurant menu browsing |

### Travel
| Mount | Purpose |
|-------|---------|
| `/api/travel-services` | Flight/hotel/bus search and booking |
| `/api/travel-payment` | Razorpay (INR) + **Stripe** (AED/USD/EUR/GBP/CAD/AUD) |
| `/api/travel-webhooks` | booking-update + price-update webhooks from travel aggregators |

### Financial Products
| Mount | Purpose |
|-------|---------|
| `/api/financial-services` | Embedded financial products (separate from rez-finance-service) |
| `/api/gold` | Digital gold savings |
| `/api/wallet/gold-sip` | SIP into digital gold |
| `/api/insurance` | Insurance product listing + purchase |
| `/api/bill-payments` | BBPS bill payments |
| `/api/bills` | Bill management |
| `/api/wallet/split` | Bill splitting |
| `/api/consumer/khata` | Consumer ledger (spend tracking) |

### Health & Lifestyle
| Mount | Purpose |
|-------|---------|
| `/api/consultations` | Doctor/expert consultations |
| `/api/health-records` | Personal health record storage |
| `/api/emergency` | Emergency services |
| `/api/fitness` | Fitness/health features |
| `/api/home-services` | Home service bookings (plumbers, electricians, etc.) |
| `/api/service-appointments` | Service appointment scheduling |
| `/api/service-categories` | Service category listing |
| `/api/service-bookings` | Service booking CRUD |

### Loyalty & Commerce
| Mount | Purpose |
|-------|---------|
| `/api/prive` | Prive premium membership |
| `/api/prive/campaigns` | Prive-specific campaign management |
| `/api/lock-deals` | Lock-in price deals |
| `/api/play-earn` | Play-to-earn feature |
| `/api/try` | REZ TRY product trials |
| `/api/earn` | Earn module |
| `/api/experiences` | Experience products |
| `/api/learning` | Learning/education content |
| `/api/group-buy` | Group purchase feature |
| `/api/cashstore` | Cash-store (bill-upload-earn) module |
| `/api/cashstore/affiliate` | Cashstore affiliate tracking |
| `/api/mall` | Shopping mall integration |
| `/api/mall/affiliate` | Mall affiliate tracking |

### Intelligence & Personalisation
| Mount | Purpose |
|-------|---------|
| `/api/persona` | User persona detection |
| `/api/homepage` (persona sections) | Persona-specific homepage sections (campus-trending, lunch-deals) |
| `/api/home` | Home snapshot + real-time context overlay |

### Integrations
| Mount | Purpose |
|-------|---------|
| `/api/whatsapp` | WhatsApp inbound webhook |
| `/api/integrations` | HMAC-secured integration webhook for third-party aggregators |
| `/api/institute-referrals` | Educational institution referrals |

### Admin-Only Routes (`/api/admin/`)
`ab-tests` · `aggregator-monitor` · `bbps` + `bbps-health` · `bonus-zone` · `bullboard` (at `/admin`, not `/api/admin`) · `challenges` · `coin-drops` · `coin-gifts` · `coin-rewards` · `corporate` · `daily-checkin-config` · `delivery-config` · `devices` (fingerprint) · `dlq` · `economics` · `engagement-config` · `event-categories` + `event-rewards` · `exclusive-zones` · `fraud-config` + `fraud-reports` · `game-config` · `gamification-stats` · `gold` · `health-deep` · `hotspot-areas` · `institute-referrals` + `institutions` · `leaderboard/configs` · `loyalty-milestones` · `mall/brands` · `marketing/analytics` · `membership` · `merchant-liability` · `moderation` · `notifications` · `orchestrator` · `ota` · `payroll` · `platform-settings` · `quick-actions` · `reward-config` · `special-profiles` + `special-programs` · `support-config` · `surprise-coin-drops` · `tournaments` · `upload-bill-stores` · `value-cards` · `wallet-config`

**Note on decommissioned merchant routes:** ~70 merchant route file imports exist in `routes.ts` but are commented out — traffic now goes to `rez-merchant-service`. The files remain in the monolith but are inactive.

---

## 28. rez-merchant-service — Domain Overview

This service has ~89 route files organized into 9 aggregating routers. It is the most comprehensive microservice — a full merchant operations platform.

| Router | Domains Covered |
|--------|----------------|
| `core` | Merchant profile, onboarding, auth, dashboard, stores, uploads, feature flags |
| `orders` | Orders, POS, table management, floor plan, store visits, vouchers, deal redemptions |
| `products` | Products, categories, variants, gallery, bulk import, bundles, recipes |
| `campaigns` | Offers, discounts, cashback, gift cards, stamp/punch cards, loyalty tiers, campaigns, dynamic pricing, upsell rules, post-purchase |
| `analytics` | Customer insights, demand signals, intelligence, growth, attribution, audit, fraud, moderation |
| `finance` | Payouts, payroll, GST, bizdocs, expenses, khata, wallet, liability, ROI, purchase orders, suppliers, waste |
| `engagement` | Social media, subscriptions, prive module, coins, corporate |
| `staff` | Staff shifts, shift gap bridge, team management |
| `support` | Support tickets, disputes, integrations, sync, exports, notifications |

---

## 29. rez-web-menu QR Ordering Flow

The web menu at `https://menu.rez.money` is the no-app table ordering experience.

```
Customer scans QR code at restaurant table
  └─→ Opens menu.rez.money/<storeSlug>?table=<tableId>

Browser:
  1. GET /api/catalog/products?storeId=<id>   (rez-catalog-service)
  2. Guest adds items to cart (client-side state)
  3. POST /auth/guest { tableId, storeId }     (rez-auth-service)
       → Issues guest JWT (role=guest, 2hr TTL)
  4. POST /api/web-ordering/initiate           (rezbackend)
       → Creates order + Razorpay payment link
       → CSRF: X-Requested-With header required
  5. Razorpay checkout (in-browser)
  6. POST /api/web-ordering/confirm            (rezbackend)
       → Verifies Razorpay signature
       → Places order → enqueues to BullMQ
  7. Order appears on merchant Kitchen Display (SSE stream)
```

**Security:** CSRF protection enforced (`X-Requested-With` required) on all mutation requests in the web-ordering module.

## Pending Work / Open Items

| Item | Priority | Action |
|------|----------|--------|
| `rez-order-service` — promote to Render web service | High | Create web service, set `ORDER_SERVICE_URL` in gateway env |
| `rez-ads-service` — deploy to Render | Medium | Create web service, add `appId` field when sister apps launch |
| Hotel OTA — run Prisma migrations after deploy | Critical | `cd apps/api && npx prisma migrate deploy --schema=../../packages/database/prisma/schema.prisma` |
| Hotel OTA — add `RAZORPAY_WEBHOOK_SECRET` to Render env | Critical | Render → hotel-ota-api → Environment |
| Rotate OTA DB password (exposed in chat 2026-04-07) | Critical | Render → hotel-ota-db → credentials → rotate |
| Hotel PMS frontend — add SPA rewrite rule | Medium | Render static site → `/* → /index.html` |
| `rez-notification-events` — add HTTP API surface | Low | Currently health-only; add `/internal/notify` endpoint if needed |
| Resturistan — connect `imrejaul007/restaurantapp` to Render | Medium | Use existing `render.yaml` |
| Rendez — create Render web service + Postgres | Medium | `imrejaul007/Rendez`, v1.0.0 tagged, $14/mo |
| hotel-ota — add `RAZORPAY_WEBHOOK_SECRET` to Render env | Critical | Render → hotel-ota → Environment |
| Hotel Panel — create Vercel project | Low | `Hotel OTA/apps/hotel-panel/` |
| OTA Mobile — EAS build setup | Low | `Hotel OTA/apps/mobile/`, update `API_BASE` before build |

---

## 30. Hotel OTA Frontend Apps

The Hotel OTA monorepo (`Hotel OTA/apps/`) contains five frontend applications all backed by the same `hotel-ota-api` service. Full per-app documentation: [services/hotel-ota-apps.md](services/hotel-ota-apps.md).

### App Inventory

| App | Brand | Users | Deploy | URL |
|-----|-------|-------|--------|-----|
| `ota-web` | StayOwn | Travellers / customers | Vercel | `hotel-ota-ota-web-five.vercel.app` |
| `admin` | OTA Admin | OTA operators | Vercel | `hotel-ota-admin.vercel.app` |
| `hotel-panel` | Hotel Panel | Per-property hotel staff | Vercel (pending) | TBD |
| `corporate-panel` | Corporate | Corporate travel managers | Vercel (pending) | TBD (scaffolded only) |
| `mobile` | StayOwn Mobile | Travellers (iOS + Android) | EAS (pending) | iOS + Android |

### Auth Strategy Per App

| App | Method | Token key |
|-----|--------|-----------|
| `ota-web` | Phone OTP | `localStorage: ota_token` |
| `admin` | Email + password | `localStorage: admin_token` |
| `hotel-panel` | Phone OTP | `localStorage: hotel_token` |
| `corporate-panel` | Email + password | TBD (not yet wired) |
| `mobile` | Phone OTP | `AsyncStorage: ota_access_token` |

### Connection to Backend

All five apps set `NEXT_PUBLIC_API_URL` (or hardcode for mobile) pointing to `hotel-ota-api`:

```
ota-web        ──▶ hotel-ota-api /v1/hotels, /v1/bookings, /v1/wallet, /v1/reviews
admin          ──▶ hotel-ota-api /v1/admin/*, /v1/mining/*, /v1/settlements/*
hotel-panel    ──▶ hotel-ota-api /v1/hotel/*, /v1/pricing/*, /v1/mining/hotel/*
corporate-panel──▶ hotel-ota-api /v1/corporate/* (planned)
mobile         ──▶ hotel-ota-api /v1/* (same as ota-web, hardcoded localhost in dev)
```

### Local Port Map

| Service | Port |
|---------|------|
| hotel-ota-api | 3000 |
| hotel-panel | 3001 |
| admin | 3002 |
| ota-web | 3003 |
| corporate-panel | 3004 |

---

## 31. Resturistan (RestaurantHub) Architecture

**Repo:** `github.com/imrejaul007/restaurantapp`  
**Type:** B2B/B2C SaaS for restaurants — Turborepo monorepo  
**Status:** GitHub ✅ — Render deploy pending (`render.yaml` ready)

Full documentation: [services/restauranthub.md](services/restauranthub.md)

### System Map

```
┌─────────────────────────────────────────────────────────┐
│                   RESTURISTAN CLIENTS                    │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  apps/web    │  │ apps/mobile  │  │  admin panel  │  │
│  │ (Next.js 14) │  │ (React Native│  │ (within web   │  │
│  │  port 3001)  │  │  Expo EAS)   │  │  /admin/*)    │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
└─────────┼─────────────────┼───────────────────┼──────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│                RESTURISTAN BACKEND                       │
│                                                          │
│  apps/api  (NestJS 10, port 3000, prefix /api/v1)        │
│  ├── Auth module (local + REZ bridge)                    │
│  ├── Orders module                                       │
│  ├── Marketplace module (B2B wholesale)                  │
│  ├── Jobs module (HR / hiring)                           │
│  ├── Analytics module (peer benchmarks via REZ)          │
│  ├── Fintech module (credit, BNPL, supplier payment)     │
│  └── QR Templates, Training Academy                     │
│                                                          │
│  Microservices (NestJS):                                 │
│  ├── apps/api-gateway     (port 3002)                    │
│  ├── apps/auth-service    (port 3004)                    │
│  ├── apps/restaurant-service (port 3003, Redis transport)│
│  ├── apps/order-service   (port 3006)                    │
│  └── apps/notification-service (port 3005)               │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    PostgreSQL       Redis      Cloudinary
    (Prisma 5)    (queues +    (images)
                   cache)
```

### REZ Integration Points

Resturistan connects to REZ via `packages/rez-client` — a circuit-breaker-protected NestJS module:

```
Resturistan apps/api
  └── RezClientModule
        ├── RezMerchantClient  ──▶ rez-merchant-service
        │     getMerchant, getStats, getStores,
        │     getPurchaseOrders, getShiftGaps
        ├── RezAnalyticsClient ──▶ analytics-events
        │     revenue metrics, peer benchmarks, food cost
        ├── RezCatalogClient   ──▶ rez-catalog-service
        │     product catalog, categories
        └── RezWalletClient    ──▶ rez-wallet-service
              getBalance, getTransactions, getCreditScore
```

**REZ Auth Bridge** — REZ restaurant merchants can SSO into Resturistan:
```
POST /api/v1/auth/rez-bridge  { rezToken: "<REZ JWT>" }
  → Verify JWT with REZ_JWT_SECRET
  → Fetch merchant profile from REZ_BACKEND_URL/merchant/profile
  → Upsert Resturistan User + Profile (rezMerchantId foreign key)
  → Return Resturistan JWT
```

**REZ webhooks inbound** (rez-backend → Resturistan `/users/rez-webhook`):
- `merchant-created` — auto-provision Resturistan account for new REZ merchant
- `shift-gaps` — alert restaurant when understaffed shifts detected
- `hire-confirmed` — update HR records when REZ confirms a hire

### Who Calls What

```
Restaurant operator ──▶ apps/web /dashboard/*
                         ├── inventory, orders, employees, payroll
                         ├── marketplace (B2B purchasing from vendors)
                         └── analytics (pulls from REZ via rez-client)

Diner              ──▶ apps/web /restaurants/, /orders/
Vendor/Supplier    ──▶ apps/web /vendor/dashboard/
Admin              ──▶ apps/web /admin/
REZ Backend        ──▶ POST /users/rez-webhook (merchant lifecycle events)
```

### Infrastructure

| Component | Service | Cost |
|-----------|---------|------|
| API | Render Web Service | $7/mo |
| Web | Render Web Service | $7/mo |
| Database | Render Postgres Starter | $7/mo |
| Cache | Render Redis | free tier |
| Images | Cloudinary | free tier |
| **Total** | | **~$21/mo** |

---

## 32. Rendez Architecture

**Repo:** `github.com/imrejaul007/Rendez`  
**Type:** Social / dating app — REZ ecosystem partner  
**Status:** v1.0.0 tagged — Render deploy pending

Full documentation: [services/rendez.md](services/rendez.md)

### System Map

```
┌──────────────────────────────────────────────────────┐
│                  RENDEZ CLIENTS                       │
│                                                       │
│  ┌───────────────────┐    ┌────────────────────────┐  │
│  │  rendez-app       │    │   rendez-admin          │  │
│  │  (React Native    │    │   (Next.js, Vercel)     │  │
│  │   Expo EAS)       │    │   Bearer: ADMIN_API_KEY │  │
│  └────────┬──────────┘    └────────────┬───────────┘  │
└───────────┼────────────────────────────┼──────────────┘
            │                            │
            ▼                            ▼
┌──────────────────────────────────────────────────────┐
│               RENDEZ BACKEND (Node.js + Express)      │
│               rendez-backend/  (port 4000)            │
│                                                       │
│  Routes: /api/v1/                                     │
│  ├── auth/verify      ← validates REZ JWT             │
│  ├── profile/         ← CRUD profile                  │
│  ├── discover/        ← swipe deck                    │
│  ├── match/           ← like / pass / unmatch         │
│  ├── messaging/       ← state machine chat            │
│  ├── gift/            ← progressive coin gifts        │
│  ├── wallet/          ← proxy to REZ wallet           │
│  ├── meetup/          ← QR-validated meetup booking   │
│  ├── safety/          ← report / block                │
│  └── webhooks/rez/*   ← gift-redeemed, payment events │
│                                                       │
│  Real-time: Socket.io (same HTTP port, JWT WS auth)   │
└───────────────────────┬──────────────────────────────┘
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
      PostgreSQL      Redis         Cloudinary
      (Prisma)      (BullMQ +      (photos)
                     sessions)
```

### REZ Integration Points

Rendez uses REZ as its **sole financial and identity layer**:

```
Rendez Backend  ──▶  REZ Partner API  (x-partner-key auth)
  │
  ├── rezAuthClient     ──▶  /partner/v1/auth/verify
  │                           validate REZ JWT → get rezUserId + phone
  │
  ├── rezWalletClient   ──▶  /partner/v1/wallet/:id/balance
  │                           display coin balance to user
  │
  ├── rezGiftClient     ──▶  /partner/v1/gifts/transfer-coins
  │                     ──▶  /partner/v1/gifts/issue-voucher
  │                           debit sender → gift to recipient
  │
  ├── rezMerchantClient ──▶  /partner/v1/merchants/nearby
  │                     ──▶  /partner/v1/bookings
  │                           suggest REZ restaurants for meetups
  │
  └── rezRewardClient   ──▶  /partner/v1/rewards/credit-meetup
                              credit both users REZ coins on QR meetup

REZ Backend  ──▶  Rendez webhooks  (HMAC: REZ_WEBHOOK_SECRET)
  ├── POST /api/v1/webhooks/rez/gift-redeemed    → update Gift.status
  ├── POST /api/v1/webhooks/rez/gift-expired     → update Gift.status
  └── POST /api/v1/webhooks/rez/payment-completed → trigger meetup reward
```

**Auth flow:**
```
User opens Rendez app
  └─→ App sends stored REZ JWT to POST /api/v1/auth/verify
        ├── Rendez validates JWT via REZ partner API
        ├── Creates/fetches Profile record (linked by rezUserId)
        └── Issues Rendez JWT (7d TTL) → stored in AsyncStorage
```

### Messaging State Machine

```
MATCHED → FREE_MSG_SENT → AWAITING_REPLY → LOCKED (gift required)
                                        → OPEN   (free chat unlocked)

LOCKED → GIFT_PENDING → GIFT_UNLOCKED → OPEN
```

### Meetup Coin Flow

```
Match suggests REZ restaurant
  └─→ POST /meetup/book        → creates booking via rezMerchantClient
  └─→ Both users arrive, scan QR codes within 30 min window
        Redis NX lock prevents duplicate reward
        Both check in → POST /meetup/:matchId/checkin (second scan)
        └─→ rezRewardClient.creditMeetup()
              → REZ credits MEETUP_REWARD_COINS to both users
```

### Infrastructure

| Component | Service | Cost |
|-----------|---------|------|
| Backend | Render Web Service Starter | $7/mo |
| Database | Render Postgres Starter | $7/mo |
| Cache | Redis free tier | $0 |
| Images | Cloudinary free tier | $0 |
| **Total** | | **~$14/mo** |
