// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import mongoose from 'mongoose';
import { config } from './index';
import { logger } from './logger';

export async function connectMongoDB(): Promise<void> {
  try {
    await mongoose.connect(config.mongodb.uri, {
      maxPoolSize: 20,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority',
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
