// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
/**
 * Merchant Processors (SCH-09/13)
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

// ─── Response schemas (SCH-13) ────────────────────────────────────────────────

const AnalyticsRollupResponse = z.object({ count: z.number() });
type AnalyticsRollupResponse = z.infer<typeof AnalyticsRollupResponse>;

const SubscriptionRenewalResponse = z.object({ count: z.number() });
type SubscriptionRenewalResponse = z.infer<typeof SubscriptionRenewalResponse>;

const MandateSyncResponse = z.object({ count: z.number() });
type MandateSyncResponse = z.infer<typeof MandateSyncResponse>;

export async function merchantAnalyticsRollup(job: Job): Promise<void> {
  const acquired = await runWithLock('merchant-analytics-rollup', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('merchant-analytics-rollup', job.id || '');

    try {
      logger.info('[Merchant] Starting daily merchant analytics aggregation');

      // SCH-13: check response.status before accessing data
      const response = await internalClient().post<AnalyticsRollupResponse>(
        `${config.services.merchantService}/api/internal/analytics/rollup`,
        { period: 'daily' },
        { timeout: 60000 },
      );

      if (response.status !== 200) {
        throw new Error(`merchantAnalyticsRollup received unexpected status ${response.status}`);
      }

      const parsed = AnalyticsRollupResponse.safeParse(response.data);
      if (!parsed.success) {
        throw new Error(`merchantAnalyticsRollup Zod validation failed: ${parsed.error.message}`);
      }

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { merchantsProcessed: parsed.data.count });
      await updateScheduleConfig('merchant-analytics-rollup', true);

      logger.info('[Merchant] Merchant analytics rollup completed', { count: parsed.data.count, duration });
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

      // SCH-13: check response.status before accessing data
      const response = await internalClient().post<SubscriptionRenewalResponse>(
        `${config.services.merchantService}/api/internal/subscriptions/check-renewals`,
        { autoRenew: true },
        { timeout: 30000 },
      );

      if (response.status !== 200) {
        throw new Error(`subscriptionRenewalCheck received unexpected status ${response.status}`);
      }

      const parsed = SubscriptionRenewalResponse.safeParse(response.data);
      if (!parsed.success) {
        throw new Error(`subscriptionRenewalCheck Zod validation failed: ${parsed.error.message}`);
      }

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { subscriptionsProcessed: parsed.data.count });
      await updateScheduleConfig('subscription-renewal-check', true);

      logger.info('[Merchant] Subscription renewal check completed', { count: parsed.data.count, duration });
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

      // SCH-13: check response.status before accessing data
      const response = await internalClient().post<MandateSyncResponse>(
        `${config.services.paymentService}/api/internal/mandates/sync`,
        { provider: 'razorpay' },
        { timeout: 30000 },
      );

      if (response.status !== 200) {
        throw new Error(`mandateStatusSync received unexpected status ${response.status}`);
      }

      const parsed = MandateSyncResponse.safeParse(response.data);
      if (!parsed.success) {
        throw new Error(`mandateStatusSync Zod validation failed: ${parsed.error.message}`);
      }

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { mandatesSynced: parsed.data.count });
      await updateScheduleConfig('mandate-status-sync', true);

      logger.info('[Merchant] Mandate status sync completed', { count: parsed.data.count, duration });
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
