import IORedis from 'ioredis';
import { env } from './env';

type RedisClient = IORedis;

let redisClient: RedisClient | null = null;

export function createRedisClient(): RedisClient {
  const redisUrl = process.env.REDIS_URL;

  // If REDIS_URL is provided, use it directly
  if (redisUrl) {
    const client = new IORedis(redisUrl, {
      retryStrategy: (times: number): number | null => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    client.on('connect', () => {
      console.log('Redis client connected');
    });

    client.on('ready', () => {
      console.log('Redis client ready');
    });

    client.on('error', (error: Error) => {
      console.error('Redis client error:', error);
    });

    client.on('close', () => {
      console.warn('Redis connection closed');
    });

    client.on('reconnecting', () => {
      console.log('Redis client reconnecting...');
    });

    return client;
  }

  // Fallback to individual env vars
  const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_TLS } = env;

  const config: Record<string, unknown> = {
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT, 10),
    retryStrategy: (times: number): number | null => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false,
  };

  if (REDIS_PASSWORD) {
    config.password = REDIS_PASSWORD;
  }

  if (REDIS_TLS === 'true' || REDIS_TLS === '1') {
    config.tls = true;
  }

  const client = new IORedis(config as never);

  client.on('connect', () => {
    console.log('Redis client connected');
  });

  client.on('ready', () => {
    console.log('Redis client ready');
  });

  client.on('error', (error: Error) => {
    console.error('Redis client error:', error);
  });

  client.on('close', () => {
    console.warn('Redis connection closed');
  });

  client.on('reconnecting', () => {
    console.log('Redis client reconnecting...');
  });

  return client;
}

export async function connectRedis(): Promise<RedisClient> {
  if (!redisClient) {
    redisClient = createRedisClient();
  }

  try {
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Redis connection error';
    console.error('Redis connection failed:', errorMessage);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      console.log('Redis disconnected successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Redis disconnect error';
      console.error('Redis disconnect failed:', errorMessage);
      throw error;
    }
  }
}

export function getRedis(): RedisClient {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

export { redisClient as redis };
export { getRedis as getRedisClient };

// Cache utility functions
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  const data = await client.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
  const client = getRedis();
  await client.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  await client.del(key);
}

export async function cacheDelete(key: string): Promise<void> {
  return cacheDel(key);
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  const client = getRedis();
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    await client.del(...keys);
  }
}
