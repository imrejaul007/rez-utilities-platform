# Hotel PMS Backend

## 1. Purpose, Tech Stack, and Architecture Position

The Hotel PMS (Property Management System) backend is an enterprise-grade hotel operations platform. In the context of the REZ ecosystem it plays a dual role: it is a full standalone PMS (managing front desk, housekeeping, POS, inventory, loyalty, and reporting for a hotel property) and simultaneously a downstream integration partner of the Hotel OTA. The integration is bidirectional — the OTA pushes booking events to the PMS via HMAC-signed webhooks, and the PMS pushes inventory/rate changes plus coin award requests back to the OTA.

### Position in the REZ System

```
Hotel OTA API ──────────────────────────────────────────────────────┐
  (HMAC webhook push on booking events)                              │
  (accepts inventory/coin-earn calls from PMS)                       │
                                                                     ▼
REZ App ──────────────────── rez-auth-service ─────────> Hotel PMS Backend
  (REZ SSO: hotel staff login                                        │
   using REZ credentials)                              Hotel staff   │
                                                       dashboard,    │
                                                       front desk,   │
                                                       housekeeping, │
                                                       POS, loyalty  │
                                                                     │
                                                    MongoDB (primary DB)
                                                    Redis (queues/cache)
                                                    WebSocket (real-time)
```

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js, ESM modules (`type: "module"`) |
| Framework | Express.js |
| ODM | Mongoose (MongoDB) |
| Database | MongoDB |
| Cache / Queue | Redis, Bull/BullMQ |
| Real-time | Socket.io (websocketService) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| File upload | multer |
| Email | Nodemailer / nodemailer-sendgrid |
| Payments | Stripe |
| Security | helmet, express-mongo-sanitize, hpp, cors |
| API docs | swagger-jsdoc + swagger-ui-express |
| HTTP client | axios (for OTA calls) |

### Key Scale Facts

- 168 route files, 108 controllers, 164 services, 176 models
- 200+ frontend pages, 423 components (separate React/TypeScript frontend)
- 18-agent autonomous code review system at `agents/`

---

## 2. API Routes (REZ OTA Integration Subset)

The server registers its routes via `registerApiRoutes()` at startup. The full route surface is very large (168 route files). This section documents only the routes that are directly relevant to the REZ OTA integration. Refer to the Swagger UI at `/api-docs` for the complete API reference.

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | None | `{ status: "ok", timestamp }` |

---

### REZ OTA Webhook Receiver

**Mount path:** `POST /api/v1/ota-webhooks/rez-ota`

This is the primary integration endpoint. Hotel OTA pushes all booking lifecycle events here.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/ota-webhooks/rez-ota | HMAC-SHA256 (`x-webhook-signature`) | Receive booking events from Hotel OTA |

**Request body:**
```json
{
  "event": "booking_confirmed",
  "data": {
    "bookingId": "ota-uuid",
    "bookingRef": "OTA2501XXXXX",
    "hotelId": "ota-uuid",
    "userId": "ota-uuid",
    "checkinDate": "2025-01-15",
    "checkoutDate": "2025-01-17",
    "numRooms": 1,
    "numGuests": 2,
    "guestName": "Raj Kumar",
    "guestPhone": "9876543210",
    "totalValuePaise": 600000,
    "pgAmountPaise": 490000,
    "otaCoinBurnedPaise": 60000,
    "rezCoinBurnedPaise": 30000,
    "hotelBrandCoinBurnedPaise": 20000
  }
}
```

**Supported event types:**

| event | PMS Action |
|-------|-----------|
| `booking_confirmed` | Creates a new Booking document in MongoDB (upsert by channelBookingId) |
| `booking_cancelled` | Finds Booking by channelBookingId, sets status = "cancelled", releases rooms |

**Response:**
```json
{ "received": true, "event": "booking_confirmed", "pmsBookingId": "mongo-id" }
```

**Error responses:**
- `400` — missing event or data
- `401` — missing or invalid `x-webhook-signature`
- `422` — unknown event type

---

### Standard PMS Routes (Auth: JWT Bearer)

The following routes are relevant to OTA-sourced bookings and REZ SSO but exist as part of the full PMS surface:

| Method | Path | Notes |
|--------|------|-------|
| POST | /api/v1/auth/login | Email/password or REZ SSO for hotel staff |
| GET | /api/v1/bookings | List bookings; supports filter `source=ota` |
| GET | /api/v1/bookings/:id | Booking detail; includes channelBookingId |
| PUT | /api/v1/rooms/availability | Update room availability (triggers OTA inventory push) |
| PUT | /api/v1/rates | Update room rates (triggers OTA inventory push) |
| GET | /api/v1/hotels/:hotelId/ota-connections | View OTA connection status |
| PUT | /api/v1/hotels/:hotelId/ota-connections/rez | Enable/configure REZ OTA link |

---

## 3. Background Jobs / Workers

The PMS runs several scheduled jobs managed via Bull/BullMQ and a set of internal job files.

### Job Files (`src/jobs/`)

| File | Description |
|------|-------------|
| `nightAuditJob.js` | Automated night audit: rate posting, no-show processing, day rollover |
| `loyaltyMaintenanceJob.js` | Expiry, reconciliation, and tier updates for the PMS loyalty program |
| `reorderJob.js` | Inventory reorder alerts for F&B and amenities |
| `scheduledUpdatesJob.js` | Time-triggered rate/availability rule application |
| `approvalTimeoutJob.js` | Auto-rejects approval requests that timeout |

### Schedulers (`src/schedulers/`)

Pricing scheduler (commented out pending tensorflow) + notification scheduler registered at startup.

### Services with Internal Queuing

| Service | Behavior |
|---------|---------|
| `queueService.js` | Central Bull queue for background tasks |
| `bookingWorkflowEngine.js` | State machine for booking lifecycle transitions |
| `loyaltyEventQueueService.js` | Processes loyalty events asynchronously |
| `notificationScheduler.js` | Schedules push/email/SMS notifications |
| `inventoryScheduler.js` | Periodic inventory checks and alerts |
| `otaMonitoringService.js` | Monitors OTA webhook delivery health |
| `payloadRetentionService.js` | Retains and retries failed OTA webhook payloads |

### Startup Initialization Order

On `server.js` startup:
1. MongoDB connection (`connectDB`)
2. Redis connection (`connectRedis`)
3. Route registration (`registerApiRoutes`)
4. WebSocket initialization (`websocketService`)
5. Job registration: `reorderJob`, `scheduleNightAudit`, `loyaltyMaintenanceJob`, `startScheduledUpdatesJob`, `NotificationScheduler`
6. `inventoryScheduler`, `queueService`, `bookingWorkflowEngine`, `payloadRetentionService`, `otaPayloadService`
7. `systemHealthMonitor` starts
8. Graceful shutdown handlers registered

---

## 4. Security Mechanisms

### HMAC-SHA256 Webhook Verification

All inbound webhooks from Hotel OTA are verified before processing:

```javascript
// src/services/rezOtaConnector.js — verifyOtaWebhookSignature()
export function verifyOtaWebhookSignature(payload, signature) {
  const secret = process.env.REZ_OTA_WEBHOOK_SECRET || '';
  if (!secret) return true; // dev mode
  const expected = HMAC-SHA256(JSON.stringify(payload), secret);
  // timingSafeEqual with length check
}
```

The route handler (`rezOtaWebhooks.js`) calls this before any business logic. In non-production environments, missing signatures are permitted with a warning log.

**Critical alignment:** `REZ_OTA_WEBHOOK_SECRET` (PMS) must equal `PMS_WEBHOOK_SECRET` (OTA).

### JWT Authentication

All standard PMS routes are protected by the `authenticate` middleware (`src/middleware/auth.js`). Tokens are issued at login and carry `{ userId, hotelId, role }`. Role-based access is enforced by `authorizePolicy` RBAC middleware.

### OTA Outbound Calls (x-internal-token)

When the PMS calls the Hotel OTA for coin earning or inventory updates, it sends:
```
x-internal-token: REZ_OTA_INTERNAL_TOKEN
```
This is consumed by the OTA's `authenticatePms` middleware on `/v1/partner/pms` routes.

### REZ SSO for PMS

Hotel staff can authenticate with their REZ credentials. The PMS performs the same 2-step verification as the OTA (via `verifyRezTokenForPms` in `rezOtaConnector.js`):
1. `GET {REZ_AUTH_SERVICE_URL}/auth/validate` — validates token signature + blacklist
2. `GET {REZ_AUTH_SERVICE_URL}/internal/auth/user/:userId` — fetches profile

Requires `REZ_AUTH_SERVICE_URL` and `INTERNAL_SERVICE_TOKEN`.

### MongoDB Security

- `express-mongo-sanitize` strips `$` and `.` from request bodies/params/query to prevent operator injection
- `hpp` prevents HTTP parameter pollution
- All tenant-scoped queries filter by `hotelId`

### Global Rate Limiting

`express-rate-limit` is applied globally at the Express app level, with stricter limits on auth endpoints.

---

## 5. Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string (Atlas or self-hosted) |
| `REDIS_URL` | Redis connection URL (for queues and caching) |
| `JWT_SECRET` | JWT signing secret for PMS auth tokens |
| `NODE_ENV` | `development` or `production` |

### REZ OTA Integration (Required for integration)

| Variable | Description |
|----------|-------------|
| `REZ_OTA_API_URL` | Hotel OTA API base URL (e.g. `https://ota-api.rez.money`) |
| `REZ_OTA_INTERNAL_TOKEN` | Token sent as `x-internal-token` on outbound OTA calls |
| `REZ_OTA_WEBHOOK_SECRET` | HMAC secret for verifying inbound OTA webhooks; must equal `PMS_WEBHOOK_SECRET` on OTA |
| `REZ_AUTH_SERVICE_URL` | Base URL of rez-auth-service (for SSO verification) |
| `INTERNAL_SERVICE_TOKEN` | Shared token for internal service calls to rez-auth-service |

### Optional / With Defaults

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | HTTP listen port |
| `STRIPE_SECRET_KEY` | — | Stripe payment processing |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook HMAC verification |
| `SENDGRID_API_KEY` | — | Email sending via SendGrid |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | — | Alternative SMTP config |
| `FIREBASE_SERVER_KEY` | — | Push notifications |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_BUCKET` | — | File storage |
| `QUEUE_PROCESSOR_MODE` | `api` | Set to `worker` to run queues in a separate process |

---

## 6. Data Models (MongoDB — Key Collections)

### `Hotel` collection

The `otaConnections.rezOta` sub-document is the primary integration link:

```javascript
otaConnections: {
  rezOta: {
    isEnabled: Boolean,       // true = OTA integration active for this hotel
    hotelId: String,          // Hotel OTA PostgreSQL UUID (indexed)
    lastSync: Date            // Timestamp of last successful sync
  },
  bookingCom: {
    isEnabled: Boolean,
    credentials: { clientId, clientSecret, hotelId },
    lastSync: Date
  }
}
```

The `hotelId` within `rezOta` is the UUID from Hotel OTA's PostgreSQL `hotels` table. This is the foreign key used by `rezOtaConnector.js` to match incoming webhook payloads:
```javascript
const hotel = await Hotel.findOne({ 'otaConnections.rezOta.hotelId': otaHotelId });
```

Other relevant fields:
```javascript
{
  name: String,               // Hotel display name
  address: { city, country, coordinates: { latitude, longitude } },
  contact: { phone, email, website },
  policies: { checkInTime, checkOutTime, cancellationPolicy },
  settings: { currency, timezone, language },
  isActive: Boolean,
  ownerId: ObjectId → User,
  propertyGroupId: ObjectId → PropertyGroup
}
```

---

### `Booking` collection

OTA-sourced bookings are distinguished by:

```javascript
{
  source: 'ota',                    // String enum: 'ota' | 'direct' | 'walk_in' | ...
  channelBookingId: String,         // Hotel OTA booking UUID (deduplication key, indexed)
  channelReservationId: String,     // Human-readable OTA booking ref (OTA2501XXXXX)
  status: 'confirmed',              // confirmed on creation from OTA webhook
  paymentStatus: 'paid',            // already paid via OTA's payment gateway
  totalAmount: Number,              // totalValuePaise / 100 (rupees, not paise)
  currency: 'INR',
  guestDetails: {
    adults: Number,
    specialRequests: String         // "OTA Guest: {name} | {phone}"
  },
  channelData: {
    channelCommission: 0,
    channelRate: Number,            // totalAmount
    channelCurrency: 'INR',
    marketingSource: String         // JSON string with coin burn details + otaUserId
  },
  // Full lifecycle fields:
  checkIn: Date,
  checkOut: Date,
  nights: Number,
  rooms: [{ roomId, roomTypeId, rate }],
  statusHistory: [{ status, timestamp, changedBy, reason }],
  lastStatusChange: { from, to, timestamp, reason },
  paymentDetails: {
    totalPaid: Number,
    remainingAmount: Number,
    paymentMethods: [{ method, amount, reference, processedBy, processedAt }]
  },
  settlementTracking: {
    status: String,
    finalAmount: Number,
    adjustments: [...],
    outstandingBalance: Number
  }
}
```

**Status enum for PMS bookings:**
`pending → confirmed → modified → checked_in → checked_out → cancelled / no_show`

(Note: OTA webhooks create bookings at `confirmed` / `cancelled` directly, bypassing `pending`.)

**Deduplication:** `channelBookingId` is checked before insert:
```javascript
const existing = await Booking.findOne({ channelBookingId: bookingId });
if (existing) return existing; // idempotent
```

---

### `User` collection (relevant to OTA integration)

```javascript
{
  name: String,
  email: String,
  phone: String,
  role: String,             // guest | staff | frontdesk | manager | admin | travel_agent
  hotel: ObjectId → Hotel,
  otaUserId: String,        // Hotel OTA user UUID (written when REZ SSO links accounts)
  preferences: {
    bedType, floor, smokingAllowed,
    offers: { favoriteCategories, favoriteTypes, priceRangePreference, notifications }
  }
}
```

The `otaUserId` field is used in `handleOtaBookingConfirmed` to match an incoming OTA booking to an existing PMS guest:
```javascript
pmsUser = await User.findOne({
  hotel: hotel._id,
  $or: [{ phone: guestPhone }, { otaUserId: userId }]
});
```

If no match is found, the code falls back to a hotel system/guest account.

---

## 7. Cross-System Integration

### 7.1 REZ SSO for PMS Staff Login

Hotel staff with REZ credentials can log in to the PMS dashboard without a separate PMS account. The flow mirrors what the Hotel OTA does:

```
PMS Frontend                  PMS Backend               rez-auth-service
     │                             │                           │
     │  POST /api/v1/auth/login    │                           │
     │  { type: 'rez_sso',         │                           │
     │    rez_access_token: '...' }│                           │
     │────────────────────────────>│                           │
     │                             │  GET /auth/validate       │
     │                             │  Authorization: Bearer    │
     │                             │──────────────────────────>│
     │                             │  { valid: true, userId }  │
     │                             │<──────────────────────────│
     │                             │                           │
     │                             │  GET /internal/auth/user/:userId
     │                             │  x-internal-token: ***    │
     │                             │──────────────────────────>│
     │                             │  { id, phone, name, role }│
     │                             │<──────────────────────────│
     │                             │                           │
     │                             │  [find/create PMS user by phone]
     │                             │  [issue PMS JWT]          │
     │                             │                           │
     │  { token, user }            │                           │
     │<────────────────────────────│                           │
```

Implementation in `src/services/rezOtaConnector.js` — `verifyRezTokenForPms()`.

### 7.2 OTA Booking Confirmed → PMS

When a guest completes payment on Hotel OTA, the OTA fires a `booking_confirmed` webhook:

```
Hotel OTA API (production)          Hotel PMS Backend
        │                                  │
        │  POST /api/v1/ota-webhooks/rez-ota
        │  x-webhook-signature: <HMAC>     │
        │  {                               │
        │    event: "booking_confirmed",   │
        │    data: {                       │
        │      bookingId, bookingRef,      │
        │      hotelId (OTA UUID),         │
        │      userId (OTA UUID),          │
        │      checkinDate, checkoutDate,  │
        │      numRooms, numGuests,        │
        │      guestName, guestPhone,      │
        │      totalValuePaise,            │
        │      pgAmountPaise,              │
        │      otaCoinBurnedPaise,         │
        │      rezCoinBurnedPaise,         │
        │      hotelBrandCoinBurnedPaise   │
        │    }                             │
        │  }                               │
        │─────────────────────────────────>│
        │                                  │  [verify HMAC]
        │                                  │  [Hotel.findOne({ 'otaConnections.rezOta.hotelId': hotelId })]
        │                                  │  [User.findOne({ phone | otaUserId })]
        │                                  │  [Booking.create({ source: 'ota', channelBookingId, ... })]
        │  { received: true, pmsBookingId }│
        │<─────────────────────────────────│
```

Coin burn metadata is stored in `booking.channelData.marketingSource` as a JSON string since the standard `channelData` schema does not have coin fields.

### 7.3 OTA Booking Cancelled → PMS

```
Hotel OTA API                        Hotel PMS Backend
        │                                  │
        │  POST /api/v1/ota-webhooks/rez-ota
        │  { event: "booking_cancelled",   │
        │    data: { bookingId } }         │
        │─────────────────────────────────>│
        │                                  │  [Booking.findOneAndUpdate(
        │                                  │    { channelBookingId: bookingId },
        │                                  │    { status: 'cancelled' }
        │                                  │  )]
        │                                  │  [Room.updateMany(occupied/reserved → vacant)]
        │  { received: true }              │
        │<─────────────────────────────────│
```

Room inventory is released so those rooms become available for other bookings.

### 7.4 PMS Inventory/Rate Push → Hotel OTA

When hotel staff change availability or rates in the PMS, the system calls `pushInventoryToOta()` from `rezOtaConnector.js`:

```
Hotel Staff (PMS UI)    PMS Backend              Hotel OTA API
        │                    │                         │
        │  Update rates/avail│                         │
        │───────────────────>│                         │
        │                    │  PUT /v1/partner/pms/inventory
        │                    │  /{otaHotelId}/{roomTypeId}/{date}
        │                    │  x-internal-token: REZ_OTA_INTERNAL_TOKEN
        │                    │  { available_rooms, rate_paise }
        │                    │────────────────────────>│
        │                    │  { available_rooms, rate_paise, ... }
        │                    │<────────────────────────│
```

This keeps the OTA `inventory_slots` table in sync with PMS real-time availability.

### 7.5 PMS Checkout → Brand Coin Award → Hotel OTA

When a guest checks out in the PMS, the loyalty system calls `awardBrandCoinsOnCheckout()`:

```
Hotel Staff (PMS)       PMS Backend              Hotel OTA API
        │                    │                         │
        │  POST checkout      │                         │
        │───────────────────>│                         │
        │                    │  POST /v1/partner/pms/coins/earn
        │                    │  x-internal-token: REZ_OTA_INTERNAL_TOKEN
        │                    │  {                      │
        │                    │    user_id: otaUserId,  │
        │                    │    hotel_id: otaHotelId,│
        │                    │    booking_value_paise, │
        │                    │    coin_type: "hotel_brand",
        │                    │    source: "pms_checkout"
        │                    │  }                      │
        │                    │────────────────────────>│
        │                    │  { awarded: true,       │
        │                    │    amount_paise,        │
        │                    │    coin_name }          │
        │                    │<────────────────────────│
        │  { coins awarded } │                         │
        │<───────────────────│                         │
```

The Hotel OTA applies the earn rule and credits `hotel_brand` coins to the user's wallet. These coins are then visible when the user next logs into the OTA app.

### 7.6 Full End-to-End: Guest Books via REZ App, Stays, and Earns Brand Coins

```
REZ App          Hotel OTA API      Hotel PMS Backend    rez-auth-service
   │                   │                    │                   │
   │  POST /auth/rez-sso                    │                   │
   │──────────────────>│                   │                   │
   │                   │── GET /auth/validate ─────────────────>│
   │                   │<── { valid, userId } ─────────────────│
   │                   │── GET /internal/auth/user/:id ────────>│
   │                   │<── { phone, name } ───────────────────│
   │                   │  [link/create OTA user]               │
   │  { ota_jwt }       │                   │                   │
   │<──────────────────│                   │                   │
   │                   │                   │                   │
   │  POST /partner/rez/bookings/hold       │                   │
   │──────────────────>│                   │                   │
   │  { razorpay_order_id }                 │                   │
   │<──────────────────│                   │                   │
   │  [user pays]      │                   │                   │
   │  POST /partner/rez/bookings/confirm    │                   │
   │──────────────────>│                   │                   │
   │                   │  [earn OTA coins] │                   │
   │                   │  POST /api/v1/ota-webhooks/rez-ota     │
   │                   │  booking_confirmed │                   │
   │                   │──────────────────>│                   │
   │  { confirmed }     │                   │  [create Booking] │
   │<──────────────────│                   │                   │
   │                   │                   │                   │
   │       ... guest stays at hotel ...     │                   │
   │                   │                   │                   │
   │ Hotel staff mark checkout in PMS       │                   │
   │                   │                   │  POST /v1/partner/pms/coins/earn
   │                   │                   │  (hotel brand coins)
   │                   │<──────────────────│                   │
   │                   │  [credit brand coins to wallet]       │
   │                   │──────────────────>│                   │
   │                   │                   │  { awarded: true } │
   │                   │                   │                   │
   │  GET /wallet (next time user opens app)│                   │
   │──────────────────>│                   │                   │
   │  { hotel_brand_coins: [{ coin_name, balance_paise }] }    │
   │<──────────────────│                   │                   │
```

---

## 8. Local Development Setup

```bash
# 1. Navigate to PMS backend
cd "Hotel OTA/hotel-pms/hotel-management-master/backend"

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env  # if exists, otherwise create .env
# Required minimum for OTA integration work:
#   MONGO_URI=mongodb://localhost:27017/hotel-pms
#   REDIS_URL=redis://localhost:6379
#   JWT_SECRET=dev-secret
#   REZ_OTA_API_URL=http://localhost:3000
#   REZ_OTA_INTERNAL_TOKEN=<same as REZ_OTA_INTERNAL_TOKEN on OTA side>
#   REZ_OTA_WEBHOOK_SECRET=<same as PMS_WEBHOOK_SECRET on OTA side>
#   REZ_AUTH_SERVICE_URL=http://localhost:4000
#   INTERNAL_SERVICE_TOKEN=<same as INTERNAL_SERVICE_TOKEN on OTA side>

# 4. Start MongoDB (local)
mongod

# 5. Start Redis
redis-server

# 6. Seed demo data (optional)
npm run seed:demo

# 7. Start the backend
npm run dev
# Runs: nodemon src/server.js

# 8. Verify
curl http://localhost:5000/health
```

**Dev behavior:**
- Webhook signature verification is skipped when `REZ_OTA_WEBHOOK_SECRET` is not set
- OTA outbound calls (`pushInventoryToOta`, `awardBrandCoinsOnCheckout`) are skipped with a warning when `REZ_OTA_API_URL` or `REZ_OTA_INTERNAL_TOKEN` is not set
- Stripe webhook verification is skipped in dev if secret not set

**Run queue workers separately (optional):**
```bash
npm run start:worker
# Uses src/scripts/start-queue-worker.js
# Set QUEUE_PROCESSOR_MODE=worker to decouple from API process
```

**Other useful scripts:**
```bash
npm run check:db          # Verify MongoDB connection + env vars
npm run pms:verify        # PMS acceptance smoke tests
npm run audit:rbac        # Check RBAC coverage across routes
npm run queue:health      # Redis queue health snapshot
npm run pilot:smoke       # Smoke test all critical paths
```

---

## 9. Deployment Runbook

### Environment Variables Checklist

Core:
- [ ] `MONGO_URI` — MongoDB Atlas connection string
- [ ] `REDIS_URL` — Redis connection (Upstash or self-hosted)
- [ ] `JWT_SECRET` — strong random string (min 32 chars)
- [ ] `NODE_ENV=production`
- [ ] `PORT` — defaults to 5000

REZ OTA integration:
- [ ] `REZ_OTA_API_URL` — Hotel OTA API base URL (e.g. `https://ota-api.rez.money`)
- [ ] `REZ_OTA_INTERNAL_TOKEN` — must exactly match `REZ_OTA_INTERNAL_TOKEN` on Hotel OTA
- [ ] `REZ_OTA_WEBHOOK_SECRET` — must exactly match `PMS_WEBHOOK_SECRET` on Hotel OTA
- [ ] `REZ_AUTH_SERVICE_URL` — rez-auth-service URL (for SSO)
- [ ] `INTERNAL_SERVICE_TOKEN` — shared secret for internal calls to rez-auth-service

Payments (if using Stripe for PMS billing):
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`

### Secret Alignment Table

| PMS env var | Must equal | Hotel OTA env var |
|-------------|-----------|-------------------|
| `REZ_OTA_WEBHOOK_SECRET` | = | `PMS_WEBHOOK_SECRET` |
| `REZ_OTA_INTERNAL_TOKEN` | = | `REZ_OTA_INTERNAL_TOKEN` |
| `INTERNAL_SERVICE_TOKEN` | = | `INTERNAL_SERVICE_TOKEN` |

### Enabling REZ OTA Integration for a Hotel

1. In Hotel OTA Admin Panel: activate the hotel (`PUT /admin/hotels/:id/status` with `status=active`)
2. In Hotel OTA Admin Panel: configure earn rules for the hotel
3. In Hotel OTA Hotel Panel: set PMS URL (`PUT /hotel/pms-sync` with `pms_url=https://your-pms.example.com`)
4. In PMS: update the hotel's `otaConnections.rezOta` document:
   ```javascript
   Hotel.findByIdAndUpdate(pmsHotelId, {
     'otaConnections.rezOta.isEnabled': true,
     'otaConnections.rezOta.hotelId': '<OTA hotel UUID>'
   })
   ```
5. Verify by checking `Hotel.findOne({ 'otaConnections.rezOta.hotelId': otaUuid })` returns the correct hotel
6. Test with a dummy webhook: `POST /api/v1/ota-webhooks/rez-ota` with `event: booking_confirmed`

### Production Startup

```bash
NODE_ENV=production npm run start:prod
# Runs: NODE_ENV=production node --max-old-space-size=4096 src/server.js
```

### MongoDB Indexes

Key indexes that must exist for the OTA integration:

```javascript
// On Booking collection
{ channelBookingId: 1 }           // unique, sparse — dedup key
{ 'channelData.source': 1 }       // filter by OTA source
{ hotelId: 1, checkIn: -1 }       // hotel booking list

// On Hotel collection
{ 'otaConnections.rezOta.hotelId': 1 }  // webhook routing lookup (indexed via schema)
```

---

## 10. Troubleshooting

### "Webhook signature invalid" (401 on /api/v1/ota-webhooks/rez-ota)

1. Verify `REZ_OTA_WEBHOOK_SECRET` (PMS) == `PMS_WEBHOOK_SECRET` (OTA) — check for trailing newlines or spaces
2. The signature is computed over `JSON.stringify({ event, data })` — ensure the OTA and PMS use the same serialization order. Both use `JSON.stringify` on the full body object which should match
3. In dev mode (non-production), missing signatures are allowed — check `NODE_ENV`
4. Test manually: `curl -X POST http://localhost:5000/api/v1/ota-webhooks/rez-ota -H "Content-Type: application/json" -H "x-webhook-signature: $(node -e "console.log(require('crypto').createHmac('sha256','<secret>').update(JSON.stringify({event:'test',data:{}})).digest('hex'))")" -d '{"event":"test","data":{}}'`

### "No PMS hotel matched for OTA hotelId" in logs

1. Check that `Hotel.otaConnections.rezOta.hotelId` is set to the Hotel OTA's PostgreSQL hotel UUID
2. Verify the hotel document exists in MongoDB: `db.hotels.findOne({ 'otaConnections.rezOta.hotelId': '<uuid>' })`
3. Ensure `rezOta.isEnabled = true`
4. If the hotel was recently added to OTA, the UUID may differ — fetch it from the OTA admin panel (`GET /admin/hotels`)

### "Brand coin award failed" in PMS logs

1. Check `REZ_OTA_API_URL` is reachable from the PMS server
2. Check `REZ_OTA_INTERNAL_TOKEN` matches `REZ_OTA_INTERNAL_TOKEN` on the OTA
3. Verify the hotel's brand coin program is enabled in OTA admin: `PATCH /admin/hotels/:id/brand-coin { enabled: true }`
4. Verify `brandCoinName` and `brandCoinSymbol` are set before enabling
5. Check OTA logs for `[PmsPartner] coins/earn` to see the actual error response

### "Booking already exists in PMS, skipping" — but I expected a new booking

This is expected behavior. `channelBookingId` is used as the deduplication key. If the OTA retries the webhook (up to 3 attempts) and the first attempt succeeded but returned an error (e.g. network timeout), subsequent attempts will find the existing booking and return it silently. This is correct.

### PMS guest not found for OTA booking

When `guestPhone` doesn't match any PMS user and `otaUserId` also doesn't match:
1. The code falls back to `User.findOne({ hotel, role: 'guest' })` then `role: 'admin'`
2. If no fallback user exists, the booking creation is skipped with a warning log
3. Fix: ensure the hotel has at least one `guest` role system account, or pre-populate `otaUserId` on user records via staff management

### "OTA env vars not set, skipping" for inventory push or coin award

Both `REZ_OTA_API_URL` and `REZ_OTA_INTERNAL_TOKEN` must be set in the PMS environment. The functions return `null` silently without these, which means:
- Inventory changes in PMS will not propagate to OTA
- Brand coins from PMS checkouts will not be awarded

Set both env vars and restart the PMS server.

### Queue jobs not processing

1. Check Redis connectivity: `redis-cli -u $REDIS_URL ping`
2. Check queue health: `npm run queue:health`
3. If running in a separate process: ensure `npm run start:worker` is running
4. Check `QUEUE_PROCESSOR_MODE` — if set to `worker`, the API process will not process jobs

### Night audit not running

1. Check `scheduleNightAudit` is registered at startup (look for initialization log)
2. Verify Redis is available (audit job is BullMQ-based)
3. Manual trigger: call the night audit API endpoint from admin panel or via `npm run generate-kpis`
