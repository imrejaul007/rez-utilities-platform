// Event Bus using Redis Streams
import { redis } from './config/redis';
import { logger } from './config/logger';

// Type for Redis stream message: [messageId, [field, value, ...]]
type StreamMessage = [messageId: string, fields: string[]];

// Type for Redis xreadgroup result: [[streamName, StreamMessage[]], ...]
type StreamResult = [stream: string, messages: StreamMessage[]][];

export interface ReZEvent {
  type: string;
  source: string;
  timestamp: Date;
  data: any;
  correlationId?: string;
}

export interface EventHandler {
  (event: ReZEvent): Promise<void>;
}

export class EventBus {
  private streamName = process.env.EVENT_STREAM_NAME || 'rez:events';
  private consumerGroup = process.env.EVENT_CONSUMER_GROUP || 'rez-consumer';
  private isEnabled = process.env.EVENT_BUS_ENABLED !== 'false';

  async publish(event: ReZEvent): Promise<string | null> {
    if (!this.isEnabled) {
      logger.debug('[EventBus] Publishing disabled, skipping event', { type: event.type });
      return null;
    }

    try {
      const id = await redis.xadd(
        this.streamName,
        '*',
        'type', event.type,
        'source', event.source,
        'timestamp', event.timestamp.toISOString(),
        'data', JSON.stringify(event.data),
        'correlationId', event.correlationId || ''
      );

      logger.debug('[EventBus] Published event', { type: event.type, id });
      return id;
    } catch (error) {
      logger.error('[EventBus] Failed to publish event', { type: event.type, error });
      throw error;
    }
  }

  async createConsumerGroup(): Promise<boolean> {
    try {
      await redis.xgroup(
        'CREATE',
        this.streamName,
        this.consumerGroup,
        '0',
        'MKSTREAM'
      );
      logger.info('[EventBus] Consumer group created', { group: this.consumerGroup });
      return true;
    } catch (error: any) {
      if (error.message?.includes('BUSYGROUP')) {
        logger.debug('[EventBus] Consumer group already exists', { group: this.consumerGroup });
        return false;
      }
      logger.error('[EventBus] Failed to create consumer group', { error });
      throw error;
    }
  }

  async subscribe(
    consumerName: string,
    handler: EventHandler,
    options: { batchSize?: number; blockMs?: number } = {}
  ): Promise<() => void> {
    const { batchSize = 10, blockMs = 5000 } = options;

    await this.createConsumerGroup();

    let isRunning = true;
    let lastId = '0';

    const processMessages = async () => {
      while (isRunning) {
        try {
          // First, claim any pending messages that might have been abandoned
          const pending = await redis.xreadgroup(
            'GROUP', this.consumerGroup, consumerName,
            'COUNT', batchSize,
            'STREAMS', this.streamName,
            '0'
          );

          if (pending && pending.length > 0) {
            for (const [stream, messages] of pending as StreamResult) {
              for (const [messageId, fields] of messages) {
                try {
                  const event = this.parseMessage(fields);
                  await handler(event);
                  await redis.xack(this.streamName, this.consumerGroup, messageId);
                  lastId = messageId;
                } catch (error) {
                  logger.error('[EventBus] Handler failed for message', { messageId, error });
                }
              }
            }
          }

          // Then read new messages
          const results = await redis.xreadgroup(
            'GROUP', this.consumerGroup, consumerName,
            'COUNT', batchSize,
            'BLOCK', blockMs,
            'STREAMS', this.streamName,
            '>'
          );

          if (results && results.length > 0) {
            for (const [stream, messages] of results as StreamResult) {
              for (const [messageId, fields] of messages) {
                try {
                  const event = this.parseMessage(fields);
                  await handler(event);
                  await redis.xack(this.streamName, this.consumerGroup, messageId);
                  lastId = messageId;
                } catch (error) {
                  logger.error('[EventBus] Handler failed for message', { messageId, error });
                }
              }
            }
          }
        } catch (error: any) {
          if (error.message?.includes('NOGROUP')) {
            await this.createConsumerGroup();
          } else {
            logger.error('[EventBus] Subscribe loop error', { error });
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    };

    processMessages().catch(error => {
      logger.error('[EventBus] Subscribe process crashed', { error });
    });

    // Return cleanup function
    return () => {
      isRunning = false;
      logger.info('[EventBus] Subscription stopped', { consumer: consumerName });
    };
  }

  private parseMessage(fields: string[]): ReZEvent {
    const fieldMap: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      fieldMap[fields[i]] = fields[i + 1];
    }

    return {
      type: fieldMap['type'] || '',
      source: fieldMap['source'] || '',
      timestamp: new Date(fieldMap['timestamp'] || Date.now()),
      data: fieldMap['data'] ? JSON.parse(fieldMap['data']) : null,
      correlationId: fieldMap['correlationId'] || undefined,
    };
  }

  async getStreamInfo(): Promise<{ length: number; groups: number }> {
    try {
      const length = await redis.xlen(this.streamName);
      const info = await redis.xinfo('GROUPS', this.streamName).catch(() => []);
      return { length, groups: Array.isArray(info) ? info.length : 0 };
    } catch {
      return { length: 0, groups: 0 };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}

export const eventBus = new EventBus();
