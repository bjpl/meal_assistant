import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  SocialEvent,
  CalorieBankingStrategy,
  RecoveryPlan,
  EventMealType,
  CalorieEstimate,
  BankedMeal,
  RecoveryMeal,
  CALORIE_ESTIMATES,
} from '../../types/analytics.types';
import { PatternId } from '../../types';
import { eventsApi } from '../../services/apiService';

interface EventsState {
  events: SocialEvent[];
  strategies: { [eventId: string]: CalorieBankingStrategy };
  recoveryPlans: { [eventId: string]: RecoveryPlan };
  dailyBudget: number;
  loading: boolean;
  error: string | null;
}

const initialState: EventsState = {
  events: [],
  strategies: {},
  recoveryPlans: {},
  dailyBudget: 1800,
  loading: false,
  error: null,
};

// =============================================================================
// ASYNC THUNKS - API Integration
// =============================================================================

export const fetchEvents = createAsyncThunk(
  'events/fetchEvents',
  async (_, { rejectWithValue }) => {
    const response = await eventsApi.getEvents();
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const createEventAsync = createAsyncThunk(
  'events/createEvent',
  async (event: Omit<SocialEvent, 'id'>, { rejectWithValue }) => {
    const response = await eventsApi.createEvent(event);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const updateEventAsync = createAsyncThunk(
  'events/updateEvent',
  async ({ eventId, updates }: { eventId: string; updates: Partial<SocialEvent> }, { rejectWithValue }) => {
    const response = await eventsApi.updateEvent(eventId, updates);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return { eventId, updates };
  }
);

export const deleteEventAsync = createAsyncThunk(
  'events/deleteEvent',
  async (eventId: string, { rejectWithValue }) => {
    const response = await eventsApi.deleteEvent(eventId);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return eventId;
  }
);

export const fetchEventStrategy = createAsyncThunk(
  'events/fetchEventStrategy',
  async (eventId: string, { rejectWithValue }) => {
    const response = await eventsApi.getStrategy(eventId);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return { eventId, strategy: response.data };
  }
);

export const fetchRecoveryPlan = createAsyncThunk(
  'events/fetchRecoveryPlan',
  async (eventId: string, { rejectWithValue }) => {
    const response = await eventsApi.getRecoveryPlan(eventId);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return { eventId, plan: response.data };
  }
);

// Helper function to calculate banking strategy
const calculateBankingStrategy = (
  event: SocialEvent,
  dailyBudget: number
): CalorieBankingStrategy => {
  const eventCalories = event.estimatedCalories;

  // Calculate reductions for other meals (20% each)
  const morningOriginal = 400;
  const noonOriginal = 850;
  const morningReduced = Math.round(morningOriginal * 0.8);
  const noonReduced = Math.round(noonOriginal * 0.8);

  const totalReduction = (morningOriginal - morningReduced) + (noonOriginal - noonReduced);
  const baseEveningBudget = dailyBudget - morningOriginal - noonOriginal;
  const remainingForEvent = baseEveningBudget + totalReduction;

  const otherMeals: BankedMeal[] = [
    {
      mealType: 'morning',
      originalCalories: morningOriginal,
      reducedCalories: morningReduced,
      reductionPercent: 20,
      suggestedMeal: 'Greek yogurt with berries',
    },
    {
      mealType: 'noon',
      originalCalories: noonOriginal,
      reducedCalories: noonReduced,
      reductionPercent: 20,
      suggestedMeal: 'Large salad with grilled chicken',
    },
  ];

  const warnings: string[] = [];
  if (eventCalories > remainingForEvent) {
    warnings.push('Event calories exceed budget. Consider lighter options or adding exercise.');
  }
  if (eventCalories > 1200) {
    warnings.push('High calorie event. Plan for lighter meals the next day.');
  }

  return {
    eventId: event.id,
    eventCalories,
    dailyBudget,
    allocatedToEvent: Math.min(eventCalories, remainingForEvent),
    otherMeals,
    totalReduction,
    remainingForEvent,
    isAchievable: eventCalories <= remainingForEvent,
    warnings,
  };
};

// Helper function to generate recovery plan
const generateRecoveryPlan = (event: SocialEvent): RecoveryPlan => {
  const isHeavyMeal = event.estimatedCalories > 1000;

  const suggestedMeals: RecoveryMeal[] = isHeavyMeal
    ? [
        {
          mealType: 'morning',
          calories: 0,
          protein: 0,
          description: 'Skip breakfast - water, black coffee, or tea only',
          emphasis: 'hydration',
        },
        {
          mealType: 'noon',
          calories: 700,
          protein: 55,
          description: 'Large protein-focused salad with grilled chicken, vegetables, and light dressing',
          emphasis: 'protein',
        },
        {
          mealType: 'evening',
          calories: 600,
          protein: 50,
          description: 'Lean protein with steamed vegetables and small portion of whole grains',
          emphasis: 'fiber',
        },
      ]
    : [
        {
          mealType: 'morning',
          calories: 300,
          protein: 25,
          description: 'Light breakfast - eggs with vegetables',
          emphasis: 'protein',
        },
        {
          mealType: 'noon',
          calories: 600,
          protein: 50,
          description: 'Balanced meal with protein and vegetables',
          emphasis: 'fiber',
        },
        {
          mealType: 'evening',
          calories: 500,
          protein: 45,
          description: 'Light dinner with lean protein',
          emphasis: 'light',
        },
      ];

  return {
    eventId: event.id,
    nextDayPattern: isHeavyMeal ? 'C' : 'A',
    patternName: isHeavyMeal ? 'Intermittent Fasting' : 'Traditional',
    suggestedMeals,
    noWeighFor: 48,
    damageControlTips: [
      'Do not restrict calories severely - this can backfire',
      'Focus on high-protein, high-fiber meals to stay satiated',
      'Light activity like a 30-minute walk helps digestion',
      'Avoid the "all or nothing" mentality',
      'Return to your normal pattern by day 2',
    ],
    hydrationGoal: isHeavyMeal ? 100 : 80,
    activitySuggestion: '30-minute morning walk to aid digestion and boost metabolism',
  };
};

const eventsSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {
    createEvent: (state, action: PayloadAction<Omit<SocialEvent, 'id'>>) => {
      const event: SocialEvent = {
        ...action.payload,
        id: `event-${Date.now()}`,
      };
      state.events.push(event);

      // Auto-generate banking strategy
      state.strategies[event.id] = calculateBankingStrategy(event, state.dailyBudget);

      // Auto-generate recovery plan
      state.recoveryPlans[event.id] = generateRecoveryPlan(event);
    },

    updateEvent: (state, action: PayloadAction<SocialEvent>) => {
      const index = state.events.findIndex((e) => e.id === action.payload.id);
      if (index >= 0) {
        state.events[index] = action.payload;

        // Recalculate strategy and recovery
        state.strategies[action.payload.id] = calculateBankingStrategy(
          action.payload,
          state.dailyBudget
        );
        state.recoveryPlans[action.payload.id] = generateRecoveryPlan(action.payload);
      }
    },

    deleteEvent: (state, action: PayloadAction<string>) => {
      state.events = state.events.filter((e) => e.id !== action.payload);
      delete state.strategies[action.payload];
      delete state.recoveryPlans[action.payload];
    },

    updateBankingStrategy: (
      state,
      action: PayloadAction<{ eventId: string; updates: Partial<CalorieBankingStrategy> }>
    ) => {
      const { eventId, updates } = action.payload;
      if (state.strategies[eventId]) {
        state.strategies[eventId] = {
          ...state.strategies[eventId],
          ...updates,
        };
      }
    },

    updateRecoveryPlan: (
      state,
      action: PayloadAction<{ eventId: string; updates: Partial<RecoveryPlan> }>
    ) => {
      const { eventId, updates } = action.payload;
      if (state.recoveryPlans[eventId]) {
        state.recoveryPlans[eventId] = {
          ...state.recoveryPlans[eventId],
          ...updates,
        };
      }
    },

    setDailyBudget: (state, action: PayloadAction<number>) => {
      state.dailyBudget = action.payload;

      // Recalculate all strategies
      state.events.forEach((event) => {
        state.strategies[event.id] = calculateBankingStrategy(event, action.payload);
      });
    },

    markEventCompleted: (state, action: PayloadAction<string>) => {
      const event = state.events.find((e) => e.id === action.payload);
      if (event) {
        // Could add completed flag or move to history
        console.log('Event completed:', event.name);
      }
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    clearEvents: (state) => {
      state.events = [];
      state.strategies = {};
      state.recoveryPlans = {};
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchEvents
      .addCase(fetchEvents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.events = action.payload as SocialEvent[];
        }
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // createEventAsync
      .addCase(createEventAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(createEventAsync.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          const event = action.payload as SocialEvent;
          state.events.push(event);
          state.strategies[event.id] = calculateBankingStrategy(event, state.dailyBudget);
          state.recoveryPlans[event.id] = generateRecoveryPlan(event);
        }
      })
      .addCase(createEventAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // updateEventAsync
      .addCase(updateEventAsync.fulfilled, (state, action) => {
        const { eventId, updates } = action.payload;
        const index = state.events.findIndex(e => e.id === eventId);
        if (index >= 0) {
          state.events[index] = { ...state.events[index], ...updates } as SocialEvent;
          state.strategies[eventId] = calculateBankingStrategy(state.events[index], state.dailyBudget);
          state.recoveryPlans[eventId] = generateRecoveryPlan(state.events[index]);
        }
      })
      // deleteEventAsync
      .addCase(deleteEventAsync.fulfilled, (state, action) => {
        state.events = state.events.filter(e => e.id !== action.payload);
        delete state.strategies[action.payload];
        delete state.recoveryPlans[action.payload];
      })
      // fetchEventStrategy
      .addCase(fetchEventStrategy.fulfilled, (state, action) => {
        const { eventId, strategy } = action.payload;
        state.strategies[eventId] = strategy as CalorieBankingStrategy;
      })
      // fetchRecoveryPlan
      .addCase(fetchRecoveryPlan.fulfilled, (state, action) => {
        const { eventId, plan } = action.payload;
        state.recoveryPlans[eventId] = plan as RecoveryPlan;
      });
  },
});

export const {
  createEvent,
  updateEvent,
  deleteEvent,
  updateBankingStrategy,
  updateRecoveryPlan,
  setDailyBudget,
  markEventCompleted,
  setLoading,
  setError,
  clearEvents,
} = eventsSlice.actions;

// Selectors
export const selectEvents = (state: { events: EventsState }) => state.events.events;
export const selectUpcomingEvents = (state: { events: EventsState }) => {
  const now = new Date();
  return state.events.events.filter((e) => new Date(e.date) >= now);
};
export const selectEventById = (id: string) => (state: { events: EventsState }) =>
  state.events.events.find((e) => e.id === id);
export const selectStrategyForEvent = (eventId: string) => (state: { events: EventsState }) =>
  state.events.strategies[eventId];
export const selectRecoveryPlanForEvent = (eventId: string) => (state: { events: EventsState }) =>
  state.events.recoveryPlans[eventId];

export default eventsSlice.reducer;
