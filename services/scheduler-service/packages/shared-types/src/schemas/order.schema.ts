/**
 * Order API validation schemas
 * Validates CreateOrder, UpdateOrderStatus, and OrderResponse requests/responses
 * Includes all 11 order statuses
 */

import { z } from 'zod';

// Order status enum (11 states)
export const ORDER_STATUS = z.enum([
  'placed',
  'confirmed',
  'preparing',
  'ready',
  'dispatched',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'cancelling',
  'returned',
  'refunded',
]);

// Payment status enum (11 states)
export const PAYMENT_STATUS = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'expired',
  'refund_initiated',
  'refund_processing',
  'refunded',
  'refund_failed',
  'partially_refunded',
]);

// Order Item schema
export const OrderItemSchema = z.object({
  itemId: z.string().optional(),
  name: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  price: z.number().positive().optional(),
}).passthrough(); // Allow additional fields for flexibility

// Order Totals schema
export const OrderTotalsSchema = z.object({
  subtotal: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  deliveryFee: z.number().min(0).optional(),
  total: z.number().min(0).optional(),
}).passthrough();

// Order Payment schema
export const OrderPaymentSchema = z.object({
  method: z.string().optional(),
  status: PAYMENT_STATUS.optional(),
  amount: z.number().min(0).optional(),
}).passthrough();

// Order Delivery schema
export const OrderDeliverySchema = z.object({
  type: z.string().optional(),
  address: z.record(z.any()).optional(),
}).passthrough();

// Create Order Request
export const CreateOrderSchema = z.object({
  user: z.string().min(1, 'User ID is required'),
  store: z.string().min(1, 'Store ID is required'),
  items: z.array(OrderItemSchema).min(1, 'At least one item is required'),
  totals: OrderTotalsSchema.optional(),
  payment: OrderPaymentSchema.optional(),
  delivery: OrderDeliverySchema.optional(),
  currency: z.string().optional().default('INR'),
});

// Update Order Status Request
export const UpdateOrderStatusSchema = z.object({
  status: ORDER_STATUS,
  reason: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Order Response
export const OrderResponseSchema = z.object({
  _id: z.string().optional(),
  orderNumber: z.string().optional(),
  status: ORDER_STATUS,
  user: z.string(),
  store: z.string(),
  items: z.array(OrderItemSchema),
  totals: OrderTotalsSchema.optional(),
  payment: OrderPaymentSchema.optional(),
  delivery: OrderDeliverySchema.optional(),
  currency: z.string(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
}).passthrough();

// List Orders Response
export const OrderListResponseSchema = z.array(OrderResponseSchema);

// Infer TypeScript types
export type CreateOrderRequest = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusRequest = z.infer<typeof UpdateOrderStatusSchema>;
export type OrderResponse = z.infer<typeof OrderResponseSchema>;
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;
export type OrderStatus = z.infer<typeof ORDER_STATUS>;
