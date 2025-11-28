import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { MealLog, DailyStats, WeightEntry } from '../../types';
import { mealsApi } from '../../services/apiService';

interface MealsState {
  mealLogs: MealLog[];
  dailyStats: DailyStats[];
  weightEntries: WeightEntry[];
  pendingUploads: string[]; // IDs of logs with photos pending upload
  loading: boolean;
  error: string | null;
}

const initialState: MealsState = {
  mealLogs: [],
  dailyStats: [],
  weightEntries: [],
  pendingUploads: [],
  loading: false,
  error: null,
};

// =============================================================================
// ASYNC THUNKS - API Integration
// =============================================================================

/**
 * Fetch today's meals from API
 */
export const fetchTodayMeals = createAsyncThunk(
  'meals/fetchTodayMeals',
  async (_, { rejectWithValue }) => {
    const response = await mealsApi.getTodayMeals();
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

/**
 * Log a new meal
 */
export const logMealAsync = createAsyncThunk(
  'meals/logMeal',
  async (mealData: Omit<MealLog, 'id'>, { rejectWithValue }) => {
    const response = await mealsApi.logMeal(mealData);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

/**
 * Update an existing meal
 */
export const updateMealAsync = createAsyncThunk(
  'meals/updateMeal',
  async ({ mealId, updates }: { mealId: string; updates: Partial<MealLog> }, { rejectWithValue }) => {
    const response = await mealsApi.updateMeal(mealId, updates);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return { mealId, updates, ...response.data };
  }
);

/**
 * Fetch meal history
 */
export const fetchMealHistory = createAsyncThunk(
  'meals/fetchMealHistory',
  async (options?: { startDate?: string; endDate?: string }, { rejectWithValue }) => {
    const response = await mealsApi.getMealHistory(options);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

const mealsSlice = createSlice({
  name: 'meals',
  initialState,
  reducers: {
    addMealLog: (state, action: PayloadAction<MealLog>) => {
      state.mealLogs.push(action.payload);
      // Add to pending if has photo
      if (action.payload.photoUri) {
        state.pendingUploads.push(action.payload.id);
      }
    },
    updateMealLog: (state, action: PayloadAction<MealLog>) => {
      const index = state.mealLogs.findIndex((m) => m.id === action.payload.id);
      if (index >= 0) {
        state.mealLogs[index] = action.payload;
      }
    },
    deleteMealLog: (state, action: PayloadAction<string>) => {
      state.mealLogs = state.mealLogs.filter((m) => m.id !== action.payload);
      state.pendingUploads = state.pendingUploads.filter(
        (id) => id !== action.payload
      );
    },
    updateDailyStats: (state, action: PayloadAction<DailyStats>) => {
      const index = state.dailyStats.findIndex(
        (s) => s.date === action.payload.date
      );
      if (index >= 0) {
        state.dailyStats[index] = action.payload;
      } else {
        state.dailyStats.push(action.payload);
      }
    },
    addWeightEntry: (state, action: PayloadAction<WeightEntry>) => {
      // Remove existing entry for same date if exists
      state.weightEntries = state.weightEntries.filter(
        (e) => e.date !== action.payload.date
      );
      state.weightEntries.push(action.payload);
      // Sort by date
      state.weightEntries.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    },
    deleteWeightEntry: (state, action: PayloadAction<string>) => {
      state.weightEntries = state.weightEntries.filter(
        (e) => e.date !== action.payload
      );
    },
    markUploadComplete: (state, action: PayloadAction<string>) => {
      state.pendingUploads = state.pendingUploads.filter(
        (id) => id !== action.payload
      );
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearMealLogs: (state) => {
      state.mealLogs = [];
      state.dailyStats = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchTodayMeals
      .addCase(fetchTodayMeals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTodayMeals.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.mealLogs = action.payload as MealLog[];
        }
      })
      .addCase(fetchTodayMeals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // logMealAsync
      .addCase(logMealAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(logMealAsync.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          const newMeal = action.payload as MealLog;
          state.mealLogs.push(newMeal);
          if (newMeal.photoUri) {
            state.pendingUploads.push(newMeal.id);
          }
        }
      })
      .addCase(logMealAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // updateMealAsync
      .addCase(updateMealAsync.fulfilled, (state, action) => {
        const { mealId, updates } = action.payload;
        const index = state.mealLogs.findIndex(m => m.id === mealId);
        if (index >= 0) {
          state.mealLogs[index] = { ...state.mealLogs[index], ...updates };
        }
      })
      .addCase(updateMealAsync.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // fetchMealHistory
      .addCase(fetchMealHistory.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMealHistory.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          // Merge with existing logs, avoiding duplicates
          const existingIds = new Set(state.mealLogs.map(m => m.id));
          const newLogs = (action.payload as MealLog[]).filter(m => !existingIds.has(m.id));
          state.mealLogs = [...state.mealLogs, ...newLogs];
        }
      })
      .addCase(fetchMealHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  addMealLog,
  updateMealLog,
  deleteMealLog,
  updateDailyStats,
  addWeightEntry,
  deleteWeightEntry,
  markUploadComplete,
  setLoading,
  setError,
  clearMealLogs,
} = mealsSlice.actions;

export default mealsSlice.reducer;
