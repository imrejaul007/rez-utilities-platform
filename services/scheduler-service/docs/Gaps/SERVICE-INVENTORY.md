# Service Inventory — FORENSIC-001

## All 17 Services Documented

---

## 1. rez-backend (Monolith)

| Property | Value |
|----------|-------|
| **Location** | `rezbackend/rez-backend-master/` |
| **Port** | 5000 |
| **Remote** | `git@github.com:imrejaul007/rez-backend.git` |
| **Health Score** | 30/100 |
| **Gaps Found** | 16 (5 CRIT, 3 HIGH, 5 MED, 2 LOW, 1 INFO) |

### Critical Gaps
| ID | Title |
|----|-------|
| CRITICAL-001 | Settlement blind spot — queries `merchant` but writes `merchantId` |
| CRITICAL-006 | Admin cron jobs use consumer JWT auth |
| CRITICAL-007 | FraudFlag model missing |
| CRITICAL-013 | Order FSM missing 3 statuses (failed_delivery, return_requested, return_rejected) |
| CRITICAL-016 | getOrderProgress returns 0% for returned (should be 100%) |

### Key Files
- `src/config/orderStateMachine.ts` — 11-status FSM
- `src/config/financialStateMachine.ts` — 5 FSMs
- `src/routes/admin.ts` — Admin cron routes
- `src/models/Order.ts` — Uses `merchantId`
- `src/services/fraudDetection.ts` — Creates FraudFlag (not registered)

### Status
Active — primary order/payment entry point. Shadow mode with all services.

---

## 2. rez-payment-service

| Property | Value |
|----------|-------|
| **Location** | `rez-payment-service/` |
| **Port** | 3001 |
| **Remote** | `git@github.com:imrejaul007/rez-payment-service.git` |
| **Health Score** | 28/100 |
| **Gaps Found** | 10 (2 CRIT, 4 HIGH, 3 MED, 1 LOW) |

### Critical Gaps
| ID | Title |
|----|-------|
| CRITICAL-009 | FSM blocks failed→pending retry (backend allows it) |
| CRITICAL-010 | Hardcoded 1:1 coin rate (wallet uses env var) |

### Key Files
- `src/models/Payment.ts` — VALID_TRANSITIONS (blocks retry)
- `src/services/paymentService.ts` — Webhook + wallet credit
- `src/middleware/internalAuth.ts` — REJECTS legacy token

### Status
Active — Razorpay webhook handler. Shadow mode with backend.

---

## 3. rez-wallet-service

| Property | Value |
|----------|-------|
| **Location** | `rez-wallet-service/` |
| **Port** | 3002 |
| **Remote** | `git@github.com:imrejaul007/rez-wallet-service.git` |
| **Health Score** | 38/100 |
| **Gaps Found** | 6 (2 CRIT, 1 HIGH, 2 MED, 1 LOW) |

### Critical Gaps
| ID | Title |
|----|-------|
| CRITICAL-003 | TOCTOU race on merchant withdrawal (non-atomic check-then-update) |
| CRITICAL-010 | Uses env var for coin rate (payment service hardcodes 1:1) |

### Key Files
- `src/services/merchantWalletService.ts:121-164` — TOCTOU vulnerability
- `src/models/Wallet.ts` — Incomplete invariant (no pending validation)

### Status
Active — double-entry ledger. Shadow mode with backend.

---

## 4. rez-order-service

| Property | Value |
|----------|-------|
| **Location** | `rez-order-service/` |
| **Port** | 3003 |
| **Remote** | `git@github.com:imrejaul007/rez-order-service.git` |
| **Health Score** | 35/100 |
| **Gaps Found** | 7 (1 CRIT, 3 HIGH, 2 MED, 0 LOW) |

### Critical Gaps
| ID | Title |
|----|-------|
| CRITICAL-013 | Zod schemas defined but never applied to routes |

### Key Files
- `src/httpServer.ts` — 9 hardcoded statuses, schemas unused
- `src/worker.ts:211` — Invalid nested object write for payment.status

### Status
Active — SSE order streams. Shadow mode with backend.

---

## 5. rez-merchant-service

| Property | Value |
|----------|-------|
| **Location** | `rez-merchant-service/` |
| **Port** | 3004 |
| **Remote** | `git@github.com:imrejaul007/rez-merchant-service.git` |
| **Health Score** | 32/100 |
| **Gaps Found** | 5 (1 CRIT, 1 HIGH, 2 MED, 0 LOW) |

### Critical Gaps
| ID | Title |
|----|-------|
| CRITICAL-001 | Settlement blind spot — queries `merchant`, monolith writes `merchantId` |

### Key Files
- `src/services/settlementService.ts:49` — Wrong field name
- `src/routes/orders.ts:218-279` — Bulk actions bypass FSM

### Status
Active — merchant settlements. Shadow mode with backend.

---

## 6. rez-catalog-service

| Property | Value |
|----------|-------|
| **Location** | `rez-catalog-service/` |
| **Port** | 3005 |
| **Remote** | `git@github.com:imrejaul007/rez-catalog-service.git` |
| **Health Score** | 22/100 |
| **Gaps Found** | 4 (1 CRIT, 1 HIGH, 1 MED, 0 LOW) |

### Critical Gaps
| ID | Title |
|----|-------|
| CRITICAL-002 | HMAC secret generated at runtime — all internal auth fails |

### Key Files
- `src/middleware/internalAuth.ts:4` — crypto.randomBytes(32) every startup

### Status
Active — product catalog. Concurrent writer with backend.

---

## 7. rez-search-service

| Property | Value |
|----------|-------|
| **Location** | `rez-search-service/` |
| **Port** | 3006 |
| **Remote** | `git@github.com:imrejaul007/rez-search-service.git` |
| **Health Score** | 42/100 |
| **Gaps Found** | 4 (0 CRIT, 2 HIGH, 1 MED, 0 LOW) |

### Key Gaps
| ID | Title |
|----|-------|
| HIGH-007 | Rate limiter fails open on Redis error |
| HIGH-014 | Paths not routed through NGINX gateway |

### Key Files
- `src/middleware/rateLimiter.ts` — Fails open
- `nginx.conf` (gateway) — Missing routes

### Status
Active — but not accessible through gateway.

---

## 8. rez-karma-service

| Property | Value |
|----------|-------|
| **Location** | `rez-karma-service/` |
| **Port** | 3007 |
| **Remote** | `git@github.com:imrejaul007/rez-karma-service.git` |
| **Health Score** | 10/100 |
| **Gaps Found** | 4 (3 CRIT, 0 HIGH, 0 MED, 0 LOW) |

### Critical Gaps
| ID | Title |
|----|-------|
| CRITICAL-004 | Auth calls /api/auth/verify (should be /api/auth/validate) |
| CRITICAL-005 | Two karma increment paths — 2x inflation |
| CRITICAL-017 | Duplicate `startOfWeek` declaration — won't compile |

### Key Files
- `src/middleware/auth.ts:42` — Wrong auth endpoint
- `src/services/earnRecordService.ts` — First increment path
- `src/services/karmaService.ts:128,195` — Duplicate + second increment

### Status
BROKEN — Cannot compile. 3 critical blockers.

---

## 9. rez-finance-service

| Property | Value |
|----------|-------|
| **Location** | `rez-finance-service/` |
| **Port** | 3008 |
| **Remote** | `git@github.com:imrejaul007/rez-finance-service.git` |
| **Health Score** | 30/100 |
| **Gaps Found** | 5 (1 CRIT, 1 HIGH, 1 MED, 0 LOW) |

### Critical Gaps
| ID | Title |
|----|-------|
| CRITICAL-015 | Silent coin failure when wallet service unreachable — no retry, no DLQ |

### Key Files
- `src/services/rewardsHookService.ts:28-31` — Silent failure

### Status
Active — BNPL, rewards. Silent failures degrade gamification.

---

## 10. rez-notification-events

| Property | Value |
|----------|-------|
| **Location** | `rez-notification-events/` |
| **Port** | 3009 |
| **Remote** | `git@github.com:imrejaul007/rez-notification-events.git` |
| **Health Score** | 55/100 |
| **Gaps Found** | 3 (0 CRIT, 1 HIGH, 1 MED, 0 LOW, 1 INFO) |

### Key Gaps
| ID | Title |
|----|-------|
| MEDIUM-011 | Events not deduplicated |
| MEDIUM-014 | No DLQ monitoring |

### Status
Active — BullMQ notification queue.

---

## 11. rez-media-events

| Property | Value |
|----------|-------|
| **Location** | `rez-media-events/` |
| **Port** | 3010 |
| **Remote** | `git@github.com:imrejaul007/rez-media-events.git` |
| **Health Score** | 25/100 |
| **Gaps Found** | 2 (1 CRIT, 0 HIGH, 0 MED, 0 LOW) |

### Critical Gaps
| ID | Title |
|----|-------|
| CRITICAL-014 | Static files served without auth (missing return before express.static) |

### Key Files
- `src/http.ts:122` — Missing `return` before 401 response

### Status
Active — but ALL uploaded files publicly accessible.

---

## 12. rez-auth-service

| Property | Value |
|----------|-------|
| **Location** | `rez-auth-service/` |
| **Port** | 3011 |
| **Remote** | `git@github.com:imrejaul007/rez-auth-service.git` |
| **Health Score** | 45/100 |
| **Gaps Found** | 3 (1 CRIT, 1 HIGH, 1 MED, 0 LOW) |

### Critical Gaps
| ID | Title |
|----|-------|
| MEDIUM-010 | Admin JWT signed with consumer secret (JWT_SECRET vs JWT_ADMIN_SECRET) |

### Key Files
- `src/routes/auth.ts` — Defines /api/auth/validate (karma calls /verify)

### Status
Active — but wrong endpoint name is the interface contract issue.

---

## 13. rez-api-gateway (NGINX)

| Property | Value |
|----------|-------|
| **Location** | `rez-api-gateway/` |
| **Port** | N/A (port 80/443) |
| **Remote** | `git@github.com:imrejaul007/rez-api-gateway.git` |
| **Health Score** | 50/100 |
| **Gaps Found** | 3 (0 CRIT, 1 HIGH, 1 MED, 1 LOW, 1 INFO) |

### Key Gaps
| ID | Title |
|----|-------|
| HIGH-014 | Search paths not routed |
| MEDIUM-001 | No upstream keepalive |

### Key Files
- `nginx.conf` — Missing search routes, no keepalive

### Status
Active — but incomplete routing leaves search service unreachable.

---

## 14. rez-shared

| Property | Value |
|----------|-------|
| **Location** | `rez-shared/` |
| **Port** | N/A (npm package) |
| **Remote** | `git@github.com:imrejaul007/rez-shared.git` |
| **Health Score** | 40/100 |
| **Gaps Found** | 4 (0 CRIT, 2 HIGH, 2 MED, 0 LOW) |

### Key Gaps
| ID | Title |
|----|-------|
| HIGH-010 | LEGACY_COIN_TYPE_MAP exists but old records not migrated |
| HIGH-011 | DIMAOND typo → platinum (diamond tier broken) |

### Key Files
- `src/orderStatuses.ts` — 14 statuses (backend has 11)
- `src/paymentStatuses.ts` — Has authorized state with no inbound path
- `src/constants/coins.ts` — Canonical coin types, but migration needed

### Status
Active — canonical source for enums/FSMs/constants, but not adopted by all services.

---

## 15. rez-ads-service

| Property | Value |
|----------|-------|
| **Location** | `rez-ads-service/` |
| **Port** | 3014 |
| **Remote** | `git@github.com:imrejaul007/rez-ads-service.git` |
| **Health Score** | N/A |
| **Gaps Found** | 0 |

### Status
Not audited in this pass.

---

## 16. rez-gamification-service

| Property | Value |
|----------|-------|
| **Location** | `rez-gamification-service/` |
| **Port** | 3012 |
| **Remote** | `git@github.com:imrejaul007/rez-gamification-service.git` |
| **Health Score** | 60/100 |
| **Gaps Found** | 1 (0 CRIT, 0 HIGH, 1 MED, 0 LOW) |

### Key Gaps
| ID | Title |
|----|-------|
| MEDIUM-014 | No DLQ monitoring for failed gamification events |

### Status
Active — gamification engine. Best-performing service in the audit.

---

## 17. rez-scheduler-service

| Property | Value |
|----------|-------|
| **Location** | `rez-scheduler-service/` |
| **Port** | 3013 |
| **Remote** | None (local only) |
| **Health Score** | 55/100 |
| **Gaps Found** | 1 (0 CRIT, 0 HIGH, 1 MED, 0 LOW) |

### Key Gaps
| ID | Title |
|----|-------|
| MEDIUM-003 | Health checks shallow — don't verify MongoDB/Redis |

### Status
Active — cron job scheduler. No remote git repo.

---

## Service Summary Table

| # | Service | Port | Health | CRIT | HIGH | MED | LOW | Status |
|---|---------|------|--------|------|------|-----|-----|--------|
| 1 | rez-backend | 5000 | 30 | 5 | 3 | 5 | 2 | Active |
| 2 | rez-payment-service | 3001 | 28 | 2 | 4 | 3 | 1 | Active |
| 3 | rez-wallet-service | 3002 | 38 | 2 | 1 | 2 | 1 | Active |
| 4 | rez-order-service | 3003 | 35 | 1 | 3 | 2 | 0 | Active |
| 5 | rez-merchant-service | 3004 | 32 | 1 | 1 | 2 | 0 | Active |
| 6 | rez-catalog-service | 3005 | 22 | 1 | 1 | 1 | 0 | Active |
| 7 | rez-search-service | 3006 | 42 | 0 | 2 | 1 | 0 | Active |
| 8 | rez-karma-service | 3007 | 10 | 3 | 0 | 0 | 0 | BROKEN |
| 9 | rez-finance-service | 3008 | 30 | 1 | 1 | 1 | 0 | Active |
| 10 | rez-notification-events | 3009 | 55 | 0 | 1 | 1 | 0 | Active |
| 11 | rez-media-events | 3010 | 25 | 1 | 0 | 0 | 0 | Active |
| 12 | rez-auth-service | 3011 | 45 | 0 | 1 | 1 | 0 | Active |
| 13 | rez-api-gateway | — | 50 | 0 | 1 | 1 | 1 | Active |
| 14 | rez-shared | — | 40 | 0 | 2 | 2 | 0 | Active |
| 15 | rez-ads-service | 3014 | N/A | 0 | 0 | 0 | 0 | N/A |
| 16 | rez-gamification-service | 3012 | 60 | 0 | 0 | 1 | 0 | Active |
| 17 | rez-scheduler-service | 3013 | 55 | 0 | 0 | 1 | 0 | Active |

**Average Health: 38/100**
**Most Critical: rez-karma-service (10/100)**
**Best Performer: rez-gamification-service (60/100)**
**Broken Service: rez-karma-service (won't compile)**
