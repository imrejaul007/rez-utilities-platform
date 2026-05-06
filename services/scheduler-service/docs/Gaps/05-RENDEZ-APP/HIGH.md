# RENDEZ APP — HIGH GAPS

**App:** `rendez-app/`
**Date:** 2026-04-16
**Severity:** 11 HIGH (+3 new from deep screen audit)

---

### RZ-M-P1 — No Wallet Balance Check Before Sending Gift

**File:** `src/app/GiftPickerScreen.tsx` (lines 45-54)
**Severity:** HIGH
**Category:** Business Logic / Payment
**Status:** ACTIVE

**Code:**
```tsx
const sendMutation = useMutation({
 mutationFn: (payload: object) => giftAPI.send(payload),
 // No wallet balance check before mutation
 onError: (err) => {
  Alert.alert('Error', err.response?.data?.error || 'Could not send gift'); // generic
 }
});
```

**Root Cause:** Mutation fires without first checking wallet balance. If insufficient, the mutation fails with a cryptic backend error that doesn't indicate a balance problem.

**Fix:** Fetch balance first and show a clear "Insufficient balance" alert before attempting to send:
```tsx
const balance = queryClient.getQueryData<{balance: number}>(['wallet-balance']);
if (balance && giftCost > balance) {
  Alert.alert('Insufficient balance', 'Please top up your wallet first.');
  return;
}
```

---

### RZ-M-F2 — Gift Send Doesn't Invalidate Wallet Balance

**File:** `src/app/GiftPickerScreen.tsx` (lines 47-50)
**Severity:** HIGH
**Category:** Data & Sync
**Status:** ACTIVE

**Code:**
```tsx
onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['messages', matchId] }); // only messages
 // wallet balance NOT invalidated
}
```

**Fix:** Add `queryClient.invalidateQueries({ queryKey: ['wallet-balance'] })`.

---

### RZ-M-F5 — Confirm Modal Dismisses Before Mutation Fires

**File:** `src/app/GiftPickerScreen.tsx` (lines 57-75)
**Severity:** HIGH
**Category:** Functional
**Status:** ACTIVE

**Code:**
```tsx
const handleSend = () => {
 setConfirmVisible(false); // closes modal BEFORE mutation
 sendMutation.mutate(payload);
};
```

**Root Cause:** Closing the modal before the mutation triggers a re-render. If the mutation fails, the user has no confirmation dialog and must navigate back to retry.

**Fix:**
```tsx
const handleSend = () => {
 sendMutation.mutate(payload, {
  onSuccess: () => setConfirmVisible(false),
  onError: () => { /* keep modal open */ }
 });
};
```

---

### RZ-M-D1 — Query Key Mismatch for Gift Inbox (Same Root as RZ-M-F1)

**File:** `src/app/GiftInboxScreen.tsx` (lines 35-42)
**Severity:** HIGH
**Category:** Data & Sync
**Status:** ACTIVE

Duplicate root cause of RZ-M-F1. Both `acceptMutation` and `rejectMutation` invalidate `['gifts']` instead of `['gifts', tab]`.

---

### RZ-M-B1 — `parseInt(age)` Sends NaN to Backend on Text Paste

**File:** `src/app/ProfileSetupScreen.tsx` (lines 36-49)
**Severity:** HIGH
**Category:** Business Logic / Functional
**Status:** ACTIVE

**Code:**
```tsx
const canProceedBasics = name.trim().length >= 2 && parseInt(age) >= 18 && ...;
// On paste of "twenty": parseInt('twenty') === NaN
// NaN >= 18 === false → button disabled. OK.
// But createMutation sends: { age: NaN } to backend
```

**Fix:**
```tsx
const ageNum = parseInt(age);
if (isNaN(ageNum) || ageNum < 18) {
  Alert.alert('Invalid age', 'Please enter a valid age (18+)');
  return;
}
profileAPI.create({ name, age: ageNum, ... });
```

---

### RZ-M-A2 — Experience Credit Consumption Not Properly Invalidated

**File:** `src/app/CreatePlanScreen.tsx` (lines 128-151)
**Severity:** HIGH
**Category:** Data & Sync / API Contract
**Status:** ACTIVE

The plan creation endpoint may internally consume the credit server-side, but the mobile invalidates `experience-credits` by query key name. If the API returns the consumed credit's updated status, the local cache still shows it as AVAILABLE.

---

### RZ-M-E2 — Age Input Allows Non-Numeric Paste — NaN Sent to Backend

**File:** `src/app/ProfileSetupScreen.tsx` (line ~89)
**Severity:** HIGH
**Category:** Functional / Business Logic
**Status:** ACTIVE

**Code:**
```tsx
<TextInput
 value={age}
 onChangeText={setAge} // no numeric guard
 keyboardType="numeric"
 maxLength={2}
```

**Fix:**
```tsx
onChangeText={(t) => setAge(t.replace(/\D/g, '').slice(0, 2))}
```

Note: `LoginScreen.tsx:130` already uses this pattern correctly — apply the same to ProfileSetupScreen.

---

### RZ-M-X1 — `deletePhoto` API Defined But Never Called

**File:** `src/api/api.ts` (line ~102)
**Severity:** HIGH
**Category:** Architecture / Functional
**Status:** ACTIVE

The API method exists:
```typescript
deletePhoto: (index: number) => api.delete(`/upload/photo/${index}`),
```
But is never called from `ProfileEditScreen.tsx`. Photo deletion from the backend is a no-op.

---

### RZ-M-B5 — MeetupScreen Booking Date Format Not Validated

**File:** `src/screens/MeetupScreen.tsx` (line ~95)
**Severity:** HIGH
**Category:** Business Logic / Functional
**Status:** ACTIVE

```tsx
<Input
  placeholder="Select date"
  value={bookingDate}
  onChangeText={setBookingDate}
  // No date format validation
/>
```

**Root Cause:** `bookingDate` is stored as a free-text string. No validation ensures the date is in a format the backend accepts. Backend may reject the booking with a 400 error, leaving the user confused.

**Fix:** Use a date picker component (e.g., `@react-native-community/datetimepicker`) that returns a properly formatted ISO date string. Validate format before mutation.

---

### RZ-M-B8 — ProfileEditScreen Age Field Never Sent in Update

**File:** `src/screens/ProfileEditScreen.tsx` (lines ~200-215)
**Severity:** HIGH
**Category:** Business Logic / Functional
**Status:** ACTIVE

The profile `age` field is:
1. Loaded from the profile (line ~35): `const age = profile.age;`
2. Rendered in the edit form (line ~95): `<TextInput value={String(age)} />`
3. **NOT included** in the `updateMutation.mutate()` payload (lines ~200-215)

```tsx
updateMutation.mutate({
  name,
  bio,
  interestedIn,
  // age is MISSING
});
```

**Root Cause:** The age field was added to the UI but never wired into the update payload. Users cannot update their age through the edit profile screen.

**Fix:** Add `age: parseInt(age)` to the mutate payload.

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-M-P1 | HIGH | No wallet balance check before gift send | ACTIVE |
| RZ-M-F2 | HIGH | Gift send doesn't invalidate wallet balance | ACTIVE |
| RZ-M-F5 | HIGH | Confirm modal dismisses before mutation fires | ACTIVE |
| RZ-M-D1 | HIGH | Query key mismatch for gift inbox | ACTIVE |
| RZ-M-B1 | HIGH | parseInt(age) sends NaN to backend | ACTIVE |
| RZ-M-A2 | HIGH | Experience credit invalidation incorrect | ACTIVE |
| RZ-M-E2 | HIGH | Age input allows non-numeric paste | ACTIVE |
| RZ-M-X1 | HIGH | deletePhoto API defined but never called | ACTIVE |
| RZ-M-B5 | HIGH | MeetupScreen booking date format not validated | ACTIVE |
| RZ-M-B8 | HIGH | ProfileEditScreen age never sent in update | ACTIVE |
