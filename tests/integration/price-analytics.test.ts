/**
 * Integration Tests: Price Analytics Pipeline
 * Tests for receipt -> prices -> trends -> predictions flow
 * Tests for ad deals -> quality scores -> stock-up recommendations
 * Tests for patterns -> effectiveness -> recommendations
 * Target: 20 tests | Coverage: 90%+
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================================
// Types (shared across services)
// ============================================================================

interface PriceRecord {
  id: string;
  itemId: string;
  itemName: string;
  price: number;
  unitPrice: number;
  unit: string;
  quantity: number;
  store: string;
  source: 'receipt' | 'ad' | 'manual';
  capturedAt: Date;
  isOnSale: boolean;
}

interface Deal {
  id: string;
  itemId: string;
  itemName: string;
  originalPrice: number;
  salePrice: number;
  store: string;
  startDate: Date;
  endDate: Date;
  source: 'ad' | 'in_store' | 'app';
}

interface ReceiptData {
  store: string;
  date: Date;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    unit: string;
  }>;
  total: number;
}

interface PatternUsage {
  patternId: string;
  date: Date;
  adherence: number;
  calories: number;
}

// ============================================================================
// Integrated Price Analytics System
// ============================================================================

const createIntegratedAnalyticsSystem = () => {
  const priceRecords: PriceRecord[] = [];
  const deals: Deal[] = [];
  const patternUsage: PatternUsage[] = [];
  const userPreferences = {
    dailyCalories: 2000,
    dailyProtein: 130,
    preferredStores: ['Costco', 'Safeway', 'Walmart']
  };

  return {
    // Receipt Processing Pipeline
    processReceipt(receipt: ReceiptData): {
      pricesExtracted: number;
      itemsMatched: number;
      newLowestPrices: string[];
      alerts: string[];
    } {
      const results = {
        pricesExtracted: 0,
        itemsMatched: 0,
        newLowestPrices: [] as string[],
        alerts: [] as string[]
      };

      for (const item of receipt.items) {
        const itemId = item.name.toLowerCase().replace(/\s+/g, '-');
        const unitPrice = item.price / item.quantity;

        // Check if this is a new lowest price
        const existingPrices = priceRecords.filter(r => r.itemId === itemId);
        const currentLowest = existingPrices.length > 0
          ? Math.min(...existingPrices.map(r => r.unitPrice))
          : Infinity;

        const record: PriceRecord = {
          id: `pr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          itemId,
          itemName: item.name,
          price: item.price,
          unitPrice,
          unit: item.unit,
          quantity: item.quantity,
          store: receipt.store,
          source: 'receipt',
          capturedAt: receipt.date,
          isOnSale: false
        };

        priceRecords.push(record);
        results.pricesExtracted++;

        if (unitPrice < currentLowest) {
          results.newLowestPrices.push(item.name);
          results.alerts.push(`New lowest price for ${item.name}: $${unitPrice.toFixed(2)}`);
        }

        // Check for significant price changes
        if (existingPrices.length > 0) {
          const avgPrice = existingPrices.reduce((sum, r) => sum + r.unitPrice, 0) / existingPrices.length;
          if (unitPrice > avgPrice * 1.2) {
            results.alerts.push(`Warning: ${item.name} is 20%+ above average price`);
          }
        }
      }

      results.itemsMatched = results.pricesExtracted;
      return results;
    },

    // Price Trend Analysis Pipeline
    analyzePriceTrends(itemId: string): {
      hasEnoughData: boolean;
      trend: 'up' | 'down' | 'stable' | null;
      percentChange: number;
      prediction: { price: number; recommendation: string } | null;
      priceHistory: Array<{ date: Date; price: number }>;
    } {
      const itemRecords = priceRecords
        .filter(r => r.itemId === itemId)
        .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

      const result = {
        hasEnoughData: itemRecords.length >= 5,
        trend: null as 'up' | 'down' | 'stable' | null,
        percentChange: 0,
        prediction: null as { price: number; recommendation: string } | null,
        priceHistory: itemRecords.map(r => ({ date: r.capturedAt, price: r.unitPrice }))
      };

      if (itemRecords.length < 3) return result;

      // Calculate trend
      const halfIndex = Math.floor(itemRecords.length / 2);
      const firstHalf = itemRecords.slice(0, halfIndex);
      const secondHalf = itemRecords.slice(halfIndex);

      const firstAvg = firstHalf.reduce((sum, r) => sum + r.unitPrice, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, r) => sum + r.unitPrice, 0) / secondHalf.length;

      result.percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

      if (result.percentChange > 5) result.trend = 'up';
      else if (result.percentChange < -5) result.trend = 'down';
      else result.trend = 'stable';

      // Prediction (if enough data)
      if (itemRecords.length >= 10) {
        const currentPrice = itemRecords[itemRecords.length - 1].unitPrice;
        const predictedChange = result.percentChange / 100 * 0.5; // Conservative projection
        const predictedPrice = currentPrice * (1 + predictedChange);

        let recommendation = 'hold';
        if (result.trend === 'up') recommendation = 'buy_now';
        else if (result.trend === 'down') recommendation = 'wait';
        else if (currentPrice <= Math.min(...itemRecords.map(r => r.unitPrice)) * 1.05) {
          recommendation = 'stock_up';
        }

        result.prediction = {
          price: Math.round(predictedPrice * 100) / 100,
          recommendation
        };
      }

      return result;
    },

    // Deal Quality Pipeline
    processDealAndRecommend(deal: Deal): {
      qualityScore: number;
      qualityRating: string;
      isFakeDeal: boolean;
      vsHistoricalAvg: number;
      stockUpRecommendation: {
        shouldStockUp: boolean;
        quantity: number;
        savings: number;
        reason: string;
      } | null;
    } {
      // Get historical prices
      const historicalRecords = priceRecords.filter(r =>
        r.itemId === deal.itemId &&
        !r.isOnSale
      );

      let historicalAvg = deal.originalPrice; // Default to original if no history
      if (historicalRecords.length > 0) {
        historicalAvg = historicalRecords.reduce((sum, r) => sum + r.unitPrice, 0) / historicalRecords.length;
      }

      // Calculate quality metrics
      const vsHistoricalAvg = ((historicalAvg - deal.salePrice) / historicalAvg) * 100;
      const percentOff = ((deal.originalPrice - deal.salePrice) / deal.originalPrice) * 100;

      // Detect fake deal
      const isFakeDeal = deal.originalPrice > historicalAvg * 1.15;

      // Calculate quality score (1-10)
      let qualityScore = 5;
      if (vsHistoricalAvg >= 25) qualityScore = 9;
      else if (vsHistoricalAvg >= 20) qualityScore = 8;
      else if (vsHistoricalAvg >= 15) qualityScore = 7;
      else if (vsHistoricalAvg >= 10) qualityScore = 6;
      else if (vsHistoricalAvg < 0) qualityScore = 3;

      if (isFakeDeal) qualityScore = Math.min(qualityScore, 2);

      // Quality rating
      let qualityRating = 'average';
      if (qualityScore >= 8) qualityRating = 'excellent';
      else if (qualityScore >= 6) qualityRating = 'good';
      else if (qualityScore <= 3) qualityRating = 'poor';
      if (isFakeDeal) qualityRating = 'fake';

      // Stock-up recommendation
      let stockUpRecommendation = null;
      if (qualityScore >= 7 && !isFakeDeal) {
        const savingsPerUnit = historicalAvg - deal.salePrice;
        const recommendedQuantity = 5; // Assume reasonable quantity

        stockUpRecommendation = {
          shouldStockUp: true,
          quantity: recommendedQuantity,
          savings: Math.round(savingsPerUnit * recommendedQuantity * 100) / 100,
          reason: `Save $${(savingsPerUnit * recommendedQuantity).toFixed(2)} by buying ${recommendedQuantity} units`
        };
      }

      // Store deal
      deals.push(deal);

      return {
        qualityScore,
        qualityRating,
        isFakeDeal,
        vsHistoricalAvg: Math.round(vsHistoricalAvg * 10) / 10,
        stockUpRecommendation
      };
    },

    // Pattern Effectiveness Pipeline
    analyzePatternEffectiveness(patternId: string): {
      daysTracked: number;
      avgAdherence: number;
      successRate: number;
      trend: 'improving' | 'declining' | 'stable';
      recommendation: string;
    } {
      const patternRecords = patternUsage.filter(p => p.patternId === patternId);

      if (patternRecords.length === 0) {
        return {
          daysTracked: 0,
          avgAdherence: 0,
          successRate: 0,
          trend: 'stable',
          recommendation: 'Not enough data - continue tracking'
        };
      }

      const avgAdherence = patternRecords.reduce((sum, p) => sum + p.adherence, 0) / patternRecords.length;
      const successDays = patternRecords.filter(p => p.adherence >= 0.8).length;
      const successRate = successDays / patternRecords.length;

      // Calculate trend
      const halfIndex = Math.floor(patternRecords.length / 2);
      const firstHalfAvg = patternRecords.slice(0, halfIndex || 1)
        .reduce((sum, p) => sum + p.adherence, 0) / (halfIndex || 1);
      const secondHalfAvg = patternRecords.slice(halfIndex || 0)
        .reduce((sum, p) => sum + p.adherence, 0) / (patternRecords.length - halfIndex || 1);

      let trend: 'improving' | 'declining' | 'stable';
      if (secondHalfAvg > firstHalfAvg + 0.05) trend = 'improving';
      else if (secondHalfAvg < firstHalfAvg - 0.05) trend = 'declining';
      else trend = 'stable';

      // Generate recommendation
      let recommendation = '';
      if (successRate >= 0.8 && trend !== 'declining') {
        recommendation = 'Pattern working excellently - continue as is';
      } else if (successRate >= 0.6) {
        recommendation = 'Good results - minor adjustments may help';
      } else if (trend === 'declining') {
        recommendation = 'Pattern fatigue detected - consider switching';
      } else {
        recommendation = 'Pattern may not be suitable - try alternatives';
      }

      return {
        daysTracked: patternRecords.length,
        avgAdherence: Math.round(avgAdherence * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        trend,
        recommendation
      };
    },

    // Add pattern usage
    addPatternUsage(usage: PatternUsage): void {
      patternUsage.push(usage);
    },

    // Get shopping recommendations based on all data
    getSmartShoppingRecommendations(): Array<{
      item: string;
      action: string;
      store: string;
      reason: string;
      priority: 'high' | 'medium' | 'low';
    }> {
      const recommendations: Array<{
        item: string;
        action: string;
        store: string;
        reason: string;
        priority: 'high' | 'medium' | 'low';
      }> = [];

      // Analyze recent price trends
      const itemIds = [...new Set(priceRecords.map(r => r.itemId))];

      for (const itemId of itemIds) {
        const analysis = this.analyzePriceTrends(itemId);
        const itemRecords = priceRecords.filter(r => r.itemId === itemId);
        const itemName = itemRecords[0]?.itemName || itemId;

        if (analysis.prediction?.recommendation === 'stock_up') {
          recommendations.push({
            item: itemName,
            action: 'Stock up now',
            store: this.getBestStoreForItem(itemId),
            reason: 'Price at historical low',
            priority: 'high'
          });
        } else if (analysis.trend === 'up') {
          recommendations.push({
            item: itemName,
            action: 'Buy soon',
            store: this.getBestStoreForItem(itemId),
            reason: 'Prices trending upward',
            priority: 'medium'
          });
        }
      }

      // Check active deals
      const now = new Date();
      const activeDeals = deals.filter(d => d.endDate >= now);

      for (const deal of activeDeals) {
        const quality = this.processDealAndRecommend(deal);
        if (quality.qualityScore >= 7 && !quality.isFakeDeal) {
          recommendations.push({
            item: deal.itemName,
            action: 'Take advantage of deal',
            store: deal.store,
            reason: `${quality.qualityRating} deal - ${quality.vsHistoricalAvg}% below average`,
            priority: quality.qualityScore >= 8 ? 'high' : 'medium'
          });
        }
      }

      return recommendations;
    },

    // Helper: Get best store for item
    getBestStoreForItem(itemId: string): string {
      const itemRecords = priceRecords.filter(r => r.itemId === itemId);

      if (itemRecords.length === 0) return userPreferences.preferredStores[0];

      const byStore = new Map<string, number[]>();
      itemRecords.forEach(r => {
        if (!byStore.has(r.store)) byStore.set(r.store, []);
        byStore.get(r.store)!.push(r.unitPrice);
      });

      let bestStore = userPreferences.preferredStores[0];
      let lowestAvg = Infinity;

      for (const [store, prices] of byStore) {
        const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        if (avg < lowestAvg) {
          lowestAvg = avg;
          bestStore = store;
        }
      }

      return bestStore;
    },

    // Clear all data
    clearData(): void {
      priceRecords.length = 0;
      deals.length = 0;
      patternUsage.length = 0;
    },

    // Get all price records
    getPriceRecords(): PriceRecord[] {
      return [...priceRecords];
    },

    // Get all deals
    getDeals(): Deal[] {
      return [...deals];
    }
  };
};

// ============================================================================
// Integration Test Suite
// ============================================================================

describe('Price Analytics Integration', () => {
  let system: ReturnType<typeof createIntegratedAnalyticsSystem>;

  beforeEach(() => {
    system = createIntegratedAnalyticsSystem();
  });

  // ==========================================================================
  // Receipt -> Prices -> Trends -> Predictions Flow (7 tests)
  // ==========================================================================
  describe('Receipt to Prediction Pipeline', () => {
    it('should process receipt and extract prices', () => {
      const receipt: ReceiptData = {
        store: 'Safeway',
        date: new Date(),
        items: [
          { name: 'Chicken Breast', price: 12.99, quantity: 2, unit: 'lb' },
          { name: 'Brown Rice', price: 3.99, quantity: 1, unit: 'bag' }
        ],
        total: 16.98
      };

      const result = system.processReceipt(receipt);

      expect(result.pricesExtracted).toBe(2);
      expect(result.itemsMatched).toBe(2);
    });

    it('should detect new lowest prices', () => {
      // Add initial price
      system.processReceipt({
        store: 'Costco',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        items: [{ name: 'Eggs', price: 6.99, quantity: 1, unit: 'dozen' }],
        total: 6.99
      });

      // Add new lowest price
      const result = system.processReceipt({
        store: 'Walmart',
        date: new Date(),
        items: [{ name: 'Eggs', price: 4.99, quantity: 1, unit: 'dozen' }],
        total: 4.99
      });

      expect(result.newLowestPrices).toContain('Eggs');
    });

    it('should alert on significant price increases', () => {
      // Add several low prices
      for (let i = 0; i < 5; i++) {
        system.processReceipt({
          store: 'Safeway',
          date: new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000),
          items: [{ name: 'Milk', price: 3.99, quantity: 1, unit: 'gal' }],
          total: 3.99
        });
      }

      // Add high price
      const result = system.processReceipt({
        store: 'Whole Foods',
        date: new Date(),
        items: [{ name: 'Milk', price: 5.99, quantity: 1, unit: 'gal' }],
        total: 5.99
      });

      expect(result.alerts.some(a => a.includes('20%+ above average'))).toBe(true);
    });

    it('should analyze price trends from receipt history', () => {
      // Add increasing prices over time
      const prices = [8, 8.5, 9, 9.5, 10];
      for (let i = 0; i < prices.length; i++) {
        system.processReceipt({
          store: 'Safeway',
          date: new Date(Date.now() - (prices.length - i) * 7 * 24 * 60 * 60 * 1000),
          items: [{ name: 'Steak', price: prices[i], quantity: 1, unit: 'lb' }],
          total: prices[i]
        });
      }

      const analysis = system.analyzePriceTrends('steak');

      expect(analysis.hasEnoughData).toBe(true);
      expect(analysis.trend).toBe('up');
      expect(analysis.percentChange).toBeGreaterThan(0);
    });

    it('should generate predictions with sufficient data', () => {
      // Add 10+ price points
      for (let i = 0; i < 12; i++) {
        const price = 10 + (Math.random() * 2 - 1);
        system.processReceipt({
          store: 'Costco',
          date: new Date(Date.now() - (12 - i) * 7 * 24 * 60 * 60 * 1000),
          items: [{ name: 'Olive Oil', price, quantity: 1, unit: 'bottle' }],
          total: price
        });
      }

      const analysis = system.analyzePriceTrends('olive-oil');

      expect(analysis.prediction).not.toBeNull();
      expect(analysis.prediction!.price).toBeGreaterThan(0);
      expect(analysis.prediction!.recommendation).toBeDefined();
    });

    it('should track price history across stores', () => {
      const stores = ['Safeway', 'Costco', 'Walmart'];
      const prices = [5.99, 4.99, 5.49];

      stores.forEach((store, i) => {
        system.processReceipt({
          store,
          date: new Date(Date.now() - (3 - i) * 24 * 60 * 60 * 1000),
          items: [{ name: 'Bread', price: prices[i], quantity: 1, unit: 'loaf' }],
          total: prices[i]
        });
      });

      const analysis = system.analyzePriceTrends('bread');

      expect(analysis.priceHistory).toHaveLength(3);
    });

    it('should recommend buy_now for rising prices', () => {
      // Steadily increasing prices
      for (let i = 0; i < 12; i++) {
        const price = 5 + (i * 0.3);
        system.processReceipt({
          store: 'Safeway',
          date: new Date(Date.now() - (12 - i) * 7 * 24 * 60 * 60 * 1000),
          items: [{ name: 'Rising Item', price, quantity: 1, unit: 'each' }],
          total: price
        });
      }

      const analysis = system.analyzePriceTrends('rising-item');

      expect(analysis.prediction?.recommendation).toBe('buy_now');
    });
  });

  // ==========================================================================
  // Ad Deals -> Quality Scores -> Stock-Up Flow (7 tests)
  // ==========================================================================
  describe('Deal Quality to Stock-Up Pipeline', () => {
    beforeEach(() => {
      // Add baseline price history
      for (let i = 0; i < 10; i++) {
        system.processReceipt({
          store: 'Safeway',
          date: new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000),
          items: [
            { name: 'Chicken', price: 8.99, quantity: 1, unit: 'lb' },
            { name: 'Rice', price: 4.99, quantity: 1, unit: 'bag' }
          ],
          total: 13.98
        });
      }
    });

    it('should process deal and calculate quality score', () => {
      const deal: Deal = {
        id: 'deal-1',
        itemId: 'chicken',
        itemName: 'Chicken',
        originalPrice: 8.99,
        salePrice: 5.99,
        store: 'Safeway',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const result = system.processDealAndRecommend(deal);

      expect(result.qualityScore).toBeGreaterThanOrEqual(1);
      expect(result.qualityScore).toBeLessThanOrEqual(10);
    });

    it('should compare deal to historical average', () => {
      const deal: Deal = {
        id: 'deal-2',
        itemId: 'chicken',
        itemName: 'Chicken',
        originalPrice: 8.99,
        salePrice: 6.99,
        store: 'Safeway',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const result = system.processDealAndRecommend(deal);

      expect(result.vsHistoricalAvg).toBeDefined();
      expect(result.vsHistoricalAvg).toBeGreaterThan(0); // Should be below average
    });

    it('should detect fake deals', () => {
      const fakeDeal: Deal = {
        id: 'deal-3',
        itemId: 'chicken',
        itemName: 'Chicken',
        originalPrice: 14.99, // Inflated original price
        salePrice: 8.99, // "Sale" price is normal price
        store: 'Scammy Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const result = system.processDealAndRecommend(fakeDeal);

      expect(result.isFakeDeal).toBe(true);
      expect(result.qualityRating).toBe('fake');
    });

    it('should recommend stock-up for excellent deals', () => {
      const greatDeal: Deal = {
        id: 'deal-4',
        itemId: 'chicken',
        itemName: 'Chicken',
        originalPrice: 8.99,
        salePrice: 4.99, // 40%+ off normal price
        store: 'Costco',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const result = system.processDealAndRecommend(greatDeal);

      expect(result.stockUpRecommendation).not.toBeNull();
      expect(result.stockUpRecommendation!.shouldStockUp).toBe(true);
      expect(result.stockUpRecommendation!.savings).toBeGreaterThan(0);
    });

    it('should not recommend stock-up for poor deals', () => {
      const poorDeal: Deal = {
        id: 'deal-5',
        itemId: 'rice',
        itemName: 'Rice',
        originalPrice: 5.99,
        salePrice: 5.49, // Minimal discount
        store: 'Walmart',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const result = system.processDealAndRecommend(poorDeal);

      expect(result.stockUpRecommendation).toBeNull();
    });

    it('should calculate savings for stock-up', () => {
      const deal: Deal = {
        id: 'deal-6',
        itemId: 'chicken',
        itemName: 'Chicken',
        originalPrice: 8.99,
        salePrice: 5.99,
        store: 'Costco',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const result = system.processDealAndRecommend(deal);

      if (result.stockUpRecommendation) {
        expect(result.stockUpRecommendation.quantity).toBeGreaterThan(0);
        expect(result.stockUpRecommendation.savings).toBeGreaterThan(0);
      }
    });

    it('should assign quality ratings correctly', () => {
      const excellentDeal: Deal = {
        id: 'deal-7',
        itemId: 'chicken',
        itemName: 'Chicken',
        originalPrice: 8.99,
        salePrice: 4.99,
        store: 'Costco',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const result = system.processDealAndRecommend(excellentDeal);

      expect(['excellent', 'good']).toContain(result.qualityRating);
    });
  });

  // ==========================================================================
  // Pattern -> Effectiveness -> Recommendations Flow (6 tests)
  // ==========================================================================
  describe('Pattern Effectiveness Pipeline', () => {
    it('should track pattern usage and calculate effectiveness', () => {
      // Add usage data
      for (let i = 0; i < 14; i++) {
        system.addPatternUsage({
          patternId: 'traditional',
          date: new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000),
          adherence: 0.8 + Math.random() * 0.15,
          calories: 1900 + Math.round(Math.random() * 200)
        });
      }

      const effectiveness = system.analyzePatternEffectiveness('traditional');

      expect(effectiveness.daysTracked).toBe(14);
      expect(effectiveness.avgAdherence).toBeGreaterThan(0.7);
    });

    it('should calculate success rate', () => {
      // Mix of successful and unsuccessful days
      for (let i = 0; i < 10; i++) {
        system.addPatternUsage({
          patternId: 'if-16-8',
          date: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000),
          adherence: i % 2 === 0 ? 0.85 : 0.65,
          calories: 1800
        });
      }

      const effectiveness = system.analyzePatternEffectiveness('if-16-8');

      expect(effectiveness.successRate).toBe(0.5); // 5 of 10 above 0.8
    });

    it('should detect declining trend', () => {
      // Declining adherence
      for (let i = 0; i < 14; i++) {
        system.addPatternUsage({
          patternId: 'keto',
          date: new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000),
          adherence: Math.max(0.5, 0.95 - i * 0.03),
          calories: 1600
        });
      }

      const effectiveness = system.analyzePatternEffectiveness('keto');

      expect(effectiveness.trend).toBe('declining');
    });

    it('should recommend based on effectiveness', () => {
      // High adherence pattern
      for (let i = 0; i < 20; i++) {
        system.addPatternUsage({
          patternId: 'grazing',
          date: new Date(Date.now() - (20 - i) * 24 * 60 * 60 * 1000),
          adherence: 0.85 + Math.random() * 0.1,
          calories: 2000
        });
      }

      const effectiveness = system.analyzePatternEffectiveness('grazing');

      expect(effectiveness.recommendation).toContain('continue');
    });

    it('should recommend switching for fatigued patterns', () => {
      // Severely declining pattern
      for (let i = 0; i < 14; i++) {
        system.addPatternUsage({
          patternId: 'omad',
          date: new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000),
          adherence: Math.max(0.3, 0.9 - i * 0.05),
          calories: 1800
        });
      }

      const effectiveness = system.analyzePatternEffectiveness('omad');

      expect(effectiveness.recommendation.toLowerCase()).toContain('switch');
    });

    it('should handle patterns with no data', () => {
      const effectiveness = system.analyzePatternEffectiveness('nonexistent');

      expect(effectiveness.daysTracked).toBe(0);
      expect(effectiveness.recommendation).toContain('Not enough data');
    });
  });
});
