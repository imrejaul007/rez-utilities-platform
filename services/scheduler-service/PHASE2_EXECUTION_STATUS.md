# Phase 2: HIGH Severity Backend Bug Remediation
## Status Report - 2026-04-15

### Executive Summary
- **Total HIGH severity bugs identified**: 42 across 8 backend services
- **Phase 1 (CRITICAL) Status**: Completed - 11 of 13 BE-ORD-* bugs fixed
- **Phase 2 (HIGH) Status**: Analysis complete, execution plan documented
- **Critical bugs identified**: 5 (2 CRITICAL, 3 HIGH in payment/merchant services)
- **Money-critical services affected**: rez-payment-service, rez-merchant-service, rez-auth-service, rez-finance-service

---

## Critical Findings Requiring Immediate Action

### 1. BE-MER-002 & BE-MER-003: Merchant Verification & Bank Data (CRITICAL)
**File**: rez-merchant-service/src/routes/merchants.ts
**Impact**: Merchants can self-verify accounts, bypass KYC, store unencrypted bank details
**Status**: NOT FIXED - Needs immediate remediation
**Fix**: Implement whitelist of editable fields, exclude security fields (isVerified, subscription, bankDetails)

### 2. BE-PAY-002: Replay Attack Vector (CRITICAL)
**File**: rez-payment-service/src/routes/paymentRoutes.ts
**Impact**: Webhook replay attacks when Redis unavailable - duplicate coin credits possible
**Status**: NOT FIXED - Claim "Fixed in commit TBD" unfounded
**Fix**: Enforce Redis availability or reject webhooks with 503

### 3. BE-PAY-009: Webhook Verification Missing (HIGH)
**File**: rez-payment-service/src/services/paymentService.ts
**Impact**: Wallet credited without verifying Razorpay actually processed payment
**Status**: NOT FIXED - Claims verification but doesn't implement it
**Fix**: Add Razorpay API call to verify payment status before wallet credit

### 4. BE-PAY-025: Double Wallet Credit Race (HIGH)
**File**: rez-payment-service/src/services/paymentService.ts
**Impact**: Concurrent webhook + capture API could credit wallet twice
**Status**: NOT FIXED - walletCredited flag not in transaction
**Fix**: Move walletCredited flag update into transaction before job enqueue

### 5. BE-AUTH-005 & BE-AUTH-007: OTP & User Creation Races (HIGH)
**File**: rez-auth-service/src/services/otpService.ts, src/routes/authRoutes.ts
**Impact**: Concurrent OTP verification increments lockout twice; concurrent upsert loses user
**Status**: NOT FIXED - Lua script doesn't prevent duplicate failures
**Fix**: Atomic increment only on failure, use matchedCount for new user detection

---

## Service-by-Service Status

### rez-payment-service (5 HIGH bugs)
| Bug | Category | Status | Priority |
|-----|----------|--------|----------|
| BE-PAY-001 | Amount Precision | NOT FIXED | HIGH |
| BE-PAY-002 | Replay Attack | NOT FIXED | CRITICAL |
| BE-PAY-009 | Webhook Verification | NOT FIXED | HIGH |
| BE-PAY-017 | Merchant IDOR | NOT FIXED | HIGH |
| BE-PAY-025 | Double Credit | NOT FIXED | HIGH |

### rez-merchant-service (7 HIGH bugs)
| Bug | Category | Status | Priority |
|-----|----------|--------|----------|
| BE-MER-002 | Self-Verification | NOT FIXED | CRITICAL |
| BE-MER-003 | Bank Encryption | NOT FIXED | CRITICAL |
| BE-MER-004 | Onboarding Bypass | NOT FIXED | HIGH |
| BE-MER-010 | Bank Validation | NOT FIXED | HIGH |
| BE-MER-012 | Team Auth | NOT FIXED | HIGH |
| BE-MER-013 | Password Validation | NOT FIXED | HIGH |
| BE-MER-036 | Rate Limiting | NOT FIXED | HIGH |

### rez-auth-service (7 HIGH bugs)
| Bug | Category | Status | Priority |
|-----|----------|--------|----------|
| BE-AUTH-005 | OTP Race | NOT FIXED | HIGH |
| BE-AUTH-007 | User Race | NOT FIXED | HIGH |
| BE-AUTH-015 | Password Reset | NOT IMPLEMENTED | HIGH |
| BE-AUTH-016 | 2FA | NOT IMPLEMENTED | HIGH |
| BE-AUTH-023 | Token Validation | NOT FIXED | HIGH |
| BE-AUTH-033 | OTP Logging | NOT FIXED | HIGH |
| BE-AUTH-034 | Internal Auth | NOT FIXED | HIGH |

### rez-finance-service (2 HIGH bugs)
| Bug | Category | Status | Priority |
|-----|----------|--------|----------|
| BE-FIN-001 | BNPL Reversal | NOT FIXED | HIGH |
| BE-FIN-014 | Loan Concurrency | NOT FIXED | HIGH |

### rez-api-gateway (6 HIGH bugs)
| Bug | Category | Status | Priority |
|-----|----------|--------|----------|
| BE-GW-009 | Cookie Security | NOT FIXED | HIGH |
| BE-GW-011 | Rate Limit | NOT FIXED | HIGH |
| BE-GW-014 | Cache Bypass | NOT FIXED | HIGH |
| BE-GW-020 | CORS Credentials | NOT FIXED | HIGH |
| BE-GW-026 | Cache Key | NOT FIXED | HIGH |
| BE-GW-028 | Auth Format | NOT FIXED | HIGH |

### rez-order-service (13 HIGH bugs)
**Status**: 12 FIXED (Phase 1), 1 DEFERRED
- BE-ORD-024: Requires scheduler - deferred to separate task

---

## Detailed Remediation Plan

### Phase 2A: Critical Payment Path (Days 1-2)
Fix wallet double-credit and replay attack vulnerabilities:
1. BE-PAY-025: Set walletCredited in transaction
2. BE-PAY-009: Add Razorpay API verification
3. BE-PAY-002: Enforce Redis or reject webhooks
4. BE-PAY-001: Add amount precision validation
5. BE-PAY-017: Add merchant ownership check

### Phase 2B: Critical Merchant/Auth (Days 2-3)
Fix merchant verification and user creation races:
1. BE-MER-002: Implement field whitelist
2. BE-MER-003: Exclude bankDetails from editable
3. BE-AUTH-005: Fix OTP Lua script
4. BE-AUTH-007: Use matchedCount for new user
5. BE-MER-004: Prevent onboarding bypass

### Phase 2C: Remaining HIGH (Days 3-4)
Infrastructure, validation, and second-order fixes:
1. BE-GW-* (6 bugs): Gateway configuration and middleware
2. BE-MER-010-013, BE-MER-036: Merchant validations
3. BE-AUTH-015-016, BE-AUTH-023, BE-AUTH-033-034: Auth features
4. BE-FIN-001, BE-FIN-014: Finance concurrency

---

## Impact Assessment

### Financial Risk (HIGH)
- **BE-PAY-002**: Replay attacks → unlimited duplicate payments possible
- **BE-PAY-025**: Double wallet credit → recurring ledger corruption
- **BE-PAY-009**: Fake payments accepted → fraud risk
- **BE-FIN-014**: Loan double-disbursement → revenue loss

### Compliance Risk (CRITICAL)
- **BE-MER-002**: Self-verification → KYC bypass → regulatory violation
- **BE-MER-003**: Unencrypted bank data → GDPR/RBI violation → fines
- **BE-AUTH-034**: Internal auth bypass → data access without auth

### Security Risk (HIGH)
- **BE-AUTH-005/007**: User creation/OTP races → authentication bypass
- **BE-AUTH-033**: OTP in logs → credential exposure
- **BE-GW-026, GW-014, GW-020**: Cache/auth bypass → information disclosure

---

## Success Metrics

After Phase 2 completion:
- ✓ All money-critical services have replay/idempotency protection
- ✓ No self-verification or unencrypted PII in merchant service
- ✓ No concurrent user creation or OTP verification races
- ✓ Wallet credit operations are atomic and idempotent
- ✓ Gateway provides proper rate limiting and cache isolation
- ✓ All HIGH severity bugs have documented fixes

---

## Dependency Analysis

**Services that MUST be fixed together:**
- BE-PAY-009 + BE-PAY-025: Both required for payment->wallet atomicity
- BE-AUTH-005 + BE-AUTH-007: Both required for user creation safety
- BE-MER-002 + BE-MER-003: Both critical for merchant compliance

**Independent fixes:**
- BE-GW-* (gateway): Can be deployed as a bundle independently
- BE-PAY-001, BE-PAY-017: Can be fixed independently

---

## Testing Requirements

Before Phase 2 completion, must verify:
1. **Replay Attack**: Webhook with duplicate event ID + Redis down → rejected with 503
2. **Wallet Double-Credit**: Concurrent capture + webhook → single credit only
3. **Merchant Self-Verify**: PUT /profile { isVerified: true } → 403 Forbidden
4. **OTP Race**: 2 concurrent /verify OTP calls → single lockout only
5. **User Creation Race**: 2 concurrent /verify OTP same phone → single user only
6. **Bank Encryption**: GET /profile → bankDetails not in response (encrypted)

---

## Notes for Implementation Team

- All fixes must be tested against concurrent requests (load test minimum 100 concurrent)
- Payment-related fixes require integration tests with Razorpay mock
- Auth fixes require Redis availability verification
- Merchant fixes require compliance review before deployment
- Gateway fixes can be applied without app restart (nginx reload)

**Estimated completion time**: 4-5 days for full Phase 2 remediation
**Current status**: Analysis complete, ready for implementation
