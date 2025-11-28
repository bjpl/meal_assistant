/**
 * In-Memory Data Store Service
 * Simulates database operations for the API
 * In production, replace with actual database (PostgreSQL, MongoDB, etc.)
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// In-memory storage
const store = {
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
function filterByUser(map, userId) {
  return Array.from(map.values()).filter(item => item.userId === userId);
}

// User operations
const userService = {
  async create(email, password, profile = {}) {
    const existing = Array.from(store.users.values()).find(u => u.email === email);
    if (existing) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
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
    return { ...user, password: undefined };
  },

  async findByEmail(email) {
    return Array.from(store.users.values()).find(u => u.email === email);
  },

  async findById(id) {
    const user = store.users.get(id);
    if (user) {
      return { ...user, password: undefined };
    }
    return null;
  },

  async verifyPassword(email, password) {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password);
    return valid ? { ...user, password: undefined } : null;
  }
};

// Pattern operations
const patternService = {
  create(pattern) {
    store.patterns.set(pattern.id, pattern);
    // Also index individual meals
    pattern.meals.forEach(meal => {
      store.meals.set(meal.id, { ...meal, patternId: pattern.id, userId: pattern.userId });
    });
    return pattern;
  },

  findById(id) {
    return store.patterns.get(id) || null;
  },

  findByUserAndDate(userId, date) {
    return Array.from(store.patterns.values())
      .find(p => p.userId === userId && p.date === date);
  },

  findByUser(userId, options = {}) {
    let patterns = filterByUser(store.patterns, userId);

    if (options.startDate) {
      patterns = patterns.filter(p => p.date >= options.startDate);
    }
    if (options.endDate) {
      patterns = patterns.filter(p => p.date <= options.endDate);
    }

    return patterns.sort((a, b) => b.date.localeCompare(a.date));
  },

  update(id, updates) {
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

  delete(id) {
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
const mealService = {
  findById(id) {
    return store.meals.get(id) || null;
  },

  findByPattern(patternId) {
    return Array.from(store.meals.values())
      .filter(m => m.patternId === patternId)
      .sort((a, b) => a.index - b.index);
  },

  findTodayMeals(userId) {
    const today = new Date().toISOString().split('T')[0];
    const pattern = patternService.findByUserAndDate(userId, today);
    return pattern ? pattern.meals : [];
  },

  update(id, updates) {
    const meal = store.meals.get(id);
    if (!meal) return null;

    const updated = {
      ...meal,
      ...updates,
      logged: updates.status ? new Date().toISOString() : meal.logged
    };
    store.meals.set(id, updated);

    // Also update in pattern
    const pattern = store.patterns.get(meal.patternId);
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
const inventoryService = {
  create(item) {
    store.inventory.set(item.id, item);
    return item;
  },

  createBatch(items) {
    items.forEach(item => store.inventory.set(item.id, item));
    return items;
  },

  findById(id) {
    return store.inventory.get(id) || null;
  },

  findByUser(userId, options = {}) {
    let items = filterByUser(store.inventory, userId);

    if (options.category) {
      items = items.filter(i => i.category === options.category);
    }
    if (options.location) {
      items = items.filter(i => i.location === options.location);
    }

    return items;
  },

  findExpiring(userId, hoursAhead = 48) {
    const threshold = new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
    return filterByUser(store.inventory, userId)
      .filter(i => i.expiryDate && i.expiryDate <= threshold && i.quantity > 0);
  },

  update(id, updates) {
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

  consume(id, quantity) {
    const item = store.inventory.get(id);
    if (!item) return null;

    const newQuantity = Math.max(0, item.quantity - quantity);
    return this.update(id, { quantity: newQuantity });
  },

  delete(id) {
    return store.inventory.delete(id);
  }
};

// Prep session operations
const prepService = {
  create(session) {
    store.prepSessions.set(session.id, session);
    return session;
  },

  findById(id) {
    return store.prepSessions.get(id) || null;
  },

  findByUser(userId, options = {}) {
    let sessions = filterByUser(store.prepSessions, userId);

    if (options.date) {
      sessions = sessions.filter(s => s.date === options.date);
    }
    if (options.status) {
      sessions = sessions.filter(s => s.status === options.status);
    }

    return sessions.sort((a, b) => b.date.localeCompare(a.date));
  },

  update(id, updates) {
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

  updateTask(sessionId, taskId, updates) {
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
const shoppingService = {
  create(list) {
    store.shoppingLists.set(list.id, list);
    return list;
  },

  findById(id) {
    return store.shoppingLists.get(id) || null;
  },

  findByUser(userId, options = {}) {
    let lists = filterByUser(store.shoppingLists, userId);

    if (options.status) {
      lists = lists.filter(l => l.status === options.status);
    }

    return lists.sort((a, b) => b.weekOf.localeCompare(a.weekOf));
  },

  update(id, updates) {
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

  updateItem(listId, itemId, updates) {
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
      .reduce((sum, i) => sum + i.actualPrice, 0);

    store.shoppingLists.set(listId, list);
    return list.items[itemIndex];
  },

  delete(id) {
    return store.shoppingLists.delete(id);
  }
};

// Equipment operations
const equipmentService = {
  create(equipment) {
    store.equipment.set(equipment.id, equipment);
    return equipment;
  },

  findById(id) {
    return store.equipment.get(id) || null;
  },

  findByUser(userId) {
    return filterByUser(store.equipment, userId);
  },

  update(id, updates) {
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

  checkConflicts(userId, requiredEquipment) {
    const userEquipment = this.findByUser(userId);
    const conflicts = [];

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
const analyticsService = {
  getPatternStats(userId, options = {}) {
    const patterns = patternService.findByUser(userId, options);

    const stats = {};
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
          stats[type].ratings.reduce((a, b) => a + b, 0) / stats[type].ratings.length;
      }
      stats[type].adherenceRate =
        stats[type].count > 0 ? stats[type].completed / stats[type].count : 0;
      delete stats[type].ratings;
    }

    return stats;
  },

  getWeightTrend(userId, options = {}) {
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

  getAdherenceStats(userId, options = {}) {
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
const hydrationService = {
  // Default caffeine content per 8oz (mg)
  CAFFEINE_DEFAULTS: {
    coffee: 95,
    tea: 47,
    soda: 30,
    energy_drink: 80,
    other: 0
  },

  log(userId, entry) {
    const log = {
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

  findById(id) {
    if (!store.hydrationLogs) return null;
    return store.hydrationLogs.get(id) || null;
  },

  findTodayLogs(userId) {
    if (!store.hydrationLogs) return [];
    const today = new Date().toISOString().split('T')[0];
    return Array.from(store.hydrationLogs.values())
      .filter(log => log.userId === userId && log.loggedAt.split('T')[0] === today)
      .sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
  },

  getTodayProgress(userId) {
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

  getGoals(userId) {
    if (!store.hydrationGoals) store.hydrationGoals = new Map();

    let goals = Array.from(store.hydrationGoals.values()).find(g => g.userId === userId);

    if (!goals) {
      // Get user to calculate personalized goal
      const user = store.users.get(userId);
      const weightLbs = user?.profile?.weight || 250;  // Brandon's weight default
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

  updateGoals(userId, updates) {
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

    store.hydrationGoals.set(goals.id, updated);
    return updated;
  },

  getTrends(userId, options = {}) {
    if (!store.hydrationLogs) return { weekly: [], monthly: [], patterns: {} };

    const logs = Array.from(store.hydrationLogs.values())
      .filter(log => log.userId === userId)
      .sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt));

    // Group by date
    const byDate = {};
    logs.forEach(log => {
      const date = log.loggedAt.split('T')[0];
      if (!byDate[date]) byDate[date] = { totalOz: 0, entries: [] };
      byDate[date].totalOz += log.amountOz;
      byDate[date].entries.push(log);
    });

    // Calculate weekly averages
    const goals = this.getGoals(userId);
    const weeklyData = [];
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
    const hourlyPatterns = {};
    logs.forEach(log => {
      const hour = new Date(log.loggedAt).getHours();
      if (!hourlyPatterns[hour]) hourlyPatterns[hour] = 0;
      hourlyPatterns[hour] += log.amountOz;
    });

    return {
      weekly: weeklyData,
      avg_daily_oz: logs.length > 0 ? Math.round(logs.reduce((s, l) => s + l.amountOz, 0) / Math.max(1, dates.length)) : 0,
      adherence_rate: weeklyData.length > 0 ? Math.round(weeklyData.reduce((s, d) => s + d.adherence_rate, 0) / weeklyData.length) : 0,
      hourly_patterns: hourlyPatterns
    };
  },

  delete(id) {
    if (!store.hydrationLogs) return false;
    return store.hydrationLogs.delete(id);
  }
};

// Caffeine operations
const caffeineService = {
  log(userId, entry) {
    // Auto-calculate caffeine if not provided
    let caffeineMg = entry.caffeine_mg;
    if (caffeineMg === undefined || caffeineMg === null) {
      const defaultPerOz = hydrationService.CAFFEINE_DEFAULTS[entry.beverage_type] || 0;
      caffeineMg = Math.round((entry.volume_oz / 8) * defaultPerOz);
    }

    const log = {
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

  findById(id) {
    if (!store.caffeineLogs) return null;
    return store.caffeineLogs.get(id) || null;
  },

  findTodayLogs(userId) {
    if (!store.caffeineLogs) return [];
    const today = new Date().toISOString().split('T')[0];
    return Array.from(store.caffeineLogs.values())
      .filter(log => log.userId === userId && log.loggedAt.split('T')[0] === today)
      .sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
  },

  getTodayProgress(userId) {
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

  delete(id) {
    if (!store.caffeineLogs) return false;
    return store.caffeineLogs.delete(id);
  }
};

// Clear all data (useful for testing)
function clearAll() {
  for (const key in store) {
    store[key].clear();
  }
}

module.exports = {
  userService,
  patternService,
  mealService,
  inventoryService,
  prepService,
  shoppingService,
  equipmentService,
  analyticsService,
  hydrationService,
  caffeineService,
  clearAll
};
