import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { MealPattern, PatternId, PatternStats } from '../../types';
import { patternsApi } from '../../services/apiService';

// Pattern switch record for tracking mid-day switches
export interface PatternSwitchRecord {
  id: string;
  date: string;
  fromPattern: PatternId;
  toPattern: PatternId;
  switchTime: string;
  reason?: string;
  caloriesConsumedBefore: number;
  proteinConsumedBefore: number;
  recalculatedMeals: RecalculatedMeal[];
}

export interface RecalculatedMeal {
  mealType: 'morning' | 'noon' | 'evening';
  originalCalories: number;
  newCalories: number;
  originalProtein: number;
  newProtein: number;
  time: string;
  isRemaining: boolean;
}

export interface PendingSwitch {
  newPatternId: PatternId;
  previewData: PatternSwitchPreviewData;
  reason?: string;
}

export interface PatternSwitchPreviewData {
  currentPattern: MealPattern;
  newPattern: MealPattern;
  currentTime: string;
  caloriesConsumed: number;
  proteinConsumed: number;
  remainingMeals: RecalculatedMeal[];
  warnings: string[];
  inventorySufficient: boolean;
  missingIngredients: string[];
}

interface PatternsState {
  patterns: MealPattern[];
  selectedPattern: PatternId;
  weeklySchedule: { [date: string]: PatternId };
  patternStats: PatternStats[];
  switchHistory: PatternSwitchRecord[];
  pendingSwitch: PendingSwitch | null;
  todaySwitchCount: number;
  loading: boolean;
  error: string | null;
}

// Default patterns based on PRD
const defaultPatterns: MealPattern[] = [
  {
    id: 'A',
    name: 'Traditional',
    description: 'Regular schedule with consistent energy throughout the day. Ideal for office work.',
    optimalFor: ['Regular schedule', 'Consistent energy', 'Office work'],
    meals: {
      morning: { time: '7-8 AM', calories: 400, protein: 35, components: [] },
      noon: { time: '12-1 PM', calories: 850, protein: 60, components: [] },
      evening: { time: '6-7 PM', calories: 550, protein: 40, components: [] },
    },
    totalCalories: 1800,
    totalProtein: 135,
  },
  {
    id: 'B',
    name: 'Reversed',
    description: 'Light dinner preference with larger midday meal. Great for social lunches.',
    optimalFor: ['Light dinner', 'Business lunches', 'Social midday meals'],
    meals: {
      morning: { time: '7-8 AM', calories: 400, protein: 35, components: [] },
      noon: { time: '12-1 PM', calories: 550, protein: 55, components: [] },
      evening: { time: '6-7 PM', calories: 850, protein: 50, components: [] },
    },
    totalCalories: 1800,
    totalProtein: 140,
  },
  {
    id: 'C',
    name: 'Intermittent Fasting',
    description: '16:8 fasting window. Skip breakfast, eat within 8-hour window.',
    optimalFor: ['Fat burning', 'Mental clarity', 'Simplified planning'],
    meals: {
      morning: { time: 'Skip', calories: 0, protein: 0, components: [] },
      noon: { time: '12-1 PM', calories: 900, protein: 70, components: [] },
      evening: { time: '6-7 PM', calories: 900, protein: 65, components: [] },
    },
    totalCalories: 1800,
    totalProtein: 135,
  },
  {
    id: 'D',
    name: 'Grazing - 4 Mini Meals',
    description: 'Four evenly distributed smaller meals throughout the day for steady energy and blood sugar management.',
    optimalFor: ['Steady energy', 'Prevents hunger', 'Blood sugar management'],
    meals: {
      morning: { time: '7:00 AM', calories: 450, protein: 32, components: [] },
      midMorning: { time: '11:00 AM', calories: 450, protein: 35, components: [] },
      afternoon: { time: '3:00 PM', calories: 450, protein: 38, components: [] },
      evening: { time: '7:00 PM', calories: 450, protein: 25, components: [] },
    },
    totalCalories: 1800,
    totalProtein: 130,
  },
  {
    id: 'E',
    name: 'Grazing - Platter Method',
    description: 'All-day access to pre-portioned platter with organized stations for visual eaters.',
    optimalFor: ['Work from home', 'Visual eaters', 'Flexible schedule'],
    meals: {
      platter: {
        time: '7:00 AM - 8:00 PM',
        calories: 1800,
        protein: 135,
        components: [],
        style: 'platter',
        stations: ['proteins', 'carbs', 'vegetables', 'fats', 'fruits', 'flavors'],
      },
    },
    totalCalories: 1800,
    totalProtein: 135,
  },
  {
    id: 'F',
    name: 'Big Breakfast',
    description: 'Front-loaded calories with large morning meal for breakfast lovers and morning workout enthusiasts.',
    optimalFor: ['Morning workouts', 'Weekend leisure', 'Breakfast lovers'],
    meals: {
      morning: { time: '8:00 AM', calories: 850, protein: 58, components: [] },
      noon: { time: '12:00 PM', calories: 400, protein: 40, components: [] },
      evening: { time: '6:00 PM', calories: 550, protein: 40, components: [] },
    },
    totalCalories: 1800,
    totalProtein: 138,
  },
  {
    id: 'G',
    name: 'Morning Feast',
    description: 'Early eating window ending at 1 PM for reverse intermittent fasting with large morning appetite.',
    optimalFor: ['Reverse IF', 'Large morning appetite', 'Evening social plans'],
    meals: {
      morning: { time: '5:00 AM', calories: 600, protein: 40, components: [] },
      midMorning: { time: '9:00 AM', calories: 700, protein: 55, components: [] },
      noon: { time: '12:30 PM', calories: 500, protein: 47, components: [] },
    },
    totalCalories: 1800,
    totalProtein: 142,
    isFastingPattern: true,
    eatingWindowStart: '5:00 AM',
    eatingWindowEnd: '1:00 PM',
  },
];

const initialState: PatternsState = {
  patterns: defaultPatterns,
  selectedPattern: 'A',
  weeklySchedule: {},
  patternStats: [],
  switchHistory: [],
  pendingSwitch: null,
  todaySwitchCount: 0,
  loading: false,
  error: null,
};

// =============================================================================
// ASYNC THUNKS - API Integration
// =============================================================================

/**
 * Fetch all patterns from API
 */
export const fetchPatterns = createAsyncThunk<
  MealPattern[] | undefined,
  void,
  { rejectValue: string }
>(
  'patterns/fetchPatterns',
  async (_: void, { rejectWithValue }) => {
    const response = await patternsApi.getAll();
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

/**
 * Fetch user pattern preferences
 */
export const fetchUserPreferences = createAsyncThunk<
  { defaultPattern?: PatternId; weeklySchedule?: { [date: string]: PatternId } } | undefined,
  void,
  { rejectValue: string }
>(
  'patterns/fetchUserPreferences',
  async (_: void, { rejectWithValue }) => {
    const response = await patternsApi.getUserPreferences();
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

/**
 * Set default pattern for user
 */
export const setDefaultPattern = createAsyncThunk<
  PatternId,
  PatternId,
  { rejectValue: string }
>(
  'patterns/setDefaultPattern',
  async (patternCode: PatternId, { rejectWithValue }) => {
    const response = await patternsApi.setDefaultPattern(patternCode);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return patternCode;
  }
);

/**
 * Select pattern for today
 */
export const selectPatternForToday = createAsyncThunk<
  { patternCode: PatternId; [key: string]: unknown },
  { patternCode: PatternId; factors?: Record<string, unknown> },
  { rejectValue: string }
>(
  'patterns/selectPatternForToday',
  async (
    { patternCode, factors },
    { rejectWithValue }
  ) => {
    const response = await patternsApi.selectPatternForToday(patternCode, factors);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return { patternCode, ...(response.data || {}) };
  }
);

/**
 * Rate pattern after day completion
 */
export const ratePattern = createAsyncThunk<
  { date: string; ratings: Record<string, unknown> },
  { date: string; ratings: Record<string, unknown> },
  { rejectValue: string }
>(
  'patterns/ratePattern',
  async (
    { date, ratings },
    { rejectWithValue }
  ) => {
    const response = await patternsApi.ratePattern(date, ratings);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return { date, ratings };
  }
);

/**
 * Fetch pattern history
 */
export const fetchPatternHistory = createAsyncThunk<
  Array<{ date: string; patternCode: PatternId }> | undefined,
  { startDate?: string; endDate?: string; limit?: number } | undefined,
  { rejectValue: string }
>(
  'patterns/fetchPatternHistory',
  async (
    options = {},
    { rejectWithValue }
  ) => {
    const response = await patternsApi.getHistory(options);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

/**
 * Fetch pattern statistics
 */
export const fetchPatternStatistics = createAsyncThunk<
  PatternStats[] | undefined,
  number | undefined,
  { rejectValue: string }
>(
  'patterns/fetchPatternStatistics',
  async (days = 30, { rejectWithValue }) => {
    const response = await patternsApi.getStatistics(days);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

const patternsSlice = createSlice({
  name: 'patterns',
  initialState,
  reducers: {
    setSelectedPattern: (state, action: PayloadAction<PatternId>) => {
      state.selectedPattern = action.payload;
    },
    setPatternForDate: (
      state,
      action: PayloadAction<{ date: string; patternId: PatternId }>
    ) => {
      state.weeklySchedule[action.payload.date] = action.payload.patternId;
    },
    updatePatternStats: (state, action: PayloadAction<PatternStats>) => {
      const index = state.patternStats.findIndex(
        (s) => s.patternId === action.payload.patternId
      );
      if (index >= 0) {
        state.patternStats[index] = action.payload;
      } else {
        state.patternStats.push(action.payload);
      }
    },
    clearWeeklySchedule: (state) => {
      state.weeklySchedule = {};
    },
    // Pattern switching actions
    setPendingSwitch: (state, action: PayloadAction<PendingSwitch | null>) => {
      state.pendingSwitch = action.payload;
    },
    switchPattern: (
      state,
      action: PayloadAction<{
        newPatternId: PatternId;
        reason?: string;
        caloriesConsumed: number;
        proteinConsumed: number;
        recalculatedMeals: RecalculatedMeal[];
      }>
    ) => {
      const { newPatternId, reason, caloriesConsumed, proteinConsumed, recalculatedMeals } = action.payload;
      const now = new Date();

      // Create switch record
      const switchRecord: PatternSwitchRecord = {
        id: `switch-${Date.now()}`,
        date: now.toISOString().split('T')[0],
        fromPattern: state.selectedPattern,
        toPattern: newPatternId,
        switchTime: now.toISOString(),
        reason,
        caloriesConsumedBefore: caloriesConsumed,
        proteinConsumedBefore: proteinConsumed,
        recalculatedMeals,
      };

      // Update state
      state.switchHistory.push(switchRecord);
      state.selectedPattern = newPatternId;
      state.pendingSwitch = null;
      state.todaySwitchCount += 1;

      // Update weekly schedule for today
      const today = now.toISOString().split('T')[0];
      state.weeklySchedule[today] = newPatternId;
    },
    cancelPendingSwitch: (state) => {
      state.pendingSwitch = null;
    },
    resetDailySwitchCount: (state) => {
      state.todaySwitchCount = 0;
    },
    clearSwitchHistory: (state) => {
      state.switchHistory = [];
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
      // fetchPatterns
      .addCase(fetchPatterns.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPatterns.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          // Merge API patterns with defaults, API takes precedence
          const apiPatterns = action.payload as MealPattern[];
          const apiPatternIds = new Set(apiPatterns.map(p => p.id));
          const mergedPatterns = [
            ...apiPatterns,
            ...state.patterns.filter(p => !apiPatternIds.has(p.id))
          ];
          state.patterns = mergedPatterns;
        }
      })
      .addCase(fetchPatterns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchUserPreferences
      .addCase(fetchUserPreferences.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserPreferences.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          // Update state with user preferences
          const prefs = action.payload as any;
          if (prefs.defaultPattern) {
            state.selectedPattern = prefs.defaultPattern;
          }
          if (prefs.weeklySchedule) {
            state.weeklySchedule = prefs.weeklySchedule;
          }
        }
      })
      .addCase(fetchUserPreferences.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // setDefaultPattern
      .addCase(setDefaultPattern.fulfilled, (state, action) => {
        state.selectedPattern = action.payload;
      })
      .addCase(setDefaultPattern.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // selectPatternForToday
      .addCase(selectPatternForToday.pending, (state) => {
        state.loading = true;
      })
      .addCase(selectPatternForToday.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedPattern = action.payload.patternCode;
        const today = new Date().toISOString().split('T')[0];
        state.weeklySchedule[today] = action.payload.patternCode;
      })
      .addCase(selectPatternForToday.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // ratePattern
      .addCase(ratePattern.fulfilled, (state, action) => {
        // Could update pattern stats based on ratings
        console.log('Pattern rated:', action.payload);
      })
      // fetchPatternHistory
      .addCase(fetchPatternHistory.fulfilled, (state, action) => {
        if (action.payload) {
          // Update weekly schedule from history
          const history = action.payload as any[];
          history.forEach(entry => {
            if (entry.date && entry.patternCode) {
              state.weeklySchedule[entry.date] = entry.patternCode;
            }
          });
        }
      })
      // fetchPatternStatistics
      .addCase(fetchPatternStatistics.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPatternStatistics.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.patternStats = action.payload as PatternStats[];
        }
      })
      .addCase(fetchPatternStatistics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setSelectedPattern,
  setPatternForDate,
  updatePatternStats,
  clearWeeklySchedule,
  setPendingSwitch,
  switchPattern,
  cancelPendingSwitch,
  resetDailySwitchCount,
  clearSwitchHistory,
  setLoading,
  setError,
} = patternsSlice.actions;

// Selectors
export const selectPatterns = (state: { patterns: PatternsState }) => state.patterns.patterns;
export const selectSelectedPattern = (state: { patterns: PatternsState }) => state.patterns.selectedPattern;
export const selectPendingSwitch = (state: { patterns: PatternsState }) => state.patterns.pendingSwitch;
export const selectTodaySwitchCount = (state: { patterns: PatternsState }) => state.patterns.todaySwitchCount;
export const selectSwitchHistory = (state: { patterns: PatternsState }) => state.patterns.switchHistory;
export const selectCurrentPattern = (state: { patterns: PatternsState }) => {
  const selectedId = state.patterns.selectedPattern;
  return state.patterns.patterns.find(p => p.id === selectedId);
};

export default patternsSlice.reducer;
