#!/usr/bin/env node
/**
 * Migration Runner — Audit 7 Sprint 1
 *
 * Runs all migrations in order. Each migration supports:
 *   node run.js [up|down] [dry-run]
 *
 * Or run a specific migration:
 *   node 00_C2_cointransaction_type_backfill.js up
 *
 * IMPORTANT: Set MONGODB_URI env var or it will use the default.
 * All migrations default to DRY RUN mode for safety.
 *
 * Usage:
 *   node run.js up        # Run all migrations (dry run)
 *   node run.js up real   # Run all migrations for real
 *   node run.js down      # Rollback all (dry run)
 *   node run.js down real # Rollback all for real
 *   node run.js audit     # Run audit only (no changes)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const migrations = [
  '00_C2_cointransaction_typename_backfill',    // coinType backfill for cashback/referral
  '01_ENUM02_cointransaction_type_lowercase',   // coinType uppercase → lowercase
  '02_SD01_transaction_audit_log_dedup',       // deduplicate + normalize schema A/B
  '03_SD04_wallet_statistics_backfill',         // recompute wallet.statistics from transactions
  '04_SD05_order_payment_status_normalize',     // payment.status string → subdoc {value,updatedAt,by}
  '05_FM01_booking_source_casing',              // table_booking → table.booking (underscore → dot)
  '06_FM01_cashback_amount_backfill',           // cashbackAmount from totalAmount × percentage
  '07_SD02_wallet_rezbalance_add',             // add rezBalance = balance.total to wallets missing it
  '08_SD03_wallet_idempotency_index',          // unique sparse index on (idempotencyKey, userId)
  '09_DM01_orderpayment_status_normalize',     // normalize legacy payment statuses to canonical values
];

const dir = __dirname;

function runMigration(name, action, real) {
  return new Promise((resolve) => {
    const file = path.join(dir, `${name}.js`);
    if (!fs.existsSync(file)) {
      console.error(`  File not found: ${file}`);
      resolve({ name, status: 'SKIP (file not found)' });
      return;
    }

    const env = { ...process.env };
    if (!real) env.DRY_RUN = 'true';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Running: ${name} [${action}] ${real ? '(REAL)' : '(DRY RUN)'}`);
    console.log('='.repeat(60));

    const child = spawn('node', [file, action], { env, cwd: dir });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      const status = code === 0 ? 'OK' : 'FAIL';
      console.log(`\n  Result: ${status} (exit ${code})`);
      resolve({ name, status, code, stdout, stderr });
    });

    child.on('error', (err) => {
      console.error(`  Error: ${err.message}`);
      resolve({ name, status: 'ERROR', error: err.message });
    });
  });
}

async function main() {
  const [,, command] = process.argv;
  const action = command === 'down' ? 'down' : 'up';
  const real = process.argv.includes('real');
  const auditOnly = command === 'audit';

  console.log('\n' + '═'.repeat(60));
  console.log('  Audit 7 — Sprint 1 Migration Runner');
  console.log('═'.repeat(60));
  console.log(`  Action: ${action}`);
  console.log(`  Mode: ${auditOnly ? 'AUDIT ONLY (no changes)' : real ? 'REAL (changes will be applied)' : 'DRY RUN (safe)'}`);
  console.log(`  MongoDB: ${process.env.MONGODB_URI ? '(from env)' : 'default URI'}`);
  console.log(`  Migrations: ${migrations.length}`);

  if (auditOnly) {
    console.log('\n--- Running audit on all migrations (DRY RUN) ---\n');
    for (const name of migrations) {
      await runMigration(name, 'up', false);
    }
  } else {
    if (!real) {
      console.log('\n  WARNING: Dry run mode — no changes will be made.');
      console.log('  To apply for real: node run.js up real\n');
    }

    for (const name of migrations) {
      await runMigration(name, action, real);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Migration run complete');
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('Runner failed:', err);
  process.exit(1);
});
