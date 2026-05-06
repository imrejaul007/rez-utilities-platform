# Gen 14 — Cross-Repo Mismatch Analysis

**Generated:** 2026-04-16 | **Status:** 11 mismatch families

This document maps every API contract, type, and enum mismatch found across the ReZ platform repos. Each mismatch is a bug waiting to happen — fixing one often resolves multiple downstream issues.

---

## 1. API Contract Mismatches (Frontend ↔ Backend)

### XRM-01: Missing voucherCode + offerRedemptionCode in Order Payload
| Aspect | Value |
|--------|-------|
| **Frontend sends** | `CreateOrderRequest` without `voucherCode`, `offerRedemptionCode` |
| **Backend expects** | `req.body.voucherCode`, `req.body.offerRedemptionCode` |
| **Location** | `ordersApi.ts` vs `orderCreateController.ts` |
| **Severity** | CRITICAL |
| **Impact** | All order creations fail or silently ignore vouchers |
| **Cross-Repo** | `rez-app-consumer` → `rezbackend` |

### XRM-02: Missing store.merchantId in Admin Order Response
| Aspect | Value |
|--------|-------|
| **Frontend expects** | `order.store: { _id, name, merchantId }` |
| **Backend returns** | `order.store: { _id, name }` (populates `_id name logo` only) |
| **Location** | `orders.ts` (admin) vs `orderController.ts` |
| **Severity** | CRITICAL |
| **Impact** | Admin "Filter by merchant" returns ALL orders — data leak |
| **Cross-Repo** | `rez-app-admin` → `rezbackend` |

### XRM-03: Product Creation Response Schema Unverified
| Aspect | Value |
|--------|-------|
| **Frontend sends** | `CreateProductRequest` with 15+ fields (cashback, inventory, images, etc.) |
| **Backend returns** | Response schema not verified |
| **Location** | `products.ts` (merchant) vs `productController.ts` |
| **Severity** | CRITICAL |
| **Impact** | Merchant dashboard can't display/edit product details if response is sparse |
| **Cross-Repo** | `rez-app-marchant` → `rez-merchant-service` |

### XRM-04: Wallet Balance Response Has 3 Shapes
| Aspect | Value |
|--------|-------|
| **Shape A** | `response.data.balance.available` |
| **Shape B** | `response.data.coins.available` |
| **Shape C** | `response.data.balance[0].available` |
| **Location** | `coinSyncService.ts` |
| **Severity** | HIGH |
| **Impact** | Balance may be zero or undefined depending on which path fires |
| **Cross-Repo** | `rez-app-consumer` ↔ `rez-wallet-service` ↔ `rezbackend` |

### XRM-05: delivery.totals.delivery vs delivery.deliveryFee
| Aspect | Value |
|--------|-------|
| **Field A** | `order.totals.delivery` |
| **Field B** | `order.delivery.deliveryFee` |
| **Location** | `ordersApi.ts:71, 106` |
| **Severity** | HIGH |
| **Impact** | UI may read wrong field, delivery cost in reports inconsistent |
| **Cross-Repo** | `rez-app-consumer` ↔ `rezbackend` |

---

## 2. Type / Schema Mismatches

### XRM-06: IEarnRecord.verificationSignals — Canonical vs Actual
| Aspect | Value |
|--------|-------|
| **Canonical** (`packages/shared-types`) | `{ gps_match?: number; qr_verified?: boolean; face_verified?: boolean; manual_override?: boolean }` |
| **Actual** (`karma-service`) | `{ qr_in, qr_out, gps_match, ngo_approved, photo_proof }` |
| **Severity** | CRITICAL |
| **Impact** | All consumer/admin apps using canonical type read wrong fields |
| **Cross-Repo** | `packages/shared-types` ↔ `rez-karma-service` ↔ `rez-app-consumer` ↔ `rez-app-admin` |
| **Related** | G-KS-C10, XREP-11 |

### XRM-07: 3 Incompatible CoinTransaction Schemas
| Aspect | Value |
|--------|-------|
| **Monolith writes** | `coinType, source, description, balance, coinStatus` |
| **Wallet-service writes** | `coinType, source, balanceBefore, balanceAfter, sourceId` |
| **Merchant-service writes** | `coins, storeId, orderId, reason, status` |
| **Severity** | CRITICAL |
| **Impact** | Same collection, 3 incompatible schemas. Audit trail corrupted. |
| **Cross-Repo** | `rezbackend` ↔ `rez-wallet-service` ↔ `rez-merchant-service` |

### XRM-08: Phantom coins.available Balance Never Synced
| Aspect | Value |
|--------|-------|
| **UserLoyalty model** | Maintains `coins.available` locally |
| **Wallet model** | Maintains `balance.available` |
| **Sync** | No code path keeps them in sync |
| **Severity** | HIGH |
| **Impact** | UI displaying `UserLoyalty.coins.available` shows wrong balance |
| **Cross-Repo** | `rezbackend` ↔ `rez-app-consumer` ↔ `rez-app-admin` |

### XRM-09: Wallet Microservice Missing 3+ Fields
| Aspect | Value |
|--------|-------|
| **Monolith wallet has** | `categoryBalances`, `limits`, `settings`, `savingsInsights`, `statistics` |
| **Wallet-service wallet has** | Subset only |
| **Impact** | Fields permanently zeroed on every wallet-service write |
| **Severity** | HIGH |
| **Cross-Repo** | `rez-wallet-service` ↔ `rezbackend` |

---

## 3. Enum / Status Mismatches

### XRM-10: Payment/Order Status — 15+ Variants Across 6 Repos
| Service | Values Used |
|---------|------------|
| `rez-contracts` | `"pending" \| "processing" \| "completed" \| "failed" \| "cancelled" \| "refunded"` |
| `rez-app-consumer` (payment) | `"pending" \| "processing" \| "completed" \| "failed" \| "cancelled"` |
| `rez-app-consumer` (subscription) | `"paid" \| "failed" \| "pending"` |
| `rez-app-consumer` (points) | `"pending" \| "completed" \| "cancelled" \| "expired"` |
| `rez-app-consumer` (bonus) | `"pending" \| "verified" \| "credited" \| "rejected" \| "expired"` |
| `rez-app-marchant` (POS) | `"pending" \| "paid" \| "cancelled" \| "expired"` |
| `rez-app-marchant` (wallet) | `"pending" \| "completed" \| "failed" \| "cancelled"` |
| `rez-app-admin` (payroll) | `"processed" \| "pending" \| "failed"` |
| `rez-app-admin` (creators) | `"paid"` (uppercase) |
| `rez-karma-service` (EarnRecord) | `'PENDING' \| 'VERIFIED' \| 'CONVERTED' \| 'FAILED'` |
| **Severity** | HIGH |
| **Impact** | Status checks fail silently. Orders stuck. Payments shown as wrong state. |
| **Cross-Repo** | All 6 repos |

### XRM-11: POS Bill Status — paid vs completed
| Aspect | Value |
|--------|-------|
| **POS uses** | `'pending' \| 'paid' \| 'cancelled' \| 'expired'` |
| **Canonical uses** | `'pending' \| 'processing' \| 'completed' \| 'failed' \| 'cancelled' \| 'refunded'` |
| **Gap** | No `'completed'`, no `'processing'`, no `'refunded'` |
| **Severity** | HIGH |
| **Impact** | Refund flow impossible on POS bills |
| **Cross-Repo** | `rez-app-marchant` ↔ `rez-contracts` |

---

## 4. Cross-Service Call Failures

### XRM-12: Karma Routes Return 501 — Full Service Non-Functional
| Aspect | Value |
|--------|-------|
| **Routes implemented** | `karmaRoutes.ts`, `verifyRoutes.ts`, `batchRoutes.ts` |
| **Routes mounted** | 501 stubs in `routes/index.ts` |
| **Severity** | CRITICAL |
| **Impact** | Karma user endpoints inaccessible. Entire karma-to-coin pipeline non-functional. |
| **Cross-Repo** | `rez-karma-service` (internal) |

### XRM-13: Wallet Service Has No Authentication
| Aspect | Value |
|--------|-------|
| **Caller** | `karma-service/walletIntegration.ts` |
| **Callee** | `WALLET_SERVICE_URL` (http, no auth) |
| **Severity** | CRITICAL |
| **Impact** | Internal network compromise → arbitrary wallet credit |
| **Cross-Repo** | `rez-karma-service` → `rez-wallet-service` |

### XRM-14: CrossAppSyncService Webhook Dead Code
| Aspect | Value |
|--------|-------|
| **Source** | `Rendez/rendez-backend/CrossAppSyncService.ts` |
| **Destination** | Consumer app webhook consumers |
| **Severity** | CRITICAL |
| **Impact** | Merchant changes never reach consumer app |
| **Cross-Repo** | `Rendez` → `rez-app-consumer` |

### XRM-15: Karma Service → Wallet Service Auth Gap
| Aspect | Value |
|--------|-------|
| **Issue** | No `Authorization` header on wallet service calls |
| **Severity** | CRITICAL |
| **Impact** | Service-to-service auth nonexistent |
| **Cross-Repo** | `rez-karma-service` → `rez-wallet-service` |

---

## 5. Duplicate Logic (Same Thing Built Twice)

### XRM-16: 3 normalizeOrderStatus Implementations
| Location | Variation |
|---------|-----------|
| Consumer app | Own implementation |
| Merchant app | Own implementation |
| Shared package | Own implementation |
| **Severity** | HIGH |
| **Impact** | Same status normalizes differently depending on which surface calls it |

### XRM-17: Merchant Loyalty Config — Byte-for-Byte Duplicated
| Location | State |
|---------|-------|
| `rezbackend/models/MerchantLoyaltyConfig.ts` | Identical copy |
| `rez-merchant-service/models/MerchantLoyaltyConfig.ts` | Identical copy |
| **Severity** | MEDIUM |
| **Impact** | Schema migration must be applied in both places manually |

---

## Cross-Repo Fix Priority

| Priority | Mismatches | Est. Total |
|----------|-----------|-----------|
| Fix First | XRM-01, XRM-02, XRM-06, XRM-07, XRM-12, XRM-14 | ~12h |
| High | XRM-04, XRM-05, XRM-08, XRM-09, XRM-10, XRM-11, XRM-16 | ~15h |
| Medium | XRM-03, XRM-13, XRM-15, XRM-17 | ~8h |
| **TOTAL** | 17 mismatch families | **~35h** |

---

## Unified Fix Strategy

Many of these mismatches share root causes. Fixing the root fixes multiple:

| Root Cause | Mismatches Fixed | Fix |
|-----------|-----------------|-----|
| **No shared schema contracts** | XRM-06, XRM-07, XRM-10, XRM-11, XRM-16 | Canonical schemas in `rez-contracts` + ESLint enforcement |
| **Routes written but never wired** | XRM-12, XRM-14 | Wire up existing implementations |
| **No service-to-service auth** | XRM-13, XRM-15 | Add JWT/HMAC for all internal calls |
| **Frontend/backend evolved separately** | XRM-01, XRM-02, XRM-03, XRM-04, XRM-05 | Contract-first development with shared types |
| **Phantom/unused fields** | XRM-08, XRM-09 | Remove or sync |
