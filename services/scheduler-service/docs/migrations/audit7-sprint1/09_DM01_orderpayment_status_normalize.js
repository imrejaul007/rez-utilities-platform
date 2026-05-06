/**
 * Migration: 09_DM01_orderpayment_status_normalize
 * Bug: DM-01 (06-SCHEMA)
 * Risk: MEDIUM — normalizes payment status values across services
 *
 * Problem: Different services use different payment status string values
 * for OrderPayment.status. This creates cross-service communication issues
 * and data inconsistency.
 *
 * Canonical values:
 *   'pending' | 'awaiting_payment' | 'processing' | 'authorized' |
 *   'paid' | 'partially_refunded' | 'failed' | 'refunded' | 'cancelled'
 *
 * Legacy mappings applied by this migration:
 *   refund_initiated  → partially_refunded
 *   shipping          → dispatched
 *   packed            → preparing
 *   accepted          → confirmed
 *   success           → paid
 *   captured          → paid
 *   pending_capture   → authorized
 *   completed         → paid
 *   initiated         → awaiting_payment
 *
 * Note: 'in_transit' maps to 'out_for_delivery' which is NOT in the
 * canonical list — those records are left unchanged.
 *
 * Applies to: payment.status (string) and payment.status.value (subdoc).
 *
 * Rollback: Restore legacy string values (note: some fidelity loss since
 * multiple legacy values map to the same canonical value).
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://work_db_user:RmptskyDLFNSJGCA@cluster0.ku78x6g.mongodb.net/rez-app?retryWrites=true&w=majority';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const BATCH_SIZE = 500;

// Legacy → canonical status mappings
const LEGACY_TO_CANONICAL = {
  refund_initiated: 'partially_refunded',
  shipping: 'dispatched',
  packed: 'preparing',
  accepted: 'confirmed',
  success: 'paid',
  captured: 'paid',
  pending_capture: 'authorized',
  completed: 'paid',
  initiated: 'awaiting_payment',
};

const CANONICAL_VALUES = new Set([
  'pending', 'awaiting_payment', 'processing', 'authorized',
  'paid', 'partially_refunded', 'failed', 'refunded', 'cancelled',
]);

// For rollback: canonical → most-likely legacy (first mapping wins)
// Only include mappings that are unambiguous
const CANONICAL_TO_LEGACY = {
  'partially_refunded': 'refund_initiated',
  'authorized': 'pending_capture',
  'awaiting_payment': 'initiated',
  'paid': 'success',
};

async function up(client) {
  const db = client.db();
  const orders = db.collection('orders');

  console.log('\n=== PRE-MIGRATION AUDIT ===');

  const totalOrders = await orders.countDocuments();
  console.log(`  Total orders: ${totalOrders}`);

  // --- String status audit ---
  const stringStatusCounts = {};
  for (const legacy of Object.keys(LEGACY_TO_CANONICAL)) {
    const count = await orders.countDocuments({ 'payment.status': legacy });
    if (count > 0) stringStatusCounts[legacy] = count;
  }

  // Also count other non-canonical string statuses
  const allStringStatuses = await orders.aggregate([
    { $match: { 'payment.status': { $type: 'string' } } },
    { $group: { _id: '$payment.status', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  console.log('\n  Payment status distribution (string type):');
  allStringStatuses.forEach(({ _id, count }) => {
    const mapped = LEGACY_TO_CANONICAL[_id];
    const note = mapped ? ` → "${mapped}"` : (CANONICAL_VALUES.has(_id) ? ' (canonical)' : ' (unchanged)');
    console.log(`    "${_id}": ${count}${note}`);
  });

  // --- Subdoc status audit ---
  // payment.status is an object { value, updatedAt, by } — not an array, so no $unwind needed
  const subdocStatuses = await orders.aggregate([
    { $match: { 'payment.status': { $type: 'object' } } },
    { $project: { _id: 1, statusValue: '$payment.status.value' } },
    { $group: { _id: '$statusValue', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  console.log('\n  Payment status distribution (subdoc type):');
  if (subdocStatuses.length === 0) {
    console.log('    (no subdoc status values found)');
  } else {
    subdocStatuses.forEach(({ _id, count }) => {
      const mapped = LEGACY_TO_CANONICAL[_id];
      const note = mapped ? ` → "${mapped}"` : (CANONICAL_VALUES.has(_id) ? ' (canonical)' : ' (unchanged)');
      console.log(`    "${_id}": ${count}${note}`);
    });
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Set DRY_RUN=false to apply normalization.');
    return;
  }

  const now = new Date();
  let totalStringUpdated = 0;
  let totalSubdocUpdated = 0;

  // --- Normalize string statuses ---
  for (const [legacy, canonical] of Object.entries(LEGACY_TO_CANONICAL)) {
    const result = await orders.updateMany(
      { 'payment.status': legacy },
      {
        $set: {
          'payment.status': canonical,
          migratedAt: now,
          migrationId: '09_DM01_orderpayment_status_normalize',
        },
      },
    );
    if (result.modifiedCount > 0) {
      console.log(`  "${legacy}" → "${canonical}": ${result.modifiedCount}`);
      totalStringUpdated += result.modifiedCount;
    }
  }

  // --- Normalize subdoc statuses ---
  for (const [legacy, canonical] of Object.entries(LEGACY_TO_CANONICAL)) {
    const result = await orders.updateMany(
      { 'payment.status.value': legacy },
      {
        $set: {
          'payment.status.value': canonical,
          migratedAt: now,
          migrationId: '09_DM01_orderpayment_status_normalize',
        },
      },
    );
    if (result.modifiedCount > 0) {
      console.log(`  subdoc "${legacy}" → "${canonical}": ${result.modifiedCount}`);
      totalSubdocUpdated += result.modifiedCount;
    }
  }

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`  String statuses updated: ${totalStringUpdated}`);
  console.log(`  Subdoc statuses updated: ${totalSubdocUpdated}`);

  // Verify: count remaining legacy statuses
  let remainingLegacy = 0;
  for (const legacy of Object.keys(LEGACY_TO_CANONICAL)) {
    const stringCount = await orders.countDocuments({ 'payment.status': legacy });
    const subdocCount = await orders.countDocuments({ 'payment.status.value': legacy });
    remainingLegacy += stringCount + subdocCount;
  }
  console.log(`  Remaining legacy statuses: ${remainingLegacy}`);
  if (remainingLegacy > 0) {
    console.log('  WARNING: Some legacy statuses could not be updated.');
  }
}

async function down(client) {
  const db = client.db();
  const orders = db.collection('orders');

  console.log('\n=== ROLLBACK ===');

  if (DRY_RUN) {
    const count = await orders.countDocuments({
      migrationId: '09_DM01_orderpayment_status_normalize',
    });
    console.log(`[DRY RUN] Orders migrated by this script: ${count}`);
    console.log('  Note: Rollback maps canonical → legacy. "paid" maps to "success".');
    console.log('  Multiple legacy values that mapped to the same canonical cannot all be restored.');
    console.log('Set DRY_RUN=false to apply rollback.');
    return;
  }

  let totalRolledBack = 0;

  // Rollback subdoc first (canonical → legacy)
  for (const [canonical, legacy] of Object.entries(CANONICAL_TO_LEGACY)) {
    const result = await orders.updateMany(
      { 'payment.status.value': canonical, migrationId: '09_DM01_orderpayment_status_normalize' },
      {
        $set: { 'payment.status.value': legacy },
        $unset: { migratedAt: '', migrationId: '' },
      },
    );
    totalRolledBack += result.modifiedCount;
  }

  // Rollback string statuses (canonical → legacy)
  for (const [canonical, legacy] of Object.entries(CANONICAL_TO_LEGACY)) {
    const result = await orders.updateMany(
      { 'payment.status': canonical, migrationId: '09_DM01_orderpayment_status_normalize' },
      {
        $set: { 'payment.status': legacy },
        $unset: { migratedAt: '', migrationId: '' },
      },
    );
    totalRolledBack += result.modifiedCount;
  }

  console.log(`  Rolled back: ${totalRolledBack} documents.`);
  console.log('  Note: Some fidelity loss — "paid" was mapped from multiple legacy values.');
}

async function main() {
  const action = process.argv[2] || 'up';
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log(`\n=== Migration: 09_DM01_orderpayment_status_normalize ===`);
    console.log(`Action: ${action}`);
    console.log(`Dry run: ${DRY_RUN}`);

    if (action === 'up') await up(client);
    else if (action === 'down') await down(client);
    else { console.error('Usage: node 09_DM01_...js [up|down]'); process.exit(1); }
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
