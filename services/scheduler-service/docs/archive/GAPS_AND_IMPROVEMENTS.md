# Restaurant System — Gaps & Improvement Opportunities

**Scope:** Beyond critical fixes; identifies architectural gaps, missing patterns, and optimization opportunities

**Priority Levels:** 🔴 HIGH | 🟡 MEDIUM | 🟢 LOW

---

## 1. Error Handling & Recovery 🔴

### Gap: Inconsistent error handling across services

**Current State:**
- Monolith uses `AppError` with error codes
- Merchant-service uses generic 500 errors with `err.message`
- No standardized error response format across services

**Problems:**
```typescript
// ❌ Inconsistent: merchant-service
catch (err: any) {
  res.status(500).json({ success: false, message: err.message });
}

// ✅ Better: monolith style
catch (err) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
  }
  throw err; // Let global error handler catch
}
```

**Recommended Fix:**
- Create shared error handling library in `rez-shared` package
- Standardize error codes across all services (e.g., `ORDER_NOT_FOUND`, `INVALID_TRANSITION`)
- Implement global error middleware in all Express services
- Document error codes in OpenAPI spec

**Impact:** Easier client error handling, better debugging, consistent API contracts

---

## 2. Input Validation 🔴

### Gap: No centralized validation schema

**Current State:**
- Manual validation scattered across controllers
- No request schema validation (Joi, Zod, etc.)
- Address validation hardcoded in orderCreateController

**Problems:**
```typescript
// ❌ Current: Manual inline validation
if (!deliveryAddress) return sendBadRequest(res, 'Required');
if (!phoneRegex.test(cleanPhone)) return sendBadRequest(res, 'Invalid phone');
if (!pincodeRegex.test(pincode)) return sendBadRequest(res, 'Invalid pincode');

// ✅ Better: Schema-based validation
const schema = Joi.object({
  deliveryAddress: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().pattern(/^(\+91|91)?[6-9]\d{9}$/).required(),
    pincode: Joi.string().pattern(/^\d{6}$/).required(),
  }).required(),
});
```

**Recommended Fix:**
- Adopt Zod or Joi for schema validation
- Create reusable schemas for common objects (Address, Payment, etc.)
- Create validation middleware
- Generate OpenAPI types from schemas (TypeScript + Zod integration)

**Impact:** Reduced code duplication, automatic OpenAPI schema generation, better type safety

**Files to Create:**
- `rez-shared/src/schemas/` — Shared validation schemas
- Middleware: `validateRequest` for each service

---

## 3. Input Sanitization & Security 🔴

### Gap: Missing input sanitization for text fields

**Current State:**
- No sanitization of user input (notes, special instructions, names)
- Potential XSS in customer-facing orders
- No rate limiting on order creation
- No CSRF protection (if using cookies)

**Problems:**
```typescript
// ❌ Unsafe: Could contain malicious content
const order = await Order.create({
  notes: req.body.notes, // Raw user input
  specialInstructions: req.body.specialInstructions, // Raw user input
});
```

**Recommended Fixes:**
1. **Sanitize HTML input:**
   ```typescript
   import DOMPurify from 'isomorphic-dompurify';
   
   const cleanNotes = DOMPurify.sanitize(req.body.notes);
   ```

2. **Add rate limiting:**
   ```typescript
   import rateLimit from 'express-rate-limit';
   
   const createOrderLimiter = rateLimit({
     windowMs: 60 * 1000, // 1 minute
     max: 5, // 5 orders per minute per user
     message: 'Too many orders, try again later',
   });
   
   router.post('/orders', createOrderLimiter, createOrder);
   ```

3. **Input length limits:**
   - notes: max 1000 chars
   - specialInstructions: max 500 chars
   - phone: exactly 10 digits (after validation)

**Impact:** Prevents XSS, injection attacks, DoS via spam orders

---

## 4. Idempotency Beyond Order Creation 🟡

### Gap: Idempotency only on order creation

**Current State:**
- Only POST /orders has idempotency key
- Other operations (PATCH status, create offer, etc.) lack idempotency

**Problems:**
```typescript
// ❌ Current: No idempotency on status updates
router.patch('/:id/status', async (req, res) => {
  // If request retries, order gets updated twice
  // statusHistory gets duplicate entries
});

// ✅ Better: Use idempotency key
router.patch('/:id/status', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  const cached = await redis.get(`idempotency:${idempotencyKey}`);
  if (cached) return res.json(cached); // Return cached response
  
  // ... do work ...
  
  await redis.set(`idempotency:${idempotencyKey}`, response, 'EX', 3600);
  res.json(response);
});
```

**Recommended Fix:**
- Idempotency middleware for all mutations (POST, PATCH, DELETE)
- Store idempotency keys in Redis with 1-hour TTL
- Validate format: UUID v4

**Impact:** Prevents duplicate state transitions, payment charges, status history entries

---

## 5. Async Processing & Message Queue 🟡

### Gap: Blocking post-response operations

**Current State:**
- Email, SMS, activity logging, notifications run in background but not queued
- If background process crashes, events are lost
- No retry logic for failed notifications

**Problems:**
```typescript
// ❌ Current: Background fire-and-forget
setTimeout(() => {
  sendEmail(...); // No retry if fails
  sendSMS(...);   // No queue, lost on crash
}, 0);

// ✅ Better: Queue-based async
await emailQueue.add({ orderId, ... }, { priority: 'high' });
```

**Recommended Fix:**
- Implement message queue (Bull/RabbitMQ/AWS SQS)
- Jobs: send-email, send-sms, create-activity-log, send-push-notification
- Retry logic: exponential backoff (1s, 2s, 4s, 8s, max 5 retries)
- Dead letter queue for persistent failures

**Impact:** Reliable async operations, better observability, scalable notification system

---

## 6. Distributed Tracing & Observability 🟡

### Gap: No cross-service request tracing

**Current State:**
- No correlation IDs for tracking requests across services
- No distributed tracing (OpenTelemetry/Jaeger)
- No request logging middleware

**Problems:**
```
Order created in monolith
  → Sent to merchant-service (no way to correlate)
    → Merchant-service sends to KDS (no way to track)
      → KDS broadcasts to Socket.IO (lost trace)

If something fails, can't trace the full flow.
```

**Recommended Fix:**
1. **Add correlation ID:**
   ```typescript
   // Middleware in all services
   app.use((req, res, next) => {
     const correlationId = req.headers['x-correlation-id'] || generateUUID();
     req.correlationId = correlationId;
     res.setHeader('x-correlation-id', correlationId);
     next();
   });
   ```

2. **Structured logging:**
   ```typescript
   logger.info('Order created', {
     correlationId: req.correlationId,
     orderId: order._id,
     userId: order.user,
     timestamp: new Date().toISOString(),
   });
   ```

3. **OpenTelemetry:**
   ```typescript
   import { NodeTracerProvider } from '@opentelemetry/node';
   const provider = new NodeTracerProvider();
   provider.register();
   ```

**Impact:** Easier debugging, performance profiling, end-to-end request tracking

---

## 7. API Documentation & Contracts 🟡

### Gap: Incomplete OpenAPI/Swagger specs

**Current State:**
- Monolith has Swagger comments in orderCreateController
- Merchant-service has no API documentation
- No client SDK generation

**Problems:**
- Merchants don't know the exact error codes or response formats
- Frontend teams must reverse-engineer APIs
- No contract testing between services

**Recommended Fix:**
1. **Complete OpenAPI specs for all services:**
   - monolith: `/docs/openapi.json`
   - merchant-service: `/docs/openapi.json`
   - order-service: `/docs/openapi.json`

2. **Use Swagger UI for exploration:**
   ```typescript
   import swaggerUi from 'swagger-ui-express';
   app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
   ```

3. **Generate TypeScript client SDKs:**
   ```bash
   openapi-generator-cli generate -i api.json -g typescript-fetch -o sdk/
   ```

**Impact:** Better developer experience, contract testing, type safety for clients

---

## 8. Webhook Handling 🟡

### Gap: No webhook system for integrations

**Current State:**
- Payment callbacks: handled via Razorpay webhooks (if implemented)
- Aggregator updates (Swiggy/Zomato): unknown handling
- No outgoing webhooks for merchant integrations

**Problems:**
```
Merchant needs to know when:
- Order status changes
- Payment received
- Refund processed
- Aggregator updates delivery time

Currently: Merchants must poll or use KDS Socket.IO
```

**Recommended Fix:**
1. **Webhook service:**
   ```typescript
   // On status change
   await webhookService.trigger('order.status_changed', {
     orderId: order._id,
     previousStatus: order.previousStatus,
     newStatus: order.status,
     merchant: order.merchant,
   });
   ```

2. **Webhook table schema:**
   ```typescript
   {
     _id: ObjectId,
     merchant: ObjectId,
     event: 'order.status_changed' | 'payment.received' | ...,
     targetUrl: 'https://merchant-api.com/webhooks/orders',
     active: boolean,
     secret: string, // For HMAC signing
   }
   ```

3. **Webhook delivery with retries:**
   - POST to targetUrl with HMAC signature
   - Exponential backoff: 1s, 10s, 100s, 1000s (max 4 retries)
   - Store delivery log for debugging

**Impact:** Real-time merchant integrations, better POS integration

---

## 9. Database Connection Pooling & Optimization 🟡

### Gap: Suboptimal database connection management

**Current State:**
- Default Mongoose connection pool (25 connections)
- No connection monitoring
- No query performance optimization
- Category cache is L1 (memory) + L2 (Redis), no L3 (DB query optimization)

**Problems:**
```
At 50-70 orders/min, each using 11 DB queries:
  → 550-770 queries/min across all pods
  → With 25-connection pool, could hit bottleneck at 2+ pods
```

**Recommended Fixes:**
1. **Increase connection pool for high-load:**
   ```typescript
   mongoose.connect(uri, {
     maxPoolSize: 50, // Default 25
     minPoolSize: 10,
     socketTimeoutMS: 45000,
     serverSelectionTimeoutMS: 5000,
   });
   ```

2. **Monitor pool usage:**
   ```typescript
   const poolStats = db.connection.getClient().topology.s.pool.totalConnectionCount;
   logger.info('DB pool usage', { poolStats });
   ```

3. **Query optimization:**
   - Add `.lean()` to read-only queries (saves ~20% latency)
   - Already done in most places, verify completeness
   - Add database indexes for frequently filtered fields

4. **Connection health checks:**
   ```typescript
   setInterval(() => {
     db.connection.db.admin().ping((err, result) => {
       if (err) logger.error('DB health check failed', err);
     });
   }, 30000); // Every 30 seconds
   ```

**Impact:** Better scalability, reduced p99 latency, earlier detection of DB issues

---

## 10. Circuit Breaker Pattern 🟡

### Gap: No circuit breaker for service dependencies

**Current State:**
- If one service fails, others don't degrade gracefully
- No cascading failure protection
- No fallback for Redis failures

**Problems:**
```
Scenario: Redis goes down
  → Category cache fetch fails
  → Order creation fails
  → Customers can't order
  (Could fallback to DB query)

Scenario: Payment gateway is slow
  → Order creation waits for payment
  → Blocks entire request pipeline
```

**Recommended Fix:**
```typescript
import CircuitBreaker from 'opossum';

const redisBreaker = new CircuitBreaker(async () => {
  return await redis.get(key);
}, {
  timeout: 3000, // 3 second timeout
  errorThresholdPercentage: 50, // Open after 50% failures
  resetTimeout: 30000, // Try to recover after 30s
});

const result = await redisBreaker.fire()
  .catch(() => {
    // Fallback: fetch from DB instead
    return await Category.find({});
  });
```

**Impact:** Better resilience, graceful degradation, prevents cascading failures

---

## 11. Data Consistency & Distributed Transactions 🟡

### Gap: No distributed transaction support

**Current State:**
- Order creation uses MongoDB transaction (single DB)
- Multi-service operations (order + inventory + payment) not atomic
- No saga pattern for long-running workflows

**Problems:**
```
Order creation flow:
  1. Create order in Orders collection
  2. Update inventory (in another service?)
  3. Process payment
  4. Send notifications

If step 3 fails, no rollback for steps 1-2
```

**Recommended Fix:**
- Implement Saga pattern:
  ```typescript
  // Choreography (event-driven)
  OrderCreated → InventoryService.reserve() → PaymentService.charge()
                  → If PaymentFailed: InventoryService.release()
  
  // Or Orchestration (order service coordinates)
  OrderService → InventoryService.reserve()
              → PaymentService.charge()
              → If either fails: trigger compensations
  ```

**Impact:** Consistent state across services, proper rollback on failures

---

## 12. Rate Limiting & Throttling 🟡

### Gap: No global rate limiting strategy

**Current State:**
- No rate limits on order creation (except potential IP-based)
- No per-merchant limits
- No per-user limits

**Problems:**
```
Attacker could:
  - Spam orders (customer or merchant spoofing)
  - Flood KDS updates
  - Create thousands of offers

No protection currently.
```

**Recommended Fix:**
```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const createOrderLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate-limit:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 orders per minute per user
  keyGenerator: (req) => req.userId, // Rate limit by user, not IP
  handler: (req, res) => {
    res.status(429).json({ message: 'Too many orders, try again later' });
  },
});

router.post('/orders', createOrderLimiter, createOrder);
```

**Also add:**
- Per-merchant offer creation limit
- Per-store KDS update rate limit
- Per-user status update view limit

**Impact:** Prevents abuse, protects against DoS

---

## 13. Secrets Management 🔴

### Gap: Credentials possibly hardcoded or exposed

**Current State:**
- Razorpay keys, email credentials likely in `.env` files
- `.env` files might be in git history (if not gitignored properly)
- No secrets rotation strategy

**Recommended Fix:**
1. **Use environment-specific vaults:**
   - Development: `.env` (gitignored)
   - Staging/Production: AWS Secrets Manager / HashiCorp Vault

2. **In code:**
   ```typescript
   // ✅ Good
   const apiKey = process.env.RAZORPAY_KEY_ID;
   const secret = await secretsManager.get('razorpay-key-secret');
   
   // ❌ Bad
   const secret = 'rp_live_...'; // Hardcoded
   ```

3. **Regular audit:**
   ```bash
   # Check for exposed secrets in git history
   git-secrets --install
   npm install -g detect-secrets
   detect-secrets scan
   ```

**Impact:** Security, compliance, prevents credential leaks

---

## 14. Database Monitoring & Backups 🟡

### Gap: No explicit backup/restore strategy

**Current State:**
- MongoDB Atlas likely has automatic backups (if using cloud)
- No documented backup/restore procedure
- No data validation checks

**Recommended Fix:**
1. **Automated backups:**
   - Daily snapshots (automated in cloud providers)
   - 30-day retention
   - Cross-region replication

2. **Backup verification:**
   ```typescript
   // Monthly restore test
   mongorestore --uri mongodb://backup-test --archive backup.archive
   // Run data integrity checks
   ```

3. **Point-in-time recovery:**
   - Enable MongoDB oplog (transaction log)
   - Can recover to any point in last 7 days

**Impact:** Data protection, disaster recovery, compliance

---

## 15. Analytics & Business Intelligence 🟢

### Gap: Limited historical data analysis

**Current State:**
- Admin dashboard has some analytics
- No data warehouse / ETL for historical analysis
- Offer ROI is calculated in-memory (not stored)

**Recommended:**
- Create data warehouse for:
  - Daily order metrics (volume, revenue, SKU performance)
  - Customer cohort analysis
  - Merchant performance trends
  - Campaign ROI tracking
  - Churn analysis

**Tools:** Snowflake, BigQuery, Redshift + dbt

**Impact:** Better business decisions, trend analysis, predictive insights

---

## 16. Monitoring & Alerting 🟡

### Gap: No centralized monitoring

**Current State:**
- No clear alerting strategy mentioned
- No SLA monitoring (beyond SLA_THRESHOLDS in code)
- No performance baseline monitoring

**Recommended Fix:**
1. **Metrics collection:**
   ```typescript
   // Prometheus metrics
   const orderCreationDuration = new Histogram({
     name: 'order_creation_duration_seconds',
     help: 'Time to create order',
   });
   
   orderCreationDuration.observe(endTime - startTime);
   ```

2. **Key alerts:**
   - Order creation latency > 1s
   - Order SLA breach rate > 5%
   - Database connection pool > 80%
   - Redis memory > 80%
   - Payment failure rate > 2%
   - Order status transition failures > 10/min

3. **Dashboards:**
   - Real-time order pipeline (placed → confirmed → delivered)
   - Per-merchant performance
   - KDS responsiveness metrics
   - Payment success rate by method

**Tools:** Prometheus + Grafana, DataDog, New Relic

**Impact:** Proactive issue detection, SLA compliance monitoring

---

## 17. Testing Gaps 🟡

### Gap: Limited test coverage documented

**Current State:**
- Added integration tests (new)
- No mention of unit tests for controllers
- No E2E tests
- No performance/load tests

**Recommended:**
1. **Unit tests:** Services, utilities, helpers
   - Target: >80% coverage for critical paths

2. **Component tests:** React Native components
   - KDS components
   - Merchant dashboard
   - Order tracking

3. **E2E tests:** Full user journeys
   - Complete order flow (app → backend → merchant → KDS)
   - Payment success/failure
   - Offer redemption

4. **Load tests:** Performance validation
   - 100 concurrent orders
   - 1000 KDS clients
   - Stress test database

5. **Chaos testing:**
   - MongoDB failover
   - Redis outage
   - Network latency injection

**Impact:** Reliability, regression prevention, confidence in deployments

---

## 18. Deployment & Infrastructure 🟡

### Gap: No clear deployment strategy

**Current State:**
- Services deployed (presumably)
- No documented CI/CD pipeline
- No blue-green deployment strategy
- No rollback procedures

**Recommended:**
1. **CI/CD pipeline (GitHub Actions):**
   - Run tests on every PR
   - Build Docker images
   - Deploy to staging on merge
   - Manual promotion to production

2. **Deployment strategy:**
   - Blue-green for zero-downtime
   - Canary releases (10% → 50% → 100%)
   - Health checks before marking healthy

3. **Feature flags:**
   - Enable/disable new features without deployment
   - Gradual rollout of state machine changes

**Impact:** Safer deployments, faster iteration, easy rollbacks

---

## 19. Documentation Gaps 🟡

### Gaps Addressed:
- ✅ Architecture documentation (created)
- ✅ Developer quick reference (created)
- ✅ Integration tests (created)

### Still Missing:
- Deployment runbook
- Database schema documentation (ERD)
- API migration guide (for v1 → v2)
- Merchant onboarding troubleshooting
- KDS setup guide (hardware requirements, network)
- Load testing results & capacity planning
- Disaster recovery procedures

---

## 20. Legacy Code & Technical Debt 🟢

### Potential Concerns:
- `strict: false` on all merchant-service models (loose schemas)
  - **Fix Applied:** offerValidator.ts provides validation layer
  - **Future:** Consider migrating to strict schemas if needed

- Hardcoded category slugs in orderCreateController
  - **Status:** OK for now, with cache invalidation
  - **Future:** Could move to database config

- No explicit middleware for CORS, helmet, etc.
  - **Check:** Ensure security headers are set globally

---

## Priority Matrix

| Gap | Priority | Effort | Impact | Owner |
|---|---|---|---|---|
| Error handling standardization | 🔴 HIGH | Medium | High | Backend |
| Input validation schema | 🔴 HIGH | Medium | High | Backend |
| Input sanitization & rate limiting | 🔴 HIGH | Small | High | Backend |
| Secrets management audit | 🔴 HIGH | Small | High | DevOps |
| Idempotency middleware | 🟡 MEDIUM | Medium | Medium | Backend |
| Message queue for async | 🟡 MEDIUM | Large | High | Backend |
| Distributed tracing | 🟡 MEDIUM | Medium | Medium | DevOps |
| API documentation | 🟡 MEDIUM | Small | Medium | Backend |
| Webhooks | 🟡 MEDIUM | Large | Medium | Backend |
| Circuit breaker | 🟡 MEDIUM | Small | Medium | Backend |
| Database optimization | 🟡 MEDIUM | Medium | High | DevOps/Backend |
| Rate limiting strategy | 🟡 MEDIUM | Small | High | Backend |
| Monitoring & alerting | 🟡 MEDIUM | Medium | High | DevOps |
| Testing expansion | 🟡 MEDIUM | Large | High | QA/Backend |
| Deployment CI/CD | 🟡 MEDIUM | Large | High | DevOps |
| Analytics/BI | 🟢 LOW | Large | Low | Analytics |
| Legacy code refactoring | 🟢 LOW | Large | Low | Backend |

---

## Quick Wins (1-2 days each)

1. ✅ **State machine enforcement** (DONE)
2. ✅ **Offer validation** (DONE)
3. Add rate limiting middleware to POST `/orders`
4. Add input sanitization for text fields
5. Implement correlation IDs in all services
6. Add structured logging middleware
7. Create OpenAPI spec for merchant-service
8. Add health check endpoints (`/health`)

---

## Recommended Next Steps

**Week 1-2:**
- Implement standardized error handling
- Add input validation schemas
- Add rate limiting & sanitization
- Secrets audit

**Week 3-4:**
- Message queue for async operations
- Webhook system
- Distributed tracing
- API documentation

**Week 5-6:**
- Circuit breaker for external services
- Comprehensive monitoring & alerting
- Expand test coverage
- Load testing

**Long-term:**
- Saga pattern for distributed transactions
- Data warehouse for analytics
- Feature flags for safer rollouts
- Disaster recovery procedures

---

## Summary

**Critical Issues Fixed:** 2 ✅
- State machine enforcement
- Order schema alignment

**Identified Gaps:** 20
- 🔴 HIGH: 3 (error handling, validation, sanitization)
- 🟡 MEDIUM: 13
- 🟢 LOW: 4

**Estimated Effort to Address All:** 8-12 weeks (assuming 1 team of 2-3 engineers)

**Highest ROI Items:** Standardized error handling, validation, rate limiting, monitoring

The restaurant system is solid architecturally. The gaps are mostly about production-readiness, operational safety, and developer experience.
