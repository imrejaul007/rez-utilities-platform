/**
 * Wallet entity types — based on canonical walletService.ts and Wallet model
 * Includes IWallet, ICoin, ICoinTransaction with COIN_PRIORITY ordering
 */

import { CoinType, CoinTransactionType, TransactionStatus, COIN_PRIORITY } from '../enums/index';

export interface IWalletBalance {
  total: number;
  available: number;
  pending: number;
  cashback: number;
}

export interface ICoin {
  type: CoinType | string;
  amount: number;
  isActive: boolean;
  expiryDate?: Date;
}

export interface IBrandedCoin {
  type: 'branded';
  amount: number;
  isActive: boolean;
  expiresAt?: Date;
}

export interface IWalletStatistics {
  totalEarned: number;
  totalSpent: number;
  totalCashback: number;
  transactionCount: number;
}

export interface IWalletLimits {
  maxBalance: number;
  minWithdrawal: number;
  dailySpendLimit: number;
  dailySpent: number;
  lastResetDate: Date;
}

export interface IWalletSavingsInsights {
  totalSaved: number;
  thisMonth: number;
  avgPerVisit: number;
  lastCalculated: Date;
}

export interface IWallet {
  _id?: string;
  user: string;
  balance: IWalletBalance;
  coins: ICoin[];
  brandedCoins: IBrandedCoin[];
  currency: string;
  statistics: IWalletStatistics;
  limits: IWalletLimits;
  savingsInsights: IWalletSavingsInsights;
  isFrozen?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICoinTransaction {
  _id?: string;
  user: string;
  type: CoinTransactionType;
  coinType: CoinType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  source: string;
  sourceId?: string;
  description: string;
  merchantId?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
  status: TransactionStatus;
  createdAt: Date;
  updatedAt?: Date;
}

// Coin priority constant — canonical ordering for debit operations
export { COIN_PRIORITY };

export const COIN_PRIORITY_ORDER: CoinType[] = [
  CoinType.PROMO,
  CoinType.BRANDED,
  CoinType.PRIVE,
  CoinType.CASHBACK,
  CoinType.REFERRAL,
  CoinType.REZ,
];
