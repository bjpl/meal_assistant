/**
 * TypeScript type definitions for data models
 */

export enum PatternType {
  TRADITIONAL = 'traditional',
  REVERSED = 'reversed',
  IF_NOON = 'if_noon',
  GRAZING_MINI = 'grazing_mini',
  GRAZING_PLATTER = 'grazing_platter',
  BIG_BREAKFAST = 'big_breakfast',
  MORNING_FEAST = 'morning_feast',
}

export enum MealStatus {
  PENDING = 'pending',
  SKIPPED = 'skipped',
  PARTIAL = 'partial',
  COMPLETED = 'completed',
}

export enum EquipmentState {
  CLEAN = 'clean',
  IN_USE = 'in_use',
  DIRTY = 'dirty',
  DISHWASHER = 'dishwasher',
}

export enum ExpiryStatus {
  FRESH = 'fresh',
  EXPIRING_SOON = 'expiring',
  URGENT = 'urgent',
  EXPIRED = 'expired',
}

export interface MealConfig {
  name: string;
  time: string;
  calories: number;
  protein: number;
}

export interface PatternConfig {
  id: string;
  name: string;
  description: string;
  totalCalories: number;
  totalProtein: number;
  meals: MealConfig[];
  optimalFor: string[];
}

export interface Meal extends MealConfig {
  id: string;
  index: number;
  status: MealStatus;
  logged: string | null;
  actualCalories: number | null;
  actualProtein: number | null;
  rating: number | null;
  notes: string | null;
  photoUrl: string | null;
}

export interface Pattern {
  id: string;
  userId: string;
  patternType: PatternType;
  date: string;
  config: PatternConfig;
  meals: Meal[];
  createdAt: string;
  updatedAt: string;
  status?: string;
  switchedTo?: PatternType;
  switchReason?: string;
  switchedAt?: string;
  adjustedFrom?: string;
  adjustments?: {
    consumedCalories: number;
    consumedProtein: number;
    remainingCalories: number;
    remainingProtein: number;
  };
}

export interface InventoryItem {
  id: string;
  userId: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  expiryDate: string | null;
  expiryStatus: ExpiryStatus;
  location: string;
  purchaseDate: string;
  purchasePrice: number | null;
  store: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrepTask {
  id: string;
  index: number;
  name: string;
  duration: number;
  equipment: string[];
  dependencies: string[];
  status: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PrepSession {
  id: string;
  userId: string;
  date: string;
  patternType: PatternType;
  targetMeals: string[];
  tasks: PrepTask[];
  equipment: string[];
  estimatedDuration: number;
  actualDuration: number | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  store: string | null;
  estimatedPrice: number | null;
  purchased: boolean;
  purchasedAt: string | null;
  actualPrice: number | null;
}

export interface ShoppingList {
  id: string;
  userId: string;
  weekOf: string;
  patterns: PatternType[];
  items: ShoppingItem[];
  totalEstimated: number;
  totalActual: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Equipment {
  id: string;
  userId: string;
  name: string;
  type: string;
  state: EquipmentState;
  stateChangedAt: string;
  lastUsed: string | null;
  maintenanceDue: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  tokenId?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  tokenType: string;
}
