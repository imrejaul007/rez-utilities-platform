# REZ Ads Service - Backend Bug Audit

## Service Overview
Ads service manages ad campaigns, placements, targeting, budget enforcement, impression/click tracking, fraud detection, and frequency capping via REST API.

---

### BE-ADS-001 Rate Limiter Fallback Allows Unlimited Requests
**Severity:** High
**File:** `/src/routes/serve.ts:15–37`
**Category:** Security/Availability
**Description:** The rate limiter's try-catch fallback (line 33–36) returns `true` (allowed) if Redis is unavailable. This means if Redis goes down, the rate limiter is disabled entirely, allowing users to spam impression and click endpoints without limit. An attacker could generate fake impressions or clicks indefinitely.
**Impact:** Denial of service. Fraudulent impression/click inflation. Budget bypass. Ad metrics become unreliable. Revenue loss.
**Fix hint:** On Redis unavailable, fail closed (return false/rate limit) instead of fail open. Or use an in-memory sliding window as fallback (less resilient but better than open).

---

### BE-ADS-002 Frequency Cap Not Reset on Campaign Expiry
**Severity:** Medium
**File:** `/src/routes/serve.ts:114–127`
**Category:** Logic Error
**Description:** The frequency cap uses a Redis key `ad:freq:${userId}` with a 24-hour TTL. However, if a campaign ends (endDate passes), the frequency cap for that specific ad is not cleared. A new campaign using the same ad could be blocked because the user already saw it in a previous campaign.
**Impact:** Users blocked from seeing ads they haven't seen yet (if new campaign reuses old ad). Incomplete ad delivery for recycled ad creatives.
**Fix hint:** Include campaign ID in the frequency cap key: `ad:freq:${userId}:${campaignId}`. Or clear caps when a campaign ends.

---

### BE-ADS-003 Ad Pool Selection Uses Biased Random
**Severity:** Low
**File:** `/src/routes/serve.ts:122–123`
**Category:** Algorithm
**Description:** The ad selection uses `Math.floor(Math.random() * adPool.length)` which is uniform random selection. While correct statistically, it doesn't account for ad quality, CTR, or importance. All ads are equally likely regardless of performance. A poorly performing ad gets the same impression share as a high-performing ad.
**Impact:** Suboptimal ad serving. Lower expected CTR/ROI. Advertiser dissatisfaction.
**Fix hint:** Weight selection by ad performance (CTR, bid amount, or priority). Use a weighted random selection (roulette wheel).

---

### BE-ADS-004 Targeting Filter Logic Ambiguous
**Severity:** Medium
**File:** `/src/routes/serve.ts:73–87`
**Category:** Logic Error
**Description:** The targeting filter builds conditions with: `targetFilters['targetLocation.city'] = user.location.city` and `targetFilters.$or = [...]`. This mixes direct assignment with OR conditions. The final query is `{ status: 'active', placement, ..., targetFilters }`. If targetFilters has both direct keys and `$or`, MongoDB interprets this as AND of all conditions, which may not be the intended logic.
**Impact:** Incorrect audience targeting. Ads may be shown to unintended users or hidden from intended users. Targeting effectiveness is low.
**Fix hint:** Explicitly construct query: `{ status: 'active', placement, startDate: {...}, $and: [directFilters, {$or: orFilters}] }`. Document targeting semantics.

---

### BE-ADS-005 Merchant Budget Validation Not Enforced
**Severity:** High
**File:** `/src/routes/merchant.ts:78–87`
**Category:** Business Logic
**Description:** The merchant create ad endpoint validates that `dailyBudget >= 0` and `totalBudget >= 0`, but does not validate that `totalBudget >= dailyBudget`. A merchant could set `dailyBudget: 1000, totalBudget: 100`, which is logically invalid. Additionally, there is no check that the daily budget doesn't exceed the total budget across the campaign duration.
**Impact:** Invalid budget configurations allow spend to exceed total budget. Campaign runs indefinitely. Merchants face unexpected costs.
**Fix hint:** Validate `totalBudget >= dailyBudget`. If campaign runs for N days, validate `totalBudget >= dailyBudget * N`. Halt spend when total budget is reached.

---

### BE-ADS-006 Ad Status Transitions Not Validated
**Severity:** Medium
**File:** `/src/routes/admin.ts` (implied)
**Category:** State Machine Error
**Description:** Ads are created with status 'draft'. The service likely allows transitions to 'active', 'paused', 'cancelled'. However, there is no validation of legal transitions. An ad could go from 'cancelled' back to 'active', which may be unintended. No state machine is enforced.
**Impact:** Ads unexpectedly reactivated. Cancelled campaigns could spend again. Audit trail breaks.
**Fix hint:** Define legal state transitions: draft → active → paused/cancelled, no backward transitions. Enforce transitions explicitly.

---

### BE-ADS-007 Impression/Click Data Not Validated as Plausible
**Severity:** High
**File:** `/src/routes/serve.ts:139–150` (partial)
**Category:** Fraud Detection
**Description:** The impression/click endpoints accept `adId` from the request body without validating that the ad exists or is active. Additionally, there is no check that impressions are followed by clicks (a user cannot click without seeing). A user could submit 1 million clicks for an ad they never saw.
**Impact:** Fraudulent click inflation. Campaign metrics become unreliable. Budget exhaustion due to fake clicks. Revenue manipulation.
**Fix hint:** Validate adId exists and is active. Implement simple fraud detection: check if click rate is >30% of impressions (suspiciously high). Track impression-to-click ratios per user/IP.

---

### BE-ADS-008 Bid Amount Not Validated Against Budget
**Severity:** Medium
**File:** `/src/routes/merchant.ts:79–82`
**Category:** Business Logic
**Description:** The bid amount is validated as non-negative but not validated against the daily or total budget. A merchant could set `bidType: 'CPC', bidAmount: 1000, dailyBudget: 10`. With just 10 clicks per day, the budget is exhausted immediately. No validation ensures bid amount is reasonable relative to budget.
**Impact:** Campaigns exhaust daily budget on few clicks/impressions. Inefficient ad spend. Unexpected costs.
**Fix hint:** Validate `bidAmount <= dailyBudget`. Warn if expected spend (impressions * bidAmount) exceeds budget. Allow the configuration but warn the merchant.

---

### BE-ADS-009 Campaign Start Date Not Validated
**Severity:** Low
**File:** `/src/routes/merchant.ts:88–89`
**Category:** Validation
**Description:** The start date is required but not validated. A merchant could set `startDate: '2020-01-01'` (past date) or `startDate: 'invalid'`. If past date, the ad is immediately eligible to serve. If invalid format, the database stores an invalid date.
**Impact:** Ads serve immediately if start date is in the past. Date parsing errors crash downstream code. Unexpected ad delivery.
**Fix hint:** Validate startDate is a valid future date (or today). Reject past dates. Validate ISO 8601 format.

---

### BE-ADS-010 End Date Comparison Inconsistent
**Severity:** Medium
**File:** `/src/routes/serve.ts:98–102`
**Category:** Logic Error
**Description:** The serve endpoint checks: `endDate: { $exists: false } || endDate: null || endDate: { $gt: now }`. An ad with no endDate (null or missing) is considered active forever. An ad with `endDate: 2024-12-31` is active until 2024-12-31 23:59:59. However, if an ad should end on 2024-12-31, it should be inactive starting 2024-12-31 00:00:00 (midnight). The comparison `$gt: now` allows the ad to serve for the entire endDate day.
**Impact:** Ads serve for up to 1 day longer than intended. Campaigns run past their end date. Budget overrun.
**Fix hint:** Clarify end date semantics: should endDate be inclusive or exclusive? Use `endDate: { $gte: now }` for inclusive, `{ $gt: now }` for exclusive. Document clearly.

---

### BE-ADS-011 Merchant Cannot Update Active Campaign
**Severity:** Medium
**File:** `/src/routes/merchant.ts` (implied)
**Category:** Design
**Description:** It is inferred that merchants can only update 'draft' or 'paused' ads, not 'active' ads (based on common ad platform design). However, real-world use cases may require pausing and resuming campaigns, adjusting budget, or changing targeting mid-campaign. The inability to update active ads limits functionality.
**Impact:** Merchants cannot respond quickly to campaign performance. Must cancel and create a new ad. Loss of historical data and metrics.
**Fix hint:** Allow safe updates to active ads (e.g., budget, end date, targeting). Disallow unsafe changes (bid amount, placement) that would disrupt ongoing auctions.

---

### BE-ADS-012 Admin Stats Aggregation Not Real-Time
**Severity:** Low
**File:** `/src/routes/admin.ts:71–109`
**Category:** Data Freshness
**Description:** The admin stats endpoint runs an aggregation pipeline on every request. For large ad datasets, this scan is slow. Stats are not cached, so concurrent requests all run the same expensive aggregation.
**Impact:** Slow admin dashboard. High database load. Potential timeout for large deployments.
**Fix hint:** Cache stats in Redis (e.g., 5-minute TTL). Invalidate on ad status change. Or use materialized views.

---

### BE-ADS-013 Total Spend Calculation Missing Decimal Precision
**Severity:** Low
**File:** `/src/routes/admin.ts:82–84`
**Category:** Arithmetic
**Description:** The aggregation sums `totalSpent` field. However, if bids are fractional (e.g., $0.01 per click), and many thousands of clicks occur, floating-point arithmetic may lose precision. The sum could be off by cents.
**Impact:** Minor financial inaccuracy. Audits show rounding errors. Compliance/reconciliation issues.
**Fix hint:** Store all monetary amounts as integers (in cents). Perform aggregations on integers. Convert to dollars for display.

---

### BE-ADS-014 Merchant Populate Query Slow Without Index
**Severity:** Medium
**File:** `/src/routes/admin.ts:50–51`
**Category:** Performance
**Description:** The admin GET route populates 'merchantId' and 'storeId'. If there are millions of ads, the populate query may be slow without indexes on the referenced collections.
**Impact:** Admin listing is slow. Timeouts for large deployments. Poor user experience.
**Fix hint:** Ensure indexes on Merchant._id and Store._id. Limit the fields populated: `.populate('merchantId', 'businessName email')`.

---

### BE-ADS-015 Ad Eligibility Check Uses Full Collection Scan
**Severity:** Medium
**File:** `/src/routes/serve.ts:95–107`
**Category:** Performance
**Description:** The ad serve query uses: `status: 'active', placement, startDate: { $lte: now }, endDate/null checks`. Without indexes on `status` and `placement` together, the database performs a full collection scan. For millions of ads, this is very slow.
**Impact:** Serve endpoint times out under load. Users get blank ad slots. Ad revenue loss.
**Fix hint:** Create a compound index: `{ status: 1, placement: 1, startDate: 1, endDate: 1 }`. Use `hint()` in the query if necessary.

---

### BE-ADS-016 Frequency Cap TTL Hardcoded to 24 Hours
**Severity:** Low
**File:** `/src/routes/serve.ts:127`
**Category:** Configuration
**Description:** The frequency cap TTL is hardcoded to 86400 seconds (24 hours). If campaigns need different frequency caps (e.g., hourly capping, weekly capping), the code cannot adapt without changes.
**Impact:** Inflexible frequency capping. Cannot implement per-campaign frequency policies. One-size-fits-all approach.
**Fix hint:** Make frequency cap TTL configurable per campaign. Store in campaign document: `frequencyCapDays: 1` (default).

---

### BE-ADS-017 Unseen Ad Pool Prefers First Unseen Ad Always
**Severity:** Low
**File:** `/src/routes/serve.ts:118–122`
**Category:** Algorithm
**Description:** If unseen ads exist (`unseenAds.length > 0`), the logic is `const adPool = unseenAds.length > 0 ? unseenAds : ads;`. This always prefers unseen ads, ensuring every user sees each ad once before any repetition. While fair, it doesn't account for ad quality or importance. A high-performing ad gets the same unseen priority as a poor-performing ad.
**Impact:** Suboptimal ad ordering. Worse user experience if poor ads are forced to be seen first. Lower overall CTR.
**Fix hint:** Weight unseen ads by performance (CTR, bid). Serve high-quality unseen ads first, then fallback to low-quality unseen, then repeat seen ads.

---

### BE-ADS-018 Advertiser Cannot Query Own Ad Performance
**Severity:** Medium
**File:** `/src/routes/admin.ts` (implies admin-only)
**Category:** Design
**Description:** The admin stats endpoint is admin-only (based on verifyAdmin middleware). Merchants cannot query their own ad performance metrics without going through admin. This limits self-service analytics.
**Impact:** Merchants cannot monitor their own campaigns. Must contact support for metrics. Poor user experience.
**Fix hint:** Create a merchant-accessible `/merchant/ads/:id/stats` endpoint that shows only that merchant's ad metrics.

---

### BE-ADS-019 Placement Validity Not Enforced Elsewhere
**Severity:** Low
**File:** `/src/routes/serve.ts:53–58`
**Category:** Validation
**Description:** The serve endpoint validates placement against a list: `['home_banner', 'explore_feed', 'store_listing', 'search_result']`. However, when a merchant creates an ad (merchant.ts), there is no validation that the placement is in this list. A merchant could create an ad for placement 'invalid_placement', which would never be served.
**Impact:** Silent failures. Ads created but never served. Merchants unaware of invalid configuration. Support confusion.
**Fix hint:** Validate placement against the same allowlist during ad creation. Return 400 if invalid.

---

### BE-ADS-020 Click Recording Missing Deduplication
**Severity:** High
**File:** `/src/routes/serve.ts:147–150` (partial)
**Category:** Fraud Detection
**Description:** The impression/click endpoints accept requests without checking if this is a duplicate. A user could submit the same click multiple times (rapid-fire clicks by a bot), each one being recorded. No deduplication exists.
**Impact:** Fraudulent click inflation. Campaign metrics inflated. Budget exhausted by bot clicks.
**Fix hint:** Implement a dedup check: for each (adId, userId, timestamp), allow one click per second/minute. Use Redis set with TTL to track recent clicks.

---

### BE-ADS-021 Bid Type Not Validated Against Payment Terms
**Severity:** Medium
**File:** `/src/routes/merchant.ts:64`
**Category:** Business Logic
**Description:** Merchants can set `bidType: 'CPC'` or `'CPM'` (implied), but there is no validation that the merchant has agreed to these payment terms or has sufficient payment history. Additionally, there is no conversion between bid types for auctions (CPC and CPM are incomparable).
**Impact:** Merchants may be charged for bid types they didn't agree to. Auction logic breaks if different bid types are mixed.
**Fix hint:** Validate bidType against merchant's agreement profile. Or enforce one bid type per ad service.

---

### BE-ADS-022 Location Targeting Empty String Default
**Severity:** Low
**File:** `/src/routes/serve.ts:72–74`
**Category:** Data Validation
**Description:** If `user.location?.city` is undefined or empty string, the targeting filter is not set (no condition added). An ad with `targetLocation: {city: 'New York'}` is effectively not targeted at a user with missing location data. The ad serves to them anyway (no filter prevents it).
**Impact:** Targeting is bypassed for users with missing location data. Ads reach unintended audiences. Advertiser dissatisfaction.
**Fix hint:** Clarify targeting semantics: if user has no location, should they be excluded (safe) or included (reach-maximizing)? Explicitly handle the null case.

---

## Summary
- **Critical:** 0 bugs
- **High:** 4 bugs (BE-ADS-001, 005, 007, 020)
- **Medium:** 12 bugs
- **Low:** 6 bugs

Key areas: fraud detection (missing click dedup, unvalidated ad eligibility), budget enforcement (bid validation, spend tracking), frequency capping, ad targeting logic, and admin controls.
