// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import 'dotenv/config';
import * as Sentry from '@sentry/node';

process.env.SERVICE_NAME = process.env.SERVICE_NAME || 'rez-scheduler-service';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    serverName: process.env.SERVICE_NAME,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  });
}

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb';
import { redis } from './config/redis';
import { startHealthServer } from './health';
import { registerAllWorkers, closeAllWorkers, scheduleAllCronJobs } from './workers';
import { registerAllQueues } from './queues';
import adminRoutes from './routes/adminRoutes';
import { logger } from './config/logger';
import { tracingMiddleware } from './middleware/tracing';

function validateEnv(): void {
  const required = [
    'MONGODB_URI',
    'REDIS_URL',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error(`[FATAL] Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  // JWT_SECRET is required for admin routes
  if (!process.env.JWT_SECRET) {
    logger.error('[FATAL] JWT_SECRET not set — admin routes will be unprotected. Exiting.');
    process.exit(1);
  }
  if (!process.env.INTERNAL_SERVICE_TOKENS_JSON && !process.env.INTERNAL_SERVICE_TOKEN) {
    logger.error('[FATAL] No service auth configured — admin routes will not be authenticated. Exiting.');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  validateEnv();
  logger.info('Starting rez-scheduler-service...');

  await connectMongoDB();

  // Register all BullMQ queues
  registerAllQueues();

  const app = express();
  if (process.env.SENTRY_DSN) app.use(Sentry.Handlers.requestHandler());
  app.use(helmet());
  app.use(cors({ origin: (process.env.CORS_ORIGIN || 'https://rez.money').split(',').map((s) => s.trim()) }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // W3C traceparent propagation — before routes
  app.use(tracingMiddleware);

  // Routes
  app.use('/api/scheduler', adminRoutes);

  if (process.env.SENTRY_DSN) app.use(Sentry.Handlers.errorHandler());

  // Global error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error('Unhandled error', { error: message, stack });
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  // Start servers
  const port = parseInt(process.env.PORT || '3012', 10);
  const healthPort = parseInt(process.env.HEALTH_PORT || '3112', 10);

  const server = app.listen(port, () => {
    logger.info(`HTTP server on :${port}`);
  });

  const healthServer = startHealthServer(healthPort);

  // Register all BullMQ workers
  registerAllWorkers();

  // SCH-12: scheduleAllCronJobs must not fail silently — exit non-zero on failure.
  try {
    await scheduleAllCronJobs();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[STARTUP] scheduleAllCronJobs failed — exiting', { error: errorMsg });
    process.exit(1);
  }

  // Graceful shutdown
  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`[SHUTDOWN] ${signal} received — graceful shutdown starting`);

    // 1. Stop accepting new HTTP connections
    server.close(() => {
      logger.info('[SHUTDOWN] HTTP server closed');
    });
    healthServer.close();

    try {
      // 2. Stop all BullMQ workers
      await closeAllWorkers();
      logger.info('[SHUTDOWN] All BullMQ workers stopped');

      // 3. Close Redis
      await redis.quit().catch(() => {});

      // 4. Close MongoDB
      await disconnectMongoDB();

      logger.info('[SHUTDOWN] Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('[SHUTDOWN] Error during shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
  });

  logger.info('rez-scheduler-service ready');
}

main().catch((err) => {
  logger.error('[FATAL]', err);
  process.exit(1);
});
