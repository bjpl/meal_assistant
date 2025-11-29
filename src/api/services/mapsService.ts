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

import { v4 as uuidv4 } from 'uuid';

interface Coordinates {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

interface DistanceResult {
  distance: {
    value: number;
    text: string;
  };
  duration: {
    value: number;
    text: string;
  };
  durationInTraffic?: {
    value: number;
    text: string;
  };
}

interface DirectionsResult {
  totalDistance: number;
  totalDuration: number;
  waypointOrder: number[];
  steps: DirectionStep[];
  overview: {
    distance: string;
    duration: string;
  };
}

interface DirectionStep {
  startIndex: number;
  endIndex: number;
  distance: {
    value: number;
    text: string;
  };
  duration: {
    value: number;
    text: string;
  };
  instructions: string;
}

interface OptimizedRoute {
  optimizedOrder: number[];
  totalDistance: number;
  totalDuration: number;
  route?: DirectionsResult;
}

interface Store {
  location?: Coordinates;
  latitude?: number;
  longitude?: number;
  address?: string;
}

interface TimeEstimate {
  optimizedOrder: number[];
  stores: Store[];
  noTrafficMinutes: number;
  withTrafficMinutes: number;
  distanceMiles: number;
  departureTime: string;
  isRushHour: boolean;
}

export class MapsService {
  private apiKey: string | null;
  private cache: Map<string, { data: any; timestamp: number }>;
  private cacheExpiry: number;
  private isSimulated: boolean;
  private initialized: boolean;

  constructor(apiKey: string | null = null) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || null;
    this.cache = new Map();
    this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.isSimulated = !this.apiKey;
    this.initialized = false;

    if (this.isSimulated) {
      console.warn('MapsService: Running in simulated mode (no API key)');
    }
  }

  /**
   * Initialize the Google Maps client
   */
  async initialize(): Promise<void> {
    if (!this.isSimulated && this.apiKey) {
      try {
        this.initialized = true;
      } catch (error) {
        console.warn('MapsService: Failed to initialize, falling back to simulation');
        this.isSimulated = true;
      }
    }
  }

  /**
   * Geocode an address to coordinates
   */
  async geocodeAddress(address: string): Promise<Coordinates> {
    const cacheKey = `geocode:${address}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.isSimulated) {
      return this.simulateGeocode(address);
    }

    try {
      const result = this.simulateGeocode(address);
      this.setCache(cacheKey, result);
      return result;
    } catch (error: any) {
      console.error('Geocoding error:', error.message);
      throw new Error(`Failed to geocode address: ${address}`);
    }
  }

  /**
   * Get driving distance and time between two points
   */
  async getDistance(
    origin: Coordinates | string,
    destination: Coordinates | string,
    options: { includeTraffic?: boolean; departureTime?: Date | string } = {}
  ): Promise<DistanceResult> {
    const cacheKey = `distance:${JSON.stringify(origin)}:${JSON.stringify(destination)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached && !options.includeTraffic) return cached;

    if (this.isSimulated) {
      return this.simulateDistance(origin, destination, options);
    }

    try {
      const result = this.simulateDistance(origin, destination, options);
      if (!options.includeTraffic) {
        this.setCache(cacheKey, result);
      }
      return result;
    } catch (error: any) {
      console.error('Distance matrix error:', error.message);
      throw new Error('Failed to calculate distance');
    }
  }

  /**
   * Get distances from one origin to multiple destinations
   */
  async getDistanceMatrix(origin: Coordinates, destinations: Coordinates[]): Promise<DistanceResult[]> {
    if (this.isSimulated) {
      return destinations.map(dest => this.simulateDistance(origin, dest, {}));
    }

    try {
      return Promise.all(
        destinations.map(dest => this.getDistance(origin, dest))
      );
    } catch (error: any) {
      console.error('Distance matrix batch error:', error.message);
      throw new Error('Failed to calculate distance matrix');
    }
  }

  /**
   * Get directions with turn-by-turn instructions
   */
  async getDirections(
    origin: Coordinates | string,
    destination: Coordinates | string,
    waypoints: Coordinates[] = [],
    options: { optimizeWaypoints?: boolean; departureTime?: Date | string } = {}
  ): Promise<DirectionsResult> {
    if (this.isSimulated) {
      return this.simulateDirections(origin, destination, waypoints, options);
    }

    try {
      return this.simulateDirections(origin, destination, waypoints, options);
    } catch (error: any) {
      console.error('Directions error:', error.message);
      throw new Error('Failed to get directions');
    }
  }

  /**
   * Optimize waypoint order for shortest route
   */
  async optimizeWaypointOrder(storeLocations: Coordinates[], startLocation: Coordinates): Promise<OptimizedRoute> {
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
      const directions = await this.getDirections(
        startLocation,
        startLocation,
        storeLocations,
        { optimizeWaypoints: true }
      );

      return {
        optimizedOrder: directions.waypointOrder,
        route: directions,
        totalDistance: directions.totalDistance,
        totalDuration: directions.totalDuration
      };
    } catch (error: any) {
      console.error('Waypoint optimization error:', error.message);
      return this.nearestNeighborTSP(storeLocations, startLocation);
    }
  }

  /**
   * Estimate driving time with traffic consideration
   */
  async estimateDrivingTime(
    stores: Store[],
    startLocation: Coordinates,
    departureTime: Date = new Date()
  ): Promise<TimeEstimate> {
    const locations = stores.map(s =>
      s.location || { lat: s.latitude || 30, lng: s.longitude || -95 }
    );

    const optimized = await this.optimizeWaypointOrder(locations, startLocation);

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

  // Simulation Methods

  simulateGeocode(address: string): Coordinates {
    const hash = this.hashString(address);
    return {
      lat: 30 + (hash % 10) / 10,
      lng: -95 - (hash % 20) / 10,
      formattedAddress: address
    };
  }

  simulateDistance(
    origin: Coordinates | string,
    destination: Coordinates | string,
    options: { includeTraffic?: boolean; departureTime?: Date | string }
  ): DistanceResult {
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

    const baseDuration = Math.round(distanceMiles * 2);

    const trafficMultiplier = options.includeTraffic
      ? (this.isRushHour(options.departureTime) ? 1.4 : 1.1)
      : 1.0;

    return {
      distance: {
        value: Math.round(distanceMiles * 1609.34),
        text: `${distanceMiles.toFixed(1)} mi`
      },
      duration: {
        value: baseDuration * 60,
        text: `${baseDuration} mins`
      },
      durationInTraffic: {
        value: Math.round(baseDuration * trafficMultiplier * 60),
        text: `${Math.round(baseDuration * trafficMultiplier)} mins`
      }
    };
  }

  simulateDirections(
    origin: Coordinates | string,
    destination: Coordinates | string,
    waypoints: Coordinates[],
    options: any
  ): DirectionsResult {
    const allPoints = [origin, ...waypoints, destination];
    let totalDistance = 0;
    let totalDuration = 0;
    const steps: DirectionStep[] = [];

    for (let i = 0; i < allPoints.length - 1; i++) {
      const segment = this.simulateDistance(allPoints[i], allPoints[i + 1], options);
      totalDistance += segment.distance.value / 1609.34;
      totalDuration += segment.duration.value / 60;

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

  simulateWaypointOptimization(locations: Coordinates[], start: Coordinates): OptimizedRoute {
    return this.nearestNeighborTSP(locations, start);
  }

  simulateTrafficTime(baseMinutes: number, departureTime: Date | string): number {
    const multiplier = this.isRushHour(departureTime) ? 1.4 : 1.1;
    return Math.round(baseMinutes * multiplier);
  }

  // Helper Methods

  nearestNeighborTSP(locations: Coordinates[], start: Coordinates): OptimizedRoute {
    if (!locations.length) return { optimizedOrder: [], totalDistance: 0, totalDuration: 0 };

    const unvisited = [...locations.map((loc, i) => ({ index: i, location: loc }))];
    const order: number[] = [];
    let current = start;
    let totalDistance = 0;

    while (unvisited.length > 0) {
      let nearest: any = null;
      let nearestDist = Infinity;
      let nearestIndex = -1;

      unvisited.forEach((point, i) => {
        const dist = this.haversineDistance(
          current.lat, current.lng,
          point.location.lat, point.location.lng
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
      totalDuration: Math.round(totalDistance * 2)
    };
  }

  haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

  toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  isRushHour(time: Date | string = new Date()): boolean {
    const date = typeof time === 'string' ? new Date(time) : time;
    const hour = date.getHours();
    return (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18);
  }

  hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  getFromCache(key: string): any {
    const item = this.cache.get(key);
    if (item && Date.now() - item.timestamp < this.cacheExpiry) {
      return item.data;
    }
    return null;
  }

  setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
  }
}
