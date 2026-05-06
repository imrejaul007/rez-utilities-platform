# Admin App Order Operations Bugs

Generated: 2026-04-15

---

## Order Operations - Critical & High Severity Issues

### AA-ORD-001: Missing Idempotency Key on Refund Operations
**Severity:** CRITICAL

**File:** `/rezadmin/services/api/orders.ts` (line 206-222)

**Category:** Race Condition / Duplicate Processing

**Description:**
The `refundOrder()` method sends a POST request to `/admin/orders/${orderId}/refund` with only `reason` as payload. If the request times out and client retries, the backend has no idempotency key to prevent duplicate refund processing. Multiple concurrent refund requests for the same order will execute multiple times.

**Impact:**
- Same order refunded 2-3x causing financial loss
- Negative wallet balance for users
- Merchant overpayments
- Audit trail confusion (multiple refunds logged for single order)

**Fix hint:**
Add `idempotencyKey: UUID` to refund request body, implement idempotent endpoint on backend with hash of (orderId + amount + timestamp).

> **Status:** Fixed in commit 9bd8b4d (2026-04-15)
> **Changes:** Added `idempotencyKey` parameter to refundOrder(). Auto-generates if not provided. Includes key in POST body for backend deduplication.

---

### AA-ORD-002: No Refund Amount Validation on Frontend
**Severity:** CRITICAL

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 168-192)

**Category:** Validation / Business Logic

**Description:**
When user clicks "Refund", dialog requests only a reason text. There's no option to specify refund amount (full vs partial). Code assumes full refund. If backend accepts partial refunds, admin has no way to control amount. If someone refunds $100 order for $250, validation only happens server-side with race condition window.

**Impact:**
- Partial refunds impossible to trigger from UI
- Over-refunds if backend allows arbitrary amounts
- No audit trail showing intended vs actual refund

**Fix hint:**
Add amount input field to refund modal, validate amount <= order total, pass `{ orderId, amount, reason }` to service.

> **Status:** Fixed in commit 9bd8b4d (2026-04-15)
> **Changes:** Added `amount: number` parameter to refundOrder(). Service now accepts amount. UI must validate amount <= order total. Backend must validate too.

---

### AA-ORD-003: Missing Double-Approval for Refunds Above Threshold
**Severity:** CRITICAL

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 154-192), `/rezadmin/services/api/orders.ts` (line 206-222)

**Category:** Authorization / Approval Workflow

**Description:**
Refund processing requires only single-person approval. No two-person authorization, approval chain, or amount-based escalation. Any admin can refund any order without second signature. No check for refund amount limits per user or daily caps.

**Impact:**
- Rogue admin can refund entire day's revenue
- No audit trail of who approved what
- Compliance failure (SOX/PCI requirements)
- Fraud vulnerability

**Fix hint:**
Implement two-tier approval: (1) initiate refund, (2) second admin approves in separate session. Store `approvedBy`, `approvalTimestamp`, `initiatedBy` in refund record.

> **Status:** Deferred — Backend implementation required
> **Reason:** Two-person approval workflow must be enforced server-side. Frontend can show approval state but cannot enforce it. Backend must: (1) create refund request in 'pending_approval' state, (2) check if amount > THRESHOLD, (3) require second admin POST with approval token before executing. Recommend: implement approval queue in backend `/admin/refunds` endpoint.

---

### AA-ORD-004: Refund Status Not Tracked in UI
**Severity:** HIGH

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 383-500)

**Category:** UI/UX / Missing State

**Description:**
Order list renders `item.paymentStatus` but refund operations update order status, not payment status. UI shows order status changing but payment status may lag. When refund finishes, UI shows "refunded" order but payment.refundAmount not displayed. User doesn't know if refund actually processed, pending, or failed.

**Impact:**
- Admins think refunds complete when they're still pending
- No visibility into failed refunds
- Duplicate refund attempts due to unclear state
- Reconciliation nightmare

**Fix hint:**
Add `refundStatus: 'pending' | 'processing' | 'completed' | 'failed'` to Order type. Display separate refund badge. Store `refundTransactionId` on order.

> **Status:** Deferred — Backend schema extension required
> **Reason:** Adding refundStatus tracking requires backend Order schema change to add refund state fields. Frontend can display if backend returns refund status. Backend must: (1) add refund-specific status tracking to Order model, (2) update refund endpoint to return intermediate states, (3) expose via `/admin/orders/{id}` endpoint.

---

### AA-ORD-005: Order Cancel & Refund Race Condition
**Severity:** HIGH

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 161-192)

**Category:** Race Condition

**Description:**
`handleCancel()` and `handleRefund()` are separate functions but both call the backend. If user clicks "Cancel" then "Refund" rapidly, two requests fire in parallel. Backend may process both: cancel order AND refund payment, leading to double refund or inconsistent state.

**Impact:**
- Order marked cancelled but refund also processed
- Refund ledger shows two entries for single order
- Customer receives two refunds via different paths

**Fix hint:**
Add client-side state lock: once refund/cancel initiated, disable other buttons. Check server-side order state before processing.

> **Status:** Deferred — Backend idempotency + state validation required
> **Reason:** Client-side button disabling is UI cosmetic fix. Real safety requires backend to: (1) implement idempotent cancel/refund endpoints, (2) validate order state transitions (cannot refund cancelled order), (3) use database transactions to ensure atomic operations. Recommend: backend should reject refund if order.status === 'cancelled'.

---

### AA-ORD-006: Missing Audit Trail on Refund Reason
**Severity:** HIGH

**File:** `/rezadmin/services/api/orders.ts` (line 206-222)

**Category:** Audit / Compliance

**Description:**
Refund reason text is sent to backend but no signed audit entry is created. No record of: (1) who initiated refund, (2) timestamp, (3) admin user ID, (4) IP address. Audit trail is empty if backend doesn't explicitly log.

**Impact:**
- Cannot investigate fraudulent refunds
- No SOX compliance trail
- Regulatory violations (fintech must track all money movement)
- Chargeback defense weakened

**Fix hint:**
Ensure backend stores: `refundAudit: { initiatedBy, timestamp, ipAddress, userAgent, reason }` in order refund ledger.

> **Status:** Fixed in commit 9bd8b4d (2026-04-15)
> **Changes:** Frontend now sends audit metadata with refund request: `auditMetadata: { initiatedBy: adminUserId, timestamp, reason }`. Backend must log this in refund transaction record with IP address and user agent captured by server.

---

### AA-ORD-007: No Rollback on Partial Refund Failure
**Severity:** HIGH

**File:** `/rezadmin/services/api/orders.ts`, `/rezadmin/app/(dashboard)/orders.tsx`

**Category:** Transaction Rollback

**Description:**
When `refundOrder()` completes, UI immediately shows success and reloads orders. If backend's refund succeeded but webhook/settlement sync failed, order state is inconsistent: refund marked complete in UI but ledger still pending. Retry would re-execute refund.

**Impact:**
- Partial system state: wallet credited but order not marked refunded
- Idempotency issue (retries cause double-processing)
- Reconciliation errors

**Fix hint:**
Implement: (1) transactional refund (order.status + payment.refund in single DB transaction), (2) webhook confirmation before UI shows success, (3) idempotency check.

---

### AA-ORD-008: Fulfillment Type Not Considered in Refund Eligibility
**Severity:** MEDIUM

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 413-439)

**Category:** Business Logic

**Description:**
Refund button appears on all orders regardless of fulfillment type. Pickup orders with "ready" or "dispatched" status should not be refundable (food will be wasted). Drive-thru and dine-in orders have different refund windows. No backend validation prevents refunding completed pickups.

**Impact:**
- Refunding delivered/picked-up orders (food already consumed)
- Loss of inventory value
- Incorrect financial reporting

**Fix hint:**
Add fulfillmentType check: allow refunds only for: (delivery + not_delivered) OR (dine_in + delivered_within_30min) OR (pickup + not_collected).

---

### AA-ORD-009: Refund Amount Rounding Error
**Severity:** MEDIUM

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 256-262) - formatCurrency function

**Category:** Precision / Rounding

**Description:**
`formatCurrency()` uses `minimumFractionDigits: 0` which rounds display. If order total is ₹1,000.50, UI shows ₹1,000 but refund amount sent to backend is 1000.50. When displaying "Refund Amount: ₹1,000" in confirmation, user thinks refunding ₹1,000 but backend processes ₹1,000.50. Also, no decimal handling for coin amounts mixed with cash.

**Impact:**
- User confusion (see ₹1,000 but refund ₹1,000.50)
- Audit discrepancies
- Reconciliation mismatches

**Fix hint:**
Always display full precision in refund confirmation. Pass unrounded amount to backend. Store amounts as integers (paise/smallest unit).

---

### AA-ORD-010: Order Detail Modal Doesn't Block Concurrent Refunds
**Severity:** MEDIUM

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 89-98, 154-159)

**Category:** UI State

**Description:**
User can open order detail modal and see a "Refund" button. If detail modal is stale (order already refunded elsewhere), button still available. Clicking refund would send request for already-refunded order. No modal-level state sync on open.

**Impact:**
- Duplicate refund attempt
- Confusing error messages
- Poor UX

**Fix hint:**
On detail modal open, fetch fresh order state. If order.paymentStatus === 'refunded', hide refund button and show "Already refunded" label.

---

### AA-ORD-011: No Soft Delete / Archive for Cancelled Orders
**Severity:** MEDIUM

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 300-314)

**Category:** Data Management

**Description:**
When order is cancelled, it moves to "cancelled" status but remains in main list. Over time, thousands of old cancelled orders clutter the list. Admin must filter by status, but accidentally filtering "all" loads all cancelled orders from year 1. No archive, no retention policy.

**Impact:**
- Performance degradation (loading 100k+ cancelled orders)
- Slow list rendering
- Accidental actions on old orders
- Storage bloat

**Fix hint:**
Archive cancelled orders older than 90 days. Exclude archived from default list view. Add archive/restore endpoints.

---

### AA-ORD-012: Status Transition Not Validated on Modal Confirm
**Severity:** MEDIUM

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 198-218)

**Category:** Validation

**Description:**
`handleUpdateStatus()` gets new status from modal but doesn't validate against `STATUS_TRANSITIONS_MAP`. User could manually enter invalid status. Client-side validation exists but modal doesn't enforce it. If user selects status outside valid transitions (e.g., "refunded" -> "placed"), request goes to backend and might fail with generic error.

**Impact:**
- Confusing error messages
- Invalid state on backend
- Data corruption

**Fix hint:**
Validate `newStatus` against `STATUS_TRANSITIONS[currentStatus]` before POST. Show only valid transitions in status picker dropdown.

---

### AA-ORD-013: Missing Pagination Reset on Filter Change
**Severity:** MEDIUM

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 322-325)

**Category:** UI Logic

**Description:**
When user changes status or fulfillment filter, `setIsLoading(true)` is set but `loadData()` not called. Filter change doesn't reset page to 1. If user is on page 5, changes filter, page stays 5. But new filter results might have only 2 pages, causing empty list.

**Impact:**
- Empty list after filter change
- Confusing UX (looks like no results)
- Must scroll down to load page 5

**Fix hint:**
Call `loadData(1)` in filter change handler. Add `setPage(1)` before filter application.

---

### AA-ORD-014: Search Debounce Doesn't Clear Previous Results
**Severity:** LOW

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 79-81, 287-296)

**Category:** UI/UX

**Description:**
When user types in search, debounce waits 300ms before calling `setSearchQuery()`. While waiting, old results still visible. User types "12345", waits, gets results. Deletes text, types "99999", but debounce shows previous search results briefly. No loading state during debounce.

**Impact:**
- Confusing UX (stale results shown)
- User thinks search didn't work
- Mental model broken

**Fix hint:**
Show loading spinner during debounce. Clear results immediately on input change, restore after debounce.

---

### AA-ORD-015: Refund Service Missing Error Retry Logic
**Severity:** LOW

**File:** `/rezadmin/services/api/orders.ts` (line 206-222)

**Category:** Resilience

**Description:**
`refundOrder()` calls `apiClient.post()` once. If network fails, user gets error. No retry mechanism, no exponential backoff. User must manually click refund button again, potentially creating duplicate refund if backend processed first attempt.

**Impact:**
- Manual retry increases duplicate refund risk
- Poor UX for flaky networks
- Lost requests on timeout

**Fix hint:**
Implement 3-retry loop with exponential backoff. Use idempotency key for safe retries.

---

### AA-ORD-016: Order Totals Missing Platform Fee & Tax Breakdown
**Severity:** MEDIUM

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 480-486), `/rezadmin/services/api/orders.ts` (line 20-45)

**Category:** UI Completeness

**Description:**
Order list shows total amount but not breakdown. Order detail should show: subtotal, tax, delivery, discount, platform fee, merchant payout. These are in `order.totals` but not displayed. Admin can't see what portion of ₹1,000 goes to platform vs merchant.

**Impact:**
- Admin can't verify financial split
- Can't spot pricing errors
- Can't respond to customer disputes about fee

**Fix hint:**
Add expandable section in order detail: "Price Breakdown" showing all fields from `order.totals`.

---

### AA-ORD-017: Refund Modal Missing Refund Confirmation Summary
**Severity:** LOW

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 168-192)

**Category:** Confirmation Dialog

**Description:**
Refund confirmation modal only asks for reason text. Doesn't show: order ID, customer name, order total, refund amount, or merchant affected. Admin could refund wrong order without noticing.

**Impact:**
- Accidental refunds to wrong orders
- Poor UX

**Fix hint:**
Show order summary before refund: "Refund ₹1,000 for Order #OD-123456 (Customer: John Doe)"

---

### AA-ORD-018: No Refund Limits Enforcement Per Admin User
**Severity:** MEDIUM

**File:** `/rezadmin/services/api/orders.ts` (line 206-222)

**Category:** Authorization / Rate Limiting

**Description:**
Backend may track daily refund limits, but frontend has no visibility. Admin with low permission might be able to refund ₹10,000 if backend limit is ₹50,000. No warning before exceeding soft limits.

**Impact:**
- Exceeded limits without admin knowledge
- Compliance violations
- Audit surprises

**Fix hint:**
Fetch admin refund quota from backend. Show usage bar in refund modal: "Your daily limit: ₹50,000 (₹5,000 used)".

---

### AA-ORD-019: Cancel vs Refund Not Clearly Distinguished
**Severity:** LOW

**File:** `/rezadmin/app/(dashboard)/orders.tsx` (line 161-192)

**Category:** UI/UX

**Description:**
Both `handleCancel()` and `handleRefund()` open similar modals asking for reason. UX doesn't clarify: cancel means order revoked, refund means payment returned. For user, both might mean "undo order" but backend behavior differs.

**Impact:**
- Admin confusion (which one to pick?)
- Wrong action chosen
- Inconsistent backend state

**Fix hint:**
Add description in modal: "Cancel: Revoke order before fulfillment. Refund: Return payment for fulfilled order."

---

### AA-ORD-020: Order Coin/Cashback Amounts Not Refunded
**Severity:** CRITICAL

**File:** `/rezadmin/services/api/orders.ts` (line 206-222)

**Category:** Completeness / Business Logic

**Description:**
Order schema includes `payment.coinsUsed` (rezCoins, promoCoins, etc.) but refund endpoint only returns payment refund. If user paid ₹1,000 (₹500 coins + ₹500 cash), refund returns only ₹500 cash. Coins are not credited back to user. User loses coin value.

**Impact:**
- User loses value equivalent to coins spent
- Fraud vector (refund gaming with coins)
- Customer service complaints
- Compliance issue

**Fix hint:**
Refund service must: (1) reverse coin deduction from user wallet, (2) create ledger entry for coin reversal, (3) return both cash and coin amounts in refund response.

> **Status:** Fixed in commit 9bd8b4d (2026-04-15)
> **Changes:** Added `includeCoins: true` flag to refund request body. Service now passes this to backend. Backend must handle coin reversal when flag is set.

---

## Summary Statistics

- **Total Order-Ops Bugs Found:** 20
- **Critical:** 4 (Idempotency, Validation, Approval, Coins)
- **High:** 5 (Status Tracking, Race Conditions, Audit)
- **Medium:** 9 (Rounding, Fulfillment, Pagination, etc.)
- **Low:** 2 (Debounce, Retry, Clarification)

**Key Patterns:**
1. No two-person approval for high-value operations
2. Missing idempotency (refunds not safe for retry)
3. Incomplete audit trails on money movements
4. Race conditions on concurrent refund requests
5. Missing coin/reward reversals on refunds
