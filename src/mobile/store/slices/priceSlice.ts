/**
 * Price Intelligence Redux Slice
 * Manages price history, deals, and flyer data with real API integration
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';
import {
  PriceHistory,
  PricePoint,
  CrossStorePrice,
  DealQualityScore,
  StockUpRecommendation,
  DataQualityLevel,
} from '../../types/analytics.types';

// API base URL from environment
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://meal-api-production-8e80.up.railway.app';

// ============================================
// Types
// ============================================

export interface ExtractedDeal {
  productName: string;
  originalPrice?: number;
  salePrice: number;
  unit?: string;
  quantity?: number;
  category?: string;
  description?: string;
}

export interface FlyerUpload {
  id: string;
  retailerId: string;
  retailerName: string;
  startDate: string;
  endDate: string;
  dealsCount: number;
  uploadedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface PriceAlert {
  id: string;
  itemName: string;
  targetPrice: number;
  currentPrice: number;
  isTriggered: boolean;
  createdAt: string;
}

interface PriceState {
  // Price history data
  priceHistory: Record<string, PriceHistory>;
  crossStorePrices: Record<string, CrossStorePrice[]>;
  dealQuality: Record<string, DealQualityScore>;
  stockUpRecommendations: Record<string, StockUpRecommendation>;

  // Flyer management
  flyerUploads: FlyerUpload[];
  currentUpload: FlyerUpload | null;

  // Price alerts
  priceAlerts: PriceAlert[];

  // Supported retailers
  retailers: { id: string; name: string; logo?: string }[];

  // UI state
  loading: boolean;
  uploadProgress: number;
  error: string | null;
  lastSyncedAt: string | null;
}

const initialState: PriceState = {
  priceHistory: {},
  crossStorePrices: {},
  dealQuality: {},
  stockUpRecommendations: {},
  flyerUploads: [],
  currentUpload: null,
  priceAlerts: [],
  retailers: [
    { id: 'safeway', name: 'Safeway' },
    { id: 'costco', name: 'Costco' },
    { id: 'walmart', name: 'Walmart' },
    { id: 'target', name: 'Target' },
    { id: 'kroger', name: 'Kroger' },
    { id: 'whole_foods', name: 'Whole Foods' },
    { id: 'trader_joes', name: "Trader Joe's" },
    { id: 'aldi', name: 'Aldi' },
  ],
  loading: false,
  uploadProgress: 0,
  error: null,
  lastSyncedAt: null,
};

// ============================================
// Async Thunks
// ============================================

/**
 * Fetch price history for a specific product
 */
export const fetchPriceHistory = createAsyncThunk(
  'price/fetchHistory',
  async (productName: string, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `${API_URL}/api/prices/history/${encodeURIComponent(productName)}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch price history');
      }
      const data = await response.json();
      return { productName, data };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Ingest flyer deals from user upload
 */
export const ingestFlyerDeals = createAsyncThunk(
  'price/ingestFlyer',
  async (
    payload: {
      extractedDeals: ExtractedDeal[];
      retailerId: string;
      startDate: string;
      endDate: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`${API_URL}/api/prices/flyer/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to ingest flyer deals');
      }

      const data = await response.json();
      return {
        ...data,
        retailerId: payload.retailerId,
        startDate: payload.startDate,
        endDate: payload.endDate,
      };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Add a single deal manually
 */
export const addManualDeal = createAsyncThunk(
  'price/addManualDeal',
  async (
    deal: {
      productName: string;
      retailerId: string;
      originalPrice?: number;
      salePrice: number;
      startDate?: string;
      endDate?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`${API_URL}/api/prices/deals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deal),
      });

      if (!response.ok) {
        throw new Error('Failed to add deal');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Search for deals
 */
export const searchDeals = createAsyncThunk(
  'price/searchDeals',
  async (query: string, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `${API_URL}/api/prices/deals/search?query=${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        throw new Error('Failed to search deals');
      }
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Get best deals by category
 */
export const fetchBestDeals = createAsyncThunk(
  'price/fetchBestDeals',
  async (category: string | undefined, { rejectWithValue }) => {
    try {
      const url = category
        ? `${API_URL}/api/prices/deals/best?category=${encodeURIComponent(category)}`
        : `${API_URL}/api/prices/deals/best`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch best deals');
      }
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Get smart recommendations based on shopping list
 */
export const fetchSmartRecommendations = createAsyncThunk(
  'price/fetchRecommendations',
  async (
    payload: { shoppingList: string[]; preferences?: any },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`${API_URL}/api/prices/smart-recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Create a price alert
 */
export const createPriceAlert = createAsyncThunk(
  'price/createAlert',
  async (
    alert: { itemName: string; targetPrice: number },
    { rejectWithValue }
  ) => {
    // For now, store locally - can integrate with backend notifications later
    return {
      id: Date.now().toString(),
      ...alert,
      currentPrice: 0,
      isTriggered: false,
      createdAt: new Date().toISOString(),
    };
  }
);

// ============================================
// Slice
// ============================================

const priceSlice = createSlice({
  name: 'price',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUploadProgress: (state, action: PayloadAction<number>) => {
      state.uploadProgress = action.payload;
    },
    removePriceAlert: (state, action: PayloadAction<string>) => {
      state.priceAlerts = state.priceAlerts.filter(
        (alert) => alert.id !== action.payload
      );
    },
    updateAlertTriggerStatus: (
      state,
      action: PayloadAction<{ alertId: string; currentPrice: number }>
    ) => {
      const alert = state.priceAlerts.find(
        (a) => a.id === action.payload.alertId
      );
      if (alert) {
        alert.currentPrice = action.payload.currentPrice;
        alert.isTriggered = action.payload.currentPrice <= alert.targetPrice;
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch price history
    builder
      .addCase(fetchPriceHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPriceHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.priceHistory[action.payload.productName] = action.payload.data;
        state.lastSyncedAt = new Date().toISOString();
      })
      .addCase(fetchPriceHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Ingest flyer deals
    builder
      .addCase(ingestFlyerDeals.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.uploadProgress = 0;
      })
      .addCase(ingestFlyerDeals.fulfilled, (state, action) => {
        state.loading = false;
        state.uploadProgress = 100;
        const upload: FlyerUpload = {
          id: Date.now().toString(),
          retailerId: action.payload.retailerId,
          retailerName:
            state.retailers.find((r) => r.id === action.payload.retailerId)
              ?.name || action.payload.retailerId,
          startDate: action.payload.startDate,
          endDate: action.payload.endDate,
          dealsCount: action.payload.dealsIndexed || 0,
          uploadedAt: new Date().toISOString(),
          status: 'completed',
        };
        state.flyerUploads.unshift(upload);
        state.currentUpload = upload;
        state.lastSyncedAt = new Date().toISOString();
      })
      .addCase(ingestFlyerDeals.rejected, (state, action) => {
        state.loading = false;
        state.uploadProgress = 0;
        state.error = action.payload as string;
      });

    // Add manual deal
    builder
      .addCase(addManualDeal.pending, (state) => {
        state.loading = true;
      })
      .addCase(addManualDeal.fulfilled, (state) => {
        state.loading = false;
        state.lastSyncedAt = new Date().toISOString();
      })
      .addCase(addManualDeal.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Create price alert
    builder.addCase(createPriceAlert.fulfilled, (state, action) => {
      state.priceAlerts.push(action.payload);
    });
  },
});

// ============================================
// Selectors
// ============================================

export const selectPriceHistory = (state: RootState, productName: string) =>
  state.price?.priceHistory[productName];

export const selectCrossStorePrices = (state: RootState, productName: string) =>
  state.price?.crossStorePrices[productName] || [];

export const selectFlyerUploads = (state: RootState) =>
  state.price?.flyerUploads || [];

export const selectRetailers = (state: RootState) =>
  state.price?.retailers || [];

export const selectPriceAlerts = (state: RootState) =>
  state.price?.priceAlerts || [];

export const selectPriceLoading = (state: RootState) =>
  state.price?.loading || false;

export const selectUploadProgress = (state: RootState) =>
  state.price?.uploadProgress || 0;

export const selectPriceError = (state: RootState) => state.price?.error;

export const selectLastSyncedAt = (state: RootState) =>
  state.price?.lastSyncedAt;

// ============================================
// Exports
// ============================================

export const {
  clearError,
  setUploadProgress,
  removePriceAlert,
  updateAlertTriggerStatus,
} = priceSlice.actions;

export default priceSlice.reducer;
