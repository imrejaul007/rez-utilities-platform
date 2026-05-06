# QUICK REFERENCE — REZ Platform Developer Cheat Sheet

> Last updated: 2026-04-10
> For a developer picking up any ticket — open this first.

---

## "Where Is X?" — Feature-to-Code Lookup

| Feature | Where to Look |
|---------|--------------|
| **OTP send/verify (consumer)** | `rez-auth-service/src/routes/authRoutes.ts` → `sendOTPHandler`, `verifyOTPHandler` |
| **PIN login** | Same file → `loginPinHandler`. Lockout state in Redis keys `pin-lock:{userId}`, `pin-fail:{userId}` |
| **Consumer JWT auth middleware** | `rez-auth-service/src/middleware/auth.ts`, also `rezbackend/src/middleware/auth.ts` |
| **Merchant JWT auth middleware** | `rezbackend/src/middleware/merchantAuth.ts` |
| **Admin JWT auth middleware** | `rezbackend/src/middleware/auth.ts` → `requireAdmin` |
| **Internal service-to-service auth** | All services: `src/middleware/internalAuth.ts`. Checks `x-internal-token` header against `INTERNAL_SERVICE_TOKENS_JSON` |
| **Coin wallet balance** | `rez-wallet-service/src/routes/walletRoutes.ts` → `GET /api/wallet/balance` |
| **Credit coins to user** | `rez-wallet-service/src/routes/internalRoutes.ts` → `POST /internal/credit` |
| **Coin normalization ('nuqta' vs 'rez')** | `rez-wallet-service/src/routes/internalRoutes.ts:27` — `normalizeCoinType()` maps `rez` → `nuqta` and vice versa |
| **Razorpay payment initiation** | `rez-payment-service/src/routes/paymentRoutes.ts` → `POST /pay/initiate` |
| **Razorpay webhook handler** | Same file → `POST /pay/webhook/razorpay`. Receives raw body with HMAC verify |
| **Replay prevention (payments)** | Same file → `isReplayedPaymentId()` using Redis SET NX with 25h TTL |
| **Reward engine (daily caps)** | `rezbackend/src/core/rewardEngine.ts` |
| **Streak logic** | `rezbackend/src/services/streakService.ts` + `gamificationEventBus.ts` |
| **Daily check-in** | `rezbackend/src/routes/dailyCheckinRoutes.ts` + `dailyCheckinController.ts` |
| **Store search** | `rez-search-service/src/routes/searchRoutes.ts` + `rezbackend/src/routes/searchRoutes.ts` (monolith copy) |
| **Homepage personalization** | `rez-search-service/src/routes/homepageRoutes.ts` |
| **Order creation (consumer)** | `rezbackend/src/routes/orderRoutes.ts` → `POST /api/orders` |
| **Order status (merchant)** | `rez-merchant-service/src/routes/orders.ts` → `GET /orders/:id` |
| **Order lifecycle (worker)** | `rez-order-service/src/worker.ts` (BullMQ consumer) |
| **KDS real-time (orders → kitchen)** | `rezbackend/src/config/socketSetup.ts` → `/kds` namespace, room `kds:{storeId}` |
| **Web ordering (QR table scan)** | `rezbackend/src/routes/webOrderingRoutes.ts` — all `/api/web-ordering/*` paths |
| **Merchant dashboard** | `rez-merchant-service/src/routes/dashboard.ts` |
| **Campaign system** | `rez-marketing-service/src/routes/campaigns.ts` + `workers/campaignWorker.ts` |
| **Ad serving** | `rez-ads-service/src/routes/serve.ts` → `GET /ads/*` |
| **Bill payment** | `rez-finance-service/src/routes/payRoutes.ts` — Phase 1 stub (PENDING tx only) |
| **Loan offers** | `rez-finance-service/src/routes/borrowRoutes.ts` — FinBox integration |
| **Gamification achievements** | `rez-gamification-service/src/workers/achievementWorker.ts` (BullMQ) |
| **Visit streak** | `rez-gamification-service/src/workers/storeVisitStreakWorker.ts` (BullMQ) |
| **Hotel OTA booking** | `Hotel OTA/apps/api/src/routes/booking.routes.ts` |
| **Hotel coin attribution** | `rezbackend/src/routes/webhookRoutes.ts` → `POST /api/webhooks/hotel-attribution` |
| **AdBazaar QR attribution** | `rezbackend/src/routes/adBazaarIntegration.ts` |
| **Feature flags** | `rezbackend/src/routes/featureFlagConfig.ts` + admin toggle at `/api/admin/feature-flags` |
| **Referral system** | `rezbackend/src/routes/referralRoutes.ts` + `referralController.ts` |
| **Cashback rules** | `rezbackend/src/controllers/cashbackController.ts` |
| **Prive program** | `rezbackend/src/routes/priveRoutes.ts` + merchant: `rez-merchant-service/src/routes/priveModule.ts` |
| **Gold savings** | `rezbackend/src/routes/goldSavingsRoutes.ts`, `goldSipRoutes.ts` |
| **BullMQ job monitor** | `rezbackend/src/routes/admin/bullboard.ts` → `/api/admin/queues` |
| **Admin fraud queue** | `rezbackend/src/routes/admin/` → `adminFraudReportsRoutes`, `adminFraudConfigRoutes` |
| **Notification dispatch** | `rez-notification-events/src/` (BullMQ worker). Triggered from monolith `notificationController.ts` |
| **Media upload** | `rez-media-events/src/` (BullMQ worker) + `rezbackend/src/routes/photoUploadRoutes.ts` |

---

## "How Does X Work?" — Flow Summaries

### Consumer Login Flow

1. App calls `POST /auth/otp/send` with phone number. Auth service checks if user has PIN set — if yes, returns `hasPIN: true` and skips OTP (PIN login path).
2. OTP via SMS/WhatsApp. User verifies with `POST /auth/otp/verify` → auth service creates user if new, issues JWT access + refresh tokens.
3. Returning user with PIN: `POST /auth/login-pin`. 5-fail lockout (15 min), bcrypt compare.

**Files:** `rez-auth-service/src/routes/authRoutes.ts`

---

### Payment Flow (Consumer Order)

1. Consumer places order → monolith creates Order record, stores authoritative amount.
2. App calls `POST /pay/initiate` on rez-payment-service with `orderId` + `amount`. Service fetches authoritative amount from order service — client-supplied amount must match (prevents price tampering).
3. Razorpay order created. Frontend SDK collects payment.
4. App calls `POST /pay/capture` with Razorpay IDs. Replay prevention via Redis nonce. Signature verified.
5. On success: payment service calls `POST /internal/credit` on wallet service to issue coins.
6. Razorpay also sends `payment.captured` webhook — idempotent handler in `webhookHandler`.

**Files:** `rez-payment-service/src/routes/paymentRoutes.ts`, `paymentService.ts`, `razorpayService.ts`

---

### Coin Earning Flow

1. User triggers action (store visit, order, streak check-in).
2. Monolith publishes event to `gamificationEventBus.ts` → queued to `gamification:achievement` BullMQ queue.
3. `rez-gamification-service/achievementWorker.ts` processes — checks daily caps in Redis.
4. If cap not exceeded → calls `POST /internal/credit` on wallet service with idempotency key.
5. Wallet service credits `nuqta` coins (canonical type), stores in MongoDB `CoinTransaction`.

**Key gotcha:** `rewardEngine.ts` increments daily cap counter via `setImmediate` (post-credit) — narrow race window under high concurrency (REZ-011).

---

### Streak Flow

1. User checks in (QR scan or daily check-in → `POST /api/gamification/streak/checkin`).
2. `streakController.ts` updates `Streak` model in MongoDB — calculates consecutive days.
3. Milestone reached → `claimMilestone()` marks claimed but **does not credit coins** (REZ-006 — known bug).
4. Streak data pushed to gamification service via BullMQ for achievement unlock checks.

**Known bug:** Timezone not normalized to UTC — IST users may see incorrect day boundaries (REZ-010).

---

### Merchant Order Flow (KDS)

1. Consumer places order → monolith creates Order with `status: 'placed'`.
2. Socket.IO event emitted to KDS namespace (`/kds`) room `kds:{storeId}` → Kitchen Display System shows new order.
3. Merchant app updates order status via `PUT /api/merchant/orders/:id` → status transitions validated server-side.
4. State changes trigger notifications to consumer via `rez-notification-events` BullMQ queue.

**Key gotcha:** Web menu has NO socket connection — order status is HTTP-polled with delay (REZ-021).

---

### Hotel Coin Attribution Flow

1. Guest books hotel via Hotel OTA → booking confirmed.
2. Hotel OTA API sends webhook `POST /api/webhooks/hotel-attribution` to REZ monolith with booking details.
3. Monolith verifies HMAC signature, finds or creates REZ user by phone, credits coins via wallet service.
4. Attribution tracked in `HotelBooking` collection.

**Files:** `rezbackend/src/routes/webhookRoutes.ts`, `rezbackend/src/controllers/webhookController.ts`

---

### Internal Service Authentication

All service-to-service calls use `x-internal-token` header.

1. Caller passes `x-internal-token: <scoped_token>` from `INTERNAL_SERVICE_TOKENS_JSON`.
2. Receiving service's `middleware/internalAuth.ts` extracts caller identity from token map.
3. `requireInternalToken` middleware blocks with `401` if missing/invalid, `503` if server misconfigured.

**Legacy path:** `INTERNAL_SERVICE_TOKEN` (single shared token) — still accepted as fallback during migration. Remove when all services support scoped tokens.

---

## Common Gotchas / Known Issues

### Authentication

- **`coinType: 'nuqta'` vs `'rez'`** — The wallet internal routes normalize both to the same canonical type. But the consumer app (walletApi.ts) sends `'nuqta'` in transfers while some backend paths expect `'rez'`. Middleware normalizes but double-check transfer flows (REZ-007).
- **PIN lockout is Redis-backed** — If Redis restarts, lockout resets. This is intentional (fail-open for UX) but means a brief Redis outage clears all lockouts.
- **OTP channel selection** — Pass `channel: 'whatsapp'` in body to send via WhatsApp instead of SMS.

### Payments

- **Client-supplied amounts are NOT trusted** — `POST /pay/initiate` fetches authoritative amount from the order service. If order service is down, payment initiation fails. This is intentional security.
- **Webhook MUST receive raw body** — Razorpay webhook route is mounted with `express.raw()`, not `express.json()`. Any middleware adding JSON parsing before this route will break signature verification.
- **Nonce TTL is 25 hours** — Payment IDs are globally unique (Razorpay guarantee), so a 25h Redis TTL covers all retry windows. Local in-process fallback if Redis unavailable.

### Coins / Wallet

- **Coin types:** `nuqta` (general), `prive` (Prive members only), `branded` (merchant-specific), `promo` (promotional). The `'rez'` name is legacy — normalized to `'nuqta'` everywhere internally.
- **Streak milestone coins not credited** — Known bug REZ-006. `claimMilestone()` returns coin count but does NOT call `walletService.credit()`.
- **Daily coin caps use Redis counters** — Cap counters increment post-credit via `setImmediate`. Under high concurrency (5+ simultaneous requests), all may pass cap check before any counter increments.

### Search

- **19 search endpoints have no auth header** — Consumer app `storeSearchService.ts` has `// TODO: Add authentication token` on all 19 calls. Search works but is unauthenticated — no personalization, no per-user rate limits (REZ-004).
- **Search service vs monolith search** — Both exist. The monolith has its own search routes that proxy/mirror the search service. The API gateway routes `/search/*` to the microservice.

### Socket.IO

- **Consumer app has no socket client** — Order status updates for consumers are HTTP-polled, not real-time. The server-side room `user-{userId}` is set up but unused.
- **KDS accepts user JWTs** — The `/kds` namespace tries multiple JWT secrets. Should only accept `JWT_MERCHANT_SECRET`. See REZ-012.
- **Merchant transport order** — Merchant app uses `['polling', 'websocket']` (polling first). This adds 1-2 extra round trips on every connect/reconnect.

### Finance

- **Bill payment is Phase 1 stub** — `POST /finance/pay/bill` creates a PENDING transaction but coins are never awarded. Real gateway integration (Phase 2) is pending. Do not tell users coins will be awarded — they won't be until Phase 2.
- **Loan offers require FINBOX_API_KEY** — Without it, the service runs in stub mode returning static offers.

### Deployments

- **rez-ads-service is NOT deployed** — Built locally at port 4007 but has no Render deployment. Admin ad management and ad serving are offline in production.
- **rez-order-service HTTP is NOT deployed** — Worker is live but the HTTP server (`httpServer.ts`) has no Render deployment.
- **Firebase service account** — `firebase-service-account.json` must NEVER be committed. Inject at runtime via Render secret file or environment variable path.

### Rendez App (Separate Product)

- **All push notifications broken** — Deprecated FCM API (retired June 2024). See REZ-002.
- **OTP is simulated** — Any 6-digit code accepted in the Rendez login screen. See REZ-001.
- **Gift coin failures silent** — GiftService errors caught and swallowed. See REZ-003.

---

## Port Reference

| Service | Local Port | Health Port |
|---------|-----------|-------------|
| rez-marketing-service | 4000 | — |
| rez-payment-service | 4001 | 4101 |
| rez-auth-service | 4002 | 4102 |
| rez-finance-service | 4003 | 4103 |
| rez-wallet-service | 4004 | — |
| rez-merchant-service | 4005 | — |
| rez-search-service | 4006 | 4106 |
| rez-ads-service | 4007 | — |
| rez-gamification-service | 4008 | — |
| rez-order-service | 4005* | — |
| REZ Backend (monolith) | 5000 | — |
| API Gateway | 10000 | — |

*Note: rez-order-service and rez-merchant-service both default to port 4005 in their config. Ensure different ports in local dev.

---

## Key File Locations

| What | File |
|------|------|
| All backend routes registered | `rezbackend/rez-backend-master/src/config/routes.ts` |
| Backend server entry point | `rezbackend/rez-backend-master/src/server.ts` |
| Consumer app entry / navigation | `rezapp/nuqta-master/app/_layout.tsx` |
| Merchant app entry / navigation | `rezmerchant/rez-merchant-master/app/_layout.tsx` |
| Admin app entry / navigation | `rezadmin/rez-admin-main/app/_layout.tsx` |
| Reward engine (coin issuance) | `rezbackend/rez-backend-master/src/core/rewardEngine.ts` |
| Gamification event bus | `rezbackend/rez-backend-master/src/events/gamificationEventBus.ts` |
| Socket.IO setup | `rezbackend/rez-backend-master/src/config/socketSetup.ts` |
| Shared types package | `packages/rez-shared/src/` |
| Docker compose (microservices) | `docker-compose.microservices.yml` |

---

## Running Locally

```bash
# Start all microservices
docker-compose -f docker-compose.microservices.yml up

# Start backend monolith
cd rezbackend/rez-backend-master && npm run dev

# Start consumer app
cd rezapp/nuqta-master && npx expo start

# Start merchant app
cd rezmerchant/rez-merchant-master && npx expo start

# Start admin app
cd rezadmin/rez-admin-main && npx expo start
```

## Testing

```bash
# Run all microservice tests
npm test  # from root (workspace)

# Run specific service tests
cd rez-payment-service && npm test
cd rez-wallet-service && npm test
cd rez-order-service && npm test
```

## Useful Internal Endpoints for Debugging

```bash
# Wallet balance for any user (internal)
curl -H "x-internal-token: $TOKEN" https://rez-wallet-service-36vo.onrender.com/internal/balance/{userId}

# Payment status (internal)
curl -H "x-internal-token: $TOKEN" https://rez-payment-service.onrender.com/internal/pay/{paymentId}

# All service health checks
curl https://rez-auth-service.onrender.com/health
curl https://rez-wallet-service-36vo.onrender.com/health
curl https://rez-payment-service.onrender.com/health
curl https://rez-finance-service.onrender.com/health
curl https://rez-search-service.onrender.com/health
curl https://rez-merchant-service-n3q2.onrender.com/health
curl https://rez-gamification-service-3b5d.onrender.com/health
```
