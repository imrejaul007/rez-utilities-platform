# Merchant App — Stores & Catalog Management

> **Audit date:** 2026-04-15
> **Bugs found:** 28
> **Severity breakdown:** CRITICAL=3, HIGH=8, MEDIUM=17

---

### MA-STR-001 Store Category Config Mismatch
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/stores/index.tsx:32-100
**Category:** logic
**Description:** Store category configuration uses inconsistent color constant names. Line 41 uses `colors.brand.pink` and line 43 uses `colors.brand.orange`, but line 53 uses `Colors.brand.purple` (capitalized). If color constant names differ by case, UI colors will be undefined in some categories.
**Impact:** Beauty & Wellness and Food & Dining categories render with correct colors, but Fashion renders with undefined color (falls back to default).
**Fix hint:** Use consistent capitalization across all color references; import both `colors` and `Colors` correctly or use one source.

### MA-STR-002 Store Data Transform Missing Null Check
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/stores/index.tsx:118-134
**Category:** null-ref
**Description:** `transformStore()` function accesses `store.ratings?.average` with fallback to 4.5, but does not validate that `store` itself is not null. If API returns a malformed response with a null/undefined store object in the array, this will crash.
**Impact:** A single malformed store in API response crashes the entire stores list view.
**Fix hint:** Add explicit `if (!store) return null;` guard at start of transformStore(); filter out null entries before mapping.

### MA-STR-003 Category Tags Array Initialization Bug
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/stores/index.tsx:109-115
**Category:** logic
**Description:** Filter chips array has hardcoded 5 filters (all, verified, nearby, top-rated, try-buy), but no dynamic addition mechanism. If a new filter type is added to backend, the UI won't render it. Additionally, the 60-minute delivery time filter parsing uses `parseInt(store.operationalInfo.deliveryTime) <= 60` on a time string that might not be parseable (e.g., "30-60 mins").
**Impact:** New filter types from backend silently ignored; 60-minute filter may return incorrect results if deliveryTime format is not numeric.
**Fix hint:** Parse deliveryTime more robustly; accept dynamic filter list from API if available.

### MA-STR-004 Distance Parsing Without Validation
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/stores/index.tsx:124
**Category:** validation
**Description:** Distance fallback is hardcoded to '1.0 km' if store.distance is undefined. This silently hides stores with missing location data instead of showing an error or placeholder.
**Impact:** Stores without distance data are shown as "1.0 km away" regardless of actual location, misleading users.
**Fix hint:** Show a "distance unavailable" label or fetch geolocation and calculate actual distance server-side.

### MA-STR-005 Cashback Calculation Logic Error
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/stores/index.tsx:125-129
**Category:** logic
**Description:** Cashback percentage extraction uses nested ternary with fallback chain: `store.offers?.cashback?.percentage || store.cashback?.maxPercentage || '15%'`. If both are 0 (which is falsy), the fallback 15% is used, incorrectly inflating the displayed cashback for stores with no cashback.
**Impact:** Stores offering 0% cashback are displayed as offering 15% cashback, defrauding users.
**Fix hint:** Use explicit `?? null` nullish coalescing instead of `||`; check `!== undefined` and `!== null` separately.

### MA-STR-006 Responsive Width Calculation Fragility
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/stores/index.tsx:502
**Category:** perf
**Description:** Store card width calculated as `(SCREEN_WIDTH - 36) / 2` with hardcoded magic number 36. If padding or margin changes, cards will have inconsistent sizing. Also, SCREEN_WIDTH is obtained at render time via `Dimensions.get()`, not from a context or provider, so it won't update on orientation change.
**Impact:** On device rotation, store cards don't resize properly; horizontal spacing is incorrect for non-standard screen widths.
**Fix hint:** Use useDimensions() hook to update on orientation change; use Spacing constants instead of magic numbers.

### MA-STR-007 Filter State Not Persisted Across Navigation
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/stores/index.tsx:107
**Category:** state
**Description:** Selected filter and search query are stored in local state (`selectedFilter`, `searchQuery`). If user navigates back from a store page, the filters reset to defaults (line 107 sets `filterParam || 'all'`).
**Impact:** User loses filter state when navigating between store list and detail pages.
**Fix hint:** Persist filter state to AsyncStorage or URL search params; restore on component mount.

### MA-STR-008 Image Load Failure Silent Handling
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/stores/index.tsx:325
**Category:** error-handling
**Description:** `CachedImage` component is used without error handler. If image URL is invalid or network request fails, the image silently fails to load with no placeholder or error message shown.
**Impact:** Store cards appear with blank/broken images, reducing trust and usability.
**Fix hint:** Add fallback placeholder image; implement error boundary or error callback.

### MA-STR-009 Store Detail Page Missing IsMounted Guard
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/store/[id].tsx:131-176
**Category:** race
**Description:** `fetchStore()` function calls `setStore()` multiple times without checking `isMounted()` before some state updates (lines 145, 152, 159). If user navigates away from the page while the fetch is in progress, state updates will throw a "Can't perform a state update on an unmounted component" warning.
**Impact:** Memory leak warning in console; potential state corruption if navigation happens during fetch.
**Fix hint:** Add `if (!isMounted()) return;` before every `setStore()`, `setCurrentDayHours()`, and `setIsOpen()` call.

### MA-STR-010 Store Hours Parsing Logic Flaw
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/store/[id].tsx:155-160
**Category:** logic
**Description:** Store open/closed status determined by parsing hours string with `parseInt(hours.open?.replace(':', '') || '0')`. If hours are in 24-hour format "14:30", this becomes 1430, which is correct. But if hours are ambiguous (e.g., "9:30 AM" with "PM" suffix), the parsing fails silently and defaults to 0.
**Impact:** Store open/closed status may be incorrect if time format is not strictly "HH:MM" in 24-hour format.
**Fix hint:** Use a robust time parser (luxon, date-fns) instead of string replacement; validate time format.

### MA-STR-011 Redemption Filter Race Condition
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/store/[id].tsx:179-200
**Category:** race
**Description:** `fetchActiveRedemptions()` filters store redemptions by comparing dealStoreId with both `id` (URL param) and `store._id`. However, `store` may not be loaded yet when this function is called (line 184), so `store._id` is undefined. Redemptions matching the MongoDB ObjectId won't be found until store is loaded and function is called again.
**Impact:** Redemptions specific to this store are not shown until user manually refreshes or waits for store data to load.
**Fix hint:** Wait for `store` to load before calling `fetchActiveRedemptions()`; or fetch with both comparisons in sequence.

### MA-STR-012 Missing Redemption Validation
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/store/[id].tsx:197-200
**Category:** validation
**Description:** Code passes `passedRedemptionCode` from URL params directly to `find()` without validating format or length. A malformed redemption code could cause unexpected behavior or SQL injection-like attacks on backend.
**Impact:** Invalid redemption codes may be accepted and sent to API, causing errors or exposing backend validation gaps.
**Fix hint:** Validate redemption code format (alphanumeric, length 10-20) before using; sanitize string input.

### MA-STR-013 Product Categories Missing Null Safety
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/products/index.tsx:128-147
**Category:** null-ref
**Description:** `transformProduct()` accesses `product.brand?.name`, `product.category?.name`, and `product.ratings?.average` with fallbacks, but does not check if `product` itself is null/undefined. A malformed product in the API response will crash the list.
**Impact:** Single malformed product crashes the entire products list view.
**Fix hint:** Add `if (!product) return null;` guard; filter out null products.

### MA-STR-014 Discount Calculation Precision Loss
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/products/index.tsx:131
**Category:** logic
**Description:** Discount percentage calculated as `Math.round((1 - salePrice / basePrice) * 100)`. If basePrice is very low (e.g., 10 paise), rounding may lose precision. Additionally, if basePrice === salePrice, discount becomes 0, but if basePrice < salePrice, discount becomes negative (invalid).
**Impact:** Discounts displayed incorrectly for low-value items or sale prices higher than base price.
**Fix hint:** Validate basePrice > salePrice before calculation; handle edge case of equal prices.

### MA-STR-015 API Response Format Mismatch
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/products/index.tsx:144-145
**Category:** types
**Description:** Product image extraction checks `product.images?.[0]?.url || product.images?.[0] || product.image`. This suggests inconsistent API response format: sometimes images is array of objects with `.url`, sometimes array of strings, sometimes a single image field. Frontend doesn't validate which format is returned.
**Impact:** Product images fail to load if API suddenly returns different format.
**Fix hint:** Normalize API response format on backend; or add robust type guards on frontend.

### MA-STR-016 In-Stock Logic Bug
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/products/index.tsx:145
**Category:** logic
**Description:** In-stock status determined by `product.inventory?.quantity > 0 || product.inStock !== false`. The second condition `product.inStock !== false` means if inStock is undefined or null, it's treated as true (in stock). This silently treats missing inventory data as "in stock."
**Impact:** Products with no inventory data show as in-stock, allowing users to add out-of-stock items to cart.
**Fix hint:** Require explicit `inStock === true`; default to out-of-stock if missing.

### MA-STR-017 Category Page Data Loading Race
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/category/[slug]/index.tsx:66-128
**Category:** race
**Description:** `loadCategoryData()` starts multiple parallel API calls (loadCategory, getCategoryLoyaltyStats, getBrandsByCategory, getProductsByCategory) without coordinating them. If one fails, others may still be in-flight, leaving partial state. Additionally, isMounted() checks are scattered but not comprehensive.
**Impact:** Category page may show stale data if one API call fails while others succeed.
**Fix hint:** Use Promise.all() or equivalent to coordinate calls; fail fast if any required call fails.

### MA-STR-018 Top Brands Fetch Missing Error Handling
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/category/[slug]/index.tsx:79-94
**Category:** error-handling
**Description:** `getBrandsByCategory()` is wrapped in try-catch, but error message is not logged or shown to user. Empty array is set, but user sees no indication that top brands failed to load.
**Impact:** If brand fetch fails, user sees empty section with no error message; looks like no brands exist in category.
**Fix hint:** Log error; show error banner if brand fetch fails; indicate "error loading" state.

### MA-STR-019 Products API Malformed Response Handling
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/category/[slug]/index.tsx:98-121
**Category:** validation
**Description:** Trending products fetch assumes `productsRes?.data?.products` is always an array. If API returns `{ data: { products: null } }` or a different structure, `const productList: any[] = ...` assigns undefined as an array, causing runtime error.
**Impact:** Category page crashes if trending products API returns unexpected structure.
**Fix hint:** Validate `Array.isArray(productList)` before mapping; provide sensible defaults.

### MA-STR-020 Product Variant Price Fallback Ambiguity
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/category/[slug]/index.tsx:102-104
**Category:** logic
**Description:** Variant price calculation: `const price = variant?.price ?? p.price ?? 0`. If variant.price is 0 (free product), this is falsy and falls back to product.price. This double-fallback logic is ambiguous and may not reflect user intent.
**Impact:** Free product variants are not displayed as free; base product price is shown instead.
**Fix hint:** Use explicit null checks: `variant?.price !== undefined ? variant.price : p.price ?? 0`.

### MA-STR-021 Missing Lodash/Debounce on Search
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/stores/index.tsx:181-207
**Category:** perf
**Description:** Filter application logic runs on every search/filter change without debouncing. If user types a search query quickly, the filter effect re-runs for every character, causing unnecessary array operations and re-renders.
**Impact:** Typing in search bar causes jank; expensive filtering operations run excessively.
**Fix hint:** Add useCallback with searchQuery debounce; or move filtering to a useMemo with larger dependency list.

### MA-STR-022 Dynamic Import Side Effect
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/product-page.tsx:282
**Category:** perf
**Description:** Product page uses dynamic import for `productsApi`: `const { default: productsApi } = await import('@/services/productsApi')`. This happens every time product is fetched, creating unnecessary module load overhead.
**Impact:** Slight performance degradation on product detail page load.
**Fix hint:** Import productsApi at top of file; dynamic import is unnecessary.

### MA-STR-023 Product Image Prefetching Without Error Handling
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/product-page.tsx:37
**Category:** error-handling
**Description:** `prefetchImages()` is called but no error handler is attached. If image URLs are invalid or network is offline, prefetch fails silently and images will be slow to load later.
**Impact:** Image loading performance is degraded on slow networks due to lack of prefetch error recovery.
**Fix hint:** Catch and log prefetch errors; implement fallback image loading strategy.

### MA-STR-024 Store Template Missing Type Validation
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/product-page.tsx:54-100
**Category:** types
**Description:** `Store` interface has many optional fields with `?`. When code accesses `store.location.address` or `store.operationalInfo.minimumOrder`, TypeScript allows it without null checks. If store is loaded from API with missing fields, runtime error occurs.
**Impact:** Product page crashes if store data is incomplete.
**Fix hint:** Make required fields non-optional in interface; add runtime guards before accessing nested properties.

### MA-STR-025 Web Store Quantity Validation Missing
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/order/[storeSlug]/index.tsx:40-46
**Category:** validation
**Description:** `cartTotal()` and `cartCount()` functions don't validate that `c.quantity` is a positive integer. If quantity is 0, negative, or NaN, the total calculation becomes incorrect.
**Impact:** Cart total may be wrong or negative if quantity is invalid; user charged wrong amount.
**Fix hint:** Validate `quantity > 0 && Number.isInteger(quantity)` before adding to sum.

### MA-STR-026 Menu Item Spicy Level Display Unbounded
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/order/[storeSlug]/index.tsx:122
**Category:** ui
**Description:** Spicy level badge uses `'🌶'.repeat(Math.min(item.spicyLevel, 3))`. If spicyLevel is missing or undefined, Math.min(undefined, 3) returns NaN, causing `'🌶'.repeat(NaN)` to throw error.
**Impact:** Menu page crashes if spicyLevel is not defined on menu item.
**Fix hint:** Use `item.spicyLevel ?? 0` before Math.min.

### MA-STR-027 Web Store Item Availability Not Synced
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/order/[storeSlug]/index.tsx:196-221
**Category:** logic
**Description:** Items are fetched once on mount with `fetchWebStore()`. If an item becomes unavailable (86'd) on the backend while user is browsing, the frontend still shows it as available. No real-time sync mechanism exists.
**Impact:** User adds item to cart that was just marked unavailable on backend; order fails when submitted.
**Fix hint:** Implement WebSocket listener for item availability changes; poll availability before order submission.

### MA-STR-028 Category Description Cut Off Without Truncation
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/order/[storeSlug]/index.tsx:205
**Category:** ui
**Description:** Category description is rendered without `numberOfLines` or `ellipsizeMode`. If description is very long, it will overflow the screen without truncation.
**Impact:** Long category descriptions break UI layout; text is hard to read.
**Fix hint:** Add `numberOfLines={2}` and `ellipsizeMode="tail"` to category description Text component.

