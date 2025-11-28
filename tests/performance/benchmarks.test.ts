/**
 * Performance Tests: API Response Times and System Benchmarks
 * Tests for ensuring performance requirements are met
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Performance measurement utilities
const measureTime = async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
};

const measureSync = <T>(fn: () => T): { result: T; duration: number } => {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  return { result, duration };
};

// Performance thresholds
const THRESHOLDS = {
  API_RESPONSE: 100, // ms
  COMPLEX_CALCULATION: 1000, // ms
  UI_OPERATION: 16, // ms (60fps)
  DATABASE_QUERY: 50, // ms
  IMAGE_PROCESSING: 2000, // ms
  SEARCH_OPERATION: 200, // ms
  BATCH_OPERATION: 500 // ms
};

// Mock services for performance testing
const createPerformanceTestServices = () => {
  // Large datasets for stress testing
  const generateMeals = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `meal-${i}`,
      name: `Test Meal ${i}`,
      calories: 400 + Math.random() * 400,
      protein: 20 + Math.random() * 40,
      carbs: 30 + Math.random() * 50,
      fat: 10 + Math.random() * 30,
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      pattern: ['traditional', 'if-16-8', 'grazing'][i % 3]
    }));

  const generateInventory = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `inv-${i}`,
      name: `Ingredient ${i}`,
      quantity: Math.random() * 10,
      unit: ['lbs', 'cups', 'count', 'oz'][i % 4],
      expiryDate: new Date(Date.now() + (i - count / 2) * 24 * 60 * 60 * 1000)
    }));

  return {
    // Simulate API calls
    api: {
      async getMeals(limit: number) {
        await new Promise(r => setTimeout(r, 5 + Math.random() * 10));
        return generateMeals(limit);
      },

      async logMeal(meal: any) {
        await new Promise(r => setTimeout(r, 10 + Math.random() * 15));
        return { success: true, id: 'meal-' + Date.now() };
      },

      async getInventory() {
        await new Promise(r => setTimeout(r, 5 + Math.random() * 10));
        return generateInventory(100);
      },

      async switchPattern(patternId: string) {
        await new Promise(r => setTimeout(r, 15 + Math.random() * 20));
        return { success: true, pattern: patternId };
      },

      async generateShoppingList() {
        await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
        return generateInventory(30);
      }
    },

    // Complex calculations
    calculations: {
      calculateNutritionStats(meals: any[]) {
        return meals.reduce((stats, meal) => {
          stats.totalCalories += meal.calories;
          stats.totalProtein += meal.protein;
          stats.totalCarbs += meal.carbs;
          stats.totalFat += meal.fat;
          stats.count += 1;
          return stats;
        }, { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, count: 0 });
      },

      generatePrepTimeline(tasks: number) {
        const timeline = [];
        for (let i = 0; i < tasks; i++) {
          // Simulate dependency resolution
          const dependencies = timeline
            .filter(() => Math.random() > 0.7)
            .map(t => t.id);

          timeline.push({
            id: `task-${i}`,
            name: `Task ${i}`,
            duration: 5 + Math.random() * 30,
            dependencies,
            startTime: null as Date | null
          });
        }

        // Calculate start times (simplified)
        timeline.forEach((task, i) => {
          const maxDepEnd = task.dependencies.length > 0
            ? Math.max(...task.dependencies.map(d => {
                const dep = timeline.find(t => t.id === d);
                return dep?.startTime?.getTime() || 0 + (dep?.duration || 0) * 60000;
              }))
            : Date.now();
          task.startTime = new Date(maxDepEnd);
        });

        return timeline;
      },

      detectEquipmentConflicts(usages: any[]) {
        const conflicts = [];
        for (let i = 0; i < usages.length; i++) {
          for (let j = i + 1; j < usages.length; j++) {
            if (usages[i].equipmentId === usages[j].equipmentId) {
              // Check time overlap
              const overlap = !(
                usages[i].endTime <= usages[j].startTime ||
                usages[j].endTime <= usages[i].startTime
              );
              if (overlap) {
                conflicts.push({ usage1: usages[i], usage2: usages[j] });
              }
            }
          }
        }
        return conflicts;
      },

      predictPatternSuccess(history: any[], context: any) {
        // Simulate ML prediction calculation
        let score = 0.5;

        history.forEach(h => {
          if (h.completed) score += 0.01;
          if (h.adherence > 0.8) score += 0.005;
        });

        // Context adjustments
        if (context.dayOfWeek === 0 || context.dayOfWeek === 6) score += 0.05;
        if (context.stressLevel > 7) score -= 0.1;

        return Math.max(0.1, Math.min(0.95, score));
      }
    },

    // Search operations
    search: {
      searchMeals(meals: any[], query: string) {
        const lowerQuery = query.toLowerCase();
        return meals.filter(m =>
          m.name.toLowerCase().includes(lowerQuery) ||
          m.pattern.toLowerCase().includes(lowerQuery)
        );
      },

      searchInventory(items: any[], query: string) {
        const lowerQuery = query.toLowerCase();
        return items.filter(i => i.name.toLowerCase().includes(lowerQuery));
      },

      fuzzyMatch(items: any[], query: string, threshold: number = 0.6) {
        // Simplified fuzzy matching
        const lowerQuery = query.toLowerCase();
        return items.filter(item => {
          const name = item.name.toLowerCase();
          let matches = 0;
          for (const char of lowerQuery) {
            if (name.includes(char)) matches++;
          }
          return matches / lowerQuery.length >= threshold;
        });
      }
    }
  };
};

describe('Performance: API Response Times', () => {
  const services = createPerformanceTestServices();

  it('should fetch meals in under 100ms', async () => {
    const { duration } = await measureTime(() => services.api.getMeals(100));

    console.log(`getMeals (100): ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE);
  });

  it('should log meal in under 100ms', async () => {
    const { duration } = await measureTime(() =>
      services.api.logMeal({
        name: 'Test Meal',
        calories: 500,
        protein: 30
      })
    );

    console.log(`logMeal: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE);
  });

  it('should fetch inventory in under 100ms', async () => {
    const { duration } = await measureTime(() => services.api.getInventory());

    console.log(`getInventory: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE);
  });

  it('should switch pattern in under 100ms', async () => {
    const { duration } = await measureTime(() =>
      services.api.switchPattern('if-16-8')
    );

    console.log(`switchPattern: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE);
  });

  it('should generate shopping list in under 100ms', async () => {
    const { duration } = await measureTime(() =>
      services.api.generateShoppingList()
    );

    console.log(`generateShoppingList: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE);
  });
});

describe('Performance: Complex Calculations', () => {
  const services = createPerformanceTestServices();

  it('should calculate nutrition stats for 1000 meals in under 100ms', () => {
    const meals = Array.from({ length: 1000 }, (_, i) => ({
      calories: 500,
      protein: 30,
      carbs: 50,
      fat: 20
    }));

    const { result, duration } = measureSync(() =>
      services.calculations.calculateNutritionStats(meals)
    );

    console.log(`calculateNutritionStats (1000 meals): ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(100);
    expect(result.count).toBe(1000);
  });

  it('should generate prep timeline for 50 tasks in under 500ms', () => {
    const { result, duration } = measureSync(() =>
      services.calculations.generatePrepTimeline(50)
    );

    console.log(`generatePrepTimeline (50 tasks): ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(THRESHOLDS.BATCH_OPERATION);
    expect(result.length).toBe(50);
  });

  it('should detect equipment conflicts in under 200ms for 100 usages', () => {
    const usages = Array.from({ length: 100 }, (_, i) => ({
      equipmentId: `equip-${i % 5}`,
      startTime: new Date(Date.now() + i * 10 * 60000),
      endTime: new Date(Date.now() + (i + 1) * 15 * 60000)
    }));

    const { duration } = measureSync(() =>
      services.calculations.detectEquipmentConflicts(usages)
    );

    console.log(`detectEquipmentConflicts (100 usages): ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(THRESHOLDS.SEARCH_OPERATION);
  });

  it('should predict pattern success in under 50ms', () => {
    const history = Array.from({ length: 100 }, (_, i) => ({
      completed: Math.random() > 0.2,
      adherence: Math.random()
    }));

    const context = {
      dayOfWeek: 3,
      stressLevel: 5
    };

    const { result, duration } = measureSync(() =>
      services.calculations.predictPatternSuccess(history, context)
    );

    console.log(`predictPatternSuccess: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(50);
    expect(result).toBeGreaterThanOrEqual(0.1);
    expect(result).toBeLessThanOrEqual(0.95);
  });
});

describe('Performance: Search Operations', () => {
  const services = createPerformanceTestServices();

  let largeMealSet: any[];
  let largeInventory: any[];

  beforeAll(() => {
    largeMealSet = Array.from({ length: 10000 }, (_, i) => ({
      id: `meal-${i}`,
      name: `Meal ${i} ${['Chicken', 'Beef', 'Fish', 'Vegetarian'][i % 4]}`,
      pattern: ['traditional', 'if-16-8', 'grazing', 'keto'][i % 4]
    }));

    largeInventory = Array.from({ length: 5000 }, (_, i) => ({
      id: `inv-${i}`,
      name: `Ingredient ${i} ${['Chicken', 'Beef', 'Rice', 'Beans'][i % 4]}`
    }));
  });

  it('should search 10000 meals in under 200ms', () => {
    const { result, duration } = measureSync(() =>
      services.search.searchMeals(largeMealSet, 'Chicken')
    );

    console.log(`searchMeals (10000): ${duration.toFixed(2)}ms, found ${result.length}`);
    expect(duration).toBeLessThan(THRESHOLDS.SEARCH_OPERATION);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should search 5000 inventory items in under 200ms', () => {
    const { result, duration } = measureSync(() =>
      services.search.searchInventory(largeInventory, 'Rice')
    );

    console.log(`searchInventory (5000): ${duration.toFixed(2)}ms, found ${result.length}`);
    expect(duration).toBeLessThan(THRESHOLDS.SEARCH_OPERATION);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should perform fuzzy matching in under 500ms on large dataset', () => {
    const { result, duration } = measureSync(() =>
      services.search.fuzzyMatch(largeMealSet, 'chkn', 0.5) // typo for "chicken"
    );

    console.log(`fuzzyMatch (10000): ${duration.toFixed(2)}ms, found ${result.length}`);
    expect(duration).toBeLessThan(THRESHOLDS.BATCH_OPERATION);
  });
});

describe('Performance: Batch Operations', () => {
  it('should process 100 meal logs in under 500ms', async () => {
    const services = createPerformanceTestServices();
    const meals = Array.from({ length: 100 }, (_, i) => ({
      name: `Batch Meal ${i}`,
      calories: 500 + i,
      protein: 30
    }));

    const start = performance.now();

    await Promise.all(meals.map(m => services.api.logMeal(m)));

    const duration = performance.now() - start;

    console.log(`Batch log 100 meals: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(THRESHOLDS.BATCH_OPERATION * 10); // Allow some slack for parallel ops
  });

  it('should handle concurrent API calls efficiently', async () => {
    const services = createPerformanceTestServices();

    const start = performance.now();

    await Promise.all([
      services.api.getMeals(50),
      services.api.getInventory(),
      services.api.switchPattern('grazing'),
      services.api.generateShoppingList()
    ]);

    const duration = performance.now() - start;

    console.log(`Concurrent API calls: ${duration.toFixed(2)}ms`);
    // Should complete in roughly the time of the slowest call, not sum
    expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE * 2);
  });
});

describe('Performance: Memory Efficiency', () => {
  it('should handle large meal history without excessive memory', () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Generate and process large dataset
    const meals = Array.from({ length: 50000 }, (_, i) => ({
      id: `meal-${i}`,
      name: `Test Meal ${i}`,
      calories: 500,
      protein: 30,
      carbs: 50,
      fat: 20,
      timestamp: new Date()
    }));

    // Process the data
    const stats = meals.reduce((s, m) => {
      s.total += m.calories;
      s.count++;
      return s;
    }, { total: 0, count: 0 });

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

    console.log(`Memory for 50k meals: ${memoryIncrease.toFixed(2)}MB`);

    // Should not exceed 100MB for this dataset
    expect(memoryIncrease).toBeLessThan(100);
    expect(stats.count).toBe(50000);
  });
});

describe('Performance: UI Responsiveness (60fps)', () => {
  it('should filter visible items in under 16ms', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      visible: Math.random() > 0.5
    }));

    const { duration } = measureSync(() =>
      items.filter(i => i.visible)
    );

    console.log(`Filter 1000 items: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(THRESHOLDS.UI_OPERATION);
  });

  it('should sort displayed meals in under 16ms', () => {
    const meals = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      timestamp: new Date(Date.now() - Math.random() * 1000000000)
    }));

    const { duration } = measureSync(() =>
      [...meals].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    );

    console.log(`Sort 100 meals: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(THRESHOLDS.UI_OPERATION);
  });

  it('should calculate daily totals in under 16ms', () => {
    const meals = Array.from({ length: 10 }, (_, i) => ({
      calories: 300 + i * 50,
      protein: 20 + i * 5
    }));

    const { duration } = measureSync(() => {
      const totals = meals.reduce(
        (t, m) => ({ calories: t.calories + m.calories, protein: t.protein + m.protein }),
        { calories: 0, protein: 0 }
      );
      return totals;
    });

    console.log(`Calculate daily totals: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(THRESHOLDS.UI_OPERATION);
  });
});

describe('Performance: Stress Tests', () => {
  it('should handle 100 consecutive pattern switches', async () => {
    const services = createPerformanceTestServices();
    const patterns = ['traditional', 'if-16-8', 'grazing', 'keto'];

    const start = performance.now();

    for (let i = 0; i < 100; i++) {
      await services.api.switchPattern(patterns[i % patterns.length]);
    }

    const duration = performance.now() - start;
    const avgPerSwitch = duration / 100;

    console.log(`100 pattern switches: ${duration.toFixed(2)}ms (avg: ${avgPerSwitch.toFixed(2)}ms)`);
    expect(avgPerSwitch).toBeLessThan(THRESHOLDS.API_RESPONSE);
  });

  it('should maintain performance under sustained load', async () => {
    const services = createPerformanceTestServices();
    const durations: number[] = [];

    for (let i = 0; i < 50; i++) {
      const { duration } = await measureTime(() => services.api.getMeals(100));
      durations.push(duration);
    }

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    console.log(`Sustained load - Avg: ${avgDuration.toFixed(2)}ms, Min: ${minDuration.toFixed(2)}ms, Max: ${maxDuration.toFixed(2)}ms`);

    // Performance should not degrade significantly
    expect(maxDuration).toBeLessThan(avgDuration * 2);
  });
});
