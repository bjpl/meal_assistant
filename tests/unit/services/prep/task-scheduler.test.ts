/**
 * Task Scheduler Tests
 * Comprehensive tests for task scheduling and topological sort
 */

import { TaskScheduler, topologicalSort, findCriticalPath } from '../../../../src/services/prep/task-scheduler';
import { PrepTask, PrepConfig } from '../../../../src/types/prep.types';

describe('topologicalSort', () => {
  test('should sort tasks with no dependencies', () => {
    const tasks = createMockTasks(['task-1', 'task-2', 'task-3']);
    const sorted = topologicalSort(tasks);

    expect(sorted).toHaveLength(3);
    // All tasks should be present
    expect(sorted.map(t => t.id)).toEqual(expect.arrayContaining(['task-1', 'task-2', 'task-3']));
  });

  test('should respect dependencies', () => {
    const tasks = [
      createMockTask('task-1', []),
      createMockTask('task-2', ['task-1']),
      createMockTask('task-3', ['task-2'])
    ];
    const sorted = topologicalSort(tasks);

    const indices = {
      'task-1': sorted.findIndex(t => t.id === 'task-1'),
      'task-2': sorted.findIndex(t => t.id === 'task-2'),
      'task-3': sorted.findIndex(t => t.id === 'task-3')
    };

    expect(indices['task-1']).toBeLessThan(indices['task-2']);
    expect(indices['task-2']).toBeLessThan(indices['task-3']);
  });

  test('should prioritize by task priority', () => {
    const tasks = [
      { ...createMockTask('task-1', []), priority: 'low' as const },
      { ...createMockTask('task-2', []), priority: 'critical' as const },
      { ...createMockTask('task-3', []), priority: 'high' as const }
    ];
    const sorted = topologicalSort(tasks);

    // Critical should come first, then high, then low
    expect(sorted[0].id).toBe('task-2');
    expect(sorted[1].id).toBe('task-3');
    expect(sorted[2].id).toBe('task-1');
  });

  test('should throw error for circular dependencies', () => {
    const tasks = [
      createMockTask('task-1', ['task-3']),
      createMockTask('task-2', ['task-1']),
      createMockTask('task-3', ['task-2'])
    ];

    expect(() => topologicalSort(tasks)).toThrow('Circular dependency');
  });

  test('should handle complex dependency graphs', () => {
    const tasks = [
      createMockTask('task-1', []),
      createMockTask('task-2', ['task-1']),
      createMockTask('task-3', ['task-1']),
      createMockTask('task-4', ['task-2', 'task-3']),
      createMockTask('task-5', ['task-4'])
    ];
    const sorted = topologicalSort(tasks);

    expect(sorted).toHaveLength(5);

    // Verify all dependencies are satisfied
    sorted.forEach((task, index) => {
      task.dependencies.forEach(depId => {
        const depIndex = sorted.findIndex(t => t.id === depId);
        expect(depIndex).toBeLessThan(index);
      });
    });
  });

  test('should handle empty task list', () => {
    const sorted = topologicalSort([]);
    expect(sorted).toHaveLength(0);
  });

  test('should handle single task', () => {
    const tasks = [createMockTask('task-1', [])];
    const sorted = topologicalSort(tasks);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe('task-1');
  });
});

describe('findCriticalPath', () => {
  test('should find critical path for linear dependencies', () => {
    const tasks = [
      { ...createMockTask('task-1', []), duration: 10 },
      { ...createMockTask('task-2', ['task-1']), duration: 15 },
      { ...createMockTask('task-3', ['task-2']), duration: 20 }
    ];
    const criticalPath = findCriticalPath(tasks);

    expect(criticalPath).toEqual(['task-1', 'task-2', 'task-3']);
  });

  test('should find longest path in parallel tasks', () => {
    const tasks = [
      { ...createMockTask('task-1', []), duration: 10 },
      { ...createMockTask('task-2', ['task-1']), duration: 30 }, // Longer path
      { ...createMockTask('task-3', ['task-1']), duration: 5 },  // Shorter path
      { ...createMockTask('task-4', ['task-2', 'task-3']), duration: 10 }
    ];
    const criticalPath = findCriticalPath(tasks);

    // Critical path should include task-2 (longer) not task-3
    expect(criticalPath).toContain('task-1');
    expect(criticalPath).toContain('task-2');
    expect(criticalPath).toContain('task-4');
  });

  test('should handle independent tasks', () => {
    const tasks = [
      { ...createMockTask('task-1', []), duration: 10 },
      { ...createMockTask('task-2', []), duration: 20 },
      { ...createMockTask('task-3', []), duration: 15 }
    ];
    const criticalPath = findCriticalPath(tasks);

    // Longest independent task
    expect(criticalPath).toContain('task-2');
  });

  test('should handle empty task list', () => {
    const criticalPath = findCriticalPath([]);
    expect(criticalPath).toHaveLength(0);
  });
});

describe('TaskScheduler', () => {
  let scheduler: TaskScheduler;

  beforeEach(() => {
    scheduler = new TaskScheduler();
  });

  describe('Constructor', () => {
    test('should create scheduler with default config', () => {
      expect(scheduler).toBeDefined();
    });

    test('should create scheduler with custom config', () => {
      const customScheduler = new TaskScheduler({ cleaningBufferMinutes: 10 });
      expect(customScheduler).toBeDefined();
    });
  });

  describe('createSchedule', () => {
    test('should create timeline with slots', () => {
      const tasks = [
        createMockTask('task-1', []),
        createMockTask('task-2', ['task-1'])
      ];
      const timeline = scheduler.createSchedule(tasks);

      expect(timeline.slots.length).toBeGreaterThanOrEqual(2);
      expect(timeline.totalDuration).toBeGreaterThan(0);
    });

    test('should schedule tasks respecting dependencies', () => {
      const tasks = [
        { ...createMockTask('task-1', []), duration: 10 },
        { ...createMockTask('task-2', ['task-1']), duration: 15 }
      ];
      const timeline = scheduler.createSchedule(tasks);

      const slot1 = timeline.slots.find(s => s.taskId === 'task-1');
      const slot2 = timeline.slots.find(s => s.taskId === 'task-2');

      expect(slot1).toBeDefined();
      expect(slot2).toBeDefined();
      expect(slot2!.startTime).toBeGreaterThanOrEqual(slot1!.endTime);
    });

    test('should track equipment usage', () => {
      const tasks = [
        { ...createMockTask('task-1', []), equipment: ['burner-1'] }
      ];
      const timeline = scheduler.createSchedule(tasks);

      expect(timeline.equipmentUsage.length).toBeGreaterThan(0);
      expect(timeline.equipmentUsage.find(u => u.equipmentId === 'burner-1')).toBeDefined();
    });

    test('should add cleanup slots when configured', () => {
      const cleaningScheduler = new TaskScheduler({ cleaningBufferMinutes: 5 });
      const tasks = [
        { ...createMockTask('task-1', []), cleaningTime: 3 }
      ];
      const timeline = cleaningScheduler.createSchedule(tasks);

      const cleanupSlot = timeline.slots.find(s => s.isCleanup);
      expect(cleanupSlot).toBeDefined();
    });

    test('should identify parallel task groups', () => {
      const tasks = [
        { ...createMockTask('task-1', []), equipment: ['burner-1'], duration: 20 },
        { ...createMockTask('task-2', []), equipment: ['burner-2'], duration: 20 }
      ];
      const timeline = scheduler.createSchedule(tasks);

      // Both can run in parallel (different equipment, no dependencies)
      expect(timeline.parallelTasks.length).toBeGreaterThanOrEqual(1);
    });

    test('should include critical path', () => {
      const tasks = [
        { ...createMockTask('task-1', []), duration: 10 },
        { ...createMockTask('task-2', ['task-1']), duration: 15 }
      ];
      const timeline = scheduler.createSchedule(tasks);

      expect(timeline.criticalPath.length).toBeGreaterThan(0);
    });

    test('should calculate equipment utilization', () => {
      const tasks = [
        { ...createMockTask('task-1', []), equipment: ['burner-1'], duration: 10 }
      ];
      const timeline = scheduler.createSchedule(tasks);

      const burnerUsage = timeline.equipmentUsage.find(u => u.equipmentId === 'burner-1');
      expect(burnerUsage?.utilizationPercent).toBeGreaterThan(0);
    });

    test('should handle equipment availability windows', () => {
      const tasks = [
        { ...createMockTask('task-1', []), equipment: ['burner-1'], duration: 10 }
      ];
      const availability = new Map([
        ['burner-1', [5, 20]] // Available from 5 to 20
      ]);
      const timeline = scheduler.createSchedule(tasks, availability);

      const slot = timeline.slots.find(s => s.taskId === 'task-1');
      expect(slot?.startTime).toBeGreaterThanOrEqual(5);
    });

    test('should avoid equipment conflicts', () => {
      const tasks = [
        { ...createMockTask('task-1', []), equipment: ['burner-1'], duration: 15 },
        { ...createMockTask('task-2', []), equipment: ['burner-1'], duration: 10 }
      ];
      const timeline = scheduler.createSchedule(tasks);

      const slot1 = timeline.slots.find(s => s.taskId === 'task-1');
      const slot2 = timeline.slots.find(s => s.taskId === 'task-2');

      // Should not overlap
      const overlaps = slot1!.startTime < slot2!.endTime && slot1!.endTime > slot2!.startTime;
      expect(overlaps).toBe(false);
    });
  });

  describe('rescheduleTask', () => {
    test('should reschedule task to new time', () => {
      const tasks = [
        createMockTask('task-1', []),
        createMockTask('task-2', [])
      ];
      const timeline = scheduler.createSchedule(tasks);

      const newTimeline = scheduler.rescheduleTask(timeline, 'task-1', 30, tasks);
      expect(newTimeline).toBeDefined();
    });

    test('should throw for non-existent task', () => {
      const tasks = [createMockTask('task-1', [])];
      const timeline = scheduler.createSchedule(tasks);

      expect(() =>
        scheduler.rescheduleTask(timeline, 'non-existent', 30, tasks)
      ).toThrow('not found');
    });
  });

  describe('estimateTotalTime', () => {
    test('should estimate total time', () => {
      const tasks = [
        { ...createMockTask('task-1', []), duration: 10 },
        { ...createMockTask('task-2', ['task-1']), duration: 15 }
      ];
      const time = scheduler.estimateTotalTime(tasks);

      expect(time).toBeGreaterThanOrEqual(25); // At least sequential
    });
  });

  describe('estimateWithoutParallelization', () => {
    test('should sum all durations', () => {
      const tasks = [
        { ...createMockTask('task-1', []), duration: 10 },
        { ...createMockTask('task-2', []), duration: 15 },
        { ...createMockTask('task-3', []), duration: 20 }
      ];
      const time = scheduler.estimateWithoutParallelization(tasks);

      expect(time).toBe(45);
    });
  });

  describe('calculateTimeSavings', () => {
    test('should calculate time saved by parallelization', () => {
      const tasks = [
        { ...createMockTask('task-1', []), equipment: ['burner-1'], duration: 20 },
        { ...createMockTask('task-2', []), equipment: ['burner-2'], duration: 20 }
      ];
      const savings = scheduler.calculateTimeSavings(tasks);

      // With parallelization, both can run at same time
      expect(savings).toBeGreaterThan(0);
    });

    test('should return 0 or negative for fully sequential tasks', () => {
      const tasks = [
        { ...createMockTask('task-1', []), duration: 10 },
        { ...createMockTask('task-2', ['task-1']), duration: 15 }
      ];
      const savings = scheduler.calculateTimeSavings(tasks);

      // No parallelization possible - may return 0 or negative due to cleanup buffers
      expect(savings).toBeLessThanOrEqual(0);
    });
  });
});

describe('Edge Cases', () => {
  let scheduler: TaskScheduler;

  beforeEach(() => {
    scheduler = new TaskScheduler();
  });

  test('should handle task with multiple equipment', () => {
    const tasks = [
      { ...createMockTask('task-1', []), equipment: ['burner-1', 'pot-large'] }
    ];
    const timeline = scheduler.createSchedule(tasks);

    expect(timeline.equipmentUsage.length).toBeGreaterThanOrEqual(2);
  });

  test('should handle multiple tasks on same equipment sequentially', () => {
    const tasks = [
      { ...createMockTask('task-1', []), equipment: ['burner-1'], duration: 10 },
      { ...createMockTask('task-2', []), equipment: ['burner-1'], duration: 10 },
      { ...createMockTask('task-3', []), equipment: ['burner-1'], duration: 10 }
    ];
    const timeline = scheduler.createSchedule(tasks);

    // All must be sequential
    expect(timeline.totalDuration).toBeGreaterThanOrEqual(30);
  });

  test('should handle deep dependency chains', () => {
    const tasks = [];
    for (let i = 0; i < 10; i++) {
      tasks.push(createMockTask(`task-${i}`, i > 0 ? [`task-${i-1}`] : []));
    }
    const timeline = scheduler.createSchedule(tasks);

    // Timeline may include cleanup slots, so check at least 10 task slots
    expect(timeline.slots.length).toBeGreaterThanOrEqual(10);
    // Critical path should contain all 10 tasks (sequential chain)
    expect(timeline.criticalPath.length).toBeGreaterThanOrEqual(10);
  });

  test('should handle diamond dependency pattern', () => {
    const tasks = [
      createMockTask('start', []),
      createMockTask('left', ['start']),
      createMockTask('right', ['start']),
      createMockTask('end', ['left', 'right'])
    ];
    const sorted = topologicalSort(tasks);

    expect(sorted[0].id).toBe('start');
    expect(sorted[3].id).toBe('end');
  });
});

// Helper functions
function createMockTask(id: string, dependencies: string[]): PrepTask {
  return {
    id,
    name: `Task ${id}`,
    type: 'prep',
    duration: 10,
    equipment: [`equipment-${id}`],
    dependencies,
    priority: 'medium',
    requiresAttention: false,
    canParallel: true,
    cleaningTime: 2
  };
}

function createMockTasks(ids: string[]): PrepTask[] {
  return ids.map(id => createMockTask(id, []));
}
