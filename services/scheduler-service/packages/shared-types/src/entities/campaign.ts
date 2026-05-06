/**
 * Campaign entity types — Unified base campaign interface
 *
 * Canonical types for all 3 campaign services:
 * - rez-marketing-service/src/models/MarketingCampaign.ts
 * - rez-merchant-service/src/models/AdCampaign.ts
 * - rez-ads-service/src/models/AdCampaign.ts
 *
 * Each service extends IBaseCampaign with domain-specific fields.
 */

import { CampaignStatus, CampaignChannel } from '../enums/index';

/**
 * Base campaign interface — minimal shared fields across all 3 services
 */
export interface IBaseCampaign {
  _id?: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  startDate: Date;
  endDate?: Date;
  channel?: CampaignChannel;
  targetAudience?: any;
  budget?: number;
  spent?: number;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Marketing campaign — rez-marketing-service
 *
 * Supports advanced audience targeting:
 * - segments (all, recent, lapsed, high_value, stamp_card)
 * - location (city, area, pincode, radius)
 * - interests (derived from purchase history)
 * - birthday, purchase_history, institution, keyword, custom filters
 *
 * Channels: whatsapp | push | sms | email | in_app
 */
export interface IMarketingCampaign extends IBaseCampaign {
  type?: 'marketing';
  merchantId?: string;
  objective?: 'awareness' | 'engagement' | 'sales' | 'win_back';
  message?: string;
  templateName?: string;
  imageUrl?: string;
  ctaUrl?: string;
  ctaText?: string;
  audience?: Record<string, any>;
  scheduledAt?: Date;
  sentAt?: Date;
  stats?: {
    sent?: number;
    delivered?: number;
    failed?: number;
    deduped?: number;
    opened?: number;
    clicked?: number;
    converted?: number;
  };
  errorMessage?: string;
  dailyBudget?: number;
  totalSpent?: number;
  attributionWindowDays?: number;
}

/**
 * Ad campaign — rez-ads-service & rez-merchant-service (shared collection)
 *
 * Placements: home_banner | explore_feed | store_listing | search_result
 * Target segments: all | new | loyal | lapsed | nearby
 * Bidding: CPC or CPM
 */
export interface IAdCampaign extends IBaseCampaign {
  type?: 'ad';
  merchantId?: string;
  storeId?: string;
  title?: string;
  headline?: string;
  ctaText?: string;
  ctaUrl?: string;
  imageUrl?: string;
  placement?: 'home_banner' | 'explore_feed' | 'store_listing' | 'search_result';
  targetSegment?: 'all' | 'new' | 'loyal' | 'lapsed' | 'nearby';
  targetLocation?: {
    city?: string;
    radiusKm?: number;
  };
  targetInterests?: string[];
  bidType?: 'CPC' | 'CPM';
  bidAmount?: number;
  dailyBudget?: number;
  totalBudget?: number;
  totalSpent?: number;
  frequencyCapDays?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
}

/**
 * Merchant loyalty/promotion campaign — rez-merchant-service
 *
 * Used for loyalty programs, promotional rules, and broadcast campaigns.
 * Supports condition-based triggers, reward types, and audience targeting.
 */
export interface IMerchantCampaign extends IBaseCampaign {
  type?: 'merchant';
  merchantId?: string;
  storeId?: string;
  title?: string;
  discountPercentage?: number;
  maxRedemptions?: number;
  redemptionCount?: number;
  appliedProducts?: string[];
  rewardValue?: number;
  rewardType?: string;
  durationDays?: number;
  conditions?: Record<string, any>;
  actions?: Array<Record<string, any>>;
  triggers?: Array<Record<string, any>>;
  priority?: number;
  cooldownDays?: number;
}

export type ICampaign = IMarketingCampaign | IAdCampaign | IMerchantCampaign;
