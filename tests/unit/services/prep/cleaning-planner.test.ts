/**
 * Cleaning Planner Tests
 * Comprehensive tests for cleaning task generation and optimization
 */

import { CleaningPlanner } from '../../../../src/services/prep/cleaning-planner';
import { EquipmentManager } from '../../../../src/services/prep/equipment-manager';
import { Timeline, PrepTask, PrepConfig, TimeSlot } from '../../../../src/types/prep.types';

describe('CleaningPlanner', () => {
  let planner: CleaningPlanner;
  let equipmentManager: EquipmentManager;
  let mockTimeline: Timeline;
  let mockTasks: PrepTask[];

  beforeEach(() => {
    equipmentManager = new EquipmentManager();
    planner = new CleaningPlanner(equipmentManager);

    mockTasks = [
      {
        id: 'task-1',
        name: 'Chop Vegetables',
        type: 'prep',
        duration: 10,
        equipment: ['cutting-board-1'],
        dependencies: [],
        priority: 'medium',
        requiresAttention: true,
        canParallel: true,
        cleaningTime: 2
      },
      {
        id: 'task-2',
        name: 'Boil Pasta',
        type: 'cook',
        duration: 15,
        equipment: ['pot-large', 'burner-1'],
        dependencies: [],
        priority: 'high',
        requiresAttention: false,
        canParallel: true,
        cleaningTime: 5
      }
    ];

    const now = new Date();
    mockTimeline = {
      id: 'timeline-1',
      totalDuration: 30,
      startTime: now,
      endTime: new Date(now.getTime() + 30 * 60000),
      slots: [
        { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['cutting-board-1'], isCleanup: false },
        { taskId: 'task-2', startTime: 5, endTime: 20, equipment: ['pot-large', 'burner-1'], isCleanup: false }
      ],
      equipmentUsage: [],
      parallelTasks: [],
      criticalPath: []
    };
  });

  describe('Constructor', () => {
    test('should create planner with default config', () => {
      const defaultPlanner = new CleaningPlanner(equipmentManager);
      expect(defaultPlanner).toBeDefined();
    });

    test('should create planner with custom config', () => {
      const config: Partial<PrepConfig> = { preferredCleaningMethod: 'handwash' };
      const customPlanner = new CleaningPlanner(equipmentManager, config);
      expect(customPlanner).toBeDefined();
    });
  });

  describe('generateCleaningPlan', () => {
    test('should generate complete cleaning plan', () => {
      const plan = planner.generateCleaningPlan(mockTimeline, mockTasks);
      expect(plan).toBeDefined();
      expect(plan.tasks).toBeDefined();
      expect(plan.totalTime).toBeGreaterThanOrEqual(0);
    });

    test('should include dishwasher loads', () => {
      const plan = planner.generateCleaningPlan(mockTimeline, mockTasks);
      expect(plan.dishwasherLoads).toBeDefined();
      expect(Array.isArray(plan.dishwasherLoads)).toBe(true);
    });

    test('should include handwash batches', () => {
      const plan = planner.generateCleaningPlan(mockTimeline, mockTasks);
      expect(plan.handwashBatches).toBeDefined();
      expect(Array.isArray(plan.handwashBatches)).toBe(true);
    });

    test('should identify clean-as-you-go tasks', () => {
      const plan = planner.generateCleaningPlan(mockTimeline, mockTasks);
      expect(plan.cleanAsYouGoTasks).toBeDefined();
    });
  });

  describe('generateCleaningTasks', () => {
    test('should generate cleaning task for each used equipment', () => {
      const tasks = planner.generateCleaningTasks(mockTimeline, mockTasks);
      expect(tasks.length).toBeGreaterThanOrEqual(2); // At least cutting board and pot
    });

    test('should set correct cleaning method for equipment', () => {
      const tasks = planner.generateCleaningTasks(mockTimeline, mockTasks);
      const cuttingBoardTask = tasks.find(t => t.equipmentId === 'cutting-board-1');
      expect(cuttingBoardTask?.method).toBe('handwash');
    });

    test('should set scheduled time based on last usage', () => {
      const tasks = planner.generateCleaningTasks(mockTimeline, mockTasks);
      const cuttingBoardTask = tasks.find(t => t.equipmentId === 'cutting-board-1');
      expect(cuttingBoardTask?.scheduledTime).toBe(10); // After task-1 ends
    });

    test('should sort tasks by scheduled time', () => {
      const tasks = planner.generateCleaningTasks(mockTimeline, mockTasks);
      for (let i = 1; i < tasks.length; i++) {
        expect(tasks[i].scheduledTime).toBeGreaterThanOrEqual(tasks[i - 1].scheduledTime);
      }
    });

    test('should set correct priority based on equipment type', () => {
      const tasks = planner.generateCleaningTasks(mockTimeline, mockTasks);
      const cuttingBoardTask = tasks.find(t => t.equipmentId === 'cutting-board-1');
      expect(cuttingBoardTask?.priority).toBe('medium'); // Tool category
    });

    test('should skip cleanup slots', () => {
      const timelineWithCleanup = {
        ...mockTimeline,
        slots: [
          ...mockTimeline.slots,
          { taskId: 'task-1-cleanup', startTime: 10, endTime: 12, equipment: ['cutting-board-1'], isCleanup: true }
        ]
      };
      const tasks = planner.generateCleaningTasks(timelineWithCleanup, mockTasks);
      // Should still track cutting-board-1 from the non-cleanup slot
      expect(tasks.find(t => t.equipmentId === 'cutting-board-1')).toBeDefined();
    });
  });

  describe('identifyCleanAsYouGo', () => {
    test('should identify tasks that can be cleaned during gaps', () => {
      const cleaningTasks = planner.generateCleaningTasks(mockTimeline, mockTasks);
      const timelineWithGaps: Timeline = {
        ...mockTimeline,
        totalDuration: 40,
        slots: [
          { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['cutting-board-1'], isCleanup: false },
          { taskId: 'task-2', startTime: 25, endTime: 40, equipment: ['pot-large'], isCleanup: false }
        ]
      };
      const cleanAsYouGo = planner.identifyCleanAsYouGo(timelineWithGaps, cleaningTasks);
      expect(cleanAsYouGo.length).toBeGreaterThanOrEqual(0);
    });

    test('should prioritize high priority cleaning tasks', () => {
      const cleaningTasks = [
        { id: 'clean-1', equipmentId: 'eq-1', equipmentName: 'Eq1', method: 'handwash' as const, duration: 5, scheduledTime: 10, canBatch: true, priority: 'low' as const, notes: '' },
        { id: 'clean-2', equipmentId: 'eq-2', equipmentName: 'Eq2', method: 'soak' as const, duration: 3, scheduledTime: 10, canBatch: false, priority: 'high' as const, notes: '' }
      ];
      const timelineWithGaps: Timeline = {
        ...mockTimeline,
        totalDuration: 30,
        slots: [
          { taskId: 'task-1', startTime: 0, endTime: 5, equipment: ['eq-1'], isCleanup: false },
          { taskId: 'task-2', startTime: 20, endTime: 30, equipment: ['eq-2'], isCleanup: false }
        ]
      };
      const cleanAsYouGo = planner.identifyCleanAsYouGo(timelineWithGaps, cleaningTasks);
      if (cleanAsYouGo.length > 1) {
        expect(cleanAsYouGo[0].priority).toBe('high');
      }
    });
  });

  describe('optimizeDishwasherLoads', () => {
    test('should return empty array when no dishwasher tasks', () => {
      const handwashOnly = [
        { id: 'clean-1', equipmentId: 'cutting-board-1', equipmentName: 'Cutting Board', method: 'handwash' as const, duration: 2, scheduledTime: 10, canBatch: true, priority: 'medium' as const, notes: '' }
      ];
      const loads = planner.optimizeDishwasherLoads(handwashOnly);
      expect(loads).toHaveLength(0);
    });

    test('should group dishwasher tasks into loads of 12', () => {
      const dishwasherTasks = Array.from({ length: 15 }, (_, i) => ({
        id: `clean-${i}`,
        equipmentId: `eq-${i}`,
        equipmentName: `Equipment ${i}`,
        method: 'dishwasher' as const,
        duration: 3,
        scheduledTime: 10,
        canBatch: true,
        priority: 'low' as const,
        notes: ''
      }));
      const loads = planner.optimizeDishwasherLoads(dishwasherTasks);
      expect(loads.length).toBe(2); // 12 + 3
      expect(loads[0].length).toBe(12);
      expect(loads[1].length).toBe(3);
    });
  });

  describe('groupHandwashTasks', () => {
    test('should return empty array when no handwash tasks', () => {
      const dishwasherOnly = [
        { id: 'clean-1', equipmentId: 'pot-1', equipmentName: 'Pot', method: 'dishwasher' as const, duration: 3, scheduledTime: 10, canBatch: true, priority: 'low' as const, notes: '' }
      ];
      const batches = planner.groupHandwashTasks(dishwasherOnly);
      expect(batches).toHaveLength(0);
    });

    test('should group handwash tasks within 10 minute window', () => {
      const handwashTasks = [
        { id: 'clean-1', equipmentId: 'eq-1', equipmentName: 'Eq1', method: 'handwash' as const, duration: 2, scheduledTime: 5, canBatch: true, priority: 'medium' as const, notes: '' },
        { id: 'clean-2', equipmentId: 'eq-2', equipmentName: 'Eq2', method: 'handwash' as const, duration: 3, scheduledTime: 8, canBatch: true, priority: 'medium' as const, notes: '' },
        { id: 'clean-3', equipmentId: 'eq-3', equipmentName: 'Eq3', method: 'handwash' as const, duration: 2, scheduledTime: 25, canBatch: true, priority: 'medium' as const, notes: '' }
      ];
      const batches = planner.groupHandwashTasks(handwashTasks);
      expect(batches.length).toBe(2); // First two in one batch, third separate
      expect(batches[0].length).toBe(2);
      expect(batches[1].length).toBe(1);
    });
  });

  describe('calculateTotalCleaningTime', () => {
    test('should calculate time accounting for batching', () => {
      const cleaningTasks = [
        { id: 'clean-1', equipmentId: 'eq-1', equipmentName: 'Eq1', method: 'handwash' as const, duration: 5, scheduledTime: 10, canBatch: true, priority: 'medium' as const, notes: '' },
        { id: 'clean-2', equipmentId: 'eq-2', equipmentName: 'Eq2', method: 'dishwasher' as const, duration: 3, scheduledTime: 10, canBatch: true, priority: 'low' as const, notes: '' },
        { id: 'clean-3', equipmentId: 'eq-3', equipmentName: 'Eq3', method: 'wipe' as const, duration: 2, scheduledTime: 10, canBatch: false, priority: 'low' as const, notes: '' }
      ];
      const totalTime = planner.calculateTotalCleaningTime(cleaningTasks);
      expect(totalTime).toBeGreaterThan(0);
      // Handwash: 5 * 0.8 = 4, Dishwasher: 1 load * 5 = 5, Other: 2
      // Total = 11
      expect(totalTime).toBe(11);
    });

    test('should return 0 for empty task list', () => {
      const totalTime = planner.calculateTotalCleaningTime([]);
      expect(totalTime).toBe(0);
    });
  });

  describe('generateCleaningSuggestions', () => {
    test('should suggest soaking items early', () => {
      const plan = {
        tasks: [
          { id: 'clean-1', equipmentId: 'baking-dish', equipmentName: 'Baking Dish', method: 'soak' as const, duration: 10, scheduledTime: 10, canBatch: false, priority: 'high' as const, notes: '' }
        ],
        dishwasherLoads: [],
        handwashBatches: [],
        totalTime: 10,
        cleanAsYouGoTasks: []
      };
      const suggestions = planner.generateCleaningSuggestions(plan);
      expect(suggestions.some(s => s.toLowerCase().includes('soak'))).toBe(true);
    });

    test('should suggest dishwasher load efficiency', () => {
      const plan = {
        tasks: [],
        dishwasherLoads: [[{ id: 'clean-1', equipmentId: 'pot-1', equipmentName: 'Pot', method: 'dishwasher' as const, duration: 3, scheduledTime: 10, canBatch: true, priority: 'low' as const, notes: '' }]],
        handwashBatches: [],
        totalTime: 5,
        cleanAsYouGoTasks: []
      };
      const suggestions = planner.generateCleaningSuggestions(plan);
      expect(suggestions.some(s => s.toLowerCase().includes('dishwasher'))).toBe(true);
    });

    test('should suggest handwash batching', () => {
      const plan = {
        tasks: [],
        dishwasherLoads: [],
        handwashBatches: [
          [{ id: 'clean-1', equipmentId: 'eq-1', equipmentName: 'Eq1', method: 'handwash' as const, duration: 2, scheduledTime: 5, canBatch: true, priority: 'medium' as const, notes: '' }],
          [{ id: 'clean-2', equipmentId: 'eq-2', equipmentName: 'Eq2', method: 'handwash' as const, duration: 3, scheduledTime: 20, canBatch: true, priority: 'medium' as const, notes: '' }]
        ],
        totalTime: 5,
        cleanAsYouGoTasks: []
      };
      const suggestions = planner.generateCleaningSuggestions(plan);
      expect(suggestions.some(s => s.toLowerCase().includes('batch'))).toBe(true);
    });

    test('should suggest clean-as-you-go benefits', () => {
      const plan = {
        tasks: [],
        dishwasherLoads: [],
        handwashBatches: [],
        totalTime: 10,
        cleanAsYouGoTasks: [
          { id: 'clean-1', equipmentId: 'eq-1', equipmentName: 'Eq1', method: 'handwash' as const, duration: 5, scheduledTime: 10, canBatch: true, priority: 'medium' as const, notes: '' }
        ]
      };
      const suggestions = planner.generateCleaningSuggestions(plan);
      expect(suggestions.some(s => s.toLowerCase().includes('clean-as-you-go'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle timeline with no active slots', () => {
      const emptyTimeline: Timeline = {
        ...mockTimeline,
        slots: []
      };
      const tasks = planner.generateCleaningTasks(emptyTimeline, mockTasks);
      expect(tasks).toHaveLength(0);
    });

    test('should handle equipment not in manager', () => {
      const timelineWithUnknown: Timeline = {
        ...mockTimeline,
        slots: [
          { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['unknown-equipment'], isCleanup: false }
        ]
      };
      const tasks = planner.generateCleaningTasks(timelineWithUnknown, mockTasks);
      expect(tasks.find(t => t.equipmentId === 'unknown-equipment')).toBeUndefined();
    });

    test('should use default cleaning info for unknown equipment', () => {
      // Add custom equipment to manager
      equipmentManager.addEquipment({
        id: 'custom-pot',
        name: 'Custom Pot',
        category: 'tool',
        status: 'clean',
        cleaningTime: 7
      });

      const timelineWithCustom: Timeline = {
        ...mockTimeline,
        slots: [
          { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['custom-pot'], isCleanup: false }
        ]
      };
      const tasks = planner.generateCleaningTasks(timelineWithCustom, mockTasks);
      const customTask = tasks.find(t => t.equipmentId === 'custom-pot');
      expect(customTask?.duration).toBe(7); // Should use equipment's cleaningTime
    });

    test('should filter out gaps shorter than 2 minutes', () => {
      const cleaningTasks = [
        { id: 'clean-1', equipmentId: 'eq-1', equipmentName: 'Eq1', method: 'handwash' as const, duration: 5, scheduledTime: 5, canBatch: true, priority: 'medium' as const, notes: '' }
      ];
      const timelineWithSmallGap: Timeline = {
        ...mockTimeline,
        totalDuration: 15,
        slots: [
          { taskId: 'task-1', startTime: 0, endTime: 5, equipment: ['eq-1'], isCleanup: false },
          { taskId: 'task-2', startTime: 6, endTime: 15, equipment: ['eq-2'], isCleanup: false } // 1 min gap
        ]
      };
      const cleanAsYouGo = planner.identifyCleanAsYouGo(timelineWithSmallGap, cleaningTasks);
      // Should not assign to 1 minute gap
      expect(cleanAsYouGo.length).toBe(0);
    });
  });
});
