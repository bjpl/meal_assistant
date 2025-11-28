/**
 * Prep Orchestrator
 * Main orchestration class that coordinates all prep scheduling components
 */

import {
  PrepTask,
  Timeline,
  Conflict,
  Resolution,
  CleaningPlan,
  GanttChart,
  OptimizationResult,
  PrepConfig,
  DEFAULT_PREP_CONFIG,
  Equipment
} from '../../types/prep.types';

import { EquipmentManager } from './equipment-manager';
import { TaskScheduler, topologicalSort, findCriticalPath } from './task-scheduler';
import { ConflictDetector, ConflictResolver } from './conflict-resolver';
import { CleaningPlanner } from './cleaning-planner';
import { ParallelOptimizer } from './parallel-optimizer';
import { GanttVisualizer } from './gantt-visualizer';

// ============================================================================
// Main Orchestrator Class
// ============================================================================

export class PrepOrchestrator {
  private equipmentManager: EquipmentManager;
  private taskScheduler: TaskScheduler;
  private conflictDetector: ConflictDetector;
  private conflictResolver: ConflictResolver;
  private cleaningPlanner: CleaningPlanner;
  private parallelOptimizer: ParallelOptimizer;
  private ganttVisualizer: GanttVisualizer;
  private config: PrepConfig;

  constructor(
    config: Partial<PrepConfig> = {},
    customEquipment?: Equipment[]
  ) {
    this.config = { ...DEFAULT_PREP_CONFIG, ...config };
    this.equipmentManager = new EquipmentManager(customEquipment);
    this.taskScheduler = new TaskScheduler(this.config);
    this.conflictDetector = new ConflictDetector(this.equipmentManager, this.config);
    this.conflictResolver = new ConflictResolver(this.equipmentManager);
    this.cleaningPlanner = new CleaningPlanner(this.equipmentManager, this.config);
    this.parallelOptimizer = new ParallelOptimizer(this.equipmentManager, this.config);
    this.ganttVisualizer = new GanttVisualizer();
  }

  // --------------------------------------------------------------------------
  // Main Scheduling Method
  // --------------------------------------------------------------------------

  optimizeSchedule(tasks: PrepTask[]): {
    timeline: Timeline;
    conflicts: Conflict[];
    resolutions: Resolution[];
    cleaningPlan: CleaningPlan;
    optimization: OptimizationResult;
    ganttChart: GanttChart;
  } {
    // Step 1: Validate and sort tasks
    const sortedTasks = this.validateAndSort(tasks);

    // Step 2: Create initial schedule
    let timeline = this.taskScheduler.createSchedule(sortedTasks);

    // Step 3: Detect conflicts
    let conflicts = this.conflictDetector.detectAll(timeline, sortedTasks);

    // Step 4: Resolve conflicts
    const resolutions = this.conflictResolver.resolveAll(conflicts, sortedTasks);

    // Step 5: Apply resolutions and regenerate schedule if needed
    if (resolutions.some(r => r.strategy !== 'manual')) {
      const resolvedTasks = this.applyResolutions(sortedTasks, resolutions);
      timeline = this.taskScheduler.createSchedule(resolvedTasks);
      conflicts = this.conflictDetector.detectAll(timeline, resolvedTasks);
    }

    // Step 6: Generate cleaning plan
    const cleaningPlan = this.cleaningPlanner.generateCleaningPlan(timeline, sortedTasks);

    // Step 7: Calculate optimization metrics
    const optimization = this.parallelOptimizer.optimize(sortedTasks);

    // Step 8: Generate Gantt chart
    const ganttChart = this.ganttVisualizer.generateChart(timeline, sortedTasks);

    return {
      timeline,
      conflicts,
      resolutions,
      cleaningPlan,
      optimization,
      ganttChart
    };
  }

  // --------------------------------------------------------------------------
  // Task Validation and Sorting
  // --------------------------------------------------------------------------

  private validateAndSort(tasks: PrepTask[]): PrepTask[] {
    // Validate all dependencies exist
    const taskIds = new Set(tasks.map(t => t.id));
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        if (!taskIds.has(depId)) {
          throw new Error(
            `Task "${task.name}" depends on non-existent task "${depId}"`
          );
        }
      }
    }

    // Validate all equipment exists
    for (const task of tasks) {
      for (const eqId of task.equipment) {
        if (!this.equipmentManager.getById(eqId)) {
          console.warn(`Equipment "${eqId}" not found for task "${task.name}"`);
        }
      }
    }

    return topologicalSort(tasks);
  }

  // --------------------------------------------------------------------------
  // Resolution Application
  // --------------------------------------------------------------------------

  private applyResolutions(
    tasks: PrepTask[],
    resolutions: Resolution[]
  ): PrepTask[] {
    const taskMap = new Map(tasks.map(t => [t.id, { ...t }]));

    for (const resolution of resolutions) {
      if (resolution.strategy === 'substitute' && resolution.substituteEquipment) {
        // Find the task and substitute equipment
        for (const task of taskMap.values()) {
          const conflictingEq = task.equipment.find(eq =>
            this.equipmentManager.getById(eq)?.alternatives?.includes(resolution.substituteEquipment!)
          );
          if (conflictingEq) {
            const idx = task.equipment.indexOf(conflictingEq);
            task.equipment[idx] = resolution.substituteEquipment;
          }
        }
      }
      // Other strategies are handled by rescheduling
    }

    return Array.from(taskMap.values());
  }

  // --------------------------------------------------------------------------
  // Conflict Detection (exposed for direct use)
  // --------------------------------------------------------------------------

  detectConflicts(schedule: Timeline, tasks: PrepTask[]): Conflict[] {
    return this.conflictDetector.detectAll(schedule, tasks);
  }

  // --------------------------------------------------------------------------
  // Conflict Resolution (exposed for direct use)
  // --------------------------------------------------------------------------

  resolveConflicts(conflicts: Conflict[], tasks: PrepTask[]): Resolution[] {
    return this.conflictResolver.resolveAll(conflicts, tasks);
  }

  // --------------------------------------------------------------------------
  // Cleaning Plan Generation (exposed for direct use)
  // --------------------------------------------------------------------------

  generateCleaningPlan(timeline: Timeline, tasks: PrepTask[]): CleaningPlan {
    return this.cleaningPlanner.generateCleaningPlan(timeline, tasks);
  }

  // --------------------------------------------------------------------------
  // Visualization
  // --------------------------------------------------------------------------

  generateGanttChart(
    timeline: Timeline,
    tasks: PrepTask[],
    viewMode: 'equipment' | 'task' | 'combined' = 'combined'
  ): GanttChart {
    return this.ganttVisualizer.generateChart(timeline, tasks, viewMode);
  }

  toAsciiTimeline(ganttChart: GanttChart, width: number = 80): string {
    return this.ganttVisualizer.toAscii(ganttChart, width);
  }

  toHtmlTimeline(ganttChart: GanttChart): string {
    return this.ganttVisualizer.toHtml(ganttChart);
  }

  // --------------------------------------------------------------------------
  // Parallel Optimization Analysis
  // --------------------------------------------------------------------------

  analyzeParallelOpportunities(tasks: PrepTask[]): OptimizationResult {
    return this.parallelOptimizer.optimize(tasks);
  }

  // --------------------------------------------------------------------------
  // Equipment Management
  // --------------------------------------------------------------------------

  getEquipmentManager(): EquipmentManager {
    return this.equipmentManager;
  }

  updateEquipmentStatus(id: string, status: 'clean' | 'dirty' | 'in_use' | 'unavailable'): boolean {
    return this.equipmentManager.updateStatus(id, status);
  }

  // --------------------------------------------------------------------------
  // Convenience Methods
  // --------------------------------------------------------------------------

  estimateTotalTime(tasks: PrepTask[]): number {
    const timeline = this.taskScheduler.createSchedule(tasks);
    return timeline.totalDuration;
  }

  findCriticalPath(tasks: PrepTask[]): string[] {
    return findCriticalPath(tasks);
  }

  // --------------------------------------------------------------------------
  // Summary Generation
  // --------------------------------------------------------------------------

  generateSummary(tasks: PrepTask[]): {
    totalPrepTime: number;
    activeTime: number;
    passiveTime: number;
    cleaningTime: number;
    timeSaved: number;
    criticalPath: string[];
    parallelGroups: number;
    equipmentNeeded: string[];
    suggestions: string[];
  } {
    const result = this.optimizeSchedule(tasks);

    const activeTime = tasks
      .filter(t => t.requiresAttention)
      .reduce((sum, t) => sum + t.duration, 0);

    const passiveTime = tasks
      .filter(t => !t.requiresAttention)
      .reduce((sum, t) => sum + t.duration, 0);

    const equipmentNeeded = [...new Set(tasks.flatMap(t => t.equipment))];

    const suggestions = [
      ...result.optimization.suggestions.map(s => s.description),
      ...this.cleaningPlanner.generateCleaningSuggestions(result.cleaningPlan),
      ...this.parallelOptimizer.suggestEquipmentImprovements(result.timeline)
    ];

    return {
      totalPrepTime: result.timeline.totalDuration,
      activeTime,
      passiveTime,
      cleaningTime: result.cleaningPlan.totalTime,
      timeSaved: result.optimization.timeSaved,
      criticalPath: result.timeline.criticalPath,
      parallelGroups: result.timeline.parallelTasks.length,
      equipmentNeeded,
      suggestions
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPrepOrchestrator(
  config?: Partial<PrepConfig>,
  customEquipment?: Equipment[]
): PrepOrchestrator {
  return new PrepOrchestrator(config, customEquipment);
}

// ============================================================================
// Exports
// ============================================================================

export {
  EquipmentManager,
  TaskScheduler,
  ConflictDetector,
  ConflictResolver,
  CleaningPlanner,
  ParallelOptimizer,
  GanttVisualizer,
  topologicalSort,
  findCriticalPath
};
