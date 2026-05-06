# RENDEZ BACKEND — LOW GAPS

**Service:** `rendez-backend/`
**Date:** 2026-04-16
**Severity:** 8 LOW

---

### RZ-B-L1 — `likeLimiter` Uses `req: any` Instead of Typed Request

**File:** `src/middleware/rateLimiter.ts` (line ~54)
**Status:** ACTIVE

### RZ-B-L2 — Redis URL Used Directly Without Pool Settings

**File:** `src/config/redis.ts` (lines ~4-7)
**Status:** ACTIVE

### RZ-B-L3 — Euclidean Distance Approximation Inaccurate at Scale

**File:** `src/services/DiscoveryService.ts` (lines ~107-109)
**Status:** ACTIVE

Uses naive Euclidean distance instead of Haversine formula for proximity scoring.

### RZ-B-L4 — Admin User Search Has No Cursor Pagination

**File:** `src/routes/admin.ts` (line ~110)
**Status:** ACTIVE

### RZ-B-L5 — Duplicate `FraudService` Instantiation

**File:** Multiple services (`GiftService.ts`, `MeetupService.ts`, `RewardService.ts`)
**Status:** ACTIVE

### RZ-B-L6 — Duplicate Queue Definitions

**File:** `src/jobs/queue.ts` vs `src/workers/giftExpiryWorker.ts`
**Status:** ACTIVE

### RZ-B-L7 — Header-Based Idempotency Easily Bypassed

**File:** `src/routes/referral.ts` (lines ~29-38)
**Status:** ACTIVE

### RZ-B-L8 — `AppError` Message Convention Confused with Error Codes

**File:** `src/middleware/errorHandler.ts` (lines ~4-7)
**Status:** ACTIVE

Trailing comma in `throw new AppError(403, 'MSG_LOCKED', )` suggests a third parameter was intended.

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-B-L1 | LOW | `likeLimiter` uses `req: any` | ACTIVE |
| RZ-B-L2 | LOW | Redis URL used directly without pool settings | ACTIVE |
| RZ-B-L3 | LOW | Euclidean distance approximation inaccurate | ACTIVE |
| RZ-B-L4 | LOW | Admin user search no cursor pagination | ACTIVE |
| RZ-B-L5 | LOW | Duplicate FraudService instantiation | ACTIVE |
| RZ-B-L6 | LOW | Duplicate queue definitions | ACTIVE |
| RZ-B-L7 | LOW | Header-based idempotency easily bypassed | ACTIVE |
| RZ-B-L8 | LOW | AppError convention confused with error codes | ACTIVE |
