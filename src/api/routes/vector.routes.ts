/**
 * Vector API Routes
 * REST endpoints for RuVector services
 */

import { Router, Request, Response } from 'express';
import {
  ruVectorService,
  semanticSearchService,
  ragService,
  graphService,
  embeddingService
} from '../../services/vector';

const router = Router();

/**
 * POST /api/vector/search
 * Generic vector search across collections
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { collection, query, options } = req.body;

    if (!collection || !query) {
      res.status(400).json({
        error: 'Missing required fields: collection and query'
      });
      return;
    }

    const results = await ruVectorService.search(collection, {
      text: query.text,
      vector: query.vector,
      topK: options?.topK,
      threshold: options?.threshold,
      filter: options?.filter
    });

    return res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('[Vector API] Search error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Search failed'
    });
  }
});

/**
 * POST /api/vector/meals/search
 * Semantic search for meals
 */
router.post('/meals/search', async (req: Request, res: Response) => {
  try {
    const { query, options } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Missing required field: query'
      });
    }

    const results = await semanticSearchService.searchMeals(query, options);

    return res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('[Vector API] Meal search error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Meal search failed'
    });
  }
});

/**
 * POST /api/vector/ingredients/search
 * Search for ingredients
 */
router.post('/ingredients/search', async (req: Request, res: Response) => {
  try {
    const { query, options } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Missing required field: query'
      });
    }

    const results = await semanticSearchService.searchIngredients(query, options);

    return res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('[Vector API] Ingredient search error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Ingredient search failed'
    });
  }
});

/**
 * GET /api/vector/meals/:id/similar
 * Find similar meals
 */
router.get('/meals/:id/similar', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const topK = parseInt(req.query.topK as string) || 5;

    const results = await semanticSearchService.findSimilar(id, topK);

    return res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('[Vector API] Similar meals error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Similar search failed'
    });
  }
});

/**
 * POST /api/vector/meals/search-by-ingredients
 * Search meals by available ingredients
 */
router.post('/meals/search-by-ingredients', async (req: Request, res: Response) => {
  try {
    const { ingredients, options } = req.body;

    if (!ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({
        error: 'Missing or invalid field: ingredients (must be array)'
      });
    }

    const results = await semanticSearchService.searchByIngredients(
      ingredients,
      options
    );

    return res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('[Vector API] Ingredient-based search error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Search failed'
    });
  }
});

/**
 * POST /api/vector/rag/query
 * RAG-based question answering
 */
router.post('/rag/query', async (req: Request, res: Response) => {
  try {
    const { question, context } = req.body;

    if (!question) {
      return res.status(400).json({
        error: 'Missing required field: question'
      });
    }

    const response = await ragService.query(question, context);

    return res.json({
      success: true,
      ...response
    });
  } catch (error) {
    console.error('[Vector API] RAG query error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'RAG query failed'
    });
  }
});

/**
 * POST /api/vector/recommendations/meals
 * Get meal recommendations
 */
router.post('/recommendations/meals', async (req: Request, res: Response) => {
  try {
    const request = req.body;

    if (!request.context) {
      return res.status(400).json({
        error: 'Missing required field: context'
      });
    }

    const recommendations = await ragService.recommendMeals(request);

    return res.json({
      success: true,
      recommendations,
      count: recommendations.length
    });
  } catch (error) {
    console.error('[Vector API] Meal recommendation error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Recommendation failed'
    });
  }
});

/**
 * POST /api/vector/recommendations/ingredients
 * Get ingredient recommendations
 */
router.post('/recommendations/ingredients', async (req: Request, res: Response) => {
  try {
    const request = req.body;

    if (!request.context) {
      return res.status(400).json({
        error: 'Missing required field: context'
      });
    }

    const recommendations = await ragService.recommendIngredients(request);

    return res.json({
      success: true,
      recommendations,
      count: recommendations.length
    });
  } catch (error) {
    console.error('[Vector API] Ingredient recommendation error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Recommendation failed'
    });
  }
});

/**
 * POST /api/vector/graph/query
 * Execute graph query
 */
router.post('/graph/query', async (req: Request, res: Response) => {
  try {
    const { cypher, params } = req.body;

    if (!cypher) {
      return res.status(400).json({
        error: 'Missing required field: cypher'
      });
    }

    const result = await graphService.executeQuery(cypher, params);

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Vector API] Graph query error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Graph query failed'
    });
  }
});

/**
 * GET /api/vector/graph/substitutions/:ingredientId
 * Get ingredient substitutions
 */
router.get('/graph/substitutions/:ingredientId', async (req: Request, res: Response) => {
  try {
    const { ingredientId } = req.params;
    const topK = parseInt(req.query.topK as string) || 5;

    const substitutions = await graphService.getSubstitutions(ingredientId, topK);

    return res.json({
      success: true,
      substitutions,
      count: substitutions.length
    });
  } catch (error) {
    console.error('[Vector API] Substitution query error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Substitution query failed'
    });
  }
});

/**
 * GET /api/vector/graph/pairings/:ingredientId
 * Get flavor pairings
 */
router.get('/graph/pairings/:ingredientId', async (req: Request, res: Response) => {
  try {
    const { ingredientId } = req.params;
    const topK = parseInt(req.query.topK as string) || 10;

    const pairings = await graphService.getFlavorPairings(ingredientId, topK);

    return res.json({
      success: true,
      pairings,
      count: pairings.length
    });
  } catch (error) {
    console.error('[Vector API] Pairing query error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Pairing query failed'
    });
  }
});

/**
 * GET /api/vector/graph/subgraph/:nodeId
 * Get subgraph around a node
 */
router.get('/graph/subgraph/:nodeId', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    const depth = parseInt(req.query.depth as string) || 2;

    const subgraph = await graphService.getSubgraph(nodeId, depth);

    return res.json({
      success: true,
      ...subgraph
    });
  } catch (error) {
    console.error('[Vector API] Subgraph query error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Subgraph query failed'
    });
  }
});

/**
 * POST /api/vector/embed
 * Generate embeddings for text
 */
router.post('/embed', async (req: Request, res: Response) => {
  try {
    const { text, texts, options } = req.body;

    let embeddings: number[] | number[][];

    if (texts && Array.isArray(texts)) {
      embeddings = await embeddingService.embedBatch(texts, options);
    } else if (text) {
      embeddings = await embeddingService.embed(text, options);
    } else {
      return res.status(400).json({
        error: 'Missing required field: text or texts'
      });
    }

    return res.json({
      success: true,
      embeddings,
      dimensions: embeddingService.getDimensions(),
      model: embeddingService.getModel()
    });
  } catch (error) {
    console.error('[Vector API] Embedding error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Embedding generation failed'
    });
  }
});

/**
 * GET /api/vector/health
 * Health check endpoint
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const status = await ruVectorService.healthCheck();
    const stats = await graphService.getStats();

    return res.json({
      success: true,
      vector: status,
      graph: {
        nodes: stats.nodeCount,
        edges: stats.edgeCount
      },
      embedding: {
        model: embeddingService.getModel(),
        dimensions: embeddingService.getDimensions(),
        cacheSize: embeddingService.getCacheSize()
      }
    });
  } catch (error) {
    console.error('[Vector API] Health check error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
});

/**
 * GET /api/vector/collections
 * List all collections
 */
router.get('/collections', async (_req: Request, res: Response) => {
  try {
    const collections = await ruVectorService.listCollections();

    return res.json({
      success: true,
      collections,
      count: collections.length
    });
  } catch (error) {
    console.error('[Vector API] List collections error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list collections'
    });
  }
});

/**
 * GET /api/vector/collections/:name/stats
 * Get collection statistics
 */
router.get('/collections/:name/stats', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const stats = await ruVectorService.getStats(name);

    return res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[Vector API] Get stats error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get stats'
    });
  }
});

export default router;
