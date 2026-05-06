# REZ Interconnectivity Audit — All 5 Surfaces

> Cross-check of every feature across Consumer App, Merchant App, Admin App, Web Menu, and Backend.
> Items marked ✗ are confirmed missing. Items marked ⚠ are partial/broken.
> Last updated: 2026-04-11

---

## The 5 Surfaces

| # | Surface | Tech | Role |
|---|---------|------|------|
| 1 | **Consumer App** (`rezapp/rez-master`) | React Native + Expo SDK 53 | End-user shopping, ordering, loyalty |
| 2 | **Merchant App** (`rezmerchant/rez-merchant-master`) | React Native + Expo SDK 53 | Store owner management, POS |
| 3 | **Admin App** (`rezadmin/rez-admin-main`) | React Native + Expo SDK 53 | Platform management, moderation |
| 4 | **Web Menu** (`rez-web-menu`) | React + Vite (browser) | QR-scan table ordering (dine-in) |
| 5 | **Backend** (`rezbackend/rez-backend-master`) | Node.js + Express | Shared API for all 4 surfaces |

---

## Feature Cross-Check Matrix

| Feature | Consumer | Merchant | Admin | Web Menu | Backend |
|---------|:--------:|:--------:|:-----:|:--------:|:-------:|
| **AUTH** | | | | | |
| OTP / Phone login | ✓ | — | — | ✓ | ✓ |
| Email + password login | — | ✓ | ✓ | — | ✓ |
| Refresh token | ✓ | ✓ | ✓ | ✓ | ✓ |
| Logout / session clear | ✓ | ✓ | ✓ | ✓ | ✓ |
| Profile management | ✓ | ✓ | ✓ | ✗ | ✓ |
| **MENU / PRODUCTS** | | | | | |
| Browse menu/products | ✓ | ✓ | ✓ | ✓ | ✓ |
| Search | ✓ | ✓ | ✓ | ✓ (basic) | ✓ |
| Categories | ✓ | ✓ | ✓ | ✓ | ✓ |
| Veg / dietary filters | ✓ | — | — | ✓ | ✓ |
| AI recommendations | ✓ | — | — | ✓ | ✓ |
| Product compare | ✓ | — | — | ✗ | ✓ |
| Wishlist / save item | ✓ | — | — | ✗ | ✓ |
| **CART & CHECKOUT** | | | | | |
| Add to cart | ✓ | ✓ (POS) | — | ✓ | ✓ |
| Cart validation | ✓ | ✓ | — | ✓ | ✓ |
| Coupon / promo code | ✓ | — | — | ✓ | ✓ |
| Coupon browsing UI | ✓ | — | ✓ | ✗ | ✓ |
| Razorpay checkout | ✓ | ✓ | — | ✓ | ✓ |
| REZ Cash / wallet pay | ✓ | — | — | ✓ (balance shown) | ✓ |
| Wallet top-up | ✓ | — | ✓ (admin adjust) | ✗ | ✓ |
| Bill splitting | ✓ | — | — | ✓ | ✓ |
| Group ordering | ✓ | — | — | ✓ | ✓ |
| Digital tipping | — | — | — | ✓ | ✓ |
| Parcel request | — | — | — | ✓ | ✓ |
| **ORDERS** | | | | | |
| Place order | ✓ | ✓ (POS) | — | ✓ | ✓ |
| Order history | ✓ | ✓ | ✓ | ✓ | ✓ |
| Order tracking / status | ✓ | ✓ | ✓ | ✓ | ✓ |
| Real-time order updates (socket) | ✓ | ✓ | ✓ | ✓ listen+emit | ✓ |
| Cancel order | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rate / review order | ✓ | — | ✓ (moderate) | ✓ | ✓ |
| Feedback survey (post-order) | — | — | — | ✓ | ✓ |
| Order donations | — | — | — | ✓ | ✓ |
| Merchant feedback view | — | ✗ | ✓ | — | ✓ |
| **TABLE / DINE-IN** | | | | | |
| QR code generation | — | ✓ | ✗ | — | ✓ |
| QR code scan → menu | ✓ | — | — | ✓ | ✓ |
| Call waiter | — | — | — | ✓ | ✓ |
| Waiter alert (receive) | — | ✗ | — | — | ✓ |
| Request bill | — | — | — | ✓ | ✓ |
| Floor plan / table mgmt | — | ✓ | — | — | ✓ |
| KDS (kitchen display) | — | ✓ | — | — | ✓ |
| Dine-in order tracking | ✓ | ✓ | — | ✓ socket live | ✓ |
| Web menu estimated wait time | — | — | ✓ (set) | ✓ (display) | ✓ |
| Web menu order status update | — | ✓ | — | — | ✓ |
| Web menu preview (for merchant) | — | ✗ | ✗ | — | ✓ |
| Web menu config per store | — | ✗ | ✓ (program+wait) | — | ✓ |
| **WALLET & PAYMENTS** | | | | | |
| REZ Cash balance | ✓ | — | ✓ | ✓ | ✓ |
| Transaction history | ✓ | ✓ (settlements) | ✓ | ✗ | ✓ |
| P2P wallet transfer | ✓ | — | — | ✗ | ✓ |
| Gift cards (buy) | ✓ | — | ✓ | ✗ | ✓ |
| Gift cards (redeem) | ✓ | ✓ | — | ✗ | ✓ |
| Merchant payouts | — | ✓ | ✓ | — | ✓ |
| Reconciliation | — | ✓ | ✓ | — | ✓ |
| Admin wallet adjustment | — | — | ✓ | — | ✓ |
| **LOYALTY & GAMIFICATION** | | | | | |
| REZ Coins balance | ✓ | — | ✓ | ✓ | ✓ |
| Coin earn / cashback | ✓ | — | ✓ (config) | ✓ | ✓ |
| Loyalty stamps | ✓ | ✓ | ✓ | ✓ | ✓ |
| Full loyalty tier view | ✓ | — | ✓ | ✗ | ✓ |
| Challenges | ✓ | — | ✓ | ✗ | ✓ |
| Achievements / badges | ✓ | — | ✓ | ✗ | ✓ |
| Leaderboard | ✓ | — | ✓ | ✗ | ✓ |
| Gamification (games) | ✓ | — | ✓ | ✗ | ✓ |
| Scratch cards | ✓ | — | ✓ | ✗ | ✓ |
| Daily check-in | ✓ | — | ✓ | ✗ | ✓ |
| REZ Score | ✓ | — | ✓ | ✗ | ✓ |
| **NOTIFICATIONS** | | | | | |
| Push notifications (FCM) | ✓ | ✓ | ✓ | ✗ | ✓ |
| In-app notification list | ✓ | ✓ | ✓ | ✗ | ✓ |
| Notification preferences | ✓ | ✓ | — | ✗ | ✓ |
| Merchant broadcast to customers | — | ✓ | ✓ | ✗ | ✓ |
| Web push (browser) | — | — | — | ✗ | ✗ |
| **REVIEWS & MODERATION** | | | | | |
| Write store review | ✓ | — | — | ✗ | ✓ |
| Write product review | ✓ | — | — | ✗ | ✓ |
| View reviews (consumer) | ✓ | ✓ | ✓ | ✗ | ✓ |
| Review moderation | — | — | ✓ | — | ✓ |
| UGC / photo moderation | ✓ (upload) | — | ✓ | — | ✓ |
| Comment moderation | ✓ (post) | — | ✓ | — | ✓ |
| **DISPUTES** | | | | | |
| Raise dispute (consumer) | ✓ | — | — | ✗ | ✓ |
| Manage disputes (merchant) | — | ✓ | — | — | ✓ |
| Admin dispute resolution | — | — | ✓ | — | ✓ |
| Web menu dispute | — | — | — | ✗ | ✓ |
| **STORES** | | | | | |
| Browse stores (consumer) | ✓ | — | ✓ | ✓ | ✓ |
| Store profile (public) | ✓ | — | — | ✓ | ✓ |
| Manage store profile | — | ✓ | ✓ | — | ✓ |
| Store moderation | — | — | ✓ | — | ✓ |
| Multi-store management | — | ✓ | ✓ | — | ✓ |
| Follow / save store | ✓ | — | — | ✗ | ✓ |
| **MERCHANT TOOLS** | | | | | |
| POS terminal | — | ✓ | — | — | ✓ |
| Inventory management | — | ✓ | — | — | ✓ |
| Staff management | — | ✓ | — | — | ✓ |
| Shift scheduling | — | ✓ | — | — | ✓ |
| CRM / customer insights | — | ✓ | ✓ | — | ✓ |
| REZ Capital (loans) | — | ✓ | — | — | ✓ |
| Khata (credit ledger) | ✓ (consumer) | ✓ (merchant) | — | — | ✓ |
| Recipes / waste tracking | — | ✓ | — | — | ✓ |
| Purchase orders | — | ✓ | — | — | ✓ |
| Supplier management | — | ✓ | — | — | ✓ |
| **ANALYTICS** | | | | | |
| Consumer earnings view | ✓ | — | — | — | ✓ |
| Merchant analytics | — | ✓ | ✓ | — | ✓ |
| Platform analytics | — | — | ✓ | — | ✓ |
| Web menu order analytics | — | ✓ (list+detail) | ✗ | — | ✓ |
| Funnel analytics | — | — | ✓ | — | ✓ |
| Cohort analysis | — | — | ✓ | — | ✓ |
| **ADMIN CONTROLS** | | | | | |
| Feature flags | — | — | ✓ | — | ✓ |
| Platform config | — | — | ✓ | — | ✓ |
| A/B testing | — | — | ✓ | — | ✓ |
| Fraud detection | — | — | ✓ | — | ✓ |
| Job queue monitor | — | — | ✓ | — | ✓ |
| System health | — | — | ✓ | — | ✓ |

---

## Critical Gaps — Prioritized

### ✅ RESOLVED (2026-04-11)

#### ~~1. Web Menu: No real-time order status (Socket.IO receive missing)~~
- **Status: FIXED.** `OrderConfirmPage` now listens for `web-order:status-update` via Socket.IO and updates status live. Backend emits from both internal and merchant PATCH routes.

#### 2. Web Menu: No dispute mechanism
- **Problem:** A customer who orders via QR scan has no way to report a wrong item, missing item, or bad experience. The consumer app has a full dispute flow (`/disputes/create`) but the web menu has none.
- **Fix needed:** Add a "Report a problem" button on the `OrderConfirmPage` / `OrderHistoryPage` that calls the existing `/api/disputes` endpoint.
- **Backend:** Dispute routes already exist. No backend change needed.

#### 3. Merchant: No visibility into web menu order feedback
- **Problem:** The web menu has a full post-order feedback survey (`/order/:id/feedback`). This data goes to the backend but the merchant app has no screen to view it. Merchants are flying blind on dine-in experience quality.
- **Fix needed:** Add a "Web Menu Feedback" tab in `app/analytics/` in the merchant app calling the feedback summary endpoint.
- **Backend:** The data is stored. A summary endpoint may need to be added to `/api/merchant/analytics`.

#### ~~RESOLVED: Merchant: No web order status update capability~~
- **Status: FIXED.** `PATCH /api/merchant/web-orders/:orderNumber/status` added with ownership validation, transition guards, socket emit, and WhatsApp "order ready" notification. Merchant app `[orderNumber].tsx` now shows action button (Confirm → Start Preparing → Mark Ready → Complete).

#### ~~RESOLVED: Admin: No REZ Program toggle per store~~
- **Status: FIXED.** `PATCH /api/admin/stores/:id/program` sets `isProgramMerchant` + `baseCashbackPercent`. `PATCH /api/admin/stores/:id/settings` sets `estimatedPrepMinutes`. Admin merchants screen shows toggle + prep time input per store. Web menu shows estimated wait time badge.

#### ~~RESOLVED: WhatsApp receipt never sent (phone not passed)~~
- **Status: FIXED.** `OrderConfirmPage` bundle patched to pass `customerPhone` to the receipt API. `whatsappOrderingService` sends receipt + "order ready" notification for both web-ordering and merchant routes.

---

### 🔴 HIGH PRIORITY (affects core flow)

#### 4. Merchant: No "Call Waiter" alert receiver
- **Problem:** Web menu customers can call a waiter (sends to backend). The backend has socket support. But the merchant app has no screen or alert that shows incoming waiter call requests. Staff using the merchant app are unaware.
- **Fix needed:** Merchant app should listen for `waiterCall` socket events and show an in-app alert/banner. A dedicated screen in `app/dine-in/` or `app/pos/` for pending waiter requests would be ideal.
- **Backend:** Socket emission exists in `webOrderingRoutes.ts`. No backend change needed.

#### 5. Merchant: No web menu preview
- **Problem:** A merchant can generate a QR code but cannot preview what the customer actually sees when they scan it. Any menu configuration error is only discovered by the customer.
- **Fix needed:** Add a "Preview Web Menu" button in `app/qr-generator/` that opens an in-app WebView pointing to `https://menu.rez.money/{storeSlug}` (or equivalent). Pure UI addition.

---

### 🟡 MEDIUM PRIORITY (missing convenience, not blocking)

#### 6. Web Menu: No post-order store review
- **Problem:** After ordering via QR scan, the customer can rate the order (1–5 stars) but cannot write a public store review. The consumer app has a full review flow.
- **Fix needed:** Add a "Write a Review" step on `OrderConfirmPage` after rating, calling `/api/reviews`.

#### 7. Web Menu: No wallet top-up
- **Problem:** Web menu shows REZ Coins/Cash balance but the customer cannot top up. If their wallet is short for a payment, they must open the main app to add funds — a broken checkout experience.
- **Fix needed:** Add a minimal top-up flow on `CheckoutPage` when wallet balance is insufficient, using Razorpay to credit the wallet.

#### 8. Web Menu: No loyalty tier / full gamification view
- **Problem:** The web menu shows a stamp card but not the full REZ tier, coins history, challenges, or achievements. A customer who orders regularly via QR scan never sees their loyalty status.
- **Fix needed:** Add a "Your REZ Rewards" expandable panel in `OrderConfirmPage` showing tier, coins balance, and current challenge progress. Use existing `/api/web-ordering/coins/balance` for coins; loyalty tier needs a new `/api/web-ordering/loyalty/tier` endpoint.

#### 9. Admin: No QR code generator / web menu management
- **Problem:** Admins cannot generate or override QR codes for stores. They also have no panel to see web menu performance per store (number of web orders, average order value, most-ordered items via web menu).
- **Fix needed:** Add a `web-menu-analytics.tsx` screen to the admin dashboard. Reuse the backend analytics data. For QR generation, link through to the merchant record.

#### 10. Admin: No web menu order feed
- **Problem:** Admin's `orders.tsx` shows all orders, but there is no filter for "source: web_menu" to distinguish dine-in QR orders from app orders. Important for auditing and fraud detection.
- **Fix needed:** Add `source` filter to admin orders screen. Backend order model already stores `source` field — just needs to be exposed in the admin filter UI.

#### 11. Web Menu: No push / web notifications for order updates
- **Problem:** After a customer places an order, they have no way to receive a browser notification when food is ready. They must keep the tab open and visible.
- **Fix needed:** Implement Web Push API (`navigator.serviceWorker` + `PushManager`) in the web menu app. Backend would need to add a web push subscription route and send push when order status changes.

#### 12. Consumer App: Admin section duplication
- **Problem:** The consumer app has an `app/admin/` section with 3 screens (`campaigns.tsx`, `faqs.tsx`, `social-media-posts.tsx`). This is a separate admin surface embedded in the consumer app. It likely exists for REZ content managers who use the consumer app. But these features are also in the main admin app — creating two places to manage campaigns and FAQs.
- **Fix needed:** Decide: either remove the consumer app admin section and redirect those users to the admin app, or clearly scope what each one manages (e.g., consumer admin = personal content; main admin = platform content).

---

### 🟢 LOW PRIORITY (nice to have)

#### 13. Web Menu: No wishlist / save for later
- **Problem:** A customer scanning a menu cannot save items for a future visit. Consumer app has wishlist but web menu does not.
- **Fix:** Add wishlist icon on menu items calling `/api/wishlist` (requires auth).

#### 14. Web Menu: No address management
- **Problem:** If web menu ever supports delivery (currently dine-in only), there is no address management. Not urgent but needed before adding delivery to the web menu.

#### 15. Consumer App: No web menu order history
- **Problem:** Orders placed via QR scan on the web menu do appear in the backend `orders` collection, but because they may have a different session JWT, they might not appear in the consumer app's order history if the phone number wasn't matched to a consumer account.
- **Check:** Verify that web menu OTP login creates or links to the same user document as the consumer app login. If it creates separate users, these orders are siloed.

#### 16. Admin: Cannot configure feature flags per merchant
- **Problem:** Admin has a global `feature-flags.tsx` but no per-merchant feature toggle. Merchant app receives no signal about which features are enabled/disabled for their account.
- **Fix:** Add merchant-level feature flag support: backend adds `merchantFlags` to merchant document, admin `merchant-flags/[merchantId].tsx` already exists (noted in the folder structure) — verify it saves correctly.

---

## Connectivity Summary (What's Working Well)

| Feature Area | Status |
|-------------|--------|
| Auth + JWT (all 4 surfaces → backend) | ✓ All connected |
| Orders (place, track, cancel) | ✓ All 4 surfaces connected |
| Payments via Razorpay | ✓ Consumer + Merchant + Web Menu |
| REZ Coins/Cash | ✓ Consumer + Web Menu + Admin |
| Disputes | ✓ Consumer + Merchant + Admin (web menu gap) |
| Reviews | ✓ Consumer + Admin (web menu gap) |
| Real-time (Socket.IO) | ✓ Consumer + Merchant + Web Menu (live order status) |
| BullMQ jobs | ✓ All triggered via backend |
| Push notifications (FCM) | ✓ Consumer + Merchant + Admin (no web push) |
| Loyalty + Stamps | ✓ Consumer + Web Menu (partial) + Admin |
| Merchant analytics | ✓ Merchant + Admin |
| Fraud + moderation | ✓ Admin only (correct) |

---

## Backend Coverage

All five apps share one backend. Every feature above that exists in any frontend has a corresponding backend route. No backend routes were found to be missing for existing UI features.

**Web ordering route coverage** (`/api/web-ordering/*`):
- `/store/:storeSlug` — menu fetch ✓
- `/otp/send`, `/otp/verify` — auth ✓
- `/razorpay/create-order`, `/payment/verify` — checkout ✓
- `/order/:id` — status ✓
- `/orders/history` — history ✓
- `/order/:id/cancel`, `/order/:id/rate` — post-order ✓
- `/cart/validate` — validation ✓
- `/bill/request`, `/bill/split`, `/bill/:id/split-status` — billing ✓
- `/group/create`, `/group/join`, `/group/:id/*` — group orders ✓
- `/coins/balance`, `/coins/credit` — wallet ✓
- `/coupon/validate` — promo codes ✓
- `/tip` — tipping ✓
- `/receipt/send` — digital receipt ✓
- `/order/:id/donate` — donations ✓
- `/order/:id/parcel` — parcel requests ✓
- `/order/:id/update-status` — kitchen updates ✓
- `/recommendations` — AI recommendations ✓
- `/waiter/call` — call waiter ✓
- `/loyalty/stamps` — stamp cards ✓
- `/order/:id/feedback` — feedback survey ✓
- `/receipt/send` — WhatsApp receipt (phone now passed correctly from OrderConfirmPage) ✓

**Merchant web orders route coverage** (`/api/merchant/web-orders/*`):
- `GET /` — paginated list, filter by storeId/status/date ✓
- `GET /:orderNumber` — full detail with splits/tip ✓
- `PATCH /:orderNumber/status` — advance status with socket emit + WhatsApp ✓ *(added 2026-04-11)*

**Admin store management routes** (`/api/admin/stores/*`):
- `PATCH /:id/program` — toggle REZ Program membership + cashback % ✓ *(added 2026-04-11)*
- `PATCH /:id/settings` — set estimatedPrepMinutes ✓ *(added 2026-04-11)*

---

## Pending Deployment (as of 2026-04-11)

| Item | What's needed | Who |
|------|--------------|-----|
| Deploy rezbackend to Render | Push & redeploy — new routes won't be live until deployed | Dev |
| Set `WHATSAPP_TOKEN` on Render | Without this, WhatsApp sends are silently skipped | Dev/Ops |
| Set `WHATSAPP_PHONE_ID` on Render | Required alongside token for Meta Cloud API | Dev/Ops |
| Verify web menu bundle deploy | `dist/` patches live at `menu.rez.money` | Dev/Ops |
