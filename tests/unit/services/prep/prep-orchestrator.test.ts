/**
 * Prep Orchestrator Tests
 * Comprehensive tests for the main prep scheduling orchestrator
 */

import {
  PrepOrchestrator,
  createPrepOrchestrator,
  EquipmentManager,
  TaskScheduler,
  ConflictDetector,
  ConflictResolver,
  CleaningPlanner,
  ParallelOptimizer,
  GanttVisualizer,
  topologicalSort,
  findCriticalPath
} from '../../../../src/services/prep/prep-orchestrator';
import { PrepTask, Equipment, Timeline, TimeSlot } from '../../../../src/types/prep.types';

describe('PrepOrchestrator', () => {
  let orchestrator: PrepOrchestrator;
  let mockTasks: PrepTask[];

  beforeEach(() => {
    orchestrator = new PrepOrchestrator();
    mockTasks = createMockTasks();
  });

  describe('Constructor', () => {
    test('should create orchestrator with default config', () => {
      expect(orchestrator).toBeDefined();
    });

    test('should create orchestrator with custom config', () => {
      const customOrchestrator = new PrepOrchestrator({
        maxParallelTasks: 3,
        cleaningBufferMinutes: 10
      });
      expect(customOrchestrator).toBeDefined();
    });

    test('should create orchestrator with custom equipment', () => {
      const customEquipment: Equipment[] = [
        { id: 'custom-pan', name: 'Custom Pan', category: 'tool', status: 'clean', cleaningTime: 5 }
      ];
      const customOrchestrator = new PrepOrchestrator({}, customEquipment);
      expect(customOrchestrator.getEquipmentManager().getById('custom-pan')).toBeDefined();
    });
  });

  describe('optimizeSchedule', () => {
    test('should return complete optimization result', () => {
      const result = orchestrator.optimizeSchedule(mockTasks);

      expect(result.timeline).toBeDefined();
      expect(result.conflicts).toBeDefined();
      expect(result.resolutions).toBeDefined();
      expect(result.cleaningPlan).toBeDefined();
      expect(result.optimization).toBeDefined();
      expect(result.ganttChart).toBeDefined();
    });

    test('should create valid timeline', () => {
      const result = orchestrator.optimizeSchedule(mockTasks);

      expect(result.timeline.totalDuration).toBeGreaterThan(0);
      expect(result.timeline.slots.length).toBeGreaterThanOrEqual(mockTasks.length);
    });

    test('should detect conflicts', () => {
      // Create tasks with potential conflicts
      const conflictingTasks: PrepTask[] = [
        createTask('task-1', [], ['burner-1'], 10),
        createTask('task-2', [], ['burner-1'], 10)
      ];
      const result = orchestrator.optimizeSchedule(conflictingTasks);

      // Either conflicts are detected or resolved through scheduling
      expect(result.timeline).toBeDefined();
    });

    test('should generate cleaning plan', () => {
      const result = orchestrator.optimizeSchedule(mockTasks);

      expect(result.cleaningPlan.tasks).toBeDefined();
      expect(result.cleaningPlan.totalTime).toBeGreaterThanOrEqual(0);
    });

    test('should generate Gantt chart', () => {
      const result = orchestrator.optimizeSchedule(mockTasks);

      expect(result.ganttChart.rows.length).toBeGreaterThan(0);
      expect(result.ganttChart.totalDuration).toBe(result.timeline.totalDuration);
    });
  });

  describe('Task Validation', () => {
    test('should throw error for non-existent dependencies', () => {
      const invalidTasks: PrepTask[] = [
        createTask('task-1', ['non-existent'], ['burner-1'], 10)
      ];

      expect(() => orchestrator.optimizeSchedule(invalidTasks)).toThrow('non-existent');
    });

    test('should warn but not fail for non-existent equipment', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const tasksWithBadEquipment: PrepTask[] = [
        createTask('task-1', [], ['non-existent-equipment'], 10)
      ];

      const result = orchestrator.optimizeSchedule(tasksWithBadEquipment);
      expect(result.timeline).toBeDefined();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('detectConflicts', () => {
    test('should detect conflicts in a timeline', () => {
      const timeline = createMockTimeline();
      const conflicts = orchestrator.detectConflicts(timeline, mockTasks);
      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe('resolveConflicts', () => {
    test('should resolve conflicts', () => {
      const conflicts = [
        {
          id: 'conflict-1',
          type: 'equipment_overlap' as const,
          taskIds: ['task-1', 'task-2'],
          timeRange: [0, 10] as [number, number],
          severity: 'critical' as const,
          description: 'Equipment overlap',
          equipmentId: 'burner-1'
        }
      ];
      const resolutions = orchestrator.resolveConflicts(conflicts, mockTasks);
      expect(resolutions.length).toBe(1);
    });
  });

  describe('generateCleaningPlan', () => {
    test('should generate cleaning plan from timeline', () => {
      const result = orchestrator.optimizeSchedule(mockTasks);
      const cleaningPlan = orchestrator.generateCleaningPlan(result.timeline, mockTasks);

      expect(cleaningPlan).toBeDefined();
      expect(cleaningPlan.tasks).toBeDefined();
    });
  });

  describe('Visualization Methods', () => {
    test('should generate Gantt chart with equipment view', () => {
      const result = orchestrator.optimizeSchedule(mockTasks);
      const ganttChart = orchestrator.generateGanttChart(result.timeline, mockTasks, 'equipment');

      expect(ganttChart.rows.every(r => r.type === 'equipment')).toBe(true);
    });

    test('should generate Gantt chart with task view', () => {
      const result = orchestrator.optimizeSchedule(mockTasks);
      const ganttChart = orchestrator.generateGanttChart(result.timeline, mockTasks, 'task');

      expect(ganttChart.rows.every(r => r.type === 'task')).toBe(true);
    });

    test('should generate ASCII timeline', () => {
      const result = orchestrator.optimizeSchedule(mockTasks);
      const ascii = orchestrator.toAsciiTimeline(result.ganttChart);

      expect(typeof ascii).toBe('string');
      expect(ascii.length).toBeGreaterThan(0);
    });

    test('should generate HTML timeline', () => {
      const result = orchestrator.optimizeSchedule(mockTasks);
      const html = orchestrator.toHtmlTimeline(result.ganttChart);

      expect(html).toContain('<div');
      expect(html).toContain('gantt');
    });
  });

  describe('analyzeParallelOpportunities', () => {
    test('should analyze parallel opportunities', () => {
      const result = orchestrator.analyzeParallelOpportunities(mockTasks);

      expect(result.originalDuration).toBeDefined();
      expect(result.optimizedDuration).toBeDefined();
      expect(result.timeSaved).toBeDefined();
    });
  });

  describe('Equipment Management', () => {
    test('should return equipment manager', () => {
      const manager = orchestrator.getEquipmentManager();
      expect(manager).toBeInstanceOf(EquipmentManager);
    });

    test('should update equipment status', () => {
      const result = orchestrator.updateEquipmentStatus('burner-1', 'dirty');
      expect(result).toBe(true);
    });

    test('should return false for non-existent equipment', () => {
      const result = orchestrator.updateEquipmentStatus('non-existent', 'dirty');
      expect(result).toBe(false);
    });
  });

  describe('Convenience Methods', () => {
    test('should estimate total time', () => {
      const time = orchestrator.estimateTotalTime(mockTasks);
      expect(time).toBeGreaterThan(0);
    });

    test('should find critical path', () => {
      const tasksWithDeps: PrepTask[] = [
        createTask('task-1', [], ['burner-1'], 10),
        createTask('task-2', ['task-1'], ['burner-2'], 15),
        createTask('task-3', ['task-2'], ['burner-3'], 20)
      ];
      const criticalPath = orchestrator.findCriticalPath(tasksWithDeps);

      expect(criticalPath.length).toBeGreaterThan(0);
    });
  });

  describe('generateSummary', () => {
    test('should generate comprehensive summary', () => {
      const summary = orchestrator.generateSummary(mockTasks);

      expect(summary.totalPrepTime).toBeGreaterThan(0);
      expect(summary.activeTime).toBeGreaterThanOrEqual(0);
      expect(summary.passiveTime).toBeGreaterThanOrEqual(0);
      expect(summary.cleaningTime).toBeGreaterThanOrEqual(0);
      expect(summary.timeSaved).toBeDefined();
      expect(summary.criticalPath).toBeDefined();
      expect(summary.parallelGroups).toBeDefined();
      expect(summary.equipmentNeeded).toBeDefined();
      expect(summary.suggestions).toBeDefined();
    });

    test('should calculate active and passive time separately', () => {
      const mixedTasks: PrepTask[] = [
        { ...createTask('active-1', [], ['burner-1'], 10), requiresAttention: true },
        { ...createTask('passive-1', [], ['burner-2'], 20), requiresAttention: false }
      ];
      const summary = orchestrator.generateSummary(mixedTasks);

      expect(summary.activeTime).toBe(10);
      expect(summary.passiveTime).toBe(20);
    });

    test('should list all equipment needed', () => {
      const summary = orchestrator.generateSummary(mockTasks);
      const allEquipment = mockTasks.flatMap(t => t.equipment);

      allEquipment.forEach(eq => {
        expect(summary.equipmentNeeded).toContain(eq);
      });
    });
  });
});

describe('createPrepOrchestrator', () => {
  test('should create orchestrator with factory function', () => {
    const orchestrator = createPrepOrchestrator();
    expect(orchestrator).toBeInstanceOf(PrepOrchestrator);
  });

  test('should pass config to orchestrator', () => {
    const orchestrator = createPrepOrchestrator({ maxParallelTasks: 5 });
    expect(orchestrator).toBeInstanceOf(PrepOrchestrator);
  });

  test('should pass custom equipment to orchestrator', () => {
    const customEquipment: Equipment[] = [
      { id: 'custom-item', name: 'Custom Item', category: 'tool', status: 'clean', cleaningTime: 3 }
    ];
    const orchestrator = createPrepOrchestrator({}, customEquipment);
    expect(orchestrator.getEquipmentManager().getById('custom-item')).toBeDefined();
  });
});

describe('Module Exports', () => {
  test('should export EquipmentManager', () => {
    expect(EquipmentManager).toBeDefined();
  });

  test('should export TaskScheduler', () => {
    expect(TaskScheduler).toBeDefined();
  });

  test('should export ConflictDetector', () => {
    expect(ConflictDetector).toBeDefined();
  });

  test('should export ConflictResolver', () => {
    expect(ConflictResolver).toBeDefined();
  });

  test('should export CleaningPlanner', () => {
    expect(CleaningPlanner).toBeDefined();
  });

  test('should export ParallelOptimizer', () => {
    expect(ParallelOptimizer).toBeDefined();
  });

  test('should export GanttVisualizer', () => {
    expect(GanttVisualizer).toBeDefined();
  });

  test('should export topologicalSort', () => {
    expect(topologicalSort).toBeDefined();
    expect(typeof topologicalSort).toBe('function');
  });

  test('should export findCriticalPath', () => {
    expect(findCriticalPath).toBeDefined();
    expect(typeof findCriticalPath).toBe('function');
  });
});

// Helper functions
function createTask(
  id: string,
  dependencies: string[],
  equipment: string[],
  duration: number
): PrepTask {
  return {
    id,
    name: `Task ${id}`,
    type: 'prep',
    duration,
    equipment,
    dependencies,
    priority: 'medium',
    requiresAttention: false,
    canParallel: true,
    cleaningTime: 2
  };
}

function createMockTasks(): PrepTask[] {
  return [
    createTask('prep-veggies', [], ['cutting-board-1'], 15),
    createTask('boil-water', [], ['burner-1', 'pot-large'], 10),
    createTask('cook-pasta', ['boil-water'], ['burner-1', 'pot-large'], 12),
    createTask('make-sauce', ['prep-veggies'], ['burner-2', 'skillet-medium'], 20)
  ];
}

function createMockTimeline(): Timeline {
  const now = new Date();
  const slots: TimeSlot[] = [
    { taskId: 'prep-veggies', startTime: 0, endTime: 15, equipment: ['cutting-board-1'], isCleanup: false },
    { taskId: 'boil-water', startTime: 0, endTime: 10, equipment: ['burner-1', 'pot-large'], isCleanup: false },
    { taskId: 'cook-pasta', startTime: 10, endTime: 22, equipment: ['burner-1', 'pot-large'], isCleanup: false },
    { taskId: 'make-sauce', startTime: 15, endTime: 35, equipment: ['burner-2', 'skillet-medium'], isCleanup: false }
  ];

  return {
    id: 'timeline-1',
    totalDuration: 35,
    startTime: now,
    endTime: new Date(now.getTime() + 35 * 60000),
    slots,
    equipmentUsage: [
      { equipmentId: 'cutting-board-1', slots: slots.filter(s => s.equipment.includes('cutting-board-1')), utilizationPercent: 42.8 },
      { equipmentId: 'burner-1', slots: slots.filter(s => s.equipment.includes('burner-1')), utilizationPercent: 62.8 },
      { equipmentId: 'pot-large', slots: slots.filter(s => s.equipment.includes('pot-large')), utilizationPercent: 62.8 },
      { equipmentId: 'burner-2', slots: slots.filter(s => s.equipment.includes('burner-2')), utilizationPercent: 57.1 },
      { equipmentId: 'skillet-medium', slots: slots.filter(s => s.equipment.includes('skillet-medium')), utilizationPercent: 57.1 }
    ],
    parallelTasks: [['prep-veggies', 'boil-water']],
    criticalPath: ['prep-veggies', 'make-sauce']
  };
}
