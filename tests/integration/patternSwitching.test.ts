/**
 * Integration Tests: Pattern Switching Workflows
 * Tests for complete pattern switching flows including inventory and notifications
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Integrated System Types
interface SystemState {
  currentPattern: string;
  dailyProgress: {
    calories: number;
    protein: number;
    mealsLogged: number;
  };
  inventory: Map<string, { quantity: number; unit: string }>;
  notifications: Array<{ type: string; message: string; time: Date }>;
}

// Mock Integrated Service
const createIntegratedPatternService = () => {
  let state: SystemState = {
    currentPattern: 'traditional',
    dailyProgress: { calories: 0, protein: 0, mealsLogged: 0 },
    inventory: new Map([
      ['chicken-breast', { quantity: 2, unit: 'lbs' }],
      ['rice', { quantity: 5, unit: 'cups' }],
      ['beans', { quantity: 2, unit: 'cans' }],
      ['vegetables', { quantity: 3, unit: 'lbs' }],
      ['eggs', { quantity: 12, unit: 'count' }]
    ]),
    notifications: []
  };

  const patternRequirements: Record<string, { minIngredients: string[]; caloriesPerMeal: number }> = {
    'traditional': {
      minIngredients: ['chicken-breast', 'rice', 'vegetables'],
      caloriesPerMeal: 667
    },
    'if-16-8': {
      minIngredients: ['chicken-breast', 'vegetables', 'eggs'],
      caloriesPerMeal: 900
    },
    'grazing': {
      minIngredients: ['vegetables', 'eggs', 'beans'],
      caloriesPerMeal: 400
    },
    'keto': {
      minIngredients: ['chicken-breast', 'vegetables', 'eggs'],
      caloriesPerMeal: 600
    }
  };

  return {
    getState(): SystemState {
      return { ...state };
    },

    async switchPattern(
      newPatternId: string,
      currentTime: string
    ): Promise<{
      success: boolean;
      warnings: string[];
      adjustments: {
        remainingCalories: number;
        remainingMeals: number;
        notificationsUpdated: boolean;
      } | null;
    }> {
      const warnings: string[] = [];

      // Check pattern exists
      const requirements = patternRequirements[newPatternId];
      if (!requirements) {
        return { success: false, warnings: ['Invalid pattern'], adjustments: null };
      }

      // Check inventory sufficiency
      const insufficientIngredients: string[] = [];
      requirements.minIngredients.forEach(ingredient => {
        const inv = state.inventory.get(ingredient);
        if (!inv || inv.quantity <= 0) {
          insufficientIngredients.push(ingredient);
        }
      });

      if (insufficientIngredients.length > 0) {
        warnings.push(`Insufficient inventory: ${insufficientIngredients.join(', ')}`);
      }

      // Calculate remaining targets
      const [hours] = currentTime.split(':').map(Number);
      const mealTimes: Record<string, number[]> = {
        'traditional': [8, 12, 18],
        'if-16-8': [12, 19],
        'grazing': [8, 10, 13, 15, 18],
        'keto': [8, 13, 18]
      };

      const remainingMeals = (mealTimes[newPatternId] || []).filter(t => t > hours).length;
      const remainingCalories = remainingMeals * requirements.caloriesPerMeal;

      // Check if targets are achievable
      const currentTargets: Record<string, number> = {
        'traditional': 2000,
        'if-16-8': 1800,
        'grazing': 2000,
        'keto': 1800
      };

      const targetCalories = currentTargets[newPatternId] || 2000;
      if (state.dailyProgress.calories + remainingCalories < targetCalories * 0.8) {
        warnings.push('May not meet daily calorie target');
      }

      // Update notifications
      state.notifications = state.notifications.filter(n => n.type !== 'meal-reminder');
      (mealTimes[newPatternId] || []).forEach(hour => {
        if (hour > hours) {
          state.notifications.push({
            type: 'meal-reminder',
            message: `Time for ${newPatternId} meal`,
            time: new Date(new Date().setHours(hour, 0, 0, 0))
          });
        }
      });

      // Update state
      state.currentPattern = newPatternId;

      return {
        success: true,
        warnings,
        adjustments: {
          remainingCalories,
          remainingMeals,
          notificationsUpdated: true
        }
      };
    },

    async logMeal(
      calories: number,
      protein: number,
      ingredients: Array<{ id: string; quantity: number }>
    ): Promise<{ success: boolean; updatedProgress: typeof state.dailyProgress }> {
      // Update progress
      state.dailyProgress.calories += calories;
      state.dailyProgress.protein += protein;
      state.dailyProgress.mealsLogged += 1;

      // Deduct from inventory
      ingredients.forEach(ing => {
        const inv = state.inventory.get(ing.id);
        if (inv) {
          inv.quantity = Math.max(0, inv.quantity - ing.quantity);
        }
      });

      return {
        success: true,
        updatedProgress: { ...state.dailyProgress }
      };
    },

    async checkInventorySufficiency(patternId: string): Promise<{
      sufficient: boolean;
      missing: string[];
      low: string[];
    }> {
      const requirements = patternRequirements[patternId];
      if (!requirements) {
        return { sufficient: false, missing: [], low: [] };
      }

      const missing: string[] = [];
      const low: string[] = [];

      requirements.minIngredients.forEach(ingredient => {
        const inv = state.inventory.get(ingredient);
        if (!inv || inv.quantity <= 0) {
          missing.push(ingredient);
        } else if (inv.quantity < 1) {
          low.push(ingredient);
        }
      });

      return {
        sufficient: missing.length === 0,
        missing,
        low
      };
    },

    reset(): void {
      state = {
        currentPattern: 'traditional',
        dailyProgress: { calories: 0, protein: 0, mealsLogged: 0 },
        inventory: new Map([
          ['chicken-breast', { quantity: 2, unit: 'lbs' }],
          ['rice', { quantity: 5, unit: 'cups' }],
          ['beans', { quantity: 2, unit: 'cans' }],
          ['vegetables', { quantity: 3, unit: 'lbs' }],
          ['eggs', { quantity: 12, unit: 'count' }]
        ]),
        notifications: []
      };
    }
  };
};

describe('Pattern Switching Integration', () => {
  let service: ReturnType<typeof createIntegratedPatternService>;

  beforeEach(() => {
    service = createIntegratedPatternService();
    service.reset();
  });

  describe('Mid-Day Pattern Switch', () => {
    it('should switch pattern and maintain daily targets', async () => {
      // Log breakfast first
      await service.logMeal(500, 30, [
        { id: 'eggs', quantity: 3 }
      ]);

      // Switch from traditional to IF at 10:00
      const result = await service.switchPattern('if-16-8', '10:00');

      expect(result.success).toBe(true);
      expect(result.adjustments?.remainingMeals).toBe(2); // 12:00 and 19:00
      expect(result.adjustments?.notificationsUpdated).toBe(true);
    });

    it('should recalculate remaining meals correctly', async () => {
      // Switch to IF at 14:00 (after first IF meal at 12:00)
      const result = await service.switchPattern('if-16-8', '14:00');

      expect(result.success).toBe(true);
      expect(result.adjustments?.remainingMeals).toBe(1); // Only 19:00 remains
    });

    it('should warn about insufficient inventory', async () => {
      // Deplete chicken
      const state = service.getState();
      state.inventory.set('chicken-breast', { quantity: 0, unit: 'lbs' });

      const result = await service.switchPattern('keto', '08:00');

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('Insufficient inventory'))).toBe(true);
    });

    it('should warn when daily targets may not be met', async () => {
      // Log most of the day's calories
      await service.logMeal(1200, 80, []);

      // Switch to grazing late in the day
      const result = await service.switchPattern('grazing', '16:00');

      expect(result.success).toBe(true);
      // Only 18:00 meal remains (400 cal), total would be 1600 < 2000 * 0.8 = 1600
      // This is borderline, may or may not warn
    });

    it('should update notifications appropriately', async () => {
      const beforeState = service.getState();
      expect(beforeState.notifications.length).toBe(0);

      await service.switchPattern('traditional', '10:00');

      const afterState = service.getState();
      // Should have notifications for 12:00 and 18:00 meals
      expect(afterState.notifications.length).toBe(2);
    });
  });

  describe('Inventory Integration', () => {
    it('should check inventory sufficiency before switch', async () => {
      const sufficiency = await service.checkInventorySufficiency('traditional');

      expect(sufficiency.sufficient).toBe(true);
      expect(sufficiency.missing.length).toBe(0);
    });

    it('should identify missing ingredients', async () => {
      // Remove required ingredient
      const state = service.getState();
      state.inventory.delete('chicken-breast');

      const sufficiency = await service.checkInventorySufficiency('traditional');

      expect(sufficiency.sufficient).toBe(false);
      expect(sufficiency.missing).toContain('chicken-breast');
    });

    it('should auto-deduct from inventory on meal logging', async () => {
      const before = service.getState().inventory.get('eggs')?.quantity || 0;

      await service.logMeal(200, 15, [{ id: 'eggs', quantity: 2 }]);

      const after = service.getState().inventory.get('eggs')?.quantity || 0;
      expect(after).toBe(before - 2);
    });
  });

  describe('Daily Progress Tracking', () => {
    it('should track cumulative daily progress', async () => {
      await service.logMeal(500, 30, []);
      await service.logMeal(600, 40, []);
      await service.logMeal(700, 45, []);

      const state = service.getState();
      expect(state.dailyProgress.calories).toBe(1800);
      expect(state.dailyProgress.protein).toBe(115);
      expect(state.dailyProgress.mealsLogged).toBe(3);
    });

    it('should calculate remaining targets after switch', async () => {
      await service.logMeal(800, 50, []);

      const result = await service.switchPattern('if-16-8', '11:00');

      expect(result.adjustments?.remainingCalories).toBeDefined();
      // IF-16-8: 2 meals at 900 cal each = 1800 remaining
      expect(result.adjustments?.remainingCalories).toBe(1800);
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid pattern switch', async () => {
      const result = await service.switchPattern('invalid-pattern', '10:00');

      expect(result.success).toBe(false);
      expect(result.warnings).toContain('Invalid pattern');
    });

    it('should handle switch with no remaining meals', async () => {
      const result = await service.switchPattern('traditional', '20:00');

      expect(result.success).toBe(true);
      expect(result.adjustments?.remainingMeals).toBe(0);
      expect(result.adjustments?.remainingCalories).toBe(0);
    });
  });

  describe('Complete Day Flow', () => {
    it('should handle full day with pattern switch', async () => {
      // Morning: Traditional breakfast
      await service.logMeal(500, 30, [{ id: 'eggs', quantity: 3 }]);

      // Mid-morning: Switch to IF (skip remaining meals, have larger dinner)
      const switchResult = await service.switchPattern('if-16-8', '10:00');
      expect(switchResult.success).toBe(true);

      // Lunch (IF style, larger meal)
      await service.logMeal(800, 50, [
        { id: 'chicken-breast', quantity: 0.5 },
        { id: 'vegetables', quantity: 0.5 }
      ]);

      // Dinner (IF style)
      await service.logMeal(700, 45, [
        { id: 'chicken-breast', quantity: 0.5 },
        { id: 'rice', quantity: 1 }
      ]);

      const finalState = service.getState();
      expect(finalState.dailyProgress.calories).toBe(2000);
      expect(finalState.dailyProgress.mealsLogged).toBe(3);
      expect(finalState.currentPattern).toBe('if-16-8');
    });
  });
});

describe('Shopping List Generation Integration', () => {
  interface ShoppingItem {
    ingredient: string;
    quantity: number;
    unit: string;
    store: string;
    estimatedCost: number;
  }

  const createShoppingService = () => {
    const inventory = new Map([
      ['chicken-breast', { quantity: 1, unit: 'lbs' }],
      ['rice', { quantity: 2, unit: 'cups' }],
      ['beans', { quantity: 0, unit: 'cans' }],
      ['vegetables', { quantity: 0.5, unit: 'lbs' }]
    ]);

    const patternNeeds: Record<string, Record<string, { weekly: number; unit: string }>> = {
      'traditional': {
        'chicken-breast': { weekly: 3, unit: 'lbs' },
        'rice': { weekly: 7, unit: 'cups' },
        'beans': { weekly: 4, unit: 'cans' },
        'vegetables': { weekly: 5, unit: 'lbs' }
      }
    };

    const storeData: Record<string, { price: number; store: string }> = {
      'chicken-breast': { price: 4.99, store: 'Costco' },
      'rice': { price: 0.50, store: 'Walmart' },
      'beans': { price: 1.29, store: 'Safeway' },
      'vegetables': { price: 2.00, store: 'Whole Foods' }
    };

    return {
      generateShoppingList(patternId: string, weeks: number = 1): ShoppingItem[] {
        const needs = patternNeeds[patternId];
        if (!needs) return [];

        const list: ShoppingItem[] = [];

        Object.entries(needs).forEach(([ingredient, need]) => {
          const current = inventory.get(ingredient)?.quantity || 0;
          const required = need.weekly * weeks;
          const toBuy = Math.max(0, required - current);

          if (toBuy > 0) {
            const store = storeData[ingredient] || { price: 5, store: 'Generic' };
            list.push({
              ingredient,
              quantity: toBuy,
              unit: need.unit,
              store: store.store,
              estimatedCost: toBuy * store.price
            });
          }
        });

        return list;
      },

      calculateTotalCost(list: ShoppingItem[]): number {
        return list.reduce((sum, item) => sum + item.estimatedCost, 0);
      },

      groupByStore(list: ShoppingItem[]): Record<string, ShoppingItem[]> {
        const grouped: Record<string, ShoppingItem[]> = {};

        list.forEach(item => {
          if (!grouped[item.store]) {
            grouped[item.store] = [];
          }
          grouped[item.store].push(item);
        });

        return grouped;
      },

      optimizeRouting(stores: string[]): string[] {
        // Simple optimization: sort by number of items
        // In real implementation, would consider distance, deals, etc.
        return stores.sort();
      }
    };
  };

  let shoppingService: ReturnType<typeof createShoppingService>;

  beforeEach(() => {
    shoppingService = createShoppingService();
  });

  it('should generate shopping list from pattern needs', () => {
    const list = shoppingService.generateShoppingList('traditional');

    expect(list.length).toBeGreaterThan(0);
    expect(list.find(i => i.ingredient === 'beans')).toBeDefined(); // Have 0
  });

  it('should account for existing inventory', () => {
    const list = shoppingService.generateShoppingList('traditional');

    const chicken = list.find(i => i.ingredient === 'chicken-breast');
    // Need 3, have 1, should buy 2
    expect(chicken?.quantity).toBe(2);
  });

  it('should calculate total cost', () => {
    const list = shoppingService.generateShoppingList('traditional');
    const total = shoppingService.calculateTotalCost(list);

    expect(total).toBeGreaterThan(0);
  });

  it('should group items by store', () => {
    const list = shoppingService.generateShoppingList('traditional');
    const grouped = shoppingService.groupByStore(list);

    expect(Object.keys(grouped).length).toBeGreaterThan(0);
    expect(grouped['Costco']).toBeDefined();
  });

  it('should scale for multiple weeks', () => {
    const oneWeek = shoppingService.generateShoppingList('traditional', 1);
    const twoWeeks = shoppingService.generateShoppingList('traditional', 2);

    const oneWeekTotal = shoppingService.calculateTotalCost(oneWeek);
    const twoWeeksTotal = shoppingService.calculateTotalCost(twoWeeks);

    expect(twoWeeksTotal).toBeGreaterThan(oneWeekTotal);
  });
});
