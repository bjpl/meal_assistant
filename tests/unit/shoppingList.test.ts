/**
 * Unit Tests: Shopping List Generation
 * Tests for shopping list creation, store optimization, and budget management
 * Target: 90% coverage
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Types
interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  preferredStore?: string;
  estimatedPrice?: number;
  notes?: string;
}

interface Store {
  id: string;
  name: string;
  type: 'wholesale' | 'traditional' | 'discount' | 'premium';
  strengths: string[];
}

interface ShoppingList {
  id: string;
  items: ShoppingItem[];
  totalEstimatedCost: number;
  stores: string[];
  createdAt: Date;
  weekStart: Date;
}

// Shopping List Service
const createShoppingListService = () => {
  const stores: Store[] = [
    { id: 'costco', name: 'Costco', type: 'wholesale', strengths: ['bulk', 'proteins', 'cheese'] },
    { id: 'walmart', name: 'Walmart', type: 'discount', strengths: ['everyday', 'staples'] },
    { id: 'safeway', name: 'Safeway', type: 'traditional', strengths: ['produce', 'deals'] },
    { id: 'wholefoods', name: 'Whole Foods', type: 'premium', strengths: ['organic', 'quality'] }
  ];

  const prices: Record<string, Record<string, number>> = {
    'chicken-breast': { costco: 3.99, walmart: 4.49, safeway: 5.99, wholefoods: 8.99 },
    'rice': { costco: 0.40, walmart: 0.50, safeway: 0.65, wholefoods: 1.20 },
    'black-beans': { costco: 0.80, walmart: 1.09, safeway: 1.29, wholefoods: 1.99 },
    'vegetables': { costco: 1.50, walmart: 1.80, safeway: 2.00, wholefoods: 2.50 },
    'eggs': { costco: 0.20, walmart: 0.25, safeway: 0.30, wholefoods: 0.50 },
    'olive-oil': { costco: 0.08, walmart: 0.10, safeway: 0.12, wholefoods: 0.15 }
  };

  return {
    createList(items: Omit<ShoppingItem, 'id'>[]): ShoppingList {
      const shoppingItems = items.map((item, i) => ({
        ...item,
        id: `item-${Date.now()}-${i}`
      }));

      const uniqueStores = [...new Set(shoppingItems.map(i => i.preferredStore).filter(Boolean) as string[])];
      const totalCost = shoppingItems.reduce((sum, item) => sum + (item.estimatedPrice || 0) * item.quantity, 0);

      return {
        id: `list-${Date.now()}`,
        items: shoppingItems,
        totalEstimatedCost: Math.round(totalCost * 100) / 100,
        stores: uniqueStores,
        createdAt: new Date(),
        weekStart: new Date()
      };
    },

    generateFromPattern(
      patternId: string,
      currentInventory: Map<string, { quantity: number; unit: string }>,
      weeks: number = 1
    ): ShoppingItem[] {
      const patternNeeds: Record<string, Record<string, { quantity: number; unit: string }>> = {
        'traditional': {
          'chicken-breast': { quantity: 3, unit: 'lbs' },
          'rice': { quantity: 7, unit: 'cups' },
          'black-beans': { quantity: 4, unit: 'cans' },
          'vegetables': { quantity: 5, unit: 'lbs' },
          'eggs': { quantity: 24, unit: 'count' }
        },
        'if-16-8': {
          'chicken-breast': { quantity: 4, unit: 'lbs' },
          'vegetables': { quantity: 6, unit: 'lbs' },
          'eggs': { quantity: 18, unit: 'count' },
          'olive-oil': { quantity: 16, unit: 'oz' }
        },
        'keto': {
          'chicken-breast': { quantity: 5, unit: 'lbs' },
          'eggs': { quantity: 36, unit: 'count' },
          'vegetables': { quantity: 4, unit: 'lbs' },
          'olive-oil': { quantity: 24, unit: 'oz' }
        }
      };

      const needs = patternNeeds[patternId];
      if (!needs) return [];

      const items: ShoppingItem[] = [];

      Object.entries(needs).forEach(([ingredient, need]) => {
        const current = currentInventory.get(ingredient);
        const currentQty = current?.quantity || 0;
        const requiredQty = need.quantity * weeks;
        const toBuy = Math.max(0, requiredQty - currentQty);

        if (toBuy > 0) {
          const bestStore = this.findBestStore(ingredient);
          const price = this.getPrice(ingredient, bestStore);

          items.push({
            id: '',
            name: this.formatName(ingredient),
            quantity: toBuy,
            unit: need.unit,
            category: this.categorize(ingredient),
            preferredStore: bestStore,
            estimatedPrice: price
          });
        }
      });

      return items;
    },

    findBestStore(ingredient: string, prioritize: 'price' | 'quality' = 'price'): string {
      const ingredientPrices = prices[ingredient];
      if (!ingredientPrices) return 'walmart'; // default

      if (prioritize === 'price') {
        let bestStore = '';
        let bestPrice = Infinity;
        Object.entries(ingredientPrices).forEach(([store, price]) => {
          if (price < bestPrice) {
            bestPrice = price;
            bestStore = store;
          }
        });
        return bestStore;
      } else {
        // Quality prioritizes premium stores
        return ingredientPrices['wholefoods'] ? 'wholefoods' : 'safeway';
      }
    },

    getPrice(ingredient: string, store: string): number {
      return prices[ingredient]?.[store] || 5.00;
    },

    formatName(ingredient: string): string {
      return ingredient.split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    },

    categorize(ingredient: string): string {
      const categories: Record<string, string> = {
        'chicken-breast': 'protein',
        'eggs': 'protein',
        'rice': 'grains',
        'black-beans': 'protein',
        'vegetables': 'produce',
        'olive-oil': 'oils'
      };
      return categories[ingredient] || 'other';
    },

    groupByStore(items: ShoppingItem[]): Record<string, ShoppingItem[]> {
      const grouped: Record<string, ShoppingItem[]> = {};

      items.forEach(item => {
        const store = item.preferredStore || 'unassigned';
        if (!grouped[store]) {
          grouped[store] = [];
        }
        grouped[store].push(item);
      });

      return grouped;
    },

    groupByCategory(items: ShoppingItem[]): Record<string, ShoppingItem[]> {
      const grouped: Record<string, ShoppingItem[]> = {};

      items.forEach(item => {
        if (!grouped[item.category]) {
          grouped[item.category] = [];
        }
        grouped[item.category].push(item);
      });

      return grouped;
    },

    optimizeRoute(storeIds: string[]): string[] {
      // Simple optimization: sort by store type priority
      const priority: Record<string, number> = {
        'costco': 1, // Bulk first
        'walmart': 2,
        'safeway': 3,
        'wholefoods': 4 // Premium last
      };

      return [...storeIds].sort((a, b) => (priority[a] || 5) - (priority[b] || 5));
    },

    calculateBudgetAnalysis(list: ShoppingList, budget: number): {
      underBudget: boolean;
      difference: number;
      percentUsed: number;
      suggestions: string[];
    } {
      const underBudget = list.totalEstimatedCost <= budget;
      const difference = budget - list.totalEstimatedCost;
      const percentUsed = (list.totalEstimatedCost / budget) * 100;

      const suggestions: string[] = [];

      if (!underBudget) {
        suggestions.push('Consider buying in bulk at Costco to save money');
        suggestions.push('Look for store brands instead of name brands');
        suggestions.push('Check weekly deals at Safeway');
      } else if (difference > budget * 0.3) {
        suggestions.push('Budget has room for premium ingredients');
        suggestions.push('Consider organic options');
      }

      return {
        underBudget,
        difference: Math.round(difference * 100) / 100,
        percentUsed: Math.round(percentUsed * 10) / 10,
        suggestions
      };
    },

    addItem(list: ShoppingList, item: Omit<ShoppingItem, 'id'>): ShoppingList {
      const newItem = {
        ...item,
        id: `item-${Date.now()}`
      };

      return {
        ...list,
        items: [...list.items, newItem],
        totalEstimatedCost: list.totalEstimatedCost + (item.estimatedPrice || 0) * item.quantity,
        stores: [...new Set([...list.stores, item.preferredStore].filter(Boolean) as string[])]
      };
    },

    removeItem(list: ShoppingList, itemId: string): ShoppingList {
      const item = list.items.find(i => i.id === itemId);
      const filteredItems = list.items.filter(i => i.id !== itemId);

      return {
        ...list,
        items: filteredItems,
        totalEstimatedCost: Math.round((list.totalEstimatedCost - ((item?.estimatedPrice || 0) * (item?.quantity || 0))) * 100) / 100,
        stores: [...new Set(filteredItems.map(i => i.preferredStore).filter(Boolean) as string[])]
      };
    },

    updateQuantity(list: ShoppingList, itemId: string, newQuantity: number): ShoppingList {
      const items = list.items.map(item => {
        if (item.id === itemId) {
          return { ...item, quantity: newQuantity };
        }
        return item;
      });

      const totalCost = items.reduce((sum, item) => sum + (item.estimatedPrice || 0) * item.quantity, 0);

      return {
        ...list,
        items,
        totalEstimatedCost: Math.round(totalCost * 100) / 100
      };
    },

    mergeItems(items: ShoppingItem[]): ShoppingItem[] {
      const merged = new Map<string, ShoppingItem>();

      items.forEach(item => {
        const key = `${item.name}-${item.unit}-${item.preferredStore}`;
        const existing = merged.get(key);

        if (existing) {
          existing.quantity += item.quantity;
        } else {
          merged.set(key, { ...item });
        }
      });

      return Array.from(merged.values());
    },

    calculateSavings(items: ShoppingItem[]): {
      currentCost: number;
      optimizedCost: number;
      savings: number;
      savingsPercent: number;
    } {
      let currentCost = items.reduce((sum, item) => sum + (item.estimatedPrice || 0) * item.quantity, 0);

      // Calculate optimized cost by finding best prices
      let optimizedCost = items.reduce((sum, item) => {
        const ingredientKey = item.name.toLowerCase().replace(' ', '-');
        const bestStore = this.findBestStore(ingredientKey);
        const bestPrice = this.getPrice(ingredientKey, bestStore);
        return sum + bestPrice * item.quantity;
      }, 0);

      const savings = currentCost - optimizedCost;

      return {
        currentCost: Math.round(currentCost * 100) / 100,
        optimizedCost: Math.round(optimizedCost * 100) / 100,
        savings: Math.round(savings * 100) / 100,
        savingsPercent: currentCost > 0 ? Math.round((savings / currentCost) * 1000) / 10 : 0
      };
    }
  };
};

describe('Shopping List Generation', () => {
  let service: ReturnType<typeof createShoppingListService>;

  beforeEach(() => {
    service = createShoppingListService();
  });

  describe('List Creation', () => {
    it('should create a shopping list with items', () => {
      const items = [
        { name: 'Chicken Breast', quantity: 3, unit: 'lbs', category: 'protein', estimatedPrice: 4.99 },
        { name: 'Rice', quantity: 5, unit: 'cups', category: 'grains', estimatedPrice: 0.50 }
      ];

      const list = service.createList(items);

      expect(list).toHaveProperty('id');
      expect(list.items).toHaveLength(2);
      expect(list.totalEstimatedCost).toBeGreaterThan(0);
    });

    it('should assign unique IDs to items', () => {
      const items = [
        { name: 'Item 1', quantity: 1, unit: 'each', category: 'other' },
        { name: 'Item 2', quantity: 2, unit: 'each', category: 'other' }
      ];

      const list = service.createList(items);

      expect(list.items[0].id).not.toBe(list.items[1].id);
    });

    it('should calculate total estimated cost correctly', () => {
      const items = [
        { name: 'Item 1', quantity: 2, unit: 'lbs', category: 'protein', estimatedPrice: 5.00 },
        { name: 'Item 2', quantity: 3, unit: 'cups', category: 'grains', estimatedPrice: 1.00 }
      ];

      const list = service.createList(items);

      expect(list.totalEstimatedCost).toBe(13.00); // 2*5 + 3*1
    });
  });

  describe('Pattern-Based Generation', () => {
    it('should generate list from pattern needs', () => {
      const inventory = new Map([
        ['chicken-breast', { quantity: 1, unit: 'lbs' }],
        ['rice', { quantity: 2, unit: 'cups' }]
      ]);

      const items = service.generateFromPattern('traditional', inventory);

      expect(items.length).toBeGreaterThan(0);
      expect(items.find(i => i.name === 'Chicken Breast')?.quantity).toBe(2); // Need 3, have 1
    });

    it('should account for existing inventory', () => {
      const fullInventory = new Map([
        ['chicken-breast', { quantity: 10, unit: 'lbs' }],
        ['rice', { quantity: 20, unit: 'cups' }],
        ['black-beans', { quantity: 10, unit: 'cans' }],
        ['vegetables', { quantity: 10, unit: 'lbs' }],
        ['eggs', { quantity: 50, unit: 'count' }]
      ]);

      const items = service.generateFromPattern('traditional', fullInventory);

      expect(items).toHaveLength(0); // All needs met
    });

    it('should scale for multiple weeks', () => {
      const emptyInventory = new Map<string, { quantity: number; unit: string }>();

      const oneWeek = service.generateFromPattern('traditional', emptyInventory, 1);
      const twoWeeks = service.generateFromPattern('traditional', emptyInventory, 2);

      const chickenOneWeek = oneWeek.find(i => i.name === 'Chicken Breast')?.quantity || 0;
      const chickenTwoWeeks = twoWeeks.find(i => i.name === 'Chicken Breast')?.quantity || 0;

      expect(chickenTwoWeeks).toBe(chickenOneWeek * 2);
    });

    it('should return empty for invalid pattern', () => {
      const items = service.generateFromPattern('invalid-pattern', new Map());

      expect(items).toHaveLength(0);
    });
  });

  describe('Store Optimization', () => {
    it('should find best store by price', () => {
      const bestStore = service.findBestStore('chicken-breast', 'price');

      expect(bestStore).toBe('costco');
    });

    it('should find best store by quality', () => {
      const bestStore = service.findBestStore('chicken-breast', 'quality');

      expect(bestStore).toBe('wholefoods');
    });

    it('should return default for unknown ingredient', () => {
      const bestStore = service.findBestStore('unknown-ingredient');

      expect(bestStore).toBe('walmart');
    });

    it('should group items by store', () => {
      const items: ShoppingItem[] = [
        { id: '1', name: 'Chicken', quantity: 2, unit: 'lbs', category: 'protein', preferredStore: 'costco' },
        { id: '2', name: 'Rice', quantity: 5, unit: 'cups', category: 'grains', preferredStore: 'walmart' },
        { id: '3', name: 'Eggs', quantity: 12, unit: 'count', category: 'protein', preferredStore: 'costco' }
      ];

      const grouped = service.groupByStore(items);

      expect(grouped['costco']).toHaveLength(2);
      expect(grouped['walmart']).toHaveLength(1);
    });

    it('should optimize store route', () => {
      const stores = ['wholefoods', 'costco', 'safeway'];
      const optimized = service.optimizeRoute(stores);

      expect(optimized[0]).toBe('costco'); // Bulk first
      expect(optimized[optimized.length - 1]).toBe('wholefoods'); // Premium last
    });
  });

  describe('Budget Analysis', () => {
    it('should identify under budget', () => {
      const list = service.createList([
        { name: 'Item', quantity: 1, unit: 'each', category: 'other', estimatedPrice: 50 }
      ]);

      const analysis = service.calculateBudgetAnalysis(list, 100);

      expect(analysis.underBudget).toBe(true);
      expect(analysis.difference).toBe(50);
    });

    it('should identify over budget', () => {
      const list = service.createList([
        { name: 'Item', quantity: 1, unit: 'each', category: 'other', estimatedPrice: 150 }
      ]);

      const analysis = service.calculateBudgetAnalysis(list, 100);

      expect(analysis.underBudget).toBe(false);
      expect(analysis.difference).toBe(-50);
    });

    it('should provide suggestions for over budget', () => {
      const list = service.createList([
        { name: 'Item', quantity: 1, unit: 'each', category: 'other', estimatedPrice: 150 }
      ]);

      const analysis = service.calculateBudgetAnalysis(list, 100);

      expect(analysis.suggestions.length).toBeGreaterThan(0);
    });

    it('should calculate percent used', () => {
      const list = service.createList([
        { name: 'Item', quantity: 1, unit: 'each', category: 'other', estimatedPrice: 25 }
      ]);

      const analysis = service.calculateBudgetAnalysis(list, 100);

      expect(analysis.percentUsed).toBe(25);
    });
  });

  describe('List Manipulation', () => {
    it('should add item to list', () => {
      const list = service.createList([]);
      const updated = service.addItem(list, {
        name: 'New Item',
        quantity: 2,
        unit: 'lbs',
        category: 'protein',
        estimatedPrice: 5.00
      });

      expect(updated.items).toHaveLength(1);
      expect(updated.totalEstimatedCost).toBe(10);
    });

    it('should remove item from list', () => {
      const list = service.createList([
        { name: 'Item 1', quantity: 1, unit: 'each', category: 'other', estimatedPrice: 10 },
        { name: 'Item 2', quantity: 1, unit: 'each', category: 'other', estimatedPrice: 20 }
      ]);

      const itemToRemove = list.items[0];
      const updated = service.removeItem(list, itemToRemove.id);

      expect(updated.items).toHaveLength(1);
      expect(updated.totalEstimatedCost).toBe(20);
    });

    it('should update item quantity', () => {
      const list = service.createList([
        { name: 'Item', quantity: 2, unit: 'each', category: 'other', estimatedPrice: 5 }
      ]);

      const updated = service.updateQuantity(list, list.items[0].id, 4);

      expect(updated.items[0].quantity).toBe(4);
      expect(updated.totalEstimatedCost).toBe(20);
    });
  });

  describe('Item Merging', () => {
    it('should merge duplicate items', () => {
      const items: ShoppingItem[] = [
        { id: '1', name: 'Chicken', quantity: 2, unit: 'lbs', category: 'protein', preferredStore: 'costco' },
        { id: '2', name: 'Chicken', quantity: 3, unit: 'lbs', category: 'protein', preferredStore: 'costco' }
      ];

      const merged = service.mergeItems(items);

      expect(merged).toHaveLength(1);
      expect(merged[0].quantity).toBe(5);
    });

    it('should not merge items with different stores', () => {
      const items: ShoppingItem[] = [
        { id: '1', name: 'Chicken', quantity: 2, unit: 'lbs', category: 'protein', preferredStore: 'costco' },
        { id: '2', name: 'Chicken', quantity: 3, unit: 'lbs', category: 'protein', preferredStore: 'walmart' }
      ];

      const merged = service.mergeItems(items);

      expect(merged).toHaveLength(2);
    });
  });

  describe('Savings Calculation', () => {
    it('should calculate potential savings', () => {
      const items: ShoppingItem[] = [
        { id: '1', name: 'Chicken Breast', quantity: 3, unit: 'lbs', category: 'protein', preferredStore: 'wholefoods', estimatedPrice: 8.99 }
      ];

      const savings = service.calculateSavings(items);

      expect(savings.currentCost).toBeGreaterThan(savings.optimizedCost);
      expect(savings.savings).toBeGreaterThan(0);
    });
  });

  describe('Category Grouping', () => {
    it('should group items by category', () => {
      const items: ShoppingItem[] = [
        { id: '1', name: 'Chicken', quantity: 2, unit: 'lbs', category: 'protein' },
        { id: '2', name: 'Rice', quantity: 5, unit: 'cups', category: 'grains' },
        { id: '3', name: 'Eggs', quantity: 12, unit: 'count', category: 'protein' }
      ];

      const grouped = service.groupByCategory(items);

      expect(grouped['protein']).toHaveLength(2);
      expect(grouped['grains']).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty list', () => {
      const list = service.createList([]);

      expect(list.items).toHaveLength(0);
      expect(list.totalEstimatedCost).toBe(0);
    });

    it('should handle items without prices', () => {
      const items = [
        { name: 'Item', quantity: 5, unit: 'each', category: 'other' }
      ];

      const list = service.createList(items);

      expect(list.totalEstimatedCost).toBe(0);
    });

    it('should handle zero quantity items', () => {
      const list = service.createList([
        { name: 'Item', quantity: 0, unit: 'each', category: 'other', estimatedPrice: 10 }
      ]);

      expect(list.totalEstimatedCost).toBe(0);
    });
  });
});
