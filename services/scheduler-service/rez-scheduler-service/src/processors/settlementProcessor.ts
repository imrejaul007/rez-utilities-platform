// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
/**
 * Settlement Processors (SCH-09/13)
 *
 * SCH-09: import shared job runner utilities from src/lib/jobRunner
 * SCH-13: Zod validation + response.status checks on all downstream calls
 */
import { Job } from 'bullmq';
import { z } from 'zod';
import { logger, internalClient } from '../lib/jobRunner';
import {
  logJobStart,
  logJobComplete,
  logJobFailed,
  updateScheduleConfig,
} from '../lib/jobRunner';
import { runWithLock } from '../config/distributedLock';
import { config } from '../config/index';
import { JobLog } from '../models/JobLog';

// ─── Response schemas (SCH-13) ────────────────────────────────────────────────

const ReconcileResponse = z.object({ id: z.string() });
type ReconcileResponse = z.infer<typeof ReconcileResponse>;

const PayoutProcessResponse = z.object({ count: z.number() });
type PayoutProcessResponse = z.infer<typeof PayoutProcessResponse>;

const InvoiceGenerateResponse = z.object({ count: z.number() });
type InvoiceGenerateResponse = z.infer<typeof InvoiceGenerateResponse>;

/**
 * Shared wrapper: lock acquisition, job-log bookkeeping, schedule-config counters,
 * and duration metrics all in one place. SCH-14 TTL of 1800s inherited from
 * distributedLock.
 */
async function runFinancialJob(
  jobName: string,
  job: Job,
  body: () => Promise<Record<string, unknown> | void>,
): Promise<void> {
  const acquired = await runWithLock(jobName, async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart(jobName, job.id || '');
    try {
      logger.info(`[Settlement] Starting ${jobName}`);
      const result = await body();
      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, result ?? undefined);
      await updateScheduleConfig(jobName, true);
      logger.info(`[Settlement] ${jobName} completed`, { duration, ...(result ?? {}) });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig(jobName, false);
      logger.error(`[Settlement] ${jobName} failed`, { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    await JobLog.create({
      jobName,
      status: 'skipped',
      reason: 'lock-held',
      startedAt: new Date(),
      completedAt: new Date(),
      metadata: { bullJobId: job.id },
    });
    logger.warn(`[Settlement] ${jobName} skipped (lock held)`, { jobId: job.id });
  }
}

export async function settlementReconciliation(job: Job): Promise<void> {
  return runFinancialJob('settlement-reconciliation', job, async () => {
    // SCH-13: check response.status before accessing data
    const response = await internalClient().post<ReconcileResponse>(
      `${config.services.paymentService}/api/internal/reconcile`,
      { type: 'daily-settlement' },
      { timeout: 30000 },
    );

    if (response.status !== 200) {
      throw new Error(`settlementReconciliation received unexpected status ${response.status}`);
    }

    const parsed = ReconcileResponse.safeParse(response.data);
    if (!parsed.success) {
      throw new Error(`settlementReconciliation Zod validation failed: ${parsed.error.message}`);
    }

    return { reconciliationId: parsed.data.id };
  });
}

export async function payoutProcessing(job: Job): Promise<void> {
  return runFinancialJob('payout-processing', job, async () => {
    // SCH-13: check response.status before accessing data
    const response = await internalClient().post<PayoutProcessResponse>(
      `${config.services.paymentService}/api/internal/payouts/process`,
      { autoProcess: true },
      { timeout: 30000 },
    );

    if (response.status !== 200) {
      throw new Error(`payoutProcessing received unexpected status ${response.status}`);
    }

    const parsed = PayoutProcessResponse.safeParse(response.data);
    if (!parsed.success) {
      throw new Error(`payoutProcessing Zod validation failed: ${parsed.error.message}`);
    }

    return { payoutsProcessed: parsed.data.count };
  });
}

export async function invoiceGeneration(job: Job): Promise<void> {
  return runFinancialJob('invoice-generation', job, async () => {
    // SCH-13: check response.status before accessing data
    const response = await internalClient().post<InvoiceGenerateResponse>(
      `${config.services.paymentService}/api/internal/invoices/generate`,
      { month: new Date().toISOString().slice(0, 7) },
      { timeout: 30000 },
    );

    if (response.status !== 200) {
      throw new Error(`invoiceGeneration received unexpected status ${response.status}`);
    }

    const parsed = InvoiceGenerateResponse.safeParse(response.data);
    if (!parsed.success) {
      throw new Error(`invoiceGeneration Zod validation failed: ${parsed.error.message}`);
    }

    return { invoicesGenerated: parsed.data.count };
  });
}
