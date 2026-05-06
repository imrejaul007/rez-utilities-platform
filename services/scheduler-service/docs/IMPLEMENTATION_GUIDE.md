# Implementation Guide — Production-Ready Utilities

This guide shows how to integrate the new production-ready utilities into your services.

## Overview of New Utilities

**Created in `rez-shared/src/`:**

1. ✅ **middleware/errorHandler.ts** — Standardized error handling
2. ✅ **middleware/requestLogger.ts** — Structured logging with correlation IDs
3. ✅ **middleware/sanitizer.ts** — Input sanitization & validation
4. ✅ **middleware/rateLimiter.ts** — Rate limiting with Redis
5. ✅ **middleware/idempotency.ts** — Idempotency key handling
6. ✅ **middleware/healthCheck.ts** — Health check endpoints
7. ✅ **schemas/validationSchemas.ts** — Zod validation schemas
8. ✅ **utils/circuitBreaker.ts** — Circuit breaker pattern

---

## Integration Steps

### Step 1: Update Your Express App Entry Point

**File:** `src/index.ts` or `src/server.ts`

```typescript
import express from 'express';
import mongoose from 'mongoose';
import { createClient } from 'redis';

// Import new utilities
import { requestLogger, attachLogger } from '@/middleware/requestLogger';
import { sanitizeInputs } from '@/middleware/sanitizer';
import { globalErrorHandler, asyncHandler } from '@/middleware/errorHandler';
import { attachHealthChecks } from '@/middleware/healthCheck';
import { idempotencyMiddleware } from '@/middleware/idempotency';

// Initialize Redis
const redis = createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

await redis.connect();

const app = express();

// ========== MIDDLEWARE SETUP ==========

// 1. Request logging (must be first)
app.use(requestLogger);
app.use(attachLogger);

// 2. Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Input sanitization (before routes)
app.use(sanitizeInputs);

// 4. Idempotency (for mutation operations)
app.use(idempotencyMiddleware(redis));

// 5. Health checks
attachHealthChecks(app, { redis, mongoose });

// ========== ROUTES ==========

// Your existing routes here
app.use('/api/orders', ordersRouter);
app.use('/api/merchants', merchantRouter);

// ========== ERROR HANDLING ==========

// Global error handler (must be last)
app.use(globalErrorHandler);

// ========== SERVER START ==========

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

### Step 2: Update Order Creation Route

**File:** `src/routes/orders.ts`

```typescript
import { Router } from 'express';
import { createOrderSchema, validateRequest } from '@/schemas/validationSchemas';
import { createOrderRateLimiter } from '@/middleware/rateLimiter';
import { asyncHandler, AppError, ValidationError } from '@/middleware/errorHandler';
import { sanitizeAddress } from '@/middleware/sanitizer';

const router = Router();

// Middleware: rate limiting + validation
const orderLimiter = createOrderRateLimiter(redis);
const validateCreateOrder = validateRequest(createOrderSchema);

/**
 * POST /api/orders
 * Create a new order with full validation and rate limiting
 */
router.post(
  '/',
  orderLimiter, // Rate limit: 5 orders per minute
  validateCreateOrder, // Validate request body
  asyncHandler(async (req, res) => {
    const { deliveryAddress, paymentMethod, couponCode, idempotencyKey } = req.validatedBody;
    const userId = req.userId!;

    // Sanitize address
    try {
      const sanitizedAddress = sanitizeAddress(deliveryAddress);
    } catch (error) {
      throw new ValidationError('Invalid delivery address', {
        address: (error as Error).message,
      });
    }

    // Check idempotency (now handled by middleware, but can also check manually)
    const existingOrder = await Order.findOne({
      user: userId,
      idempotencyKey,
    });

    if (existingOrder) {
      return res.json({ order: existingOrder });
    }

    // Create order
    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      user: userId,
      deliveryAddress: sanitizedAddress,
      paymentMethod,
      status: 'placed',
      idempotencyKey,
      // ... other fields
    });

    // Idempotency middleware will cache this response
    res.status(201).json({ order });
  })
);

export default router;
```

---

### Step 3: Update Merchant Status Update Route

**File:** `rez-merchant-service/src/routes/orders.ts`

```typescript
import { updateOrderStatusSchema, validateRequest } from '@/schemas/validationSchemas';
import { createStatusUpdateRateLimiter } from '@/middleware/rateLimiter';
import { asyncHandler, AppError } from '@/middleware/errorHandler';
import { isValidMerchantTransition } from '@/utils/orderStateMachine';

const router = Router();
const rateLimiter = createStatusUpdateRateLimiter(redis);
const validateStatus = validateRequest(updateOrderStatusSchema);

/**
 * PATCH /orders/:id/status
 * Update order status with validation and rate limiting
 */
router.patch(
  '/:id/status',
  rateLimiter,
  validateStatus,
  asyncHandler(async (req, res) => {
    const { status, note } = req.validatedBody;
    const { id } = req.params;
    const merchantId = req.merchantId!;

    // Fetch current order
    const order = await Order.findById(id);
    if (!order) {
      throw new NotFoundError('Order');
    }

    // Verify merchant owns this order
    if (order.merchant.toString() !== merchantId) {
      throw new AppError('Unauthorized', 403, 'FORBIDDEN');
    }

    // Validate state machine transition
    if (!isValidMerchantTransition(order.status, status)) {
      const allowed = getMerchantNextStatuses(order.status);
      throw new AppError(
        `Cannot transition from ${order.status} to ${status}`,
        400,
        'INVALID_TRANSITION',
        { currentStatus: order.status, validNextStatuses: allowed }
      );
    }

    // Update order
    const updated = await Order.findByIdAndUpdate(
      id,
      {
        $set: { status },
        $push: { statusHistory: { status, timestamp: new Date(), note } },
      },
      { new: true }
    );

    // Idempotency middleware will cache this response
    res.json({ data: updated });
  })
);

export default router;
```

---

### Step 4: Add Input Validation to Offer Creation

**File:** `rez-merchant-service/src/routes/offers.ts`

```typescript
import { createDiscountOfferSchema, validateRequest } from '@/schemas/validationSchemas';
import { createOfferRateLimiter } from '@/middleware/rateLimiter';
import { asyncHandler, ValidationError } from '@/middleware/errorHandler';
import { validateOffer } from '@/utils/offerValidator';

const router = Router();
const offerLimiter = createOfferRateLimiter(redis);
const validateCreateOffer = validateRequest(createDiscountOfferSchema);

/**
 * POST /offers
 * Create a discount offer with full validation
 */
router.post(
  '/',
  offerLimiter, // Rate limit: 10 offers per hour
  validateCreateOffer, // Zod validation
  asyncHandler(async (req, res) => {
    const offerData = req.validatedBody;
    const merchantId = req.merchantId!;

    // Extra validation using offer validator
    const { isValid, errors } = validateOffer(offerData);
    if (!isValid) {
      throw new ValidationError('Offer validation failed', { errors });
    }

    // Create offer
    const offer = await Offer.create({
      ...offerData,
      merchant: merchantId,
    });

    res.status(201).json({ data: offer });
  })
);

export default router;
```

---

### Step 5: Set Up Rate Limiting for Common Operations

**File:** `src/middleware/setupRateLimiters.ts`

```typescript
import { createClient } from 'redis';
import {
  createOrderRateLimiter,
  createStatusUpdateRateLimiter,
  createKdsRateLimiter,
  createOfferRateLimiter,
  createAuthRateLimiter,
} from '@/middleware/rateLimiter';

const redis = createClient({...});

/**
 * Export pre-configured rate limiters
 */
export const rateLimiters = {
  createOrder: createOrderRateLimiter(redis),
  statusUpdate: createStatusUpdateRateLimiter(redis),
  kdsUpdate: createKdsRateLimiter(redis),
  offerCreation: createOfferRateLimiter(redis),
  auth: createAuthRateLimiter(redis),
};

/**
 * Usage in routes:
 * router.post('/orders', rateLimiters.createOrder, ...)
 */
```

---

### Step 6: Add Health Checks

**File:** `src/index.ts` (already added above, but here's the detail)

```typescript
import { attachHealthChecks } from '@/middleware/healthCheck';

// In your Express setup:
attachHealthChecks(app, {
  redis: redisClient,
  mongoose: mongoose,
});

// Now available:
// GET /health/live     — Is the service alive? (always 200)
// GET /health/ready    — Is the service ready? (checks dependencies)
// GET /health/startup  — Is the service still starting?
// GET /metrics         — Prometheus metrics
```

---

### Step 7: Circuit Breaker for External Services

**File:** `src/services/redisService.ts` or similar

```typescript
import { CircuitBreaker, createRedisCircuitBreaker } from '@/utils/circuitBreaker';

/**
 * Wrap Redis calls with circuit breaker
 */
export class RedisService {
  private getCacheBreaker: CircuitBreaker;
  private setCacheBreaker: CircuitBreaker;

  constructor(private redis: RedisClient) {
    this.getCacheBreaker = createRedisCircuitBreaker(
      () => redis.get('any-key'),
      'RedisRead'
    );

    this.setCacheBreaker = createRedisCircuitBreaker(
      () => redis.set('key', 'value'),
      'RedisWrite'
    );
  }

  async getCached(key: string, fallback: any = null) {
    try {
      return await this.getCacheBreaker.call();
    } catch (error) {
      // Return fallback if circuit is open
      return fallback;
    }
  }

  async setCached(key: string, value: any) {
    try {
      return await this.setCacheBreaker.call();
    } catch (error) {
      // Log error but don't fail the request
      console.warn('Failed to cache value:', error);
    }
  }

  getStatus() {
    return {
      read: this.getCacheBreaker.getStatus(),
      write: this.setCacheBreaker.getStatus(),
    };
  }
}
```

---

## Usage Examples

### Error Handling

```typescript
import { AppError, ValidationError, NotFoundError } from '@/middleware/errorHandler';

// Throw structured errors
throw new AppError('Custom error', 400, 'CUSTOM_CODE', { details: '...' });
throw new ValidationError('Invalid input', { field: 'value is required' });
throw new NotFoundError('Order');

// In async handlers, errors are automatically caught
router.post('/', asyncHandler(async (req, res) => {
  throw new Error('Oops!'); // Automatically handled by global error handler
}));
```

### Structured Logging

```typescript
// Attach to request object (done by middleware)
router.get('/', (req, res) => {
  (req as any).logger.info('Processing order', { orderId: '123' });
  (req as any).logger.error(new Error('Something failed'), { context: '...' });
});
```

### Validation

```typescript
import { createOrderSchema, validateRequest } from '@/schemas/validationSchemas';

// Use as middleware
router.post('/', validateRequest(createOrderSchema), asyncHandler(async (req, res) => {
  const order = req.validatedBody; // Type-safe, already validated
}));

// Or use in handler
const result = createOrderSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.errors });
}
```

### Idempotency

```typescript
// Client sends idempotency key
fetch('/api/orders', {
  method: 'POST',
  headers: {
    'idempotency-key': 'uuid-v4-here',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ ... }),
});

// Middleware automatically:
// 1. Checks if request with same key was processed
// 2. Returns cached response if found
// 3. Caches response for 1 hour
// 4. Prevents duplicate orders
```

---

## Monitoring & Observability

### Health Checks

```bash
# Check if service is alive
curl http://localhost:3000/health/live

# Check if service is ready
curl http://localhost:3000/health/ready

# Prometheus metrics
curl http://localhost:3000/metrics
```

### Circuit Breaker Status

```typescript
import { CircuitBreaker } from '@/utils/circuitBreaker';

const breaker = new CircuitBreaker(...);
console.log(breaker.getStatus());
// Output:
// {
//   name: 'Redis',
//   state: 'CLOSED',
//   failureCount: 0,
//   successCount: 100,
//   requestCount: 100,
//   failurePercentage: 0
// }
```

### Request Tracking

Every request now has:
- `x-correlation-id` — Trace across all services
- `x-request-id` — Track single request
- Structured logs with timestamps and context

---

## Database Migrations

After adding these utilities, you may want to:

1. **Add index for order status:**
   ```bash
   db.orders.createIndex({ "status": 1, "createdAt": -1 })
   ```

2. **Add index for idempotency:**
   ```bash
   db.orders.createIndex({ "user": 1, "idempotencyKey": 1 }, { unique: true })
   ```

---

## Environment Variables

Add to `.env`:

```env
# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# Circuit Breaker
CIRCUIT_BREAKER_TIMEOUT=3000
CIRCUIT_BREAKER_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Idempotency
IDEMPOTENCY_TTL=3600
```

---

## Testing

### Unit Test Example

```typescript
import { CircuitBreaker } from '@/utils/circuitBreaker';

describe('CircuitBreaker', () => {
  it('should open after threshold', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Failed'));
    const breaker = new CircuitBreaker(fn, {
      errorThresholdPercentage: 50,
    });

    // Trigger failures
    for (let i = 0; i < 10; i++) {
      await breaker.call().catch(() => {});
    }

    expect(breaker.getStatus().state).toBe('OPEN');
  });

  it('should allow recovery after reset timeout', async () => {
    // ... test HALF_OPEN state
  });
});
```

---

## Deployment Checklist

- [ ] All services updated with new middleware
- [ ] Rate limiters configured appropriately
- [ ] Health checks deployed and monitored
- [ ] Logging aggregation set up (ELK, Datadog, etc.)
- [ ] Circuit breaker thresholds tuned
- [ ] Database indexes created
- [ ] Error handling tested
- [ ] Load tested with new middleware overhead
- [ ] Rollback plan documented

---

## Performance Impact

**Expected overhead per request:**
- Logging: ~2-5ms
- Sanitization: ~1-3ms
- Validation: ~2-5ms
- Rate limiting: ~1-2ms
- Idempotency check: ~5-10ms (with Redis)
- **Total: ~15-25ms additional latency**

This is acceptable for production systems. Can be optimized further with async operations.

---

## Support & Troubleshooting

**Health check fails:**
- Check Redis connection
- Check MongoDB connection
- Check connection pool size

**Rate limiting not working:**
- Verify Redis is running
- Check rate limiter configuration
- Verify middleware order

**Validation errors:**
- Check Zod schema
- Verify request body format
- Check error response format

---

For questions, refer to the comprehensive architecture documentation.
