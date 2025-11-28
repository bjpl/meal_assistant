/**
 * Unit Tests: Hydration API
 * Comprehensive tests for hydration tracking endpoints and calculations
 * Week 1-2 Deliverable - Target: 50+ test cases
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================================
// Types for Hydration System
// ============================================================================

interface HydrationEntry {
  id: string;
  userId: string;
  type: 'water' | 'coffee' | 'tea' | 'soda' | 'juice' | 'energy-drink' | 'other';
  amountOz: number;
  caffeineMg: number;
  timestamp: Date;
  notes?: string;
}

interface HydrationGoals {
  userId: string;
  dailyWaterOz: number;
  maxCaffeineMg: number;
  caffeineWarningMg: number;
  bodyWeightLbs: number;
}

interface DailyProgress {
  date: string;
  totalWaterOz: number;
  totalCaffeineMg: number;
  percentOfGoal: number;
  caffeineStatus: 'safe' | 'warning' | 'limit' | 'exceeded';
  entriesCount: number;
  entries: HydrationEntry[];
}

interface HydrationTrend {
  date: string;
  waterOz: number;
  caffeineMg: number;
  percentOfGoal: number;
  goalMet: boolean;
}

// ============================================================================
// Mock Hydration API Service
// ============================================================================

const createHydrationApiService = () => {
  const entries: HydrationEntry[] = [];
  const goals = new Map<string, HydrationGoals>();

  // Default caffeine content per 8oz
  const beverageCaffeine: Record<string, number> = {
    'water': 0,
    'coffee': 95,
    'tea': 47,
    'soda': 45,
    'juice': 0,
    'energy-drink': 150,
    'other': 0
  };

  // Calculate caffeine for a beverage amount
  const calculateCaffeine = (type: string, amountOz: number, customCaffeine?: number): number => {
    if (customCaffeine !== undefined) return customCaffeine;
    const per8oz = beverageCaffeine[type] || 0;
    return Math.round((per8oz / 8) * amountOz);
  };

  return {
    // ========================================================================
    // Entry Management (POST /api/hydration/log)
    // ========================================================================

    async logEntry(
      userId: string,
      data: { type: string; amountOz: number; caffeineMg?: number; notes?: string }
    ): Promise<{ success: boolean; entry: HydrationEntry; dailyProgress: DailyProgress }> {
      // Validation
      if (!userId) throw new Error('User ID required');
      if (!data.type) throw new Error('Beverage type required');
      if (data.amountOz <= 0) throw new Error('Amount must be positive');
      if (data.amountOz > 128) throw new Error('Amount exceeds reasonable limit');

      const validTypes = ['water', 'coffee', 'tea', 'soda', 'juice', 'energy-drink', 'other'];
      if (!validTypes.includes(data.type)) {
        throw new Error(`Invalid beverage type: ${data.type}`);
      }

      const entry: HydrationEntry = {
        id: `hydration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        type: data.type as HydrationEntry['type'],
        amountOz: data.amountOz,
        caffeineMg: calculateCaffeine(data.type, data.amountOz, data.caffeineMg),
        timestamp: new Date(),
        notes: data.notes
      };

      entries.push(entry);

      return {
        success: true,
        entry,
        dailyProgress: this.getDailyProgress(userId)
      };
    },

    // ========================================================================
    // Quick Log (POST /api/hydration/quick-log)
    // ========================================================================

    async quickLogWater(userId: string, amountOz: 8 | 16 | 24 | 32): Promise<HydrationEntry> {
      const result = await this.logEntry(userId, { type: 'water', amountOz });
      return result.entry;
    },

    // ========================================================================
    // Get Entry (GET /api/hydration/:id)
    // ========================================================================

    getEntry(userId: string, entryId: string): HydrationEntry | null {
      const entry = entries.find(e => e.id === entryId && e.userId === userId);
      return entry || null;
    },

    // ========================================================================
    // Delete Entry (DELETE /api/hydration/:id)
    // ========================================================================

    deleteEntry(userId: string, entryId: string): { success: boolean; undoToken?: string } {
      const index = entries.findIndex(e => e.id === entryId && e.userId === userId);
      if (index === -1) return { success: false };

      const deleted = entries.splice(index, 1)[0];
      // Generate undo token (expires in 30 seconds)
      const undoToken = Buffer.from(JSON.stringify({
        entry: deleted,
        expiresAt: Date.now() + 30000
      })).toString('base64');

      return { success: true, undoToken };
    },

    // ========================================================================
    // Undo Delete (POST /api/hydration/undo)
    // ========================================================================

    undoDelete(undoToken: string): { success: boolean; entry?: HydrationEntry } {
      try {
        const data = JSON.parse(Buffer.from(undoToken, 'base64').toString());
        if (Date.now() > data.expiresAt) {
          return { success: false };
        }
        entries.push(data.entry);
        return { success: true, entry: data.entry };
      } catch {
        return { success: false };
      }
    },

    // ========================================================================
    // Daily Progress (GET /api/hydration/daily)
    // ========================================================================

    getDailyProgress(userId: string, date: Date = new Date()): DailyProgress {
      const userGoals = goals.get(userId) || {
        userId,
        dailyWaterOz: 125, // Default for Brandon (250 / 2)
        maxCaffeineMg: 400,
        caffeineWarningMg: 300,
        bodyWeightLbs: 250
      };

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const dayEntries = entries.filter(e =>
        e.userId === userId &&
        e.timestamp >= startOfDay &&
        e.timestamp <= endOfDay
      );

      const totalWaterOz = dayEntries.reduce((sum, e) => sum + e.amountOz, 0);
      const totalCaffeineMg = dayEntries.reduce((sum, e) => sum + e.caffeineMg, 0);

      let caffeineStatus: DailyProgress['caffeineStatus'] = 'safe';
      if (totalCaffeineMg > userGoals.maxCaffeineMg) {
        caffeineStatus = 'exceeded';
      } else if (totalCaffeineMg >= userGoals.maxCaffeineMg) {
        caffeineStatus = 'limit';
      } else if (totalCaffeineMg >= userGoals.caffeineWarningMg) {
        caffeineStatus = 'warning';
      }

      return {
        date: date.toISOString().split('T')[0],
        totalWaterOz,
        totalCaffeineMg,
        percentOfGoal: Math.round((totalWaterOz / userGoals.dailyWaterOz) * 100),
        caffeineStatus,
        entriesCount: dayEntries.length,
        entries: dayEntries
      };
    },

    // ========================================================================
    // Goal Management (GET/PUT /api/hydration/goals)
    // ========================================================================

    getGoals(userId: string): HydrationGoals {
      return goals.get(userId) || {
        userId,
        dailyWaterOz: 125,
        maxCaffeineMg: 400,
        caffeineWarningMg: 300,
        bodyWeightLbs: 250
      };
    },

    setGoals(userId: string, newGoals: Partial<Omit<HydrationGoals, 'userId'>>): HydrationGoals {
      const current = this.getGoals(userId);
      const updated = { ...current, ...newGoals, userId };

      // Validation
      if (updated.dailyWaterOz < 32) throw new Error('Daily water goal too low (min 32oz)');
      if (updated.dailyWaterOz > 256) throw new Error('Daily water goal too high (max 256oz)');
      if (updated.maxCaffeineMg < 0) throw new Error('Caffeine limit cannot be negative');
      if (updated.maxCaffeineMg > 600) throw new Error('Caffeine limit too high (max 600mg)');
      if (updated.caffeineWarningMg >= updated.maxCaffeineMg) {
        throw new Error('Warning threshold must be below limit');
      }

      goals.set(userId, updated);
      return updated;
    },

    // ========================================================================
    // Calculate Goal from Weight (GET /api/hydration/calculate-goal)
    // ========================================================================

    calculateGoalFromWeight(weightLbs: number): { dailyWaterOz: number; formula: string } {
      if (weightLbs < 50) throw new Error('Weight too low');
      if (weightLbs > 500) throw new Error('Weight too high');

      const dailyWaterOz = Math.round(weightLbs / 2);
      return {
        dailyWaterOz,
        formula: `${weightLbs} lbs / 2 = ${dailyWaterOz} oz`
      };
    },

    // ========================================================================
    // Caffeine Check (GET /api/hydration/caffeine-check)
    // ========================================================================

    checkCaffeine(
      userId: string,
      additionalMg: number
    ): { allowed: boolean; warning?: string; currentMg: number; limitMg: number; remainingMg: number } {
      const progress = this.getDailyProgress(userId);
      const userGoals = this.getGoals(userId);

      const currentMg = progress.totalCaffeineMg;
      const limitMg = userGoals.maxCaffeineMg;
      const remainingMg = Math.max(0, limitMg - currentMg);

      if (additionalMg > remainingMg) {
        return {
          allowed: false,
          warning: `Would exceed daily limit by ${additionalMg - remainingMg}mg`,
          currentMg,
          limitMg,
          remainingMg
        };
      }

      if (currentMg + additionalMg >= userGoals.caffeineWarningMg) {
        return {
          allowed: true,
          warning: 'Approaching daily caffeine limit',
          currentMg,
          limitMg,
          remainingMg
        };
      }

      return { allowed: true, currentMg, limitMg, remainingMg };
    },

    // ========================================================================
    // Trends (GET /api/hydration/trends)
    // ========================================================================

    getTrends(userId: string, days: number = 7): HydrationTrend[] {
      const trends: HydrationTrend[] = [];
      const userGoals = this.getGoals(userId);

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const progress = this.getDailyProgress(userId, date);

        trends.push({
          date: progress.date,
          waterOz: progress.totalWaterOz,
          caffeineMg: progress.totalCaffeineMg,
          percentOfGoal: progress.percentOfGoal,
          goalMet: progress.totalWaterOz >= userGoals.dailyWaterOz
        });
      }

      return trends;
    },

    // ========================================================================
    // Beverage Caffeine Info (GET /api/hydration/beverages)
    // ========================================================================

    getBeverageInfo(): Array<{ type: string; caffeinePer8oz: number; description: string }> {
      return [
        { type: 'water', caffeinePer8oz: 0, description: 'Plain water' },
        { type: 'coffee', caffeinePer8oz: 95, description: 'Brewed coffee' },
        { type: 'tea', caffeinePer8oz: 47, description: 'Black/green tea' },
        { type: 'soda', caffeinePer8oz: 45, description: 'Cola drinks' },
        { type: 'juice', caffeinePer8oz: 0, description: 'Fruit juice' },
        { type: 'energy-drink', caffeinePer8oz: 150, description: 'Energy drinks' },
        { type: 'other', caffeinePer8oz: 0, description: 'Other beverages' }
      ];
    },

    // ========================================================================
    // Auto-Calculate Caffeine (GET /api/hydration/estimate-caffeine)
    // ========================================================================

    estimateCaffeine(type: string, amountOz: number): number {
      return calculateCaffeine(type, amountOz);
    },

    // ========================================================================
    // Utility Methods
    // ========================================================================

    clearAll(): void {
      entries.length = 0;
      goals.clear();
    },

    getEntryCount(): number {
      return entries.length;
    }
  };
};

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Hydration API Tests', () => {
  let api: ReturnType<typeof createHydrationApiService>;
  const testUserId = 'user-brandon';

  beforeEach(() => {
    api = createHydrationApiService();
  });

  // ==========================================================================
  // 1. Entry Logging Tests (POST /api/hydration/log)
  // ==========================================================================

  describe('Entry Logging Endpoint', () => {
    it('should log a water entry successfully', async () => {
      const result = await api.logEntry(testUserId, { type: 'water', amountOz: 16 });

      expect(result.success).toBe(true);
      expect(result.entry.type).toBe('water');
      expect(result.entry.amountOz).toBe(16);
      expect(result.entry.caffeineMg).toBe(0);
    });

    it('should log coffee with auto-calculated caffeine', async () => {
      const result = await api.logEntry(testUserId, { type: 'coffee', amountOz: 8 });

      expect(result.entry.caffeineMg).toBe(95); // 95mg per 8oz
    });

    it('should calculate caffeine proportionally for coffee', async () => {
      const result = await api.logEntry(testUserId, { type: 'coffee', amountOz: 16 });

      expect(result.entry.caffeineMg).toBe(190); // 95 * 2
    });

    it('should accept custom caffeine values', async () => {
      const result = await api.logEntry(testUserId, {
        type: 'coffee',
        amountOz: 8,
        caffeineMg: 120
      });

      expect(result.entry.caffeineMg).toBe(120);
    });

    it('should log tea with correct caffeine', async () => {
      const result = await api.logEntry(testUserId, { type: 'tea', amountOz: 8 });

      expect(result.entry.caffeineMg).toBe(47);
    });

    it('should log energy drink with high caffeine', async () => {
      const result = await api.logEntry(testUserId, { type: 'energy-drink', amountOz: 8 });

      expect(result.entry.caffeineMg).toBe(150);
    });

    it('should log soda with moderate caffeine', async () => {
      const result = await api.logEntry(testUserId, { type: 'soda', amountOz: 12 });

      // 45mg per 8oz, so 12oz = 45 * 1.5 = 67.5 ~ 68
      expect(result.entry.caffeineMg).toBe(68);
    });

    it('should log juice with zero caffeine', async () => {
      const result = await api.logEntry(testUserId, { type: 'juice', amountOz: 12 });

      expect(result.entry.caffeineMg).toBe(0);
    });

    it('should include notes when provided', async () => {
      const result = await api.logEntry(testUserId, {
        type: 'water',
        amountOz: 16,
        notes: 'Post-workout hydration'
      });

      expect(result.entry.notes).toBe('Post-workout hydration');
    });

    it('should reject invalid beverage type', async () => {
      await expect(
        api.logEntry(testUserId, { type: 'invalid', amountOz: 16 })
      ).rejects.toThrow('Invalid beverage type');
    });

    it('should reject zero amount', async () => {
      await expect(
        api.logEntry(testUserId, { type: 'water', amountOz: 0 })
      ).rejects.toThrow('Amount must be positive');
    });

    it('should reject negative amount', async () => {
      await expect(
        api.logEntry(testUserId, { type: 'water', amountOz: -8 })
      ).rejects.toThrow('Amount must be positive');
    });

    it('should reject unreasonably large amount', async () => {
      await expect(
        api.logEntry(testUserId, { type: 'water', amountOz: 200 })
      ).rejects.toThrow('Amount exceeds reasonable limit');
    });

    it('should reject missing user ID', async () => {
      await expect(
        api.logEntry('', { type: 'water', amountOz: 16 })
      ).rejects.toThrow('User ID required');
    });

    it('should return updated daily progress', async () => {
      await api.logEntry(testUserId, { type: 'water', amountOz: 32 });
      const result = await api.logEntry(testUserId, { type: 'water', amountOz: 16 });

      expect(result.dailyProgress.totalWaterOz).toBe(48);
      expect(result.dailyProgress.entriesCount).toBe(2);
    });

    it('should generate unique IDs for each entry', async () => {
      const result1 = await api.logEntry(testUserId, { type: 'water', amountOz: 8 });
      const result2 = await api.logEntry(testUserId, { type: 'water', amountOz: 8 });

      expect(result1.entry.id).not.toBe(result2.entry.id);
    });
  });

  // ==========================================================================
  // 2. Quick Log Tests (POST /api/hydration/quick-log)
  // ==========================================================================

  describe('Quick Log Endpoint', () => {
    it('should quick log 8oz water', async () => {
      const entry = await api.quickLogWater(testUserId, 8);

      expect(entry.type).toBe('water');
      expect(entry.amountOz).toBe(8);
    });

    it('should quick log 16oz water', async () => {
      const entry = await api.quickLogWater(testUserId, 16);
      expect(entry.amountOz).toBe(16);
    });

    it('should quick log 24oz water', async () => {
      const entry = await api.quickLogWater(testUserId, 24);
      expect(entry.amountOz).toBe(24);
    });

    it('should quick log 32oz water', async () => {
      const entry = await api.quickLogWater(testUserId, 32);
      expect(entry.amountOz).toBe(32);
    });

    it('should update daily progress after quick log', async () => {
      await api.quickLogWater(testUserId, 16);
      await api.quickLogWater(testUserId, 32);

      const progress = api.getDailyProgress(testUserId);
      expect(progress.totalWaterOz).toBe(48);
    });
  });

  // ==========================================================================
  // 3. Goal Calculation Tests
  // ==========================================================================

  describe('Goal Calculation from Body Weight', () => {
    it('should calculate goal for Brandon (250 lbs / 2 = 125 oz)', () => {
      const result = api.calculateGoalFromWeight(250);

      expect(result.dailyWaterOz).toBe(125);
      expect(result.formula).toContain('250');
      expect(result.formula).toContain('125');
    });

    it('should calculate goal for 180 lbs person', () => {
      const result = api.calculateGoalFromWeight(180);
      expect(result.dailyWaterOz).toBe(90);
    });

    it('should calculate goal for 150 lbs person', () => {
      const result = api.calculateGoalFromWeight(150);
      expect(result.dailyWaterOz).toBe(75);
    });

    it('should round to nearest whole number', () => {
      const result = api.calculateGoalFromWeight(155);
      expect(result.dailyWaterOz).toBe(78); // 77.5 rounds to 78
    });

    it('should reject weight below 50 lbs', () => {
      expect(() => api.calculateGoalFromWeight(30)).toThrow('Weight too low');
    });

    it('should reject weight above 500 lbs', () => {
      expect(() => api.calculateGoalFromWeight(600)).toThrow('Weight too high');
    });
  });

  // ==========================================================================
  // 4. Daily Progress Calculation Tests
  // ==========================================================================

  describe('Daily Progress Calculation', () => {
    it('should return zero progress for no entries', () => {
      const progress = api.getDailyProgress(testUserId);

      expect(progress.totalWaterOz).toBe(0);
      expect(progress.totalCaffeineMg).toBe(0);
      expect(progress.percentOfGoal).toBe(0);
      expect(progress.entriesCount).toBe(0);
    });

    it('should calculate cumulative water intake', async () => {
      await api.logEntry(testUserId, { type: 'water', amountOz: 16 });
      await api.logEntry(testUserId, { type: 'water', amountOz: 24 });
      await api.logEntry(testUserId, { type: 'coffee', amountOz: 8 });

      const progress = api.getDailyProgress(testUserId);
      expect(progress.totalWaterOz).toBe(48); // 16 + 24 + 8
    });

    it('should calculate cumulative caffeine', async () => {
      await api.logEntry(testUserId, { type: 'coffee', amountOz: 8 }); // 95mg
      await api.logEntry(testUserId, { type: 'tea', amountOz: 8 }); // 47mg

      const progress = api.getDailyProgress(testUserId);
      expect(progress.totalCaffeineMg).toBe(142);
    });

    it('should calculate percent of goal correctly', async () => {
      api.setGoals(testUserId, { dailyWaterOz: 100 });
      await api.logEntry(testUserId, { type: 'water', amountOz: 50 });

      const progress = api.getDailyProgress(testUserId);
      expect(progress.percentOfGoal).toBe(50);
    });

    it('should show 100% when goal is met', async () => {
      api.setGoals(testUserId, { dailyWaterOz: 64 });
      await api.logEntry(testUserId, { type: 'water', amountOz: 64 });

      const progress = api.getDailyProgress(testUserId);
      expect(progress.percentOfGoal).toBe(100);
    });

    it('should show over 100% when goal is exceeded', async () => {
      api.setGoals(testUserId, { dailyWaterOz: 64 });
      await api.logEntry(testUserId, { type: 'water', amountOz: 80 });

      const progress = api.getDailyProgress(testUserId);
      expect(progress.percentOfGoal).toBe(125);
    });
  });

  // ==========================================================================
  // 5. Caffeine Limit Enforcement Tests
  // ==========================================================================

  describe('Caffeine Limit Enforcement', () => {
    it('should show safe status below warning threshold', async () => {
      await api.logEntry(testUserId, { type: 'coffee', amountOz: 8 }); // 95mg

      const progress = api.getDailyProgress(testUserId);
      expect(progress.caffeineStatus).toBe('safe');
    });

    it('should show warning at 300mg threshold', async () => {
      api.setGoals(testUserId, { maxCaffeineMg: 400, caffeineWarningMg: 300 });
      await api.logEntry(testUserId, { type: 'coffee', amountOz: 8, caffeineMg: 300 });

      const progress = api.getDailyProgress(testUserId);
      expect(progress.caffeineStatus).toBe('warning');
    });

    it('should show limit at 400mg', async () => {
      api.setGoals(testUserId, { maxCaffeineMg: 400, caffeineWarningMg: 300 });
      await api.logEntry(testUserId, { type: 'coffee', amountOz: 8, caffeineMg: 400 });

      const progress = api.getDailyProgress(testUserId);
      expect(progress.caffeineStatus).toBe('limit');
    });

    it('should show exceeded above 400mg', async () => {
      api.setGoals(testUserId, { maxCaffeineMg: 400, caffeineWarningMg: 300 });
      await api.logEntry(testUserId, { type: 'coffee', amountOz: 8, caffeineMg: 450 });

      const progress = api.getDailyProgress(testUserId);
      expect(progress.caffeineStatus).toBe('exceeded');
    });

    it('should check if additional caffeine is allowed', () => {
      const result = api.checkCaffeine(testUserId, 95);

      expect(result.allowed).toBe(true);
      expect(result.remainingMg).toBe(400);
    });

    it('should warn when approaching limit', async () => {
      await api.logEntry(testUserId, { type: 'coffee', amountOz: 8, caffeineMg: 250 });

      const result = api.checkCaffeine(testUserId, 100);
      expect(result.allowed).toBe(true);
      expect(result.warning).toContain('Approaching');
    });

    it('should reject caffeine exceeding limit', async () => {
      await api.logEntry(testUserId, { type: 'coffee', amountOz: 8, caffeineMg: 350 });

      const result = api.checkCaffeine(testUserId, 100);
      expect(result.allowed).toBe(false);
      expect(result.warning).toContain('exceed');
    });
  });

  // ==========================================================================
  // 6. Trends Calculation Tests
  // ==========================================================================

  describe('Trends Calculation', () => {
    it('should return 7 days of trends by default', () => {
      const trends = api.getTrends(testUserId);
      expect(trends).toHaveLength(7);
    });

    it('should return custom number of days', () => {
      const trends = api.getTrends(testUserId, 14);
      expect(trends).toHaveLength(14);
    });

    it('should include today in trends', async () => {
      await api.logEntry(testUserId, { type: 'water', amountOz: 64 });

      const trends = api.getTrends(testUserId);
      const today = trends[trends.length - 1];

      expect(today.waterOz).toBe(64);
    });

    it('should indicate when goal was met', async () => {
      api.setGoals(testUserId, { dailyWaterOz: 64 });
      await api.logEntry(testUserId, { type: 'water', amountOz: 70 });

      const trends = api.getTrends(testUserId);
      const today = trends[trends.length - 1];

      expect(today.goalMet).toBe(true);
    });

    it('should indicate when goal was not met', () => {
      api.setGoals(testUserId, { dailyWaterOz: 125 });

      const trends = api.getTrends(testUserId);
      const today = trends[trends.length - 1];

      expect(today.goalMet).toBe(false);
    });
  });

  // ==========================================================================
  // 7. Entry Management Tests
  // ==========================================================================

  describe('Entry Management', () => {
    it('should retrieve entry by ID', async () => {
      const result = await api.logEntry(testUserId, { type: 'water', amountOz: 16 });
      const entry = api.getEntry(testUserId, result.entry.id);

      expect(entry).not.toBeNull();
      expect(entry?.amountOz).toBe(16);
    });

    it('should return null for non-existent entry', () => {
      const entry = api.getEntry(testUserId, 'non-existent');
      expect(entry).toBeNull();
    });

    it('should not return entry for different user', async () => {
      const result = await api.logEntry(testUserId, { type: 'water', amountOz: 16 });
      const entry = api.getEntry('other-user', result.entry.id);

      expect(entry).toBeNull();
    });

    it('should delete entry successfully', async () => {
      const result = await api.logEntry(testUserId, { type: 'water', amountOz: 16 });
      const deleteResult = api.deleteEntry(testUserId, result.entry.id);

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.undoToken).toBeDefined();
    });

    it('should provide undo token on delete', async () => {
      const result = await api.logEntry(testUserId, { type: 'water', amountOz: 16 });
      const deleteResult = api.deleteEntry(testUserId, result.entry.id);

      expect(deleteResult.undoToken).toBeTruthy();
    });

    it('should undo delete within time window', async () => {
      const result = await api.logEntry(testUserId, { type: 'water', amountOz: 16 });
      const deleteResult = api.deleteEntry(testUserId, result.entry.id);
      const undoResult = api.undoDelete(deleteResult.undoToken!);

      expect(undoResult.success).toBe(true);
      expect(undoResult.entry?.amountOz).toBe(16);
    });

    it('should fail delete for non-existent entry', () => {
      const result = api.deleteEntry(testUserId, 'non-existent');
      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // 8. Goal Management Tests
  // ==========================================================================

  describe('Goal Management', () => {
    it('should return default goals', () => {
      const goals = api.getGoals(testUserId);

      expect(goals.dailyWaterOz).toBe(125);
      expect(goals.maxCaffeineMg).toBe(400);
      expect(goals.caffeineWarningMg).toBe(300);
    });

    it('should update water goal', () => {
      const updated = api.setGoals(testUserId, { dailyWaterOz: 100 });
      expect(updated.dailyWaterOz).toBe(100);
    });

    it('should update caffeine limit', () => {
      const updated = api.setGoals(testUserId, { maxCaffeineMg: 500, caffeineWarningMg: 400 });
      expect(updated.maxCaffeineMg).toBe(500);
    });

    it('should reject water goal below minimum', () => {
      expect(() => api.setGoals(testUserId, { dailyWaterOz: 20 }))
        .toThrow('Daily water goal too low');
    });

    it('should reject water goal above maximum', () => {
      expect(() => api.setGoals(testUserId, { dailyWaterOz: 300 }))
        .toThrow('Daily water goal too high');
    });

    it('should reject negative caffeine limit', () => {
      expect(() => api.setGoals(testUserId, { maxCaffeineMg: -100 }))
        .toThrow('Caffeine limit cannot be negative');
    });

    it('should reject caffeine limit above 600mg', () => {
      expect(() => api.setGoals(testUserId, { maxCaffeineMg: 700 }))
        .toThrow('Caffeine limit too high');
    });

    it('should reject warning >= limit', () => {
      expect(() => api.setGoals(testUserId, {
        maxCaffeineMg: 300,
        caffeineWarningMg: 300
      })).toThrow('Warning threshold must be below limit');
    });
  });

  // ==========================================================================
  // 9. Beverage Information Tests
  // ==========================================================================

  describe('Beverage Information', () => {
    it('should list all beverage types', () => {
      const info = api.getBeverageInfo();

      expect(info.length).toBe(7);
      expect(info.map(b => b.type)).toContain('water');
      expect(info.map(b => b.type)).toContain('coffee');
    });

    it('should show water has zero caffeine', () => {
      const info = api.getBeverageInfo();
      const water = info.find(b => b.type === 'water');

      expect(water?.caffeinePer8oz).toBe(0);
    });

    it('should show coffee has 95mg per 8oz', () => {
      const info = api.getBeverageInfo();
      const coffee = info.find(b => b.type === 'coffee');

      expect(coffee?.caffeinePer8oz).toBe(95);
    });

    it('should estimate caffeine correctly', () => {
      expect(api.estimateCaffeine('coffee', 8)).toBe(95);
      expect(api.estimateCaffeine('coffee', 16)).toBe(190);
      expect(api.estimateCaffeine('tea', 8)).toBe(47);
      expect(api.estimateCaffeine('water', 32)).toBe(0);
    });
  });

  // ==========================================================================
  // 10. Edge Cases and Validation
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle multiple users independently', async () => {
      await api.logEntry('user-1', { type: 'water', amountOz: 32 });
      await api.logEntry('user-2', { type: 'water', amountOz: 64 });

      const progress1 = api.getDailyProgress('user-1');
      const progress2 = api.getDailyProgress('user-2');

      expect(progress1.totalWaterOz).toBe(32);
      expect(progress2.totalWaterOz).toBe(64);
    });

    it('should handle clearing all data', async () => {
      await api.logEntry(testUserId, { type: 'water', amountOz: 32 });
      api.clearAll();

      expect(api.getEntryCount()).toBe(0);
    });

    it('should handle boundary amount of 128oz', async () => {
      const result = await api.logEntry(testUserId, { type: 'water', amountOz: 128 });
      expect(result.entry.amountOz).toBe(128);
    });

    it('should handle decimal amounts by rounding caffeine', async () => {
      const result = await api.logEntry(testUserId, { type: 'coffee', amountOz: 6 });
      // 95mg/8oz * 6oz = 71.25, should round to 71
      expect(result.entry.caffeineMg).toBe(71);
    });
  });
});
