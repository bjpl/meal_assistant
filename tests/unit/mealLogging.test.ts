/**
 * Unit Tests: Meal Logging
 * Tests for meal creation, logging, rating, and photo integration
 * Target: 90% coverage
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Types
interface Meal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  pattern: string;
  timestamp: Date;
  rating?: number;
  photo?: string;
  ingredients?: MealIngredient[];
  notes?: string;
}

interface MealIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  calories?: number;
  protein?: number;
}

interface MealHistory {
  meals: Meal[];
  dailyTotals: DailyTotal[];
}

interface DailyTotal {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealsLogged: number;
}

// Meal Logging Service
const createMealLoggingService = () => {
  const meals: Meal[] = [];
  const favorites: string[] = [];

  return {
    log(meal: Omit<Meal, 'id' | 'timestamp'>): Meal {
      const newMeal: Meal = {
        ...meal,
        id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      };
      meals.push(newMeal);
      return newMeal;
    },

    getMeal(id: string): Meal | undefined {
      return meals.find(m => m.id === id);
    },

    updateMeal(id: string, updates: Partial<Omit<Meal, 'id' | 'timestamp'>>): Meal | null {
      const index = meals.findIndex(m => m.id === id);
      if (index === -1) return null;

      meals[index] = { ...meals[index], ...updates };
      return meals[index];
    },

    deleteMeal(id: string): boolean {
      const index = meals.findIndex(m => m.id === id);
      if (index === -1) return false;
      meals.splice(index, 1);
      return true;
    },

    rate(id: string, rating: number): Meal | null {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      return this.updateMeal(id, { rating });
    },

    addPhoto(id: string, photoUrl: string): Meal | null {
      return this.updateMeal(id, { photo: photoUrl });
    },

    addNotes(id: string, notes: string): Meal | null {
      return this.updateMeal(id, { notes });
    },

    getHistory(days: number): Meal[] {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      return meals.filter(m => m.timestamp >= cutoff);
    },

    getTodayMeals(): Meal[] {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return meals.filter(m => m.timestamp >= today);
    },

    getDailyProgress(date: Date = new Date()): DailyTotal {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const dayMeals = meals.filter(m =>
        m.timestamp >= startOfDay && m.timestamp <= endOfDay
      );

      return {
        date: date.toISOString().split('T')[0],
        calories: dayMeals.reduce((sum, m) => sum + m.calories, 0),
        protein: dayMeals.reduce((sum, m) => sum + m.protein, 0),
        carbs: dayMeals.reduce((sum, m) => sum + m.carbs, 0),
        fat: dayMeals.reduce((sum, m) => sum + m.fat, 0),
        mealsLogged: dayMeals.length
      };
    },

    getWeeklySummary(): DailyTotal[] {
      const totals: DailyTotal[] = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        totals.push(this.getDailyProgress(date));
      }

      return totals;
    },

    calculateFromIngredients(ingredients: MealIngredient[]): {
      calories: number;
      protein: number;
    } {
      return ingredients.reduce((totals, ing) => ({
        calories: totals.calories + (ing.calories || 0),
        protein: totals.protein + (ing.protein || 0)
      }), { calories: 0, protein: 0 });
    },

    addToFavorites(mealId: string): boolean {
      if (favorites.includes(mealId)) return false;
      if (!meals.find(m => m.id === mealId)) return false;
      favorites.push(mealId);
      return true;
    },

    removeFromFavorites(mealId: string): boolean {
      const index = favorites.indexOf(mealId);
      if (index === -1) return false;
      favorites.splice(index, 1);
      return true;
    },

    getFavorites(): Meal[] {
      return meals.filter(m => favorites.includes(m.id));
    },

    duplicateMeal(id: string): Meal | null {
      const original = meals.find(m => m.id === id);
      if (!original) return null;

      return this.log({
        name: original.name,
        calories: original.calories,
        protein: original.protein,
        carbs: original.carbs,
        fat: original.fat,
        fiber: original.fiber,
        pattern: original.pattern,
        ingredients: original.ingredients,
        notes: original.notes ? `Copied from ${original.name}` : undefined
      });
    },

    search(query: string): Meal[] {
      const lowerQuery = query.toLowerCase();
      return meals.filter(m =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.pattern.toLowerCase().includes(lowerQuery) ||
        m.notes?.toLowerCase().includes(lowerQuery)
      );
    },

    getByPattern(patternId: string): Meal[] {
      return meals.filter(m => m.pattern === patternId);
    },

    getAverageRating(): number {
      const ratedMeals = meals.filter(m => m.rating !== undefined);
      if (ratedMeals.length === 0) return 0;
      return ratedMeals.reduce((sum, m) => sum + (m.rating || 0), 0) / ratedMeals.length;
    },

    getTopRatedMeals(limit: number = 5): Meal[] {
      return [...meals]
        .filter(m => m.rating !== undefined)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, limit);
    },

    getMealsByCalorieRange(min: number, max: number): Meal[] {
      return meals.filter(m => m.calories >= min && m.calories <= max);
    },

    getHighProteinMeals(minProtein: number): Meal[] {
      return meals.filter(m => m.protein >= minProtein);
    },

    clearHistory(): void {
      meals.length = 0;
      favorites.length = 0;
    }
  };
};

describe('Meal Logging', () => {
  let service: ReturnType<typeof createMealLoggingService>;

  beforeEach(() => {
    service = createMealLoggingService();
  });

  describe('Basic Meal Operations', () => {
    it('should log a new meal', () => {
      const meal = service.log({
        name: 'Mexican Bowl',
        calories: 650,
        protein: 45,
        carbs: 65,
        fat: 22,
        pattern: 'traditional'
      });

      expect(meal).toHaveProperty('id');
      expect(meal).toHaveProperty('timestamp');
      expect(meal.name).toBe('Mexican Bowl');
    });

    it('should get meal by ID', () => {
      const logged = service.log({
        name: 'Test Meal',
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 15,
        pattern: 'traditional'
      });

      const retrieved = service.getMeal(logged.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Meal');
    });

    it('should return undefined for non-existent meal', () => {
      const meal = service.getMeal('non-existent-id');

      expect(meal).toBeUndefined();
    });

    it('should update meal properties', () => {
      const meal = service.log({
        name: 'Original',
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 15,
        pattern: 'traditional'
      });

      const updated = service.updateMeal(meal.id, { name: 'Updated', calories: 600 });

      expect(updated?.name).toBe('Updated');
      expect(updated?.calories).toBe(600);
    });

    it('should delete meal', () => {
      const meal = service.log({
        name: 'To Delete',
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 15,
        pattern: 'traditional'
      });

      const deleted = service.deleteMeal(meal.id);

      expect(deleted).toBe(true);
      expect(service.getMeal(meal.id)).toBeUndefined();
    });

    it('should return false when deleting non-existent meal', () => {
      const deleted = service.deleteMeal('non-existent');

      expect(deleted).toBe(false);
    });
  });

  describe('Meal Rating', () => {
    it('should rate a meal', () => {
      const meal = service.log({
        name: 'Good Meal',
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 15,
        pattern: 'traditional'
      });

      const rated = service.rate(meal.id, 5);

      expect(rated?.rating).toBe(5);
    });

    it('should reject invalid ratings', () => {
      const meal = service.log({
        name: 'Meal',
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 15,
        pattern: 'traditional'
      });

      expect(() => service.rate(meal.id, 0)).toThrow();
      expect(() => service.rate(meal.id, 6)).toThrow();
    });

    it('should get average rating', () => {
      const meal1 = service.log({ name: 'Meal 1', calories: 500, protein: 30, carbs: 50, fat: 15, pattern: 'traditional' });
      const meal2 = service.log({ name: 'Meal 2', calories: 600, protein: 40, carbs: 60, fat: 20, pattern: 'traditional' });

      service.rate(meal1.id, 4);
      service.rate(meal2.id, 5);

      expect(service.getAverageRating()).toBe(4.5);
    });

    it('should return 0 for no rated meals', () => {
      expect(service.getAverageRating()).toBe(0);
    });

    it('should get top rated meals', () => {
      const meal1 = service.log({ name: 'Meal 1', calories: 500, protein: 30, carbs: 50, fat: 15, pattern: 'traditional' });
      const meal2 = service.log({ name: 'Meal 2', calories: 600, protein: 40, carbs: 60, fat: 20, pattern: 'traditional' });
      const meal3 = service.log({ name: 'Meal 3', calories: 700, protein: 50, carbs: 70, fat: 25, pattern: 'traditional' });

      service.rate(meal1.id, 3);
      service.rate(meal2.id, 5);
      service.rate(meal3.id, 4);

      const topRated = service.getTopRatedMeals(2);

      expect(topRated).toHaveLength(2);
      expect(topRated[0].rating).toBe(5);
    });
  });

  describe('Photo and Notes', () => {
    it('should add photo to meal', () => {
      const meal = service.log({
        name: 'Photo Meal',
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 15,
        pattern: 'traditional'
      });

      const updated = service.addPhoto(meal.id, 'https://example.com/photo.jpg');

      expect(updated?.photo).toBe('https://example.com/photo.jpg');
    });

    it('should add notes to meal', () => {
      const meal = service.log({
        name: 'Notes Meal',
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 15,
        pattern: 'traditional'
      });

      const updated = service.addNotes(meal.id, 'Great meal, will make again');

      expect(updated?.notes).toBe('Great meal, will make again');
    });
  });

  describe('History and Progress', () => {
    it('should get meal history for specified days', () => {
      // Log meals
      service.log({ name: 'Today', calories: 500, protein: 30, carbs: 50, fat: 15, pattern: 'traditional' });
      service.log({ name: 'Today 2', calories: 600, protein: 40, carbs: 60, fat: 20, pattern: 'traditional' });

      const history = service.getHistory(1);

      expect(history.length).toBe(2);
    });

    it('should get today meals', () => {
      service.log({ name: 'Today Meal', calories: 500, protein: 30, carbs: 50, fat: 15, pattern: 'traditional' });

      const today = service.getTodayMeals();

      expect(today.length).toBe(1);
    });

    it('should calculate daily progress', () => {
      service.log({ name: 'Meal 1', calories: 500, protein: 30, carbs: 50, fat: 15, pattern: 'traditional' });
      service.log({ name: 'Meal 2', calories: 600, protein: 40, carbs: 60, fat: 20, pattern: 'traditional' });
      service.log({ name: 'Meal 3', calories: 700, protein: 50, carbs: 70, fat: 25, pattern: 'traditional' });

      const progress = service.getDailyProgress();

      expect(progress.calories).toBe(1800);
      expect(progress.protein).toBe(120);
      expect(progress.mealsLogged).toBe(3);
    });

    it('should get weekly summary', () => {
      service.log({ name: 'Meal', calories: 500, protein: 30, carbs: 50, fat: 15, pattern: 'traditional' });

      const summary = service.getWeeklySummary();

      expect(summary).toHaveLength(7);
      expect(summary[6].mealsLogged).toBeGreaterThanOrEqual(1); // Today
    });
  });

  describe('Favorites', () => {
    it('should add meal to favorites', () => {
      const meal = service.log({
        name: 'Favorite Meal',
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 15,
        pattern: 'traditional'
      });

      const added = service.addToFavorites(meal.id);

      expect(added).toBe(true);
      expect(service.getFavorites()).toHaveLength(1);
    });

    it('should not add duplicate to favorites', () => {
      const meal = service.log({
        name: 'Favorite Meal',
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 15,
        pattern: 'traditional'
      });

      service.addToFavorites(meal.id);
      const secondAdd = service.addToFavorites(meal.id);

      expect(secondAdd).toBe(false);
      expect(service.getFavorites()).toHaveLength(1);
    });

    it('should remove from favorites', () => {
      const meal = service.log({
        name: 'Favorite Meal',
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 15,
        pattern: 'traditional'
      });

      service.addToFavorites(meal.id);
      const removed = service.removeFromFavorites(meal.id);

      expect(removed).toBe(true);
      expect(service.getFavorites()).toHaveLength(0);
    });
  });

  describe('Meal Duplication', () => {
    it('should duplicate a meal', () => {
      const original = service.log({
        name: 'Original Meal',
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 15,
        pattern: 'traditional'
      });

      const duplicate = service.duplicateMeal(original.id);

      expect(duplicate).toBeDefined();
      expect(duplicate?.name).toBe('Original Meal');
      expect(duplicate?.id).not.toBe(original.id);
    });

    it('should return null for non-existent meal', () => {
      const duplicate = service.duplicateMeal('non-existent');

      expect(duplicate).toBeNull();
    });
  });

  describe('Search and Filter', () => {
    beforeEach(() => {
      service.log({ name: 'Mexican Bowl', calories: 650, protein: 45, carbs: 65, fat: 22, pattern: 'traditional' });
      service.log({ name: 'Chicken Salad', calories: 400, protein: 40, carbs: 20, fat: 20, pattern: 'keto' });
      service.log({ name: 'Protein Shake', calories: 200, protein: 50, carbs: 10, fat: 5, pattern: 'workout' });
    });

    it('should search meals by name', () => {
      const results = service.search('chicken');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Chicken Salad');
    });

    it('should search meals by pattern', () => {
      const results = service.search('keto');

      expect(results).toHaveLength(1);
    });

    it('should get meals by pattern', () => {
      const results = service.getByPattern('traditional');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Mexican Bowl');
    });

    it('should get meals by calorie range', () => {
      const results = service.getMealsByCalorieRange(300, 500);

      // Only Chicken Salad (400 cal) is in the 300-500 range
      // Mexican Bowl (650) is too high, Protein Shake (200) is too low
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Chicken Salad');
    });

    it('should get high protein meals', () => {
      const results = service.getHighProteinMeals(45);

      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Ingredient Calculations', () => {
    it('should calculate nutrition from ingredients', () => {
      const ingredients: MealIngredient[] = [
        { id: '1', name: 'Chicken', quantity: 6, unit: 'oz', calories: 280, protein: 52 },
        { id: '2', name: 'Rice', quantity: 1, unit: 'cup', calories: 215, protein: 5 }
      ];

      const totals = service.calculateFromIngredients(ingredients);

      expect(totals.calories).toBe(495);
      expect(totals.protein).toBe(57);
    });

    it('should handle empty ingredients', () => {
      const totals = service.calculateFromIngredients([]);

      expect(totals.calories).toBe(0);
      expect(totals.protein).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle clearing history', () => {
      service.log({ name: 'Meal', calories: 500, protein: 30, carbs: 50, fat: 15, pattern: 'traditional' });

      service.clearHistory();

      expect(service.getHistory(30)).toHaveLength(0);
    });

    it('should handle meal with optional fields', () => {
      const meal = service.log({
        name: 'Simple Meal',
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 15,
        pattern: 'traditional'
      });

      expect(meal.fiber).toBeUndefined();
      expect(meal.rating).toBeUndefined();
      expect(meal.photo).toBeUndefined();
    });
  });
});
