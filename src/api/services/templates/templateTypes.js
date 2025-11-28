/**
 * Template Types and Interfaces
 * Defines the structure for ad templates, versioning, and marketplace
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Layout types for grocery store ads
 */
const LayoutType = {
  GRID: 'grid',
  LIST: 'list',
  MIXED: 'mixed',
  CIRCULAR: 'circular',
  FLYER: 'flyer'
};

/**
 * Template status
 */
const TemplateStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  TESTING: 'testing',
  DEPRECATED: 'deprecated',
  ARCHIVED: 'archived'
};

/**
 * Version change types (semantic versioning)
 */
const VersionChangeType = {
  MAJOR: 'major',    // Layout change
  MINOR: 'minor',    // Rule adjustments
  PATCH: 'patch'     // Bug fixes
};

/**
 * Confidence thresholds for auto-apply vs review
 */
const DEFAULT_CONFIDENCE_THRESHOLDS = {
  auto_apply: 0.85,
  suggest: 0.60,
  flag_review: 0.40
};

/**
 * BoundingBox structure for regions
 * @typedef {Object} BoundingBox
 * @property {number} x - X coordinate (0-1 normalized)
 * @property {number} y - Y coordinate (0-1 normalized)
 * @property {number} width - Width (0-1 normalized)
 * @property {number} height - Height (0-1 normalized)
 */

/**
 * Create a bounding box
 */
function createBoundingBox(x, y, width, height) {
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    width: Math.max(0, Math.min(1 - x, width)),
    height: Math.max(0, Math.min(1 - y, height))
  };
}

/**
 * Page structure definition
 */
function createPageStructure(data = {}) {
  return {
    columns: data.columns || 3,
    deal_regions: data.deal_regions || [],
    header_region: data.header_region || createBoundingBox(0, 0, 1, 0.1),
    footer_region: data.footer_region || createBoundingBox(0, 0.9, 1, 0.1),
    sidebar_regions: data.sidebar_regions || []
  };
}

/**
 * Extraction rules for parsing ads
 */
function createExtractionRules(data = {}) {
  return {
    price_patterns: data.price_patterns || [
      /\$?\d+\.\d{2}/g,
      /\$?\d+\/\d+/g,
      /\d+ for \$?\d+\.\d{2}/g,
      /buy \d+ get \d+/gi
    ],
    product_name_regions: data.product_name_regions || [],
    unit_patterns: data.unit_patterns || [
      /\d+\s*(oz|lb|lbs|kg|g|ml|L|ct|pk|pack)/gi,
      /each/gi,
      /per\s+(lb|pound|oz|ounce)/gi
    ],
    savings_indicators: data.savings_indicators || [
      'sale',
      'save',
      'off',
      'reduced',
      'clearance',
      'bogo',
      'buy one get one',
      'special'
    ],
    date_patterns: data.date_patterns || [
      /valid\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/gi,
      /expires?\s+\d{1,2}\/\d{1,2}/gi,
      /through\s+\d{1,2}\/\d{1,2}/gi
    ]
  };
}

/**
 * Create a new template
 * @param {string} userId - Creator user ID
 * @param {string} storeId - Store identifier
 * @param {Object} annotations - User annotations for training
 * @returns {Object} New template object
 */
function createTemplate(userId, storeId, annotations = {}) {
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    user_id: userId,
    store_id: storeId,
    name: annotations.name || `${storeId}_template`,
    description: annotations.description || '',

    // Versioning
    version: '1.0.0',
    parent_template_id: null,
    version_history: [{
      version: '1.0.0',
      created_at: now,
      change_type: 'major',
      change_notes: 'Initial template creation',
      created_by: userId
    }],

    // Layout
    layout_type: annotations.layout_type || LayoutType.GRID,
    page_structure: createPageStructure(annotations.page_structure),

    // Extraction configuration
    extraction_rules: createExtractionRules(annotations.extraction_rules),
    confidence_thresholds: annotations.confidence_thresholds || { ...DEFAULT_CONFIDENCE_THRESHOLDS },

    // Metrics
    accuracy_score: null,
    test_count: 0,
    successful_extractions: 0,
    failed_extractions: 0,

    // Status
    status: TemplateStatus.DRAFT,
    is_public: false,
    is_official: false,

    // Community
    downloads: 0,
    rating_sum: 0,
    rating_count: 0,
    avg_rating: null,

    // Metadata
    tags: annotations.tags || [],
    created_at: now,
    updated_at: now,
    published_at: null
  };
}

/**
 * Create a template version from corrections
 * @param {Object} template - Original template
 * @param {Object} corrections - User corrections
 * @param {string} changeType - Type of change (major/minor/patch)
 * @returns {Object} New version of template
 */
function createTemplateVersion(template, corrections, changeType = VersionChangeType.MINOR) {
  const now = new Date().toISOString();
  const [major, minor, patch] = template.version.split('.').map(Number);

  let newVersion;
  switch (changeType) {
    case VersionChangeType.MAJOR:
      newVersion = `${major + 1}.0.0`;
      break;
    case VersionChangeType.MINOR:
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case VersionChangeType.PATCH:
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }

  return {
    ...template,
    id: uuidv4(),
    parent_template_id: template.id,
    version: newVersion,
    version_history: [
      ...template.version_history,
      {
        version: newVersion,
        created_at: now,
        change_type: changeType,
        change_notes: corrections.notes || 'Updated from corrections',
        created_by: corrections.user_id || template.user_id,
        corrections_applied: corrections.count || 0
      }
    ],
    status: TemplateStatus.TESTING,
    accuracy_score: null,
    test_count: 0,
    updated_at: now
  };
}

/**
 * Create A/B test configuration
 * @param {string} originalTemplateId - Control template
 * @param {string} variantTemplateId - Variant template
 * @param {Object} config - Test configuration
 * @returns {Object} A/B test object
 */
function createABTest(originalTemplateId, variantTemplateId, config = {}) {
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    name: config.name || `AB Test ${now.split('T')[0]}`,

    // Templates
    control_template_id: originalTemplateId,
    variant_template_id: variantTemplateId,

    // Split configuration
    traffic_split: config.traffic_split || 0.5, // 50% to variant

    // Results tracking
    control_results: {
      impressions: 0,
      successful_extractions: 0,
      accuracy_sum: 0,
      avg_accuracy: null
    },
    variant_results: {
      impressions: 0,
      successful_extractions: 0,
      accuracy_sum: 0,
      avg_accuracy: null
    },

    // Test parameters
    min_sample_size: config.min_sample_size || 100,
    confidence_level: config.confidence_level || 0.95,

    // Status
    status: 'pending', // pending, running, completed, cancelled
    winner: null,

    // Timestamps
    created_at: now,
    started_at: null,
    completed_at: null,

    // Metadata
    created_by: config.user_id,
    notes: config.notes || ''
  };
}

/**
 * Create template rating/review
 * @param {string} userId - Reviewer ID
 * @param {string} templateId - Template being reviewed
 * @param {number} rating - 1-5 stars
 * @param {string} comment - Optional review text
 * @returns {Object} Review object
 */
function createTemplateReview(userId, templateId, rating, comment = '') {
  return {
    id: uuidv4(),
    user_id: userId,
    template_id: templateId,
    rating: Math.max(1, Math.min(5, rating)),
    comment,
    helpful_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Parse semantic version string
 * @param {string} version - Version string (e.g., "1.2.3")
 * @returns {Object} Parsed version components
 */
function parseVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major: major || 0, minor: minor || 0, patch: patch || 0 };
}

/**
 * Compare two versions
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;
  return 0;
}

module.exports = {
  LayoutType,
  TemplateStatus,
  VersionChangeType,
  DEFAULT_CONFIDENCE_THRESHOLDS,
  createBoundingBox,
  createPageStructure,
  createExtractionRules,
  createTemplate,
  createTemplateVersion,
  createABTest,
  createTemplateReview,
  parseVersion,
  compareVersions
};
