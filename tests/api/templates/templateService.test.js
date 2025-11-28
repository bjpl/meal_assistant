/**
 * Template Service Tests
 * Tests for template CRUD, versioning, and corrections
 */

const templateService = require('../../../src/api/services/templates/templateService');
const { TemplateStatus, VersionChangeType } = require('../../../src/api/services/templates/templateTypes');

describe('TemplateService', () => {
  beforeEach(() => {
    templateService.clearAll();
  });

  describe('createTemplate', () => {
    it('should create a template from valid annotations', async () => {
      const annotations = {
        name: 'Kroger Weekly Ad Template',
        description: 'Template for Kroger weekly circular',
        layout_type: 'grid',
        examples: [
          { price_text: '$2.99', product_region: { x: 0.1, y: 0.1, width: 0.2, height: 0.15 } },
          { price_text: '$4.99', product_region: { x: 0.4, y: 0.1, width: 0.2, height: 0.15 } },
          { price_text: 'Buy 2 Get 1 Free', product_region: { x: 0.1, y: 0.3, width: 0.2, height: 0.15 } }
        ],
        tags: ['kroger', 'weekly', 'grocery']
      };

      const template = await templateService.createTemplate('user-1', 'kroger', annotations);

      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.user_id).toBe('user-1');
      expect(template.store_id).toBe('kroger');
      expect(template.name).toBe('Kroger Weekly Ad Template');
      expect(template.version).toBe('1.0.0');
      expect(template.status).toBe(TemplateStatus.DRAFT);
      expect(template.is_public).toBe(false);
      expect(template.extraction_rules).toBeDefined();
      expect(template.extraction_rules.price_patterns.length).toBeGreaterThan(0);
    });

    it('should reject annotations with less than 3 examples', async () => {
      const annotations = {
        examples: [
          { price_text: '$2.99' },
          { price_text: '$4.99' }
        ]
      };

      await expect(
        templateService.createTemplate('user-1', 'store-1', annotations)
      ).rejects.toThrow('at least 3 annotated examples');
    });

    it('should generate extraction rules from examples', async () => {
      const annotations = {
        examples: [
          { price_text: '$2.99', unit_text: '12 oz', savings_text: 'Save $1.00' },
          { price_text: 'Buy 2 Get 1 Free', unit_text: '16 oz' },
          { price_text: '2 for $5.00', unit_text: '24 pack' }
        ]
      };

      const template = await templateService.createTemplate('user-1', 'store-1', annotations);

      expect(template.extraction_rules.price_patterns).toContain(/\d+\s+for\s+\$?\d+(?:\.\d{2})?/gi.source);
      expect(template.extraction_rules.savings_indicators).toContain('save');
    });

    it('should calculate page structure from annotations', async () => {
      const annotations = {
        examples: [
          { product_region: { x: 0.0, y: 0.15, width: 0.33, height: 0.2 } },
          { product_region: { x: 0.33, y: 0.15, width: 0.33, height: 0.2 } },
          { product_region: { x: 0.66, y: 0.15, width: 0.33, height: 0.2 } }
        ]
      };

      const template = await templateService.createTemplate('user-1', 'store-1', annotations);

      expect(template.page_structure).toBeDefined();
      expect(template.page_structure.columns).toBe(3);
    });
  });

  describe('updateFromCorrections', () => {
    let baseTemplate;

    beforeEach(async () => {
      baseTemplate = await templateService.createTemplate('user-1', 'store-1', {
        examples: [
          { price_text: '$1.99' },
          { price_text: '$2.99' },
          { price_text: '$3.99' }
        ]
      });
    });

    it('should create new version from corrections', async () => {
      const corrections = {
        notes: 'Added BOGO pattern',
        changes: { rules_count: 5 }, // > 3 for minor version
        price_patterns: [/buy\s+\d+\s+get\s+\d+\s*free/gi.source]
      };

      const newVersion = await templateService.updateFromCorrections(
        baseTemplate.id,
        corrections
      );

      expect(newVersion.id).not.toBe(baseTemplate.id);
      expect(newVersion.parent_template_id).toBe(baseTemplate.id);
      expect(newVersion.version).toBe('1.1.0');
      expect(newVersion.status).toBe(TemplateStatus.TESTING);
      expect(newVersion.extraction_rules.price_patterns).toContain(
        corrections.price_patterns[0]
      );
    });

    it('should create major version for layout changes', async () => {
      const corrections = {
        changes: { layout_changed: true }
      };

      const newVersion = await templateService.updateFromCorrections(
        baseTemplate.id,
        corrections
      );

      expect(newVersion.version).toBe('2.0.0');
    });

    it('should create patch version for small fixes', async () => {
      const corrections = {
        changes: { rules_count: 1 }
      };

      const newVersion = await templateService.updateFromCorrections(
        baseTemplate.id,
        corrections
      );

      expect(newVersion.version).toBe('1.0.1');
    });

    it('should deprecate original on minor/major update', async () => {
      const corrections = {
        changes: { rules_count: 5 }
      };

      await templateService.updateFromCorrections(baseTemplate.id, corrections);
      const original = await templateService.getTemplate(baseTemplate.id);

      expect(original.status).toBe(TemplateStatus.DEPRECATED);
    });
  });

  describe('testTemplate', () => {
    let template;

    beforeEach(async () => {
      template = await templateService.createTemplate('user-1', 'store-1', {
        examples: [
          { price_text: '$1.99' },
          { price_text: '$2.99' },
          { price_text: '$3.99' }
        ]
      });
    });

    it('should test template and return results', async () => {
      const testData = {
        ad_text: 'Fresh Apples $1.99/lb, Organic Milk $4.99',
        ground_truth: {
          items: [
            { price: '$1.99' },
            { price: '$4.99' }
          ]
        }
      };

      const results = await templateService.testTemplate(
        template.id,
        'test-ad-1',
        testData
      );

      expect(results.template_id).toBe(template.id);
      expect(results.test_ad_id).toBe('test-ad-1');
      expect(results.extraction_results).toBeDefined();
      expect(results.accuracy).toBeDefined();
    });

    it('should update template metrics after testing', async () => {
      const testData = {
        ad_text: 'Product $2.99'
      };

      await templateService.testTemplate(template.id, 'test-1', testData);
      const updated = await templateService.getTemplate(template.id);

      expect(updated.test_count).toBe(1);
      expect(updated.successful_extractions).toBe(1);
    });

    it('should track improvement over parent template', async () => {
      // Set accuracy on base template
      template.accuracy_score = 0.7;
      template.test_count = 10;

      // Create child version
      const child = await templateService.updateFromCorrections(template.id, {
        changes: {}
      });

      // Test child
      const results = await templateService.testTemplate(
        child.id,
        'test-1',
        {
          ad_text: '$2.99 $3.99',
          ground_truth: { items: [{ price: '$2.99' }, { price: '$3.99' }] }
        }
      );

      expect(results.improvement).toBeDefined();
    });
  });

  describe('rollback', () => {
    let parent, child;

    beforeEach(async () => {
      parent = await templateService.createTemplate('user-1', 'store-1', {
        examples: [{ price_text: '$1' }, { price_text: '$2' }, { price_text: '$3' }]
      });
      parent.status = TemplateStatus.ACTIVE;

      child = await templateService.updateFromCorrections(parent.id, {
        changes: { rules_count: 5 }
      });
    });

    it('should rollback to parent version', async () => {
      const restored = await templateService.rollback(child.id);

      expect(restored.id).toBe(parent.id);
      expect(restored.status).toBe(TemplateStatus.ACTIVE);
    });

    it('should archive the rolled-back version', async () => {
      await templateService.rollback(child.id);
      const archived = await templateService.getTemplate(child.id);

      expect(archived.status).toBe(TemplateStatus.ARCHIVED);
    });

    it('should throw error if no parent exists', async () => {
      await expect(
        templateService.rollback(parent.id)
      ).rejects.toThrow('no parent template exists');
    });
  });

  describe('shareTemplate', () => {
    let template;

    beforeEach(async () => {
      template = await templateService.createTemplate('user-1', 'store-1', {
        examples: [{ price_text: '$1' }, { price_text: '$2' }, { price_text: '$3' }]
      });
    });

    it('should make template public', async () => {
      const shared = await templateService.shareTemplate(template.id, true);

      expect(shared.is_public).toBe(true);
      expect(shared.status).toBe(TemplateStatus.ACTIVE);
      expect(shared.published_at).toBeDefined();
    });

    it('should make template private', async () => {
      await templateService.shareTemplate(template.id, true);
      const unshared = await templateService.shareTemplate(template.id, false);

      expect(unshared.is_public).toBe(false);
      expect(unshared.published_at).toBeNull();
    });
  });

  describe('getTemplatesByStore', () => {
    beforeEach(async () => {
      await templateService.createTemplate('user-1', 'kroger', {
        examples: [{ price_text: '$1' }, { price_text: '$2' }, { price_text: '$3' }]
      });
      await templateService.createTemplate('user-2', 'kroger', {
        examples: [{ price_text: '$4' }, { price_text: '$5' }, { price_text: '$6' }]
      });
      await templateService.createTemplate('user-1', 'walmart', {
        examples: [{ price_text: '$7' }, { price_text: '$8' }, { price_text: '$9' }]
      });
    });

    it('should return templates for specific store', async () => {
      const templates = await templateService.getTemplatesByStore('kroger');

      expect(templates.length).toBe(2);
      templates.forEach(t => expect(t.store_id).toBe('kroger'));
    });

    it('should filter by status', async () => {
      const templates = await templateService.getTemplatesByStore('kroger', {
        status: TemplateStatus.DRAFT
      });

      templates.forEach(t => expect(t.status).toBe(TemplateStatus.DRAFT));
    });
  });

  describe('getPublicTemplates', () => {
    beforeEach(async () => {
      const t1 = await templateService.createTemplate('user-1', 'store-1', {
        examples: [{ price_text: '$1' }, { price_text: '$2' }, { price_text: '$3' }]
      });
      const t2 = await templateService.createTemplate('user-2', 'store-2', {
        examples: [{ price_text: '$4' }, { price_text: '$5' }, { price_text: '$6' }]
      });

      await templateService.shareTemplate(t1.id, true);
      await templateService.shareTemplate(t2.id, true);
    });

    it('should return only public templates', async () => {
      const result = await templateService.getPublicTemplates();

      expect(result.templates.length).toBe(2);
      result.templates.forEach(t => expect(t.is_public).toBe(true));
    });

    it('should support pagination', async () => {
      const result = await templateService.getPublicTemplates({
        limit: 1,
        offset: 0
      });

      expect(result.templates.length).toBe(1);
      expect(result.total).toBe(2);
    });
  });

  describe('getVersionHistory', () => {
    it('should return complete version chain', async () => {
      const v1 = await templateService.createTemplate('user-1', 'store-1', {
        examples: [{ price_text: '$1' }, { price_text: '$2' }, { price_text: '$3' }]
      });

      const v2 = await templateService.updateFromCorrections(v1.id, {
        changes: {}
      });

      const v3 = await templateService.updateFromCorrections(v2.id, {
        changes: {}
      });

      const history = await templateService.getVersionHistory(v3.id);

      expect(history.length).toBe(3);
      expect(history[0].version).toBe('1.0.0');
      expect(history[1].version).toBe('1.0.1');
      expect(history[2].version).toBe('1.0.2');
    });
  });

  describe('getVersionDiff', () => {
    it('should compare two template versions', async () => {
      const v1 = await templateService.createTemplate('user-1', 'store-1', {
        examples: [{ price_text: '$1' }, { price_text: '$2' }, { price_text: '$3' }]
      });

      const v2 = await templateService.updateFromCorrections(v1.id, {
        savings_indicators: ['new-indicator']
      });

      const diff = await templateService.getVersionDiff(v1.id, v2.id);

      expect(diff.versions.v1).toBe('1.0.0');
      expect(diff.versions.v2).toBe('1.0.1');
      expect(diff.extraction_rules_diff.savings_indicators_added).toContain('new-indicator');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template owned by user', async () => {
      const template = await templateService.createTemplate('user-1', 'store-1', {
        examples: [{ price_text: '$1' }, { price_text: '$2' }, { price_text: '$3' }]
      });

      const result = await templateService.deleteTemplate(template.id, 'user-1');

      expect(result.deleted).toBe(true);

      const deleted = await templateService.getTemplate(template.id);
      expect(deleted).toBeNull();
    });

    it('should reject deletion by non-owner', async () => {
      const template = await templateService.createTemplate('user-1', 'store-1', {
        examples: [{ price_text: '$1' }, { price_text: '$2' }, { price_text: '$3' }]
      });

      await expect(
        templateService.deleteTemplate(template.id, 'user-2')
      ).rejects.toThrow('Unauthorized');
    });
  });
});
