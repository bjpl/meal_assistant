/**
 * RuVector Service
 * Main client for RuVector vector database
 */

import {
  VectorDocument,
  SearchQuery,
  SearchResult,
  VectorOperationResult,
  BatchOperationResult,
  VectorStats,
  VectorError,
  VectorErrorType,
  VectorFilter
} from '../types';
import { RuVectorConfig, DEFAULT_RUVECTOR_CONFIG } from '../config/ruvector.config';

/**
 * RuVectorService class
 * Core service for vector database operations
 */
export class RuVectorService {
  private config: RuVectorConfig;
  private initialized: boolean = false;
  private collections: Map<string, unknown> = new Map();

  constructor(config?: Partial<RuVectorConfig>) {
    this.config = { ...DEFAULT_RUVECTOR_CONFIG, ...config };
  }

  /**
   * Initialize RuVector connection
   * Sets up collections and verifies connectivity
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // In production, this would initialize actual RuVector client
      // For now, we set up in-memory structures
      console.log(`[RuVector] Initializing with config:`, {
        apiUrl: this.config.apiUrl,
        dimensions: this.config.defaultDimensions,
        model: this.config.defaultEmbeddingModel
      });

      // Verify configuration
      if (!this.config.apiKey && this.config.apiUrl !== 'http://localhost:8000') {
        throw new Error('API key required for non-localhost connections');
      }

      // Initialize collections map
      this.collections = new Map();

      // Set initialized flag
      this.initialized = true;

      console.log('[RuVector] Successfully initialized');
    } catch (error) {
      throw new VectorError(
        VectorErrorType.INITIALIZATION_FAILED,
        `Failed to initialize RuVector: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Create a new collection
   * @param name Collection name
   * @param dimensions Vector dimensions
   */
  public async createCollection(
    name: string,
    dimensions: number
  ): Promise<VectorOperationResult> {
    this.ensureInitialized();

    try {
      // Validate collection name
      if (!name || name.trim().length === 0) {
        throw new Error('Collection name cannot be empty');
      }

      if (this.collections.has(name)) {
        return {
          success: true,
          message: `Collection '${name}' already exists`
        };
      }

      // Create collection metadata
      const collection = {
        name,
        dimensions,
        documents: new Map<string, VectorDocument>(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.collections.set(name, collection);

      console.log(`[RuVector] Created collection '${name}' with ${dimensions} dimensions`);

      return {
        success: true,
        message: `Collection '${name}' created successfully`
      };
    } catch (error) {
      throw new VectorError(
        VectorErrorType.INITIALIZATION_FAILED,
        `Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete a collection
   * @param name Collection name
   */
  public async deleteCollection(name: string): Promise<VectorOperationResult> {
    this.ensureInitialized();

    try {
      if (!this.collections.has(name)) {
        throw new VectorError(
          VectorErrorType.COLLECTION_NOT_FOUND,
          `Collection '${name}' not found`
        );
      }

      this.collections.delete(name);

      console.log(`[RuVector] Deleted collection '${name}'`);

      return {
        success: true,
        message: `Collection '${name}' deleted successfully`
      };
    } catch (error) {
      if (error instanceof VectorError) {
        throw error;
      }
      throw new VectorError(
        VectorErrorType.COLLECTION_NOT_FOUND,
        `Failed to delete collection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List all collections
   */
  public async listCollections(): Promise<string[]> {
    this.ensureInitialized();
    return Array.from(this.collections.keys());
  }

  /**
   * Upsert a document (insert or update)
   * @param collection Collection name
   * @param document Document to upsert
   */
  public async upsert<T = unknown>(
    collection: string,
    document: VectorDocument<T>
  ): Promise<VectorOperationResult> {
    this.ensureInitialized();

    try {
      const coll = this.collections.get(collection) as any;
      if (!coll) {
        throw new VectorError(
          VectorErrorType.COLLECTION_NOT_FOUND,
          `Collection '${collection}' not found`
        );
      }

      // Validate embedding dimensions
      if (document.embedding.length !== coll.dimensions) {
        throw new VectorError(
          VectorErrorType.INVALID_DIMENSIONS,
          `Expected ${coll.dimensions} dimensions, got ${document.embedding.length}`
        );
      }

      // Upsert document
      coll.documents.set(document.id, {
        ...document,
        updatedAt: new Date()
      });

      coll.updatedAt = new Date();

      return {
        success: true,
        documentId: document.id,
        message: 'Document upserted successfully'
      };
    } catch (error) {
      if (error instanceof VectorError) {
        throw error;
      }
      throw new VectorError(
        VectorErrorType.UPSERT_FAILED,
        `Failed to upsert document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Batch upsert multiple documents
   * @param collection Collection name
   * @param documents Documents to upsert
   */
  public async batchUpsert<T = unknown>(
    collection: string,
    documents: VectorDocument<T>[]
  ): Promise<BatchOperationResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    const errors: Array<{ id: string; error: string }> = [];
    let successful = 0;

    for (const doc of documents) {
      try {
        await this.upsert(collection, doc);
        successful++;
      } catch (error) {
        errors.push({
          id: doc.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      successful,
      failed: errors.length,
      errors,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Delete a document
   * @param collection Collection name
   * @param id Document ID
   */
  public async delete(
    collection: string,
    id: string
  ): Promise<VectorOperationResult> {
    this.ensureInitialized();

    try {
      const coll = this.collections.get(collection) as any;
      if (!coll) {
        throw new VectorError(
          VectorErrorType.COLLECTION_NOT_FOUND,
          `Collection '${collection}' not found`
        );
      }

      if (!coll.documents.has(id)) {
        throw new VectorError(
          VectorErrorType.DELETE_FAILED,
          `Document '${id}' not found in collection '${collection}'`
        );
      }

      coll.documents.delete(id);
      coll.updatedAt = new Date();

      return {
        success: true,
        documentId: id,
        message: 'Document deleted successfully'
      };
    } catch (error) {
      if (error instanceof VectorError) {
        throw error;
      }
      throw new VectorError(
        VectorErrorType.DELETE_FAILED,
        `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Search for similar documents
   * @param collection Collection name
   * @param query Search query
   */
  public async search<T = unknown>(
    collection: string,
    query: SearchQuery
  ): Promise<SearchResult<T>[]> {
    this.ensureInitialized();

    try {
      const coll = this.collections.get(collection) as any;
      if (!coll) {
        throw new VectorError(
          VectorErrorType.COLLECTION_NOT_FOUND,
          `Collection '${collection}' not found`
        );
      }

      // Validate query has either vector or text
      if (!query.vector && !query.text) {
        throw new VectorError(
          VectorErrorType.INVALID_QUERY,
          'Query must contain either vector or text'
        );
      }

      // Get query vector (provided or needs embedding)
      const queryVector = query.vector || [];
      if (!query.vector && query.text) {
        // In production, this would call embeddingService
        throw new VectorError(
          VectorErrorType.SEARCH_FAILED,
          'Text embedding not yet implemented - provide vector directly'
        );
      }

      // Calculate cosine similarity for all documents
      const results: SearchResult<T>[] = [];
      for (const [id, doc] of coll.documents.entries()) {
        // Apply filters if provided
        if (query.filter && !this.matchesFilter(doc.metadata, query.filter)) {
          continue;
        }

        // Calculate similarity
        const score = this.cosineSimilarity(queryVector, doc.embedding);
        const distance = 1 - score;

        // Apply threshold
        if (query.threshold && score < query.threshold) {
          continue;
        }

        results.push({
          id,
          score,
          distance,
          document: doc.metadata as T,
          embedding: query.includeEmbeddings ? doc.embedding : undefined
        });
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);

      // Apply topK limit
      const topK = query.topK || 10;
      return results.slice(0, topK);
    } catch (error) {
      if (error instanceof VectorError) {
        throw error;
      }
      throw new VectorError(
        VectorErrorType.SEARCH_FAILED,
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get document by ID
   * @param collection Collection name
   * @param id Document ID
   */
  public async get<T = unknown>(
    collection: string,
    id: string
  ): Promise<VectorDocument<T> | null> {
    this.ensureInitialized();

    const coll = this.collections.get(collection) as any;
    if (!coll) {
      return null;
    }

    return coll.documents.get(id) || null;
  }

  /**
   * Get collection statistics
   * @param collection Collection name
   */
  public async getStats(collection: string): Promise<VectorStats> {
    this.ensureInitialized();

    const coll = this.collections.get(collection) as any;
    if (!coll) {
      throw new VectorError(
        VectorErrorType.COLLECTION_NOT_FOUND,
        `Collection '${collection}' not found`
      );
    }

    return {
      collectionName: collection,
      totalDocuments: coll.documents.size,
      dimensions: coll.dimensions,
      indexSize: 0, // Would be calculated from actual storage
      avgEmbeddingTime: 0, // Would track actual timing
      lastUpdated: coll.updatedAt
    };
  }

  /**
   * Clear all documents from a collection
   * @param collection Collection name
   */
  public async clear(collection: string): Promise<VectorOperationResult> {
    this.ensureInitialized();

    const coll = this.collections.get(collection) as any;
    if (!coll) {
      throw new VectorError(
        VectorErrorType.COLLECTION_NOT_FOUND,
        `Collection '${collection}' not found`
      );
    }

    coll.documents.clear();
    coll.updatedAt = new Date();

    return {
      success: true,
      message: `Collection '${collection}' cleared successfully`
    };
  }

  /**
   * Close connection
   */
  public async close(): Promise<void> {
    // TODO: Implement connection closing
    // - Close API connections
    // - Clear caches
    // - Cleanup resources
    this.initialized = false;
  }

  /**
   * Ensure service is initialized
   * @private
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new VectorError(
        VectorErrorType.INITIALIZATION_FAILED,
        'RuVector service not initialized. Call initialize() first.'
      );
    }
  }

  /**
   * Get configuration
   */
  public getConfig(): RuVectorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param config Partial configuration update
   */
  public updateConfig(config: Partial<RuVectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      if (!this.initialized) {
        return { healthy: false, message: 'Service not initialized' };
      }

      const collections = await this.listCollections();
      return {
        healthy: true,
        message: `RuVector healthy - ${collections.length} collections`
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @private
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new VectorError(
        VectorErrorType.INVALID_DIMENSIONS,
        'Vectors must have same dimensions'
      );
    }

    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

    return mag1 > 0 && mag2 > 0 ? dotProduct / (mag1 * mag2) : 0;
  }

  /**
   * Check if document metadata matches filter criteria
   * @private
   */
  private matchesFilter(metadata: unknown, filter: VectorFilter): boolean {
    const meta = metadata as Record<string, unknown>;

    // Equals filter
    if (filter.equals) {
      for (const [key, value] of Object.entries(filter.equals)) {
        if (meta[key] !== value) return false;
      }
    }

    // Contains filter
    if (filter.contains) {
      for (const [key, value] of Object.entries(filter.contains)) {
        const metaValue = String(meta[key] || '').toLowerCase();
        if (!metaValue.includes(String(value).toLowerCase())) return false;
      }
    }

    // Range filter
    if (filter.range) {
      for (const [key, rangeValue] of Object.entries(filter.range)) {
        const val = Number(meta[key]);
        if (isNaN(val)) return false;
        const range = rangeValue as { min?: number; max?: number };
        if (range.min !== undefined && val < range.min) return false;
        if (range.max !== undefined && val > range.max) return false;
      }
    }

    // In filter
    if (filter.in) {
      for (const [key, valuesUnknown] of Object.entries(filter.in)) {
        const values = valuesUnknown as unknown[];
        if (!values.includes(meta[key])) return false;
      }
    }

    // NotIn filter
    if (filter.notIn) {
      for (const [key, valuesUnknown] of Object.entries(filter.notIn)) {
        const values = valuesUnknown as unknown[];
        if (values.includes(meta[key])) return false;
      }
    }

    // Date range filter
    if (filter.dateRange) {
      for (const [key, rangeValue] of Object.entries(filter.dateRange)) {
        const date = new Date(meta[key] as string | number | Date);
        if (isNaN(date.getTime())) return false;
        const range = rangeValue as { start?: Date; end?: Date };
        if (range.start && date < range.start) return false;
        if (range.end && date > range.end) return false;
      }
    }

    return true;
  }
}

// Export singleton instance
export const ruVectorService = new RuVectorService();
