/**
 * Unit Tests: Analytics and Insights
 * Tests for pattern effectiveness, weight predictions, and trend analysis
 * Target: 90% coverage
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Types
interface MealData {
  date: string;
  calories: number;
  protein: number;
  pattern: string;
  adherence: number; // 0-1
}

interface WeightEntry {
  date: string;
  weight: number;
}

interface PatternStats {
  patternId: string;
  daysUsed: number;
  successRate: number;
  avgAdherence: number;
  avgCalories: number;
}

// Analytics Service
const createAnalyticsService = () => {
  const mealHistory: MealData[] = [];
  const weightHistory: WeightEntry[] = [];

  return {
    addMealData(data: MealData): void {
      mealHistory.push(data);
    },

    addWeightEntry(entry: WeightEntry): void {
      weightHistory.push(entry);
    },

    getPatternStats(patternId: string): PatternStats | null {
      const patternMeals = mealHistory.filter(m => m.pattern === patternId);
      if (patternMeals.length === 0) return null;

      const uniqueDays = new Set(patternMeals.map(m => m.date));
      const successfulDays = patternMeals.filter(m => m.adherence >= 0.8).length;

      return {
        patternId,
        daysUsed: uniqueDays.size,
        successRate: Math.round((successfulDays / patternMeals.length) * 100) / 100,
        avgAdherence: Math.round(patternMeals.reduce((sum, m) => sum + m.adherence, 0) / patternMeals.length * 100) / 100,
        avgCalories: Math.round(patternMeals.reduce((sum, m) => sum + m.calories, 0) / patternMeals.length)
      };
    },

    getAllPatternStats(): PatternStats[] {
      const patterns = [...new Set(mealHistory.map(m => m.pattern))];
      return patterns.map(p => this.getPatternStats(p)).filter(Boolean) as PatternStats[];
    },

    getBestPattern(): string | null {
      const stats = this.getAllPatternStats();
      if (stats.length === 0) return null;

      stats.sort((a, b) => {
        // Score based on success rate and adherence
        const scoreA = a.successRate * 0.6 + a.avgAdherence * 0.4;
        const scoreB = b.successRate * 0.6 + b.avgAdherence * 0.4;
        return scoreB - scoreA;
      });

      return stats[0].patternId;
    },

    predictWeight(daysFromNow: number, calorieDeficit: number = 500): number | null {
      if (weightHistory.length === 0) return null;

      const currentWeight = weightHistory[weightHistory.length - 1].weight;
      // 3500 cal deficit = 1 lb lost
      const weightChange = (calorieDeficit * daysFromNow) / 3500;

      return Math.round((currentWeight - weightChange) * 10) / 10;
    },

    getWeightTrend(days: number): Array<{ date: string; weight: number; trend: 'up' | 'down' | 'stable' }> {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentEntries = weightHistory.filter(e => new Date(e.date) >= cutoffDate);

      return recentEntries.map((entry, index) => {
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (index > 0) {
          const diff = entry.weight - recentEntries[index - 1].weight;
          if (diff > 0.5) trend = 'up';
          else if (diff < -0.5) trend = 'down';
        }
        return { ...entry, trend };
      });
    },

    calculateWeeklyAverage(): { calories: number; protein: number; adherence: number } | null {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const weekMeals = mealHistory.filter(m => new Date(m.date) >= oneWeekAgo);
      if (weekMeals.length === 0) return null;

      return {
        calories: Math.round(weekMeals.reduce((sum, m) => sum + m.calories, 0) / weekMeals.length),
        protein: Math.round(weekMeals.reduce((sum, m) => sum + m.protein, 0) / weekMeals.length),
        adherence: Math.round(weekMeals.reduce((sum, m) => sum + m.adherence, 0) / weekMeals.length * 100) / 100
      };
    },

    calculateMonthlyProgress(): {
      weightChange: number;
      avgCalories: number;
      consistencyScore: number;
      topPattern: string | null;
    } | null {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

      const monthWeights = weightHistory.filter(e => new Date(e.date) >= oneMonthAgo);
      const monthMeals = mealHistory.filter(m => new Date(m.date) >= oneMonthAgo);

      if (monthWeights.length < 2 || monthMeals.length === 0) return null;

      const weightChange = monthWeights[monthWeights.length - 1].weight - monthWeights[0].weight;
      const avgCalories = Math.round(monthMeals.reduce((sum, m) => sum + m.calories, 0) / monthMeals.length);

      // Consistency: percentage of days with logged meals
      const uniqueDays = new Set(monthMeals.map(m => m.date)).size;
      const consistencyScore = Math.round((uniqueDays / 30) * 100) / 100;

      return {
        weightChange: Math.round(weightChange * 10) / 10,
        avgCalories,
        consistencyScore,
        topPattern: this.getBestPattern()
      };
    },

    getCalorieTrend(days: number): Array<{ date: string; calories: number; target: number; diff: number }> {
      const target = 2000; // Default target
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentMeals = mealHistory.filter(m => new Date(m.date) >= cutoffDate);

      // Group by date
      const byDate = new Map<string, number>();
      recentMeals.forEach(meal => {
        const current = byDate.get(meal.date) || 0;
        byDate.set(meal.date, current + meal.calories);
      });

      return Array.from(byDate.entries()).map(([date, calories]) => ({
        date,
        calories,
        target,
        diff: calories - target
      }));
    },

    getProteinTrend(days: number): Array<{ date: string; protein: number; target: number; percentMet: number }> {
      const target = 130; // Default target
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentMeals = mealHistory.filter(m => new Date(m.date) >= cutoffDate);

      // Group by date
      const byDate = new Map<string, number>();
      recentMeals.forEach(meal => {
        const current = byDate.get(meal.date) || 0;
        byDate.set(meal.date, current + meal.protein);
      });

      return Array.from(byDate.entries()).map(([date, protein]) => ({
        date,
        protein,
        target,
        percentMet: Math.round((protein / target) * 100)
      }));
    },

    identifyPatterns(): string[] {
      const insights: string[] = [];
      const stats = this.getAllPatternStats();

      // Check for best performing pattern
      const best = this.getBestPattern();
      if (best) {
        const bestStats = stats.find(s => s.patternId === best);
        if (bestStats && bestStats.successRate > 0.8) {
          insights.push(`"${best}" pattern has ${Math.round(bestStats.successRate * 100)}% success rate`);
        }
      }

      // Check for low adherence patterns
      stats.forEach(s => {
        if (s.avgAdherence < 0.6) {
          insights.push(`"${s.patternId}" pattern has low adherence (${Math.round(s.avgAdherence * 100)}%)`);
        }
      });

      // Check weight trend
      const weightTrend = this.getWeightTrend(7);
      const downDays = weightTrend.filter(w => w.trend === 'down').length;
      if (downDays >= 4) {
        insights.push('Weight trending down - good progress!');
      }

      return insights;
    },

    getRecommendations(): string[] {
      const recommendations: string[] = [];
      const weeklyAvg = this.calculateWeeklyAverage();

      if (weeklyAvg) {
        if (weeklyAvg.calories > 2200) {
          recommendations.push('Consider reducing portion sizes to meet calorie target');
        }
        if (weeklyAvg.protein < 120) {
          recommendations.push('Increase protein intake - aim for more lean meats or protein supplements');
        }
        if (weeklyAvg.adherence < 0.7) {
          recommendations.push('Try simpler meal patterns to improve adherence');
        }
      }

      const best = this.getBestPattern();
      if (best) {
        recommendations.push(`Continue with "${best}" pattern - it works well for you`);
      }

      return recommendations;
    },

    exportData(): { meals: MealData[]; weights: WeightEntry[] } {
      return {
        meals: [...mealHistory],
        weights: [...weightHistory]
      };
    },

    importData(data: { meals: MealData[]; weights: WeightEntry[] }): void {
      mealHistory.push(...data.meals);
      weightHistory.push(...data.weights);
    },

    clearData(): void {
      mealHistory.length = 0;
      weightHistory.length = 0;
    }
  };
};

describe('Analytics and Insights', () => {
  let service: ReturnType<typeof createAnalyticsService>;

  beforeEach(() => {
    service = createAnalyticsService();
  });

  describe('Pattern Statistics', () => {
    it('should calculate pattern stats', () => {
      service.addMealData({ date: '2024-01-01', calories: 2000, protein: 130, pattern: 'traditional', adherence: 0.9 });
      service.addMealData({ date: '2024-01-02', calories: 1900, protein: 125, pattern: 'traditional', adherence: 0.85 });

      const stats = service.getPatternStats('traditional');

      expect(stats).toBeDefined();
      expect(stats?.patternId).toBe('traditional');
      expect(stats?.daysUsed).toBe(2);
      expect(stats?.avgAdherence).toBeGreaterThan(0.8);
    });

    it('should return null for unknown pattern', () => {
      const stats = service.getPatternStats('unknown');

      expect(stats).toBeNull();
    });

    it('should get all pattern stats', () => {
      service.addMealData({ date: '2024-01-01', calories: 2000, protein: 130, pattern: 'traditional', adherence: 0.9 });
      service.addMealData({ date: '2024-01-01', calories: 1800, protein: 130, pattern: 'if-16-8', adherence: 0.8 });

      const stats = service.getAllPatternStats();

      expect(stats).toHaveLength(2);
    });

    it('should identify best pattern', () => {
      service.addMealData({ date: '2024-01-01', calories: 2000, protein: 130, pattern: 'traditional', adherence: 0.95 });
      service.addMealData({ date: '2024-01-02', calories: 2000, protein: 130, pattern: 'traditional', adherence: 0.90 });
      service.addMealData({ date: '2024-01-01', calories: 1800, protein: 130, pattern: 'if-16-8', adherence: 0.6 });

      const best = service.getBestPattern();

      expect(best).toBe('traditional');
    });

    it('should return null for best pattern with no data', () => {
      const best = service.getBestPattern();

      expect(best).toBeNull();
    });
  });

  describe('Weight Tracking', () => {
    it('should predict weight loss', () => {
      service.addWeightEntry({ date: '2024-01-01', weight: 250 });

      const prediction = service.predictWeight(30, 500);

      // 500 cal deficit * 30 days = 15000 cal = ~4.3 lbs
      expect(prediction).toBeLessThan(250);
      expect(prediction).toBeGreaterThan(240);
    });

    it('should return null prediction with no weight data', () => {
      const prediction = service.predictWeight(30);

      expect(prediction).toBeNull();
    });

    it('should track weight trend', () => {
      service.addWeightEntry({ date: '2024-01-01', weight: 250 });
      service.addWeightEntry({ date: '2024-01-02', weight: 249 });
      service.addWeightEntry({ date: '2024-01-03', weight: 248 });

      const trend = service.getWeightTrend(7);

      expect(trend).toHaveLength(3);
      expect(trend[2].trend).toBe('down');
    });

    it('should identify stable weight', () => {
      service.addWeightEntry({ date: '2024-01-01', weight: 250 });
      service.addWeightEntry({ date: '2024-01-02', weight: 250.2 });

      const trend = service.getWeightTrend(7);

      expect(trend[1].trend).toBe('stable');
    });
  });

  describe('Weekly and Monthly Analysis', () => {
    it('should calculate weekly average', () => {
      const today = new Date().toISOString().split('T')[0];
      service.addMealData({ date: today, calories: 2000, protein: 130, pattern: 'traditional', adherence: 0.9 });
      service.addMealData({ date: today, calories: 1800, protein: 120, pattern: 'traditional', adherence: 0.85 });

      const avg = service.calculateWeeklyAverage();

      expect(avg).toBeDefined();
      expect(avg?.calories).toBe(1900);
      expect(avg?.protein).toBe(125);
    });

    it('should return null weekly average with no data', () => {
      const avg = service.calculateWeeklyAverage();

      expect(avg).toBeNull();
    });

    it('should calculate monthly progress', () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      service.addWeightEntry({ date: todayStr, weight: 245 });
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      service.addWeightEntry({ date: weekAgo.toISOString().split('T')[0], weight: 250 });

      service.addMealData({ date: todayStr, calories: 2000, protein: 130, pattern: 'traditional', adherence: 0.9 });

      const progress = service.calculateMonthlyProgress();

      expect(progress).toBeDefined();
      expect(progress?.weightChange).toBeLessThan(0);
    });
  });

  describe('Trend Analysis', () => {
    it('should get calorie trend', () => {
      const today = new Date().toISOString().split('T')[0];
      service.addMealData({ date: today, calories: 2000, protein: 130, pattern: 'traditional', adherence: 0.9 });

      const trend = service.getCalorieTrend(7);

      expect(trend.length).toBeGreaterThan(0);
      expect(trend[0]).toHaveProperty('diff');
    });

    it('should get protein trend', () => {
      const today = new Date().toISOString().split('T')[0];
      service.addMealData({ date: today, calories: 2000, protein: 130, pattern: 'traditional', adherence: 0.9 });

      const trend = service.getProteinTrend(7);

      expect(trend.length).toBeGreaterThan(0);
      expect(trend[0]).toHaveProperty('percentMet');
    });
  });

  describe('Insights and Recommendations', () => {
    it('should identify patterns and provide insights', () => {
      const today = new Date().toISOString().split('T')[0];
      service.addMealData({ date: today, calories: 2000, protein: 130, pattern: 'traditional', adherence: 0.95 });

      const insights = service.identifyPatterns();

      expect(Array.isArray(insights)).toBe(true);
    });

    it('should provide recommendations', () => {
      const today = new Date().toISOString().split('T')[0];
      service.addMealData({ date: today, calories: 2500, protein: 100, pattern: 'traditional', adherence: 0.6 });

      const recommendations = service.getRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Data Export/Import', () => {
    it('should export data', () => {
      service.addMealData({ date: '2024-01-01', calories: 2000, protein: 130, pattern: 'traditional', adherence: 0.9 });
      service.addWeightEntry({ date: '2024-01-01', weight: 250 });

      const exported = service.exportData();

      expect(exported.meals).toHaveLength(1);
      expect(exported.weights).toHaveLength(1);
    });

    it('should import data', () => {
      const data = {
        meals: [{ date: '2024-01-01', calories: 2000, protein: 130, pattern: 'traditional', adherence: 0.9 }],
        weights: [{ date: '2024-01-01', weight: 250 }]
      };

      service.importData(data);

      const exported = service.exportData();
      expect(exported.meals).toHaveLength(1);
    });

    it('should clear data', () => {
      service.addMealData({ date: '2024-01-01', calories: 2000, protein: 130, pattern: 'traditional', adherence: 0.9 });

      service.clearData();

      const exported = service.exportData();
      expect(exported.meals).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data gracefully', () => {
      expect(service.getAllPatternStats()).toHaveLength(0);
      expect(service.getBestPattern()).toBeNull();
      expect(service.calculateWeeklyAverage()).toBeNull();
    });

    it('should handle single data point', () => {
      service.addMealData({ date: '2024-01-01', calories: 2000, protein: 130, pattern: 'traditional', adherence: 0.9 });

      const stats = service.getPatternStats('traditional');

      expect(stats?.daysUsed).toBe(1);
    });
  });
});
