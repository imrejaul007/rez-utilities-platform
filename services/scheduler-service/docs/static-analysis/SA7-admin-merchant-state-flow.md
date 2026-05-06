# SA7: Admin + Merchant App State/Data Flow Report
Generated: 2026-04-12 | Branch: audit/recovery-phase

---

## ADMIN APP

### State Management Approach: DUAL SYSTEM (major inconsistency)
- **Layer 1**: React Query (defined in `hooks/queries/`) — properly configured with staleTime, queryKey factories, cache invalidation
- **Layer 2**: Raw `useState + useEffect` (direct service calls) — used by **ALL** actual dashboard screens
- **The React Query layer is completely orphaned — dead code in production**

### CRITICAL: Entire React Query Infrastructure is Dead Code
`QueryClient` is created, `QueryClientProvider` is wired in `_layout.tsx`, and all hooks in `hooks/queries/*.ts` are correctly written — but **no dashboard screen file imports or calls any of these hooks**. Every screen calls service singletons directly into local `useState`.

`hooks/queries/` is dead code. `staleTime`, `queryKeys`, cache invalidation — none of it is active.

### Data Flow Per Section (what's actually running)
| Section | File | How data is fetched |
|---------|------|---------------------|
| Overview | `app/(dashboard)/index.tsx` | `dashboardService.getStats()` + `getRecentActivity()` via `Promise.all` in `loadData()` |
| Merchants | `app/(dashboard)/merchants.tsx` | `merchantsService.getMerchants()` — local useState |
| Orders | `app/(dashboard)/orders.tsx` | `ordersService` direct — local useState |
| Wallet | `app/(dashboard)/wallet.tsx` | `adminWalletService.getWalletSummary()` + `getTransactionHistory()` |
| Analytics | `app/(dashboard)/analytics-dashboard.tsx` | Direct service calls |
| Revenue | `app/(dashboard)/revenue.tsx` | Direct service calls |

### Admin Bugs

| ID | Severity | Issue | File |
|----|----------|-------|------|
| A1 | HIGH | `useMerchantCampaignRules` and `useMerchantCampaignRuleStats` use raw string query keys, NOT in `queryKeys` factory — `invalidate(queryKeys.campaigns.all)` never reaches them | `hooks/queries/useMerchantCampaigns.ts:12,28` |
| A2 | HIGH | `loadAdminInfo()` in dashboard makes redundant `authService.getCurrentUser()` on every mount — auth already verified in `AuthContext.checkStoredToken()` | `app/(dashboard)/index.tsx:88-99` |
| A3 | MEDIUM | `useAdminSocket._consumerCount` is module-level — React Strict Mode double-mount decrements to -1, socket disconnects and never reconnects | `hooks/useAdminSocket.ts:26` |
| A4 | MEDIUM | `useFocusEffect + setInterval(60s)` on dashboard — pure 60s polling with no staleTime guard (bypasses React Query) | `app/(dashboard)/index.tsx` |
| A5 | MEDIUM | Pagination state resets to page 1 on any merchant approve/reject action (calls `loadData(1)`) | `app/(dashboard)/merchants.tsx` |
| A6 | LOW | `adminAuthLimiter` comment says "5 attempts/15min", actual config is `max:20, windowMs:5min` | `src/middleware/rateLimiter.ts:253` |

---

## MERCHANT APP

### State Management Approach: Mixed (better than admin)
- React Query: used AND connected to screens (dashboard, orders, wallet use real query hooks)
- Context + useReducer: `AuthContext`, `MerchantContext`
- Context + useState: `StoreContext`, `NotificationContext`, `OnboardingContext`, `SocketContext`

### Context Inventory
| Context | Key State | API Calls |
|---------|-----------|-----------|
| `AuthContext` | `isAuthenticated`, `user`, `merchant`, `token`, `permissions` | `authService.login/register/logout`, `teamService.getCurrentUserPermissions()` |
| `MerchantContext` | `products[]`, `orders[]`, `cashbackRequests[]`, `analytics{}` | products, orders, cashback services |
| `StoreContext` | `stores[]`, `activeStore` | `storeService` — resets on logout ✅ |
| `TeamContext` | `members[]`, `currentUserRole`, `permissions[]` | `teamService` — optimistic updates with rollback ✅ |
| `NotificationContext` | `unreadCount`, `latestNotification` | `notificationsService` + socket events |
| `OnboardingContext` | 5-step form data, `overallProgress` | `onboardingService` + AsyncStorage |
| `SocketContext` | `isConnected` | `socketService` singleton wrapper |

### Socket.IO Usage
| Consumer | Events | Cleanup |
|---------|--------|---------|
| `SocketContext` | `connection-status` | ✅ (but disconnects on app background — affects ALL consumers) |
| `NotificationContext` | `notification:new/read/deleted/unread-count` | ✅ explicit `socketService.off()` |
| `TeamContext` | `team-member-updated/removed/invited` | ✅ + re-registers on reconnect |
| `useRealTimeUpdates` | 9 events incl. `connection-status`, `metrics-updated`, `order-event` | **⚠️ uses `socketService.offAll(eventName)` — removes ALL handlers for that event globally** |

### CRITICAL: `useRealTimeUpdates.cleanupSocketListeners()` Nukes Other Contexts
`socketService.offAll(eventName)` removes every handler registered for that event name globally. When `useRealTimeUpdates` unmounts, it silently unregisters `TeamContext`'s `connection-status` handler. Team socket updates stop working permanently until `TeamContext` remounts.

**Files**: `hooks/useRealTimeUpdates.ts:189-201`

### CRITICAL: State Not Reset on Logout
`AuthContext.logout()` resets: auth state, React Query cache, socket connection, routes to login.

**NOT reset** (no auth observer):
| Context | Risk |
|---------|------|
| `MerchantContext` (products, orders, cashback, analytics) | New user logging in briefly sees previous merchant's data |
| `TeamContext` (members, role, permissions) | Stale team data until manual refresh |
| `OnboardingContext` (5-step form, AsyncStorage) | Previous merchant's onboarding state presented to new user |
| `NotificationContext` (unreadCount, latestNotification) | Stale notification state persists |

**Files**: `contexts/MerchantContext.tsx`, `contexts/TeamContext.tsx`, `contexts/OnboardingContext.tsx`, `contexts/NotificationContext.tsx`

### CRITICAL: Wallet URL Path Mismatch
- `hooks/queries/useWallet.ts:9,22,32,43,59`: calls `apiClient.get('/wallet')` (leading slash)
- `services/api/wallet.ts:73`: calls `apiClient.get('merchant/wallet')` (relative path)
- Leading-slash vs relative path behavior depends on `apiClient.baseURL` — likely resolving to different URLs

### Merchant Bugs

| ID | Severity | Issue | File |
|----|----------|-------|------|
| M1 | CRITICAL | `useRealTimeUpdates.offAll()` silently nukes TeamContext + NotificationContext socket handlers | `hooks/useRealTimeUpdates.ts:189-201` |
| M2 | CRITICAL | `MerchantContext`, `TeamContext`, `OnboardingContext`, `NotificationContext` not reset on logout — cross-session data leak | Multiple context files |
| M3 | CRITICAL | `useWallet.ts` uses `/wallet` (leading slash) vs wallet service `merchant/wallet` — URL mismatch | `hooks/queries/useWallet.ts:9` |
| M4 | HIGH | `TeamContext.refreshTeam()` fires on mount before auth confirmed — guaranteed 401 on cold start | `contexts/TeamContext.tsx:773-776` |
| M5 | HIGH | Race condition: multiple socket `order-event` burst → multiple stacked 500ms `onRefresh` timers, no dedup | `hooks/useMerchantOrders.ts` |
| M6 | HIGH | Background → foreground cycle: SocketContext reconnects but `useRealTimeUpdates`-cleared `TeamContext` handler is gone permanently | `contexts/SocketContext.tsx` + `hooks/useRealTimeUpdates.ts` |
| M7 | MEDIUM | Analytics screen uses raw string query keys `['analytics-overview', dateRange, storeId]` — mutation invalidations never reach it | `app/(dashboard)/analytics.tsx:99-171` |
| M8 | MEDIUM | `OnboardingContext` auto-save timer resets on every keystroke (deps include form data) — will never fire during active typing | `contexts/OnboardingContext.tsx:387` |
| M9 | MEDIUM | `MerchantContext.loadAnalytics()` silently falls back to `dashboardService.getMetrics()` with dynamic import to avoid circular dep — real analytics endpoint may be broken | `contexts/MerchantContext.tsx:257-287` |
| M10 | MEDIUM | 12 of 19 `dashboardService` methods have no React Query hooks and no caching — always hit the network fresh | `services/api/dashboard.ts` |
| M11 | MEDIUM | Dual team data: `TeamContext` + `hooks/queries/useTeam.ts` fetch same endpoints independently — optimistic updates in TeamContext don't update React Query cache | `contexts/TeamContext.tsx`, `hooks/queries/useTeam.ts` |

---

## CROSS-APP COMPARISON

### Admin: React Query hooks defined but never called
16 hooks in `hooks/queries/` — 0 used in dashboard screens.

### Merchant: 12 dashboard endpoints with no caching
`getCustomerPayments()`, `getStorePerformance()`, `getActionItems()`, `getTodayRevenueSummary()`, `getTopItemsToday()`, `getCampaignPerformance()`, `getCustomerRetentionMetrics()`, `getBasketSizeTrend()`, `getHealthScore()`, `getCampaignRecommendations()`, `getRendezBookings()`, `getAllDashboardData()` — all uncached.
