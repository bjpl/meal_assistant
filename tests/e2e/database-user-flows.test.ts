/**
 * End-to-End User Flow Tests with Database
 * Tests complete user journeys with database persistence
 * Simulates real-world usage patterns
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================================
// System Components
// ============================================================================

const createMockDatabase = () => {
  const users = new Map<string, any>();
  const patterns = new Map<string, any>();
  const meals = new Map<string, any>();
  const hydrationEntries = new Map<string, any>();
  const inventory = new Map<string, any>();

  return {
    // User operations
    async createUser(email: string, password: string, profile: any = {}) {
      if (Array.from(users.values()).some(u => u.email === email)) {
        throw new Error('User already exists');
      }

      const user = {
        id: `user-${Date.now()}`,
        email,
        passwordHash: password,
        profile,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      users.set(user.id, user);
      return user;
    },

    async verifyPassword(email: string, password: string) {
      for (const user of users.values()) {
        if (user.email === email && user.passwordHash === password) {
          return user;
        }
      }
      return null;
    },

    async getUserById(id: string) {
      return users.get(id) || null;
    },

    // Pattern operations
    async createPattern(userId: string, type: string, date: string) {
      const pattern = {
        id: `pattern-${Date.now()}-${Math.random()}`,
        userId,
        type,
        date,
        status: 'active',
        createdAt: new Date()
      };

      patterns.set(pattern.id, pattern);
      return pattern;
    },

    async getPatternsByUser(userId: string) {
      return Array.from(patterns.values()).filter(p => p.userId === userId);
    },

    async updatePattern(id: string, updates: any) {
      const pattern = patterns.get(id);
      if (!pattern) return null;

      const updated = { ...pattern, ...updates };
      patterns.set(id, updated);
      return updated;
    },

    // Meal operations
    async logMeal(userId: string, patternId: string, mealData: any) {
      const meal = {
        id: `meal-${Date.now()}-${Math.random()}`,
        userId,
        patternId,
        ...mealData,
        loggedAt: new Date()
      };

      meals.set(meal.id, meal);
      return meal;
    },

    async getMealsByPattern(patternId: string) {
      return Array.from(meals.values()).filter(m => m.patternId === patternId);
    },

    // Hydration operations
    async createHydrationEntry(userId: string, type: string, amountOz: number, caffeineMg: number) {
      const entry = {
        id: `hydration-${Date.now()}-${Math.random()}`,
        userId,
        type,
        amountOz,
        caffeineMg,
        loggedAt: new Date()
      };

      hydrationEntries.set(entry.id, entry);
      return entry;
    },

    async getHydrationEntriesByDate(userId: string, date: string) {
      const targetDate = new Date(date);
      return Array.from(hydrationEntries.values()).filter(e => {
        const entryDate = new Date(e.loggedAt);
        return e.userId === userId &&
               entryDate.toDateString() === targetDate.toDateString();
      });
    },

    // Inventory operations
    async addInventoryItem(userId: string, itemData: any) {
      const item = {
        id: `inventory-${Date.now()}-${Math.random()}`,
        userId,
        ...itemData,
        createdAt: new Date()
      };

      inventory.set(item.id, item);
      return item;
    },

    async getInventoryByUser(userId: string) {
      return Array.from(inventory.values()).filter(i => i.userId === userId);
    },

    async updateInventoryQuantity(id: string, quantityChange: number) {
      const item = inventory.get(id);
      if (!item) return null;

      item.quantity += quantityChange;
      inventory.set(id, item);
      return item;
    },

    clearAll() {
      users.clear();
      patterns.clear();
      meals.clear();
      hydrationEntries.clear();
      inventory.clear();
    }
  };
};

// ============================================================================
// TEST SUITES
// ============================================================================

describe('End-to-End User Flows with Database', () => {
  let db: ReturnType<typeof createMockDatabase>;

  beforeEach(() => {
    db = createMockDatabase();
  });

  // ==========================================================================
  // 1. New User Onboarding Flow
  // ==========================================================================

  describe('New User Complete Onboarding', () => {
    it('should complete full user registration and setup flow', async () => {
      // Step 1: Register new user
      const user = await db.createUser('newuser@example.com', 'password123', {
        name: 'Brandon',
        weight: 250,
        targetWeight: 220,
        targetCalories: 1800,
        targetProtein: 135
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('newuser@example.com');

      // Step 2: Login (verify user exists)
      const authenticated = await db.verifyPassword('newuser@example.com', 'password123');
      expect(authenticated).not.toBeNull();
      expect(authenticated?.id).toBe(user.id);

      // Step 3: Select first eating pattern
      const pattern = await db.createPattern(user.id, 'traditional', '2025-01-15');
      expect(pattern.id).toBeDefined();
      expect(pattern.type).toBe('traditional');

      // Step 4: Add initial inventory
      const chickenBreast = await db.addInventoryItem(user.id, {
        name: 'Chicken Breast',
        quantity: 24,
        unit: 'oz',
        category: 'protein'
      });

      const rice = await db.addInventoryItem(user.id, {
        name: 'Rice',
        quantity: 10,
        unit: 'cup',
        category: 'carbohydrate'
      });

      const inventoryItems = await db.getInventoryByUser(user.id);
      expect(inventoryItems).toHaveLength(2);

      // Verify complete setup
      expect(user).toBeDefined();
      expect(pattern).toBeDefined();
      expect(inventoryItems.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 2. Daily Usage Flow
  // ==========================================================================

  describe('Typical Day Usage Flow', () => {
    it('should handle complete daily usage pattern', async () => {
      // Setup: User already registered
      const user = await db.createUser('daily@example.com', 'password', {
        name: 'Daily User',
        targetCalories: 1800
      });

      const today = new Date().toISOString().split('T')[0];

      // Morning: Select pattern and log hydration
      const pattern = await db.createPattern(user.id, 'big_breakfast', today);
      expect(pattern.type).toBe('big_breakfast');

      await db.createHydrationEntry(user.id, 'water', 16, 0);
      await db.createHydrationEntry(user.id, 'coffee', 8, 95);

      // Mid-day: Log meals and more hydration
      await db.logMeal(user.id, pattern.id, {
        mealType: 'breakfast',
        calories: 820,
        protein: 55,
        status: 'completed',
        rating: 5
      });

      await db.createHydrationEntry(user.id, 'water', 20, 0);

      // Afternoon: Log lunch
      await db.logMeal(user.id, pattern.id, {
        mealType: 'lunch',
        calories: 580,
        protein: 45,
        status: 'completed',
        rating: 4
      });

      await db.createHydrationEntry(user.id, 'water', 16, 0);

      // Evening: Log dinner and final hydration
      await db.logMeal(user.id, pattern.id, {
        mealType: 'dinner',
        calories: 400,
        protein: 35,
        status: 'completed',
        rating: 4
      });

      await db.createHydrationEntry(user.id, 'water', 12, 0);

      // Verify day's data
      const meals = await db.getMealsByPattern(pattern.id);
      const hydration = await db.getHydrationEntriesByDate(user.id, today);

      expect(meals).toHaveLength(3);
      expect(hydration).toHaveLength(5);

      const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
      const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);
      const totalHydration = hydration.reduce((sum, e) => sum + e.amountOz, 0);
      const totalCaffeine = hydration.reduce((sum, e) => sum + e.caffeineMg, 0);

      expect(totalCalories).toBe(1800);
      expect(totalProtein).toBe(135);
      expect(totalHydration).toBe(72);
      expect(totalCaffeine).toBe(95);
    });
  });

  // ==========================================================================
  // 3. Pattern Switching Flow
  // ==========================================================================

  describe('Pattern Switching Mid-Day', () => {
    it('should handle pattern switch with meal adjustments', async () => {
      const user = await db.createUser('switcher@example.com', 'password', {});
      const today = new Date().toISOString().split('T')[0];

      // Start with Traditional pattern
      const originalPattern = await db.createPattern(user.id, 'traditional', today);

      // Log breakfast
      await db.logMeal(user.id, originalPattern.id, {
        mealType: 'breakfast',
        calories: 350,
        protein: 25,
        status: 'completed'
      });

      // User decides to switch to IF Noon pattern
      await db.updatePattern(originalPattern.id, { status: 'switched' });

      const newPattern = await db.createPattern(user.id, 'if_noon', today);
      expect(newPattern.type).toBe('if_noon');

      // Log remaining meals on new pattern
      await db.logMeal(user.id, newPattern.id, {
        mealType: 'lunch',
        calories: 900,
        protein: 65,
        status: 'completed'
      });

      await db.logMeal(user.id, newPattern.id, {
        mealType: 'dinner',
        calories: 550,
        protein: 45,
        status: 'completed'
      });

      // Verify both patterns exist
      const allPatterns = await db.getPatternsByUser(user.id);
      expect(allPatterns).toHaveLength(2);

      const switchedPattern = allPatterns.find(p => p.status === 'switched');
      const activePattern = allPatterns.find(p => p.status === 'active');

      expect(switchedPattern?.type).toBe('traditional');
      expect(activePattern?.type).toBe('if_noon');

      // Verify meals distributed correctly
      const originalMeals = await db.getMealsByPattern(originalPattern.id);
      const newMeals = await db.getMealsByPattern(newPattern.id);

      expect(originalMeals).toHaveLength(1); // Just breakfast
      expect(newMeals).toHaveLength(2); // Lunch and dinner
    });
  });

  // ==========================================================================
  // 4. Inventory Consumption Flow
  // ==========================================================================

  describe('Meal Prep and Inventory Consumption', () => {
    it('should track inventory through meal preparation', async () => {
      const user = await db.createUser('prepper@example.com', 'password', {});

      // Add inventory items
      const chicken = await db.addInventoryItem(user.id, {
        name: 'Chicken Breast',
        quantity: 48,
        unit: 'oz',
        category: 'protein'
      });

      const rice = await db.addInventoryItem(user.id, {
        name: 'Rice',
        quantity: 12,
        unit: 'cup',
        category: 'carbohydrate'
      });

      expect(chicken.quantity).toBe(48);
      expect(rice.quantity).toBe(12);

      // Select pattern
      const pattern = await db.createPattern(user.id, 'traditional', '2025-01-15');

      // Prep breakfast (consume inventory)
      await db.updateInventoryQuantity(chicken.id, -6); // Use 6 oz chicken
      await db.updateInventoryQuantity(rice.id, -1); // Use 1 cup rice

      await db.logMeal(user.id, pattern.id, {
        mealType: 'breakfast',
        calories: 350,
        protein: 35,
        status: 'completed'
      });

      // Prep lunch
      await db.updateInventoryQuantity(chicken.id, -8);
      await db.updateInventoryQuantity(rice.id, -1.5);

      await db.logMeal(user.id, pattern.id, {
        mealType: 'lunch',
        calories: 580,
        protein: 55,
        status: 'completed'
      });

      // Prep dinner
      await db.updateInventoryQuantity(chicken.id, -6);
      await db.updateInventoryQuantity(rice.id, -1);

      await db.logMeal(user.id, pattern.id, {
        mealType: 'dinner',
        calories: 400,
        protein: 40,
        status: 'completed'
      });

      // Verify inventory levels
      const updatedChicken = await db.getInventoryByUser(user.id).then(
        items => items.find(i => i.id === chicken.id)
      );

      const updatedRice = await db.getInventoryByUser(user.id).then(
        items => items.find(i => i.id === rice.id)
      );

      expect(updatedChicken?.quantity).toBe(28); // 48 - 6 - 8 - 6 = 28
      expect(updatedRice?.quantity).toBe(8.5); // 12 - 1 - 1.5 - 1 = 8.5

      // Verify meals were logged
      const meals = await db.getMealsByPattern(pattern.id);
      expect(meals).toHaveLength(3);
    });
  });

  // ==========================================================================
  // 5. Multi-Day Pattern Tracking
  // ==========================================================================

  describe('Week-Long Pattern Usage', () => {
    it('should track patterns across multiple days', async () => {
      const user = await db.createUser('weekly@example.com', 'password', {});

      const week = [
        { type: 'traditional', date: '2025-01-13' },
        { type: 'traditional', date: '2025-01-14' },
        { type: 'if_noon', date: '2025-01-15' },
        { type: 'if_noon', date: '2025-01-16' },
        { type: 'reversed', date: '2025-01-17' },
        { type: 'big_breakfast', date: '2025-01-18' },
        { type: 'traditional', date: '2025-01-19' }
      ];

      // Create patterns for each day
      for (const day of week) {
        const pattern = await db.createPattern(user.id, day.type, day.date);
        expect(pattern.type).toBe(day.type);

        // Log meals for each pattern
        await db.logMeal(user.id, pattern.id, {
          mealType: 'breakfast',
          calories: 400,
          protein: 30,
          status: 'completed'
        });

        await db.logMeal(user.id, pattern.id, {
          mealType: 'lunch',
          calories: 600,
          protein: 50,
          status: 'completed'
        });

        await db.logMeal(user.id, pattern.id, {
          mealType: 'dinner',
          calories: 800,
          protein: 55,
          status: 'completed'
        });
      }

      // Verify week's data
      const allPatterns = await db.getPatternsByUser(user.id);
      expect(allPatterns).toHaveLength(7);

      // Calculate pattern distribution
      const patternCounts = allPatterns.reduce((counts, p) => {
        counts[p.type] = (counts[p.type] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      expect(patternCounts['traditional']).toBe(3);
      expect(patternCounts['if_noon']).toBe(2);
      expect(patternCounts['reversed']).toBe(1);
      expect(patternCounts['big_breakfast']).toBe(1);
    });
  });

  // ==========================================================================
  // 6. Hydration Goal Tracking
  // ==========================================================================

  describe('Daily Hydration Goal Achievement', () => {
    it('should track progress toward daily hydration goal', async () => {
      const user = await db.createUser('hydrated@example.com', 'password', {
        dailyHydrationGoal: 64 // 64 oz per day
      });

      const today = new Date().toISOString().split('T')[0];

      // Morning hydration
      await db.createHydrationEntry(user.id, 'water', 16, 0);
      await db.createHydrationEntry(user.id, 'coffee', 8, 95);

      // Mid-morning
      await db.createHydrationEntry(user.id, 'water', 12, 0);

      // Lunch
      await db.createHydrationEntry(user.id, 'water', 16, 0);

      // Afternoon
      await db.createHydrationEntry(user.id, 'tea', 8, 47);

      // Evening
      await db.createHydrationEntry(user.id, 'water', 8, 0);

      // Calculate progress
      const entries = await db.getHydrationEntriesByDate(user.id, today);

      const totalOz = entries.reduce((sum, e) => sum + e.amountOz, 0);
      const totalCaffeine = entries.reduce((sum, e) => sum + e.caffeineMg, 0);
      const goalProgress = (totalOz / 64) * 100;

      expect(totalOz).toBe(68);
      expect(totalCaffeine).toBe(142);
      expect(goalProgress).toBeGreaterThan(100); // Exceeded goal!
    });
  });

  // ==========================================================================
  // 7. Complete User Journey: Registration to Week 1
  // ==========================================================================

  describe('Complete First Week User Journey', () => {
    it('should handle all operations for a new user\'s first week', async () => {
      // Day 1: Registration and setup
      const user = await db.createUser('firstweek@example.com', 'password', {
        name: 'Brandon',
        weight: 250,
        targetWeight: 220,
        targetCalories: 1800,
        targetProtein: 135
      });

      // Add initial inventory
      await db.addInventoryItem(user.id, {
        name: 'Chicken Breast',
        quantity: 96,
        unit: 'oz'
      });

      await db.addInventoryItem(user.id, {
        name: 'Rice',
        quantity: 20,
        unit: 'cup'
      });

      await db.addInventoryItem(user.id, {
        name: 'Broccoli',
        quantity: 10,
        unit: 'cup'
      });

      // Day 1-7: Create patterns and log data
      const days = ['15', '16', '17', '18', '19', '20', '21'];
      const patterns = ['traditional', 'traditional', 'if_noon', 'if_noon', 'reversed', 'big_breakfast', 'traditional'];

      for (let i = 0; i < 7; i++) {
        const date = `2025-01-${days[i]}`;
        const pattern = await db.createPattern(user.id, patterns[i], date);

        // Log 3 meals per day
        for (let j = 0; j < 3; j++) {
          await db.logMeal(user.id, pattern.id, {
            mealType: ['breakfast', 'lunch', 'dinner'][j],
            calories: [400, 700, 700][j],
            protein: [30, 55, 50][j],
            status: 'completed',
            rating: 4
          });
        }

        // Log hydration (5 entries per day)
        for (let k = 0; k < 5; k++) {
          await db.createHydrationEntry(
            user.id,
            k === 1 ? 'coffee' : 'water',
            k === 1 ? 8 : 12,
            k === 1 ? 95 : 0
          );
        }
      }

      // Verify complete week
      const allPatterns = await db.getPatternsByUser(user.id);
      const inventory = await db.getInventoryByUser(user.id);

      expect(allPatterns).toHaveLength(7);
      expect(inventory).toHaveLength(3);

      // Calculate week totals
      let totalMeals = 0;
      for (const pattern of allPatterns) {
        const meals = await db.getMealsByPattern(pattern.id);
        totalMeals += meals.length;
      }

      expect(totalMeals).toBe(21); // 3 meals × 7 days

      // Verify user is still in database
      const persistedUser = await db.getUserById(user.id);
      expect(persistedUser).not.toBeNull();
      expect(persistedUser?.email).toBe('firstweek@example.com');
    });
  });
});
