# rez-auth-service

Identity and authentication service for the REZ platform. Every API call that touches user data passes through this service for token issuance and validation.

---

## 1. Purpose

`rez-auth-service` owns the full authentication lifecycle for consumers, merchants, admins, and guest (web-menu) sessions:

- OTP-based phone login via SMS or WhatsApp
- PIN-based fast login for returning users, with lockout after 5 failures
- JWT issuance and rotation (access + refresh tokens)
- Token blacklisting on logout or account deletion (Redis primary, MongoDB fallback)
- Admin login via email + bcrypt password (auto-upgrades legacy plaintext passwords)
- Guest JWT for unauthenticated web-menu browsing (role=guest)
- Device fingerprinting and risk scoring per login event
- Email verification (Resend API)
- Phone number change flow (OTP to new number, force re-login after)

It does **not** store orders, coins, or payments — those are the responsibility of downstream services.

---

## 2. Tech Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript 5.x |
| Runtime | Node.js >= 20 |
| Framework | Express 4.x |
| Database | MongoDB (via Mongoose 8.x, raw `connection.collection()` for the `users` collection) |
| Cache / State | Redis (ioredis 5.x) |
| Queue | BullMQ 5 — `notification-events` queue (producer only) |
| JWT | jsonwebtoken 9.x |
| Password hashing | bcryptjs 3.x |
| OTP delivery | MSG91 / WhatsApp via notification-events queue → rez-notification-service |
| Email delivery | Resend API (via `emailService.ts`) |
| Error tracking | Sentry (`@sentry/node` 7.x) |
| Logging | Winston (structured JSON) |
| Tracing | W3C `traceparent` header propagation |

**Ports**

| Purpose | Default |
|---------|---------|
| HTTP API | `4002` |
| Health sidecar | `4102` |

---

## 3. Architecture

```
Mobile app / Web
      │
      ▼
rez-api-gateway ──► rez-auth-service :4002
                          │
               ┌──────────┼──────────────┐
               ▼          ▼              ▼
           MongoDB      Redis        BullMQ
           (users,    (OTP store,   notification-
         adminusers)  blacklist,    events queue)
                       rate limits,
                       device data)
```

**Callers of this service**
- `rez-api-gateway` — token validation on every proxied request (`GET /auth/validate`)
- Any internal service that needs to look up a user — `GET /internal/auth/user/:id`
- REZ mobile app, merchant dashboard, admin panel, web-menu frontend

**Services this service calls**
- None (BullMQ queue push to `notification-events` is the only outbound call)

---

## 4. All API Routes

All routes have two path aliases:
- Native path: `/auth/...`
- Monolith compat path: `/api/user/auth/...`

The table below lists the native path only. Both paths accept the same request/response.

### Consumer Auth

#### POST /auth/otp/send
Send OTP to a phone number.

**Rate limits:** 3 req/min per phone number (fail-closed), then 5 req/15min per IP (fail-closed)

**Request body**
```json
{
  "phone": "9876543210",
  "countryCode": "+91",
  "channel": "sms",
  "force": false
}
```
`phoneNumber` (E.164) is also accepted instead of `phone` + `countryCode`.  
`channel` is `"sms"` (default) or `"whatsapp"`.  
`force: true` forces OTP even when the user has a PIN set (forgot-PIN flow).

**Response 200**
```json
{
  "success": true,
  "message": "OTP sent",
  "isNewUser": false,
  "hasPIN": true
}
```
If `hasPIN: true` and `force` is not set, response is returned immediately **without** sending an OTP to tell the client to show the PIN login screen instead.

In `EXPOSE_DEV_OTP=true` environments the response includes `"_dev_otp": "123456"`.

---

#### POST /auth/otp/send-whatsapp
Alias that forces `channel=whatsapp`. Same request/response as `/auth/otp/send`.

Compat path: `/api/user/auth/send-otp-whatsapp`

---

#### POST /auth/otp/verify
Verify OTP and authenticate (or auto-register) the user.

**Rate limits:** 5 req/min per phone (fail-closed), then 30 req/min per IP

**Request body**
```json
{
  "phone": "9876543210",
  "countryCode": "+91",
  "otp": "482719"
}
```

**Response 200**
```json
{
  "success": true,
  "isNewUser": false,
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "tokens": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "expiresIn": 604800
  },
  "user": {
    "id": "64a...",
    "_id": "64a...",
    "name": "Reza Ahmed",
    "phone": "+919876543210",
    "phoneNumber": "+919876543210",
    "email": "",
    "role": "consumer",
    "isVerified": true,
    "isOnboarded": false,
    "profile": {}
  },
  "deviceRisk": "new"
}
```
`deviceRisk` is one of `"trusted"`, `"new"`, `"suspicious"`.

**Error 401** — Invalid or expired OTP  
**Error 403** — Account deactivated

---

#### POST /auth/login-pin
Fast login for returning users who have set a PIN.

**Rate limits:** 30 req/min per IP (fail-closed)

**Request body**
```json
{
  "phone": "9876543210",
  "countryCode": "+91",
  "pin": "1234"
}
```

**Response 200** — same shape as `/auth/otp/verify`

**Lockout behavior:** After 5 consecutive wrong PINs the account is locked for 15 minutes. The `attemptsRemaining` field is included in 401 responses.

**Error 429** — Account locked for 15 min  
**Error 401** — Invalid PIN (`attemptsRemaining: N`)  
**Error 400** — PIN not set (user must OTP-login first)

---

#### GET /auth/has-pin
Check whether a phone number has a PIN set. Used to decide which login screen to show.

**Query params:** `phone=9876543210&countryCode=+91`

**Response 200**
```json
{ "success": true, "exists": true, "hasPIN": true }
```

---

#### POST /auth/set-pin
Set or change the user's PIN. Requires a valid `Authorization: Bearer <token>` header.

**Request body**
```json
{ "pin": "6281" }
```
PIN must be 4–6 digits. Common sequences (0000, 1234, etc.) are rejected.

**Response 200** `{ "success": true, "message": "PIN set successfully" }`

---

#### POST /auth/refresh
Exchange a refresh token for a new access token. Also rotates the refresh token (old one is blacklisted).

**Request body**
```json
{ "refreshToken": "<jwt>" }
```

**Response 200**
```json
{
  "success": true,
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "expiresIn": 900
}
```

Also available at `/auth/token/refresh` (no `success` wrapper — used by gateway).

---

#### GET /auth/validate
Token validation endpoint for the API gateway. No auth required — the token is in the Authorization header.

**Response 200**
```json
{ "valid": true, "userId": "64a...", "role": "consumer", "merchantId": null }
```
Returns `{ "valid": false }` on any failure — never returns a 4xx so gateway can make decisions.

---

#### GET /auth/me
Get the currently authenticated user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response 200** — same `user` shape as `/auth/otp/verify`

---

#### POST /auth/logout
Blacklist the current access token and write `lastLogoutAt` to MongoDB.

**Headers:** `Authorization: Bearer <token>`

**Response 200** `{ "success": true }`

---

#### POST /auth/complete-onboarding
Mark the user as onboarded and optionally save initial profile/preferences fields.

**Headers:** `Authorization: Bearer <token>`

**Request body**
```json
{
  "profile": {
    "firstName": "Reza",
    "lastName": "Ahmed",
    "gender": "male",
    "dateOfBirth": "1990-01-15",
    "avatar": "https://...",
    "bio": "Foodie"
  },
  "preferences": {
    "language": "en",
    "currency": "INR",
    "notifications": true,
    "theme": "dark",
    "dietaryPreferences": ["vegetarian"]
  }
}
```
Allowed profile keys: `firstName`, `lastName`, `avatar`, `dateOfBirth`, `gender`, `bio`.  
Allowed preference keys: `language`, `currency`, `notifications`, `theme`, `dietaryPreferences`.

**Response 200** — full user object

---

#### PATCH /auth/profile
Update profile fields for an already-onboarded user. Same allowed field lists as above. Email changes must go through `/auth/email/verify/request`.

---

#### DELETE /auth/account
Soft-delete (sets `isActive: false`, `deletedAt: now`) and blacklists the current token.

---

#### POST /auth/change-phone/request
Send an OTP to a **new** phone number as step 1 of a phone-change flow. Requires auth. Rejects if the new number is already in use.

#### POST /auth/change-phone/verify
Verify OTP for the new number, update `phoneNumber`/`phone` on the user doc, and force re-login by blacklisting the current token.

---

#### POST /auth/email/verify/request
Send an email verification link to the provided address. The email is **not** saved to the user doc until the link is clicked — it is stored only in a Redis token.

#### GET /auth/email/verify/:token
Confirmation link handler. Writes the email to the user doc and sets `auth.emailVerified: true`.

---

### Admin Auth

#### POST /auth/admin/login
Email + password login for admin/operator accounts. Only available at the native path (no `/api/user/auth/...` alias).

**Rate limits:** 3 req/5min per IP (fail-closed)

**Request body**
```json
{ "email": "admin@rez.money", "password": "..." }
```

**Behavior:** Constant-time bcrypt compare to prevent timing attacks. If the stored password is plaintext (legacy), it is compared with `timingSafeEqual` and immediately upgraded to bcrypt asynchronously.

**Response 200**
```json
{
  "success": true,
  "accessToken": "<jwt — 8h expiry>",
  "refreshToken": "<jwt — 7d expiry>",
  "user": { "id": "...", "name": "Admin Name", "email": "admin@rez.money", "role": "admin" }
}
```

---

### Guest Auth (web-menu)

#### POST /auth/guest
Issue a guest JWT for unauthenticated table-side browsing.

**Request body**
```json
{ "tableId": "t-12", "storeId": "store_abc123" }
```

**Response 200**
```json
{
  "success": true,
  "guestToken": "<jwt — role=guest, merchantId=storeId>",
  "guestId": "guest_1712345678_a1b2c3d4",
  "tableId": "t-12",
  "storeId": "store_abc123"
}
```

---

### Internal Routes

These routes require the `X-Internal-Token` and `X-Internal-Service` headers and are never exposed to the public internet.

#### GET /internal/auth/user/:id
Look up a user by MongoDB ObjectId. Used by order and notification services.

**Response 200** — same `user` shape as consumer endpoints

---

### Health

#### GET /health
Returns 200 unless MongoDB is down (503). Redis degraded returns 200 with `status: "degraded"` to avoid Render stopping all traffic.

```json
{ "status": "ok", "mongo": true, "redis": true }
```

---

## 5. Background Jobs / Workers

### BullMQ Producer — `notification-events`

The auth service **produces** to the `notification-events` BullMQ queue (it does not consume it). The notification service processes these jobs to deliver OTPs.

**Job: `otp-sms`**
```json
{
  "eventId": "otp-+919876543210-1712345678000",
  "eventType": "otp_sms",
  "channels": ["sms"],
  "userId": "",
  "payload": {
    "title": "REZ OTP",
    "body": "Your REZ verification code is 482719...",
    "data": { "phone": "+919876543210" },
    "smsMessage": "Your REZ verification code is 482719. Valid for 5 minutes..."
  },
  "createdAt": "2026-04-08T10:00:00.000Z"
}
```

**Job: `otp-whatsapp`**
Same structure but `channels: ["whatsapp"]` and includes `whatsappTemplateId: "rez_otp"` and `whatsappTemplateVars: [otp, "5"]`.

### No cron jobs
This service does not schedule any background work internally.

---

## 6. Security Mechanisms

### Rate Limiting (Redis-backed, fail-CLOSED)

| Limiter | Scope | Limit | Window | Applied to |
|---------|-------|-------|--------|-----------|
| `otpSendPhoneLimiter` | Per phone | 3 | 60 s | OTP send |
| `otpLimiter` | Per IP | 5 | 15 min | OTP send (second layer) |
| `otpVerifyPhoneLimiter` | Per phone | 5 | 60 s | OTP verify |
| `authLimiter` | Per IP | 30 | 60 s | Most auth routes |
| `adminLoginLimiter` | Per IP | 3 | 5 min | Admin login |

All limiters are **fail-closed** — when Redis is unreachable they return 429, not allow-through.

### OTP Security
- OTP is a 6-digit integer from `crypto.randomInt` (not `Math.random`)
- Stored as HMAC-SHA256(`phone:otp`, `OTP_HMAC_SECRET`) — the raw OTP is never in Redis
- Atomic Lua GET→compare→DEL eliminates the replay race condition
- 5 consecutive failed verifications lock the phone number for 30 minutes
- TTL: 5 minutes

### JWT Security
- Separate secrets per role: `JWT_SECRET` (consumer), `JWT_ADMIN_SECRET` (admin/operator), `JWT_MERCHANT_SECRET` (merchant)
- Admin tokens can never be verified with `JWT_SECRET` — hard failure if `JWT_ADMIN_SECRET` is not set
- Token expiry by role: consumer 15 min access / 7 d refresh; admin 8 h; merchant 24 h
- Token blacklist: Redis `blacklist:token:<token>` with TTL equal to remaining expiry
- Durable fallback: `users.lastLogoutAt` checked in MongoDB when Redis is unavailable — never fail-open
- Refresh token rotation: old token is blacklisted on use; new access + refresh tokens issued

### PIN Security
- Stored as bcrypt hash (cost 10) in `users.auth.pinHash`
- Blocklist of common PINs (0000–9999 sequences, 1234, etc.)
- 5 failures → 15-minute Redis lockout key (`pin-lock:<userId>`)

### Device Fingerprinting
- Fingerprint = SHA-256(User-Agent + Accept-Language + IP)[:16]
- Risk levels: `trusted` (seen 3+ times), `new`, `suspicious` (>10 unique devices in 24 h)
- Device records TTL: 90 days per device, 24-hour unique device window

### Internal Auth (Service-to-Service)
- `X-Internal-Token` header required for `/internal/*` routes
- Scoped tokens per service via `INTERNAL_SERVICE_TOKENS_JSON` (e.g. `{"rez-order-service":"<token>"}`)
- Legacy single-token `INTERNAL_SERVICE_TOKEN` supported for backward compatibility
- Timing-safe `crypto.timingSafeEqual` comparison prevents timing attacks

### CORS
Configurable via `CORS_ORIGIN`. Defaults to `https://rez.money,https://www.rez.money,https://admin.rez.money`. Server-to-server requests (no origin header) are allowed.

### Other
- `helmet` sets standard security headers
- Body parser limit: 256 KB
- Sentry error tracking (optional, controlled by `SENTRY_DSN`)

---

## 7. Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string (ioredis format) |
| `JWT_SECRET` | Signing secret for consumer access tokens |
| `JWT_REFRESH_SECRET` | Signing secret for all refresh tokens |
| `JWT_ADMIN_SECRET` | Signing secret for admin/operator/support tokens (must not equal JWT_SECRET) |
| `JWT_MERCHANT_SECRET` | Signing secret for merchant tokens |
| `OTP_HMAC_SECRET` | HMAC key used to hash OTPs before Redis storage |
| `INTERNAL_SERVICE_TOKENS_JSON` | JSON map of `{ "service-name": "token" }` for internal routes |

One of `INTERNAL_SERVICE_TOKENS_JSON` or `INTERNAL_SERVICE_TOKEN` (legacy) must be set.

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4002` | Main HTTP port |
| `HEALTH_PORT` | `4102` | Sidecar health port |
| `NODE_ENV` | `production` | Environment label |
| `SERVICE_NAME` | `rez-auth-service` | Service name in logs/Sentry |
| `CORS_ORIGIN` | `https://rez.money,...` | Comma-separated allowed origins |
| `RESEND_API_KEY` | — | Resend API key for email verification |
| `RESEND_FROM_EMAIL` | — | Sender address for verification emails |
| `EXPOSE_DEV_OTP` | `false` | Set to `true` to include raw OTP in response (dev only) |
| `SENTRY_DSN` | — | Sentry DSN; omit to disable |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | Sentry trace sampling rate (0–1) |
| `INTERNAL_SERVICE_TOKEN` | — | Legacy single internal token (deprecated; use INTERNAL_SERVICE_TOKENS_JSON) |

---

## 8. Data Models

The service uses raw `mongoose.connection.collection()` calls against two collections. There are no Mongoose schema files for these collections in this service — schemas live in `rezbackend`.

### `users` collection (key fields)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `phoneNumber` | string | E.164 format (`+919876543210`) |
| `phone` | string | Same as `phoneNumber` (legacy alias) |
| `email` | string | Optional; set after email verification |
| `name` | string | Display name |
| `role` | string | `consumer`, `merchant`, `admin`, `super_admin`, `operator`, `support` |
| `isActive` | boolean | `false` = soft-deleted / deactivated |
| `auth.pinHash` | string | bcrypt hash of PIN |
| `auth.pinSetAt` | Date | When PIN was last set |
| `auth.pinAttempts` | number | |
| `auth.pinLockedUntil` | Date | |
| `auth.isOnboarded` | boolean | |
| `auth.emailVerified` | boolean | |
| `profile.firstName` | string | |
| `profile.lastName` | string | |
| `profile.avatar` | string | URL |
| `profile.dateOfBirth` | string | |
| `profile.gender` | string | |
| `profile.bio` | string | |
| `preferences.language` | string | |
| `preferences.currency` | string | |
| `preferences.notifications` | boolean | |
| `preferences.theme` | string | |
| `preferences.dietaryPreferences` | string[] | |
| `lastLogin` | Date | Updated on every successful login |
| `lastLogoutAt` | Date | Written on logout; used as MongoDB fallback for blacklist check |
| `deletedAt` | Date | Set on soft delete |
| `createdAt` | Date | |
| `updatedAt` | Date | |

### `adminusers` collection (key fields)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `email` | string | Lowercased |
| `password` | string | bcrypt hash; legacy plaintext auto-upgraded on login |
| `name` | string | |
| `role` | string | `admin`, `super_admin`, `operator`, `support` |
| `isActive` | boolean | |

### Redis key schema

| Key pattern | Value | TTL | Purpose |
|-------------|-------|-----|---------|
| `otp:<fullPhone>` | HMAC-SHA256 hash | 5 min | OTP storage |
| `otp-rate:<fullPhone>` | counter | 15 min | OTP send rate limit |
| `otp-fail:<fullPhone>` | counter | 5 min | OTP failure counter |
| `otp-lock:<fullPhone>` | `"1"` | 30 min | OTP lockout |
| `pin-fail:<userId>` | counter | 15 min | PIN failure counter |
| `pin-lock:<userId>` | `"1"` | 15 min | PIN lockout |
| `blacklist:token:<token>` | `"1"` | Remaining token TTL | Token blacklist |
| `device:<userId>:<hash>` | counter | 90 days | Device seen count |
| `devices:<userId>` | set of hashes | 24 h | Unique devices window |
| `rl:otp:<ip>` | counter | 15 min | OTP IP rate limit |
| `rl:otp:send:phone:<phone>` | counter | 60 s | OTP send phone rate limit |
| `rl:otp:verify:phone:<phone>` | counter | 60 s | OTP verify phone rate limit |
| `rl:auth:<ip>` | counter | 60 s | Auth IP rate limit |
| `rl:admin:<ip>` | counter | 5 min | Admin login rate limit |

---

## 9. Local Development

### Prerequisites
- Node.js >= 20
- MongoDB running locally (or Atlas URI)
- Redis running locally

### Setup
```bash
cd rez-auth-service
cp .env.example .env   # fill in required vars
npm install
npm run dev            # ts-node src/index.ts
```

**Minimal `.env` for local dev**
```env
MONGODB_URI=mongodb://localhost:27017/rez
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-consumer
JWT_REFRESH_SECRET=dev-secret-refresh
JWT_ADMIN_SECRET=dev-secret-admin
JWT_MERCHANT_SECRET=dev-secret-merchant
OTP_HMAC_SECRET=dev-otp-hmac
INTERNAL_SERVICE_TOKENS_JSON={"rez-test-service":"dev-internal-token"}
EXPOSE_DEV_OTP=true
PORT=4002
```

With `EXPOSE_DEV_OTP=true`, the OTP is included in the `/auth/otp/send` response so you can test without SMS credits.

### Build and lint
```bash
npm run build    # tsc
npm run lint     # tsc --noEmit (type-check only)
```

### Tests
```bash
# No npm test script — tests are in src/__tests__/
# Run with ts-node or jest if configured in your workspace
npx ts-node src/__tests__/otpSecurity.test.ts
```

---

## 10. Common Errors and Troubleshooting

### `[FATAL] Missing required env vars: JWT_SECRET, ...`
The service exits immediately on startup if any required env var is absent. Check `.env` or the hosting platform's environment configuration.

### OTP always returns `"Invalid or expired OTP"` 
1. Verify `OTP_HMAC_SECRET` is the same on the process that sent the OTP and the one verifying it. If the service restarts with a different secret between send and verify, the stored hash will never match.
2. Check that the Redis key has not expired (5-minute TTL). If the test was paused for more than 5 minutes, request a new OTP.
3. In dev: confirm `EXPOSE_DEV_OTP=true` and use the `_dev_otp` from the send response.

### `Token issued before last logout — session invalidated` on every request
The `users.lastLogoutAt` field has a future timestamp, possibly from a clock skew issue or a manual DB edit. Set `lastLogoutAt` to a past date for the affected user.

### `Authentication service temporarily unavailable`
Both Redis and MongoDB fallback failed during token validation. This is a fail-safe — the service refuses to authenticate rather than allow stale sessions. Check connectivity to both stores.

### Admin login returns 401 on first attempt after credential change
The service runs a constant-time bcrypt compare even on lookup miss. If you updated the admin password directly in MongoDB as plaintext, the next login will succeed and upgrade the hash automatically. If it consistently fails, verify the email is lowercase in the DB (`email` field is queried as `String(email).toLowerCase()`).

### PIN lockout in dev / testing
```javascript
// Clear lockout manually via redis-cli
redis-cli DEL "pin-lock:<userId>"
redis-cli DEL "pin-fail:<userId>"
```

### `CORS blocked: https://yourapp.com`
Add the origin to `CORS_ORIGIN` env var as a comma-separated value.

### BullMQ connection errors on startup
The `notification-events` queue is lazily initialized (created on first OTP send, not at startup). If BullMQ can't connect to Redis when an OTP is first sent, the error is returned to the caller as a 500. Ensure `REDIS_URL` points to a BullMQ-compatible Redis instance (Redis Cluster is supported with `bullmqRedis` connection in `config/redis.ts`).

### Sentry not capturing errors
`SENTRY_DSN` must be set. Without it the Sentry middleware is entirely skipped — errors still go to Winston logs but not Sentry. This is intentional.
