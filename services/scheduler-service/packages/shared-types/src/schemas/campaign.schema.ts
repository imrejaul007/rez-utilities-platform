/**
 * Campaign API validation schemas
 * Unified validation for Marketing, Ad, and Merchant campaigns across all 3 services:
 * - rez-marketing-service
 * - rez-merchant-service
 * - rez-ads-service
 */

import { z } from 'zod';

// Campaign status enum (unified across all services)
export const CAMPAIGN_STATUS = z.enum([
  'draft',
  'scheduled',
  'sending',
  'sent',
  'pending_review',
  'active',
  'paused',
  'completed',
  'expired',
  'rejected',
  'failed',
  'cancelled',
]);

// Campaign channel enum (unified across all services)
export const CAMPAIGN_CHANNEL = z.enum([
  'email',
  'sms',
  'push',
  'in_app',
  'whatsapp',
  'social',
  'web',
  'api',
]);

// Base Campaign schema
export const BaseCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional(),
  status: CAMPAIGN_STATUS,
  startDate: z.date(),
  endDate: z.date().optional(),
  channel: CAMPAIGN_CHANNEL.optional(),
  targetAudience: z.record(z.any()).optional(),
  budget: z.number().min(0).optional(),
  spent: z.number().min(0).optional(),
  createdBy: z.string().optional(),
});

// Marketing Campaign schema — for rez-marketing-service
export const CreateMarketingCampaignSchema = BaseCampaignSchema.extend({
  type: z.literal('marketing').optional(),
  merchantId: z.string().optional(),
  objective: z.enum(['awareness', 'engagement', 'sales', 'win_back']).optional(),
  message: z.string().optional(),
  templateName: z.string().optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  ctaUrl: z.string().url('Invalid CTA URL').optional(),
  ctaText: z.string().optional(),
  audience: z.record(z.any()).optional(),
  scheduledAt: z.date().optional(),
  dailyBudget: z.number().min(0).optional(),
  attributionWindowDays: z.number().int().positive().optional(),
});

// Update Marketing Campaign schema
export const UpdateMarketingCampaignSchema = CreateMarketingCampaignSchema.partial();

// Marketing Campaign Response
export const MarketingCampaignResponseSchema = CreateMarketingCampaignSchema.extend({
  _id: z.string().optional(),
  sentAt: z.date().optional(),
  stats: z.object({
    sent: z.number().optional(),
    delivered: z.number().optional(),
    failed: z.number().optional(),
    deduped: z.number().optional(),
    opened: z.number().optional(),
    clicked: z.number().optional(),
    converted: z.number().optional(),
  }).optional(),
  errorMessage: z.string().optional(),
  totalSpent: z.number().min(0).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Ad Campaign schema — for rez-ads-service & rez-merchant-service
export const CreateAdCampaignSchema = BaseCampaignSchema.extend({
  type: z.literal('ad').optional(),
  merchantId: z.string().optional(),
  storeId: z.string().optional(),
  title: z.string().optional(),
  headline: z.string().optional(),
  ctaText: z.string().optional(),
  ctaUrl: z.string().url('Invalid CTA URL').optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  placement: z.enum([
    'home_banner',
    'explore_feed',
    'store_listing',
    'search_result',
  ]).optional(),
  targetSegment: z.enum(['all', 'new', 'loyal', 'lapsed', 'nearby']).optional(),
  targetLocation: z.object({
    city: z.string().optional(),
    radiusKm: z.number().positive().optional(),
  }).optional(),
  targetInterests: z.array(z.string()).optional(),
  bidType: z.enum(['CPC', 'CPM']).optional(),
  bidAmount: z.number().min(0).optional(),
  dailyBudget: z.number().min(0).optional(),
  totalBudget: z.number().min(0).optional(),
  frequencyCapDays: z.number().int().positive().optional(),
});

// Update Ad Campaign schema
export const UpdateAdCampaignSchema = CreateAdCampaignSchema.partial();

// Ad Campaign Response
export const AdCampaignResponseSchema = CreateAdCampaignSchema.extend({
  _id: z.string().optional(),
  totalSpent: z.number().min(0).optional(),
  impressions: z.number().optional(),
  clicks: z.number().optional(),
  ctr: z.number().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.date().optional(),
  rejectionReason: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Merchant Campaign schema — for rez-merchant-service (loyalty/promotion)
export const CreateMerchantCampaignSchema = BaseCampaignSchema.extend({
  type: z.literal('merchant').optional(),
  merchantId: z.string().optional(),
  storeId: z.string().optional(),
  title: z.string().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  maxRedemptions: z.number().int().positive().optional(),
  appliedProducts: z.array(z.string()).optional(),
  rewardValue: z.number().min(0).optional(),
  rewardType: z.string().optional(),
  durationDays: z.number().int().positive().optional(),
  conditions: z.record(z.any()).optional(),
  actions: z.array(z.record(z.any())).optional(),
  triggers: z.array(z.record(z.any())).optional(),
  priority: z.number().int().optional(),
  cooldownDays: z.number().int().optional(),
});

// Update Merchant Campaign schema
export const UpdateMerchantCampaignSchema = CreateMerchantCampaignSchema.partial();

// Merchant Campaign Response
export const MerchantCampaignResponseSchema = CreateMerchantCampaignSchema.extend({
  _id: z.string().optional(),
  redemptionCount: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Unified Campaign Response (union type)
export const CampaignResponseSchema = z.union([
  MarketingCampaignResponseSchema,
  AdCampaignResponseSchema,
  MerchantCampaignResponseSchema,
]);

// Campaign List Response
export const CampaignListResponseSchema = z.array(CampaignResponseSchema);

// Infer TypeScript types
export type CreateMarketingCampaignRequest = z.infer<typeof CreateMarketingCampaignSchema>;
export type UpdateMarketingCampaignRequest = z.infer<typeof UpdateMarketingCampaignSchema>;
export type MarketingCampaignResponse = z.infer<typeof MarketingCampaignResponseSchema>;

export type CreateAdCampaignRequest = z.infer<typeof CreateAdCampaignSchema>;
export type UpdateAdCampaignRequest = z.infer<typeof UpdateAdCampaignSchema>;
export type AdCampaignResponse = z.infer<typeof AdCampaignResponseSchema>;

export type CreateMerchantCampaignRequest = z.infer<typeof CreateMerchantCampaignSchema>;
export type UpdateMerchantCampaignRequest = z.infer<typeof UpdateMerchantCampaignSchema>;
export type MerchantCampaignResponse = z.infer<typeof MerchantCampaignResponseSchema>;

export type CampaignResponse = z.infer<typeof CampaignResponseSchema>;
export type CampaignListResponse = z.infer<typeof CampaignListResponseSchema>;
export type CampaignStatus = z.infer<typeof CAMPAIGN_STATUS>;
export type CampaignChannel = z.infer<typeof CAMPAIGN_CHANNEL>;
