/**
 * Vector Service Types Index
 * Exports all type definitions for RuVector integration
 */

// Core types
export type {
  VectorDocument,
  SearchQuery,
  VectorFilter,
  SearchResult,
  BatchSearchResult,
  EmbeddingOptions,
  DistanceMetric,
  VectorIndexConfig,
  VectorOperationResult,
  BatchOperationResult,
  VectorStats
} from './vector.types';

export {
  VectorErrorType,
  VectorError,
  SIMILARITY_THRESHOLDS
} from './vector.types';

// Collection types
export type {
  CollectionMetadata,
  CollectionSchema,
  FieldSchema,
  MealPatternMetadata,
  MealPatternDocument,
  IngredientMetadata,
  IngredientDocument,
  RecipeStepMetadata,
  RecipeStepDocument,
  MealLogMetadata,
  MealLogDocument,
  CookingTechniqueMetadata,
  CookingTechniqueDocument,
  CollectionName
} from './collections.types';

export { COLLECTION_NAMES } from './collections.types';

// Graph types
export type {
  GraphNode,
  NodeType,
  GraphEdge,
  RelationshipType,
  KnowledgeGraph,
  GraphMetadata,
  IngredientSubstitution,
  FlavorPairing,
  GraphTraversalResult,
  SubgraphResult,
  GraphQueryFilters,
  GraphStats,
  CommunityDetectionResult,
  CentralityMetrics
} from './graph.types';

// RAG types
export type {
  RAGContext,
  RAGRequest,
  GenerationParams,
  RAGResponse,
  RAGSource,
  RecommendationRequest,
  MealRecommendation,
  IngredientRecommendation,
  QueryExpansion,
  ReRankConfig,
  CompressedContext
} from './rag.types';

// Learning types
export type {
  FeedbackEvent,
  FeedbackEventType,
  FeedbackValue,
  UserPreferenceProfile,
  TrainingBatch,
  TrainingExample,
  ModelMetrics,
  ABTestConfig,
  PersonalizationStrategy,
  LearningRateSchedule,
  ModelCheckpoint,
  FeatureImportance,
  PredictionExplanation
} from './learning.types';
