/**
 * Migration: 04_SD05_order_payment_status_normalize
 * Bug: SD-05 (06-SCHEMA)
 * Risk: MEDIUM — normalize payment status sub-document shape
 *
 * Problem: Order.payment.status stored as a string directly in some records
 * but as a sub-document { value, updatedAt, by } in others.
 *
 * Schema A: payment.status = 'pending' (string)
 * Schema B: payment.status = { value: 'pending', updatedAt: Date, by: 'system' }
 *
 * Fix: Normalize all to Schema B sub-document shape.
 * Map string values to canonical sub-document format.
 *
 * Rollback: Flatten back to string (last resort).
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

  // Count string vs subdoc
  const stringStatus = await orders.countDocuments({
    'payment.status': { $type: 'string' },
  });
  const subdocStatus = await orders.countDocuments({
    'payment.status': { $type: 'object' },
  });
  const missingStatus = await orders.countDocuments({
    payment: { $exists: true },
    'payment.status': { $exists: false },
  });

  console.log(`  Orders with string status: ${stringStatus}`);
  console.log(`  Orders with subdoc status: ${subdocStatus}`);
  console.log(`  Orders with payment but no status: ${missingStatus}`);
  console.log(`  Total orders with payment: ${await orders.countDocuments({ payment: { $exists: true } })}`);

  // Show sample string statuses
  const stringSamples = await orders.aggregate([
    { $match: { 'payment.status': { $type: 'string' } } },
    { $limit: 5 },
    { $project: { orderId: '$_id', status: '$payment.status' } },
  ]).toArray();
  if (stringSamples.length > 0) {
    console.log('\n  Sample string statuses:');
    stringSamples.forEach(s => console.log(`    ${s.orderId}: "${s.status}"`));
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Set DRY_RUN=false to apply normalization.');
    return;
  }

  // Normalize string → subdoc
  const validStatuses = [
    'pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled', 'partial',
    'paid', 'success', 'captured', 'authorized', 'awaiting_payment', 'initiated',
    'placed', 'confirmed', 'preparing', 'ready', 'dispatched', 'out_for_delivery',
    'delivered', 'cancelling', 'returned', 'in_progress', 'assigned',
    'partially_refunded', 'refund_initiated',
  ];
  const now = new Date();

  let totalUpdated = 0;
  let cursor = orders.find({
    'payment.status': { $type: 'string' },
  });

  while (await cursor.hasNext()) {
    const batch = [];
    for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
      batch.push(await cursor.next());
    }

    const bulkOps = batch.map(order => {
      const rawStatus = order.payment.status;
      const normalizedStatus = validStatuses.includes(rawStatus) ? rawStatus : 'unknown';
      return {
        updateOne: {
          filter: { _id: order._id },
          update: {
            $set: {
              'payment.status': {
                value: normalizedStatus,
                updatedAt: order.payment.updatedAt || order.createdAt || now,
                by: order.payment.by || 'migration',
              },
              migratedAt: now,
              migrationId: '04_SD05_order_payment_status_normalize',
            },
          },
        },
      };
    });

    const result = await orders.bulkWrite(bulkOps, { ordered: false });
    totalUpdated += result.modifiedCount;
  }

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`  Total normalized: ${totalUpdated}`);

  // Verify
  const stillString = await orders.countDocuments({ 'payment.status': { $type: 'string' } });
  console.log(`  Remaining string statuses: ${stillString}`);
  if (stillString > 0) {
    console.log(`  WARNING: ${stillString} orders still have string status.`);
  }
}

async function down(client) {
  const db = client.db();
  const orders = db.collection('orders');

  console.log('\n=== ROLLBACK ===');

  if (DRY_RUN) {
    const count = await orders.countDocuments({
      migrationId: '04_SD05_order_payment_status_normalize',
    });
    console.log(`[DRY RUN] Orders to rollback: ${count}`);
    console.log('Set DRY_RUN=false to apply rollback.');
    return;
  }

  // Rollback: extract .value from subdoc, preserve it as the string value
  const result = await orders.updateMany(
    { migrationId: '04_SD05_order_payment_status_normalize' },
    [
      {
        $set: {
          'payment.status': { $ifNull: ['$payment.status.value', '$payment.status'] },
        },
      },
      {
        $unset: ['migratedAt', 'migrationId'],
      },
    ],
  );
  console.log(`  Rolled back: ${result.modifiedCount}`);
}

async function main() {
  const action = process.argv[2] || 'up';
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log(`\n=== Migration: 04_SD05_order_payment_status_normalize ===`);
    console.log(`Action: ${action}`);
    console.log(`Dry run: ${DRY_RUN}`);

    if (action === 'up') await up(client);
    else if (action === 'down') await down(client);
    else { console.error('Usage: node 04_SD05_...js [up|down]'); process.exit(1); }
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
