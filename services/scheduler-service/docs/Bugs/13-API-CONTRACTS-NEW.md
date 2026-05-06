# Bug Report 13 — API Contract Mismatches (New Findings)
**Audit Agent:** Senior API Integration Engineer (25yr exp)
**Audit Date:** 2026-04-13
**Scope:** All merchant app API calls vs backend, all admin app API calls vs backend, response shapes, base URLs

> **Note:** This file documents NEW API contract findings from the April 2026 audit.
> Previous API contract bugs are in [02-API-CONTRACTS.md](02-API-CONTRACTS.md).

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 6 |
| MEDIUM | 7 |
| LOW | 3 |

---

## CRITICAL

### AC2-C1 — Admin `getUserWallet` — Response Shape Mismatch (UI Crashes)
> **Status:** ✅ FIXED
- **Frontend file:** `rezadmin/rez-admin-main/services/api/users.ts`, line 210
- **Frontend code:**
  ```ts
  const response = await apiClient.get<UserWallet>(`admin/users/${userId}/wallet`);
  if (response.success && response.data) return response.data;
  ```
  Frontend returns `response.data` typed as flat `UserWallet`.
- **Backend response** (`rezbackend/.../routes/admin/users.ts:165–177`):
  ```json
  { "success": true, "data": { "user": {...}, "wallet": {...} } }
  ```
  Backend wraps it as `{ user, wallet }`.
- **Impact:** `response.data` is `{ user, wallet }` — NOT a flat `UserWallet`. Any UI code accessing `.balance.total` gets `undefined` because `balance` is at `response.data.wallet.balance`. The entire wallet view in admin will show blank/zero data or crash.
- **Fix:** Update frontend to return `response.data.wallet` or update backend to return wallet directly at `data`.

### AC2-C2 — Team Member Login: `user.name` Stored as `undefined`
> **Status:** ✅ FIXED
- **Frontend file:** `rezmerchant/rez-merchant-master/services/api/auth.ts`, line 23
- **Code:** `name: response.data.merchant.ownerName`
- **Backend response for team member login** (`rezbackend/.../merchantroutes/auth.ts:630–633`):
  - For owner login: `ownerName` IS included
  - For team member login: `ownerName` NOT added to `responseData`
- **Impact:** Every team member logs in and has `user.name = undefined` stored in AsyncStorage. This value persists and is displayed in all "Hello, [name]" UI elements. Every team member sees a blank name throughout the app.
- **Fix:** Backend must include `ownerName` (or `displayName`) in team member login response. Frontend should fallback: `name: response.data.merchant.ownerName || response.data.user?.name || 'Team Member'`.

### AC2-C3 — Admin `createMerchant` — Body Fields Map to Wrong Backend Fields
> **Status:** ✅ FIXED
- **Frontend sends** (`rezadmin/rez-admin-main/services/api/merchants.ts:191–208`):
  ```json
  { "name": "...", "email": "...", "phone": "...", "businessName": "...", "businessType": "...", "storeAddress": "..." }
  ```
- **Backend `Merchant` model uses:** `ownerName` (not `name`), `businessAddress` (not `storeAddress`)
- **Impact:** Both `name` and `storeAddress` fields are silently ignored by the backend. New merchants created from admin have empty `ownerName` and `businessAddress`.
- **Fix:**
  1. Backend: Accept both `name` and `ownerName` as aliases in the create handler, map to `ownerName`
  2. Or Frontend: Change the request body to use `ownerName` and `businessAddress`

---

## HIGH

### AC2-H1 — Merchant Auth `updateProfile` Sends `{ name }` But Backend Field Is `ownerName`
> **Status:** ✅ FIXED
- **Frontend file:** `rezmerchant/rez-merchant-master/services/api/auth.ts`, line 163
- **Frontend sends:** `PUT merchant/auth/profile` with `Partial<User> = { name, email, role, merchantId, isActive }`
- **rez-merchant-service route:** Accepts arbitrary body fields passed to Mongoose update. Field `name` doesn't exist on merchant schema — silently ignored.
- **Impact:** `updateProfile({ name: 'New Name' })` returns HTTP 200 but does nothing. Merchant name is never updated via this path.
- **Fix:** Map `name` → `ownerName` in the profile update route, or change frontend to send `ownerName`.

### AC2-H2 — Merchant Store `approvalStatus` vs Backend `status` Field Name Mismatch
> **Status:** ✅ FIXED
- **Frontend type** (`rezmerchant/rez-merchant-master/services/api/stores.ts:110`): `approvalStatus?: 'pending' | 'approved' | 'rejected' | 'suspended'`
- **Backend admin endpoint response:** Returns `status` field (not `approvalStatus`)
- **rez-merchant-service store response:** Also returns `status`
- **Impact:** `store.approvalStatus` is always `undefined` in merchant app. Any UI gating on store approval status (showing "pending approval" banners, disabling features) never triggers.
- **Fix:** Either rename backend response field to `approvalStatus` or update frontend type to use `status`.

### AC2-H3 — Admin `Merchant.userId` Always `undefined`
> **Status:** ✅ FIXED
- **Frontend type** (`rezadmin/rez-admin-main/services/api/merchants.ts:4`): `interface Merchant { _id: string; userId: string; ... }`
- **Backend `GET /admin/merchants` response:** Returns `_id` as MongoDB ObjectId field, no `userId` field
- **Impact:** `merchant.userId` is always `undefined` in admin. Any feature that depends on `userId` to link merchant to user account silently breaks.
- **Fix:** Remove `userId` from admin `Merchant` interface or add `userId` to backend response (populated from linked `User` document).

### AC2-H4 — Hardcoded Render URL as Production Fallback (Bypasses API Gateway)
> **Status:** ✅ FIXED
- **File:** `rezmerchant/rez-merchant-master/services/api/client.ts`, lines 22–23
- **Code:**
  ```ts
  process.env.EXPO_PUBLIC_MERCHANT_SERVICE_URL ||
  (__DEV__ ? 'http://localhost:4005/api' : 'https://rez-merchant-service-n3q2.onrender.com/api')
  ```
- **Impact:**
  1. Missing env var silently routes to a specific Render instance instead of failing loudly
  2. Hardcoded URL bypasses the nginx API gateway — no rate-limiting, no CORS enforcement, no security headers
  3. If Render service is renamed or scaled, all production calls silently break
  4. A `console.warn` logs but does not throw — fallback is used silently in production
- **Fix:** Throw an error if `EXPO_PUBLIC_MERCHANT_SERVICE_URL` is missing in production. Remove the hardcoded Render URL fallback.

### AC2-H5 — `buildApiUrl` Ignores `PROD_URL` — Token Refresh May Hit Wrong Server
> **Status:** ✅ FIXED
- **Merchant file:** `rezmerchant/rez-merchant-master/config/api.ts`, lines 79–118
- **Admin file:** `rezadmin/rez-admin-main/services/api/apiClient.ts`, line 43
- **Problem:**
  - `getApiUrl()`: Uses `PROD_URL` in production if set → correct
  - `buildApiUrl()`: Always uses `BASE_URL` regardless of environment → wrong
  - Admin token refresh calls `buildApiUrl('admin/auth/refresh-token')` — always uses `BASE_URL`
  - If `EXPO_PUBLIC_PROD_API_URL` differs from `EXPO_PUBLIC_API_BASE_URL`, token refresh hits the wrong server in production, causing all admin sessions to expire simultaneously
- **Fix:** Update `buildApiUrl()` to use `PROD_URL` in production, matching `getApiUrl()` behavior.

### AC2-H6 — All API Calls Use Unversioned Paths — Will Break at v2 Cutoff
> **Status:** ✅ FIXED
- **Backend:** `config/routes.ts` lines 460–466 sets `X-API-Deprecated: 'Use /api/v1/ prefix. Unversioned routes will be removed in v2.'` header on ALL unversioned routes
- **Both apps:** Every single API call uses unversioned paths (e.g., `merchant/auth/login`, `admin/users`)
- **Impact:** Every response to every API call currently carries a deprecation header. When v2 deprecation is enforced, all calls break simultaneously — zero migration path exists.
- **Fix:** Begin migrating both apps to `/api/v1/` prefixed calls. Add a tracked migration checklist. Do not remove unversioned routes until all callers are migrated.

---

## MEDIUM

### AC2-M1 — Orders API Has 3-Shape Normalization (Contract Never Resolved)
> **Status:** ⏳ DEFERRED — 3-shape normalization cleanup tracked; requires merchant-service and monolith response standardization
- **File:** `rezmerchant/rez-merchant-master/services/api/orders.ts`, lines 89–155
- **Frontend normalizes 3 response shapes:**
  - Shape 1: `{ data: { orders: [...], total, totalPages } }` — canonical
  - Shape 2: `{ data: [...orders], pagination: {...} }` — rez-merchant-service legacy
  - Shape 3: `{ data: { items: [...], totalCount } }` — old monolith
- **Impact:** Technical debt. A future breaking change to the shape won't be caught at compile time — it silently falls to the wrong normalization branch.
- **Fix:** Standardize on Shape 1. Remove Shape 2 and 3 normalization after updating rez-merchant-service.

### AC2-M2 — Admin and Merchant Refresh Token Endpoints Use Different Names
> **Status:** ✅ FIXED (2026-04-13 — verified both clients correctly match their respective backends)
- **Admin:** `POST admin/auth/refresh-token` — client (`apiClient.ts` line 43) and backend (`src/routes/admin/auth.ts` route `/refresh-token` mounted at `/api/admin/auth`) are aligned.
- **Merchant:** `POST merchant/auth/refresh` — client (`services/api/client.ts` line 214) hits rez-merchant-service which exposes `/merchant/auth/refresh`. Both sides are in sync.
- **Resolution:** Each client already matches its backend. The naming inconsistency between the two surfaces is a documentation/style issue only. No client URL changes were needed — both endpoints function correctly as-is.

### AC2-M3 — `error.response?.data?.message` Pattern Wrong for `apiClient` Error Shape
> **Status:** ✅ FIXED (2026-04-13 — all 6 catch blocks in profile.ts updated to use `error.message` directly)
- **File:** `rezmerchant/rez-merchant-master/services/api/profile.ts`, lines 175, 199, 218, 244, 264
- **Problem:** `apiClient` throws plain `Error` objects, not Axios response errors. `error.response` is always `undefined` for API errors. The `?.data?.message` chain always evaluates to `undefined`. Only the `|| error.message` fallback works.
- **Impact:** All error messages from the API are thrown away. UI shows generic errors instead of server-provided messages.
- **Fix:** Update error handling to read `error.message` directly (which `apiClient` already sets to the server's message).

### AC2-M4 — 401 Refresh Failure Returns `{success:false}` Without Throwing (Silent No-Data)
> **Status:** ✅ FIXED (2026-04-13 — `return { success: false }` replaced with `throw new Error(...)` after `onLogoutCallback`)
- **File:** `rezadmin/rez-admin-main/services/api/apiClient.ts`
- **Fix applied:** After `storageService.logout()` and `onLogoutCallback()` are called, the interceptor now throws `new Error('Session expired. Please log in again.')` instead of returning a silent `{ success: false }` object. Callers will see a rejected promise / caught exception rather than receiving `undefined` data with no visible error.

### AC2-M5 — `getPaginated<T>()` Helper Exists But Is Never Used
> **Status:** ✅ FIXED — `services/api/suppliers.ts` refactored: `listSuppliers` and `getSupplierProducts` now call `apiClient.getPaginated<T>()` instead of `apiClient.get<PaginatedResponse<T>>()`, eliminating the unused-helper dead code; the removed `PaginatedResponse` re-import from `client` was cleaned up
- **File:** `rezmerchant/rez-merchant-master/services/api/client.ts`, line 336
- **Problem:** A typed `getPaginated<T>()` method exists expecting `{ data: { items: [...], pagination: {...} } }` but the `orders.ts` service uses `get<any>()` with manual normalization instead.
- **Fix:** Migrate `orders.ts` and other paginated calls to use `getPaginated<T>()` with proper response types.

### AC2-M6 — `OrderListResponse` Has Both `totalCount` and `total` as Duplicate Fields
> **Status:** ✅ FIXED (2026-04-13 — removed `totalCount` from `OrderListResponse`; all callers updated to use `total`)
- **File:** `rezmerchant/rez-merchant-master/services/api/orders.ts`
- **Fix applied:** Removed `totalCount: number` from `OrderListResponse` interface. The `getOrders()` return statement no longer emits `totalCount`. `getPendingOrdersCount()` updated to use only `result.total`. `total` is the canonical field — internal normalization already resolves both backend variants (`total`/`totalCount`) into `total` before returning.

### AC2-M7 — `admin/auth/logout` Doesn't Wire to "Logout All Devices" in UI
> **Status:** ⏳ DEFERRED — logout-all-devices UI tracked with AS2-L1 admin security settings sprint
- **Endpoint exists:** `POST /api/admin/auth/logout-all-devices`
- **Frontend `logout()`** only calls `POST admin/auth/logout` (single-device)
- **No UI button** for logout-all-devices visible in admin app
- **Fix:** Add a "Sign out all devices" option in admin profile/security settings page.

---

## LOW

### AC2-L1 — `/api/user-settings` Legacy Path (Still Active, Should Be Deprecated)
> **Status:** ⏳ DEFERRED — legacy path deprecation tracked with BR-M2; no breaking change until clients migrate
- **File:** `rezbackend/rez-backend-master/src/config/routes.ts`, lines 563 and 637
- **Two paths:** `/api/user-settings` (legacy) and `/api/user/settings` (new)
- **Fix:** Add `X-API-Deprecated` header to `/api/user-settings` responses. Document migration path.

### AC2-L2 — Merchant `sync.ts` Fire-and-Forget With No UI Error Propagation
> **Status:** ✅ FIXED — exported `syncData(options?, onError?)` wrapper in `services/api/sync.ts`; existing callers (no args) unchanged; callers that pass `onError` callback receive the Error on failure; call remains non-blocking (no rethrow)
- **File:** `rezmerchant/rez-merchant-master/services/api/sync.ts`
- **Problem:** Sync failures are `console.error` only — no error state propagated to UI. Merchants have no way to know if sync failed.
- **Fix:** Propagate sync errors to a notification/toast system.

### AC2-L3 — Admin `getRecentActivity` Doesn't Distinguish "API Failed" From "Empty Result"
> **Status:** ⏳ DEFERRED — empty vs error state distinction tracked for admin dashboard UX improvements
- **File:** `rezadmin/rez-admin-main/services/api/dashboard.ts`, lines 133–136
- **Problem:** On `!response.success`, throws. But on `response.success && !response.data`, returns `{ recentOrders: [], recentCoinAwards: [] }`. UI cannot tell if orders are empty or if the API failed silently.
- **Fix:** Add an explicit error state separate from empty state in the response handler.
