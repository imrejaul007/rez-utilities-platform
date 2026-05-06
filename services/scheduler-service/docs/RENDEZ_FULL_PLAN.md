# Rendez — Full System Plan
> Social + Gifts + Real-World Meetups | Powered by REZ

---

## 1. PRODUCT OVERVIEW

**Rendez** is a standalone social/dating app for verified REZ users.
It is an independent company and product — REZ is the exclusive infrastructure partner.

### Core Promise
- Verified users only (REZ account required)
- Controlled messaging (no spam, no ghost culture)
- Gift-based intent (send a coffee, unlock a conversation)
- Real-world meetups (book via REZ, earn rewards together)

### What Makes It Different

| Problem (every dating app) | Rendez Solution |
|---|---|
| Spam messages | 1 free message, then locked |
| Zero intent signals | Must send gift to push further |
| Fake profiles | REZ-verified accounts only |
| Never leads to real meetups | Booking + reward built into the loop |
| No business model | Gift revenue + merchant transactions |

---

## 2. COMPANY & INFRASTRUCTURE

Rendez is a **separate company** from REZ.
- Own codebase, own database, own servers
- Own mobile app (`com.rendez.app`)
- Own admin panel
- REZ is the **exclusive partner** — not the owner

### REZ Exclusive Partnership Gives Rendez:
- User verification (REZ-verified identity)
- Wallet infrastructure (all payments via REZ)
- Merchant network (gift catalog, booking, redemption)
- Reward engine (meetup coins)

---

## 3. HIGH-LEVEL ARCHITECTURE

```
┌──────────────────────────────────────────────────┐
│                  RENDEZ APP                      │
│           React Native (iOS + Android)           │
└───────────────────────┬──────────────────────────┘
                        │ HTTPS
                        ▼
┌──────────────────────────────────────────────────┐
│              RENDEZ API GATEWAY                  │
│         (Express / nginx, rate limiting)         │
└───────────────────────┬──────────────────────────┘
                        │
        ┌───────────────┼───────────────────┐
        ▼               ▼                   ▼
┌──────────────┐ ┌─────────────┐ ┌─────────────────┐
│   Profile &  │ │   Match &   │ │   Messaging &   │
│  User Service│ │  Discovery  │ │   Gift Service  │
└──────────────┘ └─────────────┘ └─────────────────┘
        ▼               ▼                   ▼
┌──────────────┐ ┌─────────────┐ ┌─────────────────┐
│   Meetup &   │ │  Moderation │ │   Notification  │
│ Reward Service│ │  & Safety   │ │    Service      │
└──────────────┘ └─────────────┘ └─────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────┐
│            PostgreSQL + Redis + BullMQ           │
└──────────────────────────────────────────────────┘
                        │
           REZ PARTNER API (HTTP + Webhooks)
                        │
        ┌───────────────┼───────────────────┐
        ▼               ▼                   ▼
┌─────────────┐ ┌──────────────┐ ┌──────────────────┐
│  REZ Auth   │ │  REZ Wallet  │ │  REZ Merchants   │
│  (SSO/OTP)  │ │  (coins,     │ │  (gift catalog,  │
│             │ │   vouchers)  │ │   booking, QR)   │
└─────────────┘ └──────────────┘ └──────────────────┘
```

```
┌──────────────────────────────────────────────────┐
│              RENDEZ ADMIN PANEL                  │
│        (Next.js — separate from REZ admin)       │
│  - Moderation queue                              │
│  - User reports & blocks                         │
│  - Fraud flags                                   │
│  - Match / gift / meetup analytics               │
└──────────────────────────────────────────────────┘
```

---

## 4. REZ PARTNER API SPEC

All calls from Rendez → REZ use a private partner API key.
Webhooks from REZ → Rendez use HMAC signature verification.

### Auth
```
GET  /partner/v1/auth/verify-token         Validate REZ JWT, return rez_user_id + verified status
POST /partner/v1/auth/link                 Link rez_user_id to Rendez profile
```

### Wallet
```
POST /partner/v1/wallet/hold               Escrow coins when gift sent
     body: { rez_user_id, amount, idempotency_key, reason: "rendez_gift" }
     returns: { hold_id }

POST /partner/v1/wallet/release            Credit recipient on gift accept
     body: { hold_id, recipient_rez_user_id }

POST /partner/v1/wallet/refund             Return to sender on reject/expiry
     body: { hold_id }

GET  /partner/v1/wallet/balance/:rez_id    Show balance in Rendez UI
```

### Gift Catalog (Merchant Gifts)
```
GET  /partner/v1/gifts/catalog             Fetch all admin-approved rendez gifts
     query: ?city=mumbai&category=coffee

POST /partner/v1/gifts/issue               Create voucher + deduct wallet
     body: { sender_rez_id, receiver_rez_id, catalog_item_id, idempotency_key }
     returns: { voucher_id, qr_code_url, expires_at }

POST /partner/v1/gifts/activate/:id        Accept gift → voucher goes live
POST /partner/v1/gifts/cancel/:id          Reject gift → refund triggered
GET  /partner/v1/gifts/voucher/:id         Get QR code for redemption
```

### Merchants + Booking
```
GET  /partner/v1/merchants/nearby          Suggest date spots
     query: ?lat=&lng=&radius_km=5

POST /partner/v1/bookings/create           Book on behalf of matched pair
     body: { merchant_id, user1_rez_id, user2_rez_id, date, party_size }
     returns: { booking_id, confirmation_code }
```

### Rewards
```
POST /partner/v1/rewards/trigger           Fire reward after validated meetup
     body: { booking_id, user1_rez_id, user2_rez_id, match_id }
```

### Webhooks (REZ → Rendez)
```
POST /webhooks/rez/payment-completed       Booking paid — start meetup validation window
POST /webhooks/rez/gift-redeemed           Merchant scanned QR — gift used
POST /webhooks/rez/gift-expired            Voucher expired — trigger refund
POST /webhooks/rez/reward-triggered        Reward dropped — notify both users
```

---

## 5. GIFT CATALOG FLOW (Merchant → Admin → Rendez)

```
REZ Merchant App           REZ Admin Panel          Rendez App
──────────────────         ───────────────          ──────────────────────
Creates gift offer    ──►  Reviews &          ──►  Appears in gift picker
  name: "Coffee"           approves                 (cached, refreshed 6h)
  amount: ₹99              sets tag:
  validity: 30 days        rendez_gift=true
  outlet: Café XYZ         sets tier: coffee
  photo: ...               sets sort order

                                                User A sends gift
                                                     │
                                             REZ issues voucher
                                             REZ deducts wallet
                                                     │
                                             User B notified
                                             Accept / Reject
                                                     │
                                    Accept ──────────┤──────── Reject
                                       │                           │
                              Voucher QR in                   Refund to A
                              Rendez app                           │
                              Redeemable at              Message stays locked
                              Café XYZ outlet
                                       │
                              Message slot unlocks
                              in Rendez chat
```

### Gift Tiers

| Tier | Amount | Type | UX Label |
|---|---|---|---|
| Signal | ₹20 | Coins | "Send a nudge" |
| Coffee | ₹50–₹99 | Merchant voucher | "Coffee on me ☕" |
| Treat | ₹100–₹149 | Merchant voucher | "A little treat 🍰" |
| Experience | ₹200–₹499 | Merchant voucher | "Let's meet properly 🍽️" |
| Exclusive | ₹500+ | Premium merchant | "I'm serious. Let's go." |

### Progressive Cost (Anti-spam)
```
1st gift to same person: base price
2nd gift to same person: 1.5x base
3rd gift to same person: 2x base
After 3 rejections from same person: blocked from gifting them
Daily gift send limit: 5 total per user
```

---

## 6. DATABASE SCHEMA (Prisma — PostgreSQL)

```prisma
// rendez-backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── USERS & PROFILES ───────────────────────────────────────────────────────

model Profile {
  id                String    @id @default(cuid())
  rezUserId         String    @unique  // linked REZ account
  phone             String    @unique  // from REZ auth
  name              String
  bio               String?   @db.VarChar(300)
  age               Int
  gender            Gender
  interestedIn      Gender[]
  intent            Intent    @default(DATING)
  city              String
  lat               Float?
  lng               Float?
  photos            String[]  // cloudinary URLs
  isVerified        Boolean   @default(false)  // REZ-verified
  isActive          Boolean   @default(true)
  profileScore      Float     @default(0)      // discovery ranking
  rezSpendScore     Float     @default(0)      // from REZ (quality signal)
  lastActiveAt      DateTime  @default(now())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  sentLikes         Like[]    @relation("SentLikes")
  receivedLikes     Like[]    @relation("ReceivedLikes")
  matchesAsUser1    Match[]   @relation("MatchUser1")
  matchesAsUser2    Match[]   @relation("MatchUser2")
  sentGifts         Gift[]    @relation("SentGifts")
  receivedGifts     Gift[]    @relation("ReceivedGifts")
  checkins          MeetupCheckin[]
  reports           Report[]  @relation("Reporter")
  reported          Report[]  @relation("Reported")
  blocks            Block[]   @relation("Blocker")
  blocked           Block[]   @relation("Blocked")

  @@index([city])
  @@index([rezUserId])
}

enum Gender {
  MALE
  FEMALE
  NON_BINARY
}

enum Intent {
  DATING
  FRIENDSHIP
  NETWORKING
}

// ─── LIKES & MATCHES ────────────────────────────────────────────────────────

model Like {
  id          String    @id @default(cuid())
  fromUserId  String
  toUserId    String
  createdAt   DateTime  @default(now())

  fromUser    Profile   @relation("SentLikes", fields: [fromUserId], references: [id])
  toUser      Profile   @relation("ReceivedLikes", fields: [toUserId], references: [id])

  @@unique([fromUserId, toUserId])
  @@index([toUserId])
}

model Match {
  id            String        @id @default(cuid())
  user1Id       String
  user2Id       String
  intentType    Intent        @default(DATING)
  status        MatchStatus   @default(ACTIVE)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  user1         Profile       @relation("MatchUser1", fields: [user1Id], references: [id])
  user2         Profile       @relation("MatchUser2", fields: [user2Id], references: [id])
  messageState  MessageState?
  gifts         Gift[]
  checkins      MeetupCheckin[]
  rewards       Reward[]

  @@unique([user1Id, user2Id])
  @@index([user1Id])
  @@index([user2Id])
}

enum MatchStatus {
  ACTIVE
  ARCHIVED   // 72h no activity
  UNMATCHED
  BLOCKED
}

// ─── MESSAGING STATE MACHINE ────────────────────────────────────────────────

model MessageState {
  id                  String        @id @default(cuid())
  matchId             String        @unique
  state               ChatState     @default(MATCHED)
  freeMessageUsedBy   String?       // profile id who sent the first message
  giftUnlockCount     Int           @default(0)
  lastActivityAt      DateTime      @default(now())
  expiresAt           DateTime?     // set when entering AWAITING state (72h)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  match               Match         @relation(fields: [matchId], references: [id])
  messages            Message[]
}

enum ChatState {
  MATCHED              // just matched, no message yet
  FREE_MSG_SENT        // first free message sent
  AWAITING_REPLY       // waiting for other side to reply (72h window)
  LOCKED               // 72h passed, no reply
  GIFT_PENDING         // gift sent, awaiting accept/reject
  OPEN                 // replied OR gift accepted → full chat
}

model Message {
  id             String       @id @default(cuid())
  stateId        String
  senderId       String
  content        String       @db.VarChar(1000)
  type           MessageType
  giftId         String?      // if this message was unlocked by a gift
  flagged        Boolean      @default(false)
  createdAt      DateTime     @default(now())

  state          MessageState @relation(fields: [stateId], references: [id])

  @@index([stateId])
  @@index([senderId])
}

enum MessageType {
  FREE
  GIFT_UNLOCKED
  OPEN_CHAT
}

// ─── GIFTS ──────────────────────────────────────────────────────────────────

model Gift {
  id                  String      @id @default(cuid())
  senderId            String
  receiverId          String
  matchId             String
  giftType            GiftType
  amountPaise         Int         // stored in paise
  rezCatalogItemId    String?     // for merchant vouchers
  rezHoldId           String?     // from REZ wallet hold API
  rezVoucherId        String?     // from REZ gift issue API
  merchantName        String?     // cached for display
  merchantLogoUrl     String?     // cached for display
  message             String?     @db.VarChar(200)
  status              GiftStatus  @default(PENDING)
  messageUnlocked     Boolean     @default(false)
  attemptNumber       Int         @default(1)  // for progressive pricing
  expiresAt           DateTime
  acceptedAt          DateTime?
  rejectedAt          DateTime?
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  sender              Profile     @relation("SentGifts", fields: [senderId], references: [id])
  receiver            Profile     @relation("ReceivedGifts", fields: [receiverId], references: [id])
  match               Match       @relation(fields: [matchId], references: [id])

  @@index([senderId])
  @@index([receiverId])
  @@index([matchId])
  @@index([status, expiresAt])  // for expiry worker
}

enum GiftType {
  COIN
  MERCHANT_VOUCHER
}

enum GiftStatus {
  PENDING     // sent, awaiting accept/reject
  ACCEPTED    // receiver accepted
  REJECTED    // receiver rejected → refund triggered
  REDEEMED    // merchant scanned QR
  EXPIRED     // not acted on within 48h → refund
  CANCELLED   // sender cancelled
}

// ─── MEETUP & REWARDS ───────────────────────────────────────────────────────

model MeetupCheckin {
  id              String          @id @default(cuid())
  matchId         String
  bookingId       String          // REZ booking ID
  rezMerchantId   String
  userId          String
  checkedInAt     DateTime        @default(now())
  validationMethod ValidationMethod @default(QR)

  match           Match           @relation(fields: [matchId], references: [id])
  user            Profile         @relation(fields: [userId], references: [id])

  @@unique([matchId, userId])  // one checkin per user per match meetup
}

enum ValidationMethod {
  QR
}

model Reward {
  id              String        @id @default(cuid())
  matchId         String
  bookingId       String
  user1Id         String
  user2Id         String
  status          RewardStatus  @default(PENDING)
  rezRewardRef    String?       // returned by REZ reward trigger API
  triggeredAt     DateTime?
  createdAt       DateTime      @default(now())

  match           Match         @relation(fields: [matchId], references: [id])

  @@unique([matchId, bookingId])  // one reward per meetup
}

enum RewardStatus {
  PENDING
  TRIGGERED
  FAILED
}

// ─── MODERATION & SAFETY ────────────────────────────────────────────────────

model Report {
  id           String        @id @default(cuid())
  reporterId   String
  reportedId   String
  reason       ReportReason
  detail       String?       @db.VarChar(500)
  status       ReportStatus  @default(PENDING)
  reviewedBy   String?       // admin user id
  reviewedAt   DateTime?
  createdAt    DateTime      @default(now())

  reporter     Profile       @relation("Reporter", fields: [reporterId], references: [id])
  reported     Profile       @relation("Reported", fields: [reportedId], references: [id])
}

enum ReportReason {
  HARASSMENT
  FAKE_PROFILE
  SPAM
  INAPPROPRIATE_CONTENT
  SCAM
  OTHER
}

enum ReportStatus {
  PENDING
  REVIEWED
  ACTION_TAKEN
  DISMISSED
}

model Block {
  id         String    @id @default(cuid())
  blockerId  String
  blockedId  String
  createdAt  DateTime  @default(now())

  blocker    Profile   @relation("Blocker", fields: [blockerId], references: [id])
  blocked    Profile   @relation("Blocked", fields: [blockedId], references: [id])

  @@unique([blockerId, blockedId])
}

// ─── FRAUD TRACKING ─────────────────────────────────────────────────────────

model FraudFlag {
  id          String      @id @default(cuid())
  userId      String
  type        FraudType
  detail      String?
  resolved    Boolean     @default(false)
  createdAt   DateTime    @default(now())

  @@index([userId])
  @@index([type, resolved])
}

enum FraudType {
  GIFT_SPAM          // too many gifts sent
  REWARD_FARMING     // repeated reward attempts same pair
  MULTIPLE_ACCOUNTS  // device linked to multiple profiles
  FAKE_CHECKIN       // suspicious checkin pattern
}
```

---

## 7. MESSAGING STATE MACHINE (Logic)

```
State: MATCHED
  → on: sendMessage(userId)
    if: freeMessageUsedBy == null
    → deduct free slot, set freeMessageUsedBy = userId
    → emit: MESSAGE_SENT
    → transition: FREE_MSG_SENT
    → set expiresAt = now + 72h

State: FREE_MSG_SENT
  → on: sendMessage(otherUserId)  [the RECEIVER replies]
    → transition: OPEN
    → clear expiry
  → on: timeout (72h, no reply)
    → transition: LOCKED
  → on: sendGift(userId)
    → transition: GIFT_PENDING (while gift is pending)

State: LOCKED
  → on: sendMessage(userId)
    → REJECT with code: MSG_LOCKED
    → return: gift options
  → on: sendGift(userId)
    → create gift, call REZ hold API
    → transition: GIFT_PENDING

State: GIFT_PENDING
  → on: giftAccepted
    → increment giftUnlockCount
    → unlock 1 message slot
    → transition: FREE_MSG_SENT (or OPEN if this is 3rd unlock)
  → on: giftRejected
    → call REZ refund API
    → transition: LOCKED
  → on: giftExpired (48h)
    → call REZ refund API
    → transition: LOCKED

State: OPEN
  → full chat, no restrictions
  → on: block / unmatch → transition: (match archived)
```

---

## 8. DISCOVERY ALGORITHM

### Score Formula
```
DiscoveryScore = (distance_score × 0.30)
               + (interest_overlap × 0.25)
               + (activity_score × 0.20)    // recency of last active
               + (rez_spend_score × 0.15)   // REZ ecosystem quality signal
               + (profile_completeness × 0.10)
```

### Feed Generation
- Computed per user, cached in Redis (TTL: 30 min)
- Filter: city match, gender preference, not already liked, not blocked
- Re-rank on refresh
- `rez_spend_score` sourced from REZ partner API on profile creation/update

---

## 9. FRAUD PREVENTION RULES

| Rule | Threshold | Action |
|---|---|---|
| Gift spam | >5 gifts sent/day | Block gift sending for 24h |
| Gift rejection flood | 3 rejections from same person | Block gifting that person permanently |
| Reward farming | >1 reward per match pair per 90 days | Reject reward trigger, flag |
| Reward farming | <7 days between match creation and reward | Reject, flag as suspicious |
| Meetup too fast | Checkin < 1h after booking | Flag for review |
| Multiple accounts | Same device → multiple profiles | Flag both accounts, suspend |

All flags stored in `FraudFlag` table. Admin reviews in Rendez admin panel.

---

## 10. API ROUTES

### Profile
```
POST   /api/v1/profile                  Create profile (after REZ SSO)
GET    /api/v1/profile/me               Get own profile
PATCH  /api/v1/profile/me              Update profile
POST   /api/v1/profile/photos          Upload photo (Cloudinary)
DELETE /api/v1/profile/photos/:idx     Remove photo
```

### Discovery & Matching
```
GET    /api/v1/discover                 Get ranked feed (paginated)
POST   /api/v1/likes/:profileId        Like someone
DELETE /api/v1/likes/:profileId        Unlike
GET    /api/v1/matches                  Get my matches
GET    /api/v1/matches/:matchId         Get match detail
DELETE /api/v1/matches/:matchId         Unmatch
```

### Messaging
```
GET    /api/v1/matches/:matchId/messages        Get messages (paginated)
POST   /api/v1/matches/:matchId/messages        Send message
GET    /api/v1/matches/:matchId/state           Get chat state
```

### Gifts
```
GET    /api/v1/gifts/catalog                    Get available gifts from REZ
POST   /api/v1/gifts/send                       Send gift
POST   /api/v1/gifts/:giftId/accept             Accept gift
POST   /api/v1/gifts/:giftId/reject             Reject gift
GET    /api/v1/gifts/:giftId/voucher            Get redemption QR
```

### Meetup
```
POST   /api/v1/meetup/checkin                   Check in at merchant (QR scan)
GET    /api/v1/meetup/:matchId/status           Get meetup validation status
```

### Safety
```
POST   /api/v1/users/:profileId/report          Report user
POST   /api/v1/users/:profileId/block           Block user
GET    /api/v1/blocks                            Get blocked users
```

### Webhooks (REZ → Rendez)
```
POST   /webhooks/rez/payment-completed
POST   /webhooks/rez/gift-redeemed
POST   /webhooks/rez/gift-expired
POST   /webhooks/rez/reward-triggered
```

---

## 11. MOBILE APP — SCREENS & NAVIGATION

### Bottom Navigation
```
Discover | Matches | Chat | Gifts | Profile
```

### Screen Map
```
Auth Stack
  ├── WelcomeScreen          (REZ login CTA)
  ├── REZLoginScreen         (OAuth into REZ)
  └── ProfileSetupScreen     (bio, photos, age, intent)

Discover Stack
  ├── DiscoverScreen         (swipe card feed)
  └── ProfileDetailScreen    (expanded profile view)

Matches Stack
  └── MatchesScreen          (list of matches with state badges)

Chat Stack
  ├── ChatListScreen         (all chats, state indicator)
  ├── ChatScreen             (messages + lock state UI)
  └── GiftPickerScreen       (catalog of gifts from REZ)

Gifts Stack
  ├── GiftInboxScreen        (received gifts, accept/reject)
  └── VoucherScreen          (QR code for redemption)

Meetup Stack
  ├── MerchantSuggestScreen  (nearby REZ venues for the date)
  ├── BookingScreen          (book via REZ)
  └── MeetupCheckinScreen    (QR scan at venue)

Profile Stack
  ├── MyProfileScreen
  ├── EditProfileScreen
  ├── WalletBalanceScreen    (REZ wallet balance, pulled from REZ)
  └── SettingsScreen
```

### Chat Lock State UI
```
When state = LOCKED:
┌─────────────────────────────────────┐
│  They haven't replied yet.          │
│  Send a gift to show you're serious │
│                                     │
│  ☕ Coffee at Café XYZ      ₹99    │
│  🍰 Dessert at ABC Bakes    ₹149   │
│  🍽️ Dinner for 2 at ZZZ   ₹499   │
│  💰 Send REZ coins           ₹50   │
│                                     │
│  [Gift = 1 message unlock]          │
└─────────────────────────────────────┘
```

---

## 12. ADMIN PANEL — SECTIONS

```
rendez-admin (Next.js)
│
├── /dashboard              Match rate, gift volume, meetup conversion, DAU
├── /moderation             Flagged messages queue, reports queue
├── /users                  User lookup, verification status, fraud flags
├── /gifts                  Gift analytics, catalog cache status
├── /meetups                Validated meetups, reward disbursements
├── /fraud                  Active fraud flags, resolution queue
└── /settings               Rate limits, fraud thresholds, feature flags
```

---

## 13. FOLDER STRUCTURE

```
rendez-backend/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── index.ts
│   ├── routes/
│   │   ├── profile.ts
│   │   ├── discover.ts
│   │   ├── match.ts
│   │   ├── messaging.ts
│   │   ├── gift.ts
│   │   ├── meetup.ts
│   │   ├── safety.ts
│   │   └── webhooks/
│   │       └── rez.ts
│   ├── services/
│   │   ├── ProfileService.ts
│   │   ├── MatchService.ts
│   │   ├── DiscoveryService.ts
│   │   ├── MessagingService.ts
│   │   ├── GiftService.ts
│   │   ├── MeetupService.ts
│   │   ├── RewardService.ts
│   │   ├── ModerationService.ts
│   │   └── FraudService.ts
│   ├── integrations/
│   │   └── rez/
│   │       ├── rezAuthClient.ts
│   │       ├── rezWalletClient.ts
│   │       ├── rezGiftClient.ts
│   │       ├── rezMerchantClient.ts
│   │       └── rezRewardClient.ts
│   ├── middleware/
│   │   ├── auth.ts          (verify REZ JWT)
│   │   ├── rateLimiter.ts
│   │   ├── webhookVerify.ts (HMAC check for REZ webhooks)
│   │   └── errorHandler.ts
│   ├── workers/
│   │   ├── giftExpiryWorker.ts
│   │   ├── matchExpiryWorker.ts
│   │   └── discoveryRefreshWorker.ts
│   ├── jobs/
│   │   └── queue.ts         (BullMQ setup)
│   └── config/
│       ├── database.ts
│       ├── redis.ts
│       └── env.ts

rendez-admin/               (Next.js)
rendez-app/                 (React Native + Expo)
```

---

## 14. ENVIRONMENT VARIABLES

```env
# Rendez Backend
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
PORT=4000

# REZ Partner Integration
REZ_PARTNER_API_URL=https://api.rez.money/partner/v1
REZ_PARTNER_API_KEY=...
REZ_WEBHOOK_SECRET=...    # for HMAC verification

# Media
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Notifications
FCM_SERVER_KEY=...
MSG91_API_KEY=...

# Feature Flags
MAX_GIFTS_PER_DAY=5
GIFT_EXPIRY_HOURS=48
MATCH_EXPIRY_HOURS=72
REWARD_MIN_BILL_PAISE=150000
REWARD_COOLDOWN_DAYS=90
```

---

## 15. SPRINT PLAN

### Sprint 1–2 — Foundation
- [ ] Repo scaffold (rendez-backend, rendez-app, rendez-admin)
- [ ] Prisma schema + migrations
- [ ] REZ auth middleware (verify REZ JWT)
- [ ] Profile CRUD API
- [ ] Base mobile app: auth → REZ login → profile setup

### Sprint 3–4 — Core Social Loop
- [ ] Like service + mutual match detection
- [ ] Discovery feed (basic scoring, no ML yet)
- [ ] Match service
- [ ] Discover screen + Profile detail screen (mobile)
- [ ] Matches list screen (mobile)

### Sprint 5–6 — Messaging Engine
- [ ] MessageState model + state machine
- [ ] Message send API with state enforcement
- [ ] Redis state cache layer
- [ ] Chat screen (mobile) with lock state UI
- [ ] Gift picker screen (mobile)

### Sprint 7–8 — Gift System
- [ ] REZ wallet client (hold/release/refund)
- [ ] REZ gift catalog client
- [ ] Gift send/accept/reject API
- [ ] Gift → message unlock bridge
- [ ] Gift inbox screen (mobile)
- [ ] Voucher QR screen (mobile)
- [ ] Gift expiry worker

### Sprint 9–10 — Meetup + Rewards
- [ ] REZ merchant client (nearby + booking)
- [ ] MeetupCheckin service + QR validation
- [ ] Reward trigger service (calls REZ)
- [ ] Merchant suggest screen (mobile)
- [ ] Meetup checkin screen (mobile)
- [ ] REZ webhook handlers (payment, gift-redeemed, reward)

### Sprint 11 — Fraud + Safety
- [ ] FraudService (all rules)
- [ ] Report + block API
- [ ] Content flagging on messages
- [ ] Rate limiters per endpoint
- [ ] Fraud flag background jobs

### Sprint 12 — Admin Panel
- [ ] Dashboard (KPIs)
- [ ] Moderation queue
- [ ] User management
- [ ] Fraud flag review
- [ ] Gift/reward analytics

### Sprint 13 — Polish + Beta Prep
- [ ] Push notifications (FCM)
- [ ] Discovery algorithm refinement
- [ ] Performance testing
- [ ] Security review
- [ ] Beta launch (1 city)

---

## 16. REVENUE MODEL

| Stream | Mechanism | Timing |
|---|---|---|
| Coin gift margin | ~10% on REZ coin gift transactions | Immediate |
| Merchant gift margin | ~15% on voucher value (negotiated with REZ) | Immediate |
| Boost | ₹99/week — appear higher in discovery feed | Phase 2 |
| Premium | ₹299/month — see who liked you, unlimited likes | Phase 2 |
| Exclusive tier | ₹999/month — verified badge, priority matching | Phase 3 |

---

## 17. SCALING ROADMAP

| Phase | Users | Infrastructure |
|---|---|---|
| Beta | 1K | Single server, 1 PostgreSQL, Redis |
| Phase 1 | 10K | Managed PostgreSQL (Supabase/Neon), Redis cluster |
| Phase 2 | 100K | Read replicas, BullMQ → Kafka, CDN for media |
| Phase 3 | 1M+ | DB sharding by city, separate media service, geo-routing |

---

## 18. KEY RISKS & MITIGATIONS

| Risk | Mitigation |
|---|---|
| Gift UX feels like pay-to-talk | Frame as "romantic gesture" not "unlock fee". Copy is everything. |
| GPS/location spoofing for rewards | QR-only validation at merchant terminal. GPS never used. |
| Reward farming (fake couples) | 7-day match minimum + 90-day cooldown + merchant-linked booking only |
| Cold start (no users in city) | Launch invite-only, REZ existing user base as seed audience |
| REZ Partner API downtime | Circuit breaker on all REZ calls, graceful degradation (show cached catalog) |
| Gift spam harassment | Progressive pricing + 3-rejection block + 5/day limit |

---

*Last updated: April 2026*
