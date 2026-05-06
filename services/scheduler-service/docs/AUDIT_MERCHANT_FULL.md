# Merchant App Full Audit Report

**Date:** 2026-04-10
**Auditor:** Code Quality Analyzer
**Codebase:** `/rezmerchant/rez-merchant-master/`
**Backend target:** `https://api.rezapp.com/api` (merchant routes at `/api/merchant/*`)

---

## Executive Summary

Critical issues found:

- **3 missing route files** linked from navigation cause hard crashes when navigated to (`/brand/create`, `/try/merchant/analytics`, `/discounts/builder`)
- **`/maintenance` screen registered in `_layout.tsx`** but the Stack.Screen declaration is absent — Expo Router will not match it during maintenance redirect
- **`payments.ts` service calls wrong base path** — uses `store-payment/history/:storeId` which does NOT match the documented `/api/merchant/*` pattern; this entire payments history screen is broken in production
- **Raw `fetch()` still used for 12+ product operations** bypassing the centralised `apiClient`, meaning token refresh, cookie auth, and fingerprint headers are all missing for those calls
- **`coinDrops.ts`, `brandedCoins.ts`, `earningAnalytics.ts`** prepend a leading slash to URLs (e.g. `/merchant/stores/...`) which causes double-slash URL construction when combined with the base URL in `apiClient`
- **`hotel-ota.tsx`** has a hard-coded `TODO` — hotel staff token is never loaded from storage; the screen is permanently stuck in "connect" state
- **No `.env` file is present** in the repo; `EXPO_PUBLIC_API_BASE_URL` is unset, so dev always falls back to `localhost:3007`, and a production build without these vars throws a fatal error
- **`MerchantContext.loadAnalytics()`** uses a dynamic import of `dashboardService` with the comment "TEMPORARILY" — this is not temporary, it is permanent undocumented technical debt
- **`SocketProvider`** disconnects the socket every time the app goes to background, but does not re-join merchant rooms on reconnection — real-time order alerts are silently dropped after backgrounding
- **Auth flow has no login screen guard** — `app/index.tsx` redirects authenticated users but there is no middleware preventing unauthenticated deep-links to dashboard screens

---

## 1. Screen/Navigation Audit

### 1.1 Complete Screen Inventory

| Screen File | Route Path | Status |
|---|---|---|
| `app/index.tsx` | `/` | OK — auth redirect gate |
| `app/_layout.tsx` | Root layout | OK |
| `app/(auth)/login.tsx` | `/(auth)/login` | OK |
| `app/(auth)/register.tsx` | `/(auth)/register` | OK |
| `app/(auth)/forgot-password.tsx` | `/(auth)/forgot-password` | OK |
| `app/(auth)/_layout.tsx` | `/(auth)` stack | OK |
| `app/(dashboard)/index.tsx` | `/(dashboard)` | OK |
| `app/(dashboard)/products.tsx` | `/(dashboard)/products` | OK |
| `app/(dashboard)/orders.tsx` | `/(dashboard)/orders` | OK |
| `app/(dashboard)/analytics.tsx` | `/(dashboard)/analytics` | OK |
| `app/(dashboard)/more.tsx` | `/(dashboard)/more` | OK |
| `app/(dashboard)/wallet.tsx` | `/(dashboard)/wallet` | OK |
| `app/(dashboard)/coins.tsx` | `/(dashboard)/coins` | OK |
| `app/(dashboard)/cashback.tsx` | `/(dashboard)/cashback` | OK |
| `app/(dashboard)/deals.tsx` | `/(dashboard)/deals` | OK |
| `app/(dashboard)/team.tsx` | `/(dashboard)/team` | OK |
| `app/(dashboard)/audit.tsx` | `/(dashboard)/audit` | OK |
| `app/(dashboard)/payments.tsx` | `/(dashboard)/payments` | BROKEN — wrong API endpoint |
| `app/(dashboard)/marketing.tsx` | `/(dashboard)/marketing` | OK |
| `app/(dashboard)/reports.tsx` | `/(dashboard)/reports` | OK |
| `app/(dashboard)/broadcast.tsx` | `/(dashboard)/broadcast` | OK |
| `app/(dashboard)/growth.tsx` | `/(dashboard)/growth` | OK |
| `app/(dashboard)/kds-tab.tsx` | `/(dashboard)/kds-tab` | OK |
| `app/(dashboard)/pos-shortcut.tsx` | `/(dashboard)/pos-shortcut` | OK |
| `app/(dashboard)/subscription.tsx` | `/(dashboard)/subscription` | OK |
| `app/(dashboard)/subscription-plans.tsx` | `/(dashboard)/subscription-plans` | OK |
| `app/(dashboard)/payouts.tsx` | `/(dashboard)/payouts` | OK |
| `app/(dashboard)/bonus-campaigns.tsx` | `/(dashboard)/bonus-campaigns` | OK |
| `app/(dashboard)/bundles.tsx` | `/(dashboard)/bundles` | OK |
| `app/(dashboard)/aov-analytics.tsx` | `/(dashboard)/aov-analytics` | OK |
| `app/(dashboard)/campaign-simulator.tsx` | `/(dashboard)/campaign-simulator` | OK |
| `app/(dashboard)/campaign-roi.tsx` | `/(dashboard)/campaign-roi` | OK |
| `app/(dashboard)/campaign-rules.tsx` | `/(dashboard)/campaign-rules` | OK |
| `app/(dashboard)/create-offer.tsx` | `/(dashboard)/create-offer` | OK |
| `app/(dashboard)/integrations.tsx` | `/(dashboard)/integrations` | OK |
| `app/(dashboard)/dynamic-pricing.tsx` | `/(dashboard)/dynamic-pricing` | OK |
| `app/(dashboard)/product-restore.tsx` | `/(dashboard)/product-restore` | OK |
| `app/(dashboard)/aggregator-orders.tsx` | `/(dashboard)/aggregator-orders` | OK |
| `app/(dashboard)/visits.tsx` | `/(dashboard)/visits` | OK |
| `app/(dashboard)/promote.tsx` | `/(dashboard)/promote` | OK |
| `app/(dashboard)/post-purchase.tsx` | `/(dashboard)/post-purchase` | OK |
| `app/(dashboard)/try-trials.tsx` | `/(dashboard)/try-trials` | OK |
| `app/(dashboard)/corporate.tsx` | `/(dashboard)/corporate` | OK |
| `app/onboarding/index.tsx` | `/onboarding` | OK |
| `app/onboarding/welcome.tsx` | `/onboarding/welcome` | OK |
| `app/onboarding/business-info.tsx` | `/onboarding/business-info` | OK |
| `app/onboarding/store-details.tsx` | `/onboarding/store-details` | OK |
| `app/onboarding/documents.tsx` | `/onboarding/documents` | OK |
| `app/onboarding/bank-details.tsx` | `/onboarding/bank-details` | OK |
| `app/onboarding/review-submit.tsx` | `/onboarding/review-submit` | OK |
| `app/onboarding/pending-approval.tsx` | `/onboarding/pending-approval` | OK |
| `app/onboarding/merchant-checklist.tsx` | `/onboarding/merchant-checklist` | OK |
| `app/onboarding/progress-checklist.tsx` | `/onboarding/progress-checklist` | OK |
| `app/onboarding/step1.tsx` … `step5.tsx` | `/onboarding/step[1-5]` | OK |
| `app/pos/index.tsx` | `/pos` | OK |
| `app/pos/quick-bill.tsx` | `/pos/quick-bill` | OK |
| `app/pos/payment.tsx` | `/pos/payment` | OK |
| `app/pos/recent-orders.tsx` | `/pos/recent-orders` | OK |
| `app/pos/refund.tsx` | `/pos/refund` | OK |
| `app/pos/shift-open.tsx` | `/pos/shift-open` | OK |
| `app/pos/shift-close.tsx` | `/pos/shift-close` | OK |
| `app/pos/offline.tsx` | `/pos/offline` | OK |
| `app/pos/success.tsx` | `/pos/success` | OK |
| `app/orders/[id].tsx` | `/orders/[id]` | OK |
| `app/orders/live.tsx` | `/orders/live` | OK |
| `app/orders/analytics.tsx` | `/orders/analytics` | OK |
| `app/orders/web-order/[orderNumber].tsx` | `/orders/web-order/[orderNumber]` | OK |
| `app/analytics/index.tsx` | `/analytics` | OK |
| `app/analytics/revenue.tsx` | `/analytics/revenue` | OK |
| `app/analytics/sales.tsx` | `/analytics/sales` | OK |
| `app/analytics/growth.tsx` | `/analytics/growth` | OK |
| `app/analytics/customers.tsx` | `/analytics/customers` | OK |
| `app/analytics/products.tsx` | `/analytics/products` | OK |
| `app/analytics/trends.tsx` | `/analytics/trends` | OK |
| `app/analytics/offers.tsx` | `/analytics/offers` | OK |
| `app/analytics/peak-hours.tsx` | `/analytics/peak-hours` | OK |
| `app/analytics/comparison.tsx` | `/analytics/comparison` | OK |
| `app/analytics/forecast.tsx` | `/analytics/forecast` | OK |
| `app/analytics/pnl.tsx` | `/analytics/pnl` | OK |
| `app/analytics/nps.tsx` | `/analytics/nps` | OK |
| `app/analytics/cohorts.tsx` | `/analytics/cohorts` | OK |
| `app/analytics/expenses.tsx` | `/analytics/expenses` | OK |
| `app/analytics/food-cost.tsx` | `/analytics/food-cost` | OK |
| `app/analytics/waste.tsx` | `/analytics/waste` | OK |
| `app/analytics/inventory.tsx` | `/analytics/inventory` | OK |
| `app/analytics/menu-engineering.tsx` | `/analytics/menu-engineering` | OK |
| `app/analytics/stores-compare.tsx` | `/analytics/stores-compare` | OK |
| `app/analytics/overview.tsx` | `/analytics/overview` | OK |
| `app/analytics/offer-performance.tsx` | `/analytics/offer-performance` | OK |
| `app/analytics/rez-summary.tsx` | `/analytics/rez-summary` | OK |
| `app/analytics/sales-forecast.tsx` | `/analytics/sales-forecast` | OK |
| `app/analytics/export.tsx` | `/analytics/export` | OK |
| `app/analytics/web-feedback.tsx` | `/analytics/web-feedback` | OK |
| `app/kds/index.tsx` | `/kds` | OK |
| `app/kds/settings.tsx` | `/kds/settings` | OK |
| `app/settlements/index.tsx` | `/settlements` | OK |
| `app/settlements/[settlementId].tsx` | `/settlements/[settlementId]` | OK |
| `app/payouts/index.tsx` | `/payouts` | OK |
| `app/loyalty/index.tsx` | `/loyalty` | OK |
| `app/loyalty/punch-cards.tsx` | `/loyalty/punch-cards` | OK |
| `app/inventory/index.tsx` | `/inventory` | OK |
| `app/inventory/alerts.tsx` | `/inventory/alerts` | OK |
| `app/gst/index.tsx` | `/gst` | OK |
| `app/customers/index.tsx` | `/customers` | OK |
| `app/customers/[userId].tsx` | `/customers/[userId]` | OK |
| `app/customers/segments.tsx` | `/customers/segments` | OK |
| `app/customers/message.tsx` | `/customers/message` | OK |
| `app/customers/insights.tsx` | `/customers/insights` | OK |
| `app/crm/index.tsx` | `/crm` | OK |
| `app/crm/[userId].tsx` | `/crm/[userId]` | OK |
| `app/team/index.tsx` | `/team` | OK |
| `app/team/[userId].tsx` | `/team/[userId]` | OK |
| `app/team/invite.tsx` | `/team/invite` | OK |
| `app/team/roles.tsx` | `/team/roles` | OK |
| `app/team/permissions.tsx` | `/team/permissions` | OK |
| `app/team/rota.tsx` | `/team/rota` | OK |
| `app/team/activity.tsx` | `/team/activity` | OK |
| `app/team/timesheet.tsx` | `/team/timesheet` | OK |
| `app/team/clock.tsx` | `/team/clock` | OK |
| `app/team/attendance/index.tsx` | `/team/attendance` | OK |
| `app/team/payroll/index.tsx` | `/team/payroll` | OK |
| `app/team/payroll/[staffId].tsx` | `/team/payroll/[staffId]` | OK |
| `app/stores/index.tsx` | `/stores` | OK |
| `app/stores/add.tsx` | `/stores/add` | OK |
| `app/stores/locations.tsx` | `/stores/locations` | OK |
| `app/stores/[id].tsx` | `/stores/[id]` | OK |
| `app/stores/[id]/details.tsx` | `/stores/[id]/details` | OK |
| `app/stores/[id]/edit.tsx` | `/stores/[id]/edit` | OK |
| `app/stores/[id]/branded-coins.tsx` | `/stores/[id]/branded-coins` | OK |
| `app/stores/[id]/coin-drops.tsx` | `/stores/[id]/coin-drops` | OK |
| `app/stores/[id]/loyalty-program.tsx` | `/stores/[id]/loyalty-program` | OK |
| `app/stores/[id]/creator-analytics.tsx` | `/stores/[id]/creator-analytics` | OK |
| `app/stores/[id]/earning-analytics.tsx` | `/stores/[id]/earning-analytics` | OK |
| `app/stores/[id]/reviews.tsx` | `/stores/[id]/reviews` | OK |
| `app/stores/[id]/gallery.tsx` | `/stores/[id]/gallery` | OK |
| `app/stores/[id]/promotions.tsx` | `/stores/[id]/promotions` | OK |
| `app/stores/[id]/deals.tsx` | `/stores/[id]/deals` | OK |
| `app/stores/[id]/deals/add.tsx` | `/stores/[id]/deals/add` | OK |
| `app/stores/[id]/deals/[dealId].tsx` | `/stores/[id]/deals/[dealId]` | OK |
| `app/stores/[id]/discounts.tsx` | `/stores/[id]/discounts` | OK |
| `app/stores/[id]/discounts/add.tsx` | `/stores/[id]/discounts/add` | OK |
| `app/stores/[id]/discounts/[discountId].tsx` | `/stores/[id]/discounts/[discountId]` | OK |
| `app/stores/[id]/vouchers.tsx` | `/stores/[id]/vouchers` | OK |
| `app/stores/[id]/vouchers/add.tsx` | `/stores/[id]/vouchers/add` | OK |
| `app/stores/[id]/vouchers/[voucherId].tsx` | `/stores/[id]/vouchers/[voucherId]` | OK |
| `app/stores/[id]/outlets.tsx` | `/stores/[id]/outlets` | OK |
| `app/stores/[id]/outlets/add.tsx` | `/stores/[id]/outlets/add` | OK |
| `app/stores/[id]/outlets/[outletId].tsx` | `/stores/[id]/outlets/[outletId]` | OK |
| `app/stores/[id]/table-bookings.tsx` | `/stores/[id]/table-bookings` | OK |
| `app/stores/[id]/floor-plan.tsx` | `/stores/[id]/floor-plan` | OK |
| `app/stores/[id]/qr-code.tsx` | `/stores/[id]/qr-code` | OK |
| `app/stores/[id]/ugc.tsx` | `/stores/[id]/ugc` | OK |
| `app/stores/[id]/gift-cards.tsx` | `/stores/[id]/gift-cards` | OK |
| `app/stores/[id]/payment-settings.tsx` | `/stores/[id]/payment-settings` | OK |
| `app/stores/[id]/promotional-videos.tsx` | `/stores/[id]/promotional-videos` | OK |
| `app/stores/[id]/prive-campaigns/index.tsx` | `/stores/[id]/prive-campaigns` | OK |
| `app/stores/[id]/prive-campaigns/create.tsx` | `/stores/[id]/prive-campaigns/create` | OK |
| `app/stores/[id]/prive-campaigns/submissions.tsx` | `/stores/[id]/prive-campaigns/submissions` | OK |
| `app/products/add.tsx` | `/products/add` | OK |
| `app/products/[id].tsx` | `/products/[id]` | OK |
| `app/products/edit/[id].tsx` | `/products/edit/[id]` | OK |
| `app/products/export.tsx` | `/products/export` | OK |
| `app/products/import.tsx` | `/products/import` | OK |
| `app/products/bulk-upload.tsx` | `/products/bulk-upload` | OK |
| `app/products/bulk-actions.tsx` | `/products/bulk-actions` | OK |
| `app/products/inventory.tsx` | `/products/inventory` | OK |
| `app/products/stock-alerts.tsx` | `/products/stock-alerts` | OK |
| `app/products/combo.tsx` | `/products/combo` | OK |
| `app/products/[id]/images.tsx` | `/products/[id]/images` | OK |
| `app/products/[id]/modifiers.tsx` | `/products/[id]/modifiers` | OK |
| `app/products/variants/[productId].tsx` | `/products/variants/[productId]` | OK |
| `app/products/variants/add/[productId].tsx` | `/products/variants/add/[productId]` | OK |
| `app/products/variants/edit/[variantId].tsx` | `/products/variants/edit/[variantId]` | OK |
| `app/notifications/index.tsx` | `/notifications` | OK |
| `app/notifications/[notificationId].tsx` | `/notifications/[notificationId]` | OK |
| `app/notifications/preferences.tsx` | `/notifications/preferences` | OK |
| `app/notifications/settings.tsx` | `/notifications/settings` | OK |
| `app/settings/index.tsx` | `/settings` | OK |
| `app/settings/profile.tsx` | `/settings/profile` | OK |
| `app/settings/notifications.tsx` | `/settings/notifications` | OK |
| `app/settings/about.tsx` | `/settings/about` | OK |
| `app/settings/printer.tsx` | `/settings/printer` | OK |
| `app/settings/staff.tsx` | `/settings/staff` | OK |
| `app/settings/business-hours.tsx` | `/settings/business-hours` | OK |
| `app/settings/feature-flags.tsx` | `/settings/feature-flags` | OK |
| `app/settings/system-status.tsx` | `/settings/system-status` | OK |
| `app/settings/moderation-status.tsx` | `/settings/moderation-status` | OK |
| `app/settings/social-booking.tsx` | `/settings/social-booking` | OK |
| `app/settings/calendar-sync.tsx` | `/settings/calendar-sync` | OK |
| `app/categories/index.tsx` | `/categories` | OK |
| `app/categories/organize.tsx` | `/categories/organize` | OK |
| `app/categories/edit/[id].tsx` | `/categories/edit/[id]` | OK |
| `app/events/index.tsx` | `/events` | OK |
| `app/events/add.tsx` | `/events/add` | OK |
| `app/events/[id]/index.tsx` | `/events/[id]` | OK |
| `app/events/[id]/edit.tsx` | `/events/[id]/edit` | OK |
| `app/events/[id]/bookings.tsx` | `/events/[id]/bookings` | OK |
| `app/appointments/index.tsx` | `/appointments` | OK |
| `app/appointments/new.tsx` | `/appointments/new` | OK |
| `app/appointments/[id].tsx` | `/appointments/[id]` | OK |
| `app/appointments/calendar.tsx` | `/appointments/calendar` | OK |
| `app/appointments/waitlist.tsx` | `/appointments/waitlist` | OK |
| `app/appointments/blocked-time.tsx` | `/appointments/blocked-time` | OK |
| `app/appointments/booking-link.tsx` | `/appointments/booking-link` | OK |
| `app/appointments/no-show-protection.tsx` | `/appointments/no-show-protection` | OK |
| `app/services/index.tsx` | `/services` | OK |
| `app/services/add.tsx` | `/services/add` | OK |
| `app/services/bookings.tsx` | `/services/bookings` | OK |
| `app/service-packages/index.tsx` | `/service-packages` | OK |
| `app/class-schedule/index.tsx` | `/class-schedule` | OK |
| `app/treatment-rooms/index.tsx` | `/treatment-rooms` | OK |
| `app/consultation-forms/index.tsx` | `/consultation-forms` | OK |
| `app/consultation-forms/builder.tsx` | `/consultation-forms/builder` | OK |
| `app/dine-in/index.tsx` | `/dine-in` | OK |
| `app/dine-in/table/[tableId].tsx` | `/dine-in/table/[tableId]` | OK |
| `app/dine-in/waiter-mode.tsx` | `/dine-in/waiter-mode` | OK |
| `app/dine-in/new-order.tsx` | `/dine-in/new-order` | OK |
| `app/floor-plan/index.tsx` | `/floor-plan` | OK |
| `app/audit/index.tsx` | `/audit` | OK |
| `app/audit/[logId].tsx` | `/audit/[logId]` | OK |
| `app/audit/timeline.tsx` | `/audit/timeline` | OK |
| `app/audit/statistics.tsx` | `/audit/statistics` | OK |
| `app/audit/compliance.tsx` | `/audit/compliance` | OK |
| `app/audit/filters.tsx` | `/audit/filters` | OK |
| `app/audit/archives.tsx` | `/audit/archives` | OK |
| `app/documents/index.tsx` | `/documents` | OK |
| `app/documents/invoices/[orderId].tsx` | `/documents/invoices/[orderId]` | OK |
| `app/documents/packing-slips/[orderId].tsx` | `/documents/packing-slips/[orderId]` | OK |
| `app/documents/labels/[orderId].tsx` | `/documents/labels/[orderId]` | OK |
| `app/documents/pos-invoice/[billId].tsx` | `/documents/pos-invoice/[billId]` | OK |
| `app/documents/quotations.tsx` | `/documents/quotations` | OK |
| `app/documents/credit-notes.tsx` | `/documents/credit-notes` | OK |
| `app/documents/delivery-challan.tsx` | `/documents/delivery-challan` | OK |
| `app/documents/tally-export.tsx` | `/documents/tally-export` | OK |
| `app/documents/gstr-export.tsx` | `/documents/gstr-export` | OK |
| `app/campaigns/roi.tsx` | `/campaigns/roi` | OK |
| `app/campaigns/simulator.tsx` | `/campaigns/simulator` | OK |
| `app/campaigns/performance.tsx` | `/campaigns/performance` | OK |
| `app/campaigns/recommendations.tsx` | `/campaigns/recommendations` | OK |
| `app/try/merchant/create.tsx` | `/try/merchant/create` | OK |
| `app/try/merchant/[id].tsx` | `/try/merchant/[id]` | OK |
| `app/try/merchant/scanner.tsx` | `/try/merchant/scanner` | OK |
| `app/brand/index.tsx` | `/brand` | PARTIALLY BROKEN — links to `/brand/create` which doesn't exist |
| `app/social-impact/index.tsx` | `/social-impact` | OK |
| `app/social-impact/add.tsx` | `/social-impact/add` | OK |
| `app/social-impact/[id]/index.tsx` | `/social-impact/[id]` | OK |
| `app/social-impact/[id]/edit.tsx` | `/social-impact/[id]/edit` | OK |
| `app/social-impact/[id]/scan.tsx` | `/social-impact/[id]/scan` | OK |
| `app/social-impact/[id]/participants.tsx` | `/social-impact/[id]/participants` | OK |
| `app/khata/index.tsx` | `/khata` | OK |
| `app/khata/add.tsx` | `/khata/add` | OK |
| `app/khata/[customerId].tsx` | `/khata/[customerId]` | OK |
| `app/discounts/index.tsx` | `/discounts` | OK |
| `app/discounts/builder.tsx` | `/discounts/builder` | OK |
| `app/expenses/index.tsx` | `/expenses` | OK |
| `app/expenses/add.tsx` | `/expenses/add` | OK |
| `app/staff-shifts/index.tsx` | `/staff-shifts` | OK |
| `app/staff-shifts/post-to-hub.tsx` | `/staff-shifts/post-to-hub` | OK |
| `app/suppliers/index.tsx` | `/suppliers` | OK |
| `app/suppliers/add.tsx` | `/suppliers/add` | OK |
| `app/suppliers/[id].tsx` | `/suppliers/[id]` | OK |
| `app/purchase-orders/index.tsx` | `/purchase-orders` | OK |
| `app/purchase-orders/create.tsx` | `/purchase-orders/create` | OK |
| `app/purchase-orders/[id].tsx` | `/purchase-orders/[id]` | OK |
| `app/recipes/index.tsx` | `/recipes` | OK |
| `app/recipes/new.tsx` | `/recipes/new` | OK |
| `app/recipes/[productId].tsx` | `/recipes/[productId]` | OK |
| `app/messages/index.tsx` | `/messages` | OK |
| `app/messages/[conversationId].tsx` | `/messages/[conversationId]` | OK |
| `app/fraud/index.tsx` | `/fraud` | OK |
| `app/fraud/[id].tsx` | `/fraud/[id]` | OK |
| `app/disputes/index.tsx` | `/disputes` | OK |
| `app/ads/index.tsx` | `/ads` | OK |
| `app/ads/create.tsx` | `/ads/create` | OK |
| `app/reports/export.tsx` | `/reports/export` | OK |
| `app/reports.tsx` | `/reports` | OK (but named-route conflict with `/reports/export`) |
| `app/aov-rewards/index.tsx` | `/aov-rewards` | OK |
| `app/upsell-rules/index.tsx` | `/upsell-rules` | OK |
| `app/qr-generator/index.tsx` | `/qr-generator` | OK |
| `app/qr-checkin.tsx` | `/qr-checkin` | OK |
| `app/rez-capital/index.tsx` | `/rez-capital` | OK |
| `app/subscription/index.tsx` | `/subscription` | OK |
| `app/hotel-ota.tsx` | `/hotel-ota` | BROKEN — always stuck in connect state (TODO unimplemented) |
| `app/automation/index.tsx` | `/automation` | OK |
| `app/automation/edit.tsx` | `/automation/edit` | OK |
| `app/catalog/index.tsx` | `/catalog` | OK |
| `app/all-table-bookings.tsx` | `/all-table-bookings` | OK |
| `app/customer-push.tsx` | `/customer-push` | OK |
| `app/promotion-toolkit.tsx` | `/promotion-toolkit` | OK |
| `app/goals/index.tsx` | `/goals` | OK |
| `app/stamp-cards/index.tsx` | `/stamp-cards` | OK |
| `app/gift-cards/index.tsx` | `/gift-cards` | OK |
| `app/tickets/index.tsx` | `/tickets` | OK |
| `app/maintenance.tsx` | `/maintenance` | BROKEN — not declared in `Stack` in `_layout.tsx` |
| `app/update-required.tsx` | `/update-required` | OK — declared in `Stack` |
| `app/(cashback)/[id].tsx` | `/(cashback)/[id]` | OK |
| `app/(cashback)/analytics.tsx` | `/(cashback)/analytics` | OK |
| `app/(cashback)/bulk-actions.tsx` | `/(cashback)/bulk-actions` | OK |
| `app/marketing/templates.tsx` | `/marketing/templates` | OK |
| `app/reset-password/[token].tsx` | `/reset-password/[token]` | OK |
| `app/+not-found.tsx` | `*` | OK |

### 1.2 Missing Screens (referenced in code but no file exists)

| Referenced Route | Where Referenced | Severity |
|---|---|---|
| `/brand/create` | `app/brand/index.tsx` lines 123, 139 | High — pressing "Create Brand" crashes with not-found |
| `/try/merchant/analytics` | `app/(dashboard)/more.tsx` route, `app/try/merchant/[id].tsx` line 193 | High — TRY Analytics entry point missing entirely |
| `/try/merchant/analytics` (query) | `app/try/merchant/[id].tsx` | High — analytics cannot be viewed from trial detail |

Note: `app/discounts/builder.tsx` **does exist** — this is not a missing file. But `disounts/builder` is not registered as a Stack.Screen in `_layout.tsx`, which means it works only because Expo Router auto-discovers files. Deep-linking to it bypasses any auth guard.

### 1.3 Navigation Flow Issues

1. **`/maintenance` redirect crashes.** `_layout.tsx` line 156 calls `router.replace('/maintenance')` during `checkAppStatus()`. The `maintenance` route is never declared in the `<Stack>` component inside `_layout.tsx`. Only `update-required` is declared. Expo Router will throw a not-found error in strict mode.

2. **`/stores` not declared as a Stack.Screen.** The `stores` stack is navigated to from `more.tsx` but is not in the `_layout.tsx` Stack declaration. Works by file-system discovery but lacks any header configuration and has no auth guard specified.

3. **No auth guard middleware.** Screens outside `(dashboard)` and `(auth)` — e.g. `/analytics`, `/orders/[id]`, `/pos` — are accessible if someone constructs a deep-link. There is no `ProtectedRoute` wrapper applied in the root layout; only `/(dashboard)` checks auth via the initial redirect in `app/index.tsx`.

4. **Duplicate `/reports` route.** Both `app/reports.tsx` and `app/(dashboard)/reports` exist. The tab routes to `/(dashboard)/reports` and the more-menu routes to `/reports/export`. The plain `/reports` file-based route at `app/reports.tsx` is never registered in the Stack and may conflict.

5. **KDS tab routing inconsistency.** The KDS tab in `_layout.tsx` sets `href: showKdsTab ? '/kds' : null`. When `showKdsTab` is false (admin/manager), the tab is hidden. However, `/kds` is still navigable from the More screen for all roles — the role check is inconsistent.

---

## 2. API Connection Audit

### 2.1 All API Calls Inventory (Service Layer)

| Service File | Method | Endpoint Called | Pattern Match `/api/merchant/*`? |
|---|---|---|---|
| `auth.ts` | `login` | `merchant/auth/login` | Yes |
| `auth.ts` | `register` | `merchant/auth/register` | Yes |
| `auth.ts` | `refreshToken` | `merchant/auth/refresh` | Yes |
| `auth.ts` | `getProfile` | `merchant/auth/me` | Yes |
| `auth.ts` | `updateProfile` | `merchant/auth/profile` | Yes |
| `auth.ts` | `changePassword` | `merchant/auth/change-password` | Yes |
| `auth.ts` | `logout` | `merchant/auth/logout` | Yes |
| `auth.ts` | `forgotPassword` | `merchant/auth/forgot-password` | Yes |
| `auth.ts` | `resetPassword` | `merchant/auth/reset-password` | Yes |
| `auth.ts` | `verifyEmail` | `merchant/auth/verify-email` | Yes |
| `orders.ts` | `getOrders` | `merchant/orders` | Yes |
| `orders.ts` | `getOrderById` | `merchant/orders/:id` | Yes |
| `orders.ts` | `updateOrderStatus` | `merchant/orders/:id/status` | Yes |
| `orders.ts` | `bulkAction` | `merchant/orders/bulk-action` | Yes |
| `orders.ts` | `getAnalytics` | `merchant/orders/analytics` | Yes |
| `products.ts` | `getProducts` | `merchant/products` | Yes |
| `products.ts` | `getProductById` | `merchant/products/:id` | Yes |
| `products.ts` | `createProduct` | `merchant/products` | Yes |
| `products.ts` | `updateProduct` | `merchant/products/:id` | Yes |
| `products.ts` | `deleteProduct` | `merchant/products/:id` | Yes |
| `products.ts` | `getCategories` | `merchant/products/categories` | Yes |
| `products.ts` | `bulkAction` | `merchant/products/bulk-action` | Yes — but uses raw `fetch()` |
| `products.ts` | `exportProducts` | `merchant/bulk/products/export` | Yes — but uses raw `fetch()` |
| `products.ts` | `importProducts` | `merchant/bulk/products/import` | Yes — but uses raw `fetch()` |
| `products.ts` | variant CRUD | `merchant/products/:id/variants` | Yes — but uses raw `fetch()` |
| `products.ts` | `validate-sku` | `merchant/products/validate-sku` | Yes — but uses raw `fetch()` |
| `products.ts` | `86` (item stop) | `merchant/products/:id/86` | Yes — but uses raw `fetch()` |
| `payments.ts` | `getPayments` | `store-payment/history/:storeId` | **NO — missing `/merchant/` prefix** |
| `payments.ts` | `getPaymentStats` | `store-payment/stats/:storeId` | **NO — missing `/merchant/` prefix** |
| `analytics.ts` | `getAnalyticsOverview` | `merchant/analytics/overview` | Yes |
| `analytics.ts` | `getSalesForecast` | `merchant/analytics/forecast/sales` | Yes |
| `settlements.ts` | `getSettlements` | `merchant/liability` | Yes |
| `settlements.ts` | `getSummary` | `merchant/liability/summary` | Yes |
| `stores.ts` | `getStores` | `merchant/stores` | Yes |
| `stores.ts` | `getActiveStore` | `merchant/stores/active` | Yes |
| `stores.ts` | `getStoreById` | `merchant/stores/:id` | Yes |
| `stores.ts` | `createStore` | `merchant/stores` | Yes |
| `stores.ts` | `updateStore` | `merchant/stores/:id` | Yes |
| `stores.ts` | `deleteStore` | `merchant/stores/:id` | Yes |
| `stores.ts` | `activateStore` | `merchant/stores/:id/activate` | Yes |
| `stores.ts` | `deactivateStore` | `merchant/stores/:id/deactivate` | Yes |
| `coinDrops.ts` | all methods | `/merchant/stores/:id/coin-drops/*` | **URL has leading slash — double slash bug** |
| `brandedCoins.ts` | all methods | `/merchant/stores/:id/branded-campaigns/*` | **URL has leading slash — double slash bug** |
| `earningAnalytics.ts` | `getStoreAnalytics` | `/merchant/stores/:id/earning-analytics` | **URL has leading slash — double slash bug** |
| `pos.ts` | `generateTransactionRef` | `/merchant/pos/generate-transaction-ref` | **URL has leading slash — double slash bug** |
| `pos.ts` | `createOrder` | `merchant/pos/create-order` | Yes |
| `pos.ts` | `getRecentOrders` | `merchant/pos/recent-orders` | Yes |

### 2.2 Broken / Wrong Endpoints

1. **`services/api/payments.ts` — Wrong base path (P0)**
   - `getPayments()` calls: `store-payment/history/${storeId}`
   - `getPaymentStats()` calls: `store-payment/stats/${storeId}`
   - Both bypass the `merchant/` prefix. The `apiClient` routes `merchant/*` to the merchant-service. `store-payment/` has no such routing rule. In production this hits the monolith backend, not the merchant-service. If the monolith does not have this route the entire Payments screen returns 404.

2. **Leading slash on `coinDrops.ts`, `brandedCoins.ts`, `earningAnalytics.ts`, and `pos.ts::generateTransactionRef` (P1)**
   - All use `api.get('/merchant/stores/...')` — note the leading `/`.
   - `apiClient.get()` strips one leading slash (`url.startsWith('/') ? url.slice(1) : url`) so this works — but only by accident. If the stripping logic is ever removed or the URL becomes `//${base}/merchant/...`, requests will break. This is a latent bug.

3. **`pos.ts` `generateTransactionRef` also has leading slash (P1)**
   - Line 118: `/merchant/pos/generate-transaction-ref`
   - Same leading-slash issue as above.

### 2.3 Missing API Methods

| Missing Capability | Where Needed | Notes |
|---|---|---|
| No `getPaymentHistory()` via merchant route | `app/(dashboard)/payments.tsx` | Payments screen uses `store-payment/history/:storeId` instead of `merchant/payment-history` |
| No `getTrialAnalytics()` method | `/try/merchant/analytics` screen | Screen file missing entirely; no API method exists |
| No `createBrand()` method | `/brand/create` | Screen missing; no API method exists |
| No `getBrandDetails()` method | `app/brand/index.tsx` | Brand index screen loads data but there is no service method defined |
| `ordersService.getAnalytics()` falls through to dashboard fallback | Orders analytics | The real endpoint `merchant/orders/analytics` may not exist on the backend yet |

### 2.4 Hardcoded URLs

| File | Line | Hardcoded URL | Issue |
|---|---|---|---|
| `app/_layout.tsx` | 147 | `process.env.EXPO_PUBLIC_API_BASE_URL \|\| 'https://api.rezapp.com'` | Fallback to production URL in layout; acceptable but hides missing env var |
| `app/_layout.tsx` | 150 | `${apiUrl}/config/app-status` | Raw `fetch()` call — bypasses apiClient; no auth headers |
| `config/api.ts` | 20 | `'http://localhost:3007/api'` | Dev fallback; OK |
| `config/api.ts` | 41 | `'http://localhost:3007/api'` | Dev fallback; OK |
| Multiple screen files | Various | `rezpay://pay?billId=...` | Deep-link scheme hardcoded; not configurable |

---

## 3. Auth Flow Audit

### 3.1 Auth Mechanism

- JWT stored in `AsyncStorage` via `storageService` on native; httpOnly cookie on web (`COOKIE_AUTH_ENABLED = true`).
- On web, `getStoredToken()` returns the sentinel string `'cookie-session'` instead of `null` — this prevents false logouts on web, but means any code checking `if (token)` will always be truthy on web even if the cookie is expired.
- Token is injected as `Authorization: Bearer <token>` header by `apiClient` interceptor.

### 3.2 Token Refresh

- Token refresh logic is in `apiClient.setupInterceptors()` — it queues 401 responses, refreshes once, then replays.
- Refresh endpoint: `merchant/auth/refresh` — correct.
- Max queue size capped at 50 — good.
- **Bug: After a successful refresh, `isRefreshing` is reset to `false` on line 218 but the `finally` block comment says "if we reach here after finally block" — there is no `finally` block, only a `try/catch`. The `isRefreshing = false` is in both the success and error paths, which is correct. No bug here — the comment is just misleading.**
- `authService.refreshToken()` is a separate method that is never called directly by screens. All refresh is done by the interceptor. There is therefore a dual-path for refresh that could get out of sync.

### 3.3 Screens Accessible Without Auth

- `app/index.tsx` guards via redirect only after `state.isLoading` is false.
- During the loading window, any deep-link to `/(dashboard)/*` will render the dashboard before the redirect fires because `Stack.Screen name="(dashboard)"` is always registered.
- There is no `useProtectedRoute()` hook or middleware that blocks rendering on protected screens.
- `app/onboarding/*` screens check `isAuthenticated` inside their own `useEffect` — this means the screen renders first and then redirects, potentially flashing content.

### 3.4 Auth Context Issues

- `refreshPermissions()` is called in `checkStoredToken` but `refreshPermissions` is defined after the `useCallback` that calls it. This creates a temporal dependency — `refreshPermissions` from the outer closure may be stale on the first call. **In practice this works because `useCallback` with `[]` deps is stable, but it is a fragile pattern.**
- `MerchantContext.loadAnalytics()` uses `await import('../services/api/dashboard')` inside the function body. The `..` relative path is valid but unusual — most imports use `@/` alias. If the alias resolution changes this import breaks silently.

---

## 4. State Management Audit

### 4.1 Contexts Present

| Context | File | Consumers |
|---|---|---|
| `AuthContext` | `contexts/AuthContext.tsx` | All authenticated screens |
| `StoreContext` | `contexts/StoreContext.tsx` | Dashboard, analytics, orders, POS, payments |
| `MerchantContext` | `contexts/MerchantContext.tsx` | Dashboard index only (`app/(dashboard)/index.tsx`) |
| `SocketContext` | `contexts/SocketContext.tsx` | Orders screen, KDS |
| `NotificationContext` | `contexts/NotificationContext.tsx` | Notification center |
| `TeamContext` | `contexts/TeamContext.tsx` | Not imported in any screen — dead context |
| `OnboardingContext` | `contexts/OnboardingContext.tsx` | Not imported in any screen — dead context |
| `AuditFilterContext` | `contexts/AuditFilterContext.tsx` | Audit screens |

### 4.2 Issues

1. **`TeamContext` is defined but never consumed in any screen.** `app/team/index.tsx` does not import it. All team screens import `useTeam` from `hooks/useTeam.ts` instead. The context is wired into `_layout.tsx`? No — it is not even in `_layout.tsx`. It is dead code that will confuse maintainers.

2. **`OnboardingContext` is defined but not used in any screen.** Onboarding screens use `useOnboarding` from `hooks/useOnboarding.ts` instead. Same dead-context issue.

3. **`MerchantContext` is only consumed in one screen** (`app/(dashboard)/index.tsx`). It wraps the entire app but provides `loadProducts`, `loadOrders`, `loadCashbackRequests` that are never called from any screen. The context is essentially only used for `useMerchant().state.analytics`. This is a god-object context with mostly dead methods.

4. **`StoreContext.createStore()` has a stale closure bug.** The `stores.length` value captured in the `useCallback` deps array is stale at the moment `freshResult` is fetched. The comment acknowledges this and reads from the API instead, but `stores.length` is still in the deps array meaning the callback rebuilds every time the stores list changes — potentially causing extra renders.

5. **`SocketContext` disconnects on app background** (`socketService.disconnect()`) but on reconnect does not re-emit room join events. The backend likely requires the client to re-join the `merchant:{merchantId}` room after reconnect. New orders arriving during the disconnect window will never trigger notifications.

---

## 5. Component Audit

### 5.1 Key Components

| Component | File | Issue |
|---|---|---|
| `ErrorBoundary` | `components/common/ErrorBoundary.tsx` | Present |
| `OfflineBanner` | `components/OfflineBanner.tsx` | Present, uses `@react-native-community/netinfo` |
| `NotificationToastContainer` | `components/notifications/NotificationToastContainer.tsx` | Present |
| `StoreSelector` | `components/stores/StoreSelector.tsx` | Present, used in dashboard header |
| `ProtectedRoute` | `components/common/ProtectedRoute.tsx` | Present but NOT used in any screen |
| `ProtectedAction` | `components/common/ProtectedAction.tsx` | Present but usage is minimal |

### 5.2 `ProtectedRoute` Not Applied

`components/common/ProtectedRoute.tsx` exists but is not imported in any app screen or layout. The intent was to guard routes with RBAC checks, but the component is orphaned. All permission checks are inline in individual screens.

### 5.3 `TrainingNudgeNotification`

`components/TrainingNudgeNotification.tsx` is defined but is not rendered anywhere in the app. Dead component.

### 5.4 Missing Error Boundaries on Critical Screens

`ErrorBoundaryProvider` wraps the entire app at the top level. However, individual feature areas (orders list, analytics charts, POS) do not have localized error boundaries. A crash in `DailyPerformanceChart` would unmount the entire analytics screen rather than showing a partial error state.

---

## 6. Merchant-Specific Flow Audit

### 6.1 Onboarding Flow

**Files:** `app/onboarding/*.tsx`

**Status:** Largely functional with some issues.

- `onboarding/index.tsx` correctly checks auth, fetches status from `onboardingService.getOnboardingStatus()`, and routes to the correct step. Logic is sound.
- Steps 1–5 exist (`step1.tsx`–`step5.tsx`) alongside named-step files (`business-info.tsx`, `store-details.tsx`, `documents.tsx`, `bank-details.tsx`, `review-submit.tsx`). There are **two parallel sets of step files** — the numeric `step1-5` and the named steps. It is unclear which set is the canonical flow; both exist and the `getStepRoute()` helper in `utils/onboardingHelpers.ts` likely maps to one set.
- `onboarding/pending-approval.tsx` exists and is reachable — good.
- **Issue:** The rejection reason UX in `onboarding/index.tsx` renders a "Contact Support" button that calls `Linking.openURL('mailto:support@rez.in...')`. The email domain is `rez.in` but all other support references in the codebase use `rez.money`. Inconsistent support email.
- `onboarding/merchant-checklist.tsx` and `onboarding/progress-checklist.tsx` both exist — unclear which is used in the flow; may be duplicates.

### 6.2 Order Management Flow

**Files:** `app/(dashboard)/orders.tsx`, `app/orders/[id].tsx`, `app/orders/live.tsx`

**Status:** Core flow functional; edge cases broken.

- Order listing uses `useOrdersDashboard` hook with WebSocket updates via `SocketContext` — architecture is correct.
- Accept/reject actions call `ordersService.updateOrderStatus()` which hits `merchant/orders/:id/status` — correct endpoint.
- **Issue:** `normalizeOrderStatus()` is declared at the top of `orders.tsx` (line 1) before the import statements. This is a JavaScript hoisting quirk — works at runtime for a plain function, but it is very unusual placement that could break if the file is ever migrated to ES module strict mode.
- **Issue:** The live orders screen (`orders/live.tsx`) is navigable from the orders tab but it is not declared as a Stack.Screen in `_layout.tsx`. It works via file-system routing but shares no header config with the rest of the orders stack.
- **Issue:** `ordersService.getAnalytics()` has a comment "H3 FIX: call the real order analytics endpoint first; fall back to dashboard metrics only if the endpoint is genuinely absent (404)." This means every time analytics are loaded, it first makes a call to `merchant/orders/analytics` that likely returns 404, then falls back. This adds a guaranteed 404 round-trip on every analytics load.

### 6.3 Menu/Product Management Flow

**Files:** `app/(dashboard)/products.tsx`, `app/products/*.tsx`

**Status:** Core CRUD works; bulk operations partially broken.

- Product add/edit/delete calls go through `productsService` to `merchant/products` — correct.
- **Critical Issue:** Bulk product operations (`bulkAction`, `exportProducts`, `importProducts`, variant CRUD, `validate-sku`, `86` item stop) all use raw `fetch()` with manually retrieved tokens via `storageService.getAuthToken()`. This bypasses:
  - Token refresh interceptor (401s will not refresh the token)
  - Cookie-based auth on web (httpOnly cookie not sent)
  - Device fingerprint header
  - Timeout handling from the axios instance
- If the token expires during a bulk import, the request will fail with 401 and the user will see an error without being auto-logged-in.

### 6.4 Analytics/Dashboard

**Files:** `app/(dashboard)/index.tsx`, `app/(dashboard)/analytics.tsx`, `app/analytics/*.tsx`

**Status:** Real data connected; relies on multiple fallbacks.

- Dashboard index calls `dashboardService.getMetrics()`, `dashboardService.getOverview()`, `dashboardService.getActionItems()` — all go to `merchant/dashboard/*` which maps correctly.
- `MerchantContext.loadAnalytics()` contains the comment "TEMPORARILY: Use existing dashboard metrics instead of separate analytics API." This fallback is not temporary — there is no analytics endpoint being actively developed. The comment misleads future maintainers.
- Analytics tab (`analytics.tsx`) correctly uses `useQuery` with `analyticsService.getAnalyticsOverview()` — real data.
- `overview?.segmentBreakdown` is cast as `(overview as any)?.segmentBreakdown` on lines 271 and 278 of `analytics.tsx`. The `AnalyticsOverview` type does not include `segmentBreakdown`, so the field is cast with `any`. If the backend never returns this field, both "Student Redemptions" and "Employee Redemptions" stat cards will always show 0 without any indication of an error.

### 6.5 Payment/Settlement

**Files:** `app/(dashboard)/payments.tsx`, `app/settlements/index.tsx`, `app/payouts/index.tsx`, `app/subscription/index.tsx`

**Status:** Settlements work; payments screen broken at API level.

- **Payments screen is broken.** `services/api/payments.ts` calls `store-payment/history/:storeId` and `store-payment/stats/:storeId`. These paths do not start with `merchant/`. In production, the nginx configuration routes `/api/merchant/*` to the merchant-service and everything else to the monolith. If `store-payment/*` does not exist on the monolith, every payment history request returns 404. If it does exist on the monolith, it still may lack authorization because the merchant JWT is checked differently on each service.
- Settlements correctly use `merchant/liability` and `merchant/liability/summary` — these are correct paths.
- `settlements.ts` `downloadPayoutStatement()` uses a raw `fetch()` call with manual token retrieval (lines 186–190). Same bypass issue as product bulk operations.
- **Razorpay integration:** `subscription/index.tsx` and `subscription-plans.tsx` both implement Razorpay checkout. The flow is: create order → open Razorpay checkout → verify payment. The `keyId` is expected to come from the backend response (`orderRes.data!.keyId`). If the backend does not return `keyId` in the response, `RazorpayCheckout.open()` will receive an empty key and payments will fail silently or throw.
- `config/payment.ts` reads `EXPO_PUBLIC_RAZORPAY_KEY_ID` from env. There is no `.env` file in the repo. If this var is not set in the EAS build environment, Razorpay will initialize in test mode with an empty key.

---

## 7. Dead Code and Disconnected Features

| Feature | Location | Issue |
|---|---|---|
| `TeamContext` | `contexts/TeamContext.tsx` | Defined, wired in provider tree? No — not in `_layout.tsx`. Dead code. |
| `OnboardingContext` | `contexts/OnboardingContext.tsx` | Defined but not imported anywhere in screens. Dead code. |
| `TrainingNudgeNotification` | `components/TrainingNudgeNotification.tsx` | Component defined, never rendered. |
| `ProtectedRoute` | `components/common/ProtectedRoute.tsx` | Component defined, never applied to routes. Auth protection intent unfulfilled. |
| `MerchantContext.loadProducts()` | `contexts/MerchantContext.tsx` | Method defined; never called from any screen (screens use `productsService` directly). |
| `MerchantContext.loadOrders()` | `contexts/MerchantContext.tsx` | Same — never called from any screen. |
| `MerchantContext.addProduct()`, `updateProduct()`, `deleteProduct()` | `contexts/MerchantContext.tsx` | Method defined but never called; all product mutations go directly to `productsService`. |
| `hotel-ota.tsx` loading flow | `app/hotel-ota.tsx` lines 194–198 | TODO comment; `setLoading(false)` immediately; `load()` only runs if `hotelToken` is non-null; token is never loaded. Screen permanently shows "connect" state. |
| `brand/create` route | Referenced in `app/brand/index.tsx` | The "Create Brand" button links to a non-existent screen. |
| `/try/merchant/analytics` route | `app/(dashboard)/more.tsx`, `app/try/merchant/[id].tsx` | The TRY Analytics screen file does not exist. |
| "TRY Analytics" More menu item | `app/(dashboard)/more.tsx` line 200 | Routes to `/try/merchant/analytics` which does not exist — navigating to it shows not-found. |
| `app/reports.tsx` | Root level | Standalone reports page exists but is not linked from any navigation. `/(dashboard)/reports` is the active one. |
| `RBAC_INTEGRATION_EXAMPLES.tsx` | Root of project | Example file committed to root directory — should be in `/docs` or `/examples`, not the app root. |
| `ONBOARDING_INTEGRATION_EXAMPLE.tsx` | Root of project | Same issue. |

---

## 8. TypeScript Issues

| File | Issue |
|---|---|
| `app/(dashboard)/analytics.tsx` lines 271, 278 | `(overview as any)?.segmentBreakdown` — type cast hides missing fields in `AnalyticsOverview` |
| `contexts/MerchantContext.tsx` line 242 | `await import('../services/api/dashboard')` — relative path import inside context; should use alias |
| `services/api/products.ts` | `tokenCache` is private but `getAuthToken()` reads from `storageService` on every raw `fetch()` call, not from the cache. The cache is never actually used in the raw-fetch methods. |
| `services/api/orders.ts` | `getAnalytics()` `catch (error: any)` and `status = error?.response?.status ?? error?.status` — accesses non-standard `.status` on Error objects; these may always be undefined |
| `app/orders/[id].tsx` | Likely imports `Order` from `@/types/api` but `Order.status` type is `OrderStatus` while `normalizeOrderStatus()` in `orders.tsx` accepts `string` — type mismatch hidden at screen boundaries |
| `services/api/coinDrops.ts`, `brandedCoins.ts`, `earningAnalytics.ts` | Return `response` (the full `ApiResponse` envelope) rather than `response.data`. Callers that destructure `.data` from these methods receive `undefined`. |
| `services/api/pos.ts` | `generateUPILink` is exported as a standalone function but is async — callers in POS screens must `await` it or QR codes will contain `[object Promise]` |
| Multiple files | `any` types on `dashboardService.getMetrics()` return — `metricsData.orders?.total` etc. are all `any` chains with no type safety |

---

## 9. Priority Issue List

### P0 — Critical: Will Cause Runtime Crashes or Data Loss

| # | Issue | File | Description |
|---|---|---|---|
| P0-1 | `/maintenance` route not declared in Stack | `app/_layout.tsx` | `router.replace('/maintenance')` throws not-found; app is unrecoverable during maintenance mode |
| P0-2 | `/brand/create` screen missing | `app/brand/index.tsx` | Pressing "Create Brand" navigates to non-existent screen — hard crash |
| P0-3 | `/try/merchant/analytics` screen missing | `app/(dashboard)/more.tsx`, `app/try/merchant/[id].tsx` | Navigation to not-found; TRY Analytics is entirely inaccessible |
| P0-4 | `hotel-ota.tsx` token never loaded | `app/hotel-ota.tsx` | Permanent TODO makes the Hotel OTA feature permanently broken |

### P1 — High: Incorrect Behavior or API Failures

| # | Issue | File | Description |
|---|---|---|---|
| P1-1 | Payments API wrong base path | `services/api/payments.ts` | `store-payment/history/:id` does not match `/api/merchant/*`; payments screen shows no data or 404 |
| P1-2 | Raw `fetch()` bypasses auth interceptor | `services/api/products.ts` | 12+ product operations (bulk, export, import, variants, 86) miss token refresh, cookie auth, fingerprint header |
| P1-3 | `coinDrops`, `brandedCoins`, `earningAnalytics` leading slash | `services/api/coinDrops.ts`, `brandedCoins.ts`, `earningAnalytics.ts` | Leading `/` in URL is silently stripped today but is a latent correctness bug |
| P1-4 | No `.env` file in repo | Root | `EXPO_PUBLIC_API_BASE_URL` unset; production build throws fatal error; dev silently uses localhost |
| P1-5 | Guarantee 404 round-trip on every orders analytics load | `services/api/orders.ts:getAnalytics()` | Always calls `merchant/orders/analytics` (which likely 404s) before falling back; wastes a network round-trip on every load |
| P1-6 | Socket room not re-joined on reconnect | `contexts/SocketContext.tsx` | After app backgrounds and returns, socket reconnects but does not re-join merchant room; new order alerts silently dropped |
| P1-7 | `settlements.ts::downloadPayoutStatement` uses raw `fetch()` | `services/api/settlements.ts` | PDF download bypasses apiClient; fails on web cookie auth |
| P1-8 | `MerchantContext.loadAnalytics()` uses relative import | `contexts/MerchantContext.tsx` | `import('../services/api/dashboard')` breaks if module resolution changes |
| P1-9 | `Razorpay keyId` may be undefined | `app/subscription/index.tsx`, `app/(dashboard)/subscription-plans.tsx` | If backend does not return `keyId` in order response, payment sheet opens with empty key |

### P2 — Medium: Quality, Maintainability, or Minor User Impact

| # | Issue | File | Description |
|---|---|---|---|
| P2-1 | `TeamContext`, `OnboardingContext` are dead code | `contexts/TeamContext.tsx`, `contexts/OnboardingContext.tsx` | Never imported in `_layout.tsx` or any screen; confuses maintainers |
| P2-2 | `ProtectedRoute` component never applied | `components/common/ProtectedRoute.tsx` | RBAC protection intent not fulfilled; all checks are inline |
| P2-3 | `MerchantContext` mostly dead methods | `contexts/MerchantContext.tsx` | `loadProducts`, `loadOrders`, `addProduct`, `updateProduct`, `deleteProduct` are never called; context is bloated |
| P2-4 | `TrainingNudgeNotification` never rendered | `components/TrainingNudgeNotification.tsx` | Dead component |
| P2-5 | `(overview as any)?.segmentBreakdown` hides missing type | `app/(dashboard)/analytics.tsx` | Two stat cards ("Student Redemptions", "Employee Redemptions") always show 0 silently |
| P2-6 | Duplicate onboarding step files | `app/onboarding/step1-5.tsx` + named steps | Two parallel sets of step files; unclear which is canonical |
| P2-7 | Inconsistent support email | `app/onboarding/index.tsx` | `rez.in` vs `rez.money` — different domains used |
| P2-8 | `RBAC_INTEGRATION_EXAMPLES.tsx`, `ONBOARDING_INTEGRATION_EXAMPLE.tsx` in app root | Root directory | Example files should not be in root of an Expo app |
| P2-9 | `normalizeOrderStatus()` declared before imports | `app/(dashboard)/orders.tsx` line 1 | Unusual placement; could break in strict module environments |
| P2-10 | `coinDrops.ts`/`brandedCoins.ts` return full `ApiResponse` envelope | `services/api/coinDrops.ts` | Callers that expect `.data` would get the full envelope; no type safety catching this |
| P2-11 | `app/reports.tsx` is an orphan screen | `app/reports.tsx` | Not linked from any navigation; dead screen |
| P2-12 | `checkStoredToken` calls `refreshPermissions` before it is stable | `contexts/AuthContext.tsx` | Temporal dependency on `useCallback` memoization; fragile |

---

*End of Audit Report*
