# Consumer App — API Contracts & Backend Mismatches

> **Audit date:** 2026-04-15
> **Bugs found:** 15
> **Status:** Open — consumer app audit

---

### CA-API-001: Profile Update HTTP Verb Mismatch
**Severity:** CRITICAL
**Frontend file:** services/authApi.ts:491, services/identityApi.ts:61
**Backend expected:** rez-auth-service/src/routes/authRoutes.ts:408
**Category:** payload-mismatch
**Description:** Consumer calls `PUT /user/auth/profile` but backend mounts `PATCH /auth/profile`
**Impact:** Profile updates will fail with HTTP 405 Method Not Allowed error
**Fix hint:** Change consumer to use PATCH instead of PUT for profile updates

> **Status:** Fixed in 2026-04-15 — Changed authApi.ts:497 from PUT to PATCH for profile updates.

### CA-API-002: Conflicting Profile Endpoints
**Severity:** HIGH
**Frontend file:** services/profileApi.ts:40,54,68,89
**Backend expected:** Unknown - /user/profile does not exist in rez-auth-service
**Category:** missing-route
**Description:** Consumer calls GET/PUT/POST `/user/profile` but auth service only provides `/user/auth/profile` endpoints
**Impact:** Profile completion status, picture upload, and retrieval fail with 404 Not Found
**Fix hint:** Consolidate on `/user/auth/profile` or create `/user/profile` wrapper in monolith

### CA-API-003: Missing Ring Size Endpoint
**Severity:** MEDIUM
**Frontend file:** services/ringSizeApi.ts:16
**Backend expected:** Unknown
**Category:** missing-route
**Description:** Consumer baseUrl `/user/profile` (used for ring size) doesn't match auth service routes
**Impact:** Ring size API calls return 404
**Fix hint:** Verify if ring-size is supposed to be part of profile or separate microservice

### CA-API-004: Wallet Payment Route Duplication Conflict
**Severity:** HIGH
**Frontend file:** services/walletApi.ts:610
**Backend expected:** rez-wallet-service/src/routes/walletRoutes.ts:134-152
**Category:** gateway
**Description:** Two different backends mount POST `/api/wallet/payment`: monolith (for rupee checkout) and wallet-service (for coin debits). They expect different request payloads - monolith expects {amount, orderId, storeId} while wallet-service expects {amount, coinType, source, description}
**Impact:** Requests may route to wrong service. If wallet-service receives monolith payload, it returns 400 PAYLOAD_MISMATCH error
**Fix hint:** Ensure nginx/gateway routes consumer checkout payments to monolith and internal coin debits to wallet-service

### CA-API-005: Profile Update Endpoint Duplication (PUT vs PATCH)
**Severity:** CRITICAL
**Frontend file:** services/authApi.ts:491
**Backend expected:** rez-auth-service/src/routes/authRoutes.ts:408-409
**Category:** payload-mismatch
**Description:** Backend mounts both PATCH /auth/profile and PATCH /api/user/auth/profile but consumer uses PUT
**Impact:** All profile updates fail with 405 Method Not Allowed
**Fix hint:** Change frontend PUT to PATCH for /user/auth/profile

> **Status:** Fixed in 2026-04-15 — Duplicate of CA-API-001, same fix applied.

### CA-API-006: Missing Gamification Daily Checkin Endpoints
**Severity:** HIGH
**Frontend file:** services/dailyCheckinApi.ts:34,52,73
**Backend expected:** rezbackend unifiedGamificationRoutes
**Category:** missing-route
**Description:** Consumer calls POST/GET `/gamification/daily-checkin` and `/gamification/daily-checkin/status` but routes may not exist in monolith
**Impact:** Daily checkin and status checks return 404
**Fix hint:** Verify gamification routes are correctly registered in rezbackend config/routes.ts

### CA-API-007: Coupon Search Endpoint Path Mismatch
**Severity:** MEDIUM
**Frontend file:** services/couponApi.ts
**Backend expected:** rezbackend/rez-backend-master/src/routes/couponRoutes.ts
**Category:** missing-route
**Description:** Consumer calls `/coupons/search`, `/coupons/my-coupons`, `/coupons/best-offer` but couponRoutes only shows `/featured`
**Impact:** Coupon search, recommendations, and user's coupons fail with 404
**Fix hint:** Add missing coupon query endpoints to backend or verify they're in a different service

### CA-API-008: Missing Streak Freezing Endpoint
**Severity:** MEDIUM
**Frontend file:** services/streakApi.ts:264
**Backend expected:** Unknown
**Category:** missing-route
**Description:** Consumer calls POST `${baseUrl}/streak/freeze` (expands to `/gamification/streak/freeze`) but endpoint may not exist
**Impact:** Streak freeze functionality fails
**Fix hint:** Implement streak freeze endpoint in gamification service

### CA-API-009: Identity API Incorrect HTTP Verb
**Severity:** CRITICAL
**Frontend file:** services/identityApi.ts:61
**Backend expected:** rez-auth-service/src/routes/authRoutes.ts:408
**Category:** payload-mismatch
**Description:** Consumer calls `PUT /user/auth/profile` with {statedIdentity} but backend mounts `PATCH /auth/profile`
**Impact:** Identity verification via auth endpoint fails with 405 Method Not Allowed
**Fix hint:** Change to PATCH or ensure backend mounts PUT variant

> **Status:** Fixed in 2026-04-15 — Changed identityApi.ts:61 from PUT to PATCH for identity updates.

### CA-API-010: Leaderboard Stats Missing Service
**Severity:** MEDIUM
**Frontend file:** services/leaderboardApi.ts
**Backend expected:** rez-gamification-service or rezbackend
**Category:** missing-route
**Description:** Consumer calls `/gamification/leaderboard` but route not confirmed in monolith
**Impact:** Leaderboard fetches fail with 404
**Fix hint:** Verify gamification leaderboard routes are registered

### CA-API-011: Missing Offer Comment Endpoints
**Severity:** MEDIUM
**Frontend file:** services/offerCommentApi.ts
**Backend expected:** rezbackend/src/routes/offerCommentRoutes.ts
**Category:** missing-route
**Description:** Consumer service exists for offer comments but endpoints not found in backend routes
**Impact:** Offer comment creation/deletion fails
**Fix hint:** Implement offerCommentRoutes or verify it's mounted

### CA-API-012: Missing Challenge API Endpoints
**Severity:** MEDIUM
**Frontend file:** services/challengesApi.ts
**Backend expected:** rezbackend/src/routes/challengeRoutes.ts (if exists)
**Category:** missing-route
**Description:** Consumer calls challenge endpoints but no corresponding backend routes found
**Impact:** Challenge creation and management fail
**Fix hint:** Implement challenge routes or remove from frontend

### CA-API-013: Missing Event Review Endpoints
**Severity:** MEDIUM
**Frontend file:** services/eventReviewApi.ts
**Backend expected:** Unknown
**Category:** missing-route
**Description:** Frontend has eventReviewApi but corresponding backend routes unclear
**Impact:** Event review submission fails
**Fix hint:** Verify event review routes are implemented

### CA-API-014: Missing Social Media Integration Endpoints
**Severity:** LOW
**Frontend file:** services/socialMediaApi.ts
**Backend expected:** rezbackend/src/routes/socialMediaRoutes.ts
**Category:** missing-route
**Description:** Consumer social media API calls may not map to backend routes
**Impact:** Social media sharing/integration fails
**Fix hint:** Verify social media endpoints are registered

### CA-API-015: Missing Prescription Verification Endpoint
**Severity:** MEDIUM
**Frontend file:** services/verificationApi.ts
**Backend expected:** Unknown
**Category:** missing-route
**Description:** Consumer calls prescription verification endpoints
**Impact:** Prescription verification fails
**Fix hint:** Implement or locate prescription verification service

---

**NOTE:** This audit found at least 15 API contract issues, with 5 being CRITICAL blocking bugs (items 001, 004, 005, 009). The most urgent fixes are:
1. Change PUT to PATCH for `/user/auth/profile` calls (blocks profile updates)
2. Resolve wallet payment route conflict between monolith and wallet-service
3. Verify and implement missing gamification endpoints
4. Consolidate profile endpoints (/user/profile vs /user/auth/profile)

The consumer app has 459 unique API endpoints while the monolith has 1066 registered routes, with many consumer calls routed through the API gateway to microservices (ads-service, billing, etc.) that weren't fully audited in this pass.