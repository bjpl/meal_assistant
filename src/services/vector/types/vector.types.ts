/**
 * Core Vector Types
 * Base type definitions for RuVector integration
 */

/**
 * Vector document with embedding and metadata
 */
export interface VectorDocument<T = unknown> {
  id: string;
  embedding: number[];
  metadata: T;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Search query parameters
 */
export interface SearchQuery {
  /** Pre-computed embedding vector for semantic search */
  vector?: number[];

  /** Text to embed and search (alternative to vector) */
  text?: string;

  /** Filter criteria for metadata */
  filter?: VectorFilter;

  /** Number of results to return */
  topK?: number;

  /** Minimum similarity score threshold (0-1) */
  threshold?: number;

  /** Include embeddings in results */
  includeEmbeddings?: boolean;

  /** Include distances in results */
  includeDistances?: boolean;
}

/**
 * Filter for vector search
 */
export interface VectorFilter {
  /** Exact match filters */
  equals?: Record<string, unknown>;

  /** Partial text match filters */
  contains?: Record<string, string>;

  /** Numeric range filters */
  range?: Record<string, { min?: number; max?: number }>;

  /** Array inclusion filters */
  in?: Record<string, unknown[]>;

  /** Exclusion filters */
  notIn?: Record<string, unknown[]>;

  /** Date range filters */
  dateRange?: Record<string, { start?: Date; end?: Date }>;
}

/**
 * Search result with score and metadata
 */
export interface SearchResult<T = unknown> {
  id: string;
  score: number;
  document: T;
  distance: number;
  embedding?: number[];
}

/**
 * Batch search results
 */
export interface BatchSearchResult<T = unknown> {
  results: SearchResult<T>[];
  totalResults: number;
  processingTime: number;
}

/**
 * Embedding generation options
 */
export interface EmbeddingOptions {
  /** Model to use for embedding */
  model?: string;

  /** Dimensions of embedding (default: 1024) */
  dimensions?: number;

  /** Normalize embeddings to unit length */
  normalize?: boolean;

  /** Pooling strategy for text */
  pooling?: 'mean' | 'max' | 'cls';
}

/**
 * Vector distance metric
 */
export type DistanceMetric = 'cosine' | 'euclidean' | 'dot_product' | 'manhattan';

/**
 * Vector index configuration
 */
export interface VectorIndexConfig {
  /** Index name */
  name: string;

  /** Distance metric to use */
  metric: DistanceMetric;

  /** Dimensions of vectors */
  dimensions: number;

  /** Index type (HNSW, IVF, etc.) */
  indexType?: 'hnsw' | 'ivf_flat' | 'flat';

  /** HNSW parameters */
  hnswConfig?: {
    m?: number;
    efConstruction?: number;
    efSearch?: number;
  };

  /** IVF parameters */
  ivfConfig?: {
    nlist?: number;
    nprobe?: number;
  };
}

/**
 * Vector operation result
 */
export interface VectorOperationResult {
  success: boolean;
  message?: string;
  documentId?: string;
  error?: Error;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  successful: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
  processingTime: number;
}

/**
 * Vector statistics
 */
export interface VectorStats {
  collectionName: string;
  totalDocuments: number;
  dimensions: number;
  indexSize: number; // bytes
  avgEmbeddingTime: number; // milliseconds
  lastUpdated: Date;
}

/**
 * Similarity threshold presets
 */
export const SIMILARITY_THRESHOLDS = {
  /** Very high confidence match */
  EXACT: 0.95,

  /** High confidence match */
  HIGH: 0.85,

  /** Medium confidence match */
  MEDIUM: 0.70,

  /** Low confidence match */
  LOW: 0.50,

  /** Minimum viable match */
  MINIMAL: 0.30
} as const;

/**
 * Vector error types
 */
export enum VectorErrorType {
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  EMBEDDING_FAILED = 'EMBEDDING_FAILED',
  SEARCH_FAILED = 'SEARCH_FAILED',
  UPSERT_FAILED = 'UPSERT_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  COLLECTION_NOT_FOUND = 'COLLECTION_NOT_FOUND',
  INVALID_DIMENSIONS = 'INVALID_DIMENSIONS',
  INVALID_QUERY = 'INVALID_QUERY'
}

/**
 * Vector error
 */
export class VectorError extends Error {
  constructor(
    public type: VectorErrorType,
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'VectorError';
  }
}
