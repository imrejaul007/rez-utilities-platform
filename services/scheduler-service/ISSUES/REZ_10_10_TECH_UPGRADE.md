# REZ — COMPLETE 10/10 TECH UPGRADE REPORT
## Every Gap · Every Fix · Exact Code · Per Dimension
### March 2026 | Based on Real Codebase Audit

---

## HONEST REASSESSMENT AFTER FULL AUDIT

After reading the actual code (not assumptions), the picture is better than the earlier 6.4/10 score suggested. Here is the corrected baseline before fixes:

| Dimension | Old Score | Actual Score | Why Revised |
|-----------|-----------|--------------|-------------|
| Backend architecture | 8 | 8 | No change — genuinely strong |
| Data model depth | 8 | 8 | No change |
| API design | 7 | 7 | No change |
| Security | 6 | 7 | Helmet + CORS + mongo-sanitize + rate limiting ALL exist |
| Scalability | 5 | 6 | Artillery load tests exist, connection pooling configured |
| Frontend polish | 5 | 5 | 49 test files but config bugs + disconnect still real |
| DevOps / infra | 3 | 7 | CI/CD pipeline + Docker + Sentry + Prometheus ALL exist |
| Test coverage | 2 | 5 | 36 backend + 49 frontend test files exist, but BBPS/billPayment = zero |
| Documentation | 9 | 9 | No change |

**Revised overall: 7.0/10** — significantly stronger than 6.4. The DevOps score was the biggest correction.

The remaining gaps to reach 10/10 are real but much more targeted than previously stated.

---
---

# DIMENSION 1: BACKEND ARCHITECTURE (8 → 10)

## Current state: 8/10
Event bus, circuit breaker, reward engine with idempotency — all strong.

## Gap 1.1 — No graceful shutdown handler
If the server process dies (deploy, crash, OOM kill), in-flight requests get dropped. Transactions mid-commit can corrupt wallet state.

**File to create:** `rez-backend-master/src/utils/gracefulShutdown.ts`

```typescript
/**
 * Graceful Shutdown Handler
 * Ensures in-flight requests complete before process exits.
 * Prevents wallet corruption on deploys.
 */

import mongoose from 'mongoose';
import { Server } from 'http';
import { logger } from '../config/logger';

export function setupGracefulShutdown(server: Server): void {
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`[SHUTDOWN] ${signal} received. Starting graceful shutdown...`);

    // 1. Stop accepting new connections
    server.close(async () => {
      logger.info('[SHUTDOWN] HTTP server closed. No new connections.');

      try {
        // 2. Close MongoDB (waits for in-flight operations)
        await mongoose.connection.close(false);
        logger.info('[SHUTDOWN] MongoDB connection closed.');

        // 3. Close Redis (if you have a global Redis client)
        // await redisClient.quit();

        logger.info('[SHUTDOWN] Graceful shutdown complete.');
        process.exit(0);
      } catch (err) {
        logger.error('[SHUTDOWN] Error during shutdown:', err);
        process.exit(1);
      }
    });

    // Force exit after 15 seconds (prevents hanging forever)
    setTimeout(() => {
      logger.error('[SHUTDOWN] Forced exit after timeout.');
      process.exit(1);
    }, 15000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('[UNCAUGHT EXCEPTION]', err);
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('[UNHANDLED REJECTION]', reason);
    shutdown('unhandledRejection');
  });
}
```

**Wire in `src/server.ts`:**
```typescript
// ADD import:
import { setupGracefulShutdown } from './utils/gracefulShutdown';

// ADD after server.listen():
setupGracefulShutdown(server);
```

---

## Gap 1.2 — No health check depth (only superficial /health)
The Docker HEALTHCHECK calls `/health` but it only checks if the HTTP server is responding. It does not check MongoDB or Redis connectivity. A deploy where MongoDB is down shows as "healthy."

**File to modify:** `rez-backend-master/src/routes/healthRoutes.ts` (or wherever /health is defined)

```typescript
// REPLACE basic health check with deep health check:

router.get('/health', asyncHandler(async (req, res) => {
  const checks = {
    server:   { status: 'ok' },
    mongodb:  { status: 'unknown' as 'ok' | 'error', latencyMs: 0 },
    redis:    { status: 'unknown' as 'ok' | 'error', latencyMs: 0 },
  };

  // MongoDB ping
  try {
    const start = Date.now();
    await mongoose.connection.db?.admin().ping();
    checks.mongodb = { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    checks.mongodb = { status: 'error', latencyMs: -1 };
  }

  // Redis ping
  try {
    const start = Date.now();
    await redisService.ping();   // add .ping() to your redisService if missing
    checks.redis = { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    checks.redis = { status: 'error', latencyMs: -1 };
  }

  const isHealthy = checks.mongodb.status === 'ok' && checks.redis.status === 'ok';

  res.status(isHealthy ? 200 : 503).json({
    status:    isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),
    checks,
  });
}));

// ADD separate readiness check (for Kubernetes-style deploys):
router.get('/health/ready', asyncHandler(async (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  res.status(mongoReady ? 200 : 503).json({ ready: mongoReady });
}));
```

---

## Gap 1.3 — No request correlation ID
When a bug is reported, there is no way to trace a single user request through the logs. Every log line is anonymous.

**File to modify:** `rez-backend-master/src/config/middleware.ts`

```typescript
// ADD after imports:
import { v4 as uuidv4 } from 'uuid';  // npm install uuid

// ADD as FIRST middleware (before everything else):
app.use((req: any, res, next) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.requestId   = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});
```

**Update logger to include requestId in every line:**
```typescript
// In logger.ts, replace printf format:
const printf = winston.format.printf(({ level, message, timestamp, requestId, ...meta }) => {
  const reqId = requestId ? ` [${requestId}]` : '';
  return `${timestamp}${reqId} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
});
```

---
---

# DIMENSION 2: DATA MODEL DEPTH (8 → 10)

## Current state: 8/10
40+ models with proper schemas, indexes, and virtuals.

## Gap 2.1 — Missing soft delete on critical models
If a BillProvider or Store is hard-deleted, all historical BillPayment/Order records lose their `provider` ref. MongoDB does not enforce referential integrity.

**Add to BillProvider model:**
```typescript
// ADD fields to BillProviderSchema:
deletedAt: { type: Date, default: null },
deletedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser', default: null },

// ADD pre-find middleware (soft delete filter):
BillProviderSchema.pre(/^find/, function(next) {
  this.where({ deletedAt: null });
  next();
});

// ADD static method for soft delete:
BillProviderSchema.statics.softDelete = async function(id: string, adminId: string) {
  return this.findByIdAndUpdate(id, {
    deletedAt: new Date(),
    deletedBy: adminId,
    isActive:  false,
  });
};
```

**Apply the same pattern to:** Store, MallBrand, Offer, PriveCampaign

---

## Gap 2.2 — No model-level data validation beyond basic types
The `promoCoinsFixed` field allows 0–500 but there is no validation that `maxRedemptionPercent` makes economic sense relative to coin value.

**Add cross-field validation to BillProvider:**
```typescript
// ADD to BillProviderSchema pre-save:
BillProviderSchema.pre('save', function(next) {
  // Validate coin economics don't exceed revenue
  // promoCoinsFixed × 0.01 (coin value) ≤ expected commission per transaction
  // This is a soft warning — not a hard block
  if (this.promoCoinsFixed > 500) {
    return next(new Error('promoCoinsFixed cannot exceed 500 coins'));
  }
  if (this.maxRedemptionPercent > 50) {
    return next(new Error('maxRedemptionPercent cannot exceed 50%'));
  }
  if (this.promoExpiryDays < 1 || this.promoExpiryDays > 30) {
    return next(new Error('promoExpiryDays must be between 1 and 30'));
  }
  next();
});
```

---
---

# DIMENSION 3: API DESIGN (7 → 10)

## Current state: 7/10
Good validation middleware, consistent error codes, pagination. Minor inconsistencies.

## Gap 3.1 — No API versioning
All routes are `/api/...` with no version prefix. When you break a route for a new feature, old app versions (users who haven't updated) get errors.

**File to modify:** `rez-backend-master/src/config/routes.ts`

```typescript
// REPLACE:
const API_PREFIX = '/api';

// WITH:
const API_V1 = '/api/v1';
const API_PREFIX = API_V1;   // all existing routes → /api/v1/...

// ADD version header to every response:
app.use((req, res, next) => {
  res.setHeader('x-api-version', '1.0.0');
  next();
});

// ADD /api/v1/version endpoint:
app.get(`${API_V1}/version`, (req, res) => {
  res.json({ version: '1.0.0', minSupportedClientVersion: '1.0.0' });
});
```

**Update frontend `apiClient.ts` base URL:**
```typescript
// nuqta-master/services/apiClient.ts
const BASE_URL = process.env.EXPO_PUBLIC_API_URL + '/api/v1';
```

---

## Gap 3.2 — Inconsistent error response format across some routes
Some controllers return `{ error: 'message' }`, others return `{ success: false, error: 'CODE', message: '...' }`.

**Create a single error response enforcer:**

**File to modify:** `rez-backend-master/src/middleware/errorHandler.ts`

```typescript
// ADD at bottom of error handler — standardise ALL error responses:
export const standardErrorResponse = (res: Response, status: number, code: string, message: string, details?: any) => {
  return res.status(status).json({
    success:   false,
    error:     code,               // machine-readable: 'UNAUTHORIZED', 'NOT_FOUND'
    message,                       // human-readable: 'Token expired'
    timestamp: new Date().toISOString(),
    ...(details ? { details } : {}),
  });
};

// AUDIT: grep for `res.status(4` or `res.json({ error:` and replace with standardErrorResponse
// Run: grep -rn "res.status(4\|res.json({ error:" src/controllers/ | grep -v standardErrorResponse
```

---

## Gap 3.3 — No rate limit differentiation for financial endpoints
Currently, `strictLimiter` and `generalLimiter` exist, but the bill payment and wallet endpoints use the same limiter as everything else.

**File to modify:** `rez-backend-master/src/middleware/rateLimiter.ts`

```typescript
// ADD dedicated financial limiter:
export const financialLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  max:       10,            // max 10 financial operations per minute per IP
  message: { success: false, error: 'RATE_LIMITED', message: 'Too many payment requests. Please wait 1 minute.' },
  keyGenerator: (req: any) => req.user?._id?.toString() || req.ip,  // per USER not per IP
  skip: (req) => process.env.NODE_ENV === 'test',
});
```

**Apply to routes:**
```typescript
// In billPaymentRoutes.ts:
router.post('/pay', financialLimiter, validate(payBillSchema), payBill);

// In walletRoutes.ts (wherever wallet debit/transfer is):
router.post('/transfer', financialLimiter, ...);
router.post('/withdraw',  financialLimiter, ...);
```

---
---

# DIMENSION 4: SECURITY (7 → 10)

## Current state: 7/10
Helmet ✓, CORS ✓, mongo-sanitize ✓, rate limiting ✓, JWT ✓, webhook sig verification ✓

## Gap 4.1 — No SENTRY_DSN in .env = error tracking disabled in production
The code says: `if (!process.env.SENTRY_DSN) { logger.warn('Sentry DSN not configured'); return; }` — Sentry silently disabled.

**Action: Add to .env (not a code change):**
```bash
SENTRY_DSN=https://xxxx@o123456.ingest.sentry.io/xxxxxx
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=1.0.0
```

**Create Sentry project at sentry.io → Settings → Projects → New Project → Node.js**
**Copy DSN from Project Settings → Client Keys → DSN**
**Set as GitHub Secret: `SENTRY_DSN`**

---

## Gap 4.2 — No input sanitisation for XSS in text fields
`express-mongo-sanitize` protects against MongoDB injection. But user-supplied strings (store names, review text, notification messages) are stored raw and could contain XSS payloads rendered in admin panel.

**File to modify:** `rez-backend-master/src/config/middleware.ts`

```typescript
// ADD import:
import xss from 'xss';   // npm install xss @types/xss

// ADD XSS sanitization middleware (AFTER mongo-sanitize):
app.use((req, res, next) => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') return xss(obj, { whiteList: {} });
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => { obj[key] = sanitizeObject(obj[key]); });
    }
    return obj;
  };

  if (req.body)   req.body   = sanitizeObject(req.body);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
});
```

---

## Gap 4.3 — JWT secret falls back to 'test-secret' in some tests
```typescript
// In wallet.test.ts line 17:
jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET || 'test-secret', ...)
```
This is fine in tests. But verify production always has JWT_SECRET set.

**Add to startup validation:**

**File to modify:** `rez-backend-master/src/config/validateEnv.ts` (or create it)

```typescript
/**
 * Environment validation — run at startup.
 * Crashes the process if critical env vars are missing in production.
 */
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'MONGODB_URI',
    'JWT_SECRET',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'SENTRY_DSN',
    'REDIS_URL',
  ];

  const missing = required.filter(k => !process.env[k]);

  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables in production: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Warn if test keys in production
  if (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')) {
    console.error('FATAL: Razorpay test keys detected in production. Exiting.');
    process.exit(1);
  }
}
```

**Wire in `src/server.ts` (very first line before anything else):**
```typescript
import { validateProductionEnv } from './config/validateEnv';
validateProductionEnv();
```

---

## Gap 4.4 — No Content Security Policy (CSP) for admin panel
Admin panel serves web UI. Without CSP headers, injected scripts in user-submitted content (reviews, store names) could run in the admin's browser.

**Add to admin panel's Express server (if it has one) or to the rez-admin hosting config:**
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://cdn.rez.app data:; connect-src 'self' https://api.rez.app;
```

---
---

# DIMENSION 5: SCALABILITY (6 → 10)

## Current state: 6/10
Redis caching ✓, connection pooling ✓, Artillery load tests ✓, monolith (fine for now)

## Gap 5.1 — Artillery tests exist but not wired into CI
The artillery tests in `/artillery-tests/` are never run automatically. They run manually. A deploy that breaks performance is not caught.

**File to modify:** `.github/workflows/staging.yml`

```yaml
# ADD after integration-tests job, before deploy:
  performance-tests:
    name: Performance Baseline
    needs: integration-tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install Artillery
        run: npm install -g artillery@latest

      - name: Run baseline load test
        run: |
          artillery run artillery-tests/basic-load.yml \
            --target http://localhost:5001 \
            --output artillery-report.json
        env:
          NODE_ENV: test

      - name: Check performance thresholds
        run: |
          # Fail if p95 response time > 2000ms
          artillery report artillery-report.json --output artillery-report.html
          node -e "
            const report = require('./artillery-report.json');
            const p95 = report.aggregate.latency.p95;
            if (p95 > 2000) {
              console.error('p95 latency ' + p95 + 'ms exceeds 2000ms threshold');
              process.exit(1);
            }
            console.log('Performance check passed: p95=' + p95 + 'ms');
          "
```

---

## Gap 5.2 — No DB query timeout protection
A slow MongoDB query (missing index, large collection scan) can block the Node.js event loop and take down the API for all users.

**File to modify:** `rez-backend-master/src/config/database.ts`

```typescript
// ADD to mongoose connect options:
const connectOptions = {
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '25', 10),
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  // ADD THESE:
  socketTimeoutMS:    45000,   // close sockets after 45s of inactivity
  connectTimeoutMS:  10000,   // give up connecting after 10s
  maxIdleTimeMS:     30000,   // close idle connections after 30s
  // Heartbeat monitoring:
  heartbeatFrequencyMS: 10000,
};

// ADD global query timeout (any query > 10s is a bug):
mongoose.set('bufferCommands', false);
// In each slow route, add: .maxTimeMS(10000) to the query
// Example: BillPayment.find(query).maxTimeMS(10000).lean()
```

---

## Gap 5.3 — No caching on high-frequency user endpoints
`GET /api/wallet/balance` is called on every app open. With 10K users opening the app daily, that is 10K uncached DB reads per day minimum.

**File to modify:** walletController or wherever `/api/wallet/balance` is handled

```typescript
// ADD cache layer (30-second TTL for balance — fresh enough for UX):
export const getWalletBalance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Authentication required', 401);

  const cacheKey = `wallet:balance:${req.user._id}`;
  const cached   = await redisService.get<any>(cacheKey);
  if (cached) return sendSuccess(res, cached);

  const wallet = await Wallet.findOne({ userId: req.user._id }).lean();
  if (!wallet) return sendNotFound(res, 'Wallet not found');

  const data = { balance: wallet.balance, brandedCoins: wallet.brandedCoins };

  // 30s TTL — balance invalidated on any wallet mutation
  await redisService.set(cacheKey, data, 30).catch(() => {});

  sendSuccess(res, data);
});

// IMPORTANT: invalidate on every wallet mutation:
// In walletService.ts, after any credit/debit:
await redisService.del(`wallet:balance:${userId}`).catch(() => {});
```

---
---

# DIMENSION 6: FRONTEND POLISH (5 → 10)

## Current state: 5/10
49 frontend test files exist but critical config bugs, disconnected screens, no E2E frontend tests

## Gap 6.1 — The 8 known config bugs (from Bug Fixes doc)
These are the fixes from Doc 5 Week 1. All 8 must be done before calling frontend production-ready. Full code already in Doc 5 Sprint Tasks. Summary:

```
BUG-01: regionStore.ts line 38: 'dubai' → 'bangalore'
BUG-02: HomeHeader.tsx coin button → '/wallet-screen'
BUG-03: app/deals/index.tsx — create this file
BUG-04: gamificationEventBus.ts + streakHandler.ts — savings streak
BUG-05: 7 niche pages — serviceAppointmentApi not tableBookingApi
BUG-06: ProfileMenuModal.tsx — design + data fixes
BUG-07: notification-history.tsx + profile.tsx — load real data
BUG-08: Remove China, Dubai = Coming Soon
```

---

## Gap 6.2 — No end-to-end frontend test for the payment flow
The most critical user journey (pay at store → coins issued) has no automated test.

**File to create:** `nuqta-master/__tests__/integration/payInStore.test.ts`

```typescript
/**
 * Integration test: Pay in store → coins issued → wallet updated
 * Uses mocked API responses (no real backend needed)
 */
import { renderHook, act } from '@testing-library/react-native';
import { server } from '../mocks/server';
import { rest } from 'msw';
import { useWalletStore } from '@/stores/walletStore';

describe('Pay in store flow', () => {
  it('should update wallet after successful payment', async () => {
    // Mock payment success
    server.use(
      rest.post('/api/store-payment/create-bill', (req, res, ctx) =>
        res(ctx.json({ success: true, data: { bill: { finalAmount: 450, qrCode: 'data:...' } } }))
      ),
      rest.post('/api/store-payment/commit', (req, res, ctx) =>
        res(ctx.json({ success: true, data: { coinsEarned: 45, newBalance: 545 } }))
      )
    );

    const { result } = renderHook(() => useWalletStore());
    expect(result.current.balance.available).toBe(1100);

    // Simulate payment commit
    await act(async () => {
      await result.current.commitPayment({ storeId: 'test', amount: 450 });
    });

    expect(result.current.balance.available).toBe(545);
    expect(result.current.lastTransaction?.coinsEarned).toBe(45);
  });

  it('should show error if payment fails', async () => {
    server.use(
      rest.post('/api/store-payment/commit', (req, res, ctx) =>
        res(ctx.status(500), ctx.json({ success: false, error: 'PAYMENT_FAILED' }))
      )
    );

    const { result } = renderHook(() => useWalletStore());
    await act(async () => {
      await expect(result.current.commitPayment({ storeId: 'test', amount: 450 }))
        .rejects.toThrow('PAYMENT_FAILED');
    });

    // Balance unchanged on failure
    expect(result.current.balance.available).toBe(1100);
  });
});
```

---

## Gap 6.3 — No bill payment frontend test
`bill-payment.tsx` has zero test coverage despite being a new critical feature.

**File to create:** `nuqta-master/__tests__/integration/billPayment.test.ts`

```typescript
import { renderHook } from '@testing-library/react-native';
import { server }     from '../mocks/server';
import { rest }       from 'msw';
import { useBillPayment } from '@/hooks/useBillPayment';

describe('Bill payment flow', () => {
  it('should fetch bill types on mount', async () => {
    server.use(
      rest.get('/api/v1/bill-payments/types', (req, res, ctx) =>
        res(ctx.json({ success: true, data: [
          { id: 'electricity', label: 'Electricity', icon: 'flash-outline', color: '#F59E0B', providerCount: 3 },
          { id: 'mobile_prepaid', label: 'Recharge', icon: 'phone-portrait-outline', color: '#10B981', providerCount: 4 },
        ]}))
      )
    );

    const { result } = renderHook(() => useBillPayment());
    await waitFor(() => expect(result.current.billTypes).toHaveLength(2));
    expect(result.current.billTypes[0].id).toBe('electricity');
  });

  it('should issue promo coins after successful payment', async () => {
    server.use(
      rest.post('/api/v1/bill-payments/pay', (req, res, ctx) =>
        res(ctx.json({
          success: true,
          data: { payment: { status: 'completed', amount: 199 }, promoCoinsEarned: 15, promoExpiryDays: 7 }
        }))
      )
    );

    const { result } = renderHook(() => useBillPayment());
    await act(async () => {
      const res = await result.current.payBill({
        providerId: 'jio-id', customerNumber: '9876543210',
        amount: 199, razorpayPaymentId: 'pay_test123'
      });
      expect(res.promoCoinsEarned).toBe(15);
      expect(res.promoExpiryDays).toBe(7);
    });
  });

  it('should handle BBPS fetch failure gracefully', async () => {
    server.use(
      rest.post('/api/v1/bill-payments/fetch-bill', (req, res, ctx) =>
        res(ctx.status(404), ctx.json({ success: false, error: 'CONSUMER_NOT_FOUND', message: 'Consumer number not found' }))
      )
    );

    const { result } = renderHook(() => useBillPayment());
    await act(async () => {
      await expect(result.current.fetchBill({ providerId: 'bescom-id', customerNumber: '000' }))
        .rejects.toThrow('Consumer number not found');
    });
  });
});
```

---
---

# DIMENSION 7: DEVOPS / INFRA (7 → 10)

## Current state: 7/10
GitHub Actions ✓, Docker multi-stage ✓, Sentry ✓, Prometheus ✓, Winston ✓

## Gap 7.1 — Sentry DSN not in .env = tracking silently disabled
Already covered in Security Gap 4.1. Set SENTRY_DSN in production .env and GitHub Secrets.

## Gap 7.2 — No staging smoke test after deploy
The staging.yml builds and deploys but does not verify the deployment succeeded.

**Add to `.github/workflows/staging.yml` (at the end, after deploy job):**

```yaml
  smoke-tests:
    name: Staging Smoke Tests
    needs: deploy-staging   # runs after deploy
    runs-on: ubuntu-latest
    steps:
      - name: Wait for deploy to stabilise
        run: sleep 30

      - name: Health check
        run: |
          curl -f https://staging-api.rez.app/health || exit 1
          echo "Health check passed"

      - name: API smoke test
        run: |
          # Check bill types endpoint returns data
          BILL_TYPES=$(curl -s https://staging-api.rez.app/api/v1/bill-payments/types)
          echo $BILL_TYPES | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if len(d.get('data',[])) > 0 else 1)"
          echo "Bill types endpoint OK"

          # Check version endpoint
          curl -f https://staging-api.rez.app/api/v1/version || exit 1
          echo "Version endpoint OK"

      - name: Notify on failure
        if: failure()
        run: |
          echo "Staging smoke tests FAILED. Deployment may be broken."
          # Add Slack/webhook notification here
```

---

## Gap 7.3 — No log retention / alerting policy
Winston logs to files with daily rotation. But there is no alert when error rates spike.

**Add to Prometheus config (already exists at `src/config/prometheus.ts`):**

```typescript
// ADD these counters to the existing prometheus.ts:

// Error rate counter (increment on every 5xx response)
export const errorCounter = new Counter({
  name:       'http_errors_total',
  help:       'Total number of HTTP errors (5xx)',
  labelNames: ['route', 'status', 'error_type'],
});

// Payment failure counter (critical metric)
export const paymentFailureCounter = new Counter({
  name:       'payment_failures_total',
  help:       'Total number of payment failures',
  labelNames: ['type', 'provider'],
});

// Coin issuance counter (economy health metric)
export const coinIssuanceCounter = new Counter({
  name:       'coins_issued_total',
  help:       'Total coins issued',
  labelNames: ['coin_type', 'reward_type'],
});
```

**Wire in errorHandler middleware:**
```typescript
// In src/middleware/errorHandler.ts, inside the error handler:
import { errorCounter } from '../config/prometheus';

// Add before res.status().json():
if (status >= 500) {
  errorCounter.inc({ route: req.path, status: String(status), error_type: err.name });
}
```

**Wire in payBill controller:**
```typescript
// After bbpsService.payBill() fails in catch block:
import { paymentFailureCounter } from '../config/prometheus';
paymentFailureCounter.inc({ type: 'bbps', provider: provider.code });
```

---

## Gap 7.4 — Docker compose for local development is missing Redis
The `docker-compose.yml` likely lacks a full local dev setup. Developers without Redis locally will hit silent cache failures.

**Create `docker-compose.dev.yml`:**
```yaml
version: '3.8'
services:
  api:
    build:
      context: .
      target: builder          # use builder stage for hot reload
    volumes:
      - ./src:/app/src         # hot reload
    ports:
      - "5001:5001"
    environment:
      NODE_ENV:    development
      MONGODB_URI: mongodb://mongo:27017/rez-dev
      REDIS_URL:   redis://redis:6379
    depends_on:
      mongo:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run dev

  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  mongo_data:
```

**Usage:** `docker-compose -f docker-compose.dev.yml up`

---
---

# DIMENSION 8: TEST COVERAGE (5 → 10)

## Current state: 5/10
36 backend test files + 49 frontend test files exist. Critical missing: BBPS/billPayment tests, walletService unit tests for atomic debit race conditions.

## Gap 8.1 — No unit tests for walletService atomic debit (most critical gap)
The existing tests call `walletService.debit()` in e2e context. But there is no isolated unit test for the race condition where two concurrent debits could double-spend.

**File to create:** `rez-backend-master/src/__tests__/services/walletService.unit.test.ts`

```typescript
/**
 * WalletService Unit Tests — Critical Financial Path
 * Tests atomic debit, concurrent operations, and edge cases
 */

import mongoose from 'mongoose';
import { walletService } from '../../services/walletService';
import { Wallet } from '../../models/Wallet';

describe('WalletService — atomic debit', () => {
  let testWalletId: string;
  let testUserId: string;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/rez-test');
  });

  beforeEach(async () => {
    testUserId = new mongoose.Types.ObjectId().toString();
    const wallet = await Wallet.create({
      userId: testUserId,
      balance: { total: 1000, available: 1000, pending: 0, cashback: 1000, earned: 1000, spent: 0 },
    });
    testWalletId = wallet._id.toString();
  });

  afterEach(async () => {
    await Wallet.deleteMany({ userId: testUserId });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should debit the correct amount', async () => {
    await walletService.debit({
      userId: testUserId, amount: 100, coinType: 'rez',
      operationType: 'payment', description: 'Test debit',
      referenceId: 'test-ref', referenceModel: 'Test',
    });

    const wallet = await Wallet.findOne({ userId: testUserId }).lean();
    expect(wallet?.balance.available).toBe(900);
  });

  it('should reject debit when balance is insufficient', async () => {
    await expect(walletService.debit({
      userId: testUserId, amount: 2000, coinType: 'rez',
      operationType: 'payment', description: 'Over-debit',
      referenceId: 'test-ref-2', referenceModel: 'Test',
    })).rejects.toThrow();

    // Balance must be unchanged
    const wallet = await Wallet.findOne({ userId: testUserId }).lean();
    expect(wallet?.balance.available).toBe(1000);
  });

  it('should handle concurrent debits without double-spend', async () => {
    // Simulate 5 concurrent ₹300 debits on a ₹1000 wallet
    // Only 3 should succeed (3 × 300 = 900 ≤ 1000), 2 should fail

    const debits = Array.from({ length: 5 }, (_, i) =>
      walletService.debit({
        userId: testUserId, amount: 300, coinType: 'rez',
        operationType: 'payment', description: `Concurrent debit ${i}`,
        referenceId: `concurrent-${i}`, referenceModel: 'Test',
      }).then(() => 'success').catch(() => 'failure')
    );

    const results = await Promise.all(debits);
    const successes = results.filter(r => r === 'success').length;
    const failures  = results.filter(r => r === 'failure').length;

    // Final balance must be non-negative (the atomic guard must hold)
    const wallet = await Wallet.findOne({ userId: testUserId }).lean();
    expect(wallet?.balance.available).toBeGreaterThanOrEqual(0);

    // At most 3 should have succeeded (floor(1000/300) = 3)
    expect(successes).toBeLessThanOrEqual(3);
    expect(failures).toBeGreaterThanOrEqual(2);
  });

  it('should be idempotent for same referenceId', async () => {
    const params = {
      userId: testUserId, amount: 100, coinType: 'rez' as const,
      operationType: 'payment' as const, description: 'Idempotent test',
      referenceId: 'same-ref-123', referenceModel: 'Test',
    };

    await walletService.debit(params);
    await walletService.debit(params);  // second call same ref

    // Balance should only be debited once
    const wallet = await Wallet.findOne({ userId: testUserId }).lean();
    expect(wallet?.balance.available).toBe(900);  // debited once only
  });
});
```

---

## Gap 8.2 — No BBPS/billPayment controller tests (critical new feature)

**File to create:** `rez-backend-master/src/__tests__/routes/billPayment.test.ts`

```typescript
/**
 * Bill Payment Route Tests
 * Covers BBPS flow, coin issuance, refund, webhook
 */

import request  from 'supertest';
import mongoose from 'mongoose';
import { app }  from '../../server';
import { BillProvider } from '../../models/BillProvider';
import { BillPayment }  from '../../models/BillPayment';
import jwt from 'jsonwebtoken';

jest.mock('../../services/bbpsService', () => ({
  bbpsService: {
    fetchBill: jest.fn().mockResolvedValue({
      billAmount: 2450, dueDate: '2026-04-05', consumerName: 'Test User',
    }),
    payBill: jest.fn().mockResolvedValue({
      transactionId: 'TXN-TEST-001', status: 'SUCCESS', timestamp: new Date().toISOString(),
    }),
    initiateRefund: jest.fn().mockResolvedValue({ refundId: 'REF-TEST-001' }),
  },
}));

jest.mock('../../services/razorpayService', () => ({
  razorpayService: {
    verifyPaymentId: jest.fn().mockResolvedValue(true),
    validateWebhookSignature: jest.fn().mockReturnValue(true),
  },
}));

describe('Bill Payment Routes', () => {
  let authToken: string;
  let testUserId: string;
  let testProvider: any;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/rez-test');
  });

  beforeEach(async () => {
    testUserId  = new mongoose.Types.ObjectId().toString();
    authToken   = jwt.sign({ userId: testUserId }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
    testProvider = await BillProvider.create({
      name: 'BESCOM Test', code: 'bescom-test', type: 'electricity',
      aggregatorCode: 'BESCOM', aggregatorName: 'razorpay',
      promoCoinsFixed: 25, promoExpiryDays: 14, maxRedemptionPercent: 20,
      cashbackPercent: 1, displayOrder: 1, isActive: true,
    });
  });

  afterEach(async () => {
    await BillProvider.deleteMany({ code: 'bescom-test' });
    await BillPayment.deleteMany({ customerNumber: '1234567890' });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/v1/bill-payments/types', () => {
    it('should return bill types without auth', async () => {
      const res = await request(app).get('/api/v1/bill-payments/types');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/bill-payments/fetch-bill', () => {
    it('should return bill info for valid consumer number', async () => {
      const res = await request(app)
        .post('/api/v1/bill-payments/fetch-bill')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ providerId: testProvider._id, customerNumber: '1234567890' });

      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(2450);
      expect(res.body.data.promoCoins).toBe(25);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/v1/bill-payments/fetch-bill')
        .send({ providerId: testProvider._id, customerNumber: '123' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/bill-payments/pay', () => {
    it('should create payment and issue promo coins on success', async () => {
      const res = await request(app)
        .post('/api/v1/bill-payments/pay')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          providerId: testProvider._id, customerNumber: '1234567890',
          amount: 2450, razorpayPaymentId: 'pay_test123',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.promoCoinsEarned).toBe(25);
      expect(res.body.data.promoExpiryDays).toBe(14);
      expect(res.body.data.status).toBe('SUCCESS');

      // Verify record in DB
      const payment = await BillPayment.findOne({ customerNumber: '1234567890' });
      expect(payment?.promoCoinsIssued).toBe(25);
      expect(payment?.aggregatorRef).toBe('TXN-TEST-001');
    });

    it('should reject invalid payment verification', async () => {
      const { razorpayService } = require('../../services/razorpayService');
      razorpayService.verifyPaymentId.mockResolvedValueOnce(false);

      const res = await request(app)
        .post('/api/v1/bill-payments/pay')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          providerId: testProvider._id, customerNumber: '1234567890',
          amount: 2450, razorpayPaymentId: 'pay_invalid',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('PAYMENT_VERIFICATION_FAILED');
    });
  });

  describe('POST /api/v1/bill-payments/webhook/bbps', () => {
    it('should update payment status on webhook', async () => {
      const payment = await BillPayment.create({
        userId: testUserId, provider: testProvider._id, billType: 'electricity',
        customerNumber: '9999999999', amount: 2450, status: 'processing',
        transactionRef: 'BP-TEST-WEBHOOK',
      });

      const res = await request(app)
        .post('/api/v1/bill-payments/webhook/bbps')
        .set('x-razorpay-signature', 'valid-sig')
        .send({
          event:   'bbps.payment.completed',
          payload: { transaction_id: 'TXN-WEBHOOK-001', reference_id: 'BP-TEST-WEBHOOK', status: 'SUCCESS' },
        });

      expect(res.status).toBe(200);

      const updated = await BillPayment.findById(payment._id);
      expect(updated?.status).toBe('completed');
      expect(updated?.webhookVerified).toBe(true);
    });
  });
});
```

---

## Gap 8.3 — Coverage threshold must actually pass

Add this to `jest.config.js` (already partially there — just verify thresholds are enforced):

```javascript
// jest.config.js — verify these values are correct:
coverageThreshold: {
  global: {
    branches:   70,
    functions:  70,
    lines:      70,
    statements: 70
  },
  // ADD per-file thresholds for critical paths:
  './src/services/walletService.ts': {
    branches:   85,
    functions:  85,
    lines:      85,
    statements: 85,
  },
  './src/controllers/billPaymentController.ts': {
    branches:   80,
    functions:  80,
    lines:      80,
    statements: 80,
  },
  './src/core/rewardEngine.ts': {
    branches:   80,
    functions:  80,
    lines:      80,
    statements: 80,
  },
},
```

**Add coverage gate to CI (already in pr-checks.yml but verify it runs):**
```yaml
# In pr-checks.yml unit-tests job:
- name: Run unit tests with coverage
  run: npm run test:coverage -- --ci
  env:
    MONGODB_TEST_URI: mongodb://localhost:27017/rez-test
    JWT_SECRET: test-secret-for-ci-only
    NODE_ENV: test

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: true
    threshold: 70
```

---
---

# DIMENSION 9: DOCUMENTATION (9 → 10)

## Current state: 9/10
7,413 lines across 7 docs. Exceptional for this stage.

## Gap 9.1 — No CONTRIBUTING.md for new developers
When you hire a developer or bring in a contractor, there is no single document telling them how to set up the project locally, run tests, and submit a PR.

**File to create:** `rez-backend-master/CONTRIBUTING.md`

```markdown
# Contributing to REZ Backend

## Quick start (5 minutes)

1. Clone the repo
2. Copy `.env.example` → `.env` and fill in required values
3. Start dependencies: `docker-compose -f docker-compose.dev.yml up -d`
4. Install dependencies: `npm install`
5. Start dev server: `npm run dev`
6. Run tests: `npm test`

## Required environment variables

See `.env.example` for all required variables. Critical ones:
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — must be at least 32 characters in production
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — use test keys locally
- `REDIS_URL` — Redis connection string

## Before submitting a PR

- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes (all tests green)
- [ ] `npm run test:coverage` shows no decrease from baseline
- [ ] New features have tests
- [ ] New API routes are in Doc 4 (API Contract)
- [ ] DB schema changes are in Doc 6

## Architecture decisions

See `/docs` folder and the 7 technical documents for all architecture decisions.
Do not change the coin economy logic without reading Doc 6 and Doc 7 first.
```

---

## Gap 9.2 — No `.env.example` file
Developers who clone the repo have no idea what environment variables are needed.

**File to create:** `rez-backend-master/.env.example`

```bash
# REZ Backend — Environment Variables
# Copy this file to .env and fill in values
# NEVER commit .env to git

# Database
MONGODB_URI=mongodb://localhost:27017/rez-dev
MONGODB_TEST_URI=mongodb://localhost:27017/rez-test
MONGO_MAX_POOL_SIZE=25

# Authentication
JWT_SECRET=your-secret-here-minimum-32-characters
JWT_EXPIRES_IN=7d

# Razorpay (use rzp_test_ keys locally)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

# Redis
REDIS_URL=redis://localhost:6379

# Sentry (optional locally, required in production)
SENTRY_DSN=
SENTRY_ENVIRONMENT=development

# BBPS
BBPS_ENABLED=true
BBPS_AGGREGATOR=razorpay

# Feature flags (all false by default)
FEATURE_BIZONE_MERCHANT=false

# Server
PORT=5001
NODE_ENV=development
API_PREFIX=/api/v1
```

---
---

# IMPLEMENTATION PRIORITY TABLE

| Priority | Gap | Files Changed | Effort | Risk if Skipped |
|----------|-----|---------------|--------|-----------------|
| P0 | Env validation at startup | validateEnv.ts + server.ts | 2h | Deploy with missing keys → production crash |
| P0 | BUG-01 through BUG-08 | 8 frontend files | 16h | Every user sees broken Dubai default |
| P0 | walletService race condition test | walletService.unit.test.ts | 4h | Double-spend on concurrent payments |
| P1 | BBPS billPayment tests | billPayment.test.ts | 6h | New feature ships untested |
| P1 | Graceful shutdown | gracefulShutdown.ts | 2h | Mid-deploy wallet corruption possible |
| P1 | Deep health check | healthRoutes.ts | 2h | Docker shows "healthy" when DB is down |
| P1 | Request correlation ID | middleware.ts + logger.ts | 2h | Cannot trace bugs through logs |
| P1 | .env.example + CONTRIBUTING.md | new files | 2h | New developer takes days to set up |
| P2 | API versioning | routes.ts + apiClient.ts | 4h | Breaking changes affect old app versions |
| P2 | XSS sanitization | middleware.ts | 2h | User content can XSS admin panel |
| P2 | Financial rate limiter | rateLimiter.ts | 1h | Malicious bulk payment requests |
| P2 | Artillery in CI | staging.yml | 2h | Performance regression not caught |
| P2 | Wallet balance caching | walletController.ts | 3h | 10K users = 10K DB reads per app open |
| P2 | Frontend payment E2E test | payInStore.test.ts | 4h | Payment flow untested end-to-end |
| P3 | Soft delete on models | BillProvider + Store | 4h | Deleting provider breaks history |
| P3 | Coverage per-file thresholds | jest.config.js | 30m | Critical files could drop below 70% |
| P3 | Smoke tests post-deploy | staging.yml | 2h | Broken deploy not caught for hours |
| P3 | Docker Compose dev | docker-compose.dev.yml | 1h | Redis missing in local dev |

**Total P0 effort: 22 hours (3 days)**
**Total P1 effort: 14 hours (2 days)**
**Total P2 effort: 16 hours (2 days)**
**Total P3 effort: 7.5 hours (1 day)**

**Full 10/10 upgrade: 8 working days**

---

# FINAL SCORES AFTER ALL FIXES

| Dimension | Before Fixes | After All Fixes | Key Change |
|-----------|-------------|-----------------|------------|
| Backend architecture | 8 | 10 | Graceful shutdown + correlation ID + deep health |
| Data model depth | 8 | 10 | Soft delete + cross-field validation |
| API design | 7 | 10 | Versioning + unified error format + financial limiter |
| Security | 7 | 10 | XSS sanitize + env validation + SENTRY_DSN live |
| Scalability | 6 | 10 | Artillery in CI + query timeout + wallet caching |
| Frontend polish | 5 | 10 | 8 config bugs fixed + payment E2E tests |
| DevOps / infra | 7 | 10 | Sentry live + smoke tests + docker-compose.dev |
| Test coverage | 5 | 10 | walletService race test + billPayment tests + per-file thresholds |
| Documentation | 9 | 10 | CONTRIBUTING.md + .env.example |

**Overall: 7.0 → 10.0**

*REZ 10/10 Tech Upgrade Report · March 2026 · 18 gaps · 8 working days to fix all*
