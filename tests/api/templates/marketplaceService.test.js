/**
 * Marketplace Service Tests
 * Tests for community template marketplace functionality
 */

const marketplaceService = require('../../../src/api/services/templates/marketplaceService');
const templateService = require('../../../src/api/services/templates/templateService');
const { TemplateStatus } = require('../../../src/api/services/templates/templateTypes');

describe('MarketplaceService', () => {
  let template;

  beforeEach(async () => {
    templateService.clearAll();
    marketplaceService.clearAll();

    // Create a template ready for publishing
    template = await templateService.createTemplate('user-1', 'kroger', {
      name: 'Kroger Weekly Template',
      description: 'Template for parsing Kroger weekly ad circulars',
      examples: [
        { price_text: '$1.99', product_region: { x: 0.1, y: 0.1, width: 0.2, height: 0.15 } },
        { price_text: '$2.99', product_region: { x: 0.4, y: 0.1, width: 0.2, height: 0.15 } },
        { price_text: '$3.99', product_region: { x: 0.1, y: 0.3, width: 0.2, height: 0.15 } }
      ],
      tags: ['kroger', 'weekly', 'grocery']
    });

    // Set up template to meet quality requirements
    template.test_count = 10;
    template.accuracy_score = 0.85;
    template.extraction_rules.price_patterns = [/\$\d+\.\d{2}/g.source];
  });

  describe('publishTemplate', () => {
    it('should publish a template to marketplace', async () => {
      const published = await marketplaceService.publishTemplate(
        template.id,
        'user-1',
        {
          title: 'Kroger Weekly Ad Parser',
          description: 'High accuracy template for Kroger weekly circulars',
          category: 'grocery'
        }
      );

      expect(published.is_public).toBe(true);
      expect(published.status).toBe(TemplateStatus.ACTIVE);
      expect(published.published_at).toBeDefined();
      expect(published.marketplace_data).toBeDefined();
      expect(published.marketplace_data.title).toBe('Kroger Weekly Ad Parser');
    });

    it('should reject templates with low test count', async () => {
      template.test_count = 2;

      await expect(
        marketplaceService.publishTemplate(template.id, 'user-1', {})
      ).rejects.toThrow('tested at least 5 times');
    });

    it('should reject templates with low accuracy', async () => {
      template.accuracy_score = 0.5;

      await expect(
        marketplaceService.publishTemplate(template.id, 'user-1', {})
      ).rejects.toThrow('accuracy must be at least 70%');
    });

    it('should reject templates without extraction rules', async () => {
      template.extraction_rules.price_patterns = [];

      await expect(
        marketplaceService.publishTemplate(template.id, 'user-1', {})
      ).rejects.toThrow('extraction rules');
    });

    it('should reject unauthorized users', async () => {
      await expect(
        marketplaceService.publishTemplate(template.id, 'user-2', {})
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('unpublishTemplate', () => {
    it('should unpublish a template', async () => {
      await marketplaceService.publishTemplate(template.id, 'user-1', {});

      const result = await marketplaceService.unpublishTemplate(template.id, 'user-1');

      expect(result.success).toBe(true);

      const updated = await templateService.getTemplate(template.id);
      expect(updated.is_public).toBe(false);
    });
  });

  describe('rateTemplate', () => {
    beforeEach(async () => {
      await marketplaceService.publishTemplate(template.id, 'user-1', {});
    });

    it('should rate a public template', async () => {
      const review = await marketplaceService.rateTemplate(
        template.id,
        'user-2',
        5,
        'Great template!'
      );

      expect(review).toBeDefined();
      expect(review.rating).toBe(5);
      expect(review.comment).toBe('Great template!');
      expect(review.user_id).toBe('user-2');
    });

    it('should update template rating stats', async () => {
      await marketplaceService.rateTemplate(template.id, 'user-2', 5);
      await marketplaceService.rateTemplate(template.id, 'user-3', 4);
      await marketplaceService.rateTemplate(template.id, 'user-4', 3);

      const updated = await templateService.getTemplate(template.id);

      expect(updated.rating_count).toBe(3);
      expect(updated.avg_rating).toBe(4);
    });

    it('should update existing review from same user', async () => {
      await marketplaceService.rateTemplate(template.id, 'user-2', 3);
      const updated = await marketplaceService.rateTemplate(template.id, 'user-2', 5);

      expect(updated.rating).toBe(5);

      const templateUpdated = await templateService.getTemplate(template.id);
      expect(templateUpdated.rating_count).toBe(1);
      expect(templateUpdated.avg_rating).toBe(5);
    });

    it('should clamp rating to 1-5', async () => {
      const review1 = await marketplaceService.rateTemplate(template.id, 'user-2', 10);
      expect(review1.rating).toBe(5);

      const review2 = await marketplaceService.rateTemplate(template.id, 'user-3', 0);
      expect(review2.rating).toBe(1);
    });
  });

  describe('getTemplateReviews', () => {
    beforeEach(async () => {
      await marketplaceService.publishTemplate(template.id, 'user-1', {});
      await marketplaceService.rateTemplate(template.id, 'user-2', 5, 'Excellent!');
      await marketplaceService.rateTemplate(template.id, 'user-3', 4, 'Good');
      await marketplaceService.rateTemplate(template.id, 'user-4', 3, 'Okay');
    });

    it('should get reviews for a template', async () => {
      const result = await marketplaceService.getTemplateReviews(template.id);

      expect(result.reviews.length).toBe(3);
      expect(result.total).toBe(3);
      expect(result.avg_rating).toBe(4);
    });

    it('should sort by rating high', async () => {
      const result = await marketplaceService.getTemplateReviews(template.id, {
        sortBy: 'rating_high'
      });

      expect(result.reviews[0].rating).toBe(5);
      expect(result.reviews[2].rating).toBe(3);
    });

    it('should support pagination', async () => {
      const result = await marketplaceService.getTemplateReviews(template.id, {
        limit: 2,
        offset: 0
      });

      expect(result.reviews.length).toBe(2);
      expect(result.total).toBe(3);
    });
  });

  describe('searchTemplates', () => {
    beforeEach(async () => {
      // Create and publish multiple templates
      const t1 = await templateService.createTemplate('user-1', 'kroger', {
        name: 'Kroger Weekly',
        description: 'Weekly ad template',
        examples: [{ price_text: '$1' }, { price_text: '$2' }, { price_text: '$3' }],
        tags: ['weekly', 'grocery']
      });
      t1.test_count = 10;
      t1.accuracy_score = 0.9;

      const t2 = await templateService.createTemplate('user-1', 'walmart', {
        name: 'Walmart Monthly',
        description: 'Monthly deals',
        examples: [{ price_text: '$1' }, { price_text: '$2' }, { price_text: '$3' }],
        tags: ['monthly', 'deals']
      });
      t2.test_count = 10;
      t2.accuracy_score = 0.85;

      await marketplaceService.publishTemplate(t1.id, 'user-1', { category: 'grocery' });
      await marketplaceService.publishTemplate(t2.id, 'user-1', { category: 'retail' });

      // Add some ratings
      await marketplaceService.rateTemplate(t1.id, 'user-2', 5);
      await marketplaceService.rateTemplate(t2.id, 'user-2', 3);
    });

    it('should search by text', async () => {
      const result = await marketplaceService.searchTemplates({
        search: 'kroger'
      });

      expect(result.templates.length).toBe(1);
      expect(result.templates[0].name).toBe('Kroger Weekly');
    });

    it('should filter by store', async () => {
      const result = await marketplaceService.searchTemplates({
        storeId: 'walmart'
      });

      expect(result.templates.length).toBe(1);
      expect(result.templates[0].store_id).toBe('walmart');
    });

    it('should filter by minimum rating', async () => {
      const result = await marketplaceService.searchTemplates({
        minRating: 4
      });

      expect(result.templates.length).toBe(1);
      expect(result.templates[0].avg_rating).toBeGreaterThanOrEqual(4);
    });

    it('should filter by minimum accuracy', async () => {
      const result = await marketplaceService.searchTemplates({
        minAccuracy: 0.88
      });

      expect(result.templates.length).toBe(1);
      expect(result.templates[0].accuracy_score).toBeGreaterThanOrEqual(0.88);
    });

    it('should sort by rating', async () => {
      const result = await marketplaceService.searchTemplates({
        sortBy: 'rating'
      });

      expect(result.templates[0].avg_rating).toBeGreaterThanOrEqual(
        result.templates[1].avg_rating
      );
    });
  });

  describe('featured and official templates', () => {
    beforeEach(async () => {
      template.test_count = 10;
      template.accuracy_score = 0.9;
      await marketplaceService.publishTemplate(template.id, 'user-1', {});
    });

    it('should feature a template', async () => {
      const result = await marketplaceService.featureTemplate(template.id);

      expect(result.featured).toBe(true);

      const featured = await marketplaceService.getFeaturedTemplates();
      expect(featured.length).toBe(1);
      expect(featured[0].id).toBe(template.id);
    });

    it('should unfeature a template', async () => {
      await marketplaceService.featureTemplate(template.id);
      await marketplaceService.unfeatureTemplate(template.id);

      const featured = await marketplaceService.getFeaturedTemplates();
      expect(featured.length).toBe(0);
    });

    it('should mark template as official', async () => {
      const result = await marketplaceService.markAsOfficial(template.id);

      expect(result.is_official).toBe(true);

      const official = await marketplaceService.getOfficialTemplates();
      expect(official.length).toBe(1);
    });
  });

  describe('store verification', () => {
    it('should verify a store', async () => {
      const verification = await marketplaceService.verifyStore('kroger', {
        verified_by: 'admin-1',
        store_name: 'Kroger',
        store_chain: 'Kroger Co.',
        regions: ['US-OH', 'US-KY', 'US-IN']
      });

      expect(verification.verified).toBe(true);
      expect(verification.store_name).toBe('Kroger');
    });

    it('should get store verification status', async () => {
      await marketplaceService.verifyStore('kroger', {
        verified_by: 'admin-1',
        store_name: 'Kroger'
      });

      const status = await marketplaceService.getStoreVerification('kroger');

      expect(status).toBeDefined();
      expect(status.verified).toBe(true);
    });

    it('should list verified stores', async () => {
      await marketplaceService.verifyStore('kroger', {
        verified_by: 'admin-1',
        store_name: 'Kroger'
      });
      await marketplaceService.verifyStore('walmart', {
        verified_by: 'admin-1',
        store_name: 'Walmart'
      });

      const stores = await marketplaceService.getVerifiedStores();

      expect(stores.length).toBe(2);
    });
  });

  describe('suggestTemplatesForStore', () => {
    it('should suggest templates for a store', async () => {
      template.test_count = 10;
      template.accuracy_score = 0.9;
      await marketplaceService.publishTemplate(template.id, 'user-1', {});

      const suggestions = await marketplaceService.suggestTemplatesForStore('kroger');

      expect(suggestions.community.length).toBeGreaterThanOrEqual(0);
      expect(suggestions.store_verified).toBe(false);
    });
  });

  describe('marketplace statistics', () => {
    beforeEach(async () => {
      template.test_count = 10;
      template.accuracy_score = 0.9;
      await marketplaceService.publishTemplate(template.id, 'user-1', {});
      await marketplaceService.rateTemplate(template.id, 'user-2', 4);
    });

    it('should get marketplace statistics', async () => {
      const stats = await marketplaceService.getMarketplaceStats();

      expect(stats.total_templates).toBe(1);
      expect(stats.total_reviews).toBe(1);
      expect(stats.avg_rating).toBe(4);
    });
  });

  describe('template statistics', () => {
    beforeEach(async () => {
      template.test_count = 10;
      template.accuracy_score = 0.9;
      template.downloads = 50;
      await marketplaceService.publishTemplate(template.id, 'user-1', {});
      await marketplaceService.rateTemplate(template.id, 'user-2', 5);
      await marketplaceService.rateTemplate(template.id, 'user-3', 4);
    });

    it('should get detailed template statistics', async () => {
      const stats = await marketplaceService.getTemplateStats(template.id);

      expect(stats.downloads).toBe(50);
      expect(stats.rating_count).toBe(2);
      expect(stats.avg_rating).toBe(4.5);
      expect(stats.rating_distribution).toBeDefined();
      expect(stats.rating_distribution[5]).toBe(1);
      expect(stats.rating_distribution[4]).toBe(1);
    });
  });

  describe('reporting', () => {
    it('should create a report for a template', async () => {
      const report = await marketplaceService.reportTemplate(
        template.id,
        'user-2',
        'incorrect_store',
        'This template is labeled as Kroger but seems to be for Publix'
      );

      expect(report).toBeDefined();
      expect(report.reason).toBe('incorrect_store');
      expect(report.details).toContain('Publix');
      expect(report.status).toBe('pending');
    });
  });

  describe('markReviewHelpful', () => {
    it('should increment helpful count', async () => {
      template.test_count = 10;
      template.accuracy_score = 0.9;
      await marketplaceService.publishTemplate(template.id, 'user-1', {});
      const review = await marketplaceService.rateTemplate(template.id, 'user-2', 5);

      const updated = await marketplaceService.markReviewHelpful(review.id, 'user-3');

      expect(updated.helpful_count).toBe(1);
    });
  });
});
