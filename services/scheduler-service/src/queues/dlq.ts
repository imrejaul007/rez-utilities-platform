// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

/**
 * Dead Letter Queue (DLQ) module for SCH-03.
 *
 * BullMQ does not ship a built-in DLQ. This module implements one by:
 *   1. Creating a companion `{jobName}-dlq` Queue per job with removeOnFail: false
 *   2. Providing moveToDlq() to enqueue a failed job's full payload into the DLQ
 *   3. Providing getDlqCounts() to expose DLQ depth for monitoring/admin routes
 *
 * All DLQ jobs are added with removeOnFail: false so they persist indefinitely
 * until manually inspected and reprocessed.
 */

import { Queue } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import type { JobName } from '../config/index';

/** Maps jobName → DLQ Queue instance. One DLQ queue per job. */
const dlqMap = new Map<JobName, Queue>();

/**
 * Returns the DLQ queue for the given job, creating it if necessary.
 * DLQ queues have removeOnFail: false so failed jobs persist forever.
 */
export function getOrCreateDlqQueue(jobName: JobName): Queue {
  const existing = dlqMap.get(jobName);
  if (existing) return existing;

  const dlqQueue = new Queue(`${jobName}-dlq`, {
    connection: redis,
    defaultJobOptions: {
      // Never auto-delete failed DLQ entries — they must be manually resolved.
      removeOnComplete: false,
      removeOnFail: false,
    },
  });

  dlqMap.set(jobName, dlqQueue);
  logger.debug(`[DLQ] Created DLQ queue for job: ${jobName}`);

  return dlqQueue;
}

/**
 * Move a permanently-failed job (all retries exhausted) into its DLQ.
 *
 * Captures the full job context needed for later diagnosis or reprocessing:
 *   - originalJobName, originalJobId, originalQueueName
 *   - job.data (the input payload)
 *   - job.opts (job options at time of creation)
 *   - attemptsMade (how many retries were attempted before final failure)
 *   - stackTrace (the final error's stack)
 *   - failedAt (ISO timestamp)
 *
 * @param jobName       The queue/job name (e.g. 'settlementReconciliation')
 * @param originalJob   The BullMQ Job object from the failed event
 * @param finalError    The final Error that caused the job to fail
 * @param attemptsMade  The number of attempts made before final failure (from job.attemptsMade)
 */
export async function moveToDlq(
  jobName: JobName,
  originalJob: { id: string | number | null; data: unknown; opts: Record<string, unknown> },
  finalError: Error,
  attemptsMade: number,
): Promise<void> {
  const dlqQueue = getOrCreateDlqQueue(jobName);
  const dlqJobName = `${jobName}-dlq-${originalJob.id ?? 'unknown'}`;

  const dlqPayload = {
    // ── Origin context ──────────────────────────────────────────────────
    originalJobName: jobName,
    originalJobId: originalJob.id ?? null,
    originalQueueName: jobName,
    // ── Job data (the input that caused/accompanied the failure) ───────
    originalJobData: originalJob.data,
    originalJobOpts: originalJob.opts,
    // ── Failure context ─────────────────────────────────────────────────
    attemptsMade,
    failedErrorMessage: finalError.message,
    failedErrorStack: finalError.stack ?? finalError.message,
    failedAt: new Date().toISOString(),
  };

  await dlqQueue.add(dlqJobName, dlqPayload, {
    removeOnComplete: false,
    removeOnFail: false,
    // No retries — DLQ entries are terminal
  });

  logger.warn(`[DLQ] Job moved to DLQ: ${jobName} [jobId=${originalJob.id ?? 'unknown'}]`, dlqPayload);
}

/**
 * Returns the current counts (waiting + active + failed) for every registered DLQ.
 * Useful for admin routes and health-check monitoring.
 */
export async function getDlqCounts(): Promise<Record<string, { waiting: number; active: number; failed: number; total: number }>> {
  const result: Record<string, { waiting: number; active: number; failed: number; total: number }> = {};

  await Promise.all(
    Array.from(dlqMap.entries()).map(async ([jobName, queue]) => {
      const [waiting, active, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getFailedCount(),
      ]);
      result[jobName] = { waiting, active, failed, total: waiting + active + failed };
    }),
  );

  return result;
}

/**
 * Close all open DLQ connections. Called during graceful shutdown.
 */
export async function closeAllDlqQueues(): Promise<void> {
  await Promise.all(Array.from(dlqMap.values()).map((q) => q.close()));
  dlqMap.clear();
  logger.debug('[DLQ] All DLQ queues closed');
}
