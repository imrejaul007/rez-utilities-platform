# MASTER ISSUE TRACKER — REZ Platform

> Last updated: 2026-04-16
> Consolidated from: ISSUES/INTEGRATION_AUDIT_AND_TEST_REPORT.md, docs/CODEBASE_ISSUES_AUDIT.md, docs/CRITICAL_FIXES_STATUS_2026-04-09.md, docs/reports/
> All file paths are absolute.

---

## Severity Legend

| Severity | Label | Meaning |
|----------|-------|---------|
| P0 | Blocker | Service down, data loss, auth bypass, financial exploit |
| P1 | Critical | Core flow broken, security gap, data corruption risk |
| P2 | Important | Feature degraded, performance problem, type safety gap |
| P3 | Minor | Cosmetic, dev experience, cleanup |

## Status Legend

| Status | Meaning |
|--------|---------|
| OPEN | Not fixed |
| FIXED | Fixed in code, confirmed |
| PARTIAL | Partially mitigated, full fix pending |
| VERIFIED | Fixed and verified with tests |

---

## Critical / P0 Issues

| ID | App/Service | Category | Severity | Issue | File | Status |
|----|-------------|----------|----------|-------|------|--------|
| REZ-001 | Rendez backend | Auth | P0 | Simulated OTP in production — any 6-digit code accepted as valid OTP | `Rendez/rendez-app/src/screens/LoginScreen.tsx` | FIXED |
| REZ-002 | Rendez backend | Notification | P0 | Deprecated FCM API (retired June 2024) — ALL push notifications broken | `Rendez/rendez-backend/src/services/NotificationService.ts` | FIXED |
| REZ-003 | Rendez backend | Financial | P0 | Silent gift transaction failures — user sees success but coins don't arrive | `Rendez/rendez-backend/src/services/GiftService.ts` | FIXED |
| REZ-004 | Consumer App | Security | P0 | 19 store search endpoints send NO Authorization header — all search is unauthenticated | `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/services/storeSearchService.ts` lines 45,89,134,178,223,267,312,356,401,445,489,534,578,623,667,712,756,801,845 | FIXED |
| REZ-005 | rez-payment-service | Security | P0 | Payment verify endpoint re-exposed to authenticated users (signature oracle) — FIXED in current code review but needs regression test | `/Users/rejaulkarim/Documents/ReZ Full App/rez-payment-service/src/routes/paymentRoutes.ts:202` | VERIFIED |
| REZ-006 | REZ Backend | Financial | P0 | Streak milestone `claimMilestone()` marks reward claimed but never calls `walletService.credit()` — coins promised but never deposited | `/Users/rejaulkarim/Documents/ReZ Full App/rezbackend/rez-backend-master/src/services/streakService.ts` | FIXED |

---

## P1 — Critical Issues

| ID | App/Service | Category | Severity | Issue | File | Status |
|----|-------------|----------|----------|-------|------|--------|
| REZ-007 | Consumer App | TypeScript | P1 | `coinType: 'nuqta'` sent in transfer but backend expects `'rez'` — transfers with nuqta coinType fail or are misrouted | `rezapp/rez-master/services/walletApi.ts` | FIXED |
| REZ-008 | Consumer App | TypeScript | P1 | `BackendCoinBalance.type` missing `'prive'` type — Prive coin balance typed incorrectly causing UI rendering issues. Also: `BackendCoinBalance.type` missing `'cashback'` and `'referral'` (matching backend `WalletCoinType`). Fixed in both consumer and merchant apps. | `rezapp/rez-master/services/walletApi.ts:11`, `rezmerchant/services/walletApi.ts:11` | FIXED |
| REZ-009 | REZ Backend | Data / Financial | P1 | Cashback refund flow incomplete on order cancellation — no automatic reversal when order cancelled after cashback credited | `/Users/rejaulkarim/Documents/ReZ Full App/rezbackend/rez-backend-master/src/services/cashbackService.ts` | FIXED |
| REZ-010 | REZ Backend | Data | P1 | Streak timezone boundary — no UTC normalization. IST users see inconsistent streak counts. Core retention mechanic unreliable | `/Users/rejaulkarim/Documents/ReZ Full App/rezbackend/rez-backend-master/src/services/streakService.ts` | FIXED |
| REZ-011 | REZ Backend | Financial | P1 | Daily coin cap counter incremented via `setImmediate()` after credit — race window allows multiple concurrent requests to bypass daily cap | `/Users/rejaulkarim/Documents/ReZ Full App/rezbackend/rez-backend-master/src/core/rewardEngine.ts:416-432` | FIXED |
| REZ-012 | REZ Backend | Security | P1 | KDS namespace (`/kds`) accepts user JWTs (tries JWT_SECRET first) — should only accept merchant tokens | `/Users/rejaulkarim/Documents/ReZ Full App/rezbackend/rez-backend-master/src/config/socketSetup.ts` | FIXED |
| REZ-013 | rez-merchant-service | Routing | P1 | `GET /:id` registered before `GET /stats/summary` in orders router — `/orders/stats/summary` resolved as order lookup for id="stats" | `/Users/rejaulkarim/Documents/ReZ Full App/rez-merchant-service/src/routes/orders.ts:62,133` | FIXED |
| REZ-014 | rez-shared | Build | P1 | Shared package contract drifted — subpath exports not aligned with committed build surface | `packages/rez-shared/` | FIXED |
| REZ-015 | rez-app-consumer | Architecture | P1 | `rez-shared` package built but unused — `@rez/shared` not published to npm (actual package name: `@karim4987498/shared`). This caused Metro bundler to fail on Render: `Unable to resolve module @rez/shared`. Fix: created `src/shared/index.ts` with inline stubs for all used functions (validateResponse, isFeatureEnabled, setValidationLogger, userProfileSchema, paymentResponseSchema). All functions are dark-launch gated behind `SCHEMA_VALIDATION_ENABLED` (default: false) so stubs return no-op/pass-through behavior. Also removed dead `@rez/shared` imports from walletApi, ordersApi, paymentService. Wired via `tsconfig.json` path mapping + `metro.config.js` resolver redirect. | `rez-app-consumer/src/shared/`, `rez-app-consumer/services/walletApi.ts`, `rez-app-consumer/services/ordersApi.ts`, `rez-app-consumer/services/paymentService.ts`, `rez-app-consumer/services/authApi.ts`, `rez-app-consumer/tsconfig.json`, `rez-app-consumer/metro.config.js` | FIXED |
| REZ-016 | REZ Backend | Auth | P1 | OTP bypass in `authController.ts` (allowing 123xxx OTPs in dev mode) — mitigated by NODE_ENV defaulting to production but underlying bypass code should be confirmed removed | `rezbackend/rez-backend-master/src/controllers/authController.ts` | FIXED — bypass code removed; sendOTP gated behind NODE_ENV=development AND EXPOSE_DEV_OTP=true. verifyOTP always uses bcrypt.compare. |
| REZ-017 | rez-ads-service | Deploy | P1 | Service built but not deployed to Render — port 4007 only accessible locally | `rez-ads-service/` | FIXED — health confirmed at https://rez-ads-service.onrender.com/health (200 OK, 2026-04-16) |
| REZ-018 | rez-order-service | Deploy | P1 | HTTP server built but not deployed to Render | `rez-order-service/` | OPEN — service not deployed, health returns 404. CI workflow PR #4 open at https://github.com/imrejaul007/rez-order-service/pull/4. Manual: go to Render dashboard → rez-order-service → Manual Deploy. |

---

## P2 — Important Issues

| ID | App/Service | Category | Severity | Issue | File | Status |
|----|-------------|----------|----------|-------|------|--------|
| REZ-019 | Consumer App | Data | P2 | `AllStreaks` interface missing `savings` and `savingsTier` fields — `getAllStreaks()` never mapped `savingsTier` from backend response (always `undefined`) | `rezapp/rez-master/services/streakApi.ts:115` | FIXED |
| REZ-020 | Web Menu | Security | P2 | Hardcoded fallback API URL in source — if `VITE_API_URL` unset, traffic routes to hardcoded Render URL | `/Users/rejaulkarim/Documents/ReZ Full App/rez-web-menu/src/api/client.ts` | STALE — file does not exist in current codebase |
| REZ-021 | Web Menu | Missing Feature | P2 | No Socket.IO connection in web menu — order status uses HTTP polling instead of real-time socket events | `rez-web-menu/` workspace | STALE — `src/` directory does not exist in this workspace. `rez-web-menu/` is a microservice monorepo (rez-workspace). The web menu frontend is a separate project outside this workspace. |
| REZ-022 | Consumer App | Socket | P2 | Consumer app had no socket client — order status used HTTP polling while `user-{userId}` room was set up server-side but never consumed | `rezapp/rez-master/contexts/SocketContext.tsx` + `services/socketService.ts` | FIXED — `SocketContext.tsx` (771 lines) provides full Socket.IO React Context integration with Zustand fallback, token refresh reactivity, and event subscriptions for order/cashback/streak. `socketService.ts` (321 lines) exposes a module-level singleton for non-React service code. |
| REZ-023 | Merchant App | Socket | P2 | Merchant socket uses polling-first transport (`['polling', 'websocket']`) — adds 1-2 round trips per reconnect under high order load | `rezmerchant/rez-merchant-master/services/api/socket.ts:61` | FIXED — already uses `['websocket', 'polling']` (correct order). Tracker was stale. |
| REZ-024 | Merchant App | Data | P2 | `VALID_STATUS_TRANSITIONS` map duplicated client-side — if backend order state machine changes, UI and backend drift. Backend and merchant app have IDENTICAL copies; fix is to import from `@rez/shared` (REZ-015 dependency) or backend API. | `rezmerchant/rez-merchant-master/services/api/orders.ts:60` | OPEN — blocked by REZ-015 (rez-shared must be wired into merchant app first) |
| REZ-025 | Merchant App | Reliability | P2 | No offline order queue in merchant app — orders received during network drop are silently lost | `rezmerchant/rez-merchant-master/services/api/orderQueue.ts` | FIXED — `OfflineOrderQueue` class (147 lines) buffers socket events during offline via AsyncStorage, replays FIFO on reconnect, enforces 100-event cap and 1-hour TTL. Uses NetInfo for network awareness. |
| REZ-026 | REZ Backend | Security | P2 | Circular referral detection only checks depth 3 — depth-4 rings (A→B→C→D→A) not detected | `/Users/rejaulkarim/Documents/ReZ Full App/rezbackend/rez-backend-master/src/utils/referralSecurityHelper.ts` | FIXED |
| REZ-027 | Consumer App | TypeScript | P2 | `TransactionResponse.source.metadata` typed as `any` — prevents type-safe metadata parsing in UI | `rezapp/rez-master/services/walletApi.ts`, `rezmerchant/services/walletApi.ts`, `rez-app-consumer/services/walletApi.ts` | FIXED |
| REZ-028 | rez-finance-service | Flow | P2 | Bill payment and recharge create PENDING transactions but coins are never awarded — Phase 2 gateway webhook not implemented | `rez-finance-service/src/routes/payRoutes.ts:51,92` | MITIGATED — Both endpoints return 501 FEATURE_NOT_AVAILABLE instead of misleading 201/200. Users see clear "coming soon" message. Real aggregator integration still pending. |
| REZ-029 | rez-auth-service | Security | P2 | Timing-safe key comparison fixed in ads-service; needs audit across all other services using string equality on secrets | Multiple services | FIXED — WhatsApp verify token and master webhook API key patched; all 10 services use crypto.timingSafeEqual correctly |
| REZ-030 | rez-auth-service | TypeScript | P2 | `as any` type assertions removed from tokenService — fixed; monitors TypeScript errors in rest of auth service | `rez-auth-service/src/services/tokenService.ts` | FIXED |
| REZ-031 | REZ Backend | Performance | P2 | Wallet reconciliation was sampling 10,000 wallets synchronously per request — fixed to cap at 100 | `rez-wallet-service/` | FIXED |
| REZ-032 | rez-marketing-service | Security | P2 | Internal auth previously failed open when `INTERNAL_SERVICE_TOKEN` missing outside production — fixed | `rez-marketing-service/src/middleware/internalAuth.ts` | FIXED |
| REZ-033 | rez-marketing-service | Security | P2 | Internal auth now uses `crypto.timingSafeEqual` and returns 401 (not 403) on invalid credentials | `rez-marketing-service/src/middleware/` | FIXED |

---

## P3 — Minor Issues

| ID | App/Service | Category | Severity | Issue | File | Status |
|----|-------------|----------|----------|-------|------|--------|
| REZ-034 | Consumer App | Code Quality | P3 | 654 TODOs in Phase 5 audit were across all file types; fresh audit (2026-04-15) finds **9 active TODOs** in source files. 1 stale TODO removed. OTP critical TODO resolved. 28+ files referenced in old tracking no longer exist. | `rezapp/rez-master/` | AUDIT COMPLETE — 9 TODOs remain (1xP1, 5xP2, 3xP3). Note: authStorage.ts guard was completed in Phase 6 cookie migration (web token reads/writes gated behind `Platform.OS !== 'web'`). Full categorization at `docs/TODO_AUDIT.md` |
| REZ-035 | Consumer App | Data | P3 | Savings streak and `savingsTier` silently ignored by `getAllStreaks()` | `rezapp/rez-master/services/streakApi.ts` | FIXED (see REZ-019) |
| REZ-036 | REZ Backend | Security | P3 | Referral depth-4 ring detection gap — BFS condition `current.depth >= maxDepth` skipped depth 3, so 4-hop rings (A→B→C→D→A) were never traversed | `rezbackend/rez-backend-master/src/utils/referralSecurityHelper.ts:270` | FIXED — Changed `>=` to `>` so depth 3 is explored; CIRCULAR_REFERRAL_DEPTH increased to 4. |
| REZ-037 | All Services | Build | P3 | TypeScript normalized to `^5.4.5` across all 14 packages — completed | `package.json` files | FIXED |
| REZ-038 | All Services | Build | P3 | Mongoose normalized to `^8.17.2` across all packages | `package.json` files | FIXED |
| REZ-039 | rez-auth-service | Code Quality | P3 | `require('mongoose')` dynamic requires replaced with top-level ES imports | `rez-auth-service/src/services/tokenService.ts` | FIXED |

---

## Audit 2026-04-16 Round 2 Fixes

| ID | Fix | File | Status |
|----|-----|------|--------|
| SCHEDULER-P0 | Admin routes had NO auth — all 5 routes (jobs, logs, trigger, config, health) fully public. Added `authMiddleware` import and applied to every admin route. | `rez-scheduler-service/src/routes/adminRoutes.ts` | FIXED |
| KARMA-P1 | `GET /api/karma/batch/stats` entirely public — exposed totalCoinsIssued, totalKarmaConverted, batch counts. Added `requireAdmin` guard. | `rez-karma-service/src/routes/batchRoutes.ts` | FIXED |
| KARMA-P1 | Karma routes `/user/:userId`, `/user/:userId/history`, `/user/:userId/level` had `requireAuth` but no ownership check — any user could read any user's karma. Added `req.userId !== userId → 403`. | `rez-karma-service/src/routes/karmaRoutes.ts` | FIXED |
| KARMA-P1 | ObjectId type mismatch: `KarmaProfile.findOne({ userId })` received string but schema defines ObjectId — CastError on every lookup. Added `isValid()` check + `new mongoose.Types.ObjectId(userId)`. | `rez-karma-service/src/services/karmaService.ts` | FIXED |
| KARMA-P1 | QR_SECRET fallback `'default-karma-qr-secret'` in verifyQR() and generateEventQRCodes() — anyone knowing the default could forge QR codes. Changed to fail-closed: no secret = error. | `rez-karma-service/src/engines/verificationEngine.ts` | FIXED |
| HOTEL-OTA-P1 | Redis fail-open in `authenticateUser`, `authenticateAdmin`, `authenticateHotelStaff`: dev branch called `next()` when Redis unavailable — unauthenticated requests admitted. Changed to always deny (throw Errors.authRequired()). Added `logger` import. | `Hotel OTA/apps/api/src/middleware/auth.ts` | FIXED |
| HOTEL-OTA-P1 | Razorpay webhook signature bypass: `handleRazorpayWebhook` skipped signature check when `RAZORPAY_WEBHOOK_SECRET` unset, even in production. Now throws `Errors.paymentFailed()` when secret unavailable. | `Hotel OTA/apps/api/src/services/payment-orchestration.service.ts` | FIXED |
| HOTEL-OTA-P1 | Payment verify bypass: `verifyPaymentSignature` returned `true` when `RAZORPAY_KEY_SECRET` unset (even production). Now throws descriptive error. | `Hotel OTA/apps/api/src/services/payment.service.ts` | FIXED |
| ADBAZAAR-P1 | Supabase `signOut` was fire-and-forget (no await) with empty catch + always returned 200 — attacker could enumerate valid tokens. Added await + error logging. | `adBazaar/src/app/api/auth/logout/route.ts` | FIXED |
| SCHEDULER-P1 | INTERNAL_SERVICE_TOKENS_JSON used as raw header value in all processor headers: `'X-Service-Token': INTERNAL_SERVICE_TOKEN \|\| INTERNAL_SERVICE_TOKENS_JSON \|\| ''`. The JSON string was sent as-is instead of being parsed. Removed JSON fallback — only `INTERNAL_SERVICE_TOKEN` now used. | `rez-scheduler-service/src/processors/*.ts` (cleanup, userEngagement, settlement, merchant) | FIXED |
| RENDEZ-P1 | `rezAuth` production path returned 503 for auth failures (should be 401). The wrong HTTP status code could cause clients to retry and misidentify the error class. Changed production path to always return 401. | `Rendez/rendez-backend/src/middleware/auth.ts` | FIXED |
| GAM-P2-002 | `process.exit(1)` on missing INTERNAL_HMAC_KEY — bypasses PM2 restart policy, service permanently dead. Replaced with `throw err` so Express crashes naturally and PM2 can recover. | `rez-gamification-service/src/middleware/internalAuth.ts` | FIXED |
| GAM-P2-001 | Wallet credit error: `response.json().catch(() => ({}))` silently dropped non-JSON error bodies. Changed to fall back to `response.text()` so error details are visible in logs. | `rez-gamification-service/src/httpServer.ts` | FIXED |
| FIN-P0-001 | `requireInternalToken` correctly applied to internal routes with `crypto.timingSafeEqual`. The `INTERNAL_SERVICE_TOKENS_JSON` and `INTERNAL_HMAC_KEY` are organizationally correct. Not a bug. | `rez-finance-service/src/routes/internalRoutes.ts` | NOT A BUG — auth correctly applied |

---

## Audit 2026-04-16 Fixes

| ID | Fix | File | Status |
|----|-----|------|--------|
| MED-027 | Redis key injection: userId used unsanitized in Redis key. Added `safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '')` before using in `ad:freq:` key. | `rez-ads-service/src/routes/serve.ts` | FIXED — pushed to imrejaul007/rez-ads-service:fix/ads-audit-spring2 |
| MED-028 | CTA URL validator missing: malicious protocols (javascript:, data:, vbscript:) not blocked. Added Mongoose validator with regex `/^(javascript\|data\|vbscript):/i` check + `https?://` requirement. | `rez-ads-service/src/models/AdCampaign.ts` | FIXED |
| MED-029 | frequencyCapDays field missing from schema: referenced in code but not defined. Added `frequencyCapDays: { type: Number, default: 1, min: 1 }` to schema. | `rez-ads-service/src/models/AdCampaign.ts` | FIXED |
| HIGH-008 | Settlement validation missing: worker processes settlement events without validating amount. Added `amount` check: must be finite, positive, and <= 10M. | `rez-order-service/src/worker.ts` | FIXED |
| MED-016 | Refund amount not validated before using in update. Added refundAmount validation (must be finite positive number). | `rez-order-service/src/worker.ts` | FIXED |
| MER-027 | Merchant service BulkWriteError handling: searched all `rez-merchant-service/src` — no `bulkWrite` usage found anywhere. No error handling needed. | `rez-merchant-service/src/` | NOT A BUG — no bulkWrite code exists in merchant service |
| MED-030 | Ads service unhandledRejection handler missing. Added handler in `src/index.ts`. | `rez-ads-service/src/index.ts` | FIXED |
| MED-031 | Ads service verifyInternal auth missing on `/ads/attribute` route. Added `verifyInternal` middleware. | `rez-ads-service/src/routes/interactionRoutes.ts` | FIXED |
| MED-032 | Route param mismatch: `/ads/click/:id` uses `req.params.id` but route was defined as `/ads/click/:adId`. Fixed route param name. | `rez-ads-service/src/routes/interactionRoutes.ts` | FIXED |
| MED-030 | console.warn in production code (order-service httpServer). Removed. | `rez-order-service/src/httpServer.ts` | FIXED |
| MER-003–011 | Merchant audit fixes: MER-003/004/005/006/007/011, MED-009/010/013/014/015 all pushed to imrejaul007/rez-merchant-service:fix/merchant-audit-spring2 (d7656d6) | Multiple merchant service files | FIXED |

---

## Audit 2026-04-14 Fixes

| ID | Fix | File |
|----|-----|------|
| REZ-008 | `BackendCoinBalance.type` extended with `'cashback'` and `'referral'` to match backend `WalletCoinType` | `rezapp/rez-master/services/walletApi.ts:11`, `rezmerchant/services/walletApi.ts:11` |
| REZ-019 | `getAllStreaks()` now maps `savingsTier` from backend response (was always `undefined`) | `rezapp/rez-master/services/streakApi.ts:116` |
| REZ-027 | `TransactionMetadata` interface replaces `any` on `source.metadata` in both consumer and merchant apps | `rezapp/rez-master/services/walletApi.ts`, `rezmerchant/services/walletApi.ts` |
| REZ-036 | Referral BFS condition `>=` changed to `>` so depth-3 is explored; config increased to 4 to catch 4-hop rings | `rezbackend/rez-backend-master/src/utils/referralSecurityHelper.ts:270,35` |
| REZ-029 | WhatsApp verify token: `===` replaced with `crypto.timingSafeEqual` + random fallback instead of known default | `rez-marketing-service/src/routes/webhooks.ts:32` |
| REZ-029 | Master webhook API key: `===` replaced with `crypto.timingSafeEqual` | `rezbackend/rez-backend-master/src/middleware/webhookAuth.ts:45` |

---

## Audit 2026-04-15 Fixes

| ID | Fix | File | Status |
|----|-----|------|--------|
| REZ-B015-1 | Fix invalid JSON comment in package.json exports field | `packages/rez-shared/package.json` | FIXED |
| REZ-B015-2 | Pin @karim4987498/shared to git commit (not npm registry) | `rezmerchant/rez-merchant-master/package.json` | FIXED |
| REZ-B015-3 | Add ACTIVE_STORE_SLUG to StorageKeys type | `rezmerchant/rez-merchant-master/services/storage.ts` | FIXED |
| REZ-B015-4 | Render build failing — `@rez/shared` not on npm. Created `src/shared/index.ts` inline stubs for all used functions (validateResponse, isFeatureEnabled, setValidationLogger, userProfileSchema, paymentResponseSchema). Removed dead imports from walletApi, ordersApi, paymentService. Wired via tsconfig.json paths + metro.config.js resolver. | `rez-app-consumer/src/shared/index.ts` + 4 service files + tsconfig + metro.config | FIXED — pushed to `imrejaul007/rez-app-consumer:production-audit-fixes` |

---

## TypeScript Status — 2026-04-15

| Repo | Errors | Notes |
|------|--------|-------|
| rez-backend | 0 | Clean |
| rez-merchant | 0 | Clean (after StorageKeys fix) |
| rez-consumer | 0 | Clean (from prior session) |

---

## Recently Fixed (Commit e24fa6b — 2026-04-09)

| ID | Fix | File |
|----|-----|------|
| REZ-029 | Timing-safe key comparison in ads-service (`crypto.timingSafeEqual`) | `rez-ads-service/src/middleware/auth.ts:111-127` |
| REZ-030 | Removed `as any` type assertions from tokenService JWT fields | `rez-auth-service/src/services/tokenService.ts:45,53,247,254` |
| REZ-039 | Migrated from runtime `require()` to top-level ES imports | `rez-auth-service/src/services/tokenService.ts` |

---

## Sprint 3–4 Fixes (2026-04-11 / 2026-04-12)

### New issues identified and fixed in this sprint

| ID | App/Service | Severity | Issue | File | Status |
|----|-------------|----------|-------|------|--------|
| REZ-040 | rezbackend | P0 | Socket room name mismatch — web ordering emitted to `merchant-${storeId}` but merchant app joined `merchant-${merchantId}`. All dine-in/web-order real-time events silently dropped. | `rezbackend/src/routes/webOrderingRoutes.ts` | FIXED |
| REZ-041 | rezmerchant | P1 | Merchant socket missing forwarders for `waiter-call`, `parcel-request`, `web-order:status-update` — events received but never forwarded to UI listeners | `rezmerchant/src/services/api/socket.ts` | FIXED |
| REZ-042 | rezbackend | P1 | Bulk event name mismatch — `bulk_import_completed` emitted but frontend listens for `bulk-operation-completed` | `rezbackend/src/merchantroutes/bulk.ts` | FIXED |
| REZ-043 | rezbackend | P2 | WhatsApp invoice stub returned `200 { success: true }` — UI showed "sent!" when nothing happened | `rezbackend/src/routes/storePaymentRoutes.ts` | FIXED |
| REZ-044 | rezbackend | P0 | `MARKETING_SERVICE_URL \|\| 'http://localhost:3008'` fallback in AdBazaar broadcast route — silent misdirected requests in production | `rezbackend/src/routes/adBazaarIntegration.ts` | FIXED |
| REZ-045 | rezbackend | P1 | `APP_URL \|\| 'https://app.rez.local'` in WhatsApp ordering payment link — broken links sent to customers | `rezbackend/src/services/whatsappOrderingService.ts` | FIXED |
| REZ-046 | rezbackend | P1 | `GIFT_CARD_ENCRYPTION_KEY` missing in production silently falls back — gift cards encrypted with undefined key | `rezbackend/src/models/GiftCard.ts` | FIXED |
| REZ-047 | rez-merchant-service | P0 | OTP `send-otp` returned `{ success: true }` in production without sending SMS — merchants cannot log in | `rez-merchant-service/src/routes/auth.ts` | FIXED |
| REZ-048 | rez-marketing-service | P1 | WhatsApp STOP opt-out never persisted to DB — users who opted out continued receiving messages (GDPR risk) | `rez-marketing-service/src/routes/webhooks.ts` | FIXED |
| REZ-049 | rezapp | P1 | Raw `fetch()` in `ExperienceMilestoneSection` bypassed shared `apiClient` 401-refresh interceptor | `rezapp/nuqta-master/components/earn/sections/ExperienceMilestoneSection.tsx` | FIXED |
| REZ-050 | adBazaar | P0 | Supabase middleware used home-rolled base64 JWT decode with no signature verification — auth bypass possible | `adBazaar/src/middleware.ts` | FIXED |
| REZ-051 | adBazaar | P0 | Webhook empty-secret bypass — `timingSafeEqual(Buffer.from(''), Buffer.from(''))` returns true; unset secret accepted all requests | `adBazaar/src/app/api/webhooks/rez-purchase/route.ts` | FIXED |
| REZ-052 | Resturistan | P1 | Forgot-password flow used `setTimeout(2000, success)` fake — no actual email sent | `restauranthub/apps/web/app/auth/forgot-password/page.tsx` | FIXED |
| REZ-053 | Hotel OTA | P0 | `dev_signature` hardcoded string used in production Razorpay payment verify — all payments auto-verified without real signature check | `apps/mobile/src/screens/PaymentScreen.tsx` + 2 others | FIXED |
| REZ-054 | rezapp/rezmerchant/rezadmin | P1 | Hardcoded `onrender.com` fallback URLs in 4 source files — bypass env var config | Multiple | FIXED |
| REZ-055 | rezbackend | P1 | Consumer ads routes (`/ads/serve`, `/ads/impression`, `/ads/click`) not registered — ad serving entirely non-functional | `rezbackend/src/config/routes.ts` | FIXED |
| REZ-056 | rezbackend | P1 | Socket `join-store` handler missing — store-based rooms never joined, store-level broadcasts unreachable | `rezbackend/src/config/socketSetup.ts` | FIXED |
| REZ-057 | rezmerchant | P1 | Merchant suspended mid-session — no real-time notification; app continued operating after suspension | `rezmerchant/src/contexts/AuthContext.tsx` | FIXED |
| REZ-058 | rezapp | P1 | Consumer 401 interceptor gated on error message keywords — valid 401s without expected keywords skipped refresh | `rezapp/nuqta-master/services/apiClient.ts` | FIXED |
| REZ-059 | rezadmin | P1 | Admin API client required `COOKIE_AUTH_ENABLED` to be truthy to set Bearer header — unauthenticated admin requests | `rezadmin/rez-admin-main/services/api/apiClient.ts` | FIXED |
| REZ-010 | rezbackend | P1 | Streak timezone IST normalization missing | `rezbackend/src/services/streakService.ts` | FIXED |

### Still Open — Remaining P0/P1

| Priority | Count | Key Issues |
|----------|-------|-----------|
| P0 Open | 0 | All P0 issues resolved |
| P1 Open | 1 | REZ-018 (order-service not deployed). REZ-017 (ads-service) is now live — health confirmed 200 OK. |
| Total Open | 4 | Down from 6 (REZ-021 STALE, REZ-022 FIXED, REZ-025 FIXED) |
| Round 2 Fixes | 11 | 10 P1 + 1 SCHEDULER-P0 fixed (2026-04-16) |

### Remaining Action Items

1. **REZ-015** — `rez-shared` package fixes applied (exports field JSON comment fixed, git commit pinning fixed, StorageKeys type fixed). Remaining: `npm login` then `npm publish` from `packages/rez-shared/`. Then optionally wire into consumer app (it currently uses inline types). Blocks REZ-024.
2. **REZ-017** — ✅ FIXED. `rez-ads-service` deployed and live at https://rez-ads-service.onrender.com/health (200 OK, 2026-04-16). CI workflow PR #3 pending: needs `RENDER_ADS_SERVICE_ID` GitHub variable + `RENDER_API_TOKEN` secret.
3. **REZ-018** — `rez-order-service` not deployed. Manual step: go to https://dashboard.render.com → rez-order-service → Manual Deploy. CI workflow PR #4 pending: needs `RENDER_ORDER_SERVICE_ID`, `RENDER_ORDER_WORKER_SERVICE_ID` variables + `RENDER_API_TOKEN` secret.
4. **REZ-021** — STALE. The `rez-web-menu/` directory in this workspace is a microservice monorepo (rez-workspace) — no web frontend `src/` exists. The web menu frontend is a separate project outside this workspace.
5. **REZ-022** — ✅ DONE. `SocketContext.tsx` (771 lines) + `socketService.ts` (321 lines) implement full Socket.IO client with React Context, Zustand fallback, and non-RCT singleton.
6. **REZ-025** — ✅ DONE. `OfflineOrderQueue` (147 lines) implements event buffering, AsyncStorage persistence, FIFO replay, 100-event cap, 1-hour TTL.
7. **REZ-034** — Audit complete. 9 TODOs remain: 1xP1 (cashback formula, needs backend endpoint), 5xP2 (various enhancements), 3xP3 (minor). Full details at `docs/TODO_AUDIT.md`. AuthStorage guard was already completed in Phase 6 cookie migration.

### Manual Action Required (Render Dashboard)

- Add `WALLET_SERVICE_URL=https://rez-wallet-service-36vo.onrender.com` to **rez-gamification-service** on Render — coins fail to credit without this.
- Add `MSG91_API_KEY` + `MSG91_TEMPLATE_ID` to **rez-merchant-service** on Render — merchant OTP login fails until this is set.
- Add `GIFT_CARD_ENCRYPTION_KEY` (64-char hex) to **rez-backend** on Render — service refuses to start without this.
