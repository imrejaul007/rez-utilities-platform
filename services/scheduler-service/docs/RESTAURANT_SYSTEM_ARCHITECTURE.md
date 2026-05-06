# Restaurant System Architecture — Complete Guide

## Overview

REZ's restaurant system is a distributed microservices platform for managing the complete order lifecycle: from customer menu browsing → order placement → merchant receiving → kitchen operations → delivery tracking.

**Key Components:**
- Customer apps (mobile + web QR menu)
- Merchant/restaurant management apps
- Platform admin dashboard
- Microservices (order, merchant, catalog, marketing)
- Real-time Socket.IO infrastructure for KDS and order tracking

---

## 1. Order Lifecycle State Machine

**Source:** [rezbackend/src/config/orderStateMachine.ts](../rezbackend/rez-backend-master/src/config/orderStateMachine.ts)

### Linear Progress States (placed → delivered)
```
placed → confirmed → preparing → ready → dispatched → out_for_delivery → delivered
```

### Full State Graph (with branches)
```
placed
  ├→ confirmed
  │   ├→ preparing
  │   │   ├→ ready
  │   │   │   ├→ dispatched
  │   │   │   │   ├→ out_for_delivery
  │   │   │   │   │   └→ delivered
  │   │   │   │   │       ├→ returned → refunded
  │   │   │   │   │       └→ refunded
  │   │   │   │   └→ delivered (skip out_for_delivery if pickup/dine_in)
  │   │   │   └→ cancelled (rare, order was ready)
  │   │   └→ cancelled
  │   └→ cancelled
  ├→ cancelled
  └→ cancelling (transient state during cancel processing)
     └→ cancelled or rollback to previous state
```

### SLA Thresholds (minutes)
| Status | Threshold | Meaning |
|---|---|---|
| `placed` | 60 | Merchant must confirm within 1 hour |
| `confirmed` | 30 | Must start preparing within 30 min |
| `preparing` | 120 | Must finish prep within 2 hours |
| `ready` | 30 | Must dispatch within 30 min |
| `dispatched` | 180 | Must deliver within 3 hours |
| `out_for_delivery` | 120 | Final delivery deadline |

### Transition Rules

**Merchants can ONLY move orders forward:**
```
confirmed → preparing → ready → dispatched → out_for_delivery → delivered
```

Merchants **cannot**:
- Cancel orders (platform/customer handles)
- Skip steps (must follow linear progression)
- Revert to previous states

**State machine enforcement:**
- ✅ [rezbackend/src/config/orderStateMachine.ts](../rezbackend/rez-backend-master/src/config/orderStateMachine.ts) — Canonical rules
- ✅ [rez-merchant-service/src/utils/orderStateMachine.ts](../rez-merchant-service/src/utils/orderStateMachine.ts) — Merchant-service enforcement (NEW)
- ✅ [rez-merchant-service/src/routes/orders.ts:PATCH](../rez-merchant-service/src/routes/orders.ts) — Uses state machine validation (UPDATED)

---

## 2. Customer Ordering Flow

### Entry Points

#### A) Mobile App (rez-master)
**Flow:** Store list → Menu → Cart → Checkout → Confirmation → Tracking

**Key files:**
- [Store.tsx](../rezapp/rez-master/app/Store.tsx) — Store detail page
- [cart.tsx](../rezapp/rez-master/app/cart.tsx) — Cart review
- [checkout.tsx](../rezapp/rez-master/app/checkout.tsx) — Payment selection
- [order/[storeSlug]/checkout.tsx](../rezapp/rez-master/app/order/[storeSlug]/checkout.tsx) — Final checkout
- [orders/[orderId]/tracking.tsx](../rezapp/rez-master/app/orders/[orderId]/tracking.tsx) — Real-time tracking

#### B) Web QR Menu (rez-web-menu) — Dine-In
**Flow:** Scan QR → Menu → Cart → Checkout (OTP, coins, payment) → Confirmation → Track

**Key files:**
- [MenuPage.tsx](../rez-web-menu/src/pages/MenuPage.tsx) — Full menu + filters + search
- [CartPage.tsx](../rez-web-menu/src/pages/CartPage.tsx) — Cart review
- [CheckoutPage.tsx](../rez-web-menu/src/pages/CheckoutPage.tsx) — OTP, coin discount, Razorpay
- [useOrderSocket.ts](../rez-web-menu/src/hooks/useOrderSocket.ts) — Socket.IO live updates
- [orderConfirmPage.tsx](../rez-web-menu/src/pages/OrderConfirmPage.tsx) — Post-order confirmation

**State management:**
- [cartStore.ts](../rez-web-menu/src/store/cartStore.ts) — Zustand cart (client-side)
- [rezCoinsStore.ts](../rez-web-menu/src/store/rezCoinsStore.ts) — Coin balance

### Order Creation API

**Endpoint:** `POST /api/orders`

**Backend:** [orderCreateController.ts](../rezbackend/rez-backend-master/src/controllers/orderCreateController.ts)

**Performance Profile (worst-case: ~350-500 ms, cached: ~120-180 ms):**

| Step | DB Queries | Notes |
|---|---|---|
| Idempotency check | 1 | Redis check + Order.findOne() |
| Cart fetch | 1 | With .populate(product, store) |
| Coin balance validation | 2 | coinService + Wallet.findOne() |
| Category mapping | 1 (cached) | Category hierarchy, 5-min Redis TTL |
| Store lookup | 1 | Get store category for coin slug |
| **Product revalidation** | **1 (batched)** | ✅ **Optimized: Batch `Product.find({$in: [ids]})` instead of N queries** |
| SmartSpendItem fetch | 1 (batched) | Batch lookup for reward rates |
| Order insert (txn) | 1 | MongoDB transaction |
| Cart clear (txn) | 1 | Remove ordered items |
| Wallet deduction (txn) | 1 | Update coin balance |
| Coin transaction log | 1 | Record deduction |
| **Total sync queries** | **~11** | **Estimated throughput: 50-70 orders/min per pod** |

**Post-response async:** Email/SMS enqueued to Redis, activity log, marketing signals, push notifications.

**Scaling notes:**
- Max concurrent DB connections: 25
- I/O bound (network latency dominates)
- Multi-pod: Each pod maintains independent L1 in-memory category cache, 5-min warmup TTL

---

## 3. Merchant Receiving Orders

### Merchant App Dashboard

**Primary flow:** [rez-merchant/app/orders/live.tsx](../rezmerchant/rez-merchant-master/app/orders/live.tsx)

- Real-time Socket.IO feed of incoming orders
- Click order to see details → [orders/[id].tsx](../rezmerchant/rez-merchant-master/app/orders/[id].tsx)
- Accept order → triggers status transition to `confirmed`
- Can reject/cancel at this point

### Dine-In Table Management

**Flow:** [dine-in/index.tsx](../rezmerchant/rez-merchant-master/app/dine-in/index.tsx)

- View all active tables
- Click table → see bill, items, order status
- Accept new orders from web QR menu
- [dine-in/waiter-mode.tsx](../rezmerchant/rez-merchant-master/app/dine-in/waiter-mode.tsx) — Manual order entry by staff

### Merchant API

**Base:** [rez-merchant-service/src/routes/orders.ts](../rez-merchant-service/src/routes/orders.ts)

| Endpoint | Method | Purpose |
|---|---|---|
| `/orders` | GET | Paginated order list (filtered by store, status, date) |
| `/orders/:id` | GET | Full order details with product/store populated |
| `/orders/:id/status` | PATCH | Update order status (with **state machine validation** ✅) |
| `/orders/stats/summary` | GET | Today's stats: order count, revenue (5-min cache) |

**State machine enforcement** — [rez-merchant-service/src/routes/orders.ts](../rez-merchant-service/src/routes/orders.ts):
```typescript
// Validates merchant can only follow merchant-allowed transitions
if (!isValidMerchantTransition(order.status, status)) {
  return res.status(400).json({
    message: `Invalid transition: "${from}" → "${to}". Allowed: [${allowed.join(', ')}]`,
    currentStatus: order.status,
    validNextStatuses: allowed,
  });
}
```

---

## 4. Kitchen Display System (KDS)

**File:** [rez-merchant/app/kds/index.tsx](../rezmerchant/rez-merchant-master/app/kds/index.tsx)

### Screen Layout

Three-column Kanban board (drag-to-advance):
```
┌─────────────────────────────────────────────────────────┐
│  NEW ORDERS  │  PREPARING  │  READY FOR DISPATCH      │
├─────────────────────────────────────────────────────────┤
│ Order #1234  │ Order #1230 │ Order #1227              │
│ Timer: 5:32  │ Timer: 15:12│ Timer: 22:45 (RED)       │
│ • Paneer...  │ • Biryani.. │ • Dosa...                │
│ • Dal...     │ • Raita...  │ Ready to go!             │
│ (Table 12)   │ (Delivery)  │ (Delivery app)           │
├─────────────────────────────────────────────────────────┤
│ Order #1235  │            │                          │
│ Timer: 0:58  │            │                          │
│ ALERT! (NEW) │            │                          │
```

### Features

**Visual indicators:**
- **Green timer:** < 10 minutes (on track)
- **Amber timer:** 10-20 minutes (getting close to SLA)
- **Red timer:** > 20 minutes (SLA breach, needs attention)

**Per-order details:**
- Item list with quantities
- Course type: STARTER / MAIN / DESSERT
- Allergens
- Special instructions (e.g., "No onions", "Less spicy")
- Customer name, table number (dine-in)
- Platform badge (dine_in, takeaway, swiggy, zomato, delivery_app)

**Actions:**
- **Click/Drag order:** Move from New → Preparing → Ready
- **Audio alert:** `order-alert.mp3` plays on new order (non-critical, silent fail if missing)
- **Settings:** [kds/settings.tsx](../rezmerchant/rez-merchant-master/app/kds/settings.tsx) — Display prefs, station routing

### Real-Time Socket.IO Events

**Connection:** [useOrderSocket.ts](../rez-web-menu/src/hooks/useOrderSocket.ts)

```typescript
socket.on('new-order', (order) => {
  // New order arrived → appears in KDS
  playOrderAlert(); // Sound notification
  addToNewOrdersColumn(order);
});

socket.on('order-status-updated', (orderId, newStatus) => {
  // Merchant moved order → update column
  moveOrder(orderId, statusToColumn[newStatus]);
});

socket.on('order-cancelled', (orderId) => {
  // Order cancelled → remove from board
  removeOrder(orderId);
});
```

**Backend emits:** Order status transitions are broadcast to all merchants for that store via Socket.IO.

### Performance Optimization

- **Reflow prevention:** Memoized `useMemo()` for column calculations
- **Re-render optimization:** Each `KDSOrder` is a `React.memo` component
- **Timer updates:** Single `setInterval` across all orders (not per-order)
- **StyleSheet outside component:** Prevents recreation on every render

---

## 5. Offers & Promotions

### Customer-Facing Offers

**Browse offers:** [rezapp/app/offers/](../rezapp/rez-master/app/offers/)

- AI-recommended
- Birthday offers
- Student/Corporate/Senior discounts
- Double cashback campaigns
- Sponsored offers
- Prive (premium membership) exclusive
- Zone-based (heroes, loyalty, women, etc.)
- Bank card offers
- Coupon wallet: [account/coupons.tsx](../rezapp/rez-master/app/account/coupons.tsx)

### Merchant-Created Offers

**Dashboard:** [rez-merchant/app/(dashboard)/](../rezmerchant/rez-merchant-master/app/(dashboard)/)

- **Discounts:** % or fixed amount
- **Cashback:** Via coins
- **Dynamic pricing:** Time-based or demand-based rates
- **Campaign simulator:** A/B test before launch → ROI view
- **Loyalty:** Punch cards, stamp cards
- **Gift cards:** Issued/redeemed tracking
- **Vouchers:** Store-specific codes

**Key files:**
- [create-offer.tsx](../rezmerchant/rez-merchant-master/app/(dashboard)/create-offer.tsx)
- [deals.tsx](../rezmerchant/rez-merchant-master/app/(dashboard)/deals.tsx)
- [cashback.tsx](../rezmerchant/rez-merchant-master/app/(dashboard)/cashback.tsx)
- [campaign-rules.tsx](../rezmerchant/rez-merchant-master/app/(dashboard)/campaign-rules.tsx)
- [campaign-simulator.tsx](../rezmerchant/rez-merchant-master/app/(dashboard)/campaign-simulator.tsx)
- [campaign-roi.tsx](../rezmerchant/rez-merchant-master/app/(dashboard)/campaign-roi.tsx)

### Marketing Service (Automation)

**Location:** [rez-marketing-service/src/](../rez-marketing-service/src/)

**Features:**
- Audience segmentation: [AudienceBuilder.ts](../rez-marketing-service/src/audience/AudienceBuilder.ts)
- Automated birthday offers: [BirthdayScheduler.ts](../rez-marketing-service/src/audience/BirthdayScheduler.ts)
- Multi-channel delivery:
  - Email: [EmailChannel.ts](../rez-marketing-service/src/channels/EmailChannel.ts)
  - Push: [PushChannel.ts](../rez-marketing-service/src/channels/PushChannel.ts)
  - SMS: [SMSChannel.ts](../rez-marketing-service/src/channels/SMSChannel.ts)
  - WhatsApp: [WhatsAppChannel.ts](../rez-marketing-service/src/channels/WhatsAppChannel.ts)

**Campaign orchestration:** [CampaignOrchestrator.ts](../rez-marketing-service/src/campaigns/CampaignOrchestrator.ts)

### Offer Models

**Location:** [rez-merchant-service/src/models/](../rez-merchant-service/src/models/)

| Model | Purpose |
|---|---|
| `Offer.ts` | Base offer with validity window, creator (merchant) |
| `Discount.ts` | % or fixed discount |
| `DiscountRule.ts` | Rules: min order, time-based, user segment |
| `Cashback.ts` | Coin reward offers |
| `CampaignRule.ts` | Multi-condition campaign logic |
| `DynamicPricingRule.ts` | Time/demand-based pricing |
| `GiftCard.ts` | Prepaid/balance tracking |
| `StoreVoucher.ts` | Store-specific codes |
| `PunchCard.ts` | Buy 9, get 1 free type |
| `StampCard.ts` | Collectable stamps → reward |

**Note:** All use `strict: false` (loose schemas) to allow flexibility. Consider adding validation layer if field proliferation becomes problematic.

---

## 6. Platform Admin System

**Location:** [rezadmin/rez-admin-main/app/(dashboard)/](../rezadmin/rez-admin-main/app/(dashboard)/)

### Merchant Management
- [merchants.tsx](../rezadmin/rez-admin-main/app/(dashboard)/merchants.tsx) — List, approve, suspend
- [pending-approvals.tsx](../rezadmin/rez-admin-main/app/(dashboard)/pending-approvals.tsx) — Onboarding queue
- [merchant-flags/[merchantId].tsx](../rezadmin/rez-admin-main/app/(dashboard)/merchant-flags/[merchantId].tsx) — Feature flags per merchant

### Order Monitoring
- [orders.tsx](../rezadmin/rez-admin-main/app/(dashboard)/orders.tsx) — Platform-wide view
- [sla-monitor.tsx](../rezadmin/rez-admin-main/app/(dashboard)/sla-monitor.tsx) — SLA breach tracking
- [aggregator-monitor.tsx](../rezadmin/rez-admin-main/app/(dashboard)/aggregator-monitor.tsx) — Swiggy/Zomato integration health

### Finance & Reconciliation
- [revenue.tsx](../rezadmin/rez-admin-main/app/(dashboard)/revenue.tsx)
- [reconciliation.tsx](../rezadmin/rez-admin-main/app/(dashboard)/reconciliation.tsx)
- [merchant-withdrawals.tsx](../rezadmin/rez-admin-main/app/(dashboard)/merchant-withdrawals.tsx)

### Offers & Campaigns
- [offers.tsx](../rezadmin/rez-admin-main/app/(dashboard)/offers.tsx) — Review merchant offers
- [flash-sales.tsx](../rezadmin/rez-admin-main/app/(dashboard)/flash-sales.tsx) — Platform flash sales
- [campaigns.tsx](../rezadmin/rez-admin-main/app/(dashboard)/campaigns.tsx)
- [cashback-rules.tsx](../rezadmin/rez-admin-main/app/(dashboard)/cashback-rules.tsx) — Platform-wide cashback config

### Fraud & Disputes
- [fraud-alerts.tsx](../rezadmin/rez-admin-main/app/(dashboard)/fraud-alerts.tsx)
- [fraud-queue.tsx](../rezadmin/rez-admin-main/app/(dashboard)/fraud-queue.tsx)
- [fraud-config.tsx](../rezadmin/rez-admin-main/app/(dashboard)/fraud-config.tsx)
- [disputes.tsx](../rezadmin/rez-admin-main/app/(dashboard)/disputes.tsx)

### Analytics
- [analytics-dashboard.tsx](../rezadmin/rez-admin-main/app/(dashboard)/analytics-dashboard.tsx)
- [web-menu-analytics.tsx](../rezadmin/rez-admin-main/app/(dashboard)/web-menu-analytics.tsx) — QR menu performance
- [revenue-by-vertical.tsx](../rezadmin/rez-admin-main/app/(dashboard)/revenue-by-vertical.tsx)

---

## 7. Database Schema Overview

### Order Model

**Location:** [rezbackend/src/models/Order.ts](../rezbackend/rez-backend-master/src/models/Order.ts)

**Core fields:**
```typescript
interface IOrder {
  orderNumber: string; // Unique identifier
  user: ObjectId; // Customer
  store: ObjectId; // Restaurant
  status: 'placed' | 'confirmed' | ... | 'refunded';
  items: IOrderItem[];
  totals: {
    subtotal: number;
    tax: number;
    delivery: number;
    discount: number;
    cashback: number;
    total: number;
    paidAmount: number;
    platformFee: number; // 15% commission
    merchantPayout: number; // subtotal - platformFee
  };
  payment: {
    method: 'wallet' | 'card' | 'upi' | 'cod' | 'razorpay';
    status: 'pending' | 'paid' | 'failed' | 'refunded';
    transactionId?: string;
    coinsUsed?: { rezCoins?: number; promoCoins?; storePromoCoins? };
  };
  delivery: {
    method: 'standard' | 'express' | 'pickup' | 'dine_in';
    status: 'pending' | 'dispatched' | 'delivered';
    address: IOrderAddress;
    estimatedTime?: Date;
    deliveredAt?: Date;
  };
  timeline: IOrderTimeline[]; // All status transitions + events
}
```

**Indexes:**
```
db.orders.createIndex({ user: 1, createdAt: -1 }); // Customer orders
db.orders.createIndex({ store: 1, createdAt: -1 }); // Store orders
db.orders.createIndex({ status: 1, createdAt: -1 }); // Status filters
db.orders.createIndex({ orderNumber: 1 }); // Unique lookup
```

### Merchant/Restaurant Schema

**Location:** [rez-merchant-service/src/models/](../rez-merchant-service/src/models/)

**Models (65+ total):**
- `Merchant.ts` — Account, bank details, subscription
- `Store.ts` — Individual restaurant, opening hours, location
- `Product.ts` — Menu items
- `Category.ts` — Menu categories/sections
- `InventoryLog.ts` — Stock movements
- `StaffShift.ts` — Employee shifts
- `PayrollRecord.ts` — Salary tracking
- `FloorPlan.ts` — Table layouts
- `TableSession.ts` — Dine-in session management
- `PurchaseOrder.ts` — Supplier ordering
- `Expense.ts` — Cost tracking
- `WasteLog.ts` — Food waste logging
- `Recipe.ts` — Dish formulations
- `ServiceBooking.ts` — Service appointments
- `AuditLog.ts` — Change tracking

---

## 8. Known Issues & Fixes

| Issue | Severity | Status | Fix |
|---|---|---|---|
| **State machine not enforced in merchant-service** | HIGH | ✅ FIXED | Added `orderStateMachine.ts` utility + validation in `/orders/:id/status` PATCH |
| **Order schema mismatch** (pending/completed vs placed) | HIGH | ✅ FIXED | Updated enum to match monolith canonical statuses |
| **N+1 product queries in order creation** | MEDIUM | ✅ ALREADY OPTIMIZED | Batch `Product.find({$in: [ids]})` at line 614-619 |
| **Loose schemas on offer models** | LOW | ⏳ CONSIDER | Add validation layer if field proliferation becomes problematic |

---

## 9. Deployment & Scaling Notes

### Single-Pod Performance
- **Order throughput:** 50-70 orders/min
- **Bottleneck:** I/O (network latency to MongoDB)
- **Peak handling:** Render Starter → 1 CPU, 512 MB RAM

### Multi-Pod Scaling
- **Category cache:** Each pod maintains independent L1 in-memory, 5-min TTL
- **Redis:** Shared L2 cache across all pods
- **Stale data risk:** None (categories rarely change; eventual consistency within 5 min)
- **Graceful shutdown:** Redis pub/sub invalidates caches across pods on admin updates

### Database Tuning
- **Connection pool:** max 25 concurrent connections
- **Transaction isolation:** snapshot + majority write concern (prevents primary stepdown race)
- **Indexes:** Ensure indexes on user+createdAt, store+createdAt for order queries

---

## 10. Testing Strategy

### Integration Tests (Recommended)
- Complete order flow: Create → Confirm → Prepare → Ready → Dispatch → Deliver
- State machine: Attempt invalid transitions → expect 400
- KDS real-time: Emit order status → verify Socket.IO broadcast
- Offer redemption: Apply coupon → verify deduction
- Payment flows: COD, card, wallet, coins

### Load Testing
- 100 concurrent users ordering simultaneously
- Monitor order creation latency, throughput, connection pool
- Check database query performance

### E2E Tests
- Customer app: Browse → Add to cart → Checkout → Confirmation
- Merchant app: Receive order → KDS update → Status transitions
- Admin: View orders → Check SLA compliance

---

## 11. Contact & References

- **Issue tracker:** Check Linear project "INGEST" for pipeline bugs
- **Oncall dashboard:** Grafana `grafana.internal/d/api-latency`
- **Runbook:** See docs/INTEGRATION_RUNBOOK.md for OTA/PMS integration
