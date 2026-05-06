# RENDEZ APP — MEDIUM GAPS

**App:** `rendez-app/`
**Date:** 2026-04-16
**Severity:** 32 MEDIUM (+12 new from deep screen audit)

---

## Functional / API Contract

### RZ-M-F6 — Chat Input Sends Without Any Feedback State
**File:** `src/app/ChatScreen.tsx` (lines 75-86)
**Status:** ACTIVE

### RZ-M-F7 — Chat Lock State Check Includes Wrong States
**File:** `src/app/ChatScreen.tsx` (line ~39)
**Status:** ACTIVE

`'AWAITING_REPLY'` is treated as locked. If the backend allows replying after a free message is sent, users cannot type when they should be able to.

### RZ-M-F8 — Meetup Status Auto-Advance Ignores Dependencies
**File:** `src/app/MeetupScreen.tsx` (lines 64-68)
**Status:** ACTIVE

Dependency array includes `meetupStatus?.bothCheckedIn` (boolean) but not the full object. Effect may not re-run on refetch.

### RZ-M-A1 — Wallet API `status` Filter Never Passed
**File:** `src/api/api.ts` (line ~94)
**Status:** ACTIVE

```typescript
getReceivedGifts: (status?: string) => api.get('/wallet/gifts', { params: { status } }),
// Called as: getReceivedGifts() — status always undefined
```

### RZ-M-A3 — Voucher QR Code Fetched But Never Rendered
**File:** `src/app/VoucherScreen.tsx` (line ~66)
**Status:** ACTIVE

`qr_code_url` is in the response type but the actual `<Image>` is replaced with a static placeholder.

### RZ-M-A4 — Unused `getState` API Export
**File:** `src/api/api.ts` (line ~64)
**Status:** ACTIVE

Method defined but never called anywhere.

### RZ-M-A5 — Meetup Merchant Field Name Mismatch
**File:** `src/app/MeetupScreen.tsx` (lines 14-22)
**Status:** ACTIVE

API returns `merchant_id` but UI displays `merchant.name` (camelCase). Works only if API also returns `merchantName`.

---

## Enum / Status

### RZ-M-E1a — ChatState Type Defined Locally But Used as Untyped String
**File:** `src/app/ChatScreen.tsx` (line ~38)
**Status:** ACTIVE

The `ChatState` type is defined in `MatchesScreen` but never imported into `ChatScreen`. `chatState` is typed as `string`, losing compile-time enum safety.

### RZ-M-E2a — No Enum for Plan Statuses — Raw Strings Throughout
**File:** `src/app/MyPlansScreen.tsx` (lines 13-16)
**Status:** ACTIVE

`Record<string, string>` accepts any key. Typo in status comparison silently renders with `color: undefined`.

### RZ-M-E3 — Confirmation Statuses Not Displayed
**File:** `src/app/PlanConfirmScreen.tsx` (lines 68-72)
**Status:** ACTIVE

Shows dots but never displays actual confirmation timestamp.

---

## Business Logic

### RZ-M-B2 — Booking Date Validation Allows Whitespace-Only String
**File:** `src/app/MeetupScreen.tsx` (line ~161)
**Status:** ACTIVE

```tsx
&& scheduledDate // ' ' is truthy
```

### RZ-M-B3 — Coin Amount Conversion Double-Applied Risk
**File:** `src/app/GiftInboxScreen.tsx` (line ~131)
**Status:** ACTIVE

No shared constant for `amountPaise / 100` conversion. Risk of 100x errors if backend ever changes units.

### RZ-M-B4 — `partySize` Hardcoded to 2
**File:** `src/app/MeetupScreen.tsx` (line ~72)
**Status:** ACTIVE

---

## Real-Time / Socket.IO

### RZ-M-R1 — Socket Reconnection with No Failure Handler
**File:** `src/hooks/useRealtimeChat.ts` (lines 53-54)
**Status:** ACTIVE

```typescript
reconnectionAttempts: 5,
// NO reconnectionAttemptsExhausted handler
```
If all 5 attempts fail, user sees amber "Reconnecting..." banner indefinitely.

### RZ-M-R2 — Typing Indicator Timer Not Reset on Every Keystroke
**File:** `src/app/ChatScreen.tsx` (lines 88-99)
**Status:** ACTIVE

### RZ-M-R3 — Socket Disconnects on App Background — Messages May Be Lost
**File:** `src/hooks/useRealtimeChat.ts` (line ~47)
**Status:** ACTIVE

### RZ-M-R4 — Socket Error Handler Logs But Doesn't Surface to User
**File:** `src/hooks/useRealtimeChat.ts` (lines 91-93)
**Status:** ACTIVE

---

## Offline / Sync

### RZ-M-O1 — No Offline Queue for Chat Messages
**File:** `src/app/ChatScreen.tsx` (lines 103-105)
**Status:** ACTIVE

### RZ-M-O2 — Historical Messages Fetched Fresh on Every Navigation
**File:** `src/app/ChatScreen.tsx` (lines 32-35)
**Status:** ACTIVE

No `staleTime` or persistent cache. Full history re-fetched on every chat open.

### RZ-M-O3 — TanStack Query `retry: 2` Applies to ALL Queries Globally
**File:** `src/app/_layout.tsx` or `App.tsx` (lines ~7-9)
**Status:** ACTIVE

Every failed query waits 2 retries before showing error — 6-12 second delay per failed query.

---

## Performance

### RZ-M-P1a — Confetti Particles Not Memoized
**File:** `src/app/DiscoverScreen.tsx` (lines 23-71)
**Status:** ACTIVE

### RZ-M-P2 — `relativeTime` Function Recreated on Every Render
**File:** `src/app/MatchesScreen.tsx` (lines 46-56)
**Status:** ACTIVE

### RZ-M-P3 — SwipeCard Not Memoized
**File:** `src/app/DiscoverScreen.tsx` (lines 173-287)
**Status:** ACTIVE

---

## Security

### RZ-M-S3 — JWT Decode Uses `atob` — Not Available in React Native
**File:** `src/app/MatchesScreen.tsx` (lines 80-82)
**Status:** ACTIVE

### RZ-M-S4 — Notification Deep Link Has No Auth Guard
**File:** `src/hooks/useDeepLink.ts` (lines 31-53)
**Status:** ACTIVE

---

## UX / Flow

### RZ-M-U1 — Profile Setup Silently Fails on Invalid Age Input
**File:** `src/app/ProfileSetupScreen.tsx` (lines 36-40)
**Status:** ACTIVE

Error handler shows generic "Could not create profile" without indicating which field failed.

### RZ-M-U2 — Chat Input Shows No Character Count
**File:** `src/app/ChatScreen.tsx` (lines 196-204)
**Status:** ACTIVE

### RZ-M-U3 — Share Invite Fails Silently
**File:** `src/app/ProfileScreen.tsx` (lines 25-35)
**Status:** ACTIVE

### RZ-M-U4 — Discover Feed Shows No Error State
**File:** `src/app/DiscoverScreen.tsx` (lines 297-300)
**Status:** ACTIVE

---

## NEW — Navigation / Scroll Issues (Deep Screen Audit)

### RZ-M-A6 — ApplicantsScreen FlatList Scroll Disabled — Screen Completely Unscrollable

**File:** `src/screens/ApplicantsScreen.tsx` (line ~86)
**Severity:** MEDIUM
**Category:** Functional
**Status:** ACTIVE

```tsx
<FlatList
  data={applicants}
  renderItem={renderApplicant}
  keyExtractor={...}
  scrollEnabled={false} // ← WRONG: disables scrolling
  contentContainerStyle={{ paddingBottom: 100 }}
/>
```

**Root Cause:** `scrollEnabled={false}` is set on the FlatList. On Android, this prevents any scrolling of the applicant list. On iOS it works by accident via gesture handler, but it's a bug on both platforms.

**Fix:** Remove `scrollEnabled={false}` or set it to `true`. If the intent was to disable scrolling while loading, use a `!isLoading` guard instead:
```tsx
scrollEnabled={!isLoading}
```

---

### RZ-M-A7 — ApplicantsScreen Has No Pagination

**File:** `src/screens/ApplicantsScreen.tsx` (line ~60)
**Severity:** MEDIUM
**Category:** Performance / Functional
**Status:** ACTIVE

`fetchApplicants()` makes an unparameterized fetch with no `take`/`skip` cursor. All applicants are returned at once. Plan with hundreds of applicants crashes or renders slowly.

**Fix:** Add cursor-based pagination with `take` and `skip` params.

---

### RZ-M-A8 — Settings Screen REZ Wallet Navigates to Wrong Screen

**File:** `src/screens/SettingsScreen.tsx` (line ~120)
**Severity:** MEDIUM
**Category:** UX / Navigation
**Status:** ACTIVE

```tsx
<Pressable onPress={() => router.push('/profile')}>
  <Text>REZ Wallet</Text>
</Pressable>
```

**Root Cause:** Tapping "REZ Wallet" navigates to `/profile` instead of the actual wallet screen. User expects wallet balance and transaction history.

**Fix:** Replace with correct wallet screen path (e.g., `router.push('/wallet')` or `router.push('/rez-wallet')`).

---

### RZ-M-A9 — Settings Screen Gift History Navigates to Wrong Screen

**File:** `src/screens/SettingsScreen.tsx` (line ~125)
**Severity:** MEDIUM
**Category:** UX / Navigation
**Status:** ACTIVE

```tsx
<Pressable onPress={() => router.push('/main')}>
  <Text>Gift History</Text>
</Pressable>
```

**Root Cause:** Tapping "Gift History" navigates to `/main` (the main tab navigator) instead of the actual gift history screen. User cannot access sent/received gifts.

**Fix:** Replace with correct gift history path (e.g., `router.push('/gift-inbox')`).

---

### RZ-M-A10 — Settings Screen Uses Alert.alert for External Links

**File:** `src/screens/SettingsScreen.tsx` (lines ~135-145)
**Severity:** MEDIUM
**Category:** UX / Functional
**Status:** ACTIVE

```tsx
<Pressable onPress={() => Alert.alert('Privacy Policy')}>
  <Text>Privacy Policy</Text>
</Pressable>
<Pressable onPress={() => Alert.alert('Terms of Service')}>
  <Text>Terms of Service</Text>
</Pressable>
<Pressable onPress={() => Alert.alert('Support')}>
  <Text>Support</Text>
</Pressable>
```

**Root Cause:** Tapping Privacy Policy, Terms of Service, or Support shows a native alert dialog with the label instead of opening the actual URL. This is completely non-functional.

**Fix:** Use `Linking.openURL`:
```tsx
import { Linking } from 'react-native';
<Pressable onPress={() => Linking.openURL('https://rez.money/privacy')}>
```

---

### RZ-M-A11 — OnboardingScreen FlatList Scroll Disabled on Android

**File:** `src/screens/OnboardingScreen.tsx` (line ~86)
**Severity:** MEDIUM
**Category:** Functional
**Status:** ACTIVE

```tsx
<FlatList
  data={slides}
  renderItem={renderSlide}
  scrollEnabled={false} // ← disables swipe/scroll on Android
  horizontal
  pagingEnabled
  showsHorizontalScrollIndicator={false}
/>
```

**Root Cause:** `scrollEnabled={false}` on a horizontal paging FlatList. On Android, this prevents users from swiping between onboarding slides. On iOS, gesture handler may allow it to work by accident, but behavior is inconsistent.

**Fix:** Remove `scrollEnabled={false}`. If preventing scroll during animation, use a state guard instead.

---

### RZ-M-A12 — ExperienceWalletScreen Tier Ladder Uses Hardcoded Spend Amounts

**File:** `src/screens/ExperienceWalletScreen.tsx` (lines ~90-105)
**Severity:** MEDIUM
**Category:** Business Logic
**Status:** ACTIVE

```tsx
const tiers = [
  { label: 'Bronze', threshold: 0 },
  { label: 'Silver', threshold: 10000 },   // '10K'
  { label: 'Gold', threshold: 25000 },      // '25K'
  { label: 'Platinum', threshold: 50000 },  // '50K'
];
```

**Root Cause:** Tier spend thresholds are hardcoded (`'10K'`, `'20K'`, `'50K'`). If the backend changes thresholds (e.g., for promotions, regional pricing), the mobile tier ladder shows wrong values. Users may think they qualify for a tier they haven't reached, or vice versa.

**Fix:** Fetch tier thresholds from a backend config endpoint. Fall back to hardcoded defaults only if the API is unavailable.

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-M-F6 | MEDIUM | Chat input sends without feedback | ACTIVE |
| RZ-M-F7 | MEDIUM | Chat lock state check wrong states | ACTIVE |
| RZ-M-F8 | MEDIUM | Meetup auto-advance ignores deps | ACTIVE |
| RZ-M-A1 | MEDIUM | Wallet API status filter never passed | ACTIVE |
| RZ-M-A3 | MEDIUM | Voucher QR never rendered | ACTIVE |
| RZ-M-A4 | MEDIUM | Unused getState API export | ACTIVE |
| RZ-M-A5 | MEDIUM | Meetup merchant field name mismatch | ACTIVE |
| RZ-M-A6 | MEDIUM | ApplicantsScreen FlatList scroll disabled | ACTIVE |
| RZ-M-A7 | MEDIUM | ApplicantsScreen no pagination | ACTIVE |
| RZ-M-A8 | MEDIUM | Settings REZ Wallet navigates to wrong screen | ACTIVE |
| RZ-M-A9 | MEDIUM | Settings Gift History navigates to wrong screen | ACTIVE |
| RZ-M-A10 | MEDIUM | Settings uses Alert.alert for external links | ACTIVE |
| RZ-M-A11 | MEDIUM | OnboardingScreen scroll disabled on Android | ACTIVE |
| RZ-M-A12 | MEDIUM | ExperienceWallet tier thresholds hardcoded | ACTIVE |
| RZ-M-E1a | MEDIUM | ChatState used as untyped string | ACTIVE |
| RZ-M-E2a | MEDIUM | Plan statuses raw strings | ACTIVE |
| RZ-M-E3 | MEDIUM | Confirmation timestamps not shown | ACTIVE |
| RZ-M-B2 | MEDIUM | Booking date allows whitespace | ACTIVE |
| RZ-M-B3 | MEDIUM | Coin conversion double-apply risk | ACTIVE |
| RZ-M-B4 | MEDIUM | partySize hardcoded to 2 | ACTIVE |
| RZ-M-R1 | MEDIUM | Socket reconnection no failure handler | ACTIVE |
| RZ-M-R2 | MEDIUM | Typing indicator timing issue | ACTIVE |
| RZ-M-R3 | MEDIUM | Socket disconnect loses messages | ACTIVE |
| RZ-M-R4 | MEDIUM | Socket errors swallowed | ACTIVE |
| RZ-M-O1 | MEDIUM | No offline queue for chat | ACTIVE |
| RZ-M-O2 | MEDIUM | Messages refetch on every nav | ACTIVE |
| RZ-M-O3 | MEDIUM | Global retry delay on all queries | ACTIVE |
