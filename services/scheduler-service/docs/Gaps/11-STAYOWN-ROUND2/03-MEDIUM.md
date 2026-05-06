# STAYOWN ROUND 2 AUDIT — MEDIUM ISSUES

**Audit Date:** 2026-04-17
**Phase:** Round 2 (new findings across 8 codebases)
**Total:** 18 MEDIUM issues

---

## Functional & API Contract

### R2-M1 — `Invalid Date` Crash in Plan Creation

**File:** `rendez-app/src/app/CreatePlanScreen.tsx:130`
**Severity:** MEDIUM
**Category:** Functional

**Code:**
```tsx
const scheduledAt = new Date(`${scheduledDate}T${scheduledTime || '20:00'}:00`).toISOString();
```

**Root Cause:** If `scheduledDate` is an empty string (user submitted without entering a date), `new Date('T20:00:00')` creates an Invalid Date, and `.toISOString()` throws a RangeError — crashes the mutation with an unhandled exception.

**Fix:**
```tsx
const scheduledAt = scheduledDate && scheduledTime
  ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
  : null;
if (!scheduledAt) { Alert.alert('Error', 'Please enter a valid date and time'); return; }
```

---

### R2-M2 — Non-Null Assertion on `selectedMerchant` — Crash Risk

**File:** `rendez-app/src/app/MeetupScreen.tsx:72, 85`
**Severity:** MEDIUM
**Category:** Functional

**Code:**
```tsx
meetupAPI.book({ matchId, merchantId: selectedMerchant!.merchant_id, ... })
merchantId: selectedMerchant!.merchant_id,
```

**Root Cause:** Non-null assertion (`!`) used on `selectedMerchant`. If `selectedMerchant` is null when the user clicks "Confirm Booking", the app crashes with a TypeError. The UI should prevent navigation to the 'book' step, but defensive programming is missing.

**Fix:**
```tsx
if (!selectedMerchant) return;
```

---

### R2-M3 — Overly Permissive `object` Type in All API Methods

**File:** `rendez-app/src/api/api.ts:34, 36, 48, 70, 79, 80, 120-121, 128, 130`
**Severity:** MEDIUM
**Category:** API Contract / Type Safety

**Code:**
```typescript
create: (data: object) => api.post('/profile', data),
update: (data: object) => api.patch('/profile/me', data),
getFeed: (params?: object) => api.get('/discover', { params }),
send: (data: object) => api.post('/gifts/send', data),
book: (data: object) => api.post('/meetup/book', data),
```

**Root Cause:** All API methods accept `object` type — TypeScript's most permissive type. Callers can pass any arbitrary object and TypeScript won't catch mismatches. The mutations throughout the app use inline object literals that are never validated. If the backend changes a field name, the mismatch is only caught at runtime.

**Fix:** Define typed request/response interfaces for each endpoint:
```typescript
interface CreateProfileRequest { name: string; age: number; city: string; gender: string; interestedIn: string[]; intent?: string; bio?: string }
create: (data: CreateProfileRequest) => api.post('/profile', data),
```

---

### R2-M4 — `voucher.status === 'EXPIRED'` Fails on Null `valid_until`

**File:** `rendez-app/src/app/VoucherScreen.tsx:41`
**Severity:** MEDIUM
**Category:** Functional

**Code:**
```tsx
const isExpired = voucher.status === 'EXPIRED' || new Date(voucher.valid_until) < new Date();
```

**Root Cause:** No null check on `voucher.valid_until`. If the API returns `null` for `valid_until`, `new Date(null)` creates an Invalid Date. Comparing `new Date() < new Date(null)` is always `true` (invalid dates are earlier), so `isExpired` would incorrectly be `true` — hiding the voucher entirely.

**Fix:**
```tsx
const isExpired = voucher.status === 'EXPIRED' ||
  (voucher.valid_until ? new Date(voucher.valid_until) < new Date() : false);
```

---

### R2-M5 — Unsafe Profile Cast in `ChatScreen.tsx`

**File:** `rendez-app/src/app/ChatScreen.tsx:29`
**Severity:** MEDIUM
**Category:** Type Safety

**Code:**
```tsx
const myProfileId = (profile as { id?: string } | null)?.id ?? '';
```

**Root Cause:** Unsafe double cast of the `profile` object. If the `UserProfile` interface changes, this silently breaks. The pattern is repeated in multiple files.

**Fix:** Define a proper type or use the existing `UserProfile` interface:
```typescript
import type { UserProfile } from '../store/authStore';
const myProfileId = (profile as UserProfile | null)?.id ?? '';
```

---

### R2-M6 — Unsafe Profile Cast in `MatchesScreen.tsx` (x2)

**File:** `rendez-app/src/app/MatchesScreen.tsx:69, 83`
**Severity:** MEDIUM
**Category:** Type Safety

**Code:**
```tsx
if ((useAuthStore.getState().profile as { id?: string } | null)?.id) { ... }
return (JSON.parse(decoded) as { sub?: string }).sub ?? '';
```

**Root Cause:** Same pattern as R2-M5 — repeated unsafe casts on `profile` object and JWT payload.

**Fix:** Use proper type definitions instead of inline `as` casts.

---

### R2-M7 — `console.warn` Without `__DEV__` Guard — FCM Token

**File:** `rendez-app/src/hooks/useFcmToken.ts:46`
**Severity:** MEDIUM
**Category:** Security / Info Leakage

**Code:**
```tsx
console.warn('[FCM] Registration failed:', err);
```

**Root Cause:** FCM registration failure details leak to production logs. FCM token registration failures contain sensitive error context.

**Fix:**
```tsx
if (__DEV__) console.warn('[FCM] Registration failed:', err);
```

---

### R2-M8 — `console.warn` Without `__DEV__` Guard — WebSocket Errors

**File:** `rendez-app/src/hooks/useRealtimeChat.ts:92`
**Severity:** MEDIUM
**Category:** Security / Info Leakage

**Code:**
```tsx
console.warn('[WS] Error:', err.code, err.message);
```

**Root Cause:** WebSocket error codes and messages leak to production logs.

**Fix:**
```tsx
if (__DEV__) console.warn('[WS] Error:', err.code, err.message);
```

---

### R2-M9 — Empty Catch Around Haptic Feedback

**File:** `rez-app-admin/components/ui/PrimaryButton.tsx:116`
**Severity:** MEDIUM
**Category:** UX

**Code:**
```tsx
} catch {}
```

**Root Cause:** Haptic feedback failure is silently ignored. Minor UX issue but indicates the pattern of empty catch blocks is normalized in the codebase.

**Fix:** Use `// intentionally silent` comment or remove the try/catch entirely since haptics are non-critical.

---

### R2-M10 — `JSON.parse` Without Try-Catch at Middleware Init (Wallet)

**File:** `rez-wallet-service/src/middleware/internalAuth.ts:7`
**Severity:** MEDIUM
**Category:** Functional

**Code:**
```typescript
const parsed = raw ? JSON.parse(raw) as Record<string, string> : {};
```

**Root Cause:** If `INTERNAL_SERVICE_TOKENS_JSON` env var contains invalid JSON (misconfigured deployment), the service crashes on first request. No startup validation.

**Fix:** Wrap in try-catch with a startup validation check:
```typescript
let parsed: Record<string, string> = {};
try {
  parsed = raw ? JSON.parse(raw) : {};
} catch {
  throw new Error(`FATAL: INTERNAL_SERVICE_TOKENS_JSON is not valid JSON: ${raw}`);
}
```

---

### R2-M11 — `JSON.parse` Without Try-Catch at Middleware Init (Finance)

**File:** `rez-finance-service/src/middleware/auth.ts:113`
**Severity:** MEDIUM
**Category:** Functional

**Code:**
```typescript
const parsed = raw ? JSON.parse(raw) as Record<string, string> : {};
```

**Root Cause:** Same as R2-M10 — misconfigured env var crashes the service on first request.

**Fix:** Same as R2-M10.

---

### R2-M12 — Empty Catch Around Attribution localStorage Write

**File:** `rez-app-consumer/app/picks/[id].tsx:200`
**Severity:** MEDIUM
**Category:** Functional

**Code:**
```tsx
} catch {}
```

**Root Cause:** Attribution tracking via localStorage silently fails. UTM/pick attribution data is lost — campaign attribution breaks silently.

**Fix:**
```tsx
} catch (e) {
  logger.warn('[Attribution] localStorage write failed', e);
}
```

---

### R2-M13 — Empty Catch Around App Settings Load (Web)

**File:** `rez-app-consumer/contexts/AppContext.tsx:245`
**Severity:** MEDIUM
**Category:** Functional

**Code:**
```tsx
} catch {}
```

**Root Cause:** App settings and first-launch flags silently fail to load on web. User preferences are lost with no indication of failure.

**Fix:** Fall back to default settings:
```tsx
} catch {
  // Use default settings on web
  setAppSettings(DEFAULT_SETTINGS);
}
```

---

### R2-M14 — `Math.random()` Fallback in WishlistContext

**File:** `rez-app-consumer/contexts/WishlistContext.tsx:194`
**Severity:** MEDIUM
**Category:** Functional

**Code:**
```typescript
`${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
```

**Root Cause:** Even though the primary path uses crypto, the `Math.random()` fallback executes when `crypto.getRandomValues` is unavailable (SSR, some environments). Creates potentially duplicate wishlist IDs.

**Fix:** Use `uuid` package or `crypto.randomUUID()` without fallback:
```typescript
import { v4 as uuidv4 } from 'uuid';
const id = uuidv4();
```

---

### R2-M15 — NaN Risk from `parseInt` on User Input — guessprice

**File:** `rez-app-consumer/app/playandearn/guessprice.tsx:218, 221, 223`
**Severity:** MEDIUM
**Category:** Functional

**Code:**
```tsx
parseInt(guess)  // lines 218, 221
Math.abs(NaN - actualPrice)  // line 223
```

**Root Cause:** If `guess` is non-numeric, `parseInt` returns `NaN`. The guard `NaN <= 0` is `false`, so the check passes. Subsequent calculations (`Math.abs(NaN - actualPrice) * 100 / actualPrice`) produce `NaN` — user gets a broken result.

**Fix:**
```tsx
const guessNum = parseInt(guess, 10);
if (!Number.isFinite(guessNum) || guessNum <= 0) return;
```

---

### R2-M16 — `photos.length` Accessed Without Null Guard

**File:** `rendez-app/src/app/ProfileScreen.tsx:94`
**Severity:** MEDIUM
**Category:** Functional

**Code:**
```tsx
{p.photos.length > 1 && (
```

**Root Cause:** No null check on `p.photos`. If `photos` is `null` or `undefined`, `p.photos.length` throws a TypeError.

**Fix:**
```tsx
{(p.photos?.length ?? 0) > 1 && (
```

---

### R2-M17 — `photos.length` Accessed Without Null Guard

**File:** `rendez-app/src/app/ProfileDetailScreen.tsx:177-180`
**Severity:** MEDIUM
**Category:** Functional

**Code:**
```tsx
const hasPhotos = profile.photos.length > 0;
const photo = hasPhotos ? profile.photos[photoIdx] : null;
```

**Root Cause:** Same issue — `profile.photos` could be `null` or `undefined`.

**Fix:**
```tsx
const hasPhotos = (profile.photos?.length ?? 0) > 0;
const photo = hasPhotos ? profile.photos![photoIdx] : null;
```

---

### R2-M18 — NaN Guard Missing on Division — Customer Insights

**File:** `rez-app-consumer/services/api/customerInsights.ts:84`
**Severity:** MEDIUM
**Category:** Functional

**Code:**
```typescript
: (d.summary?.avgSpendPerCustomer ?? 0) / (d.summary?.avgOrdersPerCustomer ?? 0),
```

**Root Cause:** `avgOrdersPerCustomer` can be `0` (new store). Dividing by `0` produces `Infinity`, serialized to JSON and sent to the UI — renders as the string "Infinity".

**Fix:**
```typescript
const avgOrders = d.summary?.avgOrdersPerCustomer ?? 0;
averageLTV: avgOrders > 0
  ? (d.summary?.avgSpendPerCustomer ?? 0) / avgOrders
  : 0,
```

---

## Status Summary

| ID | Severity | Title | Source | Status |
|----|----------|-------|--------|--------|
| R2-M1 | MEDIUM | Invalid Date crash in plan creation | Rendez App | ACTIVE |
| R2-M2 | MEDIUM | Non-null assertion on selectedMerchant | Rendez App | ACTIVE |
| R2-M3 | MEDIUM | Overly permissive object type in all API methods | Rendez App | ACTIVE |
| R2-M4 | MEDIUM | isExpired fails on null valid_until | Rendez App | ACTIVE |
| R2-M5 | MEDIUM | Unsafe profile cast in ChatScreen | Rendez App | ACTIVE |
| R2-M6 | MEDIUM | Unsafe profile cast in MatchesScreen (x2) | Rendez App | ACTIVE |
| R2-M7 | MEDIUM | console.warn FCM no __DEV__ guard | Rendez App | ACTIVE |
| R2-M8 | MEDIUM | console.warn WS no __DEV__ guard | Rendez App | ACTIVE |
| R2-M9 | MEDIUM | Empty catch around haptic feedback | ReZ Admin | ACTIVE |
| R2-M10 | MEDIUM | JSON.parse no try-catch at init (wallet) | Wallet Service | ACTIVE |
| R2-M11 | MEDIUM | JSON.parse no try-catch at init (finance) | Finance Service | ACTIVE |
| R2-M12 | MEDIUM | Empty catch around attribution write | Consumer App | ACTIVE |
| R2-M13 | MEDIUM | Empty catch around app settings load | Consumer App | ACTIVE |
| R2-M14 | MEDIUM | Math.random() fallback in WishlistContext | Consumer App | ACTIVE |
| R2-M15 | MEDIUM | NaN risk from parseInt on user input | Consumer App | ACTIVE |
| R2-M16 | MEDIUM | photos.length no null guard (ProfileScreen) | Rendez App | ACTIVE |
| R2-M17 | MEDIUM | photos.length no null guard (ProfileDetail) | Rendez App | ACTIVE |
| R2-M18 | MEDIUM | NaN guard missing on division (customerInsights) | Consumer App | ACTIVE |
