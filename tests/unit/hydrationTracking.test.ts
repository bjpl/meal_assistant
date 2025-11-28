/**
 * Unit Tests: Hydration Tracking
 * Tests for water intake, caffeine monitoring, and hydration goals
 * Target: 90% coverage
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Types
interface HydrationEntry {
  id: string;
  type: 'water' | 'coffee' | 'tea' | 'soda' | 'juice' | 'other';
  amountOz: number;
  caffeineMs?: number;
  timestamp: Date;
}

interface HydrationGoals {
  dailyWaterOz: number;
  maxCaffeineMg: number;
  caffeineWarningMg: number;
}

interface HydrationProgress {
  totalWaterOz: number;
  totalCaffeineMg: number;
  percentOfGoal: number;
  caffeineStatus: 'safe' | 'warning' | 'limit';
  entriesCount: number;
}

// Hydration Service
const createHydrationService = () => {
  const entries: HydrationEntry[] = [];
  let goals: HydrationGoals = {
    dailyWaterOz: 125, // For 250lb person
    maxCaffeineMg: 400,
    caffeineWarningMg: 300
  };

  const beverageCaffeine: Record<string, number> = {
    'coffee': 95,
    'tea': 47,
    'soda': 45,
    'energy-drink': 150
  };

  return {
    logEntry(entry: Omit<HydrationEntry, 'id' | 'timestamp'>): HydrationEntry {
      const newEntry: HydrationEntry = {
        ...entry,
        id: `hydration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      };
      entries.push(newEntry);
      return newEntry;
    },

    logWater(amountOz: number): HydrationEntry {
      return this.logEntry({ type: 'water', amountOz });
    },

    logCoffee(amountOz: number, caffeineMs?: number): HydrationEntry {
      const caffeine = caffeineMs ?? Math.round(amountOz * 95 / 8); // ~95mg per 8oz
      return this.logEntry({ type: 'coffee', amountOz, caffeineMs: caffeine });
    },

    logTea(amountOz: number): HydrationEntry {
      const caffeine = Math.round(amountOz * 47 / 8); // ~47mg per 8oz
      return this.logEntry({ type: 'tea', amountOz, caffeineMs: caffeine });
    },

    getEntry(id: string): HydrationEntry | undefined {
      return entries.find(e => e.id === id);
    },

    deleteEntry(id: string): boolean {
      const index = entries.findIndex(e => e.id === id);
      if (index === -1) return false;
      entries.splice(index, 1);
      return true;
    },

    getTodayEntries(): HydrationEntry[] {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return entries.filter(e => e.timestamp >= today);
    },

    getDailyProgress(date: Date = new Date()): HydrationProgress {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const dayEntries = entries.filter(e =>
        e.timestamp >= startOfDay && e.timestamp <= endOfDay
      );

      const totalWaterOz = dayEntries.reduce((sum, e) => sum + e.amountOz, 0);
      const totalCaffeineMg = dayEntries.reduce((sum, e) => sum + (e.caffeineMs || 0), 0);

      let caffeineStatus: 'safe' | 'warning' | 'limit' = 'safe';
      if (totalCaffeineMg >= goals.maxCaffeineMg) {
        caffeineStatus = 'limit';
      } else if (totalCaffeineMg >= goals.caffeineWarningMg) {
        caffeineStatus = 'warning';
      }

      return {
        totalWaterOz,
        totalCaffeineMg,
        percentOfGoal: Math.round((totalWaterOz / goals.dailyWaterOz) * 100),
        caffeineStatus,
        entriesCount: dayEntries.length
      };
    },

    setGoals(newGoals: Partial<HydrationGoals>): HydrationGoals {
      goals = { ...goals, ...newGoals };
      return goals;
    },

    getGoals(): HydrationGoals {
      return { ...goals };
    },

    calculateGoalFromWeight(weightLbs: number): number {
      return Math.round(weightLbs / 2);
    },

    getRemainingWater(): number {
      const progress = this.getDailyProgress();
      return Math.max(0, goals.dailyWaterOz - progress.totalWaterOz);
    },

    getRemainingCaffeine(): number {
      const progress = this.getDailyProgress();
      return Math.max(0, goals.maxCaffeineMg - progress.totalCaffeineMg);
    },

    canHaveCaffeine(amountMg: number): { allowed: boolean; warning?: string } {
      const remaining = this.getRemainingCaffeine();

      if (amountMg > remaining) {
        return {
          allowed: false,
          warning: `Would exceed daily limit by ${amountMg - remaining}mg`
        };
      }

      const progress = this.getDailyProgress();
      if (progress.totalCaffeineMg + amountMg >= goals.caffeineWarningMg) {
        return {
          allowed: true,
          warning: 'Approaching daily caffeine limit'
        };
      }

      return { allowed: true };
    },

    getHourlyBreakdown(date: Date = new Date()): Array<{ hour: number; waterOz: number; caffeineMg: number }> {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const dayEntries = entries.filter(e =>
        e.timestamp >= startOfDay && e.timestamp <= endOfDay
      );

      const hourly: Array<{ hour: number; waterOz: number; caffeineMg: number }> = [];

      for (let hour = 0; hour < 24; hour++) {
        const hourEntries = dayEntries.filter(e => e.timestamp.getHours() === hour);

        hourly.push({
          hour,
          waterOz: hourEntries.reduce((sum, e) => sum + e.amountOz, 0),
          caffeineMg: hourEntries.reduce((sum, e) => sum + (e.caffeineMs || 0), 0)
        });
      }

      return hourly;
    },

    getWeeklyTrend(): Array<{ date: string; waterOz: number; percentOfGoal: number }> {
      const trend: Array<{ date: string; waterOz: number; percentOfGoal: number }> = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const progress = this.getDailyProgress(date);

        trend.push({
          date: date.toISOString().split('T')[0],
          waterOz: progress.totalWaterOz,
          percentOfGoal: progress.percentOfGoal
        });
      }

      return trend;
    },

    getReminders(): Array<{ time: string; message: string }> {
      const remaining = this.getRemainingWater();
      const hoursLeft = 24 - new Date().getHours();
      const perHour = remaining / Math.max(1, hoursLeft);

      const reminders: Array<{ time: string; message: string }> = [];

      if (remaining > 0) {
        reminders.push({
          time: 'now',
          message: `${remaining}oz remaining today. Aim for ${Math.round(perHour)}oz per hour.`
        });
      }

      if (this.getRemainingCaffeine() < 100) {
        reminders.push({
          time: 'now',
          message: 'Approaching caffeine limit. Consider decaf alternatives.'
        });
      }

      return reminders;
    },

    getBeverageTypes(): Array<{ type: string; caffeine: number }> {
      return [
        { type: 'water', caffeine: 0 },
        { type: 'coffee', caffeine: 95 },
        { type: 'tea', caffeine: 47 },
        { type: 'soda', caffeine: 45 },
        { type: 'juice', caffeine: 0 },
        { type: 'other', caffeine: 0 }
      ];
    },

    estimateCaffeineForBeverage(type: string, amountOz: number): number {
      const perOz: Record<string, number> = {
        'coffee': 95 / 8,
        'tea': 47 / 8,
        'soda': 45 / 12,
        'energy-drink': 150 / 8
      };
      return Math.round((perOz[type] || 0) * amountOz);
    },

    clearEntries(): void {
      entries.length = 0;
    }
  };
};

describe('Hydration Tracking', () => {
  let service: ReturnType<typeof createHydrationService>;

  beforeEach(() => {
    service = createHydrationService();
  });

  describe('Entry Logging', () => {
    it('should log water entry', () => {
      const entry = service.logWater(16);

      expect(entry).toHaveProperty('id');
      expect(entry.type).toBe('water');
      expect(entry.amountOz).toBe(16);
    });

    it('should log coffee with caffeine', () => {
      const entry = service.logCoffee(8);

      expect(entry.type).toBe('coffee');
      expect(entry.caffeineMs).toBeGreaterThan(0);
    });

    it('should log coffee with custom caffeine', () => {
      const entry = service.logCoffee(8, 120);

      expect(entry.caffeineMs).toBe(120);
    });

    it('should log tea', () => {
      const entry = service.logTea(8);

      expect(entry.type).toBe('tea');
      expect(entry.caffeineMs).toBeGreaterThan(0);
      expect(entry.caffeineMs).toBeLessThan(60); // Tea has less caffeine than coffee
    });

    it('should log generic entry', () => {
      const entry = service.logEntry({
        type: 'juice',
        amountOz: 12
      });

      expect(entry.type).toBe('juice');
      expect(entry.amountOz).toBe(12);
    });

    it('should get entry by ID', () => {
      const logged = service.logWater(16);
      const retrieved = service.getEntry(logged.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.amountOz).toBe(16);
    });

    it('should delete entry', () => {
      const entry = service.logWater(16);
      const deleted = service.deleteEntry(entry.id);

      expect(deleted).toBe(true);
      expect(service.getEntry(entry.id)).toBeUndefined();
    });
  });

  describe('Daily Progress', () => {
    it('should calculate daily progress', () => {
      service.logWater(16);
      service.logWater(16);
      service.logCoffee(8);

      const progress = service.getDailyProgress();

      expect(progress.totalWaterOz).toBe(40);
      expect(progress.totalCaffeineMg).toBeGreaterThan(0);
      expect(progress.entriesCount).toBe(3);
    });

    it('should calculate percent of goal', () => {
      service.setGoals({ dailyWaterOz: 100 });
      service.logWater(50);

      const progress = service.getDailyProgress();

      expect(progress.percentOfGoal).toBe(50);
    });

    it('should identify caffeine warning status', () => {
      service.setGoals({ maxCaffeineMg: 400, caffeineWarningMg: 300 });

      // Log enough coffee to reach warning threshold
      service.logCoffee(16); // ~190mg
      service.logCoffee(16); // ~190mg more = ~380mg total

      const progress = service.getDailyProgress();

      expect(progress.caffeineStatus).toBe('warning');
    });

    it('should identify caffeine limit status', () => {
      service.setGoals({ maxCaffeineMg: 400, caffeineWarningMg: 300 });

      // Log enough coffee to exceed limit
      service.logCoffee(16);
      service.logCoffee(16);
      service.logCoffee(16); // ~570mg total

      const progress = service.getDailyProgress();

      expect(progress.caffeineStatus).toBe('limit');
    });

    it('should get today entries', () => {
      service.logWater(8);
      service.logWater(8);

      const today = service.getTodayEntries();

      expect(today).toHaveLength(2);
    });
  });

  describe('Goals Management', () => {
    it('should set and get goals', () => {
      service.setGoals({ dailyWaterOz: 150 });

      const goals = service.getGoals();

      expect(goals.dailyWaterOz).toBe(150);
    });

    it('should calculate goal from weight', () => {
      const goal = service.calculateGoalFromWeight(250);

      expect(goal).toBe(125);
    });

    it('should calculate remaining water', () => {
      service.setGoals({ dailyWaterOz: 100 });
      service.logWater(40);

      const remaining = service.getRemainingWater();

      expect(remaining).toBe(60);
    });

    it('should not return negative remaining', () => {
      service.setGoals({ dailyWaterOz: 50 });
      service.logWater(80);

      const remaining = service.getRemainingWater();

      expect(remaining).toBe(0);
    });

    it('should calculate remaining caffeine', () => {
      service.setGoals({ maxCaffeineMg: 400 });
      service.logCoffee(8); // ~95mg

      const remaining = service.getRemainingCaffeine();

      expect(remaining).toBeLessThan(400);
      expect(remaining).toBeGreaterThan(300);
    });
  });

  describe('Caffeine Checks', () => {
    it('should allow caffeine within limit', () => {
      const result = service.canHaveCaffeine(95);

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('should warn when approaching limit', () => {
      service.logCoffee(16); // ~190mg
      service.logCoffee(8); // ~95mg more = ~285mg

      const result = service.canHaveCaffeine(95);

      expect(result.allowed).toBe(true);
      expect(result.warning).toContain('Approaching');
    });

    it('should reject caffeine exceeding limit', () => {
      service.setGoals({ maxCaffeineMg: 300 });
      service.logCoffee(16); // ~190mg
      service.logCoffee(16); // ~190mg more = ~380mg total

      const result = service.canHaveCaffeine(95);

      expect(result.allowed).toBe(false);
      expect(result.warning).toContain('exceed');
    });
  });

  describe('Analytics', () => {
    it('should get hourly breakdown', () => {
      service.logWater(8);

      const breakdown = service.getHourlyBreakdown();

      expect(breakdown).toHaveLength(24);
      const currentHour = breakdown.find(h => h.waterOz > 0);
      expect(currentHour).toBeDefined();
    });

    it('should get weekly trend', () => {
      service.logWater(64);

      const trend = service.getWeeklyTrend();

      expect(trend).toHaveLength(7);
      expect(trend[6].waterOz).toBe(64); // Today
    });

    it('should generate reminders', () => {
      service.setGoals({ dailyWaterOz: 100 });
      service.logWater(20);

      const reminders = service.getReminders();

      expect(reminders.length).toBeGreaterThan(0);
      expect(reminders[0].message).toContain('remaining');
    });
  });

  describe('Beverage Information', () => {
    it('should list beverage types', () => {
      const types = service.getBeverageTypes();

      expect(types.length).toBeGreaterThan(0);
      expect(types.find(t => t.type === 'water')?.caffeine).toBe(0);
      expect(types.find(t => t.type === 'coffee')?.caffeine).toBeGreaterThan(0);
    });

    it('should estimate caffeine for beverages', () => {
      const coffeeCaffeine = service.estimateCaffeineForBeverage('coffee', 8);
      const waterCaffeine = service.estimateCaffeineForBeverage('water', 16);

      expect(coffeeCaffeine).toBeGreaterThan(0);
      expect(waterCaffeine).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle clearing entries', () => {
      service.logWater(16);
      service.logWater(16);

      service.clearEntries();

      expect(service.getTodayEntries()).toHaveLength(0);
    });

    it('should handle zero water logged', () => {
      const progress = service.getDailyProgress();

      expect(progress.totalWaterOz).toBe(0);
      expect(progress.percentOfGoal).toBe(0);
      expect(progress.caffeineStatus).toBe('safe');
    });

    it('should handle deleting non-existent entry', () => {
      const deleted = service.deleteEntry('non-existent');

      expect(deleted).toBe(false);
    });

    it('should return undefined for non-existent entry', () => {
      const entry = service.getEntry('non-existent');

      expect(entry).toBeUndefined();
    });
  });
});
