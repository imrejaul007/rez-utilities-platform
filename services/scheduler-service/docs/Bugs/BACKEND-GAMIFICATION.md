# REZ Gamification Service - Backend Bug Audit

## Service Overview
Gamification service handles achievements, streaks, leaderboards, and coin rewards via BullMQ workers and REST endpoints.

---

### BE-GAM-001 Tier Calculation Boundary Off-by-One
**Severity:** Medium
**File:** `/src/httpServer.ts:144–149`
**Category:** Logic Error
**Description:** The `getTier()` function uses `>=` thresholds, but boundaries overlap. A user with exactly 500 coins qualifies for both silver (500+) and bronze (<500). The function always returns the higher tier due to cascading `if` statements, but tier distribution becomes ambiguous when coin counts fall on exact boundaries. No coin loss occurs, but tier messaging may be inconsistent.
**Impact:** Cosmetic tier misalignment for users at boundary values (500, 2000, 5000 coins). Inconsistent UI tier display that doesn't match backend classification.
**Fix hint:** Use mutually exclusive ranges: L1: 0–499, L2: 500–1999, L3: 2000–4999, L4: 5000+. Clarify in comments if boundary behavior changes.

---

### BE-GAM-002 Leaderboard Cache Invalidation Race Condition
**Severity:** Medium
**File:** `/src/httpServer.ts:452–486`
**Category:** Concurrency
**Description:** The `/leaderboard/me` endpoint caches full aggregation in Redis for 60 seconds (`cacheKey = 'leaderboard:me:full'`), but does not account for concurrent cache invalidation from the worker. Between cache set and cache hit, the `invalidateLeaderboardCache()` call from worker.ts clears only the in-memory HTTP cache, not the Redis cache. Stale aggregation can persist for up to 60 seconds, showing outdated leaderboard positions.
**Impact:** Users see stale rank positions (lag up to 60s). New transactions don't appear in leaderboard immediately.
**Fix hint:** Propagate cache key invalidation from worker to both Redis and in-memory cache. Use a version number or timestamp suffix on the cache key to auto-expire stale results faster.

---

### BE-GAM-003 Achievement Worker Missing Null Safety on Streak
**Severity:** High
**File:** `/src/workers/achievementWorker.ts:140–146`
**Category:** Null Pointer
**Description:** In `getUserStats()`, if `streakDoc` is null, the `currentStreak` property is accessed with fallback `?? 0`. However, the ACHIEVEMENTS checks use numeric comparisons on potentially undefined streak values. If the field is missing from the profile document, the lock on `s.streak >= 3` (fifth_checkin achievement) could incorrectly evaluate as false even if the user has an active 3+ day streak stored elsewhere.
**Impact:** False negatives on streak-based achievement unlocks. Users may not earn "Streak Starter" or "Week Warrior" achievements even if eligible.
**Fix hint:** Ensure all fallbacks use `?? 0` consistently. Add defensive coding: validate `streak` is a number before comparison.

---

### BE-GAM-004 Leaderboard ObjectId Conversion Without Validation
**Severity:** Medium
**File:** `/src/httpServer.ts:166–172`
**Category:** Data Type Error
**Description:** In the leaderboard aggregation, user IDs are mapped from `cointransactions` collection (where `_id` may be a string, number, or ObjectId). The conversion attempts `new mongoose.Types.ObjectId(String(id))` with a try-catch, but if it fails silently, the `id` is passed as-is to the query. MongoDB then fails to match this invalid ID format in the Users collection lookup, returning no matching documents. Users without valid ObjectId formats drop from the leaderboard.
**Impact:** Some users may not appear on the leaderboard or display as "Unknown" even though they should have a rank. Incomplete leaderboard data.
**Fix hint:** Pre-validate all user IDs from cointransactions are ObjectIds. Use an explicit schema migration or query filter to ensure `user` field is stored as ObjectId, not string.

---

### BE-GAM-005 Async Race: Milestone Check Without Lock
**Severity:** High
**File:** `/src/httpServer.ts:593–639`
**Category:** Race Condition
**Description:** The `/internal/visit` endpoint increments `totalVisits` then checks if the new count matches a milestone threshold. Between the upsert completion and the milestone check, another concurrent request can increment the same user's visit count, causing the first request to miss the milestone. No distributed lock protects the read-modify-check flow for milestone detection.
**Impact:** Milestone coin rewards are skipped for users with concurrent visits (especially in busy stores). Users lose coins they should have earned at visit 7, 30, 100.
**Fix hint:** Use a distributed lock (Redis SET NX with TTL) before incrementing visit counts. Hold the lock through milestone detection to prevent race.

---

### BE-GAM-006 Coin Credit Idempotency Key Reuse Across Events
**Severity:** Medium
**File:** `/src/httpServer.ts:597–609`
**Category:** Idempotency Failure
**Description:** Milestone coins use a dedup key `visit-milestone-${userId}-${milestone.visits}`, e.g., `visit-milestone-user123-7`. If the same user earns the 7-visit milestone twice (e.g., data repair, re-sync), the dedup key is identical. Wallet service correctly skips the duplicate credit, but the endpoint returns success and logs the coin award again, confusing audit logs and creating orphaned ledger entries.
**Impact:** Audit logs show duplicate coin awards. Ledger entries may disagree with wallet balance history. Repair operations risk silent failures.
**Fix hint:** Include `eventId` or a timestamp in the dedup key: `visit-milestone-${userId}-${milestone.visits}-${Date.now()}`. Or use wallet service's automatic dedup with a unique request ID per HTTP call.

---

### BE-GAM-007 Wallet Service URL Fallback Silent Failure
**Severity:** High
**File:** `/src/httpServer.ts:41–52`
**Category:** Configuration/Initialization
**Description:** The `creditCoinsViaWalletService()` function logs an error and returns false if `WALLET_SERVICE_URL` is not set, but does not halt execution. Gamification features (achievements, streaks, milestones) continue normally without crediting coins, returning success: true to callers. Users believe they earned coins but the wallet remains unchanged.
**Impact:** Complete coin credit failure if wallet service URL is misconfigured. Silent data inconsistency—game progress and wallet balances diverge. Users lose trust in reward system.
**Fix hint:** During startup, validate WALLET_SERVICE_URL is set. Throw on missing config so the service fails to start. Or make wallet credit a critical operation that fails loudly.

---

### BE-GAM-008 Store Visit Streak Milestone Coins Not Deduped
**Severity:** Medium
**File:** `/src/workers/storeVisitStreakWorker.ts:65–91`
**Category:** Idempotency Failure
**Description:** In `enqueueCoinEarnedNotification()`, the `eventId` is hardcoded as `coin-earned-${userId}-${source}`, e.g., `coin-earned-user123-streak_milestone_7`. If a streak milestone notification is retried by BullMQ, the same eventId is used. The notification queue may deduplicate, but if a user hits the same milestone twice (reset + re-earn), they get two notifications with the same ID, confusing clients.
**Impact:** Duplicate notifications for the same milestone. Users see multiple "You earned X coins" messages for one event.
**Fix hint:** Include the job ID or attempt number in the eventId. Or rely on wallet service to handle dedup (not notification service).

---

### BE-GAM-009 Leaderboard Query Scan Limit Too Low
**Severity:** Low
**File:** `/src/httpServer.ts:468–472`
**Category:** Performance/Correctness
**Description:** The `/leaderboard/me` endpoint scans up to 1000 documents with `{ $limit: 1000 }` in the aggregation. If more than 1000 users have earned coins (highly likely in production), the `findIndex()` call may fail to locate a user ranked beyond position 1000. The endpoint returns "User not found in leaderboard" for valid users outside the top 1000.
**Impact:** High-ranked users (>1000) cannot query their leaderboard position. Broken feature for most of the user base. Incomplete leaderboard visibility.
**Fix hint:** Remove the aggregation limit or increase it substantially (e.g., 100,000). Cache full aggregation in Redis to avoid full collection scans on every request.

---

### BE-GAM-010 Achievement Visitor Count Filter Missing Status
**Severity:** Medium
**File:** `/src/workers/achievementWorker.ts:132–135`
**Category:** Logic Error
**Description:** Achievement progress is based on `storevisits.countDocuments({ userId: userOid, status: 'completed' })`, correctly filtering for completed visits. However, the HTTP endpoint `/achievements/:userId` calls `getUserVisitCount()` which queries `storevisits.countDocuments({ userId })` without the `status: 'completed'` filter. The HTTP response shows progress toward achievement including pending/cancelled visits, which should not count.
**Impact:** Inflated progress percentages in the UI. Users see they are 50% toward an achievement when they are actually only 30% (due to pending visits). Misleading achievement progress.
**Fix hint:** Apply `status: 'completed'` filter in `getUserVisitCount()` to match the achievement worker logic.

---

### BE-GAM-011 Notification Queue Singleton Not Properly Closed
**Severity:** Low
**File:** `/src/worker.ts:105–118`
**Category:** Resource Leak
**Description:** The `getNotifQueue()` function creates a singleton Queue instance and stores it in `_notifQueue`. The `stopWorker()` function closes `_notifQueue`, but if multiple workers call `getNotifQueue()` (e.g., achievementWorker, storeVisitStreakWorker), the same singleton is reused. If one worker stops, it closes the queue for all others, causing subsequent workers to fail with "Queue is closed" errors.
**Impact:** Second worker's notification sends fail after first worker shuts down. Workers crash with connection errors during graceful shutdown.
**Fix hint:** Use a proper DI container or refactor to create Queue per worker instance. Or defer Queue.close() until all workers have stopped.

---

### BE-GAM-012 IST Timezone Offset Hardcoded Without Validation
**Severity:** Medium
**File:** `/src/worker.ts:18–29` and `/src/workers/storeVisitStreakWorker.ts:32–54`
**Category:** Localization
**Description:** The IST offset is hardcoded as 5.5 hours (IST_OFFSET_MS). If the service is deployed in a different timezone region or the user's timezone preference is not IST, streak reset logic incorrectly determines day boundaries. For example, a user in PST (UTC-8) active at 23:00 PST (07:30 next day IST) has their streak incorrectly reset because the code evaluates day boundaries in IST, not their local timezone.
**Impact:** Streaks incorrectly reset for non-IST users. Inconsistent gamification experience across regions. Users lose streaks due to timezone mismatch.
**Fix hint:** Store user timezone preference in the user profile. Fetch timezone from user doc and apply offset dynamically, or use UTC with explicit conversion at display time.

---

### BE-GAM-013 DLQ (Dead-Letter Queue) Has Unbounded Growth
**Severity:** Medium
**File:** `/src/worker.ts:358–373`
**Category:** Resource Management
**Description:** Failed jobs are pushed to the dead-letter queue with `lpush()` and trimmed to 999 entries with `ltrim(dlqKey, 0, 999)`. However, if a job fails repeatedly due to a permanent error (e.g., MongoDB down), the DLQ grows at the rate of job failures. There is no expiration TTL set on the `dlqKey`, so old DLQ entries accumulate indefinitely in Redis, consuming memory.
**Impact:** Redis memory leaks over time. DLQ becomes cluttered with old failures, making it hard to find recent issues. Potential OOM crash if DLQ is never cleared.
**Fix hint:** Set a TTL on the DLQ Redis key (e.g., 7 days). Or implement a separate mechanism to periodically clean old DLQ entries.

---

### BE-GAM-014 Leaderboard Tier Calculation Not Cached
**Severity:** Low
**File:** `/src/httpServer.ts:144–149`, `/src/httpServer.ts:180–190`
**Category:** Performance
**Description:** The `getTier()` function is called on every leaderboard entry during cache rebuilds. For a leaderboard of 10 users, `getTier()` is called 10 times. If tier logic becomes complex in the future, this repeated calculation becomes wasteful. No memoization or pre-computation is done.
**Impact:** Minimal impact at current scale, but leaderboard rebuild becomes slower with more complex tier logic or larger result sets.
**Fix hint:** Memoize `getTier()` results or pre-compute tiers during the aggregation pipeline itself using MongoDB `$cond` expressions.

---

### BE-GAM-015 Missing Input Validation on Milestone Visit Counts
**Severity:** Medium
**File:** `/src/httpServer.ts:570–574`
**Category:** Configuration Error
**Description:** The VISIT_MILESTONES array is hardcoded with no validation that visit counts are in ascending order or that coin amounts are positive. If a developer accidentally configures milestones as `[{visits: 30, coins: 50}, {visits: 7, coins: 200}]` (out of order), the `find()` lookup in line 594 returns the first match, which may be incorrect.
**Impact:** Users may receive wrong coin amounts or milestone triggers at unexpected visit counts. Confusing reward system.
**Fix hint:** Add a startup-time validation that VISIT_MILESTONES are sorted and coin amounts are positive. Or use a const-time invariant check.

---

### BE-GAM-016 Achievements::check Function Not Type-Safe
**Severity:** Low
**File:** `/src/workers/achievementWorker.ts:46–103`
**Category:** Type Safety
**Description:** Each achievement has a `check: (stats: UserStats) => boolean` function. There is no validation that the `check` function is pure or that it only accesses defined fields in `UserStats`. If a check function tries to access `stats.unknown_field`, it silently returns undefined, leading to silent achievement unlock failures.
**Impact:** New achievements added without proper testing may silently fail to unlock. Silent failures are hard to debug.
**Fix hint:** Add runtime validation in the worker to ensure all required fields are present in stats. Or use TypeScript strict mode to catch field access errors at compile time.

---

### BE-GAM-017 Coin Ledger Write Loses Dedup Key on Failure
**Severity:** Medium
**File:** `/src/httpServer.ts:618–634`
**Category:** Error Handling
**Description:** If `creditCoinsViaWalletService()` succeeds but the subsequent ledger write fails (MongoDB unavailable), the endpoint throws an error and the transaction is retried. On retry, the `creditCoinsViaWalletService()` call is idempotent (wallet service skips duplicate), but if the ledger write fails again, the coin is credited but never recorded in the ledger. Audit trail becomes incomplete.
**Impact:** Wallet balance increases but no ledger entry exists. Auditors cannot reconcile coin flow. Compliance/reconciliation failures.
**Fix hint:** Wrap both wallet credit and ledger write in a transaction. Or retry the ledger write separately if it fails.

---

### BE-GAM-018 Streak Reset Logic Uses LocalDate Not Consistent Timezone
**Severity:** High
**File:** `/src/worker.ts:213–269`
**Category:** Logic Error
**Description:** The streak reset logic in the gamification worker uses IST date strings correctly (`getISTDateString()`), but the initial streak creation uses `updatedAt: new Date()` without timezone context. When the streak is first created, it stores `lastActivityDate` in UTC. Subsequent updates compare IST strings, but the initial creation is in UTC. This causes an off-by-one-day error on first streak creation.
**Impact:** First activity does not trigger a streak correctly. Users must have two activities on consecutive days to form a 2-day streak (should be 1-day).
**Fix hint:** Apply IST date string conversion consistently in all streak creation and updates. Use `getISTDateString()` for all `lastActivityDate` assignments.

---

### BE-GAM-019 Leaderboard Coin Aggregation Excludes Refunds
**Severity:** Medium
**File:** `/src/httpServer.ts:159–164`
**Category:** Logic Error
**Description:** Leaderboard aggregation matches only `{ type: 'earned' }` in cointransactions, excluding 'refund' or 'credit' types. If a user's coins are refunded due to a dispute, the aggregation still includes the original 'earned' entry, overstating their lifetime coins. Conversely, if coins are credited (type: 'credit'), they do not appear in the leaderboard calculation.
**Impact:** Leaderboard ranking is inaccurate. Users with refunds rank higher than they should. Coin conversion credits do not appear in lifetime totals.
**Fix hint:** Clarify the semantic of each transaction type. Either include all positive credits in leaderboard, or exclude all non-'earned' types consistently.

---

### BE-GAM-020 Metrics activeWorkers Counter Not Decremented on Worker Error
**Severity:** Low
**File:** `/src/worker.ts:346`, `/src/worker.ts:384–389`
**Category:** Metrics Error
**Description:** `jobMetrics.activeWorkers` is incremented when a worker starts (line 346) but only decremented in `stopWorker()`. If a worker crashes unexpectedly without calling `stopWorker()`, the counter remains elevated, showing phantom active workers in metrics.
**Impact:** Monitoring dashboards show incorrect worker count. Alerts based on active worker count may false-positive.
**Fix hint:** Listen to worker 'error' event and decrement `activeWorkers` on fatal errors. Or use a heartbeat/health check to validate worker is still alive.

---

### BE-GAM-021 Duplicate Achievement Unlock Notifications
**Severity:** Medium
**File:** `/src/workers/achievementWorker.ts:148–200`
**Category:** Idempotency Failure
**Description:** When a `visit_checked_in` event is processed, the achievement worker checks if the user has earned each achievement and enqueues an `achievement_unlocked` notification. However, there is no dedup check on the notification—if the same `visit_checked_in` event is processed twice (e.g., due to BullMQ retry), the notification is enqueued twice with different job IDs, resulting in duplicate notifications to the user.
**Impact:** Users receive duplicate "Achievement unlocked" notifications. Notification noise and confusion.
**Fix hint:** Add an `eventId` field to notifications and check Redis for prior notification before enqueueing. Or ensure event processing is idempotent at the HTTP/worker level.

---

### BE-GAM-022 Wellness Check Missing Database Indices
**Severity:** Medium
**File:** `/src/httpServer.ts:99–106`, `/src/httpServer.ts:151–164`
**Category:** Performance
**Description:** The aggregation queries on `cointransactions` and `storevisits` collections do not explicitly declare required indices. If indices are missing (type: 1, user: 1, status: 1), the queries perform full collection scans. A production database with millions of documents can hang on these queries.
**Impact:** Leaderboard endpoints timeout under load. Achievement queries slow down. HTTP requests accumulate and consume memory.
**Fix hint:** Document required indices: `{type: 1, user: 1}` on cointransactions; `{userId: 1, status: 1}` on storevisits. Run index creation as part of migration.

---

## Summary
- **Critical:** 4 bugs (BE-GAM-001, 005, 007, 018)
- **High:** 2 bugs (BE-GAM-003, 018)
- **Medium:** 13 bugs
- **Low:** 3 bugs

Key areas: race conditions (race in milestone detection), timezone handling, idempotency failures, resource leaks, and missing validations.
