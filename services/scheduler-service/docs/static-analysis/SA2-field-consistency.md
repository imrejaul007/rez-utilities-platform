# SA2: Field Consistency Matrix + Database Architecture Report
Generated: 2026-04-12 | Branch: audit/recovery-phase

---

## CRITICAL ISSUES

### 1. rez-merchant-service Ghost Schemas on Shared Collections — CRITICAL
- **50+ models** in rez-merchant-service use `{}` empty schemas with `strict: false`
- They share the same MongoDB collections as rez-backend (orders, stores, products, users, servicebookings, wallets)
- Merchant-service writes bypass all backend schema validation
- Backend schema changes break merchant-service silently (no errors, wrong data)
- **Files**: `rez-merchant-service/src/models/Order.ts`, `Store.ts`, `Product.ts`, `User.ts`, `ServiceBooking.ts`, `WalletTransaction.ts`, `MerchantWallet.ts` (+ ~35 more)

### 2. Payment Status Bifurcation — CRITICAL
- `Payment` model uses `completed` for a paid payment
- `Order.payment.status` uses `paid` for the same thing
- Cross-model reconciliation queries will return zero results
- **Explicitly documented with warning comment in `Order.ts:64-68`**

### 3. Address Field 4-Way Split — CRITICAL
| Context | Field name |
|---------|-----------|
| Backend `Address` model | `postalCode` |
| Backend `Order.delivery.address` | `pincode` |
| Backend `Order.shippingAddress` (deprecated) | `zipCode` |
| Backend `Merchant.businessAddress` | `zipCode` |
| Consumer `addressApi` | `postalCode` |
| Consumer `ordersApi` delivery | `pincode` |
| Consumer `ordersApi` billing (deprecated) | `zipCode` |
| Merchant models | `postalCode` (unified types), `pincode` (other types) |
| Admin | `zipCode` |
- Converter partial fix: `postalCode: data?.postalCode || data?.zip` — incomplete fallback chain

### 4. Store `merchantId` vs `merchant` Hook-Dependent Sync — CRITICAL
- rez-backend Store: `merchantId` field (ref: Merchant)
- rez-merchant-service Store: `merchant` field (ref: Merchant) + pre-save hook mirrors to `merchantId`
- `updateOne`/`findByIdAndUpdate` **bypass pre-save hooks** — documents can end up with only one field
- Index mismatch: merchant-service indexes `{ merchant: 1 }`, backend queries on `{ merchantId: 1 }`

---

## HIGH SEVERITY

### 5. User Tier Enum — Backend UPPERCASE 6-tier vs Frontend lowercase 4-tier
| Layer | Field | Values |
|-------|-------|--------|
| Backend `User.ts` | `referralTier` | `STARTER, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND` |
| Consumer app | `loyaltyTier` | `bronze, silver, gold, platinum` |
| Admin app | `tier` | `bronze, silver, gold, platinum` |
| Merchant app | not defined | — |
- Any `if (tier === 'gold')` check in frontend is ALWAYS false against backend data

### 6. Product Price — Three Incompatible Field Names
| Layer | Selling price | Sale price |
|-------|--------------|-----------|
| Backend | `pricing.selling` | `pricing.original` |
| Consumer app | `price.current` | `price.original` |
| Merchant app | `price.regular` | `price.sale` |

### 7. Order Item Price — `price`/`subtotal` vs `unitPrice`/`totalPrice`
- Backend: `items[].price`, `items[].subtotal`
- Merchant rez-master types: `items[].unitPrice`, `items[].totalPrice`
- Consumer: both (transitional — legacy uses `unitPrice`/`totalPrice`, new uses `price`/`subtotal`)

### 8. Consumer App Order Status Includes 3 Dead Enum Values
- Consumer `ordersApi.ts:53` includes `'pending'`, `'processing'`, `'shipped'` in status union
- Backend FSM never emits these — backend uses `'placed'` (not `'pending'`)
- Any switch/case handling `'pending'` in consumer will never fire; users may see blank order status

### 9. UserSubscription `strict: false` — DB-06 (tagged for audit)
- File: `rezbackend/src/models/UserSubscription.ts`
- Unknown fields being written to subscription documents
- Financial/billing calculation may be affected

---

## MEDIUM SEVERITY

### 10. Order → `merchant` Field (merchant-service) vs `store.merchantId` (backend)
- rez-merchant-service Order model has `merchant: ObjectId` (ref: Merchant) — not in backend schema
- Backend finds merchant orders via `store.merchantId` populate
- Merchant-service indexes `{ merchant: 1 }` on a field backend doesn't know about

### 11. WalletData Structure Flattening (Consumer)
| Backend Wallet | Consumer WalletData |
|---------------|---------------------|
| `balance.total` | `totalBalance` |
| `balance.available` | `availableBalance` |
| `balance.cashback` | `cashbackBalance` |
| `balance.pending` | `pendingRewards` |
- API serialization layer must map these; if broken, wallet shows 0 silently

### 12. Merchant Status: `verified` vs `approved`, `rejected` vs `failed`
- Backend verification: `verified`, `rejected`
- Admin app status field: `approved` (maps to computed virtual)
- Admin app verificationStatus: `failed` (where backend says `rejected`)

---

## FIELD CONSISTENCY MATRIX — SUMMARY

### User Entity
| Field | Backend | Consumer | Merchant | Admin |
|-------|---------|----------|----------|-------|
| postal code | `profile.location.pincode` | `profile.location.pincode` | `postalCode` | — |
| wallet balance | `wallet.balance` (nested) | `walletBalance` (flat) | `walletBalance` (flat) | `coinBalance` (flat) |
| user role | 6 roles incl. support/operator | 3 roles | — | 3 roles |
| tier | `referralTier` UPPERCASE 6-tier | `loyaltyTier` lowercase 4-tier | — | `tier` lowercase 4-tier |
| suspension | `isSuspended` | ❌ missing | ❌ missing | `isSuspended` + `status:'suspended'` |
| nuqtaPlusTier | ✅ backend only | ❌ missing | ❌ missing | ❌ missing |
| priveTier | ✅ backend only | ❌ missing | ❌ missing | ❌ missing |
| segment | ✅ backend | ❌ missing | ❌ missing | ✅ admin |

### Order Entity
| Field | Backend | Consumer | Merchant | Admin |
|-------|---------|----------|----------|-------|
| user link | `user: ObjectId` | `userId: string` | `customer: {}` embedded | `user: { _id, profile }` |
| total | `totals.total` | `totals.total` | `pricing.totalAmount` | `totals.total` |
| delivery cost | `totals.delivery` | `totals.delivery` | `pricing.delivery` + `pricing.shippingAmount` | `totals.deliveryFee` |
| payment status | 8 values | 4 values (missing 4) | 8 values | 8 values |
| order status | 11 canonical | 11 + 3 dead legacy | 11 canonical | 11 canonical |

### Address Entity
| Field | Backend Address | Backend Order | Backend Merchant | Consumer | Admin |
|-------|----------------|---------------|-----------------|----------|-------|
| postal code | `postalCode` | `pincode`/`zipCode` | `zipCode` | `postalCode`/`pincode` | `zipCode` |

---

## STRICT:FALSE INVENTORY

### rezbackend (10 confirmed models)
MerchantStaff, MerchantInvoice, MerchantGoal, MerchantPayout, PosBill, AdminBroadcast, MerchantDispute, UserSubscription (DB-06), GroupBuy, MerchantTemplate

### rez-merchant-service (~50+ models — ALL use strict:false)
All models are ghost schemas. Critical shared-collection models:
- `Order.ts` — empty `{}`, shares `orders` collection
- `Store.ts` — empty `{}`, shares `stores` collection  
- `Product.ts` — empty `{}`, shares `products` collection
- `User.ts` — empty `{}`, shares `users` collection
- `ServiceBooking.ts` — empty `{}`, shares `servicebookings` collection
- `WalletTransaction.ts` — empty `{}`, unconstrained
- `MerchantWallet.ts` — empty `{}`, unconstrained
