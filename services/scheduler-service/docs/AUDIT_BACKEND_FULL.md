# Backend API Full Audit Report

**Audit Date:** 2026-04-10  
**Audited Path:** `rezbackend/rez-backend-master/src/`  
**Auditor:** Code Quality Analyzer  

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Route files (user) | ~115 |
| Route files (admin) | ~95 |
| Route files (merchant) | ~80 |
| Controller files | ~120+ |
| Service files | ~100+ |
| Middleware files | 44 |
| Model files | ~120+ |
| **Critical (P0) issues** | **9** |
| **High (P1) issues** | **18** |
| **Medium (P2) issues** | **22** |

### Critical Issues Bullet Summary

- **SECURITY CRITICAL:** `firebase-service-account.json` with a real RSA private key exists in the repository at `rezbackend/rez-backend-master/firebase-service-account.json`. It is in `.gitignore` but is present on disk — if it has ever been committed, the key is compromised.
- **ROUTE CONFLICT:** Both `adminBbpsHealthRoutes` and `adminBbpsRoutes` are mounted at the identical prefix `/api/admin/bbps` — whichever is registered last will shadow handlers from the first.
- **ROUTE SHADOW:** `platformStatsAdminRoutes` defines `router.get('/')` and is mounted at `/api/admin` (no suffix path) — creates an unscoped `GET /api/admin/` that could silently shadow the admin dashboard root.
- **MISSING ENV VAR in validateEnv:** `INTERNAL_SERVICE_KEY` is referenced in code across 15+ files but is NOT in the `REQUIRED_ENV_VARS` or `RECOMMENDED_ENV_VARS` list in `validateEnv.ts` — can silently be empty, breaking all inter-service broadcast calls.
- **MISSING MODEL:** `FraudFlag` model is dynamically looked up via `mongoose.models['FraudFlag']` in `ReferralAbuseDetector.ts` but no model file defines it — `storeFraudFlag()` silently fails every time in production.
- **ADMIN ROUTE NOT PROTECTED:** `lockDealRoutes.ts` line ~105 has a comment `// Should be requireAdmin in production` but uses `requireAuth` for the admin-only cron endpoint `POST /lock-deals/process-expired` — any authenticated user can trigger this.
- **DEAD MERCHANT ROUTES:** 60+ merchant route files are imported in `routes.ts` but all are commented out — all merchant functionality is supposedly proxied to `rez-merchant-service`. Only 3 merchant routes remain active in the monolith (`/api/merchants`, `/api/merchant/qr`, `/api/merchant/invoices`, `/api/merchant/subscription`) — no validation that nginx actually routes correctly.
- **TWO-VARIABLE NAMING MISMATCH:** `INTERNAL_SERVICE_TOKEN` (used in `internalAuth.ts` and `validateEnv.ts`) vs `INTERNAL_SERVICE_KEY` (used in all broadcast/marketing service calls) — these are two separate env vars. `INTERNAL_SERVICE_KEY` is never validated at startup.
- **`savingsGoalRoutes.ts` has NO auth middleware inside the router** — relies entirely on the caller (`routes.ts` line 957) passing `authTokenMiddleware`. If the mounting order ever changes, or if the route is added to another mount point, all goal endpoints become unauthenticated.

---

## 1. Routes Audit

### 1.1 Missing / Broken Handlers

All primary controller files exist. No hard "file not found" import errors detected. The following are confirmed edge cases or soft breaks:

| Route File | Handler / Import | Issue |
|---|---|---|
| `routes/admin/corporate.ts` | `Corporate`, `CorporateMember` models | Models exist but this route is mounted at `/api/admin` with no dedicated prefix (only `adminCorporateRoutes`). Routes inside define `/corporate`, `/corporate/:id` — correct. No issue. |
| `services/ReferralAbuseDetector.ts` | `FraudFlag` model | Uses `mongoose.models['FraudFlag']` dynamic lookup — **model file does not exist**. Every call to `storeFraudFlag()` silently skips. |
| `routes/lockDealRoutes.ts:105` | `processExpiredLocks` | Admin-only endpoint protected only by `requireAuth`. Any consumer JWT can call `POST /api/lock-deals/process-expired`. |
| `routes/admin/platformStats.ts` | `GET /` | Mounted at `/api/admin` with no sub-path — creates `GET /api/admin` root conflict. |
| `routes/admin/bbpsAdmin.ts` + `bbpsHealth.ts` | Both mounted at `/api/admin/bbps` | Route conflict — handlers in first-mounted file may be shadowed by second. |

### 1.2 Routes Missing Auth Middleware

| Route | Mount Path | Auth Status | Risk |
|---|---|---|---|
| `lockDealRoutes.ts` POST `/process-expired` | `/api/lock-deals/process-expired` | `requireAuth` only (any user) | HIGH — admin-only cron endpoint exposed to all users |
| `savingsGoalRoutes.ts` entire router | `/api/goals` | No middleware inside router; depends on mount-site injection | MEDIUM — fragile; one refactor away from unauth |
| `playEarnRoutes.ts` | `/api/play-earn` | `optionalAuth` only | LOW — intentionally public, but verify business intent |
| `bonusZoneRoutes.ts` | `/api/bonus-zone` | `requireAuth` via router.use — OK | OK |
| `adBazaarIntegrationRoutes` | `/api/adbazaar` | Internal x-internal-key check in route logic | MEDIUM — `INTERNAL_SERVICE_KEY` not validated at startup |

### 1.3 Duplicate / Conflicting Route Mounts

| Conflict | Lines in routes.ts | Description |
|---|---|---|
| `/api/admin/bbps` | 712 (`adminBbpsHealthRoutes`) and 742 (`adminBbpsRoutes`) | Same prefix, two different routers. Express registers both; the second router's matching paths shadow the first. |
| `/api/admin` (root) | 787–789 (`merchantPlansAdminRoutes`, `platformStatsAdminRoutes`, `adminCorporateRoutes`) | All three mounted at `/api/admin` with no suffix. Internal routes must use prefixed paths like `/merchant-plans`, `/corporate` to avoid collisions — they do, but this design is fragile. |
| `/api/stores` | 488 (`consumerHomeRoutes`) and 494 (`storeRoutes`) | `consumerHomeRoutes` is mounted twice — at `/api/stores` (line 488) AND at `/api/user` (line 653). Intentional per comments, but the `/api/stores` mount may intercept some paths before `storeRoutes`. |
| `/api/admin` + `adminAggregatorMonitorRoutes` | 769 | Mounted at bare `/api/admin`, route inside defines `/aggregator-orders` — OK, no conflict, but adds to the crowded root namespace. |

### 1.4 Routes Imported but Never Mounted (Dead Imports)

The following are imported in `routes.ts` but their `app.use(...)` lines are all commented out:

| Import Variable | Source File |
|---|---|
| `authRoutes1` | `merchantroutes/auth` |
| `productRoutes1` | `merchantroutes/products` |
| `categoryRoutes1` | `merchantroutes/categories` |
| `uploadRoutes` | `merchantroutes/uploads` |
| `merchantCashbackRoutes` | `merchantroutes/cashback` |
| `dashboardRoutes` | `merchantroutes/dashboard` |
| `merchantWalletRoutes` | `merchantroutes/wallet` |
| `merchantCoinsRoutes` | `merchantroutes/coins` |
| `analyticsRoutesM` | `merchantroutes/analytics` |
| `merchantExportRoutes` | `merchantroutes/exports` (this is the old sprint version) |
| `merchantSyncRoutes` | `merchantroutes/sync` |
| `teamRoutes` | `merchantroutes/team` |
| `teamPublicRoutes` | `merchantroutes/team-public` |
| `auditRoutes` | `merchantroutes/audit` |
| `onboardingRoutes` | `merchantroutes/onboarding` |
| `merchantOrderRoutes` | `routes/merchant/orders` |
| `merchantWebOrderRoutes` | `routes/merchant/webOrders` |
| `merchantCashbackRoutesNew` | `routes/merchant/cashback` |
| `merchantPayoutRoutes` | `merchantroutes/payouts` |
| `merchantNotificationRoutes` | `routes/merchant/notifications` |
| `merchantCoinDropRoutes` | `routes/merchant/coinDrops` |
| `merchantBrandedCoinRoutes` | `routes/merchant/brandedCoins` |
| `merchantEarningAnalyticsRoutes` | `routes/merchant/earningAnalytics` |
| `merchantCreatorAnalyticsRoutes` | `routes/merchant/creatorAnalytics` |
| `merchantSocialImpactRoutes` | `routes/merchant/socialImpact` |
| `campaignSimulatorRoutes` | `merchantroutes/campaignSimulator` |
| `bulkRoutes` | `merchantroutes/bulk` |
| `storeRoutesM` | `merchantroutes/stores` |
| `merchantOfferRoutes` | `merchantroutes/offers` |
| `storeGalleryRoutesM` | `merchantroutes/storeGallery` |
| `productGalleryRoutesM` | `merchantroutes/productGallery` |
| `merchantDiscountRoutes` | `merchantroutes/discounts` |
| `merchantStoreVoucherRoutes` | `merchantroutes/storeVouchers` |
| `merchantOutletRoutes` | `merchantroutes/outlets` |
| `merchantVideoRoutes` | `merchantroutes/videos` |
| `bulkImportRoutes` | `merchantroutes/bulkImport` |
| `merchantSocialMediaRoutes` | `merchantroutes/socialMedia` |
| `merchantEventsRoutes` | `merchantroutes/events` |
| `merchantServicesRoutes` | `merchantroutes/services` |
| `merchantPatchTestRoutes` | `merchantroutes/patchTests` |
| `merchantStoreVisitRoutes` | `merchantroutes/storeVisits` |
| `merchantDealRedemptionRoutes` | `merchantroutes/dealRedemptions` |
| `merchantVoucherRedemptionRoutes` | `merchantroutes/voucherRedemptions` |
| `merchantLiabilityRoutes` | `merchantroutes/liability` |
| `merchantDisputeRoutes` | `merchantroutes/disputes` |
| `floorPlanRoutes` | `merchantroutes/floorPlan` |
| `merchantVariantsRoutes` | `merchantroutes/variants` |
| `productRestoreRoutes` | `merchantroutes/product-restore` |
| `priveCampaignMerchantRoutes` | `merchantroutes/priveModule` |
| `supplierRoutes` | `merchantroutes/suppliers` |
| `purchaseOrderRoutes` | `merchantroutes/purchaseOrders` |
| `customerInsightsRoutes` | `merchantroutes/customerInsights` |
| `tableManagementRoutes` | `merchantroutes/tableManagement` |
| `payrollRoutes` | `merchantroutes/payroll` |
| `gstRoutes` | `merchantroutes/gst` |
| `bizDocsRoutes` | `merchantroutes/bizdocs` |
| `khataRoutes` | `merchantroutes/khata` |
| `rezCapitalRoutes` | `merchantroutes/rezCapital` |
| `aovRewardsRoutes` | `merchantroutes/aovRewards` |
| `dynamicPricingRoutes` | `merchantroutes/dynamicPricing` |
| `campaignRulesRoutes` | `merchantroutes/campaignRules` |
| `campaignRecommendationsRoutes` | `merchantroutes/campaignRecommendations` |
| `adBazaarSummaryRoutes` | `merchantroutes/adBazaarSummary` |
| `staffShiftsRoutes` | `merchantroutes/staffShifts` |
| `roiRoutes` | `merchantroutes/roi` |
| `campaignROIRoutes` | `merchantroutes/campaignROI` |
| `recipesRoutes` | `merchantroutes/recipes` |
| `wasteRoutes` | `merchantroutes/waste` |
| `upsellRoutes` | `merchantroutes/upsell` |
| `bundleRoutes` | `merchantroutes/bundles` |
| `postPurchaseRoutes` | `merchantroutes/postPurchase` |
| `broadcastsRoutes` | `merchantroutes/broadcasts` |
| `stampCardsRoutes` | `merchantroutes/stampCards` |
| `loyaltyTiersRoutes` | `merchantroutes/loyaltyTiers` |
| `corporateRoutes` | `merchantroutes/corporate` |
| `posRoutes` | `merchantroutes/pos` |
| `giftCardsRoutes` | `merchantroutes/giftCards` |
| `expensesRoutes` | `merchantroutes/expenses` |
| `merchantIntegrationsRoutes` | `merchantroutes/integrations` |
| `intelligenceRoutes` | `merchantroutes/intelligence` |
| `brandRoutes` | `merchantroutes/brands` |
| `attributionRoutes` | `merchantroutes/attribution` |
| `merchantGrowthRoutes` | `merchantroutes/growth` |
| `merchantPayoutSprint7Routes` | `routes/merchantPayoutRoutes` |
| `merchantExportSprintRoutes` | `routes/merchantExportRoutes` |
| `merchantBroadcastRoutes` | `routes/merchantBroadcastRoutes` |
| `inventoryRoutes` | `routes/inventoryRoutes` |
| `merchantStoreRoutes` | `routes/merchantStoreRoutes` |
| `merchantDisputeSprintRoutes` | `routes/merchantDisputeRoutes` |
| `trialMerchantRoutes` | `routes/trialMerchantRoutes` |

**Impact:** All of the above are dead imports — they consume module load time at startup but serve no requests. Merchant dashboard, analytics, payouts, liability, prive campaigns, khata, POS, recipes, waste, ROI, etc. are all unreachable from this monolith. If nginx is not correctly routing to `rez-merchant-service`, these features return 404.

### 1.5 Admin Index Exports Not Used in routes.ts

| Exported from `routes/admin/index.ts` | Used in routes.ts? |
|---|---|
| `adminServiceAppointmentsRoutes` | **NO** — `routes.ts` imports `adminServiceAppointmentRoutes` (no 's') directly from the file path, bypassing the index export. The index also exports it as `adminServiceAppointmentsRoutes` (with 's') but that name is never destructured. |
| `adminMerchantPlansRoutes` | **NO** — `routes.ts` imports `merchantPlansAdminRoutes` directly. |

---

## 2. Controllers Audit

### 2.1 Orphaned Controllers (Defined but Never Called from Any Route)

| Controller File | Status |
|---|---|
| `controllers/walletTransactionController.ts` | Re-exported via `walletController.ts` — used indirectly. OK. |
| `controllers/orderTrackingController.ts` | Re-exported via `orderController.ts` — used indirectly. OK. |
| `controllers/orderReorderController.ts` | Re-exported via `orderController.ts` — used indirectly. OK. |
| `controllers/promoCodeController.ts` | **No import found in any route file or other controller.** Likely orphaned. |
| `controllers/whatsNewController.ts` | Imported by `whatsNewRoutes.ts` — OK. |
| `controllers/merchantNotificationController.ts` | **Not imported in any active route** (all merchant notification routes are commented out). Dead. |
| `controllers/admin/priveConfigAdminController.ts` | Imported and used in `routes/admin/priveAdmin.ts` — OK. |
| `controllers/orderTrackingController.ts` | Re-exported by `orderController.ts`, called in `orderRoutes.ts` — OK. |

**Confirmed orphaned:**
- `controllers/promoCodeController.ts` — not referenced in any active route or controller import
- `controllers/merchantNotificationController.ts` — referenced only from `routes/merchant/notifications.ts` which is in the commented-out block

### 2.2 Missing Response Sends

| File | Location | Issue |
|---|---|---|
| `routes/admin/platformStats.ts` | `router.get('/')` | No `try/catch` wrapping the entire handler — if any `Promise.all` rejects, the unhandled rejection propagates and Express returns no response. `asyncHandler` is used, so it will forward to `globalErrorHandler`, but that relies on `globalErrorHandler` being registered — which it is. Marginal risk. |
| `routes/admin/aggregatorMonitor.ts` | `router.get('/aggregator-orders')` | Uses raw `async (req, res)` without `asyncHandler` — unhandled promise rejections will crash the request without a proper response. |

### 2.3 Unhandled Errors / Missing try-catch

| File | Issue |
|---|---|
| `routes/admin/aggregatorMonitor.ts` | Bare async route handler without `asyncHandler` wrapper. |
| `routes/admin/priveAdmin.ts` lines 188–290 | `asyncHandler` used correctly — OK. |
| `routes/admin/merchantPlans.ts` | Uses `asyncHandler` — OK. |
| `routes/admin/corporate.ts` | Must be verified — complex inline logic. |
| `controllers/admin/otaAdminController.ts` | Newly added — needs manual review for try/catch coverage. |

---

## 3. Middleware Audit

### 3.1 Auth Middleware Gaps

| Gap | Location | Detail |
|---|---|---|
| Admin BBPS routes double-mount | `routes.ts:712,742` | `adminBbpsHealthRoutes` and `adminBbpsRoutes` both mounted at `/api/admin/bbps`. Both apply `requireAuth`+`requireAdmin` internally (verified for `bbpsAdmin.ts`). Auth is fine but route conflicts exist. |
| Lock deal cron endpoint | `lockDealRoutes.ts:103-107` | `POST /api/lock-deals/process-expired` uses `requireAuth` with a comment saying it should be `requireAdmin`. Any logged-in consumer can trigger this. |
| Savings goal routes | `savingsGoalRoutes.ts` | No auth middleware inside the router. Auth injected at mount site (`routes.ts:957`). Fragile — if ever remounted without auth middleware, all endpoints become public. |
| Admin global middleware | `routes.ts:672-679` | Global `authenticate` + `requireAdmin` is correctly applied via `app.use` before all `/api/admin` routes, except `/auth`. This is a strong, correct pattern. |
| Merchant subscription | `merchantroutes/subscription.ts` | Uses `authMiddleware` from `merchantauth.ts` — correct merchant auth applied. |
| `bullboardRoutes` | `routes.ts:784` | Mounted at `/admin` (not `/api/admin`) — has explicit `authTokenMiddleware`, `requireAdminMiddleware`, `adminAuditMiddleware`. Correct. |

### 3.2 Missing Validation Middleware

| Route | Issue |
|---|---|
| `routes/admin/aggregatorMonitor.ts` | No input validation on `platform`, `status`, `page`, `limit` query params — type coercion via `Number()` is present but no schema validation. |
| `routes/admin/platformStats.ts` | No query param validation (none needed — no params). |
| Webhook routes (Razorpay, Stripe, Rendez, AdBazaar) | Raw body parsing is required for HMAC verification — must be mounted BEFORE `express.json()`. Verified that `webhookRoutes.ts` correctly imports `express.raw()` for Razorpay. |
| `routes/cashbackRoutes.ts` | `POST /redeem` applies `cashbackRedeemLimiter` — good. |
| `routes/priveInviteRoutes.ts` | Verify input validation on invite code endpoints. |

### 3.3 Two Internal Auth Tokens (Naming Inconsistency)

The codebase uses two different environment variable names for service-to-service authentication:

- **`INTERNAL_SERVICE_TOKEN`** — used in `middleware/internalAuth.ts`, `utils/serviceClient.ts`, and `validateEnv.ts` (required). This is for inbound requests from trusted services.
- **`INTERNAL_SERVICE_KEY`** — used when calling **outbound** services (marketing service, broadcasts). NOT in `validateEnv.ts`. If unset, defaults to empty string, silently breaking all broadcast calls.

This split is intentional (inbound vs outbound) but the naming is confusing and `INTERNAL_SERVICE_KEY` is completely unvalidated at startup.

---

## 4. Services Audit

### 4.1 Unused / Orphaned Services

| Service File | Import Status |
|---|---|
| `services/stripeService.ts` | Imported in `controllers/paymentController.ts` and `controllers/webhookController.ts` — active. |
| `services/WhatsAppMarketingService.ts` | Verify import in active routes. |
| `services/broadcastDispatchService.ts` | Used by merchant broadcast routes — but most merchant routes are commented out. May be partially dead. |
| `services/mallAffiliateService.ts` | Used by `mallAffiliateRoutes.ts` and `cashStoreAffiliateRoutes.ts` — active. |
| `services/nearbyEarnService.ts` | Verify import in active routes. |
| `services/socialImpactService.ts` | Only referenced from `routes/merchant/socialImpact.ts` — which is a commented-out route. Potentially dead. |

### 4.2 Missing Error Handling in Service Methods

| Service | Issue |
|---|---|
| `services/ReferralAbuseDetector.ts:232-241` | `storeFraudFlag()` catches errors but silently swallows them. The `FraudFlag` model check logs a warn but does not throw — fraud events are silently dropped. |
| `services/MarketingSignalService.ts` | `MARKETING_SERVICE_URL` is a module-level constant set at import time. If `MARKETING_SERVICE_URL` is undefined, all HTTP calls will target `undefined/path` and throw at runtime, not startup. |
| `services/adminTotpService.ts:12` | Falls back to `JWT_ADMIN_SECRET?.slice(0, 32)` if `TOTP_ENCRYPTION_KEY` is not set. This means TOTP secrets are encrypted with a derived key from `JWT_ADMIN_SECRET` — acceptable fallback but not the same key, creating a silent key-rotation risk. |

### 4.3 Circular Dependency Risks

| Pair | Risk Level |
|---|---|
| `walletController.ts` re-exports from `walletTransactionController.ts` | Low — same domain. |
| `orderController.ts` re-exports from `orderTrackingController.ts` + `orderReorderController.ts` | Low — same domain. |
| Services importing from other services | Not fully audited — large service graph. |

---

## 5. Models Audit

### 5.1 Missing Model Files

| Model Referenced | File Location | Status |
|---|---|---|
| `FraudFlag` | `services/ReferralAbuseDetector.ts:234` | **MISSING** — no `src/models/FraudFlag.ts`. Dynamic lookup always fails. |
| `PriveAuditLog` | `routes/admin/priveAdmin.ts:101` | Exists at `src/models/PriveAuditLog.ts` — OK. |
| `SupportTicket` | `routes/admin/priveAdmin.ts:196` | Exists at `src/models/SupportTicket.ts` — OK. |
| `Corporate` | `routes/admin/corporate.ts` | Exists at `src/models/Corporate.ts` — OK. |
| `CorporateMember` | `routes/admin/corporate.ts` | Exists at `src/models/CorporateMember.ts` — OK. |
| `MerchantPlan` | `routes/admin/merchantPlans.ts` | Exists at `src/models/MerchantPlan.ts` — OK. |

### 5.2 Missing Indexes (Potential Slow Queries)

The following high-traffic patterns were identified without confirmed indexes:

| Model | Field(s) | Query Pattern | Risk |
|---|---|---|---|
| `Order` | `user` + `status` + `createdAt` | Aggregations in `consumerHomeRoutes.ts` | HIGH — unindexed compound query on large collection |
| `CoinTransaction` | `user` + `createdAt` | `GET /api/wallet` transaction history | HIGH — heavy without index |
| `OfferRedemption` | `user` + `offerId` | Redemption lookups | MEDIUM |
| `UserMission` | `status` + `completedAt` | Admin lifecycle analytics | MEDIUM |
| `PriveAccess` | `status` | `countDocuments` in analytics | MEDIUM |
| `Merchant` | `lastLoginAt` | Active merchant count query in `platformStats.ts` | MEDIUM — no TTL or index |

**Note:** The server has a startup check for `AUTO_CREATE_INDEXES` — but manual index creation via `db:indexes` script is the intended production path.

### 5.3 Models with Potential Issues

| Model | Issue |
|---|---|
| `MerchantPlan.ts` | Used in `platformStats.ts` `aggregate([{$group: {_id:'$plan'...}}])` — queries the `MerchantPlan` collection for plan distribution. But the aggregate is on the plan config documents, not merchant subscriptions — the `count` will be the number of plan config rows (1 per tier = 3), not the number of merchants per plan. This is a logic bug in `platformStats.ts`. |
| `SavingsGoal.ts` | Imported directly in `savingsGoalRoutes.ts` rather than via a service — business logic in route file. |

---

## 6. Environment Variables

### 6.1 All Referenced Environment Variables

| Variable | Required? | Validated at startup? |
|---|---|---|
| `MONGODB_URI` | Yes | Yes |
| `JWT_SECRET` | Yes | Yes |
| `JWT_REFRESH_SECRET` | Yes | Yes |
| `JWT_MERCHANT_SECRET` | Yes | Yes |
| `JWT_ADMIN_SECRET` | Yes | Yes |
| `OTP_HMAC_SECRET` | Yes | Yes |
| `INTERNAL_SERVICE_TOKEN` | Yes | Yes |
| `ENCRYPTION_KEY` | Yes | Yes |
| `REDIS_URL` | Yes | Yes |
| `RAZORPAY_KEY_ID` | Yes (prod) | Yes |
| `RAZORPAY_KEY_SECRET` | Yes (prod) | Yes |
| `RAZORPAY_WEBHOOK_SECRET` | Conditional | Yes (contextual) |
| `FRONTEND_URL` | Yes | Yes |
| `JWT_EXPIRES_IN` | No | No |
| `JWT_REFRESH_EXPIRES_IN` | No | No |
| `JWT_MERCHANT_EXPIRES_IN` | No | No |
| `BCRYPT_ROUNDS` | No (defaults to 12) | Yes |
| `PORT` | No (defaults to 5001) | Yes |
| `NODE_ENV` | No (defaults to 'production') | No |
| **`INTERNAL_SERVICE_KEY`** | **No** | **NO — critical gap** |
| `MARKETING_SERVICE_URL` | Recommended | Warn only |
| `TWILIO_ACCOUNT_SID` | Recommended | Warn only |
| `TWILIO_AUTH_TOKEN` | Recommended | Warn only |
| `TWILIO_PHONE_NUMBER` | Conditional | Yes (if Twilio creds set) |
| `TWILIO_SENDER_ID` | Conditional | Yes (alternative) |
| `SENDGRID_API_KEY` | Recommended | Warn only |
| `SENDGRID_FROM_EMAIL` | No | No |
| `SENDGRID_FROM_NAME` | No | No |
| `CLOUDINARY_CLOUD_NAME` | Recommended | Warn only |
| `CLOUDINARY_API_KEY` | Recommended | Warn only |
| `CLOUDINARY_API_SECRET` | Recommended | Warn only |
| `SENTRY_DSN` | Recommended | Warn only |
| `PUBLIC_URL` | Recommended | Warn only |
| `MERCHANT_FRONTEND_URL` | Recommended | Warn only |
| `CASHBACK_INSTANT_CREDIT` | Recommended | Warn only |
| `STRIPE_SECRET_KEY` | Recommended | Warn only |
| `STRIPE_WEBHOOK_SECRET` | Recommended | Warn only |
| `TOTP_ENCRYPTION_KEY` | No | No — falls back to JWT_ADMIN_SECRET slice |
| `FIREBASE_CREDENTIALS_JSON` | No | No |
| `ONESIGNAL_APP_ID` | No | No |
| `ONESIGNAL_API_KEY` | No | No |
| `ADBAZAAR_INTERNAL_KEY` | No | No |
| `ADBAZAAR_WEBHOOK_SECRET` | No | No |
| `ADBAZAAR_API_URL` | No | No |
| `ADBAZAAR_WEBHOOK_URL` | No | No |
| `RENDEZ_BACKEND_URL` | No | No |
| `RENDEZ_WEBHOOK_SECRET` | No | No |
| `REZ_OTA_WEBHOOK_SECRET` | No | No |
| `APPLE_APP_ID` | No | No |
| `ANDROID_SHA256_FINGERPRINT` | No | No |
| `GOOGLE_MAPS_API_KEY` | No | No |
| `OPENCAGE_API_KEY` | No | No |
| `GOOGLE_CLOUD_API_KEY` | No | No |
| `AZURE_VISION_KEY` | No | No |
| `AWS_ACCESS_KEY_ID` | No | No |
| `AWS_SECRET_ACCESS_KEY` | No | No |
| `AWS_REGION` | No | No |
| `WALLET_BALANCE_ENCRYPTION_KEY` | No | No |
| `GIFT_CARD_ENCRYPTION_KEY` | No | No |
| `RECEIPT_TOKEN_SECRET` | No | No |
| `MALL_WEBHOOK_MASTER_KEY` | No | No |
| `TRIAL_QR_SECRET` | No | No |
| `AUGMONT_API_LIVE` | No | No |
| `AUGMONT_GOLD_PRICE` | No | No |
| `GOLD_PROVIDER_API_KEY` | No | No |
| `RECHARGE_AGGREGATOR_API_KEY` | No | No |
| `RECHARGE_API_KEY` | No | No |
| `RECHARGE_GATEWAY_URL` | No | No |
| `RECHARGE_MERCHANT_ID` | No | No |
| `RAZORPAY_ACCOUNT_NUMBER` | No | No |
| `RAZORPAY_PAYOUT_ENABLED` | No | No |
| `WHATSAPP_TOKEN` | No | No |
| `WHATSAPP_PHONE_ID` | No | No |
| `WHATSAPP_APP_SECRET` | No | No |
| `WHATSAPP_VERIFY_TOKEN` | No | No |
| `TWILIO_WHATSAPP_NUMBER` | No | No |
| `PUSH_API_URL` | No | No |
| `PUSH_API_KEY` | No | No |
| `NOTIFICATION_SERVICE_URL` | No | No |
| `PAYMENT_SERVICE_URL` | No | No |
| `WALLET_SERVICE_URL` | No | No |
| `GAMIFICATION_SERVICE_URL` | No | No |
| `MERCHANT_SERVICE_URL` | No | No |
| `SLACK_OPS_WEBHOOK_URL` | No | No |
| `CORS_ORIGIN` | No (warn in prod) | Warn |
| `MERCHANT_APP_URL` | No | No |
| `ADMIN_FRONTEND_URL` | No | No |
| `ADMIN_URL` | No | No |
| `ADMIN_EMAIL` | No | No |
| `WEB_MENU_URL` | No | No |
| `APP_URL` | No | No |
| Various `REWARD_*` vars | No | No |
| Various `QUEUE_CONCURRENCY_*` vars | No | No |
| `PROCESS_ROLE` | No (defaults to 'api') | No |
| `ENABLE_CRON` | No | No |
| `WORKER_ROLE` | No | No |
| `SHUTDOWN_TIMEOUT_MS` | No | No |
| `DISABLE_RATE_LIMIT` | No | Hard-fail if true in prod |
| `REQUIRE_ADMIN_TOTP` | No | Hard-fail if false in prod |
| `SMS_TEST_MODE` | No | Warn in prod |
| `EXPOSE_DEV_OTP` | No | Warn in prod |
| `AUTO_CREATE_INDEXES` | No | Warn in prod if true |

### 6.2 Undocumented / Missing Validated Variables

| Variable | Problem |
|---|---|
| `INTERNAL_SERVICE_KEY` | Used in 15+ broadcast/marketing call sites. Empty string is valid input but silently breaks all inter-service calls. NOT in `validateEnv.ts`. |
| `TOTP_ENCRYPTION_KEY` | Falls back to JWT_ADMIN_SECRET slice — not a safe default in production. Not required by `validateEnv`. |
| `WALLET_BALANCE_ENCRYPTION_KEY` | Referenced in wallet encryption — not validated at startup. |
| `GIFT_CARD_ENCRYPTION_KEY` | Referenced in gift card encryption — not validated at startup. |
| `RECEIPT_TOKEN_SECRET` | Not validated at startup. |
| `MALL_WEBHOOK_MASTER_KEY` | Not validated at startup. |
| `TRIAL_QR_SECRET` | Not validated at startup. |
| `AUGMONT_API_LIVE` / `GOLD_PROVIDER_API_KEY` | Gold SIP features silently fail if missing. |
| `ADBAZAAR_INTERNAL_KEY` | Not validated — AdBazaar integration silently accepts all requests if empty. |
| `ANDROID_SHA256_FINGERPRINT` | Not in validateEnv — but handled gracefully (returns 404). |

---

## 7. Server Mount Audit

### 7.1 Router Mount Checklist

| Category | Status | Notes |
|---|---|---|
| User auth routes (`/api/user/auth`) | MOUNTED | `authRoutes` mounted at both `/api/user/auth` and `/api/v1/user/auth` |
| Order routes (`/api/orders`) | MOUNTED | Both unversioned and v1 |
| Wallet routes (`/api/wallet`) | MOUNTED | Auth enforced inside router |
| Payment routes (`/api/payment`) | MOUNTED | Auth applied per-handler |
| Admin routes (all) | MOUNTED | Global auth middleware via `app.use` before all admin routes |
| Merchant auth (`/api/merchant/auth`) | **COMMENTED OUT** | Routes not served from monolith — should go to rez-merchant-service |
| Merchant dashboard (`/api/merchant/dashboard`) | **COMMENTED OUT** | Dead |
| Merchant analytics (`/api/merchant/analytics`) | **COMMENTED OUT** | Dead |
| Merchant payouts (`/api/merchant/payouts`) | **COMMENTED OUT** | Dead |
| Merchant subscription (`/api/merchant/subscription`) | MOUNTED | One of 4 active merchant routes |
| Merchant QR (`/api/merchant` → qr routes) | MOUNTED | Active |
| Merchant invoices (`/api/merchant/invoices`) | MOUNTED | Active |
| `/api/merchants` (general) | MOUNTED | Active — serves basic merchant public info |
| BullBoard admin UI (`/admin`) | MOUNTED | Correctly protected |
| AdBazaar integration (`/api/adbazaar`) | MOUNTED | Internal key validation |
| AdBazaar webhooks (`/api/webhooks`) | MOUNTED | Shares prefix with Razorpay webhook — potential conflict if route paths overlap |
| Error handlers (404, Sentry, global) | MOUNTED LAST | Correct ordering |
| CSRF token endpoint (`/api/csrf-token`) | MOUNTED | No rate limit on this endpoint |
| Health endpoints (`/health`, `/health/ready`, `/health/live`) | MOUNTED | Before routes — correct |

### 7.2 Route Prefix Inconsistencies

| Issue | Detail |
|---|---|
| `app.use('/api/user/savings', savingsInsightsRoutes)` | Uses hardcoded `/api/user/savings` instead of `${API_PREFIX}/user/savings`. If `API_PREFIX` is ever changed from `/api`, this breaks. |
| `app.use('/api/insights', ...)` | Hardcoded `/api` prefix — same issue. |
| `app.use('/api/score', ...)` | Hardcoded. |
| `app.use('/api/rewards/instant', ...)` | Hardcoded. |
| `app.use('/api/goals', ...)` | Hardcoded. |
| `app.use('/api/adbazaar', ...)` | Hardcoded. |
| `app.use('/api/merchant/*', ...)` | All active merchant routes use hardcoded `/api/merchant` prefix. |
| `app.use('/api/merchants', ...)` | Hardcoded. |

All of the above 8+ routes bypass `API_PREFIX` env var and will break if the prefix is changed from the default `/api`.

---

## 8. Priority Issue List

### P0 — Critical (Security / Total Breakage)

| # | Issue | File | Action Required |
|---|---|---|---|
| P0-1 | **Firebase private key on disk** | `rezbackend/rez-backend-master/firebase-service-account.json` | Revoke key in Firebase console immediately. Rotate all secrets if the file was ever committed to git. Use `FIREBASE_CREDENTIALS_JSON` env var instead of file. |
| P0-2 | **FraudFlag model missing** | `src/services/ReferralAbuseDetector.ts:234` | Create `src/models/FraudFlag.ts` or change the dynamic lookup to a static import. All fraud flags for referrals are being silently dropped right now. |
| P0-3 | **Admin-only cron endpoint unprotected** | `src/routes/lockDealRoutes.ts:103-107` | Change `requireAuth` to `requireAdmin` (or `requireInternalToken`) on `POST /api/lock-deals/process-expired`. Any authenticated consumer can trigger batch lock processing. |
| P0-4 | **Duplicate bbps mount causes route shadowing** | `src/config/routes.ts:712,742` | Mount `adminBbpsHealthRoutes` at `/api/admin/bbps/health` and `adminBbpsRoutes` at `/api/admin/bbps` — or merge them. |
| P0-5 | **`INTERNAL_SERVICE_KEY` not validated** | `src/config/validateEnv.ts` | Add `INTERNAL_SERVICE_KEY` to `REQUIRED_ENV_VARS` or at minimum `RECOMMENDED_ENV_VARS`. Without it, all broadcast and marketing service calls silently fail with empty auth. |
| P0-6 | **`platformStatsAdminRoutes` mounted at bare `/api/admin`** | `src/config/routes.ts:788` | The route defines `GET /` — it becomes `GET /api/admin/`. Likely intended to be `GET /api/admin/platform-stats`. Mount at `/api/admin/platform-stats` instead. |
| P0-7 | **`TOTP_ENCRYPTION_KEY` not required** | `src/services/adminTotpService.ts:12,19-20` | Falls back to `JWT_ADMIN_SECRET` slice — in production, this means admin TOTP secrets are encrypted with a derived key. If `JWT_ADMIN_SECRET` rotates, all admin TOTP codes become undecryptable. Add `TOTP_ENCRYPTION_KEY` to required env vars. |
| P0-8 | **MerchantPlan aggregate logic bug** | `src/routes/admin/platformStats.ts:57-66` | Aggregates on `MerchantPlan` collection (plan config docs) — will return `{count: 1}` for each of the 3 plan tiers, not the number of merchants per plan. Wrong model — should aggregate on merchant subscriptions. |
| P0-9 | **`savingsGoalRoutes` has no internal auth guard** | `src/routes/savingsGoalRoutes.ts:16` | Auth depends entirely on mount-site injection. Add `router.use(authenticate)` inside the router as a belt-and-suspenders guard. |

### P1 — High (Broken Features / Data Loss Risk)

| # | Issue | File | Action Required |
|---|---|---|---|
| P1-1 | 70+ merchant route imports dead | `src/config/routes.ts:856-950` | Either remove dead imports to reduce startup cost or document which features require nginx to route to rez-merchant-service. |
| P1-2 | `INTERNAL_SERVICE_KEY` defaults to `''` | 15+ broadcast files | All broadcasts and marketing signal calls silently fail with empty auth header if env var is not set. |
| P1-3 | `FraudFlag` model missing | `services/ReferralAbuseDetector.ts` | Referral fraud events are never persisted. |
| P1-4 | `promoCodeController.ts` orphaned | `src/controllers/promoCodeController.ts` | No active route imports this. Promo code functionality is inaccessible. |
| P1-5 | `merchantNotificationController.ts` orphaned | `src/controllers/merchantNotificationController.ts` | Dead — merchant notification route is commented out. |
| P1-6 | `socialImpactService.ts` dead | `src/services/socialImpactService.ts` | Only route is commented out. |
| P1-7 | 8+ routes use hardcoded `/api` prefix | `src/config/routes.ts:953-966` | Will silently break if `API_PREFIX` env var is set to anything other than `/api`. |
| P1-8 | `adminServiceAppointmentsRoutes` export name mismatch | `src/routes/admin/index.ts:31` vs `src/config/routes.ts:304` | Index exports `adminServiceAppointmentsRoutes` (with 's') but `routes.ts` imports directly by filename. Fragile — if someone ever switches to the index import, they'll use the wrong variable. |
| P1-9 | `merchantGrowthRoutes` imported but never mounted | `src/config/routes.ts:193` | Growth routes inaccessible from monolith. |
| P1-10 | `broadcastDispatchService.ts` likely dead | `src/services/broadcastDispatchService.ts` | All merchant broadcast routes are commented out. |
| P1-11 | `WALLET_BALANCE_ENCRYPTION_KEY` not validated | `src/config/validateEnv.ts` | If missing, wallet balance encryption silently uses fallback or fails. |
| P1-12 | `GIFT_CARD_ENCRYPTION_KEY` not validated | `src/config/validateEnv.ts` | Gift card codes may be stored unencrypted if key is missing. |
| P1-13 | Order aggregate in `consumerHomeRoutes.ts` likely unindexed | `src/routes/consumerHomeRoutes.ts:25-30` | Full collection scan on `Order` by user + status without confirmed compound index. |
| P1-14 | `routes/admin/aggregatorMonitor.ts` bare async handler | Line 8 | No `asyncHandler` wrapper — unhandled rejections produce no HTTP response. |
| P1-15 | `AUGMONT_API_LIVE` / `GOLD_PROVIDER_API_KEY` not validated | Multiple gold service files | Gold SIP features silently fail if missing. |
| P1-16 | `ADBAZAAR_INTERNAL_KEY` not validated | `routes/adBazaarIntegration.ts` | If empty string, internal AdBazaar routes accept any request with an empty key. |
| P1-17 | `RENDEZ_WEBHOOK_SECRET` not validated | `routes/webhookRoutes.ts` | Rendez webhook HMAC cannot verify signatures if secret is empty. |
| P1-18 | `REZ_OTA_WEBHOOK_SECRET` not validated | `routes/integrationWebhook.ts` | OTA integration webhook unverified if env var is missing. |

### P2 — Medium (Quality / Maintainability)

| # | Issue | Action Required |
|---|---|---|
| P2-1 | 200+ env vars referenced, only ~9 validated | Add more vars to required/recommended lists in `validateEnv.ts` |
| P2-2 | `consumerHomeRoutes.ts` mounted twice | Document intent explicitly or split into two dedicated route files |
| P2-3 | `adminMerchantPlansRoutes` in index never used | Clean up stale export from `routes/admin/index.ts` |
| P2-4 | `platformStatsAdminRoutes` `GET /` misnamed | Rename to clearly indicate it handles `/platform-stats` |
| P2-5 | `merchantPlansAdminRoutes` missing `authenticate` middleware | Only has `requireAdmin` — `requireAdmin` checks role but depends on `req.user` being set by `authenticate`. Relies on global middleware chain being correct. |
| P2-6 | `lockDealRoutes.ts` TODO comment in production | "Should be requireAdmin in production" — this IS production code |
| P2-7 | BBPS duplicate mount creates silent route shadowing | Consolidate into one router with a clear path hierarchy |
| P2-8 | `savingsGoalRoutes.ts` business logic in route file | Move DB queries to a service layer |
| P2-9 | `adminTotpService.ts` TOTP key derivation from JWT secret | Separate keys for separate purposes — create `TOTP_ENCRYPTION_KEY` as required var |
| P2-10 | `routes.ts` comment says merchant routes are dead but still imports 70+ files | Remove dead imports to reduce startup time |
| P2-11 | `priveAdminController.ts` mixes route logic inline in route file | Inline complex lifecycle analytics handler in route file — should be in controller |
| P2-12 | `platformStats.ts` has hardcoded mock aggregator data | `aggregatorOrders: { today: 3847, ... }` is hardcoded — returns fake stats |
| P2-13 | `db.healthCheck()` in server startup logs but is not guarded | Slow startup on Atlas M0 if health check takes too long |
| P2-14 | Worker startup comment inconsistency | Server starts critical workers in API process AND has PROCESS_ROLE=worker — could double-start workers |
| P2-15 | `ADMIN_URL` vs `ADMIN_FRONTEND_URL` both referenced | Two different env vars for the same concept — confusing |
| P2-16 | `MONGO_URI` vs `MONGODB_URI` both referenced | `MONGO_URI` found in at least one file — should be standardised to `MONGODB_URI` |
| P2-17 | `ALLOWED_ORIGINS` vs `CORS_ORIGIN` both exist | CORS config uses `CORS_ORIGIN` in validateEnv but `ALLOWED_ORIGINS` in middleware config |
| P2-18 | No rate limit on `/api/csrf-token` endpoint | Can be spammed for CSRF token generation |
| P2-19 | `routes/admin/platformStats.ts` no error handling | asyncHandler is used but no try/catch inside — all errors propagate to global handler |
| P2-20 | Token blacklist check `failClosed=true` in production | In production Redis outage, ALL authenticated requests fail. This is intentionally secure but should be documented and alarmed. |
| P2-21 | Merchant auth cached for 60s | If a merchant account is deactivated, they can continue using the API for up to 60 seconds |
| P2-22 | BullBoard mounted at `/admin` not `/api/admin` | Inconsistent with rest of admin routing — `/admin` is unversioned and bypasses the deprecation header middleware |
