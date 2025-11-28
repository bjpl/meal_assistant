/**
 * Inventory Management Service
 * Main entry point for all inventory-related functionality
 *
 * This module provides intelligent inventory tracking with:
 * - Auto-deduction from meal logging
 * - Barcode scanning integration
 * - Voice input for quantities (via external service)
 * - Receipt import/parsing
 * - Location tracking (fridge/pantry/freezer)
 * - 48-hour expiry warnings
 * - Meal suggestions using expiring items
 * - Color-coded freshness indicators
 * - Freezer transfer reminders
 * - Historical waste tracking with cost
 * - Leftover management
 * - Predictive analytics for usage and depletion
 */

// Re-export all types
export * from '../../types/inventory.types';

// Re-export all services
export {
  InventoryTrackingService,
  inventoryTrackingService,
  calculateFreshnessStatus,
  getFreshnessColor,
  calculateDepletionDate
} from './tracking.service';

export {
  ExpiryPreventionService,
  expiryPreventionService
} from './expiry.service';

export {
  LeftoverManagementService,
  leftoverManagementService
} from './leftovers.service';

export {
  PredictiveAnalyticsService,
  predictiveAnalyticsService
} from './predictions.service';

export {
  BarcodeScanningService,
  barcodeScanningService
} from './barcode.service';

export {
  InventoryNotificationService,
  inventoryNotificationService
} from './notifications.service';

/**
 * InventoryManager - Facade for all inventory operations
 * Provides a unified interface for the inventory management system
 */
import { inventoryTrackingService, calculateFreshnessStatus } from './tracking.service';
import { expiryPreventionService } from './expiry.service';
import { leftoverManagementService } from './leftovers.service';
import { predictiveAnalyticsService } from './predictions.service';
import { barcodeScanningService } from './barcode.service';
import { inventoryNotificationService } from './notifications.service';
import {
  InventoryItem,
  InventoryFilters,
  InventoryStats,
  ExpiryAlert,
  LeftoverItem,
  UsagePrediction,
  ShoppingListItem,
  WasteRecord,
  BarcodeScanResult,
  StorageLocation
} from '../../types/inventory.types';

/**
 * Unified inventory management interface
 */
class InventoryManager {
  /**
   * Initialize the inventory system
   * Call this on app startup
   */
  public initialize(): void {
    // Start expiry checking (every hour)
    expiryPreventionService.startExpiryChecking(60);

    // Start notification checks (every 30 minutes)
    inventoryNotificationService.startNotificationChecks(30);

    // Clean old barcode cache entries
    barcodeScanningService.cleanCache();
  }

  /**
   * Shutdown the inventory system
   * Call this on app close
   */
  public shutdown(): void {
    expiryPreventionService.stopExpiryChecking();
    inventoryNotificationService.stopNotificationChecks();
  }

  // ============================================
  // INVENTORY TRACKING
  // ============================================

  /**
   * Add a new item to inventory
   */
  public addItem(data: Partial<InventoryItem>): InventoryItem {
    const item = inventoryTrackingService.addItem(data);
    // Update predictions for the new item
    predictiveAnalyticsService.updateItemUsageRate(item.id);
    return item;
  }

  /**
   * Update an existing item
   */
  public updateItem(id: string, updates: Partial<InventoryItem>): InventoryItem | null {
    return inventoryTrackingService.updateItem(id, updates);
  }

  /**
   * Remove an item from inventory
   */
  public removeItem(id: string, reason?: string): boolean {
    return inventoryTrackingService.removeItem(id, reason);
  }

  /**
   * Deduct quantity (e.g., when logging a meal)
   */
  public deductFromMeal(itemId: string, amount: number, mealId?: string): InventoryItem | null {
    const result = inventoryTrackingService.deductQuantity(itemId, amount, 'meal_log', mealId);
    if (result) {
      predictiveAnalyticsService.recordUsage(itemId, amount);
    }
    return result;
  }

  /**
   * Transfer item between locations
   */
  public transferItem(id: string, newLocation: StorageLocation): InventoryItem | null {
    return inventoryTrackingService.transferItem(id, newLocation);
  }

  /**
   * Get all inventory items with optional filtering
   */
  public getItems(filters?: InventoryFilters): InventoryItem[] {
    return inventoryTrackingService.getItems(filters);
  }

  /**
   * Get a single item by ID
   */
  public getItem(id: string): InventoryItem | undefined {
    return inventoryTrackingService.getItem(id);
  }

  /**
   * Get inventory statistics
   */
  public getStats(): InventoryStats {
    return inventoryTrackingService.getStats();
  }

  // ============================================
  // EXPIRY PREVENTION
  // ============================================

  /**
   * Get all active expiry alerts
   */
  public getExpiryAlerts(): ExpiryAlert[] {
    return expiryPreventionService.getActiveAlerts();
  }

  /**
   * Get items expiring within 48 hours
   */
  public get48HourWarnings(): ExpiryAlert[] {
    return expiryPreventionService.get48HourWarnings();
  }

  /**
   * Acknowledge an expiry alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    return expiryPreventionService.acknowledgeAlert(alertId);
  }

  /**
   * Record waste for an item
   */
  public recordWaste(item: InventoryItem, reason: WasteRecord['reason'], notes?: string): WasteRecord {
    return expiryPreventionService.recordWaste(item, reason, notes);
  }

  /**
   * Get waste statistics
   */
  public getWasteStats(periodDays: number = 30) {
    return expiryPreventionService.getWasteStats(periodDays);
  }

  /**
   * Get items suggested for freezer transfer
   */
  public getFreezerSuggestions(): InventoryItem[] {
    return expiryPreventionService.getFreezerSuggestions();
  }

  // ============================================
  // LEFTOVER MANAGEMENT
  // ============================================

  /**
   * Create a new leftover entry
   */
  public createLeftover(data: {
    mealId: string;
    mealName: string;
    portionEstimate: 'small' | 'medium' | 'large';
    notes?: string;
    reheatingInstructions?: string;
  }): LeftoverItem {
    return leftoverManagementService.createLeftover(data);
  }

  /**
   * Get all leftovers
   */
  public getLeftovers(): LeftoverItem[] {
    return leftoverManagementService.getAllLeftovers();
  }

  /**
   * Get leftovers that should be used soon
   */
  public getPrioritizedLeftovers(): LeftoverItem[] {
    return leftoverManagementService.getPrioritizedLeftovers();
  }

  /**
   * Record that a leftover was reheated
   */
  public recordReheating(leftoverId: string) {
    return leftoverManagementService.recordReheating(leftoverId);
  }

  /**
   * Consume a leftover
   */
  public consumeLeftover(leftoverId: string, portion: 'all' | 'half' | 'quarter'): boolean {
    return leftoverManagementService.consumeLeftover(leftoverId, portion);
  }

  /**
   * Get meal suggestions that use leftovers
   */
  public getLeftoverMealSuggestions() {
    return leftoverManagementService.suggestMealsForLeftovers();
  }

  // ============================================
  // PREDICTIVE ANALYTICS
  // ============================================

  /**
   * Get usage prediction for an item
   */
  public getPrediction(itemId: string): UsagePrediction | null {
    return predictiveAnalyticsService.predictUsage(itemId);
  }

  /**
   * Get all predictions
   */
  public getAllPredictions(): UsagePrediction[] {
    return predictiveAnalyticsService.predictAllUsage();
  }

  /**
   * Generate smart shopping list
   */
  public generateShoppingList(): ShoppingListItem[] {
    return predictiveAnalyticsService.generateShoppingList();
  }

  /**
   * Get bulk buying recommendations
   */
  public getBulkBuyingRecommendations() {
    return predictiveAnalyticsService.getBulkBuyingRecommendations();
  }

  /**
   * Get items that will deplete soon
   */
  public getUpcomingDepletions(withinDays: number = 7): UsagePrediction[] {
    return predictiveAnalyticsService.getUpcomingDepletions(withinDays);
  }

  // ============================================
  // BARCODE SCANNING
  // ============================================

  /**
   * Scan a barcode and get product info
   */
  public async scanBarcode(barcode: string): Promise<BarcodeScanResult> {
    return barcodeScanningService.scanBarcode(barcode);
  }

  /**
   * Add scanned product directly to inventory
   */
  public async addScannedProduct(barcode: string, overrides?: Partial<InventoryItem>): Promise<InventoryItem | null> {
    return barcodeScanningService.addScannedToInventory(barcode, overrides);
  }

  /**
   * Search barcode cache
   */
  public searchBarcodeCache(query: string) {
    return barcodeScanningService.searchCache(query);
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  /**
   * Request notification permission
   */
  public async requestNotificationPermission(): Promise<boolean> {
    return inventoryNotificationService.checkPermission();
  }

  /**
   * Get active notifications
   */
  public getActiveNotifications() {
    return inventoryNotificationService.getActiveNotifications();
  }

  /**
   * Dismiss a notification
   */
  public dismissNotification(notificationId: string): boolean {
    return inventoryNotificationService.dismissNotification(notificationId);
  }

  /**
   * Update notification preferences
   */
  public updateNotificationPreferences(updates: Parameters<typeof inventoryNotificationService.updatePreferences>[0]): void {
    inventoryNotificationService.updatePreferences(updates);
  }

  /**
   * Get notification preferences
   */
  public getNotificationPreferences() {
    return inventoryNotificationService.getPreferences();
  }

  // ============================================
  // MEAL INTEGRATION
  // ============================================

  /**
   * Process a logged meal and auto-deduct ingredients
   * This is the main integration point with the meal logging system
   */
  public processMealLog(meal: {
    id: string;
    name: string;
    ingredients: { name: string; quantity: number; unit: string }[];
    hasLeftovers?: boolean;
    leftoverPortion?: 'small' | 'medium' | 'large';
  }): {
    deducted: { itemId: string; itemName: string; amount: number }[];
    notFound: string[];
    leftover?: LeftoverItem;
  } {
    const deducted: { itemId: string; itemName: string; amount: number }[] = [];
    const notFound: string[] = [];

    // Find and deduct each ingredient
    for (const ingredient of meal.ingredients) {
      const items = inventoryTrackingService.getItems({
        searchQuery: ingredient.name
      });

      if (items.length > 0) {
        // Use the first matching item (could be improved with better matching)
        const item = items[0];
        const result = this.deductFromMeal(item.id, ingredient.quantity, meal.id);

        if (result) {
          deducted.push({
            itemId: item.id,
            itemName: item.name,
            amount: ingredient.quantity
          });
        }
      } else {
        notFound.push(ingredient.name);
      }
    }

    // Create leftover if specified
    let leftover: LeftoverItem | undefined;
    if (meal.hasLeftovers && meal.leftoverPortion) {
      leftover = this.createLeftover({
        mealId: meal.id,
        mealName: meal.name,
        portionEstimate: meal.leftoverPortion
      });
    }

    return { deducted, notFound, leftover };
  }

  // ============================================
  // DASHBOARD DATA
  // ============================================

  /**
   * Get comprehensive dashboard data
   */
  public getDashboardData() {
    const stats = this.getStats();
    const alerts = this.getExpiryAlerts();
    const predictions = this.getAllPredictions();
    const shoppingList = this.generateShoppingList();
    const leftovers = this.getPrioritizedLeftovers();
    const freezerSuggestions = this.getFreezerSuggestions();
    const wasteStats = this.getWasteStats();

    return {
      stats,
      alerts: {
        total: alerts.length,
        critical: alerts.filter(a => a.alertType === 'critical' || a.alertType === 'expired').length,
        list: alerts.slice(0, 5) // Top 5 alerts
      },
      predictions: {
        depletingSoon: predictions.filter(p => {
          const days = (p.predictedDepletionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          return days <= 7;
        }).length,
        averageConfidence: predictions.length > 0
          ? predictions.reduce((sum, p) => sum + p.confidenceScore, 0) / predictions.length
          : 0
      },
      shoppingList: {
        total: shoppingList.length,
        urgent: shoppingList.filter(i => i.priority === 'urgent').length,
        estimatedCost: shoppingList.reduce((sum, i) => sum + (i.estimatedCost || 0), 0),
        list: shoppingList.slice(0, 10) // Top 10 items
      },
      leftovers: {
        total: leftovers.length,
        list: leftovers.slice(0, 5) // Top 5 leftovers
      },
      freezerSuggestions: {
        count: freezerSuggestions.length,
        list: freezerSuggestions.slice(0, 3) // Top 3 suggestions
      },
      wasteStats: {
        thisMonth: wasteStats.totalWasted,
        cost: wasteStats.totalCost,
        preventable: wasteStats.preventablePercentage
      }
    };
  }
}

// Export singleton facade
export const inventoryManager = new InventoryManager();

// Default export
export default inventoryManager;
