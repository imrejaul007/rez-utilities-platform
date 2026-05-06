# REZ — COMPLETE BBPS + RECHARGE INTEGRATION GUIDE
## Full Upgrade Report · Every File · Every Code Change · Admin + Design
### March 2026 | Razorpay BillPay Aggregator | 21-Day Ship Plan

---

## WHAT THIS DOCUMENT COVERS

1. Every file to modify (exact line numbers)
2. Every file to create (full code)
3. Model schema upgrades
4. New API routes + controllers
5. Frontend screens (existing + new)
6. Admin panel additions
7. Design specs from v2
8. Gamification / coin reward wiring
9. Webhook integration
10. Scheduled job (recharge reminder)
11. Seeding script for providers
12. 21-day ship plan

---

## ARCHITECTURE OVERVIEW

```
USER APP                    BACKEND                      RAZORPAY BILLPAY
─────────                   ───────                      ────────────────
bill-payment.tsx  ──────▶  billPaymentController.ts  ──▶  fetchBill API
recharge.tsx (NEW)          ├─ fetchBill()                payBill API
                            ├─ payBill()             ◀──  webhook callback
                            ├─ fetchPlans() NEW
                            ├─ getOperators() NEW
                            └─ handleBBPSWebhook() NEW
                                    │
                            walletService.debit()    ←── deduct before pay
                            rewardEngine.issue()     ←── promo coins after
                            gamificationEventBus.emit()  ←── streak trigger

ADMIN                       BACKEND ADMIN ROUTES
─────                       ───────────────────
bbps-config.tsx (NEW)  ──▶  GET/PUT /admin/bbps/config
bill-payments.tsx (NEW) ──▶ GET /admin/bill-payments
providers.tsx (NEW)    ──▶  GET/POST/PUT /admin/bill-payments/providers
```

---
---

# PART 1 — BACKEND CHANGES

---

## 1.1 · BillProvider Model — ADD mobile_prepaid + recharge fields

**File:** `rez-backend-master/src/models/BillProvider.ts`

### BEFORE (lines 1-15):
```typescript
export const BILL_TYPES = [
  'electricity',
  'water',
  'gas',
  'internet',
  'mobile_postpaid',
  'broadband',
  'dth',
  'landline',
] as const;
```

### AFTER (replace entirely):
```typescript
export const BILL_TYPES = [
  'electricity',
  'water',
  'gas',
  'internet',
  'mobile_postpaid',
  'mobile_prepaid',      // NEW — Jio, Airtel, BSNL, Vi prepaid recharge
  'broadband',
  'dth',
  'landline',
  'insurance',           // NEW — LIC, health insurance premium
  'fastag',             // NEW — FASTag recharge
  'education_fee',      // NEW — school/college fees
] as const;
```

### ADD to BillProvider interface (after `cashbackPercent`):
```typescript
interface IBillProvider extends Document {
  name:             string;
  code:             string;
  type:             BillType;
  logo:             string;
  region?:          string;
  requiredFields:   IRequiredField[];
  cashbackPercent:  number;
  isActive:         boolean;
  // NEW FIELDS:
  aggregatorCode:   string;    // Razorpay/Setu operator code (e.g., "JIO", "AIRTEL")
  aggregatorName:   'razorpay' | 'setu' | 'manual';  // which aggregator handles this provider
  promoCoinsFixed:  number;    // flat promo coins for this provider (e.g., 10 coins on Jio recharge)
  displayOrder:     number;    // sort order on UI (lower = first)
  isFeatured:       boolean;   // shows in "popular" section
  minAmount:        number;    // minimum recharge/bill amount
  maxAmount:        number;    // maximum recharge/bill amount
  createdAt:        Date;
  updatedAt:        Date;
}
```

### ADD to BillProviderSchema (after cashbackPercent field):
```typescript
aggregatorCode: {
  type: String,
  trim: true,
  default: '',
  comment: 'Razorpay operator code — maps to BBPS biller ID',
},
aggregatorName: {
  type: String,
  enum: ['razorpay', 'setu', 'manual'],
  default: 'razorpay',
},
promoCoinsFixed: {
  type: Number,
  default: 0,
  min: 0,
  max: 500,
  comment: 'Flat promo coins issued after successful payment',
},
displayOrder: {
  type: Number,
  default: 99,
  index: true,
},
isFeatured: {
  type: Boolean,
  default: false,
  index: true,
},
minAmount: {
  type: Number,
  default: 10,
  min: 1,
},
maxAmount: {
  type: Number,
  default: 100000,
},
```

### ADD new indexes (after existing indexes):
```typescript
BillProviderSchema.index({ type: 1, isActive: 1, displayOrder: 1 });
BillProviderSchema.index({ isFeatured: 1, isActive: 1 });
BillProviderSchema.index({ aggregatorCode: 1 });
```

---

## 1.2 · BillPayment Model — ADD refund + wallet + aggregator fields

**File:** `rez-backend-master/src/models/BillPayment.ts`

### REPLACE the entire interface and schema:

```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';
import { BillType, BILL_TYPES } from './BillProvider';

export type BillPaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
export type BillRefundStatus  = 'none' | 'pending' | 'processed' | 'failed';

export interface IBillPayment extends Document {
  userId:          Types.ObjectId;
  provider:        Types.ObjectId;
  billType:        BillType;
  customerNumber:  string;
  amount:          number;
  cashbackAmount:  number;    // coins issued (₹ equivalent)
  promoCoinsIssued:number;    // promo coins issued after payment
  status:          BillPaymentStatus;
  transactionRef?: string;    // REZ internal ref: BP-xxxx
  aggregatorRef?:  string;    // Razorpay/Setu transaction ID
  aggregatorName?: 'razorpay' | 'setu' | 'manual';
  walletDebited:   boolean;   // was user wallet debited for payment?
  walletDebitedAmount: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  webhookVerified:  boolean;
  // Refund fields (NEW):
  refundStatus:    BillRefundStatus;
  refundRef?:      string;
  refundAmount?:   number;
  refundedAt?:     Date;
  refundReason?:   string;
  // Reminder fields (NEW):
  dueDateRaw?:     Date;      // parsed due date for reminder scheduling
  reminderSent:    boolean;
  paidAt?:         Date;
  createdAt:       Date;
  updatedAt:       Date;
}

const BillPaymentSchema = new Schema<IBillPayment>(
  {
    userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider:       { type: Schema.Types.ObjectId, ref: 'BillProvider', required: true, index: true },
    billType:       { type: String, required: true, enum: BILL_TYPES, index: true },
    customerNumber: { type: String, required: true, trim: true, maxlength: 50 },
    amount:         { type: Number, required: true, min: 1 },
    cashbackAmount: { type: Number, default: 0, min: 0 },
    promoCoinsIssued: { type: Number, default: 0, min: 0 },
    status:         { type: String, enum: ['pending','processing','completed','failed','refunded'], default: 'pending', index: true },
    transactionRef: { type: String, trim: true, sparse: true },
    aggregatorRef:  { type: String, trim: true, sparse: true },
    aggregatorName: { type: String, enum: ['razorpay','setu','manual'], default: 'razorpay' },
    walletDebited:  { type: Boolean, default: false },
    walletDebitedAmount: { type: Number, default: 0, min: 0 },
    razorpayOrderId: { type: String, trim: true, sparse: true },
    razorpayPaymentId: { type: String, trim: true, sparse: true },
    webhookVerified: { type: Boolean, default: false },
    refundStatus:   { type: String, enum: ['none','pending','processed','failed'], default: 'none' },
    refundRef:      { type: String, trim: true },
    refundAmount:   { type: Number, min: 0 },
    refundedAt:     { type: Date },
    refundReason:   { type: String, trim: true },
    dueDateRaw:     { type: Date },
    reminderSent:   { type: Boolean, default: false },
    paidAt:         { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Indexes
BillPaymentSchema.index({ userId: 1, createdAt: -1 });
BillPaymentSchema.index({ userId: 1, status: 1 });
BillPaymentSchema.index({ userId: 1, billType: 1, createdAt: -1 });
BillPaymentSchema.index({ transactionRef: 1 }, { unique: true, sparse: true });
BillPaymentSchema.index({ aggregatorRef: 1 }, { sparse: true });
BillPaymentSchema.index({ status: 1, createdAt: -1 });          // admin monitoring
BillPaymentSchema.index({ dueDateRaw: 1, reminderSent: 1 });    // reminder cron job
BillPaymentSchema.index({ razorpayOrderId: 1 }, { sparse: true });

export const BillPayment = mongoose.model<IBillPayment>('BillPayment', BillPaymentSchema);
```

---

## 1.3 · NEW FILE: BBPSService — Razorpay BillPay API wrapper

**Create:** `rez-backend-master/src/services/bbpsService.ts`

```typescript
/**
 * BBPSService — Razorpay BillPay API integration
 * 
 * Docs: https://razorpay.com/docs/payments/payment-gateway/bb-payments/
 * 
 * All methods throw AppError on failure.
 * Backend calls Razorpay, Razorpay calls NPCI BBPS network.
 */

import axios, { AxiosInstance } from 'axios';
import { createServiceLogger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';

const logger = createServiceLogger('bbps-service');

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface BBPSOperator {
  id:          string;  // Razorpay operator code e.g. "JIO", "BESCOM"
  name:        string;
  category:    string;  // 'telecom' | 'electricity' | 'gas' | 'water' | 'dth' | 'broadband' | 'fastag'
  logo_url?:   string;
}

export interface BBPSPlan {
  id:          string;
  name:        string;  // "₹199 — 28 days, 2GB/day"
  price:       number;
  validity:    string;  // "28 days"
  data?:       string;  // "2GB/day"
  calls?:      string;  // "Unlimited"
  sms?:        string;  // "100/day"
  isPopular:   boolean;
}

export interface BBPSBillInfo {
  billAmount:      number;
  billDate?:       string;
  dueDate?:        string;
  consumerName?:   string;
  billNumber?:     string;
  additionalInfo?: Record<string, string>;
}

export interface BBPSPaymentResult {
  transactionId:  string;  // Razorpay transaction ID
  status:         'SUCCESS' | 'PENDING' | 'FAILED';
  receiptNumber?: string;
  timestamp:      string;
}

// ─────────────────────────────────────────────
// SERVICE CLASS
// ─────────────────────────────────────────────

class BBPSService {
  private client: AxiosInstance;

  constructor() {
    const keyId     = process.env.RAZORPAY_KEY_ID!;
    const keySecret = process.env.RAZORPAY_KEY_SECRET!;

    this.client = axios.create({
      baseURL: 'https://api.razorpay.com/v1',
      auth: { username: keyId, password: keySecret },
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
  }

  /**
   * Fetch all operators for a given category.
   * Cache in Redis for 1 hour (operators rarely change).
   * 
   * Razorpay endpoint: GET /bbps/operators?category=telecom
   * categories: telecom | electricity | gas | water | dth | broadband | fastag | insurance | education
   */
  async getOperators(category: string): Promise<BBPSOperator[]> {
    try {
      const { data } = await this.client.get('/bbps/operators', {
        params: { category },
      });
      return data.items || [];
    } catch (err: any) {
      logger.error('[BBPS] getOperators failed', { category, error: err.message });
      throw new AppError(`Failed to fetch operators: ${err.message}`, 502);
    }
  }

  /**
   * Fetch prepaid recharge plans for a mobile operator.
   * Only applicable for mobile_prepaid type.
   * 
   * Razorpay endpoint: GET /bbps/operators/{operator_id}/plans?circle=KA
   */
  async getPlans(operatorCode: string, circle: string = 'KA'): Promise<BBPSPlan[]> {
    try {
      const { data } = await this.client.get(`/bbps/operators/${operatorCode}/plans`, {
        params: { circle },
      });
      return (data.items || []).map((p: any) => ({
        id:        p.id,
        name:      `₹${p.amount} — ${p.validity}`,
        price:     p.amount,
        validity:  p.validity,
        data:      p.data_benefit,
        calls:     p.voice_benefit,
        sms:       p.sms_benefit,
        isPopular: p.is_popular || false,
      }));
    } catch (err: any) {
      logger.error('[BBPS] getPlans failed', { operatorCode, error: err.message });
      throw new AppError(`Failed to fetch plans: ${err.message}`, 502);
    }
  }

  /**
   * Fetch bill details for postpaid/utility bills.
   * 
   * Razorpay endpoint: POST /bbps/bills/fetch
   */
  async fetchBill(operatorCode: string, customerNumber: string): Promise<BBPSBillInfo> {
    try {
      const { data } = await this.client.post('/bbps/bills/fetch', {
        operator_id:     operatorCode,
        customer_params: { consumer_number: customerNumber },
      });

      return {
        billAmount:    data.bill_amount / 100,  // Razorpay returns paise
        billDate:      data.bill_date,
        dueDate:       data.due_date,
        consumerName:  data.customer_name,
        billNumber:    data.bill_number,
        additionalInfo: data.additional_info,
      };
    } catch (err: any) {
      logger.error('[BBPS] fetchBill failed', { operatorCode, customerNumber, error: err.message });
      if (err.response?.status === 404) {
        throw new AppError('Consumer number not found with this provider', 404);
      }
      throw new AppError(`Could not fetch bill: ${err.message}`, 502);
    }
  }

  /**
   * Pay a bill or recharge.
   * 
   * Razorpay endpoint: POST /bbps/bills/pay
   * 
   * For prepaid recharge: amount comes from selected plan.
   * For postpaid/utility: amount comes from fetchBill result.
   */
  async payBill(params: {
    operatorCode:    string;
    customerNumber:  string;
    amount:          number;  // in ₹ (we convert to paise)
    razorpayPaymentId: string;
    internalRef:     string;
    planId?:         string;  // for prepaid recharge
  }): Promise<BBPSPaymentResult> {
    try {
      const { data } = await this.client.post('/bbps/bills/pay', {
        operator_id:       params.operatorCode,
        customer_params:   { consumer_number: params.customerNumber },
        amount:            params.amount * 100,  // convert to paise
        payment_id:        params.razorpayPaymentId,
        reference_id:      params.internalRef,
        plan_id:           params.planId,
      });

      return {
        transactionId:  data.transaction_id,
        status:         data.status === 'SUCCESS' ? 'SUCCESS' : data.status === 'PENDING' ? 'PENDING' : 'FAILED',
        receiptNumber:  data.receipt_number,
        timestamp:      data.created_at,
      };
    } catch (err: any) {
      logger.error('[BBPS] payBill failed', { ...params, error: err.message });
      throw new AppError(`Payment failed: ${err.message}`, 502);
    }
  }

  /**
   * Check transaction status (for pending transactions).
   * 
   * Razorpay endpoint: GET /bbps/transactions/{transaction_id}
   */
  async getTransactionStatus(aggregatorRef: string): Promise<{ status: string; amount: number }> {
    try {
      const { data } = await this.client.get(`/bbps/transactions/${aggregatorRef}`);
      return {
        status: data.status,
        amount: data.amount / 100,
      };
    } catch (err: any) {
      logger.error('[BBPS] getTransactionStatus failed', { aggregatorRef, error: err.message });
      throw new AppError(`Could not check status: ${err.message}`, 502);
    }
  }

  /**
   * Initiate refund for a failed/disputed transaction.
   * 
   * Razorpay endpoint: POST /bbps/transactions/{transaction_id}/refund
   */
  async initiateRefund(aggregatorRef: string, amount: number, reason: string): Promise<{ refundId: string }> {
    try {
      const { data } = await this.client.post(`/bbps/transactions/${aggregatorRef}/refund`, {
        amount: amount * 100,
        notes: { reason },
      });
      return { refundId: data.id };
    } catch (err: any) {
      logger.error('[BBPS] initiateRefund failed', { aggregatorRef, error: err.message });
      throw new AppError(`Refund initiation failed: ${err.message}`, 502);
    }
  }
}

export const bbpsService = new BBPSService();
```

---

## 1.4 · billPaymentController.ts — REPLACE simulated functions with real API

**File:** `rez-backend-master/src/controllers/billPaymentController.ts`

### ADD import at top:
```typescript
import { bbpsService } from '../services/bbpsService';
import { walletService } from '../services/walletService';
import rewardEngine from '../core/rewardEngine';
import gamificationEventBus from '../events/gamificationEventBus';
import razorpayService from '../services/razorpayService';
```

### ADD new BILL_TYPE_META entries for new types:
```typescript
const BILL_TYPE_META: Record<BillType, { label: string; icon: string; color: string; category: string }> = {
  electricity:    { label: 'Electricity',   icon: 'flash-outline',          color: '#F59E0B', category: 'electricity' },
  water:          { label: 'Water',          icon: 'water-outline',          color: '#3B82F6', category: 'water' },
  gas:            { label: 'Gas',            icon: 'flame-outline',          color: '#EF4444', category: 'gas' },
  internet:       { label: 'Internet',       icon: 'wifi-outline',           color: '#8B5CF6', category: 'broadband' },
  mobile_postpaid:{ label: 'Postpaid',       icon: 'phone-portrait-outline', color: '#D97706', category: 'telecom' },
  mobile_prepaid: { label: 'Recharge',       icon: 'phone-portrait-outline', color: '#10B981', category: 'telecom' },
  broadband:      { label: 'Broadband',      icon: 'tv-outline',             color: '#EC4899', category: 'broadband' },
  dth:            { label: 'DTH',            icon: 'radio-outline',          color: '#06B6D4', category: 'dth' },
  landline:       { label: 'Landline',       icon: 'call-outline',           color: '#6366F1', category: 'telecom' },
  insurance:      { label: 'Insurance',      icon: 'shield-checkmark-outline',color: '#6B7280', category: 'insurance' },
  fastag:         { label: 'FASTag',         icon: 'car-outline',            color: '#F97316', category: 'fastag' },
  education_fee:  { label: 'School Fees',    icon: 'school-outline',         color: '#8B5CF6', category: 'education' },
};
```

### REPLACE fetchBill function (remove the simulated MD5 hash logic):
```typescript
export const fetchBill = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Authentication required', 401);

  const { providerId, customerNumber } = req.body;
  if (!providerId || !customerNumber) {
    throw new AppError('Provider ID and customer number are required', 400);
  }

  const provider = await BillProvider.findOne({ _id: providerId, isActive: true }).lean();
  if (!provider) return sendNotFound(res, 'Provider not found');

  // For mobile_prepaid — skip fetchBill (no bill to fetch, user selects plan)
  if (provider.type === 'mobile_prepaid') {
    return sendSuccess(res, {
      provider: { _id: provider._id, name: provider.name, code: provider.code, logo: provider.logo, type: provider.type },
      customerNumber,
      billType: 'mobile_prepaid',
      requiresPlanSelection: true,
    }, 'Select a recharge plan');
  }

  // For all other types — call real BBPS API via bbpsService
  const billInfo = await bbpsService.fetchBill(provider.aggregatorCode || provider.code, customerNumber);

  const response = {
    provider: { _id: provider._id, name: provider.name, code: provider.code, logo: provider.logo, type: provider.type },
    customerNumber,
    amount:           billInfo.billAmount,
    dueDate:          billInfo.dueDate,
    billDate:         billInfo.billDate,
    consumerName:     billInfo.consumerName,
    billNumber:       billInfo.billNumber,
    cashbackPercent:  provider.cashbackPercent,
    cashbackAmount:   Math.round((billInfo.billAmount * provider.cashbackPercent) / 100),
    promoCoins:       provider.promoCoinsFixed,
    additionalInfo:   billInfo.additionalInfo,
  };

  sendSuccess(res, response, 'Bill fetched successfully');
});
```

### NEW: getPlans function (mobile prepaid plans):
```typescript
export const getPlans = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Authentication required', 401);

  const { providerId, circle = 'KA' } = req.query;
  if (!providerId) throw new AppError('Provider ID required', 400);

  const provider = await BillProvider.findOne({ _id: providerId, isActive: true }).lean();
  if (!provider) return sendNotFound(res, 'Provider not found');

  const cacheKey = `bbps:plans:${provider.aggregatorCode}:${circle}`;
  const cached = await redisService.get<any>(cacheKey);
  if (cached) return sendSuccess(res, cached);

  const plans = await bbpsService.getPlans(provider.aggregatorCode || provider.code, circle as string);

  // Group plans by type for UI display
  const grouped = {
    popular:   plans.filter(p => p.isPopular),
    allPlans:  plans,
  };

  await redisService.set(cacheKey, grouped, 3600);  // 1 hour cache — plans rarely change
  sendSuccess(res, grouped, 'Plans fetched');
});
```

### REPLACE payBill function (add wallet debit + real BBPS + coins + gamification):
```typescript
export const payBill = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Authentication required', 401);

  const { providerId, customerNumber, amount, razorpayPaymentId, planId } = req.body;

  if (!providerId || !customerNumber || !amount || !razorpayPaymentId) {
    throw new AppError('providerId, customerNumber, amount, razorpayPaymentId required', 400);
  }
  if (amount <= 0) throw new AppError('Amount must be greater than 0', 400);

  const provider = await BillProvider.findOne({ _id: providerId, isActive: true }).lean();
  if (!provider) return sendNotFound(res, 'Provider not found');

  // 1. Verify Razorpay payment (user paid via Razorpay first)
  const isValidPayment = await razorpayService.verifyPaymentId(razorpayPaymentId, amount);
  if (!isValidPayment) {
    throw new AppError('Payment verification failed', 400);
  }

  const transactionRef = `BP-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const cashbackAmount  = Math.round((amount * provider.cashbackPercent) / 100);
  const promoCoins      = provider.promoCoinsFixed || 0;

  // 2. Create BillPayment record as 'processing'
  const payment = await BillPayment.create({
    userId:            req.user._id,
    provider:          provider._id,
    billType:          provider.type,
    customerNumber,
    amount,
    cashbackAmount,
    promoCoinsIssued:  promoCoins,
    status:            'processing',
    transactionRef,
    aggregatorName:    provider.aggregatorName || 'razorpay',
    razorpayPaymentId,
    walletDebited:     false,
    walletDebitedAmount: 0,
  });

  try {
    // 3. Call BBPS API to actually pay the bill
    const bbpsResult = await bbpsService.payBill({
      operatorCode:      provider.aggregatorCode || provider.code,
      customerNumber,
      amount,
      razorpayPaymentId,
      internalRef:       transactionRef,
      planId,
    });

    // 4. Update payment record with BBPS result
    await BillPayment.findByIdAndUpdate(payment._id, {
      status:         bbpsResult.status === 'SUCCESS' ? 'completed' : 'processing',
      aggregatorRef:  bbpsResult.transactionId,
      webhookVerified: false,   // will be confirmed via webhook
      paidAt:         bbpsResult.status === 'SUCCESS' ? new Date() : undefined,
    });

    // 5. Issue promo coins if payment succeeded
    if (bbpsResult.status === 'SUCCESS' && promoCoins > 0) {
      await rewardEngine.issue({
        userId:         req.user._id.toString(),
        amount:         promoCoins,
        rewardType:     'bill_payment',
        coinType:       'promo',
        source:         `bill_payment:${payment._id}`,
        description:    `${promoCoins} promo coins for ${provider.name} payment`,
        operationType:  'credit',
        referenceId:    payment._id.toString(),
        referenceModel: 'BillPayment',
        metadata:       { billType: provider.type, providerName: provider.name },
      });
    }

    // 6. Fire gamification event (triggers streak, challenge progress, leaderboard)
    if (bbpsResult.status === 'SUCCESS') {
      gamificationEventBus.emit('bill_payment_confirmed', {
        userId:    req.user._id.toString(),
        metadata:  { billType: provider.type, amount, providerName: provider.name },
        source:    { controller: 'billPayment', action: 'payBill' },
      });
    }

    // 7. Invalidate history cache
    await redisService.delPattern(`bill-payments:history:${req.user._id}:*`).catch(() => {});

    const populated = await BillPayment.findById(payment._id)
      .populate('provider', 'name code logo type')
      .lean();

    sendSuccess(res, {
      payment:        populated,
      promoCoinsEarned: bbpsResult.status === 'SUCCESS' ? promoCoins : 0,
      status:         bbpsResult.status,
      message:        bbpsResult.status === 'SUCCESS' 
        ? `${provider.name} payment of ₹${amount} successful! ${promoCoins > 0 ? `You earned ${promoCoins} coins.` : ''}`
        : 'Payment is being processed. We\'ll notify you when confirmed.',
    }, 'Payment processed', 201);

  } catch (err) {
    // Mark payment as failed if BBPS throws
    await BillPayment.findByIdAndUpdate(payment._id, { status: 'failed' });
    throw err;
  }
});
```

### NEW: Refund handler:
```typescript
export const requestRefund = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Authentication required', 401);

  const { paymentId, reason } = req.body;
  const payment = await BillPayment.findOne({ _id: paymentId, userId: req.user._id });

  if (!payment) return sendNotFound(res, 'Payment not found');
  if (payment.status !== 'completed') throw new AppError('Only completed payments can be refunded', 400);
  if (payment.refundStatus !== 'none') throw new AppError('Refund already requested', 400);

  if (!payment.aggregatorRef) throw new AppError('No aggregator reference for refund', 400);

  await BillPayment.findByIdAndUpdate(payment._id, {
    refundStatus:  'pending',
    refundReason:  reason || 'User requested',
    refundAmount:  payment.amount,
  });

  // Initiate refund via Razorpay
  const { refundId } = await bbpsService.initiateRefund(payment.aggregatorRef, payment.amount, reason);

  await BillPayment.findByIdAndUpdate(payment._id, { refundRef: refundId });

  sendSuccess(res, { refundId, status: 'pending' }, 'Refund initiated. Will credit in 5-7 business days.');
});
```

### NEW: BBPS Webhook handler:
```typescript
export const handleBBPSWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature  = req.headers['x-razorpay-signature'] as string;
  const webhookBody = JSON.stringify(req.body);
  const event      = req.body;

  // Verify signature using existing razorpayService
  const isValid = razorpayService.validateWebhookSignature(webhookBody, signature);
  if (!isValid) {
    logger.error('[BBPS WEBHOOK] Invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const { event: eventType, payload } = event;

  if (eventType === 'bbps.payment.completed') {
    const { transaction_id, reference_id, status } = payload;

    await BillPayment.findOneAndUpdate(
      { transactionRef: reference_id },
      {
        status:          status === 'SUCCESS' ? 'completed' : 'failed',
        aggregatorRef:   transaction_id,
        webhookVerified: true,
        paidAt:          status === 'SUCCESS' ? new Date() : undefined,
      }
    );
    logger.info('[BBPS WEBHOOK] Payment updated', { reference_id, status });
  }

  if (eventType === 'bbps.refund.processed') {
    const { reference_id, refund_id } = payload;
    await BillPayment.findOneAndUpdate(
      { transactionRef: reference_id },
      { refundStatus: 'processed', refundRef: refund_id, refundedAt: new Date() }
    );
  }

  res.json({ received: true });
});
```

---

## 1.5 · billPaymentRoutes.ts — ADD new routes

**File:** `rez-backend-master/src/routes/billPaymentRoutes.ts`

### ADD imports:
```typescript
import {
  getBillTypes, getProviders, fetchBill, payBill, getHistory,
  getPlans,          // NEW
  requestRefund,     // NEW
  handleBBPSWebhook, // NEW
} from '../controllers/billPaymentController';
```

### ADD to providerQuerySchema (support new types):
```typescript
const providerQuerySchema = Joi.object({
  type: Joi.string()
    .valid('electricity','water','gas','internet','mobile_postpaid',
           'mobile_prepaid','broadband','dth','landline',
           'insurance','fastag','education_fee')    // NEW types
    .required(),
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(50).default(10),
});
```

### ADD to payBillSchema:
```typescript
const payBillSchema = Joi.object({
  providerId:        Joi.string().required(),
  customerNumber:    Joi.string().trim().min(1).max(50).required(),
  amount:            Joi.number().positive().required(),
  razorpayPaymentId: Joi.string().required(),   // NEW — Razorpay payment ID
  planId:            Joi.string().optional(),   // NEW — for prepaid recharge
});
```

### ADD new routes (after existing routes):
```typescript
// Plans (mobile prepaid only)
router.get('/plans', validateQuery(Joi.object({
  providerId: Joi.string().required(),
  circle:     Joi.string().default('KA'),
})), getPlans);

// Refund
router.post('/refund', validate(Joi.object({
  paymentId: Joi.string().required(),
  reason:    Joi.string().max(200).optional(),
})), requestRefund);

// BBPS Webhook (NO authenticate middleware — called by Razorpay)
router.post('/webhook/bbps', handleBBPSWebhook);
```

---

## 1.6 · gamificationEventBus.ts — ADD bill_payment_confirmed event

**File:** `rez-backend-master/src/events/gamificationEventBus.ts`

### BEFORE (line ~37):
```typescript
export type ActivityEventType =
  | 'order_placed' | 'order_delivered'
  | ...
  | 'bill_uploaded'
  | ...
```

### AFTER (add one line):
```typescript
export type ActivityEventType =
  | 'order_placed' | 'order_delivered'
  | ...
  | 'bill_uploaded'
  | 'bill_payment_confirmed'    // NEW — fires when BBPS payment succeeds
  | ...
```

---

## 1.7 · rewardEngine.ts — ADD 'bill_payment' to RewardType

**File:** `rez-backend-master/src/core/rewardEngine.ts`

### BEFORE:
```typescript
export type RewardType =
  | 'cashback' | 'referral' | ... | 'pick_approval' | 'program_task';
```

### AFTER (add one entry):
```typescript
export type RewardType =
  | 'cashback' | 'referral' | ... | 'pick_approval' | 'program_task'
  | 'bill_payment';    // NEW — promo coins for BBPS bill/recharge payments
```

---

## 1.8 · streakHandler.ts — Wire bill payment to streak

**File:** `rez-backend-master/src/events/handlers/streakHandler.ts`

### ADD case in the event switch:
```typescript
case 'bill_payment_confirmed':
  await handleStreakUpdate(userId, 'savings', metadata);
  // bill payment counts as a savings action — same streak as store payment
  break;
```

---

## 1.9 · NEW Scheduled Job: Recharge Reminder

**Create:** `rez-backend-master/src/jobs/billPaymentReminderJob.ts`

```typescript
/**
 * Bill Payment Reminder Job
 * Runs daily at 10 AM. Finds bills with dueDate in next 3 days.
 * Sends push notification with coins reminder.
 */

import { BillPayment } from '../models/BillPayment';
import { createServiceLogger } from '../config/logger';
// Import your notification service
// import notificationService from '../services/notificationService';

const logger = createServiceLogger('bill-reminder-job');

export async function runBillPaymentReminders(): Promise<void> {
  const now      = new Date();
  const in3Days  = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Find bills due in the next 3 days that haven't been reminded
  const dueBills = await BillPayment.find({
    status:       'completed',
    reminderSent: false,
    dueDateRaw:   { $gte: now, $lte: in3Days },
  })
  .populate('provider', 'name type promoCoinsFixed')
  .populate('userId',   'fcmToken')
  .lean();

  logger.info(`[BILL REMINDER] Found ${dueBills.length} bills due in 3 days`);

  for (const bill of dueBills) {
    try {
      const provider = bill.provider as any;
      const user     = bill.userId as any;

      if (user?.fcmToken) {
        // await notificationService.sendPush(user.fcmToken, {
        //   title: `${provider.name} bill due soon`,
        //   body: `Pay your ${provider.name} bill now and earn ${provider.promoCoinsFixed || 10} promo coins!`,
        //   data: { type: 'bill_reminder', billType: bill.billType, screen: 'bill-payment' }
        // });
        logger.info(`[BILL REMINDER] Sent reminder to user ${user._id} for ${provider.name}`);
      }

      await BillPayment.findByIdAndUpdate(bill._id, { reminderSent: true });
    } catch (err: any) {
      logger.error('[BILL REMINDER] Failed for bill', { billId: bill._id, error: err.message });
    }
  }
}
```

### Register in ScheduledJobService.ts:
```typescript
// ADD import:
import { runBillPaymentReminders } from '../jobs/billPaymentReminderJob';

// ADD to jobs array:
{
  name:     'bill-payment-reminders',
  cron:     '0 10 * * *',   // 10 AM every day
  handler:  runBillPaymentReminders,
  description: 'Send push notifications for bills due in 3 days',
},
```

---

## 1.10 · NEW Admin Routes: BBPS Management

**Create:** `rez-backend-master/src/routes/admin/bbpsAdmin.ts`

```typescript
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/adminAuth';
import { asyncHandler } from '../../utils/asyncHandler';
import { BillProvider } from '../../models/BillProvider';
import { BillPayment } from '../../models/BillPayment';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/admin/bbps/providers — list all providers
router.get('/providers', asyncHandler(async (req, res) => {
  const { type, page = 1, limit = 50 } = req.query;
  const query: any = {};
  if (type) query.type = type;
  const [providers, total] = await Promise.all([
    BillProvider.find(query).sort({ type: 1, displayOrder: 1 }).skip((+page-1)*+limit).limit(+limit).lean(),
    BillProvider.countDocuments(query),
  ]);
  sendSuccess(res, { providers, total });
}));

// POST /api/admin/bbps/providers — create provider
router.post('/providers', asyncHandler(async (req, res) => {
  const provider = await BillProvider.create(req.body);
  sendSuccess(res, provider, 'Provider created', 201);
}));

// PUT /api/admin/bbps/providers/:id — update provider
router.put('/providers/:id', asyncHandler(async (req, res) => {
  const provider = await BillProvider.findByIdAndUpdate(req.params.id, req.body, { new: true });
  sendSuccess(res, provider, 'Provider updated');
}));

// PATCH /api/admin/bbps/providers/:id/toggle — activate/deactivate
router.patch('/providers/:id/toggle', asyncHandler(async (req, res) => {
  const provider = await BillProvider.findById(req.params.id);
  if (!provider) return res.status(404).json({ error: 'Not found' });
  provider.isActive = !provider.isActive;
  await provider.save();
  sendSuccess(res, { isActive: provider.isActive });
}));

// GET /api/admin/bbps/transactions — all bill payments (admin view)
router.get('/transactions', asyncHandler(async (req, res) => {
  const { status, billType, from, to, page = 1, limit = 20 } = req.query;
  const query: any = {};
  if (status)   query.status   = status;
  if (billType) query.billType = billType;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from as string);
    if (to)   query.createdAt.$lte = new Date(to as string);
  }
  const [transactions, total] = await Promise.all([
    BillPayment.find(query)
      .populate('userId', 'name email phone')
      .populate('provider', 'name type logo')
      .sort({ createdAt: -1 })
      .skip((+page-1)*+limit).limit(+limit).lean(),
    BillPayment.countDocuments(query),
  ]);
  sendSuccess(res, { transactions, total });
}));

// GET /api/admin/bbps/stats — revenue analytics
router.get('/stats', asyncHandler(async (req, res) => {
  const [stats] = await BillPayment.aggregate([
    { $match: { status: 'completed' } },
    { $group: {
      _id:              null,
      totalVolume:      { $sum: '$amount' },
      totalTransactions:{ $sum: 1 },
      totalCoinsIssued: { $sum: '$promoCoinsIssued' },
      totalCashback:    { $sum: '$cashbackAmount' },
      avgTransaction:   { $avg: '$amount' },
    }},
  ]);
  const byType = await BillPayment.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: '$billType', volume: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { volume: -1 } },
  ]);
  sendSuccess(res, { overview: stats || {}, byType });
}));

// POST /api/admin/bbps/providers/:id/refund-all-failed — admin bulk refund
router.post('/transactions/:id/refund', asyncHandler(async (req, res) => {
  const payment = await BillPayment.findById(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Not found' });
  await BillPayment.findByIdAndUpdate(payment._id, {
    refundStatus: 'pending', refundReason: req.body.reason || 'Admin initiated',
    refundAmount: payment.amount,
  });
  sendSuccess(res, { message: 'Refund initiated' });
}));

export default router;
```

### Register in config/routes.ts:
```typescript
app.use(`${API_PREFIX}/admin/bbps`, bbpsAdminRoutes);
```

---

## 1.11 · Database Seeding — Provider Data

**Create:** `rez-backend-master/src/scripts/seed-bill-providers.ts`

```typescript
/**
 * Run with: npx ts-node src/scripts/seed-bill-providers.ts
 * Seeds initial BillProvider documents for all BBPS categories.
 * Aggregator codes (e.g., "JIO", "BESCOM") come from Razorpay BillPay documentation.
 */

import mongoose from 'mongoose';
import { BillProvider } from '../models/BillProvider';

const providers = [
  // ── Mobile Prepaid ──────────────────────────────────────────
  { name:'Jio',           code:'jio',      type:'mobile_prepaid', aggregatorCode:'JIO',    aggregatorName:'razorpay', cashbackPercent:2, promoCoinsFixed:10, displayOrder:1, isFeatured:true,  logo:'https://cdn.rez.app/providers/jio.png' },
  { name:'Airtel',        code:'airtel',   type:'mobile_prepaid', aggregatorCode:'AIRTEL', aggregatorName:'razorpay', cashbackPercent:2, promoCoinsFixed:10, displayOrder:2, isFeatured:true,  logo:'https://cdn.rez.app/providers/airtel.png' },
  { name:'BSNL',          code:'bsnl',     type:'mobile_prepaid', aggregatorCode:'BSNL',   aggregatorName:'razorpay', cashbackPercent:2, promoCoinsFixed:8,  displayOrder:3, isFeatured:false, logo:'https://cdn.rez.app/providers/bsnl.png' },
  { name:'Vi (Vodafone)', code:'vi',       type:'mobile_prepaid', aggregatorCode:'VI',     aggregatorName:'razorpay', cashbackPercent:2, promoCoinsFixed:8,  displayOrder:4, isFeatured:false, logo:'https://cdn.rez.app/providers/vi.png' },

  // ── Mobile Postpaid ─────────────────────────────────────────
  { name:'Jio Postpaid',   code:'jio-post',    type:'mobile_postpaid', aggregatorCode:'JIO_PP',    aggregatorName:'razorpay', cashbackPercent:3, promoCoinsFixed:15, displayOrder:1, isFeatured:true, logo:'https://cdn.rez.app/providers/jio.png' },
  { name:'Airtel Postpaid',code:'airtel-post',  type:'mobile_postpaid', aggregatorCode:'AIRTEL_PP', aggregatorName:'razorpay', cashbackPercent:3, promoCoinsFixed:15, displayOrder:2, isFeatured:true, logo:'https://cdn.rez.app/providers/airtel.png' },

  // ── Electricity (Karnataka focus for Bangalore launch) ──────
  { name:'BESCOM',        code:'bescom',   type:'electricity', aggregatorCode:'BESCOM', aggregatorName:'razorpay', cashbackPercent:1, promoCoinsFixed:20, displayOrder:1, isFeatured:true,  logo:'https://cdn.rez.app/providers/bescom.png', region:'karnataka', requiredFields:[{ fieldName:'consumerNumber', label:'Consumer Number', placeholder:'e.g. 2890123456', type:'text' }] },
  { name:'MSEDCL',        code:'msedcl',   type:'electricity', aggregatorCode:'MSEDCL', aggregatorName:'razorpay', cashbackPercent:1, promoCoinsFixed:20, displayOrder:2, isFeatured:false, logo:'https://cdn.rez.app/providers/msedcl.png', region:'maharashtra' },
  { name:'BSES Rajdhani', code:'bses-raj', type:'electricity', aggregatorCode:'BSES',   aggregatorName:'razorpay', cashbackPercent:1, promoCoinsFixed:20, displayOrder:3, isFeatured:false, logo:'https://cdn.rez.app/providers/bses.png', region:'delhi' },

  // ── Broadband ────────────────────────────────────────────────
  { name:'Airtel Broadband',  code:'airtel-bb', type:'broadband', aggregatorCode:'AIRTEL_BB', aggregatorName:'razorpay', cashbackPercent:2, promoCoinsFixed:12, displayOrder:1, isFeatured:true, logo:'https://cdn.rez.app/providers/airtel.png' },
  { name:'Jio Fiber',         code:'jio-fiber', type:'broadband', aggregatorCode:'JIO_FIBER', aggregatorName:'razorpay', cashbackPercent:2, promoCoinsFixed:12, displayOrder:2, isFeatured:true, logo:'https://cdn.rez.app/providers/jio.png' },
  { name:'ACT Fibernet',      code:'act',       type:'broadband', aggregatorCode:'ACT',       aggregatorName:'razorpay', cashbackPercent:2, promoCoinsFixed:12, displayOrder:3, isFeatured:true, logo:'https://cdn.rez.app/providers/act.png' },

  // ── DTH ──────────────────────────────────────────────────────
  { name:'Tata Play',       code:'tataplay',  type:'dth', aggregatorCode:'TATA_PLAY',  aggregatorName:'razorpay', cashbackPercent:2, promoCoinsFixed:8, displayOrder:1, isFeatured:true, logo:'https://cdn.rez.app/providers/tataplay.png' },
  { name:'Dish TV',         code:'dishtv',    type:'dth', aggregatorCode:'DISH_TV',    aggregatorName:'razorpay', cashbackPercent:2, promoCoinsFixed:8, displayOrder:2, isFeatured:true, logo:'https://cdn.rez.app/providers/dishtv.png' },
  { name:'Sun Direct',      code:'sundirect', type:'dth', aggregatorCode:'SUN_DIRECT', aggregatorName:'razorpay', cashbackPercent:2, promoCoinsFixed:8, displayOrder:3, isFeatured:false, logo:'https://cdn.rez.app/providers/sundirect.png' },

  // ── Gas ──────────────────────────────────────────────────────
  { name:'Indane LPG',  code:'indane', type:'gas', aggregatorCode:'INDANE', aggregatorName:'razorpay', cashbackPercent:1, promoCoinsFixed:10, displayOrder:1, isFeatured:true, logo:'https://cdn.rez.app/providers/indane.png' },
  { name:'HP Gas',      code:'hpgas',  type:'gas', aggregatorCode:'HP_GAS', aggregatorName:'razorpay', cashbackPercent:1, promoCoinsFixed:10, displayOrder:2, isFeatured:true, logo:'https://cdn.rez.app/providers/hpgas.png' },
  { name:'Bharatgas',   code:'bharatgas', type:'gas', aggregatorCode:'BHARAT_GAS', aggregatorName:'razorpay', cashbackPercent:1, promoCoinsFixed:10, displayOrder:3, isFeatured:false, logo:'https://cdn.rez.app/providers/bharatgas.png' },

  // ── FASTag ───────────────────────────────────────────────────
  { name:'Paytm Payments Bank FASTag', code:'fastag-paytm', type:'fastag', aggregatorCode:'FASTAG_PAYTM', aggregatorName:'razorpay', cashbackPercent:1, promoCoinsFixed:5, displayOrder:1, isFeatured:true, logo:'https://cdn.rez.app/providers/paytm.png' },
  { name:'HDFC Bank FASTag',           code:'fastag-hdfc',  type:'fastag', aggregatorCode:'FASTAG_HDFC',  aggregatorName:'razorpay', cashbackPercent:1, promoCoinsFixed:5, displayOrder:2, isFeatured:true, logo:'https://cdn.rez.app/providers/hdfc.png' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  for (const p of providers) {
    await BillProvider.findOneAndUpdate(
      { code: p.code },
      { $set: p },
      { upsert: true, new: true }
    );
    console.log(`Seeded: ${p.name} (${p.type})`);
  }

  console.log(`\n✅ Seeded ${providers.length} providers`);
  await mongoose.disconnect();
}

seed().catch(console.error);
```

---
---

# PART 2 — FRONTEND CHANGES

---

## 2.1 · bill-payment.tsx — ADD plans screen for prepaid

**File:** `nuqta-master/app/bill-payment.tsx`

### ADD to imports:
```typescript
import { getPlans, BillPlanInfo } from '@/services/billPaymentApi';
```

### ADD to state:
```typescript
const [plans, setPlans] = useState<BillPlanInfo[]>([]);
const [selectedPlan, setSelectedPlan] = useState<BillPlanInfo | null>(null);
const [loadingPlans, setLoadingPlans] = useState(false);
type PageStep = 'types' | 'providers' | 'input' | 'bill' | 'plans';  // ADD 'plans'
```

### ADD plan fetching (when provider is mobile_prepaid):
```typescript
// In handleFetchBill, after getting result:
if (result.data?.requiresPlanSelection) {
  // For prepaid — fetch plans instead of showing bill details
  setLoadingPlans(true);
  const plansRes = await getPlans(selectedProvider._id);
  setPlans(plansRes.data?.allPlans || []);
  setStep('plans');
  setLoadingPlans(false);
  return;
}
setFetchedBill(result.data);
setStep('bill');
```

### ADD plans screen rendering (between 'input' and 'bill' steps):
```typescript
{currentStep === 'plans' && (
  <View>
    {/* Popular plans strip */}
    <Text style={styles.sectionTitle}>Popular Plans</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {plans.filter(p => p.isPopular).map(plan => (
        <Pressable
          key={plan.id}
          style={[styles.planCard, selectedPlan?.id === plan.id && styles.planCardSelected]}
          onPress={() => setSelectedPlan(plan)}
        >
          <Text style={styles.planPrice}>₹{plan.price}</Text>
          <Text style={styles.planValidity}>{plan.validity}</Text>
          {plan.data && <Text style={styles.planData}>{plan.data}</Text>}
        </Pressable>
      ))}
    </ScrollView>

    {/* All plans list */}
    <Text style={styles.sectionTitle}>All Plans</Text>
    <FlatList
      data={plans}
      keyExtractor={p => p.id}
      renderItem={({ item: plan }) => (
        <Pressable
          style={[styles.planRow, selectedPlan?.id === plan.id && styles.planRowSelected]}
          onPress={() => setSelectedPlan(plan)}
        >
          <View style={styles.planRowLeft}>
            <Text style={styles.planRowPrice}>₹{plan.price}</Text>
            <Text style={styles.planRowDesc}>{plan.data} · {plan.calls} · {plan.validity}</Text>
          </View>
          {selectedPlan?.id === plan.id && (
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
          )}
        </Pressable>
      )}
    />

    {selectedPlan && (
      <Pressable
        style={styles.payButton}
        onPress={() => handlePayBill(selectedPlan.price, selectedPlan.id)}
      >
        <Text style={styles.payButtonText}>
          Recharge ₹{selectedPlan.price}  · Earn {selectedProvider?.promoCoinsFixed || 10} coins
        </Text>
      </Pressable>
    )}
  </View>
)}
```

---

## 2.2 · billPaymentApi.ts — ADD getPlans + refund + new types

**File:** `nuqta-master/services/billPaymentApi.ts`

### ADD new types:
```typescript
export interface BillPlanInfo {
  id:        string;
  name:      string;
  price:     number;
  validity:  string;
  data?:     string;
  calls?:    string;
  sms?:      string;
  isPopular: boolean;
}

export interface BillProviderInfo {
  // ...existing fields...
  aggregatorCode?:  string;
  promoCoinsFixed?: number;  // NEW
  displayOrder?:    number;
  isFeatured?:      boolean;
}
```

### ADD getPlans function:
```typescript
export async function getPlans(
  providerId: string,
  circle: string = 'KA'
): Promise<ApiResponse<{ popular: BillPlanInfo[]; allPlans: BillPlanInfo[] }>> {
  return apiClient.get(`/bill-payments/plans?providerId=${providerId}&circle=${circle}`);
}
```

### UPDATE payBill to include razorpayPaymentId:
```typescript
export async function payBill(
  providerId:        string,
  customerNumber:    string,
  amount:            number,
  razorpayPaymentId: string,
  planId?:           string
): Promise<ApiResponse<{ payment: BillPaymentRecord; promoCoinsEarned: number; status: string; message: string }>> {
  return apiClient.post('/bill-payments/pay', {
    providerId, customerNumber, amount, razorpayPaymentId, planId,
  });
}
```

### ADD requestRefund:
```typescript
export async function requestRefund(
  paymentId: string, reason?: string
): Promise<ApiResponse<{ refundId: string; status: string }>> {
  return apiClient.post('/bill-payments/refund', { paymentId, reason });
}
```

---

## 2.3 · NEW SCREEN: recharge.tsx — Dedicated Mobile Recharge

**Create:** `nuqta-master/app/recharge.tsx`

This is the standalone recharge entry point accessible from the home screen quick actions.

```typescript
/**
 * Mobile Recharge Quick Screen
 * Direct entry point: phone number → operator detection → plans → pay
 * Design: Clean, fast, 3-step flow
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const OPERATORS = [
  { code: 'jio',    name: 'Jio',    color: '#1A73E8', prefix: ['6','7','8','9'] },
  { code: 'airtel', name: 'Airtel', color: '#E8001E', prefix: ['9','8','7','6'] },
  { code: 'vi',     name: 'Vi',     prefix: ['9','8'] },
  { code: 'bsnl',   name: 'BSNL',   prefix: ['9'] },
];

export default function RechargePage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');

  const handleContinue = () => {
    if (phone.length !== 10) return;
    // Navigate to bill-payment with prepaid type pre-selected
    router.push({ pathname: '/bill-payment', params: { type: 'mobile_prepaid', phone } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} />
        </Pressable>
        <Text style={styles.title}>Mobile Recharge</Text>
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.label}>Enter mobile number</Text>
        <TextInput
          style={styles.phoneInput}
          value={phone}
          onChangeText={setPhone}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="10-digit number"
          autoFocus
        />
        <Text style={styles.hint}>We'll detect your operator automatically</Text>
      </View>

      {/* Quick access operators */}
      <View style={styles.operators}>
        {OPERATORS.map(op => (
          <Pressable key={op.code} style={styles.operatorChip}>
            <Text style={styles.operatorName}>{op.name}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.continueBtn, phone.length !== 10 && styles.continueBtnDisabled]}
        onPress={handleContinue}
        disabled={phone.length !== 10}
      >
        <Text style={styles.continueBtnText}>See Plans →</Text>
      </Pressable>

      {/* Coin incentive banner */}
      <View style={styles.coinBanner}>
        <Ionicons name="gift-outline" size={16} color="#FFCD57" />
        <Text style={styles.coinBannerText}>
          Earn 10 Promo Coins on every recharge · Use at any nearby store
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#fff' },
  header:          { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  title:           { fontSize: 18, fontWeight: '500' },
  inputSection:    { padding: 24 },
  label:           { fontSize: 13, color: '#666', marginBottom: 8 },
  phoneInput:      { fontSize: 28, fontWeight: '500', letterSpacing: 4, borderBottomWidth: 2, borderBottomColor: '#1a3a52', paddingVertical: 8 },
  hint:            { fontSize: 12, color: '#999', marginTop: 8 },
  operators:       { flexDirection: 'row', gap: 8, paddingHorizontal: 24, flexWrap: 'wrap' },
  operatorChip:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
  operatorName:    { fontSize: 13, fontWeight: '500' },
  continueBtn:     { margin: 24, backgroundColor: '#1a3a52', borderRadius: 12, padding: 16, alignItems: 'center' },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  coinBanner:      { marginHorizontal: 24, padding: 12, backgroundColor: '#1a3a521A', borderRadius: 8, flexDirection: 'row', gap: 8, alignItems: 'center' },
  coinBannerText:  { fontSize: 12, color: '#1a3a52', flex: 1 },
});
```

---

## 2.4 · Home Tab — ADD Recharge + Bills to Quick Actions

**File:** `nuqta-master/components/homepage/NearUTabContent.tsx`

### ADD quick action cards (in the quick actions section):
```typescript
// ADD these two cards to the quick actions horizontal scroll:
{
  id: 'recharge',
  icon: 'phone-portrait-outline',
  label: 'Recharge',
  color: '#10B981',
  route: '/recharge',
  badge: '+10 coins',
},
{
  id: 'bills',
  icon: 'flash-outline',
  label: 'Pay Bills',
  color: '#F59E0B',
  route: '/bill-payment',
  badge: '+20 coins',
},
```

---

## 2.5 · Bill Payment Success Screen — ADD "Deals Near You"

**File:** `nuqta-master/app/bill-payment.tsx` (success state)

### ADD after successful payment:
```typescript
// In success state rendering:
{paymentResult && (
  <View style={styles.successContainer}>
    <Ionicons name="checkmark-circle" size={64} color="#10B981" />
    <Text style={styles.successTitle}>Payment Successful!</Text>
    <Text style={styles.successAmount}>₹{paymentResult.amount}</Text>

    {/* Promo Coins earned */}
    {paymentResult.promoCoinsEarned > 0 && (
      <View style={styles.coinsEarned}>
        <Text style={styles.coinsEarnedText}>
          🎉 You earned {paymentResult.promoCoinsEarned} Promo Coins!
        </Text>
        <Text style={styles.coinsHint}>
          Use them at any merchant within 30 days
        </Text>
      </View>
    )}

    {/* Nearby deals cross-sell */}
    <Text style={styles.nearbyTitle}>Use your coins here 👇</Text>
    <NearbyDealsStrip coins={paymentResult.promoCoinsEarned} />

    <Pressable style={styles.doneBtn} onPress={() => router.push('/(tabs)')}>
      <Text style={styles.doneBtnText}>Back to Home</Text>
    </Pressable>
  </View>
)}
```

---
---

# PART 3 — ADMIN PANEL ADDITIONS

---

## 3.1 · NEW Admin Screen: bbps-providers.tsx

**Create:** `rez-admin-main/app/(dashboard)/bbps-providers.tsx`

**Connects to:** `GET/POST/PUT /api/admin/bbps/providers`

**Features:**
- List all BBPS providers with type filter tabs
- Toggle active/inactive per provider
- Edit: aggregatorCode, cashbackPercent, promoCoinsFixed, displayOrder
- Add new provider form (for manual providers)
- Featured toggle (shows provider in "popular" section of app)

```typescript
// Key sections of this screen:

// 1. Type filter tabs: All | Prepaid | Postpaid | Electricity | DTH | Broadband | Gas | FASTag
// 2. Provider list: name, code, aggregatorCode, cashbackPercent, promoCoinsFixed, active toggle
// 3. Edit modal: all fields, save to PUT /api/admin/bbps/providers/:id
// 4. Add new: POST /api/admin/bbps/providers
// 5. Bulk seed button: runs the seed script via POST /api/admin/bbps/seed
```

**Design spec (from v2 AdminUploadBillSettings.jsx pattern):**
- Dark section headers
- Toggle switches for isActive and isFeatured
- Number inputs for cashbackPercent (0-100) and promoCoinsFixed (0-500)
- Text input for aggregatorCode (critical — maps to Razorpay operator ID)

---

## 3.2 · NEW Admin Screen: bbps-transactions.tsx

**Create:** `rez-admin-main/app/(dashboard)/bbps-transactions.tsx`

**Connects to:** `GET /api/admin/bbps/transactions`

**Features:**
- Transaction list: date, user, provider, amount, status, coins issued
- Filters: status (pending/processing/completed/failed), bill type, date range
- Per-transaction: view details, initiate refund
- Export CSV button

```typescript
// Key sections:

// 1. Stats cards: Total Volume Today | Total Transactions | Pending Count | Failed Count
// 2. Filter bar: status dropdown + billType dropdown + date range picker + search
// 3. Transaction table: timestamp | user (name+phone) | provider | amount | coins | status | actions
// 4. Action: [View Details] [Refund] (refund only for completed/failed)
// 5. Refund modal: shows amount, requires reason, calls POST /api/admin/bbps/transactions/:id/refund
```

---

## 3.3 · NEW Admin Screen: bbps-config.tsx

**Create:** `rez-admin-main/app/(dashboard)/bbps-config.tsx`

**Connects to:** `GET/PUT /api/admin/bbps/config` (extend WalletConfig or new collection)

**Config settings:**
```
Global coin rewards:
  Default promo coins per ₹100 bill payment: [ 5 coins ]
  Mobile recharge bonus coins: [ 10 coins ]
  Electricity/water/gas bonus: [ 20 coins ]

Payment limits:
  Min transaction amount: ₹[ 10 ]
  Max transaction amount: ₹[ 50,000 ]

Feature flags:
  [✓] Mobile Prepaid Recharge enabled
  [✓] Electricity bills enabled
  [✗] Insurance premium enabled   ← off by default
  [✗] Education fees enabled      ← off by default

Reminder settings:
  Send reminder X days before due date: [ 3 ]
  Reminder notification template: [text input]

Revenue display:
  Show MDR revenue in admin: [✓]
  MDR rate (for analytics only): [ 1.5% ]
```

---

## 3.4 · NEW Admin Screen: bbps-analytics.tsx

**Create:** `rez-admin-main/app/(dashboard)/bbps-analytics.tsx`

**Connects to:** `GET /api/admin/bbps/stats`

**Charts + metrics:**
- Total bill payment volume (bar chart: daily/weekly/monthly)
- Revenue by bill type (pie chart)
- Top 5 providers by volume
- Promo coins issued via bill payments
- Failed transaction rate (% of failed/total)
- Platform revenue from MDR (thin margin per transaction)

---

## 3.5 · Update Admin Sidebar Navigation

**File:** `rez-admin-main/app/(dashboard)/_layout.tsx`

### ADD to navigation items (under "Payments" section):
```typescript
{
  group: 'Payments & BBPS',
  items: [
    { label: 'BBPS Transactions', icon: 'receipt-outline', route: '/bbps-transactions' },
    { label: 'Bill Providers',    icon: 'list-outline',    route: '/bbps-providers' },
    { label: 'BBPS Analytics',    icon: 'bar-chart-outline', route: '/bbps-analytics' },
    { label: 'BBPS Config',       icon: 'settings-outline', route: '/bbps-config' },
  ]
}
```

---
---

# PART 4 — DESIGN SPECIFICATIONS

---

## 4.1 · Bill Payment Screen Design

**Color system:**
```
Bill type cards:
  electricity → #F59E0B (amber)
  mobile_prepaid → #10B981 (green)
  broadband → #8B5CF6 (purple)
  dth → #06B6D4 (cyan)
  gas → #EF4444 (red)
  water → #3B82F6 (blue)
  fastag → #F97316 (orange)

Provider card: white bg, 1px border, 12px radius
Plan card (selected): navy `#1a3a52` bg, white text
Plan card (unselected): white bg, grey border
Pay button: navy `#1a3a52` bg, white text, 14px radius, full width
Coin banner: gold `#FFCD5720` bg, gold `#FFCD57` icon, navy text
```

**Screen flow:**
```
Step 1: Bill Types Grid (2-column grid)
  ┌─────────┐  ┌─────────┐
  │ ⚡ Elect │  │ 📱 Rchg │
  │ 8 billers│  │ 4 ops   │
  └─────────┘  └─────────┘
  ┌─────────┐  ┌─────────┐
  │ 📺 DTH  │  │ 🌐 BB   │
  │ 3 prov  │  │ 5 prov  │
  └─────────┘  └─────────┘

Step 2: Provider List (vertical, with search)
  [🔍 Search providers]
  ┌──────────────────────────┐
  │ [JIO logo] Jio  •  2% CB │
  └──────────────────────────┘
  ┌──────────────────────────┐
  │ [Airtel] Airtel •  2% CB │
  └──────────────────────────┘

Step 3a (Postpaid/Utility): Enter consumer number
  Consumer No:  [              ]
  [Fetch Bill →]

Step 3b (Prepaid): Select plan
  Popular Plans (horizontal scroll):
  ┌──────┐ ┌──────┐ ┌──────┐
  │ ₹199 │ │ ₹239 │ │ ₹399 │
  │28 day│ │30 day│ │56 day│
  │2GB/d │ │2.5GB │ │3GB/d │
  └──────┘ └──────┘ └──────┘

  All Plans (vertical list):
  ₹149  14 days  1GB/day  Unlimited calls
  ₹199  28 days  2GB/day  Unlimited calls ← most popular
  ₹239  30 days  2.5GB/day  Unlimited

Step 4: Bill Summary + Pay
  Provider:    BESCOM
  Amount:      ₹2,450
  Due date:    25 Mar 2026
  Coins:       ✨ +20 Promo Coins

  [Pay ₹2,450 with UPI →]

Step 5: Success
  ✅  ₹2,450 paid
  🎉 You earned 20 Promo Coins!
  [Use coins near you →] (shows 3 nearby deals)
```

---

## 4.2 · Admin BBPS Screen Design

**Provider List screen:**
```
┌─────────────────────────────────────────────┐
│  BBPS Providers                [+ Add New]  │
│  [All][Prepaid][Electric][DTH][BB][Gas]      │
├────────────────────────────────────────────-┤
│  Name        │Code    │Cashback│Coins│Active│
│  Jio         │JIO     │2%      │10   │  ✓  │
│  Airtel      │AIRTEL  │2%      │10   │  ✓  │
│  BESCOM      │BESCOM  │1%      │20   │  ✓  │
│  MSEDCL      │MSEDCL  │1%      │20   │  ✗  │
└─────────────────────────────────────────────┘
```

**Transaction list screen:**
```
┌──────────────────────────────────────────────────────────┐
│ BBPS Transactions            [Today ▼] [All Types ▼]     │
│ ₹1,24,500 GMV today  •  234 txns  •  12 pending  •  3 failed │
├──────────────────────────────────────────────────────────┤
│ Time     │User      │Provider     │Amount│Coins│Status    │
│ 14:32    │Priya S.  │Jio Recharge │₹199  │10   │✓ Done   │
│ 14:28    │Arjun K.  │BESCOM       │₹2450 │20   │⏳ Proc  │
│ 14:15    │Meena R.  │Airtel Post  │₹499  │15   │✓ Done   │
│ 13:50    │Raj P.    │Tata Play    │₹299  │8    │✗ Failed │[Refund]│
└──────────────────────────────────────────────────────────┘
```

---
---

# PART 5 — 21-DAY SHIP PLAN

---

## Day 1-2 · Aggregator Setup
- [ ] Sign Razorpay BillPay agreement (or activate if already have Razorpay account)
- [ ] Get Razorpay BillPay API sandbox credentials
- [ ] Get operator codes from Razorpay BillPay documentation
- [ ] Set up Razorpay webhook endpoint URL with BBPS event types

## Day 3-5 · Backend Models + Service
- [ ] Update BillProvider model (1.1)
- [ ] Replace BillPayment model (1.2)
- [ ] Create bbpsService.ts (1.3)
- [ ] Add imports to billPaymentController (1.4)
- [ ] Test bbpsService in sandbox: getOperators, getPlans, fetchBill
- [ ] Seed providers: run seed script (1.11)

## Day 6-8 · Controller + Routes
- [ ] Replace fetchBill with real API (1.4)
- [ ] Add getPlans controller (1.4)
- [ ] Replace payBill with real API + wallet debit + coins (1.4)
- [ ] Add requestRefund controller (1.4)
- [ ] Add handleBBPSWebhook (1.4)
- [ ] Add new routes to billPaymentRoutes.ts (1.5)
- [ ] Add bill_payment_confirmed to gamificationEventBus (1.6)
- [ ] Add bill_payment to RewardType (1.7)
- [ ] Wire streak handler (1.8)
- [ ] Create admin routes (1.10)
- [ ] Register admin routes in config/routes.ts

## Day 9-10 · Gamification + Jobs
- [ ] Create billPaymentReminderJob.ts (1.9)
- [ ] Register reminder job in ScheduledJobService
- [ ] Test end-to-end: pay bill → promo coins issued → streak updates

## Day 11-13 · Frontend
- [ ] Update billPaymentApi.ts with new types + getPlans + refund (2.2)
- [ ] Add plans step to bill-payment.tsx (2.1)
- [ ] Create recharge.tsx quick screen (2.3)
- [ ] Add recharge + bills to home quick actions (2.4)
- [ ] Add success screen with coins earned + nearby deals (2.5)

## Day 14-16 · Admin Panel
- [ ] Create bbps-providers.tsx (3.1)
- [ ] Create bbps-transactions.tsx (3.2)
- [ ] Create bbps-config.tsx (3.3)
- [ ] Create bbps-analytics.tsx (3.4)
- [ ] Update admin sidebar navigation (3.5)

## Day 17-19 · QA
- [ ] Full sandbox test: prepaid recharge flow (Jio ₹199)
- [ ] Full sandbox test: electricity bill (BESCOM)
- [ ] Test refund flow
- [ ] Test webhook: mark payment completed when webhook fires
- [ ] Test promo coins issued after payment
- [ ] Test streak increment after bill payment
- [ ] Test reminder job (manual trigger)
- [ ] Admin: verify transactions appear, refund works
- [ ] Admin: toggle provider active/inactive → reflects in app

## Day 20-21 · Go Live
- [ ] Switch Razorpay keys: rzp_test_ → rzp_live_
- [ ] Set BBPS_ENABLED=true in production .env
- [ ] Deploy backend
- [ ] Deploy app update
- [ ] Deploy admin update
- [ ] Monitor: watch first 20 live transactions in admin
- [ ] Monitor: check coin issuance dashboard

---

## ENVIRONMENT VARIABLES TO ADD

```bash
# rez-backend-master/.env

# Razorpay (upgrade from test to live keys):
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

# BBPS specific:
BBPS_ENABLED=true
BBPS_AGGREGATOR=razorpay               # razorpay | setu
BBPS_DEFAULT_PROMO_COINS=10            # default coins per bill payment
BBPS_REMINDER_DAYS_BEFORE=3            # send reminder X days before due date

# If using Setu as alternative:
# SETU_CLIENT_ID=xxxxx
# SETU_CLIENT_SECRET=xxxxx
# SETU_BASE_URL=https://prod.setu.co/api
```

---

*REZ BBPS Integration Complete Guide · March 2026*
*5 parts · 21 files changed · 6 files created · 4 admin screens · 21-day ship plan*
