/**
 * API Type Definitions for Meal Assistant
 *
 * Comprehensive TypeScript interfaces for all API entities, requests, and responses.
 * These types ensure type safety across the application.
 */

// ============================================================================
// User Types
// ============================================================================

/**
 * User entity from database
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

/**
 * User payload for JWT tokens and API responses (excludes sensitive fields)
 */
export interface UserPayload {
  id: string;
  email: string;
}

/**
 * User registration request
 */
export interface UserRegistrationRequest {
  email: string;
  password: string;
}

/**
 * User login request
 */
export interface UserLoginRequest {
  email: string;
  password: string;
}

// ============================================================================
// Token Types
// ============================================================================

/**
 * JWT token payload
 */
export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  tokenId?: string;
  iat?: number;
  exp?: number;
}

/**
 * Token pair response (access + refresh tokens)
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  tokenType: 'Bearer';
}

/**
 * Token refresh request
 */
export interface TokenRefreshRequest {
  refreshToken: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard error response format
 */
export interface ApiErrorResponse {
  error: string;
  message?: string;
  details?: any;
  code?: string;
  timestamp: string;
}

/**
 * Standard success response format
 */
export interface ApiSuccessResponse<T = any> {
  message?: string;
  data?: T;
}

/**
 * Paginated response format
 */
export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Meal Types
// ============================================================================

/**
 * Meal status enum
 */
export type MealStatus = 'pending' | 'completed' | 'skipped';

/**
 * Meal entity
 */
export interface Meal {
  id: string;
  userId: string;
  name: string;
  calories: number;
  protein: number;
  status: MealStatus;
  time: string;
  actualCalories?: number;
  actualProtein?: number;
  rating?: number;
  notes?: string;
  photoUrl?: string;
  substitutions?: Substitution[];
  logged?: string;
}

/**
 * Meal creation request
 */
export interface CreateMealRequest {
  name: string;
  calories: number;
  protein: number;
  time: string;
  notes?: string;
}

/**
 * Meal update request
 */
export interface UpdateMealRequest {
  name?: string;
  calories?: number;
  protein?: number;
  status?: MealStatus;
  actualCalories?: number;
  actualProtein?: number;
  rating?: number;
  notes?: string;
  photoUrl?: string;
}

/**
 * Meal logging request
 */
export interface LogMealRequest {
  status: MealStatus;
  actualCalories?: number;
  actualProtein?: number;
  rating?: number;
  notes?: string;
  photoUrl?: string;
}

// ============================================================================
// Substitution Types
// ============================================================================

/**
 * Food substitution record
 */
export interface Substitution {
  original: string;
  replacement: string;
  reason?: string;
  calorieAdjustment: number;
  proteinAdjustment: number;
  timestamp: string;
}

/**
 * Substitution creation request
 */
export interface CreateSubstitutionRequest {
  mealId: string;
  original: string;
  replacement: string;
  reason?: string;
  calorieAdjustment: number;
  proteinAdjustment: number;
}

// ============================================================================
// Pattern Types
// ============================================================================

/**
 * Meal pattern entity
 */
export interface Pattern {
  id: string;
  userId: string;
  date: string;
  patternType: string;
  meals: Meal[];
}

/**
 * Pattern creation request
 */
export interface CreatePatternRequest {
  date: string;
  patternType: string;
  mealIds: string[];
}

/**
 * Pattern query parameters
 */
export interface PatternQueryParams {
  startDate?: string;
  endDate?: string;
  patternType?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Inventory Types
// ============================================================================

/**
 * Inventory item category enum
 */
export type InventoryCategory =
  | 'protein'
  | 'carbohydrate'
  | 'vegetable'
  | 'fruit'
  | 'fat'
  | 'dairy';

/**
 * Inventory item entity
 */
export interface InventoryItem {
  id: string;
  userId: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Inventory item creation request
 */
export interface CreateInventoryItemRequest {
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  expiresAt?: string;
}

/**
 * Inventory item update request
 */
export interface UpdateInventoryItemRequest {
  name?: string;
  category?: InventoryCategory;
  quantity?: number;
  unit?: string;
  expiresAt?: string;
}

/**
 * Inventory query parameters
 */
export interface InventoryQueryParams {
  category?: InventoryCategory;
  expiringBefore?: string;
  inStock?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Daily nutrition summary
 */
export interface DailyNutritionSummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  targetCalories: number;
  targetProtein: number;
  mealsCompleted: number;
  mealsPlanned: number;
  adherenceRate: number;
}

/**
 * Weekly nutrition summary
 */
export interface WeeklyNutritionSummary {
  weekStart: string;
  weekEnd: string;
  dailySummaries: DailyNutritionSummary[];
  averageCalories: number;
  averageProtein: number;
  averageAdherence: number;
}

/**
 * Nutrition analytics query parameters
 */
export interface NutritionAnalyticsParams {
  startDate: string;
  endDate: string;
  aggregation?: 'daily' | 'weekly' | 'monthly';
}

// ============================================================================
// Express Request Extension
// ============================================================================

/**
 * Extend Express Request interface to include authenticated user
 */
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Make all properties of T optional except for K
 */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Extract keys from T where value type is V
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Make properties K of T required
 */
export type RequireProps<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for MealStatus
 */
export function isMealStatus(value: any): value is MealStatus {
  return ['pending', 'completed', 'skipped'].includes(value);
}

/**
 * Type guard for InventoryCategory
 */
export function isInventoryCategory(value: any): value is InventoryCategory {
  return ['protein', 'carbohydrate', 'vegetable', 'fruit', 'fat', 'dairy'].includes(value);
}

/**
 * Type guard for User
 */
export function isUser(value: any): value is User {
  return (
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.passwordHash === 'string' &&
    typeof value.createdAt === 'string'
  );
}

/**
 * Type guard for Meal
 */
export function isMeal(value: any): value is Meal {
  return (
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.userId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.calories === 'number' &&
    typeof value.protein === 'number' &&
    isMealStatus(value.status) &&
    typeof value.time === 'string'
  );
}

/**
 * Type guard for InventoryItem
 */
export function isInventoryItem(value: any): value is InventoryItem {
  return (
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.userId === 'string' &&
    typeof value.name === 'string' &&
    isInventoryCategory(value.category) &&
    typeof value.quantity === 'number' &&
    typeof value.unit === 'string'
  );
}
