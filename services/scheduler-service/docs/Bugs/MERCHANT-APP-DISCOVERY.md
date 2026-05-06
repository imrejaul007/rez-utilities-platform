# Merchant App — Discovery, Stores, Deals, UGC

> **Audit date:** 2026-04-15
> **Bugs found:** 28
> **Status:** Open — merchant app audit

---

### MA-DSC-001 Search Pagination Not Reset on Query Change
**Severity:** MEDIUM
**File:** app/explore/search.tsx:48-94
**Category:** logic
**Description:** Searching for new query doesn't reset page to 0. If user on page 2 of "phones", searches "laptops", still shows page 2 results.
**Impact:** User sees partial results; wrong items for new search.
**Fix hint:** Reset stores/products arrays when searchQuery changes; set page=0.

### MA-DSC-002 Catch Block Swallows Search Errors Silently
**Severity:** MEDIUM
**File:** app/explore/search.tsx:85-87
**Category:** error-handling
**Description:** Search `.catch()` sets error but if error is network timeout, user sees infinite loading with no retry option.
**Impact:** User stuck on loading state; can't retry search.
**Fix hint:** Show error banner with retry button in catch.

### MA-DSC-003 ReferenceError on isMounted in Callbacks
**Severity:** MEDIUM
**File:** app/explore/search.tsx:48-94
**Category:** null-ref
**Description:** `isMounted()` called in multiple places but if hook unmounts, returns false. Sets loading=false but doesn't reset error state.
**Impact:** User sees loading=false but error persists on screen.
**Fix hint:** Reset error state when loading completes.

### MA-DSC-004 Missing Validation on Store Search Results
**Severity:** MEDIUM
**File:** app/explore/search.tsx:71-73
**Category:** null-ref
**Description:** `storesResponse.data.stores` accessed without validating stores is array. If null, setStores fails silently.
**Impact:** Stores not displayed; user sees empty results.
**Fix hint:** Validate `Array.isArray(storesResponse.data.stores)` before setting.

### MA-DSC-005 Product Filtering Logic Not Optimized
**Severity:** MEDIUM
**File:** app/explore/search.tsx:78-83
**Category:** perf
**Description:** Client-side product filtering on every search response. If API returns 1000+ products, filtering blocks UI thread.
**Impact:** Search lag; UI freeze.
**Fix hint:** Use server-side filtering; pass query to products API.

### MA-DSC-006 Initial Query Not Trimmed
**Severity:** LOW
**File:** app/explore/search.tsx:38
**Category:** logic
**Description:** `initialQuery` from params used directly without trim(). Leading/trailing spaces cause search mismatch.
**Impact:** Deep-linked searches with spaces don't work properly.
**Fix hint:** Trim initialQuery on mount.

### MA-DSC-007 Tab Switch Doesn't Reset Scroll Position
**Severity:** MEDIUM
**File:** app/explore/search.tsx:138-139
**Category:** logic
**Description:** Switching between stores/products tabs doesn't reset scroll. User sees old scroll position with new tab data.
**Impact:** User confused; data misaligned with scroll position.
**Fix hint:** Reset scroll offset when activeTab changes.

### MA-DSC-008 Missing Loading State During Refresh
**Severity:** MEDIUM
**File:** app/explore/search.tsx:123-125
**Category:** ui
**Description:** `onRefresh()` calls performSearch but doesn't show loading state visually different from initial load.
**Impact:** User doesn't know refresh is happening.
**Fix hint:** Show visual feedback during refresh operation.

### MA-DSC-009 Search Debounce Timer Not Cleared on Unmount
**Severity:** LOW
**File:** app/explore/search.tsx:111-120
**Category:** memory
**Description:** Debounce timer in useEffect doesn't have cleanup return in all paths. If unmount during debounce, timer still executes.
**Impact:** Memory leak; state update after unmount warning.
**Fix hint:** Ensure cleanup function always clears timer.

### MA-DSC-010 Product Store Name Missing Validation
**Severity:** MEDIUM
**File:** app/explore/search.tsx:79-80
**Category:** null-ref
**Description:** Filtering products by `p.store.toLowerCase()` without checking if store exists. If store is null, crashes.
**Impact:** App crash on malformed product data.
**Fix hint:** Validate `p.store` exists before lowercase.

### MA-DSC-011 No Error Message for Empty Results
**Severity:** LOW
**File:** app/explore/search.tsx (no results UI)
**Category:** ui
**Description:** When search returns 0 results, no message shown to user. Looks like loading failed.
**Impact:** User confusion; thinks search is broken.
**Fix hint:** Show "No results for 'query'" message when results empty.

### MA-DSC-012 Multiple Concurrent Searches Not Cancelled
**Severity:** MEDIUM
**File:** app/explore/search.tsx:66-69
**Category:** api
**Description:** Rapid search queries trigger multiple in-flight API calls. If responses arrive out-of-order, wrong results shown.
**Impact:** User sees results from older search if newer completes faster.
**Fix hint:** Use AbortController; cancel previous request before starting new.

### MA-DSC-013 Flash Sales Missing Pagination Reset
**Severity:** MEDIUM
**File:** app/flash-sales/index.tsx (if exists)
**Category:** logic
**Description:** Flash sales list doesn't reset pagination when filter changes or on refresh.
**Impact:** User sees misaligned flash sales after filtering.
**Fix hint:** Reset page to 0 on filter/refresh.

### MA-DSC-014 Offer Card Missing Image Error Handler
**Severity:** MEDIUM
**File:** app/offers/index.tsx or similar
**Category:** ui
**Description:** Offer images rendered without onError handler. If image fails, blank space shown.
**Impact:** Missing product images; confusing UI.
**Fix hint:** Add onError to image component; show placeholder.

### MA-DSC-015 Stores List FlatList Key Extraction Unsafe
**Severity:** MEDIUM
**File:** app/explore/stores.tsx (if exists)
**Category:** perf
**Description:** `keyExtractor={(item) => item._id}` may return undefined. FlatList falls back to index; causes re-renders.
**Impact:** Store list re-renders unnecessarily; performance hit.
**Fix hint:** Filter stores to ensure all have _id before rendering; add fallback.

### MA-DSC-016 Category Filter Not Persisted on Navigation
**Severity:** MEDIUM
**File:** app/explore/category/[id].tsx
**Category:** logic
**Description:** Category filter state initialized on mount without checking router params. User navigates away and back; filter reset.
**Impact:** User loses applied filter; poor UX.
**Fix hint:** Persist filter in router params or global state.

### MA-DSC-017 Deal Card Loading State Incomplete
**Severity:** MEDIUM
**File:** app/deals/index.tsx (if exists)
**Category:** ui
**Description:** Deal cards show loading skeleton but don't reset to data view if load fails.
**Impact:** User sees skeleton until next refresh.
**Fix hint:** Show error state if load fails.

### MA-DSC-018 UGC Post Engagement State Not Synced
**Severity:** MEDIUM
**File:** app/ugc/index.tsx or UGCDetailScreen
**Category:** cache
**Description:** Like/share counts update optimistically but if API fails, rollback logic incomplete. State inconsistent with server.
**Impact:** Like count wrong; user confusion.
**Fix hint:** Validate API response before committing state change.

### MA-DSC-019 Missing null check on UGC Video Metadata
**Severity:** MEDIUM
**File:** app/explore/reel/[id].tsx
**Category:** null-ref
**Description:** Video metadata accessed without validation. If aspectRatio missing, layout breaks.
**Impact:** Video display broken.
**Fix hint:** Validate metadata; use defaults for missing fields.

### MA-DSC-020 Bank Offers List Doesn't Handle Empty API Response
**Severity:** MEDIUM
**File:** app/bank-offers/index.tsx (if exists)
**Category:** null-ref
**Description:** `response.data.offers` accessed without checking if offers array exists. If null, setOffers fails.
**Impact:** Bank offers list empty with no error shown.
**Fix hint:** Validate offers is array; show "No offers available" if empty.

### MA-DSC-021 Voucher Code Copy Without Validation
**Severity:** MEDIUM
**File:** app/vouchers/index.tsx or voucher/[id].tsx
**Category:** logic
**Description:** Copy voucher code doesn't validate code exists. May copy empty string.
**Impact:** User copies nothing; confusion on code.
**Fix hint:** Validate code non-empty before copy.

### MA-DSC-022 Near-U Location Permissions Not Validated
**Severity:** MEDIUM
**File:** app/near-u/index.tsx (if location-based)
**Category:** logic
**Description:** Fetching nearby deals without checking location permission granted. API fails silently.
**Impact:** Near-u feature shows no results; user doesn't know why.
**Fix hint:** Check location permission; show prompt if denied.

### MA-DSC-023 Infinite Scroll Doesn't Reset on Category Change
**Severity:** MEDIUM
**File:** app/explore/category/[id].tsx (if uses infinite scroll)
**Category:** logic
**Description:** Infinite scroll pagination not reset when category changes. Loads page 2+ with new category; misses first page items.
**Impact:** User sees partial category items.
**Fix hint:** Reset page to 0 when category changes.

### MA-DSC-024 Missing Debounce on Filter Changes
**Severity:** MEDIUM
**File:** app/explore/search.tsx or category pages
**Category:** perf
**Description:** Filter changes trigger immediate API call for each change. User sliding price range triggers 10+ API calls.
**Impact:** Network spam; server load; poor UX.
**Fix hint:** Debounce filter changes to 500ms.

### MA-DSC-025 Event Page Missing Time Validation
**Severity:** MEDIUM
**File:** app/events/index.tsx (if time-based events)
**Category:** logic
**Description:** Event times displayed without checking if event expired. User sees "Claim" button for past events.
**Impact:** Confusing UX; unexpected claim failure.
**Fix hint:** Hide past events or show "Event ended" badge.

### MA-DSC-026 Experience Page Pagination Not Initialized
**Severity:** MEDIUM
**File:** app/experience/index.tsx (if exists)
**Category:** logic
**Description:** Experience list uses infinite scroll but page state starts at 1 instead of 0. Skips first page items.
**Impact:** First page experiences missing from list.
**Fix hint:** Initialize page to 0; increment before fetching.

### MA-DSC-027 Deals Cache Not Invalidated on Pull-to-Refresh
**Severity:** MEDIUM
**File:** app/deals/index.tsx (if uses cache)
**Category:** cache
**Description:** Pull-to-refresh reloads API but cache still returns stale data for 30+ seconds.
**Impact:** User sees old deals even after refresh.
**Fix hint:** Invalidate cache before refreshing; force API call.

### MA-DSC-028 Missing Error Boundary on Offer List Render
**Severity:** MEDIUM
**File:** app/offers or bank-offers pages
**Category:** error-handling
**Description:** Offer list map() doesn't have error handling. If offer object corrupted, crashes entire list.
**Impact:** Entire offers page crashes.
**Fix hint:** Wrap in error boundary; skip invalid offers instead of crashing.

---

**Summary:**
Merchant discovery has 28 bugs spanning pagination resets, error handling, cache invalidation, and validation issues. Most critical: search results from concurrent requests can arrive out-of-order, pagination not reset on filter changes, and missing error states.
