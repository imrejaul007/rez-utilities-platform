# ReZ NoW — Cross-Service Gap Analysis

**How REZ-NOW's 89 issues map to issues in other repos. These are the bridges that break across service boundaries.**

---

## Cross-Service Impact Matrix

**Which REZ-NOW issues cause cascading failures across other services:**

| REZ-NOW Issue | Cascades To | Impact | Severity |
|---------------|------------|--------|----------|
| NW-CRIT-001 (broken idempotency) | Backend wallet ledger | Double coin credit → ledger imbalance | CRITICAL |
| NW-CRIT-002 (fake payment verification) | Payment service, wallet | Fake payments credited without signature verification | CRITICAL |
| NW-CRIT-005 (unauth waiter) | Merchant service | Any user can call/cancel waiter at any store | CRITICAL |
| NW-CRIT-011 (coupon enumeration) | Coupon service | Valid high-value codes stolen via brute force | CRITICAL |
| NW-CRIT-014 (localStorage tokens) | All services | XSS → full account takeover across all services | CRITICAL |
| NW-HIGH-007 (no redeemStamps idempotency) | Karma service | Double reward codes generated | HIGH |
| NW-HIGH-009 (client prices) | Payment service, catalog | User underpays → merchant revenue loss | HIGH |
| NW-MED-002 (reorder silent fail) | Order service, catalog | Reorder fails silently → user thinks order placed | MEDIUM |
| NW-MED-029 (OTP rate limit) | Auth service | SMS spam → provider costs, user harassment | MEDIUM |

---

## REZ-NOW vs Other Repos: Side-by-Side Comparison

### Payment Flow

| Aspect | REZ-NOW | rez-payment-service | rez-app-consumer | Severity |
|--------|---------|---------------------|-----------------|---------|
| Idempotency keys | Uses Date.now() — BROKEN | Backend expects stable keys | May have its own implementation | CRITICAL |
| Payment verification | Hardcoded true | `verifyPayment` should verify | May skip verification | CRITICAL |
| Coin credit on payment | `creditCoins` with broken key | Must use idempotency | `creditCoins` with its own key | HIGH |
| Razorpay signature | Never captured | Cannot verify | Should capture but may not | HIGH |
| Payment timeout | 10s → fake success | Backend has longer timeout | May differ | HIGH |
| Order amount | Client-supplied | Should validate from catalog | Should validate from catalog | HIGH |

### Coin System

| Aspect | REZ-NOW | rez-finance-service | rez-app-consumer |
|--------|---------|---------------------|-----------------|
| Coin credit formula | `rupees/10 * rate` (buggy) | Canonical formula | May differ |
| Scan-pay vs checkout | Different formulas | Single source | Single source |
| Loyalty redemption | `redeemStamps` no idempotency | Should have idempotency | May differ |
| Wallet balance | `coins/rupees/tier` | Multi-coin ledger | May differ |

**Gap:** REZ-NOW scan-pay formula is 100x smaller than checkout formula. The `rez-finance-service` likely has a canonical formula. REZ-NOW doesn't use it.

### Auth & Session

| Aspect | REZ-NOW | rez-auth-service | rez-app-consumer |
|--------|---------|-----------------|-----------------|
| Token storage | localStorage (XSS risk) | httpOnly cookies preferred | May differ |
| Token refresh | Queue with broken failures | Standard JWT | May differ |
| Session validity | `isLoggedIn` persisted | JWT expiry | May differ |
| OTP rate limiting | No client-side cooldown | Should enforce | May differ |

**Gap:** REZ-NOW tokens in localStorage vs httpOnly cookies in other services. Any XSS in REZ-NOW gives attacker full session access.

### Order Status

| Aspect | REZ-NOW | rez-order-service | rez-app-consumer |
|--------|---------|-------------------|-----------------|
| Status values | `'pending_payment'` | `PENDING_PAYMENT` | May differ |
| Status normalization | Per-component | API-level | Per-component |
| Terminal detection | `TERMINAL_STATUSES` array | API-level | May differ |
| Polling timeout | Hardcoded values | Should be config | May differ |

**Gap:** Status string case mismatch. REZ-NOW uses lowercase; backend uses UPPERCASE. If the backend ever changes, string comparisons silently fail.

### Real-Time (Socket.IO)

| Aspect | REZ-NOW | rez-app-consumer | rez-merchant-service |
|--------|---------|-----------------|---------------------|
| Connection per component | YES — broken | Should be shared | Should be shared |
| Auth token in handshake | NO | May differ | May differ |
| Room naming | `payment:${id}` | Different pattern | Different pattern |
| Subscription cleanup | NO | May differ | May differ |
| Payment confirmation | 10s timeout → fake | May differ | May differ |

**Gap:** REZ-NOW has one Socket.IO connection per MenuItem (NW-CRIT-004). `rez-app-consumer` and `rez-merchant-service` likely have the same architectural issue.

### Merchant Features

| Aspect | REZ-NOW | rez-merchant-service | rez-app-admin |
|--------|---------|---------------------|---------------|
| Route protection | NONE for /merchant/* | API-level auth | Middleware |
| Pay-display confirm path | `/store/{paymentId}/` WRONG | `/store/{storeSlug}/payments/{id}/` | Should match |
| Waiter endpoints | publicClient (no auth) | authClient | Should be auth |
| Reconcile amounts | Unit ambiguity (paise vs rupees) | Should be paise | Should be paise |

**Gap:** REZ-NOW pay-display uses wrong API paths (NW-CRIT-008). The merchant service likely doesn't handle the wrong paths gracefully → 404.

### Type Contracts

| Type | REZ-NOW | packages/shared-types | Consumer App | Status |
|------|---------|---------------------|-------------|--------|
| `OrderStatus` | lowercase union | Should exist | May differ | DRIFTED |
| `Coupon` | `minOrderValue` | Should exist | `minOrderAmount` | DRIFTED |
| `WebOrderStatus` | Custom | Should exist | Custom | DRIFTED |
| `WalletBalance` | `coins/rupees/tier` | Should exist | `balance/coins/tier` | DRIFTED |
| `IdempotencyKey` | `${type}:${key}:${Date.now()}` | Should be `${type}:${key}` | May differ | BROKEN |

**Gap:** Every type that should be canonical is defined independently in each app. They drift over time.

---

## Fire-and-Forget Chain: Where Money Gets Lost

```
User pays → REZ-NOW creditCoins() → [network timeout] → RETRY with NEW idempotency key
                                                                    ↓
                                              Backend receives DIFFERENT key → processes AGAIN
                                                                    ↓
                                                    User gets DOUBLE coin credit
                                                                    ↓
                                              Wallet ledger shows +2x coins for 1x payment
                                                                    ↓
                                              Merchant reports discrepancy
                                                                    ↓
                                              Support ticket opened
```

This chain exists in REZ-NOW (NW-CRIT-001) AND in AdBazaar (AB-C4 — no idempotency key on booking) AND in the backend payment service (BE-PAY-025 — concurrent webhook could double-credit).

**Fix once, fix everywhere:** Fix `makeIdempotencyKey` in REZ-NOW, then apply the same pattern to all other services.

---

## Duplicate Issues Across Repos

**The same bug exists in multiple places — fix once in shared-types/canonical:**

| Issue Pattern | REZ-NOW | Consumer App | Merchant App | Backend |
|--------------|---------|-------------|-------------|---------|
| Idempotency key broken | NW-CRIT-001 | GEN-11 NA-CRIT-07 | ? | BE-PAY-025 |
| Payment hardcoded true | NW-CRIT-002 | GEN-11 NA-CRIT-04 | ? | BE-PAY-009 |
| localStorage tokens | NW-CRIT-014 | GEN-11 NA-CRIT-11 | ? | ? |
| Coupon enumeration | NW-CRIT-011 | GEN-11 ? | ? | BE-PAY-?? |
| No server-side price validation | NW-HIGH-009 | GEN-11 NA-CRIT-02 | ? | ? |
| Status enum case mismatch | NW-HIGH-005 | GEN-11 XREP-?? | ? | GEN-1-7 ENUM |
| Type defined in 3 places | NW-HIGH-012 | GEN-11 RC-20 | GEN-10 RC-15 | GEN-1-7 RC-1 |
| Socket-per-component | NW-CRIT-004 | GEN-11 ? | GEN-10 A10-C1 | ? |
| Fire-and-forget coins | NW-CRIT-001 | GEN-11 XF-1 | GEN-10 XF-1 | BE-PAY-025 |
| Merchant routes unprotected | NW-CRIT-003 | GEN-11 ? | GEN-10 A10-C6 | ? |
| Waiter endpoints no auth | NW-CRIT-005 | GEN-11 ? | GEN-10 ? | ? |

---

## Unified Fix Plan: Cross-Service

### Fix 1: Idempotency Keys (1 hour)
Fix `makeIdempotencyKey` in REZ-NOW (`lib/api/client.ts`). Apply the same fix pattern to `rez-app-consumer`, `rez-merchant-service`, and `rez-payment-service`.

**Files to change:**
- REZ-NOW: `lib/api/client.ts:73`
- Consumer app: Likely in API client
- Backend: `rez-payment-service`, `rez-wallet-service`

**Impact:** Prevents double coin credit across the entire platform.

### Fix 2: Payment Verification (2 hours)
Fix `verifyPayment` to capture `razorpay_signature` and extract `data.data?.verified` in REZ-NOW. Ensure the backend (`rez-payment-service`) returns `{ verified: boolean }`.

**Files to change:**
- REZ-NOW: `lib/api/payment.ts`, `app/[storeSlug]/pay/checkout/page.tsx`
- Backend: `rez-payment-service` must return `{ verified: boolean }`

**Impact:** Cryptographic payment verification across all payment flows.

### Fix 3: Auth Token Storage (3 hours)
Migrate tokens from localStorage to httpOnly cookies. Apply to REZ-NOW and consumer app.

**Files to change:**
- REZ-NOW: `lib/api/client.ts:37-51`, `lib/store/authStore.ts`
- Consumer app: auth store

**Impact:** Prevents XSS-based account takeover across all apps.

### Fix 4: Merchant Route Protection (2 hours)
Add `/merchant/*` to `PROTECTED_PATHS` in REZ-NOW middleware. Verify merchant service has store ownership checks.

**Files to change:**
- REZ-NOW: `middleware.ts`
- Backend: `rez-merchant-service` auth middleware

**Impact:** Closes the merchant panel takeover vulnerability.

### Fix 5: Socket.IO Architecture (8 hours)
Create a shared Socket.IO context per store. Apply to REZ-NOW, consumer app, and merchant service.

**Files to change:**
- REZ-NOW: `components/menu/MenuItem.tsx`, create `lib/contexts/SocketContext.tsx`
- Consumer app: Apply same pattern
- Merchant service: Apply same pattern

**Impact:** Fixes N-connection-per-component across 3 apps.

### Fix 6: Canonical Types (16 hours)
Define all canonical types in `packages/shared-types/`. Replace all local type definitions in REZ-NOW, consumer app, and backend.

**Types to canonicalize:**
- `OrderStatus` — lowercase vs UPPERCASE
- `WebOrderStatus` — per-app vs canonical
- `Coupon` — `minOrderValue` vs `minOrderAmount`
- `WalletBalance` — divergent fields
- `PaymentStatus` — inconsistent union
- `IdempotencyKey` — broken vs correct

**Files to change:** All apps, all backend services

**Impact:** Eliminates type drift. Fixes NW-HIGH-005, NW-HIGH-012, NW-HIGH-013, and 17+ cross-repo type mismatches.

---

## Cross-Service Dependency Map

```
REZ-NOW depends on:
  ├── rez-payment-service   ← payment processing, signature verification
  ├── rez-order-service    ← order creation, status updates
  ├── rez-wallet-service   ← coin credits, wallet balance
  ├── rez-karma-service    ← loyalty, stamps, rewards
  ├── rez-auth-service     ← OTP, token refresh
  ├── rez-catalog-service  ← menu items, prices
  ├── rez-merchant-service ← waiter calls, pay-display
  └── packages/shared-types ← type definitions (currently NOT imported)
```

**Key finding:** REZ-NOW does NOT import from `packages/shared-types/`. Every type is defined locally. This is the root cause of 40%+ of the cross-repo type mismatches.

---

## Status: OPEN

All cross-service gap analysis items are OPEN pending fixes in each respective service.

Cross-references:
- Full cross-repo matrix: `09-CROSS-SERVICE-2026/CROSS-REPO-ANALYSIS.md`
- Money atomicity: `09-CROSS-SERVICE-2026/MONEY-ATOMICITY.md`
- Enum fragmentation: `09-CROSS-SERVICE-2026/ENUM-FRAGMENTATION.md`
- Fire-and-forget: `09-CROSS-SERVICE-2026/XF-1-FIRE-AND-FORGET.md`
