// Meal Assistant - Optimization Types for Multi-Store Kanban Board

// ============================================
// Weight Configuration Types
// ============================================
export interface OptimizationWeights {
  price: number;      // 0-100
  distance: number;   // 0-100
  quality: number;    // 0-100
  time: number;       // 0-100
}

export interface WeightPreset {
  id: string;
  name: string;
  weights: OptimizationWeights;
  icon: string;
}

export const WEIGHT_PRESETS: WeightPreset[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    weights: { price: 25, distance: 25, quality: 25, time: 25 },
    icon: 'scale-balanced',
  },
  {
    id: 'save-money',
    name: 'Save Money',
    weights: { price: 50, distance: 20, quality: 15, time: 15 },
    icon: 'piggy-bank',
  },
  {
    id: 'save-time',
    name: 'Save Time',
    weights: { price: 15, distance: 30, quality: 15, time: 40 },
    icon: 'clock',
  },
  {
    id: 'quality-first',
    name: 'Quality First',
    weights: { price: 15, distance: 15, quality: 55, time: 15 },
    icon: 'star',
  },
];

// ============================================
// Store Types
// ============================================
export interface Store {
  id: string;
  name: string;
  address: string;
  distance: number;       // miles
  rating: number;         // 1-5
  openHours: string;
  estimatedTime: number;  // minutes to shop
  priceLevel: 1 | 2 | 3;  // $ $$ $$$
  sections: string[];
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

// ============================================
// Item Score Types
// ============================================
export interface StoreItemScore {
  storeId: string;
  storeName: string;
  price: number;
  priceScore: number;     // 0-100
  distanceScore: number;  // 0-100
  qualityScore: number;   // 0-100
  timeScore: number;      // 0-100
  totalScore: number;     // weighted average
  inStock: boolean;
  lastUpdated: string;
}

export interface OptimizedItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  assignedStoreId: string;
  assignedStoreName: string;
  price: number;
  storeScores: Map<string, StoreItemScore> | Record<string, StoreItemScore>;
  bestScore: number;
  manuallyAssigned: boolean;
}

// ============================================
// Route Types
// ============================================
export interface RouteStop {
  storeId: string;
  storeName: string;
  order: number;
  estimatedArrival: string;
  estimatedDuration: number;  // minutes
  itemCount: number;
  estimatedSpend: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface OptimizedRoute {
  stops: RouteStop[];
  totalDistance: number;      // miles
  totalDuration: number;      // minutes
  totalSpend: number;
  savings: number;
  startLocation: {
    latitude: number;
    longitude: number;
  };
}

// ============================================
// Shopping Mode Types
// ============================================
export interface StoreShoppingSession {
  storeId: string;
  storeName: string;
  items: ShoppingModeItem[];
  startTime: string;
  endTime?: string;
  status: 'pending' | 'in-progress' | 'completed';
  actualTotal: number;
  receiptUri?: string;
}

export interface ShoppingModeItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  section: string;
  sectionOrder: number;
  estimatedPrice: number;
  actualPrice?: number;
  checked: boolean;
  unavailable: boolean;
  substituteId?: string;
  substituteName?: string;
}

export interface StoreSection {
  id: string;
  name: string;
  order: number;
  icon: string;
}

export const STORE_SECTIONS: StoreSection[] = [
  { id: 'produce', name: 'Produce', order: 1, icon: 'carrot' },
  { id: 'bakery', name: 'Bakery', order: 2, icon: 'bread-slice' },
  { id: 'deli', name: 'Deli', order: 3, icon: 'meat' },
  { id: 'dairy', name: 'Dairy', order: 4, icon: 'cheese' },
  { id: 'meat', name: 'Meat & Seafood', order: 5, icon: 'drumstick' },
  { id: 'frozen', name: 'Frozen', order: 6, icon: 'snowflake' },
  { id: 'pantry', name: 'Pantry', order: 7, icon: 'box' },
  { id: 'beverages', name: 'Beverages', order: 8, icon: 'bottle' },
  { id: 'household', name: 'Household', order: 9, icon: 'spray-can' },
  { id: 'checkout', name: 'Checkout', order: 10, icon: 'cash-register' },
];

// ============================================
// Drag and Drop Types
// ============================================
export interface DragState {
  isDragging: boolean;
  draggedItemId: string | null;
  sourceStoreId: string | null;
  targetStoreId: string | null;
  dragPosition: { x: number; y: number };
}

export interface DropZone {
  storeId: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ============================================
// Optimization State
// ============================================
export interface OptimizationState {
  weights: OptimizationWeights;
  activePreset: string;
  isCustomWeights: boolean;
  stores: Store[];
  items: OptimizedItem[];
  storeAssignments: Record<string, string[]>;  // storeId -> itemIds
  route: OptimizedRoute | null;
  savings: {
    total: number;
    vsAveragePrice: number;
    perStore: Record<string, number>;
  };
  shoppingSessions: StoreShoppingSession[];
  activeSession: string | null;
  isCalculating: boolean;
  lastCalculated: string | null;
  error: string | null;
}

// ============================================
// Action Payloads
// ============================================
export interface MoveItemPayload {
  itemId: string;
  fromStoreId: string;
  toStoreId: string;
}

export interface UpdateWeightsPayload {
  weights: OptimizationWeights;
  presetId?: string;
}

export interface RecalculatePayload {
  weights: OptimizationWeights;
  items: OptimizedItem[];
  stores: Store[];
}
