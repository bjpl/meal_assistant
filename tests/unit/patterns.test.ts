/**
 * Unit Tests: Pattern Selection Logic
 * Tests for meal patterns, success prediction, and pattern switching
 * Target: 90% coverage
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Types
interface MealPattern {
  id: string;
  name: string;
  description: string;
  meals: number;
  targetCalories: number;
  targetProtein: number;
  mealTimes: string[];
  restrictions?: string[];
  successRate?: number;
}

interface PatternHistory {
  patternId: string;
  date: string;
  completed: boolean;
  adherenceScore: number;
  reason?: string;
}

interface DayContext {
  dayOfWeek: number;
  isWorkday: boolean;
  scheduledEvents: string[];
  energyLevel?: number;
  stressLevel?: number;
}

// Mock Pattern Service
const createPatternService = () => {
  const patterns = new Map<string, MealPattern>([
    ['traditional', {
      id: 'traditional',
      name: 'Traditional',
      description: '3 balanced meals per day',
      meals: 3,
      targetCalories: 2000,
      targetProtein: 130,
      mealTimes: ['08:00', '12:30', '18:30'],
      successRate: 0.85
    }],
    ['if-16-8', {
      id: 'if-16-8',
      name: 'Intermittent Fasting 16:8',
      description: '16 hour fast, 8 hour eating window',
      meals: 2,
      targetCalories: 1800,
      targetProtein: 130,
      mealTimes: ['12:00', '19:00'],
      restrictions: ['no-breakfast'],
      successRate: 0.72
    }],
    ['grazing', {
      id: 'grazing',
      name: 'Grazing',
      description: '5-6 small meals throughout day',
      meals: 5,
      targetCalories: 2000,
      targetProtein: 130,
      mealTimes: ['08:00', '10:30', '13:00', '15:30', '18:00'],
      successRate: 0.68
    }],
    ['omad', {
      id: 'omad',
      name: 'One Meal A Day',
      description: 'Single large meal',
      meals: 1,
      targetCalories: 1800,
      targetProtein: 130,
      mealTimes: ['18:00'],
      restrictions: ['fasting-required'],
      successRate: 0.55
    }],
    ['keto', {
      id: 'keto',
      name: 'Keto Pattern',
      description: 'High fat, very low carb',
      meals: 3,
      targetCalories: 1800,
      targetProtein: 100,
      mealTimes: ['08:00', '13:00', '18:00'],
      restrictions: ['low-carb', 'high-fat'],
      successRate: 0.62
    }],
    ['workout', {
      id: 'workout',
      name: 'Workout Day',
      description: 'Higher calories for training',
      meals: 4,
      targetCalories: 2200,
      targetProtein: 150,
      mealTimes: ['07:00', '11:00', '15:00', '19:00'],
      successRate: 0.78
    }],
    ['light', {
      id: 'light',
      name: 'Light Day',
      description: 'Lower calorie recovery day',
      meals: 3,
      targetCalories: 1600,
      targetProtein: 120,
      mealTimes: ['09:00', '13:00', '18:00'],
      successRate: 0.80
    }]
  ]);

  const history: PatternHistory[] = [];

  return {
    getPattern(id: string): MealPattern | undefined {
      return patterns.get(id);
    },

    getAllPatterns(): MealPattern[] {
      return Array.from(patterns.values());
    },

    selectPattern(id: string): MealPattern | null {
      const pattern = patterns.get(id);
      if (!pattern) return null;
      return pattern;
    },

    switchPattern(fromId: string, toId: string, currentTime: string): {
      success: boolean;
      newPattern: MealPattern | null;
      remainingMeals: number;
      adjustedCalories: number;
    } {
      const toPattern = patterns.get(toId);
      if (!toPattern) {
        return { success: false, newPattern: null, remainingMeals: 0, adjustedCalories: 0 };
      }

      // Calculate remaining meals based on current time
      const [hours] = currentTime.split(':').map(Number);
      const remainingMeals = toPattern.mealTimes.filter(time => {
        const [mealHours] = time.split(':').map(Number);
        return mealHours > hours;
      }).length;

      const caloriesPerMeal = toPattern.targetCalories / toPattern.meals;
      const adjustedCalories = remainingMeals * caloriesPerMeal;

      return {
        success: true,
        newPattern: toPattern,
        remainingMeals,
        adjustedCalories: Math.round(adjustedCalories)
      };
    },

    predictSuccess(patternId: string, context: DayContext): {
      likelihood: number;
      factors: string[];
      recommendation: string;
    } {
      const pattern = patterns.get(patternId);
      if (!pattern) {
        return { likelihood: 0, factors: ['Pattern not found'], recommendation: 'Select valid pattern' };
      }

      let likelihood = pattern.successRate || 0.5;
      const factors: string[] = [];

      // Day of week adjustment
      if (context.dayOfWeek === 0 || context.dayOfWeek === 6) {
        if (patternId === 'traditional' || patternId === 'grazing') {
          likelihood += 0.1;
          factors.push('Weekends favor relaxed patterns');
        }
      } else {
        if (patternId === 'if-16-8') {
          likelihood += 0.05;
          factors.push('Workdays suit IF patterns');
        }
      }

      // Scheduled events adjustment
      if (context.scheduledEvents.length > 2) {
        likelihood -= 0.15;
        factors.push('Busy schedule may reduce adherence');
      }

      // Energy level adjustment
      if (context.energyLevel !== undefined) {
        if (context.energyLevel < 3 && patternId === 'omad') {
          likelihood -= 0.2;
          factors.push('Low energy not ideal for OMAD');
        }
      }

      // Stress level adjustment
      if (context.stressLevel !== undefined && context.stressLevel > 7) {
        likelihood -= 0.1;
        factors.push('High stress may impact adherence');
      }

      likelihood = Math.max(0.1, Math.min(0.95, likelihood));

      let recommendation = 'Good choice';
      if (likelihood < 0.5) {
        recommendation = 'Consider alternative pattern';
      } else if (likelihood > 0.8) {
        recommendation = 'Excellent match for today';
      }

      return {
        likelihood: Math.round(likelihood * 100) / 100,
        factors,
        recommendation
      };
    },

    recordCompletion(patternId: string, completed: boolean, adherenceScore: number, reason?: string): void {
      history.push({
        patternId,
        date: new Date().toISOString(),
        completed,
        adherenceScore,
        reason
      });

      // Update pattern success rate based on history
      const patternHistory = history.filter(h => h.patternId === patternId);
      if (patternHistory.length >= 5) {
        const successCount = patternHistory.filter(h => h.completed).length;
        const pattern = patterns.get(patternId);
        if (pattern) {
          pattern.successRate = successCount / patternHistory.length;
        }
      }
    },

    getHistory(patternId?: string): PatternHistory[] {
      if (patternId) {
        return history.filter(h => h.patternId === patternId);
      }
      return history;
    },

    getRecommendation(context: DayContext): MealPattern {
      const predictions = Array.from(patterns.entries()).map(([id, pattern]) => ({
        pattern,
        prediction: this.predictSuccess(id, context)
      }));

      predictions.sort((a, b) => b.prediction.likelihood - a.prediction.likelihood);
      return predictions[0].pattern;
    },

    calculateRemainingTargets(
      patternId: string,
      consumedCalories: number,
      consumedProtein: number
    ): { calories: number; protein: number; mealsRemaining: number } | null {
      const pattern = patterns.get(patternId);
      if (!pattern) return null;

      return {
        calories: Math.max(0, pattern.targetCalories - consumedCalories),
        protein: Math.max(0, pattern.targetProtein - consumedProtein),
        mealsRemaining: pattern.meals - Math.floor(consumedCalories / (pattern.targetCalories / pattern.meals))
      };
    },

    validatePatternChange(currentPatternId: string, newPatternId: string, hoursElapsed: number): {
      valid: boolean;
      warning?: string;
    } {
      const currentPattern = patterns.get(currentPatternId);
      const newPattern = patterns.get(newPatternId);

      if (!currentPattern || !newPattern) {
        return { valid: false, warning: 'Invalid pattern ID' };
      }

      // Warn if switching after significant time
      if (hoursElapsed > 12) {
        return { valid: true, warning: 'Late day switch - targets may be difficult to meet' };
      }

      // Warn about drastic calorie changes
      const calorieDiff = Math.abs(currentPattern.targetCalories - newPattern.targetCalories);
      if (calorieDiff > 400) {
        return { valid: true, warning: `Significant calorie change: ${calorieDiff} cal difference` };
      }

      return { valid: true };
    }
  };
};

describe('Pattern Selection', () => {
  let patternService: ReturnType<typeof createPatternService>;

  beforeEach(() => {
    patternService = createPatternService();
  });

  describe('Basic Pattern Operations', () => {
    it('should get all 7 patterns', () => {
      const patterns = patternService.getAllPatterns();
      expect(patterns).toHaveLength(7);
    });

    it('should get pattern by ID', () => {
      const pattern = patternService.getPattern('traditional');
      expect(pattern).toBeDefined();
      expect(pattern?.name).toBe('Traditional');
      expect(pattern?.meals).toBe(3);
    });

    it('should return undefined for invalid pattern ID', () => {
      const pattern = patternService.getPattern('invalid-pattern');
      expect(pattern).toBeUndefined();
    });

    it('should select a valid pattern', () => {
      const selected = patternService.selectPattern('if-16-8');
      expect(selected).toBeDefined();
      expect(selected?.id).toBe('if-16-8');
    });

    it('should return null for invalid pattern selection', () => {
      const selected = patternService.selectPattern('fake-pattern');
      expect(selected).toBeNull();
    });
  });

  describe('Mid-Day Pattern Switching', () => {
    it('should switch pattern and recalculate remaining meals', () => {
      const result = patternService.switchPattern('traditional', 'if-16-8', '14:00');

      expect(result.success).toBe(true);
      expect(result.newPattern?.id).toBe('if-16-8');
      expect(result.remainingMeals).toBe(1); // Only 19:00 meal remains
    });

    it('should calculate adjusted calories for remaining day', () => {
      const result = patternService.switchPattern('traditional', 'grazing', '13:30');

      expect(result.success).toBe(true);
      // Grazing has 5 meals, 2 remaining after 13:30 (15:30, 18:00)
      expect(result.remainingMeals).toBe(2);
      expect(result.adjustedCalories).toBe(Math.round(2000 / 5 * 2)); // 800
    });

    it('should handle switch when no meals remain', () => {
      const result = patternService.switchPattern('traditional', 'if-16-8', '20:00');

      expect(result.success).toBe(true);
      expect(result.remainingMeals).toBe(0);
      expect(result.adjustedCalories).toBe(0);
    });

    it('should fail switch to invalid pattern', () => {
      const result = patternService.switchPattern('traditional', 'invalid', '12:00');

      expect(result.success).toBe(false);
      expect(result.newPattern).toBeNull();
    });

    it('should maintain daily targets when possible', () => {
      const result = patternService.switchPattern('traditional', 'light', '10:00');

      expect(result.success).toBe(true);
      expect(result.remainingMeals).toBe(2); // 13:00 and 18:00
      // Light day: 1600 cal / 3 meals * 2 remaining
      expect(result.adjustedCalories).toBe(Math.round(1600 / 3 * 2));
    });
  });

  describe('Pattern Success Prediction', () => {
    it('should predict higher success on weekends for traditional pattern', () => {
      const weekdayContext: DayContext = {
        dayOfWeek: 2, // Tuesday
        isWorkday: true,
        scheduledEvents: []
      };

      const weekendContext: DayContext = {
        dayOfWeek: 6, // Saturday
        isWorkday: false,
        scheduledEvents: []
      };

      const weekdayPrediction = patternService.predictSuccess('traditional', weekdayContext);
      const weekendPrediction = patternService.predictSuccess('traditional', weekendContext);

      expect(weekendPrediction.likelihood).toBeGreaterThan(weekdayPrediction.likelihood);
    });

    it('should reduce likelihood for busy days', () => {
      const calmDay: DayContext = {
        dayOfWeek: 1,
        isWorkday: true,
        scheduledEvents: []
      };

      const busyDay: DayContext = {
        dayOfWeek: 1,
        isWorkday: true,
        scheduledEvents: ['meeting', 'lunch', 'presentation', 'call']
      };

      const calmPrediction = patternService.predictSuccess('traditional', calmDay);
      const busyPrediction = patternService.predictSuccess('traditional', busyDay);

      expect(busyPrediction.likelihood).toBeLessThan(calmPrediction.likelihood);
      expect(busyPrediction.factors).toContain('Busy schedule may reduce adherence');
    });

    it('should warn against OMAD on low energy days', () => {
      const lowEnergyContext: DayContext = {
        dayOfWeek: 3,
        isWorkday: true,
        scheduledEvents: [],
        energyLevel: 2
      };

      const prediction = patternService.predictSuccess('omad', lowEnergyContext);

      expect(prediction.factors).toContain('Low energy not ideal for OMAD');
      expect(prediction.likelihood).toBeLessThan(0.5);
    });

    it('should consider stress levels in prediction', () => {
      const stressedContext: DayContext = {
        dayOfWeek: 4,
        isWorkday: true,
        scheduledEvents: [],
        stressLevel: 9
      };

      const prediction = patternService.predictSuccess('keto', stressedContext);

      expect(prediction.factors).toContain('High stress may impact adherence');
    });

    it('should return 0 likelihood for invalid pattern', () => {
      const context: DayContext = {
        dayOfWeek: 1,
        isWorkday: true,
        scheduledEvents: []
      };

      const prediction = patternService.predictSuccess('fake-pattern', context);

      expect(prediction.likelihood).toBe(0);
      expect(prediction.factors).toContain('Pattern not found');
    });
  });

  describe('Pattern History & Learning', () => {
    it('should record pattern completion', () => {
      patternService.recordCompletion('traditional', true, 0.95);
      patternService.recordCompletion('traditional', true, 0.88);
      patternService.recordCompletion('traditional', false, 0.45, 'Social event');

      const history = patternService.getHistory('traditional');
      expect(history).toHaveLength(3);
    });

    it('should update success rate based on history', () => {
      // Record 5 completions to trigger success rate update
      for (let i = 0; i < 5; i++) {
        patternService.recordCompletion('if-16-8', i < 4, i < 4 ? 0.9 : 0.3);
      }

      const pattern = patternService.getPattern('if-16-8');
      expect(pattern?.successRate).toBe(0.8); // 4 out of 5
    });

    it('should get full history when no pattern specified', () => {
      patternService.recordCompletion('traditional', true, 0.9);
      patternService.recordCompletion('if-16-8', true, 0.85);
      patternService.recordCompletion('grazing', false, 0.4);

      const allHistory = patternService.getHistory();
      expect(allHistory).toHaveLength(3);
    });
  });

  describe('Pattern Recommendations', () => {
    it('should recommend best pattern for context', () => {
      const context: DayContext = {
        dayOfWeek: 6, // Saturday
        isWorkday: false,
        scheduledEvents: []
      };

      const recommendation = patternService.getRecommendation(context);
      expect(recommendation).toBeDefined();
      expect(recommendation.id).toBe('traditional'); // Highest base success rate + weekend bonus
    });

    it('should recommend IF on workdays', () => {
      const context: DayContext = {
        dayOfWeek: 2, // Tuesday
        isWorkday: true,
        scheduledEvents: []
      };

      // IF gets a boost on workdays
      const prediction = patternService.predictSuccess('if-16-8', context);
      expect(prediction.factors).toContain('Workdays suit IF patterns');
    });
  });

  describe('Remaining Targets Calculation', () => {
    it('should calculate remaining calories and protein', () => {
      const remaining = patternService.calculateRemainingTargets('traditional', 800, 50);

      expect(remaining).not.toBeNull();
      expect(remaining?.calories).toBe(1200);
      expect(remaining?.protein).toBe(80);
    });

    it('should not return negative values', () => {
      const remaining = patternService.calculateRemainingTargets('light', 2000, 150);

      expect(remaining?.calories).toBe(0);
      expect(remaining?.protein).toBe(0);
    });

    it('should return null for invalid pattern', () => {
      const remaining = patternService.calculateRemainingTargets('fake', 500, 30);
      expect(remaining).toBeNull();
    });
  });

  describe('Pattern Change Validation', () => {
    it('should allow valid pattern changes', () => {
      const result = patternService.validatePatternChange('traditional', 'grazing', 4);
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('should warn about late day switches', () => {
      const result = patternService.validatePatternChange('traditional', 'if-16-8', 14);
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('Late day switch');
    });

    it('should warn about significant calorie changes', () => {
      const result = patternService.validatePatternChange('workout', 'light', 2);
      // 2200 - 1600 = 600 calorie difference
      expect(result.valid).toBe(true);
      expect(result.warning).toContain('Significant calorie change');
    });

    it('should reject invalid pattern IDs', () => {
      const result = patternService.validatePatternChange('traditional', 'fake', 2);
      expect(result.valid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle pattern with no restrictions', () => {
      const pattern = patternService.getPattern('traditional');
      expect(pattern?.restrictions).toBeUndefined();
    });

    it('should handle pattern with restrictions', () => {
      const pattern = patternService.getPattern('if-16-8');
      expect(pattern?.restrictions).toContain('no-breakfast');
    });

    it('should handle midnight pattern switch', () => {
      const result = patternService.switchPattern('traditional', 'if-16-8', '00:00');
      expect(result.success).toBe(true);
      expect(result.remainingMeals).toBe(2); // Both 12:00 and 19:00 are after midnight
    });

    it('should clamp prediction likelihood between 0.1 and 0.95', () => {
      // Create extremely negative context
      const terribleContext: DayContext = {
        dayOfWeek: 1,
        isWorkday: true,
        scheduledEvents: ['a', 'b', 'c', 'd', 'e'],
        energyLevel: 1,
        stressLevel: 10
      };

      const prediction = patternService.predictSuccess('omad', terribleContext);
      expect(prediction.likelihood).toBeGreaterThanOrEqual(0.1);
      expect(prediction.likelihood).toBeLessThanOrEqual(0.95);
    });
  });
});
