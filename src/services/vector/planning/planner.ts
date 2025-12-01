/**
 * GOAP Planner Implementation
 *
 * Uses A* search algorithm to find optimal action sequences
 * that transform the current world state into the goal state.
 *
 * The planner is adaptive and can replan when actions fail
 * or when the world state changes unexpectedly.
 */

import type { WorldState } from './world-state';
import {
  calculateStateDistance,
  isGoalSatisfied,
} from './world-state';
import type { Action } from './actions';
import {
  ALL_ACTIONS,
  arePreconditionsSatisfied,
} from './actions';

/**
 * A node in the search space
 */
interface SearchNode {
  /** Current state at this node */
  state: WorldState;

  /** Path of actions taken to reach this state */
  path: Action[];

  /** Total cost of path so far (g-score) */
  costSoFar: number;

  /** Estimated cost to goal (h-score) */
  estimatedCostToGoal: number;

  /** Total estimated cost (f-score = g + h) */
  totalEstimatedCost: number;

  /** Parent node in search tree */
  parent?: SearchNode;
}

/**
 * Result of planning operation
 */
export interface PlanningResult {
  /** Whether a plan was found */
  success: boolean;

  /** Ordered sequence of actions to execute */
  plan: Action[];

  /** Total estimated cost */
  totalCost: number;

  /** Total estimated time in hours */
  totalHours: number;

  /** Reason if planning failed */
  failureReason?: string;

  /** Number of nodes explored during search */
  nodesExplored: number;

  /** Time taken to plan in milliseconds */
  planningTimeMs: number;
}

/**
 * Result of plan validation
 */
export interface ValidationResult {
  /** Whether plan is valid */
  valid: boolean;

  /** Issues found during validation */
  issues: string[];

  /** Warnings (non-blocking) */
  warnings: string[];

  /** Dependencies between actions */
  dependencies: Map<string, string[]>;
}

/**
 * Result of plan execution
 */
export interface ExecutionResult {
  /** Whether execution completed successfully */
  success: boolean;

  /** Actions that were executed successfully */
  executedActions: Action[];

  /** Action that failed (if any) */
  failedAction?: Action;

  /** Error message if execution failed */
  error?: string;

  /** Final world state after execution */
  finalState: WorldState;

  /** Execution logs */
  logs: string[];
}

/**
 * GOAP Planner class
 */
export class GOAPPlanner {
  private currentState: WorldState;
  private availableActions: Action[];

  constructor(initialState: WorldState, actions: Action[] = ALL_ACTIONS) {
    this.currentState = { ...initialState };
    this.availableActions = actions;
  }

  /**
   * Find an optimal plan using A* search
   */
  findPlan(goalState: Partial<WorldState>): PlanningResult {
    const startTime = Date.now();
    let nodesExplored = 0;

    // Check if goal is already satisfied
    if (isGoalSatisfied(this.currentState, goalState)) {
      return {
        success: true,
        plan: [],
        totalCost: 0,
        totalHours: 0,
        nodesExplored: 0,
        planningTimeMs: Date.now() - startTime,
      };
    }

    // Initialize search with starting node
    const startNode: SearchNode = {
      state: { ...this.currentState },
      path: [],
      costSoFar: 0,
      estimatedCostToGoal: calculateStateDistance(this.currentState, goalState),
      totalEstimatedCost: 0,
    };
    startNode.totalEstimatedCost = startNode.costSoFar + startNode.estimatedCostToGoal;

    // Priority queue (open set) - ordered by f-score
    const openSet: SearchNode[] = [startNode];

    // Closed set (visited states)
    const closedSet = new Set<string>();

    // A* search loop
    while (openSet.length > 0) {
      nodesExplored++;

      // Get node with lowest f-score
      openSet.sort((a, b) => a.totalEstimatedCost - b.totalEstimatedCost);
      const currentNode = openSet.shift()!;

      // Check if we reached the goal
      if (isGoalSatisfied(currentNode.state, goalState)) {
        return {
          success: true,
          plan: currentNode.path,
          totalCost: currentNode.costSoFar,
          totalHours: currentNode.path.reduce((sum, a) => sum + a.estimatedHours, 0),
          nodesExplored,
          planningTimeMs: Date.now() - startTime,
        };
      }

      // Mark as visited
      const stateKey = this.getStateKey(currentNode.state);
      if (closedSet.has(stateKey)) {
        continue;
      }
      closedSet.add(stateKey);

      // Explore neighbors (possible actions)
      for (const action of this.availableActions) {
        // Check if action is applicable in current state
        if (!arePreconditionsSatisfied(action, currentNode.state)) {
          continue;
        }

        // Apply action to get new state
        const newState = this.applyAction(currentNode.state, action);
        const newStateKey = this.getStateKey(newState);

        // Skip if already visited
        if (closedSet.has(newStateKey)) {
          continue;
        }

        // Create new node
        const newNode: SearchNode = {
          state: newState,
          path: [...currentNode.path, action],
          costSoFar: currentNode.costSoFar + action.cost,
          estimatedCostToGoal: calculateStateDistance(newState, goalState),
          totalEstimatedCost: 0,
          parent: currentNode,
        };
        newNode.totalEstimatedCost = newNode.costSoFar + newNode.estimatedCostToGoal;

        // Add to open set
        openSet.push(newNode);
      }

      // Safety check: prevent infinite loops
      if (nodesExplored > 10000) {
        return {
          success: false,
          plan: [],
          totalCost: 0,
          totalHours: 0,
          failureReason: 'Search space too large (>10000 nodes explored)',
          nodesExplored,
          planningTimeMs: Date.now() - startTime,
        };
      }
    }

    // No plan found
    return {
      success: false,
      plan: [],
      totalCost: 0,
      totalHours: 0,
      failureReason: 'No valid plan found to reach goal state',
      nodesExplored,
      planningTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Validate a plan before execution
   */
  validatePlan(plan: Action[]): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const dependencies = new Map<string, string[]>();

    // Check if plan is empty
    if (plan.length === 0) {
      issues.push('Plan is empty');
      return { valid: false, issues, warnings, dependencies };
    }

    // Simulate execution to check preconditions
    let simulatedState = { ...this.currentState };

    for (let i = 0; i < plan.length; i++) {
      const action = plan[i];

      // Check preconditions
      if (!arePreconditionsSatisfied(action, simulatedState)) {
        issues.push(
          `Action "${action.name}" at position ${i} has unsatisfied preconditions`
        );

        // Find which preconditions are not met
        const unmet = Object.entries(action.preconditions)
          .filter(([key, value]) => simulatedState[key as keyof WorldState] !== value)
          .map(([key]) => key);

        issues.push(`  Unmet preconditions: ${unmet.join(', ')}`);
      }

      // Track dependencies
      const actionDeps: string[] = [];
      for (let j = 0; j < i; j++) {
        const earlierAction = plan[j];
        // Check if earlier action's effects satisfy this action's preconditions
        const satisfies = Object.entries(action.preconditions).some(([key, value]) => {
          return earlierAction.effects[key as keyof WorldState] === value;
        });
        if (satisfies) {
          actionDeps.push(earlierAction.id);
        }
      }
      dependencies.set(action.id, actionDeps);

      // Check for risk
      if (action.risk === 'high' || action.risk === 'critical') {
        warnings.push(
          `Action "${action.name}" at position ${i} is marked as ${action.risk} risk`
        );
      }

      // Apply effects for next iteration
      simulatedState = this.applyAction(simulatedState, action);
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      dependencies,
    };
  }

  /**
   * Execute a plan (simulation only - actual execution would be done elsewhere)
   */
  async executePlan(plan: Action[]): Promise<ExecutionResult> {
    const logs: string[] = [];
    const executedActions: Action[] = [];
    let currentState = { ...this.currentState };

    // Validate plan first
    const validation = this.validatePlan(plan);
    if (!validation.valid) {
      return {
        success: false,
        executedActions: [],
        error: `Plan validation failed: ${validation.issues.join(', ')}`,
        finalState: currentState,
        logs,
      };
    }

    // Execute each action
    for (const action of plan) {
      logs.push(`Executing: ${action.name}`);

      try {
        // Check preconditions one more time
        if (!arePreconditionsSatisfied(action, currentState)) {
          return {
            success: false,
            executedActions,
            failedAction: action,
            error: `Preconditions not satisfied for action: ${action.name}`,
            finalState: currentState,
            logs,
          };
        }

        // Simulate execution (in real implementation, this would execute commands)
        logs.push(`  Commands:`);
        for (const command of action.commands) {
          logs.push(`    - ${command}`);
        }

        // Apply effects
        currentState = this.applyAction(currentState, action);
        executedActions.push(action);

        logs.push(`  ✓ Success`);
        logs.push(`  State changes: ${JSON.stringify(action.effects)}`);

      } catch (error) {
        return {
          success: false,
          executedActions,
          failedAction: action,
          error: `Execution failed: ${error}`,
          finalState: currentState,
          logs,
        };
      }
    }

    return {
      success: true,
      executedActions,
      finalState: currentState,
      logs,
    };
  }

  /**
   * Replan when an action fails
   */
  replan(
    _failedAction: Action,
    currentState: WorldState,
    goalState: Partial<WorldState>
  ): PlanningResult {
    // Update current state
    this.currentState = { ...currentState };

    // Try to find alternative plan
    // Note: In a more sophisticated implementation, we could use failedAction
    // to avoid planning with that action again, or to adjust weights
    return this.findPlan(goalState);
  }

  /**
   * Get a summary of the plan
   */
  getPlanSummary(plan: Action[]): string {
    if (plan.length === 0) {
      return 'No actions in plan';
    }

    const totalCost = plan.reduce((sum, a) => sum + a.cost, 0);
    const totalHours = plan.reduce((sum, a) => sum + a.estimatedHours, 0);
    const phaseBreakdown = this.getPhaseBreakdown(plan);

    let summary = '=== PLAN SUMMARY ===\n\n';
    summary += `Total Actions: ${plan.length}\n`;
    summary += `Total Cost: ${totalCost}\n`;
    summary += `Total Estimated Hours: ${totalHours.toFixed(1)}\n`;
    summary += `Estimated Days (8h/day): ${(totalHours / 8).toFixed(1)}\n\n`;

    summary += 'Phase Breakdown:\n';
    for (const [phase, actions] of phaseBreakdown) {
      const phaseHours = actions.reduce((sum, a) => sum + a.estimatedHours, 0);
      summary += `  Phase ${phase}: ${actions.length} actions, ${phaseHours.toFixed(1)}h\n`;
    }

    summary += '\nActions:\n';
    for (let i = 0; i < plan.length; i++) {
      const action = plan[i];
      summary += `  ${i + 1}. [Phase ${action.phase}] ${action.name} (${action.estimatedHours}h, risk: ${action.risk})\n`;
    }

    return summary;
  }

  /**
   * Helper: Apply action effects to state
   */
  private applyAction(state: WorldState, action: Action): WorldState {
    return {
      ...state,
      ...action.effects,
    };
  }

  /**
   * Helper: Get unique key for state (for visited set)
   */
  private getStateKey(state: WorldState): string {
    // Create a sorted JSON string of true values
    const trueKeys = Object.entries(state)
      .filter(([_, value]) => value === true)
      .map(([key]) => key)
      .sort();
    return trueKeys.join(',');
  }

  /**
   * Helper: Get actions grouped by phase
   */
  private getPhaseBreakdown(plan: Action[]): Map<number, Action[]> {
    const breakdown = new Map<number, Action[]>();

    for (const action of plan) {
      const phase = action.phase;
      if (!breakdown.has(phase)) {
        breakdown.set(phase, []);
      }
      breakdown.get(phase)!.push(action);
    }

    return breakdown;
  }

  /**
   * Update current state (for adaptive replanning)
   */
  updateState(newState: Partial<WorldState>): void {
    this.currentState = {
      ...this.currentState,
      ...newState,
    };
  }

  /**
   * Get current state
   */
  getCurrentState(): WorldState {
    return { ...this.currentState };
  }

  /**
   * Generate plan visualization (dependency graph in Mermaid format)
   */
  generateDependencyGraph(plan: Action[]): string {
    let mermaid = 'graph TD\n';

    // Add nodes
    for (let i = 0; i < plan.length; i++) {
      const action = plan[i];
      mermaid += `  A${i}["${action.name}<br/>Phase ${action.phase}<br/>${action.estimatedHours}h"]\n`;
    }

    // Add edges based on preconditions/effects
    for (let i = 0; i < plan.length; i++) {
      const action = plan[i];

      // Find dependencies
      for (let j = 0; j < i; j++) {
        const earlierAction = plan[j];

        // Check if earlier action's effects satisfy this action's preconditions
        const satisfies = Object.entries(action.preconditions).some(([key, value]) => {
          return earlierAction.effects[key as keyof WorldState] === value;
        });

        if (satisfies) {
          mermaid += `  A${j} --> A${i}\n`;
        }
      }
    }

    return mermaid;
  }
}

/**
 * Convenience function to create a planner and find a plan
 */
export function createPlan(
  currentState: WorldState,
  goalState: Partial<WorldState>,
  actions?: Action[]
): PlanningResult {
  const planner = new GOAPPlanner(currentState, actions);
  return planner.findPlan(goalState);
}

/**
 * Create a planner for MVP goal
 */
export function createMVPPlanner(currentState: WorldState): GOAPPlanner {
  return new GOAPPlanner(currentState);
}
