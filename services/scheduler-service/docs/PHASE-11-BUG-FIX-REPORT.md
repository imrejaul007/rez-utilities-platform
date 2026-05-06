# Phase 11 Bug Fix Report — 2026-04-16

**Scope:** All REZ microservices, rez-now frontend, rez-app-consumer, rez-backend monolith
**Agents deployed:** 5 (Infrastructure, rez-now, Security, Transaction, Backend Monolith Auditor)
**Total PRs:** 16 across 14 repos

---

## Category 1: Infrastructure Resilience (8 repos)

**Agent:** Infrastructure — 8 PRs across 8 repos

| Repo | Fix | Severity |
|------|-----|----------|
| `rez-finance-service` | MongoDB pool options (`maxPoolSize`, `minPoolSize`, `maxIdleTimeMS`, `serverSelectionTimeoutMS`, `retryWrites`) + Redis `reconnect` handler | HIGH |
| `rez-scheduler-service` | MongoDB pool options + Redis `reconnecting` handler | HIGH |
| `rez-notification-events` | BullMQ queue `close()` + `removeOnComplete`/`removeOnFail` | MED |
| `rez-media-events` | BullMQ queue `close()` + `removeOnComplete`/`removeOnFail` | MED |
| `rez-gamification-service` | Stable dedup key (`job.data.eventId ?? job.data.id`) + `removeOnComplete`/`removeOnFail` | HIGH |
| `rez-order-service` | BullMQ `removeOnComplete`/`removeOnFail` | MED |
| `rez-wallet-service` | BullMQ `removeOnComplete`/`removeOnFail` | MED |
| `rez-catalog-service` | BullMQ `removeOnComplete`/`removeOnFail` | MED |

---

## Category 2: Transaction Integrity (4 repos)

**Agent:** Transaction Auditor

### BUG 1: `dailySpent` Outside MongoDB Transaction
**Repo:** `rez-wallet-service` | **PR:** [#5](https://github.com/imrejaul007/rez-wallet-service/pull/5) | **Severity:** CRITICAL

`dailySpent` counter increment was positioned **after** `commitTransaction()` in `debitInPriorityOrder`, meaning a race condition could lose counter updates if the transaction committed but the counter write failed. Fixed by moving counter increment inside the transaction with `{ session }`. Also wrapped `redis.del()` in try/catch.

### BUG 2: Refund Webhook Amount Never Verified
**Repo:** `rez-payment-service` | **PR:** [#3](https://github.com/imrejaul007/rez-payment-service/pull/3) | **Severity:** CRITICAL

`handleWebhookRefundProcessed` accepted any refund amount from Razorpay without verifying it matched the expected amount. Fixed by passing raw paise from webhook (`refundEntity.amount`) as a 4th parameter, comparing against computed refund amount, and flagging discrepancies > Rs. 0.01 as `[SECURITY]` disputes stored in `paymentMeta.refundDispute`.

### BUG 3: Missing Database Indexes
**Repos:** `rez-payment-service` + `rez-catalog-service`

| Repo | Index Added |
|------|-------------|
| `rez-payment-service` (Payment model) | `{ status: 1 }`, `{ orderId: 1 }`, `{ user: 1 }` |
| `rez-catalog-service` (Product model) | `{ storeId: 1, isActive: 1 }`, `{ merchantId: 1, isActive: 1 }`, `{ merchantId: 1, category: 1 }` |

### BUG 4: No Order State Transition Guard
**Repo:** `rez-order-service` | **PR:** [#7](https://github.com/imrejaul007/rez-order-service/pull/7) | **Severity:** MED

Added Mongoose `pre('save')` hook that enforces:
- Terminal states (`delivered`, `cancelled`, `returned`, `refunded`) can only transition to `refunded`/`returned`
- Backward jumps beyond one step in fulfillment lifecycle (`pending→placed→confirmed→preparing→ready→dispatched→out_for_delivery→delivered`) are blocked

---

## Category 3: Security Audit (5 repos)

**Agent:** Security Auditor | **4 bugs × 5 services = multiple fixes**

### BUG 1: `jwtSecret` No Null Check
**Repo:** `rez-karma-service` | **PR:** [#9](https://github.com/imrejaul007/Karma/pull/9)

`export const jwtSecret = process.env.JWT_SECRET as string` exported undefined if env var was missing. Fixed with IIFE that throws at startup.

### BUG 2: Admin Routes Unprotected if JWT_SECRET Missing
**Repo:** `rez-scheduler-service` | **PR:** [#2](https://github.com/imrejaul007/rez-scheduler-service/pull/2)

`logger.warn()` calls on missing JWT_SECRET allowed service to start unprotected. Changed to `logger.error()` + `process.exit(1)`.

### BUG 3: Plain String Comparison for Service Token
**Repo:** `rez-scheduler-service` | **PR:** [#2](https://github.com/imrejaul007/rez-scheduler-service/pull/2) | **Severity:** HIGH

`token === process.env.INTERNAL_SERVICE_TOKEN` vulnerable to timing attacks. Replaced with `crypto.timingSafeEqual()` with length check.

### BUG 4: `strictQuery: false` Across 5 Services
**Repos:** `rez-karma-service` (PR #9), `rez-merchant-service` (PR #3), `rez-catalog-service` (PR #4), `rez-wallet-service` (PR #4), `rez-scheduler-service` via monorepo (PR #2)

All changed from `mongoose.set('strictQuery', false)` → `true`. Prevents queries on non-schema fields from silently passing.

---

## Category 4: Frontend Correctness (2 repos)

### rez-now: 6 Bugs Fixed
**PR:** [#2](https://github.com/imrejaul007/rez-now/pull/2)

| File | Fix |
|------|-----|
| `app/api/chat/route.ts` | `upstream.json()` wrapped in try/catch → returns 502 on non-JSON |
| `app/[storeSlug]/history/page.tsx` | Silent `.catch()` → `console.error` + `setOrders([])` |
| `components/catalog/AppointmentSlotPicker.tsx` | `slotsError` state added for API failure |
| `app/[storeSlug]/pay/confirm/[paymentId]/page.tsx` | `isNaN` validation for `parseInt(amount)` → `notFound()` |
| `components/store/GoogleReviews.tsx` | `.catch()` → error state with `status: 'error'` |
| `app/[storeSlug]/order/queued/page.tsx` | Silent `.catch()` → `console.error` + `setPendingOrders([])` |

### rez-app-consumer: Math.random() Elimination
**PR:** [#81](https://github.com/imrejaul007/rez-app-consumer/pull/81)

- Replaced `Math.random()` in `FlashList` key extractors with `uuid` / `crypto.randomUUID()`
- Replaced `console.error` with `logger.error` across components
- Added error state handling for API failures
- Fixed `isNaN` validation for payment amount parsing

---

## Category 5: Backend Monolith Hardening

**PR:** [#106](https://github.com/imrejaul007/rez-backend/pull/106)

### Fix 1: Recharge Webhook Missing Middleware Chain
**Severity:** HIGH

`POST /recharge/webhook/razorpay` lacked raw body capture, webhook validation, and rate limiting. The canonical `razorpayRoutes.ts` handler has all of these. Without raw body capture, `JSON.stringify(req.body)` may not reproduce the exact bytes Razorpay signed, causing false signature rejections. Added: `express.json({ verify })` + `rateLimitWebhooks` + `logWebhookDetails` + `validateWebhookPayload`.

### Fix 2: console.error in Admin Travel
**Severity:** LOW

Replaced `console.error` with `logger.error` in `admin/travel.ts`.

---

## Not Bugs — Documented Findings (No Fix)

| Finding | Repo | Recommendation |
|---------|------|---------------|
| 78+ `as any` casts | `rez-backend` | Create `AuthenticatedRequest` interface — schedule as dedicated sprint |
| `/menu-sync` no internal auth | `rez-backend` | Add `requireInternalToken` middleware |
| `razorpayRoutes.ts` deprecated alias | `rez-backend` | Confirm all Razorpay dashboard URLs point to `/api/webhooks/razorpay` before removing |
| Pre-existing TS errors in `engines/`, `services/`, `workers/` | `rez-karma-service` | Requires dedicated TypeScript migration sprint |

---

## All PRs Summary

| # | Repo | PR URL | Category |
|---|------|--------|----------|
| 1 | `rez-finance-service` | (via infra agent) | Infrastructure |
| 2 | `rez-scheduler-service` | (via infra agent) | Infrastructure |
| 3 | `rez-notification-events` | (via infra agent) | Infrastructure |
| 4 | `rez-media-events` | (via infra agent) | Infrastructure |
| 5 | `rez-gamification-service` | (via infra agent) | Infrastructure |
| 6 | `rez-order-service` | (via infra agent) | Infrastructure |
| 7 | `rez-wallet-service` | (via infra agent) | Infrastructure |
| 8 | `rez-catalog-service` | (via infra agent) | Infrastructure |
| 9 | `rez-now` | [#2](https://github.com/imrejaul007/rez-now/pull/2) | Frontend |
| 10 | `imrejaul007/Karma` | [#9](https://github.com/imrejaul007/Karma/pull/9) | Security |
| 11 | `rez-scheduler-service` | [#2](https://github.com/imrejaul007/rez-scheduler-service/pull/2) | Security |
| 12 | `rez-merchant-service` | [#3](https://github.com/imrejaul007/rez-merchant-service/pull/3) | Security |
| 13 | `rez-catalog-service` | [#4](https://github.com/imrejaul007/rez-catalog-service/pull/4) | Security |
| 14 | `rez-wallet-service` | [#4](https://github.com/imrejaul007/rez-wallet-service/pull/4) | Security |
| 15 | `rez-wallet-service` | [#5](https://github.com/imrejaul007/rez-wallet-service/pull/5) | Transaction |
| 16 | `rez-payment-service` | [#3](https://github.com/imrejaul007/rez-payment-service/pull/3) | Transaction |
| 17 | `rez-catalog-service` | [#5](https://github.com/imrejaul007/rez-catalog-service/pull/5) | Transaction |
| 18 | `rez-order-service` | [#7](https://github.com/imrejaul007/rez-order-service/pull/7) | Transaction |
| 19 | `rez-app-consumer` | [#81](https://github.com/imrejaul007/rez-app-consumer/pull/81) | Frontend |
| 20 | `rez-backend` | [#106](https://github.com/imrejaul007/rez-backend/pull/106) | Backend |

---

## Next Steps

1. **Review PRs on GitHub** — Click "Merge pull request" after reviewing
2. **GitHub billing** — Resolve at github.com/settings/billing (blocking some CI runs)
3. **Deploy after merge** — Each service deploys via Render/Vercel CI on merge to main
4. **Database indexes** — Run MongoDB index creation after payment/catalog/order service deploys:

```js
// rez-payment-service — after deploy
db.payments.createIndex({ status: 1 });
db.payments.createIndex({ orderId: 1 });
db.payments.createIndex({ user: 1 });

// rez-catalog-service — after deploy
db.products.createIndex({ storeId: 1, isActive: 1 });
db.products.createIndex({ merchantId: 1, isActive: 1 });
db.products.createIndex({ merchantId: 1, category: 1 });
```

5. **TypeScript sprint** — Schedule dedicated effort for 78+ `as any` casts in backend and pre-existing TS errors in karma-service

---

*Generated by Claude Code — Phase 11 Bug Fix Sprint*
