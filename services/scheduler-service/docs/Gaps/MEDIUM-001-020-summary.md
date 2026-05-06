# MEDIUM Issues Summary (001-020)

## Severity: MEDIUM

The following 20 MEDIUM-severity issues were identified during the forensic audit.

---

## MEDIUM-001: No Upstream Keepalive in NGINX Gateway

**File:** `rez-api-gateway/nginx.conf`

NGINX gateway has no `keepalive` directive configured for upstream connections. Every request opens a new TCP connection to backend services, adding latency and load.

**Fix:** Add `keepalive 32;` to upstream blocks.

---

## MEDIUM-002: No Idempotency Key on POST /search/history

**File:** `rez-search-service/src/routes/search.ts`

Search history endpoint accepts POST requests without idempotency keys. Duplicate submissions create redundant history entries.

**Fix:** Require idempotency key header: `X-Idempotency-Key: uuid`.

---

## MEDIUM-003: Health Check Endpoints Lack Deep Validation

Most services return `200 OK` for health checks even when dependencies (MongoDB, Redis) are unhealthy.

**Fix:** Check actual connectivity to MongoDB and Redis before returning healthy status.

---

## MEDIUM-004: Backend FSM Missing 'processing→cancelled' Transition

**File:** `rezbackend/.../config/financialStateMachine.ts`

Payment FSM doesn't define `processing→cancelled`. If a payment times out while processing, it can only go to `failed`, not `cancelled`.

**Fix:** Add `processing: ['completed', 'failed', 'cancelled']`.

---

## MEDIUM-005: Backend FSM Allows 'refund_failed→refund_initiated'

**File:** `rezbackend/.../config/financialStateMachine.ts`

Backend allows refund retry from `refund_failed` to `refund_initiated`, but payment service blocks it. Shadow mode creates inconsistency.

**Fix:** Align FSMs — if retry is desired, allow in both; if not, block in both.

---

## MEDIUM-006: Wallet Service Doesn't Validate 'total >= available + pending'

**File:** `rez-wallet-service/src/models/Wallet.ts`

Balance invariant only checks `total >= available`. Pending holds aren't validated, so a wallet could show `total: 500, available: 300, pending: 300` (total mismatch).

**Fix:** Add invariant: `total === available + pending + frozen`.

---

## MEDIUM-007: Settlement Aggregation Uses In-Memory Reduce

**File:** `rez-merchant-service/src/services/settlementService.ts`

Settlement calculation loads all qualifying orders into memory for aggregation. For merchants with thousands of orders, this causes memory pressure.

**Fix:** Use MongoDB aggregation pipeline for server-side computation.

---

## MEDIUM-008: Order Service SSE Has No Heartbeat

**File:** `rez-order-service/src/httpServer.ts`

SSE connections have no heartbeat/keepalive mechanism. Connections can appear alive while the service is down.

**Fix:** Send heartbeat comment every 30s: `// heartbeat\n`.

---

## MEDIUM-009: Payment Service Webhook Doesn't Use Idempotency Key

**File:** `rez-payment-service/src/services/paymentService.ts`

Razorpay webhook handler doesn't pass an idempotency key to `handleWebhookCaptured()`. Retried webhooks can cause duplicate processing.

**Fix:** Use Razorpay webhook event ID as idempotency key.

---

## MEDIUM-010: Backend Uses Consumer JWT Secret for Admin Token Signing

**File:** `rezbackend/.../src/middleware/auth.ts`

Admin tokens are signed with `JWT_SECRET` (consumer secret) instead of `JWT_ADMIN_SECRET`. In shadow mode, this means backend and auth service sign differently.

**Fix:** Use `JWT_ADMIN_SECRET` for admin tokens; verify with matching secret.

---

## MEDIUM-011: Notification Service Doesn't Deduplicate Events

**File:** `rez-notification-events/src/services/notificationService.ts`

Duplicate events (from service restarts, webhook retries) create duplicate notifications. No idempotency on event ID.

**Fix:** Use `Set` or Redis to track processed event IDs.

---

## MEDIUM-012: Catalog Service Product Search Uses LIKE Query

**File:** `rez-catalog-service/src/services/searchService.ts`

Product search uses `name LIKE '%query%'` instead of full-text index. Performance degrades with large catalogs.

**Fix:** Implement MongoDB text index or use dedicated search service.

---

## MEDIUM-013: No Retry Budget on Wallet Credit Queue

**File:** `rez-wallet-service/src/queues/walletCreditQueue.ts`

BullMQ jobs retry with exponential backoff but have no maximum retry budget check. Infinite retries possible.

**Fix:** Set `attempts: 5` and `backoff: { type: 'exponential', delay: 1000, maxDelay: 30000 }`.

---

## MEDIUM-014: No Dead Letter Queue Monitoring for Notification Events

**File:** `rez-notification-events/src/worker.ts`

Failed notification jobs go to a failed queue but there's no alerting or monitoring on failed notification volume.

**Fix:** Add Prometheus metrics and alerting on failed notification count.

---

## MEDIUM-015: Settlement Calculation Doesn't Account for Partial Refunds

**File:** `rez-merchant-service/src/services/settlementService.ts`

Settlement sums `order.total` but doesn't subtract partial refunds. Merchants are overpaid on partially refunded orders.

**Fix:** Calculate: `settlementAmount = order.total - order.refundedAmount`.

---

## MEDIUM-016: No Request Timeout on Internal Service Calls

**File:** `rez-payment-service/src/services/paymentService.ts`

Internal HTTP calls (wallet credit, notification) have no timeout. A slow/hanging service can exhaust connection pools.

**Fix:** Add `axios.defaults.timeout = 5000;` (5 second timeout).

---

## MEDIUM-017: Order Status Event Has No Version Vector

**File:** `rez-order-service/src/worker.ts`

Order state change events don't include a version vector or vector clock. Dual writes can create causally inconsistent events.

**Fix:** Include `{ previousStatus, newStatus, source, version, timestamp }` in all events.

---

## MEDIUM-018: BNPL Interest Calculation Uses Simple Interest

**File:** `rez-finance-service/src/services/bnplService.ts`

BNPL uses simple interest (no compounding) but doesn't document this. Customers expect clarity on total repayment.

**Fix:** Document calculation method; add amortization schedule endpoint.

---

## MEDIUM-019: No Circuit Breaker on External API Calls

**File:** `rez-payment-service/src/services/paymentService.ts`

Razorpay API calls have no circuit breaker. If Razorpay is down, the service degrades slowly instead of failing fast.

**Fix:** Implement circuit breaker pattern with `opossum` or custom implementation.

---

## MEDIUM-020: Merchant Onboarding Doesn't Validate GST Number

**File:** `rez-merchant-service/src/routes/merchant.ts`

GST number field accepts any string. Invalid GST numbers pass validation and cause downstream tax calculation issues.

**Fix:** Add GST validation regex: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`

---

## All Medium Issues

| ID | Title | File | Category |
|----|-------|------|----------|
| MEDIUM-001 | No upstream keepalive | nginx.conf | Performance |
| MEDIUM-002 | No idempotency on search history | search.ts | Reliability |
| MEDIUM-003 | Health checks shallow | all services | Observability |
| MEDIUM-004 | Missing processing→cancelled | financialStateMachine.ts | FSM |
| MEDIUM-005 | Refund retry inconsistency | financialStateMachine.ts | FSM |
| MEDIUM-006 | Wallet invariant incomplete | Wallet.ts | Business Logic |
| MEDIUM-007 | Settlement uses in-memory reduce | settlementService.ts | Performance |
| MEDIUM-008 | SSE no heartbeat | httpServer.ts | Reliability |
| MEDIUM-009 | Webhook no idempotency key | paymentService.ts | Reliability |
| MEDIUM-010 | Admin JWT wrong secret | auth.ts | Security |
| MEDIUM-011 | Notification events not deduplicated | notificationService.ts | Reliability |
| MEDIUM-012 | Product search LIKE query | searchService.ts | Performance |
| MEDIUM-013 | No retry budget on wallet queue | walletCreditQueue.ts | Reliability |
| MEDIUM-014 | No DLQ monitoring | worker.ts | Observability |
| MEDIUM-015 | Settlement ignores partial refunds | settlementService.ts | Business Logic |
| MEDIUM-016 | No timeout on internal HTTP calls | paymentService.ts | Resilience |
| MEDIUM-017 | No version vector on order events | worker.ts | Consistency |
| MEDIUM-018 | BNPL simple interest undocumented | bnplService.ts | Documentation |
| MEDIUM-019 | No circuit breaker on Razorpay | paymentService.ts | Resilience |
| MEDIUM-020 | GST validation missing | merchant.ts | Validation |
