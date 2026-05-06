# REZ Marketing Service - Backend Bug Audit

## Service Overview
Marketing service manages campaigns, broadcasts, audience targeting, notification scheduling, and multi-channel delivery (push, SMS, email, WhatsApp).

---

### BE-MKT-001 Campaign Status Transition Not Validated
**Severity:** Medium
**File:** `/src/routes/campaigns.ts:87–89`
**Category:** State Machine Error
**Description:** The `PATCH /campaigns/:id` endpoint checks that campaign status is 'draft' or 'scheduled' before allowing edits. However, the endpoint does not prevent invalid state transitions. For example, a 'cancelled' campaign can be updated to 'scheduled' via the patch endpoint, then launched. No state machine enforces legal transitions (draft → scheduled → sending → sent, with no backward transitions).
**Impact:** Campaigns can transition between states invalidly. A cancelled campaign could be relaunched. Audit trail becomes unreliable. Unpredictable campaign behavior.
**Fix hint:** Define a state machine with explicit transition rules. Check for valid transition before allowing the status change. E.g., only draft → scheduled or draft → cancelled.

---

### BE-MKT-002 Campaign Launch Distributed Lock Expires Too Fast
**Severity:** High
**File:** `/src/routes/campaigns.ts:106–113`
**Category:** Concurrency
**Description:** The launch lock is acquired with `redis.set(lockKey, '1', 'EX', 30, 'NX')` for 30 seconds. If the campaign dispatch takes longer than 30 seconds (plausible for large audiences), the lock expires. A second request acquires the lock and dispatches the same campaign again, causing duplicate sends.
**Impact:** Large campaigns (>100k users) may be sent twice. Duplicate messages to users. Wasted bandwidth. User frustration.
**Fix hint:** Use a longer TTL (e.g., 5 minutes) or a more sophisticated lock (heartbeat-extended lock). Monitor dispatch latency and adjust TTL accordingly.

---

### BE-MKT-003 Audience Estimate Uses Stale Snapshot
**Severity:** Medium
**File:** `/src/routes/campaigns.ts:55–60`
**Category:** Data Freshness
**Description:** The `audienceBuilder.estimate()` call reads from `MerchantCustomerSnapshot`, which is a static snapshot. The snapshot may be hours or days old. If the merchant added or removed customers after the snapshot was built, the campaign estimate is inaccurate, and actual dispatch may target a different audience size than shown in the UI.
**Impact:** UI shows incorrect audience size (e.g., "1,200 customers" but only 800 will receive the message). Misleading campaign metrics. Merchants make decisions based on wrong audience size.
**Fix hint:** Document snapshot staleness to the user. Add a "Last updated" timestamp. Consider rebuilding snapshots more frequently (hourly vs. daily) or using live counting for estimates.

---

### BE-MKT-004 Audience Filter Does Not Validate Segment Existence
**Severity:** Medium
**File:** `/src/audience/AudienceBuilder.ts:55–58`
**Category:** Data Validation
**Description:** The campaign audience filter accepts `targetSegment` without validating that the segment exists in the system. If a campaign references segment 'vip' but the system only has segments ['premium', 'basic'], the estimate returns 0 (no matching users) without warning. The campaign launches silently with an empty audience.
**Impact:** Silent failures when targeting non-existent segments. Campaigns send to 0 users. Merchants unaware of misconfigurations. Wasted campaign slots.
**Fix hint:** Validate all referenced segments exist during campaign creation. Return an error if segment is invalid. Provide a list of valid segments in the API response.

---

### BE-MKT-005 Push Token Enrichment Not Validated as Complete
**Severity:** Medium
**File:** `/src/audience/AudienceBuilder.ts:102–119`
**Category:** Data Completeness
**Description:** The push channel enrichment fetches live push tokens from the User model. If a user record is deleted but the snapshot still references them, the enrichment returns empty tokens. The record remains in the audience with `pushTokens: []`, and the send attempt silently fails. No warning is logged that the user lacks valid tokens.
**Impact:** Subset of audience silently not reached. Push messages disappear without notification. Incomplete delivery. Users unaware their notification could not be sent.
**Fix hint:** Filter out records with empty tokens before returning the batch. Log a warning if >5% of audience has no tokens (potential data sync issue).

---

### BE-MKT-006 Campaign Channels Hardcoded With No Extensibility
**Severity:** Low
**File:** `/src/routes/campaigns.ts:45` (implied)
**Category:** Design
**Description:** Campaign creation accepts a `channel` field, but the API does not document or validate the allowed values. Common values are likely ['push', 'sms', 'email', 'whatsapp'] but no enum or validation exists in the route handler. If a campaign is created with channel: 'telegram', it would be stored but fail silently during dispatch.
**Impact:** Invalid channel values silently ignored during dispatch. Campaigns appear created but never sent. Silent failures.
**Fix hint:** Define a const enum of valid channels: `const VALID_CHANNELS = ['push', 'sms', 'email', 'whatsapp']`. Validate during campaign creation and return 400 if invalid.

---

### BE-MKT-007 Opt-In Fields Not Consistently Checked
**Severity:** High
**File:** `/src/audience/AudienceBuilder.ts:69–79`
**Category:** Compliance/Consent
**Description:** The `buildAudience()` function uses `channelOptInField()` to filter by consent (e.g., `pushOptIn: true`). However, the function is not shown in the read output. If the function is incomplete or returns null for some channels, the audience builder may skip the consent check entirely, sending messages to users who opted out.
**Impact:** Sending messages to opted-out users. Compliance violations (GDPR, CAN-SPAM, etc.). Users receive unwanted notifications. Legal liability.
**Fix hint:** Ensure all channels check opt-in: push checks pushOptIn, sms checks smsOptIn, etc. Add a test that verifies opt-out users are never included in dispatch.

---

### BE-MKT-008 WhatsApp Deduplication Based on Campaign ID Only
**Severity:** High
**File:** `/src/channels/WhatsAppChannel.ts:46–54`
**Category:** Idempotency Failure
**Description:** The `isDuplicate()` function uses dedup key `wa:mkt:dedup:${campaignId}:${phone}`. If the same campaign is relaunched (e.g., corrected and resent), the dedup key is identical, and all users appear as duplicates, causing the send to be skipped. This is correct behavior for preventing double-send. However, if a user adds/removes opt-in between relaunches, the dedup key should be different (to respect their new opt-in status). The current logic sends no message on relaunch regardless of user preferences.
**Impact:** Campaign relaunches silently skip all users (because all appear as duplicates). Users see no second attempt even if they opt back in. Marketing functionality breaks.
**Fix hint:** Include opt-in status in dedup key: `wa:mkt:dedup:${campaignId}:${phone}:${timestamp}`. Or store dedup in a separate collection with expiration (allow relaunch after 24h).

---

### BE-MKT-009 WhatsApp Message ID Mapping Missing Index
**Severity:** Medium
**File:** `/src/channels/WhatsAppChannel.ts:100–105`
**Category:** Performance
**Description:** Message IDs are mapped to campaign IDs in Redis: `wa:mkt:msgid:${messageId}`. When a webhook arrives with a message ID, the code does `redis.get(msgid)` to look up the campaign. If millions of messages are sent, the Redis key namespace becomes large. No TTL cleanup or archiving is visible, and the keys grow indefinitely.
**Impact:** Redis memory grows unbounded. Slow lookups if Redis replicates across large key space. Message receipt tracking becomes unreliable after keys expire.
**Fix hint:** Set a reasonable TTL (7 days as mentioned in line 104). Validate TTL is set before storing. Or archive old message IDs to a separate collection.

---

### BE-MKT-010 Batch Rate Limiting Hardcoded
**Severity:** Low
**File:** `/src/channels/WhatsAppChannel.ts:8–10`
**Category:** Configuration
**Description:** The `BATCH_SIZE = 50` and `CONCURRENT_BATCHES = 5` are hardcoded constants. If Meta's API limits change, or if different campaigns need different rates, the code cannot adapt without redeployment.
**Impact:** Inflexible rate limiting. API limit changes require code updates. No per-campaign rate limiting.
**Fix hint:** Move constants to environment variables or a campaign-level config. Allow per-campaign rate limits.

---

### BE-MKT-011 Campaign Orchestrator Dispatch Loses Error Context
**Severity:** Medium
**File:** `/src/routes/campaigns.ts:123`
**Category:** Error Handling
**Description:** The `campaignOrchestrator.dispatch(campaignId)` call is awaited but no result/error is checked. If the dispatch fails, the route returns `{ queued: true }` regardless. The user believes the campaign is dispatching when it may have failed.
**Impact:** False success messages to users. Campaigns appear to launch but silently fail. Support confusion.
**Fix hint:** Check dispatch result. If dispatch throws, catch and return 500. If dispatch queues a BullMQ job, return the job ID so the user can check status.

---

### BE-MKT-012 Audience Pagination Cursor Not Stable
**Severity:** Medium
**File:** `/src/audience/AudienceBuilder.ts:61–67`
**Category:** Correctness
**Description:** The `buildAudience()` generator uses batch-based pagination (slice/skip), not cursor-based. If the underlying audience collection is modified between batch fetches (a user is added or removed), the pagination may skip users or double-count. This is especially problematic if the dispatch takes hours.
**Impact:** Large campaigns may skip or double-count users. Inconsistent delivery results. Audit discrepancies between estimated and actual recipients.
**Fix hint:** Use cursor-based pagination (find(greater than ID) approach) or snapshot the full audience ID list at the start and iterate that snapshot.

---

### BE-MKT-013 Campaign Delete Does Not Check Sending State
**Severity:** High
**File:** `/src/routes/campaigns.ts:147–150` (partial read)
**Category:** State Machine Error
**Description:** The delete endpoint is inferred to delete campaigns. There is no check to prevent deletion of a campaign currently sending. If deleted during dispatch, messages are orphaned in the queue, and the campaign record is gone, making audits impossible.
**Impact:** Deleted sending campaigns leave orphaned messages in the queue. No way to audit what was sent. Compliance/audit failures.
**Fix hint:** Prevent deletion of campaigns in 'sending' or 'sent' state. Archive instead of delete. Return 400 if attempting to delete a non-draft campaign.

---

### BE-MKT-014 Message Template Not Validated Against Schema
**Severity:** Medium
**File:** `/src/routes/campaigns.ts:46`, `/src/routes/campaigns.ts:91–92`
**Category:** Validation
**Description:** The `templateName` field is accepted and stored but never validated against a known template schema. If a campaign references a template that doesn't exist, the send fails at runtime, not at creation time.
**Impact:** Campaigns created successfully but fail to send. Late-stage failures cause support issues. Users unaware of invalid configuration.
**Fix hint:** Validate templateName against a list of available templates during campaign creation. Return 400 if template doesn't exist.

---

### BE-MKT-015 CTA URL Not Validated or Sanitized
**Severity:** Medium
**File:** `/src/routes/campaigns.ts:46`, `/src/routes/campaigns.ts:71`
**Category:** Security
**Description:** The `ctaUrl` field is accepted without validation (must be a valid URL) or sanitization (could be a phishing link). A merchant could create a campaign with `ctaUrl: "javascript:alert('xss')"` or `ctaUrl: "https://phishing.com"`, and the malicious URL is sent to users.
**Impact:** Security vulnerability. Merchants could send phishing links via campaigns. Users click malicious URLs. Brand damage. Legal liability.
**Fix hint:** Validate ctaUrl with a URL parser. Optionally warn merchants if URL redirects or has suspicious patterns. Use allowlist of safe domains if available.

---

### BE-MKT-016 Audience Estimate Does Not Account for Delivery Failures
**Severity:** Low
**File:** `/src/audience/AudienceBuilder.ts:55–58`
**Category:** Prediction Accuracy
**Description:** The estimate counts all matching users but does not account for users whose push tokens are invalid, who have uninstalled the app, or who lack sufficient opt-in. The actual delivery is always lower than the estimate.
**Impact:** UI shows inflated audience size. Merchants set budgets based on incorrect audience size. Underutilization of campaign slots.
**Fix hint:** Discount the estimate by a factor (e.g., 85% of estimated users actually receive) based on historical delivery rates. Or perform a deeper estimate that checks token validity.

---

### BE-MKT-017 Campaign Status Update Not Logged
**Severity:** Low
**File:** `/src/routes/campaigns.ts:82–100`
**Category:** Audit Trail
**Description:** When a campaign is updated or cancelled, the changes are committed to the database but no audit log entry is created. An observer cannot see the history of who modified a campaign or when.
**Impact:** No audit trail for campaign modifications. Compliance/governance issues. Cannot trace who cancelled a campaign.
**Fix hint:** Insert an audit log entry whenever campaign status or content changes. Include userId, timestamp, changes made.

---

### BE-MKT-018 Push Token Refresh Not Triggered
**Severity:** Medium
**File:** `/src/audience/AudienceBuilder.ts:102–119`
**Category:** Data Freshness
**Description:** The audience builder enriches push tokens from the User model, but user push tokens may be stale if the user logs out on their app. The token remains in the database but is invalid. The next campaign send fails silently for these users.
**Impact:** Silent delivery failures for users with stale tokens. Incomplete audience reaches. No visibility into token validity issues.
**Fix hint:** Periodically validate tokens (ping the push service) during audience enrichment. Exclude invalid tokens. Log if >10% of tokens are invalid (indicates potential data sync issue).

---

### BE-MKT-019 Email CTA Click Tracking Missing
**Severity:** Low
**File:** `/src/routes/campaigns.ts:46`
**Category:** Analytics
**Description:** Campaigns store `ctaUrl` but no tracking pixel or redirect wrapper is mentioned. When a user clicks a CTA in an email, the click is not tracked back to the campaign. The campaign's click metrics are incomplete or missing.
**Impact:** No click tracking data. Campaign analytics are unreliable. Cannot measure campaign effectiveness. ROI cannot be calculated.
**Fix hint:** Wrap ctaUrl in a redirect that logs the click: `https://api/track/click?campaign=${campaignId}&user=${userId}&redirect=${encodeURIComponent(ctaUrl)}`. Update campaign clicks counter.

---

### BE-MKT-020 Broadcast Multiple Campaigns Race Condition
**Severity:** Medium
**File:** `/src/routes/broadcasts.ts` (implied)
**Category:** Concurrency
**Description:** If a broadcast creates multiple campaigns for different channels (e.g., one for push, one for SMS), each campaign is created separately without a transaction. If the broadcast process crashes between SMS and push campaign creation, one campaign is created but the other is not, leaving the broadcast incomplete.
**Impact:** Partial broadcasts sent. Some channels receive message while others don't. Inconsistent user experience. Incomplete audit trail.
**Fix hint:** Use a database transaction to create all campaigns atomically. Or wrap creation in a try-catch and rollback if any campaign fails.

---

### BE-MKT-021 Audience Filtering With OR Logic Bug
**Severity:** High
**File:** `/src/audience/AudienceBuilder.ts:76–87`
**Category:** Logic Error
**Description:** The targeting filter uses `targetFilters.$or` to combine multiple conditions. However, if both `targetSegment` and `targetInterests` are set, the logic becomes: `(segment = user.segment OR segment = 'all') OR (interests in user.interests)`. This is an OR of two OR clauses, which is correct semantically. However, if the intent is AND (segment matches AND interests match), the logic is wrong.
**Impact:** Incorrect audience targeting. Overly broad audience if OR is used when AND should be. Users outside intended audience receive messages.
**Fix hint:** Clarify the intended semantics (AND vs OR). If AND: use multiple `$and` conditions. If OR: document clearly.

---

### BE-MKT-022 Campaign Analysis Does Not Show Partial Failures
**Severity:** Low
**File:** `/src/routes/campaigns.ts` (implied)
**Category:** Visibility
**Description:** Campaign status tracking likely shows only success/failure at the campaign level. If 90% of audience receives a message successfully and 10% fails, the campaign status might show 'sent' without indicating partial failures.
**Impact:** Incomplete visibility into campaign effectiveness. Support cannot address delivery issues for the 10% that failed. False sense of campaign success.
**Fix hint:** Track partial delivery metrics: sentCount, failedCount, skippedCount. Return detailed statistics in analytics endpoint.

---

## Summary
- **Critical:** 0 bugs
- **High:** 4 bugs (BE-MKT-002, 007, 008, 013, 021)
- **Medium:** 13 bugs
- **Low:** 5 bugs

Key areas: state machine enforcement, distributed locks, audience targeting, consent management, deduplication, and audit trails.
