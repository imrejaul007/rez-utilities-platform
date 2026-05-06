# Hotel OTA Frontend Apps

This document covers all five frontend applications in the Hotel OTA monorepo (`Hotel OTA/apps/`). The `api/` app (hotel-ota-api backend) is documented separately in `hotel-ota-api.md`.

---

## 1. Overview

The Hotel OTA platform (branded **StayOwn**) is India's first hotel-owned OTA, operating with a 5% commission model. The five frontend apps each serve a distinct user type:

| App | Package Name | User | Port | Deploy |
|-----|-------------|------|------|--------|
| `ota-web` | `@hotel-ota/ota-web` | Travellers / end customers | 3003 | Vercel — `hotel-ota-ota-web-five.vercel.app` |
| `admin` | `@hotel-ota/admin` | OTA platform administrators | 3002 | Vercel — `hotel-ota-admin.vercel.app` |
| `hotel-panel` | `@hotel-ota/hotel-panel` | Individual hotel staff | 3001 | Vercel (hotel-panel deployment) |
| `corporate-panel` | `@hotel-ota/corporate-panel` | Corporate travel managers | 3004 | Vercel (corporate deployment) |
| `mobile` | `@hotel-ota/mobile` | Travellers (iOS + Android) | N/A | EAS (Expo Application Services) |

All five apps share a single backend: **hotel-ota-api**, running by default at `http://localhost:3000/v1`. Every web app reads `NEXT_PUBLIC_API_URL` to resolve the API base URL. The mobile app currently hardcodes `http://localhost:3000/v1` in `src/lib/api.ts`.

---

## 2. OTA Web — StayOwn Customer Booking Website

**Path:** `apps/ota-web/`
**Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, dayjs

### Purpose

The primary customer-facing application. Travellers search hotels, complete bookings, manage trips, spend OTA Coins and ReZ Coins, and register offline stays to earn retroactive rewards. The landing page markets StayOwn as "India's First Hotel-Owned OTA" with a 5% commission model, 6% cashback in coins, and T+1 hotel settlement.

### Pages (`src/app/`)

| Route | Description |
|-------|-------------|
| `/` | Landing page — hero section, OTP login modal, "How It Works", hotel partner CTA |
| `/home` | Authenticated home with featured hotels and search widget |
| `/search` | Hotel search results (city, check-in, check-out, rooms, guests) |
| `/hotel/[id]` | Hotel detail page — rooms, rates, amenities, reviews |
| `/checkout` | Booking summary + guest details entry |
| `/checkout/coins` | Apply OTA Coins / ReZ Coins to reduce payment amount |
| `/checkout/pay` | Payment confirmation step |
| `/booking/confirmed/[id]` | Post-booking confirmation with coins earned display |
| `/booking/[id]` | Booking detail view |
| `/booking/[id]/voucher` | Printable/shareable booking voucher |
| `/bookings` | All bookings list |
| `/trips` | My trips list |
| `/trips/[id]` | Trip detail |
| `/trips/[id]/cancel` | Trip cancellation flow |
| `/rewards` | Coin balance overview (OTA Coins + ReZ Coins) |
| `/rewards/history` | Full coin transaction history |
| `/rewards/register-stay` | Register an offline hotel stay to earn retroactive coins |
| `/saved` | Wishlist of saved hotels |
| `/wallet` | Wallet view — balance, transactions, coin type filter |
| `/bill-pay` | In-hotel bill payment (pay an in-stay bill via OTA platform) |
| `/bill-pay/confirmed` | Bill payment confirmation |
| `/profile` | User profile overview |
| `/profile/edit` | Edit name, email, avatar |
| `/profile/notifications` | Notification preferences |
| `/profile/privacy` | Privacy settings |
| `/profile/referral` | Referral code share page |
| `/profile/support` | Help / support page |

### Key Components

- `src/components/BottomNav.tsx` — Mobile-style bottom navigation bar used inside authenticated pages
- `src/components/SkeletonCard.tsx` — Loading skeleton for hotel cards

### Authentication

OTP-based (phone number). The landing page presents a slide-up modal handling the two-step OTP flow (send OTP → verify OTP). On success, `access_token` is stored in `localStorage` under the key `ota_token`; the user object is stored under `ota_user`.

### API Connection (`src/lib/api.ts`)

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';
```

Token is loaded from `localStorage` (`ota_token`) and sent as `Authorization: Bearer <token>`.

API groups: `authApi`, `hotelsApi`, `bookingsApi`, `walletApi`, `userApi`, `reviewsApi`, `wishlistApi`, `referralApi`, `billPayApi`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes (production) | Full URL to hotel-ota-api v1 base, e.g. `https://hotel-ota-api.onrender.com/v1` |
| `NEXT_PUBLIC_HOTEL_PANEL_URL` | Optional | URL of the hotel partner portal (shown in footer CTA) |

### Local Development

```bash
cd "Hotel OTA/apps/ota-web"
echo "NEXT_PUBLIC_API_URL=http://localhost:3000/v1" > .env.local
npm run dev        # http://localhost:3003
```

### Deployment

Vercel. Production URL: **`https://hotel-ota-ota-web-five.vercel.app`**

---

## 3. OTA Admin — Platform Administration Panel

**Path:** `apps/admin/`
**Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Recharts, dayjs

### Purpose

Internal tool for OTA operators. Provides full-platform visibility and control: KPI dashboards, hotel lifecycle management, loyalty coin rule configuration, ownership mining runs, financial settlements, stay registration review, and platform-wide configuration.

### Pages (`src/app/`)

| Route | Description |
|-------|-------------|
| `/` | Login — email + password (`POST /auth/admin/login`) |
| `/dashboard` | Main dashboard — GMV today/month, active bookings, coin liability, live activity feed, alerts |
| `/dashboard/hotels` | All hotels list with status filter (active / suspended / pending) |
| `/dashboard/hotels/onboarding` | Hotels pending onboarding approval — approve or reject with reason |
| `/dashboard/hotels/suspended` | Suspended hotels list |
| `/dashboard/bookings` | Platform-wide bookings with status filter and pagination |
| `/dashboard/users` | Customer list — search, suspend/unsuspend, manual coin balance adjustments |
| `/dashboard/admin-users` | Admin user accounts — create, update roles, deactivate |
| `/dashboard/earn-rules` | Loyalty coin earn rules — full CRUD |
| `/dashboard/burn-rules` | Loyalty coin burn/redemption rules — full CRUD |
| `/dashboard/coin-liability` | Total outstanding coin liability across all users |
| `/dashboard/settlements` | Pending hotel settlement batches — approve batch payout |
| `/dashboard/settlements/history` | Past settlement history with pagination |
| `/dashboard/stay-registrations` | Offline stay registration claims — approve with coin award amount or reject |
| `/dashboard/stay-reviews` | Guest review moderation |
| `/dashboard/mining` | Ownership mining — preview a period, trigger a mining run, view run status |
| `/dashboard/mining/disputes` | Mining dispute resolution — view and resolve hotel disputes |
| `/dashboard/rez` | ReZ token integration — sync status, webhook health, failure log, attribution log, retry |
| `/dashboard/config` | Platform configuration — earn rate, burn limits, supported cities |
| `/dashboard/bill-payments` | Offline bill payment history filterable by hotel |

### Key Components

- `src/components/AdminSidebar.tsx` — Left sidebar navigation linking all dashboard sections

### Authentication

Email + password. Token stored in `localStorage` as `admin_token`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes (production) | Full URL to hotel-ota-api v1 base |

### Local Development

```bash
cd "Hotel OTA/apps/admin"
echo "NEXT_PUBLIC_API_URL=http://localhost:3000/v1" > .env.local
npm run dev        # http://localhost:3002
```

### Deployment

Vercel. Production URL: **`https://hotel-ota-admin.vercel.app`**

---

## 4. Hotel Panel — Per-Property Management Dashboard

**Path:** `apps/hotel-panel/`
**Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Recharts, dayjs

### Purpose

Used by individual hotel staff to manage their property on StayOwn. Covers day-to-day booking operations (check-in/check-out), room inventory and rate management, revenue analytics, financial settlement tracking, and the ownership mining programme through which hotels earn equity in the OTA platform.

### Pages (`src/app/`)

| Route | Description |
|-------|-------------|
| `/` | Login — phone OTP (`/auth/hotel/send-otp` → `/auth/hotel/verify-otp`) |
| `/dashboard` | Property overview — today's check-ins, check-outs, occupancy, revenue KPIs |
| `/dashboard/bookings` | All bookings for this hotel — check-in and check-out action buttons |
| `/dashboard/calendar` | Availability calendar view |
| `/dashboard/inventory` | Room-type inventory manager — update available rooms and rates by date range |
| `/dashboard/analytics` | Revenue charts, ADR, occupancy rate (Recharts) |
| `/dashboard/settlement` | Financial settlements — history of payouts received |
| `/dashboard/settings` | Hotel profile settings |
| `/dashboard/ownership` | Ownership mining dashboard — units earned, projections |
| `/dashboard/ownership/history` | Monthly mining performance history |
| `/dashboard/ownership/vesting` | Vesting timeline for earned ownership units |
| `/dashboard/ownership/network` | Network standing relative to other hotels on the platform |
| `/dashboard/ownership/dispute` | Submit a dispute against a mining run result |

### Key Components

- `src/components/Sidebar.tsx` — Left sidebar navigation for all hotel dashboard sections

### Authentication

Phone OTP. Token stored in `localStorage` as `hotel_token`. The hotel's `hotel_id` is stored separately under `localStorage` key `hotel_id`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes (production) | Full URL to hotel-ota-api v1 base |

### Local Development

```bash
cd "Hotel OTA/apps/hotel-panel"
echo "NEXT_PUBLIC_API_URL=http://localhost:3000/v1" > .env.local
npm run dev        # http://localhost:3001
```

### Deployment

Vercel. Set `NEXT_PUBLIC_API_URL` in Vercel project settings.

---

## 5. Corporate Panel — Business Travel Booking Portal

**Path:** `apps/corporate-panel/`
**Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS

### Purpose

A portal for corporate travel managers to book hotels on behalf of employees and manage travel policies.

### Development Status

**Work in progress.** The login screen is present but auth is not yet wired up. Dashboard sections for bookings and employee management exist as directory placeholders. The login page shows: "Corporate login coming soon. Use admin panel to manage corporate accounts."

### Pages (`src/app/`)

| Route | Description |
|-------|-------------|
| `/` | Corporate login — work email + password form (not yet implemented) |
| `/dashboard` | Corporate dashboard (scaffolded placeholder) |
| `/dashboard/bookings` | Corporate booking management (scaffolded placeholder) |
| `/dashboard/employees` | Employee directory for travel authorisation (scaffolded placeholder) |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes (production) | Full URL to hotel-ota-api v1 base |

### Local Development

```bash
cd "Hotel OTA/apps/corporate-panel"
npm run dev        # http://localhost:3004
```

---

## 6. OTA Mobile — React Native App (iOS + Android)

**Path:** `apps/mobile/`
**Stack:** Expo SDK 52, React Native 0.76, React Navigation v7 (native-stack + bottom-tabs), AsyncStorage, TypeScript, dayjs

### App Configuration

- App name: `Hotel OTA`
- Expo slug: `hotel-ota`
- Version: `1.0.0`
- Deep link scheme: `hotelota`
- iOS bundle identifier: `com.hotelota.app`
- Android package: `com.hotelota.app`

### Navigation Structure

#### Auth Stack (pre-login)

| Screen | File | Description |
|--------|------|-------------|
| `Splash` | `SplashScreen.tsx` | App splash — bootstraps stored tokens |
| `Onboarding` | `OnboardingScreen.tsx` | First-run onboarding slides |
| `PhoneInput` | `PhoneInputScreen.tsx` | Phone number entry |
| `OTPVerify` | `OTPVerifyScreen.tsx` | OTP entry and verification |
| `ProfileSetup` | `ProfileSetupScreen.tsx` | New user profile creation |

#### Main Bottom Tabs

| Tab | Screen | Description |
|-----|--------|-------------|
| Home | `HomeScreen` | Featured hotels, quick search |
| Search | `SearchScreen` | Full hotel search with filters |
| Trips | `BookingsScreen` | My bookings list |
| Rewards | `RewardsScreen` | Coin balance and earn summary |
| Profile | `ProfileScreen` | User profile and settings |

#### Hotel Booking Flow (Stack)

| Screen | Description |
|--------|-------------|
| `HotelDetailScreen` | Hotel info, room types, photos, reviews |
| `RoomSelectionScreen` | Room type and rate selector |
| `BookingReviewScreen` | Booking summary before payment |
| `CoinApplyScreen` | Apply OTA Coins or ReZ Coins for discount |
| `PaymentScreen` | Payment gateway step |
| `BookingConfirmedScreen` | Success + coins earned |

#### Booking Management

| Screen | Description |
|--------|-------------|
| `BookingDetailScreen` | Full booking detail view |
| `VoucherScreen` | Shareable booking voucher |
| `CancelBookingScreen` | Cancellation reason + confirmation |

#### Rewards

| Screen | Description |
|--------|-------------|
| `CoinHistoryScreen` | Paginated coin transaction log |
| `StayRegistrationScreen` | Register an offline hotel stay |

#### Profile / Utility

| Screen | Description |
|--------|-------------|
| `EditProfileScreen` | Edit profile name, email, avatar |
| `NotificationsScreen` | Notification history |
| `SupportScreen` | Help and support contact |
| `HotelBillPayScreen` | In-hotel bill payment (placeholder) |
| `BillPayConfirmedScreen` | Bill pay confirmation (placeholder) |

### Global State (`src/store/index.ts`)

React Context + `useReducer` (`AppProvider` / `useAppState`). Manages:
- `user` — authenticated user object
- `token` — JWT access token
- `wallet` — `{ otaCoinBalancePaise, rezCoinBalancePaise }`
- `search` — `{ city, checkin, checkout, rooms, guests }` (default city: Bangalore)

### Key Components

| File | Description |
|------|-------------|
| `HotelCard.tsx` | Hotel listing card — name, rating, price per night |
| `SearchModal.tsx` | Full-screen search overlay with city/date/guest pickers |
| `FiltersModal.tsx` | Filter bottom sheet — price range, star rating, amenities |
| `BottomSheet.tsx` | Generic reusable slide-up bottom sheet |
| `SkeletonLoader.tsx` | Loading skeleton for list and detail screens |
| `StarRating.tsx` | Reusable star rating component |
| `RatingModal.tsx` | Submit a hotel review |
| `EmptyState.tsx` | Empty list placeholder |

### API Connection

The API base URL is **hardcoded** in `src/lib/api.ts`:

```typescript
const API_BASE = 'http://localhost:3000/v1';
```

**Action required for production builds:** Update `API_BASE` to the production URL, or wire up Expo's `extra` field in `app.json` to inject it at build time.

Tokens are persisted to `AsyncStorage` (keys: `ota_access_token`, `ota_refresh_token`, `ota_user_data`).

### Local Development

```bash
cd "Hotel OTA/apps/mobile"
npm run start       # starts Metro bundler + Expo dev server
npm run ios         # iOS simulator
npm run android     # Android emulator
```

When testing on a physical device, replace `localhost` in `API_BASE` with your dev machine's LAN IP (e.g. `http://192.168.1.x:3000/v1`).

### EAS Build & Deployment

```bash
npm install -g eas-cli
eas login
eas build --platform all       # builds iOS + Android
eas submit                     # submit to App Store + Play Store
eas update --branch production --message "description"   # OTA JS update
```

---

## 7. Shared Backend: hotel-ota-api

All five apps call the same backend. The canonical env var:

```
NEXT_PUBLIC_API_URL=https://hotel-ota-api.onrender.com/v1
```

### Auth Strategy Per App

| App | Method | Token Storage | Key |
|-----|--------|---------------|-----|
| ota-web | Phone OTP | `localStorage` | `ota_token` |
| admin | Email + Password | `localStorage` | `admin_token` |
| hotel-panel | Phone OTP | `localStorage` | `hotel_token` |
| corporate-panel | Email + Password (pending) | TBD | TBD |
| mobile | Phone OTP | `AsyncStorage` | `ota_access_token` |

All apps send `Authorization: Bearer <token>` on every API request.

---

## 8. Local Development — All Apps at Once

### Prerequisites

- Node.js 18+, npm
- hotel-ota-api running on port 3000 (see [hotel-ota-api.md](hotel-ota-api.md))
- For mobile: Expo CLI + Xcode or Android Studio

### Port Map

| Service | Port |
|---------|------|
| hotel-ota-api (backend) | 3000 |
| hotel-panel | 3001 |
| admin | 3002 |
| ota-web | 3003 |
| corporate-panel | 3004 |

### Start All Web Apps

```bash
# Each in a separate terminal from "Hotel OTA/apps/"
cd ota-web && npm run dev       # :3003
cd admin && npm run dev         # :3002
cd hotel-panel && npm run dev   # :3001
cd corporate-panel && npm run dev # :3004
cd mobile && npm run start      # Expo Metro
```

Each Next.js app needs a `.env.local` with:
```
NEXT_PUBLIC_API_URL=http://localhost:3000/v1
```
