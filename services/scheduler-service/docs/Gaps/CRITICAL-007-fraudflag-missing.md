# CRITICAL-007: FraudFlag Model Missing — All Fraud Events Silently Dropped

## Severity: P0 — Security / Fraud Detection

## Date Discovered: 2026-04-16
## Phase: Phase 7 — Security Validation

---

## Issue Summary

Code references a `FraudFlag` model throughout the codebase for logging and querying fraud events, but the model is never actually defined. All fraud detection logic silently fails — fraud events are created in code but never persisted.

---

## Affected Services

| Service | Impact |
|---------|--------|
| `rez-backend` (monolith) | All fraud flags silently dropped |
| `rez-payment-service` | Payment fraud detection failures invisible |
| `rez-finance-service` | BNPL fraud detection silent failures |

---

## Code Reference

**File:** `rezbackend/rez-backend-master/src/services/fraudDetectionService.ts` (presumed)

```typescript
// Throughout the codebase:
await FraudFlag.create({
  userId,
  type: 'suspicious_order',
  severity: 'high',
  metadata: { /* ... */ }
});

// But FraudFlag is never defined as a Mongoose model
// The create() call silently fails or throws a cryptic error
// No try/catch around these calls — errors are swallowed
```

Search for FraudFlag references across the codebase:
```
rez-backend/src/models/FraudFlag.ts         ← File exists but model not registered
rez-backend/src/services/fraudDetection.ts ← Creates FraudFlag but never defined
rez-payment-service/src/services/fraud.ts  ← References FraudFlag
```

---

## Impact

- **All fraud events are silently lost** — no audit trail
- No fraud analytics or reporting possible
- Repeat offenders cannot be detected
- Fraud patterns cannot be identified
- Payment fraud goes untracked
- BNPL abuse cannot be flagged
- Compliance and regulatory requirements are unmet

---

## Root Cause

The FraudFlag model was likely planned but never implemented. The model file exists but was either:
1. Created but never registered with Mongoose (`mongoose.model()`)
2. Created but never imported in the service files
3. Removed during refactoring but all references were left behind

---

## Verification

```javascript
// Check if FraudFlag model is registered
db.mongoose.models.FraudFlag  // undefined if not registered

// Check if any fraud flags exist in the database
db.fraudflags.countDocuments()  // 0 — always

// Check application logs for FraudFlag errors
db.logs.find({ message: /FraudFlag/ })
```

---

## Fix Required

1. Create and register the FraudFlag model:
   ```typescript
   // src/models/FraudFlag.ts
   import mongoose, { Schema } from 'mongoose';

   const FraudFlagSchema = new Schema({
     userId: { type: String, index: true },
     type: {
       type: String,
       enum: ['suspicious_order', 'chargeback', 'abuse', 'multiple_accounts', 'velocity', 'other'],
       index: true
     },
     severity: {
       type: String,
       enum: ['low', 'medium', 'high', 'critical'],
       index: true
     },
     metadata: { type: Schema.Types.Mixed },
     resolved: { type: Boolean, default: false },
     resolvedBy: { type: String },
     resolvedAt: { type: Date },
     createdAt: { type: Date, default: Date.now },
     updatedAt: { type: Date, default: Date.now }
   }, { timestamps: true });

   FraudFlagSchema.index({ userId: 1, type: 1 });
   FraudFlagSchema.index({ resolved: 1, severity: 1 });

   export const FraudFlag = mongoose.model('FraudFlag', FraudFlagSchema);
   ```

2. Ensure all services import and use the registered model

3. Add error handling around FraudFlag.create() calls:
   ```typescript
   try {
     await FraudFlag.create({ /* ... */ });
   } catch (err) {
     logger.error('FRAUD_FLAG_DROP', { error: err.message, event: /* ... */ });
     // Don't rethrow — fraud detection shouldn't break the main flow
   }
   ```

4. Add alerting for high-severity fraud flags

---

## Related Gaps

- [CRITICAL-008-dual-authority](CRITICAL-008-dual-authority.md) — Fragmented models across services
- [CRITICAL-015-silent-coin-failure](CRITICAL-015-silent-coin-failure.md) — Same pattern: silent failure on service call
