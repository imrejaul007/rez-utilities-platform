# Phase 1: All CRITICAL Gaps — All Codebases

**Scope:** ALL CRITICAL issues across Gen 1–16
**Target:** Fix all 167 CRITICAL issues within 2 weeks
**Order:** Cross-service first, then per-codebase

---

## Cross-Service CRITICAL (Fix First — 11 issues)

| ID | Title | File | Codebase | Est. | Status |
|----|-------|------|----------|------|--------|
| CS-S1 | HMAC key from env var NAME not value | internalAuth.ts | order-service | 1h | |
| CS-S2 | JWT verify without algorithm whitelist | authMiddleware.ts | gateway | 1h | |
| CS-S3 | Redis fail-open outside production | httpServer.ts | order-service | 2h | |
| CS-S4 | SSE stream no merchant ownership check | httpServer.ts:473-533 | order-service | 2h | |
| CS-S6 | CSRF timing attack fix | csrf middleware | backend | 1h | ✅ FIXED |
| CS-M1 | PaymentMachine in-memory double credit | paymentRoutes.ts | payment-service | 4h | |
| CS-E1 | Three competing normalizeOrderStatus | 3 files | all surfaces | 4h | |
| CS-T1 | KarmaProfile missing 14 canonical fields | karmaService.ts | consumer | 3h | |
| CS-A1 | VoucherBrand defined 3 times (runtime crash) | vouchers.ts + cashStore.ts | admin | 3h | |
| CS-S12 | Shared package exports don't match dist/ | package.json | shared | 1h | |
| CS-M4 | Wallet mutation idempotency missing | wallet-service | wallet | 2h | |
| CS-A3 | Finance rewards hook wired to non-existent routes | finance-service | finance | 2h | | |

---

## AdBazaar CRITICAL (9 issues, ~10h)

| ID | Title | File | Est. | Status |
|----|-------|------|------|--------|
| AB-C1 | `rez_user_id` spoofable via URL query param | qr/scan/[slug]/route.ts:72 | 1h | ✅ FIXED |
| AB-C2 | No rate limiting on public endpoints | All API routes | 2h | ✅ FIXED |
| AB-C3 | Full bank account numbers + IFSC exposed | profile/route.ts:26 | 1h | ✅ FIXED |
| AB-C4 | No idempotency key on booking creation | bookings/route.ts:102 | 1h | ✅ FIXED |
| AB-C5 | Payment amount never verified server-side | verify-payment/route.ts:76 | 1h | ✅ FIXED |
| AB-B1 | Visit bonus coins promised in UI but never credited | scan page components | 1h | ✅ FIXED |
| AB-B2 | `purchase_bonus_pct` hardcoded to 5 | bookings/route.ts:139 | 1h | ✅ FIXED |
| AB-P1 | Messages table `body` vs API `content` | messages/route.ts:90 | 1h | ✅ FIXED |
| AB-D1 | No real-time sync — fire-and-forget | All notification points | 1h | PARTIAL |

---

## Rendez CRITICAL (12 issues, ~12h)

### Backend (3)
| ID | Title | File | Est. | Status |
|----|-------|------|------|--------|
| RZ-B-C1 | Gift voucher leaks QR via ID enumeration | gift.ts:80 | 1h | |
| RZ-B-C2 | Payment webhook race — double reward issuance | webhooks/rez.ts:49 | 2h | |
| RZ-B-C3 | Query params cast to `any` bypasses enum | wallet.ts:32 | 1h | |

### Admin (4)
| ID | Title | File | Est. | Status |
|----|-------|------|------|--------|
| RZ-A-C1 | ALL API calls missing Authorization header | 9 pages | 2h | |
| RZ-A-C2 | No Next.js middleware — routes publicly accessible | No middleware.ts | 2h | |
| RZ-A-C3 | API URL mismatch dashboard vs other pages | dashboard/page.tsx:109 | 1h | |
| RZ-A-C4 | System health is hardcoded fake data | dashboard/page.tsx:220 | 1h | |

### App (5)
| ID | Title | File | Est. | Status |
|----|-------|------|------|--------|
| RZ-M-F1 | Gift inbox query key invalidation wrong | GiftInboxScreen.tsx:48 | 1h | |
| RZ-M-F3 | Like mutation uses stale closure | DiscoverScreen.tsx:302 | 1h | |
| RZ-M-F4 | Photo removal local-only, never synced | ProfileEditScreen.tsx:129 | 1h | |
| RZ-M-S1 | Referral code stored but never consumed | useDeepLink.ts:130 | 1h | |
| RZ-M-E1 | `profile.name[0]` crashes on empty profile | ProfileDetailScreen.tsx:191 | 1h | |

---

## Karma Service CRITICAL (16 issues, ~24h)

| ID | Title | File | Est. | Status |
|----|-------|------|------|--------|
| G-KS-C1 | Hardcoded default QR secret — forgeable | verificationEngine.ts:176 | 1h | |
| G-KS-C2 | Auth middleware trusts response without validation | auth.ts:41 | 2h | |
| G-KS-C3 | jwtSecret unvalidated at startup | config/index.ts:22 | 1h | |
| G-KS-C4 | Horizontal privilege escalation on profile routes | karmaRoutes.ts:29 | 2h | |
| G-KS-C5 | Batch stats endpoint unauthenticated | batchRoutes.ts:220 | 1h | |
| G-KS-C6 | TimingSafeEqual throws on length mismatch | verificationEngine.ts:183 | 1h | |
| G-KS-C7 | Idempotency key collision — duplicate EarnRecords | earnRecordService.ts:82 | 2h | |
| G-KS-C8 | String vs ObjectId ownership check bypass | verifyRoutes.ts:207 | 1h | |
| G-KS-C9 | Karma-to-coin conversion completely broken — wrong endpoint + no auth header | walletIntegration.ts:116 | 2h | |
| G-KS-C10 | EarnRecord schema vs canonical type — zero shared field names | EarnRecord.ts | 3h | |
| G-KS-C14 | No auth on getEarnRecord — any user can read any record | earnRecordService.ts:151 | 1h | |
| G-KS-C19 | Missing await on detectFraudAnomalies — unhandled promise | verifyRoutes.ts:217 | 1h | |
| G-KS-C20 | requireAdmin referenced but not imported — module load crash | batchRoutes.ts:220 | 1h | |
| G-KS-C21 | Stub routes shadow all karma endpoints — feature non-functional | routes/index.ts:13-15 | 1h | |
| G-KS-C22 | 5 consumer API calls hit unimplemented endpoints | karmaRoutes.ts | 8h | |
| G-KS-C23 | KarmaEvent type has 30+ consumer fields with zero backend coverage | types/index.ts | 3h | |

---

## Karma UI CRITICAL (7 issues, ~10h)

| ID | Title | File | Est. | Status |
|----|-------|------|------|--------|
| G-KU-C1 | `event.totalHours` not in type — runtime crash | event/[id].tsx:350 | 2h | |
| G-KU-C2 | Fragile check-in logic — string vs boolean | event/[id].tsx:176 | 1h | |
| G-KU-C3 | KarmaEvent type completely divergent from canonical | karmaService.ts:43 | 2h | |
| G-KU-C4 | `booking.karmaEarned` does not exist — always renders hidden | event/[id].tsx:428 | 1h | |
| G-KU-C5 | `confidenceScore * 100` produces NaN with null backend data | event/[id].tsx:426 | 1h | |
| G-KU-C6 | Camera QR path not guarded when `activeEventId` is null | scan.tsx:78 | 1h | |
| G-KU-C7 | `ngoApproved` triple-state rendered as two-state | event/[id].tsx:414 | 2h | |

---

## ReZ Consumer App Gen 11 CRITICAL (11 issues, ~20h)

Full details: [`06-CONSUMER-AUDIT-2026/01-CRITICAL.md`](../06-CONSUMER-AUDIT-2026/01-CRITICAL.md)

| ID | Gap | Title | File | Est. | Status |
|----|-----|-------|------|------|--------|
| C11-C1 | NA-CRIT-01 | Payment method cards — zero onPress handlers | `app/payment.tsx`, `app/payment-methods.tsx` | 2h | ACTIVE |
| C11-C2 | NA-CRIT-02 | Bill amount client-controlled — fraud vector | `services/billVerificationService.ts` | 4h | ACTIVE |
| C11-C3 | NA-CRIT-03 | `new Blob()` crashes on iOS/Android | `services/cacheService.ts:216,362,765` | 30m | ACTIVE |
| C11-C4 | NA-CRIT-04 | `@/types/unified` doesn't exist — build fails | `ordersApi.ts` + 6 others | 4h | ACTIVE |
| C11-C5 | NA-CRIT-05 | QR check-in has zero QR scanning code | `app/qr-checkin.tsx` | 8h | ACTIVE |
| C11-C6 | NA-CRIT-06 | `showToast` called but never imported | `app/checkout.tsx` | 5m | ACTIVE |
| C11-C7 | NA-CRIT-07 | Double-tap on payment submit — no guard | `bill-upload-enhanced.tsx:387`, `useCheckoutUI.ts:349` | 30m | ACTIVE |
| C11-C8 | NA-CRIT-08 | Payment polling checks 'completed' not 'paid' | `services/paymentService.ts:243` | 30m | ACTIVE |
| C11-C9 | NA-CRIT-09 | `Math.random()` for ID generation | `services/offlineSyncService.ts:436` | 10m | ACTIVE |
| C11-C10 | NA-CRIT-10 | UPI payment silently does nothing | `app/pay-in-store/payment.tsx:210` | 2h | ACTIVE |
| C11-C11 | NA-CRIT-11 | Wallet balance in plain AsyncStorage | `stores/walletStore.ts:51` | 2h | ACTIVE |

---

## Vesper App CRITICAL (3 issues, ~2h)

| ID | Title | File | Est. | Status |
|----|-------|------|------|--------|
| VS-C1 | `jwt.verify()` without `algorithms` — algorithm confusion | `server/src/utils/jwt.ts:48,59,78` | 10m | |
| VS-C2 | OrderStatus enum incompatible with REZ canonical | `server/src/types/index.ts:12` | 2h | |
| VS-C3 | PaymentStatus enum incompatible with REZ canonical | `server/src/types/index.ts:17` | 1h | |

---

## Cross-Service JWT Verify Without Algorithms (5 locations — CRITICAL)

| ID | Title | File | Est. | Status |
|----|-------|------|------|--------|
| CS-S2-A | `jwt.verify()` no algorithms — vesper-app | `server/src/utils/jwt.ts:48,59,78` | 10m | |
| CS-S2-B | `jwt.verify()` no algorithms — finance service | `rez-finance-service/src/middleware/auth.ts:37` | 10m | |
| CS-S2-C | `jwt.verify()` no algorithms — scheduler service | `rez-scheduler-service/src/middleware/auth.ts:36` | 10m | |

> **Pattern:** All `jwt.verify()` calls must include `{ algorithms: ['HS256'] }` to prevent algorithm confusion attacks (CVE-2015-9235). Without this, an attacker can forge tokens with `alg: 'none'`.

---

## ReZ Admin App Gen 10 CRITICAL (8 issues, ~15h)

| ID | Title | File | Est. | Status |
|----|-------|------|------|--------|
| A10-C1 | Socket events don't invalidate React Query cache | services/socket.ts:148 | 2h | |
| A10-C2 | Three competing VoucherBrand type definitions | vouchers.ts vs cashStore.ts | 3h | |
| A10-C3 | Same endpoint, opposite query param names | extraRewards.ts vs cashStore.ts | 1h | |
| A10-C4 | In-memory PaymentMachine no cross-request protection | paymentRoutes.ts:17-41 | 4h | |
| A10-C5 | HMAC key from env var NAME not value | internalAuth.ts:40-46 | 1h | |
| A10-C6 | SSE order stream no merchant ownership check | httpServer.ts:473-533 | 2h | |
| A10-C7 | Three conflicting color systems | DesignTokens.ts, Colors.ts, ThemeContext.tsx | 4h | |
| A10-C8 | Order refund modal shows Rs. 0 and `#undefined` | orders.tsx:971-979 | 1h | |

---

## Merchant App Gen 10 CRITICAL (14 issues, ~20h)

Full details: [`06-MERCHANT-APP/CRITICAL.md`](../06-MERCHANT-APP/CRITICAL.md)

### Financial (4)

| ID | Title | File | Est. | Status |
|----|-------|------|------|--------|
| G-MA-C01 | Wallet balance ×100 inflation | `app/payouts/index.tsx:276` | 30m | ACTIVE |
| G-MA-C02 | Double coin deduction — coinRedemption not in payload | `app/pos/index.tsx:247,711` | 1h | ACTIVE |
| G-MA-C03 | Offline bill loses coin discount | `app/pos/index.tsx:658-674` | 1h | ACTIVE |
| G-MA-C04 | Cart cleared before SQLite confirms write | `app/pos/index.tsx:658` | 30m | ACTIVE |

### Security (2)

| ID | Title | File | Est. | Status |
|----|-------|------|------|--------|
| G-MA-C05 | IDOR — order detail no store ownership check | `app/(dashboard)/orders/[id].tsx:117` | 1h | ACTIVE |
| G-MA-C06 | Biometric bypass when hardware unavailable | `utils/biometric.ts:52` | 1h | ACTIVE |

### Data Loss (4)

| ID | Title | File | Est. | Status |
|----|-------|------|------|--------|
| G-MA-C07 | Queued socket events lost on crash | `contexts/SocketContext.tsx:110` | 2h | ACTIVE |
| G-MA-C08 | Offline idempotency after INSERT | `services/offlinePOSQueue.ts:58` | 1h | ACTIVE |
| G-MA-C09 | Failed offline bills silently dropped | `services/offlinePOSQueue.ts:260` | 1h | ACTIVE |
| G-MA-C10 | Batch sync no atomicity — partial failure | `services/offlinePOSQueue.ts:232` | 1h | ACTIVE |

### Functional (4)

| ID | Title | File | Est. | Status |
|----|-------|------|------|--------|
| G-MA-C11 | SocketContext.emit calls non-existent getSocket() | `contexts/SocketContext.tsx:112` | 2h | ACTIVE |
| G-MA-C12 | Offline queue routes to wrong API paths | `services/offline.ts:332` | 1h | ACTIVE |
| G-MA-C13 | Cache never invalidated after mutations | `services/offline.ts:69` | 1h | ACTIVE |
| G-MA-C14 | Pending orders tab always shows zero | `hooks/useOrdersDashboard.ts:222` | 30m | ACTIVE |

**5-Day Fix Order:** Day 1 (C01→C05→C11) · Day 2 (C02→C03→C04) · Day 3 (C06→C07→C08) · Day 4 (C09→C10→C12) · Day 5 (C13→C14)

**Cross-repo patterns:** C01 (unit mismatch → CR-17), C05 (IDOR → CR-M5), C06 (biometric → G-KS-C4), C07/C09/C10 (fire-and-forget → CR-15), C08 (offline transaction → CR-15), C11 (real-time dead → CR-16), C14 (OrderStatus → CS-E19/E20)

---

## Backend (Gen 1-7) CRITICAL (13 issues)

See [docs/Bugs/BACKEND-BUGS.md](../Bugs/BACKEND-BUGS.md) for full listing.

---

## Progress Summary

| Category | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| Cross-Service | 11 | 1 | 10 |
| AdBazaar | 9 | 5 | 4 |
| Rendez Backend | 3 | 0 | 3 |
| Rendez Admin | 4 | 0 | 4 |
| Rendez App | 5 | 0 | 5 |
| Karma Service | 16 | 3 | 13 |
| Karma UI | 7 | 0 | 7 |
| Consumer App Gen 11 | 11 | 0 | 11 |
| Admin App Gen 10 | 8 | 0 | 8 |
| **Merchant App Gen 10** | **14** | **0** | **14** |
| **Vesper App** | **3** | **0** | **3** |
| Gen 1-7 Backend | 13 | 0 | 13 |
| Gen 1-7 Consumer | 26 | 0 | 26 |
| Gen 1-7 Merchant | 14 | 0 | 14 |
| Gen 1-7 Admin | 25 | 0 | 25 |
| **TOTAL** | **174** | **9** | **165** |

**Estimated Total:** ~113 hours across 3 weeks (Gen 16 Vesper adds ~6h; cross-service JWT adds ~1h; Round 4 karma adds ~5h)
