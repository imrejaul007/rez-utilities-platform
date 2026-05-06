# REZ Now — Feature Reference

> **Status: ACCURATE** | Generated: 2026-04-14 | Domain: `now.rez.money`
> Supersedes: `REZ_NOW_REBUILD_PLAN.md` (which was pre-build planning)
> Active Phases: R1 (Payment Kiosk) built; R2 (Bill Builder), R3 (AI Chatbot), R4 (Sub-2s Settlement) pending

---

## 1. Product Overview

REZ Now is a universal merchant payment & ordering web platform. Any merchant on the REZ platform gets a QR code that opens `now.rez.money/<slug>`. It serves two customer flows:

| Flow | Trigger | Use Case |
|------|---------|---------|
| **Order & Pay** | Merchant has menu | Restaurant, café, cloud kitchen |
| **Scan & Pay** | Merchant has no menu | Salon, retail, services, small shops |

---

## 2. Two-Tier Merchant Model

Feature gates are driven by `store.isProgramMerchant` on the `Store` model.

| Feature | REZ Merchant (`isProgramMerchant=true`) | Non-REZ Merchant |
|---------|---------------------------------------|------------------|
| Payment Kiosk (live feed + "ding") | | |
| REZ Coins on every payment | | |
| Wallet page | | |
| Full menu ordering | | Display only |
| Kitchen chat | | |
| AI chatbot | TODO (Phase R3) | |
| Staff dashboard (waiter calls) | | |
| Bill builder | TODO (Phase R2) | TODO (Phase R2) |
| WhatsApp receipt | | |

---

## 3. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| State | Zustand (`authStore`, `cartStore`, `uiStore`) |
| i18n | next-intl (EN + HI) |
| Real-time | Socket.IO (order status, kitchen chat, payment kiosk) |
| Payments | Razorpay SDK + UPI deep links |
| Push | VAPID Web Push via Service Worker |
| NFC | Web NFC API (Android Chrome) |
| Offline | IndexedDB queue + background sync |
| Analytics | Fire-and-forget events (13 types) |
| Error tracking | Sentry (10% traces, 100% replays on error) |
| PWA | manifest.json + service worker |
| SEO | sitemap, robots.txt, JSON-LD |
| Tests | Playwright e2e + Jest unit |
| Deploy | Vercel (bom1 region) |

---

## 4. Pages

### 4.1 Public Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Landing: hero, how-it-works, store search with debounced dropdown |
| `/search?q=` | `app/search/page.tsx` + `SearchResultsClient.tsx` | Debounced search, category filters, 2/3-col grid, load more |
| `/[storeSlug]` | `app/[storeSlug]/page.tsx` + `StorePageClient.tsx` | Conditionally shows Scan & Pay OR full menu based on `store.hasMenu` |
| `/[storeSlug]/pay` | `app/[storeSlug]/pay/page.tsx` | Scan & Pay: amount entry, quick amounts (₹100-1000), coin earn preview |
| `/[storeSlug]/pay/checkout` | `app/[storeSlug]/pay/checkout/page.tsx` | Scan & Pay confirmation: Razorpay, NFC tap-to-pay, wallet balance |
| `/[storeSlug]/pay/confirm/[paymentId]` | `app/[storeSlug]/pay/confirm/[paymentId]/page.tsx` | Payment success: green checkmark, coins earned, wallet balance |
| `/[storeSlug]/order/[orderNumber]` | `app/[storeSlug]/order/[orderNumber]/page.tsx` | Live order tracking: Socket.IO + polling fallback, 4-step progress bar |
| `/[storeSlug]/order/queued` | `app/[storeSlug]/order/queued/page.tsx` | Offline queue confirmation: queue ID + connectivity status |
| `/[storeSlug]/receipt/[orderNumber]` | `app/[storeSlug]/receipt/[orderNumber]/page.tsx` | Printable/downloadable receipt with full bill breakdown |
| `/[storeSlug]/history` | `app/[storeSlug]/history/page.tsx` | Per-store order history with reorder |
| `/[storeSlug]/reserve` | `app/[storeSlug]/reserve/page.tsx` + `ReservationClient.tsx` | Multi-step reservation: date picker, time slots, ICS download, directions |
| `/[storeSlug]/schedule` | `app/[storeSlug]/schedule/page.tsx` | Schedule-only: day selector, time slot grid, navigates to checkout |
| `/[storeSlug]/bill` | `app/[storeSlug]/bill/page.tsx` | Running bill/tab: per-person split (2-10), GST, mark-paid tracker |
| `/[storeSlug]/opengraph-image.png` | `app/[storeSlug]/opengraph-image.tsx` | Dynamic OG image generation (Next.js ImageResponse) |

### 4.2 Authenticated Customer Pages

| Route | File | Description |
|-------|------|-------------|
| `/profile` | `app/profile/page.tsx` + `ProfileClient.tsx` | Avatar, editable name/phone, stats, push/locale toggles |
| `/orders` | `app/orders/page.tsx` + `OrderHistoryClient.tsx` | Paginated global order history, reorder, cart-conflict modal |
| `/wallet` | `app/wallet/page.tsx` + `WalletClient.tsx` | Coin balance, Bronze/Silver/Gold/Platinum tier, paginated transactions |

### 4.3 Merchant / Staff Pages

| Route | File | Description |
|-------|------|-------------|
| `/[storeSlug]/staff` | `app/[storeSlug]/staff/page.tsx` + `StaffDashboardClient.tsx` | PIN-gated waiter call queue: acknowledge + resolve, elapsed timer |
| `/[storeSlug]/merchant/pay-display` | `app/[storeSlug]/merchant/pay-display/page.tsx` + `PayDisplayClient.tsx` | Payment kiosk: live Socket.IO feed, bell "ding", today's total, fullscreen |

### 4.4 Other Pages

| Route | File | Description |
|-------|------|-------------|
| `/offline` | `app/offline/page.tsx` + `reload-button.tsx` | Offline fallback with reload button |

---

## 5. API Routes (frontend → backend)

### 5.1 Internal API Routes (`app/api/`)

| Route | File | Description |
|-------|------|-------------|
| `GET /api/health` | `app/api/health/route.ts` | Health check |
| `POST /api/set-locale` | `app/api/set-locale/route.ts` | Sets `NEXT_LOCALE` cookie (en/hi) |
| `GET /.well-known/assetlinks.json` | `app/api/assetlinks/route.ts` + `app/.well-known/assetlinks.json/route.ts` | Android App Links (requires `ANDROID_SHA256_CERT_FINGERPRINT`) |
| `GET /.well-known/apple-app-site-association` | `app/api/apple-app-site-association/route.ts` + `app/.well-known/apple-app-site-association/route.ts` | iOS Universal Links (requires `APPLE_TEAM_ID`) |
| `GET /sitemap.xml` | `app/sitemap.xml/route.ts` | Dynamic XML sitemap for SEO |
| `GET /robots.txt` | `app/robots.txt/route.ts` | Robots.txt for crawlers |

### 5.2 Frontend API Clients (`lib/api/`)

| Module | Functions | Backend Route |
|--------|-----------|---------------|
| `auth.ts` | `sendOtp`, `verifyOtp`, `verifyPin`, `refreshToken` | `/api/auth/*` |
| `store.ts` | `getStoreMenu`, `getScanPayStore`, `callWaiter`, `requestBill`, `getRecommendations` | `/api/web-ordering/*` |
| `cart.ts` | `validateCart`, `validateCoupon`, `getAvailableCoupons` | `/api/web-ordering/*` |
| `orders.ts` | `getOrder`, `cancelOrder`, `rateOrder`, `submitFeedback`, `getOrderHistory`, `getLoyaltyStamps`, `sendReceipt`, `creditCoins`, `setOrderStatus` | `/api/web-ordering/*` |
| `orderHistory.ts` | `getOrderHistory` (paginated) | `/api/web-ordering/*` |
| `payment.ts` | `createRazorpayOrder`, `verifyPayment`, `addTip`, `addDonation`, `splitBill` | `/api/web-ordering/*` |
| `scanPayment.ts` | `createScanPayOrder`, `verifyScanPayment`, `creditScanPayCoins`, `getScanPayHistory` | `/api/web-ordering/*` |
| `wallet.ts` | `getWalletBalance`, `getWalletTransactions` | `/api/wallet/*` |
| `search.ts` | `searchStores`, `getFeaturedStores` | `/api/search/*` |
| `coupons.ts` | `getStoreCoupons`, `calculateCouponDiscount` | `/api/web-ordering/*` |
| `reservations.ts` | `getAvailability`, `createReservation` | `/api/web-ordering/*` |
| `delivery.ts` | `checkDelivery` (lat/lng) | `/api/web-ordering/*` |
| `waiter.ts` | `callWaiter`, `getWaiterCallStatus` | `/api/web-ordering/*` |
| `waiterStaff.ts` | `getActiveCalls`, `updateCallStatus` | `/api/web-ordering/*` |
| `reviews.ts` | `getStoreReviews` (Google reviews) | `/api/web-ordering/*` |
| `loyalty.ts` | `getLoyaltyStatus`, `redeemStamps` | `/api/web-ordering/*` |
| `profile.ts` | `getProfile`, `updateProfile` | `/api/profile/*` |
| `reorder.ts` | `prefillCartFromOrder` | (client-side cart population) |
| `cancellation.ts` | `cancelOrder` (with reason) | `/api/web-ordering/*` |

### 5.3 Backend Routes (rezbackend)

| Route | Description |
|-------|-------------|
| `GET /api/web-ordering/store/:slug/menu` | Full store menu with categories and items |
| `POST /api/web-ordering/orders` | Create web order (menu ordering) |
| `POST /api/web-ordering/orders/:id/otp-verify` | OTP verification for anonymous checkout |
| `POST /api/web-ordering/scan-pay/orders` | Create scan-pay order |
| `POST /api/web-ordering/scan-pay/verify` | Verify Razorpay payment |
| `POST /api/web-ordering/scan-pay/:orderId/credit` | Credit coins after scan-pay |
| `GET /api/web-ordering/orders/history` | Paginated order history |
| `GET /api/web-ordering/orders/:orderNumber` | Single order with full details |
| `PATCH /api/web-ordering/orders/:orderNumber/status` | Update order status |
| `POST /api/web-ordering/orders/:orderNumber/rate` | Submit rating + feedback |
| `GET /api/web-ordering/store/:slug/loyalty` | Loyalty stamp count |
| `POST /api/web-ordering/store/:slug/loyalty/redeem` | Redeem loyalty stamps |
| `GET /api/web-ordering/store/:slug/coupons` | Available coupons for store |
| `POST /api/web-ordering/coupons/calculate` | Calculate coupon discount |
| `GET /api/web-ordering/store/:slug/availability` | Time slot availability |
| `POST /api/web-ordering/reservations` | Create table reservation |
| `POST /api/web-ordering/waiter-call` | Call waiter (table chat) |
| `POST /api/web-ordering/waiter-call/:requestId/acknowledge` | Acknowledge waiter call |
| `POST /api/web-ordering/waiter-call/:requestId/resolve` | Resolve waiter call |
| `GET /api/web-ordering/store/:slug/staff/calls` | Get active waiter calls |
| `GET /api/web-ordering/store/:slug/today-payments` | Today's paid orders (Payment Kiosk) |
| `POST /api/web-ordering/store/:slug/emit-payment` | Emit `payment:received` socket event (internal) |

---

## 6. Components

### UI (`components/ui/`)

| Component | Description |
|-----------|-------------|
| `Button.tsx` | Multi-variant: primary/secondary/ghost/danger |
| `Badge.tsx` | Status badge: green/yellow/red/gray/blue |
| `Modal.tsx` | Accessible dialog |
| `Toast.tsx` | Toast: success/error/info |
| `Spinner.tsx` | Loading spinner |
| `ErrorBoundary.tsx` | React error boundary |
| `NetworkStatusBanner.tsx` | Browser online/offline status |
| `OfflineBanner.tsx` | Offline state indicator |
| `LanguageSwitcher.tsx` | EN/HI toggle |
| `ShareButton.tsx` | Web Share + WhatsApp fallback |
| `StoreImage.tsx` | Next.js Image wrapper with blur placeholder |
| `ReferralBanner.tsx` | Referral code share |
| `PushPromptBanner.tsx` | Push notification opt-in |

### Menu (`components/menu/`)

| Component | Description |
|-----------|-------------|
| `MenuHeader.tsx` | Store header: logo, status, operating hours |
| `CategoryNav.tsx` | Sticky category navigation pills |
| `MenuItem.tsx` | Item card with customization, veg indicator, availability |
| `CartSummaryBar.tsx` | Sticky bottom bar: item count + subtotal |
| `CustomizationModal.tsx` | Single/multi-select item customization |
| `PromoBanner.tsx` | Active promo banners |
| `SearchHighlight.tsx` | Search term highlighting |
| `WaiterCallButton.tsx` | FAB to call waiter |
| `MenuShareButton.tsx` | Share store menu link |

### Checkout (`components/checkout/`)

| Component | Description |
|-----------|-------------|
| `PaymentOptions.tsx` | UPI/Razorpay/pay-at-counter options |
| `SplitBillModal.tsx` | Per-person amount calculator |
| `ScheduleModal.tsx` | Date/time picker for scheduled orders |
| `CouponInput.tsx` | Coupon code validation |

### Order (`components/order/`)

| Component | Description |
|-----------|-------------|
| `RatingModal.tsx` | 1-5 star rating |
| `LoyaltyWidget.tsx` | Stamp card display |
| `CancelOrderModal.tsx` | Order cancellation with reason |
| `DisputeModal.tsx` | Issue reporting |
| `GoogleMapsReviewCTA.tsx` | Google Maps review prompt |

### Cart (`components/cart/`)

| Component | Description |
|-----------|-------------|
| `CouponInput.tsx` | Cart-level coupon (duplicate of checkout version) |
| `OffersModal.tsx` | Available offers/deals modal |

### Store (`components/store/`)

| Component | Description |
|-----------|-------------|
| `StoreCard.tsx` | Store card: logo, name, category, address |
| `StoreFooter.tsx` | Store footer with social links |
| `GoogleReviews.tsx` | Google reviews section |

### Other

| Component | Description |
|-----------|-------------|
| `NfcPayButton.tsx` (payment/) | NFC tap-to-pay (Chrome Android only) |
| `KitchenChatDrawer.tsx` (table/) | Kitchen/staff chat drawer |
| `LoginModal.tsx` (auth/) | Phone OTP login: send/verify flow |
| `StoreJsonLd.tsx` (seo/) | JSON-LD structured data |

### Hooks (`lib/hooks/`)

| Hook | Description |
|------|-------------|
| `useRazorpay.ts` | Dynamic Razorpay checkout.js loader |
| `useOrderSocket.ts` | Socket.IO live order status (`web-order:status-update`) |
| `useOrderPolling.ts` | Exponential backoff polling fallback (2s → 30s, max 20 attempts) |
| `useMenuSearch.ts` | Debounced full-text menu search |
| `useNfc.ts` | NDEFReader wrapper with 10s timeout |

### Utils + Push + Analytics (`lib/`)

| File | Description |
|------|-------------|
| `lib/utils/offlineQueue.ts` | IndexedDB order queue with background sync |
| `lib/utils/pushNotifications.ts` | VAPID push subscription helpers |
| `lib/utils/share.ts` | Web Share API + WhatsApp fallback |
| `lib/utils/storeType.ts` | Store-type-specific UI copy (8 types) |
| `lib/utils/currency.ts` | formatINR, formatINRCompact, roundUpRupees |
| `lib/utils/upi.ts` | UPI intent link builder, isUPIAvailable, openUPIApp |
| `lib/utils/cn.ts` | Classname utility |
| `lib/push/webPush.ts` | VAPID push subscription (uses authClient) |
| `lib/analytics/events.ts` | Fire-and-forget analytics, 13 event types, `useTrack()` hook |

---

## 7. State Management (Zustand)

| Store | File | Persisted | Contents |
|-------|------|-----------|---------|
| `authStore` | `lib/store/authStore.ts` | `rez-auth` cookie | `user`, `tokens`, `isLoggedIn` |
| `cartStore` | `lib/store/cartStore.ts` | `rez-cart` cookie | `storeSlug`, `items`, `groupOrderId`, `scheduledFor` |
| `uiStore` | `lib/store/uiStore.ts` | Memory only | `loginModal`, `toast` |

---

## 8. Auth Flow

1. Customer enters phone number → `POST /api/auth/send-otp`
2. OTP sent via SMS → customer enters 6-digit OTP
3. `POST /api/auth/verify-otp` → JWT stored in `rez-auth` cookie
4. On 401 → `authClient` interceptor silently calls `POST /api/auth/refresh`
5. Refresh fails → user logged out, redirected to login

---

## 9. Real-time Architecture

| Event | Namespace | Direction | Use Case |
|-------|----------|-----------|---------|
| `web-order:status-update` | Main | Server → Client | Live order status |
| `order:mark-preparing` | KDS (`/kds`) | Client → Server | Kitchen marks item preparing |
| `order:mark-ready` | KDS (`/kds`) | Client → Server | Kitchen marks item ready |
| `table:message` | Table (`/table`) | Client → Server | Customer sends table message |
| `table:message` | Main (staff:`slug`) | Server → Client | Staff receives table message |
| `payment:received` | Main | Server → Client | Payment Kiosk live feed |

### Fallback Polling

Socket disconnects → exponential backoff polling (2s → 30s, max 20 attempts)

---

## 10. Environment Variables

### Required (rez-now / Vercel)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend base URL (e.g. `https://api.rezapp.com`) |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO URL (e.g. `https://api.rezapp.com`) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay public key |
| `NEXT_PUBLIC_APP_URL` | App base URL (e.g. `https://now.rez.money`) |

### Optional (for deep links)

| Variable | Description |
|----------|-------------|
| `APPLE_TEAM_ID` | Apple Developer Team ID (for Universal Links) |
| `IOS_BUNDLE_ID` | iOS app bundle ID |
| `ANDROID_SHA256_CERT_FINGERPRINT` | SHA256 of signing cert (for App Links) |
| `ANDROID_PACKAGE_NAME` | Android app package name |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business account |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID |
| `WHATSAPP_API_KEY` | WhatsApp API key |

### Backend (rezbackend)

| Variable | Description |
|----------|-------------|
| `RAZORPAY_KEY_ID` | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay secret |
| `JWT_SECRET` | Consumer JWT secret |
| `JWT_MERCHANT_SECRET` | Merchant JWT secret |
| `REDIS_URL` | Redis connection URL |
| `MONGODB_URI` | MongoDB connection string |
| `INTERNAL_SERVICE_TOKEN` | Internal auth token (for `emit-payment`) |
| `CLAUDE_API_KEY` | Anthropic API (Phase R3 AI Chatbot) |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO URL |

---

## 11. Deployment

| | |
|--|--|
| Platform | Vercel |
| Region | bom1 (Mumbai) |
| Framework | Next.js 16 (App Router) |
| Edge | Vercel Edge Network |
| Build | `vercel.json` configured |
| Security | CSP headers, rate limiting, CSRF protection |

### Deployment Checklist

- [ ] `NEXT_PUBLIC_API_URL` set in Vercel env vars
- [ ] `NEXT_PUBLIC_SOCKET_URL` set in Vercel env vars
- [ ] `NEXT_PUBLIC_RAZORPAY_KEY_ID` set in Vercel env vars
- [ ] `NEXT_PUBLIC_APP_URL` set in Vercel env vars
- [ ] `vercel.json` security headers verified
- [ ] Apple App Links configured (optional)
- [ ] Android App Links configured (optional)
- [ ] WhatsApp API configured (optional)

---

## 12. Gaps & Known Issues

| Item | Severity | Notes |
|------|----------|-------|
| `history/page.tsx` uses `item.name` as itemId | Low | For reorder — works but fragile |
| `lib/push/webPush.ts` duplicate of `lib/utils/pushNotifications.ts` | Low | Same functionality, different HTTP client |
| `components/cart/CouponInput.tsx` duplicate of `checkout/CouponInput.tsx` | Low | Consolidate in future |
| `app/api/apple-app-site-association/route.ts` (well-known) | Low | Redundant — handled by Vercel rewrite |
| `assetlinks.json` requires prod env var | Low | `ANDROID_SHA256_CERT_FINGERPRINT` needed for App Links |
| Apple Universal Links require prod env vars | Low | `APPLE_TEAM_ID`, `IOS_BUNDLE_ID` needed |
| Payment webhook not wired to `emit-payment` | Medium | Manually add to Razorpay webhook handler |

---

## 13. Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| R1 | Payment Kiosk (live feed + "ding" + today total) | **BUILT** |
| R1 | `today-payments` API | **BUILT** |
| R1 | `emit-payment` Socket.IO event | **BUILT** |
| R1 | Wire webhook → `emit-payment` | TODO |
| R2 | Bill Builder | TODO |
| R3 | AI Chatbot (Claude + RAG) | TODO |
| R4 | Sub-2s payment settlement | TODO |
| R3 | AI chatbot for Non-REZ merchants | TODO |
