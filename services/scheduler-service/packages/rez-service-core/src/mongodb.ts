/**
 * Shared MongoDB connection for BullMQ microservices.
 * Configure via MONGODB_URI env var.
 */

import mongoose from 'mongoose';

export async function connectMongoDB(logFn?: {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez';
  const log = logFn || { info: console.log, warn: console.warn, error: console.error };

  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => log.info('[MongoDB] Connected'));
  mongoose.connection.on('disconnected', () => log.warn('[MongoDB] Disconnected'));
  mongoose.connection.on('error', (err) => log.error('[MongoDB] Error: ' + err.message));

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
}

export async function disconnectMongoDB(): Promise<void> {
  await mongoose.disconnect();
}
