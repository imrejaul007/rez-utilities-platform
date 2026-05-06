# RENDEZ APP — CRITICAL GAPS

**App:** `rendez-app/`
**Date:** 2026-04-16
**Severity:** 5 CRITICAL

---

### RZ-M-F1 — Gift Inbox Query Key Invalidation Wrong — Inbox Never Refreshes

**File:** `src/app/GiftInboxScreen.tsx` (lines 35-57)
**Severity:** CRITICAL
**Category:** Functional / Data & Sync
**Status:** ACTIVE

**Code:**
```tsx
// Query is fetched with tab suffix
const { data: gifts = [], ... } = useQuery<Gift[]>({
 queryKey: ['gifts', tab], // includes tab suffix
 queryFn: () => tab === 'received'
   ? walletAPI.getReceivedGifts().then((r) => r.data as Gift[])
   : walletAPI.getSentGifts().then((r) => r.data as Gift[]),
});

// But invalidation uses the parent key only
onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['gifts'] }); // WRONG
 queryClient.invalidateQueries({ queryKey: ['matches'] });
```

**Root Cause:** TanStack Query's partial key matching does NOT match sub-keys by default. `['gifts']` will NOT invalidate `['gifts', tab]`. The 'received' tab will never auto-refresh after an accept/reject. Users see stale gift data.

**Fix:**
```tsx
onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['gifts', tab] }); // correct
 queryClient.invalidateQueries({ queryKey: ['matches'] });
```

---

### RZ-M-F3 — Like Mutation Uses Stale Closure Over `feed` Array

**File:** `src/app/DiscoverScreen.tsx` (lines 302-311)
**Severity:** CRITICAL
**Category:** Functional
**Status:** ACTIVE

**Code:**
```tsx
const likeMutation = useMutation({
 mutationFn: (profileId: string) => matchAPI.like(profileId),
 onSuccess: (data, profileId) => {
  if (data.data.matched) {
   const profile = (feed as Profile[]).find((p) => p.id === profileId) ?? null;
   // `feed` is captured at render time — NOT the current data
```

**Root Cause:** The `feed` variable is captured at render time. If the feed refreshed between the user liking and the mutation completing, `matchedProfile` will be `null` and the match modal shows no avatar despite a successful match.

**Fix:**
```tsx
onSuccess: (data, profileId) => {
 if (data.data.matched) {
  const profile = queryClient.getQueryData<Profile[]>(['discover'])
   ?.find((p) => p.id === profileId) ?? null;
  setMatchedProfile(profile);
 }
},
```

---

### RZ-M-F4 — Photo Removal Is Local-Only — Never Synced to Backend

**File:** `src/app/ProfileEditScreen.tsx` (lines 129-140)
**Severity:** CRITICAL
**Category:** Functional
**Status:** ACTIVE

**Code:**
```tsx
const removePhoto = (index: number) => {
 const newPhotos = [...photos];
 newPhotos.splice(index, 1);
 setPhotos(newPhotos); // NEVER calls API
 // No mutation, no API call to /upload/photo/:index DELETE
};
```

**Root Cause:** The `deletePhoto` API exists in `api.ts:102` but is never called. Deleted photos reappear after app restart because only local state is mutated.

**Fix:**
```tsx
const removePhoto = async (index: number) => {
 const newPhotos = [...photos];
 newPhotos.splice(index, 1);
 setPhotos(newPhotos);
 await profileAPI.deletePhoto(index); // wire the API call
};
```

---

### RZ-M-S1 — Referral Code Stored But Never Consumed

**File:** `src/hooks/useDeepLink.ts` (lines 130-137)
**Severity:** CRITICAL
**Category:** Security
**Status:** ACTIVE

**Code:**
```tsx
case 'invite':
 if (id) {
  import('expo-secure-store').then((SecureStore) => {
   SecureStore.setItemAsync('pending_referral_code', id).catch(() => {}); // stored
  });
 }
 break;
// NEVER read back anywhere in the app
```

**Root Cause:** `pending_referral_code` is stored when a user opens `rendez://invite/CODE` but is **never read or applied**. Users who arrive via invite links have their codes ignored. The entire referral system is broken.

**Fix:** Consume `pending_referral_code` from SecureStore in `ProfileSetupScreen.tsx` or `LoginScreen.tsx` after successful profile creation and apply it via `referralAPI.apply(code)`.

---

### RZ-M-E1 — `profile.name[0]` Crashes on Empty Profile

**File:** `src/app/ProfileDetailScreen.tsx` (line ~191)
**Severity:** CRITICAL
**Category:** Functional
**Status:** ACTIVE

**Code:**
```tsx
<View style={styles.noPhoto}>
 <Text style={styles.noPhotoText}>{profile.name[0]}</Text> // BUG: no guard
</View>
```

**Root Cause:** If `profile.photos.length === 0` AND `profile.name` is an empty string `''`, `profile.name[0]` returns `undefined`. The avatar shows a blank space.

**Fix:**
```tsx
<Text style={styles.noPhotoText}>{profile.name?.[0] || '?'}</Text>
```

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-M-F1 | CRITICAL | Gift inbox query key invalidation wrong | ACTIVE |
| RZ-M-F3 | CRITICAL | Like mutation uses stale closure over feed | ACTIVE |
| RZ-M-F4 | CRITICAL | Photo removal local-only, never synced | ACTIVE |
| RZ-M-S1 | CRITICAL | Referral code stored but never consumed | ACTIVE |
| RZ-M-E1 | CRITICAL | profile.name[0] crashes on empty profile | ACTIVE |
