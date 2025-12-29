import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { MealLog, DailyStats, WeightEntry } from '../../types';
import { mealsApi } from '../../services/apiService';
import { vectorSearchService, NLMealLogRequest, NLMealLogResponse } from '../../services/vectorSearchService';

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
    return { mealId, updates, ...(response.data as Record<string, unknown>) };
  }
);

/**
 * Fetch meal history
 */
export const fetchMealHistory = createAsyncThunk(
  'meals/fetchMealHistory',
  async (options: { startDate?: string; endDate?: string } | undefined, { rejectWithValue }) => {
    const response = await mealsApi.getMealHistory(options);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

/**
 * Log a meal using natural language description
 * Uses semantic vector search to parse and understand the meal
 */
export const logMealNaturalLanguage = createAsyncThunk(
  'meals/logMealNaturalLanguage',
  async (request: NLMealLogRequest, { rejectWithValue }) => {
    try {
      // Try server-side NL processing first
      const response = await vectorSearchService.logMealNL(request);
      return response;
    } catch (error) {
      // Fallback to local parsing if server unavailable
      console.warn('[NL Logging] Server unavailable, using local parsing');
      const localParsed = vectorSearchService.parseNLMealLocal(request.description);

      // Create a meal log from the local parsing (NL format differs from standard MealLog)
      const mealLog = {
        id: `local_${Date.now()}`,
        description: request.description,
        mealType: (localParsed.mealType || request.mealType || 'snack') as MealLog['mealType'],
        timestamp: request.timestamp || new Date(),
        photoUri: request.photoUri,
        foods: localParsed.foods?.map(f => ({
          name: f.name,
          quantity: f.quantity || 1,
          unit: 'serving',
          calories: f.calories || 0,
          protein: f.protein || 0,
          carbs: f.carbs || 0,
          fat: f.fat || 0
        })) || []
      };

      // Also try to log via regular API
      try {
        const apiResponse = await mealsApi.logMeal(mealLog as unknown as Omit<MealLog, 'id'>);
        if (!apiResponse.error && apiResponse.data) {
          return {
            mealLog: apiResponse.data as NLMealLogResponse['mealLog'],
            confidence: 0.7,
            suggestions: []
          };
        }
      } catch {
        // Ignore API error, return local result
      }

      return {
        mealLog: mealLog as unknown as NLMealLogResponse['mealLog'],
        confidence: 0.5, // Lower confidence for local parsing
        suggestions: ['Consider adding more details for better tracking']
      } as NLMealLogResponse;
    }
  }
);

/**
 * Search for meals using semantic search
 */
export const searchMealsSemantic = createAsyncThunk(
  'meals/searchSemantic',
  async (query: string, { rejectWithValue }) => {
    try {
      const results = await vectorSearchService.searchMeals({ query, limit: 10 });
      return results;
    } catch (error) {
      return rejectWithValue('Semantic search failed');
    }
  }
);

/**
 * Get recipe recommendations based on available ingredients
 */
export const getRecommendations = createAsyncThunk(
  'meals/getRecommendations',
  async (context: {
    availableIngredients?: string[];
    dietaryRestrictions?: string[];
    timeConstraint?: number;
  }, { rejectWithValue }) => {
    try {
      const recommendations = await vectorSearchService.getRecommendations(context);
      return recommendations;
    } catch (error) {
      return rejectWithValue('Failed to get recommendations');
    }
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
      })
      // logMealNaturalLanguage
      .addCase(logMealNaturalLanguage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logMealNaturalLanguage.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.mealLog) {
          const mealLog = action.payload.mealLog as unknown as MealLog;
          state.mealLogs.push(mealLog);
          if (mealLog.photoUri) {
            state.pendingUploads.push(mealLog.id);
          }
        }
      })
      .addCase(logMealNaturalLanguage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'NL meal logging failed';
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

// Selectors
export const selectMealLogs = (state: { meals: MealsState }) => state.meals.mealLogs;
export const selectMealsLoading = (state: { meals: MealsState }) => state.meals.loading;
export const selectDailyStats = (state: { meals: MealsState }) => state.meals.dailyStats;
export const selectWeightEntries = (state: { meals: MealsState }) => state.meals.weightEntries;

// Daily progress selector - calculates calories and protein consumed today
export const selectDailyProgress = (state: { meals: MealsState }) => {
  const today = new Date().toISOString().split('T')[0];
  const todaysMeals = state.meals.mealLogs.filter(meal => {
    const mealDate = new Date(meal.createdAt || '').toISOString().split('T')[0];
    return mealDate === today;
  });

  const consumed = todaysMeals.reduce((acc, meal) => {
    const mealCalories = meal.components?.reduce((sum: number, comp) => sum + (comp.calories || 0), 0) || 0;
    const mealProtein = meal.components?.reduce((sum: number, comp) => sum + (comp.protein || 0), 0) || 0;
    return {
      calories: acc.calories + mealCalories,
      protein: acc.protein + mealProtein,
    };
  }, { calories: 0, protein: 0 });

  return {
    calories: { consumed: consumed.calories, target: 1800 },
    protein: { consumed: consumed.protein, target: 135 },
    meals: { logged: todaysMeals.length, total: 3 },
  };
};

// Select available components for tracking - returns empty array as placeholder
// In production, this would come from patterns or a separate meals config
export const selectAvailableComponents = (state: { meals: MealsState }) => {
  // Default meal components for tracking
  return [
    { id: 'protein-1', name: 'Chicken Breast', category: 'protein' as const, calories: 165, protein: 31, portion: '4oz' },
    { id: 'protein-2', name: 'Salmon', category: 'protein' as const, calories: 208, protein: 20, portion: '4oz' },
    { id: 'carb-1', name: 'Brown Rice', category: 'carb' as const, calories: 216, protein: 5, portion: '1 cup' },
    { id: 'carb-2', name: 'Sweet Potato', category: 'carb' as const, calories: 103, protein: 2, portion: '1 medium' },
    { id: 'veg-1', name: 'Broccoli', category: 'vegetable' as const, calories: 55, protein: 4, portion: '1 cup' },
    { id: 'veg-2', name: 'Mixed Greens', category: 'vegetable' as const, calories: 10, protein: 1, portion: '2 cups' },
  ];
};

// Re-export async thunk with alternative name for compatibility
export const logMeal = logMealAsync;

export default mealsSlice.reducer;
