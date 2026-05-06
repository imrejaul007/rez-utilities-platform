# Restaurant System - Critical Gaps Fix Plan

**Status:** 🚀 **IMPLEMENTATION IN PROGRESS**  
**Date:** April 8, 2026  
**Priority:** CRITICAL - 8 gaps to fix  
**Timeline:** Week 1 (immediate), Week 2 (important), Week 3 (quality)

---

## Executive Summary

The restaurant system has **2 parallel implementations** (REZ Backend + Resturistan) with **8 critical gaps** preventing production deployment:

1. ❌ Kitchen Display System not integrated to backend
2. ❌ Resturistan Order Service is empty
3. ❌ Duplicate status transition maps
4. ❌ BullMQ settlement/delivery tracking incomplete
5. ❌ Offers not auto-applied at checkout
6. ❌ No offer performance analytics
7. ❌ SSE vs Socket.IO not unified
8. ❌ Two separate databases with no sync layer

---

## Gap 1: Kitchen Display System Not Integrated

### Current State ❌
**File**: `Resturistan App/restauranthub/apps/web/app/restaurant/kitchen/display/page.tsx`

- Uses hardcoded `mockOrders` data
- `updateOrderStatus()` only mutates local React state
- No API calls to backend
- No real orders ever arrive
- Kitchen staff see only fake data

### Solution ✅
**Replace mock data with real-time Socket.IO integration**

#### Changes Required:

**1. Create new hook: `useKitchenOrders.ts`**
```typescript
// Location: apps/web/hooks/useKitchenOrders.ts
import { useEffect, useState } from 'react';
import { useSocket } from '@/context/SocketContext';

export function useKitchenOrders(restaurantId: string) {
  const [orders, setOrders] = useState([]);
  const socket = useSocket();

  useEffect(() => {
    // Subscribe to new orders
    socket.on('merchant:new_order', (order) => {
      setOrders(prev => [order, ...prev]);
    });

    // Subscribe to order status updates
    socket.on('order:status_updated', (data) => {
      setOrders(prev => 
        prev.map(o => o._id === data.orderId 
          ? { ...o, status: data.status, updatedAt: data.updatedAt }
          : o
        )
      );
    });

    // Subscribe to item status updates
    socket.on('order:item_status_updated', (data) => {
      setOrders(prev =>
        prev.map(o => 
          o._id === data.orderId 
            ? {
                ...o,
                items: o.items.map(item =>
                  item._id === data.itemId
                    ? { ...item, status: data.itemStatus }
                    : item
                )
              }
            : o
        )
      );
    });

    return () => {
      socket.off('merchant:new_order');
      socket.off('order:status_updated');
      socket.off('order:item_status_updated');
    };
  }, [socket]);

  return { orders, setOrders };
}
```

**2. Update `display/page.tsx` to use real API**
```typescript
// location: apps/web/app/restaurant/kitchen/display/page.tsx

'use client';
import { useKitchenOrders } from '@/hooks/useKitchenOrders';
import { useState } from 'react';

export default function KitchenDisplay() {
  const restaurantId = useSession()?.user?.restaurant?._id;
  const { orders } = useKitchenOrders(restaurantId);

  // Remove mockOrders - use real data now
  const handleStatusChange = async (orderId: string, itemId: string, newStatus: string) => {
    try {
      const response = await fetch(
        `/api/merchant/orders/${orderId}/items/${itemId}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemStatus: newStatus })
        }
      );
      
      if (!response.ok) throw new Error('Failed to update status');
      
      // Socket.IO will emit order:item_status_updated automatically
      // UI updates via Socket listener
    } catch (error) {
      toast.error('Failed to update item status');
    }
  };

  return (
    <KitchenDisplayUI 
      orders={orders}
      onItemStatusChange={handleStatusChange}
    />
  );
}
```

**3. Create new API endpoint (REZ Backend)**
```typescript
// Location: rezbackend/src/routes/merchant/orderRoutes.ts
// Add new route:

router.put(
  '/orders/:orderId/items/:itemId/status',
  requireMerchantAuth,
  validateOrderOwnership,
  async (req, res) => {
    const { orderId, itemId } = req.params;
    const { itemStatus } = req.body;

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        $set: {
          'items.$[elem].status': itemStatus,
          'items.$[elem].updatedAt': new Date()
        }
      },
      {
        arrayFilters: [{ 'elem._id': itemId }],
        new: true
      }
    );

    // Emit Socket.IO event to customer
    orderSocketService.emit('order:item_status_updated', {
      orderId,
      itemId,
      itemStatus,
      timestamp: new Date()
    });

    res.json({ success: true, order });
  }
);
```

**4. Add Socket.IO client context (if not exists)**
```typescript
// Location: apps/web/context/SocketContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL, {
      auth: { token: localStorage.getItem('authToken') }
    });

    newSocket.on('connect', () => console.log('Socket connected'));
    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
```

### Implementation Checklist ✅
- [ ] Create `useKitchenOrders.ts` hook
- [ ] Update `display/page.tsx` to remove mockOrders
- [ ] Create API endpoint for item status update
- [ ] Add Socket.IO context (if missing)
- [ ] Test real order flow (place order → appears in kitchen)
- [ ] Test status updates propagate to customer

### Files to Change
```
Resturistan App/restauranthub/
├── apps/web/
│   ├── hooks/useKitchenOrders.ts (NEW)
│   ├── context/SocketContext.tsx (CREATE if missing)
│   └── app/restaurant/kitchen/display/page.tsx (UPDATE)

rezbackend/rez-backend-master/
└── src/routes/merchant/orderRoutes.ts (ADD endpoint)
```

---

## Gap 2: Resturistan Order Service is Empty

### Current State ❌
**File**: `Resturistan App/restauranthub/apps/order-service/`

- Only has `ConfigModule.forRoot()`
- Zero controllers, zero providers, zero services
- `apps/api/src/modules/orders/` exists but is in `disabled_modules/`
- Resturistan cannot create orders

### Solution ✅
**Implement complete NestJS Order Service that bridges with REZ Backend**

#### Option A: Proxy to REZ Backend (Recommended - faster)
**Implementation Path**: Create NestJS module that forwards to REZ Backend

```typescript
// Location: apps/order-service/src/orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrdersService {
  constructor(
    private http: HttpService,
    private config: ConfigService
  ) {}

  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    const rezBackendUrl = this.config.get('REZ_BACKEND_URL');
    
    return this.http.post(
      `${rezBackendUrl}/api/orders`,
      createOrderDto,
      {
        headers: {
          'Authorization': `Bearer ${createOrderDto.token}`,
          'X-Restaurant-Id': createOrderDto.restaurantId
        }
      }
    ).toPromise();
  }

  async getOrder(orderId: string) {
    const rezBackendUrl = this.config.get('REZ_BACKEND_URL');
    
    return this.http.get(
      `${rezBackendUrl}/api/orders/${orderId}`
    ).toPromise();
  }

  async updateOrderStatus(orderId: string, status: string, note?: string) {
    const rezBackendUrl = this.config.get('REZ_BACKEND_URL');
    
    return this.http.put(
      `${rezBackendUrl}/api/merchant/orders/${orderId}/status`,
      { status, note }
    ).toPromise();
  }
}
```

```typescript
// Location: apps/order-service/src/orders/orders.controller.ts
import { Controller, Post, Get, Put, Body, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  async create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.createOrder(
      createOrderDto.userId,
      createOrderDto
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.getOrder(id);
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('note') note?: string
  ) {
    return this.ordersService.updateOrderStatus(id, status, note);
  }
}
```

```typescript
// Location: apps/order-service/src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [HttpModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService]
})
export class OrdersModule {}
```

#### Option B: Native Prisma Orders (More Work - isolated)
If you want complete independence from REZ Backend:

```typescript
// Location: apps/order-service/src/orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async createOrder(userId: string, restaurantId: string, data: any) {
    const order = await this.prisma.order.create({
      data: {
        userId,
        restaurantId,
        items: { create: data.items },
        totalAmount: data.totalAmount,
        status: 'PENDING',
        paymentMethod: data.paymentMethod
      },
      include: { items: true }
    });

    // Emit to REZ Backend webhook for attribution
    await fetch(process.env.REZ_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'restaurant_order_created',
        restaurantId,
        orderId: order.id,
        userId,
        totalAmount: order.totalAmount,
        timestamp: new Date()
      })
    });

    return order;
  }

  async getOrder(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { 
        status,
        updatedAt: new Date()
      }
    });
  }
}
```

### Implementation Checklist ✅
- [ ] Decide: Proxy (Option A) vs Native (Option B)
- [ ] Create OrdersService
- [ ] Create OrdersController with CRUD endpoints
- [ ] Create OrdersModule
- [ ] Create DTOs (CreateOrderDto, UpdateStatusDto)
- [ ] Add to AppModule imports
- [ ] Test: POST /orders → order created
- [ ] Test: GET /orders/:id → order retrieved
- [ ] Test: PUT /orders/:id/status → status updated

### Files to Create
```
Resturistan App/restauranthub/apps/order-service/src/
├── orders/
│   ├── orders.service.ts (NEW)
│   ├── orders.controller.ts (NEW)
│   ├── orders.module.ts (NEW)
│   └── dto/
│       ├── create-order.dto.ts (NEW)
│       └── update-status.dto.ts (NEW)
└── app.module.ts (UPDATE - add OrdersModule)
```

---

## Gap 3: Duplicate Status Transition Maps

### Current State ❌
**Files**:
- `rezbackend/src/utils/orderStateMachine.ts` — Canonical transitions
- `rezbackend/src/controllers/merchant/orderController.ts` — Duplicate transitions

The two maps are NOT identical:
- `orderStateMachine`: `placed → confirmed → preparing → ready → dispatched → out_for_delivery → delivered`
- `merchantController`: same BUT includes `pending` status in certain paths

### Solution ✅
**Single source of truth with reusable validator**

```typescript
// Location: rezbackend/src/utils/orderStateMachine.ts
// Export validator function:

export const MERCHANT_TRANSITIONS = {
  'confirmed': ['preparing'],
  'preparing': ['ready'],
  'ready': ['dispatched'],
  'dispatched': ['out_for_delivery'],
  'out_for_delivery': ['delivered']
};

export function isValidMerchantTransition(from: string, to: string): boolean {
  return MERCHANT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getMerchantAllowedTransitions(currentStatus: string): string[] {
  return MERCHANT_TRANSITIONS[currentStatus] ?? [];
}
```

```typescript
// Location: rezbackend/src/controllers/merchant/orderController.ts
// Update updateMerchantOrderStatus:

import { 
  isValidMerchantTransition, 
  getMerchantAllowedTransitions 
} from '@/utils/orderStateMachine';

async function updateMerchantOrderStatus(req, res) {
  const { orderId } = req.params;
  const { status, note } = req.body;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Use canonical validator
  if (!isValidMerchantTransition(order.status, status)) {
    const allowed = getMerchantAllowedTransitions(order.status);
    return res.status(400).json({
      error: `Invalid transition from ${order.status}`,
      allowedTransitions: allowed
    });
  }

  // ... rest of implementation
}
```

### Implementation Checklist ✅
- [ ] Export `isValidMerchantTransition()` from orderStateMachine.ts
- [ ] Export `getMerchantAllowedTransitions()` from orderStateMachine.ts
- [ ] Update merchant controller to use canonical validator
- [ ] Remove inline `validTransitions` from merchant controller
- [ ] Test: Valid transitions work
- [ ] Test: Invalid transitions rejected with allowed list

### Files to Change
```
rezbackend/rez-backend-master/
├── src/utils/orderStateMachine.ts (EXPORT validators)
└── src/controllers/merchant/orderController.ts (USE validators)
```

---

## Gap 4: BullMQ Phase B - Settlement & Delivery

### Current State ❌
**File**: `rezbackend/src/jobs/orderQueue.ts`

- Delivery tracking updates: `// Phase B: Wire to DeliveryTrackingService`
- Settlement calculation: `// Phase B: Wire to SettlementService`
- **Merchants never get paid automatically**

### Solution ✅
**Complete the async job handlers**

```typescript
// Location: rezbackend/src/services/DeliveryTrackingService.ts (NEW)
import { Injectable } from '@nestjs/common';
import { Order } from '@/models/Order';
import { Delivery } from '@/models/Delivery';
import { orderSocketService } from './orderSocketService';

@Injectable()
export class DeliveryTrackingService {
  async updateDeliveryLocation(orderId: string, location: { lat, lng }) {
    const delivery = await Delivery.findOneAndUpdate(
      { orderId },
      {
        $set: {
          'currentLocation.coordinates': [location.lng, location.lat],
          'updatedAt': new Date()
        }
      },
      { new: true }
    );

    // Emit to customer
    orderSocketService.emit('order:location_updated', {
      orderId,
      location,
      timestamp: new Date()
    });

    return delivery;
  }

  async updateDeliveryETA(orderId: string, eta: Date) {
    const delivery = await Delivery.findOneAndUpdate(
      { orderId },
      {
        $set: {
          eta,
          'updatedAt': new Date()
        }
      },
      { new: true }
    );

    // Emit to customer
    orderSocketService.emit('order:eta_updated', {
      orderId,
      eta,
      timestamp: new Date()
    });

    return delivery;
  }

  async markDeliveryComplete(orderId: string) {
    const delivery = await Delivery.findOneAndUpdate(
      { orderId },
      {
        $set: {
          status: 'completed',
          completedAt: new Date()
        }
      },
      { new: true }
    );

    return delivery;
  }
}
```

```typescript
// Location: rezbackend/src/services/SettlementService.ts (NEW/COMPLETE)
import { Injectable } from '@nestjs/common';
import { Order } from '@/models/Order';
import { Merchant } from '@/models/Merchant';

@Injectable()
export class SettlementService {
  async calculateOrderSettlement(orderId: string) {
    const order = await Order.findById(orderId);
    if (!order) return null;

    // Calculate what merchant gets
    const merchantPayout = order.totals.merchantPayout;
    const settlementFee = order.totals.platformFee;

    const settlement = {
      orderId,
      merchantId: order.store,
      amount: merchantPayout,
      platformFee: settlementFee,
      status: 'pending',
      createdAt: new Date(),
      settledAt: null
    };

    return settlement;
  }

  async settleMerchantPayouts(merchantId: string, date: Date) {
    // Find all orders delivered on this date
    const orders = await Order.find({
      store: merchantId,
      status: 'delivered',
      'timeline.delivered.timestamp': {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lte: new Date(date).setHours(23, 59, 59, 999)
      }
    });

    const totalAmount = orders.reduce(
      (sum, order) => sum + order.totals.merchantPayout,
      0
    );

    const merchant = await Merchant.findByIdAndUpdate(
      merchantId,
      {
        $inc: {
          'settlement.pending': totalAmount,
          'totalEarnings': totalAmount
        },
        $push: {
          'settlementHistory': {
            date,
            amount: totalAmount,
            orderCount: orders.length
          }
        }
      },
      { new: true }
    );

    return {
      merchantId,
      date,
      totalAmount,
      orderCount: orders.length
    };
  }
}
```

```typescript
// Location: rezbackend/src/jobs/orderQueue.ts (COMPLETE Phase B)
// Update existing job handlers:

// DELIVERY TRACKING (Phase B - Complete)
orderQueue.process('delivery.location_update', async (job) => {
  const { orderId, location } = job.data;
  
  await deliveryTrackingService.updateDeliveryLocation(orderId, location);
  logger.info(`[Delivery] Location updated for order ${orderId}`);
});

orderQueue.process('delivery.eta_update', async (job) => {
  const { orderId, eta } = job.data;
  
  await deliveryTrackingService.updateDeliveryETA(orderId, eta);
  logger.info(`[Delivery] ETA updated for order ${orderId}`);
});

// SETTLEMENT (Phase B - Complete)
orderQueue.process('settlement.calculate', async (job) => {
  const { orderId } = job.data;
  
  const settlement = await settlementService.calculateOrderSettlement(orderId);
  logger.info(`[Settlement] Calculated for order ${orderId}: ₹${settlement.amount}`);
});

orderQueue.process('settlement.daily_payout', async (job) => {
  const { merchantId, date } = job.data;
  
  const result = await settlementService.settleMerchantPayouts(merchantId, date);
  logger.info(
    `[Settlement] Daily payout for merchant ${merchantId}: ₹${result.totalAmount} from ${result.orderCount} orders`
  );
});
```

### Implementation Checklist ✅
- [ ] Create DeliveryTrackingService
- [ ] Create/Complete SettlementService
- [ ] Add job handlers for delivery.location_update
- [ ] Add job handler for delivery.eta_update
- [ ] Add job handler for settlement.calculate
- [ ] Add job handler for settlement.daily_payout
- [ ] Add cron job to run daily payouts (e.g., 11 PM daily)
- [ ] Test: Order delivered → settlement calculated
- [ ] Test: Daily settlement processed

### Files to Create/Update
```
rezbackend/rez-backend-master/src/
├── services/DeliveryTrackingService.ts (NEW)
├── services/SettlementService.ts (COMPLETE if partial)
└── jobs/orderQueue.ts (COMPLETE Phase B sections)
```

---

## Gap 5: Auto-Apply Offers at Checkout

### Current State ❌
**Files**:
- `rezbackend/src/services/OfferService.ts` — Has `findBestOffer()` method
- `rezbackend/src/controllers/orderController.ts` — `createOrder()` doesn't call `findBestOffer()`

Offers are validated but NOT automatically applied.

### Solution ✅
**Integrate offer selection into order creation**

```typescript
// Location: rezbackend/src/controllers/orderController.ts
// Update createOrder function:

async function createOrder(req, res) {
  // ... existing validation code ...

  // NEW: Find best applicable offer
  const applicableOffers = await offerService.findBestOffer({
    userId: req.user._id,
    storeId: order.store._id,
    subtotal: subtotal,
    categories: itemCategories
  });

  let offerDiscount = 0;
  let appliedOfferId = null;

  if (applicableOffers && applicableOffers.length > 0) {
    const bestOffer = applicableOffers[0]; // Already sorted by priority and savings
    
    // Calculate discount
    if (bestOffer.discountType === 'percentage') {
      offerDiscount = Math.floor(subtotal * bestOffer.discountValue / 100);
    } else if (bestOffer.discountType === 'fixed') {
      offerDiscount = Math.min(bestOffer.discountValue, subtotal);
    }

    // Cap at maxDiscountAmount if set
    if (bestOffer.maxDiscountAmount) {
      offerDiscount = Math.min(offerDiscount, bestOffer.maxDiscountAmount);
    }

    appliedOfferId = bestOffer._id;
    
    logger.info(`[Offer] Applied offer ${bestOffer._id} to order, discount: ₹${offerDiscount}`);
  }

  // Update totals calculation
  const total = subtotal + tax + delivery - allExistingDiscounts - offerDiscount;

  // Add to order document
  const order = await Order.create({
    // ... existing fields ...
    appliedOffer: appliedOfferId,
    totals: {
      // ... existing ...
      offerDiscount,
      total
    }
  });

  // Create OfferRedemption record
  if (appliedOfferId) {
    await OfferRedemption.create({
      offer: appliedOfferId,
      user: req.user._id,
      order: order._id,
      status: 'active',
      discountApplied: offerDiscount
    });
  }

  // ... rest of implementation
}
```

### Implementation Checklist ✅
- [ ] Call `OfferService.findBestOffer()` in `createOrder()`
- [ ] Calculate discount based on offer type
- [ ] Cap at `maxDiscountAmount`
- [ ] Include in order totals
- [ ] Create `OfferRedemption` record
- [ ] Log applied offers
- [ ] Test: Order created → best offer auto-applied
- [ ] Test: Offer discount calculated correctly

### Files to Change
```
rezbackend/rez-backend-master/src/
└── controllers/orderController.ts (UPDATE createOrder function)
```

---

## Gap 6: Offer Performance Analytics

### Current State ❌
**Files**: No admin analytics for offers exist
- Offers track `engagement` (views, shares) but zero conversion data
- Admin has no insight into offer performance

### Solution ✅
**Add offer analytics endpoints**

```typescript
// Location: rezbackend/src/routes/admin/offerAnalytics.ts (NEW)
import { Router } from 'express';
import { Offer } from '@/models/Offer';
import { OfferRedemption } from '@/models/OfferRedemption';
import { Order } from '@/models/Order';

const router = Router();

// GET /api/admin/offers/analytics/performance
router.get('/analytics/performance', async (req, res) => {
  const { dateFrom, dateTo, offerIds } = req.query;

  const query = {};
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }
  if (offerIds) {
    query.offer = { $in: offerIds.split(',') };
  }

  const redemptions = await OfferRedemption.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$offer',
        totalRedemptions: { $sum: 1 },
        totalDiscountApplied: { $sum: '$discountApplied' },
        activeRedemptions: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        usedRedemptions: {
          $sum: { $cond: [{ $eq: ['$status', 'used'] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: 'offers',
        localField: '_id',
        foreignField: '_id',
        as: 'offer'
      }
    },
    { $unwind: '$offer' }
  ]);

  res.json({
    data: redemptions.map(r => ({
      offerId: r._id,
      offerName: r.offer.name,
      offerType: r.offer.type,
      totalRedemptions: r.totalRedemptions,
      activeRedemptions: r.activeRedemptions,
      usedRedemptions: r.usedRedemptions,
      totalDiscountApplied: r.totalDiscountApplied,
      conversionRate: (r.usedRedemptions / r.totalRedemptions * 100).toFixed(2) + '%'
    })),
    total: redemptions.length
  });
});

// GET /api/admin/offers/analytics/engagement
router.get('/analytics/engagement', async (req, res) => {
  const offers = await Offer.find(
    { isActive: true },
    'name type engagement metrics'
  ).sort({ 'engagement.viewsCount': -1 }).limit(50);

  res.json({
    data: offers.map(o => ({
      id: o._id,
      name: o.name,
      type: o.type,
      views: o.engagement?.viewsCount || 0,
      shares: o.engagement?.sharesCount || 0,
      likes: o.engagement?.likesCount || 0,
      engagementRate: ((o.engagement?.sharesCount || 0) / (o.engagement?.viewsCount || 1) * 100).toFixed(2) + '%'
    }))
  });
});

// GET /api/admin/offers/analytics/revenue
router.get('/analytics/revenue', async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const query = {
    appliedOffer: { $exists: true, $ne: null }
  };
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const orderData = await Order.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$appliedOffer',
        ordersWithOffer: { $sum: 1 },
        totalRevenue: { $sum: '$totals.total' },
        totalDiscountGiven: { $sum: '$totals.offerDiscount' },
        avgOrderValue: { $avg: '$totals.total' }
      }
    },
    {
      $lookup: {
        from: 'offers',
        localField: '_id',
        foreignField: '_id',
        as: 'offer'
      }
    },
    { $unwind: '$offer' }
  ]);

  res.json({
    data: orderData.map(d => ({
      offerId: d._id,
      offerName: d.offer.name,
      ordersWithOffer: d.ordersWithOffer,
      totalRevenue: d.totalRevenue,
      totalDiscountGiven: d.totalDiscountGiven,
      avgOrderValue: d.avgOrderValue.toFixed(2),
      netRevenue: (d.totalRevenue - d.totalDiscountGiven).toFixed(2)
    }))
  });
});

export default router;
```

### Implementation Checklist ✅
- [ ] Create offer analytics routes
- [ ] Add `/api/admin/offers/analytics/performance` endpoint
- [ ] Add `/api/admin/offers/analytics/engagement` endpoint
- [ ] Add `/api/admin/offers/analytics/revenue` endpoint
- [ ] Import and register routes in admin router
- [ ] Test: Admin can view offer performance metrics

### Files to Create/Update
```
rezbackend/rez-backend-master/src/
├── routes/admin/offerAnalytics.ts (NEW)
└── routes/admin/index.ts (IMPORT offerAnalytics)
```

---

## Gap 7: Unify SSE vs Socket.IO Strategy

### Current State ❌
**Files**:
- `/api/orders/live/:orderId` — SSE polling every 3 seconds
- Socket.IO events — Real-time, event-driven
- **Not synchronized** — up to 3-second delay difference

### Solution ✅
**Document and enforce unified strategy**

```typescript
// Location: rezbackend/src/docs/TRACKING_STRATEGY.md (NEW - Document)

# Order Tracking Strategy

## Policy
- **Mobile/Web Clients**: Use Socket.IO (real-time, lower battery impact)
- **Third-party integrations**: Use SSE polling (simpler, no WebSocket)
- **Admin dashboards**: Use Socket.IO (instant updates)
- **Kitchen displays**: Use Socket.IO (critical for UX)

## Socket.IO Events (Preferred)
- Pros: Real-time, instant, bidirectional, battery-efficient
- Cons: Requires persistent connection, more infrastructure

## SSE Polling (Fallback)
- Pros: Simpler, no WebSocket, fewer deployments needed
- Cons: 3-second delay, higher battery usage, more requests

## Implementation
All clients MUST use ONE strategy, not both:
```javascript
// ✅ CORRECT - Mobile uses Socket.IO
const socket = io(API_URL);
socket.on('order:status_updated', (data) => {
  setOrderStatus(data.status);
});

// ❌ WRONG - Don't mix SSE + Socket.IO
fetch('/api/orders/live/123') // Don't do this
socket.on('order:status_updated', ...) // AND this

// ✅ CORRECT - Legacy clients use SSE only
const sse = new EventSource('/api/orders/live/123');
sse.onmessage = (e) => {
  setOrderStatus(JSON.parse(e.data).status);
};
```

## Migration Path
1. Web/mobile → Socket.IO (done)
2. Legacy SSE clients → Document fallback
3. Deprecate SSE in 6 months
4. Remove SSE polling code
```

### Implementation Checklist ✅
- [ ] Create `TRACKING_STRATEGY.md` documentation
- [ ] Update client code to use ONLY Socket.IO OR ONLY SSE (not both)
- [ ] Document in README which clients use which
- [ ] Remove redundant polling from Socket.IO clients
- [ ] Test: Single source of truth for status

### Files to Create/Update
```
rezbackend/rez-backend-master/
├── src/docs/TRACKING_STRATEGY.md (NEW - Document)
└── [client code] (Remove SSE polling if using Socket.IO)
```

---

## Gap 8: Two Separate Databases with No Sync

### Current State ❌
- REZ Backend: MongoDB
- Resturistan: PostgreSQL
- No sync layer, no shared identity

### Solution ✅
**Document intentional separation OR implement bridge**

**Option A: Intentional Separation (Recommended)**
- Keep both databases
- Document that they are separate systems
- Resturistan is self-contained; REZ Backend is separate
- No cross-system orders initially

**Option B: Data Bridge (Phase 2)**
- Create `DatabaseBridge` service
- Sync key entities: Users, Restaurants, Orders
- Use webhooks for eventual consistency
- Implement later (not critical)

For now, document the separation:

```markdown
# Restaurant System Database Architecture

## Current Design
REZ Backend and Resturistan are **intentionally separate systems**:

### REZ Backend (MongoDB)
- Primary restaurant ordering system
- Integrated with wallet, coins, analytics
- Production-ready

### Resturistan (PostgreSQL)
- Secondary restaurant management platform
- Self-contained orders and operations
- Planned future: Bridge integration

## No Cross-System Orders
Currently, a user cannot place an order on one system and view it on the other.
This is by design to prevent data corruption during integration phase.

## Future: Unified Platform
Phase 2 will implement a data bridge to unify both systems.
```

---

## Implementation Timeline

### Week 1 (CRITICAL)
- [ ] Gap 1: Kitchen Display Integration (1-2 days)
- [ ] Gap 2: Resturistan Order Service (2-3 days)
- [ ] Gap 3: Merge Transition Maps (0.5 day)

### Week 2 (IMPORTANT)
- [ ] Gap 4: Complete BullMQ Phase B (2 days)
- [ ] Gap 5: Auto-apply Offers (1 day)
- [ ] Gap 6: Offer Analytics (1-2 days)

### Week 3 (QUALITY)
- [ ] Gap 7: Unify Tracking Strategy (0.5 day)
- [ ] Gap 8: Document Database Architecture (0.5 day)
- [ ] Testing & validation (2 days)

---

## Success Criteria

✅ Kitchen Display receives real orders via Socket.IO  
✅ Resturistan can create orders via NestJS service  
✅ Offers auto-apply at checkout with correct discount  
✅ Merchants receive automatic settlement payouts  
✅ Delivery tracking updates sent to customers  
✅ Admin has visibility into offer performance  
✅ Status transitions use single source of truth  
✅ All tracking uses unified Socket.IO strategy  

---

## Related Documentation

- [RESTAURANT_SYSTEM_ARCHITECTURE.md](RESTAURANT_SYSTEM_ARCHITECTURE.md) — System overview
- [INTEGRATION_ENDPOINTS.md](INTEGRATION_ENDPOINTS.md) — API specifications
- [MONITORING_GUIDE.md](MONITORING_GUIDE.md) — Observability setup

---

**Generated:** April 8, 2026  
**Status:** 🚀 IMPLEMENTATION IN PROGRESS  
**Prepared By:** REZ Development Team (claude-flow)
