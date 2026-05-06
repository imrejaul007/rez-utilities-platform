# Remediation Solution Plan

## Health Score: 35/100 — RECOVERABLE: Structural Surgery Required

---

## Immediate Actions (Week 1) — Revenue & Security Blockers

These fixes stop active revenue leaks and security exposures.

### P0-1: Settlement Blind Spot — Merchant Field Mismatch
**Files:** `rez-merchant-service/src/services/settlementService.ts`
**Effort:** 1 line change
**Impact:** Revenue leak — merchants underpaid

```typescript
// Change line 49:
{ merchant: merchantId }  // OLD
// To:
{ merchantId: merchantId }  // NEW
```
Also create backfill migration and reconciliation report.

### P0-2: Karma Service Compile Error
**Files:** `rez-karma-service/src/services/karmaService.ts:128,195`
**Effort:** Remove duplicate declaration
**Impact:** Service cannot deploy

### P0-3: Karma Service Auth 404
**Files:** `rez-karma-service/src/middleware/auth.ts:42`
**Effort:** 1 line change
**Impact:** All karma endpoints unauthenticated

```typescript
// Change:
const verifyUrl = `${authServiceUrl}/api/auth/verify`;
// To:
const verifyUrl = `${authServiceUrl}/api/auth/validate`;
```

### P0-4: Catalog Service Auth Broken
**Files:** `rez-catalog-service/src/middleware/internalAuth.ts`
**Effort:** 3 line change
**Impact:** All catalog service calls fail

```typescript
// Replace runtime generation:
const HMAC_SECRET = crypto.randomBytes(32).toString('hex');
// With:
const HMAC_SECRET = process.env.INTERNAL_HMAC_SECRET;
if (!HMAC_SECRET) throw new Error('Required env var missing');
```

### P0-5: Media Service Static Files Publicly Accessible
**Files:** `rez-media-events/src/http.ts:122`
**Effort:** 1 line change
**Impact:** All uploaded files publicly accessible

Add `return` before `res.status(401)`.

### P0-6: Admin Cron Jobs Use Consumer Auth
**Files:** `rez-backend/.../src/routes/admin.ts`
**Effort:** New middleware + replace middleware on routes
**Impact:** Any user can fire admin jobs

Create `requireAdminAuth` middleware. Apply to all admin cron routes.

### P0-7: Internal Service Keys Unvalidated
**Files:** All service `internalAuth.ts` files
**Effort:** Add validation on startup
**Impact:** Silent auth bypass when env vars empty

Add startup validation for all internal auth configs.

---

## Short-Term (Week 2-3) — Financial Integrity

### P1-1: Merchant Withdrawal TOCTOU
**Files:** `rez-wallet-service/src/services/merchantWalletService.ts`
**Effort:** Refactor to single atomic update
**Impact:** Potential wallet overdraft

### P1-2: Karma 2x Inflation
**Files:** `rez-karma-service/src/services/earnRecordService.ts`, `karmaService.ts`
**Effort:** Remove one of the two increment paths + data correction
**Impact:** All karma values are 2x actual

### P1-3: Dual Authority — Entity Ownership Map
**Files:** `rez-shared/src/constants/entityOwnership.ts`
**Effort:** Create ownership map, add middleware enforcement
**Impact:** Root cause of 8+ gaps

### P1-4: Three Payment FSMs — Unify
**Files:** `rez-shared/`, `rez-payment-service/`, `rez-backend/`
**Effort:** Define canonical FSM in shared, delete local copies
**Impact:** Shadow mode split-brain

### P1-5: Firebase JSON on Disk
**Files:** `rez-backend/.../firebase.ts`, `rez-notification-service/`
**Effort:** Migrate to env vars, remove files, scrub git history
**Impact:** Secret exposure risk

### P1-6: Coin Rate Divergence
**Files:** `rez-payment-service/src/services/paymentService.ts`
**Effort:** Import from shared package
**Impact:** Inconsistent coin awards

---

## Medium-Term (Week 4-8) — Architecture Consolidation

### P2-1: Order Statuses Sync (14 vs 11)
**Files:** `rezbackend/.../config/orderStateMachine.ts`, `rez-shared/`
**Effort:** Align backend FSM, add missing transitions
**Impact:** Return flow broken in monolith

### P2-2: Returned Progress Mismatch
**Files:** `rezbackend/.../orderStateMachine.ts`
**Effort:** Change 0% → 100% for returned status
**Impact:** User confusion

### P2-3: FraudFlag Model
**Files:** `rez-backend/src/models/FraudFlag.ts`
**Effort:** Create model, register, add error handling
**Impact:** All fraud events dropped silently

### P2-4: Finance Service Silent Coin Failure
**Files:** `rez-finance-service/src/services/rewardsHookService.ts`
**Effort:** Implement BullMQ queue with retry
**Impact:** Users silently lose coin rewards

### P2-5: Search Paths Through Gateway
**Files:** `rez-api-gateway/nginx.conf`
**Effort:** Add routing for search service paths
**Impact:** Search endpoints inaccessible

### P2-6: Shadow Mode Feature Flag
**Files:** All services with dual writes
**Effort:** Implement per-entity feature flags for cutover
**Impact:** No cutover mechanism

### P2-7: Database Isolation
**Files:** MongoDB cluster config
**Effort:** Move services to separate databases/collection prefixes
**Impact:** Long-term fix for dual authority

---

## Long-Term (Month 2-3) — Platform Maturity

### P3-1: Comprehensive FSM Registry
All FSMs imported from shared package. Local FSM definitions deleted.

### P3-2: Idempotency Enforcement
All mutation endpoints require idempotency key. Reject without.

### P3-3: Circuit Breakers
All external API calls (Razorpay, Firebase, etc.) wrapped in circuit breakers.

### P3-4: Structured Logging Migration
All services use `pino` / `@rez/shared/telemetry`. No `console.log`.

### P3-5: Chaos Engineering
Automated failure injection tests for Redis, MongoDB, service timeouts.

### P3-6: Schema Registry
Replace `Schema.Types.Mixed` with typed subdocuments. Audit and migrate all 40+ instances.

---

## Remediation Effort Summary

| Priority | Count | Estimated Effort |
|----------|-------|----------------|
| P0 (Week 1) | 7 | 2-4 hours total |
| P1 (Week 2-3) | 6 | 1-2 days total |
| P2 (Week 4-8) | 7 | 3-5 days total |
| P3 (Month 2-3) | 6 | 1-2 weeks total |

**Total: ~3-4 weeks for full remediation of critical and high issues.**

---

## Test Plan After Fixes

1. **Revenue test**: Place orders via monolith path. Verify settlement includes them.
2. **Auth test**: Verify unauthenticated requests blocked on all services.
3. **Karma test**: Place order. Verify exactly +10 karma (not +20).
4. **Wallet test**: Concurrent withdrawal requests. Verify no overdraft.
5. **FSM test**: Transition through all states. Verify no invalid transitions.
6. **Settlement test**: Partial refund. Verify settlement = total - refund.
7. **Coin expiry test**: Promo coins. Verify expire date enforced.
