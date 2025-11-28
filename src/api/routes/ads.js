/**
 * Weekly Ads Routes
 * Endpoints for ad upload, processing, and deal matching
 * Week 3-4: Progressive Ad Upload with 30% -> 85% accuracy learning
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { validate, adUploadSchema, adProcessSchema, dealCorrectSchema, dealMatchSchema, templateCreateSchema, templateUpdateSchema, templateTestSchema } = require('../validators');
const { fileStorageService } = require('../services/fileStorage');
const { ocrService } = require('../services/ocrService');
const { dealMatcher } = require('../services/dealMatcher');
const { ApiError } = require('../middleware/errorHandler');

// In-memory storage (replace with database in production)
const adStore = {
  weeklyAds: new Map(),
  deals: new Map(),
  matches: new Map(),
  templates: new Map(),
  stores: new Map(),
  corrections: new Map()
};

// Initialize with some stores
const defaultStores = [
  { id: uuidv4(), name: 'Walmart', chain_name: 'Walmart', store_type: 'grocery' },
  { id: uuidv4(), name: 'Target', chain_name: 'Target', store_type: 'grocery' },
  { id: uuidv4(), name: 'Kroger', chain_name: 'Kroger', store_type: 'grocery' },
  { id: uuidv4(), name: 'Costco', chain_name: 'Costco', store_type: 'warehouse' },
  { id: uuidv4(), name: 'Whole Foods', chain_name: 'Amazon', store_type: 'organic' }
];
defaultStores.forEach(store => adStore.stores.set(store.id, store));

// All ad routes require authentication
router.use(authenticate);

// =============================================================================
// AD UPLOAD & MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * @route POST /api/ads/upload
 * @desc Upload a weekly ad (PDF/image)
 * @access Private
 */
router.post('/upload', validate(adUploadSchema), async (req, res) => {
  const { fileData, filename, fileSize, storeId, adPeriod } = req.body;

  // Validate and upload file
  const uploadResult = await fileStorageService.uploadFile({
    userId: req.user.id,
    fileData: Buffer.from(fileData, 'base64'),
    filename,
    fileSize
  });

  if (!uploadResult.success) {
    throw new ApiError(400, uploadResult.error || 'File upload failed');
  }

  // Create weekly ad record
  const weeklyAd = {
    id: uuidv4(),
    user_id: req.user.id,
    store_id: storeId || null,
    upload_date: new Date().toISOString(),
    ad_period: adPeriod || new Date().toISOString().split('T')[0],
    file_type: uploadResult.fileType,
    file_url: uploadResult.fileUrl,
    file_size: fileSize,
    processing_status: 'pending',
    deal_count: 0,
    matched_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  adStore.weeklyAds.set(weeklyAd.id, weeklyAd);

  res.status(201).json({
    message: 'Ad uploaded successfully',
    ad: weeklyAd,
    nextStep: 'Call POST /api/ads/:id/process to extract deals'
  });
});

/**
 * @route GET /api/ads
 * @desc List user's uploaded ads
 * @access Private
 */
router.get('/', (req, res) => {
  const { status, limit = 20, offset = 0 } = req.query;

  let ads = Array.from(adStore.weeklyAds.values())
    .filter(ad => ad.user_id === req.user.id);

  if (status) {
    ads = ads.filter(ad => ad.processing_status === status);
  }

  // Sort by upload date descending
  ads.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));

  const total = ads.length;
  ads = ads.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  res.json({
    ads,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: parseInt(offset) + ads.length < total
    }
  });
});

/**
 * @route GET /api/ads/:id
 * @desc Get ad details
 * @access Private
 */
router.get('/:id', (req, res) => {
  const ad = adStore.weeklyAds.get(req.params.id);

  if (!ad) {
    throw new ApiError(404, 'Ad not found');
  }

  if (ad.user_id !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  // Get associated deals
  const deals = Array.from(adStore.deals.values())
    .filter(deal => deal.weekly_ad_id === ad.id);

  // Get store info
  const store = ad.store_id ? adStore.stores.get(ad.store_id) : null;

  res.json({
    ad,
    store,
    deals: {
      count: deals.length,
      items: deals.slice(0, 10) // First 10 deals
    }
  });
});

/**
 * @route POST /api/ads/:id/process
 * @desc Trigger OCR processing for an ad
 * @access Private
 */
router.post('/:id/process', validate(adProcessSchema), async (req, res) => {
  const ad = adStore.weeklyAds.get(req.params.id);

  if (!ad) {
    throw new ApiError(404, 'Ad not found');
  }

  if (ad.user_id !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  if (ad.processing_status === 'processing') {
    throw new ApiError(400, 'Ad is already being processed');
  }

  const { useML = false, forceReprocess = false } = req.body;

  if (ad.processing_status === 'complete' && !forceReprocess) {
    throw new ApiError(400, 'Ad already processed. Set forceReprocess=true to reprocess.');
  }

  // Update status to processing
  ad.processing_status = 'processing';
  ad.processing_started_at = new Date().toISOString();
  adStore.weeklyAds.set(ad.id, ad);

  try {
    // Process the ad
    const result = await ocrService.processAd(ad.file_url, ad.store_id, { useML });

    if (!result.success) {
      throw new Error(result.error);
    }

    // Store extracted deals
    const dealIds = [];
    for (const deal of result.deals) {
      const dealRecord = {
        ...deal,
        weekly_ad_id: ad.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      adStore.deals.set(deal.id, dealRecord);
      dealIds.push(deal.id);
    }

    // Update ad record
    ad.processing_status = 'complete';
    ad.processing_completed_at = new Date().toISOString();
    ad.ocr_confidence = result.ocrConfidence;
    ad.ocr_text = result.text;
    ad.deal_count = result.deals.length;
    ad.template_id = result.templateId;
    adStore.weeklyAds.set(ad.id, ad);

    res.json({
      message: 'Ad processed successfully',
      ad,
      processing: {
        dealsExtracted: result.deals.length,
        ocrConfidence: result.ocrConfidence,
        overallConfidence: result.overallConfidence,
        processingTime: result.metadata.processingTime,
        extractionMethod: result.metadata.extractionMethod
      },
      deals: result.deals.slice(0, 10) // Return first 10 deals
    });
  } catch (error) {
    ad.processing_status = 'failed';
    ad.processing_error = error.message;
    adStore.weeklyAds.set(ad.id, ad);

    throw new ApiError(500, `Processing failed: ${error.message}`);
  }
});

/**
 * @route GET /api/ads/:id/deals
 * @desc Get extracted deals for an ad
 * @access Private
 */
router.get('/:id/deals', (req, res) => {
  const ad = adStore.weeklyAds.get(req.params.id);

  if (!ad) {
    throw new ApiError(404, 'Ad not found');
  }

  if (ad.user_id !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  const { minConfidence = 0, category, limit = 50, offset = 0 } = req.query;

  let deals = Array.from(adStore.deals.values())
    .filter(deal => deal.weekly_ad_id === ad.id);

  // Filter by confidence
  if (minConfidence > 0) {
    deals = deals.filter(deal => (deal.confidence_score || 0) >= parseInt(minConfidence));
  }

  // Filter by category
  if (category) {
    deals = deals.filter(deal => deal.category === category);
  }

  // Sort by confidence descending
  deals.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));

  const total = deals.length;
  deals = deals.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  res.json({
    adId: ad.id,
    deals,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    },
    summary: {
      totalDeals: total,
      averageConfidence: total > 0
        ? Math.round(deals.reduce((sum, d) => sum + (d.confidence_score || 0), 0) / deals.length)
        : 0
    }
  });
});

/**
 * @route POST /api/ads/:id/match
 * @desc Match ad deals to shopping list
 * @access Private
 */
router.post('/:id/match', validate(dealMatchSchema), async (req, res) => {
  const ad = adStore.weeklyAds.get(req.params.id);

  if (!ad) {
    throw new ApiError(404, 'Ad not found');
  }

  if (ad.user_id !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  if (ad.processing_status !== 'complete') {
    throw new ApiError(400, 'Ad must be processed before matching');
  }

  const { shoppingListId, shoppingItems, minConfidence = 50, autoApply = false } = req.body;

  // Get deals for this ad
  const deals = Array.from(adStore.deals.values())
    .filter(deal => deal.weekly_ad_id === ad.id);

  if (deals.length === 0) {
    throw new ApiError(400, 'No deals found for this ad');
  }

  // Perform matching
  const matchResult = await dealMatcher.matchToShoppingList(
    deals,
    shoppingListId,
    shoppingItems,
    { minConfidence }
  );

  // Store matches
  for (const match of matchResult.matches) {
    adStore.matches.set(match.id, {
      ...match,
      created_at: new Date().toISOString()
    });
  }

  // Auto-apply high confidence matches if requested
  let autoApplied = { applied: [], pending: matchResult.matches };
  if (autoApply) {
    autoApplied = dealMatcher.autoApplyMatches(matchResult.matches, 90);
  }

  // Update ad matched count
  ad.matched_count = matchResult.matches.length;
  adStore.weeklyAds.set(ad.id, ad);

  res.json({
    message: 'Matching complete',
    shoppingListId,
    results: matchResult,
    autoApplied: autoApply ? {
      count: autoApplied.autoAppliedCount,
      items: autoApplied.applied
    } : null
  });
});

// =============================================================================
// DEAL CORRECTION ENDPOINTS
// =============================================================================

/**
 * @route PUT /api/deals/:id/correct
 * @desc User correction for a deal
 * @access Private
 */
router.put('/deals/:id/correct', validate(dealCorrectSchema), async (req, res) => {
  const deal = adStore.deals.get(req.params.id);

  if (!deal) {
    throw new ApiError(404, 'Deal not found');
  }

  // Verify ownership through ad
  const ad = adStore.weeklyAds.get(deal.weekly_ad_id);
  if (!ad || ad.user_id !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  const { productName, price, category, brand } = req.body;

  // Store original values
  const originalValues = {
    product_name: deal.product_name,
    price: deal.price,
    category: deal.category,
    product_brand: deal.product_brand
  };

  // Apply corrections
  if (productName) deal.product_name = productName;
  if (price !== undefined) deal.price = price;
  if (category) deal.category = category;
  if (brand) deal.product_brand = brand;

  deal.user_corrected = true;
  deal.correction_timestamp = new Date().toISOString();
  deal.corrected_by_user_id = req.user.id;
  deal.original_values = originalValues;
  deal.confidence_score = 100; // User-corrected is 100% confident
  deal.updated_at = new Date().toISOString();

  adStore.deals.set(deal.id, deal);

  // Store correction for ML training
  const correction = {
    id: uuidv4(),
    ad_deal_id: deal.id,
    weekly_ad_id: deal.weekly_ad_id,
    correction_type: 'user_correction',
    before_value: JSON.stringify(originalValues),
    after_value: JSON.stringify({ productName, price, category, brand }),
    corrected_by_user_id: req.user.id,
    created_at: new Date().toISOString()
  };
  adStore.corrections.set(correction.id, correction);

  res.json({
    message: 'Deal corrected successfully',
    deal,
    correction: {
      id: correction.id,
      originalValues,
      appliedCorrections: { productName, price, category, brand }
    }
  });
});

/**
 * @route POST /api/deals/:id/confirm
 * @desc Confirm a deal match
 * @access Private
 */
router.post('/deals/:id/confirm', (req, res) => {
  const deal = adStore.deals.get(req.params.id);

  if (!deal) {
    throw new ApiError(404, 'Deal not found');
  }

  // Find associated match
  const match = Array.from(adStore.matches.values())
    .find(m => m.ad_deal_id === deal.id);

  if (!match) {
    throw new ApiError(404, 'No match found for this deal');
  }

  match.user_confirmed = true;
  match.confirmed_at = new Date().toISOString();
  adStore.matches.set(match.id, match);

  res.json({
    message: 'Deal match confirmed',
    match
  });
});

// =============================================================================
// TEMPLATE MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * @route GET /api/ads/templates
 * @desc List available templates
 * @access Private
 */
router.get('/templates', (req, res) => {
  const { storeId, isPublic } = req.query;

  let templates = Array.from(adStore.templates.values());

  // Filter by store
  if (storeId) {
    templates = templates.filter(t => t.store_id === storeId);
  }

  // Filter by visibility (show user's own + public)
  templates = templates.filter(t =>
    t.is_public || t.created_by_user_id === req.user.id
  );

  // Sort by accuracy
  templates.sort((a, b) => (b.accuracy_rate || 0) - (a.accuracy_rate || 0));

  res.json({
    templates,
    count: templates.length
  });
});

/**
 * @route POST /api/ads/templates
 * @desc Create new template
 * @access Private
 */
router.post('/templates', validate(templateCreateSchema), (req, res) => {
  const { storeId, templateName, layoutType, extractionRules, pageStructure } = req.body;

  const template = {
    id: uuidv4(),
    store_id: storeId,
    template_name: templateName,
    version: 1,
    layout_type: layoutType || 'mixed',
    extraction_rules_json: extractionRules || {},
    page_structure_json: pageStructure || {},
    accuracy_rate: 30, // Start at 30%
    times_used: 0,
    successful_extractions: 0,
    failed_extractions: 0,
    created_by_user_id: req.user.id,
    is_public: false,
    is_official: false,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  adStore.templates.set(template.id, template);

  res.status(201).json({
    message: 'Template created',
    template
  });
});

/**
 * @route PUT /api/ads/templates/:id
 * @desc Update template
 * @access Private
 */
router.put('/templates/:id', validate(templateUpdateSchema), (req, res) => {
  const template = adStore.templates.get(req.params.id);

  if (!template) {
    throw new ApiError(404, 'Template not found');
  }

  if (template.created_by_user_id !== req.user.id && !template.is_official) {
    throw new ApiError(403, 'Access denied');
  }

  const { templateName, layoutType, extractionRules, pageStructure, isPublic } = req.body;

  if (templateName) template.template_name = templateName;
  if (layoutType) template.layout_type = layoutType;
  if (extractionRules) template.extraction_rules_json = extractionRules;
  if (pageStructure) template.page_structure_json = pageStructure;
  if (isPublic !== undefined) template.is_public = isPublic;

  template.version += 1;
  template.updated_at = new Date().toISOString();

  adStore.templates.set(template.id, template);

  res.json({
    message: 'Template updated',
    template
  });
});

/**
 * @route GET /api/ads/templates/:id/accuracy
 * @desc Get template accuracy stats
 * @access Private
 */
router.get('/templates/:id/accuracy', (req, res) => {
  const template = adStore.templates.get(req.params.id);

  if (!template) {
    throw new ApiError(404, 'Template not found');
  }

  // Get correction stats
  const corrections = Array.from(adStore.corrections.values())
    .filter(c => c.template_id === template.id);

  const totalExtractions = template.successful_extractions + template.failed_extractions;
  const accuracyTrend = totalExtractions > 10
    ? template.accuracy_rate > 50 ? 'improving' : 'needs_work'
    : 'insufficient_data';

  res.json({
    templateId: template.id,
    templateName: template.template_name,
    stats: {
      accuracyRate: template.accuracy_rate,
      timesUsed: template.times_used,
      successfulExtractions: template.successful_extractions,
      failedExtractions: template.failed_extractions,
      totalExtractions,
      correctionCount: corrections.length,
      accuracyTrend
    },
    target: {
      current: template.accuracy_rate,
      goal: 85,
      remaining: Math.max(0, 85 - template.accuracy_rate)
    }
  });
});

/**
 * @route POST /api/ads/templates/:id/test
 * @desc A/B test template
 * @access Private
 */
router.post('/templates/:id/test', validate(templateTestSchema), async (req, res) => {
  const template = adStore.templates.get(req.params.id);

  if (!template) {
    throw new ApiError(404, 'Template not found');
  }

  const { adId, variantRules } = req.body;

  const ad = adStore.weeklyAds.get(adId);
  if (!ad || ad.user_id !== req.user.id) {
    throw new ApiError(404, 'Ad not found');
  }

  // Create variant template
  const variantTemplate = {
    ...template,
    id: uuidv4(),
    template_name: `${template.template_name} - Test Variant`,
    parent_template_id: template.id,
    extraction_rules_json: { ...template.extraction_rules_json, ...variantRules },
    accuracy_rate: 30,
    times_used: 0,
    created_at: new Date().toISOString()
  };

  adStore.templates.set(variantTemplate.id, variantTemplate);

  // Process ad with both templates
  const originalResult = await ocrService.processAd(ad.file_url, ad.store_id, {});
  // Would process with variant template as well in production

  res.json({
    message: 'A/B test initiated',
    originalTemplate: {
      id: template.id,
      name: template.template_name,
      accuracy: template.accuracy_rate
    },
    variantTemplate: {
      id: variantTemplate.id,
      name: variantTemplate.template_name,
      accuracy: variantTemplate.accuracy_rate
    },
    testAdId: adId
  });
});

// =============================================================================
// AD MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * @route DELETE /api/ads/:id
 * @desc Delete an ad
 * @access Private
 */
router.delete('/:id', async (req, res) => {
  const ad = adStore.weeklyAds.get(req.params.id);

  if (!ad) {
    throw new ApiError(404, 'Ad not found');
  }

  if (ad.user_id !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  // Delete associated deals
  for (const [dealId, deal] of adStore.deals.entries()) {
    if (deal.weekly_ad_id === ad.id) {
      adStore.deals.delete(dealId);
    }
  }

  // Delete associated matches
  for (const [matchId, match] of adStore.matches.entries()) {
    const deal = adStore.deals.get(match.ad_deal_id);
    if (deal && deal.weekly_ad_id === ad.id) {
      adStore.matches.delete(matchId);
    }
  }

  // Delete ad
  adStore.weeklyAds.delete(ad.id);

  // Delete file from storage
  // await fileStorageService.deleteFile(ad.file_url);

  res.json({
    message: 'Ad deleted successfully',
    deletedId: ad.id
  });
});

/**
 * @route GET /api/ads/stats
 * @desc Get accuracy progression stats
 * @access Private
 */
router.get('/stats', (req, res) => {
  const userAds = Array.from(adStore.weeklyAds.values())
    .filter(ad => ad.user_id === req.user.id);

  const userDeals = Array.from(adStore.deals.values())
    .filter(deal => {
      const ad = adStore.weeklyAds.get(deal.weekly_ad_id);
      return ad && ad.user_id === req.user.id;
    });

  const correctedDeals = userDeals.filter(d => d.user_corrected);
  const matchedDeals = userDeals.filter(d => d.matched_to_component_id);

  const avgConfidence = userDeals.length > 0
    ? Math.round(userDeals.reduce((sum, d) => sum + (d.confidence_score || 0), 0) / userDeals.length)
    : 0;

  const totalSavings = userDeals.reduce((sum, d) => sum + (d.savings_amount || 0), 0);

  res.json({
    stats: {
      totalAdsUploaded: userAds.length,
      totalDealsExtracted: userDeals.length,
      totalDealsCorrected: correctedDeals.length,
      totalDealsMatched: matchedDeals.length,
      averageConfidence: avgConfidence,
      totalPotentialSavings: totalSavings,
      correctionRate: userDeals.length > 0
        ? Math.round((correctedDeals.length / userDeals.length) * 100)
        : 0
    },
    accuracy: {
      current: avgConfidence,
      target: 85,
      progress: Math.min(100, Math.round((avgConfidence / 85) * 100))
    },
    byStatus: {
      pending: userAds.filter(a => a.processing_status === 'pending').length,
      processing: userAds.filter(a => a.processing_status === 'processing').length,
      complete: userAds.filter(a => a.processing_status === 'complete').length,
      failed: userAds.filter(a => a.processing_status === 'failed').length
    }
  });
});

/**
 * @route GET /api/ads/stores
 * @desc List available stores
 * @access Private
 */
router.get('/stores', (req, res) => {
  const stores = Array.from(adStore.stores.values());

  res.json({
    stores,
    count: stores.length
  });
});

module.exports = router;
