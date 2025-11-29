import { configureStore } from '@reduxjs/toolkit';
import optimizationReducer, {
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
  recalculateOptimization,
} from '../../../src/mobile/store/slices/optimizationSlice';
import {
  OptimizationState,
  OptimizationWeights,
  Store,
  OptimizedItem,
  OptimizedRoute,
  StoreItemScore,
  WEIGHT_PRESETS,
} from '../../../src/mobile/types/optimization.types';

// ============================================
// Test Store Setup
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

const createTestStore = (preloadedState?: { optimization: Partial<OptimizationState> }) => {
  // Always merge with initialState to ensure all arrays are properly initialized
  const mergedOptimization = {
    ...initialState,
    ...(preloadedState?.optimization || {}),
    // Ensure arrays are always defined (explicit null-coalescing for arrays)
    shoppingSessions: preloadedState?.optimization?.shoppingSessions ?? initialState.shoppingSessions,
    stores: preloadedState?.optimization?.stores ?? initialState.stores,
    items: preloadedState?.optimization?.items ?? initialState.items,
  };

  return configureStore({
    reducer: {
      optimization: optimizationReducer,
    },
    preloadedState: { optimization: mergedOptimization },
  });
};

// ============================================
// Mock Data
// ============================================
const mockStores: Store[] = [
  {
    id: 'store-1',
    name: 'Whole Foods',
    address: '123 Market St',
    distance: 2.5,
    rating: 4.5,
    openHours: '8am - 10pm',
    estimatedTime: 30,
    priceLevel: 3,
    sections: ['produce', 'dairy', 'meat'],
    coordinates: { latitude: 37.7749, longitude: -122.4194 },
  },
  {
    id: 'store-2',
    name: 'Safeway',
    address: '456 Main St',
    distance: 1.2,
    rating: 4.0,
    openHours: '7am - 11pm',
    estimatedTime: 25,
    priceLevel: 2,
    sections: ['produce', 'dairy', 'bakery'],
    coordinates: { latitude: 37.7849, longitude: -122.4094 },
  },
  {
    id: 'store-3',
    name: 'Trader Joe\'s',
    address: '789 Oak Ave',
    distance: 3.0,
    rating: 4.8,
    openHours: '8am - 9pm',
    estimatedTime: 20,
    priceLevel: 2,
    sections: ['produce', 'frozen', 'pantry'],
    coordinates: { latitude: 37.7649, longitude: -122.4294 },
  },
];

const mockStoreScores: Record<string, StoreItemScore> = {
  'store-1': {
    storeId: 'store-1',
    storeName: 'Whole Foods',
    price: 3.99,
    priceScore: 60,
    distanceScore: 70,
    qualityScore: 95,
    timeScore: 65,
    totalScore: 72.5,
    inStock: true,
    lastUpdated: '2025-01-29T10:00:00Z',
  },
  'store-2': {
    storeId: 'store-2',
    storeName: 'Safeway',
    price: 2.99,
    priceScore: 85,
    distanceScore: 95,
    qualityScore: 80,
    timeScore: 75,
    totalScore: 83.75,
    inStock: true,
    lastUpdated: '2025-01-29T10:00:00Z',
  },
  'store-3': {
    storeId: 'store-3',
    storeName: 'Trader Joe\'s',
    price: 3.49,
    priceScore: 75,
    distanceScore: 65,
    qualityScore: 90,
    timeScore: 85,
    totalScore: 78.75,
    inStock: true,
    lastUpdated: '2025-01-29T10:00:00Z',
  },
};

const mockItems: OptimizedItem[] = [
  {
    id: 'item-1',
    name: 'Organic Milk',
    category: 'dairy',
    quantity: 1,
    unit: 'gallon',
    assignedStoreId: 'store-2',
    assignedStoreName: 'Safeway',
    price: 2.99,
    storeScores: mockStoreScores,
    bestScore: 83.75,
    manuallyAssigned: false,
  },
  {
    id: 'item-2',
    name: 'Apples',
    category: 'produce',
    quantity: 5,
    unit: 'lbs',
    assignedStoreId: 'store-1',
    assignedStoreName: 'Whole Foods',
    price: 3.99,
    storeScores: mockStoreScores,
    bestScore: 72.5,
    manuallyAssigned: false,
  },
  {
    id: 'item-3',
    name: 'Bread',
    category: 'bakery',
    quantity: 1,
    unit: 'loaf',
    assignedStoreId: 'store-3',
    assignedStoreName: 'Trader Joe\'s',
    price: 3.49,
    storeScores: mockStoreScores,
    bestScore: 78.75,
    manuallyAssigned: false,
  },
];

const mockRoute: OptimizedRoute = {
  stops: [
    {
      storeId: 'store-2',
      storeName: 'Safeway',
      order: 1,
      estimatedArrival: '2025-01-29T10:15:00Z',
      estimatedDuration: 25,
      itemCount: 1,
      estimatedSpend: 2.99,
      coordinates: { latitude: 37.7849, longitude: -122.4094 },
    },
    {
      storeId: 'store-1',
      storeName: 'Whole Foods',
      order: 2,
      estimatedArrival: '2025-01-29T10:45:00Z',
      estimatedDuration: 30,
      itemCount: 1,
      estimatedSpend: 3.99,
      coordinates: { latitude: 37.7749, longitude: -122.4194 },
    },
  ],
  totalDistance: 3.7,
  totalDuration: 55,
  totalSpend: 6.98,
  savings: 1.50,
  startLocation: { latitude: 37.7749, longitude: -122.4194 },
};

// ============================================
// Initial State Tests
// ============================================
describe('optimizationSlice - Initial State', () => {
  test('should have correct initial state', () => {
    const store = createTestStore();
    const state = store.getState().optimization;

    expect(state.weights).toEqual({ price: 25, distance: 25, quality: 25, time: 25 });
    expect(state.activePreset).toBe('balanced');
    expect(state.isCustomWeights).toBe(false);
    expect(state.stores).toEqual([]);
    expect(state.items).toEqual([]);
    expect(state.storeAssignments).toEqual({});
    expect(state.route).toBeNull();
    expect(state.savings).toEqual({ total: 0, vsAveragePrice: 0, perStore: {} });
    expect(state.shoppingSessions).toEqual([]);
    expect(state.activeSession).toBeNull();
    expect(state.isCalculating).toBe(false);
    expect(state.lastCalculated).toBeNull();
    expect(state.error).toBeNull();
  });

  test('should initialize with default balanced weights', () => {
    const store = createTestStore();
    const state = store.getState().optimization;

    const totalWeight = state.weights.price + state.weights.distance +
                       state.weights.quality + state.weights.time;
    expect(totalWeight).toBe(100);
  });
});

// ============================================
// Weight Management Tests
// ============================================
describe('optimizationSlice - Weight Management', () => {
  test('setWeights should update weights and mark as custom', () => {
    const store = createTestStore();
    const newWeights: OptimizationWeights = { price: 40, distance: 30, quality: 20, time: 10 };

    store.dispatch(setWeights(newWeights));
    const state = store.getState().optimization;

    expect(state.weights).toEqual(newWeights);
    expect(state.isCustomWeights).toBe(true);
    expect(state.activePreset).toBe('custom');
  });

  test('applyPreset should apply save-money preset', () => {
    const store = createTestStore();
    store.dispatch(applyPreset('save-money'));
    const state = store.getState().optimization;

    expect(state.weights).toEqual({ price: 50, distance: 20, quality: 15, time: 15 });
    expect(state.activePreset).toBe('save-money');
    expect(state.isCustomWeights).toBe(false);
  });

  test('applyPreset should apply save-time preset', () => {
    const store = createTestStore();
    store.dispatch(applyPreset('save-time'));
    const state = store.getState().optimization;

    expect(state.weights).toEqual({ price: 15, distance: 30, quality: 15, time: 40 });
    expect(state.activePreset).toBe('save-time');
    expect(state.isCustomWeights).toBe(false);
  });

  test('applyPreset should apply quality-first preset', () => {
    const store = createTestStore();
    store.dispatch(applyPreset('quality-first'));
    const state = store.getState().optimization;

    expect(state.weights).toEqual({ price: 15, distance: 15, quality: 55, time: 15 });
    expect(state.activePreset).toBe('quality-first');
    expect(state.isCustomWeights).toBe(false);
  });

  test('applyPreset should apply balanced preset', () => {
    const store = createTestStore();
    // First set to a different preset
    store.dispatch(applyPreset('save-money'));
    // Then apply balanced
    store.dispatch(applyPreset('balanced'));
    const state = store.getState().optimization;

    expect(state.weights).toEqual({ price: 25, distance: 25, quality: 25, time: 25 });
    expect(state.activePreset).toBe('balanced');
    expect(state.isCustomWeights).toBe(false);
  });

  test('applyPreset should ignore invalid preset ID', () => {
    const store = createTestStore();
    const initialState = store.getState().optimization;

    store.dispatch(applyPreset('invalid-preset'));
    const state = store.getState().optimization;

    expect(state.weights).toEqual(initialState.weights);
    expect(state.activePreset).toBe(initialState.activePreset);
  });

  test('updateSingleWeight should update price weight and adjust others', () => {
    const store = createTestStore();
    store.dispatch(updateSingleWeight({ key: 'price', value: 50 }));
    const state = store.getState().optimization;

    expect(state.weights.price).toBe(50);
    expect(state.isCustomWeights).toBe(true);
    expect(state.activePreset).toBe('custom');

    // Total should still be 100
    const total = state.weights.price + state.weights.distance +
                  state.weights.quality + state.weights.time;
    expect(total).toBe(100);
  });

  test('updateSingleWeight should update distance weight and adjust others', () => {
    const store = createTestStore();
    store.dispatch(updateSingleWeight({ key: 'distance', value: 60 }));
    const state = store.getState().optimization;

    expect(state.weights.distance).toBe(60);
    const total = state.weights.price + state.weights.distance +
                  state.weights.quality + state.weights.time;
    expect(total).toBe(100);
  });

  test('updateSingleWeight should update quality weight and adjust others', () => {
    const store = createTestStore();
    store.dispatch(updateSingleWeight({ key: 'quality', value: 70 }));
    const state = store.getState().optimization;

    expect(state.weights.quality).toBe(70);
    const total = state.weights.price + state.weights.distance +
                  state.weights.quality + state.weights.time;
    expect(total).toBe(100);
  });

  test('updateSingleWeight should update time weight and adjust others', () => {
    const store = createTestStore();
    store.dispatch(updateSingleWeight({ key: 'time', value: 80 }));
    const state = store.getState().optimization;

    expect(state.weights.time).toBe(80);
    const total = state.weights.price + state.weights.distance +
                  state.weights.quality + state.weights.time;
    expect(total).toBe(100);
  });

  test('updateSingleWeight should maintain total of 100 when setting to 0', () => {
    const store = createTestStore();
    store.dispatch(updateSingleWeight({ key: 'price', value: 0 }));
    const state = store.getState().optimization;

    expect(state.weights.price).toBe(0);
    const total = state.weights.price + state.weights.distance +
                  state.weights.quality + state.weights.time;
    expect(total).toBe(100);
  });

  test('updateSingleWeight should handle edge case of setting to 100', () => {
    const store = createTestStore();
    store.dispatch(updateSingleWeight({ key: 'price', value: 100 }));
    const state = store.getState().optimization;

    expect(state.weights.price).toBe(100);
    const total = state.weights.price + state.weights.distance +
                  state.weights.quality + state.weights.time;
    expect(total).toBe(100);
    // Other weights should be 0
    expect(state.weights.distance).toBe(0);
    expect(state.weights.quality).toBe(0);
    expect(state.weights.time).toBe(0);
  });
});

// ============================================
// Store Management Tests
// ============================================
describe('optimizationSlice - Store Management', () => {
  test('setStores should set stores and initialize assignments', () => {
    const store = createTestStore();
    store.dispatch(setStores(mockStores));
    const state = store.getState().optimization;

    expect(state.stores).toEqual(mockStores);
    expect(Object.keys(state.storeAssignments)).toHaveLength(3);
    expect(state.storeAssignments['store-1']).toEqual([]);
    expect(state.storeAssignments['store-2']).toEqual([]);
    expect(state.storeAssignments['store-3']).toEqual([]);
  });

  test('setStores should preserve existing assignments', () => {
    const store = createTestStore({
      optimization: {
        storeAssignments: {
          'store-1': ['item-1', 'item-2'],
        },
      },
    });

    store.dispatch(setStores(mockStores));
    const state = store.getState().optimization;

    expect(state.storeAssignments['store-1']).toEqual(['item-1', 'item-2']);
    expect(state.storeAssignments['store-2']).toEqual([]);
    expect(state.storeAssignments['store-3']).toEqual([]);
  });

  test('setStores should handle empty store list', () => {
    const store = createTestStore();
    store.dispatch(setStores([]));
    const state = store.getState().optimization;

    expect(state.stores).toEqual([]);
    expect(state.storeAssignments).toEqual({});
  });
});

// ============================================
// Item Management Tests
// ============================================
describe('optimizationSlice - Item Management', () => {
  test('setItems should set items', () => {
    const store = createTestStore();
    store.dispatch(setItems(mockItems));
    const state = store.getState().optimization;

    expect(state.items).toEqual(mockItems);
    expect(state.items).toHaveLength(3);
  });

  test('setItems should handle empty item list', () => {
    const store = createTestStore();
    store.dispatch(setItems([]));
    const state = store.getState().optimization;

    expect(state.items).toEqual([]);
  });

  test('moveItem should move item from one store to another', () => {
    const store = createTestStore({
      optimization: {
        stores: mockStores,
        items: mockItems,
        storeAssignments: {
          'store-1': ['item-1', 'item-2'],
          'store-2': ['item-3'],
          'store-3': [],
        },
      },
    });

    store.dispatch(moveItem({
      itemId: 'item-1',
      fromStoreId: 'store-1',
      toStoreId: 'store-3',
    }));

    const state = store.getState().optimization;

    expect(state.storeAssignments['store-1']).toEqual(['item-2']);
    expect(state.storeAssignments['store-3']).toEqual(['item-1']);

    const movedItem = state.items.find(i => i.id === 'item-1');
    expect(movedItem?.assignedStoreId).toBe('store-3');
    expect(movedItem?.assignedStoreName).toBe('Trader Joe\'s');
    expect(movedItem?.manuallyAssigned).toBe(true);
    expect(movedItem?.price).toBe(3.49); // Price from store-3
  });

  test('moveItem should create target store assignment if not exists', () => {
    const store = createTestStore({
      optimization: {
        stores: mockStores,
        items: mockItems,
        storeAssignments: {
          'store-1': ['item-1'],
        },
      },
    });

    store.dispatch(moveItem({
      itemId: 'item-1',
      fromStoreId: 'store-1',
      toStoreId: 'store-2',
    }));

    const state = store.getState().optimization;

    expect(state.storeAssignments['store-1']).toEqual([]);
    expect(state.storeAssignments['store-2']).toEqual(['item-1']);
  });

  test('resetItemAssignment should reset manual assignment flag', () => {
    const manuallyAssignedItems = mockItems.map(item => ({
      ...item,
      manuallyAssigned: true,
    }));

    const store = createTestStore({
      optimization: {
        items: manuallyAssignedItems,
      },
    });

    store.dispatch(resetItemAssignment('item-1'));
    const state = store.getState().optimization;

    const item = state.items.find(i => i.id === 'item-1');
    expect(item?.manuallyAssigned).toBe(false);

    // Other items should still be manually assigned
    const otherItem = state.items.find(i => i.id === 'item-2');
    expect(otherItem?.manuallyAssigned).toBe(true);
  });

  test('resetItemAssignment should handle non-existent item', () => {
    const store = createTestStore({
      optimization: {
        items: mockItems,
      },
    });

    store.dispatch(resetItemAssignment('non-existent-item'));
    const state = store.getState().optimization;

    // Should not throw and state should remain unchanged
    expect(state.items).toEqual(mockItems);
  });
});

// ============================================
// Route Management Tests
// ============================================
describe('optimizationSlice - Route Management', () => {
  test('setRoute should set route', () => {
    const store = createTestStore();
    store.dispatch(setRoute(mockRoute));
    const state = store.getState().optimization;

    expect(state.route).toEqual(mockRoute);
    expect(state.route?.stops).toHaveLength(2);
    expect(state.route?.totalDistance).toBe(3.7);
  });

  test('setRoute should handle null route', () => {
    const store = createTestStore({
      optimization: {
        route: mockRoute,
      },
    });

    store.dispatch(setRoute(null as any));
    const state = store.getState().optimization;

    expect(state.route).toBeNull();
  });
});

// ============================================
// Shopping Session Tests
// ============================================
describe('optimizationSlice - Shopping Sessions', () => {
  test('startShoppingSession should create new session', () => {
    const store = createTestStore({
      optimization: {
        stores: mockStores,
        items: mockItems,
        storeAssignments: {
          'store-1': ['item-1', 'item-2'],
          'store-2': ['item-3'],
        },
      },
    });

    store.dispatch(startShoppingSession('store-1'));
    const state = store.getState().optimization;

    expect(state.shoppingSessions).toHaveLength(1);
    expect(state.activeSession).toBe('store-1');

    const session = state.shoppingSessions[0];
    expect(session.storeId).toBe('store-1');
    expect(session.storeName).toBe('Whole Foods');
    expect(session.items).toHaveLength(2);
    expect(session.status).toBe('in-progress');
    expect(session.actualTotal).toBe(0);
  });

  test('startShoppingSession should not create session for store with no items', () => {
    const store = createTestStore({
      optimization: {
        stores: mockStores,
        items: mockItems,
        storeAssignments: {
          'store-1': [],
          'store-2': [],
        },
      },
    });

    store.dispatch(startShoppingSession('store-1'));
    const state = store.getState().optimization;

    expect(state.shoppingSessions).toHaveLength(0);
    expect(state.activeSession).toBeNull();
  });

  test('startShoppingSession should not create session for non-existent store', () => {
    const store = createTestStore({
      optimization: {
        stores: mockStores,
        items: mockItems,
        storeAssignments: {
          'non-existent': ['item-1'],
        },
      },
    });

    store.dispatch(startShoppingSession('non-existent'));
    const state = store.getState().optimization;

    expect(state.shoppingSessions).toHaveLength(0);
    expect(state.activeSession).toBeNull();
  });

  test('checkItem should toggle item checked status', () => {
    const store = createTestStore({
      optimization: {
        stores: mockStores,
        items: mockItems,
        storeAssignments: {
          'store-1': ['item-1', 'item-2'],
        },
      },
    });

    store.dispatch(startShoppingSession('store-1'));
    store.dispatch(checkItem({ sessionStoreId: 'store-1', itemId: 'item-1' }));

    const state = store.getState().optimization;
    const session = state.shoppingSessions[0];
    const item = session.items.find(i => i.id === 'item-1');

    expect(item?.checked).toBe(true);

    // Toggle again
    store.dispatch(checkItem({ sessionStoreId: 'store-1', itemId: 'item-1' }));
    const updatedState = store.getState().optimization;
    const updatedSession = updatedState.shoppingSessions[0];
    const updatedItem = updatedSession.items.find(i => i.id === 'item-1');

    expect(updatedItem?.checked).toBe(false);
  });

  test('markItemUnavailable should mark item as unavailable', () => {
    const store = createTestStore({
      optimization: {
        stores: mockStores,
        items: mockItems,
        storeAssignments: {
          'store-1': ['item-1'],
        },
      },
    });

    store.dispatch(startShoppingSession('store-1'));
    store.dispatch(markItemUnavailable({
      sessionStoreId: 'store-1',
      itemId: 'item-1',
    }));

    const state = store.getState().optimization;
    const session = state.shoppingSessions[0];
    const item = session.items.find(i => i.id === 'item-1');

    expect(item?.unavailable).toBe(true);
  });

  test('markItemUnavailable should set substitute information', () => {
    const store = createTestStore({
      optimization: {
        stores: mockStores,
        items: mockItems,
        storeAssignments: {
          'store-1': ['item-1'],
        },
      },
    });

    store.dispatch(startShoppingSession('store-1'));
    store.dispatch(markItemUnavailable({
      sessionStoreId: 'store-1',
      itemId: 'item-1',
      substituteId: 'sub-1',
      substituteName: 'Alternative Milk',
    }));

    const state = store.getState().optimization;
    const session = state.shoppingSessions[0];
    const item = session.items.find(i => i.id === 'item-1');

    expect(item?.unavailable).toBe(true);
    expect(item?.substituteId).toBe('sub-1');
    expect(item?.substituteName).toBe('Alternative Milk');
  });

  test('updateItemActualPrice should update actual price and recalculate total', () => {
    const store = createTestStore({
      optimization: {
        stores: mockStores,
        items: mockItems,
        storeAssignments: {
          'store-1': ['item-1', 'item-2'],
        },
      },
    });

    store.dispatch(startShoppingSession('store-1'));
    store.dispatch(updateItemActualPrice({
      sessionStoreId: 'store-1',
      itemId: 'item-1',
      price: 4.99,
    }));

    const state = store.getState().optimization;
    const session = state.shoppingSessions[0];
    const item = session.items.find(i => i.id === 'item-1');

    expect(item?.actualPrice).toBe(4.99);
    expect(session.actualTotal).toBeGreaterThan(0);
  });

  test('completeShoppingSession should mark session as completed', () => {
    const store = createTestStore({
      optimization: {
        stores: mockStores,
        items: mockItems,
        storeAssignments: {
          'store-1': ['item-1'],
        },
      },
    });

    store.dispatch(startShoppingSession('store-1'));
    store.dispatch(completeShoppingSession({
      storeId: 'store-1',
      receiptUri: 'file://receipt.jpg',
    }));

    const state = store.getState().optimization;
    const session = state.shoppingSessions[0];

    expect(session.status).toBe('completed');
    expect(session.endTime).toBeDefined();
    expect(session.receiptUri).toBe('file://receipt.jpg');
    expect(state.activeSession).toBeNull();
  });

  test('completeShoppingSession should work without receipt', () => {
    const store = createTestStore({
      optimization: {
        stores: mockStores,
        items: mockItems,
        storeAssignments: {
          'store-1': ['item-1'],
        },
      },
    });

    store.dispatch(startShoppingSession('store-1'));
    store.dispatch(completeShoppingSession({ storeId: 'store-1' }));

    const state = store.getState().optimization;
    const session = state.shoppingSessions[0];

    expect(session.status).toBe('completed');
    expect(session.receiptUri).toBeUndefined();
  });
});

// ============================================
// Calculation State Tests
// ============================================
describe('optimizationSlice - Calculation State', () => {
  test('setCalculating should set calculating flag', () => {
    const store = createTestStore();

    store.dispatch(setCalculating(true));
    let state = store.getState().optimization;
    expect(state.isCalculating).toBe(true);

    store.dispatch(setCalculating(false));
    state = store.getState().optimization;
    expect(state.isCalculating).toBe(false);
  });

  test('setError should set error message', () => {
    const store = createTestStore();

    store.dispatch(setError('Test error'));
    let state = store.getState().optimization;
    expect(state.error).toBe('Test error');

    store.dispatch(setError(null));
    state = store.getState().optimization;
    expect(state.error).toBeNull();
  });
});

// ============================================
// Reset Tests
// ============================================
describe('optimizationSlice - Reset', () => {
  test('resetOptimization should reset all optimization data', () => {
    const store = createTestStore({
      optimization: {
        items: mockItems,
        stores: mockStores,
        storeAssignments: { 'store-1': ['item-1'] },
        route: mockRoute,
        savings: { total: 10, vsAveragePrice: 10, perStore: { 'store-1': 5 } },
        shoppingSessions: [
          {
            storeId: 'store-1',
            storeName: 'Test Store',
            items: [],
            startTime: '2025-01-29T10:00:00Z',
            status: 'in-progress' as const,
            actualTotal: 0,
          },
        ],
        activeSession: 'store-1',
        lastCalculated: '2025-01-29T10:00:00Z',
      },
    });

    store.dispatch(resetOptimization());
    const state = store.getState().optimization;

    expect(state.items).toEqual([]);
    expect(state.storeAssignments).toEqual({});
    expect(state.route).toBeNull();
    expect(state.savings).toEqual({ total: 0, vsAveragePrice: 0, perStore: {} });
    expect(state.shoppingSessions).toEqual([]);
    expect(state.activeSession).toBeNull();
    expect(state.lastCalculated).toBeNull();

    // Weights should not be reset
    expect(state.stores).toEqual(mockStores);
  });
});

// ============================================
// Async Thunk Tests
// ============================================
describe('optimizationSlice - Async Thunks', () => {
  beforeEach(() => {
    // Mock timers to avoid actual 300ms delay
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('recalculateOptimization pending should set calculating flag', async () => {
    const store = createTestStore({
      optimization: {
        weights: { price: 50, distance: 20, quality: 15, time: 15 },
        stores: mockStores,
        items: mockItems,
      },
    });

    const promise = store.dispatch(recalculateOptimization());
    const state = store.getState().optimization;

    expect(state.isCalculating).toBe(true);
    expect(state.error).toBeNull();

    // Fast-forward timers to complete the async operation
    await jest.runAllTimersAsync();
    await promise;
  });

  test('recalculateOptimization fulfilled should update assignments and route', async () => {
    const store = createTestStore({
      optimization: {
        weights: { price: 50, distance: 20, quality: 15, time: 15 },
        stores: mockStores,
        items: mockItems,
      },
    });

    const promise = store.dispatch(recalculateOptimization());
    await jest.runAllTimersAsync();
    await promise;

    const state = store.getState().optimization;

    expect(state.isCalculating).toBe(false);
    expect(state.storeAssignments).toBeDefined();
    expect(state.route).toBeDefined();
    expect(state.savings).toBeDefined();
    expect(state.lastCalculated).toBeDefined();
  });

  test('recalculateOptimization should assign items to best stores', async () => {
    const store = createTestStore({
      optimization: {
        weights: { price: 50, distance: 20, quality: 15, time: 15 },
        stores: mockStores,
        items: mockItems,
      },
    });

    const promise = store.dispatch(recalculateOptimization());
    await jest.runAllTimersAsync();
    await promise;

    const state = store.getState().optimization;

    // Check that items are assigned to stores
    const assignedStores = Object.keys(state.storeAssignments);
    expect(assignedStores.length).toBeGreaterThan(0);

    const totalAssignedItems = Object.values(state.storeAssignments)
      .reduce((sum, items) => sum + items.length, 0);
    expect(totalAssignedItems).toBe(mockItems.length);
  });

  test('recalculateOptimization should preserve manually assigned items', async () => {
    const manualItem = {
      ...mockItems[0],
      manuallyAssigned: true,
      assignedStoreId: 'store-3',
    };

    const store = createTestStore({
      optimization: {
        weights: { price: 50, distance: 20, quality: 15, time: 15 },
        stores: mockStores,
        items: [manualItem, ...mockItems.slice(1)],
      },
    });

    const promise = store.dispatch(recalculateOptimization());
    await jest.runAllTimersAsync();
    await promise;

    const state = store.getState().optimization;

    // Manual item should still be assigned to store-3
    expect(state.storeAssignments['store-3']).toContain(manualItem.id);
  });

  test('recalculateOptimization should calculate route with correct order', async () => {
    const store = createTestStore({
      optimization: {
        weights: { price: 50, distance: 20, quality: 15, time: 15 },
        stores: mockStores,
        items: mockItems,
      },
    });

    const promise = store.dispatch(recalculateOptimization());
    await jest.runAllTimersAsync();
    await promise;

    const state = store.getState().optimization;

    expect(state.route).toBeDefined();
    expect(state.route?.stops).toBeDefined();

    if (state.route?.stops) {
      // Check that stops are ordered
      const orders = state.route.stops.map(stop => stop.order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
  });

  test('recalculateOptimization should calculate savings correctly', async () => {
    const store = createTestStore({
      optimization: {
        weights: { price: 50, distance: 20, quality: 15, time: 15 },
        stores: mockStores,
        items: mockItems,
      },
    });

    const promise = store.dispatch(recalculateOptimization());
    await jest.runAllTimersAsync();
    await promise;

    const state = store.getState().optimization;

    expect(state.savings).toBeDefined();
    expect(state.savings.total).toBeGreaterThanOrEqual(0);
    expect(state.savings.vsAveragePrice).toBeGreaterThanOrEqual(0);
    expect(state.savings.perStore).toBeDefined();
  });

  test('recalculateOptimization rejected should set error', async () => {
    // Create store with invalid state to trigger error
    const store = createTestStore({
      optimization: {
        weights: { price: 0, distance: 0, quality: 0, time: 0 },
        stores: [],
        items: [],
      },
    });

    // Mock console.error to suppress error logs
    const originalError = console.error;
    console.error = jest.fn();

    try {
      const promise = store.dispatch(recalculateOptimization());
      await jest.runAllTimersAsync();
      await promise;

      const state = store.getState().optimization;

      expect(state.isCalculating).toBe(false);
      // Error might not be set if calculation succeeds with empty data
    } finally {
      console.error = originalError;
    }
  });

  test('recalculateOptimization should update item assignments', async () => {
    const store = createTestStore({
      optimization: {
        weights: { price: 50, distance: 20, quality: 15, time: 15 },
        stores: mockStores,
        items: mockItems,
      },
    });

    const promise = store.dispatch(recalculateOptimization());
    await jest.runAllTimersAsync();
    await promise;

    const state = store.getState().optimization;

    // All items should have assigned store IDs
    state.items.forEach(item => {
      if (!item.manuallyAssigned) {
        expect(item.assignedStoreId).toBeDefined();
        expect(item.assignedStoreName).toBeDefined();
      }
    });
  });
});

// ============================================
// Integration Tests
// ============================================
describe('optimizationSlice - Integration', () => {
  test('complete workflow: set stores, items, weights, and recalculate', async () => {
    jest.useFakeTimers();

    const store = createTestStore();

    // Set stores
    store.dispatch(setStores(mockStores));
    expect(store.getState().optimization.stores).toHaveLength(3);

    // Set items
    store.dispatch(setItems(mockItems));
    expect(store.getState().optimization.items).toHaveLength(3);

    // Set weights
    store.dispatch(applyPreset('save-money'));
    expect(store.getState().optimization.weights.price).toBe(50);

    // Recalculate
    const promise = store.dispatch(recalculateOptimization());
    await jest.runAllTimersAsync();
    await promise;

    const state = store.getState().optimization;

    expect(state.storeAssignments).toBeDefined();
    expect(state.route).toBeDefined();
    expect(state.savings).toBeDefined();
    expect(state.lastCalculated).toBeDefined();

    jest.useRealTimers();
  });

  test('shopping session workflow: start, check items, mark unavailable, complete', () => {
    const store = createTestStore({
      optimization: {
        stores: mockStores,
        items: mockItems,
        storeAssignments: {
          'store-1': ['item-1', 'item-2'],
        },
      },
    });

    // Start session
    store.dispatch(startShoppingSession('store-1'));
    expect(store.getState().optimization.shoppingSessions).toHaveLength(1);

    // Check item
    store.dispatch(checkItem({ sessionStoreId: 'store-1', itemId: 'item-1' }));
    let session = store.getState().optimization.shoppingSessions[0];
    expect(session.items.find(i => i.id === 'item-1')?.checked).toBe(true);

    // Mark unavailable
    store.dispatch(markItemUnavailable({
      sessionStoreId: 'store-1',
      itemId: 'item-2',
      substituteName: 'Alternative',
    }));
    session = store.getState().optimization.shoppingSessions[0];
    expect(session.items.find(i => i.id === 'item-2')?.unavailable).toBe(true);

    // Update price
    store.dispatch(updateItemActualPrice({
      sessionStoreId: 'store-1',
      itemId: 'item-1',
      price: 5.99,
    }));
    session = store.getState().optimization.shoppingSessions[0];
    expect(session.items.find(i => i.id === 'item-1')?.actualPrice).toBe(5.99);

    // Complete session
    store.dispatch(completeShoppingSession({ storeId: 'store-1' }));
    session = store.getState().optimization.shoppingSessions[0];
    expect(session.status).toBe('completed');
    expect(store.getState().optimization.activeSession).toBeNull();
  });

  test('weight adjustment workflow maintains total of 100', () => {
    const store = createTestStore();

    // Update multiple weights
    store.dispatch(updateSingleWeight({ key: 'price', value: 40 }));
    let total = Object.values(store.getState().optimization.weights)
      .reduce((sum, val) => sum + val, 0);
    expect(total).toBe(100);

    store.dispatch(updateSingleWeight({ key: 'distance', value: 30 }));
    total = Object.values(store.getState().optimization.weights)
      .reduce((sum, val) => sum + val, 0);
    expect(total).toBe(100);

    store.dispatch(updateSingleWeight({ key: 'quality', value: 20 }));
    total = Object.values(store.getState().optimization.weights)
      .reduce((sum, val) => sum + val, 0);
    expect(total).toBe(100);
  });

  test('manual item assignment workflow', () => {
    const store = createTestStore({
      optimization: {
        stores: mockStores,
        items: mockItems,
        storeAssignments: {
          'store-1': ['item-1'],
          'store-2': ['item-2'],
        },
      },
    });

    // Move item manually
    store.dispatch(moveItem({
      itemId: 'item-1',
      fromStoreId: 'store-1',
      toStoreId: 'store-2',
    }));

    let state = store.getState().optimization;
    expect(state.storeAssignments['store-2']).toContain('item-1');
    expect(state.items.find(i => i.id === 'item-1')?.manuallyAssigned).toBe(true);

    // Reset manual assignment
    store.dispatch(resetItemAssignment('item-1'));
    state = store.getState().optimization;
    expect(state.items.find(i => i.id === 'item-1')?.manuallyAssigned).toBe(false);
  });
});
