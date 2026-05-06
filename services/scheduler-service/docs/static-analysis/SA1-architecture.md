# SA1: Module Dependency Graph + Architectural Violations
Generated: 2026-04-12 | Branch: audit/recovery-phase

---

## GOD MODULES (files >500 lines — top offenders)

| File | Lines | Severity |
|------|-------|----------|
| `rezbackend/src/merchantroutes/analytics.ts` | **3,157** | CRITICAL |
| `rezbackend/src/merchantroutes/products.ts` | **2,858** | CRITICAL |
| `rezbackend/src/routes/webOrderingRoutes.ts` | **2,831** | CRITICAL |
| `rezbackend/src/controllers/gamificationController.ts` | **2,266** | CRITICAL |
| `rezbackend/src/merchantroutes/auth.ts` | **2,268** | CRITICAL |
| `rezbackend/src/merchantroutes/dashboard.ts` | **2,308** | CRITICAL |
| `rezbackend/src/controllers/productController.ts` | **2,134** | HIGH |
| `rezbackend/src/controllers/orderCreateController.ts` | **2,078** | HIGH |
| `rezbackend/src/services/gameService.ts` | **1,940** | HIGH |
| `rezbackend/src/controllers/walletPaymentController.ts` | **1,933** | HIGH |
| `rezbackend/src/merchantroutes/stores.ts` | **1,827** | HIGH |
| `rezbackend/src/controllers/authController.ts` | **1,722** | HIGH |
| `rezbackend/src/controllers/loyaltyController.ts` | **1,555** | HIGH |
| `rezbackend/src/routes/admin/system.ts` | **1,381** | HIGH |
| `rezbackend/src/routes/admin/orders.ts` | **1,314** | HIGH |
| `rezbackend/src/routes/admin/merchants.ts` | **1,166** | HIGH |
| `rezbackend/src/routes/rendezPartnerRoutes.ts` | **1,082** | HIGH |
| `rezapp/nuqta-master/contexts/CartContext.tsx` | **1,300** | HIGH |
| `rezapp/nuqta-master/contexts/AuthContext.tsx` | **955** | HIGH |
| `rezapp/nuqta-master/contexts/GamificationContext.tsx` | **775** | HIGH |
| `rezapp/nuqta-master/contexts/SocketContext.tsx` | **704** | MEDIUM |
| `rezadmin/rez-admin-main/contexts/AuthContext.tsx` | **523** | MEDIUM |
| `rezmerchant/rez-merchant-master/contexts/AuthContext.tsx` | **532** | MEDIUM |

---

## CIRCULAR DEPENDENCIES

**None detected.** However, one near-cycle exists:
```
WalletContext → SocketContext
GamificationContext → WalletContext → SocketContext
PriveContext → WalletContext → SocketContext
```
`WalletContext` is one import away from a cycle if `GamificationContext` or `PriveContext` ever get imported back into it.

---

## CROSS-LAYER VIOLATIONS (route→model direct, bypassing service layer)

32 confirmed violations. Top severity examples:

| # | File | Violation |
|---|------|-----------|
| 1 | `routes/adminDashboardRoutes.ts` | Full `CoinTransaction.aggregate()` + `User.countDocuments()` inline in route handler |
| 2 | `routes/groupBuyRoutes.ts` | Full group-buy business logic + `CoinTransaction` inline (246 lines) |
| 3 | `routes/admin/fraudReports.ts:18` | **Defines FraudReport Mongoose schema inline in route file** |
| 4 | `routes/admin/notificationManagement.ts:32` | **Defines NotificationTemplate schema inline in route file** |
| 5 | `routes/rendezPartnerRoutes.ts:62` | **Defines RendezWalletHoldSchema + RendezGiftVoucherSchema inline** |
| 6 | `routes/savingsInsights.ts` | Haversine distance formula + business logic inline in route |
| 7 | `merchantroutes/analytics.ts` | Entire analytics domain (3,157 lines) — DB, Redis, trend calc, all in route |
| 8 | `merchantroutes/products.ts` | Full product CRUD (2,858 lines), no service layer |
| 9 | `merchantroutes/dashboard.ts` | Full BI dashboard (2,308 lines), all inline |
| 10 | `merchantroutes/auth.ts` | Full auth logic (2,268 lines), inline DB calls |
| 11 | `rez-merchant-service/src/routes/dealRedemptions.ts` | Full redemption flow inline (528 lines) |
| 12 | `rez-merchant-service/src/routes/exports.ts` | 5 models imported directly in route |

---

## CONTROLLER-TO-CONTROLLER IMPORTS

| File | Violation |
|------|-----------|
| `controllers/orderUpdateController.ts:31` | Imports `getStoreCategorySlug` from `orderCreateController` |
| `controllers/storeCrudController.ts:12` | Imports `getCategoryRootMap` from `orderCreateController` |

`orderCreateController` is being used as an implicit utility library. Shared helpers should be extracted to `utils/orderHelpers.ts` or `services/categoryService.ts`.

---

## HARDCODED VALUES (runtime bugs if env changes)

| File | Value | Risk |
|------|-------|------|
| `controllers/orderCreateController.ts:905-930` | `taxRate = 0.05`, `FREE_DELIVERY_THRESHOLD = 500`, `STANDARD_DELIVERY_FEE = 50` | HIGH — business rules in code |
| `routes/webOrderingRoutes.ts:724-789` | Inline tax + coupon calculation `subtotal * gstPercent / 100` | HIGH |
| `routes/groupBuyRoutes.ts:22` | `COINS_PER_PAISE = 0.05` | HIGH |
| `routes/admin/orders.ts:1190,1216` | `new Types.ObjectId('000000000000000000000002')` platform float ID | HIGH |
| `controllers/orderCreateController.ts:1653` | Same hardcoded platform float ID | HIGH |
| `services/gameService.ts:526,622` | Same hardcoded ID in different service | HIGH |
| `services/ShippingLabelService.ts:12` | `'http://localhost:5000'` fallback URL | MEDIUM |
| `services/EmailService.ts:171,201,260` | `'http://localhost:3000'` in email templates | MEDIUM |
| `merchantroutes/auth.ts:738,1457` | `'http://localhost:3000'` in merchant verification URLs | MEDIUM |

---

## UTILITY FUNCTION DUPLICATION

| Function | Count | Files |
|----------|-------|-------|
| `formatDate()` | 5+ | rezapp (3 util files) + rezmerchant (2 util files) |
| `formatPrice()` | 7+ | 5 rezapp util files + rezmerchant |
| `formatCurrency()` | 3 | rezapp (2) + rezmerchant (1) |
| `validateEmail()` | 3 | rezapp + rezmerchant (2) |
| `debounce()` | 3 | rezapp (2) + rezadmin (1) |
| `AuthContext` | 3 | One per app, independently implemented |
| `SocketContext` | 2 | rezapp + rezmerchant |

---

## REAL vs IDEAL ARCHITECTURE

### Backend
| Domain | Current | Ideal |
|--------|---------|-------|
| Merchant Analytics | 3,157-line route with inline DB aggregation | `routes/` → `controllers/` → `services/AnalyticsService.ts` → `models/` |
| Merchant Products | 2,858-line route, no service layer | Same decomposition |
| Merchant Auth | 2,268-line route with inline Mongoose calls | `services/MerchantAuthService.ts` |
| Web Ordering | 2,831-line route with inline tax/coupon logic | `services/WebOrderService.ts` |
| Business Constants | Scattered in controllers/routes | Centralized `config/businessRules.ts` |
| Inline Schemas | 4 files | All in `models/` directory |

### Frontend
| Domain | Current | Ideal |
|--------|---------|-------|
| Utility functions | Duplicated 3-7x across apps | Extracted to `rez-shared` package |
| AuthContext | 3 independent implementations | Shared `useAuthBase()` hook in `rez-shared` |
| CartContext (consumer) | 1,300-line monolith | Split into Cart/Checkout/Payment contexts |
| GamificationContext | 775-line, 5 API dependencies | Split into Achievement/Coin/Challenge contexts |
