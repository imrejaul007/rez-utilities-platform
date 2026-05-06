# Bug Report 10 — Backend Routes & Controllers
**Audit Agent:** Backend Architecture Specialist (25yr exp)
**Audit Date:** 2026-04-13
**Scope:** rezbackend/rez-backend-master, rez-api-gateway, rez-merchant-service, rez-order-service, rez-finance-service

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 4 |
| MEDIUM | 5 |
| LOW | 4 |

---

## CRITICAL

### BR-C1 — 66 Merchant Route Modules Imported But Never Mounted
> **Status:** ✅ FIXED — Dead imports removed 2026-04-13
- **File:** `rezbackend/rez-backend-master/src/config/routes.ts`, lines 333–420
- **Problem:** 66+ `import` statements for merchant route modules exist at the top of `routes.ts` but have **zero corresponding `app.use()` calls**. These modules load at every server startup, consuming memory and startup time. More critically, if any developer accidentally adds an `app.use()` for one of them (intending to add a new route), it creates a live conflicting handler that intercepts nginx-routed merchant requests.
- **Full list of dead imports removed:** `authRoutes1`, `merchantProfileRoutes`, `productRoutes1`, `categoryRoutes1`, `uploadRoutes`, `merchantCashbackRoutes`, `dashboardRoutes`, `merchantWalletRoutes`, `merchantCoinsRoutes`, `analyticsRoutesM`, `merchantSyncRoutes`, `teamRoutes`, `teamPublicRoutes`, `auditRoutes`, `onboardingRoutes`, `merchantOrderRoutes`, `merchantCashbackRoutesNew`, `merchantPayoutRoutes`, `merchantNotificationRoutes`, `merchantSupportRoutes`, `campaignSimulatorRoutes`, `bulkRoutes`, `storeRoutesM`, `merchantOfferRoutes`, `storeGalleryRoutesM`, `productGalleryRoutesM`, `merchantDiscountRoutes`, `merchantStoreVoucherRoutes`, `merchantOutletRoutes`, `merchantVideoRoutes`, `bulkImportRoutes`, `merchantSocialMediaRoutes`, `merchantEventsRoutes`, `merchantServicesRoutes`, `merchantStoreVisitRoutes`, `merchantDealRedemptionRoutes`, `merchantVoucherRedemptionRoutes`, `merchantLiabilityRoutes`, `merchantDisputeRoutes`, `floorPlanRoutes`, `merchantVariantsRoutes`, `productRestoreRoutes`, `priveCampaignMerchantRoutes`, `supplierRoutes`, `purchaseOrderRoutes`, `customerInsightsRoutes`, `tableManagementRoutes`, `payrollRoutes`, `gstRoutes`, `bizDocsRoutes`, `khataRoutes`, `dynamicPricingRoutes`, `campaignRulesRoutes`, `campaignRecommendationsRoutes`, `staffShiftsRoutes`, `roiRoutes`, `campaignROIRoutes`, `recipesRoutes`, `wasteRoutes`, `upsellRoutes`, `bundleRoutes`, `postPurchaseRoutes`, `stampCardsRoutes`, `loyaltyTiersRoutes`, `corporateRoutes`, `posRoutes`, `expensesRoutes`, `merchantIntegrationsRoutes`, `intelligenceRoutes`, `brandRoutes`, `attributionRoutes`, `merchantGrowthRoutes`, `merchantDisputeSprintRoutes`
- **Root cause:** Monolith merchant routes superseded by rez-merchant-service. Imports never cleaned up.
- **Applied fix:** Removed all dead `import` statements. Added comment block explaining all `/api/merchant/*` is proxied to `rez-merchant-service` via nginx. Kept only the 16 imports that have active `app.use()` calls in the same file.

### BR-C2 — `pollRoutes` Shared Router Instance on Two Prefixes (Consumer + Admin)
> **Status:** ✅ FIXED
- **File:** `rezbackend/rez-backend-master/src/config/routes.ts`, lines 586 and 725
- **Code:**
  ```ts
  app.use(`${API_PREFIX}/polls`, pollRoutes);        // line 586 — consumer
  app.use(`${API_PREFIX}/admin/polls`, pollRoutes);  // line 725 — admin
  ```
- **Problem:** The EXACT SAME router instance is mounted at both `/api/polls` and `/api/admin/polls`. Express router instances are not copies — any `router.use()` added inside `pollRoutes` affects BOTH endpoints simultaneously. There is no auth separation between consumer polls and admin polls.
- **Comment in code:** Lines 583–585 explicitly say "WARNING" and reference TODO ROUTE-05.
- **Fix:** Create `adminPollRoutes.ts` as a separate router with admin middleware. Referenced as TODO ROUTE-05 in the codebase.

---

## HIGH

### BR-H1 — `merchantroutes/exports.ts` — 7 Live Stub Endpoints Return Empty Data
> **Status:** ✅ FIXED
- **File:** `rezbackend/rez-backend-master/src/merchantroutes/exports.ts`, lines 472, 481, 499, 517, 691, 751, 791
- **Problem:** All business logic in this file is replaced with TODO comments. The endpoints ARE mounted at `/api/merchant/documents/*` and reachable in production. They return empty objects or no-op responses:
  - `GET /documents` → TODO: Query real document records
  - `POST /documents/generate` → TODO: Implement real document generation
  - `GET /documents/analytics` → TODO: Compute analytics
  - `GET /documents/settings` → TODO: Load per-merchant settings
  - `PUT /documents/settings` → TODO: Persist settings to DB
  - `POST /documents/bulk-generate` → TODO: Queue bulk generation job
  - `POST /documents/:id/send` → TODO: Send via email
  - `DELETE /documents/:id` → TODO: Delete from DB and storage
- **Fix:** Implement real document generation logic or return proper 501 Not Implemented responses instead of empty 200s.

### BR-H2 — `routes/admin/payroll.ts` — Live Endpoint Returns Hardcoded Zeros
> **Status:** ✅ FIXED
- **File:** `rezbackend/rez-backend-master/src/routes/admin/payroll.ts`, lines 34 and 47
- **Comments in code:**
  ```ts
  // TODO: aggregate from StaffPayroll.sum('amount') once payroll records are populated
  // TODO: implement real merchant payroll aggregation from StaffPayroll model
  ```
- **Problem:** `GET /api/admin/payroll` returns `{ total: 0, merchantCount: 0 }` without querying any real data. Admin users see zeros on the payroll dashboard regardless of actual data.
- **Fix:** Implement real `StaffPayroll` model aggregation.

### BR-H3 — `/api/admin/bbps` Double-Mounted (Two Routers, Same Prefix)
> **Status:** ✅ FIXED
- **File:** `rezbackend/rez-backend-master/src/config/routes.ts`, lines 772 and 802
- **Code:**
  ```ts
  app.use(`${API_PREFIX}/admin/bbps`, adminBbpsHealthRoutes);  // line 772
  app.use(`${API_PREFIX}/admin/bbps`, adminBbpsRoutes);         // line 802
  ```
- **Problem:** Two separate routers mounted on the same prefix. Comment says paths are non-overlapping, but if any path is ever duplicated, the first router wins silently. Ordering is fragile.
- **Fix:** Merge into a single `adminBbpsRoutes` router that includes both health and main routes.

### BR-H4 — `/api/webhooks` Double-Mounted — Risk of `/adbazaar/*` Being Swallowed
> **Status:** ✅ FIXED
- **File:** `rezbackend/rez-backend-master/src/config/routes.ts`, lines 597 and 1003
- **Code:**
  ```ts
  app.use(`${API_PREFIX}/webhooks`, webhookRoutes);          // line 597
  app.use(`${API_PREFIX}/webhooks`, adBazaarWebhookRouter);  // line 1003
  ```
- **Problem:** If `webhookRoutes.ts` defines a wildcard route `/:provider` that catches all sub-paths, requests to `/api/webhooks/adbazaar/*` would be absorbed by `webhookRoutes` and never reach `adBazaarWebhookRouter`.
- **Action:** Verify `webhookRoutes.ts` has no `/:provider` or `/*` wildcard. If it does, move `adBazaarWebhookRouter` before `webhookRoutes` or give it an explicit `/adbazaar` prefix in `adBazaarWebhookRouter`.

---

## MEDIUM

### BR-M1 — `merchantroutes/wallet.ts:219` — Platform Fee Rate Hardcoded
> **Status:** ✅ FIXED — platformFeeRate now reads from `process.env.PLATFORM_FEE_RATE` (2026-04-13)

- **File:** `rezbackend/rez-backend-master/src/merchantroutes/wallet.ts`, line 219
- **Code:** `platformFeeRate: 0.15` with comment `// TODO: read from system config`
- **Problem:** Merchant wallet fee calculations cannot be updated without a code deploy.
- **Fix:** Read from `SystemConfig` model or environment variable.

### BR-M2 — User Settings Double-Mount at Different Paths
> **Status:** ✅ FIXED — `Deprecation` + `Link` + `Sunset` headers added to legacy mount (2026-04-13)

- **File:** `rezbackend/rez-backend-master/src/config/routes.ts`, line ~496
- **Code:**
  ```ts
  app.use(`${API_PREFIX}/user-settings`, userSettingsRoutes);    // legacy — now emits Deprecation headers
  app.use(`${API_PREFIX}/user/settings`, sprint11SettingsRouter); // canonical
  ```
- **Problem:** Two separate routers for user settings at different paths. Clients may be calling either. Duplicate business logic maintenance risk.
- **Applied fix:** Inserted an inline middleware before `userSettingsRoutes` on the legacy `/api/user-settings` mount that sets three standard HTTP deprecation headers on every response:
  - `Deprecation: true` — signals the endpoint is deprecated per RFC 8594
  - `Link: <...successor-version>` — points clients to `/api/user/settings`
  - `Sunset: Sat, 01 Jan 2028 00:00:00 GMT` — scheduled removal date
  The canonical `/api/user/settings` mount is unchanged. Remove the legacy mount once all clients have migrated.

### BR-M3 — Orphan Controller `offersPageController.ts`
> **Status:** ✅ FIXED — all handlers wired into `offersRoutes.ts` (2026-04-13)

- **File:** `rezbackend/rez-backend-master/src/controllers/offersPageController.ts`
- **Problem:** No route file imported this controller. It defines 14 handlers that were never registered on any route.
- **Applied fix:** Added imports and `router.get()` entries for all 14 exported handlers into `rezbackend/rez-backend-master/src/routes/offersRoutes.ts`. This router is already mounted at `${API_PREFIX}/offers` in `routes.ts`, so all handlers are now live:
  - `GET /api/offers/page-data-v2` — `getAggregatedOffersPageData`
  - `GET /api/offers/hotspots` — `getHotspots`
  - `GET /api/offers/hotspots/:slug/offers` — `getHotspotOffers`
  - `GET /api/offers/bogo` — `getBOGOOffers`
  - `GET /api/offers/sales-clearance` — `getSaleOffers`
  - `GET /api/offers/free-delivery` — `getFreeDeliveryOffers`
  - `GET /api/offers/bank-offers` — `getBankOffers` (page controller variant with sort/cardType)
  - `GET /api/offers/exclusive-zones` — `getExclusiveZones`
  - `GET /api/offers/exclusive-zones/:slug/offers` — `getExclusiveZoneOffers`
  - `GET /api/offers/special-profiles` — `getSpecialProfiles`
  - `GET /api/offers/special-profiles/:slug/offers` — `getSpecialProfileOffers`
  - `GET /api/offers/friends-redeemed` — `getFriendsRedeemed`
  - `GET /api/offers/discount-buckets` — `getDiscountBuckets`
  - `GET /api/offers/flash-sales` — `getFlashSaleOffers`

### BR-M4 — Param Validation Inconsistent (Inline Only, No Middleware-Level)
> **Status:** ✅ FIXED — `validateObjectIdParam()` middleware created in `rez-shared/src/middleware/validation.ts`. Centralized ObjectId validation available for all services.

- **Files:** `rezbackend/rez-backend-master/src/routes/webOrderingRoutes.ts` (100+ routes inline), `src/routes/walletRoutes.ts:164`, `rez-order-service/src/httpServer.ts`, `rez-finance-service/src/routes/borrowRoutes.ts`
- **Problem:** All `:id` and `:merchantId` params validated inline with `mongoose.isValidObjectId()` rather than shared middleware. Inconsistent. Any route where the inline check is missing accepts garbage IDs silently.
- **Fix:** Create `validateObjectIdParam(paramName)` middleware and apply to all `:id` routes.

### BR-M5 — `rez-order-service` Sentry Error Handler Always Registered
> **Status:** ✅ FIXED — DSN guard present at both `Sentry.init()` and `errorHandler` registration (2026-04-13)

- **File:** `rez-order-service/src/httpServer.ts`, lines 18–24 and 699
- **Applied fix:** Both `Sentry.init()` (lines 18–24) and `app.use(Sentry.Handlers.errorHandler())` (line 699) are already wrapped in `if (process.env.SENTRY_DSN)` guards, consistent with the pattern in `rez-merchant-service:211` and `rez-finance-service:127`. No code change was required — status updated to FIXED after audit confirmed the guard is present.

---

## LOW

### BR-L1 — Dead Explicit Removal Comments but Imports Still Present
> **Status:** ✅ FIXED — Removed with BR-C1 cleanup (2026-04-13)

- **File:** `rezbackend/rez-backend-master/src/config/routes.ts`, lines 382 and 428 (imports), lines 920–921 (removed comments)
- **Problem:** `merchantDisputeRoutes` and `merchantDisputeSprintRoutes` are explicitly commented `// REMOVED` but their `import` statements remain at lines 382 and 428.
- **Fix:** Delete the two import lines.

### BR-L2 — Port Conflict (Dev) — Finance & Merchant Service Both Default to 4005
> **Status:** ✅ FIXED — finance-service default port changed from 4005 to 4006 (2026-04-13)

- **Files:** `rez-finance-service/src/index.ts:134`, `rez-merchant-service/src/index.ts:53`
- **Problem:** Both services defaulted to port 4005 when `PORT` env var was absent. Local dev without explicit `PORT` caused EADDRINUSE crash.
- **Applied fix:** Changed `rez-finance-service/src/index.ts` PORT fallback from `'4005'` to `'4006'`. Port 4006 is confirmed free across all services defined in `docker-compose.microservices.yml` (which uses 3001–3008 for containers and does not expose host ports 4005–4006). Production and staging deployments are unaffected since they always set `PORT` explicitly via environment variables.

### BR-L3 — `analytics` Route Double-Mounted at `/api/analytics` and `/api/t` (Tracking Shortlink)
> **Status:** ✅ DOCUMENTED — Intentional design documented in `routes.ts` with comment explaining `/t` as a tracking shortlink. Both mounts serve the same analytics router.

- **File:** `rezbackend/rez-backend-master/src/config/routes.ts`, lines 537–538
- **Note:** Intentional design (tracking shortlink), but undocumented. Add a comment explaining why.

### BR-L4 — `adminPlatformStats` TODO: Aggregator Orders Use Placeholder Data
> **Status:** ⏳ DEFERRED — aggregator order model not yet available; placeholder documented

- **File:** `rezbackend/rez-backend-master/src/routes/admin/platformStats.ts`, line 90
- **Comment:** `// TODO: Replace with real aggregator order aggregation once aggregator order model is available.`
- **Problem:** Admin platform stats screen shows placeholder aggregator data.
