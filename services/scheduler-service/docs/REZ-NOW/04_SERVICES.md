# REZ Now — Backend Services Reference

> **Status: ACCURATE** | Generated: 2026-04-14 | Domain: `now.rez.money`
> Backend: `rezbackend/rez-backend-master/src/`
> REZ Now frontend connects via REST API (`NEXT_PUBLIC_API_URL`) and Socket.IO (`NEXT_PUBLIC_SOCKET_URL`).

---

## Table of Contents

1. [Socket.IO Architecture](#1-socketio-architecture)
2. [Socket Events Reference](#2-socket-events-reference)
3. [External Services](#3-external-services)
4. [Internal/Orchestration Services](#4-internalorchestration-services)
5. [Service Dependencies](#5-service-dependencies)
6. [Connection Flows](#6-connection-flows)
7. [Error Handling Strategy](#7-error-handling-strategy)

---

## 1. Socket.IO Architecture

### 1.1 Namespaces

| Namespace | Path | Auth | Purpose |
|-----------|------|------|---------|
| Main | `/` (default) | JWT via `socket.handshake.auth.token` | User orders, payments, admin, support |
| KDS | `/kds` | JWT via `socket.handshake.auth.token` (merchant-only) | Kitchen display system |
| Table | `/table` | Unauthenticated | Customer table chat (dine-in) |

### 1.2 Connection Limits

`MAX_SOCKET_CONNECTIONS` (env: `MAX_SOCKET_CONNECTIONS`, default: `5000`) enforces a hard ceiling on concurrent Socket.IO connections per process. Connections beyond the limit are rejected with error `TOO_MANY_CONNECTIONS` (HTTP 429 semantics — clients should back off).

### 1.3 Transport & Timeouts

```typescript
transports: ['websocket', 'polling']  // Prefer WS, fallback to polling
pingTimeout: 10_000                    // 10s — dead socket cleanup
pingInterval: 25_000                    // 25s keepalive
connectTimeout: 10_000                  // 10s handshake timeout
maxHttpBufferSize: 1e4                 // 10 KB max payload (prevents memory exhaustion)
```

### 1.4 Redis Adapter

When `REDIS_URL` is configured, Socket.IO uses `@socket.io/redis-adapter` with two Redis connections (pub + sub) so events are shared across all pods. Falls back to in-memory adapter if Redis is unavailable.

```typescript
// src/config/socketAdapter.ts
attachRedisAdapter(io)  // Called after Redis connects
```

### 1.5 Auth Token Flow

Tokens MUST be supplied via `socket.handshake.auth.token` (body of initial handshake). Query-string tokens (`?token=`) are **rejected** — they leak in server logs, reverse-proxy logs, and browser history.

The server peeks at JWT claims (without verification) to select the correct secret:

| Claim | Secret |
|-------|--------|
| `role === 'admin'/'super_admin'/'superadmin'` + `JWT_ADMIN_SECRET` env | `JWT_ADMIN_SECRET` |
| `merchantId` present OR `role` in `['merchant','owner','manager','staff','cashier','viewer']` + `JWT_MERCHANT_SECRET` env | `JWT_MERCHANT_SECRET` |
| All others | `JWT_SECRET` |

After verification, the socket object is stamped with:
- `socket.userId` — consumer user ID
- `socket.userRole` — JWT role string
- `socket.merchantId` — merchant ID (from `merchantId` or `id` claim)

### 1.6 Room Naming Convention

Defined in `src/types/socket.ts`:

```typescript
SocketRoom.user(userId)       // 'user-{userId}'
SocketRoom.store(storeId)     // 'store-{storeId}'
SocketRoom.merchant(mid)     // 'merchant-{merchantId}'
SocketRoom.product(pid)       // 'product-{productId}'
SocketRoom.order(oid)         // 'order-{orderId}'
SocketRoom.allUsers           // 'all-users'
SocketRoom.allMerchants       // 'all-merchants'
```

---

## 2. Socket Events Reference

### 2.1 Main Namespace — Room Join Events

#### `join-merchant-room` (Client → Server)
- **Auth:** Merchant or admin JWT
- **Payload:** `merchantId: string` (24-char hex)
- **Behavior:** Admins may join any merchant room. Merchants may only join their own room (verified via JWT `merchantId` claim). Rejects mismatches.
- **Room joined:** `merchant-{merchantId}`

#### `join-store` (Client → Server)
- **Auth:** Merchant/admin JWT
- **Payload:** `{ storeId: string }`
- **Behavior:** Merchant ownership verified against `Store.merchant` field. Admins bypass ownership check.
- **Room joined:** `store-{storeId}`
- **Security:** STORE-OWN-001 — DB lookup required because `socket.merchantId` alone doesn't know which stores belong to the merchant.

#### `leave-store` (Client → Server)
- **Payload:** `{ storeId: string }`
- **Behavior:** Leaves `store-{storeId}` room.

#### `join-support-ticket` / `join_ticket` (Client → Server)
- **Auth:** Any authenticated user
- **Payload:** `ticketId: string` (24-char hex)
- **Behavior:** Admins/support join any ticket. Regular users join only their own (verified via `SupportTicket.user`).
- **Room joined:** `support-ticket-{ticketId}`

#### `leave-support-ticket` / `leave_ticket` (Client → Server)
- **Payload:** `ticketId: string`
- **Leaves:** `support-ticket-{ticketId}`

#### `join-staff` (Client → Server)
- **Auth:** Merchant or admin JWT
- **Payload:** `{ storeSlug: string }`
- **Behavior:** Merchant must own a store with this slug. Admins bypass.
- **Room joined:** `staff:{storeSlug}`
- **Purpose:** Staff receive `table:message` events forwarded from the `/table` namespace.

---

### 2.2 Main Namespace — Typing Indicators

#### `support-agent-typing` (Client → Server)
- **Auth:** Admin JWT only
- **Payload:** `{ ticketId: string; isTyping: boolean }`
- **Emits to:** `support-ticket-{ticketId}`
  - `support_agent_typing_start` (isTyping=true)
  - `support_agent_typing_stop` (isTyping=false)

#### `support-user-typing` (Client → Server)
- **Auth:** Any authenticated user (ownership-checked)
- **Payload:** `{ ticketId: string; isTyping: boolean }`
- **Emits to:** `support-ticket-{ticketId}` AND `support-agents`
  - `support_user_typing_start`
  - `support_user_typing_stop`

---

### 2.3 Main Namespace — Auto-Joined Rooms

On every authenticated connection, the socket automatically joins:
- `user-{userId}` — personal room for all users
- `support-agents` — all admins
- `admin` — all admins
- `admin-room` — all admins

---

### 2.4 Order Events (`src/services/orderSocketService.ts`)

Emitted by `orderSocketService` singleton (accessed via `emitOrderStatusUpdate()`, etc.).

#### Status Events (Server → Client)

| Event Name | When Emitted | Room | Notes |
|------------|--------------|------|-------|
| `order:status_updated` | Any status change | `order-{orderId}` | Generic status update payload |
| `order:created` | New order created | `user-{userId}` + `admin` | Includes full order data |
| `order:confirmed` | Status = 'confirmed' | `order-{orderId}` | |
| `order:preparing` | Status = 'preparing' | `order-{orderId}` | |
| `order:ready` | Status = 'ready' | `order-{orderId}` | |
| `order:dispatched` | Status = 'dispatched' | `order-{orderId}` | |
| `order:out_for_delivery` | Status = 'out_for_delivery' | `order-{orderId}` | |
| `order:delivered` | Status = 'delivered' | `order-{orderId}` | |
| `order:cancelled` | Status = 'cancelled' | `order-{orderId}` | |
| `order:eta_updated` | ETA changed | `order-{orderId}` | |
| `order:location_updated` | Delivery partner location update | `order-{orderId}` | |
| `order:partner_assigned` | Delivery partner assigned | `order-{orderId}` | |
| `order:partner_arrived` | Delivery partner arrived | `order-{orderId}` | |
| `order:timeline_updated` | Order timeline changed | `order-{orderId}` | |
| `merchant:new_order` | New order for merchant | `merchant-{merchantId}` | |
| `order:list_updated` | Order list changed (for tracking page) | `user-{userId}` | |

#### Subscription Events (Client → Server)

| Event Name | Purpose | Auth |
|------------|---------|------|
| `subscribe:order` | Join `order-{orderId}` room | Ownership validated: customer must own order, merchant must own order's store, admin unrestricted |
| `unsubscribe:order` | Leave `order-{orderId}` room | Any connected socket |

#### Coin/Wallet Events

| Event Name | Direction | Room | Payload |
|------------|-----------|------|---------|
| `coins:awarded` | Server → Client | `user-{userId}` | `{ userId, amount, source, description, newBalance, orderId?, orderNumber?, timestamp }` |
| `wallet:updated` | Server → Client | `user-{userId}` | Balance update (from `PaymentOrchestratorService`) |
| `merchant:wallet:updated` | Server → Client | `merchant-{merchantId}` | `{ merchantId, storeId, storeName, transactionType, amount, orderId?, orderNumber?, newBalance, timestamp }` |

#### Admin Alert Events

| Event Name | Emitted To | Severity |
|------------|-----------|---------|
| `ORDER_ALERT` | `merchant-{merchantId}` + `admin` | Per-order alerts |
| `ORDER_STUCK_ALERT` | `admin` | Critical — order stuck beyond threshold |
| `ORDER_RECONCILIATION_ALERT` | `admin` | Critical — reconciliation failure |
| `MERCHANT_CREDIT_FAILED` | `admin` | Critical |
| `PAYMENT_AMOUNT_MISMATCH` | `admin` | Critical |
| `admin:pending-reward:created` | `admin` | Reward pending approval |
| `admin:pending-reward:updated` | `admin` | Reward status changed |

---

### 2.5 KDS Namespace (`/kds`)

Auth: JWT via `socket.handshake.auth.token`, verified exclusively with `JWT_MERCHANT_SECRET`, `role === 'merchant'` required.

#### Join Events

| Event | Payload | Room Joined | Notes |
|-------|---------|-------------|-------|
| `join-store` | `{ storeId: string }` | `kds:{storeId}` | KDS-OWN-001: merchant must own the store |
| `get-current-orders` | `{ storeId: string }` | — (callback response) | KDS-OWN-002: returns orders with status `['confirmed','preparing','ready','dispatched','out_for_delivery']` |

#### Status Events

| Event (Client → Server) | Broadcast (Server → Room) | Description |
|------------------------|--------------------------|-------------|
| `order:mark-preparing` | `kds:order-preparing` | Kitchen marks order preparing |
| `order:mark-ready` | `kds:order-ready` | Kitchen marks order ready |
| `item-status-changed` | `order:item_status_updated` | Per-item status broadcast to other KDS displays |

#### Join Confirmation

| Event | Direction | Payload |
|-------|-----------|---------|
| `kds:joined` | Server → Client | `{ storeId, timestamp }` |

---

### 2.6 Table Namespace (`/table`)

Unauthenticated. Used by dine-in customers to message staff.

| Event | Direction | Purpose |
|-------|---------|---------|
| `table:message` | Client → Server | Customer sends message `{ storeSlug, tableNumber, message, customerName? }` |
| `table:message:ack` | Server → Client | Acknowledgment `{ id, timestamp }` |
| `table:message:error` | Server → Client | Error `{ message }` (invalid input or rate-limited) |

**Rate limit:** 10 messages per 60 seconds per socket. Excess messages return `table:message:error`.

**Forwarding:** `table:message` is forwarded to the authenticated `staff:{storeSlug}` room on the main namespace. The customer does NOT join that room directly (no JWT).

---

### 2.7 Earnings Socket Service (`src/services/earningsSocketService.ts`)

Initialized by `setupSocket()` in main namespace connection handler. Room: `earnings-{userId}`.

#### Client → Server

| Event | Payload | Validation |
|-------|---------|-----------|
| `join-earnings-room` | `userId: string` | MongoDB ObjectId (24 hex chars) — MP-D009 fix |
| `leave-earnings-room` | `userId: string` | Same |

#### Server → Client

| Event | Payload |
|-------|---------|
| `balance-update` | `{ balance, pendingBalance, timestamp }` |
| `project-status-update` | `{ status: { completeNow, inReview, completed }, timestamp }` |
| `earnings-update` | `{ earnings: { totalEarned, breakdown: {projects, referrals, shareAndEarn, spin} }, timestamp }` |
| `new-transaction` | `{ transaction, timestamp }` |
| `earnings-notification` | `{ notification, timestamp }` |
| `coins-earned` | `{ amount, source, description, timestamp }` |
| `challenge-completed` | `{ challengeTitle, coinsReward, timestamp }` |
| `achievement-unlocked` | `{ title, icon, coinReward, timestamp }` |
| `leaderboard-update` | `{ rank, previousRank, timestamp }` |
| `creator-conversion` | `{ pickTitle, commissionAmount, buyerName, timestamp }` |
| `creator-application-update` | `{ status, reason?, timestamp }` |
| `new-follower` | `{ followerName, timestamp }` |
| `pick-merchant-approval` | `{ pickTitle, status: 'approved'|'rejected', reason?, reward?, timestamp }` |

---

### 2.8 Gamification Socket Service (`src/services/gamificationSocketService.ts`)

Initialized in main namespace only when `isGamificationEnabled('tournaments')` is true. Room: `tournament-{tournamentId}`.

#### Client → Server

| Event | Payload | Validation |
|-------|---------|-----------|
| `join-tournament` | `tournamentId: string` | MongoDB ObjectId — prevents room-name injection |
| `leave-tournament` | `tournamentId: string` | Same |

#### Server → Client

| Event | Throttle | Description |
|-------|---------|-------------|
| `leaderboard-update` | Max 1 per 5 seconds per tournament | Full leaderboard array |
| `score-update` | Unthrottled | Per-user score + rank change |

---

### 2.9 Stock Socket Service (`src/services/stockSocketService.ts`)

Room-based (clients join `product-{productId}`, `store-{storeId}`, etc. via `join-room`/`leave-room` events).

#### Server → Client

| Event | Room | When |
|-------|------|------|
| `stock:updated` | `product-{productId}`, `store-{storeId}`, `all-users` | Stock quantity changed |
| `stock:low` | `product-{productId}`, `store-{storeId}`, `all-merchants` | Stock <= 10 (LOW_STOCK_THRESHOLD) |
| `stock:outofstock` | `product-{productId}`, `store-{storeId}`, `all-users`, `all-merchants` | Stock == 0 |

Also invalidates product/stock cache after emission.

---

### 2.10 RealTime Service (`src/merchantservices/RealTimeService.ts`)

Merchant dashboard real-time updates.

#### Client → Server

| Event | Validation | Rooms Joined |
|-------|-----------|-------------|
| `join-merchant-dashboard` | ObjectId (MP-D007) | `merchant-{merchantId}`, `dashboard-{merchantId}` |
| `subscribe-metrics` | ObjectId | `metrics-{merchantId}` |
| `subscribe-orders` | ObjectId | `orders-{merchantId}` |
| `subscribe-cashback` | ObjectId | `cashback-{merchantId}` |
| `subscribe-products` | ObjectId | `products-{merchantId}` |
| `subscribe-notifications` | ObjectId | `merchant-{merchantId}` |
| `leave-merchant-dashboard` | — | Leaves all dashboard rooms |
| `unsubscribe-all` | — | Leaves all rooms |
| `ping` | — | Server responds with `pong` (for latency measurement) |

#### Server → Client

| Event | Room | Trigger |
|-------|------|---------|
| `initial-dashboard-data` | Direct to socket (on join) | Initial metrics, overview, notifications |
| `order-event` | `orders-{merchantId}`, `dashboard-{merchantId}` | Order created/updated |
| `cashback-event` | `cashback-{merchantId}`, `dashboard-{merchantId}` | Cashback created/updated |
| `product-event` | `products-{merchantId}`, `dashboard-{merchantId}` | Product updated (stock changes trigger metrics update) |
| `metrics-updated` | `dashboard-{merchantId}` | Periodic (30s interval) or after event; also on `live-metrics` |
| `live-metrics` | `metrics-{merchantId}` | 30s interval |
| `live-chart-data` | `dashboard-{merchantId}` | On-demand via `sendLiveChartData()` |
| `system-notification` | `dashboard-{merchantId}` or broadcast | Admin-triggered |
| `dashboard-event` | `dashboard-{merchantId}` | Unified event wrapper for order/cashback/product |

---

## 3. External Services

### 3.1 Razorpay (`src/services/razorpayService.ts`)

**Purpose:** Payment gateway for all monetary transactions.

**Config:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PAYOUT_ENABLED`.

**Key functions:**

| Function | Description | Timeout |
|----------|-------------|---------|
| `createRazorpayOrder(amount, receipt, notes)` | Create Razorpay order | 10s |
| `verifyRazorpaySignature(orderId, paymentId, signature)` | Verify payment signature (timing-safe HMAC) | — |
| `fetchPaymentDetails(paymentId)` | Fetch payment from Razorpay | 10s |
| `createRefund(paymentId, amount?, notes?)` | Create refund | 10s |
| `createPayout(params)` | Payout to bank account (Razorpay X) | — |
| `validateWebhookSignature(body, signature)` | Verify webhook HMAC | — |
| `fetchRazorpayOrder(razorpayOrderId)` | Fetch Razorpay order by ID | — |
| `getRazorpayConfigForFrontend()` | Public key + currency for frontend SDK | — |
| `checkRazorpayHealth()` | Health check | — |

**Security notes:**
- **Webhook signature validation fails hard** if `RAZORPAY_WEBHOOK_SECRET` is not set — no unverified webhooks processed.
- Timing-safe comparison (`crypto.timingSafeEqual`) prevents timing oracle attacks on signature verification.
- Amount is **always derived from the authoritative DB order document** — never trusted from request body (prevents 1-paise payment attacks).
- Raw request body bytes are used for webhook HMAC verification (not `JSON.stringify(req.body)`) to avoid ordering/whitespace mismatches.
- Payouts require `RAZORPAY_PAYOUT_ENABLED=true` in production — silently returning simulated payouts would mean cashbacks are never disbursed.

---

### 3.2 Redis (`src/services/redisService.ts`)

**Purpose:** Caching, pub/sub, distributed locks, rate limiting.

**Config:** `REDIS_URL` from `src/config/redis.ts`.

**Key methods:**

| Method | Purpose |
|--------|---------|
| `get(key)` / `set(key, value, ttl?)` / `del(key)` | Basic cache operations |
| `getMultiple(keys)` / `setMultiple(entries, ttl?)` | Batch operations |
| `exists(key)` | Check key exists |
| `incr(key, amount?)` / `decr(key, amount?)` | Atomic counters |
| `atomicIncr(key, ttlSeconds)` | Atomic INCR + EXPIRE via Lua script |
| `acquireLock(key, ttlSeconds, strict?)` | Distributed lock (SET NX EX pattern). `strict=true` fails when Redis unavailable (for financial operations). `strict=false` returns `'fallback'` (allows execution in single-instance mode). |
| `releaseLock(key, ownerToken?)` | Release lock only if owned (Lua script check-and-delete). Token required for safe release. |
| `publish(channel, message)` | Pub/sub publish |
| `delPattern(pattern)` | Delete keys matching pattern (SCAN, not KEYS) |
| `flush()` | Flush all cache |
| `getClient()` | Returns raw Redis client for shared use |

**Graceful degradation:** If Redis is unavailable, all operations return `null`/`false`/`null` instead of throwing. The app continues without caching.

**Key prefixing:** All keys are prefixed with `{keyPrefix}v{CACHE_VERSION}:{key}`. Bumping `CACHE_VERSION` in `config/redis.ts` invalidates all cached data without manual flush.

**Reconnection:** Exponential backoff with jitter (capped at 30s). Logs a warning every 5th retry attempt.

---

### 3.3 WhatsApp Ordering (`src/services/whatsappOrderingService.ts`)

**Purpose:** State-machine-based WhatsApp chatbot for ordering.

**Config:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` (Meta Graph API v19.0).

**State Machine:**

```
idle
  └─[1]→ browsing
         └─[select category]→ item_selected
                               ├─[add item]→ cart
                               └─[B]→ browsing
cart
  ├─[A]→ browsing
  ├─[C]→ confirming
  └─[X]→ idle (cancelled)
confirming
  ├─[YES]→ awaiting_payment (if cart <= ₹5000)
  └─[NO]→ idle (cancelled)
awaiting_payment
  └─[payment success]→ completed
```

**v3 Production Controls (BOT_CONTROLS):**

| Control | Value | Purpose |
|---------|-------|---------|
| `messagesPerMinute` | 5 | Rate limit |
| `otpRetries` | 3 | OTP verification retries |
| `otpLockoutMinutes` | 30 | Lockout duration |
| `cartExpiryMinutes` | 30 | Cart expiry |
| `sessionExpiryMinutes` | 60 | Session expiry |
| `maxCartValue` | ₹5000 | Fraud limit — orders via WhatsApp capped at ₹5000 |
| `messageDedupWindowSec` | 30 | Same message within 30s = duplicate (dropped) |
| `spamScore` | 3 | 3+ identical messages in 5 minutes = 30-min lockout |

**Spam detection flow:**
1. `wa:dedup:{hash}` — deduplicate within 30s window
2. `wa:spam:{phone}` — counter incremented on each message, reset after 5 minutes. Count >= 3 triggers `wa:lockout:{phone}` for 30 minutes.

**Message send timeout:** 10s (axios) to prevent event loop starvation.

---

### 3.4 WhatsApp Marketing (`src/services/WhatsAppMarketingService.ts`)

**Purpose:** Bulk WhatsApp marketing campaigns. Separate from ordering service.

---

### 3.5 SMS (`src/services/SMSService.ts`)

**Purpose:** OTP delivery, transactional SMS (order confirmations, etc.).

---

### 3.6 Email (`src/services/EmailService.ts`)

**Purpose:** Transactional emails (receipts, order confirmations, etc.).

---

### 3.7 Cloudinary (`src/services/CloudinaryService.ts`)

**Purpose:** Image upload, processing, transformation for store/product images.

---

### 3.8 BBPS (`src/services/bbpsService.ts`)

**Purpose:** Bill Payment & Billpresentment Service — utility bill payments, recharges.

---

### 3.9 Gold Provider (`src/services/goldProviderService.ts`)

**Purpose:** Gold-backed rewards (convert REZ Coins to gold grams).

---

## 4. Internal/Orchestration Services

### 4.1 PaymentOrchestratorService (`src/services/PaymentOrchestratorService.ts`)

**Purpose:** Canonical, atomic wallet top-up pipeline. Handles the full flow from payment gateway to wallet credit.

**Feature-flag controlled** via `orchestratorFlags`:

| Flag | Values | Default |
|------|--------|---------|
| `payments.orchestrator_mode` | `disabled`, `shadow`, `live` | `shadow` |

**Modes:**
- `disabled` — No-op, returns immediately.
- `shadow` — Computes what WOULD happen, logs it, returns without touching any DB state. Used for 48-72h dual-run comparison before cutting over.
- `live` — Executes the full atomic pipeline with idempotency.

**Live pipeline:**
1. **Redis L1 idempotency** — Check `orchestrator:topup:idempotency:{key}`. If hit, return cached result.
2. **MongoDB L2 idempotency** — Check `Payment.metadata.orchestratorIdempotencyKey`. If hit, return cached result with wallet/transaction IDs.
3. **Payment status verification** — Verify payment document status is `completed` or `processing`. Rejects if `captured` (not a valid REZ status).
4. **Atomic MongoDB session** — `startTransaction()` → credit wallet via `walletService.credit()` (creates `CoinTransaction` + `LedgerEntry` atomically) → stamp idempotency keys on Payment document → `commitTransaction()`.
5. **Post-commit** — Cache idempotency result in Redis, emit `wallet:balance_updated` socket event.

**Idempotency TTL:** 24 hours in Redis. Authoritative record in MongoDB `Payment.metadata.orchestratorIdempotencyKey`.

**Emit after credit:** `orderSocketService.emitToUser(userId, 'wallet:balance_updated', { newBalance })` — best-effort, non-blocking.

---

### 4.2 RefundOrchestratorService (`src/services/RefundOrchestratorService.ts`)

**Purpose:** Canonical, atomic refund pipeline with refund ceiling guard.

**Feature-flag controlled:**

| Flag | Values | Default |
|------|--------|---------|
| `refunds.orchestrator_mode` | `disabled`, `shadow`, `live` | `shadow` |

**Ceiling guard:** Requested refund amount must not exceed `originalPaymentAmount - alreadyRefunded`. Enforced atomically via MongoDB `$expr` in `findOneAndUpdate` — prevents race conditions from concurrent refund requests.

**Live pipeline:**
1. Redis L1 idempotency → MongoDB L2 idempotency → ceiling check → atomic MongoDB session → increment `Payment.refundedAmount` → credit wallet via `walletService.credit()` → commit.

---

### 4.3 LedgerService (`src/services/ledgerService.ts`)

**Purpose:** Double-entry accounting ledger. Every financial mutation creates balanced debit/credit entries.

**Accounts:**
- `PLATFORM_ACCOUNT_IDS.platform_fees` (`000000000000000000000001`)
- `PLATFORM_ACCOUNT_IDS.platform_float` (`000000000000000000000002`)
- `PLATFORM_ACCOUNT_IDS.expired_pool` (`000000000000000000000003`)

**Entry types:** `user_wallet`, `merchant_wallet`, `platform_fees`, `platform_float`, `expired_coins`.

---

### 4.4 WalletService (`src/services/walletService.ts`)

**Purpose:** Consumer wallet — credit, debit, balance queries. Creates `CoinTransaction` and calls `LedgerService` for double-entry accounting.

---

### 4.5 MerchantWalletService (`src/services/merchantWalletService.ts`)

**Purpose:** Merchant wallet — credit/debit for orders, withdrawals, payouts.

---

### 4.6 CoinService (`src/services/coinService.ts`)

**Purpose:** REZ Coins operations. Balance queries, category-specific balances, expiry calculation.

**Coin types:** `rez`, `prive`, `promo`, `branded` — each with configurable `expiryDays`.

---

### 4.7 CashbackService (`src/services/cashbackService.ts`)

**Purpose:** Cashback eligibility, calculation, and award.

---

### 4.8 CouponService / CouponValidationService

**Purpose:** Coupon creation, validation, discount calculation.

---

### 4.9 OrderSocketService (`src/services/orderSocketService.ts`)

**Purpose:** Real-time order events. Singleton initialized by `setupSocket()`. Accessed via `global.io` in worker processes.

Emits: order status, location, ETA, timeline, coin awards, merchant wallet updates, admin alerts.

---

### 4.10 QueueService (`src/services/QueueService.ts`)

**Purpose:** BullMQ-backed durable job queues.

---

### 4.11 Payment Queue (`src/events/paymentQueue.ts`)

**Queue name:** `payment-events`

**Purpose:** Durable offloading of post-payment side effects (notifications, analytics, reconciliation signals) from the webhook handler.

**Events processed:**
- `payment.captured` → push notification + analytics signal
- `payment.failed` → failure notification
- `payment.refund_initiated` / `payment.refund_completed` → refund notification
- `payment.settlement_processed` → settlement analytics

**Configuration:**
- Concurrency: 2
- Max rate: 100 events/minute
- Retry: 5 attempts with exponential backoff (5s start)
- Remove on complete: 48h
- Remove on fail: 14 days (financial compliance)

**Fail-open:** `publishPaymentEvent()` catches errors and logs warnings — never blocks the caller. If the queue publish fails, the webhook still returns 200.

---

### 4.12 ScheduledJobService (`src/services/ScheduledJobService.ts`)

**Purpose:** Cron-like scheduled tasks.

---

### 4.13 KillSwitchService (`src/services/KillSwitchService.ts`)

**Purpose:** Emergency feature toggles — disable specific features without redeployment.

---

### 4.14 FeatureFlagService (`src/services/featureFlagService.ts`)

**Purpose:** DB-backed feature flags for gradual rollouts.

---

### 4.15 CircuitBreaker (`src/services/circuitBreaker.ts`)

**Purpose:** Prevent cascading failures by failing fast when a downstream service is unhealthy.

---

### 4.16 GamificationService (`src/services/gamificationService.ts`)

**Purpose:** Challenges, achievements, leaderboards, spin-the-wheel, tournaments.

---

### 4.17 LeaderboardService (`src/services/leaderboardService.ts`)

**Purpose:** Tournament leaderboard management.

---

### 4.18 CampaignService (`src/services/campaignService.ts`)

**Purpose:** Campaign creation, eligibility, reward distribution.

---

### 4.19 BroadcastDispatchService (`src/services/broadcastDispatchService.ts`)

**Purpose:** Bulk notification dispatch.

---

### 4.20 FraudDetectionService (`src/services/fraudDetectionService.ts`)

**Purpose:** Anomaly detection, velocity checks, abuse detection.

---

## 5. Service Dependencies

### 5.1 Payment → Wallet (Top-up)

```
Razorpay (payment captured)
  └─→ razorpayController.handleRazorpayWebhook()
        ├─→ publishPaymentEvent()           [paymentQueue.ts]
        │     └─→ PaymentEventsWorker → notification
        ├─→ pushNotificationService.sendPushToUser()
        └─→ PaymentOrchestratorService.processTopUp()
              ├─→ Redis L1 idempotency     [redisService]
              ├─→ Payment.findOne()         [MongoDB]
              ├─→ walletService.credit()    [walletService.ts]
              │     ├─→ CoinTransaction.create()
              │     └─→ ledgerService.recordEntry()  [ledgerService.ts]
              ├─→ Payment.findOneAndUpdate() [stamp idempotency keys]
              └─→ orderSocketService.emitToUser('wallet:balance_updated')
```

### 5.2 Payment → Merchant Credit

```
Razorpay webhook (payment.captured)
  └─→ Order.findOneAndUpdate(status → 'paid')
        ├─→ pushNotificationService (to user)
        ├─→ dispatchPaymentCompleted()   [rendezWebhookDispatch]
        │     └─→ POST to Rendez webhook endpoint
        └─→ orderSocketService.emitMerchantNewOrder()
              └─→ Socket: merchant:new_order → merchant-{merchantId}
```

### 5.3 Refund Flow

```
Razorpay webhook (refund.created)
  └─→ razorpayController.handleRazorpayWebhook()
        ├─→ Order.findOneAndUpdate()  [mark refunded]
        └─→ RefundOrchestratorService.processRefund()
              ├─→ Redis L1 idempotency
              ├─→ CoinTransaction.findOne()  [L2 idempotency]
              ├─→ Payment.findOne()  [load for ceiling check]
              ├─→ Payment.findOneAndUpdate()  [atomic increment refundedAmount]
              ├─→ walletService.credit()  [debit from platform, credit user]
              └─→ ledgerService.recordEntry()
```

### 5.4 Order Status Update

```
Order status change (any service)
  └─→ orderSocketService.emitOrderStatusUpdate(payload)
        ├─→ Socket: order:status_updated  → order-{orderId}
        ├─→ Socket: order:confirmed/preparing/ready/etc.  → order-{orderId}
        ├─→ Socket: order:status_updated  → store-{storeId}  (live board)
        └─→ Socket: order:list_updated  → user-{userId}
```

### 5.5 WhatsApp Order Flow

```
WhatsApp incoming message
  └─→ whatsappOrderingService.handleIncomingMessage()
        ├─→ Redis: wa:lockout:{phone}  [check lockout]
        ├─→ Redis: wa:dedup:{hash}    [deduplication]
        ├─→ Redis: wa:spam:{phone}    [spam detection]
        ├─→ WhatsAppSession.findOrCreate()
        ├─→ [state machine: idle → browsing → item_selected → cart → confirming → awaiting_payment]
        │     └─→ WhatsApp.sendMessage()  [Meta Graph API]
        └─→ [payment success webhook]
              └─→ whatsappOrderingService.handlePaymentSuccess()
                    └─→ WhatsApp.sendMessage('Payment Successful!')
```

### 5.6 Orchestrator Flag Propagation

```
setOrchestratorFlag()  [orchestratorFlags.ts]
  └─→ FLAGS[key] = value  [local in-process]
  └─→ redisService.publish('rez:orchestrator:flags', ...)
        └─→ All pods receive via Redis pub/sub → update local FLAGS
```

---

## 6. Connection Flows

### 6.1 Payment Webhook Flow (Complete)

```
Razorpay sends POST /api/webhooks/razorpay
  │
  ├─ [middleware] express.json({ verify: req.rawBody = buf })
  ├─ [middleware] logWebhookDetails()
  ├─ [middleware] validateWebhookPayload()
  ├─ [middleware] rateLimitWebhooks()
  │
  └─→ webhookController.handleRazorpayWebhook()
        │
        ├─→ razorpayService.validateWebhookSignature(rawBody, signature)
        │     └─ Hard reject if RAZORPAY_WEBHOOK_SECRET not set
        │
        ├─→ switch(event.event):
        │
        │   case 'payment.captured':
        │     ├─→ Order.findOneAndUpdate() with CAS guard
        │     │     [status != 'paid'; atomic TOCTOU fix]
        │     ├─→ publishPaymentEvent() → BullMQ payment-events queue
        │     │     └─→ PaymentEventsWorker (async):
        │     │           ├─→ publishNotificationEvent() [push + in_app]
        │     │           └─→ analytics signal
        │     ├─→ pushNotificationService.sendPushToUser()
        │     ├─→ dispatchPaymentCompleted() → Rendez webhook
        │     └─→ PaymentOrchestratorService.processTopUp() [if mode=live]
        │           ├─→ Redis L1 idempotency
        │           ├─→ MongoDB L2 idempotency
        │           ├─→ walletService.credit()
        │           │     └─→ ledgerService.recordEntry()
        │           └─→ orderSocketService.emitToUser('wallet:balance_updated')
        │
        │   case 'payment.failed':
        │     ├─→ Order.findOne() [status not in ['paid']]
        │     ├─→ Order.findOneAndUpdate() [CAS guard]
        │     └─→ validatePaymentTransition() [FSM]
        │
        │   case 'refund.created':
        │     ├─→ Order.findOne()
        │     ├─→ order.payment.status = 'refunded'
        │     ├─→ order.payment.refundId = ...
        │     ├─→ order.totals.refundAmount += ...
        │     └─→ order.save()
        │
        └─→ res.status(200).json({ received: true })
              [Always 200 — Razorpay retries on 5xx]
```

### 6.2 Scan & Pay Flow

```
REZ Now: /[storeSlug]/pay/checkout
  │
  ├─→ POST /api/web-ordering/scan-pay/orders
  │     └─→ Order created with status 'pending'
  │
  ├─→ Frontend calls razorpayService.createOrder()
  │     └─→ POST /api/razorpay/create-order
  │           ├─→ Order.findOne() [authoritative amount from DB]
  │           └─→ razorpayService.createRazorpayOrder()
  │
  ├─→ Frontend: Razorpay SDK checkout (UPI/card/etc.)
  │
  ├─→ POST /api/web-ordering/scan-pay/verify
  │     └─→ razorpayController.verifyRazorpayPayment()
  │           ├─→ razorpayService.verifySignature()
  │           ├─→ razorpayService.fetchPaymentDetails()
  │           ├─→ Order.findOneAndUpdate() [mark paid]
  │           ├─→ PaymentOrchestratorService.processTopUp()
  │           └─→ dispatchPaymentCompleted() → Rendez
  │
  └─→ /[storeSlug]/pay/confirm/[paymentId]
        ├─→ GET /api/web-ordering/scan-pay/history/[paymentId]
        └─→ orderSocketService: Socket connected
              └─→ Frontend receives coins:awarded event
```

### 6.3 Order Status Live Updates Flow

```
REZ Now: /[storeSlug]/order/[orderNumber]
  │
  ├─→ Socket.IO connects with JWT auth
  │     └─→ socket.join('user-{userId}')
  │
  ├─→ Frontend: socket.emit('subscribe:order', { orderId })
  │     └─→ orderSocketService: validates ownership
  │           ├─ Customer: order.user === socket.userId
  │           ├─ Merchant: Store.merchant === socket.merchantId
  │           └─ Admin: unrestricted
  │     └─→ socket.join('order-{orderId}')
  │
  └─→ Backend emits: orderSocketService.emitOrderStatusUpdate(payload)
        ├─→ io.to('order-{orderId}').emit('order:status_updated', payload)
        ├─→ io.to('order-{orderId}').emit('order:preparing/ready/etc.', payload)
        └─→ io.to('store-{storeId}').emit('order:status_updated', payload)
```

### 6.4 KDS (Kitchen Display) Connection Flow

```
Merchant opens KDS app
  │
  ├─→ Socket.IO connects to /kds namespace
  │     └─→ JWT verified with JWT_MERCHANT_SECRET, role='merchant'
  │
  ├─→ socket.emit('join-store', { storeId })
  │     └─→ KDS-SEC-001 fix: Store.findById() → verify merchant owns store
  │     └─→ socket.join('kds:{storeId}')
  │     └─→ socket.emit('kds:joined', { storeId, timestamp })
  │
  ├─→ socket.emit('get-current-orders', { storeId })
  │     └─→ KDS-OWN-002: verify store ownership
  │     └─→ Order.find() [status in ['confirmed','preparing','ready','dispatched','out_for_delivery']]
  │     └─→ callback({ success: true, orders: formattedOrders })
  │
  ├─→ Merchant marks item: socket.emit('item-status-changed', {...})
  │     └─→ kdsNamespace.to('kds:{storeId}').emit('order:item_status_updated', {...})
  │     └─→ Other KDS displays update in real-time
  │
  └─→ Order ready: socket.emit('order:mark-ready', { orderId, storeId })
        └─→ kdsNamespace.to('kds:{storeId}').emit('kds:order-ready', {...})
```

---

## 7. Error Handling Strategy

### 7.1 Webhook Responses

Webhooks (Razorpay) **always return 200** on receipt, regardless of processing outcome. Return 500 only on actual processing errors (triggers Razorpay retry). Idempotent duplicates return 200.

```typescript
try {
  // process webhook
  res.status(200).json({ received: true });
} catch (error) {
  res.status(500).json({ received: false }); // triggers Razorpay retry
}
```

### 7.2 Side Effect Isolation

Post-payment side effects (coin credit, notifications, analytics) are wrapped in `try/catch` with `catch` blocks that log but do not throw. Failures never affect the webhook response or order state:

```typescript
try {
  publishPaymentEvent(...);
  pushNotificationService.sendPushToUser(...);
} catch (sideEffectErr) {
  logger.error('[RAZORPAY WEBHOOK] Post-payment side effects failed (non-fatal):', sideEffectErr?.message);
}
```

### 7.3 Queue Fail-Open

Queue publishes (BullMQ) are fail-open — errors are caught and logged, never blocking the caller:

```typescript
await publishPaymentEvent(...).catch((qErr) => {
  logger.warn('[RAZORPAY WEBHOOK] Payment queue publish failed (non-fatal):', qErr?.message);
});
```

### 7.4 Orchestrator Shadow Mode

Orchestrators run in `shadow` mode by default. Shadow mode:
- **Never throws** — errors return `{ success: false, shadowMode: true }`
- **Never mutates DB state** — read-only path
- **Logs intended action** — for dual-run comparison

Cutover to `live` is controlled by env var (`PAYMENTS_ORCHESTRATOR_MODE=live`) or runtime flag via admin API.

### 7.5 Redis Graceful Degradation

All Redis operations return safe defaults when unavailable:
- `get()` → `null` (cache miss)
- `set()` → `false` (cache unavailable)
- `acquireLock(strict=false)` → `'fallback'` (allows single-instance execution)
- `acquireLock(strict=true)` → `null` (fail-safe for financial operations)

### 7.6 MongoDB Atomic Patterns

| Pattern | Use Case | Implementation |
|---------|---------|---------------|
| CAS (Check-and-Set) | Webhook idempotency | `findOneAndUpdate({ condition, status: { $ne: 'paid' } })` — only one concurrent update wins |
| Atomic counter increment | Refund ceiling guard | `findOneAndUpdate({ $expr: { $lte: [...] } }, { $inc: { refundedAmount } })` |
| MongoDB session + transaction | Multi-document writes | `session.startTransaction()` → operations → `session.commitTransaction()` |

### 7.7 Timeout Guards

All external HTTP calls (Razorpay, WhatsApp, etc.) have explicit timeouts:

| Service | Timeout |
|--------|---------|
| Razorpay order/create/fetch/refund | 10s |
| WhatsApp Graph API | 10s |
| Razorpay webhook HMAC validation | N/A (local crypto) |

Timeouts prevent event loop starvation at high load.

### 7.8 Socket.IO Error Handling

Socket errors are emitted back to the client via the `error` event. The connection is never abruptly terminated by the server on error — clients are always given an error message:

```typescript
socket.emit('error', { message: 'Unauthorized: store does not belong to your merchant account' });
```

Silent denial (no emit) is used for non-critical checks to avoid leaking existence of resources (e.g., ticket not found for non-owner).

---

## Appendix: Service File Map

| Service | File |
|---------|------|
| Razorpay | `src/services/razorpayService.ts` |
| Redis | `src/services/redisService.ts` |
| WhatsApp Ordering | `src/services/whatsappOrderingService.ts` |
| WhatsApp Marketing | `src/services/WhatsAppMarketingService.ts` |
| Payment Orchestrator | `src/services/PaymentOrchestratorService.ts` |
| Refund Orchestrator | `src/services/RefundOrchestratorService.ts` |
| Ledger | `src/services/ledgerService.ts` |
| Wallet | `src/services/walletService.ts` |
| Merchant Wallet | `src/services/merchantWalletService.ts` |
| Coin | `src/services/coinService.ts` |
| Cashback | `src/services/cashbackService.ts` |
| Order Socket | `src/services/orderSocketService.ts` |
| Earnings Socket | `src/services/earningsSocketService.ts` |
| Gamification Socket | `src/services/gamificationSocketService.ts` |
| Stock Socket | `src/services/stockSocketService.ts` |
| RealTime (Merchant) | `src/merchantservices/RealTimeService.ts` |
| Payment Queue | `src/events/paymentQueue.ts` |
| Orchestrator Flags | `src/services/orchestratorFlags.ts` |
| Socket Setup | `src/config/socketSetup.ts` |
| Socket Helpers | `src/config/socket.ts` |
| Socket Adapter (Redis) | `src/config/socketAdapter.ts` |
| Socket Types | `src/types/socket.ts` |
| SMS | `src/services/SMSService.ts` |
| Email | `src/services/EmailService.ts` |
| Cloudinary | `src/services/CloudinaryService.ts` |
| BBPS | `src/services/bbpsService.ts` |
| Coupon | `src/services/couponService.ts` |
| Campaign | `src/services/campaignService.ts` |
| Gamification | `src/services/gamificationService.ts` |
| Leaderboard | `src/services/leaderboardService.ts` |
| Fraud Detection | `src/services/fraudDetectionService.ts` |
| Kill Switch | `src/services/KillSwitchService.ts` |
| Feature Flag | `src/services/featureFlagService.ts` |
| Circuit Breaker | `src/services/circuitBreaker.ts` |
| Razorpay Controller | `src/controllers/razorpayController.ts` |
| Razorpay Routes | `src/routes/razorpayRoutes.ts` |
