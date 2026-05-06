# Quick Start: Using rez-shared Utilities

All production-ready utilities are available from `rez-shared` in the root directory of the REZ monorepo.

## Setup in Your Service

### 1. TypeScript Path Configuration

Ensure your `tsconfig.json` has these paths configured:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "rez-shared": ["../rez-shared/src"],
      "rez-shared/*": ["../rez-shared/src/*"]
    }
  }
}
```

### 2. Import Utilities

#### Error Handling
```typescript
import { AppError, ValidationError, asyncHandler, globalErrorHandler } from 'rez-shared/middleware';

// In route handler
router.post('/orders', asyncHandler(async (req, res) => {
  if (!req.body.items) {
    throw new ValidationError('Missing items', { items: 'Required' });
  }
  // Handle request
}));

// In server.ts (AFTER all routes)
app.use(globalErrorHandler);
```

#### Input Validation (Zod)
```typescript
import { createOrderSchema, validateRequest } from 'rez-shared/schemas';

router.post('/orders', 
  validateRequest(createOrderSchema),
  asyncHandler(async (req, res) => {
    const order = req.validatedBody; // Type-safe, pre-validated
    // Handle request
  })
);
```

#### Input Sanitization
```typescript
import { sanitizeInputs } from 'rez-shared/middleware';

app.use(sanitizeInputs); // XSS prevention
```

#### Rate Limiting
```typescript
import { 
  createOrderRateLimiter, 
  createStatusUpdateRateLimiter,
  createOfferRateLimiter 
} from 'rez-shared/middleware';

const orderLimiter = createOrderRateLimiter(redis);
const statusLimiter = createStatusUpdateRateLimiter(redis);

router.post('/orders', orderLimiter, ...);
router.patch('/orders/:id/status', statusLimiter, ...);
```

#### Idempotency Keys
```typescript
import { idempotencyMiddleware } from 'rez-shared/middleware';

app.use(idempotencyMiddleware(redis)); // Prevents duplicate operations
```

#### Circuit Breakers
```typescript
import { 
  createRedisCircuitBreaker,
  createHttpCircuitBreaker,
  createDatabaseCircuitBreaker
} from 'rez-shared/utils';

const redisBreaker = createRedisCircuitBreaker(
  async () => redis.ping(),
  'Redis'
);

// Use in service
try {
  await redisBreaker.call();
} catch {
  // Use fallback
}
```

#### Secrets Management
```typescript
import { SecretsManager, SECRET_KEYS, auditSecrets } from 'rez-shared/utils';

const secretsManager = new SecretsManager(
  process.env.SECRETS_SOURCE || 'env', // env, aws, vault
  redis // optional for audit logging
);

// Get a secret
const apiKey = await secretsManager.get('razorpay-key-id');

// Validate required secrets on startup
await auditSecrets(secretsManager, [
  SECRET_KEYS.RAZORPAY_KEY_ID,
  SECRET_KEYS.JWT_SECRET,
]);
```

#### Health Checks
```typescript
import { attachHealthChecks } from 'rez-shared/middleware';

attachHealthChecks(app, { redis, mongoose });

// Endpoints available:
// GET /health/live (liveness)
// GET /health/ready (readiness with dependency checks)
// GET /health/startup (startup probe)
// GET /metrics (Prometheus format)
```

#### Request Logging & Tracing
```typescript
import { requestLogger, attachLogger } from 'rez-shared/middleware';

app.use(requestLogger); // Generates correlation IDs
app.use(attachLogger);  // Attaches logger to requests

// In route handlers
req.logger?.info('Processing order', { orderId: order.id });
```

#### Job Queue (Message Queue)
```typescript
import { JobQueueService } from 'rez-shared/queue';

const jobQueue = new JobQueueService(redis);

// Setup processors
jobQueue.setupProcessors({
  email: async (job) => {
    // Send email
  },
  sms: async (job) => {
    // Send SMS
  },
  webhook: async (job) => {
    // Call webhook
  },
});

// Queue a job
await jobQueue.add({ type: 'email', to: 'user@example.com' });

// Get queue status
const status = await jobQueue.getStatus();
```

#### Webhooks
```typescript
import { WebhookService } from 'rez-shared/webhook';

const webhookService = new WebhookService(redis, jobQueue);

// Register webhook
await webhookService.register(
  merchantId,
  'https://example.com/webhooks',
  ['order.created', 'order.delivered']
);

// Trigger event (notifies all subscribed merchants)
await webhookService.trigger('order.created', { orderId: '123' });

// Get delivery stats
const stats = await webhookService.getStats(webhookId);
```

## Environment Variables

### For Secrets Management
```env
# Source: env, aws, vault
SECRETS_SOURCE=env

# AWS (if SECRETS_SOURCE=aws)
AWS_REGION=us-east-1

# HashiCorp Vault (if SECRETS_SOURCE=vault)
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=s.xxxxx
```

### For Rate Limiting
```env
RATE_LIMIT_ORDER_MAX=5        # Orders per minute
RATE_LIMIT_STATUS_MAX=60      # Status updates per minute
RATE_LIMIT_OFFER_MAX=10       # Offers per hour
RATE_LIMIT_AUTH_MAX=5         # Auth attempts per 15 min
```

### For Idempotency
```env
IDEMPOTENCY_TTL=3600          # Cache TTL in seconds (1 hour)
```

### For Circuit Breaker
```env
CIRCUIT_BREAKER_THRESHOLD=50   # Failure percentage threshold
CIRCUIT_BREAKER_RESET=30000    # Reset timeout in ms
```

### For Job Queue
```env
JOB_QUEUE_CONCURRENCY=4        # Parallel job processors
JOB_QUEUE_MAX_RETRIES=5        # Max retry attempts
```

### For Webhooks
```env
WEBHOOK_TIMEOUT=10000          # Delivery timeout in ms
WEBHOOK_RETRY_POLICY=exponential # exponential or fixed
```

## File Organization Example

```typescript
// src/config/production.ts
import { 
  requestLogger, 
  sanitizeInputs,
  idempotencyMiddleware,
  createOrderRateLimiter 
} from 'rez-shared/middleware';

export function setupProduction(app: Express, redis: RedisClient) {
  app.use(requestLogger);
  app.use(sanitizeInputs);
  app.use(idempotencyMiddleware(redis));
  
  // Attach rate limiters to specific routes
  (app as any).rateLimiters = {
    order: createOrderRateLimiter(redis),
  };
}

// src/routes/orders.ts
import { asyncHandler } from 'rez-shared/middleware';
import { createOrderSchema, validateRequest } from 'rez-shared/schemas';

const orderLimiter = (req: Request, res: Response, next: NextFunction) => {
  const limiter = (req.app as any).rateLimiters.order;
  return limiter(req, res, next);
};

router.post('/',
  orderLimiter,
  validateRequest(createOrderSchema),
  asyncHandler(async (req, res) => {
    const order = req.validatedBody;
    // Process order
  })
);
```

## Verification Checklist

- [ ] rez-shared/package.json exists with exports
- [ ] rez-shared/src has middleware, schemas, queue, webhook, utils directories
- [ ] tsconfig.json has paths configured for rez-shared
- [ ] npm install runs without errors
- [ ] npm run build succeeds
- [ ] Imports resolve correctly: `import { ... } from 'rez-shared/middleware'`
- [ ] Runtime: Health checks work at /health/ready
- [ ] Runtime: Rate limiting blocks requests after limit
- [ ] Runtime: Validation errors return proper error codes

## Troubleshooting

### Import errors
```
Cannot find module 'rez-shared'
```
**Solution:** Check tsconfig.json paths are configured correctly

### Build failures
```
Error: Cannot find module '../rez-shared/src'
```
**Solution:** Ensure rez-shared directory exists and has proper structure

### Rate limiting not working
```
Check: redis.isReady() returns true
Check: middleware order (rate limiter must be before route handler)
```

### Validation not working
```
Check: validateRequest() middleware is applied to route
Check: Request Content-Type is application/json
```

## Next Steps

1. **Integrate** these utilities into your service routes
2. **Test** with unit and integration tests
3. **Deploy** to staging environment
4. **Monitor** health checks and metrics
5. **Configure** production environment variables

See [FULL_INTEGRATION_CHECKLIST.md](../FULL_INTEGRATION_CHECKLIST.md) for complete deployment guide.
