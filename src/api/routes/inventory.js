/**
 * Inventory Routes
 * Endpoints for managing food inventory with expiry tracking
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  validate,
  inventoryItemSchema,
  inventoryBatchSchema,
  inventoryUpdateSchema,
  inventoryConsumeSchema
} = require('../validators');
const { inventoryService, mealService } = require('../services/dataStore');
const { createInventoryItem } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

// All inventory routes require authentication
router.use(authenticate);

/**
 * @route GET /api/inventory
 * @desc Get all inventory items with optional filters
 * @access Private
 */
router.get('/', (req, res) => {
  const { category, location, includeExpired = 'false' } = req.query;

  let items = inventoryService.findByUser(req.user.id, { category, location });

  if (includeExpired !== 'true') {
    items = items.filter(i => i.expiryStatus !== 'expired');
  }

  // Group by category
  const byCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  // Summary stats
  const summary = {
    totalItems: items.length,
    totalValue: items.reduce((sum, i) => sum + (i.purchasePrice || 0), 0),
    expiringCount: items.filter(i => i.expiryStatus === 'expiring').length,
    urgentCount: items.filter(i => i.expiryStatus === 'urgent').length,
    expiredCount: items.filter(i => i.expiryStatus === 'expired').length
  };

  res.json({
    items,
    byCategory,
    summary
  });
});

/**
 * @route GET /api/inventory/expiring
 * @desc Get items expiring within specified hours
 * @access Private
 */
router.get('/expiring', (req, res) => {
  const { hours = 48 } = req.query;

  const items = inventoryService.findExpiring(req.user.id, parseInt(hours));

  // Group by urgency
  const urgent = items.filter(i => {
    if (!i.expiryDate) return false;
    const hoursLeft = (new Date(i.expiryDate) - new Date()) / (1000 * 60 * 60);
    return hoursLeft < 24;
  });

  const soon = items.filter(i => {
    if (!i.expiryDate) return false;
    const hoursLeft = (new Date(i.expiryDate) - new Date()) / (1000 * 60 * 60);
    return hoursLeft >= 24 && hoursLeft < parseInt(hours);
  });

  res.json({
    items,
    urgent,
    soon,
    summary: {
      urgentCount: urgent.length,
      soonCount: soon.length,
      totalExpiring: items.length
    },
    recommendations: items.map(i => ({
      item: i.name,
      expiresIn: i.expiryDate
        ? Math.ceil((new Date(i.expiryDate) - new Date()) / (1000 * 60 * 60))
        : null,
      suggestion: 'Consider using in next meal'
    }))
  });
});

/**
 * @route POST /api/inventory
 * @desc Add a single inventory item
 * @access Private
 */
router.post('/', validate(inventoryItemSchema), (req, res) => {
  const item = createInventoryItem(req.user.id, req.body);
  inventoryService.create(item);

  res.status(201).json({
    message: 'Inventory item added',
    item
  });
});

/**
 * @route POST /api/inventory/batch
 * @desc Add multiple inventory items at once
 * @access Private
 */
router.post('/batch', validate(inventoryBatchSchema), (req, res) => {
  const { items } = req.body;

  const createdItems = items.map(itemData =>
    createInventoryItem(req.user.id, itemData)
  );

  inventoryService.createBatch(createdItems);

  res.status(201).json({
    message: `${createdItems.length} items added to inventory`,
    items: createdItems,
    summary: {
      count: createdItems.length,
      categories: [...new Set(createdItems.map(i => i.category))]
    }
  });
});

/**
 * @route GET /api/inventory/:id
 * @desc Get a specific inventory item
 * @access Private
 */
router.get('/:id', (req, res) => {
  const item = inventoryService.findById(req.params.id);

  if (!item) {
    throw new ApiError(404, 'Inventory item not found');
  }

  if (item.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  res.json({ item });
});

/**
 * @route PUT /api/inventory/:id
 * @desc Update an inventory item
 * @access Private
 */
router.put('/:id', validate(inventoryUpdateSchema), (req, res) => {
  const item = inventoryService.findById(req.params.id);

  if (!item) {
    throw new ApiError(404, 'Inventory item not found');
  }

  if (item.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  const updatedItem = inventoryService.update(req.params.id, req.body);

  res.json({
    message: 'Inventory item updated',
    item: updatedItem
  });
});

/**
 * @route POST /api/inventory/consume
 * @desc Auto-deduct inventory from meal logging
 * @access Private
 */
router.post('/consume', validate(inventoryConsumeSchema), (req, res) => {
  const { mealId, items } = req.body;

  // Verify meal exists and belongs to user
  const meal = mealService.findById(mealId);
  if (!meal) {
    throw new ApiError(404, 'Meal not found');
  }
  if (meal.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  const consumedItems = [];
  const errors = [];

  for (const { inventoryId, quantityUsed } of items) {
    const item = inventoryService.findById(inventoryId);

    if (!item) {
      errors.push({ inventoryId, error: 'Item not found' });
      continue;
    }

    if (item.userId !== req.user.id) {
      errors.push({ inventoryId, error: 'Access denied' });
      continue;
    }

    if (item.quantity < quantityUsed) {
      errors.push({
        inventoryId,
        error: 'Insufficient quantity',
        available: item.quantity,
        requested: quantityUsed
      });
      continue;
    }

    const updated = inventoryService.consume(inventoryId, quantityUsed);
    consumedItems.push({
      item: item.name,
      consumed: quantityUsed,
      remaining: updated.quantity,
      unit: item.unit
    });
  }

  res.json({
    message: `Consumed ${consumedItems.length} items from inventory`,
    consumed: consumedItems,
    errors: errors.length > 0 ? errors : undefined,
    mealId
  });
});

/**
 * @route DELETE /api/inventory/:id
 * @desc Remove an inventory item
 * @access Private
 */
router.delete('/:id', (req, res) => {
  const item = inventoryService.findById(req.params.id);

  if (!item) {
    throw new ApiError(404, 'Inventory item not found');
  }

  if (item.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  inventoryService.delete(req.params.id);

  res.json({
    message: 'Inventory item removed',
    deletedId: req.params.id
  });
});

/**
 * @route GET /api/inventory/low-stock
 * @desc Get items that are running low
 * @access Private
 */
router.get('/status/low-stock', (req, res) => {
  const items = inventoryService.findByUser(req.user.id);

  // Define low stock thresholds by category
  const thresholds = {
    protein: 2,
    carbohydrate: 3,
    vegetable: 2,
    fruit: 2,
    dairy: 1,
    default: 1
  };

  const lowStock = items.filter(item => {
    const threshold = thresholds[item.category] || thresholds.default;
    return item.quantity <= threshold && item.quantity > 0;
  });

  const outOfStock = items.filter(item => item.quantity === 0);

  res.json({
    lowStock,
    outOfStock,
    summary: {
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length
    },
    shoppingRecommendations: [...lowStock, ...outOfStock].map(i => ({
      name: i.name,
      category: i.category,
      currentQuantity: i.quantity,
      suggestedQuantity: (thresholds[i.category] || thresholds.default) * 2
    }))
  });
});

module.exports = router;
