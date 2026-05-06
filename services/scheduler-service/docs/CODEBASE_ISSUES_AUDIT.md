# REZ Codebase Issues Audit

Last updated: 2026-04-08
Scope: static audit of the REZ full app workspace, including core backend services, shared package, gateway, and selected frontend clients.

## Summary

This repository is a large multi-product ecosystem with strong architectural intent, but the implementation quality is uneven across services. The biggest issues are not only isolated bugs, but also consistency problems across package management, routing discipline, build outputs, dependency versions, and test coverage.

The most urgent issues found in this audit are:

1. A payment verification endpoint is accidentally re-exposed to authenticated users after being marked internal-only.
2. A merchant orders route has a route-order shadowing bug that likely breaks the stats endpoint.
3. The shared package contract drifted from its committed build surface and did not safely expose subpath entrypoints.
4. Payment initiation accepted client-supplied amounts on a public route, and non-order paths lacked a server-authoritative amount source.
5. Order service startup is less defensive than the other critical services.

## Status Update

Resolved in the current workspace (updated 2026-04-08):

- TypeScript normalized to `^5.4.5` and Mongoose normalized to `^8.17.2` across all 14 packages; overrides and devDependencies added to root workspace manifest to enforce hoisting
- All 43 source-guard and access-guard tests pass across payment, order, wallet, search, finance, and gateway services

Resolved in the current workspace:

- payment verify endpoint is now internal-only again
- merchant `/orders/stats/summary` route shadowing has been fixed
- `rez-shared` package contract has been aligned with the stable committed build output, including explicit `./middleware`, `./schemas`, `./queue`, and `./webhook` subpath exports
- `rez-shared` local dependencies have been repaired enough for the package to install, test, and build successfully in this workspace
- payment initiation now enforces authoritative order amount checks for order payments
- client-facing payment initiation now rejects non-order purposes unless a separate server-authoritative flow is added
- payment initiation now accepts and forwards idempotency keys from the public route
- order service now validates required environment variables at startup
- finance wallet rewards and behavioral fetches now align with the current wallet/order internal contracts
- order service now exposes an internal user summary endpoint consumed by finance
- order service now exposes `/health/live` alongside `/health` and `/health/ready`
- search homepage user context now reads wallet values from the current wallet schema
- catalog, gamification, search, and ads services now validate required environment variables before startup
- marketing no longer fails open outside production when its internal auth secret is missing
- marketing internal auth now uses `401` on invalid credentials and `crypto.timingSafeEqual` rather than plain string comparison
- ads service now performs a real graceful shutdown instead of exiting immediately on `SIGTERM`
- wallet reconciliation synchronous sampling is now capped at 100 wallets per request instead of 10,000
- lightweight regression tests now exist for payment verify-route exposure, payment amount hardening, payment lifecycle guards, merchant route ordering, order-service source guards, wallet safeguard checks, access guards on high-risk internal payment/order/wallet routes, and `rez-shared` package contract stability
- internal-auth response semantics are now standardized across the core services hardened in this workspace: `401` for missing or invalid credentials and `503` for missing server-side configuration
- the legacy shared-token fallback has now been removed from the core service-to-service auth path in this workspace; scoped callers must send `x-internal-service` and match `INTERNAL_SERVICE_TOKENS_JSON`

Partially reduced but not fully eliminated:

- payment refund/capture/webhook logic now has regression coverage for core guardrails, but still lacks full runtime integration coverage against live gateway and database behavior
- wallet idempotency and frozen-balance safeguards now have regression coverage, but broader caller-by-caller auditing of wallet mutation flows is still pending
- scoped internal auth is implemented for the core services, but capability-level scoping and some non-core bridge surfaces still need follow-through
- tracing/error-handling bootstrap is more consistent than before, but not yet fully standardized across all core services
- health endpoint exposure is more consistent than before, but some services still expose liveness/readiness on sidecar or non-uniform ports
- several newer tests are still source/config guard suites rather than live behavioral HTTP integration tests

Strategic next-step document:

- [ARCHITECTURE_EXECUTION_PLAN.md](/Users/rejaulkarim/Documents/ReZ Full App/docs/ARCHITECTURE_EXECUTION_PLAN.md) converts the remaining repo/workspace, dependency normalization, merchant modularization, and root cleanup work into an ordered execution plan

Additional verification completed in this pass:

- `rez-payment-service` test suite passes with access-guard coverage for internal-only verify and restricted refund routes
- `rez-order-service` test suite passes with access-guard coverage for internal summary, list, stream, and by-id routes behind `requireInternalToken`
- `rez-wallet-service` test suite passes with access-guard coverage for internal credit, debit, merchant-credit, and reconcile routes plus audit-log checks

## Audit Scope

Reviewed areas:

- `rez-auth-service`
- `rez-wallet-service`
- `rez-order-service`
- `rez-payment-service`
- `rez-merchant-service`
- `rez-shared`
- `rez-api-gateway`
- `rez-web-menu`
- `Hotel OTA`
- root architecture and deployment docs

Signals used:

- service bootstrap patterns
- route registration and route ordering
- package scripts and dependency consistency
- shared package export/build alignment
- health/readiness/shutdown behavior
- test presence and likely coverage gaps
- security-sensitive flows around auth, payment, and internal-token access

## Critical Issues

### 1. Payment signature verification endpoint is re-exposed

Severity: Critical
Area: `rez-payment-service`

Issue:

The payment routes first define `/api/razorpay/verify-payment` as internal-only using `requireInternalToken`, then later re-register the same route with `requireAuth`. This reintroduces the exact signature-oracle risk the comment says should be avoided.

Impact:

- authenticated users may be able to probe signature validation behavior
- security assumptions documented in the file are violated
- duplicate route registration can hide intent and cause maintenance errors

References:

- [rez-payment-service/src/routes/paymentRoutes.ts:189](/Users/rejaulkarim/Documents/ReZ Full App/rez-payment-service/src/routes/paymentRoutes.ts#L189)
- [rez-payment-service/src/routes/paymentRoutes.ts:202](/Users/rejaulkarim/Documents/ReZ Full App/rez-payment-service/src/routes/paymentRoutes.ts#L202)
- [rez-payment-service/src/routes/paymentRoutes.ts:225](/Users/rejaulkarim/Documents/ReZ Full App/rez-payment-service/src/routes/paymentRoutes.ts#L225)

Recommended fix:

- remove the user-facing duplicate route
- keep this endpoint internal-only
- add a regression test proving authenticated user JWTs cannot access it

### 2. Merchant order stats route is shadowed by `/:id`

Severity: High
Area: `rez-merchant-service`

Issue:

`GET /:id` is registered before `GET /stats/summary`. In Express, that means `/stats/summary` will match `/:id` first and likely be treated as an order lookup for `id = "stats"`.

Impact:

- order statistics endpoint may be broken in production
- behavior depends on route ordering rather than explicit path safety
- similar bugs may exist in other large route modules

References:

- [rez-merchant-service/src/routes/orders.ts:62](/Users/rejaulkarim/Documents/ReZ Full App/rez-merchant-service/src/routes/orders.ts#L62)
- [rez-merchant-service/src/routes/orders.ts:133](/Users/rejaulkarim/Documents/ReZ Full App/rez-merchant-service/src/routes/orders.ts#L133)

Recommended fix:

- move `/stats/summary` above `/:id`
- add tests for `/orders/stats/summary` and `/orders/:id`
- optionally constrain `/:id` to object-id-shaped params

### 3. `rez-shared` package contract drifted from its subpath build surface

Severity: High
Area: `rez-shared`

Issue:

At audit time, the shared package contract was inconsistent with the built surface. The committed `dist/` tree contained subpath entrypoints such as `middleware`, `schemas`, `queue`, and `webhook`, but the package contract was not reliably exposing those entrypoints for consumers.

Impact:

- consumers can hit runtime `package path is not exported` or missing-target failures on subpath imports
- shared library adoption is unsafe until packaging is trustworthy
- release quality depends on manual luck rather than package validation

References:

- [rez-shared/package.json:11](/Users/rejaulkarim/Documents/ReZ Full App/rez-shared/package.json#L11)
- [rez-shared/src/index.ts:2](/Users/rejaulkarim/Documents/ReZ Full App/rez-shared/src/index.ts#L2)
- [rez-shared/dist](/Users/rejaulkarim/Documents/ReZ Full App/rez-shared/dist)

Recommended fix:

- align `exports` with actual build output
- ensure `tsconfig` emits all advertised modules
- add a post-build smoke test that imports every exported subpath

Status:

- fixed in the current workspace

## High-Priority Security and Money Flow Risks

### 4. Payment initiation uses client-supplied amount on a public route

Severity: High
Area: `rez-payment-service`

Issue:

At audit time, the public initiate endpoint validated that `amount` was positive and then forwarded it into payment initiation. Service-layer authoritative checks only applied to order payments, so non-order purposes still depended on caller-supplied amounts.

Impact:

- potential price tampering if upstream orchestration is incomplete
- hidden security dependency on callers doing the right thing
- money flow integrity is spread across services instead of enforced at the payment boundary

References:

- [rez-payment-service/src/routes/paymentRoutes.ts:72](/Users/rejaulkarim/Documents/ReZ Full App/rez-payment-service/src/routes/paymentRoutes.ts#L72)
- [rez-payment-service/src/routes/paymentRoutes.ts:84](/Users/rejaulkarim/Documents/ReZ Full App/rez-payment-service/src/routes/paymentRoutes.ts#L84)
- [rez-payment-service/src/services/paymentService.ts:58](/Users/rejaulkarim/Documents/ReZ Full App/rez-payment-service/src/services/paymentService.ts#L58)

Recommended fix:

- fetch authoritative order totals server-side before creating payment orders
- reject non-order public initiations until a server-authoritative source exists for those flows
- add tests for amount mismatch rejection

Status:

- fixed for the main client-facing initiate route in the current workspace
- fixed for the legacy compat `/api/razorpay/create-order` route as well by requiring an order reference before Razorpay order creation

### 5. Internal-token protected endpoints have large blast radius

Severity: High
Area: `rez-order-service`, `rez-wallet-service`

Issue:

Several powerful endpoints are protected only by the shared internal token. This is a reasonable pattern, but some of these routes expose broad read/update capability, including order reads, order status updates, SSE streams, wallet credit/debit operations, merchant wallet credit, and reconciliation tooling.

Impact:

- one leaked internal token can expose multiple sensitive service functions
- difficult to scope or rotate privileges by service
- auditability is weaker than per-service or per-capability credentials

References:

- [rez-order-service/src/httpServer.ts:117](/Users/rejaulkarim/Documents/ReZ Full App/rez-order-service/src/httpServer.ts#L117)
- [rez-order-service/src/httpServer.ts:172](/Users/rejaulkarim/Documents/ReZ Full App/rez-order-service/src/httpServer.ts#L172)
- [rez-order-service/src/httpServer.ts:243](/Users/rejaulkarim/Documents/ReZ Full App/rez-order-service/src/httpServer.ts#L243)
- [rez-wallet-service/src/routes/internalRoutes.ts:24](/Users/rejaulkarim/Documents/ReZ Full App/rez-wallet-service/src/routes/internalRoutes.ts#L24)

Recommended fix:

- move toward scoped internal auth or service-specific tokens
- add request signing or service identity metadata
- add structured audit logging on internal mutations

### 5A. Finance service wallet and order integrations are wired to non-existent routes and the wrong wallet contract

Severity: High
Area: `rez-finance-service`, `rez-wallet-service`, `rez-order-service`

Issue:

The finance service is calling wallet and order URLs that do not exist in the current service contracts. `creditIntelligenceService` calls `/internal/wallet/:userId` and `/internal/orders/summary/:userId`, while wallet exposes `/internal/balance/:userId` and order service does not expose that summary route. `rewardsHookService` also posts to `/internal/coins/credit`, but wallet exposes `/internal/credit` and requires `coinType` rather than the `event` field finance is sending.

Impact:

- finance behavioral scoring silently falls back to zeros or defaults
- finance reward coins for score checks, loan disbursals, EMI bonuses, bill pay, and recharge can fail end-to-end
- failures are easy to miss because the finance side treats them as non-fatal

References:

- [rez-finance-service/src/services/creditIntelligenceService.ts:161](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-finance-service/src/services/creditIntelligenceService.ts#L161)
- [rez-finance-service/src/services/rewardsHookService.ts:35](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-finance-service/src/services/rewardsHookService.ts#L35)
- [rez-wallet-service/src/routes/internalRoutes.ts:27](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-wallet-service/src/routes/internalRoutes.ts#L27)
- [rez-wallet-service/src/routes/internalRoutes.ts:72](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-wallet-service/src/routes/internalRoutes.ts#L72)

Recommended fix:

- align finance to the actual wallet/order internal API contract
- send wallet-required fields including `coinType` and a stable `idempotencyKey`
- add integration tests that exercise finance-to-wallet and finance-to-order calls

Status:

- fixed in the current workspace

### 5B. Payment route does not expose the idempotency key that the service layer depends on

Severity: High
Area: `rez-payment-service`

Issue:

`paymentService.initiatePayment()` supports `orchestratorIdempotencyKey` and has both a Redis lock and a unique index around that key, but the public initiate route schema does not accept an idempotency field and the route does not forward one into the service call.

Impact:

- duplicate pending payments can still be created across retries or repeated taps
- the most important payment initiation guard is effectively unreachable from the main client-facing route
- mobile retry behavior depends on timing instead of a stable payment contract

References:

- [rez-payment-service/src/routes/paymentRoutes.ts:10](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-payment-service/src/routes/paymentRoutes.ts#L10)
- [rez-payment-service/src/routes/paymentRoutes.ts:72](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-payment-service/src/routes/paymentRoutes.ts#L72)
- [rez-payment-service/src/services/paymentService.ts:88](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-payment-service/src/services/paymentService.ts#L88)

Recommended fix:

- accept a client or orchestrator idempotency key in the initiate route
- thread it into `initiatePayment()`
- add a regression test proving retries return the same pending payment

Status:

- fixed in the current workspace

### 5C. Finance approval stats update uses the wrong field and likely never increments

Severity: Medium
Area: `rez-finance-service`

Issue:

When a loan status becomes `approved`, `loanService.updateStatus()` updates `PartnerOffer` documents using `partnerOfferId: application.partnerId`. `partnerOfferId` stores the external offer id, while `application.partnerId` is the provider slug.

Impact:

- approval metrics on partner offers are likely stale or always zero
- analytics and ranking logic can undercount actual approvals

References:

- [rez-finance-service/src/services/loanService.ts:68](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-finance-service/src/services/loanService.ts#L68)
- [rez-finance-service/src/models/PartnerOffer.ts:8](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-finance-service/src/models/PartnerOffer.ts#L8)

Recommended fix:

- update the filter to target the real partner offer identifier or store the originating offer id on the application
- add a test around approval stats updates

Status:

- fixed in the current workspace by updating the stats filter to use `partnerId`

## Reliability and Operational Issues

### 6. Order service lacks the startup env validation standard used elsewhere

Severity: Medium
Area: `rez-order-service`

Issue:

Auth, wallet, and payment validate required environment variables before startup. Order service does not follow the same standard.

Impact:

- configuration failures happen later and less clearly
- deployment quality differs by service
- operators cannot rely on uniform boot behavior

References:

- [rez-order-service/src/index.ts:18](/Users/rejaulkarim/Documents/ReZ Full App/rez-order-service/src/index.ts#L18)
- [rez-auth-service/src/index.ts:26](/Users/rejaulkarim/Documents/ReZ Full App/rez-auth-service/src/index.ts#L26)
- [rez-wallet-service/src/index.ts:226](/Users/rejaulkarim/Documents/ReZ Full App/rez-wallet-service/src/index.ts#L226)
- [rez-payment-service/src/index.ts:27](/Users/rejaulkarim/Documents/ReZ Full App/rez-payment-service/src/index.ts#L27)

Recommended fix:

- add a `validateEnv()` bootstrap step to order service
- standardize required env validation across all services

### 7. Wallet reconciliation endpoint is too expensive for a live HTTP path

Severity: Medium
Area: `rez-wallet-service`

Issue:

At audit time, the reconciliation endpoint could inspect up to 10,000 wallets and ran ledger aggregation work per wallet in a loop.

Impact:

- heavy CPU and database load
- unsafe operationally even if internal-only
- easy to trigger timeouts or noisy-neighbor effects

References:

- [rez-wallet-service/src/routes/internalRoutes.ts:178](/Users/rejaulkarim/Documents/ReZ Full App/rez-wallet-service/src/routes/internalRoutes.ts#L178)
- [rez-wallet-service/src/routes/internalRoutes.ts:208](/Users/rejaulkarim/Documents/ReZ Full App/rez-wallet-service/src/routes/internalRoutes.ts#L208)

Recommended fix:

- move full reconciliation to a background job or script-only path
- cap synchronous sampling much lower
- require stronger admin gating and explicit audit logs

Status:

- partially fixed in the current workspace by reducing the synchronous cap to 100 wallets per request
- still worth moving full reconciliation to a script or background job

### 7A. Search homepage user context reads wallet fields that do not exist in the wallet schema

Severity: Medium
Area: `rez-search-service`

Issue:

`/api/homepage/user-context` reads `coinBalance` and `totalSaved` from the wallet document root, but the wallet schema stores those values under `balance.available` and `savingsInsights.totalSaved`.

Impact:

- homepage user context can show wallet balance and savings as zero even when the wallet has real values
- this can look like intermittent data loss rather than a clear endpoint bug

References:

- [rez-search-service/src/routes/homepageRoutes.ts:49](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-search-service/src/routes/homepageRoutes.ts#L49)
- [rez-wallet-service/src/models/Wallet.ts:15](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-wallet-service/src/models/Wallet.ts#L15)

Recommended fix:

- project and read the real nested wallet fields
- add a regression test for non-zero wallet and savings values

Status:

- fixed in the current workspace

### 8. Package installation/build state is inconsistent across sibling services

Severity: Medium
Area: repo-wide

Issue:

This repo is not one true top-level workspace for the REZ sibling services. `Hotel OTA` is a workspace, but the rest of the services mostly operate as independent packages.

Impact:

- dependency drift
- inconsistent local install state
- uneven tool availability per package
- slower CI standardization and weaker reproducibility

References:

- [Hotel OTA/package.json:5](/Users/rejaulkarim/Documents/ReZ Full App/Hotel OTA/package.json#L5)
- [rez-order-service/package.json:6](/Users/rejaulkarim/Documents/ReZ Full App/rez-order-service/package.json#L6)
- [rez-wallet-service/package.json:6](/Users/rejaulkarim/Documents/ReZ Full App/rez-wallet-service/package.json#L6)
- [rez-shared/package.json:43](/Users/rejaulkarim/Documents/ReZ Full App/rez-shared/package.json#L43)

Recommended fix:

- either convert REZ services into one real workspace
- or split them into intentionally independent repos with clear release contracts

### 8A. Several extracted services still boot without required-env validation

Severity: Medium
Area: `rez-catalog-service`, `rez-gamification-service`, `rez-search-service`, `rez-ads-service`

Issue:

The newer extracted services start immediately and rely on downstream connection failures instead of validating their required runtime env vars up front.

Impact:

- deployment misconfiguration fails later and less clearly
- bootstrap behavior is inconsistent across the service fleet
- operators cannot rely on one startup contract

References:

- [rez-catalog-service/src/index.ts:18](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-catalog-service/src/index.ts#L18)
- [rez-gamification-service/src/index.ts:19](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-gamification-service/src/index.ts#L19)
- [rez-search-service/src/index.ts:28](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-search-service/src/index.ts#L28)
- [rez-ads-service/src/index.ts:44](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-ads-service/src/index.ts#L44)

Recommended fix:

- add `validateEnv()` to all extracted services
- standardize required env reporting before any network connections are attempted

Status:

- fixed for catalog, gamification, search, and ads in the current workspace

## Architecture and Maintainability Issues

### 9. Merchant service is carrying too much domain surface in one process

Severity: Medium
Area: `rez-merchant-service`

Issue:

The merchant service registers a very large number of domains directly in one service: auth, stores, products, orders, payroll, loyalty, growth, videos, uploads, payouts, team, disputes, subscriptions, vouchers, pricing, and more.

Impact:

- high coupling
- difficult regression analysis
- large change surface for any deploy
- harder ownership boundaries

References:

- [rez-merchant-service/src/index.ts](/Users/rejaulkarim/Documents/ReZ Full App/rez-merchant-service/src/index.ts)

Recommended fix:

- split by bounded domains even if deployment remains unified at first
- create internal module boundaries with ownership
- centralize shared middleware and route conventions

### 10. Framework and dependency versions are drifting

Severity: Medium
Area: repo-wide

Issue:

Services are not aligned on major dependency versions. For example, wallet uses Express 4 while order service and shared package are on Express 5 directionally.

Impact:

- middleware incompatibilities
- harder shared tooling
- subtle runtime behavior differences across services

References:

- [rez-wallet-service/package.json:21](/Users/rejaulkarim/Documents/ReZ Full App/rez-wallet-service/package.json#L21)
- [rez-order-service/package.json:23](/Users/rejaulkarim/Documents/ReZ Full App/rez-order-service/package.json#L23)
- [rez-shared/package.json:53](/Users/rejaulkarim/Documents/ReZ Full App/rez-shared/package.json#L53)

Recommended fix:

- define baseline versions for Express, Mongoose, TypeScript, eslint, test runner, and shared libs

### 11. Marketing and partner-webhook auth patterns are inconsistent with the stricter internal-auth baseline

Severity: Medium
Area: `rez-marketing-service`, `rez-finance-service`

Issue:

Marketing previously used `x-internal-key` instead of the repo-standard token header and allowed protected routes through when `INTERNAL_SERVICE_KEY` was absent outside production. Finance partner webhooks previously relied on the shared internal token even though they are conceptually third-party inbound webhooks.

Impact:

- internal auth semantics diverge across services
- staging or non-production environments can drift into weaker auth behavior
- partner webhook trust is tied to the same shared secret used for service-to-service calls

References:

- [rez-marketing-service/src/index.ts:48](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-marketing-service/src/index.ts#L48)
- [rez-finance-service/src/routes/partnerRoutes.ts:31](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-finance-service/src/routes/partnerRoutes.ts#L31)

Recommended fix:

- make marketing fail closed in every environment where internal routes are exercised
- standardize on one internal-auth contract
- move partner webhooks to partner-specific signatures instead of shared service credentials

Status:

- marketing fail-closed behavior has been fixed in the current workspace
- finance partner webhooks now use partner-specific HMAC verification in the current workspace

### 12. Ads service shutdown is not actually graceful

Severity: Low
Area: `rez-ads-service`

Issue:

On `SIGTERM`, the ads service logs that it is shutting down gracefully and then calls `process.exit(0)` immediately without closing the HTTP server or disconnecting the database.

Impact:

- in-flight requests can be dropped
- shutdown semantics are misleading in logs
- rollout behavior is less predictable than the other services

References:

- [rez-ads-service/src/index.ts:44](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-ads-service/src/index.ts#L44)
- [rez-ads-service/src/index.ts:58](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-ads-service/src/index.ts#L58)

Recommended fix:

- retain the `app.listen()` server handle
- close the HTTP server and database connection before exit
- mirror the shutdown pattern already used in payment, wallet, and order

Status:

- fixed in the current workspace
- migrate on a planned matrix, not ad hoc

### 11. Shared patterns exist, but are not enforced centrally

Severity: Medium
Area: repo-wide

Issue:

Several services independently implement Sentry setup, health endpoints, tracing, env validation, and graceful shutdown. Some do this well, others partially.

Impact:

- duplicated boilerplate
- inconsistent behavior
- slower rollout of operational improvements

References:

- [rez-auth-service/src/index.ts](/Users/rejaulkarim/Documents/ReZ Full App/rez-auth-service/src/index.ts)
- [rez-wallet-service/src/index.ts](/Users/rejaulkarim/Documents/ReZ Full App/rez-wallet-service/src/index.ts)
- [rez-payment-service/src/index.ts](/Users/rejaulkarim/Documents/ReZ Full App/rez-payment-service/src/index.ts)
- [rez-order-service/src/index.ts](/Users/rejaulkarim/Documents/ReZ Full App/rez-order-service/src/index.ts)

Recommended fix:

- create a shared service bootstrap package or template
- standardize logging, health, tracing, and shutdown contracts

## Frontend and Integration Observations

### 12. Web menu client assumes a precise backend path contract

Severity: Medium
Area: `rez-web-menu`

Issue:

The web menu client hardcodes path shaping assumptions around `/api`, `/web-ordering`, OTP routes, and verification flows.

Impact:

- fragile environment configuration
- coupling between frontend route construction and gateway/backend path rewrites

References:

- [rez-web-menu/src/api/client.ts](/Users/rejaulkarim/Documents/ReZ Full App/rez-web-menu/src/api/client.ts)

Recommended fix:

- formalize API base contracts
- keep frontend clients on typed API adapters
- add environment validation at build/start time

### 13. Gateway config is advanced but operationally dense

Severity: Medium
Area: `rez-api-gateway`

Issue:

The optimized nginx config includes rate limits, caching, connection pooling, CORS management, and many upstreams. This is powerful, but also easy to misconfigure without automated validation.

Impact:

- high operational complexity
- difficult debugging when routing, caching, and CORS interact
- config drift risk between base and optimized files

References:

- [rez-api-gateway/nginx.optimized.conf](/Users/rejaulkarim/Documents/ReZ Full App/rez-api-gateway/nginx.optimized.conf)

Recommended fix:

- keep one canonical gateway config
- add route smoke tests and CORS tests
- document which routes are cacheable vs non-cacheable

## Testing Gaps

### 14. Test coverage is too small for the risk profile

Severity: High
Area: repo-wide

Observed:

- auth has a few focused tests
- wallet has only a couple
- payment has a few focused tests
- merchant has a few bootstrap/middleware tests
- order service appears to lack direct service-level tests

References:

- [rez-auth-service/src/__tests__](/Users/rejaulkarim/Documents/ReZ Full App/rez-auth-service/src/__tests__)
- [rez-wallet-service/src/__tests__](/Users/rejaulkarim/Documents/ReZ Full App/rez-wallet-service/src/__tests__)
- [rez-payment-service/src/__tests__](/Users/rejaulkarim/Documents/ReZ Full App/rez-payment-service/src/__tests__)
- [rez-merchant-service/src/__tests__](/Users/rejaulkarim/Documents/ReZ Full App/rez-merchant-service/src/__tests__)
- [rez-order-service/package.json:6](/Users/rejaulkarim/Documents/ReZ Full App/rez-order-service/package.json#L6)

Highest-priority missing tests:

1. payment security and amount validation paths
2. payment verify-route access control
3. merchant order route matching and status transitions
4. order service state machine and SSE behavior
5. wallet internal mutation idempotency and reconciliation safeguards
6. shared package export smoke tests
7. gateway route and CORS smoke tests

## Monorepo and Workspace Issues

### 15. Repository shape is confusing for contributors and CI

Severity: Medium
Area: repo-wide

Issue:

The root contains multiple apps, multiple services, nested git repos or repo-like folders, zips, audit documents, and partially independent package trees.

Impact:

- onboarding cost is high
- CI setup becomes harder
- ownership boundaries are unclear
- local environment behavior is inconsistent

Recommended fix:

- separate product code, documentation, archives, and generated artifacts
- remove or isolate zipped deliverables from active source roots
- document active apps vs legacy/imported folders

## Prioritized Action Plan

### Phase 1: Immediate fixes

1. lock `/api/razorpay/verify-payment` back to internal-only
2. fix merchant order route ordering
3. repair `rez-shared` exports vs build output mismatch
4. add tests for the above three cases

### Phase 2: Money and auth hardening

1. enforce server-side payment amount authority
2. review all internal-token protected mutation endpoints
3. tighten audit logging for internal operations
4. verify order and wallet idempotency flows end to end

### Phase 3: Operational consistency

1. standardize service bootstrap pattern
2. add env validation to all services
3. normalize health/live/ready semantics
4. unify graceful shutdown behavior

### Phase 4: Repo health

1. choose a real workspace strategy
2. align core dependency versions
3. create shared CI checks
4. split oversized services into bounded modules

## Notes and Limitations

This report is based on static analysis and limited build spot-checking in the current workspace. It should be treated as a high-signal engineering audit, not a complete proof that no other issues exist.

Things not fully verified in this pass:

- all runtime integrations
- all data model correctness
- gateway behavior under live traffic
- end-to-end flows across every product
- all nested apps and imported folders

## Recommended Next Step

The best next move is to fix the top three verified defects first, then run a targeted second audit focused on:

1. order and payment end-to-end integrity
2. shared package release correctness
3. merchant-service route safety and domain decomposition
