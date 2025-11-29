/**
 * Data Models for Meal Assistant API
 * Based on PRD Version 6.0 specifications
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PatternType,
  MealStatus,
  EquipmentState,
  ExpiryStatus,
  PatternConfig,
  Pattern,
  InventoryItem,
  PrepSession,
  ShoppingList,
  Equipment,
  Meal,
  PrepTask,
  ShoppingItem
} from '../types/models';

/**
 * Pattern configuration with meal structures
 */
const PatternConfigs: Record<PatternType, PatternConfig> = {
  [PatternType.TRADITIONAL]: {
    id: 'traditional',
    name: 'Traditional',
    description: 'Regular schedule, 3 meals with standard timing',
    totalCalories: 1800,
    totalProtein: 135,
    meals: [
      { name: 'Morning', time: '07:00', calories: 400, protein: 35 },
      { name: 'Noon', time: '12:00', calories: 850, protein: 60 },
      { name: 'Evening', time: '18:00', calories: 550, protein: 40 }
    ],
    optimalFor: ['regular schedule', 'consistent energy', 'office work']
  },
  [PatternType.REVERSED]: {
    id: 'reversed',
    name: 'Reversed',
    description: 'Light dinner preference, heavier noon meal',
    totalCalories: 1800,
    totalProtein: 140,
    meals: [
      { name: 'Morning', time: '07:00', calories: 400, protein: 35 },
      { name: 'Noon', time: '12:00', calories: 550, protein: 55 },
      { name: 'Evening', time: '18:00', calories: 850, protein: 50 }
    ],
    optimalFor: ['light dinner', 'business lunches', 'social midday']
  },
  [PatternType.IF_NOON]: {
    id: 'if_noon',
    name: 'Intermittent Fasting (Noon)',
    description: '12PM-8PM eating window',
    totalCalories: 1800,
    totalProtein: 145,
    meals: [
      { name: 'First Meal', time: '12:00', calories: 900, protein: 70 },
      { name: 'Second Meal', time: '18:00', calories: 900, protein: 75 }
    ],
    optimalFor: ['not hungry mornings', 'larger meals', 'metabolic flexibility']
  },
  [PatternType.GRAZING_MINI]: {
    id: 'grazing_mini',
    name: 'Grazing - Mini Meals',
    description: '4 equal-sized mini meals',
    totalCalories: 1800,
    totalProtein: 130,
    meals: [
      { name: 'Meal 1', time: '07:00', calories: 450, protein: 32 },
      { name: 'Meal 2', time: '11:00', calories: 450, protein: 35 },
      { name: 'Meal 3', time: '15:00', calories: 450, protein: 38 },
      { name: 'Meal 4', time: '19:00', calories: 450, protein: 25 }
    ],
    optimalFor: ['steady energy', 'prevents hunger', 'blood sugar management']
  },
  [PatternType.GRAZING_PLATTER]: {
    id: 'grazing_platter',
    name: 'Grazing - Platter Method',
    description: 'Day platter assembled in morning, eaten throughout day',
    totalCalories: 1800,
    totalProtein: 130,
    meals: [
      { name: 'Full Day Platter', time: '07:00', calories: 1800, protein: 130 }
    ],
    optimalFor: ['work from home', 'visual eaters', 'flexible schedule']
  },
  [PatternType.BIG_BREAKFAST]: {
    id: 'big_breakfast',
    name: 'Big Breakfast',
    description: 'Front-loaded calories with large morning meal',
    totalCalories: 1800,
    totalProtein: 138,
    meals: [
      { name: 'Morning', time: '07:00', calories: 850, protein: 58 },
      { name: 'Noon', time: '12:00', calories: 400, protein: 40 },
      { name: 'Evening', time: '18:00', calories: 550, protein: 40 }
    ],
    optimalFor: ['morning workouts', 'weekend leisure', 'breakfast lovers']
  },
  [PatternType.MORNING_FEAST]: {
    id: 'morning_feast',
    name: 'Morning Feast',
    description: '5AM-1PM eating window (reverse IF)',
    totalCalories: 1800,
    totalProtein: 142,
    meals: [
      { name: 'First Meal', time: '05:00', calories: 600, protein: 40 },
      { name: 'Second Meal', time: '09:00', calories: 700, protein: 52 },
      { name: 'Third Meal', time: '12:30', calories: 500, protein: 50 }
    ],
    optimalFor: ['reverse IF', 'large morning appetite', 'evening social plans']
  }
};

/**
 * Factory function to create a pattern
 */
function createPattern(userId: string, patternType: PatternType, date?: string): Pattern {
  const config = PatternConfigs[patternType];
  if (!config) throw new Error(`Invalid pattern type: ${patternType}`);

  return {
    id: uuidv4(),
    userId,
    patternType,
    date: date || new Date().toISOString().split('T')[0],
    config,
    meals: config.meals.map((meal, index): Meal => ({
      id: uuidv4(),
      index,
      ...meal,
      status: MealStatus.PENDING,
      logged: null,
      actualCalories: null,
      actualProtein: null,
      rating: null,
      notes: null,
      photoUrl: null
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Factory function to create an inventory item
 */
function createInventoryItem(userId: string, data: Partial<InventoryItem> & { name: string; category: string; quantity: number; unit: string }): InventoryItem {
  const now = new Date();
  const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;

  let expiryStatus = ExpiryStatus.FRESH;
  if (expiryDate) {
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) expiryStatus = ExpiryStatus.EXPIRED;
    else if (daysUntilExpiry < 2) expiryStatus = ExpiryStatus.URGENT;
    else if (daysUntilExpiry < 7) expiryStatus = ExpiryStatus.EXPIRING_SOON;
  }

  return {
    id: uuidv4(),
    userId,
    name: data.name,
    category: data.category,
    quantity: data.quantity,
    unit: data.unit,
    expiryDate: expiryDate?.toISOString() || null,
    expiryStatus,
    location: data.location || 'pantry',
    purchaseDate: data.purchaseDate || now.toISOString(),
    purchasePrice: data.purchasePrice || null,
    store: data.store || null,
    notes: data.notes || null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

/**
 * Factory function to create a prep session
 */
function createPrepSession(userId: string, data: {
  date?: string;
  patternType: PatternType;
  targetMeals?: string[];
  tasks: Array<{
    name: string;
    duration: number;
    equipment?: string[];
    dependencies?: string[];
  }>;
  equipment?: string[];
  estimatedDuration: number;
}): PrepSession {
  return {
    id: uuidv4(),
    userId,
    date: data.date || new Date().toISOString().split('T')[0],
    patternType: data.patternType,
    targetMeals: data.targetMeals || [],
    tasks: data.tasks.map((task, index): PrepTask => ({
      id: uuidv4(),
      index,
      name: task.name,
      duration: task.duration,
      equipment: task.equipment || [],
      dependencies: task.dependencies || [],
      status: 'pending',
      startedAt: null,
      completedAt: null
    })),
    equipment: data.equipment || [],
    estimatedDuration: data.estimatedDuration,
    actualDuration: null,
    status: 'scheduled',
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Factory function to create a shopping list
 */
function createShoppingList(userId: string, data: {
  weekOf?: string;
  patterns?: PatternType[];
  items: Array<{
    name: string;
    category: string;
    quantity: number;
    unit: string;
    store?: string | null;
    estimatedPrice?: number | null;
  }>;
  totalEstimated?: number;
}): ShoppingList {
  return {
    id: uuidv4(),
    userId,
    weekOf: data.weekOf || new Date().toISOString().split('T')[0],
    patterns: data.patterns || [],
    items: data.items.map((item): ShoppingItem => ({
      id: uuidv4(),
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      store: item.store || null,
      estimatedPrice: item.estimatedPrice || null,
      purchased: false,
      purchasedAt: null,
      actualPrice: null
    })),
    totalEstimated: data.totalEstimated || 0,
    totalActual: null,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Factory function to create equipment
 */
function createEquipment(userId: string, data: {
  name: string;
  type: string;
  maintenanceDue?: string | null;
  notes?: string | null;
}): Equipment {
  return {
    id: uuidv4(),
    userId,
    name: data.name,
    type: data.type,
    state: EquipmentState.CLEAN,
    stateChangedAt: new Date().toISOString(),
    lastUsed: null,
    maintenanceDue: data.maintenanceDue || null,
    notes: data.notes || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export {
  PatternType,
  PatternConfigs,
  MealStatus,
  EquipmentState,
  ExpiryStatus,
  createPattern,
  createInventoryItem,
  createPrepSession,
  createShoppingList,
  createEquipment
};
