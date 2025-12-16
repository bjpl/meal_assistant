/**
 * Price Intelligence Service
 * Orchestrates deal matching, price tracking, and smart shopping recommendations
 *
 * Strategic Integration:
 * - Uses RAGService patterns for contextual recommendations
 * - Leverages DealMatcherService for semantic deal search
 * - Integrates with FlyerParserService for data ingestion
 * - Connects to existing inventory and shopping list services
 */

import { FlyerParserService, flyerParserService, FlyerParseOptions } from './flyer-parser.service';
import { DealMatcherService, dealMatcherService, DealMatchOptions } from './deal-matcher.service';
import {
  WeeklyDealMetadata,
  ExtractedDeal,
  DealMatch,
  ShoppingListDealAnalysis,
  PriceHistoryEntry,
  PriceTrend,
  RetailerId,
  FlyerDocument
} from '../vector/types/deals.types';

// ============================================================================
// Price Intelligence Types
// ============================================================================

export interface SmartShoppingRecommendation {
  /** Recommended items to buy now (on sale) */
  buyNow: Array<{
    item: string;
    deal: DealMatch;
    urgency: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  /** Items to wait on (better deals expected) */
  waitFor: Array<{
    item: string;
    reason: string;
    expectedSaleDate?: Date;
  }>;
  /** Substitute recommendations */
  alternatives: Array<{
    originalItem: string;
    substitute: string;
    deal?: DealMatch;
    savingsVsOriginal: number;
  }>;
  /** Total potential savings */
  totalSavings: number;
  /** Confidence in recommendations */
  confidence: number;
}

export interface MealPlanDealIntegration {
  /** Meal being planned */
  mealName: string;
  /** Ingredients needed */
  ingredients: string[];
  /** Available deals for ingredients */
  ingredientDeals: Map<string, DealMatch[]>;
  /** Estimated cost with deals */
  estimatedCostWithDeals: number;
  /** Estimated cost without deals */
  estimatedCostWithoutDeals: number;
  /** Recommended shopping date */
  recommendedShoppingDate?: Date;
}

// ============================================================================
// Price Intelligence Service
// ============================================================================

/**
 * Price Intelligence Service
 * Central service for all price-related intelligence and recommendations
 */
export class PriceIntelligenceService {
  private priceHistory: Map<string, PriceHistoryEntry[]> = new Map();

  constructor(
    private flyerParser: FlyerParserService,
    private dealMatcher: DealMatcherService
  ) {}

  // ============================================================================
  // Flyer Ingestion
  // ============================================================================

  /**
   * Ingest deals from extracted flyer data
   * This accepts pre-extracted deals (e.g., from Claude Vision API processing)
   */
  public async ingestFlyerDeals(
    extractedDeals: ExtractedDeal[],
    options: FlyerParseOptions
  ): Promise<{
    document: FlyerDocument;
    dealsIndexed: number;
    failedDeals: number;
  }> {
    // Parse extracted data into our format
    const parseResult = await this.flyerParser.parseFromExtractedData(
      extractedDeals,
      options
    );

    // Index all deals for searching
    const indexResult = await this.dealMatcher.indexDeals(parseResult.deals);

    // Track price history
    for (const deal of parseResult.deals) {
      this.trackPrice(deal);
    }

    return {
      document: parseResult.document,
      dealsIndexed: indexResult.indexed,
      failedDeals: indexResult.failed
    };
  }

  /**
   * Quick add a single deal (for manual entry or API integration)
   */
  public async addDeal(input: {
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
  }): Promise<WeeklyDealMetadata> {
    const deal = this.flyerParser.createDealFromSimpleInput(input);
    await this.dealMatcher.indexDeal(deal);
    this.trackPrice(deal);
    return deal;
  }

  // ============================================================================
  // Deal Discovery
  // ============================================================================

  /**
   * Find deals for items on a shopping list
   */
  public async findDealsForShoppingList(
    items: string[],
    options?: DealMatchOptions
  ): Promise<ShoppingListDealAnalysis> {
    return this.dealMatcher.analyzeShoppingList(items, options);
  }

  /**
   * Search deals by query
   */
  public async searchDeals(
    query: string,
    options?: DealMatchOptions
  ): Promise<DealMatch[]> {
    return this.dealMatcher.searchDeals(query, options);
  }

  /**
   * Get best deals in a category
   */
  public async getBestDeals(
    category?: string,
    limit: number = 10
  ): Promise<DealMatch[]> {
    if (category) {
      return this.dealMatcher.getBestDealsByCategory(category, limit);
    }
    // General best deals
    return this.dealMatcher.searchDeals('best grocery deals savings', {
      maxDealsPerItem: limit
    });
  }

  /**
   * Get deals expiring soon
   */
  public async getExpiringDeals(withinDays: number = 2): Promise<WeeklyDealMetadata[]> {
    return this.dealMatcher.getExpiringDeals(withinDays);
  }

  // ============================================================================
  // Smart Recommendations
  // ============================================================================

  /**
   * Generate smart shopping recommendations based on user context
   */
  public async getSmartRecommendations(context: {
    shoppingList?: string[];
    inventory?: string[];
    upcomingMeals?: string[];
    preferredStores?: RetailerId[];
    budget?: number;
  }): Promise<SmartShoppingRecommendation> {
    const buyNow: SmartShoppingRecommendation['buyNow'] = [];
    const waitFor: SmartShoppingRecommendation['waitFor'] = [];
    const alternatives: SmartShoppingRecommendation['alternatives'] = [];
    let totalSavings = 0;

    // Analyze shopping list items
    if (context.shoppingList && context.shoppingList.length > 0) {
      const analysis = await this.findDealsForShoppingList(
        context.shoppingList,
        { retailerIds: context.preferredStores }
      );

      // Categorize items by deal availability and urgency
      for (const itemWithDeals of analysis.itemsWithDeals) {
        const bestDeal = itemWithDeals.bestDeal;
        if (!bestDeal) continue;

        const daysUntilExpiry = this.getDaysUntilExpiry(bestDeal.deal);
        const urgency = daysUntilExpiry <= 2 ? 'high' : daysUntilExpiry <= 5 ? 'medium' : 'low';

        buyNow.push({
          item: itemWithDeals.item,
          deal: bestDeal,
          urgency,
          reason: this.generateBuyReason(bestDeal, daysUntilExpiry)
        });

        totalSavings += bestDeal.potentialSavings || 0;

        // Check for better alternatives
        const substitutes = itemWithDeals.deals.filter(d => d.matchType === 'substitute');
        for (const sub of substitutes) {
          if (sub.potentialSavings && sub.potentialSavings > (bestDeal.potentialSavings || 0)) {
            alternatives.push({
              originalItem: itemWithDeals.item,
              substitute: sub.deal.product.title,
              deal: sub,
              savingsVsOriginal: sub.potentialSavings - (bestDeal.potentialSavings || 0)
            });
          }
        }
      }

      // Items without deals - check price history for patterns
      for (const item of analysis.itemsWithoutDeals) {
        const trend = this.getPriceTrend(item);
        if (trend && !trend.isGoodTimeToBuy) {
          waitFor.push({
            item,
            reason: `Price is ${trend.currentVsAverage} average. Consider waiting for a sale.`
          });
        }
      }
    }

    // Sort by urgency
    buyNow.sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    return {
      buyNow,
      waitFor,
      alternatives,
      totalSavings,
      confidence: this.calculateRecommendationConfidence(buyNow, waitFor)
    };
  }

  /**
   * Integrate deals with meal planning
   */
  public async analyzeMealPlanDeals(mealPlan: {
    meals: Array<{ name: string; ingredients: string[] }>;
    preferredStores?: RetailerId[];
  }): Promise<MealPlanDealIntegration[]> {
    const results: MealPlanDealIntegration[] = [];

    for (const meal of mealPlan.meals) {
      const ingredientDeals = new Map<string, DealMatch[]>();
      let estimatedSavings = 0;

      for (const ingredient of meal.ingredients) {
        const deals = await this.dealMatcher.findDealsForItem(ingredient, {
          retailerIds: mealPlan.preferredStores,
          maxDealsPerItem: 3
        });

        if (deals.length > 0) {
          ingredientDeals.set(ingredient, deals);
          estimatedSavings += deals[0].potentialSavings || 0;
        }
      }

      // Find recommended shopping date (when most deals are valid)
      const allDeals = Array.from(ingredientDeals.values()).flat();
      const recommendedDate = this.findOptimalShoppingDate(allDeals);

      results.push({
        mealName: meal.name,
        ingredients: meal.ingredients,
        ingredientDeals,
        estimatedCostWithDeals: 0, // Would need price data
        estimatedCostWithoutDeals: 0,
        recommendedShoppingDate: recommendedDate
      });
    }

    return results;
  }

  // ============================================================================
  // Price Tracking
  // ============================================================================

  /**
   * Track a price observation
   */
  private trackPrice(deal: WeeklyDealMetadata): void {
    const productId = deal.matching.normalizedName;
    const fullPrice = deal.price.salePrice + (deal.price.priceDecimal || 0) / 100;

    const entry: PriceHistoryEntry = {
      productId,
      retailerId: deal.retailerId,
      price: fullPrice,
      unit: deal.price.unit,
      observedDate: new Date(),
      wasSalePrice: true,
      sourceDealId: deal.dealId
    };

    if (!this.priceHistory.has(productId)) {
      this.priceHistory.set(productId, []);
    }
    this.priceHistory.get(productId)!.push(entry);
  }

  /**
   * Get price trend for a product
   */
  public getPriceTrend(productName: string): PriceTrend | null {
    const normalized = productName.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const history = this.priceHistory.get(normalized);

    if (!history || history.length === 0) {
      return null;
    }

    const prices = history.map(h => h.price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const currentPrice = prices[prices.length - 1];

    let currentVsAverage: 'below' | 'average' | 'above';
    if (currentPrice < avgPrice * 0.9) {
      currentVsAverage = 'below';
    } else if (currentPrice > avgPrice * 1.1) {
      currentVsAverage = 'above';
    } else {
      currentVsAverage = 'average';
    }

    return {
      productId: normalized,
      averagePrice: avgPrice,
      lowestPrice,
      highestPrice,
      currentVsAverage,
      isGoodTimeToBuy: currentVsAverage === 'below',
      history
    };
  }

  /**
   * Get price history for a product
   */
  public getPriceHistory(productName: string): PriceHistoryEntry[] {
    const normalized = productName.toLowerCase().replace(/[^\w\s]/g, '').trim();
    return this.priceHistory.get(normalized) || [];
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get days until deal expires
   */
  private getDaysUntilExpiry(deal: WeeklyDealMetadata): number {
    const now = new Date();
    const endDate = new Date(deal.validity.endDate);
    return Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Generate reason to buy now
   */
  private generateBuyReason(deal: DealMatch, daysUntilExpiry: number): string {
    const parts: string[] = [];

    if (deal.potentialSavings) {
      parts.push(`Save $${deal.potentialSavings.toFixed(2)}`);
    }

    if (daysUntilExpiry <= 2) {
      parts.push(`Deal expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`);
    }

    if (deal.deal.constraints?.logicType === 'bogo') {
      parts.push('Buy One Get One deal');
    }

    return parts.join('. ') || 'Good deal available';
  }

  /**
   * Find optimal shopping date when most deals overlap
   */
  private findOptimalShoppingDate(deals: DealMatch[]): Date | undefined {
    if (deals.length === 0) return undefined;

    // Simple approach: find the earliest end date
    // More sophisticated would find date ranges with most overlap
    const endDates = deals.map(d => new Date(d.deal.validity.endDate));
    endDates.sort((a, b) => a.getTime() - b.getTime());

    // Return a day before the earliest expiration
    const earliest = endDates[0];
    const recommended = new Date(earliest);
    recommended.setDate(recommended.getDate() - 1);

    return recommended;
  }

  /**
   * Calculate confidence in recommendations
   */
  private calculateRecommendationConfidence(
    buyNow: SmartShoppingRecommendation['buyNow'],
    waitFor: SmartShoppingRecommendation['waitFor']
  ): number {
    if (buyNow.length === 0 && waitFor.length === 0) {
      return 0.3; // Low confidence with no data
    }

    // Base confidence on deal quality
    const avgScore = buyNow.length > 0
      ? buyNow.reduce((sum, b) => sum + b.deal.score, 0) / buyNow.length
      : 0.5;

    return Math.min(avgScore * 1.1, 0.95);
  }

  /**
   * Get supported retailers
   */
  public getSupportedRetailers() {
    return this.flyerParser.getSupportedRetailers();
  }

  /**
   * Get deal statistics
   */
  public async getStats() {
    return this.dealMatcher.getStats();
  }

  /**
   * Clear all deals (for testing or reset)
   */
  public async clearAllDeals(): Promise<void> {
    await this.dealMatcher.clearDeals();
    this.priceHistory.clear();
  }
}

// Export singleton
export const priceIntelligenceService = new PriceIntelligenceService(
  flyerParserService,
  dealMatcherService
);
