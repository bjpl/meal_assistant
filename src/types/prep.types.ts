/**
 * Prep Scheduling Types
 * Core type definitions for the intelligent prep orchestration system
 */

// ============================================================================
// Equipment Types
// ============================================================================

export type EquipmentCategory =
  | 'stovetop'
  | 'oven'
  | 'microwave'
  | 'appliance'
  | 'tool'
  | 'surface'
  | 'container';

export type EquipmentStatus = 'clean' | 'dirty' | 'in_use' | 'unavailable';

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  capacity?: number;
  slots?: number; // e.g., 4 burners, 2 oven racks
  status: EquipmentStatus;
  cleaningTime: number; // minutes
  alternatives?: string[]; // IDs of alternative equipment
  notes?: string;
}

export interface EquipmentInventory {
  items: Equipment[];
  lastUpdated: Date;
}

// ============================================================================
// Task Types
// ============================================================================

export type TaskType =
  | 'prep'
  | 'cook'
  | 'bake'
  | 'simmer'
  | 'rest'
  | 'assemble'
  | 'clean';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface PrepTask {
  id: string;
  recipe: string;
  name: string;
  description?: string;
  type: TaskType;
  equipment: string[]; // Equipment IDs
  equipmentSlots?: Record<string, number>; // Equipment ID -> slots needed
  duration: number; // minutes
  dependencies: string[]; // Task IDs that must complete first
  canParallel: boolean;
  cleaningTime: number; // minutes for cleanup
  priority: TaskPriority;
  requiresAttention: boolean; // Must actively work vs can walk away
  temperature?: number; // For oven/stovetop
  notes?: string;
}

// ============================================================================
// Timeline Types
// ============================================================================

export interface TimeSlot {
  taskId: string;
  startTime: number; // minutes from start
  endTime: number;
  equipment: string[];
  isCleanup: boolean;
}

export interface EquipmentUsage {
  equipmentId: string;
  slots: TimeSlot[];
  utilizationPercent: number;
}

export interface Timeline {
  id: string;
  totalDuration: number; // minutes
  startTime: Date;
  endTime: Date;
  slots: TimeSlot[];
  equipmentUsage: EquipmentUsage[];
  parallelTasks: string[][]; // Groups of task IDs that run together
  criticalPath: string[]; // Task IDs on critical path
}

// ============================================================================
// Conflict Types
// ============================================================================

export type ConflictType =
  | 'equipment_overlap'
  | 'slot_exceeded'
  | 'dependency_violation'
  | 'time_conflict'
  | 'attention_overload';

export interface Conflict {
  id: string;
  type: ConflictType;
  taskIds: string[];
  equipmentId?: string;
  timeRange: [number, number]; // [start, end] in minutes
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

export interface Resolution {
  conflictId: string;
  strategy: 'reschedule' | 'substitute' | 'split' | 'sequential' | 'manual';
  newSchedule?: TimeSlot[];
  substituteEquipment?: string;
  explanation: string;
}

// ============================================================================
// Cleaning Types
// ============================================================================

export type CleaningMethod = 'handwash' | 'dishwasher' | 'wipe' | 'soak';

export interface CleaningTask {
  id: string;
  equipmentId: string;
  equipmentName: string;
  method: CleaningMethod;
  duration: number; // minutes
  scheduledTime: number; // minutes from start
  canBatch: boolean; // Can combine with other cleaning
  priority: TaskPriority;
  notes?: string;
}

export interface CleaningPlan {
  tasks: CleaningTask[];
  dishwasherLoads: CleaningTask[][];
  handwashBatches: CleaningTask[][];
  totalTime: number;
  cleanAsYouGoTasks: CleaningTask[];
}

// ============================================================================
// Visualization Types
// ============================================================================

export interface GanttRow {
  id: string;
  label: string;
  type: 'equipment' | 'task';
  segments: GanttSegment[];
}

export interface GanttSegment {
  taskId: string;
  taskName: string;
  startTime: number;
  endTime: number;
  color: string;
  isCleanup: boolean;
  tooltip: string;
}

export interface GanttChart {
  rows: GanttRow[];
  totalDuration: number;
  timeScale: number; // minutes per unit
  milestones: { time: number; label: string }[];
}

// ============================================================================
// Suggestion Types
// ============================================================================

export interface ParallelSuggestion {
  mainTask: string;
  parallelTasks: string[];
  timeSaved: number; // minutes
  description: string; // "While rice cooks, prep vegetables"
}

export interface OptimizationResult {
  originalDuration: number;
  optimizedDuration: number;
  timeSaved: number;
  suggestions: ParallelSuggestion[];
  warnings: string[];
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface PrepConfig {
  maxParallelTasks: number;
  cleaningBufferMinutes: number;
  attentionThreshold: number; // Max simultaneous attention-required tasks
  equipmentCooldownMinutes: Record<string, number>;
  preferredCleaningMethod: CleaningMethod;
}

export const DEFAULT_PREP_CONFIG: PrepConfig = {
  maxParallelTasks: 3,
  cleaningBufferMinutes: 5,
  attentionThreshold: 2,
  equipmentCooldownMinutes: {},
  preferredCleaningMethod: 'dishwasher'
};
