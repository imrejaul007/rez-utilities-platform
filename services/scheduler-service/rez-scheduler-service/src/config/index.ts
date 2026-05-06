// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
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

  // Job queue configuration
  jobs: {
    // Settlement & Finance (2 jobs)
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
    creditScoreRefresh: {
      cron: '0 3 * * 0',
      description: 'Weekly credit score refresh Sunday 3 AM',
      defaultDelay: 0,
      retries: 2,
      backoffMultiplier: 2,
    },
    loyaltyPointsExpiry: {
      cron: '0 0 * * *',
      description: 'Daily loyalty points expiry check at midnight',
      defaultDelay: 0,
      retries: 3,
      backoffMultiplier: 2,
    },
    campaignExpiry: {
      cron: '*/15 * * * *',
      description: 'Check for expired campaigns every 15 minutes',
      defaultDelay: 0,
      retries: 3,
      backoffMultiplier: 2,
    },
    abandonedCartReminder: {
      cron: '0 */2 * * *',
      description: 'Send abandoned cart reminders every 2 hours',
      defaultDelay: 0,
      retries: 2,
      backoffMultiplier: 2,
    },

    // Cleanup & Maintenance (4 jobs)
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

    // Notifications (2 jobs)
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
      retries: 2,
      backoffMultiplier: 2,
    },
    coinExpiryAlerts: {
      cron: '0 10 * * *',
      description: 'Daily at 10 AM: query wallets for coins expiring within 7 days, emit notification events',
      defaultDelay: 0,
      retries: 2,
      backoffMultiplier: 2,
    },

    // Merchant (3 jobs)
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
      retries: 3,
      backoffMultiplier: 2,
    },
  } as const,

  // Service URLs for inter-service communication
  services: {
    paymentService: process.env.PAYMENT_SERVICE_URL || 'http://rez-payment-service:3008',
    orderService: process.env.ORDER_SERVICE_URL || 'http://rez-order-service:3006',
    walletService: process.env.WALLET_SERVICE_URL || 'http://rez-wallet-service:3009',
    notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://rez-notification-service:3010',
    merchantService: process.env.MERCHANT_SERVICE_URL || 'http://rez-merchant-service:3011',
  },
};

export type JobName = keyof typeof config.jobs;
