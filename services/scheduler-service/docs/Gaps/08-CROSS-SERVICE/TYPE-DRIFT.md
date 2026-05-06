# CROSS-SERVICE: Type Drift

**Date:** 2026-04-16
**Severity:** HIGH across all codebases

---

## Shared Types Package

Canonical types live in: `packages/shared-types/src/entities/`

| Entity | Canonical File | Issues |
|--------|---------------|--------|
| `IKarmaProfile` | `karma.ts` | Local `KarmaProfile` missing 5 fields |
| `IKarmaEvent` | `karma.ts` | Local `KarmaEvent` has 27 fields vs 15 canonical |
| `IOrder` | `order.ts` | Field name mismatches across all services |
| `IUser` | `user.ts` | `_id` vs `id`, optional vs required fields |
| `IMerchant` | `merchant.ts` | `phone` vs `phoneNumber`, `userId` vs `user` |
| `IPayment` | `payment.ts` | `razorpayOrderId` vs `gatewayOrderId` |

---

## Consumer App Type Issues

| ID | Local Type | Issue |
|----|-----------|-------|
| TF-01 | `CoinType` | 4/5/6 values across 6 files |
| TF-02 | `TransactionType` | SCREAMING_CASE vs lowercase |
| TF-03 | `User.role` | Missing `support`, `operator`; adds fake `moderator` |
| TF-07 | `Offer._id` | vs `Offer.id` in same app |
| TF-12 | User ID | `_id` vs `id` — cross-service lookups get `undefined` |
| TF-17 | Loyalty tier | `rezPlusTier` vs `loyaltyTier` vs `subscriptionTier` |

---

## Rendez App Type Issues

| ID | Local Type | Issue |
|----|-----------|-------|
| RZ-KU-C3 | `KarmaEvent` | 27 local fields vs 15 canonical — almost no overlap |
| RZ-M-A5 | `Merchant` | API returns `merchant_id`, UI reads `merchant.name` |
| RZ-A-L4 | `FraudFlag` | UI reads `f.profile`, backend returns `f.user` |

---

## Prevention

1. Delete all local enum definitions — import from `packages/shared-types`
2. Add ESLint rule: `no-restricted-imports` — block imports from local `types/` dirs
3. Add a CI check that validates all API response types against shared-types
4. Use `ts-prune` to find unused exports

---

## Status: ACTIVE
