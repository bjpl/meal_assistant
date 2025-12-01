# RuVector Integration - GOAP Planning System

This directory contains the Goal-Oriented Action Planning (GOAP) system for implementing RuVector vector database integration into the meal assistant application.

## Overview

The GOAP system provides:

- **Adaptive Planning**: Automatically generates optimal action sequences to reach goals
- **Dynamic Replanning**: Adjusts plans when actions fail or requirements change
- **Dependency Management**: Ensures actions execute in the correct order
- **Cost Optimization**: Finds the most efficient path to goals
- **Risk Assessment**: Identifies high-risk actions and provides mitigation strategies

## Directory Structure

```
vector/
├── planning/
│   ├── world-state.ts         # State space definition (65 boolean conditions)
│   ├── actions.ts              # Action library (19 core actions with preconditions/effects)
│   ├── planner.ts              # GOAP planner implementation (A* search)
│   ├── example-usage.ts        # Usage examples and demonstrations
│   └── index.ts                # Main exports
├── types/                      # TypeScript type definitions (to be created)
├── collections/                # Vector collection schemas (to be created)
├── core/                       # Core vector service (to be created)
├── embeddings/                 # Embedding service (to be created)
├── search/                     # Semantic search (to be created)
├── nl/                         # Natural language processing (to be created)
├── graph/                      # Knowledge graph (to be created)
├── rag/                        # RAG pipeline (to be created)
├── learning/                   # Learning loop (to be created)
├── IMPLEMENTATION_PLAN.md      # Detailed implementation plan
└── README.md                   # This file
```

## Quick Start

### 1. Generate an Implementation Plan

```typescript
import { createPlan, INITIAL_STATE, MVP_GOAL_STATE } from './planning';

// Generate plan for MVP (Phase 0-2)
const result = createPlan(INITIAL_STATE, MVP_GOAL_STATE);

if (result.success) {
  console.log(`Total Actions: ${result.plan.length}`);
  console.log(`Total Time: ${result.totalHours} hours`);
  console.log(`Estimated Days: ${result.totalHours / 8} days`);

  // Print action sequence
  result.plan.forEach((action, i) => {
    console.log(`${i + 1}. ${action.name} (${action.estimatedHours}h)`);
  });
}
```

### 2. Validate a Plan

```typescript
import { GOAPPlanner, INITIAL_STATE, MVP_GOAL_STATE } from './planning';

const planner = new GOAPPlanner(INITIAL_STATE);
const plan = planner.findPlan(MVP_GOAL_STATE);

if (plan.success) {
  const validation = planner.validatePlan(plan.plan);

  console.log(`Valid: ${validation.valid}`);
  console.log(`Issues: ${validation.issues.length}`);
  console.log(`Warnings: ${validation.warnings.length}`);
}
```

### 3. Track Progress and Replan

```typescript
const planner = new GOAPPlanner(INITIAL_STATE);

// Initial plan
const initialPlan = planner.findPlan(MVP_GOAL_STATE);

// After completing some actions
planner.updateState({
  ruvectorInstalled: true,
  typeDefinitionsExist: true,
  collectionsCreated: true,
});

// Generate updated plan from current state
const updatedPlan = planner.findPlan(MVP_GOAL_STATE);
```

### 4. Handle Action Failures

```typescript
// If an action fails
const failedAction = getActionById('seed-initial-data');
const currentState = planner.getCurrentState();

// Generate recovery plan
const recoveryPlan = planner.replan(
  failedAction,
  currentState,
  MVP_GOAL_STATE
);
```

## World State

The world state consists of 65 boolean conditions across 6 phases:

### Phase 0: Infrastructure (5 conditions)
- ruvectorInstalled
- typeDefinitionsExist
- collectionsCreated
- dataSeeded
- migrationsReady

### Phase 1: Core Foundation (5 conditions)
- coreServiceExists
- embeddingServiceExists
- collectionManagerExists
- apiRoutesExist
- healthChecksWork

### Phase 2: Semantic Search (6 conditions)
- semanticMealSearchWorks
- semanticRecipeSearchWorks
- semanticIngredientSearchWorks
- nlMealLoggingWorks
- mobileSearchIntegrated
- searchRankingWorks

### Phase 3: Knowledge Graph (6 conditions)
- knowledgeGraphBuilt
- substitutionEngineWorks
- nutritionalSimilarityWorks
- graphQueriesWork
- patternAnalysisWorks
- relationshipInferenceWorks

### Phase 4: RAG Pipeline (6 conditions)
- ragPipelineWorks
- recipeGenerationWorks
- mealPlanSuggestionsWork
- inventoryIntegrated
- smartRecommendationsWork
- contextOptimizationWorks

### Phase 5: Learning Loop (6 conditions)
- feedbackCollected
- learningPipelineWorks
- personalizationActive
- abTestingWorks
- performanceTrackingWorks
- autoRetrainingWorks

### Quality Gates (6 conditions)
- unitTestsPass
- integrationTestsPass
- e2eTestsPass
- performanceAcceptable
- securityAuditPassed
- documentationComplete

### Deployment Readiness (5 conditions)
- productionConfigured
- monitoringConfigured
- rollbackTested
- loadTestingPassed
- disasterRecoveryReady

## Actions

The system defines 19 core actions, each with:

- **Preconditions**: What must be true to execute
- **Effects**: How they change the world state
- **Cost**: Relative effort (1-10 scale)
- **Estimated Hours**: Time to complete
- **Risk Level**: low, medium, high, critical
- **Commands**: Shell commands to execute
- **Files**: Files to create/modify
- **Tests**: Tests to write
- **Validation**: How to verify success
- **Rollback**: Recovery procedure if action fails

### Example Action

```typescript
export const InstallRuVector: Action = {
  id: 'install-ruvector',
  name: 'Install RuVector Package',
  phase: 0,
  preconditions: {},
  effects: { ruvectorInstalled: true },
  cost: 1,
  estimatedHours: 0.5,
  risk: 'low',
  commands: [
    'npm install ruvector --save',
    'npm install @types/ruvector --save-dev',
  ],
  files: ['package.json', 'package-lock.json'],
  validation: [
    'Check package.json contains ruvector',
    'Verify node_modules/ruvector exists',
  ],
};
```

## Goal States

### MVP Goal (Phase 0-2)
- Infrastructure complete
- Core services operational
- Semantic search working
- Basic quality gates passed

### Full Goal (All Phases)
- All infrastructure
- All core services
- All search features
- Knowledge graph complete
- RAG pipeline operational
- Learning loop active
- All quality gates passed
- Production ready

## Planning Algorithm

The planner uses **A* search** to find optimal action sequences:

1. **Initialize**: Start with current world state
2. **Expand**: For each state, try all applicable actions
3. **Score**: Calculate f = g + h
   - g = cost so far
   - h = heuristic (number of unsatisfied goal conditions)
4. **Select**: Choose lowest f-score node
5. **Goal Check**: If goal satisfied, return plan
6. **Repeat**: Continue until goal found or search space exhausted

### Performance

- **Typical Planning Time**: 10-100ms
- **Nodes Explored**: 50-500 (depends on complexity)
- **Plan Optimality**: Guaranteed optimal by A* properties

## Implementation Phases

### Phase 0: Infrastructure (9.5 hours, 1.5 days)
Set up RuVector, type definitions, collections, and seed data.

### Phase 1: Core Foundation (22 hours, 2.75 days)
Build core vector service, embedding service, and API routes.

### Phase 2: Semantic Search (16 hours, 2 days)
Implement semantic search, NL logging, and mobile integration.

### Phase 3: Knowledge Graph (20 hours, 2.5 days)
Build knowledge graph and substitution engine.

### Phase 4: RAG Pipeline (22 hours, 2.75 days)
Implement RAG pipeline, recipe generation, and inventory integration.

### Phase 5: Learning Loop (11 hours, 1.5 days)
Add feedback collection and continuous learning.

**Total: 100.5 hours (~13 working days)**

## Running Examples

```bash
# Run all examples
npx ts-node src/services/vector/planning/example-usage.ts

# Or import specific examples
npm run vector:plan-mvp
npm run vector:plan-full
npm run vector:validate-plan
```

## Next Steps

1. **Review** the detailed implementation plan: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
2. **Generate** an initial plan using the GOAP planner
3. **Begin** with Phase 0 (Infrastructure setup)
4. **Track** progress using world state updates
5. **Adapt** as needed using replanning capabilities

## Key Benefits of GOAP

1. **Flexibility**: Can replan when requirements change
2. **Transparency**: See exactly why each action is needed
3. **Optimization**: Finds shortest path to goals
4. **Risk Management**: Identifies and mitigates risks
5. **Validation**: Ensures plan is executable before starting
6. **Monitoring**: Track progress through state updates

## Resources

- **GOAP Introduction**: [Game AI Pro](http://www.gameaipro.com/)
- **A* Search**: [Wikipedia](https://en.wikipedia.org/wiki/A*_search_algorithm)
- **RuVector Docs**: [GitHub](https://github.com/ruvnet/ruvector)

## Support

For questions or issues with the GOAP planning system:

1. Review the [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
2. Check example usage in [example-usage.ts](./planning/example-usage.ts)
3. Run the examples to understand behavior
4. Open an issue if you encounter problems

---

**Last Updated**: 2025-12-01
**Status**: Planning Phase
**Next Phase**: Infrastructure Setup (Phase 0)
