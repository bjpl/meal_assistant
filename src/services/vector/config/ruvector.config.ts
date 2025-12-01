/**
 * RuVector Configuration
 * Central configuration for vector database
 */

import { DistanceMetric, VectorIndexConfig } from '../types';

/**
 * RuVector connection configuration
 */
export interface RuVectorConfig {
  /** API endpoint URL */
  apiUrl: string;

  /** API key for authentication */
  apiKey: string;

  /** Timeout for API requests (ms) */
  timeout: number;

  /** Default embedding model */
  defaultEmbeddingModel: string;

  /** Default embedding dimensions */
  defaultDimensions: number;

  /** Retry configuration */
  retry: {
    maxAttempts: number;
    backoffMs: number;
  };

  /** Cache configuration */
  cache: {
    enabled: boolean;
    ttlSeconds: number;
    maxSize: number;
  };
}

/**
 * Collection configurations
 */
export interface CollectionConfigs {
  mealPatterns: VectorIndexConfig;
  ingredients: VectorIndexConfig;
  recipeSteps: VectorIndexConfig;
  mealLogs: VectorIndexConfig;
  cookingTechniques: VectorIndexConfig;
}

/**
 * Default RuVector configuration
 */
export const DEFAULT_RUVECTOR_CONFIG: RuVectorConfig = {
  apiUrl: process.env.RUVECTOR_API_URL || 'http://localhost:8000',
  apiKey: process.env.RUVECTOR_API_KEY || '',
  timeout: 30000, // 30 seconds
  defaultEmbeddingModel: 'all-MiniLM-L6-v2',
  defaultDimensions: 384,
  retry: {
    maxAttempts: 3,
    backoffMs: 1000
  },
  cache: {
    enabled: true,
    ttlSeconds: 3600, // 1 hour
    maxSize: 1000
  }
};

/**
 * Default collection configurations
 */
export const DEFAULT_COLLECTION_CONFIGS: CollectionConfigs = {
  mealPatterns: {
    name: 'meal_patterns',
    metric: 'cosine' as DistanceMetric,
    dimensions: 384,
    indexType: 'hnsw',
    hnswConfig: {
      m: 16,
      efConstruction: 200,
      efSearch: 100
    }
  },
  ingredients: {
    name: 'ingredients',
    metric: 'cosine' as DistanceMetric,
    dimensions: 384,
    indexType: 'hnsw',
    hnswConfig: {
      m: 16,
      efConstruction: 200,
      efSearch: 100
    }
  },
  recipeSteps: {
    name: 'recipe_steps',
    metric: 'cosine' as DistanceMetric,
    dimensions: 384,
    indexType: 'hnsw',
    hnswConfig: {
      m: 16,
      efConstruction: 200,
      efSearch: 100
    }
  },
  mealLogs: {
    name: 'meal_logs',
    metric: 'cosine' as DistanceMetric,
    dimensions: 384,
    indexType: 'hnsw',
    hnswConfig: {
      m: 16,
      efConstruction: 200,
      efSearch: 100
    }
  },
  cookingTechniques: {
    name: 'cooking_techniques',
    metric: 'cosine' as DistanceMetric,
    dimensions: 384,
    indexType: 'hnsw',
    hnswConfig: {
      m: 16,
      efConstruction: 200,
      efSearch: 100
    }
  }
};

/**
 * Search configuration presets
 */
export const SEARCH_PRESETS = {
  /** High precision, fewer results */
  PRECISE: {
    topK: 5,
    threshold: 0.85
  },

  /** Balanced precision and recall */
  BALANCED: {
    topK: 10,
    threshold: 0.70
  },

  /** High recall, more results */
  BROAD: {
    topK: 20,
    threshold: 0.50
  },

  /** Exploratory search */
  EXPLORATORY: {
    topK: 30,
    threshold: 0.30
  }
} as const;

/**
 * RAG configuration
 */
export interface RAGConfig {
  /** Max context length (characters) */
  maxContextLength: number;

  /** Context window overlap */
  contextOverlap: number;

  /** Re-ranking enabled */
  reRankEnabled: boolean;

  /** Query expansion enabled */
  queryExpansionEnabled: boolean;

  /** Default generation model */
  generationModel: string;

  /** Max tokens for generation */
  maxTokens: number;

  /** Temperature for generation */
  temperature: number;
}

/**
 * Default RAG configuration
 */
export const DEFAULT_RAG_CONFIG: RAGConfig = {
  maxContextLength: 4000,
  contextOverlap: 200,
  reRankEnabled: true,
  queryExpansionEnabled: true,
  generationModel: 'claude-3-5-sonnet-20241022',
  maxTokens: 2000,
  temperature: 0.7
};

/**
 * Learning configuration
 */
export interface LearningConfig {
  /** Feedback collection enabled */
  feedbackEnabled: boolean;

  /** Batch size for training */
  batchSize: number;

  /** Learning rate */
  learningRate: number;

  /** Model update frequency (minutes) */
  updateFrequency: number;

  /** Minimum feedback events before update */
  minFeedbackCount: number;
}

/**
 * Default learning configuration
 */
export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  feedbackEnabled: true,
  batchSize: 32,
  learningRate: 0.001,
  updateFrequency: 60, // 1 hour
  minFeedbackCount: 50
};
