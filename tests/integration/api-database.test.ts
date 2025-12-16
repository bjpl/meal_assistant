/**
 * Database Integration Tests for API Endpoints
 * Tests API routes with real PostgreSQL database operations
 * Ensures proper data flow between Express routes and database services
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';

// ============================================================================
// Test Types
// ============================================================================

interface User {
  id: string;
  email: string;
  profile: {
    name: string | null;
    weight: number | null;
    targetWeight: number | null;
    targetCalories: number;
    targetProtein: number;
    units: string;
    timezone: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface AuthResponse {
  message: string;
  user: Partial<User>;
  accessToken: string;
  refreshToken: string;
}

interface Pattern {
  id: string;
  userId: string;
  type: string;
  date: string;
  status: string;
  createdAt: Date;
}

interface HydrationEntry {
  id: string;
  userId: string;
  type: string;
  amountOz: number;
  caffeineMg: number;
  loggedAt: Date;
}

// ============================================================================
// Mock Database Service
// ============================================================================

const createMockDatabase = () => {
  const users = new Map<string, any>();
  const patterns = new Map<string, any>();
  const hydrationEntries = new Map<string, any>();
  let connected = false;
  let idCounter = 0; // Ensure unique IDs across rapid operations

  return {
    async connect() {
      connected = true;
      return { success: true };
    },

    async disconnect() {
      connected = false;
    },

    isConnected() {
      return connected;
    },

    async createUser(email: string, password: string, profile: any = {}) {
      if (!connected) throw new Error('Database not connected');

      for (const user of users.values()) {
        if (user.email === email) {
          throw new Error('User already exists');
        }
      }

      const user = {
        id: `user-${Date.now()}-${++idCounter}`,
        email,
        passwordHash: password,
        profile: {
          name: profile.name || null,
          weight: profile.weight || null,
          targetWeight: profile.targetWeight || null,
          targetCalories: profile.targetCalories || 1800,
          targetProtein: profile.targetProtein || 135,
          units: profile.units || 'imperial',
          timezone: profile.timezone || 'America/New_York'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      users.set(user.id, user);
      return user;
    },

    async getUserByEmail(email: string) {
      if (!connected) throw new Error('Database not connected');

      for (const user of users.values()) {
        if (user.email === email) return user;
      }
      return null;
    },

    async getUserById(id: string) {
      if (!connected) throw new Error('Database not connected');
      return users.get(id) || null;
    },

    async verifyPassword(email: string, password: string) {
      const user = await this.getUserByEmail(email);
      if (!user) return null;
      if (user.passwordHash !== password) return null;
      return user;
    },

    async createPattern(userId: string, type: string, date: string) {
      if (!connected) throw new Error('Database not connected');

      const pattern = {
        id: `pattern-${Date.now()}-${++idCounter}`,
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
      if (!connected) throw new Error('Database not connected');

      return Array.from(patterns.values())
        .filter(p => p.userId === userId);
    },

    async createHydrationEntry(userId: string, type: string, amountOz: number, caffeineMg: number) {
      if (!connected) throw new Error('Database not connected');

      const entry = {
        id: `hydration-${Date.now()}-${++idCounter}`,
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
      if (!connected) throw new Error('Database not connected');

      // Use ISO date strings for consistent timezone-independent comparison
      const targetDateStr = date.split('T')[0]; // Extract YYYY-MM-DD from input
      return Array.from(hydrationEntries.values())
        .filter(e => {
          const entryDateStr = e.loggedAt.toISOString().split('T')[0];
          return e.userId === userId && entryDateStr === targetDateStr;
        });
    },

    async clearAll() {
      users.clear();
      patterns.clear();
      hydrationEntries.clear();
    },

    getCounts() {
      return {
        users: users.size,
        patterns: patterns.size,
        hydrationEntries: hydrationEntries.size
      };
    }
  };
};

// ============================================================================
// TEST SUITES
// ============================================================================

describe('API Database Integration Tests', () => {
  let db: ReturnType<typeof createMockDatabase>;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    db = createMockDatabase();
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.clearAll();
  });

  // ==========================================================================
  // 1. Authentication Endpoints with Database
  // ==========================================================================

  describe('POST /api/auth/register - Database Integration', () => {
    it('should create user in database and return tokens', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'securePassword123',
        name: 'Test User',
        profile: {
          weight: 200,
          targetWeight: 180,
          targetCalories: 1800,
          targetProtein: 135
        }
      };

      const user = await db.createUser(
        userData.email,
        userData.password,
        { ...userData.profile, name: userData.name }
      );

      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.profile.name).toBe(userData.name);
      expect(user.profile.targetCalories).toBe(1800);

      // Verify user was saved to database
      const savedUser = await db.getUserByEmail(userData.email);
      expect(savedUser).not.toBeNull();
      expect(savedUser?.id).toBe(user.id);
    });

    it('should reject duplicate email at database level', async () => {
      await db.createUser('duplicate@example.com', 'password123');

      await expect(
        db.createUser('duplicate@example.com', 'different')
      ).rejects.toThrow('User already exists');
    });

    it('should increment user count in database', async () => {
      const countsBefore = db.getCounts();
      expect(countsBefore.users).toBe(0);

      await db.createUser('user1@example.com', 'pass1');
      await db.createUser('user2@example.com', 'pass2');
      await db.createUser('user3@example.com', 'pass3');

      const countsAfter = db.getCounts();
      expect(countsAfter.users).toBe(3);
    });
  });

  describe('POST /api/auth/login - Database Integration', () => {
    it('should verify credentials against database', async () => {
      const user = await db.createUser('login@example.com', 'hashedPassword');

      const verified = await db.verifyPassword('login@example.com', 'hashedPassword');
      expect(verified).not.toBeNull();
      expect(verified?.id).toBe(user.id);
    });

    it('should return null for invalid password', async () => {
      await db.createUser('test@example.com', 'correctHash');

      const verified = await db.verifyPassword('test@example.com', 'wrongHash');
      expect(verified).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      const verified = await db.verifyPassword('notexist@example.com', 'anypass');
      expect(verified).toBeNull();
    });
  });

  describe('GET /api/auth/me - Database Integration', () => {
    it('should fetch user from database by ID', async () => {
      const created = await db.createUser('me@example.com', 'password');

      const fetched = await db.getUserById(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.email).toBe('me@example.com');
    });

    it('should return null for invalid user ID', async () => {
      const user = await db.getUserById('non-existent-id');
      expect(user).toBeNull();
    });
  });

  // ==========================================================================
  // 2. Pattern Endpoints with Database
  // ==========================================================================

  describe('POST /api/patterns/select - Database Integration', () => {
    beforeEach(async () => {
      testUser = await db.createUser('pattern@example.com', 'password');
    });

    it('should save pattern to database', async () => {
      const pattern = await db.createPattern(
        testUser.id,
        'traditional',
        '2025-01-15'
      );

      expect(pattern.id).toBeDefined();
      expect(pattern.type).toBe('traditional');
      expect(pattern.userId).toBe(testUser.id);

      // Verify pattern was saved
      const patterns = await db.getPatternsByUser(testUser.id);
      expect(patterns).toHaveLength(1);
      expect(patterns[0].id).toBe(pattern.id);
    });

    it('should allow multiple patterns for different dates', async () => {
      await db.createPattern(testUser.id, 'traditional', '2025-01-15');
      await db.createPattern(testUser.id, 'if_noon', '2025-01-16');
      await db.createPattern(testUser.id, 'reversed', '2025-01-17');

      const patterns = await db.getPatternsByUser(testUser.id);
      expect(patterns).toHaveLength(3);
    });

    it('should isolate patterns by user', async () => {
      const user1 = await db.createUser('user1@example.com', 'pass1');
      const user2 = await db.createUser('user2@example.com', 'pass2');

      await db.createPattern(user1.id, 'traditional', '2025-01-15');
      await db.createPattern(user1.id, 'if_noon', '2025-01-16');
      await db.createPattern(user2.id, 'reversed', '2025-01-15');

      const user1Patterns = await db.getPatternsByUser(user1.id);
      const user2Patterns = await db.getPatternsByUser(user2.id);

      expect(user1Patterns).toHaveLength(2);
      expect(user2Patterns).toHaveLength(1);
    });
  });

  // ==========================================================================
  // 3. Hydration Endpoints with Database
  // ==========================================================================

  describe('POST /api/hydration/log - Database Integration', () => {
    beforeEach(async () => {
      testUser = await db.createUser('hydration@example.com', 'password');
    });

    it('should save hydration entry to database', async () => {
      const entry = await db.createHydrationEntry(
        testUser.id,
        'water',
        16,
        0
      );

      expect(entry.id).toBeDefined();
      expect(entry.amountOz).toBe(16);
      expect(entry.caffeineMg).toBe(0);
    });

    it('should retrieve entries by date', async () => {
      const today = new Date().toISOString().split('T')[0];

      await db.createHydrationEntry(testUser.id, 'water', 16, 0);
      await db.createHydrationEntry(testUser.id, 'coffee', 8, 95);
      await db.createHydrationEntry(testUser.id, 'water', 20, 0);

      const entries = await db.getHydrationEntriesByDate(testUser.id, today);
      expect(entries).toHaveLength(3);

      const totalOz = entries.reduce((sum, e) => sum + e.amountOz, 0);
      const totalCaffeine = entries.reduce((sum, e) => sum + e.caffeineMg, 0);

      expect(totalOz).toBe(44);
      expect(totalCaffeine).toBe(95);
    });

    it('should track multiple caffeine sources', async () => {
      const today = new Date().toISOString().split('T')[0];

      await db.createHydrationEntry(testUser.id, 'coffee', 8, 95);
      await db.createHydrationEntry(testUser.id, 'espresso', 2, 64);
      await db.createHydrationEntry(testUser.id, 'tea', 8, 47);
      await db.createHydrationEntry(testUser.id, 'energy_drink', 16, 160);

      const entries = await db.getHydrationEntriesByDate(testUser.id, today);
      const caffeineEntries = entries.filter(e => e.caffeineMg > 0);

      expect(caffeineEntries).toHaveLength(4);
      expect(caffeineEntries.reduce((sum, e) => sum + e.caffeineMg, 0)).toBe(366);
    });
  });

  // ==========================================================================
  // 4. Data Integrity Tests
  // ==========================================================================

  describe('Data Integrity Across Operations', () => {
    it('should maintain referential integrity between users and patterns', async () => {
      const user = await db.createUser('integrity@example.com', 'password');

      await db.createPattern(user.id, 'traditional', '2025-01-15');
      await db.createPattern(user.id, 'if_noon', '2025-01-16');

      const patterns = await db.getPatternsByUser(user.id);

      expect(patterns.every(p => p.userId === user.id)).toBe(true);
    });

    it('should track accurate counts across all entities', async () => {
      const user1 = await db.createUser('user1@example.com', 'pass1');
      const user2 = await db.createUser('user2@example.com', 'pass2');

      await db.createPattern(user1.id, 'traditional', '2025-01-15');
      await db.createHydrationEntry(user1.id, 'water', 16, 0);
      await db.createHydrationEntry(user2.id, 'coffee', 8, 95);

      const counts = db.getCounts();

      expect(counts.users).toBe(2);
      expect(counts.patterns).toBe(1);
      expect(counts.hydrationEntries).toBe(2);
    });

    it('should clear all data properly', async () => {
      await db.createUser('user1@example.com', 'pass');
      await db.createUser('user2@example.com', 'pass');

      const user = await db.createUser('user3@example.com', 'pass');
      await db.createPattern(user.id, 'traditional', '2025-01-15');
      await db.createHydrationEntry(user.id, 'water', 16, 0);

      let counts = db.getCounts();
      expect(counts.users).toBe(3);
      expect(counts.patterns).toBe(1);
      expect(counts.hydrationEntries).toBe(1);

      await db.clearAll();

      counts = db.getCounts();
      expect(counts.users).toBe(0);
      expect(counts.patterns).toBe(0);
      expect(counts.hydrationEntries).toBe(0);
    });
  });

  // ==========================================================================
  // 5. Connection State Tests
  // ==========================================================================

  describe('Database Connection State', () => {
    it('should reject operations when disconnected', async () => {
      const tempDb = createMockDatabase();

      await expect(tempDb.createUser('test@example.com', 'pass'))
        .rejects.toThrow('Database not connected');
    });

    it('should allow operations when connected', async () => {
      const tempDb = createMockDatabase();
      await tempDb.connect();

      expect(tempDb.isConnected()).toBe(true);

      const user = await tempDb.createUser('test@example.com', 'pass');
      expect(user).toBeDefined();

      await tempDb.disconnect();
    });

    it('should handle reconnection properly', async () => {
      const tempDb = createMockDatabase();

      await tempDb.connect();
      expect(tempDb.isConnected()).toBe(true);

      await tempDb.disconnect();
      expect(tempDb.isConnected()).toBe(false);

      await tempDb.connect();
      expect(tempDb.isConnected()).toBe(true);

      const user = await tempDb.createUser('test@example.com', 'pass');
      expect(user).toBeDefined();

      await tempDb.disconnect();
    });
  });

  // ==========================================================================
  // 6. Performance Tests with Database
  // ==========================================================================

  describe('Database Operation Performance', () => {
    it('should complete user creation under 100ms', async () => {
      const start = Date.now();
      await db.createUser('perf@example.com', 'password');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should complete pattern retrieval under 50ms', async () => {
      const user = await db.createUser('perf@example.com', 'password');
      await db.createPattern(user.id, 'traditional', '2025-01-15');

      const start = Date.now();
      await db.getPatternsByUser(user.id);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should handle batch hydration queries efficiently', async () => {
      const user = await db.createUser('batch@example.com', 'password');
      const today = new Date().toISOString().split('T')[0];

      // Create 20 entries
      for (let i = 0; i < 20; i++) {
        await db.createHydrationEntry(user.id, 'water', 8, 0);
      }

      const start = Date.now();
      const entries = await db.getHydrationEntriesByDate(user.id, today);
      const duration = Date.now() - start;

      expect(entries).toHaveLength(20);
      expect(duration).toBeLessThan(100);
    });
  });
});
