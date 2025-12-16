/**
 * Inventory Routes
 * Endpoints for managing kitchen inventory
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import inventoryService from '../database/services/inventoryService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All inventory routes require authentication
router.use(authenticate);

/**
 * @route GET /api/inventory
 * @desc Get all inventory items for user
 * @access Private
 */
router.get('/', async (req: Request, res: Response) => {
  const { category, location } = req.query;

  const items = await inventoryService.findByUser(req.user!.id, {
    category: category as string,
    location: location as string
  });

  res.json({
    items,
    summary: {
      total: items.length,
      byLocation: groupBy(items, 'location'),
      byCategory: groupBy(items, 'category'),
      expiring: items.filter(i => i.expiryStatus === 'expiring' || i.expiryStatus === 'urgent').length,
      expired: items.filter(i => i.expiryStatus === 'expired').length
    }
  });
});

/**
 * @route GET /api/inventory/expiring
 * @desc Get items expiring soon
 * @access Private
 */
router.get('/expiring', async (req: Request, res: Response) => {
  const hours = parseInt(req.query.hours as string) || 48;
  const items = await inventoryService.findExpiring(req.user!.id, hours);

  res.json({
    items,
    count: items.length,
    hoursAhead: hours,
    recommendations: items.map(item => ({
      item: item.name,
      expiresIn: getHoursUntilExpiry(item.expiryDate),
      suggestion: getSuggestion(item)
    }))
  });
});

/**
 * @route GET /api/inventory/:id
 * @desc Get specific inventory item
 * @access Private
 */
router.get('/:id', async (req: Request, res: Response) => {
  const item = await inventoryService.findById(req.params.id);

  if (!item) {
    throw new ApiError(404, 'Inventory item not found');
  }

  if (item.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  res.json({ item });
});

/**
 * @route POST /api/inventory
 * @desc Add item to inventory
 * @access Private
 */
router.post('/', async (req: Request, res: Response) => {
  const {
    name,
    category,
    subcategory,
    quantity,
    unit,
    location,
    purchaseDate,
    expiryDate,
    purchasePrice,
    barcode,
    notes
  } = req.body;

  if (!name || !category || quantity === undefined || !unit) {
    throw new ApiError(400, 'Name, category, quantity, and unit are required');
  }

  const item = await inventoryService.create({
    id: uuidv4(),
    userId: req.user!.id,
    name,
    category,
    subcategory,
    quantity,
    unit,
    location: location || 'pantry',
    purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
    expiryDate: expiryDate ? new Date(expiryDate) : undefined,
    purchasePrice,
    barcode,
    notes
  });

  res.status(201).json({
    message: 'Item added to inventory',
    item
  });
});

/**
 * @route POST /api/inventory/batch
 * @desc Add multiple items to inventory
 * @access Private
 */
router.post('/batch', async (req: Request, res: Response) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Items array is required');
  }

  const itemsToCreate = items.map(item => ({
    id: uuidv4(),
    userId: req.user!.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    quantity: item.quantity,
    unit: item.unit,
    location: item.location || 'pantry',
    purchaseDate: item.purchaseDate ? new Date(item.purchaseDate) : undefined,
    expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
    purchasePrice: item.purchasePrice,
    barcode: item.barcode,
    notes: item.notes
  }));

  const created = await inventoryService.createBatch(itemsToCreate);

  res.status(201).json({
    message: `${created.length} items added to inventory`,
    items: created
  });
});

/**
 * @route PUT /api/inventory/:id
 * @desc Update inventory item
 * @access Private
 */
router.put('/:id', async (req: Request, res: Response) => {
  const item = await inventoryService.findById(req.params.id);

  if (!item) {
    throw new ApiError(404, 'Inventory item not found');
  }

  if (item.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const updated = await inventoryService.update(req.params.id, req.body);

  res.json({
    message: 'Item updated',
    item: updated
  });
});

/**
 * @route POST /api/inventory/:id/consume
 * @desc Consume quantity from inventory item
 * @access Private
 */
router.post('/:id/consume', async (req: Request, res: Response) => {
  const { quantity } = req.body;

  if (quantity === undefined || quantity <= 0) {
    throw new ApiError(400, 'Valid quantity is required');
  }

  const item = await inventoryService.findById(req.params.id);

  if (!item) {
    throw new ApiError(404, 'Inventory item not found');
  }

  if (item.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const updated = await inventoryService.consume(req.params.id, quantity);

  res.json({
    message: 'Quantity consumed',
    item: updated,
    consumed: quantity,
    remaining: updated.quantity,
    depleted: updated.quantity === 0
  });
});

/**
 * @route DELETE /api/inventory/:id
 * @desc Delete inventory item
 * @access Private
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const item = await inventoryService.findById(req.params.id);

  if (!item) {
    throw new ApiError(404, 'Inventory item not found');
  }

  if (item.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  await inventoryService.delete(req.params.id);

  res.json({ message: 'Item deleted' });
});

// Helper functions
function groupBy(items: any[], key: string): Record<string, number> {
  return items.reduce((acc, item) => {
    const value = item[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function getHoursUntilExpiry(expiryDate: Date | null): number | null {
  if (!expiryDate) return null;
  return Math.round((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60));
}

function getSuggestion(item: any): string {
  const hours = getHoursUntilExpiry(item.expiryDate);
  if (hours === null) return 'No expiry date set';
  if (hours < 0) return 'Expired - dispose or use immediately if safe';
  if (hours < 24) return 'Use today in your next meal';
  if (hours < 48) return 'Plan to use within 2 days';
  return 'Use within the week';
}

export default router;
