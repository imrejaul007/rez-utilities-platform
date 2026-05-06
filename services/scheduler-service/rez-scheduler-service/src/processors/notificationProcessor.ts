// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
/**
 * Notification Processors (SCH-05/09/11/13)
 *
 * SCH-05: coinExpiryAlerts — idempotency key (job.id + runId) + pagination loop
 * SCH-09: import shared job runner utilities from src/lib/jobRunner
 * SCH-11: paginated bulk-processing via fetchAllPages
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
import { config } from '../config/index';

// ─── Response schemas (SCH-13) ────────────────────────────────────────────────

const DigestSendResponse = z.object({
  sent: z.number(),
  skipped: z.number().optional(),
});
type DigestSendResponse = z.infer<typeof DigestSendResponse>;

const PushBatchResponse = z.object({
  sent: z.number(),
  failed: z.number(),
});
type PushBatchResponse = z.infer<typeof PushBatchResponse>;

const CoinExpiryResponse = z.object({
  items: z.array(z.unknown()),
  totalPages: z.number(),
  currentPage: z.number(),
  pageSize: z.number(),
  hasNextPage: z.boolean().optional(),
});
type CoinExpiryResponse = z.infer<typeof CoinExpiryResponse>;

const CoinNotifyResponse = z.object({
  sent: z.number(),
});
type CoinNotifyResponse = z.infer<typeof CoinNotifyResponse>;

// ─── Shared internal headers (SCH-13) ───────────────────────────────────────

const svcHeaders = (): Record<string, string> => ({
  'X-Service-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
});

// ─── Digest Email ─────────────────────────────────────────────────────────────

/**
 * Send weekly digest emails to users (Monday 9 AM)
 */
export async function digestEmail(job: Job): Promise<void> {
  const startTime = Date.now();
  const logEntry = await logJobStart('digest-email', job.id || '');

  try {
    logger.info('[Notification] Starting weekly digest email');

    // SCH-13: check response.status before accessing data
    const response = await internalClient().post<DigestSendResponse>(
      `${config.services.notificationService}/api/internal/digest/send`,
      {
        type: 'weekly',
        targetDate: new Date().toISOString().slice(0, 10),
      },
      { timeout: 60000 },
    );

    if (response.status !== 200) {
      throw new Error(`digestEmail received unexpected status ${response.status}`);
    }

    const parsed = DigestSendResponse.safeParse(response.data);
    if (!parsed.success) {
      throw new Error(`digestEmail Zod validation failed: ${parsed.error.message}`);
    }

    const duration = Date.now() - startTime;
    await logJobComplete(logEntry._id, duration, {
      emailsSent: parsed.data.sent,
      skipped: parsed.data.skipped,
    });
    await updateScheduleConfig('digest-email', true);

    logger.info('[Notification] Digest email completed', {
      sent: parsed.data.sent,
      duration,
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    const error = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    await logJobFailed(logEntry._id, duration, error, stack);
    await updateScheduleConfig('digest-email', false);
    logger.error('[Notification] Digest email failed', { error, duration });
    throw err;
  }
}

// ─── Push Notification Batch ─────────────────────────────────────────────────

/**
 * Process batched push notifications every 5 minutes
 */
export async function pushNotificationBatch(job: Job): Promise<void> {
  const startTime = Date.now();
  const logEntry = await logJobStart('push-notification-batch', job.id || '');

  try {
    logger.info('[Notification] Starting push notification batch');

    // SCH-13: check response.status before accessing data
    const response = await internalClient().post<PushBatchResponse>(
      `${config.services.notificationService}/api/internal/push/batch`,
      { batchSize: 500 },
      { timeout: 30000 },
    );

    if (response.status !== 200) {
      throw new Error(`pushNotificationBatch received unexpected status ${response.status}`);
    }

    const parsed = PushBatchResponse.safeParse(response.data);
    if (!parsed.success) {
      throw new Error(`pushNotificationBatch Zod validation failed: ${parsed.error.message}`);
    }

    const duration = Date.now() - startTime;
    await logJobComplete(logEntry._id, duration, {
      notificationsSent: parsed.data.sent,
      failed: parsed.data.failed,
    });
    await updateScheduleConfig('push-notification-batch', true);

    logger.info('[Notification] Push notification batch completed', {
      sent: parsed.data.sent,
      failed: parsed.data.failed,
      duration,
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    const error = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    await logJobFailed(logEntry._id, duration, error, stack);
    await updateScheduleConfig('push-notification-batch', false);
    logger.error('[Notification] Push notification batch failed', { error, duration });
    throw err;
  }
}

// ─── Coin Expiry Alerts (SCH-05 / SCH-11) ────────────────────────────────────

/**
 * Daily coin expiry alerts (SCH-05):
 *   - Idempotency key: "coin-expiry-alerts:{runId}"
 *   - Paginated loop through all expiring coins
 *
 * SCH-11: processes all pages of expiring coins, batching them for notification.
 */
export async function coinExpiryAlerts(job: Job): Promise<void> {
  const startTime = Date.now();
  const logEntry = await logJobStart('coin-expiry-alerts', job.id || '');
  const runId = newRunId();

  // SCH-05: Idempotency — prevent duplicate execution within the same runId
  const idempotencyKey = `scheduler:idempotency:coin-expiry-alerts:${runId}`;
  const claimed = await tryClaimIdempotency(idempotencyKey);
  if (!claimed) {
    logger.info('[Notification] coinExpiryAlerts skipped — already processed in this run', { runId });
    await logJobComplete(logEntry._id, Date.now() - startTime, { skipped: 'idempotency' });
    return;
  }

  try {
    logger.info('[Notification] Starting coin expiry alerts', { runId });

    // SCH-05 + SCH-11: Paginated fetch of all expiring coins
    const allExpiringCoins: unknown[] = [];
    let page = 1;
    let hasNextPage = true;
    const pageSize = 100;

    while (hasNextPage) {
      const walletResponse = await internalClient().get<CoinExpiryResponse>(
        `${config.services.walletService}/api/internal/coins/expiring`,
        {
          params: { withinDays: 7, page, pageSize },
          timeout: 60000,
        },
      );

      if (walletResponse.status !== 200) {
        throw new Error(`coinExpiryAlerts wallet fetch returned status ${walletResponse.status}`);
      }

      const parsed = CoinExpiryResponse.safeParse(walletResponse.data);
      if (!parsed.success) {
        throw new Error(`coinExpiryAlerts wallet response Zod validation failed: ${parsed.error.message}`);
      }

      if (parsed.data.items.length === 0) {
        break;
      }

      allExpiringCoins.push(...parsed.data.items);
      hasNextPage = parsed.data.hasNextPage ?? false;
      page++;

      if (page > 100) {
        logger.warn('[Notification] coinExpiryAlerts safety cap reached (100 pages)', { runId });
        break;
      }
    }

    if (allExpiringCoins.length === 0) {
      const duration = Date.now() - startTime;
      await logJobComplete(logEntry._id, duration, { alertsSent: 0, coinsExpiring: 0, pagesProcessed: page - 1 });
      await updateScheduleConfig('coin-expiry-alerts', true);
      logger.info('[Notification] No expiring coins found', { runId, duration });
      return;
    }

    // Send notifications in batches
    const batchSize = 500;
    let totalSent = 0;
    for (let i = 0; i < allExpiringCoins.length; i += batchSize) {
      const batch = allExpiringCoins.slice(i, i + batchSize);

      // SCH-13: check response.status before accessing data
      const notifResponse = await internalClient().post<CoinNotifyResponse>(
        `${config.services.notificationService}/api/internal/coin-expiry/notify`,
        { expiringCoins: batch },
        { timeout: 60000 },
      );

      if (notifResponse.status !== 200) {
        throw new Error(`coinExpiryAlerts notify returned status ${notifResponse.status}`);
      }

      const parsed = CoinNotifyResponse.safeParse(notifResponse.data);
      if (!parsed.success) {
        throw new Error(`coinExpiryAlerts notify response Zod validation failed: ${parsed.error.message}`);
      }

      totalSent += parsed.data.sent;
    }

    const duration = Date.now() - startTime;
    await logJobComplete(logEntry._id, duration, {
      alertsSent: totalSent,
      coinsExpiring: allExpiringCoins.length,
      pagesProcessed: page - 1,
    });
    await updateScheduleConfig('coin-expiry-alerts', true);

    logger.info('[Notification] Coin expiry alerts completed', {
      sent: totalSent,
      coinsExpiring: allExpiringCoins.length,
      pagesProcessed: page - 1,
      duration,
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    const error = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    await logJobFailed(logEntry._id, duration, error, stack);
    await updateScheduleConfig('coin-expiry-alerts', false);
    logger.error('[Notification] Coin expiry alerts failed', { runId, error, duration });
    throw err;
  }
}
