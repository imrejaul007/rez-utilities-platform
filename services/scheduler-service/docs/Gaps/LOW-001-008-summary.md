# LOW & INFORMATIONAL Issues

## Severity: LOW (001-008) and INFORMATIONAL (001-005)

---

## LOW-001: No Compression on Internal Service Responses

**File:** `rez-api-gateway/nginx.conf`

Internal service responses are not gzip-compressed. Large payloads (order lists, search results) transfer slowly.

**Fix:** Add `gzip on;` for internal upstream responses.

---

## LOW-002: No Request ID Propagation

Internal service calls don't propagate `X-Request-ID` headers. Distributed tracing is incomplete.

**Fix:** Generate UUID on gateway, propagate through all internal calls.

---

## LOW-003: Backend Cron Jobs Don't Log Execution Time

**File:** `rezbackend/.../src/jobs/cronJobs.ts`

Settlement and cleanup cron jobs don't log their start/end time or duration. Performance regression goes undetected.

**Fix:** Add structured logging: `{ job: 'settlement', duration: 4523, orders: 234 }`.

---

## LOW-004: No Pagination on Admin List Endpoints

**File:** `rez-backend/.../src/routes/admin.ts`

Admin endpoints for listing users, merchants, orders don't use pagination. Large datasets cause timeout.

**Fix:** Add cursor-based pagination with `limit` and `after` parameters.

---

## LOW-005: Coin Expiry Not Enforced in Transaction Queries

**File:** `rez-wallet-service/src/services/walletService.ts`

`getCoinBreakdown()` doesn't account for expired coins when reporting balances. Users may see coins that are functionally unusable.

**Fix:** Filter expired coins: `{ $match: { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] } }`.

---

## LOW-006: No Structured Logging Format

**File:** Multiple services

Most services use `console.log` or string-based logging instead of structured JSON logging. Log aggregation and querying is difficult.

**Fix:** Use `pino` or `@rez/shared/telemetry` for all services.

---

## LOW-007: Settlement Report Not Emailed to Merchants

**File:** `rez-merchant-service/src/services/settlementService.ts`

Settlement reports are calculated but not sent to merchants via email. Manual merchant portal check required.

**Fix:** Add email dispatch via notification service after settlement calculation.

---

## LOW-008: Referral Code No Expiry Validation

**File:** `rez-backend/.../src/services/referralService.ts`

Referral codes have no expiry validation. Old referral codes can still be used, creating historical bonus payouts.

**Fix:** Add `expiresAt` field and validate before crediting referral bonus.

---

## INFORMATIONAL-001: Three Different Auth Patterns in Use

- Backend monolith: `requireAuth` + `JWT_SECRET`
- Services: `requireInternalToken` + HMAC
- Merchant app: `requireMerchantAuth` + `JWT_MERCHANT_SECRET`

No unified auth abstraction across services.

---

## INFORMATIONAL-002: No Changelog or Migration Guide for Service Extractions

When services were extracted, no changelog documented what changed in the monolith's behavior. Consumers have no reference for what differs between monolith and service.

---

## INFORMATIONAL-003: No Chaos Engineering or Load Testing

No automated tests verify system behavior under failure conditions (Redis down, MongoDB slow, service timeout). Unknown resilience gaps.

---

## INFORMATIONAL-004: Analytics Events Not Schema-Validated

Analytics service receives events with `Schema.Types.Mixed` payloads. Invalid events create silent data quality issues in analytics.

---

## INFORMATIONAL-005: No Feature Flags for Shadow Mode

Shadow mode (monolith + services both running) has no feature flag mechanism. There is no documented process for when to disable shadow mode and fully cut over to services.

---

## All Low & Informational Issues

| ID | Title | Category |
|----|-------|----------|
| LOW-001 | No response compression | Performance |
| LOW-002 | No request ID propagation | Observability |
| LOW-003 | Cron jobs no duration logging | Observability |
| LOW-004 | No pagination on admin lists | Performance |
| LOW-005 | Coin expiry not enforced | Business Logic |
| LOW-006 | No structured logging | Observability |
| LOW-007 | Settlement report not emailed | UX |
| LOW-008 | Referral code no expiry | Business Logic |
| INFO-001 | Three auth patterns | Architecture |
| INFO-002 | No extraction changelog | Documentation |
| INFO-003 | No chaos testing | Operations |
| INFO-004 | Analytics events unvalidated | Data Quality |
| INFO-005 | No shadow mode feature flag | Operations |
