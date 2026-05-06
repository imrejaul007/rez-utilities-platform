# ReZ Service Dependency Map

Comprehensive mapping of inter-service dependencies, shared databases, cache usage, and call patterns.

Last updated: 2026-04-16

## Service Registry

| Service | Port | Type | Description |
|---------|------|------|-------------|
| rez-auth-service | 4002 | HTTP API | User authentication, JWT, OTP, PIN |
| rez-order-service | 3006 | HTTP API + Worker | Order management, SSE streams |
| rez-payment-service | 4001 | HTTP API | Payment processing, Razorpay integration |
| rez-wallet-service | 4003 | HTTP API | User wallets, coins, transactions, payouts |
| rez-finance-service | 4005 | HTTP API | Credit offerings, EMI, borrowing plans |
| rez-marketing-service | 4006 | HTTP API | Campaigns, audiences, broadcasts |
| rez-merchant-service | 4007 | HTTP API | Merchant profiles, products, orders, analytics |
| rez-catalog-service | 4008 | HTTP API | Product catalog, categories, metadata |
| rez-search-service | 4009 | HTTP API | Full-text search, recommendations |
| rez-scheduler-service | 4010 | HTTP API | Job scheduling, cron, async tasks |
| rez-notification-events | 3001 | Worker | Push/email/SMS notifications (BullMQ) |
| analytics-events | 3002 | HTTP API + Worker | Event ingestion, analytics aggregation |
| rez-karma-service | 4011 | HTTP API | User karma, gamification, leaderboards |

## HTTP Call Dependencies

### rez-payment-service → rez-wallet-service
**When:** After successful payment capture
**What:** Credit user's wallet with coins
**Endpoint:** `POST /api/wallet/credit` or `/internal/credit`
**Env var:** `WALLET_SERVICE_URL`
**Impact:** If wallet service unavailable, payment is captured but coins not awarded (non-blocking)
**Retry:** Yes, with exponential backoff
**Failure mode:** Graceful degradation (payment succeeds, coins skipped)

### rez-finance-service → rez-wallet-service
**When:** Credit rewards for financial products used
**What:** Award coins on credit/EMI milestones
**Endpoint:** `POST /internal/credit` (internal token required)
**Env var:** `WALLET_SERVICE_URL`
**Impact:** Non-critical; service logs warning if unavailable
**Failure mode:** Coins not awarded, request continues

### rez-finance-service → rez-order-service
**When:** Calculating credit eligibility
**What:** Fetch user's 30-day order history and spending
**Endpoint:** `GET /orders/summary/:userId` (internal token required)
**Env var:** `ORDER_SERVICE_URL`
**Impact:** Critical for credit scoring; returns 30-day stats
**Pattern:** Direct MongoDB query preferred when possible
**Fallback:** Cached in Redis if order service slow

### rez-gamification-service → rez-wallet-service
**When:** User completes gamification action
**What:** Credit coins for achievements, streaks, etc.
**Endpoint:** `POST /internal/credit` (internal token required)
**Env var:** `WALLET_SERVICE_URL`
**Impact:** Non-blocking; warning logged if unavailable
**Startup validation:** Validates URL at startup (BE-GAM-007)

### rez-karma-service → rez-wallet-service
**When:** User redeems karma or earns bonuses
**What:** Credit/debit wallet for karma transactions
**Endpoint:** `POST /internal/credit`, `POST /internal/debit`
**Env var:** `WALLET_SERVICE_URL`
**Config:** In `/src/config/index.ts` with fallback defaults
**Default:** `http://rez-wallet-service:4004` (Docker internal DNS)

### rez-karma-service → rez-merchant-service
**When:** Retrieving merchant info for karma context
**What:** Get merchant profile, category for karma weighting
**Endpoint:** `GET /api/merchants/:id`
**Env var:** `MERCHANT_SERVICE_URL`
**Default:** `http://rez-merchant-service:3003`

### rez-karma-service → rez-auth-service
**When:** User registration or verification
**What:** Verify user exists, fetch user details
**Endpoint:** `GET /auth/verify/:userId` (internal token)
**Env var:** `AUTH_SERVICE_URL`
**Default:** `http://rez-auth-service:3001`

### rez-scheduler-service → rez-payment-service
**When:** Scheduled payment retry job executes
**What:** Retry failed payment capture or refund
**Endpoint:** `POST /pay/capture`, `POST /pay/refund`
**Env var:** `PAYMENT_SERVICE_URL`
**Default:** `http://rez-payment-service:3008`
**Pattern:** Job stored in BullMQ, scheduler fetches and POSTs

### rez-scheduler-service → rez-order-service
**When:** Scheduled order status update job executes
**What:** Auto-advance order status (e.g., ready → dispatched)
**Endpoint:** `PATCH /orders/:id/status` (internal token)
**Env var:** `ORDER_SERVICE_URL`
**Default:** `http://rez-order-service:3006`

### rez-scheduler-service → rez-wallet-service
**When:** Scheduled refund or wallet adjustment job
**What:** Debit/credit wallet for refunds, adjustments
**Endpoint:** `POST /api/wallet/debit`, `POST /api/wallet/credit`
**Env var:** `WALLET_SERVICE_URL`
**Default:** `http://rez-wallet-service:3009`

### rez-notification-events → (all services)
**When:** Notifications need context data
**What:** Fetch order, merchant, user details for email/SMS templates
**Pattern:** Async job in Redis queue; pulls data as needed
**No direct HTTP calls:** Uses shared MongoDB collections
**Queue:** `rez_notification_queue` in Redis

### rez-karma-service → rez-notification-events
**When:** User achieves new level or badge
**What:** Trigger push notification via job queue
**Method:** Enqueue job in Redis BullMQ
**Queue:** `notification_queue`
**Fire-and-forget:** Yes, doesn't wait for notification

### rez-marketing-service → (event logging)
**When:** Campaign executed
**What:** Log events to analytics-events for campaign tracking
**Endpoint:** `POST /api/analytics/batch`
**Method:** Async; no blocking

## Shared MongoDB Collections

### Global Collections (shared by multiple services)
| Collection | Used by | Purpose | Critical |
|-----------|---------|---------|----------|
| `users` | auth, merchant, finance, karma, wallet | User accounts and profiles | YES |
| `orders` | order-service, merchant-service, finance-service | Order documents | YES |
| `merchants` | merchant-service, marketing, karma, finance | Merchant profiles | YES |
| `products` | merchant-service, catalog, search | Product catalog | YES |
| `payments` | payment-service, wallet, order-service | Payment records | YES |
| `wallets` | wallet-service, payment, finance, karma | User wallet balances | YES |
| `transactions` | wallet-service, payment-service, finance-service | Ledger of all transactions | YES |
| `campaigns` | marketing-service, merchant-service, analytics-events | Campaign definitions | NO |

### Service-Specific Collections
| Collection | Service | Purpose |
|-----------|---------|---------|
| `otpCache` | auth-service | OTP verification records |
| `deviceTokens` | auth-service | Push notification device tokens |
| `creditOffers` | finance-service | Credit product offerings |
| `borrowPlans` | finance-service | EMI/loan plans |
| `emailTemplates` | notification-events | Email templates |
| `jobQueue` | scheduler-service | BullMQ jobs (also in Redis) |
| `appEvents` | analytics-events | Mobile app event ingestion |
| `webEvents` | analytics-events | Web event ingestion |
| `karmaPoints` | karma-service | User karma ledger |
| `achievements` | karma-service | Achievement definitions |
| `searchHistory` | search-service | User search queries |

### Constraints & Notes
- **auth-service** creates/updates `users` collection
- **wallet-service** owns `wallets` and `transactions`
- **order-service** owns `orders` (except merchant field which references merchants)
- **merchant-service** reads/writes most collections for merchant context
- **MongoDB replica set required** for:
  - Order service SSE (change streams)
  - Multi-document ACID transactions
  - Oplog-based replication (if used)

## Redis Cache & Queues

### Redis Keys Structure

#### Cache Keys
| Key Pattern | Service | TTL | Purpose |
|-------------|---------|-----|---------|
| `user:{userId}` | wallet, auth, karma | 5 min | User profile cache |
| `merchant:{merchantId}` | merchant, marketing, karma | 10 min | Merchant cache |
| `product:{productId}` | catalog, search, merchant | 30 min | Product cache |
| `wallet:{userId}` | wallet-service | 1 min | Balance cache (invalidated on credit/debit) |
| `credit:eligibility:{userId}` | finance-service | 24 hr | Credit eligibility decision |

#### Token Blacklist
| Key Pattern | Service | TTL | Purpose |
|-------------|---------|-----|---------|
| `blacklist:token:{tokenHash}` | auth-service | until exp | Revoked JWT tokens |
| `allLogout:{userId}` | auth-service | until logout | All sessions revoked |

#### Rate Limit Keys
| Key Pattern | Service | Window | Limit |
|-------------|---------|--------|-------|
| `ratelimit:otp:{phone}` | auth-service | 1 min | 5 |
| `ratelimit:auth:{ip}` | auth-service | 1 min | 10 |
| `ratelimit:wallet:{userId}` | wallet-service | 1 min | 10 |

#### Queue Keys (BullMQ)
| Queue Name | Service | Job Types | Consumers |
|-----------|---------|-----------|-----------|
| `notification_queue` | notification-events | email, sms, push | 1+ workers |
| `analytics_queue` | analytics-events | event_ingestion, aggregation | 1+ workers |
| `payment_queue` | payment-service | capture, refund, reconciliation | 1+ workers |
| `order_queue` | order-service | status_update, fulfillment | 1+ workers |
| `scheduler_queue` | scheduler-service | cron, delayed_jobs | 1+ workers |

### Session Storage
- User JWT tokens stored in Redis cache (short TTL)
- Device tokens for push notifications
- Device fingerprints for fraud detection
- Session locks for concurrent update prevention

## Data Flow Diagrams

### Payment → Wallet Flow
```
rez-payment-service:
  1. POST /pay/capture
  2. Verify payment with Razorpay
  3. Update payment.status = 'captured'
  4. If captured:
     → POST rez-wallet-service:/internal/credit
     → { userId, coins, reason: 'payment_capture' }
  5. Return 200 (even if wallet call fails)

rez-wallet-service:
  1. Increment user's coin balance
  2. Create transaction ledger entry
  3. Invalidate Redis cache: user:{userId}
  4. Return 200
```

### Credit Eligibility Check Flow
```
rez-finance-service:
  1. POST /api/credit/eligibility (from frontend)
  2. Check Redis cache: credit:eligibility:{userId}
  3. If cached, return immediately
  4. Else:
     → GET rez-order-service:/orders/summary/{userId}?token=internal
     → Fetch last 30 days orders: count, total spend, patterns
     → Fetch user.creditScore from wallet-service
     → ML model calculates eligibility
     → Cache in Redis for 24 hours
  5. Return eligibility decision
```

### Notification Event Flow
```
Any service needing notification:
  1. Enqueue job in Redis BullMQ: notification_queue
     { type: 'email', template: 'welcome', userId, data: {...} }

rez-notification-events (worker):
  1. Dequeue job
  2. Fetch user from MongoDB: users.findOne({_id: userId})
  3. Fetch merchant/order context if needed
  4. Render email template
  5. Send via email provider (AWS SES, etc.)
  6. Log to appEvents collection
  7. Mark job done
```

## Failure Modes & Resilience

### Payment Service Down
- **Impact:** Users cannot initiate/capture payments
- **Fallback:** None (critical path)
- **Recovery:** Manual intervention via admin panel
- **Data loss:** None (persistent in MongoDB)

### Wallet Service Down
- **Impact:** Coin credits fail, but payment succeeds
- **Fallback:** Graceful degradation (retry job queued)
- **Recovery:** Scheduler re-attempts after wallet comes back
- **Data loss:** None (request logged, retried)

### Order Service Down
- **Impact:** Finance service cannot fetch order history
- **Fallback:** Deny credit (safe failure)
- **Recovery:** Retry on next credit check
- **Data loss:** None

### Redis Down
- **Impact:** 
  - Rate limiting disabled (open to abuse)
  - Cache unavailable (slower queries)
  - BullMQ queues blocked
- **Fallback:** Services continue with disk-based queue backup
- **Recovery:** Restart Redis (all in-memory data lost)

### MongoDB Down
- **Impact:** All services fail (critical dependency)
- **Fallback:** None
- **Recovery:** Failover to replica set secondary
- **Replication:** Real-time via oplog
- **Consistency:** Strong (ACID transactions on replica set)

## Service Startup Order

Recommended startup sequence (health checks validate):

1. **MongoDB** (dependency for all)
2. **Redis** (dependency for cache/queues)
3. **rez-auth-service** (foundational: users created here)
4. **rez-order-service** (foundational: orders created)
5. **rez-payment-service** (depends on wallet)
6. **rez-wallet-service** (manages transactions)
7. **rez-finance-service** (depends on order, wallet)
8. **rez-merchant-service** (depends on auth, product)
9. **rez-catalog-service** (product metadata)
10. **rez-search-service** (depends on catalog)
11. **rez-scheduler-service** (coordinates jobs)
12. **rez-notification-events** (worker: async)
13. **analytics-events** (worker: async)
14. **rez-karma-service** (depends on wallet, auth)
15. **rez-marketing-service** (depends on campaigns)
16. **API Gateway** (routes to all services)

## Environment Variables for Dependencies

### For Each Service to Call Others

**rez-payment-service**
```env
WALLET_SERVICE_URL=http://rez-wallet-service:4003
```

**rez-finance-service**
```env
WALLET_SERVICE_URL=http://rez-wallet-service:4003
ORDER_SERVICE_URL=http://rez-order-service:3006
```

**rez-scheduler-service**
```env
PAYMENT_SERVICE_URL=http://rez-payment-service:3008  # or 4001
ORDER_SERVICE_URL=http://rez-order-service:3006
WALLET_SERVICE_URL=http://rez-wallet-service:3009    # or 4003
```

**rez-karma-service**
```env
AUTH_SERVICE_URL=http://rez-auth-service:3001        # or 4002
WALLET_SERVICE_URL=http://rez-wallet-service:4004    # or 4003
MERCHANT_SERVICE_URL=http://rez-merchant-service:3003 # or 4007
NOTIFICATION_SERVICE_URL=http://rez-notification-events:3001
```

**rez-gamification-service**
```env
WALLET_SERVICE_URL=http://rez-wallet-service:4004    # or 4003
```

## Service-to-Service Authentication

All inter-service calls must use internal service token:

**Header:**
```
X-Internal-Token: <token>
```

**Token Source:** Environment variable `INTERNAL_SERVICE_TOKENS_JSON`

**Format (scoped tokens):**
```json
{
  "rez-auth-service": "token-for-auth-callers",
  "rez-order-service": "token-for-order-callers",
  "rez-wallet-service": "token-for-wallet-callers",
  ...
}
```

**Validation:** Each service validates token against its own list of allowed callers.

## Monitoring & Observability

### Health Check Endpoints
All services expose `/health` and `/health/ready` for load balancer health checks.

### Distributed Tracing
- **Standard:** W3C `traceparent` header propagation
- **Middleware:** Applied in all services
- **Correlation ID:** `X-Correlation-ID` header (optional, logged)

### Metrics
- **analytics-events** exposes `/metrics` (Prometheus format)
- Services log to centralized logger (structured JSON)
- Sentry integration for error tracking

### Circuit Breaker
- No explicit circuit breakers deployed
- Timeouts: 5-10s for inter-service calls
- Retry: Exponential backoff for transient failures
- Fallback: Graceful degradation when possible

## Scaling Considerations

### Stateless Services
All services are stateless and horizontally scalable:
- rez-payment-service: Scale 2-5 instances
- rez-wallet-service: Scale 2-5 instances
- rez-merchant-service: Scale 2-8 instances (heavy)

### Stateful Dependencies
- **MongoDB:** Use replica set (3+ nodes) for HA
- **Redis:** Use Redis Sentinel or Cluster for HA
- **BullMQ:** Distributed via Redis; consumers auto-balance

### Database Indexing
Critical indexes for performance:
- `users.phoneNumber` (unique)
- `orders.merchant, orders.user, orders.status`
- `transactions.userId, transactions.createdAt`
- `payments.paymentId, payments.status`
- `wallets.userId` (unique)

## Database Schema Version

All services expect MongoDB schema version: **v2.0** (April 2026)

Migration path:
- v1.0 → v1.1: Added `isVerified` to users
- v1.1 → v2.0: Added `creditScore` to wallets, `metadata` to orders
- v2.0 → v2.1: Planned - add `subscription` collection

See `docs/SCHEMA_MIGRATIONS.md` for migration scripts.
