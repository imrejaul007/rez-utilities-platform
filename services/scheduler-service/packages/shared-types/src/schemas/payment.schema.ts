/**
 * Payment API validation schemas
 * Validates CreatePayment, PaymentResponse requests/responses
 * Includes full 11-state FSM for payment statuses
 */

import { z } from 'zod';

// Payment status enum (11 states + FSM)
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

// Payment method enum — method types (HOW the customer pays)
export const PAYMENT_METHOD = z.enum([
  'upi',
  'card',
  'wallet',
  'netbanking',
]);

// Payment gateway enum — provider names (WHO processes the payment)
export const PAYMENT_GATEWAY = z.enum([
  'stripe',
  'razorpay',
  'paypal',
]);

// Payment purpose enum
export const PAYMENT_PURPOSE = z.enum([
  'wallet_topup',
  'order_payment',
  'event_booking',
  'financial_service',
  'other',
]);

// User Details schema
export const PaymentUserDetailsSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Invalid email').optional(),
  phone: z.string().optional(),
});

// Gateway Response schema
export const PaymentGatewayResponseSchema = z.object({
  gateway: z.string().min(1, 'Gateway name is required'),
  transactionId: z.string().optional(),
  paymentUrl: z.string().url('Invalid payment URL').optional(),
  qrCode: z.string().optional(),
  upiId: z.string().optional(),
  expiryTime: z.date().optional(),
  timestamp: z.date(),
}).passthrough(); // Allow additional gateway-specific fields

// Create Payment Request
export const CreatePaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  orderId: z.string().min(1, 'Order ID is required'),
  user: z.string().min(1, 'User ID is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().min(1, 'Currency is required').default('INR'),
  /** How the customer pays: upi, card, wallet, netbanking */
  paymentMethod: PAYMENT_METHOD,
  /** Which gateway processes the payment: razorpay, stripe, paypal */
  gateway: PAYMENT_GATEWAY,
  purpose: PAYMENT_PURPOSE.optional().default('order_payment'),
  userDetails: PaymentUserDetailsSchema,
  metadata: z.record(z.any()).optional(),
  gatewayResponse: PaymentGatewayResponseSchema.optional(),
});

// Update Payment Status Request
export const UpdatePaymentStatusSchema = z.object({
  status: PAYMENT_STATUS,
  failureReason: z.string().optional(),
  walletCredited: z.boolean().optional(),
  refundedAmount: z.number().min(0).optional(),
  metadata: z.record(z.any()).optional(),
});

// Payment Response
export const PaymentResponseSchema = z.object({
  _id: z.string().optional(),
  paymentId: z.string(),
  orderId: z.string(),
  user: z.string(),
  amount: z.number(),
  currency: z.string(),
  /** How the customer pays: upi, card, wallet, netbanking */
  paymentMethod: PAYMENT_METHOD,
  /** Which gateway processes the payment: razorpay, stripe, paypal */
  gateway: PAYMENT_GATEWAY.optional(),
  purpose: PAYMENT_PURPOSE,
  status: PAYMENT_STATUS,
  userDetails: PaymentUserDetailsSchema,
  metadata: z.record(z.any()).optional(),
  gatewayResponse: PaymentGatewayResponseSchema.optional(),
  failureReason: z.string().optional(),
  walletCredited: z.boolean().optional(),
  walletCreditedAt: z.date().optional(),
  completedAt: z.date().optional(),
  failedAt: z.date().optional(),
  expiresAt: z.date().optional(),
  refundedAmount: z.number().min(0).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// List Payments Response
export const PaymentListResponseSchema = z.array(PaymentResponseSchema);

// Infer TypeScript types
export type CreatePaymentRequest = z.infer<typeof CreatePaymentSchema>;
export type UpdatePaymentStatusRequest = z.infer<typeof UpdatePaymentStatusSchema>;
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;
export type PaymentListResponse = z.infer<typeof PaymentListResponseSchema>;
export type PaymentStatus = z.infer<typeof PAYMENT_STATUS>;
export type PaymentMethod = z.infer<typeof PAYMENT_METHOD>;
export type PaymentGateway = z.infer<typeof PAYMENT_GATEWAY>;
export type PaymentPurpose = z.infer<typeof PAYMENT_PURPOSE>;
