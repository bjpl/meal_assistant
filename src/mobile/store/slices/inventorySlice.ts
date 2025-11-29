import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { InventoryItem } from '../../types';
import { inventoryApi } from '../../services/apiService';

interface InventoryState {
  items: InventoryItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: InventoryState = {
  items: [],
  loading: false,
  error: null,
  lastUpdated: null,
};

// =============================================================================
// ASYNC THUNKS - API Integration
// =============================================================================

export const fetchInventory = createAsyncThunk(
  'inventory/fetchInventory',
  async (options: { category?: string; location?: string } | undefined, { rejectWithValue }) => {
    const response = await inventoryApi.getAll(options);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const addItemAsync = createAsyncThunk(
  'inventory/addItem',
  async (item: Omit<InventoryItem, 'id'>, { rejectWithValue }) => {
    const response = await inventoryApi.addItem(item);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const updateItemAsync = createAsyncThunk(
  'inventory/updateItem',
  async ({ itemId, updates }: { itemId: string; updates: Partial<InventoryItem> }, { rejectWithValue }) => {
    const response = await inventoryApi.updateItem(itemId, updates);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return { itemId, updates };
  }
);

export const consumeItemAsync = createAsyncThunk(
  'inventory/consumeItem',
  async ({ itemId, quantity }: { itemId: string; quantity: number }, { rejectWithValue }) => {
    const response = await inventoryApi.consumeItem(itemId, quantity);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return { itemId, quantity };
  }
);

export const deleteItemAsync = createAsyncThunk(
  'inventory/deleteItem',
  async (itemId: string, { rejectWithValue }) => {
    const response = await inventoryApi.deleteItem(itemId);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return itemId;
  }
);

export const fetchExpiringItems = createAsyncThunk(
  'inventory/fetchExpiring',
  async (hoursAhead: number = 48, { rejectWithValue }) => {
    const response = await inventoryApi.getExpiring(hoursAhead);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const scanBarcodeAsync = createAsyncThunk(
  'inventory/scanBarcode',
  async (barcode: string, { rejectWithValue }) => {
    const response = await inventoryApi.scanBarcode(barcode);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    addItem: (state, action: PayloadAction<InventoryItem>) => {
      state.items.push(action.payload);
      state.lastUpdated = new Date().toISOString();
    },
    updateItem: (state, action: PayloadAction<InventoryItem>) => {
      const index = state.items.findIndex((i) => i.id === action.payload.id);
      if (index >= 0) {
        state.items[index] = action.payload;
        state.lastUpdated = new Date().toISOString();
      }
    },
    deleteItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.id !== action.payload);
      state.lastUpdated = new Date().toISOString();
    },
    updateQuantity: (
      state,
      action: PayloadAction<{ id: string; quantity: number }>
    ) => {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (item) {
        item.quantity = action.payload.quantity;
        state.lastUpdated = new Date().toISOString();
      }
    },
    consumeItem: (
      state,
      action: PayloadAction<{ id: string; amount: number }>
    ) => {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (item) {
        item.quantity = Math.max(0, item.quantity - action.payload.amount);
        if (item.quantity === 0) {
          state.items = state.items.filter((i) => i.id !== action.payload.id);
        }
        state.lastUpdated = new Date().toISOString();
      }
    },
    moveItem: (
      state,
      action: PayloadAction<{
        id: string;
        location: InventoryItem['location'];
      }>
    ) => {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (item) {
        item.location = action.payload.location;
        state.lastUpdated = new Date().toISOString();
      }
    },
    batchDelete: (state, action: PayloadAction<string[]>) => {
      state.items = state.items.filter((i) => !action.payload.includes(i.id));
      state.lastUpdated = new Date().toISOString();
    },
    batchUpdateLocation: (
      state,
      action: PayloadAction<{
        ids: string[];
        location: InventoryItem['location'];
      }>
    ) => {
      state.items.forEach((item) => {
        if (action.payload.ids.includes(item.id)) {
          item.location = action.payload.location;
        }
      });
      state.lastUpdated = new Date().toISOString();
    },
    setItems: (state, action: PayloadAction<InventoryItem[]>) => {
      state.items = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchInventory
      .addCase(fetchInventory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInventory.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.items = action.payload as InventoryItem[];
          state.lastUpdated = new Date().toISOString();
        }
      })
      .addCase(fetchInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // addItemAsync
      .addCase(addItemAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(addItemAsync.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.items.push(action.payload as InventoryItem);
          state.lastUpdated = new Date().toISOString();
        }
      })
      .addCase(addItemAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // updateItemAsync
      .addCase(updateItemAsync.fulfilled, (state, action) => {
        const { itemId, updates } = action.payload;
        const index = state.items.findIndex(i => i.id === itemId);
        if (index >= 0) {
          state.items[index] = { ...state.items[index], ...updates };
          state.lastUpdated = new Date().toISOString();
        }
      })
      // consumeItemAsync
      .addCase(consumeItemAsync.fulfilled, (state, action) => {
        const { itemId, quantity } = action.payload;
        const item = state.items.find(i => i.id === itemId);
        if (item) {
          item.quantity = Math.max(0, item.quantity - quantity);
          if (item.quantity === 0) {
            state.items = state.items.filter(i => i.id !== itemId);
          }
          state.lastUpdated = new Date().toISOString();
        }
      })
      // deleteItemAsync
      .addCase(deleteItemAsync.fulfilled, (state, action) => {
        state.items = state.items.filter(i => i.id !== action.payload);
        state.lastUpdated = new Date().toISOString();
      })
      // scanBarcodeAsync
      .addCase(scanBarcodeAsync.fulfilled, (state, action) => {
        // Returns product info from barcode, UI should handle adding to inventory
        console.log('Barcode scanned:', action.payload);
      });
  },
});

export const {
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
} = inventorySlice.actions;

export default inventorySlice.reducer;
