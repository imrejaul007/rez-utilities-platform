// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

// FIX 2: Validate INTERNAL_SERVICE_TOKEN at startup — fail fast if missing.
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
if (!INTERNAL_SERVICE_TOKEN) {
  const msg = 'FATAL: INTERNAL_SERVICE_TOKEN environment variable is not set. Scheduler cannot authenticate with downstream services.';
  // eslint-disable-next-line no-console
  console.error(msg);
  throw new Error(msg);
}

export const internalServiceToken: string = INTERNAL_SERVICE_TOKEN;

export const config = {
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // MongoDB configuration
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-scheduler',
  },

  // ── Job queue configuration ────────────────────────────────────────────────
  //
  // Canonical reference: each job triggers a processor in ../processors/*.ts
  // which in turn calls downstream services via config.services URLs.
  //
  // Settlement & Finance → config.services.paymentService, config.services.walletService
  // User & Engagement   → config.services.walletService, config.services.notificationService
  // Cleanup             → local MongoDB operations (no downstream service calls)
  // Merchant            → config.services.merchantService, config.services.paymentService
  // Notifications       → config.services.notificationService
  //
  // All inter-service calls use INTERNAL_SERVICE_TOKEN for authentication.
  // ──────────────────────────────────────────────────────────────────────────
  jobs: {
    // Settlement & Finance (2 jobs)
    // Target: rez-payment-service (settlement reconciliation), rez-wallet-service (balance sync)
    settlementReconciliation: {
      cron: '0 2 * * *',
      description: 'Daily settlement reconciliation at 2 AM',
      defaultDelay: 0,
      retries: 3,
      backoffMultiplier: 2,
    },
    payoutProcessing: {
      cron: '0 10 * * 1-5',
      description: 'Process pending payouts weekdays at 10 AM',
      defaultDelay: 0,
      retries: 3,
      backoffMultiplier: 2,
    },
    invoiceGeneration: {
      cron: '0 0 1 * *',
      description: 'Monthly invoice generation on 1st at midnight',
      defaultDelay: 0,
      retries: 2,
      backoffMultiplier: 2,
    },

    // User & Engagement (4 jobs)
    // Target: rez-wallet-service (loyalty/points), rez-notification-service (reminders)
    creditScoreRefresh: {
      cron: '0 3 * * 0',
      description: 'Weekly credit score refresh Sunday 3 AM',
      defaultDelay: 0,
      retries: 2,
      backoffMultiplier: 2,
    },
    profileRefresh: {
      cron: '0 4 * * 0',
      description: 'Weekly profile engagement refresh Sunday 4 AM',
      defaultDelay: 0,
      retries: 2,
      backoffMultiplier: 2,
    },
    bnplOverdueProcessing: {
      cron: '0 8 * * *',
      description: 'Daily BNPL overdue processing at 8 AM',
      defaultDelay: 0,
      retries: 3,
      backoffMultiplier: 2,
    },
    loyaltyPointsExpiry: {
      cron: '0 0 * * *',
      description: 'Daily loyalty points expiry check at midnight',
      defaultDelay: 0,
      retries: 1,
      backoffMultiplier: 2,
    },
    campaignExpiry: {
      cron: '*/15 * * * *',
      description: 'Check for expired campaigns every 15 minutes',
      defaultDelay: 0,
      retries: 1,
      backoffMultiplier: 1,
    },
    abandonedCartReminder: {
      cron: '0 */2 * * *',
      description: 'Send abandoned cart reminders every 2 hours',
      defaultDelay: 0,
      retries: 2,
      backoffMultiplier: 2,
    },

    // Cleanup & Maintenance (4 jobs)
    // Target: local MongoDB — no downstream service calls
    expiredOtpCleanup: {
      cron: '0 4 * * *',
      description: 'Clean expired OTPs daily at 4 AM',
      defaultDelay: 0,
      retries: 1,
      backoffMultiplier: 1,
    },
    sessionCleanup: {
      cron: '0 5 * * *',
      description: 'Clean expired sessions daily at 5 AM',
      defaultDelay: 0,
      retries: 1,
      backoffMultiplier: 1,
    },
    tempFileCleanup: {
      cron: '0 6 * * 0',
      description: 'Clean temp files weekly Sunday 6 AM',
      defaultDelay: 0,
      retries: 1,
      backoffMultiplier: 1,
    },
    auditLogArchival: {
      cron: '0 1 1 * *',
      description: 'Monthly audit log archival on 1st at 1 AM',
      defaultDelay: 0,
      retries: 2,
      backoffMultiplier: 2,
    },

    // Merchant (3 jobs)
    // Target: rez-merchant-service (analytics, subscriptions), rez-payment-service (Razorpay mandates)
    merchantAnalyticsRollup: {
      cron: '0 1 * * *',
      description: 'Daily merchant analytics aggregation at 1 AM',
      defaultDelay: 0,
      retries: 2,
      backoffMultiplier: 2,
    },
    subscriptionRenewalCheck: {
      cron: '0 8 * * *',
      description: 'Check subscription renewals at 8 AM',
      defaultDelay: 0,
      retries: 2,
      backoffMultiplier: 2,
    },
    mandateStatusSync: {
      cron: '*/30 * * * *',
      description: 'Sync mandate statuses with Razorpay every 30 minutes',
      defaultDelay: 0,
      retries: 2,
      backoffMultiplier: 1,
    },

    // Coin Expiry Alerts (1 job)
    // Target: rez-wallet-service (query expiring coins), rez-notification-service (send alerts)
    coinExpiryAlerts: {
      cron: '0 10 * * *',
      description: 'Daily at 10 AM: query wallets for coins expiring within 7 days, emit notification events',
      defaultDelay: 0,
      retries: 2,
      backoffMultiplier: 2,
      queue: 'notification-events',
    },

    // Notifications (2 jobs)
    // Target: rez-notification-service POST /internal/digest-email, POST /internal/push-batch
    digestEmail: {
      cron: '0 9 * * 1',
      description: 'Weekly digest email Monday 9 AM',
      defaultDelay: 0,
      retries: 2,
      backoffMultiplier: 2,
    },
    pushNotificationBatch: {
      cron: '*/5 * * * *',
      description: 'Process batched push notifications every 5 minutes',
      defaultDelay: 0,
      retries: 1,
      backoffMultiplier: 1,
    },
  } as const,

  // Service URLs for inter-service communication
  services: {
    paymentService: process.env.PAYMENT_SERVICE_URL || 'http://rez-payment-service:3008',
    orderService: process.env.ORDER_SERVICE_URL || 'http://rez-order-service:3006',
    walletService: process.env.WALLET_SERVICE_URL || 'http://rez-wallet-service:3009',
    authService: process.env.AUTH_SERVICE_URL || 'http://rez-auth-service:3005',
    notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://rez-notification-service:3010',
    merchantService: process.env.MERCHANT_SERVICE_URL || 'http://rez-merchant-service:3011',
  },
};

export type JobName = keyof typeof config.jobs;
