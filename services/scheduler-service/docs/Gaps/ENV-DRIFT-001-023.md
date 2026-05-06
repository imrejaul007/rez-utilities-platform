# ENV-DRIFT-001-023: Environment Variable & Config Drift Across 13 Services

**23 distinct drift/mismatch issues across all services**
**Scope:** All backend services + rez-shared
**Audit Source:** Env Var Config Drift Sweep Agent
**Status:** ACTIVE

---

## CRITICAL (2)

### ENV-001: `QR_SECRET` Hardcoded Fallback in Merchant Service

**File:** `src/utils/qrGenerator.ts:12`

```typescript
qrSecret: process.env.QR_SECRET || 'karma-qr-secret',  // insecure fallback
```

`rez-merchant-service` defaults to `'karma-qr-secret'`. `rez-karma-service` has no default — fails if missing. Any developer who forgets to set the env var gets a predictable, forgeable QR secret.

**Impact:** Forgeable QR codes — attackers can generate valid check-in/check-out QR codes.

---

### ENV-002: `JWT_SECRET` Placeholder Checks Allow Known-Bad Values in Backend

**File:** `src/config/validateEnv.ts:100-118`

```typescript
if (process.env.JWT_SECRET === 'your-fallback-secret') {
  logger.warn('[ENV] JWT_SECRET is still the placeholder value');
  // Only warns — does NOT prevent startup
}
```

Backend-master accepts placeholder strings like `'your-fallback-secret'`, `'your-super-secret-jwt-key-here'`, `'your-merchant-secret-here-change-in-production'`. Service starts with these in production.

**Impact:** Service starts with known-insecure JWT secrets. Any token signed with the placeholder secret is trivially forgeable.

---

## HIGH (6)

### ENV-003: `WALLET_SERVICE_URL` Wrong Port Defaults in Scheduler

**File:** `src/config/index.ts:145`

```typescript
WALLET_SERVICE_URL: process.env.WALLET_SERVICE_URL || 'http://rez-wallet-service:3009'
// ← WRONG: wallet-service runs on port 4004, not 3009
```

`rez-karma-service` defaults to port `4004` (correct). `rez-scheduler-service` defaults to port `3009` (incorrect — that's karma-service's port).

**Impact:** Scheduler service always fails to connect to wallet service until env var is set.

---

### ENV-004: `CORS_ALLOWED_ORIGINS` vs `CORS_ORIGIN` Naming Split

| Service | Env Var | Default |
|---------|---------|---------|
| All services | `CORS_ORIGIN` | `'https://rez.money'` |
| `rez-merchant-service` | `CORS_ALLOWED_ORIGINS` (different name!) | same |

**Impact:** If `CORS_ORIGIN` is set for all services but `rez-merchant-service` reads `CORS_ALLOWED_ORIGINS`, the merchant service gets its default (`https://rez.money`) instead of the configured value.

---

### ENV-005: `REZ_WALLET_SERVICE_URL` vs `WALLET_SERVICE_URL` in Gamification

**File:** `src/httpServer.ts:42-43`

```typescript
const WALLET_SERVICE_URL =
  process.env.WALLET_SERVICE_URL || process.env.REZ_WALLET_SERVICE_URL || 'http://rez-wallet-service:3002';
```

Gamification service uses both env var names for the same setting. Other services only set `WALLET_SERVICE_URL`.

**Impact:** If only `REZ_WALLET_SERVICE_URL` is set in deployment, gamification reads it. If only `WALLET_SERVICE_URL` is set, it also works. But documentation may reference one name and operators set the other.

---

### ENV-006: `COIN_TO_RUPEE_RATE` vs `REZ_COIN_TO_RUPEE_RATE` Split

**File:** `src/services/walletService.ts:116-117`

```typescript
const rate = parseFloat(process.env.COIN_TO_RUPEE_RATE || process.env.REZ_COIN_TO_RUPEE_RATE || '1');
```

Wallet service checks both names. Other services only use `REZ_COIN_TO_RUPEE_RATE`.

**Impact:** If `COIN_TO_RUPEE_RATE` is set differently from `REZ_COIN_TO_RUPEE_RATE`, behavior depends on which was set last.

---

### ENV-007: `INTERNAL_HMAC_KEY` — Third Auth Token Name

Most services use `INTERNAL_SERVICE_TOKEN` or `INTERNAL_SERVICE_TOKENS_JSON`. `rez-gamification-service` introduces `INTERNAL_HMAC_KEY` as a third option at `src/middleware/internalAuth.ts:9`.

**Impact:** Non-standard auth token name. If deployment sets `INTERNAL_SERVICE_TOKEN` but gamification reads `INTERNAL_HMAC_KEY`, internal calls fail.

---

### ENV-008: `FRONTEND_URL` vs `APP_URL` for Same Purpose

| Service | Env Var | Default | File |
|---------|---------|---------|------|
| `rez-auth-service` | `APP_URL` | `'https://rez.money'` | `emailService.ts:17` |
| `rez-backend-master` | `FRONTEND_URL` | `'https://rez.app'` | `shareService.ts:128` |
| `rez-backend-master` | `FRONTEND_URL` | `'https://app.rez.com'` | `referralController.ts:44` |

Two different env var names AND three different domain defaults.

**Impact:** Email links in auth service point to `rez.money`; referral links point to `rez.app` or `app.rez.com`.

---

## MEDIUM (8)

### ENV-009: `rez-notification-events` Has No CORS Configuration

No `cors()` middleware found in `rez-notification-events/src/`. All other services set `CORS_ORIGIN`.

**Impact:** Browser clients cannot make direct API calls to notification-events from allowed origins.

---

### ENV-010: `APP_URL` vs `FRONTEND_URL` — Same Pattern as ENV-008

Same as above — two env var names for the same purpose.

---

### ENV-011: `MONGO_URI` Legacy Support Creates Dual-Path

`rez-wallet-service` supports both `MONGODB_URI` and `MONGO_URI` at `src/scripts/migrate-nuqta-to-rez.ts:9`. Backend seeds also support `MONGO_URI`.

**Impact:** Maintenance burden. Two env var names for the same database connection.

---

### ENV-012: `HEALTH_PORT` Inconsistent Defaults

| Service | Default | File |
|---------|---------|------|
| `rez-payment-service` | `4101` | `index.ts:103` |
| `rez-finance-service` | `4105` | `index.ts:140` |
| `rez-auth-service` | `4102` | `index.ts:107` |
| `rez-scheduler-service` | `3112` | `index.ts:85` |
| `rez-notification-events` | `HEALTH_PORT \|\| PORT \|\| '3001'` | `index.ts:45` |
| `rez-order-service` | `0` (disabled!) | `index.ts:41` |

`rez-order-service` defaults `HEALTH_PORT` to `0` — health checks are disabled.

**Impact:** Kubernetes liveness/readiness probes fail on order-service.

---

### ENV-013: `rez-karma-service` Has Two MongoDB Configs With Different Defaults

| Config | Default DB | File |
|--------|-----------|------|
| `src/config/index.ts:8` | `rez_karma` | Default |
| `src/config/mongodb.ts:5` | no default | Fails if missing |

**Impact:** Two different database configs in the same service. One defaults to `rez_karma`, the other fails startup.

---

### ENV-014: `rez-backend-master` Encryption Key Has Test Fallback

**File:** `src/__tests__/setup.ts:14`

```typescript
ENCRYPTION_KEY: 'a1b2c3d4e5f6...',  // Test fallback
```

Test key in test setup — not a production risk, but noted.

---

### ENV-015: Three Different Redis Connection Patterns

| Pattern | Services | Config Style |
|---------|---------|-------------|
| Sentinel-based | auth, payment, karma, wallet | `REDIS_SENTINEL_HOSTS`, `REDIS_SENTINEL_NAME` |
| Host/port object | backend-master | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| URL-based + mix | scheduler | `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT` |

**Impact:** No standard Redis connection config. Operators must know the pattern for each service.

---

### ENV-016: `rez-order-service` `HEALTH_PORT` Disabled by Default

See ENV-012 above. Health checks disabled by default.

---

## LOW (7)

### ENV-017: PORT Defaults Scattered Across 3001-4006 Range

| Service | Default PORT |
|---------|-------------|
| rez-auth-service | `4002` |
| rez-payment-service | `4001` |
| rez-wallet-service | `4004` |
| rez-finance-service | `4006` |
| rez-merchant-service | `4005` |
| rez-scheduler-service | `3012` |
| rez-karma-service | `3009` |
| rez-gamification-service | `3004` |
| rez-catalog-service | `3005` |
| rez-order-service | `3006` |
| rez-notification-events | `3001` |
| rez-backend-master | `5000` |

No documented standard. `rez-notification-events` defaults to `3001` which is the same port range as the 3000-series services.

---

### ENV-017: `INTERNAL_BRIDGE_TOKEN` — Unique Name in Merchant Service

`rez-merchant-service` at `src/routes/shiftGapBridge.ts:20` uses `INTERNAL_BRIDGE_TOKEN`. Not used elsewhere.

---

### ENV-018: `ENCRYPTION_KEY` vs `MERCHANT_WALLET_ENCRYPTION_KEY` — Two Names

| Service | Env Var | File |
|---------|---------|------|
| `rez-merchant-service` | `ENCRYPTION_KEY` | `index.ts:71` |
| `rez-wallet-service` | `MERCHANT_WALLET_ENCRYPTION_KEY` | `models/MerchantWallet.ts:50` |

Different names for the same logical setting.

---

### ENV-019: `OTP_HMAC_SECRET` Only in Auth Service

`rez-auth-service` requires `OTP_HMAC_SECRET`. `rez-backend-master` uses Twilio/MSG91 only — no OTP secret.

**Impact:** Different OTP implementations across services.

---

### ENV-020: `REZ_INTERNAL_KEY` — Unique Name for AdBazaar Auth

`rez-backend-master` at `routes/adBazaarIntegration.ts:219` uses `REZ_INTERNAL_KEY` as fallback for AdBazaar auth.

---

### ENV-021: `razorpayService` Currency Hardcoded

`src/services/razorpayService.ts:39` hardcodes `currency: 'INR'` instead of reading `process.env.RA RazorpayCurrency`.

---

### ENV-022: Log Level — All Services Consistent

`process.env.LOG_LEVEL || 'info'` used consistently across all 13 services. **No drift.**

---

### ENV-023: Sentry — All Services Consistent

`process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'` and `if (process.env.SENTRY_DSN)` used consistently. **No drift.**

---

## Summary

| ID | Severity | Issue | File |
|----|----------|-------|------|
| ENV-001 | CRITICAL | QR_SECRET hardcoded fallback `'karma-qr-secret'` | `merchant/qrGenerator.ts:12` |
| ENV-002 | CRITICAL | JWT_SECRET placeholder checks allow known-bad values | `validateEnv.ts:100-118` |
| ENV-003 | HIGH | WALLET_SERVICE_URL wrong port 3009 (should be 4004) | `scheduler/config/index.ts:145` |
| ENV-004 | HIGH | CORS_ALLOWED_ORIGINS vs CORS_ORIGIN naming split | `merchant/index.ts:87` |
| ENV-005 | HIGH | REZ_WALLET_SERVICE_URL vs WALLET_SERVICE_URL split | `gamification/httpServer.ts:42` |
| ENV-006 | HIGH | COIN_TO_RUPEE_RATE vs REZ_COIN_TO_RUPEE_RATE split | `wallet/walletService.ts:116` |
| ENV-007 | HIGH | INTERNAL_HMAC_KEY — third auth token name | `gamification/internalAuth.ts:9` |
| ENV-008 | HIGH | FRONTEND_URL vs APP_URL for same purpose | Multiple files |
| ENV-009 | MEDIUM | notification-events has no CORS config | `notif-events/src/` |
| ENV-010 | MEDIUM | APP_URL vs FRONTEND_URL (same as ENV-008) | Multiple files |
| ENV-011 | MEDIUM | MONGO_URI legacy support dual-path | `wallet/migrate-nuqta.ts:9` |
| ENV-012 | MEDIUM | HEALTH_PORT disabled (0) on order-service | `order-service/index.ts:41` |
| ENV-013 | MEDIUM | karma-service has two MongoDB configs | `config/index.ts:8` vs `mongodb.ts:5` |
| ENV-014 | LOW | Encryption key test fallback in test setup | `backend/__tests__/setup.ts:14` |
| ENV-015 | LOW | Three Redis connection patterns | Various |
| ENV-016 | LOW | PORT defaults scattered 3001-4006 range | Various |
| ENV-017 | LOW | INTERNAL_BRIDGE_TOKEN unique name | `merchant/shiftGapBridge.ts:20` |
| ENV-018 | LOW | ENCRYPTION_KEY vs MERCHANT_WALLET_ENCRYPTION_KEY | Various |
| ENV-019 | LOW | OTP_HMAC_SECRET only in auth service | `auth-service/` |
| ENV-020 | LOW | REZ_INTERNAL_KEY unique name | `backend/adBazaarIntegration.ts:219` |
| ENV-021 | LOW | Razorpay currency hardcoded | `payment/razorpayService.ts:39` |
| ENV-022 | — | LOG_LEVEL consistent across all services | ✓ |
| ENV-023 | — | SENTRY_DSN consistent across all services | ✓ |
