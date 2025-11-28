/**
 * Unit Tests: Prep Scheduling Algorithms
 * Tests for meal prep orchestration, timeline generation, and optimization
 * Target: 90% coverage
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Types
interface PrepTask {
  id: string;
  name: string;
  duration: number; // minutes
  equipment: string[];
  dependencies: string[];
  canParallel: boolean;
  cleaningTime: number;
}

interface PrepTimeline {
  startTime: Date;
  tasks: ScheduledTask[];
  totalDuration: number;
  criticalPath: string[];
  bufferTime: number;
}

interface ScheduledTask {
  taskId: string;
  taskName: string;
  startTime: Date;
  endTime: Date;
  equipment: string[];
  status: 'pending' | 'in-progress' | 'completed';
}

// Prep Scheduling Service
const createPrepSchedulingService = () => {
  const recipes: Record<string, PrepTask[]> = {
    'mexican-bowl': [
      { id: 'mb-rice', name: 'Cook Rice', duration: 30, equipment: ['pot-medium', 'stovetop'], dependencies: [], canParallel: true, cleaningTime: 2 },
      { id: 'mb-beans', name: 'Heat Beans', duration: 15, equipment: ['pot-small', 'stovetop'], dependencies: [], canParallel: true, cleaningTime: 2 },
      { id: 'mb-onions', name: 'Caramelize Onions', duration: 45, equipment: ['pan', 'stovetop'], dependencies: [], canParallel: true, cleaningTime: 3 },
      { id: 'mb-chop', name: 'Chop Vegetables', duration: 10, equipment: ['cutting-board', 'knife'], dependencies: [], canParallel: true, cleaningTime: 1 },
      { id: 'mb-assemble', name: 'Assemble Bowls', duration: 5, equipment: ['bowls'], dependencies: ['mb-rice', 'mb-beans', 'mb-onions', 'mb-chop'], canParallel: false, cleaningTime: 0 }
    ],
    'roasted-vegetables': [
      { id: 'rv-preheat', name: 'Preheat Oven', duration: 10, equipment: ['oven'], dependencies: [], canParallel: true, cleaningTime: 0 },
      { id: 'rv-prep', name: 'Prep Vegetables', duration: 15, equipment: ['cutting-board', 'knife'], dependencies: [], canParallel: true, cleaningTime: 1 },
      { id: 'rv-season', name: 'Season & Toss', duration: 5, equipment: ['mixing-bowl'], dependencies: ['rv-prep'], canParallel: false, cleaningTime: 1 },
      { id: 'rv-roast', name: 'Roast in Oven', duration: 30, equipment: ['oven', 'sheet-pan'], dependencies: ['rv-preheat', 'rv-season'], canParallel: true, cleaningTime: 3 }
    ],
    'protein-prep': [
      { id: 'pp-marinate', name: 'Marinate Chicken', duration: 30, equipment: ['container'], dependencies: [], canParallel: true, cleaningTime: 1 },
      { id: 'pp-preheat', name: 'Preheat Grill/Pan', duration: 5, equipment: ['grill-pan', 'stovetop'], dependencies: [], canParallel: true, cleaningTime: 0 },
      { id: 'pp-cook', name: 'Cook Chicken', duration: 20, equipment: ['grill-pan', 'stovetop'], dependencies: ['pp-marinate', 'pp-preheat'], canParallel: true, cleaningTime: 3 },
      { id: 'pp-rest', name: 'Rest Protein', duration: 5, equipment: [], dependencies: ['pp-cook'], canParallel: false, cleaningTime: 0 },
      { id: 'pp-slice', name: 'Slice & Portion', duration: 10, equipment: ['cutting-board', 'knife'], dependencies: ['pp-rest'], canParallel: false, cleaningTime: 1 }
    ]
  };

  return {
    getRecipeTasks(recipeId: string): PrepTask[] {
      return recipes[recipeId] || [];
    },

    generateTimeline(recipeIds: string[], startTime: Date): PrepTimeline {
      const allTasks: PrepTask[] = [];
      recipeIds.forEach(id => {
        const recipeTasks = recipes[id] || [];
        allTasks.push(...recipeTasks);
      });

      if (allTasks.length === 0) {
        return {
          startTime,
          tasks: [],
          totalDuration: 0,
          criticalPath: [],
          bufferTime: 0
        };
      }

      const scheduledTasks: ScheduledTask[] = [];
      const taskEndTimes = new Map<string, Date>();
      const equipmentEndTimes = new Map<string, Date>();

      // Topological sort based on dependencies
      const sorted = this.topologicalSort(allTasks);

      sorted.forEach(task => {
        // Calculate earliest start based on dependencies
        let earliestStart = startTime;

        task.dependencies.forEach(depId => {
          const depEndTime = taskEndTimes.get(depId);
          if (depEndTime && depEndTime > earliestStart) {
            earliestStart = depEndTime;
          }
        });

        // Check equipment availability
        task.equipment.forEach(equip => {
          const equipEnd = equipmentEndTimes.get(equip);
          if (equipEnd && equipEnd > earliestStart) {
            earliestStart = equipEnd;
          }
        });

        const taskStart = earliestStart;
        const taskEnd = new Date(taskStart.getTime() + task.duration * 60000);

        scheduledTasks.push({
          taskId: task.id,
          taskName: task.name,
          startTime: taskStart,
          endTime: taskEnd,
          equipment: task.equipment,
          status: 'pending'
        });

        taskEndTimes.set(task.id, taskEnd);

        // Update equipment end times (including cleaning)
        const totalTime = task.duration + task.cleaningTime;
        const equipEndWithCleaning = new Date(taskStart.getTime() + totalTime * 60000);
        task.equipment.forEach(equip => {
          equipmentEndTimes.set(equip, equipEndWithCleaning);
        });
      });

      // Calculate total duration
      const lastTask = scheduledTasks.reduce((latest, task) =>
        task.endTime > latest.endTime ? task : latest
      , scheduledTasks[0]);

      const totalDuration = Math.round(
        (lastTask.endTime.getTime() - startTime.getTime()) / 60000
      );

      // Calculate critical path
      const criticalPath = this.findCriticalPath(allTasks, taskEndTimes);

      // Add 10% buffer
      const bufferTime = Math.ceil(totalDuration * 0.1);

      return {
        startTime,
        tasks: scheduledTasks.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
        totalDuration: totalDuration + bufferTime,
        criticalPath,
        bufferTime
      };
    },

    topologicalSort(tasks: PrepTask[]): PrepTask[] {
      const sorted: PrepTask[] = [];
      const visited = new Set<string>();
      const visiting = new Set<string>();

      const taskMap = new Map(tasks.map(t => [t.id, t]));

      const visit = (task: PrepTask) => {
        if (visited.has(task.id)) return;
        if (visiting.has(task.id)) {
          throw new Error(`Circular dependency detected: ${task.id}`);
        }

        visiting.add(task.id);

        task.dependencies.forEach(depId => {
          const dep = taskMap.get(depId);
          if (dep) visit(dep);
        });

        visiting.delete(task.id);
        visited.add(task.id);
        sorted.push(task);
      };

      tasks.forEach(task => {
        if (!visited.has(task.id)) {
          visit(task);
        }
      });

      return sorted;
    },

    findCriticalPath(tasks: PrepTask[], endTimes: Map<string, Date>): string[] {
      // Find the path with longest total duration
      const taskMap = new Map(tasks.map(t => [t.id, t]));
      const paths: { path: string[]; duration: number }[] = [];

      const findPaths = (taskId: string, currentPath: string[], currentDuration: number) => {
        const task = taskMap.get(taskId);
        if (!task) return;

        currentPath.push(task.name);
        currentDuration += task.duration;

        const dependents = tasks.filter(t => t.dependencies.includes(taskId));

        if (dependents.length === 0) {
          paths.push({ path: [...currentPath], duration: currentDuration });
        } else {
          dependents.forEach(dep => {
            findPaths(dep.id, [...currentPath], currentDuration);
          });
        }
      };

      // Start from tasks with no dependencies
      const rootTasks = tasks.filter(t => t.dependencies.length === 0);
      rootTasks.forEach(task => {
        findPaths(task.id, [], 0);
      });

      if (paths.length === 0) return [];

      // Return longest path
      const longestPath = paths.reduce((max, p) =>
        p.duration > max.duration ? p : max
      , paths[0]);

      return longestPath.path;
    },

    calculateParallelism(tasks: ScheduledTask[]): number {
      if (tasks.length === 0) return 0;

      // Find maximum concurrent tasks at any point
      const events: { time: number; delta: number }[] = [];

      tasks.forEach(task => {
        events.push({ time: task.startTime.getTime(), delta: 1 });
        events.push({ time: task.endTime.getTime(), delta: -1 });
      });

      events.sort((a, b) => a.time - b.time || b.delta - a.delta);

      let current = 0;
      let max = 0;

      events.forEach(event => {
        current += event.delta;
        max = Math.max(max, current);
      });

      return max;
    },

    estimateTotalPrepTime(recipeIds: string[]): number {
      let totalSequential = 0;

      recipeIds.forEach(id => {
        const tasks = recipes[id] || [];
        tasks.forEach(task => {
          totalSequential += task.duration + task.cleaningTime;
        });
      });

      return totalSequential;
    },

    optimizeForWeekPrep(recipeIds: string[], servings: number, startTime: Date): {
      timeline: PrepTimeline;
      scaledDurations: Record<string, number>;
      containerRequirements: { type: string; count: number }[];
    } {
      // Scale durations based on servings
      const scaleFactor = servings > 4 ? 1.5 : 1;
      const scaledDurations: Record<string, number> = {};

      recipeIds.forEach(id => {
        const tasks = recipes[id] || [];
        tasks.forEach(task => {
          // Only scale prep tasks, not cooking tasks
          const isPrep = task.name.toLowerCase().includes('prep') ||
                        task.name.toLowerCase().includes('chop') ||
                        task.name.toLowerCase().includes('slice');
          scaledDurations[task.id] = isPrep
            ? Math.ceil(task.duration * scaleFactor)
            : task.duration;
        });
      });

      const timeline = this.generateTimeline(recipeIds, startTime);

      // Estimate container needs
      const containerRequirements = [
        { type: 'Large (4 cup)', count: Math.ceil(servings / 2) },
        { type: 'Medium (2 cup)', count: Math.ceil(servings / 3) },
        { type: 'Small (1 cup)', count: Math.ceil(servings / 4) }
      ];

      return { timeline, scaledDurations, containerRequirements };
    },

    insertCleaningBuffers(timeline: PrepTimeline, bufferMinutes: number): PrepTimeline {
      const adjustedTasks: ScheduledTask[] = [];
      const equipmentLastUsed = new Map<string, Date>();

      timeline.tasks.forEach(task => {
        let newStartTime = task.startTime;

        // Check if equipment needs cleaning buffer
        task.equipment.forEach(equip => {
          const lastUsed = equipmentLastUsed.get(equip);
          if (lastUsed) {
            const requiredStart = new Date(lastUsed.getTime() + bufferMinutes * 60000);
            if (requiredStart > newStartTime) {
              newStartTime = requiredStart;
            }
          }
        });

        const duration = task.endTime.getTime() - task.startTime.getTime();
        const newEndTime = new Date(newStartTime.getTime() + duration);

        adjustedTasks.push({
          ...task,
          startTime: newStartTime,
          endTime: newEndTime
        });

        // Update equipment last used
        task.equipment.forEach(equip => {
          equipmentLastUsed.set(equip, newEndTime);
        });
      });

      // Recalculate total duration
      const lastTask = adjustedTasks.reduce((latest, task) =>
        task.endTime > latest.endTime ? task : latest
      , adjustedTasks[0]);

      const baseDuration = Math.round(
        (lastTask.endTime.getTime() - timeline.startTime.getTime()) / 60000
      );

      // Add 10% buffer like the original timeline does
      const bufferTime = Math.ceil(baseDuration * 0.1);
      const totalDuration = baseDuration + bufferTime;

      return {
        ...timeline,
        tasks: adjustedTasks,
        totalDuration,
        bufferTime
      };
    },

    getParallelOpportunities(timeline: PrepTimeline): string[][] {
      const opportunities: string[][] = [];
      const timeSlots = new Map<number, string[]>();

      // Group tasks by 5-minute time slots
      timeline.tasks.forEach(task => {
        const slotStart = Math.floor(task.startTime.getTime() / (5 * 60000));
        const taskInfo = task.taskName;

        const slot = timeSlots.get(slotStart) || [];
        slot.push(taskInfo);
        timeSlots.set(slotStart, slot);
      });

      // Find slots with multiple tasks
      timeSlots.forEach((tasks) => {
        if (tasks.length > 1) {
          opportunities.push(tasks);
        }
      });

      return opportunities;
    }
  };
};

describe('Prep Scheduling', () => {
  let prepService: ReturnType<typeof createPrepSchedulingService>;

  beforeEach(() => {
    prepService = createPrepSchedulingService();
  });

  describe('Recipe Task Retrieval', () => {
    it('should get tasks for mexican-bowl recipe', () => {
      const tasks = prepService.getRecipeTasks('mexican-bowl');

      expect(tasks.length).toBe(5);
      expect(tasks.find(t => t.name === 'Cook Rice')).toBeDefined();
    });

    it('should return empty array for unknown recipe', () => {
      const tasks = prepService.getRecipeTasks('unknown-recipe');

      expect(tasks).toHaveLength(0);
    });
  });

  describe('Timeline Generation', () => {
    it('should generate timeline for single recipe', () => {
      const startTime = new Date('2024-01-01T14:00:00');
      const timeline = prepService.generateTimeline(['mexican-bowl'], startTime);

      expect(timeline.tasks.length).toBe(5);
      expect(timeline.startTime).toEqual(startTime);
      expect(timeline.totalDuration).toBeGreaterThan(0);
    });

    it('should generate timeline for multiple recipes', () => {
      const startTime = new Date('2024-01-01T14:00:00');
      const timeline = prepService.generateTimeline(
        ['mexican-bowl', 'roasted-vegetables'],
        startTime
      );

      expect(timeline.tasks.length).toBe(9); // 5 + 4
    });

    it('should respect task dependencies', () => {
      const startTime = new Date('2024-01-01T14:00:00');
      const timeline = prepService.generateTimeline(['mexican-bowl'], startTime);

      const assembleTask = timeline.tasks.find(t => t.taskName === 'Assemble Bowls');
      const riceTask = timeline.tasks.find(t => t.taskName === 'Cook Rice');

      expect(assembleTask!.startTime.getTime()).toBeGreaterThanOrEqual(
        riceTask!.endTime.getTime()
      );
    });

    it('should include buffer time', () => {
      const startTime = new Date('2024-01-01T14:00:00');
      const timeline = prepService.generateTimeline(['mexican-bowl'], startTime);

      expect(timeline.bufferTime).toBeGreaterThan(0);
    });

    it('should handle empty recipe list', () => {
      const startTime = new Date('2024-01-01T14:00:00');
      const timeline = prepService.generateTimeline([], startTime);

      expect(timeline.tasks).toHaveLength(0);
      expect(timeline.totalDuration).toBe(0);
    });

    it('should identify critical path', () => {
      const startTime = new Date('2024-01-01T14:00:00');
      const timeline = prepService.generateTimeline(['mexican-bowl'], startTime);

      expect(timeline.criticalPath.length).toBeGreaterThan(0);
      expect(timeline.criticalPath).toContain('Caramelize Onions'); // Longest task
    });
  });

  describe('Topological Sort', () => {
    it('should sort tasks respecting dependencies', () => {
      const tasks = prepService.getRecipeTasks('mexican-bowl');
      const sorted = prepService.topologicalSort(tasks);

      const assembleIndex = sorted.findIndex(t => t.id === 'mb-assemble');
      const riceIndex = sorted.findIndex(t => t.id === 'mb-rice');

      expect(riceIndex).toBeLessThan(assembleIndex);
    });

    it('should handle tasks with no dependencies', () => {
      const tasks = prepService.getRecipeTasks('roasted-vegetables');
      const sorted = prepService.topologicalSort(tasks);

      expect(sorted.length).toBe(tasks.length);
    });

    it('should detect circular dependencies', () => {
      const cyclicTasks: PrepTask[] = [
        { id: 'a', name: 'Task A', duration: 10, equipment: [], dependencies: ['b'], canParallel: false, cleaningTime: 0 },
        { id: 'b', name: 'Task B', duration: 10, equipment: [], dependencies: ['a'], canParallel: false, cleaningTime: 0 }
      ];

      expect(() => prepService.topologicalSort(cyclicTasks)).toThrow('Circular dependency');
    });
  });

  describe('Parallelism Calculation', () => {
    it('should calculate maximum concurrent tasks', () => {
      const startTime = new Date('2024-01-01T14:00:00');
      const timeline = prepService.generateTimeline(['mexican-bowl'], startTime);

      const parallelism = prepService.calculateParallelism(timeline.tasks);

      expect(parallelism).toBeGreaterThanOrEqual(1);
      expect(parallelism).toBeLessThanOrEqual(timeline.tasks.length);
    });

    it('should return 0 for empty task list', () => {
      const parallelism = prepService.calculateParallelism([]);

      expect(parallelism).toBe(0);
    });
  });

  describe('Time Estimation', () => {
    it('should estimate total sequential prep time', () => {
      const totalTime = prepService.estimateTotalPrepTime(['mexican-bowl']);

      // Sum of all durations + cleaning times
      // Rice(30+2) + Beans(15+2) + Onions(45+3) + Chop(10+1) + Assemble(5+0) = 113
      expect(totalTime).toBe(113);
    });

    it('should handle multiple recipes', () => {
      const totalTime = prepService.estimateTotalPrepTime([
        'mexican-bowl',
        'roasted-vegetables'
      ]);

      expect(totalTime).toBeGreaterThan(
        prepService.estimateTotalPrepTime(['mexican-bowl'])
      );
    });
  });

  describe('Week Prep Optimization', () => {
    it('should scale durations for larger servings', () => {
      const startTime = new Date('2024-01-01T10:00:00');
      const result = prepService.optimizeForWeekPrep(['mexican-bowl'], 8, startTime);

      expect(result.scaledDurations).toBeDefined();
      expect(result.timeline).toBeDefined();
    });

    it('should calculate container requirements', () => {
      const startTime = new Date('2024-01-01T10:00:00');
      const result = prepService.optimizeForWeekPrep(['mexican-bowl'], 6, startTime);

      expect(result.containerRequirements.length).toBeGreaterThan(0);
      expect(result.containerRequirements[0]).toHaveProperty('type');
      expect(result.containerRequirements[0]).toHaveProperty('count');
    });
  });

  describe('Cleaning Buffer Insertion', () => {
    it('should add cleaning buffers between equipment uses', () => {
      const startTime = new Date('2024-01-01T14:00:00');
      const originalTimeline = prepService.generateTimeline(['mexican-bowl'], startTime);

      const bufferedTimeline = prepService.insertCleaningBuffers(originalTimeline, 2);

      // Buffered timeline should be longer
      expect(bufferedTimeline.totalDuration).toBeGreaterThanOrEqual(
        originalTimeline.totalDuration
      );
    });

    it('should track buffer time added', () => {
      const startTime = new Date('2024-01-01T14:00:00');
      const originalTimeline = prepService.generateTimeline(['mexican-bowl'], startTime);

      const bufferedTimeline = prepService.insertCleaningBuffers(originalTimeline, 3);

      expect(bufferedTimeline.bufferTime).toBeGreaterThan(0);
    });
  });

  describe('Parallel Opportunities', () => {
    it('should identify parallel task opportunities', () => {
      const startTime = new Date('2024-01-01T14:00:00');
      const timeline = prepService.generateTimeline(['mexican-bowl'], startTime);

      const opportunities = prepService.getParallelOpportunities(timeline);

      // Mexican bowl has several tasks that can run in parallel
      expect(opportunities.length).toBeGreaterThan(0);
    });

    it('should group concurrent tasks', () => {
      const startTime = new Date('2024-01-01T14:00:00');
      const timeline = prepService.generateTimeline(['mexican-bowl'], startTime);

      const opportunities = prepService.getParallelOpportunities(timeline);

      // Each opportunity should have 2+ tasks
      opportunities.forEach(opp => {
        expect(opp.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle recipe with single task', () => {
      // This is simulated - protein-prep has sequenced tasks
      const startTime = new Date('2024-01-01T14:00:00');
      const timeline = prepService.generateTimeline(['protein-prep'], startTime);

      expect(timeline.tasks.length).toBe(5);
    });

    it('should handle far future start times', () => {
      const startTime = new Date('2030-01-01T14:00:00');
      const timeline = prepService.generateTimeline(['mexican-bowl'], startTime);

      expect(timeline.startTime).toEqual(startTime);
      expect(timeline.tasks[0].startTime.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
    });

    it('should handle very large number of recipes', () => {
      const startTime = new Date('2024-01-01T14:00:00');
      const manyRecipes = Array(10).fill(['mexican-bowl', 'roasted-vegetables']).flat();

      const timeline = prepService.generateTimeline(manyRecipes, startTime);

      // Tasks are deduplicated by ID - same recipes produce same task IDs
      // mexican-bowl has 5 tasks, roasted-vegetables has 4 = 9 unique tasks
      expect(timeline.tasks.length).toBe(9);
    });
  });
});
