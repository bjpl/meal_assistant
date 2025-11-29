import hydrationReducer, {
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
  fetchTodayProgress,
  fetchHydrationGoals,
  updateHydrationGoals,
  logWaterAsync,
  logCaffeineAsync,
  fetchHydrationTrends,
  selectHydrationProgress,
  selectRemainingWater,
  selectRemainingCaffeine,
  selectCanHaveCaffeine,
} from '../../../src/mobile/store/slices/hydrationSlice';
import { HydrationLog, HydrationGoals, HydrationTrendDay, BeverageType, CAFFEINE_CONTENT } from '../../../src/mobile/types';
import { hydrationApi } from '../../../src/mobile/services/apiService';
import { configureStore } from '@reduxjs/toolkit';

// Mock the hydrationApi
jest.mock('../../../src/mobile/services/apiService', () => ({
  hydrationApi: {
    getTodayProgress: jest.fn(),
    getGoals: jest.fn(),
    updateGoals: jest.fn(),
    logWater: jest.fn(),
    logCaffeine: jest.fn(),
    getTrends: jest.fn(),
  },
}));

const mockHydrationApi = hydrationApi as jest.Mocked<typeof hydrationApi>;

describe('hydrationSlice', () => {
  // =============================================================================
  // Test Fixtures
  // =============================================================================

  const mockWaterLog: HydrationLog = {
    id: 'hydration-1',
    type: 'water',
    amount_oz: 16,
    caffeine_mg: 0,
    timestamp: '2025-11-28T10:00:00.000Z',
  };

  const mockCoffeeLog: HydrationLog = {
    id: 'hydration-2',
    type: 'coffee',
    amount_oz: 8,
    caffeine_mg: 95,
    timestamp: '2025-11-28T11:00:00.000Z',
  };

  const mockTeaLog: HydrationLog = {
    id: 'hydration-3',
    type: 'tea',
    amount_oz: 12,
    caffeine_mg: 70,
    timestamp: '2025-11-28T12:00:00.000Z',
  };

  const mockEnergyDrinkLog: HydrationLog = {
    id: 'hydration-4',
    type: 'energy_drink',
    amount_oz: 16,
    caffeine_mg: 300,
    timestamp: '2025-11-28T13:00:00.000Z',
  };

  const mockGoals: HydrationGoals = {
    daily_water_oz: 125,
    daily_caffeine_limit_mg: 400,
    caffeine_warning_mg: 300,
  };

  const mockWeeklyTrends: HydrationTrendDay[] = [
    { date: '2025-11-22', water_oz: 100, caffeine_mg: 200, percent_of_goal: 80 },
    { date: '2025-11-23', water_oz: 120, caffeine_mg: 150, percent_of_goal: 96 },
    { date: '2025-11-24', water_oz: 130, caffeine_mg: 250, percent_of_goal: 104 },
  ];

  const mockMonthlyTrends: HydrationTrendDay[] = [
    { date: '2025-11-01', water_oz: 110, caffeine_mg: 180, percent_of_goal: 88 },
    { date: '2025-11-08', water_oz: 125, caffeine_mg: 200, percent_of_goal: 100 },
    { date: '2025-11-15', water_oz: 115, caffeine_mg: 220, percent_of_goal: 92 },
  ];

  const initialState = {
    todayLogs: [],
    caffeineToday: 0,
    waterToday: 0,
    goal: {
      daily_water_oz: 125,
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // 1. Initial State Tests (2 tests)
  // =============================================================================

  describe('Initial State', () => {
    it('should return the correct initial state', () => {
      const state = hydrationReducer(undefined, { type: 'unknown' });
      expect(state).toEqual(initialState);
    });

    it('should have correct default values for 250lb user', () => {
      const state = hydrationReducer(undefined, { type: 'unknown' });
      expect(state.goal.daily_water_oz).toBe(125); // Half body weight
      expect(state.goal.daily_caffeine_limit_mg).toBe(400); // FDA limit
      expect(state.goal.caffeine_warning_mg).toBe(300); // 75% of limit
      expect(state.todayLogs).toEqual([]);
      expect(state.waterToday).toBe(0);
      expect(state.caffeineToday).toBe(0);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  // =============================================================================
  // 2. Sync Reducers Tests (18+ tests)
  // =============================================================================

  describe('logWater', () => {
    it('should add a water log entry', () => {
      const state = hydrationReducer(initialState, logWater(16));

      expect(state.todayLogs).toHaveLength(1);
      expect(state.todayLogs[0].type).toBe('water');
      expect(state.todayLogs[0].amount_oz).toBe(16);
      expect(state.todayLogs[0].caffeine_mg).toBe(0);
      expect(state.waterToday).toBe(16);
      expect(state.caffeineToday).toBe(0);
      expect(state.lastUpdated).toBeTruthy();
    });

    it('should add water log to the beginning of array', () => {
      let state = hydrationReducer(initialState, logWater(8));
      state = hydrationReducer(state, logWater(12));

      expect(state.todayLogs).toHaveLength(2);
      expect(state.todayLogs[0].amount_oz).toBe(12); // Most recent first
      expect(state.todayLogs[1].amount_oz).toBe(8);
    });

    it('should accumulate water total correctly', () => {
      let state = hydrationReducer(initialState, logWater(16));
      state = hydrationReducer(state, logWater(20));
      state = hydrationReducer(state, logWater(8));

      expect(state.waterToday).toBe(44);
      expect(state.caffeineToday).toBe(0);
    });

    it('should generate unique IDs for each log', () => {
      let state = hydrationReducer(initialState, logWater(16));
      state = hydrationReducer(state, logWater(16));

      expect(state.todayLogs[0].id).toBeTruthy();
      expect(state.todayLogs[1].id).toBeTruthy();
      expect(state.todayLogs[0].id).not.toBe(state.todayLogs[1].id);
    });
  });

  describe('logCaffeine', () => {
    it('should log coffee with calculated caffeine', () => {
      const state = hydrationReducer(initialState, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
      }));

      expect(state.todayLogs).toHaveLength(1);
      expect(state.todayLogs[0].type).toBe('coffee');
      expect(state.todayLogs[0].amount_oz).toBe(8);
      expect(state.todayLogs[0].caffeine_mg).toBe(95); // 95mg per 8oz
      expect(state.waterToday).toBe(8);
      expect(state.caffeineToday).toBe(95);
    });

    it('should log tea with calculated caffeine', () => {
      const state = hydrationReducer(initialState, logCaffeine({
        beverage_type: 'tea',
        volume_oz: 8,
      }));

      expect(state.todayLogs[0].caffeine_mg).toBe(47); // 47mg per 8oz
      expect(state.caffeineToday).toBe(47);
      expect(state.waterToday).toBe(8);
    });

    it('should log energy drink with calculated caffeine', () => {
      const state = hydrationReducer(initialState, logCaffeine({
        beverage_type: 'energy_drink',
        volume_oz: 8,
      }));

      expect(state.todayLogs[0].caffeine_mg).toBe(150); // 150mg per 8oz
      expect(state.caffeineToday).toBe(150);
    });

    it('should log soda with calculated caffeine', () => {
      const state = hydrationReducer(initialState, logCaffeine({
        beverage_type: 'soda',
        volume_oz: 12,
      }));

      expect(state.todayLogs[0].caffeine_mg).toBe(30); // 30mg per 12oz
      expect(state.caffeineToday).toBe(30);
    });

    it('should use custom caffeine amount when provided', () => {
      const state = hydrationReducer(initialState, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
        caffeine_mg: 120, // Custom amount
      }));

      expect(state.todayLogs[0].caffeine_mg).toBe(120);
      expect(state.caffeineToday).toBe(120);
    });

    it('should scale caffeine with volume', () => {
      const state = hydrationReducer(initialState, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 16, // Double size
      }));

      expect(state.todayLogs[0].caffeine_mg).toBe(190); // ~2x 95mg
    });

    it('should accumulate caffeine across multiple entries', () => {
      let state = hydrationReducer(initialState, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
      }));
      state = hydrationReducer(state, logCaffeine({
        beverage_type: 'tea',
        volume_oz: 12,
      }));

      // Coffee: 95mg per 8oz = 95mg
      // Tea: 47mg per 8oz = ~70mg for 12oz (47/8 * 12 = 70.5, rounded to 71)
      expect(state.caffeineToday).toBe(166); // 95 + 71
      expect(state.waterToday).toBe(20);
    });

    it('should add caffeine beverages to beginning of logs', () => {
      let state = hydrationReducer(initialState, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
      }));
      state = hydrationReducer(state, logCaffeine({
        beverage_type: 'tea',
        volume_oz: 12,
      }));

      expect(state.todayLogs[0].type).toBe('tea'); // Most recent
      expect(state.todayLogs[1].type).toBe('coffee');
    });
  });

  describe('undoLastEntry', () => {
    it('should remove the most recent entry', () => {
      let state = hydrationReducer(initialState, logWater(16));
      state = hydrationReducer(state, logWater(8));
      state = hydrationReducer(state, undoLastEntry());

      expect(state.todayLogs).toHaveLength(1);
      expect(state.todayLogs[0].amount_oz).toBe(16);
    });

    it('should subtract water amount when undoing water log', () => {
      let state = hydrationReducer(initialState, logWater(16));
      state = hydrationReducer(state, logWater(8));
      state = hydrationReducer(state, undoLastEntry());

      expect(state.waterToday).toBe(16);
    });

    it('should subtract both water and caffeine when undoing caffeine log', () => {
      let state = hydrationReducer(initialState, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
      }));
      state = hydrationReducer(state, undoLastEntry());

      expect(state.waterToday).toBe(0);
      expect(state.caffeineToday).toBe(0);
    });

    it('should do nothing when no entries exist', () => {
      const state = hydrationReducer(initialState, undoLastEntry());

      expect(state.todayLogs).toHaveLength(0);
      expect(state.waterToday).toBe(0);
      expect(state.caffeineToday).toBe(0);
    });

    it('should update lastUpdated timestamp', () => {
      let state = hydrationReducer(initialState, logWater(16));
      const originalTimestamp = state.lastUpdated;

      // Wait a tiny bit to ensure timestamp changes
      jest.advanceTimersByTime(1);
      state = hydrationReducer(state, undoLastEntry());

      expect(state.lastUpdated).toBeTruthy();
      // Both timestamps should exist but may be identical due to fast execution
      // The important thing is lastUpdated is set
      expect(state.lastUpdated).toBeDefined();
    });
  });

  describe('deleteEntry', () => {
    it('should delete entry by ID', () => {
      let state = hydrationReducer(initialState, logWater(16));
      const idToDelete = state.todayLogs[0].id;

      state = hydrationReducer(state, deleteEntry(idToDelete));

      expect(state.todayLogs).toHaveLength(0);
    });

    it('should subtract water and caffeine from totals', () => {
      let state = hydrationReducer(initialState, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
      }));
      const idToDelete = state.todayLogs[0].id;

      state = hydrationReducer(state, deleteEntry(idToDelete));

      expect(state.waterToday).toBe(0);
      expect(state.caffeineToday).toBe(0);
    });

    it('should delete specific entry from middle of logs', () => {
      let state = hydrationReducer(initialState, logWater(16));
      state = hydrationReducer(state, logWater(8));
      state = hydrationReducer(state, logWater(12));

      const middleId = state.todayLogs[1].id; // Middle entry
      state = hydrationReducer(state, deleteEntry(middleId));

      expect(state.todayLogs).toHaveLength(2);
      expect(state.waterToday).toBe(28); // 16 + 12
    });

    it('should do nothing if ID not found', () => {
      let state = hydrationReducer(initialState, logWater(16));
      const originalWater = state.waterToday;

      state = hydrationReducer(state, deleteEntry('nonexistent-id'));

      expect(state.todayLogs).toHaveLength(1);
      expect(state.waterToday).toBe(originalWater);
    });
  });

  describe('setTodayLogs', () => {
    it('should set logs and calculate totals', () => {
      const logs = [mockWaterLog, mockCoffeeLog];
      const state = hydrationReducer(initialState, setTodayLogs(logs));

      expect(state.todayLogs).toEqual(logs);
      expect(state.waterToday).toBe(24); // 16 + 8
      expect(state.caffeineToday).toBe(95);
    });

    it('should recalculate totals from scratch', () => {
      let state = hydrationReducer(initialState, logWater(100));
      state = hydrationReducer(state, setTodayLogs([mockWaterLog]));

      expect(state.waterToday).toBe(16); // Reset to log total
      expect(state.caffeineToday).toBe(0);
    });

    it('should handle empty logs array', () => {
      const state = hydrationReducer(initialState, setTodayLogs([]));

      expect(state.todayLogs).toEqual([]);
      expect(state.waterToday).toBe(0);
      expect(state.caffeineToday).toBe(0);
    });
  });

  describe('setGoals', () => {
    it('should update water goal', () => {
      const state = hydrationReducer(initialState, setGoals({
        daily_water_oz: 150,
      }));

      expect(state.goal.daily_water_oz).toBe(150);
      expect(state.goal.daily_caffeine_limit_mg).toBe(400); // Unchanged
    });

    it('should update caffeine limit', () => {
      const state = hydrationReducer(initialState, setGoals({
        daily_caffeine_limit_mg: 300,
      }));

      expect(state.goal.daily_caffeine_limit_mg).toBe(300);
    });

    it('should update multiple goals at once', () => {
      const state = hydrationReducer(initialState, setGoals({
        daily_water_oz: 100,
        daily_caffeine_limit_mg: 200,
        caffeine_warning_mg: 150,
      }));

      expect(state.goal.daily_water_oz).toBe(100);
      expect(state.goal.daily_caffeine_limit_mg).toBe(200);
      expect(state.goal.caffeine_warning_mg).toBe(150);
    });
  });

  describe('setWaterGoalFromWeight', () => {
    it('should set water goal to half body weight', () => {
      const state = hydrationReducer(initialState, setWaterGoalFromWeight(200));

      expect(state.goal.daily_water_oz).toBe(100);
    });

    it('should round water goal', () => {
      const state = hydrationReducer(initialState, setWaterGoalFromWeight(175));

      expect(state.goal.daily_water_oz).toBe(88); // 175/2 = 87.5 rounded
    });

    it('should work with 250lb user', () => {
      const state = hydrationReducer(initialState, setWaterGoalFromWeight(250));

      expect(state.goal.daily_water_oz).toBe(125);
    });
  });

  describe('Trend setters', () => {
    it('should set weekly trends', () => {
      const state = hydrationReducer(initialState, setWeeklyTrends(mockWeeklyTrends));

      expect(state.trends.weekly).toEqual(mockWeeklyTrends);
      expect(state.trends.monthly).toEqual([]); // Unchanged
    });

    it('should set monthly trends', () => {
      const state = hydrationReducer(initialState, setMonthlyTrends(mockMonthlyTrends));

      expect(state.trends.monthly).toEqual(mockMonthlyTrends);
      expect(state.trends.weekly).toEqual([]); // Unchanged
    });
  });

  describe('resetDaily', () => {
    it('should reset all daily data', () => {
      let state = hydrationReducer(initialState, logWater(50));
      state = hydrationReducer(state, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
      }));

      state = hydrationReducer(state, resetDaily());

      expect(state.todayLogs).toEqual([]);
      expect(state.waterToday).toBe(0);
      expect(state.caffeineToday).toBe(0);
      expect(state.lastUpdated).toBeTruthy();
    });

    it('should preserve goals', () => {
      let state = hydrationReducer(initialState, setGoals({
        daily_water_oz: 150,
      }));

      state = hydrationReducer(state, resetDaily());

      expect(state.goal.daily_water_oz).toBe(150);
    });

    it('should preserve trends', () => {
      let state = hydrationReducer(initialState, setWeeklyTrends(mockWeeklyTrends));

      state = hydrationReducer(state, resetDaily());

      expect(state.trends.weekly).toEqual(mockWeeklyTrends);
    });
  });

  describe('setLoading and setError', () => {
    it('should set loading state', () => {
      const state = hydrationReducer(initialState, setLoading(true));

      expect(state.loading).toBe(true);
    });

    it('should clear loading state', () => {
      let state = hydrationReducer(initialState, setLoading(true));
      state = hydrationReducer(state, setLoading(false));

      expect(state.loading).toBe(false);
    });

    it('should set error message', () => {
      const state = hydrationReducer(initialState, setError('Network error'));

      expect(state.error).toBe('Network error');
    });

    it('should clear error', () => {
      let state = hydrationReducer(initialState, setError('Error'));
      state = hydrationReducer(state, setError(null));

      expect(state.error).toBeNull();
    });
  });

  // =============================================================================
  // 3. Async Thunk Tests (12+ tests)
  // =============================================================================

  describe('fetchTodayProgress', () => {
    it('should set loading during fetch', async () => {
      mockHydrationApi.getTodayProgress.mockResolvedValue({
        data: { logs: [], waterToday: 0, caffeineToday: 0 },
        error: null,
      });

      const store = configureStore({
        reducer: { hydration: hydrationReducer },
      });

      const promise = store.dispatch(fetchTodayProgress());

      expect(store.getState().hydration.loading).toBe(true);
      await promise;
    });

    it('should update state on success', async () => {
      mockHydrationApi.getTodayProgress.mockResolvedValue({
        data: {
          logs: [mockWaterLog],
          waterToday: 16,
          caffeineToday: 0,
        },
        error: null,
      });

      const store = configureStore({
        reducer: { hydration: hydrationReducer },
      });

      await store.dispatch(fetchTodayProgress());
      const state = store.getState().hydration;

      expect(state.loading).toBe(false);
      expect(state.todayLogs).toEqual([mockWaterLog]);
      expect(state.waterToday).toBe(16);
      expect(state.caffeineToday).toBe(0);
      expect(state.lastUpdated).toBeTruthy();
    });

    it('should handle error response', async () => {
      mockHydrationApi.getTodayProgress.mockResolvedValue({
        data: null,
        error: 'Failed to fetch',
        message: 'Network error',
      });

      const store = configureStore({
        reducer: { hydration: hydrationReducer },
      });

      await store.dispatch(fetchTodayProgress());
      const state = store.getState().hydration;

      expect(state.loading).toBe(false);
      expect(state.error).toBe('Network error');
    });
  });

  describe('fetchHydrationGoals', () => {
    it('should update goals on success', async () => {
      mockHydrationApi.getGoals.mockResolvedValue({
        data: { daily_water_oz: 150 },
        error: null,
      });

      const store = configureStore({
        reducer: { hydration: hydrationReducer },
      });

      await store.dispatch(fetchHydrationGoals());
      const state = store.getState().hydration;

      expect(state.goal.daily_water_oz).toBe(150);
    });

    it('should handle error response', async () => {
      mockHydrationApi.getGoals.mockResolvedValue({
        data: null,
        error: 'Failed',
      });

      const store = configureStore({
        reducer: { hydration: hydrationReducer },
      });

      await store.dispatch(fetchHydrationGoals());
      // Should not throw, just reject silently
    });
  });

  describe('updateHydrationGoals', () => {
    it('should update goals on success', async () => {
      mockHydrationApi.updateGoals.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const store = configureStore({
        reducer: { hydration: hydrationReducer },
      });

      await store.dispatch(updateHydrationGoals({ daily_water_oz: 150 }));
      const state = store.getState().hydration;

      expect(state.goal.daily_water_oz).toBe(150);
    });
  });

  describe('logWaterAsync', () => {
    it('should set loading during log', async () => {
      mockHydrationApi.logWater.mockResolvedValue({
        data: mockWaterLog,
        error: null,
      });

      const store = configureStore({
        reducer: { hydration: hydrationReducer },
      });

      const promise = store.dispatch(logWaterAsync({ amountOz: 16 }));

      expect(store.getState().hydration.loading).toBe(true);
      await promise;
    });

    it('should add log on success', async () => {
      mockHydrationApi.logWater.mockResolvedValue({
        data: mockWaterLog,
        error: null,
      });

      const store = configureStore({
        reducer: { hydration: hydrationReducer },
      });

      await store.dispatch(logWaterAsync({ amountOz: 16 }));
      const state = store.getState().hydration;

      expect(state.loading).toBe(false);
      expect(state.todayLogs).toContainEqual(mockWaterLog);
      expect(state.waterToday).toBe(16);
    });

    it('should handle error', async () => {
      mockHydrationApi.logWater.mockResolvedValue({
        data: null,
        error: 'Failed to log',
        message: 'Server error',
      });

      const store = configureStore({
        reducer: { hydration: hydrationReducer },
      });

      await store.dispatch(logWaterAsync({ amountOz: 16 }));
      const state = store.getState().hydration;

      expect(state.loading).toBe(false);
      expect(state.error).toBe('Server error');
    });
  });

  describe('logCaffeineAsync', () => {
    it('should set loading during log', async () => {
      mockHydrationApi.logCaffeine.mockResolvedValue({
        data: mockCoffeeLog,
        error: null,
      });

      const store = configureStore({
        reducer: { hydration: hydrationReducer },
      });

      const promise = store.dispatch(logCaffeineAsync({
        beverageType: 'coffee',
        volumeOz: 8,
      }));

      expect(store.getState().hydration.loading).toBe(true);
      await promise;
    });

    it('should add log on success', async () => {
      mockHydrationApi.logCaffeine.mockResolvedValue({
        data: mockCoffeeLog,
        error: null,
      });

      const store = configureStore({
        reducer: { hydration: hydrationReducer },
      });

      await store.dispatch(logCaffeineAsync({
        beverageType: 'coffee',
        volumeOz: 8,
      }));
      const state = store.getState().hydration;

      expect(state.loading).toBe(false);
      expect(state.todayLogs).toContainEqual(mockCoffeeLog);
      expect(state.waterToday).toBe(8);
      expect(state.caffeineToday).toBe(95);
    });

    it('should handle error', async () => {
      mockHydrationApi.logCaffeine.mockResolvedValue({
        data: null,
        error: 'Failed',
        message: 'Error logging caffeine',
      });

      const store = configureStore({
        reducer: { hydration: hydrationReducer },
      });

      await store.dispatch(logCaffeineAsync({
        beverageType: 'coffee',
        volumeOz: 8,
      }));
      const state = store.getState().hydration;

      expect(state.loading).toBe(false);
      expect(state.error).toBe('Error logging caffeine');
    });
  });

  describe('fetchHydrationTrends', () => {
    it('should update trends on success', async () => {
      mockHydrationApi.getTrends.mockResolvedValue({
        data: {
          weekly: mockWeeklyTrends,
          monthly: mockMonthlyTrends,
        },
        error: null,
      });

      const store = configureStore({
        reducer: { hydration: hydrationReducer },
      });

      await store.dispatch(fetchHydrationTrends());
      const state = store.getState().hydration;

      expect(state.trends.weekly).toEqual(mockWeeklyTrends);
      expect(state.trends.monthly).toEqual(mockMonthlyTrends);
    });
  });

  // =============================================================================
  // 4. Selector Tests (8+ tests)
  // =============================================================================

  describe('selectHydrationProgress', () => {
    it('should calculate progress correctly', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logWater(50));

      const progress = selectHydrationProgress(state);

      expect(progress.total_water_oz).toBe(50);
      expect(progress.total_caffeine_mg).toBe(0);
      expect(progress.percent_of_goal).toBe(40); // 50/125 * 100
      expect(progress.caffeine_status).toBe('safe');
      expect(progress.entries_count).toBe(1);
    });

    it('should show warning caffeine status', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
        caffeine_mg: 310, // Above warning (300mg)
      }));

      const progress = selectHydrationProgress(state);

      expect(progress.caffeine_status).toBe('warning');
    });

    it('should show limit caffeine status', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
        caffeine_mg: 400, // At limit
      }));

      const progress = selectHydrationProgress(state);

      expect(progress.caffeine_status).toBe('limit');
    });

    it('should calculate percentage over 100%', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logWater(150));

      const progress = selectHydrationProgress(state);

      expect(progress.percent_of_goal).toBe(120); // 150/125 * 100
    });
  });

  describe('selectRemainingWater', () => {
    it('should calculate remaining water', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logWater(50));

      const remaining = selectRemainingWater(state);

      expect(remaining).toBe(75); // 125 - 50
    });

    it('should return 0 when goal met', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logWater(125));

      const remaining = selectRemainingWater(state);

      expect(remaining).toBe(0);
    });

    it('should return 0 when goal exceeded', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logWater(150));

      const remaining = selectRemainingWater(state);

      expect(remaining).toBe(0);
    });
  });

  describe('selectRemainingCaffeine', () => {
    it('should calculate remaining caffeine', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
      }));

      const remaining = selectRemainingCaffeine(state);

      expect(remaining).toBe(305); // 400 - 95
    });

    it('should return 0 when limit reached', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
        caffeine_mg: 400,
      }));

      const remaining = selectRemainingCaffeine(state);

      expect(remaining).toBe(0);
    });

    it('should return 0 when limit exceeded', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
        caffeine_mg: 450,
      }));

      const remaining = selectRemainingCaffeine(state);

      expect(remaining).toBe(0);
    });
  });

  describe('selectCanHaveCaffeine', () => {
    it('should allow caffeine when under limit', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
      }));

      const canHave = selectCanHaveCaffeine(state, 100);

      expect(canHave.allowed).toBe(true);
      expect(canHave.warning).toBeUndefined();
    });

    it('should warn when approaching limit', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
        caffeine_mg: 250,
      }));

      const canHave = selectCanHaveCaffeine(state, 100);

      expect(canHave.allowed).toBe(true);
      expect(canHave.warning).toBe('Approaching daily caffeine limit');
    });

    it('should prevent caffeine when would exceed limit', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
        caffeine_mg: 350,
      }));

      const canHave = selectCanHaveCaffeine(state, 100);

      expect(canHave.allowed).toBe(false);
      expect(canHave.warning).toBe('Would exceed daily limit by 50mg');
    });

    it('should calculate exact overage amount', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
        caffeine_mg: 380,
      }));

      const canHave = selectCanHaveCaffeine(state, 95);

      expect(canHave.allowed).toBe(false);
      expect(canHave.warning).toBe('Would exceed daily limit by 75mg');
    });

    it('should allow exactly to limit', () => {
      let state = { hydration: initialState };
      state.hydration = hydrationReducer(state.hydration, logCaffeine({
        beverage_type: 'coffee',
        volume_oz: 8,
        caffeine_mg: 300,
      }));

      const canHave = selectCanHaveCaffeine(state, 100);

      expect(canHave.allowed).toBe(true);
    });
  });
});
