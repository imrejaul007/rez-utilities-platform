# KARMA UI — HIGH GAPS

**App:** `rez-app-consumer/app/karma/`
**Date:** 2026-04-16
**Severity:** 7 HIGH

---

### G-KU-H1 — KarmaProfile Diverges from Canonical IKarmaProfile

**File:** `services/karmaService.ts` — lines 13-25 vs `packages/shared-types/src/entities/karma.ts` lines 106-131
**Severity:** HIGH
**Category:** Architecture / Type Safety

**Divergences:**

| Field | Local KarmaProfile | Canonical IKarmaProfile |
|-------|---------------------|-------------------------|
| `_id` | Missing | `string` |
| `eventsJoined` | Missing | `number` |
| `checkIns` | Missing | `number` |
| `approvedCheckIns` | Missing | `number` |
| `avgEventDifficulty` | Missing | `number` |
| `avgConfidenceScore` | Missing | `number` |
| `level` | `'L1' \| 'L2' \| 'L3' \| 'L4'` | `KarmaLevel` enum |
| `conversionRate` | `number` | **Missing** (client-only) |
| `nextLevelAt` | `number` | **Missing** (client-only) |
| `decayWarning` | `string \| null` | **Missing** (client-only) |
| Date fields | `string` | `Date` |

**Fix:** Replace local `KarmaProfile` with import from `@rez/shared-types`, extend with client-only fields:
```typescript
import { IKarmaProfile as KarmaProfile } from '@rez/shared-types';

interface KarmaClientProfile extends KarmaProfile {
  conversionRate: number;  // client-computed
  nextLevelAt: number;    // client-computed
  decayWarning: string | null;
}
```

**Cross-Ref:** `03-CROSS-REF/TYPE-DIVERGENCE.md` — G-CR-X1

**Status:** ACTIVE

---

### G-KU-H2 — CoinType Three-Way Mismatch: branded_coin vs branded

**File:** `app/karma/wallet.tsx` — line 33; `services/karmaService.ts` — line 166; `packages/shared-types/src/enums/index.ts` — lines 71-78
**Severity:** HIGH
**Category:** Enum / Status

**Code:**
```typescript
// wallet.tsx:33 — local UI type:
type CoinType = 'karma_points' | 'rez_coins' | 'all';

// karmaService.ts:166 — Transaction type:
coinType: 'karma_points' | 'rez_coins' | 'branded_coin';  // snake_case

// canonical enum:
export enum CoinType {
  PROMO = 'promo',
  BRANDED = 'branded',    // ← no '_coin' suffix
  PRIVE = 'prive',
  CASHBACK = 'cashback',
  REFERRAL = 'referral',
  REZ = 'rez',
}
```

**Root Cause:** Three-way mismatch. If the backend evolves to return canonical enum values, `COIN_TYPE_CONFIG['branded']` will be `undefined` and fall back to `'all'` config — wrong styling for all branded coin entries.

**Fix:** Align with canonical enum:
```typescript
import { CoinType } from '@rez/shared-types';
// Add 'branded' to the config key mapping
```

**Cross-Ref:** `03-CROSS-REF/ENUM-MISMATCH.md` — G-CR-X2

**Status:** ACTIVE

---

### G-KU-H3 — No Rapid-Scan Debounce — Duplicate API Calls

**File:** `app/karma/scan.tsx` — lines 75-108
**Severity:** HIGH
**Category:** Security / Functional

**Code:**
```tsx
const handleBarCodeScanned = useCallback(
  async (result: BarcodeScanningResult) => {
    if (scanState !== 'idle') return; // ← guard present but...
    // No idempotency key sent to backend
    const res = scanMode === 'checkin'
      ? await karmaService.checkIn(activeEventId, 'qr', qrCode)
      : await karmaService.checkOut(activeEventId, 'qr', qrCode);
```

**Root Cause:** The `scanState !== 'idle'` guard prevents concurrent processing, but once the first request is in-flight, if the camera continues scanning (multiple QR codes in frame, or rapid successive scans), the backend must be idempotent — and the client sends no idempotency key. A retry on network timeout could issue duplicate calls.

**Fix:**
```tsx
const lastScanRef = useRef<string | null>(null);
const handleBarCodeScanned = useCallback(
  async (result: BarcodeScanningResult) => {
    if (scanState !== 'idle') return;
    const qrCode = result.data;
    if (!qrCode || !activeEventId) return;
    if (lastScanRef.current === qrCode) return; // Prevent same-code re-scan
    lastScanRef.current = qrCode;
    // ... proceed
  },
  [scanState, activeEventId, scanMode],
);
```

**Status:** ACTIVE

---

### G-KU-H4 — eventId/mode from useLocalSearchParams Are Stale on Navigation

**File:** `app/karma/scan.tsx` — lines 38-45, 54-72
**Severity:** HIGH
**Category:** Functional / Edge Case

**Code:**
```tsx
const { eventId, mode } = useLocalSearchParams<{ eventId?: string; mode?: string }>();
// ...
const [scanMode, setScanMode] = useState<ScanMode>((mode as ScanMode) ?? 'checkin');
const [activeEventId, setActiveEventId] = useState<string | null>(eventId ?? null);
```

**Root Cause:** `useState` initial values are set once on mount. If the user navigates to the same scan screen with different params (switches from event A to event B), the component does not re-render with the new params. The second open uses stale state from the first mount.

**Fix:**
```tsx
useEffect(() => {
  if (eventId !== activeEventId) setActiveEventId(eventId ?? null);
  if (mode && mode !== scanMode) setScanMode(mode as ScanMode);
}, [eventId, mode]);
```

**Status:** ACTIVE

---

### G-KU-H5 — Empty Catch Block on History Fetch — Silent Failure

**File:** `app/karma/my-karma.tsx` — line 196
**Severity:** HIGH
**Category:** Functional / UX

**Code:**
```tsx
try {
  const [profileRes, historyRes] = await Promise.all([...]);
  if (historyRes.success && historyRes.data) setHistory(historyRes.data.records ?? []);
} catch {
  // non-fatal ← SILENT FAILURE
}
```

**Root Cause:** When `getKarmaHistory` fails, `history` stays at its previous value (or `[]` from initial state). The user sees "No karma earned yet" — indistinguishable from a real empty state vs. a network failure.

**Fix:**
```tsx
const [historyError, setHistoryError] = useState(false);
// ...
} catch {
  setHistoryError(true);
  setTimeout(() => setHistoryError(false), 3000); // auto-dismiss
}
```

**Status:** ACTIVE

---

### G-KU-H6 — EarnRecord Status Unknown Values Silently Fall Back to "Pending"

**File:** `app/karma/my-karma.tsx` — lines 136-142
**Severity:** HIGH
**Category:** Enum / Status

**Code:**
```tsx
const statusConfig = {
  APPROVED_PENDING_CONVERSION: { label: 'Pending', color: '#F59E0B', bg: '#FFFBEB' },
  CONVERTED: { label: 'Converted', color: '#22C55E', bg: '#DCFCE7' },
  REJECTED: { label: 'Rejected', color: '#EF4444', bg: '#FEF2F2' },
  ROLLED_BACK: { label: 'Rolled Back', color: '#6B7280', bg: '#F3F4F6' },
};
const status = statusConfig[record.status] ?? statusConfig.APPROVED_PENDING_CONVERSION;
```

**Root Cause:** Any unexpected status (e.g., `'EXPIRED'` if the backend adds new statuses) silently falls back to "Pending" with a yellow badge. Users see a misleading status.

**Fix:**
```tsx
const status = statusConfig[record.status];
if (!status) {
  console.warn(`[KarmaMyKarma] Unknown earn record status: ${record.status}`);
}
const displayStatus = status ?? { label: 'Unknown', color: '#6B7280', bg: '#F3F4F6' };
```

**Cross-Ref:** EarnRecord status values are consistent between local and canonical types (both use uppercase snake_case). See `03-CROSS-REF/ENUM-MISMATCH.md`.

**Status:** ACTIVE

---

### G-KU-H7 — Booking Response Validation Missing — Empty Object Causes Malformed State

**File:** `app/karma/event/[id].tsx` — lines 56-61; `services/karmaService.ts` — lines 294-296
**Severity:** HIGH
**Category:** Functional / API Contract

**Code:**
```tsx
// event/[id].tsx:56-61
if (bookingRes.success) setBooking(bookingRes.data ?? null);

// karmaService.ts:294-296
async getMyBooking(eventId: string): Promise<ApiResponse<Booking | null>> {
  return apiClient.get<Booking | null>(`/karma/booking/${eventId}`);
}
```

**Root Cause:** `ApiResponse<Booking | null>` means `res.data` is `Booking | null | undefined`. If the backend returns `{}` (empty object) instead of `null`, `res.data` is `{}` (truthy), and `setBooking({})` is called. The booking state has no `_id`, `_type`, or any valid field — all subsequent UI logic treating it as a Booking silently fails.

**Fix:**
```tsx
if (bookingRes.success && bookingRes.data && bookingRes.data._id) {
  setBooking(bookingRes.data);
} else {
  setBooking(null);
}
```

**Status:** ACTIVE

---

### G-KU-H8 — EarnRecord `eventName` Optional in Consumer but Required in Canonical

**File:** `services/karmaService.ts` — line 130
**Severity:** HIGH
**Category:** Enum / Type

**Code:**
```typescript
// Consumer EarnRecord:
eventName?: string; // optional

// Canonical IEarnRecord:
eventName: string; // required
```

**Root Cause:** The consumer defines `eventName` as optional (`?`). The canonical `IEarnRecord` defines it as required. The UI at `my-karma.tsx` line 155 falls back to `'Event'` when undefined, which masks this mismatch at runtime.

**Fix:** Align `eventName` to required, or handle missing data explicitly.

**Status:** ACTIVE

---

### G-KU-H9 — `EarnRecordStatus` and `KarmaLevel` Duplicated Inline Instead of Imported

**File:** `services/karmaService.ts` — lines 17, 134
**Severity:** HIGH
**Category:** Enum / Type

**Code:**
```typescript
// line 17 — inline literal type, not imported:
type KarmaLevel = 'L1' | 'L2' | 'L3' | 'L4';

// line 134 — inline literal type, not imported:
status: 'APPROVED_PENDING_CONVERSION' | 'CONVERTED' | 'REJECTED' | 'ROLLED_BACK';
```

**Root Cause:** The consumer re-defines `KarmaLevel` and `EarnRecordStatus` as inline literal types instead of importing from `@rez/shared-types`. Any change to the canonical values silently breaks the consumer — no compile-time enforcement.

**Fix:**
```typescript
import { KarmaLevel, EarnRecordStatus } from '@rez/shared-types';
```

**Status:** ACTIVE

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| G-KU-H1 | HIGH | KarmaProfile diverges from canonical IKarmaProfile (14 fields missing) | ACTIVE |
| G-KU-H2 | HIGH | CoinType three-way mismatch: branded_coin/branded | ACTIVE |
| G-KU-H3 | HIGH | No rapid-scan debounce — duplicate API calls | ACTIVE |
| G-KU-H4 | HIGH | eventId/mode stale on navigation | ACTIVE |
| G-KU-H5 | HIGH | Empty catch block on history fetch — silent failure | ACTIVE |
| G-KU-H6 | HIGH | EarnRecord unknown statuses fall back to "Pending" | ACTIVE |
| G-KU-H7 | HIGH | Booking response empty object not validated | ACTIVE |
| G-KU-H8 | HIGH | EarnRecord eventName optional in consumer but required in canonical | ACTIVE |
| G-KU-H9 | HIGH | EarnRecordStatus/KarmaLevel duplicated inline instead of imported | ACTIVE |
