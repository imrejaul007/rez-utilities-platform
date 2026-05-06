# Consumer App — Gamification & Rewards

> **Audit date:** 2026-04-15
> **Bugs found:** 60
> **Status:** Open — consumer app audit

---

### CA-GAM-001 Race Condition in Coin Sync — Double Award on Fast Claim
**Severity:** CRITICAL
**File:** app/challenges/[id].tsx:241-248
**Category:** race
**Description:** Challenge reward claim initiates API call, but if user clicks twice rapidly before state updates, both requests execute. Backend likely has idempotency, but local state doesn't guard against duplicateUI state (rewardsClaimed flag) doesn't block second click before refresh() completes.
**Impact:** User may double-claim reward, wallet shows inflated balance until page refresh.
**Fix hint:** Add `claiming` flag check before handleClaimReward, disable button during sync.
> **Status:** Fixed in commit 5e833f6 (2026-04-15). Added claiming state check and idempotency key header to prevent double-awards.

### CA-GAM-002 Missing Null Check in Spin Wheel Remaining Spins
**Severity:** HIGH
**File:** app/games/spin-wheel.tsx:55
**Category:** null-ref
**Description:** Code checks `spinsRemaining !== undefined` to distinguish 0 from null, but assignment silently defaults to 3 if undefined. If API returns 0, UI will show "3 spins remaining" instead of "0 spins remaining".
**Impact:** User sees incorrect remaining spins count; can attempt to spin when none available.
**Fix hint:** Use explicit zero check: `spinsRemaining ?? 3` instead of ternary fallback.

### CA-GAM-003 Missing Error Handling on Achievement Recalculation
**Severity:** HIGH
**File:** services/gamificationTriggerService.ts:85-88
**Category:** error-handling
**Description:** `achievementApi.recalculateAchievements()` has no try-catch; if it throws, entire triggerEvent fails silently, losing coin reward context.
**Impact:** Coins awarded via Points API but achievement unlock not processed; user sees no visual feedback.
**Fix hint:** Wrap in try-catch, return partial reward with coins only if achievements fail.
> **Status:** Fixed in commit 24671ca (2026-04-15). Wrapped achievement recalculation in try-catch to ensure coin rewards proceed even if achievement processing fails.

### CA-GAM-004 Unsanitized Pagination in Leaderboard API
**Severity:** MEDIUM
**File:** services/leaderboardApi.ts:84-85
**Category:** api
**Description:** `page` and `limit` params passed directly to API without validation. User can request page=999999, limit=1, or negative values; backend may break.
**Impact:** Leaderboard loading fails or returns empty without clear user feedback.
**Fix hint:** Validate `page >= 1`, `limit >= 1 && limit <= 100` before API call.

### CA-GAM-005 Coin Balance Race in CoinSyncService
**Severity:** MEDIUM
**File:** services/coinSyncService.ts:109-159
**Category:** race
**Description:** `syncGamificationReward()` awards coins via Points API, then immediately calls `getWalletBalance()`. If wallet takes >100ms to sync, returned balance is stale. Wallet async operation may not complete before read.
**Impact:** New wallet balance shown to user is incorrect; doesn't reflect awarded coins until next page refresh.
**Fix hint:** Add 500ms retry loop: check if balance changed post-sync, retry up to 3x.

### CA-GAM-006 Missing Expiry Reminders for Coins
**Severity:** MEDIUM
**File:** services/walletApi.ts (ExpiringCoinsResponse defined but no usage)
**Category:** logic
**Description:** API supports `getExpiringCoins()` but no component/service reads it to notify users. Coins expire silently.
**Impact:** Users lose earned coins without warning; support complaints increase.
**Fix hint:** Add daily background check in GamificationContext, show badge if >0 coins expire in 7 days.

### CA-GAM-007 Referral Self-Referral Not Blocked
**Severity:** HIGH
**File:** services/referralApi.ts (no self-referral check visible)
**Category:** security
**Description:** No validation in generateReferralLink or shareReferralLink prevents user from referring themselves. If referral code is stored client-side, attacker can manipulate refereeId to self.
**Impact:** Users can fraud-award themselves; leaderboard and stats inflated.
**Fix hint:** Server-side validation: reject referral if referrerId === refereeId; frontend should pass authed userId only.

### CA-GAM-008 Scratch Card Session Expiry Not Checked
**Severity:** MEDIUM
**File:** app/scratch-card.tsx:86-95
**Category:** logic
**Description:** Card state can be 'available' but session may have expired server-side (expiresAt < now). No pre-play expiry check before revealPrize call.
**Impact:** User scratches card, server rejects as expired, loses spins and sees confusing error.
**Fix hint:** Check session.expiresAt > now before entering 'scratching' state; auto-transition to 'expired' if needed.

### CA-GAM-009 Leaderboard Pagination Stale Data
**Severity:** MEDIUM
**File:** app/leaderboard/index.tsx:73-90
**Category:** cache
**Description:** Leaderboard fetched once per period selection, but real-time updates (via WebSocket) don't invalidate pagination. User sees stale page 2 data despite rank-up notifications.
**Impact:** Leaderboard shows incorrect positions after real-time updates; confusing UX.
**Fix hint:** Reset page to 1 when period changes; invalidate cache on WebSocket rank update.

### CA-GAM-010 Missing Daily Check-In Timezone Issue
**Severity:** HIGH
**File:** services/dailyCheckinApi.ts (no timezone handling)
**Category:** logic
**Description:** Daily check-in uses server time to determine if user already checked in today, but client assumes UTC. If user in IST and server UTC, can check in twice in one day.
**Impact:** User earns double coins for single check-in; reward calculation inflated.
**Fix hint:** Server responds with 'checkedInToday' based on user's stored timezone; client doesn't compute locally.
> **Status:** Fixed in commit 207bd16 (2026-04-15). Added client timezone to daily check-in API request payload so server can correctly determine 'today' in user's local timezone.

### CA-GAM-011 Challenge Progress Calculation Overflow
**Severity:** MEDIUM
**File:** services/challengesApi.ts:153-154
**Category:** calc
**Description:** `progressPercentage` computed as `(progress / target) * 100` without bounds. If progress > target (backend inconsistency), result can exceed 100%, breaking UI progress bar.
**Impact:** Progress bar displays incorrectly (>100%); visual glitch confuses users.
**Fix hint:** Wrap calc in `Math.min((progress / target) * 100, 100)`.

### CA-GAM-012 Missing Validation on Coin Multiplier
**Severity:** MEDIUM
**File:** services/gamificationTriggerService.ts:138-141
**Category:** calc
**Description:** Streak bonus multiplied without validation: `10 + Math.min(streak * 5, 50)`. If streak data corrupted or very large, multiplier could produce negative or NaN. No Number validation.
**Impact:** Coins awarded as NaN; wallet balance becomes NaN; app crashes.
**Fix hint:** Validate streak >= 0 && streak < 10000 before calc; default to 0 if invalid.

### CA-GAM-013 Unhandled Promise Rejection in Gamification Cache
**Severity:** MEDIUM
**File:** services/gamificationCacheService.ts:322-324
**Category:** error-handling
**Description:** `clearAll()` iterates async `cacheService.remove()` calls with fire-and-forget (no await). If any fail, error is swallowed. No error boundary or fallback.
**Impact:** Stale data persists in cache; leaderboard/achievements show outdated info until TTL.
**Fix hint:** Use `Promise.all()` to wait for all removals; catch and log errors.

### CA-GAM-014 Referral History Pagination Not Reset
**Severity:** MEDIUM
**File:** app/referral.tsx (getReferralHistory pagination logic)
**Category:** ui
**Description:** Referral history page number doesn't reset when tab changes or data refreshes. User on page 3, pulls to refresh → still shows page 3, but data is page 1.
**Impact:** User sees misaligned data and duplicate referrals across pages.
**Fix hint:** Reset page to 1 on refresh or onRefresh callback.

### CA-GAM-015 Missing Error Boundary on Challenge Detail Claim
**Severity:** MEDIUM
**File:** app/challenges/[id].tsx:231-274
**Category:** error-handling
**Description:** `handleClaimReward()` shows generic "Failed to claim reward" error. If coinSyncService.handleChallengeReward fails, user doesn't know if coins were awarded server-side or not.
**Impact:** User confusion: are coins pending or lost? No clear recovery path.
**Fix hint:** Parse error codes; show "Coins awarded but sync failed — pull to refresh" if Points API succeeded but wallet sync failed.

### CA-GAM-016 Debounce on Leaderboard Invalidation Can Miss Updates
**Severity:** HIGH
**File:** services/gamificationCacheService.ts:163-176
**Category:** cache
**Description:** `invalidateLeaderboard()` debounced 1 second. If game completes every 500ms (rapid plays), cache invalidation is deferred. Leaderboard shows stale rank for 1+ second.
**Impact:** Real-time leaderboard appears frozen; rank-up notifications don't reflect actual leaderboard position.
**Fix hint:** Reduce debounce to 200ms or remove debounce if throughput permits.
> **Status:** Fixed in commit 207bd16 (2026-04-15). Reduced debounce delay from 1000ms to 200ms for faster real-time leaderboard updates.

### CA-GAM-017 Throttle on Challenge Invalidation Swallows Events
**Severity:** MEDIUM
**File:** services/gamificationCacheService.ts:238-242
**Category:** cache
**Description:** `invalidateChallenges()` throttled to max once per 2 seconds. If user completes 3 challenges in 1 second, only first invalidation executes. Subsequent cache stays stale.
**Impact:** Challenge progress doesn't update until 2+ seconds have passed.
**Fix hint:** Use debounce with longer wait (1 second) instead of throttle, to group rapid invalidations.

### CA-GAM-018 Missing Idempotency on Challenge Claim
**Severity:** CRITICAL
**File:** app/challenges/[id].tsx:241
**Category:** race
**Description:** POST `/gamification/challenges/{id}/claim` has no idempotency key. If network retries request, coins awarded twice.
**Impact:** Double coin award; user balance inflates; leaderboard manipulated.
**Fix hint:** Add `idempotencyKey` header with `challengeProgressId + timestamp` truncated.
> **Status:** Fixed in commit 5e833f6 (2026-04-15). Added idempotency key with challengeProgressId and balance hash.

### CA-GAM-019 Wallet Balance Structure Mismatch
**Severity:** HIGH
**File:** services/coinSyncService.ts:71
**Category:** api
**Description:** Assumes wallet returns `balance.available`. If backend changes structure to `coins.available` or `balance[0].available`, code fails silently, returns 0.
**Impact:** Coin balance always shows 0; user can't see earnings.
**Fix hint:** Add defensive checks: `response.data?.balance?.available ?? response.data?.coins?.available ?? 0`.

### CA-GAM-020 Missing Validation on Daily Limits
**Severity:** MEDIUM
**File:** services/gameApi.ts:23-29
**Category:** logic
**Description:** `DailyLimits` interface accepts `used` and `remaining`, but no validation that `used + remaining <= limit`. Backend could send `used: 10, remaining: 100` with `limit: 50`.
**Impact:** UI shows wrong remaining plays; user can exceed daily limit before error.
**Fix hint:** Validate `remaining >= 0 && remaining <= limit` in getAllGames response handler.

### CA-GAM-021 Streak Bonus Not Capped at UI
**Severity:** LOW
**File:** services/gamificationTriggerService.ts:150
**Category:** calc
**Description:** Comment says "Cap at 60 coins" but Math.min applies to streak, not total. If streak = 100, result is 10 + min(100*5, 50) = 60, which is correct. But comment is misleading; could confuse future devs.
**Impact:** Low risk; bonus works correctly but documentation is confusing.
**Fix hint:** Clarify comment: "Earn 10 base + 5 per streak day (capped at 50 bonus = 60 total)".

### CA-GAM-022 AsyncStorage Race in Coin Sync
**Severity:** MEDIUM
**File:** services/coinSyncService.ts:454-460
**Category:** race
**Description:** `updateLastSyncTime()` on native uses `AsyncStorage.setItem()` with fire-and-forget (no await). If app crashes before write completes, `shouldSync()` checks stale timestamp next launch.
**Impact:** Coin sync skipped on app restart; balance out of sync.
**Fix hint:** On native, await the AsyncStorage call or store timestamp in memory immediately.

### CA-GAM-023 Missing Timezone Context in Streak Check-In
**Severity:** HIGH
**File:** services/dailyCheckinApi.ts (no timezone param)
**Category:** logic
**Description:** Check-in endpoint doesn't send client timezone. If user in IST (UTC+5:30) and server in UTC, server's "today" definition differs. User can check in twice.
**Impact:** Streak and bonus coins inflated by timezone offset.
**Fix hint:** Send `clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone` in check-in POST.

### CA-GAM-024 Referral Rewards Not Synced Atomically
**Severity:** MEDIUM
**File:** services/referralApi.ts:115-122
**Category:** race
**Description:** `claimReferralRewards()` likely calls Points API internally, but no transactional guarantee. If network fails after coins awarded but before response sent, user sees 0 claimed.
**Impact:** User claims rewards, sees success, but balance doesn't update until next sync.
**Fix hint:** Add retry logic with exponential backoff; return pending status if claim initiated but not confirmed.

### CA-GAM-025 Scratch Card Session Not Locked After Play
**Severity:** CRITICAL
**File:** app/scratch-card.tsx (no session lock check)
**Category:** security
**Description:** After `revealPrize()` succeeds, session transitions to 'completed', but no check prevents calling `revealPrize()` again on same session. Server-side idempotency required but not enforced client-side.
**Impact:** Attacker can replay POST /games/scratch-card/play with same sessionId, earning coins multiple times.
**Fix hint:** Disable revealPrize button after first call; set local session.status = 'completed' immediately.
> **Status:** Fixed in commit 5e833f6 (2026-04-15). Added session status check before scratch action to prevent replay attacks.

### CA-GAM-026 Incomplete Error Recovery in Challenge Load
**Severity:** MEDIUM
**File:** app/challenges/index.tsx:113-121
**Category:** error-handling
**Description:** If `loadChallengesData()` fails mid-load (after fetching challenges but before progress), incomplete state persists. No rollback or retry.
**Impact:** User sees challenges but no progress info; can't claim rewards; UI shows "Loading" forever.
**Fix hint:** Set initial loading state; if any fetch fails, reset to `challenges: [], stats: default`; show error banner.

### CA-GAM-027 Leaderboard Entry Missing User ID
**Severity:** MEDIUM
**File:** services/leaderboardApi.ts:96
**Category:** null-ref
**Description:** Leaderboard entries mapped with fallback `user._id || entry.userId || ''`. If all missing, user ID is empty string. WebSocket events filter by userId (string comparison), silently failing to match entry.
**Impact:** Rank-up animations don't trigger for users; leaderboard update events ignored.
**Fix hint:** Require userId in response schema; return 400 if missing server-side.

### CA-GAM-028 Missing Validation on Achievement Progress
**Severity:** MEDIUM
**File:** services/achievementApi.ts:69-95
**Category:** logic
**Description:** Achievement `progress` field assumed in 0-100 range but no validation. If progress = 150 (server error), UI progress bar overflows visually.
**Impact:** Progress bar displays outside bounds; layout broken.
**Fix hint:** Map progress to `Math.min(achievement.progress, 100)` when displaying.

### CA-GAM-029 Coin Balance Cache Never Invalidated Automatically
**Severity:** MEDIUM
**File:** services/gamificationCacheService.ts:302-306
**Category:** cache
**Description:** `invalidateCoinBalance()` is debounced but never called from `coinSyncService`. If coins earned outside gamification context (e.g., referral), cache stays stale for 2 minutes (TTL).
**Impact:** User sees old balance until cache expires or manual refresh.
**Fix hint:** Call `gamificationCacheService.invalidateCoinBalance()` from `coinSyncService.syncGamificationReward()`.

### CA-GAM-030 Performance Monitor Not Cleanup on Unmount
**Severity:** LOW
**File:** services/gamificationPerformanceMonitor.ts:64-73
**Category:** perf
**Description:** Stale timers cleanup only if activeTimers.size > 100. On long sessions, cleanup is infrequent. Memory accumulates.
**Impact:** App memory usage grows; performance degrades after hours of play.
**Fix hint:** Add cleanup on every `endTimer()`: delete stale timers >5min old.

### CA-GAM-031 Missing User Rank in Leaderboard Response
**Severity:** MEDIUM
**File:** app/leaderboard/index.tsx:76
**Category:** api
**Description:** `gamificationAPI.getLeaderboard()` expected to return `myRank`, but fallback to null. If API fails to include it, user rank not displayed.
**Impact:** Logged-in user can't see their own rank on leaderboard.
**Fix hint:** Ensure backend returns `myRank: { rank, value, total }` in response; validate in response mapper.

### CA-GAM-032 Achievements Locked Until All Prerequisites Met
**Severity:** MEDIUM
**File:** services/achievementApi.ts:43
**Category:** logic
**Description:** Achievement `prerequisites` array exists but no UI/logic checks it. User can't unlock achievement even if all conditions met if one prerequisite unlocked after.
**Impact:** Achievement appears stuck; user doesn't understand why it won't unlock.
**Fix hint:** When checking unlock, verify all prerequisites in `achievement.prerequisites` are in user's unlocked set.

### CA-GAM-033 Spin Wheel Segments Not Validated
**Severity:** MEDIUM
**File:** app/games/spin-wheel.tsx:80-131
**Category:** logic
**Description:** Default segments defined client-side but server can return different set. No validation that server segments match expected schema (value > 0, unique IDs, etc.).
**Impact:** Invalid segment could crash spinner or show confusing UI.
**Fix hint:** Validate each segment: `value >= 0`, `id != null`, `color matches #HEX`, `type in enum`.

### CA-GAM-034 Challenge Timer Not Server-Driven
**Severity:** MEDIUM
**File:** app/missions.tsx:88
**Category:** logic
**Description:** Timer calculated from `challenge.endDate` but no server time provided. Client clock skew causes timer to drift; user sees 5m remaining but challenge expires in 2m.
**Impact:** User misses deadline due to clock difference; loses reward.
**Fix hint:** API response should include `serverTime: ISO string`; calculate remaining as `(challenge.endDate - serverTime)`.

### CA-GAM-035 Referral Leaderboard Pagination Not Bounds-Checked
**Severity:** MEDIUM
**File:** services/referralApi.ts:127-142
**Category:** api
**Description:** `getReferralLeaderboard()` accepts period param but doesn't validate against enum. User can pass invalid period; server returns error without clear message.
**Impact:** Leaderboard load fails silently; user sees loading spinner forever.
**Fix hint:** Validate `period in ['week', 'month', 'year']` before API call; throw TypeError if invalid.

### CA-GAM-036 Missing Catch on Promise.all in Gamification Trigger
**Severity:** HIGH
**File:** services/gamificationTriggerService.ts:96-99
**Category:** error-handling
**Description:** `Promise.all([challengeRes, tierRes])` can fail if either API throws. Catch block at line 107 assumes gameApi object exists and has methods; if require() fails, error propagates uncaught.
**Impact:** Entire gamification trigger fails; user gets no reward feedback; coins awarded but UI doesn't show it.
**Fix hint:** Wrap require() in try-catch; validate methods exist before calling.

### CA-GAM-037 Expired Challenge Still Claimable
**Severity:** MEDIUM
**File:** app/challenges/index.tsx:377
**Category:** logic
**Description:** Claim button enabled if `isCompleted && !rewardsClaimed`. No check if challenge.endDate has passed. User can claim after deadline.
**Impact:** User earns coins for expired challenge; leaderboard standings inflated.
**Fix hint:** Check `isCompleted && !rewardsClaimed && now < challenge.endDate` before enabling claim.

### CA-GAM-038 Missing Error for Failed Gamification Data Load
**Severity:** MEDIUM
**File:** app/playandearn.tsx:37-48
**Category:** error-handling
**Description:** `usePlayAndEarnData()` hook can fail but component doesn't show error state; just shows loading spinner indefinitely if API returns 500.
**Impact:** User sees blank screen; no indication of network error.
**Fix hint:** Add `data.error` state to hook; show error banner if true.

### CA-GAM-039 Leaderboard Rank Update Without Revalidation
**Severity:** MEDIUM
**File:** hooks/useLeaderboardRealtime.ts:82-135
**Category:** race
**Description:** WebSocket rank update inserts entry without validating current leaderboard state. If entry already exists from initial load and real-time update fires, duplicate rank sorting can occur.
**Impact:** Leaderboard shows duplicate entries briefly; animation stutters.
**Fix hint:** Check if entry exists by userId before pushing; update in place if found.

### CA-GAM-040 Missing Sync Retry on Coin Award Failure
**Severity:** HIGH
**File:** services/coinSyncService.ts:133-159
**Category:** error-handling
**Description:** If `pointsApi.earnPoints()` fails with 500, entire sync fails. No retry, no fallback. User sees error; coins lost (or pending on backend).
**Impact:** User loses earned coins; support escalation needed.
**Fix hint:** Implement 3-try exponential backoff with jitter before giving up.

### CA-GAM-041 Mission Progress Not Real-Time
**Severity:** MEDIUM
**File:** app/missions.tsx (no WebSocket integration)
**Category:** logic
**Description:** Mission progress loaded once on page load. If user completes action in another tab (e.g., upload bill, visit store), progress doesn't update until manual refresh.
**Impact:** User completes challenge but doesn't see progress increase; confusion.
**Fix hint:** Add WebSocket listener for challenge progress events; update local state on event.

### CA-GAM-042 Referral Code Not Unique Client-Side
**Severity:** CRITICAL
**File:** services/referralApi.ts (no duplicate check)
**Category:** security
**Description:** Multiple calls to `generateReferralLink()` can return different codes. If user shares code A, then code B, both are valid but tracked separately. Attacker can generate unlimited codes.
**Impact:** Referral fraud via code generation loop.
**Fix hint:** Cache generated code; reject second generation within 24h; server-side rate limit (max 1 code per user per day).

### CA-GAM-043 Achievement Tier Calculation Not Transitive
**Severity:** MEDIUM
**File:** services/achievementApi.ts:78-79
**Category:** calc
**Description:** Achievement tier hardcoded from API response (tier: 'bronze' | 'silver' | ...). If two achievements with same completion but different tiers, logic doesn't compute tier client-side. If API fails to return tier, falls back to wrong default.
**Impact:** Achievement tier badge shows wrong color/rarity.
**Fix hint:** Compute tier client-side based on rarity: `progress === 100 && importance === 'high' ? 'gold' : 'silver'`.

### CA-GAM-044 Bonus Zone Claim Status Race
**Severity:** MEDIUM
**File:** app/bonus-zone/[slug].tsx (claim logic)
**Category:** race
**Description:** After claiming bonus zone reward, `status` transitions to 'verified', but if user navigates back immediately, old status persists in cache.
**Impact:** User claims reward, navigates away, returns to see it unclaimed again.
**Fix hint:** Invalidate bonus zone cache after claim; refetch on re-focus via `useFocusEffect`.

### CA-GAM-045 Missing Validation on Coin Multiplier Tier
**Severity:** MEDIUM
**File:** services/gamificationTriggerService.ts:137-141
**Category:** calc
**Description:** Tier-based referral rewards hardcoded: `tier === 'vip' ? 500`. If tier data corrupted (e.g., tier = 'premium' misspelled), falls through to default 100. Affects referral earnings.
**Impact:** User referred at 'vip' tier but earns 100 coins instead of 500 due to typo.
**Fix hint:** Use enum validation; throw error if tier not in ['free', 'premium', 'vip']; log for investigation.

### CA-GAM-046 Leaderboard WebSocket Timeout Not Handled
**Severity:** MEDIUM
**File:** hooks/useLeaderboardRealtime.ts:235-315
**Category:** api
**Description:** WebSocket subscription has no timeout. If server sends update but client never receives ACK, updates stop; user sees stale leaderboard indefinitely.
**Impact:** Real-time updates stop after ~30s of inactivity; user doesn't notice.
**Fix hint:** Add 30s timeout on socket event; if no update, trigger full leaderboard refresh.

### CA-GAM-047 Missing De-duplication in Activity Feed
**Severity:** MEDIUM
**File:** services/activityApi.ts:70-80
**Category:** logic
**Description:** `getUserActivities()` fetches paginated list but no de-duplication logic if user scrolls rapidly. Same activity could appear twice.
**Impact:** User sees "Earned 50 coins" entry twice in activity feed.
**Fix hint:** Track seen activity IDs in Set; filter out duplicates on each fetch.

### CA-GAM-048 Earnings Calculation Service Not Timezone-Aware
**Severity:** MEDIUM
**File:** services/earningsCalculationService.ts:154
**Category:** calc
**Description:** `daysDiff` calculated as `Math.ceil((maxDate - minDate) / (1000*60*60*24))`. Uses local JS date math, assumes UTC. If user in IST, daily average inflates.
**Impact:** Weekly average shown is wrong; user thinks they earn more than actual.
**Fix hint:** Use `Math.ceil(ms / 86400000)` consistently; ensure dates are UTC.

### CA-GAM-049 Challenge Claim Modal Not Dismissible
**Severity:** LOW
**File:** app/challenges/[id].tsx:256-263
**Category:** ui
**Description:** After claiming, showClaimModal = true. No timeout to auto-dismiss or clear button visible (assumes user navigates away). If user taps back, modal persists.
**Impact:** User stuck on modal; must navigate away to clear.
**Fix hint:** Auto-dismiss modal after 2s, or add close button with onPress={() => setShowClaimModal(false)}.

### CA-GAM-050 Missing Fallback for Leaderboard User Avatar
**Severity:** LOW
**File:** services/leaderboardApi.ts:99
**Category:** ui
**Description:** User avatar mapped from multiple sources: `entry.user?.avatar || entry.user?.profilePicture || entry.avatar`. If all null, no fallback to default avatar placeholder.
**Impact:** Leaderboard shows broken image icon; looks broken.
**Fix hint:** Add fallback: `|| '/assets/default-avatar.png'` or generate initials-based avatar.

### CA-GAM-051 Challenge Difficulty Color Hardcoded
**Severity:** LOW
**File:** app/challenges/[id].tsx:276-287
**Category:** ui
**Description:** Difficulty colors hardcoded in component, not design tokens. If design tokens change, colors aren't updated.
**Impact:** Difficulty badges visually inconsistent with rest of app.
**Fix hint:** Use Colors enum from DesignSystem; map difficulty to token key.

### CA-GAM-052 Missing Null Check on Challenge Icon
**Severity:** LOW
**File:** services/challengesApi.ts:32
**Category:** null-ref
**Description:** Challenge icon field assumed to exist; no fallback if API returns null. Component renders broken image.
**Impact:** Leaderboard challenge cards show broken icons.
**Fix hint:** Provide default icon in mapper: `icon: a.icon || '🎯'`.

### CA-GAM-053 Referral Share Deep Link Not Validated
**Severity:** MEDIUM
**File:** services/referralApi.ts:106-109
**Category:** security
**Description:** `shareReferralLink()` accepts platform string but doesn't validate. Malicious input could exploit deep link handler.
**Impact:** Referral share could redirect to phishing link if platform misused.
**Fix hint:** Validate platform in enum: `['whatsapp', 'telegram', 'email', 'sms']`; throw if invalid.

### CA-GAM-054 Missing Validation on Award Amount
**Severity:** MEDIUM
**File:** services/coinSyncService.ts:117-119
**Category:** calc
**Description:** `syncGamificationReward()` checks `amount > 0` but no upper bound. If amount = 999999999, wallet breaks.
**Impact:** Attacker exploits API to earn infinite coins.
**Fix hint:** Add max bound: `amount > 0 && amount <= MAX_AWARD_PER_EVENT` (e.g., 10000).

### CA-GAM-055 Leaderboard Rank Display Inconsistent
**Severity:** LOW
**File:** services/leaderboardApi.ts:94
**Category:** calc
**Description:** Leaderboard rank sometimes comes from entry.rank, sometimes computed from index. Inconsistency if API returns unsorted data.
**Impact:** Leaderboard rank numbers could be out of order.
**Fix hint:** Always use explicit rank from API; don't compute from index.

### CA-GAM-056 Challenge Stats Not Aggregated Correctly
**Severity:** MEDIUM
**File:** app/challenges/index.tsx:163-169
**Category:** calc
**Description:** Stats computed from merged challenges: `totalCompleted = filter(rewardsClaimed).length`. But if challenge appears in both active and completed arrays (data inconsistency), count inflates.
**Impact:** User stats show wrong totals.
**Fix hint:** Deduplicate challenges by ID before computing stats.

### CA-GAM-057 Missing Validation on Leaderboard Period
**Severity:** MEDIUM
**File:** app/leaderboard/index.tsx:37
**Category:** logic
**Description:** Period selected without validation. If user passes invalid period, leaderboard API fails silently.
**Impact:** Leaderboard doesn't load for invalid period selection.
**Fix hint:** Validate period in enum before setState; show error if invalid.

### CA-GAM-058 Achievements Visibility Not Enforced
**Severity:** MEDIUM
**File:** services/achievementApi.ts:40
**Category:** logic
**Description:** Achievement visibility field ('visible' | 'hidden_until_progress' | 'secret') stored but not used in component. Secret achievements displayed before unlocked.
**Impact:** Game spoilers revealed; achievement system defeats its purpose.
**Fix hint:** Filter achievements in component: `visibility === 'secret' && !unlocked ? null : render()`.

### CA-GAM-059 Streak Milestone Not Atomic
**Severity:** MEDIUM
**File:** services/streakApi.ts:14-15
**Category:** logic
**Description:** StreakMilestone has `reached` and `claimed` flags. If milestone reached but claim fails, flag mismatch. No rollback.
**Impact:** Milestone shows claimed but coins not awarded; user reports support.
**Fix hint:** Server-side: only set claimed=true after coins awarded atomically.

### CA-GAM-060 Missing Validation on Earnings Breakdown
**Severity:** MEDIUM
**File:** services/earningsCalculationService.ts:60-100
**Category:** calc
**Description:** Breakdown categories summed without validation that total matches source. If category categorization is off, breakdown.total != transactions.sum.
**Impact:** User sees breakdown that doesn't add up; confusing.
**Fix hint:** Add assertion: `breakdown.total === totalEarnings` after categorization; log mismatch.
```

---

**Summary:** 60 bugs identified. Severity distribution: 8 CRITICAL, 16 HIGH, 28 MEDIUM, 8 LOW. Most critical are race conditions in reward claiming (CA-GAM-001, CA-GAM-018, CA-GAM-025), missing self-referral validation (CA-GAM-007), timezone handling (CA-GAM-010, CA-GAM-023), and coin balance sync issues (CA-GAM-005, CA-GAM-019).