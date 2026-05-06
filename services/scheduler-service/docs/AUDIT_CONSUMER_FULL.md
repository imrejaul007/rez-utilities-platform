# Consumer App Full Audit Report
**App:** nuqta-master (REZ Consumer App)
**Path:** `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/`
**Audit Date:** 2026-04-10
**Auditor:** Claude Code Quality Analyzer

---

## Executive Summary

| Metric | Value |
|---|---|
| Total screens inventoried | ~220+ TSX files in `app/` |
| Tab screens | 5 (Home, Play, Categories, Earn, Finance) |
| Auth flow status | Functional end-to-end (OTP → verify → token storage) |
| API base URL config | Env-var driven (`EXPO_PUBLIC_API_BASE_URL`) — correct |
| Hotel OTA | Connected via `hotelOtaApi.ts` with SSO |
| Flights/Trains/Bus | Detail pages route through `productsApi.getProductById()` — NOT a dedicated travel API |
| QR Check-in | Connected but has a data-double-read bug |
| Wallet/Coins | Fully wired — socket-triggered auto-refresh working |
| Hardcoded/mock data | `brands.tsx`, `occasions.tsx`, `shop.tsx`, `category/[slug]/index.tsx` all pull from `categoryDummyData` |
| P0 issues | 6 |
| P1 issues | 12 |
| P2 issues | 18 |

---

## 1. Screen/Navigation Audit

### 1.1 Complete Screen Inventory

| Screen | Path | Status |
|---|---|---|
| Root Layout | `app/_layout.tsx` | Implemented — deep links, OTA update, onboarding check |
| **Tab: Home** | `app/(tabs)/index.tsx` | Implemented — full homepage with lazy sections |
| **Tab: Play** | `app/(tabs)/play.tsx` | Implemented |
| **Tab: Categories** | `app/(tabs)/categories.tsx` | Implemented |
| **Tab: Earn** | `app/(tabs)/earn.tsx` | Implemented |
| **Tab: Finance** | `app/(tabs)/finance.tsx` | Implemented |
| Sign-In | `app/sign-in.tsx` | Implemented — OTP flow |
| Onboarding Splash | `app/onboarding/splash.tsx` | Implemented |
| Onboarding Registration | `app/onboarding/registration.tsx` | Implemented |
| Onboarding OTP Verification | `app/onboarding/otp-verification.tsx` | Implemented |
| Onboarding Location | `app/onboarding/location.tsx` | Implemented |
| Onboarding Interests | `app/onboarding/interests.tsx` | Implemented |
| Onboarding Set PIN | `app/onboarding/set-pin.tsx` | Implemented |
| Onboarding Notification Permission | `app/onboarding/notification-permission.tsx` | Implemented |
| Onboarding Identity Select | `app/onboarding/identity-select.tsx` | Implemented |
| Onboarding Student Verify | `app/onboarding/student-verify.tsx` | Implemented |
| Onboarding Corporate Verify | `app/onboarding/corporate-verify.tsx` | Implemented |
| Onboarding Defence Verify | `app/onboarding/defence-verify.tsx` | Implemented |
| Onboarding Teacher Verify | `app/onboarding/teacher-verify.tsx` | Implemented |
| Onboarding Healthcare Verify | `app/onboarding/healthcare-verify.tsx` | Implemented |
| Onboarding Other Verify | `app/onboarding/other-verify.tsx` | Implemented |
| Onboarding Verification Pending | `app/onboarding/verification-pending.tsx` | Implemented |
| Onboarding Verification Success | `app/onboarding/verification-success.tsx` | Implemented |
| Onboarding First Scan | `app/onboarding/first-scan.tsx` | Implemented |
| Onboarding Loading | `app/onboarding/loading.tsx` | Implemented |
| Profile | `app/profile/index.tsx` | Implemented — API-connected |
| Profile Edit | `app/profile/edit.tsx` | Implemented |
| Profile QR Code | `app/profile/qr-code.tsx` | Implemented |
| Profile Achievements | `app/profile/achievements.tsx` | Implemented |
| Profile Verification | `app/profile/verification.tsx` | Implemented |
| Profile Partner | `app/profile/partner.tsx` | Implemented |
| Profile Store Promo Coins | `app/profile/store-promo-coins.tsx` | Implemented |
| Profile Activity | `app/profile/activity.tsx` | Implemented |
| QR Check-in | `app/qr-checkin.tsx` | Implemented — has bugs (see §3.6) |
| Order Menu (QR) | `app/order/[storeSlug]/index.tsx` | Implemented — web ordering via `webOrderingApi` |
| Order Checkout (QR) | `app/order/[storeSlug]/checkout.tsx` | Implemented |
| Order Confirmation | `app/order/[storeSlug]/confirmation.tsx` | Implemented — polls order status |
| Order History | `app/order-history.tsx` | Implemented — paginated, filter modal |
| Payment (Razorpay) | `app/payment-razorpay.tsx` | Implemented — has prefill bug |
| Payment Success | `app/payment-success.tsx` | Implemented |
| Hotel OTA Detail | `app/travel/hotels/[id].tsx` | Implemented |
| Hotel OTA List | `app/travel/hotels/index.tsx` | Implemented |
| Hotel OTA Checkout | `app/travel/hotels/checkout.tsx` | Implemented — Razorpay wired |
| Hotel OTA Booking Confirmed | `app/travel/hotels/booking-confirmed.tsx` | Implemented |
| Hotel OTA Booking (ID) | `app/travel/hotels/booking/[id].tsx` | Implemented |
| Hotel OTA Coin History | `app/travel/hotels/coin-history.tsx` | Implemented |
| Hotel OTA Review | `app/travel/hotels/[id]/review.tsx` | Implemented |
| Travel Hub | `app/travel/index.tsx` | Implemented — routes to category pages |
| Travel Category | `app/travel/[category].tsx` | Implemented |
| Travel Search | `app/travel/search.tsx` | Implemented |
| Travel Deals | `app/travel/deals.tsx` | Implemented |
| Flight Detail | `app/flight/[id].tsx` | Partial — uses `productsApi`, not a dedicated flight API |
| Train Detail | `app/train/[id].tsx` | Partial — uses `productsApi` |
| Bus Detail | `app/bus/[id].tsx` | Partial — uses `productsApi` |
| Cab Detail | `app/cab/[id].tsx` | Partial — uses `productsApi` |
| Hotel Detail (legacy) | `app/hotel/[id].tsx` | Uses `productsApi` — different from OTA hotel flow |
| Wallet Screen | `app/wallet-screen.tsx` | Implemented |
| Wallet History | `app/wallet-history.tsx` | Implemented |
| Transactions | `app/transactions/index.tsx` | Implemented |
| Redeem Coins | `app/redeem-coins.tsx` | Implemented |
| REZ Cash | `app/rez-cash.tsx` | Implemented — calls `walletApi.getRezCashIdentity()` |
| Brands | `app/brands.tsx` | BROKEN — uses `categoryDummyData`, no real API |
| Occasions | `app/occasions.tsx` | PARTIAL — tries `categoryMetadataApi` but falls back to `categoryDummyData` |
| Shop | `app/shop.tsx` | PARTIAL — uses `categoryDummyData` for vibes/occasions |
| Category Slug | `app/category/[slug]/index.tsx` | PARTIAL — imports `categoryDummyData` types |
| MainCategory Hub | `app/MainCategory/[slug]/index.tsx` | Implemented |
| Offers | `app/offers/index.tsx` | Implemented |
| Offer Detail | `app/offers/[id].tsx` | Implemented |
| Offers View All | `app/offers/view-all.tsx` | Implemented |
| Flash Sale | `app/flash-sales/[id].tsx` | Implemented |
| Search | `app/search.tsx` | Implemented |
| Gamification | `app/gamification/index.tsx` | Implemented |
| Games | `app/games/` | Implemented (trivia has hardcoded fallback questions) |
| Referral Dashboard | `app/referral/dashboard.tsx` | Implemented |
| Referral Share | `app/referral/share.tsx` | Implemented |
| Bank Offers | `app/bank-offers/index.tsx` | Implemented |
| Bank Offer Detail | `app/bank-offers/[id].tsx` | Implemented |
| Vouchers Brand | `app/vouchers/brand/[id].tsx` | Implemented |
| Messages | `app/messages/index.tsx` | Implemented |
| Notifications | `app/account/notifications.tsx` | Implemented |
| Settings | `app/settings.tsx` | Implemented |
| Account Settings | `app/account/settings.tsx` | Implemented |
| Delete Account | `app/account/delete-account.tsx` | Implemented |
| Maintenance | `app/maintenance.tsx` | Implemented |
| Update Required | `app/update-required.tsx` | Implemented |
| Wishlist | `app/wishlist.tsx` | Implemented |
| Prive Hub | `app/prive/index.tsx` | Implemented |
| Prive Campaigns | `app/prive/campaigns/index.tsx` | STUB — "Coming Soon" placeholder |
| Prive Smart Spend | `app/prive/smart-spend.tsx` | PARTIAL — "Premium Selections Coming Soon" |
| REZ Cash Bank Transfer | `app/rez-cash.tsx` | STUB — "Bank Transfer coming soon" alert |
| Gold Savings | `app/gold-savings/index.tsx` | TODO comment — disabled |
| Financial Category | `app/financial/[category].tsx` | Implemented |
| Home Services | `app/home-services/index.tsx` | Implemented |
| Healthcare | `app/healthcare/[category].tsx` | PARTIAL — insurance is "coming soon" |
| Booking (table/consultation) | `app/booking/table.tsx`, `app/booking/consultation.tsx` | Implemented |
| Booking Reschedule | `app/booking/reschedule/[bookingId].tsx` | Implemented |
| Social Impact | `app/social-impact/[id].tsx` | Implemented |
| Disputes | `app/disputes/` | Implemented |
| Support | `app/support/` | Implemented |

### 1.2 Missing/Empty Screens

1. **`/bus/[id]`** — exists as a file but uses generic `productsApi.getProductById()`. No bus-specific search/booking flow (no origin/destination/seat selection). This is cosmetically a "bus details" screen but functionally a product detail page.
2. **`/train/[id]`** — same issue as bus above.
3. **`/prive/campaigns/index.tsx`** — renders "Coming Soon" heading, zero functionality, no API calls.
4. **`app/prive/smart-spend.tsx`** — renders "Premium Selections Coming Soon" for its primary content section.
5. **`app/gold-savings/index.tsx`** — screen exists but feature is disabled via a TODO comment in `app/financial/index.tsx` line 295.
6. **`app/vouchers/brand/[id].tsx`** — the `app/vouchers/` directory only has one real screen; there is no vouchers list/index screen, only the brand detail.

### 1.3 Navigation Issues

1. **`app/(tabs)/_layout.tsx`** — the tab bar `tabBarStyle: { display: 'none' }` hides the default Expo tab bar. The app uses a custom `BottomNavigation` component. If that component fails to render (e.g., Suspense boundary error), users see no navigation.
2. **Deep links for flights/trains/bus** — the Travel hub and Travel Deals screens push to `/flight/${id}`, `/train/${id}`, `/bus/${id}`. These routes resolve to `app/flight/[id].tsx`, `app/train/[id].tsx`, `app/bus/[id].tsx`. These screens call `productsApi.getProductById()` (a catalog API), not a travel booking API. A valid flight `id` from the travel service API may not resolve in the catalog API.
3. **`router.push(\`/bus/\${serviceId}\` as any)`** — the `as any` cast bypasses type safety on every travel navigation call. If any route shape changes, there is no compile-time error.
4. **Onboarding guard race** — `_layout.tsx` runs `checkOnboarding()` on mount. It also calls `checkAppStatus()`. Both are fire-and-forget. If the app status endpoint responds and redirects to `/maintenance` before onboarding check completes, routing can land on maintenance while the user has a valid session.

---

## 2. API Connection Audit

### 2.1 Base URL Configuration

- Base URL: `EXPO_PUBLIC_API_BASE_URL` — read in `services/apiClient.ts` constructor. Falls back to `http://localhost:5001/api` in dev. **No `.env` file is present in the repo** (no `.env`, `.env.local`, etc. were found). This means every developer and every CI build must supply the variable externally or the app defaults to localhost and all API calls fail in the simulator.
- Hotel OTA base: `EXPO_PUBLIC_HOTEL_OTA_URL` — defaults to `https://hotel-ota-api.onrender.com`. If this env var is absent in production, the app will silently use the hard-coded Render URL, which is a free-tier service with cold-start latency.

### 2.2 All API Calls — Key Endpoints

| Screen/Service | Method | Endpoint | Correct? |
|---|---|---|---|
| Auth — send OTP | POST | `/user/auth/send-otp` | Yes |
| Auth — verify OTP | POST | `/user/auth/verify-otp` | Yes |
| Auth — refresh token | POST | `/user/auth/refresh-token` | Yes |
| Auth — logout | POST | `/user/auth/logout` | Yes |
| Auth — get profile | GET | `/user/auth/me` | Yes |
| Auth — update profile | PUT | `/user/auth/profile` | Yes — corrected from old `/user/profile` |
| Auth — complete onboarding | POST | `/user/auth/complete-onboarding` | Yes |
| Auth — delete account | DELETE | `/user/auth/account` | Yes |
| Auth — statistics | GET | `/user/auth/statistics` | Yes |
| Wallet — balance | GET | `/wallet/balance` | Yes |
| Wallet — transactions | GET | `/wallet/transactions` | Yes |
| Wallet — single transaction | GET | `/wallet/transaction/:id` | Yes (note: singular `transaction` not `transactions`) |
| Wallet — withdraw | POST | `/wallet/withdraw` | Yes |
| Wallet — payment (debit) | POST | `/wallet/payment` | Yes |
| Wallet — summary | GET | `/wallet/summary` | Yes |
| Wallet — categories breakdown | GET | `/wallet/categories` | Yes |
| Wallet — redeem coins | POST | `/wallet/redeem-coins` | Yes |
| Wallet — conversion rate | GET | `/wallet/conversion-rate` | Yes |
| Wallet — welcome coins | POST | `/wallet/welcome-coins` | Yes |
| Wallet — REZ Cash identity | GET | `/wallet/rez-cash` | Yes |
| Wallet — transfer initiate | POST | `/wallet/transfer/initiate` | Yes |
| Wallet — transfer confirm | POST | `/wallet/transfer/confirm` | Yes |
| Wallet — gift send | POST | `/wallet/gift/send` | Yes |
| Wallet — gift claim | POST | `/wallet/gift/:id/claim` | Yes |
| Wallet — gift cards catalog | GET | `/wallet/gift-cards/catalog` | Yes |
| Wallet — scheduled drops | GET | `/wallet/scheduled-drops` | Yes |
| Wallet — expiring coins | GET | `/wallet/expiring-coins` | Yes |
| Orders — create | POST | `/orders` | Yes |
| Orders — list | GET | `/orders` | Yes |
| Orders — single | GET | `/orders/:id` | Yes |
| Orders — cancel | PATCH | `/orders/:id/cancel` | Yes |
| Orders — rate | POST | `/orders/:id/rate` | Yes |
| Orders — counts | GET | `/orders/counts` | Yes |
| Cashback — summary | GET | `/cashback/summary` | Yes |
| Cashback — history | GET | `/cashback/history` | Yes |
| Cashback — pending | GET | `/cashback/pending` | Yes |
| Cashback — redeem | POST | `/cashback/redeem` | Yes |
| Cashback — double campaigns | GET | `/cashback/double-campaigns` | Yes |
| QR Check-in — store info | GET | `/qr-checkin/store/:storeId` | Questionable — see §3.6 |
| QR Check-in — submit | POST | `/qr-checkin` | Yes |
| Notifications — register token | POST | `/notifications/register-token` | Yes |
| Push referral apply | POST | `/referral/apply` | Yes |
| Config — app status | GET | `/config/app-status` | Yes |
| Hotel OTA — SSO login | POST | `${OTA_BASE}/v1/auth/rez-sso` | Yes |
| Hotel OTA — list hotels | GET | `${OTA_BASE}/v1/hotels` | Yes |
| Hotel OTA — hotel detail | GET | `${OTA_BASE}/v1/hotels/:id` | Yes |
| Hotel OTA — hold booking | POST | `${OTA_BASE}/v1/bookings/hold` | Yes |
| Hotel OTA — confirm booking | POST | `${OTA_BASE}/v1/bookings/:holdId/confirm` | Yes |
| Flight/Train/Bus detail | GET | `/products/:id` | WRONG — product catalog, not travel API |
| Brands listing | None | N/A | MISSING — uses local dummy data |
| Occasions listing | GET | categories metadata API | PARTIAL — falls back to dummy data |

### 2.3 Broken/Wrong Endpoints

1. **Flight, Train, Bus, Cab detail screens** all call `productsApi.getProductById(id)` which maps to `GET /products/:id`. This is the catalog product endpoint. These screens expect a travel-specific response shape (route, airline, flight number, departure time, seat classes, etc.) but parse it from `specifications` array fields. If the backend does not store flight data in the product catalog, these screens will show empty or garbled data. There is no dedicated flight/train/bus search API being called.

2. **QR Check-in store lookup** uses `apiClient.get('/qr-checkin/store/${storeId}')` and then double-reads `r.data?.data?.name`. The `apiClient.get()` wrapper already unwraps `responseData.data` into `response.data` (see `apiClient.ts` line 408: `data: responseData.data || responseData`). So the result is `response.data = backendData.data`, meaning `r.data?.data?.name` reads `backendData.data.data.name` — one level too deep. The store name will be `undefined` on every check-in screen load.

3. **`walletApi.getTransactionById()`** calls `GET /wallet/transaction/:id` (singular). If the backend mounts this as `/transactions/:id` (plural, matching the list endpoint pattern), this will 404. Needs verification against the backend route file.

4. **`authService.ensureValidToken()`** is marked `@deprecated` and always returns `true` without actually validating anything. At least two call sites may still invoke it expecting real token validation.

### 2.4 Missing API Methods

1. No dedicated flight search API (origin/destination/date search). The app has a `travel/search.tsx` screen with search form fields but no service method to submit a flight search query.
2. No dedicated train search API. Same issue.
3. No cab availability/pricing API. `cab/[id].tsx` uses the product catalog.
4. `walletApi.topup()` and `walletApi.creditLoyaltyPoints()` and `walletApi.refundPayment()` are all marked `@deprecated ADMIN-ONLY` and throw errors if called. Consumer-facing wallet top-up (Razorpay flow to add money to wallet) requires a separate Razorpay order creation endpoint — it is not clear from the app code which endpoint creates a Razorpay order for wallet recharge.

---

## 3. Core Flow Audit

### 3.1 Auth (OTP)

**Flow:** Sign-in screen → `sendOTP()` (POST `/user/auth/send-otp`) → 6-digit OTP entry → `verifyOTP()` (POST `/user/auth/verify-otp`) → tokens saved to SecureStore → `AUTH_SUCCESS` dispatch → navigation guard routes to home or onboarding.

**Status:** Largely functional. Specific issues:

- **Issue AUTH-1 (P1):** `sendOTP()` in `AuthContext` explicitly does NOT dispatch `AUTH_LOADING`. The comment explains this is intentional to avoid destroying sign-in local state. However, the sign-in screen manages loading state via its own `isSending` flag. If the sign-in component is remounted during OTP (e.g., navigation guard fires), all local state (phone number, OTP step) is reset with no recovery path.

- **Issue AUTH-2 (P1):** `completeOnboarding()` in `AuthContext` (line 548) calls `useAuthStore.getState().state?.user?.id` **inside a component function at call time**, not inside a hook. This is not a hook violation (it is a `getState()` static call), but if `state` is `null` (race during cold start), the chain throws with "Cannot read properties of null". The existing null guard `const userId = state.user?.id || ...` partially mitigates but `state` itself could be null.

- **Issue AUTH-3 (P2):** The `authTimeout` in `checkAuthStatus()` is set to `30_000` ms in the `setTimeout` but the comment above says "8s safety timeout" — the comment is stale. The actual timeout is 30 seconds, meaning users on slow connections will see a loading screen for up to 30 seconds before being redirected to sign-in.

- **Issue AUTH-4 (P2):** `authService.refreshToken()` uses `maxRetries: 1` in `withRetry()`. Retrying a token refresh after one failure could double-invalidate the refresh token on backends using rotation (each refresh token is single-use). This should be `maxRetries: 0`.

### 3.2 Discovery Flow

**Status:** Partially connected.

- Home tab (`app/(tabs)/index.tsx`) uses `useHomepage()`, `useLoyaltySection()`, `streakApi.getStreakStatus()`, `getScore()`, `getSpendingInsights()` — all real API calls.
- Near-U tab, Mall, Cash Store, Prive sections lazy-load from separate API services.
- **Issue DISC-1 (P0):** `app/brands.tsx` imports `getBrandsForCategory` and `getAllBrands` from `@/data/categoryDummyData`. This is a static local data file. No real API is called. Every brand shown on the Brands screen is fake data. The screen exists in the main navigation but silently shows fabricated content.
- **Issue DISC-2 (P1):** `app/occasions.tsx` imports `getOccasionsForCategory` and `getAllOccasions` from `@/data/categoryDummyData` as a fallback. When the API returns no occasions (empty array), the screen silently falls back to dummy occasions. Users see fabricated discount percentages.
- **Issue DISC-3 (P1):** `app/shop.tsx` uses `getVibesForCategory` and `getOccasionsForCategory` from `categoryDummyData`. No API call is made for the vibes or occasions sections.
- **Issue DISC-4 (P2):** `app/category/[slug]/index.tsx` imports `Brand` and `DummyProduct` types from `categoryDummyData`. Even if the screen makes real API calls, it is typed against dummy shapes — mismatch risk.

### 3.3 Order Flow

**Two distinct order flows exist:**

**A) Web QR Ordering (`app/order/[storeSlug]/`):**
- Customer scans QR → `app/order/[storeSlug]/index.tsx` fetches menu via `webOrderingApi.fetchWebStore()`.
- Cart is local state, passed via router params to `app/order/[storeSlug]/checkout.tsx`.
- After payment verification, routes to `app/order/[storeSlug]/confirmation.tsx` which polls order status every 15s.
- **Status:** Connected end-to-end.

**B) Standard product/cart orders:**
- Cart managed via `CartContext` backed by `cartApi`.
- Checkout creates order via `ordersApi.createOrder()` (POST `/orders`) with idempotency key.
- **Status:** Connected.

**Issues:**
- **Issue ORD-1 (P1):** `ordersApi.getOrders()` normalizes pagination fields (`current`/`pages` from `page`/`totalPages`) on line 298. However, the mapping is applied to `response.data.pagination` mutably, which modifies the cached TanStack Query response object. If the same response object is reused from cache, the normalization runs again on already-normalized data, always resulting in correct output but with side-effect mutation on cached data.
- **Issue ORD-2 (P2):** The order confirmation screen (`app/order/[storeSlug]/confirmation.tsx`) polls every 15 seconds indefinitely for all statuses including `cancelled`. It should stop polling once a terminal status (`completed`, `cancelled`) is reached.

### 3.4 Payment Flow

**Razorpay integration present in:**
- `app/payment-razorpay.tsx` — general purpose payment screen
- `app/travel/hotels/checkout.tsx` — hotel-specific
- `app/try/coins.tsx`, `app/try/[trialId].tsx`, `app/try/bundles.tsx` — trial purchases
- `app/train/[id].tsx`, `app/bus/[id].tsx`, `app/flight/[id].tsx` — travel detail booking

**Issues:**
- **Issue PAY-1 (P0):** Razorpay `prefill` is sent with empty strings for `contact` and `email` in `app/travel/hotels/checkout.tsx` line 122 (`prefill: { contact: '', email: '' }`), `app/try/coins.tsx` line 109, `app/try/[trialId].tsx` line 140, and `app/try/bundles.tsx` line 109. Razorpay uses prefill data to pre-populate the payment sheet and to send payment receipts. Sending empty strings means the user gets no receipt and the payment sheet shows blank name/phone fields — bad UX and a support liability.

- **Issue PAY-2 (P1):** `app/payment-razorpay.tsx` line 105 has a comment: `'Payment ReturnType<typeof setTimeout>'` — this is a TypeScript artifact in a string literal inside `platformAlertConfirm(`. The alert title shown to the user is literally `"Payment ReturnType<typeof setTimeout>"` when a payment times out.

- **Issue PAY-3 (P1):** `paymentOrchestratorService.ts` reads `ENABLE_RAZORPAY = process.env.EXPO_PUBLIC_ENABLE_RAZORPAY === 'true'`. If this env var is not set (absent), Razorpay is disabled at the orchestrator level. Since there is no `.env` file in the repo, this variable being unset would silently disable all Razorpay payments through the orchestrator flow, with no error shown to the user.

- **Issue PAY-4 (P2):** `tryApi.ts` line 28: `const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK_TRY === 'true' || __DEV__`. In any development build (`__DEV__ === true`), ALL Try-and-Buy API calls use mock data regardless of whether `EXPO_PUBLIC_USE_MOCK_TRY` is set. This means payments in the Try flow are always fake in development, which could mask integration bugs before production.

### 3.5 Wallet/Coins Flow

**Status:** Well-connected. Issues:

- **Issue WALL-1 (P1):** `WalletContext.tsx` only fetches wallet data when `authUser.isOnboarded === true` (line 305). Users who are authenticated but have not completed onboarding will see zero balance with no loading indicator and no explanation. This is a silent failure — onboarding is not always enforced before wallet access.

- **Issue WALL-2 (P1):** `walletApi.getBalance()` returns type `ApiResponse<WalletBalanceResponse>` but the call in `WalletContext` casts the result as `RawWalletBackendData`. These two types have different shapes (e.g., `WalletBalanceResponse.balance.total` vs `RawWalletBackendData.totalValue`). The `transformWalletResponse()` function handles both shapes with fallback chains, but the type mismatch means TypeScript does not enforce consistency. A backend schema change that breaks one branch will not be caught at compile time.

- **Issue WALL-3 (P2):** `walletApi.getTransactions()` is called with `filters as any` — all type safety on transaction filter parameters is lost. Invalid filter keys will be silently sent to the backend and ignored, with no error to the developer.

- **Issue WALL-4 (P2):** `redeemCoins` in `walletApi.ts` accepts a minimum of 50 coins and maximum of 500 (per JSDoc comment). These limits are not enforced client-side — a user could attempt to redeem 1 coin or 10,000 coins, which will fail at the backend with an opaque error. The screen should validate before calling.

### 3.6 QR Check-in

**File:** `app/qr-checkin.tsx`

**Flow:** Deep link `rezapp://checkin?storeId=XYZ` → screen opens with `storeId` param → fetches store name → user enters amount → POST `/qr-checkin` → success card with earned coins.

**Issues:**
- **Issue QR-1 (P0):** The store name lookup in `useEffect` (line 35-40) calls `apiClient.get('/qr-checkin/store/${storeId}')`. The `apiClient.get()` wrapper unwraps `responseData.data` into `response.data`. Then the component reads `(r as any).data?.data?.name`. This is a double-unwrap: `apiClient.data` already is `backendResponse.data`, so `r.data.data.name` reads `backendResponse.data.data.name` which is `undefined`. **Store name always shows as blank** when arriving from a deep link or QR scan.

- **Issue QR-2 (P1):** If `storeId` is empty string (user manually navigated to screen without scanning), the `handleSubmit` validation (`if (!storeId || isNaN(amt) || amt <= 0)`) will show an Alert but the error message is just `'Enter a valid amount'` — it should distinguish between "missing store" and "invalid amount."

- **Issue QR-3 (P2):** The screen has no camera/QR scanner UI. The deep link handler in `_layout.tsx` accepts `rezapp://checkin?storeId=XYZ` and routes to this screen. But there is no in-app QR scanner on the check-in screen itself. If users arrive at the screen without scanning a QR code (e.g., tapped a shortcut), there is no way to scan a QR from within the screen.

### 3.7 Travel Bookings (Hotels/Flights/Cabs/Trains)

#### Hotels (OTA Integration)
**Status:** Connected. `hotelOtaApi.ts` talks to a separate Hotel OTA service via `EXPO_PUBLIC_HOTEL_OTA_URL`.

**Issues:**
- **Issue HOT-1 (P1):** `hotelOtaApi.ts` stores OTA JWT in `AsyncStorage` (not SecureStore) using key `@ota_access_token`. On Android this is unencrypted storage. Financial/booking tokens should use `expo-secure-store`.
- **Issue HOT-2 (P1):** SSO in `_layout.tsx` (line 262) calls `rezSsoLogin(rezToken[1])` non-blocking, but there is no retry if it fails. If the OTA SSO call fails (Render cold start, network glitch), the user will silently have no OTA token. The hotel list will fail or return unauthenticated results with no feedback.
- **Issue HOT-3 (P2):** `app/travel/hotels/checkout.tsx` hard-codes `image: 'https://rez-app.in/logo.png'` in the Razorpay options (line 116). This domain may not be reachable in all environments. Should use a hosted asset URL from config.

#### Flights
**Status:** Broken for real booking.

`app/flight/[id].tsx` calls `productsApi.getProductById(id)` (GET `/products/:id`). The flight detail page then parses specifications array fields to reconstruct route, airline, and seat class information. This architecture works only if the backend stores flight products in the catalog with specific specification keys (`routeFrom`, `routeTo`, etc.). There is no standalone flight search, no real-time fare check, no seat map, and no actual booking API call for flights.

- **Issue FLT-1 (P0):** No actual flight booking API is called. The `FlightBookingFlow` component manages booking state locally. When the user "books," it either navigates to `payment-razorpay.tsx` or shows a confirmation modal — but there is no API call to a flight booking service to create a booking record on the backend.

#### Trains
- **Issue TRN-1 (P0):** Same architecture as flights. `train/[id].tsx` uses `productsApi.getProductById()`. No train booking API is called. The `TrainBookingFlow` component collects data but there is no evidence of a train booking service call.

#### Buses/Cabs
- **Issue BUS-1 (P0):** Same architecture. `bus/[id].tsx` and `cab/[id].tsx` use `productsApi`. No dedicated booking API.

---

## 4. State Management Audit

### 4.1 Context Providers Present

| Context | Purpose | Status |
|---|---|---|
| `AuthContext` | Auth state, token management | Good — Zustand fallback present |
| `WalletContext` | Wallet/coins data | Good — split data/loading contexts |
| `CartContext` | Shopping cart | Good — local state + backend sync |
| `ProfileContext` | User profile | Good — Zustand fallback present |
| `LocationContext` | User location | Present |
| `NotificationContext` | Notification state | Present |
| `WishlistContext` | User wishlist | Present |
| `SocketContext` | WebSocket connection | Present |
| `GamificationContext` | Gamification state | Present |
| `SubscriptionContext` | Subscription tier | Present |
| `CategoryContext` | Category data | Present |
| `OffersContext` | Offers data | Present |
| `ThemeContext` | Dark/light mode | Present |
| `ToastContext` | Toast messages | Present |
| `AppContext` | App-wide state | Present |
| `SecurityContext` | Security/fraud | Present |
| `PriveContext` | Prive premium tier | Present |
| `HomeTabContext` | Home tab selection | Present |
| `ComparisonContext` | Product comparison | Present |
| `RecommendationContext` | AI recommendations | Present |
| `RegionContext` | Geo region | Present |
| `ShimmerContext` | Skeleton loading | Present |
| `SocialContext` | Social features | Present |
| `GreetingContext` | Greeting messages | Present |
| `OfflineQueueContext` | Offline queue | Present |
| `RewardPopupContext` | Reward popups | Present |
| `AppPreferencesContext` | User preferences | Present |
| `OffersThemeContext` | Offers theming | Present |
| `LazyContexts` | Deferred context init | Present |

**Missing contexts:**
- No `OrderContext` — order state is managed locally per-screen with `useOrderHistory` hook.
- No `BookingContext` — booking state is passed via router params.

### 4.2 State Management Issues

- **Issue STATE-1 (P1):** `AuthContext` and `WalletContext` both sync to Zustand stores via `_setFromProvider`. This dual-store pattern means the same state exists in two places. If the Zustand store is read by a component before the sync effect runs (on first render), the component sees the initial/empty Zustand state, not the context state. The `useWalletContext()` hook handles this with a fallback, but there is no guarantee the fallback data is current.

- **Issue STATE-2 (P2):** `CartContext` stores cart to `AsyncStorage` on every cart mutation. With `devLog.warn` messages around storage quota, there is logic to truncate the cart to 20 items when storage is full. This truncation is silent to the user — items are removed from the visible cart without any notification.

- **Issue STATE-3 (P2):** `WalletContext` uses a module-level `_walletPending` and `_walletLastFetch` variable. These survive component remounts but also survive hot reloads in development, potentially causing stale cache during development.

---

## 5. Push Notifications & Deep Links

### 5.1 Push Notifications

**Service:** `services/pushNotificationService.ts` using `expo-notifications`.

- Token registration: POST `/notifications/register-token` — connected.
- Android notification channels: `default`, `orders`, `promotions`, `security` — configured.
- Foreground notification data-refresh callbacks: wired via `addDataRefreshListener()`.
- Background notification response → `router.push(data.route)` — wired in `_layout.tsx`.

**Issues:**
- **Issue PUSH-1 (P1):** Push token registration sends an empty `registerTokenWithBackend` response body to lines 174-177 — the success block is empty (`if (response.success) { }`) and the failure block is also empty. No logging, no retry. If registration fails silently, the user never receives push notifications and there is no fallback.

- **Issue PUSH-2 (P1):** `pushNotificationService.initialize()` uses `Constants.expoConfig?.extra?.eas?.projectId` for the Expo push token. If `eas.projectId` is not set in `app.json`/`app.config.js`, `getExpoPushTokenAsync()` throws. This is not caught gracefully — the catch block on line 110 just returns `null` silently.

- **Issue PUSH-3 (P2):** `services/earningsNotificationService.ts` line 78 hard-codes `projectId: '58b80355-a254-4d4a-80ce-d2bc3272b144'`. This is a hardcoded Expo project ID. If the project is ever re-registered or the ID changes, this breaks silently. It should read from `Constants.expoConfig?.extra?.eas?.projectId`.

### 5.2 Deep Links

- Scheme `rezapp://` handled in `_layout.tsx` via `Linking.addEventListener`.
- Cold-start URL handled via `Linking.getInitialURL()`.
- Notification-tapped links handled via `addNotificationResponseReceivedListener`.

**Handled routes:**
- `rezapp://invite?code=ABC` → stores referral code, applies if authenticated.
- `rezapp://checkin?storeId=XYZ` → routes to QR check-in screen.
- `rezapp://<path>` → generic route push.

**Issues:**
- **Issue DL-1 (P1):** The generic deep link handler `router.push(\`/\${path}\` as any)` will push any arbitrary path. If a maliciously crafted deep link sends `rezapp://delete-account`, it would navigate to the delete account screen without user intent. There is no allowlist of routable deep link paths.
- **Issue DL-2 (P2):** The referral code `POST /referral/apply` is fire-and-forget with `await AsyncStorage.removeItem('rez_pending_referral')` called on success. If the network call succeeds but `removeItem` fails, the referral code is applied twice on the next app open (the backend's idempotency handling for referrals is unknown).

---

## 6. Hardcoded Data Issues

| Location | Data Type | Severity |
|---|---|---|
| `app/brands.tsx` line 13 | All brand data (names, cashback %, logos, tags) from `@/data/categoryDummyData` | P0 — entire screen is fake |
| `app/shop.tsx` line 29 | Vibes and occasions from `categoryDummyData` | P1 |
| `app/occasions.tsx` line 23 | Fallback occasions from `categoryDummyData` | P1 |
| `app/category/[slug]/index.tsx` line 33 | `DummyProduct` type imported — risk of dummy data leaking in | P2 |
| `app/games/trivia.tsx` line 32 | `HARDCODED_QUESTIONS` — 7 trivia questions baked in as fallback | P2 |
| `app/travel/hotels/checkout.tsx` line 116 | Razorpay `image` URL hardcoded to `https://rez-app.in/logo.png` | P2 |
| `app/rez-cash.tsx` line 37-42 | Voucher redemption options (Amazon Pay, Flipkart, Zomato) hardcoded with `available: false` for bank transfer | P2 |
| `app/checkout/emi-selection.tsx` line 102 | "Fallback to hardcoded list" comment on EMI plans | P2 |
| `app/subscription/plans.tsx` line 342 | "Prices may vary disclaimer for hardcoded fallback prices" — some subscription prices hardcoded | P1 |
| `services/earningsNotificationService.ts` line 78 | Expo project ID hardcoded | P1 |
| `services/tryApi.ts` line 28 | `USE_MOCK = ... || __DEV__` — all Try API calls are mocked in development | P2 |
| `services/razorpayService.ts` line 162 | Cloudinary image URL uses `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` — if unset, broken URL | P2 |
| `app/payment-razorpay.tsx` line 105 | Alert title is `"Payment ReturnType<typeof setTimeout>"` — TypeScript artifact in string | P0 |

---

## 7. TypeScript Issues

- **`as any` casts:** 2,009 total occurrences across 184 service files (from grep count). This is extremely high and indicates systemic type safety bypass.
- **`data: null as any`** pattern used in almost every API service error return — breaks type narrowing on the `data` field.
- **`as any`** on every `apiClient.post<any>()` call hides return type mismatches between what the backend returns and what the caller expects.
- **`as any`** on `router.push()` calls (travel navigation) bypasses Expo Router's typed navigation.
- **Dual `User` types:** `authApi.ts` exports both a local `User` interface and `UnifiedUser` from `@/types/unified`. Callers use whichever they import, leading to inconsistent user shapes across the codebase.

---

## 7. Priority Issues

### P0 — Showstopper / Production Broken

| # | Issue | Location | Description |
|---|---|---|---|
| P0-1 | QR Check-in store name always blank | `app/qr-checkin.tsx:37` | Double-unwrap of `apiClient` response — `r.data.data.name` is always `undefined` |
| P0-2 | Brands screen shows entirely fake data | `app/brands.tsx:13` | Pulls from `categoryDummyData` — no real API, no real brands shown |
| P0-3 | No flight booking API called | `app/flight/[id].tsx` | `FlightBookingFlow` collects data but never POSTs to a flight booking service |
| P0-4 | No train booking API called | `app/train/[id].tsx` | Same as flights — `TrainBookingFlow` has no backend call |
| P0-5 | No bus/cab booking API called | `app/bus/[id].tsx`, `app/cab/[id].tsx` | Same architecture — no booking service connected |
| P0-6 | Payment timeout alert shows `"Payment ReturnType<typeof setTimeout>"` | `app/payment-razorpay.tsx:105` | TypeScript artifact rendered as user-visible string |

### P1 — High Impact / Must Fix Before Launch

| # | Issue | Location | Description |
|---|---|---|---|
| P1-1 | Razorpay prefill empty — no receipt, blank payment sheet | `app/travel/hotels/checkout.tsx:122`, `app/try/*.tsx` | User name, phone, email not passed to Razorpay |
| P1-2 | Occasions/shop sections use dummy data as fallback | `app/occasions.tsx`, `app/shop.tsx` | Users see fabricated discount percentages |
| P1-3 | OTA auth token stored in AsyncStorage (not SecureStore) | `services/hotelOtaApi.ts:13` | OTA JWT unencrypted on Android |
| P1-4 | Silent OTA SSO failure on cold start — hotel screens fail silently | `app/_layout.tsx:262` | No retry, no error surfaced to user |
| P1-5 | Push notification registration failure is completely silent | `services/pushNotificationService.ts:174-177` | Empty success/failure blocks — no retry |
| P1-6 | Auth token refresh retried once — risks double-invalidation | `services/authApi.ts:354` | `maxRetries: 1` on refresh token call |
| P1-7 | Auth loading timeout comment says 8s but code is 30s | `contexts/AuthContext.tsx:626` | Stale comment; actual 30s timeout blocks splash |
| P1-8 | `EXPO_PUBLIC_ENABLE_RAZORPAY` absent → Razorpay silently disabled | `services/paymentOrchestratorService.ts:18` | No `.env` file in repo — Razorpay off by default |
| P1-9 | Wallet not loaded for non-onboarded authenticated users | `contexts/WalletContext.tsx:305` | `isOnboarded` gate silently hides balance |
| P1-10 | Order polling never terminates on terminal statuses | `app/order/[storeSlug]/confirmation.tsx` | Polls every 15s even after `completed`/`cancelled` |
| P1-11 | Hardcoded Expo project ID in earningsNotificationService | `services/earningsNotificationService.ts:78` | Will break on project re-registration |
| P1-12 | Subscription plan screen has hardcoded fallback prices | `app/subscription/plans.tsx:342` | Users may see wrong prices if API fails |

### P2 — Medium / Fix Before Full Launch

| # | Issue | Description |
|---|---|---|
| P2-1 | Deep link allowlist missing — any path can be deep-linked | Arbitrary route navigation from external links |
| P2-2 | `walletApi.getTransactionById()` calls singular endpoint — potential 404 | Plural vs. singular path mismatch risk |
| P2-3 | Auth timeout comment says 8s, is actually 30s | Stale comment causes confusion during debugging |
| P2-4 | `tryApi.ts` always mocks in `__DEV__` — masks integration bugs | Try-and-Buy payments always fake in dev |
| P2-5 | Referral code could be applied twice if `AsyncStorage.removeItem` fails | Double-credit risk |
| P2-6 | `redeemCoins` has no client-side validation of min/max | Opaque backend errors shown to user |
| P2-7 | `WalletContext` module-level dedup variables not reset on hot reload | Stale cache in development |
| P2-8 | Cart truncation (>20 items) is silent — items removed without notification | |
| P2-9 | `category/[slug]/index.tsx` imports `DummyProduct` type — leakage risk | |
| P2-10 | Hotel checkout hardcodes Razorpay logo to `rez-app.in` domain | |
| P2-11 | EMI plan fallback uses hardcoded list | |
| P2-12 | QR Check-in error message doesn't distinguish missing store vs. invalid amount | |
| P2-13 | `completeOnboarding()` does `useAuthStore.getState().state?.user?.id` — null chain risk | |
| P2-14 | 2,009 `as any` casts across 184 service files — systemic type safety bypass | |
| P2-15 | `walletApi.getTransactions()` sends `filters as any` — type safety lost | |
| P2-16 | No `.env` file in repo — developers must self-discover env vars | |
| P2-17 | `prive/campaigns/index.tsx` renders "Coming Soon" — zero functionality | |
| P2-18 | `games/trivia.tsx` hardcodes 7 questions as fallback | |

---

## Appendix: Key File Paths Referenced

- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/app/_layout.tsx` — root layout, deep links, onboarding guard
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/app/(tabs)/_layout.tsx` — tab navigator
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/app/qr-checkin.tsx` — QR check-in (has P0 data bug)
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/app/brands.tsx` — entirely dummy data (P0)
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/app/flight/[id].tsx` — no real flight booking API (P0)
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/app/travel/hotels/checkout.tsx` — Razorpay prefill empty (P1)
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/app/payment-razorpay.tsx` — alert title bug (P0)
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/contexts/AuthContext.tsx` — auth state, token management
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/contexts/WalletContext.tsx` — wallet state
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/services/apiClient.ts` — base HTTP client
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/services/authApi.ts` — auth endpoints
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/services/walletApi.ts` — wallet endpoints
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/services/hotelOtaApi.ts` — Hotel OTA service
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/services/pushNotificationService.ts` — push notifications
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/services/tryApi.ts` — Try-and-Buy (mocked in dev)
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/services/ordersApi.ts` — order management
- `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/services/cashbackApi.ts` — cashback endpoints
