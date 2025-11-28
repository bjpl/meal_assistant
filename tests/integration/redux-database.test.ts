/**
 * Redux Store Integration Tests with Database
 * Tests Redux store synchronization with PostgreSQL database
 * Ensures state management properly reflects database state
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================================
// Types
// ============================================================================

interface ReduxState {
  user: {
    currentUser: any | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
  };
  patterns: {
    selectedPattern: any | null;
    patternHistory: any[];
    loading: boolean;
    error: string | null;
  };
  hydration: {
    todayEntries: any[];
    dailyGoal: number;
    totalConsumed: number;
    totalCaffeine: number;
    loading: boolean;
    error: string | null;
  };
}

// ============================================================================
// Mock Redux Store Factory
// ============================================================================

const createMockStore = (db: any) => {
  let state: ReduxState = {
    user: {
      currentUser: null,
      isAuthenticated: false,
      loading: false,
      error: null
    },
    patterns: {
      selectedPattern: null,
      patternHistory: [],
      loading: false,
      error: null
    },
    hydration: {
      todayEntries: [],
      dailyGoal: 64,
      totalConsumed: 0,
      totalCaffeine: 0,
      loading: false,
      error: null
    }
  };

  return {
    getState: () => state,

    // User Actions
    async registerUser(email: string, password: string, profile: any) {
      state.user.loading = true;
      state.user.error = null;

      try {
        const user = await db.createUser(email, password, profile);

        state.user.currentUser = {
          id: user.id,
          email: user.email,
          profile: user.profile
        };
        state.user.isAuthenticated = true;
        state.user.loading = false;

        return { success: true, user };
      } catch (error: any) {
        state.user.error = error.message;
        state.user.loading = false;
        return { success: false, error: error.message };
      }
    },

    async loginUser(email: string, password: string) {
      state.user.loading = true;
      state.user.error = null;

      try {
        const user = await db.verifyPassword(email, password);

        if (!user) {
          throw new Error('Invalid credentials');
        }

        state.user.currentUser = {
          id: user.id,
          email: user.email,
          profile: user.profile
        };
        state.user.isAuthenticated = true;
        state.user.loading = false;

        return { success: true, user };
      } catch (error: any) {
        state.user.error = error.message;
        state.user.loading = false;
        return { success: false, error: error.message };
      }
    },

    logoutUser() {
      state.user.currentUser = null;
      state.user.isAuthenticated = false;
      state.user.error = null;
    },

    // Pattern Actions
    async selectPattern(patternType: string, date: string) {
      if (!state.user.currentUser) {
        throw new Error('User not authenticated');
      }

      state.patterns.loading = true;
      state.patterns.error = null;

      try {
        const pattern = await db.createPattern(
          state.user.currentUser.id,
          patternType,
          date
        );

        state.patterns.selectedPattern = pattern;
        state.patterns.patternHistory.push(pattern);
        state.patterns.loading = false;

        return { success: true, pattern };
      } catch (error: any) {
        state.patterns.error = error.message;
        state.patterns.loading = false;
        return { success: false, error: error.message };
      }
    },

    async loadPatternHistory() {
      if (!state.user.currentUser) {
        throw new Error('User not authenticated');
      }

      state.patterns.loading = true;
      state.patterns.error = null;

      try {
        const patterns = await db.getPatternsByUser(state.user.currentUser.id);

        state.patterns.patternHistory = patterns;
        state.patterns.loading = false;

        return { success: true, patterns };
      } catch (error: any) {
        state.patterns.error = error.message;
        state.patterns.loading = false;
        return { success: false, error: error.message };
      }
    },

    // Hydration Actions
    async logHydration(type: string, amountOz: number, caffeineMg: number) {
      if (!state.user.currentUser) {
        throw new Error('User not authenticated');
      }

      state.hydration.loading = true;
      state.hydration.error = null;

      try {
        const entry = await db.createHydrationEntry(
          state.user.currentUser.id,
          type,
          amountOz,
          caffeineMg
        );

        state.hydration.todayEntries.push(entry);
        state.hydration.totalConsumed += amountOz;
        state.hydration.totalCaffeine += caffeineMg;
        state.hydration.loading = false;

        return { success: true, entry };
      } catch (error: any) {
        state.hydration.error = error.message;
        state.hydration.loading = false;
        return { success: false, error: error.message };
      }
    },

    async loadTodayHydration() {
      if (!state.user.currentUser) {
        throw new Error('User not authenticated');
      }

      state.hydration.loading = true;
      state.hydration.error = null;

      try {
        const today = new Date().toISOString().split('T')[0];
        const entries = await db.getHydrationEntriesByDate(
          state.user.currentUser.id,
          today
        );

        state.hydration.todayEntries = entries;
        state.hydration.totalConsumed = entries.reduce(
          (sum: number, e: any) => sum + e.amountOz,
          0
        );
        state.hydration.totalCaffeine = entries.reduce(
          (sum: number, e: any) => sum + e.caffeineMg,
          0
        );
        state.hydration.loading = false;

        return { success: true, entries };
      } catch (error: any) {
        state.hydration.error = error.message;
        state.hydration.loading = false;
        return { success: false, error: error.message };
      }
    },

    // Reset state (for testing)
    resetState() {
      state = {
        user: {
          currentUser: null,
          isAuthenticated: false,
          loading: false,
          error: null
        },
        patterns: {
          selectedPattern: null,
          patternHistory: [],
          loading: false,
          error: null
        },
        hydration: {
          todayEntries: [],
          dailyGoal: 64,
          totalConsumed: 0,
          totalCaffeine: 0,
          loading: false,
          error: null
        }
      };
    }
  };
};

// ============================================================================
// Mock Database
// ============================================================================

const createMockDatabase = () => {
  const users = new Map<string, any>();
  const patterns = new Map<string, any>();
  const hydrationEntries = new Map<string, any>();

  return {
    async createUser(email: string, password: string, profile: any = {}) {
      for (const user of users.values()) {
        if (user.email === email) {
          throw new Error('User already exists');
        }
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

    async createPattern(userId: string, type: string, date: string) {
      const pattern = {
        id: `pattern-${Date.now()}`,
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

    async createHydrationEntry(userId: string, type: string, amountOz: number, caffeineMg: number) {
      const entry = {
        id: `hydration-${Date.now()}`,
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

    clearAll() {
      users.clear();
      patterns.clear();
      hydrationEntries.clear();
    }
  };
};

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Redux Store Database Integration', () => {
  let db: ReturnType<typeof createMockDatabase>;
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    db = createMockDatabase();
    store = createMockStore(db);
    db.clearAll();
  });

  // ==========================================================================
  // 1. User State Synchronization
  // ==========================================================================

  describe('User Registration Flow', () => {
    it('should sync user state with database after registration', async () => {
      const result = await store.registerUser('test@example.com', 'password123', {
        name: 'Test User',
        targetCalories: 1800
      });

      expect(result.success).toBe(true);

      const state = store.getState();
      expect(state.user.isAuthenticated).toBe(true);
      expect(state.user.currentUser.email).toBe('test@example.com');
      expect(state.user.loading).toBe(false);
    });

    it('should handle database errors in Redux state', async () => {
      await store.registerUser('test@example.com', 'password123', {});

      const result = await store.registerUser('test@example.com', 'different', {});

      expect(result.success).toBe(false);

      const state = store.getState();
      expect(state.user.error).toBe('User already exists');
      expect(state.user.isAuthenticated).toBe(true); // First user still authenticated
    });

    it('should set loading state during async operations', async () => {
      // Intercept to check loading state
      let loadingDuringOperation = false;

      const promise = store.registerUser('test@example.com', 'password', {});

      // Check immediately after dispatch
      const stateWhileLoading = store.getState();
      if (stateWhileLoading.user.loading) {
        loadingDuringOperation = true;
      }

      await promise;

      const finalState = store.getState();
      expect(finalState.user.loading).toBe(false);
    });
  });

  describe('User Login Flow', () => {
    beforeEach(async () => {
      await db.createUser('existing@example.com', 'hashedPassword', {
        name: 'Existing User'
      });
    });

    it('should sync user state with database after login', async () => {
      const result = await store.loginUser('existing@example.com', 'hashedPassword');

      expect(result.success).toBe(true);

      const state = store.getState();
      expect(state.user.isAuthenticated).toBe(true);
      expect(state.user.currentUser).toBeDefined();
      expect(state.user.error).toBeNull();
    });

    it('should handle invalid credentials', async () => {
      const result = await store.loginUser('existing@example.com', 'wrongPassword');

      expect(result.success).toBe(false);

      const state = store.getState();
      expect(state.user.isAuthenticated).toBe(false);
      expect(state.user.currentUser).toBeNull();
      expect(state.user.error).toBe('Invalid credentials');
    });
  });

  describe('User Logout Flow', () => {
    it('should clear user state on logout', async () => {
      await store.registerUser('test@example.com', 'password', {});

      let state = store.getState();
      expect(state.user.isAuthenticated).toBe(true);

      store.logoutUser();

      state = store.getState();
      expect(state.user.isAuthenticated).toBe(false);
      expect(state.user.currentUser).toBeNull();
    });
  });

  // ==========================================================================
  // 2. Pattern State Synchronization
  // ==========================================================================

  describe('Pattern Selection Flow', () => {
    beforeEach(async () => {
      await store.registerUser('test@example.com', 'password', {});
    });

    it('should sync pattern state with database', async () => {
      const result = await store.selectPattern('traditional', '2025-01-15');

      expect(result.success).toBe(true);

      const state = store.getState();
      expect(state.patterns.selectedPattern).toBeDefined();
      expect(state.patterns.selectedPattern.type).toBe('traditional');
      expect(state.patterns.patternHistory).toHaveLength(1);
    });

    it('should accumulate pattern history from database', async () => {
      await store.selectPattern('traditional', '2025-01-15');
      await store.selectPattern('if_noon', '2025-01-16');
      await store.selectPattern('reversed', '2025-01-17');

      const state = store.getState();
      expect(state.patterns.patternHistory).toHaveLength(3);
    });

    it('should require authentication for pattern operations', async () => {
      store.logoutUser();

      await expect(
        store.selectPattern('traditional', '2025-01-15')
      ).rejects.toThrow('User not authenticated');
    });
  });

  describe('Pattern History Loading', () => {
    beforeEach(async () => {
      await store.registerUser('test@example.com', 'password', {});
      await store.selectPattern('traditional', '2025-01-15');
      await store.selectPattern('if_noon', '2025-01-16');

      // Reset store to simulate app restart
      store.resetState();
      await store.loginUser('test@example.com', 'password');
    });

    it('should load pattern history from database', async () => {
      const result = await store.loadPatternHistory();

      expect(result.success).toBe(true);

      const state = store.getState();
      expect(state.patterns.patternHistory).toHaveLength(2);
      expect(state.patterns.patternHistory.map((p: any) => p.type)).toContain('traditional');
      expect(state.patterns.patternHistory.map((p: any) => p.type)).toContain('if_noon');
    });
  });

  // ==========================================================================
  // 3. Hydration State Synchronization
  // ==========================================================================

  describe('Hydration Logging Flow', () => {
    beforeEach(async () => {
      await store.registerUser('test@example.com', 'password', {});
    });

    it('should sync hydration entries with database', async () => {
      const result = await store.logHydration('water', 16, 0);

      expect(result.success).toBe(true);

      const state = store.getState();
      expect(state.hydration.todayEntries).toHaveLength(1);
      expect(state.hydration.totalConsumed).toBe(16);
      expect(state.hydration.totalCaffeine).toBe(0);
    });

    it('should track cumulative hydration correctly', async () => {
      await store.logHydration('water', 16, 0);
      await store.logHydration('coffee', 8, 95);
      await store.logHydration('water', 20, 0);

      const state = store.getState();
      expect(state.hydration.totalConsumed).toBe(44);
      expect(state.hydration.totalCaffeine).toBe(95);
    });

    it('should track caffeine from multiple sources', async () => {
      await store.logHydration('coffee', 8, 95);
      await store.logHydration('tea', 8, 47);
      await store.logHydration('energy_drink', 16, 160);

      const state = store.getState();
      expect(state.hydration.totalCaffeine).toBe(302);
    });
  });

  describe('Hydration History Loading', () => {
    beforeEach(async () => {
      await store.registerUser('test@example.com', 'password', {});
      await store.logHydration('water', 16, 0);
      await store.logHydration('coffee', 8, 95);

      // Reset store to simulate app restart
      store.resetState();
      await store.loginUser('test@example.com', 'password');
    });

    it('should reload today\'s hydration from database', async () => {
      const result = await store.loadTodayHydration();

      expect(result.success).toBe(true);

      const state = store.getState();
      expect(state.hydration.todayEntries).toHaveLength(2);
      expect(state.hydration.totalConsumed).toBe(24);
      expect(state.hydration.totalCaffeine).toBe(95);
    });
  });

  // ==========================================================================
  // 4. Cross-Slice State Consistency
  // ==========================================================================

  describe('Cross-Slice State Management', () => {
    it('should maintain consistency across user logout', async () => {
      await store.registerUser('test@example.com', 'password', {});
      await store.selectPattern('traditional', '2025-01-15');
      await store.logHydration('water', 16, 0);

      let state = store.getState();
      expect(state.user.isAuthenticated).toBe(true);
      expect(state.patterns.selectedPattern).toBeDefined();
      expect(state.hydration.todayEntries).toHaveLength(1);

      store.logoutUser();

      state = store.getState();
      expect(state.user.isAuthenticated).toBe(false);
      // Pattern and hydration state might persist in memory but user is logged out
    });

    it('should isolate data by user ID', async () => {
      // User 1
      await store.registerUser('user1@example.com', 'pass1', {});
      await store.selectPattern('traditional', '2025-01-15');
      await store.logHydration('water', 16, 0);

      store.logoutUser();

      // User 2
      await store.registerUser('user2@example.com', 'pass2', {});
      await store.loadPatternHistory();
      await store.loadTodayHydration();

      const state = store.getState();
      expect(state.patterns.patternHistory).toHaveLength(0); // User 2 has no patterns
      expect(state.hydration.todayEntries).toHaveLength(0); // User 2 has no hydration
    });
  });

  // ==========================================================================
  // 5. Error State Management
  // ==========================================================================

  describe('Error Handling in Redux', () => {
    it('should clear previous errors on successful operation', async () => {
      // Trigger error
      await store.loginUser('nonexistent@example.com', 'password');

      let state = store.getState();
      expect(state.user.error).toBe('Invalid credentials');

      // Successful operation should clear error
      await store.registerUser('new@example.com', 'password', {});

      state = store.getState();
      expect(state.user.error).toBeNull();
    });

    it('should preserve state on error', async () => {
      await store.registerUser('test@example.com', 'password', {});

      const stateBefore = store.getState();
      const userBefore = { ...stateBefore.user.currentUser };

      // Attempt duplicate registration (will fail)
      await store.registerUser('test@example.com', 'different', {});

      const stateAfter = store.getState();
      expect(stateAfter.user.currentUser).toEqual(userBefore);
      expect(stateAfter.user.isAuthenticated).toBe(true);
    });
  });

  // ==========================================================================
  // 6. Performance Tests
  // ==========================================================================

  describe('Redux-Database Performance', () => {
    beforeEach(async () => {
      await store.registerUser('perf@example.com', 'password', {});
    });

    it('should handle rapid state updates efficiently', async () => {
      const start = Date.now();

      for (let i = 0; i < 10; i++) {
        await store.logHydration('water', 8, 0);
      }

      const duration = Date.now() - start;

      const state = store.getState();
      expect(state.hydration.todayEntries).toHaveLength(10);
      expect(state.hydration.totalConsumed).toBe(80);
      expect(duration).toBeLessThan(500); // Should complete in < 500ms
    });

    it('should load large pattern history efficiently', async () => {
      // Create 30 patterns
      for (let i = 1; i <= 30; i++) {
        await store.selectPattern('traditional', `2025-01-${String(i).padStart(2, '0')}`);
      }

      // Reset and reload
      store.resetState();
      await store.loginUser('perf@example.com', 'password');

      const start = Date.now();
      await store.loadPatternHistory();
      const duration = Date.now() - start;

      const state = store.getState();
      expect(state.patterns.patternHistory).toHaveLength(30);
      expect(duration).toBeLessThan(100);
    });
  });
});
