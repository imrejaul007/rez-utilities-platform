# REZ Platform — Integration Fixes Log

> Last updated: 2026-04-11
> Documents all critical integration bugs found and fixed in the connectivity audit.

---

## Audit Summary

A full connectivity audit was performed across all 19 services. 27 issues were found.
All critical bugs (10) have been fixed and pushed to GitHub.

---

## Critical Fixes Applied

### 1. API Gateway — nginx /api/marketing trailing slash
**File:** `rez-api-gateway/nginx.conf`  
**Bug:** `location /api/marketing/` (trailing slash) — requests to `/api/marketing` without trailing slash fell through to monolith catch-all instead of routing to rez-marketing-service.  
**Fix:** Changed to `location /api/marketing` (no trailing slash).

### 2. API Gateway — ADS_SERVICE_URL missing from start.sh
**File:** `rez-api-gateway/start.sh`  
**Bug:** nginx.conf referenced `${ADS_SERVICE_URL}` in a map block but start.sh never exported it. nginx crashed on deploy with "unknown ads_service_url variable".  
**Fix:** Added `ADS_SERVICE_URL` with default fallback to monolith URL. Override with actual rez-ads-service URL when deployed.

### 3. API Gateway — ORDER_SERVICE_URL wrong default port
**File:** `rez-api-gateway/start.sh`  
**Bug:** Default was `localhost:3005` but rez-order-service binds to port `4005`.  
**Fix:** Changed default to `localhost:4005`.

### 4. API Gateway — NOTIFICATION_SERVICE_URL validated but never used
**File:** `rez-api-gateway/start.sh`  
**Bug:** rez-notification-events is a pure BullMQ worker with no HTTP API. The `$notification_backend` nginx variable was never used in any `proxy_pass`. Validating it as required in the fail-fast loop caused deploy failures.  
**Fix:** Removed `NOTIFICATION_SERVICE_URL` from the fail-fast validation loop.

### 5. QR Check-in — Missing X-Internal-Service header
**File:** `rezbackend/src/routes/qrCheckinRoutes.ts`  
**Bug:** `fireGamificationVisit()` sent `X-Internal-Token` but not `X-Internal-Service`. The gamification service's `requireInternalToken` middleware needs the caller identity to look up the scoped token from `INTERNAL_SERVICE_TOKENS_JSON`. Without it, all QR check-in gamification calls returned 401 → no coins awarded for QR scans.  
**Fix:** Added `'X-Internal-Service': 'rez-backend'` to request headers.

### 6. Broadcasts — Internal service key name mismatch
**File:** `rezbackend/src/merchantroutes/broadcasts.ts`  
**Bug:** Sent `x-internal-service: rezbackend` but `serviceClient.ts` uses `rez-backend` as the canonical caller identity. Two different keys in `INTERNAL_SERVICE_TOKENS_JSON` → marketing-service would 401 unless both entries existed.  
**Fix:** Changed to `x-internal-service: rez-backend` for consistency.

### 7. Broadcasts — Wrong MARKETING_SERVICE_URL local dev fallback
**File:** `rezbackend/src/merchantroutes/broadcasts.ts`  
**Bug:** Fallback was `localhost:4000` — port 4000 is not bound by rez-marketing-service.  
**Fix:** Updated to `localhost:3008`.

### 8. POST /api/adbazaar/broadcast — Route missing on monolith
**File:** `rezbackend/src/routes/adBazaarIntegration.ts`  
**Bug:** AdBazaar can call `POST /api/adbazaar/broadcast` but the monolith had no `/broadcast` handler — 404. The actual handler is on rez-marketing-service at `/adbazaar/broadcast`.  
**Fix:** Added `POST /broadcast` proxy handler on monolith that forwards to `MARKETING_SERVICE_URL/adbazaar/broadcast` with the same internal auth.

### 9. Gamification & Order service internalAuth — No INTERNAL_SERVICE_TOKEN fallback
**Files:** `rez-gamification-service/src/middleware/internalAuth.ts`, `rez-order-service/src/middleware/internalAuth.ts`  
**Bug:** Both services returned 503 if `INTERNAL_SERVICE_TOKENS_JSON` was not set. The monolith only requires `INTERNAL_SERVICE_TOKEN` (singular). Any deployment that set only the legacy token got 503 from gamification and order service on all internal calls.  
**Fix:** Added legacy fallback — if `INTERNAL_SERVICE_TOKENS_JSON` is absent but `INTERNAL_SERVICE_TOKEN` is set, use that for validation.

### 10. Merchant App — Dev API pointing to non-existent port
**File:** `rezmerchant/rez-merchant-master/config/api.ts`  
**Bug:** Dev fallback URL was `localhost:3007` — nothing binds port 3007.  
**Fix:** Changed to `localhost:5001/api` (monolith dev port).

### 11. Merchant App (outer) — eas.json pointing to monolith directly
**File:** `rezmerchant/eas.json`  
**Bug:** 6 API URL entries pointed to `rez-backend-8dfu.onrender.com/api` (monolith) instead of `rez-api-gateway.onrender.com/api`. Merchant app bypassed the gateway in all builds.  
**Fix:** Updated all 6 entries to use the API gateway URL.

---

## render.yaml Fixes

| Service | Issue | Fix |
|---------|-------|-----|
| **rezbackend** | Missing `OTP_HMAC_SECRET`, `ENCRYPTION_KEY`, `TOTP_ENCRYPTION_KEY`, `INTERNAL_SERVICE_KEY`, `GAMIFICATION_SERVICE_URL` (all hard-required by code) | Added all 5 vars to both api and worker sections |
| **rezbackend** | ~10 duplicate env var entries (webhook secrets listed twice) | Removed all duplicates |
| **rez-wallet-service** | Missing `JWT_SECRET` (required by validateEnv but absent from render.yaml — would crash on Render sync) | Added `JWT_SECRET` |
| **rez-catalog-service** | Empty `envVars` block — no vars declared at all | Added full env block |
| **rez-merchant-service** | No render.yaml existed | Created with all required vars |
| **rez-search-service** | No render.yaml existed | Created with all required vars |
| **rez-notification-events** | No render.yaml existed | Created with all notification provider vars |
| **rez-media-events** | No render.yaml existed | Created with Cloudinary + internal auth vars |
| **analytics-events** | No render.yaml existed | Created with all required vars |

---

## Known Remaining Issues (Not Yet Fixed)

| Issue | Impact | Fix Required |
|-------|--------|-------------|
| Merchant push token registration broken | Merchants never receive push notifications | `POST /notifications/register-token` needs to be implemented in rez-merchant-service (the monolith route was commented out) |
| Online payment cashback deferral unverified | Standard purchase cashback may not credit for Razorpay payment orders | Verify `handlePaymentSuccess` in `paymentService.ts` calls `cashbackService.createCashbackFromOrder()` |
| rez-finance-service strict INTERNAL_SERVICE_TOKENS_JSON | Hard 503 if only `INTERNAL_SERVICE_TOKEN` is set | Must set `INTERNAL_SERVICE_TOKENS_JSON` on rez-finance-service in Render |
| Mobile app blank API keys in eas.json | Firebase push, Razorpay, Google Maps, Cloudinary all non-functional in production builds | Fill in real values before next EAS build |

---

## Service URL Reference (Production)

| Service | URL |
|---------|-----|
| API Gateway | `https://rez-api-gateway.onrender.com` |
| REZ Backend (Monolith) | `https://rez-backend-8dfu.onrender.com` |
| rez-auth-service | `https://rez-auth-service.onrender.com` |
| rez-wallet-service | `https://rez-wallet-service-36vo.onrender.com` |
| rez-payment-service | `https://rez-payment-service.onrender.com` |
| rez-merchant-service | `https://rez-merchant-service-n3q2.onrender.com` |
| rez-catalog-service | `https://rez-catalog-service-1.onrender.com` |
| rez-search-service | `https://rez-search-service.onrender.com` |
| rez-marketing-service | `https://rez-marketing-service.onrender.com` |
| rez-order-service | `https://rez-order-service-hz18.onrender.com` |
| rez-gamification-service | `https://rez-gamification-service-3b5d.onrender.com` |
| analytics-events | `https://analytics-events-37yy.onrender.com` |
| rez-notification-events | BullMQ worker (health :3001) |
| rez-media-events | `https://rez-media-events-lfym.onrender.com` |
| rez-finance-service | `https://rez-finance-service.onrender.com` |
| rez-ads-service | Not yet deployed |
| Hotel OTA API | `https://hotel-ota-api.onrender.com` |
| Hotel PMS | `https://hotel-management-xcsx.onrender.com` |
| AdBazaar | `https://ad-bazaar.vercel.app` |
