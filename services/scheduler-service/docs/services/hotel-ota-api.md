# Hotel OTA API

## 1. Purpose, Tech Stack, and Architecture Position

The Hotel OTA API is the central booking engine for the REZ hotel vertical. It is a TypeScript/Express REST API that serves three distinct client surfaces simultaneously: the OTA consumer web/app, the REZ App (via a dedicated partner route), and connected Hotel PMS backends. It owns the entire booking lifecycle from inventory search through payment confirmation through hotel checkout, as well as the three-tier coin economy.

### Position in the REZ System

```
REZ App ──────────────────────────────────────────────────────┐
  (partner API key, /v1/partner/rez/*)                        │
                                                              ▼
OTA Web / OTA Mobile ──────────────────────────── Hotel OTA API (this service)
  (JWT auth, /v1/auth, /v1/bookings, /v1/wallet)              │
                                                              │  HMAC webhook push
Hotel Panel ─── JWT (staff) ──── /v1/hotel/*                 ▼
Admin Panel ─── JWT (admin) ──── /v1/admin/*         Hotel PMS Backend
                                                              │
Hotel PMS Backend ─── x-internal-token ──── /v1/partner/pms/* │
  (coins/earn, inventory updates)                             │
                                                              ▼
                                                   rez-auth-service (SSO)
                                                   rez-wallet-service (balance sync)
                                                   Razorpay (payments)
                                                   Upstash Redis (BullMQ)
                                                   PostgreSQL / Render (primary DB)
```

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 22, TypeScript 5.6 |
| Framework | Express 4.21 |
| ORM | Prisma 5.22 (PostgreSQL) |
| Database | PostgreSQL (Render, Singapore region) |
| Queue / Cache | Upstash Redis via ioredis + BullMQ 5.21 |
| Payments | Razorpay 2.9 |
| Auth | jsonwebtoken 9.0 (HS256), bcryptjs |
| Validation | Zod 3.23 |
| HTTP Client | Axios 1.7 |
| Security | Helmet, cors, input sanitization middleware |
| Image Storage | AWS S3 (ap-south-1) |
| Email | SendGrid |
| SMS / OTP | MSG91 |
| Date math | Day.js |

### Monorepo Structure

```
Hotel OTA/
  apps/
    api/           <-- this service
    ota-web/
    admin/
  packages/
    database/      <-- shared Prisma schema + generated client
```

---

## 2. API Routes

All routes are prefixed with `/v1`. The server also exposes `/api/webhooks/*` for inbound webhooks from Razorpay and PMS.

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | None | Returns `{ status: "ok", timestamp }` |

---

### Auth (`/v1/auth`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | /auth/send-otp | None | `otpRateLimiter` | Send OTP to 10-digit mobile |
| POST | /auth/verify-otp | None | None | Verify OTP, issue JWT + refresh token |
| POST | /auth/refresh | None | None | Exchange refresh token for new access token |
| POST | /auth/rez-sso | None | None | SSO via REZ access token (2-step verify + create/link user) |
| POST | /auth/hotel/send-otp | None | `otpRateLimiter` | Send OTP to hotel staff phone |
| POST | /auth/hotel/verify-otp | None | None | Hotel staff OTP verify, returns staff JWT |
| POST | /auth/admin/login | None | `adminRateLimiter` | Email/password login for admin panel |

**POST /auth/send-otp**
```json
Request:  { "phone": "9876543210" }
Response: { "otp_ref": "abc123", "expires_in_seconds": 300 }
          // dev only: + "dev_otp": "123456"
```

**POST /auth/verify-otp**
```json
Request:  { "phone": "9876543210", "otp": "123456", "otp_ref": "abc123" }
Response: {
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": "uuid",
    "phone": "9876543210",
    "full_name": "Raj Kumar",
    "tier": "basic",
    "ota_coin_balance_paise": 50000,
    "is_new_user": false
  }
}
```

**POST /auth/rez-sso** — See Section 7 for full SSO flow details.
```json
Request:  { "rez_access_token": "eyJ..." }
Response: {
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": "uuid",
    "phone": "9876543210",
    "full_name": "Raj Kumar",
    "tier": "basic",
    "ota_coin_balance_paise": 50000,
    "rez_coin_balance_paise": 25000,
    "is_new_user": false
  }
}
```

---

### Hotels (`/v1/hotels`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | /hotels/search | None | `searchRateLimiter` | Search hotels by city + dates |
| GET | /hotels/:hotel_id | None | None | Hotel detail |

**GET /hotels/search**
```
Query params (required): city, checkin (YYYY-MM-DD), checkout (YYYY-MM-DD)
Query params (optional): rooms, guests, category, min_rate, max_rate,
                          lat, lng, radius_km, sort, page, per_page
Response: { hotels: [...], total, page }
```

---

### Bookings (`/v1/bookings`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | /bookings/hold | JWT user | `bookingRateLimiter` | Create a 10-min inventory hold + Razorpay order |
| POST | /bookings/confirm | JWT user | None | Verify Razorpay signature, confirm booking, earn coins |
| GET | /bookings | JWT user | None | List user bookings (paginated) |
| GET | /bookings/:booking_id | JWT user | None | Booking detail |
| POST | /bookings/:booking_id/cancel | JWT user | None | Cancel booking |

**POST /bookings/hold**
```json
Request: {
  "hotel_id": "uuid",
  "room_type_id": "uuid",
  "checkin_date": "2025-01-15",
  "checkout_date": "2025-01-17",
  "num_rooms": 1,
  "num_guests": 2,
  "guest_name": "Raj Kumar",
  "guest_phone": "9876543210",
  "special_requests": "Late check-in",
  "channel_source": "ota_app",          // ota_app | rez_app | corporate | hotel_qr
  "ota_coin_burn_paise": 10000,
  "rez_coin_burn_paise": 5000,
  "hotel_brand_coin_burn_paise": 0
}
Response: {
  "hold_id": "uuid",
  "booking_ref": "OTA2501XXXXX",
  "expires_at": "2025-01-15T10:10:00Z",
  "room_rate_paise": 300000,
  "total_value_paise": 600000,
  "ota_coin_applied_paise": 10000,
  "rez_coin_applied_paise": 5000,
  "pg_amount_paise": 585000,
  "razorpay_order_id": "order_XXXXXX",
  "finance_offer": null                 // BNPL offer if eligible
}
```

**POST /bookings/confirm**
```json
Request: {
  "hold_id": "uuid",
  "razorpay_payment_id": "pay_XXXXX",
  "razorpay_signature": "hex_signature"
}
Response: {
  "booking_id": "uuid",
  "booking_ref": "OTA2501XXXXX",
  "status": "confirmed",
  "hotel_name": "The Grand",
  "checkin_date": "2025-01-15",
  "checkout_date": "2025-01-17",
  "voucher_url": "https://...",
  "ota_coin_earned_paise": 18000,
  "rez_coin_earned_paise": 6000,
  "ota_coin_new_balance_paise": 68000
}
```

---

### Wallet (`/v1/wallet`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /wallet | JWT user | Full wallet: OTA + REZ + hotel brand balances; triggers fire-and-forget REZ sync |
| GET | /wallet/transactions | JWT user | Paginated coin transaction history (filterable by coin_type) |
| POST | /wallet/check-burn | JWT user | Validate coin burn amounts against limits before hold |

**POST /wallet/check-burn**
```json
Request: {
  "booking_value_paise": 600000,
  "ota_coin_requested_paise": 60000,
  "rez_coin_requested_paise": 30000,
  "hotel_brand_coin_requested_paise": 20000,
  "hotel_id": "uuid"
}
Response: {
  "ota_coin_applicable_paise": 60000,
  "rez_coin_applicable_paise": 30000,
  "hotel_brand_coin_applicable_paise": 20000,
  "total_discount_paise": 110000,
  "pg_amount_paise": 490000,
  "ota_cap_applied": false,
  "ota_cap_reason": null
}
```

---

### Partner — REZ App (`/v1/partner/rez`)

Requires `authenticatePartner` middleware (API key via header). All routes apply `partnerRateLimiter`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /partner/rez/hotels/search | API key | Hotel search with REZ attribution tracking |
| POST | /partner/rez/bookings/hold | API key | Hold booking on behalf of REZ user |
| POST | /partner/rez/bookings/confirm | API key | Confirm held booking |
| GET | /partner/rez/bookings/:booking_id | API key | Booking detail |
| POST | /partner/rez/wallet/sync | API key | REZ pushes updated coin balance for linked user |

The `/partner/rez/bookings/hold` endpoint accepts `rez_session_id`, `rez_user_id`, and optional `rez_campaign_id` in addition to standard booking fields. It auto-creates an OTA user record if the REZ user ID has not been seen before and sets `attributionSource = 'rez_app'`.

---

### Partner — Hotel PMS (`/v1/partner/pms`)

Server-to-server only. Authenticated by `x-internal-token` header (constant-time compare against `REZ_OTA_INTERNAL_TOKEN` or `INTERNAL_SERVICE_TOKEN`).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /partner/pms/coins/earn | x-internal-token | PMS calls on guest checkout to award hotel brand coins |
| PUT | /partner/pms/inventory/:hotelId/:roomTypeId/:date | x-internal-token | PMS pushes rate/availability update |

**POST /partner/pms/coins/earn**
```json
Request: {
  "user_id": "ota-uuid",
  "hotel_id": "ota-uuid",
  "booking_id": "pms-booking-ref",
  "booking_value_paise": 500000,
  "coin_type": "hotel_brand",
  "source": "pms_checkout"
}
Response: {
  "awarded": true,
  "coin_type": "hotel_brand",
  "coin_name": "Heritage Points",
  "amount_paise": 25000,
  "hotel_id": "uuid",
  "user_id": "uuid",
  "source": "pms_checkout"
}
// awarded: false + reason if program not enabled or no rule
```

**PUT /partner/pms/inventory/:hotelId/:roomTypeId/:date**
```json
Request: {
  "available_rooms": 5,
  "rate_paise": 350000,
  "is_blocked": false
}
Response: {
  "hotel_id": "uuid",
  "room_type_id": "uuid",
  "date": "2025-01-15",
  "available_rooms": 5,
  "rate_paise": 350000,
  "is_blocked": false
}
```

---

### Hotel Panel (`/v1/hotel`)

Requires `authenticateHotelStaff` JWT middleware. Every route is scoped to `req.hotelStaff.hotelId`.

| Method | Path | Description |
|--------|------|-------------|
| GET | /hotel/dashboard | Monthly KPIs: bookings, revenue, pending settlement |
| GET | /hotel/inventory | Inventory grid for date range |
| PUT | /hotel/inventory/:room_type_id/:date | Update availability, rate, or block flag |
| GET | /hotel/bookings | Paginated bookings with filters |
| POST | /hotel/bookings/:booking_id/checkin | Check in guest; fires PMS webhook |
| POST | /hotel/bookings/:booking_id/checkout | Check out guest; fires PMS webhook |
| GET | /hotel/bookings/today-checkins | All arrivals for today |
| GET | /hotel/bookings/today-checkouts | All departures for today |
| GET | /hotel/analytics | Last-30-day daily revenue breakdown |
| GET | /hotel/settlement | Paginated settlement statement |
| POST | /hotel/images/upload | Upload hotel image (base64 or URL) |
| DELETE | /hotel/images | Remove image by URL |
| GET | /hotel/brand-coin/program | View brand coin config + earn/burn rules |
| PUT | /hotel/brand-coin/program | Update brand coin name, symbol, earn %, burn % |
| GET | /hotel/brand-coin/members | Paginated member loyalty balances |
| PUT | /hotel/pms-sync | Save PMS backend URL for inventory sync |

---

### Admin Panel (`/v1/admin`)

Requires `authenticateAdmin` JWT middleware + `adminRateLimiter`.

| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/overview | Platform KPIs: GMV today/month, bookings, coin liability |
| GET | /admin/users | Paginated user list with coin balances |
| GET | /admin/users/:id | User detail with booking and coin history |
| PUT | /admin/users/:id/suspend | Suspend user account |
| POST | /admin/users/:id/coin-adjust | Manual coin credit/debit |
| GET | /admin/burn-rules | List all burn rules |
| POST | /admin/burn-rules | Create burn rule |
| PUT | /admin/burn-rules/:id | Update burn rule |
| GET | /admin/earn-rules | List all earn rules |
| POST | /admin/earn-rules | Create earn rule |
| PUT | /admin/earn-rules/:id | Update earn rule |
| GET | /admin/hotels | List hotels with status filter |
| PUT | /admin/hotels/:id/status | Set hotel onboarding status |
| PATCH | /admin/hotels/:id/brand-coin | Enable/disable hotel brand coin program |
| GET | /admin/bookings | Platform-wide booking list |
| GET | /admin/coin-liability | Aggregate coin liability across all wallet types |
| GET | /admin/settlements | List payout batches |
| POST | /admin/settlements/approve-batch | Mark settlement batch as completed |
| GET | /admin/stay-registrations/pending | Offline stay receipt queue |
| PUT | /admin/stay-registrations/:id/approve | Approve + award coins |
| PUT | /admin/stay-registrations/:id/reject | Reject registration |
| GET | /admin/bill-payments | All offline bill payments |

---

### Webhooks (inbound)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/webhooks/razorpay | HMAC-SHA256 (`x-razorpay-signature`) | Handles `payment.failed` and `order.paid` |
| POST | /api/webhooks/pms | x-webhook-signature HMAC | Receives events pushed by PMS to OTA |

The Razorpay webhook router uses `express.json({ verify })` to capture the raw body before JSON parsing, which is required for accurate HMAC verification.

---

## 3. Background Jobs / Workers (BullMQ)

All queues and workers connect to Upstash Redis (`REDIS_URL`). Workers are started in `src/jobs/workers.ts` which is imported by `src/index.ts` at startup.

### BullMQ Queues

| Queue Name | Trigger | Worker Behavior |
|------------|---------|-----------------|
| `hold-expiry` | Enqueued per booking on hold with a 10-min delay | Releases inventory slots (raw SQL), voids booking, reverses all coin burns |
| `coin-expiry` | Cron: daily at 02:00 UTC | Processes `CoinExpirySchedule` rows due today; expires OTA and hotel_brand coins; writes debit `CoinTransaction` |
| `settlement-batch` | Cron: daily at 03:00 UTC | Calls `SettlementService.processSettlementBatch()` to create T+1 payout batches |
| `tier-update` | Cron: 1st of month at 01:00 UTC | Recalculates user tiers from 12-month rolling stay/spend data |
| `monthly-mining` | Cron: 1st of month at 04:00 UTC | `MiningService.runMiningCycle()` — distributes ownership units based on HCS |
| `vesting-checker` | Implicit — see scheduler | Unlocks vested ownership tokens |
| `reconciliation` | Nightly | Finds and fixes stuck holds, missed checkouts, missing settlements |
| `no-show-processor` | Implicit | Marks overdue confirmed bookings as no_show |
| `pms-inventory-sync` | Bootstrap at startup + self-re-enqueues every 15 min | Polls each active hotel's PMS URL for inventory data and upserts into `inventory_slots` |

### PMS Inventory Sync Bootstrap

On startup (with a 10-second delay), `bootstrapPmsSyncJobs()` queries all active hotels where `pmsWebhookUrl IS NOT NULL` and enqueues one `pms-inventory-sync` job per hotel (delayed 30s). Each job self-re-enqueues after completion with a 15-minute delay, or 5-minute backoff on error.

### Scheduled Job Summary

| Schedule | Job | Notes |
|----------|-----|-------|
| `*/30 * * * *` | pms-inventory-sync (per hotel) | Every 30 min via BullMQ repeat |
| `0 2 * * *` | coin-expiry | Daily 2 AM UTC |
| `0 3 * * *` | settlement-batch | Daily 3 AM UTC |
| `0 1 1 * *` | tier-update | Monthly on 1st |
| `0 4 1 * *` | monthly-mining | Monthly on 1st |

---

## 4. Security Mechanisms

### JWT Authentication (three separate secrets)

| Context | Header | Secret Env Var | Expiry |
|---------|--------|----------------|--------|
| Guest users | `Authorization: Bearer <token>` | `JWT_SECRET` | `JWT_EXPIRY` (default 3600s) |
| Hotel staff | `Authorization: Bearer <token>` | `JWT_SECRET` | Same |
| Admin panel | `Authorization: Bearer <token>` | `ADMIN_JWT_SECRET` | Separate |
| Refresh tokens | Body `refresh_token` | `REFRESH_TOKEN_SECRET` | `REFRESH_TOKEN_EXPIRY` (default 30 days) |

### Partner API Key (REZ App routes)

`authenticatePartner` middleware reads an API key from the `Authorization` or `x-api-key` header and validates it against `HotelApiKey` records in the database.

### PMS Internal Token (`x-internal-token`)

Used on `/v1/partner/pms/*` routes. The token is compared with `crypto.timingSafeEqual` against `REZ_OTA_INTERNAL_TOKEN` (falls back to `INTERNAL_SERVICE_TOKEN`). Length mismatch short-circuits before the timing-safe compare to prevent panic. In dev mode without a configured token, the check is skipped with a console warning.

### HMAC-SHA256 Webhooks

**Razorpay → OTA** (`/api/webhooks/razorpay`):
- Raw body captured via `express.json({ verify })` hook
- HMAC-SHA256 computed with `RAZORPAY_WEBHOOK_SECRET`
- Signature compared with `crypto.timingSafeEqual`

**OTA → PMS** (outbound, `PmsWebhookService`):
- `PMS_WEBHOOK_SECRET` used to sign: `HMAC-SHA256(JSON.stringify({ event, data }))`
- Signature sent as `x-webhook-signature` header
- PMS verifies using `REZ_OTA_WEBHOOK_SECRET` (must be the same value)

### Input Sanitization

Global `sanitizeInput` middleware runs on every request before route handlers.

### CORS

In production, `cors()` only allows origins from `FRONTEND_URL`, `HOTEL_PANEL_URL`, and `ADMIN_PANEL_URL` env vars.

### Rate Limiters (express-rate-limit)

| Limiter | Applied To | Purpose |
|---------|-----------|---------|
| `otpRateLimiter` | send-otp routes | Prevent OTP spam |
| `adminRateLimiter` | admin login | Brute-force protection |
| `bookingRateLimiter` | POST /bookings/hold | Prevent duplicate holds |
| `searchRateLimiter` | GET /hotels/search | Search abuse protection |
| `partnerRateLimiter` | /partner/rez/* | Partner API fair use |

---

## 5. Environment Variables

### Required in All Environments

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Upstash Redis connection URL |

### Required in Production

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | HS256 signing secret for user JWTs (must not contain "dev") |
| `REFRESH_TOKEN_SECRET` | Refresh token signing secret |
| `ADMIN_JWT_SECRET` | Admin panel JWT signing secret |
| `INTERNAL_SERVICE_TOKEN` | Shared internal service token (used in `x-internal-token` calls to rez-auth-service) |
| `REZ_OTA_INTERNAL_TOKEN` | Internal token accepted by the `/v1/partner/pms` routes |
| `PMS_WEBHOOK_SECRET` | HMAC secret for outbound OTA→PMS webhooks |
| `REZ_AUTH_SERVICE_URL` | Base URL of rez-auth-service (e.g. `https://auth.rez.money`) |
| `REZ_WALLET_SERVICE_URL` | Base URL of rez-wallet-service |
| `RAZORPAY_KEY_ID` | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay API key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook HMAC secret |

### Optional / With Defaults

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP listen port |
| `NODE_ENV` | `development` | Affects CORS, env validation strictness |
| `JWT_EXPIRY` | `3600` | Access token TTL in seconds |
| `REFRESH_TOKEN_EXPIRY` | `2592000` | Refresh token TTL (30 days) |
| `REZ_API_KEY` | `''` | API key for outbound REZ calls |
| `REZ_API_BASE_URL` | `''` | Base URL for REZ platform API |
| `REZ_WEBHOOK_SECRET` | `''` | Secret for inbound REZ webhooks |
| `REZ_COIN_TO_RUPEE_RATE` | `0.50` | REZ coin value conversion (coins × rate × 100 = paise) |
| `FINANCE_SERVICE_URL` | `''` | URL for rez-finance-service (BNPL offers) |
| `PMS_API_URL` | `''` | Default PMS backend URL for outbound webhooks |
| `MSG91_API_KEY` | `''` | MSG91 key for OTP SMS |
| `MSG91_SENDER_ID` | `''` | MSG91 sender ID |
| `AWS_ACCESS_KEY` | `''` | S3 upload credentials |
| `AWS_SECRET_KEY` | `''` | S3 upload credentials |
| `AWS_S3_BUCKET` | `''` | S3 bucket name |
| `AWS_REGION` | `ap-south-1` | AWS region |
| `SENDGRID_API_KEY` | `''` | Email sending |
| `FRONTEND_URL` | — | CORS allowlist |
| `HOTEL_PANEL_URL` | — | CORS allowlist |
| `ADMIN_PANEL_URL` | — | CORS allowlist |

---

## 6. Data Models (PostgreSQL — Key Tables)

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | gen_random_uuid() |
| `phone` | varchar(15) UNIQUE | 10-digit normalized |
| `email` | varchar(255) UNIQUE | optional |
| `full_name` | varchar(255) | |
| `tier` | enum(basic, silver, gold) | Updated monthly by tier-update job |
| `rez_user_id` | varchar(255) | REZ platform user ID; written on SSO |
| `attribution_source` | enum | ota_app / rez_app / corporate / hotel_qr / seo / direct |
| `is_active` | boolean | false = suspended |

### `hotels`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `slug` | varchar UNIQUE | URL-safe identifier |
| `onboarding_status` | enum | pending / active / suspended / churned |
| `ota_commission_pct` | decimal(4,2) | Default 6% |
| `brand_coin_enabled` | boolean | Master switch for hotel brand coin program |
| `brand_coin_name` | varchar(100) | e.g. "Heritage Points" |
| `brand_coin_symbol` | varchar(20) | e.g. "HP" |
| `pms_webhook_url` | varchar(500) | PMS backend base URL for webhook push and inventory sync |
| `mining_eligible` | boolean | Eligible for monthly ownership mining |

### `room_types`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `hotel_id` | UUID FK → hotels | |
| `base_rate_paise` | int | Default rate when no inventory slot exists |
| `max_occupancy` | smallint | |
| `is_active` | boolean | |

### `inventory_slots`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `hotel_id` | UUID FK | |
| `room_type_id` | UUID FK | |
| `date` | date | One row per room-type per date |
| `total_rooms` | smallint | Physical capacity |
| `available_rooms` | smallint | Decremented on hold, incremented on cancel/expire |
| `rate_paise` | int | Overrides base_rate for this date |
| `is_blocked` | boolean | |
| **Unique** | (room_type_id, date) | Prevents duplicate slots |
| **Index** | (hotel_id, date) | Search performance |

### `bookings`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Doubles as hold_id |
| `booking_ref` | varchar(20) UNIQUE | Human-readable e.g. OTA2501XXXXX |
| `status` | enum | init → hold → confirmed → checked_in → stayed / cancelled / no_show |
| `channel_source` | enum | ota_app / rez_app / corporate / hotel_qr |
| `ota_coin_burned_paise` | int | Coins deducted at hold time |
| `rez_coin_burned_paise` | int | |
| `hotel_brand_coin_burned_paise` | int | |
| `pg_amount_paise` | int | Amount charged to payment gateway |
| `total_value_paise` | int | Full booking value before coin discount |
| `razorpay_order_id` | varchar | Created at hold time |
| `razorpay_payment_id` | varchar | Written on confirm |
| `hold_expires_at` | timestamptz | Set 10 min ahead; BullMQ job fires at expiry |
| `stay_completed_flag` | boolean | Set on checkout event |

### Coin System Tables

**`coin_wallets`** — one per user

| Column | Notes |
|--------|-------|
| `ota_coin_balance_paise` | OTA-issued coins |
| `rez_coin_balance_paise` | Mirror of REZ wallet (synced, not earned here) |
| `ota_coin_lifetime_earned_paise` | Running total |
| `ota_coin_lifetime_burned_paise` | Running total |

**`hotel_brand_coin_balances`** — one per (user, hotel)

| Column | Notes |
|--------|-------|
| `balance_paise` | Current brand coin balance at this hotel |
| `lifetime_earned_paise` | |
| `lifetime_burned_paise` | |

**`coin_transactions`** — full audit ledger

| Column | Notes |
|--------|-------|
| `coin_type` | ota / rez / hotel_brand |
| `transaction_type` | earn / burn / expire / refund_credit / admin_adjust / earn_reversal |
| `direction` | credit / debit |
| `balance_after_paise` | Snapshot for reconciliation |
| `hotel_id` | Populated for hotel_brand transactions |

**`earn_rules`** — configurable per coin type / hotel / channel / tier / campaign

| Column | Notes |
|--------|-------|
| `earn_pct` | decimal: percentage of booking value to award |
| `channel_source` | ota_app / rez_app / corporate / hotel_qr / all |
| `user_tier` | basic / silver / gold / all |
| `hotel_id` | null = platform-wide rule |
| `campaign_id` | highest-priority rule type |
| `min_booking_value_paise` | Eligibility floor |
| `max_earn_per_booking_paise` | Cap per booking |
| `valid_from` / `valid_until` | Date window |

**`burn_rules`** — max burn percentage per coin type / tier / hotel

| Column | Notes |
|--------|-------|
| `coin_type` | ota / rez / hotel_brand |
| `max_burn_pct` | e.g. 15.00 = up to 15% of booking value |
| `min_cash_pct` | Minimum cash payment required |
| `user_tier` | all or specific tier |
| `hotel_id` | null = platform-wide |

**`coin_expiry_schedules`** — tracks scheduled expiry per earn event

| Column | Notes |
|--------|-------|
| `coin_type` | ota or hotel_brand |
| `expiry_date` | 12 months from earn date |
| `status` | pending / expired / used |
| `source_transaction_id` | FK → coin_transactions |

---

## 7. Cross-System Integration

### 7.1 REZ SSO Flow

The REZ App embeds a WebView that calls the Hotel OTA. Before making any booking API call, the REZ App exchanges its own access token for an OTA JWT via `POST /v1/auth/rez-sso`.

```
REZ App                     Hotel OTA API             rez-auth-service
   │                              │                          │
   │  POST /v1/auth/rez-sso       │                          │
   │  { rez_access_token }        │                          │
   │─────────────────────────────>│                          │
   │                              │  GET /auth/validate      │
   │                              │  Authorization: Bearer   │
   │                              │─────────────────────────>│
   │                              │  { valid: true, userId } │
   │                              │<─────────────────────────│
   │                              │                          │
   │                              │  GET /internal/auth/user/:userId
   │                              │  x-internal-token: ***   │
   │                              │─────────────────────────>│
   │                              │  { id, phone, name, role }
   │                              │<─────────────────────────│
   │                              │                          │
   │                              │  [find/create OTA user by phone]
   │                              │  [sync REZ wallet balance]
   │                              │  [issue OTA JWT + refresh]
   │                              │                          │
   │  { access_token,             │                          │
   │    rez_coin_balance_paise,   │                          │
   │    is_new_user }             │                          │
   │<─────────────────────────────│                          │
```

Phone normalization: REZ sends E.164 (+918011549915); OTA normalizes to 10 digits (8011549915) before lookup.

### 7.2 Booking Confirmation Flow (OTA → PMS)

```
User                Hotel OTA API           Razorpay            Hotel PMS
  │                      │                     │                     │
  │  POST /bookings/hold │                     │                     │
  │─────────────────────>│                     │                     │
  │                      │  [lock inventory]   │                     │
  │                      │  [burn coins]       │                     │
  │                      │  create Razorpay order                    │
  │                      │─────────────────────>                     │
  │  { razorpay_order_id }                     │                     │
  │<─────────────────────│                     │                     │
  │                      │                     │                     │
  │  [User pays via Razorpay checkout]         │                     │
  │                      │                     │                     │
  │  POST /bookings/confirm                    │                     │
  │  { razorpay_payment_id, signature }        │                     │
  │─────────────────────>│                     │                     │
  │                      │  [verify HMAC sig]  │                     │
  │                      │  [update booking → confirmed]             │
  │                      │  [earn OTA coins]   │                     │
  │                      │  [create settlement entry]                │
  │                      │                     │                     │
  │                      │  POST PMS_API_URL/api/v1/ota-webhooks/rez-ota
  │                      │  x-webhook-signature: HMAC(secret)        │
  │                      │  { event: "booking_confirmed", data: {...} }
  │                      │─────────────────────────────────────────>│
  │  { booking_id, coins_earned }              │                     │
  │<─────────────────────│                     │  [upsert Booking doc]
```

The PMS webhook call is fire-and-forget with 3-attempt exponential backoff (2s, 4s, 8s).

### 7.3 Coin Earn/Burn Waterfall

At booking hold time:
1. `CoinService.checkBurn()` is called to validate and cap all three coin types
2. Burn waterfall priority: **OTA coin → REZ coin → Hotel Brand coin**
3. Safety floor: total discount cannot exceed **40% of booking value**
4. Per-type caps are read from active `BurnRule` records (defaults: OTA 15%, REZ 10%, brand 20%)
5. Coins are debited from wallets atomically at hold creation
6. If hold expires or payment fails, all coin burns are reversed by the `hold-expiry` worker

At booking confirm time:
1. `CoinService.earnCoins()` is called with the active `EarnRule` for the booking's coin type, channel, tier, and hotel
2. Earn rule priority: campaign > hotel-specific > user tier > channel > default
3. OTA and hotel_brand coins expire 12 months after earn; a `CoinExpirySchedule` row is written
4. REZ coins reflect the balance of the user's REZ wallet (synced from rez-wallet-service)

```
Booking Value: ₹6,000
─────────────────────
OTA Coin burn:        ₹600  (cap: 15% = ₹900, balance: ₹600 → limited by balance)
REZ Coin burn:        ₹300  (cap: 10% = ₹600, balance: ₹300 → limited by balance)
Hotel Brand burn:     ₹200  (cap: 20% = ₹1,200, balance: ₹200)
                      ─────
Total discount:       ₹1,100  (18.3% < 40% safety floor — allowed)
PG charge:            ₹4,900
─────────────────────────────
Post-confirm earn (5% OTA rule): ₹300 OTA coins credited
```

### 7.4 PMS Inventory Push (PMS → OTA)

When a hotel staff member updates availability or rates in the PMS:
```
Hotel PMS                           Hotel OTA API
    │                                     │
    │  PUT /v1/partner/pms/inventory      │
    │  /{hotelId}/{roomTypeId}/{date}     │
    │  x-internal-token: REZ_OTA_INTERNAL_TOKEN
    │  { available_rooms, rate_paise }    │
    │────────────────────────────────────>│
    │                                     │  [upsert inventory_slot row]
    │  { available_rooms, rate_paise, ... }
    │<────────────────────────────────────│
```

OTA also pulls inventory every 15 minutes via the `pms-inventory-sync` BullMQ worker for hotels with `pmsWebhookUrl` configured.

### 7.5 Hotel Check-in / Check-out → PMS Sync

When hotel staff use the Hotel Panel to check in or check out a guest, the OTA API fires a PMS webhook:
```
Hotel Staff  →  POST /hotel/bookings/:id/checkin
                [update booking.status = 'checked_in']
                [PmsWebhookService.notifyCheckIn()] ──fire-and-forget──> PMS

Hotel Staff  →  POST /hotel/bookings/:id/checkout
                [update booking.status = 'stayed']
                [PmsWebhookService.notifyCheckOut()] ──fire-and-forget──> PMS
                ↑ PMS can then call /v1/partner/pms/coins/earn to award brand coins
```

### 7.6 REZ Wallet Balance Sync

The OTA mirrors the user's REZ coin balance in its own `coin_wallets.rez_coin_balance_paise` column.

- **On SSO** (`completeSsoFlow`): syncs immediately
- **On GET /wallet**: triggers a fire-and-forget sync for linked users
- **On POST /partner/rez/wallet/sync**: REZ App pushes updated balance directly

Sync implementation (`getRezWalletBalance`):
```
Hotel OTA API                    rez-wallet-service
     │                                 │
     │  GET /internal/balance/:rezUserId
     │  x-internal-token: ***          │
     │────────────────────────────────>│
     │  { balance: { available }, coins: [...] }
     │<────────────────────────────────│
     │
     │  paise = available × REZ_COIN_TO_RUPEE_RATE × 100
     │  UPDATE coin_wallets SET rez_coin_balance_paise = paise
```

Timeout: 3 seconds. Failures are silently swallowed (returns 0); the user sees their last-synced balance.

---

## 8. Local Development Setup

```bash
# 1. Clone the repo
git clone <repo>
cd "Hotel OTA"

# 2. Install dependencies
npm install

# 3. Set environment variables
cp apps/api/.env.example apps/api/.env
# Edit .env — minimum required for dev:
#   DATABASE_URL=postgresql://...
#   REDIS_URL=redis://localhost:6379
# JWT secrets default to dev values if not set

# 4. Run Prisma migrations
npm run db:migrate --workspace=packages/database
# or:
cd packages/database && npx prisma migrate dev

# 5. Generate Prisma client
npx prisma generate --schema=packages/database/prisma/schema.prisma

# 6. Start Redis (local or use Upstash free tier)
redis-server

# 7. Start the API in dev mode
npm run dev --workspace=apps/api
# or:
cd apps/api && npm run dev

# Verify
curl http://localhost:3000/health
```

**Dev-only behavior:**
- OTP endpoint returns `dev_otp` in the response body (no actual SMS sent when MSG91 key is absent)
- PMS internal token check is skipped if `REZ_OTA_INTERNAL_TOKEN` is not set
- PMS webhook sends are skipped if `PMS_API_URL` is not set
- Webhook signature verification is skipped if secrets are absent

---

## 9. Deployment Runbook

### Prisma Migrations (required before first deploy or schema changes)

```bash
# Run from packages/database
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Pending migrations to run before Hotel OTA production deploy:
# 1. coin_expiry_hotel_id — adds hotelId FK to coin_expiry_schedules
# 2. hotel_pms_webhook_url — adds pms_webhook_url column to hotels
```

### Environment Variables Checklist

- [ ] `DATABASE_URL` — PostgreSQL connection string (Render Singapore)
- [ ] `REDIS_URL` — Upstash Redis
- [ ] `JWT_SECRET` — strong random (no "dev" substring)
- [ ] `REFRESH_TOKEN_SECRET` — strong random
- [ ] `ADMIN_JWT_SECRET` — strong random
- [ ] `INTERNAL_SERVICE_TOKEN` — shared with rez-auth-service, rez-wallet-service
- [ ] `REZ_OTA_INTERNAL_TOKEN` — secret accepted on `/v1/partner/pms` routes; must match `REZ_OTA_INTERNAL_TOKEN` in PMS env
- [ ] `PMS_WEBHOOK_SECRET` — HMAC secret for outbound webhooks; must match `REZ_OTA_WEBHOOK_SECRET` in PMS env
- [ ] `REZ_AUTH_SERVICE_URL` — e.g. `https://auth.rez.money`
- [ ] `REZ_WALLET_SERVICE_URL` — e.g. `https://wallet.rez.money`
- [ ] `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` + `RAZORPAY_WEBHOOK_SECRET`
- [ ] `MSG91_API_KEY` + `MSG91_SENDER_ID` (for OTP SMS)
- [ ] `AWS_ACCESS_KEY` + `AWS_SECRET_KEY` + `AWS_S3_BUCKET` (for image uploads)
- [ ] `SENDGRID_API_KEY` (for email notifications)
- [ ] `FRONTEND_URL`, `HOTEL_PANEL_URL`, `ADMIN_PANEL_URL` (CORS allowlist)
- [ ] `NODE_ENV=production`

### Startup Sequence

1. `npx prisma migrate deploy` (run before each deploy, idempotent)
2. `npm run build` (generates Prisma client + TypeScript compile)
3. `npm run start` (runs `node dist/index.js`)
4. On startup: DB connection, env validation, BullMQ worker registration, scheduler init, PMS sync bootstrap (10s delay)

### Secret Alignment Between Services

| OTA env var | Must equal | PMS env var |
|-------------|-----------|-------------|
| `PMS_WEBHOOK_SECRET` | = | `REZ_OTA_WEBHOOK_SECRET` |
| `REZ_OTA_INTERNAL_TOKEN` | = | `REZ_OTA_INTERNAL_TOKEN` |
| `INTERNAL_SERVICE_TOKEN` | = | `INTERNAL_SERVICE_TOKEN` |

---

## 10. Troubleshooting

### "Hold expired before payment"
- Check `REDIS_URL` — if BullMQ cannot connect, hold-expiry jobs are never processed
- Check `hold_expires_at` in the `bookings` table; if null, the hold job was never enqueued
- The Razorpay `order.paid` webhook at `/api/webhooks/razorpay` provides a safety net: if the user paid but `/confirm` timed out, the webhook will mark the booking confirmed

### "Booking confirmed but not in PMS"
- Check OTA logs for `[PmsWebhook] FAILED after 3 attempts` messages
- Verify `PMS_API_URL` is set and reachable
- Verify `PMS_WEBHOOK_SECRET` (OTA) == `REZ_OTA_WEBHOOK_SECRET` (PMS)
- PMS can reconcile by calling `GET /v1/pms/bookings` on the OTA API

### "REZ coin balance shows 0 or stale"
- `GET /v1/wallet` triggers a background sync for linked users; check the next request
- Verify `REZ_WALLET_SERVICE_URL` is reachable with the correct `INTERNAL_SERVICE_TOKEN`
- Check logs for `[RezIntegration] Wallet balance fetch failed`
- Admin can manually correct via `POST /admin/users/:id/coin-adjust`

### "Invalid internal token on /partner/pms routes"
- The token must be **exactly** the same string (no trailing newline)
- The comparison fails with length-mismatch guard before timingSafeEqual — check for whitespace
- If `REZ_OTA_INTERNAL_TOKEN` is not set, the service falls back to `INTERNAL_SERVICE_TOKEN`

### "Coin burn exceeded cap error"
- Call `POST /wallet/check-burn` first to get the applicable amounts before calling `/bookings/hold`
- The combined discount cannot exceed 40% of booking value; reduce coin amounts proportionally

### "PMS inventory sync not running"
- Check that hotels have `pmsWebhookUrl` set and `onboarding_status = active`
- Check Redis connectivity — BullMQ cannot enqueue without Redis
- Look for `[PmsSync] Bootstrap failed` in startup logs
- Manually trigger by calling `PUT /hotel/pms-sync` from the Hotel Panel with the PMS URL

### "Environment validation failed on startup"
- In production mode, missing required env vars throw and abort startup
- Run `validateEnv()` locally: `node -e "const {validateEnv} = require('./dist/config/env'); console.log(validateEnv())"`
