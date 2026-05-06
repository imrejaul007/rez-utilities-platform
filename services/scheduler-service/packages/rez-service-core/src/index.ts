/**
 * @imrejaul007/rez-service-core
 *
 * Shared infrastructure for REZ BullMQ microservices.
 * Eliminates copy-paste across 8+ service repos.
 *
 * Usage:
 *   import { createBullMQRedis, connectMongoDB, createLogger, startHealthServer, setupGracefulShutdown } from '@imrejaul007/rez-service-core';
 */

export { createBullMQRedis, markRedisClientShuttingDown } from './redis';
export { connectMongoDB, disconnectMongoDB } from './mongodb';
export { createLogger, createServiceLogger } from './logger';
export { startHealthServer, setHealthy } from './health';
export { setupGracefulShutdown } from './gracefulShutdown';
