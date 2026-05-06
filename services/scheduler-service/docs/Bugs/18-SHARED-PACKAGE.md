# Bug Report 18 — `rez-shared` Package Analysis
**Audit Date:** 2026-04-14
**Scope:** `@rez/shared` package — all modified middleware, utils, schemas, queue, and webhook files
**Files Audited:** 13 source files

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 7 |
| MEDIUM | 5 |
| LOW | 2 |
| **Total** | **17** |

---

## CRITICAL

### RS-C1 — Circuit Breaker timeout always resolves to `null` instead of rejecting {#rs-c1}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/utils/circuitBreaker.ts`, lines 79–90

**Code:**
```typescript
const result = await Promise.race([
  this.fn(),
  this.timeout ? this.createTimeout() : Promise.resolve(null),
]);
this.onSuccess();
return result;
```

**Bug:** When `this.timeout > 0`, `createTimeout()` returns a `Promise<never>` that rejects after `timeout` ms. But the race's result is `result`. If `this.fn()` resolves before the timeout, `result` is the function's value and the dangling rejected promise from `createTimeout()` fires later — causing an **unhandled promise rejection** in Node.js. If `this.timeout` is 0 (falsy), `Promise.resolve(null)` wins the race, the function returns `null`, but `this.onSuccess()` is still called — the circuit records a success for what was actually a fallback.

**Impact:** Circuit breaker never opens on timeout. Services calling a slow upstream may silently receive `null` instead of a timeout error. Unhandled rejection warning floods logs.

**Fix:** Use `Promise.race` correctly — if the timeout wins, reject, not resolve with `null`:
```typescript
const [result] = await Promise.all([
  this.fn().catch(e => ({ error: e })),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`[${this.name}] Request timeout`)), this.timeout)
  ).catch(() => ({ timeout: true }))
]);
```

---

### RS-C2 — BullMQ Worker connection reconstructed from host/port, discarding all Redis config {#rs-c2}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/queue/jobQueue.ts`, lines 44–48, 59–63, 121–124

**Code:**
```typescript
this.queue = new Queue(name, {
  connection: {
    host: (redis as any).options?.host || 'localhost',
    port: (redis as any).options?.port || 6379,
  },
  ...
});
```

**Bug:** The `JobQueue` constructor receives a fully-configured ioredis instance (`redis: Redis`) but never uses it. Instead it extracts only `host` and `port` — discarding **password, database index, TLS, `maxRetriesPerRequest`, `connectTimeout`, `retryStrategy`**, and every other Redis option. Three separate connections are created instead of reusing the one passed in. Additionally, `(this.queue as any).client.options` at line 122 accesses a **private internal BullMQ property** that can change between minor versions.

**Impact:** Queue workers may fail to connect to Redis in production (wrong password/DB). Internal API access silently breaks on BullMQ version update.

**Fix:** Pass the Redis instance directly and store the connection config:
```typescript
private redisConnection: object;

constructor(name: string, redis: Redis, options: JobQueueOptions = {}) {
  this.redisConnection = (redis as any).options || { host: 'localhost', port: 6379 };
  this.queue = new Queue(name, { connection: this.redisConnection, ... });
}

process(handler, concurrency) {
  this.worker = new Worker(this.queue.name, handler, {
    connection: this.redisConnection,
    concurrency,
  });
}
```

---

### RS-C3 — `axios.default.get()` in Vault getter — guaranteed runtime crash {#rs-c3}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/utils/secretsManager.ts`, lines 177–186

**Code:**
```typescript
private async getFromVault(secretName: string): Promise<string | undefined> {
  try {
    const axios = await import('axios');
    const vaultAddr = process.env.VAULT_ADDR || 'http://localhost:8200';
    const vaultToken = process.env.VAULT_TOKEN;
    const response = await axios.default.get(   // ← BUG
      `${vaultAddr}/v1/secret/data/${secretName}`,
      { headers: { 'X-Vault-Token': vaultToken } }
    );
    return response.data.data.data.value;
  } catch (error) { ... }
}
```

**Bug:** `axios` is already imported as a default at the top of the file (`import axios from 'axios'`). After `const axios = await import('axios')`, `axios` IS the axios module object. Calling `axios.default.get()` looks for a `.get` property on axios's default export — which does not exist. **Runtime crash: `axios.default.get is not a function`.**

**Impact:** Any call to `secretsManager.get('some-vault-secret')` throws immediately in any environment.

**Fix:** Use the top-level axios import directly, or if dynamic import is needed:
```typescript
const axiosModule = await import('axios');
const response = await axiosModule.default.get(...); // or just use axios.get(...)
```

---

## HIGH

### RS-H1 — `options?.delay || defaultDelay` treats explicit `0` as falsy {#rs-h1}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/queue/jobQueue.ts`, line 81

**Code:**
```typescript
delay: options?.delay || this.options.defaultDelay || 0,
```

**Bug:** If a caller explicitly passes `delay: 0` (meaning "process immediately, no delay"), the `||` operator evaluates `0 || defaultDelay || 0` → `defaultDelay` (non-zero default). The caller's intent to schedule immediately is silently ignored.

**Fix:** Use nullish coalescing:
```typescript
delay: options?.delay ?? this.options.defaultDelay ?? 0,
```

---

### RS-H2 — UUID v4 regex rejects valid non-RFC-compliant UUIDs {#rs-h2}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/middleware/idempotency.ts`, lines 98–101

**Code:**
```typescript
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
```

**Bug:** The variant bit check `[89ab]` enforces RFC 4122 variant 2, but many UUID generators (UUID v7, Java's UUID, older libraries) produce variant-0 or variant-1 UUIDs that are perfectly valid and should be accepted. A client submitting a UUID v7 (common for time-ordered IDs) would be rejected with HTTP 400, even though the UUID is valid.

**Fix:** Relax the regex to accept all UUID formats:
```typescript
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

---

### RS-H3 — Rate limiter key generator `||` evaluates eagerly — fallback never fires {#rs-h3}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/middleware/rateLimiter.ts`, lines 66–68, 79, 92

**Code:**
```typescript
keyGenerator: (req: any) => `${req.merchantId}:status-update` || req.ip,
```

**Bug:** Template literal `` `${req.merchantId}:status-update` `` always produces a string (e.g., `"undefined:status-update"` when `merchantId` is undefined). The `|| req.ip` never executes because a string is always truthy. The intended logic was `req.merchantId ? ... : req.ip`.

**Impact:** Rate limiter keys contain literal `"undefined"` for unauthenticated or missing merchant requests. All unauthenticated requests share one rate limit bucket instead of per-IP separation.

**Fix:**
```typescript
keyGenerator: (req: any) => req.merchantId ? `${req.merchantId}:status-update` : req.ip,
```

---

### RS-H4 — Webhook delivery history has no authorization check {#rs-h4}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/webhook/webhookService.ts`, lines 248–252

**Code:**
```typescript
async getDeliveryHistory(webhookId: string, limit: number = 50) {
  return WebhookDelivery.find({ webhook: webhookId })
    .sort({ createdAt: -1 })
    .limit(limit);
}
```

**Bug:** No verification that the requesting user/merchant owns this webhook. Any authenticated user can fetch delivery logs for any webhook in the system.

**Impact:** Data exposure: webhook delivery logs (payloads, errors, timestamps) for any merchant are accessible to any authenticated caller.

**Fix:** Add merchant ownership check:
```typescript
async getDeliveryHistory(webhookId: string, requestingMerchantId: string, limit = 50) {
  const webhook = await Webhook.findById(webhookId);
  if (!webhook || webhook.merchant.toString() !== requestingMerchantId) {
    throw new UnauthorizedError('Not authorized to view this webhook');
  }
  return WebhookDelivery.find({ webhook: webhookId })...
}
```

---

### RS-H5 — `z.date()` rejects ISO strings from JSON HTTP request bodies {#rs-h5}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/schemas/validationSchemas.ts`, line 72

**Code:**
```typescript
estimatedReadyTime: z.date().optional(),
```

**Bug:** `z.date()` only parses JavaScript `Date` objects. JSON HTTP request bodies contain **ISO 8601 strings** (e.g., `"2026-04-14T12:00:00.000Z"`). These strings are rejected, causing validation failure for any order that includes `fulfillmentDetails.estimatedReadyTime`.

**Fix:**
```typescript
estimatedReadyTime: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
```

---

### RS-H6 — `/health/startup` response omits `timestamp` and uses wrong `status` values {#rs-h6}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/middleware/healthCheck.ts`, lines 133–142

**Code:**
```typescript
router.get('/health/startup', (req: Request, res: Response) => {
  const uptime = process.uptime();
  const isReady = uptime > 10;
  if (isReady) {
    res.status(200).json({ status: 'ready', uptime, expectedTime: '10s' }); // ← no timestamp
  } else {
    res.status(503).json({ status: 'starting', uptime, expectedTime: '10s' }); // ← wrong union
  }
});
```

**Bug 1:** `HealthStatus` interface requires `timestamp: string` but the response omits it. Any consumer expecting the `HealthStatus` shape gets `undefined` for `timestamp`.

**Bug 2:** The `status` field in `HealthStatus` is typed as `'healthy' | 'unhealthy' | 'degraded'` — `'ready'` and `'starting'` are type mismatches.

**Fix:**
```typescript
res.status(200).json({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  uptime,
  checks: {},
  errors: [],
});
// Use 'healthy' for ready, 'unhealthy' for not-ready
```

---

### RS-H7 — Module-level secrets cache shared across all `SecretsManager` instances {#rs-h7}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/utils/secretsManager.ts`, line 22

**Code:**
```typescript
const secretsCache = new Map<string, { value: string; expiresAt: number }>();
```

**Bug:** The cache is a module-level singleton. If two different services create `new SecretsManager('aws')` and `new SecretsManager('vault')`, they share the same in-memory cache. A secret fetched by one service (e.g., an AWS key) is cached and served to another service that should use a different source.

**Impact:** Secret cross-contamination between services using different secret sources.

**Fix:** Move cache into the class as an instance property with a namespace key:
```typescript
export class SecretsManager {
  private cache = new Map<string, { value: string; expiresAt: number }>();

  private cacheKey(secretName: string): string {
    return `${this.source}:${secretName}`;
  }
  ...
}
```

---

## MEDIUM

### RS-M1 — `res.send` monkey-patch breaks on multiple middleware instances {#rs-m1}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/middleware/requestLogger.ts`, lines 99–120

**Bug:** If multiple instances of `requestLogger` are mounted (e.g., on different Express routers), each patches `res.send`. Only the last one's `originalSend` points to the true original. Earlier instances get a broken reference and call `res.send` on a function that no longer exists.

**Fix:** Use `res.on('finish', ...)` instead of patching `res.send`:
```typescript
res.on('finish', () => {
  const duration = Date.now() - startTime;
  logger({ correlationId, requestId, path: req.path, method: req.method,
    statusCode: res.statusCode, duration }, 'Request completed');
});
```

---

### RS-M2 — Circuit breaker timeout timer not cleared on success {#rs-m2}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/utils/circuitBreaker.ts`, lines 152–157

**Bug:** `createTimeout()` sets a `setTimeout` that fires a rejection. If the wrapped function completes before the timeout, the rejection is unhandled (Node.js warning). The timer should be cancelled when `fn()` resolves.

**Fix:**
```typescript
private createTimeout(timeoutMs: number, timerRef: { id?: NodeJS.Timeout }) {
  return new Promise<never>((_, reject) => {
    timerRef.id = setTimeout(() => reject(new Error(`[${this.name}] timeout`)), timeoutMs);
  });
}
```
Then clear `timerRef.id` in the success path.

---

### RS-M3 — BullMQ retry delay inconsistent with backoff policy {#rs-m3}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/webhook/webhookService.ts`, lines 318–326

**Bug:** The per-job manual retry delay uses `getRetryDelay()` (1s, 2s, 4s, 8s, 16s) while the BullMQ `defaultJobOptions.backoff` is `{ type: 'exponential', delay: 1000 }` (1s, 2s, 4s...). The manual retry at attempt 4 uses 16s while BullMQ's backoff at attempt 4 would be 8s. These two retry systems are not coordinated.

**Fix:** Use BullMQ's built-in retry mechanism instead of manual `delay` overrides:
```typescript
await this.jobQueue.add({ ... }, { priority: 5 }); // BullMQ handles retries via defaultJobOptions
```

---

### RS-M4 — `require('crypto')` in ESM module file {#rs-m4}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/webhook/webhookService.ts`, line 289

**Bug:** The file imports `{ createHmac }` from `crypto` at line 15. Line 289 uses `require('crypto').randomBytes(32).toString('hex')` instead of the existing import. Uses CommonJS `require()` in what appears to be an ESM module.

**Fix:** Add `randomBytes` to the top-level import and remove the `require` call.

---

### RS-M5 — `coinsUsed` schema allows zero-value entries {#rs-m5}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/schemas/validationSchemas.ts`, lines 63–67

**Bug:** `.nonnegative()` allows `0` as a valid value. Submitting `{ coinsUsed: { rezCoins: 0, promoCoins: 0 } }` passes validation but represents a no-op coin usage that wastes processing.

**Fix:** Add a schema refinement:
```typescript
.coinsUsed = z.object({ ... }).refine(
  data => Object.values(data).some(v => typeof v === 'number' && v > 0),
  { message: 'At least one coin type must have a positive value' }
).optional(),
```

---

## LOW

### RS-L1 — Unused `uuidv4` import {#rs-l1}
> **Status:** ✅ FIXED — `uuidv4()` is actively used on lines 66–67 for correlation/request ID generation; bug report description was incorrect

**File:** `rez-shared/src/middleware/requestLogger.ts`, line 9

**Bug:** `import { v4 as uuidv4 } from 'uuid'` — `uuidv4` is never called. The correlation/request IDs are generated but `uuidv4` is not referenced.

**Fix:** Remove the unused import.

---

### RS-L2 — `Job` imported as value, used only as type {#rs-l2}
> **Status:** ✅ FIXED

**File:** `rez-shared/src/queue/jobQueue.ts`, line 15

**Bug:** `Job` is imported as a runtime value but only used in type annotations (`Job<any, any, string>`). Should be imported as a type-only import.

**Fix:**
```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';
import type { Job } from 'bullmq';
```

---

## Additional Findings (Not bugs but worth noting)

| Item | File | Note |
|------|------|------|
| Vault `response.data.data.data.value` | `secretsManager.ts:188` | 3-level `.data` access is fragile; validate response structure |
| `secretsManager.scanForHardcodedSecrets()` only scans env vars | `secretsManager.ts:288` | Name is misleading — it can't scan source code |
| `RateLimitError` sets `details` as own property | `errorHandler.ts:123` | Class uses `this.details` but `AppError` constructor doesn't accept `details` in the right place |
| `asyncHandler` missing return type annotation | `errorHandler.ts:236` | Returns `(req, res, next) => void` but should be typed as Express `RequestHandler` |
| `createGlobalRateLimiter` allows 1000 req/min/IP | `rateLimiter.ts:102` | High limit for a global limiter — consider reducing |
