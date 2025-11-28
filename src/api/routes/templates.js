/**
 * Template Routes
 * API endpoints for template CRUD, versioning, A/B testing, and marketplace
 */

const express = require('express');
const router = express.Router();
const { templateService, abTestService, marketplaceService } = require('../services/templates');

/**
 * Middleware to extract user ID from request
 * In production, this would come from auth middleware
 */
const getUserId = (req) => {
  return req.user?.id || req.headers['x-user-id'] || 'anonymous';
};

// ============================================
// TEMPLATE CRUD ROUTES
// ============================================

/**
 * POST /api/templates
 * Create a new template from annotations
 */
router.post('/', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { store_id, annotations } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    if (!annotations || !annotations.examples || annotations.examples.length < 3) {
      return res.status(400).json({
        error: 'At least 3 annotation examples are required'
      });
    }

    const template = await templateService.createTemplate(userId, store_id, annotations);

    res.status(201).json({
      success: true,
      template
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/:id
 * Get a template by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const template = await templateService.getTemplate(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/store/:storeId
 * Get all templates for a store
 */
router.get('/store/:storeId', async (req, res, next) => {
  try {
    const { status, publicOnly } = req.query;

    const templates = await templateService.getTemplatesByStore(
      req.params.storeId,
      { status, publicOnly: publicOnly === 'true' }
    );

    res.json({
      store_id: req.params.storeId,
      templates,
      count: templates.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/user/me
 * Get templates for current user
 */
router.get('/user/me', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { status } = req.query;

    const templates = await templateService.getTemplatesByUser(userId, { status });

    res.json({
      user_id: userId,
      templates,
      count: templates.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/templates/:id/corrections
 * Update template from user corrections
 */
router.put('/:id/corrections', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { corrections } = req.body;

    if (!corrections) {
      return res.status(400).json({ error: 'corrections object is required' });
    }

    corrections.user_id = userId;

    const newVersion = await templateService.updateFromCorrections(
      req.params.id,
      corrections
    );

    res.json({
      success: true,
      message: 'New template version created from corrections',
      template: newVersion
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/:id/test
 * Test a template on an ad
 */
router.post('/:id/test', async (req, res, next) => {
  try {
    const { test_ad_id, test_data } = req.body;

    if (!test_ad_id) {
      return res.status(400).json({ error: 'test_ad_id is required' });
    }

    const results = await templateService.testTemplate(
      req.params.id,
      test_ad_id,
      test_data || {}
    );

    res.json({
      success: true,
      results
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/:id/rollback
 * Rollback to parent template version
 */
router.post('/:id/rollback', async (req, res, next) => {
  try {
    const restoredTemplate = await templateService.rollback(req.params.id);

    res.json({
      success: true,
      message: 'Rolled back to previous version',
      template: restoredTemplate
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/templates/:id/share
 * Share/unshare a template publicly
 */
router.put('/:id/share', async (req, res, next) => {
  try {
    const { is_public } = req.body;

    const template = await templateService.shareTemplate(
      req.params.id,
      is_public !== false
    );

    res.json({
      success: true,
      template
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/templates/:id
 * Delete a template
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const result = await templateService.deleteTemplate(req.params.id, userId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/:id/versions
 * Get version history for a template
 */
router.get('/:id/versions', async (req, res, next) => {
  try {
    const history = await templateService.getVersionHistory(req.params.id);

    res.json({
      template_id: req.params.id,
      versions: history
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/:id1/diff/:id2
 * Get diff between two template versions
 */
router.get('/:id1/diff/:id2', async (req, res, next) => {
  try {
    const diff = await templateService.getVersionDiff(
      req.params.id1,
      req.params.id2
    );

    res.json({
      diff
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// A/B TESTING ROUTES
// ============================================

/**
 * POST /api/templates/ab-tests
 * Create a new A/B test
 */
router.post('/ab-tests', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { control_template_id, variant_template_id, config } = req.body;

    if (!control_template_id || !variant_template_id) {
      return res.status(400).json({
        error: 'control_template_id and variant_template_id are required'
      });
    }

    const test = await abTestService.createTest(
      control_template_id,
      variant_template_id,
      { ...config, user_id: userId }
    );

    res.status(201).json({
      success: true,
      test
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/ab-tests/:id/start
 * Start an A/B test
 */
router.post('/ab-tests/:id/start', async (req, res, next) => {
  try {
    const test = await abTestService.startTest(req.params.id);

    res.json({
      success: true,
      message: 'A/B test started',
      test
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/ab-tests/:id
 * Get A/B test details
 */
router.get('/ab-tests/:id', async (req, res, next) => {
  try {
    const test = await abTestService.getTest(req.params.id);

    if (!test) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    res.json({ test });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/ab-tests/:id/record
 * Record an extraction result for A/B test
 */
router.post('/ab-tests/:id/record', async (req, res, next) => {
  try {
    const { group, result } = req.body;

    if (!group || !['control', 'variant'].includes(group)) {
      return res.status(400).json({
        error: 'group must be "control" or "variant"'
      });
    }

    const response = await abTestService.recordResult(
      req.params.id,
      group,
      result || {}
    );

    res.json({
      success: true,
      ...response
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/ab-tests/:id/conclude
 * Manually conclude an A/B test
 */
router.post('/ab-tests/:id/conclude', async (req, res, next) => {
  try {
    const result = await abTestService.concludeTest(req.params.id);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/ab-tests/:id/cancel
 * Cancel an A/B test
 */
router.post('/ab-tests/:id/cancel', async (req, res, next) => {
  try {
    const test = await abTestService.cancelTest(req.params.id);

    res.json({
      success: true,
      message: 'A/B test cancelled',
      test
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/ab-tests/store/:storeId/active
 * Get active A/B test for a store
 */
router.get('/ab-tests/store/:storeId/active', async (req, res, next) => {
  try {
    const test = await abTestService.getActiveTest(req.params.storeId);

    res.json({
      store_id: req.params.storeId,
      active_test: test
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/ab-tests/:id/rollout
 * Create gradual rollout for winning template
 */
router.post('/ab-tests/:id/rollout', async (req, res, next) => {
  try {
    const { target_percentage, step_size } = req.body;

    const rollout = await abTestService.createGradualRollout(
      req.params.id,
      target_percentage || 100,
      step_size || 10
    );

    res.status(201).json({
      success: true,
      rollout
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MARKETPLACE ROUTES
// ============================================

/**
 * POST /api/templates/:id/publish
 * Publish a template to the marketplace
 */
router.post('/:id/publish', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const publishData = req.body;

    const template = await marketplaceService.publishTemplate(
      req.params.id,
      userId,
      publishData
    );

    res.json({
      success: true,
      message: 'Template published to marketplace',
      template
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/templates/:id/publish
 * Unpublish a template from marketplace
 */
router.delete('/:id/publish', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const result = await marketplaceService.unpublishTemplate(req.params.id, userId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/:id/rate
 * Rate a template
 */
router.post('/:id/rate', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'rating must be between 1 and 5'
      });
    }

    const review = await marketplaceService.rateTemplate(
      req.params.id,
      userId,
      rating,
      comment || ''
    );

    res.json({
      success: true,
      review
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/:id/reviews
 * Get reviews for a template
 */
router.get('/:id/reviews', async (req, res, next) => {
  try {
    const { sortBy, limit, offset } = req.query;

    const result = await marketplaceService.getTemplateReviews(
      req.params.id,
      {
        sortBy,
        limit: parseInt(limit) || 20,
        offset: parseInt(offset) || 0
      }
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/marketplace/search
 * Search marketplace templates
 */
router.get('/marketplace/search', async (req, res, next) => {
  try {
    const {
      search,
      storeId,
      category,
      tags,
      minRating,
      minAccuracy,
      officialOnly,
      verifiedStoresOnly,
      sortBy,
      limit,
      offset
    } = req.query;

    const result = await marketplaceService.searchTemplates({
      search,
      storeId,
      category,
      tags: tags ? tags.split(',') : undefined,
      minRating: minRating ? parseFloat(minRating) : undefined,
      minAccuracy: minAccuracy ? parseFloat(minAccuracy) : undefined,
      officialOnly: officialOnly === 'true',
      verifiedStoresOnly: verifiedStoresOnly === 'true',
      sortBy,
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/marketplace/featured
 * Get featured templates
 */
router.get('/marketplace/featured', async (req, res, next) => {
  try {
    const templates = await marketplaceService.getFeaturedTemplates();

    res.json({
      featured: templates
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/marketplace/official
 * Get official templates
 */
router.get('/marketplace/official', async (req, res, next) => {
  try {
    const { storeId } = req.query;
    const templates = await marketplaceService.getOfficialTemplates(storeId);

    res.json({
      official: templates
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/:id/download
 * Download/clone a public template
 */
router.post('/:id/download', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const clonedTemplate = await templateService.downloadTemplate(req.params.id, userId);

    res.status(201).json({
      success: true,
      message: 'Template downloaded successfully',
      template: clonedTemplate
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/marketplace/suggestions/:storeId
 * Get template suggestions for a store
 */
router.get('/marketplace/suggestions/:storeId', async (req, res, next) => {
  try {
    const suggestions = await marketplaceService.suggestTemplatesForStore(
      req.params.storeId
    );

    res.json(suggestions);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/marketplace/stats
 * Get marketplace statistics
 */
router.get('/marketplace/stats', async (req, res, next) => {
  try {
    const stats = await marketplaceService.getMarketplaceStats();

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/:id/stats
 * Get detailed statistics for a template
 */
router.get('/:id/stats', async (req, res, next) => {
  try {
    const stats = await marketplaceService.getTemplateStats(req.params.id);

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/:id/report
 * Report a template for issues
 */
router.post('/:id/report', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { reason, details } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const report = await marketplaceService.reportTemplate(
      req.params.id,
      userId,
      reason,
      details || ''
    );

    res.status(201).json({
      success: true,
      message: 'Report submitted',
      report
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// STORE VERIFICATION ROUTES (Admin)
// ============================================

/**
 * POST /api/templates/stores/:storeId/verify
 * Verify a store (admin)
 */
router.post('/stores/:storeId/verify', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const verification = {
      ...req.body,
      verified_by: userId
    };

    const result = await marketplaceService.verifyStore(
      req.params.storeId,
      verification
    );

    res.json({
      success: true,
      verification: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/stores/:storeId/verification
 * Get store verification status
 */
router.get('/stores/:storeId/verification', async (req, res, next) => {
  try {
    const verification = await marketplaceService.getStoreVerification(
      req.params.storeId
    );

    res.json({
      store_id: req.params.storeId,
      verified: !!verification,
      verification
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/stores/verified
 * Get all verified stores
 */
router.get('/stores/verified', async (req, res, next) => {
  try {
    const stores = await marketplaceService.getVerifiedStores();

    res.json({
      stores,
      count: stores.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
