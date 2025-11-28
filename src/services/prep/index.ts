/**
 * Prep Services Index
 * Exports all prep scheduling components
 */

// Main orchestrator
export {
  PrepOrchestrator,
  createPrepOrchestrator
} from './prep-orchestrator';

// Individual components
export { EquipmentManager } from './equipment-manager';
export {
  TaskScheduler,
  topologicalSort,
  findCriticalPath
} from './task-scheduler';
export { ConflictDetector, ConflictResolver } from './conflict-resolver';
export { CleaningPlanner } from './cleaning-planner';
export { ParallelOptimizer } from './parallel-optimizer';
export { GanttVisualizer } from './gantt-visualizer';

// Types
export type {
  // Equipment
  Equipment,
  EquipmentInventory,
  EquipmentCategory,
  EquipmentStatus,

  // Tasks
  PrepTask,
  TaskType,
  TaskPriority,

  // Timeline
  Timeline,
  TimeSlot,
  EquipmentUsage,

  // Conflicts
  Conflict,
  ConflictType,
  Resolution,

  // Cleaning
  CleaningTask,
  CleaningPlan,
  CleaningMethod,

  // Visualization
  GanttChart,
  GanttRow,
  GanttSegment,

  // Optimization
  ParallelSuggestion,
  OptimizationResult,

  // Configuration
  PrepConfig
} from '../../types/prep.types';

export { DEFAULT_PREP_CONFIG } from '../../types/prep.types';
