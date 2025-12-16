/**
 * Price Intelligence Routes
 * API endpoints for grocery deal tracking, price comparisons, and smart shopping
 *
 * Strategic Integration:
 * - Leverages existing auth middleware
 * - Uses PriceIntelligenceService which integrates with:
 *   - RuVector for semantic deal search
 *   - SubstitutionService for alternative product recommendations
 *   - RAG patterns for contextual shopping advice
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import {
  priceIntelligenceService,
  ExtractedDeal,
  RetailerId,
  WeeklyDealMetadata
} from '../../services/prices';

const router = Router();

// All price routes require authentication
router.use(authenticate);

// ============================================================================
// Deal Ingestion Endpoints
// ============================================================================

/**
 * @route POST /api/prices/deals
 * @desc Add a single deal manually
 * @access Private
 */
router.post('/deals', async (req: Request, res: Response) => {
  const {
    productName,
    brand,
    price,
    unit,
    regularPrice,
    retailerId,
    startDate,
    endDate,
    isMemberPrice,
    requiresClip,
    minQuantity,
    maxQuantity,
    category
  } = req.body;

  if (!productName || !price) {
    throw new ApiError(400, 'Product name and price are required');
  }

  const deal = await priceIntelligenceService.addDeal({
    productName,
    brand,
    price: parseFloat(price),
    unit,
    regularPrice: regularPrice ? parseFloat(regularPrice) : undefined,
    retailerId: retailerId || 'safeway',
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    isMemberPrice,
    requiresClip,
    minQuantity: minQuantity ? parseInt(minQuantity, 10) : undefined,
    maxQuantity: maxQuantity ? parseInt(maxQuantity, 10) : undefined,
    category
  });

  res.status(201).json({
    message: 'Deal added successfully',
    deal
  });
});

/**
 * @route POST /api/prices/deals/batch
 * @desc Add multiple deals at once
 * @access Private
 */
router.post('/deals/batch', async (req: Request, res: Response) => {
  const { deals } = req.body;

  if (!Array.isArray(deals) || deals.length === 0) {
    throw new ApiError(400, 'Deals array is required');
  }

  const results: WeeklyDealMetadata[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < deals.length; i++) {
    try {
      const deal = await priceIntelligenceService.addDeal(deals[i]);
      results.push(deal);
    } catch (error) {
      errors.push({
        index: i,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  res.status(201).json({
    message: `Added ${results.length} deals`,
    added: results.length,
    failed: errors.length,
    errors: errors.length > 0 ? errors : undefined
  });
});

/**
 * @route POST /api/prices/flyer/ingest
 * @desc Ingest deals from pre-extracted flyer data
 * @access Private
 * @body { extractedDeals: ExtractedDeal[], retailerId: RetailerId, startDate?, endDate? }
 */
router.post('/flyer/ingest', async (req: Request, res: Response) => {
  const { extractedDeals, retailerId, startDate, endDate } = req.body;

  if (!Array.isArray(extractedDeals) || extractedDeals.length === 0) {
    throw new ApiError(400, 'extractedDeals array is required');
  }

  if (!retailerId) {
    throw new ApiError(400, 'retailerId is required');
  }

  const result = await priceIntelligenceService.ingestFlyerDeals(
    extractedDeals as ExtractedDeal[],
    {
      retailerId: retailerId as RetailerId,
      flyerStartDate: startDate ? new Date(startDate) : undefined,
      flyerEndDate: endDate ? new Date(endDate) : undefined
    }
  );

  res.status(201).json({
    message: 'Flyer deals ingested successfully',
    document: result.document,
    dealsIndexed: result.dealsIndexed,
    failedDeals: result.failedDeals
  });
});

// ============================================================================
// Deal Search Endpoints
// ============================================================================

/**
 * @route GET /api/prices/deals/search
 * @desc Search for deals by query
 * @access Private
 */
router.get('/deals/search', async (req: Request, res: Response) => {
  const { q, retailer, limit } = req.query;

  if (!q) {
    throw new ApiError(400, 'Query parameter "q" is required');
  }

  const deals = await priceIntelligenceService.searchDeals(
    q as string,
    {
      retailerIds: retailer ? [retailer as RetailerId] : undefined,
      maxDealsPerItem: limit ? parseInt(limit as string, 10) : 10
    }
  );

  res.json({
    query: q,
    results: deals,
    count: deals.length
  });
});

/**
 * @route GET /api/prices/deals/best
 * @desc Get best deals, optionally by category
 * @access Private
 */
router.get('/deals/best', async (req: Request, res: Response) => {
  const { category, limit } = req.query;

  const deals = await priceIntelligenceService.getBestDeals(
    category as string | undefined,
    limit ? parseInt(limit as string, 10) : 10
  );

  res.json({
    category: category || 'all',
    deals,
    count: deals.length
  });
});

/**
 * @route GET /api/prices/deals/expiring
 * @desc Get deals expiring soon
 * @access Private
 */
router.get('/deals/expiring', async (req: Request, res: Response) => {
  const { days } = req.query;

  const withinDays = days ? parseInt(days as string, 10) : 2;
  const deals = await priceIntelligenceService.getExpiringDeals(withinDays);

  res.json({
    withinDays,
    deals,
    count: deals.length,
    tip: deals.length > 0 ? 'Shop soon to catch these deals!' : 'No deals expiring soon'
  });
});

// ============================================================================
// Shopping List Integration
// ============================================================================

/**
 * @route POST /api/prices/shopping-list/analyze
 * @desc Analyze a shopping list for available deals
 * @access Private
 */
router.post('/shopping-list/analyze', async (req: Request, res: Response) => {
  const { items, retailers, includeSubstitutes } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Items array is required');
  }

  const analysis = await priceIntelligenceService.findDealsForShoppingList(
    items,
    {
      retailerIds: retailers as RetailerId[] | undefined,
      includeSubstitutes: includeSubstitutes !== false
    }
  );

  res.json({
    analysis,
    summary: {
      itemsWithDeals: analysis.itemsWithDeals.length,
      itemsWithoutDeals: analysis.itemsWithoutDeals.length,
      totalPotentialSavings: analysis.totalPotentialSavings,
      coveragePercent: Math.round(
        (analysis.itemsWithDeals.length / items.length) * 100
      )
    }
  });
});

/**
 * @route POST /api/prices/smart-recommendations
 * @desc Get smart shopping recommendations based on context
 * @access Private
 */
router.post('/smart-recommendations', async (req: Request, res: Response) => {
  const {
    shoppingList,
    inventory,
    upcomingMeals,
    preferredStores,
    budget
  } = req.body;

  const recommendations = await priceIntelligenceService.getSmartRecommendations({
    shoppingList,
    inventory,
    upcomingMeals,
    preferredStores: preferredStores as RetailerId[] | undefined,
    budget: budget ? parseFloat(budget) : undefined
  });

  res.json({
    recommendations,
    actionSummary: {
      itemsToBuyNow: recommendations.buyNow.length,
      itemsToWaitFor: recommendations.waitFor.length,
      alternativesFound: recommendations.alternatives.length,
      totalSavings: `$${recommendations.totalSavings.toFixed(2)}`,
      confidence: `${Math.round(recommendations.confidence * 100)}%`
    }
  });
});

// ============================================================================
// Meal Planning Integration
// ============================================================================

/**
 * @route POST /api/prices/meal-plan/analyze
 * @desc Analyze a meal plan for deal opportunities
 * @access Private
 */
router.post('/meal-plan/analyze', async (req: Request, res: Response) => {
  const { meals, preferredStores } = req.body;

  if (!Array.isArray(meals) || meals.length === 0) {
    throw new ApiError(400, 'Meals array is required');
  }

  // Validate meal structure
  for (const meal of meals) {
    if (!meal.name || !Array.isArray(meal.ingredients)) {
      throw new ApiError(400, 'Each meal must have name and ingredients array');
    }
  }

  const analysis = await priceIntelligenceService.analyzeMealPlanDeals({
    meals,
    preferredStores: preferredStores as RetailerId[] | undefined
  });

  // Calculate totals
  let totalIngredients = 0;
  let ingredientsWithDeals = 0;

  for (const mealAnalysis of analysis) {
    totalIngredients += mealAnalysis.ingredients.length;
    ingredientsWithDeals += mealAnalysis.ingredientDeals.size;
  }

  res.json({
    meals: analysis.map(m => ({
      ...m,
      ingredientDeals: Object.fromEntries(m.ingredientDeals)
    })),
    summary: {
      totalMeals: meals.length,
      totalIngredients,
      ingredientsWithDeals,
      coveragePercent: Math.round((ingredientsWithDeals / totalIngredients) * 100)
    }
  });
});

// ============================================================================
// Price History & Trends
// ============================================================================

/**
 * @route GET /api/prices/history/:product
 * @desc Get price history for a product
 * @access Private
 */
router.get('/history/:product', async (req: Request, res: Response) => {
  const { product } = req.params;

  const history = priceIntelligenceService.getPriceHistory(product);
  const trend = priceIntelligenceService.getPriceTrend(product);

  if (history.length === 0) {
    res.json({
      product,
      history: [],
      trend: null,
      message: 'No price history found for this product'
    });
    return;
  }

  res.json({
    product,
    history,
    trend,
    recommendation: trend?.isGoodTimeToBuy
      ? 'Good time to buy - price is below average!'
      : 'Consider waiting for a better deal'
  });
});

// ============================================================================
// Retailers & Stats
// ============================================================================

/**
 * @route GET /api/prices/retailers
 * @desc Get list of supported retailers
 * @access Private
 */
router.get('/retailers', async (_req: Request, res: Response) => {
  const retailers = priceIntelligenceService.getSupportedRetailers();

  res.json({
    retailers: retailers.map(r => ({
      id: r.id,
      name: r.name
    })),
    count: retailers.length
  });
});

/**
 * @route GET /api/prices/stats
 * @desc Get price intelligence statistics
 * @access Private
 */
router.get('/stats', async (_req: Request, res: Response) => {
  const stats = await priceIntelligenceService.getStats();

  res.json({
    stats,
    status: 'active'
  });
});

export default router;
