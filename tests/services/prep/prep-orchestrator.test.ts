/**
 * Prep Orchestrator Tests
 * Comprehensive test suite for the prep scheduling system
 */

import {
  PrepOrchestrator,
  createPrepOrchestrator,
  EquipmentManager,
  TaskScheduler,
  topologicalSort,
  findCriticalPath,
  ConflictDetector,
  ConflictResolver,
  CleaningPlanner,
  ParallelOptimizer,
  GanttVisualizer,
  PrepTask,
  Timeline,
  DEFAULT_PREP_CONFIG
} from '../../../src/services/prep';

// ============================================================================
// Test Data
// ============================================================================

const createTestTasks = (): PrepTask[] => [
  {
    id: 'prep-vegetables',
    recipe: 'Stir Fry',
    name: 'Prep Vegetables',
    type: 'prep',
    equipment: ['cutting-board-1', 'counter-prep'],
    duration: 15,
    dependencies: [],
    canParallel: true,
    cleaningTime: 2,
    priority: 'high',
    requiresAttention: true
  },
  {
    id: 'cook-rice',
    recipe: 'Stir Fry',
    name: 'Cook Rice',
    type: 'cook',
    equipment: ['rice-cooker'],
    duration: 25,
    dependencies: [],
    canParallel: true,
    cleaningTime: 5,
    priority: 'high',
    requiresAttention: false
  },
  {
    id: 'prep-sauce',
    recipe: 'Stir Fry',
    name: 'Prep Sauce',
    type: 'prep',
    equipment: ['mixing-bowl-medium'],
    duration: 5,
    dependencies: [],
    canParallel: true,
    cleaningTime: 2,
    priority: 'medium',
    requiresAttention: true
  },
  {
    id: 'stir-fry',
    recipe: 'Stir Fry',
    name: 'Stir Fry Cooking',
    type: 'cook',
    equipment: ['wok', 'burner-1'],
    duration: 10,
    dependencies: ['prep-vegetables', 'prep-sauce'],
    canParallel: false,
    cleaningTime: 4,
    priority: 'critical',
    requiresAttention: true,
    temperature: 400
  },
  {
    id: 'plate',
    recipe: 'Stir Fry',
    name: 'Plate and Serve',
    type: 'assemble',
    equipment: ['counter-main'],
    duration: 3,
    dependencies: ['stir-fry', 'cook-rice'],
    canParallel: false,
    cleaningTime: 2,
    priority: 'medium',
    requiresAttention: true
  }
];

// ============================================================================
// Equipment Manager Tests
// ============================================================================

describe('EquipmentManager', () => {
  let manager: EquipmentManager;

  beforeEach(() => {
    manager = new EquipmentManager();
  });

  describe('inventory management', () => {
    test('should have default equipment', () => {
      const all = manager.getAll();
      expect(all.length).toBeGreaterThan(0);
    });

    test('should get equipment by ID', () => {
      const oven = manager.getById('oven');
      expect(oven).toBeDefined();
      expect(oven?.name).toBe('Oven');
    });

    test('should get equipment by category', () => {
      const stovetop = manager.getByCategory('stovetop');
      expect(stovetop.length).toBe(4); // 4 burners
    });
  });

  describe('status management', () => {
    test('should update equipment status', () => {
      expect(manager.markInUse('oven')).toBe(true);
      expect(manager.getById('oven')?.status).toBe('in_use');
    });

    test('should mark equipment dirty', () => {
      expect(manager.markDirty('pot-large')).toBe(true);
      expect(manager.getById('pot-large')?.status).toBe('dirty');
    });

    test('should get available equipment', () => {
      manager.markInUse('oven');
      const available = manager.getAvailable();
      expect(available.find(e => e.id === 'oven')).toBeUndefined();
    });
  });

  describe('alternatives', () => {
    test('should find alternative equipment', () => {
      manager.markDirty('instant-pot');
      const alt = manager.findAvailableAlternative('instant-pot');
      expect(alt?.id).toBe('dutch-oven');
    });
  });
});

// ============================================================================
// Task Scheduler Tests
// ============================================================================

describe('TaskScheduler', () => {
  let scheduler: TaskScheduler;
  let tasks: PrepTask[];

  beforeEach(() => {
    scheduler = new TaskScheduler();
    tasks = createTestTasks();
  });

  describe('topological sort', () => {
    test('should sort tasks respecting dependencies', () => {
      const sorted = topologicalSort(tasks);
      const ids = sorted.map(t => t.id);

      // prep-vegetables must come before stir-fry
      expect(ids.indexOf('prep-vegetables')).toBeLessThan(ids.indexOf('stir-fry'));

      // stir-fry and cook-rice must come before plate
      expect(ids.indexOf('stir-fry')).toBeLessThan(ids.indexOf('plate'));
      expect(ids.indexOf('cook-rice')).toBeLessThan(ids.indexOf('plate'));
    });

    test('should detect circular dependencies', () => {
      const circular: PrepTask[] = [
        { ...tasks[0], id: 'a', dependencies: ['b'] } as PrepTask,
        { ...tasks[0], id: 'b', dependencies: ['a'] } as PrepTask
      ];

      expect(() => topologicalSort(circular)).toThrow(/circular/i);
    });
  });

  describe('schedule creation', () => {
    test('should create a valid timeline', () => {
      const timeline = scheduler.createSchedule(tasks);

      expect(timeline.totalDuration).toBeGreaterThan(0);
      expect(timeline.slots.length).toBeGreaterThan(0);
    });

    test('should parallelize independent tasks', () => {
      const timeline = scheduler.createSchedule(tasks);

      // cook-rice should start at 0 since it has no dependencies
      const riceSlot = timeline.slots.find(s => s.taskId === 'cook-rice');
      expect(riceSlot?.startTime).toBe(0);
    });
  });

  describe('critical path', () => {
    test('should identify critical path', () => {
      const path = findCriticalPath(tasks);
      expect(path.length).toBeGreaterThan(0);

      // plate should be on critical path (end of chain)
      expect(path).toContain('plate');
    });
  });

  describe('time estimation', () => {
    test('should estimate total time', () => {
      const time = scheduler.estimateTotalTime(tasks);
      expect(time).toBeGreaterThan(0);
    });

    test('should calculate time savings from parallelization', () => {
      const savings = scheduler.calculateTimeSavings(tasks);
      expect(savings).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// Conflict Detector Tests
// ============================================================================

describe('ConflictDetector', () => {
  let detector: ConflictDetector;
  let equipmentManager: EquipmentManager;
  let tasks: PrepTask[];

  beforeEach(() => {
    equipmentManager = new EquipmentManager();
    detector = new ConflictDetector(equipmentManager);
    tasks = createTestTasks();
  });

  describe('equipment overlap detection', () => {
    test('should detect equipment conflicts', () => {
      // Create conflicting tasks using same equipment at same time
      const conflictingTasks: PrepTask[] = [
        { ...tasks[0], id: 'task1', equipment: ['burner-1'], dependencies: [] } as PrepTask,
        { ...tasks[0], id: 'task2', equipment: ['burner-1'], dependencies: [] } as PrepTask
      ];

      const scheduler = new TaskScheduler();
      const timeline = scheduler.createSchedule(conflictingTasks);
      const conflicts = detector.detectEquipmentOverlaps(timeline);

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].type).toBe('equipment_overlap');
    });
  });

  describe('dependency violation detection', () => {
    test('should detect dependency violations', () => {
      const scheduler = new TaskScheduler();
      const timeline = scheduler.createSchedule(tasks);

      // Manually create a violation by modifying timeline
      const violatedTimeline: Timeline = {
        ...timeline,
        slots: timeline.slots.map(s => {
          if (s.taskId === 'stir-fry') {
            return { ...s, startTime: 0, endTime: 10 }; // Start before deps
          }
          if (s.taskId === 'prep-vegetables') {
            return { ...s, startTime: 5, endTime: 20 }; // Ends after stir-fry
          }
          return s;
        })
      };

      const taskMap = new Map(tasks.map(t => [t.id, t]));
      const violations = detector.detectDependencyViolations(violatedTimeline, taskMap);

      expect(violations.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Conflict Resolver Tests
// ============================================================================

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;
  let equipmentManager: EquipmentManager;

  beforeEach(() => {
    equipmentManager = new EquipmentManager();
    resolver = new ConflictResolver(equipmentManager);
  });

  test('should resolve conflicts with substitution when possible', () => {
    const tasks = createTestTasks();
    const conflicts = [{
      id: 'conflict-1',
      type: 'equipment_overlap' as const,
      taskIds: ['task1', 'task2'],
      equipmentId: 'instant-pot',
      timeRange: [0, 30] as [number, number],
      severity: 'critical' as const,
      description: 'Test conflict'
    }];

    const resolutions = resolver.resolveAll(conflicts, tasks);
    expect(resolutions.length).toBe(1);
  });
});

// ============================================================================
// Cleaning Planner Tests
// ============================================================================

describe('CleaningPlanner', () => {
  let planner: CleaningPlanner;
  let equipmentManager: EquipmentManager;
  let tasks: PrepTask[];

  beforeEach(() => {
    equipmentManager = new EquipmentManager();
    planner = new CleaningPlanner(equipmentManager);
    tasks = createTestTasks();
  });

  describe('cleaning plan generation', () => {
    test('should generate cleaning tasks for used equipment', () => {
      const scheduler = new TaskScheduler();
      const timeline = scheduler.createSchedule(tasks);
      const plan = planner.generateCleaningPlan(timeline, tasks);

      expect(plan.tasks.length).toBeGreaterThan(0);
    });

    test('should optimize dishwasher loads', () => {
      const scheduler = new TaskScheduler();
      const timeline = scheduler.createSchedule(tasks);
      const plan = planner.generateCleaningPlan(timeline, tasks);

      // Should batch dishwasher-safe items
      expect(plan.dishwasherLoads).toBeDefined();
    });

    test('should identify clean-as-you-go opportunities', () => {
      const scheduler = new TaskScheduler();
      const timeline = scheduler.createSchedule(tasks);
      const plan = planner.generateCleaningPlan(timeline, tasks);

      expect(plan.cleanAsYouGoTasks).toBeDefined();
    });
  });
});

// ============================================================================
// Parallel Optimizer Tests
// ============================================================================

describe('ParallelOptimizer', () => {
  let optimizer: ParallelOptimizer;
  let equipmentManager: EquipmentManager;
  let tasks: PrepTask[];

  beforeEach(() => {
    equipmentManager = new EquipmentManager();
    optimizer = new ParallelOptimizer(equipmentManager);
    tasks = createTestTasks();
  });

  describe('optimization', () => {
    test('should identify parallel opportunities', () => {
      const result = optimizer.optimize(tasks);

      expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
      expect(result.originalDuration).toBeGreaterThan(0);
    });

    test('should calculate time saved', () => {
      const result = optimizer.optimize(tasks);

      expect(result.timeSaved).toBeGreaterThanOrEqual(0);
      expect(result.optimizedDuration).toBeLessThanOrEqual(result.originalDuration);
    });
  });
});

// ============================================================================
// Gantt Visualizer Tests
// ============================================================================

describe('GanttVisualizer', () => {
  let visualizer: GanttVisualizer;
  let tasks: PrepTask[];

  beforeEach(() => {
    visualizer = new GanttVisualizer();
    tasks = createTestTasks();
  });

  describe('chart generation', () => {
    test('should generate a valid Gantt chart', () => {
      const scheduler = new TaskScheduler();
      const timeline = scheduler.createSchedule(tasks);
      const chart = visualizer.generateChart(timeline, tasks);

      expect(chart.rows.length).toBeGreaterThan(0);
      expect(chart.totalDuration).toBeGreaterThan(0);
    });

    test('should generate ASCII visualization', () => {
      const scheduler = new TaskScheduler();
      const timeline = scheduler.createSchedule(tasks);
      const chart = visualizer.generateChart(timeline, tasks);
      const ascii = visualizer.toAscii(chart);

      expect(ascii.length).toBeGreaterThan(0);
      expect(ascii).toContain('Start');
    });

    test('should generate HTML visualization', () => {
      const scheduler = new TaskScheduler();
      const timeline = scheduler.createSchedule(tasks);
      const chart = visualizer.generateChart(timeline, tasks);
      const html = visualizer.toHtml(chart);

      expect(html).toContain('gantt-chart');
      expect(html).toContain('gantt-segment');
    });
  });
});

// ============================================================================
// Prep Orchestrator Integration Tests
// ============================================================================

describe('PrepOrchestrator', () => {
  let orchestrator: PrepOrchestrator;
  let tasks: PrepTask[];

  beforeEach(() => {
    orchestrator = createPrepOrchestrator();
    tasks = createTestTasks();
  });

  describe('full optimization', () => {
    test('should optimize a complete schedule', () => {
      const result = orchestrator.optimizeSchedule(tasks);

      expect(result.timeline).toBeDefined();
      expect(result.conflicts).toBeDefined();
      expect(result.resolutions).toBeDefined();
      expect(result.cleaningPlan).toBeDefined();
      expect(result.optimization).toBeDefined();
      expect(result.ganttChart).toBeDefined();
    });

    test('should generate a summary', () => {
      const summary = orchestrator.generateSummary(tasks);

      expect(summary.totalPrepTime).toBeGreaterThan(0);
      expect(summary.equipmentNeeded.length).toBeGreaterThan(0);
      expect(summary.criticalPath.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    test('should throw on invalid dependencies', () => {
      const invalidTasks: PrepTask[] = [
        { ...tasks[0], dependencies: ['non-existent'] } as PrepTask
      ];

      expect(() => orchestrator.optimizeSchedule(invalidTasks)).toThrow();
    });
  });

  describe('equipment management', () => {
    test('should provide access to equipment manager', () => {
      const manager = orchestrator.getEquipmentManager();
      expect(manager).toBeDefined();
      expect(manager.getAll().length).toBeGreaterThan(0);
    });

    test('should update equipment status', () => {
      expect(orchestrator.updateEquipmentStatus('oven', 'in_use')).toBe(true);
    });
  });
});

// ============================================================================
// Real-World Scenario Tests
// ============================================================================

describe('Real-World Scenarios', () => {
  let orchestrator: PrepOrchestrator;

  beforeEach(() => {
    orchestrator = createPrepOrchestrator();
  });

  test('should handle meal prep for multiple dishes', () => {
    const tasks: PrepTask[] = [
      // Dish 1: Roast Chicken
      {
        id: 'season-chicken',
        recipe: 'Roast Chicken',
        name: 'Season Chicken',
        type: 'prep',
        equipment: ['cutting-board-1', 'counter-prep'],
        duration: 10,
        dependencies: [],
        canParallel: true,
        cleaningTime: 3,
        priority: 'high',
        requiresAttention: true
      },
      {
        id: 'roast-chicken',
        recipe: 'Roast Chicken',
        name: 'Roast Chicken',
        type: 'bake',
        equipment: ['oven', 'sheet-pan-1'],
        duration: 60,
        dependencies: ['season-chicken'],
        canParallel: true,
        cleaningTime: 5,
        priority: 'high',
        requiresAttention: false,
        temperature: 425
      },
      {
        id: 'rest-chicken',
        recipe: 'Roast Chicken',
        name: 'Rest Chicken',
        type: 'rest',
        equipment: ['cutting-board-1'],
        duration: 10,
        dependencies: ['roast-chicken'],
        canParallel: true,
        cleaningTime: 2,
        priority: 'medium',
        requiresAttention: false
      },

      // Dish 2: Roasted Vegetables
      {
        id: 'prep-veggies',
        recipe: 'Roasted Vegetables',
        name: 'Prep Root Vegetables',
        type: 'prep',
        equipment: ['cutting-board-2', 'counter-main'],
        duration: 15,
        dependencies: [],
        canParallel: true,
        cleaningTime: 3,
        priority: 'medium',
        requiresAttention: true
      },
      {
        id: 'roast-veggies',
        recipe: 'Roasted Vegetables',
        name: 'Roast Vegetables',
        type: 'bake',
        equipment: ['oven', 'sheet-pan-2'],
        duration: 45,
        dependencies: ['prep-veggies', 'roast-chicken'], // Goes in after chicken
        canParallel: true,
        cleaningTime: 3,
        priority: 'medium',
        requiresAttention: false,
        temperature: 425
      },

      // Dish 3: Gravy
      {
        id: 'make-gravy',
        recipe: 'Gravy',
        name: 'Make Gravy',
        type: 'cook',
        equipment: ['pot-small', 'burner-1'],
        duration: 15,
        dependencies: ['rest-chicken'],
        canParallel: true,
        cleaningTime: 4,
        priority: 'high',
        requiresAttention: true
      }
    ];

    const result = orchestrator.optimizeSchedule(tasks);

    // Should complete within reasonable time (not sequential sum)
    const sequentialTime = tasks.reduce((sum, t) => sum + t.duration, 0);
    expect(result.timeline.totalDuration).toBeLessThan(sequentialTime);

    // Should have parallel groups (chicken roasts while veggies prep)
    expect(result.timeline.parallelTasks.length).toBeGreaterThan(0);

    // Should generate suggestions
    expect(result.optimization.suggestions.length).toBeGreaterThan(0);
  });
});
