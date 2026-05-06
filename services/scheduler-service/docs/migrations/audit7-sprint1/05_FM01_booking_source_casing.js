/**
 * Migration: 05_FM01_booking_source_casing
 * Bug: FM-01 (07-FORENSIC-ENUM)
 * Risk: MEDIUM — underscore → dot casing for BookingSource enum
 *
 * Problem: BookingSource stored as 'table_booking', 'online_booking', etc.
 * (underscore casing) but the canonical enum uses dot casing:
 * 'table.booking', 'online.booking', 'app.booking', 'web.booking'.
 *
 * Fix: Normalize all booking sources to dot-cased format.
 *
 * Rollback: Restore underscore casing.
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://work_db_user:RmptskyDLFNSJGCA@cluster0.ku78x6g.mongodb.net/rez-app?retryWrites=true&w=majority';

const DRY_RUN = process.env.DRY_RUN !== 'false';

// Mapping: underscore → dot
const UNDERSCORE_TO_DOT = {
  table_booking: 'table.booking',
  online_booking: 'online.booking',
  app_booking: 'app.booking',
  web_booking: 'web.booking',
  phone_booking: 'phone.booking',
  walkin_booking: 'walkin.booking',
  third_party: 'third.party',
  api_booking: 'api.booking',
};

async function up(client) {
  const db = client.db();

  // Find collections that might have booking source
  const collections = ['bookings', 'orders', 'transactions', 'paymentLogs'];
  let totalUpdated = 0;

  for (const collName of collections) {
    const coll = db.collection(collName);

    // Check if source field exists
    const sample = await coll.findOne({ source: { $exists: true } });
    if (!sample) continue;

    console.log(`\n=== Collection: ${collName} ===`);

    // Count by source type
    const dist = await coll.aggregate([
      { $match: { source: { $exists: true } } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();

    console.log(`  Total with source: ${await coll.countDocuments({ source: { $exists: true } })}`);
    console.log('  Distribution:');
    dist.forEach(({ _id, count }) => {
      const willChange = UNDERSCORE_TO_DOT[_id] ? ` → ${UNDERSCORE_TO_DOT[_id]}` : '';
      console.log(`    "${_id}": ${count}${willChange}`);
    });

    if (DRY_RUN) continue;

    // Apply updates
    for (const [underscore, dot] of Object.entries(UNDERSCORE_TO_DOT)) {
      const result = await coll.updateMany(
        { source: underscore },
        {
          $set: {
            source: dot,
            migratedAt: new Date(),
            migrationId: '05_FM01_booking_source_casing',
          },
        },
      );
      if (result.modifiedCount > 0) {
        console.log(`  ${underscore} → ${dot}: ${result.modifiedCount}`);
        totalUpdated += result.modifiedCount;
      }
    }
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Set DRY_RUN=false to apply changes.');
    return;
  }

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`  Total documents updated: ${totalUpdated}`);
}

async function down(client) {
  const db = client.db();
  const DOT_TO_UNDERSCORE = Object.fromEntries(
    Object.entries(UNDERSCORE_TO_DOT).map(([k, v]) => [v, k])
  );

  const collections = ['bookings', 'orders', 'transactions', 'paymentLogs'];
  let totalRolledBack = 0;

  console.log('\n=== ROLLBACK ===');

  if (DRY_RUN) {
    for (const collName of collections) {
      const count = await db.collection(collName).countDocuments({
        migrationId: '05_FM01_booking_source_casing',
      });
      if (count > 0) console.log(`  ${collName}: ${count} to rollback`);
    }
    console.log('Set DRY_RUN=false to apply rollback.');
    return;
  }

  for (const collName of collections) {
    const coll = db.collection(collName);
    for (const [dot, underscore] of Object.entries(DOT_TO_UNDERSCORE)) {
      const result = await coll.updateMany(
        { source: dot, migrationId: '05_FM01_booking_source_casing' },
        {
          $set: { source: underscore },
          $unset: { migratedAt: '', migrationId: '' },
        },
      );
      totalRolledBack += result.modifiedCount;
    }
  }
  console.log(`  Rolled back: ${totalRolledBack}`);
}

async function main() {
  const action = process.argv[2] || 'up';
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log(`\n=== Migration: 05_FM01_booking_source_casing ===`);
    console.log(`Action: ${action}`);
    console.log(`Dry run: ${DRY_RUN}`);

    if (action === 'up') await up(client);
    else if (action === 'down') await down(client);
    else { console.error('Usage: node 05_FM01_...js [up|down]'); process.exit(1); }
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
