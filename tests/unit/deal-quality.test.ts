/**
 * Unit Tests: Deal Quality Assessment
 * Tests for quality scoring, historical comparisons, fake deal detection, stock-up calculator
 * Target: 35 tests | Coverage: 90%+
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================================
// Types
// ============================================================================

interface Deal {
  id: string;
  itemId: string;
  itemName: string;
  originalPrice: number;
  salePrice: number;
  store: string;
  startDate: Date;
  endDate: Date;
  source: 'ad' | 'in_store' | 'app' | 'coupon';
  limitPerCustomer?: number;
  requiresMembership?: boolean;
  couponCode?: string;
}

interface DealQualityScore {
  score: number;           // 1-10 scale
  rating: 'excellent' | 'good' | 'average' | 'poor' | 'fake';
  percentOff: number;
  vsAvg30Day: number;      // % vs 30-day average
  vsAvg60Day: number;      // % vs 60-day average
  vsAvg90Day: number;      // % vs 90-day average
  vsLowestEver: number;    // % vs lowest recorded price
  reasons: string[];
  isFakeDeal: boolean;
  confidence: number;
}

interface PriceHistoryPoint {
  price: number;
  date: Date;
  store: string;
  wasOnSale: boolean;
}

interface StockUpRecommendation {
  itemId: string;
  recommendedQuantity: number;
  reasoning: string;
  savingsIfStockUp: number;
  shelfLifeDays: number;
  confidence: number;
}

interface DealCyclePrediction {
  itemId: string;
  predictedNextSaleDate: Date;
  averageCycleDays: number;
  confidence: number;
  basedOnCycles: number;
}

// ============================================================================
// Deal Quality Service
// ============================================================================

const createDealQualityService = () => {
  const deals: Deal[] = [];
  const priceHistory: Map<string, PriceHistoryPoint[]> = new Map();
  const itemShelfLife: Map<string, number> = new Map();
  const userConsumptionRate: Map<string, number> = new Map(); // units per day

  return {
    // Add price history point
    addPricePoint(itemId: string, point: PriceHistoryPoint): void {
      if (!priceHistory.has(itemId)) {
        priceHistory.set(itemId, []);
      }
      priceHistory.get(itemId)!.push(point);
    },

    // Set item shelf life
    setShelfLife(itemId: string, days: number): void {
      itemShelfLife.set(itemId, days);
    },

    // Set consumption rate
    setConsumptionRate(itemId: string, unitsPerDay: number): void {
      userConsumptionRate.set(itemId, unitsPerDay);
    },

    // Add a deal
    addDeal(deal: Deal): Deal {
      deals.push(deal);
      return deal;
    },

    // Calculate average price for period
    getAveragePrice(itemId: string, days: number): number | null {
      const history = priceHistory.get(itemId);
      if (!history || history.length === 0) return null;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const recentPrices = history
        .filter(p => p.date >= cutoff && !p.wasOnSale)
        .map(p => p.price);

      if (recentPrices.length === 0) return null;

      return recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;
    },

    // Get lowest price ever
    getLowestPrice(itemId: string): number | null {
      const history = priceHistory.get(itemId);
      if (!history || history.length === 0) return null;

      return Math.min(...history.map(p => p.price));
    },

    // Calculate deal quality score
    calculateQualityScore(deal: Deal): DealQualityScore {
      const reasons: string[] = [];
      let score = 5; // Start neutral

      // Basic discount calculation
      const percentOff = ((deal.originalPrice - deal.salePrice) / deal.originalPrice) * 100;

      // Get historical comparisons
      const avg30 = this.getAveragePrice(deal.itemId, 30);
      const avg60 = this.getAveragePrice(deal.itemId, 60);
      const avg90 = this.getAveragePrice(deal.itemId, 90);
      const lowestEver = this.getLowestPrice(deal.itemId);

      let vsAvg30Day = 0;
      let vsAvg60Day = 0;
      let vsAvg90Day = 0;
      let vsLowestEver = 0;

      // Compare to 30-day average
      if (avg30) {
        vsAvg30Day = ((avg30 - deal.salePrice) / avg30) * 100;
        if (vsAvg30Day >= 20) {
          score += 2;
          reasons.push('20%+ below 30-day average');
        } else if (vsAvg30Day >= 10) {
          score += 1;
          reasons.push('10-20% below 30-day average');
        } else if (vsAvg30Day < 0) {
          score -= 2;
          reasons.push('Above 30-day average - potential fake deal');
        }
      }

      // Compare to 60-day average
      if (avg60) {
        vsAvg60Day = ((avg60 - deal.salePrice) / avg60) * 100;
        if (vsAvg60Day >= 15) {
          score += 1;
          reasons.push('Significant savings vs 60-day trend');
        }
      }

      // Compare to 90-day average
      if (avg90) {
        vsAvg90Day = ((avg90 - deal.salePrice) / avg90) * 100;
        if (vsAvg90Day >= 20) {
          score += 1;
          reasons.push('Excellent long-term value');
        }
      }

      // Compare to lowest ever
      if (lowestEver) {
        vsLowestEver = ((lowestEver - deal.salePrice) / lowestEver) * -100;
        if (deal.salePrice <= lowestEver) {
          score += 2;
          reasons.push('Lowest price ever recorded!');
        } else if (deal.salePrice <= lowestEver * 1.05) {
          score += 1;
          reasons.push('Within 5% of lowest price ever');
        }
      }

      // Fake deal detection
      let isFakeDeal = false;
      if (avg30 && deal.originalPrice > avg30 * 1.2) {
        isFakeDeal = true;
        score = 1;
        reasons.length = 0;
        reasons.push('Original price inflated above typical prices');
      }

      if (percentOff > 70 && vsAvg30Day < 10) {
        isFakeDeal = true;
        score = Math.min(score, 2);
        reasons.push('Suspiciously high discount but minimal real savings');
      }

      // Determine rating
      let rating: 'excellent' | 'good' | 'average' | 'poor' | 'fake';
      if (isFakeDeal) rating = 'fake';
      else if (score >= 9) rating = 'excellent';
      else if (score >= 7) rating = 'good';
      else if (score >= 5) rating = 'average';
      else rating = 'poor';

      // Clamp score to 1-10
      score = Math.max(1, Math.min(10, score));

      // Calculate confidence based on data availability
      let confidence = 0.5;
      if (avg30) confidence += 0.15;
      if (avg60) confidence += 0.15;
      if (avg90) confidence += 0.1;
      if (lowestEver) confidence += 0.1;
      confidence = Math.min(confidence, 1);

      return {
        score: Math.round(score * 10) / 10,
        rating,
        percentOff: Math.round(percentOff * 10) / 10,
        vsAvg30Day: Math.round(vsAvg30Day * 10) / 10,
        vsAvg60Day: Math.round(vsAvg60Day * 10) / 10,
        vsAvg90Day: Math.round(vsAvg90Day * 10) / 10,
        vsLowestEver: Math.round(vsLowestEver * 10) / 10,
        reasons,
        isFakeDeal,
        confidence: Math.round(confidence * 100) / 100
      };
    },

    // Detect fake deals
    detectFakeDeal(deal: Deal): { isFake: boolean; reasons: string[] } {
      const reasons: string[] = [];
      let isFake = false;

      const avg30 = this.getAveragePrice(deal.itemId, 30);
      const avg90 = this.getAveragePrice(deal.itemId, 90);

      // Check if original price is inflated
      if (avg30 && deal.originalPrice > avg30 * 1.15) {
        isFake = true;
        reasons.push(`Original price $${deal.originalPrice.toFixed(2)} is higher than typical $${avg30.toFixed(2)}`);
      }

      // Check if "sale" price is normal price
      if (avg30 && Math.abs(deal.salePrice - avg30) < avg30 * 0.05) {
        isFake = true;
        reasons.push('Sale price is basically the normal price');
      }

      // Check for perpetual sales
      const itemDeals = deals.filter(d => d.itemId === deal.itemId);
      if (itemDeals.length >= 5) {
        const salePercentage = itemDeals.length / (itemDeals.length + 1);
        if (salePercentage > 0.8) {
          isFake = true;
          reasons.push('Item is always on sale - no real discount');
        }
      }

      // Check extreme discounts with minimal savings
      const percentOff = ((deal.originalPrice - deal.salePrice) / deal.originalPrice) * 100;
      if (percentOff > 60 && avg30 && (avg30 - deal.salePrice) / avg30 < 0.1) {
        isFake = true;
        reasons.push('Extreme discount but minimal actual savings vs normal prices');
      }

      return { isFake, reasons };
    },

    // Calculate stock-up recommendation
    calculateStockUp(deal: Deal): StockUpRecommendation | null {
      const qualityScore = this.calculateQualityScore(deal);
      const shelfLife = itemShelfLife.get(deal.itemId);
      const consumptionRate = userConsumptionRate.get(deal.itemId);

      if (!shelfLife || !consumptionRate || qualityScore.score < 7) {
        return null;
      }

      // Calculate maximum quantity based on shelf life
      const maxByShelfLife = Math.floor(shelfLife * consumptionRate);

      // Calculate based on deal cycle (assume 4-6 weeks between sales)
      const daysBetweenSales = 35;
      const maxByCycle = Math.ceil(daysBetweenSales * consumptionRate);

      // Take the minimum to avoid waste
      const recommendedQuantity = Math.min(maxByShelfLife, maxByCycle);

      if (recommendedQuantity <= 1) {
        return null;
      }

      // Calculate savings
      const avg30 = this.getAveragePrice(deal.itemId, 30) || deal.originalPrice;
      const savingsPerUnit = avg30 - deal.salePrice;
      const savingsIfStockUp = savingsPerUnit * recommendedQuantity;

      let reasoning = '';
      if (qualityScore.score >= 9) {
        reasoning = 'Excellent deal - maximum stock up recommended';
      } else if (qualityScore.score >= 8) {
        reasoning = 'Great deal - consider stocking up';
      } else {
        reasoning = 'Good deal - moderate stock up suggested';
      }

      return {
        itemId: deal.itemId,
        recommendedQuantity,
        reasoning,
        savingsIfStockUp: Math.round(savingsIfStockUp * 100) / 100,
        shelfLifeDays: shelfLife,
        confidence: qualityScore.confidence
      };
    },

    // Predict deal cycles
    predictDealCycle(itemId: string): DealCyclePrediction | null {
      const itemDeals = deals
        .filter(d => d.itemId === itemId)
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      if (itemDeals.length < 3) {
        return null; // Need at least 3 cycles
      }

      // Calculate intervals between sales
      const intervals: number[] = [];
      for (let i = 1; i < itemDeals.length; i++) {
        const days = Math.round(
          (itemDeals[i].startDate.getTime() - itemDeals[i - 1].startDate.getTime()) /
          (1000 * 60 * 60 * 24)
        );
        intervals.push(days);
      }

      const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
      const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);

      // Confidence based on consistency
      const confidence = Math.max(0.3, 1 - stdDev / avgInterval);

      const lastSale = itemDeals[itemDeals.length - 1];
      const nextSaleDate = new Date(lastSale.startDate);
      nextSaleDate.setDate(nextSaleDate.getDate() + Math.round(avgInterval));

      return {
        itemId,
        predictedNextSaleDate: nextSaleDate,
        averageCycleDays: Math.round(avgInterval),
        confidence: Math.round(confidence * 100) / 100,
        basedOnCycles: itemDeals.length
      };
    },

    // Get all deals for an item
    getDeals(itemId?: string): Deal[] {
      if (itemId) {
        return deals.filter(d => d.itemId === itemId);
      }
      return [...deals];
    },

    // Clear data
    clearData(): void {
      deals.length = 0;
      priceHistory.clear();
      itemShelfLife.clear();
      userConsumptionRate.clear();
    }
  };
};

// ============================================================================
// Test Suite: Deal Quality
// ============================================================================

describe('Deal Quality Assessment', () => {
  let service: ReturnType<typeof createDealQualityService>;

  beforeEach(() => {
    service = createDealQualityService();
  });

  // Helper to add price history
  const addPriceHistory = (itemId: string, prices: number[], startDaysAgo: number = 90) => {
    prices.forEach((price, i) => {
      service.addPricePoint(itemId, {
        price,
        date: new Date(Date.now() - (startDaysAgo - i) * 24 * 60 * 60 * 1000),
        store: 'TestStore',
        wasOnSale: false
      });
    });
  };

  // ==========================================================================
  // Quality Score Calculation Tests (10 tests)
  // ==========================================================================
  describe('Quality Score Calculation', () => {
    it('should calculate basic quality score (1-10)', () => {
      addPriceHistory('test-item', [10, 10, 10, 10, 10]);

      const deal: Deal = {
        id: 'deal-1',
        itemId: 'test-item',
        itemName: 'Test Item',
        originalPrice: 10,
        salePrice: 7,
        store: 'Safeway',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const score = service.calculateQualityScore(deal);

      expect(score.score).toBeGreaterThanOrEqual(1);
      expect(score.score).toBeLessThanOrEqual(10);
    });

    it('should give high score for excellent deals', () => {
      addPriceHistory('excellent-item', [12, 12, 11, 12, 11, 12, 12, 11, 12, 12]);

      const deal: Deal = {
        id: 'deal-2',
        itemId: 'excellent-item',
        itemName: 'Excellent Item',
        originalPrice: 12,
        salePrice: 8,
        store: 'Costco',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const score = service.calculateQualityScore(deal);

      expect(score.score).toBeGreaterThanOrEqual(7);
      expect(score.rating).toMatch(/excellent|good/);
    });

    it('should give low score for poor deals', () => {
      addPriceHistory('poor-item', [8, 8, 8, 8, 8]);

      const deal: Deal = {
        id: 'deal-3',
        itemId: 'poor-item',
        itemName: 'Poor Item',
        originalPrice: 12,
        salePrice: 9,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const score = service.calculateQualityScore(deal);

      // Sale price above average should be poor
      expect(score.score).toBeLessThanOrEqual(5);
    });

    it('should calculate percent off correctly', () => {
      const deal: Deal = {
        id: 'deal-4',
        itemId: 'percent-item',
        itemName: 'Percent Item',
        originalPrice: 20,
        salePrice: 15,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const score = service.calculateQualityScore(deal);

      expect(score.percentOff).toBe(25);
    });

    it('should compare vs 30-day average', () => {
      // Add price history within 30-day window
      for (let i = 0; i < 10; i++) {
        service.addPricePoint('30day-item', {
          price: 10,
          date: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000), // Within 30 days
          store: 'Store',
          wasOnSale: false
        });
      }

      const deal: Deal = {
        id: 'deal-5',
        itemId: '30day-item',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 7,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const score = service.calculateQualityScore(deal);

      expect(score.vsAvg30Day).toBe(30);
    });

    it('should compare vs 60-day average', () => {
      // Add 60+ days of history
      const prices = Array(65).fill(10);
      addPriceHistory('60day-item', prices, 70);

      const deal: Deal = {
        id: 'deal-6',
        itemId: '60day-item',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 8,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const score = service.calculateQualityScore(deal);

      expect(score.vsAvg60Day).toBe(20);
    });

    it('should compare vs 90-day average', () => {
      const prices = Array(95).fill(10);
      addPriceHistory('90day-item', prices, 100);

      const deal: Deal = {
        id: 'deal-7',
        itemId: '90day-item',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 7,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const score = service.calculateQualityScore(deal);

      expect(score.vsAvg90Day).toBe(30);
    });

    it('should bonus for lowest price ever', () => {
      // Add prices that are higher than the sale price
      for (let i = 0; i < 10; i++) {
        service.addPricePoint('lowest-item', {
          price: 12 + (i % 2),
          date: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
          store: 'Store',
          wasOnSale: false
        });
      }

      const deal: Deal = {
        id: 'deal-8',
        itemId: 'lowest-item',
        itemName: 'Item',
        originalPrice: 12,
        salePrice: 9, // Below all historical prices (12-13)
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const score = service.calculateQualityScore(deal);

      expect(score.reasons.some(r => r.toLowerCase().includes('lowest') || r.toLowerCase().includes('5%'))).toBe(true);
    });

    it('should include confidence score based on data', () => {
      addPriceHistory('confidence-item', [10, 10, 10]);

      const deal: Deal = {
        id: 'deal-9',
        itemId: 'confidence-item',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 8,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const score = service.calculateQualityScore(deal);

      expect(score.confidence).toBeGreaterThan(0);
      expect(score.confidence).toBeLessThanOrEqual(1);
    });

    it('should provide reasons for score', () => {
      addPriceHistory('reasons-item', [10, 10, 10, 10, 10]);

      const deal: Deal = {
        id: 'deal-10',
        itemId: 'reasons-item',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 6,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const score = service.calculateQualityScore(deal);

      expect(score.reasons.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Fake Deal Detection Tests (8 tests)
  // ==========================================================================
  describe('Fake Deal Detection', () => {
    it('should detect inflated original price', () => {
      // Add recent price history within 30 days
      for (let i = 0; i < 10; i++) {
        service.addPricePoint('inflated-item', {
          price: 10,
          date: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
          store: 'Store',
          wasOnSale: false
        });
      }

      const deal: Deal = {
        id: 'fake-1',
        itemId: 'inflated-item',
        itemName: 'Inflated Item',
        originalPrice: 15, // Much higher than $10 average
        salePrice: 10,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const result = service.detectFakeDeal(deal);

      expect(result.isFake).toBe(true);
      expect(result.reasons.some(r => r.includes('Original price'))).toBe(true);
    });

    it('should detect sale price at normal price', () => {
      // Add recent price history within 30 days
      for (let i = 0; i < 10; i++) {
        service.addPricePoint('normal-price-item', {
          price: 10,
          date: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
          store: 'Store',
          wasOnSale: false
        });
      }

      const deal: Deal = {
        id: 'fake-2',
        itemId: 'normal-price-item',
        itemName: 'Item',
        originalPrice: 15,
        salePrice: 10, // Same as average
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const result = service.detectFakeDeal(deal);

      expect(result.isFake).toBe(true);
    });

    it('should detect perpetual sales', () => {
      // Add 5 previous deals for same item
      for (let i = 0; i < 5; i++) {
        service.addDeal({
          id: `perpetual-${i}`,
          itemId: 'perpetual-item',
          itemName: 'Always On Sale',
          originalPrice: 20,
          salePrice: 15,
          store: 'Store',
          startDate: new Date(Date.now() - (i + 1) * 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000),
          source: 'ad'
        });
      }

      const deal: Deal = {
        id: 'fake-3',
        itemId: 'perpetual-item',
        itemName: 'Always On Sale',
        originalPrice: 20,
        salePrice: 15,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const result = service.detectFakeDeal(deal);

      expect(result.isFake).toBe(true);
      expect(result.reasons.some(r => r.includes('always on sale'))).toBe(true);
    });

    it('should detect extreme discount with minimal savings', () => {
      // Add recent price history within 30 days
      for (let i = 0; i < 10; i++) {
        service.addPricePoint('extreme-item', {
          price: 10,
          date: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
          store: 'Store',
          wasOnSale: false
        });
      }

      const deal: Deal = {
        id: 'fake-4',
        itemId: 'extreme-item',
        itemName: 'Item',
        originalPrice: 25, // "70% off!" but original is fake
        salePrice: 9.50,   // Only 5% below average
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const result = service.detectFakeDeal(deal);

      expect(result.isFake).toBe(true);
    });

    it('should not flag legitimate deals as fake', () => {
      addPriceHistory('legit-item', [10, 10, 10, 10, 10]);

      const deal: Deal = {
        id: 'legit-1',
        itemId: 'legit-item',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 7,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const result = service.detectFakeDeal(deal);

      expect(result.isFake).toBe(false);
    });

    it('should mark fake deals in quality score', () => {
      // Add recent price history within 30 days
      for (let i = 0; i < 10; i++) {
        service.addPricePoint('marked-fake', {
          price: 10,
          date: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
          store: 'Store',
          wasOnSale: false
        });
      }

      const deal: Deal = {
        id: 'fake-5',
        itemId: 'marked-fake',
        itemName: 'Item',
        originalPrice: 15, // 50% higher than avg - clearly inflated
        salePrice: 10,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const score = service.calculateQualityScore(deal);

      expect(score.isFakeDeal).toBe(true);
      expect(score.rating).toBe('fake');
    });

    it('should give minimum score for fake deals', () => {
      // Add recent price history within 30 days
      for (let i = 0; i < 10; i++) {
        service.addPricePoint('min-score-fake', {
          price: 10,
          date: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
          store: 'Store',
          wasOnSale: false
        });
      }

      const deal: Deal = {
        id: 'fake-6',
        itemId: 'min-score-fake',
        itemName: 'Item',
        originalPrice: 20, // Way inflated - 100% above avg
        salePrice: 10,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const score = service.calculateQualityScore(deal);

      expect(score.score).toBeLessThanOrEqual(2);
    });

    it('should provide specific fake deal reasons', () => {
      // Add recent price history within 30 days
      for (let i = 0; i < 10; i++) {
        service.addPricePoint('specific-fake', {
          price: 10,
          date: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
          store: 'Store',
          wasOnSale: false
        });
      }

      const deal: Deal = {
        id: 'fake-7',
        itemId: 'specific-fake',
        itemName: 'Item',
        originalPrice: 15,
        salePrice: 10,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const result = service.detectFakeDeal(deal);

      expect(result.reasons.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Stock-Up Calculator Tests (8 tests)
  // ==========================================================================
  describe('Stock-Up Calculator', () => {
    beforeEach(() => {
      addPriceHistory('stockup-item', Array(30).fill(10));
      service.setShelfLife('stockup-item', 60); // 60 days shelf life
      service.setConsumptionRate('stockup-item', 0.5); // Half unit per day
    });

    it('should recommend stock-up for excellent deals', () => {
      const deal: Deal = {
        id: 'stockup-1',
        itemId: 'stockup-item',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 6, // 40% off
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const recommendation = service.calculateStockUp(deal);

      expect(recommendation).not.toBeNull();
      expect(recommendation!.recommendedQuantity).toBeGreaterThan(1);
    });

    it('should calculate quantity based on shelf life', () => {
      service.setShelfLife('shelf-item', 30);
      service.setConsumptionRate('shelf-item', 1);
      addPriceHistory('shelf-item', Array(30).fill(10));

      const deal: Deal = {
        id: 'stockup-2',
        itemId: 'shelf-item',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 5,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const recommendation = service.calculateStockUp(deal);

      expect(recommendation).not.toBeNull();
      // Should not exceed shelf life * consumption rate
      expect(recommendation!.recommendedQuantity).toBeLessThanOrEqual(30);
    });

    it('should calculate savings if stocking up', () => {
      const deal: Deal = {
        id: 'stockup-3',
        itemId: 'stockup-item',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 6,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const recommendation = service.calculateStockUp(deal);

      expect(recommendation!.savingsIfStockUp).toBeGreaterThan(0);
    });

    it('should not recommend stock-up for poor deals', () => {
      addPriceHistory('poor-stockup', [10, 10, 10, 10, 10]);
      service.setShelfLife('poor-stockup', 60);
      service.setConsumptionRate('poor-stockup', 0.5);

      const deal: Deal = {
        id: 'stockup-4',
        itemId: 'poor-stockup',
        itemName: 'Item',
        originalPrice: 12,
        salePrice: 11, // Only 8% off
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const recommendation = service.calculateStockUp(deal);

      expect(recommendation).toBeNull();
    });

    it('should return null without shelf life data', () => {
      addPriceHistory('no-shelf', [10, 10, 10, 10, 10]);
      // No shelf life set

      const deal: Deal = {
        id: 'stockup-5',
        itemId: 'no-shelf',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 5,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const recommendation = service.calculateStockUp(deal);

      expect(recommendation).toBeNull();
    });

    it('should provide reasoning for recommendation', () => {
      const deal: Deal = {
        id: 'stockup-6',
        itemId: 'stockup-item',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 5,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const recommendation = service.calculateStockUp(deal);

      expect(recommendation!.reasoning).toBeDefined();
      expect(recommendation!.reasoning.length).toBeGreaterThan(0);
    });

    it('should not recommend if quantity would be 1 or less', () => {
      service.setShelfLife('low-qty', 2); // Only 2 days
      service.setConsumptionRate('low-qty', 0.5);
      addPriceHistory('low-qty', Array(30).fill(10));

      const deal: Deal = {
        id: 'stockup-7',
        itemId: 'low-qty',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 5,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const recommendation = service.calculateStockUp(deal);

      expect(recommendation).toBeNull();
    });

    it('should include confidence score', () => {
      const deal: Deal = {
        id: 'stockup-8',
        itemId: 'stockup-item',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 5,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const recommendation = service.calculateStockUp(deal);

      expect(recommendation!.confidence).toBeGreaterThan(0);
      expect(recommendation!.confidence).toBeLessThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Deal Cycle Prediction Tests (6 tests)
  // ==========================================================================
  describe('Deal Cycle Prediction', () => {
    const addHistoricalDeals = (itemId: string, intervalDays: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const startDate = new Date(Date.now() - (count - i) * intervalDays * 24 * 60 * 60 * 1000);
        service.addDeal({
          id: `cycle-${itemId}-${i}`,
          itemId,
          itemName: 'Cycle Item',
          originalPrice: 10,
          salePrice: 7,
          store: 'Store',
          startDate,
          endDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
          source: 'ad'
        });
      }
    };

    it('should predict next sale date', () => {
      addHistoricalDeals('cycle-item', 30, 4); // Every 30 days, 4 times

      const prediction = service.predictDealCycle('cycle-item');

      expect(prediction).not.toBeNull();
      expect(prediction!.predictedNextSaleDate).toBeInstanceOf(Date);
    });

    it('should calculate average cycle days', () => {
      addHistoricalDeals('avg-cycle', 28, 5);

      const prediction = service.predictDealCycle('avg-cycle');

      expect(prediction!.averageCycleDays).toBeCloseTo(28, 0);
    });

    it('should require minimum 3 cycles', () => {
      addHistoricalDeals('few-cycles', 30, 2);

      const prediction = service.predictDealCycle('few-cycles');

      expect(prediction).toBeNull();
    });

    it('should calculate confidence based on consistency', () => {
      // Very consistent cycles
      addHistoricalDeals('consistent', 30, 6);

      const prediction = service.predictDealCycle('consistent');

      expect(prediction!.confidence).toBeGreaterThan(0.5);
    });

    it('should report number of cycles used', () => {
      addHistoricalDeals('counted', 30, 5);

      const prediction = service.predictDealCycle('counted');

      expect(prediction!.basedOnCycles).toBe(5);
    });

    it('should return null for unknown items', () => {
      const prediction = service.predictDealCycle('nonexistent');

      expect(prediction).toBeNull();
    });
  });

  // ==========================================================================
  // Edge Cases and Utility Tests (3 tests)
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle no price history gracefully', () => {
      const deal: Deal = {
        id: 'no-history',
        itemId: 'unknown-item',
        itemName: 'Unknown',
        originalPrice: 10,
        salePrice: 8,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      };

      const score = service.calculateQualityScore(deal);

      expect(score.score).toBeDefined();
      expect(score.confidence).toBe(0.5); // Base confidence
    });

    it('should get deals by item ID', () => {
      service.addDeal({
        id: 'filter-1',
        itemId: 'filter-item',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 8,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      });

      service.addDeal({
        id: 'filter-2',
        itemId: 'other-item',
        itemName: 'Other',
        originalPrice: 10,
        salePrice: 8,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      });

      const deals = service.getDeals('filter-item');

      expect(deals).toHaveLength(1);
      expect(deals[0].itemId).toBe('filter-item');
    });

    it('should clear all data', () => {
      addPriceHistory('clear-item', [10, 10, 10]);
      service.addDeal({
        id: 'clear-deal',
        itemId: 'clear-item',
        itemName: 'Item',
        originalPrice: 10,
        salePrice: 8,
        store: 'Store',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: 'ad'
      });

      service.clearData();

      expect(service.getDeals()).toHaveLength(0);
      expect(service.getAveragePrice('clear-item', 30)).toBeNull();
    });
  });
});
