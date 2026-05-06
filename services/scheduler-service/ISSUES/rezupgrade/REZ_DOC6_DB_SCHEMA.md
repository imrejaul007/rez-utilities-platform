# REZ — DATABASE SCHEMA CHANGE GUIDE (Doc 6)
## Every New + Modified Mongoose Model · Indexes · Migration Safety
### March 2026 | Zero Downtime · Additive-Only

---

## MIGRATION PHILOSOPHY

All changes follow these rules:
1. **Additive only** — new fields are always optional with defaults
2. **No renames** — rename = new field + deprecate old
3. **No drops** — never remove a field in the same deploy as adding
4. **Index before query** — create indexes before deploying code that queries them
5. **Test on staging** with production-sized dataset before production deploy

---

## PRE-DEPLOY CHECKLIST (run before every DB change)
```bash
# 1. Verify connection to correct DB
node -e "require('./dist/config/database').connect().then(() => console.log('Connected'))"

# 2. Check current document count
db.stores.countDocuments()     # Should match expected
db.userstreaks.countDocuments()

# 3. Run the migration script in --dry-run mode first
node scripts/migrate.js --dry-run --migration=<name>

# 4. Backup (automated, but verify)
# MongoDB Atlas: check last automated backup < 6 hours ago
```

---
---

# PHASE 1 SCHEMA CHANGES

---

## DB-01 · UserStreak: Add 'savings' streakType + milestones
**File:** `rez-backend-master/src/models/UserStreak.ts`
**Migration type:** Additive field + enum addition
**Risk:** Low — additive only, existing documents unaffected

### Current schema (relevant section):
```typescript
// Current streakType is implied by the context — verify actual enum in model
// UserStreak currently has: currentStreak, longestStreak, milestones[]
```

### Change required:
```typescript
// ADD to streakType enum (if it exists):
streakType: { 
  type: String, 
  enum: ['daily', 'weekly', 'savings', 'social', 'booking'],  // add 'savings'
  default: 'daily'
}

// No migration needed — existing documents without 'savings' type are unaffected
// New savings streaks are created fresh per user
```

### New index to add:
```typescript
// Add BEFORE deploying streakHandler changes:
UserStreakSchema.index({ user: 1, streakType: 1 }, { unique: true });
// Note: verify this index doesn't already exist — it may conflict
// If it does, the composite index ensures one streak per user per type
```

### Migration safety:
- Existing `UserStreak` documents: ✅ unaffected
- Existing queries on `currentStreak`: ✅ still work
- Rollback: remove the 'savings' enum value + handler (existing docs unaffected)

---

## DB-02 · LocationAddress: Add neighbourhood field
**File:** `nuqta-master/types/location.types.ts` (frontend type only)
**Backend:** `rez-backend-master/src/services/geocodingService.ts` return object

### Change:
```typescript
// types/location.types.ts — BEFORE:
export interface LocationAddress {
  address: string;
  city: string;
  state: string;
  country: string;
  pincode?: string;
}

// AFTER (additive):
export interface LocationAddress {
  address: string;
  neighbourhood?: string;   // NEW — optional, populated by geocoding
  city: string;
  state: string;
  country: string;
  pincode?: string;
}
```

### No DB change needed:
Location data is transient (not stored in a Mongo collection). The geocoding service returns it in the API response. The `neighbourhood` field is added to the TypeScript interface and the service return object only.

### Backend service change (geocodingService.ts):
```typescript
// Both reverseGeocodeGoogle() and reverseGeocodeOpenCage() must return:
return {
  address: formattedAddress,
  neighbourhood: extractedNeighbourhood || undefined,  // NEW
  city: extractedCity,
  state: extractedState,
  country: extractedCountry,
  // ...
};
```

---
---

# PHASE 2 SCHEMA CHANGES

---

## DB-03 · Store: Add socialCashback field
**File:** `rez-backend-master/src/models/Store.ts`
**Migration type:** Additive nested object — zero migration needed
**Risk:** Low

### Current Store model (cashback section, lines ~77-103):
```typescript
cashbackConfig: {
  baseCashbackPercent: { type: Number, default: 5 },
  reviewBonusCoins:    { type: Number, default: 25 },
  socialShareBonusCoins: { type: Number, default: 20 },
  // ... existing fields
}
```

### New field to add:
```typescript
// ADD inside StoreSchema (after cashbackConfig block):
socialCashback: {
  enabled: { 
    type: Boolean, 
    default: false   // ← CRITICAL: default false ensures no accidental activation
  },
  postCashbackPercent: { 
    type: Number, 
    min: 0, 
    max: 100,
    default: 0 
  },
  postTypes: [{ 
    type: String, 
    enum: ['story', 'reel', 'post'],
    default: []
  }],
  minimumFollowers: { 
    type: Number, 
    default: 500 
  },
  verificationWindowHours: { 
    type: Number, 
    default: 48 
  },
  totalBudget: { 
    type: Number, 
    default: 0 
  },
  budgetUsed: { 
    type: Number, 
    default: 0 
  },
  activeCampaignId: {
    type: Schema.Types.ObjectId,
    ref: 'PriveCampaign',
    default: null
  }
}
```

### Migration:
```
No migration script needed.
All existing Store documents: socialCashback will be undefined (not null).
Code must handle: store.socialCashback?.enabled === true (optional chaining)
```

### New index:
```typescript
// Add for finding stores with social cashback enabled:
StoreSchema.index({ 'socialCashback.enabled': 1, isActive: 1 });
// Add BEFORE deploying code that queries by socialCashback.enabled
```

---
---

# PHASE 3 SCHEMA CHANGES

---

## DB-04 · NEW MODEL: PriveCampaign
**File to create:** `rez-backend-master/src/models/PriveCampaign.ts`
**Risk:** New collection — zero impact on existing

### Full schema:
```typescript
import mongoose, { Document, Schema } from 'mongoose';

export interface IPriveCampaign extends Document {
  merchantId:   mongoose.Types.ObjectId;
  title:        string;
  description:  string;
  taskType:     'dine_post' | 'buy_post' | 'visit_post' | 'event_post';
  taskSteps:    string[];
  requirements: {
    minPurchaseAmount: number;
    postTypes:         string[];
    mustTagBrand:      boolean;
    minimumFollowers:  number;
    hashtagRequired:   string;
  };
  reward: {
    coinAmount:      number;
    cashbackPercent: number;
    cashbackCap:     number;
  };
  slots:        number;
  slotsUsed:    number;
  budget:       number;
  budgetUsed:   number;
  validFrom:    Date;
  validTo:      Date;
  status:       'draft' | 'pending_approval' | 'active' | 'paused' | 'completed' | 'rejected';
  minPriveTier: 'entry' | 'signature' | 'elite';
  adminNote:    string;
  approvedBy:   mongoose.Types.ObjectId;
  approvedAt:   Date;
  createdAt:    Date;
  updatedAt:    Date;
}

const PriveCampaignSchema = new Schema<IPriveCampaign>({
  merchantId:   { type: Schema.Types.ObjectId, ref: 'Store', required: true },
  title:        { type: String, required: true, trim: true, maxlength: 100 },
  description:  { type: String, required: true, maxlength: 500 },
  taskType:     { type: String, enum: ['dine_post','buy_post','visit_post','event_post'], required: true },
  taskSteps:    [{ type: String }],
  requirements: {
    minPurchaseAmount: { type: Number, required: true, min: 0 },
    postTypes:         [{ type: String, enum: ['story','reel','post'] }],
    mustTagBrand:      { type: Boolean, default: true },
    minimumFollowers:  { type: Number, default: 500 },
    hashtagRequired:   { type: String, default: '' },
  },
  reward: {
    coinAmount:      { type: Number, required: true, min: 0 },
    cashbackPercent: { type: Number, required: true, min: 0, max: 100 },
    cashbackCap:     { type: Number, required: true, min: 0 },
  },
  slots:        { type: Number, required: true, min: 1 },
  slotsUsed:    { type: Number, default: 0, min: 0 },
  budget:       { type: Number, required: true, min: 0 },
  budgetUsed:   { type: Number, default: 0, min: 0 },
  validFrom:    { type: Date, required: true },
  validTo:      { type: Date, required: true },
  status:       { 
    type: String, 
    enum: ['draft','pending_approval','active','paused','completed','rejected'], 
    default: 'pending_approval' 
  },
  minPriveTier: { type: String, enum: ['entry','signature','elite'], default: 'entry' },
  adminNote:    { type: String, default: '' },
  approvedBy:   { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  approvedAt:   { type: Date },
}, { timestamps: true });

// === INDEXES — CREATE BEFORE FIRST QUERY ===
PriveCampaignSchema.index({ merchantId: 1, status: 1 });
PriveCampaignSchema.index({ status: 1, validTo: 1 });              // find active + not expired
PriveCampaignSchema.index({ minPriveTier: 1, status: 1 });         // tier-filtered campaigns
PriveCampaignSchema.index({ validFrom: 1, validTo: 1 });           // date range queries
PriveCampaignSchema.index({ 'reward.cashbackPercent': -1 });       // sort by reward

// === VALIDATION ===
PriveCampaignSchema.pre('save', function(next) {
  if (this.validFrom >= this.validTo) {
    next(new Error('validFrom must be before validTo'));
  }
  if (this.slotsUsed > this.slots) {
    next(new Error('slotsUsed cannot exceed slots'));
  }
  if (this.budgetUsed > this.budget) {
    next(new Error('budgetUsed cannot exceed budget'));
  }
  next();
});

export const PriveCampaign = mongoose.model<IPriveCampaign>('PriveCampaign', PriveCampaignSchema);
```

### Register in `models/index.ts`:
```typescript
export { PriveCampaign } from './PriveCampaign';
```

---

## DB-05 · NEW MODEL: PrivePostSubmission
**File to create:** `rez-backend-master/src/models/PrivePostSubmission.ts`

### Full schema:
```typescript
import mongoose, { Document, Schema } from 'mongoose';

export interface IPrivePostSubmission extends Document {
  campaignId:       mongoose.Types.ObjectId;
  userId:           mongoose.Types.ObjectId;
  orderId?:         mongoose.Types.ObjectId;
  postUrl:          string;
  postScreenshotUrl: string;
  submittedAt:      Date;
  status:           'joined' | 'pending' | 'approved' | 'rejected' | 'expired';
  reviewedBy?:      mongoose.Types.ObjectId;
  reviewedAt?:      Date;
  rejectionReason?: string;
  rejectionCode?:   string;
  cashbackIssued:   boolean;
  cashbackAmount:   number;
  coinsIssued:      number;
  fraudScore:       number;
  autoFlags:        string[];
  reviewerNote:     string;
  createdAt:        Date;
  updatedAt:        Date;
}

const PrivePostSubmissionSchema = new Schema<IPrivePostSubmission>({
  campaignId:       { type: Schema.Types.ObjectId, ref: 'PriveCampaign', required: true },
  userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
  orderId:          { type: Schema.Types.ObjectId, ref: 'Order' },
  postUrl:          { type: String, required: true, trim: true },
  postScreenshotUrl:{ type: String, required: true },
  submittedAt:      { type: Date, default: Date.now },
  status:           { 
    type: String, 
    enum: ['joined','pending','approved','rejected','expired'], 
    default: 'joined' 
  },
  reviewedBy:       { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  reviewedAt:       { type: Date },
  rejectionReason:  { type: String },
  rejectionCode:    { type: String, enum: ['post_removed','wrong_hashtag','no_brand_tag','minimum_followers_not_met','fraudulent','other'] },
  cashbackIssued:   { type: Boolean, default: false },
  cashbackAmount:   { type: Number, default: 0 },
  coinsIssued:      { type: Number, default: 0 },
  fraudScore:       { type: Number, default: 0, min: 0, max: 100 },
  autoFlags:        [{ type: String }],
  reviewerNote:     { type: String, default: '' },
}, { timestamps: true });

// === INDEXES — CRITICAL: create before any deployment ===

// Unique: one submission per user per campaign
PrivePostSubmissionSchema.index({ campaignId: 1, userId: 1 }, { unique: true });

// Admin review queue
PrivePostSubmissionSchema.index({ status: 1, submittedAt: -1 });

// User's own submissions
PrivePostSubmissionSchema.index({ userId: 1, status: 1 });
PrivePostSubmissionSchema.index({ userId: 1, createdAt: -1 });

// Merchant's campaign submissions
PrivePostSubmissionSchema.index({ campaignId: 1, status: 1, submittedAt: -1 });

// Fraud monitoring
PrivePostSubmissionSchema.index({ fraudScore: -1, status: 1 });

export const PrivePostSubmission = mongoose.model<IPrivePostSubmission>(
  'PrivePostSubmission', 
  PrivePostSubmissionSchema
);
```

### Important: the unique index
```
{ campaignId: 1, userId: 1 } unique: true

This means: one user can only submit ONCE per campaign.
If a user tries to submit twice: MongoDB throws E11000 duplicate key error.
The route controller must catch this and return 400 ALREADY_SUBMITTED.

Test:
db.privepostsubmissions.createIndex(
  { campaignId: 1, userId: 1 }, 
  { unique: true, name: 'campaign_user_unique' }
)
```

---

## DB-06 · RewardEngine: Add 'prive_campaign' to RewardType
**File:** `rez-backend-master/src/core/rewardEngine.ts`

### Change (line 20, additive):
```typescript
// BEFORE:
export type RewardType =
  | 'cashback' | 'referral' | 'game_prize' | 'achievement'
  | ... existing types ...
  | 'pick_approval' | 'program_task';

// AFTER (add one type):
export type RewardType =
  | 'cashback' | 'referral' | 'game_prize' | 'achievement'
  | ... existing types ...
  | 'pick_approval' | 'program_task'
  | 'prive_campaign';   // NEW — for Privé social cashback approvals
```

### No migration needed:
RewardType is a TypeScript union type used for type checking. Existing `CoinTransaction` documents with other rewardType values are unaffected. New transactions with `prive_campaign` type will be created when submissions are approved.

### New CoinTransaction index for reporting:
```typescript
// In CoinTransaction model (models/CoinTransaction.ts) — add if not exists:
CoinTransactionSchema.index({ 'metadata.campaignId': 1 });
// Enables: find all transactions for a specific campaign
```

---
---

# PHASE 4 SCHEMA CHANGES

---

## DB-07 · WalletConfig: Add priveCampaignsEnabled feature flag
**File:** `rez-backend-master/src/models/WalletConfig.ts`

### Current featureFlags block (lines 164-172):
```typescript
featureFlags: {
  offersEnabled:      { type: Boolean, default: true },
  missionsEnabled:    { type: Boolean, default: false },
  conciergeEnabled:   { type: Boolean, default: false },
  smartSpendEnabled:  { type: Boolean, default: true },
  redemptionEnabled:  { type: Boolean, default: true },
  analyticsEnabled:   { type: Boolean, default: true },
  invitesEnabled:     { type: Boolean, default: false },
}
```

### Add new flags (all default false = safe):
```typescript
featureFlags: {
  // ... existing flags unchanged ...
  offersEnabled:            { type: Boolean, default: true },
  missionsEnabled:          { type: Boolean, default: false },
  conciergeEnabled:         { type: Boolean, default: false },
  smartSpendEnabled:        { type: Boolean, default: true },
  redemptionEnabled:        { type: Boolean, default: true },
  analyticsEnabled:         { type: Boolean, default: true },
  invitesEnabled:           { type: Boolean, default: false },
  // NEW FLAGS (all default false — require explicit admin activation):
  priveCampaignsEnabled:    { type: Boolean, default: false },  // Phase 3 social cashback
  bizoneMerchantEnabled:    { type: Boolean, default: false },  // Phase 4 merchant app
  socialCashbackEnabled:    { type: Boolean, default: false },  // Phase 5 mall social cashback
  dailyCheckinEnabled:      { type: Boolean, default: false },  // Phase 6 daily check-in
  mapViewEnabled:           { type: Boolean, default: false },  // Phase 6 map view
}
```

### Migration:
```javascript
// Run in MongoDB shell AFTER schema deploy, BEFORE enabling any feature:
// No migration needed — new Boolean fields with default:false are added transparently
// BUT verify the WalletConfig singleton document gets the new fields:

db.walletconfigs.findOne({singleton: true}).then(doc => {
  // doc.priveProgramConfig.featureFlags.priveCampaignsEnabled === undefined
  // This is fine — the code checks: config?.featureFlags?.priveCampaignsEnabled ?? false
})
```

---

## DB-08 · ServiceAppointment model: verify exists + has indexes
**File:** `rez-backend-master/src/models/ServiceAppointment.ts` (should already exist)

### Check these indexes exist:
```typescript
// Open ServiceAppointment.ts and verify:
ServiceAppointmentSchema.index({ storeId: 1, date: 1, time: 1 });  // slot lookup
ServiceAppointmentSchema.index({ userId: 1, status: 1 });            // user's appointments
ServiceAppointmentSchema.index({ storeId: 1, status: 1, date: 1 }); // merchant view

// If missing, add them now — BEFORE fixing BUG-05 (7 niche pages)
// Booking volume: high. These indexes prevent full collection scans.
```

### Add `coinsEarned` field if missing:
```typescript
coinsEarned: { 
  type: Number, 
  default: 0 
}
// Used by reward engine after Phase 1 BUG-05 fix
```

---

## DB-09 · Coin management: Add admin control fields to WalletConfig
**File:** `rez-backend-master/src/models/WalletConfig.ts`

### Add coin management config section:
```typescript
coinManagement: {
  globalKillSwitch: {
    active:        { type: Boolean, default: false },
    reason:        { type: String, default: '' },
    activatedBy:   { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    activatedAt:   { type: Date },
    expiresAt:     { type: Date },
    pausedTypes:   [{ type: String, enum: ['rez','branded','promo','prive'] }]
  },
  dailyCaps: {
    perUserPerDay:        { type: Number, default: 10000 },   // max coins per user per day
    globalDailyIssuance:  { type: Number, default: 5000000 }, // platform total per day
    perTransactionMax:    { type: Number, default: 2000 },    // per single transaction
  },
  multiplierRules: [{
    name:        String,
    coinType:    { type: String, enum: ['rez','branded','promo','prive'] },
    multiplier:  Number,
    conditions:  String,
    categories:  [String],
    validFrom:   Date,
    validTo:     Date,
    isActive:    { type: Boolean, default: false },
  }]
}
```

### Migration:
```
No migration needed — new section with all defaults.
Existing WalletConfig singleton will not have this section until first save.
Code must check: config?.coinManagement?.globalKillSwitch?.active ?? false
```

---
---

# MIGRATION RUN ORDER

**Run in this exact order — never skip a step:**

```
Step 1: DB-02 (LocationAddress type) — frontend only, no DB migration
Step 2: DB-01 (UserStreak enum) — add 'savings' to enum
         → Create index: UserStreak { user: 1, streakType: 1 }
Step 3: DB-08 (ServiceAppointment indexes) — create missing indexes
Step 4: Deploy Phase 1 bug fixes
         → Test all 8 bug fixes

Step 5: DB-03 (Store socialCashback field) — additive field
         → Create index: Store { 'socialCashback.enabled': 1, isActive: 1 }
Step 6: Deploy Phase 2 location changes

Step 7: DB-06 (RewardEngine type) — TypeScript only, no DB
Step 8: DB-04 (PriveCampaign model) — new collection
         → Create all 5 indexes (run script in Step 12)
Step 9: DB-05 (PrivePostSubmission model) — new collection
         → Create all 6 indexes including unique index
Step 10: DB-07 (WalletConfig featureFlags) — additive fields
Step 11: Deploy Phase 3 Privé backend
Step 12: Run index creation script:
         ```javascript
         // scripts/create-indexes.js
         db.privecampaigns.createIndex({ merchantId: 1, status: 1 });
         db.privecampaigns.createIndex({ status: 1, validTo: 1 });
         db.privecampaigns.createIndex({ minPriveTier: 1, status: 1 });
         db.privepostsubmissions.createIndex({ campaignId: 1, userId: 1 }, { unique: true });
         db.privepostsubmissions.createIndex({ status: 1, submittedAt: -1 });
         db.privepostsubmissions.createIndex({ userId: 1, status: 1 });
         ```
Step 13: SET FEATURE FLAG: priveCampaignsEnabled = true (staging only)
Step 14: Deploy Phase 4 BiZone backend
Step 15: DB-09 (coinManagement config)
Step 16: Deploy admin coin management screens
```

---

# INDEX REFERENCE TABLE

| Collection | Index | Type | Purpose |
|-----------|-------|------|---------|
| userstreaks | `{ user: 1, streakType: 1 }` | compound, unique | One streak per user per type |
| stores | `{ 'socialCashback.enabled': 1, isActive: 1 }` | compound | Social cashback enabled stores |
| privecampaigns | `{ merchantId: 1, status: 1 }` | compound | Merchant's campaigns |
| privecampaigns | `{ status: 1, validTo: 1 }` | compound | Active not-expired campaigns |
| privecampaigns | `{ minPriveTier: 1, status: 1 }` | compound | Tier-filtered campaigns |
| privepostsubmissions | `{ campaignId: 1, userId: 1 }` | **UNIQUE** | Prevent duplicate submissions |
| privepostsubmissions | `{ status: 1, submittedAt: -1 }` | compound | Admin review queue |
| privepostsubmissions | `{ userId: 1, status: 1 }` | compound | User's submissions |
| privepostsubmissions | `{ campaignId: 1, status: 1, submittedAt: -1 }` | compound | Merchant view |
| serviceappointments | `{ storeId: 1, date: 1, time: 1 }` | compound | Slot availability |
| cointransactions | `{ 'metadata.campaignId': 1 }` | single | Campaign ROI reporting |

---

*REZ DB Schema Change Guide (Doc 6) · March 2026*
*9 schema changes · All additive · Full rollback path · Index-first deployment*
