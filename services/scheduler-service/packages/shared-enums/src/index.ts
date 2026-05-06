// P1-ARCH-1: Canonical enum definitions for ReZ platform
//
// DEPRECATION NOTICE (2026-04-14):
// The canonical source of truth is now @rez/shared (the rez-shared/ directory at
// the repo root). Enum definitions have been consolidated there at src/enums.ts.
//
// This package (@rez/shared-enums) is kept as-is for backward compatibility but
// should NOT be used by new code.
//
// Migration:
//   import { COIN_TYPES, normalizeCashbackStatus, normalizeLoyaltyTier } from '@rez/shared';
//   import { LOYALTY_TIERS, TRANSACTION_TYPES, USER_ROLES } from '@rez/shared';
//
// NO service currently imports from this package. All services either:
//   1. Import from @rez/shared (via npm/workspace)
//   2. Define enums locally (anti-pattern — to be migrated)
// See: packages/rez-shared/src/enums.ts (canonical consolidated source)

// Coin Types
export const COIN_TYPES = {
  REZ: 'rez',
  PRIVE: 'prive',
  BRANDED: 'branded',
  PROMO: 'promo',
  CASHBACK: 'cashback',
  REFERRAL: 'referral',
} as const;
export type CoinType = typeof COIN_TYPES[keyof typeof COIN_TYPES];

// Loyalty Tiers
export const LOYALTY_TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const;
export type LoyaltyTier = typeof LOYALTY_TIERS[number];

// Cashback Status
export const CASHBACK_STATUS = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CREDITED: 'credited',
  PAID: 'paid',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;
export type CashbackStatus = typeof CASHBACK_STATUS[keyof typeof CASHBACK_STATUS];

// Transaction Types
export const TRANSACTION_TYPES = {
  EARNED: 'earned',
  SPENT: 'spent',
  EXPIRED: 'expired',
  REFUNDED: 'refunded',
  BONUS: 'bonus',
  BRANDED_AWARD: 'branded_award',
  TRANSFER: 'transfer',
  GIFT: 'gift',
} as const;
export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];

// User Roles
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  MERCHANT: 'merchant',
  SUPPORT: 'support',
  OPERATOR: 'operator',
  SUPER_ADMIN: 'super_admin',
} as const;
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Normalization helpers (mirrors those in @rez/shared/constants/coins.ts)
export function normalizeCoinType(type: string): CoinType {
  if (!type) return 'rez';
  const map: Record<string, CoinType> = {
    REZ: 'rez', PRIVE: 'prive', BRANDED: 'branded', PROMO: 'promo',
    CASHBACK: 'cashback', REFERRAL: 'referral',
  };
  return map[type.toUpperCase()] || 'rez';
}

export function normalizeCashbackStatus(status: string): CashbackStatus {
  if (!status) return 'pending';
  const map: Record<string, CashbackStatus> = {
    PENDING: 'pending', UNDER_REVIEW: 'under_review', APPROVED: 'approved',
    REJECTED: 'rejected', CREDITED: 'credited', PAID: 'paid',
    EXPIRED: 'expired', CANCELLED: 'cancelled',
  };
  return map[status.toUpperCase()] || 'pending';
}

export function normalizeLoyaltyTier(tier: string): LoyaltyTier {
  if (!tier) return 'bronze';
  const map: Record<string, LoyaltyTier> = {
    BRONZE: 'bronze', SILVER: 'silver', GOLD: 'gold', PLATINUM: 'platinum',
    STARTER: 'bronze', DIAMOND: 'platinum', DIMAOND: 'platinum',
  };
  return map[tier.toUpperCase()] || 'bronze';
}
