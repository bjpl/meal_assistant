/**
 * Weekly Ads Routes
 * Endpoints for uploading, processing, and extracting deals from weekly grocery ads
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { validate, adUploadSchema, adProcessSchema, dealCorrectSchema } from '../validators';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Mock services (would be replaced with actual service imports)
const adService = {
  upload: async (data: any) => data,
  findById: async (id: string) => ({ id, status: 'uploaded' }),
  findByUser: async (userId: string) => [{ id: uuidv4(), userId }],
  process: async (id: string, options: any) => ({ id, ...options, status: 'processed' }),
  getDeals: async (adId: string) => [{ id: uuidv4(), adId, productName: 'Sample Product', price: 2.99 }],
  updateDeal: async (adId: string, dealId: string, updates: any) => ({ id: dealId, adId, ...updates })
};

const templateService = {
  findAll: async () => [{ id: uuidv4(), name: 'Generic Store Template' }],
  getAccuracy: async (userId: string) => ({ userId, accuracy: 92.5, totalProcessed: 15 })
};

// All routes require authentication
router.use(authenticate);

/**
 * @route POST /api/ads/upload
 * @desc Upload weekly ad (PDF or image)
 * @access Private
 */
router.post('/upload', validate(adUploadSchema), async (req: Request, res: Response) => {
  const { fileData, filename, fileSize, storeId, adPeriod } = req.body;

  const ad = await adService.upload({
    id: uuidv4(),
    userId: req.user!.id,
    filename,
    fileSize,
    storeId: storeId || null,
    adPeriod: adPeriod || new Date().toISOString().split('T')[0],
    status: 'uploaded',
    uploadedAt: new Date().toISOString(),
    fileData: fileData.substring(0, 100) + '...' // Store reference, not full data
  });

  res.status(201).json({
    message: 'Weekly ad uploaded successfully',
    ad: {
      id: ad.id,
      filename: ad.filename,
      status: ad.status,
      uploadedAt: ad.uploadedAt
    }
  });
});

/**
 * @route POST /api/ads/:adId/process
 * @desc Process uploaded ad with OCR
 * @access Private
 */
router.post('/:adId/process', validate(adProcessSchema), async (req: Request, res: Response) => {
  const { adId } = req.params;
  const { useML = false, forceReprocess = false } = req.body;

  const ad = await adService.findById(adId);

  if (!ad) {
    throw new ApiError(404, 'Ad not found');
  }

  if (ad.status === 'processed' && !forceReprocess) {
    throw new ApiError(409, 'Ad already processed. Use forceReprocess=true to reprocess.');
  }

  const result = await adService.process(adId, { useML, forceReprocess });

  res.json({
    message: 'Ad processing started',
    processing: {
      adId: result.id,
      status: 'processing',
      useML,
      estimatedTime: useML ? '2-3 minutes' : '1-2 minutes'
    }
  });
});

/**
 * @route GET /api/ads
 * @desc List uploaded ads for user
 * @access Private
 */
router.get('/', async (req: Request, res: Response) => {
  const { status, storeId, limit = '20' } = req.query;

  const ads = await adService.findByUser(req.user!.id);

  const filtered = ads
    .filter((ad: any) => !status || ad.status === status)
    .filter((ad: any) => !storeId || ad.storeId === storeId)
    .slice(0, parseInt(limit as string));

  res.json({
    ads: filtered,
    count: filtered.length,
    total: ads.length
  });
});

/**
 * @route GET /api/ads/:adId/deals
 * @desc Get extracted deals from ad
 * @access Private
 */
router.get('/:adId/deals', async (req: Request, res: Response) => {
  const { adId } = req.params;
  const { category, minPrice, maxPrice, sortBy = 'price' } = req.query;

  const ad = await adService.findById(adId);

  if (!ad) {
    throw new ApiError(404, 'Ad not found');
  }

  if (ad.status !== 'processed') {
    throw new ApiError(400, 'Ad not yet processed. Process it first.');
  }

  let deals = await adService.getDeals(adId);

  // Apply filters
  if (category) {
    deals = deals.filter((d: any) => d.category === category);
  }
  if (minPrice) {
    deals = deals.filter(d => d.price >= parseFloat(minPrice as string));
  }
  if (maxPrice) {
    deals = deals.filter(d => d.price <= parseFloat(maxPrice as string));
  }

  // Sort
  if (sortBy === 'price') {
    deals.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'name') {
    deals.sort((a, b) => a.productName.localeCompare(b.productName));
  }

  res.json({
    adId,
    deals,
    count: deals.length,
    filters: { category, minPrice, maxPrice, sortBy }
  });
});

/**
 * @route POST /api/ads/:adId/deals/:dealId/review
 * @desc Review/correct a deal extraction
 * @access Private
 */
router.post('/:adId/deals/:dealId/review', validate(dealCorrectSchema), async (req: Request, res: Response) => {
  const { adId, dealId } = req.params;
  const { productName, price, category, brand } = req.body;

  const ad = await adService.findById(adId);

  if (!ad) {
    throw new ApiError(404, 'Ad not found');
  }

  const updated = await adService.updateDeal(adId, dealId, {
    productName,
    price,
    category,
    brand,
    reviewed: true,
    reviewedBy: req.user!.id,
    reviewedAt: new Date().toISOString()
  });

  res.json({
    message: 'Deal corrected successfully',
    deal: updated
  });
});

/**
 * @route GET /api/ads/templates
 * @desc Get available store templates for OCR
 * @access Private
 */
router.get('/templates', async (_req: Request, res: Response) => {
  const templates = await templateService.findAll();

  res.json({
    templates: templates.map(t => ({
      id: t.id,
      name: t.name,
      stores: ['Generic', 'Walmart', 'Kroger', 'Target'] // Mock data
    })),
    count: templates.length
  });
});

/**
 * @route GET /api/ads/accuracy
 * @desc Get OCR extraction accuracy stats
 * @access Private
 */
router.get('/accuracy', async (req: Request, res: Response) => {
  const stats = await templateService.getAccuracy(req.user!.id);

  res.json({
    accuracy: {
      overall: stats.accuracy,
      totalAdsProcessed: stats.totalProcessed,
      averageDealsPerAd: 45,
      manualCorrections: 8,
      mlConfidence: 0.89,
      lastUpdated: new Date().toISOString()
    }
  });
});

export default router;
