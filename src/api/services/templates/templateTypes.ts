/**
 * Template Types and Interfaces
 * Defines the structure for ad templates, versioning, and marketplace
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Layout types for grocery store ads
 */
export enum LayoutType {
  GRID = 'grid',
  LIST = 'list',
  MIXED = 'mixed',
  CIRCULAR = 'circular',
  FLYER = 'flyer'
}

/**
 * Template status
 */
export enum TemplateStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  TESTING = 'testing',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived'
}

/**
 * Version change types (semantic versioning)
 */
export enum VersionChangeType {
  MAJOR = 'major',    // Layout change
  MINOR = 'minor',    // Rule adjustments
  PATCH = 'patch'     // Bug fixes
}

/**
 * Confidence thresholds for auto-apply vs review
 */
export const DEFAULT_CONFIDENCE_THRESHOLDS = {
  auto_apply: 0.85,
  suggest: 0.60,
  flag_review: 0.40
};

/**
 * BoundingBox structure for regions
 */
export interface BoundingBox {
  x: number;           // X coordinate (0-1 normalized)
  y: number;           // Y coordinate (0-1 normalized)
  width: number;       // Width (0-1 normalized)
  height: number;      // Height (0-1 normalized)
}

/**
 * Page structure definition
 */
export interface PageStructure {
  columns: number;
  deal_regions: BoundingBox[];
  header_region: BoundingBox;
  footer_region: BoundingBox;
  sidebar_regions: BoundingBox[];
}

/**
 * Extraction rules for parsing ads
 */
export interface ExtractionRules {
  price_patterns: (RegExp | string)[];
  product_name_regions: (BoundingBox & { confidence: number })[];
  unit_patterns: (RegExp | string)[];
  savings_indicators: string[];
  date_patterns: (RegExp | string)[];
}

/**
 * Version history entry
 */
export interface VersionHistoryEntry {
  version: string;
  created_at: string;
  change_type: VersionChangeType;
  change_notes: string;
  created_by: string;
  corrections_applied?: number;
}

/**
 * Template interface
 */
export interface Template {
  id: string;
  user_id: string;
  store_id: string;
  name: string;
  description: string;

  // Versioning
  version: string;
  parent_template_id: string | null;
  version_history: VersionHistoryEntry[];

  // Layout
  layout_type: LayoutType;
  page_structure: PageStructure;

  // Extraction configuration
  extraction_rules: ExtractionRules;
  confidence_thresholds: typeof DEFAULT_CONFIDENCE_THRESHOLDS;

  // Metrics
  accuracy_score: number | null;
  test_count: number;
  successful_extractions: number;
  failed_extractions: number;

  // Status
  status: TemplateStatus;
  is_public: boolean;
  is_official: boolean;

  // Community
  downloads: number;
  rating_sum: number;
  rating_count: number;
  avg_rating: number | null;

  // Metadata
  tags: string[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
  marketplace_data?: MarketplaceData;
  rollout?: RolloutConfig;
}

/**
 * Marketplace data
 */
export interface MarketplaceData {
  title: string;
  description: string;
  category: string;
  tags: string[];
  screenshots: string[];
  documentation_url: string | null;
}

/**
 * A/B test configuration
 */
export interface ABTest {
  id: string;
  name: string;

  // Templates
  control_template_id: string;
  variant_template_id: string;

  // Split configuration
  traffic_split: number;

  // Results tracking
  control_results: ABTestResults;
  variant_results: ABTestResults;

  // Test parameters
  min_sample_size: number;
  confidence_level: number;

  // Status
  status: 'pending' | 'running' | 'completed' | 'cancelled';
  winner: 'control' | 'variant' | null;
  winning_template_id?: string;

  // Timestamps
  created_at: string;
  started_at: string | null;
  completed_at: string | null;

  // Metadata
  created_by: string;
  notes: string;
  store_id?: string;
  analysis?: ABTestAnalysis;
  rollout?: RolloutConfig;
}

/**
 * A/B test results
 */
export interface ABTestResults {
  impressions: number;
  successful_extractions: number;
  accuracy_sum: number;
  avg_accuracy: number | null;
}

/**
 * A/B test analysis
 */
export interface ABTestAnalysis {
  control: {
    impressions: number;
    success_rate: number;
    avg_accuracy: number | null;
  };
  variant: {
    impressions: number;
    success_rate: number;
    avg_accuracy: number | null;
  };
  success_rate_diff: number;
  accuracy_diff: number;
  z_score: number;
  significant: boolean;
  confidence_level: number;
  variant_better: boolean;
}

/**
 * Template review
 */
export interface TemplateReview {
  id: string;
  user_id: string;
  template_id: string;
  rating: number;
  comment: string;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Rollout configuration
 */
export interface RolloutConfig {
  id: string;
  test_id: string;
  template_id: string;
  store_id: string;
  target_percentage: number;
  current_percentage: number;
  step_size: number;
  status: 'pending' | 'in_progress' | 'completed';
  steps: RolloutStep[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Rollout step
 */
export interface RolloutStep {
  percentage: number;
  status: 'pending' | 'completed';
  scheduled_at: string | null;
  executed_at: string | null;
}

/**
 * Create a bounding box
 */
export function createBoundingBox(x: number, y: number, width: number, height: number): BoundingBox {
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    width: Math.max(0, Math.min(1 - x, width)),
    height: Math.max(0, Math.min(1 - y, height))
  };
}

/**
 * Page structure creation options
 */
export interface PageStructureOptions {
  columns?: number;
  deal_regions?: BoundingBox[];
  header_region?: BoundingBox;
  footer_region?: BoundingBox;
  sidebar_regions?: BoundingBox[];
}

/**
 * Create page structure
 */
export function createPageStructure(data: PageStructureOptions = {}): PageStructure {
  return {
    columns: data.columns || 3,
    deal_regions: data.deal_regions || [],
    header_region: data.header_region || createBoundingBox(0, 0, 1, 0.1),
    footer_region: data.footer_region || createBoundingBox(0, 0.9, 1, 0.1),
    sidebar_regions: data.sidebar_regions || []
  };
}

/**
 * Extraction rules creation options
 */
export interface ExtractionRulesOptions {
  price_patterns?: (RegExp | string)[];
  product_name_regions?: (BoundingBox & { confidence: number })[];
  unit_patterns?: (RegExp | string)[];
  savings_indicators?: string[];
  date_patterns?: (RegExp | string)[];
}

/**
 * Create extraction rules
 */
export function createExtractionRules(data: ExtractionRulesOptions = {}): ExtractionRules {
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
 * Template creation options
 */
export interface TemplateCreationOptions {
  name?: string;
  description?: string;
  layout_type?: LayoutType;
  page_structure?: PageStructure;
  extraction_rules?: ExtractionRules;
  confidence_thresholds?: typeof DEFAULT_CONFIDENCE_THRESHOLDS;
  tags?: string[];
}

/**
 * Create a new template
 */
export function createTemplate(
  userId: string,
  storeId: string,
  annotations: TemplateCreationOptions = {}
): Template {
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
      change_type: VersionChangeType.MAJOR,
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
 * Corrections data
 */
export interface CorrectionsData {
  notes?: string;
  user_id?: string;
  count?: number;
}

/**
 * Create a template version from corrections
 */
export function createTemplateVersion(
  template: Template,
  corrections: CorrectionsData,
  changeType: VersionChangeType = VersionChangeType.MINOR
): Template {
  const now = new Date().toISOString();
  const [major, minor, patch] = template.version.split('.').map(Number);

  let newVersion: string;
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
 * A/B test configuration options
 */
export interface ABTestConfig {
  name?: string;
  traffic_split?: number;
  min_sample_size?: number;
  confidence_level?: number;
  user_id?: string;
  notes?: string;
}

/**
 * Create A/B test configuration
 */
export function createABTest(
  originalTemplateId: string,
  variantTemplateId: string,
  config: ABTestConfig = {}
): ABTest {
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    name: config.name || `AB Test ${now.split('T')[0]}`,

    // Templates
    control_template_id: originalTemplateId,
    variant_template_id: variantTemplateId,

    // Split configuration
    traffic_split: config.traffic_split || 0.5,

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
    status: 'pending',
    winner: null,

    // Timestamps
    created_at: now,
    started_at: null,
    completed_at: null,

    // Metadata
    created_by: config.user_id || '',
    notes: config.notes || ''
  };
}

/**
 * Create template rating/review
 */
export function createTemplateReview(
  userId: string,
  templateId: string,
  rating: number,
  comment: string = ''
): TemplateReview {
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
 * Parsed version components
 */
export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parse semantic version string
 */
export function parseVersion(version: string): ParsedVersion {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major: major || 0, minor: minor || 0, patch: patch || 0 };
}

/**
 * Compare two versions
 */
export function compareVersions(v1: string, v2: string): number {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;
  return 0;
}
