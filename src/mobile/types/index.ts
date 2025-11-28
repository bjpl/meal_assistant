// Meal Assistant - Core Type Definitions

// ============================================
// Pattern Types
// ============================================
export type PatternId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface MealPattern {
  id: PatternId;
  name: string;
  description: string;
  optimalFor: string[];
  meals: {
    morning?: MealSlot;
    midMorning?: MealSlot;
    noon?: MealSlot;
    afternoon?: MealSlot;
    evening?: MealSlot;
    platter?: PlatterMealSlot;
  };
  totalCalories: number;
  totalProtein: number;
  isFastingPattern?: boolean;
  eatingWindowStart?: string;
  eatingWindowEnd?: string;
}

export interface MealSlot {
  time: string;
  calories: number;
  protein: number;
  components: MealComponent[];
}

export interface PlatterMealSlot extends MealSlot {
  style: 'platter';
  stations: string[];
}

export interface MealComponent {
  id: string;
  name: string;
  category: 'protein' | 'carb' | 'vegetable' | 'fat' | 'flavor' | 'fruit';
  calories: number;
  protein: number;
  portion: string;
  substitutes?: string[];
}

// ============================================
// Tracking Types
// ============================================
export interface MealLog {
  id: string;
  date: string;
  patternId: PatternId;
  mealType: 'morning' | 'noon' | 'evening' | 'snack';
  photoUri?: string;
  satisfaction: 1 | 2 | 3 | 4 | 5;
  energyLevel: number; // 0-100
  hungerBefore: number; // 0-100
  hungerAfter: number; // 0-100
  components: ConsumedComponent[];
  notes?: string;
  createdAt: string;
}

export interface ConsumedComponent {
  componentId: string;
  name: string;
  portion: number; // multiplier (1 = standard)
  calories: number;
  protein: number;
  substituted?: boolean;
  originalComponent?: string;
}

// ============================================
// Inventory Types
// ============================================
export interface InventoryItem {
  id: string;
  name: string;
  category: 'protein' | 'carb' | 'vegetable' | 'fruit' | 'dairy' | 'pantry' | 'frozen' | 'leftover';
  quantity: number;
  unit: string;
  expiryDate?: string;
  purchaseDate: string;
  location: 'fridge' | 'freezer' | 'pantry';
  barcode?: string;
  pricePerUnit?: number;
  store?: string;
  isLeftover?: boolean;
  parentMealId?: string;
}

export type ExpiryStatus = 'fresh' | 'expiring-soon' | 'expired';

// ============================================
// Meal Prep Types
// ============================================
export interface PrepTask {
  id: string;
  title: string;
  description: string;
  duration: number; // minutes
  equipment: string[];
  ingredientIds: string[];
  dependencies: string[]; // other task IDs
  status: 'pending' | 'in-progress' | 'completed';
  order: number;
  parallelGroup?: string; // tasks in same group can run parallel
}

export interface PrepSession {
  id: string;
  date: string;
  patternId: PatternId;
  tasks: PrepTask[];
  totalDuration: number;
  equipmentUsed: Equipment[];
  status: 'planning' | 'in-progress' | 'completed';
  startTime?: string;
  endTime?: string;
}

export interface Equipment {
  id: string;
  name: string;
  status: 'available' | 'in-use' | 'dirty' | 'unavailable';
  currentTask?: string;
  icon: string;
}

// ============================================
// Shopping Types
// ============================================
export interface ShoppingList {
  id: string;
  name: string;
  weekOf: string;
  items: ShoppingItem[];
  stores: StoreAssignment[];
  totalEstimatedCost: number;
  status: 'planning' | 'shopping' | 'completed';
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  storeSection: string;
  assignedStore?: string;
  estimatedPrice?: number;
  actualPrice?: number;
  checked: boolean;
  deal?: DealInfo;
}

export interface StoreAssignment {
  storeId: string;
  storeName: string;
  items: string[]; // item IDs
  estimatedTotal: number;
  actualTotal?: number;
}

export interface DealInfo {
  originalPrice: number;
  salePrice: number;
  expiryDate: string;
  confidence: 'low' | 'medium' | 'high';
}

// ============================================
// Analytics Types
// ============================================
export interface WeightEntry {
  date: string;
  weight: number;
  notes?: string;
}

export interface DailyStats {
  date: string;
  patternId: PatternId;
  totalCalories: number;
  totalProtein: number;
  mealsLogged: number;
  adherenceScore: number; // 0-100
  averageSatisfaction: number;
  averageEnergy: number;
}

export interface PatternStats {
  patternId: PatternId;
  timesUsed: number;
  averageSatisfaction: number;
  averageEnergy: number;
  adherenceRate: number;
  lastUsed: string;
}

// ============================================
// User Preferences
// ============================================
export interface UserPreferences {
  targetCalories: number;
  targetProtein: number;
  primaryPattern: PatternId;
  notificationsEnabled: boolean;
  mealReminders: {
    morning: string;
    noon: string;
    evening: string;
  };
  theme: 'light' | 'dark' | 'system';
  units: 'imperial' | 'metric';
}

// ============================================
// Navigation Types
// ============================================
export type RootStackParamList = {
  MainTabs: undefined;
  Onboarding: undefined;
  MealDetail: { mealLogId: string };
  PatternDetail: { patternId: PatternId };
  PatternSwitchPreview: { newPatternId: PatternId };
  InventoryItem: { itemId?: string };
  PrepSession: { sessionId: string };
  ShoppingTrip: { listId: string; storeId: string };
  Camera: { mode: 'meal' | 'barcode' | 'receipt' };
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  Profile: undefined;
  Patterns: undefined;
  Schedule: undefined;
  Stores: undefined;
  FirstWeek: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Tracking: undefined;
  Inventory: undefined;
  PrepPlan: undefined;
  Analytics: undefined;
  Shopping: undefined;
  Hydration: undefined;
};

// ============================================
// Hydration Types
// ============================================
export type BeverageType = 'water' | 'coffee' | 'tea' | 'soda' | 'energy_drink' | 'juice' | 'other';

export interface HydrationLog {
  id: string;
  type: BeverageType;
  amount_oz: number;
  caffeine_mg: number;
  timestamp: string;
  notes?: string;
}

export interface HydrationGoals {
  daily_water_oz: number;
  daily_caffeine_limit_mg: number;
  caffeine_warning_mg: number;
}

export interface HydrationProgress {
  total_water_oz: number;
  total_caffeine_mg: number;
  percent_of_goal: number;
  caffeine_status: 'safe' | 'warning' | 'limit';
  entries_count: number;
}

export interface HydrationTrendDay {
  date: string;
  water_oz: number;
  caffeine_mg: number;
  percent_of_goal: number;
}

export interface HourlyHydration {
  hour: number;
  water_oz: number;
  caffeine_mg: number;
}

export const CAFFEINE_CONTENT: Record<BeverageType, number> = {
  water: 0,
  coffee: 95, // per 8oz
  tea: 47, // per 8oz
  soda: 30, // per 12oz
  energy_drink: 150, // per 8oz
  juice: 0,
  other: 0,
};

export const BEVERAGE_LABELS: Record<BeverageType, string> = {
  water: 'Water',
  coffee: 'Coffee',
  tea: 'Tea',
  soda: 'Soda',
  energy_drink: 'Energy Drink',
  juice: 'Juice',
  other: 'Other',
};

// ============================================
// Re-export Optimization Types
// ============================================
export * from './optimization.types';

// ============================================
// Re-export Analytics Types (Week 7-8)
// ============================================
export * from './analytics.types';

// ============================================
// Re-export Onboarding Types (Week 9-10)
// ============================================
export * from './onboarding.types';
