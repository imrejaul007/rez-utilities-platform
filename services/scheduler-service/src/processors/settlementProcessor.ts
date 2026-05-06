// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import { Job } from 'bullmq';
import axios from 'axios';
import mongoose from 'mongoose';
import { logger } from '../config/logger';
import { JobLog } from '../models/JobLog';
import { ScheduleConfig } from '../models/ScheduleConfig';
import { config } from '../config/index';
import { runWithLock } from '../config/distributedLock';

// FIX (half-refactored state): this file previously mixed an older
// acquireLock()/releaseLock() API with the new runWithLock() helper after
// distributedLock was introduced. The old helpers were deleted from this
// file but three handlers still referenced them — the service would not
// compile / would TypeError at runtime on any scheduled settlement tick.
// All three handlers now go through runWithLock() and D17 safety
// (release-never-throws) is inherited from the helper.

async function logJobStart(jobName: string, jobId: string): Promise<mongoose.Document> {
  const log = new JobLog({
    jobName,
    status: 'running',
    startedAt: new Date(),
    attempts: 0,
    metadata: { bullJobId: jobId },
  });
  await log.save();
  return log;
}

async function logJobComplete(
  logId: mongoose.Types.ObjectId,
  duration: number,
  result?: Record<string, unknown>,
): Promise<void> {
  await JobLog.findByIdAndUpdate(logId, {
    status: 'completed',
    completedAt: new Date(),
    duration,
    result,
  });
}

async function logJobFailed(
  logId: mongoose.Types.ObjectId,
  duration: number,
  error: string,
  stack?: string,
): Promise<void> {
  await JobLog.findByIdAndUpdate(logId, {
    status: 'failed',
    completedAt: new Date(),
    duration,
    error,
    errorStack: stack,
  });
}

async function updateScheduleConfig(jobName: string, success: boolean): Promise<void> {
  if (success) {
    await ScheduleConfig.findOneAndUpdate(
      { jobName },
      {
        lastRunAt: new Date(),
        $inc: { runCount: 1 },
      },
      { upsert: true },
    );
  } else {
    await ScheduleConfig.findOneAndUpdate(
      { jobName },
      {
        $inc: { failCount: 1 },
      },
      { upsert: true },
    );
  }
}

/**
 * Shared wrapper so each handler is just a body — lock acquisition, job-log
 * bookkeeping, schedule-config counters, and duration metrics all live in
 * one place.
 *
 * If the lock isn't acquired (another pod holds it), the body is skipped
 * silently. If the body throws, we log the failure and rethrow so BullMQ
 * can retry per its attempts config. The release path inside runWithLock()
 * never throws (D17 guard), so a transient Redis hiccup on lock release
 * can't re-fire an already-successful settlement.
 */
async function runFinancialJob(
  jobName: string,
  job: Job,
  body: () => Promise<Record<string, unknown> | void>,
): Promise<void> {
  // SCH-04 FIX: Check return value to create audit trail for skipped jobs
  const acquired = await runWithLock(jobName, async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart(jobName, job.id || '');
    try {
      logger.info(`[Settlement] Starting ${jobName}`);
      const result = await body();
      const duration = Date.now() - startTime;
      await logJobComplete(
        logEntry._id as mongoose.Types.ObjectId,
        duration,
        result ?? undefined,
      );
      await updateScheduleConfig(jobName, true);
      logger.info(`[Settlement] ${jobName} completed`, { duration, ...result });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id as mongoose.Types.ObjectId, duration, error, stack);
      await updateScheduleConfig(jobName, false);
      logger.error(`[Settlement] ${jobName} failed`, { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    // SCH-04 FIX: Create a skipped audit entry so skipped jobs are distinguishable
    // from jobs that were never triggered
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
    const response = await axios.post(
      `${config.services.paymentService}/api/internal/reconcile`,
      { type: 'daily-settlement' },
      {
        headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '' },
        timeout: 30000,
      },
    );
    return { reconciliationId: response.data.id };
  });
}

export async function payoutProcessing(job: Job): Promise<void> {
  return runFinancialJob('payout-processing', job, async () => {
    const response = await axios.post(
      `${config.services.paymentService}/api/internal/payouts/process`,
      { autoProcess: true },
      {
        headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '' },
        timeout: 30000,
      },
    );
    return { payoutsProcessed: response.data.count };
  });
}

export async function invoiceGeneration(job: Job): Promise<void> {
  return runFinancialJob('invoice-generation', job, async () => {
    const response = await axios.post(
      `${config.services.paymentService}/api/internal/invoices/generate`,
      { month: new Date().toISOString().slice(0, 7) },
      {
        headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '' },
        timeout: 30000,
      },
    );
    return { invoicesGenerated: response.data.count };
  });
}
