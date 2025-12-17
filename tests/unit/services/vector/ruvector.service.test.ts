/**
 * RuVector Service Unit Tests
 * Tests core vector database operations
 */

import { RuVectorService } from '../../../../src/services/vector/core/ruvector.service';
import { VectorDocument } from '../../../../src/services/vector/types';

describe('RuVectorService', () => {
  let service: RuVectorService;

  beforeAll(async () => {
    // Initialize with test configuration
    service = new RuVectorService({
      apiUrl: 'http://localhost:8000',
      apiKey: 'test-key'
    });

    await service.initialize();
    // Create the test collection
    await service.createCollection('meal_patterns', 384);
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
      expect(config.apiUrl).toBe('http://localhost:8000');
    });
  });

  describe('collection operations', () => {
    it('should create a collection', async () => {
      const result = await service.createCollection('test_collection', 384);
      expect(result.success).toBe(true);
    });

    it('should list collections', async () => {
      const collections = await service.listCollections();
      expect(collections).toContain('meal_patterns');
    });

    it('should handle creating existing collection', async () => {
      const result = await service.createCollection('meal_patterns', 384);
      expect(result.success).toBe(true);
      expect(result.message).toContain('already exists');
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

      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
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

    it('should perform vector search', async () => {
      const results = await service.search('meal_patterns', {
        vector: new Array(384).fill(0.5),
        topK: 5
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should filter search results by metadata', async () => {
      const results = await service.search('meal_patterns', {
        vector: new Array(384).fill(0.5),
        topK: 5,
        filter: {
          equals: { category: 'meal' }
        }
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.document.category).toBe('meal');
      });
    });

    it('should apply score threshold', async () => {
      const results = await service.search('meal_patterns', {
        vector: new Array(384).fill(0.5),
        topK: 10,
        threshold: 0.7
      });

      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should return results sorted by score', async () => {
      const results = await service.search('meal_patterns', {
        vector: new Array(384).fill(0.5),
        topK: 5
      });

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
  });

  describe('delete operations', () => {
    it('should delete a document', async () => {
      // First ensure the document exists
      const doc: VectorDocument = {
        id: 'delete-test-doc',
        embedding: new Array(384).fill(0.1),
        metadata: { name: 'Delete Test' },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await service.upsert('meal_patterns', doc);

      const result = await service.delete('meal_patterns', 'delete-test-doc');

      expect(result.success).toBe(true);

      // Verify deletion
      const document = await service.get('meal_patterns', 'delete-test-doc');
      expect(document).toBeNull();
    });

    it('should throw error for non-existent document deletion', async () => {
      await expect(
        service.delete('meal_patterns', 'definitely-not-exists')
      ).rejects.toThrow();
    });
  });

  describe('statistics', () => {
    it('should return collection statistics', async () => {
      const stats = await service.getStats('meal_patterns');

      expect(stats.totalDocuments).toBeGreaterThanOrEqual(0);
      expect(stats.dimensions).toBe(384);
      expect(stats.collectionName).toBe('meal_patterns');
    });

    it('should throw error for non-existent collection stats', async () => {
      await expect(
        service.getStats('non_existent_collection')
      ).rejects.toThrow();
    });
  });

  describe('clear operations', () => {
    it('should clear all documents from collection', async () => {
      // Create a separate collection for clear test
      await service.createCollection('clear_test', 384);

      // Add some documents
      await service.upsert('clear_test', {
        id: 'clear-1',
        embedding: new Array(384).fill(0.1),
        metadata: { name: 'Clear 1' },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Clear
      const result = await service.clear('clear_test');
      expect(result.success).toBe(true);

      // Verify
      const stats = await service.getStats('clear_test');
      expect(stats.totalDocuments).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid collection name', async () => {
      await expect(
        service.search('invalid_collection', {
          vector: new Array(384).fill(0.5),
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

    it('should handle search with missing query vector', async () => {
      await expect(
        service.search('meal_patterns', {
          topK: 5
        } as any)
      ).rejects.toThrow();
    });
  });

  describe('health check', () => {
    it('should return healthy status when initialized', async () => {
      const health = await service.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it('should return unhealthy when not initialized', async () => {
      const tempService = new RuVectorService({
        apiUrl: 'http://localhost:8000',
        apiKey: 'test-key'
      });

      const health = await tempService.healthCheck();
      expect(health.healthy).toBe(false);
    });
  });

  describe('cleanup and resource management', () => {
    it('should close connections properly', async () => {
      const tempService = new RuVectorService({
        apiUrl: 'http://localhost:8000',
        apiKey: 'test-key'
      });

      await tempService.initialize();
      expect(tempService.isInitialized()).toBe(true);

      await tempService.close();
      expect(tempService.isInitialized()).toBe(false);
    });

    it('should prevent operations after closing', async () => {
      const tempService = new RuVectorService({
        apiUrl: 'http://localhost:8000',
        apiKey: 'test-key'
      });

      await tempService.initialize();
      await tempService.createCollection('temp_collection', 384);
      await tempService.close();

      await expect(
        tempService.search('temp_collection', {
          vector: new Array(384).fill(0.5),
          topK: 5
        })
      ).rejects.toThrow();
    });
  });
});
