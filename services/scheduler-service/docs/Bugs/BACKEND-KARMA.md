# REZ Karma Service - Backend Bug Audit

## Service Overview
Karma service manages user karma profiles, levels, trust scores, decay, weekly coin caps, and conversion history via REST API and scheduled jobs.

---

### BE-KAR-001 Decay Calculation Applies Twice on Level Check
**Severity:** High
**File:** `/src/engines/karmaEngine.ts:113–142`
**Category:** Logic Error
**Description:** The `applyDailyDecay()` function calculates `newActiveKarma = Math.floor(profile.activeKarma * (1 - decayRate))` and then calls `calculateLevel(newActiveKarma)` to determine the new level. However, if this decay is applied and the profile is saved, and the same decay function is called again before 60 days pass, the activeKarma is decayed twice (compounded). There is no check to prevent re-application of decay on the same calendar day.
**Impact:** User karma decays more rapidly than intended. A user inactive for 61 days decays 70% twice if their profile is accessed twice, losing up to 91% of karma instead of 70%.
**Fix hint:** Track `lastDecayAt` timestamp in the profile. Only apply decay if current date is after `lastDecayAt`. Ensure decay is applied at most once per 24 hours.

---

### BE-KAR-002 Level Threshold Boundary Off-by-One
**Severity:** Medium
**File:** `/src/engines/karmaEngine.ts:20–25`, `/src/engines/karmaEngine.ts:49–54`
**Category:** Logic Error
**Description:** LEVEL_THRESHOLDS defines L2: 500, L3: 2000, L4: 5000. The `calculateLevel()` function uses `>=` comparisons, which is correct. However, the constant is named as the minimum for each level, not the boundary. If someone later changes L2 to 501 (intending to make 500–500 a different tier), the code will still use `>=`, silently breaking intended logic. Additionally, there is no validation that thresholds are monotonically increasing.
**Impact:** Potential inconsistency if thresholds are modified. Unclear semantics if levels are rebalanced. New developers may misunderstand tier boundaries.
**Fix hint:** Add a startup validation that LEVEL_THRESHOLDS are in ascending order. Add comments clarifying: "L1 is 0–499, L2 is 500–1999" etc. Use const assertions to prevent accidental mutations.

---

### BE-KAR-003 Karma Earned Calculation Does Not Cap Per-Day
**Severity:** Medium
**File:** `/src/engines/karmaEngine.ts:77–89`
**Category:** Logic Error
**Description:** The `calculateKarmaEarned()` function caps karma per event (line 88: `Math.min(...)` against `maxKarmaPerEvent`), but there is no per-day or per-week cap in the calculation engine itself. The service relies on the caller to enforce WEEKLY_COIN_CAP (line 33: `WEEKLY_COIN_CAP = 300`), but this is only enforced at the conversion stage, not at karma earn time. A user could theoretically earn unlimited karma in one week, then convert it all at once.
**Impact:** Weekly coin cap can be exceeded. Users who batch-convert old karma earn more coins per week than policy allows. Unfair advantage for users who let karma accumulate.
**Fix hint:** Validate weekly karma earned before allowing conversion. Or enforce a per-week cap during karma accumulation (`addKarma()` should check thisWeekKarma against a daily limit).

---

### BE-KAR-004 Trust Score Calculation Missing Clamp
**Severity:** Low
**File:** `/src/engines/karmaEngine.ts:144–150` (partial read)
**Category:** Logic Error
**Description:** The `calculateTrustScore()` function is declared but not fully visible in the read. However, trust scoring often involves dividing metrics by max values or applying weights. If the denominator is zero (no activities), the function may return NaN or Infinity. A clamp to [0, 100] would prevent invalid scores.
**Impact:** Invalid trust scores (NaN, >100, <0) in the profile. Comparisons and display logic break downstream.
**Fix hint:** Clamp result to `Math.max(0, Math.min(100, score))`. Handle zero-division by returning 0 for new users.

---

### BE-KAR-005 Conversion Rate Mismatch Between Levels and Actual Rate
**Severity:** Medium
**File:** `/src/engines/karmaEngine.ts:59–71`
**Category:** Configuration Error
**Description:** `getConversionRate()` returns: L4: 1.0, L3: 0.75, L2: 0.5, L1: 0.25. However, the semantic is unclear: does L4 convert 1 karma to 1 coin, or is 1.0 a multiplier on some base rate? If the base rate changes (e.g., 0.1 coin per karma), the code needs updates in multiple places. Additionally, there is no validation that rates are between 0 and 1, or that higher levels have higher rates.
**Impact:** Conversion logic depends on undocumented semantics. Changes to base conversion require hunting through the codebase. Possible inconsistency if someone changes rate definitions without updating all usages.
**Fix hint:** Document the semantic clearly: "1 karma converts to getConversionRate(level) coins". Add validation during initialization. Consider a separate `BASE_CONVERSION_RATE` constant.

---

### BE-KAR-006 Moment.js Timezone Not Set to User's Timezone
**Severity:** High
**File:** `/src/engines/karmaEngine.ts:98–101`
**Category:** Localization
**Description:** The `daysBetween()` function uses `moment(from).startOf('day')` without specifying a timezone. Moment.js defaults to the server's local timezone. If the server is in UTC and the user is in IST (UTC+5:30), day boundaries are evaluated incorrectly. A user's activity at 23:00 IST (17:30 UTC) is treated as "yesterday" in UTC, potentially triggering incorrect decay or bonus calculations.
**Impact:** Inconsistent karma decay schedules based on server location. Users in different timezones see different decay rates. Unfair decay application.
**Fix hint:** Pass user's timezone to `daysBetween()` and use `moment().tz(userTimezone)` for all date calculations. Or use UTC consistently and convert user-side.

---

### BE-KAR-007 Level History Not Cleared on Decay Downgrade
**Severity:** Low
**File:** `/src/engines/karmaEngine.ts:113–142`
**Category:** Data Integrity
**Description:** When decay causes a level downgrade (e.g., L3 → L2), the function returns `levelChange: true` but does not add an entry to `levelHistory`. The profile's `levelHistory` array grows only on upgrades, not downgrades. An audit of a user's level changes will show only upward mobility, hiding decay-induced downgrades.
**Impact:** Incomplete level history. Audits show misleading progression (always upward). Compliance reports miss downgrade events.
**Fix hint:** Append a levelHistory entry for downgrades as well, with `reason: 'decay'` and `timestamp: now()`.

---

### BE-KAR-008 addKarma() Function Does Not Enforce Weekly Cap
**Severity:** High
**File:** `/src/services/karmaService.ts:100–120` (partial read)
**Category:** Logic Error
**Description:** The `addKarma()` function increments `profile.activeKarma` and `profile.lifetimeKarma` without checking against WEEKLY_COIN_CAP. The function accepts `thisWeekKarmaEarned` but never validates it against the constant. This means a user could accumulate unlimited karma in a week, then convert it all at once, bypassing the weekly coin cap.
**Impact:** Weekly coin cap is not enforced at earn time. Users can earn unlimited coins per week. Gamification incentive misaligned with intended cap.
**Fix hint:** Before incrementing, validate `profile.thisWeekKarmaEarned + karma <= WEEKLY_COIN_CAP`. Reject or cap the addition if it would exceed the limit.

---

### BE-KAR-009 Decay Application Not Idempotent Across Day Boundaries
**Severity:** Medium
**File:** `/src/engines/karmaEngine.ts:113–142`
**Category:** Concurrency
**Description:** Two concurrent requests for the same user at the boundary between day N-30 and day N-31 (decay threshold) may both trigger decay. The first request applies 20% decay, then the second request applies 20% decay again to the already-decayed value, resulting in 36% total decay instead of 20%.
**Impact:** Compounded decay under concurrent load. Users who are idle around decay boundaries lose extra karma. Unfair and non-deterministic karma loss.
**Fix hint:** Use a distributed lock (Redis) to protect decay application. Or include `lastDecayAppliedAt` in the decay check to prevent re-application on the same day.

---

### BE-KAR-010 Conversion History Missing Audit Trail
**Severity:** Medium
**File:** `/src/types/index.js` and `/src/models/KarmaProfile.ts` (implied)
**Category:** Audit/Compliance
**Description:** The `conversionHistory` array is implied but the read output does not show its structure. If it only stores the conversion fact (karma → coins) without a timestamp, the audit trail is incomplete. An external observer cannot tell when conversions occurred or in what order.
**Impact:** Cannot reconcile karma flow over time. Audit of individual conversions is impossible. Compliance with financial/gaming regulations may fail.
**Fix hint:** Ensure `conversionHistory` includes: `{timestamp, karmaConverted, coinsEarned, level, conversionRate}`. Add indexes on timestamp for audit queries.

---

### BE-KAR-011 Trust Score Not Recalculated on Profile Update
**Severity:** Medium
**File:** `/src/services/karmaService.ts` (implied)
**Category:** Data Freshness
**Description:** The `calculateTrustScore()` function takes a `profile` as input but the service layer does not automatically recalculate trust score when the profile is updated. Trust score could become stale if a user's activities change but the score is not recomputed. It is unclear when the score is updated.
**Impact:** Stale trust scores. User's actual reputation does not match their trust score. Unfair targeting or restriction based on outdated score.
**Fix hint:** Call `calculateTrustScore()` after every activity. Or use a background job to periodically recalculate. Document when scores are refreshed.

---

### BE-KAR-012 Level Up Notification Lost on Error
**Severity:** Medium
**File:** `/src/services/karmaService.ts` (implied)
**Category:** Error Handling
**Description:** When a user levels up (detected by `newLevel !== oldLevel`), a notification should be enqueued. However, if the notification queue is unavailable, the error is likely caught and logged, but execution continues. The profile is updated with the new level, but the user never receives a "Level Up" notification.
**Impact:** Users do not receive level-up celebrations. Silent failure of notification system. Users unaware of their achievement.
**Fix hint:** Enqueue level-up notifications before committing profile updates. Or fail the karma update if notification enqueue fails, then retry on recovery.

---

### BE-KAR-013 Difficulty Multiplier Not Validated
**Severity:** Low
**File:** `/src/engines/karmaEngine.ts:35–39`
**Category:** Configuration Error
**Description:** The `DIFFICULTY_MULTIPLIERS` object has entries for 'easy', 'medium', 'hard' but no validation that incoming `event.difficulty` matches one of these keys. If an event has `difficulty: 'impossible'`, the fallback is `?? 1.0`, silently applying no multiplier instead of erroring.
**Impact:** Silently incorrect karma calculations for unexpected difficulty levels. New difficulty types added without code update are ignored.
**Fix hint:** Add validation during event intake: `if (!(event.difficulty in DIFFICULTY_MULTIPLIERS)) throw Error(...)`. Or document all valid difficulties explicitly.

---

### BE-KAR-014 Base Karma Per Hour Not Validated as Positive
**Severity:** Low
**File:** `/src/engines/karmaEngine.ts:77–89`
**Category:** Input Validation
**Description:** The `calculateKarmaEarned()` function multiplies `event.baseKarmaPerHour * hours` without validating that `baseKarmaPerHour > 0`. If an event has a negative or zero base rate, the function silently returns 0 or a negative karma value.
**Impact:** Events with invalid base rates produce incorrect karma (negative or zero). Silent failures in gamification logic.
**Fix hint:** Validate `baseKarmaPerHour > 0` when the event is created. Throw on invalid input.

---

### BE-KAR-015 Per-Event Max Karma Cap Can Be Negative
**Severity:** Low
**File:** `/src/engines/karmaEngine.ts:88`
**Category:** Input Validation
**Description:** The cap is `Math.min(Math.floor(karma), event.maxKarmaPerEvent)`. If `maxKarmaPerEvent` is negative or zero (invalid configuration), the cap silently allows negative karma or zero karma awards.
**Impact:** Invalid event configurations produce no karma or negative karma. Hard-to-debug gamification failures.
**Fix hint:** Validate `maxKarmaPerEvent > 0` during event schema validation. Use a reasonable default (e.g., 1000) if not specified.

---

### BE-KAR-016 Decay Schedule Not Monotonic Validation
**Severity:** Low
**File:** `/src/engines/karmaEngine.ts:27–31`
**Category:** Configuration Error
**Description:** The `DECAY_SCHEDULE` maps days to decay rates (30: 0.20, 45: 0.40, 60: 0.70). There is no validation that the days are in ascending order or that decay rates increase monotonically with days. If a developer accidentally swaps entries (30: 0.70, 60: 0.20), decay logic breaks.
**Impact:** Incorrect decay rates for different inactivity durations. Non-intuitive decay progression.
**Fix hint:** Add a startup assertion that DECAY_SCHEDULE keys are in ascending order and values increase monotonically.

---

### BE-KAR-017 Batch Conversion Loses Individual Karma Details
**Severity:** Medium
**File:** `/src/services/batchService.ts` (implied)
**Category:** Data Loss
**Description:** Batch conversions aggregate karma into a single pool, then distribute coins. Individual karma details (source, difficulty, timestamp) are lost in the aggregation. An audit later cannot trace which karma came from which event.
**Impact:** Audit trail incompleteness. Cannot dispute individual conversions or track karma source.
**Fix hint:** Log individual karma→coin conversions even in batch mode. Preserve the event chain: event → karma earned → stored → converted.

---

### BE-KAR-018 Activity History Array Unbounded Growth
**Severity:** Medium
**File:** `/src/models/KarmaProfile.ts` (implied)
**Category:** Resource Management
**Description:** The `activityHistory` array is implied to store all user activities. Without a cap (max size), this array grows indefinitely, consuming MongoDB disk space and memory. No archiving or pruning strategy is visible.
**Impact:** MongoDB disk usage grows linearly with user activity. Storage costs increase indefinitely. Slow queries on large activityHistory arrays.
**Fix hint:** Cap the array at N recent entries (e.g., 1000). Archive older entries to a separate collection. Or use a rolling window with TTL.

---

### BE-KAR-019 Badges Array Not Deduplicated
**Severity:** Low
**File:** `/src/models/KarmaProfile.ts` (implied)
**Category:** Data Integrity
**Description:** The `badges` array stores earned badges. There is no unique constraint or dedup check, so a user could potentially earn the same badge twice. Depending on the downstream code, this may cause display issues (badge shown twice) or silently overwrite.
**Impact:** Duplicate badges in profile. UI shows same badge multiple times. Confusing gamification state.
**Fix hint:** Use a Set or unique constraint on badge IDs. Validate badge ID uniqueness before appending.

---

### BE-KAR-020 Level History Not Limited to Recent Entries
**Severity:** Low
**File:** `/src/models/KarmaProfile.ts` (implied)
**Category:** Resource Management
**Description:** The `levelHistory` array stores every level change but is not capped. For an active user over years, this array could grow very large, slowing profile loads and updates.
**Impact:** Large levelHistory arrays slow down profile reads. Memory bloat in MongoDB. N+1 query problems if levelHistory is queried frequently.
**Fix hint:** Cap levelHistory to N recent entries (e.g., 100). Archive older entries. Or use a separate collection for historical records.

---

### BE-KAR-021 Conversion Rate Not Applied to Coins Correctly
**Severity:** High
**File:** `/src/engines/karmaEngine.ts:59–71`
**Category:** Calculation Error
**Description:** The `getConversionRate()` function returns a rate (0.25–1.0) for a level. The caller should multiply karma by this rate to get coins. However, the function name is ambiguous—it could be interpreted as "rate per karma unit" or "scaling factor". If a caller uses it as a divisor instead of a multiplier, coins are calculated incorrectly. Additionally, there is no function to perform the actual conversion (`karmaToCoins(karma, level)`), leaving conversion logic scattered.
**Impact:** Inconsistent karma-to-coin conversion logic. Different parts of the codebase may calculate coins differently. Unfair coin awards.
**Fix hint:** Create an explicit `convertKarmaToCoins(karma: number, level: Level): number` function that applies the conversion rate consistently. Document the semantics clearly.

---

### BE-KAR-022 CheckIns Counter Not Validated as Non-Negative
**Severity:** Low
**File:** `/src/models/KarmaProfile.ts` (implied)
**Category:** Data Integrity
**Description:** The `checkIns` and `approvedCheckIns` fields are likely integers but have no validation that they are non-negative. If a bug decrements these fields or a negative value is inserted directly into the database, the profile becomes inconsistent.
**Impact:** Negative check-in counts in UI. Confusing user profile. Potential division-by-zero if used as denominators elsewhere.
**Fix hint:** Add schema validation: `{type: Number, min: 0}`. Add assertions in update logic to prevent negative increments.

---

## Summary
- **Critical:** 0 bugs
- **High:** 4 bugs (BE-KAR-001, 008, 009, 021)
- **Medium:** 10 bugs
- **Low:** 8 bugs

Key areas: decay logic flaws, missing caps and validations, timezone handling, conversion rate clarity, and unbounded array growth.
