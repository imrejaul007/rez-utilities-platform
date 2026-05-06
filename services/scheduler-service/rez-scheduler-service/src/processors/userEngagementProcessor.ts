// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
/**
 * User Engagement Processors (SCH-07/09/13)
 *
 * SCH-07: loyaltyPointsExpiry — add idempotency key (runId) + distributed lock
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
  newRunId,
  tryClaimIdempotency,
} from '../lib/jobRunner';
import { runWithLock } from '../config/distributedLock';
import { config } from '../config/index';

// ─── Response schemas (SCH-13) ────────────────────────────────────────────────

const CreditScoreResponse = z.object({ count: z.number() });
type CreditScoreResponse = z.infer<typeof CreditScoreResponse>;

const LoyaltyExpireResponse = z.object({ count: z.number() });
type LoyaltyExpireResponse = z.infer<typeof LoyaltyExpireResponse>;

const CampaignExpireResponse = z.object({ count: z.number() });
type CampaignExpireResponse = z.infer<typeof CampaignExpireResponse>;

const CartReminderResponse = z.object({ count: z.number() });
type CartReminderResponse = z.infer<typeof CartReminderResponse>;

// ─── Credit Score Refresh ──────────────────────────────────────────────────────

export async function creditScoreRefresh(job: Job): Promise<void> {
  const startTime = Date.now();
  const logEntry = await logJobStart('credit-score-refresh', job.id || '');

  try {
    logger.info('[UserEngagement] Starting weekly credit score refresh');

    // SCH-13: check response.status before accessing data
    const response = await internalClient().post<CreditScoreResponse>(
      `${config.services.walletService}/api/internal/credit-scores/refresh`,
      { batchSize: 1000 },
      { timeout: 60000 },
    );

    if (response.status !== 200) {
      throw new Error(`creditScoreRefresh received unexpected status ${response.status}`);
    }

    const parsed = CreditScoreResponse.safeParse(response.data);
    if (!parsed.success) {
      throw new Error(`creditScoreRefresh Zod validation failed: ${parsed.error.message}`);
    }

    const duration = Date.now() - startTime;
    await logJobComplete(logEntry._id, duration, { usersRefreshed: parsed.data.count });
    await updateScheduleConfig('credit-score-refresh', true);

    logger.info('[UserEngagement] Credit score refresh completed', { count: parsed.data.count, duration });
  } catch (err) {
    const duration = Date.now() - startTime;
    const error = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    await logJobFailed(logEntry._id, duration, error, stack);
    await updateScheduleConfig('credit-score-refresh', false);
    logger.error('[UserEngagement] Credit score refresh failed', { error, duration });
    throw err;
  }
}

// ─── Loyalty Points Expiry (SCH-07) ───────────────────────────────────────────

/**
 * Daily loyalty points expiry check (SCH-07):
 *   - Idempotency key: "loyalty-points-expiry:{runId}"
 *   - Distributed lock (SCH-07)
 *   - Config retries: 3 (SCH-07)
 */
export async function loyaltyPointsExpiry(job: Job): Promise<void> {
  const acquired = await runWithLock('loyalty-points-expiry', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('loyalty-points-expiry', job.id || '');
    const runId = newRunId();

    // SCH-07: Idempotency key using runId
    const idempotencyKey = `scheduler:idempotency:loyalty-points-expiry:${runId}`;
    const claimed = await tryClaimIdempotency(idempotencyKey);
    if (!claimed) {
      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { skipped: 'idempotency' });
      await updateScheduleConfig('loyalty-points-expiry', true);
      logger.info('[UserEngagement] loyaltyPointsExpiry skipped — already processed in this run', { runId });
      return;
    }

    try {
      logger.info('[UserEngagement] Starting loyalty points expiry check', { runId });

      // SCH-13: check response.status before accessing data
      const response = await internalClient().post<LoyaltyExpireResponse>(
        `${config.services.walletService}/api/internal/loyalty/expire-points`,
        { dryRun: false },
        { timeout: 30000 },
      );

      if (response.status !== 200) {
        throw new Error(`loyaltyPointsExpiry received unexpected status ${response.status}`);
      }

      const parsed = LoyaltyExpireResponse.safeParse(response.data);
      if (!parsed.success) {
        throw new Error(`loyaltyPointsExpiry Zod validation failed: ${parsed.error.message}`);
      }

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { pointsExpired: parsed.data.count });
      await updateScheduleConfig('loyalty-points-expiry', true);

      logger.info('[UserEngagement] Loyalty points expiry check completed', { runId, count: parsed.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('loyalty-points-expiry', false);
      logger.error('[UserEngagement] Loyalty points expiry failed', { runId, error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[UserEngagement] Skipping loyalty-points-expiry — lock held by another instance');
  }
}

// ─── Campaign Expiry ───────────────────────────────────────────────────────────

export async function campaignExpiry(job: Job): Promise<void> {
  const acquired = await runWithLock('campaign-expiry', async () => {
    const startTime = Date.now();
    const logEntry = await logJobStart('campaign-expiry', job.id || '');

    try {
      logger.info('[UserEngagement] Checking for expired campaigns');

      // SCH-13: check response.status before accessing data
      const response = await internalClient().post<CampaignExpireResponse>(
        `${config.services.merchantService}/api/internal/campaigns/expire`,
        { autoExpire: true },
        { timeout: 30000 },
      );

      if (response.status !== 200) {
        throw new Error(`campaignExpiry received unexpected status ${response.status}`);
      }

      const parsed = CampaignExpireResponse.safeParse(response.data);
      if (!parsed.success) {
        throw new Error(`campaignExpiry Zod validation failed: ${parsed.error.message}`);
      }

      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { campaignsExpired: parsed.data.count });
      await updateScheduleConfig('campaign-expiry', true);

      logger.info('[UserEngagement] Campaign expiry check completed', { count: parsed.data.count, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      await logJobFailed(logEntry._id, duration, error, stack);
      await updateScheduleConfig('campaign-expiry', false);
      logger.error('[UserEngagement] Campaign expiry check failed', { error, duration });
      throw err;
    }
  });

  if (!acquired) {
    logger.info('[UserEngagement] Skipping campaign-expiry — lock held by another instance');
  }
}

// ─── Abandoned Cart Reminder ──────────────────────────────────────────────────

export async function abandonedCartReminder(job: Job): Promise<void> {
  const startTime = Date.now();
  const logEntry = await logJobStart('abandoned-cart-reminder', job.id || '');

  try {
    logger.info('[UserEngagement] Sending abandoned cart reminders');

    // SCH-13: check response.status before accessing data
    const response = await internalClient().post<CartReminderResponse>(
      `${config.services.orderService}/api/internal/carts/send-reminders`,
      { hoursThreshold: 2 },
      { timeout: 30000 },
    );

    if (response.status !== 200) {
      throw new Error(`abandonedCartReminder received unexpected status ${response.status}`);
    }

    const parsed = CartReminderResponse.safeParse(response.data);
    if (!parsed.success) {
      throw new Error(`abandonedCartReminder Zod validation failed: ${parsed.error.message}`);
    }

    const duration = Date.now() - startTime;
    await logJobComplete(logEntry._id, duration, { remindersSent: parsed.data.count });
    await updateScheduleConfig('abandoned-cart-reminder', true);

    logger.info('[UserEngagement] Abandoned cart reminders sent', { count: parsed.data.count, duration });
  } catch (err) {
    const duration = Date.now() - startTime;
    const error = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    await logJobFailed(logEntry._id, duration, error, stack);
    await updateScheduleConfig('abandoned-cart-reminder', false);
    logger.error('[UserEngagement] Abandoned cart reminder failed', { error, duration });
    throw err;
  }
}
