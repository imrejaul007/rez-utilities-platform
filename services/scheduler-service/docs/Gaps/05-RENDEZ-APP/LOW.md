# RENDEZ APP — LOW GAPS

**App:** `rendez-app/`
**Date:** 2026-04-16
**Severity:** 13 LOW (+4 new from authStore audit)

---

### RZ-M-L1 — No Loading Skeleton for ProfileDetailScreen
**File:** `src/app/ProfileDetailScreen.tsx` (lines 158-164)
**Status:** ACTIVE

Spinner only — no shimmer/skeleton effect.

### RZ-M-L2 — Meetup Camera Has No Graceful Fallback
**File:** `src/app/MeetupScreen.tsx` (lines 118-127)
**Status:** ACTIVE

After denying camera permission, user is stuck — no manual code entry option.

### RZ-M-L3 — Chat Messages Not Sanitized — XSS Risk
**File:** `src/app/ChatScreen.tsx` (line ~126)
**Status:** ACTIVE

Raw text in `<Text>` is safe in React Native by default, but if the app ever renders chat in a WebView, XSS becomes possible.

### RZ-M-L4 — Privacy/Terms Links via Alert Instead of In-App Browser
**File:** `src/app/SettingsScreen.tsx` (lines 163-173)
**Status:** ACTIVE

### RZ-M-L5 — Gift Catalog Fetched Even When Chat Picker Not Shown
**File:** `src/app/ChatScreen.tsx` (lines 45-49)
**Status:** ACTIVE

`enabled: showGiftPicker` prevents fetch but background refetch may still fire.

### RZ-M-L6 — Gift Amount Double-Conversion Risk (see RZ-M-B3)
**File:** `src/app/VoucherScreen.tsx`
**Status:** ACTIVE

### RZ-M-L7 — `referralCount` Extracted But Never Displayed
**File:** `src/app/ProfileScreen.tsx` (lines 27-28)
**Status:** ACTIVE

### RZ-M-L8 — Camera Import Has Dead No-Op Conditional
**File:** `src/app/MeetupScreen.tsx` (lines 7-10)
**Status:** ACTIVE

### RZ-M-L9 — No Expo-Secure-Store TTL — Token Never Expires Locally
**File:** `src/store/authStore.ts` (lines 32-35)
**Status:** ACTIVE

JWT expires server-side but mobile has no refresh token flow.

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-M-L1 | LOW | No loading skeleton for ProfileDetail | ACTIVE |
| RZ-M-L2 | LOW | Camera no manual fallback | ACTIVE |
| RZ-M-L3 | LOW | Chat messages not sanitized | ACTIVE |
| RZ-M-L4 | LOW | Privacy via Alert not in-app browser | ACTIVE |
| RZ-M-L5 | LOW | Gift catalog background refetch | ACTIVE |
| RZ-M-L6 | LOW | Coin conversion double-apply risk | ACTIVE |
| RZ-M-L7 | LOW | referralCount fetched but not displayed | ACTIVE |
| RZ-M-L8 | LOW | Camera import has dead no-op | ACTIVE |
| RZ-M-L9 | LOW | Token no local TTL / refresh flow | ACTIVE |
| RZ-M-L10 | LOW | SecureStore rejection locks app in loading state | ACTIVE |
| RZ-M-L11 | LOW | setToken silently fails if SecureStore throws | ACTIVE |
| RZ-M-L12 | LOW | No token expiry / refresh mechanism | ACTIVE |
| RZ-M-L13 | LOW | UserProfile interface missing `intent` field | ACTIVE |
