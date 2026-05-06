# ReZ NoW — Systemic Root Diseases

**These 6 architectural diseases cause most of the 89 issues. Fix the root, fix the branches.**

---

## SYS-ROOT-001: No canonical types in shared-types package

**Appears in:** NW-CRIT-002, NW-CRIT-005, NW-CRIT-008, NW-CRIT-010, NW-HIGH-005, NW-HIGH-012, NW-HIGH-013, NW-XREP-001 through NW-XREP-017

**Root Cause:** REZ-NOW defines its own `OrderHistoryItem`, `Coupon`, `WebOrderStatus`, `BillStatus`, `WalletBalance` types locally. `packages/shared-types/` exists but is not imported. Every app defines its own version of the same types, and they inevitably drift.

**Evidence:**
- `lib/types/index.ts` has 5 type definitions that exist independently in `packages/shared-types/`
- `OrderHistoryItem` is defined twice within REZ-NOW itself (`lib/types/index.ts:164` and `lib/api/orderHistory.ts:3`)
- `Coupon` vs `AvailableCoupon` — two incompatible interfaces for the same concept

**Fix:** Import all canonical types from `packages/shared-types/`. Add a build-time check that verifies all types match. Enforce via ESLint: no `interface.*` or `type.*` definitions for known canonical types.

---

## SYS-ROOT-002: Frontend computes what the backend should own

**Appears in:** NW-CRIT-001, NW-CRIT-002, NW-CRIT-006, NW-CRIT-007, NW-HIGH-007, NW-HIGH-008, NW-HIGH-009, NW-MED-007

**Root Cause:** Financial calculations (coin credits, discounts, payment verification) are partly in the frontend when they should be entirely in the backend. The frontend sends `subtotal`, `orderNumber`, `tipAmount` to the backend — the backend trusts these instead of recomputing from canonical sources.

**Evidence:**
- `createRazorpayOrder` sends client-side `subtotal` from localStorage-persisted cart prices (NW-HIGH-009)
- `verifyPayment` hardcodes `verified: true` instead of trusting the backend's cryptographic verification (NW-CRIT-002)
- Client-side `applyCode` validates coupons against cached list without server re-validation (NW-HIGH-008)
- `creditCoins` sends user-supplied `orderNumber` — backend must trust it (NW-HIGH-007)

**Fix:** Backend is the sole source of truth for all financial calculations. Frontend sends intent; backend computes result. Frontend never computes coin amounts, discounts, or payment verification.

---

## SYS-ROOT-003: Fire-and-forget for financial operations

**Appears in:** NW-CRIT-001, NW-CRIT-007, NW-HIGH-007, NW-HIGH-014, NW-MED-006, NW-MED-026

**Root Cause:** Coin credits, order submissions, and cancellations are sent as async calls with no retry, no DLQ, no compensating transaction. The `offlineQueue` retries 3 times then silently discards. The idempotency key is broken (uses `Date.now()`).

**Evidence:**
- `creditCoins` has a broken idempotency key → double credit on retry (NW-CRIT-001)
- `creditScanPayCoins` has a broken idempotency key → double credit on retry (NW-CRIT-001)
- Offline queue silently discards after 3 retries (NW-CRIT-007)
- `redeemStamps` has no idempotency key (NW-HIGH-007)
- `cancelOrder` has no idempotency key (NW-MED-006)

**Fix:** Fix idempotency keys (remove `Date.now()`). Add DLQ for failed financial operations. Add compensating transactions for partial failures.

---

## SYS-ROOT-004: Real-time state bypasses server-state validation

**Appears in:** NW-CRIT-004, NW-CRIT-006, NW-CRIT-012, NW-HIGH-011, NW-MED-008, NW-MED-009, NW-MED-010

**Root Cause:** Socket.IO events update UI state without server validation. The payment confirmation page trusts the socket event instead of polling the backend. Socket subscriptions accumulate across navigation. No centralized Socket.IO connection management.

**Evidence:**
- `usePaymentConfirmation` subscribes to a socket with no auth token (NW-CRIT-004)
- 10-second timeout triggers fake success UI without server verification (NW-CRIT-006)
- UPI payment subscribes to wrong room ID (NW-CRIT-012)
- Each `MenuItem` creates its own Socket.IO connection (NW-CRIT-004)
- Socket subscriptions persist across navigation (NW-MED-008)

**Fix:** Create a single shared Socket.IO connection per store via React context. All components subscribe to the shared connection. Add auth token to handshake. Verify payment status with backend on socket events, don't trust socket alone.

---

## SYS-ROOT-005: No auth protection at the route layer for merchant features

**Appears in:** NW-CRIT-003, NW-CRIT-005, NW-CRIT-013, NW-HIGH-003, NW-MED-029

**Root Cause:** The middleware `PROTECTED_PATHS` array doesn't include `/merchant/*` routes. Merchant-specific API calls use `publicClient` (no auth). Waiter call endpoints are fully public. NFC order creation requires no confirmation.

**Evidence:**
- `middleware.ts:14` — `PROTECTED_PATHS` omits `/merchant/*` (NW-CRIT-003)
- `lib/api/waiter.ts` — `publicClient` with no auth (NW-CRIT-005)
- `lib/api/waiterStaff.ts` — `publicClient` with no store validation (NW-CRIT-005)
- NFC order creation requires no user confirmation (NW-CRIT-013)
- `sendOtp` has no rate limiting (NW-MED-029)

**Fix:** Add `/merchant` to `PROTECTED_PATHS`. Require role-scoped JWT for all merchant endpoints. Require user confirmation for NFC order creation. Add rate limiting to OTP.

---

## SYS-ROOT-006: No type enforcement at the frontend-backend boundary

**Appears in:** NW-CRIT-002, NW-CRIT-008, NW-CRIT-010, NW-HIGH-005, NW-HIGH-012, NW-HIGH-013, NW-XREP-001 through NW-XREP-017

**Root Cause:** The Axios client returns `data` as `any`. There's no Zod validation at the API boundary. Types are defined locally and may not match what the backend actually returns. Error responses are cast the same way as success responses.

**Evidence:**
- `getScanPayHistory` returns `data.data as unknown` — no type (NW-MED-027)
- `verifyPayment` trusts `data.success` without validating the response shape (NW-CRIT-002)
- `PayDisplayClient` uses its own `PendingPayment` type not matching `BillStatus` (NW-HIGH-005)
- `OrderHistoryItem` in the API layer uses `status: string` instead of `WebOrderStatus` (NW-HIGH-012)
- `redeemStamps` throws on error response without try/catch (NW-LOW-009)

**Fix:** Add Zod validation at the API client layer. Validate all responses before returning them. Use `safeParse` instead of `as` casting everywhere. Reject responses that don't match the expected schema.

---

## Root Cause → Bug Count Mapping

| Root Cause | Issues Directly Caused | % of Total |
|-----------|----------------------|------------|
| SYS-ROOT-001 (No shared types) | 18 | 20% |
| SYS-ROOT-002 (Frontend computes financial) | 8 | 9% |
| SYS-ROOT-003 (Fire-and-forget financial) | 10 | 11% |
| SYS-ROOT-004 (Real-time bypass) | 7 | 8% |
| SYS-ROOT-005 (No merchant auth) | 5 | 6% |
| SYS-ROOT-006 (No type enforcement) | 14 | 16% |
| Other / Isolated | 27 | 30% |
| **Total** | **89** | **100%** |

**Conclusion:** Fix SYS-ROOT-001, SYS-ROOT-003, and SYS-ROOT-006 first. They collectively cause 47% of all issues (42 out of 89).
