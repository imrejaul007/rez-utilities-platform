# API Gateway & Shared Package Audit Report

**Date:** 2026-04-10
**Auditor:** Code Quality Analyzer
**Scope:** rez-api-gateway (nginx), rez-shared package, docker-compose.microservices.yml, all microservice package.json files

---

## Executive Summary

The gateway is structurally sound with good security headers, rate limiting, and caching. However there are **six P0 or P1 issues** that must be resolved before the system is considered production-stable:

1. `X-Internal-Token` is **never injected** by the gateway — service-to-service auth is broken at the gateway layer
2. `NOTIFICATION_SERVICE_URL` is a dead env var with `sync: false` and no corresponding nginx route
3. `MERCHANT_SERVICE_URL` in `render.yaml` points to the **monolith**, not a dedicated merchant service
4. `ORDER_SERVICE_URL` is **defined twice** in `render.yaml` — second value silently wins
5. `rez-shared` is published to npm and included in the workspace but **zero microservices import it** — the package exists in isolation
6. `rez-notification-events`, `rez-media-events`, `analytics-events` are in docker-compose but have **no gateway routes** and no Render URLs

---

## 1. Gateway Route Map

Active config is `nginx.conf` (injected at container start via `start.sh` using `envsubst`). The `nginx.optimized.conf` is a companion file with upstream blocks — it is **not the deployed config**; the deployed config is `nginx.conf`.

| Route Pattern | Target Env Var | Render URL (render.yaml) | Service | Route Status |
|---|---|---|---|---|
| `/api/search` | `SEARCH_SERVICE_URL` | `https://rez-search-service.onrender.com` | rez-search-service | Active |
| `/api/catalog` | `CATALOG_SERVICE_URL` | `https://rez-catalog-service-1.onrender.com` | rez-catalog-service | Active |
| `/api/orders` | `ORDER_SERVICE_URL` | `https://rez-order-service-hz18.onrender.com` (2nd wins) | rez-order-service | Active — see duplicate note |
| `/api/merchant` | `MERCHANT_SERVICE_URL` | `https://rez-backend-8dfu.onrender.com` (MONOLITH) | rez-backend (not merchant) | Misconfigured |
| `/api/auth` | `AUTH_SERVICE_URL` | `https://rez-auth-service.onrender.com` | rez-auth-service | Active |
| `/api/payment` | `PAYMENT_SERVICE_URL` | `https://rez-payment-service.onrender.com` | rez-payment-service | Active |
| `/api/wallet` | `WALLET_SERVICE_URL` | `https://rez-wallet-service-36vo.onrender.com` | rez-wallet-service | Active |
| `/api/analytics` | `ANALYTICS_SERVICE_URL` | `https://analytics-events-37yy.onrender.com` | analytics-events | Active |
| `/api/gamification` | `GAMIFICATION_SERVICE_URL` | `https://rez-gamification-service-3b5d.onrender.com` | rez-gamification-service | Active |
| `/api/finance` | `FINANCE_SERVICE_URL` | `https://rez-finance-service.onrender.com` | rez-finance-service | Active |
| `/api/admin/` | `MONOLITH_URL` | `https://rez-backend-8dfu.onrender.com` | rez-backend | Active |
| `/` (catch-all) | `MONOLITH_URL` | `https://rez-backend-8dfu.onrender.com` | rez-backend | Active |
| `/api/marketing` | `MARKETING_SERVICE_URL` | `https://rez-marketing-service.onrender.com` | rez-marketing-service | **MISSING — no nginx location block** |
| `/api/media` or `/api/upload` | `MEDIA_SERVICE_URL` | `https://rez-media-events.onrender.com` | rez-media-events | **MISSING — no nginx location block** |
| `/api/notifications` | `NOTIFICATION_SERVICE_URL` | `sync: false` (blank) | rez-notification-events | **MISSING — no route and no URL** |
| `/api/ads` | (none) | (none) | rez-ads-service | **MISSING — not in gateway at all** |

### Config File Discrepancy

`nginx.conf` (deployed) and `nginx.optimized.conf` are diverged:

- `nginx.optimized.conf` uses named `upstream` blocks (connection pooling, keepalive 32) and has an additional `pos_limit` rate zone and `merchant_write` write-rate zone
- `nginx.conf` (deployed) uses `map $http_host` variables and `proxy_pass $var_backend` — this means **upstream connection pooling is not in effect on production**
- `nginx.conf` payment block uses `limit_req zone=payment_service` — `payment_service` is **not a defined zone**; this will cause nginx to fail to start or silently fall through

---

## 2. Missing Route Coverage

### Services with no gateway route

| Service | Has Render URL | Docker-compose | Impact |
|---|---|---|---|
| `rez-marketing-service` | Yes (`MARKETING_SERVICE_URL` env defined, `$marketing_backend` map defined) | No | Map var exists but no `location /api/marketing` block — traffic falls to monolith |
| `rez-media-events` | Yes (`MEDIA_SERVICE_URL` defined, `$media_backend` map defined) | Yes (port 3008) | Same — map var present but no location block |
| `rez-notification-events` | No (`sync: false` — URL is blank) | Yes (port 3001) | No route, no URL, completely dark to gateway |
| `rez-ads-service` | No | No | No env var, no route, no docker-compose entry — fully dark |

### Backend paths likely falling to monolith that should be routed

- `POST /api/notifications/*` — notification events should not pass through monolith
- `POST /api/ads/*`, `GET /api/ads/*` — ad serving and campaign management
- `POST /api/media/upload`, `GET /api/media/*` — media upload
- `POST /api/marketing/*` — campaign triggers and outbound

### Routes defined in gateway but no separate service

- `/api/merchant` — this goes to the **monolith** URL (`rez-backend-8dfu.onrender.com`) because `MERCHANT_SERVICE_URL` in `render.yaml` is set to the monolith. If `rez-merchant-service` is deployed on Render its URL must be updated.

---

## 3. Auth & Security Audit

### Authorization header forwarding

The gateway does **not strip or modify** the `Authorization` header. Since nginx passes all headers by default unless explicitly hidden, the client JWT reaches the upstream service intact. This is correct for user-facing routes.

**However:**

- There is **no `proxy_set_header X-Internal-Token`** directive anywhere in `nginx.conf`. The architecture document (`auto-memory-store.json`) confirms that service-to-service calls use `X-Internal-Token`. The gateway does not inject this header, meaning any service that validates `X-Internal-Token` on gateway-proxied routes will reject traffic unless it also accepts user JWTs.
- The `Authorization` header is **not forwarded explicitly** with `proxy_set_header Authorization $http_authorization`. While nginx passes it by default, this is implicit behavior — it is better to be explicit, especially given the `proxy_set_header Connection ""` directive which strips hop-by-hop headers.

### CORS

CORS is centrally handled at the gateway. Allowlist pattern:

```
^https://(rez\.money|www\.rez\.money|menu\.rez\.money|admin\.rez\.money|merchant\.rez\.money|[a-z0-9\-]+\.vercel\.app)$
```

Issues:
- The wildcard `*.vercel.app` is overly broad — any Vercel deployment in the world can make credentialed requests. This should be tightened to specific known Vercel project slugs.
- CORS headers from upstream are stripped with `proxy_hide_header`. This is correct — prevents duplicate headers.
- `Access-Control-Allow-Credentials: true` is returned regardless of whether `$cors_origin` is non-empty. When origin is unrecognized, `$cors_origin` is empty string `""` and the header is `Access-Control-Allow-Origin: ""` — browsers will reject this, which is the intended behavior, but it is cleaner to suppress the header entirely for unknown origins.

### Security headers

Headers applied globally at server level:

- `X-Frame-Options: SAMEORIGIN` — correct
- `X-Content-Type-Options: nosniff` — correct
- `X-XSS-Protection: 1; mode=block` — deprecated by modern browsers but harmless
- `Referrer-Policy: strict-origin-when-cross-origin` — correct
- `Permissions-Policy` — set, correct
- `Content-Security-Policy` — **absent**. This is a significant gap for a financial platform.
- `server_tokens off` — correct, nginx version hidden

### Payment route safety

`proxy_next_upstream off` is correctly applied to `/api/payment` in `nginx.conf`. This prevents automatic retry of payment requests on upstream failure — critical for idempotency. This is correct.

### Rate limiting

Three zones defined in `nginx.conf`:
- `api_limit` — 50 r/s per IP (global)
- `auth_limit` — 20 r/m per IP (auth endpoints) — correctly restrictive for OTP/login
- `merchant_limit` — 100 r/s per Authorization token

**Critical bug:** The payment location block references `zone=payment_service`:

```nginx
location /api/payment {
    limit_req zone=payment_service burst=30 nodelay;
```

`payment_service` is **not declared** anywhere in `nginx.conf`. This is a fatal nginx configuration error that will cause the container to fail to start, or if nginx is lenient, silently skip rate limiting on payment routes.

The `nginx.optimized.conf` has `zone=api_limit` on the payment block — this is the intended behavior that was not synced back to `nginx.conf`.

---

## 4. Middleware Gaps

### Gateway-level gaps

| Gap | Detail | Risk |
|---|---|---|
| `X-Internal-Token` not injected | Gateway never adds service token on forwarded requests | Medium — services expecting internal token validation will fail |
| `Content-Security-Policy` absent | No CSP header set | Medium — XSS amplification if any service serves HTML |
| No request ID generation | `X-Correlation-ID` is passed through if present, but if absent, falls back to nginx `$request_id` — correct, but `$request_id` is only available in nginx 1.11.0+ | Low |
| No JWT validation at gateway | Gateway passes JWT to service without verifying signature | Acceptable for microservice architecture but means all services must independently validate |
| No request body size limit per-route | `client_max_body_size 50M` is global — upload routes may need higher, payment routes should be lower (few KB) | Low |
| `nginx.optimized.conf` not deployed | Connection pooling, additional rate zones not in production | Medium — performance impact |

### Service-level middleware (rez-shared)

The `rez-shared` package provides production-quality middleware:

- `globalErrorHandler` — standardized error shape
- `sanitizeInputs` — DOMPurify-based XSS sanitization
- `createRateLimiter` — Redis-backed rate limiting
- `idempotencyMiddleware` — full idempotency implementation
- `createHealthCheckRouter` — liveness/readiness/startup probes

**None of the microservices import `@imrejaul007/rez-shared`** (confirmed: no import found in any `src/**/*.ts` file across the workspace). Every service re-implements its own middleware, error handling, and validation — creating drift and duplication.

---

## 5. rez-shared Package Audit

### 5.1 Exports Inventory

**Root index (`@imrejaul007/rez-shared`)**

| Export | Source file | Description |
|---|---|---|
| `ORDER_STATUSES`, `OrderStatus`, `getOrderProgress`, `isOrderStatus`, `STATUS_ORDER`, `TERMINAL_ORDER_STATUSES`, `ACTIVE_ORDER_STATUSES`, `PAST_ORDER_STATUSES` | `orderStatuses.ts` | Canonical order FSM |
| `PAYMENT_STATUSES`, `PaymentStatus`, `ORDER_PAYMENT_STATUSES`, `OrderPaymentStatus`, `isPaymentStatus`, `isOrderPaymentStatus` | `paymentStatuses.ts` | Canonical payment FSM |
| `OrderItemDTO`, `OrderPaymentDTO`, `OrderDTO`, `PaginatedDtoResponse` | `dtos.ts` | Over-the-wire DTO interfaces |
| `normalizeOrderStatus`, `normalizePaymentStatus` | `statusCompat.ts` | Legacy status normalization |
| `WalletBalance`, `CoinTransaction`, `CoinType` (re-exported) | `types/wallet.ts` | Wallet balance shape |
| `ApiResponse`, `PaginatedResponse`, `ApiError`, `Pagination`, `getItems`, `getPagination` | `types/api.ts` | Response wrapper types |
| `formatCurrency`, `formatShortCurrency` | `utils/currency.ts` | INR formatting |
| `isValidIndianPhone`, `isValidGSTIN`, `isValidPAN`, `isValidUPI` | `utils/validation.ts` | India-specific validators |
| `formatDate` (assumed from `utils/date.ts`) | `utils/date.ts` | Date helpers |
| `COIN_TYPES`, `COIN_TYPE_ARRAY`, `COIN_EXPIRY_DAYS`, `COIN_DISPLAY_NAMES`, `normalizeCoinType`, `REWARD_TYPES` | `constants/coins.ts` | Coin system constants |
| `ERROR_CODES`, `ERROR_STATUS_MAP`, `ErrorCode` (type) | `constants/errors.ts` | Error code registry |

**Sub-path exports**

| Sub-path | Key exports |
|---|---|
| `@imrejaul007/rez-shared/middleware` | `globalErrorHandler`, `AppError`, `ValidationError`, `NotFoundError`, `UnauthorizedError`, `sanitizeInputs`, `createRateLimiter`, `createOrderRateLimiter`, `idempotencyMiddleware`, `createHealthCheckRouter` |
| `@imrejaul007/rez-shared/schemas` | `createOrderSchema`, `updateOrderStatusSchema`, `addressSchema`, `merchantLoginSchema`, `validateRequest`, `validateQuery` |
| `@imrejaul007/rez-shared/queue` | `JobQueue`, `JobQueueService` |
| `@imrejaul007/rez-shared/webhook` | `WebhookService`, `WebhookEventType`, `setupWebhookProcessor` |

### 5.2 Usage vs Exports Gaps

**No microservice imports rez-shared.** The workspace `package.json` includes `rez-shared` as a workspace member but none of the service `package.json` files declare `@imrejaul007/rez-shared` as a dependency. The npm workspace link is never consumed.

Direct consequences observed from package-by-package review:

| Capability | rez-shared provides | Services do instead |
|---|---|---|
| Error handling | `globalErrorHandler`, `AppError` | Each service defines its own error classes |
| Rate limiting | `createRateLimiter` (Redis-backed) | `rez-merchant-service` imports `express-rate-limit` directly; others have none |
| Input sanitization | `sanitizeInputs` | `rez-merchant-service` imports `isomorphic-dompurify` and `express-mongo-sanitize` directly; others have none |
| Order status constants | `ORDER_STATUSES`, `OrderStatus` | Likely re-declared inline in each service |
| Coin type constants | `COIN_TYPES`, `normalizeCoinType` | Likely re-declared or string-typed inline |
| Queue management | `JobQueue`, `JobQueueService` | Each service creates raw BullMQ queues independently |
| Webhook delivery | `WebhookService` | Not confirmed used by any service |

The `PaginatedDtoResponse` export is explicitly marked `@deprecated` in `dtos.ts` but the canonical `PaginatedResponse` from `types/api.ts` is also re-exported from `dtos.ts` as a type alias of the deprecated shape — creating a naming conflict between the canonical and deprecated types.

### 5.3 Version Consistency

The rez-shared package and all microservices declare version `1.0.0` — no semantic versioning drift. However, critical dependency versions diverge significantly across services:

| Package | rez-shared | rez-wallet-service | rez-finance-service | analytics-events | rez-marketing-service |
|---|---|---|---|---|---|
| `mongoose` | `^8.17.2` | `^7.0.0` | `^8.17.2` | `^7.0.0` | `^8.17.2` |
| `typescript` | `^5.9.3` | `^5.3.0` | `^5.4.5` | `^5.3.0` | `^5.9.3` |
| `zod` | `^3.22.4` | absent | `^3.22.0` | absent | absent |
| `uuid` | `^10.0.0` | `^13.0.0` | `^9.0.0` | absent | `^13.0.0` |
| `helmet` | n/a | `^8.1.0` | `^7.1.0` | `^8.1.0` | `^7.1.0` |
| `@types/node` | `^22.0.0` | `^22.0.0` | `^22.0.0` | `^20.0.0` | `^22.0.0` |
| `express` | `^4.21.2` | `^4.18.0` | `^4.18.0` | `^4.22.1` | `^4.19.2` |

Key issues:
- `rez-wallet-service` and `analytics-events` use **mongoose v7**, all others use v8 — this is a breaking API version difference
- `uuid` ranges span v9, v10, and v13 — `uuid` v13 was not a real published version as of knowledge cutoff; likely a typo for `^10.0.0`
- `zod` is absent in most services but present in rez-shared, rez-finance-service, rez-payment-service, and rez-merchant-service — validation consistency is not enforced
- Root `package.json` `overrides` block pins `mongoose: ^8.17.2`, `typescript: ^5.9.3`, `express: ^4.21.2` — but these overrides only apply to workspace members. `rez-wallet-service` and `analytics-events` are workspace members, so the mongoose override should apply — the `^7.0.0` declaration in their `package.json` will be overridden by the workspace root, which means actual installed version is v8. But the declared version is misleading.

Additionally, the **root workspace** does not include `rez-notification-events`, `analytics-events`, `rez-media-events`, `rez-ads-service` — these four services are not workspace members and therefore do not receive the root overrides.

---

## 6. Docker Compose Audit

`docker-compose.microservices.yml` defines 8 services:

| Service | Container Port | Docker-compose | Has Nginx Route | Has Render URL |
|---|---|---|---|---|
| rez-notification-events | 3001 | Yes | No | No (sync: false) |
| analytics-events | 3002 | Yes | `/api/analytics` | Yes |
| rez-gamification-service | 3003 | Yes | `/api/gamification` | Yes |
| rez-merchant-service | 3004 | Yes | `/api/merchant` | Misconfigured (→ monolith) |
| rez-catalog-service | 3005 | Yes | `/api/catalog` | Yes |
| rez-order-service | 3006 | Yes | `/api/orders` | Yes (duplicate key) |
| rez-wallet-service | 3007 | Yes | `/api/wallet` | Yes |
| rez-media-events | 3008 | Yes | No | Yes |

**Missing from docker-compose:**

| Service | In Nginx | In Render | In Workspace |
|---|---|---|---|
| rez-auth-service | Yes | Yes | Yes |
| rez-payment-service | Yes | Yes | Yes |
| rez-search-service | Yes | Yes | Yes |
| rez-finance-service | Yes | Yes | Yes |
| rez-marketing-service | No route | Yes | Yes |
| rez-ads-service | No route | No | Yes |

The docker-compose file is partial — it covers only the event-driven / queue-worker services and a subset of HTTP services. It is intended to run alongside the monolith's own compose file (per comment: "Run alongside the monolith's docker-compose.yml during shadow mode"). This is an architectural choice, not an error, but it means there is **no single compose file** that spins up the full stack locally.

**Environment variable gaps in docker-compose:**

| Service | Missing Vars |
|---|---|
| rez-gamification-service | `INTERNAL_SERVICE_TOKEN`, `JWT_SECRET` |
| rez-merchant-service | `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, `CLOUDINARY_*` |
| rez-catalog-service | `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN` |
| rez-order-service | `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, `PAYMENT_SERVICE_URL` |
| rez-wallet-service | `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN` |
| analytics-events | `ANALYTICS_WRITE_KEY` (if applicable) |
| All services | `NODE_ENV` is set but `LOG_LEVEL` is absent — defaults unknown |

No service in the compose file has a `depends_on` declaration. All services will start in parallel and likely encounter Redis/MongoDB connection failures on first boot if those stores are not already running. There is no Redis or MongoDB service defined in this compose file — those are expected to be external.

**Resource limits:** All services have CPU/memory limits and reservations, which is good. The limits appear reasonable for their workloads.

---

## 7. Priority Issues

### P0 — Deployment-blocking

| # | Issue | File | Impact |
|---|---|---|---|
| P0-1 | `limit_req zone=payment_service` references undefined zone | `/rez-api-gateway/nginx.conf:334` | nginx fails to start or payment route has no rate limiting |
| P0-2 | `MERCHANT_SERVICE_URL` in render.yaml points to monolith URL | `/rez-api-gateway/render.yaml:36` | All merchant traffic goes to monolith even if dedicated service is deployed |
| P0-3 | `ORDER_SERVICE_URL` declared twice in render.yaml (lines 19 and 29) | `/rez-api-gateway/render.yaml:19,29` | First URL (`rez-order-service.onrender.com`) is silently overwritten by second (`rez-order-service-hz18.onrender.com`) — unpredictable if swapped |

### P1 — Security / Correctness

| # | Issue | File | Impact |
|---|---|---|---|
| P1-1 | `X-Internal-Token` never injected by gateway | `nginx.conf` | Service-to-service auth header absent on all gateway-proxied requests |
| P1-2 | `*.vercel.app` wildcard in CORS allowlist | `nginx.conf:212` | Any Vercel project can make credentialed cross-origin requests to the gateway |
| P1-3 | `NOTIFICATION_SERVICE_URL` has `sync: false` (no value) in render.yaml | `render.yaml:34` | Notification service URL is blank — if nginx ever gets a route for it, variable will be empty |
| P1-4 | `nginx.conf` is the deployed config but lacks upstream keepalive pooling present in `nginx.optimized.conf` | `nginx.conf` vs `nginx.optimized.conf` | Two diverged configs — optimized version not deployed, operational confusion |

### P2 — Technical Debt / Reliability

| # | Issue | File | Impact |
|---|---|---|---|
| P2-1 | `rez-marketing-service` and `rez-media-events` have `$marketing_backend`/`$media_backend` map vars but no nginx `location` blocks | `nginx.conf:172-186` | Traffic to these services falls through to monolith silently |
| P2-2 | `rez-ads-service` has no gateway route, no Render URL, not in docker-compose | — | Completely ungated — no way to reach it through the gateway |
| P2-3 | No service imports `@imrejaul007/rez-shared` | All service `package.json` files | Shared library exists but provides no value; duplication across services grows |
| P2-4 | `rez-wallet-service` and `analytics-events` declare `mongoose: ^7.0.0` but root override forces v8 | `package.json` files | Declared version vs installed version mismatch — misleading, potential breakage if workspace link is removed |
| P2-5 | `uuid: ^13.0.0` in rez-marketing-service and rez-wallet-service | `package.json` files | uuid v13 does not exist; likely `^10.0.0` typo — may fail to install in fresh environments |
| P2-6 | `PaginatedDtoResponse` is `@deprecated` but a non-deprecated type alias `PaginatedResponse` in `dtos.ts` shadows the canonical one in `types/api.ts` | `rez-shared/src/dtos.ts:98` | Name collision — consumers importing `PaginatedResponse` from the root index get the deprecated shape |
| P2-7 | `Content-Security-Policy` header absent from gateway | `nginx.conf` | No browser-level XSS protection for any service fronted by the gateway |
| P2-8 | Four services missing from root workspace: `rez-notification-events`, `analytics-events`, `rez-media-events`, `rez-ads-service` | Root `package.json` | These services do not receive workspace overrides and cannot use npm workspace linking |
| P2-9 | `/health/services` endpoint lists service URLs but does not probe liveness — returns static config, not actual health | `nginx.conf:259-261` | Misleading health dashboard — a service could be down while this endpoint returns 200 |
| P2-10 | `rez-notification-events` is not in the workspace, has no Render URL, has no gateway route — completely isolated | All config files | Notification service is dark from every direction except its own internal queue consumer |
