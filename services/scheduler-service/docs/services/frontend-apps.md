# REZ Frontend Apps

This document covers all four REZ frontend applications: the consumer mobile app, the merchant mobile app, the admin app, and the web menu.

---

## 1. REZ Consumer App (nuqta-master)

**Path:** `rezapp/nuqta-master/`
**Target user:** End consumers — people browsing stores, earning REZ coins, making purchases
**Package name:** `rez-consumer`

### Purpose

The primary consumer-facing mobile application for the REZ platform. Users browse local stores, earn loyalty coins (REZ coins) through purchases and QR scans, manage their wallet, book travel (flights, hotels, trains), play games to earn, and manage their profile.

### Tech Stack

| Component | Library / Version |
|-----------|------------------|
| Framework | React Native 0.79.6 |
| Meta-framework | Expo ~53.0.26 |
| Navigation | Expo Router ~5.1.11 (file-based) |
| State management | Zustand ^5.0.11 |
| Server state | TanStack React Query ^5.90.21 |
| Real-time | Socket.io-client ^4.8.1 |
| Payments | react-native-razorpay ^2.3.0 |
| Maps | react-native-maps ~1.20.1 |
| QR | react-native-qrcode-svg ^6.3.15, jsqr ^1.4.0 |
| Analytics | @react-native-firebase/analytics ^21.6.1 |
| Error tracking | @sentry/react-native ~6.14.0 |
| Storage | expo-secure-store, AsyncStorage |
| TypeScript | ~5.8.3 |

### Key Screens and Modules

**Tab Navigation** (bottom bar)
- Home — featured stores, quick actions, category sections, partner status card
- Play — games and earn from play
- Earn — earning opportunities, social media tasks

**Home Screen** (`app/(tabs)/index.tsx`)
- Purple gradient header with location, coin balance, cart icon, profile
- Search bar with real-time search
- Partner Status Card showing user loyalty tier
- Quick Actions: Voucher, Wallet, Offers, Store shortcuts
- Category sections: "Going Out" and "Home Delivery" with horizontal scrolling
- Dynamic horizontal scroll sections: Events, Just for You, etc.

**Store / Shopping**
- `StorePage.tsx` — store listing with sections (products, sections, pay bill)
- `CartPage.tsx` — cart management with coupon/promo code support
- `CheckoutPage` / `OrderConfirmPage` — order placement with Razorpay
- `OrderHistoryPage` — order history with tracking
- `ReceiptPage` — order receipt

**Profile and Account**
- Address management (CRUD + default)
- Payment methods (cards, bank accounts, UPI)
- User settings (notifications, privacy, security)
- Achievements and badges
- Activity feed (orders, wallet events, social tasks)

**Wallet**
- REZ coin balance
- Transaction history
- Top-up and transfer

**Travel Booking**
- Flights — search, detail, booking flow
- Hotels — search, detail with OTA integration, booking
- Trains — search, seat selection, booking

**Play and Earn**
- Games section for earning coins
- Social media tasks (earn from Instagram, etc.)
- Online vouchers

### API Endpoints Called

The app uses `apiClient.ts` (axios with auth interceptor) to call the REZ backend:

| Module | Endpoint prefix |
|--------|----------------|
| Auth (login, register, OTP) | `/api/auth/...` |
| Profile / user settings | `/api/addresses`, `/api/payment-methods`, `/api/user-settings` |
| Achievements | `/api/achievements` |
| Activity feed | `/api/activities` |
| Products / catalog | `/api/catalog/...` |
| Search | `/api/search/...` |
| Cart and orders | `/api/orders/...` |
| Wallet | `/api/wallet/...` |
| Gamification (coins, tiers) | `/api/gamification/...` |
| Analytics (events) | `/api/analytics/...` |
| Flights / Hotels / Trains | `/api/...` (via monolith or OTA integration) |

All requests go through the API Gateway at `https://rez-api-gateway.onrender.com`.

### Authentication Flow

1. User enters phone/email → `POST /api/auth/send-otp` or password login
2. Token (JWT access + refresh) stored in `expo-secure-store`
3. `apiClient.ts` interceptor attaches `Authorization: Bearer <token>` to every request
4. On 401, interceptor automatically attempts token refresh
5. On refresh failure, user is redirected to login

### State Management

- **Zustand stores** for local UI state (cart, REZ coins display)
- **TanStack React Query** for server state (products, orders, wallet balance, achievements)
- **AuthContext** for current user session
- **ProfileContext** maps backend user object to frontend `User` shape
- **CartContext** with AsyncStorage persistence for offline-first cart

### Socket.io Usage

Real-time features (order status updates, notifications) use Socket.io. Connection is established after authentication. Key events: `order:updated`, `notification:new`.

### Environment Variables

```env
EXPO_PUBLIC_API_URL=https://rez-api-gateway.onrender.com
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

Firebase credentials are via `google-services.json` (Android) and `GoogleService-Info.plist` (iOS), guarded in `app.config.js`.

### Build and Deploy

**Local development:**
```bash
cd rezapp/nuqta-master
npm install
npx expo start              # Expo Dev Client on connected device
npx expo start --ios        # iOS simulator
npx expo start --android    # Android emulator
```

**EAS Build (production):**
```bash
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

**EAS Submit (app stores):**
```bash
npx eas submit --platform ios
npx eas submit --platform android
```

**Web export:**
```bash
npm run build:render        # expo export --platform web
npm run serve:render        # serve dist/ on $PORT
```

### Testing

```bash
npm test                    # Jest unit tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
npm run test:e2e            # Detox E2E (iOS simulator)
npm run test:e2e:android    # Detox E2E (Android emulator)
```

---

## 2. REZ Merchant App (rez-merchant-master)

**Path:** `rezmerchant/rez-merchant-master/`
**Target user:** Merchants — store owners and operators managing their REZ presence

### Purpose

The merchant-side React Native application for product management, order processing, cashback administration, team management, analytics, and merchant onboarding. Designed to complement the consumer app: when a consumer places an order, the merchant sees it here in real time.

### Tech Stack

| Component | Library / Version |
|-----------|------------------|
| Framework | React Native / Expo |
| Navigation | Expo Router (file-based) |
| TypeScript | ~5.8.3 |
| Server state | TanStack React Query |
| Real-time | Socket.io (WebSocket for order updates) |
| Auth | JWT with AsyncStorage |
| Styling | Expo Linear Gradient, purple theme |
| Charts | Custom analytics chart components |

### Key Screens and Modules

**Authentication**
- Login screen with email/password
- Register screen for new merchants
- JWT token management with secure storage
- Session persistence across app restarts

**Dashboard** (`/dashboard`)
- Welcome section with merchant info
- Metrics cards: revenue, orders, cashback
- Quick action buttons
- Recent activity feed

**Product Management** (`/products`)
- Product list with search and filter
- Create/edit product forms with image upload
- Inventory tracking and stock alerts
- Category management
- Barcode scanning support

**Order Management** (`/orders`)
- Real-time order queue with Socket.io
- Order status workflow: pending → confirmed → preparing → ready → delivered
- Batch operations
- Order detail view

**Cashback Administration** (`/cashback`)
- Cashback requests list with status filters
- Approve / reject individual or bulk requests
- Fraud detection indicators
- Analytics on cashback spend

**Analytics Dashboard**
Reusable chart components at `components/analytics/`:
- `LineChart` — revenue over time with forecast and confidence intervals
- `BarChart` — vertical/horizontal, grouped or stacked
- `ForecastChart` — historical + predicted data
- `SegmentPieChart` — category breakdown (pie or donut)
- `MetricCard` — single KPI with trend indicator
- `CustomerMetricCard` — CLV, retention, churn, satisfaction
- `StockoutAlertCard` — products at risk of stockout
- `TrendIndicator` — percentage change arrow
- `DateRangeSelector` — preset and custom date pickers
- `ExportButton` — export to CSV, Excel, PDF

**Team Management** (`components/team/`)
- Team member list, roles, permissions
- Invite and remove team members

**Merchant Onboarding** (`components/onboarding/`)
5-step wizard:
1. Business information (name, type, category, owner details, social links)
2. Store details (address, delivery options)
3. Bank details (account, IFSC, PAN, GST, Aadhar)
4. Document upload (PAN card, GST certificate — via camera or gallery)
5. Review and submit

Onboarding components: `WizardStepIndicator`, `BusinessInfoForm`, `StoreDetailsForm`, `BankDetailsForm`, `DocumentUploader`, `DocumentCard`, `ValidationErrorDisplay`, `ProgressTracker`, `AutoSaveIndicator`.

**Notifications** (`components/notifications/`)
- Push notification handling
- In-app notification center

**Audit** (`components/audit/`)
- Action audit trail for compliance

### API Endpoints Called

Query and mutation hooks in `hooks/queries/` wrap all API calls:

| Hook / Purpose | Endpoint |
|----------------|----------|
| `useDashboard()` | `/api/merchant/dashboard` |
| `useProducts()` | `/api/merchant/products` |
| `useOrders()`, `usePendingOrders()` | `/api/merchant/orders` |
| `useCashback()`, `usePendingCashback()` | `/api/merchant/cashback` |
| `useCreateProductMutation()` | `POST /api/merchant/products` |
| `useUpdateOrderMutation()` | `PUT /api/merchant/orders/:id` |
| `useApproveCashbackMutation()` | `POST /api/merchant/cashback/:id/approve` |
| Auth | `POST /api/auth/login`, `GET /api/auth/me` |

### Authentication Flow

1. Merchant enters email and password → `POST /api/auth/login`
2. JWT stored in AsyncStorage
3. Auth header attached to all requests via axios interceptor
4. `AuthContext` manages current session state
5. `MerchantContext` holds merchant profile and store data

### React Query Cache Durations

| Data | Stale Time | Cache Time |
|------|-----------|------------|
| Dashboard | 5 min | 10 min |
| Products | 5 min | 15 min |
| Orders | 2 min | 10 min |
| Cashback | 2 min | 10 min |
| Analytics | 15 min | 30 min |

### Environment Variables

```env
EXPO_PUBLIC_API_URL=https://rez-api-gateway.onrender.com
MONGO_URI=               # for local backend only
JWT_SECRET=              # for local backend only
```

### Build and Deploy

```bash
cd rezmerchant/rez-merchant-master
npm install
npx expo start           # development
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

---

## 3. REZ Admin App (rez-admin-main)

**Path:** `rezadmin/rez-admin-main/`
**Target user:** REZ internal team — operations, customer support, finance, platform admins

### Purpose

The internal administration application for the REZ platform. Admins manage users, merchants, orders, payouts, platform configuration, moderation, and operational monitoring from a unified dashboard.

### Tech Stack

The admin app is a React Native / Expo application (same stack as merchant app), matching the purple REZ branding. It targets web (browser) and potentially tablet, given the admin use case.

Key dependencies mirror the merchant app:
- Expo Router file-based navigation
- TanStack React Query for server state
- Expo Linear Gradient for branding
- TypeScript

### Key Screens and Modules

**User Management**
- User list with search and filter
- User detail view (profile, wallet balance, order history, coin history)
- Account actions (suspend, verify, delete)

**Merchant Management**
- Merchant list and onboarding queue
- Merchant approval / rejection workflow
- Merchant performance metrics
- Store configuration management

**Order Management**
- Platform-wide order list with status filter
- Order detail with full timeline
- Manual intervention tools (refund, cancel)

**Wallet and Finance**
- Coin issuance and revocation
- Payout management
- Transaction history across all users
- Finance reports

**Moderation**
- Content review (merchant listings, reviews)
- Dispute resolution

**Analytics and Monitoring**
- Platform-level KPIs
- MAU / DAU metrics
- Revenue and GMV tracking
- Error rates (integrated with Sentry or similar)

**Platform Configuration**
- Feature flags
- Promotional campaign management
- Notification templates

### API Endpoints Called

Admin routes on the monolith and microservices — all prefixed `/api/admin/`:

```
GET  /api/admin/users
GET  /api/admin/users/:id
PUT  /api/admin/users/:id
GET  /api/admin/merchants
POST /api/admin/merchants/:id/approve
POST /api/admin/merchants/:id/reject
GET  /api/admin/orders
POST /api/admin/orders/:id/refund
GET  /api/admin/wallet/transactions
POST /api/admin/wallet/issue-coins
GET  /api/admin/analytics/platform
```

The gateway routes `/api/admin/` to the monolith with stricter rate limiting (`merchant_limit` zone, `burst=30`) and no caching.

### Authentication Flow

Admin authentication uses the same JWT flow as other apps but with an `admin` role claim. Role-based access control (RBAC) enforces what each admin level can access.

### Environment Variables

```env
EXPO_PUBLIC_API_URL=https://rez-api-gateway.onrender.com
```

### Build and Deploy

```bash
cd rezadmin/rez-admin-main
npm install
npx expo start --web      # primary target is web
npx eas build --platform web
```

Web builds deploy to Vercel or Render.

---

## 4. REZ Web Menu (rez-web-menu)

**Path:** `rez-web-menu/`
**Target user:** Dine-in and table-service customers — scanning a table QR code to browse the menu and order
**Live:** Deployed as part of the `rez-web-menu` Vite workspace package

### Purpose

A mobile-optimised Progressive Web App (PWA) that customers access by scanning a QR code at a restaurant or merchant table. No app download required. Customers browse the menu, add items to cart, checkout, and track their order from the browser.

### Tech Stack

| Component | Details |
|-----------|---------|
| Framework | React (Vite, SPA) |
| Build tool | Vite with PWA plugin |
| State | Zustand stores (`cartStore`, `rezCoinsStore`, `state`) |
| Analytics | `useAnalytics` custom hook |
| Styling | Tailwind CSS or CSS modules |
| PWA | Service worker (`dist/sw.js`), manifest (`dist/manifest.json`) |
| Workspace | Part of `rez-workspace` npm workspaces monorepo |

The `rez-web-menu` is a workspace package inside the same monorepo as the backend microservices. It shares the `rez-shared` package for types and utilities.

### Key Pages / Screens

From the built dist assets, the app has these pages:

| Page | Asset | Description |
|------|-------|-------------|
| StoreFront | `StoreFrontPage` | Landing page — merchant/restaurant branding and menu categories |
| Menu | `MenuPage` | Full menu with item listing, filters, veg/non-veg indicator |
| Cart | `CartPage` | Cart management with quantity selector |
| Checkout | `CheckoutPage` | Order summary, REZ coins redemption, payment |
| Order Confirm | `OrderConfirmPage` | Order placed confirmation with reference number |
| Order History | `OrderHistoryPage` | Past orders for the session |
| Receipt | `ReceiptPage` | Order receipt view |
| Request Bill | `RequestBillPage` | Request the physical bill at the table |
| Not Found | `NotFoundPage` | 404 fallback |

**Shared components:**
- `BottomNav` — persistent bottom navigation bar
- `QuantitySelector` — +/- quantity control
- `RezCoinsBanner` — shows applicable REZ coin discount
- `VegIcon` — green dot veg/non-veg indicator
- `Spinner` — loading state

### REZ Coins Integration

The `RezCoinsBanner` component and `rezCoinsStore` (Zustand) allow customers to redeem their REZ coin balance at checkout. The app calls the REZ backend to validate and apply the coin discount before processing payment.

### API Endpoints Called

```
GET  /api/catalog/menu/:storeId          — fetch menu for the scanned table/store
POST /api/orders                         — place order
GET  /api/orders/:id                     — order status polling
POST /api/wallet/redeem                  — redeem REZ coins at checkout
GET  /api/gamification/coins/:userId     — fetch coin balance for logged-in user
```

### PWA Features

- Installable on home screen via `manifest.json`
- Service worker (`sw.js`) for offline shell caching
- Optimized for mobile viewport (no desktop layout needed)

### Environment Variables

```env
VITE_API_URL=https://rez-api-gateway.onrender.com
VITE_STORE_ID=                  # optionally baked in per-merchant deployment
```

### Build and Deploy

**Development:**
```bash
cd rez-web-menu
npm install
npm run dev             # Vite dev server
```

**Production build:**
```bash
npm run build           # outputs to dist/
```

**Deploy:** Static assets from `dist/` deploy to Vercel or any CDN. The app is URL-parameterised by `storeId` — the QR code on each table encodes the store/table identifier as a URL parameter (e.g., `https://menu.rez.money?store=xyz&table=3`).

---

## Cross-App Architecture Notes

### Shared Package

`rez-web-menu/rez-shared/` and `@imrejaul007/rez-shared` (published to GitHub Packages) provide shared TypeScript types, API response interfaces, and utilities across all frontend apps. The consumer app imports `@imrejaul007/rez-shared` as a dependency.

### Service Core Package

`rez-web-menu/packages/rez-service-core/` (`@imrejaul007/rez-service-core`) provides shared infrastructure for microservices: Redis/BullMQ setup, MongoDB connection, Winston logger, and health server. This is a backend package; it's in the same repo for monorepo convenience.

### All Apps Route Through the Gateway

Every frontend app targets `https://rez-api-gateway.onrender.com` as its API base URL. The gateway handles routing, CORS, rate limiting, caching, and trace ID propagation transparently.

### Authentication

All four apps use JWT bearer tokens. The consumer and merchant apps store tokens in `expo-secure-store` (mobile) or `AsyncStorage`. The web menu can optionally authenticate a REZ user (for coin redemption) via a lightweight login flow or skip auth for anonymous browsing.

### CORS Origins

All `*.rez.money` subdomains and `*.vercel.app` deployments are allowed by the gateway CORS policy. Domain assignments:

| App | Expected origin |
|-----|----------------|
| Consumer App (web) | `rez.money` |
| Web Menu | `menu.rez.money` |
| Admin App | `admin.rez.money` |
| Merchant App | `merchant.rez.money` |
| AdBazaar | `ad-bazaar.vercel.app` |
