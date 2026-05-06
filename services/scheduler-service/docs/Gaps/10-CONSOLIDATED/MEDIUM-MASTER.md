# MEDIUM Bugs — Master Consolidated List

**Source:** All audit generations consolidated
**Total MEDIUM Issues:** ~272 across 9+ source audits
**Sources:** Consumer 2026 (22), ReZ NoW (47), RestoPapa Gen 14 (30), Merchant App (62), ReZ Admin (20), Karma UI (17), Rendez Backend (12), Rendez App (32), Rendez Admin (10), Cross-Service (12+)

---

## Category 1: Functional & Logic Bugs

### F-01. NA-MED-11
**Unresolved Git Merge Conflict in karmaRoutes.ts**
- **File:** `rez-karma-service/src/routes/karmaRoutes.ts:98-110`
- **Severity:** MEDIUM — TypeScript compilation fails
- **Fix:** Remove conflict markers. Merge both code paths
- **Effort:** 15 minutes

### F-02. NA-MED-17
**Missing Haptic Feedback on Flash-Sale and Deal Success Screens**
- **File:** `app/flash-sale-success.tsx`, `app/deal-success.tsx`
- **Fix:** Add `Haptics.notificationAsync` on both screens
- **Effort:** 10 minutes

### F-03. NA-MED-20
**`sanitizeNumber` silently clamps invalid input**
- **File:** `services/walletValidation.ts:253-261`
- **Fix:** Return `ValidationResult` indicating whether input was modified
- **Effort:** 30 minutes

### F-04. G-MA-M19
**DocumentUploader loading state edge case**
- **File:** `components/onboarding/DocumentUploader.tsx:144-151`
- **Fix:** Clear timeout on error
- **Effort:** 15 minutes

### F-05. G-MA-M22
**BusinessInfoForm handleSubmit never called**
- **File:** `components/onboarding/BusinessInfoForm.tsx`
- **Fix:** Connect `onSubmit` to form's submit button
- **Effort:** 15 minutes

### F-06. G-MA-M23
**Onboarding step 2 is a no-op**
- **File:** `services/api/onboarding.ts:134-137`
- **Fix:** Add API call to persist store details
- **Effort:** 30 minutes

### F-07. G-MA-M25
**Register OTP cooldown not reset on Change Number**
- **File:** `app/(auth)/register.tsx:506-515`
- **Fix:** `cooldownRef.current = null` on "Change Number" press
- **Effort:** 5 minutes

### F-08. G-MA-M26
**External ID truncation crashes on null/undefined**
- **File:** `app/(dashboard)/orders.tsx:567`
- **Fix:** `order.externalId?.slice(-8).toUpperCase() ?? 'N/A'`
- **Effort:** 5 minutes

### F-09. G-MA-M57
**No email format validation on login before API call**
- **File:** `app/(auth)/login.tsx:45-62`
- **Fix:** Add `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` validation
- **Effort:** 10 minutes

### F-10. RZ-B-M7
**Silent Notification Failure Without Logging**
- **File:** `src/services/PlanService.ts:355-362`
- **Fix:** Add logging for notification failures
- **Effort:** 10 minutes

### F-11. RZ-B-M9
**Accept Already-Accepted Request Returns Vague Error**
- **File:** `src/services/MessageRequestService.ts:79`
- **Fix:** Distinguish "already accepted" vs "already declined"
- **Effort:** 30 minutes

### F-12. RZ-M-F6
**Chat Input Sends Without Any Feedback State**
- **File:** `src/app/ChatScreen.tsx:75-86`
- **Fix:** Add loading state on send button
- **Effort:** 10 minutes

### F-13. RZ-M-F7
**Chat Lock State Check Includes Wrong States**
- **File:** `src/app/ChatScreen.tsx:39`
- **Fix:** Correct state inclusion logic for `'AWAITING_REPLY'`
- **Effort:** 15 minutes

### F-14. RZ-M-F8
**Meetup Status Auto-Advance Ignores Dependencies**
- **File:** `src/app/MeetupScreen.tsx:64-68`
- **Fix:** Include full object in dependency array
- **Effort:** 10 minutes

### F-15. G-KU-M1
**joinEvent Success With Null Data Shows No Error**
- **File:** `app/karma/event/[id].tsx:78-85`
- **Fix:** Check `res.data && res.data._id` instead of just `res.success`
- **Effort:** 15 minutes

### F-16. G-KU-M8
**Stale `event` Reference in Alert Destructive Callback**
- **File:** `app/karma/event/[id].tsx:93-122`
- **Fix:** Capture `eventId` before Alert render
- **Effort:** 10 minutes

### F-17. G-KU-M9
**Silent Error Suppression on `Linking.openURL`**
- **File:** `app/karma/event/[id].tsx:134-142`
- **Fix:** Add catch with user-facing alert
- **Effort:** 10 minutes

### F-18. G-KU-M12
**`event.totalHours` Read But Field Doesn't Exist**
- **File:** `app/karma/event/[id].tsx:350`
- **Fix:** Use `event.expectedDurationHours` instead
- **Effort:** 5 minutes

### F-19. G-KU-M13
**`KarmaBadge.icon` Used in UI But Backend Never Sends It**
- **File:** `services/karmaService.ts:30` + `app/karma/my-karma.tsx:120`
- **Fix:** Remove `icon?` from type and conditional rendering
- **Effort:** 15 minutes

### F-20. NW-MED-001
**showToast called with object instead of positional args**
- **File:** `components/order/PrintReceipt.tsx:73-88`
- **Fix:** `showToast('Receipt sent to printer', 'success')` not `showToast({ message: ..., type: ... })`
- **Effort:** 5 minutes

### F-21. NW-MED-002
**reorder.ts silently swallows all errors including network failures**
- **File:** `lib/api/reorder.ts:44-90`
- **Fix:** Distinguish "item not found" (silent) from "network error" (show toast)
- **Effort:** 30 minutes

### F-22. NW-MED-003
**Rating submission accepts any number — no range validation**
- **File:** `lib/api/orders.ts:15-28`
- **Fix:** Add `if (!Number.isInteger(rating) || rating < 1 || rating > 5)` guard
- **Effort:** 10 minutes

### F-23. NW-MED-035
**Cancel reason falls back to 'Other' silently when user enters empty custom text**
- **File:** `components/order/CancelOrderModal.tsx:35-46`
- **Fix:** Require `otherText` before enabling submit button
- **Effort:** 15 minutes

### F-24. NW-MED-036
**Duplicate push notification implementations with conflicting API paths**
- **Files:** `lib/push/webPush.ts` vs `lib/utils/pushNotifications.ts`
- **Fix:** Consolidate to one implementation with correct endpoint
- **Effort:** 1 hour

### F-25. NW-MED-042
**PayDisplayClient constructs malformed API paths — causes 404**
- **File:** `app/[storeSlug]/merchant/pay-display/PayDisplayClient.tsx:54-69`
- **Fix:** Use `${storeSlug}` as path param. Move `paymentId` to request body
- **Effort:** 30 minutes

### F-26. NW-MED-043
**SearchSection and SearchResultsClient use raw fetch bypassing Axios**
- **Files:** `app/SearchSection.tsx:164-167`, `app/search/SearchResultsClient.tsx:142-144`
- **Fix:** Create typed `searchStores()` in `lib/api/search.ts` using Axios client
- **Effort:** 1 hour

### F-27. NW-MED-038 / NW-MED-047
**rateOrder uses publicClient instead of authClient**
- **File:** `lib/api/orders.ts:15-28`
- **Fix:** Use `authClient` instead of `publicClient`
- **Effort:** 5 minutes

### F-28. RP-M01
**pointsApi.getBalance() Has No Real /points Endpoint**
- **File:** `rez-app-consumer/services/pointsApi.ts`
- **Fix:** Either implement real endpoint or document proxy behavior
- **Effort:** 30 minutes

### F-29. RP-M02
**Merchant Order Sort `priority` Field — Unclear Semantics**
- **File:** `rezbackend/src/routes/merchant/orders.ts:49`
- **Fix:** Define priority computation in schema
- **Effort:** 1 hour

### F-30. RP-M03
**Local Status Transition Maps Must Stay Synced with Backend FSM**
- **File:** `rez-app-marchant/services/api/orders.ts`
- **Fix:** Import FSM from shared package or remove local FSM
- **Effort:** 1 hour

### F-31. RP-M25
**Wallet Redemption Min 50 Coins Not Shown to User**
- **File:** `rez-app-consumer/services/walletApi.ts`
- **Fix:** Add client-side validation with user-facing error
- **Effort:** 15 minutes

### F-32. RP-M26
**Bill Verification Accepts Amount Below 50**
- **File:** `rez-app-consumer/services/billVerificationService.ts:545-549`
- **Fix:** Add `>= 50` check before OCR submission
- **Effort:** 15 minutes

### F-33. RP-M28
**Cart Optimistic Update Without Rollback**
- **Issue:** Cart dispatches ADD_ITEM before API confirmation
- **Fix:** Add rollback on failed sync. Show user feedback
- **Effort:** 2 hours

### F-34. RP-M29
**Offline Queue Silently Discards After MAX_RETRIES**
- **Issue:** User loses data without knowing
- **Fix:** Show persistent error banner. Persist failed items for manual retry
- **Effort:** 1 hour

### F-35. RP-M30
**POS Expiry Reconciliation Missing**
- **Issue:** Expired bills with inconsistent state
- **Fix:** Add reconciliation worker for expired bills
- **Effort:** 2 hours

### F-36. A10-M4
**Unauthorized assign Sends Empty POST Body**
- **File:** `services/api/disputes.ts:95-97`
- **Fix:** Send `{ assigneeId }` explicitly
- **Effort:** 15 minutes

### F-37. A10-M9
**Unreachable response.status === 202 Check**
- **File:** `services/api/userWallets.ts:155-167`
- **Fix:** Remove dead code or implement pending approval handling
- **Effort:** 10 minutes

### F-38. A10-M10
**Errors Swallowed, Empty Data Returned as Success**
- **Files:** `vouchers.ts:86`, `support.ts:75`
- **Fix:** Return error or throw so callers can handle appropriately
- **Effort:** 15 minutes

### F-39. A10-M14
**Division by Zero if today === 0 but todayPlatformFees > 0**
- **File:** `app/(dashboard)/index.tsx:326-327`
- **Fix:** Guard against division by zero
- **Effort:** 5 minutes

### F-40. RZ-M-A6
**ApplicantsScreen FlatList Scroll Disabled — Screen Completely Unscrollable**
- **File:** `src/screens/ApplicantsScreen.tsx:86`
- **Fix:** Remove `scrollEnabled={false}`
- **Effort:** 5 minutes

### F-41. RZ-M-A7
**ApplicantsScreen Has No Pagination**
- **File:** `src/screens/ApplicantsScreen.tsx:60`
- **Fix:** Add cursor-based pagination with `take`/`skip` params
- **Effort:** 1 hour

### F-42. RZ-M-A8
**Settings Screen REZ Wallet Navigates to Wrong Screen**
- **File:** `src/screens/SettingsScreen.tsx:120`
- **Fix:** Replace `/profile` with correct wallet screen path
- **Effort:** 5 minutes

### F-43. RZ-M-A9
**Settings Screen Gift History Navigates to Wrong Screen**
- **File:** `src/screens/SettingsScreen.tsx:125`
- **Fix:** Replace `/main` with correct gift history path
- **Effort:** 5 minutes

### F-44. RZ-M-A10
**Settings Screen Uses Alert.alert for External Links**
- **File:** `src/screens/SettingsScreen.tsx:135-145`
- **Fix:** Use `Linking.openURL()` for privacy/terms/support
- **Effort:** 15 minutes

### F-45. RZ-M-A11
**OnboardingScreen FlatList Scroll Disabled on Android**
- **File:** `src/screens/OnboardingScreen.tsx:86`
- **Fix:** Remove `scrollEnabled={false}`
- **Effort:** 5 minutes

### F-46. RZ-A-M4
**Plan Cancel Failure Leaves UI Out of Sync**
- **File:** `src/app/plans/page.tsx:53-66`
- **Fix:** Refresh plan data after cancel attempt
- **Effort:** 15 minutes

### F-47. RZ-A-M5
**Auto-Set `expiresAt` Overwrites Manual Edits**
- **File:** `src/app/coordinator/page.tsx:130-136`
- **Fix:** Only auto-set expiresAt when user hasn't manually edited
- **Effort:** 30 minutes

### F-48. RZ-A-M8
**API Path Inconsistency**
- **File:** `src/app/coordinator/page.tsx:121`
- **Fix:** Standardize API path construction
- **Effort:** 15 minutes

### F-49. RZ-A-M10
**Hardcoded Gift Type Strings — No Unknown-Type Fallback**
- **File:** `src/app/gifts/page.tsx:70, 219`
- **Fix:** Add fallback for unknown gift types
- **Effort:** 15 minutes

### F-50. RZ-A-M12
**reviewedBy Always Set to String Literal `'admin'` Instead of Actual Admin ID**
- **File:** `src/app/moderation/page.tsx:43`
- **Fix:** Decode JWT from sessionStorage to extract admin ID
- **Effort:** 30 minutes

### F-51. RZ-A-M13
**Moderation Action Button Stuck in Loading State on Error**
- **File:** `src/app/moderation/page.tsx:40-50`
- **Fix:** Wrap in try/catch with `finally` for state cleanup
- **Effort:** 15 minutes

### F-52. RZ-A-M14
**Fraud Resolve State Never Cleared on Error**
- **File:** `src/app/fraud/page.tsx:40-45`
- **Fix:** Wrap in try/catch with `finally`
- **Effort:** 15 minutes

### F-53. RZ-A-M18
**Unhandled SecureStore Rejection Locks App in Perpetual Loading**
- **File:** `rendez-app/src/store/authStore.ts:44-50`
- **Fix:** Add catch to `loadToken` with fallback state
- **Effort:** 15 minutes

### F-54. RZ-A-M19
**setToken Silently Fails If SecureStore Throws**
- **File:** `rendez-app/src/store/authStore.ts:32-35`
- **Fix:** Wrap SecureStore in try/catch
- **Effort:** 15 minutes

---

## Category 2: Data Sync, Architecture & Real-Time

### D-01. NA-MED-01
**Socket Reconnection Silently Drops Order Updates**
- **File:** `contexts/SocketContext.tsx`, `hooks/useOrderTracking.ts`
- **Fix:** Use `socketRef.current?.connected` instead of `socketState.connected` for reconnection guard
- **Effort:** 15 minutes

### D-02. NA-MED-04
**RealTimeService and SocketContext Completely Disconnected**
- **Files:** `services/realTimeService.ts`, `contexts/SocketContext.tsx`
- **Fix:** Deprecate `realTimeService`. Route all through `SocketContext`
- **Effort:** 2 hours

### D-03. NA-MED-06
**No Sequence Number for Socket Message Ordering**
- **Files:** `services/realTimeService.ts`, `contexts/SocketContext.tsx`
- **Fix:** Add monotonic sequence numbers to all order events
- **Effort:** 1 hour

### D-04. G-MA-M53
**offlineOrderQueue NetInfo Listener Not Cleaned Up**
- **File:** `services/api/orderQueue.ts:35-43`
- **Fix:** Call `destroy()` on listener cleanup
- **Effort:** 10 minutes

### D-05. G-MA-M61
**Double sync on network restoration**
- **File:** `hooks/useNetworkStatus.ts:188-244`
- **Fix:** Remove redundant `NetInfo.fetch()` call alongside `addEventListener`
- **Effort:** 15 minutes

### D-06. RZ-B-M1
**Plan Expiry Worker Can Overlap with Itself**
- **File:** `src/workers/planWorkers.ts:24`
- **Fix:** Add `concurrency: 1`
- **Effort:** 5 minutes

### D-07. RZ-B-M2
**Booking-Match Mapping Only in Redis (No DB Backup)**
- **File:** `src/services/MeetupService.ts:52`
- **Fix:** Store in `MeetupBooking` table as source of truth
- **Effort:** 1 hour

### D-08. RZ-B-M3
**Unmatch Does Not Clean Up Related Records**
- **File:** `src/services/MatchService.ts:157-164`
- **Fix:** Clean up MessageRequest and MessageState records in a transaction
- **Effort:** 1 hour

### D-09. RZ-B-M5
**Inbox Has No Pagination**
- **File:** `src/services/MessageRequestService.ts:141-152`
- **Fix:** Add `take`/`skip` pagination
- **Effort:** 30 minutes

### D-10. RZ-B-M6
**Trust Decay Worker Loads All Profiles into Memory**
- **File:** `src/workers/trustDecayWorker.ts:23-43`
- **Fix:** Use `prisma.$executeRaw` for decay calculation in SQL
- **Effort:** 1 hour

### D-11. RZ-B-M8
**Redis Cache as Only Source of Truth for Booking-Match Mapping**
- **File:** `src/services/MeetupService.ts:52`
- **Fix:** Same as RZ-B-M2
- **Effort:** 1 hour

### D-12. RZ-B-M10
**Unnecessary DB Re-Fetch After Atomic Update**
- **File:** `src/services/ExperienceCreditService.ts:70`
- **Fix:** Remove the unnecessary `findUnique` call after `updateMany`
- **Effort:** 10 minutes

### D-13. RZ-M-O1
**No Offline Queue for Chat Messages**
- **File:** `src/app/ChatScreen.tsx:103-105`
- **Fix:** Implement offline queue for unsent messages
- **Effort:** 2 hours

### D-14. RZ-M-O2
**Historical Messages Fetched Fresh on Every Navigation**
- **File:** `src/app/ChatScreen.tsx:32-35`
- **Fix:** Add `staleTime` or persistent cache
- **Effort:** 1 hour

### D-15. RZ-M-O3
**TanStack Query `retry: 2` Applies to ALL Queries Globally**
- **File:** `src/app/_layout.tsx`
- **Fix:** Set per-query retry instead of global default
- **Effort:** 1 hour

### D-16. RZ-M-R1
**Socket Reconnection with No Failure Handler**
- **File:** `src/hooks/useRealtimeChat.ts:53-54`
- **Fix:** Add `reconnectionAttemptsExhausted` handler
- **Effort:** 15 minutes

### D-17. RZ-M-R3
**Socket Disconnects on App Background — Messages May Be Lost**
- **File:** `src/hooks/useRealtimeChat.ts:47`
- **Fix:** Implement message queue for background disconnection
- **Effort:** 1 hour

### D-18. RZ-M-R4
**Socket Error Handler Logs But Doesn't Surface to User**
- **File:** `src/hooks/useRealtimeChat.ts:91-93`
- **Fix:** Show user-facing notification on socket errors
- **Effort:** 15 minutes

### D-19. G-KU-M4
**No Real-Time Sync — Check-In Status Goes Stale**
- **File:** All karma screens
- **Fix:** Implement real-time subscription or force-refresh after mutations
- **Effort:** 2 hours

### D-20. G-KU-M10
**`Promise.all` Executes Before Early Return in `fetchData`**
- **File:** `app/karma/home.tsx:264-289`
- **Fix:** Return early before any async work
- **Effort:** 15 minutes

### D-21. G-KU-M11
**`finally` Block Ignores `isMounted()` Guard — Inconsistent State**
- **File:** `app/karma/my-karma.tsx:184-205`
- **Fix:** Remove redundant `isMounted()` guard in finally
- **Effort:** 10 minutes

### D-22. A10-M6
**socketConnectionLost Banner Never Resets**
- **File:** `app/(dashboard)/live-monitor.tsx:345`
- **Fix:** Set to `false` on `connect` event
- **Effort:** 5 minutes

### D-23. A10-M7
**React Query Not Used for Wallet/Financial Data**
- **Files:** `wallet.tsx`, `user-wallets.tsx`, `wallet-adjustment.tsx`
- **Fix:** Replace raw `useState` + API calls with React Query
- **Effort:** 2 hours

### D-24. A10-M8
**approvalThreshold Never Refreshes After Load**
- **File:** `app/(dashboard)/wallet-adjustment.tsx:232`
- **Fix:** Refetch threshold periodically or on relevant events
- **Effort:** 30 minutes

### D-25. A10-M17
**Dashboard Refetches on Every Tab Switch**
- **File:** `app/(dashboard)/index.tsx:163-169`
- **Fix:** Use `staleTime` to prevent unnecessary refetches
- **Effort:** 30 minutes

### D-26. A10-M18
**Wallet Mutations Don't Invalidate Query Cache**
- **Files:** `wallet-adjustment.tsx`, `user-wallets.tsx`
- **Fix:** Add `queryClient.invalidateQueries()` after mutations
- **Effort:** 15 minutes

### D-27. RP-M18
**getLastSyncDate() Reads In-Memory Array — Full Re-Sync After Restart**
- **File:** `Rendez/rendez-backend/src/merchantservices/SyncService.ts:167-170`
- **Fix:** Read from `SyncHistoryModel` collection instead of in-memory array
- **Effort:** 30 minutes

### D-28. RP-M19
**/api/sync/statistics Leaks Global Stats to Any Authenticated Merchant**
- **File:** `Rendez/rendez-backend/src/merchantroutes/sync.ts:188-204`
- **Fix:** Add `merchantId` filter to aggregate statistics query
- **Effort:** 30 minutes

### D-29. RP-M20
**Wallet Prive Coins Reclassified as Rez in Ledger**
- **File:** `walletService.ts` (backend)
- **Fix:** Add `prive` to `LedgerEntry.coinType` enum
- **Effort:** 1 hour

### D-30. RP-M23
**Consumer App Socket.IO Has No Reconnect Limit**
- **File:** `rez-app-consumer/services/realTimeService.ts:587-606`
- **Fix:** Add `reconnectionAttempts: 10` cap
- **Effort:** 15 minutes

### D-31. RP-M24
**Socket.IO Reconnect Loop — No Circuit Breaker**
- **File:** `rez-app-consumer/services/realTimeService.ts`
- **Fix:** Add circuit breaker after max reconnect attempts
- **Effort:** 1 hour

### D-32. NW-MED-008
**Socket not cleaned up when UPI modal closes**
- **File:** `components/checkout/PaymentOptions.tsx:107-110`
- **Fix:** Call `disconnect()` from `usePaymentConfirmation` when modal closes
- **Effort:** 10 minutes

### D-33. NW-MED-009
**Socket connect failure silently hangs — no user feedback**
- **File:** `lib/hooks/usePaymentConfirmation.ts:103-105`
- **Fix:** Set `connectionFailed` flag on `connect_error`
- **Effort:** 15 minutes

### D-34. NW-MED-010
**Multiple Socket.IO connections on rapid modal open/close**
- **File:** `lib/hooks/usePaymentConfirmation.ts:62-106`
- **Fix:** Always call `disconnect()` before creating a new socket
- **Effort:** 15 minutes

### D-35. NW-MED-034
**Waiter cooldown per-tab via sessionStorage — bypassable via multi-tab**
- **File:** `components/menu/WaiterCallButton.tsx:21-29`
- **Fix:** Use `localStorage` and server-side rate limiting
- **Effort:** 1 hour

### D-36. NW-MED-012
**authStore.isLoggedIn persists independently of token validity**
- **File:** `lib/store/authStore.ts:35-42`
- **Fix:** Derive `isLoggedIn` from token presence only
- **Effort:** 15 minutes

---

## Category 3: API Contracts & Type Safety

### T-01. NA-MED-07
**AddressType Uses SCREAMING_CASE But Canonical Uses lowercase**
- **File:** `services/addressApi.ts:6-10`
- **Fix:** Change `HOME = 'HOME'` to `home = 'home'`
- **Effort:** 10 minutes

### T-02. NA-MED-08
**Booking Status Enum Missing Canonical Values**
- **File:** `services/bookingApi.ts:22`
- **Fix:** Import `BookingStatus` from `@rez/shared`
- **Effort:** 15 minutes

### T-03. NA-MED-09
**Duplicate `TransactionMetadata` Interface (Twice in Same File)**
- **File:** `services/walletApi.ts:130-156 and 278-304`
- **Fix:** Remove duplicate definition
- **Effort:** 5 minutes

### T-04. NA-MED-10
**`paymentStatus` Type Missing Canonical Values**
- **File:** `services/ordersApi.ts:65`
- **Fix:** Update type to include `'awaiting_payment'`, `'processing'`, `'authorized'`
- **Effort:** 15 minutes

### T-05. NA-MED-12
**Duplicate `startOfWeek` Declared Twice in Same Function**
- **File:** `rez-karma-service/src/services/karmaService.ts:128 and 195`
- **Fix:** Remove line 128
- **Effort:** 5 minutes

### T-06. NA-MED-13
**Week Boundary Inconsistency — locale vs ISO Week**
- **File:** `karmaService.ts:128` vs `batchService.ts:577`
- **Fix:** Use `startOf('isoWeek')` consistently in both
- **Effort:** 10 minutes

### T-07. NA-MED-14
**Conflicting `normalizeLoyaltyTier` in Two Shared Files**
- **Files:** `rez-shared/src/constants/coins.ts:139`, `enums.ts:20`
- **Fix:** Consolidate to one canonical normalizer
- **Effort:** 30 minutes

### T-08. G-MA-M43
**ProductsService search vs query param name**
- **File:** `services/api/products.ts:180`
- **Fix:** Verify backend param name and align frontend
- **Effort:** 15 minutes

### T-09. G-MA-M44
**ProductsService getProducts uses any**
- **File:** `services/api/products.ts:190`
- **Fix:** Replace `apiClient.get<any>(...)` with typed interface
- **Effort:** 30 minutes

### T-10. G-MA-M47
**CoinsService search query param name mismatch**
- **File:** `services/api/coins.ts:98-99`
- **Fix:** Verify backend param name and align frontend
- **Effort:** 15 minutes

### T-11. G-MA-M52
**Socket event handlers cast to any**
- **File:** `services/api/socket.ts:258-368`
- **Fix:** Use `ServerToClientEvents` and `ClientToServerEvents` types
- **Effort:** 1 hour

### T-12. G-MA-M54
**MerchantId extraction uses any pattern 6 times**
- **File:** `services/api/socket.ts:414-543`
- **Fix:** Centralize extraction logic
- **Effort:** 30 minutes

### T-13. G-MA-M55
**SocketContext listeners untyped**
- **File:** `contexts/SocketContext.tsx:62-66`
- **Fix:** Type `status` as `'connected' | 'disconnected' | 'reconnecting'`
- **Effort:** 15 minutes

### T-14. G-MA-M63
**PaymentStatus Defined in 3 Separate Files**
- **Files:** `types/api.ts:174`, `services/api/services.ts:92`, `utils/paymentValidation.ts:34`
- **Fix:** Single canonical definition in `types/api.ts`
- **Effort:** 1 hour

### T-15. G-MA-M64
**OrderStatus Defined 3x with Different Values**
- **Files:** `types/api.ts:160`, `app/orders/live.tsx:34`, `app/(dashboard)/aggregator-orders.tsx:35`
- **Fix:** Single canonical `OrderStatus` with aggregator-specific type
- **Effort:** 1 hour

### T-16. G-MA-M67
**PaymentStatusResponse Has 4 Values vs PaymentStatus Has 6**
- **File:** `services/api/pos.ts:85-88`
- **Fix:** Align `PaymentStatusResponse.status` with `PaymentStatus` type
- **Effort:** 15 minutes

### T-17. G-MA-M68
**Product Bulk Export/Import Uses Raw fetch() Bypassing apiClient**
- **File:** `services/api/products.ts:375, 427, 653`
- **Fix:** Wrap in apiClient or add auth/refresh logic
- **Effort:** 1 hour

### T-18. RP-M01
**pointsApi.getBalance() Has No Real /points Endpoint**
- **File:** `rez-app-consumer/services/pointsApi.ts`
- **Fix:** Document as wallet API proxy or implement real endpoint
- **Effort:** 30 minutes

### T-19. RP-M04
**Local Enums Not Imported from shared-types**
- **Files:** `rez-app-consumer/services/ordersApi.ts`, `rez-app-marchant/services/api/orders.ts`
- **Fix:** Import from `packages/shared-types`
- **Effort:** 1 hour

### T-20. RP-M05
**POS Bill Status Uses `paid` Instead of `completed`**
- **File:** `rez-app-marchant/services/api/pos.ts`
- **Fix:** Align with canonical schema
- **Effort:** 15 minutes

### T-21. RP-M06
**breakdown.cashback vs breakdown.cashbackBalance Dual Field**
- **File:** `rez-app-consumer/services/walletApi.ts`
- **Fix:** Pick one authoritative field name
- **Effort:** 15 minutes

### T-22. RP-M09
**Product Creation Response Schema Unverified**
- **File:** `rez-app-marchant/services/api/products.ts:32-65` vs `productController.ts`
- **Fix:** Verify backend response includes all fields
- **Effort:** 1 hour

### T-23. RP-M13
**Duplicate TransactionMetadata Interface in Same File**
- **File:** `rez-app-consumer/services/walletApi.ts:145 and 303`
- **Fix:** Remove duplicate
- **Effort:** 5 minutes

### T-24. RP-M14
**Merchant Loyalty Config Schema Duplicated Byte-for-Byte**
- **Files:** `rezbackend/src/models/MerchantLoyaltyConfig.ts` + `rez-merchant-service/src/models/MerchantLoyaltyConfig.ts`
- **Fix:** Move to shared package
- **Effort:** 1 hour

### T-25. RP-M15
**LoyaltyReward Uses customerPhone + storeSlug Instead of ObjectIds**
- **File:** `rezbackend/src/models/LoyaltyReward.ts:7-10`
- **Fix:** Replace with ObjectId references
- **Effort:** 2 hours

### T-26. RP-M16
**Batch Stats Uses Raw MongoDB Aggregation in Route Handler**
- **File:** `rez-karma-service/src/routes/batchRoutes.ts`
- **Fix:** Move aggregation to service layer
- **Effort:** 1 hour

### T-27. RP-M17
**Analytics Uses Math.random() for Internal Session IDs**
- **Files:** `AnalyticsService.ts`, `CustomProvider.ts`, `searchAnalyticsService.ts`
- **Fix:** Replace with `crypto.randomUUID()`
- **Effort:** 15 minutes

### T-28. RZ-M-E1a
**ChatState Type Defined Locally But Used as Untyped String**
- **File:** `src/app/ChatScreen.tsx:38`
- **Fix:** Import ChatState from shared type
- **Effort:** 10 minutes

### T-29. RZ-M-E2a
**No Enum for Plan Statuses — Raw Strings Throughout**
- **File:** `src/app/MyPlansScreen.tsx:13-16`
- **Fix:** Define and import PlanStatus enum
- **Effort:** 30 minutes

### T-30. G-KU-M14
**`Transaction.type` `'converted'` Not in Canonical Enum**
- **File:** `services/karmaService.ts:165` + `app/karma/wallet.tsx:35-39`
- **Fix:** Import `CoinTransactionType` from canonical
- **Effort:** 15 minutes

### T-31. G-KU-M15
**`Booking.status` 5 Values Unverified Against Booking Service**
- **File:** `services/karmaService.ts:90`
- **Fix:** Use `qrCheckedIn` boolean as primary check
- **Effort:** 15 minutes

### T-32. G-KU-M16
**`verificationSignals` Field Names Mismatch With Canonical**
- **File:** `services/karmaService.ts:135`
- **Fix:** Align with canonical `IEarnRecord` shape
- **Effort:** 1 hour

### T-33. NW-MED-005
**Coupon and AvailableCoupon interfaces incompatible**
- **Files:** `lib/api/coupons.ts:3-10` vs `lib/types/index.ts:227-233`
- **Fix:** Single `Coupon` interface. Remove duplicate `AvailableCoupon` type
- **Effort:** 30 minutes

### T-34. NW-MED-027
**getScanPayHistory returns untyped data**
- **File:** `lib/api/scanPayment.ts:43-47`
- **Fix:** Define `ScanPayHistoryItem` interface
- **Effort:** 15 minutes

### T-35. NW-MED-028
**auth.ts API paths inconsistent — some have /api prefix, some don't**
- **File:** `lib/api/auth.ts:48-52`
- **Fix:** Standardize all paths with `/api` prefix
- **Effort:** 15 minutes

### T-36. NW-MED-040
**getBillDetails duplicated with incompatible response shapes**
- **Files:** `lib/api/bill.ts` vs `lib/api/merchantBill.ts`
- **Fix:** Consolidate to one `getBillDetails` in `merchantBill.ts`
- **Effort:** 30 minutes

### T-37. NW-MED-041
**getRecommendations has no error handling or type safety**
- **File:** `lib/api/store.ts:38-43`
- **Fix:** Add typed return interface and try/catch
- **Effort:** 15 minutes

### T-38. NW-MED-046
**Razorpay key passed as empty string — no validation before payment**
- **Files:** `app/[storeSlug]/pay/checkout/page.tsx:149`, `app/[storeSlug]/checkout/page.tsx:222-223`
- **Fix:** Guard against empty key ID. Disable Pay button if key missing
- **Effort:** 15 minutes

### T-39. RP-M11
**EventBooking Uses strict: false Mongoose Schema**
- **File:** `rez-karma-service/src/engines/verificationEngine.ts`
- **Fix:** Enable `strict: true` and create shared schema package
- **Effort:** 1 hour

### T-40. RP-M12
**Local Enums Not from shared-types**
- **File:** Individual apps
- **Fix:** Import from `packages/shared-types`
- **Effort:** 1 hour

### T-41. A10-M11
**uploadFile Retry Consumes FormData Stream**
- **File:** `services/api/apiClient.ts:298-327`
- **Fix:** Clone FormData before first attempt
- **Effort:** 1 hour

### T-42. A10-M12
**response.json() Without Content-Type Check**
- **File:** `services/api/apiClient.ts:129, 306`
- **Fix:** Check `Content-Type: application/json` before calling `response.json()`
- **Effort:** 15 minutes

### T-43. A10-M16
**70+ `as any` Casts on router.push Calls**
- **Files:** `index.tsx`, `settings.tsx`, multiple screens
- **Fix:** Use proper typed route definitions
- **Effort:** 4 hours

### T-44. A10-M3
**Four Nested Theme Providers, Two Are Dead**
- **File:** `app/_layout.tsx:366-378`
- **Fix:** Remove `AdminThemeProvider` if unused
- **Effort:** 30 minutes

### T-45. RZ-A-M7
**TanStack Query Installed But Never Initialized**
- **File:** `package.json` + `src/app/layout.tsx`
- **Fix:** Wrap app in `QueryClientProvider`
- **Effort:** 30 minutes

### T-46. RZ-A-M9
**metadata Export in Client Component Ignored**
- **File:** `src/app/layout.tsx:6`
- **Fix:** Use `generateMetadata` instead
- **Effort:** 15 minutes

---

## Category 4: Security & Auth

### S-01. NA-MED-21
**Perceptual Hash Unreachable in Bill Verification**
- **File:** `services/imageHashService.ts:167, 342, 360`
- **Fix:** Fix hash to return actual similarity scores (0-100 range)
- **Effort:** 1 hour

### S-02. NA-MED-22
**Client-Side Fraud Detection with Fail-Open**
- **File:** `services/fraudDetectionService.ts`
- **Fix:** Fail-closed: any exception should reject or flag for manual review
- **Effort:** 30 minutes

### S-03. RZ-B-M11
**shadowScore Increment Gameable — No Rate Limit on Decline**
- **File:** `src/services/MessageRequestService.ts:132`
- **Fix:** Add daily decline rate limit (e.g., max 20/day)
- **Effort:** 1 hour

### S-04. RZ-B-M12
**reportUser Endpoint Has No Rate Limiting**
- **File:** `src/services/ModerationService.ts:60` + `src/routes/moderation.ts:30`
- **Fix:** Add rate limiting (max 10 reports/user/hour)
- **Effort:** 1 hour

### S-05. G-KU-M5
**No Auth Guard on Scan Screen; 401 Not Handled Gracefully**
- **File:** `app/karma/scan.tsx:71-91`, `event/[id].tsx:71-75`
- **Fix:** Add auth guard component and 401 handling
- **Effort:** 30 minutes

### S-06. G-KU-M6
**Every Catch Block Is Empty — non-fatal**
- **Files:** `explore.tsx:233`, `my-karma.tsx:196`, `wallet.tsx:124`, `home.tsx:283`
- **Fix:** Add local error state and show toast/banner
- **Effort:** 1 hour

### S-07. G-MA-L16
**Web token storage in localStorage (XSS accessible)**
- **File:** `services/storage.ts:19`
- **Fix:** Use httpOnly cookies or encrypted storage
- **Effort:** 1 hour

### S-08. G-MA-L17
**Invitation token in URL path — access log exposure**
- **File:** `services/api/team.ts:335-338`
- **Fix:** Pass token in request body instead of URL
- **Effort:** 30 minutes

### S-09. G-MA-L18
**Deep link — custom URL scheme instead of universal links**
- **File:** `app.config.js:9, 26, 52-57`
- **Fix:** Use universal links (HTTPS) in production
- **Effort:** 2 hours

### S-10. G-MA-L19
**Console logs in AuthContext expose auth flow internals**
- **File:** `contexts/AuthContext.tsx:107, 244, 317, 374`
- **Fix:** Remove `__DEV__` console logs or use telemetry
- **Effort:** 30 minutes

### S-11. G-MA-L21
**MIN_PASSWORD_LENGTH: 6 — OWASP violation**
- **File:** `constants/teamConstants.ts:321`
- **Fix:** Increase to 8+ with complexity requirement
- **Effort:** 15 minutes

### S-12. NW-MED-029
**No rate limiting on OTP endpoint**
- **File:** `lib/api/auth.ts:4-12`
- **Fix:** Disable send button for 30s. Ensure backend enforces rate limits
- **Effort:** 15 minutes

### S-13. NW-MED-037
**Analytics endpoint unauthenticated + raw fetch bypass**
- **File:** `lib/analytics/events.ts`
- **Fix:** Add auth headers or use Axios `publicClient` with proper timeout
- **Effort:** 30 minutes

### S-14. RP-M21
**Auth Service 503 Fails Open for Non-Admin Routes**
- **File:** `rez-karma-service/src/middleware/auth.ts:57`
- **Fix:** Add circuit breaker. Fail-closed for critical routes
- **Effort:** 1 hour

### S-15. RP-M22
**Merchant Socket No Room Ownership Validation**
- **File:** `rez-app-marchant/services/api/socket.ts:121, 172-228`
- **Fix:** Validate `socket.auth.merchantId === emitted merchantId` server-side
- **Effort:** 1 hour

### S-16. A10-M1
**localStorage XSS Risk Acknowledged and Accepted**
- **File:** `services/storage.ts:30-35`
- **Fix:** Use httpOnly cookies (Phase 6 in progress)
- **Effort:** 2 hours

### S-17. A10-M2
**requireMerchant Accepts Cookie Token Without CSRF Protection**
- **File:** `rez-api-gateway/src/shared/authMiddleware.ts:93-135`
- **Fix:** Add CSRF token validation for state-changing requests
- **Effort:** 2 hours

### S-18. A10-M19
**Redis Fail-Open Outside Production on Blacklist Check**
- **File:** `rez-order-service/src/httpServer.ts:202-224`
- **Fix:** Fail-closed always; log warning in non-prod
- **Effort:** 15 minutes

### S-19. RZ-M-S3
**JWT Decode Uses `atob` — Not Available in React Native**
- **File:** `src/app/MatchesScreen.tsx:80-82`
- **Fix:** Use `jwt-decode` package
- **Effort:** 15 minutes

### S-20. RZ-M-S4
**Notification Deep Link Has No Auth Guard**
- **File:** `src/hooks/useDeepLink.ts:31-53`
- **Fix:** Verify user session before navigating to protected routes
- **Effort:** 30 minutes

---

## Category 5: UX & Performance

### U-01. NA-MED-05
**No Offline Indicator Anywhere in the App**
- **File:** All screens making network calls
- **Fix:** Create `OfflineBanner` component with `NetInfo`
- **Effort:** 1 hour

### U-02. NA-MED-16
**Default Timeout 30s — Too Long for Mobile UX**
- **File:** `services/apiClient.ts:241`, `config/env.ts:24`
- **Fix:** Change default timeout from 30s to 8s
- **Effort:** 10 minutes

### U-03. NA-MED-18
**Checkout Page 609 Lines with Zero Memoization**
- **File:** `app/checkout.tsx:223-609`
- **Fix:** Wrap sub-components with `React.memo`. Use `useCallback`
- **Effort:** 2 hours

### U-04. NA-MED-19
**`CoinTogglesSection` Coin Slider Has No Debounce**
- **File:** `hooks/useCheckoutUI.ts`
- **Fix:** Add debounce to the coin toggle handler
- **Effort:** 15 minutes

### U-05. G-MA-M01
**Quick action buttons have no loading state**
- **File:** `app/(dashboard)/orders.tsx:361-434`
- **Fix:** Add loading state per action button
- **Effort:** 30 minutes

### U-06. G-MA-M02
**Product status toggle — zero feedback on iOS success**
- **File:** `app/(dashboard)/products.tsx:221-258`
- **Fix:** Add success feedback for iOS
- **Effort:** 15 minutes

### U-07. G-MA-M03
**Login navigation is instantaneous — no loading transition**
- **File:** `app/(auth)/login.tsx:34`
- **Fix:** Show loading/splash before navigation
- **Effort:** 30 minutes

### U-08. G-MA-M04
**Quick Bill — no success toast after generate**
- **File:** `app/pos/quick-bill.tsx:148`
- **Fix:** Add `showToast('Bill generated')` on success
- **Effort:** 10 minutes

### U-09. G-MA-M10
**OTP paste — not supported on iOS Safari / some Android keyboards**
- **File:** `app/(auth)/register.tsx:60-64`
- **Fix:** Add clipboard paste handler
- **Effort:** 15 minutes

### U-10. G-MA-M13
**Register back press loses OTP without warning**
- **File:** `app/(auth)/register.tsx:109`
- **Fix:** Add confirmation dialog before going back on OTP step
- **Effort:** 15 minutes

### U-11. G-MA-M14
**Dark mode broken across most screens**
- **Files:** `FormInput.tsx`, `FormSelect.tsx`, `ConfirmModal.tsx`, `Alert.tsx`, `PrimaryButton.tsx`
- **Fix:** Replace hardcoded colors with `Colors[scheme]`
- **Effort:** 4 hours

### U-12. G-MA-M15
**Web notification banner — emoji in Text (WCAG violation)**
- **File:** `app/(dashboard)/orders.tsx:991-1001`
- **Fix:** Use Ionicons with `accessibilityLabel`
- **Effort:** 30 minutes

### U-13. G-MA-M16
**FormSelect — modal has no keyboard dismiss**
- **File:** `components/forms/FormSelect.tsx:218-226`
- **Fix:** Add `accessibilityLabel` and keyboard dismiss handler
- **Effort:** 15 minutes

### U-14. G-MA-M17
**Create Offer Wizard — no step count text in header**
- **File:** `app/(dashboard)/create-offer.tsx:198-215`
- **Fix:** Add "Step 2 of 3" counter
- **Effort:** 10 minutes

### U-15. G-MA-M18
**Confirm Modal — no visual affordance for backdrop tap**
- **File:** `components/common/ConfirmModal.tsx:87`
- **Fix:** Add subtle hint or cursor pointer on backdrop
- **Effort:** 10 minutes

### U-16. G-MA-M58
**KDS order limit 200 with no date filter or auto-purge**
- **File:** `app/kds/index.tsx:803-821`
- **Fix:** Add date filter and auto-expire old ready orders
- **Effort:** 1 hour

### U-17. G-MA-M59
**POS product catalog hard-capped at 100 items**
- **File:** `app/pos/index.tsx:400-431`
- **Fix:** Add pagination or category-based lazy loading
- **Effort:** 1 hour

### U-18. G-MA-M60
**StoreContext redundant API calls on auth flow**
- **File:** `contexts/StoreContext.tsx:337-347`
- **Fix:** Deduplicate calls on auth state changes
- **Effort:** 30 minutes

### U-19. G-MA-M62
**FlatList re-renders on every cart change**
- **File:** `app/pos/index.tsx:797-815`
- **Fix:** Memoize `renderProduct` callback
- **Effort:** 30 minutes

### U-20. G-KU-M2
**Full-Screen Spinner on Every Tab Refocus**
- **File:** `app/karma/my-karma.tsx:229-238`, `wallet.tsx:99-171`
- **Fix:** Use `isInitialLoad` only for first mount
- **Effort:** 30 minutes

### U-21. G-KU-M3
**Level Progress Uses Hardcoded Thresholds Instead of Backend nextLevelAt**
- **File:** `app/karma/home.tsx:40-45, 127-129`
- **Fix:** Use `profile.nextLevelAt ?? levelCfg.next`
- **Effort:** 15 minutes

### U-22. G-KU-M7
**Unknown Difficulty Values Silently Render as "medium"**
- **File:** `app/karma/event/[id].tsx:367-380`, `explore.tsx:96-104`
- **Fix:** Add guard for unknown difficulty values
- **Effort:** 15 minutes

### U-23. RZ-M-B2
**Booking Date Validation Allows Whitespace-Only String**
- **File:** `src/app/MeetupScreen.tsx:161`
- **Fix:** Check for whitespace-only input
- **Effort:** 10 minutes

### U-24. RZ-M-B4
**`partySize` Hardcoded to 2**
- **File:** `src/app/MeetupScreen.tsx:72`
- **Fix:** Accept dynamic party size from user input
- **Effort:** 15 minutes

### U-25. RZ-M-P1a
**Confetti Particles Not Memoized**
- **File:** `src/app/DiscoverScreen.tsx:23-71`
- **Fix:** Memoize particle components
- **Effort:** 30 minutes

### U-26. RZ-M-P2
**`relativeTime` Function Recreated on Every Render**
- **File:** `src/app/MatchesScreen.tsx:46-56`
- **Fix:** Extract to module-level or memoize
- **Effort:** 15 minutes

### U-27. RZ-M-P3
**SwipeCard Not Memoized**
- **File:** `src/app/DiscoverScreen.tsx:173-287`
- **Fix:** Memoize SwipeCard component
- **Effort:** 30 minutes

### U-28. RZ-M-U1
**Profile Setup Silently Fails on Invalid Age Input**
- **File:** `src/app/ProfileSetupScreen.tsx:36-40`
- **Fix:** Show which field failed in error message
- **Effort:** 15 minutes

### U-29. RZ-M-U2
**Chat Input Shows No Character Count**
- **File:** `src/app/ChatScreen.tsx:196-204`
- **Fix:** Add character count display
- **Effort:** 15 minutes

### U-30. RZ-M-U3
**Share Invite Fails Silently**
- **File:** `src/app/ProfileScreen.tsx:25-35`
- **Fix:** Show error toast on failure
- **Effort:** 15 minutes

### U-31. RZ-M-U4
**Discover Feed Shows No Error State**
- **File:** `src/app/DiscoverScreen.tsx:297-300`
- **Fix:** Add error boundary with retry button
- **Effort:** 15 minutes

### U-32. RZ-A-M4
**No Loading Skeletons — Flash of Unstyled Content**
- **Status:** OPEN
- **Fix:** Add skeleton loaders
- **Effort:** 2 hours

### U-33. RZ-A-M9
**Offline Indicator Missing**
- **Status:** OPEN
- **Fix:** Add offline detection with banner
- **Effort:** 1 hour

### U-34. NW-MED-014
**UPI fallback fires in 2 seconds — real UPI payments take 5-15s**
- **File:** `components/checkout/PaymentOptions.tsx:102` + `lib/utils/upi.ts:68`
- **Fix:** Increase to 15000ms with visible countdown
- **Effort:** 30 minutes

### U-35. NW-MED-015
**Razorpay script loaded on every page mount — 150KB blocking**
- **File:** `lib/hooks/useRazorpay.ts:45-56`
- **Fix:** Lazy-load with `<link rel="preload">` on payment page only
- **Effort:** 1 hour

### U-36. NW-MED-016
**OffersModal re-fetches coupons on every modal open**
- **File:** `components/cart/OffersModal.tsx:76-84`
- **Fix:** Cache coupons in component state with 5-minute TTL
- **Effort:** 30 minutes

### U-37. NW-MED-018
**UPI retry button doesn't distinguish failure modes**
- **File:** `components/checkout/PaymentOptions.tsx:240-244`
- **Fix:** Query `checkPaymentStatus(paymentId)` before showing retry
- **Effort:** 30 minutes

### U-38. NW-MED-019
**No minimum amount guard before creating Razorpay order**
- **File:** `lib/api/payment.ts:20-26`
- **Fix:** Validate `if (subtotal < 100)` before calling
- **Effort:** 10 minutes

### U-39. NW-MED-020
**OffersModal Apply button not disabled when below minimum order**
- **File:** `components/cart/OffersModal.tsx:145-151`
- **Fix:** Disable Apply buttons for coupons exceeding cart subtotal
- **Effort:** 15 minutes

### U-40. NW-MED-022
**getFeaturedStores silent failure cached for 5 minutes**
- **File:** `lib/api/search.ts:62-72`
- **Fix:** Exponential backoff retry (max 3) before fallback to `[]`
- **Effort:** 30 minutes

### U-41. NW-MED-023
**SplitBillModal allows 0 or negative amounts**
- **File:** `components/checkout/SplitBillModal.tsx`
- **Fix:** Add `if (totalAmount < 100)` guard
- **Effort:** 10 minutes

### U-42. NW-MED-031
**console.log used in Socket.IO hooks — fitness test violation**
- **File:** `lib/hooks/useOrderSocket.ts:27, 31, 41`
- **Fix:** Replace with centralized telemetry logger
- **Effort:** 15 minutes

### U-43. NW-MED-032
**SearchHighlight only highlights first occurrence of query**
- **File:** `components/menu/SearchHighlight.tsx:15-40`
- **Fix:** Use regex with global flag to replace all occurrences
- **Effort:** 10 minutes

### U-44. NW-MED-033
**Checkout page flashes empty before redirect on empty cart**
- **File:** `app/[storeSlug]/checkout/page.tsx:162-165`
- **Fix:** Show "Your cart is empty" toast before redirecting
- **Effort:** 10 minutes

### U-45. RP-M28
**Cart Optimistic Update Without Rollback**
- **Fix:** Add rollback on failed sync
- **Effort:** 2 hours

### U-46. A10-M13
**No Lazy Loading on 100+ Screens**
- **File:** `_layout.tsx:38-732`, `App.tsx:16`
- **Fix:** Use dynamic imports for non-critical screens
- **Effort:** 4 hours

### U-47. A10-M15
**FlatList Uses Array Index as Key**
- **Files:** `orders.tsx:823`, `merchants.tsx:1025`
- **Fix:** Use stable IDs as keys
- **Effort:** 1 hour

### U-48. RZ-A-M6
**Dashboard Metrics Refresh on Every Route Change**
- **Status:** OPEN
- **Fix:** Wrap expensive computations with `useMemo`
- **Effort:** 1 hour

### U-49. RP-M29
**Offline Queue Silently Discards After MAX_RETRIES**
- **Fix:** Show persistent error banner
- **Effort:** 1 hour

---

## Category 6: Business Logic & Data Integrity

### B-01. NA-MED-02
**3 Independent Coin Sources with No Cross-Verification**
- **Files:** `services/walletApi.ts`, `services/pointsApi.ts`, `services/gamificationActions`
- **Fix:** Add `GET /wallet/sync-status` endpoint
- **Effort:** 2 hours

### B-02. NA-MED-03
**Offline Queue Persistence Failure Silently Drops Operations**
- **Files:** `services/offlineQueueService.ts`, `services/offlineSyncService.ts`
- **Fix:** Wrap `persistQueue()` in try-catch with user notification
- **Effort:** 1 hour

### B-03. G-MA-M05
**Offer config — no bounds validation on numeric fields**
- **File:** `components/offers/OfferConfigForm.tsx:87-128`
- **Fix:** Add inline min/max validation for all numeric fields
- **Effort:** 30 minutes

### B-04. G-MA-M06
**Cashback % field — no max value**
- **File:** `components/offers/OfferConfigForm.tsx:87-93`
- **Fix:** `keyboardType="number-pad" maxLength={3}` with validation
- **Effort:** 10 minutes

### B-05. G-MA-M07
**Customer phone field — no format validation**
- **File:** `app/pos/quick-bill.tsx:223-232`
- **Fix:** Add `/^[6-9]\d{9}$/` regex validation
- **Effort:** 10 minutes

### B-06. G-MA-M08
**Phone validation — only checks length**
- **File:** `app/(auth)/register.tsx:215`
- **Fix:** `if (!/^[6-9]\d{9}$/.test(cleaned))`
- **Effort:** 10 minutes

### B-07. G-MA-M09
**Large bill amount — no upper limit**
- **File:** `app/pos/quick-bill.tsx:100-113`
- **Fix:** `if (amount > 999999999) { showAlert('Amount exceeds maximum'); return; }`
- **Effort:** 10 minutes

### B-08. G-MA-M11
**Bank detail update — no summary before biometric**
- **File:** `app/(dashboard)/wallet.tsx:538-571`
- **Fix:** Show confirmation screen before biometric prompt
- **Effort:** 30 minutes

### B-09. G-MA-M12
**Withdrawal — no amount confirmation before biometric**
- **File:** `app/(dashboard)/wallet.tsx:500-536`
- **Fix:** Add "You are about to withdraw ₹X" confirmation step
- **Effort:** 15 minutes

### B-10. G-MA-M29
**CoinDrops.createCoinDrop — no amount validation**
- **File:** `services/api/coinDrops.ts:54-57`
- **Fix:** Add min/max/NaN validation for all numeric fields
- **Effort:** 30 minutes

### B-11. G-MA-M30
**BrandedCoins.awardCoins — no amount validation**
- **File:** `services/api/brandedCoins.ts:52-63`
- **Fix:** Add `amount: number` min/max/NaN check
- **Effort:** 15 minutes

### B-12. G-MA-M31
**Cashback per-item display uses wrong formula**
- **File:** `app/(cashback)/[id].tsx:302`
- **Fix:** Use actual cashback distribution formula
- **Effort:** 30 minutes

### B-13. G-MA-M32
**CGST/SGST hardcoded at 9%**
- **File:** `app/settlements/index.tsx:247-248`
- **Fix:** Fetch GST rate from backend config
- **Effort:** 15 minutes

### B-14. G-MA-M33
**Case-sensitive status transition lookup**
- **File:** `services/api/orders.ts:80-83`
- **Fix:** Normalize status to lowercase at API boundary
- **Effort:** 15 minutes

### B-15. G-MA-M35
**totalCustomersToday === 0 triggers wrong fallback**
- **File:** `services/api/dashboard.ts:111`
- **Fix:** Use `!== undefined` instead of `??`
- **Effort:** 10 minutes

### B-16. G-MA-M36
**Customer retention total miscalculated**
- **File:** `services/api/dashboard.ts:111-113`
- **Fix:** Include inactive/churned in total calculation
- **Effort:** 15 minutes

### B-17. G-MA-M37
**SKU validation fail-open allows duplicates**
- **File:** `services/api/products.ts:911`
- **Fix:** Return `isAvailable: false` on network error
- **Effort:** 15 minutes

### B-18. G-MA-M38
**Auth login vs register — name fallback inconsistency**
- **File:** `services/api/auth.ts:30 vs 74`
- **Fix:** Add name fallback in register path
- **Effort:** 10 minutes

### B-19. G-MA-M42
**Cashback rejection sends reason twice**
- **File:** `app/(cashback)/[id].tsx:85`
- **Fix:** Remove duplicate `rejectionReason` field
- **Effort:** 5 minutes

### B-20. G-MA-M48
**AuthContext UPDATE_MERCHANT stores extra backend fields**
- **File:** `contexts/AuthContext.tsx:244, 416`
- **Fix:** Define strict type for merchant data
- **Effort:** 1 hour

### B-21. G-MA-M49
**updateStore slug mismatch**
- **File:** `contexts/StoreContext.tsx:272-298`
- **Fix:** Ensure single source of truth for store object
- **Effort:** 30 minutes

### B-22. G-MA-M56
**Token refresh URL silent fallback on invalid env**
- **File:** `services/api/client.ts:222-228`
- **Fix:** Validate env values before parsing
- **Effort:** 15 minutes

### B-23. RZ-B-M4
**Coordinator Auto-Created with Hardcoded Gender**
- **File:** `src/routes/admin.ts:363`
- **Fix:** Use neutral coordinator designation
- **Effort:** 15 minutes

### B-24. RZ-M-B3
**Coin Amount Conversion Double-Applied Risk**
- **File:** `src/app/GiftInboxScreen.tsx:131`
- **Fix:** Use shared constant for `amountPaise / 100` conversion
- **Effort:** 15 minutes

### B-25. RZ-M-A12
**ExperienceWalletScreen Tier Ladder Uses Hardcoded Spend Amounts**
- **File:** `src/screens/ExperienceWalletScreen.tsx:90-105`
- **Fix:** Fetch tier thresholds from backend config
- **Effort:** 1 hour

### B-26. RP-M07
**Consumer App Payment Fallback Exposes Test Stripe Keys**
- **File:** `rez-app-consumer/services/paymentService.ts:93-107`
- **Fix:** Use feature flags instead of `__DEV__` fallback
- **Effort:** 30 minutes

### B-27. RP-M08
**Razorpay Signature Verification Entirely Backend-Dependent**
- **File:** `rez-app-consumer/services/razorpayService.ts:316` + `razorpayApi.ts:138`
- **Fix:** Add client-side HMAC verification using razorpay key_id
- **Effort:** 1 hour

### B-28. RP-M17
**Analytics Uses Math.random() for Internal Session IDs**
- **Files:** `AnalyticsService.ts`, `CustomProvider.ts`
- **Fix:** Use `crypto.randomUUID()`
- **Effort:** 15 minutes

### B-29. RP-M27
**Math.random() in Bill Upload Queue Service Jitter**
- **File:** `rez-app-consumer/services/billUploadQueueService.ts:724`
- **Fix:** Use `crypto.getRandomValues()` for jitter
- **Effort:** 10 minutes

### B-30. NW-MED-004
**Status string comparison may fail on case mismatch**
- **File:** `lib/hooks/useOrderPolling.ts:9`
- **Fix:** Normalize status to lowercase via Axios response interceptor
- **Effort:** 15 minutes

### B-31. NW-MED-013
**Coupon.discountValue unit ambiguous (paise vs percent)**
- **File:** `lib/api/coupons.ts:7`
- **Fix:** Use distinct types with clear unit documentation
- **Effort:** 30 minutes

### B-32. NW-MED-024
**localId() in billStore uses Date.now() — collision on same-millisecond calls**
- **File:** `lib/store/billStore.ts:31-33`
- **Fix:** Use `crypto.randomUUID()` instead
- **Effort:** 10 minutes

### B-33. NW-MED-025
**NFC data passed to payment handler without validation**
- **File:** `components/payment/NfcPayButton.tsx:14-17`
- **Fix:** Validate NFC record format before invoking handler
- **Effort:** 15 minutes

### B-34. NW-MED-026
**Offline queued orders have no TTL**
- **File:** `lib/utils/offlineQueue.ts`
- **Fix:** Add `createdAt`. Reject orders older than 24 hours
- **Effort:** 30 minutes

### B-35. RP-M10
**Path-Based Routing Ambiguity in Merchant Client**
- **File:** `rez-app-marchant/services/api/client.ts`
- **Fix:** Document routing rules. Add runtime warnings
- **Effort:** 1 hour

### B-36. RP-M15
**LoyaltyReward Uses customerPhone + storeSlug Instead of ObjectIds**
- **File:** `rezbackend/src/models/LoyaltyReward.ts:7-10`
- **Fix:** Replace with ObjectId references
- **Effort:** 2 hours

### B-37. A10-M20
**StatusTransitionMap Allows dispatched→delivered Skip**
- **File:** `app/(dashboard)/orders.tsx:61`
- **Fix:** Align with backend FSM
- **Effort:** 30 minutes

### B-38. RZ-A-M3
**Inconsistent Date Formatting Across Pages**
- **Status:** OPEN
- **Fix:** Use single date utility
- **Effort:** 1 hour

---

## Status Summary

All ~272 MEDIUM issues are OPEN unless otherwise noted. Update status as fixes are applied.

| Source | Count | Key Categories |
|--------|-------|---------------|
| Consumer 2026 | 22 | Data Sync (6), API Contracts (5), Architecture (6), UX (4), Security (2) |
| ReZ NoW | 47 | Functional (9), API (8), Real-time (5), UX (10), Security (4), Architecture (11) |
| RestoPapa Gen 14 | 30 | API (9), Architecture (9), Data (3), Security (2), Edge Cases (4), UX (3) |
| Merchant App | 62 | UX (18), Functional (10), Architecture (28), Security (1), Performance (5) |
| ReZ Admin | 20 | Security (3), Architecture (4), Error Handling (5), Functional (5), Performance (3) |
| Karma UI | 17 | Functional (4), UX (4), Type/Enum (5), Sync (3), Security (1) |
| Rendez Backend | 12 | Data (5), Functional (3), Business Logic (2), Security (2) |
| Rendez App | 32 | Functional (5), Enum (2), Business Logic (4), Real-time (4), Offline (3), Performance (3), UX (4), Security (2), Navigation (5) |
| Rendez Admin | 10 | Functional (4), Architecture (2), Business Logic (2), API (1), Data (1) |
| **TOTAL** | **~272** | |

**Last Updated:** 2026-04-16
