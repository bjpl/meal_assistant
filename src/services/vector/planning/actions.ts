/**
 * GOAP Actions Library for RuVector Integration
 *
 * Defines all available actions with their:
 * - Preconditions: what must be true to execute
 * - Effects: how they change the world state
 * - Cost: relative effort/time to execute
 * - Commands: actual implementation steps
 */

import type { WorldState } from './world-state';

export interface Action {
  /** Unique identifier for this action */
  id: string;

  /** Human-readable name */
  name: string;

  /** Detailed description of what this action does */
  description: string;

  /** Phase this action belongs to */
  phase: 0 | 1 | 2 | 3 | 4 | 5;

  /** Prerequisites that must be true before this can execute */
  preconditions: Partial<WorldState>;

  /** State changes that occur after successful execution */
  effects: Partial<WorldState>;

  /** Relative cost (time/effort): 1=trivial, 5=moderate, 10=complex */
  cost: number;

  /** Actual commands or steps to execute */
  commands: string[];

  /** Files that will be created or modified */
  files: string[];

  /** Tests that should be written */
  tests?: string[];

  /** Documentation that should be updated */
  docs?: string[];

  /** Rollback procedure if this action fails */
  rollback?: string[];

  /** Validation steps to confirm success */
  validation: string[];

  /** Estimated time in hours */
  estimatedHours: number;

  /** Risk level: low, medium, high, critical */
  risk: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================
// PHASE 0: INFRASTRUCTURE
// ============================================

export const InstallRuVector: Action = {
  id: 'install-ruvector',
  name: 'Install RuVector Package',
  description: 'Add ruvector npm package to project dependencies',
  phase: 0,
  preconditions: {},
  effects: {
    ruvectorInstalled: true,
  },
  cost: 1,
  commands: [
    'npm install ruvector --save',
    'npm install @types/ruvector --save-dev',
  ],
  files: [
    'package.json',
    'package-lock.json',
  ],
  validation: [
    'Check package.json contains ruvector',
    'Verify node_modules/ruvector exists',
    'Run: npm list ruvector',
  ],
  estimatedHours: 0.5,
  risk: 'low',
};

export const CreateTypeDefinitions: Action = {
  id: 'create-type-definitions',
  name: 'Create TypeScript Type Definitions',
  description: 'Define all TypeScript interfaces for vector operations',
  phase: 0,
  preconditions: {
    ruvectorInstalled: true,
  },
  effects: {
    typeDefinitionsExist: true,
  },
  cost: 3,
  commands: [
    'Create src/services/vector/types/index.ts',
    'Create src/services/vector/types/collections.ts',
    'Create src/services/vector/types/embeddings.ts',
    'Create src/services/vector/types/queries.ts',
  ],
  files: [
    'src/services/vector/types/index.ts',
    'src/services/vector/types/collections.ts',
    'src/services/vector/types/embeddings.ts',
    'src/services/vector/types/queries.ts',
  ],
  tests: [
    'tests/unit/types/vector-types.test.ts',
  ],
  validation: [
    'TypeScript compiles without errors',
    'Run: npm run typecheck',
  ],
  estimatedHours: 2,
  risk: 'low',
};

export const CreateCollections: Action = {
  id: 'create-collections',
  name: 'Create Vector Collections',
  description: 'Initialize all required vector collections with proper schemas',
  phase: 0,
  preconditions: {
    ruvectorInstalled: true,
    typeDefinitionsExist: true,
  },
  effects: {
    collectionsCreated: true,
  },
  cost: 5,
  commands: [
    'Create collection schemas for meals, recipes, ingredients',
    'Implement collection initialization script',
    'Add collection management utilities',
  ],
  files: [
    'src/services/vector/collections/meal-collection.ts',
    'src/services/vector/collections/recipe-collection.ts',
    'src/services/vector/collections/ingredient-collection.ts',
    'scripts/vector/initialize-collections.ts',
  ],
  tests: [
    'tests/integration/vector/collections.test.ts',
  ],
  validation: [
    'Collections exist and are queryable',
    'Schemas match expected structure',
    'Run: npm run test:integration',
  ],
  rollback: [
    'Drop created collections',
    'Clean up vector database',
  ],
  estimatedHours: 4,
  risk: 'medium',
};

export const SeedInitialData: Action = {
  id: 'seed-initial-data',
  name: 'Seed Initial Vector Data',
  description: 'Load initial dataset into vector collections',
  phase: 0,
  preconditions: {
    collectionsCreated: true,
  },
  effects: {
    dataSeeded: true,
  },
  cost: 3,
  commands: [
    'Create seed data scripts',
    'Convert existing meal/recipe data to embeddings',
    'Bulk insert into collections',
  ],
  files: [
    'scripts/vector/seed-data.ts',
    'src/services/vector/seeding/data-converter.ts',
  ],
  tests: [
    'tests/integration/vector/seeding.test.ts',
  ],
  validation: [
    'Collection counts match expected',
    'Sample queries return results',
    'Embeddings have correct dimensions',
  ],
  rollback: [
    'Clear all seeded data',
    'Reset collections to empty state',
  ],
  estimatedHours: 3,
  risk: 'low',
};

// ============================================
// PHASE 1: CORE FOUNDATION
// ============================================

export const ImplementCoreService: Action = {
  id: 'implement-core-service',
  name: 'Implement Core Vector Service',
  description: 'Create main vector service with CRUD operations',
  phase: 1,
  preconditions: {
    typeDefinitionsExist: true,
    collectionsCreated: true,
  },
  effects: {
    coreServiceExists: true,
  },
  cost: 7,
  commands: [
    'Create VectorService class',
    'Implement insert, update, delete, query methods',
    'Add error handling and logging',
    'Implement connection pooling',
  ],
  files: [
    'src/services/vector/core/vector-service.ts',
    'src/services/vector/core/connection-manager.ts',
    'src/services/vector/core/error-handler.ts',
  ],
  tests: [
    'tests/unit/services/vector-service.test.ts',
    'tests/integration/vector/core-operations.test.ts',
  ],
  docs: [
    'docs/services/vector-service.md',
  ],
  validation: [
    'All CRUD operations work',
    'Error handling covers edge cases',
    'Unit tests pass with >90% coverage',
  ],
  estimatedHours: 6,
  risk: 'medium',
};

export const ImplementEmbeddingService: Action = {
  id: 'implement-embedding-service',
  name: 'Implement Embedding Service',
  description: 'Create service for text-to-vector conversion',
  phase: 1,
  preconditions: {
    typeDefinitionsExist: true,
    coreServiceExists: true,
  },
  effects: {
    embeddingServiceExists: true,
  },
  cost: 8,
  commands: [
    'Integrate embedding model (e.g., OpenAI, local transformer)',
    'Implement caching for embeddings',
    'Add batch processing support',
    'Implement embedding dimension normalization',
  ],
  files: [
    'src/services/vector/embeddings/embedding-service.ts',
    'src/services/vector/embeddings/cache-manager.ts',
    'src/services/vector/embeddings/batch-processor.ts',
  ],
  tests: [
    'tests/unit/services/embedding-service.test.ts',
    'tests/integration/vector/embeddings.test.ts',
  ],
  validation: [
    'Embeddings generated correctly',
    'Cache hit rate >70% in tests',
    'Batch processing reduces latency',
  ],
  estimatedHours: 8,
  risk: 'high',
};

export const ImplementCollectionManager: Action = {
  id: 'implement-collection-manager',
  name: 'Implement Collection Manager',
  description: 'Create collection management service for CRUD operations',
  phase: 1,
  preconditions: {
    coreServiceExists: true,
  },
  effects: {
    collectionManagerExists: true,
  },
  cost: 4,
  commands: [
    'Create CollectionManager class',
    'Implement collection CRUD operations',
    'Add schema validation',
  ],
  files: [
    'src/services/vector/core/collection-manager.ts',
  ],
  tests: [
    'tests/unit/services/collection-manager.test.ts',
  ],
  validation: [
    'Collection operations work correctly',
    'Schema validation catches errors',
  ],
  estimatedHours: 3,
  risk: 'low',
};

export const ImplementHealthChecks: Action = {
  id: 'implement-health-checks',
  name: 'Implement Health Checks',
  description: 'Add health check endpoints and monitoring',
  phase: 1,
  preconditions: {
    coreServiceExists: true,
    apiRoutesExist: true,
  },
  effects: {
    healthChecksWork: true,
  },
  cost: 2,
  commands: [
    'Create health check endpoints',
    'Add vector service health monitoring',
    'Implement readiness probes',
  ],
  files: [
    'src/api/routes/health.ts',
    'src/services/vector/core/health-monitor.ts',
  ],
  tests: [
    'tests/unit/services/health.test.ts',
  ],
  validation: [
    'Health endpoints return correct status',
    'Unhealthy conditions are detected',
  ],
  estimatedHours: 2,
  risk: 'low',
};

export const CreateAPIRoutes: Action = {
  id: 'create-api-routes',
  name: 'Create Vector API Routes',
  description: 'Expose vector operations via REST API',
  phase: 1,
  preconditions: {
    coreServiceExists: true,
    embeddingServiceExists: true,
  },
  effects: {
    apiRoutesExist: true,
  },
  cost: 5,
  commands: [
    'Create Express routes for vector operations',
    'Add authentication middleware',
    'Implement rate limiting',
    'Add request validation',
  ],
  files: [
    'src/api/routes/vector.ts',
    'src/api/middleware/vector-auth.ts',
    'src/api/middleware/vector-rate-limit.ts',
  ],
  tests: [
    'tests/e2e/api/vector-routes.test.ts',
  ],
  docs: [
    'docs/api/vector-endpoints.md',
  ],
  validation: [
    'All endpoints return correct status codes',
    'Authentication blocks unauthorized requests',
    'Rate limiting works as expected',
  ],
  estimatedHours: 4,
  risk: 'low',
};

// ============================================
// PHASE 2: SEMANTIC SEARCH
// ============================================

export const ImplementSemanticMealSearch: Action = {
  id: 'implement-semantic-meal-search',
  name: 'Implement Semantic Meal Search',
  description: 'Enable natural language search for meals',
  phase: 2,
  preconditions: {
    coreServiceExists: true,
    embeddingServiceExists: true,
    apiRoutesExist: true,
    dataSeeded: true,
  },
  effects: {
    semanticMealSearchWorks: true,
  },
  cost: 6,
  commands: [
    'Implement semantic search algorithm',
    'Add relevance scoring',
    'Implement query expansion',
    'Add search filters and facets',
  ],
  files: [
    'src/services/vector/search/meal-search.ts',
    'src/services/vector/search/relevance-scorer.ts',
  ],
  tests: [
    'tests/integration/vector/meal-search.test.ts',
  ],
  validation: [
    'Search returns relevant results',
    'Query latency <500ms for p95',
    'Relevance scores are meaningful',
  ],
  estimatedHours: 5,
  risk: 'medium',
};

export const ImplementNLMealLogging: Action = {
  id: 'implement-nl-meal-logging',
  name: 'Implement Natural Language Meal Logging',
  description: 'Allow users to log meals using natural language',
  phase: 2,
  preconditions: {
    semanticMealSearchWorks: true,
    embeddingServiceExists: true,
  },
  effects: {
    nlMealLoggingWorks: true,
  },
  cost: 7,
  commands: [
    'Implement NL parser for meal descriptions',
    'Add entity extraction (food, quantity, time)',
    'Implement meal creation from NL input',
    'Add confidence scoring',
  ],
  files: [
    'src/services/vector/nl/meal-parser.ts',
    'src/services/vector/nl/entity-extractor.ts',
  ],
  tests: [
    'tests/integration/vector/nl-logging.test.ts',
  ],
  validation: [
    'Common meal phrases parsed correctly',
    'Entity extraction accuracy >85%',
    'Low confidence prompts for clarification',
  ],
  estimatedHours: 7,
  risk: 'high',
};

export const ImplementSemanticRecipeSearch: Action = {
  id: 'implement-semantic-recipe-search',
  name: 'Implement Semantic Recipe Search',
  description: 'Enable natural language search for recipes',
  phase: 2,
  preconditions: {
    semanticMealSearchWorks: true,
  },
  effects: {
    semanticRecipeSearchWorks: true,
  },
  cost: 4,
  commands: [
    'Extend semantic search to recipes',
    'Add recipe-specific filters',
    'Implement ingredient-based search',
  ],
  files: [
    'src/services/vector/search/recipe-search.ts',
  ],
  tests: [
    'tests/integration/vector/recipe-search.test.ts',
  ],
  validation: [
    'Recipe search returns relevant results',
    'Ingredient filtering works correctly',
  ],
  estimatedHours: 4,
  risk: 'low',
};

export const IntegrateMobileSearch: Action = {
  id: 'integrate-mobile-search',
  name: 'Integrate Mobile Search',
  description: 'Connect mobile app to semantic search API',
  phase: 2,
  preconditions: {
    semanticMealSearchWorks: true,
    apiRoutesExist: true,
  },
  effects: {
    mobileSearchIntegrated: true,
  },
  cost: 4,
  commands: [
    'Create mobile API client for vector search',
    'Implement search UI components',
    'Add offline search capability',
    'Implement search history',
  ],
  files: [
    'src/mobile/services/vector-search-api.ts',
    'src/mobile/components/search/VectorSearchBar.tsx',
    'src/mobile/components/search/SearchResults.tsx',
  ],
  tests: [
    'tests/e2e/mobile/search.test.ts',
  ],
  validation: [
    'Search works on mobile',
    'UI is responsive and fast',
    'Offline search uses cached data',
  ],
  estimatedHours: 4,
  risk: 'medium',
};

// ============================================
// PHASE 3: KNOWLEDGE GRAPH
// ============================================

export const BuildKnowledgeGraph: Action = {
  id: 'build-knowledge-graph',
  name: 'Build Knowledge Graph',
  description: 'Create graph of food relationships and properties',
  phase: 3,
  preconditions: {
    coreServiceExists: true,
    dataSeeded: true,
  },
  effects: {
    knowledgeGraphBuilt: true,
  },
  cost: 10,
  commands: [
    'Define graph schema (nodes: foods, edges: relationships)',
    'Implement graph construction from vector data',
    'Add relationship types (substitute, similar, complementary)',
    'Implement graph traversal algorithms',
  ],
  files: [
    'src/services/vector/graph/schema.ts',
    'src/services/vector/graph/builder.ts',
    'src/services/vector/graph/traversal.ts',
  ],
  tests: [
    'tests/integration/vector/knowledge-graph.test.ts',
  ],
  validation: [
    'Graph contains expected nodes and edges',
    'Traversal returns valid paths',
    'Relationship types are accurate',
  ],
  estimatedHours: 10,
  risk: 'high',
};

export const ImplementSubstitutionEngine: Action = {
  id: 'implement-substitution-engine',
  name: 'Implement Substitution Engine',
  description: 'Suggest ingredient substitutions using knowledge graph',
  phase: 3,
  preconditions: {
    knowledgeGraphBuilt: true,
  },
  effects: {
    substitutionEngineWorks: true,
  },
  cost: 7,
  commands: [
    'Implement substitution scoring algorithm',
    'Add nutritional equivalence checks',
    'Implement dietary restriction filters',
    'Add user preference weighting',
  ],
  files: [
    'src/services/vector/graph/substitution-engine.ts',
    'src/services/vector/graph/nutrition-scorer.ts',
  ],
  tests: [
    'tests/integration/vector/substitutions.test.ts',
  ],
  validation: [
    'Substitutions make culinary sense',
    'Nutritional profiles are similar',
    'Dietary restrictions honored',
  ],
  estimatedHours: 6,
  risk: 'medium',
};

// ============================================
// PHASE 4: RAG PIPELINE
// ============================================

export const ImplementRAGPipeline: Action = {
  id: 'implement-rag-pipeline',
  name: 'Implement RAG Pipeline',
  description: 'Build retrieval-augmented generation for meal planning',
  phase: 4,
  preconditions: {
    semanticMealSearchWorks: true,
    knowledgeGraphBuilt: true,
  },
  effects: {
    ragPipelineWorks: true,
  },
  cost: 10,
  commands: [
    'Implement context retrieval from vectors',
    'Integrate LLM for generation (Claude/GPT)',
    'Add prompt engineering templates',
    'Implement response ranking and filtering',
  ],
  files: [
    'src/services/vector/rag/pipeline.ts',
    'src/services/vector/rag/retriever.ts',
    'src/services/vector/rag/generator.ts',
    'src/services/vector/rag/prompts.ts',
  ],
  tests: [
    'tests/integration/vector/rag-pipeline.test.ts',
  ],
  validation: [
    'Generated responses are relevant',
    'Context is properly incorporated',
    'Response latency <3s for p95',
  ],
  estimatedHours: 12,
  risk: 'high',
};

export const IntegrateInventory: Action = {
  id: 'integrate-inventory',
  name: 'Integrate Inventory Context',
  description: 'Use inventory data in RAG context for meal suggestions',
  phase: 4,
  preconditions: {
    ragPipelineWorks: true,
  },
  effects: {
    inventoryIntegrated: true,
  },
  cost: 5,
  commands: [
    'Add inventory service integration',
    'Implement inventory-aware context builder',
    'Add expiry-based prioritization',
    'Implement "use what you have" mode',
  ],
  files: [
    'src/services/vector/rag/inventory-context.ts',
  ],
  tests: [
    'tests/integration/vector/inventory-integration.test.ts',
  ],
  validation: [
    'Suggestions prioritize available ingredients',
    'Expiring items get higher priority',
    'Missing ingredients identified',
  ],
  estimatedHours: 4,
  risk: 'low',
};

// ============================================
// PHASE 5: LEARNING LOOP
// ============================================

export const ImplementFeedbackCollection: Action = {
  id: 'implement-feedback-collection',
  name: 'Implement Feedback Collection',
  description: 'Collect user feedback on recommendations and searches',
  phase: 5,
  preconditions: {
    ragPipelineWorks: true,
    semanticMealSearchWorks: true,
  },
  effects: {
    feedbackCollected: true,
  },
  cost: 4,
  commands: [
    'Add feedback collection endpoints',
    'Implement feedback storage',
    'Add thumbs up/down on search results',
    'Track click-through rates',
  ],
  files: [
    'src/services/vector/feedback/collector.ts',
    'src/api/routes/feedback.ts',
  ],
  tests: [
    'tests/integration/vector/feedback.test.ts',
  ],
  validation: [
    'Feedback is captured correctly',
    'Metrics are tracked properly',
    'Data is stored securely',
  ],
  estimatedHours: 3,
  risk: 'low',
};

export const ImplementLearningPipeline: Action = {
  id: 'implement-learning-pipeline',
  name: 'Implement Learning Pipeline',
  description: 'Use feedback to improve recommendations over time',
  phase: 5,
  preconditions: {
    feedbackCollected: true,
  },
  effects: {
    learningPipelineWorks: true,
    personalizationActive: true,
  },
  cost: 8,
  commands: [
    'Implement feedback aggregation',
    'Add re-ranking based on feedback',
    'Implement user preference modeling',
    'Add continuous model updates',
  ],
  files: [
    'src/services/vector/learning/pipeline.ts',
    'src/services/vector/learning/preference-model.ts',
  ],
  tests: [
    'tests/integration/vector/learning.test.ts',
  ],
  validation: [
    'Re-ranking improves with feedback',
    'User preferences are learned',
    'Model performance improves over time',
  ],
  estimatedHours: 8,
  risk: 'high',
};

// ============================================
// QUALITY GATES
// ============================================

export const WriteUnitTests: Action = {
  id: 'write-unit-tests',
  name: 'Write Comprehensive Unit Tests',
  description: 'Achieve >80% code coverage with unit tests',
  phase: 1,
  preconditions: {
    coreServiceExists: true,
  },
  effects: {
    unitTestsPass: true,
  },
  cost: 6,
  commands: [
    'Write tests for all services',
    'Mock external dependencies',
    'Test edge cases and error paths',
    'Generate coverage report',
  ],
  files: [
    'tests/unit/services/**/*.test.ts',
  ],
  validation: [
    'All tests pass',
    'Coverage >80%',
    'Run: npm run test:coverage',
  ],
  estimatedHours: 6,
  risk: 'low',
};

export const WriteIntegrationTests: Action = {
  id: 'write-integration-tests',
  name: 'Write Integration Tests',
  description: 'Test all component interactions',
  phase: 2,
  preconditions: {
    coreServiceExists: true,
    apiRoutesExist: true,
  },
  effects: {
    integrationTestsPass: true,
  },
  cost: 5,
  commands: [
    'Test API endpoints end-to-end',
    'Test vector operations',
    'Test data flow through system',
  ],
  files: [
    'tests/integration/vector/**/*.test.ts',
  ],
  validation: [
    'All integration tests pass',
    'Run: npm run test:integration',
  ],
  estimatedHours: 5,
  risk: 'medium',
};

export const WriteDocumentation: Action = {
  id: 'write-documentation',
  name: 'Write Documentation',
  description: 'Create comprehensive documentation for vector services',
  phase: 2,
  preconditions: {
    apiRoutesExist: true,
    integrationTestsPass: true,
  },
  effects: {
    documentationComplete: true,
  },
  cost: 4,
  commands: [
    'Write API documentation',
    'Create usage guides',
    'Document configuration options',
    'Add code examples',
  ],
  files: [
    'docs/services/vector-service.md',
    'docs/api/vector-endpoints.md',
  ],
  validation: [
    'Documentation is complete and accurate',
    'Examples work as documented',
  ],
  estimatedHours: 4,
  risk: 'low',
};

// ============================================
// ACTION REGISTRY
// ============================================

export const ALL_ACTIONS: Action[] = [
  // Phase 0: Infrastructure
  InstallRuVector,
  CreateTypeDefinitions,
  CreateCollections,
  SeedInitialData,

  // Phase 1: Core
  ImplementCoreService,
  ImplementEmbeddingService,
  ImplementCollectionManager,
  CreateAPIRoutes,
  ImplementHealthChecks,

  // Phase 2: Search
  ImplementSemanticMealSearch,
  ImplementSemanticRecipeSearch,
  ImplementNLMealLogging,
  IntegrateMobileSearch,

  // Phase 3: Graph
  BuildKnowledgeGraph,
  ImplementSubstitutionEngine,

  // Phase 4: RAG
  ImplementRAGPipeline,
  IntegrateInventory,

  // Phase 5: Learning
  ImplementFeedbackCollection,
  ImplementLearningPipeline,

  // Quality
  WriteUnitTests,
  WriteIntegrationTests,
  WriteDocumentation,
];

/**
 * Get actions by phase
 */
export function getActionsByPhase(phase: number): Action[] {
  return ALL_ACTIONS.filter(action => action.phase === phase);
}

/**
 * Get action by ID
 */
export function getActionById(id: string): Action | undefined {
  return ALL_ACTIONS.find(action => action.id === id);
}

/**
 * Check if action preconditions are satisfied
 */
export function arePreconditionsSatisfied(
  action: Action,
  state: WorldState
): boolean {
  return Object.entries(action.preconditions).every(([key, value]) => {
    return state[key as keyof WorldState] === value;
  });
}
