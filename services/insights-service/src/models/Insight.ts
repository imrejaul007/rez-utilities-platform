import mongoose, { Document, Schema, Model } from 'mongoose';

export type InsightType = 'churn_risk' | 'upsell' | 'cross_sell' | 'reorder' | 'campaign' | 'general';
export type InsightPriority = 'high' | 'medium' | 'low';
export type InsightStatus = 'new' | 'viewed' | 'actioned' | 'dismissed';

export interface IInsight {
  userId: string;
  merchantId?: string;
  type: InsightType;
  priority: InsightPriority;
  title: string;
  description: string;
  recommendation: string;
  actionData: Record<string, unknown>;
  confidence: number;
  expiresAt: Date;
  status: InsightStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInsightDocument extends IInsight, Document {
  _id: mongoose.Types.ObjectId;
  id: string;
}

export interface CreateInsightDTO {
  userId: string;
  merchantId?: string;
  type: InsightType;
  priority: InsightPriority;
  title: string;
  description: string;
  recommendation: string;
  actionData?: Record<string, unknown>;
  confidence: number;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

export interface UpdateInsightDTO {
  status?: InsightStatus;
  priority?: InsightPriority;
  title?: string;
  description?: string;
  recommendation?: string;
  actionData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface InsightQueryOptions {
  status?: InsightStatus;
  type?: InsightType;
  priority?: InsightPriority;
  limit?: number;
  skip?: number;
  includeExpired?: boolean;
}

const insightSchema = new Schema<IInsightDocument>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
    },
    merchantId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Insight type is required'],
      enum: {
        values: ['churn_risk', 'upsell', 'cross_sell', 'reorder', 'campaign', 'general'],
        message: 'Invalid insight type',
      },
      index: true,
    },
    priority: {
      type: String,
      required: [true, 'Priority is required'],
      enum: {
        values: ['high', 'medium', 'low'],
        message: 'Invalid priority value',
      },
      default: 'medium',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    recommendation: {
      type: String,
      required: [true, 'Recommendation is required'],
      maxlength: [2000, 'Recommendation cannot exceed 2000 characters'],
    },
    actionData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    confidence: {
      type: Number,
      required: [true, 'Confidence score is required'],
      min: [0, 'Confidence must be between 0 and 1'],
      max: [1, 'Confidence must be between 0 and 1'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['new', 'viewed', 'actioned', 'dismissed'],
        message: 'Invalid status value',
      },
      default: 'new',
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

insightSchema.index({ userId: 1, status: 1 });
insightSchema.index({ merchantId: 1, status: 1 });
insightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

insightSchema.pre('save', function (next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

export const Insight: Model<IInsightDocument> = mongoose.model<IInsightDocument>('Insight', insightSchema);

export async function findUserInsights(
  userId: string,
  options: InsightQueryOptions = {}
): Promise<IInsightDocument[]> {
  const { status, type, priority, limit = 50, skip = 0, includeExpired = false } = options;

  const query: Record<string, unknown> = { userId };

  if (status) query.status = status;
  if (type) query.type = type;
  if (priority) query.priority = priority;
  if (!includeExpired) {
    query.expiresAt = { $gt: new Date() };
  }

  return Insight.find(query)
    .sort({ priority: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean() as unknown as IInsightDocument[];
}

export async function findMerchantInsights(
  merchantId: string,
  options: InsightQueryOptions = {}
): Promise<IInsightDocument[]> {
  const { status, type, priority, limit = 50, skip = 0, includeExpired = false } = options;

  const query: Record<string, unknown> = { merchantId };

  if (status) query.status = status;
  if (type) query.type = type;
  if (priority) query.priority = priority;
  if (!includeExpired) {
    query.expiresAt = { $gt: new Date() };
  }

  return Insight.find(query)
    .sort({ priority: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean() as unknown as IInsightDocument[];
}

export async function findInsightById(id: string): Promise<IInsightDocument | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  return Insight.findById(id);
}

export async function createInsight(data: CreateInsightDTO): Promise<IInsightDocument> {
  const insight = new Insight({
    ...data,
    actionData: data.actionData || {},
    metadata: data.metadata || {},
  });
  return insight.save();
}

export async function updateInsight(id: string, data: UpdateInsightDTO): Promise<IInsightDocument | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  return Insight.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

export async function deleteInsight(id: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return false;
  }
  const result = await Insight.findByIdAndDelete(id);
  return result !== null;
}

export async function dismissInsight(id: string): Promise<IInsightDocument | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  return Insight.findByIdAndUpdate(id, { status: 'dismissed' }, { new: true });
}

export async function countUserInsights(userId: string, status?: InsightStatus): Promise<number> {
  const query: Record<string, unknown> = { userId, expiresAt: { $gt: new Date() } };
  if (status) query.status = status;
  return Insight.countDocuments(query);
}
