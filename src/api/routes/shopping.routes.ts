/**
 * Shopping Routes
 * Endpoints for managing shopping lists
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import shoppingService from '../database/services/shoppingService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All shopping routes require authentication
router.use(authenticate);

/**
 * @route GET /api/shopping
 * @desc Get all shopping lists for user
 * @access Private
 */
router.get('/', async (req: Request, res: Response) => {
  const { status } = req.query;

  const lists = await shoppingService.findByUser(req.user!.id, {
    status: status as string
  });

  res.json({
    lists,
    summary: {
      total: lists.length,
      active: lists.filter(l => l.status === 'active').length,
      completed: lists.filter(l => l.status === 'completed').length,
      draft: lists.filter(l => l.status === 'draft').length
    }
  });
});

/**
 * @route GET /api/shopping/current
 * @desc Get current active shopping list
 * @access Private
 */
router.get('/current', async (req: Request, res: Response) => {
  const lists = await shoppingService.findByUser(req.user!.id, { status: 'active' });

  if (lists.length === 0) {
    res.json({
      message: 'No active shopping list',
      list: null,
      suggestion: 'Create a new shopping list to get started'
    });
    return;
  }

  const currentList = lists[0];
  const purchasedCount = currentList.items.filter((i: any) => i.purchased).length;
  const totalCount = currentList.items.length;

  res.json({
    list: currentList,
    progress: {
      purchased: purchasedCount,
      total: totalCount,
      percentage: totalCount > 0 ? Math.round((purchasedCount / totalCount) * 100) : 0
    }
  });
});

/**
 * @route GET /api/shopping/:id
 * @desc Get specific shopping list
 * @access Private
 */
router.get('/:id', async (req: Request, res: Response) => {
  const list = await shoppingService.findById(req.params.id);

  if (!list) {
    throw new ApiError(404, 'Shopping list not found');
  }

  if (list.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  res.json({ list });
});

/**
 * @route POST /api/shopping
 * @desc Create new shopping list
 * @access Private
 */
router.post('/', async (req: Request, res: Response) => {
  const { weekOf, notes, items } = req.body;

  const listItems = items?.map((item: any) => ({
    id: uuidv4(),
    name: item.name,
    category: item.category || 'other',
    quantity: item.quantity || 1,
    unit: item.unit || 'each',
    estimatedPrice: item.estimatedPrice,
    store: item.store,
    notes: item.notes
  })) || [];

  const list = await shoppingService.create({
    id: uuidv4(),
    userId: req.user!.id,
    weekOf: weekOf ? new Date(weekOf) : new Date(),
    status: 'draft',
    totalEstimated: listItems.reduce((sum: number, item: any) =>
      sum + (item.estimatedPrice || 0) * item.quantity, 0),
    notes,
    items: listItems
  });

  res.status(201).json({
    message: 'Shopping list created',
    list
  });
});

/**
 * @route PUT /api/shopping/:id
 * @desc Update shopping list
 * @access Private
 */
router.put('/:id', async (req: Request, res: Response) => {
  const list = await shoppingService.findById(req.params.id);

  if (!list) {
    throw new ApiError(404, 'Shopping list not found');
  }

  if (list.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const updated = await shoppingService.update(req.params.id, req.body);

  res.json({
    message: 'Shopping list updated',
    list: updated
  });
});

/**
 * @route POST /api/shopping/:id/activate
 * @desc Activate shopping list for shopping mode
 * @access Private
 */
router.post('/:id/activate', async (req: Request, res: Response) => {
  const list = await shoppingService.findById(req.params.id);

  if (!list) {
    throw new ApiError(404, 'Shopping list not found');
  }

  if (list.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  // Deactivate any other active lists first
  const activeLists = await shoppingService.findByUser(req.user!.id, { status: 'active' });
  for (const activeList of activeLists) {
    await shoppingService.update(activeList.id, { status: 'draft' });
  }

  const updated = await shoppingService.update(req.params.id, { status: 'active' });

  res.json({
    message: 'Shopping list activated',
    list: updated
  });
});

/**
 * @route PUT /api/shopping/:listId/items/:itemId
 * @desc Update shopping list item
 * @access Private
 */
router.put('/:listId/items/:itemId', async (req: Request, res: Response) => {
  const list = await shoppingService.findById(req.params.listId);

  if (!list) {
    throw new ApiError(404, 'Shopping list not found');
  }

  if (list.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const updated = await shoppingService.updateItem(
    req.params.listId,
    req.params.itemId,
    req.body
  );

  res.json({
    message: 'Item updated',
    list: updated
  });
});

/**
 * @route POST /api/shopping/:listId/items/:itemId/purchase
 * @desc Mark item as purchased
 * @access Private
 */
router.post('/:listId/items/:itemId/purchase', async (req: Request, res: Response) => {
  const { actualPrice, store } = req.body;

  const list = await shoppingService.findById(req.params.listId);

  if (!list) {
    throw new ApiError(404, 'Shopping list not found');
  }

  if (list.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const updated = await shoppingService.updateItem(
    req.params.listId,
    req.params.itemId,
    {
      purchased: true,
      actualPrice,
      store
    }
  );

  // Check if all items purchased
  const allPurchased = updated?.items.every((i: any) => i.purchased);

  res.json({
    message: 'Item marked as purchased',
    list: updated,
    allPurchased,
    suggestion: allPurchased ? 'All items purchased! Complete your shopping trip.' : null
  });
});

/**
 * @route POST /api/shopping/:id/complete
 * @desc Complete shopping list
 * @access Private
 */
router.post('/:id/complete', async (req: Request, res: Response) => {
  const list = await shoppingService.findById(req.params.id);

  if (!list) {
    throw new ApiError(404, 'Shopping list not found');
  }

  if (list.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const updated = await shoppingService.update(req.params.id, { status: 'completed' });

  // Calculate savings
  const estimatedTotal = list.totalEstimated;
  const actualTotal = updated?.totalActual || 0;
  const savings = estimatedTotal - actualTotal;

  res.json({
    message: 'Shopping complete!',
    list: updated,
    summary: {
      estimatedTotal,
      actualTotal,
      savings,
      savingsPercentage: estimatedTotal > 0 ? Math.round((savings / estimatedTotal) * 100) : 0
    }
  });
});

/**
 * @route DELETE /api/shopping/:id
 * @desc Delete shopping list
 * @access Private
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const list = await shoppingService.findById(req.params.id);

  if (!list) {
    throw new ApiError(404, 'Shopping list not found');
  }

  if (list.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  await shoppingService.delete(req.params.id);

  res.json({ message: 'Shopping list deleted' });
});

export default router;
