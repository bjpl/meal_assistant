/**
 * Cleaning Planner
 * Auto-generates cleaning tasks and optimizes clean-as-you-go scheduling
 */

import {
  PrepTask,
  Timeline,
  CleaningTask,
  CleaningPlan,
  CleaningMethod,
  TaskPriority,
  PrepConfig,
  DEFAULT_PREP_CONFIG
} from '../../types/prep.types';
import { EquipmentManager } from './equipment-manager';

// ============================================================================
// Cleaning Time Estimates
// ============================================================================

const CLEANING_TIMES: Record<string, { method: CleaningMethod; duration: number }> = {
  // Cookware
  'pot-large': { method: 'handwash', duration: 5 },
  'pot-medium': { method: 'dishwasher', duration: 4 },
  'pot-small': { method: 'dishwasher', duration: 3 },
  'dutch-oven': { method: 'handwash', duration: 8 },
  'skillet-large': { method: 'handwash', duration: 4 },
  'skillet-medium': { method: 'handwash', duration: 3 },
  'wok': { method: 'handwash', duration: 4 },
  'sheet-pan-1': { method: 'dishwasher', duration: 3 },
  'sheet-pan-2': { method: 'dishwasher', duration: 3 },
  'baking-dish': { method: 'soak', duration: 10 },

  // Appliances
  'instant-pot': { method: 'handwash', duration: 8 },
  'rice-cooker': { method: 'handwash', duration: 5 },
  'air-fryer': { method: 'handwash', duration: 5 },
  'blender': { method: 'handwash', duration: 3 },
  'food-processor': { method: 'handwash', duration: 8 },

  // Tools
  'cutting-board-1': { method: 'handwash', duration: 2 },
  'cutting-board-2': { method: 'handwash', duration: 2 },
  'mixing-bowl-large': { method: 'dishwasher', duration: 2 },
  'mixing-bowl-medium': { method: 'dishwasher', duration: 2 },
  'colander': { method: 'dishwasher', duration: 2 },
  'strainer': { method: 'handwash', duration: 3 },

  // Surfaces
  'counter-main': { method: 'wipe', duration: 2 },
  'counter-prep': { method: 'wipe', duration: 2 },

  // Stovetop
  'burner-1': { method: 'wipe', duration: 2 },
  'burner-2': { method: 'wipe', duration: 2 },
  'burner-3': { method: 'wipe', duration: 2 },
  'burner-4': { method: 'wipe', duration: 2 },

  // Oven
  'oven': { method: 'wipe', duration: 5 },
  'oven-rack-1': { method: 'soak', duration: 15 },
  'oven-rack-2': { method: 'soak', duration: 15 },
};

// ============================================================================
// Cleaning Planner Class
// ============================================================================

export class CleaningPlanner {
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
  // Main Plan Generation
  // --------------------------------------------------------------------------

  generateCleaningPlan(timeline: Timeline, tasks: PrepTask[]): CleaningPlan {
    const cleaningTasks = this.generateCleaningTasks(timeline, tasks);
    const cleanAsYouGoTasks = this.identifyCleanAsYouGo(timeline, cleaningTasks);
    const dishwasherLoads = this.optimizeDishwasherLoads(cleaningTasks);
    const handwashBatches = this.groupHandwashTasks(cleaningTasks);

    const totalTime = this.calculateTotalCleaningTime(cleaningTasks);

    return {
      tasks: cleaningTasks,
      dishwasherLoads,
      handwashBatches,
      totalTime,
      cleanAsYouGoTasks
    };
  }

  // --------------------------------------------------------------------------
  // Cleaning Task Generation
  // --------------------------------------------------------------------------

  generateCleaningTasks(timeline: Timeline, _tasks: PrepTask[]): CleaningTask[] {
    const cleaningTasks: CleaningTask[] = [];
    const usedEquipment = new Set<string>();

    // Track when each piece of equipment is last used
    const lastUsageTime = new Map<string, number>();

    for (const slot of timeline.slots) {
      if (slot.isCleanup) continue;

      for (const eqId of slot.equipment) {
        usedEquipment.add(eqId);
        lastUsageTime.set(eqId, slot.endTime);
      }
    }

    // Generate cleaning task for each used equipment
    for (const eqId of usedEquipment) {
      const equipment = this.equipmentManager.getById(eqId);
      if (!equipment) continue;

      const cleaningInfo = CLEANING_TIMES[eqId] || {
        method: this.config.preferredCleaningMethod,
        duration: equipment.cleaningTime
      };

      const lastUsed = lastUsageTime.get(eqId) || timeline.totalDuration;

      cleaningTasks.push({
        id: `clean-${eqId}`,
        equipmentId: eqId,
        equipmentName: equipment.name,
        method: cleaningInfo.method,
        duration: cleaningInfo.duration,
        scheduledTime: lastUsed,
        canBatch: cleaningInfo.method === 'dishwasher' || cleaningInfo.method === 'handwash',
        priority: this.determineCleaningPriority(equipment, cleaningInfo.method),
        notes: this.getCleaningNotes(equipment, cleaningInfo.method)
      });
    }

    return cleaningTasks.sort((a, b) => a.scheduledTime - b.scheduledTime);
  }

  private determineCleaningPriority(
    equipment: { category: string },
    method: CleaningMethod
  ): TaskPriority {
    // Items that need to soak should be started early
    if (method === 'soak') return 'high';

    // Prep surfaces should be cleaned for reuse
    if (equipment.category === 'surface') return 'high';

    // Cutting boards for food safety
    if (equipment.category === 'tool') return 'medium';

    return 'low';
  }

  private getCleaningNotes(
    equipment: { category: string; name: string },
    method: CleaningMethod
  ): string {
    if (method === 'soak') {
      return `Fill ${equipment.name} with hot soapy water immediately after use`;
    }
    if (equipment.category === 'surface') {
      return 'Sanitize after handling raw proteins';
    }
    return '';
  }

  // --------------------------------------------------------------------------
  // Clean-As-You-Go Identification
  // --------------------------------------------------------------------------

  identifyCleanAsYouGo(
    timeline: Timeline,
    cleaningTasks: CleaningTask[]
  ): CleaningTask[] {
    const cleanAsYouGo: CleaningTask[] = [];

    // Find gaps in the timeline where cleaning can happen
    const gaps = this.findTimelineGaps(timeline);

    // Sort cleaning tasks by priority and duration
    const sortedTasks = [...cleaningTasks].sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.duration - b.duration;
    });

    // Assign cleaning tasks to gaps
    for (const task of sortedTasks) {
      // Only schedule cleaning after the equipment was last used
      const eligibleGaps = gaps.filter(g =>
        g.start >= task.scheduledTime &&
        g.duration >= task.duration
      );

      if (eligibleGaps.length > 0) {
        const gap = eligibleGaps[0];
        cleanAsYouGo.push({
          ...task,
          scheduledTime: gap.start,
          notes: `Clean during downtime (${gap.start}-${gap.start + task.duration} min)`
        });

        // Reduce gap duration
        gap.start += task.duration;
        gap.duration -= task.duration;
      }
    }

    return cleanAsYouGo;
  }

  private findTimelineGaps(timeline: Timeline): { start: number; duration: number }[] {
    const gaps: { start: number; duration: number }[] = [];

    // Get all active slots (excluding cleanup)
    const activeSlots = timeline.slots
      .filter(s => !s.isCleanup)
      .sort((a, b) => a.startTime - b.startTime);

    if (activeSlots.length === 0) {
      return [{ start: 0, duration: timeline.totalDuration }];
    }

    // Check for gap at the beginning
    if (activeSlots[0].startTime > 0) {
      gaps.push({ start: 0, duration: activeSlots[0].startTime });
    }

    // Find gaps between slots
    for (let i = 0; i < activeSlots.length - 1; i++) {
      const current = activeSlots[i];
      const next = activeSlots[i + 1];

      if (next.startTime > current.endTime) {
        gaps.push({
          start: current.endTime,
          duration: next.startTime - current.endTime
        });
      }
    }

    // Check for gap at the end
    const lastSlot = activeSlots[activeSlots.length - 1];
    if (lastSlot.endTime < timeline.totalDuration) {
      gaps.push({
        start: lastSlot.endTime,
        duration: timeline.totalDuration - lastSlot.endTime
      });
    }

    // Filter out very short gaps (less than 2 minutes)
    return gaps.filter(g => g.duration >= 2);
  }

  // --------------------------------------------------------------------------
  // Dishwasher Optimization
  // --------------------------------------------------------------------------

  optimizeDishwasherLoads(cleaningTasks: CleaningTask[]): CleaningTask[][] {
    const dishwasherTasks = cleaningTasks.filter(t => t.method === 'dishwasher');

    if (dishwasherTasks.length === 0) return [];

    // Group into loads of ~12 items (typical dishwasher capacity)
    const LOAD_SIZE = 12;
    const loads: CleaningTask[][] = [];
    let currentLoad: CleaningTask[] = [];

    for (const task of dishwasherTasks) {
      currentLoad.push(task);

      if (currentLoad.length >= LOAD_SIZE) {
        loads.push(currentLoad);
        currentLoad = [];
      }
    }

    if (currentLoad.length > 0) {
      loads.push(currentLoad);
    }

    return loads;
  }

  // --------------------------------------------------------------------------
  // Handwash Grouping
  // --------------------------------------------------------------------------

  groupHandwashTasks(cleaningTasks: CleaningTask[]): CleaningTask[][] {
    const handwashTasks = cleaningTasks.filter(t => t.method === 'handwash');

    if (handwashTasks.length === 0) return [];

    // Group by scheduled time (batch tasks within 10 minutes of each other)
    const BATCH_WINDOW = 10;
    const batches: CleaningTask[][] = [];
    let currentBatch: CleaningTask[] = [];
    let batchStartTime = 0;

    const sortedTasks = [...handwashTasks].sort((a, b) => a.scheduledTime - b.scheduledTime);

    for (const task of sortedTasks) {
      if (currentBatch.length === 0) {
        currentBatch.push(task);
        batchStartTime = task.scheduledTime;
      } else if (task.scheduledTime - batchStartTime <= BATCH_WINDOW) {
        currentBatch.push(task);
      } else {
        batches.push(currentBatch);
        currentBatch = [task];
        batchStartTime = task.scheduledTime;
      }
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  // --------------------------------------------------------------------------
  // Time Calculations
  // --------------------------------------------------------------------------

  calculateTotalCleaningTime(cleaningTasks: CleaningTask[]): number {
    // Account for batching efficiency
    let totalTime = 0;

    const dishwasherTasks = cleaningTasks.filter(t => t.method === 'dishwasher');
    const handwashTasks = cleaningTasks.filter(t => t.method === 'handwash');
    const otherTasks = cleaningTasks.filter(t =>
      t.method !== 'dishwasher' && t.method !== 'handwash'
    );

    // Dishwasher: Loading time only (machine does the rest)
    const dishwasherLoads = Math.ceil(dishwasherTasks.length / 12);
    totalTime += dishwasherLoads * 5; // 5 min to load each

    // Handwash: Sum of durations (some parallel work possible)
    const handwashTotal = handwashTasks.reduce((sum, t) => sum + t.duration, 0);
    totalTime += handwashTotal * 0.8; // 20% efficiency from batching

    // Other tasks: Full duration
    totalTime += otherTasks.reduce((sum, t) => sum + t.duration, 0);

    return Math.ceil(totalTime);
  }

  // --------------------------------------------------------------------------
  // Suggestions
  // --------------------------------------------------------------------------

  generateCleaningSuggestions(plan: CleaningPlan): string[] {
    const suggestions: string[] = [];

    // Soak items early
    const soakTasks = plan.tasks.filter(t => t.method === 'soak');
    if (soakTasks.length > 0) {
      suggestions.push(
        `Start soaking ${soakTasks.map(t => t.equipmentName).join(', ')} immediately after use`
      );
    }

    // Run dishwasher efficiently
    if (plan.dishwasherLoads.length > 0) {
      suggestions.push(
        `Run ${plan.dishwasherLoads.length} dishwasher load(s) - wait until full if possible`
      );
    }

    // Handwash batching
    if (plan.handwashBatches.length > 1) {
      suggestions.push(
        `Group handwashing into ${plan.handwashBatches.length} batches for efficiency`
      );
    }

    // Clean-as-you-go benefits
    if (plan.cleanAsYouGoTasks.length > 0) {
      const timeSaved = plan.cleanAsYouGoTasks.reduce((sum, t) => sum + t.duration, 0);
      suggestions.push(
        `Clean-as-you-go: Handle ${plan.cleanAsYouGoTasks.length} items during prep to save ${timeSaved} min at the end`
      );
    }

    return suggestions;
  }
}
