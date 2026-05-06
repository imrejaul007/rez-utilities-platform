/**
 * Product API validation schemas
 * Validates CreateProduct, UpdateProduct, and ProductResponse requests/responses
 * Canonical pricing format: selling + mrp (not price.current/original)
 */

import { z } from 'zod';

// Image schema
export const ProductImageSchema = z.object({
  url: z.string().url('Invalid image URL').optional(),
  alt: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

// Pricing schema — canonical format: selling + mrp
export const ProductPricingSchema = z.object({
  selling: z.number().positive('Selling price must be positive'),
  mrp: z.number().positive('MRP must be positive'),
  discount: z.number().min(0).max(100).optional(),
  currency: z.string().optional().default('INR'),
});

// Rating schema
export const ProductRatingSchema = z.object({
  value: z.number().min(0).max(5).optional(),
  count: z.number().int().min(0).optional(),
});

// Create Product Request
export const CreateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  store: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
  pricing: ProductPricingSchema,
  images: z.array(ProductImageSchema).optional(),
  rating: ProductRatingSchema.optional(),
});

// Update Product Request
export const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  store: z.string().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  pricing: ProductPricingSchema.optional(),
  images: z.array(ProductImageSchema).optional(),
  rating: ProductRatingSchema.optional(),
});

// Product Response
export const ProductResponseSchema = z.object({
  _id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  store: z.string().optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  pricing: ProductPricingSchema,
  images: z.array(ProductImageSchema).optional(),
  rating: ProductRatingSchema.optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// List Products Response
export const ProductListResponseSchema = z.array(ProductResponseSchema);

// Infer TypeScript types
export type CreateProductRequest = z.infer<typeof CreateProductSchema>;
export type UpdateProductRequest = z.infer<typeof UpdateProductSchema>;
export type ProductResponse = z.infer<typeof ProductResponseSchema>;
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;
