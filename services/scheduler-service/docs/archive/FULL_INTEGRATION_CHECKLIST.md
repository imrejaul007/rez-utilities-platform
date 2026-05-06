# Full Integration Checklist — Production Deployment

**Status:** All utilities ready for integration  
**Date:** April 7, 2026  
**Scope:** Step-by-step integration across all services

---

## Phase 1: Dependency Installation

### All Services
```bash
npm install \
  zod \
  express-rate-limit \
  rate-limit-redis \
  isomorphic-dompurify \
  bullmq \
  axios \
  uuid \
  @aws-sdk/client-secrets-manager \
  crypto-js

npm install --save-dev @types/express-rate-limit @types/uuid
```

---

## Phase 2: Copy Utilities to rez-shared

### Create `rez-shared/src/` Structure

```bash
# Ensure directory exists
mkdir -p rez-shared/src/{middleware,schemas,queue,webhook,utils}

# Copy all utility files:
cp docs/utilities/errorHandler.ts rez-shared/src/middleware/
cp docs/utilities/requestLogger.ts rez-shared/src/middleware/
cp docs/utilities/sanitizer.ts rez-shared/src/middleware/
cp docs/utilities/rateLimiter.ts rez-shared/src/middleware/
cp docs/utilities/idempotency.ts rez-shared/src/middleware/
cp docs/utilities/healthCheck.ts rez-shared/src/middleware/
cp docs/utilities/validationSchemas.ts rez-shared/src/schemas/
cp docs/utilities/jobQueue.ts rez-shared/src/queue/
cp docs/utilities/webhookService.ts rez-shared/src/webhook/
cp docs/utilities/circuitBreaker.ts rez-shared/src/utils/
cp docs/utilities/secretsManager.ts rez-shared/src/utils/
```

### Update rez-shared package.json
```json
{
  "name": "rez-shared",
  "version": "1.0.0",
  "exports": {
    "./middleware": "./src/middleware/",
    "./schemas": "./src/schemas/",
    "./queue": "./src/queue/",
    "./webhook": "./src/webhook/",
    "./utils": "./src/utils/"
  }
}
```

---

## Phase 3: Monolith (rezbackend) Integration

### 3.1: Update server.ts

**File:** `rezbackend/rez-backend-master/src/server.ts`

```typescript
// Add near top of file after imports
import { setupProductionMiddleware, attachGlobalErrorHandler } from './config/productionMiddleware';

// In startServer() function, after setupMiddleware(app):
export async function startServer() {
  // ... existing code ...
  
  // OLD: setupMiddleware(app);
  
  // NEW: Setup all production utilities
  setupProductionMiddleware(app, {
    redis: await redisService.getClient(),
    mongoose: mongooseInstance,
  });

  // Register routes (keep existing)
  registerRoutes(app);

  // Attach global error handler (AFTER routes)
  attachGlobalErrorHandler(app);

  // ... rest of code ...
}
```

### 3.2: Update Order Routes

**File:** `rezbackend/rez-backend-master/src/routes/orders.ts`

```typescript
import { createOrderSchema, validateRequest } from '@/schemas/validationSchemas';
import { asyncHandler, AppError, ValidationError } from '@/middleware/errorHandler';
import { sanitizeAddress } from '@/middleware/sanitizer';

const router = Router();
const app = request.app; // from Express context
const rateLimiters = (app as any).rateLimiters;

/**
 * POST /api/orders
 */
router.post(
  '/',
  rateLimiters.order, // Rate limit: 5 orders/min
  validateRequest(createOrderSchema), // Validate request
  asyncHandler(async (req, res) => {
    const { deliveryAddress, paymentMethod, idempotencyKey } = req.validatedBody;
    const userId = req.userId!;

    // Validate address
    try {
      const address = sanitizeAddress(deliveryAddress);
    } catch (error) {
      throw new ValidationError('Invalid address', {
        address: (error as Error).message,
      });
    }

    // Create order (existing logic)
    const order = await createOrderLogic(...);

    // Response will be automatically cached by idempotency middleware
    res.status(201).json({ order });
  })
);

export default router;
```

### 3.3: Update Merchant Routes

**File:** `rezbackend/rez-backend-master/src/merchantroutes/` (all status update routes)

```typescript
import { isValidMerchantTransition } from '@/utils/orderStateMachine';
import { asyncHandler, AppError } from '@/middleware/errorHandler';

router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);

    // Use state machine enforcement
    if (!isValidMerchantTransition(order.status, status)) {
      throw new AppError(
        `Invalid transition: ${order.status} → ${status}`,
        400,
        'INVALID_TRANSITION'
      );
    }

    // Update order
    const updated = await Order.findByIdAndUpdate(...);
    res.json({ data: updated });
  })
);
```

---

## Phase 4: Merchant-Service Integration

### 4.1: Setup File

**File:** `rez-merchant-service/src/config/productionMiddleware.ts`

Copy from monolith and update Redis connection details

### 4.2: Update Orders Routes

**File:** `rez-merchant-service/src/routes/orders.ts`

```typescript
import { updateOrderStatusSchema, validateRequest } from '@/schemas/validationSchemas';
import { isValidMerchantTransition } from '@/utils/orderStateMachine';
import { asyncHandler, AppError } from '@/middleware/errorHandler';

const router = Router();
const app = request.app;
const rateLimiters = (app as any).rateLimiters;

router.patch(
  '/:id/status',
  rateLimiters.status, // Rate limit: 60 updates/min
  validateRequest(updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const { status, note } = req.validatedBody;
    const order = await Order.findById(req.params.id);

    if (!isValidMerchantTransition(order.status, status)) {
      const allowed = getMerchantNextStatuses(order.status);
      throw new AppError(`Invalid transition`, 400, 'INVALID_TRANSITION', {
        currentStatus: order.status,
        validNextStatuses: allowed,
      });
    }

    const updated = await Order.findByIdAndUpdate(req.params.id, {
      $set: { status },
      $push: { statusHistory: { status, timestamp: new Date(), note } },
    }, { new: true });

    res.json({ data: updated });
  })
);
```

---

## Phase 5: Order-Service Integration

### 5.1: Setup

Copy productionMiddleware.ts and attach to Express app

### 5.2: Update Order Routes

Apply same pattern as merchant-service for status updates

---

## Phase 6: Job Queue Setup

### All Services

**File:** `src/config/jobQueues.ts`

```typescript
import { JobQueueService } from '@/queue/jobQueue';
import { RedisClient } from 'redis';

export async function initializeJobQueues(redis: RedisClient) {
  const jobs = new JobQueueService(redis);

  // Setup processors
  jobs.setupProcessors({
    email: async (job) => {
      // Implementation: send email via SendGrid, SMTP, etc.
    },
    sms: async (job) => {
      // Implementation: send SMS via Twilio, Nexmo, etc.
    },
    push: async (job) => {
      // Implementation: send push via Firebase, OneSignal, etc.
    },
    webhook: async (job) => {
      // Implementation: call external webhooks
    },
    order: async (job) => {
      // Implementation: process orders, update inventory, etc.
    },
  });

  return jobs;
}
```

**In server.ts:**
```typescript
// After Redis ready
const jobQueues = await initializeJobQueues(redis);
(app as any).jobQueues = jobQueues;
```

---

## Phase 7: Webhook Setup

### All Services

**File:** `src/config/webhooks.ts`

```typescript
import { WebhookService } from '@/webhook/webhookService';
import { RedisClient } from 'redis';
import { JobQueue } from '@/queue/jobQueue';

export async function initializeWebhooks(
  redis: RedisClient,
  jobQueue: JobQueue
) {
  const webhookService = new WebhookService(redis, jobQueue);

  // Setup webhook processor
  jobQueue.process(async (job) => {
    const { webhookId, event, payload, attempt } = job.data;
    await webhookService.deliver(webhookId, event, payload, attempt);
  });

  return webhookService;
}
```

**In server.ts:**
```typescript
const webhookService = await initializeWebhooks(redis, jobQueues.webhookQueue);
(app as any).webhookService = webhookService;
```

---

## Phase 8: Secrets Management

### All Services

**File:** `src/config/secrets.ts`

```typescript
import { SecretsManager, auditSecrets, SECRET_KEYS } from '@/utils/secretsManager';

export async function initializeSecrets() {
  const secretsManager = new SecretsManager(
    process.env.SECRETS_SOURCE || 'env', // env, aws, vault
    redis
  );

  // Audit on startup
  await auditSecrets(secretsManager, [
    SECRET_KEYS.RAZORPAY_KEY_ID,
    SECRET_KEYS.RAZORPAY_KEY_SECRET,
    SECRET_KEYS.JWT_SECRET,
    // ... add required secrets
  ]);

  return secretsManager;
}
```

**In server.ts:**
```typescript
const secretsManager = await initializeSecrets();
(app as any).secretsManager = secretsManager;
```

---

## Phase 9: Circuit Breakers

### All Services

**File:** `src/config/circuitBreakers.ts`

```typescript
import {
  createRedisCircuitBreaker,
  createDatabaseCircuitBreaker,
  createHttpCircuitBreaker,
} from '@/utils/circuitBreaker';

export function initializeCircuitBreakers() {
  return {
    redis: createRedisCircuitBreaker(
      async () => redis.ping(),
      'Redis'
    ),
    database: createDatabaseCircuitBreaker(
      async () => mongoose.connection.db?.admin().ping(),
      'Database'
    ),
    externalApi: createHttpCircuitBreaker(
      async () => axios.get('https://external-api.com/health'),
      'ExternalAPI'
    ),
  };
}
```

---

## Phase 10: Environment Variables

### .env File

```env
# Services
NODE_ENV=production
PORT=3000
API_PREFIX=/api

# Database
MONGODB_URI=mongodb://...
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=...

# Secrets Management
SECRETS_SOURCE=env  # or 'aws', 'vault'
AWS_REGION=us-east-1
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=...

# Rate Limiting
RATE_LIMIT_ORDER_MAX=5
RATE_LIMIT_STATUS_MAX=60
RATE_LIMIT_OFFER_MAX=10

# Idempotency
IDEMPOTENCY_TTL=3600

# Job Queue
JOB_QUEUE_CONCURRENCY=4
JOB_QUEUE_MAX_RETRIES=5

# Webhooks
WEBHOOK_TIMEOUT=10000
WEBHOOK_RETRY_POLICY=exponential

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Logging
LOG_LEVEL=info

# Payment Gateway
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...

# Email
SENDGRID_API_KEY=...

# SMS
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
```

---

## Integration Testing Checklist

### Unit Tests
- [ ] Error handler tests
- [ ] Validation schema tests
- [ ] Sanitizer tests
- [ ] Rate limiter tests
- [ ] Circuit breaker tests
- [ ] Idempotency tests

### Integration Tests
- [ ] Order creation with validation
- [ ] Status updates with state machine
- [ ] Rate limiting enforcement
- [ ] Idempotency key handling
- [ ] Job queue processing
- [ ] Webhook delivery and retries
- [ ] Circuit breaker fallback

### Load Tests
- [ ] 100 concurrent order creations
- [ ] 50 concurrent status updates
- [ ] 1000 KDS updates per second
- [ ] Webhook delivery under load

### Security Tests
- [ ] XSS prevention (sanitizer)
- [ ] Rate limiting bypasses
- [ ] Idempotency key validation
- [ ] Webhook signature verification

---

## Deployment Steps

### 1. Pre-Deployment (Staging)
```bash
# Install dependencies
npm install

# Copy utilities to rez-shared
npm run build:shared

# Run tests
npm test
npm run test:integration
npm run test:load

# Deploy to staging
npm run deploy:staging
```

### 2. Staging Validation (24 hours)
- [ ] Health checks passing
- [ ] Order creation working
- [ ] Status updates working
- [ ] Rate limiting working
- [ ] Job queue processing
- [ ] Webhooks delivering
- [ ] Error handling consistent
- [ ] Logs structured correctly

### 3. Production Deployment
```bash
# Tag release
git tag -a v2.0.0 -m "Production utilities integration"

# Deploy to production
npm run deploy:production

# Monitor health checks
watch /health
watch /health/ready
watch /metrics
```

### 4. Post-Deployment Monitoring
- [ ] Error rate <0.1%
- [ ] Latency p99 <500ms
- [ ] Order throughput ≥50/min
- [ ] Queue processing working
- [ ] Webhook success rate >95%
- [ ] Circuit breakers not open

---

## Rollback Plan

If issues arise during production deployment:

```bash
# Immediate rollback
git revert <commit-hash>
npm run deploy:production

# Or switch to previous healthy version
docker pull my-registry/rezbackend:latest-stable
docker run ...
```

### What to Check During Rollback
- [ ] Health checks passing
- [ ] Orders being created
- [ ] No error spikes
- [ ] Database connection stable
- [ ] Redis connection stable

---

## Success Metrics

| Metric | Target | How to Monitor |
|---|---|---|
| Order creation success rate | >99% | /metrics endpoint |
| Error response standardization | 100% | Log review |
| XSS attacks blocked | 100% | Security testing |
| Duplicate orders prevented | 100% | Audit logs |
| Rate limit enforcement | 100% | Request logs |
| Webhook success rate | >95% | Webhook logs |
| Circuit breaker effectiveness | <1% false positives | Monitor opens |

---

## Support & Troubleshooting

### Common Issues & Fixes

**Issue: Rate limiting too aggressive**
- Solution: Adjust limits in .env or via code
- Monitor: Check rate limit logs

**Issue: Job queue backing up**
- Solution: Increase concurrency in config
- Monitor: Check queue.getStatus() output

**Issue: Webhook delivery failing**
- Solution: Check target URL accessibility
- Monitor: Check webhook delivery logs

**Issue: Error responses not standardized**
- Solution: Ensure globalErrorHandler is attached
- Monitor: Check response format in logs

---

## Timeline

- **Week 1:** Dependency installation + utility setup
- **Week 2:** Monolith integration + testing
- **Week 3:** Merchant-service integration + load testing
- **Week 4:** Order-service integration + production deployment

**Estimated Total Time:** 4 weeks for full integration across all services

---

## Files Modified/Created

### New Files
```
rez-shared/src/
├── middleware/ (6 files)
├── schemas/ (1 file)
├── queue/ (1 file)
├── webhook/ (1 file)
└── utils/ (2 files)

rezbackend/src/config/
└── productionMiddleware.ts (NEW)

rez-merchant-service/src/config/
└── productionMiddleware.ts (NEW)

All services:
├── config/jobQueues.ts (NEW)
├── config/webhooks.ts (NEW)
├── config/secrets.ts (NEW)
├── config/circuitBreakers.ts (NEW)
```

### Modified Files
```
rezbackend/src/
├── server.ts (UPDATED)
└── routes/orders.ts (UPDATED)

rez-merchant-service/src/
├── index.ts or server.ts (UPDATED)
└── routes/orders.ts (UPDATED)

All .env files (UPDATED)
```

---

## Completion Checklist

- [ ] All dependencies installed
- [ ] Utilities copied to rez-shared
- [ ] Monolith middleware integrated
- [ ] Merchant-service middleware integrated
- [ ] Order-service middleware integrated
- [ ] Job queues configured
- [ ] Webhooks configured
- [ ] Secrets management configured
- [ ] Circuit breakers configured
- [ ] Environment variables set
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Load tests passed
- [ ] Staging deployment successful
- [ ] 24-hour staging validation complete
- [ ] Production deployment successful
- [ ] Production monitoring configured
- [ ] Success metrics verified

---

**Status: Ready for Production Deployment** ✅🚀
