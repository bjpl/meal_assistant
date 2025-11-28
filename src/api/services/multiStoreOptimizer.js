/**
 * Multi-Store Optimizer Service
 * Week 5-6 Implementation - PRD User Story 1.1
 *
 * Provides weighted multi-store distribution and optimization algorithms
 * to help users save $20-40/week through intelligent store routing.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Weight preset configurations for quick selection
 */
const WEIGHT_PRESETS = {
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
};

/**
 * Default store visit duration estimates (minutes)
 */
const DEFAULT_STORE_DURATIONS = {
  default: 20,
  warehouse: 45,    // Costco, Sam's Club
  discount: 25,     // Aldi, Lidl
  organic: 20,      // Whole Foods, Sprouts
  specialty: 15,    // Trader Joe's
  grocery: 25       // Kroger, Safeway, Publix
};

/**
 * MultiStoreOptimizer class
 * Handles weighted optimization of shopping lists across multiple stores
 */
class MultiStoreOptimizer {
  constructor(options = {}) {
    this.defaultWeights = WEIGHT_PRESETS.balanced;
    this.minItemsForMultiStore = options.minItemsForMultiStore || 5;
    this.maxStoresPerTrip = options.maxStoresPerTrip || 4;
  }

  /**
   * Optimize a shopping list by weights
   * Assigns each item to the store with the highest composite score
   *
   * @param {string} shoppingListId - Shopping list ID
   * @param {Array} items - Shopping list items
   * @param {Array} stores - Available stores with pricing data
   * @param {Object} weights - Optimization weights
   * @param {Object} options - Additional options (userLocation, storeRatings, etc.)
   * @returns {Object} Optimized distribution with assignments and savings
   */
  async optimizeByWeights(shoppingListId, items, stores, weights, options = {}) {
    const normalizedWeights = this.normalizeWeights(weights);
    const assignments = [];
    const storeGroups = {};

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

      // Find best store (highest score)
      const bestStore = storeScores.reduce((best, current) =>
        current.compositeScore > best.compositeScore ? current : best
      );

      // Create assignment
      const assignment = {
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

      // Add to store group
      if (storeGroups[bestStore.storeId]) {
        storeGroups[bestStore.storeId].items.push(assignment);
        storeGroups[bestStore.storeId].totalCost += bestStore.price || 0;
        storeGroups[bestStore.storeId].totalSavings += assignment.savings;
      }
    }

    // Calculate totals
    const usedStores = Object.values(storeGroups).filter(g => g.items.length > 0);
    const totalCost = usedStores.reduce((sum, g) => sum + g.totalCost, 0);
    const totalSavings = usedStores.reduce((sum, g) => sum + g.totalSavings, 0);

    return {
      shoppingListId,
      weights: normalizedWeights,
      assignments,
      storeDistribution: usedStores.map(g => ({
        storeId: g.store.id,
        storeName: g.store.name,
        itemCount: g.items.length,
        items: g.items.map(i => ({ id: i.itemId, name: i.itemName, price: i.priceAtStore })),
        totalCost: g.totalCost,
        savings: g.totalSavings
      })),
      summary: {
        totalItems: items.length,
        totalStores: usedStores.length,
        totalEstimatedCost: totalCost,
        totalEstimatedSavings: totalSavings,
        savingsPercentage: totalCost > 0 ? ((totalSavings / (totalCost + totalSavings)) * 100).toFixed(1) : 0
      },
      optimizedAt: new Date().toISOString()
    };
  }

  /**
   * Get store scores for a specific item
   * Returns score breakdown for each store
   *
   * @param {string} itemId - Item ID
   * @param {Object} item - Item details
   * @param {Array} stores - Available stores
   * @param {Object} weights - Optimization weights
   * @param {Object} options - Additional options
   * @returns {Array} Score breakdown for each store
   */
  async getStoreScores(item, stores, weights, options = {}) {
    const normalizedWeights = this.normalizeWeights(weights);
    const prices = this.getItemPrices(item, stores);
    const distances = options.distances || {};
    const storeRatings = options.storeRatings || {};

    // Get price range for normalization
    const priceValues = Object.values(prices).filter(p => p !== null && p !== undefined);
    const maxPrice = Math.max(...priceValues, 0.01);
    const minPrice = Math.min(...priceValues, 0.01);
    const priceRange = maxPrice - minPrice || 1;

    // Get distance range for normalization
    const distanceValues = Object.values(distances).filter(d => d !== null && d !== undefined);
    const maxDistance = Math.max(...distanceValues, 10);
    const minDistance = Math.min(...distanceValues, 0);
    const distanceRange = maxDistance - minDistance || 1;

    return stores.map(store => {
      const price = prices[store.id] || item.estimatedPrice || 5.00;
      const distance = distances[store.id] || 5;
      const quality = storeRatings[store.id]?.quality || 3;
      const visitDuration = storeRatings[store.id]?.avgVisitDuration ||
        DEFAULT_STORE_DURATIONS[store.storeType] ||
        DEFAULT_STORE_DURATIONS.default;

      // Calculate normalized scores (0-1 scale, higher is better)
      // Price score: lower price = higher score
      const priceScore = priceRange > 0
        ? (maxPrice - price) / priceRange
        : 0.5;

      // Distance score: shorter distance = higher score
      const distanceScore = distanceRange > 0
        ? (maxDistance - distance) / distanceRange
        : 0.5;

      // Quality score: normalize from 1-5 to 0-1
      const qualityScore = (quality - 1) / 4;

      // Time score: shorter visit time = higher score (assume max 60 min)
      const timeScore = Math.max(0, (60 - visitDuration) / 60);

      // Calculate composite score
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
   * Reassign an item from one store to another
   * Returns updated totals after reassignment
   *
   * @param {Object} currentAssignment - Current assignment object
   * @param {string} fromStoreId - Current store ID
   * @param {string} toStoreId - Target store ID
   * @param {Array} stores - Available stores
   * @param {string} reason - Reason for override
   * @returns {Object} Updated assignment
   */
  async reassignItem(currentAssignment, fromStoreId, toStoreId, stores, reason = '') {
    const toStore = stores.find(s => s.id === toStoreId);
    if (!toStore) {
      throw new Error(`Store ${toStoreId} not found`);
    }

    // Get price at new store (use item's estimated price as fallback)
    const newPrice = this.getPriceAtStore(currentAssignment, toStore) ||
      currentAssignment.priceAtStore;

    return {
      ...currentAssignment,
      storeId: toStoreId,
      storeName: toStore.name,
      priceAtStore: newPrice,
      isManualOverride: true,
      overrideReason: reason,
      previousStore: {
        storeId: fromStoreId,
        price: currentAssignment.priceAtStore
      },
      reassignedAt: new Date().toISOString()
    };
  }

  /**
   * Estimate potential savings for a shopping list
   * Compares single-store vs multi-store approach
   *
   * @param {Array} items - Shopping list items
   * @param {Array} stores - Available stores
   * @param {Object} weights - Optimization weights
   * @returns {Object} Savings estimate
   */
  async estimateSavings(items, stores, weights = this.defaultWeights) {
    // Calculate single-store costs (cheapest single store)
    const singleStoreCosts = stores.map(store => {
      const cost = items.reduce((sum, item) => {
        const price = this.getPriceAtStore(item, store) || item.estimatedPrice || 5.00;
        return sum + price;
      }, 0);
      return { store, cost };
    });

    const cheapestSingleStore = singleStoreCosts.reduce((min, current) =>
      current.cost < min.cost ? current : min
    );

    // Calculate multi-store optimized cost
    const optimized = await this.optimizeByWeights(
      'estimate',
      items,
      stores,
      weights
    );

    const multiStoreCost = optimized.summary.totalEstimatedCost;
    const savings = cheapestSingleStore.cost - multiStoreCost;
    const savingsPercentage = (savings / cheapestSingleStore.cost) * 100;

    // Project weekly/monthly savings
    const weeklySavings = savings; // Assuming this is for weekly shopping
    const monthlySavings = weeklySavings * 4.33;

    return {
      singleStoreOption: {
        storeName: cheapestSingleStore.store.name,
        totalCost: cheapestSingleStore.cost.toFixed(2)
      },
      multiStoreOption: {
        storeCount: optimized.summary.totalStores,
        totalCost: multiStoreCost.toFixed(2),
        storeBreakdown: optimized.storeDistribution.map(d => ({
          store: d.storeName,
          items: d.itemCount,
          cost: d.totalCost.toFixed(2)
        }))
      },
      savings: {
        amount: savings.toFixed(2),
        percentage: savingsPercentage.toFixed(1),
        weeklyProjection: weeklySavings.toFixed(2),
        monthlyProjection: monthlySavings.toFixed(2),
        yearlyProjection: (monthlySavings * 12).toFixed(2)
      },
      recommendation: this.generateSavingsRecommendation(savings, savingsPercentage, optimized.summary.totalStores)
    };
  }

  /**
   * Normalize weights to ensure they sum to 1.0
   */
  normalizeWeights(weights) {
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
   * Get item prices across stores (simulated - would connect to price service)
   */
  getItemPrices(item, stores) {
    const prices = {};
    const basePrice = item.estimatedPrice || 5.00;

    // Simulate price variations across stores
    stores.forEach(store => {
      let modifier = 1.0;

      // Apply store type modifiers
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
   * Get price at specific store
   */
  getPriceAtStore(item, store) {
    const prices = this.getItemPrices(item, [store]);
    return prices[store.id];
  }

  /**
   * Calculate savings for an item compared to max price
   */
  calculateItemSavings(item, storeScores) {
    if (!storeScores.length) return 0;

    const prices = storeScores.map(s => s.price);
    const maxPrice = Math.max(...prices);
    const bestPrice = Math.min(...prices);

    return parseFloat((maxPrice - bestPrice).toFixed(2));
  }

  /**
   * Generate human-readable score explanation
   */
  generateScoreExplanation(storeName, metrics, scores, compositeScore, weights) {
    const factors = [];

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
   * Generate savings recommendation
   */
  generateSavingsRecommendation(savings, percentage, storeCount) {
    if (savings < 2) {
      return 'Single store shopping is recommended - multi-store savings are minimal.';
    }
    if (percentage < 5) {
      return `Minor savings available ($${savings.toFixed(2)}). Consider if ${storeCount} stores fits your schedule.`;
    }
    if (percentage < 15) {
      return `Good savings potential ($${savings.toFixed(2)}). Multi-store shopping recommended for ${storeCount} strategically chosen stores.`;
    }
    return `Excellent savings opportunity ($${savings.toFixed(2)}, ${percentage.toFixed(0)}% off)! Strongly recommend visiting ${storeCount} stores.`;
  }

  /**
   * Get available weight presets
   */
  getPresets() {
    return WEIGHT_PRESETS;
  }
}

module.exports = {
  MultiStoreOptimizer,
  WEIGHT_PRESETS,
  DEFAULT_STORE_DURATIONS
};
