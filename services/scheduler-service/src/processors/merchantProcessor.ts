// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import { Job } from 'bullmq';
import axios from 'axios';
import mongoose from 'mongoose';
import { logger } from '../config/logger';
import { JobLog } from '../models/JobLog';
import { ScheduleConfig } from '../models/ScheduleConfig';
import { config } from '../config/index';
import { runWithLock } from '../config/distributedLock';

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

async function logJobComplete(logId: mongoose.Types.ObjectId, duration: number, result?: Record<string, unknown>): Promise<void> {
  await JobLog.findByIdAndUpdate(logId, {
    status: 'completed',
    completedAt: new Date(),
    duration,
    result,
  });
}

async function logJobFailed(logId: mongoose.Types.ObjectId, duration: number, error: string, stack?: string): Promise<void> {
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

// RC-46-3/RC-46-9: All merchant processors now use distributed locks
// to prevent duplicate execution across multiple scheduler pods.

export async function merchantAnalyticsRollup(job: Job): Promise<void> {
  const acquired = await runWithLock('merchant-analytics-rollup', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('merchant-analytics-rollup', job.id || '');

    try {
      logger.info('[Merchant] Starting daily merchant analytics aggregation');

      const response = await axios.post(
        `${config.services.merchantService}/api/internal/analytics/rollup`,
        { period: 'daily' },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 60000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { merchantsProcessed: response.data.count });
      await updateScheduleConfig('merchant-analytics-rollup', true);

      logger.info('[Merchant] Merchant analytics rollup completed', { count: response.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('merchant-analytics-rollup', false);
      logger.error('[Merchant] Merchant analytics rollup failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[Merchant] Skipping merchant-analytics-rollup — lock held by another instance');
  }
}

export async function subscriptionRenewalCheck(job: Job): Promise<void> {
  const acquired = await runWithLock('subscription-renewal-check', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('subscription-renewal-check', job.id || '');

    try {
      logger.info('[Merchant] Checking subscription renewals');

      const response = await axios.post(
        `${config.services.merchantService}/api/internal/subscriptions/check-renewals`,
        { autoRenew: true },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 30000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { subscriptionsProcessed: response.data.count });
      await updateScheduleConfig('subscription-renewal-check', true);

      logger.info('[Merchant] Subscription renewal check completed', { count: response.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('subscription-renewal-check', false);
      logger.error('[Merchant] Subscription renewal check failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[Merchant] Skipping subscription-renewal-check — lock held by another instance');
  }
}

export async function mandateStatusSync(job: Job): Promise<void> {
  const acquired = await runWithLock('mandate-status-sync', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('mandate-status-sync', job.id || '');

    try {
      logger.info('[Merchant] Syncing mandate statuses with Razorpay');

      const response = await axios.post(
        `${config.services.paymentService}/api/internal/mandates/sync`,
        { provider: 'razorpay' },
        {
          headers: {
            'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
          timeout: 30000,
        },
      );

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { mandatesSynced: response.data.count });
      await updateScheduleConfig('mandate-status-sync', true);

      logger.info('[Merchant] Mandate status sync completed', { count: response.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('mandate-status-sync', false);
      logger.error('[Merchant] Mandate status sync failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[Merchant] Skipping mandate-status-sync — lock held by another instance');
  }
}
