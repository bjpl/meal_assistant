/**
 * Template Service
 * Handles template CRUD, versioning, corrections, and testing
 */

const { v4: uuidv4 } = require('uuid');
const {
  TemplateStatus,
  VersionChangeType,
  createTemplate,
  createTemplateVersion,
  compareVersions
} = require('./templateTypes');

// In-memory storage (replace with database in production)
const templateStore = new Map();
const templateVersionsIndex = new Map(); // storeId -> [templateIds]

/**
 * TemplateService class for managing ad extraction templates
 */
class TemplateService {
  /**
   * Create a new template from user annotations
   * @param {string} userId - User creating the template
   * @param {string} storeId - Store identifier
   * @param {Object} annotations - User-provided annotations
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(userId, storeId, annotations) {
    // Validate minimum annotation requirements (3+ annotations)
    if (!this.validateAnnotations(annotations)) {
      throw new Error('Template creation requires at least 3 annotated examples');
    }

    // Generate extraction rules from annotations
    const extractionRules = this.generateExtractionRules(annotations);

    // Calculate initial page structure
    const pageStructure = this.calculatePageStructure(annotations);

    // Create template with generated configuration
    const template = createTemplate(userId, storeId, {
      ...annotations,
      extraction_rules: extractionRules,
      page_structure: pageStructure
    });

    // Store template
    templateStore.set(template.id, template);

    // Index by store
    const storeTemplates = templateVersionsIndex.get(storeId) || [];
    storeTemplates.push(template.id);
    templateVersionsIndex.set(storeId, storeTemplates);

    return template;
  }

  /**
   * Validate that annotations meet minimum requirements
   * @param {Object} annotations - User annotations
   * @returns {boolean} Whether annotations are valid
   */
  validateAnnotations(annotations) {
    if (!annotations) return false;

    const examples = annotations.examples || [];
    return examples.length >= 3;
  }

  /**
   * Generate extraction rules from annotation examples
   * @param {Object} annotations - User annotations with examples
   * @returns {Object} Extraction rules
   */
  generateExtractionRules(annotations) {
    const examples = annotations.examples || [];

    // Analyze price patterns from examples
    const pricePatterns = this.extractPricePatterns(examples);

    // Identify product name regions
    const productNameRegions = this.extractProductRegions(examples);

    // Extract unit patterns
    const unitPatterns = this.extractUnitPatterns(examples);

    // Identify savings indicators
    const savingsIndicators = this.extractSavingsIndicators(examples);

    return {
      price_patterns: pricePatterns,
      product_name_regions: productNameRegions,
      unit_patterns: unitPatterns,
      savings_indicators: savingsIndicators,
      date_patterns: annotations.date_patterns || []
    };
  }

  /**
   * Extract price patterns from examples
   */
  extractPricePatterns(examples) {
    const patterns = new Set();

    // Default patterns
    patterns.add(/\$?\d+\.\d{2}/g);
    patterns.add(/\$?\d+\/\d+/g);

    // Analyze examples for additional patterns
    examples.forEach(example => {
      if (example.price_text) {
        // Detect BOGO patterns
        if (/buy\s+\d+\s+get\s+\d+/i.test(example.price_text)) {
          patterns.add(/buy\s+\d+\s+get\s+\d+\s*(?:free)?/gi);
        }
        // Detect X for $Y patterns
        if (/\d+\s+for\s+\$?\d+/i.test(example.price_text)) {
          patterns.add(/\d+\s+for\s+\$?\d+(?:\.\d{2})?/gi);
        }
        // Detect percentage off
        if (/\d+%\s*off/i.test(example.price_text)) {
          patterns.add(/\d+%\s*off/gi);
        }
      }
    });

    return Array.from(patterns).map(p => p.source || p.toString());
  }

  /**
   * Extract product name regions from examples
   */
  extractProductRegions(examples) {
    return examples
      .filter(e => e.product_region)
      .map(e => ({
        x: e.product_region.x,
        y: e.product_region.y,
        width: e.product_region.width,
        height: e.product_region.height,
        confidence: 1.0
      }));
  }

  /**
   * Extract unit patterns from examples
   */
  extractUnitPatterns(examples) {
    const patterns = new Set();

    // Default patterns
    [
      /\d+\s*(oz|lb|lbs|kg|g|ml|L|ct|pk|pack)/gi,
      /each/gi,
      /per\s+(lb|pound|oz|ounce)/gi
    ].forEach(p => patterns.add(p.source));

    // Analyze examples
    examples.forEach(example => {
      if (example.unit_text) {
        // Detect specific unit formats
        const unitMatch = example.unit_text.match(/\d+\s*([a-zA-Z]+)/);
        if (unitMatch) {
          patterns.add(`\\d+\\s*${unitMatch[1]}`);
        }
      }
    });

    return Array.from(patterns);
  }

  /**
   * Extract savings indicators from examples
   */
  extractSavingsIndicators(examples) {
    const indicators = new Set([
      'sale', 'save', 'off', 'reduced', 'clearance',
      'bogo', 'buy one get one', 'special', 'deal'
    ]);

    examples.forEach(example => {
      if (example.savings_text) {
        const words = example.savings_text.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 2) indicators.add(word);
        });
      }
    });

    return Array.from(indicators);
  }

  /**
   * Calculate page structure from annotated examples
   */
  calculatePageStructure(annotations) {
    const examples = annotations.examples || [];

    // Detect grid columns
    const xPositions = examples
      .filter(e => e.product_region)
      .map(e => e.product_region.x);

    const columns = this.detectColumns(xPositions);

    // Detect header/footer regions
    const yPositions = examples
      .filter(e => e.product_region)
      .map(e => e.product_region.y);

    const headerHeight = Math.min(...yPositions) || 0.1;
    const footerStart = Math.max(...yPositions.map(y => y + 0.1)) || 0.9;

    return {
      columns,
      deal_regions: examples.filter(e => e.deal_region).map(e => e.deal_region),
      header_region: { x: 0, y: 0, width: 1, height: headerHeight },
      footer_region: { x: 0, y: footerStart, width: 1, height: 1 - footerStart },
      sidebar_regions: []
    };
  }

  /**
   * Detect number of columns from x positions
   */
  detectColumns(xPositions) {
    if (xPositions.length < 2) return 1;

    const sorted = [...new Set(xPositions.map(x => Math.round(x * 10) / 10))].sort();
    return Math.min(sorted.length, 5);
  }

  /**
   * Update template from user corrections
   * @param {string} templateId - Template to update
   * @param {Object} corrections - User corrections
   * @returns {Promise<Object>} Updated template version
   */
  async updateFromCorrections(templateId, corrections) {
    const template = templateStore.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Analyze correction patterns to determine change type
    const changeType = this.analyzeCorrections(corrections);

    // Apply corrections to extraction rules
    const updatedRules = this.applyCorrections(template.extraction_rules, corrections);

    // Create new version
    const newVersion = createTemplateVersion(template, corrections, changeType);
    newVersion.extraction_rules = updatedRules;

    // Store new version
    templateStore.set(newVersion.id, newVersion);

    // Update store index
    const storeTemplates = templateVersionsIndex.get(template.store_id) || [];
    storeTemplates.push(newVersion.id);
    templateVersionsIndex.set(template.store_id, storeTemplates);

    // Mark original as deprecated if this is a minor/major update
    if (changeType !== VersionChangeType.PATCH) {
      template.status = TemplateStatus.DEPRECATED;
      templateStore.set(templateId, template);
    }

    return newVersion;
  }

  /**
   * Analyze corrections to determine version change type
   */
  analyzeCorrections(corrections) {
    if (!corrections || !corrections.changes) {
      return VersionChangeType.PATCH;
    }

    const changes = corrections.changes;

    // Major change: layout or structure changes
    if (changes.layout_changed || changes.structure_changed) {
      return VersionChangeType.MAJOR;
    }

    // Minor change: rule adjustments
    if (changes.rules_count > 3 || changes.regions_changed) {
      return VersionChangeType.MINOR;
    }

    // Patch: small fixes
    return VersionChangeType.PATCH;
  }

  /**
   * Apply corrections to extraction rules
   */
  applyCorrections(rules, corrections) {
    const updatedRules = { ...rules };

    if (corrections.price_patterns) {
      updatedRules.price_patterns = [
        ...rules.price_patterns,
        ...corrections.price_patterns
      ];
    }

    if (corrections.product_regions) {
      updatedRules.product_name_regions = [
        ...rules.product_name_regions,
        ...corrections.product_regions
      ];
    }

    if (corrections.unit_patterns) {
      updatedRules.unit_patterns = [
        ...rules.unit_patterns,
        ...corrections.unit_patterns
      ];
    }

    if (corrections.savings_indicators) {
      updatedRules.savings_indicators = [
        ...new Set([
          ...rules.savings_indicators,
          ...corrections.savings_indicators
        ])
      ];
    }

    return updatedRules;
  }

  /**
   * Test template on a test ad
   * @param {string} templateId - Template to test
   * @param {string} testAdId - Test ad identifier
   * @param {Object} testData - Test ad data with ground truth
   * @returns {Promise<Object>} Test results
   */
  async testTemplate(templateId, testAdId, testData = {}) {
    const template = templateStore.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Simulate extraction using template rules
    const extractionResults = this.simulateExtraction(template, testData);

    // Compare to ground truth if available
    let accuracy = null;
    if (testData.ground_truth) {
      accuracy = this.calculateAccuracy(extractionResults, testData.ground_truth);
    }

    // Update template metrics
    template.test_count++;
    if (accuracy !== null) {
      const prevTotal = template.accuracy_score
        ? template.accuracy_score * (template.test_count - 1)
        : 0;
      template.accuracy_score = (prevTotal + accuracy) / template.test_count;
    }

    if (extractionResults.success) {
      template.successful_extractions++;
    } else {
      template.failed_extractions++;
    }

    template.updated_at = new Date().toISOString();
    templateStore.set(templateId, template);

    // Compare to parent template if exists
    let improvement = null;
    if (template.parent_template_id) {
      const parent = templateStore.get(template.parent_template_id);
      if (parent && parent.accuracy_score !== null && accuracy !== null) {
        improvement = accuracy - parent.accuracy_score;
      }
    }

    return {
      template_id: templateId,
      test_ad_id: testAdId,
      extraction_results: extractionResults,
      accuracy,
      improvement,
      is_improvement: improvement !== null ? improvement > 0 : null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Simulate extraction using template rules
   */
  simulateExtraction(template, testData) {
    // This would integrate with actual OCR/extraction in production
    const results = {
      success: true,
      items: [],
      confidence: 0.85,
      errors: []
    };

    // Simulate price extraction
    if (testData.ad_text) {
      const priceRegex = /\$?\d+\.\d{2}/g;
      const prices = testData.ad_text.match(priceRegex) || [];
      results.items = prices.map((price, idx) => ({
        id: uuidv4(),
        price,
        confidence: 0.8 + Math.random() * 0.2
      }));
    }

    results.success = results.items.length > 0;
    return results;
  }

  /**
   * Calculate accuracy against ground truth
   */
  calculateAccuracy(results, groundTruth) {
    if (!groundTruth.items || groundTruth.items.length === 0) {
      return null;
    }

    const expectedPrices = new Set(groundTruth.items.map(i => i.price));
    const extractedPrices = new Set(results.items.map(i => i.price));

    let matches = 0;
    expectedPrices.forEach(price => {
      if (extractedPrices.has(price)) matches++;
    });

    const precision = results.items.length > 0
      ? matches / results.items.length
      : 0;
    const recall = matches / expectedPrices.size;

    // F1 score
    if (precision + recall === 0) return 0;
    return (2 * precision * recall) / (precision + recall);
  }

  /**
   * Rollback to parent template version
   * @param {string} templateId - Template to rollback
   * @returns {Promise<Object>} Restored parent template
   */
  async rollback(templateId) {
    const template = templateStore.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (!template.parent_template_id) {
      throw new Error('Cannot rollback: no parent template exists');
    }

    const parent = templateStore.get(template.parent_template_id);
    if (!parent) {
      throw new Error('Parent template not found');
    }

    // Mark current as archived
    template.status = TemplateStatus.ARCHIVED;
    template.updated_at = new Date().toISOString();
    templateStore.set(templateId, template);

    // Reactivate parent
    parent.status = TemplateStatus.ACTIVE;
    parent.updated_at = new Date().toISOString();
    templateStore.set(parent.id, parent);

    return parent;
  }

  /**
   * Share template publicly
   * @param {string} templateId - Template to share
   * @param {boolean} makePublic - Whether to make public
   * @returns {Promise<Object>} Updated template
   */
  async shareTemplate(templateId, makePublic = true) {
    const template = templateStore.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    template.is_public = makePublic;
    template.published_at = makePublic ? new Date().toISOString() : null;
    template.status = makePublic ? TemplateStatus.ACTIVE : template.status;
    template.updated_at = new Date().toISOString();

    templateStore.set(templateId, template);
    return template;
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId) {
    return templateStore.get(templateId) || null;
  }

  /**
   * Get all templates for a store
   */
  async getTemplatesByStore(storeId, options = {}) {
    const templateIds = templateVersionsIndex.get(storeId) || [];
    let templates = templateIds
      .map(id => templateStore.get(id))
      .filter(Boolean);

    // Filter by status
    if (options.status) {
      templates = templates.filter(t => t.status === options.status);
    }

    // Filter public only
    if (options.publicOnly) {
      templates = templates.filter(t => t.is_public);
    }

    // Sort by version (newest first)
    templates.sort((a, b) => compareVersions(b.version, a.version));

    return templates;
  }

  /**
   * Get templates by user
   */
  async getTemplatesByUser(userId, options = {}) {
    let templates = Array.from(templateStore.values())
      .filter(t => t.user_id === userId);

    if (options.status) {
      templates = templates.filter(t => t.status === options.status);
    }

    templates.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    return templates;
  }

  /**
   * Get public templates (community library)
   */
  async getPublicTemplates(options = {}) {
    let templates = Array.from(templateStore.values())
      .filter(t => t.is_public && t.status === TemplateStatus.ACTIVE);

    // Filter by store
    if (options.storeId) {
      templates = templates.filter(t => t.store_id === options.storeId);
    }

    // Sort options
    const sortBy = options.sortBy || 'downloads';
    switch (sortBy) {
      case 'rating':
        templates.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
        break;
      case 'accuracy':
        templates.sort((a, b) => (b.accuracy_score || 0) - (a.accuracy_score || 0));
        break;
      case 'recent':
        templates.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
        break;
      case 'downloads':
      default:
        templates.sort((a, b) => b.downloads - a.downloads);
        break;
    }

    // Pagination
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    return {
      templates: templates.slice(offset, offset + limit),
      total: templates.length,
      limit,
      offset
    };
  }

  /**
   * Download/clone a public template
   */
  async downloadTemplate(templateId, userId) {
    const original = templateStore.get(templateId);
    if (!original || !original.is_public) {
      throw new Error('Template not found or not public');
    }

    // Increment download count
    original.downloads++;
    templateStore.set(templateId, original);

    // Create a clone for the user
    const clone = {
      ...original,
      id: uuidv4(),
      user_id: userId,
      parent_template_id: templateId,
      is_public: false,
      is_official: false,
      downloads: 0,
      rating_sum: 0,
      rating_count: 0,
      avg_rating: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: null
    };

    templateStore.set(clone.id, clone);

    return clone;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId, userId) {
    const template = templateStore.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (template.user_id !== userId) {
      throw new Error('Unauthorized: not template owner');
    }

    // Remove from store index
    const storeTemplates = templateVersionsIndex.get(template.store_id) || [];
    const updatedList = storeTemplates.filter(id => id !== templateId);
    templateVersionsIndex.set(template.store_id, updatedList);

    // Delete template
    templateStore.delete(templateId);

    return { deleted: true, templateId };
  }

  /**
   * Get version history for a template chain
   */
  async getVersionHistory(templateId) {
    const template = templateStore.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const history = [];
    let current = template;

    while (current) {
      history.unshift({
        id: current.id,
        version: current.version,
        status: current.status,
        accuracy_score: current.accuracy_score,
        created_at: current.created_at,
        version_history: current.version_history
      });

      current = current.parent_template_id
        ? templateStore.get(current.parent_template_id)
        : null;
    }

    return history;
  }

  /**
   * Get diff between two template versions
   */
  async getVersionDiff(templateId1, templateId2) {
    const t1 = templateStore.get(templateId1);
    const t2 = templateStore.get(templateId2);

    if (!t1 || !t2) {
      throw new Error('One or both templates not found');
    }

    return {
      versions: {
        v1: t1.version,
        v2: t2.version
      },
      layout_changed: t1.layout_type !== t2.layout_type,
      extraction_rules_diff: {
        price_patterns_added: t2.extraction_rules.price_patterns
          .filter(p => !t1.extraction_rules.price_patterns.includes(p)),
        price_patterns_removed: t1.extraction_rules.price_patterns
          .filter(p => !t2.extraction_rules.price_patterns.includes(p)),
        savings_indicators_added: t2.extraction_rules.savings_indicators
          .filter(s => !t1.extraction_rules.savings_indicators.includes(s)),
        savings_indicators_removed: t1.extraction_rules.savings_indicators
          .filter(s => !t2.extraction_rules.savings_indicators.includes(s))
      },
      accuracy_change: t2.accuracy_score !== null && t1.accuracy_score !== null
        ? t2.accuracy_score - t1.accuracy_score
        : null,
      confidence_thresholds_changed:
        JSON.stringify(t1.confidence_thresholds) !== JSON.stringify(t2.confidence_thresholds)
    };
  }

  /**
   * Clear all templates (for testing)
   */
  clearAll() {
    templateStore.clear();
    templateVersionsIndex.clear();
  }
}

// Export singleton instance
module.exports = new TemplateService();
module.exports.TemplateService = TemplateService;
module.exports.templateStore = templateStore;
