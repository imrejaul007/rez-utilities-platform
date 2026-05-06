# ReZ NoW — Remediation Plan

**116 issues. ~105 hours estimated. Phased by severity and dependency.**

---

## Phase 0: Quick Wins (0-4 hours)

**No dependencies. Safe to do immediately.**

| ID | Issue | Fix | Est |
|----|-------|-----|-----|
| NW-CRIT-014 | Tokens in plain localStorage | Store in httpOnly cookies | 2h |
| NW-MED-001 | showToast called with object | Fix to positional args | 15m |
| NW-MED-003 | Rating no range validation | Add `rating < 1 \|\| rating > 5` guard | 10m |
| NW-MED-024 | localId uses Date.now() | Replace with crypto.randomUUID() | 10m |
| NW-MED-031 | console.log in Socket hooks | Replace with telemetry logger | 20m |
| NW-LOW-002 | PromoBanner arbitrary bgColor | Whitelist Tailwind classes | 15m |
| NW-LOW-010 | STATUS_COLOUR misspelling | Fix to STATUS_COLORS | 5m |
| NW-LOW-011 | Duplicate CouponInput | Consolidate to one file | 15m |
| NW-LOW-022 | coinsDone in useEffect deps | Use useRef instead | 10m |
| NW-LOW-023 | relativeTime off-by-one | Fix conditional ordering | 15m |

**Phase 0 Total: ~4 hours | Impact: 10 issues resolved**

---

## Phase 1: CRITICAL Financial Security (4-16 hours)

**Real money is at risk. These must ship with the next deployment.**

### NW-CRIT-001: Fix idempotency keys (HIGHEST PRIORITY)
- **Time:** 1h
- **Change:** `lib/api/client.ts:73-75` — remove `Date.now()` from `makeIdempotencyKey`
- **Impact:** Prevents double coin credit on every network retry
- **Test:** Simulate network timeout on payment confirm, verify coins credited once

### NW-CRIT-002: Fix payment verification
- **Time:** 2h
- **Changes:**
  - `app/[storeSlug]/pay/checkout/page.tsx:157` — capture `response.razorpay_signature`
  - `lib/api/payment.ts:39` — extract `data.data?.verified` from backend
  - `lib/api/scanPayment.ts:27` — same for scan payment
- **Test:** Verify fake signature is rejected, real signature is accepted

### NW-CRIT-003: Add merchant auth to middleware
- **Time:** 2h
- **Change:** `middleware.ts:14` — add `/merchant` to `PROTECTED_PATHS`
- **Add:** Store ownership verification in merchant API routes
- **Test:** Verify unauthenticated access to `/merchant/*` returns 401

### NW-CRIT-006: Fix payment timeout — no fake success
- **Time:** 3h
- **Changes:**
  - `lib/hooks/usePaymentConfirmation.ts` — after timeout, set `phase: 'uncertain'`, not `confirmed`
  - `app/[storeSlug]/pay/confirm/[paymentId]/page.tsx` — show "Payment may still be processing" for uncertain state
  - Add "Check payment status" button that polls backend
- **Test:** Simulate 10s timeout, verify user sees "still processing" not "success"

### NW-CRIT-007: Fix offline queue silent discard
- **Time:** 2h
- **Changes:**
  - `lib/utils/offlineQueue.ts` — emit `rez:order-sync-failed` event before delete
  - Add banner component that listens for this event
  - Show persistent banner: "Order couldn't be synced"
- **Test:** Block network, place order, wait for 3 retries, verify banner appears

### NW-CRIT-008: Fix pay-display API paths
- **Time:** 1h
- **Change:** `app/[storeSlug]/merchant/pay-display/PayDisplayClient.tsx:54` — fix URL paths
- **Test:** Confirm/reject actions should return 200, not 404

### NW-CRIT-009: Fix reorder price:0 bug
- **Time:** 2h
- **Changes:**
  - `app/orders/OrderHistoryClient.tsx:271` — preserve original `price` from order response
  - Use `item.menuItemId` not `item.name` for `itemId`
  - `lib/api/reorder.ts` — validate items have required fields before adding to cart
- **Test:** Reorder a ₹500 order, verify cart shows ₹500, not ₹0

### NW-CRIT-011: Fix coupon enumeration
- **Time:** 2h
- **Changes:**
  - `lib/api/coupons.ts` — require auth for `getStoreCoupons`
  - Add CAPTCHA trigger after 3 failed `validateCoupon` attempts
  - Rate limit per user per hour
- **Test:** Attempt 10 rapid coupon codes, verify rate limiting kicks in

### NW-CRIT-012: Fix UPI socket subscription
- **Time:** 2h
- **Changes:**
  - `components/checkout/PaymentOptions.tsx:95` — call backend UPI intent endpoint first
  - Subscribe using the returned `paymentId`, not `razorpayOrderId`
- **Test:** Complete a UPI payment, verify "Payment Successful" appears without timeout

### NW-CRIT-013: Add NFC user confirmation
- **Time:** 2h
- **Changes:**
  - `app/[storeSlug]/pay/checkout/page.tsx:182` — show confirmation dialog before order creation
  - Add check for existing pending orders before creating new ones
- **Test:** Tap NFC tag, verify confirmation dialog appears before order creation

**Phase 1 Total: ~16 hours | 12 CRITICAL issues resolved**

---

## Phase 2: HIGH — Before Public Launch (20-30 hours)

### Socket Architecture Overhaul (8h)
| ID | Issue | Fix |
|----|-------|-----|
| NW-CRIT-004 | N Socket connections per menu | Create shared Socket.IO context per store |
| NW-HIGH-011 | Pay-display socket stale dedup | Use ref for dedup checking |
| NW-MED-008 | Socket not cleaned up on modal close | Call disconnect() on modal close |
| NW-MED-009 | Socket connect failure silent | Add connectionFailed state + user feedback |
| NW-MED-010 | Multiple sockets on rapid open/close | Always disconnect before reconnect |
| NW-LOW-001 | crypto.randomUUID in SSR | Use React useId() hook |

### Type Canonicalization (6h)
| ID | Issue | Fix |
|----|-------|-----|
| NW-HIGH-005 | BillStatus enum inconsistency | Define canonical PaymentStatus enum |
| NW-HIGH-012 | OrderHistoryItem duplicate | Delete duplicate, use canonical type |
| NW-HIGH-013 | cancelOrder endpoint path | Consolidate to one endpoint |
| NW-MED-004 | Status string case mismatch | Normalize at Axios response interceptor |
| NW-MED-005 | Coupon/AvailableCoupon mismatch | Single Coupon interface |
| NW-XREP-001-017 | All cross-repo type mismatches | Import from packages/shared-types/ |

### Financial & Auth Hardening (8h)
| ID | Issue | Fix |
|----|-------|-----|
| NW-CRIT-005 | Waiter endpoints unauthenticated | authClient + store-scoped JWT |
| NW-HIGH-007 | redeemStamps no idempotency key | Add makeIdempotencyKey |
| NW-HIGH-008 | Checkout coupon client-side only | Server re-validation at checkout |
| NW-HIGH-009 | Client-side prices manipulatable | Backend re-validates from catalog |
| NW-HIGH-010 | WaiterCallStatus wrong field | Fix nested path extraction |
| NW-HIGH-014 | verifyPayment no idempotency key | Add Idempotency-Key header |
| NW-HIGH-015 | pending_payment not in STATUS_STEPS | Add as first step or dedicated UI |
| NW-MED-029 | OTP no rate limiting | 30s client-side cooldown |

### Data & Sync Fixes (4h)
| ID | Issue | Fix |
|----|-------|-----|
| NW-HIGH-002 | applyCode undefined crash | Rename inner function |
| NW-HIGH-003 | ReservationSuggestion wrong endpoint | Use createReservation from lib/api |
| NW-MED-011 | Cart cleared without confirmation | Add confirmation dialog |
| NW-MED-012 | authStore isLoggedIn desync | Derive from token presence |
| NW-MED-007 | WalletBalance rupees ambiguity | Always compute from coins |
| NW-MED-013 | Coupon discountValue unit | Add JSDoc clarification |

### Missing Features (4h)
| ID | Issue | Fix |
|----|-------|-----|
| NW-HIGH-001 | ServicesCatalog/AppointmentsCatalog placeholders | Implement or gate behind feature flag |

**Phase 2 Total: ~30 hours | 15 HIGH + 18 MEDIUM issues resolved**

---

## Phase 3: MEDIUM — UX & Performance (25-35 hours)

### UX Polish (10h)
| ID | Issue |
|----|-------|
| NW-MED-014 | UPI 2s fallback too aggressive → increase to 15s |
| NW-MED-018 | UPI retry doesn't distinguish timeout vs failure |
| NW-MED-019 | No minimum amount guard |
| NW-MED-020 | OffersModal Apply not disabled when below minimum |
| NW-MED-022 | getFeaturedStores silent failure cached 5 min |
| NW-MED-032 | SearchHighlight only highlights first |
| NW-MED-033 | Checkout page flash before redirect |
| NW-MED-034 | Waiter cooldown bypassable via multi-tab |
| NW-MED-035 | Cancel reason silent fallback to 'Other' |

### Performance (8h)
| ID | Issue |
|----|-------|
| NW-MED-015 | Razorpay script on every page mount → lazy load |
| NW-MED-016 | OffersModal re-fetches on every open → cache 5min |
| NW-MED-017 | search.ts uses raw fetch → use Axios deduplication |
| NW-CRIT-010 | ScanPayOrderResponse.paymentId doesn't exist |

### Error Handling (7h)
| ID | Issue |
|----|-------|
| NW-MED-002 | reorder.ts silently swallows errors |
| NW-MED-026 | Offline queue no TTL |
| NW-MED-021 | printReceipt browser fallback corrupts binary data |
| NW-MED-023 | SplitBillModal allows 0/negative |
| NW-MED-025 | NFC data no validation |
| NW-MED-027 | getScanPayHistory returns untyped |
| NW-MED-028 | auth.ts API paths inconsistent |

### Architecture (5h)
| ID | Issue |
|----|-------|
| NW-MED-006 | cancelOrder no idempotency key |
| NW-MED-030 | BillBuilderStore no persistence |
| NW-LOW-003 | DeliveryAddress defined twice |
| NW-LOW-004 | Wallet/orders pages duplicate auth check |
| NW-LOW-018 | MultiStoreAnalytics ignores selectedOutlet |
| NW-LOW-019 | Chat metadata.items cast without type guard |
| NW-LOW-021 | cancelOrder refund field without optional chaining |

**Phase 3 Total: ~30 hours | 35 MEDIUM issues resolved**

---

## Phase 4: LOW — Backlog (10-15 hours)

All 25 LOW issues from `04-LOW.md`.

| ID | Issue |
|----|-------|
| NW-LOW-005 | roundUpRupees name misleading |
| NW-LOW-006 | TIER_CONFIG no fallback |
| NW-LOW-007 | isUPIAvailable UA detection unreliable |
| NW-LOW-008 | formatINRCompact inconsistent decimals |
| NW-LOW-009 | redeemStamps throws on non-2xx |
| NW-LOW-012 | Scan-pay coin formula 100x smaller |
| NW-LOW-013 | Bill Builder zero-price items |
| NW-LOW-014 | Bill Builder negative discount |
| NW-LOW-015 | Geolocation timeout no fallback |
| NW-LOW-016 | PaymentOptions no disabled state |
| NW-LOW-017 | Merchant layout swallows auth errors |
| NW-LOW-020 | useTrack error ignored |
| NW-LOW-024 | Razorpay key ID not validated |
| NW-LOW-025 | hasPIN returned but unused |
| NW-LOW-001 | crypto.randomUUID SSR guard (moved from Phase 2) |
| NW-LOW-010 | STATUS_COLOUR typo (moved from Phase 0) |
| NW-LOW-011 | Duplicate CouponInput (moved from Phase 0) |
| NW-LOW-022 | coinsDone in deps (moved from Phase 0) |
| NW-LOW-023 | relativeTime off-by-one (moved from Phase 0) |

**Phase 4 Total: ~15 hours | 25 LOW issues resolved**

---

## Summary

| Phase | Issues | Hours | Focus |
|-------|--------|-------|-------|
| Phase 0 | 10 | 4h | Quick wins |
| Phase 1 | 12 | 16h | CRITICAL financial security |
| Phase 2 | 33 | 30h | HIGH + architecture overhaul |
| Phase 3 | 60 | 40h | MEDIUM UX/performance |
| Phase 4 | 50 | 20h | LOW backlog |
| **TOTAL** | **139** | **~110h** | |

**Recommendation:** Do Phase 0 + Phase 1 in the same sprint (20h). Ship. Then Phase 2 in sprint 2. Phase 3 and 4 can run in parallel with other development work.

---

## Cross-Sevice Fixes Needed (From Other Audits)

These REZ-NOW issues interact with bugs in other repos. Fix together:

| REZ-NOW Issue | Related Issue | Repo |
|---------------|--------------|------|
| NW-CRIT-001 (idempotency) | XF-1 (fire-and-forget coins) | 09-CROSS-SERVICE-2026 |
| NW-CRIT-002 (payment verify) | BE-PAY-009 (no backend verification) | docs/Bugs/BACKEND-PAYMENT.md |
| NW-CRIT-003 (merchant auth) | A10-C1 (socket doesn't invalidate cache) | 08-REZ-ADMIN |
| NW-HIGH-009 (client prices) | Consumer app price manipulation | 06-CONSUMER-AUDIT-2026 |
| NW-XREP-002 (status enums) | ENUM-FRAGMENTATION | 09-CROSS-SERVICE-2026 |
| NW-XREP-001-017 (type drift) | TYPE-DRIFT-MATRIX | 09-CROSS-SERVICE-2026 |
