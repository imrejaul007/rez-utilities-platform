/**
 * Migration: 07_SD02_wallet_rezbalance_add
 * Bug: SD-02 (06-SCHEMA)
 * Risk: LOW — adds field with default; no data loss
 *
 * Problem: wallet-svc writes do not include the `rezBalance` field on
 * wallet documents, even though the field should track REZ coin balance
 * separately from the generic balance sub-document.
 *
 * Schema: Wallet.balance = { total, available, pending, cashback }
 *         Wallet.rezBalance = Number (to be added)
 *
 * Fix: Backfill rezBalance = balance.total for all wallets where it is
 * missing or null/undefined. This is the source-of-truth REZ coin balance.
 *
 * Rollback: Unset the rezBalance field on wallets migrated by this script.
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://work_db_user:RmptskyDLFNSJGCA@cluster0.ku78x6g.mongodb.net/rez-app?retryWrites=true&w=majority';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const BATCH_SIZE = 500;

async function up(client) {
  const db = client.db();
  const wallets = db.collection('wallets');

  console.log('\n=== PRE-MIGRATION AUDIT ===');

  const totalWallets = await wallets.countDocuments();
  console.log(`  Total wallets: ${totalWallets}`);

  // Count wallets that already have rezBalance
  const withRezBalance = await wallets.countDocuments({
    rezBalance: { $exists: true, $ne: null },
  });
  const withoutRezBalance = await wallets.countDocuments({
    $or: [
      { rezBalance: { $exists: false } },
      { rezBalance: null },
    ],
  });

  console.log(`  Wallets with rezBalance: ${withRezBalance}`);
  console.log(`  Wallets missing rezBalance: ${withoutRezBalance}`);

  // Sample a few wallets that are missing rezBalance to understand balance values
  const samples = await wallets.find(
    { rezBalance: { $exists: false } },
    { projection: { _id: 1, user: 1, 'balance.total': 1, 'balance.available': 1 } },
  ).limit(3).toArray();

  if (samples.length > 0) {
    console.log('\n  Sample wallets missing rezBalance:');
    samples.forEach(s => {
      console.log(`    _id=${s._id} user=${s.user} balance.total=${s.balance?.total} balance.available=${s.balance?.available}`);
    });
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Set DRY_RUN=false to apply backfill.');
    return;
  }

  // Backfill rezBalance = balance.total for all wallets missing it
  const now = new Date();
  let totalUpdated = 0;

  const cursor = wallets.find({
    $or: [
      { rezBalance: { $exists: false } },
      { rezBalance: null },
    ],
  });

  while (await cursor.hasNext()) {
    const batch = [];
    for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
      batch.push(await cursor.next());
    }

    const bulkOps = batch.map(wallet => ({
      updateOne: {
        filter: { _id: wallet._id },
        update: {
          $set: {
            rezBalance: wallet.balance?.total ?? 0,
            migratedAt: now,
            migrationId: '07_SD02_wallet_rezbalance_add',
          },
        },
      },
    }));

    const result = await wallets.bulkWrite(bulkOps, { ordered: false });
    totalUpdated += result.modifiedCount;
  }

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`  Wallets updated: ${totalUpdated}`);

  // Verify
  const stillMissing = await wallets.countDocuments({
    $or: [
      { rezBalance: { $exists: false } },
      { rezBalance: null },
    ],
  });
  const nowHaveRezBalance = await wallets.countDocuments({
    rezBalance: { $exists: true, $ne: null },
  });
  console.log(`  Wallets now have rezBalance: ${nowHaveRezBalance}`);
  console.log(`  Wallets still missing rezBalance: ${stillMissing}`);
}

async function down(client) {
  const db = client.db();
  const wallets = db.collection('wallets');

  console.log('\n=== ROLLBACK ===');

  if (DRY_RUN) {
    const count = await wallets.countDocuments({
      migrationId: '07_SD02_wallet_rezbalance_add',
    });
    console.log(`[DRY RUN] Wallets with migrationId '07_SD02_wallet_rezbalance_add': ${count}`);
    console.log('Set DRY_RUN=false to apply rollback.');
    return;
  }

  const result = await wallets.updateMany(
    { migrationId: '07_SD02_wallet_rezbalance_add' },
    {
      $unset: { rezBalance: '', migratedAt: '', migrationId: '' },
    },
  );
  console.log(`  Unset rezBalance on ${result.modifiedCount} wallets.`);
}

async function main() {
  const action = process.argv[2] || 'up';
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log(`\n=== Migration: 07_SD02_wallet_rezbalance_add ===`);
    console.log(`Action: ${action}`);
    console.log(`Dry run: ${DRY_RUN}`);

    if (action === 'up') await up(client);
    else if (action === 'down') await down(client);
    else { console.error('Usage: node 07_SD02_...js [up|down]'); process.exit(1); }
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
