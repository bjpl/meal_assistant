/**
 * Expiry Prevention Service
 * Manages expiry alerts, warnings, and meal suggestions for expiring items
 */

import {
  InventoryItem,
  ExpiryAlert,
  MealSuggestion,
  WasteRecord,
  FreshnessStatus
} from '../../types/inventory.types';
import {
  inventoryTrackingService,
  calculateFreshnessStatus
} from './tracking.service';

/**
 * Generate unique ID
 */
const generateId = (): string => {
  return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Default meal patterns that use common expiring items
 */
const MEAL_PATTERNS: Record<string, { ingredients: string[], prepTime: number }> = {
  'Quick Stir Fry': {
    ingredients: ['vegetables', 'protein', 'sauce'],
    prepTime: 20
  },
  'Leftover Bowl': {
    ingredients: ['rice', 'protein', 'vegetables'],
    prepTime: 10
  },
  'Smoothie': {
    ingredients: ['fruit', 'yogurt', 'milk'],
    prepTime: 5
  },
  'Omelette': {
    ingredients: ['eggs', 'cheese', 'vegetables'],
    prepTime: 15
  },
  'Sandwich/Wrap': {
    ingredients: ['bread', 'protein', 'vegetables', 'cheese'],
    prepTime: 10
  },
  'Soup': {
    ingredients: ['vegetables', 'broth', 'protein'],
    prepTime: 30
  },
  'Salad': {
    ingredients: ['greens', 'vegetables', 'protein', 'dressing'],
    prepTime: 10
  },
  'Pasta Dish': {
    ingredients: ['pasta', 'sauce', 'vegetables', 'cheese'],
    prepTime: 25
  }
};

/**
 * Ingredient category mapping for meal suggestions
 */
const INGREDIENT_CATEGORIES: Record<string, string[]> = {
  'protein': ['chicken', 'beef', 'pork', 'fish', 'tofu', 'eggs', 'turkey', 'shrimp'],
  'vegetables': ['broccoli', 'carrots', 'spinach', 'peppers', 'onions', 'tomatoes', 'zucchini', 'mushrooms'],
  'fruit': ['bananas', 'berries', 'apples', 'oranges', 'grapes', 'mango'],
  'dairy': ['milk', 'yogurt', 'cheese', 'cream', 'butter'],
  'greens': ['lettuce', 'spinach', 'kale', 'arugula', 'mixed greens'],
  'grains': ['rice', 'pasta', 'bread', 'quinoa', 'oats']
};

/**
 * ExpiryPreventionService class
 * Handles expiry alerts and waste prevention
 */
export class ExpiryPreventionService {
  private alerts: Map<string, ExpiryAlert> = new Map();
  private wasteRecords: WasteRecord[] = [];
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load data from storage
   */
  private loadFromStorage(): void {
    try {
      const alertsData = localStorage.getItem('meal_assistant_expiry_alerts');
      if (alertsData) {
        const parsed = JSON.parse(alertsData);
        parsed.forEach((alert: ExpiryAlert) => {
          alert.expiryDate = new Date(alert.expiryDate);
          alert.createdAt = new Date(alert.createdAt);
          if (alert.acknowledgedAt) alert.acknowledgedAt = new Date(alert.acknowledgedAt);
          this.alerts.set(alert.id, alert);
        });
      }

      const wasteData = localStorage.getItem('meal_assistant_waste_records');
      if (wasteData) {
        this.wasteRecords = JSON.parse(wasteData).map((record: WasteRecord) => ({
          ...record,
          wastedAt: new Date(record.wastedAt)
        }));
      }
    } catch (error) {
      console.error('Failed to load expiry data from storage:', error);
    }
  }

  /**
   * Save data to storage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem('meal_assistant_expiry_alerts',
        JSON.stringify(Array.from(this.alerts.values())));
      localStorage.setItem('meal_assistant_waste_records',
        JSON.stringify(this.wasteRecords.slice(-500)));
    } catch (error) {
      console.error('Failed to save expiry data to storage:', error);
    }
  }

  /**
   * Start automatic expiry checking
   */
  public startExpiryChecking(intervalMinutes: number = 60): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Run immediately
    this.checkAllExpiry();

    // Then run at interval
    this.checkInterval = setInterval(() => {
      this.checkAllExpiry();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop automatic expiry checking
   */
  public stopExpiryChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check all items for expiry and generate alerts
   */
  public checkAllExpiry(): ExpiryAlert[] {
    const items = inventoryTrackingService.getItems();
    const newAlerts: ExpiryAlert[] = [];
    const now = new Date();

    items.forEach(item => {
      if (item.quantity <= 0) return;

      const daysUntilExpiry = Math.floor(
        (item.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Skip if more than 7 days until expiry
      if (daysUntilExpiry > 7) return;

      // Check if alert already exists for this item
      const existingAlert = Array.from(this.alerts.values()).find(
        a => a.itemId === item.id && !a.acknowledged
      );

      if (existingAlert) {
        // Update existing alert if expiry status changed
        this.updateExistingAlert(existingAlert, daysUntilExpiry, item);
      } else {
        // Create new alert
        const alert = this.createAlert(item, daysUntilExpiry);
        if (alert) {
          this.alerts.set(alert.id, alert);
          newAlerts.push(alert);
        }
      }
    });

    this.saveToStorage();
    return newAlerts;
  }

  /**
   * Create expiry alert for an item
   */
  private createAlert(item: InventoryItem, daysUntilExpiry: number): ExpiryAlert | null {
    let alertType: ExpiryAlert['alertType'];

    if (daysUntilExpiry < 0) {
      alertType = 'expired';
    } else if (daysUntilExpiry <= 2) {
      alertType = 'critical';
    } else if (daysUntilExpiry <= 7) {
      alertType = 'warning';
    } else {
      return null;
    }

    const suggestedActions = this.generateSuggestedActions(item, daysUntilExpiry);
    const mealSuggestions = this.generateMealSuggestions([item]);

    return {
      id: generateId(),
      itemId: item.id,
      itemName: item.name,
      alertType,
      daysUntilExpiry,
      expiryDate: item.expiryDate,
      suggestedActions,
      mealSuggestions,
      createdAt: new Date(),
      acknowledged: false
    };
  }

  /**
   * Update existing alert
   */
  private updateExistingAlert(
    alert: ExpiryAlert,
    daysUntilExpiry: number,
    item: InventoryItem
  ): void {
    // Update alert type if it's gotten more severe
    if (daysUntilExpiry < 0 && alert.alertType !== 'expired') {
      alert.alertType = 'expired';
      alert.daysUntilExpiry = daysUntilExpiry;
      alert.suggestedActions = this.generateSuggestedActions(item, daysUntilExpiry);
    } else if (daysUntilExpiry <= 2 && alert.alertType === 'warning') {
      alert.alertType = 'critical';
      alert.daysUntilExpiry = daysUntilExpiry;
      alert.suggestedActions = this.generateSuggestedActions(item, daysUntilExpiry);
    }
  }

  /**
   * Generate suggested actions for an expiring item
   */
  private generateSuggestedActions(item: InventoryItem, daysUntilExpiry: number): string[] {
    const actions: string[] = [];

    if (daysUntilExpiry < 0) {
      actions.push('Check if item is still safe to consume');
      actions.push('Consider discarding if showing signs of spoilage');
      actions.push('Log as waste to track patterns');
    } else if (daysUntilExpiry <= 1) {
      actions.push('Use today in your next meal');
      actions.push('Consider freezing if applicable');
      if (item.location !== 'freezer') {
        actions.push('Transfer to freezer to extend shelf life');
      }
    } else if (daysUntilExpiry <= 2) {
      actions.push('Plan to use within 48 hours');
      actions.push('Move to front of storage for visibility');
      if (item.category === 'produce' && item.location !== 'freezer') {
        actions.push('Consider blanching and freezing');
      }
    } else {
      actions.push('Add to this week\'s meal plan');
      actions.push('Check for recipes using this ingredient');
    }

    // Location-specific suggestions
    if (item.location === 'fridge' && daysUntilExpiry <= 2) {
      if (['protein', 'dairy'].includes(item.category)) {
        actions.push('Can be frozen to extend freshness by weeks');
      }
    }

    return actions;
  }

  /**
   * Generate meal suggestions using expiring items
   */
  public generateMealSuggestions(items: InventoryItem[]): MealSuggestion[] {
    const suggestions: MealSuggestion[] = [];

    // Categorize items
    const itemCategories: Record<string, InventoryItem[]> = {};
    items.forEach(item => {
      const category = this.categorizeIngredient(item.name.toLowerCase());
      if (!itemCategories[category]) {
        itemCategories[category] = [];
      }
      itemCategories[category].push(item);
    });

    // Match against meal patterns
    Object.entries(MEAL_PATTERNS).forEach(([mealName, pattern]) => {
      const matchedIngredients = pattern.ingredients.filter(
        ing => itemCategories[ing] && itemCategories[ing].length > 0
      );

      if (matchedIngredients.length >= 2) {
        const usesItemIds = matchedIngredients.flatMap(
          ing => itemCategories[ing].map(item => item.id)
        );

        suggestions.push({
          mealName,
          usesItems: usesItemIds,
          priority: matchedIngredients.length,
          prepTime: pattern.prepTime
        });
      }
    });

    // Sort by priority (most ingredients matched first)
    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Categorize an ingredient name
   */
  private categorizeIngredient(name: string): string {
    for (const [category, ingredients] of Object.entries(INGREDIENT_CATEGORIES)) {
      if (ingredients.some(ing => name.includes(ing))) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    this.saveToStorage();
    return true;
  }

  /**
   * Get all active (unacknowledged) alerts
   */
  public getActiveAlerts(): ExpiryAlert[] {
    return Array.from(this.alerts.values())
      .filter(a => !a.acknowledged)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  /**
   * Get alerts by type
   */
  public getAlertsByType(type: ExpiryAlert['alertType']): ExpiryAlert[] {
    return this.getActiveAlerts().filter(a => a.alertType === type);
  }

  /**
   * Get 48-hour expiry warnings
   */
  public get48HourWarnings(): ExpiryAlert[] {
    return this.getActiveAlerts().filter(a =>
      a.daysUntilExpiry <= 2 && a.daysUntilExpiry >= 0
    );
  }

  /**
   * Record waste
   */
  public recordWaste(
    item: InventoryItem,
    reason: WasteRecord['reason'],
    notes?: string
  ): WasteRecord {
    const record: WasteRecord = {
      id: generateId(),
      itemId: item.id,
      itemName: item.name,
      quantity: item.quantity,
      unit: item.unit,
      cost: item.cost,
      reason,
      wastedAt: new Date(),
      preventable: reason === 'expired' || reason === 'spoiled',
      notes
    };

    this.wasteRecords.push(record);

    // Remove item from inventory
    inventoryTrackingService.removeItem(item.id, `Wasted: ${reason}`);

    this.saveToStorage();
    return record;
  }

  /**
   * Get waste statistics
   */
  public getWasteStats(periodDays: number = 30): {
    totalWasted: number;
    totalCost: number;
    byReason: Record<string, number>;
    preventablePercentage: number;
    topWastedItems: { name: string; count: number; cost: number }[];
  } {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);

    const recentWaste = this.wasteRecords.filter(r => r.wastedAt >= cutoff);

    const byReason: Record<string, number> = {};
    const byItem: Record<string, { count: number; cost: number }> = {};
    let totalCost = 0;
    let preventableCount = 0;

    recentWaste.forEach(record => {
      byReason[record.reason] = (byReason[record.reason] || 0) + 1;

      if (!byItem[record.itemName]) {
        byItem[record.itemName] = { count: 0, cost: 0 };
      }
      byItem[record.itemName].count++;
      byItem[record.itemName].cost += record.cost;

      totalCost += record.cost;
      if (record.preventable) preventableCount++;
    });

    const topWastedItems = Object.entries(byItem)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    return {
      totalWasted: recentWaste.length,
      totalCost,
      byReason,
      preventablePercentage: recentWaste.length > 0
        ? (preventableCount / recentWaste.length) * 100
        : 0,
      topWastedItems
    };
  }

  /**
   * Get freezer transfer suggestions
   */
  public getFreezerSuggestions(): InventoryItem[] {
    const items = inventoryTrackingService.getItems();
    const now = new Date();

    return items.filter(item => {
      // Not already in freezer
      if (item.location === 'freezer') return false;

      // Has quantity
      if (item.quantity <= 0) return false;

      // Expiring within 3 days
      const daysUntilExpiry = Math.floor(
        (item.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry > 3) return false;

      // Is freezable category
      const freezableCategories = ['protein', 'dairy', 'prepared', 'leftovers'];
      return freezableCategories.includes(item.category);
    });
  }

  /**
   * Get all waste records
   */
  public getWasteRecords(limit: number = 100): WasteRecord[] {
    return this.wasteRecords
      .slice(-limit)
      .sort((a, b) => b.wastedAt.getTime() - a.wastedAt.getTime());
  }

  /**
   * Clear all alerts (for testing)
   */
  public clearAlerts(): void {
    this.alerts.clear();
    this.saveToStorage();
  }
}

// Export singleton instance
export const expiryPreventionService = new ExpiryPreventionService();
