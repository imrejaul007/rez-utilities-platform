/**
 * Migration: 03_SD04_wallet_statistics_backfill
 * Bug: SD-04 (06-SCHEMA)
 * Risk: HIGH — silent data loss; fix write path too
 *
 * Problem: Wallet.statistics fields are zeroed on every wallet-svc write.
 * Fields: totalEarned, totalSpent, totalCashback, transactionCount,
 * totalRefunds, totalTopups, totalWithdrawals get overwritten with zeros.
 *
 * Schema: Wallet.statistics = { totalEarned, totalSpent, totalCashback,
 *   transactionCount, totalRefunds, totalTopups, totalWithdrawals }
 *
 * Fix: Recompute statistics from cointransactions for each wallet.
 * Uses 'user' ObjectId to match wallets to cointransactions.
 *
 * Rollback: Mark statistics as stale for recalculation.
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://work_db_user:RmptskyDLFNSJGCA@cluster0.ku78x6g.mongodb.net/rez-app?retryWrites=true&w=majority';

const BATCH_SIZE = 100;
const DRY_RUN = process.env.DRY_RUN !== 'false';

async function up(client) {
  const db = client.db();
  const wallets = db.collection('wallets');
  const transactions = db.collection('cointransactions');

  console.log('\n=== PRE-MIGRATION AUDIT ===');

  const totalWallets = await wallets.countDocuments();
  console.log(`  Total wallets: ${totalWallets}`);

  // Check zeroed stats
  const zeroedStats = await wallets.countDocuments({
    $or: [
      { 'statistics.totalEarned': { $in: [0, null, undefined] } },
      { 'statistics.totalSpent': { $in: [0, null, undefined] } },
      { 'statistics.transactionCount': { $in: [0, null, undefined] } },
    ],
  });
  console.log(`  Wallets with zeroed/null statistics: ${zeroedStats}`);

  // Sample
  const sample = await wallets.findOne({ 'statistics.totalEarned': 0 });
  if (sample) {
    console.log(`  Sample zeroed wallet: _id=${sample._id}, user=${sample.user}`);
    console.log(`    balance: total=${sample.balance?.total}, available=${sample.balance?.available}`);
    console.log(`    statistics:`, JSON.stringify(sample.statistics));
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Set DRY_RUN=false to apply backfill.');
    return;
  }

  // Get all wallets with their user IDs
  const walletDocs = await wallets.find({}, { projection: { user: 1 } }).toArray();
  let totalUpdated = 0;
  let batchNum = 0;

  for (const wallet of walletDocs) {
    const userId = wallet.user;

    // Aggregate from cointransactions using 'user' field (ObjectId)
    const agg = await transactions.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          totalEarned: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ['$type', 'earned'] }, { $eq: ['$type', 'bonus'] }, { $eq: ['$type', 'branded_award'] }] },
                '$amount',
                0,
              ],
            },
          },
          totalSpent: {
            $sum: { $cond: [{ $eq: ['$type', 'spent'] }, '$amount', 0] },
          },
          totalCashback: {
            $sum: { $cond: [{ $eq: ['$coinType', 'cashback'] }, '$amount', 0] },
          },
          transactionCount: { $sum: 1 },
          totalRefunds: {
            $sum: { $cond: [{ $eq: ['$type', 'refunded'] }, '$amount', 0] },
          },
        },
      },
    ]).toArray();

    if (agg.length === 0) continue;

    const stats = agg[0];
    delete stats._id;

    // Ensure all required fields
    stats.totalTopups = 0;
    stats.totalWithdrawals = 0;

    const result = await wallets.updateOne(
      { _id: wallet._id },
      {
        $set: {
          statistics: stats,
          migratedAt: new Date(),
          migrationId: '03_SD04_wallet_statistics_backfill',
        },
      },
    );

    if (result.modifiedCount > 0) totalUpdated++;

    batchNum++;
    if (batchNum % 100 === 0) {
      console.log(`  Processed ${batchNum}/${walletDocs.length} wallets (${totalUpdated} updated)`);
    }
  }

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`  Wallets processed: ${batchNum}`);
  console.log(`  Wallets updated: ${totalUpdated}`);

  // Verify
  const stillZeroed = await wallets.countDocuments({
    migrationId: '03_SD04_wallet_statistics_backfill',
    $or: [
      { 'statistics.totalEarned': { $in: [0, null] } },
      { 'statistics.totalSpent': { $in: [0, null] } },
    ],
  });
  console.log(`  Wallets still zeroed: ${stillZeroed}`);
}

async function down(client) {
  const db = client.db();
  const wallets = db.collection('wallets');

  console.log('\n=== ROLLBACK ===');

  if (DRY_RUN) {
    const count = await wallets.countDocuments({
      migrationId: '03_SD04_wallet_statistics_backfill',
    });
    console.log(`[DRY RUN] Wallets to mark stale: ${count}`);
    console.log('Set DRY_RUN=false to apply rollback.');
    return;
  }

  const result = await wallets.updateMany(
    { migrationId: '03_SD04_wallet_statistics_backfill' },
    {
      $set: { 'statistics.stale': true },
      $unset: { migratedAt: '', migrationId: '' },
    },
  );
  console.log(`  Marked ${result.modifiedCount} wallets for recomputation.`);
}

async function main() {
  const action = process.argv[2] || 'up';
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log(`\n=== Migration: 03_SD04_wallet_statistics_backfill ===`);
    console.log(`Action: ${action}`);
    console.log(`Dry run: ${DRY_RUN}`);

    if (action === 'up') await up(client);
    else if (action === 'down') await down(client);
    else { console.error('Usage: node 03_SD04_...js [up|down]'); process.exit(1); }
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
