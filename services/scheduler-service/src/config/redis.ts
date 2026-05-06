import 'dotenv/config'; // must be first to load env vars before reading process.env
import Redis from 'ioredis';
import crypto from 'crypto';
import { logger } from './logger';

function buildRedisOptions() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return {
      lazyConnect: true,
      keepAlive: 10000,
      maxRetriesPerRequest: null,
      retryStrategy: (times: number) => {
        const base = Math.min(times * 200, 5000);
        const jitter = crypto.randomInt(0, 500);
        return base + jitter;
      },
      reconnectOnError: (err: Error) => {
        return err.message.includes('ECONNRESET') ||
               err.message.includes('EPIPE') ||
               err.message.includes('READONLY');
      },
    };
  }
  // Fallback: require REDIS_HOST / REDIS_PORT / REDIS_PASSWORD env vars
  const host = process.env.REDIS_HOST;
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD;
  if (!host) {
    throw new Error('[Redis] REDIS_URL or REDIS_HOST env var is required');
  }
  return {
    host,
    port,
    password,
    lazyConnect: true,
    keepAlive: 10000,
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => {
      const base = Math.min(times * 200, 5000);
      const jitter = crypto.randomInt(0, 500);
      return base + jitter;
    },
    reconnectOnError: (err: Error) => {
      return err.message.includes('ECONNRESET') ||
             err.message.includes('EPIPE') ||
             err.message.includes('READONLY');
    },
  };
}

export const redis = new Redis(buildRedisOptions());

redis.on('connect', () => {
  logger.info('[Redis] Connected');
});

redis.on('ready', () => {
  logger.info('[Redis] Ready');
});

redis.on('reconnecting', () => {
  logger.warn('[Redis] Reconnecting...');
});

redis.on('error', (err) => {
  logger.error('[Redis] Error:', err);
});

redis.on('close', () => {
  logger.warn('[Redis] Connection closed');
});
