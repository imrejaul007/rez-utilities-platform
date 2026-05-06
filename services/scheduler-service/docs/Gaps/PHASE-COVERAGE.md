# Phase Coverage — FORENSIC-001 Audit

## All 15 Phases Documented

This document maps every audit phase to the gaps that were discovered during that phase.

---

## Phase 1: Architecture Mapping

**Scope:** Service topology, communication patterns, data flow

### Findings
- [CRITICAL-008](CRITICAL-008-dual-authority.md) — Every entity has 2+ concurrent writers
- [CRITICAL-009](CRITICAL-009-three-payment-fsms.md) — Backend, payment service, shared package all differ
- [HIGH-014](HIGH-014-search-paths-not-routed-gateway.md) — Search paths bypass NGINX gateway
- [MEDIUM-001](MEDIUM-001-020-summary.md) — No upstream keepalive in NGINX
- [INFO-005](LOW-001-008-summary.md) — No shadow mode feature flag
- [INFO-001](LOW-001-008-summary.md) — Three different auth patterns in use

### Phase Score: 45/100

---

## Phase 2: Data Model & Schema Validation

**Scope:** MongoDB schemas, Mongoose models, TypeScript interfaces

### Findings
- [CRITICAL-007](CRITICAL-007-fraudflag-missing.md) — FraudFlag model never registered
- [CRITICAL-013](CRITICAL-013-order-statuses-out-of-sync.md) — 14 vs 11 order statuses
- [CRITICAL-016](CRITICAL-016-returned-progress-mismatch.md) — getOrderProgress returns different values
- [CRITICAL-017](CRITICAL-017-karma-wont-compile.md) — Duplicate startOfWeek declaration
- [HIGH-008](HIGH-008-order-service-unused-schemas.md) — Zod schemas never applied
- [HIGH-015](HIGH-015-schema-mixed-types-40-models.md) — 40+ Schema.Types.Mixed fields
- [HIGH-010](HIGH-010-coin-type-normalization-lost.md) — nuqta records invisible to rez queries
- [MEDIUM-020](MEDIUM-001-020-summary.md) — GST validation missing

### Phase Score: 35/100

---

## Phase 3: Enum & Status Consistency

**Scope:** Order statuses, payment statuses, coin types, loyalty tiers

### Findings
- [CRITICAL-013](CRITICAL-013-order-statuses-out-of-sync.md) — Missing failed_delivery, return_requested, return_rejected
- [CRITICAL-016](CRITICAL-016-returned-progress-mismatch.md) — returned = 0% in backend, 100% in shared
- [HIGH-011](HIGH-011-loyalty-tier-typo-diamond.md) — DIMAOND typo maps to platinum instead of diamond
- [HIGH-013](HIGH-013-authorized-state-no-inbound-path.md) — authorized state unreachable in FSM
- [HIGH-010](HIGH-010-coin-type-normalization-lost.md) — Legacy nuqta coin type not normalized

### Phase Score: 40/100

---

## Phase 4: API Contract Validation

**Scope:** REST endpoints, request/response shapes, header conventions

### Findings
- [CRITICAL-010](CRITICAL-010-coin-rate-divergence.md) — Hardcoded 1:1 vs env var
- [HIGH-001](HIGH-001-payment-webhook-secret-in-body.md) — Secret in body instead of header
- [HIGH-012](HIGH-012-payment-hardcoded-coin-cap.md) — Hardcoded 10000 coin cap
- [HIGH-002](HIGH-002-payment-non-atomic-wallet-credit.md) — walletCredited flag + job not atomic
- [MEDIUM-002](MEDIUM-001-020-summary.md) — No idempotency key on search history
- [MEDIUM-010](MEDIUM-001-020-summary.md) — Admin JWT uses consumer secret

### Phase Score: 42/100

---

## Phase 5: Payment Flow Validation

**Scope:** Razorpay integration, webhook handling, idempotency, double-credit prevention

### Findings
- [CRITICAL-009](CRITICAL-009-three-payment-fsms.md) — Shadow mode creates split-brain payment states
- [CRITICAL-010](CRITICAL-010-coin-rate-divergence.md) — Payment service credits wrong amount
- [HIGH-001](HIGH-001-payment-webhook-secret-in-body.md) — Internal secret sent in body not header
- [HIGH-002](HIGH-002-payment-non-atomic-wallet-credit.md) — Double credit potential
- [HIGH-003](HIGH-003-payment-auth-incompatible-legacy.md) — Payment service rejects legacy tokens
- [MEDIUM-009](MEDIUM-001-020-summary.md) — Webhook no idempotency key
- [MEDIUM-016](MEDIUM-001-020-summary.md) — No HTTP timeout on internal calls
- [MEDIUM-019](MEDIUM-001-020-summary.md) — No circuit breaker on Razorpay

### Phase Score: 30/100

---

## Phase 6: Wallet & Coins Logic

**Scope:** Coin credits, debits, expiry, double-entry ledger, TOCTOU

### Findings
- [CRITICAL-003](CRITICAL-003-merchant-withdrawal-race-condition.md) — TOCTOU on merchant withdrawal
- [CRITICAL-005](CRITICAL-005-karma-2x-inflation.md) — Double karma increment
- [CRITICAL-010](CRITICAL-010-coin-rate-divergence.md) — Inconsistent coin rates
- [CRITICAL-015](CRITICAL-015-silent-coin-failure.md) — Finance service silent coin failure
- [HIGH-006](HIGH-006-bnpl-eligibility-or-instead-of-and.md) — Wrong eligibility logic
- [HIGH-010](HIGH-010-coin-type-normalization-lost.md) — Legacy coin types not migrated
- [MEDIUM-006](MEDIUM-001-020-summary.md) — Wallet invariant incomplete (no pending validation)
- [MEDIUM-013](MEDIUM-001-020-summary.md) — No retry budget on wallet queue
- [MEDIUM-015](MEDIUM-001-020-summary.md) — Settlement ignores partial refunds
- [LOW-005](LOW-001-008-summary.md) — Coin expiry not enforced in queries
- [LOW-008](LOW-001-008-summary.md) — Referral code no expiry

### Phase Score: 25/100

---

## Phase 7: Business Logic Consistency

**Scope:** Settlement calculations, BNPL eligibility, gamification rules

### Findings
- [CRITICAL-001](CRITICAL-001-settlement-blind-spot.md) — merchant field vs merchantId mismatch
- [CRITICAL-005](CRITICAL-005-karma-2x-inflation.md) — Two increment paths active
- [CRITICAL-006](CRITICAL-006-admin-cron-consumer-auth.md) — Admin jobs use consumer auth
- [CRITICAL-015](CRITICAL-015-silent-coin-failure.md) — Finance service no retry/DLQ
- [HIGH-005](HIGH-005-bulk-order-actions-bypass-fsm.md) — Bulk actions skip FSM
- [HIGH-006](HIGH-006-bnpl-eligibility-or-instead-of-and.md) — OR instead of AND
- [MEDIUM-007](MEDIUM-001-020-summary.md) — Settlement in-memory reduce (not aggregation pipeline)
- [MEDIUM-015](MEDIUM-001-020-summary.md) — Settlement ignores partial refunds
- [MEDIUM-018](MEDIUM-001-020-summary.md) — BNPL simple interest undocumented

### Phase Score: 28/100

---

## Phase 8: State Machine Validation

**Scope:** Order FSM, payment FSM, FSM enforcement at DB layer

### Findings
- [CRITICAL-009](CRITICAL-009-three-payment-fsms.md) — Three competing FSMs
- [CRITICAL-013](CRITICAL-013-order-statuses-out-of-sync.md) — Backend missing 3 statuses
- [CRITICAL-016](CRITICAL-016-returned-progress-mismatch.md) — Progress calculation diverges
- [HIGH-004](HIGH-004-order-invalid-nested-object.md) — Nested object where flat string expected
- [HIGH-005](HIGH-005-bulk-order-actions-bypass-fsm.md) — Direct status writes bypass FSM
- [HIGH-013](HIGH-013-authorized-state-no-inbound-path.md) — Dead state in payment FSM
- [MEDIUM-004](MEDIUM-001-020-summary.md) — Missing processing→cancelled transition
- [MEDIUM-005](MEDIUM-001-020-summary.md) — refund_failed retry inconsistency
- [MEDIUM-017](MEDIUM-001-020-summary.md) — No version vector on order events

### Phase Score: 22/100

---

## Phase 9: Real-time System (Socket.IO/SSE)

**Scope:** SSE endpoints, WebSocket auth, heartbeat, stream ownership

### Findings
- [HIGH-009](HIGH-009-order-service-sse-no-auth.md) — SSE stream has no merchant ownership check
- [MEDIUM-008](MEDIUM-001-020-summary.md) — SSE has no heartbeat/keepalive
- [MEDIUM-011](MEDIUM-001-020-summary.md) — Notification events not deduplicated

### Phase Score: 35/100

---

## Phase 10: Offline & Sync Handling

**Scope:** Idempotency, retry logic, offline queue, eventual consistency

### Findings
- [CRITICAL-002](CRITICAL-002-catalog-auth-broken.md) — Auth broken, all sync calls fail
- [HIGH-002](HIGH-002-payment-non-atomic-wallet-credit.md) — walletCredited + job not atomic
- [HIGH-007](HIGH-007-search-rate-limiter-fails-open.md) — Rate limiter fails open on Redis error
- [MEDIUM-002](MEDIUM-001-020-summary.md) — No idempotency on search history
- [MEDIUM-009](MEDIUM-001-020-summary.md) — Webhook no idempotency key
- [MEDIUM-013](MEDIUM-001-020-summary.md) — No retry budget on wallet queue

### Phase Score: 32/100

---

## Phase 11: Error Handling & Logging

**Scope:** Silent failures, DLQ, alerting, structured logging

### Findings
- [CRITICAL-007](CRITICAL-007-fraudflag-missing.md) — Fraud events silently dropped
- [CRITICAL-015](CRITICAL-015-silent-coin-failure.md) — Finance service silent coin failure
- [HIGH-007](HIGH-007-search-rate-limiter-fails-open.md) — Fails open on Redis error
- [MEDIUM-003](MEDIUM-001-020-summary.md) — Health checks don't verify dependencies
- [MEDIUM-014](MEDIUM-001-020-summary.md) — No DLQ monitoring for notifications
- [LOW-002](LOW-001-008-summary.md) — No request ID propagation
- [LOW-003](LOW-001-008-summary.md) — Cron jobs don't log duration
- [LOW-006](LOW-001-008-summary.md) — No structured logging (console.log everywhere)

### Phase Score: 38/100

---

## Phase 12: Security Validation

**Scope:** Auth, secrets, injection, access control, webhook verification

### Findings
- [CRITICAL-002](CRITICAL-002-catalog-auth-broken.md) — Runtime HMAC key breaks all auth
- [CRITICAL-004](CRITICAL-004-karma-auth-404.md) — Wrong endpoint, all auth bypassed
- [CRITICAL-006](CRITICAL-006-admin-cron-consumer-auth.md) — Any user can fire admin jobs
- [CRITICAL-011](CRITICAL-011-internal-service-key-unvalidated.md) — Empty env vars pass validation
- [CRITICAL-012](CRITICAL-012-firebase-json-on-disk.md) — Firebase JSON secrets on disk
- [CRITICAL-014](CRITICAL-014-static-files-unauthenticated.md) — Media files served without auth
- [HIGH-003](HIGH-003-payment-auth-incompatible-legacy.md) — Payment service rejects legacy tokens
- [HIGH-009](HIGH-009-order-service-sse-no-auth.md) — SSE stream unauthorized
- [MEDIUM-010](MEDIUM-001-020-summary.md) — Admin JWT uses consumer secret
- [LOW-001](LOW-001-008-summary.md) — No response compression
- [LOW-002](LOW-001-008-summary.md) — No request ID for tracing

### Phase Score: 18/100 — **LOWEST PHASE**

---

## Phase 13: Performance & Scalability

**Scope:** N+1 queries, missing indexes, in-memory aggregation, connection pooling

### Findings
- [MEDIUM-001](MEDIUM-001-020-summary.md) — No NGINX keepalive
- [MEDIUM-007](MEDIUM-001-020-summary.md) — Settlement uses in-memory reduce
- [MEDIUM-012](MEDIUM-001-020-summary.md) — Product search uses LIKE not text index
- [MEDIUM-016](MEDIUM-001-020-summary.md) — No HTTP timeout on internal calls
- [LOW-001](LOW-001-008-summary.md) — No response compression
- [LOW-004](LOW-001-008-summary.md) — Admin endpoints lack pagination

### Phase Score: 48/100

---

## Phase 14: Duplicate & Conflict Detection

**Scope:** Duplicate logic, copy-paste code, conflicting implementations

### Findings
- [CRITICAL-009](CRITICAL-009-three-payment-fsms.md) — Payment FSM defined 3 times
- [CRITICAL-016](CRITICAL-016-returned-progress-mismatch.md) — getOrderProgress defined twice
- [CRITICAL-013](CRITICAL-013-order-statuses-out-of-sync.md) — ORDER_STATUSES defined 3 times
- [CRITICAL-005](CRITICAL-005-karma-2x-inflation.md) — Karma increment path duplicated
- [HIGH-011](HIGH-011-loyalty-tier-typo-diamond.md) — Tier normalization copied differently
- [HIGH-015](HIGH-015-schema-mixed-types-40-models.md) — Mixed fields used instead of types

### Phase Score: 30/100

---

## Phase 15: Source of Truth Identification

**Scope:** Which system owns which entity, read-after-write consistency, eventual consistency

### Findings
- [CRITICAL-008](CRITICAL-008-dual-authority.md) — NO clear ownership for ANY entity
- [CRITICAL-001](CRITICAL-001-settlement-blind-spot.md) — merchant vs merchantId (same entity)
- [CRITICAL-003](CRITICAL-003-merchant-withdrawal-race-condition.md) — Wallet owned by 2 systems
- [CRITICAL-005](CRITICAL-005-karma-2x-inflation.md) — karma_profiles owned by 2 systems
- [CRITICAL-015](CRITICAL-015-silent-coin-failure.md) — Finance service fakes wallet write
- [INFO-005](LOW-001-008-summary.md) — No cutover mechanism exists

### Phase Score: 15/100 — **SECOND LOWEST PHASE**

---

## Phase Score Summary

| Phase | Title | Score | Critical | High | Medium | Low |
|-------|-------|-------|---------|------|--------|-----|
| 1 | Architecture Mapping | 45/100 | 2 | 1 | 1 | 2 |
| 2 | Data Model & Schema | 35/100 | 2 | 3 | 1 | 0 |
| 3 | Enum & Status Consistency | 40/100 | 2 | 2 | 1 | 0 |
| 4 | API Contract Validation | 42/100 | 1 | 3 | 2 | 0 |
| 5 | Payment Flow | 30/100 | 2 | 3 | 3 | 0 |
| 6 | Wallet & Coins Logic | 25/100 | 4 | 2 | 3 | 2 |
| 7 | Business Logic | 28/100 | 3 | 2 | 4 | 0 |
| 8 | State Machine | 22/100 | 3 | 3 | 3 | 0 |
| 9 | Real-time Systems | 35/100 | 0 | 1 | 2 | 0 |
| 10 | Offline & Sync | 32/100 | 1 | 2 | 3 | 0 |
| 11 | Error Handling | 38/100 | 2 | 1 | 2 | 3 |
| 12 | Security Validation | 18/100 | 6 | 3 | 1 | 2 |
| 13 | Performance & Scalability | 48/100 | 0 | 0 | 4 | 2 |
| 14 | Duplicate & Conflict | 30/100 | 4 | 2 | 0 | 0 |
| 15 | Source of Truth | 15/100 | 5 | 0 | 0 | 1 |

**Weakest phases:** 15 (Source of Truth), 12 (Security), 6 (Wallet), 8 (State Machine)
