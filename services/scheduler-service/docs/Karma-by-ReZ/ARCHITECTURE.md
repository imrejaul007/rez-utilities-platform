# Karma by ReZ — Architecture

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Karma App                             │
│                  (React Native / Next.js)                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ ReZ Auth SSO
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                     Karma Backend                            │
│                  (Node.js Microservice)                      │
│  ┌──────────────┬───────────────┬───────────────────────┐   │
│  │ Karma Engine│Verification   │ Batch Conversion       │   │
│  │             │Engine         │ Engine                │   │
│  └──────┬──────┴──────┬────────┴─────────┬─────────────┘   │
│         │             │                   │                  │
│         ▼             ▼                   ▼                  │
│  ┌────────────┐ ┌───────────┐ ┌─────────────────────────┐ │
│  │ EarnRecord│ │ EventBook- │ │ CSR Pool Manager        │ │
│  │ Model      │ │ ing (ext.)│ │                         │ │
│  └────────────┘ └───────────┘ └─────────────────────────┘ │
└────────┬────────────────┬──────────────────┬────────────────┘
         │                │                  │
         ▼                ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐
│ReZ Merchant  │  │ReZ Wallet    │  │ReZ Auth Service          │
│(BizOS)       │  │Service       │  │(existing)                │
│- Events      │  │- Credits     │  │- SSO                    │
│- NGO Approv. │  │- Ledger      │  │- Profile                │
│- Campaigns   │  │- Multi-coin  │  │                          │
└──────────────┘  └──────────────┘  └──────────────────────────┘
```

## 2. Microservices

### New: `rez-karma-service`

**Responsibility:** Karma brain — engine, verification, batch conversion

**Endpoints exposed:**
- `/api/karma/user/:userId` — get karma level + stats
- `/api/karma/earn` — record earn event
- `/api/karma/verify` — verification signal
- `/api/karma/batch` — admin batch CRUD
- `/api/karma/batch/execute` — trigger conversion
- `/api/karma/leaderboard` — (Phase 2)
- `/api/karma/feed` — (Phase 2)

### Extended: `rez-merchant-service`

**Changes:**
- `events.ts` — add verification fields
- `campaigns.ts` — add CSR pool management
- New route: `karma.ts` — NGO approval endpoints

**New fields on Event model:**
```typescript
{
  karmaEnabled: boolean,
  karmaRewardPerHour: number,
  verificationMode: 'qr' | 'gps' | 'manual',
  gpsRadius: number, // meters
  ngoId: ObjectId,
  csrPoolId: ObjectId,
  confidenceWeights: {
    qr_in: number,
    qr_out: number,
    gps: number,
    ngo: number,
    photo: number,
  }
}
```

**New fields on EventBooking model:**
```typescript
{
  qrCheckedIn: boolean,
  qrCheckedInAt: Date,
  qrCheckedOut: boolean,
  qrCheckedOutAt: Date,
  gpsCheckIn: { lat: number, lng: number },
  gpsCheckOut: { lat: number, lng: number },
  photoProofUrl: string,
  ngoApproved: boolean,
  ngoApprovedAt: Date,
  confidenceScore: number,
  verificationStatus: 'pending' | 'partial' | 'verified' | 'rejected',
  karmaEarned: number,
  earnedAt: Date,
}
```

### Extended: `rez-wallet-service`

**Changes:**
- Already supports multi-coin types
- Add `coinType: 'karma_points'` for identity layer
- Add `coinType: 'csr_pool'` for pool tracking
- Batch conversion calls existing `credit()` with idempotency keys

**Existing wallet API used:**
- `POST /api/wallet/credit` — credit coins to user wallet
- `GET /api/wallet/balance` — get balance by coin type
- `GET /api/wallet/transactions` — get transaction history

### Existing: `rez-auth-service`

**Used as-is:**
- `/api/auth/verify` — verify JWT
- `/api/auth/profile` — get user profile + wallet ID

## 3. Data Models

### EarnRecord (new)

```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  eventId: ObjectId,
  bookingId: ObjectId,
  karmaEarned: number,
  activeLevelAtApproval: 'L1' | 'L2' | 'L3' | 'L4',
  conversionRateSnapshot: 0.25 | 0.5 | 0.75 | 1.0,
  csrPoolId: ObjectId,
  verificationSignals: {
    qr_in: boolean,
    qr_out: boolean,
    gps_match: boolean,
    ngo_approved: boolean,
    photo_proof: boolean,
  },
  confidenceScore: number,
  status: 'APPROVED_PENDING_CONVERSION' | 'CONVERTED' | 'REJECTED' | 'ROLLED_BACK',
  createdAt: Date,
  approvedAt: Date,
  convertedAt: Date,
  convertedBy: ObjectId, // admin user
  batchId: ObjectId,
  rezCoinsEarned: number,
  idempotencyKey: string,
}
```

### Batch (new)

```typescript
{
  _id: ObjectId,
  weekStart: Date,
  weekEnd: Date,
  csrPoolId: ObjectId,
  totalEarnRecords: number,
  totalKarma: number,
  totalRezCoinsEstimated: number,
  totalRezCoinsExecuted: number,
  status: 'DRAFT' | 'READY' | 'EXECUTED' | 'PARTIAL',
  anomalyFlags: Array<{
    type: 'too_many_from_one_ngo' | 'suspicious_timestamps' | 'pool_shortage',
    count: number,
    resolved: boolean,
  }>,
  executedAt: Date,
  executedBy: ObjectId,
  createdAt: Date,
}
```

### CSRPool (new)

```typescript
{
  _id: ObjectId,
  name: string,
  campaignId: ObjectId, // links to merchant campaigns
  corporateId: ObjectId,
  totalBudget: number,
  remainingBudget: number,
  coinPool: number,
  coinPoolRemaining: number,
  issuedCoins: number,
  status: 'active' | 'depleted' | 'expired',
  startDate: Date,
  endDate: Date,
  events: ObjectId[], // linked events
}
```

### KarmaProfile (new)

```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  lifetimeKarma: number,
  activeKarma: number, // rolling 30-45 days
  level: 'L1' | 'L2' | 'L3' | 'L4',
  eventsCompleted: number,
  totalHours: number,
  trustScore: number, // 0-100
  badges: Array<{
    id: string,
    name: string,
    earnedAt: Date,
  }>,
  lastActivityAt: Date,
  levelHistory: Array<{
    level: string,
    earnedAt: Date,
    droppedAt: Date,
  }>,
  conversionHistory: Array<{
    karmaConverted: number,
    coinsEarned: number,
    rate: number,
    batchId: ObjectId,
    convertedAt: Date,
  }>,
  createdAt: Date,
  updatedAt: Date,
}
```

### KarmaEvent (new, mirrors merchant but with karma-specific fields)

```typescript
{
  _id: ObjectId,
  merchantEventId: ObjectId, // links to merchant Event model
  ngoId: ObjectId,
  category: 'environment' | 'food' | 'health' | 'education' | 'community',
  impactUnit: string, // 'trees', 'meals', 'hours', etc.
  impactMultiplier: number, // karma multiplier for impact
  difficulty: 'easy' | 'medium' | 'hard',
  expectedDurationHours: number,
  baseKarmaPerHour: number,
  maxKarmaPerEvent: number,
  qrCodes: {
    checkIn: string, // unique QR code for check-in
    checkOut: string, // unique QR code for check-out
  },
  gpsRadius: number,
  maxVolunteers: number,
  confirmedVolunteers: number,
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled',
}
```

## 4. API Specifications

### Karma Service APIs

#### GET /api/karma/user/:userId
Get user's karma profile.

**Response:**
```json
{
  "userId": "...",
  "lifetimeKarma": 5200,
  "activeKarma": 3400,
  "level": "L3",
  "conversionRate": 0.75,
  "eventsCompleted": 12,
  "totalHours": 48,
  "trustScore": 82,
  "badges": [...],
  "nextLevelAt": 5000,
  "decayWarning": null,
}
```

#### POST /api/karma/earn
Record karma earned from verified event completion.

**Request:**
```json
{
  "userId": "...",
  "eventId": "...",
  "bookingId": "...",
  "verificationSignals": {
    "qr_in": true,
    "qr_out": true,
    "gps_match": true,
    "ngo_approved": true,
    "photo_proof": false
  },
  "confidenceScore": 0.85,
  "hoursParticipated": 4
}
```

**Response:**
```json
{
  "success": true,
  "earnRecord": {
    "id": "...",
    "karmaEarned": 320,
    "levelAtApproval": "L3",
    "conversionRate": 0.75,
    "status": "APPROVED_PENDING_CONVERSION",
    "estimatedCoins": 240
  }
}
```

#### POST /api/karma/verify/checkin
QR check-in or GPS check-in.

**Request:**
```json
{
  "userId": "...",
  "eventId": "...",
  "mode": "qr",
  "qrCode": "...",
  "gpsCoords": { "lat": 12.9716, "lng": 77.5946 }
}
```

#### POST /api/karma/verify/checkout
QR check-out or GPS check-out.

#### GET /api/karma/batch
List all batches.

#### POST /api/karma/batch/:id/preview
Preview what a batch will execute.

#### POST /api/karma/batch/:id/execute
Execute batch conversion (admin only).

### Merchant Service Extensions

#### POST /api/karma/event
Create a karma-enabled event (NGO flow).

#### PUT /api/karma/event/:id/volunteers/:bookingId/approve
NGO approves a volunteer.

#### POST /api/karma/event/:id/volunteers/bulk-approve
Bulk approve volunteers.

#### GET /api/karma/event/:id/analytics
Event-specific karma analytics.

### Wallet Service Extensions

#### GET /api/wallet/balance?coinType=karma_points
Get karma points balance.

#### GET /api/wallet/transactions?coinType=karma_points
Get karma transaction history.

## 5. Tech Stack

- **Runtime:** Node.js 20+ / TypeScript
- **Framework:** Express.js (same as existing services)
- **Database:** MongoDB (same cluster as existing services)
- **Cache:** Redis (same cluster — rate limiting, batch locks)
- **Queue:** BullMQ (same Redis — weekly batch cron)
- **Auth:** ReZ Auth Service (existing)
- **Wallet:** ReZ Wallet Service (existing)
- **Config:** Shared `rez-shared` package

## 6. Deployment

**Same infrastructure as existing microservices:**
- Render.com (or current hosting)
- Docker container
- Health check: `GET /health`
- Metrics endpoint: `GET /metrics`

**Environment variables:**
```
KARMA_SERVICE_PORT=3009
KARMA_MONGODB_URI=mongodb://...
KARMA_REDIS_URL=redis://...
KARMA_AUTH_SERVICE_URL=http://rez-auth-service:3001
KARMA_WALLET_SERVICE_URL=http://rez-wallet-service:3006
KARMA_MERCHANT_SERVICE_URL=http://rez-merchant-service:3003
KARMA_BATCH_CRON_SCHEDULE="59 23 * * 0" # Sunday 23:59
```

---

## 7. Cross-App Trust Signals (Ecosystem Integration)

Karma by ReZ functions as the **trust identity layer** for the entire ReZ ecosystem. Karma profiles are surfaced as trust signals inside other ReZ apps — without requiring schema changes in those apps.

### Integration Pattern: `rezKarmaClient`

Any backend service can fetch karma data by `rezUserId` via the HTTP client:

```
┌──────────────┐     GET /api/karma/user/:rezUserId      ┌──────────────────┐
│  App Backend │ ─────────────────────────────────────▶ │ rez-karma-service │
│  (e.g. Rendez)│                                    └──────────────────┘
└──────┬───────┘                                              │
       │ enrich + surface                                        │
       ▼                                                         ▼
┌──────────────┐                                    ┌──────────────────┐
│ App Frontend │ ← profile karma field               │ MongoDB          │
│ (screens)    │                                    │ (KarmaProfile)   │
└──────────────┘                                    └──────────────────┘
```

### Implemented: Rendez Dating App

**Rendez backend** (`Rendez/rendez-backend/src/integrations/rez/rezKarmaClient.ts`):

```typescript
export async function getKarmaProfile(rezUserId: string): Promise<KarmaProfile | null> {
  try {
    const res = await karmaClient.get<KarmaProfile>(`/api/karma/user/${rezUserId}`);
    return res.data;
  } catch (err: any) {
    if (err.response?.status === 404) return null; // no karma profile yet
    console.warn('[rezKarmaClient] Failed to fetch karma profile:', err.message);
    return null; // fail silently — never break profile view
  }
}
```

- 5-second timeout
- 404 → `null` (user hasn't used Karma yet)
- Network/5xx → `null` (non-blocking enrichment)

**Rendez backend** (`routes/profile.ts`):
- `GET /api/v1/profile/:id` fetches karma in parallel via `Promise.all`
- Karma fields attached to response: `karmaScore`, `karmaLevel`, `karmaEventsCompleted`, `karmaBadges`

**Rendez frontend**:
- `ProfileScreen.tsx` — Own profile shows amber karma card: level, trust score, events completed
- `ProfileDetailScreen.tsx` — Others' profiles show amber trust badge: `🌍 Karma L3 · 82 pts · 12 events`

### Other ReZ Apps (same pattern)

| App | Integration Point | Karma Data Used |
|-----|-----------------|-----------------|
| **AdBazaar** | User profile / seller trust | Karma level, trust score, badges |
| **Hotel OTA** | Booking host trust | Karma level, events completed |
| **ReZ App** | User identity | Full karma profile, leaderboard |
| **ReZ Admin** | User review / fraud | Trust score, decay history, badge flags |

### Key Design Principles

1. **Non-blocking**: Karma enrichment never blocks the primary response — wrapped in `Promise.all` or fire-and-forget
2. **Silent fallback**: `null` karma is always handled gracefully — no broken UI
3. **No schema coupling**: Apps don't store karma locally; they fetch on demand by `rezUserId`
4. **Trust signal only**: Karma data informs trust — apps don't make blocking decisions on karma alone
5. **Single source of truth**: `rez-karma-service` MongoDB is the canonical karma store; no sync needed

### Backend Config

Rendez backend env (`env.ts`):
```typescript
KARMA_SERVICE_URL: process.env.KARMA_SERVICE_URL || 'http://localhost:3009',
```
