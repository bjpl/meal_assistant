/**
 * Comprehensive Inventory Services Test Suite
 * Tests all inventory services: tracking, expiry, predictions, barcode, leftovers, notifications
 */

// Mock localStorage BEFORE any imports
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

// Mock window and Notification API
class MockNotification {
  static permission = 'granted';
  static requestPermission = jest.fn(() => Promise.resolve('granted'));
  title: string;
  options: any;
  onclick: (() => void) | null = null;

  constructor(title: string, options?: any) {
    this.title = title;
    this.options = options;
  }
}

Object.defineProperty(global, 'window', {
  value: {
    Notification: MockNotification
  },
  writable: true
});

Object.defineProperty(global, 'Notification', { value: MockNotification, writable: true });

// NOW import the services
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  InventoryTrackingService,
  calculateFreshnessStatus,
  getFreshnessColor,
  calculateDepletionDate
} from '../../../../src/services/inventory/tracking.service';
import { ExpiryPreventionService } from '../../../../src/services/inventory/expiry.service';
import { PredictiveAnalyticsService } from '../../../../src/services/inventory/predictions.service';
import { BarcodeScanningService } from '../../../../src/services/inventory/barcode.service';
import { LeftoverManagementService } from '../../../../src/services/inventory/leftovers.service';
import { InventoryNotificationService } from '../../../../src/services/inventory/notifications.service';
import type {
  InventoryItem,
  InventoryCategory,
  StorageLocation,
  FreshnessStatus
} from '../../../../src/types/inventory.types';


describe('Inventory Services', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  // ===========================
  // 1. TRACKING SERVICE TESTS (8 tests)
  // ===========================

  describe('InventoryTrackingService', () => {
    let service: InventoryTrackingService;

    beforeEach(() => {
      service = new InventoryTrackingService();
    });

    afterEach(() => {
      service.clearAll();
    });

    it('should add a new inventory item with generated ID', () => {
      const item = service.addItem({
        name: 'Milk',
        quantity: 1,
        unit: 'l',
        location: 'fridge',
        category: 'dairy'
      });

      expect(item.id).toMatch(/^inv_\d+_[a-z0-9]+$/);
      expect(item.name).toBe('Milk');
      expect(item.quantity).toBe(1);
      expect(item.unit).toBe('l');
      expect(item.location).toBe('fridge');
      expect(item.category).toBe('dairy');
      expect(item.isLeftover).toBe(false);
    });

    it('should update an existing inventory item', () => {
      const item = service.addItem({
        name: 'Eggs',
        quantity: 12,
        unit: 'count',
        location: 'fridge',
        category: 'protein',
        cost: 4.99
      });

      const updated = service.updateItem(item.id, {
        quantity: 10,
        notes: 'Used 2 for breakfast'
      });

      expect(updated).not.toBeNull();
      expect(updated?.quantity).toBe(10);
      expect(updated?.notes).toBe('Used 2 for breakfast');
      expect(updated?.id).toBe(item.id);
    });

    it('should deduct quantity from item and record transaction', () => {
      const item = service.addItem({
        name: 'Bread',
        quantity: 3,
        unit: 'count',
        location: 'pantry',
        category: 'grains'
      });

      const updated = service.deductQuantity(item.id, 1, 'meal_log', 'meal123');

      expect(updated).not.toBeNull();
      expect(updated?.quantity).toBe(2);

      const transactions = service.getItemTransactions(item.id);
      expect(transactions.length).toBeGreaterThan(1); // Add + Remove transactions
      expect(transactions.some(t => t.type === 'remove' && t.mealId === 'meal123')).toBe(true);
    });

    it('should remove an inventory item and create transaction', () => {
      const item = service.addItem({
        name: 'Expired Yogurt',
        quantity: 1,
        unit: 'count',
        location: 'fridge',
        category: 'dairy'
      });

      const removed = service.removeItem(item.id, 'Expired');

      expect(removed).toBe(true);
      expect(service.getItem(item.id)).toBeUndefined();

      const transactions = service.getItemTransactions(item.id);
      expect(transactions.some(t => t.type === 'remove' && t.reason === 'Expired')).toBe(true);
    });

    it('should filter items by location', () => {
      service.addItem({ name: 'Milk', quantity: 1, unit: 'l', location: 'fridge', category: 'dairy' });
      service.addItem({ name: 'Pasta', quantity: 500, unit: 'g', location: 'pantry', category: 'grains' });
      service.addItem({ name: 'Ice Cream', quantity: 1, unit: 'count', location: 'freezer', category: 'frozen' });

      const fridgeItems = service.getItemsByLocation('fridge');
      expect(fridgeItems.length).toBe(1);
      expect(fridgeItems[0].name).toBe('Milk');
    });

    it('should filter items by category', () => {
      service.addItem({ name: 'Chicken', quantity: 500, unit: 'g', location: 'fridge', category: 'protein' });
      service.addItem({ name: 'Cheese', quantity: 200, unit: 'g', location: 'fridge', category: 'dairy' });
      service.addItem({ name: 'Beef', quantity: 300, unit: 'g', location: 'fridge', category: 'protein' });

      const proteinItems = service.getItemsByCategory('protein');
      expect(proteinItems.length).toBe(2);
      expect(proteinItems.every(item => item.category === 'protein')).toBe(true);
    });

    it('should get expiring items within specified days', () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      service.addItem({
        name: 'Expiring Soon',
        quantity: 1,
        unit: 'count',
        location: 'fridge',
        category: 'dairy',
        expiryDate: tomorrow
      });

      service.addItem({
        name: 'Still Good',
        quantity: 1,
        unit: 'count',
        location: 'fridge',
        category: 'dairy',
        expiryDate: nextWeek
      });

      const expiringItems = service.getExpiringItems(2);
      expect(expiringItems.length).toBe(1);
      expect(expiringItems[0].name).toBe('Expiring Soon');
    });

    it('should calculate inventory statistics correctly', () => {
      const now = new Date();
      const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

      service.addItem({
        name: 'Item 1',
        quantity: 1,
        unit: 'count',
        location: 'fridge',
        category: 'dairy',
        cost: 5.99,
        expiryDate: twoDaysLater
      });

      service.addItem({
        name: 'Item 2',
        quantity: 1,
        unit: 'count',
        location: 'pantry',
        category: 'grains',
        cost: 3.49,
        expiryDate: twoDaysLater
      });

      const stats = service.getStats();

      expect(stats.totalItems).toBe(2);
      expect(stats.totalValue).toBeCloseTo(9.48, 2);
      expect(stats.itemsByLocation.fridge).toBe(1);
      expect(stats.itemsByLocation.pantry).toBe(1);
      expect(stats.itemsByCategory.dairy).toBe(1);
      expect(stats.itemsByCategory.grains).toBe(1);
    });
  });

  describe('Tracking Service - Pure Functions', () => {
    it('should calculate freshness status for fresh items', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const status = calculateFreshnessStatus(futureDate);
      expect(status).toBe('fresh');
    });

    it('should calculate freshness status for expiring items', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const status = calculateFreshnessStatus(tomorrow);
      expect(status).toBe('expiring');
    });

    it('should calculate freshness status for expired items', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const status = calculateFreshnessStatus(yesterday);
      expect(status).toBe('expired');
    });

    it('should return correct color codes for freshness status', () => {
      expect(getFreshnessColor('fresh')).toBe('#22c55e');
      expect(getFreshnessColor('good')).toBe('#84cc16');
      expect(getFreshnessColor('use_soon')).toBe('#eab308');
      expect(getFreshnessColor('expiring')).toBe('#f97316');
      expect(getFreshnessColor('expired')).toBe('#ef4444');
    });

    it('should calculate depletion date based on usage rate', () => {
      const depletionDate = calculateDepletionDate(10, 2); // 10 units, 2 per day
      const expectedDays = Math.ceil(10 / 2);
      const expected = new Date();
      expected.setDate(expected.getDate() + expectedDays);

      expect(depletionDate.toDateString()).toBe(expected.toDateString());
    });

    it('should handle zero usage rate gracefully', () => {
      const depletionDate = calculateDepletionDate(5, 0);
      const expected = new Date();
      expected.setDate(expected.getDate() + 30);

      expect(depletionDate.toDateString()).toBe(expected.toDateString());
    });
  });

  // ===========================
  // 2. EXPIRY SERVICE TESTS (6 tests)
  // ===========================

  describe('ExpiryPreventionService', () => {
    let service: ExpiryPreventionService;
    let trackingService: InventoryTrackingService;

    beforeEach(() => {
      trackingService = new InventoryTrackingService();
      service = new ExpiryPreventionService();
    });

    afterEach(() => {
      trackingService.clearAll();
      service.clearAlerts();
    });

    it('should create expiry alerts for items expiring soon', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      trackingService.addItem({
        name: 'Milk',
        quantity: 1,
        unit: 'l',
        location: 'fridge',
        category: 'dairy',
        expiryDate: tomorrow
      });

      const alerts = service.checkAllExpiry();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].alertType).toBe('critical');
      expect(alerts[0].itemName).toBe('Milk');
    });

    it('should generate meal suggestions for expiring items', () => {
      const twoDaysLater = new Date();
      twoDaysLater.setDate(twoDaysLater.getDate() + 2);

      trackingService.addItem({
        name: 'Chicken Breast',
        quantity: 500,
        unit: 'g',
        location: 'fridge',
        category: 'protein',
        expiryDate: twoDaysLater
      });

      trackingService.addItem({
        name: 'Broccoli',
        quantity: 300,
        unit: 'g',
        location: 'fridge',
        category: 'produce',
        expiryDate: twoDaysLater
      });

      const items = trackingService.getExpiringItems(3);
      const suggestions = service.generateMealSuggestions(items);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.usesItems.length >= 2)).toBe(true);
    });

    it('should acknowledge alerts', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      trackingService.addItem({
        name: 'Yogurt',
        quantity: 1,
        unit: 'count',
        location: 'fridge',
        category: 'dairy',
        expiryDate: tomorrow
      });

      const alerts = service.checkAllExpiry();
      expect(alerts.length).toBeGreaterThan(0);

      const alertId = alerts[0].id;
      const acknowledged = service.acknowledgeAlert(alertId);

      expect(acknowledged).toBe(true);

      const activeAlerts = service.getActiveAlerts();
      expect(activeAlerts.some(a => a.id === alertId)).toBe(false);
    });

    it('should get 48-hour warnings correctly', () => {
      const oneDayLater = new Date();
      oneDayLater.setDate(oneDayLater.getDate() + 1);

      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);

      trackingService.addItem({
        name: 'Item 1',
        quantity: 1,
        unit: 'count',
        location: 'fridge',
        category: 'dairy',
        expiryDate: oneDayLater
      });

      trackingService.addItem({
        name: 'Item 2',
        quantity: 1,
        unit: 'count',
        location: 'fridge',
        category: 'dairy',
        expiryDate: threeDaysLater
      });

      service.checkAllExpiry();
      const warnings = service.get48HourWarnings();

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.every(w => w.daysUntilExpiry <= 2 && w.daysUntilExpiry >= 0)).toBe(true);
    });

    it('should record waste with proper tracking', () => {
      const item = trackingService.addItem({
        name: 'Spoiled Lettuce',
        quantity: 1,
        unit: 'count',
        location: 'fridge',
        category: 'produce',
        cost: 2.99
      });

      const wasteRecord = service.recordWaste(item, 'spoiled', 'Found mold');

      expect(wasteRecord.itemName).toBe('Spoiled Lettuce');
      expect(wasteRecord.reason).toBe('spoiled');
      expect(wasteRecord.preventable).toBe(true);
      expect(wasteRecord.cost).toBe(2.99);
      expect(wasteRecord.notes).toBe('Found mold');

      // Item should be removed from inventory
      expect(trackingService.getItem(item.id)).toBeUndefined();
    });

    it('should calculate waste statistics correctly', () => {
      const item1 = trackingService.addItem({
        name: 'Expired Milk',
        quantity: 1,
        unit: 'l',
        location: 'fridge',
        category: 'dairy',
        cost: 4.99
      });

      const item2 = trackingService.addItem({
        name: 'Spoiled Bread',
        quantity: 1,
        unit: 'count',
        location: 'pantry',
        category: 'grains',
        cost: 3.49
      });

      service.recordWaste(item1, 'expired');
      service.recordWaste(item2, 'spoiled');

      const stats = service.getWasteStats(30);

      expect(stats.totalWasted).toBe(2);
      expect(stats.totalCost).toBeCloseTo(8.48, 2);
      expect(stats.preventablePercentage).toBe(100);
      expect(stats.byReason.expired).toBe(1);
      expect(stats.byReason.spoiled).toBe(1);
    });
  });

  // ===========================
  // 3. PREDICTIONS SERVICE TESTS (6 tests)
  // ===========================

  describe('PredictiveAnalyticsService', () => {
    let service: PredictiveAnalyticsService;
    let trackingService: InventoryTrackingService;

    beforeEach(() => {
      trackingService = new InventoryTrackingService();
      service = new PredictiveAnalyticsService();
    });

    afterEach(() => {
      trackingService.clearAll();
      service.clearPredictionData();
    });

    it('should predict usage with low confidence for new items', () => {
      const item = trackingService.addItem({
        name: 'New Cereal',
        quantity: 10,
        unit: 'servings',
        location: 'pantry',
        category: 'grains'
      });

      const prediction = service.predictUsage(item.id);

      expect(prediction).not.toBeNull();
      expect(prediction!.itemId).toBe(item.id);
      expect(prediction!.currentQuantity).toBe(10);
      expect(prediction!.confidenceScore).toBeLessThan(0.5); // Low confidence for new items
      expect(prediction!.dailyUsageRate).toBeGreaterThan(0);
    });

    it('should record usage and improve predictions', () => {
      const item = trackingService.addItem({
        name: 'Coffee',
        quantity: 30,
        unit: 'servings',
        location: 'pantry',
        category: 'beverages'
      });

      // Record several usage events
      for (let i = 0; i < 5; i++) {
        service.recordUsage(item.id, 2);
      }

      const prediction = service.predictUsage(item.id);

      expect(prediction).not.toBeNull();
      expect(prediction!.historicalDataPoints).toBe(5);
      expect(prediction!.dailyUsageRate).toBeGreaterThan(0);
    });

    it('should generate shopping list based on predictions', () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const item = trackingService.addItem({
        name: 'Low Stock Item',
        quantity: 1,
        unit: 'count',
        location: 'pantry',
        category: 'grains',
        expiryDate: tomorrow,
        avgUsageRate: 5, // High usage rate
        costPerUnit: 2.99
      });

      const shoppingList = service.generateShoppingList();

      expect(shoppingList.length).toBeGreaterThan(0);
      const foundItem = shoppingList.find(si => si.itemId === item.id);
      expect(foundItem).toBeDefined();
      expect(['urgent', 'high', 'medium']).toContain(foundItem!.priority);
    });

    it('should get upcoming depletions within specified days', () => {
      const item = trackingService.addItem({
        name: 'Depleting Item',
        quantity: 2,
        unit: 'count',
        location: 'pantry',
        category: 'snacks',
        avgUsageRate: 1 // Will deplete in 2 days
      });

      const depletions = service.getUpcomingDepletions(7);

      expect(depletions.length).toBeGreaterThan(0);
      const depletion = depletions.find(d => d.itemId === item.id);
      expect(depletion).toBeDefined();
    });

    it('should get usage trend for items', () => {
      const item = trackingService.addItem({
        name: 'Trending Item',
        quantity: 20,
        unit: 'servings',
        location: 'pantry',
        category: 'snacks'
      });

      // Record increasing usage
      for (let i = 0; i < 14; i++) {
        const amount = i < 7 ? 1 : 2; // Double usage in second week
        service.recordUsage(item.id, amount);
      }

      const trend = service.getUsageTrend(item.id);

      expect(trend).toBeDefined();
      expect(['increasing', 'decreasing', 'stable']).toContain(trend.trend);
      expect(typeof trend.percentageChange).toBe('number');
    });

    it('should get prediction statistics', () => {
      trackingService.addItem({
        name: 'Item 1',
        quantity: 10,
        unit: 'count',
        location: 'pantry',
        category: 'snacks'
      });

      trackingService.addItem({
        name: 'Item 2',
        quantity: 5,
        unit: 'count',
        location: 'fridge',
        category: 'dairy'
      });

      const stats = service.getPredictionStats();

      expect(stats.itemsWithPredictions).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.averageConfidence).toBeLessThanOrEqual(1);
      expect(typeof stats.highConfidenceItems).toBe('number');
      expect(typeof stats.lowConfidenceItems).toBe('number');
    });
  });

  // ===========================
  // 4. BARCODE SERVICE TESTS (5 tests)
  // ===========================

  describe('BarcodeScanningService', () => {
    let service: BarcodeScanningService;
    let trackingService: InventoryTrackingService;

    beforeEach(() => {
      trackingService = new InventoryTrackingService();
      service = new BarcodeScanningService();
      global.fetch = jest.fn() as any;
    });

    afterEach(() => {
      trackingService.clearAll();
      service.clearCache();
      jest.restoreAllMocks();
    });

    it('should reject invalid barcodes', async () => {
      const result = await service.scanBarcode('123'); // Too short
      expect(result.found).toBe(false);
    });

    it('should find products in local cache', async () => {
      service.addToCache({
        barcode: '12345678',
        name: 'Cached Product',
        brand: 'Test Brand',
        category: 'dairy',
        defaultUnit: 'ml',
        defaultQuantity: 500,
        typicalExpiryDays: 7,
        lastUpdated: new Date()
      });

      const result = await service.scanBarcode('12345678');

      expect(result.found).toBe(true);
      expect(result.product?.name).toBe('Cached Product');
      expect(result.product?.brand).toBe('Test Brand');
      expect(result.source).toBe('local_cache');
    });

    it('should fetch from OpenFoodFacts API on cache miss', async () => {
      const mockResponse = {
        status: 1,
        product: {
          product_name: 'Test Milk',
          brands: 'Test Brand',
          categories: 'dairy,milk',
          quantity: '1L',
          nutriments: {
            'energy-kcal_100g': 42,
            proteins_100g: 3.4,
            carbohydrates_100g: 4.8,
            fat_100g: 1.5
          }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await service.scanBarcode('87654321');

      expect(result.found).toBe(true);
      expect(result.product?.name).toBe('Test Milk');
      expect(result.product?.brand).toBe('Test Brand');
      expect(result.source).toBe('openfoodfacts');
      expect(result.product?.category).toBe('dairy');
    });

    it('should search cache by name', () => {
      service.addToCache({
        barcode: '11111111',
        name: 'Chocolate Milk',
        brand: 'Brand A',
        category: 'dairy',
        defaultUnit: 'ml',
        defaultQuantity: 250,
        typicalExpiryDays: 5,
        lastUpdated: new Date()
      });

      service.addToCache({
        barcode: '22222222',
        name: 'Almond Milk',
        brand: 'Brand B',
        category: 'dairy',
        defaultUnit: 'ml',
        defaultQuantity: 1000,
        typicalExpiryDays: 7,
        lastUpdated: new Date()
      });

      const results = service.searchCache('milk');

      expect(results.length).toBe(2);
      expect(results.every(r => r.name.toLowerCase().includes('milk'))).toBe(true);
    });

    it('should get cache statistics', () => {
      service.addToCache({
        barcode: '33333333',
        name: 'Product 1',
        category: 'dairy',
        defaultUnit: 'ml',
        defaultQuantity: 500,
        typicalExpiryDays: 7,
        lastUpdated: new Date()
      });

      service.addToCache({
        barcode: '44444444',
        name: 'Product 2',
        category: 'grains',
        defaultUnit: 'g',
        defaultQuantity: 500,
        typicalExpiryDays: 180,
        lastUpdated: new Date()
      });

      const stats = service.getCacheStats();

      expect(stats.totalCached).toBe(2);
      expect(stats.byCategory.dairy).toBe(1);
      expect(stats.byCategory.grains).toBe(1);
      expect(stats.newestEntry).toBeDefined();
    });
  });

  // ===========================
  // 5. LEFTOVERS SERVICE TESTS (5 tests)
  // ===========================

  describe('LeftoverManagementService', () => {
    let service: LeftoverManagementService;
    let trackingService: InventoryTrackingService;

    beforeEach(() => {
      trackingService = new InventoryTrackingService();
      service = new LeftoverManagementService();
    });

    afterEach(() => {
      trackingService.clearAll();
    });

    it('should create leftover from meal data', () => {
      const leftover = service.createLeftover({
        mealId: 'meal123',
        mealName: 'Chicken Stir Fry',
        portionEstimate: 'medium',
        notes: 'From dinner',
        reheatingInstructions: 'Microwave for 2 minutes'
      });

      expect(leftover.isLeftover).toBe(true);
      expect(leftover.originalMealId).toBe('meal123');
      expect(leftover.originalMealName).toBe('Chicken Stir Fry');
      expect(leftover.portionEstimate).toBe('medium');
      expect(leftover.quantity).toBe(1.0); // Medium portion
      expect(leftover.unit).toBe('servings');
      expect(leftover.location).toBe('fridge');
      expect(leftover.timesReheated).toBe(0);
    });

    it('should get all leftovers with metadata', () => {
      service.createLeftover({
        mealId: 'meal1',
        mealName: 'Pasta',
        portionEstimate: 'large'
      });

      service.createLeftover({
        mealId: 'meal2',
        mealName: 'Rice Bowl',
        portionEstimate: 'small'
      });

      const leftovers = service.getAllLeftovers();

      expect(leftovers.length).toBe(2);
      expect(leftovers.every(l => l.isLeftover === true)).toBe(true);
      expect(leftovers.some(l => l.originalMealName === 'Pasta')).toBe(true);
      expect(leftovers.some(l => l.originalMealName === 'Rice Bowl')).toBe(true);
    });

    it('should record reheating with safety limits', () => {
      const leftover = service.createLeftover({
        mealId: 'meal123',
        mealName: 'Chicken Rice',
        portionEstimate: 'medium'
      });

      const firstReheat = service.recordReheating(leftover.id);
      expect(firstReheat.success).toBe(true);
      expect(firstReheat.canReheatAgain).toBe(true);

      const secondReheat = service.recordReheating(leftover.id);
      expect(secondReheat.success).toBe(true);

      // Check if reheating count is tracked
      const leftovers = service.getAllLeftovers();
      const updated = leftovers.find(l => l.id === leftover.id);
      expect(updated?.timesReheated).toBe(2);
    });

    it('should consume leftover with different portion sizes', () => {
      const leftover = service.createLeftover({
        mealId: 'meal123',
        mealName: 'Soup',
        portionEstimate: 'large'
      });

      const consumed = service.consumeLeftover(leftover.id, 'half');
      expect(consumed).toBe(true);

      const item = trackingService.getItem(leftover.id);
      expect(item).toBeDefined();
      expect(item!.quantity).toBe(1.0); // Was 2.0 (large), consumed 1.0 (half)
    });

    it('should suggest meals incorporating leftovers', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      service.createLeftover({
        mealId: 'meal1',
        mealName: 'Chicken Breast',
        portionEstimate: 'medium'
      });

      service.createLeftover({
        mealId: 'meal2',
        mealName: 'Rice',
        portionEstimate: 'medium'
      });

      // Update expiry dates to make them prioritized
      const leftovers = service.getAllLeftovers();
      leftovers.forEach(l => {
        trackingService.updateItem(l.id, { expiryDate: tomorrow });
      });

      const suggestions = service.suggestMealsForLeftovers();

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.mealName.includes('Bowl'))).toBe(true);
    });
  });

  // ===========================
  // 6. NOTIFICATIONS SERVICE TESTS (6 tests)
  // ===========================

  describe('InventoryNotificationService', () => {
    let service: InventoryNotificationService;

    beforeEach(() => {
      service = new InventoryNotificationService();
      MockNotification.permission = 'granted';
    });

    afterEach(() => {
      service.clearAll();
    });

    it('should check for notification permissions', async () => {
      const hasPermission = await service.checkPermission();
      expect(typeof hasPermission).toBe('boolean');
    });

    it('should respect notification preferences', () => {
      const defaultPrefs = service.getPreferences();

      expect(defaultPrefs.enabled).toBe(true);
      expect(defaultPrefs.expiryWarnings).toBe(true);
      expect(defaultPrefs.depletionAlerts).toBe(true);
      expect(typeof defaultPrefs.maxNotificationsPerDay).toBe('number');
    });

    it('should update notification preferences', () => {
      service.updatePreferences({
        expiryWarningHours: 72,
        maxNotificationsPerDay: 5
      });

      const prefs = service.getPreferences();
      expect(prefs.expiryWarningHours).toBe(72);
      expect(prefs.maxNotificationsPerDay).toBe(5);
    });

    it('should create shopping reminder notifications', async () => {
      const shoppingItems = [
        {
          name: 'Milk',
          suggestedQuantity: 1,
          unit: 'l' as const,
          priority: 'urgent' as const,
          reason: 'depleted' as const,
          addedAt: new Date()
        },
        {
          name: 'Bread',
          suggestedQuantity: 2,
          unit: 'count' as const,
          priority: 'high' as const,
          reason: 'low_stock' as const,
          addedAt: new Date()
        }
      ];

      const notification = await service.createShoppingReminder(shoppingItems);

      expect(notification).not.toBeNull();
      expect(notification!.type).toBe('shopping_reminder');
      expect(notification!.title).toContain('Shopping');
    });

    it('should get active notifications', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await service.createLeftoverReminder('Pasta Leftovers', 'item123', 1);

      const activeNotifications = service.getActiveNotifications();

      expect(activeNotifications.length).toBeGreaterThan(0);
      expect(activeNotifications.every(n => !n.dismissed)).toBe(true);
    });

    it('should dismiss notifications', async () => {
      await service.createLeftoverReminder('Test Leftover', 'item456', 2);

      const activeNotifications = service.getActiveNotifications();
      expect(activeNotifications.length).toBeGreaterThan(0);

      const notificationId = activeNotifications[0].id;
      const dismissed = service.dismissNotification(notificationId);

      expect(dismissed).toBe(true);

      const updatedActive = service.getActiveNotifications();
      expect(updatedActive.some(n => n.id === notificationId)).toBe(false);
    });
  });

  // ===========================
  // 7. INTEGRATION TESTS (2 tests)
  // ===========================

  describe('Service Integration', () => {
    let trackingService: InventoryTrackingService;
    let expiryService: ExpiryPreventionService;
    let predictionsService: PredictiveAnalyticsService;

    beforeEach(() => {
      trackingService = new InventoryTrackingService();
      expiryService = new ExpiryPreventionService();
      predictionsService = new PredictiveAnalyticsService();
    });

    afterEach(() => {
      trackingService.clearAll();
      expiryService.clearAlerts();
      predictionsService.clearPredictionData();
    });

    it('should coordinate expiry alerts and meal suggestions', () => {
      const twoDaysLater = new Date();
      twoDaysLater.setDate(twoDaysLater.getDate() + 2);

      trackingService.addItem({
        name: 'Eggs',
        quantity: 6,
        unit: 'count',
        location: 'fridge',
        category: 'protein',
        expiryDate: twoDaysLater
      });

      trackingService.addItem({
        name: 'Cheese',
        quantity: 200,
        unit: 'g',
        location: 'fridge',
        category: 'dairy',
        expiryDate: twoDaysLater
      });

      const alerts = expiryService.checkAllExpiry();
      expect(alerts.length).toBeGreaterThan(0);

      const items = trackingService.getExpiringItems(3);
      const suggestions = expiryService.generateMealSuggestions(items);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].usesItems.length).toBeGreaterThan(0);
    });

    it('should coordinate predictions and shopping list generation', () => {
      trackingService.addItem({
        name: 'Coffee',
        quantity: 5,
        unit: 'servings',
        location: 'pantry',
        category: 'beverages',
        avgUsageRate: 2, // High usage
        costPerUnit: 0.50
      });

      const predictions = predictionsService.predictAllUsage();
      expect(predictions.length).toBeGreaterThan(0);

      const shoppingList = predictionsService.generateShoppingList();
      expect(shoppingList.length).toBeGreaterThan(0);

      const coffeeItem = shoppingList.find(item => item.name === 'Coffee');
      expect(coffeeItem).toBeDefined();
      expect(['urgent', 'high', 'medium']).toContain(coffeeItem!.priority);
    });
  });
});
