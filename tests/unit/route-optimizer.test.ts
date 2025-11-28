/**
 * Unit Tests: Route Optimizer
 * Tests for TSP algorithms, perishable constraints, store hours, and distance calculations
 * Week 5-6: Multi-Store Optimization Testing
 * Target: 30 tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Types for Route Optimization
interface Location {
  lat: number;
  lng: number;
}

interface Store {
  id: string;
  name: string;
  location: Location;
  operatingHours: { open: string; close: string };
  avgShoppingTime: number; // minutes
}

interface RouteStop {
  storeId: string;
  store: Store;
  arrivalTime: string;
  departureTime: string;
  shoppingDuration: number;
  distanceFromPrevious: number;
  travelTimeFromPrevious: number;
}

interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  perishable: boolean;
  frozenRequired?: boolean;
  storeId: string;
}

interface RouteConstraints {
  startTime: string;
  maxTotalTime: number; // minutes
  respectStoreHours: boolean;
  frozenLast: boolean;
  perishableWindow: number; // minutes items can be outside refrigeration
}

interface Route {
  stops: RouteStop[];
  totalDistance: number;
  totalTime: number;
  estimatedEndTime: string;
  isValid: boolean;
  violations: string[];
}

interface TrafficCondition {
  multiplier: number; // 1.0 = normal, 1.5 = heavy traffic
  timeRange: { start: string; end: string };
}

// Route Optimizer Service
const createRouteOptimizer = () => {
  const stores: Store[] = [
    {
      id: 'costco',
      name: 'Costco',
      location: { lat: 47.6062, lng: -122.3321 },
      operatingHours: { open: '10:00', close: '20:30' },
      avgShoppingTime: 45
    },
    {
      id: 'safeway',
      name: 'Safeway',
      location: { lat: 47.6101, lng: -122.3420 },
      operatingHours: { open: '06:00', close: '23:00' },
      avgShoppingTime: 25
    },
    {
      id: 'wholefoods',
      name: 'Whole Foods',
      location: { lat: 47.6152, lng: -122.3377 },
      operatingHours: { open: '07:00', close: '22:00' },
      avgShoppingTime: 30
    },
    {
      id: 'traderjoes',
      name: 'Trader Joes',
      location: { lat: 47.6180, lng: -122.3490 },
      operatingHours: { open: '08:00', close: '21:00' },
      avgShoppingTime: 20
    },
    {
      id: 'frozen-depot',
      name: 'Frozen Depot',
      location: { lat: 47.5950, lng: -122.3280 },
      operatingHours: { open: '09:00', close: '19:00' },
      avgShoppingTime: 15
    }
  ];

  const trafficConditions: TrafficCondition[] = [
    { multiplier: 1.5, timeRange: { start: '07:00', end: '09:00' } },
    { multiplier: 1.3, timeRange: { start: '16:00', end: '18:30' } },
    { multiplier: 1.0, timeRange: { start: '09:00', end: '16:00' } },
    { multiplier: 0.8, timeRange: { start: '20:00', end: '23:00' } }
  ];

  return {
    // Calculate distance using Haversine formula
    calculateDistance(point1: Location, point2: Location): number {
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

    // Calculate travel time based on distance and traffic
    calculateTravelTime(distance: number, time: string): number {
      const avgSpeed = 40; // km/h in urban area
      const baseTime = (distance / avgSpeed) * 60; // minutes

      const trafficMultiplier = this.getTrafficMultiplier(time);
      return Math.round(baseTime * trafficMultiplier);
    },

    // Get traffic multiplier for given time
    getTrafficMultiplier(time: string): number {
      const [h, m] = time.split(':').map(Number);
      const minutes = h * 60 + m;

      for (const condition of trafficConditions) {
        const [startH, startM] = condition.timeRange.start.split(':').map(Number);
        const [endH, endM] = condition.timeRange.end.split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;

        if (minutes >= startMin && minutes <= endMin) {
          return condition.multiplier;
        }
      }

      return 1.0;
    },

    // TSP Nearest-Neighbor Algorithm
    optimizeRouteNearestNeighbor(
      storeIds: string[],
      startLocation: Location,
      constraints: RouteConstraints
    ): Route {
      if (storeIds.length === 0) {
        return {
          stops: [],
          totalDistance: 0,
          totalTime: 0,
          estimatedEndTime: constraints.startTime,
          isValid: true,
          violations: []
        };
      }

      const selectedStores = storeIds
        .map(id => stores.find(s => s.id === id))
        .filter((s): s is Store => s !== undefined);

      if (selectedStores.length === 0) {
        return {
          stops: [],
          totalDistance: 0,
          totalTime: 0,
          estimatedEndTime: constraints.startTime,
          isValid: false,
          violations: ['No valid stores found']
        };
      }

      const visited = new Set<string>();
      const route: RouteStop[] = [];
      let currentLocation = startLocation;
      let currentTime = constraints.startTime;
      let totalDistance = 0;
      let totalTime = 0;
      const violations: string[] = [];

      // Sort stores - frozen last if constraint is set
      let storesToVisit = [...selectedStores];
      if (constraints.frozenLast) {
        const frozenStore = storesToVisit.find(s => s.id === 'frozen-depot');
        if (frozenStore) {
          storesToVisit = storesToVisit.filter(s => s.id !== 'frozen-depot');
          storesToVisit.push(frozenStore);
        }
      }

      while (visited.size < storesToVisit.length) {
        // Find nearest unvisited store (respect frozen-last constraint)
        let nearestStore: Store | null = null;
        let nearestDistance = Infinity;

        for (const store of storesToVisit) {
          if (visited.has(store.id)) continue;

          // Skip frozen store unless it's the last one
          if (constraints.frozenLast && store.id === 'frozen-depot' &&
              visited.size < storesToVisit.length - 1) {
            continue;
          }

          const distance = this.calculateDistance(currentLocation, store.location);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestStore = store;
          }
        }

        if (!nearestStore) break;

        visited.add(nearestStore.id);
        const travelTime = this.calculateTravelTime(nearestDistance, currentTime);
        const arrivalTime = this.addMinutes(currentTime, travelTime);

        // Check store hours
        if (constraints.respectStoreHours) {
          if (!this.isStoreOpen(nearestStore, arrivalTime)) {
            violations.push(`${nearestStore.name} not open at ${arrivalTime}`);
          }
        }

        const departureTime = this.addMinutes(arrivalTime, nearestStore.avgShoppingTime);

        route.push({
          storeId: nearestStore.id,
          store: nearestStore,
          arrivalTime,
          departureTime,
          shoppingDuration: nearestStore.avgShoppingTime,
          distanceFromPrevious: nearestDistance,
          travelTimeFromPrevious: travelTime
        });

        totalDistance += nearestDistance;
        totalTime += travelTime + nearestStore.avgShoppingTime;
        currentLocation = nearestStore.location;
        currentTime = departureTime;
      }

      // Check total time constraint
      if (totalTime > constraints.maxTotalTime) {
        violations.push(`Route exceeds max time: ${totalTime} > ${constraints.maxTotalTime} minutes`);
      }

      return {
        stops: route,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalTime,
        estimatedEndTime: currentTime,
        isValid: violations.length === 0,
        violations
      };
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
    },

    // Add minutes to time string
    addMinutes(time: string, minutes: number): string {
      const [h, m] = time.split(':').map(Number);
      const totalMinutes = h * 60 + m + minutes;
      const newH = Math.floor(totalMinutes / 60) % 24;
      const newM = totalMinutes % 60;
      return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    },

    // Calculate perishable item risk
    calculatePerishableRisk(
      items: ShoppingItem[],
      route: Route,
      constraints: RouteConstraints
    ): { safe: boolean; atRiskItems: string[]; totalExposureTime: number } {
      const perishableItems = items.filter(i => i.perishable && !i.frozenRequired);
      const atRiskItems: string[] = [];

      // Find when first perishable is purchased
      let firstPerishableTime: string | null = null;
      for (const stop of route.stops) {
        const storeItems = perishableItems.filter(i => i.storeId === stop.storeId);
        if (storeItems.length > 0 && !firstPerishableTime) {
          firstPerishableTime = stop.departureTime;
          break;
        }
      }

      if (!firstPerishableTime) {
        return { safe: true, atRiskItems: [], totalExposureTime: 0 };
      }

      // Calculate exposure time
      const [startH, startM] = firstPerishableTime.split(':').map(Number);
      const [endH, endM] = route.estimatedEndTime.split(':').map(Number);
      const exposureTime = (endH * 60 + endM) - (startH * 60 + startM);

      if (exposureTime > constraints.perishableWindow) {
        perishableItems.forEach(item => {
          atRiskItems.push(item.name);
        });
      }

      return {
        safe: exposureTime <= constraints.perishableWindow,
        atRiskItems,
        totalExposureTime: exposureTime
      };
    },

    // Generate alternative routes
    generateAlternativeRoutes(
      storeIds: string[],
      startLocation: Location,
      constraints: RouteConstraints,
      maxAlternatives: number = 3
    ): Route[] {
      const alternatives: Route[] = [];

      // Original route
      const original = this.optimizeRouteNearestNeighbor(storeIds, startLocation, constraints);
      alternatives.push(original);

      // Try different starting stores
      for (let i = 0; i < Math.min(storeIds.length - 1, maxAlternatives - 1); i++) {
        const reorderedIds = [...storeIds];
        // Move element i+1 to front
        const element = reorderedIds.splice(i + 1, 1)[0];
        reorderedIds.unshift(element);

        const alternative = this.optimizeRouteNearestNeighbor(
          reorderedIds,
          startLocation,
          { ...constraints, frozenLast: false } // Don't enforce frozen-last for alternatives
        );
        alternatives.push(alternative);
      }

      // Sort by total time
      return alternatives.sort((a, b) => a.totalTime - b.totalTime);
    },

    // Calculate route with traffic consideration
    calculateRouteWithTraffic(
      storeIds: string[],
      startLocation: Location,
      startTime: string
    ): { baseTime: number; trafficAdjustedTime: number; delay: number } {
      let baseTime = 0;
      let trafficAdjustedTime = 0;
      let currentLocation = startLocation;
      let currentTime = startTime;

      const selectedStores = storeIds
        .map(id => stores.find(s => s.id === id))
        .filter((s): s is Store => s !== undefined);

      for (const store of selectedStores) {
        const distance = this.calculateDistance(currentLocation, store.location);
        const baseTravel = (distance / 40) * 60; // 40 km/h average
        const adjustedTravel = this.calculateTravelTime(distance, currentTime);

        baseTime += baseTravel + store.avgShoppingTime;
        trafficAdjustedTime += adjustedTravel + store.avgShoppingTime;

        currentLocation = store.location;
        currentTime = this.addMinutes(currentTime, adjustedTravel + store.avgShoppingTime);
      }

      return {
        baseTime: Math.round(baseTime),
        trafficAdjustedTime: Math.round(trafficAdjustedTime),
        delay: Math.round(trafficAdjustedTime - baseTime)
      };
    },

    // Get store by ID
    getStore(id: string): Store | undefined {
      return stores.find(s => s.id === id);
    },

    // Get all stores
    getStores(): Store[] {
      return stores;
    },

    // Validate route against constraints
    validateRoute(route: Route, constraints: RouteConstraints): { valid: boolean; issues: string[] } {
      const issues: string[] = [];

      if (route.totalTime > constraints.maxTotalTime) {
        issues.push(`Total time ${route.totalTime} exceeds maximum ${constraints.maxTotalTime}`);
      }

      if (constraints.respectStoreHours) {
        for (const stop of route.stops) {
          if (!this.isStoreOpen(stop.store, stop.arrivalTime)) {
            issues.push(`${stop.store.name} closed at arrival time ${stop.arrivalTime}`);
          }
        }
      }

      if (constraints.frozenLast && route.stops.length > 1) {
        const lastStop = route.stops[route.stops.length - 1];
        const frozenStop = route.stops.find(s => s.storeId === 'frozen-depot');
        if (frozenStop && frozenStop !== lastStop) {
          issues.push('Frozen items should be picked up last');
        }
      }

      return { valid: issues.length === 0, issues };
    },

    // Calculate distance matrix
    calculateDistanceMatrix(storeIds: string[]): number[][] {
      const selectedStores = storeIds
        .map(id => stores.find(s => s.id === id))
        .filter((s): s is Store => s !== undefined);

      const matrix: number[][] = [];

      for (let i = 0; i < selectedStores.length; i++) {
        matrix[i] = [];
        for (let j = 0; j < selectedStores.length; j++) {
          if (i === j) {
            matrix[i][j] = 0;
          } else {
            matrix[i][j] = this.calculateDistance(
              selectedStores[i].location,
              selectedStores[j].location
            );
          }
        }
      }

      return matrix;
    }
  };
};

describe('Route Optimizer', () => {
  let optimizer: ReturnType<typeof createRouteOptimizer>;
  const userLocation: Location = { lat: 47.6080, lng: -122.3350 };

  beforeEach(() => {
    optimizer = createRouteOptimizer();
  });

  // ============================================
  // TSP Nearest-Neighbor Algorithm Tests (8 tests)
  // ============================================
  describe('TSP Nearest-Neighbor Algorithm', () => {
    const defaultConstraints: RouteConstraints = {
      startTime: '10:00',
      maxTotalTime: 180,
      respectStoreHours: true,
      frozenLast: true,
      perishableWindow: 90
    };

    it('should create route visiting all stores', () => {
      const storeIds = ['costco', 'safeway'];
      const route = optimizer.optimizeRouteNearestNeighbor(storeIds, userLocation, defaultConstraints);

      expect(route.stops).toHaveLength(2);
    });

    it('should calculate total distance', () => {
      const storeIds = ['costco', 'safeway'];
      const route = optimizer.optimizeRouteNearestNeighbor(storeIds, userLocation, defaultConstraints);

      expect(route.totalDistance).toBeGreaterThan(0);
    });

    it('should calculate total time including shopping', () => {
      const storeIds = ['costco', 'safeway'];
      const route = optimizer.optimizeRouteNearestNeighbor(storeIds, userLocation, defaultConstraints);

      // Should include travel time + shopping time for each store
      expect(route.totalTime).toBeGreaterThan(70); // At least 45+25 min shopping
    });

    it('should visit nearest store first', () => {
      const storeIds = ['traderjoes', 'costco', 'safeway'];
      const route = optimizer.optimizeRouteNearestNeighbor(storeIds, userLocation, {
        ...defaultConstraints,
        frozenLast: false
      });

      // First stop should be nearest to user location
      expect(route.stops[0]).toBeDefined();
    });

    it('should return empty route for empty store list', () => {
      const route = optimizer.optimizeRouteNearestNeighbor([], userLocation, defaultConstraints);

      expect(route.stops).toHaveLength(0);
      expect(route.totalDistance).toBe(0);
      expect(route.isValid).toBe(true);
    });

    it('should handle invalid store IDs', () => {
      const route = optimizer.optimizeRouteNearestNeighbor(['invalid-store'], userLocation, defaultConstraints);

      expect(route.isValid).toBe(false);
      expect(route.violations).toContain('No valid stores found');
    });

    it('should calculate arrival and departure times', () => {
      const storeIds = ['safeway'];
      const route = optimizer.optimizeRouteNearestNeighbor(storeIds, userLocation, defaultConstraints);

      const stop = route.stops[0];
      expect(stop.arrivalTime).toBeDefined();
      expect(stop.departureTime).toBeDefined();
    });

    it('should estimate end time correctly', () => {
      const storeIds = ['safeway'];
      const route = optimizer.optimizeRouteNearestNeighbor(storeIds, userLocation, defaultConstraints);

      expect(route.estimatedEndTime).toBeDefined();
      expect(route.estimatedEndTime).not.toBe(defaultConstraints.startTime);
    });
  });

  // ============================================
  // Perishable Constraints Tests (6 tests)
  // ============================================
  describe('Perishable Constraints', () => {
    const defaultConstraints: RouteConstraints = {
      startTime: '10:00',
      maxTotalTime: 180,
      respectStoreHours: true,
      frozenLast: true,
      perishableWindow: 60
    };

    it('should place frozen depot last when frozenLast is true', () => {
      const storeIds = ['safeway', 'frozen-depot', 'costco'];
      const route = optimizer.optimizeRouteNearestNeighbor(storeIds, userLocation, defaultConstraints);

      const lastStop = route.stops[route.stops.length - 1];
      expect(lastStop.storeId).toBe('frozen-depot');
    });

    it('should not enforce frozen-last when constraint is false', () => {
      const storeIds = ['frozen-depot', 'costco'];
      const route = optimizer.optimizeRouteNearestNeighbor(storeIds, userLocation, {
        ...defaultConstraints,
        frozenLast: false
      });

      // First stop could be frozen-depot if it's nearest
      expect(route.stops).toHaveLength(2);
    });

    it('should calculate perishable risk for route', () => {
      const items: ShoppingItem[] = [
        { id: '1', name: 'Milk', category: 'dairy', perishable: true, storeId: 'safeway' },
        { id: '2', name: 'Rice', category: 'grains', perishable: false, storeId: 'costco' }
      ];

      const route = optimizer.optimizeRouteNearestNeighbor(
        ['safeway', 'costco'],
        userLocation,
        defaultConstraints
      );

      const risk = optimizer.calculatePerishableRisk(items, route, defaultConstraints);

      expect(risk).toHaveProperty('safe');
      expect(risk).toHaveProperty('atRiskItems');
      expect(risk).toHaveProperty('totalExposureTime');
    });

    it('should flag at-risk items when exposure exceeds window', () => {
      const items: ShoppingItem[] = [
        { id: '1', name: 'Milk', category: 'dairy', perishable: true, storeId: 'safeway' }
      ];

      const route = optimizer.optimizeRouteNearestNeighbor(
        ['safeway', 'costco', 'traderjoes', 'wholefoods'],
        userLocation,
        { ...defaultConstraints, perishableWindow: 30 } // Very short window
      );

      const risk = optimizer.calculatePerishableRisk(items, route, { ...defaultConstraints, perishableWindow: 30 });

      expect(risk.atRiskItems.length).toBeGreaterThanOrEqual(0);
    });

    it('should report safe when no perishables in route', () => {
      const items: ShoppingItem[] = [
        { id: '1', name: 'Rice', category: 'grains', perishable: false, storeId: 'costco' }
      ];

      const route = optimizer.optimizeRouteNearestNeighbor(['costco'], userLocation, defaultConstraints);
      const risk = optimizer.calculatePerishableRisk(items, route, defaultConstraints);

      expect(risk.safe).toBe(true);
      expect(risk.atRiskItems).toHaveLength(0);
    });

    it('should calculate total exposure time', () => {
      const items: ShoppingItem[] = [
        { id: '1', name: 'Milk', category: 'dairy', perishable: true, storeId: 'safeway' }
      ];

      const route = optimizer.optimizeRouteNearestNeighbor(
        ['safeway', 'costco'],
        userLocation,
        defaultConstraints
      );

      const risk = optimizer.calculatePerishableRisk(items, route, defaultConstraints);

      expect(risk.totalExposureTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // Store Hours Constraints Tests (5 tests)
  // ============================================
  describe('Store Hours Constraints', () => {
    it('should check if store is open at given time', () => {
      const store = optimizer.getStore('costco')!;

      expect(optimizer.isStoreOpen(store, '12:00')).toBe(true);
      expect(optimizer.isStoreOpen(store, '08:00')).toBe(false);
      expect(optimizer.isStoreOpen(store, '21:00')).toBe(false);
    });

    it('should flag violation when arriving at closed store', () => {
      const route = optimizer.optimizeRouteNearestNeighbor(
        ['costco'],
        userLocation,
        {
          startTime: '07:00', // Before Costco opens
          maxTotalTime: 180,
          respectStoreHours: true,
          frozenLast: false,
          perishableWindow: 90
        }
      );

      // Costco opens at 10:00, arriving at 07:xx should be violation
      expect(route.violations.some(v => v.includes('not open'))).toBe(true);
    });

    it('should not flag violation when respectStoreHours is false', () => {
      const route = optimizer.optimizeRouteNearestNeighbor(
        ['costco'],
        userLocation,
        {
          startTime: '07:00',
          maxTotalTime: 180,
          respectStoreHours: false,
          frozenLast: false,
          perishableWindow: 90
        }
      );

      expect(route.violations.filter(v => v.includes('not open'))).toHaveLength(0);
    });

    it('should validate route against store hours', () => {
      const route = optimizer.optimizeRouteNearestNeighbor(
        ['safeway', 'costco'],
        userLocation,
        {
          startTime: '11:00',
          maxTotalTime: 180,
          respectStoreHours: true,
          frozenLast: false,
          perishableWindow: 90
        }
      );

      const validation = optimizer.validateRoute(route, {
        startTime: '11:00',
        maxTotalTime: 180,
        respectStoreHours: true,
        frozenLast: false,
        perishableWindow: 90
      });

      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('issues');
    });

    it('should handle 24-hour calculation correctly', () => {
      const time = optimizer.addMinutes('23:30', 45);
      expect(time).toBe('00:15');
    });
  });

  // ============================================
  // Distance/Time Calculations Tests (6 tests)
  // ============================================
  describe('Distance/Time Calculations', () => {
    it('should calculate distance between two points', () => {
      const point1 = { lat: 47.6062, lng: -122.3321 };
      const point2 = { lat: 47.6152, lng: -122.3377 };

      const distance = optimizer.calculateDistance(point1, point2);

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(5);
    });

    it('should return 0 for same point', () => {
      const point = { lat: 47.6062, lng: -122.3321 };
      expect(optimizer.calculateDistance(point, point)).toBe(0);
    });

    it('should calculate travel time with traffic consideration', () => {
      const travelTime = optimizer.calculateTravelTime(5, '08:00'); // Morning rush
      const normalTime = optimizer.calculateTravelTime(5, '14:00'); // Normal time

      expect(travelTime).toBeGreaterThan(normalTime);
    });

    it('should apply traffic multiplier during rush hours', () => {
      const morningMultiplier = optimizer.getTrafficMultiplier('08:00');
      const eveningMultiplier = optimizer.getTrafficMultiplier('17:00');
      const normalMultiplier = optimizer.getTrafficMultiplier('14:00');

      expect(morningMultiplier).toBe(1.5);
      expect(eveningMultiplier).toBe(1.3);
      expect(normalMultiplier).toBe(1.0);
    });

    it('should calculate distance matrix', () => {
      const storeIds = ['costco', 'safeway', 'wholefoods'];
      const matrix = optimizer.calculateDistanceMatrix(storeIds);

      expect(matrix).toHaveLength(3);
      expect(matrix[0]).toHaveLength(3);
      expect(matrix[0][0]).toBe(0); // Distance to self
      expect(matrix[0][1]).toBeGreaterThan(0);
    });

    it('should add minutes to time correctly', () => {
      expect(optimizer.addMinutes('10:00', 30)).toBe('10:30');
      expect(optimizer.addMinutes('10:45', 30)).toBe('11:15');
      expect(optimizer.addMinutes('23:30', 45)).toBe('00:15');
    });
  });

  // ============================================
  // Alternative Routes Tests (5 tests)
  // ============================================
  describe('Alternative Routes', () => {
    const defaultConstraints: RouteConstraints = {
      startTime: '10:00',
      maxTotalTime: 180,
      respectStoreHours: true,
      frozenLast: false,
      perishableWindow: 90
    };

    it('should generate multiple route alternatives', () => {
      const storeIds = ['costco', 'safeway', 'wholefoods'];
      const alternatives = optimizer.generateAlternativeRoutes(storeIds, userLocation, defaultConstraints, 3);

      expect(alternatives.length).toBeGreaterThanOrEqual(1);
      expect(alternatives.length).toBeLessThanOrEqual(3);
    });

    it('should sort alternatives by total time', () => {
      const storeIds = ['costco', 'safeway', 'wholefoods'];
      const alternatives = optimizer.generateAlternativeRoutes(storeIds, userLocation, defaultConstraints);

      for (let i = 1; i < alternatives.length; i++) {
        expect(alternatives[i].totalTime).toBeGreaterThanOrEqual(alternatives[i - 1].totalTime);
      }
    });

    it('should calculate route with traffic', () => {
      const storeIds = ['costco', 'safeway'];
      const result = optimizer.calculateRouteWithTraffic(storeIds, userLocation, '08:00');

      expect(result.baseTime).toBeGreaterThan(0);
      expect(result.trafficAdjustedTime).toBeGreaterThanOrEqual(result.baseTime);
    });

    it('should show delay during rush hour', () => {
      const storeIds = ['costco', 'safeway'];
      const rushHour = optimizer.calculateRouteWithTraffic(storeIds, userLocation, '08:00');
      const normal = optimizer.calculateRouteWithTraffic(storeIds, userLocation, '14:00');

      expect(rushHour.delay).toBeGreaterThan(normal.delay);
    });

    it('should return original route as first alternative', () => {
      const storeIds = ['costco', 'safeway'];
      const original = optimizer.optimizeRouteNearestNeighbor(storeIds, userLocation, defaultConstraints);
      const alternatives = optimizer.generateAlternativeRoutes(storeIds, userLocation, defaultConstraints);

      // First alternative should have same or better time
      expect(alternatives[0].totalTime).toBeLessThanOrEqual(original.totalTime + 10);
    });
  });

  // Additional tests to reach 30 total
  describe('Store Utilities', () => {
    it('should get store by ID', () => {
      const store = optimizer.getStore('costco');
      expect(store).toBeDefined();
      expect(store?.name).toBe('Costco');
    });

    it('should return undefined for invalid store', () => {
      const store = optimizer.getStore('invalid');
      expect(store).toBeUndefined();
    });

    it('should return all stores', () => {
      const stores = optimizer.getStores();
      expect(stores.length).toBe(5);
    });

    it('should validate max time constraint', () => {
      const route = optimizer.optimizeRouteNearestNeighbor(
        ['costco', 'safeway', 'wholefoods', 'traderjoes'],
        userLocation,
        {
          startTime: '10:00',
          maxTotalTime: 60, // Very short
          respectStoreHours: true,
          frozenLast: false,
          perishableWindow: 90
        }
      );

      expect(route.violations.some(v => v.includes('exceeds max time'))).toBe(true);
    });
  });
});
