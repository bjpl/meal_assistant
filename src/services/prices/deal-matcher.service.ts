/**
 * Deal Matcher Service
 * Semantically matches deals to user inventory, shopping lists, and preferences
 *
 * Strategic Integration:
 * - Extends SemanticSearchService patterns for deal-specific matching
 * - Leverages existing RuVectorService for vector operations
 * - Uses SubstitutionService to find deals on alternative products
 * - Integrates with EmbeddingService for semantic similarity
 */

import { RuVectorService, ruVectorService } from '../vector/core/ruvector.service';
import { EmbeddingService, embeddingService } from '../vector/core/embedding.service';
import { getSubstitutionService } from '../vector/substitution/substitution.service';
import {
  WeeklyDealMetadata,
  DealMatch,
  ShoppingListDealAnalysis,
  DEAL_COLLECTION_NAMES,
  RetailerId
} from '../vector/types/deals.types';
import { VectorFilter } from '../vector/types';

// ============================================================================
// Deal Matcher Configuration
// ============================================================================

export interface DealMatchOptions {
  /** Minimum similarity score to consider a match */
  minScore?: number;
  /** Maximum number of deals to return per item */
  maxDealsPerItem?: number;
  /** Include substitute product deals */
  includeSubstitutes?: boolean;
  /** Filter by retailer */
  retailerIds?: RetailerId[];
  /** Only include currently valid deals */
  validOnly?: boolean;
  /** User's dietary restrictions for filtering */
  dietaryRestrictions?: string[];
}

const DEFAULT_OPTIONS: DealMatchOptions = {
  minScore: 0.5,
  maxDealsPerItem: 5,
  includeSubstitutes: true,
  validOnly: true
};

// ============================================================================
// Deal Matcher Service
// ============================================================================

/**
 * Deal Matcher Service
 * Finds relevant deals for items using semantic search and substitution logic
 */
export class DealMatcherService {
  private collectionInitialized = false;

  constructor(
    private vectorService: RuVectorService,
    private embedding: EmbeddingService
  ) {}

  /**
   * Initialize the deals collection
   */
  public async initialize(): Promise<void> {
    if (this.collectionInitialized) return;

    await this.vectorService.initialize();
    await this.vectorService.createCollection(
      DEAL_COLLECTION_NAMES.WEEKLY_DEALS,
      this.embedding.getDimensions()
    );

    this.collectionInitialized = true;
  }

  /**
   * Index a deal for searching
   */
  public async indexDeal(deal: WeeklyDealMetadata): Promise<void> {
    await this.initialize();

    // Create embedding from deal information
    const textToEmbed = this.createDealEmbeddingText(deal);
    const embedding = await this.embedding.embed(textToEmbed, { normalize: true });

    await this.vectorService.upsert(DEAL_COLLECTION_NAMES.WEEKLY_DEALS, {
      id: deal.dealId,
      embedding,
      metadata: deal,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Index multiple deals
   */
  public async indexDeals(deals: WeeklyDealMetadata[]): Promise<{ indexed: number; failed: number }> {
    await this.initialize();

    let indexed = 0;
    let failed = 0;

    for (const deal of deals) {
      try {
        await this.indexDeal(deal);
        indexed++;
      } catch (error) {
        console.error(`Failed to index deal ${deal.dealId}:`, error);
        failed++;
      }
    }

    return { indexed, failed };
  }

  /**
   * Find deals matching a single item
   */
  public async findDealsForItem(
    itemName: string,
    options: DealMatchOptions = {}
  ): Promise<DealMatch[]> {
    await this.initialize();

    const opts = { ...DEFAULT_OPTIONS, ...options };
    const results: DealMatch[] = [];

    // Create embedding for the item
    const embedding = await this.embedding.embed(
      `grocery deal for ${itemName}`,
      { normalize: true }
    );

    // Build filter
    const filter = this.buildDealFilter(opts);

    // Search for matching deals
    const searchResults = await this.vectorService.search<WeeklyDealMetadata>(
      DEAL_COLLECTION_NAMES.WEEKLY_DEALS,
      {
        vector: embedding,
        topK: opts.maxDealsPerItem! * 2, // Get extra for filtering
        threshold: opts.minScore,
        filter
      }
    );

    // Transform to DealMatch format
    for (const result of searchResults) {
      const deal = result.document;
      const matchType = this.determineMatchType(itemName, deal);

      results.push({
        deal,
        score: result.score,
        matchReason: this.generateMatchReason(itemName, deal, matchType),
        matchType,
        potentialSavings: deal.price.savings
      });
    }

    // If substitutes enabled, find deals on substitute products
    if (opts.includeSubstitutes && results.length < opts.maxDealsPerItem!) {
      const substituteDeals = await this.findSubstituteDeals(
        itemName,
        opts,
        results.map(r => r.deal.dealId)
      );
      results.push(...substituteDeals);
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, opts.maxDealsPerItem);
  }

  /**
   * Analyze a shopping list for available deals
   */
  public async analyzeShoppingList(
    items: string[],
    options: DealMatchOptions = {}
  ): Promise<ShoppingListDealAnalysis> {
    const itemsWithDeals: ShoppingListDealAnalysis['itemsWithDeals'] = [];
    const itemsWithoutDeals: string[] = [];
    let totalPotentialSavings = 0;

    // Find deals for each item
    for (const item of items) {
      const deals = await this.findDealsForItem(item, options);

      if (deals.length > 0) {
        const bestDeal = deals[0];
        itemsWithDeals.push({
          item,
          deals,
          bestDeal
        });

        if (bestDeal.potentialSavings) {
          totalPotentialSavings += bestDeal.potentialSavings;
        }
      } else {
        itemsWithoutDeals.push(item);
      }
    }

    // Group deals by validity period for recommended trips
    const recommendedTrips = this.groupDealsByValidity(
      itemsWithDeals.flatMap(i => i.deals)
    );

    return {
      itemsWithDeals,
      itemsWithoutDeals,
      totalPotentialSavings,
      recommendedTrips
    };
  }

  /**
   * Search deals by query
   */
  public async searchDeals(
    query: string,
    options: DealMatchOptions = {}
  ): Promise<DealMatch[]> {
    await this.initialize();

    const opts = { ...DEFAULT_OPTIONS, ...options };

    const embedding = await this.embedding.embed(query, { normalize: true });
    const filter = this.buildDealFilter(opts);

    const searchResults = await this.vectorService.search<WeeklyDealMetadata>(
      DEAL_COLLECTION_NAMES.WEEKLY_DEALS,
      {
        vector: embedding,
        topK: opts.maxDealsPerItem! * 2,
        threshold: opts.minScore,
        filter
      }
    );

    return searchResults.map(result => ({
      deal: result.document,
      score: result.score,
      matchReason: `Matched query: "${query}"`,
      matchType: 'similar' as const
    }));
  }

  /**
   * Get best deals by category
   */
  public async getBestDealsByCategory(
    category: string,
    limit: number = 10,
    options: DealMatchOptions = {}
  ): Promise<DealMatch[]> {
    return this.searchDeals(`best ${category} deals`, {
      ...options,
      maxDealsPerItem: limit
    });
  }

  /**
   * Get deals expiring soon
   */
  public async getExpiringDeals(
    withinDays: number = 2
  ): Promise<WeeklyDealMetadata[]> {
    await this.initialize();

    const now = new Date();
    const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    // Search all deals and filter by expiration
    const allDeals = await this.vectorService.search<WeeklyDealMetadata>(
      DEAL_COLLECTION_NAMES.WEEKLY_DEALS,
      {
        vector: new Array(this.embedding.getDimensions()).fill(0.1), // Neutral vector
        topK: 100
      }
    );

    return allDeals
      .map(r => r.document)
      .filter(deal => {
        const endDate = new Date(deal.validity.endDate);
        return endDate >= now && endDate <= cutoff;
      })
      .sort((a, b) =>
        new Date(a.validity.endDate).getTime() - new Date(b.validity.endDate).getTime()
      );
  }

  /**
   * Find deals on substitute products
   */
  private async findSubstituteDeals(
    itemName: string,
    options: DealMatchOptions,
    excludeDealIds: string[]
  ): Promise<DealMatch[]> {
    const results: DealMatch[] = [];

    try {
      const substitutionService = getSubstitutionService();
      const substitutions = await substitutionService.getSubstitutions({
        ingredient: itemName,
        maxSuggestions: 5
      });

      if (!substitutions.found) return results;

      // Search for deals on each substitute
      for (const sub of substitutions.suggestions.slice(0, 3)) {
        const embedding = await this.embedding.embed(
          `grocery deal for ${sub.substitute}`,
          { normalize: true }
        );

        const searchResults = await this.vectorService.search<WeeklyDealMetadata>(
          DEAL_COLLECTION_NAMES.WEEKLY_DEALS,
          {
            vector: embedding,
            topK: 2,
            threshold: options.minScore || 0.6
          }
        );

        for (const result of searchResults) {
          if (excludeDealIds.includes(result.document.dealId)) continue;

          results.push({
            deal: result.document,
            score: result.score * sub.confidence, // Discount by substitution confidence
            matchReason: `${sub.substitute} is a substitute for ${itemName}: ${sub.reason}`,
            matchType: 'substitute',
            substituteFor: itemName,
            potentialSavings: result.document.price.savings
          });
        }
      }
    } catch (error) {
      console.error('Error finding substitute deals:', error);
    }

    return results;
  }

  /**
   * Build filter for deal search
   */
  private buildDealFilter(options: DealMatchOptions): VectorFilter {
    const filter: VectorFilter = {};

    if (options.retailerIds && options.retailerIds.length > 0) {
      filter.in = { retailerId: options.retailerIds };
    }

    if (options.validOnly) {
      const now = new Date();
      filter.dateRange = {
        'validity.endDate': { start: now }
      };
    }

    return filter;
  }

  /**
   * Determine match type based on item and deal
   */
  private determineMatchType(
    itemName: string,
    deal: WeeklyDealMetadata
  ): 'exact' | 'similar' | 'substitute' {
    const itemNormalized = itemName.toLowerCase();
    const dealNormalized = deal.matching.normalizedName;

    // Check for exact match
    if (dealNormalized.includes(itemNormalized) || itemNormalized.includes(dealNormalized)) {
      return 'exact';
    }

    // Check if any keywords match
    const itemWords = itemNormalized.split(' ');
    const matchedKeywords = deal.matching.keywords.filter(k =>
      itemWords.some(w => w.includes(k) || k.includes(w))
    );

    if (matchedKeywords.length > 0) {
      return 'similar';
    }

    return 'substitute';
  }

  /**
   * Generate human-readable match reason
   */
  private generateMatchReason(
    itemName: string,
    deal: WeeklyDealMetadata,
    matchType: 'exact' | 'similar' | 'substitute'
  ): string {
    const savings = deal.price.savings
      ? `Save $${deal.price.savings.toFixed(2)}`
      : '';

    switch (matchType) {
      case 'exact':
        return `Direct match for "${itemName}". ${savings}`.trim();
      case 'similar':
        return `Similar to "${itemName}" - ${deal.product.title}. ${savings}`.trim();
      case 'substitute':
        return `Alternative option for "${itemName}". ${savings}`.trim();
    }
  }

  /**
   * Group deals by validity for trip planning
   */
  private groupDealsByValidity(
    deals: DealMatch[]
  ): ShoppingListDealAnalysis['recommendedTrips'] {
    const tripMap = new Map<string, { date: Date; deals: DealMatch[]; savings: number }>();

    for (const deal of deals) {
      const endDate = new Date(deal.deal.validity.endDate);
      const dateKey = endDate.toISOString().split('T')[0];

      if (!tripMap.has(dateKey)) {
        tripMap.set(dateKey, { date: endDate, deals: [], savings: 0 });
      }

      const trip = tripMap.get(dateKey)!;
      trip.deals.push(deal);
      trip.savings += deal.potentialSavings || 0;
    }

    return Array.from(tripMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Create text for embedding a deal
   */
  private createDealEmbeddingText(deal: WeeklyDealMetadata): string {
    const parts = [
      deal.product.title,
      deal.product.brand,
      deal.product.description,
      deal.product.category,
      ...deal.matching.keywords
    ].filter(Boolean);

    return parts.join(' ');
  }

  /**
   * Clear all indexed deals
   */
  public async clearDeals(): Promise<void> {
    await this.initialize();
    await this.vectorService.clear(DEAL_COLLECTION_NAMES.WEEKLY_DEALS);
  }

  /**
   * Get deal statistics
   */
  public async getStats(): Promise<{
    totalDeals: number;
    byRetailer: Record<string, number>;
    avgSavings: number;
  }> {
    await this.initialize();

    const stats = await this.vectorService.getStats(DEAL_COLLECTION_NAMES.WEEKLY_DEALS);

    // For detailed stats, we'd need to iterate deals
    // This is a simplified version
    return {
      totalDeals: stats.totalDocuments,
      byRetailer: {},
      avgSavings: 0
    };
  }
}

// Export singleton
export const dealMatcherService = new DealMatcherService(
  ruVectorService,
  embeddingService
);
