/**
 * GOAP Planning System for RuVector Integration
 *
 * This module provides a Goal-Oriented Action Planning (GOAP) system
 * that dynamically generates optimal implementation plans.
 *
 * Usage:
 *
 * ```typescript
 * import { createMVPPlanner, MVP_GOAL_STATE } from './planning';
 *
 * const planner = createMVPPlanner(INITIAL_STATE);
 * const result = planner.findPlan(MVP_GOAL_STATE);
 *
 * if (result.success) {
 *   console.log(planner.getPlanSummary(result.plan));
 * }
 * ```
 */

// World State exports
export type { WorldState } from './world-state';
export {
  INITIAL_STATE,
  MVP_GOAL_STATE,
  FULL_GOAL_STATE,
  isGoalSatisfied,
  calculateStateDistance,
  getStateDiff,
} from './world-state';

// Action exports
export type { Action } from './actions';
export {
  ALL_ACTIONS,
  getActionsByPhase,
  getActionById,
  arePreconditionsSatisfied,
  // Specific actions
  InstallRuVector,
  CreateTypeDefinitions,
  CreateCollections,
  SeedInitialData,
  ImplementCoreService,
  ImplementEmbeddingService,
  ImplementCollectionManager,
  CreateAPIRoutes,
  ImplementHealthChecks,
  ImplementSemanticMealSearch,
  ImplementSemanticRecipeSearch,
  ImplementNLMealLogging,
  IntegrateMobileSearch,
  BuildKnowledgeGraph,
  ImplementSubstitutionEngine,
  ImplementRAGPipeline,
  IntegrateInventory,
  ImplementFeedbackCollection,
  ImplementLearningPipeline,
  WriteUnitTests,
  WriteIntegrationTests,
  WriteDocumentation,
} from './actions';

// Planner exports
export type { PlanningResult, ValidationResult, ExecutionResult } from './planner';
export {
  GOAPPlanner,
  createPlan,
  createMVPPlanner,
} from './planner';
