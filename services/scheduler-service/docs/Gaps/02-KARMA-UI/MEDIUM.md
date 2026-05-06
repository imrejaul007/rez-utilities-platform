# KARMA UI — MEDIUM GAPS

**App:** `rez-app-consumer/app/karma/`
**Date:** 2026-04-16
**Severity:** 17 MEDIUM

---

### G-KU-M1 — joinEvent Success With Null Data Shows No Error

**File:** `app/karma/event/[id].tsx` — lines 78-85
**Severity:** MEDIUM
**Category:** Functional / UX

**Code:**
```tsx
const res = await karmaService.joinEvent(event._id);
if (res.success && res.data) {
  setBooking(res.data);
} else {
  alertOk('Error', res.error ?? 'Unable to join event');
}
```

**Root Cause:** If `res.success === true` but `res.data === null` (backend returns `{ success: true, data: null }`), the else branch is NOT triggered. No error is shown. The booking state remains `null` and the user gets no feedback.

**Fix:**
```tsx
if (res.success && res.data && res.data._id) {
  setBooking(res.data);
} else {
  alertOk('Error', res.error ?? 'Unable to join event');
}
```

**Status:** ACTIVE

---

### G-KU-M2 — Full-Screen Spinner on Every Tab Refocus

**Files:** `app/karma/my-karma.tsx` — lines 229-238; `app/karma/wallet.tsx` — lines 99-171
**Severity:** MEDIUM
**Category:** UX / Performance

**Code:**
```tsx
const [loading, setLoading] = useState(true);
// ...
const [history, setHistory] = useState<EarnRecord[]>([]);
// ...
if (loading) {
  return (
    <View style={styles.container}>
      <KarmaHeader title="My Karma" showBack />
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={KARMA_PURPLE} />
      </View>
    </View>
  );
}
```

**Root Cause:** `loading` starts as `true` and only becomes `false` after `fetchData()` resolves. `useFocusEffect` re-triggers `fetchData` on every screen focus. Every time the user refocuses the tab (after checking another app), they see a full-screen loading spinner — even though they just saw the data moments ago.

**Fix:** Use `isInitialLoad` only for first mount:
```tsx
const [isInitialLoad, setIsInitialLoad] = useState(true);
if (isInitialLoad && loading) { /* full spinner */ }
// On refresh, show inline RefreshControl spinner only
```

**Status:** ACTIVE

---

### G-KU-M3 — Level Progress Uses Hardcoded Thresholds Instead of Backend nextLevelAt

**File:** `app/karma/home.tsx` — lines 40-45, 127-129
**Severity:** MEDIUM
**Category:** Business Logic / Data Consistency

**Code:**
```tsx
// home.tsx:40-45
const LEVEL_CONFIG = {
  L1: { label: 'L1', name: 'Seed', color: '#86EFAC', bg: '#DCFCE7', next: 500 },
  L2: { label: 'L2', name: 'Sprout', color: '#67E8F9', bg: '#ECFEFF', next: 2000 },
  // ...
};

// home.tsx:127-129
{profile.activeKarma.toLocaleString()} / {levelCfg.next?.toLocaleString()} to next level
```

**Root Cause:** `KarmaProfile` has `nextLevelAt: number` from the backend, but the UI uses hardcoded `levelCfg.next` values (500, 2000, 5000). If the backend changes L1's threshold to 600, the progress bar shows incorrect progress.

**Fix:**
```tsx
const nextLevelKarma = profile.nextLevelAt ?? levelCfg.next ?? 0;
```

**Status:** ACTIVE

---

### G-KU-M4 — No Real-Time Sync — Check-In Status Goes Stale

**File:** All karma screens
**Severity:** MEDIUM
**Category:** Real-Time Sync

**Root Cause:** None of the karma screens implement real-time updates. After check-in/check-out/join/leave, the UI optimistically updates local state but does not subscribe to any real-time channel. If another device modifies the booking, or if the backend updates the event status, the UI remains stale until manual refresh.

**Fix:** Implement real-time subscription (Socket.IO or event bus). At minimum, force-refresh after mutations:
```tsx
// After successful check-in in scan.tsx:
router.push(`/karma/event/${activeEventId}?refresh=${Date.now()}`);
```

**Status:** ACTIVE

---

### G-KU-M5 — No Auth Guard on Scan Screen; 401 Not Handled Gracefully

**Files:** `app/karma/scan.tsx` — lines 71-91; `app/karma/event/[id].tsx` — lines 71-75
**Severity:** MEDIUM
**Category:** Security / UX

**Code:**
```tsx
// scan.tsx — no auth check before handleGpsCheckIn
// event/[id].tsx — redirects to sign-in but doesn't handle 401 from API
const handleJoin = async () => {
  if (!isAuthenticated) {
    router.push('/sign-in' as any); // ← client-side redirect only
    return;
  }
  // If auth token is expired, API call fails with 401 — no graceful handling
```

**Root Cause:** No auth guard on scan screen. In `event/[id].tsx`, the redirect is client-side only. If `useIsAuthenticated` returns `true` but the token is expired, the server returns 401 and the UI doesn't handle it gracefully.

**Fix:** Add auth guard and 401 handling:
```tsx
const isAuthenticated = useIsAuthenticated();
if (!isAuthenticated) {
  return (
    <View style={styles.container}>
      <KarmaHeader title={scanMode === 'checkin' ? 'Check In' : 'Check Out'} showBack />
      <View style={styles.authRequired}>
        <Text style={styles.authTitle}>Login Required</Text>
        <Pressable style={styles.loginBtn} onPress={() => router.push('/sign-in')}>
          <Text style={styles.loginBtnText}>Sign In</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

**Status:** ACTIVE

---

### G-KU-M6 — Every Catch Block Is Empty // non-fatal

**Files:** `explore.tsx` line 233; `my-karma.tsx` line 196; `wallet.tsx` line 124; `home.tsx` line 283
**Severity:** MEDIUM
**Category:** Functional / UX

**Root Cause:** Every single `fetchData` / `fetchEvents` call uses empty catch blocks. Users see stale/empty data with no indication that a network failure occurred. Makes debugging impossible.

**Fix:** Add local error state and show toast/banner:
```tsx
const [error, setError] = useState<string | null>(null);
// ...
} catch (e: any) {
  setError(e.message ?? 'Failed to load');
  setTimeout(() => setError(null), 3000);
}
```

**Status:** ACTIVE

---

### G-KU-M8 — Stale `event` Reference in Alert Destructive Callback

**File:** `app/karma/event/[id].tsx` — lines 93-122
**Severity:** MEDIUM
**Category:** UI / Stale Closure

**Code:**
```tsx
const handleLeave = async () => {
 if (!event) return;
 Alert.alert(
  'Leave Event',
  'Are you sure?',
  [{
   text: 'Leave',
   style: 'destructive',
   onPress: async () => {
    const res = await karmaService.leaveEvent(event._id); // event captured at Alert-render time
```

**Root Cause:** The Alert's async `onPress` callback captures `event` by closure. If event data refreshes while the Alert is displayed, the callback still references the old event object. Since `handleLeave` is not wrapped in `useCallback`, the stale reference depends on the last render.

**Fix:**
```tsx
const handleLeave = () => {
 const eventId = event?._id;
 if (!eventId) return;
 Alert.alert('Leave Event', 'Are you sure?', [{
  text: 'Leave',
  style: 'destructive',
  onPress: async () => {
   const res = await karmaService.leaveEvent(eventId); // stable at Alert-render time
```

**Status:** ACTIVE

---

### G-KU-M9 — Silent Error Suppression on `Linking.openURL`

**File:** `app/karma/event/[id].tsx` — lines 134-142
**Severity:** MEDIUM
**Category:** UI / Error Handling

**Code:**
```tsx
Linking.openURL(url).catch(() => {}); // ← silent suppression
```

**Root Cause:** `Linking.openURL` fails silently when no maps app is installed or URL is blocked by MDM. User taps the location row, nothing happens, no feedback.

**Fix:**
```tsx
Linking.openURL(url).catch(() => {
 Alert.alert('Cannot Open Maps', 'No maps application found. Use the address above to navigate manually.');
});
```

**Status:** ACTIVE

---

### G-KU-M10 — `Promise.all` Executes Before Early Return in `fetchData`

**File:** `app/karma/home.tsx` — lines 264-289
**Severity:** MEDIUM
**Category:** UI / Race Condition

**Code:**
```tsx
const fetchData = useCallback(async (isRefresh = false) => {
 if (!isRefresh) setLoading(true);
 setProfileError(false);

 const [profileRes, eventsRes] = await Promise.all([  // fires immediately
  isAuthenticated ? karmaService.getKarmaProfile('me') : Promise.resolve({ success: false }),
  karmaService.getNearbyEvents({ status: 'published' }),
 ]);
```

**Root Cause:** `Promise.all` array is evaluated eagerly — both branches are executed before `Promise.all` is called. `getNearbyEvents` fires even when unauthenticated. If it fails, `Promise.resolve({ success: false })` never throws, so `setProfileError(true)` is never called. The component renders as "no events" — indistinguishable from a network failure.

**Fix:** Return early **before** any async work:
```tsx
if (!isAuthenticated) {
 try {
  const eventsRes = await karmaService.getNearbyEvents({ status: 'published' });
  if (eventsRes.success && eventsRes.data) setNearbyEvents(eventsRes.data.slice(0, 10));
 } catch { /* non-fatal */ }
 finally { setLoading(false); setRefreshing(false); }
 return;
}
const [profileRes, eventsRes] = await Promise.all([...]);
```

**Status:** ACTIVE

---

### G-KU-M12 — `event.totalHours` Read But Field Does Not Exist — Should Be `expectedDurationHours`

**File:** `app/karma/event/[id].tsx` — line 350
**Severity:** MEDIUM
**Category:** Functional / Type Safety

**Code:**
```tsx
// Impact card displays:
{event.totalHours?.toFixed(1) ?? '—'} hrs
```

**Root Cause:** The `KarmaEvent` type in `services/karmaService.ts` has no `totalHours` field. The correct field is `expectedDurationHours`. At runtime, `event.totalHours` is `undefined`, so the display always falls back to `'—'`. Users see a blank impact card on every event detail page.

**Fix:**
```tsx
{event.expectedDurationHours?.toFixed(1) ?? '—'} hrs
```

**Status:** ACTIVE

---

### G-KU-M13 — `KarmaBadge.icon` Used in UI But Backend Never Sends It

**File:** `services/karmaService.ts` — line 30; `app/karma/my-karma.tsx` — line 120
**Severity:** MEDIUM
**Category:** Functional / Data Integrity

**Code:**
```typescript
// services/karmaService.ts line 30:
interface KarmaBadge {
 id: string;
 name: string;
 icon?: string; // ← backend never sends this
 earnedAt: string;
}

// my-karma.tsx line 120:
source={badge.icon ? { uri: badge.icon } : defaultIcon}
```

**Root Cause:** The consumer type defines `icon?` as optional, and the UI tries to display it. But the backend (canonical `IBadge` in `packages/shared-types/src/entities/karma.ts`) only defines `{ id, name, earnedAt }` — no `icon` field. Every badge renders with `defaultIcon`. The `icon` field is dead code.

**Fix:** Remove `icon?` from the `KarmaBadge` type and the conditional image rendering.

**Status:** ACTIVE

---

### G-KU-M14 — `Transaction.type` `'converted'` Not in Canonical `CoinTransactionType` Enum

**File:** `services/karmaService.ts` — line 165; `app/karma/wallet.tsx` — lines 35-39
**Severity:** MEDIUM
**Category:** Enum / Type

**Code:**
```typescript
// services/karmaService.ts — custom type not in canonical:
type TransactionType = 'earned' | 'converted' | 'spent' | 'bonus';

// wallet.tsx — maps consumer types to labels:
const txLabel = { earned: 'Earned', converted: 'Converted', spent: 'Spent', bonus: 'Bonus' };

// Canonical CoinTransactionType enum:
enum CoinTransactionType { EARNED='earned', SPENT='spent', BONUS='bonus' } // ← no 'converted'
```

**Root Cause:** Consumer defines its own `TransactionType` values including `'converted'`. The canonical `CoinTransactionType` has no `'converted'` value. If the backend evolves to use canonical enum values, `'converted'` transactions will be unhandled.

**Fix:** Import `CoinTransactionType` from `@rez/shared-types`, replace `'converted'` with canonical value or add it to the enum.

**Status:** ACTIVE

---

### G-KU-M15 — `Booking.status` 5 Values Unverified Against Booking Service

**File:** `services/karmaService.ts` — line 90
**Severity:** MEDIUM
**Category:** Enum / Status

**Code:**
```typescript
interface Booking {
 status: 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled';
}
```

**Root Cause:** The consumer defines booking status values for karma bookings, but the actual booking service likely uses different status strings. The UI at `event/[id].tsx` uses both `booking?.status !== 'checked_in'` AND `!booking?.qrCheckedIn` — the boolean flag is correct, but the string comparison is fragile. If the booking service changes status values, `status !== 'checked_in'` silently stops working.

**Fix:** Use the `qrCheckedIn` boolean flag as the primary check, not the `status` string.

**Status:** ACTIVE

---

### G-KU-M16 — `verificationSignals` Field Names Mismatch With Canonical

**File:** `services/karmaService.ts` — line 135
**Severity:** MEDIUM
**Category:** Type / Data

**Code:**
```typescript
// Consumer (matches backend):
verificationSignals: { qr_in: boolean, qr_out: boolean, gps_match: number, ngo_approved: boolean, photo_proof: boolean }

// Canonical IEarnRecord:
verificationSignals: { gps_match?: number, qr_verified?: boolean, face_verified?: boolean, manual_override?: boolean }
```

**Root Cause:** The consumer uses the backend field names (`qr_in`, `qr_out`, `ngo_approved`, `photo_proof`). The canonical uses different names (`qr_verified`, `face_verified`, `manual_override`). The canonical shape is completely different from what the backend actually sends.

**Fix:** Align consumer `verificationSignals` shape with canonical (requires backend schema fix first — see G-KS-C10).

**Status:** ACTIVE

---

### G-KU-M11 — `finally` Block Ignores `isMounted()` Guard — Inconsistent State on Remount

**File:** `app/karma/my-karma.tsx` — lines 184-205
**Severity:** MEDIUM
**Category:** UI / State Consistency

**Code:**
```tsx
try {
 const [profileRes, historyRes] = await Promise.all([...]);
 if (!isMounted()) return;
 // ... set state ...
} finally {
 if (!isMounted()) return;  // ← redundant guard: if unmounted between line above and here,
 setLoading(false);   // ← called on unmounted component
 setRefreshing(false);
}
```

**Root Cause:** The `finally` block's `isMounted()` guard is redundant and creates a race window. If unmounted between the try-block return and the finally guard, both `setLoading(false)` and `setRefreshing(false)` run on an unmounted component. On immediate remount (tab switch back), `loading` was never restored to `true`, leaving the component in an inconsistent state — renders as "empty" rather than "loading then data."

**Fix:** Remove the redundant guard; guard only data state, not UI-only loading flags:
```tsx
try {
 const [profileRes, historyRes] = await Promise.all([...]);
 if (!isMounted()) return;
 if (profileRes.success && profileRes.data) setProfile(profileRes.data);
} catch { /* non-fatal */ }
finally {
 setLoading(false);
 setRefreshing(false);
}
```

**Status:** ACTIVE

---

### G-KU-M7 — Unknown Difficulty Values Silently Render as "medium"

**Files:** `app/karma/event/[id].tsx` — lines 367-380; `app/karma/explore.tsx` — lines 96-104
**Severity:** MEDIUM
**Category:** Functional / Data Integrity

**Code:**
```tsx
backgroundColor: event.difficulty === 'easy'
  ? '#DCFCE7'
  : event.difficulty === 'hard'
  ? '#FFF1F2'
  : '#EFF6FF', // ← silently defaults to 'medium' for any unknown value
```

**Root Cause:** `KarmaEvent.difficulty` is `'easy' | 'medium' | 'hard'`. If the backend returns an unexpected value (e.g., `'moderate'` or `''`), it silently renders as "medium" with a blue badge — silent data corruption.

**Fix:**
```tsx
const diffColors = {
  easy: { bg: '#DCFCE7', text: '#22C55E' },
  medium: { bg: '#EFF6FF', text: '#3B82F6' },
  hard: { bg: '#FFF1F2', text: '#EF4444' },
} as const;
const diff = diffColors[event.difficulty as keyof typeof diffColors];
if (!diff) console.warn(`[KarmaEventDetail] Unknown difficulty: ${event.difficulty}`);
const cfg = diff ?? diffColors.medium;
```

**Status:** ACTIVE

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| G-KU-M1 | MEDIUM | joinEvent success with null data shows no error | ACTIVE |
| G-KU-M2 | MEDIUM | Full-screen spinner on every tab refocus | ACTIVE |
| G-KU-M3 | MEDIUM | Level progress uses hardcoded thresholds | ACTIVE |
| G-KU-M4 | MEDIUM | No real-time sync — check-in status goes stale | ACTIVE |
| G-KU-M5 | MEDIUM | No auth guard on scan screen; 401 not handled | ACTIVE |
| G-KU-M6 | MEDIUM | Every catch block is empty // non-fatal | ACTIVE |
| G-KU-M7 | MEDIUM | Unknown difficulty silently renders as "medium" | ACTIVE |
| G-KU-M8 | MEDIUM | Stale event reference in Alert destructive callback | ACTIVE |
| G-KU-M9 | MEDIUM | Silent error suppression on Linking.openURL | ACTIVE |
| G-KU-M10 | MEDIUM | Promise.all executes before early return — wasteful + wrong error state | ACTIVE |
| G-KU-M11 | MEDIUM | finally block ignores isMounted guard — inconsistent state on remount | ACTIVE |
| G-KU-M12 | MEDIUM | event.totalHours read but field missing — always shows '—' | ACTIVE |
| G-KU-M13 | MEDIUM | KarmaBadge.icon used in UI but backend never sends it | ACTIVE |
| G-KU-M14 | MEDIUM | Transaction.type 'converted' not in canonical CoinTransactionType | ACTIVE |
| G-KU-M15 | MEDIUM | Booking.status values unverified against booking service | ACTIVE |
| G-KU-M16 | MEDIUM | verificationSignals field names mismatch with canonical | ACTIVE |
