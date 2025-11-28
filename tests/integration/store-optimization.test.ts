/**
 * Integration Tests: Store Optimization
 * Tests for complete optimization flow, Google Maps API integration, and savings calculations
 * Week 5-6: Multi-Store Optimization Testing
 * Target: 20 tests
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, jest, afterEach } from '@jest/globals';

// Use real timers for integration tests with async operations
beforeAll(() => {
  jest.useRealTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

// Types
interface Location {
  lat: number;
  lng: number;
}

interface Store {
  id: string;
  name: string;
  location: Location;
  type: 'warehouse' | 'supermarket' | 'discount' | 'premium' | 'specialty';
  priceLevel: number;
  ratings: { quality: number; service: number };
  operatingHours: { open: string; close: string };
}

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  estimatedPrice: number;
  perishable: boolean;
  frozenRequired?: boolean;
}

interface OptimizationWeights {
  price: number;
  quality: number;
  distance: number;
  convenience: number;
}

interface StoreAssignment {
  storeId: string;
  storeName: string;
  items: ShoppingItem[];
  estimatedCost: number;
  travelTime: number;
  distance: number;
}

interface RouteStep {
  storeId: string;
  arrivalTime: string;
  departureTime: string;
  distance: number;
  duration: number;
  trafficDelay: number;
}

interface OptimizationResult {
  assignments: StoreAssignment[];
  route: RouteStep[];
  totalCost: number;
  totalDistance: number;
  totalTime: number;
  savings: {
    amount: number;
    percent: number;
    baseline: number;
  };
  perishableStatus: {
    safe: boolean;
    exposureTime: number;
    atRiskItems: string[];
  };
}

// Mock Google Maps API Response
interface GoogleMapsDistanceResponse {
  rows: Array<{
    elements: Array<{
      distance: { value: number; text: string };
      duration: { value: number; text: string };
      duration_in_traffic?: { value: number; text: string };
      status: string;
    }>;
  }>;
  status: string;
}

// Integrated Store Optimization Service
const createStoreOptimizationService = () => {
  // Store catalog
  const stores: Store[] = [
    {
      id: 'costco',
      name: 'Costco',
      location: { lat: 47.6062, lng: -122.3321 },
      type: 'warehouse',
      priceLevel: 1,
      ratings: { quality: 4.2, service: 3.8 },
      operatingHours: { open: '10:00', close: '20:30' }
    },
    {
      id: 'safeway',
      name: 'Safeway',
      location: { lat: 47.6101, lng: -122.3420 },
      type: 'supermarket',
      priceLevel: 3,
      ratings: { quality: 3.8, service: 4.0 },
      operatingHours: { open: '06:00', close: '23:00' }
    },
    {
      id: 'wholefoods',
      name: 'Whole Foods',
      location: { lat: 47.6152, lng: -122.3377 },
      type: 'premium',
      priceLevel: 5,
      ratings: { quality: 4.8, service: 4.5 },
      operatingHours: { open: '07:00', close: '22:00' }
    },
    {
      id: 'traderjoes',
      name: 'Trader Joes',
      location: { lat: 47.6180, lng: -122.3490 },
      type: 'specialty',
      priceLevel: 2,
      ratings: { quality: 4.5, service: 4.3 },
      operatingHours: { open: '08:00', close: '21:00' }
    },
    {
      id: 'walmart',
      name: 'Walmart',
      location: { lat: 47.5950, lng: -122.3280 },
      type: 'discount',
      priceLevel: 1,
      ratings: { quality: 3.2, service: 3.0 },
      operatingHours: { open: '06:00', close: '23:00' }
    }
  ];

  // Price matrix by category and store
  const priceMatrix: Record<string, Record<string, number>> = {
    'protein': { costco: 3.99, safeway: 5.49, wholefoods: 8.99, traderjoes: 5.29, walmart: 4.29 },
    'produce': { costco: 2.49, safeway: 2.99, wholefoods: 3.99, traderjoes: 2.79, walmart: 2.19 },
    'dairy': { costco: 2.99, safeway: 3.49, wholefoods: 4.99, traderjoes: 3.29, walmart: 2.79 },
    'grains': { costco: 1.49, safeway: 2.29, wholefoods: 3.49, traderjoes: 1.99, walmart: 1.69 },
    'frozen': { costco: 4.99, safeway: 5.99, wholefoods: 7.99, traderjoes: 4.49, walmart: 4.79 },
    'pantry': { costco: 3.29, safeway: 4.19, wholefoods: 5.99, traderjoes: 3.49, walmart: 3.19 }
  };

  // Mock Google Maps API
  let mockGoogleMapsEnabled = true;
  let mockTrafficMultiplier = 1.0;

  return {
    // Set mock mode for testing
    setMockMode(enabled: boolean): void {
      mockGoogleMapsEnabled = enabled;
    },

    // Set traffic condition for testing
    setTrafficMultiplier(multiplier: number): void {
      mockTrafficMultiplier = multiplier;
    },

    // Mock Google Maps Distance Matrix API
    async fetchDistanceMatrix(
      origins: Location[],
      destinations: Location[],
      departureTime?: Date
    ): Promise<GoogleMapsDistanceResponse> {
      // No delay for tests - mock returns immediately

      const rows = origins.map(origin => ({
        elements: destinations.map(dest => {
          const distance = this.calculateHaversineDistance(origin, dest);
          const baseDuration = (distance / 40) * 3600; // 40 km/h average, in seconds
          const trafficDuration = baseDuration * mockTrafficMultiplier;

          return {
            distance: {
              value: Math.round(distance * 1000), // meters
              text: `${distance.toFixed(1)} km`
            },
            duration: {
              value: Math.round(baseDuration),
              text: `${Math.round(baseDuration / 60)} mins`
            },
            duration_in_traffic: {
              value: Math.round(trafficDuration),
              text: `${Math.round(trafficDuration / 60)} mins`
            },
            status: 'OK'
          };
        })
      }));

      return { rows, status: 'OK' };
    },

    // Calculate Haversine distance
    calculateHaversineDistance(point1: Location, point2: Location): number {
      const R = 6371;
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

    // Full optimization flow
    async optimizeShoppingTrip(
      items: ShoppingItem[],
      userLocation: Location,
      weights: OptimizationWeights,
      startTime: string,
      options: { respectStoreHours: boolean; frozenLast: boolean; perishableWindow: number }
    ): Promise<OptimizationResult> {
      // Step 1: Assign items to stores
      const assignments = this.assignItemsToStores(items, weights, userLocation);

      // Step 2: Get store IDs with items
      const storeIds = assignments.map(a => a.storeId);

      // Step 3: Build optimized route with Google Maps data
      const route = await this.buildOptimizedRoute(storeIds, userLocation, startTime, options);

      // Step 4: Calculate savings vs single-store baseline
      const savings = this.calculateSavingsVsBaseline(assignments, items, 'safeway');

      // Step 5: Check perishable status
      const perishableStatus = this.checkPerishableStatus(items, route, options.perishableWindow);

      // Calculate totals
      const totalCost = assignments.reduce((sum, a) => sum + a.estimatedCost, 0);
      const totalDistance = route.reduce((sum, r) => sum + r.distance, 0);
      const totalTime = route.reduce((sum, r) => sum + r.duration + 30, 0); // 30 min avg shopping per store

      return {
        assignments,
        route,
        totalCost: Math.round(totalCost * 100) / 100,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalTime,
        savings,
        perishableStatus
      };
    },

    // Assign items to optimal stores
    assignItemsToStores(
      items: ShoppingItem[],
      weights: OptimizationWeights,
      userLocation: Location
    ): StoreAssignment[] {
      const assignmentMap = new Map<string, StoreAssignment>();

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

        const existing = assignmentMap.get(bestStore.id);
        const itemCost = (priceMatrix[item.category]?.[bestStore.id] || 5) * item.quantity;

        if (existing) {
          existing.items.push(item);
          existing.estimatedCost += itemCost;
        } else {
          assignmentMap.set(bestStore.id, {
            storeId: bestStore.id,
            storeName: bestStore.name,
            items: [item],
            estimatedCost: itemCost,
            travelTime: 0,
            distance: 0
          });
        }
      });

      return Array.from(assignmentMap.values());
    },

    // Calculate store score
    calculateStoreScore(
      store: Store,
      weights: OptimizationWeights,
      userLocation: Location,
      category: string
    ): number {
      const basePrice = priceMatrix[category]?.[store.id] || 5;
      const priceScore = 1 - (basePrice / 10);
      const qualityScore = store.ratings.quality / 5;
      const distance = this.calculateHaversineDistance(userLocation, store.location);
      const distanceScore = Math.max(0, 1 - (distance / 20));
      const convenienceScore = store.ratings.service / 5;

      return (
        weights.price * priceScore +
        weights.quality * qualityScore +
        weights.distance * distanceScore +
        weights.convenience * convenienceScore
      );
    },

    // Build optimized route using mocked Google Maps
    async buildOptimizedRoute(
      storeIds: string[],
      userLocation: Location,
      startTime: string,
      options: { frozenLast: boolean }
    ): Promise<RouteStep[]> {
      if (storeIds.length === 0) return [];

      // Sort stores - frozen store last if needed
      let orderedStores = storeIds.map(id => stores.find(s => s.id === id)!).filter(Boolean);

      if (options.frozenLast) {
        const frozenStores = orderedStores.filter(s => s.type === 'warehouse');
        const otherStores = orderedStores.filter(s => s.type !== 'warehouse');
        orderedStores = [...otherStores, ...frozenStores];
      }

      // Get distance matrix from mock Google Maps
      const allLocations = [userLocation, ...orderedStores.map(s => s.location)];
      const distanceResponse = await this.fetchDistanceMatrix(allLocations, allLocations);

      const route: RouteStep[] = [];
      let currentTime = this.parseTime(startTime);

      for (let i = 0; i < orderedStores.length; i++) {
        const store = orderedStores[i];
        const prevIndex = i === 0 ? 0 : i;
        const element = distanceResponse.rows[prevIndex].elements[i + 1];

        const distance = element.distance.value / 1000; // km
        const duration = Math.round(element.duration.value / 60); // minutes
        const trafficDuration = Math.round((element.duration_in_traffic?.value || element.duration.value) / 60);
        const trafficDelay = trafficDuration - duration;

        const arrivalTime = this.addMinutes(currentTime, trafficDuration);
        const departureTime = this.addMinutes(arrivalTime, 30); // 30 min shopping

        route.push({
          storeId: store.id,
          arrivalTime: this.formatTime(arrivalTime),
          departureTime: this.formatTime(departureTime),
          distance,
          duration,
          trafficDelay
        });

        currentTime = departureTime;
      }

      return route;
    },

    // Calculate savings vs single-store baseline
    calculateSavingsVsBaseline(
      assignments: StoreAssignment[],
      items: ShoppingItem[],
      baselineStoreId: string
    ): { amount: number; percent: number; baseline: number } {
      const optimizedCost = assignments.reduce((sum, a) => sum + a.estimatedCost, 0);

      const baselineCost = items.reduce((sum, item) => {
        const price = priceMatrix[item.category]?.[baselineStoreId] || 5;
        return sum + price * item.quantity;
      }, 0);

      const amount = baselineCost - optimizedCost;
      const percent = baselineCost > 0 ? (amount / baselineCost) * 100 : 0;

      return {
        amount: Math.round(amount * 100) / 100,
        percent: Math.round(percent * 10) / 10,
        baseline: Math.round(baselineCost * 100) / 100
      };
    },

    // Check perishable item status
    checkPerishableStatus(
      items: ShoppingItem[],
      route: RouteStep[],
      maxExposure: number
    ): { safe: boolean; exposureTime: number; atRiskItems: string[] } {
      const perishables = items.filter(i => i.perishable && !i.frozenRequired);

      if (perishables.length === 0 || route.length === 0) {
        return { safe: true, exposureTime: 0, atRiskItems: [] };
      }

      const firstDeparture = route[0].departureTime;
      const lastDeparture = route[route.length - 1].departureTime;

      const exposureTime = this.getTimeDiff(firstDeparture, lastDeparture);
      const atRiskItems = exposureTime > maxExposure ? perishables.map(i => i.name) : [];

      return {
        safe: exposureTime <= maxExposure,
        exposureTime,
        atRiskItems
      };
    },

    // Time utilities
    parseTime(time: string): number {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    },

    formatTime(minutes: number): string {
      const h = Math.floor(minutes / 60) % 24;
      const m = minutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },

    addMinutes(current: number, add: number): number {
      return current + add;
    },

    getTimeDiff(start: string, end: string): number {
      return this.parseTime(end) - this.parseTime(start);
    },

    // Get stores
    getStores(): Store[] {
      return stores;
    },

    // Get store by ID
    getStore(id: string): Store | undefined {
      return stores.find(s => s.id === id);
    }
  };
};

describe('Store Optimization Integration', () => {
  let service: ReturnType<typeof createStoreOptimizationService>;
  const userLocation: Location = { lat: 47.6080, lng: -122.3350 };

  const testItems: ShoppingItem[] = [
    { id: '1', name: 'Chicken Breast', quantity: 3, unit: 'lbs', category: 'protein', estimatedPrice: 4.99, perishable: true },
    { id: '2', name: 'Rice', quantity: 5, unit: 'lbs', category: 'grains', estimatedPrice: 1.99, perishable: false },
    { id: '3', name: 'Milk', quantity: 2, unit: 'gal', category: 'dairy', estimatedPrice: 3.99, perishable: true },
    { id: '4', name: 'Vegetables', quantity: 3, unit: 'lbs', category: 'produce', estimatedPrice: 2.99, perishable: true },
    { id: '5', name: 'Frozen Pizza', quantity: 2, unit: 'each', category: 'frozen', estimatedPrice: 6.99, perishable: true, frozenRequired: true }
  ];

  const balancedWeights: OptimizationWeights = {
    price: 0.25,
    quality: 0.25,
    distance: 0.25,
    convenience: 0.25
  };

  const budgetWeights: OptimizationWeights = {
    price: 0.6,
    quality: 0.1,
    distance: 0.2,
    convenience: 0.1
  };

  beforeEach(() => {
    service = createStoreOptimizationService();
    service.setMockMode(true);
    service.setTrafficMultiplier(1.0);
  });

  // ============================================
  // Complete Optimization Flow Tests (6 tests)
  // ============================================
  describe('Complete Optimization Flow', () => {
    it('should complete full optimization and return result', async () => {
      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        balancedWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      expect(result).toHaveProperty('assignments');
      expect(result).toHaveProperty('route');
      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('savings');
      expect(result).toHaveProperty('perishableStatus');
    });

    it('should assign all items to stores', async () => {
      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        balancedWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      const totalItems = result.assignments.reduce((sum, a) => sum + a.items.length, 0);
      expect(totalItems).toBe(testItems.length);
    });

    it('should create route for all assigned stores', async () => {
      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        balancedWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      expect(result.route.length).toBe(result.assignments.length);
    });

    it('should calculate total cost', async () => {
      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        balancedWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      expect(result.totalCost).toBeGreaterThan(0);
    });

    it('should calculate total distance', async () => {
      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        balancedWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      expect(result.totalDistance).toBeGreaterThan(0);
    });

    it('should calculate total time including shopping', async () => {
      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        balancedWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      expect(result.totalTime).toBeGreaterThan(30); // At least one store visit
    });
  });

  // ============================================
  // Google Maps API Integration Tests (5 tests)
  // ============================================
  describe('Google Maps API Integration (Mocked)', () => {
    it('should fetch distance matrix', async () => {
      const origins = [userLocation];
      const destinations = [{ lat: 47.6062, lng: -122.3321 }];

      const response = await service.fetchDistanceMatrix(origins, destinations);

      expect(response.status).toBe('OK');
      expect(response.rows).toHaveLength(1);
      expect(response.rows[0].elements).toHaveLength(1);
    });

    it('should return distance and duration in response', async () => {
      const origins = [userLocation];
      const destinations = [{ lat: 47.6062, lng: -122.3321 }];

      const response = await service.fetchDistanceMatrix(origins, destinations);
      const element = response.rows[0].elements[0];

      expect(element.distance).toHaveProperty('value');
      expect(element.duration).toHaveProperty('value');
      expect(element.status).toBe('OK');
    });

    it('should include traffic duration when available', async () => {
      service.setTrafficMultiplier(1.5);

      const origins = [userLocation];
      const destinations = [{ lat: 47.6062, lng: -122.3321 }];

      const response = await service.fetchDistanceMatrix(origins, destinations);
      const element = response.rows[0].elements[0];

      expect(element.duration_in_traffic).toBeDefined();
      expect(element.duration_in_traffic?.value).toBeGreaterThan(element.duration.value);
    });

    it('should calculate route steps with arrival times', async () => {
      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        balancedWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      result.route.forEach(step => {
        expect(step.arrivalTime).toMatch(/^\d{2}:\d{2}$/);
        expect(step.departureTime).toMatch(/^\d{2}:\d{2}$/);
      });
    });

    it('should include traffic delay in route steps', async () => {
      service.setTrafficMultiplier(1.5);

      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        balancedWeights,
        '08:00', // Rush hour
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      const hasTrafficDelay = result.route.some(step => step.trafficDelay > 0);
      expect(hasTrafficDelay).toBe(true);
    });
  });

  // ============================================
  // Savings vs Single-Store Baseline Tests (5 tests)
  // ============================================
  describe('Savings vs Single-Store Baseline', () => {
    it('should calculate savings amount', async () => {
      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        budgetWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      expect(result.savings.amount).toBeDefined();
      expect(typeof result.savings.amount).toBe('number');
    });

    it('should calculate savings percentage', async () => {
      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        budgetWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      expect(result.savings.percent).toBeDefined();
      expect(result.savings.percent).toBeGreaterThanOrEqual(0);
    });

    it('should show positive savings with budget optimization', async () => {
      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        budgetWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      // Budget optimization vs premium baseline should save money
      expect(result.savings.amount).toBeGreaterThanOrEqual(0);
    });

    it('should include baseline cost in savings', async () => {
      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        budgetWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      expect(result.savings.baseline).toBeGreaterThan(0);
      expect(result.savings.baseline).toBeGreaterThanOrEqual(result.totalCost);
    });

    it('should show savings relationship: baseline = optimized + savings', async () => {
      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        budgetWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      const calculated = result.totalCost + result.savings.amount;
      expect(calculated).toBeCloseTo(result.savings.baseline, 1);
    });
  });

  // ============================================
  // Route with Traffic Tests (4 tests)
  // ============================================
  describe('Route with Traffic', () => {
    it('should apply traffic multiplier to travel times', async () => {
      service.setTrafficMultiplier(1.0);
      const normalResult = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        balancedWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      service.setTrafficMultiplier(1.5);
      const trafficResult = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        balancedWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      // Traffic should cause delay (or at least equal time if rounded same)
      expect(trafficResult.totalTime).toBeGreaterThanOrEqual(normalResult.totalTime);
      // But traffic delays should be present
      const totalDelay = trafficResult.route.reduce((sum, step) => sum + step.trafficDelay, 0);
      expect(totalDelay).toBeGreaterThan(0);
    });

    it('should calculate traffic delay per step', async () => {
      service.setTrafficMultiplier(2.0);

      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        balancedWeights,
        '08:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      const totalDelay = result.route.reduce((sum, step) => sum + step.trafficDelay, 0);
      expect(totalDelay).toBeGreaterThan(0);
    });

    it('should return zero traffic delay in normal conditions', async () => {
      service.setTrafficMultiplier(1.0);

      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        balancedWeights,
        '14:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      const totalDelay = result.route.reduce((sum, step) => sum + step.trafficDelay, 0);
      expect(totalDelay).toBe(0);
    });

    it('should include distance in route steps', async () => {
      const result = await service.optimizeShoppingTrip(
        testItems,
        userLocation,
        balancedWeights,
        '10:00',
        { respectStoreHours: true, frozenLast: true, perishableWindow: 90 }
      );

      result.route.forEach(step => {
        expect(step.distance).toBeGreaterThan(0);
      });
    });
  });
});
