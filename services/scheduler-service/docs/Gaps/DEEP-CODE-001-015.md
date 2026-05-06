# DEEP-CODE-001-015: Deep Backend Code Sweep Findings

**15 findings from deep code sweep across services**
**Services:** rez-finance-service, rez-notification-events, rez-karma-service, rez-merchant-service
**Audit Source:** Deep Backend Code Sweep Agent

---

## CRITICAL (3)

### DEEP-CODE-001: `applyForLoan()` — No ObjectId Validation on User-Supplied Input

**File:** `src/services/loanService.ts:9-27`

```typescript
export async function applyForLoan(userId: string, amount: number) {
  // userId is user-supplied, never validated as ObjectId
  const user = await UserModel.findById(userId);  // CastError on malformed input
}
```

`userId` from request is used directly in `findById()` without `ObjectId.isValid()` check. Malformed input throws MongoDB CastError.

---

### DEEP-CODE-002: Service Reports Ready Before Dependencies Connected

**File:** `src/index.ts:34-37`

```typescript
// In startup sequence:
app.listen(PORT, () => {
  setHealthy(true);
  setReady(true);  // ← Called BEFORE connectMongoDB()
  connectMongoDB(); // ← Connected AFTER ready signal
});
```

Health/readiness probes report healthy before MongoDB and Redis are connected. Kubernetes routes traffic to unhealthy pod.

---

### DEEP-CODE-003: Misleading Comment — BNPL Logic

**File:** `src/services/bnplService.ts:72-80`

Comment says "AND not OR" but code uses `||`. Logic is technically correct for the error-throwing pattern but the comment is actively misleading — next developer may "fix" the comment.

---

## HIGH (5)

### DEEP-CODE-004: Rate Limiting Bypassed on Redis Status Anomaly

**File:** `src/middleware/rateLimiter.ts`

Rate limiting is silently bypassed when Redis status is neither `'ready'` nor `'connect'`. Any unexpected Redis state disables rate limiting for all requests.

---

### DEEP-CODE-005: Finance Service Auth Uses Consumer JWT Secret

Finance service auth uses `JWT_SECRET` (consumer secret) instead of role-scoped secrets. Admin tokens fail verification — admin users can't use BNPL/finance features.

---

### DEEP-CODE-006: Payment Webhook Path Mounting — Trailing Slash Issue

**File:** `src/routes/paymentRoutes.ts`

Path mounting could miss URLs with trailing slashes. `/payment-webhook/` ≠ `/payment-webhook`.

---

### DEEP-CODE-007: Coupon Existence Check — Timing-Based Enumeration

**File:** `src/services/couponService.ts`

Coupon existence check response timing may reveal whether a coupon code exists, enabling coupon code enumeration attacks.

---

### DEEP-CODE-008: `EXPOSE_DEV_OTP` Only Warns in Production

**File:** `src/config/auth.ts`

`EXPOSE_DEV_OTP=true` in production only logs a warning instead of exiting. OTP codes are exposed in production logs.

---

## MEDIUM (7)

### DEEP-CODE-009: Finance Service BNPL — No ObjectId Validation

Same as DEEP-CODE-001 — `applyForLoan` lacks ObjectId validation.

---

### DEEP-CODE-010: OTP in Production Logs

OTP codes logged in production (even at WARN level) — PII exposure.

---

### DEEP-CODE-011: Merchant Auth — Inconsistent Token Validation

Token validation patterns differ across merchant service routes — some use middleware, some inline checks.

---

### DEEP-CODE-012: Redis Status Check in Rate Limiter

Rate limiter may not handle all Redis status values correctly.

---

### DEEP-CODE-013: Coupon Code Timing Leak

Coupon existence check timing may leak information.

---

### DEEP-CODE-014: Payment Route Trailing Slash

Payment webhook path mounting ignores trailing slashes.

---

### DEEP-CODE-015: Health Check Before Dependencies

Health endpoint reports ready before dependencies connected.

---

## Status Table

| ID | Severity | Status | Est Fix |
|----|----------|--------|---------|
| DEEP-CODE-001 | CRITICAL | ACTIVE | 30m |
| DEEP-CODE-002 | CRITICAL | ACTIVE | 30m |
| DEEP-CODE-003 | CRITICAL | ACTIVE | 15m |
| DEEP-CODE-004 | HIGH | ACTIVE | 1h |
| DEEP-CODE-005 | HIGH | ACTIVE | 1h |
| DEEP-CODE-006 | HIGH | ACTIVE | 30m |
| DEEP-CODE-007 | HIGH | ACTIVE | 1h |
| DEEP-CODE-008 | HIGH | ACTIVE | 30m |
| DEEP-CODE-009 | MEDIUM | ACTIVE | 30m |
| DEEP-CODE-010 | MEDIUM | ACTIVE | 30m |
| DEEP-CODE-011 | MEDIUM | ACTIVE | 1h |
| DEEP-CODE-012 | MEDIUM | ACTIVE | 1h |
| DEEP-CODE-013 | MEDIUM | ACTIVE | 1h |
| DEEP-CODE-014 | MEDIUM | ACTIVE | 30m |
| DEEP-CODE-015 | MEDIUM | ACTIVE | 30m |
