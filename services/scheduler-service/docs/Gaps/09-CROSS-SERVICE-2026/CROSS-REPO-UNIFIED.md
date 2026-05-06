# Cross-Repo Analysis: Complete — All Apps vs All Apps

**Date:** 2026-04-16
**Scope:** ALL 11 codebases — Gen 1 through Gen 11
**Compiled from:** 8 gap docs + 3 master plans + 6 cross-service analyses
**Total Cross-Repo Issues:** 24 families

---

## Section 1: Master Repo Interaction Matrix

### Who Calls Whom

```
                        ┌──────────────────────────────────────────────────────┐
                        │                  BACKEND SERVICES                    │
                        │  (rez-backend, rez-payment-service, rez-wallet-     │
                        │   service, rez-order-service, rez-karma-service,    │
                        │   rez-finance-service, rez-api-gateway)             │
                        └──────────────────────────┬───────────────────────────┘
                                                 │
         ┌──────────────┬──────────────┬─────────┴─────────┬──────────────┐
         │              │              │                  │              │
    ┌────▼───┐    ┌────▼───┐    ┌────▼────┐    ┌────────▼────┐  ┌─────▼────┐
    │Merchant │    │Consumer│    │  Admin  │    │   AdBazaar  │  │ Rendez   │
    │  App    │    │  App   │    │  Apps   │    │ (Next.js)   │  │   App    │
    │ Gen 10  │    │ Gen 11 │    │ Gen 1-7 │    │   Gen 10    │  │  Gen 9   │
    └────┬────┘    └────┬────┘    └────┬────┘    └────────┬────┘  └────┬────┘
         │              │              │                   │              │
         │   Merchant  │  Consumer    │    Admin          │  AdBazaar  │ Rendez
         │   POS bill  │  order pay  │    CRUD           │  QR scan   │ gift/match
         │   Orders    │  Checkout   │    Reports        │  Booking   │ wallet
         │   Wallet    │  Wallet     │    Orders        │  Webhook   │ referral
         └──────────────┴─────────────┴──────────────────┴────────────┘
```

### Cross-Repo Interaction Table

| Consumer → Backend | Merchant → Backend | Admin → Backend | AdBazaar → REZ | Rendez → REZ |
|-------------------|-------------------|----------------|----------------|-------------|
| Order creation | POS bill creation | CRUD operations | QR scan credits | Gift credits |
| Payment initiation | Order status update | Wallet operations | Booking webhooks | Match credits |
| Wallet balance | Wallet withdraw | Order management | Payment verify | Wallet top-up |
| Order history | Settlement | Analytics | Visit attribution | Referral codes |
| Profile CRUD | Product CRUD | Voucher mgmt | Purchase attribution | Plan creation |
| Karma profile | Cashback approval | Cashback stats | Earnings query | — |
| Store discovery | Store analytics | SSE stream | — | — |
| — | — | — | Supabase direct | — |

---

## Section 2: Cross-Repo Issue Master Table

Every issue that crosses a repo/service boundary, organized by severity.

### CRITICAL Cross-Repo (Must Fix Immediately)

| ID | Issue | Repo A | Repo B | Repo C | Gap IDs | Verified |
|----|-------|--------|--------|--------|---------|---------|
| **XF-A1** | OrderStatus fragmented across 7+ surfaces | Merchant Gen 10 | Consumer Gen 11 | Admin Gen 10 | G-MA-C14, G-MA-H28, G-MA-H34, NA-CRIT-08, CS-E19, CS-E5 | PARTIAL |
| **XF-A2** | PaymentStatus `'completed'` vs `'paid'` — polling never terminates | Merchant Gen 10 | Consumer Gen 11 | Backend | G-MA-H02, G-MA-H29, NA-CRIT-08, CS-E10, CS-E20 | YES |
| **XF-A3** | Wallet balance unit mismatch — ×100 inflation | Merchant Gen 10 | Backend | — | G-MA-C01, G-MA-H04, G-MA-H05, CS-T10, CR-17 | YES |
| **XF-A4** | Real-time dead — `getSocket()` doesn't exist | Merchant Gen 10 | Consumer Gen 11 | Admin Gen 10 | G-MA-C11, A10-C1 | PARTIAL |
| **XF-A5** | Offline queue non-transactional — double-charge risk | Merchant Gen 10 | Consumer Gen 11 | Backend | G-MA-C08, G-MA-C09, G-MA-C10, NA-CRIT-09, CS-M1, CR-M4 | PARTIAL |
| **XF-A6** | Biometric bypass when hardware unavailable | Merchant Gen 10 | Consumer Gen 11 | — | G-MA-C06, G-KS-C4 | PARTIAL |
| **XF-A7** | IDOR — no ownership check on order/bill access | Merchant Gen 10 | Consumer Gen 11 | — | G-MA-C05, NA-HIGH-20 | PARTIAL |
| **XF-A8** | Coin redemption end-to-end broken | Merchant Gen 10 | Backend | Consumer Gen 11 | G-MA-C02, G-MA-C03, NA-HIGH-07 | PARTIAL |
| **XF-A9** | Payment webhook race — double reward | Rendez Backend | Consumer Gen 11 | Backend | RZ-B-C2, CS-M1 | YES |
| **XF-A10** | Gift voucher auth bypass — QR enumeration | Rendez Backend | — | — | RZ-B-C1 | YES |
| **XF-A11** | `rez_user_id` spoofable via URL param | AdBazaar | REZ Backend | — | AB-C1, XF-2 | YES |
| **XF-A12** | Fire-and-forget coin credits — no retry/DLQ | AdBazaar | REZ Backend | — | AB-D1, CS-M1, CS-M2 | YES |
| **XF-A13** | No idempotency on booking creation | AdBazaar | — | — | AB-C4 | YES |
| **XF-A14** | Payment amount never verified server-side | AdBazaar | — | — | AB-C5 | YES |
| **XF-A15** | Wallet balance ×100 inflation | Merchant Gen 10 | Backend | — | G-MA-C01 | YES |
| **XF-A16** | Consumer app wallet plain AsyncStorage | Consumer Gen 11 | — | — | NA-CRIT-11 | YES |
| **XF-A17** | Bill amount client-controlled — fraud vector | Consumer Gen 11 | — | — | NA-CRIT-02 | YES |
| **XF-A18** | Hardcoded QR secret forgeable | Karma Service | — | — | G-KS-C1 | YES |

### HIGH Cross-Repo

| ID | Issue | Repo A | Repo B | Gap IDs | Verified |
|----|-------|--------|--------|---------|---------|
| **XF-B1** | CashbackStatus query missing `'approved'`, `'expired'` | Merchant Gen 10 | Backend | G-MA-H30, CS-E21 | YES |
| **XF-B2** | CoinType `'branded_coin'` vs `'branded'` | Consumer Gen 11 | Backend | XREP-12, CS-E15 | PARTIAL |
| **XF-B3** | karma credits `'rez'` but queries `'karma_points'` | Karma Service | Wallet | NA-HIGH-03, CS-E11 | YES |
| **XF-B4** | `normalizeLoyaltyTier` opposite behaviors | rez-shared | rez-shared | CS-E12 | YES |
| **XF-B5** | Consumer app KarmaProfile 14 vs canonical 20 fields | Consumer Gen 11 | Backend | XREP-08, XREP-11, CS-T8 | PARTIAL |
| **XF-B6** | Consumer app KarmaEvent divergent from canonical | Consumer Gen 11 | Backend | XREP-02, CS-T2 | PARTIAL |
| **XF-B7** | Consumer app BookingStatus 4 vs canonical 9 | Consumer Gen 11 | Backend | XREP-15, CS-E16 | PARTIAL |
| **XF-B8** | AddressType SCREAMING_CASE vs lowercase | Consumer Gen 11 | Backend | XREP-10, CS-E14 | PARTIAL |
| **XF-B9** | WebOrderStatus 6 values vs canonical 15 | rez-now | Backend | CS-E9 | PARTIAL |
| **XF-B10** | Consumer app double-tap no guard | Consumer Gen 11 | — | NA-CRIT-07 | YES |
| **XF-B11** | Rewards preview formula up to 50% inaccurate | Consumer Gen 11 | Backend | NA-HIGH-02 | PARTIAL |
| **XF-B12** | Visit milestone dedup key 1-second collision | Consumer Gen 11 | Backend | NA-HIGH-05 | PARTIAL |
| **XF-B13** | Rewards hook idempotency silent drop | Consumer Gen 11 | Backend | NA-HIGH-06 | PARTIAL |
| **XF-B14** | Merchant Order type mismatch (2 interfaces) | Merchant Gen 10 | Backend | G-MA-H22, CS-T11 | YES |
| **XF-B15** | Merchant CashbackRequest defined 3x | Merchant Gen 10 | — | G-MA-H36, CS-T12 | YES |
| **XF-B16** | Merchant Product type defined 3x | Merchant Gen 10 | — | G-MA-H37, CS-T13 | YES |
| **XF-B17** | Merchant PaymentStatus 3 definitions | Merchant Gen 10 | — | G-MA-H37, CS-T13 | YES |
| **XF-B18** | Merchant no withdrawal amount validation | Merchant Gen 10 | Backend | G-MA-H01 | YES |
| **XF-B19** | Merchant withdrawal zero-padding bypass | Merchant Gen 10 | Backend | G-MA-H08 | YES |
| **XF-B20** | Merchant SKU validation fail-open | Merchant Gen 10 | Backend | G-MA-H10 | YES |
| **XF-B21** | Socket subscriptions not restored on reconnect | Merchant Gen 10 | — | G-MA-H14 | YES |
| **XF-B22** | Socket gives up after 5 reconnects | Merchant Gen 10 | — | G-MA-H15 | YES |
| **XF-B23** | Dead letter queue unbounded | Merchant Gen 10 | — | G-MA-H17 | YES |
| **XF-B24** | PaymentMachine in-memory double credit | Admin Gen 10 | Backend | A10-C4, CS-M1 | PARTIAL |
| **XF-B25** | HMAC key from env var NAME not value | Admin Gen 10 | Backend | A10-C5, RZ-B-C3 | YES |
| **XF-B26** | SSE stream no merchant ownership check | Admin Gen 10 | Backend | A10-C6 | YES |
| **XF-B27** | All API calls missing Authorization header | Rendez Admin | Backend | RZ-A-C1 | YES |
| **XF-B28** | No Next.js middleware | Rendez Admin | — | RZ-A-C2 | YES |
| **XF-B29** | Referral code stored but never consumed | Rendez App | Backend | RZ-M-S1 | YES |
| **XF-B30** | Gift inbox never refreshes | Rendez App | — | RZ-M-F1 | YES |
| **XF-B31** | Like stale closure | Rendez App | — | RZ-M-F3 | YES |
| **XF-B32** | Photo deletion local-only | Rendez App | — | RZ-M-F4 | YES |
| **XF-B33** | Wallet balance ×100 inflation | Merchant Gen 10 | Backend | G-MA-C01 | YES |

---

## Section 3: Same Bug, Multiple Repos

These patterns appear identically across 2 or more codebases — fix once, fix everywhere.

### Pattern 1: Payment Status `'completed'` Instead of `'paid'`

| Codebase | File | Line | Uses |
|----------|------|------|------|
| Merchant Gen 10 | `app/(dashboard)/payments.tsx` | 21 | `StatusFilter = 'completed'` |
| Merchant Gen 10 | `utils/paymentValidation.ts` | 33 | `'completed'` in whitelist |
| Consumer Gen 11 | `services/paymentService.ts` | 243 | `status === 'completed'` |
| Admin Gen 10 | `types/api.ts` | — | In multiple places |
| rez-now | `lib/api/scanPayment.ts` | 49 | `'completed'` in enum |

**Single fix:** Create `shared/constants/paymentStatus.ts` with canonical values. Import everywhere.

---

### Pattern 2: Order Status `'pending'` Instead of `'placed'`

| Codebase | File | Line | Issue |
|----------|------|------|-------|
| Merchant Gen 10 | `hooks/useOrdersDashboard.ts` | 222 | `'pending'` never matches, tab always 0 |
| Merchant Gen 10 | `app/orders/live.tsx` | — | Uses `'pending'` in status list |
| Merchant Gen 10 | `app/(dashboard)/aggregator-orders.tsx` | — | Uses `'pending'` and `'accepted'` |
| Consumer Gen 11 | Multiple screens | — | Uses `'completed'` not `'delivered'` |
| Admin Gen 10 | Multiple screens | — | Inconsistent |

**Single fix:** Create `shared/constants/orderStatus.ts` with canonical values. Import everywhere.

---

### Pattern 3: `Math.random()` for ID Generation

| Codebase | File | Line | Used For |
|----------|------|------|---------|
| Consumer Gen 11 | `services/offlineSyncService.ts` | 436 | Offline action ID |
| Merchant Gen 10 | `services/offlinePOSQueue.ts` | — | `clientTxnId` |
| AdBazaar | Multiple | — | ID generation |

**Single fix:** Use `uuid` or `crypto.randomUUID()` everywhere. Add `no-math-random-for-ids.sh` arch fitness test.

---

### Pattern 4: Biometric Bypass on Unavailable

| Codebase | File | Issue |
|----------|------|-------|
| Merchant Gen 10 | `utils/biometric.ts:52` | `success: true` when unavailable |
| Karma Service | `verificationEngine.ts` | Similar pattern possible |

**Single fix:** Return `success: false` with `BIOMETRIC_UNAVAILABLE` reason. Require PIN/password fallback.

---

### Pattern 5: IDOR — No Ownership Check

| Codebase | File | Issue |
|----------|------|-------|
| Merchant Gen 10 | `app/(dashboard)/orders/[id].tsx:117` | No store ownership |
| Consumer Gen 11 | `services/billVerificationService.ts` | No user ownership |
| Consumer Gen 11 | `services/walletApi.ts` | No user ownership |

**Single fix:** Backend must enforce ownership on all resource-access endpoints. Client should attach storeId/userId.

---

### Pattern 6: Fire-and-Forget Financial Operations

| Codebase | File | Issue |
|----------|------|-------|
| Merchant Gen 10 | `contexts/SocketContext.tsx` | Queued events lost on crash |
| Merchant Gen 10 | `services/offlinePOSQueue.ts` | Silent drop after retries |
| Consumer Gen 11 | Multiple services | Silent error swallowing |
| AdBazaar | All notification insertion | No retry, no DLQ |
| Admin Gen 10 | Multiple API calls | Silent failure |

**Single fix:** Create shared `offlineQueue` utility with: retry, DLQ, user notification, AsyncStorage persistence.

---

### Pattern 7: Offline Queue Non-Transactional

| Codebase | File | Issue |
|----------|------|-------|
| Merchant Gen 10 | `services/offlinePOSQueue.ts:58` | Idempotency key after INSERT |
| Merchant Gen 10 | `services/offlinePOSQueue.ts:232` | Batch sync no atomicity |
| Consumer Gen 11 | `services/offlineSyncService.ts` | Unknown — needs audit |

**Single fix:** Create shared `offlineQueue` utility with pre-INSERT idempotency key generation.

---

## Section 4: Backend Canonical Contracts

These are the authoritative types/enums that all frontends MUST use.

### OrderStatus (Canonical)

```
placed → confirmed → preparing → ready → out_for_delivery → delivered
                ↘ cancelled
                ↘ cancelling → cancelled
                ↘ refunded
```

All frontends must import from `shared/constants/orderStatus.ts`. No local definitions.

### PaymentStatus (Canonical)

```
pending → awaiting_payment → processing → authorized → paid
      ↘ failed
      ↘ refunded
      ↘ partially_refunded
      ↘ expired
```

All frontends must import from `shared/constants/paymentStatus.ts`. No local definitions.

### CashbackStatus (Canonical)

```
pending → approved → paid
      ↘ rejected → paid
      ↘ expired
```

### CoinType (Canonical)

```
rez | prive | promo | branded | cashback | referral
```

**Do NOT use:** `branded_coin`, `karma_points`, `coin`.

---

## Section 5: Root Causes — Why the Same Bugs Appear Everywhere

| Root Cause | Pattern | Repos Affected | Prevention |
|-----------|---------|---------------|------------|
| RC-1: No canonical source | Same enum defined 3-7× with different values | ALL 11 | Shared constants package + arch fitness test |
| RC-2: Frontend computes backend logic | Coins, cashback, validation all client-side | ALL 11 | Server-side computation + arch fitness test |
| RC-3: Fire-and-forget for money ops | No retry, no DLQ, no atomicity | 8+ repos | Shared offline queue utility + arch fitness test |
| RC-4: No TypeScript contract at boundary | `get<any>()` everywhere | ALL 11 | Zod at API boundaries + arch fitness test |
| RC-5: Real-time bypasses server-state | Socket events don't invalidate cache | Merchant, Consumer, Admin | Socket → TanStack Query invalidation hook |
| RC-6: Non-atomic multi-step operations | Idempotency after INSERT | Merchant, Consumer | Shared offline queue utility |
| RC-7: Redis as only source of truth | State lost when Redis down | Backend services | DB as source of truth, Redis as cache |
| RC-8: Offline-first without transaction safety | Double-charge on crash | Merchant, Consumer | Shared offline queue utility |
| RC-9: No shared auth infrastructure | Each app has different token patterns | ALL 11 | Shared auth store + token refresh flow |
| RC-10: No unit annotation on monetary fields | paise vs rupees ambiguity | Merchant, Consumer | TypeScript unit types + arch fitness test |

---

## Section 6: Cross-Repo Fix Priority

### CRITICAL — Fix This Week

| Priority | Fix | Effort | Repos Fixed |
|---------|-----|--------|-------------|
| 1 | Create `shared/constants/orderStatus.ts` — canonical enum | 2h | 7+ surfaces |
| 2 | Create `shared/constants/paymentStatus.ts` — canonical enum | 1h | 5+ surfaces |
| 3 | Fix PaymentStatus `'completed'` → `'paid'` in ALL consumers | 1h | 4 surfaces |
| 4 | Fix OrderStatus `'pending'` → `'placed'` in merchant app | 1h | 3 locations |
| 5 | Add `getSocket()` + `queueEvent()` to SocketService | 2h | Merchant, Consumer |
| 6 | Persist socket queue to AsyncStorage | 1h | Merchant, Consumer |
| 7 | Pre-INSERT idempotency key generation | 2h | Merchant, Consumer |
| 8 | Fix offline queue path prefixes → `merchant/*` | 1h | Merchant |
| 9 | Remove `* 100` from wallet balance display | 30m | Merchant |
| 10 | Add `BIOMETRIC_UNAVAILABLE` check in all apps | 1h | Merchant, Karma |

### HIGH — Fix This Sprint

| Priority | Fix | Effort | Repos Fixed |
|---------|-----|--------|-------------|
| 11 | Create `shared/offlineQueue` utility | 4h | Merchant, Consumer |
| 12 | Fix batch sync → per-bill ACK | 2h | Merchant |
| 13 | Add DLQ with user notification for failed offline bills | 2h | Merchant |
| 14 | Fix withdrawal amount validation (NaN, Infinity, bounds) | 1h | Merchant |
| 15 | Import `WalletBalance` canonical type — remove local | 1h | Merchant, Consumer, rez-now |
| 16 | Fix `normalizeLoyaltyTier` conflict in rez-shared | 1h | All consumers of shared |
| 17 | Align karma coinType `'rez'` vs `'karma_points'` | 30m | Karma → Wallet |
| 18 | Add `storeId` to all order API calls | 1h | Merchant |
| 19 | Cache invalidation after offline sync | 1h | Merchant |
| 20 | Wire referral code from deep link to profile creation | 1h | Rendez |

### MEDIUM — Fix This Quarter

| Priority | Fix | Effort | Repos Fixed |
|---------|-----|--------|-------------|
| 21 | Create `shared/coinCalculation` service | 3h | Consumer, Merchant |
| 22 | Fix PaymentStatus color map — add all 11 states | 2h | All surfaces |
| 23 | Fix OrderStatus color map — add all statuses | 2h | All surfaces |
| 24 | Add `BIOMETRIC_UNAVAILABLE` fallback to PIN | 1h | Consumer |
| 25 | Replace `Math.random()` with `uuid` in all offline code | 1h | Merchant, Consumer |
| 26 | Import `KarmaProfile` and `KarmaEvent` from canonical | 2h | Consumer |
| 27 | Import `CoinType`, `AddressType` from canonical | 1h | Consumer |
| 28 | Fix `normalizePaymentStatus` consumption — exists but unused | 1h | All surfaces |
| 29 | Add unit annotation (`// in rupees` / `// in paise`) to all monetary fields | 2h | All surfaces |
| 30 | Consumer app: Replace `showToast` import | 5m | Consumer |

---

## Section 7: What's Confirmed vs What's Partially Verified

### Confirmed (Exact file:line references, code snippets verified)

Issues where the gap doc provides exact file:line references with code snippets:

- G-MA-C01: `formatRupees(walletData.balance.available * 100)` — app/payouts/index.tsx:276
- G-MA-C05: `ordersService.getOrderById(id)` no storeId — app/(dashboard)/orders/[id].tsx:117
- G-MA-C06: `requireBiometric()` returns `success: true` on unavailable — utils/biometric.ts:52
- G-MA-C08: `clientTxnId` after INSERT — services/offlinePOSQueue.ts:58-80
- G-MA-C11: `getSocket()` doesn't exist — contexts/SocketContext.tsx:112
- G-MA-C12: Wrong API paths — services/offline.ts:332-387
- G-MA-C14: `'pending'` never in OrderStatus — hooks/useOrdersDashboard.ts:222
- G-MA-H01: No withdrawal validation — services/api/wallet.ts:137
- G-MA-H02: `'completed'` in StatusFilter — app/(dashboard)/payments.tsx:21
- G-MA-H17: DLQ unbounded — services/offline.ts:42
- G-MA-H22: Order type mismatch — services/api/orders.ts:240
- NA-CRIT-02: Client-controlled amount — billVerificationService.ts
- NA-CRIT-03: `new Blob()` in React Native — cacheService.ts:216
- NA-CRIT-04: `@/types/unified` doesn't exist — 7 import sites
- NA-CRIT-06: `showToast` never imported — checkout.tsx
- NA-CRIT-08: `'completed'` in polling — paymentService.ts:243
- NA-CRIT-09: `Math.random()` for IDs — offlineSyncService.ts:436
- NA-HIGH-03: karma credits 'rez' queries 'karma_points' — walletIntegration.ts:115-134
- NA-HIGH-05: 1-second dedup collision — walletService.ts
- CS-E12: normalizeLoyaltyTier opposite — coins.ts:139 vs enums.ts:20
- CS-T6: WalletBalance 3 shapes — 3 files
- CS-T7: rez-now zero shared imports — package.json
- RZ-A-C1: All API calls missing auth — 9 pages
- RZ-B-C1: Gift voucher auth bypass — gift.ts:80
- RZ-B-C2: Payment webhook race — webhooks/rez.ts:49
- AB-C1: `rez_user_id` spoofable — qr/scan/[slug]/route.ts:72
- AB-C4: No idempotency on booking — bookings/route.ts:102
- AB-C5: Payment amount not verified — verify-payment/route.ts:76
- G-KS-C1: Hardcoded QR secret — verificationEngine.ts:176
- G-KS-C2: Auth no validation — auth.ts:41
- G-KS-C3: jwtSecret unvalidated — config/index.ts:22
- G-KS-C4: Privilege escalation — karmaRoutes.ts:29
- G-KS-C5: Batch stats unauthenticated — batchRoutes.ts:220
- G-KS-C6: TimingSafeEqual throws — verificationEngine.ts:183
- G-KS-C7: Idempotency key collision — earnRecordService.ts:204

### Partially Verified (Pattern confirmed, needs file:line)

Issues where the pattern is confirmed to exist but exact file:line references need verification:

- Consumer app offline queue issues — needs audit of `services/offlineSyncService.ts`
- All consumer app OrderStatus issues — needs full code scan
- All consumer app PaymentStatus issues beyond NA-CRIT-08
- Admin app all PaymentStatus issues — needs full code scan
- Backend canonical OrderStatus FSM — needs verification of actual values
- Backend PaymentStatus FSM — needs verification
- Backend canonical CashbackStatus FSM — needs verification
- All Gen 1-7 consumer/merchant/admin cross-repo issues

---

**Last Updated:** 2026-04-16
**Compiled from:** 08-CROSS-SERVICE/MERCHANT-APP-CROSS-REF.md, 09-CROSS-SERVICE-2026/ENUM-FRAGMENTATION.md, 09-CROSS-SERVICE-2026/TYPE-DRIFT.md, 09-CROSS-SERVICE-2026/MONEY-ATOMICITY.md, 06-MERCHANT-APP/CRITICAL.md, 06-MERCHANT-APP/HIGH.md, 06-CONSUMER-AUDIT-2026/01-CRITICAL.md, 06-CONSUMER-AUDIT-2026/02-HIGH.md, 09-CROSS-SERVICE-2026/CROSS-REPO-ANALYSIS.md
