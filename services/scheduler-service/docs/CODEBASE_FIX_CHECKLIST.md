# REZ Codebase Fix Checklist

Last updated: 2026-04-08
Source: [CODEBASE_ISSUES_AUDIT.md](/Users/rejaulkarim/Documents/ReZ Full App/docs/CODEBASE_ISSUES_AUDIT.md)
Pre-push verification: [PRE_PUSH_VERIFICATION.md](/Users/rejaulkarim/Documents/ReZ Full App/docs/PRE_PUSH_VERIFICATION.md)

## Immediate Fixes

- [x] Lock Razorpay verify endpoint back to internal-only in `rez-payment-service`
- [x] Fix merchant order route shadowing in `rez-merchant-service`
- [x] Align `rez-shared` public package contract with stable committed build output
- [x] Add regression tests for payment verify-route exposure
- [x] Add regression tests for merchant `/orders/stats/summary`
- [x] Add shared-package export smoke test

## Money Flow Hardening

- [x] Enforce server-side authoritative amount lookup for public order payments and reject non-order client-facing initiation without a server-authoritative source
- [x] Require `orderId` or `orderNumber` on the legacy `/api/razorpay/create-order` compat route before creating a Razorpay order
- [x] Add tests for amount mismatch rejection
- [x] Review refund, capture, and webhook paths for end-to-end idempotency
- [x] Audit all wallet credit/debit callers
- [x] Fix finance-to-wallet reward contract drift (`/internal/coins/credit` → `/internal/credit`, add `coinType`, add idempotency key)
- [x] Fix finance credit-intelligence wallet fetch endpoint (`/internal/wallet/:id` → `/internal/balance/:id`)
- [x] Wire initiate-route idempotency key through `rez-payment-service`

## Internal Security Hardening

- [x] Document internal auth audit across core services
- [x] Review all internal-token protected mutation endpoints
- [x] Introduce backward-compatible scoped internal auth for core service-to-service traffic (`x-internal-service` + `INTERNAL_SERVICE_TOKENS_JSON`)
- [x] Remove legacy shared-token fallback from core service-to-service auth and outbound callers
- [x] Standardize internal-auth response semantics across core services (`401` invalid/missing credentials, `503` missing config)
- [x] Add audit logging for all internal mutations (wallet credit/debit/merchant-credit, order status/cancel, finance bnpl/emi/score)
- [x] Add access tests for high-risk internal routes (14 source-level guards: middleware order, audit coverage, auth strength)
- [x] Verify access-guard suites pass in `rez-payment-service`, `rez-order-service`, and `rez-wallet-service`
- [x] Standardize marketing inbound auth to the stricter internal-token baseline
- [x] Move finance partner webhooks off the shared internal token and onto partner-specific signatures

## Reliability and Bootstrap Consistency

- [x] Add `validateEnv()` to `rez-order-service`
- [x] Standardize live, ready, and health endpoints across services
- [x] Standardize graceful shutdown behavior across services (all services drain workers, close HTTP, quit Redis, disconnect Mongo)
- [x] Standardize tracing and error-handling bootstrap
- [x] Add `validateEnv()` to catalog, gamification, search, and ads services
- [x] Fix ads-service to perform real graceful shutdown

## Testing Priorities

- [x] Add order-service tests for state transitions
- [x] Add order-service tests for SSE route behavior
- [x] Add wallet tests for idempotent credit/debit flows
- [x] Add gateway smoke tests for routing and CORS
- [x] Add frontend integration tests around web-menu payment/auth flow
- [x] Add finance integration tests for wallet rewards and contextual data fetches
- [x] Add search homepage user-context regression coverage

## Retail System Bug Fixes (2026-04-08)

> Source: Retail system full audit — customer ordering → store receiving → offers → admin

- [x] **Bug #1** — Fix `placed` vs `pending` status mismatch in `rez-order-service` (SSE stream, state machine, cancel endpoint all used `pending` instead of canonical `placed`)
- [x] **Bug #2** — Add `placed → confirmed` merchant transition in `rez-merchant-service` + Accept Order button in merchant live orders screen
- [x] **Bug #3** — Fix offer ownership not enforced: `PUT/DELETE /offers/:id` in `rez-merchant-service` now verifies the offer belongs to the requesting merchant's stores
- [x] **Bug #4** — Add named export `orderApi` to `rezapp/services/orderApi.ts` (was default-only, causing test import failures)
- [x] **Bug #5** — Sync `rez-order-service` state machine to canonical backend (statuses and transitions now match `rezbackend/src/config/orderStateMachine.ts`)
- [x] **Bug #6** — Remove duplicate merchant dispute route handlers from monolith (`rezbackend`). Disputes are now fully served by `rez-merchant-service`. Code fix done.
- [x] **Bug #7** — Add `out_for_delivery` and `cancelling` to admin orders UI — status filter chips now show all 12 canonical statuses; transitions map corrected
- [x] **Bug #8** — Wire BullMQ side effects in `rez-order-service` worker: settlement event enqueued to `wallet-events` on delivery; cancellation notification enqueued to `notification-events` on cancel

### PENDING — Infra action required (DO NOT FORGET)

- [ ] **Nginx: remove explicit `/api/merchant/disputes` route to monolith**

  The monolith handler is commented out. Until nginx is updated, `/api/merchant/disputes` will return 404.

  **What to do:** In your nginx config, find and remove (or comment out):
  ```nginx
  location /api/merchant/disputes {
      proxy_pass http://rezbackend;
  }
  ```
  After removing it, the existing `/api/merchant/` catch-all will route disputes to `rez-merchant-service` automatically.

  **Verify fix:**
  ```bash
  curl -H "Authorization: Bearer <token>" https://api.rez.money/api/merchant/disputes
  # Should return { "success": true, "data": { "disputes": [...] } }
  ```

## Architecture Cleanup

Execution plan: [ARCHITECTURE_EXECUTION_PLAN.md](/Users/rejaulkarim/Documents/ReZ Full App/docs/ARCHITECTURE_EXECUTION_PLAN.md)
Decision record: [ADR-001_DEVELOPMENT_WORKSPACE_STRATEGY.md](/Users/rejaulkarim/Documents/ReZ Full App/docs/ADR-001_DEVELOPMENT_WORKSPACE_STRATEGY.md)

- [x] Decide on one workspace/repo strategy for REZ services
- [x] Normalize Express, Mongoose, TypeScript, and test tooling versions
- [x] Split `rez-merchant-service` into clearer bounded modules
- [x] Clean root structure to separate active code, archives, and audit artifacts
- [x] Add `rez-shared` package contract smoke tests
- [x] Restore `rez-shared` local dependency install and TypeScript build
