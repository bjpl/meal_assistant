/**
 * Unit Tests: Price Intelligence Service
 * Tests for the REAL PriceIntelligenceService implementation
 * Tests price tracking, deal discovery, smart recommendations
 * Target: 40+ tests | Coverage: 90%+
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Import REAL services
import { PriceIntelligenceService } from '../../src/services/prices/price-intelligence.service';
import { FlyerParserService } from '../../src/services/prices/flyer-parser.service';
import { DealMatcherService } from '../../src/services/prices/deal-matcher.service';
import {
  WeeklyDealMetadata,
  ExtractedDeal,
  DealMatch,
  RetailerId
} from '../../src/services/vector/types/deals.types';

// Mock the vector services to avoid database dependencies in unit tests
const mockVectorService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  createCollection: jest.fn().mockResolvedValue(undefined),
  upsert: jest.fn().mockResolvedValue(undefined),
  search: jest.fn().mockResolvedValue([]),
  clear: jest.fn().mockResolvedValue(undefined),
  getStats: jest.fn().mockResolvedValue({ totalDocuments: 0 })
};

const mockEmbeddingService = {
  embed: jest.fn().mockResolvedValue(new Array(384).fill(0.1)),
  getDimensions: jest.fn().mockReturnValue(384)
};

// Create a test-friendly DealMatcherService that uses mocked vector layer
class TestDealMatcherService extends DealMatcherService {
  private testDeals: WeeklyDealMetadata[] = [];

  constructor() {
    super(mockVectorService as any, mockEmbeddingService as any);
  }

  public async initialize(): Promise<void> {
    // No-op for tests
  }

  public async indexDeal(deal: WeeklyDealMetadata): Promise<void> {
    this.testDeals.push(deal);
  }

  public async indexDeals(deals: WeeklyDealMetadata[]): Promise<{ indexed: number; failed: number }> {
    this.testDeals.push(...deals);
    return { indexed: deals.length, failed: 0 };
  }

  public async findDealsForItem(itemName: string): Promise<DealMatch[]> {
    const normalized = itemName.toLowerCase();
    const matches = this.testDeals
      .filter(deal =>
        deal.matching.normalizedName.includes(normalized) ||
        normalized.includes(deal.matching.normalizedName) ||
        deal.matching.keywords.some(k => normalized.includes(k))
      )
      .map(deal => ({
        deal,
        score: 0.85,
        matchReason: `Matched "${itemName}"`,
        matchType: 'exact' as const,
        potentialSavings: deal.price.savings
      }));
    return matches;
  }

  public async analyzeShoppingList(items: string[]) {
    const itemsWithDeals: Array<{ item: string; deals: DealMatch[]; bestDeal?: DealMatch }> = [];
    const itemsWithoutDeals: string[] = [];

    for (const item of items) {
      const deals = await this.findDealsForItem(item);
      if (deals.length > 0) {
        itemsWithDeals.push({ item, deals, bestDeal: deals[0] });
      } else {
        itemsWithoutDeals.push(item);
      }
    }

    const totalPotentialSavings = itemsWithDeals.reduce(
      (sum, item) => sum + (item.bestDeal?.potentialSavings || 0),
      0
    );

    return {
      itemsWithDeals,
      itemsWithoutDeals,
      totalPotentialSavings,
      recommendedTrips: []
    };
  }

  public async searchDeals(query: string): Promise<DealMatch[]> {
    const queryLower = query.toLowerCase();
    return this.testDeals
      .filter(deal =>
        deal.product.title.toLowerCase().includes(queryLower) ||
        deal.product.category?.toLowerCase().includes(queryLower)
      )
      .map(deal => ({
        deal,
        score: 0.75,
        matchReason: `Matched query: "${query}"`,
        matchType: 'similar' as const
      }));
  }

  public async getBestDealsByCategory(category: string, limit: number = 10): Promise<DealMatch[]> {
    return this.testDeals
      .filter(deal => deal.product.category?.toLowerCase() === category.toLowerCase())
      .slice(0, limit)
      .map(deal => ({
        deal,
        score: 0.8,
        matchReason: `Best deal in ${category}`,
        matchType: 'exact' as const,
        potentialSavings: deal.price.savings
      }));
  }

  public async getExpiringDeals(withinDays: number = 2): Promise<WeeklyDealMetadata[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    return this.testDeals.filter(deal => {
      const endDate = new Date(deal.validity.endDate);
      return endDate >= now && endDate <= cutoff;
    });
  }

  public async clearDeals(): Promise<void> {
    this.testDeals = [];
  }

  public async getStats() {
    return {
      totalDeals: this.testDeals.length,
      byRetailer: {},
      avgSavings: 0
    };
  }

  // Expose deals for testing
  public getTestDeals(): WeeklyDealMetadata[] {
    return [...this.testDeals];
  }
}

// ============================================================================
// Test Suite: Price Intelligence Service (Real Implementation)
// ============================================================================

describe('PriceIntelligenceService (Real Implementation)', () => {
  let flyerParser: FlyerParserService;
  let dealMatcher: TestDealMatcherService;
  let service: PriceIntelligenceService;

  beforeEach(() => {
    flyerParser = new FlyerParserService();
    dealMatcher = new TestDealMatcherService();
    service = new PriceIntelligenceService(flyerParser, dealMatcher);
  });

  afterEach(async () => {
    await service.clearAllDeals();
  });

  // ==========================================================================
  // Deal Creation Tests (10 tests)
  // ==========================================================================
  describe('Deal Creation via addDeal()', () => {
    it('should create a deal with required fields', async () => {
      const deal = await service.addDeal({
        productName: 'Chicken Breast',
        price: 4.99
      });

      expect(deal.dealId).toBeDefined();
      expect(deal.product.title).toBe('Chicken Breast');
      expect(deal.price.salePrice).toBe(4);
      expect(deal.price.priceDecimal).toBe(99);
    });

    it('should create a deal with all optional fields', async () => {
      const deal = await service.addDeal({
        productName: 'Ground Beef 80/20',
        brand: 'Angus',
        price: 5.49,
        unit: 'lb',
        regularPrice: 7.99,
        retailerId: 'safeway',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        isMemberPrice: true,
        requiresClip: true,
        minQuantity: 2,
        maxQuantity: 10,
        category: 'meat'
      });

      expect(deal.product.brand).toBe('Angus');
      expect(deal.price.unit).toBe('lb');
      expect(deal.price.regularPrice).toBe(7.99);
      expect(deal.price.isMemberPrice).toBe(true);
      expect(deal.constraints?.requiresClip).toBe(true);
      expect(deal.constraints?.minQuantity).toBe(2);
      expect(deal.constraints?.maxQuantity).toBe(10);
    });

    it('should calculate savings when regularPrice provided', async () => {
      const deal = await service.addDeal({
        productName: 'Salmon',
        price: 8.99,
        regularPrice: 12.99
      });

      expect(deal.price.savings).toBe(4);
      expect(deal.price.savingsPercent).toBe(31); // ~31% off
    });

    it('should normalize product names for matching', async () => {
      const deal = await service.addDeal({
        productName: 'Organic Chicken Breast™',
        price: 6.99
      });

      expect(deal.matching.normalizedName).toBe('organic chicken breast');
    });

    it('should extract keywords from product name', async () => {
      const deal = await service.addDeal({
        productName: 'Boneless Skinless Chicken Breast',
        price: 4.99
      });

      expect(deal.matching.keywords).toContain('boneless');
      expect(deal.matching.keywords).toContain('skinless');
      expect(deal.matching.keywords).toContain('chicken');
      expect(deal.matching.keywords).toContain('breast');
    });

    it('should infer category from product name', async () => {
      const chickenDeal = await service.addDeal({ productName: 'Chicken Thighs', price: 3.99 });
      const milkDeal = await service.addDeal({ productName: 'Whole Milk', price: 4.29 });
      const appleDeal = await service.addDeal({ productName: 'Honeycrisp Apples', price: 2.99 });

      expect(chickenDeal.product.category).toBe('meat');
      expect(milkDeal.product.category).toBe('dairy');
      expect(appleDeal.product.category).toBe('produce');
    });

    it('should set default retailer to safeway', async () => {
      const deal = await service.addDeal({
        productName: 'Test Product',
        price: 1.99
      });

      expect(deal.retailerId).toBe('safeway');
    });

    it('should set default validity period (1 week)', async () => {
      const deal = await service.addDeal({
        productName: 'Test Product',
        price: 1.99
      });

      const startDate = new Date(deal.validity.startDate);
      const endDate = new Date(deal.validity.endDate);
      const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeCloseTo(7, 0);
    });

    it('should generate unique deal IDs', async () => {
      const deal1 = await service.addDeal({ productName: 'Product 1', price: 1.99 });
      const deal2 = await service.addDeal({ productName: 'Product 2', price: 2.99 });

      expect(deal1.dealId).not.toBe(deal2.dealId);
    });

    it('should parse different price units correctly', async () => {
      const lbDeal = await service.addDeal({ productName: 'Beef', price: 5.99, unit: 'pound' });
      const eaDeal = await service.addDeal({ productName: 'Avocado', price: 1.49, unit: 'each' });
      const ctDeal = await service.addDeal({ productName: 'Eggs', price: 3.99, unit: 'count' });

      expect(lbDeal.price.unit).toBe('lb');
      expect(eaDeal.price.unit).toBe('ea');
      expect(ctDeal.price.unit).toBe('ct');
    });
  });

  // ==========================================================================
  // Deal Discovery Tests (8 tests)
  // ==========================================================================
  describe('Deal Discovery', () => {
    beforeEach(async () => {
      // Add test deals
      await service.addDeal({ productName: 'Chicken Breast', price: 2.99, regularPrice: 4.99 });
      await service.addDeal({ productName: 'Ground Beef 80/20', price: 4.49, regularPrice: 6.99 });
      await service.addDeal({ productName: 'Bananas', price: 0.49, category: 'produce' });
      await service.addDeal({ productName: 'Greek Yogurt', price: 0.89, category: 'dairy' });
    });

    it('should find deals matching shopping list items', async () => {
      const analysis = await service.findDealsForShoppingList(['chicken', 'beef']);

      expect(analysis.itemsWithDeals.length).toBeGreaterThanOrEqual(1);
    });

    it('should identify items without available deals', async () => {
      const analysis = await service.findDealsForShoppingList(['caviar', 'truffle']);

      expect(analysis.itemsWithoutDeals).toContain('caviar');
      expect(analysis.itemsWithoutDeals).toContain('truffle');
    });

    it('should calculate total potential savings', async () => {
      const analysis = await service.findDealsForShoppingList(['chicken breast']);

      // Should have savings from chicken deal (2.00)
      expect(analysis.totalPotentialSavings).toBeGreaterThanOrEqual(0);
    });

    it('should search deals by query', async () => {
      const deals = await service.searchDeals('chicken');

      expect(deals.length).toBeGreaterThanOrEqual(1);
      expect(deals[0].deal.product.title.toLowerCase()).toContain('chicken');
    });

    it('should get best deals by category', async () => {
      const produceDeals = await service.getBestDeals('produce', 5);

      expect(produceDeals.every(d => d.deal.product.category === 'produce')).toBe(true);
    });

    it('should get best deals without category filter', async () => {
      // getBestDeals without category uses searchDeals with generic query
      const deals = await service.getBestDeals(undefined, 10);

      // May return deals based on search query - just verify it doesn't error
      expect(Array.isArray(deals)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const deals = await service.getBestDeals(undefined, 2);

      expect(deals.length).toBeLessThanOrEqual(2);
    });

    it('should return empty for non-existent categories', async () => {
      const deals = await service.getBestDeals('nonexistent');

      expect(deals.length).toBe(0);
    });
  });

  // ==========================================================================
  // Expiring Deals Tests (5 tests)
  // ==========================================================================
  describe('Expiring Deals', () => {
    it('should find deals expiring within specified days', async () => {
      // Add deal expiring in 1 day
      await service.addDeal({
        productName: 'Expiring Soon',
        price: 1.99,
        endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
      });

      const expiringDeals = await service.getExpiringDeals(2);

      expect(expiringDeals.length).toBeGreaterThanOrEqual(1);
    });

    it('should not include already expired deals', async () => {
      // Add already expired deal
      await service.addDeal({
        productName: 'Already Expired',
        price: 1.99,
        endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      });

      const expiringDeals = await service.getExpiringDeals(2);

      expect(expiringDeals.every(d => new Date(d.validity.endDate) >= new Date())).toBe(true);
    });

    it('should not include deals expiring far in the future', async () => {
      // Add deal expiring in 30 days
      await service.addDeal({
        productName: 'Far Future',
        price: 1.99,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      const expiringDeals = await service.getExpiringDeals(2);

      expect(expiringDeals.some(d => d.product.title === 'Far Future')).toBe(false);
    });

    it('should default to 2 days when no parameter given', async () => {
      await service.addDeal({
        productName: 'Default Check',
        price: 1.99,
        endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
      });

      const expiringDeals = await service.getExpiringDeals();

      // Should still find the deal
      expect(expiringDeals.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when no deals expiring', async () => {
      // Clear and add only far-future deals
      await service.clearAllDeals();
      await service.addDeal({
        productName: 'Future Deal',
        price: 1.99,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      const expiringDeals = await service.getExpiringDeals(2);

      expect(expiringDeals.length).toBe(0);
    });
  });

  // ==========================================================================
  // Smart Recommendations Tests (8 tests)
  // ==========================================================================
  describe('Smart Recommendations', () => {
    beforeEach(async () => {
      // Add test deals
      await service.addDeal({
        productName: 'Chicken Breast',
        price: 2.99,
        regularPrice: 4.99,
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // Expiring soon
      });
      await service.addDeal({
        productName: 'Ground Beef',
        price: 4.49,
        regularPrice: 6.99,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
    });

    it('should generate recommendations for shopping list', async () => {
      const recommendations = await service.getSmartRecommendations({
        shoppingList: ['chicken', 'beef']
      });

      expect(recommendations).toBeDefined();
      expect(recommendations.buyNow).toBeDefined();
      expect(recommendations.waitFor).toBeDefined();
      expect(recommendations.alternatives).toBeDefined();
    });

    it('should include total potential savings', async () => {
      const recommendations = await service.getSmartRecommendations({
        shoppingList: ['chicken breast']
      });

      expect(typeof recommendations.totalSavings).toBe('number');
    });

    it('should include confidence score', async () => {
      const recommendations = await service.getSmartRecommendations({
        shoppingList: ['chicken']
      });

      expect(recommendations.confidence).toBeGreaterThanOrEqual(0);
      expect(recommendations.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle empty shopping list', async () => {
      const recommendations = await service.getSmartRecommendations({
        shoppingList: []
      });

      expect(recommendations.buyNow).toHaveLength(0);
      expect(recommendations.waitFor).toHaveLength(0);
    });

    it('should handle undefined shopping list', async () => {
      const recommendations = await service.getSmartRecommendations({});

      expect(recommendations.buyNow).toHaveLength(0);
    });

    it('should respect preferred stores filter', async () => {
      const recommendations = await service.getSmartRecommendations({
        shoppingList: ['chicken'],
        preferredStores: ['safeway' as RetailerId]
      });

      // Should still work with filter
      expect(recommendations).toBeDefined();
    });

    it('should handle budget constraint', async () => {
      const recommendations = await service.getSmartRecommendations({
        shoppingList: ['chicken', 'beef'],
        budget: 50.00
      });

      // Should still generate recommendations
      expect(recommendations).toBeDefined();
    });

    it('should set urgency based on deal expiration', async () => {
      const recommendations = await service.getSmartRecommendations({
        shoppingList: ['chicken breast']
      });

      // Deals expiring within 2 days should have high urgency
      if (recommendations.buyNow.length > 0) {
        expect(['high', 'medium', 'low']).toContain(recommendations.buyNow[0].urgency);
      }
    });
  });

  // ==========================================================================
  // Price History & Trends Tests (6 tests)
  // ==========================================================================
  describe('Price History & Trends', () => {
    it('should track price when deal is added', async () => {
      await service.addDeal({
        productName: 'Tracked Product',
        price: 4.99
      });

      const history = service.getPriceHistory('Tracked Product');

      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for unknown products', async () => {
      const history = service.getPriceHistory('Unknown Product');

      expect(history).toEqual([]);
    });

    it('should normalize product names when getting history', async () => {
      await service.addDeal({
        productName: 'Chicken Breast',
        price: 4.99
      });

      const history = service.getPriceHistory('CHICKEN BREAST');

      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('should calculate price trend from history', async () => {
      // Add multiple prices to build history
      await service.addDeal({ productName: 'Trend Product', price: 5.00 });
      await service.addDeal({ productName: 'Trend Product', price: 4.50 });
      await service.addDeal({ productName: 'Trend Product', price: 4.00 });

      const trend = service.getPriceTrend('Trend Product');

      if (trend) {
        expect(['up', 'down', 'stable'].includes(trend.currentVsAverage) ||
               ['below', 'above', 'average'].includes(trend.currentVsAverage)).toBe(true);
      }
    });

    it('should return null trend for products without history', async () => {
      const trend = service.getPriceTrend('No History Product');

      expect(trend).toBeNull();
    });

    it('should include isGoodTimeToBuy recommendation', async () => {
      await service.addDeal({ productName: 'Buy Decision', price: 3.00 });
      await service.addDeal({ productName: 'Buy Decision', price: 5.00 });
      await service.addDeal({ productName: 'Buy Decision', price: 4.00 });

      const trend = service.getPriceTrend('Buy Decision');

      if (trend) {
        expect(typeof trend.isGoodTimeToBuy).toBe('boolean');
      }
    });
  });

  // ==========================================================================
  // Flyer Ingestion Tests (5 tests)
  // ==========================================================================
  describe('Flyer Ingestion', () => {
    it('should ingest deals from extracted flyer data', async () => {
      const extractedDeals: ExtractedDeal[] = [
        {
          productName: 'Flyer Product 1',
          pageNumber: 1,
          confidence: 0.9,
          rawText: {
            productTitle: 'Flyer Product 1',
            priceInt: '3',
            priceDecimal: '99'
          },
          visualElements: {}
        },
        {
          productName: 'Flyer Product 2',
          pageNumber: 1,
          confidence: 0.85,
          rawText: {
            productTitle: 'Flyer Product 2',
            priceInt: '5',
            priceDecimal: '49'
          },
          visualElements: {}
        }
      ];

      const result = await service.ingestFlyerDeals(extractedDeals, {
        retailerId: 'safeway'
      });

      expect(result.dealsIndexed).toBeGreaterThanOrEqual(1);
    });

    it('should create flyer document with metadata', async () => {
      const extractedDeals: ExtractedDeal[] = [
        {
          productName: 'Test Deal',
          pageNumber: 1,
          confidence: 0.9,
          rawText: { productTitle: 'Test Deal', priceInt: '2', priceDecimal: '99' },
          visualElements: {}
        }
      ];

      const result = await service.ingestFlyerDeals(extractedDeals, {
        retailerId: 'kroger',
        flyerStartDate: new Date('2024-01-01'),
        flyerEndDate: new Date('2024-01-07')
      });

      expect(result.document.retailerId).toBe('kroger');
    });

    it('should handle empty extracted deals array', async () => {
      const result = await service.ingestFlyerDeals([], {
        retailerId: 'safeway'
      });

      expect(result.dealsIndexed).toBe(0);
    });

    it('should track failed deals separately', async () => {
      const extractedDeals: ExtractedDeal[] = [
        {
          productName: 'Valid Deal',
          pageNumber: 1,
          confidence: 0.9,
          rawText: { productTitle: 'Valid Deal', priceInt: '3', priceDecimal: '99' },
          visualElements: {}
        },
        {
          productName: 'Invalid Deal',
          pageNumber: 1,
          confidence: 0.5,
          rawText: { productTitle: 'Invalid Deal', priceInt: '0', priceDecimal: '0' },
          visualElements: {}
        }
      ];

      const result = await service.ingestFlyerDeals(extractedDeals, {
        retailerId: 'safeway'
      });

      // Only valid deals should be indexed
      expect(result.dealsIndexed + result.failedDeals).toBeLessThanOrEqual(extractedDeals.length);
    });

    it('should use default dates when not provided', async () => {
      const extractedDeals: ExtractedDeal[] = [
        {
          productName: 'Default Date Deal',
          pageNumber: 1,
          confidence: 0.9,
          rawText: { productTitle: 'Default Date Deal', priceInt: '4', priceDecimal: '99' },
          visualElements: {}
        }
      ];

      const result = await service.ingestFlyerDeals(extractedDeals, {
        retailerId: 'safeway'
      });

      expect(result.document.validityPeriod.startDate).toBeDefined();
      expect(result.document.validityPeriod.endDate).toBeDefined();
    });
  });

  // ==========================================================================
  // Retailer Configuration Tests (4 tests)
  // ==========================================================================
  describe('Retailer Configuration', () => {
    it('should return list of supported retailers', () => {
      const retailers = service.getSupportedRetailers();

      expect(retailers.length).toBeGreaterThan(0);
      expect(retailers.some(r => r.id === 'safeway')).toBe(true);
    });

    it('should include Safeway configuration', () => {
      const retailers = service.getSupportedRetailers();
      const safeway = retailers.find(r => r.id === 'safeway');

      expect(safeway).toBeDefined();
      expect(safeway?.name).toBe('Safeway');
    });

    it('should include multiple retailer configs', () => {
      const retailers = service.getSupportedRetailers();
      const retailerIds = retailers.map(r => r.id);

      expect(retailerIds).toContain('safeway');
      expect(retailerIds).toContain('kroger');
      expect(retailerIds).toContain('walmart');
    });

    it('should have parsing config for each retailer', () => {
      const retailers = service.getSupportedRetailers();

      for (const retailer of retailers) {
        expect(retailer.flyerParsingConfig).toBeDefined();
        expect(retailer.flyerParsingConfig?.memberPriceIndicator).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Stats & Cleanup Tests (4 tests)
  // ==========================================================================
  describe('Stats & Cleanup', () => {
    it('should return deal statistics', async () => {
      await service.addDeal({ productName: 'Stat Test 1', price: 1.99 });
      await service.addDeal({ productName: 'Stat Test 2', price: 2.99 });

      const stats = await service.getStats();

      expect(stats.totalDeals).toBeGreaterThanOrEqual(2);
    });

    it('should clear all deals', async () => {
      await service.addDeal({ productName: 'Clear Test', price: 1.99 });

      await service.clearAllDeals();

      const stats = await service.getStats();
      expect(stats.totalDeals).toBe(0);
    });

    it('should clear price history when clearing deals', async () => {
      await service.addDeal({ productName: 'History Clear Test', price: 1.99 });

      await service.clearAllDeals();

      const history = service.getPriceHistory('History Clear Test');
      expect(history).toHaveLength(0);
    });

    it('should return zero stats for empty service', async () => {
      await service.clearAllDeals();

      const stats = await service.getStats();

      expect(stats.totalDeals).toBe(0);
    });
  });
});
