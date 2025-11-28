/**
 * Route Optimizer Service
 * Week 5-6 Implementation - PRD User Story 1.1
 *
 * Provides route optimization for multi-store shopping trips:
 * - Traveling Salesman Problem (TSP) solutions
 * - Alternative route generation
 * - Traffic-aware timing
 */

const { v4: uuidv4 } = require('uuid');
const { MapsService } = require('./mapsService');

/**
 * RouteOptimizer class
 * Handles route calculation and optimization for multi-store shopping
 */
class RouteOptimizer {
  constructor(options = {}) {
    this.mapsService = options.mapsService || new MapsService();
    this.maxStopsPerRoute = options.maxStopsPerRoute || 5;
    this.defaultStartTime = options.defaultStartTime || '10:00';
  }

  /**
   * Calculate the optimal route through multiple stores
   * Uses nearest neighbor heuristic for TSP approximation
   *
   * @param {Array} storeIds - Array of store objects with location data
   * @param {Object} startLocation - Starting coordinates { lat, lng, address }
   * @param {Object} options - Route options
   * @returns {Object} Optimal route with details
   */
  async calculateOptimalRoute(stores, startLocation, options = {}) {
    if (!stores.length) {
      return this.emptyRoute();
    }

    // Get store locations
    const storeLocations = await this.resolveStoreLocations(stores);

    // Optimize waypoint order
    const optimization = await this.mapsService.optimizeWaypointOrder(
      storeLocations,
      startLocation
    );

    // Build optimized store list
    const orderedStores = optimization.optimizedOrder.map(i => stores[i]);

    // Get detailed route with directions
    const route = await this.buildDetailedRoute(
      startLocation,
      orderedStores,
      options
    );

    return {
      id: uuidv4(),
      visitOrder: orderedStores.map(s => s.id),
      stores: orderedStores.map((store, index) => ({
        order: index + 1,
        storeId: store.id,
        storeName: store.name,
        address: store.address,
        location: storeLocations[optimization.optimizedOrder[index]],
        estimatedArrival: this.calculateArrivalTime(
          options.departureTime || new Date(),
          route.segments.slice(0, index).reduce((sum, s) => sum + s.durationMinutes, 0)
        ),
        estimatedVisitDuration: store.avgVisitDuration || 20
      })),
      totalDistance: {
        miles: route.totalDistance,
        text: `${route.totalDistance.toFixed(1)} mi`
      },
      totalTime: {
        minutes: route.totalDuration,
        text: this.formatDuration(route.totalDuration),
        breakdown: {
          driving: route.drivingTime,
          shopping: route.shoppingTime
        }
      },
      segments: route.segments,
      returnToStart: options.returnToStart || false,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Get alternative routes with different priorities
   *
   * @param {Array} stores - Stores to visit
   * @param {Object} startLocation - Starting location
   * @returns {Object} Multiple route options
   */
  async getAlternativeRoutes(stores, startLocation) {
    const routes = [];

    // Route 1: Optimized (shortest distance)
    const optimal = await this.calculateOptimalRoute(stores, startLocation, {
      optimize: 'distance'
    });
    routes.push({
      type: 'optimal',
      label: 'Shortest Distance',
      description: 'Minimizes total driving distance',
      ...optimal
    });

    // Route 2: Time-optimized (consider traffic)
    if (stores.length > 2) {
      const trafficAware = await this.calculateOptimalRoute(stores, startLocation, {
        optimize: 'time',
        includeTraffic: true
      });
      routes.push({
        type: 'fastest',
        label: 'Fastest Route',
        description: 'Considers current traffic conditions',
        ...trafficAware
      });
    }

    // Route 3: Fewer stops (consolidate stores)
    if (stores.length > 3) {
      const consolidated = await this.createConsolidatedRoute(stores, startLocation);
      routes.push({
        type: 'consolidated',
        label: 'Fewer Stops',
        description: 'Reduced number of stores',
        ...consolidated
      });
    }

    // Compare routes
    const comparison = this.compareRoutes(routes);

    return {
      routes,
      comparison,
      recommendation: this.selectBestRoute(routes, comparison)
    };
  }

  /**
   * Estimate total driving time with traffic
   *
   * @param {Array} stores - Stores to visit
   * @param {Date} departureTime - When to depart
   * @returns {Object} Time estimate
   */
  async estimateDrivingTime(stores, startLocation, departureTime = new Date()) {
    return this.mapsService.estimateDrivingTime(stores, startLocation, departureTime);
  }

  /**
   * Get turn-by-turn directions for a route
   *
   * @param {Array} stores - Ordered stores to visit
   * @param {Object} startLocation - Starting location
   * @returns {Object} Detailed directions
   */
  async getDirections(stores, startLocation) {
    const storeLocations = await this.resolveStoreLocations(stores);

    if (!storeLocations.length) {
      return { directions: [], totalDistance: 0, totalDuration: 0 };
    }

    const endLocation = storeLocations[storeLocations.length - 1];
    const waypoints = storeLocations.slice(0, -1);

    const directions = await this.mapsService.getDirections(
      startLocation,
      endLocation,
      waypoints,
      { optimizeWaypoints: false } // Already optimized
    );

    return {
      overview: {
        totalDistance: directions.totalDistance,
        totalDuration: directions.totalDuration,
        text: `${directions.totalDistance.toFixed(1)} mi, ${directions.totalDuration} mins`
      },
      legs: stores.map((store, i) => ({
        storeIndex: i,
        storeName: store.name,
        storeAddress: store.address,
        directions: this.formatLegDirections(directions.steps, i)
      })),
      fullRoute: directions
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Resolve store locations (geocode if needed)
   */
  async resolveStoreLocations(stores) {
    const locations = [];

    for (const store of stores) {
      if (store.latitude && store.longitude) {
        locations.push({ lat: store.latitude, lng: store.longitude });
      } else if (store.location) {
        locations.push(store.location);
      } else if (store.address) {
        const geocoded = await this.mapsService.geocodeAddress(store.address);
        locations.push({ lat: geocoded.lat, lng: geocoded.lng });
      } else {
        // Fallback to simulated location
        locations.push(this.mapsService.simulateGeocode(store.name || 'Store'));
      }
    }

    return locations;
  }

  /**
   * Build detailed route with segments
   */
  async buildDetailedRoute(startLocation, orderedStores, options) {
    const segments = [];
    let currentLocation = startLocation;
    let totalDistance = 0;
    let drivingTime = 0;
    let shoppingTime = 0;

    for (let i = 0; i < orderedStores.length; i++) {
      const store = orderedStores[i];
      const storeLocation = store.location ||
        { lat: store.latitude, lng: store.longitude } ||
        await this.mapsService.geocodeAddress(store.address);

      // Get distance to this store
      const distance = await this.mapsService.getDistance(
        currentLocation,
        storeLocation,
        { includeTraffic: options.includeTraffic }
      );

      const distanceMiles = distance.distance.value / 1609.34;
      const durationMinutes = distance.duration.value / 60;

      segments.push({
        from: i === 0 ? 'Start' : orderedStores[i - 1].name,
        to: store.name,
        distanceMiles,
        durationMinutes: Math.round(durationMinutes),
        storeVisitDuration: store.avgVisitDuration || 20
      });

      totalDistance += distanceMiles;
      drivingTime += durationMinutes;
      shoppingTime += store.avgVisitDuration || 20;

      currentLocation = storeLocation;
    }

    // Add return segment if requested
    if (options.returnToStart) {
      const returnDistance = await this.mapsService.getDistance(
        currentLocation,
        startLocation
      );
      segments.push({
        from: orderedStores[orderedStores.length - 1].name,
        to: 'Start',
        distanceMiles: returnDistance.distance.value / 1609.34,
        durationMinutes: Math.round(returnDistance.duration.value / 60),
        storeVisitDuration: 0
      });
      totalDistance += returnDistance.distance.value / 1609.34;
      drivingTime += returnDistance.duration.value / 60;
    }

    return {
      totalDistance: parseFloat(totalDistance.toFixed(1)),
      totalDuration: Math.round(drivingTime + shoppingTime),
      drivingTime: Math.round(drivingTime),
      shoppingTime,
      segments
    };
  }

  /**
   * Create consolidated route with fewer stops
   */
  async createConsolidatedRoute(stores, startLocation) {
    // Group nearby stores
    const consolidated = this.groupNearbyStores(stores);

    // Select best store from each group
    const selectedStores = consolidated.map(group =>
      group.reduce((best, store) =>
        (store.rating || 3) > (best.rating || 3) ? store : best
      )
    );

    return this.calculateOptimalRoute(selectedStores, startLocation);
  }

  /**
   * Group nearby stores (within 2 miles)
   */
  groupNearbyStores(stores) {
    const groups = [];
    const assigned = new Set();

    stores.forEach((store, i) => {
      if (assigned.has(i)) return;

      const group = [store];
      assigned.add(i);

      stores.forEach((other, j) => {
        if (i !== j && !assigned.has(j)) {
          const distance = this.mapsService.haversineDistance(
            store.latitude || 30, store.longitude || -95,
            other.latitude || 30, other.longitude || -95
          );
          if (distance < 2) {
            group.push(other);
            assigned.add(j);
          }
        }
      });

      groups.push(group);
    });

    return groups;
  }

  /**
   * Compare multiple routes
   */
  compareRoutes(routes) {
    if (!routes.length) return null;

    const distances = routes.map(r => r.totalDistance?.miles || 0);
    const times = routes.map(r => r.totalTime?.minutes || 0);

    return {
      shortestDistance: {
        type: routes[distances.indexOf(Math.min(...distances))].type,
        value: Math.min(...distances)
      },
      fastestTime: {
        type: routes[times.indexOf(Math.min(...times))].type,
        value: Math.min(...times)
      },
      fewestStops: {
        type: routes.reduce((min, r) =>
          (r.stores?.length || 0) < (min.stores?.length || Infinity) ? r : min
        ).type
      }
    };
  }

  /**
   * Select best route based on criteria
   */
  selectBestRoute(routes, comparison) {
    if (!routes.length) return null;

    // Default to optimal route
    const optimal = routes.find(r => r.type === 'optimal');
    if (optimal) {
      return {
        recommended: 'optimal',
        reason: 'Best balance of distance and convenience'
      };
    }

    return {
      recommended: routes[0].type,
      reason: 'First available option'
    };
  }

  /**
   * Calculate arrival time at a stop
   */
  calculateArrivalTime(departureTime, minutesFromStart) {
    const arrival = new Date(departureTime);
    arrival.setMinutes(arrival.getMinutes() + minutesFromStart);
    return arrival.toISOString();
  }

  /**
   * Format duration for display
   */
  formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes} mins`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  /**
   * Format leg directions
   */
  formatLegDirections(steps, legIndex) {
    // In a real implementation, this would parse Google directions
    return {
      summary: `Drive to store ${legIndex + 1}`,
      steps: steps ? steps.filter(s => s.startIndex === legIndex) : []
    };
  }

  /**
   * Return empty route structure
   */
  emptyRoute() {
    return {
      id: uuidv4(),
      visitOrder: [],
      stores: [],
      totalDistance: { miles: 0, text: '0 mi' },
      totalTime: { minutes: 0, text: '0 mins', breakdown: { driving: 0, shopping: 0 } },
      segments: [],
      createdAt: new Date().toISOString()
    };
  }
}

module.exports = { RouteOptimizer };
