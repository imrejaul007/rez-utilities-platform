# REZ Backend (rez-backend-master) — Service Documentation

**Base URL (production):** `https://api.rezapp.com/api`
**Port (local):** `5001` (default)
**Entry point:** `src/server.ts` → `ts-node src/server.ts`
**Package name:** `user-backend`

---

## 1. Purpose

`rez-backend-master` is the REZ platform monolith. It serves every consumer-facing API surface, the internal admin panel, and acts as an integration point for external services (AdBazaar, OTA partners, Razorpay/Stripe webhooks, BBPS aggregators).

### What remains in the monolith

- All consumer app routes (`/api/user`, `/api/wallet`, `/api/orders`, `/api/prive`, etc.)
- Web QR ordering (`/api/web-ordering`) — the DotPe competitor
- Table sessions, service appointments, travel, gold savings, financial services
- Admin routes (`/api/admin/*`) — full backoffice panel
- BullMQ worker process and cron job orchestration
- Webhook ingestion (Razorpay, Stripe, AdBazaar, BBPS aggregators)
- AdBazaar integration service (`/api/adbazaar`)

### What has been extracted to microservices

Approximately 70 merchant route files are fully commented out in `src/config/routes.ts`. Those routes now live in **rez-merchant-service** and are proxied by nginx. The monolith still carries the dead code for rollback safety.

| Domain | Status | Destination |
|--------|--------|-------------|
| `/api/merchant/auth` | Migrated | rez-merchant-service |
| `/api/merchant/products` | Migrated | rez-merchant-service |
| `/api/merchant/categories` | Migrated | rez-merchant-service |
| `/api/merchant/dashboard` | Migrated | rez-merchant-service |
| `/api/merchant/analytics` | Migrated | rez-merchant-service |
| `/api/merchant/orders` | Migrated | rez-merchant-service |
| `/api/merchant/wallet` | Migrated | rez-merchant-service |
| `/api/merchant/offers` | Migrated | rez-merchant-service |
| `/api/merchant/stores` | Migrated | rez-merchant-service |
| `/api/merchant/team` | Migrated | rez-merchant-service |
| `/api/merchant/payouts` | Migrated | rez-merchant-service |
| `/api/merchant/pos` | Migrated | rez-merchant-service |
| `/api/merchant/loyalty-tiers` | Migrated | rez-merchant-service |
| `/api/merchant/broadcasts` | Migrated | rez-merchant-service |
| `/api/merchant/disputes` | Migrated | rez-merchant-service |
| *(~55 more merchant routes)* | Migrated | rez-merchant-service |
| `/api/merchant/qr/*` | **Active** | Monolith (nginx routes explicitly) |
| `/api/merchant/invoices` | **Active** | Monolith (nginx routes explicitly) |
| `/api/merchants` (plural) | **Active** | Monolith (nginx catch-all) |

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20.x, TypeScript 5.x |
| Framework | Express 5.x |
| Database | MongoDB (Mongoose 8.x, Atlas) |
| Cache / Pub-Sub | Redis (ioredis 5.x, Valkey-compatible) |
| Job Queue | BullMQ 5.x |
| Job Dashboard | BullBoard (@bull-board/express) |
| Payments (general) | Razorpay 2.x (INR only) |
| Payments (travel) | Stripe 19.x (INR, AED, USD, EUR, GBP, CAD, AUD) |
| SMS / OTP | MSG91 via Twilio 5.x |
| Email | SendGrid 8.x |
| Push Notifications | Expo SDK (expo-server-sdk) |
| File Uploads | Cloudinary + multer |
| Monitoring | Sentry, Prometheus (prom-client), Winston + DailyRotateFile |
| Realtime | Socket.IO 4.x with Redis adapter |
| Validation | Joi, Zod, express-validator |
| PDF generation | pdfkit |
| QR codes | qrcode, bwip-js |

---

## 3. Architecture

### Strangler Fig Pattern

The monolith is being unwound via the strangler fig pattern. nginx acts as the routing layer:

```
                            ┌─────────────────────────┐
Client ──► nginx ──────────►│ /api/merchant/* (most)  │──► rez-merchant-service
                │           └─────────────────────────┘
                │           ┌─────────────────────────┐
                └──────────►│ /api/* (everything else) │──► monolith (this service)
                │           └─────────────────────────┘
                │           ┌─────────────────────────┐
                └──────────►│ /api/merchant/qr/*      │──► monolith (explicit rule)
                            │ /api/merchant/invoices   │
                            └─────────────────────────┘
```

### Process Model

The service supports two distinct process roles via the `PROCESS_ROLE` environment variable:

**API process** (`PROCESS_ROLE=api` or unset):
- Binds HTTP port and serves all Express routes
- Starts critical BullMQ workers inline (unless `WORKER_ROLE=noncritical`)
- Does NOT run cron jobs unless `ENABLE_CRON=true`

**Worker process** (`PROCESS_ROLE=worker`):
- Does NOT bind an HTTP port
- Starts all BullMQ workers and cron jobs
- Requires `ENABLE_CRON=true` to activate cron schedules
- Started via `npm run start:worker`

### Startup Sequence (API process)

1. Load `.env` (synchronous require before any imports)
2. Default `NODE_ENV` to `production` if unset (security default)
3. Bind HTTP port immediately (prevents Render deployment timeouts)
4. Validate environment variables (`validateEnv()` exits in production on missing required vars)
5. Connect MongoDB
6. Seed feature flags and system config
7. Connect Redis
8. Warm public caches (non-blocking, background)
9. Start queue metrics sampler (30s interval)
10. Attach Socket.IO Redis adapter
11. Start critical BullMQ workers
12. Register all routes via `registerRoutes(app)`
13. Initialize cron jobs (only if `ENABLE_CRON=true`)

---

## 4. Active Route Verticals

All routes are mounted at `/api` (configurable via `API_PREFIX`). A versioned alias at `/api/v1` mirrors all user routes. Rate limit tiers are noted where relevant.

### 4.1 Authentication

Base: `/api/user/auth`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/send-otp` | Send OTP via SMS (strict rate limit: 10/min) |
| POST | `/verify-otp` | Verify OTP, issue access + refresh token |
| POST | `/refresh` | Exchange refresh token for new access token |
| POST | `/logout` | Blacklist current token (Redis) |
| POST | `/logout-all` | Invalidate all tokens for user (Redis timestamp) |
| POST | `/pin/set` | Set/change PIN |
| POST | `/pin/verify` | Authenticate via PIN (browser surfaces) |
| GET | `/me` | Get authenticated user profile |

Token delivery: `Authorization: Bearer <token>` or `rez_access_token` httpOnly cookie (dual-mode).

### 4.2 User & Profile

| Base | Key Endpoints |
|------|--------------|
| `/api/user/profile` | GET/PATCH profile, upload avatar |
| `/api/user/settings` | Notification prefs, language, theme |
| `/api/user/account` | Delete account, export data |
| `/api/user/boot` | Single-call boot payload for app startup |
| `/api/user/rez-score` | User's REZ score and breakdown |
| `/api/user/profile-completion` | Profile completion percentage |
| `/api/user/verifications` | KYC document submission |
| `/api/user/activity-feed` | Friend activity + own activity feed |
| `/api/user/notifications` | Paginated notification list + mark-read |
| `/api/user/transactions` | Transaction history with pagination |
| `/api/user/subscription` | Active subscription details |
| `/api/addresses` | Saved delivery addresses |
| `/api/payment-methods` | Saved cards and payment instruments |
| `/api/user-settings` | Extended user settings |

### 4.3 Products, Categories & Search

| Base | Key Endpoints |
|------|--------------|
| `/api/products` | List, search, filter, detail |
| `/api/categories` | Tree + flat listing |
| `/api/search` | Global search (stores, products, offers, articles) |
| `/api/reviews` | Product/store reviews |
| `/api/comparisons` | Product comparison |
| `/api/product-comparisons` | Side-by-side product specs |
| `/api/price-tracking` | Track price drops on products |
| `/api/stock-notifications` | Back-in-stock alerts |
| `/api/wishlist` | User wishlist |
| `/api/recommendations` | Personalised product/store recs |
| `/api/explore` | Discovery feed |

### 4.4 Stores & Shopping

| Base | Key Endpoints |
|------|--------------|
| `/api/stores` | List, search, filter, detail |
| `/api/stores/feed` | Store discovery feed (high-traffic, 100 req/min) |
| `/api/stores/:storeId/reviews` | Store-specific reviews |
| `/api/stores` (storeShoppingRoutes) | `/stores/:id/combos`, `/stores/:id/loyalty-program`, `/user/store-gift-cards` |
| `/api/cart` | Cart CRUD, quantity updates |
| `/api/orders` | Order lifecycle, history, cancellation |
| `/api/stock` | Real-time stock levels (Socket.IO-backed) |
| `/api/outlets` | Store outlet listing |
| `/api/store-visits` | Check-in at a store |
| `/api/store-vouchers` | Store-specific vouchers |
| `/api/flash-sales` | Flash sale listings |
| `/api/discounts` | Discount codes |
| `/api/coupons` | Coupon redemption |
| `/api/payment` | General payment intent creation |
| `/api/store-payment` | Store-specific payment flow |
| `/api/razorpay` | Razorpay order creation + webhook receipt |

### 4.5 Web QR Ordering (No-App Flow)

Base: `/api/web-ordering`

This is the REZ answer to DotPe/Swiggy Dineout web ordering. No app install required.

**Flow:** Customer scans store QR → browser opens menu → selects items → enters phone → OTP verify → Razorpay → order placed

| Method | Path | Description | Rate Limit |
|--------|------|-------------|-----------|
| GET | `/menu/:storeSlug` | Fetch store menu for web display | 120/min |
| POST | `/send-otp` | Send OTP to phone for guest auth | 5/min |
| POST | `/verify-otp` | Verify OTP, return session JWT | 5/min |
| POST | `/order` | Place order (idempotency key required) | 10/min |
| POST | `/payment/create` | Create Razorpay order for web order | 10/min |
| POST | `/payment/verify` | Verify Razorpay signature | 10/min |
| GET | `/order/:orderNumber` | Poll order status | 120/min |

All mutation requests require `X-Requested-With: XMLHttpRequest` header (CSRF guard). OTPs are bcrypt-hashed before storage in Redis (or in-memory fallback).

### 4.6 Table Sessions (Dine-In Multi-Party Ordering)

Base: `/api/table-sessions`

Manages the full lifecycle of a dine-in table session where multiple guests can add to a shared order.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/open` | Required | Open new table session or join existing via table token |
| GET | `/:sessionToken` | Public | Get session details and current order state |
| POST | `/:sessionToken/add-order` | Required | Add items to shared session order |
| POST | `/:sessionToken/request-bill` | Required | Request bill consolidation |
| POST | `/:sessionToken/pay` | Required | Pay the session bill (triggers Razorpay) |

Session state is `sessionToken`-based. Multiple authenticated users can join the same session.

### 4.7 Service Appointments (Salon, Spa, Clinics)

Base: `/api/service-appointments`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Book appointment (storeId, serviceType, date HH:MM, duration, customer details) |
| GET | `/user` | User's appointment history, filterable by status |
| GET | `/:appointmentId` | Single appointment detail |
| GET | `/store/:storeId` | Store's appointment list (merchant-facing) |
| POST | `/:appointmentId/cancel` | Cancel appointment |
| GET | `/:storeId/availability` | Check staff/slot availability |
| GET | `/:storeId/slots` | Available time slots |
| PATCH | `/:appointmentId/status` | Update status (pending/confirmed/in_progress/completed/no_show) |
| POST | `/:appointmentId/no-show` | Mark as no-show |
| POST | `/:appointmentId/treatment-notes` | Add treatment notes |
| PUT | `/:appointmentId` | Update appointment details |

Related admin route: `/api/admin/service-appointments`
Related cron: `appointmentReminderJob` (see Section 5)

### 4.8 Travel Services

Base: `/api/travel-services` and `/api/travel-payment`

**Travel Services (catalog/listing):**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/categories` | Travel categories for homepage (cached 5min) |
| GET | `/featured` | Featured travel services (cached 3min) |
| GET | `/popular` | Popular travel services (cached 3min) |
| GET | `/stats` | Travel stats (cached 5min) |
| GET | `/category/:slug` | Services by category |

**Travel Payment (dual gateway):**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/travel-payment/gateways` | Available gateways for currency |
| POST | `/travel-payment/create-order` | Razorpay order (INR only) |
| POST | `/travel-payment/verify` | Verify Razorpay signature |
| POST | `/travel-payment/create-checkout-session` | Stripe checkout session (all currencies) |
| POST | `/travel-payment/verify-stripe-session` | Verify Stripe session completion |

Stripe supports: INR, AED, USD, EUR, GBP, CAD, AUD.
Razorpay supports: INR only.

Travel webhooks from Stripe are handled at `/api/travel-webhooks`.

### 4.9 Gold Savings

Base: `/api/gold` and `/api/wallet/gold-sip`

**Gold Savings (spot buy/sell):**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/gold/price` | Public | Live gold price in INR/gram |
| GET | `/gold/holding` | Required | User's gold holding |
| GET | `/gold/transactions` | Required | Gold transaction history |
| POST | `/gold/buy` | Required | Buy gold (INR amount, idempotencyKey required, 10/min limit) |
| POST | `/gold/sell` | Required | Sell gold (grams, idempotencyKey required, 10/min limit) |

**Gold SIP (systematic investment plan):**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/wallet/gold-sip` | Required | Active SIP, holdings, history |
| POST | `/wallet/gold-sip` | Required | Create monthly SIP |
| DELETE | `/wallet/gold-sip` | Required | Cancel active SIP |

Gold price is refreshed every 15 minutes via cron (distributed lock) from an external provider.

### 4.10 Wallet & Coins

| Base | Key Endpoints |
|------|--------------|
| `/api/wallet` | Balance (REZ/Privé/Branded/Promo coins), coin types |
| `/api/wallet/transfer` | Peer-to-peer coin transfer |
| `/api/wallet/gift` | Send coin gift to another user |
| `/api/wallet/gift-cards` | Gift card purchase/redemption |
| `/api/wallet/split` | Bill split between friends |
| `/api/cashback` | Cashback history, pending credits |
| `/api/wallet/gold-sip` | Gold SIP management |
| `/api/wallets/external` | Link external wallets |
| `/api/earn` | Nearby stores with earning opportunities (feature-flagged) |
| `/api/earnings` | Partner/creator earnings summary |

Coin types: `rez` (never expire), `prive` (12-month), `branded` (merchant, 6-month), `promo` (campaign-based).

### 4.11 Persona & Home Intelligence

| Base | Key Endpoints |
|------|--------------|
| `/api/persona/me` | Resolve current user's full persona snapshot |
| `/api/persona/feed-config` | Feed configuration slice (lighter) |
| `/api/persona/anchor-locations` | Update anchor locations (college/office/home) |
| `/api/homepage` | Homepage sections (personaHomepageRoutes also mounts here for persona-specific sections: campus-trending, lunch-deals, etc.) |
| `/api/home/snapshot` | Single aggregated home screen payload (wallet balance, streak, offers, featured stores, missions, categories, campaigns, trial offers) — cached 30s per user |
| `/api/home` (liveContextRoutes) | Live context overlays (time-of-day, weather, location) |

### 4.12 Privé (Elite Loyalty Program)

Base: `/api/prive`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/program-config/public` | Public program tier config |
| GET | `/tier-comparison` | Side-by-side tier benefit comparison |
| GET | `/next-actions` | Personalised next best actions |
| GET | `/missions` | All available missions |
| GET | `/missions/active` | User's active missions |
| GET | `/missions/completed` | Completed missions |
| POST | `/missions/:id/claim` | Claim mission reward |
| POST | `/missions/:id/complete` | Mark mission complete |
| POST | `/concierge/tickets` | Create concierge support ticket |
| GET | `/concierge/tickets` | List concierge tickets |
| GET | `/concierge/tickets/:id` | Ticket detail |
| POST | `/concierge/tickets/:id/message` | Add message to ticket |
| GET | `/eligibility` | Privé eligibility status |
| GET | `/pillars` | Pillar breakdown (spend, engagement, social, network) |
| POST | `/refresh` | Force recalculate reputation score |
| GET | `/history` | Reputation score history |
| GET | `/tips` | Personalised tips to improve eligibility |
| POST | `/check-in` | Daily check-in with streak tracking |
| GET | `/habit-loops` | Daily habit loops with progress |
| GET | `/dashboard` | Full Privé dashboard |
| GET | `/offers` | Privé exclusive offers |
| GET | `/offers/:id` | Single Privé offer |
| GET | `/highlights` | Program highlights |
| POST | `/offers/:id/track` | Track offer click |
| GET | `/earnings` | Privé earnings |
| GET | `/transactions` | Privé transaction history |
| POST | `/redeem` | Redeem coins (requires re-auth) |
| GET | `/vouchers` | Privé vouchers |
| GET | `/vouchers/:id` | Single voucher |
| POST | `/vouchers/:id/use` | Mark voucher as used |
| GET | `/redeem-config` | Redemption configuration |
| GET | `/catalog` | Privé rewards catalog |
| GET | `/smart-spend` | Smart spend catalog |
| GET | `/reviews` | Privé review dashboard |
| GET | `/analytics` | Privé analytics |
| GET | `/notifications/preferences` | Notification preferences |

All Privé routes require authentication. Individual features are gated by `featureFlags` in WalletConfig (fail-open on config error).

### 4.13 Gamification

| Base | Key Endpoints |
|------|--------------|
| `/api/gamification` | Unified gamification state |
| `/api/gamification/daily-checkin` | Check-in + streak status |
| `/api/gamification/streak/use-shield` | Consume a streak shield |
| `/api/gamification/streak/status` | Current streak and shield count |
| `/api/users/visit-streak` | Visit streak tracking |
| `/api/games` | Mini-games listing |
| `/api/leaderboard` | Rankings by category/period |
| `/api/streak` | General streak management |
| `/api/polls` | User polls |
| `/api/tournaments` | Tournaments listing and entry |
| `/api/scratch-cards` | Scratch card rewards |
| `/api/bonus-zone` | Location-based bonus zones |
| `/api/play-earn` | Play-to-earn games |
| `/api/achievements` | Earned achievements |
| `/api/lock-deals` | Time-locked deals |
| `/api/group-buy` | Group buy campaigns |
| `/api/qr-checkin` | Zero-friction QR check-in |

### 4.14 Social & Content

| Base | Key Endpoints |
|------|--------------|
| `/api/videos` | Short video feed |
| `/api/ugc` | User-generated content |
| `/api/articles` | Editorial articles |
| `/api/creators` | Creator profiles |
| `/api/social` | Activity feed (follows, likes, comments) |
| `/api/social-proof` | Social proof signals (who bought this) |
| `/api/social-media` | Social media link management |
| `/api/shares` | Deep link share generation |
| `/api/photos` | Photo uploads |
| `/api/polls` | Poll voting |
| `/api/projects` | Creator projects |
| `/api/earning-projects` | Earning-linked projects |
| `/api/events` | Platform events |
| `/api/experiences` | Curated experiences |
| `/api/content` | CMS content blocks |
| `/api/learning` | Learning modules |

### 4.15 Financial Services

| Base | Key Endpoints |
|------|--------------|
| `/api/financial-services` | BBPS / bill payment services |
| `/api/bill-payments` | Bill payment execution |
| `/api/bills` | Bill upload (Cloudinary, OCR pending) |
| `/api/billing` | Billing history |
| `/api/recharge` | Mobile/DTH recharge |
| `/api/insurance` | Insurance products listing |
| `/api/health-records` | User health record vault |
| `/api/consultations` | Book doctor/specialist consultation |
| `/api/fitness` | Fitness tracking |
| `/api/home-services` | Home services catalog (plumbing, etc.) |
| `/api/consumer/khata` | Consumer credit ledger |

### 4.16 REZ TRY (Trial / Product Sampling)

| Base | Key Endpoints |
|------|--------------|
| `/api/try` | Consumer trial listings + booking |
| `/api/try/:slug` | Trial detail |
| `/api/try/:id/book` | Book a trial |

Admin routes at `/api/admin/trials`.

### 4.17 Offers, Vouchers & Campaigns

| Base | Key Endpoints |
|------|--------------|
| `/api/offers` | Geo-filtered offers (bulkLimiter: 100 req/min) |
| `/api/offers/:id/comments` | Offer comments |
| `/api/offer-categories` | Offer taxonomy |
| `/api/vouchers` | User voucher wallet |
| `/api/cashback` | Cashback status and history |
| `/api/campaigns` | Active campaigns |
| `/api/hero-banners` | Homepage hero banners |
| `/api/whats-new` | What's new section |
| `/api/prive/campaigns` | Privé campaigns |
| `/api/surveys` | Surveys (earn coins for completing) |
| `/api/programs` | Loyalty programs |
| `/api/special-programs` | Special programs (campus, corporate) |

### 4.18 Mall & Affiliate Commerce

| Base | Key Endpoints |
|------|--------------|
| `/api/mall` | Mall store listing |
| `/api/mall/affiliate` | Mall affiliate program |
| `/api/cashstore` | Cash-back store catalog |
| `/api/cashstore/affiliate` | Cashstore affiliate |
| `/api/partner` | Partner program |
| `/api/institute-referrals` | College/institution referral program |

### 4.19 Discovery & Location

| Base | Key Endpoints |
|------|--------------|
| `/api/location` | User location management |
| `/api/zones` | Zone verification for offers |
| `/api/stats` | Platform-wide stats |
| `/api/platform` | Platform metadata |
| `/api/nearby` (via earnRoutes) | Nearby stores with earning opportunities |
| `/api/store-visits` | Visit history |

### 4.20 Messaging & Support

| Base | Key Endpoints |
|------|--------------|
| `/api/support` | Support ticket creation |
| `/api/faqs` | FAQ listing |
| `/api/messages` | In-app messaging |
| `/api/disputes` | Order/transaction disputes |
| `/api/notifications` | System notifications |
| `/api/whatsapp` | WhatsApp webhook ingestion |

### 4.21 Integrations & Webhooks

| Base | Description |
|------|-------------|
| `/api/webhooks` | Razorpay payment webhooks (HMAC-SHA256 validated) + AdBazaar webhooks |
| `/api/webhook` | BBPS aggregator webhooks |
| `/api/travel-webhooks` | Stripe webhook events for travel |
| `/api/integrations` | Integration webhook ingestion (HMAC secured) |
| `/api/adbazaar` | Internal: coin credit on AdBazaar QR scan (x-internal-key) |
| `/api/partner/adbazaar` | Partner API (HMAC-SHA256 via X-AdBazaar-Signature) |

### 4.22 Merchant Routes (Still in Monolith)

These three are still served by the monolith because nginx routes them explicitly:

| Route | Description |
|-------|-------------|
| `/api/merchants` | Legacy merchant lookup (plural, no trailing slash) |
| `/api/merchant/qr/*` | Merchant QR generation (also handles `/marketing/templates`) |
| `/api/merchant/invoices` | Invoice generation and download |

### 4.23 Admin Routes

All admin routes require `authenticate` + `requireAdmin` middleware. `/api/admin/auth` is the only exception (login flow). Admin traffic is rate-limited at 60 req/IP/min and all requests are audit-logged.

**Admin route groups (prefix: `/api/admin`):**

| Sub-path | Description |
|----------|-------------|
| `/auth` | Admin login, 2FA, refresh |
| `/dashboard` | Platform overview stats |
| `/users` | User management, search, ban |
| `/merchants` | Merchant management |
| `/orders` | Order management |
| `/wallet` | Wallet admin, manual adjustments |
| `/user-wallets` | Per-user wallet inspection |
| `/coin-rewards` | Coin reward configuration |
| `/merchant-wallets` | Merchant wallet overview |
| `/campaigns` | Campaign CRUD |
| `/offers` | Offer CRUD and moderation |
| `/offers-sections` | Offers page section config |
| `/store-collections` | Store collection curation |
| `/vouchers` | Voucher management |
| `/coupons` | Coupon management |
| `/categories` | Category management |
| `/stores` | Store moderation |
| `/reviews` | Review moderation |
| `/travel` | Travel booking admin |
| `/gold` | Live gold price admin |
| `/system` | System configuration |
| `/feature-flags` | Feature flag management |
| `/ab-tests` | A/B test configuration |
| `/analytics` | Platform analytics |
| `/bbps` | BBPS integration health |
| `/challenges` | Gamification challenges |
| `/game-config` | Mini-game configuration |
| `/tournaments` | Tournament management |
| `/achievements` | Achievement configuration |
| `/gamification-stats` | Gamification metrics |
| `/daily-checkin-config` | Daily check-in settings |
| `/leaderboard/configs` | Leaderboard configuration |
| `/events` | Platform event management |
| `/event-categories` | Event category management |
| `/event-rewards` | Event reward configuration |
| `/learning-content` | Learning content management |
| `/special-programs` | Special program management |
| `/loyalty` | Loyalty program admin |
| `/loyalty-milestones` | Loyalty milestone config |
| `/double-campaigns` | Double coin campaigns |
| `/coin-drops` | Coin drop campaigns |
| `/gift-cards` | Gift card management |
| `/coin-gifts` | Coin gift management |
| `/surprise-coin-drops` | Surprise drop campaigns |
| `/flash-sales` | Flash sale management |
| `/bonus-zone` | Bonus zone management |
| `/hotspot-areas` | Hotspot area management |
| `/exclusive-zones` | Exclusive zone management |
| `/bank-offers` | Bank-linked offer management |
| `/upload-bill-stores` | Bill upload store eligibility |
| `/referrals` | Referral program admin |
| `/institute-referrals` | Institution referral admin |
| `/institutions` | Institution management |
| `/prive` | Privé program admin |
| `/quick-actions` | Quick action cards |
| `/value-cards` | Value card management |
| `/wallet-config` | Wallet feature flags and limits |
| `/reward-config` | Reward configuration |
| `/partner-earnings` | Partner earnings reconciliation |
| `/experiences` | Experience curation |
| `/homepage-deals` | Homepage deal management |
| `/zone-verifications` | Zone verification management |
| `/explore` | Explore section curation |
| `/creators` | Creator management |
| `/moderation` | Content moderation queue |
| `/fraud-reports` | Fraud report management |
| `/fraud-config` | Fraud detection configuration |
| `/membership` | Membership tier management |
| `/admin-users` | Admin user management (super-admin only) |
| `/merchant-liability` | Merchant liability dashboard |
| `/mall/brands` | Mall brand management |
| `/cashstore/purchases` | Cash store purchase admin |
| `/service-appointments` | Appointment management |
| `/admin-actions` | Manual admin action audit |
| `/disputes` | Dispute resolution |
| `/devices` | Device fingerprint management |
| `/integrations` | Integration management |
| `/payroll` | Payroll admin |
| `/health-deep` | Deep health check (DB, Redis, queues) |
| `/support` | Support ticket management |
| `/support-config` | Support configuration |
| `/support/faq` | FAQ management |
| `/notifications` | Notification management |
| `/delivery-config` | Delivery configuration |
| `/settings` | Platform settings |
| `/ads` | Ad management |
| `/ad-campaigns` | Ad campaign management |
| `/marketing/analytics` | Marketing analytics |
| `/ota` | OTA (hotel) integration admin |
| `/orchestrator` | Orchestrator routes |
| `/engagement-config` | Engagement feature configuration |
| `/trials` | Trial management |
| `/merchant-campaign-rules` | Merchant campaign rules |
| `/dlq` | Dead-letter queue management API |

**BullBoard queue dashboard:** `/admin/queues` (note: `/admin` not `/api/admin`)

---

## 5. Background Jobs

### 5.1 BullMQ Queues

Workers are classified as critical or noncritical. Critical workers run in the API process by default; both groups run in the dedicated worker process.

**Critical Queues (financial, state-changing):**

| Queue | Purpose |
|-------|---------|
| `payments` | Payment processing, capture, refund |
| `payment-events` | Strangler fig payment event bus |
| `rewards` | Coin grants, reward fulfillment |
| `merchant-events` | Merchant-facing state changes |
| `gamification-events` | XP, badge, streak updates |
| `order-events` | Order status transitions |
| `wallet-events` | Wallet debit/credit operations |

**Noncritical Queues (analytics, comms):**

| Queue | Purpose |
|-------|---------|
| `analytics` | Behavioral analytics events |
| `analytics-events` | Analytics event bus |
| `notifications` | Push notification dispatch |
| `notification-events` | Notification event bus |
| `media-events` | Image/video processing |
| `catalog-events` | Product catalog sync |
| `broadcast` | Merchant broadcast messages |
| `email` | Transactional email via SendGrid |
| `sms` | SMS via Twilio/MSG91 |
| `exports` | CSV/PDF export generation |
| `scheduled` | ScheduledJobService repeatable jobs |
| `integrations` | Third-party integration sync |

**Dead Letter Queues:**

| Queue | Purpose |
|-------|---------|
| `payments-dlq` | Failed payment jobs |
| `rewards-dlq` | Failed reward jobs |

DLQ management API: `POST/GET /api/admin/dlq` (admin auth required)

### 5.2 BullMQ Repeatable Jobs (ScheduledJobService)

The following jobs are registered as BullMQ repeatable jobs, NOT as node-cron tasks (to prevent double-execution):

- `trial-expiry-notification`
- `cleanup-expired-sessions`
- `expire-coins`
- `credit-cashback`
- `expire-clicks`
- `travel-credit-cashback`
- `travel-expire-unpaid`
- `travel-mark-completed`
- `inventory-alerts`
- `expire-deal-redemptions`
- `expire-voucher-redemptions`
- `expire-table-bookings`

### 5.3 Node-Cron Jobs

These run in the worker process (ENABLE_CRON=true). All multi-instance cron jobs use Redis distributed locks to ensure single execution.

| Job | Schedule | Lock TTL | Description |
|-----|----------|----------|-------------|
| `fraudDetection` | Daily | — | Coin velocity analysis |
| `coinExpiry (7-day warning)` | Daily 1 AM | — | Warn users of expiring coins |
| `coinExpiryEnforcement` | Daily 2 AM | — | Mark expired branded/promo coins inactive |
| `walletReconciliation` | Every 6h | — | Wallet balance vs CoinTransaction sum check |
| `cashbackHoldCredit` | Periodic | — | Auto-credit 24h/48h held cashbacks |
| `refundReversal` | Every 5min | — | Process pending refunds |
| `leaderboardRefresh` | Every 5min | — | Recalculate leaderboard rankings |
| `billVerification` | Every 10min | — | OCR bill verification pipeline |
| `paymentReconciliation` | Every 10min | — | Reconcile pending Razorpay payments |
| `stuckPaymentPipeline` | Every 15min | — | Razorpay refund retry + stuck alerts |
| `creatorJobs` | Periodic | — | Trending, stats, conversions, tier updates |
| `streakReset` | Daily 00:05 UTC | — | Reset broken streaks |
| `tagOffers` | Hourly | — | Auto-tag trending/popular/expiring offers |
| `bonusCampaign` | Every 5min / 30min | — | Status transitions + claim expiry |
| `challengeLifecycle` | Every 5min / 30min | — | Challenge activation + cleanup |
| `tournamentLifecycle` | Every 5min | — | Tournament activation + completion |
| `stuckTransactionRecovery` | Every 15min | 600s | Recovery of stuck financial transactions |
| `giftDelivery` | Every 5min | 240s | Process scheduled gift deliveries |
| `giftExpiry` | Daily 2:30 AM | 3600s | Expire undelivered gifts |
| `surpriseDropExpiry` | Hourly | 3000s | Expire surprise coin drops |
| `partnerEarningsSnapshot` | Daily 1 AM | 7200s | Daily partner earnings snapshot |
| `pushReceiptProcessing` | Every ~15min | 600s | Process Expo push delivery receipts |
| `pushReceiptCheck` | Every 30min | 600s | Remove invalid push tokens |
| `devicePatternAnalysis` | Every 15min | 600s | Fraud device pattern scoring |
| `rechargeReconciliation` | Every 15min | 600s | Reconcile pending recharge orders |
| `nearbyFlashSaleNotification` | Every 30min | — | Location-filtered flash sale alerts |
| `smartDemandPush` | Every 30min | — | Near-expiry products + low-demand detection |
| `rezCapitalScoring` | Weekly Sun 3 AM | — | Merchant credit scoring |
| `weeklySummary` | Mon 10 AM | — | User savings summary digest |
| `walletLedgerReconciliation` | Daily 4 AM | — | Ledger vs wallet balance |
| `merchantLiabilitySettlement` | Daily 5 AM | — | Merchant liability settlement |
| `merchantPayout` | Weekly Mon 6 AM | — | Merchant wallet payout |
| `merchantDailyStats` | Daily 1 AM | 3600s | Compute merchant daily stats |
| `restore86Items` | Daily 6 AM | — | Restore temporarily 86'd menu items |
| `goldSip` | Daily 9 AM | — | Execute monthly Gold SIP investments |
| `goldPriceRefresh` | Every 15min | 300s | Live gold price from provider |
| `referralExpiry` | Daily 3 AM | — | Expire stale referral codes |
| `priveInviteExpiry` | Daily 3:30 AM | — | Expire Privé invite codes |
| `slaBreachDetection` | Every 5min | — | Detect SLA breach on appointments/orders |
| `analyticsSummary` | Daily 2 AM | — | Aggregate analytics snapshots |
| `integrationReconciliation` | Daily 2 AM | — | Third-party integration sync check |
| `reEngagementTrigger` | Periodic | — | Re-engagement push for dormant users |
| `referralCompletion` | Periodic | — | Notify on referral completion |
| `coinExpiryNotification` | Periodic | — | Coin expiry reminder push |
| `slaMonitor` | Periodic | — | SLA monitoring and alerts |
| `failedRefundRetry` | Periodic | — | Retry failed refunds |
| `stuckOrderCancel` | Periodic | — | Cancel stale stuck orders |
| `anomalyDetection` | Periodic | — | Spend anomaly detection |
| `trialCoinExpiry` | Periodic | — | Expire trial coins |
| **`appointmentReminder`** | **Hourly** | **55min** | See detail below |
| `rebookingNudge` | Periodic | — | Nudge users to rebook lapsed appointments |
| `campaignAutomation` | Periodic | — | Automated campaign lifecycle |
| `tryFeedRefresh` | Periodic | — | Refresh REZ TRY feed |
| `surpriseTrial` | Periodic | — | Dispatch surprise trial assignments |

### 5.4 Appointment Reminder Job (Detail)

File: `src/jobs/appointmentReminderJob.ts`

Runs hourly via node-cron (`0 * * * *`). Uses a 55-minute distributed lock to prevent duplicate sends across instances.

**Three notification triggers per tick:**

1. **24-hour reminder** — Finds appointments with date = tomorrow. Filters in-memory to the ±1h window around 24h from now (BUG-032 fix: `appointmentDate` is stored as midnight-UTC date-only, not datetime). Sends push to user and notification to merchant. Sets `reminder24hSent = true`.

2. **1-hour reminder** — Finds appointments today. Filters to the 45–75 minute window before appointment time. Sends push to user and high-priority notification to merchant. Sets `reminder1hSent = true`.

3. **Review request (2h post-completion)** — Finds appointments with `status = completed` and `completedAt` within the last 2h ± 30min. Sends push asking for review, offering 50 REZ coins. Sets `reviewRequestSent = true`.

4. **Event day-of reminder** — Fires once per day between 8–9 AM. Sends push to all users with events booked for today. Sets `eventDayReminderSent = true`.

---

## 6. Security

### 6.1 JWT Authentication

- **User tokens:** Signed with `JWT_SECRET`, 15-minute expiry (configurable via `JWT_EXPIRES_IN`)
- **Admin tokens:** Signed with `JWT_ADMIN_SECRET` (separate secret). User tokens claiming admin roles are rejected outright even if the signature is valid.
- **Refresh tokens:** Signed with `JWT_REFRESH_SECRET`, 7-day expiry
- **Token delivery:** `Authorization: Bearer <token>` header (native clients) or `rez_access_token` httpOnly cookie (browser surfaces)
- **Token blacklist:** Redis-backed. Logout invalidates token immediately. `BLACKLIST:token:<token>` keys with matching TTL.
- **Logout-all-devices:** Sets a Redis timestamp. Any token with `iat` before that timestamp is rejected.
- **Query string tokens:** Explicitly rejected. Any request with `?token=`, `?access_token=`, or `?jwt=` is blocked with 401.

### 6.2 X-Internal-Token (Service-to-Service)

Routes that accept calls from other REZ microservices (e.g. rez-notification-service) check `x-internal-token` header against `INTERNAL_SERVICE_TOKEN` environment variable.

AdBazaar internal routes use a separate `x-internal-key` header validated against `ADBAZAAR_INTERNAL_KEY`.

### 6.3 HMAC Webhook Validation

- **Razorpay:** `X-Razorpay-Signature` header, HMAC-SHA256 over raw body using `RAZORPAY_WEBHOOK_SECRET`. Raw body is preserved by mounting the webhook handler before the JSON body parser.
- **Stripe:** `stripe-signature` header, Stripe SDK signature verification using `STRIPE_WEBHOOK_SECRET`.
- **AdBazaar Partner API:** `X-AdBazaar-Signature` header, HMAC-SHA256 using a shared secret.
- **Integration webhooks:** HMAC validated via `integrationWebhookRoutes`.

Webhook deduplication is enforced via Redis-backed idempotency cache (`webhookValidation.ts`). Replay attacks are rejected by TTL-expiring cache keys.

### 6.4 CSRF Protection

Two layers:

1. **Cookie-based CSRF tokens** (via `setCsrfToken` middleware): Double-submit cookie pattern. Token fetched at `/api/csrf-token`. Required for browser-surface mutation requests.

2. **X-Requested-With header guard** on web ordering routes: Mutation requests must include `X-Requested-With: XMLHttpRequest`. This blocks cross-site form POSTs from non-AJAX clients.

### 6.5 Device Fingerprinting

`src/services/deviceFingerprintService.ts` collects device signals on authentication. Suspicious devices are flagged (`req.deviceRisk`). Admin route at `/api/admin/devices` for manual review. `devicePatternAnalysis` cron runs every 15 minutes to update risk scores.

### 6.6 Other Hardening

- **Helmet.js** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.
- **express-mongo-sanitize** — NoSQL injection prevention on all request bodies
- **express-rate-limit** with Redis store — Tiered limits: `strictLimiter` (10/min, OTP/auth), `generalLimiter` (60/min, all user routes), `bulkLimiter` (100/min, feeds/search), `adminLimiter` (60/min, admin panel). `DISABLE_RATE_LIMIT=true` is **hard-blocked in production**.
- **IP blocker** — `ipBlocker` middleware blocks known bad IPs
- **Request timeout** — 30-second global timeout (configurable via `REQUEST_TIMEOUT_MS`). Upload routes are exempted.
- **bcrypt OTPs** — Web ordering OTPs are bcrypt-hashed (cost=8) before storage in Redis, never stored plaintext.
- **OTP bypass protection** — `NODE_ENV` defaults to `production` if unset, which disables the dev-mode OTP bypass in `authController`.

---

## 7. Environment Variables

### Required (hard failure if missing in production)

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | User JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Refresh token secret (min 32 chars) |
| `JWT_MERCHANT_SECRET` | Merchant JWT secret (min 32 chars) |
| `JWT_ADMIN_SECRET` | Admin JWT secret (separate from user secret) |
| `OTP_HMAC_SECRET` | HMAC key for OTP signing |
| `INTERNAL_SERVICE_TOKEN` | Shared secret for inter-service calls |
| `FRONTEND_URL` | Consumer frontend URL (used in CORS + emails) |
| `REDIS_URL` | Redis/Valkey connection URL |

### Strongly Recommended

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio/MSG91 account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio sender number or `TWILIO_SENDER_ID` |
| `SENDGRID_API_KEY` | SendGrid API key for transactional email |
| `RAZORPAY_KEY_ID` | Razorpay live key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay live key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Required when Razorpay live keys are set |
| `STRIPE_SECRET_KEY` | Stripe secret key (travel payments) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `SENTRY_DSN` | Sentry error tracking DSN |
| `PUBLIC_URL` | Public API URL for deep links |
| `MERCHANT_FRONTEND_URL` | Merchant dashboard URL (CORS) |
| `MARKETING_SERVICE_URL` | rez-marketing-service URL (broadcasts) |

### Optional / Feature Flags

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default: `5001`) |
| `API_PREFIX` | API path prefix (default: `/api`) |
| `NODE_ENV` | `development` / `production` / `test` (default: `production`) |
| `PROCESS_ROLE` | `api` (default) or `worker` |
| `ENABLE_CRON` | Set `true` in worker process to start cron jobs |
| `WORKER_ROLE` | `noncritical` or `all` to disable critical workers in API process |
| `CORS_ORIGIN` | Comma-separated allowed origins (falls back to `FRONTEND_URL`) |
| `ADMIN_FRONTEND_URL` | Admin panel URL (CORS) |
| `VERCEL_PREVIEW_URLS` | Comma-separated Vercel preview hostnames |
| `JWT_EXPIRES_IN` | Access token TTL (default: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (default: `7d`) |
| `BCRYPT_ROUNDS` | bcrypt work factor (default: `12`, range: 10–15) |
| `APPLE_APP_ID` | Apple App Site Association app ID |
| `ANDROID_SHA256_FINGERPRINT` | Android App Links SHA256 fingerprint |
| `ADBAZAAR_INTERNAL_KEY` | Shared secret for AdBazaar service calls |
| `DISABLE_RATE_LIMIT` | `true` to disable rate limiting (dev only; hard-blocked in production) |
| `REQUEST_TIMEOUT_MS` | Global request timeout (default: `30000`) |
| `SHUTDOWN_TIMEOUT_MS` | Graceful shutdown timeout (default: `15000`) |
| `ALLOW_TEST_RAZORPAY` | `true` to allow test Razorpay keys in production |
| `DIRECT_START` | `true` to force server startup (ts-node wrapper bypass) |

---

## 8. Data Models (Key MongoDB Collections)

| Collection | Model File | Description |
|------------|-----------|-------------|
| `users` | `User.ts` | Consumer accounts: profile, preferences, locationHistory, deviceTokens, referral, KYC status |
| `wallets` | `Wallet.ts` | Per-user wallet: balance, coin ledger (REZ/Privé/Branded/Promo), transaction history |
| `cointransactions` | `CoinTransaction.ts` | Append-only coin transaction log |
| `transactionauditlogs` | `TransactionAuditLog.ts` | Financial audit trail |
| `stores` | `Store.ts` | Merchant store profiles, coordinates, categories, hours, payment methods |
| `products` | `Product.ts` | Product catalog with variants, images, stock |
| `orders` | `Order.ts` | Consumer orders with items, payment status, delivery tracking |
| `weborders` | `WebOrder.ts` | No-app QR ordering orders |
| `tablesessions` | `TableSession.ts` | Dine-in multi-party table sessions |
| `serviceappointments` | `ServiceAppointment.ts` | Salon/spa/clinic bookings with reminder flags |
| `offers` | `Offer.ts` | Merchant offers with geo/time validity |
| `vouchers` | `Voucher.ts` | User voucher redemptions |
| `campaigns` | `Campaign.ts` | Bonus/double-coin campaigns |
| `carts` | `Cart.ts` | User shopping carts |
| `categories` | `Category.ts` | Product/store category tree |
| `merchants` | `Merchant.ts` | Merchant accounts (linked to stores) |
| `personaprofiles` | `PersonaProfile.ts` | User persona: segment, feed config, anchor locations |
| `adbazaarscans` | `AdBazaarScan.ts` | AdBazaar QR scan events (idempotency) |
| `notifications` | `Notification.ts` | Push notification records |
| `reviews` | `Review.ts` | Product/store reviews |
| `trialoffers` | `TrialOffer.ts` | REZ TRY trial offer catalog |
| `usermissions` | `UserMission.ts` | Gamification mission progress |
| `leaderboardentries` | `LeaderboardEntry.ts` | Leaderboard rankings |
| `devicefingerprints` | `DeviceFingerprint.ts` | Device risk profiles |
| `streaks` | `Streak.ts` | User engagement streaks |
| `achievements` | `Achievement.ts` | Earned achievements |
| `goldsavings` | `GoldSavings.ts` | Gold holding records |
| `goldsips` | `GoldSip.ts` | Gold SIP plans |

---

## 9. BullBoard — Queue Monitoring UI

**URL:** `https://api.rezapp.com/admin/queues`

Note the path is `/admin/queues` NOT `/api/admin/queues`. BullBoard mounts at `/admin` (Express root), not under the API prefix.

**Access:** Admin JWT required. Protected by the same `authenticate` + `requireAdmin` middleware stack as all other admin routes. Rate-limited (60 req/IP/min) and audit-logged.

**Queues visible:** All critical queues, all noncritical queues, `payment-events`, `payments-dlq`, `rewards-dlq`.

BullBoard exposes per-queue: job counts (waiting, active, completed, failed, delayed), job inspection, manual retry, and job deletion.

**DLQ management API:** `GET /api/admin/dlq` (list DLQ jobs), `POST /api/admin/dlq/:jobId/retry` (retry), `DELETE /api/admin/dlq/:jobId` (discard). Admin auth required.

---

## 10. Local Development & Testing

### Prerequisites

- Node.js 20.x
- MongoDB Atlas cluster or local MongoDB instance
- Redis (local or Render Redis)
- Twilio or MSG91 credentials for OTP (or use dev OTP bypass)

### Setup

```bash
cd rezbackend/rez-backend-master
npm install
cp .env.example .env   # fill in credentials
npm run dev            # nodemon watches src/, restarts on change
```

### OTP bypass in development

When `NODE_ENV=development`, the OTP verification endpoint accepts a test OTP. Ensure `NODE_ENV` is set in `.env` — the server defaults to `production` if the variable is missing (security default).

### Seed data

```bash
npm run seed:critical    # minimum viable dataset (users, stores, products)
npm run seed:master      # full homepage seed
npm run seed:gamification
npm run seed:referrals
npm run seed:subscriptions
```

### Run tests

```bash
npm test                          # all tests (jest --runInBand)
npm run test:unit                 # unit tests only (__tests__/services)
npm run test:integration          # integration tests (__tests__/routes)
npm run test:e2e-merchant         # e2e merchant endpoint tests
```

### Build

```bash
npm run build    # tsc → dist/
npm start        # run compiled API process
npm run start:worker   # run compiled worker process
```

### Database indexes

```bash
npm run db:indexes    # ensures all MongoDB indexes are created
npm run indexes:sync  # sync index definitions
```

### Health checks

- `GET /health` — basic liveness (DB + Redis status, payment gateway)
- `GET /health/ready` — deep readiness (DB latency, Redis status, queue stall check)
- `GET /health/live` — minimal liveness (no DB call)
- `GET /health/cache-stats` — Redis stats (admin auth required)

---

## 11. Troubleshooting

### Server fails to start: "JWT_ADMIN_SECRET is required in production"

Set `JWT_ADMIN_SECRET` in your environment. It must be different from `JWT_SECRET` and at least 32 characters.

### Server fails to start: REDIS_URL missing

All rate limiting, token blacklisting, and distributed locking require Redis. Set `REDIS_URL` even in development.

### BullMQ workers not processing jobs

1. Check that `PROCESS_ROLE=worker` is set on the worker dyno (or that `WORKER_ROLE` is not set to `noncritical`/`all` on the API dyno if relying on inline critical workers).
2. Confirm `REDIS_URL` is reachable from the worker process — workers exit with code 1 if Redis is unavailable.
3. Check BullBoard at `/admin/queues` for stalled or failed jobs.

### Cron jobs not running

Cron jobs are disabled by default. Set `ENABLE_CRON=true` on the worker process (`PROCESS_ROLE=worker ENABLE_CRON=true`).

### Appointment reminders not sending

The `appointmentReminderJob` uses a Redis distributed lock (`job:appointment-reminder`) with a 55-minute TTL. If a previous instance crashed without releasing the lock, wait 55 minutes or manually delete the key in Redis: `DEL job:appointment-reminder`.

### Duplicate push notifications for appointments

This was fixed in QF-013. The distributed lock ensures only one instance runs the reminder job per hour. Additionally, `reminder24hSent` / `reminder1hSent` flags on the `ServiceAppointment` document prevent re-sends even if the lock races.

### Stripe webhooks for travel not firing

1. Confirm `STRIPE_WEBHOOK_SECRET` is set.
2. Ensure the Stripe webhook is pointing to `/api/travel-webhooks` (not `/api/webhooks`).
3. Stripe requires raw body for signature verification — the travel webhook route uses its own raw body middleware.

### Web ordering OTP not verifying

OTPs are bcrypt-hashed before storage. If Redis is unavailable, the in-memory fallback is used. Fallback state is lost on server restart. Check that Redis is connected (`/health` endpoint). OTPs expire in 5 minutes.

### AdBazaar coin credit not working

1. Confirm `ADBAZAAR_INTERNAL_KEY` matches on both the AdBazaar service and the monolith.
2. The `x-internal-key` header must be sent on `POST /api/adbazaar/scan`.
3. Check for duplicate `scanEventId` — duplicate scans are idempotently rejected with a 409.
4. Confirm the `rezUserId` and `merchantId` are valid MongoDB ObjectIds and the user's account is active.

### CORS errors from merchant dashboard

If `CORS_ORIGIN` is not set, CORS falls back to `FRONTEND_URL` and `MERCHANT_FRONTEND_URL`. For multi-origin setups (consumer app + merchant app + admin + web-menu), set `CORS_ORIGIN` as a comma-separated list of all allowed origins. Vercel preview URLs require `VERCEL_PREVIEW_URLS` to be set.

### Rate limit errors in development

Set `DISABLE_RATE_LIMIT=true` in your local `.env`. This is blocked in production by a hard check in `validateEnvironment()`.

### Merchant routes returning 404

Most `/api/merchant/*` routes have been migrated to rez-merchant-service. Check if the route you are calling is commented out in `src/config/routes.ts`. If so, the request must go to rez-merchant-service. Only `/api/merchant/qr/*`, `/api/merchant/invoices`, and `/api/merchants` (plural) still hit the monolith.
