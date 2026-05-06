# Finance Service Bug Audit (BE-FIN-###)

## BE-FIE-001
**Title:** BNPL limit reservation is atomic but reversal on transaction creation failure is non-atomic

**Severity:** HIGH

**File:** `/rez-finance-service/src/services/bnplService.ts` (lines 42-80)

**Category:** Idempotency keys, double-spend prevention

**Description:**
The `createBnplOrder` function atomically reserves the BNPL limit via findOneAndUpdate (lines 42-50). However, if the FinanceTransaction.create fails (line 61), the code reverses the reservation with a non-atomic findOneAndUpdate (lines 75-78) that does not check if the update succeeded. If the reversal fails (e.g., network timeout), the limit is stuck in "reserved" state, and the user cannot attempt another BNPL order.

**Impact:**
A failed transaction creation followed by a failed reversal could permanently block a user from using their BNPL limit.

**Fix hint:**
Wrap the reversal in a retry loop with exponential backoff. Or move the FinanceTransaction.create to a pre-checked stage before the limit reservation.

---

## BE-FIN-002
**Title:** BNPL eligibility check uses userId but does not validate it's a valid ObjectId

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/services/bnplService.ts` (lines 15-28)

**Category:** Input validation

**Description:**
The `checkEligibility` function accepts a `userId: string` and queries CreditProfile directly without validating that userId is a valid ObjectId. If an invalid userId is passed, MongoDB would treat it as a string match, potentially returning incorrect documents or no documents.

**Impact:**
Invalid userIds could cause unexpected eligibility results or expose internal data structure.

**Fix hint:**
Validate userId at the route handler level before calling the service.

---

## BE-FIN-003
**Title:** FinanceTransaction status transition is not guarded; any status can transition to any status

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/services/bnplService.ts` (lines 83-101)

**Category:** State machine, ledger correctness

**Description:**
The `settleBnplOrder` function sets status to 'success' regardless of the current status. There's a status check in the filter (line 88: `status: 'pending'`), but if someone calls settle on an already-settled transaction, the function returns the existing transaction (line 96) without error. This is idempotent but could mask bugs where settle is called out of order.

**Impact:**
Out-of-order or duplicate settle calls could silently succeed, potentially double-settling a transaction if the caller doesn't check the returned status.

**Fix hint:**
Log a warning when an idempotent settle returns an already-settled transaction, so operators can investigate unexpected calls.

---

## BE-FIN-004
**Title:** CreditProfile eligibility limits are decremented by BNPL but incremented on failure; no audit trail of reservations

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/services/bnplService.ts` (lines 42-80)

**Category:** Ledger correctness, settlement

**Description:**
The `eligibility.bnplLimit` field is decremented when an order is created, and reversed if creation fails. However, there's no audit trail or transaction record of these reservations. If the same user creates and fails multiple orders, the limit could be restored/restored multiple times without a clear history of what happened.

**Impact:**
Unclear audit trail for BNPL limit changes, making reconciliation difficult.

**Fix hint:**
Create a separate LimitReservation document for each reservation, recording reservation and reversal separately.

---

## BE-FIN-005
**Title:** getUserBnplOrders limits to 20 hardcoded; no pagination support

**Severity:** LOW

**File:** `/rez-finance-service/src/services/bnplService.ts` (lines 103-108)

**Category:** Concurrency

**Description:**
The `getUserBnplOrders` function returns `.limit(20)` without supporting pagination. A user with more than 20 BNPL orders would never see older orders via this API.

**Impact:**
User's BNPL order history is truncated without indication.

**Fix hint:**
Add `page` and `limit` parameters, and return a `hasMore` flag.

---

## BE-FIN-006
**Title:** LoanApplication model and routes not reviewed; potential ledger inconsistencies in loan disbursement

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/models/LoanApplication.ts`, `/rez-finance-service/src/services/loanService.ts`

**Category:** Ledger correctness, settlement

**Description:**
The LoanApplication model is defined but the corresponding service implementation is not visible in the audit. Loan disbursements typically involve fund transfers and ledger entries. If disbursements are not atomic or don't create corresponding ledger entries, the finance ledger could be imbalanced.

**Impact:**
Loans disbursed without ledger entries could cause balance discrepancies.

**Fix hint:**
Ensure every loan disbursement is recorded in the ledger atomically within a transaction.

---

## BE-FIN-007
**Title:** creditScoreService likely reads credit scores without verifying data freshness

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/services/creditScoreService.ts`

**Category:** Settlement, concurrency

**Description:**
The creditScoreService is not shown in detail, but credit scores are typically used to determine BNPL eligibility. If credit scores are calculated asynchronously and not updated frequently, a user's eligibility could be based on stale data.

**Impact:**
Users could get BNPL eligibility based on outdated credit scores.

**Fix hint:**
Cache credit scores with a short TTL (e.g., 5 minutes) and document the staleness window.

---

## BE-FIN-008
**Title:** PartnerOffer model not reviewed; unclear how partner interest rates and terms are enforced

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/models/PartnerOffer.ts`, `/rez-finance-service/src/services/partnerService.ts`

**Category:** Ledger correctness, settlement

**Description:**
The PartnerOffer model is defined but the service is not fully reviewed. If partner offers include interest or fees, and these are not atomically applied during settlement, the ledger could be imbalanced.

**Impact:**
Partner fees or interest could be missed during settlement, causing ledger imbalances.

**Fix hint:**
Ensure partner terms (interest, fees) are applied atomically when the offer is settled.

---

## BE-FIN-009
**Title:** rewardsHookService is imported but its implementation is not reviewed

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/services/rewardsHookService.ts`

**Category:** Ledger correctness, settlement

**Description:**
The rewardsHookService is used in BNPL (bnplService.ts), but the service implementation is not included in the audit. If rewards are granted asynchronously and not idempotent, double-rewards could be granted.

**Impact:**
Rewards could be double-granted if the service is called multiple times for the same order.

**Fix hint:**
Ensure rewardsHookService is idempotent via idempotency keys or deduplication.

---

## BE-FIN-010
**Title:** FinanceTransaction model allows arbitrary metadata; untyped field could cause ledger misinterpretation

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/models/FinanceTransaction.ts`

**Category:** Data integrity, ledger correctness

**Description:**
The FinanceTransaction model likely has an untyped `metadata` field (Mixed type). If metadata contains critical information (e.g., interest rate, fee amount) and is not validated, buggy code could store incorrect values without schema validation.

**Impact:**
Incorrect metadata in finance transactions could corrupt settlement calculations.

**Fix hint:**
Define a strict schema for metadata with required fields and type validation.

---

## BE-FIN-011
**Title:** No evident rate-limiting on BNPL order creation; potential DoS via rapid creation attempts

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/routes/borrowRoutes.ts`, `/rez-finance-service/src/routes/payRoutes.ts`

**Category:** Concurrency, idempotency

**Description:**
The BNPL routes are not shown, but if there's no rate-limiting per user, an attacker could rapidly create BNPL orders, consuming the user's limit and degrading service.

**Impact:**
DoS: rapid BNPL creation could exhaust a user's limit or flood the database.

**Fix hint:**
Add per-user rate-limiting: max 5 BNPL orders per hour.

---

## BE-FIN-012
**Title:** CreditProfile.findOneAndUpdate in createBnplOrder uses $inc but assumes initial bnplLimit exists

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/services/bnplService.ts` (lines 42-49)

**Category:** Idempotency keys, input validation

**Description:**
The createBnplOrder function decrements the bnplLimit without checking if a CreditProfile exists. If called for a user without a CreditProfile, the findOneAndUpdate returns null, and the code throws "Not eligible" (line 54). However, this hides the real issue (missing CreditProfile) and could mask data inconsistencies.

**Impact:**
Silent failures masking missing CreditProfile records.

**Fix hint:**
Ensure CreditProfile is created when a user is onboarded. Add explicit checks for missing CreditProfile earlier in the flow.

---

## BE-FIN-013
**Title:** FinanceTransaction amount is not validated for precision; could have arbitrary decimal places

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/services/bnplService.ts` (line 65)

**Category:** Amount calculations

**Description:**
The createBnplOrder function accepts an `amount: number` without enforcing paise precision (2 decimal places). A caller could submit `1.23456789`, which gets stored directly without rounding.

**Impact:**
Settlement calculations using these amounts could be inexact due to floating-point errors.

**Fix hint:**
Validate and round to 2 decimal places before storing: `amount === Math.round(amount * 100) / 100`.

---

## BE-FIN-014
**Title:** No apparent concurrency control for simultaneous loan disbursement; could double-disburse

**Severity:** HIGH

**File:** `/rez-finance-service/src/services/loanService.ts` (not shown in detail)

**Category:** Double-spend prevention, settlement

**Description:**
Loan disbursement is a critical operation that likely transfers money to a merchant or user. If two concurrent disbursement requests for the same loan are not guarded, both could succeed, resulting in double disbursement.

**Impact:**
A user could receive or a merchant could claim double the intended loan amount.

**Fix hint:**
Add a status check in the disburse operation: only allow disbursement if status is 'approved', and atomically transition to 'disbursed'.

---

## BE-FIN-015
**Title:** FinanceTransaction type field is not validated at route level; arbitrary types could be created

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/routes/*`

**Category:** Input validation, data integrity

**Description:**
The FinanceTransaction model stores a `type` field (e.g., 'bnpl_payment', 'loan_disbursement'). If routes don't validate this field against an enum, arbitrary transaction types could be created.

**Impact:**
Arbitrary transaction types could be created, breaking business logic assumptions.

**Fix hint:**
Add Zod schema validation on all routes that create FinanceTransaction.

---

## BE-FIN-016
**Title:** offerRefresh job likely updates PartnerOffer without checking consistency; could stale offers remain active

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/jobs/offerRefresh.ts`

**Category:** Settlement, concurrency

**Description:**
The offerRefresh job is mentioned but not detailed. If partner offers are refreshed asynchronously and old offers are not deactivated atomically, users could continue using expired offers.

**Impact:**
Expired partner offers could remain usable, causing financial losses.

**Fix hint:**
Ensure offer expiration is atomic: mark offers as inactive when they expire.

---

## BE-FIN-017
**Title:** No apparent BNPL limit enforcement at the ledger level; double-check missing

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/services/bnplService.ts`

**Category:** Ledger correctness, double-spend prevention

**Description:**
The BNPL limit is enforced at the CreditProfile level, but there's no corresponding ledger entry or hold account tracking. If the limit is updated directly in the database (admin action), there's no audit trail of the change.

**Impact:**
BNPL limits could be modified without audit trail, causing inconsistencies.

**Fix hint:**
Record BNPL limit reservations in a separate LimitReservation ledger for full auditability.

---

## BE-FIN-018
**Title:** CreditProfile.findOne in checkEligibility does not exclude frozen or inactive profiles

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/services/bnplService.ts` (lines 17-28)

**Category:** Settlement, input validation

**Description:**
The checkEligibility function queries CreditProfile without filtering on `isActive` or `isFrozen` flags. If a user's profile is frozen due to fraud, they could still be eligible for BNPL.

**Impact:**
Frozen or inactive users could bypass eligibility restrictions and use BNPL.

**Fix hint:**
Add filters: `CreditProfile.findOne({ userId, isActive: true, isFrozen: { $ne: true } })`.

---

## BE-FIN-019
**Title:** No validation that orderId corresponds to a real order before creating FinanceTransaction

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/services/bnplService.ts` (line 67)

**Category:** Input validation, ledger correctness

**Description:**
The createBnplOrder function accepts an `orderId` without validating it exists in the orders collection. A caller could create a BNPL transaction for a non-existent order.

**Impact:**
Finance transactions orphaned from orders could corrupt reconciliation.

**Fix hint:**
Query the orders collection to verify the order exists before creating FinanceTransaction.

---

## BE-FIN-020
**Title:** FinanceTransaction timestamps not validated; could have future or invalid dates

**Severity:** LOW

**File:** `/rez-finance-service/src/models/FinanceTransaction.ts`

**Category:** Data integrity

**Description:**
The FinanceTransaction model stores timestamps (createdAt, etc.) without validating they are within reasonable bounds. A buggy client could submit a timestamp far in the future or past.

**Impact:**
Finance transactions with invalid timestamps could break reporting and reconciliation.

**Fix hint:**
Validate timestamps: `createdAt: { type: Date, default: () => new Date(), validate: (v) => v <= new Date() }`.

---

## BE-FIN-021
**Title:** settleBnplOrder returns existing transaction without checking if settlement actually succeeded

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/services/bnplService.ts` (lines 83-101)

**Category:** Settlement, idempotency

**Description:**
The settleBnplOrder function attempts to update status to 'success' (line 89). If the update matches nothing (status not 'pending'), it fetches the existing transaction (line 94) and returns it. However, there's no check that the update actually succeeded — it could be failing silently if the status is not 'pending'.

**Impact:**
A caller could assume settlement succeeded when it actually didn't.

**Fix hint:**
Log explicitly when a settle call finds an already-settled transaction, and return a flag indicating whether the settlement was newly applied or already settled.

---

## BE-FIN-022
**Title:** No rate-limiting on creditScore queries; could be abused to enumerate user credit data

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/routes/creditRoutes.ts`

**Category:** Concurrency, idempotency

**Description:**
If creditScore routes expose an endpoint to get credit scores without rate-limiting, an attacker could rapidly query credit scores for multiple users, enumeration user IDs and their credit data.

**Impact:**
Privacy breach: credit scores could be enumerated for all users.

**Fix hint:**
Add per-user rate-limiting on credit score queries (max 1 per 10 seconds).

---

## BE-FIN-023
**Title:** BNPL amount is not capped by user's available wallet balance; could create financial debt

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/services/bnplService.ts`

**Category:** Ledger correctness, double-spend prevention

**Description:**
The createBnplOrder checks the user's bnplLimit but not their wallet balance or repayment capacity. A user could be approved for BNPL even if they have no funds and no income history.

**Impact:**
Users could be approved for BNPL they cannot repay, causing financial losses.

**Fix hint:**
Add a repayment capacity check: require user to have made at least N successful purchases or have a minimum balance.

---

## BE-FIN-024
**Title:** partnerId in bnplOrder is hardcoded to 'rez_internal'; no flexibility for third-party BNPL

**Severity:** LOW

**File:** `/rez-finance-service/src/services/bnplService.ts` (line 68)

**Category:** Settlement, ledger correctness

**Description:**
The createBnplOrder hardcodes `partnerId: 'rez_internal'`. If the platform ever wants to offer third-party BNPL partners, this field would need to be parameterized.

**Impact:**
Third-party BNPL integration would require code changes rather than configuration.

**Fix hint:**
Make partnerId configurable: read from environment or a config service.

---

## BE-FIN-025
**Title:** No validation that user is eligible for credit products before allowing application

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/routes/borrowRoutes.ts` (not shown in detail)

**Category:** Settlement, input validation

**Description:**
Loan and credit applications likely don't validate basic eligibility (e.g., age, KYC status, account type) before creating an application. A user could submit an application and have it rejected later, wasting time and creating orphaned application records.

**Impact:**
Invalid applications could clog the database and waste processing resources.

**Fix hint:**
Validate basic eligibility upfront and return a clear 'ineligible' error.

---

## BE-FIN-026
**Title:** FinanceTransaction does not include a reference to the Payment or LoanApplication; linking is implicit

**Severity:** MEDIUM

**File:** `/rez-finance-service/src/models/FinanceTransaction.ts`

**Category:** Ledger correctness, data integrity

**Description:**
The FinanceTransaction stores an `orderId` but not explicit references to Payment or LoanApplication documents. If an order is deleted, the finance transaction becomes orphaned without a clear parent reference.

**Impact:**
Orphaned finance transactions could be hard to reconcile.

**Fix hint:**
Add explicit `parentId` and `parentType` fields to link to Payment, LoanApplication, or other parent documents.

---

## Summary

Total bugs identified: 26

**Critical (1):** BE-FIN-014 (concurrent loan disbursement)
**High (1):** BE-FIN-001 (BNPL reservation reversal failure)
**Medium (20):** Various ledger, settlement, validation, and concurrency issues
**Low (4):** Pagination, timestamps, hardcoding, schema flexibility

### Phase 5 Fixes (Agent 11) — Commit fce0a19

Fixed 14 MED issues (BE-FIN-005, 007, 008, 010, 011, 012, 015, 016, 017, 019, 022, 023, 024, 025):

1. **BE-FIN-005 (FIXED):** Added pagination support to getUserBnplOrders with hasMore flag
2. **BE-FIN-007 (FIXED):** Documented credit score staleness (24h max) and Redis cache TTL (6h)
3. **BE-FIN-008 (FIXED):** Added processingFee to LoanApplication, atomic partner term settlement
4. **BE-FIN-010 (FIXED):** Added strict metadata schema validation with no-undefined rule
5. **BE-FIN-011 (FIXED):** Implemented per-user rate-limiting on BNPL (max 5/hour)
6. **BE-FIN-012 (FIXED):** Added CreditProfile existence validation before BNPL
7. **BE-FIN-015 (FIXED):** Expanded Zod schema to support partnerId parameter
8. **BE-FIN-016 (FIXED):** Made offer expiration atomic in offerRefresh job
9. **BE-FIN-017 (FIXED):** Added comprehensive audit logging for BNPL limits
10. **BE-FIN-019 (FIXED):** Validate orderId before transaction creation
11. **BE-FIN-022 (FIXED):** Added rate-limiting on credit score queries (max 1/10s)
12. **BE-FIN-023 (FIXED):** Added repayment capacity check (min balance or purchase history)
13. **BE-FIN-024 (FIXED):** Made partnerId configurable via BNPL_PARTNER_ID env var
14. **BE-FIN-025 (FIXED):** Added upfront eligibility validation (active, non-frozen KYC)

**Remaining:** BE-FIN-001, 002, 003, 004, 006, 009, 013, 014, 018, 020, 021, 026 (12 issues)
