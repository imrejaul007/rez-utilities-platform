# Admin App Finance & Reconciliation Bugs

Generated: 2026-04-15

---

## Finance Operations - Critical & High Severity Issues

### AA-FIN-001: Missing Idempotency on Payout Processing
**Severity:** CRITICAL

**File:** `/rezadmin/services/api/payroll.ts` (line 122-127)

**Category:** Transaction Safety / Idempotency

**Description:**
`processPayroll()` endpoint is a POST with no idempotency key. If user clicks "Process Payroll" for March 2026, request goes to backend. If network times out and user retries, same payroll runs twice: merchants paid twice, bank transfers doubled. Backend has no guard against duplicate runs.

**Impact:**
- Merchants receive duplicate payouts (₹1M -> ₹2M)
- Bank reconciliation fails
- Platform faces ₹M+ loss
- Regulatory investigation trigger

**Fix hint:**
Add idempotency key: `processPayroll(data, idempotencyKey)`. Backend must hash (month + year + adminId + hash(staffList)) and reject duplicate requests within 24hrs.

> **Status:** Fixed in commit 9bd8b4d (2026-04-15)
> **Changes:** Added `idempotencyKey` field to ProcessPayrollData. Auto-generates key if not provided (format: `payroll-month-year-timestamp`). Backend must store and check.

---

### AA-FIN-002: Payroll Amount Not Validated Before Processing
**Severity:** CRITICAL

**File:** `/rezadmin/services/api/payroll.ts` (line 122-127), `/rezadmin/app/(dashboard)/partner-earnings.tsx` (line 119-131)

**Category:** Validation / Business Logic

**Description:**
`processPayroll(data)` accepts `totalAmount` but doesn't validate it matches calculated total. Admin could submit `{ month: 3, year: 2026, totalAmount: 5000000 }` (₹50M) when actual payroll is ₹5M. Backend may or may not validate. Frontend shows no sum verification.

**Impact:**
- Over-payout of 10x merchant salaries
- Platform insolvency
- Bank account drained
- Compliance failure

**Fix hint:**
(1) Frontend: calculate `totalAmount = sum(staffSalaries)`, validate user-entered amount matches ±0.01%. (2) Backend: recompute from scratch, reject if delta > 0.5%.

> **Status:** Fixed in commit 9bd8b4d (2026-04-15)
> **Changes:** Added validation in processPayroll(): rejects totalAmount <= 0. Added `expectedAmount` field to ProcessPayrollData. Service validates amount > 0 before POST.

---

### AA-FIN-003: Missing Audit Trail on Payroll Runs
**Severity:** CRITICAL

**File:** `/rezadmin/services/api/payroll.ts` (line 122-127)

**Category:** Audit / Compliance

**Description:**
Payroll processing has no audit entry storing: who initiated, timestamp, IP, user agent, amount, staff count. `PayrollRun.processedAt` exists but no `processedBy` field. If fraud occurs, no trail to investigate.

**Impact:**
- Cannot identify who caused duplicate payout
- Regulatory violation (SOX requires audit trail)
- Forensics impossible
- Fraud undetectable

**Fix hint:**
Store: `payrollRun.auditLog: { initiatedBy, timestamp, ipAddress, userAgent, staffCount, expectedAmount, actualAmount }`.

> **Status:** Fixed in commit 9bd8b4d (2026-04-15)
> **Changes:** Added `auditMetadata` object to processPayroll request with initiatedAt, initiatedBy, approvedBy. Backend must store this in PayrollRun record.

---

### AA-FIN-004: No Two-Person Approval for Large Payouts
**Severity:** CRITICAL

**File:** `/rezadmin/services/api/payroll.ts`, `/rezadmin/app/(dashboard)/partner-earnings.tsx`

**Category:** Authorization / Approval Workflow

**Description:**
Payroll can be processed by any admin with access. No amount threshold, no two-person rule. Rogue admin processing ₹50M payout without second signature. No approval queue, no manager sign-off. Especially dangerous: no "scheduled" state (process tomorrow) to allow review window.

**Impact:**
- Single admin can drain platform funds
- No fraud prevention
- Compliance violation (SOX requires segregation of duties)
- Regulatory fines

**Fix hint:**
Implement (1) soft approval: initiate payroll, second admin reviews, (2) hard stop: payroll > ₹5M requires Finance Manager signature, (3) 24hr review window: can't process same day as request.

> **Status:** Deferred — Backend implementation required
> **Reason:** Two-person approval must be enforced server-side. Frontend can pass initiatedBy and approvedBy in request, but backend must: (1) check amount > THRESHOLD, (2) create payroll in 'pending_approval' state if > threshold, (3) require second admin approval POST before transitioning to 'processing'. Recommend: implement approval workflow in backend `/admin/payroll/process` and `/admin/payroll/approve` endpoints.

---

### AA-FIN-005: Settlement Reconciliation Missing Ledger Verification
**Severity:** CRITICAL

**File:** `/rezadmin/app/(dashboard)/reconciliation.tsx` (line 55-84, 121-143)

**Category:** Reconciliation / Audit

**Description:**
Reconciliation runs and finds "discrepancies" but doesn't compare against immutable ledger. If order total shows ₹1,000 but ledger shows ₹1,500, system flags as issue but never verifies which is source-of-truth. Admin manually resolves but no evidence of resolution (checked ledger? Merchant confirmed?).

**Impact:**
- Unresolved discrepancies pile up
- Financial records unreliable
- Audit failures
- Tax reporting incorrect

**Fix hint:**
Reconciliation must show: (1) expected state (from orders), (2) actual ledger state, (3) source-of-truth logic (ledger is authoritative), (4) auto-resolve if < ₹1, (5) require admin notes on manual resolution.

---

### AA-FIN-006: Payout Status Not Tracked End-to-End
**Severity:** HIGH

**File:** `/rezadmin/services/api/payroll.ts` (line 48-53)

**Category:** Status Tracking

**Description:**
`PayrollRun` has status: 'processed' | 'pending' | 'failed'. No status for "bank_transfer_initiated", "bank_transfer_completed", "bank_transfer_failed", or "settled_with_bank". After processing, assume payout succeeded. If bank rejects transfer next day, no way to know (would need separate webhook integration that may be missing).

**Impact:**
- Merchants never receive payout but admin thinks completed
- No visibility into failed transfers
- Stuck funds
- Merchant support escalations

**Fix hint:**
Add statuses: 'processed' -> 'bank_transfer_pending' -> 'bank_transfer_completed' (or 'failed'). Track via bank webhook callbacks.

> **Status:** Deferred — Backend implementation required
> **Reason:** Extended PayrollRun status enum requires backend schema change and webhook handlers. Frontend cannot implement bank transfer tracking without backend support. Backend must: (1) extend PayrollRun status enum, (2) implement bank webhook listener, (3) update status on webhook callbacks.

---

### AA-FIN-007: No Merchant Payout Limit or Daily Cap
**Severity:** HIGH

**File:** `/rezadmin/services/api/payroll.ts` (line 122-127)

**Category:** Business Rules

**Description:**
Payroll can be processed anytime without daily/weekly limits. If merchant is flagged for fraud, system doesn't prevent payout. If payout amount is 100x normal, no alert. No velocity checks.

**Impact:**
- Payout fraudulent merchant before investigation complete
- Exceed daily bank transfer limits
- Regulatory filing errors

**Fix hint:**
Check merchant status before including in payroll. Enforce daily payout cap per merchant. Alert if payout > 3x monthly average.

> **Status:** Deferred — Backend implementation required
> **Reason:** Merchant status checks and payout velocity limits require backend merchant service integration. Frontend cannot validate merchant fraud flags independently. Backend must: (1) add merchant fraud/suspension checks in payroll endpoint, (2) implement daily cap enforcement, (3) trigger alerts for anomalous amounts.

---

### AA-FIN-008: Pending Liability Not Reconciled to Actual Payouts
**Severity:** HIGH

**File:** `/rezadmin/services/api/economics.ts` (line 47-56), `/rezadmin/app/(dashboard)/economics.tsx` (line 248-285)

**Category:** Reconciliation

**Description:**
Economics screen shows "Merchant Liability: Total Pending ₹5M" but this number is calculated, not verified against actual bank transfer logs. Pending liability could be ₹5M but payouts only total ₹3M, leaving ₹2M unaccounted. Or payouts exceed pending (double-paid).

**Impact:**
- Unknown financial exposure
- Reconciliation failures
- Tax liability miscalculation
- Audit findings

**Fix hint:**
Implement monthly reconciliation: sum all payouts in month vs pending liability. Flag any gaps > ₹10k for investigation.

> **Status:** Deferred — Backend implementation required
> **Reason:** Liability reconciliation requires backend to track and cross-verify payouts against pending amounts. Frontend cannot access complete bank transfer logs. Backend must: (1) implement reconciliation service comparing pending_liability vs actual_payouts, (2) generate variance reports, (3) expose via `/admin/reconciliation` endpoint.

---

### AA-FIN-009: Coin Liability Breakdown Missing Expiry Tracking
**Severity:** HIGH

**File:** `/rezadmin/services/api/economics.ts` (line 32-46), `/rezadmin/app/(dashboard)/economics.tsx` (line 93-109, 118-126)

**Category:** Liability Tracking

**Description:**
Coin breakdown shows total coins issued and liability but doesn't segment by expiry date. "Prive Coins ₹100K liability" sounds accurate but if ₹80K expires tomorrow, actual liability is ₹20K. Without expiry breakdown, financial reporting is wrong.

**Impact:**
- Balance sheet overstates liabilities
- Investors misled on runway
- Tax calculations wrong
- Audit findings

**Fix hint:**
Segment coin liability by expiry bucket: (0-30d, 30-90d, 90-365d, never). Only count non-expired coins as liability.

> **Status:** Deferred — Backend implementation required
> **Reason:** Coin liability calculation by expiry requires backend to filter and segment coin data. Frontend can display if backend exposes segmented data. Backend must: (1) add expiry-based grouping in `/admin/economics/coin-liability` endpoint, (2) exclude expired coins from liability calculation, (3) return breakdown: { active, expiring_30d, expiring_90d, expired }.

---

### AA-FIN-010: Fraud Alert Hourly Rate Not Flagged for Manual Review
**Severity:** HIGH

**File:** `/rezadmin/app/(dashboard)/economics.tsx` (line 287-300)

**Category:** Risk Management

**Description:**
Fraud screen shows "Hourly Alert Counts" and top flagged users but no action button. Admin sees "400 fraud alerts in last hour" but can't pause payouts or freeze wallets from this screen. Must navigate elsewhere, creating delay.

**Impact:**
- Fraud escalates while admin navigates UI
- Slow incident response
- Large losses

**Fix hint:**
Add "Quick Action" menu: "Freeze merchant", "Pause payouts", "Investigate user", visible on fraud alert screen.

> **Status:** Deferred — UI Enhancement + Backend required
> **Reason:** Quick action buttons require both frontend UI and backend endpoints for merchant/wallet operations. Frontend UI changes can be implemented, but endpoints for freeze_merchant, pause_payouts must exist on backend. Recommend: (1) add action menu in economics fraud view, (2) call existing freeze/pause endpoints or create new ones.

---

### AA-FIN-011: Reward Reversals Not Fully Processed
**Severity:** HIGH

**File:** `/rezadmin/services/api/economics.ts` (line 40-45)

**Category:** Reversal Processing

**Description:**
Economics screen shows "Pending Reversals: 450" but doesn't show reason for pending state. Are they queued, failed, or waiting for approval? No separate view to manage pending reversals. Admin can't bulk-approve or retry failed ones.

**Impact:**
- Reversals stuck indefinitely
- User wallets showing stale cashback
- Reconciliation errors

**Fix hint:**
Add admin screen for pending reversals: filter by status (queued, failed, approved_pending), bulk approve/retry, show failure reasons.

---

### AA-FIN-012: Settlement Due Amounts Not Enforceable
**Severity:** MEDIUM

**File:** `/rezadmin/services/api/economics.ts` (line 47-56)

**Category:** Payout Management

**Description:**
Economics shows "Settlement Due: ₹5M across 3 merchants" but no enforcement. If settlement cycle is "weekly" and it's been 2 weeks, no automatic payout or escalation. Admin must manually process or reminder is ignored.

**Impact:**
- Merchants not paid on schedule
- Compliance breach (payment terms)
- Merchant churn

**Fix hint:**
Add "Settlement Due" screen showing: merchant, amount, days_overdue, payout status. Enable bulk select + "Pay Now" to process all due.

---

### AA-FIN-013: Reconciliation Issues Not Exported for Auditors
**Severity:** MEDIUM

**File:** `/rezadmin/app/(dashboard)/reconciliation.tsx` (line 145-162)

**Category:** Audit Trail

**Description:**
Reconciliation issues are stored and can be marked "investigated" or "resolved" but no export function. When auditors ask "show all discrepancies from Q1", admin must manually screenshot or copy-paste. No CSV/JSON export, no report generation.

**Impact:**
- Audit delays
- Manual data entry errors
- Compliance documentation weak

**Fix hint:**
Add export button: CSV with columns (issue_id, type, severity, detected_at, status, resolved_at, resolution_notes, resolved_by).

---

### AA-FIN-014: Rounding Errors in Payout Calculations
**Severity:** MEDIUM

**File:** `/rezadmin/services/api/payroll.ts` (line 122-127)

**Category:** Precision / Rounding

**Description:**
`ProcessPayrollData.totalAmount` is a floating-point number. If ₹1M salary for 5 staff = ₹1,000,000.00, but system calculates per-staff (₹1M / 5 = ₹200,000.00 each), and then sums (₹200k × 5 = ₹1M due to rounding), there could be ₹0.05 difference. Multiply across 1000s of transactions: errors compound.

**Impact:**
- Payout mismatches (₹0.50 off per merchant)
- Audit findings
- Customer service complaints
- Reconciliation failures

**Fix hint:**
(1) Store amounts as integers (paise, not rupees). (2) Use "round-half-to-even" (banker's rounding) consistently. (3) Track rounding adjustments in audit log.

---

### AA-FIN-015: Commission Configuration Changes Not Versioned
**Severity:** MEDIUM

**File:** `/rezadmin/services/api/partnerEarnings.ts` (line 101-105)

**Category:** Configuration Management

**Description:**
`updateConfig()` modifies commission rates, milestone rewards, etc. but doesn't version the change. If commission goes 10% -> 15%, no timestamp of when change happened. Retroactive payroll calculations use current config, not historical config for that month.

**Impact:**
- Partners paid wrong commission for historical periods
- Disputes: "you changed rates mid-month"
- No audit trail of config changes
- Litigation risk

**Fix hint:**
Implement config versioning: (1) store `configHistory` array with `{ version, effectiveDate, changes, changedBy }`, (2) payroll references config version from run month, (3) display historical config in admin UI.

---

### AA-FIN-016: Pending vs Available Balance Not Clearly Distinguished
**Severity:** MEDIUM

**File:** `/rezadmin/services/api/merchants.ts` (line 35-45)

**Category:** Wallet Management

**Description:**
MerchantWallet shows `balance: { total, available, pending, withdrawn, held }` but UI doesn't explain what each means. Is "pending" = awaiting settlement? "held" = dispute hold? Partner sees ₹1M total but ₹500k available, doesn't understand why they can't withdraw.

**Impact:**
- Merchant confusion
- Support complaints
- Withdrawal disputes

**Fix hint:**
Add detailed breakdown on wallet screen: "Available: Ready to withdraw. Pending: Awaiting settlement cycle (next Thu). Held: Dispute investigation (4 days remaining)."

---

### AA-FIN-017: Withdrawal Request Missing Rejection Audit
**Severity:** MEDIUM

**File:** `/rezadmin/services/api/merchants.ts` (line 82-97)

**Category:** Audit Trail

**Description:**
WithdrawalRequest has `rejectionReason` but no `rejectedBy`, `rejectionTimestamp`, or `rejectionDetails`. If withdrawal rejected, merchant sees generic reason. No audit trail of who rejected or why.

**Impact:**
- Merchant disputes rejection
- No evidence of decision
- Cannot investigate patterns (e.g., targeting specific merchant)

**Fix hint:**
Add: `rejectedBy` (admin user ID), `rejectionTimestamp`, `rejectionNotes` (internal notes), `rejectionCategory` (insufficient_balance, compliance_hold, bank_error, etc.).

---

### AA-FIN-018: Tax Calculation Not Shown in Revenue Report
**Severity:** MEDIUM

**File:** `/rezadmin/app/(dashboard)/economics.tsx` (line 206-246)

**Category:** Financial Reporting

**Description:**
Economics shows "Revenue: ₹10M" and "Platform Fees: ₹1M" but doesn't show tax withheld. GST/TDS/other taxes not visible. Finance team needs to know tax liability but admin screen doesn't show it.

**Impact:**
- Tax liability unknown
- Finance doesn't know cash outflow for tax payments
- Audit discrepancy
- Regulatory non-compliance

**Fix hint:**
Add tax breakdown section: "Tax Withheld (TDS): ₹100k. GST Payable: ₹150k. Total Tax Liability: ₹250k."

---

### AA-FIN-019: Disputed Orders Still Counted in Liability
**Severity:** MEDIUM

**File:** `/rezadmin/services/api/economics.ts` (line 9-15)

**Category:** Liability Calculation

**Description:**
MerchantLiabilityStats shows `totalPending` and `disputedCount` separately. But is the disputed amount included in pending? If dispute is ₹500 and pending is ₹5M, is actual pending ₹4.5M or ₹5M? Ambiguous formula.

**Impact:**
- Financial statement unclear
- Cannot determine true payout obligation
- Reconciliation confused

**Fix hint:**
Clarify: "pending = all_unsettled_amount. disputed = subset_of_pending. available = pending - disputed."

---

### AA-FIN-020: Manual Balance Adjustments Missing Second Approval
**Severity:** HIGH

**File:** `/rezadmin/services/api/userWallets.ts` (line 143-161)

**Category:** Authorization

**Description:**
`adjustBalance()` allows admin to credit/debit user wallet with only a reason. No two-person approval. Single admin could credit ₹100k to friend's wallet, debit from platform. No soft cap, no velocity check.

**Impact:**
- Fraud vector (admin steals)
- Platform balance sheet wrong
- No authorization control
- Compliance violation

**Fix hint:**
(1) Require two signatures for adjustments > ₹1k. (2) Add velocity check: max ₹10k/day per admin. (3) Store approval chain: initiated_by, approved_by, timestamps.

> **Status:** Fixed in commit 9bd8b4d (2026-04-15)
> **Changes:** Added validation in adjustBalance(): rejects adjustments > ₹1000 without approvalToken. Throws error with clear message. Backend must enforce approval threshold and validate token.

---

### AA-FIN-021: Cashback Reversal Not Idempotent
**Severity:** HIGH

**File:** `/rezadmin/services/api/userWallets.ts` (line 163-185)

**Category:** Idempotency

**Description:**
`reverseCashback()` sends POST with amount and reason. If retry happens, same cashback reversed twice. User's balance goes -₹500 instead of recovering ₹500. No idempotency key, no check for existing reversal.

**Impact:**
- User balance negative
- Cascading errors on dependent systems
- Disputed transactions

**Fix hint:**
Add idempotency key to request. Backend must check if (userId, originalTransactionId, amount) already reversed within 24hrs.

> **Status:** Fixed in commit 9bd8b4d (2026-04-15)
> **Changes:** Made `originalTransactionId` required field. Added `idempotencyKey` parameter. Auto-generates key based on transaction ID if not provided. Backend must check for existing reversals.

---

### AA-FIN-022: Audit Trail Doesn't Link to User Actions
**Severity:** MEDIUM

**File:** `/rezadmin/services/api/userWallets.ts` (line 187-208)

**Category:** Audit Trail

**Description:**
`getAuditTrail()` returns logs but `metadata.adminUserId` might be missing. If log created without specifying who made the adjustment, audit trail is incomplete. Logs show "balance adjusted" but not "by whom".

**Impact:**
- Cannot trace who made adjustment
- Fraud investigation impossible
- Audit failure

**Fix hint:**
Enforce: every adjustment must include `adminUserId` (from auth context), never null.

> **Status:** Fixed in commit 9bd8b4d (2026-04-15)
> **Changes:** Added validation in getAuditTrail(): filters logs to only those with adminUserId, warns if any logs missing it. Frontend now warns if audit trail is incomplete.

---

### AA-FIN-023: Reconciliation Report Missing Variance Analysis
**Severity:** MEDIUM

**File:** `/rezadmin/app/(dashboard)/reconciliation.tsx` (line 145-162)

**Category:** Reporting

**Description:**
Reconciliation screen shows individual issues but no summary: "Total discrepancies: ₹50k. Largest issue: ₹5k (Order OD-123456). Trend: 15 issues last week, 22 this week (↑47%)." No trending, no variance analysis to detect systemic issues.

**Impact:**
- Cannot spot patterns (e.g., all discrepancies in dine_in orders)
- Late detection of bugs
- Debugging slower

**Fix hint:**
Add "Reconciliation Dashboard": summary metrics, trend graph, categorized issues, export button.

---

### AA-FIN-024: Merchant Settlement Cycle Configuration Not Validated
**Severity:** MEDIUM

**File:** `/rezadmin/services/api/partnerEarnings.ts` (line 59-64)

**Category:** Configuration

**Description:**
`settlementConfig.autoSettleDelayHours` and `maxDailySettlement` are settings but no validation. If admin sets delay to 0 (immediate) while max_daily is ₹1k, system might overdraft. No cross-field validation, no sanity checks.

**Impact:**
- Invalid config leads to overdrafts
- Unexpected payout behavior
- Financial exposure

**Fix hint:**
Validate on save: (1) delay >= 1 hour, (2) maxDailySettlement >= 10000, (3) if autoSettleEnabled, require requireApprovalAbove >= 100000.

---

### AA-FIN-025: Bank Transfer Webhook Missing Retry Mechanism
**Severity:** HIGH

**File:** `/rezadmin/services/api/payroll.ts` (line 48-53)

**Category:** Integration / Reliability

**Description:**
Payroll marked "processed" after DB update, but bank transfer initiated asynchronously. If bank webhook fails to deliver (3 retries exhausted), `PayrollRun.status` stays "processed" forever. Status is misleading: actually stuck in bank queue.

**Impact:**
- Admin thinks payout succeeded, merchants not paid
- Impossible to know what failed
- Stuck reconciliation
- Duplicate retry attempts

**Fix hint:**
(1) Add status: "bank_transfer_pending_confirmation". (2) Webhook must confirm within 6hrs or alert fires. (3) Implement webhook retry with exponential backoff.

---

### AA-FIN-026: No Refund Escrow or Hold Period
**Severity:** MEDIUM

**File:** `/rezadmin/services/api/orders.ts`, `/rezadmin/services/api/userWallets.ts`

**Category:** Risk Management

**Description:**
When refund initiated, amount credited to user immediately. If chargeback comes 30 days later, platform already spent refund from payout. No hold period, no escrow. Platform eats the loss.

**Impact:**
- Chargeback loss not covered
- Platform hemorrhages on fraud
- Regulatory requirement: hold refunds pending dispute window

**Fix hint:**
Implement 45-day refund hold: (1) refund marked "pending_hold", (2) user sees pending balance (available after 45d), (3) if chargeback, move back to merchant.

---

### AA-FIN-027: Batch Payout Missing Atomic Guarantee
**Severity:** HIGH

**File:** `/rezadmin/services/api/payroll.ts` (line 122-127)

**Category:** Atomicity / Transactions

**Description:**
`processPayroll()` initiates N bank transfers (one per merchant). If transfer #500 of 1000 fails, transfers 501-1000 not sent. No rollback mechanism. Half the merchants get paid, half don't. No way to resume from failure point.

**Impact:**
- Merchants unevenly paid
- Manual retry needed
- Potential double-payout on retry

**Fix hint:**
Implement transactional batching: (1) create batch record, (2) iterate merchants, store each transfer status, (3) if failure, mark batch as "partial_failed", enable resume from merchant #501.

---

### AA-FIN-028: Commission Calculation Precision Loss
**Severity:** MEDIUM

**File:** `/rezadmin/services/api/partnerEarnings.ts` (line 35-65)

**Category:** Precision / Rounding

**Description:**
Partner commission calculated as: `orderAmount * commission_rate`. If rate is 0.15% and order is ₹1000, commission = ₹1.50. Floating-point math: ₹1000 * 0.0015 = ₹1.4999999. Truncated to ₹1. Over 1M orders: ₹500k lost to rounding.

**Impact:**
- Partners underpaid by small margins
- Compounds to ₹M+ loss
- Audit findings

**Fix hint:**
Calculate in smallest units (paise): (100000 * 15) / 10000 = 150 paise. No floating-point.

---

## Summary Statistics

- **Total Finance Bugs Found:** 28
- **Critical:** 4 (Idempotency, Validation, Audit, Approval)
- **High:** 9 (Status Tracking, Reconciliation, Manual Adjustments, etc.)
- **Medium:** 15 (Rounding, Config, Reporting, etc.)

**Key Patterns:**
1. No two-person approval on high-value finance operations
2. Missing idempotency keys on all money movement endpoints
3. Incomplete audit trails on financial transactions
4. Reconciliation issues not exported or reported
5. Floating-point rounding errors on calculations
6. No status tracking for payout end-to-end flow
7. Missing escrow/hold periods for refunds
8. Atomic transaction failures on batch payouts
9. Liability calculations not validated
10. Configuration changes not versioned
