# @rez/shared-types

Canonical TypeScript interfaces for all RuFlo core entities. This package provides the single source of truth for entity types across the entire monorepo.

## Entities (12 Core + Support Types)

### 1. User (`IUser`)
- **Interfaces**: IUser, IUserProfile, IUserAuth, IUserReferral, IUserPreferences, IUserVerifications
- **Enums**: UserRole (7 types), Gender, VerificationStatus, Theme, ReferralTier, RezPlusTier, PriveTier, LoyaltyTier
- **Status**: Complete with exclusive zone verifications (Student, Corporate, Defence, Healthcare, Senior, Teacher, Government, DifferentlyAbled)

### 2. Order (`IOrder`)
- **Interfaces**: IOrder, IOrderItem, IOrderTotals, IOrderPayment, IOrderDelivery
- **Enums**: OrderStatus (11 states)
- **States**: placed → confirmed → preparing → ready → dispatched → out_for_delivery → delivered / cancelled / cancelling / returned / refunded

### 3. Payment (`IPayment`)
- **Interfaces**: IPayment, IPaymentUserDetails, IPaymentGatewayResponse
- **Enums**: PaymentStatus (11 states), PaymentMethod (7 types)
- **FSM**: Full state transition map (PAYMENT_STATE_TRANSITIONS)
- **Statuses**: pending → processing → completed / failed / cancelled / expired, plus refund states

### 4. Product (`IProduct`)
- **Interfaces**: IProduct, IProductPricing, IProductRating, IProductImage
- **Canonical Format**: `pricing.selling` + `pricing.mrp` (NOT price.current/original)
- **Images**: Object format `{ url, alt, isPrimary }` (canonical)

### 5. Wallet (`IWallet`)
- **Interfaces**: IWallet, ICoin, IBrandedCoin, ICoinTransaction, IWalletBalance, IWalletStatistics, IWalletLimits, IWalletSavingsInsights
- **Coin Types**: 6 types (rez, promo, branded, prive, cashback, referral)
- **Priority Order**: `COIN_PRIORITY = ['promo', 'branded', 'prive', 'cashback', 'referral', 'rez']`
- **Features**: Balance tracking, per-coin expiry, daily spend limits, savings insights

### 6. Campaign (`ICampaign`)
- **Interfaces**: IBaseCampaign, IMarketingCampaign, IAdCampaign, IMerchantCampaign
- **Enums**: CampaignStatus (6 states), CampaignChannel (7 channels)
- **Variants**: Type-discriminated union (marketing | ad | merchant)

### 7. Notification (`INotification`)
- **Interfaces**: INotification, INotificationEvent, INotificationRecipient
- **Enums**: NotificationType (7 types), NotificationChannel (4 channels)

### 8. Merchant (`IMerchant`)
- **Interfaces**: IMerchant, IMerchantProfile, IMerchantLocation
- **Fields**: Store details, verification docs, bank details, ratings, revenue tracking

### 9. Offer (`IOffer`)
- **Interfaces**: IOffer, IOfferConditions
- **Enums**: OfferType (5 types), DiscountType (4 types)

### 10. Finance Transaction (`IFinanceTransaction`)
- **Types**: bnpl_payment, bill_payment, recharge, emi_payment, credit_card_payment
- **Statuses**: pending, completed, failed, refunded
- **Features**: Parent reference linking, coin awards, operator/biller details

### 11. Gamification (`IGamificationProfile`)
- **Interfaces**: IGamificationProfile, IBadge, IReward
- **Features**: Points, levels, badges, rewards, streaks

### 12. Analytics (`IAnalyticsEvent`)
- **Interfaces**: IAnalyticsEvent, IAnalyticsEventContext
- **Enum**: EventType (12 event types)

## Usage

```typescript
import {
  IUser,
  UserRole,
  IOrder,
  OrderStatus,
  IPayment,
  PaymentStatus,
  IProduct,
  IWallet,
  COIN_PRIORITY,
  ICampaign,
  CampaignStatus,
} from '@rez/shared-types';

// Type-safe user creation
const user: IUser = {
  phoneNumber: '+919876543210',
  email: 'user@rez.com',
  profile: { firstName: 'John' },
  preferences: { language: 'en' },
  auth: { isVerified: true, isOnboarded: true, loginAttempts: 0 },
  referral: { referralCode: 'JOHN123', referredUsers: [], totalReferrals: 0, referralEarnings: 0 },
  role: UserRole.USER,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Type-safe order with statuses
const order: IOrder = {
  status: OrderStatus.DELIVERED,
  user: 'userId',
  store: 'storeId',
  items: [{ name: 'Ring', quantity: 1, price: 5000 }],
};

// Type-safe payment with FSM validation
const payment: IPayment = {
  paymentId: 'PAY123',
  orderId: 'ORD123',
  user: 'userId',
  amount: 5000,
  currency: 'INR',
  paymentMethod: 'upi',
  purpose: 'order_payment',
  status: PaymentStatus.COMPLETED,
  userDetails: {},
  metadata: {},
};

// Coin priority order
const priorityOrder = COIN_PRIORITY; // ['promo', 'branded', 'prive', 'cashback', 'referral', 'rez']
```

## Key Design Decisions

1. **Canonical Pricing Format**: All products use `pricing.selling` + `pricing.mrp`, not `price.current/original`
2. **Coin Priority**: Fixed 6-type ordering for debit operations: promo → branded → prive → cashback → referral → rez
3. **Payment FSM**: Complete 11-state finite state machine with explicit transitions
4. **Order Statuses**: All 11 terminal states (placed, confirmed, preparing, ready, dispatched, out_for_delivery, delivered, cancelled, cancelling, returned, refunded)
5. **User Roles**: 7 role types for complete RBAC coverage (user, consumer, merchant, admin, support, operator, super_admin)
6. **Product Images**: Canonical object format `{ url, alt, isPrimary }` for consistency
7. **Wallet Architecture**: Multi-tier balance tracking with per-coin expiry and daily limits

## Building

```bash
npm install
npm run build
npm run watch  # For development
```

## Files

- `src/enums/index.ts` - All shared enums (30+ types)
- `src/entities/` - 12 entity types (user, order, payment, product, wallet, campaign, notification, merchant, offer, finance, gamification, analytics)
- `src/index.ts` - Central re-export file
