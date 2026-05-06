# RENDEZ BACKEND — MEDIUM GAPS

**Service:** `rendez-backend/`
**Date:** 2026-04-16
**Severity:** 12 MEDIUM (+2 new from deep service audit)

---

### RZ-B-M1 — Plan Expiry Worker Can Overlap with Itself

**File:** `src/workers/planWorkers.ts` (line ~24)
**Severity:** MEDIUM
**Category:** Performance / Edge Case
**Status:** ACTIVE

**Code:**
```typescript
export const planExpiryWorker = new Worker('plan-expiry', async () => {
 // ...
}, { connection: redis }); // NO concurrency limit
```

**Root Cause:** No concurrency limit on the worker. If the worker takes more than 10 minutes (cron interval), a second instance starts before the first finishes.

**Fix:** Add `concurrency: 1` — same as the gift expiry worker.

---

### RZ-B-M2 — Booking-Match Mapping Only in Redis (No DB Backup)

**File:** `src/services/MeetupService.ts` (line ~52)
**Severity:** MEDIUM
**Category:** Data & Sync
**Status:** ACTIVE

**Code:**
```typescript
await redis.setex(`booking:${booking.booking_id}`, 48 * 3600, params.matchId);
```

**Root Cause:** The `bookingId -> matchId` mapping is stored only in Redis with a 48-hour TTL. If Redis is restarted or flushed, subsequent checkins fail validation with no recovery path.

**Fix:** Store the mapping in a `MeetupBooking` table as source of truth, with Redis as a cache layer.

---

### RZ-B-M3 — Unmatch Does Not Clean Up Related Records

**File:** `src/services/MatchService.ts` (lines ~157-164)
**Severity:** MEDIUM
**Category:** Functional
**Status:** ACTIVE

**Code:**
```typescript
async unmatch(profileId: string, matchId: string): Promise<void> {
 await prisma.match.update({ where: { id: matchId }, data: { status: 'UNMATCHED' } });
 // MessageRequest entries NOT cleaned up
 // MessageState entries NOT cleaned up
}
```

**Fix:** Clean up related records in a transaction when unmatching.

---

### RZ-B-M4 — Coordinator Auto-Created with Hardcoded Gender

**File:** `src/routes/admin.ts` (line ~363)
**Severity:** MEDIUM
**Category:** Business Logic
**Status:** ACTIVE

**Code:**
```typescript
organizer = await prisma.profile.create({
 data: {
  gender: 'FEMALE', // default to female for feed boost
  interestedIn: ['MALE', 'FEMALE', 'NON_BINARY'],
 },
});
```

**Fix:** Use a neutral coordinator designation or require explicit gender specification.

---

### RZ-B-M5 — Inbox Has No Pagination

**File:** `src/services/MessageRequestService.ts` (lines ~141-152)
**Severity:** MEDIUM
**Category:** Performance
**Status:** ACTIVE

**Code:**
```typescript
const requests = await prisma.messageRequest.findMany({
 where: { receiverId, status: MessageRequestStatus.PENDING },
 orderBy: { createdAt: 'desc' },
 // NO take/skip pagination
});
```

---

### RZ-B-M6 — Trust Decay Worker Loads All Profiles into Memory

**File:** `src/workers/trustDecayWorker.ts` (lines ~23-43)
**Severity:** MEDIUM
**Category:** Performance
**Status:** ACTIVE

**Fix:** Use `prisma.$executeRaw` for the decay calculation in SQL instead of loading all profiles into memory.

---

### RZ-B-M7 — Silent Notification Failure Without Logging

**File:** `src/services/PlanService.ts` (lines ~355-362)
**Severity:** MEDIUM
**Category:** Functional
**Status:** ACTIVE

**Code:**
```typescript
notif.planSelected(applicantToken, organizerProfile.name, plan.title, match.id).catch(() => {});
```

**Fix:** Add logging for notification failures, even if the notification is best-effort.

---

### RZ-B-M8 — Redis Cache as Only Source of Truth for Booking-Match Mapping

**File:** `src/services/MeetupService.ts` (line ~52)
**Severity:** MEDIUM
**Category:** Architecture / Data & Sync
**Status:** ACTIVE

Duplicate of RZ-B-M2 (same root cause, documented separately for clarity).

---

### RZ-B-M9 — Accept Already-Accepted Request Returns Vague Error

**File:** `src/services/MessageRequestService.ts` (line ~79) + `src/routes/requests.ts` (line ~25)
**Severity:** MEDIUM
**Category:** Functional
**Status:** ACTIVE

The service throws `'Request already responded to'` but doesn't distinguish between "already accepted" vs "already declined."

---

### RZ-B-M10 — Unnecessary DB Re-Fetch After Atomic Update

**File:** `src/services/ExperienceCreditService.ts` (line ~70)
**Severity:** MEDIUM
**Category:** Performance
**Status:** ACTIVE

**Code:**
```typescript
const updated = await prisma.experienceCredit.updateMany({...});
const credit = await prisma.experienceCredit.findUnique({ where: { id: creditId } }); // unnecessary re-fetch
```

---

### RZ-B-M11 — shadowScore Increment Gameable — No Rate Limit on Decline

**File:** `src/services/MessageRequestService.ts` (line ~132)
**Severity:** MEDIUM
**Category:** Business Logic / Security
**Status:** ACTIVE

**Code:**
```typescript
await prisma.profile.update({
  where: { id: requesterId },
  data: { shadowScore: { increment: 2.0 } },
});
```

**Root Cause:** The `shadowScore` is incremented by +2.0 every time a user declines a message request. There is no rate limit on how many requests a user can decline per day. An attacker can spam-decline dozens of random requests to inflate their own `shadowScore`, artificially boosting their profile visibility or gamifying the decline action.

**Fix:** Add a daily decline rate limit (e.g., max 20 declines per day). Track declines in Redis with a TTL. Only increment `shadowScore` if within the limit.

---

### RZ-B-M12 — reportUser Endpoint Has No Rate Limiting

**File:** `src/services/ModerationService.ts` (line ~60) + `src/routes/moderation.ts` (line ~30)
**Severity:** MEDIUM
**Category:** Security / Functional
**Status:** ACTIVE

**Code:**
```typescript
async reportUser(reporterId: string, reportedId: string, reason: string): Promise<void> {
  await prisma.userReport.create({ data: { reporterId, reportedId, reason } });
}
```

**Root Cause:** The `reportUser` endpoint has no rate limiting. A malicious user can programmatically report the same victim hundreds of times per minute, creating a denial-of-service attack against the moderation team and potentially getting the victim incorrectly banned due to volume.

**Fix:** Add rate limiting (e.g., max 10 reports per user per hour). Store report count in Redis with a sliding window TTL.

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-B-M1 | MEDIUM | Plan expiry worker can overlap with itself | ACTIVE |
| RZ-B-M2 | MEDIUM | Booking-match mapping only in Redis | ACTIVE |
| RZ-B-M3 | MEDIUM | Unmatch leaves stale MessageRequest records | ACTIVE |
| RZ-B-M4 | MEDIUM | Coordinator auto-created with hardcoded gender | ACTIVE |
| RZ-B-M5 | MEDIUM | Inbox has no pagination | ACTIVE |
| RZ-B-M6 | MEDIUM | Trust decay worker loads all profiles into memory | ACTIVE |
| RZ-B-M7 | MEDIUM | Silent notification failure without logging | ACTIVE |
| RZ-B-M8 | MEDIUM | Redis only source of truth for booking-match | ACTIVE |
| RZ-B-M9 | MEDIUM | Accept already-accepted request vague error | ACTIVE |
| RZ-B-M10 | MEDIUM | Unnecessary DB re-fetch after atomic update | ACTIVE |
| RZ-B-M11 | MEDIUM | shadowScore increment gameable — no rate limit on decline | ACTIVE |
| RZ-B-M12 | MEDIUM | reportUser endpoint has no rate limiting | ACTIVE |
