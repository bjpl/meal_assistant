/**
 * Inventory Types and Interfaces
 * Core type definitions for the inventory management system
 */

// Storage location types
export type StorageLocation = 'fridge' | 'pantry' | 'freezer' | 'counter' | 'spice_rack';

// Freshness status indicators
export type FreshnessStatus = 'fresh' | 'good' | 'use_soon' | 'expiring' | 'expired';

// Unit of measurement types
export type UnitType =
  | 'oz' | 'lb' | 'g' | 'kg'           // Weight
  | 'ml' | 'l' | 'cup' | 'tbsp' | 'tsp' // Volume
  | 'count' | 'pieces' | 'servings';    // Count

// Category types for organization
export type InventoryCategory =
  | 'protein' | 'dairy' | 'produce' | 'grains'
  | 'condiments' | 'beverages' | 'frozen'
  | 'snacks' | 'leftovers' | 'prepared' | 'other';

/**
 * Core inventory item interface
 */
export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: UnitType;
  location: StorageLocation;
  category: InventoryCategory;
  purchaseDate: Date;
  expiryDate: Date;
  openedDate?: Date;
  avgUsageRate: number;  // Units consumed per day
  predictedDepletionDate: Date;
  cost: number;
  costPerUnit: number;
  barcode?: string;
  brand?: string;
  notes?: string;
  isLeftover: boolean;
  originalMealId?: string;  // For leftovers from logged meals
  imageUrl?: string;
  nutritionPer100g?: NutritionInfo;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Nutrition information per 100g
 */
export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  sugar?: number;
}

/**
 * Inventory transaction for tracking changes
 */
export interface InventoryTransaction {
  id: string;
  itemId: string;
  type: 'add' | 'remove' | 'adjust' | 'transfer' | 'waste';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  mealId?: string;  // If deducted due to meal logging
  timestamp: Date;
  source: 'manual' | 'meal_log' | 'barcode' | 'voice' | 'receipt' | 'auto_deduct';
}

/**
 * Expiry alert configuration
 */
export interface ExpiryAlert {
  id: string;
  itemId: string;
  itemName: string;
  alertType: 'warning' | 'critical' | 'expired';
  daysUntilExpiry: number;
  expiryDate: Date;
  suggestedActions: string[];
  mealSuggestions?: MealSuggestion[];
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
}

/**
 * Meal suggestion for expiring items
 */
export interface MealSuggestion {
  mealName: string;
  mealPatternId?: string;
  usesItems: string[];  // Item IDs
  priority: number;
  prepTime: number;  // minutes
}

/**
 * Leftover item with additional tracking
 */
export interface LeftoverItem extends InventoryItem {
  isLeftover: true;
  originalMealId: string;
  originalMealName: string;
  portionEstimate: 'small' | 'medium' | 'large';
  recommendedUseByDate: Date;
  reheatingInstructions?: string;
  timesReheated: number;
  maxReheatings: number;
}

/**
 * Usage prediction result
 */
export interface UsagePrediction {
  itemId: string;
  currentQuantity: number;
  predictedDepletionDate: Date;
  confidenceScore: number;  // 0-1
  dailyUsageRate: number;
  weeklyUsageRate: number;
  suggestedReorderDate: Date;
  suggestedReorderQuantity: number;
  historicalDataPoints: number;
}

/**
 * Shopping list item generated from predictions
 */
export interface ShoppingListItem {
  itemId?: string;  // If restocking existing item
  name: string;
  suggestedQuantity: number;
  unit: UnitType;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: 'depleted' | 'low_stock' | 'predicted_depletion' | 'expiring' | 'manual';
  preferredStore?: string;
  estimatedCost?: number;
  addedAt: Date;
}

/**
 * Waste tracking record
 */
export interface WasteRecord {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: UnitType;
  cost: number;
  reason: 'expired' | 'spoiled' | 'damaged' | 'disliked' | 'other';
  wastedAt: Date;
  preventable: boolean;
  notes?: string;
}

/**
 * Barcode scan result
 */
export interface BarcodeScanResult {
  barcode: string;
  found: boolean;
  product?: {
    name: string;
    brand?: string;
    category?: InventoryCategory;
    defaultUnit: UnitType;
    defaultQuantity: number;
    typicalExpiryDays: number;
    nutritionPer100g?: NutritionInfo;
    imageUrl?: string;
  };
  source?: 'local_cache' | 'openfoodfacts' | 'manual';
}

/**
 * Receipt parsing result
 */
export interface ReceiptParseResult {
  storeName?: string;
  purchaseDate?: Date;
  items: ParsedReceiptItem[];
  totalAmount?: number;
  confidence: number;
}

export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  matchedInventoryItemId?: string;
  confidence: number;
}

/**
 * Inventory statistics
 */
export interface InventoryStats {
  totalItems: number;
  totalValue: number;
  itemsByLocation: Record<StorageLocation, number>;
  itemsByCategory: Record<InventoryCategory, number>;
  expiringWithin48Hours: number;
  expiringWithinWeek: number;
  lowStockItems: number;
  wasteThisMonth: number;
  wasteCostThisMonth: number;
  averageItemLifespan: number;  // days
}

/**
 * Inventory filter options
 */
export interface InventoryFilters {
  location?: StorageLocation[];
  category?: InventoryCategory[];
  freshnessStatus?: FreshnessStatus[];
  isLeftover?: boolean;
  searchQuery?: string;
  sortBy?: 'name' | 'expiryDate' | 'quantity' | 'cost' | 'addedDate';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Inventory event for real-time updates
 */
export interface InventoryEvent {
  type: 'item_added' | 'item_updated' | 'item_removed' | 'alert_created' | 'depletion_predicted';
  payload: unknown;
  timestamp: Date;
}
