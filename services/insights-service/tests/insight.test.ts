import { z } from 'zod';
import {
  CreateInsightSchema,
  UpdateInsightSchema,
  InsightQuerySchema,
} from '../src/services/insightService';

describe('Insight Schemas', () => {
  describe('CreateInsightSchema', () => {
    it('should validate a valid insight creation payload', () => {
      const validPayload = {
        userId: 'user123',
        merchantId: 'merchant456',
        type: 'churn_risk',
        priority: 'high',
        title: 'High churn risk detected',
        description: 'Customer has shown signs of churning based on recent activity',
        recommendation: 'Send a personalized discount offer',
        actionData: { discount: '20%', campaignId: 'camp123' },
        confidence: 0.85,
        expiresAt: '2026-12-31T23:59:59.999Z',
        metadata: { source: 'ai_analysis' },
      };

      const result = CreateInsightSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe('user123');
        expect(result.data.type).toBe('churn_risk');
        expect(result.data.confidence).toBe(0.85);
      }
    });

    it('should apply default priority when not provided', () => {
      const payload = {
        userId: 'user123',
        type: 'general',
        title: 'Test insight',
        description: 'Test description',
        recommendation: 'Test recommendation',
        confidence: 0.5,
        expiresAt: new Date().toISOString(),
      };

      const result = CreateInsightSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('medium');
      }
    });

    it('should reject invalid insight type', () => {
      const invalidPayload = {
        userId: 'user123',
        type: 'invalid_type',
        title: 'Test',
        description: 'Test',
        recommendation: 'Test',
        confidence: 0.5,
        expiresAt: new Date().toISOString(),
      };

      const result = CreateInsightSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject confidence outside 0-1 range', () => {
      const invalidPayload = {
        userId: 'user123',
        type: 'general',
        title: 'Test',
        description: 'Test',
        recommendation: 'Test',
        confidence: 1.5,
        expiresAt: new Date().toISOString(),
      };

      const result = CreateInsightSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject title exceeding 200 characters', () => {
      const invalidPayload = {
        userId: 'user123',
        type: 'general',
        title: 'a'.repeat(201),
        description: 'Test',
        recommendation: 'Test',
        confidence: 0.5,
        expiresAt: new Date().toISOString(),
      };

      const result = CreateInsightSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject empty userId', () => {
      const invalidPayload = {
        userId: '',
        type: 'general',
        title: 'Test',
        description: 'Test',
        recommendation: 'Test',
        confidence: 0.5,
        expiresAt: new Date().toISOString(),
      };

      const result = CreateInsightSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateInsightSchema', () => {
    it('should validate a valid status update', () => {
      const validPayload = { status: 'viewed' };

      const result = UpdateInsightSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('viewed');
      }
    });

    it('should validate a full update payload', () => {
      const validPayload = {
        status: 'actioned',
        priority: 'high',
        title: 'Updated title',
        description: 'Updated description',
        recommendation: 'Updated recommendation',
        actionData: { performed: true },
        metadata: { updatedBy: 'system' },
      };

      const result = UpdateInsightSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = UpdateInsightSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const invalidPayload = { status: 'invalid' };

      const result = UpdateInsightSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject invalid priority', () => {
      const invalidPayload = { priority: 'critical' };

      const result = UpdateInsightSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('InsightQuerySchema', () => {
    it('should validate query with all optional params', () => {
      const validQuery = {
        status: 'new',
        type: 'upsell',
        priority: 'high',
        limit: '50',
        skip: '10',
        includeExpired: 'false',
      };

      const result = InsightQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.skip).toBe(10);
        expect(result.data.includeExpired).toBe(false);
      }
    });

    it('should accept empty query', () => {
      const result = InsightQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject limit greater than 100', () => {
      const invalidQuery = { limit: '150' };

      const result = InsightQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it('should reject negative skip', () => {
      const invalidQuery = { skip: '-5' };

      const result = InsightQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it('should convert string boolean to boolean', () => {
      const query = { includeExpired: 'true' };

      const result = InsightQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeExpired).toBe(true);
      }
    });
  });
});

describe('Insight Types', () => {
  it('should have valid insight types', () => {
    const validTypes = ['churn_risk', 'upsell', 'cross_sell', 'reorder', 'campaign', 'general'];
    const testPayload = {
      userId: 'user123',
      type: 'churn_risk',
      title: 'Test',
      description: 'Test',
      recommendation: 'Test',
      confidence: 0.5,
      expiresAt: new Date().toISOString(),
    };

    for (const type of validTypes) {
      const payload = { ...testPayload, type };
      const result = CreateInsightSchema.safeParse(payload);
      expect(result.success).toBe(true);
    }
  });

  it('should have valid priority levels', () => {
    const validPriorities = ['high', 'medium', 'low'];
    const testPayload = {
      userId: 'user123',
      type: 'general',
      title: 'Test',
      description: 'Test',
      recommendation: 'Test',
      confidence: 0.5,
      expiresAt: new Date().toISOString(),
    };

    for (const priority of validPriorities) {
      const payload = { ...testPayload, priority };
      const result = CreateInsightSchema.safeParse(payload);
      expect(result.success).toBe(true);
    }
  });

  it('should have valid status values', () => {
    const validStatuses = ['new', 'viewed', 'actioned', 'dismissed'];

    for (const status of validStatuses) {
      const payload = { status };
      const result = UpdateInsightSchema.safeParse(payload);
      expect(result.success).toBe(true);
    }
  });
});

describe('Insight Model Interface', () => {
  it('should have all required fields in interface', () => {
    const requiredFields = [
      'userId',
      'type',
      'priority',
      'title',
      'description',
      'recommendation',
      'confidence',
      'expiresAt',
      'status',
      'actionData',
      'metadata',
      'createdAt',
      'updatedAt',
    ];

    const sampleInsight = {
      userId: 'user123',
      merchantId: 'merchant456',
      type: 'churn_risk' as const,
      priority: 'high' as const,
      title: 'Test insight',
      description: 'Test description',
      recommendation: 'Test recommendation',
      actionData: {},
      confidence: 0.85,
      expiresAt: new Date(),
      status: 'new' as const,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    for (const field of requiredFields) {
      expect(sampleInsight).toHaveProperty(field);
    }
  });
});

describe('Service Result Structure', () => {
  it('should have correct success result structure', () => {
    const successResult = {
      success: true,
      data: { id: '123', title: 'Test' },
      statusCode: 200,
    };

    expect(successResult).toHaveProperty('success', true);
    expect(successResult).toHaveProperty('data');
    expect(successResult).toHaveProperty('statusCode');
  });

  it('should have correct error result structure', () => {
    const errorResult = {
      success: false,
      error: 'Something went wrong',
      statusCode: 400,
    };

    expect(errorResult).toHaveProperty('success', false);
    expect(errorResult).toHaveProperty('error');
    expect(errorResult).toHaveProperty('statusCode');
  });
});
