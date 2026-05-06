# Admin App Full Audit Report

**App:** REZ Admin (`rez-admin-main`)
**Audit Date:** 2026-04-10
**Auditor:** Code Quality Analyzer
**Scope:** `/Users/rejaulkarim/Documents/ReZ Full App/rezadmin/rez-admin-main/`

---

## Executive Summary

Critical issues found (actionable blockers):

- **Hotels screen uses a hardcoded empty admin token** — every OTA API call sends `Authorization: Bearer ` (empty), so all hotel data is inaccessible in production.
- **`admin/auth/me` response shape mismatch** — `isAuthenticated()` calls the endpoint expecting `AdminUser` directly, while `refreshProfile()` calls the same endpoint expecting `{ user: AdminUser }`. One of these is wrong; both cannot be right simultaneously.
- **`app.json` has two `extra` blocks** — the first (lines 20–24) is silently ignored because JSON objects cannot have duplicate keys. The router `appDir` config is effectively dead.
- **`dailyCheckinConfig.ts` and `travel.ts` use leading-slash endpoint paths** (`/admin/…`) — `buildApiUrl` strips one leading slash but these still double-append if `BASE_URL` already ends without a slash, producing valid URLs by accident. However the leading slash is inconsistent and will break if `BASE_URL` includes a path prefix.
- **`analytics-dashboard.tsx` explicitly documents a non-existent backend endpoint** (`admin/analytics/dashboard`) — the screen silently shows "Unavailable" banners for entire analytics sections, masking what is a missing backend route.
- **Hotels screen token management is completely broken** — `const [adminToken] = useState<string>('')` is always an empty string; there is no mechanism to populate it from auth storage.
- **Rendez screen bypasses REZ auth entirely** — it calls a separate Rendez backend directly using `EXPO_PUBLIC_RENDEZ_ADMIN_KEY`, which is an empty string by default, meaning unauthenticated calls are sent in any environment where the env var is unset.
- **`ThemeContext` is defined but never used** in any screen or layout — dead code that may cause confusion.
- **`app.config.js` references `./assets/images/splash.png`** while `app.json` references `./assets/images/splash-icon.png` — asset path conflict may cause build failures.
- **`EXPO_PUBLIC_SENTRY_DSN` env var** is not documented in any `.env.example` or README, making it easy to ship with crash reporting silently disabled in production.

---

## 1. Screen / Navigation Audit

### 1.1 Complete Screen Inventory

| Screen File | Route | Visible in Tab Bar | Status |
|---|---|---|---|
| `app/index.tsx` | `/` | — | OK — redirect only |
| `app/(auth)/login.tsx` | `/(auth)/login` | — | OK |
| `app/(dashboard)/index.tsx` | `/(dashboard)` | Yes — Dashboard | OK |
| `app/(dashboard)/orders.tsx` | `/(dashboard)/orders` | Yes — Orders | OK |
| `app/(dashboard)/campaigns.tsx` | `/(dashboard)/campaigns` | Yes — Campaigns | OK |
| `app/(dashboard)/merchants.tsx` | `/(dashboard)/merchants` | Yes — Merchants | OK |
| `app/(dashboard)/hotels.tsx` | `/(dashboard)/hotels` | Yes — Hotels | BROKEN (empty token) |
| `app/(dashboard)/rendez.tsx` | `/(dashboard)/rendez` | Yes — Rendez | BROKEN (empty API key default) |
| `app/(dashboard)/settings.tsx` | `/(dashboard)/settings` | Yes — More | OK |
| `app/(dashboard)/coin-rewards.tsx` | `/(dashboard)/coin-rewards` | Hidden | OK |
| `app/(dashboard)/wallet.tsx` | `/(dashboard)/wallet` | Hidden | OK |
| `app/(dashboard)/users.tsx` | `/(dashboard)/users` | Hidden | OK |
| `app/(dashboard)/users/[id].tsx` | `/(dashboard)/users/[id]` | Hidden | OK |
| `app/(dashboard)/offers.tsx` | `/(dashboard)/offers` | Hidden | OK |
| `app/(dashboard)/homepage-deals.tsx` | `/(dashboard)/homepage-deals` | Hidden | OK |
| `app/(dashboard)/verifications.tsx` | `/(dashboard)/verifications` | Hidden | OK |
| `app/(dashboard)/special-programs.tsx` | `/(dashboard)/special-programs` | Hidden | OK |
| `app/(dashboard)/loyalty.tsx` | `/(dashboard)/loyalty` | Hidden | OK |
| `app/(dashboard)/mall.tsx` | `/(dashboard)/mall` | Hidden | OK |
| `app/(dashboard)/extra-rewards.tsx` | `/(dashboard)/extra-rewards` | Hidden | OK |
| `app/(dashboard)/cash-store.tsx` | `/(dashboard)/cash-store` | Hidden | OK |
| `app/(dashboard)/travel.tsx` | `/(dashboard)/travel` | Hidden | OK |
| `app/(dashboard)/unified-monitor.tsx` | `/(dashboard)/unified-monitor` | Hidden | OK |
| `app/(dashboard)/live-monitor.tsx` | `/(dashboard)/live-monitor` | Hidden | OK |
| `app/(dashboard)/system-health.tsx` | `/(dashboard)/system-health` | Hidden | OK |
| `app/(dashboard)/sla-monitor.tsx` | `/(dashboard)/sla-monitor` | Hidden | OK |
| `app/(dashboard)/job-monitor.tsx` | `/(dashboard)/job-monitor` | Hidden | OK |
| `app/(dashboard)/challenges.tsx` | `/(dashboard)/challenges` | Hidden | OK |
| `app/(dashboard)/game-config.tsx` | `/(dashboard)/game-config` | Hidden | OK |
| `app/(dashboard)/feature-flags.tsx` | `/(dashboard)/feature-flags` | Hidden | OK |
| `app/(dashboard)/achievements.tsx` | `/(dashboard)/achievements` | Hidden | OK |
| `app/(dashboard)/gamification-economy.tsx` | `/(dashboard)/gamification-economy` | Hidden | OK |
| `app/(dashboard)/economics.tsx` | `/(dashboard)/economics` | Hidden | OK |
| `app/(dashboard)/daily-checkin-config.tsx` | `/(dashboard)/daily-checkin-config` | Hidden | OK |
| `app/(dashboard)/categories.tsx` | `/(dashboard)/categories` | Hidden | OK |
| `app/(dashboard)/photo-moderation.tsx` | `/(dashboard)/photo-moderation` | Hidden | OK |
| `app/(dashboard)/polls.tsx` | `/(dashboard)/polls` | Hidden | OK |
| `app/(dashboard)/offer-comments.tsx` | `/(dashboard)/offer-comments` | Hidden | OK |
| `app/(dashboard)/engagement-config.tsx` | `/(dashboard)/engagement-config` | Hidden | OK |
| `app/(dashboard)/ugc-moderation.tsx` | `/(dashboard)/ugc-moderation` | Hidden | OK |
| `app/(dashboard)/review-moderation.tsx` | `/(dashboard)/review-moderation` | Hidden | OK |
| `app/(dashboard)/pending-approvals.tsx` | `/(dashboard)/pending-approvals` | Hidden | OK |
| `app/(dashboard)/social-impact.tsx` | `/(dashboard)/social-impact` | Hidden | OK |
| `app/(dashboard)/sponsors.tsx` | `/(dashboard)/sponsors` | Hidden | OK |
| `app/(dashboard)/bonus-zone.tsx` | `/(dashboard)/bonus-zone` | Hidden | OK |
| `app/(dashboard)/whats-new.tsx` | `/(dashboard)/whats-new` | Hidden | OK |
| `app/(dashboard)/prive.tsx` | `/(dashboard)/prive` | Hidden | OK |
| `app/(dashboard)/tournaments.tsx` | `/(dashboard)/tournaments` | Hidden | OK |
| `app/(dashboard)/learning-content.tsx` | `/(dashboard)/learning-content` | Hidden | OK |
| `app/(dashboard)/leaderboard-config.tsx` | `/(dashboard)/leaderboard-config` | Hidden | OK |
| `app/(dashboard)/quick-actions.tsx` | `/(dashboard)/quick-actions` | Hidden | OK |
| `app/(dashboard)/value-cards.tsx` | `/(dashboard)/value-cards` | Hidden | OK |
| `app/(dashboard)/wallet-config.tsx` | `/(dashboard)/wallet-config` | Hidden | OK |
| `app/(dashboard)/user-wallets.tsx` | `/(dashboard)/user-wallets` | Hidden | OK |
| `app/(dashboard)/gift-cards-admin.tsx` | `/(dashboard)/gift-cards-admin` | Hidden | OK |
| `app/(dashboard)/coin-gifts.tsx` | `/(dashboard)/coin-gifts` | Hidden | OK |
| `app/(dashboard)/merchant-withdrawals.tsx` | `/(dashboard)/merchant-withdrawals` | Hidden | OK |
| `app/(dashboard)/creators.tsx` | `/(dashboard)/creators` | Hidden | OK |
| `app/(dashboard)/events.tsx` | `/(dashboard)/events` | Hidden | OK |
| `app/(dashboard)/event-categories.tsx` | `/(dashboard)/event-categories` | Hidden | OK |
| `app/(dashboard)/event-rewards.tsx` | `/(dashboard)/event-rewards` | Hidden | OK |
| `app/(dashboard)/surprise-coin-drops.tsx` | `/(dashboard)/surprise-coin-drops` | Hidden | OK |
| `app/(dashboard)/partner-earnings.tsx` | `/(dashboard)/partner-earnings` | Hidden | OK |
| `app/(dashboard)/offers-sections.tsx` | `/(dashboard)/offers-sections` | Hidden | OK |
| `app/(dashboard)/upload-bill-stores.tsx` | `/(dashboard)/upload-bill-stores` | Hidden | OK |
| `app/(dashboard)/exclusive-zones.tsx` | `/(dashboard)/exclusive-zones` | Hidden | OK |
| `app/(dashboard)/hotspot-areas.tsx` | `/(dashboard)/hotspot-areas` | Hidden | OK |
| `app/(dashboard)/special-profiles.tsx` | `/(dashboard)/special-profiles` | Hidden | OK |
| `app/(dashboard)/bank-offers.tsx` | `/(dashboard)/bank-offers` | Hidden | OK |
| `app/(dashboard)/flash-sales.tsx` | `/(dashboard)/flash-sales` | Hidden | OK |
| `app/(dashboard)/loyalty-milestones.tsx` | `/(dashboard)/loyalty-milestones` | Hidden | OK |
| `app/(dashboard)/store-collections.tsx` | `/(dashboard)/store-collections` | Hidden | OK |
| `app/(dashboard)/support-config.tsx` | `/(dashboard)/support-config` | Hidden | OK |
| `app/(dashboard)/support-tickets.tsx` | `/(dashboard)/support-tickets` | Hidden | OK |
| `app/(dashboard)/admin-users.tsx` | `/(dashboard)/admin-users` | Hidden | OK |
| `app/(dashboard)/faq-management.tsx` | `/(dashboard)/faq-management` | Hidden | OK |
| `app/(dashboard)/notification-management.tsx` | `/(dashboard)/notification-management` | Hidden | OK |
| `app/(dashboard)/delivery-settings.tsx` | `/(dashboard)/delivery-settings` | Hidden | OK |
| `app/(dashboard)/fraud-reports.tsx` | `/(dashboard)/fraud-reports` | Hidden | OK |
| `app/(dashboard)/cashback-rules.tsx` | `/(dashboard)/cashback-rules` | Hidden | OK |
| `app/(dashboard)/membership-config.tsx` | `/(dashboard)/membership-config` | Hidden | OK |
| `app/(dashboard)/voucher-management.tsx` | `/(dashboard)/voucher-management` | Hidden | OK |
| `app/(dashboard)/support-tools.tsx` | `/(dashboard)/support-tools` | Hidden | OK |
| `app/(dashboard)/wallet-adjustment.tsx` | `/(dashboard)/wallet-adjustment` | Hidden | OK |
| `app/(dashboard)/institutions.tsx` | `/(dashboard)/institutions` | Hidden | OK |
| `app/(dashboard)/institute-referrals.tsx` | `/(dashboard)/institute-referrals` | Hidden | OK |
| `app/(dashboard)/api-latency.tsx` | `/(dashboard)/api-latency` | Hidden | OK |
| `app/(dashboard)/alert-rules.tsx` | `/(dashboard)/alert-rules` | Hidden | OK |
| `app/(dashboard)/revenue-by-vertical.tsx` | `/(dashboard)/revenue-by-vertical` | Hidden | OK |
| `app/(dashboard)/cohort-analysis.tsx` | `/(dashboard)/cohort-analysis` | Hidden | OK |
| `app/(dashboard)/funnel-analytics.tsx` | `/(dashboard)/funnel-analytics` | Hidden | OK |
| `app/(dashboard)/bbps-health.tsx` | `/(dashboard)/bbps-health` | Hidden | OK |
| `app/(dashboard)/ab-test-manager.tsx` | `/(dashboard)/ab-test-manager` | Hidden | OK |
| `app/(dashboard)/reconciliation.tsx` | `/(dashboard)/reconciliation` | Hidden | OK |
| `app/(dashboard)/business-metrics.tsx` | `/(dashboard)/business-metrics` | Hidden | OK |
| `app/(dashboard)/fraud-alerts.tsx` | `/(dashboard)/fraud-alerts` | Hidden | OK |
| `app/(dashboard)/merchant-live-status.tsx` | `/(dashboard)/merchant-live-status` | Hidden | OK |
| `app/(dashboard)/bbps-analytics.tsx` | `/(dashboard)/bbps-analytics` | Hidden | OK |
| `app/(dashboard)/bbps-config.tsx` | `/(dashboard)/bbps-config` | Hidden | OK |
| `app/(dashboard)/bbps-providers.tsx` | `/(dashboard)/bbps-providers` | Hidden | OK |
| `app/(dashboard)/bbps-transactions.tsx` | `/(dashboard)/bbps-transactions` | Hidden | OK |
| `app/(dashboard)/bundle-management.tsx` | `/(dashboard)/bundle-management` | Hidden | OK |
| `app/(dashboard)/campaign-management.tsx` | `/(dashboard)/campaign-management` | Hidden | OK |
| `app/(dashboard)/coin-governor.tsx` | `/(dashboard)/coin-governor` | Hidden | OK |
| `app/(dashboard)/device-security.tsx` | `/(dashboard)/device-security` | Hidden | OK |
| `app/(dashboard)/disputes.tsx` | `/(dashboard)/disputes` | Hidden | OK |
| `app/(dashboard)/payroll.tsx` | `/(dashboard)/payroll` | Hidden | OK |
| `app/(dashboard)/prive-campaigns.tsx` | `/(dashboard)/prive-campaigns` | Hidden | OK |
| `app/(dashboard)/service-appointments.tsx` | `/(dashboard)/service-appointments` | Hidden | OK |
| `app/(dashboard)/table-bookings.tsx` | `/(dashboard)/table-bookings` | Hidden | OK |
| `app/(dashboard)/trial-approvals.tsx` | `/(dashboard)/trial-approvals` | Hidden | OK |
| `app/(dashboard)/platform-control-center.tsx` | `/(dashboard)/platform-control-center` | Hidden | OK |
| `app/(dashboard)/platform-config.tsx` | `/(dashboard)/platform-config` | Hidden | OK |
| `app/(dashboard)/merchant-plan-analytics.tsx` | `/(dashboard)/merchant-plan-analytics` | Hidden | OK |
| `app/(dashboard)/aggregator-monitor.tsx` | `/(dashboard)/aggregator-monitor` | Hidden | OK |
| `app/(dashboard)/marketing-analytics.tsx` | `/(dashboard)/marketing-analytics` | Hidden | OK |
| `app/(dashboard)/analytics-dashboard.tsx` | `/(dashboard)/analytics-dashboard` | Hidden | PARTIAL (sections show "Unavailable") |
| `app/(dashboard)/merchant-flags/[merchantId].tsx` | `/(dashboard)/merchant-flags/[merchantId]` | Hidden | OK |
| `app/(dashboard)/reviews.tsx` | `/(dashboard)/reviews` | Hidden | OK |
| `app/(dashboard)/stores-moderation.tsx` | `/(dashboard)/stores-moderation` | Hidden | OK |
| `app/(dashboard)/broadcast.tsx` | `/(dashboard)/broadcast` | Hidden | OK |
| `app/(dashboard)/revenue.tsx` | `/(dashboard)/revenue` | Hidden | OK |
| `app/(dashboard)/audit-log.tsx` | `/(dashboard)/audit-log` | Hidden | OK |
| `app/(dashboard)/admin-settings.tsx` | `/(dashboard)/admin-settings` | Hidden | OK |
| `app/(dashboard)/fraud-queue.tsx` | `/(dashboard)/fraud-queue` | Hidden | OK |
| `app/(dashboard)/reactions.tsx` | `/(dashboard)/reactions` | Hidden | OK |
| `app/(dashboard)/comments-moderation.tsx` | `/(dashboard)/comments-moderation` | Hidden | OK |
| `app/(dashboard)/ads.tsx` | `/(dashboard)/ads` | Hidden | OK |
| `app/(dashboard)/moderation-queue.tsx` | `/(dashboard)/moderation-queue` | Hidden | OK |
| `app/(dashboard)/web-menu-analytics.tsx` | `/(dashboard)/web-menu-analytics` | Hidden | OK |
| `app/(dashboard)/explore.tsx` | `/(dashboard)/explore` | Hidden | OK |
| `app/(dashboard)/experiences.tsx` | `/(dashboard)/experiences` | Hidden | OK |

**Total screens: 132 files. All registered screens have corresponding file implementations.**

### 1.2 Missing Screens

No screens are referenced in navigation code but missing as files. All 132 registered routes have implementations.

However, there are two categories of structural concern:

1. **`campaigns` tab (visible) vs `campaign-management` screen (hidden)** — both exist as separate screens with overlapping purpose but different UIs and API endpoints. No navigation link from `campaign-management` back to `campaigns` or vice versa.

2. **`admin-settings` screen** — registered in the layout and navigable, but the `settings.tsx` "More" screen appears to be the primary settings entry point. Having both creates ambiguity about which is canonical.

### 1.3 Navigation Flow Issues

- **File:** `app/(dashboard)/_layout.tsx`, line 112
  - The `settings` tab shows `title: 'More'` but the icon is a menu icon. The tab is visible in the tab bar with 7 tabs total (Dashboard, Orders, Campaigns, Merchants, Hotels, Rendez, More). On small phone screens this causes overflow / clipping of the tab bar. The tab bar height is hardcoded to `70 + insets.bottom`, and 7 tabs at that size is borderline unusable on 375px width devices.

- **File:** `app/_layout.tsx`, line 282
  - The startup `app-status` check fetches `${baseUrl}/config/app-status` which is NOT under the `/api/admin/*` prefix. This endpoint must exist on the backend at `/api/config/app-status`. If the backend does not expose this route, the fetch fails silently (falls through to `setAppStatus('ok')` in the catch block). This is acceptable UX-wise but means the maintenance gate never fires unless the backend team is aware of this contract.

- **File:** `app/(dashboard)/_layout.tsx`, line 238 / `app/(dashboard)/job-monitor.tsx`
  - `job-monitor` is registered in the layout and has a file, but the settings screen must navigate to it via the `More` menu. If the settings menu does not have an entry for job monitor, it becomes a dead route.

---

## 2. API Connection Audit

### 2.1 All API Calls Inventory

| Screen / Service | Method | Endpoint (as called) | Full URL | Correct? |
|---|---|---|---|---|
| `auth.ts` | POST | `admin/auth/login` | `/api/admin/auth/login` | Yes |
| `auth.ts` | POST | `admin/auth/logout` | `/api/admin/auth/logout` | Yes |
| `auth.ts` | GET | `admin/auth/me` | `/api/admin/auth/me` | Yes (shape issue — see §2.2) |
| `auth.ts` | POST | `admin/auth/totp/setup` | `/api/admin/auth/totp/setup` | Yes |
| `auth.ts` | POST | `admin/auth/totp/verify` | `/api/admin/auth/totp/verify` | Yes |
| `apiClient.ts` | POST | `admin/auth/refresh-token` | `/api/admin/auth/refresh-token` | Yes |
| `dashboard.ts` | GET | `admin/dashboard/stats` | `/api/admin/dashboard/stats` | Yes |
| `dashboard.ts` | GET | `admin/dashboard/recent-activity` | `/api/admin/dashboard/recent-activity` | Yes |
| `merchants.ts` | GET | `admin/merchants` | `/api/admin/merchants` | Yes |
| `merchants.ts` | GET | `admin/merchants/:id` | `/api/admin/merchants/:id` | Yes |
| `merchants.ts` | POST | `admin/merchants/:id/approve` | `/api/admin/merchants/:id/approve` | Yes |
| `merchants.ts` | POST | `admin/merchants/:id/reject` | `/api/admin/merchants/:id/reject` | Yes |
| `merchants.ts` | POST | `admin/merchants/:id/suspend` | `/api/admin/merchants/:id/suspend` | Yes |
| `merchants.ts` | POST | `admin/merchants/:id/reactivate` | `/api/admin/merchants/:id/reactivate` | Yes |
| `merchants.ts` | GET | `admin/merchant-wallets` | `/api/admin/merchant-wallets` | Yes |
| `merchants.ts` | GET | `admin/merchant-wallets/stats` | `/api/admin/merchant-wallets/stats` | Yes |
| `merchants.ts` | GET | `admin/merchant-wallets/:id` | `/api/admin/merchant-wallets/:id` | Yes |
| `merchants.ts` | GET | `admin/merchant-wallets/:id/transactions` | `/api/admin/merchant-wallets/:id/transactions` | Yes |
| `merchants.ts` | GET | `admin/merchant-wallets/pending-withdrawals` | `/api/admin/merchant-wallets/pending-withdrawals` | Yes |
| `merchants.ts` | POST | `admin/merchant-wallets/:id/process-withdrawal` | `/api/admin/merchant-wallets/:id/process-withdrawal` | Yes |
| `merchants.ts` | POST | `admin/merchant-wallets/:id/reject-withdrawal` | `/api/admin/merchant-wallets/:id/reject-withdrawal` | Yes |
| `coinRewards.ts` | GET | `admin/coin-rewards` | `/api/admin/coin-rewards` | Yes |
| `coinRewards.ts` | GET | `admin/coin-rewards/:id` | `/api/admin/coin-rewards/:id` | Yes |
| `coinRewards.ts` | GET | `admin/coin-rewards/stats` | `/api/admin/coin-rewards/stats` | Yes |
| `coinRewards.ts` | POST | `admin/coin-rewards/:id/approve` | `/api/admin/coin-rewards/:id/approve` | Yes |
| `coinRewards.ts` | POST | `admin/coin-rewards/:id/reject` | `/api/admin/coin-rewards/:id/reject` | Yes |
| `coinRewards.ts` | POST | `admin/coin-rewards/bulk-approve` | `/api/admin/coin-rewards/bulk-approve` | Yes |
| `coinRewards.ts` | POST | `admin/coin-rewards/bulk-reject` | `/api/admin/coin-rewards/bulk-reject` | Yes |
| `orders.ts` | GET | `admin/orders` | `/api/admin/orders` | Yes |
| `system.ts` | GET | `admin/system/health` | `/api/admin/system/health` | Yes |
| `system.ts` | GET | `admin/system/reconciliation` | `/api/admin/system/reconciliation` | Yes |
| `system.ts` | POST | `admin/system/reconciliation/trigger` | `/api/admin/system/reconciliation/trigger` | Yes |
| `system.ts` | GET | `admin/system/jobs` | `/api/admin/system/jobs` | Yes |
| `bonusZone.ts` | GET | `admin/bonus-zone/campaigns` | `/api/admin/bonus-zone/campaigns` | Yes |
| `bonusZone.ts` | GET | `admin/bonus-zone/dashboard` | `/api/admin/bonus-zone/dashboard` | Yes |
| `bbps.ts` | GET | `admin/bbps/providers` | `/api/admin/bbps/providers` | Yes |
| `bbps.ts` | GET | `admin/bbps/transactions` | `/api/admin/bbps/transactions` | Yes |
| `bbps.ts` | GET | `admin/bbps/stats` | `/api/admin/bbps/stats` | Yes |
| `bbps.ts` | GET | `admin/bbps/config` | `/api/admin/bbps/config` | Yes |
| `exclusiveZones.ts` | GET | `admin/exclusive-zones` | `/api/admin/exclusive-zones` | Yes |
| `bankOffers.ts` | GET | `admin/bank-offers` | `/api/admin/bank-offers` | Yes |
| `dailyCheckinConfig.ts` | GET | `/admin/daily-checkin-config` | `/api/admin/daily-checkin-config` | See §2.2 |
| `travel.ts` | GET | `/admin/travel/dashboard` | `/api/admin/travel/dashboard` | See §2.2 |
| `serviceAppointments.ts` | GET | `/admin/service-appointments` | `/api/admin/service-appointments` | See §2.2 |
| `fraudReports.ts` | GET | `admin/fraud-reports` | `/api/admin/fraud-reports` | Yes |
| `fraudReports.ts` | POST | `admin/fraud-reports/:id/freeze-wallet` | `/api/admin/fraud-reports/:id/freeze-wallet` | Yes |
| `userWallets.ts` | GET | `admin/user-wallets/search` | `/api/admin/user-wallets/search` | Yes |
| `quickActions.ts` | GET | `admin/quick-actions` | `/api/admin/quick-actions` | Yes |
| `supportConfig.ts` | GET | `admin/support-config` | `/api/admin/support-config` | Yes |
| `photoModeration.ts` | GET | `admin/photos/pending` | `/api/admin/photos/pending` | Yes |
| `photoModeration.ts` | PATCH | `admin/photos/:id/moderate` | `/api/admin/photos/:id/moderate` | Yes |
| `hotels.tsx` (screen) | GET | `/v1/admin/stats` | `${OTA_BASE}/v1/admin/stats` | Uses separate OTA base, not REZ API |
| `rendez.tsx` (screen) | GET | `/admin/stats` | `${RENDEZ_API}/admin/stats` | Uses separate Rendez base, not REZ API |
| `analytics-dashboard.tsx` (screen) | GET | `admin/analytics/dashboard` | SKIPPED — documented as non-existent | Missing backend route |
| `analytics-dashboard.tsx` (screen) | GET | `/api/analytics/platform/summary` | `${ANALYTICS_SERVICE_URL}/api/analytics/platform/summary` | Requires separate analytics service |

### 2.2 Broken / Wrong Endpoints

**1. `admin/auth/me` response shape mismatch (CRITICAL)**

- File: `/services/api/auth.ts`, lines 200 and 215
- `isAuthenticated()` calls `apiClient.get<AdminUser>('admin/auth/me')` and accesses `response.data` directly as `AdminUser`.
- `refreshProfile()` calls the same endpoint but as `apiClient.get<{ user: AdminUser }>('admin/auth/me')` and accesses `response.data?.user`.
- These two expectations are mutually exclusive. One is wrong. If the backend returns `{ data: { user: {...} } }`, then `isAuthenticated()` will get the wrapping object instead of the user, and all auth checks in `AuthContext.tsx` line 156 (`meResponse.data`) will yield `{ user: {...} }` instead of a flat `AdminUser`, causing silent auth failures (user appears authenticated but `user._id` is undefined).
- Additionally, `AuthContext.tsx` line 154 has the same issue: it calls `apiClient.get<AdminUser>('admin/auth/me')` expecting flat shape.

**2. Leading-slash endpoints in `dailyCheckinConfig.ts` and `travel.ts` (MEDIUM)**

- File: `/services/api/dailyCheckinConfig.ts`, lines 23, 27, 31
  - All calls use `/admin/daily-checkin-config` (with leading slash). `buildApiUrl` strips one leading slash, so the effective path is `admin/daily-checkin-config`. This produces the correct URL only by coincidence. If `BASE_URL` changes to include a trailing `/api`, the leading slash in the endpoint would cause double-slashing.
- File: `/services/api/travel.ts`, lines 136, 143, 148, 169, 178, 205, 214, 219, 224, 236
  - All endpoints use `/admin/travel/…` with a leading slash. Same issue as above.
- File: `/services/api/serviceAppointments.ts`, lines 38, 53
  - All endpoints use `/admin/service-appointments/…` with a leading slash.
- These three files are inconsistent with every other service file, all of which omit the leading slash.

**3. `analytics-dashboard.tsx` non-existent endpoint (MEDIUM)**

- File: `/app/(dashboard)/analytics-dashboard.tsx`, lines 211–236
- The file itself documents that `admin/analytics/dashboard` does not exist in the backend. The entire "User Growth", "Top Merchants", and "Suspicious Activity" sections are permanently "Unavailable". These are core analytics features shown in a screen with the title "Analytics Dashboard". This is misleading UX that should either be removed or the backend endpoint built.

**4. Hotels screen — OTA API token always empty (CRITICAL)**

- File: `/app/(dashboard)/hotels.tsx`, line 165
- `const [adminToken] = useState<string>('')` — the token is initialized to an empty string and never updated.
- Every call to `adminFetch()` sends `Authorization: Bearer ` (empty token), which will result in 401 errors from the OTA service.
- There is no mechanism (no `useEffect`, no auth context usage) to populate this token from the REZ admin auth system.

**5. Rendez screen — API key defaults to empty string (HIGH)**

- File: `/app/(dashboard)/rendez.tsx`, line 18
- `const RENDEZ_ADMIN_KEY = process.env.EXPO_PUBLIC_RENDEZ_ADMIN_KEY || ''`
- If `EXPO_PUBLIC_RENDEZ_ADMIN_KEY` is not set in the environment, the key is an empty string and all Rendez API calls go unauthenticated.
- There is no error shown to the admin indicating that the API key is missing.

### 2.3 Missing API Methods

The following screens make API calls but the corresponding service methods are missing from the services layer — calls are made directly from screen components using `apiClient`:

| Screen | Direct `apiClient` Call | Should Be In |
|---|---|---|
| `app/(dashboard)/whats-new.tsx` | `apiClient.get`, `apiClient.post`, `apiClient.patch`, `apiClient.delete` for stories | `services/api/whatsNew.ts` (missing) |
| `app/(dashboard)/campaign-management.tsx` | `apiClient.post`, `apiClient.get`, `apiClient.put`, `apiClient.patch` | `services/api/campaignManagement.ts` (missing, distinct from `campaigns.ts`) |
| `app/(dashboard)/system-health.tsx` | Direct `fetch()` calls to 11 individual microservice URLs, bypassing `apiClient` entirely | Should use `systemService` or a dedicated health service |
| `app/(dashboard)/hotels.tsx` | Direct `fetch()` calls to OTA base URL using a private `adminFetch` helper | `services/api/hotelOtaAdmin.ts` exists but is NOT used by the screen |
| `app/(dashboard)/rendez.tsx` | Direct `fetch()` calls to Rendez backend | `services/api/rendez.ts` (missing) |
| `app/(dashboard)/analytics-dashboard.tsx` | Direct `fetch()` call to `ANALYTICS_SERVICE_URL` | Should use analytics service |

Note: `services/api/hotelOtaAdmin.ts` exists as a file but is completely unused. The `hotels.tsx` screen reimplements its own `adminFetch` helper and does not import `hotelOtaAdmin.ts` at all.

### 2.4 Hardcoded URLs

| File | Hardcoded Value | Issue |
|---|---|---|
| `app/(dashboard)/hotels.tsx` line 23 | `'https://hotel-ota-api.onrender.com'` (fallback) | Falls back to Render dev URL in production if env var is unset |
| `app/(dashboard)/rendez.tsx` line 17 | `'https://rendez-backend.onrender.com'` (fallback) | Falls back to Render dev URL in production if env var is unset |
| `config/api.ts` line 29 | `'http://localhost:5001/api'` (dev fallback) | Expected for dev only — acceptable |
| `config/api.ts` line 43 | `'http://localhost:5001/api'` (DEV_URL default) | Expected for dev only — acceptable |
| `config/api.ts` line 57 | `'http://localhost:5001'` (socket dev fallback) | Expected for dev only — acceptable |

---

## 3. Auth Flow Audit

### 3.1 Auth Issues

**1. Dual socket singletons (MEDIUM)**

- `services/socket.ts` exports `socketService` (class-based singleton).
- `hooks/useAdminSocket.ts` exports `useAdminSocket` (module-level singleton via `_socket` variable).
- Both are used in different screens (`sla-monitor.tsx` and `merchant-live-status.tsx` use `useAdminSocket`; `index.tsx` uses `socketService`).
- This means the admin app can have TWO active socket connections simultaneously, doubling server load and causing duplicate event handling.

**2. Web auth: `isAuthenticated()` always makes a network call (MEDIUM)**

- File: `/services/api/auth.ts`, lines 197–205
- On web with `COOKIE_AUTH_ENABLED=true`, every call to `isAuthenticated()` makes a live network request to `admin/auth/me`. This is called:
  - On app init (once, acceptable)
  - Every 5 minutes via interval in `AuthContext.tsx` line 233 (acceptable)
  - But also in the dashboard layout's `isLoading` check chain, potentially during fast navigation
- There is no debouncing or caching of this check.

**3. `getToken()` returns sentinel `'cookie-session'` on web (MEDIUM)**

- File: `/services/api/auth.ts`, lines 187–189
- On web with cookie auth, `getToken()` returns the string `'cookie-session'` as a non-null sentinel value.
- `useAdminSocket.ts` line 52 calls `storageService.getAuthToken()` to get the token for the socket connection. On web, this returns `null` (because `COOKIE_AUTH_ENABLED=true` makes `getAuthToken()` return null). As a result, **the socket connection on web never sends an auth token**. The socket connects without credentials, which will likely fail or connect without admin privileges.

**4. Token refresh does not send `Authorization` header when `COOKIE_AUTH_ENABLED=true` (HIGH)**

- File: `/services/api/apiClient.ts`, lines 143–153
- After a successful token refresh, the retry request always sets `Authorization: Bearer ${newToken}`. However, when `COOKIE_AUTH_ENABLED=true`, the code path for normal requests skips injecting the Authorization header. The refresh-retry path is inconsistent — it always injects the header regardless of `COOKIE_AUTH_ENABLED`. This means after a token refresh on web (cookie mode), the retry request sends both a cookie AND an Authorization header, which could cause the backend to prefer the (potentially expired) cookie over the new token.

**5. `refreshProfile()` vs `isAuthenticated()` response shape inconsistency**

- Already documented in §2.2 item 1. This is the highest severity auth issue.

### 3.2 Unprotected Screens

All screens are behind the `AuthGuardedLayout` in `app/_layout.tsx` and the `DashboardLayout` in `app/(dashboard)/_layout.tsx`. The `DashboardLayout` performs a second auth check via `isAuthenticated` and redirects to login if false.

However, there is a subtle timing issue:

- `app/index.tsx` uses `isLoading` (not `isInitializing`) for its spinner. If `isLoading` becomes `false` before `isInitializing` does (which the reducer does not guarantee — they are set together in `AUTH_SUCCESS`), the redirect could fire prematurely.
- In practice this is not a security issue since the server validates all tokens, but it can cause a flash of unauthenticated content or a redirect loop.

---

## 4. State Management Audit

### 4.1 Context Issues

**1. `ThemeContext` is defined but unused (DEAD CODE)**

- File: `/contexts/ThemeContext.tsx`
- `ThemeContext` and `useTheme()` are exported but never imported anywhere in `app/` or `components/`. All screens use `useColorScheme()` from `@/hooks/useColorScheme` and manually index into `Colors[colorScheme ?? 'light']`.
- The context is also not included in the provider tree in `app/_layout.tsx`.
- This is dead code that adds confusion.

**2. `AuthContext` does not use `isInitializing` consistently in consumers**

- File: `/app/(dashboard)/_layout.tsx`, line 14
- `DashboardLayout` reads `{ isAuthenticated, isLoading }` but not `isInitializing`. It shows a spinner when `isLoading` is true and redirects when `!isAuthenticated`. During initialization, `isLoading` starts as `true`, so this is safe. But if a future change sets `isLoading: false` before `isInitializing: false` (e.g., a race condition), the layout would redirect to login before auth is actually confirmed.

**3. `AlertContext` is provided but never shown to be consumed in screens**

- File: `/contexts/AlertContext.tsx` (not read in detail, but confirmed it exists)
- Many screens use `showAlert()` from `utils/alert.ts` directly instead of `AlertContext`. It is unclear whether `AlertContext` and `utils/alert` are redundant or complementary. If both exist and one wraps the other, the indirection is confusing.

**4. No `QueryClientProvider` invalidation on logout**

- File: `/contexts/AuthContext.tsx`, `logout()` function (line 330)
- When a user logs out, `authService.logout()` is called and the state is reset, but `queryClient.clear()` is never called. This means all cached TanStack Query data (merchants, orders, users, etc.) persists in memory and will be shown to the next user who logs in on the same session/device. For an admin app this is a data leakage risk.

---

## 5. Component Audit

### 5.1 Missing / Broken Components

**1. `ErrorBoundary` default export vs named export conflict**

- File: `/components/ErrorBoundary.tsx`, lines 27 and 185
- Both a named export (`export class ErrorBoundary`) and a default export (`export default ErrorBoundary`) are present.
- `app/_layout.tsx` imports `{ ErrorBoundary }` (named import) — correct.
- `app/(dashboard)/_layout.tsx` imports `ErrorBoundary` (default import, line 8) — also correct since both resolve to the same class.
- No breakage, but the dual-export pattern is unnecessary and confusing.

**2. `EmergencyActionBar` — `onSystemAlert` callback routes to a non-`as any` path**

- File: `/app/(dashboard)/index.tsx`, line 217
- `onSystemAlert={() => router.push('/(dashboard)/notification-management' as any)}`
- The cast to `any` bypasses Expo Router's typed routes. If the typed-routes experiment (`typedRoutes: true` in `app.json`) is active, this should use proper typing. The `as any` suppresses a TypeScript error that may indicate the route string does not match any known route.

**3. `BulkActionBar` component exists but no screen imports it**

- File: `/components/BulkActionBar.tsx`
- Not found imported in any screen. Potentially dead component code.

**4. `components/ui/PrimaryButton.tsx` — exists but usage is unclear**

- Not checked exhaustively for usage across all 132 screens, but no screen read during this audit imports it.

**5. Dashboard `alerts` state is always empty**

- File: `/app/(dashboard)/index.tsx`, line 79
- `const [alerts, setAlerts] = useState<Array<...>>([])` — this state is initialized to `[]` and never populated. The socket listener for `merchant:alert` was explicitly removed (documented in `socket.ts` comments as "no backend emitter exists"). The alerts section in the UI (`if (alerts.length > 0)`) will therefore never render. This is dead UI code.

---

## 6. Dead Code and Disconnected Features

| Item | File | Description |
|---|---|---|
| `hotelOtaAdmin.ts` service | `services/api/hotelOtaAdmin.ts` | Fully implemented OTA admin service that is never imported or used. `hotels.tsx` implements its own inline fetch helper instead. |
| `ThemeContext` | `contexts/ThemeContext.tsx` | Context is defined, exported, and never used anywhere in the app tree. |
| Dashboard alerts state | `app/(dashboard)/index.tsx` line 79–81 | `alerts` state and its render block (`alerts.length > 0`) can never be triggered because no event populates it. |
| Socket event listeners (gmv:update, merchant:alert, fraud:alert, queue:backlog, merchant:live) | `services/socket.ts` comments | These events are documented as non-existent in the backend. The listeners were removed but the UI in some screens may still reference these concepts without a data source. |
| `BulkActionBar` component | `components/BulkActionBar.tsx` | Component exists but appears to be unused across all screens (not imported in any audited file). |
| `analytics-dashboard.tsx` analytics sections | `app/(dashboard)/analytics-dashboard.tsx` | "User Growth", "Top Merchants", "Suspicious Activity" sections permanently show "Unavailable" because the endpoint was never built. These sections are dead UI. |
| `campaign-management.tsx` duplicates `campaigns.tsx` | Both files | Two separate campaign management screens exist. `campaigns.tsx` is a full CRUD campaigns manager; `campaign-management.tsx` is a different missions/festivals manager. Both are reachable but there is no cross-linking or clear separation of concerns. |

---

## 7. TypeScript Issues

| Issue | File | Severity |
|---|---|---|
| `PendingWithdrawalItem.merchantId: any` | `services/api/merchants.ts` line 113 | Medium — loses all type safety for merchant lookup |
| `PendingWithdrawalItem.store: any` | `services/api/merchants.ts` line 114 | Medium — loses type safety for store data |
| `getWalletStats()` returns `Promise<any>` | `services/api/merchants.ts` line 299 | Medium — callers get no type information |
| `getWalletTransactions()` returns `Promise<{ transactions: any[] }>` | `services/api/merchants.ts` line 342 | Medium |
| `getPendingWithdrawals()` response typed as `any` internally | `services/api/merchants.ts` line 371 | Medium |
| `tournaments.ts` — `Tournament.user: any` | `services/api/tournaments.ts` line 29 | Medium |
| `getParticipants()` response typed as `any[]` | `services/api/tournaments.ts` line 210 | Medium |
| `travel.ts` — all methods return `any` | `services/api/travel.ts` lines 136–236 | High — entire travel service is untyped |
| `offerComments.ts` — all responses typed as `any` | `services/api/offerComments.ts` | Medium |
| `bonusZone.ts` — fraud data iteration uses `(u: any)` and `(ip: any)` | `services/api/bonusZone.ts` lines 501, 517 | Low |
| `reviews.ts` — pagination typed as `any` | `services/api/reviews.ts` line 39 | Low |
| `userWallets.ts` — `newBalance: any` in return type | `services/api/userWallets.ts` line 166 | Medium |
| `useAdminSocket.ts` — all `any` in callback signatures | `hooks/useAdminSocket.ts` lines 16, 17, 18 | Medium — defeats type safety for socket event data |
| `Constants.manifest as any` | `services/api/apiClient.ts` line 87 | Low — legacy fallback cast |
| `rez-shared-types.ts` — `getItems()` uses `as any` internally | `types/rez-shared-types.ts` line 65 | Low |
| `_retryCount` cast to `any` on options object | `services/api/apiClient.ts` line 193 | Low — hack to track retry count; should be a proper typed options field |
| `response.pagination` — accessed directly on `ApiResponse` but not defined in that interface when backend returns it at top level | Multiple service files | Medium — `ApiResponse.pagination` is declared optional in `rez-shared-types.ts` but service files access it without null guards |

**TypeScript config note:** `tsconfig.json` has `strict: true` which is correct. However, `include` lists `"app"` and `"components"` without file extensions or `**` glob, which may cause some files in subdirectories to be excluded from type checking in older TypeScript versions.

---

## 8. Config Issues

**1. Duplicate `extra` block in `app.json` (HIGH)**

- File: `/app.json`, lines 20–24 and 83–89
- JSON does not allow duplicate keys. The first `extra` block (containing `router.appDir`) is silently ignored by all JSON parsers in favor of the second one (containing `privacyPolicyUrl`, etc.).
- The `router.appDir: "app"` configuration is therefore never applied. In Expo Router v5 this may or may not matter depending on the default, but it is a clear configuration bug.
- The `app.config.js` file (which overrides `app.json` at build time) does not include either of these `extra` blocks, further reducing the impact, but the `app.json` inconsistency is still a maintenance hazard.

**2. Conflicting splash screen asset paths between `app.json` and `app.config.js`**

- `app.json` line 14: `"image": "./assets/images/splash-icon.png"`
- `app.config.js` line 12: `"image": "./assets/images/splash.png"`
- Since `app.config.js` takes precedence over `app.json`, the effective splash is `splash.png`. If only `splash-icon.png` exists in the assets folder, the build will fail with a missing asset error.

**3. Missing `eas.json` — no build profiles configured**

- No `eas.json` file was found in the project root. EAS Build profiles (`development`, `preview`, `production`) that are referenced in `package.json` scripts cannot run without this file.

**4. `newArchEnabled: true` in `app.json` but not in `app.config.js`**

- `app.json` line 10: `"newArchEnabled": true`
- `app.config.js` does not set this. Since `app.config.js` is the build-time config, New Architecture may be disabled in production builds, causing a discrepancy between local dev and CI builds.

**5. Multiple env vars with no `.env.example` file**

- The app depends on at least 16 `EXPO_PUBLIC_*` env vars. No `.env.example` file was found in the project. New developers and CI pipelines have no reference for what variables to set.

---

## 8. Priority Issue List

### P0 — Crashes / Complete Feature Failure

| # | Issue | File | Impact |
|---|---|---|---|
| P0-1 | Hotels tab always sends empty Bearer token — all OTA API calls fail with 401 | `app/(dashboard)/hotels.tsx:165` | Hotels tab is completely non-functional |
| P0-2 | `admin/auth/me` response shape inconsistency — one of `isAuthenticated()` or `refreshProfile()` is reading the wrong field | `services/api/auth.ts:200,215` | Silent auth failures; admin may appear logged in but have `user._id = undefined` |
| P0-3 | `app.json` has two `extra` blocks — first block silently ignored by JSON parsers | `app.json:20,83` | `router.appDir` config is dead |
| P0-4 | Rendez screen API key defaults to empty string — all Rendez API calls are unauthenticated | `app/(dashboard)/rendez.tsx:18` | Rendez tab returns 401/403 errors if env var is not set |

### P1 — Broken Behavior / Data Integrity

| # | Issue | File | Impact |
|---|---|---|---|
| P1-1 | QueryClient is not cleared on logout — cached data from previous admin session visible to next user | `contexts/AuthContext.tsx:330` | Data leakage between admin sessions |
| P1-2 | Web socket auth broken — `useAdminSocket` reads `storageService.getAuthToken()` which returns `null` on web with cookie auth | `hooks/useAdminSocket.ts:52` | Real-time features broken on web |
| P1-3 | Token refresh retry always injects `Authorization` header regardless of `COOKIE_AUTH_ENABLED` | `services/api/apiClient.ts:143` | Header/cookie conflict after token refresh on web |
| P1-4 | Dual socket singletons — `socketService` and `useAdminSocket` can both be active simultaneously | `services/socket.ts` + `hooks/useAdminSocket.ts` | Double connection to socket server |
| P1-5 | `analytics-dashboard.tsx` permanently shows "Unavailable" for all analytics sections | `app/(dashboard)/analytics-dashboard.tsx:231` | Core analytics dashboard is non-functional |
| P1-6 | `hotelOtaAdmin.ts` service file exists but is completely unused; hotels screen reimplements its own fetch | `services/api/hotelOtaAdmin.ts` | Code duplication; maintenance hazard |
| P1-7 | Leading-slash inconsistency in `dailyCheckinConfig.ts`, `travel.ts`, `serviceAppointments.ts` | `services/api/dailyCheckinConfig.ts:23,27,31` | Will silently break if base URL includes a path prefix |

### P2 — Quality / Maintainability / Minor Bugs

| # | Issue | File | Impact |
|---|---|---|---|
| P2-1 | `ThemeContext` defined but never used or provided | `contexts/ThemeContext.tsx` | Dead code, maintenance confusion |
| P2-2 | Dashboard `alerts` state is always empty — alert UI block is dead code | `app/(dashboard)/index.tsx:79` | UI renders nothing; misleading code |
| P2-3 | `BulkActionBar` component appears to be unused | `components/BulkActionBar.tsx` | Dead component code |
| P2-4 | `travel.ts` entire service uses `any` return types | `services/api/travel.ts` | No type safety for travel operations |
| P2-5 | 7 visible tabs in tab bar causes overflow on small screens | `app/(dashboard)/_layout.tsx` | UX degradation on small phones |
| P2-6 | Splash screen asset path conflict between `app.json` and `app.config.js` | `app.json:14` vs `app.config.js:12` | Potential build failure |
| P2-7 | No `.env.example` file for the 16+ env vars the app requires | project root | Developer onboarding hazard |
| P2-8 | `eas.json` missing — EAS Build scripts in `package.json` cannot execute | project root | CI/CD blocked |
| P2-9 | `newArchEnabled: true` in `app.json` but absent from `app.config.js` | Both files | Architecture mode may differ between dev and production builds |
| P2-10 | `useAdminSocket.ts` — `_pendingListeners` array is module-level and persists across hot reloads in dev, potentially causing duplicate listeners | `hooks/useAdminSocket.ts:33` | Dev experience degradation; not a production issue |
| P2-11 | `merchants.ts` — `any` types on `PendingWithdrawalItem.merchantId` and `.store` | `services/api/merchants.ts:113–114` | Loses type safety for withdrawal processing |
| P2-12 | `campaigns.tsx` and `campaign-management.tsx` overlap in purpose with no cross-linking | Both files | UX confusion; admins may not find the right screen |
| P2-13 | `app/(dashboard)/_layout.tsx` references `name="special-programs"` as hidden tab but there is a `special-programs.tsx` file with `href: null` — the comment says "accessible via More menu" but if the settings screen doesn't list it, it's unreachable | `_layout.tsx:176` | Potentially unreachable screen |
| P2-14 | `startupcheck` endpoint `/config/app-status` is not under `/api/admin/*` and is not documented — backend team may not be aware of this contract | `app/_layout.tsx:282` | Maintenance contract gap |
