import mongoose, { ConnectOptions } from 'mongoose';
import { env } from './env';

interface MongoConnectionOptions extends ConnectOptions {
  authSource?: string;
}

export async function connectMongoDB(): Promise<void> {
  const { MONGODB_URI, MONGODB_USER, MONGODB_PASSWORD } = env;

  let connectionUri = MONGODB_URI;

  if (MONGODB_USER && MONGODB_PASSWORD) {
    const uriParts = MONGODB_URI.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/);
    if (uriParts) {
      connectionUri = `${uriParts[1]}${encodeURIComponent(MONGODB_USER)}:${encodeURIComponent(MONGODB_PASSWORD)}@${uriParts[2]}`;
    }
  }

  const options: MongoConnectionOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  if (MONGODB_USER && MONGODB_PASSWORD) {
    options.authSource = 'admin';
  }

  try {
    await mongoose.connect(connectionUri, options);
    console.log('MongoDB connected successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown MongoDB connection error';
    console.error('MongoDB connection failed:', errorMessage);
    throw error;
  }
}

export async function disconnectMongoDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown MongoDB disconnect error';
    console.error('MongoDB disconnect failed:', errorMessage);
    throw error;
  }
}

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected successfully');
});
