/**
 * Migration: 02_SD01_transaction_audit_log_dedup
 * Bug: SD-01 (06-SCHEMA)
 * Risk: HIGH — migration + code change; deduplicates writes
 *
 * Problem: Two incompatible TransactionAuditLog schemas write to the
 * same collection. Deduplication needed before schema fix can deploy.
 *
 * The two schemas differ:
 *   - Schema A: { entityType, entityId, action, userId, metadata, createdAt }
 *   - Schema B: { refType, refId, operation, actorId, data, timestamp }
 *
 * Fix: Normalize all records to the canonical schema (Schema A).
 * Deduplicate: Remove duplicate entries keeping the most recent by createdAt.
 *
 * Rollback: Restore all deleted duplicates (not possible without backup).
 *   A backup collection is created before deletion.
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://work_db_user:RmptskyDLFNSJGCA@cluster0.ku78x6g.mongodb.net/rez-app?retryWrites=true&w=majority';

const COLLECTION = 'transactionAuditLogs';
const BACKUP_COLLECTION = 'transactionAuditLogs_backup_SD01';
const DRY_RUN = process.env.DRY_RUN !== 'false';

async function up(client) {
  const db = client.db();
  const col = db.collection(COLLECTION);

  console.log('\n=== PRE-MIGRATION AUDIT ===');

  // Detect schema A vs B by checking field presence
  const schemaACount = await col.countDocuments({ entityType: { $exists: true } });
  const schemaBCount = await col.countDocuments({ refType: { $exists: true } });
  const unknownCount = await col.countDocuments({
    entityType: { $exists: false },
    refType: { $exists: false },
  });

  console.log(`  Schema A (entityType/entityId): ${schemaACount}`);
  console.log(`  Schema B (refType/refId): ${schemaBCount}`);
  console.log(`  Unknown schema: ${unknownCount}`);
  console.log(`  Total records: ${await col.countDocuments()}`);

  if (schemaBCount === 0) {
    console.log('  No Schema B records found. Deduplication only needed.');
  }

  // Normalize Schema B → Schema A
  if (schemaBCount > 0 && !DRY_RUN) {
    const normalizeResult = await col.updateMany(
      { refType: { $exists: true } },
      [
        {
          $set: {
            entityType: '$refType',
            entityId: '$refId',
            action: '$operation',
            userId: '$actorId',
            metadata: '$data',
            createdAt: { $ifNull: ['$timestamp', '$createdAt', new Date()] },
            migratedAt: new Date(),
            migrationId: '02_SD01_transaction_audit_log_dedup',
          },
        },
        {
          $unset: ['refType', 'refId', 'operation', 'actorId', 'data', 'timestamp'],
        },
      ],
    );
    console.log(`  Normalized Schema B → A: ${normalizeResult.modifiedCount}`);
  }

  // Deduplication
  console.log('\n=== DEDUPLICATION ===');

  // Build deduplication key: entityType + entityId + action + userId
  // Group by key, keep record with latest createdAt
  const duplicates = await col.aggregate([
    {
      $group: {
        _id: {
          entityType: '$entityType',
          entityId: '$entityId',
          action: '$action',
          userId: '$userId',
        },
        count: { $sum: 1 },
        docs: { $push: { _id: '$_id', createdAt: '$createdAt' } },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();

  const totalDupeGroups = duplicates.length;
  let totalDuplicates = duplicates.reduce((sum, g) => sum + g.count - 1, 0);

  console.log(`  Duplicate groups: ${totalDupeGroups}`);
  console.log(`  Total duplicate records: ${totalDuplicates}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Sample duplicate groups:');
    duplicates.slice(0, 3).forEach(group => {
      console.log(`  ${group._id.entityType}/${group._id.entityId}/${group._id.action}: ${group.count} records`);
    });
    console.log('\n  Set DRY_RUN=false to apply deduplication.');
    return;
  }

  // Create backup before deleting
  console.log('\n  Creating backup collection...');
  await col.aggregate([{ $out: BACKUP_COLLECTION }]);
  console.log(`  Backup saved to: ${BACKUP_COLLECTION}`);

  // Delete duplicates: for each group, delete all but the record with latest createdAt
  let totalDeleted = 0;
  for (const group of duplicates) {
    const sorted = group.docs.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    const keepId = sorted[0]._id;
    const deleteIds = sorted.slice(1).map(d => d._id);

    const result = await col.deleteMany({ _id: { $in: deleteIds } });
    totalDeleted += result.deletedCount;
  }

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`  Total duplicates removed: ${totalDeleted}`);
  console.log(`  Backup collection: ${BACKUP_COLLECTION}`);
  console.log(`  Remaining records: ${await col.countDocuments()}`);

  // Verify no duplicates remain
  const remainingDupes = await col.aggregate([
    {
      $group: {
        _id: { entityType: '$entityType', entityId: '$entityId', action: '$action', userId: '$userId' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();
  console.log(`  Remaining duplicate groups: ${remainingDupes.length}`);
}

async function down(client) {
  const db = client.db();
  const col = db.collection(COLLECTION);
  const backup = db.collection(BACKUP_COLLECTION);

  console.log('\n=== ROLLBACK ===');

  if (DRY_RUN) {
    const backupCount = await backup.countDocuments();
    console.log(`[DRY RUN] Backup collection has ${backupCount} records.`);
    console.log('Set DRY_RUN=false to restore from backup.');
    return;
  }

  // Restore from backup
  await col.deleteMany({});
  const restored = await backup.aggregate([{ $out: COLLECTION }]).toArray();
  const count = await col.countDocuments();
  console.log(`  Restored ${count} records from backup.`);
}

async function main() {
  const action = process.argv[2] || 'up';
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log(`\n=== Migration: 02_SD01_transaction_audit_log_dedup ===`);
    console.log(`Action: ${action}`);
    console.log(`Dry run: ${DRY_RUN}`);

    if (action === 'up') await up(client);
    else if (action === 'down') await down(client);
    else { console.error('Usage: node 02_SD01_...js [up|down]'); process.exit(1); }
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
