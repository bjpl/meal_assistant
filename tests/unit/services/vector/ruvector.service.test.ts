/**
 * RuVector Service Unit Tests
 * Tests core vector database operations
 */

import { RuVectorService } from '../../../../src/services/vector/core/ruvector.service';
import { VectorDocument, SearchQuery } from '../../../../src/services/vector/types';

describe('RuVectorService', () => {
  let service: RuVectorService;

  beforeAll(async () => {
    // Initialize with test configuration
    service = new RuVectorService({
      dataPath: './test-data/ruvector',
      collections: {
        meal_patterns: {
          name: 'meal_patterns',
          dimension: 384,
          metric: 'cosine',
          indexType: 'hnsw'
        }
      },
      embeddingModel: 'all-MiniLM-L6-v2',
      defaultTopK: 10
    });

    await service.initialize();
  });

  afterAll(async () => {
    // Clean up test data
    await service.close();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(service.isInitialized()).toBe(true);
    });

    it('should have correct configuration', () => {
      const config = service.getConfig();
      expect(config.embeddingModel).toBe('all-MiniLM-L6-v2');
      expect(config.defaultTopK).toBe(10);
    });
  });

  describe('upsert operations', () => {
    it('should insert a new document', async () => {
      const document: VectorDocument = {
        id: 'test-doc-1',
        embedding: new Array(384).fill(0.1),
        metadata: {
          name: 'Test Document',
          category: 'test'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.upsert('meal_patterns', document);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should update an existing document', async () => {
      const document: VectorDocument = {
        id: 'test-doc-1',
        embedding: new Array(384).fill(0.2),
        metadata: {
          name: 'Test Document Updated',
          category: 'test'
        },
        createdAt: new Date(Date.now() - 10000),
        updatedAt: new Date()
      };

      const result = await service.upsert('meal_patterns', document);

      expect(result.success).toBe(true);

      // Verify update
      const retrieved = await service.get('meal_patterns', 'test-doc-1');
      expect(retrieved?.metadata.name).toBe('Test Document Updated');
    });

    it('should batch upsert multiple documents', async () => {
      const documents: VectorDocument[] = [
        {
          id: 'batch-1',
          embedding: new Array(384).fill(0.1),
          metadata: { name: 'Batch 1' },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'batch-2',
          embedding: new Array(384).fill(0.2),
          metadata: { name: 'Batch 2' },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'batch-3',
          embedding: new Array(384).fill(0.3),
          metadata: { name: 'Batch 3' },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const result = await service.batchUpsert('meal_patterns', documents);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
    });
  });

  describe('search operations', () => {
    beforeAll(async () => {
      // Seed test data
      const testDocs: VectorDocument[] = [
        {
          id: 'search-1',
          embedding: new Array(384).fill(0.5),
          metadata: {
            name: 'High Protein Breakfast',
            category: 'meal',
            protein: 40,
            tags: ['protein', 'breakfast']
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'search-2',
          embedding: new Array(384).fill(0.6),
          metadata: {
            name: 'Low Carb Lunch',
            category: 'meal',
            carbs: 20,
            tags: ['low-carb', 'lunch']
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'search-3',
          embedding: new Array(384).fill(0.7),
          metadata: {
            name: 'Balanced Dinner',
            category: 'meal',
            calories: 500,
            tags: ['balanced', 'dinner']
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      await service.batchUpsert('meal_patterns', testDocs);
    });

    it('should perform semantic search', async () => {
      const query: SearchQuery = {
        text: 'high protein breakfast',
        topK: 5
      };

      const results = await service.search('meal_patterns', query);

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should filter search results by metadata', async () => {
      const query: SearchQuery = {
        embedding: new Array(384).fill(0.5),
        topK: 5,
        filter: {
          category: { $eq: 'meal' }
        }
      };

      const results = await service.search('meal_patterns', query);

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.metadata.category).toBe('meal');
      });
    });

    it('should apply score threshold', async () => {
      const query: SearchQuery = {
        embedding: new Array(384).fill(0.5),
        topK: 10,
        minScore: 0.7
      };

      const results = await service.search('meal_patterns', query);

      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should return results sorted by score', async () => {
      const query: SearchQuery = {
        embedding: new Array(384).fill(0.5),
        topK: 5
      };

      const results = await service.search('meal_patterns', query);

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  describe('get operations', () => {
    it('should retrieve document by ID', async () => {
      const document = await service.get('meal_patterns', 'test-doc-1');

      expect(document).toBeDefined();
      expect(document?.id).toBe('test-doc-1');
      expect(document?.metadata.name).toBeDefined();
    });

    it('should return null for non-existent document', async () => {
      const document = await service.get('meal_patterns', 'non-existent');

      expect(document).toBeNull();
    });

    it('should retrieve multiple documents by IDs', async () => {
      const documents = await service.batchGet('meal_patterns', [
        'test-doc-1',
        'batch-1',
        'batch-2'
      ]);

      expect(documents.length).toBe(3);
      documents.forEach(doc => {
        expect(doc).toBeDefined();
        expect(doc.id).toBeDefined();
      });
    });
  });

  describe('delete operations', () => {
    it('should delete a document', async () => {
      const result = await service.delete('meal_patterns', 'batch-3');

      expect(result.success).toBe(true);

      // Verify deletion
      const document = await service.get('meal_patterns', 'batch-3');
      expect(document).toBeNull();
    });

    it('should batch delete multiple documents', async () => {
      const result = await service.batchDelete('meal_patterns', [
        'batch-1',
        'batch-2'
      ]);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(2);

      // Verify deletions
      const doc1 = await service.get('meal_patterns', 'batch-1');
      const doc2 = await service.get('meal_patterns', 'batch-2');
      expect(doc1).toBeNull();
      expect(doc2).toBeNull();
    });

    it('should handle deletion of non-existent document gracefully', async () => {
      const result = await service.delete('meal_patterns', 'non-existent');

      // Should not throw error
      expect(result).toBeDefined();
    });
  });

  describe('statistics and monitoring', () => {
    it('should return collection statistics', async () => {
      const stats = await service.getStats('meal_patterns');

      expect(stats.totalDocuments).toBeGreaterThanOrEqual(0);
      expect(stats.dimension).toBe(384);
      expect(stats.metric).toBeDefined();
    });

    it('should track operation metrics', () => {
      const metrics = service.getMetrics();

      expect(metrics.totalSearches).toBeGreaterThanOrEqual(0);
      expect(metrics.totalUpserts).toBeGreaterThanOrEqual(0);
      expect(metrics.totalDeletes).toBeGreaterThanOrEqual(0);
      expect(metrics.averageSearchLatency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid collection name', async () => {
      await expect(
        service.search('invalid_collection' as any, {
          text: 'test',
          topK: 5
        })
      ).rejects.toThrow();
    });

    it('should handle invalid embedding dimensions', async () => {
      const invalidDoc: VectorDocument = {
        id: 'invalid-dim',
        embedding: new Array(100).fill(0.1), // Wrong dimension
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(
        service.upsert('meal_patterns', invalidDoc)
      ).rejects.toThrow();
    });

    it('should handle search with missing query data', async () => {
      const invalidQuery: SearchQuery = {
        topK: 5
        // Missing both text and embedding
      } as any;

      await expect(
        service.search('meal_patterns', invalidQuery)
      ).rejects.toThrow();
    });
  });

  describe('cleanup and resource management', () => {
    it('should close connections properly', async () => {
      const tempService = new RuVectorService({
        dataPath: './test-data/temp',
        collections: {
          test_collection: {
            name: 'test_collection',
            dimension: 384,
            metric: 'cosine'
          }
        }
      });

      await tempService.initialize();
      expect(tempService.isInitialized()).toBe(true);

      await tempService.close();
      expect(tempService.isInitialized()).toBe(false);
    });

    it('should prevent operations after closing', async () => {
      const tempService = new RuVectorService({
        dataPath: './test-data/temp2',
        collections: {
          test_collection: {
            name: 'test_collection',
            dimension: 384,
            metric: 'cosine'
          }
        }
      });

      await tempService.initialize();
      await tempService.close();

      await expect(
        tempService.search('test_collection' as any, {
          text: 'test',
          topK: 5
        })
      ).rejects.toThrow();
    });
  });
});
