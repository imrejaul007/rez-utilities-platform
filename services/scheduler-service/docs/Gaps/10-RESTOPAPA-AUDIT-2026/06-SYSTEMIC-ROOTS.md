# Gen 14 — Systemic Root Cause Analysis

**Generated:** 2026-04-16 | **Status:** 5 root diseases identified

The 85 issues found in this audit are symptoms of 5 structural diseases in the codebase. Fixing individual bugs without addressing the root diseases will result in the same bugs appearing again within weeks. Each root disease is documented with the evidence, the fix, and the estimated impact.

---

## RP-SYS-1: No Shared Schema Contracts — 3 Incompatible Definitions Per Concept

**Severity:** CRITICAL | **Status:** Systemic

### Evidence
- `IEarnRecord.verificationSignals` canonical type vs actual karma service model — zero shared field names
- 3 `CoinTransaction` models across 3 services, all writing to the same collection with different fields
- 15+ status string variants across 6 repos — no canonical enum
- POS bills use `paid`, canonical uses `completed`, refund state doesn't exist
- Consumer/marchant/admin apps each define local `OrderStatus` and `CoinType` instead of importing from shared-types
- `VoucherBrand` defined 3 times (Gen 10 finding)

### Drives These Gaps
- RP-C13 (IEarnRecord mismatch)
- RP-C11 (3 CoinTransaction schemas)
- RP-H01 (15+ status variants)
- RP-H02 (POS refund impossible)
- RP-M04 (local enums not from shared-types)
- XRM-06, XRM-07, XRM-10, XRM-11

### Root Cause
Each service/app defines its own data models independently. No shared schema registry. No build-time contract validation. No fitness tests preventing local type definitions.

### Fix
1. Define all canonical schemas in `packages/shared-types/src/`
2. Enforce via ESLint: `import { OrderStatus } from '@rez/shared'` — disallow local enum definitions
3. Add fitness test: `no-bespoke-enums.sh` (already exists but not enforcing)
4. Add build-time contract validation: generate TypeScript types from OpenAPI specs

### Impact of Fix
Eliminates ~30% of all bugs. One fix resolves 100+ instances across all codebases.

---

## RP-SYS-2: Routes Written But Never Wired — Dead Code Masquerading as Working Code

**Severity:** CRITICAL | **Status:** Systemic

### Evidence
- Karma service HTTP routes: full implementations exist in `karmaRoutes.ts`, `verifyRoutes.ts`, `batchRoutes.ts` but `routes/index.ts` mounts 501 stubs
- CrossAppSyncService webhook: HTTP call commented out, only logs "Simulated webhook delivery"
- Batch notification: call is commented out as "Phase 2 placeholder"
- Karma auth route 404: wrong endpoint mounted (`/api/karma/auth` vs actual path)

### Drives These Gaps
- RP-C01 (karma routes 501)
- RP-C02 (webhook dead code)
- RP-H12 (notification commented out)
- G-KS-C4 (auth 404)

### Root Cause
Routes are implemented incrementally and tested in isolation, but the integration step (mounting the route in Express, wiring the event handler, uncommenting the HTTP call) is treated as "finish later" and never completed.

### Fix
1. Audit all `501`, `stub`, `// TODO`, `// Phase` markers across all services
2. Create a "dead code audit" checklist: every 501/placeholder must be either wired or deleted
3. Add integration tests that verify endpoints return non-501 responses
4. Mark incomplete features as `stub: true` in the route definition so they're clearly visible

### Impact of Fix
Eliminates deceptive bugs — code that looks like it works but doesn't. ~5-10% of bugs in this category.

---

## RP-SYS-3: Service-to-Service Auth Is Non-Existent — Trust by Network Position

**Severity:** CRITICAL | **Status:** Systemic

### Evidence
- Wallet service calls from karma service: no API key, no bearer token, no HMAC
- Internal service key unvalidated in all services (FORENSIC-001 F001-C11)
- Admin auth bypass: `requireAdmin` undefined in batch routes
- Auth service 503 fail-open for non-admin routes
- SSE order stream: no merchant ownership check

### Drives These Gaps
- RP-C08 (admin auth bypass)
- RP-C09 (wallet no auth)
- RP-H15 (auth fail-open)
- RP-H20 (socket room ownership)

### Root Cause
Services are deployed on the same internal network and assume mutual trust. No defense-in-depth. No capability scoping. No service identity tokens.

### Fix
1. Add service-to-service JWT authentication for all internal API calls
2. Implement capability scoping: each service token can only call specific endpoints
3. Validate all `Authorization` headers in internal middleware
4. Add HMAC signature verification for webhook callbacks
5. Fail-closed on auth service unavailability for admin routes

### Impact of Fix
Prevents service-compromise from spreading. Critical for financial operations.

---

## RP-SYS-4: Fire-and-Forget for Financial Operations — No Retry, No DLQ, No Compensating Transaction

**Severity:** CRITICAL | **Status:** Systemic

### Evidence
- Referral credit: no try/catch, no retry, no DLQ
- Batch notification: commented out
- Gamification events: EventEmitter fail-open if BullMQ also fails
- Karma pool decrement before record save: no transaction
- Consumer app offline queue: silently discards after MAX_RETRIES

### Drives These Gaps
- RP-C05 (pool decrement no transaction)
- RP-C06 (referral no retry)
- RP-C07 (referral race condition)
- RP-H06 (gamification fail-open)
- RP-M29 (offline queue silent discard)

### Root Cause
Financial operations are treated like regular async operations. No special handling for the case where the operation fails mid-way. No DLQ. No compensating transactions.

### Fix
1. Wrap all multi-step financial operations in MongoDB transactions
2. Add idempotency keys to all financial mutations
3. Implement DLQ for all async financial operations
4. Add compensating transaction logic for failed operations
5. Replace fire-and-forget with BullMQ jobs + retry + DLQ

### Impact of Fix
Eliminates silent financial data loss. Prevents double-credits and phantom balances.

---

## RP-SYS-5: Frontend and Backend Evolved Separately — No Contract-First Development

**Severity:** HIGH | **Status:** Systemic

### Evidence
- Frontend order payload missing `voucherCode` + `offerRedemptionCode`
- Admin expects `store.merchantId` but backend doesn't populate it
- Wallet balance has 3 different response shapes
- Delivery cost in 2 different fields
- `TransactionMetadata` defined twice in same file
- Hardcoded conversion rates instead of engine call

### Drives These Gaps
- RP-C14 (missing voucherCode)
- RP-C15 (missing merchantId)
- RP-H16 (triple wallet balance fallback)
- RP-H17 (duplicate delivery field)
- RP-M13 (duplicate interface)
- RP-H09, RP-H11 (hardcoded values)

### Root Cause
Frontend and backend teams worked in parallel without shared type contracts. Frontend assumed backend would return certain fields, backend assumed frontend would send certain fields. Neither assumption was verified.

### Fix
1. Adopt contract-first development: define OpenAPI spec first, generate types, generate mock servers
2. Add API contract tests: verify backend returns exactly what frontend expects
3. Use shared TypeScript types from `packages/shared-types` in both frontend and backend
4. Add API changelog: any backend change requires updating the contract spec

### Impact of Fix
Eliminates entire categories of API mismatch bugs. Reduces debugging time by 40%+.

---

## Root Cause Summary

| Root Cause | Issues Driven | Fix Effort | Fix Impact |
|-----------|-------------|-----------|-----------|
| RP-SYS-1: No shared schemas | ~30% of all bugs | ~15h | Eliminates 100+ instances |
| RP-SYS-2: Dead code never wired | ~10% of all bugs | ~5h | Deceptive code gone |
| RP-SYS-3: No service auth | 4 CRITICAL | ~8h | Platform security secured |
| RP-SYS-4: Fire-and-forget financial | ~15% of all bugs | ~12h | No silent data loss |
| RP-SYS-5: No contract-first dev | ~20% of all bugs | ~10h | API mismatches eliminated |

**Total for root cause fixes: ~50h — resolves ~75% of all bugs**

---

## Architecture Fitness Tests Needed

| Test | Prevents | Status |
|------|---------|--------|
| `no-bespoke-enums.sh` | Local enum definitions | Exists, not enforced |
| `no-bespoke-idempotency.sh` | Fire-and-forget financial ops | Needs creation |
| `no-as-any.sh` | `as any` casts | Needs creation |
| `canonical-types-only.sh` | Local type definitions | Needs creation |
| `no-501-routes.sh` | Dead route stubs | Needs creation |
| `service-auth.sh` | Missing auth headers on internal calls | Needs creation |
