# MASTER SCREEN MAP — REZ Platform

> Last updated: 2026-04-10
> Covers: Consumer App (nuqta-master), Merchant App (rez-merchant-master), Admin App (rez-admin-main)
> All file paths are relative to the app root.

---

## Table of Contents

1. [Consumer App (nuqta-master)](#1-consumer-app-nuqta-master)
2. [Merchant App (rez-merchant-master)](#2-merchant-app-rez-merchant-master)
3. [Admin App (rez-admin-main)](#3-admin-app-rez-admin-main)

---

## 1. Consumer App (nuqta-master)

**Root:** `/Users/rejaulkarim/Documents/ReZ Full App/rezapp/nuqta-master/`
**Framework:** Expo Router (React Native)
**Auth:** JWT stored in SecureStore

### Tab Navigation (Bottom Bar)

| Screen Name | File | Route | API Calls | Auth Required | Notes |
|-------------|------|-------|-----------|--------------|-------|
| Home | `app/(tabs)/index.tsx` | `/` | homepage, stores, offers | Optional | Main discovery feed |
| Categories | `app/(tabs)/categories.tsx` | `/categories` | `/api/categories` | Optional | Browse all categories |
| Earn | `app/(tabs)/earn.tsx` | `/earn` | `/api/gamification/stats`, `/api/gamification/streaks` | Yes | Earn hub (streaks, missions) |
| Play | `app/(tabs)/play.tsx` | `/play` | `/api/games/*` | Yes | Play-to-earn games |
| Finance | `app/(tabs)/finance.tsx` | `/finance` | `/api/wallet/balance`, `/finance/borrow/offers` | Yes | Wallet + financial services |

### Authentication Screens

| Screen Name | File | Route | API Calls | Auth Required | Status |
|-------------|------|-------|-----------|--------------|--------|
| Login / OTP | `app/_layout.tsx` (auth gating) | — | `/auth/otp/send`, `/auth/otp/verify` | None | Implemented |
| PIN Login | `app/_layout.tsx` | — | `/auth/login-pin`, `/auth/has-pin` | None | Implemented |
| Set PIN | `app/account/settings.tsx` | `/account/settings` | `/auth/set-pin` | Yes | Implemented |
| Account Recovery | `app/account-recovery.tsx` | `/account-recovery` | — | None | Needs verification |

### Account Screens

| Screen Name | File | Route | API Calls | Auth Required | Status |
|-------------|------|-------|-----------|--------------|--------|
| Account Index | `app/account/index.tsx` | `/account` | `/api/auth/me` | Yes | Implemented |
| Profile | `app/account/profile.tsx` | `/account/profile` | `/api/profile/*` | Yes | Implemented |
| Addresses | `app/account/addresses.tsx` | `/account/addresses` | `/api/addresses` | Yes | Implemented |
| Notifications | `app/account/notifications.tsx` | `/account/notifications` | `/api/user/notifications` | Yes | Implemented |
| Payment Methods | `app/account/payment-methods.tsx` | `/account/payment-methods` | `/api/payment-methods` | Yes | Implemented |
| Cashback | `app/account/cashback.tsx` | `/account/cashback` | `/api/cashback` | Yes | Implemented |
| Coupons | `app/account/coupons.tsx` | `/account/coupons` | `/api/coupons` | Yes | Implemented |
| Settings | `app/account/settings.tsx` | `/account/settings` | `/api/user/settings` | Yes | Implemented |
| Delete Account | `app/account/delete-account.tsx` | `/account/delete-account` | — | Yes | Implemented |
| Two-Factor Auth | `app/account/two-factor-auth.tsx` | `/account/two-factor-auth` | — | Yes | Status unclear |
| Email Notifications | `app/account/email-notifications.tsx` | `/account/email-notifications` | — | Yes | Implemented |
| Push Notifications | `app/account/push-notifications.tsx` | `/account/push-notifications` | — | Yes | Implemented |

### Store & Discovery Screens

| Screen Name | File | Route | API Calls | Auth Required | Status |
|-------------|------|-------|-----------|--------------|--------|
| Store Main Page | `app/MainStorePage.tsx` | Dynamic | `/api/stores/:id` | Optional | Core screen |
| Store List | `app/StoreListPage.tsx` | Dynamic | `/api/search/stores` | Optional | Implemented |
| Search | `app/search.tsx` | `/search` | `/api/search/*` (NO AUTH — BUG SEARCH-SEC-001) | None | Auth tokens missing |
| Category (slug) | `app/MainCategory/[slug]/index.tsx` | `/MainCategory/:slug` | `/api/categories/:slug/stores` | Optional | Implemented |
| Store | `app/Store.tsx` | Dynamic | `/api/stores/:id` | Optional | Implemented |
| Explore | Various | `/explore` | `/api/explore` | Optional | Implemented |

### Shopping / Cart / Orders

| Screen Name | File | Route | API Calls | Auth Required | Status |
|-------------|------|-------|-----------|--------------|--------|
| Cart | `app/cart.tsx` | `/cart` | `/api/cart/*` | Yes | Implemented |
| Order (in-store) | `app/order/[storeSlug]/index.tsx` | `/order/:storeSlug` | `/api/orders` | Yes | Implemented |
| Order Confirmation | `app/order/[storeSlug]/confirmation.tsx` | `/order/:storeSlug/confirmation` | `/api/orders/:id` | Yes | Implemented |
| Order History | `app/order-history.tsx` | `/order-history` | `/api/orders` | Yes | Implemented |
| Products | `app/products/index.tsx` | `/products` | `/api/products` | Optional | Implemented |
| Wishlist | `app/wishlist.tsx` | `/wishlist` | `/api/wishlist` | Yes | Implemented |

### Wallet & Finance Screens

| Screen Name | File | Route | API Calls | Auth Required | Status |
|-------------|------|-------|-----------|--------------|--------|
| REZ Cash (Wallet) | `app/rez-cash.tsx` | `/rez-cash` | `/api/wallet/balance`, `/api/wallet/transactions` | Yes | Implemented |
| Bill Payment | `app/bill-payment.tsx` | `/bill-payment` | `/finance/pay/bill` | Yes | Phase 1 stub (PENDING tx) |
| Recharge | `app/recharge.tsx` | `/recharge` | `/finance/pay/recharge` | Yes | Phase 1 stub (PENDING tx) |
| Bill History | `app/bill-history.tsx` | `/bill-history` | `/finance/pay/transactions` | Yes | Implemented |
| Bank Offers | `app/bank-offers/index.tsx` | `/bank-offers` | `/finance/borrow/offers` | Yes | Implemented |
| Bank Offer Detail | `app/bank-offers/[id].tsx` | `/bank-offers/:id` | `/finance/borrow/applications` | Yes | Implemented |
| Financial Services | `app/financial/[category].tsx` | `/financial/:category` | `/api/financial-services` | Yes | Implemented |
| Payment Methods | `app/payment-methods.tsx` | `/payment-methods` | `/api/payment-methods` | Yes | Implemented |
| Payments Refund | `app/payments/refund-initiated.tsx` | `/payments/refund-initiated` | — | Yes | Confirmation screen |

### Gamification & Rewards Screens

| Screen Name | File | Route | API Calls | Auth Required | Status |
|-------------|------|-------|-----------|--------------|--------|
| Gamification Hub | `app/gamification/index.tsx` | `/gamification` | `/api/gamification/*` | Yes | Implemented |
| Achievements | `app/achievements/index.tsx` | `/achievements` | `/api/achievements` | Yes | Implemented |
| Missions | `app/missions.tsx` | `/missions` | `/api/gamification/missions` | Yes | Implemented |
| Bonus Zone | `app/bonus-zone.tsx` | `/bonus-zone` | `/api/bonus-zone` | Yes | Implemented |
| Bonus Zone [slug] | `app/bonus-zone/[slug].tsx` | `/bonus-zone/:slug` | `/api/bonus-zone/:slug` | Yes | Implemented |
| Badges | `app/badges.tsx` | `/badges` | `/api/achievements/badges` | Yes | Implemented |
| Earn from Social | `app/earn-from-social-media.tsx` | `/earn-from-social-media` | `/api/social-media/earn` | Yes | Implemented |
| QR Check-in | `app/qr-checkin.tsx` | `/qr-checkin` | `/api/qr-checkin/*` | Yes | Implemented |
| Store Visit | `app/store-visit.tsx` | `/store-visit` | `/api/store-visits` | Yes | Implemented |

### Offers & Deals Screens

| Screen Name | File | Route | API Calls | Auth Required | Status |
|-------------|------|-------|-----------|--------------|--------|
| Offers Hub | `app/offers/index.tsx` | `/offers` | `/api/offers` | Optional | Implemented |
| Offer Detail | `app/offers/[id].tsx` | `/offers/:id` | `/api/offers/:id` | Optional | Implemented |
| Flash Sales | `app/flash-sales/[id].tsx` | `/flash-sales/:id` | `/api/flash-sales/:id` | Yes | Implemented |
| Cash Store | `app/cash-store/index.tsx` | `/cash-store` | `/api/cash-store` | Yes | Implemented |
| Offers Zones | `app/offers/zones/*.tsx` | `/offers/zones/*` | `/api/zones/*` | Partial | Various zone screens |

### Referral Screens

| Screen Name | File | Route | API Calls | Auth Required | Status |
|-------------|------|-------|-----------|--------------|--------|
| Referral Dashboard | `app/referral/dashboard.tsx` | `/referral/dashboard` | `/api/referral` | Yes | Implemented |
| Referral Share | `app/referral/share.tsx` | `/referral/share` | `/api/referral/share` | Yes | Implemented |

### Booking Screens

| Screen Name | File | Route | API Calls | Auth Required | Status |
|-------------|------|-------|-----------|--------------|--------|
| Bookings Page | `app/BookingsPage.tsx` | Dynamic | `/api/booking/history` | Yes | Implemented |
| Booking Main | `app/booking.tsx` | `/booking` | — | Yes | Implemented |
| Table Booking | `app/booking/table.tsx` | `/booking/table` | `/api/booking/table` | Yes | Implemented |
| Consultation | `app/booking/consultation.tsx` | `/booking/consultation` | `/api/booking/consultation` | Yes | Implemented |
| Reschedule | `app/booking/reschedule/[bookingId].tsx` | `/booking/reschedule/:id` | `/api/booking/:id/reschedule` | Yes | Implemented |

### Other Notable Screens

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Hotel | `app/hotel/[id].tsx` | `/hotel/:id` | Hotel OTA integration |
| Healthcare Hub | `app/healthcare/*.tsx` | `/healthcare/*` | Multiple health screens |
| Khata | `app/khata/index.tsx` | `/khata` | Consumer ledger |
| How REZ Works | `app/how-rez-works.tsx` | `/how-rez-works` | Onboarding explainer |
| Invite Friends | `app/invite-friends.tsx` | `/invite-friends` | Referral |
| Maintenance | `app/maintenance.tsx` | `/maintenance` | Maintenance mode |
| Update Required | `app/update-required.tsx` | `/update-required` | Force update |

---

## 2. Merchant App (rez-merchant-master)

**Root:** `/Users/rejaulkarim/Documents/ReZ Full App/rezmerchant/rez-merchant-master/`
**Framework:** Expo Router (React Native + Vercel web)
**Auth:** Merchant JWT

### Orders & KDS

| Screen Name | File | Route | API Calls | Auth Required | Status |
|-------------|------|-------|-----------|--------------|--------|
| KDS Settings | `app/kds/settings.tsx` | `/kds/settings` | `/api/merchant/kds/*` | Merchant | Implemented |
| All Table Bookings | `app/all-table-bookings.tsx` | `/all-table-bookings` | `/api/merchant/orders/table-bookings` | Merchant | Implemented |

### Products

| Screen Name | File | Route | API Calls | Auth Required | Status |
|-------------|------|-------|-----------|--------------|--------|
| Products List | `app/products/_layout.tsx` | `/products` | `/api/merchant/products` | Merchant | Implemented |
| Add Product | `app/products/add.tsx` | `/products/add` | `POST /api/merchant/products` | Merchant | Implemented |
| Edit Product | `app/products/edit/[id].tsx` | `/products/edit/:id` | `PUT /api/merchant/products/:id` | Merchant | Implemented |
| Product Detail | `app/products/[id].tsx` | `/products/:id` | `/api/merchant/products/:id` | Merchant | Implemented |
| Product Images | `app/products/[id]/images.tsx` | `/products/:id/images` | Product gallery API | Merchant | Implemented |
| Product Modifiers | `app/products/[id]/modifiers.tsx` | `/products/:id/modifiers` | — | Merchant | Implemented |
| Variants List | `app/products/variants/[productId].tsx` | `/products/variants/:id` | `/api/merchant/variants/:id` | Merchant | Implemented |
| Add Variant | `app/products/variants/add/[productId].tsx` | — | — | Merchant | Implemented |
| Edit Variant | `app/products/variants/edit/[variantId].tsx` | — | — | Merchant | Implemented |
| Inventory | `app/products/inventory.tsx` | `/products/inventory` | `/api/merchant/inventory` | Merchant | Implemented |
| Stock Alerts | `app/products/stock-alerts.tsx` | `/products/stock-alerts` | — | Merchant | Implemented |
| Bulk Upload | `app/products/bulk-upload.tsx` | `/products/bulk-upload` | `/api/merchant/bulk-import` | Merchant | Implemented |
| Import Products | `app/products/import.tsx` | `/products/import` | — | Merchant | Implemented |
| Combo Products | `app/products/combo.tsx` | `/products/combo` | — | Merchant | Implemented |

### Stores

| Screen Name | File | Route | Notes |
|-------------|------|-------|-------|
| Stores List | `app/stores/index.tsx` | `/stores` | Implemented |
| Add Store | `app/stores/add.tsx` | `/stores/add` | Implemented |
| Store Detail | `app/stores/[id].tsx` | `/stores/:id` | Implemented |
| Store Discounts | `app/stores/[id]/discounts.tsx` | `/stores/:id/discounts` | Implemented |
| Store Gallery | `app/stores/[id]/gallery.tsx` | `/stores/:id/gallery` | Implemented |
| Store Floor Plan | `app/stores/[id]/floor-plan.tsx` | `/stores/:id/floor-plan` | Implemented |
| Store Loyalty | `app/stores/[id]/loyalty-program.tsx` | `/stores/:id/loyalty-program` | Implemented |
| Table Bookings | `app/stores/[id]/table-bookings.tsx` | `/stores/:id/table-bookings` | Implemented |
| Store QR Code | `app/stores/[id]/qr-code.tsx` | `/stores/:id/qr-code` | Implemented |
| Store Vouchers | `app/stores/[id]/vouchers.tsx` | `/stores/:id/vouchers` | Implemented |
| Prive Campaigns | `app/stores/[id]/prive-campaigns/index.tsx` | `/stores/:id/prive-campaigns` | Implemented |

### Finance

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Reports | `app/reports.tsx` | `/reports` | Implemented |
| Expenses | `app/expenses/index.tsx` | `/expenses` | Implemented |
| Add Expense | `app/expenses/add.tsx` | `/expenses/add` | Implemented |
| Staff Shifts | `app/staff-shifts/index.tsx` | `/staff-shifts` | Implemented |
| Settlements | `app/settlements/[settlementId].tsx` | `/settlements/:id` | Implemented |
| Purchase Orders | `app/purchase-orders/index.tsx` | `/purchase-orders` | Implemented |
| Create PO | `app/purchase-orders/create.tsx` | — | Implemented |
| Suppliers | `app/suppliers/index.tsx` | `/suppliers` | Implemented |

### Customer & Marketing

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Customer Insights | `app/customers/insights.tsx` | `/customers/insights` | Implemented |
| Customer Segments | `app/customers/segments.tsx` | `/customers/segments` | Implemented |
| Customer Message | `app/customers/message.tsx` | `/customers/message` | Implemented |
| CRM (User Detail) | `app/crm/[userId].tsx` | `/crm/:userId` | Implemented |
| Customer Push | `app/customer-push.tsx` | `/customer-push` | Broadcast screen |
| Discounts | `app/discounts/index.tsx` | `/discounts` | Implemented |
| Discount Builder | `app/discounts/builder.tsx` | `/discounts/builder` | Implemented |
| Cashback Analytics | `app/(cashback)/analytics.tsx` | — | Implemented |
| Gift Cards | `app/gift-cards/index.tsx` | `/gift-cards` | Implemented |
| Stamp Cards | `app/stamp-cards/index.tsx` | `/stamp-cards` | Implemented |
| Messages | `app/messages/index.tsx` | `/messages` | Implemented |
| Messages Thread | `app/messages/[conversationId].tsx` | `/messages/:id` | Implemented |
| Goals | `app/goals/index.tsx` | `/goals` | Implemented |

### Operations

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Khata (Ledger) | `app/khata/index.tsx` | `/khata` | Implemented |
| Khata Add | `app/khata/add.tsx` | `/khata/add` | Implemented |
| Khata Customer | `app/khata/[customerId].tsx` | `/khata/:customerId` | Implemented |
| Catalog | `app/catalog/index.tsx` | `/catalog` | Implemented |
| Brand | `app/brand/index.tsx` | `/brand` | Implemented |
| Loyalty Punch Cards | `app/loyalty/punch-cards.tsx` | `/loyalty/punch-cards` | Implemented |
| QR Check-in | `app/qr-checkin.tsx` | `/qr-checkin` | Implemented |
| Social Impact | `app/social-impact/index.tsx` | `/social-impact` | Implemented |
| Support Tickets | `app/tickets/index.tsx` | `/tickets` | Implemented |
| Settings | `app/settings/business-hours.tsx` | `/settings/business-hours` | Implemented |
| Staff Settings | `app/settings/staff.tsx` | `/settings/staff` | Implemented |
| Printer Settings | `app/settings/printer.tsx` | `/settings/printer` | Implemented |

---

## 3. Admin App (rez-admin-main)

**Root:** `/Users/rejaulkarim/Documents/ReZ Full App/rezadmin/rez-admin-main/`
**Framework:** Expo Router
**Auth:** Admin JWT

### Auth

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Login | `app/(auth)/login.tsx` | `/login` | Implemented |
| Index (redirect) | `app/index.tsx` | `/` | Redirects to dashboard |

### Dashboard / Monitoring

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Live Monitor | `app/(dashboard)/live-monitor.tsx` | `/live-monitor` | Implemented |
| Unified Monitor | `app/(dashboard)/unified-monitor.tsx` | `/unified-monitor` | Implemented |
| Business Metrics | `app/(dashboard)/business-metrics.tsx` | `/business-metrics` | Implemented |
| SLA Monitor | `app/(dashboard)/sla-monitor.tsx` | `/sla-monitor` | Implemented |
| API Latency | `app/(dashboard)/api-latency.tsx` | `/api-latency` | Implemented |
| Job Monitor | `app/(dashboard)/job-monitor.tsx` | `/job-monitor` | BullMQ job dashboard |
| Aggregator Monitor | `app/(dashboard)/aggregator-monitor.tsx` | `/aggregator-monitor` | Implemented |

### User Management

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Users | — (via business-metrics) | `/users` | Implemented |
| User Detail | `app/(dashboard)/users/[id].tsx` | `/users/:id` | Implemented |
| Verifications | `app/(dashboard)/verifications.tsx` | `/verifications` | Implemented |

### Merchant Management

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Merchant Flags | `app/(dashboard)/merchant-flags/[merchantId].tsx` | `/merchant-flags/:merchantId` | Implemented |
| Pending Approvals | `app/(dashboard)/pending-approvals.tsx` | `/pending-approvals` | Implemented |
| Trial Approvals | `app/(dashboard)/trial-approvals.tsx` | `/trial-approvals` | Implemented |

### Financial Controls

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Wallet | `app/(dashboard)/wallet.tsx` | `/wallet` | Implemented |
| Wallet Adjustment | `app/(dashboard)/wallet-adjustment.tsx` | `/wallet-adjustment` | Implemented |
| Coin Governor | `app/(dashboard)/coin-governor.tsx` | `/coin-governor` | Implemented |
| Coin Rewards | `app/(dashboard)/coin-rewards.tsx` | `/coin-rewards` | Implemented |
| Coin Gifts | `app/(dashboard)/coin-gifts.tsx` | `/coin-gifts` | Implemented |
| Surprise Coin Drops | `app/(dashboard)/surprise-coin-drops.tsx` | `/surprise-coin-drops` | Implemented |
| Economics | `app/(dashboard)/economics.tsx` | `/economics` | Implemented |
| Cashback Rules | `app/(dashboard)/cashback-rules.tsx` | `/cashback-rules` | Implemented |
| Disputes | `app/(dashboard)/disputes.tsx` | `/disputes` | Implemented |

### Marketing / Campaigns

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Campaigns | `app/(dashboard)/campaigns.tsx` | `/campaigns` | Implemented |
| Campaign Management | `app/(dashboard)/campaign-management.tsx` | `/campaign-management` | Implemented |
| Marketing Analytics | `app/(dashboard)/marketing-analytics.tsx` | `/marketing-analytics` | Implemented |
| Offers | `app/(dashboard)/offers.tsx` | `/offers` | Implemented |
| Offers Sections | `app/(dashboard)/offers-sections.tsx` | `/offers-sections` | Implemented |
| Flash Sales | `app/(dashboard)/flash-sales.tsx` | `/flash-sales` | Implemented |
| Bank Offers | `app/(dashboard)/bank-offers.tsx` | `/bank-offers` | Implemented |
| Broadcast | `app/(dashboard)/broadcast.tsx` | `/broadcast` | Implemented |

### Gamification

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Achievements | `app/(dashboard)/achievements.tsx` | `/achievements` | Implemented |
| Challenges | `app/(dashboard)/challenges.tsx` | `/challenges` | Implemented |
| Tournaments | `app/(dashboard)/tournaments.tsx` | `/tournaments` | Implemented |
| Leaderboard Config | `app/(dashboard)/leaderboard-config.tsx` | `/leaderboard-config` | Implemented |
| Game Config | `app/(dashboard)/game-config.tsx` (not listed but likely) | — | — |

### System / Config

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Feature Flags | `app/(dashboard)/feature-flags.tsx` | `/feature-flags` | Implemented |
| Platform Config | `app/(dashboard)/platform-config.tsx` | `/platform-config` | Implemented |
| Platform Control Center | `app/(dashboard)/platform-control-center.tsx` | `/platform-control-center` | Implemented |
| BBPS Config | `app/(dashboard)/bbps-config.tsx` | `/bbps-config` | Implemented |
| BBPS Health | `app/(dashboard)/bbps-health.tsx` | `/bbps-health` | Implemented |
| BBPS Transactions | `app/(dashboard)/bbps-transactions.tsx` | `/bbps-transactions` | Implemented |
| Engagement Config | `app/(dashboard)/engagement-config.tsx` | `/engagement-config` | Implemented |
| Settings | `app/(dashboard)/settings.tsx` | `/settings` | Implemented |
| Admin Settings | `app/(dashboard)/admin-settings.tsx` | `/admin-settings` | Implemented |
| A/B Test Manager | `app/(dashboard)/ab-test-manager.tsx` | `/ab-test-manager` | Implemented |

### Fraud / Security

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Fraud Alerts | `app/(dashboard)/fraud-alerts.tsx` | `/fraud-alerts` | Implemented |
| Fraud Config | `app/(dashboard)/fraud-config.tsx` | `/fraud-config` | Implemented |
| Fraud Queue | `app/(dashboard)/fraud-queue.tsx` | `/fraud-queue` | Implemented |
| Fraud Reports | `app/(dashboard)/fraud-reports.tsx` | `/fraud-reports` | Implemented |
| Device Security | `app/(dashboard)/device-security.tsx` | `/device-security` | Implemented |
| Alert Rules | `app/(dashboard)/alert-rules.tsx` | `/alert-rules` | Implemented |
| Audit Log | `app/(dashboard)/audit-log.tsx` | `/audit-log` | Implemented |

### Moderation

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Review Moderation | `app/(dashboard)/review-moderation.tsx` | `/review-moderation` | Implemented |
| Photo Moderation | `app/(dashboard)/photo-moderation.tsx` | `/photo-moderation` | Implemented |
| Comments Moderation | `app/(dashboard)/comments-moderation.tsx` | `/comments-moderation` | Implemented |

### Content

| Screen Name | File | Route | Status |
|-------------|------|-------|--------|
| Events | `app/(dashboard)/events.tsx` | `/events` | Implemented |
| Experiences | `app/(dashboard)/experiences.tsx` | `/experiences` | Implemented |
| Creators | `app/(dashboard)/creators.tsx` | `/creators` | Implemented |
| Explore | `app/(dashboard)/explore.tsx` | `/explore` | Implemented |
| Mall | `app/(dashboard)/mall.tsx` | `/mall` | Implemented |
| Categories | `app/(dashboard)/categories.tsx` | `/categories` | Implemented |
| Polls | `app/(dashboard)/polls.tsx` | `/polls` | Implemented |
| Reactions | `app/(dashboard)/reactions.tsx` | `/reactions` | Implemented |
| Ads | `app/(dashboard)/ads.tsx` | `/ads` | Implemented |
