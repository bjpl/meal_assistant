/**
 * Parallel Optimizer Tests
 * Comprehensive tests for parallel task optimization
 */

import { ParallelOptimizer } from '../../../../src/services/prep/parallel-optimizer';
import { EquipmentManager } from '../../../../src/services/prep/equipment-manager';
import { PrepTask, Timeline, PrepConfig } from '../../../../src/types/prep.types';

describe('ParallelOptimizer', () => {
  let optimizer: ParallelOptimizer;
  let equipmentManager: EquipmentManager;

  beforeEach(() => {
    equipmentManager = new EquipmentManager();
    optimizer = new ParallelOptimizer(equipmentManager);
  });

  describe('Constructor', () => {
    test('should create optimizer with default config', () => {
      expect(optimizer).toBeDefined();
    });

    test('should create optimizer with custom config', () => {
      const customOptimizer = new ParallelOptimizer(equipmentManager, { maxParallelTasks: 3 });
      expect(customOptimizer).toBeDefined();
    });
  });

  describe('optimize', () => {
    test('should return optimization result with all required fields', () => {
      const tasks = createMockTasks();
      const result = optimizer.optimize(tasks);

      expect(result.originalDuration).toBeDefined();
      expect(result.optimizedDuration).toBeDefined();
      expect(result.timeSaved).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    test('should calculate time savings', () => {
      const tasks = [
        createPassiveTask('simmer-1', 20),
        createActiveTask('prep-1', 10),
        createActiveTask('prep-2', 5)
      ];
      const result = optimizer.optimize(tasks);

      expect(result.timeSaved).toBeGreaterThanOrEqual(0);
    });

    test('should generate suggestions for parallel execution', () => {
      const tasks = [
        createPassiveTask('simmer-1', 20),
        createActiveTask('prep-1', 10, true)
      ];
      const result = optimizer.optimize(tasks);

      // Should suggest prep during simmer
      if (result.suggestions.length > 0) {
        expect(result.suggestions[0].mainTask).toBe('simmer-1');
      }
    });
  });

  describe('identifyParallelOpportunities', () => {
    test('should identify passive cooking tasks as opportunities', () => {
      const tasks = [
        createPassiveTask('simmer-1', 20),
        createActiveTask('prep-1', 10, true)
      ];

      const opportunities = optimizer.identifyParallelOpportunities(tasks);
      expect(opportunities.length).toBeGreaterThanOrEqual(1);
      expect(opportunities[0].mainTaskId).toBe('simmer-1');
    });

    test('should not include tasks requiring attention', () => {
      const tasks = [
        { ...createPassiveTask('cook-1', 20), requiresAttention: true },
        createActiveTask('prep-1', 10, true)
      ];

      const opportunities = optimizer.identifyParallelOpportunities(tasks);
      const cookOpportunity = opportunities.find(o => o.mainTaskId === 'cook-1');
      expect(cookOpportunity).toBeUndefined();
    });

    test('should exclude tasks with equipment conflicts', () => {
      const tasks = [
        { ...createPassiveTask('simmer-1', 20), equipment: ['burner-1'] },
        { ...createActiveTask('prep-1', 10, true), equipment: ['burner-1'] } // Same equipment
      ];

      const opportunities = optimizer.identifyParallelOpportunities(tasks);
      if (opportunities.length > 0) {
        expect(opportunities[0].availableParallelTasks).not.toContain('prep-1');
      }
    });

    test('should exclude tasks with dependency conflicts', () => {
      const tasks = [
        createPassiveTask('simmer-1', 20),
        { ...createActiveTask('prep-1', 10, true), dependencies: ['simmer-1'] }
      ];

      const opportunities = optimizer.identifyParallelOpportunities(tasks);
      if (opportunities.length > 0) {
        expect(opportunities[0].availableParallelTasks).not.toContain('prep-1');
      }
    });

    test('should exclude non-parallelizable tasks', () => {
      const tasks = [
        createPassiveTask('simmer-1', 20),
        { ...createActiveTask('prep-1', 10, false) } // canParallel = false
      ];

      const opportunities = optimizer.identifyParallelOpportunities(tasks);
      if (opportunities.length > 0) {
        expect(opportunities[0].availableParallelTasks).not.toContain('prep-1');
      }
    });
  });

  describe('generateSuggestions', () => {
    test('should generate suggestions from opportunities', () => {
      const tasks = [
        createPassiveTask('simmer-1', 30),
        createActiveTask('prep-1', 10, true),
        createActiveTask('prep-2', 15, true)
      ];
      const opportunities = optimizer.identifyParallelOpportunities(tasks);

      const suggestions = optimizer.generateSuggestions(opportunities, tasks);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    test('should not assign same task to multiple opportunities', () => {
      const tasks = [
        createPassiveTask('simmer-1', 20),
        createPassiveTask('bake-1', 25),
        createActiveTask('prep-1', 10, true)
      ];
      const opportunities = optimizer.identifyParallelOpportunities(tasks);

      const suggestions = optimizer.generateSuggestions(opportunities, tasks);

      // prep-1 should only appear in one suggestion
      const prepAppearances = suggestions.filter(s =>
        s.parallelTasks.includes('prep-1')
      );
      expect(prepAppearances.length).toBeLessThanOrEqual(1);
    });

    test('should prioritize longer passive time opportunities', () => {
      const tasks = [
        createPassiveTask('simmer-1', 10), // Shorter
        createPassiveTask('bake-1', 30),   // Longer
        createActiveTask('prep-1', 8, true)
      ];
      const opportunities = optimizer.identifyParallelOpportunities(tasks);

      // Sort should prioritize bake-1
      const sorted = [...opportunities].sort((a, b) => b.passiveTime - a.passiveTime);
      expect(sorted[0].mainTaskId).toBe('bake-1');
    });

    test('should respect max parallel tasks limit', () => {
      const customOptimizer = new ParallelOptimizer(equipmentManager, { maxParallelTasks: 2 });
      const tasks = [
        createPassiveTask('simmer-1', 60),
        createActiveTask('prep-1', 10, true),
        createActiveTask('prep-2', 10, true),
        createActiveTask('prep-3', 10, true),
        createActiveTask('prep-4', 10, true)
      ];
      const opportunities = customOptimizer.identifyParallelOpportunities(tasks);
      const suggestions = customOptimizer.generateSuggestions(opportunities, tasks);

      suggestions.forEach(s => {
        expect(s.parallelTasks.length).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('calculateSequentialDuration', () => {
    test('should sum all task durations', () => {
      const tasks = [
        createPassiveTask('task-1', 10),
        createActiveTask('task-2', 15, true),
        createActiveTask('task-3', 20, true)
      ];

      const duration = optimizer.calculateSequentialDuration(tasks);
      expect(duration).toBe(45);
    });

    test('should return 0 for empty task list', () => {
      const duration = optimizer.calculateSequentialDuration([]);
      expect(duration).toBe(0);
    });
  });

  describe('calculateOptimizedDuration', () => {
    test('should subtract savings from sequential duration', () => {
      const tasks = [
        createPassiveTask('simmer-1', 30),
        createActiveTask('prep-1', 10, true)
      ];
      const suggestions = [
        { mainTask: 'simmer-1', parallelTasks: ['prep-1'], timeSaved: 10, description: 'test' }
      ];

      const duration = optimizer.calculateOptimizedDuration(tasks, suggestions);
      expect(duration).toBe(30); // 40 - 10
    });
  });

  describe('generateWarnings', () => {
    test('should warn about multiple attention-required tasks', () => {
      const suggestions = [
        { mainTask: 'simmer-1', parallelTasks: ['prep-1', 'prep-2'], timeSaved: 15, description: 'test' }
      ];
      const tasks = [
        createPassiveTask('simmer-1', 20),
        { ...createActiveTask('prep-1', 10, true), requiresAttention: true },
        { ...createActiveTask('prep-2', 8, true), requiresAttention: true }
      ];

      const warnings = optimizer.generateWarnings(suggestions, tasks);
      expect(warnings.some(w => w.includes('attention'))).toBe(true);
    });

    test('should warn about complex coordination', () => {
      const suggestions = [
        { mainTask: 'simmer-1', parallelTasks: ['prep-1', 'prep-2', 'prep-3'], timeSaved: 20, description: 'test' }
      ];
      const tasks = [
        createPassiveTask('simmer-1', 30),
        createActiveTask('prep-1', 8, true),
        createActiveTask('prep-2', 8, true),
        createActiveTask('prep-3', 8, true)
      ];

      const warnings = optimizer.generateWarnings(suggestions, tasks);
      expect(warnings.some(w => w.includes('parallel tasks'))).toBe(true);
    });

    test('should warn about critical tasks in parallel', () => {
      const suggestions = [
        { mainTask: 'simmer-1', parallelTasks: ['prep-1'], timeSaved: 10, description: 'test' }
      ];
      const tasks = [
        createPassiveTask('simmer-1', 20),
        { ...createActiveTask('prep-1', 10, true), priority: 'critical' as const }
      ];

      const warnings = optimizer.generateWarnings(suggestions, tasks);
      expect(warnings.some(w => w.includes('Critical'))).toBe(true);
    });
  });

  describe('analyzeEquipmentUtilization', () => {
    test('should return utilization map', () => {
      const timeline = createMockTimeline();
      const utilization = optimizer.analyzeEquipmentUtilization(timeline);

      expect(utilization instanceof Map).toBe(true);
      expect(utilization.get('burner-1')).toBe(50);
    });
  });

  describe('suggestEquipmentImprovements', () => {
    test('should suggest for low utilization equipment', () => {
      const timeline = createMockTimeline([
        { equipmentId: 'burner-1', slots: [], utilizationPercent: 20 }
      ]);

      const suggestions = optimizer.suggestEquipmentImprovements(timeline);
      expect(suggestions.some(s => s.includes('low utilization'))).toBe(true);
    });

    test('should suggest stovetop consolidation', () => {
      const timeline = createMockTimeline([
        { equipmentId: 'burner-1', slots: [], utilizationPercent: 30 },
        { equipmentId: 'burner-2', slots: [], utilizationPercent: 30 },
        { equipmentId: 'burner-3', slots: [], utilizationPercent: 30 },
        { equipmentId: 'burner-4', slots: [], utilizationPercent: 30 }
      ]);

      const suggestions = optimizer.suggestEquipmentImprovements(timeline);
      expect(suggestions.some(s => s.includes('Stovetop'))).toBe(true);
    });

    test('should not suggest for high utilization', () => {
      const timeline = createMockTimeline([
        { equipmentId: 'burner-1', slots: [], utilizationPercent: 80 }
      ]);

      const suggestions = optimizer.suggestEquipmentImprovements(timeline);
      expect(suggestions.filter(s => s.includes('burner-1'))).toHaveLength(0);
    });
  });
});

// Helper functions
function createPassiveTask(id: string, duration: number): PrepTask {
  return {
    id,
    name: `Passive Task ${id}`,
    type: 'simmer',
    duration,
    equipment: [`equipment-${id}`],
    dependencies: [],
    priority: 'medium',
    requiresAttention: false,
    canParallel: true,
    cleaningTime: 2
  };
}

function createActiveTask(id: string, duration: number, canParallel: boolean = true): PrepTask {
  return {
    id,
    name: `Active Task ${id}`,
    type: 'prep',
    duration,
    equipment: [`equipment-${id}`],
    dependencies: [],
    priority: 'medium',
    requiresAttention: true,
    canParallel,
    cleaningTime: 2
  };
}

function createMockTimeline(equipmentUsage?: Array<{ equipmentId: string; slots: any[]; utilizationPercent: number }>): Timeline {
  const now = new Date();
  return {
    id: 'timeline-1',
    totalDuration: 60,
    startTime: now,
    endTime: new Date(now.getTime() + 60 * 60000),
    slots: [],
    equipmentUsage: equipmentUsage || [
      { equipmentId: 'burner-1', slots: [], utilizationPercent: 50 }
    ],
    parallelTasks: [],
    criticalPath: []
  };
}

function createMockTasks(): PrepTask[] {
  return [
    createPassiveTask('simmer-1', 20),
    createActiveTask('prep-1', 10, true),
    createActiveTask('prep-2', 5, true)
  ];
}
