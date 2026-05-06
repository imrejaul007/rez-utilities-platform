# ReZ NoW — Cross-Repo Mismatches

**How REZ-NOW diverges from other REZ repos. These are the bridges that break.**

---

## Cross-Repo Issue Families

| # | Family | Description | Crosses To |
|---|--------|-------------|------------|
| NW-XREP-001 | Duplicate OrderHistoryItem definitions | Defined in both `lib/types/index.ts` and `lib/api/orderHistory.ts` with incompatible shapes | `06-CONSUMER-AUDIT-2026`, `08-REZ-ADMIN` |
| NW-XREP-002 | Status enum fragmentation | REZ-NOW uses lowercase `'confirmed'`; other repos use mixed casing | All REZ repos |
| NW-XREP-003 | No shared coupon type | `Coupon` in REZ-NOW differs from `Coupon` in `rez-app-consumer` and `rez-shared` | Consumer app, shared-types |
| NW-XREP-004 | No shared WebOrderStatus | REZ-NOW defines its own `WebOrderStatus` type; `rez-app-consumer` defines a different one | Consumer app |
| NW-XREP-005 | Socket.IO auth pattern mismatch | REZ-NOW doesn't pass auth tokens to Socket.IO handshake; `rez-app-consumer` may have different pattern | Consumer app |
| NW-XREP-006 | No shared idempotency pattern | REZ-NOW has broken idempotency keys; `rez-app-consumer` may have working ones | Consumer app, backend |
| NW-XREP-007 | Cart persistence key mismatch | REZ-NOW uses `'rez-cart'`; other apps may use different keys | Consumer app |
| NW-XREP-008 | No shared currency utils | REZ-NOW has its own `currency.ts`; `rez-app-consumer` and `rez-shared` have different versions | Consumer app, shared |
| NW-XREP-009 | razorpay signature handling gap | REZ-NOW never captures `razorpay_signature`; backend expects it for verification | Backend (payment service) |
| NW-XREP-010 | WalletBalance type divergence | REZ-NOW has `coins`, `rupees`, `tier`; `rez-app-consumer` wallet store may differ | Consumer app, wallet service |

---

## Type Divergence Matrix

| Type | REZ-NOW | rez-app-consumer | rez-shared | Status |
|------|---------|-----------------|------------|--------|
| `OrderStatus` | Lowercase union | Mixed | Mixed | NW-XREP-001, NW-XREP-002 |
| `Coupon` | `minOrderValue` | `minOrderAmount` | ? | NW-XREP-003 |
| `WebOrderStatus` | Custom union | Custom union | ? | NW-XREP-004 |
| `WalletBalance` | `coins/rupees/tier` | `balance/coins/tier` | ? | NW-XREP-010 |
| `RazorpayOrder` | Partial (missing signature) | ? | ? | NW-XREP-009 |
| `IdempotencyKey` | Uses Date.now() (broken) | May differ | Should be shared | NW-XREP-006 |

---

## API Contract Mismatches

### NW-XREP-011: cancelOrder endpoint path inconsistency
- REZ-NOW: `lib/api/cancellation.ts` uses `POST /api/web-ordering/orders/${orderNumber}/cancel`
- REZ-NOW: `lib/api/orders.ts` uses `POST /api/web-ordering/order/${orderNumber}/cancel` (singular!)
- Cross-repo: If `rez-app-consumer` or `rez-app-merchant` use a third variant, the same order could be cancelled by different apps hitting different endpoints

### NW-XREP-012: Scan-pay vs Order payment coin formulas diverge
- REZ-NOW `app/[storeSlug]/pay/page.tsx:59-61`: Scan-pay formula divides by 10 twice
- REZ-NOW checkout formula: `(effectiveAmount / 100 / 10) * rate`
- `rez-app-consumer` may have a third formula
- Impact: Same transaction via scan vs order credits different coin amounts

### NW-XREP-013: Waiter endpoint uses publicClient — other apps may use authClient
- REZ-NOW `lib/api/waiter.ts`: Uses `publicClient` (no auth)
- `rez-app-merchant` waiter endpoints likely use `authClient`
- Inconsistent auth patterns across the same feature in different apps

### NW-XREP-014: WebSocket room names differ across apps
- REZ-NOW subscribes to `payment:${razorpayOrderId}` room
- `rez-app-consumer` may subscribe to `order:${orderId}` room
- `rez-backend` may emit on `payment:confirmed` with different payload shapes
- Real-time updates silently break across app boundaries

---

## Enum Fragmentation

### NW-XREP-015: Order Status Values

| App | Pending | Confirmed | Preparing | Ready | Completed | Cancelled |
|-----|---------|-----------|-----------|-------|-----------|-----------|
| REZ-NOW | `pending_payment` | `confirmed` | `preparing` | `ready` | `completed` | `cancelled` |
| Consumer App | ? | ? | ? | ? | ? | ? |
| Backend | `PENDING_PAYMENT` | `CONFIRMED` | `PREPARING` | `READY` | `COMPLETED` | `CANCELLED` |
| Admin | ? | ? | ? | ? | ? | ? |

See `09-CROSS-SERVICE-2026/ENUM-FRAGMENTATION.md` for full matrix.

### NW-XREP-016: Payment Status Values

| App | Pending | Paid | Failed | Expired |
|-----|---------|------|--------|---------|
| REZ-NOW | `pending` | `paid` | `failed` | `expired` |
| Consumer App | ? | ? | ? | ? |
| Payment Service | `PENDING` | `SUCCESS` | `FAILED` | `EXPIRED` |
| Admin | ? | ? | ? | ? |

### NW-XREP-017: Bill Status Values

| App | Pending | Paid | Cancelled | Expired | Confirmed | Rejected |
|-----|---------|------|-----------|---------|-----------|----------|
| REZ-NOW | `pending` | `paid` | `cancelled` | `expired` | (not in type!) | (not in type!) |
| Pay Display | `pending` | `confirmed` | `rejected` | — | — | — |
| Transaction List | `pending` | `completed` | — | — | — | — |

---

## Shared Types Gap Analysis

REZ-NOW should import from `packages/shared-types/` but likely has local type definitions that have drifted:

| Type | In shared-types? | In REZ-NOW? | Drifted? |
|------|----------------|-------------|---------|
| `WebOrderStatus` | Likely | Yes | YES — NW-XREP-004 |
| `OrderHistoryItem` | No | Yes | YES — NW-XREP-001 |
| `Coupon` | No | Yes | YES — NW-XREP-003 |
| `WalletBalance` | No | Yes | YES — NW-XREP-010 |
| `RazorpayOrder` | No | Partial | YES — NW-XREP-009 |

**Recommendation:** Create canonical type definitions in `packages/shared-types/src/` and import everywhere. No app should define its own `OrderStatus` or `WebOrderStatus`.

---

## Fix Priority for Cross-Repo Issues

1. **NW-XREP-002, NW-XREP-015, NW-XREP-016, NW-XREP-017** — Define canonical status enums in shared-types
2. **NW-XREP-001** — Consolidate `OrderHistoryItem` to one definition
3. **NW-XREP-003** — Consolidate `Coupon` type
4. **NW-XREP-004** — Consolidate `WebOrderStatus`
5. **NW-XREP-006** — Fix idempotency keys across all apps
6. **NW-XREP-009** — Ensure Razorpay signature handling is consistent
7. **NW-XREP-012** — Align coin formulas across scan-pay and order flows
