# KARMA UI — ROUND 4 AUDIT (Additional Findings)

**App:** `rez-app-consumer/app/karma/`
**Source:** Round 4 deep audit 2026-04-16
**New Issues:** 27 (4 CRITICAL, 4 HIGH, 18 MEDIUM, 1 LOW)
**Deduplicated:** G-KU-NEW-L2 was withdrawn during analysis

---

## NEW CRITICAL (4)

### G-KU-C4 — `booking.karmaEarned` does not exist on Booking type — always renders hidden

**File:** `app/karma/event/[id].tsx:428-436`
**Severity:** CRITICAL

**Root cause:** `Booking` interface has no `karmaEarned` field. `CheckInResult`/`CheckOutResult` have it, but `Booking` does not. After checkout, karma earned is only in the response — not persisted on the Booking object. `{booking.karmaEarned > 0 && ...}` is always `false`. Users never see their karma earned on the event detail page.

**Fix:**
```tsx
// Option A: Show karma earned from checkout result
const karmaEarned = booking.karmaEarned ?? 0;
// Option B: Fetch latest earn record from getKarmaHistory after checkout
```

---

### G-KU-C5 — `confidenceScore * 100` produces NaN when backend returns null

**File:** `app/karma/event/[id].tsx:426`
**Severity:** CRITICAL

**Root cause:** `booking.confidenceScore` typed as `number`. If backend returns string `"0.85"` or non-numeric value, `Math.round("0.85" * 100)` is `NaN` and renders as `NaN%`.

**Fix:**
```tsx
{typeof booking.confidenceScore === 'number'
  ? `${Math.round(booking.confidenceScore * 100)}%`
  : '—'}
```

---

### G-KU-C6 — Camera QR path not guarded when `activeEventId` is null

**File:** `app/karma/scan.tsx:78-79`
**Severity:** CRITICAL

**Root cause:** Quick actions navigate to `/karma/scan` with no `eventId`. GPS path has a guard with warning. But camera QR scanning path (`handleBarCodeScanned`) checks `if (!qrCode || !activeEventId) return;` but does NOT show an error. User can scan a QR code with null eventId, producing a 400 API error with no user feedback.

**Fix:**
```tsx
const handleBarCodeScanned = useCallback(
  async (result: BarcodeScanningResult) => {
    if (scanState !== 'idle') return;
    const qrCode = result.data;
    if (!qrCode) return;
    if (!activeEventId) {
      Alert.alert('No Event', 'Open this screen from an event page to scan QR codes.');
      return;
    }
```

---

### G-KU-C7 — `ngoApproved` triple-state rendered as two-state

**File:** `app/karma/event/[id].tsx:414-421`
**Severity:** CRITICAL

**Root cause:** Display uses `booking.ngoApproved === false ? 'Rejected' : 'Pending'`. But `ngoApproved` is typed as `boolean` (two states: `true`/`false`). The backend likely sends `null` before NGO approval. `null === false` is `false`, so text always shows "Pending" even after explicit rejection.

**Fix:**
```tsx
ngoApproved: boolean | null; // update type
const ngoStatus = booking.ngoApproved === true ? 'Approved'
  : booking.ngoApproved === false ? 'Rejected'
  : 'Pending';
```

---

## NEW HIGH (4)

### G-KU-H10 — KarmaHeader back button has no `accessibilityLabel`

**File:** `app/karma/_layout.tsx:35-41`
**Severity:** HIGH
**Category:** Accessibility

**Fix:**
```tsx
<Pressable
  accessibilityLabel="Go back"
  accessibilityRole="button"
  accessibilityHint="Returns to the previous screen"
  onPress={() => router.canGoBack() ? router.back() : router.replace('/karma')}
  style={styles.backButton}
  hitSlop={8}
>
```

---

### G-KU-H11 — Quick action pressables have no `accessibilityLabel`

**File:** `app/karma/home.tsx:385-392`
**Severity:** HIGH
**Category:** Accessibility

**Fix:**
```tsx
<Pressable
  key={action.id}
  accessibilityLabel={action.label}
  accessibilityRole="button"
  style={styles.quickAction}
  onPress={action.onPress}
>
```

---

### G-KU-H12 — `KarmaSnapshotCard` re-renders on every parent render

**File:** `app/karma/home.tsx:75-159`
**Severity:** HIGH
**Category:** Performance

**Root cause:** `onPressMyKarma={() => router.push('/karma/my-karma')}` creates a new function reference on every render. `KarmaSnapshotCard` is a plain function component without `React.memo`, so it re-renders on every parent render.

**Fix:**
```tsx
const handleMyKarmaPress = useCallback(() => {
  router.push('/karma/my-karma');
}, [router]);

<KarmaSnapshotCard profile={profile} onPressMyKarma={handleMyKarmaPress} />
```

---

### G-KU-H13 — `openMaps` silently fails and uses incorrect iOS Maps URL scheme

**File:** `app/karma/event/[id].tsx:134-142`
**Severity:** HIGH
**Category:** Functional

**Root cause:** (1) `Linking.openURL(url).catch(() => {})` swallows errors silently. (2) iOS uses `maps:` scheme (Google Maps format) — correct scheme for Apple Maps is `http://maps.apple.com/`. (3) No `canOpenURL` check before opening.

**Fix:**
```tsx
const openMaps = async () => {
  if (!event?.location.coordinates) return;
  const { lat, lng } = event.location.coordinates;
  const label = encodeURIComponent(event.location.address);
  const url = Platform.OS === 'ios'
    ? `http://maps.apple.com/?q=${label}&ll=${lat},${lng}`
    : `geo:${lat},${lng}?q=${label}`;
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) { await Linking.openURL(url); }
    else { Alert.alert('Cannot Open Maps', `Open: ${event.location.address}`); }
  } catch { Alert.alert('Cannot Open Maps', `Open: ${event.location.address}`); }
};
```

---

## NEW MEDIUM (18)

### G-KU-M17 — GPS check-in shows no user-friendly error on failure

**File:** `app/karma/scan.tsx:143-147`
**Severity:** MEDIUM

**Fix:** Map GPS error codes to user-friendly messages:
```tsx
} catch (e: any) {
  let message = 'GPS check-in failed. Please try again.';
  if (e.code === 'Location request failed') {
    message = 'Could not determine your location. Please check location services in Settings.';
  }
  setLastResult({ success: false, message });
  setScanState('error');
}
```

---

### G-KU-M18 — `filteredEvents` dead code variable in Explore screen

**File:** `app/karma/explore.tsx:267`
**Severity:** MEDIUM

**Fix:** Remove `filteredEvents`; use `events` directly in FlashList.

---

### G-KU-M19 — Wallet filter `'all'` not in canonical `CoinType` enum

**File:** `app/karma/wallet.tsx:33, 270, 277`
**Severity:** MEDIUM

**Fix:** Handle `'all'` client-side by fetching both types and merging, or document as client-side convenience.

---

### G-KU-M20 — Wallet transactions do not refresh after balance changes

**File:** `app/karma/wallet.tsx:109-133`
**Severity:** MEDIUM

**Fix:** Trigger wallet refresh via event bus after conversions:
```tsx
useEffect(() => {
  const unsubscribe = eventBus.on('karma:converted', () => fetchData(true));
  return unsubscribe;
}, []);
```

---

### G-KU-M21 — `getKarmaLevel` exported but never called — dead code

**File:** `services/karmaService.ts:193-199`
**Severity:** MEDIUM

**Fix:** Wire it up in `my-karma.tsx` level section or remove entirely.

---

### G-KU-M22 — `scanMode` from URL params never re-syncs on route change

**File:** `app/karma/scan.tsx:44-45`
**Severity:** MEDIUM

**Fix:** Add `useEffect` to sync `mode`:
```tsx
useEffect(() => {
  if (mode === 'checkin' || mode === 'checkout') setScanMode(mode);
}, [mode]);
```

---

### G-KU-M23 — `quickActions` array recreated on every render

**File:** `app/karma/home.tsx:303-336`
**Severity:** MEDIUM

**Fix:** Move to module scope with `as const`:
```tsx
const QUICK_ACTIONS = [
  { id: 'scan', label: 'Scan QR', icon: 'qr-code' as const, color: '#8B5CF6', bg: '#F5F3FF' },
  // ...
] as const;
```

---

### G-KU-M24 — All date displays hardcode `'en-IN'` locale

**Files:** `home.tsx:218,244`; `explore.tsx:131`; `my-karma.tsx:125,157`; `wallet.tsx:63`; `event/[id].tsx:252`
**Severity:** MEDIUM

**Fix:** Use device locale:
```tsx
new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
```

---

### G-KU-M25 — No `onError` handler on `CachedImage` — silent image failures

**Files:** `home.tsx:181,183`; `explore.tsx:69,71,115`; `event/[id].tsx:193,195,226`
**Severity:** MEDIUM

**Fix:**
```tsx
<CachedImage
  source={event.image}
  style={styles.eventImage}
  contentFit="cover"
  onError={() => console.warn(`[KarmaImage] Failed: ${event.image}`)}
/>
```

---

### G-KU-M26 — `Transaction.amount` rendered without number coercion

**File:** `app/karma/wallet.tsx:68-71`
**Severity:** MEDIUM

**Fix:**
```tsx
const displayAmount = typeof tx.amount === 'number' ? tx.amount.toLocaleString() : '—';
```

---

### G-KU-M27 — `LevelProgressBar` re-renders on every parent render

**File:** `app/karma/my-karma.tsx:54-105`
**Severity:** MEDIUM

**Fix:**
```tsx
const LevelProgressBar = React.memo(function LevelProgressBar({ level }: LevelProgressBarProps) {
  // ...
});
```

---

### G-KU-M28 — No `RefreshControl` on event detail scroll view

**File:** `app/karma/event/[id].tsx:185-189`
**Severity:** MEDIUM

**Fix:** Add RefreshControl for pull-to-refresh of booking status.

---

### G-KU-M29 — `LinearGradient` as button container may not cover full pressable area

**File:** `app/karma/event/[id].tsx:451-462`
**Severity:** MEDIUM

**Fix:** Apply gradient colors directly to the Pressable background instead of nesting.

---

### G-KU-M30 — Branded coins section shows hardcoded placeholders in production

**File:** `app/karma/wallet.tsx:342-363`
**Severity:** MEDIUM

**Fix:** Wire to `balance?.brandedCoins` if available, otherwise remove stub:
```tsx
{balance?.brandedCoins && Object.keys(balance.brandedCoins).length > 0 ? (
  Object.entries(balance.brandedCoins).map(([brand, amount]) => ...)
) : null}
```

---

### G-KU-M31 — `KarmaEvent.difficulty` consumer/backend type mismatch (pre-existing, escalating)

**File:** `services/karmaService.ts` vs `src/engines/karmaEngine.ts`
**Severity:** MEDIUM

**Root cause:** Backend uses `difficulty: 'easy' | 'medium' | 'hard'` (string union). Consumer uses same. But canonical `EventDifficulty` in shared-types is `number`. The mismatch between all three layers is unresolved.

**Fix:** Align all three layers to use the canonical enum.

---

### G-KU-M32 — Consumer redefines `KarmaProfile` instead of importing canonical type

**File:** `services/karmaService.ts:13-25` vs `packages/shared-types/src/entities/karma.ts`
**Severity:** MEDIUM

**Fix:** Import `IKarmaProfile` from `@rez/shared-types`, extend with client-only fields:
```tsx
import { IKarmaProfile as KarmaProfile } from '@rez/shared-types';
interface KarmaClientProfile extends KarmaProfile {
  conversionRate: number;
  nextLevelAt: number;
  decayWarning: string | null;
}
```

---

### G-KU-M33 — Consumer redefines `EarnRecordStatus` and `KarmaLevel` instead of importing

**File:** `services/karmaService.ts:17, 134`
**Severity:** MEDIUM

**Fix:** Import from canonical:
```tsx
import { KarmaLevel, EarnRecordStatus } from '@rez/shared-types';
```

---

### G-KU-M34 — `levelHistory` returned by backend but absent from consumer type

**File:** `karmaRoutes.ts:81` returns `levelHistory`; `services/karmaService.ts` has no such field
**Severity:** MEDIUM

**Fix:** Add `levelHistory?: ILevelHistoryEntry[]` to consumer `KarmaProfile` type.

---

### G-KU-M35 — Check-in/check-out responses missing `message` field

**File:** `verifyRoutes.ts:126-131, 173-179` return no `message`
**Severity:** MEDIUM

**Fix:** Add `message: string` to verifyRoutes response bodies (e.g., "Check-in recorded", "Pending NGO approval").

---

## NEW LOW (1)

### G-KU-L4 — Event cards have no `accessibilityLabel`

**Files:** `app/karma/home.tsx:177`; `app/karma/explore.tsx:65`
**Severity:** LOW
**Category:** Accessibility

**Fix:**
```tsx
<Pressable
  accessibilityLabel={`${event.name} by ${event.organizer.name}, ${event.maxKarmaPerEvent} karma points`}
  accessibilityRole="button"
  onPress={onPress}
  style={styles.eventCard}
>
```

---

## Status Summary

| ID | Severity | Title |
|----|----------|-------|
| G-KU-C4 | CRITICAL | `booking.karmaEarned` does not exist on Booking type |
| G-KU-C5 | CRITICAL | `confidenceScore * 100` produces NaN with null backend data |
| G-KU-C6 | CRITICAL | Camera QR path not guarded when `activeEventId` is null |
| G-KU-C7 | CRITICAL | `ngoApproved` triple-state rendered as two-state |
| G-KU-H10 | HIGH | KarmaHeader back button has no `accessibilityLabel` |
| G-KU-H11 | HIGH | Quick action pressables have no `accessibilityLabel` |
| G-KU-H12 | HIGH | `KarmaSnapshotCard` re-renders on every parent render |
| G-KU-H13 | HIGH | `openMaps` silently fails + incorrect iOS Maps URL scheme |
| G-KU-M17 | MEDIUM | GPS check-in shows no user-friendly error on failure |
| G-KU-M18 | MEDIUM | `filteredEvents` dead code variable |
| G-KU-M19 | MEDIUM | Wallet filter `'all'` not in canonical `CoinType` enum |
| G-KU-M20 | MEDIUM | Wallet transactions do not refresh after balance changes |
| G-KU-M21 | MEDIUM | `getKarmaLevel` exported but never called |
| G-KU-M22 | MEDIUM | `scanMode` from URL params never re-syncs on route change |
| G-KU-M23 | MEDIUM | `quickActions` array recreated on every render |
| G-KU-M24 | MEDIUM | All date displays hardcode `'en-IN'` locale |
| G-KU-M25 | MEDIUM | No `onError` on `CachedImage` — silent failures |
| G-KU-M26 | MEDIUM | `Transaction.amount` rendered without number coercion |
| G-KU-M27 | MEDIUM | `LevelProgressBar` re-renders on every parent render |
| G-KU-M28 | MEDIUM | No `RefreshControl` on event detail scroll view |
| G-KU-M29 | MEDIUM | `LinearGradient` button container may not cover full pressable |
| G-KU-M30 | MEDIUM | Branded coins section shows hardcoded placeholders |
| G-KU-M31 | MEDIUM | `KarmaEvent.difficulty` consumer/backend type mismatch |
| G-KU-M32 | MEDIUM | Consumer redefines `KarmaProfile` instead of importing canonical |
| G-KU-M33 | MEDIUM | Consumer redefines `EarnRecordStatus`/`KarmaLevel` instead of importing |
| G-KU-M34 | MEDIUM | `levelHistory` returned by backend but absent from consumer type |
| G-KU-M35 | MEDIUM | Check-in/check-out responses missing `message` field |
| G-KU-L4 | LOW | Event cards have no `accessibilityLabel` |

**Grand total: 47 issues** (20 existing + 27 new)
