/**
 * Shopping Routes
 * Endpoints for shopping list generation and management
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  validate,
  shoppingGenerateSchema,
  shoppingOptimizeSchema,
  shoppingCheckSchema
} = require('../validators');
const { shoppingService, inventoryService, patternService } = require('../services/dataStore');
const { createShoppingList, PatternConfigs } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

// All shopping routes require authentication
router.use(authenticate);

/**
 * @route GET /api/shopping
 * @desc Get all shopping lists for user
 * @access Private
 */
router.get('/', (req, res) => {
  const { status } = req.query;

  const lists = shoppingService.findByUser(req.user.id, { status });

  res.json({
    lists,
    count: lists.length
  });
});

/**
 * @route GET /api/shopping/generate
 * @desc Generate shopping list from selected patterns
 * @access Private
 */
router.get('/generate', (req, res) => {
  const { startDate, endDate, excludeInventory = 'true' } = req.query;

  // Get patterns for date range
  const patterns = patternService.findByUser(req.user.id, { startDate, endDate });

  if (patterns.length === 0) {
    return res.json({
      message: 'No patterns found for date range',
      items: [],
      patterns: []
    });
  }

  // Generate shopping items from pattern configurations
  const items = generateShoppingItems(patterns);

  // Optionally exclude items already in inventory
  let finalItems = items;
  if (excludeInventory === 'true') {
    const inventory = inventoryService.findByUser(req.user.id);
    finalItems = items.filter(item => {
      const inStock = inventory.find(i =>
        i.name.toLowerCase() === item.name.toLowerCase() &&
        i.quantity > 0
      );
      return !inStock;
    });
  }

  res.json({
    items: finalItems,
    patterns: patterns.map(p => ({ id: p.id, type: p.patternType, date: p.date })),
    summary: {
      totalItems: finalItems.length,
      estimatedTotal: finalItems.reduce((sum, i) => sum + (i.estimatedPrice || 0), 0),
      categories: [...new Set(finalItems.map(i => i.category))]
    }
  });
});

/**
 * @route POST /api/shopping/generate
 * @desc Create a shopping list from patterns
 * @access Private
 */
router.post('/generate', validate(shoppingGenerateSchema), (req, res) => {
  const { patterns, excludeInventory } = req.body;

  // Generate items from pattern configurations
  const patternConfigs = patterns.map(p => ({
    ...PatternConfigs[p.patternType],
    date: p.date
  }));

  const items = generateShoppingItemsFromConfigs(patternConfigs);

  // Exclude inventory items if requested
  let finalItems = items;
  if (excludeInventory) {
    const inventory = inventoryService.findByUser(req.user.id);
    finalItems = items.filter(item => {
      const inStock = inventory.find(i =>
        i.name.toLowerCase() === item.name.toLowerCase() &&
        i.quantity >= item.quantity
      );
      return !inStock;
    });
  }

  // Calculate week of from earliest pattern date
  const weekOf = patterns.map(p => p.date).sort()[0];

  const list = createShoppingList(req.user.id, {
    weekOf,
    patterns: patterns.map(p => p.patternType),
    items: finalItems,
    totalEstimated: finalItems.reduce((sum, i) => sum + (i.estimatedPrice || 0), 0)
  });

  shoppingService.create(list);

  res.status(201).json({
    message: 'Shopping list created',
    list,
    summary: {
      itemCount: list.items.length,
      estimatedTotal: list.totalEstimated,
      patterns: list.patterns
    }
  });
});

/**
 * @route POST /api/shopping/optimize
 * @desc Optimize shopping list by store
 * @access Private
 */
router.post('/optimize', validate(shoppingOptimizeSchema), (req, res) => {
  const { listId, stores, weights } = req.body;

  const list = shoppingService.findById(listId);
  if (!list) {
    throw new ApiError(404, 'Shopping list not found');
  }

  if (list.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  // Default weights if not provided
  const optimizationWeights = weights || {
    price: 0.4,
    distance: 0.3,
    quality: 0.2,
    time: 0.1
  };

  // Simulate store optimization (in real implementation, this would use store data)
  const storeAssignments = optimizeByStore(list.items, stores, optimizationWeights);

  // Update list with store assignments
  const optimizedItems = list.items.map(item => {
    const assignment = storeAssignments.find(a => a.itemId === item.id);
    return {
      ...item,
      store: assignment?.store || stores[0],
      storeScore: assignment?.score || 0.5
    };
  });

  const updatedList = shoppingService.update(listId, {
    items: optimizedItems,
    optimizedAt: new Date().toISOString(),
    optimizationWeights
  });

  // Group by store
  const byStore = stores.reduce((acc, store) => {
    acc[store] = optimizedItems
      .filter(i => i.store === store)
      .map(i => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        estimatedPrice: i.estimatedPrice
      }));
    return acc;
  }, {});

  res.json({
    message: 'Shopping list optimized',
    list: updatedList,
    byStore,
    summary: {
      storeCount: stores.length,
      distribution: stores.map(store => ({
        store,
        itemCount: byStore[store].length,
        estimatedTotal: byStore[store].reduce((sum, i) => sum + (i.estimatedPrice || 0), 0)
      }))
    }
  });
});

/**
 * @route PUT /api/shopping/check/:id
 * @desc Mark a shopping item as purchased
 * @access Private
 */
router.put('/check/:id', validate(shoppingCheckSchema), (req, res) => {
  const { purchased, actualPrice, store, notes } = req.body;
  const itemId = req.params.id;

  // Find the list containing this item
  const lists = shoppingService.findByUser(req.user.id);
  let targetList = null;

  for (const list of lists) {
    if (list.items.some(i => i.id === itemId)) {
      targetList = list;
      break;
    }
  }

  if (!targetList) {
    throw new ApiError(404, 'Shopping item not found');
  }

  const updates = { purchased };
  if (actualPrice !== undefined) updates.actualPrice = actualPrice;
  if (store) updates.store = store;
  if (notes) updates.notes = notes;

  const updatedItem = shoppingService.updateItem(targetList.id, itemId, updates);

  const refreshedList = shoppingService.findById(targetList.id);

  res.json({
    message: purchased ? 'Item marked as purchased' : 'Item marked as unpurchased',
    item: updatedItem,
    progress: {
      purchased: refreshedList.items.filter(i => i.purchased).length,
      total: refreshedList.items.length,
      percentage: Math.round(
        (refreshedList.items.filter(i => i.purchased).length /
         refreshedList.items.length) * 100
      )
    },
    totals: {
      estimated: refreshedList.totalEstimated,
      actual: refreshedList.totalActual,
      savings: refreshedList.totalEstimated - (refreshedList.totalActual || 0)
    }
  });
});

/**
 * @route GET /api/shopping/:id
 * @desc Get a specific shopping list
 * @access Private
 */
router.get('/:id', (req, res) => {
  const list = shoppingService.findById(req.params.id);

  if (!list) {
    throw new ApiError(404, 'Shopping list not found');
  }

  if (list.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  // Group by category
  const byCategory = list.items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  res.json({
    list,
    byCategory,
    progress: {
      purchased: list.items.filter(i => i.purchased).length,
      total: list.items.length
    }
  });
});

/**
 * @route DELETE /api/shopping/:id
 * @desc Delete a shopping list
 * @access Private
 */
router.delete('/:id', (req, res) => {
  const list = shoppingService.findById(req.params.id);

  if (!list) {
    throw new ApiError(404, 'Shopping list not found');
  }

  if (list.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  shoppingService.delete(req.params.id);

  res.json({
    message: 'Shopping list deleted',
    deletedId: req.params.id
  });
});

// Helper function to generate shopping items from patterns
function generateShoppingItems(patterns) {
  const items = [];
  const itemMap = new Map();

  for (const pattern of patterns) {
    const config = PatternConfigs[pattern.patternType];
    if (!config) continue;

    // Add common ingredients based on pattern type
    const ingredients = getPatternIngredients(pattern.patternType);

    for (const ingredient of ingredients) {
      const key = ingredient.name.toLowerCase();
      if (itemMap.has(key)) {
        const existing = itemMap.get(key);
        existing.quantity += ingredient.quantity;
      } else {
        itemMap.set(key, { ...ingredient });
      }
    }
  }

  return Array.from(itemMap.values());
}

function generateShoppingItemsFromConfigs(configs) {
  const items = [];
  const itemMap = new Map();

  for (const config of configs) {
    const ingredients = getPatternIngredients(config.id);

    for (const ingredient of ingredients) {
      const key = ingredient.name.toLowerCase();
      if (itemMap.has(key)) {
        const existing = itemMap.get(key);
        existing.quantity += ingredient.quantity;
      } else {
        itemMap.set(key, { ...ingredient });
      }
    }
  }

  return Array.from(itemMap.values());
}

function getPatternIngredients(patternType) {
  // Base ingredients that appear in most patterns
  const baseIngredients = [
    { name: 'Eggs', category: 'protein', quantity: 6, unit: 'count', estimatedPrice: 4.00 },
    { name: 'Rice', category: 'carbohydrate', quantity: 2, unit: 'cup', estimatedPrice: 2.50 },
    { name: 'Mixed vegetables', category: 'vegetable', quantity: 2, unit: 'cup', estimatedPrice: 3.00 },
    { name: 'Cheese blend', category: 'dairy', quantity: 1, unit: 'cup', estimatedPrice: 5.00 }
  ];

  // Pattern-specific additions
  const patternSpecific = {
    traditional: [
      { name: 'Chicken breast', category: 'protein', quantity: 12, unit: 'oz', estimatedPrice: 8.00 },
      { name: 'Black beans', category: 'protein', quantity: 2, unit: 'can', estimatedPrice: 3.00 },
      { name: 'Miso paste', category: 'condiment', quantity: 1, unit: 'count', estimatedPrice: 4.00 }
    ],
    reversed: [
      { name: 'Salmon', category: 'protein', quantity: 12, unit: 'oz', estimatedPrice: 12.00 },
      { name: 'Leafy greens', category: 'vegetable', quantity: 4, unit: 'cup', estimatedPrice: 4.00 }
    ],
    if_noon: [
      { name: 'Chicken breast', category: 'protein', quantity: 12, unit: 'oz', estimatedPrice: 8.00 },
      { name: 'Avocado', category: 'fat', quantity: 2, unit: 'count', estimatedPrice: 4.00 },
      { name: 'Pineapple', category: 'fruit', quantity: 1, unit: 'count', estimatedPrice: 3.00 }
    ],
    grazing_mini: [
      { name: 'Arepas', category: 'carbohydrate', quantity: 4, unit: 'count', estimatedPrice: 5.00 },
      { name: 'Black beans', category: 'protein', quantity: 1, unit: 'can', estimatedPrice: 1.50 },
      { name: 'Chicken breast', category: 'protein', quantity: 8, unit: 'oz', estimatedPrice: 6.00 }
    ],
    grazing_platter: [
      { name: 'Hard-boiled eggs', category: 'protein', quantity: 6, unit: 'count', estimatedPrice: 4.00 },
      { name: 'String cheese', category: 'dairy', quantity: 4, unit: 'count', estimatedPrice: 4.00 },
      { name: 'Crackers', category: 'carbohydrate', quantity: 1, unit: 'box', estimatedPrice: 4.00 },
      { name: 'Hummus', category: 'fat', quantity: 1, unit: 'container', estimatedPrice: 4.00 }
    ],
    big_breakfast: [
      { name: 'Eggs', category: 'protein', quantity: 6, unit: 'count', estimatedPrice: 4.00 },
      { name: 'Black beans', category: 'protein', quantity: 1, unit: 'can', estimatedPrice: 1.50 },
      { name: 'Banana', category: 'fruit', quantity: 4, unit: 'count', estimatedPrice: 2.00 }
    ],
    morning_feast: [
      { name: 'Arepas', category: 'carbohydrate', quantity: 4, unit: 'count', estimatedPrice: 5.00 },
      { name: 'Eggs', category: 'protein', quantity: 6, unit: 'count', estimatedPrice: 4.00 },
      { name: 'Black beans', category: 'protein', quantity: 2, unit: 'can', estimatedPrice: 3.00 }
    ]
  };

  return [...baseIngredients, ...(patternSpecific[patternType] || [])];
}

function optimizeByStore(items, stores, weights) {
  // Simulate store optimization
  // In real implementation, this would use actual store pricing data
  return items.map(item => {
    // Assign to best store based on category and weights
    const scores = stores.map(store => ({
      store,
      score: Math.random() * 0.5 + 0.5 // Simulated score 0.5-1.0
    }));

    scores.sort((a, b) => b.score - a.score);

    return {
      itemId: item.id,
      store: scores[0].store,
      score: scores[0].score
    };
  });
}

module.exports = router;
