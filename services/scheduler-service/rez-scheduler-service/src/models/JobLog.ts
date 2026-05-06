// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import mongoose, { Schema, Document } from 'mongoose';

export interface IJobLog extends Document {
  jobName: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'retrying';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  result?: Record<string, unknown>;
  error?: string;
  errorStack?: string;
  attempts: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const jobLogSchema = new Schema<IJobLog>(
  {
    jobName: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'retrying'],
      default: 'queued',
      index: true,
    },
    startedAt: Date,
    completedAt: Date,
    duration: Number,
    result: Schema.Types.Mixed,
    error: String,
    errorStack: String,
    attempts: {
      type: Number,
      default: 0,
    },
    metadata: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  },
);

// TTL index: auto-delete logs older than 90 days
jobLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const JobLog = mongoose.model<IJobLog>('JobLog', jobLogSchema);
