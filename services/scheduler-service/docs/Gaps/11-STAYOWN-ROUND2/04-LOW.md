# STAYOWN ROUND 2 AUDIT — LOW ISSUES

**Audit Date:** 2026-04-17
**Phase:** Round 2 (new findings across 8 codebases)
**Total:** 10 LOW issues

---

### R2-L1 — Double-Nested Catch Pattern — Analytics Swallowed

**File:** `rez-app-consumer/app/booking.tsx:461-462`
**Severity:** LOW
**Category:** Code Quality

**Code:**
```tsx
} catch {} } catch (error) { ... }
// Outer catches real errors; inner silently swallows analytics failures
```

**Root Cause:** Double-nested catch blocks make error flow confusing. The inner analytics failure is silent while the outer catches real errors. Hard to maintain and debug.

**Fix:** Separate the analytics call from the booking logic, or use `try { } catch { logError() }` for analytics.

---

### R2-L2 — `Math.random()` for Retry Jitter — Inconsistent With Fitness Rules

**File:** `rez-app-consumer/services/billUploadQueueService.ts:724`
**Severity:** LOW
**Category:** Performance

**Code:**
```typescript
const jitter = delay * 0.2 * (Math.random() - 0.5);
```

**Root Cause:** `Math.random()` for retry jitter is acceptable for non-security purposes, but inconsistent with the project's own architectural fitness rules (`no-math-random-for-ids.sh`).

**Fix:** Use a deterministic jitter pattern, or document the non-security exception.

---

### R2-L3 — `Math.random()` for Fallback Cashback Percentage

**File:** `rez-app-consumer/components/homepage/CategoryRecommendationsGrid.tsx:162`
**Severity:** LOW
**Category:** Functional

**Code:**
```typescript
Math.floor(Math.random() * 6) + 5; // 5-10% if not specified
```

**Root Cause:** Fallback percentage is randomized — same product gets different cashback percentages on different loads. Could cause inconsistency in displayed vs. actual cashback.

**Fix:** Use a fixed default (e.g., 7%) instead of random.

---

### R2-L4 — Privacy Policy / Terms Links Not Implemented

**File:** `rendez-app/src/app/SettingsScreen.tsx:163-166`
**Severity:** LOW
**Category:** UX / Compliance

**Code:**
```tsx
Alert.alert('Privacy Policy', 'Visit rendez.in/privacy for full policy.');
```

**Root Cause:** Privacy Policy and Terms links do nothing except show an Alert. This is a compliance gap for iOS App Store (requires functional privacy policy link).

**Fix:** Implement using `Linking.openURL('https://rendez.in/privacy')`.

---

### R2-L5 — Hardcoded Version Number in Settings

**File:** `rendez-app/src/app/SettingsScreen.tsx:226`
**Severity:** LOW
**Category:** Code Quality

**Code:**
```tsx
<Text style={styles.version}>Rendez v1.1.0 · Powered by REZ</Text>
```

**Root Cause:** Hardcoded version number. Should be pulled from `app.config.js` version or an environment variable.

**Fix:** `Text>Rendez v${Constants.expoConfig?.version} · Powered by REZ</Text>`

---

### R2-L6 — Sprint Comments Scattered in AppNavigator

**File:** `rendez-app/src/navigation/AppNavigator.tsx:25, 33, 34, 36, 124, 151, 158`
**Severity:** LOW
**Category:** Code Quality

**Code:**
```typescript
// Sprint 12 — Safety
// Sprint 15 — ...
```

**Root Cause:** Sprint comments scattered throughout the codebase. Should be removed before production.

**Fix:** Remove all sprint comments and replace with meaningful architectural comments where needed.

---

### R2-L7 — Hardcoded Coin Amounts

**File:** `rendez-app/src/app/GiftPickerScreen.tsx:24`
**Severity:** LOW
**Category:** Code Quality

**Code:**
```typescript
const COIN_AMOUNTS = [20, 50, 100, 200];
```

**Root Cause:** Hardcoded values. If business requirements change, must update in multiple places.

**Fix:** Move to a constants file or fetch from a config endpoint.

---

### R2-L8 — Hardcoded Prompt Strings in Plan Creation

**File:** `rendez-app/src/app/PlanDetailScreen.tsx:80-86`
**Severity:** LOW
**Category:** Code Quality

**Code:**
```typescript
const SMART_PROMPTS = [
  'I love trying new places',
  'I play regularly and looking for a partner',
  ...
];
```

**Root Cause:** Hardcoded prompt strings repeated in UI.

**Fix:** Move to a constants file or localize for i18n.

---

### R2-L9 — `unreadCount` Not Bounded — Potential Overflow in Badge

**File:** `rendez-app/src/screens/MatchesScreen.tsx:103`
**Severity:** LOW
**Category:** Performance

**Code:**
```typescript
const totalUnread = matches.reduce((sum, m) => sum + (m.unreadCount || 0), 0);
```

**Root Cause:** No upper bound. Corrupted or malicious server response could return an enormous `unreadCount`. If used for badge display, could overflow.

**Fix:** Cap the result:
```typescript
const totalUnread = Math.min(matches.reduce((sum, m) => sum + (m.unreadCount || 0), 0), 999);
```

---

### R2-L10 — Error Field Inconsistency — `error` vs `message` Across Screens

**File:** Multiple screens in rendez-app
**Severity:** LOW
**Category:** API Contract

**Finding:** Error handling across screens uses different field names:
- `CreatePlanScreen.tsx`: `err.response?.data?.message`
- `ProfileSetupScreen.tsx`: `err.response?.data?.error`
- `GiftPickerScreen.tsx`: `err.response?.data?.error`

**Root Cause:** Backend must consistently use one field name. If any endpoint returns `{ message: "..." }` instead of `{ error: "..." }`, users see "Please try again" instead of the actual error.

**Fix:** Standardize to one field name across all backend endpoints, or normalize in a shared error handler.

---

## Status Summary

| ID | Severity | Title | Source | Status |
|----|----------|-------|--------|--------|
| R2-L1 | LOW | Double-nested catch pattern | Consumer App | ACTIVE |
| R2-L2 | LOW | Math.random() for retry jitter | Consumer App | ACTIVE |
| R2-L3 | LOW | Math.random() for cashback fallback % | Consumer App | ACTIVE |
| R2-L4 | LOW | Privacy/terms links not implemented | Rendez App | ACTIVE |
| R2-L5 | LOW | Hardcoded version number | Rendez App | ACTIVE |
| R2-L6 | LOW | Sprint comments scattered | Rendez App | ACTIVE |
| R2-L7 | LOW | Hardcoded coin amounts | Rendez App | ACTIVE |
| R2-L8 | LOW | Hardcoded prompt strings | Rendez App | ACTIVE |
| R2-L9 | LOW | unreadCount unbounded | Rendez App | ACTIVE |
| R2-L10 | LOW | Error field inconsistency (error vs message) | Rendez App | ACTIVE |
