# CRITICAL Bugs — Master Consolidated List

**Source:** All 13 audit generations consolidated
**Total CRITICAL Issues:** ~81 unique bugs (many overlap under different IDs)

---

## Category 1: Build & Runtime Crashes (Stop Everything)

### 1. P0-KARMA-001 / G-KS-B1 / G-KS-C7 / F001-C17 / NA-HIGH-12
**Duplicate `const startOfWeek` — karma system dead**
- **File:** `rez-karma-service/src/services/karmaService.ts:128,195`
- **Severity:** P0 — syntax error at load time
- **Fix:** Remove line 195 (duplicate declaration)
- **Effort:** 5 minutes
- **Sources:** STAYOWN, Karma Service audit, FORENSIC-001, Consumer Audit 2026

### 2. NA-CRIT-04
**`@/types/unified` doesn't exist — TypeScript build fails**
- **Files:** `rez-app-consumer/services/ordersApi.ts:7` + 6 others
- **Severity:** CRITICAL — blocks entire build
- **Fix:** Create `types/unified.ts` or replace imports
- **Effort:** 4 hours

### 3. NA-CRIT-03
**`new Blob()` crashes on iOS/Android**
- **File:** `rez-app-consumer/services/cacheService.ts:216,362,765`
- **Severity:** CRITICAL — runtime crash on all mobile
- **Fix:** Replace with `new TextEncoder().encode(jsonString).length`
- **Effort:** 30 minutes

### 4. NA-CRIT-06
**`showToast` never imported — blocks entire checkout flow**
- **File:** `rez-app-consumer/app/checkout.tsx`
- **Severity:** CRITICAL — runtime crash on checkout
- **Fix:** Add correct `showToast` import
- **Effort:** 5 minutes

---

## Category 2: Financial Fraud & Money Loss

### 5. NA-CRIT-02
**Bill amount client-controlled — fraud vector**
- **File:** `rez-app-consumer/services/billVerificationService.ts`
- **Severity:** CRITICAL — unbounded coin generation
- **Fix:** Server computes cashback from OCR value, never from client
- **Effort:** 4 hours

### 6. NA-CRIT-07
**Double-tap on payment submit — no debounce guard**
- **Files:** `app/bill-upload-enhanced.tsx:387`, `hooks/useCheckoutUI.ts:349`
- **Severity:** CRITICAL — duplicate order creation
- **Fix:** Add `isSubmittingRef` guard to both handlers
- **Effort:** 30 minutes

### 7. NA-CRIT-11
**Wallet balance in plain AsyncStorage**
- **File:** `rez-app-consumer/stores/walletStore.ts:51-53`
- **Severity:** CRITICAL — financial data readable on rooted devices
- **Fix:** Use `expo-secure-store` or fetch fresh from API
- **Effort:** 2 hours

### 8. AB-C1
**`rez_user_id` spoofable via URL query param — coin fraud**
- **File:** `adBazaar/src/app/api/qr/scan/[slug]/route.ts:72`
- **Severity:** CRITICAL — credit coins to any user
- **Fix:** Pass user ID from Supabase session, not URL
- **Effort:** 30 minutes

### 9. AB-C5
**Payment amount never verified server-side**
- **File:** `adBazaar/src/app/api/bookings/[id]/verify-payment/route.ts:76-88`
- **Severity:** CRITICAL — pay Rs.1 for Rs.50,000 booking
- **Fix:** Fetch Razorpay payment and verify amount matches
- **Effort:** 1 hour

### 10. CS-M12 / G-MA-C08
**Offline idempotency key assigned AFTER INSERT**
- **File:** `rezmerchant/services/offlinePOSQueue.ts:58-80`
- **Severity:** CRITICAL — double-charge on retry
- **Fix:** Assign key BEFORE INSERT
- **Effort:** 1 hour

### 11. CS-M13 / G-MA-C09
**Failed offline bills silently removed from queue**
- **File:** `rezmerchant/services/offlinePOSQueue.ts:260-263`
- **Severity:** CRITICAL — revenue lost with zero trace
- **Fix:** Notify merchant, don't silently remove
- **Effort:** 1 hour

### 12. CS-M14 / G-MA-C10
**Batch sync partial failure re-sends ALL bills**
- **File:** `rezmerchant/services/offlinePOSQueue.ts:232-275`
- **Severity:** CRITICAL — double-charge if idempotency gap
- **Fix:** Track processed vs unprocessed, resend only unprocessed
- **Effort:** 2 hours

### 13. CS-M15 / G-MA-C02
**Coin redemption not in POS payment payload**
- **File:** `rezmerchant/app/pos/index.tsx:247,675-689,711`
- **Severity:** CRITICAL — merchant revenue leak, coin pool over-issued
- **Fix:** Include `coinRedemption` in payload
- **Effort:** 2 hours

### 14. CS-M16 / G-MA-C03
**Offline bill loses coin discount entirely**
- **Files:** `rezmerchant/app/pos/index.tsx:658-674` + `services/offlinePOSQueue.ts:224-230`
- **Severity:** CRITICAL — customer silently overcharged
- **Fix:** Store coin data in queue, send on sync
- **Effort:** 1 hour

### 15. FE-PAY-001 / A10-C4 / CS-M1
**PaymentMachine in-memory — no cross-request protection**
- **File:** `rez-payment-service/src/routes/paymentRoutes.ts:17-41,369-381`
- **Severity:** CRITICAL — double wallet credit
- **Fix:** Read DB state before transitioning; use `findOneAndUpdate` CAS
- **Effort:** 30 minutes

### 16. FE-PAY-002
**Monolith webhook no event deduplication**
- **File:** `rezbackend/.../src/controllers/paymentController.ts`
- **Severity:** CRITICAL — duplicate payment processing
- **Fix:** Add Redis `SET NX` dedup with 24h TTL
- **Effort:** 30 minutes

### 17. F001-C1
**Settlement blind spot — merchant vs merchantId field**
- **File:** `rez-merchant-service/src/services/settlementService.ts:49`
- **Severity:** CRITICAL — systematic merchant underpayment
- **Fix:** Query both `merchant` and `merchantId` fields
- **Effort:** 2 hours

### 18. F001-C3
**Merchant withdrawal TOCTOU race condition**
- **File:** `rez-wallet-service/src/services/merchantWalletService.ts`
- **Severity:** CRITICAL — potential double-payout
- **Fix:** Atomic check-and-update with CAS filter
- **Effort:** 1 hour

### 19. F001-C7
**FraudFlag model missing — silent drop**
- **File:** `rezbackend/.../`
- **Severity:** CRITICAL — fraud goes undetected
- **Fix:** Create FraudFlag model and wire it
- **Effort:** 2 hours

### 20. RZ-B-C2
**Payment webhook race — double reward issuance**
- **File:** `rendez-backend/src/routes/webhooks/rez.ts:49`
- **Severity:** CRITICAL — duplicate coin issuance
- **Fix:** Atomic check-and-update inside Prisma transaction
- **Effort:** 1 hour

### 21. NW-CRIT-001
**Idempotency key uses `Date.now()` — double coin credit on retry**
- **Files:** `rez-now/lib/api/client.ts:73-75`, `lib/api/orders.ts:67`, `lib/api/scanPayment.ts:34`
- **Severity:** CRITICAL — real money loss
- **Fix:** Remove `Date.now()` from idempotency key. Use `${type}:${key}` instead of `${type}:${key}:${Date.now()}`
- **Effort:** 30 minutes

### 22. NW-CRIT-004
**Socket.IO connects once per menu item — N items = N WebSocket connections**
- **File:** `rez-now/components/menu/MenuItem.tsx:36-59`
- **Severity:** CRITICAL — infrastructure failure
- **Fix:** Create a single shared Socket.IO connection per store via React context or Zustand store
- **Effort:** 2 hours

### 23. NW-CRIT-005
**Waiter call endpoints have no authorization**
- **Files:** `rez-now/lib/api/waiter.ts:22-28`, `lib/api/waiterStaff.ts:28-37`
- **Severity:** CRITICAL — anyone can call/cancel waiter for any store
- **Fix:** Require `authClient` with store-scoped JWT on all waiter endpoints
- **Effort:** 1 hour

### 24. NW-CRIT-006
**10-second payment timeout shows fake success UI**
- **Files:** `rez-now/lib/hooks/usePaymentConfirmation.ts:68-74`
- **Severity:** CRITICAL — chargeback risk
- **Fix:** After 10s timeout, show "Payment may still be processing" instead of success UI
- **Effort:** 30 minutes

### 25. NW-CRIT-007
**Offline queue silently discards orders after MAX_RETRIES**
- **File:** `rez-now/lib/utils/offlineQueue.ts:123-127`
- **Severity:** CRITICAL — silent data loss with financial impact
- **Fix:** Emit `rez:order-sync-failed` event and show persistent banner before deletion
- **Effort:** 1 hour

### 26. NW-CRIT-008
**Pay-display confirm/reject API paths structurally wrong — always 404**
- **File:** `rez-now/app/[storeSlug]/merchant/pay-display/PayDisplayClient.tsx:54-69`
- **Severity:** CRITICAL — merchant actions silently fail
- **Fix:** Change URLs from `/api/web-ordering/store/${paymentId}/confirm` to `/api/web-ordering/store/${storeSlug}/payments/${paymentId}/confirm`
- **Effort:** 30 minutes

### 27. NW-CRIT-009
**Reorder creates `price: 0` items — merchant loses all revenue**
- **Files:** `rez-now/app/orders/OrderHistoryClient.tsx:271-283`, `lib/api/reorder.ts:66-82`
- **Severity:** CRITICAL — merchant loses revenue on every reorder
- **Fix:** Preserve real `menuItemId` and original `price` from `OrderResponse.data.items[i]`
- **Effort:** 30 minutes

### 28. NW-CRIT-010
**ScanPayOrderResponse.paymentId doesn't exist in backend response**
- **Files:** `rez-now/lib/types/index.ts:286-292`, `lib/api/scanPayment.ts:4-14`
- **Severity:** CRITICAL — silent payment tracking failure
- **Fix:** Remove `paymentId` from `ScanPayOrderResponse`. It's only available from Razorpay SDK callback, not backend
- **Effort:** 30 minutes

### 29. NW-CRIT-011
**Coupon endpoint enumerable + unauthenticated coupon list**
- **Files:** `rez-now/lib/api/cart.ts:16-27`, `lib/api/coupons.ts:12-18`
- **Severity:** CRITICAL — coupon enumeration attack + disclosure
- **Fix:** Require CAPTCHA after 3 failed attempts. Don't expose coupon codes to unauthenticated users
- **Effort:** 1 hour

### 30. NW-CRIT-012
**UPI socket subscribes to razorpayOrderId instead of paymentId**
- **File:** `rez-now/components/checkout/PaymentOptions.tsx:95-103`
- **Severity:** CRITICAL — UPI payments always show "timed out" even on success
- **Fix:** Call backend to initiate UPI intent (returns `paymentId`), then subscribe using that `paymentId`
- **Effort:** 1 hour

### 31. NW-CRIT-013
**NFC creates Razorpay order with zero user confirmation**
- **File:** `rez-now/app/[storeSlug]/pay/checkout/page.tsx:182-212`
- **Severity:** CRITICAL — phantom orders, potential unauthorized charges
- **Fix:** Require user confirmation before `createScanPayOrder`. Check for existing pending orders before creating new ones
- **Effort:** 1 hour

### 32. NW-CRIT-002
**Payment verification hardcoded to { verified: true }**
- **File:** `rez-now/lib/api/payment.ts:39`
- **Severity:** CRITICAL — accepts any payment as valid
- **Fix:** Call server-side payment verification
- **Effort:** 30 minutes

### 22. CS-M9
**Visit milestone dedup key 1-second collision**
- **File:** `rez-wallet-service/src/services/walletService.ts`
- **Severity:** CRITICAL — users lose milestone rewards
- **Fix:** Use millisecond resolution: `Date.now()` not `Math.floor(Date.now() / 1000)`
- **Effort:** 10 minutes

### 23. G-KS-B4
**Auto-checkout doesn't create EarnRecord — karma lost**
- **File:** `rez-karma-service/src/workers/autoCheckoutWorker.ts:119-124`
- **Severity:** CRITICAL — karma permanently lost
- **Fix:** Create partial EarnRecord after auto-checkout
- **Effort:** 30 minutes

### 24. G-KS-B10
**`eventsCompleted` double-increment**
- **File:** `rez-karma-service/src/services/karmaService.ts`
- **Severity:** CRITICAL — karma inflation
- **Fix:** Guard increment with existing record check
- **Effort:** 1 hour

---

## Category 3: Security Exploits

### 25. BE-MER-OTP-001 / G-MA-C6
**OTP brute-force — merchant accounts hackable**
- **File:** `rez-merchant-service/src/routes/auth.ts:496-517`
- **Severity:** CRITICAL — full merchant account takeover
- **Fix:** Redis rate limiter: 3 failed attempts → 15-min lockout
- **Effort:** 30 minutes

### 26. SEC-KARMA-SSRF-001 / G-KS-C2 / F001-C4
**SSRF + auth bypass in karma service**
- **File:** `rez-karma-service/src/middleware/auth.ts:41-61`
- **Severity:** CRITICAL — arbitrary admin impersonation
- **Fix:** Replace HTTP call with local JWT verification using shared secret
- **Effort:** 15 minutes

### 27. SEC-MER-SENS-001 / AB-C3
**Bank details plaintext — GDPR/RBI violation**
- **Files:** `rez-merchant-service/src/routes/onboarding.ts:53-54` + `AB profile API`
- **Severity:** CRITICAL — compliance violation + breach risk
- **Fix:** AES-256-GCM field-level encryption using ENCRYPTION_KEY
- **Effort:** 2 hours

### 28. SEC-MER-INJECT-001 / G-MA-C5
**MongoDB object injection — prototype pollution**
- **File:** `rez-merchant-service/src/routes/customers.ts:93-126`
- **Severity:** CRITICAL — application behavior corruption
- **Fix:** Validate input as scalar strings, explicit nested object construction
- **Effort:** 30 minutes

### 29. CS-S1 / A10-C5 / F001-C11
**HMAC key from env var NAME not value**
- **File:** `rez-order-service/src/middleware/internalAuth.ts:40-46`
- **Severity:** CRITICAL — all internal endpoints unauthenticated
- **Fix:** Throw error if env var unset; use `.value`, not `.name`
- **Effort:** 15 minutes

### 30. CS-S2
**JWT verify without algorithm whitelist**
- **File:** `rez-api-gateway/src/shared/authMiddleware.ts:65`
- **Severity:** CRITICAL — token forgery via alg:none
- **Fix:** Add `algorithms: ['HS256']` to jwt.verify options
- **Effort:** 10 minutes

### 31. CS-S3
**Redis fail-open outside production**
- **File:** `rez-order-service/src/httpServer.ts:202-224`
- **Severity:** CRITICAL — revoked tokens work in staging
- **Fix:** Fail closed always; log warning in non-prod
- **Effort:** 15 minutes

### 32. CS-S4 / A10-C6
**SSE order stream no merchant ownership check**
- **File:** `rez-order-service/src/httpServer.ts:473-533`
- **Severity:** CRITICAL — competitor monitors any merchant's orders
- **Fix:** Verify `merchantId === authUser.merchantId`
- **Effort:** 30 minutes

### 33. CS-S-M1
**IDOR on order detail — no ownership check**
- **File:** `rezmerchant/app/(dashboard)/orders/[id].tsx:117`
- **Severity:** CRITICAL — view any merchant's orders
- **Fix:** Verify order's storeId matches authenticated merchant's storeId
- **Effort:** 30 minutes

### 34. CS-S-M2
**Biometric auth bypass when hardware unavailable**
- **File:** `rezmerchant/utils/biometric.ts:52`
- **Severity:** CRITICAL — unconditional access on simulators
- **Fix:** Require PIN/password fallback when hardware unavailable
- **Effort:** 1 hour

### 35. G-KS-C1
**Hardcoded default QR secret**
- **File:** `rez-karma-service/src/utils/verificationEngine.ts:176`
- **Severity:** CRITICAL — forgeable QR codes
- **Fix:** Fail if QR_SECRET env var is not set
- **Effort:** 10 minutes

### 36. G-KS-C5
**Batch stats endpoint unauthenticated**
- **File:** `rez-karma-service/src/routes/batchRoutes.ts:220`
- **Severity:** CRITICAL — internal data exposed
- **Fix:** Add `requireAdminAuth` middleware
- **Effort:** 5 minutes

### 37. G-KS-C6
**TimingSafeEqual throws on length mismatch**
- **File:** `rez-karma-service/src/utils/verificationEngine.ts:183`
- **Severity:** CRITICAL — HMAC bypass via exception
- **Fix:** Check lengths first before calling timingSafeEqual
- **Effort:** 5 minutes

### 38. F001-C6
**Admin cron uses consumer JWT auth**
- **File:** `rezbackend/.../src/routes/admin.ts`
- **Severity:** CRITICAL — privilege escalation
- **Fix:** Use service-to-service auth, not consumer JWT
- **Effort:** 1 hour

### 39. F001-C12
**Firebase JSON on disk**
- **File:** `rezbackend/.../`
- **Severity:** CRITICAL — credentials on disk
- **Fix:** Use Firebase Admin SDK with env vars or metadata service
- **Effort:** 1 hour

### 40. F001-C14
**Static files served without auth**
- **File:** `media-events/http.ts`
- **Severity:** CRITICAL — private files publicly accessible
- **Fix:** Add auth check before serving
- **Effort:** 30 minutes

### 41. NW-CRIT-003
**Merchant panel zero auth — /merchant/* unprotected**
- **File:** `rez-now/middleware.ts:14`
- **Severity:** CRITICAL — full merchant panel public
- **Fix:** Add merchant routes to PROTECTED_PATHS
- **Effort:** 2 hours

### 42. NW-CRIT-014
**Tokens stored in plain localStorage**
- **File:** `rez-now/lib/api/client.ts:37`
- **Severity:** CRITICAL — XSS token theft
- **Fix:** Use httpOnly cookies or secure storage
- **Effort:** 2 hours

### 43. RZ-B-C1
**Gift voucher authorization bypass**
- **File:** `rendez-backend/src/routes/gift.ts:80`
- **Severity:** CRITICAL — retrieve any user's voucher QR
- **Fix:** Verify caller owns the profileId from JWT
- **Effort:** 30 minutes

### 44. RZ-B-C4
**Socket read_receipt bypasses matchId ownership**
- **File:** `rendez-backend/src/realtime/socketServer.ts:155`
- **Severity:** CRITICAL — read-receipt spoofing
- **Fix:** Add `matchId` ownership check on message query
- **Effort:** 30 minutes

### 45. G-KS-C3
**jwtSecret unvalidated at startup**
- **File:** `rez-karma-service/src/config/index.ts:22`
- **Severity:** CRITICAL — weak/default secret
- **Fix:** Throw error if jwtSecret is missing or too short
- **Effort:** 5 minutes

### 46. G-KS-C4
**Horizontal privilege escalation on profile routes**
- **File:** `rez-karma-service/src/routes/karmaRoutes.ts:29`
- **Severity:** CRITICAL — modify any user's karma
- **Fix:** Add ownership check on all routes
- **Effort:** 10 minutes

---

## Category 4: Data Integrity & Sync

### 47. NA-CRIT-08 / CS-E10 / G-MA-H02
**Payment polling `'completed'` vs `'paid'` — 90s hang**
- **File:** `rez-app-consumer/services/paymentService.ts:243`
- **Severity:** CRITICAL — users see spinner for 90 seconds
- **Fix:** Add `'paid'` to terminal state check
- **Effort:** 30 minutes

### 48. NA-CRIT-09
**`Math.random()` for ID generation**
- **File:** `rez-app-consumer/services/offlineSyncService.ts:436`
- **Severity:** CRITICAL — predictable IDs, collision possible
- **Fix:** Use `uuid.v4()`
- **Effort:** 10 minutes

### 49. NA-CRIT-05
**QR check-in has zero QR scanning code**
- **File:** `rez-app-consumer/app/qr-checkin.tsx`
- **Severity:** CRITICAL — coins cannot be earned via QR
- **Fix:** Integrate `expo-camera` for QR scanning
- **Effort:** 8 hours

### 50. NA-CRIT-10
**UPI payment silently does nothing**
- **File:** `rez-app-consumer/app/pay-in-store/payment.tsx:210-235`
- **Severity:** CRITICAL — UPI payment broken
- **Fix:** Implement server-side UPI collect or deep link to native app
- **Effort:** 2 hours

### 51. F001-C5
**Karma 2x inflation — double increment**
- **File:** `rez-karma-service/src/services/earnRecordService.ts`
- **Severity:** CRITICAL — karma values doubled
- **Fix:** Guard with existing record check
- **Effort:** 1 hour

### 52. F001-C15
**Finance service silent coin failure**
- **File:** `rez-finance-service/src/...`
- **Severity:** CRITICAL — coins silently not credited
- **Fix:** Return error, don't swallow; add retry queue
- **Effort:** 2 hours

### 53. F001-C13 / CS-E9 / CS-E19
**Order statuses out of sync (14 vs 11 values)**
- **Files:** Multiple across all surfaces
- **Severity:** CRITICAL — inconsistent order states
- **Fix:** Standardize on canonical OrderStatus enum
- **Effort:** 3 hours

---

## Status Summary

| ID | Status | Effort |
|----|--------|--------|
| P0-KARMA-001 | ACTIVE | 5 min |
| NA-CRIT-02 | ACTIVE | 4h |
| NA-CRIT-03 | ACTIVE | 30m |
| NA-CRIT-04 | ACTIVE | 4h |
| NA-CRIT-05 | ACTIVE | 8h |
| NA-CRIT-06 | ACTIVE | 5m |
| NA-CRIT-07 | ACTIVE | 30m |
| NA-CRIT-08 | ACTIVE | 30m |
| NA-CRIT-09 | ACTIVE | 10m |
| NA-CRIT-10 | ACTIVE | 2h |
| NA-CRIT-11 | ACTIVE | 2h |
| BE-MER-OTP-001 | ACTIVE | 30m |
| SEC-KARMA-SSRF-001 | ACTIVE | 15m |
| SEC-MER-SENS-001 | ACTIVE | 2h |
| SEC-MER-INJECT-001 | ACTIVE | 30m |
| AB-C1 | ACTIVE | 30m |
| AB-C5 | ACTIVE | 1h |
| CS-M12 | ACTIVE | 1h |
| CS-M13 | ACTIVE | 1h |
| CS-M14 | ACTIVE | 2h |
| CS-M15 | ACTIVE | 2h |
| CS-M16 | ACTIVE | 1h |
| FE-PAY-001 | ACTIVE | 30m |
| FE-PAY-002 | ACTIVE | 30m |
| F001-C1 | ACTIVE | 2h |
| F001-C3 | ACTIVE | 1h |
| F001-C5 | ACTIVE | 1h |
| F001-C6 | ACTIVE | 1h |
| F001-C7 | ACTIVE | 2h |
| F001-C11 | ACTIVE | 15m |
| F001-C12 | ACTIVE | 1h |
| F001-C13 | ACTIVE | 3h |
| F001-C14 | ACTIVE | 30m |
| F001-C15 | ACTIVE | 2h |
| CS-S1 | ACTIVE | 15m |
| CS-S2 | ACTIVE | 10m |
| CS-S3 | ACTIVE | 15m |
| CS-S4 | ACTIVE | 30m |
| CS-S-M1 | ACTIVE | 30m |
| CS-S-M2 | ACTIVE | 1h |
| G-KS-C1 | ACTIVE | 10m |
| G-KS-C3 | ACTIVE | 5m |
| G-KS-C4 | ACTIVE | 10m |
| G-KS-C5 | ACTIVE | 5m |
| G-KS-C6 | ACTIVE | 5m |
| G-KS-B4 | ACTIVE | 30m |
| G-KS-B10 | ACTIVE | 1h |
| RZ-B-C1 | ACTIVE | 30m |
| RZ-B-C2 | ACTIVE | 1h |
| RZ-B-C4 | ACTIVE | 30m |
| NW-CRIT-002 | ACTIVE | 30m |
| NW-CRIT-003 | ACTIVE | 2h |
| NW-CRIT-014 | ACTIVE | 2h |
| CS-M9 | ACTIVE | 10m |
| A10-C5 | ACTIVE | 15m |
| A10-C6 | ACTIVE | 30m |
| NW-CRIT-001 | ACTIVE | 30m |
| NW-CRIT-004 | ACTIVE | 2h |
| NW-CRIT-005 | ACTIVE | 1h |
| NW-CRIT-006 | ACTIVE | 30m |
| NW-CRIT-007 | ACTIVE | 1h |
| NW-CRIT-008 | ACTIVE | 30m |
| NW-CRIT-009 | ACTIVE | 30m |
| NW-CRIT-010 | ACTIVE | 30m |
| NW-CRIT-011 | ACTIVE | 1h |
| NW-CRIT-012 | ACTIVE | 1h |
| NW-CRIT-013 | ACTIVE | 1h |
| RP-C01 | ACTIVE | 1h |
| RP-C02 | ACTIVE | 2h |
| RP-C03 | ACTIVE | 1h |
| RP-C04 | ACTIVE | 2h |
| RP-C05 | ACTIVE | 2h |
| RP-C06 | ACTIVE | 1h |
| RP-C07 | ACTIVE | 1h |
| RP-C08 | ACTIVE | 1h |
| RP-C09 | ACTIVE | 2h |
| RP-C10 | ACTIVE | 30m |
| RP-C11 | ACTIVE | 4h |
| RP-C12 | ACTIVE | 2h |
| RP-C13 | ACTIVE | 2h |
| RP-C14 | ACTIVE | 1h |
| RP-C15 | ACTIVE | 1h |

---

## Category 5: RestoPapa / Gen 14 Cross-Service CRITICALs

### 54. RP-C01
**Karma Service HTTP Routes Return 501 — Never Mounted**
- **Files:** `rez-karma-service/src/routes/index.ts`, `karmaRoutes.ts`, `verifyRoutes.ts`, `batchRoutes.ts`
- **Severity:** CRITICAL — karma service endpoints non-functional
- **Fix:** Replace 501 stubs with proper `app.use()` calls to actual route handlers
- **Effort:** 1 hour

### 55. RP-C02
**CrossAppSyncService Webhook Delivery Is Dead Code**
- **File:** `Rendez/rendez-backend/src/merchantservices/CrossAppSyncService.ts:261-293`
- **Severity:** CRITICAL — merchant changes never reach consumer app
- **Fix:** Uncomment and fix webhook HTTP call. Replace in-memory webhook registry with MongoDB persistence
- **Effort:** 2 hours

### 56. RP-C03
**syncOrders() + syncCashback() Are No-Ops**
- **File:** `Rendez/rendez-backend/src/merchantservices/SyncService.ts:396-409`
- **Severity:** CRITICAL — sync returns `{ synced: 0 }` but wraps as `{ success: true }`
- **Fix:** Implement actual sync logic or return `{ success: false }` with error message
- **Effort:** 1 hour

### 57. RP-C04
**Double Karma Credit — Both earnRecordService and karmaService credit karma**
- **Files:** `rez-karma-service/src/services/earnRecordService.ts`, `karmaService.ts`
- **Severity:** CRITICAL — karma pool depleted 2x faster
- **Fix:** Identify sole author of karma credits. Disable the duplicate path
- **Effort:** 2 hours

### 58. RP-C05
**Batch Pool Decrement Before Record Save — No Transaction**
- **File:** `rez-karma-service/src/services/batchService.ts`
- **Severity:** CRITICAL — pool permanently corrupted if save fails
- **Fix:** Wrap decrement and save in MongoDB transaction, or decrement only after successful save
- **Effort:** 2 hours

### 59. RP-C06
**Referral Credit Is Fire-and-Forget — No Retry**
- **File:** `ReferralService.ts`
- **Severity:** CRITICAL — referrer never receives bonus on failure
- **Fix:** Add retry with exponential backoff + DLQ for failed referral credits
- **Effort:** 1 hour

### 60. RP-C07
**Referral Credit Race Condition**
- **File:** `ReferralService.ts`
- **Severity:** CRITICAL — concurrent completions cause double-credit or silent failure
- **Fix:** Add idempotency key `(referrerId, refereeId, referralId)`
- **Effort:** 1 hour

### 61. RP-C08
**Admin Auth Bypass — requireAdmin Is Undefined**
- **File:** `rez-karma-service/src/routes/batchRoutes.ts:220`
- **Severity:** CRITICAL — financial batch stats exposed without auth
- **Fix:** Add `import { requireAdminAuth as requireAdmin }` or replace with `requireAdminAuth`
- **Effort:** 1 hour

### 62. RP-C09
**Wallet Service Calls Have No Authentication**
- **File:** `rez-karma-service/src/services/walletIntegration.ts`
- **Severity:** CRITICAL — anyone reaching WALLET_SERVICE_URL can credit arbitrary wallets
- **Fix:** Add `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>` on all wallet service requests
- **Effort:** 2 hours

### 63. RP-C10
**JWT Secret Fallback in Test Files**
- **Files:** `Rendez/rendez-backend/src/tests/setup.ts:11`, `criticalPath.test.ts:82`
- **Severity:** CRITICAL — hardcoded test secret as fallback
- **Fix:** Throw error on missing env var. Fail builds with missing env vars via CI
- **Effort:** 30 minutes

### 64. RP-C11
**3 Incompatible CoinTransaction Schemas, Same Collection**
- **Files:** `rezbackend/models/CoinTransaction.ts`, `rez-wallet-service/models/CoinTransaction.ts`, `rez-merchant-service/models/CoinTransaction.ts`
- **Severity:** CRITICAL — active data corruption
- **Fix:** Define canonical CoinTransaction schema in shared-types. Migrate existing records
- **Effort:** 4 hours

### 65. RP-C12
**cashback + referral Coins Invisible in Wallet/Ledger**
- **Files:** `coinTypes.ts`, `rez-wallet-service/models/Wallet.ts`, `LedgerEntry.ts`
- **Severity:** CRITICAL — double-entry accounting broken for cashback/referral
- **Fix:** Add cashback and referral to Wallet.coin type enum and LedgerEntry support
- **Effort:** 2 hours

### 66. RP-C13
**IEarnRecord.verificationSignals — Canonical vs Actual Mismatch**
- **Files:** `packages/shared-types/src/entities/karma.ts` vs `rez-karma-service/src/models/EarnRecord.ts`
- **Severity:** CRITICAL — canonical type has different field names than actual model
- **Fix:** Align canonical type with actual model fields, or update model to match canonical
- **Effort:** 2 hours

### 67. RP-C14
**Frontend Missing voucherCode + offerRedemptionCode in Order Payload**
- **Files:** `rez-app-consumer/services/ordersApi.ts:170-210` vs `rezbackend/src/controllers/orderCreateController.ts:329-334`
- **Severity:** CRITICAL — voucher/offer redemptions silently ignored
- **Fix:** Add `voucherCode?: string` and `offerRedemptionCode?: string` to `CreateOrderRequest` interface
- **Effort:** 1 hour

### 68. RP-C15
**Admin Missing store.merchantId in Order Response**
- **Files:** `rez-app-admin/services/api/orders.ts:18` vs `rezbackend/src/controllers/orderController.ts`
- **Severity:** CRITICAL — "Filter by merchant" returns ALL orders regardless of merchant
- **Fix:** Add `merchantId` to the store populate call in orderController.ts
- **Effort:** 1 hour
