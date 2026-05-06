# rez-notification-events

## 1. Purpose, Tech Stack, and Architecture Position

**Purpose**: The notification delivery engine for the REZ platform. Receives notification jobs from any REZ service and delivers them across five channels: push (Expo), email (SendGrid), SMS (MSG91), WhatsApp (Twilio or Meta), and in-app (MongoDB write). This service has no HTTP API — it is a pure worker process with a minimal health server.

**Architecture position**: Downstream consumer of the shared `notification-events` BullMQ queue. Multiple producers write to this queue: rez-marketing-service, rez-backend (gamification, coins), rez-wallet-service, and the streak-at-risk scheduler within this service itself. Output is delivery to end users and in-app notification records written to MongoDB.

**Tech stack**:
- Runtime: Node.js 20.x, TypeScript
- Queue: BullMQ 5 on Redis (IORedis)
- Push: Expo Server SDK 3.7
- Email: SendGrid (`@sendgrid/mail`)
- SMS: MSG91 flow API (native fetch)
- WhatsApp: Twilio (primary), Meta Graph API v18.0 (fallback)
- In-app: MongoDB direct write (raw `notifications` collection)
- Health server: bare Node.js `http` module (no Express)
- Default health port: **3001**

---

## 2. API Routes

This service has no HTTP API for business logic.

### Health endpoints (port 3001)

These are served by a minimal `http.createServer` — not Express.

| Method | Path | Response |
|--------|------|----------|
| GET | `/health` | `{"status":"ok","uptime":1234}` (200) or `{"status":"unhealthy"}` (503) |
| GET | `/healthz` | Same as `/health` |
| GET | `/ready` | `{"status":"ready"}` (200) |
| * | All other paths | 404 (empty body) |

The `isHealthy` flag is set to `true` on startup. There is no automatic mechanism that sets it to `false` in the current codebase — this is a hook point for future liveness probes.

---

## 3. Background Workers and Jobs

### Main notification worker

- **Queue consumed**: `notification-events`
- **Concurrency**: 10
- **Rate limiter**: max 200 jobs per 1 second
- **Retry policy**: 5 attempts, exponential backoff starting at 2000ms (set by job producers via `defaultJobOptions`)
- **Queue name**: `notification-events`

#### Job structure (NotificationEvent)

All producers must publish jobs with this shape:

```json
{
  "eventId": "unique-event-id (e.g. streak:userId:timestamp)",
  "eventType": "coin_earned | streak_milestone | streak_at_risk | merchant_broadcast | ...",
  "userId": "MongoDB user ID string",
  "channels": ["push", "email", "sms", "whatsapp", "in_app"],
  "payload": {
    "title": "string",
    "body": "string",
    "data": { "...extra context..." },
    "channelId": "default | streaks | marketing | promotions",
    "priority": "default | high | normal",
    "emailSubject": "string (required for email channel)",
    "emailHtml": "string (optional, falls back to body)",
    "smsMessage": "string (optional, falls back to body)",
    "whatsappTemplateId": "template-name (optional)",
    "whatsappTemplateVars": ["var1", "var2"]
  },
  "category": "behavioral | marketing | transactional",
  "source": "rez-backend | rez-marketing-service | ...",
  "createdAt": "ISO date string"
}
```

Critical note: sending a flat `{userId, title, body}` object causes silent failures. The worker destructures `channels` and `payload` directly — if they are missing (undefined), all channel handlers are skipped and the job completes with empty results.

#### Channel routing logic

For each job, the worker iterates over `event.channels` and calls the appropriate handler. Results are collected per-channel and logged.

**push**: Looks up `userdevices` collection for documents matching `userId` with a non-null `pushToken`. Filters for valid Expo tokens (`Expo.isExpoPushToken()`). Sends via Expo SDK in chunks. Returns `sent:{N}`, `skipped:no-push-token`, or `skipped:no-valid-tokens`.

**email**: Requires `payload.emailSubject` and `payload.data.email`. Uses SendGrid API (`SENDGRID_API_KEY`). Falls back to `payload.body` for HTML if `payload.emailHtml` is not provided.

**sms**: Requires `payload.data.phone` and message (`payload.smsMessage` or `payload.body`). Uses MSG91 Flow API (`MSG91_API_KEY` + `MSG91_FLOW_ID`).

**whatsapp**: Requires `payload.data.phone`. Tries Twilio WhatsApp first (`TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_WHATSAPP_FROM`). If not configured, falls back to Meta Graph API v18.0 (`WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`). Supports template messages via `whatsappTemplateId` + `whatsappTemplateVars`.

**in_app**: Writes directly to MongoDB `notifications` collection. No external API call. Always succeeds unless MongoDB is unavailable.

#### Behavioral event observability

Jobs with `eventType` in `['coin_earned', 'streak_milestone', 'streak_at_risk']` receive an additional `[Worker] Behavioral notification delivered` log entry for observability.

---

### Streak-at-risk scheduler

- **Scheduler queue**: `streak-at-risk-scheduler` (BullMQ repeatable job queue)
- **Worker queue**: `streak-at-risk-scheduler` (same queue, single concurrency worker)
- **Cron**: `0 19 * * *` (7:00 PM UTC every day)
- **Queue produced**: `notification-events`

At 7 PM UTC each day, queries the `userstreaks` MongoDB collection for users with:
- `type: 'store_visit'`
- `currentStreak >= 1`
- `lastActivityDate = yesterday's date string`

For each at-risk user, enqueues a `streak_at_risk` job to `notification-events` in batches of 100:

```json
{
  "eventId": "streak-at-risk-{userId}-{timestamp}",
  "eventType": "streak_at_risk",
  "userId": "...",
  "channels": ["push", "in_app"],
  "payload": {
    "title": "Don't break your streak!",
    "body": "Don't break your {N}-day streak! Visit any store today.",
    "channelId": "streaks",
    "priority": "high",
    "data": { "currentStreak": N }
  },
  "category": "behavioral",
  "source": "streak-at-risk-scheduler"
}
```

The repeatable job is registered with `upsertJobScheduler()` — calling it multiple times is idempotent.

---

### DLQ worker (dead-letter queue handler)

- **Source queue monitored**: `notification-events`
- **DLQ queue**: `notification-dlq`
- **MongoDB collection**: `dlq_log`

The DLQ handler attaches to the running `notification-events` Worker instance via its `failed` event listener (it does not create a second consumer). When a job's `attemptsMade >= job.opts.attempts` (all retries exhausted), it:

1. Publishes a `dlq-entry` job to the `notification-dlq` BullMQ queue (retained indefinitely, `removeOnComplete: false`, `removeOnFail: false`)
2. Writes a record to the `dlq_log` MongoDB collection

DLQ log document structure:
```json
{
  "jobName": "string",
  "data": { "...original job payload..." },
  "error": "error message",
  "failedAt": "ISO date string",
  "attempts": 5,
  "processedAt": "ISO date string"
}
```

A QueueEvents listener (`_queueEvents`) provides an independent monitoring stream for the source queue without consuming jobs.

**To replay a DLQ job**: Read the original job payload from `dlq_log` and re-publish it to `notification-events` with a new `eventId`.

---

## 4. Security Mechanisms

- **No inbound API security needed**: The service exposes only health endpoints, which have no authentication.
- **Internal queue security**: Access to the BullMQ Redis queues is controlled at the Redis level. The service reads from queues that only trusted internal services can write to.
- **No credential exposure**: SendGrid, MSG91, Twilio, and WhatsApp API keys are loaded from environment variables only.
- **Phone number masking in logs**: Phone numbers in logs are redacted to show only the last 4 digits (not present in this service's logs currently, but the pattern is followed by upstream marketing service).
- **DLQ retention**: Failed jobs and their payloads are retained indefinitely in both BullMQ (`notification-dlq`) and MongoDB (`dlq_log`) for post-mortem inspection. These records may contain PII (userId, event data). Ensure `dlq_log` has appropriate access controls and a TTL index if required by data retention policy.

---

## 5. Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection URL for BullMQ |

### Push (Expo)

No API key required. Expo Push API is open.

### Email

| Variable | Description |
|----------|-------------|
| `SENDGRID_API_KEY` | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | Sender address (default `noreply@rez.app`) |

### SMS

| Variable | Description |
|----------|-------------|
| `MSG91_API_KEY` | MSG91 auth key |
| `MSG91_FLOW_ID` | MSG91 flow ID for transactional SMS |

### WhatsApp

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID (primary WhatsApp provider) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | Twilio WhatsApp number (e.g. `whatsapp:+14155238886`) |
| `WHATSAPP_API_TOKEN` | Meta API token (fallback) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID (fallback) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Health server port |
| `NODE_ENV` | `production` | Logging verbosity |

---

## 6. Data Models

### notifications (MongoDB collection — written by in_app handler)

| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | Target user |
| `title` | String | Notification title |
| `body` | String | Notification body |
| `type` | String | Event type (e.g. `coin_earned`, `streak_at_risk`) |
| `category` | String | `behavioral`, `marketing`, `transactional` |
| `data` | Object | Event-specific extra data |
| `isRead` | Boolean | Default `false` |
| `createdAt` | Date | From `event.createdAt` |

### userdevices (MongoDB collection — read by push handler)

| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | User ID |
| `pushToken` | String | Expo push token (`ExponentPushToken[...]`) |

### userstreaks (MongoDB collection — read by streak scheduler)

| Field | Type | Description |
|-------|------|-------------|
| `userId` | String/ObjectId | User ID |
| `type` | String | `store_visit` (the only type checked) |
| `currentStreak` | Number | Current consecutive-day streak |
| `lastActivityDate` | String | Date string in `YYYY-MM-DD` format |

### dlq_log (MongoDB collection — written by DLQ handler)

See DLQ section above for field definitions.

---

## 7. Local Development and Testing

### Setup

```bash
cd rez-notification-events
cp .env.example .env    # fill in MONGODB_URI, REDIS_URL, SENDGRID_API_KEY (optional)

npm install
npm run dev             # ts-node
```

Minimum `.env` to start:
```env
MONGODB_URI=mongodb://localhost:27017/rez
REDIS_URL=redis://localhost:6379
```

Without channel credentials, the worker starts fine — channel handlers return `skipped:no-*` results.

### Publishing a test notification

```javascript
const { Queue } = require('bullmq');
const q = new Queue('notification-events', {
  connection: { host: 'localhost', port: 6379 }
});

// Test in_app notification (no credentials required)
await q.add('test-notification', {
  eventId: `test-${Date.now()}`,
  eventType: 'test',
  userId: '64abc123def456789012345',
  channels: ['in_app'],
  payload: {
    title: 'Test notification',
    body: 'Hello from dev',
    channelId: 'default'
  },
  category: 'transactional',
  source: 'dev-test',
  createdAt: new Date().toISOString()
});
```

### Testing push delivery

Requires a real Expo push token from the REZ consumer app. The `userdevices` collection must have a document with the target `userId` and a valid `pushToken`.

### Triggering streak-at-risk manually

Insert a document into `userstreaks`:
```javascript
db.userstreaks.insertOne({
  userId: "64abc123def456789012345",
  type: "store_visit",
  currentStreak: 7,
  lastActivityDate: new Date(Date.now() - 86400000).toISOString().split('T')[0]
});
```

Then call `runStreakAtRiskCheck()` directly from a REPL, or wait for the 7 PM UTC cron. The streakAtRiskWorker will enqueue a notification job for this user.

### Checking health

```bash
curl http://localhost:3001/health
# {"status":"ok","uptime":123.4}

curl http://localhost:3001/ready
# {"status":"ready"}
```

---

## 8. Troubleshooting

**Jobs completing silently with empty channel results**: The job payload is not following the `NotificationEvent` shape. If `channels` is undefined or `payload` is a flat object without the expected fields, all handlers return early. Always include `channels: ["in_app"]` at minimum, and `payload: { title, body }`.

**Push: `skipped:no-push-token`**: The `userdevices` MongoDB collection has no document for this `userId`, or the document exists but `pushToken` is null/missing. Verify device registration from the consumer app.

**Push: `skipped:no-valid-tokens`**: Push tokens exist but are not in Expo format. `Expo.isExpoPushToken()` validates the format. Raw FCM token strings will fail this check. Consumer app must use `expo-notifications` to generate tokens.

**Email: `skipped:no-subject`**: `payload.emailSubject` is not set. Email channel requires this field explicitly.

**Email: `skipped:no-email`**: `payload.data.email` is not set. The job producer must include the recipient email address in `payload.data.email`.

**SMS: `skipped:no-sms-provider`**: `MSG91_API_KEY` is not set. No Twilio SMS fallback exists in this service (Twilio is used for WhatsApp, not SMS).

**WhatsApp: `skipped:no-phone`**: `payload.data.phone` is not set. The job producer must include the phone number in `payload.data.phone`.

**DLQ jobs accumulating**: Inspect `db.dlq_log.find().sort({failedAt:-1}).limit(10)` to see the most recent failures. Common causes: MongoDB unavailable during `in_app` handler, Expo token invalid, SendGrid API key expired. Fix the root cause and replay jobs by re-publishing the `originalJob` payload to `notification-events`.

**Streak scheduler not firing**: The repeatable job is registered via `upsertJobScheduler`. Check that it was registered successfully in logs (`[StreakAtRisk] Repeatable job registered`). Inspect the `streak-at-risk-scheduler` BullMQ queue for the repeatable job entry. If the service restarts cleanly, the scheduler re-registers on boot.

**`dlq_log` MongoDB write failing after DLQ queue write succeeds**: The DLQ queue entry was already saved — the failure is logged but non-fatal. MongoDB connectivity issue during the secondary write. The job data is still in the `notification-dlq` BullMQ queue for inspection.

**Worker consuming jobs too slowly**: Concurrency is set to 10 with a rate limit of 200 jobs/second. If the volume exceeds this, scale horizontally by running multiple instances of this service — BullMQ distributes jobs across all workers consuming the same queue and Redis instance.
