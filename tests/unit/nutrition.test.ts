/**
 * Unit Tests: Nutrition Calculations
 * Tests for calorie/macro calculations, hydration, and substitutions
 * Target: 90% coverage
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Types
interface NutritionData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
}

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  nutrition: NutritionData;
}

interface Substitution {
  original: string;
  replacement: string;
  nutritionDelta: NutritionData;
  satisfactionPrediction: number;
}

// Nutrition Calculator Service
const createNutritionService = () => ({
  calculateMealNutrition(ingredients: Ingredient[]): NutritionData {
    return ingredients.reduce(
      (total, ingredient) => ({
        calories: total.calories + ingredient.nutrition.calories,
        protein: total.protein + ingredient.nutrition.protein,
        carbs: total.carbs + ingredient.nutrition.carbs,
        fat: total.fat + ingredient.nutrition.fat,
        fiber: (total.fiber || 0) + (ingredient.nutrition.fiber || 0),
        sodium: (total.sodium || 0) + (ingredient.nutrition.sodium || 0)
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }
    );
  },

  scaleNutrition(nutrition: NutritionData, factor: number): NutritionData {
    return {
      calories: Math.round(nutrition.calories * factor),
      protein: Math.round(nutrition.protein * factor * 10) / 10,
      carbs: Math.round(nutrition.carbs * factor * 10) / 10,
      fat: Math.round(nutrition.fat * factor * 10) / 10,
      fiber: nutrition.fiber ? Math.round(nutrition.fiber * factor * 10) / 10 : undefined,
      sodium: nutrition.sodium ? Math.round(nutrition.sodium * factor) : undefined
    };
  },

  calculateDailyProgress(
    consumed: NutritionData,
    targets: NutritionData
  ): { percentage: number; remaining: NutritionData; status: string } {
    const caloriePercentage = (consumed.calories / targets.calories) * 100;
    const proteinPercentage = (consumed.protein / targets.protein) * 100;

    const remaining: NutritionData = {
      calories: Math.max(0, targets.calories - consumed.calories),
      protein: Math.max(0, targets.protein - consumed.protein),
      carbs: Math.max(0, targets.carbs - consumed.carbs),
      fat: Math.max(0, targets.fat - consumed.fat)
    };

    let status = 'on-track';
    if (caloriePercentage > 110) {
      status = 'over-target';
    } else if (caloriePercentage < 50 && proteinPercentage < 50) {
      status = 'under-target';
    }

    return {
      percentage: Math.round(caloriePercentage),
      remaining,
      status
    };
  },

  validateNutrition(nutrition: NutritionData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (nutrition.calories < 0) errors.push('Calories cannot be negative');
    if (nutrition.protein < 0) errors.push('Protein cannot be negative');
    if (nutrition.carbs < 0) errors.push('Carbs cannot be negative');
    if (nutrition.fat < 0) errors.push('Fat cannot be negative');

    // Check macro consistency (calories from macros should roughly match total)
    const calculatedCalories =
      nutrition.protein * 4 + nutrition.carbs * 4 + nutrition.fat * 9;
    const variance = Math.abs(nutrition.calories - calculatedCalories);

    if (variance > nutrition.calories * 0.15) {
      errors.push(`Macro-calorie mismatch: ${Math.round(variance)} cal variance`);
    }

    return { valid: errors.length === 0, errors };
  },

  calculateHydrationTarget(bodyWeightLbs: number): {
    targetOz: number;
    targetGlasses: number;
    minimumOz: number;
  } {
    const targetOz = Math.round(bodyWeightLbs / 2);
    return {
      targetOz,
      targetGlasses: Math.ceil(targetOz / 8),
      minimumOz: 64 // 8 glasses minimum
    };
  },

  trackCaffeineIntake(
    currentMg: number,
    additionalMg: number
  ): { total: number; warning: string | null; remaining: number } {
    const total = currentMg + additionalMg;
    const limit = 400;
    const warningThreshold = 300;

    let warning: string | null = null;
    if (total >= limit) {
      warning = `Caffeine limit reached: ${total}mg (limit: ${limit}mg)`;
    } else if (total >= warningThreshold) {
      warning = `Approaching caffeine limit: ${total}mg`;
    }

    return {
      total,
      warning,
      remaining: Math.max(0, limit - total)
    };
  },

  findSubstitutes(
    ingredient: string,
    category: 'protein' | 'carb' | 'fat'
  ): Substitution[] {
    const substitutions: Record<string, Substitution[]> = {
      'chicken breast': [
        {
          original: 'chicken breast',
          replacement: 'turkey breast',
          nutritionDelta: { calories: -10, protein: 1, carbs: 0, fat: -1 },
          satisfactionPrediction: 0.85
        },
        {
          original: 'chicken breast',
          replacement: 'tofu (firm)',
          nutritionDelta: { calories: -20, protein: -12, carbs: 2, fat: 3 },
          satisfactionPrediction: 0.65
        },
        {
          original: 'chicken breast',
          replacement: 'salmon',
          nutritionDelta: { calories: 30, protein: -2, carbs: 0, fat: 5 },
          satisfactionPrediction: 0.9
        }
      ],
      rice: [
        {
          original: 'rice',
          replacement: 'quinoa',
          nutritionDelta: { calories: 10, protein: 4, carbs: -5, fat: 2 },
          satisfactionPrediction: 0.75
        },
        {
          original: 'rice',
          replacement: 'cauliflower rice',
          nutritionDelta: { calories: -180, protein: -3, carbs: -43, fat: 0 },
          satisfactionPrediction: 0.5
        },
        {
          original: 'rice',
          replacement: 'sweet potato',
          nutritionDelta: { calories: -80, protein: -2, carbs: -20, fat: 0 },
          satisfactionPrediction: 0.8
        }
      ]
    };

    return substitutions[ingredient.toLowerCase()] || [];
  },

  evaluateSubstitution(
    original: NutritionData,
    substitution: Substitution,
    targets: { calories: string; protein: string }
  ): { recommended: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // Check calorie alignment
    const calorieTarget = targets.calories.includes('+') ? 'increase' : 'decrease';
    if (
      (calorieTarget === 'decrease' && substitution.nutritionDelta.calories < 0) ||
      (calorieTarget === 'increase' && substitution.nutritionDelta.calories > 0)
    ) {
      score++;
      reasons.push(`Aligns with calorie goal: ${substitution.nutritionDelta.calories} cal`);
    }

    // Check protein alignment
    const proteinTarget = targets.protein.includes('+') ? 'increase' : 'maintain';
    if (substitution.nutritionDelta.protein >= 0) {
      score++;
      reasons.push(`Maintains/increases protein: ${substitution.nutritionDelta.protein}g`);
    }

    // Check satisfaction
    if (substitution.satisfactionPrediction >= 0.7) {
      score++;
      reasons.push(`High satisfaction prediction: ${Math.round(substitution.satisfactionPrediction * 100)}%`);
    }

    return {
      recommended: score >= 2,
      reasons
    };
  },

  calculateMacroSplit(nutrition: NutritionData): {
    proteinPercent: number;
    carbPercent: number;
    fatPercent: number;
  } {
    const proteinCal = nutrition.protein * 4;
    const carbCal = nutrition.carbs * 4;
    const fatCal = nutrition.fat * 9;
    const totalCal = proteinCal + carbCal + fatCal;

    if (totalCal === 0) {
      return { proteinPercent: 0, carbPercent: 0, fatPercent: 0 };
    }

    return {
      proteinPercent: Math.round((proteinCal / totalCal) * 100),
      carbPercent: Math.round((carbCal / totalCal) * 100),
      fatPercent: Math.round((fatCal / totalCal) * 100)
    };
  },

  estimateServings(
    nutrition: NutritionData,
    targetCaloriesPerServing: number
  ): number {
    if (targetCaloriesPerServing <= 0) return 0;
    return Math.round((nutrition.calories / targetCaloriesPerServing) * 10) / 10;
  }
});

describe('Nutrition Calculations', () => {
  let nutritionService: ReturnType<typeof createNutritionService>;

  beforeEach(() => {
    nutritionService = createNutritionService();
  });

  describe('Meal Nutrition Calculation', () => {
    it('should calculate total nutrition from ingredients', () => {
      const ingredients: Ingredient[] = [
        {
          name: 'Chicken Breast',
          quantity: 6,
          unit: 'oz',
          nutrition: { calories: 280, protein: 52, carbs: 0, fat: 6 }
        },
        {
          name: 'Brown Rice',
          quantity: 1,
          unit: 'cup',
          nutrition: { calories: 215, protein: 5, carbs: 45, fat: 2 }
        },
        {
          name: 'Broccoli',
          quantity: 1,
          unit: 'cup',
          nutrition: { calories: 55, protein: 4, carbs: 11, fat: 0, fiber: 5 }
        }
      ];

      const result = nutritionService.calculateMealNutrition(ingredients);

      expect(result.calories).toBe(550);
      expect(result.protein).toBe(61);
      expect(result.carbs).toBe(56);
      expect(result.fat).toBe(8);
      expect(result.fiber).toBe(5);
    });

    it('should handle empty ingredient list', () => {
      const result = nutritionService.calculateMealNutrition([]);

      expect(result.calories).toBe(0);
      expect(result.protein).toBe(0);
      expect(result.carbs).toBe(0);
      expect(result.fat).toBe(0);
    });

    it('should handle single ingredient', () => {
      const ingredients: Ingredient[] = [
        {
          name: 'Protein Shake',
          quantity: 1,
          unit: 'serving',
          nutrition: { calories: 150, protein: 30, carbs: 5, fat: 2 }
        }
      ];

      const result = nutritionService.calculateMealNutrition(ingredients);

      expect(result.calories).toBe(150);
      expect(result.protein).toBe(30);
    });
  });

  describe('Nutrition Scaling', () => {
    it('should scale nutrition by factor', () => {
      const original: NutritionData = {
        calories: 200,
        protein: 20,
        carbs: 25,
        fat: 5,
        fiber: 3,
        sodium: 400
      };

      const scaled = nutritionService.scaleNutrition(original, 1.5);

      expect(scaled.calories).toBe(300);
      expect(scaled.protein).toBe(30);
      expect(scaled.carbs).toBe(37.5);
      expect(scaled.fat).toBe(7.5);
      expect(scaled.fiber).toBe(4.5);
      expect(scaled.sodium).toBe(600);
    });

    it('should handle half portions', () => {
      const original: NutritionData = {
        calories: 500,
        protein: 40,
        carbs: 50,
        fat: 15
      };

      const scaled = nutritionService.scaleNutrition(original, 0.5);

      expect(scaled.calories).toBe(250);
      expect(scaled.protein).toBe(20);
    });

    it('should handle zero scaling', () => {
      const original: NutritionData = {
        calories: 500,
        protein: 40,
        carbs: 50,
        fat: 15
      };

      const scaled = nutritionService.scaleNutrition(original, 0);

      expect(scaled.calories).toBe(0);
      expect(scaled.protein).toBe(0);
    });
  });

  describe('Daily Progress Tracking', () => {
    it('should calculate progress percentage', () => {
      const consumed: NutritionData = {
        calories: 1200,
        protein: 80,
        carbs: 150,
        fat: 40
      };

      const targets: NutritionData = {
        calories: 2000,
        protein: 130,
        carbs: 250,
        fat: 65
      };

      const progress = nutritionService.calculateDailyProgress(consumed, targets);

      expect(progress.percentage).toBe(60);
      expect(progress.status).toBe('on-track');
    });

    it('should identify over-target status', () => {
      const consumed: NutritionData = {
        calories: 2300,
        protein: 140,
        carbs: 280,
        fat: 75
      };

      const targets: NutritionData = {
        calories: 2000,
        protein: 130,
        carbs: 250,
        fat: 65
      };

      const progress = nutritionService.calculateDailyProgress(consumed, targets);

      expect(progress.percentage).toBe(115);
      expect(progress.status).toBe('over-target');
    });

    it('should identify under-target status', () => {
      const consumed: NutritionData = {
        calories: 800,
        protein: 40,
        carbs: 100,
        fat: 25
      };

      const targets: NutritionData = {
        calories: 2000,
        protein: 130,
        carbs: 250,
        fat: 65
      };

      const progress = nutritionService.calculateDailyProgress(consumed, targets);

      expect(progress.status).toBe('under-target');
    });

    it('should calculate remaining macros correctly', () => {
      const consumed: NutritionData = {
        calories: 1500,
        protein: 100,
        carbs: 180,
        fat: 50
      };

      const targets: NutritionData = {
        calories: 2000,
        protein: 130,
        carbs: 250,
        fat: 65
      };

      const progress = nutritionService.calculateDailyProgress(consumed, targets);

      expect(progress.remaining.calories).toBe(500);
      expect(progress.remaining.protein).toBe(30);
      expect(progress.remaining.carbs).toBe(70);
      expect(progress.remaining.fat).toBe(15);
    });

    it('should not return negative remaining values', () => {
      const consumed: NutritionData = {
        calories: 2500,
        protein: 150,
        carbs: 300,
        fat: 80
      };

      const targets: NutritionData = {
        calories: 2000,
        protein: 130,
        carbs: 250,
        fat: 65
      };

      const progress = nutritionService.calculateDailyProgress(consumed, targets);

      expect(progress.remaining.calories).toBe(0);
      expect(progress.remaining.protein).toBe(0);
    });
  });

  describe('Nutrition Validation', () => {
    it('should validate correct nutrition data', () => {
      const nutrition: NutritionData = {
        calories: 500,
        protein: 40,  // 160 cal
        carbs: 50,    // 200 cal
        fat: 15       // 135 cal = 495 cal total (within 15% of 500)
      };

      const result = nutritionService.validateNutrition(nutrition);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative values', () => {
      const nutrition: NutritionData = {
        calories: 500,
        protein: -10,
        carbs: 50,
        fat: 15
      };

      const result = nutritionService.validateNutrition(nutrition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Protein cannot be negative');
    });

    it('should detect macro-calorie mismatch', () => {
      const nutrition: NutritionData = {
        calories: 1000,  // Claimed
        protein: 10,     // 40 cal
        carbs: 20,       // 80 cal
        fat: 5           // 45 cal = 165 cal actual (way off from 1000)
      };

      const result = nutritionService.validateNutrition(nutrition);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Macro-calorie mismatch'))).toBe(true);
    });
  });

  describe('Hydration Calculations', () => {
    it('should calculate hydration target based on body weight', () => {
      // Brandon at 250 lbs
      const result = nutritionService.calculateHydrationTarget(250);

      expect(result.targetOz).toBe(125);
      expect(result.targetGlasses).toBe(16); // 125/8 = 15.6, ceil = 16
      expect(result.minimumOz).toBe(64);
    });

    it('should handle lighter body weights', () => {
      const result = nutritionService.calculateHydrationTarget(120);

      expect(result.targetOz).toBe(60);
      expect(result.targetGlasses).toBe(8);
    });

    it('should always have 64oz minimum', () => {
      const result = nutritionService.calculateHydrationTarget(100);

      expect(result.targetOz).toBe(50);
      expect(result.minimumOz).toBe(64);
    });
  });

  describe('Caffeine Tracking', () => {
    it('should track caffeine intake', () => {
      const result = nutritionService.trackCaffeineIntake(0, 95); // One coffee

      expect(result.total).toBe(95);
      expect(result.warning).toBeNull();
      expect(result.remaining).toBe(305);
    });

    it('should warn when approaching limit', () => {
      const result = nutritionService.trackCaffeineIntake(250, 100);

      expect(result.total).toBe(350);
      expect(result.warning).toContain('Approaching caffeine limit');
      expect(result.remaining).toBe(50);
    });

    it('should alert when limit reached', () => {
      const result = nutritionService.trackCaffeineIntake(350, 100);

      expect(result.total).toBe(450);
      expect(result.warning).toContain('Caffeine limit reached');
      expect(result.remaining).toBe(0);
    });
  });

  describe('Ingredient Substitutions', () => {
    it('should find substitutes for chicken breast', () => {
      const subs = nutritionService.findSubstitutes('chicken breast', 'protein');

      expect(subs).toHaveLength(3);
      expect(subs.map(s => s.replacement)).toContain('turkey breast');
      expect(subs.map(s => s.replacement)).toContain('salmon');
    });

    it('should find substitutes for rice', () => {
      const subs = nutritionService.findSubstitutes('rice', 'carb');

      expect(subs).toHaveLength(3);
      expect(subs.map(s => s.replacement)).toContain('quinoa');
      expect(subs.map(s => s.replacement)).toContain('cauliflower rice');
    });

    it('should return empty array for unknown ingredients', () => {
      const subs = nutritionService.findSubstitutes('dragon fruit', 'carb');

      expect(subs).toHaveLength(0);
    });

    it('should evaluate substitution recommendation', () => {
      const original: NutritionData = {
        calories: 280,
        protein: 52,
        carbs: 0,
        fat: 6
      };

      const substitution: Substitution = {
        original: 'chicken breast',
        replacement: 'turkey breast',
        nutritionDelta: { calories: -10, protein: 1, carbs: 0, fat: -1 },
        satisfactionPrediction: 0.85
      };

      const result = nutritionService.evaluateSubstitution(
        original,
        substitution,
        { calories: '-50', protein: '+5' }
      );

      expect(result.recommended).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('Macro Split Calculation', () => {
    it('should calculate macro percentages', () => {
      const nutrition: NutritionData = {
        calories: 500,
        protein: 50,   // 200 cal = 40%
        carbs: 50,     // 200 cal = 40%
        fat: 11        // 99 cal = ~20%
      };

      const split = nutritionService.calculateMacroSplit(nutrition);

      expect(split.proteinPercent).toBe(40);
      expect(split.carbPercent).toBe(40);
      expect(split.fatPercent).toBe(20);
    });

    it('should handle zero nutrition', () => {
      const nutrition: NutritionData = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
      };

      const split = nutritionService.calculateMacroSplit(nutrition);

      expect(split.proteinPercent).toBe(0);
      expect(split.carbPercent).toBe(0);
      expect(split.fatPercent).toBe(0);
    });
  });

  describe('Serving Estimation', () => {
    it('should estimate number of servings', () => {
      const nutrition: NutritionData = {
        calories: 1500,
        protein: 100,
        carbs: 150,
        fat: 50
      };

      const servings = nutritionService.estimateServings(nutrition, 500);

      expect(servings).toBe(3);
    });

    it('should handle fractional servings', () => {
      const nutrition: NutritionData = {
        calories: 750,
        protein: 50,
        carbs: 75,
        fat: 25
      };

      const servings = nutritionService.estimateServings(nutrition, 500);

      expect(servings).toBe(1.5);
    });

    it('should return 0 for invalid target', () => {
      const nutrition: NutritionData = {
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 15
      };

      const servings = nutritionService.estimateServings(nutrition, 0);

      expect(servings).toBe(0);
    });
  });
});
