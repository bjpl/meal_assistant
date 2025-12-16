/**
 * Weekly Deal Types for Price Intelligence
 * Extends vector collection types for grocery store deal tracking
 * Designed for Safeway initially, extensible to other stores
 */

import { VectorDocument } from './vector.types';

// ============================================================================
// Retailer Configuration
// ============================================================================

/**
 * Supported grocery retailers
 */
export type RetailerId = 'safeway' | 'kroger' | 'walmart' | 'costco' | 'target' | 'other';

/**
 * Retailer configuration
 */
export interface RetailerConfig {
  id: RetailerId;
  name: string;
  logoUrl?: string;
  flyerParsingConfig: {
    /** Member price badge pattern */
    memberPriceIndicator: string;
    /** Digital coupon indicator */
    digitalCouponIndicator: string;
    /** Date format in flyers */
    dateFormat: string;
  };
}

// ============================================================================
// Deal Types (Based on Annotation Schema)
// ============================================================================

/**
 * Campaign type from flyer
 */
export type CampaignType = 'weekly_ad' | 'event_special' | 'coupon_sheet' | 'friday_special';

/**
 * Deal logic type
 */
export type DealLogicType =
  | 'standard'           // Simple price reduction
  | 'bogo'               // Buy One Get One
  | 'must_buy'           // Must buy X quantity
  | 'mix_match'          // Mix & Match deals
  | 'percentage_off'     // Percentage discount
  | 'points_multiplier'  // Loyalty points multiplier
  | 'digital_coupon';    // Clip to activate

/**
 * Product packaging style
 */
export type PackagingStyle = 'fresh' | 'packaged' | 'prepared' | 'loose' | 'frozen';

/**
 * Quality badge type
 */
export type QualityBadge = 'usda_choice' | 'usda_organic' | 'local' | 'wild_caught' | 'grass_fed' | 'non_gmo';

/**
 * Price unit type
 */
export type PriceUnit = 'lb' | 'ea' | 'oz' | 'ct' | 'pk' | 'gal' | 'l';

// ============================================================================
// Weekly Deal Metadata (For Vector Collection)
// ============================================================================

/**
 * Weekly deal document metadata
 * Follows annotation schema for Safeway flyers
 */
export interface WeeklyDealMetadata {
  /** Unique deal ID */
  dealId: string;

  /** Retailer ID */
  retailerId: RetailerId;

  /** Campaign type */
  campaignType: CampaignType;

  /** Product information */
  product: {
    /** Product title (TXT_PROD_TITLE) */
    title: string;
    /** Brand name (TXT_BRAND) */
    brand?: string;
    /** Product description (TXT_PROD_DESC) */
    description?: string;
    /** Product category */
    category: string;
    /** Packaging style (IMG_PRODUCT subclass) */
    packagingStyle?: PackagingStyle;
    /** Size/weight information */
    size?: string;
    /** Quality badges */
    qualityBadges?: QualityBadge[];
  };

  /** Price information */
  price: {
    /** Sale price (integer part - TXT_PRICE_INT) */
    salePrice: number;
    /** Price decimal (TXT_PRICE_DECIMAL) */
    priceDecimal?: number;
    /** Full formatted price */
    fullPrice: string;
    /** Unit of measure (TXT_PRICE_UNIT) */
    unit: PriceUnit;
    /** Is this a member-only price? */
    isMemberPrice: boolean;
    /** Regular price (if available) */
    regularPrice?: number;
    /** Savings amount */
    savings?: number;
    /** Savings percentage */
    savingsPercent?: number;
  };

  /** Deal constraints (TXT_CONSTRAINT) */
  constraints?: {
    /** Deal logic type */
    logicType: DealLogicType;
    /** Minimum quantity required */
    minQuantity?: number;
    /** Maximum quantity allowed (limit) */
    maxQuantity?: number;
    /** Requires digital coupon clip */
    requiresClip?: boolean;
    /** Additional conditions text */
    conditionText?: string;
  };

  /** Validity dates (TXT_DATE) */
  validity: {
    /** Start date */
    startDate: Date;
    /** End date */
    endDate: Date;
    /** Is this a limited-time deal (e.g., Friday only)? */
    isLimitedTime?: boolean;
    /** Specific day if limited */
    limitedDay?: string;
  };

  /** Points/rewards information */
  rewards?: {
    /** Points multiplier (2X, 4X) */
    multiplier?: number;
    /** Bonus points */
    bonusPoints?: number;
  };

  /** Extraction metadata */
  extraction: {
    /** Source flyer page number */
    pageNumber: number;
    /** Extraction confidence score */
    confidence: number;
    /** Extraction timestamp */
    extractedAt: Date;
    /** Source file reference */
    sourceFile?: string;
  };

  /** Matching metadata for search */
  matching: {
    /** Normalized product name for matching */
    normalizedName: string;
    /** Search keywords */
    keywords: string[];
    /** Related ingredient IDs from our database */
    relatedIngredientIds?: string[];
  };
}

export type WeeklyDealDocument = VectorDocument<WeeklyDealMetadata>;

// ============================================================================
// Flyer Processing Types
// ============================================================================

/**
 * Flyer document classification
 */
export interface FlyerDocument {
  /** Document type */
  docType: 'retail_flyer';
  /** Retailer ID */
  retailerId: RetailerId;
  /** Campaign type */
  campaignType: CampaignType;
  /** Seasonality tags */
  seasonality?: string[];
  /** Total pages */
  totalPages: number;
  /** Validity period */
  validityPeriod: {
    startDate: Date;
    endDate: Date;
  };
}

/**
 * Extracted deal from flyer parsing
 */
export interface ExtractedDeal {
  /** Raw extracted text */
  rawText: {
    priceInt?: string;
    priceDecimal?: string;
    priceUnit?: string;
    productTitle?: string;
    productDesc?: string;
    brand?: string;
    constraint?: string;
    dateRange?: string;
  };
  /** Visual elements detected */
  visualElements: {
    hasMemberPriceBadge: boolean;
    hasDigitalCouponTag: boolean;
    dealBadgeType?: 'mix_match' | 'bogo' | 'multiplier';
    qualityBadges: QualityBadge[];
    priceContainerColor?: 'yellow' | 'red' | 'green';
  };
  /** Bounding box (optional, for reference) */
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Page number */
  pageNumber: number;
  /** Extraction confidence */
  confidence: number;
}

// ============================================================================
// Deal Matching Types
// ============================================================================

/**
 * Deal match result
 */
export interface DealMatch {
  /** The deal */
  deal: WeeklyDealMetadata;
  /** Match score (0-1) */
  score: number;
  /** Why this deal was matched */
  matchReason: string;
  /** Is this an exact match or substitute? */
  matchType: 'exact' | 'similar' | 'substitute';
  /** If substitute, what's the original item? */
  substituteFor?: string;
  /** Potential savings if user buys this */
  potentialSavings?: number;
}

/**
 * Shopping list deal analysis
 */
export interface ShoppingListDealAnalysis {
  /** Items with deals found */
  itemsWithDeals: Array<{
    item: string;
    deals: DealMatch[];
    bestDeal?: DealMatch;
  }>;
  /** Items without deals */
  itemsWithoutDeals: string[];
  /** Total potential savings */
  totalPotentialSavings: number;
  /** Recommended store trips by validity */
  recommendedTrips?: Array<{
    date: Date;
    deals: DealMatch[];
    savings: number;
  }>;
}

// ============================================================================
// Price History Types
// ============================================================================

/**
 * Price history entry
 */
export interface PriceHistoryEntry {
  /** Product identifier */
  productId: string;
  /** Retailer */
  retailerId: RetailerId;
  /** Price observed */
  price: number;
  /** Unit */
  unit: PriceUnit;
  /** Date observed */
  observedDate: Date;
  /** Was this a sale price? */
  wasSalePrice: boolean;
  /** Source deal ID if from flyer */
  sourceDealId?: string;
}

/**
 * Price trend analysis
 */
export interface PriceTrend {
  /** Product identifier */
  productId: string;
  /** Average price */
  averagePrice: number;
  /** Lowest price seen */
  lowestPrice: number;
  /** Highest price seen */
  highestPrice: number;
  /** Current price relative to average */
  currentVsAverage: 'below' | 'average' | 'above';
  /** Is now a good time to buy? */
  isGoodTimeToBuy: boolean;
  /** Price history entries */
  history: PriceHistoryEntry[];
}

// ============================================================================
// Collection Name Extension
// ============================================================================

export const DEAL_COLLECTION_NAMES = {
  WEEKLY_DEALS: 'weekly_deals',
  PRICE_HISTORY: 'price_history'
} as const;

export type DealCollectionName = typeof DEAL_COLLECTION_NAMES[keyof typeof DEAL_COLLECTION_NAMES];
