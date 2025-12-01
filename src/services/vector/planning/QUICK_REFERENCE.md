# GOAP Planner - Quick Reference Card

## 🚀 Quick Start (30 seconds)

```typescript
import { createPlan, INITIAL_STATE, MVP_GOAL_STATE } from '@/services/vector/planning';

const plan = createPlan(INITIAL_STATE, MVP_GOAL_STATE);
console.log(`${plan.plan.length} actions, ${plan.totalHours}h`);
```

## 📋 Common Operations

### Generate a Plan

```typescript
import { GOAPPlanner, INITIAL_STATE, MVP_GOAL_STATE } from '@/services/vector/planning';

const planner = new GOAPPlanner(INITIAL_STATE);
const result = planner.findPlan(MVP_GOAL_STATE);

if (result.success) {
  console.log(`Found plan with ${result.plan.length} actions`);
  result.plan.forEach(action => console.log(`- ${action.name}`));
}
```

### Validate a Plan

```typescript
const validation = planner.validatePlan(result.plan);

if (!validation.valid) {
  console.log('Issues:', validation.issues);
}
console.log('Warnings:', validation.warnings);
```

### Track Progress

```typescript
// After completing actions
planner.updateState({
  ruvectorInstalled: true,
  typeDefinitionsExist: true,
});

// Get updated plan
const updated = planner.findPlan(MVP_GOAL_STATE);
```

### Handle Failures

```typescript
const failedAction = result.plan[3];
const currentState = planner.getCurrentState();

const recovery = planner.replan(failedAction, currentState, MVP_GOAL_STATE);
```

### Generate Summary

```typescript
const summary = planner.getPlanSummary(result.plan);
console.log(summary);
```

### Generate Dependency Graph

```typescript
const graph = planner.generateDependencyGraph(result.plan);
console.log(graph); // Mermaid format
```

## 🎯 Goal States

### MVP Goal (Phase 0-2)
```typescript
import { MVP_GOAL_STATE } from '@/services/vector/planning';
const plan = createPlan(INITIAL_STATE, MVP_GOAL_STATE);
// 47.5 hours, ~6 days
```

### Full Goal (Phase 0-5)
```typescript
import { FULL_GOAL_STATE } from '@/services/vector/planning';
const plan = createPlan(INITIAL_STATE, FULL_GOAL_STATE);
// 100.5 hours, ~13 days
```

### Custom Goal
```typescript
const customGoal = {
  ruvectorInstalled: true,
  coreServiceExists: true,
  semanticMealSearchWorks: true,
};
const plan = createPlan(INITIAL_STATE, customGoal);
```

## 📊 State Queries

### Check Goal Satisfaction

```typescript
import { isGoalSatisfied } from '@/services/vector/planning';

const satisfied = isGoalSatisfied(currentState, goalState);
```

### Calculate Distance to Goal

```typescript
import { calculateStateDistance } from '@/services/vector/planning';

const distance = calculateStateDistance(currentState, goalState);
console.log(`${distance} conditions remaining`);
```

### Get State Changes

```typescript
import { getStateDiff } from '@/services/vector/planning';

const changes = getStateDiff(oldState, newState);
console.log('Changed:', changes);
```

## 🔧 Action Queries

### Get All Actions

```typescript
import { ALL_ACTIONS } from '@/services/vector/planning';

console.log(`${ALL_ACTIONS.length} total actions`);
```

### Get Actions by Phase

```typescript
import { getActionsByPhase } from '@/services/vector/planning';

const phase0 = getActionsByPhase(0);
console.log(`Phase 0: ${phase0.length} actions`);
```

### Get Specific Action

```typescript
import { getActionById } from '@/services/vector/planning';

const action = getActionById('install-ruvector');
console.log(action.name, action.estimatedHours);
```

### Check Preconditions

```typescript
import { arePreconditionsSatisfied } from '@/services/vector/planning';

const canExecute = arePreconditionsSatisfied(action, currentState);
```

## 📈 Planning Results

### Result Object

```typescript
interface PlanningResult {
  success: boolean;
  plan: Action[];
  totalCost: number;
  totalHours: number;
  nodesExplored: number;
  planningTimeMs: number;
  failureReason?: string;
}
```

### Validation Result

```typescript
interface ValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
  dependencies: Map<string, string[]>;
}
```

## 🎨 Action Properties

```typescript
interface Action {
  id: string;
  name: string;
  description: string;
  phase: 0 | 1 | 2 | 3 | 4 | 5;
  preconditions: Partial<WorldState>;
  effects: Partial<WorldState>;
  cost: number;
  estimatedHours: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  commands: string[];
  files: string[];
  tests?: string[];
  docs?: string[];
  rollback?: string[];
  validation: string[];
}
```

## 📍 File Locations

```
src/services/vector/planning/
├── world-state.ts       # State definitions
├── actions.ts           # Action library
├── planner.ts           # GOAP planner
├── example-usage.ts     # Examples
└── index.ts             # Exports

src/services/vector/
├── IMPLEMENTATION_PLAN.md  # Detailed plan
└── README.md               # Full guide

tests/unit/services/vector/
└── goap-planner.test.ts    # Tests
```

## 🏃 Quick Examples

### Example 1: Generate and Execute
```typescript
const planner = new GOAPPlanner(INITIAL_STATE);
const plan = planner.findPlan(MVP_GOAL_STATE);

// Simulate execution
const execution = await planner.executePlan(plan.plan);

if (execution.success) {
  console.log('✓ All actions completed');
} else {
  console.log('✗ Failed at:', execution.failedAction?.name);
}
```

### Example 2: Progress Tracking
```typescript
let completed = 0;
for (const action of plan.plan) {
  console.log(`[${++completed}/${plan.plan.length}] ${action.name}`);
  // Execute action...
  planner.updateState(action.effects);
}
```

### Example 3: Incremental Goals
```typescript
// First goal: Get infrastructure ready
const infraGoal = {
  ruvectorInstalled: true,
  typeDefinitionsExist: true,
  collectionsCreated: true,
};
const infraPlan = planner.findPlan(infraGoal);

// After completing infra, plan next phase
planner.updateState(infraGoal);
const nextPlan = planner.findPlan(MVP_GOAL_STATE);
```

## ⏱️ Time Estimates

| Phase | Hours | Days (8h) |
|-------|-------|-----------|
| 0: Infrastructure | 9.5 | 1.5 |
| 1: Core | 22 | 2.75 |
| 2: Search | 16 | 2 |
| 3: Graph | 20 | 2.5 |
| 4: RAG | 22 | 2.75 |
| 5: Learning | 11 | 1.5 |
| **MVP (0-2)** | **47.5** | **6** |
| **Full (0-5)** | **100.5** | **13** |

## 💡 Tips

1. **Always validate** before executing
2. **Track progress** with state updates
3. **Use replanning** when actions fail
4. **Check dependencies** in validation
5. **Review warnings** for high-risk actions
6. **Test plans** before actual execution

## 🆘 Troubleshooting

### Plan Not Found
```typescript
if (!result.success) {
  console.log('Reason:', result.failureReason);
  console.log('Explored:', result.nodesExplored, 'nodes');
}
```

### Plan Invalid
```typescript
const validation = planner.validatePlan(plan);
if (!validation.valid) {
  validation.issues.forEach(issue => console.log('Issue:', issue));
}
```

### State Inconsistent
```typescript
const current = planner.getCurrentState();
console.log('Current state:', current);
console.log('Goal:', goalState);
console.log('Distance:', calculateStateDistance(current, goalState));
```

## 📞 Support

- **Full Documentation**: `src/services/vector/IMPLEMENTATION_PLAN.md`
- **Examples**: `src/services/vector/planning/example-usage.ts`
- **Tests**: `tests/unit/services/vector/goap-planner.test.ts`

---

**Last Updated**: 2025-12-01
**Version**: 1.0.0
