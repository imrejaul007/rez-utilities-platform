// Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
import mongoose, { Schema, Document } from 'mongoose';

export interface IScheduleConfig extends Document {
  jobName: string;
  enabled: boolean;
  cronOverride?: string; // allows runtime override without redeployment
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
  failCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const scheduleConfigSchema = new Schema<IScheduleConfig>(
  {
    jobName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    cronOverride: {
      type: String,
      default: undefined,
    },
    lastRunAt: Date,
    nextRunAt: Date,
    runCount: {
      type: Number,
      default: 0,
    },
    failCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export const ScheduleConfig = mongoose.model<IScheduleConfig>('ScheduleConfig', scheduleConfigSchema);
