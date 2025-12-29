/**
 * Multi-Store Optimization Routes
 * Endpoints for calculating optimized shopping across multiple stores
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { validate, distributeSchema, routeSchema, savingsEstimateSchema } from '../validators';
import { MultiStoreOptimizer } from '../services/multiStoreOptimizer';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Initialize optimizer
const optimizer = new MultiStoreOptimizer();

// Mock services
const storeService = {
  findNearby: async (lat: number, lng: number, _radius: number) => {
    return [
      {
        id: uuidv4(),
        name: 'Walmart Supercenter',
        storeType: 'discount',
        latitude: lat + 0.01,
        longitude: lng + 0.01,
        distance: 2.5,
        rating: 4.2
      },
      {
        id: uuidv4(),
        name: 'Whole Foods Market',
        storeType: 'organic',
        latitude: lat + 0.02,
        longitude: lng - 0.01,
        distance: 3.8,
        rating: 4.5
      },
      {
        id: uuidv4(),
        name: 'Costco Wholesale',
        storeType: 'warehouse',
        latitude: lat - 0.01,
        longitude: lng + 0.02,
        distance: 5.2,
        rating: 4.6
      }
    ];
  }
};

const routeService = {
  optimize: async (stores: any[], _startLocation: any, options: any) => {
    return {
      id: uuidv4(),
      stores: stores.map((s, i) => ({ ...s, order: i + 1 })),
      totalDistance: 12.5,
      totalTime: 45,
      optimizedFor: options.optimize || 'distance',
      route: stores.map((s, i) => ({
        step: i + 1,
        store: s.name,
        distance: 2.5 + i,
        duration: 10 + i * 5
      }))
    };
  }
};

// All routes require authentication
router.use(authenticate);

/**
 * @route POST /api/optimization/calculate
 * @desc Calculate optimized shopping list distribution across stores
 * @access Private
 */
router.post('/calculate', validate(distributeSchema), async (req: Request, res: Response) => {
  const { shoppingListId, items, stores, weights, userLocation } = req.body;

  if (!items || items.length === 0) {
    throw new ApiError(400, 'At least one item is required');
  }

  if (!stores || stores.length === 0) {
    throw new ApiError(400, 'At least one store is required');
  }

  // Calculate distances if userLocation provided
  const distances: Record<string, number> = {};
  if (userLocation) {
    stores.forEach((store: any) => {
      if (store.latitude && store.longitude) {
        // Simple distance calculation (would use proper geo library in production)
        const latDiff = Math.abs(store.latitude - userLocation.lat);
        const lngDiff = Math.abs(store.longitude - userLocation.lng);
        distances[store.id] = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 69; // Rough miles
      } else {
        distances[store.id] = 5; // Default 5 miles
      }
    });
  }

  const result = await optimizer.optimizeByWeights(
    shoppingListId,
    items,
    stores,
    weights || {},
    { distances }
  );

  res.json({
    message: 'Shopping list optimized successfully',
    optimization: result
  });
});

/**
 * @route POST /api/optimization/route
 * @desc Get optimized store route
 * @access Private
 */
router.post('/route', validate(routeSchema), async (req: Request, res: Response) => {
  const { stores, startLocation, options = {} } = req.body;

  if (!stores || stores.length === 0) {
    throw new ApiError(400, 'At least one store is required');
  }

  if (!startLocation) {
    throw new ApiError(400, 'Start location is required');
  }

  const route = await routeService.optimize(stores, startLocation, options);

  res.json({
    message: 'Route calculated successfully',
    route: {
      ...route,
      startLocation,
      createdAt: new Date().toISOString()
    }
  });
});

/**
 * @route GET /api/optimization/stores
 * @desc Get nearby stores for optimization
 * @access Private
 */
router.get('/stores', async (req: Request, res: Response) => {
  const { lat, lng, radius = '10', storeType } = req.query;

  if (!lat || !lng) {
    throw new ApiError(400, 'Latitude and longitude are required');
  }

  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lng as string);
  const radiusMiles = parseFloat(radius as string);

  if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusMiles)) {
    throw new ApiError(400, 'Invalid coordinates or radius');
  }

  let stores = await storeService.findNearby(latitude, longitude, radiusMiles);

  // Filter by store type if provided
  if (storeType) {
    stores = stores.filter(s => s.storeType === storeType);
  }

  res.json({
    stores,
    count: stores.length,
    location: { lat: latitude, lng: longitude },
    radius: radiusMiles
  });
});

/**
 * @route POST /api/optimization/estimate-savings
 * @desc Calculate potential savings from multi-store shopping
 * @access Private
 */
router.post('/estimate-savings', validate(savingsEstimateSchema), async (req: Request, res: Response) => {
  const { items, stores, weights } = req.body;

  if (stores.length < 2) {
    throw new ApiError(400, 'At least 2 stores required for savings comparison');
  }

  // Calculate single-store baseline (cheapest overall store)
  const singleStoreScores = await Promise.all(
    stores.map(async (store: any) => {
      const storeItems = items.map((item: any) => ({
        ...item,
        price: optimizer.getItemPrices(item, [store])[store.id]
      }));
      const totalCost = storeItems.reduce((sum: number, item: any) => sum + item.price, 0);
      return { store, totalCost };
    })
  );

  const singleStoreBest = singleStoreScores.reduce((best, current) =>
    current.totalCost < best.totalCost ? current : best
  );

  // Calculate multi-store optimization
  const multiStoreResult = await optimizer.optimizeByWeights(
    uuidv4(),
    items,
    stores,
    weights || {},
    {}
  );

  const savings = singleStoreBest.totalCost - multiStoreResult.summary.totalEstimatedCost;
  const savingsPercentage = (savings / singleStoreBest.totalCost) * 100;

  res.json({
    comparison: {
      singleStore: {
        store: singleStoreBest.store.name,
        totalCost: singleStoreBest.totalCost,
        itemCount: items.length
      },
      multiStore: {
        stores: multiStoreResult.summary.totalStores,
        totalCost: multiStoreResult.summary.totalEstimatedCost,
        distribution: multiStoreResult.storeDistribution.map((d: any) => ({
          store: d.storeName,
          items: d.itemCount,
          cost: d.totalCost
        }))
      },
      savings: {
        amount: parseFloat(savings.toFixed(2)),
        percentage: parseFloat(savingsPercentage.toFixed(1)),
        weeklySavings: parseFloat((savings * 1).toFixed(2)),
        monthlySavings: parseFloat((savings * 4).toFixed(2)),
        annualSavings: parseFloat((savings * 52).toFixed(2))
      }
    }
  });
});

/**
 * @route GET /api/optimization/presets
 * @desc Get available weight presets
 * @access Private
 */
router.get('/presets', (_req: Request, res: Response) => {
  const presets = optimizer.getPresets();

  res.json({
    presets: Object.entries(presets).map(([name, config]) => ({
      name,
      ...config
    }))
  });
});

export default router;
