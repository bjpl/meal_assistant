// Ad Upload and Annotation Types - Week 3-4 Mobile UI

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface AdDeal {
  id: string;
  productName: string;
  price: number;
  originalPrice?: number;
  unit?: string;
  quantity?: number;
  savingsClaim?: string;
  confidence: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  imageSnippetUri?: string;
  boundingBox?: BoundingBox;
  matchedShoppingListItemId?: string;
  matchedShoppingListItemName?: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'edited';
  corrections?: DealCorrection;
}

export interface DealCorrection {
  productName?: string;
  price?: number;
  unit?: string;
  quantity?: number;
  correctedAt: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber?: number;
}

export interface WeeklyAd {
  id: string;
  storeId: string;
  storeName: string;
  adPeriodStart: string;
  adPeriodEnd: string;
  uploadedAt: string;
  processedAt?: string;
  status: 'uploading' | 'processing' | 'ready' | 'reviewed' | 'error';
  fileType: 'pdf' | 'image';
  fileUri: string;
  thumbnailUri?: string;
  pages: number;
  deals: AdDeal[];
  templateId?: string;
  processingProgress?: ProcessingProgress;
  error?: string;
}

export interface ProcessingProgress {
  step: ProcessingStep;
  stepNumber: number;
  totalSteps: number;
  message: string;
  estimatedTimeRemaining?: number; // seconds
}

export type ProcessingStep =
  | 'uploading'
  | 'detecting_store'
  | 'extracting_text'
  | 'finding_deals'
  | 'matching_to_list'
  | 'complete';

export interface AdTemplate {
  id: string;
  name: string;
  storeId: string;
  storeName: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isPublic: boolean;
  version: number;
  versionHistory: TemplateVersion[];
  annotations: TemplateAnnotation[];
  accuracy: number;
  usageCount: number;
  successfulExtractions: number;
  ratings: TemplateRating[];
  averageRating: number;
  tags: string[];
}

export interface TemplateVersion {
  version: number;
  createdAt: string;
  annotations: TemplateAnnotation[];
  accuracy: number;
}

export interface TemplateAnnotation {
  id: string;
  type: 'page' | 'block' | 'component';
  label: AnnotationLabel;
  boundingBox: BoundingBox;
  pageNumber: number;
  parentId?: string; // For hierarchical nesting
}

export type AnnotationLabel =
  | 'deal_section'
  | 'individual_deal'
  | 'product_name'
  | 'price'
  | 'unit'
  | 'savings'
  | 'brand'
  | 'category';

export interface TemplateRating {
  userId: string;
  rating: number; // 1-5
  review?: string;
  createdAt: string;
}

export interface AccuracyPoint {
  date: string;
  accuracy: number;
  dealsProcessed: number;
}

export interface AccuracyStats {
  overall: number;
  byStore: { [storeId: string]: number };
  progression: AccuracyPoint[];
  totalDealsProcessed: number;
  totalCorrections: number;
}

export interface DealReviewSession {
  adId: string;
  deals: AdDeal[];
  currentIndex: number;
  reviewedCount: number;
  confirmedCount: number;
  rejectedCount: number;
  editedCount: number;
  startedAt: string;
}

export interface AdsState {
  uploadedAds: WeeklyAd[];
  currentUpload: {
    progress: number;
    adId?: string;
    error?: string;
  } | null;
  currentReview: DealReviewSession | null;
  templates: AdTemplate[];
  publicTemplates: AdTemplate[];
  accuracyStats: AccuracyStats;
  recentDeals: AdDeal[];
  loading: boolean;
  error: string | null;
}

// API Request/Response types
export interface UploadAdRequest {
  file: {
    uri: string;
    type: string;
    name: string;
  };
  storeId: string;
  adPeriodStart: string;
  adPeriodEnd: string;
}

export interface ProcessAdResponse {
  adId: string;
  deals: AdDeal[];
  templateUsed?: string;
  processingTimeMs: number;
}

export interface CreateTemplateRequest {
  name: string;
  storeId: string;
  annotations: TemplateAnnotation[];
  isPublic: boolean;
}

export interface TestTemplateResponse {
  beforeAccuracy: number;
  afterAccuracy: number;
  dealsFound: AdDeal[];
  improvementPercent: number;
}
