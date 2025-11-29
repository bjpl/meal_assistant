import patternsReducer, {
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
  fetchPatterns,
  fetchUserPreferences,
  setDefaultPattern,
  selectPatternForToday,
  ratePattern,
  fetchPatternHistory,
  fetchPatternStatistics,
  selectPatterns,
  selectSelectedPattern,
  selectPendingSwitch,
  selectTodaySwitchCount,
  selectSwitchHistory,
  selectCurrentPattern,
  PendingSwitch,
  PatternSwitchRecord,
  RecalculatedMeal,
  PatternSwitchPreviewData,
} from '../../../src/mobile/store/slices/patternsSlice';
import { MealPattern, PatternId, PatternStats } from '../../../src/mobile/types';
import { patternsApi } from '../../../src/mobile/services/apiService';

// Mock the patternsApi
jest.mock('../../../src/mobile/services/apiService', () => ({
  patternsApi: {
    getAll: jest.fn(),
    getUserPreferences: jest.fn(),
    setDefaultPattern: jest.fn(),
    selectPatternForToday: jest.fn(),
    ratePattern: jest.fn(),
    getHistory: jest.fn(),
    getStatistics: jest.fn(),
  },
}));

const mockPatternsApi = patternsApi as jest.Mocked<typeof patternsApi>;

describe('patternsSlice', () => {
  // =============================================================================
  // Test Fixtures
  // =============================================================================

  const mockPatternA: MealPattern = {
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
  };

  const mockPatternB: MealPattern = {
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
  };

  const mockPatternC: MealPattern = {
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
  };

  const mockPatternStats: PatternStats = {
    patternId: 'A',
    timesUsed: 15,
    averageSatisfaction: 4.2,
    averageEnergy: 85,
    adherenceRate: 0.92,
    lastUsed: '2025-11-28',
  };

  const mockRecalculatedMeal: RecalculatedMeal = {
    mealType: 'evening',
    originalCalories: 550,
    newCalories: 850,
    originalProtein: 40,
    newProtein: 50,
    time: '6:00 PM',
    isRemaining: true,
  };

  const mockPendingSwitch: PendingSwitch = {
    newPatternId: 'B',
    reason: 'Change in schedule',
    previewData: {
      currentPattern: mockPatternA,
      newPattern: mockPatternB,
      currentTime: '3:00 PM',
      caloriesConsumed: 1250,
      proteinConsumed: 95,
      remainingMeals: [mockRecalculatedMeal],
      warnings: ['You have consumed more than 50% of your daily calories'],
      inventorySufficient: true,
      missingIngredients: [],
    },
  };

  const defaultPatterns: MealPattern[] = [
    mockPatternA,
    mockPatternB,
    mockPatternC,
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

  const initialState = {
    patterns: defaultPatterns,
    selectedPattern: 'A' as PatternId,
    weeklySchedule: {},
    patternStats: [],
    switchHistory: [],
    pendingSwitch: null,
    todaySwitchCount: 0,
    loading: false,
    error: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // 1. Initial State Tests (2 tests)
  // =============================================================================

  describe('Initial State', () => {
    it('should return the initial state', () => {
      const state = patternsReducer(undefined, { type: 'unknown' });
      expect(state).toEqual(initialState);
    });

    it('should have 7 default patterns loaded', () => {
      const state = patternsReducer(undefined, { type: 'unknown' });
      expect(state.patterns).toHaveLength(7);
      expect(state.patterns[0].id).toBe('A');
      expect(state.patterns[1].id).toBe('B');
      expect(state.patterns[2].id).toBe('C');
      expect(state.patterns[3].id).toBe('D');
      expect(state.patterns[4].id).toBe('E');
      expect(state.patterns[5].id).toBe('F');
      expect(state.patterns[6].id).toBe('G');
    });
  });

  // =============================================================================
  // 2. Synchronous Reducers Tests (17 tests)
  // =============================================================================

  describe('Synchronous Reducers', () => {
    describe('setSelectedPattern', () => {
      it('should update selected pattern', () => {
        const state = patternsReducer(initialState, setSelectedPattern('B'));
        expect(state.selectedPattern).toBe('B');
      });

      it('should update to different pattern', () => {
        const currentState = { ...initialState, selectedPattern: 'A' as PatternId };
        const state = patternsReducer(currentState, setSelectedPattern('C'));
        expect(state.selectedPattern).toBe('C');
      });
    });

    describe('setPatternForDate', () => {
      it('should set pattern for specific date', () => {
        const state = patternsReducer(
          initialState,
          setPatternForDate({ date: '2025-11-28', patternId: 'B' })
        );
        expect(state.weeklySchedule['2025-11-28']).toBe('B');
      });

      it('should set multiple dates in weekly schedule', () => {
        let state = patternsReducer(
          initialState,
          setPatternForDate({ date: '2025-11-28', patternId: 'A' })
        );
        state = patternsReducer(
          state,
          setPatternForDate({ date: '2025-11-29', patternId: 'B' })
        );
        state = patternsReducer(
          state,
          setPatternForDate({ date: '2025-11-30', patternId: 'C' })
        );

        expect(state.weeklySchedule['2025-11-28']).toBe('A');
        expect(state.weeklySchedule['2025-11-29']).toBe('B');
        expect(state.weeklySchedule['2025-11-30']).toBe('C');
      });

      it('should override existing date pattern', () => {
        const currentState = {
          ...initialState,
          weeklySchedule: { '2025-11-28': 'A' as PatternId },
        };
        const state = patternsReducer(
          currentState,
          setPatternForDate({ date: '2025-11-28', patternId: 'B' })
        );
        expect(state.weeklySchedule['2025-11-28']).toBe('B');
      });
    });

    describe('updatePatternStats', () => {
      it('should add new pattern stats', () => {
        const state = patternsReducer(initialState, updatePatternStats(mockPatternStats));
        expect(state.patternStats).toHaveLength(1);
        expect(state.patternStats[0]).toEqual(mockPatternStats);
      });

      it('should update existing pattern stats', () => {
        const currentState = {
          ...initialState,
          patternStats: [mockPatternStats],
        };
        const updatedStats: PatternStats = {
          ...mockPatternStats,
          timesUsed: 20,
          averageSatisfaction: 4.5,
        };
        const state = patternsReducer(currentState, updatePatternStats(updatedStats));

        expect(state.patternStats).toHaveLength(1);
        expect(state.patternStats[0].timesUsed).toBe(20);
        expect(state.patternStats[0].averageSatisfaction).toBe(4.5);
      });

      it('should add multiple different pattern stats', () => {
        let state = patternsReducer(initialState, updatePatternStats(mockPatternStats));
        const statsB: PatternStats = {
          patternId: 'B',
          timesUsed: 10,
          averageSatisfaction: 3.8,
          averageEnergy: 75,
          adherenceRate: 0.88,
          lastUsed: '2025-11-27',
        };
        state = patternsReducer(state, updatePatternStats(statsB));

        expect(state.patternStats).toHaveLength(2);
        expect(state.patternStats[0].patternId).toBe('A');
        expect(state.patternStats[1].patternId).toBe('B');
      });
    });

    describe('clearWeeklySchedule', () => {
      it('should clear all weekly schedule entries', () => {
        const currentState = {
          ...initialState,
          weeklySchedule: {
            '2025-11-28': 'A' as PatternId,
            '2025-11-29': 'B' as PatternId,
            '2025-11-30': 'C' as PatternId,
          },
        };
        const state = patternsReducer(currentState, clearWeeklySchedule());
        expect(state.weeklySchedule).toEqual({});
      });
    });

    describe('setPendingSwitch', () => {
      it('should set pending switch', () => {
        const state = patternsReducer(initialState, setPendingSwitch(mockPendingSwitch));
        expect(state.pendingSwitch).toEqual(mockPendingSwitch);
      });

      it('should clear pending switch when set to null', () => {
        const currentState = {
          ...initialState,
          pendingSwitch: mockPendingSwitch,
        };
        const state = patternsReducer(currentState, setPendingSwitch(null));
        expect(state.pendingSwitch).toBeNull();
      });
    });

    describe('switchPattern', () => {
      it('should execute pattern switch with all required data', () => {
        const switchPayload = {
          newPatternId: 'B' as PatternId,
          reason: 'Schedule change',
          caloriesConsumed: 1250,
          proteinConsumed: 95,
          recalculatedMeals: [mockRecalculatedMeal],
        };

        const state = patternsReducer(initialState, switchPattern(switchPayload));

        expect(state.selectedPattern).toBe('B');
        expect(state.todaySwitchCount).toBe(1);
        expect(state.pendingSwitch).toBeNull();
        expect(state.switchHistory).toHaveLength(1);
        expect(state.switchHistory[0].fromPattern).toBe('A');
        expect(state.switchHistory[0].toPattern).toBe('B');
        expect(state.switchHistory[0].reason).toBe('Schedule change');
        expect(state.switchHistory[0].caloriesConsumedBefore).toBe(1250);
        expect(state.switchHistory[0].proteinConsumedBefore).toBe(95);
      });

      it('should update weekly schedule with new pattern for today', () => {
        const today = new Date().toISOString().split('T')[0];
        const switchPayload = {
          newPatternId: 'C' as PatternId,
          caloriesConsumed: 900,
          proteinConsumed: 70,
          recalculatedMeals: [],
        };

        const state = patternsReducer(initialState, switchPattern(switchPayload));

        expect(state.weeklySchedule[today]).toBe('C');
      });

      it('should increment switch count on multiple switches', () => {
        let state = patternsReducer(
          initialState,
          switchPattern({
            newPatternId: 'B',
            caloriesConsumed: 400,
            proteinConsumed: 35,
            recalculatedMeals: [],
          })
        );

        state = patternsReducer(
          state,
          switchPattern({
            newPatternId: 'C',
            caloriesConsumed: 950,
            proteinConsumed: 90,
            recalculatedMeals: [],
          })
        );

        expect(state.todaySwitchCount).toBe(2);
        expect(state.switchHistory).toHaveLength(2);
      });

      it('should create unique switch record IDs', () => {
        const dateNowSpy = jest.spyOn(Date, 'now');

        // First call returns 1000
        dateNowSpy.mockReturnValueOnce(1000);
        let state = patternsReducer(
          initialState,
          switchPattern({
            newPatternId: 'B',
            caloriesConsumed: 400,
            proteinConsumed: 35,
            recalculatedMeals: [],
          })
        );

        // Second call returns 2000
        dateNowSpy.mockReturnValueOnce(2000);
        state = patternsReducer(
          state,
          switchPattern({
            newPatternId: 'C',
            caloriesConsumed: 950,
            proteinConsumed: 90,
            recalculatedMeals: [],
          })
        );

        expect(state.switchHistory[0].id).toBe('switch-1000');
        expect(state.switchHistory[1].id).toBe('switch-2000');
        expect(state.switchHistory[0].id).not.toBe(state.switchHistory[1].id);

        dateNowSpy.mockRestore();
      });
    });

    describe('cancelPendingSwitch', () => {
      it('should clear pending switch', () => {
        const currentState = {
          ...initialState,
          pendingSwitch: mockPendingSwitch,
        };
        const state = patternsReducer(currentState, cancelPendingSwitch());
        expect(state.pendingSwitch).toBeNull();
      });
    });

    describe('resetDailySwitchCount', () => {
      it('should reset switch count to zero', () => {
        const currentState = {
          ...initialState,
          todaySwitchCount: 3,
        };
        const state = patternsReducer(currentState, resetDailySwitchCount());
        expect(state.todaySwitchCount).toBe(0);
      });
    });

    describe('clearSwitchHistory', () => {
      it('should clear all switch history records', () => {
        const mockSwitchRecord: PatternSwitchRecord = {
          id: 'switch-1',
          date: '2025-11-28',
          fromPattern: 'A',
          toPattern: 'B',
          switchTime: '2025-11-28T15:30:00Z',
          reason: 'Test switch',
          caloriesConsumedBefore: 1200,
          proteinConsumedBefore: 90,
          recalculatedMeals: [],
        };

        const currentState = {
          ...initialState,
          switchHistory: [mockSwitchRecord],
        };
        const state = patternsReducer(currentState, clearSwitchHistory());
        expect(state.switchHistory).toEqual([]);
      });
    });

    describe('setLoading', () => {
      it('should set loading to true', () => {
        const state = patternsReducer(initialState, setLoading(true));
        expect(state.loading).toBe(true);
      });

      it('should set loading to false', () => {
        const currentState = { ...initialState, loading: true };
        const state = patternsReducer(currentState, setLoading(false));
        expect(state.loading).toBe(false);
      });
    });

    describe('setError', () => {
      it('should set error message', () => {
        const state = patternsReducer(initialState, setError('Network error'));
        expect(state.error).toBe('Network error');
      });

      it('should clear error when set to null', () => {
        const currentState = { ...initialState, error: 'Previous error' };
        const state = patternsReducer(currentState, setError(null));
        expect(state.error).toBeNull();
      });
    });
  });

  // =============================================================================
  // 3. Async Thunk Tests (12 tests)
  // =============================================================================

  describe('Async Thunks', () => {
    describe('fetchPatterns', () => {
      it('should handle pending state', () => {
        const action = { type: fetchPatterns.pending.type };
        const state = patternsReducer(initialState, action);
        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();
      });

      it('should handle successful fetch and merge with defaults', async () => {
        const customPattern: MealPattern = {
          id: 'A',
          name: 'Custom Traditional',
          description: 'Customized version',
          optimalFor: ['Custom'],
          meals: {
            morning: { time: '8:00 AM', calories: 500, protein: 40, components: [] },
            noon: { time: '1:00 PM', calories: 900, protein: 65, components: [] },
            evening: { time: '7:00 PM', calories: 400, protein: 30, components: [] },
          },
          totalCalories: 1800,
          totalProtein: 135,
        };

        const action = {
          type: fetchPatterns.fulfilled.type,
          payload: [customPattern],
        };
        const state = patternsReducer(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.patterns).toHaveLength(7); // Custom A + default B-G
        expect(state.patterns[0].name).toBe('Custom Traditional');
        expect(state.patterns.find(p => p.id === 'B')?.name).toBe('Reversed');
      });

      it('should handle rejection with error message', () => {
        const action = {
          type: fetchPatterns.rejected.type,
          payload: 'Failed to fetch patterns',
        };
        const state = patternsReducer(initialState, action);
        expect(state.loading).toBe(false);
        expect(state.error).toBe('Failed to fetch patterns');
      });
    });

    describe('fetchUserPreferences', () => {
      it('should handle pending state', () => {
        const action = { type: fetchUserPreferences.pending.type };
        const state = patternsReducer(initialState, action);
        expect(state.loading).toBe(true);
      });

      it('should update selected pattern from preferences', () => {
        const action = {
          type: fetchUserPreferences.fulfilled.type,
          payload: { defaultPattern: 'C', weeklySchedule: {} },
        };
        const state = patternsReducer(initialState, action);
        expect(state.loading).toBe(false);
        expect(state.selectedPattern).toBe('C');
      });

      it('should update weekly schedule from preferences', () => {
        const action = {
          type: fetchUserPreferences.fulfilled.type,
          payload: {
            defaultPattern: 'B',
            weeklySchedule: {
              '2025-11-28': 'A',
              '2025-11-29': 'B',
              '2025-11-30': 'C',
            },
          },
        };
        const state = patternsReducer(initialState, action);
        expect(state.weeklySchedule['2025-11-28']).toBe('A');
        expect(state.weeklySchedule['2025-11-29']).toBe('B');
        expect(state.weeklySchedule['2025-11-30']).toBe('C');
      });

      it('should handle rejection', () => {
        const action = {
          type: fetchUserPreferences.rejected.type,
          payload: 'Preferences not found',
        };
        const state = patternsReducer(initialState, action);
        expect(state.loading).toBe(false);
        expect(state.error).toBe('Preferences not found');
      });
    });

    describe('setDefaultPattern', () => {
      it('should update selected pattern on success', () => {
        const action = {
          type: setDefaultPattern.fulfilled.type,
          payload: 'D',
        };
        const state = patternsReducer(initialState, action);
        expect(state.selectedPattern).toBe('D');
      });

      it('should set error on rejection', () => {
        const action = {
          type: setDefaultPattern.rejected.type,
          payload: 'Failed to set default pattern',
        };
        const state = patternsReducer(initialState, action);
        expect(state.error).toBe('Failed to set default pattern');
      });
    });

    describe('selectPatternForToday', () => {
      it('should handle pending state', () => {
        const action = { type: selectPatternForToday.pending.type };
        const state = patternsReducer(initialState, action);
        expect(state.loading).toBe(true);
      });

      it('should update pattern and weekly schedule on success', () => {
        const today = new Date().toISOString().split('T')[0];
        const action = {
          type: selectPatternForToday.fulfilled.type,
          payload: { patternCode: 'E' },
        };
        const state = patternsReducer(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.selectedPattern).toBe('E');
        expect(state.weeklySchedule[today]).toBe('E');
      });

      it('should handle rejection', () => {
        const action = {
          type: selectPatternForToday.rejected.type,
          payload: 'Pattern selection failed',
        };
        const state = patternsReducer(initialState, action);
        expect(state.loading).toBe(false);
        expect(state.error).toBe('Pattern selection failed');
      });
    });

    describe('ratePattern', () => {
      it('should handle successful rating (no state change expected)', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const action = {
          type: ratePattern.fulfilled.type,
          payload: { date: '2025-11-28', ratings: { satisfaction: 4, energy: 5 } },
        };
        const state = patternsReducer(initialState, action);

        expect(state).toEqual(initialState);
        expect(consoleSpy).toHaveBeenCalledWith(
          'Pattern rated:',
          { date: '2025-11-28', ratings: { satisfaction: 4, energy: 5 } }
        );
        consoleSpy.mockRestore();
      });
    });

    describe('fetchPatternHistory', () => {
      it('should update weekly schedule from history', () => {
        const action = {
          type: fetchPatternHistory.fulfilled.type,
          payload: [
            { date: '2025-11-25', patternCode: 'A' },
            { date: '2025-11-26', patternCode: 'B' },
            { date: '2025-11-27', patternCode: 'C' },
          ],
        };
        const state = patternsReducer(initialState, action);

        expect(state.weeklySchedule['2025-11-25']).toBe('A');
        expect(state.weeklySchedule['2025-11-26']).toBe('B');
        expect(state.weeklySchedule['2025-11-27']).toBe('C');
      });
    });

    describe('fetchPatternStatistics', () => {
      it('should handle pending state', () => {
        const action = { type: fetchPatternStatistics.pending.type };
        const state = patternsReducer(initialState, action);
        expect(state.loading).toBe(true);
      });

      it('should update pattern stats on success', () => {
        const stats: PatternStats[] = [
          mockPatternStats,
          {
            patternId: 'B',
            timesUsed: 8,
            averageSatisfaction: 3.9,
            averageEnergy: 78,
            adherenceRate: 0.85,
            lastUsed: '2025-11-27',
          },
        ];

        const action = {
          type: fetchPatternStatistics.fulfilled.type,
          payload: stats,
        };
        const state = patternsReducer(initialState, action);

        expect(state.loading).toBe(false);
        expect(state.patternStats).toEqual(stats);
      });

      it('should handle rejection', () => {
        const action = {
          type: fetchPatternStatistics.rejected.type,
          payload: 'Statistics unavailable',
        };
        const state = patternsReducer(initialState, action);
        expect(state.loading).toBe(false);
        expect(state.error).toBe('Statistics unavailable');
      });
    });
  });

  // =============================================================================
  // 4. Selectors Tests (6 tests)
  // =============================================================================

  describe('Selectors', () => {
    const mockRootState = {
      patterns: {
        ...initialState,
        patterns: defaultPatterns,
        selectedPattern: 'A' as PatternId,
        pendingSwitch: mockPendingSwitch,
        todaySwitchCount: 2,
        switchHistory: [
          {
            id: 'switch-1',
            date: '2025-11-28',
            fromPattern: 'A' as PatternId,
            toPattern: 'B' as PatternId,
            switchTime: '2025-11-28T15:00:00Z',
            reason: 'Schedule change',
            caloriesConsumedBefore: 1200,
            proteinConsumedBefore: 90,
            recalculatedMeals: [],
          },
        ],
      },
    };

    it('selectPatterns should return all patterns', () => {
      const patterns = selectPatterns(mockRootState);
      expect(patterns).toEqual(defaultPatterns);
      expect(patterns).toHaveLength(7);
    });

    it('selectSelectedPattern should return selected pattern ID', () => {
      const patternId = selectSelectedPattern(mockRootState);
      expect(patternId).toBe('A');
    });

    it('selectPendingSwitch should return pending switch', () => {
      const pending = selectPendingSwitch(mockRootState);
      expect(pending).toEqual(mockPendingSwitch);
    });

    it('selectTodaySwitchCount should return switch count', () => {
      const count = selectTodaySwitchCount(mockRootState);
      expect(count).toBe(2);
    });

    it('selectSwitchHistory should return switch history', () => {
      const history = selectSwitchHistory(mockRootState);
      expect(history).toHaveLength(1);
      expect(history[0].fromPattern).toBe('A');
      expect(history[0].toPattern).toBe('B');
    });

    it('selectCurrentPattern should return full pattern object for selected ID', () => {
      const pattern = selectCurrentPattern(mockRootState);
      expect(pattern).toBeDefined();
      expect(pattern?.id).toBe('A');
      expect(pattern?.name).toBe('Traditional');
      expect(pattern?.totalCalories).toBe(1800);
    });

    it('selectCurrentPattern should return undefined for non-existent pattern', () => {
      const stateWithInvalidPattern = {
        patterns: {
          ...mockRootState.patterns,
          selectedPattern: 'Z' as PatternId,
        },
      };
      const pattern = selectCurrentPattern(stateWithInvalidPattern);
      expect(pattern).toBeUndefined();
    });
  });
});
