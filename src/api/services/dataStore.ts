/**
 * In-Memory Data Store Service
 * Simulates database operations for the API
 * In production, replace with actual database (PostgreSQL, MongoDB, etc.)
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Type Definitions
export interface UserProfile {
  name: string | null;
  weight: number;
  height: number;
  targetCalories: number;
  targetProtein: number;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  password: string;
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface Meal {
  id: string;
  userId: string;
  index: number;
  name: string;
  time: string;
  calories: number;
  protein: number;
  status: string;
  actualCalories?: number | null;
  actualProtein?: number | null;
  rating?: number | null;
  logged?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  patternId?: string;
  substitutions?: Array<{
    original: string;
    replacement: string;
    reason?: string;
    calorieAdjustment?: number;
    proteinAdjustment?: number;
    timestamp: string;
  }>;
}

export interface Pattern {
  id: string;
  userId: string;
  date: string;
  patternType: string;
  meals: Meal[];
  updatedAt?: string;
}

export interface InventoryItem {
  id: string;
  userId: string;
  category?: string;
  location?: string;
  expiryDate?: string;
  quantity: number;
  updatedAt?: string;
}

export interface PrepSession {
  id: string;
  userId: string;
  date: string;
  status?: string;
  tasks: PrepTask[];
  updatedAt?: string;
}

export interface PrepTask {
  id: string;
  [key: string]: any;
}

export interface ShoppingList {
  id: string;
  userId: string;
  weekOf: string;
  status?: string;
  items: ShoppingItem[];
  totalActual: number;
  updatedAt?: string;
}

export interface ShoppingItem {
  id: string;
  purchased?: boolean;
  actualPrice?: number;
  purchasedAt?: string | null;
  [key: string]: any;
}

export interface Equipment {
  id: string;
  userId: string;
  name: string;
  state: string;
  stateChangedAt?: string;
  updatedAt?: string;
}

export interface HydrationLog {
  id: string;
  userId: string;
  loggedAt: string;
  amountOz: number;
  beverageType: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HydrationGoals {
  id: string;
  userId: string;
  dailyWaterOz: number;
  dailyCaffeineLimitMg: number;
  personalizedFormulaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CaffeineLog {
  id: string;
  userId: string;
  loggedAt: string;
  beverageType: string;
  volumeOz: number;
  caffeineMg: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FindByUserOptions {
  startDate?: string;
  endDate?: string;
  category?: string;
  location?: string;
  date?: string;
  status?: string;
}

// In-memory storage
const store: {
  users: Map<string, User>;
  patterns: Map<string, Pattern>;
  meals: Map<string, Meal>;
  inventory: Map<string, InventoryItem>;
  prepSessions: Map<string, PrepSession>;
  shoppingLists: Map<string, ShoppingList>;
  equipment: Map<string, Equipment>;
  analytics: Map<string, any>;
  hydrationLogs?: Map<string, HydrationLog>;
  hydrationGoals?: Map<string, HydrationGoals>;
  caffeineLogs?: Map<string, CaffeineLog>;
} = {
  users: new Map(),
  patterns: new Map(),
  meals: new Map(),
  inventory: new Map(),
  prepSessions: new Map(),
  shoppingLists: new Map(),
  equipment: new Map(),
  analytics: new Map()
};

// Helper to filter by userId
function filterByUser<T extends { userId: string }>(map: Map<string, T>, userId: string): T[] {
  return Array.from(map.values()).filter(item => item.userId === userId);
}

// User operations
export const userService = {
  async create(email: string, password: string, profile: Partial<UserProfile> = {}): Promise<Omit<User, 'password'>> {
    const existing = Array.from(store.users.values()).find(u => u.email === email);
    if (existing) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user: User = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      profile: {
        name: profile.name || null,
        weight: profile.weight || 250,
        height: profile.height || 70,
        targetCalories: profile.targetCalories || 1800,
        targetProtein: profile.targetProtein || 135,
        createdAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    store.users.set(user.id, user);
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  async findByEmail(email: string): Promise<User | undefined> {
    return Array.from(store.users.values()).find(u => u.email === email);
  },

  async findById(id: string): Promise<Omit<User, 'password'> | null> {
    const user = store.users.get(id);
    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    return null;
  },

  async verifyPassword(email: string, password: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password);
    if (valid) {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    return null;
  }
};

// Pattern operations
export const patternService = {
  create(pattern: Pattern): Pattern {
    store.patterns.set(pattern.id, pattern);
    // Also index individual meals
    pattern.meals.forEach(meal => {
      store.meals.set(meal.id, { ...meal, patternId: pattern.id, userId: pattern.userId });
    });
    return pattern;
  },

  findById(id: string): Pattern | null {
    return store.patterns.get(id) || null;
  },

  findByUserAndDate(userId: string, date: string): Pattern | undefined {
    return Array.from(store.patterns.values())
      .find(p => p.userId === userId && p.date === date);
  },

  findByUser(userId: string, options: FindByUserOptions = {}): Pattern[] {
    let patterns = filterByUser(store.patterns, userId);

    if (options.startDate) {
      patterns = patterns.filter(p => p.date >= options.startDate!);
    }
    if (options.endDate) {
      patterns = patterns.filter(p => p.date <= options.endDate!);
    }

    return patterns.sort((a, b) => b.date.localeCompare(a.date));
  },

  update(id: string, updates: Partial<Pattern>): Pattern | null {
    const pattern = store.patterns.get(id);
    if (!pattern) return null;

    const updated = {
      ...pattern,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    store.patterns.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    const pattern = store.patterns.get(id);
    if (pattern) {
      pattern.meals.forEach(meal => store.meals.delete(meal.id));
      store.patterns.delete(id);
      return true;
    }
    return false;
  }
};

// Meal operations
export const mealService = {
  findById(id: string): Meal | null {
    return store.meals.get(id) || null;
  },

  findByPattern(patternId: string): Meal[] {
    return Array.from(store.meals.values())
      .filter(m => m.patternId === patternId)
      .sort((a, b) => a.index - b.index);
  },

  findTodayMeals(userId: string): Meal[] {
    const today = new Date().toISOString().split('T')[0];
    const pattern = patternService.findByUserAndDate(userId, today);
    return pattern ? pattern.meals : [];
  },

  update(id: string, updates: Partial<Meal>): Meal | null {
    const meal = store.meals.get(id);
    if (!meal) return null;

    const updated = {
      ...meal,
      ...updates,
      logged: updates.status ? new Date().toISOString() : meal.logged
    };
    store.meals.set(id, updated);

    // Also update in pattern
    const pattern = store.patterns.get(meal.patternId!);
    if (pattern) {
      const mealIndex = pattern.meals.findIndex(m => m.id === id);
      if (mealIndex >= 0) {
        pattern.meals[mealIndex] = updated;
        store.patterns.set(pattern.id, pattern);
      }
    }

    return updated;
  }
};

// Inventory operations
export const inventoryService = {
  create(item: InventoryItem): InventoryItem {
    store.inventory.set(item.id, item);
    return item;
  },

  createBatch(items: InventoryItem[]): InventoryItem[] {
    items.forEach(item => store.inventory.set(item.id, item));
    return items;
  },

  findById(id: string): InventoryItem | null {
    return store.inventory.get(id) || null;
  },

  findByUser(userId: string, options: FindByUserOptions = {}): InventoryItem[] {
    let items = filterByUser(store.inventory, userId);

    if (options.category) {
      items = items.filter(i => i.category === options.category);
    }
    if (options.location) {
      items = items.filter(i => i.location === options.location);
    }

    return items;
  },

  findExpiring(userId: string, hoursAhead: number = 48): InventoryItem[] {
    const threshold = new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
    return filterByUser(store.inventory, userId)
      .filter(i => i.expiryDate && i.expiryDate <= threshold && i.quantity > 0);
  },

  update(id: string, updates: Partial<InventoryItem>): InventoryItem | null {
    const item = store.inventory.get(id);
    if (!item) return null;

    const updated = {
      ...item,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    store.inventory.set(id, updated);
    return updated;
  },

  consume(id: string, quantity: number): InventoryItem | null {
    const item = store.inventory.get(id);
    if (!item) return null;

    const newQuantity = Math.max(0, item.quantity - quantity);
    return this.update(id, { quantity: newQuantity });
  },

  delete(id: string): boolean {
    return store.inventory.delete(id);
  }
};

// Prep session operations
export const prepService = {
  create(session: PrepSession): PrepSession {
    store.prepSessions.set(session.id, session);
    return session;
  },

  findById(id: string): PrepSession | null {
    return store.prepSessions.get(id) || null;
  },

  findByUser(userId: string, options: FindByUserOptions = {}): PrepSession[] {
    let sessions = filterByUser(store.prepSessions, userId);

    if (options.date) {
      sessions = sessions.filter(s => s.date === options.date);
    }
    if (options.status) {
      sessions = sessions.filter(s => s.status === options.status);
    }

    return sessions.sort((a, b) => b.date.localeCompare(a.date));
  },

  update(id: string, updates: Partial<PrepSession>): PrepSession | null {
    const session = store.prepSessions.get(id);
    if (!session) return null;

    const updated = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    store.prepSessions.set(id, updated);
    return updated;
  },

  updateTask(sessionId: string, taskId: string, updates: Partial<PrepTask>): PrepTask | null {
    const session = store.prepSessions.get(sessionId);
    if (!session) return null;

    const taskIndex = session.tasks.findIndex(t => t.id === taskId);
    if (taskIndex < 0) return null;

    session.tasks[taskIndex] = {
      ...session.tasks[taskIndex],
      ...updates
    };
    session.updatedAt = new Date().toISOString();
    store.prepSessions.set(sessionId, session);

    return session.tasks[taskIndex];
  }
};

// Shopping list operations
export const shoppingService = {
  create(list: ShoppingList): ShoppingList {
    store.shoppingLists.set(list.id, list);
    return list;
  },

  findById(id: string): ShoppingList | null {
    return store.shoppingLists.get(id) || null;
  },

  findByUser(userId: string, options: FindByUserOptions = {}): ShoppingList[] {
    let lists = filterByUser(store.shoppingLists, userId);

    if (options.status) {
      lists = lists.filter(l => l.status === options.status);
    }

    return lists.sort((a, b) => b.weekOf.localeCompare(a.weekOf));
  },

  update(id: string, updates: Partial<ShoppingList>): ShoppingList | null {
    const list = store.shoppingLists.get(id);
    if (!list) return null;

    const updated = {
      ...list,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    store.shoppingLists.set(id, updated);
    return updated;
  },

  updateItem(listId: string, itemId: string, updates: Partial<ShoppingItem>): ShoppingItem | null {
    const list = store.shoppingLists.get(listId);
    if (!list) return null;

    const itemIndex = list.items.findIndex(i => i.id === itemId);
    if (itemIndex < 0) return null;

    list.items[itemIndex] = {
      ...list.items[itemIndex],
      ...updates,
      purchasedAt: updates.purchased ? new Date().toISOString() : null
    };
    list.updatedAt = new Date().toISOString();

    // Recalculate total actual
    list.totalActual = list.items
      .filter(i => i.purchased && i.actualPrice)
      .reduce((sum, i) => sum + i.actualPrice!, 0);

    store.shoppingLists.set(listId, list);
    return list.items[itemIndex];
  },

  delete(id: string): boolean {
    return store.shoppingLists.delete(id);
  }
};

// Equipment operations
export const equipmentService = {
  create(equipment: Equipment): Equipment {
    store.equipment.set(equipment.id, equipment);
    return equipment;
  },

  findById(id: string): Equipment | null {
    return store.equipment.get(id) || null;
  },

  findByUser(userId: string): Equipment[] {
    return filterByUser(store.equipment, userId);
  },

  update(id: string, updates: Partial<Equipment>): Equipment | null {
    const equipment = store.equipment.get(id);
    if (!equipment) return null;

    const updated = {
      ...equipment,
      ...updates,
      stateChangedAt: updates.state ? new Date().toISOString() : equipment.stateChangedAt,
      updatedAt: new Date().toISOString()
    };
    store.equipment.set(id, updated);
    return updated;
  },

  checkConflicts(userId: string, requiredEquipment: string[]): Array<{ equipment: string; currentState: string; stateChangedAt?: string }> {
    const userEquipment = this.findByUser(userId);
    const conflicts: Array<{ equipment: string; currentState: string; stateChangedAt?: string }> = [];

    for (const needed of requiredEquipment) {
      const equipment = userEquipment.find(e => e.name.toLowerCase() === needed.toLowerCase());
      if (equipment && equipment.state !== 'clean') {
        conflicts.push({
          equipment: equipment.name,
          currentState: equipment.state,
          stateChangedAt: equipment.stateChangedAt
        });
      }
    }

    return conflicts;
  }
};

// Analytics operations
export const analyticsService = {
  getPatternStats(userId: string, options: FindByUserOptions = {}): Record<string, any> {
    const patterns = patternService.findByUser(userId, options);

    const stats: Record<string, any> = {};
    for (const pattern of patterns) {
      const type = pattern.patternType;
      if (!stats[type]) {
        stats[type] = {
          count: 0,
          completed: 0,
          totalCalories: 0,
          totalProtein: 0,
          avgRating: 0,
          ratings: []
        };
      }

      stats[type].count++;
      const completedMeals = pattern.meals.filter(m => m.status === 'completed');
      if (completedMeals.length === pattern.meals.length) {
        stats[type].completed++;
      }

      completedMeals.forEach(m => {
        stats[type].totalCalories += m.actualCalories || 0;
        stats[type].totalProtein += m.actualProtein || 0;
        if (m.rating) stats[type].ratings.push(m.rating);
      });
    }

    // Calculate averages
    for (const type in stats) {
      if (stats[type].ratings.length > 0) {
        stats[type].avgRating =
          stats[type].ratings.reduce((a: number, b: number) => a + b, 0) / stats[type].ratings.length;
      }
      stats[type].adherenceRate =
        stats[type].count > 0 ? stats[type].completed / stats[type].count : 0;
      delete stats[type].ratings;
    }

    return stats;
  },

  getWeightTrend(_userId: string, _options: FindByUserOptions = {}): any {
    // In a real implementation, this would query weight logs
    // For now, return mock data structure
    return {
      current: 250,
      target: 200,
      trend: 'decreasing',
      weeklyChange: -1.2,
      dataPoints: []
    };
  },

  getAdherenceStats(userId: string, options: FindByUserOptions = {}): any {
    const patterns = patternService.findByUser(userId, options);

    let totalMeals = 0;
    let completedMeals = 0;
    let skippedMeals = 0;
    let partialMeals = 0;

    patterns.forEach(p => {
      p.meals.forEach(m => {
        totalMeals++;
        if (m.status === 'completed') completedMeals++;
        else if (m.status === 'skipped') skippedMeals++;
        else if (m.status === 'partial') partialMeals++;
      });
    });

    return {
      totalMeals,
      completedMeals,
      skippedMeals,
      partialMeals,
      adherenceRate: totalMeals > 0 ? completedMeals / totalMeals : 0,
      completionRate: totalMeals > 0 ? (completedMeals + partialMeals) / totalMeals : 0
    };
  }
};

// Hydration operations
export const hydrationService = {
  // Default caffeine content per 8oz (mg)
  CAFFEINE_DEFAULTS: {
    coffee: 95,
    tea: 47,
    soda: 30,
    energy_drink: 80,
    other: 0
  } as Record<string, number>,

  log(userId: string, entry: { amount_oz: number; beverage_type?: string; timestamp?: string; notes?: string }): HydrationLog {
    const log: HydrationLog = {
      id: uuidv4(),
      userId,
      loggedAt: entry.timestamp || new Date().toISOString(),
      amountOz: entry.amount_oz,
      beverageType: entry.beverage_type || 'water',
      notes: entry.notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!store.hydrationLogs) store.hydrationLogs = new Map();
    store.hydrationLogs.set(log.id, log);
    return log;
  },

  findById(id: string): HydrationLog | null {
    if (!store.hydrationLogs) return null;
    return store.hydrationLogs.get(id) || null;
  },

  findTodayLogs(userId: string): HydrationLog[] {
    if (!store.hydrationLogs) return [];
    const today = new Date().toISOString().split('T')[0];
    return Array.from(store.hydrationLogs.values())
      .filter(log => log.userId === userId && log.loggedAt.split('T')[0] === today)
      .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  },

  getTodayProgress(userId: string): any {
    const logs = this.findTodayLogs(userId);
    const goals = this.getGoals(userId);

    const totalOz = logs.reduce((sum, log) => sum + log.amountOz, 0);
    const goalOz = goals.dailyWaterOz;
    const percentage = Math.min(100, Math.round((totalOz / goalOz) * 100));
    const remaining = Math.max(0, goalOz - totalOz);

    return {
      total_oz: totalOz,
      goal_oz: goalOz,
      percentage,
      remaining,
      entries: logs
    };
  },

  getGoals(userId: string): HydrationGoals {
    if (!store.hydrationGoals) store.hydrationGoals = new Map();

    let goals = Array.from(store.hydrationGoals.values()).find(g => g.userId === userId);

    if (!goals) {
      // Get user to calculate personalized goal
      const user = store.users.get(userId);
      const weightLbs = user?.profile?.weight || 250;
      const calculatedOz = Math.max(64, Math.round(weightLbs / 2));

      goals = {
        id: uuidv4(),
        userId,
        dailyWaterOz: calculatedOz,
        dailyCaffeineLimitMg: 400,
        personalizedFormulaEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      store.hydrationGoals.set(goals.id, goals);
    }

    return goals;
  },

  updateGoals(userId: string, updates: Partial<HydrationGoals>): HydrationGoals {
    const goals = this.getGoals(userId);

    const updated = {
      ...goals,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Recalculate if personalized formula is being enabled
    if (updates.personalizedFormulaEnabled === true && !goals.personalizedFormulaEnabled) {
      const user = store.users.get(userId);
      const weightLbs = user?.profile?.weight || 250;
      updated.dailyWaterOz = Math.max(64, Math.round(weightLbs / 2));
    }

    store.hydrationGoals!.set(goals.id, updated);
    return updated;
  },

  getTrends(userId: string, _options: any = {}): any {
    if (!store.hydrationLogs) return { weekly: [], monthly: [], patterns: {} };

    const logs = Array.from(store.hydrationLogs.values())
      .filter(log => log.userId === userId)
      .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());

    // Group by date
    const byDate: Record<string, { totalOz: number; entries: HydrationLog[] }> = {};
    logs.forEach(log => {
      const date = log.loggedAt.split('T')[0];
      if (!byDate[date]) byDate[date] = { totalOz: 0, entries: [] };
      byDate[date].totalOz += log.amountOz;
      byDate[date].entries.push(log);
    });

    // Calculate weekly averages
    const goals = this.getGoals(userId);
    const weeklyData: any[] = [];
    const dates = Object.keys(byDate).sort();

    // Get last 7 days
    const last7Days = dates.slice(-7);
    last7Days.forEach(date => {
      weeklyData.push({
        date,
        total_oz: byDate[date].totalOz,
        goal_oz: goals.dailyWaterOz,
        adherence_rate: Math.min(100, Math.round((byDate[date].totalOz / goals.dailyWaterOz) * 100))
      });
    });

    // Hourly patterns
    const hourlyPatterns: Record<number, number> = {};
    logs.forEach(log => {
      const hour = new Date(log.loggedAt).getHours();
      if (!hourlyPatterns[hour]) hourlyPatterns[hour] = 0;
      hourlyPatterns[hour] += log.amountOz;
    });

    return {
      weekly: weeklyData,
      avg_daily_oz: logs.length > 0 ? Math.round(logs.reduce((s, l) => s + l.amountOz, 0) / Math.max(1, dates.length)) : 0,
      adherence_rate: weeklyData.length > 0 ? Math.round(weeklyData.reduce((s: number, d: any) => s + d.adherence_rate, 0) / weeklyData.length) : 0,
      hourly_patterns: hourlyPatterns
    };
  },

  delete(id: string): boolean {
    if (!store.hydrationLogs) return false;
    return store.hydrationLogs.delete(id);
  }
};

// Caffeine operations
export const caffeineService = {
  log(userId: string, entry: { beverage_type: string; volume_oz: number; caffeine_mg?: number; timestamp?: string; notes?: string }): CaffeineLog {
    // Auto-calculate caffeine if not provided
    let caffeineMg = entry.caffeine_mg;
    if (caffeineMg === undefined || caffeineMg === null) {
      const defaultPerOz = hydrationService.CAFFEINE_DEFAULTS[entry.beverage_type] || 0;
      caffeineMg = Math.round((entry.volume_oz / 8) * defaultPerOz);
    }

    const log: CaffeineLog = {
      id: uuidv4(),
      userId,
      loggedAt: entry.timestamp || new Date().toISOString(),
      beverageType: entry.beverage_type,
      volumeOz: entry.volume_oz,
      caffeineMg,
      notes: entry.notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!store.caffeineLogs) store.caffeineLogs = new Map();
    store.caffeineLogs.set(log.id, log);
    return log;
  },

  findById(id: string): CaffeineLog | null {
    if (!store.caffeineLogs) return null;
    return store.caffeineLogs.get(id) || null;
  },

  findTodayLogs(userId: string): CaffeineLog[] {
    if (!store.caffeineLogs) return [];
    const today = new Date().toISOString().split('T')[0];
    return Array.from(store.caffeineLogs.values())
      .filter(log => log.userId === userId && log.loggedAt.split('T')[0] === today)
      .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  },

  getTodayProgress(userId: string): any {
    const logs = this.findTodayLogs(userId);
    const goals = hydrationService.getGoals(userId);

    const totalMg = logs.reduce((sum, log) => sum + log.caffeineMg, 0);
    const limitMg = goals.dailyCaffeineLimitMg;
    const percentage = Math.min(100, Math.round((totalMg / limitMg) * 100));

    return {
      total_mg: totalMg,
      limit_mg: limitMg,
      percentage,
      remaining_mg: Math.max(0, limitMg - totalMg),
      over_limit: totalMg > limitMg,
      entries: logs
    };
  },

  delete(id: string): boolean {
    if (!store.caffeineLogs) return false;
    return store.caffeineLogs.delete(id);
  }
};

// Clear all data (useful for testing)
export function clearAll(): void {
  for (const key in store) {
    (store as any)[key].clear();
  }
}
