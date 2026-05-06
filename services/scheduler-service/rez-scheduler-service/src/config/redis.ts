// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import 'dotenv/config'; // must be first to load env vars before reading process.env
import Redis from 'ioredis';
import { logger } from './logger';

function buildRedisOptions() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return redisUrl;
  }
  // Fallback: require REDIS_HOST / REDIS_PORT / REDIS_PASSWORD env vars
  const host = process.env.REDIS_HOST;
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD;
  if (!host) {
    throw new Error('[Redis] REDIS_URL or REDIS_HOST env var is required');
  }
  return { host, port, password, maxRetriesPerRequest: null };
}

export const redis = new Redis(buildRedisOptions());

redis.on('connect', () => {
  logger.info('[Redis] Connected');
});

redis.on('reconnecting', () => {
  logger.warn('[Redis] Reconnecting...');
});

redis.on('error', (err) => {
  logger.error('[Redis] Error:', err);
});

redis.on('close', () => {
  logger.info('[Redis] Connection closed');
});
