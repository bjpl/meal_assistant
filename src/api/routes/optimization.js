/**
 * Optimization Routes
 * Week 5-6 Implementation - PRD User Story 1.1
 *
 * Provides 10 API endpoints for multi-store optimization:
 * 1. POST /api/optimization/weights - Save weight profile
 * 2. GET /api/optimization/profiles - Get user's profiles
 * 3. POST /api/optimization/distribute - Optimize list by weights
 * 4. GET /api/optimization/scores/:itemId - Get store scores for item
 * 5. PUT /api/optimization/reassign - Move item between stores
 * 6. POST /api/optimization/route - Calculate optimal route
 * 7. GET /api/optimization/route/alternatives - Alternative routes
 * 8. POST /api/optimization/estimate-savings - Calculate potential savings
 * 9. GET /api/optimization/presets - Get preset weight configurations
 * 10. POST /api/optimization/route/directions - Turn-by-turn directions
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../validators');
const {
  weightProfileSchema,
  distributeSchema,
  reassignSchema,
  routeSchema,
  savingsEstimateSchema,
  directionsSchema
} = require('../validators/optimizationSchemas');
const { MultiStoreOptimizer, WEIGHT_PRESETS } = require('../services/multiStoreOptimizer');
const { RouteOptimizer } = require('../services/routeOptimizer');
const { MapsService } = require('../services/mapsService');
const { ApiError } = require('../middleware/errorHandler');
const { v4: uuidv4 } = require('uuid');

// Initialize services
const mapsService = new MapsService();
const multiStoreOptimizer = new MultiStoreOptimizer();
const routeOptimizer = new RouteOptimizer({ mapsService });

// In-memory storage for optimization data (replace with DB in production)
const optimizationStore = {
  profiles: new Map(),
  routes: new Map(),
  assignments: new Map()
};

// All optimization routes require authentication
router.use(authenticate);

// ============================================
// ENDPOINT 1: POST /api/optimization/weights
// Save a weight profile for the user
// ============================================
router.post('/weights', validate(weightProfileSchema), async (req, res, next) => {
  try {
    const { profileName, displayName, weights, isDefault } = req.body;
    const userId = req.user.id;

    // Validate weights sum to 1.0
    const sum = weights.price + weights.distance + weights.quality + weights.time;
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new ApiError(400, 'Weights must sum to 1.0');
    }

    // Create profile
    const profile = {
      id: uuidv4(),
      userId,
      profileName,
      displayName: displayName || profileName,
      priceWeight: weights.price,
      distanceWeight: weights.distance,
      qualityWeight: weights.quality,
      timeWeight: weights.time,
      isActive: false,
      isDefault: isDefault || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // If setting as default, unset other defaults
    if (isDefault) {
      for (const [id, p] of optimizationStore.profiles) {
        if (p.userId === userId && p.isDefault) {
          p.isDefault = false;
        }
      }
    }

    optimizationStore.profiles.set(profile.id, profile);

    res.status(201).json({
      message: 'Weight profile created',
      profile,
      presetUsed: Object.keys(WEIGHT_PRESETS).find(
        key => WEIGHT_PRESETS[key].price === weights.price &&
               WEIGHT_PRESETS[key].distance === weights.distance
      ) || 'custom'
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ENDPOINT 2: GET /api/optimization/profiles
// Get all weight profiles for the user
// ============================================
router.get('/profiles', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const userProfiles = Array.from(optimizationStore.profiles.values())
      .filter(p => p.userId === userId);

    // Add preset profiles if user has none
    const presets = Object.entries(WEIGHT_PRESETS).map(([name, weights]) => ({
      id: `preset-${name}`,
      profileName: name,
      displayName: weights.description,
      priceWeight: weights.price,
      distanceWeight: weights.distance,
      qualityWeight: weights.quality,
      timeWeight: weights.time,
      isPreset: true,
      isActive: false
    }));

    res.json({
      customProfiles: userProfiles,
      presetProfiles: presets,
      activeProfile: userProfiles.find(p => p.isActive) || null,
      defaultProfile: userProfiles.find(p => p.isDefault) || presets.find(p => p.profileName === 'balanced')
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ENDPOINT 3: POST /api/optimization/distribute
// Optimize shopping list distribution by weights
// ============================================
router.post('/distribute', validate(distributeSchema), async (req, res, next) => {
  try {
    const { shoppingListId, items, stores, weights, profileId, userLocation } = req.body;
    const userId = req.user.id;

    // Get weights from profile if specified
    let optimizationWeights = weights;
    if (profileId) {
      const profile = optimizationStore.profiles.get(profileId);
      if (profile && profile.userId === userId) {
        optimizationWeights = {
          price: profile.priceWeight,
          distance: profile.distanceWeight,
          quality: profile.qualityWeight,
          time: profile.timeWeight
        };
      }
    }

    // Use default weights if none provided
    if (!optimizationWeights) {
      optimizationWeights = WEIGHT_PRESETS.balanced;
    }

    // Get store distances if user location provided
    const distances = {};
    if (userLocation) {
      for (const store of stores) {
        const dist = await mapsService.getDistance(userLocation, store.location || store.address);
        distances[store.id] = dist.distance.value / 1609.34; // Convert to miles
      }
    }

    // Run optimization
    const result = await multiStoreOptimizer.optimizeByWeights(
      shoppingListId,
      items,
      stores,
      optimizationWeights,
      { distances, userLocation }
    );

    // Store assignments for later retrieval
    result.assignments.forEach(a => {
      optimizationStore.assignments.set(a.id, { ...a, userId, shoppingListId });
    });

    res.json({
      message: 'Shopping list optimized',
      optimization: result,
      weightsUsed: optimizationWeights,
      potentialSavings: result.summary.totalEstimatedSavings
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ENDPOINT 4: GET /api/optimization/scores/:itemId
// Get store scores for a specific item
// ============================================
router.get('/scores/:itemId', async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { stores, weights } = req.query;

    // Parse stores from query
    const storeList = stores ? JSON.parse(stores) : [];
    const weightObj = weights ? JSON.parse(weights) : WEIGHT_PRESETS.balanced;

    // Create mock item (in production, fetch from DB)
    const item = {
      id: itemId,
      name: 'Item',
      estimatedPrice: 5.00
    };

    const scores = await multiStoreOptimizer.getStoreScores(
      item,
      storeList,
      weightObj,
      {}
    );

    res.json({
      itemId,
      scores,
      bestStore: scores[0] || null,
      explanation: scores[0]?.explanation || 'No stores available'
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ENDPOINT 5: PUT /api/optimization/reassign
// Manually reassign an item to a different store
// ============================================
router.put('/reassign', validate(reassignSchema), async (req, res, next) => {
  try {
    const { assignmentId, fromStoreId, toStoreId, reason, stores } = req.body;
    const userId = req.user.id;

    // Get current assignment
    const assignment = optimizationStore.assignments.get(assignmentId);
    if (!assignment) {
      throw new ApiError(404, 'Assignment not found');
    }
    if (assignment.userId !== userId) {
      throw new ApiError(403, 'Access denied');
    }

    // Reassign item
    const updatedAssignment = await multiStoreOptimizer.reassignItem(
      assignment,
      fromStoreId,
      toStoreId,
      stores,
      reason
    );

    // Update stored assignment
    optimizationStore.assignments.set(assignmentId, {
      ...updatedAssignment,
      userId
    });

    res.json({
      message: 'Item reassigned successfully',
      assignment: updatedAssignment,
      priceDifference: updatedAssignment.priceAtStore - assignment.priceAtStore
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ENDPOINT 6: POST /api/optimization/route
// Calculate optimal route through stores
// ============================================
router.post('/route', validate(routeSchema), async (req, res, next) => {
  try {
    const { stores, startLocation, options } = req.body;
    const userId = req.user.id;

    const route = await routeOptimizer.calculateOptimalRoute(
      stores,
      startLocation,
      options || {}
    );

    // Store route
    optimizationStore.routes.set(route.id, { ...route, userId });

    res.json({
      message: 'Optimal route calculated',
      route,
      summary: {
        totalStops: route.stores.length,
        totalDistance: route.totalDistance.text,
        totalTime: route.totalTime.text,
        estimatedCompletion: new Date(
          Date.now() + route.totalTime.minutes * 60000
        ).toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ENDPOINT 7: GET /api/optimization/route/alternatives
// Get alternative routes with different priorities
// ============================================
router.get('/route/alternatives', async (req, res, next) => {
  try {
    const { stores, startLocation } = req.query;

    const storeList = stores ? JSON.parse(stores) : [];
    const start = startLocation ? JSON.parse(startLocation) : { lat: 30, lng: -95 };

    const alternatives = await routeOptimizer.getAlternativeRoutes(storeList, start);

    res.json({
      alternatives: alternatives.routes,
      comparison: alternatives.comparison,
      recommendation: alternatives.recommendation
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ENDPOINT 8: POST /api/optimization/estimate-savings
// Calculate potential savings from optimization
// ============================================
router.post('/estimate-savings', validate(savingsEstimateSchema), async (req, res, next) => {
  try {
    const { items, stores, weights } = req.body;

    const estimate = await multiStoreOptimizer.estimateSavings(
      items,
      stores,
      weights || WEIGHT_PRESETS.balanced
    );

    res.json({
      message: 'Savings estimate calculated',
      estimate,
      savingsSummary: {
        weeklyPotential: `$${estimate.savings.weeklyProjection}`,
        monthlyPotential: `$${estimate.savings.monthlyProjection}`,
        yearlyPotential: `$${estimate.savings.yearlyProjection}`
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ENDPOINT 9: GET /api/optimization/presets
// Get available weight preset configurations
// ============================================
router.get('/presets', (req, res) => {
  const presets = Object.entries(WEIGHT_PRESETS).map(([name, config]) => ({
    name,
    displayName: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: config.description,
    weights: {
      price: config.price,
      distance: config.distance,
      quality: config.quality,
      time: config.time
    },
    bestFor: getPresetRecommendation(name)
  }));

  res.json({
    presets,
    default: 'balanced',
    weightExplanations: {
      price: 'How much to prioritize finding the lowest prices',
      distance: 'How much to prioritize stores closer to you',
      quality: 'How much to prioritize store quality ratings',
      time: 'How much to prioritize minimizing total shopping time'
    }
  });
});

// ============================================
// ENDPOINT 10: POST /api/optimization/route/directions
// Get turn-by-turn directions for a route
// ============================================
router.post('/route/directions', validate(directionsSchema), async (req, res, next) => {
  try {
    const { stores, startLocation, routeId } = req.body;

    // If routeId provided, get stores from stored route
    let storeList = stores;
    if (routeId) {
      const route = optimizationStore.routes.get(routeId);
      if (route) {
        storeList = route.stores;
      }
    }

    if (!storeList || !storeList.length) {
      throw new ApiError(400, 'No stores provided for directions');
    }

    const directions = await routeOptimizer.getDirections(storeList, startLocation);

    res.json({
      message: 'Directions generated',
      directions,
      printableFormat: formatPrintableDirections(directions)
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Helper Functions
// ============================================

function getPresetRecommendation(presetName) {
  const recommendations = {
    balanced: 'General everyday shopping',
    cost_focused: 'Tight budget, flexible schedule',
    time_focused: 'Busy schedule, quick shopping trips',
    quality_focused: 'Quality-conscious, prefer premium stores'
  };
  return recommendations[presetName] || 'General use';
}

function formatPrintableDirections(directions) {
  if (!directions.legs) return '';

  return directions.legs.map((leg, i) => {
    return `Stop ${i + 1}: ${leg.storeName}\n` +
           `Address: ${leg.storeAddress || 'N/A'}\n` +
           `${leg.directions?.summary || ''}\n`;
  }).join('\n---\n');
}

module.exports = router;
