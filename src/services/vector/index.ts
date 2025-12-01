/**
 * Vector Services Index
 * Main export point for RuVector integration
 */

// Core services
export { ruVectorService, RuVectorService } from './core/ruvector.service';
export { embeddingService, EmbeddingService } from './core/embedding.service';
export { collectionService, CollectionService } from './core/collection.service';

// Search services
export { semanticSearchService, SemanticSearchService } from './search/semantic.service';
export type {
  MealSearchOptions,
  MealSearchResult,
  IngredientSearchResult
} from './search/semantic.service';

// RAG services
export { ragService, RAGService } from './rag/rag.service';

// Graph services
export { graphService, GraphService } from './graph/graph.service';
export type { GraphQueryResult, GraphPath } from './graph/graph.service';

// Seeders - Main exports for data initialization
export {
  // Pattern seeder
  seedPatterns,
  clearPatterns,
  verifyPatterns,
  getPatternById,
  getAllPatterns,
  // Ingredient seeder
  seedIngredients,
  clearIngredients,
  verifyIngredients,
  getIngredientById,
  getIngredientsByCategory,
  getAllIngredients,
  // Graph seeder
  seedGraph,
  clearGraph,
  verifyGraph,
  seedAll,
  // Utility functions
  runAllSeeders,
  verifyAllSeeders,
  clearAllSeeders
} from './seeders';

// Configuration
export {
  DEFAULT_RUVECTOR_CONFIG,
  DEFAULT_COLLECTION_CONFIGS,
  DEFAULT_RAG_CONFIG,
  DEFAULT_LEARNING_CONFIG,
  SEARCH_PRESETS
} from './config/ruvector.config';

export type {
  RuVectorConfig,
  CollectionConfigs,
  RAGConfig,
  LearningConfig
} from './config/ruvector.config';

// Types
export * from './types';

// Substitution services
export {
  SubstitutionService,
  getSubstitutionService,
  substitutionService
} from './substitution';
export type {
  DietaryRestriction,
  CookingContext,
  SubstitutionRequest,
  SubstitutionSuggestion,
  SubstitutionResult
} from './substitution';

// Learning services
export {
  FeedbackService,
  getFeedbackService,
  feedbackService
} from './learning';
export type {
  FeedbackConfig
} from './learning';

// Expiry RAG services
export {
  ExpiryRAGService,
  getExpiryRAGService,
  expiryRAGService
} from './expiry';
export type {
  ExpiringItem,
  ExpiryRecipeRecommendation,
  ExpiryRecommendationResult
} from './expiry';
