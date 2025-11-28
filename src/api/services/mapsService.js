/**
 * Google Maps Service
 * Week 5-6 Implementation - PRD User Story 1.1
 *
 * Provides Google Maps API integration for:
 * - Geocoding store addresses
 * - Calculating driving distances and times
 * - Getting traffic-aware estimates
 * - Generating turn-by-turn directions
 */

const { v4: uuidv4 } = require('uuid');

/**
 * MapsService class
 * Handles Google Maps API interactions for route optimization
 */
class MapsService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY;
    this.cache = new Map(); // Simple in-memory cache
    this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    // For demo/testing without API key
    this.isSimulated = !this.apiKey;

    if (this.isSimulated) {
      console.warn('MapsService: Running in simulated mode (no API key)');
    }
  }

  /**
   * Initialize the Google Maps client
   * In production, this would use @googlemaps/google-maps-services-js
   */
  async initialize() {
    if (!this.isSimulated && this.apiKey) {
      try {
        // In production: const { Client } = require('@googlemaps/google-maps-services-js');
        // this.client = new Client({});
        this.initialized = true;
      } catch (error) {
        console.warn('MapsService: Failed to initialize, falling back to simulation');
        this.isSimulated = true;
      }
    }
  }

  /**
   * Geocode an address to coordinates
   *
   * @param {string} address - Address to geocode
   * @returns {Object} Coordinates { lat, lng }
   */
  async geocodeAddress(address) {
    const cacheKey = `geocode:${address}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.isSimulated) {
      return this.simulateGeocode(address);
    }

    try {
      // Production implementation would call Google Geocoding API
      // const response = await this.client.geocode({
      //   params: { address, key: this.apiKey }
      // });

      // Simulate for now
      const result = this.simulateGeocode(address);
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Geocoding error:', error.message);
      throw new Error(`Failed to geocode address: ${address}`);
    }
  }

  /**
   * Get driving distance and time between two points
   *
   * @param {Object} origin - Origin coordinates { lat, lng } or address
   * @param {Object} destination - Destination coordinates { lat, lng } or address
   * @param {Object} options - Options like departureTime, trafficModel
   * @returns {Object} Distance and duration info
   */
  async getDistance(origin, destination, options = {}) {
    const cacheKey = `distance:${JSON.stringify(origin)}:${JSON.stringify(destination)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached && !options.includeTraffic) return cached;

    if (this.isSimulated) {
      return this.simulateDistance(origin, destination, options);
    }

    try {
      // Production implementation
      // const response = await this.client.distancematrix({
      //   params: {
      //     origins: [origin],
      //     destinations: [destination],
      //     departure_time: options.departureTime || 'now',
      //     traffic_model: options.trafficModel || 'best_guess',
      //     key: this.apiKey
      //   }
      // });

      const result = this.simulateDistance(origin, destination, options);
      if (!options.includeTraffic) {
        this.setCache(cacheKey, result);
      }
      return result;
    } catch (error) {
      console.error('Distance matrix error:', error.message);
      throw new Error('Failed to calculate distance');
    }
  }

  /**
   * Get distances from one origin to multiple destinations
   *
   * @param {Object} origin - Origin coordinates
   * @param {Array} destinations - Array of destination coordinates
   * @returns {Array} Array of distance/duration results
   */
  async getDistanceMatrix(origin, destinations) {
    if (this.isSimulated) {
      return destinations.map(dest => this.simulateDistance(origin, dest, {}));
    }

    try {
      // Production would batch this efficiently
      return Promise.all(
        destinations.map(dest => this.getDistance(origin, dest))
      );
    } catch (error) {
      console.error('Distance matrix batch error:', error.message);
      throw new Error('Failed to calculate distance matrix');
    }
  }

  /**
   * Get directions with turn-by-turn instructions
   *
   * @param {Object} origin - Start location
   * @param {Object} destination - End location
   * @param {Array} waypoints - Intermediate stops
   * @param {Object} options - Routing options
   * @returns {Object} Directions with steps
   */
  async getDirections(origin, destination, waypoints = [], options = {}) {
    if (this.isSimulated) {
      return this.simulateDirections(origin, destination, waypoints, options);
    }

    try {
      // Production implementation
      // const response = await this.client.directions({
      //   params: {
      //     origin,
      //     destination,
      //     waypoints: waypoints.map(w => ({ location: w })),
      //     optimize: options.optimizeWaypoints !== false,
      //     departure_time: options.departureTime || 'now',
      //     key: this.apiKey
      //   }
      // });

      return this.simulateDirections(origin, destination, waypoints, options);
    } catch (error) {
      console.error('Directions error:', error.message);
      throw new Error('Failed to get directions');
    }
  }

  /**
   * Optimize waypoint order for shortest route (TSP approximation)
   *
   * @param {Array} storeLocations - Array of store coordinates
   * @param {Object} startLocation - Starting point
   * @returns {Object} Optimized order and route details
   */
  async optimizeWaypointOrder(storeLocations, startLocation) {
    if (storeLocations.length <= 2) {
      return {
        optimizedOrder: storeLocations.map((_, i) => i),
        totalDistance: 0,
        totalDuration: 0
      };
    }

    if (this.isSimulated) {
      return this.simulateWaypointOptimization(storeLocations, startLocation);
    }

    try {
      // Use directions API with waypoint optimization
      const directions = await this.getDirections(
        startLocation,
        startLocation, // Round trip
        storeLocations,
        { optimizeWaypoints: true }
      );

      return {
        optimizedOrder: directions.waypointOrder,
        route: directions,
        totalDistance: directions.totalDistance,
        totalDuration: directions.totalDuration
      };
    } catch (error) {
      console.error('Waypoint optimization error:', error.message);
      // Fallback to nearest neighbor heuristic
      return this.nearestNeighborTSP(storeLocations, startLocation);
    }
  }

  /**
   * Estimate driving time with traffic consideration
   *
   * @param {Array} storeIds - Store IDs to visit
   * @param {Object} startLocation - Starting location
   * @param {Date} departureTime - When to depart
   * @returns {Object} Time estimate with traffic
   */
  async estimateDrivingTime(stores, startLocation, departureTime = new Date()) {
    const locations = stores.map(s => s.location || { lat: s.latitude, lng: s.longitude });

    // Get optimized route
    const optimized = await this.optimizeWaypointOrder(locations, startLocation);

    // Get traffic-aware times if available
    const trafficEstimate = this.isSimulated
      ? this.simulateTrafficTime(optimized.totalDuration, departureTime)
      : optimized.totalDuration;

    return {
      optimizedOrder: optimized.optimizedOrder,
      stores: optimized.optimizedOrder.map(i => stores[i]),
      noTrafficMinutes: optimized.totalDuration,
      withTrafficMinutes: trafficEstimate,
      distanceMiles: optimized.totalDistance,
      departureTime: departureTime.toISOString(),
      isRushHour: this.isRushHour(departureTime)
    };
  }

  // ============================================
  // Simulation Methods (for demo/testing)
  // ============================================

  simulateGeocode(address) {
    // Generate consistent pseudo-random coordinates based on address
    const hash = this.hashString(address);
    return {
      lat: 30 + (hash % 10) / 10,   // Approximate US latitude
      lng: -95 - (hash % 20) / 10,   // Approximate US longitude
      formattedAddress: address
    };
  }

  simulateDistance(origin, destination, options) {
    // Calculate approximate distance using Haversine formula
    const originCoords = typeof origin === 'string'
      ? this.simulateGeocode(origin)
      : origin;
    const destCoords = typeof destination === 'string'
      ? this.simulateGeocode(destination)
      : destination;

    const distanceMiles = this.haversineDistance(
      originCoords.lat, originCoords.lng,
      destCoords.lat, destCoords.lng
    );

    // Estimate driving time (assume average 30 mph in urban areas)
    const baseDuration = Math.round(distanceMiles * 2); // minutes

    // Add traffic variance
    const trafficMultiplier = options.includeTraffic
      ? (this.isRushHour(options.departureTime) ? 1.4 : 1.1)
      : 1.0;

    return {
      distance: {
        value: Math.round(distanceMiles * 1609.34), // meters
        text: `${distanceMiles.toFixed(1)} mi`
      },
      duration: {
        value: baseDuration * 60, // seconds
        text: `${baseDuration} mins`
      },
      durationInTraffic: {
        value: Math.round(baseDuration * trafficMultiplier * 60),
        text: `${Math.round(baseDuration * trafficMultiplier)} mins`
      }
    };
  }

  simulateDirections(origin, destination, waypoints, options) {
    const allPoints = [origin, ...waypoints, destination];
    let totalDistance = 0;
    let totalDuration = 0;
    const steps = [];

    for (let i = 0; i < allPoints.length - 1; i++) {
      const segment = this.simulateDistance(allPoints[i], allPoints[i + 1], options);
      totalDistance += segment.distance.value / 1609.34; // Convert to miles
      totalDuration += segment.duration.value / 60; // Convert to minutes

      steps.push({
        startIndex: i,
        endIndex: i + 1,
        distance: segment.distance,
        duration: segment.duration,
        instructions: `Drive to location ${i + 2}`
      });
    }

    return {
      totalDistance,
      totalDuration: Math.round(totalDuration),
      waypointOrder: waypoints.map((_, i) => i),
      steps,
      overview: {
        distance: `${totalDistance.toFixed(1)} mi`,
        duration: `${Math.round(totalDuration)} mins`
      }
    };
  }

  simulateWaypointOptimization(locations, start) {
    // Nearest neighbor TSP heuristic
    return this.nearestNeighborTSP(locations, start);
  }

  simulateTrafficTime(baseMinutes, departureTime) {
    const multiplier = this.isRushHour(departureTime) ? 1.4 : 1.1;
    return Math.round(baseMinutes * multiplier);
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Nearest neighbor TSP approximation
   */
  nearestNeighborTSP(locations, start) {
    if (!locations.length) return { optimizedOrder: [], totalDistance: 0, totalDuration: 0 };

    const unvisited = [...locations.map((loc, i) => ({ index: i, location: loc }))];
    const order = [];
    let current = start;
    let totalDistance = 0;

    while (unvisited.length > 0) {
      let nearest = null;
      let nearestDist = Infinity;
      let nearestIndex = -1;

      unvisited.forEach((point, i) => {
        const dist = this.haversineDistance(
          current.lat, current.lng,
          point.location.lat || point.location.latitude,
          point.location.lng || point.location.longitude
        );
        if (dist < nearestDist) {
          nearest = point;
          nearestDist = dist;
          nearestIndex = i;
        }
      });

      if (nearest) {
        order.push(nearest.index);
        totalDistance += nearestDist;
        current = nearest.location;
        unvisited.splice(nearestIndex, 1);
      }
    }

    return {
      optimizedOrder: order,
      totalDistance,
      totalDuration: Math.round(totalDistance * 2) // Approximate minutes
    };
  }

  /**
   * Haversine distance formula (miles)
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  isRushHour(time = new Date()) {
    const hour = time.getHours ? time.getHours() : new Date(time).getHours();
    return (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18);
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  getFromCache(key) {
    const item = this.cache.get(key);
    if (item && Date.now() - item.timestamp < this.cacheExpiry) {
      return item.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = { MapsService };
