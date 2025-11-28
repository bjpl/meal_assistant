/**
 * Parallel Task Optimizer
 * Greedy optimization for identifying and maximizing parallel cooking opportunities
 */

import {
  PrepTask,
  Timeline,
  ParallelSuggestion,
  OptimizationResult,
  PrepConfig,
  DEFAULT_PREP_CONFIG
} from '../../types/prep.types';
import { EquipmentManager } from './equipment-manager';

// ============================================================================
// Parallel Opportunity Analysis
// ============================================================================

interface ParallelOpportunity {
  mainTaskId: string;
  mainTaskName: string;
  mainTaskType: string;
  passiveTime: number; // Time the main task doesn't need attention
  availableParallelTasks: string[];
}

export class ParallelOptimizer {
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
  // Main Optimization
  // --------------------------------------------------------------------------

  optimize(tasks: PrepTask[]): OptimizationResult {
    const originalDuration = this.calculateSequentialDuration(tasks);
    const opportunities = this.identifyParallelOpportunities(tasks);
    const suggestions = this.generateSuggestions(opportunities, tasks);
    const optimizedDuration = this.calculateOptimizedDuration(tasks, suggestions);
    const warnings = this.generateWarnings(suggestions, tasks);

    return {
      originalDuration,
      optimizedDuration,
      timeSaved: originalDuration - optimizedDuration,
      suggestions,
      warnings
    };
  }

  // --------------------------------------------------------------------------
  // Parallel Opportunity Identification
  // --------------------------------------------------------------------------

  identifyParallelOpportunities(tasks: PrepTask[]): ParallelOpportunity[] {
    const opportunities: ParallelOpportunity[] = [];

    // Find passive cooking tasks (simmer, bake, rest, etc.)
    const passiveTasks = tasks.filter(t =>
      !t.requiresAttention &&
      (t.type === 'simmer' || t.type === 'bake' || t.type === 'rest' || t.type === 'cook')
    );

    // Find active tasks that could run during passive time
    const activeTasks = tasks.filter(t =>
      t.type === 'prep' || t.type === 'assemble' || t.requiresAttention
    );

    for (const passiveTask of passiveTasks) {
      // Calculate available passive time
      const passiveTime = passiveTask.duration;

      // Find tasks that could run in parallel
      const compatibleTasks = activeTasks.filter(activeTask => {
        // Check equipment doesn't conflict
        const equipmentConflict = activeTask.equipment.some(eq =>
          passiveTask.equipment.includes(eq)
        );
        if (equipmentConflict) return false;

        // Check if this task can be parallelized
        if (!activeTask.canParallel) return false;

        // Check if there's a dependency chain preventing parallel execution
        if (this.hasDependencyConflict(passiveTask, activeTask, tasks)) return false;

        return true;
      });

      if (compatibleTasks.length > 0) {
        opportunities.push({
          mainTaskId: passiveTask.id,
          mainTaskName: passiveTask.name,
          mainTaskType: passiveTask.type,
          passiveTime,
          availableParallelTasks: compatibleTasks.map(t => t.id)
        });
      }
    }

    return opportunities;
  }

  private hasDependencyConflict(
    passiveTask: PrepTask,
    activeTask: PrepTask,
    allTasks: PrepTask[]
  ): boolean {
    // Check if activeTask depends on passiveTask
    if (activeTask.dependencies.includes(passiveTask.id)) return true;

    // Check if passiveTask depends on activeTask
    if (passiveTask.dependencies.includes(activeTask.id)) return true;

    // Check transitive dependencies
    const passiveDeps = this.getAllDependencies(passiveTask.id, allTasks);
    const activeDeps = this.getAllDependencies(activeTask.id, allTasks);

    // If one is in the other's dependency chain, they can't be parallel
    if (passiveDeps.has(activeTask.id) || activeDeps.has(passiveTask.id)) {
      return true;
    }

    return false;
  }

  private getAllDependencies(taskId: string, tasks: PrepTask[]): Set<string> {
    const deps = new Set<string>();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    const traverse = (id: string) => {
      const task = taskMap.get(id);
      if (!task) return;

      for (const depId of task.dependencies) {
        if (!deps.has(depId)) {
          deps.add(depId);
          traverse(depId);
        }
      }
    };

    traverse(taskId);
    return deps;
  }

  // --------------------------------------------------------------------------
  // Suggestion Generation
  // --------------------------------------------------------------------------

  generateSuggestions(
    opportunities: ParallelOpportunity[],
    tasks: PrepTask[]
  ): ParallelSuggestion[] {
    const suggestions: ParallelSuggestion[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const usedTasks = new Set<string>();

    // Sort opportunities by passive time (longest first = most potential savings)
    opportunities.sort((a, b) => b.passiveTime - a.passiveTime);

    for (const opportunity of opportunities) {
      // Get available parallel tasks that haven't been assigned yet
      const availableTasks = opportunity.availableParallelTasks
        .filter(id => !usedTasks.has(id))
        .map(id => taskMap.get(id)!)
        .filter(Boolean);

      if (availableTasks.length === 0) continue;

      // Greedy: fill passive time with tasks, prioritizing by duration fit
      const selectedTasks: PrepTask[] = [];
      let remainingTime = opportunity.passiveTime;

      // Sort by duration descending (bin-packing heuristic)
      availableTasks.sort((a, b) => b.duration - a.duration);

      for (const task of availableTasks) {
        if (selectedTasks.length >= this.config.maxParallelTasks) break;
        if (task.duration <= remainingTime) {
          selectedTasks.push(task);
          remainingTime -= task.duration;
          usedTasks.add(task.id);
        }
      }

      if (selectedTasks.length > 0) {
        const timeSaved = selectedTasks.reduce((sum, t) => sum + t.duration, 0);

        suggestions.push({
          mainTask: opportunity.mainTaskId,
          parallelTasks: selectedTasks.map(t => t.id),
          timeSaved,
          description: this.formatSuggestionDescription(
            taskMap.get(opportunity.mainTaskId)!,
            selectedTasks
          )
        });
      }
    }

    return suggestions;
  }

  private formatSuggestionDescription(
    mainTask: PrepTask,
    parallelTasks: PrepTask[]
  ): string {
    const mainAction = this.getActionVerb(mainTask.type);
    const parallelActions = parallelTasks.map(t => t.name.toLowerCase()).join(', ');

    return `While ${mainTask.name.toLowerCase()} ${mainAction}, ${parallelActions}`;
  }

  private getActionVerb(taskType: string): string {
    const verbs: Record<string, string> = {
      simmer: 'simmers',
      bake: 'bakes',
      cook: 'cooks',
      rest: 'rests',
      prep: 'preps',
      assemble: 'assembles'
    };
    return verbs[taskType] || 'runs';
  }

  // --------------------------------------------------------------------------
  // Duration Calculations
  // --------------------------------------------------------------------------

  calculateSequentialDuration(tasks: PrepTask[]): number {
    return tasks.reduce((sum, t) => sum + t.duration, 0);
  }

  calculateOptimizedDuration(
    tasks: PrepTask[],
    suggestions: ParallelSuggestion[]
  ): number {
    const sequential = this.calculateSequentialDuration(tasks);
    const savings = suggestions.reduce((sum, s) => sum + s.timeSaved, 0);
    return sequential - savings;
  }

  // --------------------------------------------------------------------------
  // Warning Generation
  // --------------------------------------------------------------------------

  generateWarnings(
    suggestions: ParallelSuggestion[],
    tasks: PrepTask[]
  ): string[] {
    const warnings: string[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    for (const suggestion of suggestions) {
      // Check if parallel tasks require significant attention
      const parallelTasks = suggestion.parallelTasks
        .map(id => taskMap.get(id)!)
        .filter(Boolean);

      const attentionRequired = parallelTasks.filter(t => t.requiresAttention);
      if (attentionRequired.length > 1) {
        warnings.push(
          `Multiple attention-required tasks scheduled together: ${attentionRequired.map(t => t.name).join(', ')}`
        );
      }

      // Check for complex coordination
      if (parallelTasks.length >= 3) {
        warnings.push(
          `Coordinating ${parallelTasks.length} parallel tasks may be challenging`
        );
      }
    }

    // Check for critical path tasks that shouldn't be delayed
    const criticalTasks = tasks.filter(t => t.priority === 'critical');
    for (const task of criticalTasks) {
      const isParallel = suggestions.some(s =>
        s.parallelTasks.includes(task.id)
      );
      if (isParallel) {
        warnings.push(
          `Critical task "${task.name}" is scheduled in parallel - ensure it starts on time`
        );
      }
    }

    return warnings;
  }

  // --------------------------------------------------------------------------
  // Equipment Utilization Analysis
  // --------------------------------------------------------------------------

  analyzeEquipmentUtilization(timeline: Timeline): Map<string, number> {
    const utilization = new Map<string, number>();

    for (const usage of timeline.equipmentUsage) {
      utilization.set(usage.equipmentId, usage.utilizationPercent);
    }

    return utilization;
  }

  suggestEquipmentImprovements(timeline: Timeline): string[] {
    const suggestions: string[] = [];
    const utilizationThreshold = 30; // 30% utilization is low

    for (const usage of timeline.equipmentUsage) {
      if (usage.utilizationPercent < utilizationThreshold) {
        const equipment = this.equipmentManager.getById(usage.equipmentId);
        if (equipment) {
          suggestions.push(
            `${equipment.name} has low utilization (${usage.utilizationPercent.toFixed(1)}%) - consider consolidating tasks`
          );
        }
      }
    }

    // Check for underutilized burners
    const burnerUsage = timeline.equipmentUsage
      .filter(u => u.equipmentId.startsWith('burner'));

    if (burnerUsage.length > 0) {
      const avgBurnerUtil = burnerUsage.reduce((sum, u) => sum + u.utilizationPercent, 0) / burnerUsage.length;
      if (avgBurnerUtil < 50) {
        suggestions.push(
          `Stovetop utilization is ${avgBurnerUtil.toFixed(1)}% - batch cooking could be more efficient`
        );
      }
    }

    return suggestions;
  }
}
