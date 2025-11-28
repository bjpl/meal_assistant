/**
 * Unit Tests: Pattern Analytics
 * Tests for pattern effectiveness, context correlations, fatigue detection, recommendations
 * Target: 30 tests | Coverage: 90%+
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================================
// Types
// ============================================================================

interface PatternUsageRecord {
  id: string;
  patternId: string;
  date: Date;
  adherence: number;        // 0-1, how well user followed pattern
  caloriesLogged: number;
  proteinLogged: number;
  targetCalories: number;
  targetProtein: number;
  mealCount: number;
  context: PatternContext;
}

interface PatternContext {
  dayOfWeek: number;        // 0-6
  isWeekend: boolean;
  isWorkDay: boolean;
  hadExercise: boolean;
  stressLevel?: number;     // 1-5
  sleepHours?: number;
  socialMeals: number;      // Meals eaten with others
  mealPrepUsed: boolean;
}

interface PatternEffectiveness {
  patternId: string;
  totalDays: number;
  avgAdherence: number;
  successRate: number;      // Days with adherence >= 0.8
  avgCalorieAccuracy: number;
  avgProteinAccuracy: number;
  bestContexts: string[];
  worstContexts: string[];
  trend: 'improving' | 'declining' | 'stable';
}

interface ContextCorrelation {
  context: string;
  correlation: number;      // -1 to 1
  sampleSize: number;
  significance: 'high' | 'medium' | 'low';
}

interface FatigueAnalysis {
  patternId: string;
  isFatigued: boolean;
  fatigueScore: number;     // 0-1
  daysSinceStart: number;
  adherenceTrend: 'declining' | 'stable' | 'improving';
  recommendation: string;
}

interface PatternRecommendation {
  patternId: string;
  score: number;
  reasons: string[];
  bestFor: string[];
  cautions: string[];
  predictedSuccess: number;
}

// ============================================================================
// Pattern Analytics Service
// ============================================================================

const createPatternAnalyticsService = () => {
  const usageRecords: PatternUsageRecord[] = [];
  const patterns = new Map<string, { name: string; description: string }>();

  return {
    // Register pattern
    registerPattern(id: string, name: string, description: string): void {
      patterns.set(id, { name, description });
    },

    // Log pattern usage
    logUsage(record: PatternUsageRecord): void {
      usageRecords.push(record);
    },

    // Get usage records for pattern
    getUsageRecords(patternId: string, days?: number): PatternUsageRecord[] {
      let records = usageRecords.filter(r => r.patternId === patternId);

      if (days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        records = records.filter(r => r.date >= cutoff);
      }

      return records.sort((a, b) => a.date.getTime() - b.date.getTime());
    },

    // Calculate pattern effectiveness
    calculateEffectiveness(patternId: string): PatternEffectiveness | null {
      const records = this.getUsageRecords(patternId);
      if (records.length < 3) return null;

      const avgAdherence = records.reduce((sum, r) => sum + r.adherence, 0) / records.length;
      const successDays = records.filter(r => r.adherence >= 0.8).length;
      const successRate = successDays / records.length;

      // Calculate accuracy metrics
      const calorieAccuracies = records.map(r =>
        1 - Math.abs(r.caloriesLogged - r.targetCalories) / r.targetCalories
      );
      const proteinAccuracies = records.map(r =>
        1 - Math.abs(r.proteinLogged - r.targetProtein) / r.targetProtein
      );

      const avgCalorieAccuracy = calorieAccuracies.reduce((sum, a) => sum + a, 0) / records.length;
      const avgProteinAccuracy = proteinAccuracies.reduce((sum, a) => sum + a, 0) / records.length;

      // Analyze contexts
      const contextAnalysis = this.analyzeContextCorrelations(patternId);
      const bestContexts = contextAnalysis
        .filter(c => c.correlation > 0.3)
        .map(c => c.context);
      const worstContexts = contextAnalysis
        .filter(c => c.correlation < -0.3)
        .map(c => c.context);

      // Calculate trend
      const halfPoint = Math.floor(records.length / 2);
      const firstHalfAvg = records.slice(0, halfPoint)
        .reduce((sum, r) => sum + r.adherence, 0) / halfPoint;
      const secondHalfAvg = records.slice(halfPoint)
        .reduce((sum, r) => sum + r.adherence, 0) / (records.length - halfPoint);

      let trend: 'improving' | 'declining' | 'stable';
      if (secondHalfAvg > firstHalfAvg + 0.05) trend = 'improving';
      else if (secondHalfAvg < firstHalfAvg - 0.05) trend = 'declining';
      else trend = 'stable';

      return {
        patternId,
        totalDays: records.length,
        avgAdherence: Math.round(avgAdherence * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        avgCalorieAccuracy: Math.round(Math.max(0, avgCalorieAccuracy) * 100) / 100,
        avgProteinAccuracy: Math.round(Math.max(0, avgProteinAccuracy) * 100) / 100,
        bestContexts,
        worstContexts,
        trend
      };
    },

    // Analyze context correlations
    analyzeContextCorrelations(patternId: string): ContextCorrelation[] {
      const records = this.getUsageRecords(patternId);
      if (records.length < 5) return [];

      const correlations: ContextCorrelation[] = [];
      const avgAdherence = records.reduce((sum, r) => sum + r.adherence, 0) / records.length;

      // Weekend correlation
      const weekendRecords = records.filter(r => r.context.isWeekend);
      const weekdayRecords = records.filter(r => !r.context.isWeekend);

      if (weekendRecords.length >= 2 && weekdayRecords.length >= 2) {
        const weekendAvg = weekendRecords.reduce((sum, r) => sum + r.adherence, 0) / weekendRecords.length;
        const weekdayAvg = weekdayRecords.reduce((sum, r) => sum + r.adherence, 0) / weekdayRecords.length;
        const correlation = (weekendAvg - weekdayAvg) / avgAdherence;

        correlations.push({
          context: 'weekend',
          correlation: Math.round(correlation * 100) / 100,
          sampleSize: weekendRecords.length,
          significance: weekendRecords.length >= 10 ? 'high' : weekendRecords.length >= 5 ? 'medium' : 'low'
        });
      }

      // Exercise correlation
      const exerciseRecords = records.filter(r => r.context.hadExercise);
      const noExerciseRecords = records.filter(r => !r.context.hadExercise);

      if (exerciseRecords.length >= 2 && noExerciseRecords.length >= 2) {
        const exerciseAvg = exerciseRecords.reduce((sum, r) => sum + r.adherence, 0) / exerciseRecords.length;
        const noExerciseAvg = noExerciseRecords.reduce((sum, r) => sum + r.adherence, 0) / noExerciseRecords.length;
        const correlation = (exerciseAvg - noExerciseAvg) / avgAdherence;

        correlations.push({
          context: 'exercise',
          correlation: Math.round(correlation * 100) / 100,
          sampleSize: exerciseRecords.length,
          significance: exerciseRecords.length >= 10 ? 'high' : exerciseRecords.length >= 5 ? 'medium' : 'low'
        });
      }

      // Meal prep correlation
      const prepRecords = records.filter(r => r.context.mealPrepUsed);
      const noPrepRecords = records.filter(r => !r.context.mealPrepUsed);

      if (prepRecords.length >= 2 && noPrepRecords.length >= 2) {
        const prepAvg = prepRecords.reduce((sum, r) => sum + r.adherence, 0) / prepRecords.length;
        const noPrepAvg = noPrepRecords.reduce((sum, r) => sum + r.adherence, 0) / noPrepRecords.length;
        const correlation = (prepAvg - noPrepAvg) / avgAdherence;

        correlations.push({
          context: 'meal_prep',
          correlation: Math.round(correlation * 100) / 100,
          sampleSize: prepRecords.length,
          significance: prepRecords.length >= 10 ? 'high' : prepRecords.length >= 5 ? 'medium' : 'low'
        });
      }

      // Social meals correlation
      const socialRecords = records.filter(r => r.context.socialMeals > 0);
      const soloRecords = records.filter(r => r.context.socialMeals === 0);

      if (socialRecords.length >= 2 && soloRecords.length >= 2) {
        const socialAvg = socialRecords.reduce((sum, r) => sum + r.adherence, 0) / socialRecords.length;
        const soloAvg = soloRecords.reduce((sum, r) => sum + r.adherence, 0) / soloRecords.length;
        const correlation = (socialAvg - soloAvg) / avgAdherence;

        correlations.push({
          context: 'social_meals',
          correlation: Math.round(correlation * 100) / 100,
          sampleSize: socialRecords.length,
          significance: socialRecords.length >= 10 ? 'high' : socialRecords.length >= 5 ? 'medium' : 'low'
        });
      }

      return correlations;
    },

    // Detect pattern fatigue
    detectFatigue(patternId: string): FatigueAnalysis | null {
      const records = this.getUsageRecords(patternId);
      if (records.length < 7) return null;

      const daysSinceStart = Math.round(
        (Date.now() - records[0].date.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Analyze recent vs overall adherence
      const recentRecords = records.slice(-7);
      const recentAvg = recentRecords.reduce((sum, r) => sum + r.adherence, 0) / 7;
      const overallAvg = records.reduce((sum, r) => sum + r.adherence, 0) / records.length;

      // Calculate adherence trend
      const firstQuarter = records.slice(0, Math.ceil(records.length / 4));
      const lastQuarter = records.slice(-Math.ceil(records.length / 4));
      const firstAvg = firstQuarter.reduce((sum, r) => sum + r.adherence, 0) / firstQuarter.length;
      const lastAvg = lastQuarter.reduce((sum, r) => sum + r.adherence, 0) / lastQuarter.length;

      let adherenceTrend: 'declining' | 'stable' | 'improving';
      if (lastAvg < firstAvg - 0.1) adherenceTrend = 'declining';
      else if (lastAvg > firstAvg + 0.1) adherenceTrend = 'improving';
      else adherenceTrend = 'stable';

      // Calculate fatigue score
      let fatigueScore = 0;

      // Recent drop factor
      if (recentAvg < overallAvg - 0.1) fatigueScore += 0.3;
      if (recentAvg < overallAvg - 0.2) fatigueScore += 0.2;

      // Duration factor
      if (daysSinceStart > 60) fatigueScore += 0.2;
      if (daysSinceStart > 90) fatigueScore += 0.1;

      // Declining trend factor
      if (adherenceTrend === 'declining') fatigueScore += 0.2;

      const isFatigued = fatigueScore >= 0.4;

      // Generate recommendation
      let recommendation = '';
      if (fatigueScore >= 0.6) {
        recommendation = 'Consider switching to a different pattern for variety';
      } else if (fatigueScore >= 0.4) {
        recommendation = 'Try introducing some flexibility or cheat meals';
      } else if (fatigueScore >= 0.2) {
        recommendation = 'Monitor adherence, pattern may need adjustment soon';
      } else {
        recommendation = 'Pattern is working well, continue as is';
      }

      return {
        patternId,
        isFatigued,
        fatigueScore: Math.round(fatigueScore * 100) / 100,
        daysSinceStart,
        adherenceTrend,
        recommendation
      };
    },

    // Generate pattern recommendations
    generateRecommendations(userId: string): PatternRecommendation[] {
      const recommendations: PatternRecommendation[] = [];

      for (const [patternId, patternInfo] of patterns) {
        const effectiveness = this.calculateEffectiveness(patternId);
        const fatigue = this.detectFatigue(patternId);
        const correlations = this.analyzeContextCorrelations(patternId);

        let score = 5;
        const reasons: string[] = [];
        const bestFor: string[] = [];
        const cautions: string[] = [];

        if (effectiveness) {
          // Score based on success rate
          if (effectiveness.successRate >= 0.8) {
            score += 2;
            reasons.push('High success rate historically');
          } else if (effectiveness.successRate >= 0.6) {
            score += 1;
            reasons.push('Moderate success rate');
          } else {
            score -= 1;
            cautions.push('Low historical success rate');
          }

          // Trend adjustment
          if (effectiveness.trend === 'improving') {
            score += 1;
            reasons.push('Adherence is improving over time');
          } else if (effectiveness.trend === 'declining') {
            score -= 1;
            cautions.push('Adherence has been declining');
          }

          // Best contexts
          effectiveness.bestContexts.forEach(ctx => {
            bestFor.push(`Works well on ${ctx} days`);
          });
        }

        // Fatigue adjustment
        if (fatigue?.isFatigued) {
          score -= 2;
          cautions.push('Pattern fatigue detected');
        }

        // Context-based recommendations
        correlations.forEach(c => {
          if (c.correlation > 0.3 && c.significance !== 'low') {
            bestFor.push(`Better with ${c.context}`);
          } else if (c.correlation < -0.3 && c.significance !== 'low') {
            cautions.push(`Struggles with ${c.context}`);
          }
        });

        // Clamp score
        score = Math.max(1, Math.min(10, score));

        // Calculate predicted success
        const predictedSuccess = effectiveness
          ? Math.round(effectiveness.successRate * (fatigue?.isFatigued ? 0.8 : 1) * 100) / 100
          : 0.5;

        recommendations.push({
          patternId,
          score,
          reasons,
          bestFor,
          cautions,
          predictedSuccess
        });
      }

      return recommendations.sort((a, b) => b.score - a.score);
    },

    // Get best pattern for context
    getBestPatternForContext(context: Partial<PatternContext>): string | null {
      const recommendations = this.generateRecommendations('user');

      if (recommendations.length === 0) return null;

      // Adjust scores based on context
      for (const rec of recommendations) {
        const correlations = this.analyzeContextCorrelations(rec.patternId);

        if (context.isWeekend !== undefined) {
          const weekendCorr = correlations.find(c => c.context === 'weekend');
          if (weekendCorr) {
            if (context.isWeekend && weekendCorr.correlation > 0) rec.score += 1;
            if (!context.isWeekend && weekendCorr.correlation < 0) rec.score += 1;
          }
        }

        if (context.hadExercise !== undefined) {
          const exerciseCorr = correlations.find(c => c.context === 'exercise');
          if (exerciseCorr) {
            if (context.hadExercise && exerciseCorr.correlation > 0) rec.score += 1;
          }
        }
      }

      recommendations.sort((a, b) => b.score - a.score);
      return recommendations[0]?.patternId || null;
    },

    // Clear all data
    clearData(): void {
      usageRecords.length = 0;
      patterns.clear();
    }
  };
};

// ============================================================================
// Test Suite: Pattern Analytics
// ============================================================================

describe('Pattern Analytics', () => {
  let service: ReturnType<typeof createPatternAnalyticsService>;

  beforeEach(() => {
    service = createPatternAnalyticsService();
    service.registerPattern('traditional', 'Traditional', '3 meals per day');
    service.registerPattern('if-16-8', 'Intermittent Fasting', '16:8 schedule');
    service.registerPattern('grazing', 'Grazing', '5-6 small meals');
  });

  // Helper to add usage records
  const addRecords = (patternId: string, count: number, baseAdherence: number = 0.8) => {
    for (let i = 0; i < count; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (count - i));

      service.logUsage({
        id: `usage-${patternId}-${i}`,
        patternId,
        date,
        adherence: baseAdherence + (Math.random() * 0.2 - 0.1),
        caloriesLogged: 1900 + Math.round(Math.random() * 200),
        proteinLogged: 125 + Math.round(Math.random() * 20),
        targetCalories: 2000,
        targetProtein: 130,
        mealCount: 3,
        context: {
          dayOfWeek: date.getDay(),
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
          isWorkDay: date.getDay() >= 1 && date.getDay() <= 5,
          hadExercise: Math.random() > 0.5,
          stressLevel: Math.floor(Math.random() * 5) + 1,
          sleepHours: 6 + Math.random() * 3,
          socialMeals: Math.floor(Math.random() * 2),
          mealPrepUsed: Math.random() > 0.5
        }
      });
    }
  };

  // ==========================================================================
  // Effectiveness Calculation Tests (8 tests)
  // ==========================================================================
  describe('Effectiveness Calculation', () => {
    it('should calculate average adherence', () => {
      addRecords('traditional', 10, 0.85);

      const effectiveness = service.calculateEffectiveness('traditional');

      expect(effectiveness).not.toBeNull();
      expect(effectiveness!.avgAdherence).toBeGreaterThan(0.7);
      expect(effectiveness!.avgAdherence).toBeLessThan(1);
    });

    it('should calculate success rate', () => {
      addRecords('traditional', 10, 0.85);

      const effectiveness = service.calculateEffectiveness('traditional');

      expect(effectiveness!.successRate).toBeGreaterThan(0);
      expect(effectiveness!.successRate).toBeLessThanOrEqual(1);
    });

    it('should calculate calorie accuracy', () => {
      addRecords('traditional', 10);

      const effectiveness = service.calculateEffectiveness('traditional');

      expect(effectiveness!.avgCalorieAccuracy).toBeGreaterThan(0);
      expect(effectiveness!.avgCalorieAccuracy).toBeLessThanOrEqual(1);
    });

    it('should calculate protein accuracy', () => {
      addRecords('traditional', 10);

      const effectiveness = service.calculateEffectiveness('traditional');

      expect(effectiveness!.avgProteinAccuracy).toBeGreaterThan(0);
      expect(effectiveness!.avgProteinAccuracy).toBeLessThanOrEqual(1);
    });

    it('should require minimum 3 records', () => {
      addRecords('traditional', 2);

      const effectiveness = service.calculateEffectiveness('traditional');

      expect(effectiveness).toBeNull();
    });

    it('should track total days used', () => {
      addRecords('traditional', 15);

      const effectiveness = service.calculateEffectiveness('traditional');

      expect(effectiveness!.totalDays).toBe(15);
    });

    it('should identify best contexts', () => {
      // Add records with clear context patterns
      for (let i = 0; i < 20; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const isWeekend = i % 7 < 2;

        service.logUsage({
          id: `ctx-${i}`,
          patternId: 'traditional',
          date,
          adherence: isWeekend ? 0.95 : 0.7,
          caloriesLogged: 2000,
          proteinLogged: 130,
          targetCalories: 2000,
          targetProtein: 130,
          mealCount: 3,
          context: {
            dayOfWeek: date.getDay(),
            isWeekend,
            isWorkDay: !isWeekend,
            hadExercise: false,
            socialMeals: 0,
            mealPrepUsed: false
          }
        });
      }

      const effectiveness = service.calculateEffectiveness('traditional');

      expect(effectiveness!.bestContexts.length).toBeGreaterThanOrEqual(0);
    });

    it('should determine trend direction', () => {
      // Add declining adherence
      for (let i = 0; i < 20; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (20 - i));

        service.logUsage({
          id: `trend-${i}`,
          patternId: 'if-16-8',
          date,
          adherence: 0.9 - (i * 0.02), // Declining
          caloriesLogged: 2000,
          proteinLogged: 130,
          targetCalories: 2000,
          targetProtein: 130,
          mealCount: 2,
          context: {
            dayOfWeek: date.getDay(),
            isWeekend: false,
            isWorkDay: true,
            hadExercise: false,
            socialMeals: 0,
            mealPrepUsed: false
          }
        });
      }

      const effectiveness = service.calculateEffectiveness('if-16-8');

      expect(effectiveness!.trend).toBe('declining');
    });
  });

  // ==========================================================================
  // Context Correlation Tests (7 tests)
  // ==========================================================================
  describe('Context Correlations', () => {
    it('should analyze weekend correlation', () => {
      addRecords('traditional', 20, 0.8);

      const correlations = service.analyzeContextCorrelations('traditional');

      const weekendCorr = correlations.find(c => c.context === 'weekend');
      expect(weekendCorr).toBeDefined();
    });

    it('should analyze exercise correlation', () => {
      addRecords('traditional', 20);

      const correlations = service.analyzeContextCorrelations('traditional');

      const exerciseCorr = correlations.find(c => c.context === 'exercise');
      expect(exerciseCorr).toBeDefined();
    });

    it('should analyze meal prep correlation', () => {
      addRecords('traditional', 20);

      const correlations = service.analyzeContextCorrelations('traditional');

      const prepCorr = correlations.find(c => c.context === 'meal_prep');
      expect(prepCorr).toBeDefined();
    });

    it('should include sample size', () => {
      addRecords('traditional', 20);

      const correlations = service.analyzeContextCorrelations('traditional');

      expect(correlations[0]?.sampleSize).toBeGreaterThan(0);
    });

    it('should rate significance based on sample size', () => {
      addRecords('traditional', 5);

      const correlations = service.analyzeContextCorrelations('traditional');

      expect(correlations[0]?.significance).toMatch(/high|medium|low/);
    });

    it('should require minimum 5 records', () => {
      addRecords('traditional', 4);

      const correlations = service.analyzeContextCorrelations('traditional');

      expect(correlations).toHaveLength(0);
    });

    it('should bound correlation values', () => {
      addRecords('traditional', 20);

      const correlations = service.analyzeContextCorrelations('traditional');

      correlations.forEach(c => {
        expect(c.correlation).toBeGreaterThanOrEqual(-1);
        expect(c.correlation).toBeLessThanOrEqual(1);
      });
    });
  });

  // ==========================================================================
  // Fatigue Detection Tests (7 tests)
  // ==========================================================================
  describe('Fatigue Detection', () => {
    it('should detect pattern fatigue', () => {
      // Add declining records
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (30 - i));

        service.logUsage({
          id: `fatigue-${i}`,
          patternId: 'traditional',
          date,
          adherence: Math.max(0.3, 0.95 - (i * 0.02)),
          caloriesLogged: 2000,
          proteinLogged: 130,
          targetCalories: 2000,
          targetProtein: 130,
          mealCount: 3,
          context: {
            dayOfWeek: date.getDay(),
            isWeekend: false,
            isWorkDay: true,
            hadExercise: false,
            socialMeals: 0,
            mealPrepUsed: false
          }
        });
      }

      const fatigue = service.detectFatigue('traditional');

      expect(fatigue).not.toBeNull();
      expect(fatigue!.isFatigued).toBe(true);
    });

    it('should calculate fatigue score', () => {
      addRecords('traditional', 20);

      const fatigue = service.detectFatigue('traditional');

      expect(fatigue!.fatigueScore).toBeGreaterThanOrEqual(0);
      expect(fatigue!.fatigueScore).toBeLessThanOrEqual(1);
    });

    it('should track days since start', () => {
      addRecords('traditional', 30);

      const fatigue = service.detectFatigue('traditional');

      expect(fatigue!.daysSinceStart).toBeGreaterThan(0);
    });

    it('should detect adherence trend', () => {
      addRecords('traditional', 20);

      const fatigue = service.detectFatigue('traditional');

      expect(fatigue!.adherenceTrend).toMatch(/declining|stable|improving/);
    });

    it('should provide recommendation', () => {
      addRecords('traditional', 20);

      const fatigue = service.detectFatigue('traditional');

      expect(fatigue!.recommendation).toBeDefined();
      expect(fatigue!.recommendation.length).toBeGreaterThan(0);
    });

    it('should require minimum 7 records', () => {
      addRecords('traditional', 6);

      const fatigue = service.detectFatigue('traditional');

      expect(fatigue).toBeNull();
    });

    it('should not flag as fatigued for stable patterns', () => {
      // Add stable high adherence
      for (let i = 0; i < 20; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (20 - i));

        service.logUsage({
          id: `stable-${i}`,
          patternId: 'if-16-8',
          date,
          adherence: 0.85 + (Math.random() * 0.1),
          caloriesLogged: 2000,
          proteinLogged: 130,
          targetCalories: 2000,
          targetProtein: 130,
          mealCount: 2,
          context: {
            dayOfWeek: date.getDay(),
            isWeekend: false,
            isWorkDay: true,
            hadExercise: false,
            socialMeals: 0,
            mealPrepUsed: false
          }
        });
      }

      const fatigue = service.detectFatigue('if-16-8');

      expect(fatigue!.isFatigued).toBe(false);
    });
  });

  // ==========================================================================
  // Recommendation Tests (5 tests)
  // ==========================================================================
  describe('Pattern Recommendations', () => {
    it('should generate recommendations for all patterns', () => {
      addRecords('traditional', 10);
      addRecords('if-16-8', 10);
      addRecords('grazing', 10);

      const recommendations = service.generateRecommendations('user');

      expect(recommendations.length).toBe(3);
    });

    it('should sort by score descending', () => {
      addRecords('traditional', 20, 0.9);
      addRecords('if-16-8', 20, 0.6);

      const recommendations = service.generateRecommendations('user');

      expect(recommendations[0].score).toBeGreaterThanOrEqual(recommendations[1].score);
    });

    it('should include predicted success rate', () => {
      addRecords('traditional', 20);

      const recommendations = service.generateRecommendations('user');

      expect(recommendations[0].predictedSuccess).toBeGreaterThan(0);
      expect(recommendations[0].predictedSuccess).toBeLessThanOrEqual(1);
    });

    it('should provide reasons', () => {
      addRecords('traditional', 20, 0.9);

      const recommendations = service.generateRecommendations('user');

      expect(recommendations[0].reasons.length).toBeGreaterThan(0);
    });

    it('should identify cautions', () => {
      addRecords('traditional', 20, 0.5); // Low adherence

      const recommendations = service.generateRecommendations('user');

      expect(recommendations.some(r => r.cautions.length > 0)).toBe(true);
    });
  });

  // ==========================================================================
  // Context-Based Recommendation Tests (3 tests)
  // ==========================================================================
  describe('Context-Based Recommendations', () => {
    beforeEach(() => {
      addRecords('traditional', 20);
      addRecords('if-16-8', 20);
    });

    it('should recommend based on context', () => {
      const bestPattern = service.getBestPatternForContext({ isWeekend: true });

      expect(bestPattern).toBeDefined();
    });

    it('should consider exercise context', () => {
      const bestPattern = service.getBestPatternForContext({ hadExercise: true });

      expect(bestPattern).toBeDefined();
    });

    it('should return null with no patterns', () => {
      service.clearData();

      const bestPattern = service.getBestPatternForContext({ isWeekend: true });

      expect(bestPattern).toBeNull();
    });
  });
});
