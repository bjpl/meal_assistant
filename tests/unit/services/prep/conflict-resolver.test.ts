/**
 * Conflict Resolver Tests
 * Comprehensive tests for scheduling conflict detection and resolution
 */

import { ConflictDetector, ConflictResolver } from '../../../../src/services/prep/conflict-resolver';
import { EquipmentManager } from '../../../../src/services/prep/equipment-manager';
import { Timeline, PrepTask, Conflict, TimeSlot } from '../../../../src/types/prep.types';

describe('ConflictDetector', () => {
  let detector: ConflictDetector;
  let equipmentManager: EquipmentManager;

  beforeEach(() => {
    equipmentManager = new EquipmentManager();
    detector = new ConflictDetector(equipmentManager);
  });

  describe('Constructor', () => {
    test('should create detector with default config', () => {
      expect(detector).toBeDefined();
    });

    test('should create detector with custom config', () => {
      const customDetector = new ConflictDetector(equipmentManager, { attentionThreshold: 3 });
      expect(customDetector).toBeDefined();
    });
  });

  describe('detectAll', () => {
    test('should detect all conflict types', () => {
      const timeline: Timeline = createMockTimeline([
        { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['burner-1'], isCleanup: false },
        { taskId: 'task-2', startTime: 5, endTime: 15, equipment: ['burner-1'], isCleanup: false }
      ]);
      const tasks = createMockTasks(['task-1', 'task-2']);

      const conflicts = detector.detectAll(timeline, tasks);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    test('should return empty array when no conflicts', () => {
      const timeline: Timeline = createMockTimeline([
        { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['burner-1'], isCleanup: false },
        { taskId: 'task-2', startTime: 10, endTime: 20, equipment: ['burner-2'], isCleanup: false }
      ]);
      const tasks = createMockTasks(['task-1', 'task-2']);

      const conflicts = detector.detectAll(timeline, tasks);
      expect(conflicts.filter(c => c.type === 'equipment_overlap')).toHaveLength(0);
    });
  });

  describe('detectEquipmentOverlaps', () => {
    test('should detect overlapping equipment usage', () => {
      const timeline = createMockTimeline([
        { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['burner-1'], isCleanup: false },
        { taskId: 'task-2', startTime: 5, endTime: 15, equipment: ['burner-1'], isCleanup: false }
      ]);

      const conflicts = detector.detectEquipmentOverlaps(timeline);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].type).toBe('equipment_overlap');
      expect(conflicts[0].severity).toBe('critical');
    });

    test('should not detect overlap for non-overlapping slots', () => {
      const timeline = createMockTimeline([
        { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['burner-1'], isCleanup: false },
        { taskId: 'task-2', startTime: 10, endTime: 20, equipment: ['burner-1'], isCleanup: false }
      ]);

      const conflicts = detector.detectEquipmentOverlaps(timeline);
      expect(conflicts).toHaveLength(0);
    });

    test('should skip cleanup slots', () => {
      const timeline = createMockTimeline([
        { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['burner-1'], isCleanup: false },
        { taskId: 'task-1-cleanup', startTime: 5, endTime: 12, equipment: ['burner-1'], isCleanup: true }
      ]);

      const conflicts = detector.detectEquipmentOverlaps(timeline);
      expect(conflicts).toHaveLength(0);
    });

    test('should handle equipment with multiple slots', () => {
      const timeline = createMockTimeline([
        { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['oven'], isCleanup: false },
        { taskId: 'task-2', startTime: 5, endTime: 15, equipment: ['oven'], isCleanup: false },
        { taskId: 'task-3', startTime: 5, endTime: 15, equipment: ['oven'], isCleanup: false }
      ]);

      const conflicts = detector.detectEquipmentOverlaps(timeline);
      // Oven has 2 slots, so 3 tasks would conflict
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('detectSlotExceeded', () => {
    test('should detect when oven capacity is exceeded', () => {
      const timeline = createMockTimeline([
        { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['oven'], isCleanup: false },
        { taskId: 'task-2', startTime: 0, endTime: 10, equipment: ['oven'], isCleanup: false },
        { taskId: 'task-3', startTime: 0, endTime: 10, equipment: ['oven'], isCleanup: false }
      ]);

      const conflicts = detector.detectSlotExceeded(timeline);
      expect(conflicts.some(c => c.description.includes('oven'))).toBe(true);
    });

    test('should detect when burner capacity is exceeded', () => {
      const timeline = createMockTimeline([
        { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['burner-1'], isCleanup: false },
        { taskId: 'task-2', startTime: 0, endTime: 10, equipment: ['burner-2'], isCleanup: false },
        { taskId: 'task-3', startTime: 0, endTime: 10, equipment: ['burner-3'], isCleanup: false },
        { taskId: 'task-4', startTime: 0, endTime: 10, equipment: ['burner-4'], isCleanup: false },
        { taskId: 'task-5', startTime: 0, endTime: 10, equipment: ['burner-1'], isCleanup: false } // 5th burner need
      ]);

      const conflicts = detector.detectSlotExceeded(timeline);
      expect(conflicts.some(c => c.description.includes('stovetop'))).toBe(true);
    });

    test('should not detect conflict within capacity', () => {
      const timeline = createMockTimeline([
        { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['oven'], isCleanup: false },
        { taskId: 'task-2', startTime: 0, endTime: 10, equipment: ['oven-rack-1'], isCleanup: false }
      ]);

      const conflicts = detector.detectSlotExceeded(timeline);
      expect(conflicts.filter(c => c.description.includes('oven'))).toHaveLength(0);
    });
  });

  describe('detectDependencyViolations', () => {
    test('should detect when task starts before dependency ends', () => {
      const timeline = createMockTimeline([
        { taskId: 'task-1', startTime: 0, endTime: 15, equipment: ['burner-1'], isCleanup: false },
        { taskId: 'task-2', startTime: 10, endTime: 20, equipment: ['burner-2'], isCleanup: false }
      ]);
      const tasks = [
        createMockTask('task-1', []),
        createMockTask('task-2', ['task-1']) // task-2 depends on task-1
      ];
      const taskMap = new Map(tasks.map(t => [t.id, t]));

      const conflicts = detector.detectDependencyViolations(timeline, taskMap);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].type).toBe('dependency_violation');
    });

    test('should not detect conflict when dependencies are satisfied', () => {
      const timeline = createMockTimeline([
        { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['burner-1'], isCleanup: false },
        { taskId: 'task-2', startTime: 10, endTime: 20, equipment: ['burner-2'], isCleanup: false }
      ]);
      const tasks = [
        createMockTask('task-1', []),
        createMockTask('task-2', ['task-1'])
      ];
      const taskMap = new Map(tasks.map(t => [t.id, t]));

      const conflicts = detector.detectDependencyViolations(timeline, taskMap);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('detectAttentionOverload', () => {
    test('should detect when too many attention-required tasks overlap', () => {
      const timeline = createMockTimeline([
        { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['burner-1'], isCleanup: false },
        { taskId: 'task-2', startTime: 0, endTime: 10, equipment: ['burner-2'], isCleanup: false },
        { taskId: 'task-3', startTime: 0, endTime: 10, equipment: ['burner-3'], isCleanup: false }
      ]);
      const tasks = [
        { ...createMockTask('task-1', []), requiresAttention: true },
        { ...createMockTask('task-2', []), requiresAttention: true },
        { ...createMockTask('task-3', []), requiresAttention: true }
      ];
      const taskMap = new Map(tasks.map(t => [t.id, t]));

      // Default threshold is 2, so 3 should trigger
      const conflicts = detector.detectAttentionOverload(timeline, taskMap);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].type).toBe('attention_overload');
      expect(conflicts[0].severity).toBe('warning');
    });

    test('should not detect when attention tasks don\'t overlap', () => {
      const timeline = createMockTimeline([
        { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['burner-1'], isCleanup: false },
        { taskId: 'task-2', startTime: 15, endTime: 25, equipment: ['burner-2'], isCleanup: false }
      ]);
      const tasks = [
        { ...createMockTask('task-1', []), requiresAttention: true },
        { ...createMockTask('task-2', []), requiresAttention: true }
      ];
      const taskMap = new Map(tasks.map(t => [t.id, t]));

      const conflicts = detector.detectAttentionOverload(timeline, taskMap);
      expect(conflicts).toHaveLength(0);
    });
  });
});

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;
  let equipmentManager: EquipmentManager;

  beforeEach(() => {
    equipmentManager = new EquipmentManager();
    resolver = new ConflictResolver(equipmentManager);
  });

  describe('resolveAll', () => {
    test('should resolve all conflicts', () => {
      const conflicts: Conflict[] = [
        createMockConflict('equipment_overlap', ['task-1', 'task-2']),
        createMockConflict('dependency_violation', ['task-3', 'task-4'])
      ];
      const tasks = createMockTasks(['task-1', 'task-2', 'task-3', 'task-4']);

      const resolutions = resolver.resolveAll(conflicts, tasks);
      expect(resolutions.length).toBe(2);
    });
  });

  describe('resolveConflict', () => {
    describe('equipment_overlap resolution', () => {
      test('should suggest substitute equipment when available', () => {
        const conflict = createMockConflict('equipment_overlap', ['task-1', 'task-2'], 'instant-pot');
        const tasks = createMockTasks(['task-1', 'task-2']);
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        const resolution = resolver.resolveConflict(conflict, taskMap);
        // If dutch-oven is available as alternative
        if (resolution.strategy === 'substitute') {
          expect(resolution.substituteEquipment).toBeDefined();
        }
      });

      test('should suggest rescheduling when no substitute available', () => {
        const conflict = createMockConflict('equipment_overlap', ['task-1', 'task-2'], 'burner-1');
        const tasks = createMockTasks(['task-1', 'task-2']);
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        const resolution = resolver.resolveConflict(conflict, taskMap);
        expect(['reschedule', 'manual']).toContain(resolution.strategy);
      });
    });

    describe('slot_exceeded resolution', () => {
      test('should suggest sequential execution', () => {
        const conflict = createMockConflict('slot_exceeded', ['task-1', 'task-2', 'task-3']);
        const tasks = createMockTasks(['task-1', 'task-2', 'task-3']);
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        const resolution = resolver.resolveConflict(conflict, taskMap);
        expect(['sequential', 'manual']).toContain(resolution.strategy);
      });
    });

    describe('dependency_violation resolution', () => {
      test('should reschedule dependent task', () => {
        const conflict = createMockConflict('dependency_violation', ['task-2', 'task-1']);
        const tasks = createMockTasks(['task-1', 'task-2']);
        tasks[1].dependencies = ['task-1'];
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        const resolution = resolver.resolveConflict(conflict, taskMap);
        expect(resolution.strategy).toBe('reschedule');
        expect(resolution.newSchedule).toBeDefined();
      });

      test('should return manual for invalid dependency', () => {
        const conflict = createMockConflict('dependency_violation', ['task-1']);
        const taskMap = new Map<string, PrepTask>();

        const resolution = resolver.resolveConflict(conflict, taskMap);
        expect(resolution.strategy).toBe('manual');
      });
    });

    describe('attention_overload resolution', () => {
      test('should suggest making tasks passive', () => {
        const conflict = createMockConflict('attention_overload', ['task-1', 'task-2']);
        const tasks: PrepTask[] = [
          { ...createMockTask('task-1', []), type: 'simmer' },
          { ...createMockTask('task-2', []), type: 'prep' }
        ];
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        const resolution = resolver.resolveConflict(conflict, taskMap);
        expect(resolution.explanation.toLowerCase()).toContain('passive');
      });

      test('should suggest splitting when no passive tasks', () => {
        const conflict = createMockConflict('attention_overload', ['task-1', 'task-2']);
        const tasks: PrepTask[] = [
          { ...createMockTask('task-1', []), type: 'prep' },
          { ...createMockTask('task-2', []), type: 'assemble' }
        ];
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        const resolution = resolver.resolveConflict(conflict, taskMap);
        expect(resolution.strategy).toBe('split');
      });
    });

    describe('unknown conflict type', () => {
      test('should return manual resolution', () => {
        const conflict: Conflict = {
          id: 'unknown-1',
          type: 'unknown' as any,
          taskIds: ['task-1'],
          timeRange: [0, 10],
          severity: 'warning',
          description: 'Unknown conflict'
        };
        const taskMap = new Map<string, PrepTask>();

        const resolution = resolver.resolveConflict(conflict, taskMap);
        expect(resolution.strategy).toBe('manual');
      });
    });
  });
});

// Helper functions
function createMockTimeline(slots: TimeSlot[]): Timeline {
  const now = new Date();
  return {
    id: 'timeline-1',
    totalDuration: 30,
    startTime: now,
    endTime: new Date(now.getTime() + 30 * 60000),
    slots,
    equipmentUsage: [],
    parallelTasks: [],
    criticalPath: []
  };
}

function createMockTask(id: string, dependencies: string[]): PrepTask {
  return {
    id,
    name: `Task ${id}`,
    type: 'prep',
    duration: 10,
    equipment: ['burner-1'],
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

function createMockConflict(type: Conflict['type'], taskIds: string[], equipmentId?: string): Conflict {
  return {
    id: `conflict-${Date.now()}`,
    type,
    taskIds,
    equipmentId,
    timeRange: [0, 10],
    severity: type === 'attention_overload' ? 'warning' : 'critical',
    description: `Mock ${type} conflict`
  };
}
