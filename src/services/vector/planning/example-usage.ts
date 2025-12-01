/**
 * Example Usage of GOAP Planning System
 *
 * This file demonstrates how to use the GOAP planner to generate
 * implementation plans for RuVector integration.
 *
 * Run with: ts-node src/services/vector/planning/example-usage.ts
 */

import {
  GOAPPlanner,
  INITIAL_STATE,
  MVP_GOAL_STATE,
  FULL_GOAL_STATE,
  createPlan,
} from './index';

/**
 * Example 1: Generate MVP Plan
 */
function generateMVPPlan(): void {
  console.log('='.repeat(80));
  console.log('EXAMPLE 1: Generate MVP Implementation Plan');
  console.log('='.repeat(80));
  console.log();

  const result = createPlan(INITIAL_STATE, MVP_GOAL_STATE);

  if (result.success) {
    console.log('✓ Plan generated successfully!\n');
    console.log(`Total Actions: ${result.plan.length}`);
    console.log(`Total Cost: ${result.totalCost}`);
    console.log(`Total Time: ${result.totalHours.toFixed(1)} hours`);
    console.log(`Estimated Days: ${(result.totalHours / 8).toFixed(1)} days`);
    console.log(`Planning Time: ${result.planningTimeMs}ms`);
    console.log(`Nodes Explored: ${result.nodesExplored}`);
    console.log();

    console.log('Action Sequence:');
    console.log('─'.repeat(80));
    result.plan.forEach((action, index) => {
      console.log(
        `${index + 1}. [Phase ${action.phase}] ${action.name} ` +
        `(${action.estimatedHours}h, risk: ${action.risk})`
      );
    });
  } else {
    console.log('✗ Planning failed:', result.failureReason);
  }

  console.log();
}

/**
 * Example 2: Validate Plan
 */
function validatePlan(): void {
  console.log('='.repeat(80));
  console.log('EXAMPLE 2: Validate Generated Plan');
  console.log('='.repeat(80));
  console.log();

  const planner = new GOAPPlanner(INITIAL_STATE);
  const result = planner.findPlan(MVP_GOAL_STATE);

  if (result.success) {
    const validation = planner.validatePlan(result.plan);

    console.log(`Valid: ${validation.valid ? '✓' : '✗'}`);
    console.log();

    if (validation.issues.length > 0) {
      console.log('Issues:');
      validation.issues.forEach(issue => console.log(`  - ${issue}`));
      console.log();
    }

    if (validation.warnings.length > 0) {
      console.log('Warnings:');
      validation.warnings.forEach(warning => console.log(`  ⚠ ${warning}`));
      console.log();
    }

    console.log('Dependencies:');
    console.log('─'.repeat(80));
    validation.dependencies.forEach((deps, actionId) => {
      if (deps.length > 0) {
        console.log(`${actionId}:`);
        deps.forEach(dep => console.log(`  ← ${dep}`));
      }
    });
  }

  console.log();
}

/**
 * Example 3: Generate Dependency Graph
 */
function generateDependencyGraph(): void {
  console.log('='.repeat(80));
  console.log('EXAMPLE 3: Generate Dependency Graph (Mermaid)');
  console.log('='.repeat(80));
  console.log();

  const planner = new GOAPPlanner(INITIAL_STATE);
  const result = planner.findPlan(MVP_GOAL_STATE);

  if (result.success) {
    const graph = planner.generateDependencyGraph(result.plan);
    console.log(graph);
  }

  console.log();
}

/**
 * Example 4: Simulate Adaptive Replanning
 */
function demonstrateReplanning(): void {
  console.log('='.repeat(80));
  console.log('EXAMPLE 4: Adaptive Replanning (Action Failure)');
  console.log('='.repeat(80));
  console.log();

  const planner = new GOAPPlanner(INITIAL_STATE);

  // Generate initial plan
  const initialPlan = planner.findPlan(MVP_GOAL_STATE);
  console.log('Initial Plan:');
  console.log(`  Actions: ${initialPlan.plan.length}`);
  console.log(`  Total Hours: ${initialPlan.totalHours.toFixed(1)}h`);
  console.log();

  // Simulate partial execution: first 3 actions succeeded
  console.log('Simulating execution of first 3 actions...');
  planner.updateState({
    ruvectorInstalled: true,
    typeDefinitionsExist: true,
    collectionsCreated: true,
  });
  console.log('✓ Actions 1-3 completed successfully');
  console.log();

  // Simulate action 4 failure
  console.log('✗ Action 4 failed: Collection seeding error');
  console.log('Generating recovery plan...');
  console.log();

  // Replan from current state
  const recoveryPlan = planner.findPlan(MVP_GOAL_STATE);

  console.log('Recovery Plan:');
  console.log(`  Remaining Actions: ${recoveryPlan.plan.length}`);
  console.log(`  Remaining Hours: ${recoveryPlan.totalHours.toFixed(1)}h`);
  console.log();

  console.log('New Action Sequence:');
  console.log('─'.repeat(80));
  recoveryPlan.plan.forEach((action, index) => {
    console.log(
      `${index + 1}. [Phase ${action.phase}] ${action.name} ` +
      `(${action.estimatedHours}h, risk: ${action.risk})`
    );
  });

  console.log();
}

/**
 * Example 5: Compare MVP vs Full Implementation Plans
 */
function comparePlans(): void {
  console.log('='.repeat(80));
  console.log('EXAMPLE 5: Compare MVP vs Full Implementation');
  console.log('='.repeat(80));
  console.log();

  const mvpPlan = createPlan(INITIAL_STATE, MVP_GOAL_STATE);
  const fullPlan = createPlan(INITIAL_STATE, FULL_GOAL_STATE);

  console.log('MVP Plan:');
  console.log(`  Actions: ${mvpPlan.plan.length}`);
  console.log(`  Total Hours: ${mvpPlan.totalHours.toFixed(1)}h`);
  console.log(`  Estimated Days: ${(mvpPlan.totalHours / 8).toFixed(1)} days`);
  console.log(`  Total Cost: ${mvpPlan.totalCost}`);
  console.log();

  console.log('Full Implementation Plan:');
  console.log(`  Actions: ${fullPlan.plan.length}`);
  console.log(`  Total Hours: ${fullPlan.totalHours.toFixed(1)}h`);
  console.log(`  Estimated Days: ${(fullPlan.totalHours / 8).toFixed(1)} days`);
  console.log(`  Total Cost: ${fullPlan.totalCost}`);
  console.log();

  console.log('Difference:');
  console.log(`  Additional Actions: ${fullPlan.plan.length - mvpPlan.plan.length}`);
  console.log(`  Additional Hours: ${(fullPlan.totalHours - mvpPlan.totalHours).toFixed(1)}h`);
  console.log(`  Additional Days: ${((fullPlan.totalHours - mvpPlan.totalHours) / 8).toFixed(1)} days`);
  console.log();
}

/**
 * Example 6: Get Plan Summary
 */
function printPlanSummary(): void {
  console.log('='.repeat(80));
  console.log('EXAMPLE 6: Detailed Plan Summary');
  console.log('='.repeat(80));
  console.log();

  const planner = new GOAPPlanner(INITIAL_STATE);
  const result = planner.findPlan(MVP_GOAL_STATE);

  if (result.success) {
    console.log(planner.getPlanSummary(result.plan));
  }

  console.log();
}

/**
 * Main execution
 */
function main(): void {
  console.log();
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(78) + '║');
  console.log('║' + '  GOAP Planning System - RuVector Integration'.padEnd(78) + '║');
  console.log('║' + '  Example Usage and Demonstrations'.padEnd(78) + '║');
  console.log('║' + ' '.repeat(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log();

  // Run all examples
  generateMVPPlan();
  validatePlan();
  generateDependencyGraph();
  demonstrateReplanning();
  comparePlans();
  printPlanSummary();

  console.log('='.repeat(80));
  console.log('All examples completed!');
  console.log('='.repeat(80));
  console.log();

  console.log('Next Steps:');
  console.log('  1. Review the generated plan in IMPLEMENTATION_PLAN.md');
  console.log('  2. Begin with Phase 0 (Infrastructure setup)');
  console.log('  3. Use planner.updateState() to track progress');
  console.log('  4. Use planner.replan() if actions fail');
  console.log();
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export for use in other modules
export {
  generateMVPPlan,
  validatePlan,
  generateDependencyGraph,
  demonstrateReplanning,
  comparePlans,
  printPlanSummary,
};
