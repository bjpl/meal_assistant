/**
 * Weekly Ads API Tests
 * Week 3-4: Ad Upload, Processing, and Deal Matching
 */

const request = require('supertest');
const app = require('../../src/api/server');
const { v4: uuidv4 } = require('uuid');

// Test helpers
const testUserEmail = `adtest-${Date.now()}@example.com`;
const testUserPassword = 'TestPassword123!';

let authToken;
let testAdId;
let testDealId;
let testTemplateId;
let testStoreId;

// Sample base64 encoded image (1x1 pixel PNG for testing)
const sampleBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Weekly Ads API', () => {
  beforeAll(async () => {
    // Register user and get token
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testUserEmail,
        password: testUserPassword,
        name: 'Ad Test User'
      });

    authToken = registerRes.body.token;

    // If registration failed (user exists), try login
    if (!authToken) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword
        });
      authToken = loginRes.body.token;
    }
  });

  // ==========================================================================
  // AD UPLOAD TESTS
  // ==========================================================================

  describe('POST /api/ads/upload', () => {
    it('should upload a weekly ad successfully', async () => {
      const res = await request(app)
        .post('/api/ads/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileData: sampleBase64Image,
          filename: 'weekly-ad.png',
          fileSize: 1024,
          adPeriod: '2025-11-20'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message', 'Ad uploaded successfully');
      expect(res.body).toHaveProperty('ad');
      expect(res.body.ad).toHaveProperty('id');
      expect(res.body.ad).toHaveProperty('file_type', 'PNG');
      expect(res.body.ad).toHaveProperty('processing_status', 'pending');

      testAdId = res.body.ad.id;
    });

    it('should reject invalid file type', async () => {
      const res = await request(app)
        .post('/api/ads/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileData: sampleBase64Image,
          filename: 'weekly-ad.exe',
          fileSize: 1024
        });

      expect(res.status).toBe(400);
    });

    it('should reject file exceeding size limit', async () => {
      const res = await request(app)
        .post('/api/ads/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileData: sampleBase64Image,
          filename: 'weekly-ad.png',
          fileSize: 15 * 1024 * 1024 // 15 MB
        });

      expect(res.status).toBe(400);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/ads/upload')
        .send({
          fileData: sampleBase64Image,
          filename: 'weekly-ad.png',
          fileSize: 1024
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // AD LISTING TESTS
  // ==========================================================================

  describe('GET /api/ads', () => {
    it('should list user ads', async () => {
      const res = await request(app)
        .get('/api/ads')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ads');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.ads)).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/ads')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.ads.forEach(ad => {
        expect(ad.processing_status).toBe('pending');
      });
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/ads')
        .query({ limit: 5, offset: 0 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.pagination.offset).toBe(0);
    });
  });

  // ==========================================================================
  // AD DETAILS TESTS
  // ==========================================================================

  describe('GET /api/ads/:id', () => {
    it('should get ad details', async () => {
      const res = await request(app)
        .get(`/api/ads/${testAdId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ad');
      expect(res.body.ad.id).toBe(testAdId);
      expect(res.body).toHaveProperty('deals');
    });

    it('should return 404 for non-existent ad', async () => {
      const res = await request(app)
        .get(`/api/ads/${uuidv4()}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // AD PROCESSING TESTS
  // ==========================================================================

  describe('POST /api/ads/:id/process', () => {
    it('should process an ad and extract deals', async () => {
      const res = await request(app)
        .post(`/api/ads/${testAdId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Ad processed successfully');
      expect(res.body).toHaveProperty('processing');
      expect(res.body.processing).toHaveProperty('dealsExtracted');
      expect(res.body.processing).toHaveProperty('ocrConfidence');
      expect(res.body).toHaveProperty('deals');
    });

    it('should reject reprocessing without forceReprocess flag', async () => {
      const res = await request(app)
        .post(`/api/ads/${testAdId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already processed');
    });

    it('should allow reprocessing with forceReprocess flag', async () => {
      const res = await request(app)
        .post(`/api/ads/${testAdId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ forceReprocess: true });

      expect(res.status).toBe(200);
    });
  });

  // ==========================================================================
  // DEAL EXTRACTION TESTS
  // ==========================================================================

  describe('GET /api/ads/:id/deals', () => {
    it('should list extracted deals', async () => {
      const res = await request(app)
        .get(`/api/ads/${testAdId}/deals`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('deals');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body).toHaveProperty('summary');
      expect(Array.isArray(res.body.deals)).toBe(true);

      if (res.body.deals.length > 0) {
        testDealId = res.body.deals[0].id;
      }
    });

    it('should filter by minimum confidence', async () => {
      const res = await request(app)
        .get(`/api/ads/${testAdId}/deals`)
        .query({ minConfidence: 70 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.deals.forEach(deal => {
        expect(deal.confidence_score).toBeGreaterThanOrEqual(70);
      });
    });
  });

  // ==========================================================================
  // DEAL MATCHING TESTS
  // ==========================================================================

  describe('POST /api/ads/:id/match', () => {
    it('should match deals to shopping list', async () => {
      const shoppingListId = uuidv4();
      const shoppingItems = [
        { id: uuidv4(), name: 'Chicken Breast' },
        { id: uuidv4(), name: 'Eggs' },
        { id: uuidv4(), name: 'Milk' }
      ];

      const res = await request(app)
        .post(`/api/ads/${testAdId}/match`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shoppingListId,
          shoppingItems,
          minConfidence: 50
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(res.body.results).toHaveProperty('matches');
      expect(res.body.results).toHaveProperty('unmatched');
      expect(res.body.results).toHaveProperty('summary');
    });

    it('should require processed ad', async () => {
      // Upload a new ad but do not process it
      const uploadRes = await request(app)
        .post('/api/ads/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileData: sampleBase64Image,
          filename: 'unprocessed.png',
          fileSize: 1024
        });

      const unprocessedId = uploadRes.body.ad.id;

      const res = await request(app)
        .post(`/api/ads/${unprocessedId}/match`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shoppingListId: uuidv4(),
          shoppingItems: [{ id: uuidv4(), name: 'Test Item' }]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('must be processed');
    });
  });

  // ==========================================================================
  // DEAL CORRECTION TESTS
  // ==========================================================================

  describe('PUT /api/ads/deals/:id/correct', () => {
    it('should correct a deal', async () => {
      // Get a deal to correct
      const dealsRes = await request(app)
        .get(`/api/ads/${testAdId}/deals`)
        .set('Authorization', `Bearer ${authToken}`);

      if (dealsRes.body.deals.length === 0) {
        console.log('No deals to correct, skipping test');
        return;
      }

      const dealId = dealsRes.body.deals[0].id;

      const res = await request(app)
        .put(`/api/ads/deals/${dealId}/correct`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: 'Corrected Product Name',
          price: 3.99
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('deal');
      expect(res.body.deal.product_name).toBe('Corrected Product Name');
      expect(res.body.deal.price).toBe(3.99);
      expect(res.body.deal.user_corrected).toBe(true);
      expect(res.body.deal.confidence_score).toBe(100);
    });

    it('should require at least one field for correction', async () => {
      const dealsRes = await request(app)
        .get(`/api/ads/${testAdId}/deals`)
        .set('Authorization', `Bearer ${authToken}`);

      if (dealsRes.body.deals.length === 0) {
        return;
      }

      const dealId = dealsRes.body.deals[0].id;

      const res = await request(app)
        .put(`/api/ads/deals/${dealId}/correct`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // TEMPLATE TESTS
  // ==========================================================================

  describe('Template Management', () => {
    describe('POST /api/ads/templates', () => {
      it('should create a template', async () => {
        const res = await request(app)
          .post('/api/ads/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateName: 'Test Store Template',
            layoutType: 'grid',
            extractionRules: {
              price_patterns: ['\\$\\d+\\.\\d{2}']
            }
          });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('template');
        expect(res.body.template.template_name).toBe('Test Store Template');
        expect(res.body.template.accuracy_rate).toBe(30); // Default starting accuracy

        testTemplateId = res.body.template.id;
      });

      it('should reject invalid layout type', async () => {
        const res = await request(app)
          .post('/api/ads/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateName: 'Invalid Template',
            layoutType: 'invalid_type'
          });

        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/ads/templates', () => {
      it('should list templates', async () => {
        const res = await request(app)
          .get('/api/ads/templates')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('templates');
        expect(res.body).toHaveProperty('count');
      });
    });

    describe('PUT /api/ads/templates/:id', () => {
      it('should update a template', async () => {
        const res = await request(app)
          .put(`/api/ads/templates/${testTemplateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateName: 'Updated Template Name'
          });

        expect(res.status).toBe(200);
        expect(res.body.template.template_name).toBe('Updated Template Name');
        expect(res.body.template.version).toBe(2);
      });
    });

    describe('GET /api/ads/templates/:id/accuracy', () => {
      it('should get template accuracy stats', async () => {
        const res = await request(app)
          .get(`/api/ads/templates/${testTemplateId}/accuracy`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('stats');
        expect(res.body).toHaveProperty('target');
        expect(res.body.target.goal).toBe(85);
      });
    });
  });

  // ==========================================================================
  // STATS & STORES TESTS
  // ==========================================================================

  describe('GET /api/ads/stats', () => {
    it('should return accuracy progression stats', async () => {
      const res = await request(app)
        .get('/api/ads/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('stats');
      expect(res.body.stats).toHaveProperty('totalAdsUploaded');
      expect(res.body.stats).toHaveProperty('totalDealsExtracted');
      expect(res.body.stats).toHaveProperty('averageConfidence');
      expect(res.body).toHaveProperty('accuracy');
      expect(res.body.accuracy).toHaveProperty('target', 85);
    });
  });

  describe('GET /api/ads/stores', () => {
    it('should list available stores', async () => {
      const res = await request(app)
        .get('/api/ads/stores')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('stores');
      expect(res.body).toHaveProperty('count');
      expect(Array.isArray(res.body.stores)).toBe(true);
      expect(res.body.stores.length).toBeGreaterThan(0);

      testStoreId = res.body.stores[0].id;
    });
  });

  // ==========================================================================
  // AD DELETION TESTS
  // ==========================================================================

  describe('DELETE /api/ads/:id', () => {
    it('should delete an ad', async () => {
      // Upload a new ad to delete
      const uploadRes = await request(app)
        .post('/api/ads/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileData: sampleBase64Image,
          filename: 'to-delete.png',
          fileSize: 1024
        });

      const adToDelete = uploadRes.body.ad.id;

      const res = await request(app)
        .delete(`/api/ads/${adToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Ad deleted successfully');
      expect(res.body.deletedId).toBe(adToDelete);

      // Verify deletion
      const getRes = await request(app)
        .get(`/api/ads/${adToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent ad', async () => {
      const res = await request(app)
        .delete(`/api/ads/${uuidv4()}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });
});

// ==========================================================================
// SERVICE UNIT TESTS
// ==========================================================================

describe('OCR Service', () => {
  const { ocrService } = require('../../src/api/services/ocrService');

  describe('extractDeals', () => {
    it('should extract deals from text', async () => {
      const mockText = `
        Chicken Breast
        $2.99 per lb

        Large Eggs 18ct
        $3.49

        Milk Gallon
        $2.99
      `;

      const deals = await ocrService.extractDeals(mockText, null, {});

      expect(Array.isArray(deals)).toBe(true);
      expect(deals.length).toBeGreaterThan(0);
      deals.forEach(deal => {
        expect(deal).toHaveProperty('id');
        expect(deal).toHaveProperty('product_name');
        expect(deal).toHaveProperty('confidence_score');
        expect(deal).toHaveProperty('extraction_method');
      });
    });

    it('should assign confidence scores based on extraction method', async () => {
      const deals = await ocrService.extractDeals('Test Product\n$5.99', null, {});

      deals.forEach(deal => {
        expect(deal.confidence_score).toBeGreaterThanOrEqual(30);
        expect(deal.confidence_score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('calculateOverallConfidence', () => {
    it('should calculate average confidence', () => {
      const deals = [
        { confidence_score: 80 },
        { confidence_score: 60 },
        { confidence_score: 70 }
      ];

      const overall = ocrService.calculateOverallConfidence(deals);
      expect(overall).toBe(70);
    });

    it('should return 0 for empty array', () => {
      const overall = ocrService.calculateOverallConfidence([]);
      expect(overall).toBe(0);
    });
  });
});

describe('Deal Matcher Service', () => {
  const { dealMatcher } = require('../../src/api/services/dealMatcher');

  describe('calculateMatch', () => {
    it('should return 100 for exact match', () => {
      const item = { name: 'Chicken Breast' };
      const deal = { product_name: 'Chicken Breast' };

      const result = dealMatcher.calculateMatch(item, deal);
      expect(result.confidence).toBe(100);
      expect(result.method).toBe('exact');
    });

    it('should return high confidence for similar products', () => {
      const item = { name: 'chicken' };
      const deal = { product_name: 'Boneless Chicken Breast' };

      const result = dealMatcher.calculateMatch(item, deal);
      expect(result.confidence).toBeGreaterThanOrEqual(50);
    });

    it('should return low confidence for dissimilar products', () => {
      const item = { name: 'Apples' };
      const deal = { product_name: 'Ground Beef' };

      const result = dealMatcher.calculateMatch(item, deal);
      expect(result.confidence).toBeLessThan(50);
    });
  });

  describe('matchToShoppingList', () => {
    it('should match multiple items', async () => {
      const deals = [
        { id: '1', product_name: 'Chicken Breast', price: 2.99 },
        { id: '2', product_name: 'Large Eggs', price: 3.49 },
        { id: '3', product_name: 'Whole Milk', price: 2.99 }
      ];

      const items = [
        { id: 'a', name: 'chicken' },
        { id: 'b', name: 'eggs' },
        { id: 'c', name: 'milk' }
      ];

      const result = await dealMatcher.matchToShoppingList(deals, 'list-1', items, {});

      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('unmatched');
      expect(result).toHaveProperty('summary');
      expect(result.matches.length).toBeGreaterThan(0);
    });
  });

  describe('autoApplyMatches', () => {
    it('should auto-apply high confidence matches', () => {
      const matches = [
        { id: '1', match_confidence: 95, deal: {} },
        { id: '2', match_confidence: 85, deal: {} },
        { id: '3', match_confidence: 70, deal: {} }
      ];

      const result = dealMatcher.autoApplyMatches(matches, 90);

      expect(result.autoAppliedCount).toBe(1);
      expect(result.pendingReviewCount).toBe(2);
    });
  });
});

describe('File Storage Service', () => {
  const { fileStorageService } = require('../../src/api/services/fileStorage');

  describe('validateFile', () => {
    it('should accept valid file types', () => {
      const result = fileStorageService.validateFile({
        filename: 'test.png',
        size: 1024
      });

      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('PNG');
    });

    it('should reject invalid file types', () => {
      const result = fileStorageService.validateFile({
        filename: 'test.exe',
        size: 1024
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject oversized files', () => {
      const result = fileStorageService.validateFile({
        filename: 'test.png',
        size: 15 * 1024 * 1024 // 15 MB
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('too large');
    });
  });

  describe('generateStorageKey', () => {
    it('should generate unique keys with delay', async () => {
      const key1 = fileStorageService.generateStorageKey('user-1', 'file.png');
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay for different timestamp
      const key2 = fileStorageService.generateStorageKey('user-1', 'file.png');

      // Keys should be different due to timestamp
      expect(key1).not.toBe(key2);
      expect(key1).toMatch(/^ads\/user-1\/\d+-[a-f0-9]+\.png$/);
    });
  });
});
