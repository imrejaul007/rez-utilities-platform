# Audit Verification Report — 2026-04-17

**Auditor:** Background-Auditor agent
**Session:** Cross-verify all fixes from previous session (fix/scheduler-security-audit branch)
**Scope:** F-05 (wallet idempotency), AB-C1 through AB-C5 (AdBazaar security)

---

## Executive Summary

| Fix ID | Fix Name | Verified | Notes |
|--------|----------|----------|-------|
| F-05 | Wallet Idempotency (6 methods) | **PASS** | All 6 methods correctly forward Idempotency-Key header |
| AB-C1 | QR scan spoofing | **FAIL** | No POST endpoint; GET still reads `rez_user_id` from URL param |
| AB-C2 | Rate limiting | **FAIL** | No rate limiter in middleware.ts |
| AB-C3 | Bank account masking | **FAIL** | Raw bank data returned in GET+PATCH responses |
| AB-C4 | Booking idempotency | **FAIL** | No Idempotency-Key header check in POST handler |
| AB-C5 | Payment amount verification | **FAIL** | No `razorpay_amount` comparison in verify-payment |

**Result: 1/6 fixes confirmed. 5/6 are still open security issues.**

---

## Detailed Verification

### F-05: Wallet Idempotency Headers — PASS

**Files reviewed:**
- `/rez-app-consumer/services/walletApi.ts`
- `/rez-app-consumer/services/priveApi.ts`
- `/rez-app-consumer/utils/idempotencyKey.ts`
- `/rez-app-consumer/app/redeem-coins.tsx`
- `/rez-app-consumer/app/wallet/transfer.tsx`

| Method | File | Header Forwarded | Key Generator |
|--------|------|-----------------|---------------|
| `initiateTransfer` | walletApi.ts:837 | `headers: { 'Idempotency-Key': key }` | `data.idempotencyKey ?? uuid` |
| `confirmTransfer` | walletApi.ts:867 | `headers: { 'Idempotency-Key': key }` | `data.idempotencyKey ?? uuid` |
| `sendGift` | walletApi.ts:991 | `headers: { 'Idempotency-Key': key }` | `data.idempotencyKey ?? uuid` |
| `claimGift` | walletApi.ts:1016 | `headers: { 'Idempotency-Key': key }` | `idempotencyKey ?? uuid` |
| `redeemCoins` | walletApi.ts:1150 | `headers: { 'Idempotency-Key': key }` | `data.idempotencyKey ?? uuid` |
| `purchaseGiftCard` | walletApi.ts:1067 | `headers: { 'Idempotency-Key': key }` | `data.idempotencyKey ?? uuid` |
| `redeemCoins` | priveApi.ts:636 | `headers: { 'Idempotency-Key': request.idempotencyKey }` | from request param |

**Key generator:** Uses `crypto.getRandomValues()` via `generateIdempotencyKey()` utility (cryptographically secure). Fallback to `crypto.randomUUID()` is also CSPRNG. All 6 methods pass the Idempotency-Key header to the backend.

**Evidence:**
```typescript
// walletApi.ts:829-839 (initiateTransfer)
const key = data.idempotencyKey ?? `wallet-transfer-${Date.now()}-${uuid.v4()}`;
return await apiClient.post<...>('/wallet/transfer/initiate', data as any, {
  headers: { 'Idempotency-Key': key },
});

// priveApi.ts:636-638 (redeemCoins)
return apiClient.post<RedeemResponse>(ENDPOINTS.REDEEM, { ...request, coinType: 'prive' }, {
  headers: { 'Idempotency-Key': request.idempotencyKey },
});
```

**Verdict: PASS.** All wallet mutation methods correctly forward idempotency keys as HTTP headers.

---

### AB-C1: QR Scan Spoofing — FAIL (NOT FIXED)

**File reviewed:** `adBazaar/src/app/api/qr/scan/[slug]/route.ts`

**Expected behavior (from session description):**
1. GET removed `rez_user_id` URL param
2. POST endpoint created using Bearer auth (not URL param)
3. `ScanPageClient.tsx` created for authenticated coin credit

**Actual behavior:**

The route only has a GET handler. There is NO POST handler.

```typescript
// Line 72 — still reads from URL param (spoofable)
const rezUserId = req.nextUrl.searchParams.get('rez_user_id')

// Lines 80-91 — still inserts scan_events with user_id from URL param
const { data: scanEvent } = await supabase.from('scan_events').insert({
  qr_id: qr.id,
  user_id: rezUserId,  // <-- from attacker-controlled URL param
  ...
}).select().single()

// Lines 105-169 — coins credited based on URL-param user ID
if (rezUserId && qr.rez_merchant_id && scanEvent) {
  // credits coins to the spoofed user ID
}
```

The `ScanPageClient.tsx` file does NOT exist anywhere in `adBazaar/src/`.

**Impact:** Any attacker can craft a URL like:
```
https://adbazaar.com/api/qr/scan/merchantslug?rez_user_id=VICTIM_USER_ID
```
and redirect the victim (via phishing, QR code overlay, etc.) to credit coins to the attacker's account. The IP cooldown (24h) limits mass exploitation but does not prevent targeted attacks.

**Verdict: FAIL — issue is unchanged.**

---

### AB-C2: Rate Limiting — FAIL (NOT FIXED)

**File reviewed:** `adBazaar/src/middleware.ts`

The middleware exports only a `proxy` function. There is no rate limiting implementation (no sliding window, no token bucket, no in-memory store).

The middleware only performs:
1. Route allowlist (public routes)
2. Supabase session verification
3. Role-based access control (vendor/buyer/admin)

No rate limiting whatsoever.

**Verdict: FAIL — no rate limiter implemented.**

---

### AB-C3: Bank Account Masking — FAIL (NOT FIXED)

**File reviewed:** `adBazaar/src/app/api/profile/route.ts`

**GET handler (line 26):** Selects raw bank fields:
```typescript
.select('id, name, email, phone, ..., bank_account_name, bank_account_number, bank_ifsc, upi_id')
// Returns: { profile: { bank_account_number: "1234567890123", bank_ifsc: "SBIN0001234", ... } }
```

**PATCH handler (line 60):** Updates raw bank fields, returns raw values:
```typescript
if (bank_account_number !== undefined) update.bank_account_number = bank_account_number || null;
// ...
.select('id, name, ..., bank_account_name, bank_account_number, bank_ifsc, upi_id')
// Returns: { profile: { bank_account_number: "1234567890123", ... } }
```

No masking logic exists anywhere in the file. Full bank account numbers and IFSC codes are returned in plain text to any authenticated user.

**Verdict: FAIL — no masking implemented.**

---

### AB-C4: Booking Idempotency — FAIL (NOT FIXED)

**File reviewed:** `adBazaar/src/app/api/bookings/route.ts`

The POST handler (line 12) creates bookings without any idempotency check:

```typescript
// No Idempotency-Key header read
const { data: booking, error: bookingError } = await supabase
  .from('bookings')
  .insert({
    listing_id: listingId,
    buyer_id: buyerId,
    // ... no idempotency_key field
  })
```

The session description references `supabase/migrations/009_add_booking_idempotency_key.sql` but this file does NOT exist in the repository.

No `Idempotency-Key` header is read. No duplicate check is performed. Multiple concurrent booking requests for the same listing will all succeed.

**Verdict: FAIL — no idempotency check implemented.**

---

### AB-C5: Payment Amount Verification — FAIL (NOT FIXED)

**File reviewed:** `adBazaar/src/app/api/bookings/[id]/verify-payment/route.ts`

The POST handler receives `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` (line 15). It verifies the Razorpay signature (line 71) and checks order ID match (line 66).

However, there is **no verification of the payment amount**. The handler does not compare `razorpay_amount` against `booking.amount`. An attacker with a valid Razorpay signature could submit a payment for a smaller amount than the booking cost and successfully confirm the booking.

```typescript
// Line 66: Only order ID is checked
if (booking.payment_order_id !== razorpay_order_id) {
  return NextResponse.json({ error: 'Order ID mismatch' }, { status: 400 })
}

// No amount comparison:
// if (razorpay_payment_amount !== booking.amount * 100) { reject }

// Lines 78-88: Booking is confirmed regardless of amount
.update({
  status: BookingStatus.Confirmed,
  payment_id: razorpay_payment_id,
  ...
})
```

**Verdict: FAIL — payment amount not verified.**

---

## New Issues Found

### Issue N-1: QR scan IP cooldown uses client-visible redirect (Medium)

**File:** `adBazaar/src/app/api/qr/scan/[slug]/route.ts:65`
```typescript
if (recentScan) {
  return NextResponse.redirect(`${appUrl}/scan/${slug}?coins=0&reason=already_scanned`)
}
```

The `already_scanned` reason is passed as a URL query parameter. A user could inspect the URL and see they were blocked due to the anti-gaming check. Minor UX/information disclosure, not a security vulnerability.

### Issue N-2: DLQ insert swallows errors silently (Low)

**Files:** `adBazaar/src/app/api/qr/scan/[slug]/route.ts:145-147, 153-166`

The DLQ (dead letter queue) insert is wrapped in try/catch, and errors are only logged to console. If the DLQ insert itself fails (e.g., RLS policy blocks it), no alert fires and the DLQ record is silently dropped. Coins may never be retried for that scan event.

### Issue N-3: No XFF validation for CDN/proxy IP spoofing (Low)

**File:** `adBazaar/src/app/api/qr/scan/[slug]/route.ts:53-54`

The code correctly uses `at(-1)` for XFF to avoid first-hop spoofing, but there is no validation that the XFF header comes from a known reverse proxy. If a CDN (Cloudflare, Fastly) adds its own XFF, the client's spoofed XFF would be buried and the real IP used instead. For rate limiting purposes this is acceptable, but the comment should be updated to note this assumption.

### Issue N-4: `duplicate definition` of `TransactionMetadata` (Low)

**File:** `rez-app-consumer/services/walletApi.ts:145-171, 303-329`

`TransactionMetadata` is defined twice (lines 145-171 and 303-329) in the same file. Both definitions are identical, so this is a TypeScript lint error waiting to happen. Should be deduplicated to a single interface definition.

---

## Recommendations

### Immediate (P0 — these are still open security issues)

1. **AB-C1 (QR spoofing):** Create POST endpoint `/api/qr/scan/[slug]` that uses Bearer auth. Move coin crediting from GET to POST. Update QR print/handoff to use POST from the REZ app instead of URL param.
2. **AB-C2 (Rate limiting):** Add a sliding-window rate limiter to `middleware.ts` targeting `/api/qr/scan` (20 req/min) and other public endpoints (100 req/min).
3. **AB-C3 (Bank masking):** Apply masking before returning in both GET and PATCH handlers:
   ```typescript
   bank_account_number: data.bank_account_number
     ? `XXXX${data.bank_account_number.slice(-4)}`
     : null,
   bank_ifsc: data.bank_ifsc ? `XXXX` : null,
   ```
4. **AB-C4 (Booking idempotency):** Read `Idempotency-Key` header, check Supabase for existing booking with same key, return existing if found, otherwise insert with key.
5. **AB-C5 (Payment amount):** Verify `razorpay_amount === booking.amount * 100` before confirming the booking.

### Quick wins (P1)

6. **N-4:** Deduplicate `TransactionMetadata` interface in `walletApi.ts`.
7. **N-2:** Add monitoring/alerting when DLQ insert fails silently.

---

## Files Reviewed

| File | F-05 | AB-C1 | AB-C2 | AB-C3 | AB-C4 | AB-C5 |
|------|------|-------|-------|-------|-------|-------|
| `rez-app-consumer/services/walletApi.ts` | PASS | — | — | — | — | — |
| `rez-app-consumer/services/priveApi.ts` | PASS | — | — | — | — | — |
| `rez-app-consumer/utils/idempotencyKey.ts` | PASS | — | — | — | — | — |
| `rez-app-consumer/app/redeem-coins.tsx` | PASS | — | — | — | — | — |
| `rez-app-consumer/app/wallet/transfer.tsx` | PASS | — | — | — | — | — |
| `adBazaar/src/app/api/qr/scan/[slug]/route.ts` | — | FAIL | — | — | — | — |
| `adBazaar/src/middleware.ts` | — | — | FAIL | — | — | — |
| `adBazaar/src/app/api/profile/route.ts` | — | — | — | FAIL | — | — |
| `adBazaar/src/app/api/bookings/route.ts` | — | — | — | — | FAIL | — |
| `adBazaar/src/app/api/bookings/[id]/verify-payment/route.ts` | — | — | — | — | — | FAIL |
| `adBazaar/src/app/scan/[slug]/page.tsx` | — | FAIL* | — | — | — | — |

*`ScanPageClient.tsx` (referenced in session notes) does not exist.

---

**Report generated:** 2026-04-17
**Next action:** Implement AB-C1 through AB-C5 as described in Recommendations section.
