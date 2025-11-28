/**
 * Price Intelligence Routes
 * Week 7-8: Price tracking and deal quality assessment
 *
 * 12 Endpoints:
 * - POST /api/prices/capture - Capture price from receipt OCR or manual
 * - GET /api/prices/history/:componentId - Get trend data
 * - GET /api/prices/compare/:componentId - Cross-store comparison
 * - GET /api/prices/predict/:componentId/:storeId - Future price prediction
 * - GET /api/prices/quality/:componentId/:storeId - Data quality status
 * - GET /api/prices/trends - Trending prices (rising/falling)
 * - POST /api/deals/assess/:dealId - Calculate deal quality score
 * - GET /api/deals/fake/:adId - Flag suspicious deals
 * - GET /api/deals/stock-up/:dealId - Recommended quantity
 * - POST /api/deals/cycle/predict - Predict next sale date
 * - GET /api/prices/alerts - Price drop alerts
 * - GET /api/prices/stats - Overall price tracking stats
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  validate,
  priceCaptureSchema,
  priceHistoryQuerySchema,
  dealAssessSchema,
  salePredictSchema
} = require('../validators');
const { priceIntelligenceService } = require('../services/priceIntelligence');
const { dealQualityService } = require('../services/dealQuality');
const { receiptOcrService } = require('../services/receiptOcr');
const { ApiError } = require('../middleware/errorHandler');

// All price routes require authentication
router.use(authenticate);

// =============================================================================
// PRICE CAPTURE & HISTORY ENDPOINTS
// =============================================================================

/**
 * @route POST /api/prices/capture
 * @desc Capture a price from receipt OCR, ad, or manual entry
 * @access Private
 */
router.post('/capture', validate(priceCaptureSchema), async (req, res) => {
  const {
    componentId,
    storeId,
    price,
    source,
    quantity,
    unit,
    isDeal,
    originalPrice,
    recordedDate,
    notes
  } = req.body;

  const result = await priceIntelligenceService.capturePrice(
    componentId,
    storeId,
    price,
    source,
    {
      quantity,
      unit,
      isDeal,
      originalPrice,
      capturedBy: req.user.id,
      recordedDate,
      notes
    }
  );

  res.status(201).json({
    message: 'Price captured successfully',
    price: result.price,
    dataQuality: result.dataQuality,
    trendsUpdated: result.trendsUpdated
  });
});

/**
 * @route GET /api/prices/history/:componentId
 * @desc Get price history and trend data for a component
 * @access Private
 */
router.get('/history/:componentId', validate(priceHistoryQuerySchema, 'query'), async (req, res) => {
  const { componentId } = req.params;
  const { storeId, startDate, endDate, limit } = req.query;

  const history = await priceIntelligenceService.getPriceHistory(componentId, {
    storeId,
    startDate,
    endDate,
    limit: limit ? parseInt(limit) : 100
  });

  res.json({
    componentId,
    storeId: storeId || 'all',
    priceCount: history.count,
    prices: history.prices,
    trend: history.trend,
    dataQuality: history.trend?.dataQualityStatus || 'insufficient'
  });
});

/**
 * @route GET /api/prices/compare/:componentId
 * @desc Compare prices across stores for a component
 * @access Private
 */
router.get('/compare/:componentId', async (req, res) => {
  const { componentId } = req.params;

  const comparison = await priceIntelligenceService.comparePricesAcrossStores(componentId);

  res.json({
    componentId,
    storeCount: comparison.storeCount,
    comparisons: comparison.comparisons,
    recommendation: comparison.recommendation,
    cheapestStore: comparison.comparisons[0] || null
  });
});

/**
 * @route GET /api/prices/predict/:componentId/:storeId
 * @desc Get future price prediction (requires 20+ data points)
 * @access Private
 */
router.get('/predict/:componentId/:storeId', async (req, res) => {
  const { componentId, storeId } = req.params;

  // Check data quality first
  const quality = await priceIntelligenceService.getDataQualityStatus(componentId, storeId);

  if (!quality.canPredict) {
    return res.status(400).json({
      error: 'insufficient_data',
      message: quality.message,
      dataPointsNeeded: quality.needsMore,
      currentCount: quality.count,
      status: quality.status
    });
  }

  const prediction = await priceIntelligenceService.predictFuturePrice(componentId, storeId);

  res.json({
    componentId,
    storeId,
    prediction: {
      predictedPrice: prediction.predictedPrice,
      confidence: prediction.confidence,
      daysAhead: prediction.daysAhead,
      trend: prediction.trend,
      priceChangePerDay: prediction.slope,
      predictedLowDate: prediction.predictedLowDate
    },
    dataPointsUsed: prediction.dataPointsUsed,
    interpretation: prediction.trend === 'rising' ?
      'Prices are trending upward - consider buying sooner' :
      prediction.trend === 'falling' ?
      'Prices are trending downward - may be worth waiting' :
      'Prices are stable - no urgent timing needed'
  });
});

/**
 * @route GET /api/prices/quality/:componentId/:storeId
 * @desc Get data quality status for a component/store combination
 * @access Private
 */
router.get('/quality/:componentId/:storeId', async (req, res) => {
  const { componentId, storeId } = req.params;

  const quality = await priceIntelligenceService.getDataQualityStatus(componentId, storeId);

  res.json({
    componentId,
    storeId,
    status: quality.status,
    dataPointsCount: quality.count,
    needsMore: quality.needsMore,
    message: quality.message,
    capabilities: {
      hasTrends: quality.hasTrends,
      canPredict: quality.canPredict
    },
    thresholds: {
      emerging: 5,
      reliable: 10,
      mature: 20
    }
  });
});

/**
 * @route GET /api/prices/trends
 * @desc Get trending prices (rising/falling)
 * @access Private
 */
router.get('/trends', async (req, res) => {
  const { type, minStrength, limit } = req.query;

  const trending = await priceIntelligenceService.getTrendingPrices({
    trendType: type,
    minStrength: minStrength ? parseFloat(minStrength) : 10,
    limit: limit ? parseInt(limit) : 20
  });

  res.json({
    trends: trending.trends,
    count: trending.count,
    summary: {
      rising: trending.rising,
      falling: trending.falling,
      volatile: trending.volatile
    },
    interpretation: trending.falling > trending.rising ?
      'More items are decreasing in price - good time to shop' :
      trending.rising > trending.falling ?
      'Prices are generally rising - consider stocking up on essentials' :
      'Market prices are relatively stable'
  });
});

/**
 * @route GET /api/prices/alerts
 * @desc Get price drop alerts (items with >20% drop)
 * @access Private
 */
router.get('/alerts', async (req, res) => {
  const alerts = await priceIntelligenceService.getPriceDropAlerts(req.user.id);

  res.json({
    alerts: alerts.alerts,
    count: alerts.count,
    summary: alerts.count > 0 ?
      `${alerts.count} item(s) have dropped significantly in price` :
      'No significant price drops detected'
  });
});

/**
 * @route GET /api/prices/stats
 * @desc Get overall price tracking statistics
 * @access Private
 */
router.get('/stats', async (req, res) => {
  const stats = await priceIntelligenceService.getPriceStats(req.user.id);

  res.json({
    stats,
    summary: {
      totalDataPoints: stats.totalPricePoints,
      componentsTracked: stats.componentsTracked,
      storesTracked: stats.storesTracked,
      matureDatasets: stats.datasets.mature,
      predictionsAvailable: stats.predictionsAvailable
    },
    recommendations: [
      stats.datasets.insufficient > 0 ?
        `Add more price data for ${stats.datasets.insufficient} component(s) to enable analysis` : null,
      stats.trends.falling > 0 ?
        `${stats.trends.falling} item(s) are trending lower - check for deals` : null,
      stats.trends.rising > 0 ?
        `${stats.trends.rising} item(s) are trending higher - consider buying soon` : null
    ].filter(Boolean)
  });
});

// =============================================================================
// DEAL QUALITY ENDPOINTS
// =============================================================================

/**
 * @route POST /api/deals/assess
 * @desc Assess the quality of a deal
 * @access Private
 */
router.post('/assess', validate(dealAssessSchema), async (req, res) => {
  const {
    dealPrice,
    componentId,
    storeId,
    adDealId,
    regularPrice,
    storageDays,
    weeklyUsage,
    unit
  } = req.body;

  const assessment = await dealQualityService.assessDeal(
    dealPrice,
    componentId,
    storeId,
    {
      adDealId,
      regularPrice,
      userId: req.user.id,
      storageDays,
      weeklyUsage,
      unit
    }
  );

  res.json({
    assessment,
    summary: {
      qualityScore: assessment.qualityScore,
      verdict: assessment.assessment,
      stockUp: assessment.stockUpRecommended,
      recommendedQty: assessment.recommendedQuantity
    },
    interpretation: assessment.analysisNotes
  });
});

/**
 * @route POST /api/deals/assess/:dealId
 * @desc Assess a specific deal by ID (from weekly ads)
 * @access Private
 */
router.post('/assess/:dealId', async (req, res) => {
  const { dealId } = req.params;
  const { componentId, storeId, dealPrice } = req.body;

  if (!componentId || !dealPrice) {
    throw new ApiError(400, 'componentId and dealPrice are required');
  }

  const assessment = await dealQualityService.assessDeal(
    dealPrice,
    componentId,
    storeId,
    {
      adDealId: dealId,
      userId: req.user.id
    }
  );

  res.json({
    dealId,
    assessment,
    verdict: {
      score: assessment.qualityScore,
      category: assessment.assessment,
      recommendation: assessment.stockUpRecommended ?
        `Buy ${assessment.recommendedQuantity} units` :
        'Buy only what you need'
    }
  });
});

/**
 * @route GET /api/deals/fake/:adId
 * @desc Flag suspicious/fake deals in an ad
 * @access Private
 */
router.get('/fake/:adId', async (req, res) => {
  const { adId } = req.params;

  const result = await dealQualityService.flagFakeDeals(adId);

  res.json({
    adId,
    flaggedCount: result.flaggedCount,
    flaggedDeals: result.flaggedDeals,
    summary: result.summary,
    message: result.flaggedCount > 0 ?
      'Warning: Some deals in this ad appear to be misleading' :
      'All deals appear legitimate based on historical pricing'
  });
});

/**
 * @route GET /api/deals/stock-up/:dealId
 * @desc Get stock-up recommendation for a deal
 * @access Private
 */
router.get('/stock-up/:dealId', async (req, res) => {
  const { dealId } = req.params;

  const recommendation = await dealQualityService.getStockUpRecommendation(dealId);

  if (recommendation.error) {
    throw new ApiError(404, recommendation.error);
  }

  res.json({
    dealId,
    recommendation,
    summary: {
      shouldStockUp: recommendation.stockUpRecommended,
      quantity: recommendation.recommendedQuantity,
      reason: recommendation.reason
    }
  });
});

/**
 * @route POST /api/deals/cycle/predict
 * @desc Predict next sale date for a component
 * @access Private
 */
router.post('/cycle/predict', validate(salePredictSchema), async (req, res) => {
  const { componentId, storeId } = req.body;

  const prediction = await dealQualityService.predictNextSale(componentId, storeId);

  res.json({
    componentId,
    storeId,
    prediction: {
      daysUntilNextSale: prediction.daysUntil,
      predictedDate: prediction.date,
      confidence: prediction.confidence,
      avgDaysBetweenSales: prediction.avgDaysBetweenSales,
      salesPerMonth: prediction.saleFrequencyPerMonth
    },
    lastSaleDate: prediction.lastSaleDate,
    advice: prediction.message,
    actionRecommendation: prediction.daysUntil <= 7 ?
      'Wait for the upcoming sale' :
      prediction.daysUntil <= 14 ?
      'Consider waiting or buy a smaller quantity' :
      'No imminent sale expected - buy if needed'
  });
});

// =============================================================================
// RECEIPT PROCESSING ENDPOINTS
// =============================================================================

/**
 * @route POST /api/prices/receipt/scan
 * @desc Process a receipt image to extract prices
 * @access Private
 */
router.post('/receipt/scan', async (req, res) => {
  const { fileUrl, fileType, fileSize, storeId, storeHint, rawText } = req.body;

  if (!fileUrl) {
    throw new ApiError(400, 'fileUrl is required');
  }

  const result = await receiptOcrService.processReceipt({
    userId: req.user.id,
    fileUrl,
    fileType: fileType || 'image/jpeg',
    fileSize: fileSize || 0,
    storeId,
    storeHint,
    rawText
  });

  if (!result.success) {
    throw new ApiError(500, result.error || 'Receipt processing failed');
  }

  res.status(201).json({
    message: 'Receipt processed successfully',
    scan: result.scan,
    items: result.items,
    metadata: result.metadata,
    pricesCaptured: result.pricesCaptured.length,
    summary: {
      itemsFound: result.scan.itemsFound,
      itemsMatched: result.scan.itemsMatched,
      confidence: result.scan.confidenceScore
    }
  });
});

/**
 * @route GET /api/prices/receipt/:scanId
 * @desc Get details of a receipt scan
 * @access Private
 */
router.get('/receipt/:scanId', async (req, res) => {
  const { scanId } = req.params;

  const details = await receiptOcrService.getScanDetails(scanId);

  if (details.error) {
    throw new ApiError(404, details.error);
  }

  res.json(details);
});

/**
 * @route GET /api/prices/receipts
 * @desc List user's receipt scans
 * @access Private
 */
router.get('/receipts', async (req, res) => {
  const { status, limit, offset } = req.query;

  const scans = await receiptOcrService.listUserScans(req.user.id, {
    status,
    limit: limit ? parseInt(limit) : 20,
    offset: offset ? parseInt(offset) : 0
  });

  res.json(scans);
});

/**
 * @route PUT /api/prices/receipt/:scanId/item/:itemId
 * @desc Correct an extracted receipt item
 * @access Private
 */
router.put('/receipt/:scanId/item/:itemId', async (req, res) => {
  const { scanId, itemId } = req.params;
  const { productName, price, quantity, componentId } = req.body;

  const result = await receiptOcrService.correctItem(scanId, itemId, {
    productName,
    price,
    quantity,
    componentId
  });

  if (result.error) {
    throw new ApiError(404, result.error);
  }

  res.json({
    message: 'Item corrected successfully',
    item: result.item
  });
});

module.exports = router;
