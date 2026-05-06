# SA5: Route Mapping Table (Frontend → Backend)
Generated: 2026-04-12 | Branch: audit/recovery-phase

---

## SCREEN COUNT
| App | Count |
|-----|-------|
| Consumer (nuqta-master) | ~180 route files |
| Merchant (rez-merchant-master) | ~260 route files |
| Admin (rez-admin-main) | ~130 route files |
| REZ Now | 6 pages |

---

## CRITICAL FINDINGS

### 1. REZ Now: `POST /auth/pin/verify` — MISSING ENDPOINT (Broken PIN Login)
- **File**: `rez-now/lib/api/auth.ts`
- REZ Now calls `POST /auth/pin/verify` for PIN login
- rez-auth-service defines this as `POST /auth/login-pin` (different path)
- API gateway routes non-`/api/auth` paths to monolith catch-all
- Monolith also has no `/auth/pin/verify`
- **Result: PIN login in REZ Now is broken at runtime — 404**

### 2. Merchant App: `/crm` Redirect Target Missing
- **File**: `rezmerchant/rez-merchant-master/app/customers/index.tsx`
- Contains `<Redirect href="/crm" />`
- No `crm.tsx` or `crm/index.tsx` exists anywhere in the merchant app
- Any user navigating to `/customers` gets a broken redirect

### 3. Monolith Merchant Wallet Route Commented Out
- **File**: `rezbackend/src/config/routes.ts:943`
- `// app.use('/api/merchant/wallet', merchantWalletRoutes)` — commented out
- Via API gateway: correctly routes to merchant-service (which has the route) ✅
- Direct monolith calls for `GET /api/merchant/wallet`: 404
- Strangler-fig migration inconsistency

---

## API GATEWAY PROXY MAP

| Request Path | Upstream | Notes |
|-------------|----------|-------|
| `/api/search` | search-service | |
| `/api/catalog` | catalog-service | Cacheable |
| `/api/orders` | order-service | SSE support |
| `/api/merchant/auth` | merchant-service | IP rate-limited |
| `/api/merchant/inventory` | **monolith** | Carve-out, not yet in merchant-service |
| `/api/merchant/multi-stores` | **monolith** | Carve-out |
| `/api/merchant/export` | **monolith** | Carve-out |
| `/api/merchant/goals` | **monolith** | Carve-out |
| `/api/merchant/broadcast` | **monolith** | Carve-out |
| `/api/merchant/rez-capital` | **monolith** | Carve-out |
| `/api/merchant/aov-rewards` | **monolith** | Carve-out |
| `/api/merchant/adbazaar-summary` | **monolith** | Carve-out |
| `/api/merchant/programs` | **monolith** | Carve-out |
| `/api/merchant/stores/*/coin-drops` | **monolith** | Regex carve-out |
| `/api/merchant/stores/*/branded-campaigns` | **monolith** | Regex carve-out |
| `/api/merchant/stores/*/earning-analytics` | **monolith** | Regex carve-out |
| `/api/merchant/stores/*/pending-picks` | **monolith** | Regex carve-out |
| `/api/merchant` (all other) | merchant-service | |
| `/api/auth` | auth-service | Strict rate limit |
| `/api/payment` | payment-service | No retry |
| `/api/wallet` | wallet-service | Cacheable GET |
| `/api/analytics` | analytics-service | |
| `/api/gamification` | gamification-service | |
| `/api/finance` | finance-service | Never cached |
| `/api/notifications` | **monolith** | BullMQ worker — no HTTP server |
| `/api/marketing` | marketing-service | |
| `/api/media/upload` | media-service | |
| `/api/merchant/ads`, `/api/admin/ads`, `/api/ads/` | ads-service | |
| `/api/admin/` | **monolith** | All admin routes |
| `/socket.io/` | **monolith** | WebSocket |
| `/` (catch-all) | **monolith** | All remaining |

**13 merchant-service paths are carve-outs hardcoded to monolith in nginx.conf.**

---

## BROKEN NAVIGATION LINKS

| App | Screen | Target | Status |
|-----|--------|--------|--------|
| Merchant | `app/customers/index.tsx` | `/crm` | ❌ BROKEN — file does not exist |
| REZ Now | `lib/api/auth.ts` | `POST /auth/pin/verify` | ❌ MISSING ENDPOINT |

---

## BACKEND ROUTE STATUS (key checks)
| App | API Call | Status |
|-----|---------|--------|
| Consumer | `POST /user/auth/send-otp` | ✅ EXISTS |
| Consumer | `GET /wallet/balance` | ✅ EXISTS |
| Consumer | `GET /gamification/streaks` | ✅ EXISTS |
| Consumer | `GET /cashstore/homepage` | ✅ EXISTS |
| REZ Now | `POST /api/web-ordering/razorpay/create-order` | ✅ EXISTS |
| REZ Now | `POST /auth/pin/verify` | ❌ MISSING |
| Merchant | `GET /api/merchant/wallet` (via gateway) | ✅ EXISTS (merchant-service) |
| Merchant | `GET /api/merchant/wallet` (monolith direct) | ❌ COMMENTED OUT |
| Admin | `GET /api/admin/merchants` | ✅ EXISTS |
