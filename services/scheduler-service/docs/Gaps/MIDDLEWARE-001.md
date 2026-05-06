# MIDDLEWARE-001: CORS, Rate-Limiting & Auth Middleware Inconsistencies

**Middleware configuration drift across 13 services**
**Services:** All services
**Audit Source:** CORS/Rate-Limit Sweep Agent

---

## HIGH (5)

### MID-001: `credentials: true` Missing on Payment Service CORS

**File:** `rez-payment-service/src/index.ts`

```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  // MISSING: credentials: true
}));
```

All other services that set a specific `origin` also set `credentials: true` to allow cookies/auth headers on cross-origin requests. Payment service omits it.

**Impact:** Payment service API calls from the frontend fail with credential errors. OAuth callbacks, session cookies, and auth tokens are silently dropped on payment API calls.

---

### MID-002: `payment-service` and `wallet-service` — No Rate Limiting

| Service | Rate Limiting |
|---------|-------------|
| rez-auth-service | Yes (express-rate-limit) |
| rez-backend | Yes (custom Redis middleware) |
| rez-merchant-service | Partial (OTP endpoints missing) |
| rez-payment-service | **NO RATE LIMITING** |
| rez-wallet-service | **NO RATE LIMITING** |
| rez-karma-service | Yes (but bypassed on Redis anomaly) |
| rez-finance-service | Partial |

Payment service has no rate limiting on any endpoint. Wallet service has no rate limiting on any endpoint.

**Impact:** Payment and wallet endpoints are vulnerable to brute-force attacks, enumeration attacks, and DoS. An attacker can probe card patterns or rapidly debit wallets.

---

### MID-003: Request Body Size Limit — Inconsistent Across Services

| Service | Body Limit |
|---------|-----------|
| rez-payment-service | 1MB (`body-parser` default) |
| rez-backend | 100KB |
| rez-merchant-service | 256KB |
| rez-karma-service | 100KB |
| rez-notification-events | 1MB |

Large file uploads or bulk operations on backend fail at 100KB. Payment service accepts 1MB bodies, merchant accepts 256KB.

**Impact:** Bulk import operations fail silently on some services. Webhook payloads exceeding 100KB are rejected by backend.

---

### MID-004: Karma Service Rate Limiting Bypassed on Redis Anomaly

**File:** `src/middleware/rateLimiter.ts`

Rate limiting is silently bypassed when Redis status is neither `'ready'` nor `'connect'`. Any unexpected Redis state disables rate limiting for all requests.

Under Redis failover conditions, karma service has no rate limiting.

**Impact:** Redis degradation → complete rate limiting failure across all karma endpoints.

---

### MID-005: Auth Middleware — Token Validation Pattern Not Standardized

| Service | Auth Pattern |
|---------|------------|
| rez-auth-service | JWT + middleware chain |
| rez-backend | JWT + admin role check |
| rez-merchant-service | JWT_MERCHANT_SECRET (falls back to JWT_SECRET) |
| rez-gamification | INTERNAL_HMAC_KEY |
| rez-karma | requireAuth middleware |
| rez-finance | JWT_SECRET (consumer secret, not role-scoped) |

Three different secrets for the same auth mechanism. Finance service uses consumer JWT secret for admin operations (DEEP-CODE-005).

**Impact:** Role-based access is inconsistently enforced. A consumer JWT can be used as a merchant token (merchant service fallback). Finance service admin operations use consumer-level secrets.

---

## MEDIUM (4)

### MID-006: `express.json()` — Different Limits Per Service

```typescript
// Some services
app.use(express.json({ limit: '100kb' }));

// Others
app.use(express.json());  // defaults to 100kb but varies by express version

// Others
app.use(express.json({ limit: '1mb' }));
```

Express version differences may cause inconsistent default limits. Explicit limits are set inconsistently.

---

### MID-007: helmet.js — Usage Inconsistent

| Service | helmet.js |
|---------|----------|
| rez-auth-service | Yes (full helmet config) |
| rez-backend | Yes (partial) |
| rez-merchant-service | Partial |
| rez-payment-service | No |
| rez-wallet-service | No |
| rez-karma-service | No |

Payment service and wallet service do not use helmet.js. Missing security headers: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Strict-Transport-Security`, `Content-Security-Policy`.

**Impact:** Missing security headers on payment and wallet endpoints. XSS and clickjacking attacks not mitigated by browser defaults.

---

### MID-008: `sameSite: 'strict'` Cookie — Compatibility Issues

Some services use `sameSite: 'strict'`. This breaks legitimate cross-site navigation: OAuth redirects, payment gateway callbacks, deep links from email.

Affected flows:
- Payment gateway redirects back to `rez.money`
- Email deep links from notification service
- OAuth callbacks from Google/Facebook

---

### MID-009: `trust proxy` — Inconsistent Configuration

| Service | trust proxy |
|---------|------------|
| rez-backend | `true` or `1` |
| rez-auth-service | Not set |
| rez-merchant-service | Not set |
| rez-payment-service | Not set |
| rez-karma-service | Not set |

Behind a reverse proxy or load balancer, `req.ip` returns the proxy IP, not the client IP. Rate limiting and IP-based blocking operate on the wrong IP.

---

## Status Table

| ID | Severity | Issue | Est Fix |
|----|----------|-------|---------|
| MID-001 | HIGH | credentials:true missing on payment service CORS | 30m |
| MID-002 | HIGH | payment & wallet have no rate limiting | 2h |
| MID-003 | HIGH | Body size limit inconsistent (100kb-1mb) | 1h |
| MID-004 | HIGH | Karma rate limit bypassed on Redis anomaly | 1h |
| MID-005 | HIGH | Auth middleware not standardized (3 secrets) | 3h |
| MID-006 | MEDIUM | express.json() limit explicit vs implicit | 1h |
| MID-007 | MEDIUM | helmet.js missing on payment/wallet services | 1h |
| MID-008 | MEDIUM | sameSite:strict breaks OAuth/payment redirects | 1h |
| MID-009 | MEDIUM | trust proxy not set consistently | 30m |
