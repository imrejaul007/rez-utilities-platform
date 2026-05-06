# REZ Platform — Service Documentation Index

> Last updated: 2026-04-11  
> 20 backend services + 10 frontend apps + 1 B2B platform + 1 partner app fully documented.  
> Each file below is a complete runbook: routes, env vars, data models, integration flows, local dev, troubleshooting.

---

## Developer Verification (Before Push)

- Use the root verification guide: [../PRE_PUSH_VERIFICATION.md](../PRE_PUSH_VERIFICATION.md)
- Include the post-deploy 1-minute runtime probe in that guide (`/health/live`, `/health/ready`, fallback `/health`)
- Run all verification commands from:
`/Users/rejaulkarim/Documents/ReZ Full App`
- Active root workspace currently excludes `rez-web-menu` to avoid nested workspace pollution during backend verification runs.

---

## Backend Services

### Core Platform

| Service | Doc | URL | Status |
|---------|-----|-----|--------|
| **REZ Backend (Monolith)** | [rez-backend.md](rez-backend.md) | `https://api.rezapp.com/api` | ✅ Live |
| **REZ Worker** | [rez-backend.md](rez-backend.md#3-architecture) | Render background worker (`PROCESS_ROLE=worker`) | ✅ Live |
| **API Gateway** | [rez-api-gateway.md](rez-api-gateway.md) | `https://rez-api-gateway.onrender.com` | ✅ Live |
| **rez-auth-service** | [rez-auth-service.md](rez-auth-service.md) | `https://rez-auth-service.onrender.com` | ✅ Live |
| **rez-wallet-service** | [rez-wallet-service.md](rez-wallet-service.md) | `https://rez-wallet-service-36vo.onrender.com` | ✅ Live |
| **rez-payment-service** | [rez-payment-service.md](rez-payment-service.md) | `https://rez-payment-service.onrender.com` | ✅ Live |
| **rez-finance-service** | [rez-finance-service.md](rez-finance-service.md) | Repo exists locally, not yet on Render | ⚠️ Deploy pending |
| **rez-order-service** | [rez-order-service.md](rez-order-service.md) | `https://rez-order-service.onrender.com` | ✅ Live |
| **rez-ads-service** | [rez-ads-service.md](rez-ads-service.md) | Not deployed (port 4007) | ⚠️ Deploy pending |

### Merchant & Commerce

| Service | Doc | URL | Status |
|---------|-----|-----|--------|
| **rez-merchant-service** | [rez-merchant-service.md](rez-merchant-service.md) | `https://rez-merchant-service-n3q2.onrender.com` | ✅ Live |
| **rez-catalog-service** | [rez-catalog-service.md](rez-catalog-service.md) | `https://rez-catalog-service-1.onrender.com` | ✅ Live |
| **rez-search-service** | [rez-search-service.md](rez-search-service.md) | `https://rez-search-service.onrender.com` | ✅ Live |
| **rez-marketing-service** | [rez-marketing-service.md](rez-marketing-service.md) | `https://rez-marketing-service.onrender.com` | ✅ Live |

### Intelligence & Engagement

| Service | Doc | URL | Status |
|---------|-----|-----|--------|
| **analytics-events** | [analytics-events.md](analytics-events.md) | `https://analytics-events-37yy.onrender.com` | ✅ Live |
| **rez-gamification-service** | [rez-gamification-service.md](rez-gamification-service.md) | `https://rez-gamification-service-3b5d.onrender.com` | ✅ Live |
| **rez-notification-events** | [rez-notification-events.md](rez-notification-events.md) | BullMQ worker (health :3001) | ✅ Live |
| **rez-media-events** | [rez-media-events.md](rez-media-events.md) | BullMQ worker + HTTP upload | ✅ Live |

### Hotel Vertical

| Service | Doc | URL | Status |
|---------|-----|-----|--------|
| **Hotel OTA API** | [hotel-ota-api.md](hotel-ota-api.md) | `https://hotel-ota-api.onrender.com` | ❌ Deploy failed — add `RAZORPAY_WEBHOOK_SECRET` in Render |
| **Hotel PMS Backend** | [hotel-pms-backend.md](hotel-pms-backend.md) | `https://hotel-management-xcsx.onrender.com` | ✅ Live |

### AdBazaar

| Service | Doc | URL | Status |
|---------|-----|-----|--------|
| **AdBazaar** | [adbazaar.md](adbazaar.md) | `https://ad-bazaar.vercel.app` | ✅ Live |

### B2B Platform

| Service | Doc | Repo | Status |
|---------|-----|------|--------|
| **RestaurantHub (Resturistan)** | [restauranthub.md](restauranthub.md) | `imrejaul007/restaurantapp` | ⚠️ Deploy pending — `render.yaml` ready |

### Partner Apps

| App | Doc | Repo | Status |
|-----|-----|------|--------|
| **Rendez** (social/dating) | [rendez.md](rendez.md) | `imrejaul007/Rendez` | ⚠️ Deploy pending — v1.0.0 tagged |

---

## Frontend Apps

### REZ Apps

| App | Doc | URL / Platform | Users |
|-----|-----|---------------|-------|
| **REZ Consumer App** | [frontend-apps.md](frontend-apps.md#rez-consumer-app) | Render (`rez-app-consumer-1`) + Expo EAS | End consumers |
| **REZ Merchant App** | [frontend-apps.md](frontend-apps.md#rez-merchant-app) | `https://merchant.rez.money` + Expo EAS | Merchants |
| **REZ Admin App** | [frontend-apps.md](frontend-apps.md#rez-admin-app) | `https://admin.rez.money` + Expo EAS | REZ ops |
| **REZ Web Menu** | [frontend-apps.md](frontend-apps.md#rez-web-menu) | `https://menu.rez.money` | Diners (QR scan) |

### Hotel OTA Apps (all documented in [hotel-ota-apps.md](hotel-ota-apps.md))

| App | URL | Users | Status |
|-----|-----|-------|--------|
| **StayOwn OTA Web** | `https://hotel-ota-ota-web-five.vercel.app` | Travellers | ✅ Live |
| **OTA Admin** | `https://hotel-ota-admin.vercel.app` | OTA operators | ✅ Live |
| **Hotel Panel** | Vercel (pending) | Hotel staff | ⚠️ Deploy pending |
| **Corporate Panel** | Vercel (pending) | Corporate travel managers | ⚠️ Scaffolded only |
| **OTA Mobile** | EAS iOS + Android | Travellers | ⚠️ Build pending |
| **Hotel PMS Frontend** | `https://rez-hotel-pms.onrender.com` | PMS users | ✅ Live |

---

## Quick Reference: Who Calls What

```
Consumer App  ──▶ API Gateway ──▶ microservices (per routing table)
              ──▶ rez-backend directly (auth, wallet, cashback, QR)

Merchant App  ──▶ API Gateway ──▶ rez-merchant-service, rez-catalog-service
              ──▶ rez-payment-service ──▶ Razorpay

Admin App     ──▶ API Gateway /api/admin/* ──▶ rez-backend monolith
              ──▶ analytics-events (dashboard)

Web Menu      ──▶ rez-catalog-service (menu items)
              ──▶ rez-backend /api/web-ordering/* (order + Razorpay)
              ──▶ rez-auth-service /auth/guest (guest JWT)

StayOwn Web   ──▶ hotel-ota-api /v1/*
OTA Mobile    ──▶ hotel-ota-api /v1/*
Hotel Panel   ──▶ hotel-ota-api /v1/hotel/*, /v1/pricing/*, /v1/mining/hotel/*
OTA Admin     ──▶ hotel-ota-api /v1/admin/*, /v1/mining/*, /v1/settlements/*
PMS Frontend  ──▶ hotel-pms-backend /api/*

AdBazaar      ──▶ Supabase (DB, auth, storage)
              ──▶ rez-backend POST /api/adbazaar/scan (coin credit)
              ──▶ POST /api/marketing/adbazaar/broadcast (via API gateway → rez-marketing-service)
                  OR POST /api/adbazaar/broadcast (monolith proxy handler → forwards to rez-marketing-service)

RestaurantHub ──▶ rez-merchant-service   (identity, shifts, POs)
              ──▶ rez-wallet-service     (credit score, balance)
              ──▶ rez-catalog-service    (product catalog)
              ──▶ analytics-events       (peer benchmarks)
              ←── rez-backend webhooks   (merchant-created, shift-gaps, hire-confirmed)

Rendez        ──▶ rez-backend /partner/v1/auth/verify (SSO — REZ JWT → Rendez JWT)
              ──▶ rez-wallet-service /partner/v1/wallet/:id/balance
              ──▶ rez-backend /partner/v1/gifts/transfer-coins
              ──▶ rez-merchant-service /partner/v1/merchants/nearby (meetup venues)
              ──▶ rez-backend /partner/v1/rewards/credit-meetup (earn coins)
              ←── rez-backend webhooks   (gift-redeemed, gift-expired, payment-completed)
```

---

## Quick Reference: BullMQ Queue Map

| Queue | Producer | Consumer | Job Types |
|-------|----------|----------|-----------|
| `gamification-events` | rez-backend | rez-gamification-service | visit_checked_in → achievements |
| `store-visit-events` | rez-backend | rez-gamification-service | visit → streak milestones |
| `notification-events` | rez-gamification-service, rez-marketing-service, rez-backend | rez-notification-events | push, email, SMS, WhatsApp |
| `catalog-events` | rez-catalog-service, rez-merchant-service | rez-catalog-service | product CRUD, stock alerts |
| `merchant-aggregation-scheduler` | cron (analytics-events) | analytics-events | nightly 2am UTC aggregation |
| `order-events` | rez-order-service | rez-order-service worker | wallet settlement, cancellation push |
| `campaign-jobs` | rez-marketing-service | rez-marketing-service | campaign send execution |

---

## Quick Reference: Shared Secrets

| Secret | Services That Must Match |
|--------|------------------------|
| `INTERNAL_SERVICE_TOKENS_JSON` + `x-internal-service` | All core REZ microservices (scoped service-to-service auth) |
| `INTERNAL_SERVICE_KEY` | rezbackend broadcasts.ts → rez-marketing-service (must match `INTERNAL_SERVICE_TOKENS_JSON['rez-backend']` on marketing-service) |
| `INTERNAL_SERVICE_TOKENS_JSON` | All microservices (scoped per-caller JSON map; monolith uses legacy `INTERNAL_SERVICE_TOKEN` single token) |
| `x-internal-token` | hotel-pms-backend → hotel-ota-api (legacy PMS integration) |
| `REZ_OTA_INTERNAL_TOKEN` | hotel-pms-backend → hotel-ota-api (PMS coins/inventory calls) |
| `PMS_WEBHOOK_SECRET` (OTA) = `REZ_OTA_WEBHOOK_SECRET` (PMS) | hotel-ota-api → hotel-pms-backend webhooks |
| `ADBAZAAR_WEBHOOK_SECRET` | rez-backend ↔ AdBazaar |
| `PARTNER_WEBHOOK_SECRET_FINBOX` | FinBox → rez-finance-service |
| `REZ_JWT_SECRET` | rez-backend ↔ Resturistan (REZ auth bridge SSO) |
| `REZ_INTERNAL_TOKEN` | Resturistan rez-client → REZ microservices (`x-internal-token`) |
| `REZ_PARTNER_API_KEY` | Rendez → rez-backend (`x-partner-key` header) |
| `REZ_WEBHOOK_SECRET` | rez-backend → Rendez webhooks (HMAC) |

---

## Architecture Reference

For the full system map, API gateway routing table, coin taxonomy, and integration sequence diagrams:  
→ [../ARCHITECTURE.md](../ARCHITECTURE.md)

For the integration runbook (Hotel OTA + AdBazaar step-by-step):  
→ [../INTEGRATION_RUNBOOK.md](../INTEGRATION_RUNBOOK.md)

For the full integration audit findings and fix log:  
→ [../INTEGRATION_FIXES.md](../INTEGRATION_FIXES.md)

---

## Environment Variable Master Reference

> All `sync: false` vars must be set manually in the Render dashboard. Values are never committed to Git.

### Secrets That Must Match Across Services

| Secret | Services (must be identical value) |
|--------|-------------------------------------|
| `JWT_SECRET` | rezbackend, rez-auth-service, rez-wallet-service, rez-payment-service, rez-search-service, rez-finance-service, rez-ads-service |
| `JWT_REFRESH_SECRET` | rezbackend, rez-auth-service |
| `JWT_MERCHANT_SECRET` | rezbackend, rez-auth-service, rez-payment-service, rez-merchant-service |
| `JWT_ADMIN_SECRET` | rezbackend, rez-auth-service |
| `MONGODB_URI` | All REZ microservices (shared Atlas cluster) |
| `REDIS_URL` | All REZ microservices (shared Valkey instance) |
| `INTERNAL_SERVICE_TOKEN` | rezbackend (inbound + outbound legacy auth) |
| `INTERNAL_SERVICE_KEY` | rezbackend broadcasts.ts outbound → must match `INTERNAL_SERVICE_TOKENS_JSON["rez-backend"]` on rez-marketing-service |
| `INTERNAL_SERVICE_TOKENS_JSON` | rez-auth-service, rez-wallet-service, rez-payment-service, rez-merchant-service, rez-catalog-service, rez-marketing-service, rez-order-service, rez-gamification-service, rez-media-events, analytics-events, rez-finance-service (strict — no fallback) |
| `ADBAZAAR_WEBHOOK_SECRET` | rezbackend (outbound HMAC to AdBazaar) AND AdBazaar Vercel (inbound verification) — must be same value |

### Secrets That Are Service-Specific (Different Per Service)

| Secret | Service | Purpose |
|--------|---------|---------|
| `OTP_HMAC_SECRET` | rezbackend | OTP generation/verification |
| `ENCRYPTION_KEY` | rezbackend | PII encryption at rest (32-byte hex) |
| `TOTP_ENCRYPTION_KEY` | rezbackend | Admin TOTP 2FA |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | rezbackend, rez-payment-service | REZ payment processing |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Hotel OTA | **Different Razorpay account** — hotel bookings only |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | adBazaar | **Different Razorpay account** — vendor payouts only |
| `ADBAZAAR_INTERNAL_KEY` | rez-marketing-service | Validates inbound calls from AdBazaar to marketing-service |
| `PMS_WEBHOOK_SECRET` | Hotel OTA | Inbound webhooks from Hotel PMS |
| `REZ_OTA_INTERNAL_TOKEN` | Hotel OTA ↔ Hotel PMS | Inter-service auth between OTA and PMS |
| `PARTNER_WEBHOOK_SECRET_FINBOX` | rez-finance-service | FinBox NBFC inbound webhook |
| `SUPABASE_SERVICE_ROLE_KEY` | adBazaar | Server-side Supabase admin operations |

### Mobile App Required Keys (set in EAS before each build)

| Key | App | Where to get |
|-----|-----|-------------|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Consumer, Merchant | Firebase Console → Project Settings |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | Consumer | Razorpay Dashboard → API Keys |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Consumer | Google Cloud Console |
| `EXPO_PUBLIC_CLOUDINARY_API_KEY` | Consumer | Cloudinary Dashboard |
