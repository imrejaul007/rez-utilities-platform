/**
 * @rez/shared-types/enums/coinType
 *
 * Canonical CoinType enum + normalization utility.
 *
 * The CoinType enum has 6 values covering all coin variants across the platform.
 * Legacy systems may use non-canonical string values (e.g., 'karma_points',
 * 'nuqta', 'rez_coins'). Use `normalizeCoinType()` to safely convert any
 * legacy value to a canonical CoinType.
 */

import { CoinType as CoinTypeEnum } from './index';

/**
 * Legacy → canonical CoinType mapping.
 * Covers all known non-canonical variants used across services.
 */
const COIN_TYPE_ALIASES: Readonly<Record<string, CoinTypeEnum>> = {
  // Legacy ruFlo naming
  nuqta: CoinTypeEnum.REZ,
  wasil_coins: CoinTypeEnum.REZ,
  wasil_bonus: CoinTypeEnum.REZ,
  earning: CoinTypeEnum.REZ,
  earnings: CoinTypeEnum.REZ,

  // Karma system variants
  karma_points: CoinTypeEnum.REZ,
  karma_coins: CoinTypeEnum.REZ,

  // Consumer app display names
  rez_coins: CoinTypeEnum.REZ,
  branded_coin: CoinTypeEnum.BRANDED,
  branded_coins: CoinTypeEnum.BRANDED,
  prive_coins: CoinTypeEnum.PRIVE,

  // Other legacy variants
  loyalty: CoinTypeEnum.REZ,
  reward: CoinTypeEnum.PROMO,
  bonus: CoinTypeEnum.PROMO,
  promotional: CoinTypeEnum.PROMO,
  promotional_coins: CoinTypeEnum.PROMO,

  // Case-insensitive fallbacks
  promo: CoinTypeEnum.PROMO,
  branded: CoinTypeEnum.BRANDED,
  prive: CoinTypeEnum.PRIVE,
  cashback: CoinTypeEnum.CASHBACK,
  referral: CoinTypeEnum.REFERRAL,
  rez: CoinTypeEnum.REZ,
};

/**
 * Canonical CoinType values as a readonly array.
 */
export const COIN_TYPE_VALUES = [
  CoinTypeEnum.PROMO,
  CoinTypeEnum.BRANDED,
  CoinTypeEnum.PRIVE,
  CoinTypeEnum.CASHBACK,
  CoinTypeEnum.REFERRAL,
  CoinTypeEnum.REZ,
] as const;

/**
 * Check if a string is a valid canonical CoinType value.
 */
export function isCanonicalCoinType(value: string): value is CoinTypeEnum {
  return (COIN_TYPE_VALUES as readonly string[]).includes(value);
}

/**
 * Normalize any coin type string (including legacy variants) to a canonical CoinType.
 *
 * @param type - The coin type string to normalize (may be canonical or legacy)
 * @param fallback - Value returned if type is unknown (default: REZ)
 * @returns The canonical CoinType equivalent
 *
 * @example
 * normalizeCoinType('karma_points')  // → CoinType.REZ
 * normalizeCoinType('nuqta')          // → CoinType.REZ
 * normalizeCoinType('branded_coin')   // → CoinType.BRANDED
 * normalizeCoinType('promo')          // → CoinType.PROMO
 * normalizeCoinType('unknown_value')   // → CoinType.REZ (fallback)
 */
export function normalizeCoinType(
  type: string | null | undefined,
  fallback: CoinTypeEnum = CoinTypeEnum.REZ,
): CoinTypeEnum {
  if (!type) return fallback;
  const normalized = type.toLowerCase().trim();
  return COIN_TYPE_ALIASES[normalized] ?? fallback;
}

/**
 * Normalize a coin type and assert it matches a specific type.
 * Useful for narrowing union types after normalization.
 */
export function normalizeCoinTypeAs<T extends CoinTypeEnum>(
  type: string | null | undefined,
  assertType: T,
): T {
  const normalized = normalizeCoinType(type, assertType);
  return normalized === assertType ? assertType : assertType;
}
