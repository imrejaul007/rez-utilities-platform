/**
 * Wallet API validation schemas
 * Validates WalletDebit, WalletCredit, and CoinTransactionResponse requests/responses
 * Canonical coin priority: promo > branded > prive > cashback > referral > rez
 */

import { z } from 'zod';

// Coin types enum (6 types with priority ordering)
export const COIN_TYPE = z.enum([
  'promo',
  'branded',
  'prive',
  'cashback',
  'referral',
  'rez',
]);

// Coin transaction types enum
export const COIN_TRANSACTION_TYPE = z.enum([
  'earned',
  'spent',
  'expired',
  'refunded',
  'bonus',
  'branded_award',
]);

// Transaction status enum
export const TRANSACTION_STATUS = z.enum([
  'pending',
  'completed',
  'failed',
  'cancelled',
]);

// Wallet Balance schema
export const WalletBalanceSchema = z.object({
  total: z.number().min(0),
  available: z.number().min(0),
  pending: z.number().min(0),
  cashback: z.number().min(0).optional(),
});

// Coin schema
export const CoinSchema = z.object({
  type: z.string().refine((val) => COIN_TYPE.safeParse(val).success, {
    message: 'Invalid coin type',
  }),
  amount: z.number().min(0),
  isActive: z.boolean(),
  expiryDate: z.date().optional(),
});

// Wallet Debit Request (spend coins)
export const WalletDebitSchema = z.object({
  user: z.string().min(1, 'User ID is required'),
  amount: z.number().positive('Debit amount must be positive'),
  source: z.string().min(1, 'Source is required'),
  sourceId: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  merchantId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  idempotencyKey: z.string().optional(),
});

// Wallet Credit Request (earn coins)
export const WalletCreditSchema = z.object({
  user: z.string().min(1, 'User ID is required'),
  coinType: COIN_TYPE,
  amount: z.number().positive('Credit amount must be positive'),
  source: z.string().min(1, 'Source is required'),
  sourceId: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  merchantId: z.string().optional(),
  expiryDate: z.date().optional(),
  metadata: z.record(z.any()).optional(),
  idempotencyKey: z.string().optional(),
});

// Coin Transaction Response
export const CoinTransactionResponseSchema = z.object({
  _id: z.string().optional(),
  user: z.string(),
  type: COIN_TRANSACTION_TYPE,
  coinType: COIN_TYPE,
  amount: z.number().min(0),
  balanceBefore: z.number().min(0),
  balanceAfter: z.number().min(0),
  source: z.string(),
  sourceId: z.string().optional(),
  description: z.string(),
  merchantId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  idempotencyKey: z.string().optional(),
  status: TRANSACTION_STATUS,
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

// Coin Transaction List Response
export const CoinTransactionListResponseSchema = z.array(
  CoinTransactionResponseSchema,
);

// Wallet Balance Response
export const WalletBalanceResponseSchema = z.object({
  user: z.string(),
  balance: WalletBalanceSchema,
  coins: z.array(CoinSchema).optional(),
  currency: z.string(),
  isFrozen: z.boolean().optional(),
  isActive: z.boolean(),
  updatedAt: z.date().optional(),
});

// Infer TypeScript types
export type WalletDebitRequest = z.infer<typeof WalletDebitSchema>;
export type WalletCreditRequest = z.infer<typeof WalletCreditSchema>;
export type CoinTransactionResponse = z.infer<typeof CoinTransactionResponseSchema>;
export type CoinTransactionListResponse = z.infer<typeof CoinTransactionListResponseSchema>;
export type WalletBalanceResponse = z.infer<typeof WalletBalanceResponseSchema>;
export type CoinType = z.infer<typeof COIN_TYPE>;
export type CoinTransactionType = z.infer<typeof COIN_TRANSACTION_TYPE>;
export type TransactionStatus = z.infer<typeof TRANSACTION_STATUS>;

// Canonical coin priority order for debit operations
export const COIN_PRIORITY_ORDER: Array<z.infer<typeof COIN_TYPE>> = [
  'promo',
  'branded',
  'prive',
  'cashback',
  'referral',
  'rez',
];
