# LOW SEVERITY — MASTER CONSOLIDATION

**Generated:** 2026-04-16
**Total Issues:** ~244 LOW severity issues across 9 source audits
**Status:** All ACTIVE / OPEN — backlog items

---

## Source Breakdown

| Source | Count | Items |
|--------|-------|-------|
| Consumer App 2026 | 12 | NA-LOW-01 — NA-LOW-12 |
| ReZ NoW | 44 | NW-LOW-001 — NW-LOW-044 |
| RestoPapa Gen 14 | 17 | RP-L01 — RP-L17 |
| Merchant App | 102 | G-MA-L01 — G-MA-L102 |
| ReZ Admin (Gen 10) | 8 | A10-L1 — A10-L8 |
| Karma UI | 3 | G-KU-L1 — G-KU-L3 |
| Rendez Backend | 8 | RZ-B-L1 — RZ-B-L8 |
| Rendez App | 13 | RZ-M-L1 — RZ-M-L13 |
| Rendez Admin | 14 | RZ-A-L1 — RZ-A-L14 |

---

## Category 1: Code Quality & Architecture (~75 issues)

### Consumer App — Code Quality

**NA-LOW-01: `import * as Clipboard` Scattered 18+ Times**
- **File:** `app/flash-sale-success.tsx`, `app/deal-success.tsx`, +16 more
- **Fix:** Create `<CopyButton>` or `<CopyableText>` component encapsulating clipboard logic.

**NA-LOW-02: Bare `console.log/warn/error` Throughout Codebase**
- **File:** `app/_layout.tsx`, `app/brands.tsx`, `app/search.tsx`, +many more
- **Fix:** Run `scripts/arch-fitness/no-console-log.sh` on every PR. Replace with `@/utils/logger`.

**NA-LOW-03: Two Incompatible Image Cache Implementations Coexist**
- **Files:** `services/imageCacheManager.ts`, `services/imageCacheService.ts`
- **Fix:** Choose one canonical implementation. Remove `imageCacheManager`.

**NA-LOW-06: Luhn Algorithm Implemented Twice, Differently**
- **Files:** `services/paymentService.ts:331`, `services/paymentValidation.ts:55`
- **Fix:** Delete `paymentService.ts`'s Luhn. Call `PaymentValidator.validateCardNumber()` instead.

**NA-LOW-07: Duplicate Currency Formatting Logic**
- **Files:** `stores/regionStore.ts:362`, `rez-shared/src/utils/currency.ts`
- **Fix:** Deprecate `regionStore.formatPrice`. Use canonical `rez-shared` everywhere.

**NA-LOW-08: `isTokenValid()` Always Returns False — Dead Code**
- **File:** `services/authTokenService.ts`
- **Fix:** Implement by decoding JWT `exp` claim, or remove entirely.

**NA-LOW-11: Duplicate Currency Formatting — Two Different Outputs**
- **Files:** `stores/regionStore.ts`, `rez-shared/src/utils/currency.ts`
- **Fix:** Standardize on one formatter across the codebase.

---

### ReZ NoW — Architecture

**NW-LOW-003: DeliveryAddress Type Defined Twice in Different Files**
- **Files:** `lib/types/index.ts` and `lib/api/delivery.ts`
- **Fix:** Define once in `lib/types/index.ts` and import everywhere.

**NW-LOW-004: Wallet and Orders Pages Duplicate Same Auth Cookie Check**
- **Files:** `app/wallet/page.tsx` and `app/orders/page.tsx`
- **Fix:** Extract to a shared `checkAuth()` utility.

**NW-LOW-010: OrderHistoryClient Calls Undefined `STATUS_COLOUR`**
- **File:** `app/orders/OrderHistoryClient.tsx`
- **Fix:** Verify correct export name from `lib/types/index.ts` (likely `STATUS_COLORS`).

**NW-LOW-011: Duplicate CouponInput Components in Cart and Checkout**
- **Files:** `components/cart/CouponInput.tsx` and `components/checkout/CouponInput.tsx`
- **Fix:** Consolidate to one shared component.

**NW-LOW-029: Reservation Date Field Naming Inconsistency Across API Layers**
- **Files:** `lib/api/reservations.ts`, `lib/api/catalog.ts`, `lib/api/store.ts`
- **Fix:** Standardize to `date` as ISO date string. Document in shared-types.

**NW-LOW-030: `getStoreCoupons` and `getAvailableCoupons` Duplicate Same API Call**
- **Files:** `lib/api/coupons.ts`, `lib/api/cart.ts`
- **Fix:** Remove one function. Use single canonical `Coupon` interface.

**NW-LOW-031: `getWalletTransactions` Returns Untyped Transactions Array**
- **File:** `lib/api/wallet.ts:10-19`
- **Fix:** Add `as WalletTransaction[]` or define `WalletTransactionResponse` interface.

**NW-LOW-033: exportReconciliationCSV Uses Raw Fetch Instead of Axios Client**
- **File:** `lib/api/reconcile.ts:58-85`
- **Fix:** Use Axios `authClient` to download CSV blob.

**NW-LOW-034: AI Chat Response Type `ChatResponse` Doesn't Match `AIMessage`**
- **File:** `lib/api/chat.ts`
- **Fix:** Unify to single `ChatMessage` interface for both functions.

**NW-LOW-035: Auth Refresh Queue Silently Drops Requests on Refresh Failure**
- **File:** `lib/api/client.ts:137-154`
- **Fix:** In catch block, iterate through `refreshQueue` and reject each pending promise.

**NW-LOW-038: `billStore.ts` `localId()` Uses `Date.now()` — Collision Possible**
- **File:** `lib/store/billStore.ts:31-33`
- **Fix:** Use `crypto.randomUUID()` instead of `Date.now() + idCounter`.

**NW-LOW-041: `lib/api/search.ts` Uses Raw `fetch` Instead of `deduplicatedGet`**
- **File:** `lib/api/search.ts:48-56, 63-72`
- **Fix:** Replace with `deduplicatedGet` from `lib/api/client.ts`.

**NW-LOW-043: `formatTime` Crashes on Malformed Time Strings**
- **File:** `components/store/StoreFooter.tsx:23-31`
- **Fix:** Guard with `if (!time || !time.includes(':')) return '—'`.

**NW-LOW-044: KitchenChatDrawer Optimistic ID Uses `Date.now()` — Collisions on Fast Double-Tap**
- **File:** `components/table/KitchenChatDrawer.tsx:92`
- **Fix:** Add local incrementing counter: `'optimistic-${Date.now()}-${++idCounter}'`.

---

### RestoPapa — Architecture

**RP-L04: Multiple `normalizeOrderStatus` Implementations**
- **Issue:** Three competing implementations across codebase with different behavior.
- **Fix:** 1h — Merge to single shared implementation in `@rez/shared`.

**RP-L05: Batch Stats Route Uses Raw MongoDB Aggregation**
- **File:** `rez-karma-service/src/routes/batchRoutes.ts`
- **Fix:** Move aggregation to service layer.

**RP-L06: Duplicate Package in Two Paths**
- **Files:** `/rez-shared/src/` + `/packages/rez-shared/src/`
- **Fix:** 2h — Consolidate to one package. Migrate all consumers.

**RP-L07: startOfWeek IST Offset Not Applied in Weekly Cap Decay**
- **File:** `rez-karma-service/src/services/karmaService.ts`
- **Fix:** Apply IST offset consistently across all date computations.

**RP-L08: Karma Conversion Rate Hardcoded Instead of Engine Call**
- **File:** `rez-karma-service/src/routes/karmaRoutes.ts`
- **Fix:** Call `getConversionRate()` from engine instead of inline values.

**RP-L10: Duplicate `startOfWeek` Computation**
- **File:** `rez-karma-service/src/services/karmaService.ts:128 and 195`
- **Fix:** Compute once at top of function.

---

### Merchant App — Architecture

**G-MA-L37: ProductFilters Duplicate Definition in Same File**
- **File:** `types/api.ts:453, 503`
- **Fix:** Remove duplicate. Use single definition.

**G-MA-L39: Socket `pingInterval` Typed as `any`**
- **File:** `services/api/socket.ts:29`
- **Fix:** `ReturnType<typeof setInterval> | null`.

**G-MA-L47: StoreContext Redundant `loadStores` on Auth State Changes**
- **File:** `contexts/StoreContext.tsx:337-347`
- **Fix:** Remove redundant call from useEffect dependency array.

**G-MA-L52: Duplicate Metric Keys Trend vs Change**
- **File:** `services/api/dashboard.ts:31`
- **Fix:** Remove semantic duplicate. Use single field.

**G-MA-L57: getPendingOrdersCount Redundant Pagination Fallback**
- **File:** `services/api/orders.ts:410-413`
- **Fix:** Remove unnecessary `(result as any).pagination?.total` fallback.

**G-MA-L59: validatePaymentStatus Wrong Whitelist — Dead Code**
- **File:** `utils/paymentValidation.ts:79-86`
- **Fix:** Remove dead code to avoid misdirection.

**G-MA-L60: Duplicate `ROLE_DESCRIPTIONS`**
- **Files:** `constants/roles.ts:69-79`, `services/api/team.ts:99-106`
- **Fix:** Define once in `constants/roles.ts`.

**G-MA-L63: PaymentStatus Defined in 3 Separate Files**
- **Files:** `types/api.ts:174`, `services/api/services.ts:92`, `utils/paymentValidation.ts:34`
- **Fix:** Single canonical in `types/api.ts`. Remove others.

**G-MA-L64: OrderStatus Defined 3x with Different Values**
- **Files:** `types/api.ts:160`, `app/orders/live.tsx:34`, `app/(dashboard)/aggregator-orders.tsx:35`, `__tests__/integration/orderFlow.test.ts:6`
- **Fix:** Single canonical. Aggregator-specific statuses as separate type.

**G-MA-L67: PaymentStatusResponse Interface Has 4 Values vs PaymentStatus Has 6**
- **File:** `services/api/pos.ts:85-88`
- **Fix:** Align with canonical `PaymentStatus` type.

**G-MA-L69: JSON.parse on API Response Without Try/Catch**
- **File:** `app/reports/export.tsx:234`
- **Fix:** Wrap `JSON.parse(body)` in try/catch.

**G-MA-L70: storeReview JSON.parse Empty Catch**
- **File:** `utils/storeReview.ts:17-19`
- **Fix:** Log error and return default state instead of empty catch.

**G-MA-L75: RBAC Example Has Duplicate Order/Payment Interfaces**
- **File:** `RBAC_INTEGRATION_EXAMPLES.tsx:114, 476, 553, 570`
- **Fix:** Use canonical types from `types/api.ts` in examples.

**G-MA-L78: useTeam Error Typing Uses `error: any`**
- **File:** `hooks/useTeam.ts:139, 164, 188`
- **Fix:** Change to `error: unknown` with narrowing.

**G-MA-L81: App.tsx Uses `require.context` with `as any`**
- **File:** `App.tsx:5`
- **Fix:** Add type declaration for Webpack's `require.context`.

**G-MA-L84: getOfflineActions Masks Parse Errors — Silently Returns Empty**
- **File:** `services/offline.ts:161-163`
- **Fix:** Log error before returning `[]`.

**G-MA-L86: Two Empty Catch Blocks in storeReview.ts**
- **File:** `utils/storeReview.ts:17-19, 25-26`
- **Fix:** Add error handling to both catches.

**G-MA-L87: orders.ts Unsafe `any` Cast for Pagination Total**
- **File:** `services/api/orders.ts:412`
- **Fix:** Use typed response interface instead of `as any`.

**G-MA-L88: settlements.ts NaN Risk on Zero-Page Division**
- **File:** `services/api/settlements.ts:99`
- **Fix:** Return `1` as minimum instead of `0`.

**G-MA-L93: sessionTimeout Callback Invoked Without Null Check**
- **File:** `services/sessionTimeout.ts:83`
- **Note:** Already properly guarded — no fix needed.

---

### ReZ Admin — Architecture

**A10-L7: useRefreshOnFocus Hook Has Anti-Pattern (Unused)**
- **File:** `hooks/useRefreshOnFocus.ts:4-9`
- **Fix:** Remove dead code or fix missing dependency array.

**RZ-A-L1: No TypeScript Types Directory**
- **File:** No `src/types/` directory
- **Fix:** Create `src/types/` with shared interfaces.

**RZ-A-L3: No Shared API Client**
- **File:** All pages
- **Fix:** Create shared `lib/api/client.ts`.

---

### Rendez Backend — Architecture

**RZ-B-L1: `likeLimiter` Uses `req: any` Instead of Typed Request**
- **File:** `src/middleware/rateLimiter.ts:54`

**RZ-B-L2: Redis URL Used Directly Without Pool Settings**
- **File:** `src/config/redis.ts:4-7`

**RZ-B-L5: Duplicate FraudService Instantiation**
- **Files:** `GiftService.ts`, `MeetupService.ts`, `RewardService.ts`

**RZ-B-L6: Duplicate Queue Definitions**
- **Files:** `src/jobs/queue.ts` vs `src/workers/giftExpiryWorker.ts`

**RZ-B-L8: AppError Message Convention Confused with Error Codes**
- **File:** `src/middleware/errorHandler.ts:4-7`
- **Finding:** Trailing comma in `throw new AppError(403, 'MSG_LOCKED', )`.

---

## Category 2: Display & UI (~30 issues)

### Merchant App — Display & UI

**G-MA-L01: No Skeleton Loading on App Init**
- **File:** `app/index.tsx:31-38`
- **Fix:** Replace with branded splash screen or skeleton for first visible screen.

**G-MA-L04: KDS Duplicate Room Joins on Rapid Reconnect**
- **File:** `app/kds/index.tsx:897-904`
- **Fix:** Add deduplication check before `join-store` emission.

**G-MA-L05: Disabled Outline Button Loses Transparent Background**
- **File:** `components/ui/PrimaryButton.tsx:140`

**G-MA-L06: ErrorFallback Uses Hardcoded Emoji Icon**
- **File:** `components/common/ErrorFallback.tsx:144`
- **Fix:** Use theme-aware icon component.

**G-MA-L07: Confirm Account Number — No Real-Time Match Indicator**
- **File:** `components/onboarding/BankDetailsForm.tsx:173-187`
- **Fix:** Add real-time green checkmark/red indicator.

**G-MA-L08: Fee Breakdown — Large Percentages from Small Denominators**
- **File:** `app/(dashboard)/wallet.tsx:708-711, 757-762`
- **Fix:** Improve proportional bar visualization.

**G-MA-L09: Product Price Display — `as any` Casts**
- **File:** `app/(dashboard)/products.tsx:315`
- **Fix:** Use typed interface instead of `as any`.

**G-MA-L11: Web Notification Banner — Dark Mode Contrast**
- **File:** `app/(dashboard)/orders.tsx:1802`
- **Fix:** Improve contrast for dark mode accessibility.

**G-MA-L12: Quick Bill Color Scheme Hardcoded**
- **File:** `app/pos/quick-bill.tsx`
- **Fix:** Use theme-aware colors.

**G-MA-L29: Dashboard Revenue Bar — Flex Layout Misleading**
- **File:** `app/(dashboard)/wallet.tsx:1157-1174`

**G-MA-L33: Account Number Field `secureTextEntry`**
- **File:** `components/onboarding/BankDetailsForm.tsx:169`
- **Fix:** Show last 4 digits only, not full mask.

**G-MA-L35: Dashboard Revenue Bar Flex Width Misleading**
- **File:** `app/(dashboard)/wallet.tsx:1157-1174`

---

### ReZ NoW — Display & UI

**NW-LOW-002: PromoBanner Applies Arbitrary bgColor Strings as Inline Styles**
- **File:** `components/menu/PromoBanner.tsx:20-36`
- **Fix:** Validate `bgColor` against a whitelist of allowed Tailwind classes.

**NW-LOW-006: TIER_CONFIG Has No Fallback for Unknown Tier Strings**
- **File:** `app/wallet/WalletClient.tsx:75`
- **Fix:** Add a default case for unknown tiers.

**NW-LOW-008: formatINRCompact Renders ₹5,000 as ₹5.0k — Inconsistent Decimals**
- **File:** `lib/utils/currency.ts:11-18`
- **Fix:** Strip trailing zeros: `.replace(/\.0k$/, 'k')`.

**NW-LOW-009: redeemStamps Response Validation Missing**
- **File:** `lib/api/loyalty.ts:30-39`
- **Fix:** Add `if (!data.success || !data.rewardCode) throw new Error(...)`.

**NW-LOW-019: Chat AI metadata.items Cast with `as OrderItem[]` — No Type Guard**
- **File:** `components/chat/ChatMessage.tsx:44-47`
- **Fix:** Use a type guard instead of `as` casting.

**NW-LOW-020: useTrack Imported but Error Return Value Ignored**
- **File:** `components/menu/MenuItem.tsx:11`
- **Fix:** Handle the error case from `useTrack`.

**NW-LOW-021: cancelOrder Refund Field Access Without Optional Chaining**
- **File:** `lib/api/cancellation.ts:12`
- **Fix:** Use `data.data?.refundInitiated ?? false`.

**NW-LOW-022: Coin Credit Hook Has `coinsDone` in Dependency Array — Hooks Violation**
- **File:** `app/[storeSlug]/pay/confirm/[paymentId]/page.tsx:61-73`
- **Fix:** Use a `useRef` for the "already credited" guard.

**NW-LOW-023: GoogleReviews RelativeTime Has Off-by-One in Week Calculation**
- **File:** `components/store/GoogleReviews.tsx:94-103`
- **Fix:** Fix conditional ordering — check years before months.

**NW-LOW-032: share.ts Hardcodes BASE_URL Instead of Environment Variable**
- **File:** `lib/utils/share.ts:3`
- **Fix:** Use `process.env.NEXT_PUBLIC_BASE_URL`.

**NW-LOW-037: BillBuilderClient Uses `window.location.origin` at Runtime**
- **File:** `app/[storeSlug]/merchant/bill-builder/BillBuilderClient.tsx:385`
- **Fix:** Use `process.env.NEXT_PUBLIC_APP_URL` instead.

**NW-LOW-042: PayDisplayClient Dedup Closure Uses Stale `payments` State**
- **File:** `app/[storeSlug]/merchant/pay-display/PayDisplayClient.tsx:125-131`
- **Fix:** Use `useRef` for dedup tracking instead of state.

---

### Rendez App — Display & UI

**RZ-M-L1: No Loading Skeleton for ProfileDetailScreen**
- **File:** `src/app/ProfileDetailScreen.tsx:158-164`
- **Fix:** Add shimmer/skeleton effect.

**RZ-M-L2: Meetup Camera Has No Graceful Fallback**
- **File:** `src/app/MeetupScreen.tsx:118-127`
- **Fix:** Add manual code entry option after camera permission denial.

**RZ-M-L4: Privacy/Terms Links via Alert Instead of In-App Browser**
- **File:** `src/app/SettingsScreen.tsx:163-173`
- **Fix:** Use in-app browser (WebView or Linking.openURL with SFSafariViewController).

---

### Rendez Admin — Display & UI

**RZ-A-L2: Inline Styles Everywhere — No CSS/SCSS**
- **File:** All pages
- **Fix:** Extract to CSS modules or shared Tailwind classes.

**A10-L2: Login Error Uses showAlert Instead of Inline Display**
- **File:** `app/(auth)/login.tsx:47`
- **Fix:** Show inline error message below the form.

**A10-L4: ErrorBoundary.handleReset Reads Stale `errorCount`**
- **File:** `components/ErrorBoundary.tsx:84`
- **Fix:** Read the value from `setState`'s callback or use functional update.

**A10-L5: formatNumber Called 4x Per Render Without Memoization**
- **File:** `app/(dashboard)/index.tsx:193-200`
- **Fix:** Use `useMemo` for formatted values.

**A10-L6: Hardcoded 'en-IN' Locale in Merchants Screen**
- **File:** `app/(dashboard)/merchants.tsx:262`
- **Fix:** Use device locale or admin-configured locale.

---

## Category 3: Security (~35 issues)

### Merchant App — Security

**G-MA-L13: isBiometricAvailable Not Cached — Repeated Native Calls**
- **File:** `utils/biometric.ts:12-21`
- **Fix:** Memoize result with `useMemo` or module-level cache.

**G-MA-L14: Customer Search — No Query Length Limit**
- **File:** `services/api/coins.ts:96-109`
- **Fix:** Enforce max query length (e.g., 50 chars).

**G-MA-L15: Session Timeout parseInt Fallback to 0 on Invalid Env**
- **File:** `contexts/AuthContext.tsx:345`
- **Fix:** Validate env var before parsing. Reject invalid values.

**G-MA-L16: Web Token Storage in localStorage (XSS Accessible)**
- **File:** `services/storage.ts:19`
- **Fix:** Use `httpOnly` cookies or `sessionStorage` with CSP.

**G-MA-L17: Invitation Token in URL Path — Access Log Exposure**
- **File:** `services/api/team.ts:335-338`
- **Fix:** Use POST body or secure header instead.

**G-MA-L18: Deep Link — Custom URL Scheme Instead of Universal Links**
- **File:** `app.config.js:9, 26, 52-57`
- **Fix:** Use universal links (HTTPS) in production.

**G-MA-L19: Console Logs in AuthContext Expose Auth Flow Internals**
- **File:** `contexts/AuthContext.tsx:107, 244, 317, 374`
- **Fix:** Remove or gate with `__DEV__` and remove sensitive state from logs.

**G-MA-L20: API Base URL Silent Fallback in Production**
- **File:** `app.config.js:133`
- **Fix:** Fail fast if required env var is missing in production.

**G-MA-L21: MIN_PASSWORD_LENGTH: 6 — OWASP Violation**
- **File:** `constants/teamConstants.ts:321`
- **Fix:** Increase to 8+ with complexity requirements.

**G-MA-L49: No Audit Log Ownership Filter Validation**
- **File:** `services/api/audit.ts:77`
- **Fix:** Validate `userId` filter against merchant ownership.

**G-MA-L73: debugAuth Decodes JWT Without Verification**
- **File:** `utils/debugAuth.ts:7-16`
- **Fix:** Ensure only used for display/logging, guarded by `__DEV__`.

**G-MA-L79: Auth Context Token Expiry Extraction Bypasses Validation**
- **File:** `contexts/AuthContext.tsx:348-350`
- **Fix:** Use `jwtDecode` from `jwt-decode` package for safe decoding.

**G-MA-L80: Linearlytic Analytics Deep Link URL Template Without Validation**
- **File:** `services/api/integrations.ts:125`
- **Fix:** Whitelist `platform` before URL lookup.

**G-MA-L97: pending-approval.tsx Email Field Accepts Arbitrary URL to `Linking.openURL`**
- **File:** `app/onboarding/pending-approval.tsx:170, 173, 176`
- **Fix:** Validate URL before opening (whitelist `mailto:`, `tel:`, `https:`).

**G-MA-L98: Onboarding.ts File Upload Has No MIME Type Validation**
- **File:** `services/api/onboarding.ts:240-245`
- **Fix:** Whitelist MIME types: `['image/jpeg', 'image/png', 'image/webp', 'application/pdf']`.

**G-MA-L101: AsyncStorage Stores Sensitive Notification Data in Cleartext**
- **File:** `hooks/useNotificationBadge.ts:87, 97-99`
- **Fix:** Move identifiable data to SecureStore.

---

### ReZ NoW — Security

**NW-LOW-001: `crypto.randomUUID()` Called in SSR Render Without Polyfill Guards**
- **File:** `components/store/GoogleReviews.tsx:14`
- **Fix:** Use React's `useId()` hook for stable IDs.

**NW-LOW-024: Razorpay Key ID Never Validated Server-Side Before Checkout**
- **File:** `app/[storeSlug]/pay/checkout/page.tsx:148-149`
- **Fix:** Validate key ID is present and has `rzp_...` format.

**NW-LOW-025: sendOtp Returns hasPIN But PIN Login Not Implemented**
- **File:** `lib/api/auth.ts:4-12`
- **Fix:** Add PIN entry option to login modal for returning users.

**NW-LOW-026: cancelBill Has No Ownership Check Before Cancelling**
- **File:** `lib/api/merchantBill.ts:72-75`
- **Fix:** Pass `storeSlug` in request body for ownership validation.

**NW-LOW-027: setOrderStatus Has No Authorization Check**
- **File:** `lib/api/orders.ts:76-85`
- **Fix:** Ensure backend validates merchant role before applying status updates.

**NW-LOW-028: callWaiter Has No Debounce — Multiple Rapid Taps Create N Requests**
- **File:** `lib/api/store.ts:22-28`
- **Fix:** Add `makeIdempotencyKey('waiter', storeSlug + tableNumber)`.

**NW-LOW-036: Staff PIN Gate Uses Guessable Derivation from storeSlug**
- **File:** `app/[storeSlug]/staff/StaffDashboardClient.tsx:11-15`
- **Fix:** Use server-generated random PIN stored in database, sent via SMS.

**NW-LOW-039: Merchant PayDisplayClient Has No `authToken` Passed to Socket.IO**
- **File:** `app/[storeSlug]/merchant/pay-display/PayDisplayClient.tsx:108-112`
- **Fix:** Pass auth token in handshake: `io(SOCKET_URL, { auth: { token: getAuthToken() } })`.

---

### Rendez App — Security

**RZ-M-L3: Chat Messages Not Sanitized — XSS Risk**
- **File:** `src/app/ChatScreen.tsx:126`
- **Fix:** Add sanitization for WebView rendering path.

---

### Rendez Admin — Security

**RZ-A-L4: FraudFlag Profile Field Name Mismatch**
- **File:** `src/app/fraud/page.tsx:12`
- **Fix:** Access `f.profile?.user?.name` to match backend shape.

**A10-L1: 677 `__DEV__` Console Statements in Shipped Bundle**
- **Files:** All 86 `services/api/*.ts`
- **Fix:** Strip `__DEV__` blocks in production build or use dead-code elimination.

**A10-L8: Offline Auth Bypass Window (5 Minutes)**
- **File:** `contexts/AuthContext.tsx:242-254`
- **Note:** Accepted risk — minimal impact for admin network.

---

## Category 4: Business Logic & Data (~50 issues)

### Merchant App — Business Logic

**G-MA-L22: getRecentPayments Returns Wrong Type**
- **File:** `services/api/payments.ts:126-128`
- **Fix:** Return type should match `StorePaymentRecord[]`.

**G-MA-L23: Analytics Fallback Hardcodes 6 Statuses to 0**
- **File:** `services/api/orders.ts:306`
- **Fix:** Remove hardcoded zeros. Use actual API values.

**G-MA-L24: POSService Revenue Summary — Per-Page Only**
- **File:** `services/api/pos.ts:448`
- **Fix:** Sum from true total, not page results.

**G-MA-L25: Cashback Rejection Sends Reason Twice**
- **File:** `app/(cashback)/[id].tsx:85`
- **Fix:** Remove duplicate `rejectionReason` field.

**G-MA-L26: getItemTotal Can Return NaN**
- **File:** `app/(dashboard)/orders/[id].tsx:100-102`
- **Fix:** Guard against undefined/null price with `|| 0`.

**G-MA-L27: Order Item Total — NaN Guard Missing**
- **File:** `app/(dashboard)/orders/[id].tsx:100-102`
- **Fix:** Guard `NaN` before formatting: `isNaN(val) ? 0 : val`.

**G-MA-L28: POSService createMerchantOrder Is Fire-and-Forget**
- **File:** `services/api/pos.ts:650-662`
- **Fix:** Propagate error or use retry queue.

**G-MA-L30: No Idempotency Key on Financial Operations**
- **File:** Multiple financial services
- **Fix:** Add `X-Idempotency-Key` header for coin award and payout calls.

**G-MA-L31: Coin Award History Page — No Limit Cap**
- **File:** `services/api/coins.ts:147-168`
- **Fix:** Enforce maximum `limit` server-side.

**G-MA-L32: Duplicate Rejection Reason Sent Twice**
- **File:** `app/(cashback)/[id].tsx:85`
- **Fix:** Same as G-MA-L25.

**G-MA-L34: Aadhar Validation Requires Exactly 12 Digits**
- **File:** `components/onboarding/BankDetailsForm.tsx:98-102`
- **Fix:** Accept formatted input or normalize before validation.

**G-MA-L36: Stale Comment Never Cleaned Up**
- **File:** `types/api.ts:171-172`
- **Fix:** Remove stale comment referencing non-existent backend values.

**G-MA-L50: createBill Excess Discount Silently Discarded**
- **File:** `services/api/pos.ts:252`
- **Fix:** Show warning when discount exceeds order total.

**G-MA-L51: Basket Size Trend Edge Case Division by Zero**
- **File:** `services/api/dashboard.ts:139`
- **Fix:** Handle `thisWeekAvg === 0 && lastWeekAvg === 0` → show 'N/A'.

**G-MA-L58: Register Path Missing Name Fallback**
- **File:** `services/api/auth.ts:74`
- **Fix:** Add `name || 'Team Member'` fallback like login.

**G-MA-L61: Dashboard totalCustomersToday=0 Triggers Wrong Fallback**
- **File:** `services/api/dashboard.ts:111`
- **Fix:** Use `totalCustomersToday ?? -1` to distinguish 0 from missing.

**G-MA-L62: atob() Deprecated — Malformed JWT Silently Falls Through**
- **File:** `contexts/AuthContext.tsx:347-354`
- **Fix:** Use `jwtDecode` from `jwt-decode` package.

**G-MA-L83: Offline Queue Push Swallows All Errors Silently**
- **File:** `services/offline.ts:154-156`
- **Fix:** Log or surface the error instead of empty catch.

**G-MA-L85: syncOfflineActions Outer Catch Swallows All Errors**
- **File:** `services/offline.ts:229-231`
- **Fix:** Log the sync failure.

**G-MA-L89: customerInsights Division by Potentially Zero avgOrdersPerCustomer**
- **File:** `services/api/customerInsights.ts:84`
- **Fix:** Guard against zero divisor: `avgOrders > 0 ? ... : 0`.

**G-MA-L94: Offline Queue Overflow Silently Drops Actions After Warning**
- **File:** `services/offline.ts:141-150`
- **Fix:** Don't modify array until dead letter push succeeds.

**G-MA-L95: syncOfflineActions Non-Atomic Dual-Write**
- **File:** `services/offline.ts:227-228`
- **Fix:** Use single atomic write for both remaining actions and dead letters.

**G-MA-L99: OfflineService actionSequence Is In-Memory — Resets on App Restart**
- **File:** `services/offline.ts:29`
- **Fix:** Use UUID generator for idempotency keys instead of timestamp + sequence.

**G-MA-L100: customerInsights Unsafe Type Cast on avgOrdersPerCustomer Division**
- **File:** `services/api/customerInsights.ts:81-85`
- **Fix:** Add zero-guard (same as G-MA-L89).

**G-MA-L102: config/api.ts Throws on Startup if Env Vars Missing**
- **File:** `config/api.ts:36, 70`
- **Fix:** Allow HTTP in non-production environments.

---

### ReZ NoW — Business Logic

**NW-LOW-005: roundUpRupees Name Misleading — Returns Rounding Delta, Not Total**
- **File:** `lib/utils/currency.ts:21-24`
- **Fix:** Rename to `getRoundingAmount` with clear JSDoc.

**NW-LOW-007: isUPIAvailable Detection via User-Agent Regex — Unreliable**
- **File:** `lib/utils/upi.ts:51-54`
- **Fix:** Use feature detection instead of UA string.

**NW-LOW-012: Scan-Pay Coin Formula 100x Smaller Than Order Coin Formula**
- **File:** `app/[storeSlug]/pay/page.tsx:59-61`
- **Fix:** Align formulas across scan-pay and checkout flows.

**NW-LOW-013: Bill Builder Allows Zero-Price Custom Items**
- **File:** `app/[storeSlug]/merchant/bill-builder/BillBuilderClient.tsx:90-98`
- **Fix:** Check `isNaN(pricePaise) || pricePaise <= 0` and show error.

**NW-LOW-014: Bill Builder Allows Negative Discount**
- **File:** `app/[storeSlug]/merchant/bill-builder/BillBuilderClient.tsx:100-104`
- **Fix:** Use `Math.max(0, ...)` and validate `discountPaise <= subtotal`.

**NW-LOW-015: geoLocation Timeout Shows Error But No Fallback**
- **File:** `app/[storeSlug]/checkout/page.tsx:108-121`
- **Fix:** Provide Google Places autocomplete fallback.

**NW-LOW-016: PaymentOptions Has No Disabled State When UPI Links Can't Be Built**
- **File:** `components/checkout/PaymentOptions.tsx:118-150`
- **Fix:** Show informative error state when `rzpFailed` is true.

**NW-LOW-017: Merchant Layout Silently Swallows Auth Errors**
- **File:** `app/[storeSlug]/merchant/layout.tsx:46`
- **Fix:** Show error banner with login redirect on 401.

**NW-LOW-018: MultiStoreAnalytics Ignores selectedOutlet — Shows All-Outlet Totals**
- **File:** `components/merchant/MultiStoreAnalytics.tsx:62-64`
- **Fix:** Filter `stats.outletBreakdown` for selected outlet.

**NW-LOW-040: `getBillDetails` Imported from Wrong Module in Scan-Pay Checkout**
- **File:** `app/[storeSlug]/pay/checkout/page.tsx:10`
- **Fix:** Import from `@/lib/api/merchantBill` with correct `BillDetails` interface.

---

### RestoPapa — Business Logic

**RP-L01: Order Confirmation Checks 'paid' but Canonical Uses 'completed'**
- **File:** `rez-app-consumer/app/order/[storeSlug]/confirmation.tsx:253`
- **Fix:** Normalize to canonical `'completed'`.

**RP-L02: Creator Payout Uses 'paid' vs Canonical 'completed'**
- **File:** `rez-app-admin/app/(dashboard)/creators.tsx:614-624`
- **Fix:** Align with canonical statuses.

**RP-L03: Creator Payout Status Uses 'PAID' (Uppercase) vs 'Paid' (Title Case)**
- **File:** `rez-app-admin/app/(dashboard)/creators.tsx`
- **Fix:** Standardize to one casing convention.

**RP-L11: Math.random() in Jitter Logic (Non-Security)**
- **File:** `rez-app-consumer/services/billUploadQueueService.ts:724`
- **Note:** No fix needed — non-security jitter is cosmetic.

**RP-L12: Large Amount Transactions Not Validated**
- **Issue:** No upper bound on transaction amounts.
- **Fix:** Add maximum amount validation.

**RP-L13: Zero Amount Transactions Accepted**
- **Issue:** Zero-amount transactions are processed.
- **Fix:** Reject zero-amount at validation layer.

**RP-L14: Phantom coins.available Balance Never Synced**
- **File:** `rezbackend/src/models/UserLoyalty.ts`
- **Fix:** Remove phantom field or implement synchronization.

**RP-L15: Coin Type Normalization Lost in Service Writes**
- **File:** `rez-wallet-service/models/Wallet.ts`
- **Fix:** Add coin type validation at write time.

**RP-L16: Ledger Entry Missing for Prive Coin Transactions**
- **File:** `walletService.ts` (backend ledger)
- **Fix:** Add prive to `LedgerEntry.coinType` enum.

**RP-L17: Inconsistent Pagination Across Endpoints**
- **Issue:** Cursor-based vs offset-based pagination mixed.
- **Fix:** Define and enforce platform-wide pagination standard.

---

### Rendez App — Business Logic

**RZ-M-L5: Gift Catalog Fetched Even When Chat Picker Not Shown**
- **File:** `src/app/ChatScreen.tsx:45-49`
- **Fix:** Ensure `enabled: showGiftPicker` prevents all background fetches.

**RZ-M-L6: Gift Amount Double-Conversion Risk**
- **File:** `src/app/VoucherScreen.tsx`
- **Fix:** Prevent coin conversion from being applied twice.

**RZ-M-L7: `referralCount` Extracted But Never Displayed**
- **File:** `src/app/ProfileScreen.tsx:27-28`
- **Fix:** Display referral count in profile or remove extraction.

**RZ-M-L8: Camera Import Has Dead No-Op Conditional**
- **File:** `src/app/MeetupScreen.tsx:7-10`
- **Fix:** Remove dead no-op code.

**RZ-M-L9: No Expo-Secure-Store TTL — Token Never Expires Locally**
- **File:** `src/store/authStore.ts:32-35`
- **Fix:** Implement JWT expiry check or add refresh token flow.

**RZ-M-L10: SecureStore Rejection Locks App in Loading State**
- **File:** `src/store/authStore.ts`
- **Fix:** Handle SecureStore failure gracefully with fallback.

**RZ-M-L11: setToken Silently Fails if SecureStore Throws**
- **File:** `src/store/authStore.ts`
- **Fix:** Propagate error instead of silent failure.

**RZ-M-L12: No Token Expiry / Refresh Mechanism**
- **File:** `src/store/authStore.ts`
- **Fix:** Implement refresh token flow.

---

### ReZ Admin — Business Logic

**RZ-A-L5: Meetup Interface Missing Backend Fields**
- **File:** `src/app/meetups/page.tsx:6-18`
- **Fix:** Add `matchId`, `rezRewardRef`, `triggeredAt` to interface.

**RZ-A-L6: applicantCount Interface Shadowing `_count.applications`**
- **File:** `src/app/plans/page.tsx:22`

**RZ-A-L7: No City Filter in Users Page**
- **File:** `src/app/users/page.tsx`
- **Fix:** Send `city` and `isVerified` query params.

**RZ-A-L8: No Debounce on User Search**
- **File:** `src/app/users/page.tsx:41-43`
- **Fix:** Add debounce to search input.

**RZ-A-L11: Age Displayed as Raw Number with No Fallback for Null**
- **File:** `src/app/users/page.tsx:123`
- **Fix:** `<td>{u.age ?? '—'}</td>`.

**RZ-A-L12: API URL Variable Inconsistent Construction**
- **File:** `src/app/users/page.tsx:4` vs other admin pages
- **Fix:** Standardize on single URL construction via shared lib.

**RZ-A-L13: No Token Expiry / Refresh Mechanism in Auth Store**
- **File:** `rendez-app/src/store/authStore.ts:15-16`
- **Fix:** Decode JWT on store hydration. Implement refresh flow.

**RZ-A-L14: UserProfile Interface Missing `intent` Field**
- **File:** `rendez-app/src/store/authStore.ts:4-12`
- **Fix:** Add `intent?: string` to `UserProfile`.

---

## Category 5: Performance (~30 issues)

### Consumer App — Performance

**NA-LOW-04: `usePoints.ts` Polling Interval Not Cleaned Up**
- **File:** `hooks/usePoints.ts:51`
- **Fix:** Add `return () => clearInterval(pollingIntervalRef.current)`.

**NA-LOW-05: `window.addEventListener` with No Cleanup in creator-apply.tsx**
- **File:** `app/creator-apply.tsx:70`
- **Fix:** Call `window.removeEventListener` in useEffect cleanup.

**NA-LOW-10: `CoinTogglesSection` No Debounce on Slider**
- **File:** `hooks/useCheckoutUI.ts` from `app/checkout.tsx`
- **Fix:** Add `useDebounce` wrapper to coin toggle handler.

**NA-LOW-12: usePoints Interval Cleanup Missing**
- **File:** `hooks/usePoints.ts`
- **Fix:** Same as NA-LOW-04 — add cleanup.

---

### Merchant App — Performance

**G-MA-L03: subscriptionCount Metric Never Decrements**
- **File:** `services/api/socket.ts:450-543`
- **Fix:** Call decrement on `unsubscribeFrom*` methods.

**G-MA-L40: POS Index renderProduct Callback Recreated on Cart Change**
- **File:** `app/pos/index.tsx:797-815`
- **Fix:** Remove `cart` from `useCallback` dependency array.

**G-MA-L41: SocketService Hardcoded 10s Connection Timeout**
- **File:** `services/api/socket.ts:75-83`
- **Fix:** Make timeout configurable per network condition.

**G-MA-L42: emit() Silently Drops Events Before Socket Init**
- **File:** `services/api/socket.ts:574-581`
- **Fix:** Queue events before socket init, replay on connect.

**G-MA-L44: useNetworkStatus — Double Sync on Network Restoration**
- **File:** `hooks/useNetworkStatus.ts:188-244`
- **Fix:** Debounce network restoration detection.

**G-MA-L45: No Pagination on POS Product Catalog**
- **File:** `app/pos/index.tsx:400-431`
- **Fix:** Add scroll pagination for large catalogs.

**G-MA-L46: KDS Order Limit 200 — No Date Filter, No Auto-Purge**
- **File:** `app/kds/index.tsx:803-821`
- **Fix:** Add date filter or auto-purge for completed orders.

**G-MA-L53: POS Index renderProduct Callback Recreated Every Cart Change**
- **File:** `app/pos/index.tsx:797`
- **Fix:** Use `useRef` for stable callback reference.

**G-MA-L54: POS Offline Screen No Duplicate Detection**
- **File:** `app/pos/offline.tsx:176-191`
- **Fix:** Check for duplicate bill IDs before queuing.

**G-MA-L55: offlineService Dead Letter Queue Unbounded at 1000**
- **File:** `services/offline.ts:42`
- **Fix:** Implement max age or count-based eviction.

**G-MA-L56: POS Offline Queue Eviction Silently Drops Oldest**
- **File:** `services/offlinePOSQueue.ts:62-72`
- **Fix:** Notify user before dropping queued bills.

**G-MA-L65: OnboardingService setInterval Never Cleared on Stop**
- **File:** `services/api/onboarding.ts:489-504`
- **Fix:** Register interval cleanup or add service lifecycle `destroy()`.

**G-MA-L66: SocketContext Empty Catch Blocks — 3 Instances**
- **File:** `contexts/SocketContext.tsx:74, 84, 134`
- **Fix:** Add logging and user-facing connection status.

**G-MA-L68: Product Bulk Export/Import Uses Raw fetch() Bypassing apiClient**
- **Files:** `services/api/products.ts:375, 427, 653`
- **Fix:** Wrap in apiClient or add auth/refresh logic.

**G-MA-L82: Print Retry Queue Unbounded — Memory Leak on Repeated Failures**
- **File:** `services/printer.ts:253`
- **Fix:** Add max length check with oldest eviction.

---

### ReZ NoW — Performance

**NW-LOW-113: GoogleReviews RelativeTime Off-by-One**
- **File:** `components/store/GoogleReviews.tsx:94-103`
- **Fix:** Reorder conditional checks (same as NW-LOW-023, duplicate entry).

**NW-LOW-035: Auth Refresh Queue Silently Drops Requests**
- **File:** `lib/api/client.ts:137-154`
- **Fix:** Reject all queued promises on refresh failure (same as NW-LOW-035).

---

### Karma UI — Performance

**G-KU-L3: useFocusEffect Refetches on Every Focus**
- **Files:** `home.tsx:291-295`, `my-karma.tsx:207-209`, `wallet.tsx:135-139`, `explore.tsx:244-248`
- **Fix:** Only refetch if data is stale (>5 min old).

---

## Category 6: Data Sync & Offline (~25 issues)

### Merchant App — Offline & Sync

**G-MA-L02: MerchantContext No Optimistic Updates**
- **File:** `contexts/MerchantContext.tsx:213-224`
- **Fix:** Implement optimistic status updates for better UX.

**G-MA-L71: Math.random() in Variant Helper (Non-Test Data Path)**
- **File:** `utils/variantHelpers.ts:48-50`
- **Fix:** Use `crypto.getRandomValues()` or `uuid`.

**G-MA-L74: Chart Mock Data Uses Math.random() in Non-Test File**
- **File:** `utils/chartHelpers.ts:481`
- **Fix:** Gate behind mock mode flag.

**G-MA-L76: Analytics Peak Hours Mock Data Uses Math.random()**
- **File:** `app/analytics/peak-hours.tsx:62-63`
- **Fix:** Gate behind demo/mock mode flag.

**G-MA-L90: Math.random() for Local Promotion IDs**
- **File:** `app/stores/[id]/promotions.tsx:42`
- **Fix:** Use `uuid` or `crypto.randomUUID()`.

**G-MA-L91: Math.random() for List Item Keys in Recent Orders**
- **File:** `app/pos/recent-orders.tsx:113`
- **Fix:** Use stable ID: `item.billId || item._id || \`recent-order-${index}\``.

**G-MA-L92: Math.random() for Campaign List Keys**
- **File:** `app/campaigns/performance.tsx:75`
- **Fix:** Use stable index fallback.

**G-MA-L96: Multiple Date.now() Calls in pushOfflineAction Allows Timestamp Drift**
- **File:** `services/offline.ts:128-136`
- **Note:** Not significant — `now` is already called once and reused correctly here.

---

### ReZ NoW — Data Sync

**NW-LOW-201: Bill Builder Zero Price Custom Items**
- **File:** `app/[storeSlug]/merchant/bill-builder/BillBuilderClient.tsx:90-98`
- **Fix:** (Same as NW-LOW-013 — duplicate entry)

**NW-LOW-202: Bill Builder Negative Discount**
- **File:** `app/[storeSlug]/merchant/bill-builder/BillBuilderClient.tsx:100-104`
- **Fix:** (Same as NW-LOW-014 — duplicate entry)

---

### RestoPapa — Data Sync

**RP-L09: Wallet Microservice Missing 3+ Fields Truncated on Write**
- **File:** `rez-wallet-service/models/Wallet.ts`
- **Fix:** 2h — Add missing fields. Migrate existing documents.

---

## Cross-Duplicate Notes

The following items appear in multiple categories and should be deduplicated when fixing:

| Issue | Appears In |
|-------|-----------|
| `NaN` guard missing on division | G-MA-L26, G-MA-L27, G-MA-L89, G-MA-L100 |
| Empty catch blocks | G-MA-L66, G-MA-L70, G-MA-L83, G-MA-L84, G-MA-L85, G-MA-L86 |
| `Math.random()` usage | G-MA-L71, G-MA-L74, G-MA-L76, G-MA-L90, G-MA-L91, G-MA-L92, RP-L11 |
| Duplicate `PaymentStatus` | G-MA-L63, G-MA-L67 |
| Duplicate `OrderStatus` | G-MA-L64, RP-L01, RP-L02, RP-L03 |
| Token auth missing | G-MA-L16, NW-LOW-039 |
| Auth refresh queue drops | NW-LOW-035 |
| Offline queue unbounded | G-MA-L55, G-MA-L56, G-MA-L82 |
| Bill Builder input validation | NW-LOW-013, NW-LOW-014, NW-LOW-202, NW-LOW-203 |
| GoogleReviews relativeTime off-by-one | NW-LOW-023 |
| Currency formatting duplicates | NA-LOW-07, NA-LOW-11 |
| Luhn algorithm duplicates | NA-LOW-06, NA-LOW-09 |
| `Date.now()` for IDs | NW-LOW-038, NW-LOW-044 |
| UseRef vs useState for dedup | NW-LOW-042 |
| Token expiry tracking | RZ-M-L9, RZ-M-L10, RZ-M-L11, RZ-M-L12, RZ-A-L13 |

---

## Status Summary

| ID | Severity | Source | Title | Status |
|----|----------|--------|-------|--------|
| NA-LOW-01 | LOW | Consumer 2026 | Clipboard import scattered 18x | ACTIVE |
| NA-LOW-02 | LOW | Consumer 2026 | Bare console.log throughout | ACTIVE |
| NA-LOW-03 | LOW | Consumer 2026 | Two image cache implementations | ACTIVE |
| NA-LOW-04 | LOW | Consumer 2026 | usePoints polling interval leak | ACTIVE |
| NA-LOW-05 | LOW | Consumer 2026 | window.addEventListener no cleanup | ACTIVE |
| NA-LOW-06 | LOW | Consumer 2026 | Luhn algorithm twice | ACTIVE |
| NA-LOW-07 | LOW | Consumer 2026 | Duplicate currency formatting | ACTIVE |
| NA-LOW-08 | LOW | Consumer 2026 | isTokenValid dead code | ACTIVE |
| NA-LOW-09 | LOW | Consumer 2026 | Luhn radix bug in paymentService | ACTIVE |
| NA-LOW-10 | LOW | Consumer 2026 | CoinTogglesSection no debounce | ACTIVE |
| NA-LOW-11 | LOW | Consumer 2026 | Duplicate currency — two outputs | ACTIVE |
| NA-LOW-12 | LOW | Consumer 2026 | usePoints interval cleanup missing | ACTIVE |
| NW-LOW-001 | LOW | ReZ NoW | crypto.randomUUID SSR without polyfill | ACTIVE |
| NW-LOW-002 | LOW | ReZ NoW | PromoBanner arbitrary bgColor inline styles | ACTIVE |
| NW-LOW-003 | LOW | ReZ NoW | DeliveryAddress type defined twice | ACTIVE |
| NW-LOW-004 | LOW | ReZ NoW | Wallet/orders duplicate auth check | ACTIVE |
| NW-LOW-005 | LOW | ReZ NoW | roundUpRupees name misleading | ACTIVE |
| NW-LOW-006 | LOW | ReZ NoW | TIER_CONFIG no unknown tier fallback | ACTIVE |
| NW-LOW-007 | LOW | ReZ NoW | isUPIAvailable UA regex unreliable | ACTIVE |
| NW-LOW-008 | LOW | ReZ NoW | formatINRCompact ₹5.0k inconsistent | ACTIVE |
| NW-LOW-009 | LOW | ReZ NoW | redeemStamps no response validation | ACTIVE |
| NW-LOW-010 | LOW | ReZ NoW | OrderHistoryClient undefined STATUS_COLOUR | ACTIVE |
| NW-LOW-011 | LOW | ReZ NoW | Duplicate CouponInput components | ACTIVE |
| NW-LOW-012 | LOW | ReZ NoW | Scan-pay coin formula 100x smaller | ACTIVE |
| NW-LOW-013 | LOW | ReZ NoW | Bill Builder zero-price custom items | ACTIVE |
| NW-LOW-014 | LOW | ReZ NoW | Bill Builder negative discount | ACTIVE |
| NW-LOW-015 | LOW | ReZ NoW | geoLocation timeout no fallback | ACTIVE |
| NW-LOW-016 | LOW | ReZ NoW | PaymentOptions no disabled state | ACTIVE |
| NW-LOW-017 | LOW | ReZ NoW | Merchant layout swallows auth errors | ACTIVE |
| NW-LOW-018 | LOW | ReZ NoW | MultiStoreAnalytics ignores selectedOutlet | ACTIVE |
| NW-LOW-019 | LOW | ReZ NoW | Chat AI metadata.items cast no guard | ACTIVE |
| NW-LOW-020 | LOW | ReZ NoW | useTrack error return ignored | ACTIVE |
| NW-LOW-021 | LOW | ReZ NoW | cancelOrder refund field no chaining | ACTIVE |
| NW-LOW-022 | LOW | ReZ NoW | Coin credit hook hooks violation | ACTIVE |
| NW-LOW-023 | LOW | ReZ NoW | GoogleReviews relativeTime off-by-one | ACTIVE |
| NW-LOW-024 | LOW | ReZ NoW | Razorpay key ID not validated | ACTIVE |
| NW-LOW-025 | LOW | ReZ NoW | sendOtp hasPIN but PIN login missing | ACTIVE |
| NW-LOW-026 | LOW | ReZ NoW | cancelBill no ownership check | ACTIVE |
| NW-LOW-027 | LOW | ReZ NoW | setOrderStatus no authorization check | ACTIVE |
| NW-LOW-028 | LOW | ReZ NoW | callWaiter no debounce | ACTIVE |
| NW-LOW-029 | LOW | ReZ NoW | Reservation date field inconsistency | ACTIVE |
| NW-LOW-030 | LOW | ReZ NoW | getStoreCoupons/getAvailableCoupons duplicate | ACTIVE |
| NW-LOW-031 | LOW | ReZ NoW | getWalletTransactions untyped | ACTIVE |
| NW-LOW-032 | LOW | ReZ NoW | share.ts hardcodes BASE_URL | ACTIVE |
| NW-LOW-033 | LOW | ReZ NoW | exportReconciliationCSV raw fetch | ACTIVE |
| NW-LOW-034 | LOW | ReZ NoW | ChatResponse/AIMessage type mismatch | ACTIVE |
| NW-LOW-035 | LOW | ReZ NoW | Auth refresh queue silently drops | ACTIVE |
| NW-LOW-036 | LOW | ReZ NoW | Staff PIN guessable from storeSlug | ACTIVE |
| NW-LOW-037 | LOW | ReZ NoW | BillBuilderClient uses window.location.origin | ACTIVE |
| NW-LOW-038 | LOW | ReZ NoW | billStore localId uses Date.now() collision | ACTIVE |
| NW-LOW-039 | LOW | ReZ NoW | PayDisplayClient no auth token Socket.IO | ACTIVE |
| NW-LOW-040 | LOW | ReZ NoW | getBillDetails wrong import | ACTIVE |
| NW-LOW-041 | LOW | ReZ NoW | search.ts raw fetch instead of deduplicatedGet | ACTIVE |
| NW-LOW-042 | LOW | ReZ NoW | PayDisplayClient dedup stale payments state | ACTIVE |
| NW-LOW-043 | LOW | ReZ NoW | formatTime crashes on malformed time | ACTIVE |
| NW-LOW-044 | LOW | ReZ NoW | KitchenChatDrawer Date.now() collisions | ACTIVE |
| RP-L01 | LOW | RestoPapa | Order confirmation 'paid' vs 'completed' | ACTIVE |
| RP-L02 | LOW | RestoPapa | Creator payout 'paid' vs 'completed' | ACTIVE |
| RP-L03 | LOW | RestoPapa | Creator payout 'PAID' vs 'Paid' casing | ACTIVE |
| RP-L04 | LOW | RestoPapa | Multiple normalizeOrderStatus implementations | ACTIVE |
| RP-L05 | LOW | RestoPapa | Batch stats raw MongoDB aggregation | ACTIVE |
| RP-L06 | LOW | RestoPapa | Duplicate package in two paths | ACTIVE |
| RP-L07 | LOW | RestoPapa | startOfWeek IST offset not applied | ACTIVE |
| RP-L08 | LOW | RestoPapa | Karma conversion rate hardcoded | ACTIVE |
| RP-L09 | LOW | RestoPapa | Wallet microservice missing 3+ fields | ACTIVE |
| RP-L10 | LOW | RestoPapa | Duplicate startOfWeek computation | ACTIVE |
| RP-L11 | LOW | RestoPapa | Math.random() in jitter (non-security) | ACTIVE |
| RP-L12 | LOW | RestoPapa | Large amount transactions not validated | ACTIVE |
| RP-L13 | LOW | RestoPapa | Zero amount transactions accepted | ACTIVE |
| RP-L14 | LOW | RestoPapa | Phantom coins.available never synced | ACTIVE |
| RP-L15 | LOW | RestoPapa | Coin type normalization lost in writes | ACTIVE |
| RP-L16 | LOW | RestoPapa | Ledger entry missing for prive coins | ACTIVE |
| RP-L17 | LOW | RestoPapa | Inconsistent pagination across endpoints | ACTIVE |
| G-MA-L01–L102 | LOW | Merchant App | See individual items above | ACTIVE |
| A10-L1–L8 | LOW | ReZ Admin Gen 10 | See individual items above | ACTIVE |
| G-KU-L1 | LOW | Karma UI | filteredEvents no-op variable | ACTIVE |
| G-KU-L2 | LOW | Karma UI | Hardcoded placeholder partner names | ACTIVE |
| G-KU-L3 | LOW | Karma UI | useFocusEffect refetches on every focus | ACTIVE |
| RZ-B-L1 | LOW | Rendez Backend | likeLimiter uses req:any | ACTIVE |
| RZ-B-L2 | LOW | Rendez Backend | Redis URL no pool settings | ACTIVE |
| RZ-B-L3 | LOW | Rendez Backend | Euclidean distance inaccurate at scale | ACTIVE |
| RZ-B-L4 | LOW | Rendez Backend | Admin user search no cursor pagination | ACTIVE |
| RZ-B-L5 | LOW | Rendez Backend | Duplicate FraudService instantiation | ACTIVE |
| RZ-B-L6 | LOW | Rendez Backend | Duplicate queue definitions | ACTIVE |
| RZ-B-L7 | LOW | Rendez Backend | Header-based idempotency bypassable | ACTIVE |
| RZ-B-L8 | LOW | Rendez Backend | AppError convention confused | ACTIVE |
| RZ-M-L1–L13 | LOW | Rendez App | See individual items above | ACTIVE |
| RZ-A-L1–L14 | LOW | Rendez Admin | See individual items above | ACTIVE |
