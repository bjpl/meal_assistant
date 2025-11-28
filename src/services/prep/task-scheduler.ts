/**
 * Task Scheduler
 * Topological sort and dependency resolution for prep tasks
 */

import {
  PrepTask,
  TimeSlot,
  Timeline,
  EquipmentUsage,
  PrepConfig,
  DEFAULT_PREP_CONFIG
} from '../../types/prep.types';

// ============================================================================
// Topological Sort Implementation
// ============================================================================

interface TaskNode {
  task: PrepTask;
  inDegree: number;
  dependents: string[];
}

export function topologicalSort(tasks: PrepTask[]): PrepTask[] {
  // Build adjacency list and in-degree count
  const nodes = new Map<string, TaskNode>();

  for (const task of tasks) {
    nodes.set(task.id, {
      task,
      inDegree: task.dependencies.length,
      dependents: []
    });
  }

  // Build reverse dependency graph
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      const depNode = nodes.get(depId);
      if (depNode) {
        depNode.dependents.push(task.id);
      }
    }
  }

  // Kahn's algorithm with priority consideration
  const queue: PrepTask[] = [];
  const result: PrepTask[] = [];

  // Start with tasks that have no dependencies
  for (const [, node] of nodes) {
    if (node.inDegree === 0) {
      queue.push(node.task);
    }
  }

  // Sort queue by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  queue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    const currentNode = nodes.get(current.id)!;
    for (const dependentId of currentNode.dependents) {
      const dependentNode = nodes.get(dependentId)!;
      dependentNode.inDegree--;

      if (dependentNode.inDegree === 0) {
        // Insert maintaining priority order
        const insertIndex = queue.findIndex(
          t => priorityOrder[t.priority] > priorityOrder[dependentNode.task.priority]
        );
        if (insertIndex === -1) {
          queue.push(dependentNode.task);
        } else {
          queue.splice(insertIndex, 0, dependentNode.task);
        }
      }
    }
  }

  // Check for cycles
  if (result.length !== tasks.length) {
    const scheduled = new Set(result.map(t => t.id));
    const unscheduled = tasks.filter(t => !scheduled.has(t.id));
    throw new Error(
      `Circular dependency detected involving tasks: ${unscheduled.map(t => t.name).join(', ')}`
    );
  }

  return result;
}

// ============================================================================
// Critical Path Analysis
// ============================================================================

export function findCriticalPath(tasks: PrepTask[]): string[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const earliestStart = new Map<string, number>();
  const earliestEnd = new Map<string, number>();
  const latestStart = new Map<string, number>();
  const latestEnd = new Map<string, number>();

  // Forward pass - calculate earliest times
  const sorted = topologicalSort(tasks);

  for (const task of sorted) {
    let maxPredecessorEnd = 0;
    for (const depId of task.dependencies) {
      const depEnd = earliestEnd.get(depId) || 0;
      maxPredecessorEnd = Math.max(maxPredecessorEnd, depEnd);
    }
    earliestStart.set(task.id, maxPredecessorEnd);
    earliestEnd.set(task.id, maxPredecessorEnd + task.duration);
  }

  // Find project end time
  let projectEnd = 0;
  for (const [, end] of earliestEnd) {
    projectEnd = Math.max(projectEnd, end);
  }

  // Backward pass - calculate latest times
  for (let i = sorted.length - 1; i >= 0; i--) {
    const task = sorted[i];
    const taskNode = taskMap.get(task.id)!;

    // Find minimum latest start of successors
    let minSuccessorStart = projectEnd;
    for (const t of tasks) {
      if (t.dependencies.includes(task.id)) {
        const ls = latestStart.get(t.id);
        if (ls !== undefined) {
          minSuccessorStart = Math.min(minSuccessorStart, ls);
        }
      }
    }

    latestEnd.set(task.id, minSuccessorStart);
    latestStart.set(task.id, minSuccessorStart - taskNode.duration);
  }

  // Critical path = tasks where earliest start equals latest start
  const criticalPath: string[] = [];
  for (const task of sorted) {
    const es = earliestStart.get(task.id)!;
    const ls = latestStart.get(task.id)!;
    if (Math.abs(es - ls) < 0.001) { // Float comparison
      criticalPath.push(task.id);
    }
  }

  return criticalPath;
}

// ============================================================================
// Task Scheduler Class
// ============================================================================

export class TaskScheduler {
  private config: PrepConfig;

  constructor(config: Partial<PrepConfig> = {}) {
    this.config = { ...DEFAULT_PREP_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Schedule Generation
  // --------------------------------------------------------------------------

  createSchedule(
    tasks: PrepTask[],
    equipmentAvailability: Map<string, number[]> = new Map()
  ): Timeline {
    const sorted = topologicalSort(tasks);
    const criticalPath = findCriticalPath(tasks);

    const slots: TimeSlot[] = [];
    const taskEndTimes = new Map<string, number>();
    const equipmentUsage = new Map<string, TimeSlot[]>();

    // Initialize equipment tracking
    for (const task of tasks) {
      for (const eqId of task.equipment) {
        if (!equipmentUsage.has(eqId)) {
          equipmentUsage.set(eqId, []);
        }
      }
    }

    // Schedule each task
    for (const task of sorted) {
      const startTime = this.calculateStartTime(
        task,
        taskEndTimes,
        equipmentUsage,
        equipmentAvailability
      );

      const endTime = startTime + task.duration;

      const slot: TimeSlot = {
        taskId: task.id,
        startTime,
        endTime,
        equipment: task.equipment,
        isCleanup: false
      };

      slots.push(slot);
      taskEndTimes.set(task.id, endTime);

      // Track equipment usage
      for (const eqId of task.equipment) {
        equipmentUsage.get(eqId)!.push(slot);
      }

      // Add cleaning buffer if configured
      if (this.config.cleaningBufferMinutes > 0 && task.cleaningTime > 0) {
        const cleanupSlot: TimeSlot = {
          taskId: `${task.id}-cleanup`,
          startTime: endTime,
          endTime: endTime + Math.min(task.cleaningTime, this.config.cleaningBufferMinutes),
          equipment: task.equipment,
          isCleanup: true
        };
        slots.push(cleanupSlot);
      }
    }

    // Calculate total duration
    const maxEndTime = Math.max(...slots.map(s => s.endTime));

    // Build equipment usage summary
    const usageSummary: EquipmentUsage[] = [];
    for (const [eqId, eqSlots] of equipmentUsage) {
      const totalUsed = eqSlots.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
      usageSummary.push({
        equipmentId: eqId,
        slots: eqSlots,
        utilizationPercent: (totalUsed / maxEndTime) * 100
      });
    }

    // Identify parallel task groups
    const parallelTasks = this.identifyParallelGroups(slots);

    const now = new Date();
    return {
      id: `timeline-${Date.now()}`,
      totalDuration: maxEndTime,
      startTime: now,
      endTime: new Date(now.getTime() + maxEndTime * 60000),
      slots,
      equipmentUsage: usageSummary,
      parallelTasks,
      criticalPath
    };
  }

  // --------------------------------------------------------------------------
  // Start Time Calculation
  // --------------------------------------------------------------------------

  private calculateStartTime(
    task: PrepTask,
    taskEndTimes: Map<string, number>,
    equipmentUsage: Map<string, TimeSlot[]>,
    equipmentAvailability: Map<string, number[]>
  ): number {
    let startTime = 0;

    // Must start after all dependencies complete
    for (const depId of task.dependencies) {
      const depEnd = taskEndTimes.get(depId);
      if (depEnd !== undefined) {
        startTime = Math.max(startTime, depEnd);
      }
    }

    // Must start when all equipment is available
    for (const eqId of task.equipment) {
      const usage = equipmentUsage.get(eqId) || [];

      // Find first available slot
      let proposedStart = startTime;
      let foundSlot = false;

      while (!foundSlot) {
        foundSlot = true;
        const proposedEnd = proposedStart + task.duration;

        for (const slot of usage) {
          // Check for overlap
          if (proposedStart < slot.endTime && proposedEnd > slot.startTime) {
            proposedStart = slot.endTime;
            foundSlot = false;
            break;
          }
        }
      }

      startTime = Math.max(startTime, proposedStart);

      // Check equipment-specific availability windows
      const windows = equipmentAvailability.get(eqId);
      if (windows && windows.length > 0) {
        // Find next available window
        for (let i = 0; i < windows.length; i += 2) {
          const windowStart = windows[i];
          const windowEnd = windows[i + 1];
          if (startTime >= windowStart && startTime + task.duration <= windowEnd) {
            break;
          }
          if (startTime < windowStart) {
            startTime = windowStart;
            break;
          }
        }
      }
    }

    return startTime;
  }

  // --------------------------------------------------------------------------
  // Parallel Group Identification
  // --------------------------------------------------------------------------

  private identifyParallelGroups(slots: TimeSlot[]): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();

    // Sort by start time
    const sortedSlots = [...slots]
      .filter(s => !s.isCleanup)
      .sort((a, b) => a.startTime - b.startTime);

    for (const slot of sortedSlots) {
      if (processed.has(slot.taskId)) continue;

      // Find all slots that overlap with this one
      const parallel = sortedSlots.filter(s =>
        !processed.has(s.taskId) &&
        s.startTime < slot.endTime &&
        s.endTime > slot.startTime
      );

      if (parallel.length > 1) {
        const group = parallel.map(s => s.taskId);
        groups.push(group);
        group.forEach(id => processed.add(id));
      } else {
        processed.add(slot.taskId);
      }
    }

    return groups;
  }

  // --------------------------------------------------------------------------
  // Rescheduling
  // --------------------------------------------------------------------------

  rescheduleTask(
    timeline: Timeline,
    taskId: string,
    _newStartTime: number,
    tasks: PrepTask[]
  ): Timeline {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const task = taskMap.get(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Find the slot to modify
    const slotIndex = timeline.slots.findIndex(s => s.taskId === taskId);
    if (slotIndex === -1) {
      throw new Error(`Slot for task ${taskId} not found`);
    }

    // Create modified tasks with dependency update
    const modifiedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return { ...t };
      }
      return t;
    });

    // Regenerate schedule with constraint
    const equipmentAvailability = new Map<string, number[]>();
    // Could add specific time windows here

    return this.createSchedule(modifiedTasks, equipmentAvailability);
  }

  // --------------------------------------------------------------------------
  // Time Estimation
  // --------------------------------------------------------------------------

  estimateTotalTime(tasks: PrepTask[]): number {
    const timeline = this.createSchedule(tasks);
    return timeline.totalDuration;
  }

  estimateWithoutParallelization(tasks: PrepTask[]): number {
    return tasks.reduce((sum, t) => sum + t.duration, 0);
  }

  calculateTimeSavings(tasks: PrepTask[]): number {
    const sequential = this.estimateWithoutParallelization(tasks);
    const parallel = this.estimateTotalTime(tasks);
    return sequential - parallel;
  }
}
