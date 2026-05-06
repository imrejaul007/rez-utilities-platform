# PHASE 2 — All HIGH Issues

**Date:** 2026-04-16
**Scope:** All codebases
**Total:** 367 HIGH issues
**Estimated Effort:** ~80 hours

---

## AdBazaar HIGH (11 issues)

See individual files in [06-ADBAZAAR](../06-ADBAZAAR/) for full details.

### Business Logic (3)

| # | ID | Title | File | Effort |
|---|-----|-------|------|--------|
| 1 | AB-B3 | Refund webhook does NOT update booking status | `webhooks/razorpay/route.ts:135` | 30 min |
| 2 | AB-B4 | Inquiry-accepted bookings stuck in "Confirmed" | `inquiries/[id]/accept/route.ts` | 1 hour |
| 3 | AB-B5 | Earnings aggregates include refunded bookings | `vendor/earnings/route.ts:36` | 5 min |

### Payment (2)

| # | ID | Title | File | Effort |
|---|-----|-------|------|--------|
| 4 | AB-P2 | Payment amount not verified (same as AB-C5) | `verify-payment/route.ts` | 1 hour |
| 5 | AB-P3 | `paid` status counted as pending payout | `vendor/earnings/route.ts:40` | 5 min |

### Data Sync (1)

| # | ID | Title | File | Effort |
|---|-----|-------|------|--------|
| 6 | AB-D2 | Attribution records never populate `booking_id` | `webhooks/rez-visit/route.ts:44` | 30 min |

### Security (5)

| # | ID | Title | File | Effort |
|---|-----|-------|------|--------|
| 7 | AB-H1 | `createServerClient` silently falls back to anon key | `lib/supabase.ts:3` | 5 min |
| 8 | AB-H2 | Admin auth uses fragile manual cookie parsing | `lib/adminAuth.ts:11` | 1 hour |
| 9 | AB-H3 | Fire-and-forget promises swallow all errors | Multiple | 2 hours |
| 10 | AB-H4 | `RAZORPAY_KEY_ID` unnecessarily in API response | `lib/razorpay.ts:40` | 5 min |
| 11 | AB-H5 | Empty `next.config.ts` — no security headers | `next.config.ts` | 20 min |

**AdBazaar HIGH Subtotal: ~7 hours**

---

## AB-B3 Fix Detail — Refund Status Update

```typescript
// src/app/api/webhooks/razorpay/route.ts — in handleRefundCreated
// BEFORE: Inserts refunds record but never updates booking status

// AFTER: Add after the refunds insert
await supabase.from('bookings')
  .update({ status: 'cancelled' }) // or 'refunded' if you add that status
  .eq('id', booking.id)
  .eq('status', 'paid') // Only if currently paid
```

Then update earnings filter:
```typescript
// src/app/api/vendor/earnings/route.ts
.filter(b => !['disputed', 'cancelled', 'refunded'].includes(b.status))
```

---

## AB-D2 Fix Detail — Attribution booking_id Population

```typescript
// src/app/api/bookings/route.ts — after booking is created from QR scan
// Find all attribution records linked to this scan event that have no booking_id
const { data: linkedScanEvents } = await supabase
  .from('scan_events')
  .select('id')
  .eq('booking_id', booking.id) // scan events linked to this booking

if (linkedScanEvents?.length) {
  await supabase.from('attribution')
    .update({ booking_id: booking.id })
    .in('scan_event_id', linkedScanEvents.map(s => s.id))
    .is('booking_id', null)
}
```

---

## AB-H1 Fix Detail — Fail Fast on Missing Service Role Key

```typescript
// src/lib/supabase.ts
// BEFORE: silently falls back to anon key
// AFTER: throw error

export function createServerClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — admin operations require service role key')
  }
  return createClient(url, key)
}
```

---

## AB-H3 Fix Detail — Replace Fire-and-Forget Patterns

```typescript
// BEFORE — every route:
Promise.resolve(supabase.from('notifications').insert({...})).then(() => {}).catch(() => {})

// AFTER — with DLQ:
try {
  const { error } = await supabase.from('notifications').insert({...})
  if (error) throw error
} catch (err) {
  console.error('[notification] insert failed:', err)
  // Insert into dead-letter queue
  await supabase.from('failed_notifications').insert({
    ...notificationData,
    error: String(err),
    attempted_at: new Date().toISOString(),
  })
}
```

---

## AB-P3 Fix Detail — Remove `paid` from Pending Payout

```typescript
// src/app/api/vendor/earnings/route.ts:40
// BEFORE:
const pendingPayout = rows.filter(b =>
  ['confirmed', 'paid', 'executing'].includes(b.status)
)

// AFTER:
const pendingPayout = rows.filter(b =>
  ['confirmed', 'executing'].includes(b.status) && !b.payout_id
)
```

---

## Karma Service HIGH (23 issues, ~25 hours)

Full details: [`01-KARMA-SERVICE/SECURITY.md`](../../01-KARMA-SERVICE/SECURITY.md) + [`01-KARMA-SERVICE/BUSINESS-LOGIC.md`](../../01-KARMA-SERVICE/BUSINESS-LOGIC.md) + [`01-KARMA-SERVICE/ROUND4.md`](../../01-KARMA-SERVICE/ROUND4.md)

### Existing HIGH (6)

| ID | Title | File | Effort | Status |
|----|-------|------|--------|--------|
| G-KS-H1 | Admin role check case-sensitive — `'ADMIN'` fails auth | `adminAuth.ts:15` | 15 min | ACTIVE |
| G-KS-H2 | `conversionHistory[].rate` schema allows any 0-1 value but canonical only allows 4 discrete values | `KarmaProfile.ts` | 15 min | ACTIVE |
| G-KS-H3 | `bcrypt ^5.1.1` has known CVEs | `package.json` | 5 min | ACTIVE |
| G-KS-H4 | Critical business logic paths have zero test coverage | `src/__tests__/` | 3 hours | ACTIVE |
| G-KS-H7 | trustScore never calculated or returned — always 0 | `karmaRoutes.ts:60` | 1 hour | ACTIVE |
| G-KS-H8 | createdAt/updatedAt/weekOfLastKarmaEarned missing from profile response | `karmaRoutes.ts:60` | 1 hour | ACTIVE |

### New HIGH — Round 4 (17)

| ID | Title | File | Effort |
|----|-------|------|--------|
| G-KS-H9 | Internal service token sent but never validated | `autoCheckoutWorker.ts:173` | 30 min |
| G-KS-H10 | axios ^1.7.9 may resolve to SSRF-vulnerable version | `package.json` | 15 min |
| G-KS-H11 | Weekly karma cap bypassed through updateProfileStats | `earnRecordService.ts:273` | 2 hours |
| G-KS-H12 | Duplicate startOfWeek variable in addKarma | `karmaService.ts:128,195` | 15 min |
| G-KS-H13 | Inconsistent week boundary across services (ISO vs locale) | `batchService.ts` vs `karmaService.ts` | 1 hour |
| G-KS-H14 | decayWorker lacks job-level distributed locking | `decayWorker.ts:27` | 1 hour |
| G-KS-H15 | applyDecayToAll loads all profiles without pagination | `karmaService.ts:259` | 1 hour |
| G-KS-H16 | createWeeklyBatch has no record limit in aggregation | `batchService.ts:112` | 1 hour |
| G-KS-H17 | Batch execution is fully sequential, unbounded | `batchService.ts:421` | 2 hours |
| G-KS-H18 | convertKarmaToCoins doesn't guard against NaN/Infinity | `karmaEngine.ts:132` | 30 min |
| G-KS-H19 | getKarmaHistory crashes on null batchId | `karmaService.ts:447` | 15 min |
| G-KS-H20 | History endpoint returns conversion data, not earn records | `karmaRoutes.ts:108` | 1 hour |
| G-KS-H21 | EarnRecord missing eventName in backend response | `earnRecordService.ts:28` | 30 min |
| G-KS-H22 | nextLevelAt nullable on backend but not on consumer | `types/index.ts:179` | 15 min |
| G-KS-H23 | QR codes generated but never persisted, expire in 5 min | `verificationEngine.ts:577` | 1 hour |
| G-KS-H24 | karmaEarned read from untrusted cross-service booking field | `verificationEngine.ts:452` | 2 hours |
| G-KS-H25 | Checkout GPS score uses check-in coordinates as fallback | `verificationEngine.ts:391` | 1 hour |

**Effort:** ~25 hours

### G-KS-H1 Fix — Admin Role Case Normalization

```typescript
// src/middleware/adminAuth.ts
const normalizedRole = (req.userRole || '').toLowerCase().replace('_', '');
if (!['admin', 'superadmin'].includes(normalizedRole)) {
  return res.status(403).json({ success: false, message: 'Admin access required' });
}
```

### G-KS-H2 Fix — Conversion Rate Enum Validation

```typescript
// src/models/KarmaProfile.ts
rate: {
  type: Number,
  enum: [0.25, 0.5, 0.75, 1.0],  // was: { min: 0, max: 1 }
}
```

### G-KS-H3 Fix — Upgrade bcrypt

```bash
npm install bcrypt@^5.2.0
# OR:
npm install bcryptjs@^2.4.3
```

### G-KS-H4 Fix — Add Critical Path Tests

Add integration tests using `mongodb-memory-server` for: `addKarma()`, `createEarnRecord()`, `creditUserWallet()`, `applyDecayToAll()`, batch processing.

---

## Rendez Backend HIGH (7 issues)

---

## Consumer App Gen 11 HIGH — Cross-Service (13 items with cross-app impact)

Full details: [`06-CONSUMER-AUDIT-2026/02-HIGH.md`](../06-CONSUMER-AUDIT-2026/02-HIGH.md)

| ID | Gap | Title | Crosses | Est. | Status |
|----|-----|-------|---------|------|--------|
| C11-H1 | NA-HIGH-01 | Coin formula off by factor of 10 | rez-now → shared | 10m | ACTIVE |
| C11-H2 | NA-HIGH-03 | karma credits 'rez' but queries 'karma_points' | karma → wallet | 30m | ACTIVE |
| C11-H3 | NA-HIGH-05 | Dedup key 1-second collision window | wallet → gamification | 30m | ACTIVE |
| C11-H4 | NA-HIGH-06 | Rewards hook idempotency silent drop | finance → wallet | 2h | ACTIVE |
| C11-H5 | NA-HIGH-07 | Floating-point truncation on redemption | consumer → wallet | 1h | ACTIVE |
| C11-H6 | NA-HIGH-10 | Missing `utils/apiUtils.ts` — 7 files | consumer (build) | 1h | ACTIVE |
| C11-H7 | NA-HIGH-12 | Wallet store + context dual pattern | consumer | 4h | ACTIVE |
| C11-H8 | NA-HIGH-13 | Duplicate coin calc in 4+ locations | consumer | 3h | ACTIVE |
| C11-H9 | NA-HIGH-15 | hotelOtaApi bypasses all infra | consumer | 30m | ACTIVE |
| C11-H10 | NA-HIGH-19 | MD5 for image integrity hash | consumer | 1h | ACTIVE |
| C11-H11 | NA-HIGH-20 | IDOR on bill/transaction access | consumer | 2h | ACTIVE |
| C11-H12 | NA-HIGH-21 | Auth tokens in localStorage (XSS) | consumer | 2h | ACTIVE |
| C11-H13 | NA-HIGH-22 | Client-side fraud detection fail-open | consumer | 3h | ACTIVE |
| C11-H14 | NA-HIGH-23 | Device fingerprint tamperable | consumer | 2h | ACTIVE |

**Remaining 10 NA-HIGH items** (per-codebase, no cross-app impact): See [`06-CONSUMER-AUDIT-2026/02-HIGH.md`](../06-CONSUMER-AUDIT-2026/02-HIGH.md)

---

## Merchant App Gen 10 HIGH (38 issues, ~40h)

Full details: [`06-MERCHANT-APP/HIGH.md`](../06-MERCHANT-APP/HIGH.md)

### Financial (11)

| ID | Title | File | Est. |
|----|-------|------|------|
| G-MA-H01 | No withdrawal amount validation | `services/api/wallet.ts:137` | 30m |
| G-MA-H02 | Payment filter sends 'completed' not 'paid' | `app/(dashboard)/payments.tsx:21` | 15m |
| G-MA-H03 | Cashback approval no upper bound | `app/(cashback)/[id].tsx:54` | 15m |
| G-MA-H04 | Withdrawal unit paise/rupees inconsistent | `wallet.ts` vs `payouts/index.tsx:241` | 30m |
| G-MA-H05 | Wallet balance unit unclear across services | `services/api/coins.ts:188` | 1h |
| G-MA-H06 | Discount % not capped at 100 | `services/api/pos.ts:210` | 15m |
| G-MA-H07 | Coin award no integer check | `app/(dashboard)/coins.tsx:156` | 15m |
| G-MA-H08 | Withdrawal zero-padding bypass | `app/(dashboard)/wallet.tsx:501` | 15m |
| G-MA-H09 | isNaN fails on Infinity | `utils/paymentValidation.ts:96` | 15m |
| G-MA-H10 | SKU validation fail-open | `services/api/products.ts:911` | 1h |
| G-MA-H11 | Offline sync timeout ignored | `services/offline.ts:255` | 30m |

### Data Sync & Real-Time (10)

| ID | Title | File | Est. |
|----|-------|------|------|
| G-MA-H12 | Ping interval accumulates on reconnect | `services/api/socket.ts:597` | 1h |
| G-MA-H13 | 'reconnecting' state never shown | `services/api/socket.ts:162` | 30m |
| G-MA-H14 | Socket subscriptions not restored | `services/api/socket.ts:153` | 1h |
| G-MA-H15 | Socket gives up after 5 reconnects | `services/api/socket.ts:66` | 1h |
| G-MA-H16 | No duplicate detection in offline queue | `services/offline.ts:124` | 1h |
| G-MA-H17 | Dead letter queue unbounded | `services/offline.ts:42` | 1h |
| G-MA-H18 | refreshPermissions flag never resets on logout | `contexts/AuthContext.tsx:177` | 30m |
| G-MA-H19 | joinMerchantDashboard silent errors | `services/api/socket.ts:134` | 30m |
| G-MA-H20 | Buffering flag not cleared on reconnect | `services/api/orderQueue.ts:35` | 1h |
| G-MA-H21 | Sync triggered without internet check | `hooks/useNetworkStatus.ts:139` | 30m |

### API Contract (7)

| ID | Title | File | Est. |
|----|-------|------|------|
| G-MA-H22 | Order type mismatch (2 interfaces) | `services/api/orders.ts:240` | 1h |
| G-MA-H23 | updateProfile name mapping broken | `services/api/auth.ts:183` | 1h |
| G-MA-H24 | socialMediaService wrong response path | `services/api/socialMedia.ts:105` | 1h |
| G-MA-H25 | Export/import bypasses apiClient | `services/api/products.ts:375` | 1h |
| G-MA-H26 | getVisitStats throws instead of fallback | `services/api/storeVisits.ts:79` | 1h |
| G-MA-H27 | storeId query param never sent | `services/api/orders.ts:104` | 30m |

### Business Logic & Enum (10)

| ID | Title | File | Est. |
|----|-------|------|------|
| G-MA-H28 | OrderStatus duplicated 7x with different values | Multiple | 3h |
| G-MA-H29 | PaymentStatus wrong whitelist | `utils/paymentValidation.ts:33` | 1h |
| G-MA-H30 | CashbackStatus missing 'approved', 'expired' | `hooks/queries/useCashback.ts:23` | 1h |
| G-MA-H31 | Client-side FSM not synced with backend | `services/api/orders.ts:44` | 2h |
| G-MA-H32 | OrderFilters defined 3x | `types/api.ts:485` | 1h |
| G-MA-H33 | 'viewer' role in Zod but not MerchantRole | `utils/validation/schemas.ts:269` | 1h |
| G-MA-H34 | Analytics uses wrong status keys | `services/api/orders.ts:306` | 1h |
| G-MA-H35 | Status normalization 7x locations | Multiple | 2h |
| G-MA-H36 | CashbackRequest defined 3x | Multiple | 1h |
| G-MA-H37 | Product type defined 3x | Multiple | 1h |
| G-MA-H38 | PaymentStatus 3 definitions | Multiple | 1h |

**Cross-repo patterns in HIGH:** H02/H29 (PaymentStatus enum), H04/H05 (unit mismatch), H16/H17 (offline queue), H28/H30/H34/H35 (enum fragmentation), H22/H36/H37/H38 (type drift), H27 (storeId IDOR)

---

## Gen 1–7 HIGH Issues

See [docs/Bugs/00-INDEX.md](../Bugs/00-INDEX.md)

| Codebase | HIGH Count | Key Focus Areas |
|----------|-----------|----------------|
| Consumer App | 103 | Payment, wallet, orders, notifications |
| Merchant App | 49 | Payment verification, order state, slot locking |
| Admin App | 84 | Auth, data exposure, rate limiting |
| Backend | 59 | Financial atomicity, webhook security, Redis fail-open |
| **Total Gen 1-7** | **295** | |

---

## Phase 2 Grand Total

| Source | Issues | Effort |
|--------|--------|--------|
| AdBazaar HIGH | 11 | ~7 hours |
| Karma Service HIGH | 23 | ~22 hours |
| Rendez Backend HIGH | 7 | ~5 hours |
| Consumer App Gen 11 HIGH | 24 | ~8 hours |
| **Merchant App Gen 10 HIGH** | **38** | **~40 hours** |
| Gen 1–7 HIGH | 295 | ~60 hours |
| **TOTAL** | **398** | **~142 hours** |

---

## Deployment Order

1. **AB-H1** (5 min) — fail fast, low risk
2. **AB-P3** (5 min) — vendor payout accuracy
3. **AB-B5** (5 min) — earnings accuracy
4. **AB-B3** (30 min) — refund status update
5. **AB-H4** (5 min) — remove key from response
6. **AB-H1** (5 min) — fix service role key fallback
7. **AB-D2** (30 min) — attribution linking
8. **AB-B4** (1 hour) — stale booking timeout
9. **AB-H2** (1 hour) — admin auth robustness
10. **AB-H3** (2 hours) — error handling
11. **AB-H5** (20 min) — security headers
12. **G-MA-H02** (15 min) — PaymentStatus 'completed'→'paid'
13. **G-MA-H09** (15 min) — isNaN→Number.isFinite
14. **G-MA-H28** (3h) — OrderStatus enum canonical
15. **G-MA-H30** (1h) — CashbackStatus approved/expired
16. **Remaining Gen 1–7 HIGHs** (60 hours) — 2-week sprint
