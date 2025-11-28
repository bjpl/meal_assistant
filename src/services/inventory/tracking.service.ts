/**
 * Inventory Tracking Service
 * Core CRUD operations and tracking functionality
 */

import {
  InventoryItem,
  InventoryTransaction,
  InventoryFilters,
  InventoryStats,
  StorageLocation,
  InventoryCategory,
  FreshnessStatus,
  UnitType
} from '../../types/inventory.types';

/**
 * Generate unique ID
 */
const generateId = (): string => {
  return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Calculate freshness status based on expiry date
 */
export const calculateFreshnessStatus = (expiryDate: Date, openedDate?: Date): FreshnessStatus => {
  const now = new Date();
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // If opened, reduce effective days
  let effectiveDays = daysUntilExpiry;
  if (openedDate) {
    const daysSinceOpened = Math.floor((now.getTime() - openedDate.getTime()) / (1000 * 60 * 60 * 24));
    // Opened items have reduced shelf life
    effectiveDays = Math.min(effectiveDays, Math.max(0, 7 - daysSinceOpened));
  }

  if (effectiveDays < 0) return 'expired';
  if (effectiveDays <= 1) return 'expiring';
  if (effectiveDays <= 3) return 'use_soon';
  if (effectiveDays <= 7) return 'good';
  return 'fresh';
};

/**
 * Get color code for freshness status (for UI)
 */
export const getFreshnessColor = (status: FreshnessStatus): string => {
  const colors: Record<FreshnessStatus, string> = {
    fresh: '#22c55e',      // Green
    good: '#84cc16',       // Lime
    use_soon: '#eab308',   // Yellow
    expiring: '#f97316',   // Orange
    expired: '#ef4444'     // Red
  };
  return colors[status];
};

/**
 * Calculate predicted depletion date based on usage rate
 */
export const calculateDepletionDate = (quantity: number, avgUsageRate: number): Date => {
  if (avgUsageRate <= 0) {
    // If no usage rate, assume 30 days
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  }

  const daysUntilDepletion = Math.ceil(quantity / avgUsageRate);
  const depletionDate = new Date();
  depletionDate.setDate(depletionDate.getDate() + daysUntilDepletion);
  return depletionDate;
};

/**
 * InventoryTrackingService class
 * Manages all inventory tracking operations
 */
export class InventoryTrackingService {
  private items: Map<string, InventoryItem> = new Map();
  private transactions: InventoryTransaction[] = [];
  private eventListeners: Map<string, ((event: unknown) => void)[]> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load inventory from local storage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('meal_assistant_inventory');
      if (stored) {
        const data = JSON.parse(stored);
        data.items.forEach((item: InventoryItem) => {
          // Convert date strings back to Date objects
          item.purchaseDate = new Date(item.purchaseDate);
          item.expiryDate = new Date(item.expiryDate);
          item.predictedDepletionDate = new Date(item.predictedDepletionDate);
          item.createdAt = new Date(item.createdAt);
          item.updatedAt = new Date(item.updatedAt);
          if (item.openedDate) item.openedDate = new Date(item.openedDate);
          this.items.set(item.id, item);
        });
        this.transactions = data.transactions || [];
      }
    } catch (error) {
      console.error('Failed to load inventory from storage:', error);
    }
  }

  /**
   * Save inventory to local storage
   */
  private saveToStorage(): void {
    try {
      const data = {
        items: Array.from(this.items.values()),
        transactions: this.transactions.slice(-1000) // Keep last 1000 transactions
      };
      localStorage.setItem('meal_assistant_inventory', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save inventory to storage:', error);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(eventType: string, payload: unknown): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(listener => listener(payload));
  }

  /**
   * Subscribe to events
   */
  public on(eventType: string, callback: (event: unknown) => void): () => void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.push(callback);
    this.eventListeners.set(eventType, listeners);

    // Return unsubscribe function
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }

  /**
   * Add new inventory item
   */
  public addItem(itemData: Partial<InventoryItem>): InventoryItem {
    const now = new Date();
    const id = generateId();

    const item: InventoryItem = {
      id,
      name: itemData.name || 'Unknown Item',
      quantity: itemData.quantity || 1,
      unit: itemData.unit || 'count',
      location: itemData.location || 'pantry',
      category: itemData.category || 'other',
      purchaseDate: itemData.purchaseDate || now,
      expiryDate: itemData.expiryDate || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      openedDate: itemData.openedDate,
      avgUsageRate: itemData.avgUsageRate || 0,
      predictedDepletionDate: calculateDepletionDate(
        itemData.quantity || 1,
        itemData.avgUsageRate || 0
      ),
      cost: itemData.cost || 0,
      costPerUnit: itemData.cost && itemData.quantity
        ? itemData.cost / itemData.quantity
        : 0,
      barcode: itemData.barcode,
      brand: itemData.brand,
      notes: itemData.notes,
      isLeftover: itemData.isLeftover || false,
      originalMealId: itemData.originalMealId,
      imageUrl: itemData.imageUrl,
      nutritionPer100g: itemData.nutritionPer100g,
      createdAt: now,
      updatedAt: now
    };

    this.items.set(id, item);

    // Record transaction
    this.recordTransaction({
      itemId: id,
      type: 'add',
      quantity: item.quantity,
      previousQuantity: 0,
      newQuantity: item.quantity,
      source: 'manual'
    });

    this.saveToStorage();
    this.emit('item_added', item);

    return item;
  }

  /**
   * Update existing inventory item
   */
  public updateItem(id: string, updates: Partial<InventoryItem>): InventoryItem | null {
    const item = this.items.get(id);
    if (!item) return null;

    const previousQuantity = item.quantity;
    const updatedItem: InventoryItem = {
      ...item,
      ...updates,
      id, // Prevent ID change
      updatedAt: new Date()
    };

    // Recalculate derived fields
    if (updates.quantity !== undefined || updates.avgUsageRate !== undefined) {
      updatedItem.predictedDepletionDate = calculateDepletionDate(
        updatedItem.quantity,
        updatedItem.avgUsageRate
      );
    }

    if (updates.cost !== undefined || updates.quantity !== undefined) {
      updatedItem.costPerUnit = updatedItem.cost / updatedItem.quantity;
    }

    this.items.set(id, updatedItem);

    // Record transaction if quantity changed
    if (updates.quantity !== undefined && updates.quantity !== previousQuantity) {
      this.recordTransaction({
        itemId: id,
        type: 'adjust',
        quantity: Math.abs(updates.quantity - previousQuantity),
        previousQuantity,
        newQuantity: updates.quantity,
        source: 'manual'
      });
    }

    this.saveToStorage();
    this.emit('item_updated', updatedItem);

    return updatedItem;
  }

  /**
   * Remove inventory item
   */
  public removeItem(id: string, reason?: string): boolean {
    const item = this.items.get(id);
    if (!item) return false;

    this.recordTransaction({
      itemId: id,
      type: 'remove',
      quantity: item.quantity,
      previousQuantity: item.quantity,
      newQuantity: 0,
      reason,
      source: 'manual'
    });

    this.items.delete(id);
    this.saveToStorage();
    this.emit('item_removed', { id, item });

    return true;
  }

  /**
   * Deduct quantity from item (e.g., when logging a meal)
   */
  public deductQuantity(
    id: string,
    amount: number,
    source: InventoryTransaction['source'] = 'manual',
    mealId?: string
  ): InventoryItem | null {
    const item = this.items.get(id);
    if (!item) return null;

    const previousQuantity = item.quantity;
    const newQuantity = Math.max(0, item.quantity - amount);

    const updatedItem = this.updateItem(id, { quantity: newQuantity });

    if (updatedItem) {
      this.recordTransaction({
        itemId: id,
        type: 'remove',
        quantity: amount,
        previousQuantity,
        newQuantity,
        source,
        mealId
      });
    }

    return updatedItem;
  }

  /**
   * Transfer item between locations
   */
  public transferItem(id: string, newLocation: StorageLocation): InventoryItem | null {
    const item = this.items.get(id);
    if (!item) return null;

    const previousLocation = item.location;
    const updatedItem = this.updateItem(id, { location: newLocation });

    if (updatedItem) {
      this.recordTransaction({
        itemId: id,
        type: 'transfer',
        quantity: item.quantity,
        previousQuantity: item.quantity,
        newQuantity: item.quantity,
        reason: `Transferred from ${previousLocation} to ${newLocation}`,
        source: 'manual'
      });
    }

    return updatedItem;
  }

  /**
   * Get item by ID
   */
  public getItem(id: string): InventoryItem | undefined {
    return this.items.get(id);
  }

  /**
   * Get all items with optional filtering
   */
  public getItems(filters?: InventoryFilters): InventoryItem[] {
    let items = Array.from(this.items.values());

    if (filters) {
      // Apply location filter
      if (filters.location?.length) {
        items = items.filter(item => filters.location!.includes(item.location));
      }

      // Apply category filter
      if (filters.category?.length) {
        items = items.filter(item => filters.category!.includes(item.category));
      }

      // Apply freshness filter
      if (filters.freshnessStatus?.length) {
        items = items.filter(item => {
          const status = calculateFreshnessStatus(item.expiryDate, item.openedDate);
          return filters.freshnessStatus!.includes(status);
        });
      }

      // Apply leftover filter
      if (filters.isLeftover !== undefined) {
        items = items.filter(item => item.isLeftover === filters.isLeftover);
      }

      // Apply search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        items = items.filter(item =>
          item.name.toLowerCase().includes(query) ||
          item.brand?.toLowerCase().includes(query) ||
          item.notes?.toLowerCase().includes(query)
        );
      }

      // Apply sorting
      if (filters.sortBy) {
        items.sort((a, b) => {
          let comparison = 0;
          switch (filters.sortBy) {
            case 'name':
              comparison = a.name.localeCompare(b.name);
              break;
            case 'expiryDate':
              comparison = a.expiryDate.getTime() - b.expiryDate.getTime();
              break;
            case 'quantity':
              comparison = a.quantity - b.quantity;
              break;
            case 'cost':
              comparison = a.cost - b.cost;
              break;
            case 'addedDate':
              comparison = a.createdAt.getTime() - b.createdAt.getTime();
              break;
          }
          return filters.sortOrder === 'desc' ? -comparison : comparison;
        });
      }
    }

    return items;
  }

  /**
   * Get items by location
   */
  public getItemsByLocation(location: StorageLocation): InventoryItem[] {
    return this.getItems({ location: [location] });
  }

  /**
   * Get items by category
   */
  public getItemsByCategory(category: InventoryCategory): InventoryItem[] {
    return this.getItems({ category: [category] });
  }

  /**
   * Get expiring items within specified days
   */
  public getExpiringItems(withinDays: number = 2): InventoryItem[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + withinDays);

    return Array.from(this.items.values()).filter(item =>
      item.expiryDate <= cutoffDate && item.quantity > 0
    ).sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());
  }

  /**
   * Get low stock items (below threshold usage)
   */
  public getLowStockItems(daysThreshold: number = 7): InventoryItem[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysThreshold);

    return Array.from(this.items.values()).filter(item =>
      item.predictedDepletionDate <= cutoffDate && item.quantity > 0
    );
  }

  /**
   * Record a transaction
   */
  private recordTransaction(data: Omit<InventoryTransaction, 'id' | 'timestamp'>): void {
    const transaction: InventoryTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      timestamp: new Date()
    };
    this.transactions.push(transaction);
  }

  /**
   * Get transaction history for an item
   */
  public getItemTransactions(itemId: string): InventoryTransaction[] {
    return this.transactions.filter(t => t.itemId === itemId);
  }

  /**
   * Get inventory statistics
   */
  public getStats(): InventoryStats {
    const items = Array.from(this.items.values());
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Calculate items by location
    const itemsByLocation: Record<StorageLocation, number> = {
      fridge: 0,
      pantry: 0,
      freezer: 0,
      counter: 0,
      spice_rack: 0
    };

    // Calculate items by category
    const itemsByCategory: Partial<Record<InventoryCategory, number>> = {};

    let totalValue = 0;
    let expiringWithin48Hours = 0;
    let expiringWithinWeek = 0;
    let lowStockItems = 0;

    items.forEach(item => {
      totalValue += item.cost;
      itemsByLocation[item.location]++;
      itemsByCategory[item.category] = (itemsByCategory[item.category] || 0) + 1;

      if (item.expiryDate <= twoDaysFromNow) expiringWithin48Hours++;
      else if (item.expiryDate <= sevenDaysFromNow) expiringWithinWeek++;

      if (item.predictedDepletionDate <= sevenDaysFromNow) lowStockItems++;
    });

    // Calculate waste this month
    const wasteTransactions = this.transactions.filter(t =>
      t.type === 'waste' && new Date(t.timestamp) >= thirtyDaysAgo
    );
    const wasteThisMonth = wasteTransactions.reduce((sum, t) => sum + t.quantity, 0);

    // Calculate waste cost (approximate)
    let wasteCostThisMonth = 0;
    wasteTransactions.forEach(t => {
      const item = this.items.get(t.itemId);
      if (item) {
        wasteCostThisMonth += t.quantity * item.costPerUnit;
      }
    });

    // Calculate average item lifespan
    const completedItems = this.transactions.filter(t => t.type === 'remove' && t.newQuantity === 0);
    let totalLifespan = 0;
    completedItems.forEach(t => {
      const addTransaction = this.transactions.find(
        at => at.itemId === t.itemId && at.type === 'add'
      );
      if (addTransaction) {
        const lifespan = new Date(t.timestamp).getTime() - new Date(addTransaction.timestamp).getTime();
        totalLifespan += lifespan / (1000 * 60 * 60 * 24);
      }
    });

    return {
      totalItems: items.length,
      totalValue,
      itemsByLocation,
      itemsByCategory: itemsByCategory as Record<InventoryCategory, number>,
      expiringWithin48Hours,
      expiringWithinWeek,
      lowStockItems,
      wasteThisMonth,
      wasteCostThisMonth,
      averageItemLifespan: completedItems.length > 0
        ? totalLifespan / completedItems.length
        : 0
    };
  }

  /**
   * Find item by barcode
   */
  public findByBarcode(barcode: string): InventoryItem | undefined {
    return Array.from(this.items.values()).find(item => item.barcode === barcode);
  }

  /**
   * Bulk add items (e.g., from receipt parsing)
   */
  public bulkAddItems(items: Partial<InventoryItem>[]): InventoryItem[] {
    return items.map(item => this.addItem(item));
  }

  /**
   * Clear all inventory (for testing/reset)
   */
  public clearAll(): void {
    this.items.clear();
    this.transactions = [];
    this.saveToStorage();
  }
}

// Export singleton instance
export const inventoryTrackingService = new InventoryTrackingService();
