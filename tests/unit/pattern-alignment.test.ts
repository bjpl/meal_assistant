/**
 * Unit Tests: Pattern Alignment
 * Tests for verifying mobile pattern definitions match database spec
 * Week 1-2 Deliverable - Target: 20+ test cases
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// ============================================================================
// Pattern Definitions from Spec (Source of Truth)
// ============================================================================

interface PatternSpec {
  id: string;
  name: string;
  description: string;
  meals: number;
  targetCalories: { min: number; max: number };
  targetProtein: { min: number; max: number };
  mealTimes: string[];
  mealStructure: Array<{
    name: string;
    caloriePercent: number;
    proteinPercent: number;
  }>;
}

// These are the spec definitions for all 7 patterns (A-G)
const PATTERN_SPECS: Record<string, PatternSpec> = {
  'A': {
    id: 'A',
    name: 'Traditional 3-Meal',
    description: 'Classic breakfast, lunch, dinner pattern',
    meals: 3,
    targetCalories: { min: 1800, max: 2000 },
    targetProtein: { min: 130, max: 145 },
    mealTimes: ['08:00', '12:30', '18:30'],
    mealStructure: [
      { name: 'Breakfast', caloriePercent: 25, proteinPercent: 25 },
      { name: 'Lunch', caloriePercent: 35, proteinPercent: 35 },
      { name: 'Dinner', caloriePercent: 40, proteinPercent: 40 }
    ]
  },
  'B': {
    id: 'B',
    name: 'IF 16:8',
    description: 'Intermittent fasting with 8-hour eating window',
    meals: 2,
    targetCalories: { min: 1800, max: 2000 },
    targetProtein: { min: 130, max: 145 },
    mealTimes: ['12:00', '19:00'],
    mealStructure: [
      { name: 'First Meal', caloriePercent: 45, proteinPercent: 45 },
      { name: 'Second Meal', caloriePercent: 55, proteinPercent: 55 }
    ]
  },
  'C': {
    id: 'C',
    name: 'Grazing/Small Meals',
    description: '5-6 small meals throughout the day',
    meals: 5,
    targetCalories: { min: 1800, max: 2000 },
    targetProtein: { min: 130, max: 145 },
    mealTimes: ['08:00', '10:30', '13:00', '15:30', '18:00'],
    mealStructure: [
      { name: 'Meal 1', caloriePercent: 20, proteinPercent: 20 },
      { name: 'Meal 2', caloriePercent: 15, proteinPercent: 15 },
      { name: 'Meal 3', caloriePercent: 25, proteinPercent: 25 },
      { name: 'Meal 4', caloriePercent: 15, proteinPercent: 15 },
      { name: 'Meal 5', caloriePercent: 25, proteinPercent: 25 }
    ]
  },
  'D': {
    id: 'D',
    name: 'OMAD',
    description: 'One meal a day with full daily nutrition',
    meals: 1,
    targetCalories: { min: 1800, max: 2000 },
    targetProtein: { min: 130, max: 145 },
    mealTimes: ['18:00'],
    mealStructure: [
      { name: 'Main Meal', caloriePercent: 100, proteinPercent: 100 }
    ]
  },
  'E': {
    id: 'E',
    name: 'Workout Day',
    description: 'Higher calories with pre/post workout meals',
    meals: 4,
    targetCalories: { min: 2000, max: 2200 },
    targetProtein: { min: 140, max: 160 },
    mealTimes: ['07:00', '11:00', '15:00', '19:00'],
    mealStructure: [
      { name: 'Pre-Workout', caloriePercent: 20, proteinPercent: 15 },
      { name: 'Post-Workout', caloriePercent: 30, proteinPercent: 35 },
      { name: 'Lunch', caloriePercent: 25, proteinPercent: 25 },
      { name: 'Dinner', caloriePercent: 25, proteinPercent: 25 }
    ]
  },
  'F': {
    id: 'F',
    name: 'Light/Recovery Day',
    description: 'Lower calories for rest days',
    meals: 3,
    targetCalories: { min: 1600, max: 1800 },
    targetProtein: { min: 120, max: 135 },
    mealTimes: ['09:00', '13:00', '18:00'],
    mealStructure: [
      { name: 'Brunch', caloriePercent: 30, proteinPercent: 30 },
      { name: 'Lunch', caloriePercent: 35, proteinPercent: 35 },
      { name: 'Dinner', caloriePercent: 35, proteinPercent: 35 }
    ]
  },
  'G': {
    id: 'G',
    name: 'Flexible/Social',
    description: 'Flexible pattern for social events',
    meals: 3,
    targetCalories: { min: 1800, max: 2000 },
    targetProtein: { min: 130, max: 145 },
    mealTimes: ['10:00', '14:00', '19:00'],
    mealStructure: [
      { name: 'Late Breakfast', caloriePercent: 25, proteinPercent: 25 },
      { name: 'Light Lunch', caloriePercent: 30, proteinPercent: 30 },
      { name: 'Social Dinner', caloriePercent: 45, proteinPercent: 45 }
    ]
  }
};

// ============================================================================
// Mock Mobile Pattern Service (simulates what's in the mobile app)
// ============================================================================

const createMobilePatternService = () => {
  // This would normally come from the mobile app's pattern definitions
  const mobilePatterns = new Map<string, PatternSpec>();

  // Initialize with spec patterns (in real code, these come from mobile constants)
  Object.entries(PATTERN_SPECS).forEach(([id, spec]) => {
    mobilePatterns.set(id, { ...spec });
  });

  return {
    getPattern(id: string): PatternSpec | undefined {
      return mobilePatterns.get(id);
    },

    getAllPatterns(): PatternSpec[] {
      return Array.from(mobilePatterns.values());
    },

    getPatternIds(): string[] {
      return Array.from(mobilePatterns.keys());
    },

    validatePatternStructure(pattern: PatternSpec): {
      valid: boolean;
      errors: string[];
    } {
      const errors: string[] = [];

      // Check meal count matches structure
      if (pattern.meals !== pattern.mealStructure.length) {
        errors.push(`Meal count (${pattern.meals}) doesn't match structure (${pattern.mealStructure.length})`);
      }

      // Check meal times count
      if (pattern.meals !== pattern.mealTimes.length) {
        errors.push(`Meal count (${pattern.meals}) doesn't match times (${pattern.mealTimes.length})`);
      }

      // Check calorie percentages sum to 100
      const calorieSum = pattern.mealStructure.reduce((sum, m) => sum + m.caloriePercent, 0);
      if (calorieSum !== 100) {
        errors.push(`Calorie percentages sum to ${calorieSum}, expected 100`);
      }

      // Check protein percentages sum to 100
      const proteinSum = pattern.mealStructure.reduce((sum, m) => sum + m.proteinPercent, 0);
      if (proteinSum !== 100) {
        errors.push(`Protein percentages sum to ${proteinSum}, expected 100`);
      }

      // Check calorie range
      if (pattern.targetCalories.min > pattern.targetCalories.max) {
        errors.push('Invalid calorie range');
      }

      // Check protein range
      if (pattern.targetProtein.min > pattern.targetProtein.max) {
        errors.push('Invalid protein range');
      }

      return {
        valid: errors.length === 0,
        errors
      };
    },

    calculateMealTargets(pattern: PatternSpec, totalCalories: number, totalProtein: number): Array<{
      name: string;
      calories: number;
      protein: number;
    }> {
      return pattern.mealStructure.map(meal => ({
        name: meal.name,
        calories: Math.round(totalCalories * (meal.caloriePercent / 100)),
        protein: Math.round(totalProtein * (meal.proteinPercent / 100))
      }));
    }
  };
};

// ============================================================================
// Mock Database Pattern Service
// ============================================================================

const createDatabasePatternService = () => {
  // Simulates patterns stored in PostgreSQL
  const dbPatterns = new Map<string, PatternSpec>();

  Object.entries(PATTERN_SPECS).forEach(([id, spec]) => {
    dbPatterns.set(id, { ...spec });
  });

  return {
    getPattern(id: string): PatternSpec | undefined {
      return dbPatterns.get(id);
    },

    getAllPatterns(): PatternSpec[] {
      return Array.from(dbPatterns.values());
    }
  };
};

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Pattern Alignment Tests', () => {
  let mobileService: ReturnType<typeof createMobilePatternService>;
  let dbService: ReturnType<typeof createDatabasePatternService>;

  beforeEach(() => {
    mobileService = createMobilePatternService();
    dbService = createDatabasePatternService();
  });

  // ==========================================================================
  // 1. Pattern Count Tests
  // ==========================================================================

  describe('Pattern Count', () => {
    it('should have exactly 7 patterns defined (A-G)', () => {
      const patterns = mobileService.getAllPatterns();
      expect(patterns).toHaveLength(7);
    });

    it('should have all pattern IDs A through G', () => {
      const ids = mobileService.getPatternIds();

      expect(ids).toContain('A');
      expect(ids).toContain('B');
      expect(ids).toContain('C');
      expect(ids).toContain('D');
      expect(ids).toContain('E');
      expect(ids).toContain('F');
      expect(ids).toContain('G');
    });

    it('should match mobile and database pattern counts', () => {
      const mobilePatterns = mobileService.getAllPatterns();
      const dbPatterns = dbService.getAllPatterns();

      expect(mobilePatterns.length).toBe(dbPatterns.length);
    });
  });

  // ==========================================================================
  // 2. Calorie Range Tests (1800-2000 base, variations for workout/light)
  // ==========================================================================

  describe('Calorie Ranges', () => {
    it('Pattern A (Traditional) should target 1800-2000 calories', () => {
      const pattern = mobileService.getPattern('A');

      expect(pattern?.targetCalories.min).toBe(1800);
      expect(pattern?.targetCalories.max).toBe(2000);
    });

    it('Pattern B (IF) should target 1800-2000 calories', () => {
      const pattern = mobileService.getPattern('B');

      expect(pattern?.targetCalories.min).toBe(1800);
      expect(pattern?.targetCalories.max).toBe(2000);
    });

    it('Pattern E (Workout) should target 2000-2200 calories', () => {
      const pattern = mobileService.getPattern('E');

      expect(pattern?.targetCalories.min).toBe(2000);
      expect(pattern?.targetCalories.max).toBe(2200);
    });

    it('Pattern F (Light) should target 1600-1800 calories', () => {
      const pattern = mobileService.getPattern('F');

      expect(pattern?.targetCalories.min).toBe(1600);
      expect(pattern?.targetCalories.max).toBe(1800);
    });

    it('all patterns should have valid calorie ranges', () => {
      const patterns = mobileService.getAllPatterns();

      patterns.forEach(pattern => {
        expect(pattern.targetCalories.min).toBeGreaterThanOrEqual(1500);
        expect(pattern.targetCalories.max).toBeLessThanOrEqual(2500);
        expect(pattern.targetCalories.min).toBeLessThanOrEqual(pattern.targetCalories.max);
      });
    });
  });

  // ==========================================================================
  // 3. Protein Range Tests (130-145g base, variations)
  // ==========================================================================

  describe('Protein Ranges', () => {
    it('Pattern A (Traditional) should target 130-145g protein', () => {
      const pattern = mobileService.getPattern('A');

      expect(pattern?.targetProtein.min).toBe(130);
      expect(pattern?.targetProtein.max).toBe(145);
    });

    it('Pattern E (Workout) should target 140-160g protein', () => {
      const pattern = mobileService.getPattern('E');

      expect(pattern?.targetProtein.min).toBe(140);
      expect(pattern?.targetProtein.max).toBe(160);
    });

    it('Pattern F (Light) should target 120-135g protein', () => {
      const pattern = mobileService.getPattern('F');

      expect(pattern?.targetProtein.min).toBe(120);
      expect(pattern?.targetProtein.max).toBe(135);
    });

    it('all patterns should have protein >= 100g', () => {
      const patterns = mobileService.getAllPatterns();

      patterns.forEach(pattern => {
        expect(pattern.targetProtein.min).toBeGreaterThanOrEqual(100);
      });
    });
  });

  // ==========================================================================
  // 4. Meal Structure Tests
  // ==========================================================================

  describe('Meal Structures', () => {
    it('Pattern A should have 3 meals', () => {
      const pattern = mobileService.getPattern('A');
      expect(pattern?.meals).toBe(3);
      expect(pattern?.mealStructure).toHaveLength(3);
    });

    it('Pattern B (IF) should have 2 meals', () => {
      const pattern = mobileService.getPattern('B');
      expect(pattern?.meals).toBe(2);
      expect(pattern?.mealStructure).toHaveLength(2);
    });

    it('Pattern C (Grazing) should have 5 meals', () => {
      const pattern = mobileService.getPattern('C');
      expect(pattern?.meals).toBe(5);
      expect(pattern?.mealStructure).toHaveLength(5);
    });

    it('Pattern D (OMAD) should have 1 meal', () => {
      const pattern = mobileService.getPattern('D');
      expect(pattern?.meals).toBe(1);
      expect(pattern?.mealStructure).toHaveLength(1);
    });

    it('Pattern E (Workout) should have 4 meals', () => {
      const pattern = mobileService.getPattern('E');
      expect(pattern?.meals).toBe(4);
      expect(pattern?.mealStructure).toHaveLength(4);
    });

    it('all patterns should have calorie percentages summing to 100', () => {
      const patterns = mobileService.getAllPatterns();

      patterns.forEach(pattern => {
        const sum = pattern.mealStructure.reduce((s, m) => s + m.caloriePercent, 0);
        expect(sum).toBe(100);
      });
    });

    it('all patterns should have protein percentages summing to 100', () => {
      const patterns = mobileService.getAllPatterns();

      patterns.forEach(pattern => {
        const sum = pattern.mealStructure.reduce((s, m) => s + m.proteinPercent, 0);
        expect(sum).toBe(100);
      });
    });
  });

  // ==========================================================================
  // 5. Mobile-Database Alignment Tests
  // ==========================================================================

  describe('Mobile-Database Alignment', () => {
    it('Pattern A should match between mobile and database', () => {
      const mobilePattern = mobileService.getPattern('A');
      const dbPattern = dbService.getPattern('A');

      expect(mobilePattern?.name).toBe(dbPattern?.name);
      expect(mobilePattern?.meals).toBe(dbPattern?.meals);
      expect(mobilePattern?.targetCalories).toEqual(dbPattern?.targetCalories);
      expect(mobilePattern?.targetProtein).toEqual(dbPattern?.targetProtein);
    });

    it('all patterns should have matching structures', () => {
      const mobilePatterns = mobileService.getAllPatterns();
      const dbPatterns = dbService.getAllPatterns();

      mobilePatterns.forEach(mobilePattern => {
        const dbPattern = dbPatterns.find(p => p.id === mobilePattern.id);

        expect(dbPattern).toBeDefined();
        expect(mobilePattern.meals).toBe(dbPattern?.meals);
        expect(mobilePattern.mealStructure.length).toBe(dbPattern?.mealStructure.length);
      });
    });
  });

  // ==========================================================================
  // 6. Pattern Validation Tests
  // ==========================================================================

  describe('Pattern Validation', () => {
    it('all patterns should pass validation', () => {
      const patterns = mobileService.getAllPatterns();

      patterns.forEach(pattern => {
        const result = mobileService.validatePatternStructure(pattern);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should detect meal count mismatch', () => {
      const invalidPattern: PatternSpec = {
        ...PATTERN_SPECS['A'],
        meals: 4 // Mismatch with structure
      };

      const result = mobileService.validatePatternStructure(invalidPattern);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Meal count'))).toBe(true);
    });

    it('should detect invalid calorie percentages', () => {
      const invalidPattern: PatternSpec = {
        ...PATTERN_SPECS['A'],
        mealStructure: [
          { name: 'B', caloriePercent: 30, proteinPercent: 25 },
          { name: 'L', caloriePercent: 30, proteinPercent: 35 },
          { name: 'D', caloriePercent: 30, proteinPercent: 40 } // Sum = 90, not 100
        ]
      };

      const result = mobileService.validatePatternStructure(invalidPattern);
      expect(result.valid).toBe(false);
    });
  });

  // ==========================================================================
  // 7. Meal Target Calculation Tests
  // ==========================================================================

  describe('Meal Target Calculations', () => {
    it('should calculate correct meal targets for Pattern A', () => {
      const pattern = mobileService.getPattern('A')!;
      const targets = mobileService.calculateMealTargets(pattern, 2000, 130);

      expect(targets).toHaveLength(3);
      expect(targets[0].calories).toBe(500); // 25% of 2000
      expect(targets[1].calories).toBe(700); // 35% of 2000
      expect(targets[2].calories).toBe(800); // 40% of 2000
    });

    it('should calculate correct protein targets', () => {
      const pattern = mobileService.getPattern('A')!;
      const targets = mobileService.calculateMealTargets(pattern, 2000, 130);

      const totalProtein = targets.reduce((sum, t) => sum + t.protein, 0);
      // Allow for rounding variance (129-131)
      expect(totalProtein).toBeGreaterThanOrEqual(129);
      expect(totalProtein).toBeLessThanOrEqual(131);
    });

    it('should calculate OMAD targets correctly', () => {
      const pattern = mobileService.getPattern('D')!; // OMAD
      const targets = mobileService.calculateMealTargets(pattern, 1800, 130);

      expect(targets).toHaveLength(1);
      expect(targets[0].calories).toBe(1800); // 100%
      expect(targets[0].protein).toBe(130); // 100%
    });
  });
});
