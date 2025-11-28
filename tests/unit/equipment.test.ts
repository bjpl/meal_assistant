/**
 * Unit Tests: Equipment Conflict Resolution
 * Tests for equipment tracking, conflict detection, and scheduling
 * Target: 90% coverage
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Types
type EquipmentStatus = 'clean' | 'dirty' | 'in-use' | 'dishwasher' | 'maintenance';

interface Equipment {
  id: string;
  name: string;
  type: 'appliance' | 'cookware' | 'tool' | 'storage';
  status: EquipmentStatus;
  capacity?: string;
  quantity: number;
  availableCount: number;
  estimatedFreeTime?: Date;
}

interface EquipmentUsage {
  equipmentId: string;
  startTime: Date;
  endTime: Date;
  task: string;
  recipe: string;
}

interface Conflict {
  equipmentId: string;
  equipmentName: string;
  conflictingUsages: EquipmentUsage[];
  resolution: string;
  alternatives: string[];
}

// Equipment Service
const createEquipmentService = () => {
  const equipment = new Map<string, Equipment>([
    ['oven', { id: 'oven', name: 'Oven', type: 'appliance', status: 'clean', capacity: '5 cu ft', quantity: 1, availableCount: 1 }],
    ['stovetop', { id: 'stovetop', name: 'Stovetop', type: 'appliance', status: 'clean', quantity: 4, availableCount: 4 }],
    ['pot-large', { id: 'pot-large', name: 'Large Pot (8qt)', type: 'cookware', status: 'clean', capacity: '8qt', quantity: 1, availableCount: 1 }],
    ['pot-medium', { id: 'pot-medium', name: 'Medium Pot (4qt)', type: 'cookware', status: 'clean', capacity: '4qt', quantity: 2, availableCount: 2 }],
    ['sheet-pan', { id: 'sheet-pan', name: 'Sheet Pan', type: 'cookware', status: 'clean', quantity: 3, availableCount: 3 }],
    ['cutting-board', { id: 'cutting-board', name: 'Cutting Board', type: 'tool', status: 'clean', quantity: 2, availableCount: 2 }],
    ['food-processor', { id: 'food-processor', name: 'Food Processor', type: 'appliance', status: 'clean', capacity: '14 cups', quantity: 1, availableCount: 1 }],
    ['rice-cooker', { id: 'rice-cooker', name: 'Rice Cooker', type: 'appliance', status: 'clean', capacity: '10 cups', quantity: 1, availableCount: 1 }],
    ['air-fryer', { id: 'air-fryer', name: 'Air Fryer', type: 'appliance', status: 'clean', capacity: '4qt', quantity: 1, availableCount: 1 }]
  ]);

  const usageSchedule: EquipmentUsage[] = [];

  return {
    getEquipment(id: string): Equipment | undefined {
      return equipment.get(id);
    },

    getAllEquipment(): Equipment[] {
      return Array.from(equipment.values());
    },

    getAvailableEquipment(): Equipment[] {
      return Array.from(equipment.values()).filter(
        e => e.availableCount > 0 && e.status !== 'maintenance'
      );
    },

    updateStatus(id: string, status: EquipmentStatus): boolean {
      const equip = equipment.get(id);
      if (!equip) return false;

      const previousStatus = equip.status;
      equip.status = status;

      // Update available count based on status
      if (status === 'in-use' || status === 'dirty' || status === 'dishwasher' || status === 'maintenance') {
        if (previousStatus === 'clean') {
          equip.availableCount = Math.max(0, equip.availableCount - 1);
        }
      } else if (status === 'clean') {
        equip.availableCount = Math.min(equip.quantity, equip.availableCount + 1);
      }

      return true;
    },

    scheduleUsage(usage: EquipmentUsage): { success: boolean; conflict?: Conflict } {
      const equip = equipment.get(usage.equipmentId);
      if (!equip) {
        return { success: false };
      }

      // Check for conflicts
      const conflicts = usageSchedule.filter(scheduled => {
        if (scheduled.equipmentId !== usage.equipmentId) return false;

        // Time overlap check
        return (
          (usage.startTime >= scheduled.startTime && usage.startTime < scheduled.endTime) ||
          (usage.endTime > scheduled.startTime && usage.endTime <= scheduled.endTime) ||
          (usage.startTime <= scheduled.startTime && usage.endTime >= scheduled.endTime)
        );
      });

      // Check if we have enough quantity
      const overlappingCount = conflicts.length;
      if (overlappingCount >= equip.quantity) {
        return {
          success: false,
          conflict: {
            equipmentId: usage.equipmentId,
            equipmentName: equip.name,
            conflictingUsages: conflicts,
            resolution: `Wait until ${conflicts[0].endTime.toLocaleTimeString()}`,
            alternatives: this.findAlternatives(equip.id)
          }
        };
      }

      usageSchedule.push(usage);
      return { success: true };
    },

    findAlternatives(equipmentId: string): string[] {
      const alternatives: Record<string, string[]> = {
        'oven': ['air-fryer', 'toaster-oven'],
        'pot-large': ['instant-pot', 'dutch-oven'],
        'pot-medium': ['pot-large', 'saucepan'],
        'rice-cooker': ['pot-medium', 'instant-pot'],
        'food-processor': ['blender', 'manual-chopping'],
        'sheet-pan': ['baking-dish', 'cast-iron-skillet']
      };

      return alternatives[equipmentId] || [];
    },

    detectConflicts(usages: EquipmentUsage[]): Conflict[] {
      const conflicts: Conflict[] = [];
      const equipmentUsageMap = new Map<string, EquipmentUsage[]>();

      // Group by equipment
      usages.forEach(usage => {
        const existing = equipmentUsageMap.get(usage.equipmentId) || [];
        existing.push(usage);
        equipmentUsageMap.set(usage.equipmentId, existing);
      });

      // Check each equipment for conflicts
      equipmentUsageMap.forEach((usageList, equipmentId) => {
        const equip = equipment.get(equipmentId);
        if (!equip) return;

        // Sort by start time
        usageList.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

        // Find overlaps
        for (let i = 0; i < usageList.length; i++) {
          const conflicting: EquipmentUsage[] = [];
          for (let j = i + 1; j < usageList.length; j++) {
            if (usageList[j].startTime < usageList[i].endTime) {
              conflicting.push(usageList[j]);
            }
          }

          if (conflicting.length >= equip.quantity) {
            conflicts.push({
              equipmentId,
              equipmentName: equip.name,
              conflictingUsages: [usageList[i], ...conflicting],
              resolution: this.suggestResolution(usageList[i], conflicting[0]),
              alternatives: this.findAlternatives(equipmentId)
            });
          }
        }
      });

      return conflicts;
    },

    suggestResolution(usage1: EquipmentUsage, usage2: EquipmentUsage): string {
      const timeDiff = usage2.startTime.getTime() - usage1.endTime.getTime();

      if (timeDiff < 0) {
        // Overlap - suggest sequential execution
        const delay = Math.abs(timeDiff) / 60000; // minutes
        return `Delay "${usage2.task}" by ${Math.ceil(delay)} minutes`;
      }

      return 'Tasks can run in sequence with no changes';
    },

    estimateCleaningTime(equipmentId: string): number {
      const cleaningTimes: Record<string, number> = {
        'oven': 10,
        'stovetop': 5,
        'pot-large': 3,
        'pot-medium': 2,
        'sheet-pan': 2,
        'cutting-board': 1,
        'food-processor': 5,
        'rice-cooker': 3,
        'air-fryer': 5
      };

      return cleaningTimes[equipmentId] || 2;
    },

    generatePrepChecklist(requiredEquipment: string[]): {
      ready: Equipment[];
      needsCleaning: Equipment[];
      unavailable: string[];
    } {
      const ready: Equipment[] = [];
      const needsCleaning: Equipment[] = [];
      const unavailable: string[] = [];

      requiredEquipment.forEach(id => {
        const equip = equipment.get(id);
        if (!equip) {
          unavailable.push(id);
        } else if (equip.status === 'clean' && equip.availableCount > 0) {
          ready.push(equip);
        } else if (equip.status === 'dirty' || equip.status === 'dishwasher') {
          needsCleaning.push(equip);
        } else if (equip.status === 'maintenance' || equip.availableCount === 0) {
          unavailable.push(equip.name);
        }
      });

      return { ready, needsCleaning, unavailable };
    },

    optimizeParallelTasks(tasks: { equipmentId: string; duration: number; task: string }[]): {
      timeline: { time: number; equipment: string; task: string }[];
      totalTime: number;
      equipmentUtilization: Record<string, number>;
    } {
      const timeline: { time: number; equipment: string; task: string }[] = [];
      const equipmentEndTimes = new Map<string, number>();
      let totalTime = 0;

      // Sort tasks by duration (longest first for better packing)
      const sortedTasks = [...tasks].sort((a, b) => b.duration - a.duration);

      sortedTasks.forEach(task => {
        const equip = equipment.get(task.equipmentId);
        if (!equip) return;

        const earliestStart = equipmentEndTimes.get(task.equipmentId) || 0;
        const endTime = earliestStart + task.duration;

        timeline.push({
          time: earliestStart,
          equipment: equip.name,
          task: task.task
        });

        equipmentEndTimes.set(task.equipmentId, endTime);
        totalTime = Math.max(totalTime, endTime);
      });

      // Calculate utilization
      const equipmentUtilization: Record<string, number> = {};
      tasks.forEach(task => {
        const equip = equipment.get(task.equipmentId);
        if (!equip) return;
        const currentUtil = equipmentUtilization[equip.name] || 0;
        equipmentUtilization[equip.name] = currentUtil + (task.duration / totalTime) * 100;
      });

      return {
        timeline: timeline.sort((a, b) => a.time - b.time),
        totalTime,
        equipmentUtilization
      };
    },

    getEquipmentByStatus(status: EquipmentStatus): Equipment[] {
      return Array.from(equipment.values()).filter(e => e.status === status);
    },

    startDishwasherCycle(): { items: Equipment[]; estimatedCompletion: Date } {
      const dirtyItems = this.getEquipmentByStatus('dirty').filter(e =>
        e.type === 'cookware' || e.type === 'tool'
      );

      dirtyItems.forEach(item => {
        this.updateStatus(item.id, 'dishwasher');
        const equip = equipment.get(item.id);
        if (equip) {
          equip.estimatedFreeTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        }
      });

      return {
        items: dirtyItems,
        estimatedCompletion: new Date(Date.now() + 60 * 60 * 1000)
      };
    },

    completeDishwasherCycle(): Equipment[] {
      const dishwasherItems = this.getEquipmentByStatus('dishwasher');

      dishwasherItems.forEach(item => {
        this.updateStatus(item.id, 'clean');
        const equip = equipment.get(item.id);
        if (equip) {
          equip.estimatedFreeTime = undefined;
        }
      });

      return dishwasherItems;
    }
  };
};

describe('Equipment Management', () => {
  let equipmentService: ReturnType<typeof createEquipmentService>;

  beforeEach(() => {
    equipmentService = createEquipmentService();
  });

  describe('Basic Equipment Operations', () => {
    it('should get equipment by ID', () => {
      const oven = equipmentService.getEquipment('oven');

      expect(oven).toBeDefined();
      expect(oven?.name).toBe('Oven');
      expect(oven?.type).toBe('appliance');
    });

    it('should get all equipment', () => {
      const all = equipmentService.getAllEquipment();

      expect(all.length).toBe(9);
    });

    it('should get only available equipment', () => {
      // Mark one as in-use
      equipmentService.updateStatus('oven', 'in-use');

      const available = equipmentService.getAvailableEquipment();

      expect(available.find(e => e.id === 'oven')).toBeUndefined();
    });

    it('should return undefined for non-existent equipment', () => {
      const fake = equipmentService.getEquipment('fake-equipment');

      expect(fake).toBeUndefined();
    });
  });

  describe('Status Management', () => {
    it('should update equipment status', () => {
      const result = equipmentService.updateStatus('pot-large', 'dirty');

      expect(result).toBe(true);
      expect(equipmentService.getEquipment('pot-large')?.status).toBe('dirty');
    });

    it('should decrement available count when status changes to in-use', () => {
      const before = equipmentService.getEquipment('pot-medium')?.availableCount;
      equipmentService.updateStatus('pot-medium', 'in-use');
      const after = equipmentService.getEquipment('pot-medium')?.availableCount;

      expect(after).toBe((before || 0) - 1);
    });

    it('should increment available count when status changes to clean', () => {
      equipmentService.updateStatus('pot-medium', 'dirty');
      const before = equipmentService.getEquipment('pot-medium')?.availableCount;
      equipmentService.updateStatus('pot-medium', 'clean');
      const after = equipmentService.getEquipment('pot-medium')?.availableCount;

      expect(after).toBe((before || 0) + 1);
    });

    it('should not exceed quantity when marking as clean', () => {
      const pot = equipmentService.getEquipment('pot-medium');
      const quantity = pot?.quantity || 0;

      // Try to mark clean multiple times
      for (let i = 0; i < 5; i++) {
        equipmentService.updateStatus('pot-medium', 'clean');
      }

      expect(equipmentService.getEquipment('pot-medium')?.availableCount).toBeLessThanOrEqual(quantity);
    });

    it('should return false for non-existent equipment', () => {
      const result = equipmentService.updateStatus('fake-id', 'clean');

      expect(result).toBe(false);
    });
  });

  describe('Conflict Detection', () => {
    it('should detect overlapping equipment usage', () => {
      const baseTime = new Date();
      const usages: EquipmentUsage[] = [
        {
          equipmentId: 'oven',
          startTime: new Date(baseTime.getTime()),
          endTime: new Date(baseTime.getTime() + 30 * 60000),
          task: 'Roast vegetables',
          recipe: 'Mexican Bowl'
        },
        {
          equipmentId: 'oven',
          startTime: new Date(baseTime.getTime() + 15 * 60000),
          endTime: new Date(baseTime.getTime() + 45 * 60000),
          task: 'Bake chicken',
          recipe: 'Protein Prep'
        }
      ];

      const conflicts = equipmentService.detectConflicts(usages);

      expect(conflicts.length).toBe(1);
      expect(conflicts[0].equipmentName).toBe('Oven');
    });

    it('should not detect conflict when equipment has multiple units', () => {
      const baseTime = new Date();
      const usages: EquipmentUsage[] = [
        {
          equipmentId: 'pot-medium',
          startTime: new Date(baseTime.getTime()),
          endTime: new Date(baseTime.getTime() + 20 * 60000),
          task: 'Cook rice',
          recipe: 'Rice'
        },
        {
          equipmentId: 'pot-medium',
          startTime: new Date(baseTime.getTime() + 5 * 60000),
          endTime: new Date(baseTime.getTime() + 25 * 60000),
          task: 'Cook beans',
          recipe: 'Beans'
        }
      ];

      const conflicts = equipmentService.detectConflicts(usages);

      // Should not conflict because we have 2 medium pots
      expect(conflicts.length).toBe(0);
    });

    it('should provide alternatives for conflicts', () => {
      const baseTime = new Date();
      const usages: EquipmentUsage[] = [
        {
          equipmentId: 'oven',
          startTime: new Date(baseTime.getTime()),
          endTime: new Date(baseTime.getTime() + 60 * 60000),
          task: 'Roast',
          recipe: 'Recipe 1'
        },
        {
          equipmentId: 'oven',
          startTime: new Date(baseTime.getTime() + 30 * 60000),
          endTime: new Date(baseTime.getTime() + 90 * 60000),
          task: 'Bake',
          recipe: 'Recipe 2'
        }
      ];

      const conflicts = equipmentService.detectConflicts(usages);

      expect(conflicts[0].alternatives).toContain('air-fryer');
    });
  });

  describe('Usage Scheduling', () => {
    it('should schedule non-conflicting usage', () => {
      const usage: EquipmentUsage = {
        equipmentId: 'oven',
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        task: 'Roast vegetables',
        recipe: 'Mexican Bowl'
      };

      const result = equipmentService.scheduleUsage(usage);

      expect(result.success).toBe(true);
      expect(result.conflict).toBeUndefined();
    });

    it('should reject conflicting usage', () => {
      const baseTime = new Date();

      // Schedule first usage
      equipmentService.scheduleUsage({
        equipmentId: 'oven',
        startTime: new Date(baseTime.getTime()),
        endTime: new Date(baseTime.getTime() + 30 * 60000),
        task: 'Roast vegetables',
        recipe: 'Mexican Bowl'
      });

      // Try to schedule conflicting usage
      const result = equipmentService.scheduleUsage({
        equipmentId: 'oven',
        startTime: new Date(baseTime.getTime() + 15 * 60000),
        endTime: new Date(baseTime.getTime() + 45 * 60000),
        task: 'Bake chicken',
        recipe: 'Protein Prep'
      });

      expect(result.success).toBe(false);
      expect(result.conflict).toBeDefined();
    });

    it('should fail for non-existent equipment', () => {
      const usage: EquipmentUsage = {
        equipmentId: 'fake-equipment',
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000),
        task: 'Test',
        recipe: 'Test'
      };

      const result = equipmentService.scheduleUsage(usage);

      expect(result.success).toBe(false);
    });
  });

  describe('Cleaning Time Estimation', () => {
    it('should estimate cleaning time for different equipment', () => {
      expect(equipmentService.estimateCleaningTime('oven')).toBe(10);
      expect(equipmentService.estimateCleaningTime('pot-medium')).toBe(2);
      expect(equipmentService.estimateCleaningTime('cutting-board')).toBe(1);
    });

    it('should return default for unknown equipment', () => {
      expect(equipmentService.estimateCleaningTime('unknown')).toBe(2);
    });
  });

  describe('Prep Checklist Generation', () => {
    it('should generate checklist with ready equipment', () => {
      const required = ['oven', 'pot-medium', 'cutting-board'];

      const checklist = equipmentService.generatePrepChecklist(required);

      expect(checklist.ready.length).toBe(3);
      expect(checklist.needsCleaning.length).toBe(0);
      expect(checklist.unavailable.length).toBe(0);
    });

    it('should identify equipment needing cleaning', () => {
      equipmentService.updateStatus('pot-medium', 'dirty');

      const checklist = equipmentService.generatePrepChecklist(['pot-medium']);

      expect(checklist.needsCleaning.length).toBe(1);
    });

    it('should identify unavailable equipment', () => {
      const checklist = equipmentService.generatePrepChecklist(['non-existent', 'pot-medium']);

      expect(checklist.unavailable).toContain('non-existent');
    });

    it('should identify equipment under maintenance', () => {
      equipmentService.updateStatus('food-processor', 'maintenance');

      const checklist = equipmentService.generatePrepChecklist(['food-processor']);

      expect(checklist.unavailable).toContain('Food Processor');
    });
  });

  describe('Parallel Task Optimization', () => {
    it('should optimize parallel task execution', () => {
      const tasks = [
        { equipmentId: 'oven', duration: 30, task: 'Roast vegetables' },
        { equipmentId: 'stovetop', duration: 20, task: 'Cook rice' },
        { equipmentId: 'stovetop', duration: 15, task: 'Sauté onions' }
      ];

      const result = equipmentService.optimizeParallelTasks(tasks);

      expect(result.timeline.length).toBe(3);
      expect(result.totalTime).toBeGreaterThan(0);
    });

    it('should calculate equipment utilization', () => {
      const tasks = [
        { equipmentId: 'oven', duration: 30, task: 'Roast' },
        { equipmentId: 'stovetop', duration: 30, task: 'Cook' }
      ];

      const result = equipmentService.optimizeParallelTasks(tasks);

      expect(result.equipmentUtilization['Oven']).toBeDefined();
      expect(result.equipmentUtilization['Stovetop']).toBeDefined();
    });

    it('should sequence same-equipment tasks', () => {
      const tasks = [
        { equipmentId: 'oven', duration: 20, task: 'Task 1' },
        { equipmentId: 'oven', duration: 20, task: 'Task 2' }
      ];

      const result = equipmentService.optimizeParallelTasks(tasks);

      // Second oven task should start after first ends
      const ovenTasks = result.timeline.filter(t => t.equipment === 'Oven');
      expect(ovenTasks[1].time).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Dishwasher Management', () => {
    it('should start dishwasher cycle with dirty items', () => {
      equipmentService.updateStatus('pot-medium', 'dirty');
      equipmentService.updateStatus('cutting-board', 'dirty');

      const result = equipmentService.startDishwasherCycle();

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.estimatedCompletion.getTime()).toBeGreaterThan(Date.now());
    });

    it('should complete dishwasher cycle and mark items clean', () => {
      equipmentService.updateStatus('pot-medium', 'dirty');
      equipmentService.startDishwasherCycle();

      const cleaned = equipmentService.completeDishwasherCycle();

      expect(cleaned.length).toBeGreaterThanOrEqual(1);
      cleaned.forEach(item => {
        expect(equipmentService.getEquipment(item.id)?.status).toBe('clean');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty task list', () => {
      const result = equipmentService.optimizeParallelTasks([]);

      expect(result.timeline.length).toBe(0);
      expect(result.totalTime).toBe(0);
    });

    it('should handle equipment with zero quantity', () => {
      // Simulate all medium pots being used
      const pot = equipmentService.getEquipment('pot-medium');
      if (pot) {
        pot.availableCount = 0;
      }

      const available = equipmentService.getAvailableEquipment();
      expect(available.find(e => e.id === 'pot-medium')).toBeUndefined();
    });

    it('should handle exact time boundary (no overlap)', () => {
      const baseTime = new Date();

      // First usage ends exactly when second begins
      equipmentService.scheduleUsage({
        equipmentId: 'oven',
        startTime: new Date(baseTime.getTime()),
        endTime: new Date(baseTime.getTime() + 30 * 60000),
        task: 'Task 1',
        recipe: 'Recipe 1'
      });

      const result = equipmentService.scheduleUsage({
        equipmentId: 'oven',
        startTime: new Date(baseTime.getTime() + 30 * 60000),
        endTime: new Date(baseTime.getTime() + 60 * 60000),
        task: 'Task 2',
        recipe: 'Recipe 2'
      });

      expect(result.success).toBe(true);
    });
  });
});
