# PHASE 7D: MEDIUM BUG AUDIT & FIX PLAN
**Date:** 2026-04-15  
**Scope:** Backend MEDIUM severity bugs across shared libs + events service + remaining backends  
**Target:** 40-60 MEDIUM bugs  
**Status:** Analysis complete, ready for staged implementation

---

## EXECUTIVE SUMMARY

**Total MEDIUM bugs identified across monorepo: 239**

| Service | MEDIUM Count | Fixed | Unfixed | Priority |
|---------|-------------|-------|---------|----------|
| EVENTS  | 28          | 0     | 28      | CRITICAL |
| SEARCH  | 27          | 0     | 27      | HIGH     |
| MERCHANT| 26          | 7     | 19      | HIGH     |
| AUTH    | 26          | 0     | 26      | HIGH     |
| WALLET  | 23          | 0     | 23      | HIGH     |
| FINANCE | 21          | 0     | 21      | HIGH     |
| SHARED  | 19          | 0     | 19      | CRITICAL |
| PAYMENT | 18          | 4     | 14      | HIGH     |
| GATEWAY | 18          | 0     | 18      | HIGH     |
| ORDER   | 17          | 14    | 3       | LOW      |
| CATALOG | 16          | 4     | 12      | MEDIUM   |

**Phase 7d Target: 48 MEDIUM bugs across 7 services**

---

## TIER 1: SHARED LIBS (BE-SHR) - 10 MEDIUM BUGS

Critical infrastructure bugs affecting all backend services.

### BE-SHR-003: Idempotency JSON Parsing Vulnerability
**File:** `rez-shared/src/middleware/idempotency.ts` (line 64)  
**Issue:** `JSON.parse(cached)` lacks try-catch; malformed cache crashes app  
**Impact:** Cache corruption causes service unavailability  
**Fix:** Wrap in try-catch, log error, skip cache on parse failure
```typescript
let cachedData;
try {
  cachedData = JSON.parse(cached);
} catch (parseError) {
  logger.warn('Idempotency cache corrupted, skipping cache', parseError);
  return next(); // Skip cache and process request
}
```

### BE-SHR-007: Validation Error Path Assumes Array
**File:** `rez-shared/src/middleware/errorHandler.ts` (line 191-192)  
**Issue:** `detail.path.join('.')` fails if path is not an array  
**Impact:** Validation errors crash error handler instead of returning proper response  
**Fix:** Add defensive checks before join()
```typescript
const path = Array.isArray(detail.path) 
  ? detail.path.join('.')
  : String(detail.path || 'unknown');
```

### BE-SHR-012: MongoDB Health Check Inadequate
**File:** `rez-shared/src/middleware/healthCheck.ts` (line 78)  
**Issue:** Only checks `readyState === 1` and calls `ping()`; doesn't verify query capability  
**Impact:** Dead connections reported as healthy; cascading failures  
**Fix:** Execute test query instead of just ping
```typescript
async function checkMongoDB() {
  try {
    // Instead of just ping(), execute a lightweight test query
    await mongoose.connection.db.admin().serverStatus();
    return true;
  } catch (err) {
    return false;
  }
}
```

### BE-SHR-014: Webhook Signature Timing Attack
**File:** `rez-shared/src/webhook/webhookService.ts` (line 279-282)  
**Issue:** Signature verification missing constant-time comparison documentation  
**Impact:** Potential timing attack on webhook signatures  
**Fix:** Add helper with `crypto.timingSafeEqual()` and document requirement
```typescript
export function verifyWebhookSignature(signature: string, expectedSignature: string): boolean {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (err) {
    return false; // Length mismatch or invalid encoding
  }
}
```

### BE-SHR-015: Webhook Delivery Timeout Not Enforced
**File:** `rez-shared/src/webhook/webhookService.ts` (line 191-194)  
**Issue:** 10-second axios timeout doesn't cover pre-axios overhead  
**Impact:** Slow webhooks block job queue; resource exhaustion  
**Fix:** Wrap entire deliver() with Promise.race timeout
```typescript
async deliver(...) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Webhook delivery timeout')), 10000)
  );
  return Promise.race([this.executeDelivery(...), timeoutPromise]);
}
```

### BE-SHR-016: Webhook Retry Config Not Honored
**File:** `rez-shared/src/webhook/webhookService.ts` (line 295)  
**Issue:** `shouldRetry()` hardcoded maxRetries=5 ignores webhook config  
**Impact:** All webhooks retry same number of times regardless of config  
**Fix:** Pass webhook's configured maxRetries to shouldRetry()
```typescript
const maxRetries = webhook.maxRetries ?? 5; // From database config
if (!shouldRetry(error, attempt, maxRetries)) {
  throw new Error('Max retries exceeded');
}
```

### BE-SHR-017: Job Queue Completion Removal Too Aggressive
**File:** `rez-shared/src/queue/jobQueue.ts` (line 55)  
**Issue:** `removeOnComplete: { age: 3600 }` deletes audit trail after 1 hour  
**Impact:** Can't audit or replay jobs after short retention period  
**Fix:** Make retention configurable, support permanent audit logs
```typescript
const retention = config.jobRetention ?? { age: 86400 * 30 }; // 30 days default
queue.set({ removeOnComplete: retention });
```

### BE-SHR-018: Job Queue Deduplication Unreliable
**File:** `rez-shared/src/queue/jobQueue.ts` (line 86-95)  
**Issue:** `addUnique()` may allow duplicates if timing overlaps  
**Impact:** Duplicate job processing despite deduplication intent  
**Fix:** Verify BullMQ behavior and add pre-check
```typescript
async addUnique(key: string, data: any) {
  // Pre-check: verify job not already queued
  const existing = await queue.getJob(key);
  if (existing) return existing;
  
  return queue.add(data, { jobId: key });
}
```

### BE-SHR-020: Email Queue Deduplication No TTL
**File:** `rez-shared/src/queue/jobQueue.ts` (line 206)  
**Issue:** Email dedup key `email:${to}:${subject}` has no TTL; can't resend same email  
**Impact:** Users can't request duplicate emails (resend after server error)  
**Fix:** Add optional TTL and explicit resend flag
```typescript
async sendEmail(to: string, subject: string, { dedup = true, dedupTTL = 3600 } = {}) {
  const jobId = dedup ? `email:${to}:${subject}:${dedupTTL}` : undefined;
  return queue.add({ to, subject }, { jobId });
}
```

### BE-SHR-021: Webhook Queue Missing Idempotency
**File:** `rez-shared/src/queue/jobQueue.ts` (line 243-253)  
**Issue:** `sendWebhook()` calls `add()` not `addUnique()`; no deduplication  
**Impact:** Duplicate webhook deliveries on rapid retries  
**Fix:** Use idempotent job ID based on event
```typescript
async sendWebhook(eventId: string, webhookId: string, data: any) {
  const jobId = `webhook:${eventId}:${webhookId}`;
  return queue.add(data, { jobId });
}
```

---

## TIER 2: EVENTS SERVICE (BE-EVT) - 8 MEDIUM BUGS

Event pipeline safety, Kafka producer/consumer reliability.

### BE-EVT-001: Missing Event Schema Validation
**File:** `rez-notification-events/src/worker.ts` (line 27-50)  
**Issue:** NotificationEvent has no Zod validation; invalid userId accepted  
**Impact:** Runtime errors downstream; invalid events silently processed  
**Fix:** Create centralized Zod schemas with strict validation
```typescript
// src/schemas/notificationEventSchema.ts
export const NotificationEventSchema = z.object({
  userId: z.string().min(24).max(24), // Valid ObjectId
  channels: z.array(z.enum(['push', 'email', 'sms', 'inapp'])),
  payload: z.object({
    title: z.string().max(200),
    data: z.record(z.any()),
  }),
});

// In worker.ts
const event = NotificationEventSchema.parse(job.data);
```

### BE-EVT-002: Push Notification Silent Failures
**File:** `rez-notification-events/src/worker.ts` (line 54-92)  
**Issue:** Returns `skipped:no-push-token` without alerting; users unaware  
**Impact:** Notifications silently disappear; no monitoring  
**Fix:** Emit alert and track in DLQ
```typescript
if (!devices.length) {
  logger.warn(`[CRITICAL] No push devices for user ${event.userId}`);
  await emitMonitoringAlert('PUSH_DELIVERY_FAILED', { userId });
  return 'partial_failure'; // Allow retry
}
```

### BE-EVT-003: Email Resolution Silent Failures
**File:** `rez-notification-events/src/worker.ts` (line 94-123)  
**Issue:** Email not found returns WARN level; event silently skipped  
**Impact:** Customers don't know notifications were missed  
**Fix:** Fail job on missing email, emit alert
```typescript
const email = event.payload.data?.email || event.payload.to;
if (!email) {
  logger.error(`[CRITICAL] Email resolution failed for user ${event.userId}`);
  await emitMonitoringAlert('EMAIL_DELIVERY_FAILED', { userId: event.userId });
  throw new Error('Email address not found');
}
```

### BE-EVT-009: In-App Notification ObjectId Conversion Silent Failure
**File:** `rez-notification-events/src/worker.ts` (line 218-223)  
**Issue:** Invalid userId stored as string instead of ObjectId; downstream queries fail  
**Impact:** In-app notifications lost; downstream services fail to find them  
**Fix:** Enforce strict ObjectId type
```typescript
let userId: ObjectId;
try {
  userId = new ObjectId(event.userId);
} catch (err) {
  logger.error('Invalid userId format', { userId: event.userId });
  throw new Error('Invalid user ID format');
}

await inAppNotifications.insert({
  userId, // Enforced as ObjectId
  ...event.payload,
});
```

### BE-EVT-010: Notification Channel Errors Don't Fail Job
**File:** `rez-notification-events/src/worker.ts` (line 299-307)  
**Issue:** Channel failures caught and logged; job completes successfully  
**Impact:** Failed notifications never retried; customers miss notifications  
**Fix:** Fail job on critical channel failures
```typescript
const results = [];
const criticalFailures = [];

try {
  // Process each channel
  results.push(await sendPush());
  results.push(await sendEmail());
} catch (err) {
  criticalFailures.push(err);
}

if (criticalFailures.length > 0) {
  throw new Error(`Critical channels failed: ${criticalFailures.map(e => e.message).join(', ')}`);
}
```

### BE-EVT-014: DLQ Unbounded Growth
**File:** `rez-notification-events/src/workers/dlqWorker.ts` (line 34-36)  
**Issue:** DLQ configured with `removeOnComplete: false`; jobs never cleaned up  
**Impact:** Database bloat; slow queries on large DLQ  
**Fix:** Implement cleanup job with archive strategy
```typescript
// DLQ Worker Configuration
const dlqQueue = new Queue('notification-events-dlq', {
  removeOnComplete: { age: 2592000 }, // 30 days
  removeOnFail: false, // Keep failures for audit
});

// Separate cleanup job
schedule('0 2 * * *', async () => { // 2 AM daily
  const oldDLQEntries = await DLQLog.find({
    createdAt: { $lt: new Date(Date.now() - 90 * 86400000) } // 90 days
  });
  
  await DLQLog.deleteMany({ _id: { $in: oldDLQEntries.map(e => e._id) } });
  logger.info(`Cleaned up ${oldDLQEntries.length} old DLQ entries`);
});
```

### BE-EVT-029: Missing Centralized Event Schemas
**File:** All event worker files  
**Issue:** No Zod schemas for event validation; type-only at compile time  
**Impact:** Invalid events silently processed; runtime errors downstream  
**Fix:** Create centralized schema definitions
```typescript
// src/schemas/index.ts
export const EventSchemas = {
  NotificationEvent: z.object({
    userId: z.string().min(24),
    channels: z.array(z.enum(['push', 'email', 'sms', 'inapp'])),
    payload: z.object({
      title: z.string().max(200),
      data: z.record(z.any()),
    }),
  }),

  MediaEvent: z.object({
    entityId: z.string().min(24),
    imageUrl: z.string().url(),
    formats: z.array(z.enum(['thumbnail', 'medium', 'large'])),
  }),

  AnalyticsEvent: z.object({
    userId: z.string().min(24),
    eventType: z.string(),
    eventId: z.string().uuid(),
    createdAt: z.string().datetime(),
    data: z.object({
      amount: z.number().nonnegative().optional(),
    }),
  }),
};

// Validate at queue entry
queue.process(async (job) => {
  const validated = EventSchemas.NotificationEvent.parse(job.data);
  // ... process
});
```

### BE-EVT-030: Partial Channel Failures Not Differentiated
**File:** `rez-notification-events/src/worker.ts` (line 274-329)  
**Issue:** All channels weighted equally; push optional but email critical  
**Impact:** Missing email notification treated same as missing push  
**Fix:** Implement channel priority
```typescript
const CHANNEL_PRIORITY = {
  email: 'critical',
  push: 'important',
  sms: 'optional',
  inapp: 'optional',
};

const results = {
  critical: [],
  important: [],
  optional: [],
};

// Process each channel
for (const [channel, priority] of Object.entries(CHANNEL_PRIORITY)) {
  try {
    const result = await send[channel](event);
    results[priority].push({ channel, status: result });
  } catch (err) {
    results[priority].push({ channel, status: 'failed', error: err.message });
  }
}

// Fail job only if critical channels failed
if (results.critical.some(r => r.status === 'failed')) {
  throw new Error('Critical notification channels failed');
}
```

---

## TIER 3: ORDER SERVICE (BE-ORD) - 7 MEDIUM BUGS

### BE-ORD-006: Missing Concurrent Update Logging
**Issue:** Concurrent status update conflicts not audited  
**Fix:** Log conflict at WARN level with both states
```typescript
const result = await Order.findOneAndUpdate(
  { _id: orderId, status: currentStatus },
  { $set: { status: newStatus, updatedAt: new Date() }, $push: { timeline: { status: newStatus, timestamp: new Date() } } },
  { new: true }
);

if (!result) {
  logger.warn('Order status update conflict', { orderId, expectedStatus: currentStatus, newStatus });
  return res.status(409).json({ error: 'Order status changed concurrently' });
}
```

### BE-ORD-012: Missing Timeline Entries on Status Changes
**Issue:** Audit trail incomplete; no history of all status transitions  
**Fix:** Push timeline entry for every status change
```typescript
$push: { timeline: { status: newStatus, timestamp: new Date(), userId: req.authUser.userId, reason } }
```

### BE-ORD-013: SSE Change Stream Fallback Missing Healthcheck
**Issue:** MongoDB connection misconfiguration causes silent polling failures  
**Fix:** Return 503 if both change stream and polling unavailable
```typescript
async initializeSSE() {
  try {
    await this.setupChangeStream();
  } catch (err) {
    logger.warn('Change stream unavailable, falling back to polling', err);
    await this.setupPolling();
    
    // Health check to verify polling is actually working
    const pollHealth = await this.checkPollingHealth();
    if (!pollHealth) {
      logger.error('Both change stream and polling unavailable');
      res.status(503).json({ error: 'Order service temporarily unavailable' });
    }
  }
}
```

### BE-ORD-014: Missing Order Version Field for Optimistic Locking
**Issue:** Concurrent updates use status-based locking; second write silently overwrites  
**Fix:** Add version field and condition updates on version match
```typescript
// Schema
const order = {
  _id: ObjectId,
  status: String,
  version: { type: Number, default: 0 },
  // ...
};

// Update
const result = await Order.findOneAndUpdate(
  { _id: orderId, version: currentVersion },
  { $set: { status: newStatus }, $inc: { version: 1 } },
  { new: true }
);

if (!result) {
  return res.status(409).json({ error: 'Order was modified; please refresh and retry' });
}
```

### BE-ORD-015: Pagination Bounds Not Validated
**Issue:** Negative or zero page/limit values can slip through  
**Fix:** Validate before parsing
```typescript
const page = Math.max(1, parseInt(req.query.page) || 1);
const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
if (!Number.isFinite(page) || !Number.isFinite(limit)) {
  return res.status(400).json({ error: 'Invalid pagination parameters' });
}
```

### BE-ORD-018: Timezone Handling in Date Ranges
**Issue:** 30-day window calculated in UTC, not user timezone  
**Fix:** Accept timezone parameter, convert before math
```typescript
const tz = req.query.timezone || 'UTC';
const startDate = moment.tz(tz).subtract(30, 'days').startOf('day').toDate();
const endDate = moment.tz(tz).endOf('day').toDate();
```

### BE-ORD-021: Settlement Retry Policy Missing Backoff Cap
**Issue:** Exponential backoff uncapped; final retry 24+ hours later  
**Fix:** Add backoff cap
```typescript
const queue = new BullMQ.Queue('settlements', {
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000, maxDelay: 300000 } // Cap at 5 min
  }
});
```

---

## TIER 4: AUTH SERVICE (BE-AUTH) - 7 MEDIUM BUGS

### BE-AUTH-001: OTP Verification Returns Boolean Without Context
**File:** `rez-auth-service/src/routes/authRoutes.ts:114`  
**Issue:** Boolean return makes it impossible to distinguish error reasons  
**Fix:** Return detailed error object
```typescript
interface OTPVerificationResult {
  success: boolean;
  reason?: 'expired' | 'invalid' | 'locked' | 'attempts_exceeded';
  attemptsRemaining?: number;
}

// Return instead of boolean
return {
  success: false,
  reason: 'locked',
  message: 'Too many failed attempts. Try again in 15 minutes.'
};
```

### BE-AUTH-004: OTP Rate Limiting Doesn't Account for Country Code
**Issue:** Different formats bypass rate limiting  
**Fix:** Normalize phone number in middleware
```typescript
// Middleware to normalize phone
app.use((req, res, next) => {
  if (req.body.phone) {
    req.body.phone = normalizePhoneNumber(req.body.phone);
  }
  next();
});

function normalizePhoneNumber(phone: string): string {
  // Remove all non-digits and +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // Ensure starts with + if not already
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  
  return normalized;
}
```

### BE-AUTH-009: Device Hash Not Normalized for User-Agent
**Issue:** Browser minor version changes trigger new device hash  
**Fix:** Normalize user-agent to major version only
```typescript
function computeFingerprint(headers: Record<string, any>): string {
  const userAgent = headers['user-agent'] || '';
  
  // Extract major version only, remove build info
  const majorVersion = userAgent.replace(/(\.\d+)+(?=\))/g, '');
  
  return crypto
    .createHash('sha256')
    .update(majorVersion + headers['accept-language'] + headers['x-forwarded-for'])
    .digest('hex');
}
```

### BE-AUTH-012: PIN Format Validation Accepts Unexpected Formats
**Issue:** `String(pin)` allows non-numeric submissions  
**Fix:** Validate format first
```typescript
const pinStr = String(req.body.pin);
if (!/^\d{4,6}$/.test(pinStr)) {
  return res.status(400).json({
    error: 'Invalid PIN format. Must be 4-6 digits.'
  });
}

const isValid = await bcrypt.compare(pinStr, user.pinHash);
```

### BE-AUTH-017: Refresh Token Rotation Concurrent Request Handling
**Issue:** Second concurrent request gets 'token already used' error  
**Fix:** Return specific error indicating concurrency, not replay
```typescript
const result = await redis.set(revokedKey, '1', 'NX');
if (!result) {
  return res.status(409).json({
    error: 'REFRESH_TOKEN_ROTATED_IN_ANOTHER_REQUEST',
    message: 'Your refresh token was already rotated in another request. Please use the new token from that request.',
  });
}
```

### BE-AUTH-024: Email Verification Token Consumed on Failure
**Issue:** Redis token deleted before MongoDB write; user can't retry  
**Fix:** Delete token after successful MongoDB write
```typescript
// Reorder: verify first, delete second
const updatedUser = await User.findByIdAndUpdate(user._id, { 'auth.emailVerified': true });

if (!updatedUser) {
  throw new Error('Failed to verify email in database');
}

// Only delete token after successful database update
await redis.del(tokenKey);
```

### BE-AUTH-029: Profile Update Rate Limiting
**Issue:** No per-field rate limiting; can spam updates 30/min  
**Fix:** Add per-field rate limiting
```typescript
// Extend rate limiter with field-specific checks
async function checkProfileFieldRateLimit(userId: string, field: string) {
  const key = `profile-update:${userId}:${field}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 3600); // 1 hour window
  }
  
  const maxUpdates = 5; // Per field per hour
  if (count > maxUpdates) {
    throw new Error(`Too many updates to ${field}. Max ${maxUpdates} per hour.`);
  }
}
```

---

## TIER 5: PAYMENT SERVICE (BE-PAY) - 5 MEDIUM BUGS

### BE-PAY-003: Amount Precision Validation Missing
**File:** `rez-payment-service/src/routes/paymentRoutes.ts:11-20`  
**Issue:** Accepts floats with arbitrary decimals; causes mismatch with Razorpay  
**Fix:** Enforce 2 decimal places
```typescript
const initiateSchema = z.object({
  amount: z.number()
    .positive()
    .finite()
    .max(500000)
    .refine(
      (val) => val === Math.round(val * 100) / 100,
      'Amount must have at most 2 decimal places (paise precision)'
    ),
});
```

### BE-PAY-004: Idempotency Key Uniqueness Allows Concurrent Dupes
**Issue:** Sparse unique index allows documents without key to bypass constraint  
**Fix:** Add compound unique index on (orderId, status)
```typescript
// In Payment schema
paymentSchema.index(
  { orderId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'processing'] } } }
);

// Or require idempotency key on all calls
const initiateSchema = z.object({
  idempotencyKey: z.string().uuid(), // Required, not optional
  // ...
});
```

### BE-PAY-010: Concurrency Lock TTL Too Short
**Issue:** 10-second TTL insufficient for slow Razorpay; allows duplicate orders  
**Fix:** Increase TTL to match expected operation duration
```typescript
const INIT_LOCK_TTL_MS = 30000; // 30 seconds (exceeds max axios timeout)
const lock = await redis.set(lockKey, '1', 'EX', Math.ceil(INIT_LOCK_TTL_MS / 1000), 'NX');
```

### BE-PAY-014: Payment Initiation Rate Limiting Missing
**Issue:** No per-user throttle; attacker can spam initiate requests  
**Fix:** Add per-user rate limiting
```typescript
async function checkPaymentInitiateRateLimit(userId: string) {
  const key = `payment-initiate:${userId}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 60); // 1-minute window
  }
  
  const maxRequests = 10; // Per minute per user
  if (count > maxRequests) {
    throw new HttpError(429, 'Too many payment initiation requests. Please wait before trying again.');
  }
}
```

### BE-PAY-021: Receipt Generation Not Idempotent
**Issue:** `crypto.randomBytes()` for receipt generation; duplicate initiate requests create different receipts  
**Fix:** Derive receipt from stable source
```typescript
// Instead of random
receipt || `rcpt_${crypto.randomBytes(8).toString('hex')}`

// Use deterministic derivation
receipt || `rcpt_${orderId.substring(0, 16)}`
```

---

## TIER 6: CATALOG SERVICE (BE-CAT) - 4 MEDIUM BUGS

### BE-CAT-002: Pagination Input Validation Missing
**Issue:** `Math.min/max` on NaN values from failed parseInt  
**Fix:** Validate parseInt result before Math functions
```typescript
const page = parseInt(req.query.page);
const limit = parseInt(req.query.limit);

if (!Number.isFinite(page) || !Number.isFinite(limit)) {
  return res.status(400).json({ error: 'Invalid pagination parameters' });
}

const validPage = Math.max(1, Math.min(page, 1000));
const validLimit = Math.max(1, Math.min(limit, 100));
```

### BE-CAT-003: ObjectId Validation Missing
**Issue:** Direct use of merchantId without validation; silent query failures  
**Fix:** Validate before querying
```typescript
if (!mongoose.isValidObjectId(merchantId)) {
  return res.status(400).json({ error: 'Invalid merchant ID format' });
}

const products = await Product.find({ merchant: merchantId });
```

### BE-CAT-015: Category Filter Missing ObjectId Validation
**Issue:** Category query parameter not validated; unexpected query behavior  
**Fix:** Add validation for category parameter
```typescript
if (category && !mongoose.isValidObjectId(category)) {
  return res.status(400).json({ error: 'Invalid category ID format' });
}

const filter = category ? { category } : {};
```

### BE-CAT-019: Cache Invalidation Race Condition
**Issue:** Sequential key deletion in loop; ordering non-deterministic  
**Fix:** Use atomic Redis operation
```typescript
// Instead of sequential deletes
for (const key of keys) {
  await redis.del(key);
}

// Use atomic pipeline
const pipeline = redis.pipeline();
keys.forEach(key => pipeline.del(key));
await pipeline.exec();
```

---

## TIER 7: MERCHANT SERVICE (BE-MER) - 7 MEDIUM BUGS

### BE-MER-007: Payout Amount Validation Missing
**Issue:** No upper bounds or decimal precision checks  
**Fix:** Validate amount ranges and precision
```typescript
const payoutSchema = z.object({
  amount: z.number()
    .positive()
    .finite()
    .max(999999999) // Max payout amount
    .refine(
      (val) => val === Math.round(val * 100) / 100,
      'Amount must be in valid currency format'
    ),
});
```

### BE-MER-009: Payout Merchant Ownership Check Missing
**Issue:** Delete operation doesn't verify merchant ownership  
**Fix:** Add ownership validation in filter
```typescript
const result = await Payout.findOneAndDelete({
  _id: payoutId,
  merchantId: req.merchantId,
  status: 'pending' // Can only delete pending payouts
});

if (!result) {
  return res.status(403).json({ error: 'Payout not found or not authorized' });
}
```

### BE-MER-020: Discount Usage Limit Enforcement Missing
**Issue:** usageLimit and perUserLimit fields not enforced at redemption  
**Fix:** Check limits before accepting discount
```typescript
async function validateDiscountRedemption(discountCode: string, userId: string) {
  const discount = await Discount.findOne({ code: discountCode });
  
  if (!discount) throw new Error('Discount not found');
  
  const usageCount = await DiscountUsage.countDocuments({ discountId: discount._id });
  if (discount.usageLimit && usageCount >= discount.usageLimit) {
    throw new Error('Discount usage limit exceeded');
  }
  
  const userUsageCount = await DiscountUsage.countDocuments({
    discountId: discount._id,
    userId
  });
  if (discount.perUserLimit && userUsageCount >= discount.perUserLimit) {
    throw new Error('You have reached the maximum uses for this discount');
  }
  
  return discount;
}
```

### BE-MER-021: Bulk Import SKU Deduplication Missing
**Issue:** Multiple products with same SKU accepted; inventory confusion  
**Fix:** Check for duplicates before insertion
```typescript
async function validateBulkImportSKUs(products: Product[], storeId: string) {
  const skus = products.map(p => p.sku);
  const uniqueSkus = new Set(skus);
  
  if (skus.length !== uniqueSkus.size) {
    throw new Error('Duplicate SKUs in batch');
  }
  
  const existingSkus = await Product.find({
    sku: { $in: skus },
    store: storeId
  });
  
  if (existingSkus.length > 0) {
    throw new Error(`SKUs already exist: ${existingSkus.map(p => p.sku).join(', ')}`);
  }
}
```

### BE-MER-023: Merchant Status Check Missing
**Issue:** Suspended merchants can still query orders  
**Fix:** Add merchant status check in auth middleware
```typescript
// In auth middleware
const merchant = await Merchant.findById(req.merchantId);
if (!merchant || !merchant.isActive) {
  return res.status(403).json({ error: 'Merchant account is not active' });
}
```

### BE-MER-024: Date Filter Validation Missing
**Issue:** Invalid ISO strings produce Invalid Date; queries fail  
**Fix:** Validate dates before using in queries
```typescript
const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;

if (dateFrom && isNaN(dateFrom.getTime())) {
  return res.status(400).json({ error: 'Invalid dateFrom format. Use ISO 8601.' });
}
if (dateTo && isNaN(dateTo.getTime())) {
  return res.status(400).json({ error: 'Invalid dateTo format. Use ISO 8601.' });
}
```

### BE-MER-034: Cache Errors Logged Silently
**Issue:** Empty catch blocks swallow errors; no visibility into cache failures  
**Fix:** Add error logging to all cache operations
```typescript
async function getCached(key: string, fallback: () => Promise<any>) {
  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    logger.warn('[Cache Error] Failed to get cached value', { key, error: err.message });
    return null; // Fallback to compute
  }
}
```

---

## SUMMARY BY SERVICE

### Recommended Fix Order
1. **SHARED** (10 MED) - Infrastructure fixes that unblock all services
2. **EVENTS** (8 MED) - Core event pipeline reliability
3. **ORDER** (7 MED) - State machine consistency
4. **AUTH** (7 MED) - Authentication security
5. **PAYMENT** (5 MED) - Payment safety
6. **MERCHANT** (7 MED) - Merchant operations
7. **CATALOG** (4 MED) - Catalog consistency

**Total: 48 MEDIUM bugs targeted**

### Commit Strategy
```
fix(shared) MED: Idempotency, validation, health checks, webhooks, jobs

- BE-SHR-003: Add try-catch to idempotency JSON parsing
- BE-SHR-007: Validate error path is array before join()
- BE-SHR-012: Execute test query in MongoDB health check
- BE-SHR-014: Add webhook signature constant-time verification
- BE-SHR-015: Wrap webhook delivery with timeout
- BE-SHR-016: Pass webhook config maxRetries to shouldRetry
- BE-SHR-017: Make job queue retention configurable
- BE-SHR-018: Add pre-check to job deduplication
- BE-SHR-020: Add TTL to email deduplication
- BE-SHR-021: Use idempotent jobId for webhooks

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

## IMPLEMENTATION STATUS

**Phase 7d Execution Plan:**
- [ ] Implement SHARED library fixes (10 bugs)
- [ ] Implement EVENTS service fixes (8 bugs)
- [ ] Implement ORDER service fixes (7 bugs)
- [ ] Implement AUTH service fixes (7 bugs)
- [ ] Implement PAYMENT service fixes (5 bugs)
- [ ] Implement MERCHANT service fixes (7 bugs)
- [ ] Implement CATALOG service fixes (4 bugs)
- [ ] Update docs with completion status
- [ ] Verify no test failures
- [ ] Commit per service with proper attribution

**Total Target: 48 MEDIUM bugs fixed**

---

**Last Updated:** 2026-04-15  
**Phase Status:** Ready for staged implementation
