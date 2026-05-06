# Cross-Service: Security Root Cause Analysis

**Date:** 2026-04-16
**Updated:** 2026-04-17 (Gen 16 vesper-app + cross-service JWT sweep)
**Severity:** 6 CRITICAL, 6 HIGH, 4 MEDIUM (was: 4 CRITICAL, 6 HIGH, 4 MEDIUM)

---

## Overview

Security issues share common root causes across all services: broken HMAC implementations, unauthenticated internal endpoints, and missing input validation. These patterns appear in multiple services independently, indicating a systemic issue rather than isolated bugs.

---

## CS-S1 — Internal Auth HMAC Key Derived from Env Var Name (CRITICAL)

**Files:** `rez-order-service/src/middleware/internalAuth.ts:40-46`
**Also affects:** `A10-C5`, `CODEBASE_ISSUES_AUDIT.md`

**Finding:**
```ts
const hmacKey = Buffer.from(
  process.env.INTERNAL_SERVICE_TOKEN || 'fallback', 'utf8'
);
```

HMAC key is literally the string `"INTERNAL_SERVICE_TOKEN"`, not the secret value.

**Services affected:** order-service (primary), payment-service (legacy fallback), wallet-service (legacy fallback)

**Impact:** All internal endpoints unauthenticated.

---

## CS-S2 — JWT Verify Without Algorithm Whitelist (CRITICAL)

**File:** `rez-api-gateway/src/shared/authMiddleware.ts:65`
**Also affects:** `A10-H9`, `CODEBASE_ISSUES_AUDIT.md`, `VS-C1`, `CS-S2-A`, `CS-S2-B`, `CS-S2-C`

**Finding:**
```ts
jwt.verify(token, secret) // no algorithms option
```

Accepts `alg: 'none'` tokens.

**Services affected:** gateway, all services using JWT

**Impact:** Token forgery via algorithm confusion.

**Known affected locations:**
| Service | File | Lines |
|---------|------|-------|
| API Gateway | `rez-api-gateway/src/shared/authMiddleware.ts` | 65 |
| Vesper App | `server/src/utils/jwt.ts` | 48, 59, 78 |
| Finance Service | `rez-finance-service/src/middleware/auth.ts` | 37 |
| Scheduler Service | `rez-scheduler-service/src/middleware/auth.ts` | 36 |

---

## CS-S3 — Redis Fail-Open Outside Production (CRITICAL)

**File:** `rez-order-service/src/httpServer.ts:202-224`
**Also affects:** `A10-M19`

**Finding:**
```ts
} catch {
  if (process.env.NODE_ENV === 'production') {
    res.status(503).json({ success: false });
    return;
  }
  logger.warn('Redis unavailable — failing open'); // revoked tokens remain valid
}
```

**Services affected:** order-service (blacklist), likely other services with Redis-backed auth

**Impact:** Revoked tokens work in staging.

---

## CS-S4 — SSE Order Stream No Ownership Check (CRITICAL)

**File:** `rez-order-service/src/httpServer.ts:473-533`
**Also affects:** `A10-C6`

**Finding:**
Any authenticated user can subscribe to any merchant's real-time order stream.

**Services affected:** order-service SSE endpoint

**Impact:** Full visibility into any merchant's orders.

---

## CS-S5 — Payment Route Re-Exposed to Authenticated Users (HIGH)

**File:** `rez-payment-service/src/routes/paymentRoutes.ts:189, 202, 225`
**Also affects:** `CODEBASE_ISSUES_AUDIT.md` SEC-CRIT-1

**Finding:**
`/api/razorpay/verify-payment` registered first as internal-only, then re-registered with `requireAuth`.

**Services affected:** payment-service

**Status:** FIXED

---

## CS-S6 — requireMerchant Accepts Cookie Without CSRF (HIGH)

**File:** `rez-api-gateway/src/shared/authMiddleware.ts:93-135`
**Also affects:** `A10-M2`

**Finding:**
Both `Authorization` header AND `merchant_access_token` cookie accepted without CSRF token.

**Services affected:** gateway

**Impact:** CSRF attacks possible on merchant endpoints.

---

## CS-S7 — Merchant Stats Route Shadowing (HIGH)

**File:** `rez-merchant-service/src/routes/orders.ts:62, 133`
**Also affects:** `CODEBASE_ISSUES_AUDIT.md`

**Finding:**
`GET /:id` registered before `GET /stats/summary` — `/stats/summary` matches `/:id` first.

**Services affected:** merchant-service

**Status:** FIXED

---

## CS-S8 — Capability-Level Scoping Not Implemented (HIGH)

**File:** All services using internal token
**Also affects:** `INTERNAL_AUTH_AUDIT.md`

**Finding:**
Scoped tokens identify *who* is calling, not *which operations* are allowed. A compromised token can access all endpoints.

**Services affected:** payment, wallet, order, finance, marketing

**Impact:** Blast radius unconstrained within a compromised service.

---

## CS-S9 — Finance Partner Webhooks Used Shared Internal Token (HIGH)

**File:** `rez-finance-service/src/routes/partnerRoutes.ts:31`
**Also affects:** `CODEBASE_ISSUES_AUDIT.md`

**Finding:**
Finance partner webhooks relied on shared internal token instead of partner-specific HMAC.

**Services affected:** finance-service

**Status:** FIXED (partner-specific HMAC now used)

---

## CS-S10 — Two-Variable Naming Mismatch in Internal Auth (MEDIUM)

**File:** Multiple files
**Also affects:** `CODEBASE_ISSUES_AUDIT.md` SEC-3

**Finding:**
`INTERNAL_SERVICE_TOKEN` (used in auth middleware) vs `INTERNAL_SERVICE_KEY` (used in broadcast/marketing) — two separate env vars with no validation.

**Services affected:** backend monolith, all services

**Impact:** Marketing/broadcast calls silently fail when `INTERNAL_SERVICE_KEY` is empty.

---

## CS-S11 — Custom HS256 Implementation with Timing Attack (MEDIUM)

**File:** `rez-order-service/src/httpServer.ts:149-163`
**Also affects:** `CODEBASE_ISSUES_AUDIT.md`

**Finding:**
Hand-rolled JWT verifier uses `!==` for signature comparison instead of `crypto.timingSafeEqual`.

**Services affected:** order-service

**Impact:** Timing attack leaks signature bytes.

---

## CS-S12 — Shared Package Contract Drifted from Build Surface (MEDIUM)

**File:** `rez-shared/package.json:11`
**Also affects:** `CODEBASE_ISSUES_AUDIT.md`

**Finding:**
`exports` field in package.json didn't match committed `dist/` tree.

**Services affected:** all consumers of `@karim4987498/shared`

**Status:** FIXED

---

## Merchant App Gen 10 Security Root Causes

## CS-S-M1 — IDOR on Order Detail — No Store Ownership Check (CRITICAL)

**File:** `rezmerchant/app/(dashboard)/orders/[id].tsx:117`
**Also affects:** `G-MA-C5`

**Finding:**
Order detail page fetches by `orderId` from URL params without verifying the order belongs to the authenticated merchant's `storeId`.

**Crosses:** merchant app → backend

**Impact:** Any authenticated merchant can view any other merchant's order details by enumerating order IDs.

---

## CS-S-M2 — Biometric Auth Bypass When Hardware Unavailable (CRITICAL)

**File:** `rezmerchant/utils/biometric.ts:52`
**Also affects:** `G-MA-C6`

**Finding:**
```typescript
if (!hasHardwareSupported) {
  return true; // Bypasses biometric entirely
}
```

When biometric hardware is unavailable (older device, simulator, VM), authentication silently succeeds without any fallback auth check.

**Crosses:** merchant app (local auth)

**Impact:** Devices without biometric hardware (or where hardware is reported unavailable) grant access unconditionally.

---

## Status Table

| ID | Title | Severity | Crosses | Status |
|----|-------|---------|---------|--------|
| CS-S1 | HMAC key from env var NAME not value | CRITICAL | internal auth | ACTIVE |
| CS-S2 | JWT verify without algorithm whitelist | CRITICAL | gateway | ACTIVE |
| CS-S3 | Redis fail-open outside production | CRITICAL | order-service | ACTIVE |
| CS-S4 | SSE stream no merchant ownership check | CRITICAL | order-service | ACTIVE |
| CS-S-M1 | IDOR on order detail — no ownership check | CRITICAL | merchant app | ACTIVE |
| CS-S-M2 | Biometric bypass when hardware unavailable | CRITICAL | merchant app | ACTIVE |
| CS-S5 | Payment route re-exposed to authenticated users | HIGH | payment-service | FIXED |
| CS-S6 | requireMerchant accepts cookie without CSRF | HIGH | gateway | ACTIVE |
| CS-S7 | Merchant stats route shadowing | HIGH | merchant-service | FIXED |
| CS-S8 | Capability-level scoping not implemented | HIGH | all services | ACTIVE |
| CS-S9 | Finance partner webhooks used shared token | HIGH | finance-service | FIXED |
| CS-S10 | Two-variable naming mismatch in auth | MEDIUM | backend | ACTIVE |
| CS-S11 | Custom HS256 with timing attack | MEDIUM | order-service | ACTIVE |
| CS-S12 | Shared package contract drift | MEDIUM | shared | FIXED |
