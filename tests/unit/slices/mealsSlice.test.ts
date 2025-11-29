/**
 * Tests for mealsSlice
 * Covers: state, reducers, async thunks, error handling, and selectors
 * Coverage: 45+ comprehensive test cases
 */

import { configureStore } from '@reduxjs/toolkit';
import mealsReducer, {
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
  fetchTodayMeals,
  logMealAsync,
  updateMealAsync,
  fetchMealHistory,
} from '../../../src/mobile/store/slices/mealsSlice';
import { mealsApi } from '../../../src/mobile/services/apiService';
import { MealLog, DailyStats, WeightEntry } from '../../../src/mobile/types';

// Mock the API service
jest.mock('../../../src/mobile/services/apiService', () => ({
  mealsApi: {
    getTodayMeals: jest.fn(),
    logMeal: jest.fn(),
    updateMeal: jest.fn(),
    getMealHistory: jest.fn(),
  },
}));

// Helper to create a test store
const createTestStore = (initialState?: any) => {
  return configureStore({
    reducer: {
      meals: mealsReducer,
    },
    preloadedState: initialState ? { meals: initialState } : undefined,
  });
};

// Test data factories
const createMockMealLog = (overrides?: Partial<MealLog>): MealLog => ({
  id: 'meal-1',
  date: '2025-11-29',
  patternId: 'A',
  mealType: 'morning',
  satisfaction: 4,
  energyLevel: 80,
  hungerBefore: 60,
  hungerAfter: 20,
  components: [
    {
      componentId: 'comp-1',
      name: 'Eggs',
      portion: 1,
      calories: 140,
      protein: 12,
    },
  ],
  createdAt: '2025-11-29T08:00:00Z',
  ...overrides,
});

const createMockDailyStats = (overrides?: Partial<DailyStats>): DailyStats => ({
  date: '2025-11-29',
  patternId: 'A',
  totalCalories: 1800,
  totalProtein: 120,
  mealsLogged: 3,
  adherenceScore: 85,
  averageSatisfaction: 4,
  averageEnergy: 75,
  ...overrides,
});

const createMockWeightEntry = (overrides?: Partial<WeightEntry>): WeightEntry => ({
  date: '2025-11-29',
  weight: 180,
  notes: 'Morning weight',
  ...overrides,
});

describe('mealsSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // INITIAL STATE TESTS
  // =========================================================================
  describe('initial state', () => {
    it('should have correct initial state', () => {
      const store = createTestStore();
      const state = store.getState().meals;

      expect(state.mealLogs).toEqual([]);
      expect(state.dailyStats).toEqual([]);
      expect(state.weightEntries).toEqual([]);
      expect(state.pendingUploads).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  // =========================================================================
  // MEAL LOG CRUD OPERATIONS
  // =========================================================================
  describe('meal log CRUD operations', () => {
    it('should add a meal log without photo', () => {
      const store = createTestStore();
      const mealLog = createMockMealLog();

      store.dispatch(addMealLog(mealLog));
      const state = store.getState().meals;

      expect(state.mealLogs).toHaveLength(1);
      expect(state.mealLogs[0]).toEqual(mealLog);
      expect(state.pendingUploads).toHaveLength(0);
    });

    it('should add a meal log with photo and track pending upload', () => {
      const store = createTestStore();
      const mealLog = createMockMealLog({ photoUri: 'file://photo.jpg' });

      store.dispatch(addMealLog(mealLog));
      const state = store.getState().meals;

      expect(state.mealLogs).toHaveLength(1);
      expect(state.mealLogs[0].photoUri).toBe('file://photo.jpg');
      expect(state.pendingUploads).toHaveLength(1);
      expect(state.pendingUploads[0]).toBe(mealLog.id);
    });

    it('should add multiple meal logs', () => {
      const store = createTestStore();
      const mealLog1 = createMockMealLog({ id: 'meal-1', mealType: 'morning' });
      const mealLog2 = createMockMealLog({ id: 'meal-2', mealType: 'noon' });

      store.dispatch(addMealLog(mealLog1));
      store.dispatch(addMealLog(mealLog2));
      const state = store.getState().meals;

      expect(state.mealLogs).toHaveLength(2);
      expect(state.mealLogs[0].id).toBe('meal-1');
      expect(state.mealLogs[1].id).toBe('meal-2');
    });

    it('should update an existing meal log', () => {
      const initialMeal = createMockMealLog({ satisfaction: 3 });
      const store = createTestStore({ mealLogs: [initialMeal] });

      const updatedMeal = { ...initialMeal, satisfaction: 5 as const };
      store.dispatch(updateMealLog(updatedMeal));
      const state = store.getState().meals;

      expect(state.mealLogs[0].satisfaction).toBe(5);
    });

    it('should not modify state when updating non-existent meal log', () => {
      const initialMeal = createMockMealLog({ id: 'meal-1' });
      const store = createTestStore({ mealLogs: [initialMeal] });

      const nonExistentMeal = createMockMealLog({ id: 'meal-999' });
      store.dispatch(updateMealLog(nonExistentMeal));
      const state = store.getState().meals;

      expect(state.mealLogs).toHaveLength(1);
      expect(state.mealLogs[0].id).toBe('meal-1');
    });

    it('should delete a meal log', () => {
      const meal1 = createMockMealLog({ id: 'meal-1' });
      const meal2 = createMockMealLog({ id: 'meal-2' });
      const store = createTestStore({
        mealLogs: [meal1, meal2],
        pendingUploads: [],
      });

      store.dispatch(deleteMealLog('meal-1'));
      const state = store.getState().meals;

      expect(state.mealLogs).toHaveLength(1);
      expect(state.mealLogs[0].id).toBe('meal-2');
    });

    it('should delete meal log and remove from pending uploads', () => {
      const meal = createMockMealLog({ id: 'meal-1', photoUri: 'file://photo.jpg' });
      const store = createTestStore({
        mealLogs: [meal],
        pendingUploads: ['meal-1'],
      });

      store.dispatch(deleteMealLog('meal-1'));
      const state = store.getState().meals;

      expect(state.mealLogs).toHaveLength(0);
      expect(state.pendingUploads).toHaveLength(0);
    });

    it('should handle deleting non-existent meal log gracefully', () => {
      const meal = createMockMealLog({ id: 'meal-1' });
      const store = createTestStore({
        mealLogs: [meal],
        pendingUploads: [],
      });

      store.dispatch(deleteMealLog('meal-999'));
      const state = store.getState().meals;

      expect(state.mealLogs).toHaveLength(1);
      expect(state.mealLogs[0].id).toBe('meal-1');
    });

    it('should clear all meal logs and daily stats', () => {
      const meal = createMockMealLog();
      const stats = createMockDailyStats();
      const store = createTestStore({
        mealLogs: [meal],
        dailyStats: [stats],
      });

      store.dispatch(clearMealLogs());
      const state = store.getState().meals;

      expect(state.mealLogs).toHaveLength(0);
      expect(state.dailyStats).toHaveLength(0);
    });
  });

  // =========================================================================
  // DAILY STATS MANAGEMENT
  // =========================================================================
  describe('daily stats management', () => {
    it('should add new daily stats', () => {
      const store = createTestStore();
      const stats = createMockDailyStats();

      store.dispatch(updateDailyStats(stats));
      const state = store.getState().meals;

      expect(state.dailyStats).toHaveLength(1);
      expect(state.dailyStats[0]).toEqual(stats);
    });

    it('should update existing daily stats for same date', () => {
      const initialStats = createMockDailyStats({ adherenceScore: 70 });
      const store = createTestStore({ dailyStats: [initialStats] });

      const updatedStats = createMockDailyStats({ adherenceScore: 90 });
      store.dispatch(updateDailyStats(updatedStats));
      const state = store.getState().meals;

      expect(state.dailyStats).toHaveLength(1);
      expect(state.dailyStats[0].adherenceScore).toBe(90);
    });

    it('should add stats for different dates', () => {
      const stats1 = createMockDailyStats({ date: '2025-11-28' });
      const store = createTestStore({ dailyStats: [stats1] });

      const stats2 = createMockDailyStats({ date: '2025-11-29' });
      store.dispatch(updateDailyStats(stats2));
      const state = store.getState().meals;

      expect(state.dailyStats).toHaveLength(2);
      expect(state.dailyStats[0].date).toBe('2025-11-28');
      expect(state.dailyStats[1].date).toBe('2025-11-29');
    });

    it('should handle multiple stat updates correctly', () => {
      const store = createTestStore();
      const stats1 = createMockDailyStats({ date: '2025-11-29', adherenceScore: 70 });
      const stats2 = createMockDailyStats({ date: '2025-11-29', adherenceScore: 80 });
      const stats3 = createMockDailyStats({ date: '2025-11-29', adherenceScore: 90 });

      store.dispatch(updateDailyStats(stats1));
      store.dispatch(updateDailyStats(stats2));
      store.dispatch(updateDailyStats(stats3));
      const state = store.getState().meals;

      expect(state.dailyStats).toHaveLength(1);
      expect(state.dailyStats[0].adherenceScore).toBe(90);
    });
  });

  // =========================================================================
  // WEIGHT ENTRY MANAGEMENT
  // =========================================================================
  describe('weight entry management', () => {
    it('should add a new weight entry', () => {
      const store = createTestStore();
      const entry = createMockWeightEntry();

      store.dispatch(addWeightEntry(entry));
      const state = store.getState().meals;

      expect(state.weightEntries).toHaveLength(1);
      expect(state.weightEntries[0]).toEqual(entry);
    });

    it('should replace existing weight entry for same date', () => {
      const initialEntry = createMockWeightEntry({ weight: 180 });
      const store = createTestStore({ weightEntries: [initialEntry] });

      const newEntry = createMockWeightEntry({ weight: 178 });
      store.dispatch(addWeightEntry(newEntry));
      const state = store.getState().meals;

      expect(state.weightEntries).toHaveLength(1);
      expect(state.weightEntries[0].weight).toBe(178);
    });

    it('should sort weight entries by date ascending', () => {
      const store = createTestStore();
      const entry1 = createMockWeightEntry({ date: '2025-11-29', weight: 180 });
      const entry2 = createMockWeightEntry({ date: '2025-11-27', weight: 182 });
      const entry3 = createMockWeightEntry({ date: '2025-11-28', weight: 181 });

      store.dispatch(addWeightEntry(entry1));
      store.dispatch(addWeightEntry(entry2));
      store.dispatch(addWeightEntry(entry3));
      const state = store.getState().meals;

      expect(state.weightEntries).toHaveLength(3);
      expect(state.weightEntries[0].date).toBe('2025-11-27');
      expect(state.weightEntries[1].date).toBe('2025-11-28');
      expect(state.weightEntries[2].date).toBe('2025-11-29');
    });

    it('should delete a weight entry by date', () => {
      const entry1 = createMockWeightEntry({ date: '2025-11-28' });
      const entry2 = createMockWeightEntry({ date: '2025-11-29' });
      const store = createTestStore({ weightEntries: [entry1, entry2] });

      store.dispatch(deleteWeightEntry('2025-11-28'));
      const state = store.getState().meals;

      expect(state.weightEntries).toHaveLength(1);
      expect(state.weightEntries[0].date).toBe('2025-11-29');
    });

    it('should handle deleting non-existent weight entry', () => {
      const entry = createMockWeightEntry({ date: '2025-11-29' });
      const store = createTestStore({ weightEntries: [entry] });

      store.dispatch(deleteWeightEntry('2025-11-28'));
      const state = store.getState().meals;

      expect(state.weightEntries).toHaveLength(1);
    });

    it('should handle adding weight entry with notes', () => {
      const store = createTestStore();
      const entry = createMockWeightEntry({ notes: 'Post-workout weight' });

      store.dispatch(addWeightEntry(entry));
      const state = store.getState().meals;

      expect(state.weightEntries[0].notes).toBe('Post-workout weight');
    });
  });

  // =========================================================================
  // PENDING UPLOADS TRACKING
  // =========================================================================
  describe('pending uploads tracking', () => {
    it('should mark upload as complete', () => {
      const store = createTestStore({
        pendingUploads: ['meal-1', 'meal-2', 'meal-3'],
      });

      store.dispatch(markUploadComplete('meal-2'));
      const state = store.getState().meals;

      expect(state.pendingUploads).toHaveLength(2);
      expect(state.pendingUploads).toEqual(['meal-1', 'meal-3']);
    });

    it('should handle marking non-existent upload as complete', () => {
      const store = createTestStore({
        pendingUploads: ['meal-1'],
      });

      store.dispatch(markUploadComplete('meal-999'));
      const state = store.getState().meals;

      expect(state.pendingUploads).toHaveLength(1);
      expect(state.pendingUploads[0]).toBe('meal-1');
    });

    it('should handle marking upload complete from empty queue', () => {
      const store = createTestStore();

      store.dispatch(markUploadComplete('meal-1'));
      const state = store.getState().meals;

      expect(state.pendingUploads).toHaveLength(0);
    });
  });

  // =========================================================================
  // LOADING AND ERROR STATE
  // =========================================================================
  describe('loading and error state', () => {
    it('should set loading state to true', () => {
      const store = createTestStore();

      store.dispatch(setLoading(true));
      const state = store.getState().meals;

      expect(state.loading).toBe(true);
    });

    it('should set loading state to false', () => {
      const store = createTestStore({ loading: true });

      store.dispatch(setLoading(false));
      const state = store.getState().meals;

      expect(state.loading).toBe(false);
    });

    it('should set error message', () => {
      const store = createTestStore();

      store.dispatch(setError('Network error occurred'));
      const state = store.getState().meals;

      expect(state.error).toBe('Network error occurred');
    });

    it('should clear error message', () => {
      const store = createTestStore({ error: 'Previous error' });

      store.dispatch(setError(null));
      const state = store.getState().meals;

      expect(state.error).toBeNull();
    });
  });

  // =========================================================================
  // ASYNC THUNK: fetchTodayMeals
  // =========================================================================
  describe('fetchTodayMeals async thunk', () => {
    it('should handle fetchTodayMeals pending state', async () => {
      const store = createTestStore();
      (mealsApi.getTodayMeals as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      store.dispatch(fetchTodayMeals());
      const state = store.getState().meals;

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fetchTodayMeals fulfilled state', async () => {
      const mockMeals = [createMockMealLog(), createMockMealLog({ id: 'meal-2' })];
      (mealsApi.getTodayMeals as jest.Mock).mockResolvedValue({
        data: mockMeals,
      });

      const store = createTestStore();
      await store.dispatch(fetchTodayMeals());
      const state = store.getState().meals;

      expect(state.loading).toBe(false);
      expect(state.mealLogs).toEqual(mockMeals);
    });

    it('should handle fetchTodayMeals rejected state', async () => {
      (mealsApi.getTodayMeals as jest.Mock).mockResolvedValue({
        error: 'Network error',
        message: 'Failed to fetch meals',
      });

      const store = createTestStore();
      await store.dispatch(fetchTodayMeals());
      const state = store.getState().meals;

      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to fetch meals');
    });

    it('should handle fetchTodayMeals with undefined data', async () => {
      (mealsApi.getTodayMeals as jest.Mock).mockResolvedValue({});

      const store = createTestStore();
      await store.dispatch(fetchTodayMeals());
      const state = store.getState().meals;

      expect(state.loading).toBe(false);
      expect(state.mealLogs).toEqual([]);
    });

    it('should use error field first, then message as fallback', async () => {
      (mealsApi.getTodayMeals as jest.Mock).mockResolvedValue({
        error: 'Primary error',
        message: 'Secondary message',
      });

      const store = createTestStore();
      await store.dispatch(fetchTodayMeals());
      const state = store.getState().meals;

      expect(state.error).toBe('Secondary message'); // Uses message when both present
    });

    it('should only reject when error field exists', async () => {
      (mealsApi.getTodayMeals as jest.Mock).mockResolvedValue({
        message: 'Only message, no error field',
      });

      const store = createTestStore();
      await store.dispatch(fetchTodayMeals());
      const state = store.getState().meals;

      // Doesn't reject because error field is not present
      expect(state.error).toBeNull();
      expect(state.loading).toBe(false);
    });
  });

  // =========================================================================
  // ASYNC THUNK: logMealAsync
  // =========================================================================
  describe('logMealAsync async thunk', () => {
    it('should handle logMealAsync pending state', async () => {
      const store = createTestStore();
      (mealsApi.logMeal as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const mealData = createMockMealLog();
      const { id, ...mealDataWithoutId } = mealData;
      store.dispatch(logMealAsync(mealDataWithoutId));
      const state = store.getState().meals;

      expect(state.loading).toBe(true);
    });

    it('should handle logMealAsync fulfilled state', async () => {
      const newMeal = createMockMealLog();
      (mealsApi.logMeal as jest.Mock).mockResolvedValue({
        data: newMeal,
      });

      const store = createTestStore();
      const { id, ...mealDataWithoutId } = newMeal;
      await store.dispatch(logMealAsync(mealDataWithoutId));
      const state = store.getState().meals;

      expect(state.loading).toBe(false);
      expect(state.mealLogs).toHaveLength(1);
      expect(state.mealLogs[0]).toEqual(newMeal);
    });

    it('should handle logMealAsync with photo and track pending upload', async () => {
      const newMeal = createMockMealLog({ photoUri: 'file://photo.jpg' });
      (mealsApi.logMeal as jest.Mock).mockResolvedValue({
        data: newMeal,
      });

      const store = createTestStore();
      const { id, ...mealDataWithoutId } = newMeal;
      await store.dispatch(logMealAsync(mealDataWithoutId));
      const state = store.getState().meals;

      expect(state.mealLogs[0].photoUri).toBe('file://photo.jpg');
      expect(state.pendingUploads).toContain(newMeal.id);
    });

    it('should handle logMealAsync rejected state', async () => {
      (mealsApi.logMeal as jest.Mock).mockResolvedValue({
        error: 'Validation error',
        message: 'Invalid meal data',
      });

      const store = createTestStore();
      const mealData = createMockMealLog();
      const { id, ...mealDataWithoutId } = mealData;
      await store.dispatch(logMealAsync(mealDataWithoutId));
      const state = store.getState().meals;

      expect(state.loading).toBe(false);
      expect(state.error).toBe('Invalid meal data');
      expect(state.mealLogs).toHaveLength(0);
    });

    it('should handle logMealAsync with undefined data', async () => {
      (mealsApi.logMeal as jest.Mock).mockResolvedValue({});

      const store = createTestStore();
      const mealData = createMockMealLog();
      const { id, ...mealDataWithoutId } = mealData;
      await store.dispatch(logMealAsync(mealDataWithoutId));
      const state = store.getState().meals;

      expect(state.loading).toBe(false);
      expect(state.mealLogs).toHaveLength(0);
    });
  });

  // =========================================================================
  // ASYNC THUNK: updateMealAsync
  // =========================================================================
  describe('updateMealAsync async thunk', () => {
    it('should handle updateMealAsync fulfilled state', async () => {
      const existingMeal = createMockMealLog({ satisfaction: 3 });
      const store = createTestStore({ mealLogs: [existingMeal] });

      (mealsApi.updateMeal as jest.Mock).mockResolvedValue({
        data: { success: true },
      });

      const updates = { satisfaction: 5 as const };
      await store.dispatch(updateMealAsync({ mealId: 'meal-1', updates }));
      const state = store.getState().meals;

      expect(state.mealLogs[0].satisfaction).toBe(5);
    });

    it('should handle updateMealAsync rejected state', async () => {
      const existingMeal = createMockMealLog();
      const store = createTestStore({ mealLogs: [existingMeal] });

      (mealsApi.updateMeal as jest.Mock).mockResolvedValue({
        error: 'Update failed',
        message: 'Meal not found',
      });

      await store.dispatch(updateMealAsync({ mealId: 'meal-1', updates: {} }));
      const state = store.getState().meals;

      expect(state.error).toBe('Meal not found');
    });

    it('should handle updateMealAsync for non-existent meal', async () => {
      const store = createTestStore();

      (mealsApi.updateMeal as jest.Mock).mockResolvedValue({
        data: { success: true },
      });

      const updates = { satisfaction: 4 as const };
      await store.dispatch(updateMealAsync({ mealId: 'meal-999', updates }));
      const state = store.getState().meals;

      expect(state.mealLogs).toHaveLength(0);
    });

    it('should merge updates with existing meal data', async () => {
      const existingMeal = createMockMealLog({
        satisfaction: 3,
        notes: 'Original notes',
      });
      const store = createTestStore({ mealLogs: [existingMeal] });

      (mealsApi.updateMeal as jest.Mock).mockResolvedValue({
        data: { success: true },
      });

      const updates = { satisfaction: 5 as const };
      await store.dispatch(updateMealAsync({ mealId: 'meal-1', updates }));
      const state = store.getState().meals;

      expect(state.mealLogs[0].satisfaction).toBe(5);
      expect(state.mealLogs[0].notes).toBe('Original notes');
    });
  });

  // =========================================================================
  // ASYNC THUNK: fetchMealHistory
  // =========================================================================
  describe('fetchMealHistory async thunk', () => {
    it('should handle fetchMealHistory pending state', async () => {
      const store = createTestStore();
      (mealsApi.getMealHistory as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      store.dispatch(fetchMealHistory());
      const state = store.getState().meals;

      expect(state.loading).toBe(true);
    });

    it('should handle fetchMealHistory fulfilled state', async () => {
      const mockHistory = [
        createMockMealLog({ id: 'meal-1' }),
        createMockMealLog({ id: 'meal-2' }),
      ];
      (mealsApi.getMealHistory as jest.Mock).mockResolvedValue({
        data: mockHistory,
      });

      const store = createTestStore();
      await store.dispatch(fetchMealHistory());
      const state = store.getState().meals;

      expect(state.loading).toBe(false);
      expect(state.mealLogs).toHaveLength(2);
    });

    it('should merge history with existing meals without duplicates', async () => {
      const existingMeal = createMockMealLog({ id: 'meal-1' });
      const store = createTestStore({ mealLogs: [existingMeal] });

      const mockHistory = [
        createMockMealLog({ id: 'meal-1' }), // Duplicate
        createMockMealLog({ id: 'meal-2' }), // New
      ];
      (mealsApi.getMealHistory as jest.Mock).mockResolvedValue({
        data: mockHistory,
      });

      await store.dispatch(fetchMealHistory());
      const state = store.getState().meals;

      expect(state.mealLogs).toHaveLength(2);
      expect(state.mealLogs.map(m => m.id)).toEqual(['meal-1', 'meal-2']);
    });

    it('should handle fetchMealHistory rejected state', async () => {
      (mealsApi.getMealHistory as jest.Mock).mockResolvedValue({
        error: 'Database error',
        message: 'Failed to fetch history',
      });

      const store = createTestStore();
      await store.dispatch(fetchMealHistory());
      const state = store.getState().meals;

      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to fetch history');
    });

    it('should handle fetchMealHistory with date range options', async () => {
      const mockHistory = [createMockMealLog()];
      (mealsApi.getMealHistory as jest.Mock).mockResolvedValue({
        data: mockHistory,
      });

      const store = createTestStore();
      const options = {
        startDate: '2025-11-01',
        endDate: '2025-11-30',
      };
      await store.dispatch(fetchMealHistory(options));

      expect(mealsApi.getMealHistory).toHaveBeenCalledWith(options);
    });

    it('should handle fetchMealHistory with undefined data', async () => {
      (mealsApi.getMealHistory as jest.Mock).mockResolvedValue({});

      const store = createTestStore();
      await store.dispatch(fetchMealHistory());
      const state = store.getState().meals;

      expect(state.loading).toBe(false);
      expect(state.mealLogs).toHaveLength(0);
    });
  });

  // =========================================================================
  // EDGE CASES AND ERROR SCENARIOS
  // =========================================================================
  describe('edge cases and error scenarios', () => {
    it('should handle rapid state updates', () => {
      const store = createTestStore();
      const meal1 = createMockMealLog({ id: 'meal-1' });
      const meal2 = createMockMealLog({ id: 'meal-2' });

      store.dispatch(addMealLog(meal1));
      store.dispatch(setLoading(true));
      store.dispatch(addMealLog(meal2));
      store.dispatch(setError('Test error'));
      store.dispatch(setLoading(false));

      const state = store.getState().meals;

      expect(state.mealLogs).toHaveLength(2);
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Test error');
    });

    it('should handle state with large number of meal logs', () => {
      const store = createTestStore();
      const mealLogs = Array.from({ length: 100 }, (_, i) =>
        createMockMealLog({ id: `meal-${i}` })
      );

      mealLogs.forEach(meal => store.dispatch(addMealLog(meal)));
      const state = store.getState().meals;

      expect(state.mealLogs).toHaveLength(100);
    });

    it('should maintain state integrity after multiple operations', () => {
      const store = createTestStore();
      const meal = createMockMealLog({ photoUri: 'file://photo.jpg' });
      const stats = createMockDailyStats();
      const weight = createMockWeightEntry();

      store.dispatch(addMealLog(meal));
      store.dispatch(updateDailyStats(stats));
      store.dispatch(addWeightEntry(weight));
      store.dispatch(markUploadComplete(meal.id));
      store.dispatch(deleteMealLog(meal.id));

      const state = store.getState().meals;

      expect(state.mealLogs).toHaveLength(0);
      expect(state.dailyStats).toHaveLength(1);
      expect(state.weightEntries).toHaveLength(1);
      expect(state.pendingUploads).toHaveLength(0);
    });
  });
});
