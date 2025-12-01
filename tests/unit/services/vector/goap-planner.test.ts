/**
 * Unit Tests for GOAP Planner
 *
 * Tests the Goal-Oriented Action Planning system for RuVector integration.
 */

import {
  GOAPPlanner,
  INITIAL_STATE,
  MVP_GOAL_STATE,
  FULL_GOAL_STATE,
  createPlan,
  WorldState,
  isGoalSatisfied,
  calculateStateDistance,
  ALL_ACTIONS,
  getActionsByPhase,
  arePreconditionsSatisfied,
} from '../../../../src/services/vector/planning';

describe('GOAP Planner', () => {
  describe('WorldState', () => {
    it('should have all conditions false in INITIAL_STATE', () => {
      const allFalse = Object.values(INITIAL_STATE).every(v => v === false);
      expect(allFalse).toBe(true);
    });

    it('should calculate state distance correctly', () => {
      const goal = { ruvectorInstalled: true, typeDefinitionsExist: true };
      const distance = calculateStateDistance(INITIAL_STATE, goal);
      expect(distance).toBe(2); // 2 unsatisfied conditions
    });

    it('should check goal satisfaction correctly', () => {
      const state: WorldState = {
        ...INITIAL_STATE,
        ruvectorInstalled: true,
        typeDefinitionsExist: true,
      };

      const goal1 = { ruvectorInstalled: true };
      const goal2 = { ruvectorInstalled: true, typeDefinitionsExist: true };
      const goal3 = { ruvectorInstalled: true, collectionsCreated: true };

      expect(isGoalSatisfied(state, goal1)).toBe(true);
      expect(isGoalSatisfied(state, goal2)).toBe(true);
      expect(isGoalSatisfied(state, goal3)).toBe(false); // collectionsCreated is false
    });
  });

  describe('Actions', () => {
    it('should have all required properties', () => {
      ALL_ACTIONS.forEach(action => {
        expect(action).toHaveProperty('id');
        expect(action).toHaveProperty('name');
        expect(action).toHaveProperty('phase');
        expect(action).toHaveProperty('preconditions');
        expect(action).toHaveProperty('effects');
        expect(action).toHaveProperty('cost');
        expect(action).toHaveProperty('estimatedHours');
        expect(action).toHaveProperty('risk');
        expect(action).toHaveProperty('commands');
        expect(action).toHaveProperty('files');
        expect(action).toHaveProperty('validation');
      });
    });

    it('should have unique IDs', () => {
      const ids = ALL_ACTIONS.map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should group actions by phase correctly', () => {
      const phase0 = getActionsByPhase(0);
      const phase1 = getActionsByPhase(1);

      expect(phase0.length).toBeGreaterThan(0);
      expect(phase1.length).toBeGreaterThan(0);

      phase0.forEach(action => expect(action.phase).toBe(0));
      phase1.forEach(action => expect(action.phase).toBe(1));
    });

    it('should check preconditions correctly', () => {
      const state: WorldState = {
        ...INITIAL_STATE,
        ruvectorInstalled: true,
      };

      const action1 = ALL_ACTIONS.find(a => a.id === 'install-ruvector')!;
      const action2 = ALL_ACTIONS.find(a => a.id === 'create-type-definitions')!;

      expect(arePreconditionsSatisfied(action1, INITIAL_STATE)).toBe(true); // no preconditions
      expect(arePreconditionsSatisfied(action2, INITIAL_STATE)).toBe(false); // needs ruvectorInstalled
      expect(arePreconditionsSatisfied(action2, state)).toBe(true); // preconditions met
    });
  });

  describe('Planner', () => {
    it('should find a plan to MVP goal', () => {
      const result = createPlan(INITIAL_STATE, MVP_GOAL_STATE);

      expect(result.success).toBe(true);
      expect(result.plan.length).toBeGreaterThan(0);
      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.totalHours).toBeGreaterThan(0);
    });

    it('should return empty plan if goal already satisfied', () => {
      const alreadySatisfied = { ruvectorInstalled: true };
      const state: WorldState = {
        ...INITIAL_STATE,
        ruvectorInstalled: true,
      };

      const planner = new GOAPPlanner(state);
      const result = planner.findPlan(alreadySatisfied);

      expect(result.success).toBe(true);
      expect(result.plan.length).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('should order actions respecting dependencies', () => {
      const result = createPlan(INITIAL_STATE, MVP_GOAL_STATE);

      if (result.success) {
        // Verify that InstallRuVector comes before CreateTypeDefinitions
        const installIndex = result.plan.findIndex(a => a.id === 'install-ruvector');
        const typeDefsIndex = result.plan.findIndex(a => a.id === 'create-type-definitions');

        expect(installIndex).toBeLessThan(typeDefsIndex);

        // Verify that CreateCollections comes after both
        const collectionsIndex = result.plan.findIndex(a => a.id === 'create-collections');
        expect(collectionsIndex).toBeGreaterThan(installIndex);
        expect(collectionsIndex).toBeGreaterThan(typeDefsIndex);
      }
    });

    it('should validate plans correctly', () => {
      const planner = new GOAPPlanner(INITIAL_STATE);
      const result = planner.findPlan(MVP_GOAL_STATE);

      if (result.success) {
        const validation = planner.validatePlan(result.plan);

        expect(validation).toHaveProperty('valid');
        expect(validation).toHaveProperty('issues');
        expect(validation).toHaveProperty('warnings');
        expect(validation).toHaveProperty('dependencies');

        expect(validation.valid).toBe(true);
        expect(validation.issues.length).toBe(0);
      }
    });

    it('should detect invalid plans', () => {
      const planner = new GOAPPlanner(INITIAL_STATE);

      // Create invalid plan with wrong order
      const invalidPlan = [
        ALL_ACTIONS.find(a => a.id === 'create-collections')!, // needs prereqs
        ALL_ACTIONS.find(a => a.id === 'install-ruvector')!, // should come first
      ];

      const validation = planner.validatePlan(invalidPlan);

      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should generate plan summary', () => {
      const planner = new GOAPPlanner(INITIAL_STATE);
      const result = planner.findPlan(MVP_GOAL_STATE);

      if (result.success) {
        const summary = planner.getPlanSummary(result.plan);

        expect(summary).toContain('PLAN SUMMARY');
        expect(summary).toContain('Total Actions');
        expect(summary).toContain('Total Cost');
        expect(summary).toContain('Phase Breakdown');
      }
    });

    it('should generate dependency graph', () => {
      const planner = new GOAPPlanner(INITIAL_STATE);
      const result = planner.findPlan(MVP_GOAL_STATE);

      if (result.success) {
        const graph = planner.generateDependencyGraph(result.plan);

        expect(graph).toContain('graph TD');
        expect(graph).toContain('-->'); // dependency arrows
      }
    });

    it('should support replanning after state updates', () => {
      const planner = new GOAPPlanner(INITIAL_STATE);

      // Initial plan
      const initialPlan = planner.findPlan(MVP_GOAL_STATE);
      const initialLength = initialPlan.plan.length;

      // Update state (simulate completing some actions)
      planner.updateState({
        ruvectorInstalled: true,
        typeDefinitionsExist: true,
        collectionsCreated: true,
      });

      // Replan
      const updatedPlan = planner.findPlan(MVP_GOAL_STATE);

      expect(updatedPlan.success).toBe(true);
      expect(updatedPlan.plan.length).toBeLessThan(initialLength); // fewer actions needed
    });

    it('should handle replan after action failure', () => {
      const planner = new GOAPPlanner(INITIAL_STATE);
      const initialPlan = planner.findPlan(MVP_GOAL_STATE);

      if (initialPlan.success && initialPlan.plan.length > 2) {
        // Simulate: first 2 actions succeeded
        const completedActions = initialPlan.plan.slice(0, 2);
        let newState = { ...INITIAL_STATE };

        completedActions.forEach(action => {
          newState = { ...newState, ...action.effects };
        });

        // Update planner state
        planner.updateState(newState);

        // Third action failed - replan
        const failedAction = initialPlan.plan[2];
        const recoveryPlan = planner.replan(failedAction, newState, MVP_GOAL_STATE);

        expect(recoveryPlan.success).toBe(true);
        expect(recoveryPlan.plan.length).toBeLessThan(initialPlan.plan.length);
      }
    });

    it('should find plan to full goal', () => {
      const result = createPlan(INITIAL_STATE, FULL_GOAL_STATE);

      expect(result.success).toBe(true);
      expect(result.plan.length).toBeGreaterThan(0);

      // Full plan should have more actions than MVP plan
      const mvpPlan = createPlan(INITIAL_STATE, MVP_GOAL_STATE);
      expect(result.plan.length).toBeGreaterThan(mvpPlan.plan.length);
    });

    it('should respect phase ordering', () => {
      const result = createPlan(INITIAL_STATE, MVP_GOAL_STATE);

      if (result.success) {
        // Check that phases are generally increasing (some overlap is ok)
        let currentPhase = 0;
        let phaseViolations = 0;

        result.plan.forEach((action, index) => {
          if (action.phase < currentPhase - 1) {
            phaseViolations++;
          }
          currentPhase = Math.max(currentPhase, action.phase);
        });

        // Allow some flexibility but not too many violations
        expect(phaseViolations).toBeLessThan(3);
      }
    });

    it('should handle impossible goals gracefully', () => {
      // Goal that requires circular dependencies (impossible)
      const impossibleGoal = {
        ruvectorInstalled: true,
        coreServiceExists: true,
        embeddingServiceExists: true,
        knowledgeGraphBuilt: true,
        ragPipelineWorks: true,
        learningPipelineWorks: true,
        // But also require that ruvector is NOT installed
        // (This is logically impossible, but let's test the planner's robustness)
      };

      // The planner should still try to find a plan
      // (it won't fail due to logical impossibility since we don't have NOT conditions)
      const result = createPlan(INITIAL_STATE, impossibleGoal);

      // Should either succeed or fail gracefully
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('plan');
    });
  });

  describe('Performance', () => {
    it('should plan in reasonable time for MVP goal', () => {
      const startTime = Date.now();
      const result = createPlan(INITIAL_STATE, MVP_GOAL_STATE);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // < 1 second
    });

    it('should plan in reasonable time for full goal', () => {
      const startTime = Date.now();
      const result = createPlan(INITIAL_STATE, FULL_GOAL_STATE);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // < 2 seconds
    });

    it('should explore reasonable number of nodes', () => {
      const result = createPlan(INITIAL_STATE, MVP_GOAL_STATE);

      expect(result.success).toBe(true);
      expect(result.nodesExplored).toBeLessThan(1000); // shouldn't need to explore too many
    });
  });

  describe('Cost Estimation', () => {
    it('should estimate reasonable costs', () => {
      const result = createPlan(INITIAL_STATE, MVP_GOAL_STATE);

      if (result.success) {
        expect(result.totalCost).toBeGreaterThan(0);
        expect(result.totalCost).toBeLessThan(1000); // reasonable upper bound
      }
    });

    it('should estimate reasonable hours', () => {
      const result = createPlan(INITIAL_STATE, MVP_GOAL_STATE);

      if (result.success) {
        expect(result.totalHours).toBeGreaterThan(0);
        expect(result.totalHours).toBeLessThan(200); // < 200 hours seems reasonable
      }
    });

    it('should have consistent cost and hours', () => {
      const result = createPlan(INITIAL_STATE, MVP_GOAL_STATE);

      if (result.success) {
        // Total cost should roughly correlate with total hours
        // (actions with higher hours should generally have higher cost)
        const manualCost = result.plan.reduce((sum, a) => sum + a.cost, 0);
        const manualHours = result.plan.reduce((sum, a) => sum + a.estimatedHours, 0);

        expect(result.totalCost).toBe(manualCost);
        expect(result.totalHours).toBeCloseTo(manualHours, 1);
      }
    });
  });
});
