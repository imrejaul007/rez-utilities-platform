# KARMA UI — CRITICAL GAPS

**App:** `rez-app-consumer/app/karma/`
**Date:** 2026-04-16
**Severity:** 3 CRITICAL

---

### G-KU-C1 — event.totalHours Not in KarmaEvent Type — Runtime Crash

**File:** `app/karma/event/[id].tsx` — line 350
**Service:** `services/karmaService.ts` — lines 43-75
**Severity:** CRITICAL
**Category:** Functional Bug / Type Safety

**Code:**
```tsx
// event/[id].tsx:350 — RUNTIME CRASH
<Text style={styles.impactLabel}>Hours Given</Text>
<Text style={styles.impactNumber}>{event.totalHours}</Text> // NOT DEFINED

// karmaService.ts:63-75 — KarmaEvent interface
export interface KarmaEvent {
  _id: string;
  name: string;
  description: string;
  category: 'environment' | 'food' | 'health' | 'education' | 'community';
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
  expectedDurationHours: number; // ← exists
  // totalHours is NOT here
}
```

**Root Cause:** `KarmaEvent` interface has `expectedDurationHours` but the UI renders `event.totalHours` which is not defined. If the backend returns `totalHours` in the response, TypeScript doesn't know about it. If the backend doesn't return it, the UI renders `undefined`.

**Fix Option A:** Use the existing field:
```tsx
<Text style={styles.impactNumber}>{event.expectedDurationHours}</Text>
```

**Fix Option B:** Add `totalHours` to `KarmaEvent` interface if the backend provides it.

**Cross-Ref:** Related to `IKarmaEvent` in `packages/shared-types/src/entities/karma.ts` — canonical type also lacks `totalHours`.

**Status:** ACTIVE

---

### G-KU-C2 — Fragile Check-In Logic Relies on Status String Instead of Boolean

**File:** `app/karma/event/[id].tsx` — lines 176-177
**Severity:** CRITICAL
**Category:** Functional Bug / API Contract

**Code:**
```tsx
const canCheckIn = isJoined && booking?.status !== 'checked_in' && !booking?.qrCheckedIn;
const canCheckOut = isJoined && booking?.qrCheckedIn && !booking?.qrCheckedOut;
```

**Root Cause:** `booking?.status !== 'checked_in'` is redundant with `!booking?.qrCheckedIn` — if `qrCheckedIn` is `true`, status should be `'checked_in'`. But if the backend ever returns a different status string (e.g., `'confirmed'`), this logic breaks silently. The authoritative field is `qrCheckedIn` boolean, not the status string.

**Fix:** Remove the redundant status check:
```tsx
const canCheckIn = isJoined && !booking?.qrCheckedIn && !booking?.qrCheckedOut;
const canCheckOut = isJoined && booking?.qrCheckedIn && !booking?.qrCheckedOut;
```

**Cross-Ref:** The `Booking` type in `karmaService.ts` uses lowercase snake_case (`'checked_in'`) while canonical shared types may use kebab-case (`'checked-in'`). See `03-CROSS-REF/ENUM-MISMATCH.md`.

**Status:** ACTIVE

---

### G-KU-C3 — KarmaEvent Type Completely Diverges from Canonical IKarmaEvent

**File:** `services/karmaService.ts` — lines 43-75 vs `packages/shared-types/src/entities/karma.ts` lines 137-155
**Severity:** CRITICAL
**Category:** Architecture / Type Safety

**Code:**
```typescript
// LOCAL KarmaEvent (27+ fields):
export interface KarmaEvent {
  _id: string;
  name: string; description: string;
  category: 'environment' | 'food' | 'health' | 'education' | 'community';
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
  expectedDurationHours: number;
  maxVolunteers: number;
  confirmedVolunteers: number;
  verificationMode: 'qr' | 'gps' | 'manual';
  date: string;
  time?: { start: string; end: string };
  location?: { address: string; city: string; coords?: { lat: number; lng: number } };
  // ... 15+ more fields
}

// CANONICAL IKarmaEvent (15 fields):
export interface IKarmaEvent {
  karmaReward: number;      // vs local: maxKarmaPerEvent
  difficulty: number;       // vs local: 'easy' | 'medium' | 'hard'
  maxAttendees: number;     // vs local: maxVolunteers + capacity?.goal
  currentAttendees: number; // vs local: confirmedVolunteers + capacity?.enrolled
  startTime: Date;         // vs local: date + time
  location: { name: string; coords: { lat: number; lng: number } }; // vs address/city/coords
  // category, status, verificationMode: NOT in canonical
}
```

**Root Cause:** The two types share almost no fields in common. The local type enriches the backend model with display-oriented fields (category labels, difficulty strings, verification mode). This is acceptable if intentional, but the divergence must be documented and the types clearly named to prevent silent field drops.

**Fix:** Rename local type to `KarmaEventClient` and document it enriches the backend model:
```typescript
// Client-enriched event type. Backend returns IKarmaEvent; this type adds
// display-oriented fields (category, difficulty labels, verificationMode, etc.)
export interface KarmaEventClient extends Partial<IKarmaEvent> {
  category: 'environment' | 'food' | 'health' | 'education' | 'community';
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
  verificationMode: 'qr' | 'gps' | 'manual';
  expectedDurationHours: number;
  // ... enriched fields
}
```

**Cross-Ref:** See `03-CROSS-REF/TYPE-DIVERGENCE.md` for full field mapping.

**Status:** ACTIVE

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| G-KU-C1 | CRITICAL | event.totalHours not in type — runtime crash | ACTIVE |
| G-KU-C2 | CRITICAL | Fragile check-in logic — status string vs boolean | ACTIVE |
| G-KU-C3 | CRITICAL | KarmaEvent type completely divergent from canonical | ACTIVE |
