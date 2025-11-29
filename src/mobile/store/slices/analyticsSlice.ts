import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  PatternEffectivenessMetrics,
  PatternRecommendation,
  DayOfWeekCorrelation,
  WeatherCorrelation,
  StressCorrelation,
  ScheduleCorrelation,
  PriceHistory,
  DealQualityScore,
} from '../../types/analytics.types';
import { PatternId, WeightEntry, DailyStats, PatternStats } from '../../types';
import { analyticsApi } from '../../services/apiService';

interface AnalyticsState {
  // Weight tracking
  weightEntries: WeightEntry[];
  targetWeight: number | null;

  // Pattern analytics
  dailyStats: DailyStats[];
  patternStats: PatternStats[];
  patternEffectiveness: PatternEffectivenessMetrics[];

  // Context correlations
  dayCorrelations: DayOfWeekCorrelation[];
  weatherCorrelations: WeatherCorrelation[];
  stressCorrelations: StressCorrelation[];
  scheduleCorrelations: ScheduleCorrelation[];

  // AI Recommendations
  currentRecommendation: PatternRecommendation | null;
  recommendationHistory: PatternRecommendation[];

  // Price intelligence
  priceHistories: { [itemName: string]: PriceHistory };
  dealScores: { [dealId: string]: DealQualityScore };

  // State management
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: AnalyticsState = {
  weightEntries: [],
  targetWeight: null,
  dailyStats: [],
  patternStats: [],
  patternEffectiveness: [],
  dayCorrelations: [],
  weatherCorrelations: [],
  stressCorrelations: [],
  scheduleCorrelations: [],
  currentRecommendation: null,
  recommendationHistory: [],
  priceHistories: {},
  dealScores: {},
  loading: false,
  error: null,
  lastUpdated: null,
};

// =============================================================================
// ASYNC THUNKS - API Integration
// =============================================================================

export const fetchPatternStats = createAsyncThunk(
  'analytics/fetchPatternStats',
  async (days: number = 30, { rejectWithValue }) => {
    const response = await analyticsApi.getPatternStats(days);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const fetchWeightTrend = createAsyncThunk(
  'analytics/fetchWeightTrend',
  async (_, { rejectWithValue }) => {
    const response = await analyticsApi.getWeightTrend();
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const fetchAdherenceStats = createAsyncThunk(
  'analytics/fetchAdherenceStats',
  async (options: { startDate?: string; endDate?: string } | undefined, { rejectWithValue }) => {
    const response = await analyticsApi.getAdherenceStats(options);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const fetchNutritionSummary = createAsyncThunk(
  'analytics/fetchNutritionSummary',
  async (date: string | undefined, { rejectWithValue }) => {
    const response = await analyticsApi.getNutritionSummary(date);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const fetchMLRecommendations = createAsyncThunk(
  'analytics/fetchMLRecommendations',
  async (_, { rejectWithValue }) => {
    const response = await analyticsApi.getMLRecommendations();
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const trainMLModel = createAsyncThunk(
  'analytics/trainMLModel',
  async (data: any, { rejectWithValue }) => {
    const response = await analyticsApi.trainModel(data);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    // Weight tracking
    addWeightEntry: (state, action: PayloadAction<WeightEntry>) => {
      state.weightEntries.push(action.payload);
      state.weightEntries.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    },

    updateWeightEntry: (
      state,
      action: PayloadAction<{ date: string; updates: Partial<WeightEntry> }>
    ) => {
      const index = state.weightEntries.findIndex(
        (e) => e.date === action.payload.date
      );
      if (index >= 0) {
        state.weightEntries[index] = {
          ...state.weightEntries[index],
          ...action.payload.updates,
        };
      }
    },

    deleteWeightEntry: (state, action: PayloadAction<string>) => {
      state.weightEntries = state.weightEntries.filter(
        (e) => e.date !== action.payload
      );
    },

    setTargetWeight: (state, action: PayloadAction<number | null>) => {
      state.targetWeight = action.payload;
    },

    // Daily stats
    addDailyStats: (state, action: PayloadAction<DailyStats>) => {
      const index = state.dailyStats.findIndex(
        (s) => s.date === action.payload.date
      );
      if (index >= 0) {
        state.dailyStats[index] = action.payload;
      } else {
        state.dailyStats.push(action.payload);
      }
      state.dailyStats.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    },

    // Pattern effectiveness
    setPatternEffectiveness: (
      state,
      action: PayloadAction<PatternEffectivenessMetrics[]>
    ) => {
      state.patternEffectiveness = action.payload;
    },

    updatePatternEffectiveness: (
      state,
      action: PayloadAction<PatternEffectivenessMetrics>
    ) => {
      const index = state.patternEffectiveness.findIndex(
        (p) => p.patternId === action.payload.patternId
      );
      if (index >= 0) {
        state.patternEffectiveness[index] = action.payload;
      } else {
        state.patternEffectiveness.push(action.payload);
      }
    },

    // Context correlations
    setDayCorrelations: (
      state,
      action: PayloadAction<DayOfWeekCorrelation[]>
    ) => {
      state.dayCorrelations = action.payload;
    },

    setWeatherCorrelations: (
      state,
      action: PayloadAction<WeatherCorrelation[]>
    ) => {
      state.weatherCorrelations = action.payload;
    },

    setStressCorrelations: (
      state,
      action: PayloadAction<StressCorrelation[]>
    ) => {
      state.stressCorrelations = action.payload;
    },

    setScheduleCorrelations: (
      state,
      action: PayloadAction<ScheduleCorrelation[]>
    ) => {
      state.scheduleCorrelations = action.payload;
    },

    // AI Recommendations
    setCurrentRecommendation: (
      state,
      action: PayloadAction<PatternRecommendation | null>
    ) => {
      if (state.currentRecommendation) {
        state.recommendationHistory.push(state.currentRecommendation);
      }
      state.currentRecommendation = action.payload;
    },

    acceptRecommendation: (state, action: PayloadAction<PatternId>) => {
      if (state.currentRecommendation) {
        state.recommendationHistory.push({
          ...state.currentRecommendation,
          // Could add accepted: true flag
        });
        state.currentRecommendation = null;
      }
    },

    rejectRecommendation: (state) => {
      if (state.currentRecommendation) {
        state.recommendationHistory.push({
          ...state.currentRecommendation,
          // Could add accepted: false flag
        });
        state.currentRecommendation = null;
      }
    },

    // Price intelligence
    setPriceHistory: (
      state,
      action: PayloadAction<{ itemName: string; history: PriceHistory }>
    ) => {
      state.priceHistories[action.payload.itemName] = action.payload.history;
    },

    addPricePoint: (
      state,
      action: PayloadAction<{
        itemName: string;
        price: number;
        store: string;
        isOnSale: boolean;
      }>
    ) => {
      const { itemName, price, store, isOnSale } = action.payload;
      const history = state.priceHistories[itemName];

      if (history) {
        history.points.push({
          id: `point-${Date.now()}`,
          itemName,
          price,
          store,
          date: new Date().toISOString(),
          isOnSale,
        });

        // Recalculate stats
        const prices = history.points.map((p) => p.price);
        history.averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        history.historicalLow = Math.min(...prices);
        history.historicalHigh = Math.max(...prices);
        history.currentPrice = price;

        // Update quality level
        const count = history.points.length;
        if (count >= 20) history.qualityLevel = 'mature';
        else if (count >= 10) history.qualityLevel = 'reliable';
        else if (count >= 5) history.qualityLevel = 'emerging';
        else history.qualityLevel = 'insufficient';

        history.pointsNeeded = Math.max(0, 20 - count);

        // Check for price drop alert
        if (price <= history.averagePrice * 0.8) {
          history.priceDropAlert = true;
          history.dropPercentage = ((history.averagePrice - price) / history.averagePrice) * 100;
        } else {
          history.priceDropAlert = false;
          history.dropPercentage = undefined;
        }
      }
    },

    setDealScore: (
      state,
      action: PayloadAction<{ dealId: string; score: DealQualityScore }>
    ) => {
      state.dealScores[action.payload.dealId] = action.payload.score;
    },

    // State management
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    updateLastUpdated: (state) => {
      state.lastUpdated = new Date().toISOString();
    },

    clearAnalytics: (state) => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchPatternStats
      .addCase(fetchPatternStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPatternStats.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.patternEffectiveness = action.payload as PatternEffectivenessMetrics[];
          state.lastUpdated = new Date().toISOString();
        }
      })
      .addCase(fetchPatternStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchWeightTrend
      .addCase(fetchWeightTrend.fulfilled, (state, action) => {
        if (action.payload) {
          const data = action.payload as any;
          if (data.entries) state.weightEntries = data.entries;
          if (data.targetWeight !== undefined) state.targetWeight = data.targetWeight;
          state.lastUpdated = new Date().toISOString();
        }
      })
      // fetchAdherenceStats
      .addCase(fetchAdherenceStats.fulfilled, (state, action) => {
        if (action.payload) {
          const data = action.payload as any;
          if (data.dailyStats) state.dailyStats = data.dailyStats;
          state.lastUpdated = new Date().toISOString();
        }
      })
      // fetchNutritionSummary
      .addCase(fetchNutritionSummary.fulfilled, (state, action) => {
        if (action.payload) {
          // Could store nutrition summary in state if needed
          console.log('Nutrition summary:', action.payload);
        }
      })
      // fetchMLRecommendations
      .addCase(fetchMLRecommendations.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMLRecommendations.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.currentRecommendation = action.payload as PatternRecommendation;
          state.lastUpdated = new Date().toISOString();
        }
      })
      .addCase(fetchMLRecommendations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // trainMLModel
      .addCase(trainMLModel.fulfilled, (state) => {
        console.log('ML model trained successfully');
      });
  },
});

export const {
  addWeightEntry,
  updateWeightEntry,
  deleteWeightEntry,
  setTargetWeight,
  addDailyStats,
  setPatternEffectiveness,
  updatePatternEffectiveness,
  setDayCorrelations,
  setWeatherCorrelations,
  setStressCorrelations,
  setScheduleCorrelations,
  setCurrentRecommendation,
  acceptRecommendation,
  rejectRecommendation,
  setPriceHistory,
  addPricePoint,
  setDealScore,
  setLoading,
  setError,
  updateLastUpdated,
  clearAnalytics,
} = analyticsSlice.actions;

// Selectors
export const selectWeightEntries = (state: { analytics: AnalyticsState }) =>
  state.analytics.weightEntries;
export const selectTargetWeight = (state: { analytics: AnalyticsState }) =>
  state.analytics.targetWeight;
export const selectPatternEffectiveness = (state: { analytics: AnalyticsState }) =>
  state.analytics.patternEffectiveness;
export const selectCurrentRecommendation = (state: { analytics: AnalyticsState }) =>
  state.analytics.currentRecommendation;
export const selectDayCorrelations = (state: { analytics: AnalyticsState }) =>
  state.analytics.dayCorrelations;
export const selectPriceHistory = (itemName: string) => (state: { analytics: AnalyticsState }) =>
  state.analytics.priceHistories[itemName];
export const selectDealScore = (dealId: string) => (state: { analytics: AnalyticsState }) =>
  state.analytics.dealScores[dealId];

// Computed selectors
export const selectWeightTrend = (state: { analytics: AnalyticsState }) => {
  const entries = state.analytics.weightEntries;
  if (entries.length < 2) return null;

  const recent = entries.slice(0, 7);
  const older = entries.slice(7, 14);

  if (older.length === 0) return null;

  const recentAvg = recent.reduce((sum, e) => sum + e.weight, 0) / recent.length;
  const olderAvg = older.reduce((sum, e) => sum + e.weight, 0) / older.length;

  return {
    change: recentAvg - olderAvg,
    percentChange: ((recentAvg - olderAvg) / olderAvg) * 100,
    direction: recentAvg < olderAvg ? 'down' : recentAvg > olderAvg ? 'up' : 'stable',
  };
};

export const selectBestPattern = (state: { analytics: AnalyticsState }) => {
  const effectiveness = state.analytics.patternEffectiveness;
  if (effectiveness.length === 0) return null;

  return effectiveness.reduce((best, current) =>
    current.successRate > best.successRate ? current : best
  );
};

export default analyticsSlice.reducer;
