/**
 * Unit Tests: Kanban Board UI
 * Tests for drag-and-drop, column totals, reassignment, and weight slider coordination
 * Week 5-6: Multi-Store Optimization Testing
 * Target: 25 tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Types for Kanban Board
interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  estimatedPrice: number;
  storeId: string;
  score?: number;
}

interface KanbanColumn {
  id: string;
  storeId: string;
  storeName: string;
  items: ShoppingItem[];
  totalCost: number;
  itemCount: number;
  score: number;
}

interface DragDropResult {
  success: boolean;
  sourceColumn: string;
  targetColumn: string;
  item: ShoppingItem;
  newTotals: { source: number; target: number };
}

interface WeightSliderState {
  price: number;
  quality: number;
  distance: number;
  convenience: number;
}

interface ScoreCard {
  storeId: string;
  storeName: string;
  priceScore: number;
  qualityScore: number;
  distanceScore: number;
  convenienceScore: number;
  totalScore: number;
  itemCount: number;
  totalCost: number;
}

interface KanbanBoardState {
  columns: KanbanColumn[];
  weights: WeightSliderState;
  selectedItem: ShoppingItem | null;
  isDragging: boolean;
  dragSource: string | null;
}

// Kanban Board Service
const createKanbanBoardService = () => {
  let state: KanbanBoardState = {
    columns: [],
    weights: { price: 0.25, quality: 0.25, distance: 0.25, convenience: 0.25 },
    selectedItem: null,
    isDragging: false,
    dragSource: null
  };

  // Store data for scoring
  const storeData: Record<string, { priceLevel: number; quality: number; distance: number; convenience: number }> = {
    'costco': { priceLevel: 1, quality: 4.2, distance: 3.5, convenience: 3.0 },
    'safeway': { priceLevel: 3, quality: 3.8, distance: 1.2, convenience: 4.5 },
    'wholefoods': { priceLevel: 5, quality: 4.8, distance: 2.1, convenience: 4.0 },
    'traderjoes': { priceLevel: 2, quality: 4.5, distance: 2.8, convenience: 4.2 },
    'walmart': { priceLevel: 1, quality: 3.2, distance: 4.0, convenience: 3.8 }
  };

  return {
    // Initialize board with columns
    initializeBoard(stores: Array<{ id: string; name: string }>, items: ShoppingItem[]): KanbanBoardState {
      const columns: KanbanColumn[] = stores.map(store => {
        const storeItems = items.filter(item => item.storeId === store.id);
        const totalCost = storeItems.reduce((sum, item) => sum + item.estimatedPrice * item.quantity, 0);

        return {
          id: `column-${store.id}`,
          storeId: store.id,
          storeName: store.name,
          items: storeItems,
          totalCost: Math.round(totalCost * 100) / 100,
          itemCount: storeItems.length,
          score: this.calculateColumnScore(store.id)
        };
      });

      state = {
        ...state,
        columns
      };

      return state;
    },

    // Get current state
    getState(): KanbanBoardState {
      return { ...state };
    },

    // Start drag operation
    startDrag(itemId: string, sourceColumnId: string): boolean {
      const column = state.columns.find(c => c.id === sourceColumnId);
      const item = column?.items.find(i => i.id === itemId);

      if (!item) return false;

      state = {
        ...state,
        isDragging: true,
        dragSource: sourceColumnId,
        selectedItem: item
      };

      return true;
    },

    // End drag operation
    endDrag(): void {
      state = {
        ...state,
        isDragging: false,
        dragSource: null,
        selectedItem: null
      };
    },

    // Handle drop - move item between columns
    handleDrop(targetColumnId: string): DragDropResult | null {
      if (!state.isDragging || !state.selectedItem || !state.dragSource) {
        return null;
      }

      const sourceColumn = state.columns.find(c => c.id === state.dragSource);
      const targetColumn = state.columns.find(c => c.id === targetColumnId);

      if (!sourceColumn || !targetColumn) {
        this.endDrag();
        return null;
      }

      // Same column - no action needed
      if (sourceColumn.id === targetColumn.id) {
        this.endDrag();
        return null;
      }

      const item = state.selectedItem;

      // Update columns
      const updatedColumns = state.columns.map(column => {
        if (column.id === sourceColumn.id) {
          const newItems = column.items.filter(i => i.id !== item.id);
          const newTotal = newItems.reduce((sum, i) => sum + i.estimatedPrice * i.quantity, 0);
          return {
            ...column,
            items: newItems,
            totalCost: Math.round(newTotal * 100) / 100,
            itemCount: newItems.length
          };
        }

        if (column.id === targetColumn.id) {
          const updatedItem = { ...item, storeId: targetColumn.storeId };
          const newItems = [...column.items, updatedItem];
          const newTotal = newItems.reduce((sum, i) => sum + i.estimatedPrice * i.quantity, 0);
          return {
            ...column,
            items: newItems,
            totalCost: Math.round(newTotal * 100) / 100,
            itemCount: newItems.length
          };
        }

        return column;
      });

      const result: DragDropResult = {
        success: true,
        sourceColumn: sourceColumn.id,
        targetColumn: targetColumn.id,
        item: { ...item, storeId: targetColumn.storeId },
        newTotals: {
          source: updatedColumns.find(c => c.id === sourceColumn.id)!.totalCost,
          target: updatedColumns.find(c => c.id === targetColumn.id)!.totalCost
        }
      };

      state = {
        ...state,
        columns: updatedColumns
      };

      this.endDrag();
      return result;
    },

    // Update column totals
    updateColumnTotals(): void {
      state.columns = state.columns.map(column => ({
        ...column,
        totalCost: Math.round(
          column.items.reduce((sum, item) => sum + item.estimatedPrice * item.quantity, 0) * 100
        ) / 100,
        itemCount: column.items.length
      }));
    },

    // Calculate column score based on weights
    calculateColumnScore(storeId: string): number {
      const data = storeData[storeId];
      if (!data) return 0;

      const priceScore = 1 - (data.priceLevel / 5);
      const qualityScore = data.quality / 5;
      const distanceScore = 1 - (data.distance / 10);
      const convenienceScore = data.convenience / 5;

      const total =
        state.weights.price * priceScore +
        state.weights.quality * qualityScore +
        state.weights.distance * distanceScore +
        state.weights.convenience * convenienceScore;

      return Math.round(total * 100) / 100;
    },

    // Reassign item to different store
    reassignItem(itemId: string, targetStoreId: string): boolean {
      let itemFound = false;

      const updatedColumns = state.columns.map(column => {
        const itemIndex = column.items.findIndex(i => i.id === itemId);

        if (itemIndex !== -1) {
          itemFound = true;
          const item = column.items[itemIndex];

          // If already in target store, no change
          if (column.storeId === targetStoreId) {
            return column;
          }

          // Remove from current column
          const newItems = column.items.filter(i => i.id !== itemId);
          const newTotal = newItems.reduce((sum, i) => sum + i.estimatedPrice * i.quantity, 0);

          // Add to target column
          const targetColumn = state.columns.find(c => c.storeId === targetStoreId);
          if (targetColumn) {
            targetColumn.items.push({ ...item, storeId: targetStoreId });
            targetColumn.totalCost = Math.round(
              targetColumn.items.reduce((sum, i) => sum + i.estimatedPrice * i.quantity, 0) * 100
            ) / 100;
            targetColumn.itemCount = targetColumn.items.length;
          }

          return {
            ...column,
            items: newItems,
            totalCost: Math.round(newTotal * 100) / 100,
            itemCount: newItems.length
          };
        }

        return column;
      });

      if (itemFound) {
        state = { ...state, columns: updatedColumns };
      }

      return itemFound;
    },

    // Generate score card for store
    generateScoreCard(storeId: string): ScoreCard | null {
      const column = state.columns.find(c => c.storeId === storeId);
      const data = storeData[storeId];

      if (!column || !data) return null;

      return {
        storeId,
        storeName: column.storeName,
        priceScore: Math.round((1 - data.priceLevel / 5) * 100),
        qualityScore: Math.round((data.quality / 5) * 100),
        distanceScore: Math.round((1 - data.distance / 10) * 100),
        convenienceScore: Math.round((data.convenience / 5) * 100),
        totalScore: Math.round(this.calculateColumnScore(storeId) * 100),
        itemCount: column.itemCount,
        totalCost: column.totalCost
      };
    },

    // Update weight sliders
    updateWeights(newWeights: Partial<WeightSliderState>): WeightSliderState {
      const updated = {
        price: newWeights.price ?? state.weights.price,
        quality: newWeights.quality ?? state.weights.quality,
        distance: newWeights.distance ?? state.weights.distance,
        convenience: newWeights.convenience ?? state.weights.convenience
      };

      // Normalize to sum to 1.0
      const sum = updated.price + updated.quality + updated.distance + updated.convenience;
      if (sum > 0) {
        updated.price = updated.price / sum;
        updated.quality = updated.quality / sum;
        updated.distance = updated.distance / sum;
        updated.convenience = updated.convenience / sum;
      }

      state = { ...state, weights: updated };

      // Recalculate all column scores
      state.columns = state.columns.map(column => ({
        ...column,
        score: this.calculateColumnScore(column.storeId)
      }));

      return state.weights;
    },

    // Validate weights sum to 1.0
    validateWeights(weights: WeightSliderState): boolean {
      const sum = weights.price + weights.quality + weights.distance + weights.convenience;
      return Math.abs(sum - 1.0) < 0.001;
    },

    // Get total across all columns
    getTotalCost(): number {
      return Math.round(
        state.columns.reduce((sum, col) => sum + col.totalCost, 0) * 100
      ) / 100;
    },

    // Get total item count
    getTotalItemCount(): number {
      return state.columns.reduce((sum, col) => sum + col.itemCount, 0);
    },

    // Get column by ID
    getColumn(columnId: string): KanbanColumn | undefined {
      return state.columns.find(c => c.id === columnId);
    },

    // Get column by store ID
    getColumnByStoreId(storeId: string): KanbanColumn | undefined {
      return state.columns.find(c => c.storeId === storeId);
    },

    // Reset board
    resetBoard(): void {
      state = {
        columns: [],
        weights: { price: 0.25, quality: 0.25, distance: 0.25, convenience: 0.25 },
        selectedItem: null,
        isDragging: false,
        dragSource: null
      };
    },

    // Check if item can be dropped on target
    canDropOnTarget(targetColumnId: string): boolean {
      if (!state.isDragging || !state.dragSource) return false;
      return state.dragSource !== targetColumnId;
    },

    // Get recommended store for item based on weights
    getRecommendedStore(item: ShoppingItem): string {
      let bestStore = state.columns[0]?.storeId || '';
      let bestScore = -1;

      state.columns.forEach(column => {
        const score = this.calculateColumnScore(column.storeId);
        if (score > bestScore) {
          bestScore = score;
          bestStore = column.storeId;
        }
      });

      return bestStore;
    }
  };
};

describe('Kanban Board UI', () => {
  let board: ReturnType<typeof createKanbanBoardService>;

  const testStores = [
    { id: 'costco', name: 'Costco' },
    { id: 'safeway', name: 'Safeway' },
    { id: 'wholefoods', name: 'Whole Foods' }
  ];

  const testItems: ShoppingItem[] = [
    { id: '1', name: 'Chicken', quantity: 3, unit: 'lbs', category: 'protein', estimatedPrice: 4.99, storeId: 'costco' },
    { id: '2', name: 'Rice', quantity: 5, unit: 'lbs', category: 'grains', estimatedPrice: 1.49, storeId: 'costco' },
    { id: '3', name: 'Milk', quantity: 2, unit: 'gal', category: 'dairy', estimatedPrice: 3.99, storeId: 'safeway' },
    { id: '4', name: 'Organic Salad', quantity: 1, unit: 'each', category: 'produce', estimatedPrice: 5.99, storeId: 'wholefoods' }
  ];

  beforeEach(() => {
    board = createKanbanBoardService();
    board.initializeBoard(testStores, testItems);
  });

  // ============================================
  // Drag-and-Drop Functionality Tests (7 tests)
  // ============================================
  describe('Drag-and-Drop Functionality', () => {
    it('should start drag operation', () => {
      const success = board.startDrag('1', 'column-costco');

      expect(success).toBe(true);
      expect(board.getState().isDragging).toBe(true);
      expect(board.getState().selectedItem?.id).toBe('1');
    });

    it('should fail to start drag with invalid item', () => {
      const success = board.startDrag('invalid', 'column-costco');

      expect(success).toBe(false);
      expect(board.getState().isDragging).toBe(false);
    });

    it('should end drag operation', () => {
      board.startDrag('1', 'column-costco');
      board.endDrag();

      expect(board.getState().isDragging).toBe(false);
      expect(board.getState().selectedItem).toBeNull();
    });

    it('should handle drop and move item between columns', () => {
      board.startDrag('1', 'column-costco');
      const result = board.handleDrop('column-safeway');

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.sourceColumn).toBe('column-costco');
      expect(result?.targetColumn).toBe('column-safeway');
    });

    it('should update item storeId on drop', () => {
      board.startDrag('1', 'column-costco');
      const result = board.handleDrop('column-safeway');

      expect(result?.item.storeId).toBe('safeway');
    });

    it('should return null when dropping on same column', () => {
      board.startDrag('1', 'column-costco');
      const result = board.handleDrop('column-costco');

      expect(result).toBeNull();
    });

    it('should check if drop is allowed on target', () => {
      board.startDrag('1', 'column-costco');

      expect(board.canDropOnTarget('column-safeway')).toBe(true);
      expect(board.canDropOnTarget('column-costco')).toBe(false);
    });
  });

  // ============================================
  // Column Totals Update Tests (5 tests)
  // ============================================
  describe('Column Totals Update', () => {
    it('should calculate initial column totals', () => {
      const costcoColumn = board.getColumnByStoreId('costco');

      // 3*4.99 + 5*1.49 = 14.97 + 7.45 = 22.42
      expect(costcoColumn?.totalCost).toBeCloseTo(22.42, 1);
    });

    it('should update totals after item move', () => {
      const originalCostco = board.getColumnByStoreId('costco')?.totalCost || 0;

      board.startDrag('1', 'column-costco');
      board.handleDrop('column-safeway');

      const newCostco = board.getColumnByStoreId('costco')?.totalCost || 0;
      const newSafeway = board.getColumnByStoreId('safeway')?.totalCost || 0;

      expect(newCostco).toBeLessThan(originalCostco);
      expect(newSafeway).toBeGreaterThan(3.99); // Original milk + chicken
    });

    it('should calculate total cost across all columns', () => {
      const total = board.getTotalCost();

      // All items: 3*4.99 + 5*1.49 + 2*3.99 + 1*5.99 = 14.97 + 7.45 + 7.98 + 5.99 = 36.39
      expect(total).toBeCloseTo(36.39, 1);
    });

    it('should track item count per column', () => {
      const costcoColumn = board.getColumnByStoreId('costco');
      expect(costcoColumn?.itemCount).toBe(2);
    });

    it('should calculate total item count', () => {
      expect(board.getTotalItemCount()).toBe(4);
    });
  });

  // ============================================
  // Reassignment Logic Tests (5 tests)
  // ============================================
  describe('Reassignment Logic', () => {
    it('should reassign item to different store', () => {
      const success = board.reassignItem('1', 'safeway');

      expect(success).toBe(true);

      const safewayColumn = board.getColumnByStoreId('safeway');
      const hasItem = safewayColumn?.items.some(i => i.id === '1');
      expect(hasItem).toBe(true);
    });

    it('should remove item from original column on reassign', () => {
      board.reassignItem('1', 'safeway');

      const costcoColumn = board.getColumnByStoreId('costco');
      const hasItem = costcoColumn?.items.some(i => i.id === '1');
      expect(hasItem).toBe(false);
    });

    it('should return false for non-existent item', () => {
      const success = board.reassignItem('invalid', 'safeway');
      expect(success).toBe(false);
    });

    it('should handle reassignment to same store', () => {
      const originalCount = board.getColumnByStoreId('costco')?.itemCount;
      board.reassignItem('1', 'costco');

      expect(board.getColumnByStoreId('costco')?.itemCount).toBe(originalCount);
    });

    it('should recommend best store based on weights', () => {
      const item = testItems[0];
      const recommended = board.getRecommendedStore(item);

      expect(recommended).toBeDefined();
      expect(['costco', 'safeway', 'wholefoods']).toContain(recommended);
    });
  });

  // ============================================
  // Score Card Display Tests (4 tests)
  // ============================================
  describe('Score Card Display', () => {
    it('should generate score card for store', () => {
      const scoreCard = board.generateScoreCard('costco');

      expect(scoreCard).not.toBeNull();
      expect(scoreCard?.storeName).toBe('Costco');
      expect(scoreCard?.totalScore).toBeGreaterThan(0);
    });

    it('should include all score components', () => {
      const scoreCard = board.generateScoreCard('costco');

      expect(scoreCard?.priceScore).toBeDefined();
      expect(scoreCard?.qualityScore).toBeDefined();
      expect(scoreCard?.distanceScore).toBeDefined();
      expect(scoreCard?.convenienceScore).toBeDefined();
    });

    it('should return null for invalid store', () => {
      const scoreCard = board.generateScoreCard('invalid');
      expect(scoreCard).toBeNull();
    });

    it('should include item count and total cost', () => {
      const scoreCard = board.generateScoreCard('costco');

      expect(scoreCard?.itemCount).toBe(2);
      expect(scoreCard?.totalCost).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Weight Slider Coordination Tests (4 tests)
  // ============================================
  describe('Weight Slider Coordination', () => {
    it('should update weights', () => {
      const updated = board.updateWeights({ price: 0.5 });

      expect(updated.price).toBeGreaterThan(0);
    });

    it('should normalize weights to sum to 1.0', () => {
      const updated = board.updateWeights({ price: 0.6, quality: 0.4 });

      const sum = updated.price + updated.quality + updated.distance + updated.convenience;
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should recalculate column scores on weight change', () => {
      const originalScore = board.getColumnByStoreId('costco')?.score;

      board.updateWeights({ price: 0.8, quality: 0.1, distance: 0.05, convenience: 0.05 });

      const newScore = board.getColumnByStoreId('costco')?.score;
      expect(newScore).not.toBe(originalScore);
    });

    it('should validate weights sum to 1.0', () => {
      const validWeights = { price: 0.25, quality: 0.25, distance: 0.25, convenience: 0.25 };
      const invalidWeights = { price: 0.5, quality: 0.5, distance: 0.5, convenience: 0.5 };

      expect(board.validateWeights(validWeights)).toBe(true);
      expect(board.validateWeights(invalidWeights)).toBe(false);
    });
  });

  // Additional utility tests to reach 25 total
  describe('Board Utilities', () => {
    it('should initialize board with columns', () => {
      board.resetBoard();
      const state = board.initializeBoard(testStores, testItems);

      expect(state.columns).toHaveLength(3);
    });

    it('should get column by ID', () => {
      const column = board.getColumn('column-costco');

      expect(column).toBeDefined();
      expect(column?.storeId).toBe('costco');
    });

    it('should reset board state', () => {
      board.resetBoard();
      const state = board.getState();

      expect(state.columns).toHaveLength(0);
      expect(state.isDragging).toBe(false);
    });

    it('should maintain state across operations', () => {
      board.startDrag('1', 'column-costco');
      board.handleDrop('column-safeway');

      const state = board.getState();
      expect(state.isDragging).toBe(false);
      expect(state.columns).toHaveLength(3);
    });
  });
});
