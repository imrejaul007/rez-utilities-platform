# Event Services Audit

## Overview
Audit of rez-notification-events, rez-media-events, and analytics-events services. Issues identified in event schema validation, channel routing, delivery guarantees, dead-letter queue handling, and pipeline ordering.

---

### BE-EVT-001 Notification Event Missing Required userId Validation
**Severity:** MEDIUM
**File:** `rez-notification-events/src/worker.ts` (line 27-50)
**Category:** Event Schema Validation
**Description:** `NotificationEvent` interface defines `userId: string` as required (line 30), but there is no validation that `userId` is not empty or is a valid ObjectId. The `sendPush()` function checks if it's valid (line 62) but other channels assume it's valid.
**Impact:** Invalid userId values may bypass validation and cause runtime errors in downstream channels.
**Fix hint:** Add Zod schema validation for NotificationEvent at queue entry point; validate userId before processing.

---

### BE-EVT-002 Push Notification Handler Silently Skips Missing Tokens
**Severity:** MEDIUM
**File:** `rez-notification-events/src/worker.ts` (line 54-92)
**Category:** Delivery Reliability
**Description:** `sendPush()` returns `'skipped:no-push-token'` if no devices found (line 71), but the worker logs this as a result without alerting the application. User never receives notification but no error is recorded.
**Impact:** Notifications silently fail to deliver without alerting operators or users.
**Fix hint:** Return a "partial_failure" status; emit monitoring alert when push tokens are missing; log to DLQ if critical.

---

### BE-EVT-003 Email Address Resolution May Silently Fail
**Severity:** MEDIUM
**File:** `rez-notification-events/src/worker.ts` (line 94-123)
**Category:** Delivery Reliability
**Description:** `sendEmail()` checks for email in `event.payload.data?.email` or `event.payload.to`, but if both are missing, it logs a warning (line 100) but only at WARN level. The notification is silently skipped without alerting higher-level services.
**Impact:** Emails silently fail to send; customers unaware of missing notifications.
**Fix hint:** Emit event to admin queue or alert system; persist failed delivery for manual review.

---

### BE-EVT-004 SendGrid API Key Not Cached
**Severity:** LOW
**File:** `rez-notification-events/src/worker.ts` (line 110-113)
**Category:** Performance
**Description:** `sendEmail()` imports @sendgrid/mail and sets API key on every call. The import is awaited and the setApiKey() is called for every single email, adding overhead.
**Impact:** Performance degradation; unnecessary overhead for each email.
**Fix hint:** Import and configure SendGrid client once at startup; cache it globally.

---

### BE-EVT-005 SMS Channel Does Not Fall Back to Twilio
**Severity:** MEDIUM
**File:** `rez-notification-events/src/worker.ts` (line 125-150)
**Category:** Delivery Reliability
**Description:** `sendSms()` tries MSG91 first (line 133) and returns `'skipped:no-sms-provider'` if MSG91 is not configured. No fallback to Twilio is implemented. If MSG91_API_KEY is not set, SMS is never sent even if Twilio is available.
**Impact:** SMS notifications never sent unless MSG91 is configured, even if Twilio is available.
**Fix hint:** Implement fallback logic: try MSG91, then Twilio, then return skipped.

---

### BE-EVT-006 Phone Number Sanitization May Remove Valid Digits
**Severity:** MEDIUM
**File:** `rez-notification-events/src/worker.ts` (line 126-127)
**Category:** Input Validation
**Description:** Phone number is sanitized with `.replace(/[^\d+]/g, '')`, removing all non-digit characters except `+`. If phone number has spaces, dashes, or parentheses, they are stripped. A valid format like "+91 98765 43210" becomes "+919876543210". However, if passed as an object instead of string, `String(rawPhone)` may produce incorrect results.
**Impact:** Phone numbers with formatting may be mangled; non-string phone numbers may fail.
**Fix hint:** Validate phone format before sanitization; handle non-string inputs safely.

---

### BE-EVT-007 WhatsApp Variable Replacement May Fail for Undefined Values
**Severity:** MEDIUM
**File:** `rez-notification-events/src/worker.ts` (line 165-169)
**Category:** Delivery Reliability
**Description:** WhatsApp body fallback checks `vars.length >= 2` and uses `vars[0]` and `vars[1]` directly. If the array has fewer than 2 elements, the fallback still tries to access them, resulting in undefined values.
**Impact:** WhatsApp messages may contain "undefined" strings instead of actual values.
**Fix hint:** Validate array length before accessing indices; provide default values.

---

### BE-EVT-008 Meta WhatsApp Template Variables Unchecked
**Severity:** MEDIUM
**File:** `rez-notification-events/src/worker.ts` (line 183-187)
**Category:** Delivery Reliability
**Description:** WhatsApp template variables are mapped directly from `event.payload.whatsappTemplateVars` without validation. If the array has missing elements or unexpected types, the template may fail to render.
**Impact:** WhatsApp API calls may fail; incomplete variable substitution.
**Fix hint:** Validate template variables against template schema; provide error on missing variables.

---

### BE-EVT-009 In-App Notification userId ObjectId Conversion May Fail Silently
**Severity:** MEDIUM
**File:** `rez-notification-events/src/worker.ts` (line 218-223)
**Category:** Data Validation
**Description:** `handleInApp()` tries to convert `event.userId` to ObjectId (line 220-222), but the try-catch silently falls back to string if conversion fails. If userId is invalid, it's stored as a string instead of ObjectId, causing future queries by other services (which expect ObjectId) to fail.
**Impact:** In-app notifications may be created with wrong userId type; future queries by other services fail to find them.
**Fix hint:** Validate userId format before inserting; enforce ObjectId type or fail the job.

---

### BE-EVT-010 Notification Channel Errors Do Not Fail the Job
**Severity:** MEDIUM
**File:** `rez-notification-events/src/worker.ts` (line 299-307)
**Category:** Job Failure Handling
**Description:** If a channel handler throws an error, the error is caught (line 299) and results are recorded, but the job does not fail. The worker completes successfully even if all channels failed (line 329). The job is only retried if the throw happens outside the try-catch.
**Impact:** Failed notifications are not retried; customers miss notifications without retry attempt.
**Fix hint:** Track channel failures; fail the job if critical channels (email, push) fail; allow partial success for non-critical channels.

---

### BE-EVT-011 Notification Worker Limiter Configuration Is Unclear
**Severity:** LOW
**File:** `rez-notification-events/src/worker.ts` (line 334)
**Category:** Performance / Documentation
**Description:** Worker is configured with `limiter: { max: 200, duration: 1000 }` with 10 concurrency. It's unclear if the limiter applies globally or per-worker instance. The documentation doesn't explain if this is per-service or per-pod.
**Impact:** Unclear scaling behavior; rate limiting may not work as intended.
**Fix hint:** Add clear documentation; clarify if limiter is per-instance or cluster-wide.

---

### BE-EVT-012 DLQ Handler Does Not Check If Job Already in DLQ
**Severity:** MEDIUM
**File:** `rez-notification-events/src/workers/dlqWorker.ts` (line 61-99)
**Category:** Dead-Letter Queue / Idempotency
**Description:** When a job is moved to DLQ, there's no check to prevent duplicate DLQ entries. If the worker crashes after queuing to DLQ but before acknowledging the original job, the same job may be retried and forwarded to DLQ again.
**Impact:** DLQ may contain duplicate entries for the same job.
**Fix hint:** Use idempotent DLQ entry ID based on original job ID; use SETNX to ensure single entry.

---

### BE-EVT-013 DLQ Log Insertion May Mask Original Failure
**Severity:** MEDIUM
**File:** `rez-notification-events/src/workers/dlqWorker.ts` (line 112-136)
**Category:** Error Handling / Observability
**Description:** If MongoDB write fails (line 131), the error is logged and execution continues (line 135). The original DLQ queue entry is already saved, so the job is considered handled. But the MongoDB persistence may be critical for audit trails, and the failure is only logged as a non-fatal error.
**Impact:** DLQ entries may not be persisted to MongoDB; no audit trail for regulatory compliance.
**Fix hint:** Make MongoDB DLQ log writes critical; retry with exponential backoff or emit alert on failure.

---

### BE-EVT-014 DLQ Queue Retains All Failed Jobs Indefinitely
**Severity:** MEDIUM
**File:** `rez-notification-events/src/workers/dlqWorker.ts` (line 34-36)
**Category:** Data Retention / Cleanup
**Description:** DLQ queue is configured with `removeOnComplete: false, removeOnFail: false`, meaning jobs are never automatically cleaned up. Over time, DLQ will grow unboundedly.
**Impact:** Unbounded DLQ growth; database storage exhaustion; slow queries on large DLQ.
**Fix hint:** Implement periodic cleanup job; archive DLQ entries older than 90 days to separate storage.

---

### BE-EVT-015 Media Worker Does Not Validate Image URL Before Download
**Severity:** MEDIUM
**File:** `rez-media-events/src/worker.ts` (line 155-162)
**Category:** Input Validation
**Description:** `image.uploaded` event payload requires `imageUrl`, but the URL is not validated to be a valid HTTP(S) URL. A malicious URL could cause SSRF attacks or resource exhaustion.
**Impact:** Potential SSRF; unbounded resource consumption from malicious URLs.
**Fix hint:** Validate URL using URL API; whitelist domains; enforce HTTPS only.

---

### BE-EVT-016 Image Download Timeout May Be Bypassed
**Severity:** MEDIUM
**File:** `rez-media-events/src/worker.ts` (line 56-59)
**Category:** Timeout Enforcement
**Description:** `downloadImage()` sets `timeout: 30_000` but if the server sends the headers quickly and then streams slowly, the timeout may not be enforced correctly by axios. Large images could cause OOM.
**Impact:** Large image downloads may consume unbounded memory; DOS vector.
**Fix hint:** Set stream timeout; enforce maximum file size; implement retry logic with exponential backoff.

---

### BE-EVT-017 Sharp Image Resize May Fail on Corrupted Images
**Severity:** MEDIUM
**File:** `rez-media-events/src/worker.ts` (line 64-69)
**Category:** Error Handling
**Description:** `resizeImage()` does not validate image buffer format or size before passing to sharp. Corrupted or oversized images could cause sharp to hang or consume excessive memory.
**Impact:** Malformed images may hang the worker; DOS vector.
**Fix hint:** Validate image format using magic bytes; enforce maximum dimensions; add timeout wrapper.

---

### BE-EVT-018 Cloudinary Upload Uses Non-Atomic Multiple Steps
**Severity:** MEDIUM
**File:** `rez-media-events/src/worker.ts` (line 154-231)
**Category:** Transaction / Atomicity
**Description:** Image optimization pipeline (lines 184-205) downloads, resizes, uploads, and updates MongoDB in separate steps. If the pipeline fails partway through, the entity may be left with partial or no variants. No rollback mechanism.
**Impact:** Orphaned image uploads in Cloudinary; incomplete entity updates; inconsistent state.
**Fix hint:** Implement transaction-like semantics; store pipeline state in DLQ if failure occurs; allow manual recovery.

---

### BE-EVT-019 MongoDB ObjectId Validation Uses Mongoose Function
**Severity:** LOW
**File:** `rez-media-events/src/worker.ts` (line 164)
**Category:** Dependency / Coupling
**Description:** `mongoose.isValidObjectId()` is called directly without checking if mongoose is initialized. If MongoDB connection fails, this could throw before the connection is established.
**Impact:** Potential race condition on startup; unclear error messages.
**Fix hint:** Add connection check before validation; use utility function wrapper.

---

### BE-EVT-020 Cloudinary Public ID Derivation May Fail for Special URLs
**Severity:** MEDIUM
**File:** `rez-media-events/src/worker.ts` (line 175-178)
**Category:** Input Parsing
**Description:** Public ID is derived from URL filename by splitting on `/` and removing extension. If the URL has query parameters or anchors, the parsing may be incorrect. Example: `https://cdn.com/image.jpg?size=large` would extract `image.jpg?size=large` then remove `.jpg`, leaving `image` with the query string stripped incorrectly.
**Impact:** Incorrect public IDs; potential collisions or missing variants.
**Fix hint:** Use URL API to parse; extract path component before filename; handle query parameters explicitly.

---

### BE-EVT-021 Image Variant Processing Does Not Validate Output
**Severity:** MEDIUM
**File:** `rez-media-events/src/worker.ts` (line 189-205)
**Category:** Data Validation
**Description:** After uploading variants (line 197), the URL is stored without validating that the upload was successful. If Cloudinary returns a malformed URL or upload fails silently, the variant URL may be invalid.
**Impact:** Invalid image URLs stored in database; 404 errors when accessing variants.
**Fix hint:** Validate response from uploadResizedToCloudinary; verify URL is accessible before storing.

---

### BE-EVT-022 MongoDB Document Update May Fail Silently in Pipeline
**Severity:** MEDIUM
**File:** `rez-media-events/src/worker.ts` (line 208-214)
**Category:** Error Handling
**Description:** MongoDB update (line 210) is wrapped in try-catch that only logs the error. If the update fails, the variantUrls are still used to emit notification event (line 218), which may reference URLs that weren't persisted to the entity.
**Impact:** Inconsistent state; notification references unpersisted URLs.
**Fix hint:** Fail the job if MongoDB update fails; prevent notification from being emitted.

---

### BE-EVT-023 Image Processed Notification May Be Lost
**Severity:** MEDIUM
**File:** `rez-media-events/src/worker.ts` (line 218-228)
**Category:** Event Delivery
**Description:** Notification queue add (line 218) is not awaited. If the queue add fails, the error is not caught, and the job still completes successfully.
**Impact:** Image processed notifications may not be queued; dependent workflows miss events.
**Fix hint:** Await the notification queue add; fail the job if it fails.

---

### BE-EVT-024 CDN Invalidation Public ID Extraction May Be Incorrect
**Severity:** MEDIUM
**File:** `rez-media-events/src/worker.ts` (line 293-295)
**Category:** URL Parsing
**Description:** Regex `\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$` extracts public ID from URL. The regex assumes Cloudinary URL structure. For non-Cloudinary URLs or edge cases, the regex may fail to extract the correct public ID.
**Impact:** CDN invalidation may target wrong assets; cache not cleared.
**Fix hint:** Use Cloudinary SDK for URL parsing; validate URL structure before extraction.

---

### BE-EVT-025 Analytics Event Idempotency Key Relies on eventId Uniqueness
**Severity:** MEDIUM
**File:** `rez-analytics-events/src/worker.ts` (line 50-74)
**Category:** Idempotency / Event Schema
**Description:** Analytics worker assumes `eventId` is unique and uses it as the upsert key. If the event source publishes events with non-unique IDs, duplicates will be silently deduplicated instead of reported as errors.
**Impact:** Event duplicates silently treated as same event; potential data loss.
**Fix hint:** Validate eventId format and uniqueness at event ingestion; use composite key if needed.

---

### BE-EVT-026 Analytics Daily Metrics Aggregation Not Atomic
**Severity:** MEDIUM
**File:** `rez-analytics-events/src/worker.ts` (line 77-90)
**Category:** Atomicity / Consistency
**Description:** Analytics event upsert (line 53) and daily metrics aggregation (line 80) are two separate database operations. If the second operation fails, the event is already persisted, leading to inconsistent metric counts.
**Impact:** Metrics may not reflect all events; analytics reports inaccurate.
**Fix hint:** Use MongoDB transactions or batch the operations together.

---

### BE-EVT-027 Analytics Worker May Double-Count on Retry
**Severity:** MEDIUM
**File:** `rez-analytics-events/src/worker.ts` (line 50-90)
**Category:** Idempotency
**Description:** The idempotent upsert (line 54) prevents duplicate events, but the daily metrics aggregation (line 80) uses `$inc` which increments on every attempt. If the event is already in the DLQ and retried, metrics will be incremented again.
**Impact:** Metrics over-count on retries; inaccurate daily aggregates.
**Fix hint:** Use idempotent aggregation logic; track aggregation separately from event persistence.

---

### BE-EVT-028 Analytics Worker Does Not Validate Data Amount Field
**Severity:** LOW
**File:** `rez-analytics-events/src/worker.ts` (line 83)
**Category:** Data Validation
**Description:** Daily metrics aggregation uses `event.data.amount || 0` without validation. If `amount` is a negative number or non-numeric string, the aggregation may produce incorrect totals.
**Impact:** Analytics totals may be incorrect; financial reports inaccurate.
**Fix hint:** Validate amount is a non-negative number; coerce to number before aggregation.

---

### BE-EVT-029 Missing Event Schema Definitions
**Severity:** MEDIUM
**File:** All event worker files
**Category:** Schema Validation
**Description:** Event interfaces (NotificationEvent, MediaEvent, AnalyticsQueueEvent) are defined in worker.ts but not exported or centralized. No Zod schemas exist for validation at queue entry. Events are consumed directly from the queue without schema validation.
**Impact:** No runtime validation of event structure; invalid events silently processed; type safety only at compile time.
**Fix hint:** Create centralized event schema file; export Zod schemas; validate all events at queue entry.

---

### BE-EVT-030 Notification Worker Does Not Handle Partial Channel Failures
**Severity:** MEDIUM
**File:** `rez-notification-events/src/worker.ts` (line 274-329)
**Category:** Delivery Reliability
**Description:** Worker processes all channels but does not differentiate between critical and optional channels. If email fails but SMS succeeds, the job completes successfully without retrying email.
**Impact:** Critical notifications may partially fail; users unaware of missed notifications.
**Fix hint:** Implement channel priority; fail job if critical channels fail; retry only critical channels.

---

### BE-EVT-031 Streak At Risk Worker Missing in Exports
**Severity:** MEDIUM
**File:** `rez-notification-events/src/index.ts`
**Category:** Service Integration
**Description:** `startStreakAtRiskScheduler()` is imported (line 18) but no documentation on its contract or SLA. The scheduler may have its own bugs or failure modes not covered by DLQ.
**Impact:** Streak notifications may fail silently; no observability.
**Fix hint:** Add scheduler implementation review; add monitoring and alerting.

---

### BE-EVT-032 No Event Ordering Guarantee Across Services
**Severity:** HIGH
**File:** All event worker files
**Category:** Event Ordering / Causality
**Description:** BullMQ processes jobs in FIFO order per queue, but consumers may process events out of order if they crash and replay from DLQ. Additionally, there's no ordering guarantee across different event queues (notification, media, analytics).
**Impact:** State machines may receive events out of order; cascading failures; inconsistent system state.
**Fix hint:** Implement event versioning; add causal ordering via event versioning; implement saga pattern for cross-queue ordering.

---

### BE-EVT-033 Notification Event Does Not Include Priority Field
**Severity:** LOW
**File:** `rez-notification-events/src/worker.ts`
**Category:** Feature Request
**Description:** NotificationEvent has no priority field to distinguish critical notifications (e.g., security alerts) from informational ones. All notifications are processed with same priority.
**Impact:** Security alerts may be delayed; no SLA differentiation.
**Fix hint:** Add priority field to event; route critical notifications to priority queue.

---

### BE-EVT-034 Media Worker Hardcodes IMAGE_SIZES
**Severity:** LOW
**File:** `rez-media-events/src/worker.ts` (line 44-48)
**Category:** Configuration
**Description:** Image sizes are hardcoded in the worker. If sizes need to change, the service must be redeployed. No configuration management.
**Impact:** Inflexible image processing; expensive to change sizes.
**Fix hint:** Move sizes to environment variables or configuration service; allow dynamic sizing.

---

### BE-EVT-035 Analytics Event Timestamp Parsing May Fail
**Severity:** MEDIUM
**File:** `rez-analytics-events/src/worker.ts` (line 78)
**Category:** Data Validation
**Description:** `new Date(event.createdAt)` assumes `createdAt` is a valid ISO string. If the format is unexpected, parsing may silently fail, resulting in `Invalid Date`.
**Impact:** Metrics aggregated with wrong date; reports inaccurate.
**Fix hint:** Validate createdAt format before parsing; use date parsing library with error handling.

---

## Summary

- **Total Bugs Found:** 35
- **Critical:** 1 (BE-EVT-032)
- **High:** 2 (BE-EVT-010, BE-EVT-032)
- **Medium:** 25
- **Low:** 8

**Key Areas of Concern:**
1. **Event Schema Validation** — Missing validation at queue entry; type-safe only at compile time
2. **Delivery Failures** — Silent failures; no alerting or retry logic differentiation
3. **Atomicity** — Multi-step operations without rollback or transactions
4. **Event Ordering** — No guarantees across services; cascading failures
5. **Error Handling** — Partial failures treated as complete success
6. **Resource Management** — DLQ unbounded growth; image download/resize vulnerabilities
7. **Input Validation** — URLs, phone numbers, images not validated before processing

**Critical Risk:**
- **BE-EVT-032**: Event ordering issues may cause state machine failures and inconsistent system state. Requires immediate attention for order processing pipelines.
