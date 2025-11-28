/**
 * Unit Tests: Template System
 * Tests template creation, versioning, A/B testing, and community features
 * Target: 30 tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  AdTemplate,
  TemplateRegion,
  AD_TEMPLATES,
  STORE_CONFIGS
} from '../../fixtures/ads/testAdData';

// Types for template system
interface TemplateVersion {
  version: string;
  createdAt: string;
  accuracy: number;
  changes: string[];
}

interface ABTestConfig {
  id: string;
  templateA: string;
  templateB: string;
  startDate: string;
  endDate?: string;
  resultsA: { uses: number; accuracy: number };
  resultsB: { uses: number; accuracy: number };
  winner?: 'A' | 'B' | 'none';
}

interface MarketplaceTemplate {
  template: AdTemplate;
  author: string;
  downloads: number;
  rating: number;
  reviews: number;
  price: 'free' | number;
}

// Template System Service (to be implemented)
const createTemplateSystemService = () => {
  const templates: Map<string, AdTemplate> = new Map();
  const versions: Map<string, TemplateVersion[]> = new Map();
  const abTests: Map<string, ABTestConfig> = new Map();
  const marketplace: MarketplaceTemplate[] = [];

  // Initialize with fixtures
  AD_TEMPLATES.forEach(t => templates.set(t.id, { ...t }));

  return {
    // Template CRUD
    createTemplate(
      storeId: string,
      regions: TemplateRegion[],
      options?: { name?: string }
    ): AdTemplate {
      const store = Object.values(STORE_CONFIGS).find(s => s.id === storeId);
      const id = `template-${storeId}-${Date.now()}`;

      const template: AdTemplate = {
        id,
        storeId,
        storeName: store?.name || 'Unknown',
        version: '1.0.0',
        regions,
        accuracy: 0,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft'
      };

      templates.set(id, template);
      versions.set(id, [{ version: '1.0.0', createdAt: template.createdAt, accuracy: 0, changes: ['Initial version'] }]);

      return template;
    },

    getTemplate(id: string): AdTemplate | undefined {
      return templates.get(id);
    },

    updateTemplate(id: string, updates: Partial<AdTemplate>): AdTemplate | null {
      const template = templates.get(id);
      if (!template) return null;

      const updated = {
        ...template,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      templates.set(id, updated);
      return updated;
    },

    deleteTemplate(id: string): boolean {
      return templates.delete(id);
    },

    // Versioning
    createNewVersion(
      templateId: string,
      changes: string[],
      newRegions?: TemplateRegion[]
    ): string | null {
      const template = templates.get(templateId);
      if (!template) return null;

      const [major, minor, patch] = template.version.split('.').map(Number);
      const newVersion = changes.some(c => c.includes('major'))
        ? `${major + 1}.0.0`
        : changes.some(c => c.includes('region'))
          ? `${major}.${minor + 1}.0`
          : `${major}.${minor}.${patch + 1}`;

      template.version = newVersion;
      template.updatedAt = new Date().toISOString();

      if (newRegions) {
        template.regions = newRegions;
      }

      const versionHistory = versions.get(templateId) || [];
      versionHistory.push({
        version: newVersion,
        createdAt: template.updatedAt,
        accuracy: template.accuracy,
        changes
      });
      versions.set(templateId, versionHistory);

      return newVersion;
    },

    getVersionHistory(templateId: string): TemplateVersion[] {
      return versions.get(templateId) || [];
    },

    rollbackToVersion(templateId: string, targetVersion: string): boolean {
      const history = versions.get(templateId);
      if (!history) return false;

      const targetEntry = history.find(v => v.version === targetVersion);
      if (!targetEntry) return false;

      const template = templates.get(templateId);
      if (!template) return false;

      template.version = targetVersion;
      template.accuracy = targetEntry.accuracy;
      template.updatedAt = new Date().toISOString();

      return true;
    },

    // A/B Testing
    createABTest(templateIdA: string, templateIdB: string): ABTestConfig | null {
      const templateA = templates.get(templateIdA);
      const templateB = templates.get(templateIdB);

      if (!templateA || !templateB) return null;

      const test: ABTestConfig = {
        id: `ab-test-${Date.now()}`,
        templateA: templateIdA,
        templateB: templateIdB,
        startDate: new Date().toISOString(),
        resultsA: { uses: 0, accuracy: 0 },
        resultsB: { uses: 0, accuracy: 0 }
      };

      abTests.set(test.id, test);
      return test;
    },

    recordABTestResult(testId: string, variant: 'A' | 'B', accuracy: number): void {
      const test = abTests.get(testId);
      if (!test) return;

      const results = variant === 'A' ? test.resultsA : test.resultsB;
      results.uses++;
      results.accuracy = (results.accuracy * (results.uses - 1) + accuracy) / results.uses;
    },

    concludeABTest(testId: string): 'A' | 'B' | 'none' {
      const test = abTests.get(testId);
      if (!test) return 'none';

      // Minimum uses required
      if (test.resultsA.uses < 5 || test.resultsB.uses < 5) {
        return 'none';
      }

      // Determine winner with statistical significance
      const diff = Math.abs(test.resultsA.accuracy - test.resultsB.accuracy);
      if (diff < 0.05) {
        test.winner = 'none';
      } else {
        test.winner = test.resultsA.accuracy > test.resultsB.accuracy ? 'A' : 'B';
      }

      test.endDate = new Date().toISOString();
      return test.winner;
    },

    getABTest(testId: string): ABTestConfig | undefined {
      return abTests.get(testId);
    },

    // Region Management
    addRegion(templateId: string, region: TemplateRegion): boolean {
      const template = templates.get(templateId);
      if (!template) return false;

      template.regions.push(region);
      this.createNewVersion(templateId, ['Added new region']);
      return true;
    },

    updateRegion(templateId: string, regionId: string, updates: Partial<TemplateRegion>): boolean {
      const template = templates.get(templateId);
      if (!template) return false;

      const region = template.regions.find(r => r.id === regionId);
      if (!region) return false;

      Object.assign(region, updates);
      this.createNewVersion(templateId, ['Updated region coordinates']);
      return true;
    },

    removeRegion(templateId: string, regionId: string): boolean {
      const template = templates.get(templateId);
      if (!template) return false;

      const idx = template.regions.findIndex(r => r.id === regionId);
      if (idx === -1) return false;

      template.regions.splice(idx, 1);
      this.createNewVersion(templateId, ['Removed region']);
      return true;
    },

    // Status Management
    setTemplateStatus(templateId: string, status: AdTemplate['status']): boolean {
      const template = templates.get(templateId);
      if (!template) return false;

      template.status = status;
      template.updatedAt = new Date().toISOString();
      return true;
    },

    // Marketplace
    publishToMarketplace(templateId: string, author: string, price: 'free' | number = 'free'): MarketplaceTemplate | null {
      const template = templates.get(templateId);
      if (!template || template.status !== 'active') return null;

      const marketplaceEntry: MarketplaceTemplate = {
        template: { ...template },
        author,
        downloads: 0,
        rating: 0,
        reviews: 0,
        price
      };

      marketplace.push(marketplaceEntry);
      return marketplaceEntry;
    },

    getMarketplaceTemplates(storeId?: string): MarketplaceTemplate[] {
      return storeId
        ? marketplace.filter(m => m.template.storeId === storeId)
        : [...marketplace];
    },

    downloadTemplate(templateId: string): AdTemplate | null {
      const entry = marketplace.find(m => m.template.id === templateId);
      if (!entry) return null;

      entry.downloads++;
      return { ...entry.template };
    },

    rateTemplate(templateId: string, rating: number): boolean {
      const entry = marketplace.find(m => m.template.id === templateId);
      if (!entry || rating < 1 || rating > 5) return false;

      entry.rating = (entry.rating * entry.reviews + rating) / (entry.reviews + 1);
      entry.reviews++;
      return true;
    },

    // Template Application
    applyTemplate(templateId: string): void {
      const template = templates.get(templateId);
      if (template) {
        template.usageCount++;
      }
    },

    // Accuracy Tracking
    updateTemplateAccuracy(templateId: string, newAccuracy: number): void {
      const template = templates.get(templateId);
      if (!template) return;

      // Weighted average with usage count
      const totalUses = template.usageCount + 1;
      template.accuracy = (template.accuracy * template.usageCount + newAccuracy) / totalUses;
      template.usageCount = totalUses;
    },

    // Listing
    listTemplates(filters?: { storeId?: string; status?: AdTemplate['status'] }): AdTemplate[] {
      let result = Array.from(templates.values());

      if (filters?.storeId) {
        result = result.filter(t => t.storeId === filters.storeId);
      }

      if (filters?.status) {
        result = result.filter(t => t.status === filters.status);
      }

      return result;
    },

    // Clear for testing
    clear(): void {
      templates.clear();
      versions.clear();
      abTests.clear();
      marketplace.length = 0;

      // Re-initialize fixtures
      AD_TEMPLATES.forEach(t => templates.set(t.id, { ...t }));
    }
  };
};

describe('Template System', () => {
  let service: ReturnType<typeof createTemplateSystemService>;

  beforeEach(() => {
    service = createTemplateSystemService();
    service.clear();
  });

  describe('Template Creation', () => {
    // Test 1
    it('should create template from annotations', () => {
      const regions: TemplateRegion[] = [
        { id: 'r1', name: 'Product', type: 'product', coordinates: { x: 10, y: 10, width: 100, height: 30 }, confidence: 0.85 },
        { id: 'r2', name: 'Price', type: 'price', coordinates: { x: 120, y: 10, width: 50, height: 30 }, confidence: 0.90 }
      ];

      const template = service.createTemplate('store-safeway', regions);

      expect(template.id).toBeDefined();
      expect(template.version).toBe('1.0.0');
      expect(template.regions).toHaveLength(2);
      expect(template.status).toBe('draft');
    });

    // Test 2
    it('should assign correct store name', () => {
      const template = service.createTemplate('store-kroger', []);

      expect(template.storeName).toBe('Kroger');
    });

    // Test 3
    it('should initialize with zero accuracy', () => {
      const template = service.createTemplate('store-walmart', []);

      expect(template.accuracy).toBe(0);
      expect(template.usageCount).toBe(0);
    });

    // Test 4
    it('should get template by ID', () => {
      const created = service.createTemplate('store-safeway', []);
      const retrieved = service.getTemplate(created.id);

      expect(retrieved).toEqual(created);
    });

    // Test 5
    it('should update template', () => {
      const template = service.createTemplate('store-safeway', []);
      const updated = service.updateTemplate(template.id, { accuracy: 0.75 });

      expect(updated?.accuracy).toBe(0.75);
    });

    // Test 6
    it('should delete template', () => {
      const template = service.createTemplate('store-safeway', []);
      const deleted = service.deleteTemplate(template.id);

      expect(deleted).toBe(true);
      expect(service.getTemplate(template.id)).toBeUndefined();
    });
  });

  describe('Versioning', () => {
    // Test 7
    it('should create new minor version', () => {
      const template = service.createTemplate('store-safeway', []);
      const newVersion = service.createNewVersion(template.id, ['Updated region coordinates']);

      expect(newVersion).toBe('1.0.1');
    });

    // Test 8
    it('should create new minor version for region changes', () => {
      const template = service.createTemplate('store-safeway', []);
      const newVersion = service.createNewVersion(template.id, ['Added new region']);

      expect(newVersion).toBe('1.1.0');
    });

    // Test 9
    it('should create new major version', () => {
      const template = service.createTemplate('store-safeway', []);
      const newVersion = service.createNewVersion(template.id, ['major restructure']);

      expect(newVersion).toBe('2.0.0');
    });

    // Test 10
    it('should track version history', () => {
      const template = service.createTemplate('store-safeway', []);
      service.createNewVersion(template.id, ['Change 1']);
      service.createNewVersion(template.id, ['Change 2']);

      const history = service.getVersionHistory(template.id);

      expect(history).toHaveLength(3);
      expect(history[0].version).toBe('1.0.0');
    });

    // Test 11
    it('should rollback to previous version', () => {
      const template = service.createTemplate('store-safeway', []);
      service.createNewVersion(template.id, ['Change 1']);
      service.createNewVersion(template.id, ['Change 2']);

      const success = service.rollbackToVersion(template.id, '1.0.0');
      const current = service.getTemplate(template.id);

      expect(success).toBe(true);
      expect(current?.version).toBe('1.0.0');
    });

    // Test 12
    it('should fail rollback to non-existent version', () => {
      const template = service.createTemplate('store-safeway', []);
      const success = service.rollbackToVersion(template.id, '9.9.9');

      expect(success).toBe(false);
    });
  });

  describe('A/B Testing', () => {
    // Test 13
    it('should create A/B test between templates', () => {
      const templateA = service.createTemplate('store-safeway', []);
      const templateB = service.createTemplate('store-safeway', []);

      const test = service.createABTest(templateA.id, templateB.id);

      expect(test).not.toBeNull();
      expect(test?.templateA).toBe(templateA.id);
      expect(test?.templateB).toBe(templateB.id);
    });

    // Test 14
    it('should record A/B test results', () => {
      const templateA = service.createTemplate('store-safeway', []);
      const templateB = service.createTemplate('store-safeway', []);
      const test = service.createABTest(templateA.id, templateB.id)!;

      service.recordABTestResult(test.id, 'A', 0.75);
      service.recordABTestResult(test.id, 'A', 0.80);
      service.recordABTestResult(test.id, 'B', 0.65);

      const updated = service.getABTest(test.id);

      expect(updated?.resultsA.uses).toBe(2);
      expect(updated?.resultsA.accuracy).toBeCloseTo(0.775);
      expect(updated?.resultsB.uses).toBe(1);
    });

    // Test 15
    it('should determine A/B test winner', () => {
      const templateA = service.createTemplate('store-safeway', []);
      const templateB = service.createTemplate('store-safeway', []);
      const test = service.createABTest(templateA.id, templateB.id)!;

      // A is better
      for (let i = 0; i < 10; i++) {
        service.recordABTestResult(test.id, 'A', 0.80);
        service.recordABTestResult(test.id, 'B', 0.60);
      }

      const winner = service.concludeABTest(test.id);

      expect(winner).toBe('A');
    });

    // Test 16
    it('should return none if results too close', () => {
      const templateA = service.createTemplate('store-safeway', []);
      const templateB = service.createTemplate('store-safeway', []);
      const test = service.createABTest(templateA.id, templateB.id)!;

      for (let i = 0; i < 10; i++) {
        service.recordABTestResult(test.id, 'A', 0.70);
        service.recordABTestResult(test.id, 'B', 0.72);
      }

      const winner = service.concludeABTest(test.id);

      expect(winner).toBe('none');
    });

    // Test 17
    it('should require minimum uses', () => {
      const templateA = service.createTemplate('store-safeway', []);
      const templateB = service.createTemplate('store-safeway', []);
      const test = service.createABTest(templateA.id, templateB.id)!;

      service.recordABTestResult(test.id, 'A', 0.90);
      service.recordABTestResult(test.id, 'B', 0.50);

      const winner = service.concludeABTest(test.id);

      expect(winner).toBe('none'); // Not enough data
    });
  });

  describe('Region Management', () => {
    // Test 18
    it('should add region to template', () => {
      const template = service.createTemplate('store-safeway', []);
      const region: TemplateRegion = {
        id: 'new-r',
        name: 'New Region',
        type: 'product',
        coordinates: { x: 0, y: 0, width: 100, height: 50 },
        confidence: 0.8
      };

      const success = service.addRegion(template.id, region);
      const updated = service.getTemplate(template.id);

      expect(success).toBe(true);
      expect(updated?.regions).toHaveLength(1);
    });

    // Test 19
    it('should update region coordinates', () => {
      const region: TemplateRegion = {
        id: 'r1',
        name: 'Product',
        type: 'product',
        coordinates: { x: 10, y: 10, width: 100, height: 30 },
        confidence: 0.85
      };
      const template = service.createTemplate('store-safeway', [region]);

      const success = service.updateRegion(template.id, 'r1', {
        coordinates: { x: 20, y: 20, width: 150, height: 40 }
      });

      const updated = service.getTemplate(template.id);

      expect(success).toBe(true);
      expect(updated?.regions[0].coordinates.x).toBe(20);
    });

    // Test 20
    it('should remove region', () => {
      const region: TemplateRegion = {
        id: 'r1',
        name: 'Product',
        type: 'product',
        coordinates: { x: 10, y: 10, width: 100, height: 30 },
        confidence: 0.85
      };
      const template = service.createTemplate('store-safeway', [region]);

      const success = service.removeRegion(template.id, 'r1');
      const updated = service.getTemplate(template.id);

      expect(success).toBe(true);
      expect(updated?.regions).toHaveLength(0);
    });
  });

  describe('Status Management', () => {
    // Test 21
    it('should set template status to active', () => {
      const template = service.createTemplate('store-safeway', []);
      service.setTemplateStatus(template.id, 'active');

      const updated = service.getTemplate(template.id);

      expect(updated?.status).toBe('active');
    });

    // Test 22
    it('should set template status to deprecated', () => {
      const template = service.createTemplate('store-safeway', []);
      service.setTemplateStatus(template.id, 'deprecated');

      const updated = service.getTemplate(template.id);

      expect(updated?.status).toBe('deprecated');
    });
  });

  describe('Marketplace', () => {
    // Test 23
    it('should publish active template to marketplace', () => {
      const template = service.createTemplate('store-safeway', []);
      service.setTemplateStatus(template.id, 'active');

      const published = service.publishToMarketplace(template.id, 'testuser');

      expect(published).not.toBeNull();
      expect(published?.author).toBe('testuser');
      expect(published?.downloads).toBe(0);
    });

    // Test 24
    it('should not publish draft template', () => {
      const template = service.createTemplate('store-safeway', []);

      const published = service.publishToMarketplace(template.id, 'testuser');

      expect(published).toBeNull();
    });

    // Test 25
    it('should list marketplace templates', () => {
      const template1 = service.createTemplate('store-safeway', []);
      const template2 = service.createTemplate('store-kroger', []);
      service.setTemplateStatus(template1.id, 'active');
      service.setTemplateStatus(template2.id, 'active');
      service.publishToMarketplace(template1.id, 'user1');
      service.publishToMarketplace(template2.id, 'user2');

      const all = service.getMarketplaceTemplates();
      const safewayOnly = service.getMarketplaceTemplates('store-safeway');

      expect(all).toHaveLength(2);
      expect(safewayOnly).toHaveLength(1);
    });

    // Test 26
    it('should download template and increment counter', () => {
      const template = service.createTemplate('store-safeway', []);
      service.setTemplateStatus(template.id, 'active');
      service.publishToMarketplace(template.id, 'testuser');

      service.downloadTemplate(template.id);
      service.downloadTemplate(template.id);

      const marketplace = service.getMarketplaceTemplates();

      expect(marketplace[0].downloads).toBe(2);
    });

    // Test 27
    it('should rate template', () => {
      const template = service.createTemplate('store-safeway', []);
      service.setTemplateStatus(template.id, 'active');
      service.publishToMarketplace(template.id, 'testuser');

      service.rateTemplate(template.id, 5);
      service.rateTemplate(template.id, 4);

      const marketplace = service.getMarketplaceTemplates();

      expect(marketplace[0].rating).toBe(4.5);
      expect(marketplace[0].reviews).toBe(2);
    });
  });

  describe('Accuracy Tracking', () => {
    // Test 28
    it('should update template accuracy', () => {
      const template = service.createTemplate('store-safeway', []);

      service.updateTemplateAccuracy(template.id, 0.70);
      service.updateTemplateAccuracy(template.id, 0.80);

      const updated = service.getTemplate(template.id);

      expect(updated?.accuracy).toBeCloseTo(0.75);
      expect(updated?.usageCount).toBe(2);
    });

    // Test 29
    it('should track usage count', () => {
      const template = service.createTemplate('store-safeway', []);

      service.applyTemplate(template.id);
      service.applyTemplate(template.id);
      service.applyTemplate(template.id);

      const updated = service.getTemplate(template.id);

      expect(updated?.usageCount).toBe(3);
    });
  });

  describe('Listing and Filtering', () => {
    // Test 30
    it('should list templates with filters', () => {
      const t1 = service.createTemplate('store-safeway', []);
      const t2 = service.createTemplate('store-kroger', []);
      const t3 = service.createTemplate('store-safeway', []);
      service.setTemplateStatus(t1.id, 'active');
      service.setTemplateStatus(t3.id, 'active');

      const safewayActive = service.listTemplates({ storeId: 'store-safeway', status: 'active' });

      expect(safewayActive).toHaveLength(1);
      expect(safewayActive[0].id).toBe(t1.id);
    });
  });
});
