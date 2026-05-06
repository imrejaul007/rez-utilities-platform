# Gaps: Consumer App MEDIUM Issues — Audit 2026-04-16

**22 MEDIUM Issues — Fix within 2 sprints**

---

## Data & Sync

### NA-MED-01: Socket Reconnection Silently Drops Order Updates

**Severity:** MEDIUM
**Files:** `contexts/SocketContext.tsx`, `hooks/useOrderTracking.ts`
**Category:** Data Sync / Race Condition
**Gap ID:** NA-MED-01
**Status:** ACTIVE

### Description
When `authToken` changes (every ~2 minutes), SocketContext disconnects and creates a new socket. `useOrderTracking`'s reconnection guard checks `socketState.connected` which has already been updated to `true` by the new socket's CONNECT handler, so the subscription call is never re-executed.

### Impact
Order tracking gets stuck after token refresh. Users must manually refresh the order page to see updates.

### Fix Direction
Use `socketRef.current?.connected` instead of `socketState.connected` for the reconnection guard.

---

### NA-MED-02: 3 Independent Coin Sources with No Cross-Verification

**Severity:** MEDIUM
**Files:** `services/walletApi.ts`, `services/pointsApi.ts`, `services/gamificationActions`
**Category:** Data Sync / Architecture
**Gap ID:** NA-MED-02
**Status:** ACTIVE

### Description
Wallet coins, Points API, and Gamification each maintain separate coin balances fetched independently. `pointsApi.getBalance()` falls back to wallet on 404, making comparison meaningless.

### Impact
Users see different coin balances in different places (wallet tab, gamification rewards, points screen).

### Fix Direction
Add `GET /wallet/sync-status` endpoint returning all three balances and flagging discrepancies. Call on app resume.

---

### NA-MED-03: Offline Queue Persistence Failure Silently Drops Operations

**Severity:** MEDIUM
**Files:** `services/offlineQueueService.ts`, `services/offlineSyncService.ts`
**Category:** Data Sync / Edge Case
**Gap ID:** NA-MED-03
**Status:** ACTIVE

### Description
Both `processQueue()` and `syncAll()` clear completed operations silently. If `persistQueue()` fails (AsyncStorage quota), the queue state is lost.

### Impact
Operations that synced to the server are forgotten. On next restart, app has empty queue but server already processed them.

### Fix Direction
Wrap `persistQueue()` in try-catch that emits `queue:error` event. Show persistent banner on persistence failure.

---

### NA-MED-04: RealTimeService and SocketContext Completely Disconnected

**Severity:** MEDIUM
**Files:** `services/realTimeService.ts`, `contexts/SocketContext.tsx`
**Category:** Architecture / Real-time
**Gap ID:** NA-MED-04
**Status:** ACTIVE

### Description
`realTimeService` uses `MESSAGE_TYPES.ORDER_STATUS_UPDATE` while `SocketContext` uses `SocketEvents.ORDER_STATUS_UPDATED`. Two independent Socket.IO implementations with no coordination.

### Impact
Any component using `realTimeService` directly for order updates receives no events because the server emits on the SocketContext socket namespace.

### Fix Direction
Deprecate `realTimeService` as standalone socket. Route all real-time communication through `SocketContext`.

---

### NA-MED-05: No Offline Indicator Anywhere in the App

**Severity:** MEDIUM
**Files:** All screens making network calls
**Category:** UX / Missing Feedback
**Gap ID:** NA-MED-05
**Status:** ACTIVE

### Description
No `Network.isConnected` banner when device goes offline. `NetInfo` is imported internally in some services but never surfaced to the UI layer.

### Impact
Users in poor connectivity areas experience silent failures with no context.

### Fix Direction
Create `OfflineBanner` component subscribing to `NetInfo`. Integrate into root layout.

---

### NA-MED-06: No Sequence Number for Socket Message Ordering

**Severity:** MEDIUM
**Files:** `services/realTimeService.ts`, `contexts/SocketContext.tsx`
**Category:** Data Sync / Race Condition
**Gap ID:** NA-MED-06
**Status:** ACTIVE

### Description
No sequence numbers on socket messages. If `ORDER_PREPARING` arrives before `ORDER_CONFIRMED`, UI shows wrong state.

### Impact
Order tracking shows incorrect status sequence if messages arrive out of order.

### Fix Direction
Add monotonically increasing sequence numbers to all server-emitted order events. Client discards events with sequence <= last seen.

---

## API Contracts

### NA-MED-07: AddressType Uses SCREAMING_CASE But Canonical Uses lowercase

**Severity:** MEDIUM
**Files:** `services/addressApi.ts:6-10`
**Category:** API Contract / Enum Mismatch
**Gap ID:** NA-MED-07
**Status:** ACTIVE

### Description
`HOME = 'HOME'` but canonical `OrderDeliveryAddress.addressType` expects `'home' | 'work' | 'other'`.

### Impact
Address CRUD operations send incorrect enum values. Backend silently rejects or misclassifies addresses.

### Fix Direction
Change `AddressType` values to lowercase. Add normalization in `normaliseAddress()` before API submission.

---

### NA-MED-08: Booking Status Enum Missing Canonical Values

**Severity:** MEDIUM
**Files:** `services/bookingApi.ts:22`
**Category:** API Contract / Enum Mismatch
**Gap ID:** NA-MED-08
**Status:** ACTIVE

### Description
Local type has 4 values. Canonical has 9 including `'assigned'`, `'in_progress'`, `'no_show'`, `'refunded'`, `'expired'`.

### Impact
Booking status values not in the local type render as raw strings.

### Fix Direction
Import `BookingStatus` from `@rez/shared` instead of defining locally.

---

### NA-MED-09: Duplicate `TransactionMetadata` Interface (Twice in Same File)

**Severity:** MEDIUM
**Files:** `services/walletApi.ts:130-156` AND `services/walletApi.ts:278-304`
**Category:** Architecture / Duplicate Code
**Gap ID:** NA-MED-09
**Status:** ACTIVE

### Description
Same `TransactionMetadata` interface defined twice in the same 1147-line file.

### Fix Direction
Remove the duplicate. Use a single definition.

---

### NA-MED-10: `paymentStatus` Type Missing Canonical Values

**Severity:** MEDIUM
**Files:** `services/ordersApi.ts:65`
**Category:** API Contract / Enum Mismatch
**Gap ID:** NA-MED-10
**Status:** ACTIVE

### Description
Missing `'awaiting_payment'`, `'processing'`, `'authorized'` from canonical `OrderPaymentStatus`.

### Fix Direction
Update the type to match canonical `OrderPaymentStatus`.

---

## Architecture

### NA-MED-11: Unresolved Git Merge Conflict in karmaRoutes.ts

**Severity:** MEDIUM
**Files:** `rez-karma-service/src/routes/karmaRoutes.ts:98-110`
**Category:** Architecture / Dead Code
**Gap ID:** NA-MED-11
**Status:** ACTIVE

### Description
Git conflict markers `<<<<<<< HEAD`, `=======`, `>>>>>>> origin/main` left in source code.

### Impact
TypeScript compilation fails. Karma service startup crashes.

### Fix Direction
Remove conflict markers. Merge both code paths: `let limit = parseInt(String(req.query.limit ?? '20'), 10); if (isNaN(limit) || limit < 1) limit = 20; if (limit > 100) limit = 100;`

---

### NA-MED-12: Duplicate `startOfWeek` Declared Twice in Same Function

**Severity:** MEDIUM
**Files:** `rez-karma-service/src/services/karmaService.ts:128` AND `rez-karma-service/src/services/karmaService.ts:195`
**Category:** Architecture / Duplicate Code
**Gap ID:** NA-MED-12
**Status:** ACTIVE

### Description
`const startOfWeek = moment().startOf('week').toDate()` declared twice in `addKarma()`. First is dead code, second shadows it.

### Fix Direction
Remove line 128. Keep only line 195.

---

### NA-MED-13: Week Boundary Inconsistency — locale vs ISO Week

**Severity:** MEDIUM
**Files:** `rez-karma-service/src/services/karmaService.ts:128` vs `rez-karma-service/src/services/batchService.ts:577`
**Category:** Business Logic / Inconsistency
**Gap ID:** NA-MED-13
**Status:** ACTIVE

### Description
`karmaService.addKarma()` uses `startOf('week')` (locale-dependent, typically Sunday) while `batchService.getWeeklyCoinsUsed()` uses `startOf('isoWeek')` (ISO standard, always Monday).

### Impact
Weekly cap boundary differs between earning and spending. Users may be incorrectly capped.

### Fix Direction
Use `startOf('isoWeek')` consistently in both services.

---

### NA-MED-14: Conflicting `normalizeLoyaltyTier` in Two Shared Files

**Severity:** MEDIUM
**Files:** `rez-shared/src/constants/coins.ts:139` AND `rez-shared/src/enums.ts:20`
**Category:** Cross-Repo / Enum Mismatch
**Gap ID:** NA-MED-14
**Status:** ACTIVE
**Related:** G-CR-X### (prior cross-ref)

### Description
`coins.ts` maps `'DIAMOND'` to `'platinum'`. `enums.ts` maps `'DIAMOND'` to `'diamond'` (distinct tier).

### Impact
Same user loyalty tier normalizes to different values in different services.

### Fix Direction
Consolidate to one canonical normalizer. Choose `'diamond'` as a distinct tier.

---

### NA-MED-15: No Circuit Breaker on Any Service

**Severity:** MEDIUM
**Files:** ALL 17+ service files
**Category:** Architecture / Resilience
**Gap ID:** NA-MED-15
**Status:** ACTIVE

### Description
No circuit breaker pattern exists anywhere. If a backend is permanently down, every call retries until timeout.

### Impact
Users repeatedly attempt actions that always fail. No fallback UI state. Battery drain.

### Fix Direction
Implement lightweight per-service circuit breaker: after 3 consecutive failures in 30s, fast-fail for 60s.

---

### NA-MED-16: Default Timeout 30s — Too Long for Mobile UX

**Severity:** MEDIUM
**Files:** `services/apiClient.ts:241`, `config/env.ts:24`
**Category:** Performance / UX
**Gap ID:** NA-MED-16
**Status:** ACTIVE

### Description
Default timeout is 30s. Industry standard for mobile UX is 8-12s.

### Impact
Non-payment API calls wait 30s before showing errors. Users see dead spinners.

### Fix Direction
Change default timeout from 30s to 8s. Enforce per-endpoint timeouts via TypeScript.

---

## UX

### NA-MED-17: Missing Haptic Feedback on Flash-Sale and Deal Success Screens

**Severity:** MEDIUM
**Files:** `app/flash-sale-success.tsx`, `app/deal-success.tsx`
**Category:** UX / Inconsistent Feedback
**Gap ID:** NA-MED-17
**Status:** ACTIVE

### Description
Unlike `payment-success.tsx` (which calls `Haptics.notificationAsync`), these screens show success without haptic feedback.

### Fix Direction
Add `import * as Haptics from 'expo-haptics'` and call `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` in both files.

---

### NA-MED-18: Checkout Page 609 Lines with Zero Memoization

**Severity:** MEDIUM
**Files:** `app/checkout.tsx:223-609`
**Category:** Performance / UX
**Gap ID:** NA-MED-18
**Status:** ACTIVE

### Description
`CheckoutPage` is a 609-line monolithic function. While `DeliverySlotPickerImpl` is memoized, the main component re-renders on every state change.

### Impact
Laggy checkout on mid-range Android devices during promo code validation or address selection.

### Fix Direction
Wrap major sub-components with `React.memo`. Use `useCallback` for all event handlers.

---

### NA-MED-19: `CoinTogglesSection` Coin Slider Has No Debounce

**Severity:** MEDIUM
**Files:** `hooks/useCheckoutUI.ts` (called from `app/checkout.tsx:436-448`)
**Category:** Performance
**Gap ID:** NA-MED-19
**Status:** ACTIVE

### Description
`onCoinToggle` calls `handleCoinToggle` on every slider drag event without debouncing.

### Fix Direction
Add debounce to the coin toggle handler.

---

### NA-MED-20: `sanitizeNumber` Silently Clamps Invalid Input

**Severity:** MEDIUM
**Files:** `services/walletValidation.ts:253-261`
**Category:** UX / Missing Feedback
**Gap ID:** NA-MED-20
**Status:** ACTIVE

### Description
`-100` for a topup amount becomes `10` (minimum) with no error shown.

### Fix Direction
Return a `ValidationResult` indicating whether input was modified, so callers can show errors.

---

## Security

### NA-MED-21: Perceptual Hash Unreachable in Bill Verification

**Severity:** MEDIUM
**Files:** `services/imageHashService.ts:167,342,360`
**Category:** Security / Incomplete Fraud Detection
**Gap ID:** NA-MED-21
**Status:** ACTIVE

### Description
`compareHashes()` only returns 0 or 100 (no meaningful similarity scores). The 95% threshold is unreachable. Duplicate detection falls back to MD5 only.

### Fix Direction
Fix perceptual hash to return actual hamming-distance-based similarity scores (0-100 range).

---

### NA-MED-22: Client-Side Fraud Detection with Fail-Open

**Severity:** MEDIUM
**Files:** `services/fraudDetectionService.ts`
**Category:** Security / Fail-Open
**Gap ID:** NA-MED-22
**Status:** ACTIVE

### Description
Fraud checks wrapped in `try/catch` that silently continues. Any exception (OCR failure, network error) allows the bill to proceed.

### Impact
An attacker who causes an OCR failure bypasses fraud detection entirely.

### Fix Direction
Fail-closed: any exception should reject the bill or flag for manual review.

---

## Status Table

| ID | Status | Fix Priority | Owner |
|----|--------|-------------|-------|
| NA-MED-01 | ACTIVE | P2 | ? |
| NA-MED-02 | ACTIVE | P2 | ? |
| NA-MED-03 | ACTIVE | P2 | ? |
| NA-MED-04 | ACTIVE | P3 | ? |
| NA-MED-05 | ACTIVE | P3 | ? |
| NA-MED-06 | ACTIVE | P3 | ? |
| NA-MED-07 | **FIXED** | — | 2026-04-17 |
| NA-MED-08 | ACTIVE | P2 | ? |
| NA-MED-09 | **FIXED** | — | 2026-04-17 |
| NA-MED-10 | ACTIVE | P2 | ? |
| NA-MED-11 | **FIXED** | — | 2026-04-17 |
| NA-MED-12 | **FIXED** | — | 2026-04-17 |
| NA-MED-13 | **FIXED** | — | 2026-04-17 |
| NA-MED-14 | ACTIVE | P2 | ? |
| NA-MED-15 | ACTIVE | P3 | ? |
| NA-MED-16 | ACTIVE | P2 | ? |
| NA-MED-17 | **FIXED** | — | 2026-04-17 |
| NA-MED-18 | ACTIVE | P3 | ? |
| NA-MED-19 | ACTIVE | P3 | ? |
| NA-MED-20 | ACTIVE | P3 | ? |
| NA-MED-21 | ACTIVE | P2 | ? |
| NA-MED-22 | ACTIVE | P2 | ? |
