# REZ Now — Data Models Reference

> **Status: BUILT** | Generated: 2026-04-14 | Domain: `now.rez.money`
> Sources: `rez-now/lib/types/index.ts` (frontend) + `rezbackend/src/models/` (backend)
> Supersedes: proposed schemas in `REZ_NOW_UNIVERSAL_PLATFORM.md` section 10

---

## Table of Contents

1. [Frontend TypeScript Interfaces](#1-frontend-typescript-interfaces)
2. [Backend Mongoose Schemas](#2-backend-mongoose-schemas)
3. [API Response Shapes](#3-api-response-shapes)
4. [Data Relationships](#4-data-relationships)
5. [Index Strategy](#5-index-strategy)
6. [Planned Models](#6-planned-models)

---

## 1. Frontend TypeScript Interfaces

File: `rez-now/lib/types/index.ts`

All types are exported from this single file. The frontend uses these to type API responses, store state, and component props.

### 1.1 Store

```typescript
// StoreType — which vertical / business type
export type StoreType =
  | 'restaurant' | 'cafe' | 'cloud_kitchen'
  | 'retail' | 'salon' | 'hotel'
  | 'service' | 'general';

// StoreInfo — the primary store data shape returned by GET /store/:slug
export interface StoreInfo {
  id: string;                        // MongoDB ObjectId as string
  name: string;                      // Display name, e.g. "Style Studio"
  slug: string;                      // URL slug, e.g. "style-studio" → now.rez.money/style-studio
  logo: string | null;
  banner: string | null;
  address: string;
  phone: string;
  storeType: StoreType;

  // Feature gates
  hasMenu: boolean;                 // true = Order & Pay (menu browsing); false = Scan & Pay only
  isProgramMerchant: boolean;        // true = show coin/wallet UI, loyalty stamps

  // Display hints
  estimatedPrepMinutes: number;      // 0 = hide wait badge; shown as "Ready in ~X mins"
  isOpen: boolean;
  nextChangeLabel: string;          // e.g. "Closes at 10 PM" or "Opens tomorrow at 9 AM"

  // Operating hours per day of week
  operatingHours: Record<string, {
    open: string;   // "HH:MM" e.g. "09:00"
    close: string;  // "HH:MM" e.g. "22:00"
    closed: boolean;
  } | null>;

  // Legal / social
  socialLinks?: { instagram?: string; facebook?: string; twitter?: string; website?: string; };
  gstNumber?: string;
  fssaiNumber?: string;
  googlePlaceId: string | null;

  // Coin / rewards
  rewardRules: {
    baseCashbackPercent: number;    // e.g. 10 = earn 10% back in coins
    coinsEnabled: boolean;           // derived: baseCashbackPercent > 0
  };

  // Promotions
  activePromos?: Array<{
    text: string;
    code?: string;
    bgColor?: string;
  }>;

  // Delivery
  deliveryEnabled: boolean;
  deliveryRadiusKm: number;
  deliveryFee: number;

  // Reservations
  reservationsEnabled?: boolean;
  maxTableCapacity?: number;

  // Tax
  gstEnabled: boolean;
  gstPercent: number;
}
```

### 1.2 Menu

```typescript
// MenuCategory — a named group of items (e.g. "Starters", "Beverages")
export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
}

// MenuItem — a single sellable item within a category
export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;                    // in paise (integer), e.g. 32000 = ₹320
  originalPrice: number | null;     // strikethrough MRP if discounted
  isVeg: boolean;                   // green dot = veg, red dot = non-veg
  isAvailable: boolean;              // false = sold out / unavailable
  spicyLevel: 0 | 1 | 2 | 3;      // 🌶️ count displayed on card
  image: string | null;
  customizations?: MenuCustomization[]; // optional modifiers/groups
}

// MenuCustomization — a group of selectable options (e.g. "Choose size", "Add extras")
export interface MenuCustomization {
  id: string;
  name: string;                     // "Choose size", "Add-ons"
  required: boolean;
  /** 'single' = radio (pick exactly one), 'multiple' = checkbox (pick many) */
  type: 'single' | 'multiple';
  minSelect?: number;               // for type='multiple' only
  maxSelect?: number;               // for type='multiple' only
  options: Array<{
    id: string;
    name: string;                   // "Regular", "Large", "Extra cheese"
    priceAdd: number;               // additional paise, e.g. 3000 = +₹30
  }>;
}
```

### 1.3 Cart

```typescript
// CartItem — an item in the customer's cart, with selections resolved
export interface CartItem {
  itemId: string;                   // matches MenuItem.id
  name: string;
  price: number;                    // in paise, base + customizationTotal
  basePrice: number;                // in paise, base only (no modifiers)
  quantity: number;
  // Map of customizationGroupId → array of selected optionIds
  customizations: Record<string, string[]>;
  customizationTotal: number;       // sum of all selected priceAdd values in paise
  isVeg: boolean;
}

// GroupOrder — shared cart for dine-in table ordering
export interface GroupOrder {
  groupId: string;
  storeSlug: string;
  members: Array<{
    phone: string;
    name?: string;
    itemCount: number;
  }>;
  items: CartItem[];
  status: 'open' | 'checking_out' | 'paid';
}
```

### 1.4 Auth

```typescript
export interface AuthUser {
  id: string;                       // MongoDB user _id
  name: string;
  phone: string;                    // E.164 format: "+919876543210"
  role: string;
  isOnboarded: boolean;
  referralCode?: string;
}

export interface AuthTokens {
  accessToken: string;              // JWT, short-lived
  refreshToken: string;             // longer-lived, used to get new access tokens
}
```

### 1.5 Order

```typescript
// WebOrderStatus — lifecycle states
export type WebOrderStatus =
  | 'pending_payment'              // created, awaiting Razorpay payment
  | 'confirmed'                    // paid, acknowledged by store
  | 'preparing'                    // kitchen is working
  | 'ready'                        // item is ready for pickup/customer
  | 'completed'                    // fully fulfilled
  | 'cancelled';                   // cancelled (pre or post payment)

// DeliveryAddress — for delivery-type orders
export interface DeliveryAddress {
  line1: string;
  city: string;
  pincode: string;
  latitude?: number;                // for distance calculation
  longitude?: number;
}

// WebOrder — full order object returned by GET /orders/:orderNumber
export interface WebOrder {
  id: string;
  orderNumber: string;              // e.g. "WEB-STYL-XXXXX-ABCD"
  status: WebOrderStatus;
  items: Array<{
    name: string;
    quantity: number;
    price: number;                  // in paise
    customizations?: Record<string, string[]>;
  }>;
  subtotal: number;                // in paise, before GST/tip
  gst: number;                     // in paise
  tip: number;                     // in paise
  donation: number;                 // in paise
  discount: number;                // in paise, from coupons
  deliveryFee?: number;             // in paise
  total: number;                   // final charged amount in paise
  customerPhone: string | null;
  tableNumber: string | null;
  orderType?: 'dine_in' | 'takeaway' | 'delivery';
  deliveryAddress?: DeliveryAddress;
  storeSlug: string;
  storeName: string;
  createdAt: string;               // ISO 8601
  updatedAt: string;                // ISO 8601
  rating?: number;                  // 1–5 stars submitted post-completion
}

// OrderHistoryItem — summary for list views (orders page, store history)
export interface OrderHistoryItem {
  orderNumber: string;
  status: WebOrderStatus;
  total: number;                   // in paise
  itemCount: number;
  storeName: string;
  storeSlug: string;
  createdAt: string;               // ISO 8601
}

// Socket event for live order status updates
export interface OrderStatusUpdateEvent {
  orderNumber: string;
  status: WebOrderStatus;
  storeId: string;
}
```

### 1.6 Wallet

```typescript
// WalletBalance — coin and rupee balances
export interface WalletBalance {
  coins: number;                    // total coin balance
  rupees: number;                  // coins / 100 = ₹ value
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
}

// WalletTransaction — a single ledger entry
export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;                  // coin amount
  coinType: string;                // 'rez', 'cashback', 'promo', or branded merchant coin
  source: string;                  // e.g. 'payment', 'cashback', 'referral', 'redemption'
  description: string;
  createdAt: string;               // ISO 8601
}
```

### 1.7 Payment

```typescript
// RazorpayOrderResponse — returned after POST /create-order
export interface RazorpayOrderResponse {
  razorpayOrderId: string;         // Razorpay's order_id
  amount: number;                  // in paise
  currency: string;                // "INR"
  keyId: string;                   // razorpay key_id (public)
  orderNumber: string;             // REZ's order number
}

// RazorpaySuccessResponse — the success callback payload from Razorpay widget
export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// ScanPayOrderResponse — scan & pay (static QR) order creation
export interface ScanPayOrderResponse {
  razorpayOrderId: string;
  amount: number;                  // in paise
  currency: string;
  keyId: string;
  paymentId: string;
}
```

### 1.8 Coupon

```typescript
// CouponValidateResponse — result of coupon code validation
export interface CouponValidateResponse {
  success: boolean;
  couponCode: string;
  discountType: 'percent' | 'flat';
  discountValue: number;            // e.g. 10 (means 10% or ₹10 flat)
  discountAmount: number;           // computed discount in paise
  message?: string;
}

// AvailableCoupon — a coupon available for a given cart
export interface AvailableCoupon {
  code: string;
  discountType: 'percent' | 'flat';
  discountValue: number;            // percent value (e.g. 10) or paise amount (e.g. 10000 = ₹100)
  description?: string;
  minOrderAmount?: number;          // in paise; 0 or undefined = no minimum
}
```

### 1.9 Bill Split

```typescript
export interface SplitBillResponse {
  billId: string;
  totalAmount: number;              // in paise
  splitCount: number;              // number of people
  perPersonAmount: number;         // in paise, rounded up
}
```

### 1.10 Loyalty

```typescript
export interface StampCard {
  totalStamps: number;             // stamps earned at this store
  stampsRequired: number;           // stamps needed for a reward
  rewardDescription: string;       // e.g. "Get a free coffee!"
}
```

### 1.11 API Response Wrapper

```typescript
// Generic API response envelope used across all endpoints
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
```

---

## 2. Backend Mongoose Schemas

All schemas live in `rezbackend/rez-backend-master/src/models/`.

### 2.1 Store (`Store.ts`)

The master record for every merchant. Contains everything needed to render a store page.

**Indexes:**

| Index | Fields | Purpose |
|-------|--------|---------|
| 2dsphere | `location.coordinates` | Geo queries (nearby stores) |
| compound | `category`, `isActive` | Category listing |
| compound | `location.city`, `isActive` | City-based search |
| compound | `hasMenu`, `isActive` | Menu store discovery |
| compound | `serviceCapabilities.tableBooking.enabled`, `category`, `isActive` | Reservation-eligible stores |
| compound | `serviceCapabilities.homeDelivery.enabled`, `category`, `isActive`, `ratings.average` | Delivery-capable stores |
| single | `slug` (unique) | Primary lookup for REZ Now |
| single | `merchantId` | Merchant ownership queries |
| single | `paymentSettings.upiId` | UPI payment routing |

**Key fields:**

```typescript
// storeType (REZ Now specific)
storeType?: 'restaurant' | 'cafe' | 'bakery' | 'salon' | 'spa' | 'retail' | 'other';

// REZ Now feature gates
isProgramMerchant?: boolean;          // coins + loyalty UI enabled
hasMenu?: boolean;                     // show menu vs. scan & pay only
estimatedPrepMinutes?: number;          // "Ready in ~X mins" badge

// Delivery
deliveryEnabled?: boolean;
deliveryRadiusKm?: number;
deliveryFee?: number;
storeLatitude?: number;
storeLongitude?: number;

// Reservations
reservationsEnabled?: boolean;
maxTableCapacity?: number;

// REZ Now operating hours (overrides operationalInfo.hours for web ordering)
operatingHours?: {
  [day in 'monday'...'sunday']?: { open: string; close: string; closed: boolean };
};

// Reward rules
rewardRules?: IStoreRewardRules;   // baseCashbackPercent, coinsPerRupee, firstVisitBonus, etc.

// Legal
fssaiNumber?: string;
gstNumber?: string;

// REZ Now payment settings
paymentSettings?: IStorePaymentSettings;  // acceptUPI, acceptCards, maxCoinRedemptionPercent, upiId
```

### 2.2 Menu (`Menu.ts`)

One document per store. Contains all categories and items.

```typescript
interface Menu extends Document {
  storeId: Types.ObjectId;          // FK → Store
  isActive: boolean;
  categories: Array<{
    name: string;
    description?: string;
    sortOrder?: number;
    items: Array<IMenuItem>;
  }>;
}
```

**`IMenuItem` (sub-document schema):**

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | required |
| `price` | number | in paise |
| `originalPrice` | number | strikethrough price |
| `image` | string | URL |
| `category` | string | category name (denormalized) |
| `isAvailable` | boolean | default `true` |
| `preparationTime` | string | e.g. `"15 mins"` |
| `nutritionalInfo` | object | `{calories?, protein?, carbs?, fat?}` |
| `dietaryInfo` | object | `{isVegetarian?, isVegan?, isGlutenFree?, isNutFree?}` |
| `spicyLevel` | number | 0–5 |
| `allergens` | string[] | e.g. `["dairy", "nuts"]` |
| `tags` | string[] | e.g. `["popular", "bestseller"]` |
| `variants` | `IMenuItemVariant[]` | mutually exclusive sizes (Half/Full, S/M/L) |
| `modifiers` | `IMenuItemModifier[]` | additive options (Extra Cheese +₹30) |
| `is86d` | boolean | temporarily unavailable |
| `cashbackPercentage` | number | item-level reward override |

### 2.3 WebOrder (`WebOrder.ts`)

Every order placed through REZ Now. This is the central record of a customer transaction.

```typescript
interface IWebOrder extends Document {
  // Identity
  orderNumber: string;             // unique, e.g. "WEB-STYL-M1A2B3C4-ABCD"
  storeId: Types.ObjectId;        // FK → Store
  storeSlug: string;
  storeName: string;
  customerPhone: string;           // E.164 phone, required
  customerName?: string;
  userId?: Types.ObjectId | null; // FK → User (set on login)

  // Order context
  tableNumber?: string;           // for dine-in
  orderType?: 'dine_in' | 'takeaway' | 'delivery';
  deliveryAddress?: IDeliveryAddress;
  deliveryFee?: number;
  channel: string;                // default 'web_qr'
  scheduledFor?: Date | null;      // pre-order scheduled time

  // Line items
  items: Array<{
    menuItemId: string;
    name: string;
    price: number;                 // in paise (unit price)
    quantity: number;
    category: string;
    image: string;
    customisation: string;         // JSON string of customizations
  }>;

  // Pricing
  subtotal: number;              // in paise
  taxes: number;                  // in paise (GST)
  total: number;                 // in paise (final charged)
  tipAmount?: number;
  tipPercentage?: number;
  totalWithTip?: number;
  billSplits?: Array<{
    name: string;
    amount: number;
    paid: boolean;
    paidAt?: Date;
  }>;

  // Status
  status: 'pending_payment' | 'paid' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';

  // Razorpay
  razorpayOrderId?: string;
  razorpayPaymentId?: string;

  // Post-order
  coinsCredited: boolean;         // prevents double-crediting
  specialInstructions?: string;
  rating?: number;                 // 1–5
  ratingComment?: string;
  ratedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  refundStatus?: 'none' | 'pending' | 'processed';

  // Survey / feedback
  surveyFeedback?: {
    foodQuality?: string;
    serviceSpeed?: string;
    recommend?: boolean;
    textFeedback?: string;
    submittedAt?: Date;
  };

  // Timestamps (managed by Mongoose timestamps: true)
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.4 TableReservation (`TableReservation.ts`)

Table booking at restaurants. One document per reservation.

```typescript
interface ITableReservation extends Document {
  storeSlug: string;
  storeId: Types.ObjectId;        // FK → Store
  customerName: string;
  customerPhone: string;
  partySize: number;               // 1–20 guests
  date: string;                   // "YYYY-MM-DD"
  timeSlot: string;               // "HH:MM" e.g. "19:00"
  notes?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  reservationCode: string;         // unique code, e.g. "RES-A3X"
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** `{ storeSlug, date, timeSlot }` (unique compound) + `{ customerPhone, status }`

### 2.5 Bill — Customer Bill Upload (`Bill.ts`)

Consumer submits a bill image, REZ verifies it via OCR, and credits cashback. **Not** the same as the Bill Builder feature (Phase R2) — this is the existing "REZ Rewards bill upload" feature.

```typescript
interface IBill extends Document {
  user: Types.ObjectId;           // FK → User (submitter)
  merchant: Types.ObjectId;        // FK → Merchant

  // Bill image
  billImage: {
    url: string;
    thumbnailUrl?: string;
    cloudinaryId: string;
    publicId?: string;
    imageHash?: string;            // SHA256 — for duplicate detection
  };

  // OCR-extracted data (optional)
  extractedData?: {
    merchantName?: string;
    amount?: number;
    date?: Date;
    billNumber?: string;
    items?: Array<{ name: string; quantity: number; price: number; }>;
    taxAmount?: number;
    discountAmount?: number;
    confidence?: number;           // 0–100 OCR confidence
  };

  // User-entered (authoritative)
  amount: number;                  // in rupees, ₹1–₹10,00,000
  billDate: Date;                 // max 30 days old
  billNumber?: string;
  notes?: string;

  // Verification
  verificationStatus: 'pending' | 'processing' | 'approved' | 'rejected';
  verificationMethod?: 'automatic' | 'manual';
  rejectionReason?: string;
  autoApproved?: boolean;         // true when OCR confidence > threshold

  // Cashback
  cashbackAmount?: number;
  cashbackPercentage?: number;
  cashbackStatus?: 'pending' | 'credited' | 'failed';
  cashbackCreditedAt?: Date;

  // Fraud detection metadata
  metadata: {
    ocrConfidence?: number;        // 0–100
    processingTime?: number;       // ms
    verifiedBy?: Types.ObjectId;
    verifiedAt?: Date;
    ipAddress?: string;
    deviceInfo?: string;
    fraudScore?: number;           // 0–100, higher = more suspicious
    fraudFlags?: string[];
  };

  resubmissionCount?: number;
  originalBillId?: Types.ObjectId; // reference if resubmitted
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** `{ user, createdAt }`, `{ merchant, createdAt }`, `{ verificationStatus, createdAt }`, `{ cashbackStatus }`, `{ user, merchant, amount, billDate }` (duplicate detection), `{ billImage.imageHash }` (sparse)

**Lifecycle:** On `save()` when `verificationStatus` becomes `'approved'`, a `post-save` hook triggers `walletService.credit()` for the cashback amount, then updates `cashbackStatus` to `'credited'`.

### 2.6 BroadcastLog (`BroadcastLog.ts`)

Stores a record of each push notification broadcast sent by a merchant.

```typescript
interface IBroadcastLog extends Document {
  storeSlug: string;
  title: string;
  body: string;
  url?: string;                    // optional deep link
  sentAt: Date;
  recipientCount: number;
}
```

**TTL Index:** `{ sentAt: 1 }` with `expireAfterSeconds: 7776000` (90 days) — documents auto-delete after 90 days.

### 2.7 Wallet (`Wallet.ts`)

One document per user. Stores coin balances and transaction metadata.

```typescript
interface IWallet extends Document {
  user: Types.ObjectId;           // unique, FK → User

  // Balances
  balance: {
    total: number;                 // sum of all coin types
    available: number;             // spendable ReZ coins
    pending: number;              // locked / pending
    cashback: number;              // cashback sub-balance
  };

  // ReZ Coins + Promo Coins
  coins: Array<{
    type: CoinType;               // 'rez' | 'cashback' | 'referral' | 'promo'
    amount: number;
    label?: string;
    isActive: boolean;
    color: string;                // '#00C06A' for ReZ, '#FFC857' for Promo
    earnedDate?: Date;
    lastUsed?: Date;
    lastEarned?: Date;
    expiryDate?: Date;
    expiresAt?: Date;              // alias
    promoDetails?: {
      campaignId?: string;
      campaignName?: string;
      maxRedemptionPercentage: number;
      expiryDate: Date;
    };
  }>;

  // Merchant-specific branded coins (separate array)
  brandedCoins: Array<{
    merchantId: Types.ObjectId;
    merchantName: string;
    merchantLogo?: string;
    merchantColor?: string;
    amount: number;
    earnedDate: Date;
    lastUsed?: Date;
    expiresAt?: Date;              // 6-month expiry
    isActive: boolean;
  }>;

  // Per-category coin tracking
  categoryBalances: Map<string, {
    available: number;
    earned: number;
    spent: number;
  }>;

  currency: string;               // 'REZ_COIN' or 'RC'

  statistics: {
    totalEarned: number;
    totalSpent: number;
    totalCashback: number;
    totalRefunds: number;
    totalTopups: number;
    totalWithdrawals: number;
  };

  savingsInsights: ISavingsInsights;

  limits: {
    maxBalance: number;
    minWithdrawal: number;
    dailySpendLimit: number;
    dailySpent: number;
    lastResetDate: Date;
  };

  settings: {
    autoTopup: boolean;
    autoTopupThreshold: number;
    autoTopupAmount: number;
    lowBalanceAlert: boolean;
    lowBalanceThreshold: number;
    smartAlertsEnabled: boolean;
    expiringCoinsAlertDays: number;
  };

  isActive: boolean;
  isFrozen: boolean;
  frozenReason?: string;
  frozenAt?: Date;
  lastTransactionAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**Index:** `{ user: 1 }` (unique)

---

## 3. API Response Shapes

All endpoints return `{ success: boolean, data?: T, message?: string, error?: string }`.

### 3.1 `GET /api/web-ordering/store/:storeSlug`

Returns the full store page payload — store info, menu, and table info in one response. Cached in Redis for 5 minutes (`web_menu:<slug>`).

```json
{
  "success": true,
  "data": {
    "store": {
      "id": "6819abcdef...",
      "name": "Style Studio",
      "slug": "style-studio",
      "logo": "https://cdn.rez.money/logos/...",
      "banner": "https://cdn.rez.money/banners/...",
      "address": "42 MG Road, Pune",
      "phone": "+919876543210",
      "operatingHours": {
        "monday":    { "open": "09:00", "close": "22:00", "closed": false },
        "tuesday":   { "open": "09:00", "close": "22:00", "closed": false },
        ...
      },
      "gstEnabled": true,
      "gstPercent": 5,
      "googlePlaceId": "ChIJ...",
      "isProgramMerchant": true,
      "estimatedPrepMinutes": 25,
      "hasMenu": true,
      "storeType": "restaurant",
      "isOpen": true,
      "nextChangeLabel": "Closes at 10 PM",
      "rewardRules": {
        "baseCashbackPercent": 10,
        "coinsEnabled": true
      },
      "deliveryEnabled": true,
      "deliveryRadiusKm": 5,
      "deliveryFee": 3000,
      "reservationsEnabled": true,
      "maxTableCapacity": 50
    },
    "promotions": [
      {
        "id": "promo-0",
        "title": "20% Off on First Order",
        "subtitle": "Use code WELCOME20",
        "image": null,
        "backgroundColor": "#1e3a5f",
        "actionText": "Claim Now",
        "actionUrl": ""
      }
    ],
    "menu": {
      "categories": [
        {
          "id": "6819abc...",
          "name": "Starters",
          "description": "",
          "items": [
            {
              "id": "6819xyz...",
              "name": "Paneer Tikka",
              "description": "Tandoor-grilled cottage cheese with bell peppers",
              "price": 18000,
              "originalPrice": 22000,
              "image": "https://cdn.rez.money/items/...",
              "category": "Starters",
              "isVeg": true,
              "isVegan": false,
              "spicyLevel": 2,
              "preparationTime": "15 mins",
              "tags": ["bestseller"],
              "is86d": false,
              "variants": [
                { "name": "Half", "price": 10000, "isDefault": false },
                { "name": "Full", "price": 18000, "isDefault": true }
              ],
              "modifiers": [
                { "name": "Extra Paneer", "price": 3000 },
                { "name": "Extra Cheese", "price": 2500 }
              ],
              "nutrition": { "calories": 320, "protein": 18, "carbs": 12, "fat": 22 }
            }
          ]
        }
      ]
    },
    "tableInfo": { "hasTable": false },
    "paymentMethods": {
      "upi": true,
      "card": true,
      "wallet": false
    }
  }
}
```

### 3.2 `POST /api/web-ordering/orders` (Create Order)

**Request body:**

```json
{
  "storeSlug": "style-studio",
  "items": [
    {
      "menuItemId": "6819xyz...",
      "name": "Paneer Tikka",
      "price": 18000,
      "quantity": 2,
      "category": "Starters",
      "image": "https://...",
      "customisation": "{\"size\":\"full\",\"extras\":[\"extra-cheese\"]}"
    }
  ],
  "subtotal": 36000,
  "gst": 1800,
  "total": 37800,
  "orderType": "dine_in",
  "tableNumber": "5",
  "customerPhone": "+919876543210",
  "tipAmount": 0,
  "razorpayOrderId": "order_XXXXX",
  "scheduledFor": null,
  "deliveryAddress": null,
  "specialInstructions": "No onions",
  "channel": "web_qr"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "orderNumber": "WEB-STYL-M1A2B3C4-XYZW",
    "razorpayOrderId": "order_XXXXX",
    "amount": 37800,
    "currency": "INR",
    "keyId": "rzp_test_XXXXX",
    "status": "pending_payment",
    "paymentStatus": "pending",
    "expiresAt": "2026-04-14T12:10:00.000Z"
  }
}
```

### 3.3 `GET /api/web-ordering/orders/:orderNumber`

Returns the full order document. Used for live tracking and receipt display.

```json
{
  "success": true,
  "data": {
    "orderNumber": "WEB-STYL-M1A2B3C4-XYZW",
    "status": "confirmed",
    "paymentStatus": "paid",
    "items": [
      {
        "menuItemId": "6819xyz...",
        "name": "Paneer Tikka",
        "price": 18000,
        "quantity": 2,
        "category": "Starters",
        "image": "https://...",
        "customisation": "{}"
      }
    ],
    "subtotal": 36000,
    "taxes": 1800,
    "total": 37800,
    "tipAmount": 0,
    "totalWithTip": 37800,
    "customerPhone": "+919876543210",
    "customerName": "Rahul K.",
    "tableNumber": "5",
    "orderType": "dine_in",
    "storeSlug": "style-studio",
    "storeName": "Style Studio",
    "razorpayOrderId": "order_XXXXX",
    "razorpayPaymentId": "pay_XXXXX",
    "coinsCredited": false,
    "createdAt": "2026-04-14T12:05:00.000Z",
    "updatedAt": "2026-04-14T12:05:30.000Z"
  }
}
```

### 3.4 `POST /api/web-ordering/scan-pay/orders` (Scan & Pay)

**Request:**

```json
{
  "storeSlug": "style-studio",
  "amount": 50000,
  "customerPhone": "+919876543210"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "razorpayOrderId": "order_YYYYY",
    "paymentId": "WEB-SCA-XXXX-ABCD",
    "amount": 50000,
    "currency": "INR",
    "keyId": "rzp_test_XXXXX"
  }
}
```

### 3.5 `GET /api/web-ordering/store/:slug/availability`

Returns available time slots for table reservation based on operating hours, existing bookings, and party size.

```json
{
  "success": true,
  "data": {
    "date": "2026-04-15",
    "slots": [
      { "time": "12:00", "available": true,  "capacity": 4 },
      { "time": "12:30", "available": false, "capacity": 4 },
      { "time": "13:00", "available": true,  "capacity": 4 },
      ...
    ],
    "maxCapacity": 8
  }
}
```

### 3.6 `POST /api/web-ordering/reservations`

**Request:**

```json
{
  "storeSlug": "style-studio",
  "customerName": "Priya S.",
  "customerPhone": "+919876543210",
  "partySize": 4,
  "date": "2026-04-15",
  "timeSlot": "19:00",
  "notes": "Window seat preferred"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "reservationCode": "RES-A3X",
    "storeName": "Style Studio",
    "date": "2026-04-15",
    "timeSlot": "19:00",
    "partySize": 4,
    "status": "confirmed"
  }
}
```

### 3.7 `GET /api/web-ordering/store/:slug/today-payments` (Payment Kiosk)

Returns all paid orders for today at a store. Powers the Payment Kiosk live feed at `now.rez.money/<slug>/merchant/pay-display`.

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderNumber": "WEB-SCA-XXXX-AB01",
        "total": 32000,
        "razorpayPaymentId": "pay_XXXXX",
        "customerPhone": "+91998XXXXX2",
        "createdAt": "2026-04-14T12:05:00.000Z"
      }
    ],
    "count": 12,
    "todayTotal": 284700,
    "storeName": "Style Studio"
  }
}
```

### 3.8 `GET /api/search?q=<query>`

Public store search with Redis caching (30s TTL).

```json
{
  "success": true,
  "data": [
    {
      "slug": "style-studio",
      "name": "Style Studio",
      "category": "Restaurants",
      "logo": "https://cdn.rez.money/logos/...",
      "description": "Authentic North Indian cuisine..."
    }
  ]
}
```

---

## 4. Data Relationships

```
User
 ├── wallet: IWallet (1:1)
 │    └── coins: ICoinBalance[] (ReZ + Promo + Branded)
 │    └── brandedCoins: IBrandedCoin[] (per-merchant)
 │    └── categoryBalances: Map<category, ICategoryBalance>
 │
 ├── orders: IWebOrder[] (1:many)
 │    └── storeId → Store
 │    └── items[] (line items, denormalized)
 │    └── razorpayOrderId → Razorpay payment
 │    └── coinsCredited → wallet credit trigger
 │
 ├── reservations: ITableReservation[] (1:many)
 │    └── storeId → Store
 │
 └── bills: IBill[] (1:many)
      └── merchant → Merchant
      └── cashbackAmount → wallet credit (via post-save hook)

Store
 ├── menu: Menu (1:1)
 │    └── categories[] (denormalized into Menu doc)
 │    └── items[] (IMenuItem sub-documents)
 │
 ├── webOrders: IWebOrder[] (1:many)
 │
 ├── reservations: ITableReservation[] (1:many)
 │
 ├── broadcastLogs: IBroadcastLog[] (1:many, TTL 90d)
 │
 └── rewardRules: IStoreRewardRules
      └── baseCashbackPercent → coin earn rate

WebOrder ──payment──→ Razorpay
 │    razorpayOrderId
 │    razorpayPaymentId
 │
 └───coins──→ Wallet (if coinsCredited === false)
       walletService.credit({ source: 'payment', ... })
```

**Write path — coins earned on payment:**

1. Customer pays via Razorpay widget
2. Frontend calls `POST /api/web-ordering/scan-pay/verify` with `razorpay_payment_id`
3. Backend verifies signature, updates `WebOrder.paymentStatus = 'paid'`
4. Backend calls `POST /api/web-ordering/scan-pay/:orderId/credit`
5. `coinsCredited` flag checked (idempotent)
6. `walletService.credit()` called with `{ source: 'payment', ... }`
7. `WebOrder.coinsCredited = true` saved
8. `CoinTransaction` entry created for audit trail
9. Socket.IO event `payment:received` emitted to `staff:<slug>` room (Payment Kiosk feed)

---

## 5. Index Strategy

### WebOrder — 11 indexes

| Name | Fields | Purpose |
|------|--------|---------|
| `store_order_history_idx` | `{ storeId, createdAt: -1 }` | Per-store order history, recency-sorted |
| `customer_order_history_idx` | `{ customerPhone, createdAt: -1 }` | Customer's order history |
| `store_status_timeline_idx` | `{ storeId, status, createdAt: -1 }` | Store dashboard: pending/paid breakdown |
| `global_status_timeline_idx` | `{ status, createdAt: -1 }` | Admin global order list |
| `payment_status_idx` | `{ paymentStatus, createdAt: -1 }` | Payment reconciliation queries |
| `razorpay_order_idx` | `{ razorpayOrderId }` (sparse) | Payment verification lookup |
| `slug_order_history_idx` | `{ storeSlug, createdAt: -1 }` | KDS polling, admin list, analytics |
| `slug_status_timeline_idx` | `{ storeSlug, status, createdAt: -1 }` | Admin filtered by store+status |
| `global_recency_idx` | `{ createdAt: -1 }` | Global admin order list |
| `user_order_history_idx` | `{ userId, createdAt: -1 }` (sparse) | Authenticated user order history |
| `loyalty_stamp_idx` | `{ customerPhone, storeSlug, paymentStatus }` | Stamp count: `countDocuments({ customerPhone, storeSlug, paymentStatus: 'paid' })` |
| `slug_payment_status_idx` | `{ storeSlug, paymentStatus, status }` | Analytics: paid + non-cancelled orders |

### Store — 20+ indexes

| Name | Fields | Purpose |
|------|--------|---------|
| `location.coordinates` (2dsphere) | `location.coordinates` | Geo queries (nearby stores) |
| primary | `slug` (unique) | Primary URL-based lookup |
| `category_active_idx` | `{ category, isActive }` | Category listing pages |
| `city_active_idx` | `{ location.city, isActive }` | City-based discovery |
| `menu_active_idx` | `{ hasMenu, isActive }` | Menu store filter |
| `booking_active_idx` | `{ bookingType, isActive }` | Booking-type filter |
| `merchant_idx` | `merchantId` | Merchant ownership |
| `upi_id_idx` | `paymentSettings.upiId` | UPI payment routing |
| `trending_idx` | `{ isActive, analytics.totalOrders: -1, ratings.average: -1 }` | Trending stores |
| `featured_idx` | `{ isActive, isFeatured, ratings.average: -1 }` | Featured stores |

### TableReservation — 2 indexes

| Name | Fields | Purpose |
|------|--------|---------|
| compound | `{ storeSlug, date, timeSlot }` (unique) | Slot availability + duplicate prevention |
| compound | `{ customerPhone, status }` | Customer reservation lookup |

### Bill (customer upload) — 8 indexes

| Name | Fields | Purpose |
|------|--------|---------|
| compound | `{ user, createdAt: -1 }` | User bill history |
| compound | `{ merchant, createdAt: -1 }` | Merchant bill list |
| compound | `{ user, merchant, amount, billDate }` | Duplicate bill detection |
| sparse | `{ user, billNumber }` | Bill number lookup |
| sparse | `{ billImage.imageHash }` | Image hash dedup |
| single | `{ verificationStatus, createdAt: -1 }` | Admin review queue |
| single | `{ cashbackStatus }` | Cashback processing job |
| single | `{ metadata.fraudScore }` | Fraud investigation |

---

## 6. Planned Models

These schemas are **proposed** based on `REZ_NOW_UNIVERSAL_PLATFORM.md` section 10 and the Phase R2/R3 roadmap in `REZ_NOW_FEATURE_REFERENCE.md`. They do not yet exist in the codebase.

### 6.1 AIMessage (Phase R3 — AI Chatbot)

Stores conversation history between a customer and the AI assistant. TTL: 30 days.

```typescript
// Proposed schema — NOT yet implemented
interface IAIMessage extends Document {
  conversationId: string;           // groups messages into a session
  storeSlug: string;               // context: which store's catalog the AI has access to
  customerId?: Types.ObjectId;     // null if anonymous
  customerPhone?: string;           // for anonymous sessions

  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;                // raw text
    type?: 'text' | 'cart_add' | 'order_placed' | 'recommendation'; // structured action hints
    metadata?: {
      intent?: string;              // classified intent: 'order', 'query', 'complaint'
      confidence?: number;           // 0–1
      citedItemIds?: string[];       // menu item IDs referenced in response
      cartTotal?: number;            // paise, if cart action was taken
    };
    createdAt: Date;
  }>;

  context: {
    displayMode?: 'menu' | 'catalog' | 'services' | 'appointments';
    activeOrderNumber?: string;
    cartSummary?: { itemCount: number; total: number; };
  };

  createdAt: Date;
  updatedAt: Date;                  // TTL index on updatedAt: 30 days
}

// Index strategy
AIMessageSchema.index({ conversationId: 1 });
AIMessageSchema.index({ customerId: 1, updatedAt: -1 });    // customer history
AIMessageSchema.index({ storeSlug: 1, updatedAt: -1 });     // store analytics
AIMessageSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // TTL 30d
```

**API routes (proposed):**
- `POST /api/ai/chat` — send message, return AI response
- `GET /api/ai/history/:conversationId` — retrieve conversation
- `DELETE /api/ai/history/:conversationId` — clear conversation

### 6.2 Appointment (Phase R1/Service Mode)

For appointment-based businesses: salon, clinic, tutoring. Tracks a booked service slot.

```typescript
// Proposed schema — NOT yet implemented
interface IAppointment extends Document {
  storeId: Types.ObjectId;         // FK → Store
  storeSlug: string;
  customerId?: Types.ObjectId;      // FK → User (if logged in)
  customerPhone: string;
  customerName?: string;

  // What is being booked
  serviceId: string;               // CatalogItem or Service model id
  serviceName: string;            // denormalized: "Haircut + Blow Dry"
  staffId?: string;                // assigned staff member
  staffName?: string;

  // When
  date: string;                    // "YYYY-MM-DD"
  startTime: string;               // "HH:MM"
  endTime: string;                  // "HH:MM" (computed: startTime + durationMinutes)
  durationMinutes: number;

  // Payment
  depositRequired: boolean;
  depositAmount?: number;           // in paise
  depositPaid: boolean;
  paymentId?: string;               // Razorpay payment for deposit
  totalAmount: number;             // full service price in paise

  status: 'booked' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  cancellationReason?: string;
  cancelledAt?: Date;

  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Index strategy
AppointmentSchema.index({ storeSlug: 1, date: 1, startTime: 1 });  // availability check
AppointmentSchema.index({ customerPhone: 1, status: 1 });            // customer history
AppointmentSchema.index({ storeSlug: 1, status: 1, date: 1 });      // staff dashboard
AppointmentSchema.index({ staffId: 1, date: 1, startTime: 1 });     // staff schedule
```

### 6.3 Bill — Merchant Bill Builder (Phase R2)

The Bill Builder lets a merchant assemble a multi-item bill (for kirana, retail, or any merchant without a POS). Customer scans a QR and pays.

```typescript
// Proposed schema — NOT yet implemented
// Differs from the existing Bill (customer upload) model
interface IBillBuilder extends Document {
  storeId: Types.ObjectId;         // FK → Store
  storeSlug: string;
  billNumber: string;              // merchant-facing, e.g. "BILL-00142"

  // Line items (merchant-entered or catalog items)
  items: Array<{
    itemId?: string;               // if from catalog
    name: string;                  // free-text or catalog item name
    quantity: number;
    unitPrice: number;             // in paise
    total: number;                 // quantity * unitPrice
    sku?: string;                  // for retail
  }>;

  subtotal: number;
  discount?: number;              // in paise, merchant-applied
  gst?: number;                   // in paise
  total: number;                  // final amount in paise

  // Status
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  expiresAt: Date;                 // default: createdAt + 24 hours
  createdBy: Types.ObjectId;       // staff/merchant who created
  paidAt?: Date;
  razorpayPaymentId?: string;

  // Split
  splits?: Array<{
    name: string;
    amount: number;
    paid: boolean;
    paidAt?: Date;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

// Index strategy
BillBuilderSchema.index({ storeSlug: 1, status: 1, createdAt: -1 });  // merchant dashboard
BillBuilderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // cleanup paid/expired after 7d
BillBuilderSchema.index({ razorpayPaymentId: 1 }, { sparse: true });    // payment verification
```

---

## Appendix A — Coin Type Enum

From `rezbackend/src/constants/coinTypes.ts` (canonical source):

```typescript
export const COIN_TYPE_VALUES = [
  'rez',       // Universal ReZ coins — earned at any store, redeemable anywhere
  'cashback',  // Cashback coins — from bill uploads, promotional campaigns
  'referral',  // Referral bonus coins
  'promo',     // Campaign-specific promo coins — limited time, limited redemption %
  'branded',   // Merchant-specific branded coins (stored in brandedCoins array, not coins[])
] as const;

export type CoinType = typeof COIN_TYPE_VALUES[number];
```

**Coin earn rate:** `(amount / 10) * (baseCashbackPercent / 100)` — e.g. ₹100 spent at a 10% store earns 10 coins.

**Coin redeem rate:** `100 coins = ₹1` (universal across all stores).

**Coin expiry:** ReZ coins expire 30 days after earning. Promo coins expire per campaign config. Branded coins expire 6 months after earning.

---

## Appendix B — Order Number Format

Generated by `generateOrderNumber(storeSlug)`:

```
WEB-<4-char-slug-uppercase>-<timestamp-base36>-<random-4-char-base36-uppercase>

Example: WEB-STYL-M1A2B3C4-XYZW
         WEB-salon-ld8f2g-AB12
```

The base-36 timestamp encodes the creation time compactly. The random suffix prevents enumeration of order numbers.

---

## Appendix C — Schema Version History

| Date | Change |
|------|--------|
| 2026-04-14 | Initial doc: WebOrder (12 statuses), Store (30+ fields), Menu, Wallet, TableReservation, Bill, BroadcastLog, all TypeScript interfaces |
| 2026-04-14 | Added planned models: AIMessage (Phase R3), Appointment (Phase R1), BillBuilder (Phase R2) |
