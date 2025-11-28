/**
 * Conflict Resolver
 * Detects and resolves scheduling conflicts using constraint satisfaction
 */

import {
  PrepTask,
  Timeline,
  TimeSlot,
  Conflict,
  Resolution,
  PrepConfig,
  DEFAULT_PREP_CONFIG
} from '../../types/prep.types';
import { EquipmentManager } from './equipment-manager';

// ============================================================================
// Conflict Detection
// ============================================================================

export class ConflictDetector {
  private equipmentManager: EquipmentManager;
  private config: PrepConfig;

  constructor(
    equipmentManager: EquipmentManager,
    config: Partial<PrepConfig> = {}
  ) {
    this.equipmentManager = equipmentManager;
    this.config = { ...DEFAULT_PREP_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Main Detection Method
  // --------------------------------------------------------------------------

  detectAll(timeline: Timeline, tasks: PrepTask[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    conflicts.push(...this.detectEquipmentOverlaps(timeline));
    conflicts.push(...this.detectSlotExceeded(timeline));
    conflicts.push(...this.detectDependencyViolations(timeline, taskMap));
    conflicts.push(...this.detectAttentionOverload(timeline, taskMap));

    return conflicts;
  }

  // --------------------------------------------------------------------------
  // Equipment Overlap Detection
  // --------------------------------------------------------------------------

  detectEquipmentOverlaps(timeline: Timeline): Conflict[] {
    const conflicts: Conflict[] = [];
    const equipmentSlots = new Map<string, TimeSlot[]>();

    // Group slots by equipment
    for (const slot of timeline.slots) {
      if (slot.isCleanup) continue;

      for (const eqId of slot.equipment) {
        if (!equipmentSlots.has(eqId)) {
          equipmentSlots.set(eqId, []);
        }
        equipmentSlots.get(eqId)!.push(slot);
      }
    }

    // Check each equipment for overlaps
    for (const [eqId, slots] of equipmentSlots) {
      const equipment = this.equipmentManager.getById(eqId);
      const maxSlots = equipment?.slots ?? equipment?.capacity ?? 1;

      // Sort by start time
      slots.sort((a, b) => a.startTime - b.startTime);

      // Check each time point for conflicts
      const events: { time: number; type: 'start' | 'end'; slot: TimeSlot }[] = [];
      for (const slot of slots) {
        events.push({ time: slot.startTime, type: 'start', slot });
        events.push({ time: slot.endTime, type: 'end', slot });
      }
      events.sort((a, b) => a.time - b.time || (a.type === 'end' ? -1 : 1));

      const activeSlots: TimeSlot[] = [];
      for (const event of events) {
        if (event.type === 'start') {
          activeSlots.push(event.slot);

          if (activeSlots.length > maxSlots) {
            conflicts.push({
              id: `conflict-${Date.now()}-${Math.random()}`,
              type: 'equipment_overlap',
              taskIds: activeSlots.map(s => s.taskId),
              equipmentId: eqId,
              timeRange: [
                Math.min(...activeSlots.map(s => s.startTime)),
                Math.max(...activeSlots.map(s => s.endTime))
              ],
              severity: 'critical',
              description: `Equipment "${equipment?.name || eqId}" is overbooked with ${activeSlots.length} tasks (max: ${maxSlots})`
            });
          }
        } else {
          const index = activeSlots.findIndex(s => s.taskId === event.slot.taskId);
          if (index > -1) {
            activeSlots.splice(index, 1);
          }
        }
      }
    }

    return conflicts;
  }

  // --------------------------------------------------------------------------
  // Slot Exceeded Detection (for multi-slot equipment)
  // --------------------------------------------------------------------------

  detectSlotExceeded(timeline: Timeline): Conflict[] {
    const conflicts: Conflict[] = [];

    // Group by equipment with slots
    const ovenSlots: TimeSlot[] = [];
    const burnerSlots: TimeSlot[] = [];

    for (const slot of timeline.slots) {
      if (slot.isCleanup) continue;

      for (const eqId of slot.equipment) {
        if (eqId === 'oven' || eqId.startsWith('oven-rack')) {
          ovenSlots.push(slot);
        }
        if (eqId.startsWith('burner')) {
          burnerSlots.push(slot);
        }
      }
    }

    // Check oven capacity (2 racks typically)
    const ovenConflict = this.checkCapacityAtTime(ovenSlots, 2, 'oven');
    if (ovenConflict) conflicts.push(ovenConflict);

    // Check burner capacity (4 typically)
    const burnerConflict = this.checkCapacityAtTime(burnerSlots, 4, 'stovetop');
    if (burnerConflict) conflicts.push(burnerConflict);

    return conflicts;
  }

  private checkCapacityAtTime(
    slots: TimeSlot[],
    maxCapacity: number,
    resourceName: string
  ): Conflict | null {
    if (slots.length === 0) return null;

    const events: { time: number; delta: number; taskId: string }[] = [];
    for (const slot of slots) {
      events.push({ time: slot.startTime, delta: 1, taskId: slot.taskId });
      events.push({ time: slot.endTime, delta: -1, taskId: slot.taskId });
    }
    events.sort((a, b) => a.time - b.time);

    let current = 0;
    let maxUsed = 0;
    const activeTasks: string[] = [];
    let peakTime = 0;

    for (const event of events) {
      if (event.delta > 0) {
        activeTasks.push(event.taskId);
      } else {
        const idx = activeTasks.indexOf(event.taskId);
        if (idx > -1) activeTasks.splice(idx, 1);
      }

      current += event.delta;
      if (current > maxUsed) {
        maxUsed = current;
        peakTime = event.time;
      }
    }

    if (maxUsed > maxCapacity) {
      return {
        id: `conflict-${Date.now()}-${Math.random()}`,
        type: 'slot_exceeded',
        taskIds: activeTasks,
        timeRange: [peakTime, peakTime],
        severity: 'critical',
        description: `${resourceName} capacity exceeded: ${maxUsed} tasks need ${resourceName} (max: ${maxCapacity})`
      };
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Dependency Violation Detection
  // --------------------------------------------------------------------------

  detectDependencyViolations(
    timeline: Timeline,
    taskMap: Map<string, PrepTask>
  ): Conflict[] {
    const conflicts: Conflict[] = [];
    const slotMap = new Map(timeline.slots.map(s => [s.taskId, s]));

    for (const slot of timeline.slots) {
      if (slot.isCleanup) continue;

      const task = taskMap.get(slot.taskId);
      if (!task) continue;

      for (const depId of task.dependencies) {
        const depSlot = slotMap.get(depId);
        if (!depSlot) continue;

        // Dependency must end before this task starts
        if (depSlot.endTime > slot.startTime) {
          conflicts.push({
            id: `conflict-${Date.now()}-${Math.random()}`,
            type: 'dependency_violation',
            taskIds: [slot.taskId, depId],
            timeRange: [slot.startTime, depSlot.endTime],
            severity: 'critical',
            description: `Task "${task.name}" starts at ${slot.startTime}min but depends on task that ends at ${depSlot.endTime}min`
          });
        }
      }
    }

    return conflicts;
  }

  // --------------------------------------------------------------------------
  // Attention Overload Detection
  // --------------------------------------------------------------------------

  detectAttentionOverload(
    timeline: Timeline,
    taskMap: Map<string, PrepTask>
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    // Get all slots requiring attention
    const attentionSlots = timeline.slots.filter(s => {
      const task = taskMap.get(s.taskId);
      return task?.requiresAttention && !s.isCleanup;
    });

    if (attentionSlots.length === 0) return conflicts;

    // Check for overlapping attention requirements
    const events: { time: number; type: 'start' | 'end'; slot: TimeSlot }[] = [];
    for (const slot of attentionSlots) {
      events.push({ time: slot.startTime, type: 'start', slot });
      events.push({ time: slot.endTime, type: 'end', slot });
    }
    events.sort((a, b) => a.time - b.time || (a.type === 'end' ? -1 : 1));

    const activeAttention: TimeSlot[] = [];
    for (const event of events) {
      if (event.type === 'start') {
        activeAttention.push(event.slot);

        if (activeAttention.length > this.config.attentionThreshold) {
          conflicts.push({
            id: `conflict-${Date.now()}-${Math.random()}`,
            type: 'attention_overload',
            taskIds: activeAttention.map(s => s.taskId),
            timeRange: [
              Math.min(...activeAttention.map(s => s.startTime)),
              Math.max(...activeAttention.map(s => s.endTime))
            ],
            severity: 'warning',
            description: `${activeAttention.length} tasks require active attention simultaneously (recommended max: ${this.config.attentionThreshold})`
          });
        }
      } else {
        const idx = activeAttention.findIndex(s => s.taskId === event.slot.taskId);
        if (idx > -1) activeAttention.splice(idx, 1);
      }
    }

    return conflicts;
  }
}

// ============================================================================
// Conflict Resolver
// ============================================================================

export class ConflictResolver {
  private equipmentManager: EquipmentManager;

  constructor(equipmentManager: EquipmentManager) {
    this.equipmentManager = equipmentManager;
  }

  // --------------------------------------------------------------------------
  // Main Resolution Method
  // --------------------------------------------------------------------------

  resolveAll(conflicts: Conflict[], tasks: PrepTask[]): Resolution[] {
    const resolutions: Resolution[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    for (const conflict of conflicts) {
      const resolution = this.resolveConflict(conflict, taskMap);
      resolutions.push(resolution);
    }

    return resolutions;
  }

  resolveConflict(conflict: Conflict, taskMap: Map<string, PrepTask>): Resolution {
    switch (conflict.type) {
      case 'equipment_overlap':
        return this.resolveEquipmentOverlap(conflict, taskMap);
      case 'slot_exceeded':
        return this.resolveSlotExceeded(conflict, taskMap);
      case 'dependency_violation':
        return this.resolveDependencyViolation(conflict, taskMap);
      case 'attention_overload':
        return this.resolveAttentionOverload(conflict, taskMap);
      default:
        return {
          conflictId: conflict.id,
          strategy: 'manual',
          explanation: 'Unknown conflict type - manual resolution required'
        };
    }
  }

  // --------------------------------------------------------------------------
  // Equipment Overlap Resolution
  // --------------------------------------------------------------------------

  private resolveEquipmentOverlap(
    conflict: Conflict,
    taskMap: Map<string, PrepTask>
  ): Resolution {
    // Strategy 1: Find alternative equipment
    if (conflict.equipmentId) {
      const alternative = this.equipmentManager.findAvailableAlternative(conflict.equipmentId);
      if (alternative) {
        return {
          conflictId: conflict.id,
          strategy: 'substitute',
          substituteEquipment: alternative.id,
          explanation: `Use "${alternative.name}" instead of the conflicting equipment`
        };
      }
    }

    // Strategy 2: Reschedule one task to run after the other
    const tasks = conflict.taskIds.map(id => taskMap.get(id)).filter(Boolean) as PrepTask[];
    if (tasks.length >= 2) {
      // Find the lower priority task to reschedule
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      const toReschedule = tasks[tasks.length - 1];
      const keepTime = tasks[0];

      return {
        conflictId: conflict.id,
        strategy: 'reschedule',
        newSchedule: [{
          taskId: toReschedule.id,
          startTime: conflict.timeRange[1], // After the conflict ends
          endTime: conflict.timeRange[1] + toReschedule.duration,
          equipment: toReschedule.equipment,
          isCleanup: false
        }],
        explanation: `Reschedule "${toReschedule.name}" to start after "${keepTime.name}" completes`
      };
    }

    return {
      conflictId: conflict.id,
      strategy: 'manual',
      explanation: 'Could not automatically resolve equipment conflict'
    };
  }

  // --------------------------------------------------------------------------
  // Slot Exceeded Resolution
  // --------------------------------------------------------------------------

  private resolveSlotExceeded(
    conflict: Conflict,
    taskMap: Map<string, PrepTask>
  ): Resolution {
    const tasks = conflict.taskIds.map(id => taskMap.get(id)).filter(Boolean) as PrepTask[];

    // Strategy: Make tasks sequential instead of parallel
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Keep highest priority tasks, reschedule others
    const toReschedule = tasks.slice(2); // Keep top 2 (for oven) or 4 (for burners)

    if (toReschedule.length > 0) {
      let currentTime = conflict.timeRange[1];
      const newSchedule: TimeSlot[] = [];

      for (const task of toReschedule) {
        newSchedule.push({
          taskId: task.id,
          startTime: currentTime,
          endTime: currentTime + task.duration,
          equipment: task.equipment,
          isCleanup: false
        });
        currentTime += task.duration;
      }

      return {
        conflictId: conflict.id,
        strategy: 'sequential',
        newSchedule,
        explanation: `Run ${toReschedule.map(t => `"${t.name}"`).join(', ')} sequentially after initial batch`
      };
    }

    return {
      conflictId: conflict.id,
      strategy: 'manual',
      explanation: 'Could not automatically resolve capacity conflict'
    };
  }

  // --------------------------------------------------------------------------
  // Dependency Violation Resolution
  // --------------------------------------------------------------------------

  private resolveDependencyViolation(
    conflict: Conflict,
    taskMap: Map<string, PrepTask>
  ): Resolution {
    if (conflict.taskIds.length < 2) {
      return {
        conflictId: conflict.id,
        strategy: 'manual',
        explanation: 'Invalid dependency conflict'
      };
    }

    const [dependentId, prerequisiteId] = conflict.taskIds;
    const dependent = taskMap.get(dependentId);
    const prerequisite = taskMap.get(prerequisiteId);

    if (!dependent || !prerequisite) {
      return {
        conflictId: conflict.id,
        strategy: 'manual',
        explanation: 'Could not find tasks for dependency resolution'
      };
    }

    // Reschedule dependent to start after prerequisite
    return {
      conflictId: conflict.id,
      strategy: 'reschedule',
      newSchedule: [{
        taskId: dependent.id,
        startTime: conflict.timeRange[1], // After prerequisite ends
        endTime: conflict.timeRange[1] + dependent.duration,
        equipment: dependent.equipment,
        isCleanup: false
      }],
      explanation: `Reschedule "${dependent.name}" to start after "${prerequisite.name}" completes`
    };
  }

  // --------------------------------------------------------------------------
  // Attention Overload Resolution
  // --------------------------------------------------------------------------

  private resolveAttentionOverload(
    conflict: Conflict,
    taskMap: Map<string, PrepTask>
  ): Resolution {
    const tasks = conflict.taskIds.map(id => taskMap.get(id)).filter(Boolean) as PrepTask[];

    // Find tasks that could be made passive (e.g., simmering vs active cooking)
    const canBePassive = tasks.filter(t =>
      t.type === 'simmer' || t.type === 'bake' || t.type === 'rest'
    );

    if (canBePassive.length > 0) {
      return {
        conflictId: conflict.id,
        strategy: 'manual',
        explanation: `Consider making these tasks passive (check occasionally): ${canBePassive.map(t => t.name).join(', ')}`
      };
    }

    // Otherwise, suggest splitting attention-heavy tasks
    return {
      conflictId: conflict.id,
      strategy: 'split',
      explanation: `Split attention-heavy tasks: Start "${tasks[0].name}" first, then begin others once it requires less attention`
    };
  }
}
