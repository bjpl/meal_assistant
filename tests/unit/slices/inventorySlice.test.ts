import inventoryReducer, {
  addItem,
  updateItem,
  deleteItem,
  updateQuantity,
  consumeItem,
  moveItem,
  batchDelete,
  batchUpdateLocation,
  setItems,
  setLoading,
  setError,
  fetchInventory,
  addItemAsync,
  updateItemAsync,
  consumeItemAsync,
  deleteItemAsync,
  fetchExpiringItems,
  scanBarcodeAsync,
} from '../../../src/mobile/store/slices/inventorySlice';
import { InventoryItem } from '../../../src/mobile/types';
import { inventoryApi } from '../../../src/mobile/services/apiService';

// Mock the inventoryApi
jest.mock('../../../src/mobile/services/apiService', () => ({
  inventoryApi: {
    getAll: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    consumeItem: jest.fn(),
    deleteItem: jest.fn(),
    getExpiring: jest.fn(),
    scanBarcode: jest.fn(),
  },
}));

const mockInventoryApi = inventoryApi as jest.Mocked<typeof inventoryApi>;

describe('inventorySlice', () => {
  // =============================================================================
  // Test Fixtures
  // =============================================================================

  const mockItem: InventoryItem = {
    id: '1',
    name: 'Chicken Breast',
    category: 'protein',
    quantity: 500,
    unit: 'g',
    expiryDate: '2025-12-31',
    purchaseDate: '2025-11-20',
    location: 'fridge',
    barcode: '1234567890',
    pricePerUnit: 12.99,
    store: 'Whole Foods',
  };

  const mockItem2: InventoryItem = {
    id: '2',
    name: 'Rice',
    category: 'carb',
    quantity: 1000,
    unit: 'g',
    purchaseDate: '2025-11-15',
    location: 'pantry',
  };

  const mockItem3: InventoryItem = {
    id: '3',
    name: 'Frozen Peas',
    category: 'frozen',
    quantity: 300,
    unit: 'g',
    purchaseDate: '2025-11-10',
    location: 'freezer',
  };

  const initialState = {
    items: [],
    loading: false,
    error: null,
    lastUpdated: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // 1. Initial State Tests
  // =============================================================================

  describe('Initial State', () => {
    it('should return the correct initial state', () => {
      const state = inventoryReducer(undefined, { type: 'unknown' });
      expect(state).toEqual(initialState);
    });

    it('should have correct default values', () => {
      const state = inventoryReducer(undefined, { type: 'unknown' });
      expect(state.items).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastUpdated).toBeNull();
    });
  });

  // =============================================================================
  // 2. Synchronous Reducers Tests
  // =============================================================================

  describe('Synchronous Reducers', () => {
    describe('addItem', () => {
      it('should add item to state', () => {
        const previousState = { ...initialState };
        const state = inventoryReducer(previousState, addItem(mockItem));

        expect(state.items).toHaveLength(1);
        expect(state.items[0]).toEqual(mockItem);
        expect(state.lastUpdated).toBeTruthy();
        expect(state.lastUpdated).not.toBeNull();
      });

      it('should add multiple items to state', () => {
        let state = inventoryReducer(initialState, addItem(mockItem));
        state = inventoryReducer(state, addItem(mockItem2));

        expect(state.items).toHaveLength(2);
        expect(state.items[0].id).toBe('1');
        expect(state.items[1].id).toBe('2');
      });
    });

    describe('updateItem', () => {
      it('should update existing item', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const updatedItem: InventoryItem = {
          ...mockItem,
          quantity: 300,
          name: 'Turkey Breast',
        };

        const state = inventoryReducer(previousState, updateItem(updatedItem));

        expect(state.items).toHaveLength(1);
        expect(state.items[0].quantity).toBe(300);
        expect(state.items[0].name).toBe('Turkey Breast');
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should not modify state when item does not exist', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
          lastUpdated: '2025-11-20',
        };

        const nonExistentItem: InventoryItem = {
          ...mockItem,
          id: '999',
        };

        const state = inventoryReducer(previousState, updateItem(nonExistentItem));

        expect(state.items).toHaveLength(1);
        expect(state.items[0]).toEqual(mockItem);
      });
    });

    describe('deleteItem', () => {
      it('should remove item from state', () => {
        const previousState = {
          ...initialState,
          items: [mockItem, mockItem2],
        };

        const state = inventoryReducer(previousState, deleteItem('1'));

        expect(state.items).toHaveLength(1);
        expect(state.items[0].id).toBe('2');
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should handle deleting non-existent item', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const state = inventoryReducer(previousState, deleteItem('999'));

        expect(state.items).toHaveLength(1);
        expect(state.items[0]).toEqual(mockItem);
      });
    });

    describe('updateQuantity', () => {
      it('should update item quantity', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const state = inventoryReducer(
          previousState,
          updateQuantity({ id: '1', quantity: 750 })
        );

        expect(state.items[0].quantity).toBe(750);
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should not modify state when item does not exist', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const state = inventoryReducer(
          previousState,
          updateQuantity({ id: '999', quantity: 100 })
        );

        expect(state.items[0].quantity).toBe(500);
      });
    });

    describe('consumeItem', () => {
      it('should decrease quantity', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const state = inventoryReducer(
          previousState,
          consumeItem({ id: '1', amount: 200 })
        );

        expect(state.items[0].quantity).toBe(300);
        expect(state.items).toHaveLength(1);
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should remove item when quantity reaches 0', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const state = inventoryReducer(
          previousState,
          consumeItem({ id: '1', amount: 500 })
        );

        expect(state.items).toHaveLength(0);
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should remove item when consuming more than available', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const state = inventoryReducer(
          previousState,
          consumeItem({ id: '1', amount: 1000 })
        );

        expect(state.items).toHaveLength(0);
      });

      it('should not go below 0 quantity', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        // First consume to bring to 0
        const state = inventoryReducer(
          previousState,
          consumeItem({ id: '1', amount: 600 })
        );

        // Item should be removed, so length is 0
        expect(state.items).toHaveLength(0);
      });

      it('should not modify state when item does not exist', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const state = inventoryReducer(
          previousState,
          consumeItem({ id: '999', amount: 100 })
        );

        expect(state.items).toHaveLength(1);
        expect(state.items[0].quantity).toBe(500);
      });
    });

    describe('moveItem', () => {
      it('should change item location', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const state = inventoryReducer(
          previousState,
          moveItem({ id: '1', location: 'freezer' })
        );

        expect(state.items[0].location).toBe('freezer');
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should handle moving from fridge to pantry', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const state = inventoryReducer(
          previousState,
          moveItem({ id: '1', location: 'pantry' })
        );

        expect(state.items[0].location).toBe('pantry');
      });

      it('should not modify state when item does not exist', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const state = inventoryReducer(
          previousState,
          moveItem({ id: '999', location: 'freezer' })
        );

        expect(state.items[0].location).toBe('fridge');
      });
    });

    describe('batchDelete', () => {
      it('should remove multiple items', () => {
        const previousState = {
          ...initialState,
          items: [mockItem, mockItem2, mockItem3],
        };

        const state = inventoryReducer(
          previousState,
          batchDelete(['1', '3'])
        );

        expect(state.items).toHaveLength(1);
        expect(state.items[0].id).toBe('2');
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should handle empty batch delete', () => {
        const previousState = {
          ...initialState,
          items: [mockItem, mockItem2],
        };

        const state = inventoryReducer(previousState, batchDelete([]));

        expect(state.items).toHaveLength(2);
      });

      it('should handle deleting all items', () => {
        const previousState = {
          ...initialState,
          items: [mockItem, mockItem2],
        };

        const state = inventoryReducer(previousState, batchDelete(['1', '2']));

        expect(state.items).toHaveLength(0);
      });
    });

    describe('batchUpdateLocation', () => {
      it('should update multiple items location', () => {
        const previousState = {
          ...initialState,
          items: [mockItem, mockItem2, mockItem3],
        };

        const state = inventoryReducer(
          previousState,
          batchUpdateLocation({ ids: ['1', '2'], location: 'freezer' })
        );

        expect(state.items[0].location).toBe('freezer');
        expect(state.items[1].location).toBe('freezer');
        expect(state.items[2].location).toBe('freezer'); // Unchanged
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should handle empty batch update', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const state = inventoryReducer(
          previousState,
          batchUpdateLocation({ ids: [], location: 'freezer' })
        );

        expect(state.items[0].location).toBe('fridge');
      });

      it('should only update specified items', () => {
        const previousState = {
          ...initialState,
          items: [mockItem, mockItem2, mockItem3],
        };

        const state = inventoryReducer(
          previousState,
          batchUpdateLocation({ ids: ['2'], location: 'fridge' })
        );

        expect(state.items[0].location).toBe('fridge'); // Unchanged
        expect(state.items[1].location).toBe('fridge'); // Updated
        expect(state.items[2].location).toBe('freezer'); // Unchanged
      });
    });

    describe('setItems', () => {
      it('should replace entire items array', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const newItems = [mockItem2, mockItem3];
        const state = inventoryReducer(previousState, setItems(newItems));

        expect(state.items).toHaveLength(2);
        expect(state.items).toEqual(newItems);
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should handle setting empty array', () => {
        const previousState = {
          ...initialState,
          items: [mockItem, mockItem2],
        };

        const state = inventoryReducer(previousState, setItems([]));

        expect(state.items).toHaveLength(0);
      });
    });

    describe('setLoading', () => {
      it('should update loading state to true', () => {
        const state = inventoryReducer(initialState, setLoading(true));
        expect(state.loading).toBe(true);
      });

      it('should update loading state to false', () => {
        const previousState = {
          ...initialState,
          loading: true,
        };
        const state = inventoryReducer(previousState, setLoading(false));
        expect(state.loading).toBe(false);
      });
    });

    describe('setError', () => {
      it('should set error message', () => {
        const errorMessage = 'Failed to fetch inventory';
        const state = inventoryReducer(initialState, setError(errorMessage));
        expect(state.error).toBe(errorMessage);
      });

      it('should clear error when set to null', () => {
        const previousState = {
          ...initialState,
          error: 'Previous error',
        };
        const state = inventoryReducer(previousState, setError(null));
        expect(state.error).toBeNull();
      });
    });
  });

  // =============================================================================
  // 3. Async Thunk States Tests
  // =============================================================================

  describe('Async Thunks', () => {
    describe('fetchInventory', () => {
      it('should set loading on pending', () => {
        const action = { type: fetchInventory.pending.type };
        const state = inventoryReducer(initialState, action);

        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();
      });

      it('should set items on fulfilled', () => {
        const items = [mockItem, mockItem2];
        const action = {
          type: fetchInventory.fulfilled.type,
          payload: items,
        };
        const state = inventoryReducer(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.items).toEqual(items);
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should set error on rejected', () => {
        const errorMessage = 'Network error';
        const action = {
          type: fetchInventory.rejected.type,
          payload: errorMessage,
        };
        const state = inventoryReducer(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.error).toBe(errorMessage);
      });

      it('should handle fulfilled with null payload', () => {
        const action = {
          type: fetchInventory.fulfilled.type,
          payload: null,
        };
        const state = inventoryReducer(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.items).toEqual([]);
      });

      it('should call inventoryApi.getAll with correct parameters', async () => {
        mockInventoryApi.getAll.mockResolvedValue({
          success: true,
          data: [mockItem],
        });

        const dispatch = jest.fn();
        const thunk = fetchInventory({ category: 'protein', location: 'fridge' });
        await thunk(dispatch, () => ({}), undefined);

        expect(mockInventoryApi.getAll).toHaveBeenCalledWith({
          category: 'protein',
          location: 'fridge',
        });
      });
    });

    describe('addItemAsync', () => {
      it('should set loading on pending', () => {
        const action = { type: addItemAsync.pending.type };
        const state = inventoryReducer(initialState, action);

        expect(state.loading).toBe(true);
      });

      it('should add new item on fulfilled', () => {
        const newItem = mockItem;
        const action = {
          type: addItemAsync.fulfilled.type,
          payload: newItem,
        };
        const state = inventoryReducer(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.items).toHaveLength(1);
        expect(state.items[0]).toEqual(newItem);
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should set error on rejected', () => {
        const errorMessage = 'Failed to add item';
        const action = {
          type: addItemAsync.rejected.type,
          payload: errorMessage,
        };
        const state = inventoryReducer(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.error).toBe(errorMessage);
      });

      it('should call inventoryApi.addItem with correct parameters', async () => {
        const itemWithoutId = {
          name: mockItem.name,
          category: mockItem.category,
          quantity: mockItem.quantity,
          unit: mockItem.unit,
          purchaseDate: mockItem.purchaseDate,
          location: mockItem.location,
        };

        mockInventoryApi.addItem.mockResolvedValue({
          success: true,
          data: mockItem,
        });

        const dispatch = jest.fn();
        const thunk = addItemAsync(itemWithoutId as Omit<InventoryItem, 'id'>);
        await thunk(dispatch, () => ({}), undefined);

        expect(mockInventoryApi.addItem).toHaveBeenCalledWith(itemWithoutId);
      });
    });

    describe('updateItemAsync', () => {
      it('should update item on fulfilled', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const updates = { quantity: 300, name: 'Updated Chicken' };
        const action = {
          type: updateItemAsync.fulfilled.type,
          payload: { itemId: '1', updates },
        };
        const state = inventoryReducer(previousState, action);

        expect(state.items[0].quantity).toBe(300);
        expect(state.items[0].name).toBe('Updated Chicken');
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should not modify state when item does not exist', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const action = {
          type: updateItemAsync.fulfilled.type,
          payload: { itemId: '999', updates: { quantity: 100 } },
        };
        const state = inventoryReducer(previousState, action);

        expect(state.items[0]).toEqual(mockItem);
      });

      it('should call inventoryApi.updateItem with correct parameters', async () => {
        const updates = { quantity: 300 };
        mockInventoryApi.updateItem.mockResolvedValue({
          success: true,
          data: { ...mockItem, ...updates },
        });

        const dispatch = jest.fn();
        const thunk = updateItemAsync({ itemId: '1', updates });
        await thunk(dispatch, () => ({}), undefined);

        expect(mockInventoryApi.updateItem).toHaveBeenCalledWith('1', updates);
      });
    });

    describe('consumeItemAsync', () => {
      it('should decrease quantity on fulfilled', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const action = {
          type: consumeItemAsync.fulfilled.type,
          payload: { itemId: '1', quantity: 200 },
        };
        const state = inventoryReducer(previousState, action);

        expect(state.items[0].quantity).toBe(300);
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should remove item when quantity reaches 0', () => {
        const previousState = {
          ...initialState,
          items: [mockItem],
        };

        const action = {
          type: consumeItemAsync.fulfilled.type,
          payload: { itemId: '1', quantity: 500 },
        };
        const state = inventoryReducer(previousState, action);

        expect(state.items).toHaveLength(0);
      });

      it('should call inventoryApi.consumeItem with correct parameters', async () => {
        mockInventoryApi.consumeItem.mockResolvedValue({
          success: true,
          data: { ...mockItem, quantity: 300 },
        });

        const dispatch = jest.fn();
        const thunk = consumeItemAsync({ itemId: '1', quantity: 200 });
        await thunk(dispatch, () => ({}), undefined);

        expect(mockInventoryApi.consumeItem).toHaveBeenCalledWith('1', 200);
      });
    });

    describe('deleteItemAsync', () => {
      it('should remove item on fulfilled', () => {
        const previousState = {
          ...initialState,
          items: [mockItem, mockItem2],
        };

        const action = {
          type: deleteItemAsync.fulfilled.type,
          payload: '1',
        };
        const state = inventoryReducer(previousState, action);

        expect(state.items).toHaveLength(1);
        expect(state.items[0].id).toBe('2');
        expect(state.lastUpdated).toBeTruthy();
      });

      it('should call inventoryApi.deleteItem with correct parameters', async () => {
        mockInventoryApi.deleteItem.mockResolvedValue({
          success: true,
          data: null,
        });

        const dispatch = jest.fn();
        const thunk = deleteItemAsync('1');
        await thunk(dispatch, () => ({}), undefined);

        expect(mockInventoryApi.deleteItem).toHaveBeenCalledWith('1');
      });
    });

    describe('fetchExpiringItems', () => {
      it('should call inventoryApi.getExpiring with default hours', async () => {
        mockInventoryApi.getExpiring.mockResolvedValue({
          success: true,
          data: [mockItem],
        });

        const dispatch = jest.fn();
        const thunk = fetchExpiringItems();
        await thunk(dispatch, () => ({}), undefined);

        expect(mockInventoryApi.getExpiring).toHaveBeenCalledWith(48);
      });

      it('should call inventoryApi.getExpiring with custom hours', async () => {
        mockInventoryApi.getExpiring.mockResolvedValue({
          success: true,
          data: [mockItem],
        });

        const dispatch = jest.fn();
        const thunk = fetchExpiringItems(72);
        await thunk(dispatch, () => ({}), undefined);

        expect(mockInventoryApi.getExpiring).toHaveBeenCalledWith(72);
      });
    });

    describe('scanBarcodeAsync', () => {
      it('should return product info on fulfilled', () => {
        const productInfo = {
          barcode: '1234567890',
          name: 'Chicken Breast',
          category: 'protein',
        };

        const action = {
          type: scanBarcodeAsync.fulfilled.type,
          payload: productInfo,
        };

        // Mock console.log to verify it's called
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const state = inventoryReducer(initialState, action);

        expect(consoleSpy).toHaveBeenCalledWith('Barcode scanned:', productInfo);
        expect(state.items).toHaveLength(0); // Should not add to inventory

        consoleSpy.mockRestore();
      });

      it('should call inventoryApi.scanBarcode with correct parameters', async () => {
        const barcode = '1234567890';
        mockInventoryApi.scanBarcode.mockResolvedValue({
          success: true,
          data: { barcode, name: 'Test Product' },
        });

        const dispatch = jest.fn();
        const thunk = scanBarcodeAsync(barcode);
        await thunk(dispatch, () => ({}), undefined);

        expect(mockInventoryApi.scanBarcode).toHaveBeenCalledWith(barcode);
      });
    });
  });

  // =============================================================================
  // 4. Error Handling Tests
  // =============================================================================

  describe('Error Handling', () => {
    it('should handle API errors in fetchInventory', async () => {
      mockInventoryApi.getAll.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
        message: 'Database connection failed',
      });

      const dispatch = jest.fn();
      const thunk = fetchInventory();

      try {
        await thunk(dispatch, () => ({}), undefined);
      } catch (error) {
        // Expected to reject
      }

      expect(mockInventoryApi.getAll).toHaveBeenCalled();
    });

    it('should handle API errors in addItemAsync', async () => {
      const itemWithoutId = {
        name: 'Test Item',
        category: 'protein' as const,
        quantity: 100,
        unit: 'g',
        purchaseDate: '2025-11-20',
        location: 'fridge' as const,
      };

      mockInventoryApi.addItem.mockResolvedValue({
        success: false,
        error: 'Validation failed',
        message: 'Validation failed',
      });

      const dispatch = jest.fn();
      const thunk = addItemAsync(itemWithoutId);

      try {
        await thunk(dispatch, () => ({}), undefined);
      } catch (error) {
        // Expected to reject
      }

      expect(mockInventoryApi.addItem).toHaveBeenCalled();
    });
  });

  // =============================================================================
  // 5. Edge Cases
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle consuming item that does not exist', () => {
      const previousState = {
        ...initialState,
        items: [mockItem],
      };

      const state = inventoryReducer(
        previousState,
        consumeItem({ id: '999', amount: 100 })
      );

      expect(state.items).toHaveLength(1);
      expect(state.items[0].quantity).toBe(500);
    });

    it('should handle updating quantity of non-existent item', () => {
      const previousState = {
        ...initialState,
        items: [mockItem],
      };

      const state = inventoryReducer(
        previousState,
        updateQuantity({ id: '999', quantity: 100 })
      );

      expect(state.items).toHaveLength(1);
      expect(state.items[0].quantity).toBe(500);
    });

    it('should preserve other items when batch deleting', () => {
      const previousState = {
        ...initialState,
        items: [mockItem, mockItem2, mockItem3],
      };

      const state = inventoryReducer(previousState, batchDelete(['1']));

      expect(state.items).toHaveLength(2);
      expect(state.items.map(i => i.id)).toEqual(['2', '3']);
    });

    it('should handle lastUpdated being set on each operation', () => {
      let state = inventoryReducer(initialState, addItem(mockItem));
      const firstUpdate = state.lastUpdated;

      // Small delay to ensure different timestamp
      setTimeout(() => {
        state = inventoryReducer(state, updateQuantity({ id: '1', quantity: 600 }));
        const secondUpdate = state.lastUpdated;

        expect(firstUpdate).toBeTruthy();
        expect(secondUpdate).toBeTruthy();
      }, 10);
    });
  });
});
