# Rendez — Service Documentation

**Repo:** `github.com/imrejaul007/Rendez`  
**Backend URL (production):** TBD (deploy to Render)  
**Admin URL (production):** TBD (deploy to Vercel)  
**Tagged release:** `v1.0.0`  
**Type:** Standalone REZ partner app — separate repo, separate DB, separate deploy

---

## 1. Purpose

Rendez is a social/dating app that uses REZ as its financial backbone. Users authenticate via their REZ account, send and receive gifts using REZ wallet coins and merchant vouchers, and earn REZ coins when they complete verified real-world meetups at REZ-registered merchants.

Rendez does **not** own any financial logic. It calls REZ via a dedicated partner API (`/partner/v1/...`) for all wallet, coin, and voucher operations. REZ never leaks its internals through Rendez — all REZ client calls are normalised via a shared `rezClient.ts` interceptor that converts REZ error codes to safe user-facing messages.

**REZ integration value:**
- Every gift = wallet debit on REZ → drives coin spend
- Every meetup at a REZ merchant = coin earn on REZ → drives foot traffic and wallet adoption
- Auth is REZ-native: Rendez has no OTP, no user DB — REZ is the identity provider

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + TypeScript, Express |
| Database | PostgreSQL (Prisma ORM) |
| Cache / Queue | Redis + BullMQ |
| Auth | REZ JWT (validated by middleware) → Rendez JWT issued on verify |
| Real-time | Socket.io on shared HTTP port, JWT auth on WS handshake |
| Push notifications | Firebase FCM via Expo notifications |
| File uploads | Cloudinary |
| Monitoring | Sentry (optional) |
| App | React Native (Expo) — iOS + Android + Web |
| Admin | Next.js |

---

## 3. Architecture

### Relationship to REZ

```
Rendez App
    │
    ▼
Rendez Backend ──► REZ Partner API (/partner/v1/*)
    │                   │
    │                   ├── rezAuthClient.ts    → validate REZ JWT, link rezUserId
    │                   ├── rezWalletClient.ts  → get balance, debit coins for gifts
    │                   ├── rezGiftClient.ts    → issue merchant voucher gifts
    │                   ├── rezMerchantClient.ts → nearby merchants, booking
    │                   └── rezRewardClient.ts  → credit coins on meetup completion
    │
    ◄── REZ Webhooks ──── rez-backend (POST /api/v1/webhooks/...)
         ├── /gift-redeemed       → update Gift.status = REDEEMED
         ├── /gift-expired        → update Gift.status = EXPIRED (REZ already refunded)
         └── /payment-completed   → trigger meetup reward validation
```

All `rezClient.*` calls go through a shared axios instance with `x-partner-key` auth and an error-normalisation interceptor. REZ 402/422 errors surface safely; REZ 5xx becomes a generic 502.

### Auth flow

```
User has REZ account (JWT from rez-auth-service)
    │
    POST /api/v1/auth/verify   { Authorization: Bearer <rez_token> }
    │
    Rendez backend validates JWT via REZ partner API
    ├── If profile exists → return Rendez JWT + profile summary
    └── If no profile     → return Rendez JWT + hasProfile: false → app routes to setup
```

Rendez tokens are short-lived JWTs signed with Rendez's own `JWT_SECRET`. They carry `{ id: rendezProfileId, rezUserId }`. All subsequent calls use the Rendez token, not the REZ token.

### Messaging state machine

```
MATCHED
  └─► FREE_MSG_SENT    (first free message sent by either user)
        └─► AWAITING_REPLY  (waiting for the other side to respond)
              └─► LOCKED        (if no reply — next message requires gift)
              └─► OPEN          (reply received — free messaging unlocked)
```

Gift flow unlocks messaging:
```
LOCKED → GIFT_PENDING → GIFT_UNLOCKED → OPEN
```

---

## 4. Route Reference

All routes prefixed `/api/v1/`. All authenticated routes require `Authorization: Bearer <rendez_token>`.

### Auth (`src/routes/auth.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/verify` | REZ JWT | Validate REZ token, issue Rendez JWT, create or return profile |

### Profile (`src/routes/profile.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/profile` | Rendez JWT | Create profile (name, age, gender, intent, city, photos) |
| GET | `/profile/me` | Rendez JWT | Get own profile |
| PUT | `/profile` | Rendez JWT | Update profile fields |
| POST | `/profile/photos` | Rendez JWT | Upload photos (Cloudinary) |
| DELETE | `/profile/photos/:index` | Rendez JWT | Remove a photo |

### Discover (`src/routes/discover.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/discover` | Rendez JWT | Get swipe deck (city-filtered, intent-filtered, blocked excluded) |

### Match (`src/routes/match.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/match/like` | Rendez JWT | Like a profile — auto-matches on mutual like |
| POST | `/match/pass` | Rendez JWT | Pass on a profile |
| GET | `/match` | Rendez JWT | Get all active matches |
| DELETE | `/match/:matchId` | Rendez JWT | Unmatch |

### Messaging (`src/routes/messaging.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/messaging/:matchId/messages` | Rendez JWT | Get message history |
| POST | `/messaging/:matchId/messages` | Rendez JWT | Send a message (respects state machine — 402 if LOCKED) |
| POST | `/messaging/:matchId/typing` | Rendez JWT | Emit typing indicator via Socket.io |

### Gift (`src/routes/gift.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/gift/send` | Rendez JWT | Send a coin gift or merchant voucher to a match |
| POST | `/gift/:giftId/accept` | Rendez JWT | Accept gift (calls REZ to transfer coins or activate voucher) |
| POST | `/gift/:giftId/reject` | Rendez JWT | Reject gift (calls REZ to refund sender) |
| GET | `/gift/received` | Rendez JWT | List received gifts (alias: `GET /wallet/gifts`) |
| GET | `/gift/sent` | Rendez JWT | List sent gifts (alias: `GET /wallet/gifts/sent`) |

**Gift pricing:** Progressive per pair — 1× base cost for first gift, 1.5× second, 2× third+. 5 gifts/day cap per user. 1 gift per pair per 5 minutes (Redis lock).

### Wallet (`src/routes/wallet.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/wallet/balance` | Rendez JWT | Proxy to REZ wallet — returns REZ coin balance |
| GET | `/wallet/gifts` | Rendez JWT | Received gifts list |
| GET | `/wallet/gifts/sent` | Rendez JWT | Sent gifts list |

### Meetup (`src/routes/meetup.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/meetup/nearby` | Rendez JWT | Nearby REZ merchants (lat/lng required) |
| POST | `/meetup/suggest` | Rendez JWT | AI-suggested merchants for a match |
| POST | `/meetup/book` | Rendez JWT | Create meetup booking at REZ merchant |
| POST | `/meetup/:matchId/checkin` | Rendez JWT | QR scan to validate meetup (both users must scan within 30 min) |
| GET | `/meetup/:matchId` | Rendez JWT | Get meetup status for a match |

**Validation:** QR-only (no GPS). Redis `NX` lock prevents duplicate reward on double-scan. Both users must check in within 30 minutes. On completion → calls `rezRewardClient` to credit REZ coins to both users.

### Safety (`src/routes/safety.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/safety/report` | Rendez JWT | Report a profile (harassment, fake, inappropriate) |
| POST | `/safety/block` | Rendez JWT | Block a profile |
| DELETE | `/safety/block/:profileId` | Rendez JWT | Unblock |
| GET | `/safety/blocked` | Rendez JWT | List blocked profiles |

### Devices (`src/routes/devices.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/devices/token` | Rendez JWT | Register FCM push token |
| DELETE | `/devices/token` | Rendez JWT | Remove FCM push token |

### Upload (`src/routes/upload.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/upload/photo` | Rendez JWT | Upload photo to Cloudinary, return URL |

### Webhooks (`src/routes/webhooks/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks/rez/gift-redeemed` | HMAC (`REZ_WEBHOOK_SECRET`) | Gift voucher redeemed at merchant → update Gift status |
| POST | `/webhooks/rez/gift-expired` | HMAC | Gift expired (REZ already refunded) → update Gift status |
| POST | `/webhooks/rez/payment-completed` | HMAC | REZ booking completed → validate and trigger meetup coin reward |

### Admin (`src/routes/admin.ts`)

All admin routes require `Authorization: Bearer <ADMIN_API_KEY>`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | List all profiles (paginated) |
| GET | `/admin/users/:id` | Get profile details |
| PUT | `/admin/users/:id/suspend` | Suspend a profile |
| PUT | `/admin/users/:id/reinstate` | Reinstate a suspended profile |
| GET | `/admin/reports` | List open reports |
| PUT | `/admin/reports/:id/resolve` | Resolve a report (action: warn/suspend/dismiss) |
| GET | `/admin/stats` | Platform stats (MAU, matches, gifts, meetups) |

---

## 5. Data Models (PostgreSQL via Prisma)

| Table | Key Fields | Description |
|-------|-----------|-------------|
| `profiles` | `id`, `rezUserId`, `phone`, `gender`, `interestedIn`, `intent`, `city`, `lat/lng`, `profileScore`, `rezSpendScore` | User profile. `rezUserId` is the foreign key linking to REZ backend. |
| `likes` | `fromUserId`, `toUserId` | Swipe right. Unique constraint prevents duplicates. |
| `matches` | `user1Id`, `user2Id`, `status`, `intentType` | Created when both users like each other. |
| `message_states` | `matchId`, `state` (enum), `lastMessageAt` | Tracks conversation state machine per match. |
| `messages` | `matchId`, `senderId`, `content`, `readAt` | Chat messages. |
| `gifts` | `senderId`, `receiverId`, `matchId`, `giftType` (COIN/MERCHANT_VOUCHER), `coinAmount`, `rezVoucherId`, `status` | Gifts. `rezVoucherId` links to REZ voucher. |
| `meetup_checkins` | `profileId`, `matchId`, `merchantId`, `qrToken`, `checkedInAt` | QR check-in records. Both users must check in within 30 min. |
| `rewards` | `matchId`, `profileId`, `bookingId`, `rezCoinAmount`, `status` | REZ coin rewards issued on meetup completion. |
| `reports` | `reporterId`, `reportedId`, `reason`, `status` | Safety reports. |
| `blocks` | `blockerId`, `blockedId` | Blocked pairs. |
| `fraud_flags` | `profileId`, `reason`, `score` | Fraud signals for admin review. |

---

## 6. REZ Integration Clients

All located at `src/integrations/rez/`. All use the shared `rezClient.ts` (axios with `x-partner-key` header + error normaliser).

| Client | Calls | What it does |
|--------|-------|-------------|
| `rezAuthClient.ts` | `POST /partner/v1/auth/verify` | Validates a REZ JWT, returns `{ rezUserId, phone }` |
| `rezWalletClient.ts` | `GET /partner/v1/wallet/:rezUserId/balance` | Returns coin balance for display |
| `rezGiftClient.ts` | `POST /partner/v1/gifts/issue-voucher`, `POST /partner/v1/gifts/transfer-coins` | Issues a merchant voucher or transfers coins for a gift |
| `rezMerchantClient.ts` | `GET /partner/v1/merchants/nearby`, `POST /partner/v1/bookings` | Fetches REZ merchants and creates table/dining bookings |
| `rezRewardClient.ts` | `POST /partner/v1/rewards/credit-meetup` | Credits REZ coins to both users after a verified meetup |

---

## 7. Real-time (Socket.io)

Socket.io mounts on the same HTTP server. JWT auth is validated on the WebSocket handshake (`auth: { token: rendezJwt }`).

**Events emitted to clients:**

| Event | Trigger | Payload |
|-------|---------|---------|
| `new_match` | Mutual like | `{ matchId, profile: { name, photos } }` |
| `new_message` | Message sent | `{ matchId, message }` |
| `typing` | Typing indicator | `{ matchId, userId }` |
| `gift_received` | Gift sent to user | `{ gift }` |
| `meetup_completed` | Both check in | `{ matchId, coinsEarned }` |

---

## 8. Background Jobs (BullMQ)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `expireGifts` | Every 10 min | Expire pending gifts older than 48h; call REZ to refund sender |
| `expireCheckins` | Every 30 min | Expire meetup check-in tokens older than 30 min |
| `calculateProfileScores` | Daily 2 AM | Recalculate `profileScore` (activity, completeness, meetup history) |
| `calculateRezSpendScores` | Daily 3 AM | Sync `rezSpendScore` from REZ analytics (drives discovery ranking) |
| `cleanupExpiredTokens` | Daily 4 AM | Remove stale Redis session tokens |

---

## 9. Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection URL |
| `JWT_SECRET` | Rendez JWT signing secret (min 32 chars) |
| `REZ_PARTNER_API_URL` | REZ backend base URL (e.g. `https://api.rezapp.com`) |
| `REZ_PARTNER_API_KEY` | Partner API key set in REZ backend (`x-partner-key` header) |
| `REZ_WEBHOOK_SECRET` | HMAC secret for verifying REZ → Rendez webhooks |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase service account JSON (stringified) for FCM |
| `ADMIN_API_KEY` | Admin panel bearer token |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | HTTP port |
| `NODE_ENV` | `production` | Environment |
| `SENTRY_DSN` | — | Sentry error tracking |
| `JWT_EXPIRES_IN` | `7d` | Rendez token TTL |
| `GIFT_BASE_COST_COINS` | `50` | Base coin cost of a gift (progressive multiplier applied on top) |
| `MEETUP_REWARD_COINS` | `100` | REZ coins credited to each user on meetup completion |
| `CHECKIN_WINDOW_MINUTES` | `30` | Window in which both users must QR-scan to validate a meetup |
| `GIFT_DAILY_CAP` | `5` | Max gifts a user can send per day |

---

## 10. REZ Side: What Needs to Be Configured

On the REZ backend, the following must be set up to support Rendez:

1. **Partner API key**: Add Rendez's `REZ_PARTNER_API_KEY` to `INTERNAL_SERVICE_TOKENS_JSON` (or equivalent partner auth config) in rez-backend env vars.

2. **Partner API routes**: REZ must expose `/partner/v1/` routes (auth verify, wallet balance, gift issue, merchant lookup, reward credit, booking create). These are internal to rez-backend.

3. **Webhooks out**: REZ must be configured to fire webhooks to Rendez backend on:
   - Gift voucher redeemed at merchant
   - Gift voucher expired
   - Booking/payment completed (for meetup reward trigger)

   Webhook target: `https://<rendez-backend>/api/v1/webhooks/rez/<event>`  
   Signed with `ADBAZAAR_WEBHOOK_SECRET` equivalent for Rendez (separate secret — `REZ_WEBHOOK_SECRET`).

---

## 11. Local Development

```bash
cd /tmp/Rendez

# Backend
cd rendez-backend
cp .env.example .env     # fill REZ_PARTNER_API_URL, DATABASE_URL, etc.
npm install
npx prisma migrate dev
npm run dev              # starts on PORT=4000

# App
cd ../rendez-app
npm install
npx expo start           # iOS simulator / Android / Web
```

**Web build:**
```bash
cd rendez-app
npm run build:web        # Metro bundler → dist/ for Vercel
```

**Admin:**
```bash
cd rendez-admin
npm install
npm run dev              # Next.js on :3000
```

---

## 12. Deployment

### Backend (Render Web Service — $7/mo)

```
Build command: npm ci && npx prisma generate && npm run build
Start command: npx prisma migrate deploy && node dist/index.js
```

- Region: Singapore (matches REZ backend latency)
- Add all required env vars from section 9

### Database (Render Postgres Starter — $7/mo)

Set `DATABASE_URL` from Render Postgres dashboard.

### Admin (Vercel)

- Root: `rendez-admin/`
- Framework: Next.js
- Set `ADMIN_API_URL` to Render backend URL + `ADMIN_API_KEY`

### App (Expo EAS)

```bash
cd rendez-app
eas build --platform all   # iOS + Android
eas submit                 # submit to stores
```

**Total cost at launch:** ~$14/month (Render Postgres + Render Web Service + Redis free tier)

---

## 13. Known Issues (Low Priority, Non-Blocking)

| Issue | File | Notes |
|-------|------|-------|
| Typing timer not cleared on unmount | `useRealtimeChat.ts` | Minor UX flicker, no data loss |
| `parseInt('18abc')` passes age validation | `ProfileSetupScreen.tsx` | Client-side only; backend re-validates |
| N+1 query in `getMatches` | `MatchService.ts` | 2 queries per match; acceptable at launch, needs Prisma `include` refactor at scale |
