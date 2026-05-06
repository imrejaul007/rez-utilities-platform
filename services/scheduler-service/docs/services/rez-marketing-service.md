# rez-marketing-service

## 1. Purpose, Tech Stack, and Architecture Position

**Purpose**: The REZ marketing service is the cross-channel campaign engine for merchant-to-consumer outreach. It lets merchants create targeted campaigns, send broadcasts to audience segments, bid on search keywords, and track delivery analytics across four channels (WhatsApp, Push, SMS, Email). It also serves as the bridge between AdBazaar and REZ users.

**Architecture position**: Sits between the merchant-facing dashboard (rez-merchant) and the consumer notification layer (rez-notification-events). Upstream callers include rez-backend (audience signals) and AdBazaar (broadcast bookings). Downstream it publishes to the `notification-events` BullMQ queue.

**Tech stack**:
- Runtime: Node.js 18+, TypeScript
- Framework: Express 4 with `express-async-errors`
- Database: MongoDB via Mongoose 8
- Queue: BullMQ 5 on Redis (IORedis)
- Scheduling: `node-cron`
- Email: Nodemailer (SMTP or AWS SES)
- Push: Expo Push API (primary), FCM legacy (fallback)
- SMS: MSG91 (primary), Twilio (fallback)
- WhatsApp: Meta Graph API v19.0
- Security: Helmet, CORS, scoped internal token auth, HMAC webhook verification
- Default port: **4000**

---

## 2. API Routes

All routes (except `/health`, `/metrics`, `GET /webhooks/whatsapp`, and `GET /webhooks/track/*`) require two headers:

```
x-internal-token: <token>        # or x-internal-key (legacy alias)
x-internal-service: <caller-id>  # e.g. "rez-backend", "rez-merchant"
```

The token is resolved from `INTERNAL_SERVICE_TOKENS_JSON`, a JSON object mapping service names to secrets. Authentication uses `crypto.timingSafeEqual` to prevent timing attacks.

---

### Campaigns — `/campaigns`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/campaigns` | List campaigns for a merchant |
| GET | `/campaigns/:id` | Get a single campaign |
| POST | `/campaigns` | Create a new campaign |
| PATCH | `/campaigns/:id` | Update a draft or scheduled campaign |
| POST | `/campaigns/:id/launch` | Dispatch campaign immediately |
| POST | `/campaigns/:id/cancel` | Cancel a campaign |
| DELETE | `/campaigns/:id` | Delete a draft campaign |

**GET /campaigns**

Query params: `merchantId` (required), `status` (optional), `limit` (1–100, default 20), `page` (default 1)

Response:
```json
{
  "campaigns": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

**POST /campaigns**

Request body:
```json
{
  "merchantId": "string (required)",
  "name": "string (required)",
  "objective": "awareness | engagement | sales | win_back (required)",
  "channel": "whatsapp | push | sms | email | in_app (required)",
  "message": "string (required, max 4096)",
  "audience": { "segment": "all | recent | lapsed | high_value | ...", ... },
  "scheduledAt": "ISO date (optional — sets status to 'scheduled')",
  "templateName": "string (optional — Meta WhatsApp template)",
  "imageUrl": "string (optional)",
  "ctaUrl": "string (optional)",
  "ctaText": "string (optional)",
  "createdBy": "userId (optional)"
}
```

Response: 201 with the created campaign document.

Audience estimate is computed at creation time via `audienceBuilder.estimate()` and stored in `audience.estimatedCount`.

**POST /campaigns/:id/launch**

Acquires a 30-second Redis distributed lock (`lock:campaign:launch:{id}`) to prevent double-send race conditions. Returns 409 if lock is already held. Only dispatches campaigns in `draft` or `scheduled` status.

Response:
```json
{ "queued": true, "campaignId": "..." }
```

**PATCH /campaigns/:id**

Editable fields (draft/scheduled only): `name`, `message`, `audience`, `channel`, `objective`, `scheduledAt`, `templateName`, `imageUrl`, `ctaUrl`, `ctaText`

---

### Broadcasts — `/broadcasts`

A broadcast is a simplified campaign interface. Each broadcast may span multiple channels; one MarketingCampaign document is created per channel with `objective='awareness'`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/broadcasts` | Create and optionally schedule a multi-channel broadcast |
| GET | `/broadcasts/:merchantId` | List past broadcasts with delivery stats |
| POST | `/broadcasts/:broadcastId/schedule` | Schedule a draft broadcast |
| POST | `/broadcasts/send` | Sprint 9: segment-based send with rate limiting |

**POST /broadcasts**

Request body:
```json
{
  "segment": "all | new | loyal | lapsed (required)",
  "message": "string (required)",
  "channels": ["push", "sms", "email", "whatsapp", "in_app"],
  "merchantId": "string (required)",
  "name": "string (optional)",
  "scheduledAt": "ISO date (optional)"
}
```

If `scheduledAt` is not provided, all channels are dispatched immediately via `campaignOrchestrator`. Each dispatch also enqueues a `broadcast.dispatched` job onto `notification-events`.

Response:
```json
{
  "queued": true,
  "campaigns": [{ "campaignId": "...", "channel": "push" }],
  "merchantId": "...",
  "segment": "all",
  "channels": ["push"]
}
```

**POST /broadcasts/send**

Rate limit: one broadcast per merchant per hour (checked against `broadcastlogs` collection).

Segments resolved from `cointransactions`:
- `high_value` — earned >500 coins in last 30 days
- `at_risk` — last transaction >30 days ago, active within 90 days
- `new_users` — first transaction within last 7 days
- `all` — all distinct users

Request body:
```json
{
  "segment": "high_value | at_risk | new_users | all (required)",
  "merchantId": "string (required)",
  "templateId": "string (optional — overrides title/body)",
  "title": "string (required if no templateId)",
  "body": "string (required if no templateId)"
}
```

Enqueues one `broadcast.send` BullMQ job per user onto `notification-events` with the full `NotificationEvent` shape. Response includes `estimatedDelivery` (approximately 50ms per user).

Response:
```json
{
  "success": true,
  "queued": 1234,
  "estimatedDelivery": "2026-04-08T10:05:02.000Z"
}
```

**Rate limit error** (HTTP 429):
```json
{ "error": "Broadcast rate limit: one broadcast per merchant per hour" }
```

---

### Audience — `/audience`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/audience/estimate` | Internal token | Estimate audience size for a filter |
| GET | `/audience/interests` | Internal token | Available interest tags with user counts |
| GET | `/audience/locations` | Internal token | Top cities and areas with user counts |
| GET | `/audience/institutions` | Internal token | Institutions with user counts |
| POST | `/audience/search-signal` | Internal token | Record a user search event |
| POST | `/audience/location-signal` | Internal token | Update location from order address |

**POST /audience/estimate**

```json
{ "merchantId": "...", "filter": { "segment": "interest", "interests": ["coffee"] }, "channel": "whatsapp" }
```

Response: `{ "estimatedCount": 2341, "channel": "whatsapp" }`

**POST /audience/search-signal** — called by rez-backend after each user search:
```json
{ "userId": "...", "term": "coffee" }
```

**POST /audience/location-signal** — called by rez-backend after each order:
```json
{ "userId": "...", "address": { "city": "Bangalore", "area": "BTM Layout", "pincode": "560076" } }
```

---

### Analytics — `/analytics`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/summary` | Merchant-level summary over N days |
| GET | `/analytics/campaign/:id` | Per-campaign metrics |
| POST | `/analytics/track/open` | Increment open count |
| POST | `/analytics/track/click` | Increment click count |
| POST | `/analytics/track/conversion` | Record conversion |

**GET /analytics/summary**

Query params: `merchantId` (required), `days` (default 30)

**Tracking pixel** (embedded in email HTML, publicly accessible, no auth):
```
GET /webhooks/track/open?cid={campaignId}
```
Returns a 1x1 transparent GIF with `Cache-Control: no-store`.

---

### Keywords (Search Ads) — `/keywords`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/keywords` | List merchant's keyword bids |
| POST | `/keywords` | Create a keyword bid |
| PATCH | `/keywords/:id` | Update bid settings |
| DELETE | `/keywords/:id` | Delete a bid (ownership enforced via `merchantId` in body) |
| GET | `/keywords/auction` | Serve top N bids for a search term |

**GET /keywords/auction**

Public-facing endpoint called by consumer app search. Returns the highest bidders for a keyword.

Query params: `term` (required), `limit` (1–20, default 3)

Matches both exact and broad-match (regex) keywords. Filters by `isActive: true` and date range.

Response:
```json
{
  "ads": [
    {
      "merchantId": "...",
      "headline": "Best Coffee in BTM",
      "bidAmount": 12.50,
      "imageUrl": "...",
      "ctaUrl": "..."
    }
  ]
}
```

**POST /keywords** — required fields: `merchantId`, `keyword`, `bidAmount`, `dailyBudget`, `headline`

---

### AdBazaar Bridge — `/adbazaar`

Protected by `x-internal-key` header matching `ADBAZAAR_INTERNAL_KEY`. Called by AdBazaar when a brand books a listing.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/adbazaar/broadcast` | Trigger or schedule a user broadcast for an ad booking |
| GET | `/adbazaar/status/:broadcastId` | Check delivery status |

**POST /adbazaar/broadcast**

Rate limit: 3 AdBazaar-triggered broadcasts per merchant per 24 hours (checked against `broadcastlogs` where `source='adbazaar'`).

Request body:
```json
{
  "adBazaarBookingId": "string (required)",
  "rezMerchantId": "string (required)",
  "channel": "whatsapp | push | sms (required)",
  "segment": "all | high_value | at_risk | new_users (required)",
  "title": "string (required)",
  "body": "string (required)",
  "qrCodeUrl": "string (optional — appended to body with coin incentive)",
  "coinsPerScan": "number (optional)",
  "scheduledAt": "ISO date (optional)"
}
```

If `qrCodeUrl` is provided, the body is extended: `"{body}\nScan QR to earn {N} coins → {qrCodeUrl}"`.

For immediate dispatch: resolves segment user IDs, enqueues one `broadcast.send` job per user, logs to `broadcastlogs`.

Response:
```json
{
  "success": true,
  "broadcastId": "...",
  "estimatedReach": 2341
}
```

---

### Webhooks — `/webhooks`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/webhooks/whatsapp` | Public | Meta webhook verification challenge |
| POST | `/webhooks/whatsapp` | HMAC (X-Hub-Signature-256) | Meta delivery receipt processing |
| GET | `/webhooks/track/open` | Public | Email tracking pixel |

**POST /webhooks/whatsapp**

This route must receive the raw request body (not JSON-parsed). In `index.ts`, `express.raw({ type: 'application/json' })` is mounted specifically on `/webhooks/whatsapp` before `express.json()`.

HMAC verification uses `X-Hub-Signature-256: sha256={hex}` and `WHATSAPP_APP_SECRET`. If `WHATSAPP_APP_SECRET` is not set, signature verification is skipped (development mode).

Status updates handled:
- `delivered` → increments `stats.delivered`
- `read` → calls `campaignAnalytics.trackOpen()`
- `failed` → increments `stats.failed`
- Text `STOP` from user → logged (TODO: set `whatsappOptIn = false`)

Meta→campaignId resolution uses Redis key `wa:mkt:msgid:{messageId}` (7-day TTL, set by WhatsAppChannel on send).

Always responds 200 immediately to prevent Meta retries.

**GET /webhooks/whatsapp** — Meta challenge verification:
```
?hub.mode=subscribe&hub.verify_token={token}&hub.challenge={challenge}
```

---

### Health and Metrics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check |
| GET | `/metrics` | None | Prometheus-compatible plain text metrics |

Metrics exposed: `process_uptime_seconds`, `http_requests_total`, `http_errors_total` (5xx count).

---

## 3. Background Workers and Jobs

### campaignWorker

- **Queue consumed**: `mkt-campaigns`
- **Queue produced**: none (dispatches to notification-events indirectly via CampaignOrchestrator)
- **Concurrency**: 3
- **Rate limiter**: max 20 jobs per 60 seconds
- **Job retention**: completed jobs kept 7 days, failed kept 30 days
- **Stalled interval**: 30 seconds, max stalled count: 2

Job payload: `{ campaignId, merchantId, message }`

On failure: sets `campaign.status = 'failed'` and `campaign.errorMessage` in MongoDB.

### interestSyncWorker

- **Queue consumed/produced**: `mkt-interest-sync` (self-scheduled)
- **Concurrency**: 1 (CPU-heavy rebuild)

**Cron schedules** (started by `startInterestSyncScheduler()`):

| Schedule | UTC Cron | Description |
|----------|----------|-------------|
| Daily incremental | `30 19 * * *` (1:00 AM IST) | Rebuilds interest profiles for users with activity in last 7 days |
| Weekly full rebuild | `30 18 * * 0` (midnight IST Sunday) | Rebuilds all users with activity in last 180 days |

### BirthdayScheduler

Started via `startBirthdayScheduler()` (imported from `src/audience/BirthdayScheduler.ts`). Schedules birthday-targeted campaigns.

---

## 4. Delivery Channels

### WhatsApp (WhatsAppChannel)

- Provider: Meta Graph API v19.0
- Config: `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID`
- Supports template messages and free-text (text type)
- Per-send deduplication: Redis key `wa:mkt:dedup:{campaignId}:{phone}` (24-hour TTL, NX set)
- MessageId stored in Redis for webhook receipt lookup: `wa:mkt:msgid:{messageId}` (7-day TTL)
- Rate limiting: 15ms delay between sends (~80 msg/s Meta tier-1 limit)
- Phone normalization: 10-digit numbers prefixed with `91`

### Push (PushChannel)

- Primary: Expo Push API (`https://exp.host/--/api/v2/push/send`) — no API key needed
- Fallback: FCM legacy API (requires `FCM_SERVER_KEY`)
- Expo tokens batched in groups of 100 per request
- FCM tokens batched in groups of 1000
- Filters: only `ExponentPushToken[...]` or `ExpoPushToken[...]` format tokens go to Expo

### SMS (SMSChannel)

- Primary: MSG91 (requires `MSG91_AUTH_KEY` + `MSG91_SENDER_ID`, default sender `REZAPP`)
- Fallback: Twilio (requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`)
- Route: MSG91 route 4 (transactional), country code 91
- Phone normalization: same as WhatsApp

### Email (EmailChannel)

- SMTP mode: `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` (port 587 default, 465 = SSL)
- AWS SES mode: `SES_REGION` (uses SES SMTP endpoint)
- From address: `EMAIL_FROM` (default `REZ <noreply@rez.money>`)
- Builds branded HTML template with tracking pixel, unsubscribe link, CTA button
- Tracking pixel URL: `{MARKETING_SERVICE_URL}/analytics/track/open?cid={campaignId}`
- Unsubscribe URL: `{FRONTEND_URL}/unsubscribe?cid={campaignId}`

---

## 5. Security Mechanisms

- **Internal service auth**: All API routes (except health, metrics, webhook GET, tracking pixel) require `x-internal-token` + `x-internal-service` headers. Token resolved from `INTERNAL_SERVICE_TOKENS_JSON` (JSON map of `{serviceName: secret}`). Uses `crypto.timingSafeEqual` for constant-time comparison.
- **AdBazaar bridge auth**: `x-internal-key` header matching `ADBAZAAR_INTERNAL_KEY`.
- **Meta webhook HMAC**: `X-Hub-Signature-256` using `WHATSAPP_APP_SECRET` and raw request body. Route mounted with `express.raw()` to preserve raw bytes.
- **Launch lock**: Redis `NX EX 30` distributed lock prevents double-send for campaign launch.
- **WhatsApp dedup**: Per-recipient, per-campaign 24-hour deduplication key in Redis.
- **Rate limiting**: One broadcast per merchant per hour (checked in MongoDB `broadcastlogs`); 3 AdBazaar broadcasts per merchant per 24 hours.
- **Helmet**: Security headers on all responses.
- **CORS**: Configurable via `CORS_ORIGIN` (comma-separated list).

---

## 6. Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection URL (used by BullMQ and dedup) |
| `INTERNAL_SERVICE_TOKENS_JSON` | JSON map of `{serviceName: secret}` for inter-service auth |

### Optional — Channel Providers

| Variable | Description |
|----------|-------------|
| `WHATSAPP_TOKEN` | Meta WhatsApp Business API bearer token |
| `WHATSAPP_PHONE_ID` | Meta phone number ID |
| `WHATSAPP_APP_SECRET` | Meta app secret for webhook HMAC verification |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Token for Meta webhook GET challenge |
| `SMTP_HOST` | SMTP hostname (Zoho, Mailgun, etc.) |
| `SMTP_PORT` | SMTP port (default 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SES_REGION` | AWS region for SES (alternative to SMTP) |
| `AWS_SES_SMTP_USER` | SES SMTP username |
| `AWS_SES_SMTP_PASS` | SES SMTP password |
| `EMAIL_FROM` | Sender address (default `REZ <noreply@rez.money>`) |
| `MSG91_AUTH_KEY` | MSG91 API auth key |
| `MSG91_SENDER_ID` | MSG91 sender ID (default `REZAPP`) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number for SMS |
| `FCM_SERVER_KEY` | Legacy FCM server key for non-Expo push tokens |
| `ADBAZAAR_INTERNAL_KEY` | Shared secret for AdBazaar bridge authentication |

### Optional — App Config

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | HTTP server port |
| `CORS_ORIGIN` | `https://rez.money` | Comma-separated allowed origins |
| `FRONTEND_URL` | `https://app.rez.money` | Used in email unsubscribe links |
| `MARKETING_SERVICE_URL` | _(empty)_ | Used in email tracking pixel URL |
| `INTERNAL_SERVICE_TOKEN` | — | Legacy single token (deprecated, use JSON map) |

---

## 7. Data Models

### MarketingCampaign (`marketingcampaigns`)

| Field | Type | Description |
|-------|------|-------------|
| `merchantId` | ObjectId | Reference to Merchant |
| `name` | String | Campaign name, max 100 chars |
| `objective` | Enum | `awareness`, `engagement`, `sales`, `win_back` |
| `channel` | Enum | `whatsapp`, `push`, `sms`, `email`, `in_app` |
| `message` | String | Campaign body text, max 4096 chars |
| `templateName` | String | Meta WhatsApp pre-approved template name |
| `imageUrl` | String | Media attachment URL |
| `ctaUrl` / `ctaText` | String | CTA button |
| `audience` | Object | Targeting filter (see below) |
| `status` | Enum | `draft`, `scheduled`, `sending`, `sent`, `failed`, `cancelled` |
| `scheduledAt` | Date | When to dispatch |
| `sentAt` | Date | Actual dispatch time |
| `stats` | Object | `sent`, `delivered`, `failed`, `deduped`, `opened`, `clicked`, `converted` |
| `attributionWindowDays` | Number | Days after send to attribute conversions (default 7) |
| `createdBy` | ObjectId | MerchantUser who created the campaign |

**Audience filter sub-document** supports: `segment`, `location` (city/area/pincode/radius/coordinates), `interests[]`, `birthday.daysAhead`, `purchaseHistory`, `institution`, `keyword.terms`, `customFilter`, `estimatedCount`.

Indexes: `{merchantId, status, createdAt}`, `{status, scheduledAt}`

### UserInterestProfile (`userinterestprofiles`)

| Field | Type | Description |
|-------|------|-------------|
| `userId` | ObjectId | Unique per user |
| `interests[]` | Array | `{tag, score (0–100), orderCount, lastOrderAt}` |
| `primaryLocation` | Object | `{city, area, pincode, coordinates, source, updatedAt}` |
| `locationHistory[]` | Array | Historical location signals |
| `institution` | Object | `{name, type, area, confidence}` |
| `recentSearches[]` | Array | `{term, searchedAt}` — from REZ app search events |
| `lastSyncedAt` | Date | Last interest rebuild timestamp |

Indexes: `interests.tag`, `primaryLocation.city`, `primaryLocation.area`, `primaryLocation.pincode`, `institution.name`, `recentSearches.term`

### KeywordBid (`keywordbids`)

| Field | Type | Description |
|-------|------|-------------|
| `merchantId` | ObjectId | Owning merchant |
| `keyword` | String | Lowercase, trimmed keyword |
| `matchType` | Enum | `exact`, `broad`, `phrase` |
| `channel` | Enum | `search`, `feed` |
| `bidAmount` | Number | ₹ per CPC or per 1000 CPM |
| `bidType` | Enum | `cpc`, `cpm` |
| `dailyBudget` | Number | Max ₹/day |
| `totalBudget` | Number | Lifetime cap (optional) |
| `totalSpent` | Number | Running total |
| `impressions` / `clicks` | Number | Performance counters |
| `headline` | String | Ad headline, max 80 chars |
| `description` | String | Ad description, max 200 chars |
| `isActive` | Boolean | Whether bid is serving |
| `startDate` / `endDate` | Date | Flight dates |

Auction index: `{keyword, isActive, bidAmount: -1}`

### Runtime collections (not Mongoose models)

| Collection | Written by | Purpose |
|------------|-----------|---------|
| `broadcastlogs` | broadcasts routes, adbazaar route | Rate limiting and history |
| `merchanttemplates` | external | Notification content templates |

---

## 8. Local Development and Testing

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Redis

### Setup

```bash
cd rez-marketing-service
cp .env.example .env   # fill in MONGODB_URI, REDIS_URL, INTERNAL_SERVICE_TOKENS_JSON

npm install
npm run dev            # ts-node-dev with hot reload on port 4000
```

Minimum `.env` to start:
```env
MONGODB_URI=mongodb://localhost:27017/rez-marketing
REDIS_URL=redis://localhost:6379
INTERNAL_SERVICE_TOKENS_JSON={"rez-backend":"dev-secret-123"}
```

### Build

```bash
npm run build    # TypeScript → dist/
npm start        # Run compiled output
```

### Testing channel delivery locally

**Push**: No API key needed — Expo Push API is public. Set real Expo tokens from the consumer app.

**WhatsApp**: Requires Meta developer account. Use `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_ID` from Meta Business.

**SMS (MSG91)**: Requires DLT registration in India. For testing, use Twilio sandbox.

**Email**: Use `smtp4dev` or Mailtrap locally. Set `SMTP_HOST=localhost`, `SMTP_PORT=1025`.

### Testing the webhook locally

Expose locally with ngrok:
```bash
ngrok http 4000
```

Set the ngrok HTTPS URL as the Meta webhook URL. For webhook verification, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` must match what Meta was configured with.

---

## 9. Troubleshooting

**Campaign stuck in `sending`**: The `campaignWorker` may have crashed mid-execution. Check BullMQ queue `mkt-campaigns` for stalled jobs. `stalledInterval: 30s` with `maxStalledCount: 2` will retry automatically. After 2 stalls, the job fails and sets `status = 'failed'`.

**Webhook HMAC rejection (401)**: Ensure `express.raw({ type: 'application/json' })` is mounted before `express.json()` on the `/webhooks/whatsapp` path. If `express.json()` runs first, `req.body` will be a parsed object and HMAC verification fails. Also verify `WHATSAPP_APP_SECRET` matches the app secret in Meta Business Manager.

**`Service auth not configured` (503)**: `INTERNAL_SERVICE_TOKENS_JSON` is missing or not valid JSON. The service will reject all non-public requests until this is set.

**Interest sync not running**: Check that `startInterestSyncScheduler()` is called on boot (it is in `index.ts`). Verify `node-cron` is not blocked by server timezone issues. The daily sync fires at `30 19 * * *` UTC regardless of server timezone.

**AdBazaar rate limit 429**: More than 3 AdBazaar-sourced broadcasts have been sent for the merchant in the last 24 hours. Check `db.broadcastlogs.find({ merchantId: "...", source: "adbazaar" })` to see recent entries.

**WhatsApp deduplication (messages not sending)**: Redis key `wa:mkt:dedup:{campaignId}:{phone}` exists from a previous send within 24 hours. Clear with `DEL wa:mkt:dedup:*` in Redis if you need to resend in dev.

**Campaign launch 409 (lock conflict)**: Another process is holding `lock:campaign:launch:{campaignId}`. The lock expires after 30 seconds. If the previous process crashed without releasing the lock, wait 30 seconds or manually `DEL lock:campaign:launch:{id}` in Redis.

**Broadcast segment returns 0 users**: The `cointransactions` collection may be empty or use a different field name for the user reference. Check that the collection name matches and that `user` field (not `userId`) is indexed.
