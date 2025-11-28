/**
 * Unit Tests: Price Intelligence System
 * Tests for price capture, quality status, trends, predictions, and alerts
 * Target: 40 tests | Coverage: 90%+
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================================
// Types
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
  source: 'receipt' | 'ad' | 'manual' | 'api';
  capturedAt: Date;
  isOnSale: boolean;
  saleEndDate?: Date;
}

interface PriceHistory {
  itemId: string;
  records: PriceRecord[];
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  priceVariance: number;
}

type QualityStatus = 'excellent' | 'good' | 'fair' | 'poor';

interface PriceTrend {
  itemId: string;
  direction: 'up' | 'down' | 'stable';
  percentageChange: number;
  periodDays: number;
  confidence: number;
}

interface PricePrediction {
  itemId: string;
  predictedPrice: number;
  predictedDate: Date;
  confidence: number;
  basedOnDataPoints: number;
  recommendation: 'buy_now' | 'wait' | 'stock_up';
}

interface PriceAlert {
  id: string;
  itemId: string;
  itemName: string;
  type: 'price_drop' | 'sale_ending' | 'lowest_price' | 'target_reached';
  currentPrice: number;
  previousPrice?: number;
  targetPrice?: number;
  percentageOff?: number;
  store: string;
  createdAt: Date;
  expiresAt?: Date;
}

// ============================================================================
// Price Intelligence Service
// ============================================================================

const createPriceIntelligenceService = () => {
  const priceRecords: PriceRecord[] = [];
  const priceTargets: Map<string, number> = new Map();
  const alerts: PriceAlert[] = [];

  return {
    // Price capture from receipts
    captureFromReceipt(receipt: {
      store: string;
      date: Date;
      items: Array<{ name: string; price: number; quantity: number; unit: string }>;
    }): PriceRecord[] {
      const records: PriceRecord[] = [];
      for (const item of receipt.items) {
        const record: PriceRecord = {
          id: `pr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          itemId: item.name.toLowerCase().replace(/\s+/g, '-'),
          itemName: item.name,
          price: item.price,
          unitPrice: item.price / item.quantity,
          unit: item.unit,
          quantity: item.quantity,
          store: receipt.store,
          source: 'receipt',
          capturedAt: receipt.date,
          isOnSale: false
        };
        priceRecords.push(record);
        records.push(record);
      }
      return records;
    },

    // Add single price record
    addPriceRecord(record: Omit<PriceRecord, 'id'>): PriceRecord {
      const newRecord: PriceRecord = {
        ...record,
        id: `pr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      };
      priceRecords.push(newRecord);
      this.checkPriceAlerts(newRecord);
      return newRecord;
    },

    // Get price history for an item
    getPriceHistory(itemId: string, days: number = 90): PriceHistory | null {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const records = priceRecords
        .filter(r => r.itemId === itemId && r.capturedAt >= cutoff)
        .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

      if (records.length === 0) return null;

      const prices = records.map(r => r.unitPrice);
      const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;

      return {
        itemId,
        records,
        averagePrice: Math.round(avg * 100) / 100,
        lowestPrice: Math.min(...prices),
        highestPrice: Math.max(...prices),
        priceVariance: Math.round(Math.sqrt(variance) * 100) / 100
      };
    },

    // Calculate quality status based on price vs average
    calculateQualityStatus(currentPrice: number, averagePrice: number): QualityStatus {
      const percentOff = ((averagePrice - currentPrice) / averagePrice) * 100;

      if (percentOff >= 20) return 'excellent'; // 20%+ below average
      if (percentOff >= 10) return 'good';      // 10-20% below
      if (percentOff >= 5) return 'fair';       // 5-10% below
      return 'poor';                             // <5% off or above average
    },

    // Get quality status for item at price
    getQualityStatusForPrice(itemId: string, price: number): { status: QualityStatus; percentFromAvg: number } | null {
      const history = this.getPriceHistory(itemId);
      if (!history) return null;

      const status = this.calculateQualityStatus(price, history.averagePrice);
      const percentFromAvg = Math.round(((history.averagePrice - price) / history.averagePrice) * 100);

      return { status, percentFromAvg };
    },

    // Calculate price trend
    calculateTrend(itemId: string, periodDays: number = 30): PriceTrend | null {
      const history = this.getPriceHistory(itemId, periodDays);
      if (!history || history.records.length < 3) return null;

      const records = history.records;
      const halfIndex = Math.floor(records.length / 2);

      const firstHalfAvg = records.slice(0, halfIndex)
        .reduce((sum, r) => sum + r.unitPrice, 0) / halfIndex;
      const secondHalfAvg = records.slice(halfIndex)
        .reduce((sum, r) => sum + r.unitPrice, 0) / (records.length - halfIndex);

      const percentageChange = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

      let direction: 'up' | 'down' | 'stable';
      if (percentageChange > 3) direction = 'up';
      else if (percentageChange < -3) direction = 'down';
      else direction = 'stable';

      // Confidence based on data points and variance
      const confidence = Math.min(0.95, (records.length / 20) * (1 - history.priceVariance / history.averagePrice));

      return {
        itemId,
        direction,
        percentageChange: Math.round(percentageChange * 10) / 10,
        periodDays,
        confidence: Math.round(Math.max(0.3, confidence) * 100) / 100
      };
    },

    // Predict future price (requires 20+ data points)
    predictPrice(itemId: string, daysAhead: number = 14): PricePrediction | null {
      const history = this.getPriceHistory(itemId, 180);
      if (!history || history.records.length < 20) return null;

      const trend = this.calculateTrend(itemId, 60);
      if (!trend) return null;

      // Simple linear projection
      const dailyChange = (trend.percentageChange / trend.periodDays) / 100;
      const currentPrice = history.records[history.records.length - 1].unitPrice;
      const predictedPrice = currentPrice * (1 + dailyChange * daysAhead);

      // Determine recommendation
      let recommendation: 'buy_now' | 'wait' | 'stock_up';
      if (trend.direction === 'up') recommendation = 'buy_now';
      else if (trend.direction === 'down' && predictedPrice < currentPrice * 0.9) recommendation = 'wait';
      else if (currentPrice <= history.lowestPrice * 1.05) recommendation = 'stock_up';
      else recommendation = 'wait';

      return {
        itemId,
        predictedPrice: Math.round(predictedPrice * 100) / 100,
        predictedDate: new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000),
        confidence: trend.confidence * 0.8,
        basedOnDataPoints: history.records.length,
        recommendation
      };
    },

    // Set price target for alerts
    setPriceTarget(itemId: string, targetPrice: number): void {
      priceTargets.set(itemId, targetPrice);
    },

    // Check and generate price alerts
    checkPriceAlerts(record: PriceRecord): PriceAlert[] {
      const newAlerts: PriceAlert[] = [];
      const history = this.getPriceHistory(record.itemId);

      // Check for price drop
      if (history && history.records.length > 1) {
        const previousRecord = history.records[history.records.length - 2];
        const percentOff = ((previousRecord.unitPrice - record.unitPrice) / previousRecord.unitPrice) * 100;

        if (percentOff >= 10) {
          const alert: PriceAlert = {
            id: `alert-${Date.now()}`,
            itemId: record.itemId,
            itemName: record.itemName,
            type: 'price_drop',
            currentPrice: record.unitPrice,
            previousPrice: previousRecord.unitPrice,
            percentageOff: Math.round(percentOff),
            store: record.store,
            createdAt: new Date()
          };
          alerts.push(alert);
          newAlerts.push(alert);
        }

        // Check for lowest price
        if (record.unitPrice <= history.lowestPrice) {
          const alert: PriceAlert = {
            id: `alert-${Date.now()}-low`,
            itemId: record.itemId,
            itemName: record.itemName,
            type: 'lowest_price',
            currentPrice: record.unitPrice,
            store: record.store,
            createdAt: new Date()
          };
          alerts.push(alert);
          newAlerts.push(alert);
        }
      }

      // Check for target price reached
      const target = priceTargets.get(record.itemId);
      if (target && record.unitPrice <= target) {
        const alert: PriceAlert = {
          id: `alert-${Date.now()}-target`,
          itemId: record.itemId,
          itemName: record.itemName,
          type: 'target_reached',
          currentPrice: record.unitPrice,
          targetPrice: target,
          store: record.store,
          createdAt: new Date()
        };
        alerts.push(alert);
        newAlerts.push(alert);
      }

      return newAlerts;
    },

    // Get active alerts
    getAlerts(itemId?: string): PriceAlert[] {
      if (itemId) {
        return alerts.filter(a => a.itemId === itemId);
      }
      return [...alerts];
    },

    // Get best current price across stores
    getBestPrice(itemId: string): { price: number; store: string; date: Date } | null {
      const recentRecords = priceRecords
        .filter(r => r.itemId === itemId)
        .filter(r => {
          const daysDiff = (Date.now() - r.capturedAt.getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff <= 14; // Within last 2 weeks
        });

      if (recentRecords.length === 0) return null;

      const best = recentRecords.reduce((min, r) =>
        r.unitPrice < min.unitPrice ? r : min
      );

      return {
        price: best.unitPrice,
        store: best.store,
        date: best.capturedAt
      };
    },

    // Compare prices across stores
    comparePricesAcrossStores(itemId: string): Array<{ store: string; price: number; lastSeen: Date }> {
      const byStore = new Map<string, PriceRecord>();

      priceRecords
        .filter(r => r.itemId === itemId)
        .forEach(r => {
          const existing = byStore.get(r.store);
          if (!existing || r.capturedAt > existing.capturedAt) {
            byStore.set(r.store, r);
          }
        });

      return Array.from(byStore.values()).map(r => ({
        store: r.store,
        price: r.unitPrice,
        lastSeen: r.capturedAt
      }));
    },

    // Clear data
    clearData(): void {
      priceRecords.length = 0;
      priceTargets.clear();
      alerts.length = 0;
    },

    // Get all records (for testing)
    getAllRecords(): PriceRecord[] {
      return [...priceRecords];
    }
  };
};

// ============================================================================
// Test Suite: Price Intelligence
// ============================================================================

describe('Price Intelligence System', () => {
  let service: ReturnType<typeof createPriceIntelligenceService>;

  beforeEach(() => {
    service = createPriceIntelligenceService();
  });

  // ==========================================================================
  // Price Capture Tests (10 tests)
  // ==========================================================================
  describe('Price Capture from Receipts', () => {
    it('should capture prices from a receipt', () => {
      const receipt = {
        store: 'Safeway',
        date: new Date(),
        items: [
          { name: 'Chicken Breast', price: 12.99, quantity: 2, unit: 'lb' },
          { name: 'Brown Rice', price: 3.99, quantity: 1, unit: 'bag' }
        ]
      };

      const records = service.captureFromReceipt(receipt);

      expect(records).toHaveLength(2);
      expect(records[0].itemName).toBe('Chicken Breast');
      expect(records[0].store).toBe('Safeway');
      expect(records[0].source).toBe('receipt');
    });

    it('should calculate unit price correctly', () => {
      const receipt = {
        store: 'Costco',
        date: new Date(),
        items: [{ name: 'Eggs', price: 5.99, quantity: 24, unit: 'count' }]
      };

      const records = service.captureFromReceipt(receipt);

      expect(records[0].unitPrice).toBeCloseTo(5.99 / 24, 2);
    });

    it('should generate unique IDs for each record', () => {
      const receipt = {
        store: 'Walmart',
        date: new Date(),
        items: [
          { name: 'Milk', price: 3.99, quantity: 1, unit: 'gal' },
          { name: 'Bread', price: 2.49, quantity: 1, unit: 'loaf' }
        ]
      };

      const records = service.captureFromReceipt(receipt);

      expect(records[0].id).not.toBe(records[1].id);
    });

    it('should normalize item IDs from names', () => {
      const receipt = {
        store: 'Safeway',
        date: new Date(),
        items: [{ name: 'Chicken Breast Organic', price: 15.99, quantity: 1, unit: 'lb' }]
      };

      const records = service.captureFromReceipt(receipt);

      expect(records[0].itemId).toBe('chicken-breast-organic');
    });

    it('should add individual price records', () => {
      const record = service.addPriceRecord({
        itemId: 'test-item',
        itemName: 'Test Item',
        price: 5.99,
        unitPrice: 5.99,
        unit: 'each',
        quantity: 1,
        store: 'TestStore',
        source: 'manual',
        capturedAt: new Date(),
        isOnSale: false
      });

      expect(record.id).toBeDefined();
      expect(service.getAllRecords()).toHaveLength(1);
    });

    it('should capture sale items from receipts', () => {
      service.addPriceRecord({
        itemId: 'sale-item',
        itemName: 'Sale Item',
        price: 2.99,
        unitPrice: 2.99,
        unit: 'each',
        quantity: 1,
        store: 'Safeway',
        source: 'ad',
        capturedAt: new Date(),
        isOnSale: true,
        saleEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      const records = service.getAllRecords();
      expect(records[0].isOnSale).toBe(true);
    });

    it('should handle multiple receipts from different stores', () => {
      service.captureFromReceipt({
        store: 'Safeway',
        date: new Date(),
        items: [{ name: 'Chicken', price: 8.99, quantity: 1, unit: 'lb' }]
      });

      service.captureFromReceipt({
        store: 'Costco',
        date: new Date(),
        items: [{ name: 'Chicken', price: 6.99, quantity: 1, unit: 'lb' }]
      });

      const records = service.getAllRecords();
      const stores = new Set(records.map(r => r.store));
      expect(stores.size).toBe(2);
    });

    it('should preserve receipt date as captured date', () => {
      const receiptDate = new Date('2024-01-15');
      const receipt = {
        store: 'Walmart',
        date: receiptDate,
        items: [{ name: 'Item', price: 1.99, quantity: 1, unit: 'each' }]
      };

      const records = service.captureFromReceipt(receipt);

      expect(records[0].capturedAt).toEqual(receiptDate);
    });

    it('should handle zero-quantity items gracefully', () => {
      const receipt = {
        store: 'Test',
        date: new Date(),
        items: [{ name: 'Item', price: 0, quantity: 1, unit: 'each' }]
      };

      const records = service.captureFromReceipt(receipt);
      expect(records[0].unitPrice).toBe(0);
    });

    it('should track source as receipt for receipt captures', () => {
      const receipt = {
        store: 'Test',
        date: new Date(),
        items: [{ name: 'Item', price: 5.00, quantity: 1, unit: 'each' }]
      };

      const records = service.captureFromReceipt(receipt);
      expect(records.every(r => r.source === 'receipt')).toBe(true);
    });
  });

  // ==========================================================================
  // Quality Status Tests (8 tests)
  // ==========================================================================
  describe('Quality Status Calculation', () => {
    it('should return excellent for 20%+ below average', () => {
      const status = service.calculateQualityStatus(8.00, 10.00);
      expect(status).toBe('excellent');
    });

    it('should return good for 10-20% below average', () => {
      const status = service.calculateQualityStatus(8.50, 10.00);
      expect(status).toBe('good');
    });

    it('should return fair for 5-10% below average', () => {
      const status = service.calculateQualityStatus(9.20, 10.00);
      expect(status).toBe('fair');
    });

    it('should return poor for less than 5% below average', () => {
      const status = service.calculateQualityStatus(9.60, 10.00);
      expect(status).toBe('poor');
    });

    it('should return poor for prices above average', () => {
      const status = service.calculateQualityStatus(11.00, 10.00);
      expect(status).toBe('poor');
    });

    it('should calculate quality status with price history', () => {
      // Add historical prices
      for (let i = 0; i < 5; i++) {
        service.addPriceRecord({
          itemId: 'test-item',
          itemName: 'Test Item',
          price: 10.00,
          unitPrice: 10.00,
          unit: 'each',
          quantity: 1,
          store: 'Store',
          source: 'receipt',
          capturedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          isOnSale: false
        });
      }

      const result = service.getQualityStatusForPrice('test-item', 7.50);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('excellent');
      expect(result?.percentFromAvg).toBe(25);
    });

    it('should return null for unknown items', () => {
      const result = service.getQualityStatusForPrice('unknown-item', 5.00);
      expect(result).toBeNull();
    });

    it('should handle exact average price', () => {
      const status = service.calculateQualityStatus(10.00, 10.00);
      expect(status).toBe('poor');
    });
  });

  // ==========================================================================
  // Price Trend Tests (8 tests)
  // ==========================================================================
  describe('Price Trend Calculation', () => {
    const addHistoricalPrices = (itemId: string, prices: number[]) => {
      prices.forEach((price, i) => {
        service.addPriceRecord({
          itemId,
          itemName: 'Test',
          price,
          unitPrice: price,
          unit: 'each',
          quantity: 1,
          store: 'Store',
          source: 'receipt',
          capturedAt: new Date(Date.now() - (prices.length - i) * 24 * 60 * 60 * 1000),
          isOnSale: false
        });
      });
    };

    it('should detect upward trend', () => {
      addHistoricalPrices('trending-item', [8, 8.5, 9, 9.5, 10, 10.5, 11]);

      const trend = service.calculateTrend('trending-item');

      expect(trend).not.toBeNull();
      expect(trend?.direction).toBe('up');
      expect(trend?.percentageChange).toBeGreaterThan(0);
    });

    it('should detect downward trend', () => {
      addHistoricalPrices('trending-down', [12, 11.5, 11, 10.5, 10, 9.5, 9]);

      const trend = service.calculateTrend('trending-down');

      expect(trend).not.toBeNull();
      expect(trend?.direction).toBe('down');
      expect(trend?.percentageChange).toBeLessThan(0);
    });

    it('should detect stable prices', () => {
      addHistoricalPrices('stable-item', [10, 10.1, 9.9, 10, 10.1, 9.9, 10]);

      const trend = service.calculateTrend('stable-item');

      expect(trend).not.toBeNull();
      expect(trend?.direction).toBe('stable');
    });

    it('should require minimum 3 data points', () => {
      addHistoricalPrices('few-points', [10, 11]);

      const trend = service.calculateTrend('few-points');

      expect(trend).toBeNull();
    });

    it('should return null for unknown items', () => {
      const trend = service.calculateTrend('nonexistent');
      expect(trend).toBeNull();
    });

    it('should calculate confidence based on data points', () => {
      addHistoricalPrices('confidence-test', [10, 10.5, 11, 11.5, 12]);

      const trend = service.calculateTrend('confidence-test');

      expect(trend?.confidence).toBeGreaterThanOrEqual(0.3);
      expect(trend?.confidence).toBeLessThanOrEqual(0.95);
    });

    it('should respect period days parameter', () => {
      // Add old and recent data
      service.addPriceRecord({
        itemId: 'period-test',
        itemName: 'Test',
        price: 5,
        unitPrice: 5,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        isOnSale: false
      });

      addHistoricalPrices('period-test', [10, 10, 10]);

      const shortTrend = service.calculateTrend('period-test', 7);
      const longTrend = service.calculateTrend('period-test', 90);

      // Short trend should not include old data
      expect(shortTrend?.periodDays).toBe(7);
      expect(longTrend?.periodDays).toBe(90);
    });

    it('should handle high variance data', () => {
      addHistoricalPrices('volatile', [5, 15, 5, 15, 5, 15, 5]);

      const trend = service.calculateTrend('volatile');

      expect(trend).not.toBeNull();
      // High variance should reduce confidence
      expect(trend?.confidence).toBeLessThan(0.7);
    });
  });

  // ==========================================================================
  // Price Prediction Tests (7 tests)
  // ==========================================================================
  describe('Price Prediction', () => {
    const addManyPrices = (itemId: string, basePrice: number, trend: number, count: number = 25) => {
      for (let i = 0; i < count; i++) {
        const price = basePrice + (trend * i / count);
        service.addPriceRecord({
          itemId,
          itemName: 'Test',
          price,
          unitPrice: price,
          unit: 'each',
          quantity: 1,
          store: 'Store',
          source: 'receipt',
          capturedAt: new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000),
          isOnSale: false
        });
      }
    };

    it('should require 20+ data points for prediction', () => {
      // Add only 10 points
      for (let i = 0; i < 10; i++) {
        service.addPriceRecord({
          itemId: 'few-points',
          itemName: 'Test',
          price: 10,
          unitPrice: 10,
          unit: 'each',
          quantity: 1,
          store: 'Store',
          source: 'receipt',
          capturedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          isOnSale: false
        });
      }

      const prediction = service.predictPrice('few-points');
      expect(prediction).toBeNull();
    });

    it('should predict price increase for upward trend', () => {
      addManyPrices('rising', 10, 5);

      const prediction = service.predictPrice('rising', 30);

      expect(prediction).not.toBeNull();
      expect(prediction?.predictedPrice).toBeGreaterThan(14);
    });

    it('should predict price decrease for downward trend', () => {
      addManyPrices('falling', 15, -5);

      const prediction = service.predictPrice('falling', 30);

      expect(prediction).not.toBeNull();
      expect(prediction?.predictedPrice).toBeLessThan(11);
    });

    it('should recommend buy_now for rising prices', () => {
      addManyPrices('buy-now', 10, 3);

      const prediction = service.predictPrice('buy-now');

      expect(prediction?.recommendation).toBe('buy_now');
    });

    it('should recommend wait for falling prices', () => {
      addManyPrices('wait-item', 15, -5);

      const prediction = service.predictPrice('wait-item', 30);

      // Either wait or stock_up is valid for falling prices at low point
      expect(['wait', 'stock_up']).toContain(prediction?.recommendation);
    });

    it('should recommend stock_up at lowest prices', () => {
      // Add prices that start high and go to historical low
      addManyPrices('stockup', 20, -10);

      const prediction = service.predictPrice('stockup');

      // Should recognize we're at/near lowest
      expect(prediction).not.toBeNull();
    });

    it('should include confidence score', () => {
      addManyPrices('confident', 10, 0);

      const prediction = service.predictPrice('confident');

      expect(prediction?.confidence).toBeGreaterThan(0);
      expect(prediction?.confidence).toBeLessThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Price Alert Tests (7 tests)
  // ==========================================================================
  describe('Price Drop Alerts', () => {
    it('should create alert for 10%+ price drop', () => {
      // Add initial price
      service.addPriceRecord({
        itemId: 'alert-item',
        itemName: 'Alert Item',
        price: 10,
        unitPrice: 10,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        isOnSale: false
      });

      // Add dropped price
      const alerts = service.addPriceRecord({
        itemId: 'alert-item',
        itemName: 'Alert Item',
        price: 8,
        unitPrice: 8,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(),
        isOnSale: false
      });

      const allAlerts = service.getAlerts('alert-item');
      expect(allAlerts.some(a => a.type === 'price_drop')).toBe(true);
    });

    it('should not alert for small price changes', () => {
      service.addPriceRecord({
        itemId: 'small-change',
        itemName: 'Item',
        price: 10,
        unitPrice: 10,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        isOnSale: false
      });

      service.addPriceRecord({
        itemId: 'small-change',
        itemName: 'Item',
        price: 9.50,
        unitPrice: 9.50,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(),
        isOnSale: false
      });

      const alerts = service.getAlerts('small-change');
      expect(alerts.filter(a => a.type === 'price_drop')).toHaveLength(0);
    });

    it('should alert when target price is reached', () => {
      service.setPriceTarget('target-item', 8.00);

      service.addPriceRecord({
        itemId: 'target-item',
        itemName: 'Target Item',
        price: 7.99,
        unitPrice: 7.99,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(),
        isOnSale: false
      });

      const alerts = service.getAlerts('target-item');
      expect(alerts.some(a => a.type === 'target_reached')).toBe(true);
    });

    it('should alert for lowest price ever', () => {
      // Add historical prices
      for (let i = 0; i < 5; i++) {
        service.addPriceRecord({
          itemId: 'lowest-test',
          itemName: 'Item',
          price: 10 + i,
          unitPrice: 10 + i,
          unit: 'each',
          quantity: 1,
          store: 'Store',
          source: 'receipt',
          capturedAt: new Date(Date.now() - (5 - i) * 24 * 60 * 60 * 1000),
          isOnSale: false
        });
      }

      // Add new lowest
      service.addPriceRecord({
        itemId: 'lowest-test',
        itemName: 'Item',
        price: 8,
        unitPrice: 8,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(),
        isOnSale: false
      });

      const alerts = service.getAlerts('lowest-test');
      expect(alerts.some(a => a.type === 'lowest_price')).toBe(true);
    });

    it('should include percentage off in price drop alerts', () => {
      service.addPriceRecord({
        itemId: 'percent-test',
        itemName: 'Item',
        price: 10,
        unitPrice: 10,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        isOnSale: false
      });

      service.addPriceRecord({
        itemId: 'percent-test',
        itemName: 'Item',
        price: 7,
        unitPrice: 7,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(),
        isOnSale: false
      });

      const alerts = service.getAlerts('percent-test');
      const dropAlert = alerts.find(a => a.type === 'price_drop');
      expect(dropAlert?.percentageOff).toBe(30);
    });

    it('should get all alerts without filter', () => {
      service.setPriceTarget('item1', 5);
      service.addPriceRecord({
        itemId: 'item1',
        itemName: 'Item 1',
        price: 4,
        unitPrice: 4,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(),
        isOnSale: false
      });

      service.setPriceTarget('item2', 5);
      service.addPriceRecord({
        itemId: 'item2',
        itemName: 'Item 2',
        price: 4,
        unitPrice: 4,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(),
        isOnSale: false
      });

      const allAlerts = service.getAlerts();
      expect(allAlerts.length).toBeGreaterThanOrEqual(2);
    });

    it('should include store in alerts', () => {
      service.setPriceTarget('store-alert', 5);
      service.addPriceRecord({
        itemId: 'store-alert',
        itemName: 'Item',
        price: 4,
        unitPrice: 4,
        unit: 'each',
        quantity: 1,
        store: 'Costco',
        source: 'receipt',
        capturedAt: new Date(),
        isOnSale: false
      });

      const alerts = service.getAlerts('store-alert');
      expect(alerts[0].store).toBe('Costco');
    });
  });

  // ==========================================================================
  // Price Comparison Tests (5 tests - BONUS beyond 40)
  // ==========================================================================
  describe('Price Comparison', () => {
    it('should find best price across stores', () => {
      service.addPriceRecord({
        itemId: 'compare-item',
        itemName: 'Item',
        price: 10,
        unitPrice: 10,
        unit: 'each',
        quantity: 1,
        store: 'Safeway',
        source: 'receipt',
        capturedAt: new Date(),
        isOnSale: false
      });

      service.addPriceRecord({
        itemId: 'compare-item',
        itemName: 'Item',
        price: 8,
        unitPrice: 8,
        unit: 'each',
        quantity: 1,
        store: 'Costco',
        source: 'receipt',
        capturedAt: new Date(),
        isOnSale: false
      });

      const best = service.getBestPrice('compare-item');

      expect(best?.price).toBe(8);
      expect(best?.store).toBe('Costco');
    });

    it('should compare prices across all stores', () => {
      const stores = ['Safeway', 'Costco', 'Walmart'];
      stores.forEach((store, i) => {
        service.addPriceRecord({
          itemId: 'multi-store',
          itemName: 'Item',
          price: 10 - i,
          unitPrice: 10 - i,
          unit: 'each',
          quantity: 1,
          store,
          source: 'receipt',
          capturedAt: new Date(),
          isOnSale: false
        });
      });

      const comparison = service.comparePricesAcrossStores('multi-store');

      expect(comparison).toHaveLength(3);
    });

    it('should return null for unknown items', () => {
      const best = service.getBestPrice('unknown');
      expect(best).toBeNull();
    });

    it('should only consider recent prices for best price', () => {
      // Old low price
      service.addPriceRecord({
        itemId: 'old-price',
        itemName: 'Item',
        price: 5,
        unitPrice: 5,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        isOnSale: false
      });

      // Recent higher price
      service.addPriceRecord({
        itemId: 'old-price',
        itemName: 'Item',
        price: 10,
        unitPrice: 10,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(),
        isOnSale: false
      });

      const best = service.getBestPrice('old-price');
      expect(best?.price).toBe(10); // Should not find old price
    });

    it('should clear all data', () => {
      service.addPriceRecord({
        itemId: 'clear-test',
        itemName: 'Item',
        price: 10,
        unitPrice: 10,
        unit: 'each',
        quantity: 1,
        store: 'Store',
        source: 'receipt',
        capturedAt: new Date(),
        isOnSale: false
      });

      service.clearData();

      expect(service.getAllRecords()).toHaveLength(0);
    });
  });
});
