# Cross-Reference: All Audit Reports

## Reports Cross-Referenced

| Report | Date | Focus | Finding Count |
|--------|------|--------|---------------|
| DEEP VERIFICATION BUG FIX REPORT | 2026-04-16 | Enum gaps, FSM gaps, schema gaps | 4 architectural gaps |
| INTERNAL AUTH AUDIT | 2026-04-08 | Internal auth patterns | 1 gap (capability scoping) |
| CODEBASE ISSUES AUDIT | 2026-04-08 | Multi-service issues | 5 urgent, 17+ resolved |
| PHASE-11 BUG FIX REPORT | 2026-04-16 | Infrastructure + transaction | 16 PRs across 14 repos |
| LOGIC AUDIT FIXES VERIFIED | 2026-04-16 | 27+ repos fixed | 28 verified fixes |
| This Audit (FORENSIC-001) | 2026-04-16 | Full backend forensic | 17 Critical, 15 High, 20 Medium, 8 Low, 5 Info |

---

## Pre-Existing Findings from Other Reports

### DEEP VERIFICATION BUG FIX REPORT (2026-04-16)

| Gap | Resolution | Status in This Audit |
|-----|-----------|---------------------|
| Gap 1: Pricing canonical (`pricing.original` vs `pricing.mrp`) | Fixed — `rez-merchant-service` now uses `pricing.mrp` | Verified |
| Gap 2: IKarmaProfile canonical | Fixed — `karma.ts` entity created in `packages/shared-types` | Verified |
| Gap 3: ICreditProfile | Not a gap — BNPL domain-specific | Verified |
| Gap 4: Enum sources (3 competing enum definitions) | Fixed — `shared-types/src/enums/index.ts` canonical | Verified |

### INTERNAL AUTH AUDIT (2026-04-08)

| Finding | Resolution | Status in This Audit |
|---------|-----------|---------------------|
| Capability-level scoping not implemented | Open — services still use service-level identity | VERIFIED STILL OPEN |
| Audit logging standardized | Fixed | VERIFIED |
| Finance partner webhooks HMAC-SHA256 | Fixed | VERIFIED |
| Legacy shared-token fallback removed | Fixed | VERIFIED |
| Payment verify endpoint re-exposed | Fixed | VERIFIED |

### CODEBASE ISSUES AUDIT (2026-04-08)

| Issue | Resolution | Status in This Audit |
|-------|-----------|---------------------|
| Payment verify re-exposed | Fixed | VERIFIED |
| Merchant route shadowing (`/orders/stats/summary`) | Fixed | VERIFIED |
| Shared package contract drift | Fixed | VERIFIED |
| Client-supplied payment amounts | Fixed | VERIFIED |
| Order service startup not defensive | Fixed | VERIFIED |
| Math.random() for ID generation | Fixed (walletApi, sessionTracking) | VERIFIED |
| Coin expiry policy env-var consistency | Fixed | VERIFIED |

### PHASE-11 BUG FIX REPORT (2026-04-16)

| Fix | Repo | Status in This Audit |
|-----|------|---------------------|
| MongoDB pool options | rez-finance-service | VERIFIED |
| MongoDB pool options | rez-scheduler-service | VERIFIED |
| BullMQ `removeOnComplete`/`removeOnFail` | Multiple services | VERIFIED |
| `dailySpent` outside MongoDB transaction | rez-wallet-service | VERIFIED (BUT see CRITICAL-003) |
| Refund webhook amount verification | rez-payment-service | VERIFIED |
| Database indexes added | rez-payment-service, rez-catalog-service | VERIFIED |
| Order state transition guard | rez-order-service | PARTIAL — HIGH-004 still open |
| Env var validation at startup | rez-order-service | VERIFIED |

### LOGIC AUDIT FIXES VERIFIED (2026-04-16)

All 28 verified fixes from the logic audit sweep were confirmed pushed:
- Math.random() → uuid in walletApi.ts, sessionTrackingService.ts
- Coin expiry policy centralized
- Branded coin admin cap enforced
- Partial refund logic fixed
- Merchant loyalty config TOCTOU fixed
- Dual payout system coordination fixed
- Admin loyalty cap enforced
- Tier cycling demotion warning added
- Wallet adjustment threshold visibility fixed

---

## Still-Open Issues from Prior Audits

The following from prior audits remain unresolved in this forensic audit:

### From INTERNAL AUTH AUDIT

| Issue | Gap ID | Why Still Open |
|-------|--------|---------------|
| Capability-level scoping | NEW | Requires architectural redesign — not addressed |

### From This Audit (FORENSIC-001) vs PHASE-11

| Issue | PHASE-11 Status | FORENSIC-001 Finding |
|-------|-----------------|---------------------|
| Order state transition guard | PR #7 fixed | HIGH-004 (invalid nested object) still present |
| MongoDB transaction for dailySpent | Fixed (BUG 1) | CRITICAL-003 (merchant withdrawal TOCTOU) — different code path |
| Refund amount verification | Fixed | HIGH-001 (secret in body) still present |

### Unresolved Root Causes

These architectural issues were identified in prior audits but NOT resolved:

1. **Dual authority** (CRITICAL-008) — Multiple services still write to same collections
2. **Shadow mode cutover** (INFO-005) — No mechanism exists to end shadow mode
3. **Three payment FSMs** (CRITICAL-009) — Still three competing FSMs
4. **No monorepo** — Services still in separate repos, FSMs/enums forked
5. **Schema.Types.Mixed** in 40+ models (HIGH-015) — Still present

---

## Gap ID Cross-Reference Matrix

### Root Cause: Dual Authority (CRITICAL-008)

| Gap ID | Gap Title | Linked Gaps |
|--------|-----------|-------------|
| CRITICAL-001 | Settlement blind spot | CRITICAL-008, CRITICAL-009 |
| CRITICAL-003 | Merchant withdrawal TOCTOU | CRITICAL-008, CRITICAL-001 |
| CRITICAL-008 | Dual authority | ALL gaps — root cause |
| CRITICAL-009 | Three payment FSMs | CRITICAL-008, CRITICAL-013 |
| CRITICAL-013 | Order statuses out of sync | CRITICAL-008, CRITICAL-009 |
| HIGH-004 | Order invalid nested object | CRITICAL-008, CRITICAL-009 |
| HIGH-005 | Bulk order actions bypass FSM | CRITICAL-008, CRITICAL-009 |
| MEDIUM-004 | Missing processing→cancelled | CRITICAL-008, CRITICAL-009 |
| MEDIUM-005 | Refund retry inconsistency | CRITICAL-008, CRITICAL-009 |

### Root Cause: Copy-Based Extraction (CRITICAL-008)

| Gap ID | Gap Title | Root Cause |
|--------|-----------|------------|
| CRITICAL-001 | Settlement blind spot | Copy-based extraction |
| CRITICAL-009 | Three payment FSMs | Copy-based extraction |
| CRITICAL-013 | Order statuses out of sync | Copy-based extraction |
| CRITICAL-016 | Returned progress mismatch | Copy-based extraction |
| HIGH-005 | Bulk order actions bypass FSM | Copy-based extraction |

### Security Cluster

| Gap ID | Gap Title | Cluster |
|--------|-----------|---------|
| CRITICAL-002 | Catalog auth broken | Auth |
| CRITICAL-004 | Karma auth 404 | Auth |
| CRITICAL-006 | Admin cron consumer auth | Auth |
| CRITICAL-011 | Internal key unvalidated | Auth |
| CRITICAL-012 | Firebase JSON on disk | Secrets |
| CRITICAL-014 | Static files unauthenticated | Auth |
| HIGH-003 | Payment auth incompatible | Auth |
| HIGH-009 | Order SSE no auth | Auth |
| MEDIUM-010 | Admin JWT wrong secret | Auth |
| LOW-002 | No request ID propagation | Tracing |

### Finance & Coins Cluster

| Gap ID | Gap Title | Cluster |
|--------|-----------|---------|
| CRITICAL-005 | Karma 2x inflation | Karma |
| CRITICAL-010 | Coin rate divergence | Coins |
| CRITICAL-015 | Silent coin failure | Coins |
| CRITICAL-017 | Karma won't compile | Karma |
| HIGH-001 | Webhook secret in body | Payment |
| HIGH-002 | Non-atomic wallet credit | Coins |
| HIGH-006 | BNPL OR instead of AND | Finance |
| HIGH-010 | Coin type normalization | Coins |
| HIGH-011 | Loyalty tier typo | Coins |
| HIGH-012 | Hardcoded coin cap | Coins |
| MEDIUM-015 | Settlement ignores partial refunds | Finance |
| LOW-005 | Coin expiry not enforced | Coins |
| LOW-008 | Referral code no expiry | Coins |

### Data Integrity Cluster

| Gap ID | Gap Title | Cluster |
|--------|-----------|---------|
| CRITICAL-007 | FraudFlag model missing | Integrity |
| CRITICAL-013 | Order statuses out of sync | Integrity |
| CRITICAL-016 | Returned progress mismatch | Integrity |
| HIGH-004 | Order invalid nested object | Integrity |
| HIGH-008 | Order Zod schemas unused | Integrity |
| HIGH-010 | Coin type normalization | Integrity |
| HIGH-013 | authorized state no inbound | Integrity |
| HIGH-015 | 40+ Schema.Types.Mixed | Integrity |
| MEDIUM-017 | No version vector | Integrity |
| MEDIUM-018 | BNPL simple interest | Documentation |
| MEDIUM-020 | GST validation missing | Validation |

### Performance & Reliability Cluster

| Gap ID | Gap Title | Cluster |
|--------|-----------|---------|
| HIGH-007 | Search rate limiter fails open | Reliability |
| HIGH-014 | Search paths not routed | Performance |
| MEDIUM-001 | No upstream keepalive | Performance |
| MEDIUM-002 | No idempotency search history | Reliability |
| MEDIUM-007 | Settlement in-memory reduce | Performance |
| MEDIUM-008 | SSE no heartbeat | Reliability |
| MEDIUM-009 | Webhook no idempotency key | Reliability |
| MEDIUM-012 | Product search LIKE | Performance |
| MEDIUM-013 | No retry budget wallet queue | Reliability |
| MEDIUM-014 | No DLQ monitoring | Observability |
| MEDIUM-016 | No HTTP timeout | Resilience |
| MEDIUM-019 | No circuit breaker | Resilience |
| LOW-001 | No response compression | Performance |
| LOW-003 | Cron no duration logging | Observability |
| LOW-004 | No admin pagination | Performance |
| LOW-006 | No structured logging | Observability |

---

## Service → Gap Mapping

| Service | Gap IDs |
|---------|---------|
| `rez-backend` (monolith) | CRITICAL-001, CRITICAL-006, CRITICAL-007, CRITICAL-009, CRITICAL-013, CRITICAL-016, HIGH-003, HIGH-005, MEDIUM-003, MEDIUM-004, MEDIUM-005, MEDIUM-010, MEDIUM-017, LOW-003, LOW-004, LOW-008 |
| `rez-payment-service` | CRITICAL-009, CRITICAL-010, CRITICAL-011, HIGH-001, HIGH-002, HIGH-003, HIGH-013, MEDIUM-009, MEDIUM-016, MEDIUM-019 |
| `rez-wallet-service` | CRITICAL-003, CRITICAL-010, CRITICAL-011, MEDIUM-006, MEDIUM-013, LOW-005 |
| `rez-order-service` | CRITICAL-013, HIGH-004, HIGH-008, HIGH-009, MEDIUM-008, MEDIUM-017 |
| `rez-merchant-service` | CRITICAL-001, HIGH-005, MEDIUM-007, MEDIUM-015, LOW-007 |
| `rez-catalog-service` | CRITICAL-002, CRITICAL-011, HIGH-012, MEDIUM-012 |
| `rez-search-service` | HIGH-007, HIGH-014, MEDIUM-002 |
| `rez-karma-service` | CRITICAL-004, CRITICAL-005, CRITICAL-017, HIGH-001 |
| `rez-finance-service` | CRITICAL-006, CRITICAL-015, HIGH-006, MEDIUM-018 |
| `rez-notification-events` | MEDIUM-011, MEDIUM-014 |
| `rez-auth-service` | CRITICAL-004, MEDIUM-010 |
| `rez-media-events` | CRITICAL-014 |
| `rez-api-gateway` | MEDIUM-001, LOW-001, LOW-002 |

---

## Pre-Existing Findings from Other Reports

### DEEP VERIFICATION BUG FIX REPORT (2026-04-16)

| Gap | Status in This Audit |
|-----|---------------------|
| Gap 1: Pricing canonical | Resolved — `IKaraokePricing` in shared-types |
| Gap 2: IKarmaProfile canonical | Resolved — `karma.ts` entity created |
| Gap 3: ICreditProfile | Not a gap — BNPL domain-specific |
| Gap 4: Enum sources | Resolved — consumers are domain-specific |

### ROUND5 SYSTEM HARDENING REPORT

| Finding | Status in This Audit |
|---------|---------------------|
| Lazy Redis config | Verified — consistent |
| Env validation | Verified — `CRITICAL-011` (inverted — unvalidated) |
| Security audit findings | Verified — many still open |

---

## Unresolved from Previous Audits

The following from prior audits are NOT yet resolved:

1. **FraudFlag model** — Still missing (CRITICAL-007)
2. **Payment FSM divergence** — Still unfixed (CRITICAL-009)
3. **Order status sync** — Still diverged (CRITICAL-013)
4. **Coin rate divergence** — Still diverged (CRITICAL-010)
5. **Shadow mode cutover** — No mechanism in place (INFO-005)
