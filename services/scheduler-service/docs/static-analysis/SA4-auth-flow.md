# SA4: Auth Flow Report
Generated: 2026-04-12 | Branch: audit/recovery-phase

---

## CONSUMER AUTH FLOW

1. **Send OTP** → `POST /api/auth/otp/send` (rez-auth-service) — rate limited (3/min per phone, 5/15min IP)
2. **Verify OTP** → `POST /api/auth/otp/verify` — JWT_SECRET, TTL **15m**, refresh TTL 7d
3. **PIN Login** → `POST /api/auth/login-pin` — Redis pin-lock after 5 fails (15min)
4. **Token storage**: expo-secure-store (native), httpOnly cookie + localStorage (web — see BUG-7)
5. **Auth middleware order** (monolith protected route):
   - nginx rate limit → CORS → strip internal headers
   - `validateNoTokenInQueryString()` — rejects `?token=` / `?jwt=`
   - `extractToken()` — Bearer first, then cookie `rez_access_token`
   - Redis blacklist check `blacklist:token:{rawtoken}` — **fail-closed in prod**
   - `jwt.verify()` — HS256 pinned, tries JWT_ADMIN_SECRET first then JWT_SECRET
   - `allLogout:{userId}` Redis check
   - Redis cache (5s TTL) or fresh DB for sensitive paths
   - device fingerprint check (non-blocking)
6. **Refresh**: `/api/user/auth/refresh-token` — rotation enforced, 2min pre-expiry scheduling
7. **Logout**: blacklists token, clears refreshToken hash

---

## MERCHANT AUTH FLOW

1. **Login** → `POST /api/merchant/auth/login` (rez-merchant-service) — bcrypt, 5 fails → 30min lock
2. **Token**: JWT_MERCHANT_SECRET, **1h TTL**, refresh 30d in httpOnly cookie path `/api/merchant/auth/refresh`
3. **Auth middleware — monolith path** (`merchantauth.ts`):
   - Bearer header only (no cookie fallback)
   - Redis blacklist `blacklist:merchant:{sha256(token)}`
   - `jwt.verify()` HS256 pinned
   - Redis cache (60s) — skipped for /wallet, /settlement, /payout, /transfer
   - DB lookup + merchant.isActive check
4. **Auth middleware — rez-merchant-service path** (`auth.ts`):
   - Bearer OR cookie `merchant_access_token`
   - Redis blacklist check
   - `jwt.verify()` HS256 pinned
   - **NO DB lookup — trusts JWT claims** ← BUG-1
5. **RBAC**: owner > admin > manager > staff > cashier > viewer, permissions in JWT
6. **Refresh**: `/api/merchant/auth/refresh` — SHA-256 hash lookup, rotation enforced
7. **Logout**: `blacklist:merchant:{sha256(token)}` (3600s TTL), clear refreshToken hash

---

## ADMIN AUTH FLOW

1. **Login** → `POST /api/admin/auth/login` (monolith) — 20/5min rate limit
2. **TOTP**: required by default (`REQUIRE_ADMIN_TOTP=true`); setupToken (JWT, 10min, scoped audience) for enrollment
3. **Token**: JWT_ADMIN_SECRET, **15m TTL**, refresh JWT_REFRESH_SECRET 7d
4. **Auth middleware**: same `authenticate` as consumer but role-checks against JWT_ADMIN_SECRET
   - Consumer token claiming admin role → REJECTED
   - Admin token: role hierarchy support(60) < operator(70) < admin(80) < super_admin(100)
5. **`GET /api/admin/auth/me`**: custom auth check — **missing account-lock check** ← BUG-6
6. **Refresh**: `/api/admin/auth/refresh-token` — JWT_REFRESH_SECRET (shared with consumer) ← BUG-2
7. **Logout-all**: `allLogout:{userId}` Redis key (30d TTL)

---

## JWT SECRET ISOLATION

| Secret | Used For | Isolation |
|--------|----------|-----------|
| `JWT_SECRET` | Consumer access tokens | Consumer only ✅ |
| `JWT_ADMIN_SECRET` | Admin access tokens | Admin only ✅ |
| `JWT_MERCHANT_SECRET` | Merchant access tokens | Merchant only ✅ (both monolith + merchant-svc must share same value) |
| `JWT_REFRESH_SECRET` | **All** refresh tokens | ⚠️ Consumer + Admin share this |
| `OTP_HMAC_SECRET` | OTP signing | Auth-service only ✅ |

---

## CRITICAL AUTH BUGS

### BUG-1 [HIGH] — Deactivated Merchants Can Operate for Up to 1 Hour
- **File**: `rez-merchant-service/src/middleware/auth.ts:63-76`
- rez-merchant-service `merchantAuth` sets `req.merchantId/role/permissions` from JWT claims — NO DB lookup
- A suspended/banned merchant account is still valid on all merchant-service routes until JWT expiry (1h)
- Monolith path (`merchantauth.ts`) DOES check `merchant.isActive` — inconsistent behavior

### BUG-2 [MEDIUM] — Shared JWT_REFRESH_SECRET (Consumer + Admin)
- **Files**: `admin/auth.ts:297`, `authRoutes.ts:53`, `rez-auth-service/src/services/tokenService.ts:53`
- A consumer refresh token can be submitted to `/api/admin/auth/refresh-token`
- Saved by role check after decode, but secret boundary is not clean
- Fix: introduce `JWT_ADMIN_REFRESH_SECRET`

### BUG-3 [MEDIUM] — Internal Auth Scoped→Legacy Fallthrough (Merchant Service)
- **File**: `rez-merchant-service/src/middleware/internalAuth.ts:39-54`
- Omitting `X-Internal-Service` header bypasses per-service token isolation
- Monolith explicitly rejects this case (`internalAuth.ts:76-86`) — the microservice doesn't

### BUG-4 [MEDIUM] — rez-auth-service Blacklist Check Fail-OPEN on Redis Down
- **File**: `rez-auth-service/src/services/tokenService.ts:59-91`
- Falls back to MongoDB `lastLogoutAt` check when Redis unavailable
- Individually-blacklisted tokens (not logout-all) can be reused during Redis outage window
- Monolith auth.ts uses `failClosed=true` — no MongoDB fallback

### BUG-5 [LOW] — JWT Algorithm Not Pinned at Sign Time (Merchant Service)
- **File**: `rez-merchant-service/src/routes/auth.ts:81-84, 194, 262`
- `jwt.sign()` calls don't pass `{ algorithm: 'HS256' }` — relies on library default
- Verification IS pinned — low risk but not defense-in-depth

### BUG-6 [LOW] — Admin `/me` Missing Account-Lock/Inactive Check
- **File**: `rezbackend/src/routes/admin/auth.ts:392-437`
- Uses custom auth check instead of `authenticate` middleware
- Missing: `isActive` check, `accountLockedUntil` check from middleware path
- Locked/deactivated admin can still call `/me`

### BUG-7 [LOW] — Consumer Web Auth Writes Tokens to localStorage (XSS Risk)
- **File**: `rezapp/nuqta-master/utils/authStorage.ts:10-16`
- TODO comment acknowledges `Platform.OS !== 'web'` gate not yet implemented
- Tokens in localStorage are readable by JS; httpOnly cookie path is correct for web

### BUG-8 [INFO] — adminAuthLimiter Comment/Code Mismatch
- **File**: `rezbackend/src/middleware/rateLimiter.ts:253-267`
- Comment says "5 attempts/15min", actual config is `max:20, windowMs:5min`
- Actual limit is 4x more permissive than documented

### BUG-9 [INFO] — Auth-Service Hardcodes '8h' for Admin Token, Monolith Uses '15m'
- **Files**: `rez-auth-service/src/services/tokenService.ts:37` vs `rezbackend/src/routes/admin/auth.ts:91`
- Auth-service issues 8h admin tokens; monolith issues 15m admin tokens
- TTL inconsistency depending on which service handles admin login
