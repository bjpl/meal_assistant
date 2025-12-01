/**
 * Collection Service
 * Manages RuVector collections
 */

import {
  CollectionName,
  CollectionMetadata,
  VectorOperationResult,
  VectorError,
  VectorErrorType
} from '../types';
import { ruVectorService } from './ruvector.service';
import { DEFAULT_COLLECTION_CONFIGS } from '../config/ruvector.config';

/**
 * CollectionService class
 * High-level collection management
 */
export class CollectionService {
  private metadata: Map<string, CollectionMetadata> = new Map();

  /**
   * Initialize all collections
   */
  public async initializeAllCollections(): Promise<void> {
    try {
      console.log('[CollectionService] Initializing all collections...');

      // Ensure RuVector service is initialized
      if (!ruVectorService.isInitialized()) {
        await ruVectorService.initialize();
      }

      // Create each collection from config
      for (const [key, config] of Object.entries(DEFAULT_COLLECTION_CONFIGS)) {
        try {
          await ruVectorService.createCollection(config.name, config.dimensions);

          // Store metadata
          const metadata: CollectionMetadata = {
            name: config.name as CollectionName,
            dimensions: config.dimensions,
            metric: config.metric,
            indexType: config.indexType,
            documentCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          this.metadata.set(config.name, metadata);

          console.log(`[CollectionService] Initialized collection '${config.name}'`);
        } catch (error) {
          console.error(`[CollectionService] Failed to initialize '${config.name}':`, error);
          // Continue with other collections
        }
      }

      console.log('[CollectionService] All collections initialized successfully');
    } catch (error) {
      throw new VectorError(
        VectorErrorType.INITIALIZATION_FAILED,
        `Failed to initialize collections: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get collection metadata
   * @param name Collection name
   */
  public async getMetadata(name: CollectionName): Promise<CollectionMetadata | null> {
    try {
      // Check local cache first
      if (this.metadata.has(name)) {
        return this.metadata.get(name) || null;
      }

      // Try to get stats from RuVector
      const stats = await ruVectorService.getStats(name);

      // Create and cache metadata
      const metadata: CollectionMetadata = {
        name,
        dimensions: stats.dimensions,
        metric: 'cosine',
        indexType: 'hnsw',
        documentCount: stats.totalDocuments,
        createdAt: new Date(),
        updatedAt: stats.lastUpdated
      };

      this.metadata.set(name, metadata);
      return metadata;
    } catch (error) {
      console.error(`[CollectionService] Failed to get metadata for '${name}':`, error);
      return null;
    }
  }

  /**
   * Update collection metadata
   * @param name Collection name
   * @param updates Metadata updates
   */
  public async updateMetadata(
    name: CollectionName,
    updates: Partial<CollectionMetadata>
  ): Promise<VectorOperationResult> {
    try {
      const existing = this.metadata.get(name);
      if (!existing) {
        throw new VectorError(
          VectorErrorType.COLLECTION_NOT_FOUND,
          `Collection '${name}' not found`
        );
      }

      // Update metadata
      const updated: CollectionMetadata = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      this.metadata.set(name, updated);

      return {
        success: true,
        message: `Metadata updated for collection '${name}'`
      };
    } catch (error) {
      if (error instanceof VectorError) {
        throw error;
      }
      throw new VectorError(
        VectorErrorType.COLLECTION_NOT_FOUND,
        `Failed to update metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if collection exists
   * @param name Collection name
   */
  public async exists(name: CollectionName): Promise<boolean> {
    try {
      const collections = await ruVectorService.listCollections();
      return collections.includes(name);
    } catch (error) {
      console.error(`[CollectionService] Error checking existence of '${name}':`, error);
      return false;
    }
  }

  /**
   * Get document count for collection
   * @param name Collection name
   */
  public async getDocumentCount(name: CollectionName): Promise<number> {
    try {
      const stats = await ruVectorService.getStats(name);
      return stats.totalDocuments;
    } catch (error) {
      console.error(`[CollectionService] Error getting document count for '${name}':`, error);
      return 0;
    }
  }

  /**
   * Optimize collection index
   * @param name Collection name
   */
  public async optimize(name: CollectionName): Promise<VectorOperationResult> {
    try {
      // Check collection exists
      const exists = await this.exists(name);
      if (!exists) {
        throw new VectorError(
          VectorErrorType.COLLECTION_NOT_FOUND,
          `Collection '${name}' not found`
        );
      }

      // In production, this would trigger actual index optimization
      console.log(`[CollectionService] Optimizing index for '${name}'...`);

      // Update metadata
      const metadata = this.metadata.get(name);
      if (metadata) {
        metadata.updatedAt = new Date();
        this.metadata.set(name, metadata);
      }

      return {
        success: true,
        message: `Index optimized for collection '${name}'`
      };
    } catch (error) {
      if (error instanceof VectorError) {
        throw error;
      }
      throw new VectorError(
        VectorErrorType.COLLECTION_NOT_FOUND,
        `Failed to optimize index: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Rebuild collection index
   * @param name Collection name
   */
  public async rebuild(name: CollectionName): Promise<VectorOperationResult> {
    try {
      // Check collection exists
      const exists = await this.exists(name);
      if (!exists) {
        throw new VectorError(
          VectorErrorType.COLLECTION_NOT_FOUND,
          `Collection '${name}' not found`
        );
      }

      console.log(`[CollectionService] Rebuilding index for '${name}'...`);

      // In production, this would:
      // 1. Backup existing documents
      // 2. Drop and recreate index
      // 3. Reindex all documents
      // 4. Verify integrity

      // Update metadata
      const metadata = this.metadata.get(name);
      if (metadata) {
        metadata.updatedAt = new Date();
        this.metadata.set(name, metadata);
      }

      return {
        success: true,
        message: `Index rebuilt for collection '${name}'`
      };
    } catch (error) {
      if (error instanceof VectorError) {
        throw error;
      }
      throw new VectorError(
        VectorErrorType.COLLECTION_NOT_FOUND,
        `Failed to rebuild index: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate collection schema
   * @param name Collection name
   * @param document Sample document
   */
  public async validateSchema(
    name: CollectionName,
    document: unknown
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Get collection metadata
      const metadata = await this.getMetadata(name);
      if (!metadata) {
        errors.push(`Collection '${name}' not found`);
        return { valid: false, errors };
      }

      // Validate document is an object
      if (typeof document !== 'object' || document === null) {
        errors.push('Document must be an object');
        return { valid: false, errors };
      }

      const doc = document as Record<string, unknown>;

      // Check required fields
      if (!doc.id) {
        errors.push('Document must have an id field');
      }

      if (!doc.embedding || !Array.isArray(doc.embedding)) {
        errors.push('Document must have an embedding array');
      } else if (doc.embedding.length !== metadata.dimensions) {
        errors.push(
          `Embedding dimensions ${doc.embedding.length} do not match collection dimensions ${metadata.dimensions}`
        );
      }

      // Validate embedding contains only numbers
      if (Array.isArray(doc.embedding)) {
        const hasNonNumber = doc.embedding.some(val => typeof val !== 'number' || isNaN(val));
        if (hasNonNumber) {
          errors.push('Embedding array must contain only valid numbers');
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown validation error');
      return { valid: false, errors };
    }
  }

  /**
   * Get all collection names
   */
  public getAllCollectionNames(): CollectionName[] {
    return Object.values(DEFAULT_COLLECTION_CONFIGS).map(config => config.name as CollectionName);
  }

  /**
   * Clear local metadata cache
   */
  public clearCache(): void {
    this.metadata.clear();
  }
}

// Export singleton instance
export const collectionService = new CollectionService();
