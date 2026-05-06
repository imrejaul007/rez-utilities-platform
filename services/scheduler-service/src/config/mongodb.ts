// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import mongoose from 'mongoose';
import { config } from './index';
import { logger } from './logger';

export async function connectMongoDB(): Promise<void> {
  try {
    await mongoose.connect(config.mongodb.uri, {
    // IDX-1: Disable autoIndex in production (same pattern as monolith).
    // autoIndex=true would make every pod re-run ensureIndex() on boot,
    // stalling startup and racing on large collections. Index creation
    // is handled via one-off migration scripts in production.
    autoIndex: process.env.NODE_ENV !== 'production',
    autoCreate: process.env.NODE_ENV !== 'production',
      maxPoolSize: 20,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority',
      // AUTH FIX: Explicit auth source for MongoDB authentication.
      // Uses MONGODB_AUTH_SOURCE env var, defaults to 'admin' if not set.
      // This ensures authentication works correctly even when the auth database
      // is different from the default.
      authSource: process.env.MONGODB_AUTH_SOURCE || 'admin',
    });
    logger.info('[MongoDB] Connected');
  } catch (err) {
    logger.error('[MongoDB] Connection failed:', err);
    throw err;
  }
}

export async function disconnectMongoDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('[MongoDB] Disconnected');
  } catch (err) {
    logger.error('[MongoDB] Disconnection error:', err);
    throw err;
  }
}

export default mongoose;
