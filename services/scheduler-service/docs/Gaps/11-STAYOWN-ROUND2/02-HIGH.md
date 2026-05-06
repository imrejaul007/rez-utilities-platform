# STAYOWN ROUND 2 AUDIT — HIGH ISSUES

**Audit Date:** 2026-04-17
**Phase:** Round 2 (new findings across 8 codebases)
**Total:** 11 HIGH issues

---

## StayOwn / Rendez App — HIGH

### R2-H1 — Empty Catch on `Share.share()` — Silent Failure

**File:** `rendez-app/src/app/VoucherScreen.tsx:27`
**Severity:** HIGH
**Category:** Functional / UX

**Code:**
```tsx
} catch {}
// Share.share() failure silently swallowed
```

**Root Cause:** If sharing fails on Android (permission issues, sharing targets unavailable), the app silently fails. User sees no feedback. Attribution data is lost.

**Fix:**
```tsx
} catch (err) {
  Alert.alert('Share failed', 'Could not share voucher. Please try again.');
}
```

---

### R2-H2 — `parseInt` Without Radix — Two Instances in Same File

**File:** `rez-app-consumer/app/playandearn/guessprice.tsx:218, 221`
**Severity:** HIGH
**Category:** Functional

**Code:**
```tsx
parseInt(guess)  // line 218
parseInt(guess)  // line 221
```

**Root Cause:** `parseInt()` without radix behaves unpredictably across JS engines. Leading zeros may be interpreted as octal. BUG-035 comments exist elsewhere in this file about this issue but the radix is missing here too.

**Fix:** Use `parseInt(guess, 10)` consistently.

---

### R2-H3 — Silent Analytics Failure — `payment-success.tsx`

**File:** `rez-app-consumer/app/payment-success.tsx:234`
**Severity:** HIGH
**Category:** Functional

**Code:**
```tsx
} catch {}
// CHECKOUT_COMPLETED analytics event silently swallowed
```

**Root Cause:** Analytics event tracking (CHECKOUT_COMPLETED with revenue, payment_method, item_count) silently fails if order fetch throws. Financial attribution data is lost — reporting gaps.

**Fix:** Log the error or push to a retry queue:
```tsx
} catch (e) {
  logger.error('[Analytics] CHECKOUT_COMPLETED failed', e);
}
```

---

### R2-H4 — Silent Analytics Failure — `booking.tsx`

**File:** `rez-app-consumer/app/booking.tsx:461`
**Severity:** HIGH
**Category:** Functional

**Code:**
```tsx
} catch {}
// BOOKING_COMPLETED analytics event silently swallowed
```

**Root Cause:** Booking attribution data is lost silently when the analytics event fails.

**Fix:** Same as R2-H3 — log instead of silent swallow.

---

### R2-H5 — Token Response Not Validated — `LoginScreen.tsx`

**File:** `rendez-app/src/app/LoginScreen.tsx:75-76`
**Severity:** HIGH
**Category:** Functional / Security

**Code:**
```tsx
const body = await res.json() as { token: string };
rezToken = body.token;
```

**Root Cause:** Response body is cast as `{ token: string }` without validation. If the backend returns `{ error: string }`, `body.token` is `undefined`, and `authAPI.verifyRezToken(undefined)` sends `"Bearer undefined"` as the Authorization header — silent failure.

**Fix:**
```tsx
const body = await res.json() as { token?: string; error?: string };
if (!body.token) throw new Error(body.error || 'No token received');
rezToken = body.token;
```

---

### R2-H6 — Phone Number Double-Prefix Risk — `LoginScreen.tsx`

**File:** `rendez-app/src/app/LoginScreen.tsx:34-38`
**Severity:** HIGH
**Category:** Functional / Security

**Code:**
```tsx
body: JSON.stringify({ phone: `+91${phone}` }),
```

**Root Cause:** `+91` is prepended unconditionally. If a user enters a number already containing the country code (e.g., "919876543210"), it becomes "+91+919876543210" — an invalid number that either fails silently or sends OTP to the wrong destination.

**Fix:**
```tsx
const cleanPhone = phone.replace(/\D/g, '');
const fullPhone = cleanPhone.startsWith('91') ? `+${cleanPhone}` : `+91${cleanPhone}`;
```

---

### R2-H7 — Guest Confirmation Dot Logic Is Wrong — `PlanConfirmScreen.tsx`

**File:** `rendez-app/src/app/PlanConfirmScreen.tsx:71`
**Severity:** HIGH
**Category:** Functional

**Code:**
```tsx
confirmed={plan.confirmations?.some(
  (c) => c.profileId !== plan.organizer.id
  && plan.confirmations.some((cc) => cc.profileId === c.profileId)
)}
```

**Root Cause:** The logic checks if there exists a non-organizer confirmation whose ID appears more than once in the confirmations array. This does NOT verify that a guest has confirmed — it shows "confirmed" for any scenario with duplicate profile IDs. Completely wrong business logic.

**Fix:**
```tsx
const guestConfirmed = plan.confirmations?.some(
  (c) => c.profileId !== plan.organizer.id
) ?? false;
```

---

### R2-H8 — `setTimeout` Never Cleared — `ChatScreen.tsx`

**File:** `rendez-app/src/app/ChatScreen.tsx:63-66`
**Severity:** HIGH
**Category:** Performance / Memory Leak

**Code:**
```tsx
const [messages, setMessages] = useState([]);
useEffect(() => {
  if (messages.length > 0) {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }
}, [messages.length]);
```

**Root Cause:** A new `setTimeout` is created on every `messages.length` change but never cleared. Each timeout accumulates. In a busy chat, dozens of orphaned timers are created — memory leak and potential performance degradation.

**Fix:**
```tsx
const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => {
  if (messages.length > 0) {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }
}, [messages.length]);
return () => { if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); };
```

---

### R2-H9 — Unbatched `markRead` Race Condition — `ChatScreen.tsx`

**File:** `rendez-app/src/app/ChatScreen.tsx:70-73`
**Severity:** HIGH
**Category:** Functional / Performance

**Code:**
```tsx
useEffect(() => {
  const lastUnread = [...messages].reverse().find(
    (m) => !m.read && m.senderId !== myProfileId
  );
  if (lastUnread) markRead(lastUnread.id);
}, [messages]);
```

**Root Cause:** If 10 messages arrive in rapid succession, 10 `markRead` calls fire simultaneously — one per render. No debouncing or batching. Backend receives a flood of individual read receipt API calls.

**Fix:**
```tsx
const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => {
  if (readTimerRef.current) clearTimeout(readTimerRef.current);
  readTimerRef.current = setTimeout(() => {
    const lastUnread = [...messages].reverse().find(
      (m) => !m.read && m.senderId !== myProfileId
    );
    if (lastUnread) markRead(lastUnread.id);
  }, 500);
}, [messages]);
```

---

### R2-H10 — `FlatList.scrollToIndex` Silently Fails — `OnboardingScreen.tsx`

**File:** `rendez-app/src/app/OnboardingScreen.tsx:54`
**Severity:** HIGH
**Category:** Functional

**Code:**
```tsx
flatListRef.current?.scrollToIndex({ index: next, animated: true });
```

**Root Cause:** React Native's `FlatList.scrollToIndex` is notorious for silently failing when the FlatList has not yet measured its layout. This is a known React Native bug — no error is thrown but the scroll does not happen. Users get stuck on onboarding screens.

**Fix:** Use `onScrollToIndexFailed` with a setTimeout fallback, or measure layout before scrolling.

---

### R2-H11 — Unsafe Blob Cast in Photo Upload — `ProfileEditScreen.tsx`

**File:** `rendez-app/src/app/ProfileEditScreen.tsx:111`
**Severity:** HIGH
**Category:** Functional

**Code:**
```tsx
} as unknown as Blob
```

**Root Cause:** The FormData photo upload constructs an object cast as `Blob` via double cast (`as unknown as Blob`). If the upload API expects a true `Blob` but receives a plain object, the request silently fails or sends corrupted data.

**Fix:** Use React Native's proper `blob` construction or a typed helper:
```tsx
const file = {
  uri: fileUri,
  type: `image/${ext}`,
  name: `photo_${index}.${ext}`,
} as unknown as Blob;
```

---

## Status Summary

| ID | Severity | Title | Source | Status |
|----|----------|-------|--------|--------|
| R2-H1 | HIGH | Empty catch on Share.share() | Rendez App | ACTIVE |
| R2-H2 | HIGH | parseInt without radix (2x) | Consumer App | ACTIVE |
| R2-H3 | HIGH | Silent analytics failure (payment-success) | Consumer App | ACTIVE |
| R2-H4 | HIGH | Silent analytics failure (booking) | Consumer App | ACTIVE |
| R2-H5 | HIGH | Token response not validated | Rendez App | ACTIVE |
| R2-H6 | HIGH | Phone number +91 double-prefix risk | Rendez App | ACTIVE |
| R2-H7 | HIGH | Guest confirmation dot logic wrong | Rendez App | ACTIVE |
| R2-H8 | HIGH | setTimeout never cleared (ChatScreen) | Rendez App | ACTIVE |
| R2-H9 | HIGH | Unbatched markRead race condition | Rendez App | ACTIVE |
| R2-H10 | HIGH | FlatList.scrollToIndex silently fails | Rendez App | ACTIVE |
| R2-H11 | HIGH | Unsafe Blob cast in photo upload | Rendez App | ACTIVE |
