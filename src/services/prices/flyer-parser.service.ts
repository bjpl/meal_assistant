/**
 * Flyer Parser Service
 * Extracts deal information from grocery store flyers using multi-modal AI
 * Leverages Claude Vision API for intelligent document understanding
 *
 * Strategic Design:
 * - Uses existing embedding service for product name normalization
 * - Follows annotation schema provided for Safeway flyers
 * - Extensible to other retailers via configuration
 */

import { v4 as uuidv4 } from 'uuid';
import {
  WeeklyDealMetadata,
  ExtractedDeal,
  FlyerDocument,
  RetailerId,
  CampaignType,
  DealLogicType,
  PriceUnit,
  RetailerConfig
} from '../vector/types/deals.types';

// ============================================================================
// Retailer Configurations
// ============================================================================

const RETAILER_CONFIGS: Record<RetailerId, RetailerConfig> = {
  safeway: {
    id: 'safeway',
    name: 'Safeway',
    flyerParsingConfig: {
      memberPriceIndicator: 'Member Price',
      digitalCouponIndicator: 'clip or CLICK!',
      dateFormat: 'MMMM D'
    }
  },
  kroger: {
    id: 'kroger',
    name: 'Kroger',
    flyerParsingConfig: {
      memberPriceIndicator: 'Plus Card Price',
      digitalCouponIndicator: 'Digital Coupon',
      dateFormat: 'MM/DD'
    }
  },
  walmart: {
    id: 'walmart',
    name: 'Walmart',
    flyerParsingConfig: {
      memberPriceIndicator: 'Walmart+ Price',
      digitalCouponIndicator: 'Online Only',
      dateFormat: 'MM/DD/YYYY'
    }
  },
  costco: {
    id: 'costco',
    name: 'Costco',
    flyerParsingConfig: {
      memberPriceIndicator: 'Member Price',
      digitalCouponIndicator: 'Online Code',
      dateFormat: 'MM/DD/YY'
    }
  },
  target: {
    id: 'target',
    name: 'Target',
    flyerParsingConfig: {
      memberPriceIndicator: 'Circle Price',
      digitalCouponIndicator: 'Circle Offer',
      dateFormat: 'MM/DD'
    }
  },
  other: {
    id: 'other',
    name: 'Other',
    flyerParsingConfig: {
      memberPriceIndicator: 'Sale',
      digitalCouponIndicator: 'Coupon',
      dateFormat: 'MM/DD/YYYY'
    }
  }
};

// ============================================================================
// Category Mappings (for normalizing product categories)
// ============================================================================

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'meat': ['beef', 'pork', 'chicken', 'turkey', 'lamb', 'steak', 'roast', 'ground', 'bacon', 'sausage', 'ham'],
  'seafood': ['salmon', 'shrimp', 'crab', 'fish', 'lobster', 'tuna', 'cod', 'tilapia', 'scallop'],
  'produce': ['apple', 'orange', 'banana', 'grape', 'lettuce', 'tomato', 'potato', 'onion', 'carrot', 'broccoli', 'asparagus', 'avocado', 'berry', 'citrus', 'pineapple'],
  'dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg'],
  'bakery': ['bread', 'roll', 'bagel', 'croissant', 'muffin', 'cake', 'pie', 'cookie'],
  'frozen': ['ice cream', 'frozen', 'pizza'],
  'beverages': ['soda', 'juice', 'water', 'coffee', 'tea', 'beer', 'wine', 'spirits'],
  'snacks': ['chips', 'crackers', 'nuts', 'candy', 'popcorn'],
  'pantry': ['pasta', 'rice', 'soup', 'sauce', 'cereal', 'oats'],
  'deli': ['deli', 'sliced', 'lunch meat', 'salami', 'prosciutto']
};

// ============================================================================
// Flyer Parser Service
// ============================================================================

export interface FlyerParseOptions {
  retailerId: RetailerId;
  flyerStartDate?: Date;
  flyerEndDate?: Date;
  extractImages?: boolean;
}

export interface FlyerParseResult {
  document: FlyerDocument;
  deals: WeeklyDealMetadata[];
  rawExtractions: ExtractedDeal[];
  parseStats: {
    totalDealsExtracted: number;
    highConfidenceDeals: number;
    lowConfidenceDeals: number;
    parseTimeMs: number;
  };
}

/**
 * Flyer Parser Service
 * Intelligently extracts deal information from grocery flyers
 */
export class FlyerParserService {
  private retailerConfigs = RETAILER_CONFIGS;

  /**
   * Parse a flyer from structured deal data
   * This method accepts pre-extracted deals (e.g., from Claude Vision API)
   * and normalizes them into our standard format
   */
  public async parseFromExtractedData(
    extractedDeals: ExtractedDeal[],
    options: FlyerParseOptions
  ): Promise<FlyerParseResult> {
    const startTime = Date.now();

    // Create flyer document
    const document: FlyerDocument = {
      docType: 'retail_flyer',
      retailerId: options.retailerId,
      campaignType: this.detectCampaignType(extractedDeals),
      totalPages: Math.max(...extractedDeals.map(d => d.pageNumber), 1),
      validityPeriod: {
        startDate: options.flyerStartDate || new Date(),
        endDate: options.flyerEndDate || this.getDefaultEndDate()
      }
    };

    // Transform extracted deals to our metadata format
    const deals: WeeklyDealMetadata[] = [];

    for (const extracted of extractedDeals) {
      const deal = this.transformExtractedDeal(extracted, options, document);
      if (deal) {
        deals.push(deal);
      }
    }

    const parseTimeMs = Date.now() - startTime;

    return {
      document,
      deals,
      rawExtractions: extractedDeals,
      parseStats: {
        totalDealsExtracted: deals.length,
        highConfidenceDeals: deals.filter(d => d.extraction.confidence >= 0.8).length,
        lowConfidenceDeals: deals.filter(d => d.extraction.confidence < 0.8).length,
        parseTimeMs
      }
    };
  }

  /**
   * Parse deal from simple input format
   * Useful for manual entry or simple API integrations
   */
  public createDealFromSimpleInput(input: {
    productName: string;
    brand?: string;
    price: number;
    unit?: string;
    regularPrice?: number;
    retailerId?: RetailerId;
    startDate?: Date;
    endDate?: Date;
    isMemberPrice?: boolean;
    requiresClip?: boolean;
    minQuantity?: number;
    maxQuantity?: number;
    category?: string;
  }): WeeklyDealMetadata {
    const normalizedName = this.normalizeProductName(input.productName);
    const category = input.category || this.inferCategory(input.productName);
    const unit = this.parseUnit(input.unit || 'ea');

    const deal: WeeklyDealMetadata = {
      dealId: uuidv4(),
      retailerId: input.retailerId || 'safeway',
      campaignType: 'weekly_ad',
      product: {
        title: input.productName,
        brand: input.brand,
        category
      },
      price: {
        salePrice: Math.floor(input.price),
        priceDecimal: Math.round((input.price % 1) * 100),
        fullPrice: `$${input.price.toFixed(2)}`,
        unit,
        isMemberPrice: input.isMemberPrice || false,
        regularPrice: input.regularPrice,
        savings: input.regularPrice ? input.regularPrice - input.price : undefined,
        savingsPercent: input.regularPrice
          ? Math.round(((input.regularPrice - input.price) / input.regularPrice) * 100)
          : undefined
      },
      constraints: (input.requiresClip || input.minQuantity || input.maxQuantity) ? {
        logicType: input.minQuantity ? 'must_buy' : 'standard',
        minQuantity: input.minQuantity,
        maxQuantity: input.maxQuantity,
        requiresClip: input.requiresClip
      } : undefined,
      validity: {
        startDate: input.startDate || new Date(),
        endDate: input.endDate || this.getDefaultEndDate()
      },
      extraction: {
        pageNumber: 1,
        confidence: 1.0, // Manual entry has full confidence
        extractedAt: new Date()
      },
      matching: {
        normalizedName,
        keywords: this.extractKeywords(input.productName, input.brand)
      }
    };

    return deal;
  }

  /**
   * Transform extracted deal to metadata format
   */
  private transformExtractedDeal(
    extracted: ExtractedDeal,
    options: FlyerParseOptions,
    document: FlyerDocument
  ): WeeklyDealMetadata | null {
    // Parse price
    const priceInt = parseInt(extracted.rawText.priceInt || '0', 10);
    const priceDecimal = parseInt(extracted.rawText.priceDecimal || '0', 10);
    const fullPrice = priceInt + (priceDecimal / 100);

    // Skip if no valid price
    if (fullPrice <= 0) {
      return null;
    }

    const productTitle = extracted.rawText.productTitle || 'Unknown Product';
    const normalizedName = this.normalizeProductName(productTitle);
    const category = this.inferCategory(productTitle);
    const unit = this.parseUnit(extracted.rawText.priceUnit || 'ea');

    // Determine deal logic type
    const logicType = this.determineLogicType(extracted);

    const deal: WeeklyDealMetadata = {
      dealId: uuidv4(),
      retailerId: options.retailerId,
      campaignType: document.campaignType,
      product: {
        title: productTitle,
        brand: extracted.rawText.brand,
        description: extracted.rawText.productDesc,
        category,
        qualityBadges: extracted.visualElements.qualityBadges
      },
      price: {
        salePrice: priceInt,
        priceDecimal,
        fullPrice: `$${fullPrice.toFixed(2)}`,
        unit,
        isMemberPrice: extracted.visualElements.hasMemberPriceBadge
      },
      constraints: {
        logicType,
        requiresClip: extracted.visualElements.hasDigitalCouponTag,
        conditionText: extracted.rawText.constraint
      },
      validity: {
        startDate: document.validityPeriod.startDate,
        endDate: document.validityPeriod.endDate
      },
      extraction: {
        pageNumber: extracted.pageNumber,
        confidence: extracted.confidence,
        extractedAt: new Date()
      },
      matching: {
        normalizedName,
        keywords: this.extractKeywords(productTitle, extracted.rawText.brand)
      }
    };

    // Parse quantity constraints from condition text
    if (extracted.rawText.constraint) {
      const quantityInfo = this.parseQuantityConstraints(extracted.rawText.constraint);
      if (quantityInfo.min) deal.constraints!.minQuantity = quantityInfo.min;
      if (quantityInfo.max) deal.constraints!.maxQuantity = quantityInfo.max;
    }

    return deal;
  }

  /**
   * Detect campaign type from extracted deals
   */
  private detectCampaignType(deals: ExtractedDeal[]): CampaignType {
    // Check for Friday special indicators
    const hasFridayDeals = deals.some(d =>
      d.rawText.dateRange?.toLowerCase().includes('friday') ||
      d.rawText.productDesc?.toLowerCase().includes('friday')
    );
    if (hasFridayDeals) return 'friday_special';

    // Check for coupon sheet (high concentration of digital coupons)
    const clipDeals = deals.filter(d => d.visualElements.hasDigitalCouponTag);
    if (clipDeals.length / deals.length > 0.8) return 'coupon_sheet';

    // Check for event special
    const hasEventIndicators = deals.some(d =>
      d.rawText.constraint?.toLowerCase().includes('2-day') ||
      d.rawText.constraint?.toLowerCase().includes('double discount')
    );
    if (hasEventIndicators) return 'event_special';

    return 'weekly_ad';
  }

  /**
   * Determine deal logic type from extracted data
   */
  private determineLogicType(extracted: ExtractedDeal): DealLogicType {
    const constraint = (extracted.rawText.constraint || '').toLowerCase();
    const badge = extracted.visualElements.dealBadgeType;

    if (badge === 'bogo' || constraint.includes('buy 1 get 1') || constraint.includes('bogo')) {
      return 'bogo';
    }
    if (badge === 'mix_match' || constraint.includes('mix & match') || constraint.includes('mix and match')) {
      return 'mix_match';
    }
    if (badge === 'multiplier' || constraint.includes('2x') || constraint.includes('4x')) {
      return 'points_multiplier';
    }
    if (constraint.includes('when you buy') || constraint.includes('must buy')) {
      return 'must_buy';
    }
    if (constraint.includes('% off') || constraint.includes('percent off')) {
      return 'percentage_off';
    }
    if (extracted.visualElements.hasDigitalCouponTag) {
      return 'digital_coupon';
    }

    return 'standard';
  }

  /**
   * Parse quantity constraints from condition text
   */
  private parseQuantityConstraints(text: string): { min?: number; max?: number } {
    const result: { min?: number; max?: number } = {};

    // Parse "when you buy X" patterns
    const buyMatch = text.match(/when you buy (\d+)/i);
    if (buyMatch) {
      result.min = parseInt(buyMatch[1], 10);
    }

    // Parse "limit X" patterns
    const limitMatch = text.match(/limit (\d+)/i);
    if (limitMatch) {
      result.max = parseInt(limitMatch[1], 10);
    }

    return result;
  }

  /**
   * Normalize product name for matching
   */
  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[®™©]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  /**
   * Extract keywords from product name and brand
   */
  private extractKeywords(productName: string, brand?: string): string[] {
    const words = new Set<string>();

    // Add words from product name
    const normalized = this.normalizeProductName(productName);
    normalized.split(' ').forEach(word => {
      if (word.length > 2) words.add(word);
    });

    // Add brand if present
    if (brand) {
      words.add(brand.toLowerCase());
    }

    return Array.from(words);
  }

  /**
   * Infer product category from name
   */
  private inferCategory(productName: string): string {
    const normalized = productName.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(keyword => normalized.includes(keyword))) {
        return category;
      }
    }

    return 'other';
  }

  /**
   * Parse unit string to enum
   */
  private parseUnit(unitStr: string): PriceUnit {
    const normalized = unitStr.toLowerCase().trim();

    const unitMap: Record<string, PriceUnit> = {
      'lb': 'lb',
      'pound': 'lb',
      'ea': 'ea',
      'each': 'ea',
      'oz': 'oz',
      'ounce': 'oz',
      'ct': 'ct',
      'count': 'ct',
      'pk': 'pk',
      'pack': 'pk',
      'gal': 'gal',
      'gallon': 'gal',
      'l': 'l',
      'liter': 'l'
    };

    return unitMap[normalized] || 'ea';
  }

  /**
   * Get default end date (1 week from now)
   */
  private getDefaultEndDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  }

  /**
   * Get retailer configuration
   */
  public getRetailerConfig(retailerId: RetailerId): RetailerConfig {
    return this.retailerConfigs[retailerId];
  }

  /**
   * List supported retailers
   */
  public getSupportedRetailers(): RetailerConfig[] {
    return Object.values(this.retailerConfigs);
  }
}

// Export singleton
export const flyerParserService = new FlyerParserService();
