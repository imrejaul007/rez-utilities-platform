// Centralized DLQ Monitor
// Monitors all service dead letter queues

import BullMQ from 'bullmq';
import { redis } from './config/redis';

interface DLQStats {
  queueName: string;
  failed: number;
  waiting: number;
  completed: number;
}

export class DLQMonitor {
  private queues = [
    'wallet-dlq', 'order-dlq', 'payment-dlq',
    'notification-dlq', 'gamification-dlq', 'marketing-dlq'
  ];

  async getStats(): Promise<DLQStats[]> {
    const stats: DLQStats[] = [];

    for (const queueName of this.queues) {
      const queue = new BullMQ.Queue(queueName, { connection: redis });
      const [failed, waiting, completed] = await Promise.all([
        queue.getFailedCount(),
        queue.getWaitingCount(),
        queue.getCompletedCount(),
      ]);
      stats.push({ queueName, failed, waiting, completed });
    }

    return stats;
  }

  async checkAlerts(): Promise<string[]> {
    const stats = await this.getStats();
    const alerts: string[] = [];

    for (const stat of stats) {
      if (stat.failed > 100) {
        alerts.push(`ALERT: ${stat.queueName} has ${stat.failed} failed jobs`);
      }
    }

    return alerts;
  }
}
