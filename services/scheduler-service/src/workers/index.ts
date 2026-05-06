// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import { Worker, Job } from 'bullmq';
import * as Sentry from '@sentry/node';
import { redis } from '../config/redis';
import { config, JobName } from '../config/index';
import { logger } from '../config/logger';
import { ScheduleConfig } from '../models/ScheduleConfig';
import { moveToDlq } from '../queues/dlq';

// Import processors
import { settlementReconciliation, payoutProcessing, invoiceGeneration } from '../processors/settlementProcessor';
import { creditScoreRefresh, loyaltyPointsExpiry, campaignExpiry, abandonedCartReminder, profileRefresh, bnplOverdueProcessing } from '../processors/userEngagementProcessor';
import { expiredOtpCleanup, sessionCleanup, tempFileCleanup, auditLogArchival } from '../processors/cleanupProcessor';
import { merchantAnalyticsRollup, subscriptionRenewalCheck, mandateStatusSync } from '../processors/merchantProcessor';
import { coinExpiryAlerts, digestEmail, pushNotificationBatch } from '../processors/notificationProcessor';

/** Maps each job name to its processor function */
type ProcessorMap = Record<string, (job: Job) => Promise<void>>;
const processorMap: ProcessorMap = {
  'settlement-reconciliation': settlementReconciliation,
  'payout-processing': payoutProcessing,
  'invoice-generation': invoiceGeneration,
  'credit-score-refresh': creditScoreRefresh,
  'profile-refresh': profileRefresh,
  'bnpl-overdue-processing': bnplOverdueProcessing,
  'loyalty-points-expiry': loyaltyPointsExpiry,
  'campaign-expiry': campaignExpiry,
  'abandoned-cart-reminder': abandonedCartReminder,
  'expired-otp-cleanup': expiredOtpCleanup,
  'session-cleanup': sessionCleanup,
  'temp-file-cleanup': tempFileCleanup,
  'audit-log-archival': auditLogArchival,
  'merchant-analytics-rollup': merchantAnalyticsRollup,
  'subscription-renewal-check': subscriptionRenewalCheck,
  'mandate-status-sync': mandateStatusSync,
  'coin-expiry-alerts': coinExpiryAlerts,
  'digest-email': digestEmail,
  'push-notification-batch': pushNotificationBatch,
};

const workers: Worker[] = [];

/**
 * Register all BullMQ workers for scheduled jobs.
 * Each worker listens on its own queue and calls the matching processor.
 */
export function registerAllWorkers(): void {
  const jobNames = Object.keys(config.jobs) as JobName[];

  for (const jobName of jobNames) {
    // FIX 1: Config uses camelCase keys but processorMap uses kebab-case.
    // Convert camelCase jobName to kebab-case for processor lookup.
    const kebabKey = jobName.replace(/([A-Z])/g, '-$1').toLowerCase();
    const processor = processorMap[kebabKey];
    if (!processor) {
      logger.warn(`[Workers] No processor found for job: ${jobName} — skipping`);
      continue;
    }

    // RC-46-6/SCH-02: Explicit retry settings on Worker must match Queue defaults.
    // Previously Worker relied on BullMQ defaults which differed from Queue's
    // configured attempts/backoff, causing inconsistent retry behavior.
    const maxRetries = config.jobs[jobName]?.retries ?? 3;

    // C-28 FIX: Job timeout enforcement - prevent stuck jobs from blocking the queue.
    // lockDuration: 30s lock to detect worker crashes (worker has 30s to process or renew)
    // lockRenewTime: 5s renewal interval to keep lock alive during long jobs
    // stalledInterval: 30s check for stalled jobs (jobs that lost their lock)
    // maxStalledCount: 2 - allow 2 stalled attempts before failing the job
    const worker = new Worker(
      jobName,
      async (job: Job) => {
        logger.info(`[Workers] Processing job: ${jobName}`, { jobId: job.id });
        await processor(job);
      },
      {
        connection: redis,
        concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '') || 5,
        limiter: {
          max: 1,
          duration: 5000,
        },
        // C-28 FIX: Lock settings to prevent stuck jobs
        lockDuration: 30000, // 30 second lock - worker must complete or renew within 30s
        lockRenewTime: 5000, // Renew lock every 5 seconds for jobs that take longer
        stalledInterval: 30000, // Check for stalled jobs every 30 seconds
        maxStalledCount: 2, // Fail job after 2 stalled attempts
        // RC-46-6/SCH-02/SCH-03: backoffStrategy is in settings (BullMQ 5.x).
        // Exponential backoff: 2s, 4s, 6s... capped at 30s. -1 return stops retries.
        settings: {
          backoffStrategy: (attemptsMade: number) => {
            if (attemptsMade >= maxRetries) return -1;
            return Math.min(attemptsMade * 2000, 30000);
          },
        },
        removeOnComplete: { age: 3600 },
        removeOnFail: { count: 100 }, // SCH-03: keep recent failed jobs until DLQ handler moves them out
      },
    );

    worker.on('completed', (job) => {
      logger.info(`[Workers] Job completed: ${jobName}`, { jobId: job?.id });
    });

    // SCH-03 DLQ: detect when all retries are exhausted and move to DLQ.
    // maxRetries is closed over from the worker options above.
    worker.on('failed', async (job, err) => {
      if (!job) {
        logger.error(`[Workers] Job failed but job object unavailable: ${jobName}`, { error: err.message });
        return;
      }

      const isFinalFailure = job.attemptsMade >= maxRetries;

      if (isFinalFailure) {
        // All retries exhausted — move to DLQ with full context.
        try {
          await moveToDlq(jobName as JobName, { id: job.id ?? null, data: job.data, opts: job.opts as unknown as Record<string, unknown> }, err, job.attemptsMade);
        } catch (dlqErr) {
          logger.error(`[Workers] SCH-03 DLQ move failed for ${jobName} [jobId=${job.id}]`, {
            dlqError: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
          });
        }

        // Loud alert: full job context so on-call can diagnose and replay.
        logger.error(
          `[CRITICAL] [SCH-03] Job permanently failed (all retries exhausted) — moved to DLQ: ${jobName}`,
          {
            jobId: job.id,
            jobName,
            attemptsMade: job.attemptsMade,
            maxRetries,
            error: err.message,
            errorStack: err.stack,
            failedAt: new Date().toISOString(),
            // Include the original job data so the job can be replayed from DLQ
            jobData: job.data,
          },
        );

        // Send to Sentry for alerting/monitoring.
        Sentry.withScope((scope) => {
          scope.setTag('service', 'rez-scheduler-service');
          scope.setTag('jobName', jobName);
          scope.setTag('severity', 'critical');
          scope.setContext('job', {
            jobId: String(job.id),
            jobName,
            attemptsMade: job.attemptsMade,
            maxRetries,
            failedAt: new Date().toISOString(),
            originalJobData: JSON.stringify(job.data),
          });
          Sentry.captureException(err, { level: 'fatal' });
        });
      } else {
        // Intermediate retry failure — log at warn level, no DLQ action.
        logger.warn(`[Workers] Job failed (retry ${job.attemptsMade}/${maxRetries}): ${jobName}`, {
          jobId: job.id,
          error: err.message,
          attemptsMade: job.attemptsMade,
          maxRetries,
        });
      }
    });

    worker.on('error', (err) => {
      logger.error(`[Workers] Worker error: ${jobName}`, { error: err.message });
    });

    // C-28 FIX: Stuck job detection and recovery
    // This event fires when BullMQ detects a stalled job (lock expired without renewal)
    worker.on('stalled', (jobId: string) => {
      logger.warn(`[Workers] Job stalled (lock expired without renewal): ${jobName}`, { jobId });
    });

    workers.push(worker);
    logger.debug(`[Workers] Registered worker for: ${jobName}`);
  }

  logger.info(`[Workers] Registered ${workers.length} workers`);
}

/**
 * Schedule repeatable (cron) jobs for all enabled configs.
 * Checks ScheduleConfig in DB — if a job is disabled or has a cronOverride, those are used.
 */
export async function scheduleAllCronJobs(): Promise<void> {
  const { createQueue } = await import('../queues/index');
  const jobNames = Object.keys(config.jobs) as JobName[];

  for (const jobName of jobNames) {
    const jobConfig = config.jobs[jobName];
    if (!jobConfig) continue;

    // Check runtime config
    const scheduleConfig = await ScheduleConfig.findOne({ jobName });
    const enabled = scheduleConfig?.enabled ?? true;
    const cron = scheduleConfig?.cronOverride || jobConfig.cron;

    if (!enabled) {
      logger.info(`[Workers] Job disabled via config: ${jobName}`);
      continue;
    }

    const queue = createQueue(jobName);
    await queue.upsertJobScheduler(
      `${jobName}-scheduler`,
      { pattern: cron },
      {
        name: jobName,
        data: { scheduledAt: new Date().toISOString() },
      },
    );

    // Update nextRunAt in DB
    await ScheduleConfig.findOneAndUpdate(
      { jobName },
      { jobName, enabled, cron },
      { upsert: true },
    );

    logger.info(`[Workers] Scheduled cron: ${jobName} — ${cron}`);
  }
}

/**
 * Gracefully close all workers
 */
export async function closeAllWorkers(): Promise<void> {
  logger.info(`[Workers] Closing ${workers.length} workers...`);
  await Promise.all(workers.map((w) => w.close()));
  logger.info('[Workers] All workers closed');
}
