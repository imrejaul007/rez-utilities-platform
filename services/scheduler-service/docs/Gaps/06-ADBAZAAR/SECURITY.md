# AdBazaar — Security Gaps

**Date:** 2026-04-16
**Category:** Security
**Status:** 5 CRITICAL (ACTIVE — verified NOT fixed 2026-04-17) + 2 HIGH (FIXED) + 2 HIGH (OPEN) + 1 HIGH (DEFERRED) + 1 MEDIUM (FIXED) + 3 MEDIUM (OPEN) + 1 LOW (FIXED) + 2 LOW (OPEN) = 17 issues

---

## CRITICAL Issues

---

### AB-C1 — `rez_user_id` Spoofable via URL Query Param — Coin Fraud

**Status:** ACTIVE — Code NOT changed (verified 2026-04-17 by background auditor — GET still reads `rez_user_id` from URL param, no POST endpoint, no ScanPageClient.tsx)

**Severity:** CRITICAL

**Impact:** Attacker can credit coins to any REZ user account

**File:** `src/app/api/qr/scan/[slug]/route.ts`, line 72

```typescript
const rezUserId = req.nextUrl.searchParams.get('rez_user_id')
// ...
body: JSON.stringify({
  rezUserId, // <-- attacker-controlled, used to credit coins
  merchantId: qr.rez_merchant_id,
  coinsAmount: qr.coins_per_scan,
})
```

**Root Cause:** The QR scan endpoint accepts `rez_user_id` from the URL query string (`/api/qr/scan/{slug}?rez_user_id=XXX`). This is passed directly to the REZ API for coin crediting. Any attacker can call this URL with a spoofed `rez_user_id` to credit coins to arbitrary users.

**Attack Vector:**
1. Attacker creates a link: `https://adbazaar.com/api/qr/scan/myslug?rez_user_id=VICTIM_UUID`
2. Victim visits the link (or is tricked into clicking)
3. Coins are credited to VICTIM_UUID instead of the victim's own ID

**Fix:** Pass `rez_user_id` from the authenticated Supabase session cookie, not from URL query params. The authenticated user's ID should be extracted server-side from the session.

---

### AB-C2 — No Rate Limiting on Public Endpoints

**Status:** ACTIVE — Code NOT changed (verified 2026-04-17 by background auditor — no rate limiter in middleware.ts)

**Severity:** CRITICAL

**Impact:** API abuse, scraping, QR scan spam

**Files:**
- `src/app/api/qr/scan/[slug]/route.ts` — unlimited scan events
- `src/app/api/listings/[id]/view/route.ts` — unlimited view count inflation
- `src/app/api/listings/route.ts` — enumeration + scraping

The QR scan endpoint has a 24-hour IP-based cooldown, but:
1. A single IP can still create thousands of `scan_event` records before hitting the cooldown on the **redirect** — the DB insert happens before the cooldown check
2. Proxy rotation trivially bypasses IP-based limiting
3. No CAPTCHA, token bucket, or user-level rate limiting exists

**Fix:** Implement Redis-backed rate limiting with token bucket or sliding window. Add per-IP + per-user limits on all public mutation endpoints.

---

### AB-C3 — Full Bank Account Numbers + IFSC Exposed in Profile API

**Status:** ACTIVE — Code NOT changed (verified 2026-04-17 by background auditor — raw bank fields still returned in GET+PATCH)

**Severity:** CRITICAL

**Impact:** PII/financial data exposure to any authenticated user

**File:** `src/app/api/profile/route.ts`

```typescript
// GET — line 26: exposes ALL bank fields
.select('id, name, email, phone, company_name, ..., bank_account_name, bank_account_number, bank_ifsc, upi_id')

// PATCH — line 60: returns same fields
.select('id, name, email, phone, ..., bank_account_number, bank_ifsc, upi_id')
```

**Root Cause:** Profile API returns sensitive banking fields (`bank_account_number`, `bank_ifsc`) to any authenticated user making a profile request. No masking or field-level access control.

**Fix:** Remove bank fields from default profile select. Return masked values (e.g., `****1234` for account number) only when explicitly requested. Full details on a separate `/api/profile/payout` endpoint with additional auth.

---

### AB-C4 — No Idempotency Key on Booking Creation

**Status:** ACTIVE — Code NOT changed (verified 2026-04-17 by background auditor — no Idempotency-Key header check, no duplicate check, migration file missing)

**Severity:** CRITICAL

**Impact:** Duplicate bookings on network retry — double payments possible

**File:** `src/app/api/bookings/route.ts`, lines 102-126

```typescript
const { data: booking, error: bookingError } = await supabase
  .from('bookings').insert({ ... }).select().single()

// If Razorpay order creation fails, cleanup is attempted
} catch (e) {
  const { error: delQrErr } = await supabase.from('qr_codes').delete()...
  const { error: delBookingErr } = await supabase.from('bookings').delete()...
  return NextResponse.json({ error: 'Payment gateway unavailable...' }, { status: 502 })
}
```

**Root Cause:** If the server crashes or connection drops after the booking insert succeeds but before Razorpay call completes, the cleanup code never runs. A client retry creates a duplicate booking. Same pattern exists in `/api/inquiries/[id]/accept/route.ts`.

**Fix:** Generate a unique idempotency key per booking attempt (client-supplied or server-generated UUID), store it with the booking, and reject duplicate requests with the same key.

---

### AB-C5 — Payment Amount Never Verified Server-Side

**Status:** ACTIVE — Code NOT changed (verified 2026-04-17 by background auditor — no `razorpay_amount` comparison in verify-payment)

**Severity:** CRITICAL

**Impact:** Pay ₹1 for ₹50,000 booking

**File:** `src/app/api/bookings/[id]/verify-payment/route.ts`, lines 76-88

```typescript
const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
if (!isValid) { return ... 400 }

const { data: updated } = await supabase.from('bookings')
  .update({ status: BookingStatus.Confirmed, payment_id: razorpay_payment_id })
  .eq('id', bookingId)
  .in('status', payableStatuses)
```

**Root Cause:** The code verifies the Razorpay signature (proving the payment was made) but **never checks that the payment amount matches the booking amount**. An attacker with a valid order could pay Re. 1 and get the booking confirmed.

**Fix:** After signature verification, fetch the payment from Razorpay API and verify `payment.amount === booking.amount * 100`.

---

## HIGH Issues

---

### AB-H1 — `createServerClient` Silently Falls Back to Anon Key

**Status:** FIXED (2026-04-17)
**Severity:** HIGH
**Impact:** Unintended RLS bypass if service role key missing

**Fix Applied:** `createServerClient` in `src/lib/supabase.ts` now throws an error when `SUPABASE_SERVICE_ROLE_KEY` is missing instead of silently falling back to the anon key. Admin operations now fail fast if the service role key is unavailable.

---

### AB-H2 — Admin Auth Uses Fragile Manual Cookie Parsing

**Status:** OPEN
**Severity:** HIGH
**Impact:** Auth bypass if Supabase cookie format changes

**File:** `src/lib/adminAuth.ts`, lines 11-24

```typescript
for (const cookie of cookieStore.getAll()) {
  if (cookie.name.includes('auth-token') && !cookie.name.includes('code-verifier')) {
    const parsed = JSON.parse(decodeURIComponent(cookie.value))
    if (parsed?.access_token) { accessToken = parsed.access_token; break }
  }
}
```

**Fix:** Use `@supabase/ssr` with the proper cookie adapter instead of manual parsing.

---

### AB-H3 — Fire-and-Forget Promises Silently Swallow All Errors

**Status:** OPEN
**Severity:** HIGH
**Impact:** Silent failures across notifications, emails, REZ API calls

**Files:** Multiple across API routes

```typescript
// verify-payment/route.ts:102
Promise.resolve(supabase.from('bookings').select(...)).then(...).catch(() => {})

// qr/scan/[slug]/route.ts:130
} catch { /* fire and forget */ }

// email.ts
if (!res.ok) { console.error('[email] send failed:', err) }
// Email failure doesn't propagate — booking succeeds silently
```

**Fix:** At minimum log errors. Consider a dead-letter queue or retry mechanism for failed critical operations (notifications, REZ coin credit).

---

### AB-H4 — `RAZORPAY_KEY_ID` Unnecessarily Routed Through API Response

**Status:** FIXED (2026-04-17)
**Severity:** HIGH
**Impact:** Unnecessary API response size + information exposure

**Fix Applied:** `RAZORPAY_KEY_ID` is now exported from `src/lib/razorpay.ts` and used consistently across API routes. The key ID is a public value (meant to be exposed to the Razorpay JS SDK) and does not constitute a security risk since it is a publishable key, not a secret. The pattern is now centralized.

---

### AB-H5 — `next.config.ts` Is Empty — No Security Headers

**Status:** DEFERRED (requires next.config.ts review — not fixed in this session)
**Severity:** HIGH
**Impact:** No CSP, HSTS, X-Frame-Options, image domain restrictions

**Fix:** Add `headers()` function with CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy. Add `images.domains` restriction.

---

## MEDIUM Issues

---

### AB-M1 — `rez_user_id` Format Not Validated Before DB Insert

**Status:** ACTIVE — Depends on AB-C1 being fixed; AB-C1 was verified NOT fixed (2026-04-17)

**Severity:** MEDIUM

**Fix Applied:** AB-C1 (rez_user_id spoofing fix) removes the user-controlled query param entirely and uses the authenticated session to determine the user. The `rez_user_id` is no longer passed from the client — it is extracted server-side from the authenticated Supabase session, eliminating the need for format validation.

---

### AB-M2 — Listing Search Uses User Input in `ilike` Without Escaping

**Status:** OPEN
**Severity:** MEDIUM
**File:** `src/app/api/listings/route.ts:59-62`

```typescript
if (q) {
  query = query.or(`title.ilike.%${q}%,city.ilike.%${q}%`)
}
```

**Fix:** Use Supabase's `.textSearch()` or pass as named parameter.

---

### AB-M3 — Unverified Email Inserted Into Users Table on Registration

**Status:** OPEN
**Severity:** MEDIUM
**File:** `src/app/(auth)/register/page.tsx:49-82`

```typescript
const { data, error } = await getSupabase().auth.signUp({ email, password })
const { error: insertError } = await getSupabase().from('users').insert({
  id: data.user.id, email, name, role, ...
})
// Insert happens immediately, before email verification
```

**Fix:** Insert user record only after email verification, or use Supabase's `onAuthStateChange` trigger.

---

### AB-M4 — Broadcast Title/Body Unvalidated Before Marketing Trigger

**Status:** FIXED (2026-04-17)
**Severity:** MEDIUM
**Fix Applied:** Broadcast title and body are validated via `BookingCreateSchema` in `src/lib/schemas.ts`, which enforces `z.string().max(200)` for `broadcastTitle` and `z.string().max(500)` for `broadcastBody`. Additionally, the marketing broadcast call is now properly awaited with try/catch (AB2-C6 fix), ensuring errors are logged rather than silently discarded.

---

## LOW Issues

---

### AB-L1 — Database Error Messages Propagated to API Responses

**Status:** OPEN
**Severity:** LOW
**Files:** Multiple API routes

```typescript
return NextResponse.json({ error: error.message }, { status: 500 })
```

---

### AB-L2 — No Server-Side Password Complexity Enforcement

**Status:** OPEN
**Severity:** LOW
**File:** `src/app/(auth)/register/page.tsx:228`

```typescript
minLength={8}
// Only client-side check
```

---

### AB-L3 — Fragile `includes()` Cookie Name Matching

**Status:** FIXED (2026-04-17)
**Severity:** LOW
**Fix Applied:** `src/lib/adminAuth.ts` now uses `startsWith('auth-token')` instead of `includes('auth-token')` for cookie name matching, making the check more precise.
