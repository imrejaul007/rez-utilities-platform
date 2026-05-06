# Bug Report: Loyalty System & Gamification Logic

**Audit Date:** 2026-04-13
**Layer:** Visit tracking, streaks, milestones, achievement workers, gamification service
**Status:** CRITICAL — users see coin promises that are never fulfilled; loyalty system is internally contradictory

---

## C11 — Four milestone systems contradict each other; display promises 2,000 coins but only 650 are awarded at 100 visits {#c11}
> **Status:** ✅ FIXED — `visitStreakRoutes.ts` VISIT_MILESTONES table aligned to the achievementWorker.ts canonical values (was: 5→50, 10→100, 25→300, 50→750, 100→2000; now: 1→25, 5→75, 10→150 matching `first_checkin`/`fifth_checkin`/`tenth_checkin` achievements). A canonical comment in `achievementWorker.ts` ACHIEVEMENTS now cross-references `visitStreakRoutes.ts` as the display mirror. The storePaymentController.ts display-only bronze/silver/gold display (System 4) remains display-only and does not award coins; this is acceptable as it shows merchant loyalty tier, not visit achievement milestones.

**Severity:** CRITICAL
**Impact:** Users are systematically misled about the value of the loyalty program. The displayed milestone table is false advertising.

**What is happening:**
Four separate milestone systems exist with completely different thresholds and coin values:

| System | What it does | Visit thresholds | Coins awarded |
|--------|-------------|-----------------|---------------|
| Gamification `/internal/visit` | Actually awards coins | 7, 30, 100 | 50, 200, 500 |
| Achievement worker | Actually awards coins | 1, 5, 10 | 25, 75, 150 |
| `visitStreakRoutes.ts` | **Display only, nothing awarded** | 5, 10, 25, 50, 100 | shows 50, 100, 300, 750, **2,000** |
| `storePaymentController.ts` | **Display only, nothing awarded** | 5, 10, 15 | shows Bronze, Silver, Gold |

At 100 visits:
- User sees: **2,000 coins** (System 3 display)
- User actually receives: 500 (System 1) + 150 (System 2) = **650 coins**
- Gap: **1,350 coins never delivered**

**Files involved:**
- `rez-gamification-service/src/httpServer.ts:529` — System 1 (actual award: 7/30/100 visits)
- `rez-gamification-service/src/workers/achievementWorker.ts:37-93` — System 2 (actual award: 1/5/10 visits)
- `rezbackend/rez-backend-master/src/routes/visitStreakRoutes.ts:35-41` — System 3 (display only: 5/10/25/50/100)
- `rezbackend/rez-backend-master/src/controllers/storePaymentController.ts:1163` — System 4 (display only: 5/10/15)

**Fix:**
1. Decide the authoritative milestone table (suggest: 1→25, 5→75, 10→150, 25→300, 50→750, 100→2000)
2. Implement awards in one place only (recommend: achievement worker or gamification `/internal/visit`)
3. Remove Systems 3 and 4 display-only code or wire them to match the actual award values
4. Delete the conflicting systems — having 4 is worse than having 1 imperfect one

---

## H22 — Single QR check-in fires three concurrent gamification event paths {#h22}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Streak and achievement logic is evaluated 2–3 times for a single visit. Without perfect idempotency in all paths simultaneously, coins can be awarded multiple times.

**What is happening:**
`qrCheckinRoutes.ts` (line 216) fires all of the following on a single scan:

1. `gamificationEventBus.emit('visit_checked_in')` — in-process event bus, triggers monolith streak handler
2. BullMQ job → `store-visit-events` queue → `storeVisitStreakWorker` in gamification service
3. HTTP `POST /internal/visit` to gamification service — also calls `processStoreVisitInternal` for streak logic

Paths 2 and 3 both call streak logic. Path 1 additionally triggers monolith-side streak updates. At a timezone boundary (IST midnight), paths 1 and 2+3 may disagree on "today" and both increment the streak.

The `achievementWorker` runs as a fourth path when path 1 or 2 forward `visit_checked_in` to the `achievement-events` queue.

**Files involved:**
- `rezbackend/rez-backend-master/src/routes/qrCheckinRoutes.ts:216` — emits all three
- `rez-gamification-service/src/httpServer.ts` — path 3 (HTTP)
- `rez-gamification-service/src/workers/storeVisitStreakWorker.ts` — path 2 (BullMQ)
- `rezbackend/rez-backend-master/src/events/gamificationEventBus.ts` — path 1 (in-process)

**Fix:**
Choose ONE canonical path for gamification processing per visit:
- Recommended: BullMQ `store-visit-events` queue only (durable, retryable, idempotent via jobId)
- Remove the direct HTTP call (path 3) — it duplicates the BullMQ worker's behavior
- Remove or consolidate the in-process event bus path (path 1) for streak logic

---

## H23 — Achievement worker counts ALL visit statuses, including cancelled and pending {#h23}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Users earn visit achievement badges and coins through cancelled or rejected visits.

**What is happening:**
`achievementWorker.ts` line 122:
```typescript
const visitCount = await StoreVisits.countDocuments({ userId });
// No status filter — counts pending, cancelled, in_progress, completed
```

Compare to `visitStreakRoutes.ts`:
```typescript
StoreVisit.countDocuments({ userId, status: 'COMPLETED' })
```

A user with 3 completed visits and 7 cancelled visits is awarded the "10 visits" achievement badge (150 coins). They have not actually visited 10 times.

**Files involved:**
- `rez-gamification-service/src/workers/achievementWorker.ts:122`
- `rezbackend/rez-backend-master/src/routes/visitStreakRoutes.ts` — uses COMPLETED filter (correct)

**Fix:**
```typescript
const visitCount = await StoreVisits.countDocuments({ userId, status: 'COMPLETED' });
```

---

## H24 — Streak timezone war: gamification service uses UTC, monolith uses IST {#h24}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Users who visit between 6:30 PM UTC and 11:30 PM UTC (12:00 AM – 5:30 AM IST) may have their visit recorded as Day N by the gamification service but Day N+1 by the monolith. Streak evaluated differently by both systems for the same visit.

**Note:** This overlaps with H10 in 03-ENUMS-BUSINESS-LOGIC.md but is a distinct manifestation in a different system layer.

**What is happening:**

| Service | Timezone logic | Day boundary |
|---------|---------------|-------------|
| `storeVisitStreakWorker.ts` | `new Date().toISOString().split('T')[0]` | UTC midnight |
| `worker.ts` (general gamification) | Same UTC string | UTC midnight |
| `streakService.ts` (monolith) | `IST_OFFSET_MS = 5.5 * 60 * 60 * 1000` | IST midnight |
| `gamificationService.ts` (trial) | `setHours(0,0,0,0)` — no TZ | Server local time |

**Files involved:**
- `rez-gamification-service/src/workers/storeVisitStreakWorker.ts`
- `rez-gamification-service/src/workers/worker.ts`
- `rezbackend/rez-backend-master/src/services/streakService.ts`

**Fix:**
Standardize all streak services on IST (UTC+5:30) since the product is India-only. Create a shared `toISTDateString(date: Date): string` utility in `rez-shared/src/date.ts` and use it everywhere:
```typescript
export function toISTDateString(date: Date): string {
  return new Date(date.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
}
```

---

## H25 — Streak reset value is 0 in cron but 1 in workers — display flicker and milestone re-evaluation {#h25}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** When a streak breaks via the daily cron, `currentStreak = 0`. If the user visits before the cron runs, the worker sets `currentStreak = 1`. If the cron runs after, it resets to 0, erasing the valid new streak. Display shows incorrect streak length.

**What is happening:**

| Code path | On streak break, resets to |
|-----------|--------------------------|
| `storeVisitStreakWorker.ts` | **1** (new streak starts immediately) |
| `worker.ts` (general) | **1** |
| `streakService.checkBrokenStreaks()` (cron, runs 00:05 UTC) | **0** (streak dies) |
| `gamificationService.updateStreak()` (trial) | **1** |

A user who breaks their streak and visits the next day may get `currentStreak = 1` from the worker, then the cron runs and resets it to `0`, erasing the valid re-start.

**Files involved:**
- `rez-gamification-service/src/workers/storeVisitStreakWorker.ts`
- `rezbackend/rez-backend-master/src/services/streakService.ts` — `checkBrokenStreaks()`
- `rezbackend/rez-backend-master/src/jobs/streakResetJob.ts`

**Fix:**
Standardize on `1` as the reset value (a broken streak where the user visits today starts a new streak of 1, not 0). The cron should only run when no visit happened today. Use a `lastActivityDate` check before resetting:
```typescript
// Only reset if user has not visited today
if (streak.lastActivityDate < todayISTStart) {
  streak.currentStreak = 0;
}
```

---

## H32 — Three separate visit count stores produce different numbers for the same user {#h32}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Achievement milestones, displayed progress, and analytics all show different visit counts for the same user. No source of truth.

**What is happening:**

| Store | Where | What it counts |
|-------|-------|----------------|
| `uservisitcounts.totalVisits` | gamification service MongoDB | Incremented once per `/internal/visit` call (all check-ins) |
| `storevisits.countDocuments({ userId })` | achievementWorker | ALL statuses (pending, cancelled, completed) |
| `StoreVisit.countDocuments({ userId, status: COMPLETED })` | visitStreakRoutes | COMPLETED only |

These three can all show different numbers. Achievement milestones fire off the second store (all-status). Display shows the third (COMPLETED only). The first is used for the 7/30/100-visit milestone awards.

**Files involved:**
- `rez-gamification-service/src/httpServer.ts` — `uservisitcounts` store
- `rez-gamification-service/src/workers/achievementWorker.ts:122` — all-status count
- `rezbackend/rez-backend-master/src/routes/visitStreakRoutes.ts` — COMPLETED-only count

**Fix:**
Designate `uservisitcounts.totalVisits` (incremented only on confirmed/completed check-ins via `/internal/visit`) as the single source of truth. Route all milestone checks and display through this collection. Delete the raw `countDocuments` calls.

---

## H31 — No code implements loyalty tier auto-upgrade despite tier thresholds being defined {#h31}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Loyalty tier progression is defined in the product (Bronze/Silver/Gold/Platinum at ₹0/₹2k/₹8k/₹20k cumulative spend) but never applied. All users stay at Bronze forever regardless of spend.

**What is happening:**
`MerchantLoyaltyTier` model defines:
```typescript
minCumulativeSpend: { Bronze: 0, Silver: 2000, Gold: 8000, Platinum: 20000 }
multiplier: { Bronze: 1.0, Silver: 1.25, Gold: 1.5, Platinum: 2.0 }
```

`MerchantCustomerSnapshot` stores `currentLoyaltyTier` and `totalSpend`. But no service was found that:
1. Reads `totalSpend` after each transaction
2. Compares against tier thresholds
3. Updates `currentLoyaltyTier`

The multiplier (up to 2.0× for Platinum) is never applied to reward calculations because the tier is never upgraded from the default.

**Files involved:**
- `rezbackend/rez-backend-master/src/models/MerchantLoyaltyTier.ts` — thresholds defined
- `rezbackend/rez-backend-master/src/models/MerchantCustomerSnapshot.ts` — `currentLoyaltyTier` field (never updated)

**Fix:**
After each completed order/payment, call:
```typescript
await upgradeLoyaltyTierIfEligible(userId, merchantId);
```
Where `upgradeLoyaltyTierIfEligible` reads the merchant's tier config, compares against the customer's `totalSpend`, and updates `currentLoyaltyTier` if a higher tier is reached.

---

## M14 — `savings` streak (payment-triggered) used as proxy for store visit streak in display route {#m14}
> **Status:** ⏳ DEFERRED — store visit streak display requires gamification service integration; tracked

**Severity:** MEDIUM
**Impact:** The "store visit streak" display shows payment streak data, not actual visit streak data. A user who pays remotely without visiting the store appears to have a visit streak.

**What is happening:**
`visitStreakRoutes.ts` line 66 uses `type: 'savings'` from `UserStreak` to display "store visit streak". The `savings` streak is triggered by `store_payment_confirmed` events — which fire on any payment, including online payments with no physical visit.

The actual store visit streak (`type: 'store_visit'`) is maintained by `storeVisitStreakWorker.ts` in a separate `userstreaks` collection in the gamification service.

**Files involved:**
- `rezbackend/rez-backend-master/src/routes/visitStreakRoutes.ts:66` — uses `'savings'` type
- `rez-gamification-service/src/workers/storeVisitStreakWorker.ts` — maintains `'store_visit'` type

**Fix:**
`visitStreakRoutes.ts` should fetch `type: 'store_visit'` from the gamification service's `userstreaks` collection (via `GET /streak/:userId`), not use the monolith's `savings` streak as a substitute.

---

## M9-EXTENDED — Streak coin award values differ between gamification worker and monolith streak service

**Severity:** MEDIUM (extends existing bug M9)
**Impact:** Users who earn streaks via different paths receive different coin awards for the same milestone.

| Streak | Gamification worker | Monolith `streakService.ts` |
|--------|--------------------|-----------------------------|
| 7-day store visit | 150 coins | 200 coins (login streak) |
| 30-day store visit | 500 coins | 2,000 coins (login streak) |

Note: these are different streak types (store_visit vs login), but a user comparing notifications will see the discrepancy.

**Files involved:**
- `rez-gamification-service/src/workers/storeVisitStreakWorker.ts` — 3d→50, 7d→150, 30d→500
- `rezbackend/rez-backend-master/src/services/streakService.ts` — `STREAK_MILESTONES.login`: 3d→50, 7d→200, 30d→2000

**Fix:**
Centralize all streak milestone coin values in `rez-shared/constants/streakMilestones.ts` keyed by streak type. All services import from this constant.
