# REZ Food & Dining Ecosystem — Integration Map

## Overview

The REZ food & dining ecosystem connects six apps across two roles (customer-facing and merchant-facing):

| App | Role | Stack |
|---|---|---|
| **ReZ** (rezapp) | Bring customers — discovery, orders, loyalty | React Native + Node.js monolith |
| **RestoPapa** (Resturistan App) | Help retain restaurants — POS, menu, orders | NestJS + Prisma (PostgreSQL) |
| **Rendez** | Bring couples — dating app with meetup rewards | React Native + Express |
| **ReZ Merchant** (rezmerchant) | Operate the business — merchant dashboard | React Native |
| **ReZ Web Menu** (nuqta) | Customer convenience — web-based menu/ordering | Next.js |
| **AdBazaar** | Marketing — QR-based ad marketplace | Next.js + Supabase |

---

## 1. ReZ ↔ RestoPapa (Resturistan)

### Auth Bridge — SSO for Merchants

A REZ merchant can sign into RestoPapa without a separate account.

**Flow:**
```
RestoPapa client
  → POST /auth/rez-bridge  { rezToken }
  → RezBridgeController verifies REZ JWT locally (HS256, REZ_JWT_SECRET)
  → GET /api/internal/restopapa/merchant-profile  (bypasses nginx /api/merchant/* routing)
  → Upsert RestoPapa user (rezMerchantId as lookup key)
  → Return RestoPapa JWT
```

**Key files:**
- `Resturistan App/restauranthub/apps/api/src/modules/auth/rez-bridge/rez-bridge.controller.ts`
- `rezbackend/rez-backend-master/src/routes/restoPapaInternalRoutes.ts`

**Required env vars (RestoPapa):**
```
REZ_JWT_SECRET        — must match rezbackend JWT_SECRET
REZ_BACKEND_URL       — e.g. https://api.rezapp.com/api
REZ_INTERNAL_TOKEN    — must match rezbackend INTERNAL_SERVICE_TOKEN
```

**nginx note:** `/api/merchant/*` routes to `rez-merchant-service`, bypassing the monolith. The internal endpoint `/api/internal/restopapa/merchant-profile` is mounted directly on the monolith and is NOT subject to this nginx rule.

---

## 2. ReZ ↔ Rendez

### Partner API — Rendez calls REZ for data

Rendez calls REZ backend for user verification, merchant discovery, bookings, wallet operations, and coin rewards.

**Base path:** `POST/GET /api/rendez/*`
**Auth:** `x-partner-key: <RENDEZ_PARTNER_API_KEY>`

| Endpoint | Description |
|---|---|
| `GET /api/rendez/auth/verify-token` | Verify REZ user JWT, return user profile |
| `POST /api/rendez/auth/link` | Link Rendez user to REZ account |
| `GET /api/rendez/merchants/nearby` | Nearby REZ merchants (lat/lon query) |
| `POST /api/rendez/bookings/create` | Create a Rendez meetup booking at a REZ merchant |
| `POST /api/rendez/rewards/trigger` | Award meetup coins (50 REZ coins per user) |
| `GET /api/rendez/wallet/balance` | Get user REZ coin balance |
| `POST /api/rendez/wallet/hold` | Place a hold on REZ coins for meetup |
| `POST /api/rendez/wallet/release` | Release held coins |
| `POST /api/rendez/wallet/charge` | Charge held coins (finalize deduction) |
| `GET /api/rendez/partner/v1/bookings/:bookingId` | Get booking details |
| `GET /api/rendez/partner/v1/bookings` | List user bookings |
| `POST /api/rendez/partner/v1/bookings/:bookingId/confirm` | Confirm booking |
| `POST /api/rendez/partner/v1/bookings/:bookingId/cancel` | Cancel booking |
| `POST /api/rendez/partner/v1/coins/credit` | Credit coins to user wallet |
| `GET /api/rendez/gifts` | List user's CoinGifts |
| `POST /api/rendez/gifts` | Send a CoinGift |
| `GET /api/rendez/gifts/:giftId` | Get gift details |
| `POST /api/rendez/gifts/:giftId/claim` | Claim a gift |

**Key files:**
- `rezbackend/rez-backend-master/src/routes/rendezPartnerRoutes.ts`
- `rezbackend/rez-backend-master/src/middleware/rendezPartnerAuth.ts`

**Required env vars (rezbackend):**
```
RENDEZ_PARTNER_API_KEY   — shared secret for x-partner-key header auth
```

### Outbound Webhooks — REZ notifies Rendez

REZ fires fire-and-forget webhooks to Rendez for key events.

**Signature:** `x-rez-signature: sha256=<HMAC-SHA256 hex>`

| Event | Trigger | REZ File |
|---|---|---|
| `gift-redeemed` | User claims a CoinGift | `giftController.ts` |
| `gift-expired` | CoinGift expires unclaimed | `giftController.ts` |
| `payment-completed` | Razorpay payment verified | `razorpayController.ts` |
| `reward-triggered` | `partner_bonus` coins awarded | `rewardEngine` (via RewardTrigger) |

**Rendez receiver path:** `POST /webhooks/rez/<event-name>`

**Key files:**
- `rezbackend/rez-backend-master/src/services/rendezWebhookDispatch.ts`
- `Rendez/rendez-backend/src/routes/webhooks/rez.ts`
- `Rendez/rendez-backend/src/middleware/webhookVerify.ts`

**Required env vars (rezbackend):**
```
RENDEZ_BACKEND_URL       — e.g. https://rendez-backend.onrender.com
RENDEZ_WEBHOOK_SECRET    — HMAC secret (same value in Rendez env as REZ.WEBHOOK_SECRET)
```

**Required env vars (Rendez):**
```
REZ_WEBHOOK_SECRET       — must match RENDEZ_WEBHOOK_SECRET in rezbackend
```

**rawBody note:** Rendez's `express.json()` captures `req.rawBody` for HMAC verification. Re-serializing `req.body` breaks HMAC for non-ASCII payloads.

---

## 3. ReZ ↔ AdBazaar

### QR Scan → Coin Credit (AdBazaar calls REZ)

When a user scans an AdBazaar QR code, AdBazaar sends a webhook to REZ which credits coins.

**Endpoint:** `POST /api/adbazaar/webhook`
**Auth:** `x-internal-key: <ADBAZAAR_INTERNAL_KEY or REZ_INTERNAL_KEY>`

**Flow:**
```
AdBazaar QR scan
  → POST /api/adbazaar/webhook  { eventType: 'qr_scan', userId, campaignId, ... }
  → verifyAdBazaarSignature (HMAC-SHA256, ADBAZAAR_WEBHOOK_SECRET)
  → processQrScanEvent:
      1. Skip anonymous scans (no userId)
      2. Verify user exists and is active
      3. Deduplicate via AdBazaarScan.scanEventId
      4. rewardEngine.issue(amount, operationType: 'loyalty_credit', coinType: 'branded')
      5. Mark AdBazaarScan.coinsCredited = true
```

**Coin amount:** `ADBAZAAR_DEFAULT_SCAN_COINS` env var (default: 10)

### Store Visit / Purchase Attribution (REZ calls AdBazaar)

When a REZ user visits or purchases at a store linked to an AdBazaar campaign, REZ sends attribution data back.

**Trigger points:**
- `storeVisitController.ts` — on store visit event
- `orderUpdateController.ts` — on order status update

**Required env vars (rezbackend):**
```
ADBAZAAR_WEBHOOK_SECRET       — HMAC secret for incoming QR scan webhooks
ADBAZAAR_INTERNAL_KEY         — internal key for route auth (or REZ_INTERNAL_KEY as fallback)
ADBAZAAR_WEBHOOK_URL          — AdBazaar endpoint to receive attribution events
ADBAZAAR_DEFAULT_SCAN_COINS   — coins per QR scan (default: 10)
```

**Key files:**
- `rezbackend/rez-backend-master/src/services/adBazaarIntegration.ts`
- `rezbackend/rez-backend-master/src/routes/adBazaarIntegration.ts` (route file)
- `rezbackend/rez-backend-master/src/models/AdBazaarScan.ts`

---

## 4. ReZ ↔ ReZ Merchant

ReZ Merchant app uses the same rezbackend via the standard `/api/merchant/*` routes (proxied by nginx to `rez-merchant-service`). Authentication uses the REZ JWT with `role: merchant`.

**nginx routing note:** Requests to `/api/merchant/*` are routed to `rez-merchant-service`, NOT the monolith. New merchant endpoints must be added to `rez-merchant-service`, not the monolith.

---

## 5. ReZ ↔ ReZ Web Menu (nuqta)

nuqta is a Next.js web app that provides a browser-based menu and ordering experience. It communicates with rezbackend over the standard consumer API (`/api/v1/*`).

---

## Coin Flow Summary

All coin crediting flows through `rewardEngine.issue()`:

| Source | `operationType` | `coinType` | Description |
|---|---|---|---|
| AdBazaar QR scan | `loyalty_credit` | `branded` | Partner scan reward |
| Rendez meetup | `loyalty_credit` | `branded` | 50 coins per user per meetup |
| Referral bonus | `referral_bonus` | `loyalty` | Referral reward |
| Partner milestone | `partner_bonus` | `branded` | Triggers Rendez webhook |

**Important:** `operationType: 'credit'` is NOT a valid value. Use `loyalty_credit` for standard earning events.

---

## Webhook Signature Pattern

All cross-service webhooks use HMAC-SHA256:

```
signature = sha256_hmac(secret, rawBody)
header    = "sha256=" + hex(signature)   # outbound REZ→Rendez
header    = hex(signature)               # outbound REZ→AdBazaar (no prefix)
```

Always use the raw request body bytes for verification — never re-serialize `req.body`.

---

## Required Env Vars Checklist

### rezbackend
```
# Rendez integration
RENDEZ_PARTNER_API_KEY=
RENDEZ_BACKEND_URL=
RENDEZ_WEBHOOK_SECRET=

# AdBazaar integration
ADBAZAAR_WEBHOOK_SECRET=
ADBAZAAR_INTERNAL_KEY=
ADBAZAAR_WEBHOOK_URL=
ADBAZAAR_DEFAULT_SCAN_COINS=10

# RestoPapa bridge
INTERNAL_SERVICE_TOKEN=   # Used as REZ_INTERNAL_TOKEN on RestoPapa side
```

### Rendez backend
```
REZ_WEBHOOK_SECRET=       # Must match rezbackend RENDEZ_WEBHOOK_SECRET
REZ_PARTNER_API_KEY=      # Must match rezbackend RENDEZ_PARTNER_API_KEY (used by Rendez to call REZ)
```

### RestoPapa (Resturistan)
```
REZ_JWT_SECRET=           # Must match rezbackend JWT_SECRET
REZ_BACKEND_URL=          # rezbackend base URL
REZ_INTERNAL_TOKEN=       # Must match rezbackend INTERNAL_SERVICE_TOKEN
```

### AdBazaar
```
REZ_WEBHOOK_URL=          # rezbackend /api/adbazaar/webhook endpoint
REZ_WEBHOOK_SECRET=       # Must match rezbackend ADBAZAAR_WEBHOOK_SECRET
```

---

## Known Limitations / Future Work

- **Voucher provider APIs** (Amazon, Flipkart) are not yet integrated. `VoucherRedemptionService` throws 503 until real API keys and endpoints are configured. Wallet is never debited before the provider check.
- **BullMQ webhook queue** worker (`jobQueues.ts`) has a stub processor — direct HTTP dispatch (`rendezWebhookDispatch.ts`) bypasses it for Rendez events. Queue-based delivery with retry is a future enhancement.
- **AdBazaar attribution** `recordUserJourney()` stores analytics metadata but the DB persistence layer is not yet implemented.
- **`dispatchPaymentCompleted` merchantId** is not populated — requires an extra Order lookup to retrieve `store` field. Currently sent as `undefined`.
