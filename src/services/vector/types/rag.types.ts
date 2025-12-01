/**
 * RAG (Retrieval-Augmented Generation) Types
 * Type definitions for RAG pipeline
 */

import { SearchResult } from './vector.types';

/**
 * RAG context for generation
 */
export interface RAGContext<T = unknown> {
  /** Retrieved documents */
  documents: SearchResult<T>[];

  /** Original query */
  query: string;

  /** Formatted context string for LLM */
  contextText: string;

  /** Metadata about retrieval */
  retrievalMetadata: {
    totalRetrieved: number;
    avgRelevance: number;
    retrievalTime: number;
  };
}

/**
 * RAG generation request
 */
export interface RAGRequest {
  /** User query */
  query: string;

  /** Collections to search */
  collections: string[];

  /** Number of documents to retrieve */
  topK?: number;

  /** Minimum relevance threshold */
  threshold?: number;

  /** Additional context to include */
  additionalContext?: string;

  /** Generation parameters */
  generationParams?: GenerationParams;
}

/**
 * Generation parameters for LLM
 */
export interface GenerationParams {
  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Temperature (0-1) */
  temperature?: number;

  /** Top-p sampling */
  topP?: number;

  /** Model to use */
  model?: string;

  /** System prompt */
  systemPrompt?: string;
}

/**
 * RAG response
 */
export interface RAGResponse {
  /** Generated answer */
  answer: string;

  /** Sources used */
  sources: RAGSource[];

  /** Confidence score */
  confidence: number;

  /** Context used for generation */
  context: RAGContext;

  /** Generation metadata */
  metadata: {
    tokensUsed: number;
    generationTime: number;
    model: string;
  };
}

/**
 * Source citation
 */
export interface RAGSource {
  /** Source ID */
  id: string;

  /** Source type */
  type: 'meal_pattern' | 'ingredient' | 'recipe_step' | 'meal_log' | 'technique';

  /** Relevant excerpt */
  excerpt: string;

  /** Relevance score */
  relevance: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Recommendation request
 */
export interface RecommendationRequest {
  /** User context */
  context: {
    /** Available ingredients */
    availableIngredients?: string[];

    /** Dietary restrictions */
    dietaryRestrictions?: string[];

    /** Preferred cuisines */
    cuisines?: string[];

    /** Time constraint (minutes) */
    timeConstraint?: number;

    /** Skill level */
    skillLevel?: 'beginner' | 'intermediate' | 'advanced';

    /** Previous meals (for variety) */
    recentMeals?: string[];

    /** User preferences */
    preferences?: Record<string, unknown>;
  };

  /** Type of recommendation (optional, defaults to 'meal') */
  recommendationType?: 'meal' | 'ingredient' | 'substitution';

  /** Number of recommendations */
  topK?: number;
}

/**
 * Meal recommendation
 */
export interface MealRecommendation {
  /** Meal pattern ID */
  patternId: string;

  /** Meal name */
  name: string;

  /** Recommendation score */
  score: number;

  /** Reasons for recommendation */
  reasons: string[];

  /** Ingredients needed */
  ingredients: {
    name: string;
    available: boolean;
    substitutable?: boolean;
  }[];

  /** Prep and cook time */
  totalTime: number;

  /** Difficulty */
  difficulty: 'easy' | 'medium' | 'hard';

  /** Nutrition info */
  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

/**
 * Ingredient recommendation
 */
export interface IngredientRecommendation {
  /** Ingredient name */
  ingredient: string;

  /** Recommendation score */
  score: number;

  /** Reason for recommendation */
  reason: string;

  /** Potential uses */
  potentialUses: string[];

  /** Pairs well with (from inventory) */
  pairsWithAvailable: string[];
}

/**
 * Query expansion result
 */
export interface QueryExpansion {
  /** Original query */
  original: string;

  /** Expanded queries */
  expanded: string[];

  /** Synonyms found */
  synonyms: Record<string, string[]>;

  /** Related concepts */
  relatedConcepts: string[];
}

/**
 * Re-ranking configuration
 */
export interface ReRankConfig {
  /** Re-ranking strategy */
  strategy: 'mmr' | 'diversity' | 'recency' | 'hybrid';

  /** Diversity parameter (for MMR) */
  lambda?: number;

  /** Recency weight */
  recencyWeight?: number;

  /** Custom scoring function */
  customScorer?: (doc: SearchResult) => number;
}

/**
 * Context compression result
 */
export interface CompressedContext {
  /** Compressed text */
  text: string;

  /** Compression ratio */
  compressionRatio: number;

  /** Sentences removed */
  sentencesRemoved: number;

  /** Key information retained */
  keyInformation: string[];
}
