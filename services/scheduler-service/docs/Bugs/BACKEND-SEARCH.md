# Search Service Bug Audit

## Indexing, Query Parsing, Ranking, Filters, Facets, Autocomplete, Cache, Typo Tolerance, Geo Search, Pagination

---

### BE-SRC-001 Missing Text Index on Stores Collection

**Severity:** CRITICAL

**File:** `src/services/searchService.ts` (line 103)

**Category:** Indexing

**Description:** Store search uses `$text: { $search: query }` but no explicit index creation on stores.name, stores.description. Query falls back to collection scan.

**Impact:** Search queries are slow (100+ ms for large collections). Index creation must be manual. Database load spikes.

**Fix hint:** Create compound text index: `db.stores.createIndex({ name: 'text', description: 'text', categories: 'text' })`.

---

### BE-SRC-002 Missing Geo Index Validation

**Severity:** HIGH

**File:** `src/services/searchService.ts` (line 92)

**Category:** Indexing, Geo Search

**Description:** Geo search uses `$geoNear` but does not verify location field has 2dsphere index. Without index, query fails silently.

**Impact:** Geo search returns 0 results. Users cannot find nearby stores.

**Fix hint:** Create index: `db.stores.createIndex({ location: '2dsphere' })`. Add startup validation.

---

### BE-SRC-003 Missing Spherical Geometry Validation

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 96)

**Category:** Geo Search

**Description:** `spherical: true` is set, but no validation that coordinates are [lng, lat] (not [lat, lng]). Swapped coordinates break geo queries.

**Impact:** Searches return stores from wrong locations (possibly opposite hemisphere).

**Fix hint:** Validate lng in [-180, 180] and lat in [-90, 90] before geo query.

---

### BE-SRC-004 Missing Candidate Multiplier Tuning

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 114)

**Category:** Ranking

**Description:** CANDIDATE_MULTIPLIER = 5 is hardcoded. No tuning based on result set size. Small result sets (< 20 results) waste memory; large (> 1000) cause timeout.

**Impact:** Re-ranking misses relevant items or times out on large result sets.

**Fix hint:** Set dynamic CANDIDATE_MULTIPLIER based on total count: `min(5, max(2, total / limit))`.

---

### BE-SRC-005 Missing MaxDistance Radius Capping

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 95)

**Category:** Geo Search

**Description:** maxDistance is not capped. Client can request radius=999999999 (unrealistic). Query becomes full-table scan.

**Impact:** Denial of service via large radius. Database load spike.

**Fix hint:** Cap radius: `Math.min(radius || 5000, 50000)` (50km max).

---

### BE-SRC-006 Missing Query Length Validation

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 81)

**Category:** Query Parsing

**Description:** Query parameter has no length limit. Extremely long queries (10KB+) cause regex compilation failures.

**Impact:** Search endpoint crashes on crafted long queries. Denial of service.

**Fix hint:** Validate `query.length <= 200`. Reject with 400 if exceeded.

---

### BE-SRC-007 Missing Category Slug Validation

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 104)

**Category:** Filters

**Description:** Category slug is not validated against known category list. Invalid slugs silently return 0 results.

**Impact:** Typos in category slug return no results. Poor UX.

**Fix hint:** Pre-fetch valid category slugs; validate incoming slug against whitelist.

---

### BE-SRC-008 Missing Price Range Validation

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 218-222)

**Category:** Filters

**Description:** minPrice and maxPrice are not validated. Client can pass negative prices, minPrice > maxPrice, or non-numeric values.

**Impact:** Invalid price filters silently ignored. Nonsensical results.

**Fix hint:** Validate `minPrice >= 0`, `maxPrice >= minPrice`, both are numbers.

---

### BE-SRC-009 Missing Rating Filter

**Severity:** LOW

**File:** `src/services/searchService.ts` (line 191+)

**Category:** Filters

**Description:** Product search has no rating filter, but stores are sorted by rating. Inconsistent filtering capability.

**Impact:** Users cannot filter by rating. Low-rated products returned.

**Fix hint:** Add `minRating` parameter; filter `rating: { $gte: minRating }`.

---

### BE-SRC-010 Missing Text Score Projection

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 126-133)

**Category:** Ranking

**Description:** Text search uses `score: { $meta: 'textScore' }` for sorting but does not project textScore in results. Ranking is invisible to client.

**Impact:** Client cannot understand why results are ranked that way.

**Fix hint:** Project `{ _id: 1, ..., textScore: { $meta: 'textScore' } }` in result.

---

### BE-SRC-011 Missing Cache Invalidation on Store Update

**Severity:** HIGH

**File:** `src/services/cacheHelper.ts` (line 9-21)

**Category:** Cache

**Description:** Cache has no invalidation on store updates. Stores become inactive but cached results still show them.

**Impact:** Inactive stores appear in search results. Customer orders from closed stores.

**Fix hint:** Publish cache invalidation event on store status change. Delete cache keys matching store ID.

---

### BE-SRC-012 Missing Cache Key Collision Prevention

**Severity:** MEDIUM

**File:** `src/services/cacheHelper.ts` (line 4-6)

**Category:** Cache

**Description:** Cache key uses MD5 hash of params. No namespace prefix collision risk across services.

**Impact:** Search service cache key may collide with homepage service. Results mixed.

**Fix hint:** Include service name in key: `cache_search:${prefix}:${hash}`.

---

### BE-SRC-013 Missing Redis Connection Fallback

**Severity:** MEDIUM

**File:** `src/services/cacheHelper.ts` (line 10-21)

**Category:** Cache

**Description:** Cache miss/set silently fail. No distinction between cache miss and connection error. No fallback mechanism.

**Impact:** If Redis is down, all searches bypass cache. Database overload.

**Fix hint:** Log cache errors at DEBUG level; implement retry with exponential backoff.

---

### BE-SRC-014 Missing Fuzzy Regex Backtracking Protection

**Severity:** HIGH

**File:** `src/services/searchService.ts` (line 586)

**Category:** Autocomplete, Typo Tolerance

**Description:** Fuzzy regex joins character with `[\W\']*` between each. Repetition causes exponential backtracking on long queries or many special chars.

**Impact:** ReDoS (Regular Expression Denial of Service). Autocomplete endpoint hangs on crafted input.

**Fix hint:** Use library (fuse.js) instead of regex; or limit pattern length to 20 chars with atomic groups.

---

### BE-SRC-015 Missing Fuzzy Result Ranking

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 674-686)

**Category:** Autocomplete, Typo Tolerance

**Description:** Prefix and fuzzy results are deduplicated but not re-ranked. Fuzzy results that are poor matches appear in final results.

**Impact:** "mcdonalds" (fuzzy) appears before "McDonald's" (exact) in results.

**Fix hint:** Score results by match quality: exact > prefix > fuzzy. Sort by score descending.

---

### BE-SRC-016 Missing Limit Enforcement on Dedupe

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 674-685)

**Category:** Autocomplete

**Description:** Deduplication loop breaks after `limit` items, but prefix/fuzzy queries each return `limit` items. Final result may exceed limit.

**Impact:** Autocomplete returns 10 items when limit=5.

**Fix hint:** Enforce limit after dedup: `result.slice(0, limit)`.

---

### BE-SRC-017 Missing Category Existence Check

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 260-267)

**Category:** Filters, Facets

**Description:** getProductFilters fetches distinct category IDs then looks them up, but no check if category IDs are valid ObjectIds. Invalid IDs silently skipped.

**Impact:** Orphaned category references in products not returned.

**Fix hint:** Log invalid category IDs for cleanup; validate ObjectId format before lookup.

---

### BE-SRC-018 Missing Price Range Bounds Check

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 281-284)

**Category:** Filters, Facets

**Description:** Price range min/max from aggregation may be null if products table is empty. No fallback.

**Impact:** UI receives `null` for price range; crashes if not null-checked.

**Fix hint:** Set defaults: `min: priceAgg[0]?.min ?? 0, max: priceAgg[0]?.max ?? 100`.

---

### BE-SRC-019 Missing Trending Stores Time Window Caching

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 312-397)

**Category:** Trending, Cache

**Description:** Trending stores cache is 5 minutes, but underlying userstreaks aggregation is every call. No intermediate cache on aggregation.

**Impact:** 12x queries per hour to userstreaks collection even with 5min cache.

**Fix hint:** Cache aggregation result separately; TTL 30 seconds for intermediate aggregation.

---

### BE-SRC-020 Missing Trending Stores Dedup

**Severity:** LOW

**File:** `src/services/searchService.ts` (line 371-393)

**Category:** Trending

**Description:** Trending stores may be included multiple times if user has multiple streaks of same store. No deduplication.

**Impact:** Same store appears twice in trending list.

**Fix hint:** Deduplicate by storeId before returning results.

---

### BE-SRC-021 Missing Category Ordering in Trending

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 545-562)

**Category:** Trending by Category

**Description:** Top 5 categories are selected by total visit count, but no ordering guarantee if totals are equal. Results non-deterministic.

**Impact:** Different results on consecutive calls for same data.

**Fix hint:** Add secondary sort: `categoryTotals.sort((a, b) => b.total - a.total || a.categoryId.localeCompare(b.categoryId))`.

---

### BE-SRC-022 Missing Store Logo Validation

**Severity:** LOW

**File:** `src/services/searchService.ts` (line 170-184)

**Category:** Filters, Facets

**Description:** Store logo is returned without validation. May be broken URL, cross-origin, or missing.

**Impact:** Frontend displays broken images. Poor UX.

**Fix hint:** Validate logo URL format; use placeholder if missing.

---

### BE-SRC-023 Missing Pagination Overflow Check

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 169-187)

**Category:** Pagination

**Description:** Pagination uses `skip + limit` but no check if skip > total. Very high page numbers return empty results without indicating end of results.

**Impact:** Frontend doesn't know if results are exhausted; may keep requesting next pages indefinitely.

**Fix hint:** Return `hasMore: skip + pageStores.length < total` and `nextPage` hint.

---

### BE-SRC-024 Missing Store Rating Validation

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 108)

**Category:** Ranking

**Description:** Store rating is sorted but never validated in range [0, 5]. Corrupted data (rating=999) not detected.

**Impact:** Sorting is incorrect; ratings display wrong to users.

**Fix hint:** Clamp rating: `Math.min(5, Math.max(0, rating))` on projection.

---

### BE-SRC-025 Missing Relevance Score Bounds

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 56-77)

**Category:** Ranking

**Description:** Relevance score computation may exceed 1.0 if weights don't sum to 1. Scores: 0.35 + 0.25 + 0.40 = 1.0, but floating point error possible.

**Impact:** Scores > 1.0 break ranking assumptions. Sorting inconsistent.

**Fix hint:** Clamp result: `Math.min(1.0, Math.max(0, score))`.

---

### BE-SRC-026 Missing Empty Query Handling

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 81)

**Category:** Query Parsing

**Description:** searchStores accepts empty query string. `$text: { $search: '' }` fails or returns all stores.

**Impact:** Empty query returns all stores. Unexpected behavior.

**Fix hint:** Treat empty query as no text filter: `if (query) match.$text = { $search: query }`.

---

### BE-SRC-027 Missing Personalization User ID Validation

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 39-49)

**Category:** Ranking, Personalization

**Description:** getPriorVisitedStoreIds accepts userId but doesn't validate ObjectId format. Invalid IDs silently return empty set.

**Impact:** Personalization silently disabled for invalid user IDs.

**Fix hint:** Validate ObjectId; throw or warn if invalid.

---

### BE-SRC-028 Missing Active Offer Field Consistency

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 68)

**Category:** Ranking

**Description:** Offer boost checks `hasActiveOffer OR activeOffersCount > 0`. Fields may be inconsistent (hasActiveOffer=true but count=0).

**Impact:** Ranking inconsistent. Offers appear out of order.

**Fix hint:** Use single source of truth: `activeOffersCount > 0`.

---

### BE-SRC-029 Missing Distance Band Constants

**Severity:** LOW

**File:** `src/services/searchService.ts` (line 160)

**Category:** Ranking

**Description:** Distance band width (500m) is hardcoded. No way to tune without code change.

**Impact:** Cannot adjust ranking for different geographies. Dense areas get poor ranking.

**Fix hint:** Move to config: `const DISTANCE_BAND_WIDTH_M = 500`.

---

### BE-SRC-030 Missing Visit Count Normalization Validation

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 144-147)

**Category:** Ranking

**Description:** Max visit count is found in current batch, not across all stores. Re-ranking is relative to page, not dataset.

**Impact:** Visit count scores differ per page. Inconsistent ranking across pagination.

**Fix hint:** Use database-wide max visit count; cache for 1 hour.

---

### BE-SRC-031 Missing Suggestions Cache Memory Leak

**Severity:** MEDIUM

**File:** `src/routes/searchRoutes.ts` (line 150-216)

**Category:** Cache

**Description:** In-memory suggestions cache has no size limit. Large number of unique queries will grow Map indefinitely.

**Impact:** Memory leak. Service crashes after days of operation.

**Fix hint:** Implement LRU eviction: limit to 10K entries; remove oldest on overflow.

---

### BE-SRC-032 Missing Autocomplete Rate Limiter Bypass

**Severity:** MEDIUM

**File:** `src/routes/searchRoutes.ts` (line 234)

**Category:** Autocomplete, Rate Limiting

**Description:** Autocomplete uses rate limiter, but no distinct limits per user ID. Anonymous users share bucket with authenticated. Bulk requests consume all quota.

**Impact:** Legitimate users rate-limited due to bot traffic.

**Fix hint:** Include userId in rate limit key: `key = userId ? rl:autocomplete:${userId} : rl:autocomplete:${ip}`.

---

### BE-SRC-033 Missing Stale Cache Invalidation

**Severity:** MEDIUM

**File:** `src/services/cacheHelper.ts` (line 17)

**Category:** Cache

**Description:** Redis SET with EX uses Unix seconds. If clock skew occurs, TTL is negative. Key expires immediately.

**Impact:** Cache always misses if server time is behind. Database overload.

**Fix hint:** Use PEXPIRE (milliseconds) instead; validate TTL > 0 before SET.

---

### BE-SRC-034 Missing Null Category Handling

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 214-216)

**Category:** Filters

**Description:** Category slug filter uses string equality. No null/undefined check. Null category filter crashes aggregation.

**Impact:** Aggregation pipeline fails. Search errors on null category.

**Fix hint:** Validate `typeof category === 'string'` before filter.

---

### BE-SRC-035 Missing ObjectId Validation Consistency

**Severity:** MEDIUM

**File:** `src/services/searchService.ts` (line 202-205)

**Category:** Filters

**Description:** StoreID validation throws error, but other ID validations silently fail. Inconsistent error handling.

**Impact:** Some invalid IDs reject request (400), others silently return empty results.

**Fix hint:** Standardize: validate all ObjectIds; throw on invalid format.

---

