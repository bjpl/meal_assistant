import { configureStore } from '@reduxjs/toolkit';
import analyticsReducer, {
  // Actions
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
  // Async thunks
  fetchPatternStats,
  fetchWeightTrend,
  fetchAdherenceStats,
  fetchNutritionSummary,
  fetchMLRecommendations,
  trainMLModel,
  // Selectors
  selectWeightEntries,
  selectTargetWeight,
  selectPatternEffectiveness,
  selectCurrentRecommendation,
  selectDayCorrelations,
  selectPriceHistory,
  selectDealScore,
  selectWeightTrend,
  selectBestPattern,
} from '../../../src/mobile/store/slices/analyticsSlice';
import {
  PatternEffectivenessMetrics,
  PatternRecommendation,
  DayOfWeekCorrelation,
  WeatherCorrelation,
  StressCorrelation,
  ScheduleCorrelation,
  PriceHistory,
  DealQualityScore,
} from '../../../src/mobile/types/analytics.types';
import { WeightEntry, DailyStats } from '../../../src/mobile/types';
import { analyticsApi } from '../../../src/mobile/services/apiService';

// Mock the API service
jest.mock('../../../src/mobile/services/apiService', () => ({
  analyticsApi: {
    getPatternStats: jest.fn(),
    getWeightTrend: jest.fn(),
    getAdherenceStats: jest.fn(),
    getNutritionSummary: jest.fn(),
    getMLRecommendations: jest.fn(),
    trainModel: jest.fn(),
  },
}));

describe('analyticsSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        analytics: analyticsReducer,
      },
    });
    jest.clearAllMocks();
  });

  // ============================================================================
  // INITIAL STATE TESTS
  // ============================================================================

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState().analytics;

      expect(state.weightEntries).toEqual([]);
      expect(state.targetWeight).toBeNull();
      expect(state.dailyStats).toEqual([]);
      expect(state.patternStats).toEqual([]);
      expect(state.patternEffectiveness).toEqual([]);
      expect(state.dayCorrelations).toEqual([]);
      expect(state.weatherCorrelations).toEqual([]);
      expect(state.stressCorrelations).toEqual([]);
      expect(state.scheduleCorrelations).toEqual([]);
      expect(state.currentRecommendation).toBeNull();
      expect(state.recommendationHistory).toEqual([]);
      expect(state.priceHistories).toEqual({});
      expect(state.dealScores).toEqual({});
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastUpdated).toBeNull();
    });
  });

  // ============================================================================
  // WEIGHT TRACKING REDUCERS
  // ============================================================================

  describe('Weight Tracking', () => {
    const weightEntry1: WeightEntry = {
      date: '2025-01-15',
      weight: 180,
      notes: 'Morning weight',
    };

    const weightEntry2: WeightEntry = {
      date: '2025-01-16',
      weight: 179.5,
    };

    const weightEntry3: WeightEntry = {
      date: '2025-01-14',
      weight: 180.5,
    };

    it('should add weight entry', () => {
      store.dispatch(addWeightEntry(weightEntry1));

      const state = store.getState().analytics;
      expect(state.weightEntries).toHaveLength(1);
      expect(state.weightEntries[0]).toEqual(weightEntry1);
    });

    it('should add multiple weight entries and sort by date descending', () => {
      store.dispatch(addWeightEntry(weightEntry1));
      store.dispatch(addWeightEntry(weightEntry2));
      store.dispatch(addWeightEntry(weightEntry3));

      const state = store.getState().analytics;
      expect(state.weightEntries).toHaveLength(3);
      expect(state.weightEntries[0].date).toBe('2025-01-16'); // Most recent first
      expect(state.weightEntries[1].date).toBe('2025-01-15');
      expect(state.weightEntries[2].date).toBe('2025-01-14');
    });

    it('should update weight entry', () => {
      store.dispatch(addWeightEntry(weightEntry1));
      store.dispatch(updateWeightEntry({
        date: '2025-01-15',
        updates: { weight: 181, notes: 'Updated weight' },
      }));

      const state = store.getState().analytics;
      expect(state.weightEntries[0].weight).toBe(181);
      expect(state.weightEntries[0].notes).toBe('Updated weight');
    });

    it('should not update non-existent weight entry', () => {
      store.dispatch(addWeightEntry(weightEntry1));
      store.dispatch(updateWeightEntry({
        date: '2025-01-20',
        updates: { weight: 185 },
      }));

      const state = store.getState().analytics;
      expect(state.weightEntries).toHaveLength(1);
      expect(state.weightEntries[0].weight).toBe(180); // Unchanged
    });

    it('should delete weight entry', () => {
      store.dispatch(addWeightEntry(weightEntry1));
      store.dispatch(addWeightEntry(weightEntry2));
      store.dispatch(deleteWeightEntry('2025-01-15'));

      const state = store.getState().analytics;
      expect(state.weightEntries).toHaveLength(1);
      expect(state.weightEntries[0].date).toBe('2025-01-16');
    });

    it('should set target weight', () => {
      store.dispatch(setTargetWeight(175));

      const state = store.getState().analytics;
      expect(state.targetWeight).toBe(175);
    });

    it('should set target weight to null', () => {
      store.dispatch(setTargetWeight(175));
      store.dispatch(setTargetWeight(null));

      const state = store.getState().analytics;
      expect(state.targetWeight).toBeNull();
    });
  });

  // ============================================================================
  // DAILY STATS REDUCERS
  // ============================================================================

  describe('Daily Stats', () => {
    const dailyStats1: DailyStats = {
      date: '2025-01-15',
      patternId: 'A',
      totalCalories: 1800,
      totalProtein: 150,
      mealsLogged: 3,
      adherenceScore: 95,
      averageSatisfaction: 4.5,
      averageEnergy: 80,
    };

    const dailyStats2: DailyStats = {
      date: '2025-01-16',
      patternId: 'B',
      totalCalories: 1750,
      totalProtein: 140,
      mealsLogged: 3,
      adherenceScore: 90,
      averageSatisfaction: 4.0,
      averageEnergy: 75,
    };

    it('should add daily stats', () => {
      store.dispatch(addDailyStats(dailyStats1));

      const state = store.getState().analytics;
      expect(state.dailyStats).toHaveLength(1);
      expect(state.dailyStats[0]).toEqual(dailyStats1);
    });

    it('should add multiple daily stats and sort by date descending', () => {
      store.dispatch(addDailyStats(dailyStats1));
      store.dispatch(addDailyStats(dailyStats2));

      const state = store.getState().analytics;
      expect(state.dailyStats).toHaveLength(2);
      expect(state.dailyStats[0].date).toBe('2025-01-16');
      expect(state.dailyStats[1].date).toBe('2025-01-15');
    });

    it('should update existing daily stats for same date', () => {
      store.dispatch(addDailyStats(dailyStats1));
      const updatedStats: DailyStats = {
        ...dailyStats1,
        mealsLogged: 4,
        adherenceScore: 100,
      };
      store.dispatch(addDailyStats(updatedStats));

      const state = store.getState().analytics;
      expect(state.dailyStats).toHaveLength(1); // Should not duplicate
      expect(state.dailyStats[0].mealsLogged).toBe(4);
      expect(state.dailyStats[0].adherenceScore).toBe(100);
    });
  });

  // ============================================================================
  // PATTERN EFFECTIVENESS REDUCERS
  // ============================================================================

  describe('Pattern Effectiveness', () => {
    const effectiveness1: PatternEffectivenessMetrics = {
      patternId: 'A',
      patternName: 'Morning Fuel',
      successRate: 85,
      weightChangeAvg: -0.5,
      energyLevelAvg: 80,
      satisfactionScore: 4.5,
      adherenceRate: 90,
      totalDaysUsed: 30,
      currentStreak: 5,
    };

    const effectiveness2: PatternEffectivenessMetrics = {
      patternId: 'B',
      patternName: 'Balanced Day',
      successRate: 90,
      weightChangeAvg: -0.6,
      energyLevelAvg: 85,
      satisfactionScore: 4.8,
      adherenceRate: 95,
      totalDaysUsed: 25,
      currentStreak: 10,
    };

    it('should set pattern effectiveness array', () => {
      store.dispatch(setPatternEffectiveness([effectiveness1, effectiveness2]));

      const state = store.getState().analytics;
      expect(state.patternEffectiveness).toHaveLength(2);
      expect(state.patternEffectiveness[0]).toEqual(effectiveness1);
      expect(state.patternEffectiveness[1]).toEqual(effectiveness2);
    });

    it('should update existing pattern effectiveness', () => {
      store.dispatch(setPatternEffectiveness([effectiveness1]));
      const updated: PatternEffectivenessMetrics = {
        ...effectiveness1,
        successRate: 90,
        currentStreak: 10,
      };
      store.dispatch(updatePatternEffectiveness(updated));

      const state = store.getState().analytics;
      expect(state.patternEffectiveness).toHaveLength(1);
      expect(state.patternEffectiveness[0].successRate).toBe(90);
      expect(state.patternEffectiveness[0].currentStreak).toBe(10);
    });

    it('should add new pattern effectiveness if not exists', () => {
      store.dispatch(setPatternEffectiveness([effectiveness1]));
      store.dispatch(updatePatternEffectiveness(effectiveness2));

      const state = store.getState().analytics;
      expect(state.patternEffectiveness).toHaveLength(2);
      expect(state.patternEffectiveness[1].patternId).toBe('B');
    });
  });

  // ============================================================================
  // CONTEXT CORRELATIONS REDUCERS
  // ============================================================================

  describe('Context Correlations', () => {
    const dayCorrelations: DayOfWeekCorrelation[] = [
      { day: 'monday', bestPattern: 'A', successRate: 85 },
      { day: 'tuesday', bestPattern: 'B', successRate: 90 },
    ];

    const weatherCorrelations: WeatherCorrelation[] = [
      { weather: 'sunny', bestPattern: 'A', successRate: 88 },
      { weather: 'rainy', bestPattern: 'C', successRate: 82 },
    ];

    const stressCorrelations: StressCorrelation[] = [
      { level: 'low', bestPattern: 'A', successRate: 92 },
      { level: 'high', bestPattern: 'D', successRate: 78 },
    ];

    const scheduleCorrelations: ScheduleCorrelation[] = [
      { type: 'work', bestPattern: 'A', successRate: 87 },
      { type: 'weekend', bestPattern: 'B', successRate: 93 },
    ];

    it('should set day correlations', () => {
      store.dispatch(setDayCorrelations(dayCorrelations));

      const state = store.getState().analytics;
      expect(state.dayCorrelations).toEqual(dayCorrelations);
    });

    it('should set weather correlations', () => {
      store.dispatch(setWeatherCorrelations(weatherCorrelations));

      const state = store.getState().analytics;
      expect(state.weatherCorrelations).toEqual(weatherCorrelations);
    });

    it('should set stress correlations', () => {
      store.dispatch(setStressCorrelations(stressCorrelations));

      const state = store.getState().analytics;
      expect(state.stressCorrelations).toEqual(stressCorrelations);
    });

    it('should set schedule correlations', () => {
      store.dispatch(setScheduleCorrelations(scheduleCorrelations));

      const state = store.getState().analytics;
      expect(state.scheduleCorrelations).toEqual(scheduleCorrelations);
    });
  });

  // ============================================================================
  // AI RECOMMENDATIONS REDUCERS
  // ============================================================================

  describe('AI Recommendations', () => {
    const recommendation1: PatternRecommendation = {
      recommendedPattern: 'A',
      patternName: 'Morning Fuel',
      confidence: 85,
      reasoning: ['High success rate on weekdays', 'Good energy levels'],
      contextFactors: ['Monday', 'Work day'],
      fatigueWarning: false,
      consecutiveDays: 3,
      alternativePatterns: ['B', 'C'],
    };

    const recommendation2: PatternRecommendation = {
      recommendedPattern: 'B',
      patternName: 'Balanced Day',
      confidence: 90,
      reasoning: ['Weekend pattern', 'More time for meals'],
      contextFactors: ['Saturday', 'Weekend'],
      fatigueWarning: false,
      consecutiveDays: 1,
      alternativePatterns: ['A'],
    };

    it('should set current recommendation', () => {
      store.dispatch(setCurrentRecommendation(recommendation1));

      const state = store.getState().analytics;
      expect(state.currentRecommendation).toEqual(recommendation1);
      expect(state.recommendationHistory).toHaveLength(0);
    });

    it('should move previous recommendation to history when setting new one', () => {
      store.dispatch(setCurrentRecommendation(recommendation1));
      store.dispatch(setCurrentRecommendation(recommendation2));

      const state = store.getState().analytics;
      expect(state.currentRecommendation).toEqual(recommendation2);
      expect(state.recommendationHistory).toHaveLength(1);
      expect(state.recommendationHistory[0]).toEqual(recommendation1);
    });

    it('should accept recommendation and clear current', () => {
      store.dispatch(setCurrentRecommendation(recommendation1));
      store.dispatch(acceptRecommendation('A'));

      const state = store.getState().analytics;
      expect(state.currentRecommendation).toBeNull();
      expect(state.recommendationHistory).toHaveLength(1);
      expect(state.recommendationHistory[0]).toEqual(recommendation1);
    });

    it('should reject recommendation and clear current', () => {
      store.dispatch(setCurrentRecommendation(recommendation1));
      store.dispatch(rejectRecommendation());

      const state = store.getState().analytics;
      expect(state.currentRecommendation).toBeNull();
      expect(state.recommendationHistory).toHaveLength(1);
      expect(state.recommendationHistory[0]).toEqual(recommendation1);
    });

    it('should handle accept with no current recommendation', () => {
      store.dispatch(acceptRecommendation('A'));

      const state = store.getState().analytics;
      expect(state.currentRecommendation).toBeNull();
      expect(state.recommendationHistory).toHaveLength(0);
    });

    it('should handle reject with no current recommendation', () => {
      store.dispatch(rejectRecommendation());

      const state = store.getState().analytics;
      expect(state.currentRecommendation).toBeNull();
      expect(state.recommendationHistory).toHaveLength(0);
    });
  });

  // ============================================================================
  // PRICE INTELLIGENCE REDUCERS
  // ============================================================================

  describe('Price Intelligence', () => {
    const priceHistory: PriceHistory = {
      itemName: 'Chicken Breast',
      points: [
        {
          id: 'point-1',
          itemName: 'Chicken Breast',
          price: 4.99,
          store: 'Walmart',
          date: '2025-01-01',
          isOnSale: false,
        },
        {
          id: 'point-2',
          itemName: 'Chicken Breast',
          price: 3.99,
          store: 'Walmart',
          date: '2025-01-08',
          isOnSale: true,
        },
      ],
      qualityLevel: 'insufficient',
      pointsNeeded: 18,
      averagePrice: 4.49,
      historicalLow: 3.99,
      historicalHigh: 4.99,
      currentPrice: 3.99,
      priceDropAlert: false,
    };

    const dealScore: DealQualityScore = {
      score: 8.5,
      assessment: 'excellent',
      vs30DayAvg: -15,
      vs90DayAvg: -12,
      vsHistoricalLow: 5,
      trueSavings: 15,
      isFakeDeal: false,
      warnings: [],
    };

    it('should set price history for item', () => {
      store.dispatch(setPriceHistory({
        itemName: 'Chicken Breast',
        history: priceHistory,
      }));

      const state = store.getState().analytics;
      expect(state.priceHistories['Chicken Breast']).toEqual(priceHistory);
    });

    it('should add price point and recalculate stats', () => {
      store.dispatch(setPriceHistory({
        itemName: 'Chicken Breast',
        history: priceHistory,
      }));

      store.dispatch(addPricePoint({
        itemName: 'Chicken Breast',
        price: 5.49,
        store: 'Safeway',
        isOnSale: false,
      }));

      const state = store.getState().analytics;
      const updated = state.priceHistories['Chicken Breast'];

      expect(updated.points).toHaveLength(3);
      expect(updated.currentPrice).toBe(5.49);
      expect(updated.historicalHigh).toBe(5.49);
      expect(updated.averagePrice).toBeCloseTo(4.82, 1);
    });

    it('should update quality level as points accumulate', () => {
      const initialHistory: PriceHistory = {
        ...priceHistory,
        points: Array(4).fill(null).map((_, i) => ({
          id: `point-${i}`,
          itemName: 'Chicken Breast',
          price: 4.99,
          store: 'Walmart',
          date: `2025-01-${i + 1}`,
          isOnSale: false,
        })),
        qualityLevel: 'insufficient',
        pointsNeeded: 16,
      };

      store.dispatch(setPriceHistory({
        itemName: 'Chicken Breast',
        history: initialHistory,
      }));

      // Add one more to reach 5 points (emerging)
      store.dispatch(addPricePoint({
        itemName: 'Chicken Breast',
        price: 4.99,
        store: 'Walmart',
        isOnSale: false,
      }));

      const state = store.getState().analytics;
      expect(state.priceHistories['Chicken Breast'].qualityLevel).toBe('emerging');
      expect(state.priceHistories['Chicken Breast'].pointsNeeded).toBe(15);
    });

    it('should set price drop alert when price is 20% below average', () => {
      // Create history with multiple high prices to maintain high average
      const historyWithAvg: PriceHistory = {
        ...priceHistory,
        averagePrice: 5.00,
        points: [
          {
            id: 'point-1',
            itemName: 'Chicken Breast',
            price: 5.00,
            store: 'Walmart',
            date: '2025-01-01',
            isOnSale: false,
          },
          {
            id: 'point-2',
            itemName: 'Chicken Breast',
            price: 5.00,
            store: 'Walmart',
            date: '2025-01-02',
            isOnSale: false,
          },
          {
            id: 'point-3',
            itemName: 'Chicken Breast',
            price: 5.00,
            store: 'Walmart',
            date: '2025-01-03',
            isOnSale: false,
          },
        ],
      };

      store.dispatch(setPriceHistory({
        itemName: 'Chicken Breast',
        history: historyWithAvg,
      }));

      // Add price that's more than 20% below old average
      // New avg will be (5 + 5 + 5 + 3.50) / 4 = 4.625
      // For alert to trigger, price <= 4.625 * 0.8 = 3.70
      store.dispatch(addPricePoint({
        itemName: 'Chicken Breast',
        price: 3.50, // Well below threshold
        store: 'Walmart',
        isOnSale: true,
      }));

      const state = store.getState().analytics;
      const updated = state.priceHistories['Chicken Breast'];

      expect(updated.priceDropAlert).toBe(true);
      expect(updated.dropPercentage).toBeGreaterThan(20);
    });

    it('should not set price drop alert for normal prices', () => {
      store.dispatch(setPriceHistory({
        itemName: 'Chicken Breast',
        history: priceHistory,
      }));

      store.dispatch(addPricePoint({
        itemName: 'Chicken Breast',
        price: 4.49, // Same as average
        store: 'Walmart',
        isOnSale: false,
      }));

      const state = store.getState().analytics;
      expect(state.priceHistories['Chicken Breast'].priceDropAlert).toBe(false);
    });

    it('should set deal score', () => {
      store.dispatch(setDealScore({
        dealId: 'deal-123',
        score: dealScore,
      }));

      const state = store.getState().analytics;
      expect(state.dealScores['deal-123']).toEqual(dealScore);
    });

    it('should handle adding price point to non-existent history gracefully', () => {
      store.dispatch(addPricePoint({
        itemName: 'Unknown Item',
        price: 9.99,
        store: 'Walmart',
        isOnSale: false,
      }));

      const state = store.getState().analytics;
      expect(state.priceHistories['Unknown Item']).toBeUndefined();
    });
  });

  // ============================================================================
  // STATE MANAGEMENT REDUCERS
  // ============================================================================

  describe('State Management', () => {
    it('should set loading state', () => {
      store.dispatch(setLoading(true));
      expect(store.getState().analytics.loading).toBe(true);

      store.dispatch(setLoading(false));
      expect(store.getState().analytics.loading).toBe(false);
    });

    it('should set error state', () => {
      store.dispatch(setError('Test error'));
      expect(store.getState().analytics.error).toBe('Test error');

      store.dispatch(setError(null));
      expect(store.getState().analytics.error).toBeNull();
    });

    it('should update last updated timestamp', () => {
      const beforeUpdate = new Date().toISOString();
      store.dispatch(updateLastUpdated());
      const afterUpdate = new Date().toISOString();

      const state = store.getState().analytics;
      expect(state.lastUpdated).toBeTruthy();
      expect(state.lastUpdated! >= beforeUpdate).toBe(true);
      expect(state.lastUpdated! <= afterUpdate).toBe(true);
    });

    it('should clear all analytics data', () => {
      // Add some data
      store.dispatch(setTargetWeight(175));
      store.dispatch(addWeightEntry({ date: '2025-01-15', weight: 180 }));
      store.dispatch(setError('Some error'));
      store.dispatch(setLoading(true));

      // Clear everything
      store.dispatch(clearAnalytics());

      const state = store.getState().analytics;
      expect(state.weightEntries).toEqual([]);
      expect(state.targetWeight).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastUpdated).toBeNull();
    });
  });

  // ============================================================================
  // ASYNC THUNK TESTS - fetchPatternStats
  // ============================================================================

  describe('fetchPatternStats', () => {
    const mockEffectiveness: PatternEffectivenessMetrics[] = [
      {
        patternId: 'A',
        patternName: 'Morning Fuel',
        successRate: 85,
        weightChangeAvg: -0.5,
        energyLevelAvg: 80,
        satisfactionScore: 4.5,
        adherenceRate: 90,
        totalDaysUsed: 30,
        currentStreak: 5,
      },
    ];

    it('should handle fetchPatternStats pending', async () => {
      (analyticsApi.getPatternStats as jest.Mock).mockReturnValue(
        new Promise(() => {}) // Never resolves
      );

      store.dispatch(fetchPatternStats(30));

      const state = store.getState().analytics;
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fetchPatternStats fulfilled', async () => {
      (analyticsApi.getPatternStats as jest.Mock).mockResolvedValue({
        success: true,
        data: mockEffectiveness,
      });

      await store.dispatch(fetchPatternStats(30));

      const state = store.getState().analytics;
      expect(state.loading).toBe(false);
      expect(state.patternEffectiveness).toEqual(mockEffectiveness);
      expect(state.lastUpdated).toBeTruthy();
    });

    it('should handle fetchPatternStats rejected', async () => {
      (analyticsApi.getPatternStats as jest.Mock).mockResolvedValue({
        error: true,
        message: 'Failed to fetch pattern stats',
      });

      await store.dispatch(fetchPatternStats(30));

      const state = store.getState().analytics;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to fetch pattern stats');
    });

    it('should call API with correct days parameter', async () => {
      (analyticsApi.getPatternStats as jest.Mock).mockResolvedValue({
        success: true,
        data: mockEffectiveness,
      });

      await store.dispatch(fetchPatternStats(60));

      expect(analyticsApi.getPatternStats).toHaveBeenCalledWith(60);
    });
  });

  // ============================================================================
  // ASYNC THUNK TESTS - fetchWeightTrend
  // ============================================================================

  describe('fetchWeightTrend', () => {
    const mockWeightData = {
      entries: [
        { date: '2025-01-15', weight: 180 },
        { date: '2025-01-14', weight: 180.5 },
      ],
      targetWeight: 175,
    };

    it('should handle fetchWeightTrend fulfilled', async () => {
      (analyticsApi.getWeightTrend as jest.Mock).mockResolvedValue({
        success: true,
        data: mockWeightData,
      });

      await store.dispatch(fetchWeightTrend());

      const state = store.getState().analytics;
      expect(state.weightEntries).toEqual(mockWeightData.entries);
      expect(state.targetWeight).toBe(175);
      expect(state.lastUpdated).toBeTruthy();
    });

    it('should handle fetchWeightTrend with error', async () => {
      (analyticsApi.getWeightTrend as jest.Mock).mockResolvedValue({
        error: true,
        message: 'Failed to fetch weight trend',
      });

      await store.dispatch(fetchWeightTrend());

      const state = store.getState().analytics;
      expect(state.weightEntries).toEqual([]);
    });
  });

  // ============================================================================
  // ASYNC THUNK TESTS - fetchAdherenceStats
  // ============================================================================

  describe('fetchAdherenceStats', () => {
    const mockAdherenceData = {
      dailyStats: [
        {
          date: '2025-01-15',
          patternId: 'A' as const,
          totalCalories: 1800,
          totalProtein: 150,
          mealsLogged: 3,
          adherenceScore: 95,
          averageSatisfaction: 4.5,
          averageEnergy: 80,
        },
      ],
    };

    it('should handle fetchAdherenceStats fulfilled', async () => {
      (analyticsApi.getAdherenceStats as jest.Mock).mockResolvedValue({
        success: true,
        data: mockAdherenceData,
      });

      await store.dispatch(fetchAdherenceStats());

      const state = store.getState().analytics;
      expect(state.dailyStats).toEqual(mockAdherenceData.dailyStats);
      expect(state.lastUpdated).toBeTruthy();
    });

    it('should handle fetchAdherenceStats with date options', async () => {
      (analyticsApi.getAdherenceStats as jest.Mock).mockResolvedValue({
        success: true,
        data: mockAdherenceData,
      });

      await store.dispatch(fetchAdherenceStats({
        startDate: '2025-01-01',
        endDate: '2025-01-15',
      }));

      expect(analyticsApi.getAdherenceStats).toHaveBeenCalledWith({
        startDate: '2025-01-01',
        endDate: '2025-01-15',
      });
    });
  });

  // ============================================================================
  // ASYNC THUNK TESTS - fetchNutritionSummary
  // ============================================================================

  describe('fetchNutritionSummary', () => {
    it('should handle fetchNutritionSummary fulfilled', async () => {
      const mockNutritionData = {
        totalCalories: 1800,
        totalProtein: 150,
        totalCarbs: 180,
        totalFat: 60,
      };

      (analyticsApi.getNutritionSummary as jest.Mock).mockResolvedValue({
        success: true,
        data: mockNutritionData,
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await store.dispatch(fetchNutritionSummary('2025-01-15'));

      expect(consoleSpy).toHaveBeenCalledWith('Nutrition summary:', mockNutritionData);
      consoleSpy.mockRestore();
    });

    it('should call API with date parameter', async () => {
      (analyticsApi.getNutritionSummary as jest.Mock).mockResolvedValue({
        success: true,
        data: {},
      });

      await store.dispatch(fetchNutritionSummary('2025-01-20'));

      expect(analyticsApi.getNutritionSummary).toHaveBeenCalledWith('2025-01-20');
    });
  });

  // ============================================================================
  // ASYNC THUNK TESTS - fetchMLRecommendations
  // ============================================================================

  describe('fetchMLRecommendations', () => {
    const mockRecommendation: PatternRecommendation = {
      recommendedPattern: 'A',
      patternName: 'Morning Fuel',
      confidence: 85,
      reasoning: ['High success rate'],
      contextFactors: ['Monday'],
      fatigueWarning: false,
      consecutiveDays: 3,
      alternativePatterns: ['B'],
    };

    it('should handle fetchMLRecommendations pending', async () => {
      (analyticsApi.getMLRecommendations as jest.Mock).mockReturnValue(
        new Promise(() => {})
      );

      store.dispatch(fetchMLRecommendations());

      const state = store.getState().analytics;
      expect(state.loading).toBe(true);
    });

    it('should handle fetchMLRecommendations fulfilled', async () => {
      (analyticsApi.getMLRecommendations as jest.Mock).mockResolvedValue({
        success: true,
        data: mockRecommendation,
      });

      await store.dispatch(fetchMLRecommendations());

      const state = store.getState().analytics;
      expect(state.loading).toBe(false);
      expect(state.currentRecommendation).toEqual(mockRecommendation);
      expect(state.lastUpdated).toBeTruthy();
    });

    it('should handle fetchMLRecommendations rejected', async () => {
      (analyticsApi.getMLRecommendations as jest.Mock).mockResolvedValue({
        error: true,
        message: 'ML service unavailable',
      });

      await store.dispatch(fetchMLRecommendations());

      const state = store.getState().analytics;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('ML service unavailable');
    });
  });

  // ============================================================================
  // ASYNC THUNK TESTS - trainMLModel
  // ============================================================================

  describe('trainMLModel', () => {
    it('should handle trainMLModel fulfilled', async () => {
      (analyticsApi.trainModel as jest.Mock).mockResolvedValue({
        success: true,
        data: { modelId: 'model-123' },
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await store.dispatch(trainMLModel({ trainingData: 'mock-data' }));

      expect(consoleSpy).toHaveBeenCalledWith('ML model trained successfully');
      consoleSpy.mockRestore();
    });

    it('should call API with training data', async () => {
      (analyticsApi.trainModel as jest.Mock).mockResolvedValue({
        success: true,
        data: {},
      });

      const trainingData = { patterns: ['A', 'B'], outcomes: [85, 90] };
      await store.dispatch(trainMLModel(trainingData));

      expect(analyticsApi.trainModel).toHaveBeenCalledWith(trainingData);
    });
  });

  // ============================================================================
  // SELECTOR TESTS
  // ============================================================================

  describe('Selectors', () => {
    beforeEach(() => {
      // Setup test data
      store.dispatch(addWeightEntry({ date: '2025-01-15', weight: 180 }));
      store.dispatch(setTargetWeight(175));
      store.dispatch(setPatternEffectiveness([
        {
          patternId: 'A',
          patternName: 'Morning Fuel',
          successRate: 85,
          weightChangeAvg: -0.5,
          energyLevelAvg: 80,
          satisfactionScore: 4.5,
          adherenceRate: 90,
          totalDaysUsed: 30,
          currentStreak: 5,
        },
        {
          patternId: 'B',
          patternName: 'Balanced',
          successRate: 92,
          weightChangeAvg: -0.7,
          energyLevelAvg: 85,
          satisfactionScore: 4.8,
          adherenceRate: 95,
          totalDaysUsed: 25,
          currentStreak: 10,
        },
      ]));
      store.dispatch(setCurrentRecommendation({
        recommendedPattern: 'A',
        patternName: 'Morning Fuel',
        confidence: 85,
        reasoning: [],
        contextFactors: [],
        fatigueWarning: false,
        consecutiveDays: 3,
        alternativePatterns: [],
      }));
      store.dispatch(setDayCorrelations([
        { day: 'monday', bestPattern: 'A', successRate: 85 },
      ]));
      store.dispatch(setPriceHistory({
        itemName: 'Chicken',
        history: {
          itemName: 'Chicken',
          points: [],
          qualityLevel: 'insufficient',
          pointsNeeded: 20,
          averagePrice: 4.99,
          historicalLow: 3.99,
          historicalHigh: 5.99,
          currentPrice: 4.99,
          priceDropAlert: false,
        },
      }));
      store.dispatch(setDealScore({
        dealId: 'deal-1',
        score: {
          score: 8.5,
          assessment: 'excellent',
          vs30DayAvg: -15,
          vs90DayAvg: -12,
          vsHistoricalLow: 5,
          trueSavings: 15,
          isFakeDeal: false,
          warnings: [],
        },
      }));
    });

    it('should select weight entries', () => {
      const entries = selectWeightEntries(store.getState());
      expect(entries).toHaveLength(1);
      expect(entries[0].weight).toBe(180);
    });

    it('should select target weight', () => {
      const target = selectTargetWeight(store.getState());
      expect(target).toBe(175);
    });

    it('should select pattern effectiveness', () => {
      const effectiveness = selectPatternEffectiveness(store.getState());
      expect(effectiveness).toHaveLength(2);
    });

    it('should select current recommendation', () => {
      const recommendation = selectCurrentRecommendation(store.getState());
      expect(recommendation?.recommendedPattern).toBe('A');
    });

    it('should select day correlations', () => {
      const correlations = selectDayCorrelations(store.getState());
      expect(correlations).toHaveLength(1);
    });

    it('should select price history by item name', () => {
      const history = selectPriceHistory('Chicken')(store.getState());
      expect(history?.averagePrice).toBe(4.99);
    });

    it('should select deal score by deal id', () => {
      const score = selectDealScore('deal-1')(store.getState());
      expect(score?.score).toBe(8.5);
    });

    it('should return undefined for non-existent price history', () => {
      const history = selectPriceHistory('Unknown')(store.getState());
      expect(history).toBeUndefined();
    });

    it('should return undefined for non-existent deal score', () => {
      const score = selectDealScore('deal-999')(store.getState());
      expect(score).toBeUndefined();
    });
  });

  // ============================================================================
  // COMPUTED SELECTOR TESTS
  // ============================================================================

  describe('Computed Selectors', () => {
    describe('selectWeightTrend', () => {
      it('should return null with less than 2 entries', () => {
        const trend = selectWeightTrend(store.getState());
        expect(trend).toBeNull();
      });

      it('should return null with only recent entries', () => {
        for (let i = 0; i < 5; i++) {
          store.dispatch(addWeightEntry({
            date: `2025-01-${10 + i}`,
            weight: 180 - i * 0.5,
          }));
        }

        const trend = selectWeightTrend(store.getState());
        expect(trend).toBeNull(); // Less than 7 older entries
      });

      it('should calculate weight trend with sufficient data', () => {
        // Add 14 entries with decreasing weight over time
        // Date 30 (newest, i=0) should have lowest weight for downward trend
        // Date 17 (oldest, i=13) should have highest weight
        for (let i = 0; i < 14; i++) {
          store.dispatch(addWeightEntry({
            date: `2025-01-${String(30 - i).padStart(2, '0')}`,
            weight: 177 + i * 0.2, // Newest entries have lower weight (177.0, 177.2, ...)
          }));
        }

        const trend = selectWeightTrend(store.getState());

        expect(trend).not.toBeNull();
        // Recent (newest 7): avg around 177.6
        // Older (next 7): avg around 179.6
        // Recent < Older = downward trend
        expect(trend!.direction).toBe('down');
        expect(trend!.change).toBeLessThan(0);
        expect(trend!.percentChange).toBeLessThan(0);
      });

      it('should detect upward weight trend', () => {
        // Add entries with increasing weight over time
        // Date 30 (newest, i=0) should have highest weight for upward trend
        // Date 17 (oldest, i=13) should have lowest weight
        for (let i = 0; i < 14; i++) {
          store.dispatch(addWeightEntry({
            date: `2025-01-${String(30 - i).padStart(2, '0')}`,
            weight: 180 - i * 0.2, // Newest entries have higher weight (180.0, 179.8, ...)
          }));
        }

        const trend = selectWeightTrend(store.getState());

        // Recent (newest 7): avg around 179.4
        // Older (next 7): avg around 177.4
        // Recent > Older = upward trend
        expect(trend!.direction).toBe('up');
        expect(trend!.change).toBeGreaterThan(0);
      });

      it('should detect stable weight trend', () => {
        // Add 14 entries with same weight
        for (let i = 0; i < 14; i++) {
          store.dispatch(addWeightEntry({
            date: `2025-01-${30 - i}`,
            weight: 180,
          }));
        }

        const trend = selectWeightTrend(store.getState());

        expect(trend!.direction).toBe('stable');
        expect(trend!.change).toBe(0);
        expect(trend!.percentChange).toBe(0);
      });
    });

    describe('selectBestPattern', () => {
      it('should return null with no pattern effectiveness data', () => {
        const best = selectBestPattern(store.getState());
        expect(best).toBeNull();
      });

      it('should return pattern with highest success rate', () => {
        store.dispatch(setPatternEffectiveness([
          {
            patternId: 'A',
            patternName: 'Pattern A',
            successRate: 85,
            weightChangeAvg: -0.5,
            energyLevelAvg: 80,
            satisfactionScore: 4.5,
            adherenceRate: 90,
            totalDaysUsed: 30,
            currentStreak: 5,
          },
          {
            patternId: 'B',
            patternName: 'Pattern B',
            successRate: 92,
            weightChangeAvg: -0.6,
            energyLevelAvg: 85,
            satisfactionScore: 4.8,
            adherenceRate: 95,
            totalDaysUsed: 25,
            currentStreak: 10,
          },
          {
            patternId: 'C',
            patternName: 'Pattern C',
            successRate: 78,
            weightChangeAvg: -0.3,
            energyLevelAvg: 75,
            satisfactionScore: 4.0,
            adherenceRate: 85,
            totalDaysUsed: 20,
            currentStreak: 2,
          },
        ]));

        const best = selectBestPattern(store.getState());

        expect(best).not.toBeNull();
        expect(best!.patternId).toBe('B');
        expect(best!.successRate).toBe(92);
      });

      it('should handle single pattern', () => {
        store.dispatch(setPatternEffectiveness([
          {
            patternId: 'A',
            patternName: 'Only Pattern',
            successRate: 85,
            weightChangeAvg: -0.5,
            energyLevelAvg: 80,
            satisfactionScore: 4.5,
            adherenceRate: 90,
            totalDaysUsed: 30,
            currentStreak: 5,
          },
        ]));

        const best = selectBestPattern(store.getState());

        expect(best!.patternId).toBe('A');
      });
    });
  });
});
