/**
 * GOAP World State Definition for RuVector Integration
 *
 * Represents the complete state space for implementation planning.
 * Each boolean represents a condition that can be true or false.
 * The planner uses this to determine which actions can be executed
 * and what the state will be after execution.
 */

export interface WorldState {
  // ============================================
  // INFRASTRUCTURE LAYER (Phase 0)
  // ============================================

  /** RuVector package installed in dependencies */
  ruvectorInstalled: boolean;

  /** Type definitions created for TypeScript support */
  typeDefinitionsExist: boolean;

  /** Vector database collections created with proper schemas */
  collectionsCreated: boolean;

  /** Initial seed data loaded into collections */
  dataSeeded: boolean;

  /** Database migrations prepared and validated */
  migrationsReady: boolean;

  // ============================================
  // PHASE 1: CORE FOUNDATION
  // ============================================

  /** Core vector service implemented with base operations */
  coreServiceExists: boolean;

  /** Embedding service implemented for text-to-vector conversion */
  embeddingServiceExists: boolean;

  /** Collection manager implemented for CRUD operations */
  collectionManagerExists: boolean;

  /** API routes created for vector operations */
  apiRoutesExist: boolean;

  /** Basic health checks and monitoring in place */
  healthChecksWork: boolean;

  // ============================================
  // PHASE 2: SEMANTIC SEARCH
  // ============================================

  /** Semantic search working for meals */
  semanticMealSearchWorks: boolean;

  /** Semantic search working for recipes */
  semanticRecipeSearchWorks: boolean;

  /** Semantic search working for ingredients */
  semanticIngredientSearchWorks: boolean;

  /** Natural language meal logging functional */
  nlMealLoggingWorks: boolean;

  /** Mobile app integrated with search API */
  mobileSearchIntegrated: boolean;

  /** Search results ranked and filtered properly */
  searchRankingWorks: boolean;

  // ============================================
  // PHASE 3: KNOWLEDGE GRAPH
  // ============================================

  /** Knowledge graph schema defined and implemented */
  knowledgeGraphBuilt: boolean;

  /** Ingredient substitution engine working */
  substitutionEngineWorks: boolean;

  /** Nutritional similarity calculations working */
  nutritionalSimilarityWorks: boolean;

  /** Graph traversal queries optimized */
  graphQueriesWork: boolean;

  /** Meal pattern analysis functional */
  patternAnalysisWorks: boolean;

  /** Relationship inference engine working */
  relationshipInferenceWorks: boolean;

  // ============================================
  // PHASE 4: RAG PIPELINE
  // ============================================

  /** RAG pipeline implemented end-to-end */
  ragPipelineWorks: boolean;

  /** Recipe generation from preferences working */
  recipeGenerationWorks: boolean;

  /** Meal plan suggestions contextual and relevant */
  mealPlanSuggestionsWork: boolean;

  /** Inventory integration for context awareness */
  inventoryIntegrated: boolean;

  /** Smart recommendations based on history */
  smartRecommendationsWork: boolean;

  /** Context window optimization implemented */
  contextOptimizationWorks: boolean;

  // ============================================
  // PHASE 5: LEARNING LOOP
  // ============================================

  /** User feedback collection mechanism in place */
  feedbackCollected: boolean;

  /** Continuous learning pipeline functional */
  learningPipelineWorks: boolean;

  /** Personalization engine active and improving */
  personalizationActive: boolean;

  /** A/B testing framework for recommendations */
  abTestingWorks: boolean;

  /** Model performance tracking and alerting */
  performanceTrackingWorks: boolean;

  /** Auto-retraining triggers configured */
  autoRetrainingWorks: boolean;

  // ============================================
  // QUALITY GATES
  // ============================================

  /** All unit tests passing (>80% coverage) */
  unitTestsPass: boolean;

  /** All integration tests passing */
  integrationTestsPass: boolean;

  /** End-to-end tests for critical paths passing */
  e2eTestsPass: boolean;

  /** Performance benchmarks meet requirements */
  performanceAcceptable: boolean;

  /** Security audit completed and issues resolved */
  securityAuditPassed: boolean;

  /** Documentation complete and up-to-date */
  documentationComplete: boolean;

  // ============================================
  // DEPLOYMENT READINESS
  // ============================================

  /** Production environment configured */
  productionConfigured: boolean;

  /** Monitoring and alerting set up */
  monitoringConfigured: boolean;

  /** Rollback procedures tested */
  rollbackTested: boolean;

  /** Load testing completed successfully */
  loadTestingPassed: boolean;

  /** Disaster recovery plan in place */
  disasterRecoveryReady: boolean;
}

/**
 * Initial state - nothing implemented yet
 */
export const INITIAL_STATE: WorldState = {
  // Infrastructure
  ruvectorInstalled: false,
  typeDefinitionsExist: false,
  collectionsCreated: false,
  dataSeeded: false,
  migrationsReady: false,

  // Phase 1
  coreServiceExists: false,
  embeddingServiceExists: false,
  collectionManagerExists: false,
  apiRoutesExist: false,
  healthChecksWork: false,

  // Phase 2
  semanticMealSearchWorks: false,
  semanticRecipeSearchWorks: false,
  semanticIngredientSearchWorks: false,
  nlMealLoggingWorks: false,
  mobileSearchIntegrated: false,
  searchRankingWorks: false,

  // Phase 3
  knowledgeGraphBuilt: false,
  substitutionEngineWorks: false,
  nutritionalSimilarityWorks: false,
  graphQueriesWork: false,
  patternAnalysisWorks: false,
  relationshipInferenceWorks: false,

  // Phase 4
  ragPipelineWorks: false,
  recipeGenerationWorks: false,
  mealPlanSuggestionsWork: false,
  inventoryIntegrated: false,
  smartRecommendationsWork: false,
  contextOptimizationWorks: false,

  // Phase 5
  feedbackCollected: false,
  learningPipelineWorks: false,
  personalizationActive: false,
  abTestingWorks: false,
  performanceTrackingWorks: false,
  autoRetrainingWorks: false,

  // Quality
  unitTestsPass: false,
  integrationTestsPass: false,
  e2eTestsPass: false,
  performanceAcceptable: false,
  securityAuditPassed: false,
  documentationComplete: false,

  // Deployment
  productionConfigured: false,
  monitoringConfigured: false,
  rollbackTested: false,
  loadTestingPassed: false,
  disasterRecoveryReady: false,
};

/**
 * Goal state for MVP (Phase 1-2 complete)
 */
export const MVP_GOAL_STATE: Partial<WorldState> = {
  // Infrastructure must be complete
  ruvectorInstalled: true,
  typeDefinitionsExist: true,
  collectionsCreated: true,
  dataSeeded: true,

  // Phase 1 complete
  coreServiceExists: true,
  embeddingServiceExists: true,
  collectionManagerExists: true,
  apiRoutesExist: true,
  healthChecksWork: true,

  // Phase 2 semantic search working
  semanticMealSearchWorks: true,
  semanticRecipeSearchWorks: true,
  nlMealLoggingWorks: true,
  mobileSearchIntegrated: true,

  // Basic quality gates
  unitTestsPass: true,
  integrationTestsPass: true,
  documentationComplete: true,
};

/**
 * Goal state for full implementation (all phases)
 */
export const FULL_GOAL_STATE: Partial<WorldState> = {
  // All infrastructure
  ruvectorInstalled: true,
  typeDefinitionsExist: true,
  collectionsCreated: true,
  dataSeeded: true,
  migrationsReady: true,

  // All Phase 1
  coreServiceExists: true,
  embeddingServiceExists: true,
  collectionManagerExists: true,
  apiRoutesExist: true,
  healthChecksWork: true,

  // All Phase 2
  semanticMealSearchWorks: true,
  semanticRecipeSearchWorks: true,
  semanticIngredientSearchWorks: true,
  nlMealLoggingWorks: true,
  mobileSearchIntegrated: true,
  searchRankingWorks: true,

  // All Phase 3
  knowledgeGraphBuilt: true,
  substitutionEngineWorks: true,
  nutritionalSimilarityWorks: true,
  graphQueriesWork: true,
  patternAnalysisWorks: true,

  // All Phase 4
  ragPipelineWorks: true,
  recipeGenerationWorks: true,
  mealPlanSuggestionsWork: true,
  inventoryIntegrated: true,
  smartRecommendationsWork: true,

  // All Phase 5
  feedbackCollected: true,
  learningPipelineWorks: true,
  personalizationActive: true,

  // All quality gates
  unitTestsPass: true,
  integrationTestsPass: true,
  e2eTestsPass: true,
  performanceAcceptable: true,
  securityAuditPassed: true,
  documentationComplete: true,

  // Production ready
  productionConfigured: true,
  monitoringConfigured: true,
  rollbackTested: true,
};

/**
 * Helper to check if a goal state is satisfied
 */
export function isGoalSatisfied(
  current: WorldState,
  goal: Partial<WorldState>
): boolean {
  return Object.entries(goal).every(([key, value]) => {
    return current[key as keyof WorldState] === value;
  });
}

/**
 * Helper to calculate state distance (heuristic for A*)
 * Returns number of unsatisfied goal conditions
 */
export function calculateStateDistance(
  current: WorldState,
  goal: Partial<WorldState>
): number {
  return Object.entries(goal).filter(([key, value]) => {
    return current[key as keyof WorldState] !== value;
  }).length;
}

/**
 * Helper to get state diff
 */
export function getStateDiff(
  before: WorldState,
  after: WorldState
): Partial<WorldState> {
  const diff: Partial<WorldState> = {};

  for (const key of Object.keys(before) as Array<keyof WorldState>) {
    if (before[key] !== after[key]) {
      diff[key] = after[key];
    }
  }

  return diff;
}
