# rez-gamification-service

## 1. Purpose, Tech Stack, and Architecture Position

**Purpose:** Processes all gamification events for the REZ platform — achievements, store visit streaks, leaderboards, and coin awards. Every time a user does something rewarding (checks in to a store, maintains a daily streak, unlocks an achievement), this service evaluates eligibility, credits coins to the user's wallet, records the transaction, and dispatches notifications. It is the single source of truth for earned coins from behavioral actions.

**Architecture position:** Phase C extraction from the REZ monolith using the Strangler Fig pattern. Runs multiple concurrent processes in one Node.js process:
- A **general gamification BullMQ worker** consuming the `gamification-events` queue (published by the monolith).
- An **achievement BullMQ worker** consuming the same `gamification-events` queue, evaluating achievement unlock conditions.
- A **store-visit streak BullMQ worker** consuming the `store-visit-events` queue.
- An **Express HTTP server** on `PORT` serving REST endpoints for achievement/streak queries and an internal visit ingestion endpoint.
- A **Redis pub/sub subscriber** listening on `game-config:updated` for hot-reload of game configuration without restart.

This service is called by:
- The monolith (publishes events to BullMQ queues)
- The consumer mobile app (via `rez-api-gateway` — achievement and streak display routes)
- Internal services (POST `/internal/visit` for direct visit recording)

This service produces to:
- `notification-events` queue (achievement_unlocked, coin_earned, streak_milestone notifications consumed by the notification service)

**Tech stack:**

| Layer | Technology |
|---|---|
| Runtime | Node.js 20.x |
| Language | TypeScript 5.x |
| HTTP framework | Express 4 |
| Queue | BullMQ 5 (backed by Redis) |
| Database | MongoDB (Mongoose 8 / raw collection access) |
| Cache | ioredis 5, in-process Map (leaderboard) |
| Security | helmet, internal token auth |
| Observability | Winston, Prometheus-format `/metrics` endpoint |

---

## 2. API Routes

The HTTP server listens on `PORT` (default 3004). It is started with `startHttpServer(port)`.

### Authentication

All routes except `/health`, `/healthz`, `/health/live`, `/health/ready`, `/metrics`, and `/leaderboard` require an `X-Internal-Token` header. The middleware reads `INTERNAL_SERVICE_TOKENS_JSON` (JSON map of `serviceName → token`). The caller must also send `X-Internal-Service: <serviceName>`. Comparison is timing-safe via `crypto.timingSafeEqual`. Returns 401 on invalid token, 503 if the env var is not configured.

**Exception: `/leaderboard`** — this route is public (no auth required) to allow the consumer app to display it without internal credentials.

---

### Health — Liveness

**GET `/health`**
Auth: none

Checks MongoDB connection state. Returns 503 if not connected.

Response (healthy):
```json
{
  "status": "ok",
  "service": "rez-gamification-service",
  "checks": { "db": "ok" },
  "uptime": 3842.5,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**GET `/healthz`** — alias, always 200 if the process is alive (no dependency checks).

**GET `/health/live`** — Kubernetes/Render liveness probe. Always 200 while the process runs.

**GET `/health/ready`** — Kubernetes/Render readiness probe. 503 if MongoDB is not connected.

---

### Achievements

**GET `/achievements/:userId`**
Auth: `X-Internal-Token` required

Returns all achievements for a user, split into earned and locked (with progress tracking).

Data fetched in parallel: `userachievements` (earned), `storevisits` count, `userstreaks` (streak), `userwallets` (coin balance).

Response:
```json
{
  "success": true,
  "data": {
    "earned": [
      {
        "id": "first_checkin",
        "name": "First Visit",
        "description": "Complete your first store check-in",
        "coins": 25,
        "earnedAt": "2024-01-10T08:15:00Z"
      }
    ],
    "locked": [
      {
        "id": "tenth_checkin",
        "name": "Loyal Customer",
        "description": "Visit stores 10 times",
        "coins": 150,
        "condition": "visit_count >= 10",
        "progress": 6,
        "target": 10,
        "percentComplete": 60
      }
    ]
  }
}
```

Progress is derived from user stats against the achievement's condition string (`visit_count >= N`, `streak >= N`, `total_coins >= N`). For conditions not matching these patterns, progress and target are both 0.

---

### Streak

**GET `/streak/:userId`**
Auth: `X-Internal-Token` required

Returns the user's current store visit streak and savings streak from `userstreaks` collection. A streak is considered "active" if `lastActivityDate` is today or yesterday.

Response:
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "currentStreak": 5,
    "longestStreak": 12,
    "lastActivityDate": "2024-01-15",
    "streakActive": true,
    "storeVisit": {
      "currentStreak": 5,
      "longestStreak": 12,
      "lastActivityDate": "2024-01-15",
      "streakActive": true
    },
    "savings": {
      "currentStreak": 2,
      "longestStreak": 7,
      "lastActivityDate": "2024-01-14",
      "streakActive": true
    }
  }
}
```

Top-level `currentStreak` / `longestStreak` / `lastActivityDate` / `streakActive` reflect the `store_visit` type for backward compatibility with the consumer app.

---

### Leaderboard (top 10)

**GET `/leaderboard`**
Auth: none (public)

Returns the top 10 users by lifetime coins earned, with tier classification. Cached in-process for 5 minutes.

Aggregation: sums `amount` from `cointransactions` where `type: 'earned'`, joins with `users` collection for display names.

Tier thresholds:
- `bronze` — < 500 lifetime coins
- `silver` — 500–1999
- `gold` — 2000–4999
- `platinum` — >= 5000

Response:
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "userId": "...",
      "displayName": "Rahul",
      "lifetimeCoins": 8420,
      "tier": "platinum"
    }
  ]
}
```

---

### Leaderboard — My Rank

**GET `/leaderboard/me?userId=<userId>`**
Auth: `X-Internal-Token` required

Returns the calling user's rank and the 2 users above and below them (±2 neighbours). Fetches the full unbounded leaderboard to determine position. Does not use the 5-minute cache.

Response:
```json
{
  "success": true,
  "data": {
    "me": { "rank": 47, "userId": "...", "displayName": "Priya", "lifetimeCoins": 1250, "tier": "silver" },
    "neighbours": [
      { "rank": 45, ... },
      { "rank": 46, ... },
      { "rank": 47, ... },
      { "rank": 48, ... },
      { "rank": 49, ... }
    ]
  }
}
```

Returns 400 if `userId` is absent. Returns 404 if the user has no coin transactions.

---

### Internal Visit Ingestion

**POST `/internal/visit`**
Auth: `X-Internal-Token` required

Direct synchronous visit recording. Use this when the caller needs an immediate response with coins awarded (e.g. QR scan flow). For fire-and-forget volume traffic, publish to the `store-visit-events` BullMQ queue instead.

Body:
```json
{
  "userId": "user123",
  "storeId": "store456",
  "merchantId": "merchant789",
  "timestamp": "2024-01-15T10:30:00Z",
  "eventId": "qr-scan-abc-123"
}
```

`userId` and `storeId` are required. `eventId` is optional but strongly recommended — it provides idempotency on retries (duplicates are detected via the `processedvisitevents` collection).

**Visit milestone logic:**

| Total visits | Coins awarded |
|---|---|
| 7 | 50 nuqta |
| 30 | 200 nuqta |
| 100 | 500 nuqta |

The total visit count is tracked in `uservisitcounts` (cross-store, per user). Milestone coins are awarded exactly once via a dedup key in `coinledgers`. Wallet is credited and a `cointransactions` record is written.

After milestone processing, the same streak logic as the BullMQ worker runs (`processStoreVisitInternal`).

Response:
```json
{
  "success": true,
  "data": {
    "totalVisits": 7,
    "coinsAwarded": 50,
    "milestoneReached": 7
  }
}
```

`coinsAwarded: 0` and `milestoneReached: null` when no milestone was hit.

---

### Dead-Letter Queue Inspection

**GET `/internal/dlq/:queueName`**
Auth: `X-Internal-Token` required

Inspect the Redis dead-letter list for a given queue. Parameters: `start` (default 0), `end` (default 49).

Response:
```json
{
  "success": true,
  "data": {
    "queueName": "gamification-events",
    "dlqKey": "dlq:gamification-events",
    "total": 3,
    "jobs": [
      { "jobId": "...", "data": {}, "error": "...", "failedAt": "...", "attempts": 3 }
    ],
    "page": { "start": 0, "end": 49 }
  }
}
```

---

### Prometheus Metrics

**GET `/metrics`**
Auth: none (internal network only)

Returns Prometheus text exposition format.

Metrics exposed:

| Metric | Type | Description |
|---|---|---|
| `process_uptime_seconds` | gauge | Process uptime |
| `http_requests_total` | counter | All HTTP requests |
| `http_errors_total` | counter | HTTP 5xx responses |
| `gamification_jobs_processed_total{jobName}` | counter | Jobs processed per event type |
| `gamification_jobs_failed_total{jobName}` | counter | Jobs failed per event type |
| `gamification_job_duration_seconds_sum{jobName}` | gauge | Sum of job durations in seconds |
| `gamification_job_duration_seconds_count{jobName}` | gauge | Duration observation count |
| `gamification_active_workers` | gauge | Number of active worker instances |

---

## 3. Background Workers and Jobs

### General Gamification Worker

**Queue consumed:** `gamification-events`
**Concurrency:** 5
**Rate limit:** 100 jobs/second

Processes `ActivityEvent` messages:

```typescript
interface ActivityEvent {
  eventId: string;
  type: string;       // e.g. 'order_placed', 'visit_checked_in', 'review_submitted'
  userId: string;
  data?: Record<string, any>;
  timestamp?: string;
}
```

For each event, the worker runs 6 steps (all errors are caught individually — partial failure does not abort the job):

1. **Achievement progress** — increments `metrics.<metric>.current` in `userachievementprogresses` based on event type mapping.
2. **Challenge progress** — increments `actions.<action>.current` in `userchallengeprogresses` for active challenges matching the event type.
3. **Streak update** — upserts/updates `userstreaks` for the relevant streak type. Correctly handles today (idempotent), consecutive day (increment), and gap > 1 day (reset to 1).
4. **Leaderboard cache invalidation** — deletes Redis keys `leaderboard:weekly` and `leaderboard:monthly` for leaderboard-affecting events.
5. **Mission progress** — increments `tasks.$.current` in `usermissions` for active missions matching the event type.
6. **Coin earned notification** — for `store_payment_confirmed` (default 50 coins) and `visit_checked_in` (default 10 coins) events, enqueues a `coin_earned` notification to `notification-events`.

**Event-to-metric mapping** (step 1):
- `order_placed` → `orders_placed`
- `order_delivered` → `orders_completed`
- `review_submitted` → `reviews_written`
- `referral_completed` → `referrals_made`
- `login` → `login_count`
- `daily_checkin` → `checkin_count`
- `bill_uploaded` → `bills_uploaded`
- `social_share` → `shares_count`
- `offer_redeemed` → `offers_redeemed`
- `game_won` → `games_won`
- `store_payment_confirmed` → `payments_made`

**Dead-letter queue:** Jobs that exhaust all retry attempts are pushed to `dlq:gamification-events` in Redis (Redis list, capped at 1000 entries). Inspect via `GET /internal/dlq/gamification-events`.

---

### Achievement Worker

**Queue consumed:** `gamification-events` (same queue as general worker)
**Concurrency:** 5
**Rate limit:** 100 jobs/second

Only processes events with `type === 'visit_checked_in'`. For each such event:

1. Fetches user stats in parallel: total visit count (`storevisits`), current streak (`userstreaks` type `store_visit`), wallet balance (`wallets`).
2. Fetches earned achievement IDs (`userachievements`).
3. Evaluates every achievement in the hardcoded catalogue against the user's stats.
4. For each newly earned achievement:
   - Upserts to `userachievements` with `$setOnInsert` (race-condition safe).
   - Writes a dedup-keyed entry to `coinledgers`.
   - Credits `wallets.balance.available` and `wallets.balance.total`.
   - Writes a `cointransactions` record for audit trail.
   - Enqueues `achievement_unlocked` to `notification-events`.

**Idempotency:** The `coinledgers` upsert uses `dedupKey = "achievement-<userId>-<achievementId>"`. If BullMQ retries the job, the ledger entry already exists and no double-credit occurs.

**Dead-letter queue:** Same pattern — `dlq:gamification-events`.

**Achievement catalogue (hardcoded, not stored in DB):**

| ID | Name | Condition | Coins |
|---|---|---|---|
| `first_checkin` | First Visit | `visit_count >= 1` | 25 |
| `fifth_checkin` | Regular | `visit_count >= 5` | 75 |
| `tenth_checkin` | Loyal Customer | `visit_count >= 10` | 150 |
| `first_streak` | Streak Starter | `streak >= 3` | 50 |
| `week_streak` | Week Warrior | `streak >= 7` | 150 |
| `coin_century` | Century Club | `total_coins >= 100` | 50 |
| `coin_thousand` | High Roller | `total_coins >= 1000` | 200 |

---

### Store Visit Streak Worker

**Queue consumed:** `store-visit-events`
**Concurrency:** 5
**Rate limit:** 100 jobs/second

Processes `StoreVisitEvent` messages:

```typescript
interface StoreVisitEvent {
  eventId: string;
  userId: string;
  merchantId: string;
  storeId: string;
  timestamp?: string;   // ISO date string; defaults to now
}
```

**Streak logic:**

The worker reads the user's existing `userstreaks` document (type `store_visit`) and computes the day difference between `lastActivityDate` and the event date:

- `diff === 0` (same day): streak unchanged, no coins awarded.
- `diff === 1` (consecutive day): streak incremented, longest streak updated.
- `diff > 1` (gap): streak reset to 1. `streakStartDate` is updated to today.

**Milestone coin awards:**

| Streak days | Coins |
|---|---|
| 3 | 50 nuqta |
| 7 | 150 nuqta |
| 30 | 500 nuqta |

Coins are awarded only on `incremented` actions. The dedup key is `streak-milestone-<userId>-<days>-<streakStartDate>`, which includes `streakStartDate` so users can re-earn a milestone after losing and rebuilding their streak.

On each milestone hit, two notifications are enqueued to `notification-events`:
1. `streak_milestone` — "You're on a N-day streak!"
2. `coin_earned` — "+N REZ coins landed in your wallet!"

**Wallet crediting:** Uses the shared `wallets` collection (not a separate `userwallets` collection). `balance.available`, `balance.total`, and `statistics.totalEarned` are all incremented.

**Dead-letter queue:** Permanently failed jobs are pushed to `dlq:store-visit-events` (capped at 1000).

---

### Notifications Produced

Both the achievement worker and streak worker write to the `notification-events` BullMQ queue. The notification service consumes this queue.

| Job name | Produced by | Channels | Priority |
|---|---|---|---|
| `achievement_unlocked` | Achievement worker | `push`, `in_app` | `high` |
| `coin_earned` (from achievement) | Achievement worker | `push`, `in_app` | `default` |
| `streak_milestone` | Streak worker | `push`, `in_app` | `high` |
| `coin_earned` (from streak) | Streak worker | `push`, `in_app` | `default` |
| `coin_earned` (from general worker) | General gamification worker | `push`, `in_app` | `default` |

All notification jobs are configured with `attempts: 3, backoff: { type: 'exponential', delay: 5000 }`.

---

## 4. Redis Pub/Sub: Game Config Hot-Reload

**Channel:** `game-config:updated`

On startup, the service subscribes to this Redis channel using a duplicated connection from `bullmqRedis`. When a message is received, the payload is parsed and logged:

```json
{
  "action": "reload",
  "gameType": "achievements",
  "configId": "cfg_v2",
  "scope": "single"
}
```

Current behaviour: the handler only logs the update — it does not dynamically change the achievement catalogue (which is hardcoded). The pub/sub infrastructure is in place for future hot-reload of configurable game parameters (point multipliers, bonus windows, etc.) without restarting the service.

**To publish a config update:**
```bash
redis-cli PUBLISH game-config:updated '{"action":"reload","gameType":"achievements","scope":"all"}'
```

---

## 5. Security Mechanisms

| Mechanism | Detail |
|---|---|
| Internal token auth | All non-public endpoints require `X-Internal-Token` + `X-Internal-Service` headers. Token is validated per-service from `INTERNAL_SERVICE_TOKENS_JSON`. Timing-safe comparison. Returns 503 if env var missing. |
| Leaderboard public exception | `/leaderboard` is intentionally unauthenticated — displays only display names and coin totals, no PII. |
| Helmet | Standard security HTTP headers on all responses. |
| Idempotency | All coin credits use `dedupKey` + `$setOnInsert` in `coinledgers`. Achievement unlocks use `$setOnInsert` in `userachievements`. Visit events use `processedvisitevents` collection with atomic upsert. |
| Race condition protection | `userachievements` upsert checks `upsertedCount === 0` to detect races — if two workers process the same event concurrently, only one insert succeeds and the other is a no-op. |
| Dead-letter queues | Permanently failed BullMQ jobs are pushed to Redis lists (`dlq:<queue>`) capped at 1000 entries, inspectable via `/internal/dlq/:queueName`. |

---

## 6. Environment Variables

### Required

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string. Must share the same database as the monolith (shared `wallets`, `cointransactions`, etc.). |
| `REDIS_URL` | Redis connection URL. Used by BullMQ and the pub/sub subscriber. |
| `INTERNAL_SERVICE_TOKENS_JSON` | JSON map of `serviceName → token`. Example: `{"consumer-app":"secret1","rez-admin":"secret2"}`. Takes precedence over legacy `INTERNAL_SERVICE_TOKEN`. |

`INTERNAL_SERVICE_TOKEN` (legacy) is also accepted as a fallback when `INTERNAL_SERVICE_TOKENS_JSON` is absent, but is deprecated.

### Optional

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3004` | HTTP server listen port (also used by Render's public URL). |
| `SERVICE_NAME` | `rez-gamification-service` | Service label for logs. |

---

## 7. Data Models

All collections are shared with the monolith. Access is via raw `mongoose.connection.collection()`.

### `userachievements` (written by achievement worker)

| Field | Type | Notes |
|---|---|---|
| `userId` | string | |
| `achievementId` | string | Matches `id` in achievement catalogue |
| `earnedAt` | Date | |
| `coinsAwarded` | number | Snapshot of coins at time of award |

**Required index:** `{ userId: 1, achievementId: 1 }` unique.

### `userstreaks` (written by streak worker and general worker)

| Field | Type | Notes |
|---|---|---|
| `userId` | string | |
| `type` | string | `'store_visit'`, `'login'`, `'order'`, `'review'`, `'savings'` |
| `currentStreak` | number | |
| `longestStreak` | number | |
| `lastActivityDate` | string | `YYYY-MM-DD` format |
| `streakStartDate` | string | When the current streak cycle started — used in milestone dedup key |
| `lastStoreId` | string | Set by streak worker (used by search service for trending) |
| `lastMerchantId` | string | |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Required index:** `{ userId: 1, type: 1 }` unique.

### `coinledgers` (written by all coin-awarding paths)

| Field | Type | Notes |
|---|---|---|
| `userId` | string | |
| `amount` | number | |
| `type` | string | `'credit'` |
| `source` | string | `'achievement'`, `'streak_milestone'`, `'visit_milestone'` |
| `description` | string | Human-readable reason |
| `dedupKey` | string | Unique idempotency key per award event |
| `createdAt` | Date | |

**Required index:** `{ dedupKey: 1 }` unique.

### `cointransactions` (written on every coin award for audit trail)

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId | |
| `type` | string | `'earned'` |
| `coinType` | string | `'nuqta'` |
| `amount` | number | |
| `source` | string | `'gamification'` |
| `description` | string | |
| `metadata` | object | `{ achievementId?, dedupKey, partnerEarning: false }` |
| `createdAt` | Date | |

Also read by the leaderboard endpoint to compute lifetime coin totals.

### `wallets` (written by all coin credit paths)

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId | |
| `balance.available` | number | Incremented on each award |
| `balance.total` | number | Incremented on each award |
| `statistics.totalEarned` | number | Running total of all earned coins |
| `statistics.transactionCount` | number | |
| `updatedAt` | Date | |
| `createdAt` | Date | |

### `processedvisitevents` (idempotency store for POST /internal/visit)

| Field | Type | Notes |
|---|---|---|
| `eventId` | string | Provided by caller |
| `userId` | string | |
| `processedAt` | Date | |

**Required index:** `{ eventId: 1 }` unique.

### `uservisitcounts` (visit milestone tracking)

| Field | Type | Notes |
|---|---|---|
| `userId` | string | |
| `totalVisits` | number | Incremented atomically via `$inc` |
| `updatedAt` | Date | |
| `createdAt` | Date | |

**Required index:** `{ userId: 1 }` unique.

### `userachievementprogresses` (written by general gamification worker)

| Field | Type | Notes |
|---|---|---|
| `userId` | string | |
| `metrics` | object | `{ <metricName>: { current, target } }` |

### `userchallengeprogresses` (written by general gamification worker)

| Field | Type | Notes |
|---|---|---|
| `userId` | string | |
| `status` | string | `'active'` |
| `actions` | object | `{ <actionName>: { current, target } }` |

### `usermissions` (written by general gamification worker)

| Field | Type | Notes |
|---|---|---|
| `userId` | string | |
| `status` | string | `'active'` |
| `tasks` | array | `[{ eventType, current, target }]` |

### `storevisits` (read-only from this service)

Used to count total visits per user for achievement evaluation.

### `users` (read-only)

Used by leaderboard to resolve `firstName` / `name` display names.

---

## 8. Local Development and Testing

### Prerequisites

- Node.js 20.x
- MongoDB (shared with monolith or seeded local copy)
- Redis >= 6.2

### Setup

```bash
cd rez-gamification-service
cp .env.example .env      # if absent, create manually
npm install
```

Minimum `.env`:
```
MONGODB_URI=mongodb://localhost:27017/rez
REDIS_URL=redis://localhost:6379
INTERNAL_SERVICE_TOKENS_JSON={"dev-client":"dev-secret"}
```

### Run in development

```bash
npm run dev           # ts-node src/index.ts
```

Service starts:
- HTTP server on `http://localhost:3004`
- General gamification worker (queue: `gamification-events`)
- Achievement worker (queue: `gamification-events`)
- Store visit streak worker (queue: `store-visit-events`)
- Redis pub/sub on `game-config:updated`

### Build and run compiled

```bash
npm run build && npm start
```

### Type-check

```bash
npm run lint          # tsc --noEmit
```

### Manually publish a gamification event

```bash
# Using the BullMQ CLI or a quick Node.js snippet:
node -e "
const { Queue } = require('bullmq');
const q = new Queue('gamification-events', { connection: { host: 'localhost', port: 6379 } });
q.add('visit_checked_in', {
  eventId: 'test-001',
  type: 'visit_checked_in',
  userId: 'user123',
  timestamp: new Date().toISOString()
}).then(() => { console.log('added'); process.exit(0); });
"
```

### Publish a store visit event

```bash
node -e "
const { Queue } = require('bullmq');
const q = new Queue('store-visit-events', { connection: { host: 'localhost', port: 6379 } });
q.add('store_visit', {
  eventId: 'sv-001',
  userId: 'user123',
  merchantId: 'merchant456',
  storeId: 'store789',
  timestamp: new Date().toISOString()
}).then(() => { console.log('added'); process.exit(0); });
"
```

### Call HTTP endpoints

```bash
# Achievements for a user (requires internal token)
curl -H "X-Internal-Token: dev-secret" \
     -H "X-Internal-Service: dev-client" \
     http://localhost:3004/achievements/user123

# Streak
curl -H "X-Internal-Token: dev-secret" \
     -H "X-Internal-Service: dev-client" \
     http://localhost:3004/streak/user123

# Leaderboard (no auth)
curl http://localhost:3004/leaderboard

# Internal visit (synchronous, with milestone check)
curl -X POST http://localhost:3004/internal/visit \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: dev-secret" \
  -H "X-Internal-Service: dev-client" \
  -d '{"userId":"user123","storeId":"store456","merchantId":"merchant789","eventId":"test-visit-001"}'

# Dead-letter queue inspection
curl -H "X-Internal-Token: dev-secret" \
     -H "X-Internal-Service: dev-client" \
     "http://localhost:3004/internal/dlq/gamification-events"

# Prometheus metrics
curl http://localhost:3004/metrics
```

### Required MongoDB indexes

```js
db.userachievements.createIndex({ userId: 1, achievementId: 1 }, { unique: true })
db.userstreaks.createIndex({ userId: 1, type: 1 }, { unique: true })
db.coinledgers.createIndex({ dedupKey: 1 }, { unique: true })
db.processedvisitevents.createIndex({ eventId: 1 }, { unique: true })
db.uservisitcounts.createIndex({ userId: 1 }, { unique: true })
db.cointransactions.createIndex({ user: 1, createdAt: -1 })
db.cointransactions.createIndex({ type: 1 })
```

---

## 9. Troubleshooting

**Service won't start — "Missing required env vars"**
Set `MONGODB_URI`, `REDIS_URL`, and either `INTERNAL_SERVICE_TOKENS_JSON` or `INTERNAL_SERVICE_TOKEN`. All three are validated at boot.

**Coins are not appearing in user wallets after achievement/streak**
The most common cause historically was writing to the wrong wallet collection (`userwallets` instead of `wallets`). The service has been fixed to always write to `wallets`. Confirm the `wallets` document exists for the user (it is created via `$setOnInsert` upsert, so it should be created automatically). Check `coinledgers` for a record with the expected `dedupKey` — if it exists, the credit was attempted. Then check `wallets.balance.available` directly.

**Achievement is not being awarded despite the condition being met**
1. Confirm the event type is `visit_checked_in` — the achievement worker only runs on this event type.
2. Check `userachievements` — if the achievement document already exists, it was already awarded (possibly on a previous job attempt).
3. Check `coinledgers` for a dedup key of the form `achievement-<userId>-<achievementId>`.
4. If the user's visit count in `storevisits` is being counted as 0, confirm the `userId` field type is consistent (the worker creates an ObjectId from userId for the wallet but uses it as a string for `storevisits.countDocuments`).

**Streak not incrementing**
The streak worker computes `dayDiff` between `lastActivityDate` (stored as `YYYY-MM-DD` string) and the event date. If the event's `timestamp` is missing or malformed, it defaults to `new Date()`. Confirm the `timestamp` field in the queued event is an ISO date string. Also check that `userstreaks` has the correct `type: 'store_visit'` field — a missing `type` will create a new document rather than updating the existing one.

**Streak milestones being awarded multiple times**
Normally prevented by the `dedupKey` in `coinledgers`. If duplicates are seen, check whether the `coinledgers` unique index on `dedupKey` exists. Without the index, concurrent retries can race past the upsert check.

**POST /internal/visit returns duplicate: true for a new event**
The `processedvisitevents` collection has a document with the same `eventId`. Either a genuine duplicate was submitted (the caller retried with the same `eventId`) or the index was not created and a previous upsert wrote the document without the unique constraint. Clear stale test data or use a new `eventId`.

**Leaderboard data is stale**
The leaderboard endpoint uses a 5-minute in-process cache. Wait for it to expire, or restart the service (the cache is module-level and is reset on restart). The cache is stored in the `leaderboardCache` variable in `httpServer.ts`.

**401 on all internal-token-protected routes**
- Verify `INTERNAL_SERVICE_TOKENS_JSON` is valid JSON.
- Verify both `X-Internal-Token` and `X-Internal-Service` headers are sent.
- The service name in `X-Internal-Service` must exactly match a key in the JSON map (case-sensitive).
- If `INTERNAL_SERVICE_TOKENS_JSON` is not set at all, the service returns 503, not 401.

**Dead-letter queue growing**
Inspect recent failures: `GET /internal/dlq/gamification-events`. Common causes: MongoDB write errors (check connection and indexes), ObjectId parsing failures (confirm `userId` is a valid ObjectId string when required), or notification queue failures (check `notification-events` queue health). Fix the root cause and re-enqueue jobs using BullMQ's retry API.

**`game-config:updated` messages are ignored**
The pub/sub handler currently only logs — it does not change runtime state. This is expected until the hot-reload feature is fully implemented. The achievement catalogue is hardcoded in `achievementWorker.ts`.
