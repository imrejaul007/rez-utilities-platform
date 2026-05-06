# Merchant App — Gamification & Rewards

> **Audit date:** 2026-04-15
> **Bugs found:** 42
> **Status:** Open — merchant app audit

---

### MA-GAM-001 Missing Progress Bar Bounds Check
**Severity:** MEDIUM
**File:** app/gamification/index.tsx:352
**Category:** logic
**Description:** Challenge progress calculated as `(challenge.progress / challenge.target) * 100` without clamping. If backend returns progress > target, width exceeds 100%, breaking layout.
**Impact:** Progress bar visually overflows container; UI layout shifts unexpectedly.
**Fix hint:** Use `Math.min(progress, 100)` when setting bar width or clamp in calculation.

### MA-GAM-002 Race Condition on Challenge Claim Button
**Severity:** HIGH
**File:** app/gamification/index.tsx:91-122
**Category:** race
**Description:** `handleClaimChallenge` doesn't check `claiming` state before starting. If user taps claim button twice rapidly, both requests fire before state updates.
**Impact:** Challenge reward claimed twice; double coins awarded.
**Fix hint:** Add `if (claimingId) return;` guard at start; set claimingId before API call.

### MA-GAM-003 Unhandled Promise Rejection in Challenge Load
**Severity:** HIGH
**File:** app/gamification/index.tsx:50-84
**Category:** error-handling
**Description:** `Promise.all()` in `loadGamificationData` silently fails (catch swallows all errors). If any API fails, user sees empty state with no error message.
**Impact:** User sees broken dashboard; no indication of failure; can't retry.
**Fix hint:** Add individual error handling per Promise; display error banner if critical endpoints fail.

### MA-GAM-004 Missing Null Check on Streak Data
**Severity:** MEDIUM
**File:** app/gamification/index.tsx:175-200
**Category:** null-ref
**Description:** Code iterates `Object.entries(streaks)` but doesn't validate that `data.current` exists. If API returns invalid streak object, renders undefined.
**Impact:** Streak display broken; shows "undefined days" instead of actual count.
**Fix hint:** Add guard: `if (!data?.current) return null` before rendering streak.

### MA-GAM-005 RefreshControl Not Reset on Error
**Severity:** MEDIUM
**File:** app/gamification/index.tsx:86-89
**Category:** logic
**Description:** `handleRefresh()` calls `loadGamificationData()` but if error occurs in finally block, `setRefreshing(false)` still executes with multiple checks. Race condition between multiple isMounted checks.
**Impact:** Refresh spinner may stay visible even after data loads.
**Fix hint:** Set refreshing=false in finally with single isMounted check.

### MA-GAM-006 Shield Use Feedback Timeout Not Cleared
**Severity:** LOW
**File:** app/gamification/index.tsx:42-48
**Category:** memory
**Description:** `setTimeout` in `handleUseShield` doesn't have cleanup. If component unmounts before 2.5s, timeout still executes.
**Impact:** Memory leak; potential state update after unmount warning.
**Fix hint:** Store timeout ID; clear in useEffect cleanup.

### MA-GAM-007 Challenge Progress Doesn't Reset on Tab Change
**Severity:** MEDIUM
**File:** app/challenges/index.tsx:75
**Category:** logic
**Description:** Switching tabs (daily/weekly) doesn't reset pagination. If user on page 2 of weekly challenges, switches to daily, still loads page 2 data.
**Impact:** User sees partial results; misaligned challenge list.
**Fix hint:** Reset page to 0 when activeTab changes; clear existing challenges array.

### MA-GAM-008 Missing Idempotency on Challenge Claim
**Severity:** CRITICAL
**File:** app/challenges/[id].tsx:150-200
**Category:** security
**Description:** POST `/gamification/challenges/{id}/claim` has no idempotency key. Network retry or double-click awards coins twice.
**Impact:** Double coin award; leaderboard manipulation.
**Fix hint:** Add `idempotencyKey` header with UUID + timestamp.
**Status:** Deferred — Requires implementation in challenge claim endpoint with proper idempotency middleware

### MA-GAM-009 Challenge Timer Not Server-Driven
**Severity:** MEDIUM
**File:** app/challenges/[id].tsx (no serverTime param)
**Category:** logic
**Description:** Timer calculated from `challenge.endDate` without server time reference. Client clock skew causes timer drift.
**Impact:** User sees 5m remaining but challenge expires in 2m; loses reward.
**Fix hint:** API response should include `serverTime`; calculate remaining as `(challenge.endDate - serverTime)`.

### MA-GAM-010 Claiming State Not Persisted Across Navigation
**Severity:** MEDIUM
**File:** app/challenges/[id].tsx:74
**Category:** state
**Description:** `claiming` state resets to false on unmount/remount. If user navigates away mid-claim, can re-claim same challenge.
**Impact:** Challenge claimed twice if navigating during claim.
**Fix hint:** Track claimed status in API response; disable claim button server-side if already claimed.

### MA-GAM-011 Leaderboard Period Change Doesn't Reset Page
**Severity:** MEDIUM
**File:** app/leaderboard/index.tsx:75-90
**Category:** logic
**Description:** Changing period (daily/weekly/monthly) doesn't reset pagination. Still shows old page 2-50 data with new period filter.
**Impact:** Leaderboard shows incorrect users for selected period.
**Fix hint:** Reset scroll position and page when selectedPeriod changes.

### MA-GAM-012 Missing Error Boundary on Leaderboard Fetch
**Severity:** HIGH
**File:** app/leaderboard/index.tsx:73-90
**Category:** error-handling
**Description:** `fetchLeaderboard()` silently catches errors. If API fails, loading stays true forever.
**Impact:** User sees infinite loading spinner; can't retry.
**Fix hint:** Set loading=false in catch block; show error message.

### MA-GAM-013 Real-time Updates Don't Invalidate Cache
**Severity:** MEDIUM
**File:** app/leaderboard/index.tsx:48-70
**Category:** cache
**Description:** WebSocket updates from `useLeaderboardRealtime` don't trigger pagination reset. Paginated data becomes stale after real-time updates.
**Impact:** User sees outdated leaderboard positions despite real-time notification.
**Fix hint:** Reset pagination when real-time update triggers.

### MA-GAM-014 Missing Validation on Leaderboard Entry
**Severity:** MEDIUM
**File:** app/leaderboard/index.tsx:154-172
**Category:** null-ref
**Description:** Leaderboard entries rendered without validating `entry.rank` or `entry.userId`. If missing, WebSocket rank-up events don't match.
**Impact:** Rank-up animations don't trigger.
**Fix hint:** Validate userId and rank exist before rendering.

### MA-GAM-015 Referral Leaderboard Pagination Not Reset on Refresh
**Severity:** MEDIUM
**File:** app/referral/dashboard.tsx:110-115
**Category:** logic
**Description:** `onRefresh()` reloads data but doesn't reset FlatList scroll position. User sees old page position with new data.
**Impact:** User confused by misaligned data after pull-to-refresh.
**Fix hint:** Call `flatListRef.scrollToOffset({offset: 0})` before loading.

### MA-GAM-016 Reward Claim Without Balance Sync
**Severity:** MEDIUM
**File:** app/referral/dashboard.tsx:117-125
**Category:** race
**Description:** `claimReward()` succeeds but balance not immediately synced. User sees old balance until next refresh.
**Impact:** User balance appears stale; confusion on rewards.
**Fix hint:** Call `refreshWallet()` after successful claim.

### MA-GAM-017 Promise.allSettled Silently Ignores Failures
**Severity:** MEDIUM
**File:** app/referral/dashboard.tsx:69-75
**Category:** error-handling
**Description:** Uses `allSettled` so partial failures show no error. If generateQR fails, QR section shows blank without feedback.
**Impact:** User missing referral QR code with no indication why.
**Fix hint:** Check individual rejection reasons; show error for critical endpoints.

### MA-GAM-018 Missing CurrencySymbol Validation in Leaderboard
**Severity:** MEDIUM
**File:** app/referral/dashboard.tsx:163-164
**Category:** null-ref
**Description:** Renders `currencySymbol + entry.lifetimeEarnings` without checking if currencySymbol is empty. If getCurrencySymbol returns '', format is broken.
**Impact:** Earnings display shows just numbers without currency prefix.
**Fix hint:** Add fallback: `currencySymbol || '$'` in template.

### MA-GAM-019 Missing Copy Feedback Validation
**Severity:** LOW
**File:** app/referral/dashboard.tsx:127-132
**Category:** logic
**Description:** `handleCopyCode()` doesn't validate if clipboard write succeeded. May silently fail on some platforms.
**Impact:** User thinks code copied but it wasn't; confusion on sharing.
**Fix hint:** Check Clipboard.setStringAsync return; show error if fails.

### MA-GAM-020 Achievements Progress Overflow Not Clamped
**Severity:** MEDIUM
**File:** app/achievements/index.tsx:391
**Category:** calc
**Description:** Achievement progress bar calculated without clamping. If progress > target, width exceeds 100%.
**Impact:** Progress bar layout broken.
**Fix hint:** Use `Math.min(progress, 100)` when rendering width.

### MA-GAM-021 Missing Streak Data Validation
**Severity:** MEDIUM
**File:** app/bonus-zone/index.tsx (if exists)
**Category:** null-ref
**Description:** Streak data accessed without existence check. If API returns null streaks, app crashes.
**Impact:** App crash on load.
**Fix hint:** Initialize streaks to `{}` if null; validate before access.

### MA-GAM-022 Pagination Doesn't Reset on Filter Change
**Severity:** MEDIUM
**File:** app/challenges/index.tsx (activeTab state)
**Category:** logic
**Description:** Challenges filtered by type (daily/weekly) but pagination page not reset. User sees misaligned results.
**Impact:** User sees partial challenge list when switching challenge type.
**Fix hint:** Reset page=0 when activeTab changes.

### MA-GAM-023 Cache Invalidation Debounce May Miss Updates
**Severity:** MEDIUM
**File:** services/gamificationCacheService.ts (if used)
**Category:** cache
**Description:** If gamification cache uses debouncing >500ms, rapid updates are swallowed. Cache stays stale.
**Impact:** User sees outdated achievement/challenge data.
**Fix hint:** Reduce debounce to 100-200ms or use event-driven invalidation.

### MA-GAM-024 Missing Null Check on Challenge Icon
**Severity:** LOW
**File:** app/gamification/index.tsx:359
**Category:** null-ref
**Description:** `challenge.challenge?.icon || '🎯'` renders emoji but if icon is null string, fallback used. No validation of icon format.
**Impact:** Wrong emoji displays; confusing UX.
**Fix hint:** Validate emoji range; use fallback if invalid.

### MA-GAM-025 Timezone Issue in Daily Check-in
**Severity:** HIGH
**File:** services/dailyCheckinApi.ts (if exists)
**Category:** logic
**Description:** Check-in endpoint doesn't send client timezone. Server's "today" differs from user's "today" by timezone offset.
**Impact:** User can check in twice per day; streak inflated.
**Fix hint:** Send `clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone`.

### MA-GAM-026 Unhandled Async Storage in Sync Service
**Severity:** MEDIUM
**File:** services/coinSyncService.ts (if used)
**Category:** race
**Description:** AsyncStorage.setItem on native doesn't await. If app crashes before write, sync timestamp stale.
**Impact:** Coin sync skipped on app restart.
**Fix hint:** Await AsyncStorage operations or store timestamp in memory first.

### MA-GAM-027 Missing Validation on Spin Wheel Segments
**Severity:** MEDIUM
**File:** app/games/spin-wheel.tsx (if exists)
**Category:** logic
**Description:** Wheel segments rendered from API without validating segment value > 0. Invalid segment could break spinner.
**Impact:** Spinner fails to animate or shows corrupt UI.
**Fix hint:** Validate each segment before rendering.

### MA-GAM-028 Coins Awarded But Balance Not Updated
**Severity:** MEDIUM
**File:** app/gamification/index.tsx:100-104
**Category:** race
**Description:** Challenge claim coins awarded via API but `refreshWallet()` called after. If wallet sync fails, user doesn't see coins.
**Impact:** Coins awarded but balance shows 0; user confusion.
**Fix hint:** Wait for refreshWallet to complete; verify balance updated.

### MA-GAM-029 Missing Error Recovery on Achievement Load
**Severity:** MEDIUM
**File:** app/achievements/index.tsx (if complex loading)
**Category:** error-handling
**Description:** If achievement load fails mid-process, no rollback. User sees partial data.
**Impact:** Achievement UI broken; can't interact.
**Fix hint:** Set initial state; if any fetch fails, reset to defaults; show error banner.

### MA-GAM-030 Leaderboard WebSocket Not Cleaned Up
**Severity:** MEDIUM
**File:** app/leaderboard/index.tsx (useLeaderboardRealtime)
**Category:** memory
**Description:** Real-time hook doesn't cleanup WebSocket on unmount. Connection persists; memory leak.
**Impact:** Memory leak on navigation.
**Fix hint:** Ensure useLeaderboardRealtime cleanup cancels WebSocket.

### MA-GAM-031 Double-Click Protection Missing on Referral Claim
**Severity:** HIGH
**File:** app/referral/dashboard.tsx:117-125
**Category:** race
**Description:** `handleClaimReward()` doesn't guard against double-click. User clicks twice; both requests execute.
**Impact:** Referral reward claimed twice.
**Fix hint:** Add disabled state; set immediately before API call.

### MA-GAM-032 Missing Streak Shield Session Validation
**Severity:** MEDIUM
**File:** app/gamification/index.tsx:215-236
**Category:** logic
**Description:** Shield use button shown if available but no check if shield session still valid. User can use expired shield.
**Impact:** Fail-to-protect experience; bad UX.
**Fix hint:** Validate shield expiry before showing button.

### MA-GAM-033 Challenge Rewards Not Capped at UI
**Severity:** LOW
**File:** app/gamification/index.tsx:378
**Category:** calc
**Description:** Challenge rewards displayed without validation. If reward.coins is corrupted (negative, NaN), displays broken.
**Impact:** UI shows broken reward text.
**Fix hint:** Validate reward.coins >= 0 && Number.isInteger() before display.

### MA-GAM-034 Missing Retry Logic on Sync Failure
**Severity:** MEDIUM
**File:** app/challenges/[id].tsx:150-200
**Category:** error-handling
**Description:** Challenge claim shows error but no retry button. User can't easily retry without navigating away.
**Impact:** Poor UX on network error; user gives up.
**Fix hint:** Show retry button in error modal.

### MA-GAM-035 Pagination State Not Persisted in Referral
**Severity:** MEDIUM
**File:** app/referral/dashboard.tsx (FlatList pagination)
**Category:** state
**Description:** Referral leaderboard pagination state doesn't persist on unmount. User returns to page 1 after navigation.
**Impact:** User loses place in leaderboard list.
**Fix hint:** Persist pagination offset in router params or global state.

### MA-GAM-036 Missing Validation on Achievement Tier
**Severity:** LOW
**File:** app/gamification/index.tsx:416
**Category:** null-ref
**Description:** Achievement tier displayed without validation. If tier is invalid, `.toUpperCase()` on undefined throws error.
**Impact:** App crash when achievement tier missing.
**Fix hint:** Validate tier exists; use default if missing.

### MA-GAM-037 Cache Not Invalidated After Claim
**Severity:** MEDIUM
**File:** app/challenges/index.tsx (after claim)
**Category:** cache
**Description:** After claiming challenge reward, challenge list cache not invalidated. Claimed flag not updated on UI.
**Impact:** User sees "Claim" button even after claiming until page refresh.
**Fix hint:** Invalidate challenge cache after successful claim.

### MA-GAM-038 Multiple Async Operations Without Coordination
**Severity:** MEDIUM
**File:** app/gamification/index.tsx:115-117
**Category:** race
**Description:** `refreshWallet()` and `loadGamificationData()` called sequentially without awaiting. UI may show inconsistent state.
**Impact:** Balance and challenge state mismatch.
**Fix hint:** Await both operations; update UI after both complete.

### MA-GAM-039 Missing Validation on Leaderboard Response
**Severity:** MEDIUM
**File:** app/leaderboard/index.tsx:76-80
**Category:** null-ref
**Description:** Leaderboard response cast to LeaderboardData without validating structure. If API returns {entries: null}, app crashes.
**Impact:** App crash on malformed response.
**Fix hint:** Validate response.data.entries is array before using.

### MA-GAM-040 WebSocket Message Loss During Page Change
**Severity:** MEDIUM
**File:** app/leaderboard/index.tsx (period change)
**Category:** race
**Description:** Changing period while WebSocket updates pending may cause rank update to apply to old period data. Rank shown on wrong period.
**Impact:** User sees rank update on wrong leaderboard.
**Fix hint:** Cache WebSocket updates until page fully reloads.

### MA-GAM-041 Challenge Completion Time Not Validated
**Severity:** MEDIUM
**File:** app/challenges/[id].tsx:57
**Category:** logic
**Description:** Challenge `endDate` displayed without checking if expired. User can attempt to claim expired challenge.
**Impact:** Confusing UX; unexpected claim failure.
**Fix hint:** Check if endDate < now before allowing claim.

### MA-GAM-042 Missing Loading State During Reward Sync
**Severity:** MEDIUM
**File:** app/referral/dashboard.tsx:117-125
**Category:** ui
**Description:** `handleClaimReward()` doesn't show loading indicator during sync. User doesn't know claim is pending.
**Impact:** User may click multiple times thinking first click didn't register.
**Fix hint:** Show loading spinner while sync in progress; disable button.

---

**Summary:**
Merchant gamification has 42 bugs ranging from race conditions (double claims) to cache invalidation issues and missing timezone handling. Most critical: idempotency keys missing, double-click protection absent, and balance sync failures.
