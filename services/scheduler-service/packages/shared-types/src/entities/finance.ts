/**
 * Finance transaction entity types — based on canonical FinanceTransaction.ts
 * Includes IFinanceTransaction with 4 statuses and 5 transaction types
 */

import { FinanceTransactionType, FinanceTransactionStatus } from '../enums/index';

export interface IFinanceTransaction {
  _id?: string;
  userId: string;
  type: FinanceTransactionType;
  status: FinanceTransactionStatus;
  amount: number;
  currency: string;

  // Operator / biller details (for bill pay / recharge)
  operator?: string;
  billerId?: string;
  accountNumber?: string;

  // Linked entities
  loanApplicationId?: string;
  orderId?: string;

  // Partner / gateway
  partnerId: string;
  partnerTxId?: string;

  // Failure
  failureReason?: string;

  // Coins awarded
  coinsAwarded: number;

  // Parent reference
  parentId?: string;
  parentType?: 'Payment' | 'LoanApplication' | 'Order';

  // Metadata
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}
