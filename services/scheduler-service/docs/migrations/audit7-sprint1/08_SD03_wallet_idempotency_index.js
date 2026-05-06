/**
 * Migration: 08_SD03_wallet_idempotency_index
 * Bug: SD-03 (06-SCHEMA)
 * Risk: LOW — creates MongoDB index; no data change
 *
 * Problem: wallet-svc uses idempotencyKey to prevent duplicate transaction
 * writes, but there is no unique index enforcing uniqueness. Without an
 * index, concurrent writes with the same idempotencyKey can both succeed,
 * breaking idempotency guarantees.
 *
 * Fix: Create a unique sparse index on { idempotencyKey: 1, userId: 1 }
 * for the wallets collection. The index is sparse so documents without an
 * idempotencyKey are not indexed (and null values from missing fields are
 * also excluded by MongoDB's sparse behaviour).
 *
 * Index name: idempotencyKey_userId_unique
 *
 * Rollback: Drop the index.
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://work_db_user:RmptskyDLFNSJGCA@cluster0.ku78x6g.mongodb.net/rez-app?retryWrites=true&w=majority';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const COLLECTION = 'wallets';
const INDEX_NAME = 'idempotencyKey_userId_unique';

async function up(client) {
  const db = client.db();
  const col = db.collection(COLLECTION);

  console.log('\n=== PRE-MIGRATION AUDIT ===');

  const totalWallets = await col.countDocuments();
  console.log(`  Total wallets: ${totalWallets}`);

  // Count wallets that have idempotencyKey set
  const withIdempotencyKey = await col.countDocuments({
    idempotencyKey: { $exists: true, $ne: null },
  });
  const withoutIdempotencyKey = totalWallets - withIdempotencyKey;
  console.log(`  Wallets with idempotencyKey: ${withIdempotencyKey}`);
  console.log(`  Wallets without idempotencyKey: ${withoutIdempotencyKey}`);

  // Show sample idempotencyKey values
  const samples = await col.find(
    { idempotencyKey: { $exists: true, $ne: null } },
    { projection: { _id: 1, user: 1, idempotencyKey: 1 } },
  ).limit(3).toArray();
  if (samples.length > 0) {
    console.log('\n  Sample wallets with idempotencyKey:');
    samples.forEach(s => {
      console.log(`    _id=${s._id} user=${s.user} idempotencyKey="${s.idempotencyKey}"`);
    });
  }

  // Check for duplicate (idempotencyKey, userId) pairs that would conflict with the unique index
  const duplicates = await col.aggregate([
    { $match: { idempotencyKey: { $exists: true, $ne: null } } },
    { $group: { _id: { idempotencyKey: '$idempotencyKey', userId: '$user' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();

  if (duplicates.length > 0) {
    console.log(`\n  WARNING: Found ${duplicates.length} duplicate (idempotencyKey, userId) pairs!`);
    console.log('  The unique index will fail to create until duplicates are resolved.');
    duplicates.slice(0, 5).forEach(d => {
      console.log(`    idempotencyKey="${d._id.idempotencyKey}" userId=${d._id.userId}: ${d.count} occurrences`);
    });
  } else {
    console.log(`\n  No duplicate (idempotencyKey, userId) pairs found — safe to create index.`);
  }

  // List existing indexes on wallets
  const indexes = await col.indexes();
  console.log('\n  Existing indexes:');
  indexes.forEach(idx => {
    console.log(`    ${idx.name}: ${JSON.stringify(idx.key)} (unique=${idx.unique}, sparse=${idx.sparse})`);
  });

  const indexExists = indexes.some(idx => idx.name === INDEX_NAME);
  if (indexExists) {
    console.log(`\n  Index '${INDEX_NAME}' already exists. Skipping creation.`);
    return;
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Set DRY_RUN=false to create the index.');
    return;
  }

  // Create the unique sparse index using runCommand (MongoDB createIndex)
  const result = await db.command({
    createIndexes: COLLECTION,
    indexes: [
      {
        key: { idempotencyKey: 1, userId: 1 },
        unique: true,
        sparse: true,
        name: INDEX_NAME,
      },
    ],
  });

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`  Index '${INDEX_NAME}' created successfully.`);
  console.log(`  Result:`, result);

  // Verify index was created
  const updatedIndexes = await col.indexes();
  const newIndex = updatedIndexes.find(idx => idx.name === INDEX_NAME);
  if (newIndex) {
    console.log(`  Verified: ${JSON.stringify(newIndex.key)} (unique=${newIndex.unique}, sparse=${newIndex.sparse})`);
  } else {
    console.log('  WARNING: Index not found after creation attempt!');
  }
}

async function down(client) {
  const db = client.db();
  const col = db.collection(COLLECTION);

  console.log('\n=== ROLLBACK ===');

  // Check if index exists first
  const indexes = await col.indexes();
  const indexExists = indexes.some(idx => idx.name === INDEX_NAME);

  if (!indexExists) {
    console.log(`  Index '${INDEX_NAME}' does not exist. Nothing to drop.`);
    return;
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would drop index '${INDEX_NAME}' from collection '${COLLECTION}'.`);
    console.log('Set DRY_RUN=false to apply rollback.');
    return;
  }

  const result = await col.dropIndex(INDEX_NAME);
  console.log(`  Dropped index '${INDEX_NAME}': ${result}`);
}

async function main() {
  const action = process.argv[2] || 'up';
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log(`\n=== Migration: 08_SD03_wallet_idempotency_index ===`);
    console.log(`Action: ${action}`);
    console.log(`Dry run: ${DRY_RUN}`);

    if (action === 'up') await up(client);
    else if (action === 'down') await down(client);
    else { console.error('Usage: node 08_SD03_...js [up|down]'); process.exit(1); }
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
