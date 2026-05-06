# Karma by ReZ — Batch Conversion System

## 1. Overview

Manual batch conversion (admin-triggered) is the Phase 1 approach. Every Sunday at 23:59, the system creates batches from all `APPROVED_PENDING_CONVERSION` EarnRecords and waits for admin execution.

## 2. End-to-End Flow

```
User completes event
    ↓
NGO approves attendance (BizOS)
    ↓
Karma Engine creates EarnRecord
status = APPROVED_PENDING_CONVERSION
    ↓
Queued into Weekly Batch
    ↓
Admin reviews batch → triggers conversion
    ↓
ReZ Wallet credited
    ↓
Records marked CONVERTED (immutable)
```

## 3. Batch Cron Job (Sunday 23:59)

```typescript
// workers/batchScheduler.ts
import { CronJob } from 'cron';
import { createWeeklyBatch } from '../services/batchService';

const job = new CronJob('59 23 * * 0', async () => {
  console.log('[BatchScheduler] Creating weekly batches...');
  try {
    const batches = await createWeeklyBatch();
    console.log(`[BatchScheduler] Created ${batches.length} batches`);
  } catch (err) {
    console.error('[BatchScheduler] Error:', err);
  }
});

job.start();
```

```typescript
// services/batchService.ts
async function createWeeklyBatch(): Promise<Batch[]> {
  const weekEnd = new Date();
  const weekStart = moment(weekEnd).subtract(7, 'days').startOf('day').toDate();
  const weekEndStr = moment(weekEnd).startOf('day').toDate();

  // Get all pending records grouped by CSR pool
  const pendingRecords = await EarnRecord.aggregate([
    {
      $match: {
        status: 'APPROVED_PENDING_CONVERSION',
        approvedAt: { $gte: weekStart, $lt: weekEndStr },
      }
    },
    {
      $group: {
        _id: '$csrPoolId',
        records: { $push: '$_id' },
        totalKarma: { $sum: '$karmaEarned' },
        totalCoinsEstimated: {
          $sum: { $multiply: ['$karmaEarned', '$conversionRateSnapshot'] }
        },
        count: { $sum: 1 },
      }
    }
  ]);

  const batches: Batch[] = [];

  for (const group of pendingRecords) {
    // Check pool availability
    const pool = await CSRPool.findById(group._id);
    if (!pool || pool.coinPoolRemaining < group.totalCoinsEstimated) {
      // Partial batch: cap at pool remaining
      const cappedCoins = pool?.coinPoolRemaining || 0;
      await partialBatch(group, cappedCoins);
      continue;
    }

    const batch = new Batch({
      weekStart,
      weekEnd: weekEndStr,
      csrPoolId: group._id,
      totalEarnRecords: group.count,
      totalKarma: group.totalKarma,
      totalRezCoinsEstimated: Math.floor(group.totalCoinsEstimated),
      totalRezCoinsExecuted: 0,
      status: 'READY',
      anomalyFlags: [],
    });

    await batch.save();

    // Mark earn records as belonging to this batch
    await EarnRecord.updateMany(
      { _id: { $in: group.records } },
      { $set: { batchId: batch._id } }
    );

    batches.push(batch);
  }

  return batches;
}
```

## 4. Admin Preview (Before Execute)

```typescript
// routes/batchRoutes.ts
router.get('/batch/:id/preview', requireAdmin, async (req, res) => {
  const batch = await Batch.findById(req.params.id)
    .populate('csrPoolId')
    .populate('earnRecords');

  // Apply caps per user
  const preview = batch.earnRecords.map(record => {
    const coins = Math.floor(record.karmaEarned * record.conversionRateSnapshot);
    const cappedCoins = Math.min(coins, 300); // weekly cap
    return { ...record, estimatedCoins: coins, cappedCoins };
  });

  const totalEstimated = preview.reduce((sum, r) => sum + r.estimatedCoins, 0);
  const totalCapped = preview.reduce((sum, r) => sum + r.cappedCoins, 0);
  const poolRemaining = batch.csrPoolId.coinPoolRemaining;

  // Check anomaly flags
  const anomalies = await checkBatchAnomalies(batch);

  res.json({
    batchId: batch._id,
    status: batch.status,
    week: { start: batch.weekStart, end: batch.weekEnd },
    summary: {
      totalRecords: preview.length,
      totalKarma: batch.totalKarma,
      totalEstimated: totalEstimated,
      totalCapped: totalCapped,
      poolRemaining,
      exceedsPool: totalCapped > poolRemaining,
    },
    anomalies,
    records: preview.slice(0, 50), // top 50 for review
  });
});
```

## 5. Execute Batch

```typescript
router.post('/batch/:id/execute', requireAdmin, async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) { res.status(404).json({ success: false, message: 'Batch not found' }); return; }
  if (batch.status === 'EXECUTED') { res.status(400).json({ success: false, message: 'Already executed' }); return; }

  const results = { success: 0, failed: 0, errors: [] as string[] };

  try {
    const records = await EarnRecord.find({ batchId: batch._id, status: 'APPROVED_PENDING_CONVERSION' });

    for (const record of records) {
      try {
        const coins = Math.floor(record.karmaEarned * record.conversionRateSnapshot);
        const cappedCoins = Math.min(coins, 300); // per-user weekly cap

        // Idempotency key: batch_execute_{batchId}_{recordId}
        const idempotencyKey = `batch_execute_${batch._id}_${record._id}`;

        // Check if already credited (idempotent)
        const existing = await EarnRecord.findOne({ idempotencyKey, status: 'CONVERTED' });
        if (existing) {
          results.success++;
          continue;
        }

        // Call ReZ Wallet service
        await walletService.credit({
          userId: record.userId.toString(),
          amount: cappedCoins,
          coinType: 'rez_coins',
          source: 'karma_conversion',
          referenceId: record._id.toString(),
          referenceModel: 'EarnRecord',
          description: `Karma conversion: ${record.karmaEarned} pts × ${record.conversionRateSnapshot * 100}%`,
          idempotencyKey,
        });

        // Mark as converted
        record.status = 'CONVERTED';
        record.convertedAt = new Date();
        record.convertedBy = req.adminId;
        record.rezCoinsEarned = cappedCoins;
        record.idempotencyKey = idempotencyKey;
        record.save();

        // Decrement CSR pool
        await CSRPool.updateOne(
          { _id: batch.csrPoolId },
          { $inc: { coinPoolRemaining: -cappedCoins, issuedCoins: cappedCoins } }
        );

        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Record ${record._id}: ${err.message}`);
      }
    }

    // Update batch
    batch.status = results.failed > 0 ? 'PARTIAL' : 'EXECUTED';
    batch.totalRezCoinsExecuted = results.success * 300; // avg
    batch.executedAt = new Date();
    batch.executedBy = req.adminId;
    await batch.save();

    // Send notifications to users
    await notifyUsersOfConversion(records.filter(r => r.status === 'CONVERTED'));

    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message, results });
  }
});
```

## 6. Guardrails

### Pool Check
```typescript
// Before execute: verify pool has sufficient coins
const pool = await CSRPool.findById(batch.csrPoolId);
if (pool.coinPoolRemaining < batch.totalRezCoinsEstimated) {
  // Block execution, show warning
  return { blocked: true, reason: 'INSUFFICIENT_POOL', needed: batch.totalRezCoinsEstimated, available: pool.coinPoolRemaining };
}
```

### Per-User Weekly Cap
```typescript
async function getWeeklyKarmaUsed(userId: ObjectId, weekOf: Date): Promise<number> {
  const weekStart = moment(weekOf).startOf('isoWeek').toDate();
  const weekEnd = moment(weekOf).endOf('isoWeek').toDate();

  const result = await EarnRecord.aggregate([
    {
      $match: {
        userId,
        status: 'CONVERTED',
        convertedAt: { $gte: weekStart, $lt: weekEnd },
      }
    },
    { $group: { _id: null, total: { $sum: '$rezCoinsEarned' } } }
  ]);

  return result[0]?.total || 0;
}
```

### Anomaly Detection on Batch
```typescript
async function checkBatchAnomalies(batch: Batch): Promise<AnomalyFlag[]> {
  const records = await EarnRecord.find({ batchId: batch._id });
  const flags: AnomalyFlag[] = [];

  // Flag 1: Too many from one NGO
  const ngoCounts = await EarnRecord.aggregate([
    { $match: { batchId: batch._id } },
    { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
    { $unwind: '$event' },
    { $group: { _id: '$event.ngoId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 50 } } } // >50 from same NGO in one week
  ]);
  if (ngoCounts.length > 0) {
    flags.push({ type: 'too_many_from_one_ngo', count: ngoCounts.length, resolved: false });
  }

  // Flag 2: Suspicious timestamps (identical timestamps across many records)
  const timestampCounts = await EarnRecord.aggregate([
    { $match: { batchId: batch._id } },
    { $group: { _id: '$approvedAt', count: { $sum: 1 } } },
    { $match: { count: { $gt: 10 } } }
  ]);
  if (timestampCounts.length > 0) {
    flags.push({ type: 'suspicious_timestamps', count: timestampCounts.length, resolved: false });
  }

  // Flag 3: Pool shortage
  const pool = await CSRPool.findById(batch.csrPoolId);
  if (pool && pool.coinPoolRemaining < batch.totalRezCoinsEstimated) {
    flags.push({ type: 'pool_shortage', count: 1, resolved: false });
  }

  return flags;
}
```

## 7. User-Facing Status UX

### Phase 1: After NGO Approval
- Status: **"Approved · Awaiting weekly rewards"**
- ETA: "Rewards processed every Sunday"

### Phase 1: After Batch Execution
- Push + in-app notification: "+150 ReZ Coins from your impact this week"
- My Karma screen shows transaction history

## 8. Edge Cases

### Late Approvals (After Batch Cut-off)
- EarnRecord created → included in next batch (FIFO)
- No special handling needed

### Pool Shortage During Execution
- Partial execution: remaining EarnRecords stay `APPROVED_PENDING_CONVERSION`
- Rolled to next week's batch automatically
- Admin notified of partial execution

### Decay Between Approval and Conversion
- **Rate snapshot at approval** — fair, no post-hoc decay
- `conversionRateSnapshot` captured and stored in EarnRecord at creation time

### Kill Switch
```typescript
router.post('/batch/kill-switch', requireAdmin, async (req, res) => {
  const { reason } = req.body;

  await Batch.updateMany(
    { status: 'READY' },
    { $set: { status: 'PAUSED', pauseReason: reason, pausedAt: new Date() } }
  );

  await AuditLog.create({
    action: 'KILL_SWITCH',
    adminId: req.adminId,
    reason,
    timestamp: new Date(),
  });

  res.json({ success: true, message: 'Kill switch activated. Pending batches paused.' });
});
```

## 9. Audit Log

Every conversion action is logged:
```typescript
{
  action: 'BATCH_EXECUTE',
  batchId,
  adminId,
  timestamp,
  recordsProcessed: number,
  recordsSuccess: number,
  recordsFailed: number,
  totalCoinsIssued: number,
  totalKarmaConverted: number,
}
```
