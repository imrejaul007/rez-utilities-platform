/**
 * Integration Tests — Complete Restaurant Order Flow
 *
 * Tests the entire order lifecycle from customer ordering through
 * merchant receiving, KDS updates, and delivery.
 *
 * Prerequisites:
 * - MongoDB instance running (or mock)
 * - Redis instance running (or mock)
 * - All microservices able to connect
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import axios from 'axios';

// API endpoints (adjust for your environment)
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api';
const MERCHANT_API_BASE = process.env.MERCHANT_API_BASE || 'http://localhost:3001/api';

/**
 * Test fixtures
 */
const testData = {
  customer: {
    id: '',
    token: '',
    phone: '9876543210',
  },
  merchant: {
    id: '',
    token: '',
  },
  store: {
    id: '',
  },
  order: {
    id: '',
    number: '',
  },
};

describe('Restaurant Order Flow — Integration Tests', () => {
  describe('1. Customer Order Creation', () => {
    it('should create an order with valid cart items', async () => {
      const response = await axios.post(
        `${API_BASE}/orders`,
        {
          deliveryAddress: {
            name: 'John Doe',
            phone: '9876543210',
            addressLine1: '123 Main St',
            city: 'Bangalore',
            state: 'KA',
            pincode: '560001',
          },
          paymentMethod: 'razorpay',
          fulfillmentType: 'delivery',
          idempotencyKey: `order-${Date.now()}`,
        },
        {
          headers: {
            Authorization: `Bearer ${testData.customer.token}`,
          },
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.order).toBeDefined();
      expect(response.data.order.status).toBe('placed');
      expect(response.data.order.orderNumber).toMatch(/^ORD-\d+/);

      testData.order.id = response.data.order._id;
      testData.order.number = response.data.order.orderNumber;
    });

    it('should prevent duplicate orders with same idempotency key', async () => {
      const idempotencyKey = `order-${Date.now()}`;

      // First order
      const response1 = await axios.post(
        `${API_BASE}/orders`,
        {
          deliveryAddress: {
            name: 'Jane Doe',
            phone: '9876543210',
            addressLine1: '456 Oak Ave',
            city: 'Bangalore',
            state: 'KA',
            pincode: '560002',
          },
          paymentMethod: 'wallet',
          idempotencyKey,
        },
        {
          headers: { Authorization: `Bearer ${testData.customer.token}` },
        }
      );

      const order1 = response1.data.order;

      // Retry with same key
      const response2 = await axios.post(
        `${API_BASE}/orders`,
        {
          deliveryAddress: {
            name: 'Jane Doe',
            phone: '9876543210',
            addressLine1: '456 Oak Ave',
            city: 'Bangalore',
            state: 'KA',
            pincode: '560002',
          },
          paymentMethod: 'wallet',
          idempotencyKey,
        },
        {
          headers: { Authorization: `Bearer ${testData.customer.token}` },
        }
      );

      const order2 = response2.data.order;

      // Should return same order
      expect(order1._id).toBe(order2._id);
      expect(order1.orderNumber).toBe(order2.orderNumber);
    });

    it('should reject order without idempotency key', async () => {
      try {
        await axios.post(
          `${API_BASE}/orders`,
          {
            deliveryAddress: {
              name: 'Test User',
              phone: '9876543210',
              addressLine1: '789 Elm St',
              city: 'Bangalore',
              state: 'KA',
              pincode: '560003',
            },
            paymentMethod: 'razorpay',
            // Missing idempotencyKey
          },
          {
            headers: { Authorization: `Bearer ${testData.customer.token}` },
          }
        );
        throw new Error('Should have rejected');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('idempotency');
      }
    });

    it('should validate delivery address for delivery orders', async () => {
      try {
        await axios.post(
          `${API_BASE}/orders`,
          {
            deliveryAddress: {
              name: 'Test User',
              // Missing phone, addressLine1, etc.
            },
            paymentMethod: 'razorpay',
            fulfillmentType: 'delivery',
            idempotencyKey: `order-${Date.now()}`,
          },
          {
            headers: { Authorization: `Bearer ${testData.customer.token}` },
          }
        );
        throw new Error('Should have rejected incomplete address');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('address');
      }
    });
  });

  describe('2. Order State Machine Transitions', () => {
    it('should follow valid state machine transitions', async () => {
      // 1. Order starts in 'placed' state
      let response = await axios.get(
        `${MERCHANT_API_BASE}/orders/${testData.order.id}`,
        {
          headers: { Authorization: `Bearer ${testData.merchant.token}` },
        }
      );
      expect(response.data.order.status).toBe('placed');

      // 2. Merchant confirms → 'confirmed'
      response = await axios.patch(
        `${MERCHANT_API_BASE}/orders/${testData.order.id}/status`,
        { status: 'confirmed', note: 'Order received' },
        {
          headers: { Authorization: `Bearer ${testData.merchant.token}` },
        }
      );
      expect(response.status).toBe(200);
      expect(response.data.data.status).toBe('confirmed');

      // 3. Merchant starts preparing → 'preparing'
      response = await axios.patch(
        `${MERCHANT_API_BASE}/orders/${testData.order.id}/status`,
        { status: 'preparing', note: 'Started cooking' },
        {
          headers: { Authorization: `Bearer ${testData.merchant.token}` },
        }
      );
      expect(response.data.data.status).toBe('preparing');

      // 4. Food ready → 'ready'
      response = await axios.patch(
        `${MERCHANT_API_BASE}/orders/${testData.order.id}/status`,
        { status: 'ready', note: 'Ready for dispatch' },
        {
          headers: { Authorization: `Bearer ${testData.merchant.token}` },
        }
      );
      expect(response.data.data.status).toBe('ready');

      // 5. Dispatched → 'dispatched'
      response = await axios.patch(
        `${MERCHANT_API_BASE}/orders/${testData.order.id}/status`,
        { status: 'dispatched', note: 'Handed to delivery partner' },
        {
          headers: { Authorization: `Bearer ${testData.merchant.token}` },
        }
      );
      expect(response.data.data.status).toBe('dispatched');

      // 6. Out for delivery → 'out_for_delivery'
      response = await axios.patch(
        `${MERCHANT_API_BASE}/orders/${testData.order.id}/status`,
        { status: 'out_for_delivery', note: 'Delivery in progress' },
        {
          headers: { Authorization: `Bearer ${testData.merchant.token}` },
        }
      );
      expect(response.data.data.status).toBe('out_for_delivery');

      // 7. Delivered → 'delivered'
      response = await axios.patch(
        `${MERCHANT_API_BASE}/orders/${testData.order.id}/status`,
        { status: 'delivered', note: 'Delivered successfully' },
        {
          headers: { Authorization: `Bearer ${testData.merchant.token}` },
        }
      );
      expect(response.data.data.status).toBe('delivered');
    });

    it('should enforce state machine rules and reject invalid transitions', async () => {
      // Create a new order to test invalid transition
      const orderResponse = await axios.post(
        `${API_BASE}/orders`,
        {
          deliveryAddress: {
            name: 'Test',
            phone: '9876543210',
            addressLine1: '123 St',
            city: 'Bangalore',
            state: 'KA',
            pincode: '560001',
          },
          paymentMethod: 'cod',
          idempotencyKey: `order-invalid-${Date.now()}`,
        },
        {
          headers: { Authorization: `Bearer ${testData.customer.token}` },
        }
      );

      const orderId = orderResponse.data.order._id;

      // Try to jump from 'placed' → 'ready' (should fail)
      try {
        await axios.patch(
          `${MERCHANT_API_BASE}/orders/${orderId}/status`,
          { status: 'ready' }, // Invalid: must go through confirmed → preparing first
          {
            headers: { Authorization: `Bearer ${testData.merchant.token}` },
          }
        );
        throw new Error('Should have rejected invalid transition');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('Invalid');
        expect(error.response.data.currentStatus).toBe('placed');
        expect(error.response.data.validNextStatuses).toContain('confirmed');
      }
    });

    it('should track status history with timestamps', async () => {
      const response = await axios.get(
        `${MERCHANT_API_BASE}/orders/${testData.order.id}`,
        {
          headers: { Authorization: `Bearer ${testData.merchant.token}` },
        }
      );

      const order = response.data.data;
      expect(order.statusHistory).toBeDefined();
      expect(Array.isArray(order.statusHistory)).toBe(true);
      expect(order.statusHistory.length).toBeGreaterThan(0);

      // Verify history entries have status, timestamp, note
      order.statusHistory.forEach((entry: any) => {
        expect(entry.status).toBeDefined();
        expect(entry.timestamp).toBeDefined();
        expect(new Date(entry.timestamp)).toBeInstanceOf(Date);
      });
    });
  });

  describe('3. Merchant Order Filtering & Stats', () => {
    it('should filter orders by status', async () => {
      const response = await axios.get(
        `${MERCHANT_API_BASE}/orders?status=delivered`,
        {
          headers: { Authorization: `Bearer ${testData.merchant.token}` },
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
      response.data.data.forEach((order: any) => {
        expect(order.status).toBe('delivered');
      });
    });

    it('should return order statistics', async () => {
      const response = await axios.get(
        `${MERCHANT_API_BASE}/orders/stats/summary`,
        {
          headers: { Authorization: `Bearer ${testData.merchant.token}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.data).toHaveProperty('totalOrders');
      expect(response.data.data).toHaveProperty('todayOrders');
      expect(response.data.data).toHaveProperty('pendingOrders');
      expect(response.data.data).toHaveProperty('totalRevenue');
      expect(response.data.data).toHaveProperty('merchantPayout');
    });
  });

  describe('4. KDS Real-Time Updates', () => {
    it('should emit Socket.IO events on status transitions', async (done) => {
      const { io } = require('socket.io-client');
      const socket = io(MERCHANT_API_BASE, {
        auth: {
          token: testData.merchant.token,
        },
      });

      socket.on('connect', () => {
        // Subscribe to store
        socket.emit('join-store', { storeId: testData.store.id });

        // Listen for order status updates
        socket.on('order-status-updated', (data: any) => {
          expect(data.orderId).toBeDefined();
          expect(data.newStatus).toBeDefined();
          socket.disconnect();
          done();
        });

        // Trigger a status change
        setTimeout(async () => {
          await axios.patch(
            `${MERCHANT_API_BASE}/orders/${testData.order.id}/status`,
            { status: 'confirmed' },
            {
              headers: { Authorization: `Bearer ${testData.merchant.token}` },
            }
          );
        }, 500);
      });

      socket.on('error', (error: any) => {
        socket.disconnect();
        done(error);
      });
    });
  });

  describe('5. Customer Order Tracking', () => {
    it('should return order progress percentage', async () => {
      const response = await axios.get(
        `${API_BASE}/orders/${testData.order.id}/tracking`,
        {
          headers: { Authorization: `Bearer ${testData.customer.token}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('progress');
      expect(typeof response.data.progress).toBe('number');
      expect(response.data.progress).toBeGreaterThanOrEqual(0);
      expect(response.data.progress).toBeLessThanOrEqual(100);
    });
  });

  describe('6. Order Cancellation & Refunds', () => {
    it('should allow cancellation from placed state', async () => {
      const orderResponse = await axios.post(
        `${API_BASE}/orders`,
        {
          deliveryAddress: {
            name: 'Cancel Test',
            phone: '9876543210',
            addressLine1: '999 Test St',
            city: 'Bangalore',
            state: 'KA',
            pincode: '560099',
          },
          paymentMethod: 'wallet',
          idempotencyKey: `order-cancel-${Date.now()}`,
        },
        {
          headers: { Authorization: `Bearer ${testData.customer.token}` },
        }
      );

      const orderId = orderResponse.data.order._id;

      // Cancel immediately from 'placed'
      const response = await axios.post(
        `${API_BASE}/orders/${orderId}/cancel`,
        { reason: 'Changed mind' },
        {
          headers: { Authorization: `Bearer ${testData.customer.token}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.order.status).toBe('cancelled');
    });
  });
});

describe('Offer System Integration', () => {
  it('should apply valid discount code to order', async () => {
    const response = await axios.post(
      `${API_BASE}/orders`,
      {
        deliveryAddress: {
          name: 'Offer Test',
          phone: '9876543210',
          addressLine1: '111 Offer St',
          city: 'Bangalore',
          state: 'KA',
          pincode: '560011',
        },
        paymentMethod: 'razorpay',
        couponCode: 'SAVE10',
        idempotencyKey: `order-offer-${Date.now()}`,
      },
      {
        headers: { Authorization: `Bearer ${testData.customer.token}` },
      }
    );

    expect(response.status).toBe(201);
    expect(response.data.order.redemption).toBeDefined();
    expect(response.data.order.redemption.code).toBe('SAVE10');
  });

  it('should reject expired coupon code', async () => {
    try {
      await axios.post(
        `${API_BASE}/orders`,
        {
          deliveryAddress: {
            name: 'Expired Offer',
            phone: '9876543210',
            addressLine1: '222 Expire St',
            city: 'Bangalore',
            state: 'KA',
            pincode: '560022',
          },
          paymentMethod: 'wallet',
          couponCode: 'EXPIRED2023',
          idempotencyKey: `order-expired-${Date.now()}`,
        },
        {
          headers: { Authorization: `Bearer ${testData.customer.token}` },
        }
      );
      throw new Error('Should have rejected expired coupon');
    } catch (error: any) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.message).toContain('expired');
    }
  });
});
