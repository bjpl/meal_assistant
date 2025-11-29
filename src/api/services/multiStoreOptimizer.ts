/**
 * Multi-Store Optimizer Service
 * Week 5-6 Implementation - PRD User Story 1.1
 *
 * Provides weighted multi-store distribution and optimization algorithms
 * to help users save $20-40/week through intelligent store routing.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Weight preset configurations for quick selection
 */
export const WEIGHT_PRESETS = {
  balanced: {
    price: 0.40,
    distance: 0.30,
    quality: 0.20,
    time: 0.10,
    description: 'Balanced optimization across all factors'
  },
  cost_focused: {
    price: 0.70,
    distance: 0.15,
    quality: 0.10,
    time: 0.05,
    description: 'Maximize savings, willing to travel further'
  },
  time_focused: {
    price: 0.20,
    distance: 0.10,
    quality: 0.20,
    time: 0.50,
    description: 'Minimize shopping time and travel'
  },
  quality_focused: {
    price: 0.15,
    distance: 0.20,
    quality: 0.55,
    time: 0.10,
    description: 'Prioritize product quality and store experience'
  }
} as const;

/**
 * Default store visit duration estimates (minutes)
 */
export const DEFAULT_STORE_DURATIONS: Record<string, number> = {
  default: 20,
  warehouse: 45,
  discount: 25,
  organic: 20,
  specialty: 15,
  grocery: 25
};

interface Weights {
  price: number;
  distance: number;
  quality: number;
  time: number;
}

interface Store {
  id: string;
  name: string;
  storeType?: string;
}

interface ShoppingItem {
  id: string;
  name: string;
  estimatedPrice?: number;
}

interface StoreScore {
  storeId: string;
  storeName: string;
  price: number;
  distance: number;
  quality: number;
  visitDuration: number;
  priceScore: number;
  distanceScore: number;
  qualityScore: number;
  timeScore: number;
  compositeScore: number;
  explanation: string;
}

interface ItemAssignment {
  id: string;
  itemId: string;
  itemName: string;
  storeId: string;
  storeName: string;
  priceAtStore: number;
  compositeScore: number;
  scoreBreakdown: {
    priceScore: number;
    distanceScore: number;
    qualityScore: number;
    timeScore: number;
  };
  alternatives: Array<{
    storeId: string;
    storeName: string;
    price: number;
    score: number;
  }>;
  savings: number;
}

interface OptimizationOptions {
  distances?: Record<string, number>;
  storeRatings?: Record<string, { quality?: number; avgVisitDuration?: number }>;
}

export class MultiStoreOptimizer {
  private defaultWeights: Weights;
  private minItemsForMultiStore: number;
  private maxStoresPerTrip: number;

  constructor(options: {
    minItemsForMultiStore?: number;
    maxStoresPerTrip?: number;
  } = {}) {
    this.defaultWeights = WEIGHT_PRESETS.balanced;
    this.minItemsForMultiStore = options.minItemsForMultiStore || 5;
    this.maxStoresPerTrip = options.maxStoresPerTrip || 4;
  }

  /**
   * Optimize a shopping list by weights
   */
  async optimizeByWeights(
    shoppingListId: string,
    items: ShoppingItem[],
    stores: Store[],
    weights: Partial<Weights>,
    options: OptimizationOptions = {}
  ): Promise<any> {
    const normalizedWeights = this.normalizeWeights(weights);
    const assignments: ItemAssignment[] = [];
    const storeGroups: Record<string, any> = {};

    // Initialize store groups
    stores.forEach(store => {
      storeGroups[store.id] = {
        store,
        items: [],
        totalCost: 0,
        totalSavings: 0
      };
    });

    // Process each item
    for (const item of items) {
      const storeScores = await this.getStoreScores(item, stores, normalizedWeights, options);

      // Find best store
      const bestStore = storeScores.reduce((best, current) =>
        current.compositeScore > best.compositeScore ? current : best
      );

      const assignment: ItemAssignment = {
        id: uuidv4(),
        itemId: item.id,
        itemName: item.name,
        storeId: bestStore.storeId,
        storeName: bestStore.storeName,
        priceAtStore: bestStore.price,
        compositeScore: bestStore.compositeScore,
        scoreBreakdown: {
          priceScore: bestStore.priceScore,
          distanceScore: bestStore.distanceScore,
          qualityScore: bestStore.qualityScore,
          timeScore: bestStore.timeScore
        },
        alternatives: storeScores
          .filter(s => s.storeId !== bestStore.storeId)
          .slice(0, 2)
          .map(s => ({
            storeId: s.storeId,
            storeName: s.storeName,
            price: s.price,
            score: s.compositeScore
          })),
        savings: this.calculateItemSavings(item, storeScores)
      };

      assignments.push(assignment);

      if (storeGroups[bestStore.storeId]) {
        storeGroups[bestStore.storeId].items.push(assignment);
        storeGroups[bestStore.storeId].totalCost += bestStore.price || 0;
        storeGroups[bestStore.storeId].totalSavings += assignment.savings;
      }
    }

    const usedStores = Object.values(storeGroups).filter((g: any) => g.items.length > 0);
    const totalCost = usedStores.reduce((sum, g: any) => sum + g.totalCost, 0);
    const totalSavings = usedStores.reduce((sum, g: any) => sum + g.totalSavings, 0);

    return {
      shoppingListId,
      weights: normalizedWeights,
      assignments,
      storeDistribution: usedStores.map((g: any) => ({
        storeId: g.store.id,
        storeName: g.store.name,
        itemCount: g.items.length,
        items: g.items.map((i: ItemAssignment) => ({
          id: i.itemId,
          name: i.itemName,
          price: i.priceAtStore
        })),
        totalCost: g.totalCost,
        savings: g.totalSavings
      })),
      summary: {
        totalItems: items.length,
        totalStores: usedStores.length,
        totalEstimatedCost: totalCost,
        totalEstimatedSavings: totalSavings,
        savingsPercentage: totalCost > 0 ?
          ((totalSavings / (totalCost + totalSavings)) * 100).toFixed(1) : 0
      },
      optimizedAt: new Date().toISOString()
    };
  }

  /**
   * Get store scores for a specific item
   */
  async getStoreScores(
    item: ShoppingItem,
    stores: Store[],
    weights: Weights,
    options: OptimizationOptions = {}
  ): Promise<StoreScore[]> {
    const normalizedWeights = this.normalizeWeights(weights);
    const prices = this.getItemPrices(item, stores);
    const distances = options.distances || {};
    const storeRatings = options.storeRatings || {};

    const priceValues = Object.values(prices).filter(p => p !== null && p !== undefined);
    const maxPrice = Math.max(...priceValues, 0.01);
    const minPrice = Math.min(...priceValues, 0.01);
    const priceRange = maxPrice - minPrice || 1;

    const distanceValues = Object.values(distances).filter(d => d !== null && d !== undefined);
    const maxDistance = Math.max(...distanceValues, 10);
    const minDistance = Math.min(...distanceValues, 0);
    const distanceRange = maxDistance - minDistance || 1;

    return stores.map(store => {
      const price = prices[store.id] || item.estimatedPrice || 5.00;
      const distance = distances[store.id] || 5;
      const quality = storeRatings[store.id]?.quality || 3;
      const visitDuration = storeRatings[store.id]?.avgVisitDuration ||
        DEFAULT_STORE_DURATIONS[store.storeType || 'default'] ||
        DEFAULT_STORE_DURATIONS.default;

      const priceScore = priceRange > 0 ? (maxPrice - price) / priceRange : 0.5;
      const distanceScore = distanceRange > 0 ? (maxDistance - distance) / distanceRange : 0.5;
      const qualityScore = (quality - 1) / 4;
      const timeScore = Math.max(0, (60 - visitDuration) / 60);

      const compositeScore =
        (priceScore * normalizedWeights.price) +
        (distanceScore * normalizedWeights.distance) +
        (qualityScore * normalizedWeights.quality) +
        (timeScore * normalizedWeights.time);

      return {
        storeId: store.id,
        storeName: store.name,
        price,
        distance,
        quality,
        visitDuration,
        priceScore: parseFloat(priceScore.toFixed(4)),
        distanceScore: parseFloat(distanceScore.toFixed(4)),
        qualityScore: parseFloat(qualityScore.toFixed(4)),
        timeScore: parseFloat(timeScore.toFixed(4)),
        compositeScore: parseFloat(compositeScore.toFixed(4)),
        explanation: this.generateScoreExplanation(
          store.name,
          { price, distance, quality, visitDuration },
          { priceScore, distanceScore, qualityScore, timeScore },
          compositeScore,
          normalizedWeights
        )
      };
    }).sort((a, b) => b.compositeScore - a.compositeScore);
  }

  /**
   * Normalize weights to ensure they sum to 1.0
   */
  normalizeWeights(weights: Partial<Weights>): Weights {
    const input = { ...this.defaultWeights, ...weights };
    const sum = input.price + input.distance + input.quality + input.time;

    if (Math.abs(sum - 1.0) < 0.01) {
      return input;
    }

    return {
      price: input.price / sum,
      distance: input.distance / sum,
      quality: input.quality / sum,
      time: input.time / sum
    };
  }

  /**
   * Get item prices across stores
   */
  getItemPrices(item: ShoppingItem, stores: Store[]): Record<string, number> {
    const prices: Record<string, number> = {};
    const basePrice = item.estimatedPrice || 5.00;

    stores.forEach(store => {
      let modifier = 1.0;

      switch (store.storeType) {
        case 'discount':
          modifier = 0.85 + (Math.random() * 0.1);
          break;
        case 'warehouse':
          modifier = 0.80 + (Math.random() * 0.15);
          break;
        case 'organic':
          modifier = 1.15 + (Math.random() * 0.2);
          break;
        case 'specialty':
          modifier = 1.05 + (Math.random() * 0.15);
          break;
        default:
          modifier = 0.95 + (Math.random() * 0.15);
      }

      prices[store.id] = parseFloat((basePrice * modifier).toFixed(2));
    });

    return prices;
  }

  /**
   * Calculate savings for an item compared to max price
   */
  calculateItemSavings(item: ShoppingItem, storeScores: StoreScore[]): number {
    if (!storeScores.length) return 0;

    const prices = storeScores.map(s => s.price);
    const maxPrice = Math.max(...prices);
    const bestPrice = Math.min(...prices);

    return parseFloat((maxPrice - bestPrice).toFixed(2));
  }

  /**
   * Generate human-readable score explanation
   */
  generateScoreExplanation(
    storeName: string,
    metrics: { price: number; distance: number; quality: number; visitDuration: number },
    scores: { priceScore: number; distanceScore: number; qualityScore: number; timeScore: number },
    compositeScore: number,
    weights: Weights
  ): string {
    const factors: string[] = [];

    if (weights.price >= 0.3 && scores.priceScore > 0.6) {
      factors.push(`competitive pricing ($${metrics.price.toFixed(2)})`);
    }
    if (weights.distance >= 0.2 && scores.distanceScore > 0.6) {
      factors.push(`convenient location (${metrics.distance.toFixed(1)} mi)`);
    }
    if (weights.quality >= 0.2 && scores.qualityScore > 0.6) {
      factors.push(`high quality rating (${metrics.quality}/5)`);
    }
    if (weights.time >= 0.1 && scores.timeScore > 0.6) {
      factors.push(`quick shopping experience (~${metrics.visitDuration} min)`);
    }

    const positives = factors.length > 0
      ? `Strengths: ${factors.join(', ')}`
      : 'Average across all factors';

    return `${storeName} scores ${(compositeScore * 100).toFixed(0)}/100. ${positives}`;
  }

  /**
   * Get available weight presets
   */
  getPresets(): typeof WEIGHT_PRESETS {
    return WEIGHT_PRESETS;
  }
}
