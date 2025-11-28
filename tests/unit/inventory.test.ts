/**
 * Unit Tests: Inventory Management
 * Tests for inventory tracking, expiry warnings, and depletion predictions
 * Target: 90% coverage
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Types
interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expiryDate: string | null;
  location: 'fridge' | 'freezer' | 'pantry' | 'counter';
  category: string;
  purchaseDate: string;
  costPerUnit: number | null;
}

interface InventoryOperation {
  type: 'add' | 'remove' | 'adjust' | 'transfer';
  itemId: string;
  quantity: number;
  reason?: string;
  timestamp: string;
}

// Mock implementations
const createInventoryService = () => ({
  items: new Map<string, InventoryItem>(),

  addItem(item: Omit<InventoryItem, 'id'>): InventoryItem {
    const id = 'inv-' + Math.random().toString(36).substr(2, 9);
    const newItem = { id, ...item };
    this.items.set(id, newItem);
    return newItem;
  },

  removeItem(id: string): boolean {
    return this.items.delete(id);
  },

  getItem(id: string): InventoryItem | undefined {
    return this.items.get(id);
  },

  updateQuantity(id: string, delta: number): InventoryItem | null {
    const item = this.items.get(id);
    if (!item) return null;

    item.quantity = Math.max(0, item.quantity + delta);
    if (item.quantity === 0) {
      this.items.delete(id);
      return null;
    }
    return item;
  },

  getExpiringItems(hoursThreshold: number): InventoryItem[] {
    const cutoff = new Date(Date.now() + hoursThreshold * 60 * 60 * 1000);
    return Array.from(this.items.values()).filter(item => {
      if (!item.expiryDate) return false;
      return new Date(item.expiryDate) <= cutoff;
    });
  },

  getItemsByLocation(location: InventoryItem['location']): InventoryItem[] {
    return Array.from(this.items.values()).filter(item => item.location === location);
  },

  calculateTotalValue(): number {
    return Array.from(this.items.values()).reduce((sum, item) => {
      return sum + (item.costPerUnit || 0) * item.quantity;
    }, 0);
  },

  predictDepletion(itemId: string, usageRate: number): Date | null {
    const item = this.items.get(itemId);
    if (!item || usageRate <= 0) return null;

    const daysUntilEmpty = item.quantity / usageRate;
    return new Date(Date.now() + daysUntilEmpty * 24 * 60 * 60 * 1000);
  },

  transferLocation(id: string, newLocation: InventoryItem['location']): boolean {
    const item = this.items.get(id);
    if (!item) return false;
    item.location = newLocation;
    return true;
  },

  searchItems(query: string): InventoryItem[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.items.values()).filter(item =>
      item.name.toLowerCase().includes(lowerQuery)
    );
  },

  getExpiredItems(): InventoryItem[] {
    const now = new Date();
    return Array.from(this.items.values()).filter(item => {
      if (!item.expiryDate) return false;
      return new Date(item.expiryDate) < now;
    });
  },

  reconcile(expected: Map<string, number>): { discrepancies: Array<{ id: string; expected: number; actual: number }> } {
    const discrepancies: Array<{ id: string; expected: number; actual: number }> = [];

    expected.forEach((expectedQty, id) => {
      const item = this.items.get(id);
      const actualQty = item?.quantity || 0;
      if (actualQty !== expectedQty) {
        discrepancies.push({ id, expected: expectedQty, actual: actualQty });
      }
    });

    return { discrepancies };
  }
});

describe('Inventory Management', () => {
  let inventoryService: ReturnType<typeof createInventoryService>;

  beforeEach(() => {
    inventoryService = createInventoryService();
  });

  describe('Item Management', () => {
    it('should add item to inventory', () => {
      const item = inventoryService.addItem({
        name: 'Chicken Breast',
        quantity: 2,
        unit: 'lbs',
        expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'protein',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 4.99
      });

      expect(item).toHaveProperty('id');
      expect(item.name).toBe('Chicken Breast');
      expect(item.quantity).toBe(2);
    });

    it('should remove item from inventory', () => {
      const item = inventoryService.addItem({
        name: 'Rice',
        quantity: 5,
        unit: 'lbs',
        expiryDate: null,
        location: 'pantry',
        category: 'grains',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 2.49
      });

      const removed = inventoryService.removeItem(item.id);
      expect(removed).toBe(true);
      expect(inventoryService.getItem(item.id)).toBeUndefined();
    });

    it('should return false when removing non-existent item', () => {
      const removed = inventoryService.removeItem('non-existent-id');
      expect(removed).toBe(false);
    });

    it('should update item quantity', () => {
      const item = inventoryService.addItem({
        name: 'Eggs',
        quantity: 12,
        unit: 'count',
        expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'protein',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 0.25
      });

      const updated = inventoryService.updateQuantity(item.id, -4);
      expect(updated?.quantity).toBe(8);
    });

    it('should remove item when quantity reaches zero', () => {
      const item = inventoryService.addItem({
        name: 'Avocado',
        quantity: 2,
        unit: 'count',
        expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'counter',
        category: 'produce',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 1.50
      });

      const result = inventoryService.updateQuantity(item.id, -2);
      expect(result).toBeNull();
      expect(inventoryService.getItem(item.id)).toBeUndefined();
    });

    it('should not allow negative quantities', () => {
      const item = inventoryService.addItem({
        name: 'Milk',
        quantity: 1,
        unit: 'gallon',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'dairy',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 3.99
      });

      const result = inventoryService.updateQuantity(item.id, -5);
      // When quantity goes to 0 or below, item is removed
      expect(result).toBeNull();
    });
  });

  describe('Expiry Management', () => {
    it('should identify items expiring within 48 hours', () => {
      // Add item expiring in 24 hours
      inventoryService.addItem({
        name: 'Fresh Fish',
        quantity: 1,
        unit: 'lbs',
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'protein',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 12.99
      });

      // Add item expiring in 72 hours (should not be included)
      inventoryService.addItem({
        name: 'Yogurt',
        quantity: 4,
        unit: 'count',
        expiryDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'dairy',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 1.29
      });

      const expiring = inventoryService.getExpiringItems(48);
      expect(expiring).toHaveLength(1);
      expect(expiring[0].name).toBe('Fresh Fish');
    });

    it('should identify already expired items', () => {
      inventoryService.addItem({
        name: 'Old Lettuce',
        quantity: 1,
        unit: 'head',
        expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'produce',
        purchaseDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        costPerUnit: 2.49
      });

      const expired = inventoryService.getExpiredItems();
      expect(expired).toHaveLength(1);
      expect(expired[0].name).toBe('Old Lettuce');
    });

    it('should handle items without expiry dates', () => {
      inventoryService.addItem({
        name: 'Salt',
        quantity: 1,
        unit: 'container',
        expiryDate: null,
        location: 'pantry',
        category: 'seasoning',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 1.99
      });

      const expiring = inventoryService.getExpiringItems(48);
      expect(expiring).toHaveLength(0);
    });
  });

  describe('Location Management', () => {
    beforeEach(() => {
      inventoryService.addItem({
        name: 'Butter',
        quantity: 1,
        unit: 'stick',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'dairy',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 4.99
      });

      inventoryService.addItem({
        name: 'Frozen Peas',
        quantity: 2,
        unit: 'bags',
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'freezer',
        category: 'vegetables',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 2.49
      });

      inventoryService.addItem({
        name: 'Pasta',
        quantity: 3,
        unit: 'boxes',
        expiryDate: null,
        location: 'pantry',
        category: 'grains',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 1.29
      });
    });

    it('should get items by location - fridge', () => {
      const fridgeItems = inventoryService.getItemsByLocation('fridge');
      expect(fridgeItems).toHaveLength(1);
      expect(fridgeItems[0].name).toBe('Butter');
    });

    it('should get items by location - freezer', () => {
      const freezerItems = inventoryService.getItemsByLocation('freezer');
      expect(freezerItems).toHaveLength(1);
      expect(freezerItems[0].name).toBe('Frozen Peas');
    });

    it('should transfer item between locations', () => {
      const fridgeItems = inventoryService.getItemsByLocation('fridge');
      const item = fridgeItems[0];

      const transferred = inventoryService.transferLocation(item.id, 'freezer');
      expect(transferred).toBe(true);

      const freezerItems = inventoryService.getItemsByLocation('freezer');
      expect(freezerItems).toHaveLength(2);
    });
  });

  describe('Depletion Prediction', () => {
    it('should predict when item will be depleted', () => {
      const item = inventoryService.addItem({
        name: 'Coffee Beans',
        quantity: 14,
        unit: 'oz',
        expiryDate: null,
        location: 'pantry',
        category: 'beverages',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 0.75
      });

      // Using 2 oz per day
      const depletionDate = inventoryService.predictDepletion(item.id, 2);
      expect(depletionDate).not.toBeNull();

      const daysUntilEmpty = Math.round((depletionDate!.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      expect(daysUntilEmpty).toBe(7);
    });

    it('should return null for non-existent item', () => {
      const result = inventoryService.predictDepletion('fake-id', 1);
      expect(result).toBeNull();
    });

    it('should return null for zero usage rate', () => {
      const item = inventoryService.addItem({
        name: 'Flour',
        quantity: 5,
        unit: 'lbs',
        expiryDate: null,
        location: 'pantry',
        category: 'baking',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 0.99
      });

      const result = inventoryService.predictDepletion(item.id, 0);
      expect(result).toBeNull();
    });
  });

  describe('Search & Filtering', () => {
    beforeEach(() => {
      inventoryService.addItem({
        name: 'Chicken Breast',
        quantity: 2,
        unit: 'lbs',
        expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'protein',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 4.99
      });

      inventoryService.addItem({
        name: 'Chicken Thighs',
        quantity: 1,
        unit: 'lbs',
        expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'protein',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 3.99
      });

      inventoryService.addItem({
        name: 'Rice',
        quantity: 10,
        unit: 'lbs',
        expiryDate: null,
        location: 'pantry',
        category: 'grains',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 1.99
      });
    });

    it('should search items by name', () => {
      const results = inventoryService.searchItems('chicken');
      expect(results).toHaveLength(2);
    });

    it('should be case-insensitive', () => {
      const results = inventoryService.searchItems('CHICKEN');
      expect(results).toHaveLength(2);
    });

    it('should return empty array for no matches', () => {
      const results = inventoryService.searchItems('beef');
      expect(results).toHaveLength(0);
    });
  });

  describe('Value Calculations', () => {
    it('should calculate total inventory value', () => {
      inventoryService.addItem({
        name: 'Steak',
        quantity: 2,
        unit: 'lbs',
        expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'protein',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 15.99
      });

      inventoryService.addItem({
        name: 'Vegetables',
        quantity: 5,
        unit: 'lbs',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'produce',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 2.00
      });

      const totalValue = inventoryService.calculateTotalValue();
      expect(totalValue).toBe(15.99 * 2 + 2.00 * 5); // 41.98
    });

    it('should handle items without cost', () => {
      inventoryService.addItem({
        name: 'Garden Tomatoes',
        quantity: 6,
        unit: 'count',
        expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'counter',
        category: 'produce',
        purchaseDate: new Date().toISOString(),
        costPerUnit: null
      });

      const totalValue = inventoryService.calculateTotalValue();
      expect(totalValue).toBe(0);
    });
  });

  describe('Inventory Reconciliation', () => {
    it('should detect discrepancies between expected and actual', () => {
      const item1 = inventoryService.addItem({
        name: 'Eggs',
        quantity: 10,
        unit: 'count',
        expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'protein',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 0.25
      });

      const item2 = inventoryService.addItem({
        name: 'Milk',
        quantity: 1,
        unit: 'gallon',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'dairy',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 3.99
      });

      const expected = new Map([
        [item1.id, 12], // Expected 12, actual 10
        [item2.id, 1]   // Expected 1, actual 1
      ]);

      const result = inventoryService.reconcile(expected);
      expect(result.discrepancies).toHaveLength(1);
      expect(result.discrepancies[0].expected).toBe(12);
      expect(result.discrepancies[0].actual).toBe(10);
    });

    it('should return empty discrepancies when counts match', () => {
      const item = inventoryService.addItem({
        name: 'Bread',
        quantity: 1,
        unit: 'loaf',
        expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'counter',
        category: 'grains',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 3.49
      });

      const expected = new Map([[item.id, 1]]);
      const result = inventoryService.reconcile(expected);
      expect(result.discrepancies).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty inventory', () => {
      expect(inventoryService.getExpiringItems(48)).toHaveLength(0);
      expect(inventoryService.getExpiredItems()).toHaveLength(0);
      expect(inventoryService.calculateTotalValue()).toBe(0);
      expect(inventoryService.searchItems('anything')).toHaveLength(0);
    });

    it('should handle very large quantities', () => {
      const item = inventoryService.addItem({
        name: 'Wholesale Rice',
        quantity: 1000000,
        unit: 'lbs',
        expiryDate: null,
        location: 'pantry',
        category: 'grains',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 0.50
      });

      expect(item.quantity).toBe(1000000);
      expect(inventoryService.calculateTotalValue()).toBe(500000);
    });

    it('should handle special characters in item names', () => {
      inventoryService.addItem({
        name: "Chef's Special Sauce (16 oz)",
        quantity: 1,
        unit: 'bottle',
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'fridge',
        category: 'condiments',
        purchaseDate: new Date().toISOString(),
        costPerUnit: 7.99
      });

      const results = inventoryService.searchItems("chef's");
      expect(results).toHaveLength(1);
    });
  });
});

describe('Auto-Deduction from Meal Logging', () => {
  it('should deduct ingredients when meal is logged', () => {
    const inventoryService = createInventoryService();

    // Setup inventory
    const chicken = inventoryService.addItem({
      name: 'Chicken Breast',
      quantity: 2,
      unit: 'lbs',
      expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      location: 'fridge',
      category: 'protein',
      purchaseDate: new Date().toISOString(),
      costPerUnit: 4.99
    });

    const rice = inventoryService.addItem({
      name: 'Rice',
      quantity: 10,
      unit: 'cups',
      expiryDate: null,
      location: 'pantry',
      category: 'grains',
      purchaseDate: new Date().toISOString(),
      costPerUnit: 0.25
    });

    // Simulate meal logging with ingredient deduction
    const mealIngredients = [
      { itemId: chicken.id, amount: 0.5 },
      { itemId: rice.id, amount: 1 }
    ];

    mealIngredients.forEach(ingredient => {
      inventoryService.updateQuantity(ingredient.itemId, -ingredient.amount);
    });

    expect(inventoryService.getItem(chicken.id)?.quantity).toBe(1.5);
    expect(inventoryService.getItem(rice.id)?.quantity).toBe(9);
  });
});
