/**
 * Comprehensive Tests for shoppingSlice Redux Slice
 *
 * Coverage:
 * - Initial state (2 tests)
 * - Sync reducers (18 tests)
 * - Async thunk states (14 tests)
 * - Edge cases and calculations (12 tests)
 * Total: 46 tests
 */

import { configureStore } from '@reduxjs/toolkit';
import shoppingReducer, {
  createList,
  addItem,
  removeItem,
  toggleItemChecked,
  updateItemPrice,
  assignItemToStore,
  setListStatus,
  completeList,
  addFavoriteStore,
  removeFavoriteStore,
  setLoading,
  setError,
  fetchCurrentList,
  createListAsync,
  addItemAsync,
  updateItemAsync,
  removeItemAsync,
  completeListAsync,
  fetchPastLists,
} from '../../../src/mobile/store/slices/shoppingSlice';
import { ShoppingList, ShoppingItem, StoreAssignment } from '../../../src/mobile/types';
import { shoppingApi } from '../../../src/mobile/services/apiService';

// Mock the API service
jest.mock('../../../src/mobile/services/apiService', () => ({
  shoppingApi: {
    getCurrentList: jest.fn(),
    createList: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    completeList: jest.fn(),
    getPastLists: jest.fn(),
  },
}));

const mockShoppingApi = shoppingApi as jest.Mocked<typeof shoppingApi>;

// Helper function to create a test store
const createTestStore = (initialState?: any) => {
  return configureStore({
    reducer: {
      shopping: shoppingReducer,
    },
    preloadedState: initialState ? { shopping: initialState } : undefined,
  });
};

// Mock data generators
const createMockShoppingList = (overrides?: Partial<ShoppingList>): ShoppingList => ({
  id: 'list-1',
  name: 'Weekly Shopping',
  weekOf: '2025-01-01',
  items: [],
  stores: [],
  totalEstimatedCost: 0,
  status: 'planning',
  ...overrides,
});

const createMockShoppingItem = (overrides?: Partial<ShoppingItem>): ShoppingItem => ({
  id: 'item-1',
  name: 'Milk',
  quantity: 1,
  unit: 'gallon',
  category: 'dairy',
  storeSection: 'Dairy',
  estimatedPrice: 3.99,
  checked: false,
  ...overrides,
});

const createMockStoreAssignment = (overrides?: Partial<StoreAssignment>): StoreAssignment => ({
  storeId: 'store-1',
  storeName: 'Costco',
  items: [],
  estimatedTotal: 0,
  ...overrides,
});

describe('shoppingSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // INITIAL STATE TESTS (2 tests)
  // =============================================================================
  describe('Initial State', () => {
    it('should have correct initial state structure', () => {
      const store = createTestStore();
      const state = store.getState().shopping;

      expect(state.currentList).toBeNull();
      expect(state.pastLists).toEqual([]);
      expect(state.favoriteStores).toEqual(['Costco', 'Safeway', 'Whole Foods', 'Walmart']);
      expect(state.priceHistory).toEqual({});
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should initialize with default favorite stores', () => {
      const store = createTestStore();
      const state = store.getState().shopping;

      expect(state.favoriteStores).toHaveLength(4);
      expect(state.favoriteStores).toContain('Costco');
      expect(state.favoriteStores).toContain('Safeway');
      expect(state.favoriteStores).toContain('Whole Foods');
      expect(state.favoriteStores).toContain('Walmart');
    });
  });

  // =============================================================================
  // SYNC REDUCERS - LIST MANAGEMENT (4 tests)
  // =============================================================================
  describe('createList reducer', () => {
    it('should create a new list when none exists', () => {
      const store = createTestStore();
      const newList = createMockShoppingList();

      store.dispatch(createList(newList));
      const state = store.getState().shopping;

      expect(state.currentList).toEqual(newList);
      expect(state.pastLists).toHaveLength(0);
    });

    it('should move current list to past lists when creating new list', () => {
      const existingList = createMockShoppingList({ id: 'list-old' });
      const store = createTestStore({
        currentList: existingList,
        pastLists: [],
        favoriteStores: ['Costco', 'Safeway', 'Whole Foods', 'Walmart'],
        priceHistory: {},
        loading: false,
        error: null,
      });
      const newList = createMockShoppingList({ id: 'list-new' });

      store.dispatch(createList(newList));
      const state = store.getState().shopping;

      expect(state.currentList).toEqual(newList);
      expect(state.pastLists).toHaveLength(1);
      expect(state.pastLists[0]).toEqual(existingList);
    });

    it('should preserve all existing past lists', () => {
      const pastList1 = createMockShoppingList({ id: 'past-1' });
      const pastList2 = createMockShoppingList({ id: 'past-2' });
      const currentList = createMockShoppingList({ id: 'current' });
      const store = createTestStore({
        currentList,
        pastLists: [pastList1, pastList2],
        favoriteStores: ['Costco', 'Safeway', 'Whole Foods', 'Walmart'],
        priceHistory: {},
        loading: false,
        error: null,
      });

      const newList = createMockShoppingList({ id: 'new-list' });
      store.dispatch(createList(newList));
      const state = store.getState().shopping;

      expect(state.pastLists).toHaveLength(3);
      expect(state.pastLists).toContainEqual(pastList1);
      expect(state.pastLists).toContainEqual(pastList2);
      expect(state.pastLists).toContainEqual(currentList);
    });

    it('should handle creating list with pre-populated items and stores', () => {
      const store = createTestStore();
      const item = createMockShoppingItem();
      const storeAssignment = createMockStoreAssignment({ items: [item.id] });
      const newList = createMockShoppingList({
        items: [item],
        stores: [storeAssignment],
        totalEstimatedCost: 3.99,
      });

      store.dispatch(createList(newList));
      const state = store.getState().shopping;

      expect(state.currentList?.items).toHaveLength(1);
      expect(state.currentList?.stores).toHaveLength(1);
      expect(state.currentList?.totalEstimatedCost).toBe(3.99);
    });
  });

  // =============================================================================
  // SYNC REDUCERS - ITEM MANAGEMENT (6 tests)
  // =============================================================================
  describe('addItem reducer', () => {
    it('should add item to current list', () => {
      const list = createMockShoppingList();
      const store = createTestStore({ currentList: list });
      const newItem = createMockShoppingItem();

      store.dispatch(addItem(newItem));
      const state = store.getState().shopping;

      expect(state.currentList?.items).toHaveLength(1);
      expect(state.currentList?.items[0]).toEqual(newItem);
    });

    it('should update total estimated cost when adding item', () => {
      const list = createMockShoppingList({ totalEstimatedCost: 10.0 });
      const store = createTestStore({ currentList: list });
      const newItem = createMockShoppingItem({ estimatedPrice: 5.99 });

      store.dispatch(addItem(newItem));
      const state = store.getState().shopping;

      expect(state.currentList?.totalEstimatedCost).toBe(15.99);
    });

    it('should handle adding item without estimated price', () => {
      const list = createMockShoppingList({ totalEstimatedCost: 10.0 });
      const store = createTestStore({ currentList: list });
      const newItem = createMockShoppingItem({ estimatedPrice: undefined });

      store.dispatch(addItem(newItem));
      const state = store.getState().shopping;

      expect(state.currentList?.totalEstimatedCost).toBe(10.0);
      expect(state.currentList?.items).toHaveLength(1);
    });

    it('should do nothing when no current list exists', () => {
      const store = createTestStore();
      const newItem = createMockShoppingItem();

      store.dispatch(addItem(newItem));
      const state = store.getState().shopping;

      expect(state.currentList).toBeNull();
    });

    it('should add multiple items correctly', () => {
      const list = createMockShoppingList();
      const store = createTestStore({ currentList: list });
      const item1 = createMockShoppingItem({ id: 'item-1', estimatedPrice: 3.99 });
      const item2 = createMockShoppingItem({ id: 'item-2', estimatedPrice: 5.50 });

      store.dispatch(addItem(item1));
      store.dispatch(addItem(item2));
      const state = store.getState().shopping;

      expect(state.currentList?.items).toHaveLength(2);
      expect(state.currentList?.totalEstimatedCost).toBeCloseTo(9.49, 2);
    });

    it('should preserve item properties when adding', () => {
      const list = createMockShoppingList();
      const store = createTestStore({ currentList: list });
      const item = createMockShoppingItem({
        name: 'Organic Eggs',
        quantity: 2,
        unit: 'dozen',
        category: 'dairy',
        storeSection: 'Refrigerated',
        assignedStore: 'Whole Foods',
        checked: false,
      });

      store.dispatch(addItem(item));
      const state = store.getState().shopping;

      expect(state.currentList?.items[0]).toMatchObject({
        name: 'Organic Eggs',
        quantity: 2,
        unit: 'dozen',
        category: 'dairy',
        assignedStore: 'Whole Foods',
      });
    });
  });

  describe('removeItem reducer', () => {
    it('should remove item from current list', () => {
      const item = createMockShoppingItem({ id: 'item-1' });
      const list = createMockShoppingList({ items: [item], totalEstimatedCost: 3.99 });
      const store = createTestStore({ currentList: list });

      store.dispatch(removeItem('item-1'));
      const state = store.getState().shopping;

      expect(state.currentList?.items).toHaveLength(0);
    });

    it('should subtract item price from total estimated cost', () => {
      const item = createMockShoppingItem({ id: 'item-1', estimatedPrice: 5.99 });
      const list = createMockShoppingList({ items: [item], totalEstimatedCost: 10.0 });
      const store = createTestStore({ currentList: list });

      store.dispatch(removeItem('item-1'));
      const state = store.getState().shopping;

      expect(state.currentList?.totalEstimatedCost).toBeCloseTo(4.01, 2);
    });

    it('should handle removing item without estimated price', () => {
      const item = createMockShoppingItem({ id: 'item-1', estimatedPrice: undefined });
      const list = createMockShoppingList({ items: [item], totalEstimatedCost: 10.0 });
      const store = createTestStore({ currentList: list });

      store.dispatch(removeItem('item-1'));
      const state = store.getState().shopping;

      expect(state.currentList?.totalEstimatedCost).toBe(10.0);
      expect(state.currentList?.items).toHaveLength(0);
    });

    it('should not remove anything when item not found', () => {
      const item = createMockShoppingItem({ id: 'item-1', estimatedPrice: 5.99 });
      const list = createMockShoppingList({ items: [item], totalEstimatedCost: 5.99 });
      const store = createTestStore({ currentList: list });

      store.dispatch(removeItem('non-existent'));
      const state = store.getState().shopping;

      expect(state.currentList?.items).toHaveLength(1);
      expect(state.currentList?.totalEstimatedCost).toBe(5.99);
    });

    it('should remove only specified item from multiple items', () => {
      const item1 = createMockShoppingItem({ id: 'item-1', estimatedPrice: 3.99 });
      const item2 = createMockShoppingItem({ id: 'item-2', estimatedPrice: 5.50 });
      const list = createMockShoppingList({ items: [item1, item2], totalEstimatedCost: 9.49 });
      const store = createTestStore({ currentList: list });

      store.dispatch(removeItem('item-1'));
      const state = store.getState().shopping;

      expect(state.currentList?.items).toHaveLength(1);
      expect(state.currentList?.items[0].id).toBe('item-2');
      expect(state.currentList?.totalEstimatedCost).toBeCloseTo(5.50, 2);
    });
  });

  describe('toggleItemChecked reducer', () => {
    it('should toggle item checked status from false to true', () => {
      const item = createMockShoppingItem({ id: 'item-1', checked: false });
      const list = createMockShoppingList({ items: [item] });
      const store = createTestStore({ currentList: list });

      store.dispatch(toggleItemChecked('item-1'));
      const state = store.getState().shopping;

      expect(state.currentList?.items[0].checked).toBe(true);
    });

    it('should toggle item checked status from true to false', () => {
      const item = createMockShoppingItem({ id: 'item-1', checked: true });
      const list = createMockShoppingList({ items: [item] });
      const store = createTestStore({ currentList: list });

      store.dispatch(toggleItemChecked('item-1'));
      const state = store.getState().shopping;

      expect(state.currentList?.items[0].checked).toBe(false);
    });

    it('should only toggle specified item', () => {
      const item1 = createMockShoppingItem({ id: 'item-1', checked: false });
      const item2 = createMockShoppingItem({ id: 'item-2', checked: false });
      const list = createMockShoppingList({ items: [item1, item2] });
      const store = createTestStore({ currentList: list });

      store.dispatch(toggleItemChecked('item-1'));
      const state = store.getState().shopping;

      expect(state.currentList?.items[0].checked).toBe(true);
      expect(state.currentList?.items[1].checked).toBe(false);
    });

    it('should do nothing when item not found', () => {
      const item = createMockShoppingItem({ id: 'item-1', checked: false });
      const list = createMockShoppingList({ items: [item] });
      const store = createTestStore({ currentList: list });

      store.dispatch(toggleItemChecked('non-existent'));
      const state = store.getState().shopping;

      expect(state.currentList?.items[0].checked).toBe(false);
    });
  });

  // =============================================================================
  // SYNC REDUCERS - PRICE MANAGEMENT (2 tests)
  // =============================================================================
  describe('updateItemPrice reducer', () => {
    it('should update item actual price and add to price history', () => {
      const item = createMockShoppingItem({
        id: 'item-1',
        name: 'Milk',
        assignedStore: 'Costco',
      });
      const list = createMockShoppingList({ items: [item] });
      const store = createTestStore({
        currentList: list,
        pastLists: [],
        favoriteStores: ['Costco', 'Safeway', 'Whole Foods', 'Walmart'],
        priceHistory: {},
        loading: false,
        error: null,
      });

      store.dispatch(updateItemPrice({ itemId: 'item-1', actualPrice: 4.49 }));
      const state = store.getState().shopping;

      expect(state.currentList?.items[0].actualPrice).toBe(4.49);
      expect(state.priceHistory['Milk']).toBeDefined();
      expect(state.priceHistory['Milk']).toHaveLength(1);
      expect(state.priceHistory['Milk'][0]).toMatchObject({
        price: 4.49,
        store: 'Costco',
      });
    });

    it('should append to existing price history', () => {
      const item = createMockShoppingItem({
        id: 'item-1',
        name: 'Milk',
        assignedStore: 'Safeway',
      });
      const list = createMockShoppingList({ items: [item] });
      const existingHistory = {
        Milk: [
          { date: '2025-01-01T00:00:00.000Z', price: 3.99, store: 'Costco' },
        ],
      };
      const store = createTestStore({
        currentList: list,
        pastLists: [],
        favoriteStores: ['Costco', 'Safeway', 'Whole Foods', 'Walmart'],
        priceHistory: existingHistory,
        loading: false,
        error: null,
      });

      store.dispatch(updateItemPrice({ itemId: 'item-1', actualPrice: 4.29 }));
      const state = store.getState().shopping;

      expect(state.priceHistory['Milk']).toHaveLength(2);
      expect(state.priceHistory['Milk'][1]).toMatchObject({
        price: 4.29,
        store: 'Safeway',
      });
    });

    it('should use "Unknown" store if no assigned store', () => {
      const item = createMockShoppingItem({
        id: 'item-1',
        name: 'Milk',
        assignedStore: undefined,
      });
      const list = createMockShoppingList({ items: [item] });
      const store = createTestStore({
        currentList: list,
        pastLists: [],
        favoriteStores: ['Costco', 'Safeway', 'Whole Foods', 'Walmart'],
        priceHistory: {},
        loading: false,
        error: null,
      });

      store.dispatch(updateItemPrice({ itemId: 'item-1', actualPrice: 4.49 }));
      const state = store.getState().shopping;

      expect(state.priceHistory['Milk'][0].store).toBe('Unknown');
    });
  });

  // =============================================================================
  // SYNC REDUCERS - STORE ASSIGNMENT (3 tests)
  // =============================================================================
  describe('assignItemToStore reducer', () => {
    it('should assign item to new store and create store assignment', () => {
      const item = createMockShoppingItem({ id: 'item-1', estimatedPrice: 5.99 });
      const list = createMockShoppingList({ items: [item] });
      const store = createTestStore({ currentList: list });

      store.dispatch(
        assignItemToStore({
          itemId: 'item-1',
          storeId: 'store-costco',
          storeName: 'Costco',
        })
      );
      const state = store.getState().shopping;

      expect(state.currentList?.items[0].assignedStore).toBe('Costco');
      expect(state.currentList?.stores).toHaveLength(1);
      expect(state.currentList?.stores[0]).toMatchObject({
        storeId: 'store-costco',
        storeName: 'Costco',
        items: ['item-1'],
        estimatedTotal: 5.99,
      });
    });

    it('should reassign item from one store to another', () => {
      const item = createMockShoppingItem({ id: 'item-1', estimatedPrice: 5.99 });
      const storeAssignment = createMockStoreAssignment({
        storeId: 'store-walmart',
        storeName: 'Walmart',
        items: ['item-1'],
        estimatedTotal: 5.99,
      });
      const list = createMockShoppingList({
        items: [item],
        stores: [storeAssignment],
      });
      const store = createTestStore({ currentList: list });

      store.dispatch(
        assignItemToStore({
          itemId: 'item-1',
          storeId: 'store-costco',
          storeName: 'Costco',
        })
      );
      const state = store.getState().shopping;

      expect(state.currentList?.items[0].assignedStore).toBe('Costco');
      expect(state.currentList?.stores).toHaveLength(2);

      const walmartStore = state.currentList?.stores.find(s => s.storeId === 'store-walmart');
      const costcoStore = state.currentList?.stores.find(s => s.storeId === 'store-costco');

      expect(walmartStore?.items).toHaveLength(0);
      expect(walmartStore?.estimatedTotal).toBe(0);
      expect(costcoStore?.items).toContain('item-1');
      expect(costcoStore?.estimatedTotal).toBe(5.99);
    });

    it('should recalculate store totals correctly with multiple items', () => {
      const item1 = createMockShoppingItem({ id: 'item-1', estimatedPrice: 5.99 });
      const item2 = createMockShoppingItem({ id: 'item-2', estimatedPrice: 8.50 });
      const item3 = createMockShoppingItem({ id: 'item-3', estimatedPrice: 3.25 });
      const storeAssignment = createMockStoreAssignment({
        storeId: 'store-costco',
        storeName: 'Costco',
        items: ['item-1'],
        estimatedTotal: 5.99,
      });
      const list = createMockShoppingList({
        items: [item1, item2, item3],
        stores: [storeAssignment],
      });
      const store = createTestStore({ currentList: list });

      // Assign item-2 to Costco
      store.dispatch(
        assignItemToStore({
          itemId: 'item-2',
          storeId: 'store-costco',
          storeName: 'Costco',
        })
      );
      let state = store.getState().shopping;
      let costcoStore = state.currentList?.stores.find(s => s.storeId === 'store-costco');
      expect(costcoStore?.estimatedTotal).toBeCloseTo(14.49, 2);

      // Assign item-3 to Costco
      store.dispatch(
        assignItemToStore({
          itemId: 'item-3',
          storeId: 'store-costco',
          storeName: 'Costco',
        })
      );
      state = store.getState().shopping;
      costcoStore = state.currentList?.stores.find(s => s.storeId === 'store-costco');
      expect(costcoStore?.estimatedTotal).toBeCloseTo(17.74, 2);
    });

    it('should add to existing store assignment', () => {
      const item1 = createMockShoppingItem({ id: 'item-1', estimatedPrice: 5.99 });
      const item2 = createMockShoppingItem({ id: 'item-2', estimatedPrice: 3.50 });
      const storeAssignment = createMockStoreAssignment({
        storeId: 'store-costco',
        storeName: 'Costco',
        items: ['item-1'],
        estimatedTotal: 5.99,
      });
      const list = createMockShoppingList({
        items: [item1, item2],
        stores: [storeAssignment],
      });
      const store = createTestStore({ currentList: list });

      store.dispatch(
        assignItemToStore({
          itemId: 'item-2',
          storeId: 'store-costco',
          storeName: 'Costco',
        })
      );
      const state = store.getState().shopping;

      expect(state.currentList?.stores).toHaveLength(1);
      expect(state.currentList?.stores[0].items).toHaveLength(2);
      expect(state.currentList?.stores[0].items).toContain('item-1');
      expect(state.currentList?.stores[0].items).toContain('item-2');
      expect(state.currentList?.stores[0].estimatedTotal).toBeCloseTo(9.49, 2);
    });
  });

  // =============================================================================
  // SYNC REDUCERS - LIST STATUS (2 tests)
  // =============================================================================
  describe('setListStatus reducer', () => {
    it('should update list status to shopping', () => {
      const list = createMockShoppingList({ status: 'planning' });
      const store = createTestStore({ currentList: list });

      store.dispatch(setListStatus('shopping'));
      const state = store.getState().shopping;

      expect(state.currentList?.status).toBe('shopping');
    });

    it('should update list status to completed', () => {
      const list = createMockShoppingList({ status: 'shopping' });
      const store = createTestStore({ currentList: list });

      store.dispatch(setListStatus('completed'));
      const state = store.getState().shopping;

      expect(state.currentList?.status).toBe('completed');
    });
  });

  describe('completeList reducer', () => {
    it('should mark list as completed and move to past lists', () => {
      const list = createMockShoppingList({ status: 'shopping' });
      const store = createTestStore({
        currentList: list,
        pastLists: [],
        favoriteStores: ['Costco', 'Safeway', 'Whole Foods', 'Walmart'],
        priceHistory: {},
        loading: false,
        error: null,
      });

      store.dispatch(completeList());
      const state = store.getState().shopping;

      expect(state.currentList).toBeNull();
      expect(state.pastLists).toHaveLength(1);
      expect(state.pastLists[0].status).toBe('completed');
      expect(state.pastLists[0].id).toBe('list-1');
    });

    it('should do nothing when no current list exists', () => {
      const store = createTestStore({
        currentList: null,
        pastLists: [],
        favoriteStores: ['Costco', 'Safeway', 'Whole Foods', 'Walmart'],
        priceHistory: {},
        loading: false,
        error: null,
      });

      store.dispatch(completeList());
      const state = store.getState().shopping;

      expect(state.currentList).toBeNull();
      expect(state.pastLists).toHaveLength(0);
    });
  });

  // =============================================================================
  // SYNC REDUCERS - FAVORITE STORES (2 tests)
  // =============================================================================
  describe('addFavoriteStore reducer', () => {
    it('should add new favorite store', () => {
      const store = createTestStore();

      store.dispatch(addFavoriteStore('Trader Joes'));
      const state = store.getState().shopping;

      expect(state.favoriteStores).toHaveLength(5);
      expect(state.favoriteStores).toContain('Trader Joes');
    });

    it('should not add duplicate favorite store', () => {
      const store = createTestStore();

      store.dispatch(addFavoriteStore('Costco'));
      const state = store.getState().shopping;

      expect(state.favoriteStores).toHaveLength(4);
      expect(state.favoriteStores.filter(s => s === 'Costco')).toHaveLength(1);
    });
  });

  describe('removeFavoriteStore reducer', () => {
    it('should remove favorite store', () => {
      const store = createTestStore();

      store.dispatch(removeFavoriteStore('Costco'));
      const state = store.getState().shopping;

      expect(state.favoriteStores).toHaveLength(3);
      expect(state.favoriteStores).not.toContain('Costco');
    });

    it('should do nothing when store not in favorites', () => {
      const store = createTestStore();

      store.dispatch(removeFavoriteStore('Non-existent Store'));
      const state = store.getState().shopping;

      expect(state.favoriteStores).toHaveLength(4);
    });
  });

  // =============================================================================
  // SYNC REDUCERS - LOADING & ERROR (2 tests)
  // =============================================================================
  describe('setLoading and setError reducers', () => {
    it('should set loading state', () => {
      const store = createTestStore();

      store.dispatch(setLoading(true));
      let state = store.getState().shopping;
      expect(state.loading).toBe(true);

      store.dispatch(setLoading(false));
      state = store.getState().shopping;
      expect(state.loading).toBe(false);
    });

    it('should set error message', () => {
      const store = createTestStore();

      store.dispatch(setError('Network error'));
      let state = store.getState().shopping;
      expect(state.error).toBe('Network error');

      store.dispatch(setError(null));
      state = store.getState().shopping;
      expect(state.error).toBeNull();
    });
  });

  // =============================================================================
  // ASYNC THUNKS - fetchCurrentList (3 tests)
  // =============================================================================
  describe('fetchCurrentList async thunk', () => {
    it('should handle pending state', async () => {
      mockShoppingApi.getCurrentList.mockReturnValue(
        new Promise(() => {}) // Never resolves
      );

      const store = createTestStore();
      store.dispatch(fetchCurrentList());

      const state = store.getState().shopping;
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fulfilled state with data', async () => {
      const mockList = createMockShoppingList();
      mockShoppingApi.getCurrentList.mockResolvedValue({
        data: mockList,
        error: null,
        message: 'Success',
      });

      const store = createTestStore();
      await store.dispatch(fetchCurrentList());

      const state = store.getState().shopping;
      expect(state.loading).toBe(false);
      expect(state.currentList).toEqual(mockList);
      expect(state.error).toBeNull();
    });

    it('should handle rejected state with error', async () => {
      mockShoppingApi.getCurrentList.mockResolvedValue({
        data: null,
        error: 'Network error',
        message: 'Failed to fetch list',
      });

      const store = createTestStore();
      await store.dispatch(fetchCurrentList());

      const state = store.getState().shopping;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to fetch list');
    });
  });

  // =============================================================================
  // ASYNC THUNKS - createListAsync (2 tests)
  // =============================================================================
  describe('createListAsync async thunk', () => {
    it('should create list and move current to past', async () => {
      const currentList = createMockShoppingList({ id: 'old-list' });
      const newList = createMockShoppingList({ id: 'new-list' });
      mockShoppingApi.createList.mockResolvedValue({
        data: newList,
        error: null,
        message: 'Success',
      });

      const store = createTestStore({
        currentList,
        pastLists: [],
        favoriteStores: ['Costco', 'Safeway', 'Whole Foods', 'Walmart'],
        priceHistory: {},
        loading: false,
        error: null,
      });
      await store.dispatch(createListAsync(newList));

      const state = store.getState().shopping;
      expect(state.currentList).toEqual(newList);
      expect(state.pastLists).toHaveLength(1);
      expect(state.pastLists[0].id).toBe('old-list');
    });

    it('should handle error when creating list', async () => {
      const newList = createMockShoppingList();
      mockShoppingApi.createList.mockResolvedValue({
        data: null,
        error: 'Database error',
        message: 'Failed to create list',
      });

      const store = createTestStore();
      const result = await store.dispatch(createListAsync(newList));

      expect(result.type).toBe('shopping/createList/rejected');
    });
  });

  // =============================================================================
  // ASYNC THUNKS - addItemAsync (2 tests)
  // =============================================================================
  describe('addItemAsync async thunk', () => {
    it('should add item to current list on success', async () => {
      const list = createMockShoppingList();
      const newItem = createMockShoppingItem();
      mockShoppingApi.addItem.mockResolvedValue({
        data: newItem,
        error: null,
        message: 'Success',
      });

      const store = createTestStore({ currentList: list });
      await store.dispatch(addItemAsync({ listId: 'list-1', item: newItem }));

      const state = store.getState().shopping;
      expect(state.currentList?.items).toHaveLength(1);
      expect(state.currentList?.items[0]).toEqual(newItem);
    });

    it('should handle error when adding item', async () => {
      const list = createMockShoppingList();
      const newItem = createMockShoppingItem();
      mockShoppingApi.addItem.mockResolvedValue({
        data: null,
        error: 'Validation error',
        message: 'Item name required',
      });

      const store = createTestStore({ currentList: list });
      const result = await store.dispatch(
        addItemAsync({ listId: 'list-1', item: newItem })
      );

      expect(result.type).toBe('shopping/addItem/rejected');
    });
  });

  // =============================================================================
  // ASYNC THUNKS - updateItemAsync (2 tests)
  // =============================================================================
  describe('updateItemAsync async thunk', () => {
    it('should update item on success', async () => {
      const item = createMockShoppingItem({ id: 'item-1', quantity: 1 });
      const list = createMockShoppingList({ items: [item] });
      mockShoppingApi.updateItem.mockResolvedValue({
        data: { ...item, quantity: 2 },
        error: null,
        message: 'Success',
      });

      const store = createTestStore({ currentList: list });
      await store.dispatch(
        updateItemAsync({
          listId: 'list-1',
          itemId: 'item-1',
          updates: { quantity: 2 },
        })
      );

      const state = store.getState().shopping;
      expect(state.currentList?.items[0].quantity).toBe(2);
    });

    it('should handle error when updating item', async () => {
      const item = createMockShoppingItem();
      const list = createMockShoppingList({ items: [item] });
      mockShoppingApi.updateItem.mockResolvedValue({
        data: null,
        error: 'Not found',
        message: 'Item not found',
      });

      const store = createTestStore({ currentList: list });
      const result = await store.dispatch(
        updateItemAsync({
          listId: 'list-1',
          itemId: 'item-1',
          updates: { quantity: 2 },
        })
      );

      expect(result.type).toBe('shopping/updateItem/rejected');
    });
  });

  // =============================================================================
  // ASYNC THUNKS - removeItemAsync (2 tests)
  // =============================================================================
  describe('removeItemAsync async thunk', () => {
    it('should remove item on success', async () => {
      const item = createMockShoppingItem({ id: 'item-1' });
      const list = createMockShoppingList({ items: [item] });
      mockShoppingApi.removeItem.mockResolvedValue({
        data: { success: true },
        error: null,
        message: 'Success',
      });

      const store = createTestStore({ currentList: list });
      await store.dispatch(
        removeItemAsync({ listId: 'list-1', itemId: 'item-1' })
      );

      const state = store.getState().shopping;
      expect(state.currentList?.items).toHaveLength(0);
    });

    it('should handle error when removing item', async () => {
      const item = createMockShoppingItem({ id: 'item-1' });
      const list = createMockShoppingList({ items: [item] });
      mockShoppingApi.removeItem.mockResolvedValue({
        data: null,
        error: 'Not found',
        message: 'Item not found',
      });

      const store = createTestStore({ currentList: list });
      const result = await store.dispatch(
        removeItemAsync({ listId: 'list-1', itemId: 'item-1' })
      );

      expect(result.type).toBe('shopping/removeItem/rejected');
    });
  });

  // =============================================================================
  // ASYNC THUNKS - completeListAsync (2 tests)
  // =============================================================================
  describe('completeListAsync async thunk', () => {
    it('should complete list and move to past on success', async () => {
      const list = createMockShoppingList({ status: 'shopping' });
      mockShoppingApi.completeList.mockResolvedValue({
        data: { success: true },
        error: null,
        message: 'Success',
      });

      const store = createTestStore({
        currentList: list,
        pastLists: [],
        favoriteStores: ['Costco', 'Safeway', 'Whole Foods', 'Walmart'],
        priceHistory: {},
        loading: false,
        error: null,
      });
      await store.dispatch(completeListAsync('list-1'));

      const state = store.getState().shopping;
      expect(state.currentList).toBeNull();
      expect(state.pastLists).toHaveLength(1);
      expect(state.pastLists[0].status).toBe('completed');
    });

    it('should handle error when completing list', async () => {
      const list = createMockShoppingList({ status: 'shopping' });
      mockShoppingApi.completeList.mockResolvedValue({
        data: null,
        error: 'Server error',
        message: 'Failed to complete list',
      });

      const store = createTestStore({ currentList: list });
      const result = await store.dispatch(completeListAsync('list-1'));

      expect(result.type).toBe('shopping/completeList/rejected');
    });
  });

  // =============================================================================
  // ASYNC THUNKS - fetchPastLists (2 tests)
  // =============================================================================
  describe('fetchPastLists async thunk', () => {
    it('should fetch past lists successfully', async () => {
      const pastLists = [
        createMockShoppingList({ id: 'past-1', status: 'completed' }),
        createMockShoppingList({ id: 'past-2', status: 'completed' }),
      ];
      mockShoppingApi.getPastLists.mockResolvedValue({
        data: pastLists,
        error: null,
        message: 'Success',
      });

      const store = createTestStore();
      await store.dispatch(fetchPastLists(10));

      const state = store.getState().shopping;
      expect(state.pastLists).toEqual(pastLists);
    });

    it('should handle error when fetching past lists', async () => {
      mockShoppingApi.getPastLists.mockResolvedValue({
        data: null,
        error: 'Network error',
        message: 'Failed to fetch past lists',
      });

      const store = createTestStore();
      const result = await store.dispatch(fetchPastLists(10));

      expect(result.type).toBe('shopping/fetchPastLists/rejected');
    });
  });

  // =============================================================================
  // EDGE CASES & COMPLEX SCENARIOS (6 tests)
  // =============================================================================
  describe('Edge Cases', () => {
    it('should handle multiple item toggles correctly', () => {
      const item = createMockShoppingItem({ id: 'item-1', checked: false });
      const list = createMockShoppingList({ items: [item] });
      const store = createTestStore({ currentList: list });

      store.dispatch(toggleItemChecked('item-1'));
      store.dispatch(toggleItemChecked('item-1'));
      store.dispatch(toggleItemChecked('item-1'));

      const state = store.getState().shopping;
      expect(state.currentList?.items[0].checked).toBe(true);
    });

    it('should recalculate totals when reassigning items between stores', () => {
      const item1 = createMockShoppingItem({ id: 'item-1', estimatedPrice: 10.00 });
      const item2 = createMockShoppingItem({ id: 'item-2', estimatedPrice: 15.00 });
      const storeA = createMockStoreAssignment({
        storeId: 'store-a',
        storeName: 'Store A',
        items: ['item-1', 'item-2'],
        estimatedTotal: 25.00,
      });
      const list = createMockShoppingList({
        items: [item1, item2],
        stores: [storeA],
      });
      const store = createTestStore({ currentList: list });

      // Move item-2 to Store B
      store.dispatch(
        assignItemToStore({
          itemId: 'item-2',
          storeId: 'store-b',
          storeName: 'Store B',
        })
      );

      const state = store.getState().shopping;
      const storeAState = state.currentList?.stores.find(s => s.storeId === 'store-a');
      const storeBState = state.currentList?.stores.find(s => s.storeId === 'store-b');

      expect(storeAState?.estimatedTotal).toBe(10.00);
      expect(storeBState?.estimatedTotal).toBe(15.00);
      expect(storeAState?.items).toEqual(['item-1']);
      expect(storeBState?.items).toEqual(['item-2']);
    });

    it('should handle price history for same item at different stores', () => {
      const item = createMockShoppingItem({
        id: 'item-1',
        name: 'Bread',
        assignedStore: 'Costco',
      });
      const list = createMockShoppingList({ items: [item] });
      const store = createTestStore({
        currentList: list,
        pastLists: [],
        favoriteStores: ['Costco', 'Safeway', 'Whole Foods', 'Walmart'],
        priceHistory: {},
        loading: false,
        error: null,
      });

      store.dispatch(updateItemPrice({ itemId: 'item-1', actualPrice: 2.99 }));

      // Change store assignment
      store.dispatch(
        assignItemToStore({
          itemId: 'item-1',
          storeId: 'store-walmart',
          storeName: 'Walmart',
        })
      );

      store.dispatch(updateItemPrice({ itemId: 'item-1', actualPrice: 3.49 }));

      const state = store.getState().shopping;
      expect(state.priceHistory['Bread']).toHaveLength(2);
      expect(state.priceHistory['Bread'][0].store).toBe('Costco');
      expect(state.priceHistory['Bread'][0].price).toBe(2.99);
      expect(state.priceHistory['Bread'][1].store).toBe('Walmart');
      expect(state.priceHistory['Bread'][1].price).toBe(3.49);
    });

    it('should maintain total cost accuracy across multiple operations', () => {
      const list = createMockShoppingList({ totalEstimatedCost: 0 });
      const store = createTestStore({ currentList: list });

      const item1 = createMockShoppingItem({ id: 'item-1', estimatedPrice: 3.99 });
      const item2 = createMockShoppingItem({ id: 'item-2', estimatedPrice: 5.50 });
      const item3 = createMockShoppingItem({ id: 'item-3', estimatedPrice: 7.25 });

      store.dispatch(addItem(item1));
      store.dispatch(addItem(item2));
      store.dispatch(addItem(item3));
      store.dispatch(removeItem('item-2'));

      const state = store.getState().shopping;
      expect(state.currentList?.totalEstimatedCost).toBeCloseTo(11.24, 2);
    });

    it('should handle empty store totals when all items removed', () => {
      const item1 = createMockShoppingItem({ id: 'item-1', estimatedPrice: 5.00 });
      const item2 = createMockShoppingItem({ id: 'item-2', estimatedPrice: 7.00 });
      const storeAssignment = createMockStoreAssignment({
        storeId: 'store-costco',
        storeName: 'Costco',
        items: ['item-1', 'item-2'],
        estimatedTotal: 12.00,
      });
      const list = createMockShoppingList({
        items: [item1, item2],
        stores: [storeAssignment],
      });
      const store = createTestStore({ currentList: list });

      // Reassign both items to different store
      store.dispatch(
        assignItemToStore({
          itemId: 'item-1',
          storeId: 'store-walmart',
          storeName: 'Walmart',
        })
      );
      store.dispatch(
        assignItemToStore({
          itemId: 'item-2',
          storeId: 'store-walmart',
          storeName: 'Walmart',
        })
      );

      const state = store.getState().shopping;
      const costcoStore = state.currentList?.stores.find(s => s.storeId === 'store-costco');
      const walmartStore = state.currentList?.stores.find(s => s.storeId === 'store-walmart');

      expect(costcoStore?.estimatedTotal).toBe(0);
      expect(costcoStore?.items).toHaveLength(0);
      expect(walmartStore?.estimatedTotal).toBe(12.00);
      expect(walmartStore?.items).toHaveLength(2);
    });

    it('should handle creating multiple lists in sequence', () => {
      const store = createTestStore();

      const list1 = createMockShoppingList({ id: 'list-1', name: 'Week 1' });
      const list2 = createMockShoppingList({ id: 'list-2', name: 'Week 2' });
      const list3 = createMockShoppingList({ id: 'list-3', name: 'Week 3' });

      store.dispatch(createList(list1));
      store.dispatch(createList(list2));
      store.dispatch(createList(list3));

      const state = store.getState().shopping;

      expect(state.currentList?.id).toBe('list-3');
      expect(state.pastLists).toHaveLength(2);
      expect(state.pastLists[0].id).toBe('list-1');
      expect(state.pastLists[1].id).toBe('list-2');
    });
  });
});
