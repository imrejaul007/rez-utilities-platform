# XF-2 — `rez_user_id` Spoofing via URL Query Param

**Date:** 2026-04-16
**Family:** XF-2
**Severity:** CRITICAL
**Spans:** AdBazaar → REZ backend

---

## The Problem

AdBazaar's QR scan endpoint accepts `rez_user_id` from a URL query parameter and passes it directly to the REZ backend API for coin crediting. This is a coin fraud vector — any attacker can credit coins to any REZ user account.

**Attack Vector:**

```
Attacker crafts: https://adbazaar.com/api/qr/scan/myslug?rez_user_id=VICTIM_UUID
Victim visits the URL (or is tricked into clicking)
REZ backend credits coins to VICTIM_UUID
Attacker repeats with different victim UUIDs
```

**Why it's a cross-repo issue:**

The REZ backend endpoint `/api/adbazaar/scan` trusts the `rez_user_id` sent by AdBazaar. AdBazaar is supposed to pass the authenticated user's ID, but there's no mechanism to verify the ID belongs to the requester.

---

## Affected Code

**AdBazaar (attacker-controlled input):**
- `src/app/api/qr/scan/[slug]/route.ts:72` — extracts `rez_user_id` from URL params

```typescript
const rezUserId = req.nextUrl.searchParams.get('rez_user_id')
// ...
body: JSON.stringify({
  rezUserId, // <-- attacker-controlled
  merchantId: qr.rez_merchant_id,
  coinsAmount: qr.coins_per_scan,
})
```

**REZ backend (trusts input):**
- `rezbackend` `/api/adbazaar/scan` — receives `rez_user_id`, credits coins

---

## Root Cause Analysis

This is a **trust boundary violation** across two separate services:

1. **AdBazaar** (Supabase auth): The authenticated user is known server-side from the Supabase session cookie
2. **REZ backend** (JWT auth): The user is identified by `rez_user_id` in the API body
3. **Gap**: AdBazaar should send its own user ID (from Supabase session) and let REZ map to the REZ user, but instead AdBazaar blindly forwards the URL parameter

The parameter is needed for the **QR scan use case** where the user is not logged in — they scan a QR code and the `rez_user_id` must come from somewhere. The intended design is:
- Logged-in user: `rez_user_id` from Supabase session
- Anonymous user: `rez_user_id` passed as a parameter for first-time attribution

But there's no enforcement that the parameter matches the session.

---

## Fix Options

### Option A: Server-Side User Resolution (Recommended)

```
1. AdBazaar always resolves user server-side:
   - If logged in: extract from Supabase session cookie
   - If anonymous: generate anonymous token, store in localStorage, send as cookie

2. AdBazaar sends ONLY its own user identifier to REZ:
   - supabase_user_id: <Supabase UUID or anonymous token>

3. REZ backend maps supabase_user_id → rez_user_id via a lookup table or shared secret
```

### Option B: HMAC-Signed User Tokens

```
1. When a user logs into AdBazaar, generate a short-lived signed token:
   HMAC-SHA256(secret, user_id + timestamp) → token

2. Pass token instead of raw user_id to QR scan endpoint

3. REZ backend verifies HMAC before crediting coins
```

### Option C: REZ Backend ID Only (No Cross-Service Mapping)

```
1. Remove all REZ user ID references from AdBazaar client code

2. AdBazaar QR scan endpoint sends only:
   - supabase_user_id (from session)
   - QR slug / campaign ID
   - Scan metadata (IP, device fingerprint)

3. REZ backend owns all REZ user identity — REZ maps Supabase user to REZ user
```

---

## Implementation: Option A (Server-Side Resolution)

**AdBazaar — `src/app/api/qr/scan/[slug]/route.ts`**

```typescript
// Get user from Supabase session (server-side)
const supabase = createServerClient()
const { data: { user } } = await supabase.auth.getUser()

// If not logged in, generate anonymous token
const userId = user?.id ?? generateAnonymousToken(req)

// Call REZ API with server-resolved ID
const rezRes = await fetch(`${REZ_API_BASE_URL}/api/adbazaar/scan`, {
  method: 'POST',
  body: JSON.stringify({
    // Use server-resolved ID, NOT URL param
    supabaseUserId: userId,
    merchantId: qr.rez_merchant_id,
    coinsAmount: qr.coins_per_scan,
    // Include for fraud detection
    ipAddress: ip,
    userAgent: req.headers.get('user-agent'),
    timestamp: new Date().toISOString(),
  })
})
```

**REZ backend — `/api/adbazaar/scan`**

```typescript
// Accept supabaseUserId, not rezUserId
const { supabaseUserId, merchantId, coinsAmount, ipAddress, userAgent, timestamp } = req.body

// Validate signature (if using HMAC) or lookup
const resolvedUserId = await resolveUserId(supabaseUserId, ipAddress, userAgent)
if (!resolvedUserId) {
  return res.status(400).json({ error: 'invalid_user_mapping' })
}

// Now credit coins to the resolved REZ user
await creditCoins(resolvedUserId, merchantId, coinsAmount, {
  source: 'adbazaar_qr_scan',
  scanTimestamp: timestamp,
  ipAddress,
})
```

---

## Effort Estimate

| Task | Effort | Priority |
|------|--------|----------|
| Remove `rez_user_id` from URL param usage | 30 min | CRITICAL |
| Add server-side Supabase session extraction | 1 hour | CRITICAL |
| Add HMAC signature to cross-service calls | 2 hours | CRITICAL |
| REZ backend: update `/api/adbazaar/scan` to accept new format | 2 hours | CRITICAL |
| Anonymous user token generation + storage | 2 hours | HIGH |
| IP/device fingerprint logging for fraud detection | 1 hour | HIGH |

**Total: ~9 hours (requires coordinated deploy of both AdBazaar + REZ backend)**
