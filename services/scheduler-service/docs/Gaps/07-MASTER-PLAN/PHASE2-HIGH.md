# PHASE 2 — HIGH Issues (ALL Codebases)

**Scope:** Every HIGH issue across all 9 codebases
**Target:** All HIGH issues closed before sprint end
**Timeline:** Weeks 4–6

---

## Rendez App (Gen 9)

| ID | Issue | File | Fix |
|----|-------|------|-----|
| RZ-M-P1 | No balance check before gift | `GiftPickerScreen.tsx:45` | Fetch balance first |
| RZ-M-F2 | Gift send no wallet invalidation | `GiftPickerScreen.tsx:47` | Add invalidation |
| RZ-M-F5 | Modal dismisses before mutation | `GiftPickerScreen.tsx:57` | Move setConfirmVisible |
| RZ-M-D1 | Query key mismatch (dup RZ-M-F1) | `GiftInboxScreen.tsx:35` | Same as RZ-M-F1 |
| RZ-M-B1 | Age NaN sent to backend | `ProfileSetupScreen.tsx:49` | Validate before submit |
| RZ-M-A2 | Experience credit invalidation | `CreatePlanScreen.tsx:128` | Fix cache keys |
| RZ-M-E2 | Age input non-numeric paste | `ProfileSetupScreen.tsx:89` | Numeric-only filter |
| RZ-M-X1 | deletePhoto never called | `api.ts:102` | Wire to ProfileEditScreen |
| RZ-A-H7 | Every fetch silent failure | All pages | Add `response.ok` checks |
| RZ-A-H5 | No user pagination | `users/page.tsx` | Add cursor pagination |
| RZ-A-H2 | Frontend/backend KPI mismatch | `meetups/page.tsx:60` | Align on same metric |
| RZ-A-H1 | applicantCount undefined | `plans/page.tsx:22` | Use `_count.applications` |
| RZ-B-H1 | HMAC recomputed inline | `experienceCredits.ts:35` | Use cached constant |
| RZ-B-H2 | 7 plan routes no ID validation | `plans.ts:72` | Add `isValidId()` |
| RZ-B-H5 | Gift expired always success | `webhooks/rez.ts:34` | Return 404 on miss |
| RZ-B-H6 | REZ API after DB commit | `GiftService.ts:133` | Two-phase commit |
| RZ-B-H7 | Unnecessary type cast | `auth.ts:62` | Remove cast |

---

## Karma Service (Gen 8)

| ID | Issue | File |
|----|-------|------|
| G-KS-C7 | Idempotency key collision | `earnRecordService.ts:204` |
| G-KS-C8 | String vs ObjectId bypass | `verifyRoutes.ts:207` |
| G-KS-C9 | Admin role case-sensitive | `adminAuth.ts:15` |

---

## Karma UI (Gen 8)

| ID | Issue | File |
|----|-------|------|
| G-KU-H1 | KarmaProfile divergence | `karmaService.ts` |
| G-KU-H2 | CoinType three-way mismatch | Multiple |
| G-KU-H3 | No rapid-scan debounce | Scan screen |
| G-KU-H4 | eventId stale on navigation | Multiple screens |
| G-KU-H5 | Wallet balance check missing | Gift send flow |
| G-KU-H6 | Profile type incomplete | `karmaService.ts` |
| G-KU-H7 | QR code not rendered | Voucher screen |

---

## ReZ Gen 1–7 (Backend, Consumer, Merchant, Admin)

See individual bug files for full HIGH listings. Top priorities:

### Backend

| ID | Issue | Impact |
|----|-------|--------|
| H14 | `walletCredited` flag never set | No audit trail |
| H15 | Reconciliation marks paid but never credits | User loses coins |
| H16 | Coin deduction not atomic | No compensation on crash |
| H17 | Instant reward uses `Date.now()` | Double coins on retry |
| CS-H1 | Achievement endpoint shows `total_coins: 0` | Wrong balance displayed |
| CS-H3 | Order routes unauthenticated | Full order history readable |
| CS-H5 | Merchant settlement only invalidates cache | Merchant gets ₹0 |

### Consumer App

| ID | Issue | Impact |
|----|-------|--------|
| FE-H1 | Purchase order wizard not implemented | Feature non-functional |
| FE-H2 | Export buttons are no-ops | Export does nothing |
| FE-H3 | Reports use hardcoded multipliers | Fake financial data |
| TS-H1 | Non-null `!` on async state | Runtime crash |
| TS-H2 | Missing optional chaining | Crash on API failure |
| TS-H3 | `.map()` on nullable arrays | Crash on empty |

### Merchant App (Gen 1–7)

| ID | Issue | Impact |
|----|-------|--------|
| MA-AUT-001 | Team member name stored as undefined | Blank names |
| MA-API-001 | API base URL construction inconsistent | App fails on deploy |

---

## ReZ Merchant App — Gen 10 (2026-04-16)

### Financial

| ID | Issue | File | Fix |
|----|-------|------|-----|
| G-MA-H01 | No withdrawal validation | `services/api/wallet.ts:137` | Validate amount, NaN, Infinity |
| G-MA-H02 | Payment filter sends 'completed' not 'paid' | `app/(dashboard)/payments.tsx:46` | Fix StatusFilter type |
| G-MA-H03 | Cashback approval no upper bound | `app/(cashback)/[id].tsx:54` | Check against requestedAmount |
| G-MA-H04 | Inconsistent withdrawal unit paise/rupees | `wallet.ts` vs `payouts/index.tsx:241` | Normalize to paise throughout |
| G-MA-H05 | Wallet balance unit unclear across services | `services/api/coins.ts:188` | Add unit annotation |
| G-MA-H06 | Discount % not capped at 100 | `services/api/pos.ts:210` | Validate before apply |
| G-MA-H07 | Coin award no integer check | `app/(dashboard)/coins.tsx:156` | Check Number.isInteger |
| G-MA-H08 | Withdrawal zero-padding bypass | `app/(dashboard)/wallet.tsx:501` | Check minWithdrawalAmount |
| G-MA-H09 | isNaN fails on Infinity | `utils/paymentValidation.ts:96` | Use Number.isFinite |
| G-MA-H10 | SKU validation fail-open | `services/api/products.ts:911` | Return error on network failure |
| G-MA-H11 | Offline sync timeout ignored | `services/offline.ts:255` | Use AbortSignal.timeout |

### Data Sync & Real-Time

| ID | Issue | File |
|----|-------|------|
| G-MA-H12 | Ping interval accumulates on reconnect | `services/api/socket.ts:597` |
| G-MA-H13 | 'reconnecting' state never shown in UI | `services/api/socket.ts:162` |
| G-MA-H14 | Socket subscriptions not restored | `services/api/socket.ts:153` |
| G-MA-H15 | Socket gives up after 5 reconnects | `services/api/socket.ts:66` |
| G-MA-H16 | No duplicate detection in offline queue | `services/offline.ts:124` |
| G-MA-H17 | Dead letter queue unbounded | `services/offline.ts:42` |
| G-MA-H18 | refreshPermissions flag never resets on logout | `contexts/AuthContext.tsx:177` |
| G-MA-H19 | joinMerchantDashboard silent errors | `services/api/socket.ts:134` |
| G-MA-H20 | Buffering flag not cleared on reconnect | `services/api/orderQueue.ts:35` |
| G-MA-H21 | Sync triggered without internet reachability | `hooks/useNetworkStatus.ts:139` |

### API Contract

| ID | Issue | File |
|----|-------|------|
| G-MA-H22 | Order type mismatch (2 incompatible Order interfaces) | `services/api/orders.ts:240` |
| G-MA-H23 | updateProfile name mapping — user.name undefined | `services/api/auth.ts:183` |
| G-MA-H24 | socialMediaService wrong response path | `services/api/socialMedia.ts:105` |
| G-MA-H25 | Export/import bypass apiClient | `services/api/products.ts:375` |
| G-MA-H26 | getVisitStats throws instead of fallback | `services/api/storeVisits.ts:79` |
| G-MA-H27 | storeId query param never sent | `services/api/orders.ts:104` |

### Business Logic & Enum

| ID | Issue | File |
|----|-------|------|
| G-MA-H28 | OrderStatus duplicated 7x with different values | Multiple |
| G-MA-H29 | PaymentStatus wrong whitelist | `utils/paymentValidation.ts:33` |
| G-MA-H30 | CashbackStatus filter missing 'approved', 'expired' | `hooks/queries/useCashback.ts:23` |
| G-MA-H31 | Client-side FSM not synced with backend | `services/api/orders.ts:44` |
| G-MA-H32 | OrderFilters defined 3x | `types/api.ts:485` |
| G-MA-H33 | 'viewer' role in Zod but not MerchantRole | `utils/validation/schemas.ts:269` |
| G-MA-H34 | Analytics fallback uses wrong status keys | `services/api/orders.ts:306` |
| G-MA-H35 | Status normalization 7x locations | Multiple |
| G-MA-H36 | CashbackRequest defined 3x | Multiple |
| G-MA-H37 | Product type defined 3x | Multiple |
| G-MA-H38 | PaymentStatus 3 definitions | Multiple |

---

## Prevention Infrastructure Built in Phase 2

1. Query key factory in `src/utils/queryKeys.ts` (all apps)
2. TanStack Query retry configuration (all apps)
3. Socket.IO reconnection hook in `src/hooks/useRealtime.ts`
4. Zod validation at all API boundaries
5. Redis-as-cache pattern (not source of truth)
