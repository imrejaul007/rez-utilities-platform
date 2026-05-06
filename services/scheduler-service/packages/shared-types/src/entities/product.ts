/**
 * Product entity types — based on canonical Product.ts
 * Canonical pricing format: selling + mrp (NOT price.current/original)
 */

export interface IProductImage {
  url?: string;
  alt?: string;
  isPrimary?: boolean;
}

export interface IProductPricing {
  selling: number;
  mrp: number;
  discount?: number;
  currency?: string;
}

export interface IProductRating {
  value?: number;
  count?: number;
}

export interface IProduct {
  _id?: string;
  name?: string;
  description?: string;
  category?: string;
  store?: string;
  isActive?: boolean;
  isFeatured?: boolean;

  // Canonical pricing format
  pricing?: IProductPricing;

  // Images — canonical format is object
  images?: IProductImage[];

  // Ratings
  rating?: IProductRating;

  // Metadata
  createdAt?: Date;
  updatedAt?: Date;

  // Support legacy formats for compatibility
  price?: {
    current?: number;
    original?: number;
    selling?: number;
    mrp?: number;
  };
  ratings?: {
    average?: number;
    total?: number;
  };
}
