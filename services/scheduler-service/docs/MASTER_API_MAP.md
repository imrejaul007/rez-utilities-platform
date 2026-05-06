# MASTER API MAP — REZ Platform

> Last updated: 2026-04-11
> Covers: REZ Backend Monolith + all rez-*-service microservices
> All paths are relative to the service root URL.

---

## Table of Contents

1. [rez-auth-service](#1-rez-auth-service)
2. [rez-wallet-service](#2-rez-wallet-service)
3. [rez-payment-service](#3-rez-payment-service)
4. [rez-finance-service](#4-rez-finance-service)
5. [rez-search-service](#5-rez-search-service)
6. [rez-merchant-service](#6-rez-merchant-service)
7. [rez-marketing-service](#7-rez-marketing-service)
8. [rez-ads-service](#8-rez-ads-service)
9. [rez-gamification-service](#9-rez-gamification-service-worker-only)
10. [rez-order-service](#10-rez-order-service-worker-only)
11. [REZ Backend Monolith — Consumer Routes](#11-rez-backend-monolith--consumer-routes)
12. [REZ Backend Monolith — Merchant Routes](#12-rez-backend-monolith--merchant-routes)
13. [REZ Backend Monolith — Admin Routes](#13-rez-backend-monolith--admin-routes)

---

## Service Base URLs

| Service | Render URL | Port (local) |
|---------|-----------|--------------|
| rez-auth-service | https://rez-auth-service.onrender.com | 4002 |
| rez-wallet-service | https://rez-wallet-service-36vo.onrender.com | 4004 |
| rez-payment-service | https://rez-payment-service.onrender.com | 4001 |
| rez-finance-service | https://rez-finance-service.onrender.com | 4003 |
| rez-search-service | https://rez-search-service.onrender.com | 4006 |
| rez-merchant-service | https://rez-merchant-service-n3q2.onrender.com | 4005 |
| rez-marketing-service | https://rez-marketing-service.onrender.com | 4000 |
| rez-ads-service | Not deployed | 4007 |
| rez-gamification-service | https://rez-gamification-service-3b5d.onrender.com | 4008 |
| rez-order-service | Not on Render | 4005 |
| REZ Backend (monolith) | https://api.rezapp.com | 5000 |

---

## 1. rez-auth-service

**File:** `rez-auth-service/src/routes/authRoutes.ts`

| Method | Path (both aliases) | Auth | Handler Function | Notes |
|--------|---------------------|------|-----------------|-------|
| POST | `/auth/otp/send` / `/api/user/auth/send-otp` | None | `sendOTPHandler` | Rate limited (3/min per phone + 5/15min per IP). Returns `hasPIN` flag |
| POST | `/auth/otp/verify` / `/api/user/auth/verify-otp` | None | `verifyOTPHandler` | Rate limited. Creates user if new. Returns JWT tokens |
| POST | `/auth/login-pin` / `/api/user/auth/login-pin` | None | `loginPinHandler` | PIN lockout after 5 failures (15 min) |
| GET | `/auth/has-pin` / `/api/user/auth/has-pin` | None | `hasPinHandler` | Query: `?phone=&countryCode=` |
| POST | `/auth/set-pin` / `/api/user/auth/set-pin` | Bearer JWT | `setPinHandler` | Common PINs rejected |
| POST | `/auth/complete-onboarding` / `/api/user/auth/complete-onboarding` | Bearer JWT | `completeOnboardingHandler` | Sets `auth.isOnboarded=true` |
| POST | `/auth/refresh` / `/api/user/auth/refresh` | None | `refreshHandler` | Body: `{ refreshToken }` |
| POST | `/auth/logout` / `/api/user/auth/logout` | Bearer JWT | `logoutHandler` | Revokes refresh token |
| POST | `/auth/admin/login` / `/api/admin/auth/login` | None | `adminLoginHandler` | Rate limited (admin limiter) |
| POST | `/auth/merchant/login` / `/api/merchant/auth/login` | None | `merchantLoginHandler` | Phone+OTP or email+password |
| GET | `/auth/me` / `/api/user/auth/me` | Bearer JWT | `getMeHandler` | Returns current user profile |
| POST | `/internal/auth/verify-token` | Internal token | `internalVerifyHandler` | Service-to-service token validation |
| POST | `/internal/auth/create-user` | Internal token | `internalCreateUserHandler` | Used by Hotel OTA for guest user creation |

---

## 2. rez-wallet-service

**File:** `rez-wallet-service/src/routes/walletRoutes.ts`, `merchantWalletRoutes.ts`, `internalRoutes.ts`, `payoutRoutes.ts`, `creditScore.ts`

### Consumer Wallet Routes (`walletRoutes.ts`)

All routes require Bearer JWT auth.

| Method | Path (both aliases) | Handler | Notes |
|--------|---------------------|---------|-------|
| GET | `/balance` / `/api/wallet/balance` | `getBalanceHandler` | Returns coin balances by type |
| GET | `/transactions` / `/api/wallet/transactions` | `getTransactionsHandler` | Paginated. Query: `?page&limit&coinType` |
| GET | `/summary` / `/api/wallet/summary` | `getSummaryHandler` | Aggregated transaction summary |
| POST | `/credit` / `/api/wallet/credit` | `creditHandler` | Admin roles only |
| POST | `/debit` / `/api/wallet/payment` | `debitHandler` | Rate limited: 10/min |
| POST | `/welcome-coins` / `/api/wallet/welcome-coins` | `welcomeCoinsHandler` | 50 nuqta coins, idempotent per user |
| GET | `/conversion-rate` / `/api/wallet/conversion-rate` | `conversionRateHandler` | Returns COIN_TO_RUPEE_RATE |

### Internal Routes (`internalRoutes.ts`)

All routes require `x-internal-token` header.

| Method | Path | Notes |
|--------|------|-------|
| POST | `/internal/credit` | Credit coins to any user. Called by payment/order services |
| POST | `/internal/debit` | Debit coins from any user |
| POST | `/internal/merchant-credit` | Credit merchant wallet |
| GET | `/internal/balance/:userId` | Get user wallet balance |
| GET | `/internal/reconcile` | Wallet reconciliation (capped at 100 wallets) |
| POST | `/internal/transfer` | Internal coin transfer between users |

### Merchant Wallet Routes (`merchantWalletRoutes.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/merchant/wallet/balance` | Bearer JWT (merchant) | Merchant coin balance |
| GET | `/api/merchant/wallet/transactions` | Bearer JWT (merchant) | Merchant transactions |
| POST | `/api/merchant/wallet/withdraw` | Bearer JWT (merchant) | Initiate payout |

### Payout Routes (`payoutRoutes.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/wallet/payout/request` | Bearer JWT | Request payout to bank |
| GET | `/api/wallet/payout/history` | Bearer JWT | Payout history |

### Credit Score Routes (`creditScore.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/wallet/credit-score` | Bearer JWT | ReZ credit score |

---

## 3. rez-payment-service

**File:** `rez-payment-service/src/routes/paymentRoutes.ts`

| Method | Path (both aliases) | Auth | Handler Function | Notes |
|--------|---------------------|------|-----------------|-------|
| POST | `/pay/initiate` / `/api/payment/initiate` | Bearer JWT | `initiateHandler` | Only `purpose='order'` allowed on public route |
| POST | `/pay/capture` / `/api/payment/capture` | Bearer JWT | `captureHandler` | Replay prevention via Redis nonce (25h TTL) |
| POST | `/pay/refund` / `/api/payment/refund` | Bearer JWT | `refundHandler` | merchant/admin/operator roles only |
| GET | `/pay/status/:paymentId` / `/api/payment/status/:orderId` | Bearer JWT | `statusHandler` | Returns payment + audit trail |
| POST | `/pay/verify` / `/api/razorpay/verify-payment` | Internal token | `verifyHandler` | INTERNAL ONLY — signature oracle risk if user-facing |
| GET | `/api/razorpay/config` | Bearer JWT | `razorpayConfigHandler` | Returns `key_id` for client SDK |
| POST | `/api/razorpay/create-order` | Bearer JWT | `createRazorpayOrderHandler` | Validates authoritative order amount |
| POST | `/pay/webhook/razorpay` / `/api/payment/webhook/razorpay` | None (HMAC sig) | `webhookHandler` | Raw body, HMAC verified. Events: `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed` |
| GET | `/pay/merchant/settlements` / `/api/payment/merchant/settlements` | Bearer JWT (merchant) | `settlementsHandler` | Paginated |
| POST | `/internal/pay/deduct` | Internal token | — | Called by orchestrator |
| GET | `/internal/pay/:paymentId` | Internal token | — | Payment lookup by other services |

---

## 4. rez-finance-service

**File:** `rez-finance-service/src/routes/`

### Borrow Routes (`borrowRoutes.ts`) — prefix: `/finance/borrow`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/finance/borrow/offers` | JWT | Pre-approved loan/card offers (FinBox integration) |
| POST | `/finance/borrow/apply` | JWT | Apply for loan/card. Body: `{ partnerOfferId, amount, tenure, context }` |
| GET | `/finance/borrow/applications` | JWT | User's applications |
| GET | `/finance/borrow/applications/:id` | JWT | Single application |
| POST | `/finance/borrow/bnpl/check` | JWT | BNPL eligibility check |
| POST | `/finance/borrow/bnpl/create` | JWT | Create BNPL order |

### Credit Routes (`creditRoutes.ts`) — prefix: `/finance/credit`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/finance/credit/score` | JWT | ReZ score + loan eligibility |
| POST | `/finance/credit/score/check` | JWT | Trigger check + earn coins (once/day) |
| POST | `/finance/credit/score/refresh` | JWT | Force refresh score |

### Pay Routes (`payRoutes.ts`) — prefix: `/finance/pay`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/finance/pay/billers` | JWT | Static biller catalog (Phase 1 stub) |
| POST | `/finance/pay/bill` | JWT | Pay a bill. Creates PENDING tx (no coins yet, Phase 1) |
| POST | `/finance/pay/recharge` | JWT | Mobile/FASTag recharge. Creates PENDING tx |
| GET | `/finance/pay/transactions` | JWT | User's bill/recharge history |

### Partner Routes (`partnerRoutes.ts`) — prefix: `/finance/partner`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/finance/partner/webhook/finbox` | HMAC sig | FinBox webhook for offer refresh |

### Internal Routes (`internalRoutes.ts`) — prefix: `/finance/internal`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/finance/internal/user-summary/:userId` | Internal token | Summary consumed by search/order services |

---

## 5. rez-search-service

**File:** `rez-search-service/src/routes/`

| Method | Path | Auth | Handler File | Notes |
|--------|------|------|-------------|-------|
| GET | `/search/stores` | Optional JWT | `searchRoutes.ts` | Store search with filters |
| GET | `/search/products` | Optional JWT | `searchRoutes.ts` | Product search |
| GET | `/search/global` | Optional JWT | `searchRoutes.ts` | Cross-entity search |
| GET | `/homepage` | Optional JWT | `homepageRoutes.ts` | Personalized homepage data |
| GET | `/homepage/stores` | Optional JWT | `homepageRoutes.ts` | Homepage store carousel |
| GET | `/recommendations` | Optional JWT | `recommendationRoutes.ts` | Personalized recommendations |
| GET | `/history/searches` | JWT | `historyRoutes.ts` | User search history |
| DELETE | `/history/searches` | JWT | `historyRoutes.ts` | Clear search history |

---

## 6. rez-merchant-service

**File:** `rez-merchant-service/src/routes/` (85+ route files)

Routes are organized by domain routers in `src/routers/`: `core`, `orders`, `engagement`, `campaigns`, `analytics`, `finance`, `staff`, `operations`, `support`.

### Core Domain

| Method | Path prefix | File | Notes |
|--------|-------------|------|-------|
| GET/POST/PUT | `/merchants/*` | `routes/merchants.ts` | Merchant profile CRUD |
| GET/POST/PUT | `/profile/*` | `routes/profile.ts` | Store profile |
| GET/POST/PUT | `/stores/*` | `routes/stores.ts` | Store management |
| GET/POST/PUT | `/auth/*` | `routes/auth.ts` | Merchant authentication |
| GET/POST | `/onboarding/*` | `routes/onboarding.ts` | Onboarding flow |
| GET/POST/PUT | `/products/*` | `routes/products.ts` | Product catalog |
| GET/POST/PUT | `/variants/*` | `routes/variants.ts` | Product variants |

### Orders Domain

| Method | Path prefix | File | Notes |
|--------|-------------|------|-------|
| GET/PUT | `/orders/*` | `routes/orders.ts` | Order management. NOTE: `/stats/summary` must precede `/:id` |
| GET | `/orders/stats/summary` | `routes/orders.ts` | Order statistics — **fixed route ordering bug** |

### Analytics Domain

| Method | Path prefix | File | Notes |
|--------|-------------|------|-------|
| GET | `/analytics/*` | `routes/analytics.ts` | Store analytics |
| GET | `/dashboard/*` | `routes/dashboard.ts` | Dashboard KPIs |
| GET | `/roi/*` | `routes/roi.ts` | ROI analysis |
| GET | `/campaign-roi/*` | `routes/campaignROI.ts` | Campaign ROI |
| GET | `/customer-insights/*` | `routes/customerInsights.ts` | Customer analytics |

### Finance Domain

| Method | Path prefix | File | Notes |
|--------|-------------|------|-------|
| GET/POST | `/payouts/*` | `routes/payouts.ts` | Payout requests |
| GET/POST | `/expenses/*` | `routes/expenses.ts` | Expense tracking |
| GET/POST | `/khata/*` | `routes/khata.ts` | Khata (credit book) |
| GET/POST | `/gst/*` | `routes/gst.ts` | GST management |
| GET | `/liability/*` | `routes/liability.ts` | Merchant liability |
| GET/POST | `/bizdocs/*` | `routes/bizdocs.ts` | Business documents |

### Engagement/Marketing

| Method | Path prefix | File | Notes |
|--------|-------------|------|-------|
| GET/POST | `/discounts/*` | `routes/discountRules.ts` | Discount rules |
| GET/POST | `/offers/*` | `routes/offers.ts` | Offers |
| GET/POST | `/campaigns/*` | `routes/campaignRules.ts` | Campaign rules |
| GET/POST | `/loyalty-tiers/*` | `routes/loyaltyTiers.ts` | Loyalty tiers |
| GET/POST | `/stamp-cards/*` | `routes/stampCards.ts` | Stamp card programs |
| GET/POST | `/gift-cards/*` | `routes/giftCards.ts` | Gift cards |
| GET/POST | `/broadcasts/*` | `routes/broadcasts.ts` | Customer broadcasts |
| GET/POST | `/cashback/*` | `routes/cashback.ts` | Cashback configuration |

### Operations

| Method | Path prefix | File | Notes |
|--------|-------------|------|-------|
| GET/POST | `/table-management/*` | `routes/tableManagement.ts` | Table/floor management |
| GET/POST | `/pos/*` | `routes/pos.ts` | POS billing |
| GET/POST | `/staff-shifts/*` | `routes/staffShifts.ts` | Staff shift management |
| GET/POST | `/inventory/*` | — | Inventory management |
| GET/POST | `/suppliers/*` | `routes/suppliers.ts` | Supplier management |
| GET/POST | `/purchase-orders/*` | `routes/purchaseOrders.ts` | Purchase orders |
| GET/POST | `/recipes/*` | `routes/recipes.ts` | Recipe management |
| GET/POST | `/waste/*` | `routes/waste.ts` | Waste tracking |

---

## 7. rez-marketing-service

**File:** `rez-marketing-service/src/routes/`

| Method | Path prefix | File | Auth | Notes |
|--------|-------------|------|------|-------|
| GET/POST/PUT/DELETE | `/campaigns/*` | `campaigns.ts` | Internal token | Campaign lifecycle |
| GET/POST | `/audience/*` | `audience.ts` | Internal token | Audience segmentation |
| GET | `/analytics/*` | `analytics.ts` | Internal token | Campaign analytics |
| GET/POST | `/keywords/*` | `keywords.ts` | Internal token | Keyword management |
| POST | `/webhooks/*` | `webhooks.ts` | HMAC | External webhook handlers |
| POST | `/broadcasts/*` | `broadcasts.ts` | Internal token | Broadcast scheduling |
| GET/POST | `/adbazaar/*` | `adbazaar.ts` | Internal token | AdBazaar integration routes |

Workers: `campaignWorker`, `interestSyncWorker`, `birthdayScheduler`

---

## 8. rez-ads-service

**File:** `rez-ads-service/src/routes/`

| Method | Path | File | Auth | Notes |
|--------|------|------|------|-------|
| GET/POST/PUT/DELETE | `/merchant/ads/*` | `merchant.ts` | Internal/merchant token | Merchant ad management |
| GET/POST/PUT | `/admin/ads/*` | `admin.ts` | Internal/admin token | Admin ad management |
| GET | `/ads/*` | `serve.ts` | None | Ad serving (public) |
| GET | `/health` | `index.ts` | None | Service health |

**Status:** Built but not deployed to Render. Port 4007.

---

## 9. rez-gamification-service (Worker only)

**File:** `rez-gamification-service/src/`

No public HTTP routes. Exposes health endpoint only.

| Type | Handler | Trigger | Notes |
|------|---------|---------|-------|
| BullMQ Worker | `achievementWorker.ts` | `gamification:achievement` queue | Achievement unlock processing |
| BullMQ Worker | `storeVisitStreakWorker.ts` | `gamification:streak` queue | Visit streak processing |
| Redis Sub | `gameConfigSubscription.ts` | Redis pubsub | Config change propagation |
| HTTP GET | `/health` | — | Health check only |

---

## 10. rez-order-service (Worker only)

**File:** `rez-order-service/src/`

HTTP server built (via `httpServer.ts`) but no routes deployed to Render.

| Type | Handler | Notes |
|------|---------|-------|
| BullMQ Worker | `worker.ts` | Order lifecycle processing |
| HTTP GET | `/health`, `/health/live`, `/health/ready` | Health endpoints |
| POST | `/internal/order/summary/:userId` | Internal — consumed by finance service |
| GET | `/internal/order/list` | Internal order listing |

**Status:** HTTP built, deploy to Render pending.

---

## 11. REZ Backend Monolith — Consumer Routes

**Base URL:** `https://api.rezapp.com/api`
**File:** `rezbackend/rez-backend-master/src/config/routes.ts`

### Authentication

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/send-otp` | None | OTP send |
| POST | `/api/auth/verify-otp` | None | OTP verify |
| POST | `/api/auth/login` | None | JWT login |
| POST | `/api/auth/refresh` | None | Token refresh |
| GET | `/api/auth/me` | JWT | Current user |

### User & Profile

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET/PUT | `/api/profile/*` | JWT | Profile management |
| GET/PUT | `/api/user/settings/*` | JWT | User settings |
| GET/POST/DELETE | `/api/addresses/*` | JWT | Address book |
| GET/POST | `/api/user/boot` | JWT | App boot data |

### Wallet & Payments (Monolith)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/wallet/balance` | JWT | Coin balance |
| GET | `/api/wallet/transactions` | JWT | Transaction history |
| POST | `/api/wallet/payment` | JWT | Pay with coins |
| POST | `/api/wallet/transfer/initiate` | JWT | Initiate transfer |
| POST | `/api/wallet/transfer/confirm` | JWT | Confirm transfer |
| POST | `/api/wallet/gift/send` | JWT | Send coins as gift |
| POST | `/api/wallet/gift/:id/claim` | JWT | Claim gift coins |
| GET | `/api/wallet/expiring-coins` | JWT | Expiring coin list |
| POST | `/api/wallet/welcome-coins` | JWT | Claim welcome coins |
| POST | `/api/razorpay/create-order` | JWT | Create Razorpay order |
| POST | `/api/razorpay/verify-payment` | JWT | Verify Razorpay signature |

### Orders

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/orders` | JWT | Create order |
| GET | `/api/orders` | JWT | Order history |
| GET | `/api/orders/:id` | JWT | Order detail |
| POST | `/api/orders/:id/cancel` | JWT | Cancel order |
| GET | `/api/orders/:id/track` | JWT | Track order |

### Search & Discovery

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/search/stores` | Optional JWT | Store search |
| GET | `/api/homepage` | Optional JWT | Homepage data |
| GET | `/api/explore` | Optional JWT | Explore page |
| GET | `/api/stores/:id` | Optional JWT | Store detail |
| GET | `/api/categories` | None | Category listing |

### Gamification

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/gamification/streaks` | JWT | All streaks |
| POST | `/api/gamification/streak/checkin` | JWT | Daily check-in |
| POST | `/api/gamification/streak/claim-milestone` | JWT | Claim milestone reward |
| GET | `/api/leaderboard` | JWT | Leaderboard |
| GET | `/api/achievements` | JWT | User achievements |
| GET | `/api/gamification/stats` | JWT | Gamification statistics |

### Rewards & Offers

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/offers` | Optional JWT | Offer listing |
| GET | `/api/offers/:id` | Optional JWT | Offer detail |
| GET | `/api/cashback` | JWT | Cashback history |
| GET | `/api/vouchers` | JWT | User vouchers |
| GET | `/api/coupons` | JWT | User coupons |
| GET | `/api/referral` | JWT | Referral info |
| POST | `/api/referral/apply` | JWT | Apply referral code |

### Services & Bookings

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/booking/table` | JWT | Table booking |
| POST | `/api/booking/consultation` | JWT | Consultation booking |
| POST | `/api/booking/appointment` | JWT | Service appointment |
| GET | `/api/booking/history` | JWT | Booking history |

### Web Ordering (QR/Menu)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/web-ordering/store/:storeSlug` | None | Store menu |
| POST | `/api/web-ordering/otp/send` | None | Guest OTP |
| POST | `/api/web-ordering/otp/verify` | None | Guest OTP verify |
| POST | `/api/web-ordering/razorpay/create-order` | Session token | Web order payment |
| POST | `/api/web-ordering/payment/verify` | Session token | Payment verify |
| GET | `/api/web-ordering/order/:orderNumber` | Session token | Order status |
| POST | `/api/web-ordering/bill/request` | None | Request bill at table |
| POST | `/api/web-ordering/coins/credit` | Session token | Credit web order coins |
| POST | `/api/web-ordering/coupon/validate` | Session token | Validate coupon |
| GET | `/api/web-ordering/coins/balance` | Session token | Guest coin balance |
| POST | `/api/web-ordering/order/:orderNumber/cancel` | Session token | Cancel web order |
| POST | `/api/web-ordering/cart/validate` | None | Validate cart |
| POST | `/api/web-ordering/receipt/send` | Session token | Send WhatsApp receipt to customer phone |
| PUT | `/api/web-ordering/order/:orderNumber/update-status` | Internal token | Update web order status (internal-only; use merchant route for merchant app) |

### Webhooks

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/webhooks/razorpay` | HMAC | Razorpay webhook |
| POST | `/api/webhooks/hotel-attribution` | Internal token | Hotel OTA booking events |
| POST | `/api/webhooks/travel` | HMAC | Travel aggregator |
| POST | `/api/webhooks/adbazaar` | HMAC | AdBazaar QR events |

---

## 12. REZ Backend Monolith — Merchant Routes

**Base URL:** `https://api.rezapp.com/api/merchant`

| Domain | Method | Path | Auth | File |
|--------|--------|------|------|------|
| Auth | POST | `/api/merchant/auth/login` | None | `merchantroutes/auth.ts` |
| Orders | GET/PUT | `/api/merchant/orders/*` | Merchant JWT | `routes/merchant/orders.ts` |
| Orders | GET | `/api/merchant/orders/stats/summary` | Merchant JWT | `routes/merchant/orders.ts` |
| Products | GET/POST/PUT/DELETE | `/api/merchant/products/*` | Merchant JWT | `merchantroutes/products.ts` |
| Store | GET/POST/PUT | `/api/merchant/stores/*` | Merchant JWT | `merchantroutes/stores.ts` |
| Dashboard | GET | `/api/merchant/dashboard/*` | Merchant JWT | `merchantroutes/dashboard.ts` |
| Analytics | GET | `/api/merchant/analytics/*` | Merchant JWT | `merchantroutes/analytics.ts` |
| Wallet | GET/POST | `/api/merchant/wallet/*` | Merchant JWT | `merchantroutes/wallet.ts` |
| Coins | GET/POST | `/api/merchant/coins/*` | Merchant JWT | `merchantroutes/coins.ts` |
| Cashback | GET/POST | `/api/merchant/cashback/*` | Merchant JWT | `merchantroutes/cashback.ts` |
| KDS | WS | `/kds` namespace | Merchant JWT | `config/socketSetup.ts` |
| QR | GET/POST | `/api/merchant/qr/*` | Merchant JWT | `routes/merchantQrRoutes.ts` |
| Payouts | GET/POST | `/api/merchant/payouts/*` | Merchant JWT | `merchantroutes/payouts.ts` |
| Team | GET/POST | `/api/merchant/team/*` | Merchant JWT | `merchantroutes/team.ts` |
| Khata | GET/POST | `/api/merchant/khata/*` | Merchant JWT | `merchantroutes/khata.ts` |
| GST | GET | `/api/merchant/gst/*` | Merchant JWT | `merchantroutes/gst.ts` |
| POS | POST | `/api/merchant/pos/*` | Merchant JWT | `merchantroutes/pos.ts` |
| Bulk Import | POST | `/api/merchant/bulk-import` | Merchant JWT | `merchantroutes/bulkImport.ts` |
| Web Orders | GET | `/api/merchant/web-orders` | Merchant JWT | `routes/merchant/webOrders.ts` — paginated list, filterable by storeId/status/date |
| Web Orders | GET | `/api/merchant/web-orders/:orderNumber` | Merchant JWT | `routes/merchant/webOrders.ts` — full detail with splits/tip |
| Web Orders | PATCH | `/api/merchant/web-orders/:orderNumber/status` | Merchant JWT | `routes/merchant/webOrders.ts` — advance order status; emits socket; sends WhatsApp when ready |

---

## 13. REZ Backend Monolith — Admin Routes

**Base URL:** `https://api.rezapp.com/api/admin`
**Auth:** Admin JWT + `requireAdmin` middleware

Key admin route groups (all under `/api/admin/*`):

| Domain | Path prefix | File | Notes |
|--------|-------------|------|-------|
| Dashboard | `/api/admin/dashboard` | `routes/admin/` | Platform KPIs |
| Users | `/api/admin/users` | `routes/admin/` | User management |
| Merchants | `/api/admin/merchants` | `routes/admin/merchants.ts` | Merchant management; list includes isProgramMerchant + estimatedPrepMinutes per store |
| Merchant Wallets | `/api/admin/merchant-wallets` | `routes/admin/` | Wallet overview, stats, transactions, withdrawals |
| Store Program | `PATCH /api/admin/stores/:id/program` | `routes/adminReviewStoreRoutes.ts` | Toggle isProgramMerchant + baseCashbackPercent |
| Store Settings | `PATCH /api/admin/stores/:id/settings` | `routes/adminReviewStoreRoutes.ts` | Set estimatedPrepMinutes (0–180 min) |
| Coins | `/api/admin/coin-rewards` | `routes/admin/` | Coin issuance |
| Wallet | `/api/admin/wallet` | `routes/admin/` | Wallet adjustments |
| Fraud | `/api/admin/fraud-*` | `routes/admin/` | Fraud queue, reports, config |
| Offers | `/api/admin/offers` | `routes/admin/` | Offer management |
| Campaigns | `/api/admin/campaigns` | `routes/admin/` | Campaign control |
| Features | `/api/admin/feature-flags` | `routes/admin/featureFlags.ts` | Feature flag toggle |
| Gamification | `/api/admin/achievements`, `/api/admin/game-config` | `routes/admin/` | Game config |
| Ads | `/api/admin/ads` | `routes/admin/` | Ad management |
| BBPS | `/api/admin/bbps-*` | `routes/admin/bbpsAdmin.ts`, `bbpsHealth.ts` | Bill payment system |
| OTA | `/api/admin/ota` | `routes/admin/otaAdmin.ts` | Hotel OTA oversight |
| Bullboard | `/api/admin/queues` | `routes/admin/bullboard.ts` | BullMQ monitor UI |
| Audit Log | `/api/admin/audit-log` | `routes/admin/` | Admin action audit trail |
