# KARMA UI — LOW GAPS

**App:** `rez-app-consumer/app/karma/`
**Date:** 2026-04-16
**Severity:** 3 LOW

---

### G-KU-L1 — filteredEvents Is a No-Op Variable Assignment

**File:** `app/karma/explore.tsx` — line 267
**Severity:** LOW
**Category:** Code Quality

**Code:**
```tsx
const filteredEvents = events; // ← no-op, same reference
```

**Root Cause:** `filteredEvents` is assigned `events` directly. All filtering happens inside `fetchEvents` before `setEvents(data)`. The variable adds confusion about where filtering occurs.

**Fix:** Use `events` directly, or remove the variable.

**Status:** ACTIVE

---

### G-KU-L2 — Hardcoded Placeholder Partner Names in Branded Coins

**File:** `app/karma/wallet.tsx` — lines 352-359
**Severity:** LOW
**Category:** UX / Data Integrity

**Code:**
```tsx
{['Partner A', 'Partner B', 'Partner C'].map((brand, idx) => (
  // TODO: Replace with dynamic partner data from API
  <View key={brand} ...>
    <Text ...>{brand}</Text>
  </View>
))}
```

**Root Cause:** The comment explicitly says this is placeholder data. Users will see "Partner A", "Partner B", "Partner C" in production. The `WalletBalance` type already has `brandedCoins?: Record<string, number>`, but this data is never fetched or displayed.

**Fix:** Fetch branded coins from `getWalletBalance` and map over `balance.brandedCoins`.

**Status:** ACTIVE

---

### G-KU-L3 — useFocusEffect Refetches on Every Focus

**Files:** `home.tsx` lines 291-295; `my-karma.tsx` lines 207-209; `wallet.tsx` lines 135-139; `explore.tsx` lines 244-248
**Severity:** LOW
**Category:** Performance

**Code:**
```tsx
useFocusEffect(
  useCallback(() => {
    fetchData();
  }, [fetchData]),
);
```

**Root Cause:** The pattern is correct but `useFocusEffect` re-runs on every screen focus. Every time the user switches to the karma tab from another tab, a full data fetch is triggered. For frequently-changing data, this is good. For stable profile data, this is wasteful.

**Fix:** Only refetch if data is stale (>5 min old):
```tsx
useFocusEffect(
  useCallback(() => {
    if (!lastFetch || Date.now() - lastFetch > 5 * 60 * 1000) {
      fetchData();
    }
  }, [fetchData]),
);
```

**Status:** ACTIVE

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| G-KU-L1 | LOW | filteredEvents is a no-op variable | ACTIVE |
| G-KU-L2 | LOW | Hardcoded placeholder partner names | ACTIVE |
| G-KU-L3 | LOW | useFocusEffect refetches on every focus | ACTIVE |
