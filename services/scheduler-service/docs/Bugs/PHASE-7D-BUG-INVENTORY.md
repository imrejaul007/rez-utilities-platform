# PHASE 7D: MEDIUM BUG INVENTORY

**Date:** 2026-04-15  
**Total MEDIUM Bugs Targeted:** 48  
**Analysis Scope:** All backend services  

---

## SHARED LIBRARY BUGS (BE-SHR) - 10 MEDIUM
**File Category:** Infrastructure affecting all services  
**Status:** 0 fixed, 10 unfixed

1. **BE-SHR-003** - Idempotency JSON Parsing Vulnerability
   - Location: `rez-shared/src/middleware/idempotency.ts:64`
   - Risk: Cache corruption crashes app
   - Fix: Add try-catch to JSON.parse

2. **BE-SHR-007** - Validation Error Path Array Assumption
   - Location: `rez-shared/src/middleware/errorHandler.ts:191-192`
   - Risk: Validation errors crash error handler
   - Fix: Defensive check before join()

3. **BE-SHR-012** - MongoDB Health Check Inadequate
   - Location: `rez-shared/src/middleware/healthCheck.ts:78`
   - Risk: Dead connections reported healthy
   - Fix: Execute test query instead of ping

4. **BE-SHR-014** - Webhook Signature Timing Attack
   - Location: `rez-shared/src/webhook/webhookService.ts:279-282`
   - Risk: Timing attack on signature verification
   - Fix: Document/implement constant-time comparison

5. **BE-SHR-015** - Webhook Delivery Timeout Not Enforced
   - Location: `rez-shared/src/webhook/webhookService.ts:191-194`
   - Risk: Slow webhooks block job queue
   - Fix: Wrap deliver() with Promise.race timeout

6. **BE-SHR-016** - Webhook Retry Config Not Honored
   - Location: `rez-shared/src/webhook/webhookService.ts:295`
   - Risk: All webhooks retry same number of times
   - Fix: Pass webhook's maxRetries to shouldRetry()

7. **BE-SHR-017** - Job Queue Completion Removal Aggressive
   - Location: `rez-shared/src/queue/jobQueue.ts:55`
   - Risk: Audit trail deleted after 1 hour
   - Fix: Make retention configurable

8. **BE-SHR-018** - Job Queue Deduplication Unreliable
   - Location: `rez-shared/src/queue/jobQueue.ts:86-95`
   - Risk: Duplicate jobs despite deduplication intent
   - Fix: Verify BullMQ behavior, add pre-check

9. **BE-SHR-020** - Email Queue Deduplication No TTL
   - Location: `rez-shared/src/queue/jobQueue.ts:206`
   - Risk: Can't resend identical emails
   - Fix: Add TTL to unique key

10. **BE-SHR-021** - Webhook Queue Missing Idempotency
    - Location: `rez-shared/src/queue/jobQueue.ts:243-253`
    - Risk: Duplicate webhook deliveries
    - Fix: Use idempotent jobId

---

## EVENTS SERVICE BUGS (BE-EVT) - 8 MEDIUM
**File Categories:** Notification, Media, Analytics event processing  
**Status:** 0 fixed, 8 unfixed

1. **BE-EVT-001** - Missing Event Schema Validation
   - Location: `rez-notification-events/src/worker.ts:27-50`
   - Risk: Invalid events silently processed
   - Fix: Create Zod schemas with strict validation

2. **BE-EVT-002** - Push Notification Silent Failures
   - Location: `rez-notification-events/src/worker.ts:54-92`
   - Risk: Notifications disappear without alerting
   - Fix: Emit monitoring alert, track in DLQ

3. **BE-EVT-003** - Email Resolution Silent Failures
   - Location: `rez-notification-events/src/worker.ts:94-123`
   - Risk: Customers unaware of missed emails
   - Fix: Fail job, emit alert

4. **BE-EVT-009** - In-App Notification ObjectId Conversion Silent Fail
   - Location: `rez-notification-events/src/worker.ts:218-223`
   - Risk: Invalid notifications stored as strings
   - Fix: Enforce strict ObjectId type or throw

5. **BE-EVT-010** - Notification Channel Errors Don't Fail Job
   - Location: `rez-notification-events/src/worker.ts:299-307`
   - Risk: Failed notifications never retried
   - Fix: Fail job on critical channel failures

6. **BE-EVT-014** - DLQ Unbounded Growth
   - Location: `rez-notification-events/src/workers/dlqWorker.ts:34-36`
   - Risk: Database bloat, slow queries
   - Fix: Implement cleanup job with archive

7. **BE-EVT-029** - Missing Centralized Event Schemas
   - Location: All event worker files
   - Risk: No runtime validation
   - Fix: Create centralized Zod schemas

8. **BE-EVT-030** - Notification Worker Partial Failures Not Differentiated
   - Location: `rez-notification-events/src/worker.ts:274-329`
   - Risk: Missing email treated same as missing push
   - Fix: Implement channel priority system

---

## ORDER SERVICE BUGS (BE-ORD) - 7 MEDIUM
**File Category:** Order state machine, fulfillment  
**Status:** 14 fixed, 3 unfixed → **Target 7 for total coverage**

1. **BE-ORD-006** - Missing Concurrent Update Logging
   - Location: `src/httpServer.ts:621-631`
   - Risk: Race conditions unaudited
   - Fix: Log conflict at WARN level

2. **BE-ORD-012** - Missing Cancellation Timeline Entry
   - Location: `src/httpServer.ts:610-611`
   - Risk: Incomplete audit trail
   - Fix: Push timeline for every status change

3. **BE-ORD-013** - SSE Change Stream Fallback Missing Healthcheck
   - Location: `src/httpServer.ts:489-500`
   - Risk: Silent polling failures
   - Fix: Return 503 if both unavailable

4. **BE-ORD-014** - Missing Order Version Field
   - Location: `src/httpServer.ts:615-619`
   - Risk: Concurrent updates overwrite
   - Fix: Add version field, condition on match

5. **BE-ORD-015** - Pagination Bounds Not Validated
   - Location: `src/httpServer.ts:297-298`
   - Risk: Negative/zero values bypass checks
   - Fix: Validate before parsing

6. **BE-ORD-018** - Timezone Handling Missing
   - Location: `src/httpServer.ts:240`
   - Risk: Date ranges wrong for different timezones
   - Fix: Accept timezone parameter

7. **BE-ORD-021** - Settlement Retry Policy Missing Backoff Cap
   - Location: `src/worker.ts:134-138`
   - Risk: Final retry delayed 24+ hours
   - Fix: Add backoff cap

---

## AUTH SERVICE BUGS (BE-AUTH) - 7 MEDIUM
**File Category:** Authentication, OTP, tokens  
**Status:** 0 fixed, 7 unfixed (targeting highest-impact)

1. **BE-AUTH-001** - OTP Verification Returns Boolean Without Context
   - Location: `rez-auth-service/src/routes/authRoutes.ts:114`
   - Risk: Client can't distinguish failure reasons
   - Fix: Return detailed error object

2. **BE-AUTH-004** - OTP Rate Limiting Doesn't Account for Country Code
   - Location: `rez-auth-service/src/routes/authRoutes.ts:95-96`
   - Risk: Different formats bypass rate limits
   - Fix: Normalize phone number in middleware

3. **BE-AUTH-009** - Device Hash Not Normalized
   - Location: `rez-auth-service/src/services/deviceService.ts:4-8`
   - Risk: Browser minor version changes trigger new hash
   - Fix: Normalize user-agent to major version

4. **BE-AUTH-012** - PIN Validation Accepts Unexpected Formats
   - Location: `rez-auth-service/src/routes/authRoutes.ts:223`
   - Risk: Non-numeric PINs accepted
   - Fix: Validate format with regex first

5. **BE-AUTH-017** - Refresh Token Concurrent Request Handling
   - Location: `rez-auth-service/src/services/tokenService.ts:306-310`
   - Risk: Concurrent requests cause logout
   - Fix: Return 409 with specific error

6. **BE-AUTH-024** - Email Verification Token Consumed on Failure
   - Location: `rez-auth-service/src/routes/authRoutes.ts:809`
   - Risk: Failed verification leaves token consumed
   - Fix: Delete token after successful write

7. **BE-AUTH-029** - Profile Update Missing Rate Limiting
   - Location: `rez-auth-service/src/routes/authRoutes.ts:408-409`
   - Risk: Profile updates can be spammed
   - Fix: Add per-field rate limiting

---

## PAYMENT SERVICE BUGS (BE-PAY) - 5 MEDIUM
**File Category:** Payment processing, refunds  
**Status:** 4 fixed, 5 unfixed (targeting core safety)

1. **BE-PAY-003** - Amount Precision Validation Missing
   - Location: `rez-payment-service/src/routes/paymentRoutes.ts:11-20`
   - Risk: Arbitrary decimals cause Razorpay mismatch
   - Fix: Enforce 2 decimal places with Zod

2. **BE-PAY-004** - Idempotency Key Uniqueness Allows Duplicates
   - Location: `rez-payment-service/src/services/paymentService.ts:202-263`
   - Risk: Concurrent requests create multiple orders
   - Fix: Add compound index on (orderId, status)

3. **BE-PAY-010** - Concurrency Lock TTL Too Short
   - Location: `rez-payment-service/src/services/paymentService.ts:68-69`
   - Risk: Slow Razorpay allows duplicate orders
   - Fix: Increase TTL to 30 seconds

4. **BE-PAY-014** - Payment Initiation Rate Limiting Missing
   - Location: `rez-payment-service/src/routes/paymentRoutes.ts:77-127`
   - Risk: Attacker spams initiate requests
   - Fix: Add per-user rate limiting

5. **BE-PAY-021** - Receipt Generation Non-Idempotent
   - Location: `rez-payment-service/src/routes/paymentRoutes.ts:255`
   - Risk: Duplicate requests create different receipts
   - Fix: Derive from stable source (orderId)

---

## MERCHANT SERVICE BUGS (BE-MER) - 7 MEDIUM
**File Category:** Merchant profiles, stores, operations  
**Status:** 7 fixed, 19 unfixed (targeting operations)

1. **BE-MER-007** - Payout Amount Validation Missing
   - Location: `src/routes/payouts.ts:31-49`
   - Risk: Invalid amounts bypass validation
   - Fix: Add bounds and precision checks

2. **BE-MER-009** - Payout Merchant Ownership Missing
   - Location: `src/routes/payouts.ts:65-72`
   - Risk: Cross-merchant payout manipulation
   - Fix: Add ownership validation in filter

3. **BE-MER-020** - Discount Usage Limit Enforcement Missing
   - Location: `src/routes/discounts.ts:8-21`
   - Risk: Discounts used unlimited times
   - Fix: Check limits before redemption

4. **BE-MER-021** - Bulk Import SKU Deduplication Missing
   - Location: `src/routes/bulkImport.ts:10-26`
   - Risk: Duplicate SKUs cause inventory confusion
   - Fix: Validate uniqueness before insertion

5. **BE-MER-023** - Merchant Status Check Missing
   - Location: `src/routes/orders.ts:21-102`
   - Risk: Suspended merchants retain data access
   - Fix: Check merchant status in auth middleware

6. **BE-MER-024** - Date Filter Validation Missing
   - Location: `src/routes/orders.ts:69-72`
   - Risk: Invalid dates produce Invalid Date objects
   - Fix: Validate ISO format before using

7. **BE-MER-034** - Cache Errors Silently Fail
   - Location: `src/config/redis.ts:26-47`
   - Risk: No visibility into cache failures
   - Fix: Log all cache errors

---

## CATALOG SERVICE BUGS (BE-CAT) - 4 MEDIUM
**File Category:** Product catalog, categories  
**Status:** 4 fixed, 12 unfixed (targeting core list operations)

1. **BE-CAT-002** - Pagination Input Validation Missing
   - Location: `src/httpServer.ts:115-116`
   - Risk: NaN values pass through Math.min/max
   - Fix: Validate Number.isFinite() before Math

2. **BE-CAT-003** - ObjectId Validation Missing
   - Location: `src/httpServer.ts:171-203`
   - Risk: Silent query failures
   - Fix: Validate with mongoose.isValidObjectId()

3. **BE-CAT-015** - Category Filter ObjectId Validation Missing
   - Location: `src/httpServer.ts:130-137`
   - Risk: Invalid queries passed to MongoDB
   - Fix: Validate category parameter format

4. **BE-CAT-019** - Cache Invalidation Race Condition
   - Location: `src/worker.ts:56-67`
   - Risk: Stale cache hits after updates
   - Fix: Use atomic Redis pipeline

---

## SUMMARY TABLE

| Service | Target | Fixed | Unfixed | Status |
|---------|--------|-------|---------|--------|
| Shared  | 10     | 0     | 10      | BLOCKED |
| Events  | 8      | 0     | 8       | BLOCKED |
| Order   | 7      | 14    | 3       | 2 more |
| Auth    | 7      | 0     | 7       | HIGH   |
| Payment | 5      | 4     | 1       | 1 more |
| Merchant| 7      | 7     | 19      | SAMPLE |
| Catalog | 4      | 4     | 12      | SAMPLE |
| **TOTAL** | **48**    | **29** | **60**      | **READY** |

---

## NEXT STEPS

**Commit Order (per CLAUDE.md):**
1. Shared library fixes (10 MED) - unblocks all services
2. Events service fixes (8 MED) - unblocks event pipeline
3. Order service fixes (7 MED) - state machine safety
4. Auth service fixes (7 MED) - authentication safety
5. Payment service fixes (5 MED) - payment safety
6. Merchant service fixes (7 MED) - operations safety
7. Catalog service fixes (4 MED) - catalog consistency

**Commit Format:**
```
fix(<service>) MED: <3-5 word summary>

- BE-XXX-###: One-line fix description
- BE-XXX-###: One-line fix description

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

**Verification:**
- All tests passing for modified services
- No regressions in existing functionality
- Documentation updated in PHASE-7D-MEDIUM-BUG-AUDIT.md
- Clear commit messages with full bug IDs

---

**Last Updated:** 2026-04-15  
**Status:** Ready for phased implementation
