# Phase 3: Data & UX Fixes

**Timeline:** This Sprint
**Total Issues:** 31 (10 HIGH + 21 MEDIUM)
**Estimated Effort:** ~8 hours

---

## Data/Type Fixes (Priority 1)

### Fix 1: Import Canonical IKarmaProfile (G-CR-X1 + G-KU-H1)

**File:** `services/karmaService.ts` — lines 13-25

```typescript
// REMOVE the local KarmaProfile interface
// ADD at top of file:
import { IKarmaProfile as KarmaProfile, KarmaLevel } from '@rez/shared-types';

// ADD client-only extension:
export interface KarmaClientProfile extends KarmaProfile {
  conversionRate: number;
  nextLevelAt: number;
  decayWarning: string | null;
}
```

Update all usages in `home.tsx`, `my-karma.tsx`, `wallet.tsx` to use `KarmaClientProfile` where client-computed fields are needed.

---

### Fix 2: Import Canonical IKarmaEvent (G-KU-C3)

**File:** `services/karmaService.ts` — lines 43-75

```typescript
// REMOVE the local KarmaEvent interface
// ADD:
import { IKarmaEvent as BaseKarmaEvent } from '@rez/shared-types';

// ADD client-enriched type:
export interface KarmaEventClient extends Partial<IKarmaEvent> {
  category: 'environment' | 'food' | 'health' | 'education' | 'community';
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
  verificationMode: 'qr' | 'gps' | 'manual';
  expectedDurationHours: number;
  maxVolunteers: number;
  confirmedVolunteers: number;
  date: string;
  time?: { start: string; end: string };
  location?: { address: string; city: string; coords?: { lat: number; lng: number } };
  difficulty: 'easy' | 'medium' | 'hard';
  ngoId?: string;
  ngoName?: string;
  // ... all other enriched fields
}
```

---

### Fix 3: Align CoinType with Canonical (G-CR-X2 + G-KU-H2)

**Files:** `services/karmaService.ts`, `app/karma/wallet.tsx`

Update both backend and frontend to use `'branded'` (canonical) instead of `'branded_coin'`. Update `COIN_TYPE_CONFIG` keys to match canonical enum values.

---

### Fix 4: Fix totalHours Runtime Crash (G-KU-C1)

**File:** `app/karma/event/[id].tsx` — line 350

```tsx
// CHANGE:
<Text style={styles.impactNumber}>{event.totalHours}</Text>

// TO (use the field that exists):
<Text style={styles.impactNumber}>{event.expectedDurationHours}</Text>
```

Or add `totalHours` to the `KarmaEventClient` type if the backend provides it.

---

### Fix 5: Fix Fragile Check-In Logic (G-KU-C2)

**File:** `app/karma/event/[id].tsx` — lines 176-177

```tsx
// CHANGE:
const canCheckIn = isJoined && booking?.status !== 'checked_in' && !booking?.qrCheckedIn;

// TO:
const canCheckIn = isJoined && !booking?.qrCheckedIn && !booking?.qrCheckedOut;
```

---

### Fix 6: Validate Booking Response (G-KU-H7)

**File:** `app/karma/event/[id].tsx` — lines 56-61

```tsx
// CHANGE:
if (bookingRes.success) setBooking(bookingRes.data ?? null);

// TO:
if (bookingRes.success && bookingRes.data && bookingRes.data._id) {
  setBooking(bookingRes.data);
} else {
  setBooking(null);
}
```

---

### Fix 7: lastDecayAppliedAt in Schema (G-KS-A1)

**File:** `src/models/KarmaProfile.ts`

```typescript
// ADD to schema:
lastDecayAppliedAt: { type: Date },
```

Remove the `(profile as any)` casts in `karmaService.ts` and `karmaEngine.ts`.

---

### Fix 8: Add Compound Indexes (G-KS-A2)

**File:** `src/models/EarnRecord.ts`

```typescript
// ADD at end of schema definition:
EarnRecordSchema.index({ status: 1, approvedAt: 1, csrPoolId: 1 });
EarnRecordSchema.index({ userId: 1, status: 1, convertedAt: 1 });
```

---

## UX Fixes (Priority 2)

### Fix 9: Add Error Feedback to All Catch Blocks (G-KU-M6 + G-KU-H5)

**Files:** `explore.tsx`, `my-karma.tsx`, `wallet.tsx`, `home.tsx`

Add `error` state to each screen and show a toast/alert on failure:

```typescript
const [error, setError] = useState<string | null>(null);
// ...
} catch (e: any) {
  setError(e.message ?? 'Failed to load data');
  setTimeout(() => setError(null), 3000);
}
// Render: {error && <Text style={styles.error}>{error}</Text>}
```

---

### Fix 10: Rapid-Scan Debounce (G-KU-H3)

**File:** `app/karma/scan.tsx` — lines 75-108

```tsx
const lastScanRef = useRef<string | null>(null);
// ...
if (lastScanRef.current === qrCode) return;
lastScanRef.current = qrCode;
```

---

### Fix 11: Sync Nav Params to State (G-KU-H4)

**File:** `app/karma/scan.tsx` — add useEffect

```tsx
useEffect(() => {
  if (eventId !== activeEventId) setActiveEventId(eventId ?? null);
  if (mode && mode !== scanMode) setScanMode(mode as ScanMode);
}, [eventId, mode]);
```

---

### Fix 12: Auth Guard on Scan Screen (G-KU-M5)

**File:** `app/karma/scan.tsx` — add auth check at component top

Show a login prompt screen if `!isAuthenticated`.

---

### Fix 13: Real-Time Sync (G-KU-M4)

Implement Socket.IO subscription for karma event updates after check-in/check-out. At minimum, force-refresh on navigation back:

```tsx
router.push(`/karma/event/${activeEventId}?refresh=${Date.now()}`);
```

---

### Fix 14: Spinner on Initial Load Only (G-KU-M2)

**Files:** `my-karma.tsx`, `wallet.tsx`

Separate `isInitialLoad` state from `refreshing` state. Only show full-screen spinner on first mount.

---

### Fix 15: Hardcoded Level Thresholds (G-KU-M3)

**File:** `app/karma/home.tsx` — line 128

```tsx
const nextLevelKarma = profile.nextLevelAt ?? levelCfg.next ?? 0;
```

---

### Fix 16: Difficulty Default Handling (G-KU-M7)

**File:** `app/karma/event/[id].tsx` — lines 367-380

Add a warning log for unknown difficulty values and use a neutral fallback.

---

### Fix 17: joinEvent Null Data Error (G-KU-M1)

**File:** `app/karma/event/[id].tsx` — lines 78-85

Validate `res.data._id` exists before setting booking.

---

## Low Priority Tech Debt

See `00-INDEX.md` — LOW section. These can be batched together in a cleanup PR.

---

## Phase 3 Verification Checklist

- [ ] `npm run build` passes
- [ ] TypeScript strict mode passes (all types imported from canonical)
- [ ] `npm test` passes
- [ ] Manual: QR scan shows loading state and handles errors gracefully
- [ ] Manual: Navigate between karma events — params update correctly
- [ ] Manual: Empty history fetch shows error message, not empty state
- [ ] Manual: Spinner only on initial load, not on tab switch
- [ ] Manual: Check-in/check-out flow works end-to-end
