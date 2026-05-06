/**
 * Migration: 01_ENUM02_cointransaction_type_lowercase
 * Bug: ENUM-02 (03-ENUMS)
 * Risk: MEDIUM — case normalization affects all coin display
 *
 * Problem: coinType values stored as uppercase strings in the database
 * (e.g., 'CASHBACK', 'REFERRAL', 'REWARD') but code expects lowercase
 * ('cashback', 'referral', 'reward').
 *
 * Fix: Normalize all coinType values to lowercase.
 *
 * Canonical coinType enum: 'rez', 'prive', 'branded', 'promo', 'cashback', 'referral'
 *
 * Rollback: Restore uppercase versions for known types.
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://work_db_user:RmptskyDLFNSJGCA@cluster0.ku78x6g.mongodb.net/rez-app?retryWrites=true&w=majority';

const DRY_RUN = process.env.DRY_RUN !== 'false';

const CANONICAL_TYPES = new Set([
  'rez', 'prive', 'branded', 'promo', 'cashback', 'referral',
]);

async function up(client) {
  const db = client.db();
  const collection = db.collection('cointransactions');

  console.log('\n=== PRE-MIGRATION AUDIT ===');

  const dist = await collection.aggregate([
    { $match: { coinType: { $exists: true } } },
    { $group: { _id: '$coinType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  console.log('  coinType distribution before migration:');
  dist.forEach(({ _id, count }) => {
    const flagged = (!CANONICAL_TYPES.has(_id) && _id !== _id.toLowerCase()) ? ' <-- NON-CANONICAL' :
      (_id !== _id.toLowerCase() ? ' <-- TO LOWERCASE' : '');
    console.log(`    "${_id}": ${count}${flagged}`);
  });

  const needsFixing = dist.filter(d => d._id !== d._id.toLowerCase()).reduce((s, d) => s + d.count, 0);
  console.log(`\n  Documents needing lowercase normalization: ${needsFixing}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Set DRY_RUN=false to apply changes.');
    return;
  }

  let totalUpdated = 0;
  for (const { _id } of dist) {
    if (_id === _id.toLowerCase()) continue; // Already lowercase

    const lower = _id.toLowerCase();
    // Only apply if the lowercase version is a known canonical type
    if (!CANONICAL_TYPES.has(lower)) {
      console.log(`  Skipping "${_id}" → lowercase "${lower}" (not a canonical type)`);
      continue;
    }

    const result = await collection.updateMany(
      { coinType: _id },
      {
        $set: {
          coinType: lower,
          migratedAt: new Date(),
          migrationId: '01_ENUM02_cointransaction_type_lowercase',
        },
      },
    );
    if (result.modifiedCount > 0) {
      totalUpdated += result.modifiedCount;
      console.log(`  ${_id} → ${lower}: ${result.modifiedCount} updated`);
    }
  }

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`  Total updated: ${totalUpdated}`);

  // Verify
  const newDist = await collection.aggregate([
    { $match: { coinType: { $exists: true } } },
    { $group: { _id: '$coinType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();
  console.log('\n  coinType distribution after migration:');
  newDist.forEach(({ _id, count }) => console.log(`    ${_id}: ${count}`));
}

async function down(client) {
  const db = client.db();
  const collection = db.collection('cointransactions');

  console.log('\n=== ROLLBACK ===');

  const UPPER_MAP = {
    rez: 'REZ', prive: 'PRIVE', branded: 'BRANDED',
    promo: 'PROMO', cashback: 'CASHBACK', referral: 'REFERRAL',
  };

  if (DRY_RUN) {
    const count = await collection.countDocuments({
      migrationId: '01_ENUM02_cointransaction_type_lowercase',
    });
    console.log(`[DRY RUN] Documents to rollback: ${count}`);
    console.log('Set DRY_RUN=false to apply rollback.');
    return;
  }

  let totalRolledBack = 0;
  for (const [lower, upper] of Object.entries(UPPER_MAP)) {
    const result = await collection.updateMany(
      { coinType: lower, migrationId: '01_ENUM02_cointransaction_type_lowercase' },
      {
        $set: { coinType: upper },
        $unset: { migratedAt: '', migrationId: '' },
      },
    );
    totalRolledBack += result.modifiedCount;
  }
  console.log(`  Rolled back: ${totalRolledBack}`);
}

async function main() {
  const action = process.argv[2] || 'up';
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log(`\n=== Migration: 01_ENUM02_cointransaction_type_lowercase ===`);
    console.log(`Action: ${action}`);
    console.log(`Dry run: ${DRY_RUN}`);

    if (action === 'up') await up(client);
    else if (action === 'down') await down(client);
    else { console.error('Usage: node 01_ENUM02_...js [up|down]'); process.exit(1); }
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
