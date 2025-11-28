import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { ShoppingList, ShoppingItem, StoreAssignment } from '../../types';
import { shoppingApi } from '../../services/apiService';

// =============================================================================
// ASYNC THUNKS - API Integration
// =============================================================================

export const fetchCurrentList = createAsyncThunk(
  'shopping/fetchCurrentList',
  async (_, { rejectWithValue }) => {
    const response = await shoppingApi.getCurrentList();
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const createListAsync = createAsyncThunk(
  'shopping/createList',
  async (list: Omit<ShoppingList, 'id'>, { rejectWithValue }) => {
    const response = await shoppingApi.createList(list);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const addItemAsync = createAsyncThunk(
  'shopping/addItem',
  async ({ listId, item }: { listId: string; item: Omit<ShoppingItem, 'id'> }, { rejectWithValue }) => {
    const response = await shoppingApi.addItem(listId, item);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const updateItemAsync = createAsyncThunk(
  'shopping/updateItem',
  async ({ listId, itemId, updates }: { listId: string; itemId: string; updates: Partial<ShoppingItem> }, { rejectWithValue }) => {
    const response = await shoppingApi.updateItem(listId, itemId, updates);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return { itemId, updates };
  }
);

export const removeItemAsync = createAsyncThunk(
  'shopping/removeItem',
  async ({ listId, itemId }: { listId: string; itemId: string }, { rejectWithValue }) => {
    const response = await shoppingApi.removeItem(listId, itemId);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return itemId;
  }
);

export const completeListAsync = createAsyncThunk(
  'shopping/completeList',
  async (listId: string, { rejectWithValue }) => {
    const response = await shoppingApi.completeList(listId);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return listId;
  }
);

export const fetchPastLists = createAsyncThunk(
  'shopping/fetchPastLists',
  async (limit: number = 10, { rejectWithValue }) => {
    const response = await shoppingApi.getPastLists(limit);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

interface ShoppingState {
  currentList: ShoppingList | null;
  pastLists: ShoppingList[];
  favoriteStores: string[];
  priceHistory: {
    [itemName: string]: { date: string; price: number; store: string }[];
  };
  loading: boolean;
  error: string | null;
}

const initialState: ShoppingState = {
  currentList: null,
  pastLists: [],
  favoriteStores: ['Costco', 'Safeway', 'Whole Foods', 'Walmart'],
  priceHistory: {},
  loading: false,
  error: null,
};

const shoppingSlice = createSlice({
  name: 'shopping',
  initialState,
  reducers: {
    createList: (state, action: PayloadAction<ShoppingList>) => {
      if (state.currentList) {
        state.pastLists.push(state.currentList);
      }
      state.currentList = action.payload;
    },
    addItem: (state, action: PayloadAction<ShoppingItem>) => {
      if (state.currentList) {
        state.currentList.items.push(action.payload);
        state.currentList.totalEstimatedCost += action.payload.estimatedPrice || 0;
      }
    },
    removeItem: (state, action: PayloadAction<string>) => {
      if (state.currentList) {
        const item = state.currentList.items.find(
          (i) => i.id === action.payload
        );
        if (item) {
          state.currentList.totalEstimatedCost -= item.estimatedPrice || 0;
        }
        state.currentList.items = state.currentList.items.filter(
          (i) => i.id !== action.payload
        );
      }
    },
    toggleItemChecked: (state, action: PayloadAction<string>) => {
      if (state.currentList) {
        const item = state.currentList.items.find(
          (i) => i.id === action.payload
        );
        if (item) {
          item.checked = !item.checked;
        }
      }
    },
    updateItemPrice: (
      state,
      action: PayloadAction<{ itemId: string; actualPrice: number }>
    ) => {
      if (state.currentList) {
        const item = state.currentList.items.find(
          (i) => i.id === action.payload.itemId
        );
        if (item) {
          item.actualPrice = action.payload.actualPrice;
          // Add to price history
          if (!state.priceHistory[item.name]) {
            state.priceHistory[item.name] = [];
          }
          state.priceHistory[item.name].push({
            date: new Date().toISOString(),
            price: action.payload.actualPrice,
            store: item.assignedStore || 'Unknown',
          });
        }
      }
    },
    assignItemToStore: (
      state,
      action: PayloadAction<{ itemId: string; storeId: string; storeName: string }>
    ) => {
      if (state.currentList) {
        const item = state.currentList.items.find(
          (i) => i.id === action.payload.itemId
        );
        if (item) {
          // Remove from previous store assignment
          state.currentList.stores.forEach((store) => {
            store.items = store.items.filter((id) => id !== action.payload.itemId);
          });

          // Add to new store
          let store = state.currentList.stores.find(
            (s) => s.storeId === action.payload.storeId
          );
          if (!store) {
            store = {
              storeId: action.payload.storeId,
              storeName: action.payload.storeName,
              items: [],
              estimatedTotal: 0,
            };
            state.currentList.stores.push(store);
          }
          store.items.push(action.payload.itemId);
          item.assignedStore = action.payload.storeName;

          // Recalculate store totals
          state.currentList.stores.forEach((s) => {
            s.estimatedTotal = state.currentList!.items
              .filter((i) => s.items.includes(i.id))
              .reduce((sum, i) => sum + (i.estimatedPrice || 0), 0);
          });
        }
      }
    },
    setListStatus: (
      state,
      action: PayloadAction<ShoppingList['status']>
    ) => {
      if (state.currentList) {
        state.currentList.status = action.payload;
      }
    },
    completeList: (state) => {
      if (state.currentList) {
        state.currentList.status = 'completed';
        state.pastLists.push(state.currentList);
        state.currentList = null;
      }
    },
    addFavoriteStore: (state, action: PayloadAction<string>) => {
      if (!state.favoriteStores.includes(action.payload)) {
        state.favoriteStores.push(action.payload);
      }
    },
    removeFavoriteStore: (state, action: PayloadAction<string>) => {
      state.favoriteStores = state.favoriteStores.filter(
        (s) => s !== action.payload
      );
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
      // fetchCurrentList
      .addCase(fetchCurrentList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrentList.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.currentList = action.payload as ShoppingList;
        }
      })
      .addCase(fetchCurrentList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // createListAsync
      .addCase(createListAsync.fulfilled, (state, action) => {
        if (state.currentList) {
          state.pastLists.push(state.currentList);
        }
        state.currentList = action.payload as ShoppingList;
      })
      // addItemAsync
      .addCase(addItemAsync.fulfilled, (state, action) => {
        if (state.currentList && action.payload) {
          state.currentList.items.push(action.payload as ShoppingItem);
        }
      })
      // updateItemAsync
      .addCase(updateItemAsync.fulfilled, (state, action) => {
        if (state.currentList) {
          const { itemId, updates } = action.payload;
          const index = state.currentList.items.findIndex(i => i.id === itemId);
          if (index >= 0) {
            state.currentList.items[index] = { ...state.currentList.items[index], ...updates };
          }
        }
      })
      // removeItemAsync
      .addCase(removeItemAsync.fulfilled, (state, action) => {
        if (state.currentList) {
          state.currentList.items = state.currentList.items.filter(i => i.id !== action.payload);
        }
      })
      // completeListAsync
      .addCase(completeListAsync.fulfilled, (state) => {
        if (state.currentList) {
          state.currentList.status = 'completed';
          state.pastLists.push(state.currentList);
          state.currentList = null;
        }
      })
      // fetchPastLists
      .addCase(fetchPastLists.fulfilled, (state, action) => {
        if (action.payload) {
          state.pastLists = action.payload as ShoppingList[];
        }
      });
  },
});

export const {
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
} = shoppingSlice.actions;

export default shoppingSlice.reducer;
