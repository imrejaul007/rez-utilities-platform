/**
 * Shared Redis connection for BullMQ microservices.
 * Configure via REDIS_URL and REDIS_TLS env vars.
 */

import IORedis from 'ioredis';

const redisClientsShuttingDown = new WeakSet<IORedis>();

export function markRedisClientShuttingDown(client: IORedis): void {
  redisClientsShuttingDown.add(client);
}

export function createBullMQRedis(logFn?: {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}): IORedis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const log = logFn || { info: console.log, warn: console.warn, error: console.error };

  let host = 'localhost';
  let port = 6379;
  let password: string | undefined;

  try {
    const u = new URL(redisUrl);
    host = u.hostname || 'localhost';
    port = parseInt(u.port || '6379', 10);
    password = u.password || undefined;
  } catch {
    // fallback to defaults
  }

  const client = new IORedis({
    host,
    port,
    password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    keepAlive: 10000,
    retryStrategy: (times: number) => {
      const base = Math.min(Math.pow(2, times) * 200, 15000);
      return Math.floor(base + Math.random() * 1000);
    },
    reconnectOnError: (err: Error) => {
      return (
        err.message.includes('ECONNRESET') ||
        err.message.includes('EPIPE') ||
        err.message.includes('READONLY')
      );
    },
    lazyConnect: false,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  });

  client.on('connect', () => log.info('[Redis] Connection established'));
  client.on('ready', () => log.info('[Redis] Connection ready'));
  client.on('reconnecting', () => log.warn('[Redis] Reconnecting...'));
  client.on('error', (err: Error) => {
    if (redisClientsShuttingDown.has(client)) {
      log.info('[Redis] Connection closing during shutdown');
      return;
    }
    log.error('[Redis] Error: ' + err.message);
  });
  client.on('end', () => {
    if (redisClientsShuttingDown.has(client)) {
      log.info('[Redis] Connection closed (shutdown)');
      return;
    }
    log.error('[Redis] Connection closed');
  });

  return client;
}
