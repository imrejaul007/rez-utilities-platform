/**
 * @rez/shared-types
 * Canonical TypeScript interfaces for all RuFlo core entities
 *
 * This package provides type-safe interfaces for:
 * - User, Profile, Auth, Referral, Preferences
 * - Order, OrderItem with 11 statuses
 * - Payment with full 11-state FSM
 * - Product with canonical pricing (selling + mrp)
 * - Wallet, Coin, CoinTransaction with 6 coin types + COIN_PRIORITY
 * - Campaign (Marketing, Ad, Merchant variants)
 * - Notification with channels
 * - Merchant & MerchantProfile
 * - Offer with discount types
 * - Finance Transaction with 5 types
 * - Gamification (Profile, Badge, Reward)
 * - Analytics Events
 */

// Enums
export {
  UserRole,
  Gender,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentGateway,
  CoinType,
  COIN_PRIORITY,
  CoinTransactionType,
  CampaignStatus,
  CampaignChannel,
  NotificationType,
  NotificationChannel,
  OfferType,
  DiscountType,
  FinanceTransactionType,
  FinanceTransactionStatus,
  VerificationStatus,
  JewelryStyle,
  Theme,
  ReferralTier,
  RezPlusTier,
  PriveTier,
  LoyaltyTier,
  LocationSource,
  DocumentType,
  ProfessionType,
  ServiceType,
  EventType,
  TransactionStatus,
  // CoinType utilities
  normalizeCoinType,
  isCanonicalCoinType,
  normalizeCoinTypeAs,
  COIN_TYPE_VALUES,
} from './enums/index';

// User entity
export {
  IUserProfile,
  IUserPreferences,
  IUserAuth,
  IUserReferral,
  IUserWallet,
  IUserVerifications,
  IUser,
  IUserLocation,
  IUserLocationHistory,
  IUserJewelryPreferences,
  IUserNotificationPreferences,
  IUserVerificationDocument,
  IUserSocialLogin,
  IStudentVerification,
  ICorporateVerification,
  IDefenceVerification,
  IHealthcareVerification,
  ISeniorVerification,
  ITeacherVerification,
  IGovernmentVerification,
  IDifferentlyAbledVerification,
} from './entities/user';

// Order entity
export {
  IOrder,
  IOrderItem,
  IOrderTotals,
  IOrderPayment,
  IOrderDelivery,
} from './entities/order';

// Payment entity
export {
  IPayment,
  IPaymentUserDetails,
  IPaymentGatewayResponse,
  PAYMENT_STATE_TRANSITIONS,
} from './entities/payment';

// Product entity
export {
  IProduct,
  IProductPricing,
  IProductRating,
  IProductImage,
} from './entities/product';

// Wallet entity
export {
  IWallet,
  ICoin,
  IBrandedCoin,
  ICoinTransaction,
  IWalletBalance,
  IWalletStatistics,
  IWalletLimits,
  IWalletSavingsInsights,
  COIN_PRIORITY_ORDER,
} from './entities/wallet';

// Campaign entity
export {
  IBaseCampaign,
  IMarketingCampaign,
  IAdCampaign,
  IMerchantCampaign,
  ICampaign,
} from './entities/campaign';

// Notification entity
export {
  INotification,
  INotificationEvent,
  INotificationRecipient,
} from './entities/notification';

// Merchant entity
export {
  IMerchant,
  IMerchantProfile,
  IMerchantLocation,
} from './entities/merchant';

// Offer entity
export {
  IOffer,
  IOfferConditions,
} from './entities/offer';

// Finance entity
export {
  IFinanceTransaction,
} from './entities/finance';

// Gamification entity
export {
  IBadge,
  IReward,
} from './entities/gamification';

// Karma entity (rez-karma-service canonical types)
export {
  IKarmaProfile,
  IKarmaEvent,
  IQRCodeSet,
  IConversionBatch,
  ILevelInfo,
  IKarmaStats,
  IEarnRecord,
  IVerificationSignals,
  IBadge as IBadgeKarma,
  ILevelHistoryEntry,
  IConversionHistoryEntry,
  KarmaProfileDelta,
  KarmaLevel,
  KarmaConversionRate,
  EarnRecordStatus,
  BatchStatus,
  CSRPoolStatus,
  KarmaVerificationStatus,
  EventDifficulty,
  EventCategory,
  KarmaEventStatus,
} from './entities/karma';

// Analytics entity
export {
  IAnalyticsEvent,
  IAnalyticsEventContext,
} from './entities/analytics';
