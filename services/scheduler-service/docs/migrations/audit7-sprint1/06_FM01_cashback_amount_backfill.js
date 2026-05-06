/**
 * Migration: 06_FM01_cashback_amount_backfill
 * Bug: F-M1 (06-FINANCIAL)
 * Risk: MEDIUM — backfill cashbackAmount with calculated paise values
 *
 * Problem: Cashback display shows percentage but stores absolute paise.
 * cashbackAmount field may be missing or stale for existing records.
 *
 * The cashback amount should be: (orderTotal * cashbackPercentage) / 100
 * But sometimes it's stored as raw paise without the percentage metadata.
 *
 * This migration recalculates cashbackAmount for orders where:
 * - cashbackAmount is missing/0
 * - AND cashbackPercentage exists and orderTotal exists
 * Result = orderTotal * cashbackPercentage / 100 (in paise)
 *
 * Rollback: Mark as stale for recalculation.
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://work_db_user:RmptskyDLFNSJGCA@cluster0.ku78x6g.mongodb.net/rez-app?retryWrites=true&w=majority';

const BATCH_SIZE = 500;
const DRY_RUN = process.env.DRY_RUN !== 'false';

async function up(client) {
  const db = client.db();
  const orders = db.collection('orders');

  console.log('\n=== PRE-MIGRATION AUDIT ===');

  const totalOrders = await orders.countDocuments();
  console.log(`  Total orders: ${totalOrders}`);

  // Count orders with missing cashbackAmount
  const missingCashback = await orders.countDocuments({
    cashbackAmount: { $in: [null, undefined, 0] },
    cashbackPercentage: { $exists: true, $gt: 0 },
    totalAmount: { $exists: true, $gt: 0 },
  });
  console.log(`  Orders missing cashbackAmount (can be calculated): ${missingCashback}`);

  // Distribution of cashbackPercentage
  const pctDist = await orders.aggregate([
    {
      $match: {
        cashbackPercentage: { $exists: true, $gt: 0 },
        totalAmount: { $exists: true, $gt: 0 },
      },
    },
    { $group: { _id: '$cashbackPercentage', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]).toArray();
  console.log('  Cashback percentage distribution:');
  pctDist.forEach(({ _id, count }) => {
    console.log(`    ${_id}%: ${count} orders`);
  });

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Sample orders that would be recalculated:');
    const samples = await orders.aggregate([
      {
        $match: {
          cashbackAmount: { $in: [null, undefined, 0] },
          cashbackPercentage: { $exists: true, $gt: 0 },
          totalAmount: { $exists: true, $gt: 0 },
        },
      },
      { $limit: 5 },
      {
        $project: {
          orderId: '$_id',
          totalAmount: 1,
          cashbackPercentage: 1,
          cashbackAmount: 1,
          calculated: {
            $round: [{ $multiply: ['$totalAmount', { $divide: ['$cashbackPercentage', 100] }] }, 0],
          },
        },
      },
    ]).toArray();
    samples.forEach(s => {
      console.log(`  Order ${s.orderId}: total=${s.totalAmount}, ${s.cashbackPercentage}% → ${s.calculated} paise`);
    });
    console.log('\n  Set DRY_RUN=false to apply.');
    return;
  }

  let totalUpdated = 0;
  let cursor = orders.find({
    cashbackAmount: { $in: [null, undefined, 0] },
    cashbackPercentage: { $exists: true, $gt: 0 },
    totalAmount: { $exists: true, $gt: 0 },
  });

  while (await cursor.hasNext()) {
    const batch = [];
    for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
      batch.push(await cursor.next());
    }

    const bulkOps = batch.map(order => {
      const calculated = Math.round((order.totalAmount * order.cashbackPercentage) / 100);
      return {
        updateOne: {
          filter: { _id: order._id },
          update: {
            $set: {
              cashbackAmount: calculated,
              migratedAt: new Date(),
              migrationId: '06_FM01_cashback_amount_backfill',
            },
          },
        },
      };
    });

    const result = await orders.bulkWrite(bulkOps, { ordered: false });
    totalUpdated += result.modifiedCount;
    console.log(`  Updated batch: ${result.modifiedCount} (total: ${totalUpdated})`);
  }

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`  Total orders updated: ${totalUpdated}`);

  const stillMissing = await orders.countDocuments({
    cashbackAmount: { $in: [null, undefined, 0] },
    cashbackPercentage: { $exists: true, $gt: 0 },
    totalAmount: { $exists: true, $gt: 0 },
  });
  console.log(`  Still missing: ${stillMissing}`);
}

async function down(client) {
  const db = client.db();
  const orders = db.collection('orders');

  console.log('\n=== ROLLBACK ===');

  if (DRY_RUN) {
    const count = await orders.countDocuments({
      migrationId: '06_FM01_cashback_amount_backfill',
    });
    console.log(`[DRY RUN] Orders to mark stale: ${count}`);
    console.log('Set DRY_RUN=false to apply rollback.');
    return;
  }

  const result = await orders.updateMany(
    { migrationId: '06_FM01_cashback_amount_backfill' },
    {
      $set: { cashbackAmountStale: true },
      $unset: { migratedAt: '', migrationId: '' },
    },
  );
  console.log(`  Marked ${result.modifiedCount} orders for recalculation.`);
}

async function main() {
  const action = process.argv[2] || 'up';
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log(`\n=== Migration: 06_FM01_cashback_amount_backfill ===`);
    console.log(`Action: ${action}`);
    console.log(`Dry run: ${DRY_RUN}`);

    if (action === 'up') await up(client);
    else if (action === 'down') await down(client);
    else { console.error('Usage: node 06_FM01_...js [up|down]'); process.exit(1); }
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
