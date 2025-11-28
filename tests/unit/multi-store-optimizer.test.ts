/**
 * Unit Tests: Multi-Store Optimizer
 * Tests for weight optimization, preset profiles, scoring algorithms, and item assignment
 * Week 5-6: Multi-Store Optimization Testing
 * Target: 35 tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Types for Multi-Store Optimization
interface OptimizationWeights {
  price: number;
  quality: number;
  distance: number;
  convenience: number;
}

interface Store {
  id: string;
  name: string;
  type: 'warehouse' | 'supermarket' | 'discount' | 'premium' | 'specialty';
  location: { lat: number; lng: number };
  ratings: { quality: number; service: number };
  priceLevel: 1 | 2 | 3 | 4 | 5; // 1 = cheapest, 5 = most expensive
  operatingHours: { open: string; close: string };
}

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  perishable: boolean;
  frozenRequired?: boolean;
  preferredBrand?: string;
}

interface StoreAssignment {
  storeId: string;
  items: ShoppingItem[];
  estimatedCost: number;
  score: number;
}

interface OptimizationResult {
  assignments: StoreAssignment[];
  totalCost: number;
  totalSavings: number;
  savingsPercent: number;
  optimizationScore: number;
}

// Preset weight profiles
const PRESET_PROFILES: Record<string, OptimizationWeights> = {
  'budget-saver': { price: 0.6, quality: 0.1, distance: 0.2, convenience: 0.1 },
  'quality-first': { price: 0.1, quality: 0.6, distance: 0.1, convenience: 0.2 },
  'convenience': { price: 0.1, quality: 0.2, distance: 0.4, convenience: 0.3 },
  'balanced': { price: 0.25, quality: 0.25, distance: 0.25, convenience: 0.25 },
  'local-focus': { price: 0.2, quality: 0.2, distance: 0.5, convenience: 0.1 }
};

// Multi-Store Optimizer Service
const createMultiStoreOptimizer = () => {
  const stores: Store[] = [
    {
      id: 'costco',
      name: 'Costco',
      type: 'warehouse',
      location: { lat: 47.6062, lng: -122.3321 },
      ratings: { quality: 4.2, service: 3.8 },
      priceLevel: 1,
      operatingHours: { open: '10:00', close: '20:30' }
    },
    {
      id: 'safeway',
      name: 'Safeway',
      type: 'supermarket',
      location: { lat: 47.6101, lng: -122.3420 },
      ratings: { quality: 3.8, service: 4.0 },
      priceLevel: 3,
      operatingHours: { open: '06:00', close: '23:00' }
    },
    {
      id: 'wholefoods',
      name: 'Whole Foods',
      type: 'premium',
      location: { lat: 47.6152, lng: -122.3377 },
      ratings: { quality: 4.8, service: 4.5 },
      priceLevel: 5,
      operatingHours: { open: '07:00', close: '22:00' }
    },
    {
      id: 'traderjoes',
      name: 'Trader Joes',
      type: 'specialty',
      location: { lat: 47.6180, lng: -122.3490 },
      ratings: { quality: 4.5, service: 4.3 },
      priceLevel: 2,
      operatingHours: { open: '08:00', close: '21:00' }
    },
    {
      id: 'walmart',
      name: 'Walmart',
      type: 'discount',
      location: { lat: 47.5950, lng: -122.3280 },
      ratings: { quality: 3.2, service: 3.0 },
      priceLevel: 1,
      operatingHours: { open: '06:00', close: '23:00' }
    }
  ];

  // Price data per store per item category
  const priceMatrix: Record<string, Record<string, number>> = {
    'protein': { costco: 3.99, safeway: 5.49, wholefoods: 8.99, traderjoes: 5.29, walmart: 4.29 },
    'produce': { costco: 2.49, safeway: 2.99, wholefoods: 3.99, traderjoes: 2.79, walmart: 2.19 },
    'dairy': { costco: 2.99, safeway: 3.49, wholefoods: 4.99, traderjoes: 3.29, walmart: 2.79 },
    'grains': { costco: 1.49, safeway: 2.29, wholefoods: 3.49, traderjoes: 1.99, walmart: 1.69 },
    'frozen': { costco: 4.99, safeway: 5.99, wholefoods: 7.99, traderjoes: 4.49, walmart: 4.79 },
    'pantry': { costco: 3.29, safeway: 4.19, wholefoods: 5.99, traderjoes: 3.49, walmart: 3.19 }
  };

  return {
    // Validate that weights sum to 1.0
    validateWeights(weights: OptimizationWeights): { valid: boolean; error?: string } {
      const sum = weights.price + weights.quality + weights.distance + weights.convenience;
      const tolerance = 0.001;

      if (Math.abs(sum - 1.0) > tolerance) {
        return {
          valid: false,
          error: `Weights must sum to 1.0, got ${sum.toFixed(3)}`
        };
      }

      // Check for negative values
      if (weights.price < 0 || weights.quality < 0 || weights.distance < 0 || weights.convenience < 0) {
        return { valid: false, error: 'Weights cannot be negative' };
      }

      // Check for values > 1
      if (weights.price > 1 || weights.quality > 1 || weights.distance > 1 || weights.convenience > 1) {
        return { valid: false, error: 'Individual weights cannot exceed 1.0' };
      }

      return { valid: true };
    },

    // Get preset profile by name
    getPresetProfile(name: string): OptimizationWeights | null {
      return PRESET_PROFILES[name] || null;
    },

    // List all available presets
    listPresetProfiles(): string[] {
      return Object.keys(PRESET_PROFILES);
    },

    // Calculate store score based on weights
    calculateStoreScore(
      store: Store,
      weights: OptimizationWeights,
      userLocation: { lat: number; lng: number },
      category: string
    ): number {
      // Price score (inverse - lower is better)
      const basePrice = priceMatrix[category]?.[store.id] || 5;
      const maxPrice = 10;
      const priceScore = 1 - (basePrice / maxPrice);

      // Quality score (direct - higher is better)
      const qualityScore = store.ratings.quality / 5;

      // Distance score (inverse - closer is better)
      const distance = this.calculateDistance(userLocation, store.location);
      const maxDistance = 20; // km
      const distanceScore = Math.max(0, 1 - (distance / maxDistance));

      // Convenience score (based on operating hours and service rating)
      const hoursOpen = this.calculateHoursOpen(store.operatingHours);
      const convenienceScore = (hoursOpen / 24) * 0.5 + (store.ratings.service / 5) * 0.5;

      // Weighted total
      const total =
        weights.price * priceScore +
        weights.quality * qualityScore +
        weights.distance * distanceScore +
        weights.convenience * convenienceScore;

      return Math.round(total * 100) / 100;
    },

    // Calculate distance between two points (Haversine formula)
    calculateDistance(
      point1: { lat: number; lng: number },
      point2: { lat: number; lng: number }
    ): number {
      const R = 6371; // Earth's radius in km
      const dLat = this.toRad(point2.lat - point1.lat);
      const dLng = this.toRad(point2.lng - point1.lng);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.toRad(point1.lat)) * Math.cos(this.toRad(point2.lat)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 100) / 100;
    },

    toRad(deg: number): number {
      return deg * (Math.PI / 180);
    },

    calculateHoursOpen(hours: { open: string; close: string }): number {
      const [openH, openM] = hours.open.split(':').map(Number);
      const [closeH, closeM] = hours.close.split(':').map(Number);

      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      return (closeMinutes - openMinutes) / 60;
    },

    // Assign items to optimal stores
    assignItemsToStores(
      items: ShoppingItem[],
      weights: OptimizationWeights,
      userLocation: { lat: number; lng: number }
    ): StoreAssignment[] {
      const validation = this.validateWeights(weights);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const assignments: Map<string, StoreAssignment> = new Map();

      items.forEach(item => {
        let bestStore = stores[0];
        let bestScore = -1;

        stores.forEach(store => {
          const score = this.calculateStoreScore(store, weights, userLocation, item.category);
          if (score > bestScore) {
            bestScore = score;
            bestStore = store;
          }
        });

        const existing = assignments.get(bestStore.id);
        const itemCost = (priceMatrix[item.category]?.[bestStore.id] || 5) * item.quantity;

        if (existing) {
          existing.items.push(item);
          existing.estimatedCost += itemCost;
          existing.score = (existing.score + bestScore) / 2;
        } else {
          assignments.set(bestStore.id, {
            storeId: bestStore.id,
            items: [item],
            estimatedCost: itemCost,
            score: bestScore
          });
        }
      });

      return Array.from(assignments.values());
    },

    // Calculate total savings vs single-store baseline
    calculateSavings(
      assignments: StoreAssignment[],
      items: ShoppingItem[],
      baselineStoreId: string = 'safeway'
    ): { optimizedCost: number; baselineCost: number; savings: number; savingsPercent: number } {
      const optimizedCost = assignments.reduce((sum, a) => sum + a.estimatedCost, 0);

      const baselineCost = items.reduce((sum, item) => {
        const price = priceMatrix[item.category]?.[baselineStoreId] || 5;
        return sum + price * item.quantity;
      }, 0);

      const savings = baselineCost - optimizedCost;
      const savingsPercent = baselineCost > 0 ? (savings / baselineCost) * 100 : 0;

      return {
        optimizedCost: Math.round(optimizedCost * 100) / 100,
        baselineCost: Math.round(baselineCost * 100) / 100,
        savings: Math.round(savings * 100) / 100,
        savingsPercent: Math.round(savingsPercent * 10) / 10
      };
    },

    // Full optimization with result
    optimize(
      items: ShoppingItem[],
      weights: OptimizationWeights,
      userLocation: { lat: number; lng: number }
    ): OptimizationResult {
      const assignments = this.assignItemsToStores(items, weights, userLocation);
      const savingsData = this.calculateSavings(assignments, items);

      const avgScore = assignments.length > 0
        ? assignments.reduce((sum, a) => sum + a.score, 0) / assignments.length
        : 0;

      return {
        assignments,
        totalCost: savingsData.optimizedCost,
        totalSavings: savingsData.savings,
        savingsPercent: savingsData.savingsPercent,
        optimizationScore: Math.round(avgScore * 100)
      };
    },

    // Normalize weights to sum to 1.0
    normalizeWeights(weights: Partial<OptimizationWeights>): OptimizationWeights {
      const sum = (weights.price || 0) + (weights.quality || 0) +
                  (weights.distance || 0) + (weights.convenience || 0);

      if (sum === 0) {
        return { price: 0.25, quality: 0.25, distance: 0.25, convenience: 0.25 };
      }

      return {
        price: (weights.price || 0) / sum,
        quality: (weights.quality || 0) / sum,
        distance: (weights.distance || 0) / sum,
        convenience: (weights.convenience || 0) / sum
      };
    },

    // Get stores
    getStores(): Store[] {
      return stores;
    },

    // Get store by ID
    getStore(id: string): Store | undefined {
      return stores.find(s => s.id === id);
    },

    // Get price for item at store
    getPrice(category: string, storeId: string): number {
      return priceMatrix[category]?.[storeId] || 5;
    },

    // Check if store is open at given time
    isStoreOpen(store: Store, time: string): boolean {
      const [checkH, checkM] = time.split(':').map(Number);
      const [openH, openM] = store.operatingHours.open.split(':').map(Number);
      const [closeH, closeM] = store.operatingHours.close.split(':').map(Number);

      const checkMinutes = checkH * 60 + checkM;
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      return checkMinutes >= openMinutes && checkMinutes <= closeMinutes;
    }
  };
};

describe('Multi-Store Optimizer', () => {
  let optimizer: ReturnType<typeof createMultiStoreOptimizer>;
  const userLocation = { lat: 47.6080, lng: -122.3350 };

  beforeEach(() => {
    optimizer = createMultiStoreOptimizer();
  });

  // ============================================
  // Weight Validation Tests (8 tests)
  // ============================================
  describe('Weight Validation', () => {
    it('should accept weights that sum to 1.0', () => {
      const weights = { price: 0.4, quality: 0.3, distance: 0.2, convenience: 0.1 };
      const result = optimizer.validateWeights(weights);
      expect(result.valid).toBe(true);
    });

    it('should reject weights that sum to more than 1.0', () => {
      const weights = { price: 0.5, quality: 0.5, distance: 0.5, convenience: 0.5 };
      const result = optimizer.validateWeights(weights);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must sum to 1.0');
    });

    it('should reject weights that sum to less than 1.0', () => {
      const weights = { price: 0.1, quality: 0.1, distance: 0.1, convenience: 0.1 };
      const result = optimizer.validateWeights(weights);
      expect(result.valid).toBe(false);
    });

    it('should reject negative weights', () => {
      const weights = { price: -0.1, quality: 0.5, distance: 0.4, convenience: 0.2 };
      const result = optimizer.validateWeights(weights);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be negative');
    });

    it('should reject individual weights exceeding 1.0', () => {
      const weights = { price: 1.5, quality: -0.3, distance: -0.1, convenience: -0.1 };
      const result = optimizer.validateWeights(weights);
      expect(result.valid).toBe(false);
    });

    it('should accept weights with small floating point tolerance', () => {
      const weights = { price: 0.333, quality: 0.333, distance: 0.334, convenience: 0.0 };
      const result = optimizer.validateWeights(weights);
      expect(result.valid).toBe(true);
    });

    it('should normalize partial weights to sum to 1.0', () => {
      const partial = { price: 2, quality: 2, distance: 0, convenience: 0 };
      const normalized = optimizer.normalizeWeights(partial);

      const sum = normalized.price + normalized.quality + normalized.distance + normalized.convenience;
      expect(sum).toBeCloseTo(1.0);
    });

    it('should return balanced weights for all zeros', () => {
      const normalized = optimizer.normalizeWeights({});
      expect(normalized.price).toBe(0.25);
      expect(normalized.quality).toBe(0.25);
    });
  });

  // ============================================
  // Preset Profile Tests (6 tests)
  // ============================================
  describe('Preset Profiles', () => {
    it('should return budget-saver profile', () => {
      const profile = optimizer.getPresetProfile('budget-saver');
      expect(profile).not.toBeNull();
      expect(profile!.price).toBe(0.6);
    });

    it('should return quality-first profile', () => {
      const profile = optimizer.getPresetProfile('quality-first');
      expect(profile).not.toBeNull();
      expect(profile!.quality).toBe(0.6);
    });

    it('should return convenience profile', () => {
      const profile = optimizer.getPresetProfile('convenience');
      expect(profile).not.toBeNull();
      expect(profile!.distance).toBe(0.4);
    });

    it('should return balanced profile with equal weights', () => {
      const profile = optimizer.getPresetProfile('balanced');
      expect(profile).not.toBeNull();
      expect(profile!.price).toBe(0.25);
      expect(profile!.quality).toBe(0.25);
    });

    it('should return null for invalid profile', () => {
      const profile = optimizer.getPresetProfile('invalid-profile');
      expect(profile).toBeNull();
    });

    it('should list all available presets', () => {
      const presets = optimizer.listPresetProfiles();
      expect(presets).toContain('budget-saver');
      expect(presets).toContain('quality-first');
      expect(presets).toContain('balanced');
      expect(presets.length).toBe(5);
    });
  });

  // ============================================
  // Scoring Algorithm Tests (8 tests)
  // ============================================
  describe('Scoring Algorithm', () => {
    it('should score stores based on weights', () => {
      const weights = { price: 0.5, quality: 0.2, distance: 0.2, convenience: 0.1 };
      const store = optimizer.getStore('costco')!;

      const score = optimizer.calculateStoreScore(store, weights, userLocation, 'protein');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should favor cheap stores with price-focused weights', () => {
      const weights = { price: 0.8, quality: 0.1, distance: 0.05, convenience: 0.05 };

      const costcoScore = optimizer.calculateStoreScore(
        optimizer.getStore('costco')!, weights, userLocation, 'protein'
      );
      const wholeFoodsScore = optimizer.calculateStoreScore(
        optimizer.getStore('wholefoods')!, weights, userLocation, 'protein'
      );

      expect(costcoScore).toBeGreaterThan(wholeFoodsScore);
    });

    it('should favor premium stores with quality-focused weights', () => {
      const weights = { price: 0.1, quality: 0.7, distance: 0.1, convenience: 0.1 };

      const wholeFoodsScore = optimizer.calculateStoreScore(
        optimizer.getStore('wholefoods')!, weights, userLocation, 'protein'
      );
      const walmartScore = optimizer.calculateStoreScore(
        optimizer.getStore('walmart')!, weights, userLocation, 'protein'
      );

      expect(wholeFoodsScore).toBeGreaterThan(walmartScore);
    });

    it('should factor in distance with distance-focused weights', () => {
      const weights = { price: 0.1, quality: 0.1, distance: 0.7, convenience: 0.1 };
      const nearLocation = { lat: 47.6062, lng: -122.3321 }; // Near Costco

      const costcoScore = optimizer.calculateStoreScore(
        optimizer.getStore('costco')!, weights, nearLocation, 'protein'
      );

      expect(costcoScore).toBeGreaterThan(0.5);
    });

    it('should calculate distance correctly using Haversine', () => {
      const point1 = { lat: 47.6062, lng: -122.3321 };
      const point2 = { lat: 47.6152, lng: -122.3377 };

      const distance = optimizer.calculateDistance(point1, point2);

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(5); // Should be less than 5km
    });

    it('should return 0 distance for same point', () => {
      const point = { lat: 47.6062, lng: -122.3321 };
      const distance = optimizer.calculateDistance(point, point);
      expect(distance).toBe(0);
    });

    it('should calculate hours open correctly', () => {
      const hours = { open: '08:00', close: '20:00' };
      const hoursOpen = optimizer.calculateHoursOpen(hours);
      expect(hoursOpen).toBe(12);
    });

    it('should produce scores between 0 and 1', () => {
      const weights = { price: 0.25, quality: 0.25, distance: 0.25, convenience: 0.25 };

      optimizer.getStores().forEach(store => {
        const score = optimizer.calculateStoreScore(store, weights, userLocation, 'protein');
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });
  });

  // ============================================
  // Item Assignment Tests (7 tests)
  // ============================================
  describe('Item Assignment Logic', () => {
    const testItems: ShoppingItem[] = [
      { id: '1', name: 'Chicken Breast', quantity: 3, unit: 'lbs', category: 'protein', perishable: true },
      { id: '2', name: 'Rice', quantity: 5, unit: 'lbs', category: 'grains', perishable: false },
      { id: '3', name: 'Milk', quantity: 2, unit: 'gal', category: 'dairy', perishable: true },
      { id: '4', name: 'Frozen Pizza', quantity: 2, unit: 'each', category: 'frozen', perishable: true, frozenRequired: true }
    ];

    it('should assign all items to stores', () => {
      const weights = { price: 0.25, quality: 0.25, distance: 0.25, convenience: 0.25 };
      const assignments = optimizer.assignItemsToStores(testItems, weights, userLocation);

      const totalItems = assignments.reduce((sum, a) => sum + a.items.length, 0);
      expect(totalItems).toBe(testItems.length);
    });

    it('should group items by assigned store', () => {
      const weights = { price: 0.25, quality: 0.25, distance: 0.25, convenience: 0.25 };
      const assignments = optimizer.assignItemsToStores(testItems, weights, userLocation);

      assignments.forEach(assignment => {
        expect(assignment.storeId).toBeDefined();
        expect(assignment.items.length).toBeGreaterThan(0);
      });
    });

    it('should calculate estimated cost per assignment', () => {
      const weights = { price: 0.25, quality: 0.25, distance: 0.25, convenience: 0.25 };
      const assignments = optimizer.assignItemsToStores(testItems, weights, userLocation);

      assignments.forEach(assignment => {
        expect(assignment.estimatedCost).toBeGreaterThan(0);
      });
    });

    it('should assign score to each store assignment', () => {
      const weights = { price: 0.25, quality: 0.25, distance: 0.25, convenience: 0.25 };
      const assignments = optimizer.assignItemsToStores(testItems, weights, userLocation);

      assignments.forEach(assignment => {
        expect(assignment.score).toBeGreaterThanOrEqual(0);
        expect(assignment.score).toBeLessThanOrEqual(1);
      });
    });

    it('should throw error for invalid weights in assignment', () => {
      const invalidWeights = { price: 0.5, quality: 0.5, distance: 0.5, convenience: 0.5 };

      expect(() => {
        optimizer.assignItemsToStores(testItems, invalidWeights, userLocation);
      }).toThrow();
    });

    it('should prefer budget stores with budget-saver profile', () => {
      const weights = optimizer.getPresetProfile('budget-saver')!;
      const assignments = optimizer.assignItemsToStores(testItems, weights, userLocation);

      const budgetStores = ['costco', 'walmart', 'traderjoes'];
      const budgetAssignments = assignments.filter(a => budgetStores.includes(a.storeId));

      expect(budgetAssignments.length).toBeGreaterThan(0);
    });

    it('should handle empty item list', () => {
      const weights = { price: 0.25, quality: 0.25, distance: 0.25, convenience: 0.25 };
      const assignments = optimizer.assignItemsToStores([], weights, userLocation);

      expect(assignments).toHaveLength(0);
    });
  });

  // ============================================
  // Savings Calculation Tests (6 tests)
  // ============================================
  describe('Savings Calculation', () => {
    const testItems: ShoppingItem[] = [
      { id: '1', name: 'Chicken', quantity: 5, unit: 'lbs', category: 'protein', perishable: true },
      { id: '2', name: 'Vegetables', quantity: 4, unit: 'lbs', category: 'produce', perishable: true },
      { id: '3', name: 'Rice', quantity: 10, unit: 'lbs', category: 'grains', perishable: false }
    ];

    it('should calculate optimized cost', () => {
      const weights = optimizer.getPresetProfile('budget-saver')!;
      const assignments = optimizer.assignItemsToStores(testItems, weights, userLocation);
      const savings = optimizer.calculateSavings(assignments, testItems);

      expect(savings.optimizedCost).toBeGreaterThan(0);
    });

    it('should calculate baseline cost', () => {
      const weights = optimizer.getPresetProfile('budget-saver')!;
      const assignments = optimizer.assignItemsToStores(testItems, weights, userLocation);
      const savings = optimizer.calculateSavings(assignments, testItems);

      expect(savings.baselineCost).toBeGreaterThan(0);
    });

    it('should show savings with budget optimization', () => {
      const weights = optimizer.getPresetProfile('budget-saver')!;
      const assignments = optimizer.assignItemsToStores(testItems, weights, userLocation);
      const savings = optimizer.calculateSavings(assignments, testItems, 'wholefoods');

      expect(savings.savings).toBeGreaterThan(0);
    });

    it('should calculate savings percentage', () => {
      const weights = optimizer.getPresetProfile('budget-saver')!;
      const assignments = optimizer.assignItemsToStores(testItems, weights, userLocation);
      const savings = optimizer.calculateSavings(assignments, testItems, 'wholefoods');

      expect(savings.savingsPercent).toBeGreaterThan(0);
      expect(savings.savingsPercent).toBeLessThan(100);
    });

    it('should handle zero baseline gracefully', () => {
      const emptyAssignments: StoreAssignment[] = [];
      const savings = optimizer.calculateSavings(emptyAssignments, []);

      expect(savings.savingsPercent).toBe(0);
    });

    it('should use safeway as default baseline', () => {
      const weights = optimizer.getPresetProfile('balanced')!;
      const assignments = optimizer.assignItemsToStores(testItems, weights, userLocation);
      const savings = optimizer.calculateSavings(assignments, testItems);

      // Safeway prices for test items
      const expectedBaseline = 5.49 * 5 + 2.99 * 4 + 2.29 * 10;
      expect(savings.baselineCost).toBeCloseTo(expectedBaseline, 1);
    });
  });

  // Additional utility tests to reach 35 total
  describe('Store Utilities', () => {
    it('should return all stores', () => {
      const stores = optimizer.getStores();
      expect(stores.length).toBe(5);
    });

    it('should get store by ID', () => {
      const store = optimizer.getStore('costco');
      expect(store).toBeDefined();
      expect(store?.name).toBe('Costco');
    });

    it('should return undefined for invalid store ID', () => {
      const store = optimizer.getStore('invalid-store');
      expect(store).toBeUndefined();
    });

    it('should get price for category and store', () => {
      const price = optimizer.getPrice('protein', 'costco');
      expect(price).toBe(3.99);
    });

    it('should return default price for unknown category', () => {
      const price = optimizer.getPrice('unknown', 'costco');
      expect(price).toBe(5);
    });

    it('should check if store is open', () => {
      const store = optimizer.getStore('costco')!;
      expect(optimizer.isStoreOpen(store, '14:00')).toBe(true);
      expect(optimizer.isStoreOpen(store, '06:00')).toBe(false);
    });

    it('should run full optimization and return result', () => {
      const items: ShoppingItem[] = [
        { id: '1', name: 'Test', quantity: 1, unit: 'each', category: 'protein', perishable: false }
      ];
      const weights = optimizer.getPresetProfile('balanced')!;

      const result = optimizer.optimize(items, weights, userLocation);

      expect(result.assignments).toBeDefined();
      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.optimizationScore).toBeGreaterThanOrEqual(0);
    });
  });
});
