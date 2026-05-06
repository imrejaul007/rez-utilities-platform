/**
 * Shared graceful shutdown handler for BullMQ microservices.
 * Closes worker, Redis, MongoDB, and health server in order.
 */

import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import http from 'http';
import { disconnectMongoDB } from './mongodb';
import { markRedisClientShuttingDown } from './redis';

interface ShutdownTargets {
  worker?: Worker | null;
  redis?: IORedis | null;
  healthServer?: http.Server | null;
  logFn?: { info: (msg: string) => void; error: (msg: string, err?: any) => void };
}

export function setupGracefulShutdown(targets: ShutdownTargets): void {
  const log = targets.logFn || {
    info: console.log,
    error: console.error,
  };

  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    log.info(`[Shutdown] ${signal} received — shutting down gracefully`);

    try {
      if (targets.worker) {
        await targets.worker.close();
        log.info('[Shutdown] Worker closed');
      }
      if (targets.healthServer) {
        targets.healthServer.close();
        log.info('[Shutdown] Health server closed');
      }
      await disconnectMongoDB();
      log.info('[Shutdown] MongoDB disconnected');
      if (targets.redis) {
        markRedisClientShuttingDown(targets.redis);
        targets.redis.disconnect();
        log.info('[Shutdown] Redis disconnected');
      }
    } catch (err) {
      log.error('[Shutdown] Error during shutdown', err);
    }

    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
