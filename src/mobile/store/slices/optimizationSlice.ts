import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  OptimizationState,
  OptimizationWeights,
  OptimizedItem,
  Store,
  OptimizedRoute,
  RouteStop,
  StoreShoppingSession,
  ShoppingModeItem,
  MoveItemPayload,
  WEIGHT_PRESETS,
  StoreItemScore,
} from '../../types/optimization.types';

// ============================================
// Initial State
// ============================================
const initialState: OptimizationState = {
  weights: { price: 25, distance: 25, quality: 25, time: 25 },
  activePreset: 'balanced',
  isCustomWeights: false,
  stores: [],
  items: [],
  storeAssignments: {},
  route: null,
  savings: {
    total: 0,
    vsAveragePrice: 0,
    perStore: {},
  },
  shoppingSessions: [],
  activeSession: null,
  isCalculating: false,
  lastCalculated: null,
  error: null,
};

// ============================================
// Helper Functions
// ============================================
const calculateItemScore = (
  item: OptimizedItem,
  storeId: string,
  weights: OptimizationWeights
): number => {
  const scores = item.storeScores instanceof Map
    ? item.storeScores.get(storeId)
    : (item.storeScores as Record<string, StoreItemScore>)[storeId];

  if (!scores) return 0;

  const totalWeight = weights.price + weights.distance + weights.quality + weights.time;
  if (totalWeight === 0) return 0;

  return (
    (scores.priceScore * weights.price +
     scores.distanceScore * weights.distance +
     scores.qualityScore * weights.quality +
     scores.timeScore * weights.time) / totalWeight
  );
};

const optimizeAssignments = (
  items: OptimizedItem[],
  stores: Store[],
  weights: OptimizationWeights
): Record<string, string[]> => {
  const assignments: Record<string, string[]> = {};

  // Initialize empty arrays for each store
  stores.forEach(store => {
    assignments[store.id] = [];
  });

  // Assign each item to its best store based on current weights
  items.forEach(item => {
    if (item.manuallyAssigned) {
      // Keep manual assignments
      if (!assignments[item.assignedStoreId]) {
        assignments[item.assignedStoreId] = [];
      }
      assignments[item.assignedStoreId].push(item.id);
    } else {
      // Find best store for this item
      let bestStoreId = stores[0]?.id || '';
      let bestScore = 0;

      stores.forEach(store => {
        const score = calculateItemScore(item, store.id, weights);
        if (score > bestScore) {
          bestScore = score;
          bestStoreId = store.id;
        }
      });

      if (bestStoreId && assignments[bestStoreId]) {
        assignments[bestStoreId].push(item.id);
      }
    }
  });

  return assignments;
};

const calculateRoute = (
  stores: Store[],
  assignments: Record<string, string[]>,
  items: OptimizedItem[],
  startLocation: { latitude: number; longitude: number }
): OptimizedRoute => {
  // Filter stores that have items assigned
  const storesWithItems = stores.filter(
    store => assignments[store.id] && assignments[store.id].length > 0
  );

  // Simple greedy nearest neighbor algorithm for route optimization
  const route: RouteStop[] = [];
  const visited = new Set<string>();
  let currentLocation = startLocation;
  let totalDistance = 0;
  let totalDuration = 0;
  let totalSpend = 0;
  let order = 1;

  while (visited.size < storesWithItems.length) {
    let nearestStore: Store | undefined = undefined;
    let nearestDistance = Infinity;

    for (const store of storesWithItems) {
      if (!visited.has(store.id)) {
        const distance = Math.sqrt(
          Math.pow(store.coordinates.latitude - currentLocation.latitude, 2) +
          Math.pow(store.coordinates.longitude - currentLocation.longitude, 2)
        ) * 69; // Approximate miles conversion

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestStore = store;
        }
      }
    }

    if (nearestStore) {
      const store = nearestStore; // Create const for proper narrowing
      visited.add(store.id);
      totalDistance += nearestDistance;
      totalDuration += store.estimatedTime + (nearestDistance * 2); // 2 min/mile

      const storeItems = items.filter(
        item => assignments[store.id]?.includes(item.id)
      );
      const storeSpend = storeItems.reduce((sum, item) => sum + item.price, 0);
      totalSpend += storeSpend;

      route.push({
        storeId: store.id,
        storeName: store.name,
        order: order++,
        estimatedArrival: new Date(Date.now() + totalDuration * 60000).toISOString(),
        estimatedDuration: store.estimatedTime,
        itemCount: assignments[store.id]?.length || 0,
        estimatedSpend: storeSpend,
        coordinates: store.coordinates,
      });

      currentLocation = store.coordinates;
    }
  }

  return {
    stops: route,
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalDuration: Math.round(totalDuration),
    totalSpend: Math.round(totalSpend * 100) / 100,
    savings: 0, // Will be calculated separately
    startLocation,
  };
};

const calculateSavings = (
  items: OptimizedItem[],
  assignments: Record<string, string[]>
): { total: number; vsAveragePrice: number; perStore: Record<string, number> } => {
  let optimizedTotal = 0;
  let averageTotal = 0;
  const perStore: Record<string, number> = {};

  items.forEach(item => {
    // Get all prices for this item across stores
    const prices: number[] = [];
    const scores = item.storeScores instanceof Map
      ? Array.from(item.storeScores.values())
      : Object.values(item.storeScores as Record<string, StoreItemScore>);

    scores.forEach(score => {
      if (score.inStock) {
        prices.push(score.price);
      }
    });

    if (prices.length > 0) {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      averageTotal += avgPrice;
      optimizedTotal += item.price;

      // Calculate per-store savings
      const storeSaving = avgPrice - item.price;
      if (!perStore[item.assignedStoreId]) {
        perStore[item.assignedStoreId] = 0;
      }
      perStore[item.assignedStoreId] += storeSaving;
    }
  });

  return {
    total: Math.round((averageTotal - optimizedTotal) * 100) / 100,
    vsAveragePrice: Math.round((averageTotal - optimizedTotal) * 100) / 100,
    perStore,
  };
};

// ============================================
// Async Thunks
// ============================================
export const recalculateOptimization = createAsyncThunk(
  'optimization/recalculate',
  async (_, { getState }) => {
    const state = getState() as { optimization: OptimizationState };
    const { weights, items, stores } = state.optimization;

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const assignments = optimizeAssignments(items, stores, weights);
    const route = calculateRoute(
      stores,
      assignments,
      items,
      { latitude: 37.7749, longitude: -122.4194 } // Default to SF
    );
    const savings = calculateSavings(items, assignments);

    return { assignments, route, savings };
  }
);

// ============================================
// Slice
// ============================================
const optimizationSlice = createSlice({
  name: 'optimization',
  initialState,
  reducers: {
    // Weight Management
    setWeights: (state, action: PayloadAction<OptimizationWeights>) => {
      state.weights = action.payload;
      state.isCustomWeights = true;
      state.activePreset = 'custom';
    },

    applyPreset: (state, action: PayloadAction<string>) => {
      const preset = WEIGHT_PRESETS.find(p => p.id === action.payload);
      if (preset) {
        state.weights = { ...preset.weights };
        state.activePreset = preset.id;
        state.isCustomWeights = false;
      }
    },

    updateSingleWeight: (
      state,
      action: PayloadAction<{ key: keyof OptimizationWeights; value: number }>
    ) => {
      const { key, value } = action.payload;
      const oldValue = state.weights[key];
      const diff = value - oldValue;

      // Adjust other weights proportionally to maintain 100% total
      const otherKeys = (['price', 'distance', 'quality', 'time'] as const)
        .filter(k => k !== key);

      const otherTotal = otherKeys.reduce((sum, k) => sum + state.weights[k], 0);

      if (otherTotal > 0) {
        otherKeys.forEach(k => {
          const proportion = state.weights[k] / otherTotal;
          state.weights[k] = Math.max(0, Math.round(state.weights[k] - diff * proportion));
        });
      }

      state.weights[key] = value;
      state.isCustomWeights = true;
      state.activePreset = 'custom';

      // Ensure total is exactly 100
      const total = state.weights.price + state.weights.distance +
                    state.weights.quality + state.weights.time;
      if (total !== 100) {
        const adjustment = 100 - total;
        const adjustKey = otherKeys.find(k => state.weights[k] > 0) || otherKeys[0];
        state.weights[adjustKey] = Math.max(0, state.weights[adjustKey] + adjustment);
      }
    },

    // Store Management
    setStores: (state, action: PayloadAction<Store[]>) => {
      state.stores = action.payload;
      // Initialize assignments for each store
      action.payload.forEach(store => {
        if (!state.storeAssignments[store.id]) {
          state.storeAssignments[store.id] = [];
        }
      });
    },

    // Item Management
    setItems: (state, action: PayloadAction<OptimizedItem[]>) => {
      state.items = action.payload;
    },

    moveItem: (state, action: PayloadAction<MoveItemPayload>) => {
      const { itemId, fromStoreId, toStoreId } = action.payload;

      // Remove from source store
      if (state.storeAssignments[fromStoreId]) {
        state.storeAssignments[fromStoreId] =
          state.storeAssignments[fromStoreId].filter(id => id !== itemId);
      }

      // Add to target store
      if (!state.storeAssignments[toStoreId]) {
        state.storeAssignments[toStoreId] = [];
      }
      state.storeAssignments[toStoreId].push(itemId);

      // Update item's assigned store
      const item = state.items.find(i => i.id === itemId);
      if (item) {
        item.assignedStoreId = toStoreId;
        item.manuallyAssigned = true;
        const store = state.stores.find(s => s.id === toStoreId);
        if (store) {
          item.assignedStoreName = store.name;
          // Update item price from new store
          const scores = item.storeScores instanceof Map
            ? item.storeScores.get(toStoreId)
            : (item.storeScores as Record<string, StoreItemScore>)[toStoreId];
          if (scores) {
            item.price = scores.price;
          }
        }
      }
    },

    resetItemAssignment: (state, action: PayloadAction<string>) => {
      const item = state.items.find(i => i.id === action.payload);
      if (item) {
        item.manuallyAssigned = false;
      }
    },

    // Route Management
    setRoute: (state, action: PayloadAction<OptimizedRoute>) => {
      state.route = action.payload;
    },

    // Shopping Session Management
    startShoppingSession: (state, action: PayloadAction<string>) => {
      const storeId = action.payload;
      const store = state.stores.find(s => s.id === storeId);
      const storeItems = state.items.filter(
        item => state.storeAssignments[storeId]?.includes(item.id)
      );

      if (store && storeItems.length > 0) {
        const session: StoreShoppingSession = {
          storeId,
          storeName: store.name,
          items: storeItems.map((item, index) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            section: item.category,
            sectionOrder: index,
            estimatedPrice: item.price,
            checked: false,
            unavailable: false,
          })),
          startTime: new Date().toISOString(),
          status: 'in-progress',
          actualTotal: 0,
        };

        state.shoppingSessions.push(session);
        state.activeSession = storeId;
      }
    },

    checkItem: (
      state,
      action: PayloadAction<{ sessionStoreId: string; itemId: string }>
    ) => {
      const session = state.shoppingSessions.find(
        s => s.storeId === action.payload.sessionStoreId
      );
      if (session) {
        const item = session.items.find(i => i.id === action.payload.itemId);
        if (item) {
          item.checked = !item.checked;
        }
      }
    },

    markItemUnavailable: (
      state,
      action: PayloadAction<{ sessionStoreId: string; itemId: string; substituteId?: string; substituteName?: string }>
    ) => {
      const session = state.shoppingSessions.find(
        s => s.storeId === action.payload.sessionStoreId
      );
      if (session) {
        const item = session.items.find(i => i.id === action.payload.itemId);
        if (item) {
          item.unavailable = true;
          item.substituteId = action.payload.substituteId;
          item.substituteName = action.payload.substituteName;
        }
      }
    },

    updateItemActualPrice: (
      state,
      action: PayloadAction<{ sessionStoreId: string; itemId: string; price: number }>
    ) => {
      const session = state.shoppingSessions.find(
        s => s.storeId === action.payload.sessionStoreId
      );
      if (session) {
        const item = session.items.find(i => i.id === action.payload.itemId);
        if (item) {
          item.actualPrice = action.payload.price;
          // Recalculate session total
          session.actualTotal = session.items.reduce(
            (sum, i) => sum + (i.actualPrice || i.estimatedPrice),
            0
          );
        }
      }
    },

    completeShoppingSession: (
      state,
      action: PayloadAction<{ storeId: string; receiptUri?: string }>
    ) => {
      const session = state.shoppingSessions.find(
        s => s.storeId === action.payload.storeId
      );
      if (session) {
        session.status = 'completed';
        session.endTime = new Date().toISOString();
        session.receiptUri = action.payload.receiptUri;
        state.activeSession = null;
      }
    },

    // Calculation State
    setCalculating: (state, action: PayloadAction<boolean>) => {
      state.isCalculating = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Reset
    resetOptimization: (state) => {
      state.items = [];
      state.storeAssignments = {};
      state.route = null;
      state.savings = { total: 0, vsAveragePrice: 0, perStore: {} };
      state.shoppingSessions = [];
      state.activeSession = null;
      state.lastCalculated = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(recalculateOptimization.pending, (state) => {
        state.isCalculating = true;
        state.error = null;
      })
      .addCase(recalculateOptimization.fulfilled, (state, action) => {
        state.storeAssignments = action.payload.assignments;
        state.route = action.payload.route;
        state.savings = action.payload.savings;
        state.isCalculating = false;
        state.lastCalculated = new Date().toISOString();

        // Update items with new assignments
        state.items.forEach(item => {
          if (!item.manuallyAssigned) {
            const storeId = Object.keys(state.storeAssignments).find(
              sid => state.storeAssignments[sid].includes(item.id)
            );
            if (storeId) {
              item.assignedStoreId = storeId;
              const store = state.stores.find(s => s.id === storeId);
              if (store) {
                item.assignedStoreName = store.name;
              }
            }
          }
        });
      })
      .addCase(recalculateOptimization.rejected, (state, action) => {
        state.isCalculating = false;
        state.error = action.error.message || 'Failed to recalculate optimization';
      });
  },
});

export const {
  setWeights,
  applyPreset,
  updateSingleWeight,
  setStores,
  setItems,
  moveItem,
  resetItemAssignment,
  setRoute,
  startShoppingSession,
  checkItem,
  markItemUnavailable,
  updateItemActualPrice,
  completeShoppingSession,
  setCalculating,
  setError,
  resetOptimization,
} = optimizationSlice.actions;

export default optimizationSlice.reducer;
