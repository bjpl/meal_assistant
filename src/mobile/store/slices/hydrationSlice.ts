import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  HydrationLog,
  HydrationGoals,
  HydrationTrendDay,
  BeverageType,
  CAFFEINE_CONTENT,
} from '../../types';
import { hydrationApi } from '../../services/apiService';

// ============================================
// State Interface
// ============================================
interface HydrationState {
  todayLogs: HydrationLog[];
  caffeineToday: number;
  waterToday: number;
  goal: HydrationGoals;
  trends: {
    weekly: HydrationTrendDay[];
    monthly: HydrationTrendDay[];
  };
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

// ============================================
// Initial State
// ============================================
const initialState: HydrationState = {
  todayLogs: [],
  caffeineToday: 0,
  waterToday: 0,
  goal: {
    daily_water_oz: 125, // Based on 250lb user (half body weight in oz)
    daily_caffeine_limit_mg: 400,
    caffeine_warning_mg: 300,
  },
  trends: {
    weekly: [],
    monthly: [],
  },
  loading: false,
  error: null,
  lastUpdated: null,
};

// =============================================================================
// ASYNC THUNKS - API Integration
// =============================================================================

export const fetchTodayProgress = createAsyncThunk(
  'hydration/fetchTodayProgress',
  async (_, { rejectWithValue }) => {
    const response = await hydrationApi.getTodayProgress();
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const fetchHydrationGoals = createAsyncThunk(
  'hydration/fetchGoals',
  async (_, { rejectWithValue }) => {
    const response = await hydrationApi.getGoals();
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const updateHydrationGoals = createAsyncThunk(
  'hydration/updateGoals',
  async (goals: Partial<HydrationGoals>, { rejectWithValue }) => {
    const response = await hydrationApi.updateGoals(goals);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return goals;
  }
);

export const logWaterAsync = createAsyncThunk(
  'hydration/logWater',
  async ({ amountOz, beverageType = 'water', notes }: { amountOz: number; beverageType?: string; notes?: string }, { rejectWithValue }) => {
    const response = await hydrationApi.logWater(amountOz, beverageType, notes);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const logCaffeineAsync = createAsyncThunk(
  'hydration/logCaffeine',
  async ({ beverageType, volumeOz, caffeineMg }: { beverageType: BeverageType; volumeOz: number; caffeineMg?: number }, { rejectWithValue }) => {
    const response = await hydrationApi.logCaffeine(beverageType, volumeOz, caffeineMg);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const fetchHydrationTrends = createAsyncThunk(
  'hydration/fetchTrends',
  async (_, { rejectWithValue }) => {
    const response = await hydrationApi.getTrends();
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

// ============================================
// Helper Functions
// ============================================
const generateId = (): string => {
  return `hydration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const calculateCaffeine = (type: BeverageType, amount_oz: number): number => {
  const baseAmount = CAFFEINE_CONTENT[type];
  if (baseAmount === 0) return 0;

  // Caffeine per oz for different beverages
  const caffeinePerOz: Record<string, number> = {
    coffee: 95 / 8, // 95mg per 8oz
    tea: 47 / 8, // 47mg per 8oz
    soda: 30 / 12, // 30mg per 12oz
    energy_drink: 150 / 8, // 150mg per 8oz
  };

  return Math.round((caffeinePerOz[type] || 0) * amount_oz);
};

const calculateTotals = (logs: HydrationLog[]) => {
  return logs.reduce(
    (acc, log) => ({
      water: acc.water + log.amount_oz,
      caffeine: acc.caffeine + log.caffeine_mg,
    }),
    { water: 0, caffeine: 0 }
  );
};

// ============================================
// Slice
// ============================================
const hydrationSlice = createSlice({
  name: 'hydration',
  initialState,
  reducers: {
    // Log water with amount in oz
    logWater: (state, action: PayloadAction<number>) => {
      const amount_oz = action.payload;
      const newLog: HydrationLog = {
        id: generateId(),
        type: 'water',
        amount_oz,
        caffeine_mg: 0,
        timestamp: new Date().toISOString(),
      };
      state.todayLogs.unshift(newLog);
      state.waterToday += amount_oz;
      state.lastUpdated = new Date().toISOString();
    },

    // Log caffeine beverage
    logCaffeine: (
      state,
      action: PayloadAction<{
        beverage_type: BeverageType;
        volume_oz: number;
        caffeine_mg?: number;
      }>
    ) => {
      const { beverage_type, volume_oz, caffeine_mg } = action.payload;
      const calculatedCaffeine = caffeine_mg ?? calculateCaffeine(beverage_type, volume_oz);

      const newLog: HydrationLog = {
        id: generateId(),
        type: beverage_type,
        amount_oz: volume_oz,
        caffeine_mg: calculatedCaffeine,
        timestamp: new Date().toISOString(),
      };

      state.todayLogs.unshift(newLog);
      state.waterToday += volume_oz;
      state.caffeineToday += calculatedCaffeine;
      state.lastUpdated = new Date().toISOString();
    },

    // Undo last entry
    undoLastEntry: (state) => {
      if (state.todayLogs.length === 0) return;

      const lastLog = state.todayLogs[0];
      state.todayLogs.shift();
      state.waterToday -= lastLog.amount_oz;
      state.caffeineToday -= lastLog.caffeine_mg;
      state.lastUpdated = new Date().toISOString();
    },

    // Delete specific entry
    deleteEntry: (state, action: PayloadAction<string>) => {
      const index = state.todayLogs.findIndex((log) => log.id === action.payload);
      if (index === -1) return;

      const log = state.todayLogs[index];
      state.todayLogs.splice(index, 1);
      state.waterToday -= log.amount_oz;
      state.caffeineToday -= log.caffeine_mg;
      state.lastUpdated = new Date().toISOString();
    },

    // Set today's logs (for fetching from API)
    setTodayLogs: (state, action: PayloadAction<HydrationLog[]>) => {
      state.todayLogs = action.payload;
      const totals = calculateTotals(action.payload);
      state.waterToday = totals.water;
      state.caffeineToday = totals.caffeine;
      state.lastUpdated = new Date().toISOString();
    },

    // Update goals
    setGoals: (state, action: PayloadAction<Partial<HydrationGoals>>) => {
      state.goal = { ...state.goal, ...action.payload };
    },

    // Set water goal based on body weight
    setWaterGoalFromWeight: (state, action: PayloadAction<number>) => {
      // Rule: half body weight in ounces
      state.goal.daily_water_oz = Math.round(action.payload / 2);
    },

    // Set trends data
    setWeeklyTrends: (state, action: PayloadAction<HydrationTrendDay[]>) => {
      state.trends.weekly = action.payload;
    },

    setMonthlyTrends: (state, action: PayloadAction<HydrationTrendDay[]>) => {
      state.trends.monthly = action.payload;
    },

    // Reset daily data (for new day)
    resetDaily: (state) => {
      state.todayLogs = [];
      state.waterToday = 0;
      state.caffeineToday = 0;
      state.lastUpdated = new Date().toISOString();
    },

    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    // Set error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchTodayProgress
      .addCase(fetchTodayProgress.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTodayProgress.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          const data = action.payload as any;
          if (data.logs) state.todayLogs = data.logs;
          if (data.waterToday !== undefined) state.waterToday = data.waterToday;
          if (data.caffeineToday !== undefined) state.caffeineToday = data.caffeineToday;
          state.lastUpdated = new Date().toISOString();
        }
      })
      .addCase(fetchTodayProgress.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchHydrationGoals
      .addCase(fetchHydrationGoals.fulfilled, (state, action) => {
        if (action.payload) {
          state.goal = { ...state.goal, ...(action.payload as Partial<HydrationGoals>) };
        }
      })
      // updateHydrationGoals
      .addCase(updateHydrationGoals.fulfilled, (state, action) => {
        state.goal = { ...state.goal, ...action.payload };
      })
      // logWaterAsync
      .addCase(logWaterAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(logWaterAsync.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          const log = action.payload as HydrationLog;
          state.todayLogs.unshift(log);
          state.waterToday += log.amount_oz;
          state.lastUpdated = new Date().toISOString();
        }
      })
      .addCase(logWaterAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // logCaffeineAsync
      .addCase(logCaffeineAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(logCaffeineAsync.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          const log = action.payload as HydrationLog;
          state.todayLogs.unshift(log);
          state.waterToday += log.amount_oz;
          state.caffeineToday += log.caffeine_mg;
          state.lastUpdated = new Date().toISOString();
        }
      })
      .addCase(logCaffeineAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchHydrationTrends
      .addCase(fetchHydrationTrends.fulfilled, (state, action) => {
        if (action.payload) {
          const data = action.payload as any;
          if (data.weekly) state.trends.weekly = data.weekly;
          if (data.monthly) state.trends.monthly = data.monthly;
        }
      });
  },
});

// ============================================
// Selectors
// ============================================
export const selectHydrationProgress = (state: { hydration: HydrationState }) => {
  const { waterToday, caffeineToday, goal, todayLogs } = state.hydration;

  let caffeine_status: 'safe' | 'warning' | 'limit' = 'safe';
  if (caffeineToday >= goal.daily_caffeine_limit_mg) {
    caffeine_status = 'limit';
  } else if (caffeineToday >= goal.caffeine_warning_mg) {
    caffeine_status = 'warning';
  }

  return {
    total_water_oz: waterToday,
    total_caffeine_mg: caffeineToday,
    percent_of_goal: Math.round((waterToday / goal.daily_water_oz) * 100),
    caffeine_status,
    entries_count: todayLogs.length,
  };
};

export const selectRemainingWater = (state: { hydration: HydrationState }) => {
  const { waterToday, goal } = state.hydration;
  return Math.max(0, goal.daily_water_oz - waterToday);
};

export const selectRemainingCaffeine = (state: { hydration: HydrationState }) => {
  const { caffeineToday, goal } = state.hydration;
  return Math.max(0, goal.daily_caffeine_limit_mg - caffeineToday);
};

export const selectCanHaveCaffeine = (state: { hydration: HydrationState }, amountMg: number) => {
  const remaining = selectRemainingCaffeine(state);
  const { caffeineToday, goal } = state.hydration;

  if (amountMg > remaining) {
    return {
      allowed: false,
      warning: `Would exceed daily limit by ${amountMg - remaining}mg`,
    };
  }

  if (caffeineToday + amountMg >= goal.caffeine_warning_mg) {
    return {
      allowed: true,
      warning: 'Approaching daily caffeine limit',
    };
  }

  return { allowed: true };
};

// ============================================
// Exports
// ============================================
export const {
  logWater,
  logCaffeine,
  undoLastEntry,
  deleteEntry,
  setTodayLogs,
  setGoals,
  setWaterGoalFromWeight,
  setWeeklyTrends,
  setMonthlyTrends,
  resetDaily,
  setLoading,
  setError,
} = hydrationSlice.actions;

export default hydrationSlice.reducer;
