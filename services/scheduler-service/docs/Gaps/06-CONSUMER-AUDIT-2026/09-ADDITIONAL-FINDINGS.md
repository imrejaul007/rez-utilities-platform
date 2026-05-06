# Additional Findings: Service Layer, Code Quality & Cross-App — Audit 2026-04-16

**Consumer App:** 25 new issues in `services/`, `hooks/`, `contexts/`, `stores/` (1 CRIT, 4 HIGH, 8 MED, 12 LOW)
**Cross-App Scan (Part B):** 50+ systemic issues across consumer + merchant + admin apps
**Extended Deep-Scan (Part C):** 10 new issues (2 CRIT, 3 HIGH, 3 MED, 2 LOW)
**Gen 11 Deep Scan (Part D):** 6 new issues in consumer app (1 CRIT, 2 HIGH, 2 MED, 1 LOW)
**Total in this doc: 4 CRITICAL, 11 HIGH, 19 MEDIUM, 19+ LOW**

---

## PART A: Consumer App — Service Layer Issues (from code scan)

## CRITICAL

### NA2-CRIT-01: 13 Fire-and-Forget API Calls in `homepageDataService.ts`

### NA2-CRIT-01: 13 Fire-and-Forget API Calls in `homepageDataService.ts`

**Severity:** CRITICAL
**File:** `services/homepageDataService.ts:209-365,1194-1215`
**Category:** Data Loss / Fire-and-Forget
**Gap ID:** NA2-CRIT-01
**Status:** ACTIVE
**Est Fix:** 2 hours

### Description
Four `getHomepageData()` calls use `.catch(() => {})` — silently swallowing all errors. Additionally, two Sentry error reporting calls also use `.catch(() => {})`, meaning Sentry errors are themselves lost.

```typescript
// Line 209-212:
apiClient.get('/homepage/categories').then(/* ... */).catch(() => {});
}).catch(() => {});  // Sentry error reporting ALSO swallowed

// Line 362-365: same pattern
// Line 1194-1195: same pattern
// Line 1214-1215: Sentry error reporting swallowed
```

### Impact
If any homepage API call fails, the app shows stale or empty data with no error. The error is silently swallowed and not reported to Sentry. Homepage sections fail silently — users see blank/empty sections with no indication something went wrong.

### Fix Direction
Replace all `.catch(() => {})` with proper error handling that either retries, falls back gracefully, or surfaces the error to the user.

---

## HIGH

### NA2-HIGH-01: 13+ `as any` Type Casts in Single File

**Severity:** HIGH
**File:** `app/MainStorePage.tsx:104,109,131,165,223,251,294,323,327,343`
**Category:** Type Safety
**Gap ID:** NA2-HIGH-01
**Status:** ACTIVE
**Est Fix:** 3 hours

### Description
`MainStorePage.tsx` uses `as any` 13+ times to bypass TypeScript's type system:

```typescript
d.currentStoreName || '')` as any          // line 104
const phone = (d.storeData as any)?.contact?.phone  // line 109
(tabsContainerRef.current as any).measure  // line 131
const payload = (res as any).data?.data   // line 165
photoCount: (d.storeData as any)?.photoCount  // line 223
contentContainerStyle={contentContainerStyle as any}  // line 251
const coords = (d.storeData.location as any).coordinates  // line 294
(d.storeData as any).offers?.cashback  // line 323
(d.storeData as any).rewardRules?.reviewBonusCoins  // line 327
} as any)  // line 343
```

### Impact
TypeScript's type system provides zero protection for these code paths. Any backend field rename breaks these reads silently. Unknown properties return `undefined` — no type errors.

### Fix Direction
Define proper typed interfaces for the store data response. Replace all `as any` with typed accessors.

---

### NA2-HIGH-02: `authApi.isTokenValid()` Exists But Is a No-Op

**Severity:** HIGH
**File:** `services/authApi.ts:753-758`
**Category:** Dead Code / Misleading API
**Gap ID:** NA2-HIGH-02
**Related:** NA-LOW-08 (same issue, different angle)
**Status:** ACTIVE
**Est Fix:** 1 hour

### Description
The method is explicitly documented as non-functional:
```typescript
/**
 * TODO (MED-3): This method is NOT implemented. It always returns false.
 * Token refresh is handled automatically by AuthContext.tryRefreshToken()
 * via the apiClient 401 interceptor.
 *
 * @deprecated Use AuthContext.tryRefreshToken() instead.
 */
```

### Impact
Any code that calls `authApi.isTokenValid()` gets a misleading `false` response and makes wrong decisions about whether to proceed with requests.

### Fix Direction
Either implement properly (decode JWT, check `exp` claim) or remove the method entirely. If needed, expose `AuthContext.tryRefreshToken()` as a callable utility.

---

### NA2-HIGH-03: `apiClient` Certificate Pinning Not Implemented

**Severity:** HIGH
**File:** `services/apiClient.ts:128,320`
**Category:** Security / MITM
**Gap ID:** NA2-HIGH-03
**Status:** ACTIVE
**Est Fix:** 4 hours

### Description
Two TODOs explicitly state certificate pinning is not implemented:
```typescript
// Line 128:
// TODO: On native, implement certificate pinning via react-native-cert-pinning
// to validate the API server's certificate hash and prevent MITM attacks.

// Line 320:
// TODO: Implement certificate pinning for auth and payment endpoints in production:
```

### Impact
On compromised devices (rooted Android, jailbroken iOS), an attacker with a rogue CA can perform MITM attacks on auth and payment endpoints. Combined with localStorage token storage (NA-HIGH-21), the attack surface is significant.

### Fix Direction
Implement `react-native-cert-pinning` for auth and payment endpoints. For web, use HSTS and enforce HTTPS at the network layer.

---

### NA2-HIGH-04: 9 Silent `.catch(() => {})` in App/Hook Layer

**Severity:** HIGH
**Files:**
- `app/MainStorePage.tsx:111,169` — `.catch(() => {})`
- `app/EventPage.tsx:222,228,237` — `.catch(() => {})` with "Silent: non-critical" comments
- `app/offers/birthday.tsx:300` — `.catch(_e) {}`
- `app/MainStoreSection/MainStoreHeader.tsx:66` — `.catch(error: any) {}`
- `hooks/useSearchPage.ts:273,284,514` — `.catch(() => {})`
- `hooks/useOffersPage.ts:356` — `.catch(() => {})`
**Category:** Silent Error Swallowing
**Gap ID:** NA2-HIGH-04
**Status:** ACTIVE
**Est Fix:** 3 hours

### Description
9+ call sites across app screens and hooks silently swallow errors. `EventPage.tsx` explicitly comments "Silent: non-critical" but the reward-fetching and favorite-status calls could surface meaningful errors.

### Impact
Users see no feedback when these operations fail. Developers cannot debug failures. In particular:
- `useSearchPage.ts:284` — fire-and-forget search history save: if the backend endpoint changes or fails, search history is silently lost
- `EventPage.tsx:222,228` — reward info and favorite status silently fail; user sees no indication their interaction wasn't registered

### Fix Direction
Replace silent catches with: retry logic, user-visible error, or at minimum `console.warn` for operations that shouldn't block the UI.

---

## MEDIUM

### NA2-MED-01: Coupon Validation Not Implemented

**Severity:** MEDIUM
**File:** `services/cartApi.ts:632`
**Category:** Business Logic / Incomplete
**Gap ID:** NA2-MED-01
**Status:** ACTIVE
**Est Fix:** 3 hours

### Description
```typescript
// TODO: Validate coupon applicability (minOrderValue, categories, user tier)
// This requires fetching coupon details and checking against current cart.
```

`applyCoupon()` accepts any coupon code and applies it without validation. A coupon that requires a Rs.500 minimum can be applied to a Rs.50 cart.

### Impact
Users can apply coupons that shouldn't be valid, leading to incorrect discounts. Backend may reject the order, creating a confusing UX failure at checkout.

### Fix Direction
Fetch coupon details and validate eligibility before applying. Check `minOrderValue`, `applicableCategories`, and `userTier` client-side before the API call.

---

### NA2-MED-02: Hardcoded Partner Names in karma Wallet Screen

**Severity:** MEDIUM
**File:** `app/karma/wallet.tsx:353`
**Category:** Business Logic / Hardcoded
**Gap ID:** NA2-MED-02
**Status:** ACTIVE
**Est Fix:** 30 minutes

### Description
```typescript
{['Partner A', 'Partner B', 'Partner C'].map((brand, idx) => (
  // TODO: Replace with dynamic partner data from API
```

### Impact
Users see placeholder brand names. No real partner data is fetched from API.

---

### NA2-MED-03: `backendMonitoringService` Reports Fake Uptime

**Severity:** MEDIUM
**File:** `services/backendMonitoringService.ts:480`
**Category:** Monitoring / Incomplete
**Gap ID:** NA2-MED-03
**Status:** ACTIVE
**Est Fix:** 1 hour

### Description
```typescript
uptime: 99.9, // TODO: Calculate from actual uptime data
```

### Impact
Monitoring dashboard shows fake uptime data. Real outages may go undetected.

### Fix Direction
Calculate actual uptime from timestamped health-check results stored in local state.

---

### NA2-MED-04: Socket.IO Stock Updates Not Integrated

**Severity:** MEDIUM
**File:** `services/cartValidationService.ts:175`
**Category:** Architecture / Missing Feature
**Gap ID:** NA2-MED-04
**Status:** ACTIVE
**Est Fix:** 4 hours

### Description
```typescript
// TODO (FUTURE WORK): Implement Socket.IO integration for live stock updates:
// 1. Connect to stock update channel on checkout page mount
```

Cart stock validation is polling-based. No real-time updates.

### Impact
Users can add out-of-stock items to cart if stock changes between validation and checkout.

---

### NA2-MED-05: Search History Save is Fire-and-Forget

**Severity:** MEDIUM
**File:** `hooks/useSearchPage.ts:284,514`
**Category:** Data Loss
**Gap ID:** NA2-MED-05
**Status:** ACTIVE
**Est Fix:** 1 hour

### Description
```typescript
apiClient.post('/search/history', { query, type: 'general', resultCount, region: currentRegion }).catch(() => {});
```

Search history is saved without any retry or persistence guarantee. If the POST fails, search history is silently lost.

### Impact
Users lose search history when searches are made in poor connectivity. No offline queue for search history.

---

### NA2-MED-06: `Linking.openURL` Silently Fails in MainStorePage

**Severity:** MEDIUM
**File:** `app/MainStorePage.tsx:111`
**Category:** UX / Silent Failure
**Gap ID:** NA2-MED-06
**Status:** ACTIVE
**Est Fix:** 30 minutes

### Description
```typescript
Linking.openURL(`tel:${phone}`).catch(() => {});
```

Phone call initiation silently fails if no phone app is available. Users see no feedback.

### Fix Direction
Wrap in try-catch that shows a `Toast` or falls back to copying the number.

---

### NA2-MED-07: Page Extras Fetch Silently Fails in MainStorePage

**Severity:** MEDIUM
**File:** `app/MainStorePage.tsx:169`
**Category:** Data Sync / Silent Failure
**Gap ID:** NA2-MED-07
**Status:** ACTIVE
**Est Fix:** 1 hour

### Description
```typescript
.get(`/stores/${d.currentStoreId}/page-extras`, { signal: abortController.signal })
  .then((res) => {
    if (cancelled) return;
    const payload = (res as any).data?.data;
    if (payload?.upcomingDrop) setUpcomingDrop(payload.upcomingDrop);
  })
  .catch(() => {});  // SILENT
```

If `page-extras` fails, `upcomingDrop` is never set. Users see no drop feature without any indication.

---

### NA2-MED-08: Analytics Event Version Hardcoded

**Severity:** MEDIUM
**File:** `services/analytics/providers/CustomProvider.ts:68`
**Category:** Quality / Data Accuracy
**Gap ID:** NA2-MED-08
**Status:** ACTIVE
**Est Fix:** 15 minutes

### Description
```typescript
appVersion: '1.0.0', // TODO: Get from app config
```

### Impact
Analytics events are all attributed to version `'1.0.0'` regardless of actual app version. Version-specific analytics are meaningless.

---

## LOW

### NA2-LOW-01: `isTokenValid()` Deprecated But Still Exported

**Severity:** LOW
**File:** `services/authApi.ts:753`
**Category:** Dead Code
**Gap ID:** NA2-LOW-01
**Related:** NA-HIGH-02 (same issue), NA-LOW-08 (prior audit)
**Status:** ACTIVE
**Est Fix:** 30 minutes

### Description
Method is marked `@deprecated` with `TODO (MED-3)` but still exported. Any import of `authApi.isTokenValid` gets a no-op.

---

### NA2-LOW-02: `HomepageDataService` 4 Silent Cache Error Swallows

**Severity:** LOW
**File:** `services/homepageDataService.ts:210,212,363,365`
**Category:** Silent Error
**Gap ID:** NA2-LOW-02
**Status:** ACTIVE
**Est Fix:** 1 hour

### Description
Four `.catch(() => {})` on cache read/write operations for homepage sections.

---

### NA2-LOW-03: `cacheService.ts` Silent Analytics Error

**Severity:** LOW
**File:** `services/cacheService.ts:633`
**Category:** Silent Error
**Gap ID:** NA2-LOW-03
**Status:** ACTIVE
**Est Fix:** 30 minutes

### Description
Analytics flush failure silently swallowed.

---

### NA2-LOW-04: `useSearchPage` 3 Silent Search Error Swallows

**Severity:** LOW
**File:** `hooks/useSearchPage.ts:273,284,514`
**Category:** Silent Error
**Gap ID:** NA2-LOW-04
**Status:** ACTIVE
**Est Fix:** 1 hour

### Description
Search suggestion fetch, search history save, and duplicate save all silently fail.

---

### NA2-LOW-05: `useOffersPage` Silent Offer Load Error

**Severity:** LOW
**File:** `hooks/useOffersPage.ts:356`
**Category:** Silent Error
**Gap ID:** NA2-LOW-05
**Status:** ACTIVE
**Est Fix:** 30 minutes

---

### NA2-LOW-06: `MainStoreHeader` Silent Share Error

**Severity:** LOW
**File:** `app/MainStoreSection/MainStoreHeader.tsx:66`
**Category:** Silent Error
**Gap ID:** NA2-LOW-06
**Status:** ACTIVE
**Est Fix:** 30 minutes

```typescript
} catch (error: any) {}
```

### NA2-LOW-07: `EventPage` Silent Reward Fetch

**Severity:** LOW
**File:** `app/EventPage.tsx:222,228,237`
**Category:** Silent Error
**Gap ID:** NA2-LOW-07
**Status:** ACTIVE
**Est Fix:** 1 hour

Comments say "non-critical" but reward display failures should be surfaced.

---

### NA2-LOW-08: `birthday.tsx` Silent Share Error

**Severity:** LOW
**File:** `app/offers/birthday.tsx:300`
**Category:** Silent Error
**Gap ID:** NA2-LOW-08
**Status:** ACTIVE
**Est Fix:** 30 minutes

---

### NA2-LOW-09: `gamificationTriggerService` Notification Stub

**Severity:** LOW
**File:** `services/gamificationTriggerService.ts:323`
**Category:** Incomplete
**Gap ID:** NA2-LOW-09
**Status:** ACTIVE
**Est Fix:** 1 hour

```typescript
// TODO: Trigger challenge completion notification
```

---

### NA2-LOW-10: `cartApi` Coupon Validation TODO

**Severity:** LOW
**File:** `services/cartApi.ts:632`
**Category:** Incomplete (also in NA2-MED-01)
**Gap ID:** NA2-LOW-10
**Status:** ACTIVE

---

### NA2-LOW-11: `JSON.stringify` for User Object Comparison

**Severity:** LOW
**File:** `contexts/AuthContext.tsx:755`
**Category:** Security / Timing
**Gap ID:** NA2-LOW-11
**Status:** ACTIVE

```typescript
if (JSON.stringify(response.data) !== JSON.stringify(storedUser)) {
// TODO: If comparing sensitive data, use crypto.timingSafeEqual()
```

While not sensitive data here, the pattern is noted as a TODO. The actual comparison may have timing implications.

---

### NA2-LOW-12: 2 Placeholder Brand Names in karma Wallet

**Severity:** LOW
**File:** `app/karma/wallet.tsx:353`
**Category:** Data / Hardcoded
**Gap ID:** NA2-LOW-12
**Related:** NA2-MED-02 (same issue)
**Status:** ACTIVE

---

## PART B: Cross-App Systemic Scan (2026-04-16 Extended)

Scan across `rez-app-consumer/`, `rezmerchant/`, and `rez-app-admin/` for systematic issue patterns.

### Scope Numbers at a Glance

| Codebase | `as any` | `console.log` | TODO | Silent `.catch()` | Hardcoded |
|---------|----------|--------------|------|------------------|-----------|
| **Consumer App** | 250 files | 571 in services | 1,468 across 250 files | 106 files | 90 files |
| **Merchant App** | 839 files | — | — | 0 files | — |
| **Admin App** | 366 files | — | — | 0 files | — |

---

### Cross-App CRITICAL Issues

### XA-CRIT-01: `@/types/unified` Import in 7 Consumer Files — Build Failure

**Severity:** CRITICAL
**Files:**
- `services/ordersApi.ts:11`
- `services/cartApi.ts:12`
- `services/storesApi.ts:12`
- `services/productsApi.ts:12`
- `services/authApi.ts:11`
- `contexts/AuthContext.tsx:14`
- `contexts/CartContext.tsx:56`
**Gap ID:** NA-CRIT-04, CS-A12
**Related:** `09-CROSS-SERVICE-2026/API-CONTRACT-MISMATCHES.md` CS-A12

**Finding:**
All 7 files import from `@/types/unified` which **does not exist**. TypeScript compilation fails. The app will not build.

```typescript
} from '@/types/unified';  // FILE DOES NOT EXIST
```

**Impact:** App build fails completely. No deploy possible.

**Fix:** Create `src/types/unified.ts` with canonical type definitions, or migrate imports to the actual canonical types.

---

### XA-CRIT-02: 6 Duplicate Service Pairs — Migration Never Completed

**Severity:** CRITICAL
**Files:**
1. `services/orderApi.ts` + `services/ordersApi.ts`
2. `services/productApi.ts` + `services/productsApi.ts`
3. `services/reviewApi.ts` + `services/reviewsApi.ts`
4. `services/storeApi.ts` + `services/storesApi.ts` (implied)
5. `services/webOrderApi.ts` + `services/webOrderingApi.ts`
6. `services/coinSyncService.ts` + `services/pointsApi.ts` + `services/walletApi.ts`
**Gap ID:** NA-HIGH-11, CS-A17
**Related:** `09-CROSS-SERVICE-2026/API-CONTRACT-MISMATCHES.md` CS-A17

**Finding:**
Three pairs of overlapping services (with `@deprecated` comments but no actual migration enforcement):

- `orderApi.ts` → `ordersApi.ts` (comment: "marked 2026-04-11")
- `productApi.ts` → `productsApi.ts` (comment: "verbose structure doesn't match actual API responses")
- `reviewApi.ts` → `reviewsApi.ts` (comment: "This file has incorrect API paths")
- `webOrderApi.ts` → `webOrderingApi.ts` (no deprecation comment, active use)

Additionally, three coin sources with no cross-verification:
- `walletApi.getBalance()` — canonical wallet balance
- `pointsApi.getBalance()` — falls back to wallet on 404
- `coinSyncService` — separate sync mechanism

```typescript
// services/orderApi.ts:1-5
/**
 * @deprecated Use ordersApi.ts instead. This file is only kept for
 * app/orders/[orderId]/tracking.tsx which should be migrated.
 */

// services/reviewsApi.ts:1-2
// DEPRECATED: Use reviewApi.ts instead. This file has incorrect API paths.
```

**Impact:** Both files are imported across the codebase. Wrong one may be used. Users see different coin balances in different places. No single source of truth for orders, products, reviews.

**Fix:** Enforce deprecation via ESLint rule. Migrate all imports to canonical service. Consolidate coin sources into single wallet API.

---

### Cross-App HIGH Issues

### XA-HIGH-01: 7 Competing Status Enum Definitions Across Consumer App

**Severity:** HIGH
**Files:** Every service file defines its own status types
**Gap ID:** XREP family, CS-E1
**Related:** `09-CROSS-SERVICE-2026/ENUM-FRAGMENTATION.md`

**Finding:**
Over 25 different status type definitions across the consumer app. Key divergences:

| Domain | File | Values |
|--------|------|--------|
| Order (OrderStatus) | `types/order.ts:6` | `'pending' \| 'confirmed' \| 'preparing' \| 'ready' \| 'completed' \| 'cancelled' \| 'refunded'` |
| Order (WebOrderStatus) | `services/webOrderingApi.ts:94` | `'pending_payment' \| 'paid' \| 'confirmed' \| 'preparing' \| 'ready' \| 'completed' \| 'cancelled'` |
| Order (webOrderApi) | `services/webOrderApi.ts:65` | `'pending' \| 'confirmed' \| 'preparing' \| 'ready'` (incomplete set) |
| Payment | `types/payment.types.ts:15` | `'pending' \| 'processing' \| 'completed' \| 'failed' \| 'refunded'` |
| Transaction | `services/earningsCalculationService.ts:189` | `t.status?.current === 'pending'` (nested path) |
| Offline | `services/offlineSyncService.ts:64` | `'pending' \| 'syncing' \| 'success' \| 'failed'` |
| Referral | `services/referralApi.ts:35` | `'pending' \| 'completed' \| 'cancelled'` |
| Review | `services/reviewsApi.ts:68` | `'approved' \| 'pending' \| 'rejected' \| 'flagged'` |
| Social | `services/socialMediaApi.ts:27` | `'pending' \| 'approved' \| 'rejected' \| 'credited'` |
| Project | `services/earningProjectsApi.ts:12` | `'available' \| 'in_progress' \| 'in_review' \| 'completed' \| 'expired'` |
| Tournament | `services/tournamentApi.ts:19` | `'upcoming' \| 'active' \| 'completed' \| 'cancelled'` |

`pending_payment` vs `pending` — same concept, different strings. `paid` vs `completed` — same concept, different strings.

**Impact:** Status comparisons across pages fail silently. React Query cache keys diverge. Users see inconsistent order states.

---

### XA-HIGH-02: 6 Competing CoinType Definitions Across Consumer App

**Severity:** HIGH
**Files:** walletApi.ts, karmaService.ts, bonusZoneApi.ts, hotelOtaApi.ts, instantRewardApi.ts, checkout hooks
**Gap ID:** XREP-12, CS-A13
**Related:** `09-CROSS-SERVICE-2026/TYPE-DRIFT.md` CS-T1

**Finding:**
Same coin concept, different type definitions:

| Coin Type Set | Source | Values |
|---------------|--------|--------|
| Standard | `walletApi.ts:810` | `'rez' \| 'promo' \| 'branded' \| 'prive'` |
| Karma | `karmaService.ts:270` | `'karma_points' \| 'rez_coins' \| 'all'` |
| Bonus Zone | `bonusZoneApi.ts:34` | `'rez' \| 'branded'` |
| Hotel OTA | `hotelOtaApi.ts:394` | `'ota' \| 'rez' \| 'hotel_brand'` |
| Instant Reward | `instantRewardApi.ts:14` | `'rez' \| 'branded'` |
| Checkout UI | `useCheckout.ts:1436-1443` | `'rez' \| 'promo' \| 'storePromo' \| 'branded'` |

`karma_points` vs `rez` vs `rez_coins` — three names for the same coin type across different services. `hotel_brand` vs `branded` — different names for the same thing.

```typescript
// app/karma/wallet.tsx:263 — runtime fallback
const coinType: string = (coin as any).type || (coin as any).source || 'rez';
```

**Impact:** Coin balance queries fail silently when wrong type is passed. Hotel OTA coins never credit correctly (OTA service sends `hotel_brand`, wallet expects `branded`). Users see zero balance for valid coins.

---

### XA-HIGH-03: `WebOrderStatus` Defined in Two Files with Divergent Shapes

**Severity:** HIGH
**Files:** `services/webOrderingApi.ts:92-103` + `services/webOrderApi.ts:60-69`
**Gap ID:** CS-A1 (consumer variant)
**Related:** `09-CROSS-SERVICE-2026/API-CONTRACT-MISMATCHES.md`

**Finding:**
`webOrderingApi.ts` defines `WebOrderStatus` with full shape:
```typescript
// webOrderingApi.ts:92-103
export interface WebOrderStatus {
  orderNumber: string;
  status: 'pending_payment' | 'paid' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  taxes: number;
  total: number;
  tableNumber?: string;
  storeName: string;
  createdAt: string;
}
```

`webOrderApi.ts` uses a different set:
```typescript
// webOrderApi.ts:60-69
const activeStatuses = new Set(['pending', 'confirmed', 'preparing', 'ready']);
```

Missing: `pending_payment` (instead of `pending`), `paid` vs `completed` confusion.

**Impact:** Active order count shows wrong results. Bottom-nav badge may be wrong.

---

### XA-HIGH-04: `response.data.data` Double-Unwrapping Pattern in 30+ Service Files

**Severity:** HIGH
**Files:** tryApi.ts, locationService.ts, mallApi.ts, identityApi.ts, hotelOtaApi.ts, and 25+ more
**Gap ID:** NA-MED-09, CS-A12
**Related:** `09-CROSS-SERVICE-2026/API-CONTRACT-MISMATCHES.md`

**Finding:**
Over 30 service files use double-unwrapping patterns:

```typescript
// services/tryApi.ts:294
return (Array.isArray(payload) ? payload : payload?.data) || [];
// services/tryApi.ts:308
return (payload?.data ?? payload) || null;
// services/locationService.ts:270
return (response.data?.history || []).map((entry: any) => ({
// services/mallApi.ts:286-330
category: response.data?.category || null,
brands: response.data?.brands || [],
```

The `apiClient` already unwraps `response.data`. Double-unwrapping causes:
- `response.data.data` → returns `undefined` when API returns `data: { items: [...] }` (single-wrap)
- `response.data?.data` → returns `undefined` when API returns `data: { items: [...] }` (double-wrap failure)

Different services use different unwrapping patterns. No single convention.

**Impact:** Users see empty lists, zero counts, undefined values for data that exists.

---

### XA-HIGH-05: `localStorage` Used for Sensitive Data in Consumer App

**Severity:** HIGH
**Files:** 21 files
**Gap ID:** NA-HIGH-21 (prior audit)
**Related:** `09-CROSS-SERVICE-2026/SECURITY-ROOT-CAUSE.md`

**Finding:**
21 files write sensitive data to `localStorage`:

```typescript
// contexts/AppContext.tsx:242,272,365
window.localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, serialized);
window.localStorage.setItem(STORAGE_KEYS.FIRST_LAUNCH, 'false');

// stores/appStore.ts:107,137,286
window.localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, serialized);
window.localStorage.setItem(STORAGE_KEYS.FIRST_LAUNCH, 'false');

// stores/homeTabStore.ts:106,166
window.localStorage.setItem(TAB_STORAGE_KEY, tab);

// utils/authStorage.ts:179,226,279
window.localStorage.setItem(STORAGE_KEYS.USER, userString);
window.localStorage.getItem(STORAGE_KEYS.USER);

// services/coinSyncService.ts:421,440,470
localStorage.setItem(this.SYNC_KEY, timestamp);

// app/picks/[id].tsx:199
localStorage.setItem('attribution_pick_id', id);
```

Combined with `AsyncStorage` (21 files), all user data, auth tokens, wallet balance, and preferences stored in plaintext.

**Impact:** XSS attack extracts all user data. Compromised device reveals all credentials and financial data.

---

### XA-HIGH-06: 571 `console.log` in Service Layer Across Consumer App

**Severity:** HIGH
**Files:** 74 service files
**Category:** Data Leak / Observability
**Gap ID:** RC-2 (prior audit)

**Finding:**
571 `console.log`/`console.debug` calls across 74 service files:

Top offenders:
| File | Count |
|------|-------|
| `services/realOffersApi.ts` | 64 |
| `services/mallApi.ts` | 35 |
| `services/storeSearchService.ts` | 31 |
| `services/followApi.ts` | 17 |
| `services/eventsApi.ts` | 20 |
| `services/surveysApi.ts` | 14 |
| `services/pointsApi.ts` | 13 |
| `services/recommendationApi.ts` | 12 |
| `services/articlesApi.ts` | 22 |
| `services/billUploadQueueService.ts` | 12 |

Many of these log sensitive data: API responses, user info, wallet data, auth tokens.

**Impact:** Production logs expose sensitive user and business data. Log aggregation systems (Sentry, Datadog) receive plaintext secrets.

---

### Cross-App MEDIUM Issues

### XA-MED-01: 4 `throw new Error` vs 35 `console.warn` Pattern in Services

**Severity:** MEDIUM
**Files:** 35 service files
**Gap ID:** NA-MED-09

**Finding:**
35 files use `console.warn` for error reporting instead of structured error handling. Only 4 service files use `throw new Error`. The rest silently log warnings:

```typescript
// services/sessionTrackingService.ts: 6 console.warn
// services/billUploadAnalytics.ts: 6 console.warn
// services/notificationService.ts: 13 console.warn
// services/paymentOrchestratorService.ts: 13 console.warn
// services/offlineSyncService.ts: 4 console.warn
// services/gamificationPerformanceMonitor.ts: 1 console.warn
```

**Impact:** Errors surface in console but not in error tracking systems. Debugging production issues requires log access.

---

### XA-MED-02: 27 Files with Hardcoded Business Values

**Severity:** MEDIUM
**Files:** 27 files
**Gap ID:** NA2-MED-02 (prior audit)

**Finding:**
27 files contain hardcoded business-critical values:

```typescript
// data/walletData.ts: 3 hardcoded
// config/checkout.config.ts: 1 hardcoded
// app/EventPage.tsx: 1 hardcoded
// app/games/trivia.tsx: 3 hardcoded
// app/checkout/emi-selection.tsx: 1 hardcoded
// app/prive/tier-progress.tsx: 2 hardcoded
// app/subscription/plans.tsx: 1 hardcoded
// services/achievementApi.ts: 1 hardcoded
// services/analyticsService.ts: 2 hardcoded
```

These include: coin exchange rates, EMI thresholds, subscription tiers, achievement milestones.

**Impact:** Business rules change requires code deployment instead of config changes.

---

### XA-MED-03: Merchant App — 839 `as any` Casts Across 246 Files

**Severity:** MEDIUM
**Files:** 246 files in `rezmerchant/`

**Finding:**
246 files use `as any` to bypass TypeScript. Top offenders:
| File | `as any` count |
|------|---------------|
| `app/products/[id].tsx` | 63 |
| `app/kds/index.tsx` | 32 |
| `app/(dashboard)/products.tsx` | 32 |
| `app/appointments/[id].tsx` | 32 |
| `services/api/socket.ts` | 39 |
| `app/stores/[id]/edit.tsx` | 13 |

**Impact:** Every backend field rename silently breaks reads. Runtime crashes when accessing undefined properties.

---

### XA-MED-04: Admin App — 366 `as any` Casts Across 120 Files

**Severity:** MEDIUM
**Files:** 120 files in `rez-app-admin/`

**Finding:**
120 files use `as any`. Top offender: `app/(dashboard)/settings.tsx` with 50 casts.

**Impact:** Same as above — backend field changes silently corrupt state.

---

### XA-MED-05: Consumer App — `undefined` Access Pattern in 62 Files

**Severity:** MEDIUM
**Files:** 62 files
**Gap ID:** NA2-LOW-11 (prior audit)

**Finding:**
91 occurrences of accessing `.undefined` as a property or `undefined()` as a function call:

```typescript
// components/wallet/TransactionHistory.tsx:2
// app/booking-detail.tsx:1
// app/booking/appointment.tsx:3
// components/RechargeWalletCard.tsx:3
// components/cab/CabInfoCard.tsx:3
// services/paymentValidation.ts:1
// services/walletValidation.ts:2
// services/coinSyncService.ts:2
// services/hotelOtaApi.ts:2
```

**Impact:** Runtime crashes when expected data structures are not present.

---

### Cross-App LOW Issues

### XA-LOW-01: 1,468 TODO Comments Across 250 Consumer App Files

**Severity:** LOW
**Files:** 250 files
**Gap ID:** NA2-MED-01 (prior)

**Finding:**
1,468 TODO comments across the consumer app. These represent incomplete implementations, temporary hacks, or future work that never got scheduled.

**Impact:** Technical debt accumulation. No way to distinguish urgent TODOs from low-priority ones.

---

### XA-LOW-02: 200 `throw new` Pattern in Services

**Severity:** LOW
**Files:** 90 files

**Finding:**
200 raw `throw new Error()` calls in services. No structured error types, no error codes, no translation keys.

**Impact:** Error messages are not user-friendly. No programmatic error categorization.

---

### XA-LOW-03: `CoinType` Inconsistency in Hotel OTA

**Severity:** LOW
**Files:** `services/hotelOtaApi.ts:394-425`

**Finding:**
```typescript
// Sends to backend as:
q.set('coin_type', params.coinType);
// But reads from response as:
const coinType = t.coin_type ?? t.coinType;
// Backend uses snake_case internally
// Frontend sends camelCase
```

**Impact:** Hotel OTA coin earnings may silently fail.

---

## PART C: Extended Deep-Scan Findings (2026-04-17)

Further systematic scan of patterns not covered in Parts A or B.

---

### Cross-App CRITICAL Issues

### XA-CRIT-03: No React ErrorBoundary — Unhandled Errors Crash Entire App

**Severity:** CRITICAL
**Files:** ENTIRE consumer app
**Category:** Error Handling
**Gap ID:** NEW

**Finding:**
Zero files in `rez-app-consumer/` use React `ErrorBoundary`. Any unhandled error in any component crashes the entire app with a blank white screen.

```typescript
// No ErrorBoundary found in the entire codebase:
grep "ErrorBoundary" rez-app-consumer/ → 0 results
```

The `app/_layout.tsx` has no error boundary wrapper. Screens have no individual boundaries. Production users see blank screens on any unexpected error.

**Impact:** Any API response change, null reference, or thrown error in a screen renders the entire app unusable. No recovery mechanism. No fallback UI.

**Fix Direction:** Wrap root layout with ErrorBoundary. Add per-screen boundaries for isolated failures. Report errors to Sentry on capture.

---

### XA-CRIT-04: `/payment/internal/process` — Internal Endpoint Called from Consumer App

**Severity:** CRITICAL
**File:** `services/paymentOrchestratorService.ts:252`
**Category:** Security / Architecture
**Gap ID:** NEW

**Finding:**
```typescript
const response = await apiClient.post<any>('/payment/internal/process', paymentRequest as any);
```

Consumer app calls an `/internal/` endpoint. Internal endpoints are meant to be called by backend-to-backend traffic, not exposed to client apps. This endpoint likely lacks consumer-app authentication checks.

**Impact:** Internal process endpoint is exposed to the public internet. Any user can call it with crafted payloads. Authorization bypass.

**Fix Direction:** Move the logic to a consumer-facing endpoint. Never call `/internal/` routes from the client.

---

### Cross-App HIGH Issues

### XA-HIGH-07: 250 Files with `setInterval/setTimeout` — No Cleanup in Most

**Severity:** HIGH
**Files:** 250 files
**Category:** Memory Leak / Performance
**Gap ID:** NEW

**Finding:**
250 files use `setInterval` or `setTimeout`. Cleanup is found only in:
- `hooks/useMainStorePageData.ts` — partial cleanup
- `hooks/useSupportChat.ts` — partial cleanup
- Test scripts

The vast majority of hooks create timers with no `return () => clearTimeout()` in `useEffect`. Common patterns:

```typescript
// INCOMPLETE — timer never cleared:
useEffect(() => {
  const id = setInterval(fetchData, 30000);
  // Missing: return () => clearInterval(id);
}, []);

// INCOMPLETE — stale closure:
useEffect(() => {
  const timer = setTimeout(() => {
    doSomething(value);  // captures stale 'value' from closure
  }, 500);
}, []);  // 'value' not in deps
```

**Impact:** Timers accumulate on navigation. Polling intervals never stop. Memory grows with each screen visit. On low-end Android devices, app becomes unresponsive after ~5 minutes of navigation.

**Fix Direction:** Audit all `setInterval` calls — add `clearInterval` in useEffect cleanup. Move polling to TanStack Query's `refetchInterval`.

---

### XA-HIGH-08: API Version Fragmentation — 3 Competing Conventions

**Severity:** HIGH
**Files:** hotelOtaApi.ts, razorpayService.ts, homeTabStore.ts, homepageApi.ts
**Category:** API Contracts
**Gap ID:** NEW
**Related:** CS-A4, CS-A12

**Finding:**
Three competing API versioning conventions:

| Convention | File | Example |
|-----------|------|---------|
| `/v1/` prefix | `hotelOtaApi.ts` (16 endpoints) | `/v1/auth/rez-sso`, `/v1/bookings/hold` |
| External SDK `v1` | `razorpayService.ts` | `https://checkout.razorpay.com/v1/checkout.js` |
| `/api/v1/` absolute | `homeTabStore.ts:129` | `/api/v1/user/prive/eligibility` |
| No version | Most services | `/orders`, `/stores`, `/wallet` |

`hotelOtaApi.ts` uses `otaFetch()` which is a raw `fetch()` wrapper — bypassing the `apiClient` 401 interceptor, retry logic, and Sentry reporting for ALL 16 endpoints.

```typescript
// services/hotelOtaApi.ts:181 — raw fetch, bypasses apiClient:
const data = await otaFetch<any>('POST', '/v1/auth/rez-sso', { rez_access_token: rezAccessToken }, false);
```

**Impact:** Hotel OTA calls silently fail on 401 (no token refresh). Version mismatch between internal and external APIs. Absolute URL `/api/v1/` assumes API_BASE_URL is set — may not work in all environments.

**Fix Direction:** Standardize all internal calls through `apiClient`. Remove `otaFetch` wrapper or integrate it with apiClient. Use consistent relative paths.

---

### XA-HIGH-09: `Linking.openURL` Called 14 Times — 4 Explicitly Silently Fail

**Severity:** HIGH
**Files:** shareContentGenerator.ts (8), wishlistSharingApi.ts (7), MainStorePage.tsx, store-visit.tsx
**Category:** UX / Silent Failure
**Gap ID:** NEW

**Finding:**
14 `Linking.openURL` calls across the app:

```typescript
// Explicitly silent failures:
Linking.openURL(`tel:${phone}`).catch(() => {});        // MainStorePage.tsx:111
Linking.openURL(url).catch(() => {});                   // store-visit.tsx:751

// Unhandled rejections:
await Linking.openURL(url);                            // shareContentGenerator.ts:77,97,117,122...
await Linking.openURL(url);                            // wishlistSharingApi.ts:385,406,411...

// Google Maps URL without encodeURIComponent:
Linking.openURL(`https://maps.google.com/?q=${event.fullAddress}`);  // SocialImpactEventDetail.tsx:270
```

Deep link failures (no Twitter/Instagram app, mail client unavailable, phone app restricted) produce no user feedback. Google Maps URL without `encodeURIComponent` breaks on addresses with spaces, `&`, `#`.

**Impact:** Users tap "Call store" or "Open Maps" and nothing happens — no feedback. Share fails silently when social apps unavailable.

---

### XA-HIGH-10: Admin-Only Endpoints Imported in Consumer App

**Severity:** HIGH
**Files:** `services/walletApi.ts:634,742,797`
**Category:** Security / Architecture
**Gap ID:** NEW

**Finding:**
```typescript
// services/walletApi.ts — comments acknowledge these should NOT be here:
async adjustBalance(...): Promise<ApiResponse<...>> {
  // These are admin-only endpoints - consumer app should not call them directly
async reverseCashback(...): Promise<ApiResponse<...>> {
  // These are admin-only endpoints - consumer app should not call them directly
async freezeWallet(...): Promise<ApiResponse<...>> {
  // These are admin-only endpoints - consumer app should not call them directly
```

Consumer app imports admin-only wallet mutation methods. If these endpoints lack server-side authorization, any consumer can adjust balances, reverse cashback, and freeze wallets.

**Impact:** Privilege escalation if backend doesn't enforce admin-only authorization on these routes.

---

### Cross-App MEDIUM Issues

### XA-MED-06: Pagination Strategy Fragmentation — 4 Different Conventions

**Severity:** MEDIUM
**Files:** 15+ service files
**Category:** API Contracts
**Gap ID:** NEW

**Finding:**
Four competing pagination conventions:

| Convention | Files | Example |
|-----------|-------|---------|
| `{page, limit}` | `ordersApi.ts:217`, `supportChatApi.ts`, `goldSavingsApi.ts` | `/orders?page=1&limit=20` |
| `{cursor}` | `ordersApi.ts:217` (same file!) | `cursor?: string` |
| `{offset, limit}` | `reelApi.ts`, `productGalleryApi.ts`, `healthRecordsApi.ts`, `tournamentApi.ts` | `offset: number` |
| URL interpolation | `hotelOtaApi.ts:382`, `reviewApi.ts:137`, `videosApi.ts` | `page=${page}&limit=${limit}` |

Same `ordersApi.ts` supports BOTH `{cursor}` AND `{page, limit}`. `realProjectsApi.ts` defines the same `pagination` type 4 times. `serviceCategoriesApi.ts:233` hardcodes fallback pagination.

**Impact:** No consistent cursor/offset strategy. Backend may return different shapes for the same endpoint. Load-more buttons may fail silently on the second page.

---

### XA-MED-07: 22 Default Exports in Services — Barrel Export Inconsistency

**Severity:** MEDIUM
**Files:** 22 service files
**Category:** Architecture
**Gap ID:** NEW

**Finding:**
22 services use `export default` mixed with named exports in the same codebase:

```typescript
// Default exports in services:
export default reelApi;                    // services/reelApi.ts
export default storeSearchService;        // services/storeSearchService.ts
export default couponService;             // services/couponApi.ts
export default analytics;                 // services/analytics/AnalyticsService.ts
export default new SocialImpactApi();     // services/socialImpactApi.ts (singleton!)

// Named exports:
export const queryKeys = { ... };        // lib/queryKeys.ts
export const getStatusColor = ...;        // data/walletData.ts
export class PaymentValidator { ... }      // services/paymentValidation.ts
```

`socialImpactApi.ts` exports `export default new SocialImpactApi()` — a singleton instance at module level. This prevents mocking in tests and prevents garbage collection.

**Impact:** Inconsistent import patterns. Harder to tree-shake. Singleton instances can't be replaced for testing.

---

### XA-MED-08: Environment Config Defaults to Fake Values in Production

**Severity:** MEDIUM
**Files:** `config/monitoring.config.ts`, `config/cloudinary.config.ts`, `config/env.ts`
**Category:** Data / Configuration
**Gap ID:** NEW

**Finding:**
```typescript
// config/monitoring.config.ts:
trackingId: process.env.EXPO_PUBLIC_GA_TRACKING_ID || 'UA-XXXXX-Y',  // fake placeholder
sampleRate: __DEV__ ? 0 : 0.1,  // 10% in production

// config/cloudinary.config.ts:
cloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'your-cloud-name',
ugcVideos: process.env.EXPO_PUBLIC_CLOUDINARY_UGC_PRESET || 'ugc_videos',

// scripts/test-leaderboard-realtime.ts:
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5001/api';
```

In production, if env vars are missing, the app falls back to placeholder values (`UA-XXXXX-Y`, `your-cloud-name`, `localhost:5001`). No build-time validation. Analytics goes to a fake UA ID. Cloudinary uploads to a wrong account.

**Impact:** Production deployments with missing env vars silently route analytics to wrong accounts and uploads to wrong buckets.

---

### Cross-App LOW Issues

### XA-LOW-04: `asyncStorageService` Singleton with 29 Direct AsyncStorage Imports

**Severity:** LOW
**Files:** 29 service files import `AsyncStorage` directly + `asyncStorageService.ts` wrapper
**Category:** Architecture
**Gap ID:** NEW

**Finding:**
29 files import `@react-native-async-storage/async-storage` directly:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';  // 29 files
import asyncStorageService from './asyncStorageService';                // wrapper used by cacheService.ts
```

Two patterns coexist: direct `AsyncStorage` calls and `asyncStorageService` wrapper. If storage keys need to change, 29 files must be updated individually.

---

### XA-LOW-05: Google Maps URL Missing `encodeURIComponent`

**Severity:** LOW
**File:** `app/playandearn/SocialImpactEventDetail.tsx:270`
**Category:** Data / UX
**Gap ID:** NEW

**Finding:**
```typescript
Linking.openURL(`https://maps.google.com/?q=${event.fullAddress}`);
```

Address strings with `&`, `#`, `+`, or spaces generate invalid URLs. Results in broken "Open in Maps" functionality.

---

### XA-LOW-06: `walletApi.ts` Singleton with 29 Direct AsyncStorage Imports

**Severity:** LOW
**Files:** `services/walletApi.ts`
**Category:** Architecture
**Gap ID:** NEW

**Finding:**
`walletApi.ts` (1021 lines) is the largest service file by a significant margin. It's a singleton class that maintains in-memory state (`balance`, `breakdown`, `transactions`) with no clear invalidation strategy. All reads go to this single instance.

**Impact:** State drift between wallet context and direct API calls. No coordination between multiple wallet readers.

---

## Cross-Reference: Issues Already in Prior Audit

These issues were found during this scan but are already documented in earlier files:

| ID | Title | Filed In |
|----|-------|---------|
| NA-LOW-08 | `isTokenValid()` dead code | `04-LOW.md` |
| NA-LOW-02 | Bare `console.log` despite fitness test | `04-LOW.md` |
| NA-LOW-01 | `import * as Clipboard` scattered | `04-LOW.md` |
| NA-HIGH-21 | Auth tokens in localStorage | `02-HIGH.md` |
| NA-HIGH-14 | 56 `any` types across stores | `02-HIGH.md` |

---

## Status Table

| ID | Status | Fix Priority | Est Fix |
|----|--------|-------------|---------|
| NA2-CRIT-01 | ACTIVE | P0 | 2h |
| NA2-HIGH-01 | ACTIVE | P1 | 3h |
| NA2-HIGH-02 | ACTIVE | P1 | 1h |
| NA2-HIGH-03 | ACTIVE | P1 | 4h |
| NA2-HIGH-04 | ACTIVE | P1 | 3h |
| NA2-MED-01 | ACTIVE | P2 | 3h |
| NA2-MED-02 | ACTIVE | P2 | 30m |
| NA2-MED-03 | ACTIVE | P2 | 1h |
| NA2-MED-04 | ACTIVE | P2 | 4h |
| NA2-MED-05 | ACTIVE | P2 | 1h |
| NA2-MED-06 | ACTIVE | P2 | 30m |
| NA2-MED-07 | ACTIVE | P2 | 1h |
| NA2-MED-08 | ACTIVE | P2 | 15m |
| NA2-LOW-01 | ACTIVE | P3 | 30m |
| NA2-LOW-02 | ACTIVE | P3 | 1h |
| NA2-LOW-03 | ACTIVE | P3 | 30m |
| NA2-LOW-04 | ACTIVE | P3 | 1h |
| NA2-LOW-05 | ACTIVE | P3 | 30m |
| NA2-LOW-06 | ACTIVE | P3 | 30m |
| NA2-LOW-07 | ACTIVE | P3 | 1h |
| NA2-LOW-08 | **FIXED** | — | 2026-04-17 |
| NA2-LOW-09 | ACTIVE | P3 | 1h |
| NA2-LOW-10 | ACTIVE | P3 | 1h |
| NA2-LOW-11 | ACTIVE | P3 | 30m |
| NA2-LOW-12 | ACTIVE | P3 | 1h |
| XA-CRIT-01 | ACTIVE | P0 | 2h |
| XA-CRIT-02 | ACTIVE | P0 | 8h |
| XA-HIGH-01 | ACTIVE | P1 | 6h |
| XA-HIGH-02 | ACTIVE | P1 | 4h |
| XA-HIGH-03 | ACTIVE | P1 | 2h |
| XA-HIGH-04 | ACTIVE | P1 | 4h |
| XA-HIGH-05 | ACTIVE | P1 | 6h |
| XA-HIGH-06 | ACTIVE | P2 | 2h |
| XA-MED-01 | ACTIVE | P2 | 2h |
| XA-MED-02 | ACTIVE | P2 | 3h |
| XA-MED-03 | ACTIVE | P2 | 8h |
| XA-MED-04 | ACTIVE | P2 | 4h |
| XA-MED-05 | ACTIVE | P2 | 3h |
| XA-LOW-01 | ACTIVE | P3 | — |
| XA-LOW-02 | ACTIVE | P3 | — |
| XA-LOW-03 | ACTIVE | P3 | 1h |
| XA-CRIT-03 | ACTIVE | P0 | 2h |
| XA-CRIT-04 | ACTIVE | P0 | 1h |
| XA-HIGH-07 | ACTIVE | P1 | 8h |
| XA-HIGH-08 | ACTIVE | P1 | 4h |
| XA-HIGH-09 | ACTIVE | P1 | 2h |
| XA-HIGH-10 | ACTIVE | P1 | 2h |
| XA-MED-06 | ACTIVE | P2 | 3h |
| XA-MED-07 | ACTIVE | P2 | 2h |
| XA-MED-08 | ACTIVE | P2 | 1h |
| XA-LOW-04 | ACTIVE | P3 | 1h |
| XA-LOW-05 | ACTIVE | P3 | 15m |
| XA-LOW-06 | ACTIVE | P3 | — |

---

## PART D: Gen 11 Consumer App — Additional Deep-Scan Findings (2026-04-16)

### N-01: Missing `types/homepage.types.ts` — 19 Import Failures, Build Blocker

**Severity:** CRITICAL
**Gap ID:** N-01
**Files:** Multiple consumer app source files importing from `types/homepage.types`
**Category:** Build Failure / Type Safety
**Status:** ACTIVE
**Est Fix:** 1 hour

**Description:**
`types/homepage.types.ts` is imported by 19 files across the consumer app (`components/homepage/`, `screens/home/`, `services/homepage*.ts`) but the file **does not exist**. Any import from this path causes a TypeScript build error: `Cannot find module 'types/homepage.types'`.

This is a build-blocking issue. `npm run build` or `npx tsc` will fail on any file that imports from this non-existent module.

**Impact:** Build failures prevent deployment. Every new clone of the repo fails to compile.

**Fix:** Create `types/homepage.types.ts` with the types expected by the importing files, or remove the import and inline the types.

---

### N-02: `BackendCoinBalance` 6-Value Type Used Where `CoinType` 4-Value Is Expected

**Severity:** HIGH
**Gap ID:** N-02
**File:** `types/wallet.types.ts`, `services/walletService.ts`, `stores/walletStore.ts`
**Category:** Type Mismatch / API Contract
**Status:** ACTIVE
**Est Fix:** 2 hours

**Description:**
`BackendCoinBalance` has 6 values (including `cashback` and `referral`):
```typescript
type BackendCoinBalance = 'wasil_coins' | 'wasil_bonus' | 'cashback' | 'referral' | 'earning' | 'promotional';
```

`CoinType` (canonical) has 4 values:
```typescript
type CoinType = 'wasil_coins' | 'wasil_bonus' | 'earning' | 'promotional';
```

Code that expects `CoinType` receives `BackendCoinBalance` — `cashback` and `referral` are valid in the backend type but invalid in the frontend canonical type. These coin types exist in the wallet/ledger but are invisible to frontend type system.

**Impact:** TypeScript type narrowing on `CoinType` can exclude valid values. Runtime errors when backend returns `cashback`/`referral` coin types.

**Fix:** Either expand `CoinType` to include `cashback` and `referral`, or map `BackendCoinBalance` → `CoinType` with explicit fallbacks at the service layer boundary.

---

### N-03: `AddressType` Uses Uppercase Keys; Backend API Expects Lowercase

**Severity:** HIGH
**Gap ID:** N-03
**File:** `types/profile.types.ts`, `screens/profile/AddressScreen.tsx`
**Category:** API Contract / Data Sync
**Status:** ACTIVE
**Est Fix:** 1 hour

**Description:**
Frontend `AddressType` uses uppercase enum values:
```typescript
type AddressType = 'HOME' | 'WORK' | 'OTHER';
```

Backend order API expects lowercase:
```typescript
// backend expects: 'home' | 'work' | 'other'
```

The address type is sent to the backend as `'HOME'` but the backend interprets it as invalid. Addresses saved as `'HOME'` won't match backend queries for `'home'`.

**Impact:** Address type filtering breaks on the backend. User's saved address types are invisible to the order history query.

**Fix:** Normalize `AddressType` to lowercase before sending to backend, or update the frontend enum to use lowercase values.

---

### N-04: `wasilCoins` Legacy Field Not in `CoinType` Canonical

**Severity:** MEDIUM
**Gap ID:** N-04
**File:** `stores/walletStore.ts`, `services/walletService.ts`
**Category:** Type Drift / Data Sync
**Status:** ACTIVE
**Est Fix:** 30 minutes

**Description:**
`wasilCoins` is used as a field name in wallet store state and service calls. It represents the user's Wasil coin balance. However, this field name is not referenced in the `CoinType` canonical type definition, and `CoinType` doesn't include `wasil` as a value.

This creates a naming mismatch: `CoinType` uses `'wasil_coins'` but the store uses `wasilCoins`. The conversion between these two naming conventions happens implicitly, creating a silent mismatch if one is updated without the other.

**Impact:** Silent data mapping errors. If the API returns `wasil_coins` but the store expects `wasilCoins`, the balance displays as undefined.

**Fix:** Standardize on one naming convention across all wallet-related types and service boundaries.

---

### N-05: `PaymentStatus` Terminal State Mismatch — `completed` vs `paid` vs `partial`

**Severity:** MEDIUM
**Gap ID:** N-05
**File:** `types/payment.types.ts`, `services/paymentService.ts`, `screens/payment/PaymentScreen.tsx`
**Category:** Enum Mismatch / FSM
**Status:** ACTIVE
**Est Fix:** 1 hour

**Description:**
Three incompatible `PaymentStatus` definitions across the consumer app:
- Zod schema: `'completed'`
- Order type: `'paid'`
- ServiceBooking type: `'partial'`

The canonical `PaymentStatus` enum is unclear — different layers use different terminal state names. Order payment completion can be `completed`, `paid`, or `partial` depending on which type is in scope.

**Impact:** Status filtering breaks across layers. A payment marked `completed` in the Zod validation is invisible to code checking for `paid`.

**Fix:** Define a single canonical `PaymentStatus` type and use it consistently across all consumer app layers.

---

### N-06: `validateBatchResponse` Called on Wrong Variable — Dead Code Path

**Severity:** LOW
**Gap ID:** N-06
**File:** `services/api/homepageApi.ts`
**Category:** Logic Error
**Status:** ACTIVE
**Est Fix:** 15 minutes

**Description:**
`validateBatchResponse` is a utility function that validates a batch API response. It is called in `homepageApi.ts` but the return value is assigned to a variable that is immediately overwritten by another assignment, making the validation call dead code:

```typescript
const validated = validateBatchResponse(rawData);
// ... 
const data = rawData; // immediately overwrites validated
```

The `validated` variable is computed but never used. The `validateBatchResponse` function has no effect on the actual data flow.

**Impact:** No functional impact — the validation is bypassed. However, if `validateBatchResponse` had side effects (e.g., logging, metric emission), those side effects also never fire.

**Fix:** Either remove the dead call or use the validated result:
```typescript
const data = validateBatchResponse(rawData) ?? rawData;
```

---

### N-07: `activityFeedApi.ts` Double `/api` Prefix on Endpoint Path

**Severity:** LOW
**Gap ID:** N-07
**File:** `services/api/activityFeedApi.ts`
**Category:** API Contract / Path Construction
**Status:** ACTIVE
**Est Fix:** 10 minutes

**Description:**
`activityFeedApi.ts` constructs an endpoint path with a double `/api` prefix:
```typescript
const endpoint = `${API_BASE_URL}/api/activity/feed`;
// API_BASE_URL already contains '/api' from config
// Result: https://api.rez.in/api/api/activity/feed
```

`API_BASE_URL` already includes `/api` from the environment configuration. The code appends another `/api`, resulting in a double-prefixed URL that the backend doesn't recognize.

**Impact:** Activity feed API calls fail with 404. Users see empty activity feed with no indication of the path error.

**Fix:** Remove the extra `/api`:
```typescript
const endpoint = `${API_BASE_URL}/activity/feed`;
```

---

## Status Summary — Part D

| ID | Severity | Status | Est Fix |
|----|----------|--------|---------|
| N-01 | CRITICAL | ACTIVE | 1h |
| N-02 | HIGH | ACTIVE | 2h |
| N-03 | HIGH | ACTIVE | 1h |
| N-04 | MEDIUM | ACTIVE | 30m |
| N-05 | MEDIUM | ACTIVE | 1h |
| N-06 | LOW | ACTIVE | 15m |
| N-07 | LOW | ACTIVE | 10m |
