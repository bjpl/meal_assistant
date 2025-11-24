# Meal Assistant System Architecture

## Version 1.0 | November 2025

---

## 1. Executive Summary

This document defines the complete system architecture for the Meal Assistant application - a mobile-first, offline-capable Progressive Web Application that transforms a 7-pattern flexible eating system into an intelligent nutrition management platform.

### Key Architectural Drivers

| Driver | Requirement | Architectural Impact |
|--------|-------------|---------------------|
| Mobile-First | iOS/Android native experience | React Native with Expo |
| Offline-First | Full functionality without connectivity | Local SQLite + sync queue |
| Real-Time Pattern Switching | Switch patterns mid-day seamlessly | Event-driven state management |
| Photo Capture | Multi-angle ingredient scanning | Native camera integration |
| Voice Control | Hands-free cooking mode | Speech recognition services |
| Target Metrics | 1800-2000 cal, 130-145g protein | Constraint validation engine |

---

## 2. High-Level System Architecture

```
+-----------------------------------------------------------------------------------+
|                              MEAL ASSISTANT SYSTEM                                 |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +----------------------------------+    +----------------------------------+     |
|  |        PRESENTATION LAYER        |    |        EXTERNAL SERVICES         |     |
|  +----------------------------------+    +----------------------------------+     |
|  |  Mobile App (React Native)       |    |  Cloud Sync (Supabase)           |     |
|  |  - Pattern Selection UI          |    |  - Real-time subscriptions       |     |
|  |  - Meal Planning Views           |    |  - File storage (photos)         |     |
|  |  - Inventory Management          |    |  - Authentication                |     |
|  |  - Shopping Lists                |    +----------------------------------+     |
|  |  - Prep Orchestration            |    |  AI/ML Services                  |     |
|  |  - Analytics Dashboards          |    |  - OCR (ML Kit)                  |     |
|  |  - Voice Interface               |    |  - Image Recognition             |     |
|  +----------------------------------+    |  - Deal Pattern Learning         |     |
|              |                           +----------------------------------+     |
|              v                                                                    |
|  +----------------------------------+    +----------------------------------+     |
|  |        APPLICATION LAYER         |    |       INTEGRATION LAYER          |     |
|  +----------------------------------+    +----------------------------------+     |
|  |  Domain Services:                |    |  - Health App Sync               |     |
|  |  - Pattern Engine                |    |  - Calendar Integration          |     |
|  |  - Meal Composer                 |    |  - Store APIs (future)           |     |
|  |  - Nutrition Calculator          |    |  - Receipt Processing            |     |
|  |  - Inventory Manager             |    +----------------------------------+     |
|  |  - Prep Orchestrator             |                                            |
|  |  - Shopping Optimizer            |                                            |
|  |  - Equipment Tracker             |                                            |
|  |  - Analytics Engine              |                                            |
|  |  - Notification Coordinator      |                                            |
|  +----------------------------------+                                            |
|              |                                                                    |
|              v                                                                    |
|  +----------------------------------+    +----------------------------------+     |
|  |          DATA LAYER              |    |        SYNC LAYER                |     |
|  +----------------------------------+    +----------------------------------+     |
|  |  Local Storage:                  |    |  - Event Queue                   |     |
|  |  - SQLite (structured data)      |    |  - Conflict Resolution           |     |
|  |  - AsyncStorage (preferences)    |    |  - Background Sync               |     |
|  |  - FileSystem (images/cache)     |    |  - Delta Compression             |     |
|  +----------------------------------+    +----------------------------------+     |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

## 3. Component Architecture

### 3.1 Core Domain Components

```
+------------------------------------------------------------------+
|                     DOMAIN COMPONENT MAP                          |
+------------------------------------------------------------------+

    +-------------------+         +-------------------+
    |   PATTERN ENGINE  |-------->|   MEAL COMPOSER   |
    +-------------------+         +-------------------+
    | - 7 meal patterns |         | - Component mixer |
    | - Schedule rules  |         | - Portion calc    |
    | - Success predict |         | - Substitutions   |
    +-------------------+         +-------------------+
            |                             |
            v                             v
    +-------------------+         +-------------------+
    | COMPONENT LIBRARY |         | NUTRITION CALC    |
    +-------------------+         +-------------------+
    | - Proteins        |         | - Calorie totals  |
    | - Carbohydrates   |         | - Macro tracking  |
    | - Vegetables      |         | - Target alerts   |
    | - Fats            |         | - History trends  |
    | - Fruits          |         +-------------------+
    | - Flavor enhance  |
    +-------------------+
            |
            v
    +-------------------+         +-------------------+
    | INVENTORY MANAGER |<------->| SHOPPING OPTIMIZER|
    +-------------------+         +-------------------+
    | - Stock levels    |         | - Multi-store     |
    | - Expiry tracking |         | - Deal matching   |
    | - Location assign |         | - Price tracking  |
    | - Waste analytics |         | - List generation |
    +-------------------+         +-------------------+
            |
            v
    +-------------------+         +-------------------+
    | EQUIPMENT TRACKER |-------->| PREP ORCHESTRATOR |
    +-------------------+         +-------------------+
    | - Appliances      |         | - Timeline gen    |
    | - Cookware        |         | - Parallel tasks  |
    | - Tools           |         | - Conflict detect |
    | - Status (clean)  |         | - Timer manage    |
    +-------------------+         +-------------------+
            |
            v
    +-------------------+
    | NOTIFICATION COORD|
    +-------------------+
    | - Meal reminders  |
    | - Prep alerts     |
    | - Timer callbacks |
    | - Batch/priority  |
    +-------------------+
```

### 3.2 Component Specifications

#### 3.2.1 Pattern Engine

**Responsibility:** Manages the 7 interchangeable meal patterns and determines optimal pattern selection.

```typescript
interface PatternEngine {
  patterns: {
    TRADITIONAL: PatternDefinition;      // Soup -> Bowl -> Protein+Veg
    REVERSED: PatternDefinition;         // Soup -> Protein+Veg -> Bowl
    IF_NOON_START: PatternDefinition;    // Fast -> 900cal -> 900cal
    GRAZING_MINI: PatternDefinition;     // 4 x 450cal meals
    PLATTER_METHOD: PatternDefinition;   // All-day buffet setup
    BIG_BREAKFAST: PatternDefinition;    // 850 -> 400 -> 550
    MORNING_FEAST: PatternDefinition;    // Eat 5AM-1PM only
  };

  operations: {
    selectPattern(context: DayContext): PatternRecommendation;
    switchPattern(current: Pattern, target: Pattern, timeOfDay: Time): TransitionPlan;
    predictSuccess(pattern: Pattern, history: UserHistory): SuccessProbability;
    generateSchedule(pattern: Pattern, preferences: UserPrefs): MealSchedule;
  };

  constraints: {
    dailyCalories: { min: 1800, max: 2000 };
    dailyProtein: { min: 130, max: 145 };
  };
}
```

#### 3.2.2 Component Library

**Responsibility:** Central repository of all food components with nutritional data.

```typescript
interface ComponentLibrary {
  categories: {
    proteins: {
      lean: ProteinItem[];      // 250-280 cal (chicken, cod, egg whites)
      moderate: ProteinItem[];  // 290-320 cal (salmon, sirloin)
      plantCombo: ProteinItem[]; // 330-400 cal (beans, dal, yogurt)
    };
    carbohydrates: {
      grains: CarbItem[];       // 200-250 cal/cup (rice, quinoa, arepas)
      fruits: FruitItem[];      // 54-110 cal (oranges, bananas, pineapple)
    };
    vegetables: {
      raw: VegetableItem[];     // 16-30 cal (greens, cucumber, peppers)
      prepared: VegetableItem[]; // 220-280 cal (steamed, roasted, stir-fried)
    };
    fats: {
      cheese: FatItem[];        // 80-100 cal (shredded, feta, mozzarella)
      other: FatItem[];         // 70-190 cal (avocado, oil, nuts)
    };
    flavorEnhancers: FlavorItem[]; // 5-90 cal (pickles, sauces, aromatics)
  };

  operations: {
    searchComponents(query: string, filters: ComponentFilters): Component[];
    getSubstitutes(component: Component, constraints: NutritionConstraints): Component[];
    calculateNutrition(components: Component[]): NutritionSummary;
  };
}
```

#### 3.2.3 Inventory Manager

**Responsibility:** Tracks all food inventory with location, quantity, and expiration.

```typescript
interface InventoryManager {
  storage: {
    locations: ['refrigerator', 'freezer', 'pantry', 'counter'];
    trackingFields: ['quantity', 'unit', 'purchaseDate', 'expiryDate', 'location'];
  };

  operations: {
    addItem(item: InventoryItem): void;
    updateQuantity(itemId: string, delta: number, reason: string): void;
    getExpiringItems(withinDays: number): InventoryItem[];
    checkAvailability(ingredients: Ingredient[]): AvailabilityReport;
    reconcileAfterMeal(mealLog: MealLog): InventoryDelta[];
    predictDepletionDate(itemId: string): Date;
  };

  alerts: {
    expiryWarning: { threshold: 48 }; // hours
    lowStock: { threshold: 'oneWeekSupply' };
    wasteTracking: { enabled: true };
  };
}
```

#### 3.2.4 Prep Orchestrator

**Responsibility:** Generates optimized meal prep timelines considering equipment and parallel tasks.

```typescript
interface PrepOrchestrator {
  inputs: {
    meals: Meal[];
    equipment: EquipmentInventory;
    timeConstraints: TimeWindow;
    preferences: PrepPreferences;
  };

  operations: {
    generateTimeline(weekPlan: WeekPlan): PrepTimeline;
    optimizeParallelTasks(tasks: PrepTask[]): OptimizedSchedule;
    detectConflicts(schedule: PrepSchedule): Conflict[];
    resolveConflict(conflict: Conflict): Resolution;
    trackProgress(session: PrepSession): ProgressUpdate;
  };

  outputs: {
    timeline: GanttChart;
    taskList: PrepTask[];
    equipmentSchedule: EquipmentTimeline;
    cleaningSchedule: CleaningTask[];
  };
}
```

#### 3.2.5 Equipment Tracker

**Responsibility:** Manages kitchen equipment inventory, status, and availability.

```typescript
interface EquipmentTracker {
  inventory: {
    appliances: {
      major: Appliance[];  // oven, stovetop, microwave, rice cooker
      small: Appliance[];  // food processor, blender, air fryer
    };
    cookware: {
      pots: Cookware[];
      pans: Cookware[];
      baking: Cookware[];
    };
    tools: {
      cutting: Tool[];
      measuring: Tool[];
      prep: Tool[];
    };
    storage: {
      containers: StorageItem[];
    };
  };

  status: {
    states: ['available', 'in_use', 'dirty', 'in_dishwasher', 'maintenance'];
    tracking: Map<EquipmentId, EquipmentStatus>;
  };

  operations: {
    checkAvailability(equipment: string[]): AvailabilityMap;
    reserveEquipment(equipmentId: string, duration: number): Reservation;
    markStatus(equipmentId: string, status: EquipmentStatus): void;
    getAlternatives(equipment: string): string[];
  };
}
```

---

## 4. Data Architecture

### 4.1 Data Model Overview

```
+------------------------------------------------------------------+
|                       DATA MODEL HIERARCHY                        |
+------------------------------------------------------------------+

                        +------------------+
                        |      USER        |
                        +------------------+
                        | id, profile,     |
                        | preferences,     |
                        | targets          |
                        +--------+---------+
                                 |
         +-----------------------+-----------------------+
         |                       |                       |
         v                       v                       v
+------------------+   +------------------+   +------------------+
|   MEAL_PLANS     |   |    INVENTORY     |   |    EQUIPMENT     |
+------------------+   +------------------+   +------------------+
| week_id, pattern |   | item_id, name    |   | id, type, name   |
| meals[], status  |   | quantity, unit   |   | capacity, status |
+--------+---------+   | location, expiry |   +------------------+
         |             +--------+---------+
         |                      |
         v                      v
+------------------+   +------------------+
|     MEALS        |   | INVENTORY_LOGS   |
+------------------+   +------------------+
| id, type, time   |   | change_type      |
| components[]     |   | quantity_delta   |
| nutrition_totals |   | reason, timestamp|
+--------+---------+   +------------------+
         |
         v
+------------------+   +------------------+   +------------------+
|   COMPONENTS     |   |   MEAL_LOGS      |   |   PREP_SESSIONS  |
+------------------+   +------------------+   +------------------+
| id, category     |   | meal_id, eaten   |   | id, start, end   |
| name, nutrition  |   | satisfaction     |   | tasks[], status  |
| prep_method      |   | photo, notes     |   | efficiency_score |
+------------------+   +------------------+   +------------------+
```

### 4.2 Core Entity Schemas

```typescript
// User Profile & Settings
interface User {
  id: string;
  profile: {
    name: string;
    age: number;
    weight: number;        // lbs
    height: number;        // inches
    activityLevel: 'sedentary' | 'light' | 'moderate' | 'active';
  };
  targets: {
    calories: { min: number; max: number };
    protein: { min: number; max: number };
    hydration: number;     // oz
    caffeineLimit: number; // mg
  };
  preferences: {
    defaultPattern: PatternType;
    mealTimes: Record<MealType, TimePreference>;
    dietaryRestrictions: string[];
    preferredStores: Store[];
  };
}

// Meal Pattern Definition
interface PatternDefinition {
  id: PatternType;
  name: string;
  description: string;
  mealStructure: {
    meals: {
      type: MealType;
      timeWindow: { start: string; end: string };
      calorieTarget: number;
      proteinTarget: number;
    }[];
  };
  constraints: {
    fastingWindow?: { start: string; end: string };
    maxMeals: number;
    minTimeBetweenMeals: number; // minutes
  };
  suitableFor: string[];  // contexts where pattern works best
}

// Food Component
interface Component {
  id: string;
  category: ComponentCategory;
  subcategory: string;
  name: string;
  aliases: string[];
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  servingSize: {
    amount: number;
    unit: string;
    description: string;
  };
  prepMethods: PrepMethod[];
  storageInfo: {
    location: StorageLocation;
    shelfLife: number;      // days
    freezable: boolean;
  };
}

// Inventory Item
interface InventoryItem {
  id: string;
  componentId: string;
  quantity: number;
  unit: string;
  location: StorageLocation;
  purchaseDate: Date;
  expiryDate: Date;
  status: 'fresh' | 'expiring_soon' | 'expired';
  notes?: string;
}

// Equipment Item
interface Equipment {
  id: string;
  type: 'appliance' | 'cookware' | 'tool' | 'storage';
  subtype: string;
  name: string;
  capacity?: string;
  features?: string[];
  status: EquipmentStatus;
  location: string;
  lastCleaned?: Date;
}

// Meal Plan
interface MealPlan {
  id: string;
  userId: string;
  weekStart: Date;
  pattern: PatternType;
  meals: PlannedMeal[];
  prepSessions: PrepSession[];
  shoppingList: ShoppingItem[];
  status: 'draft' | 'active' | 'completed';
}

// Meal Log (actual consumption)
interface MealLog {
  id: string;
  mealPlanId: string;
  plannedMealId: string;
  actualTime: Date;
  components: ConsumedComponent[];
  nutrition: NutritionTotals;
  satisfaction: number;     // 1-5
  energyAfter: number;      // 1-10, logged 1-2 hours later
  hungerBefore: number;     // 1-10
  photo?: string;
  notes?: string;
}
```

### 4.3 Local Storage Strategy

```
+------------------------------------------------------------------+
|                    LOCAL STORAGE ARCHITECTURE                     |
+------------------------------------------------------------------+

+------------------------+     +------------------------+
|       SQLite DB        |     |     AsyncStorage       |
+------------------------+     +------------------------+
| - User data            |     | - App preferences      |
| - Meal plans           |     | - UI state             |
| - Components library   |     | - Cache metadata       |
| - Inventory            |     | - Session tokens       |
| - Equipment            |     | - Feature flags        |
| - Meal logs            |     +------------------------+
| - Shopping lists       |
| - Price history        |     +------------------------+
| - Sync queue           |     |      FileSystem        |
+------------------------+     +------------------------+
                               | - Meal photos          |
                               | - Receipt images       |
                               | - Ad scans             |
                               | - Export files         |
                               +------------------------+
```

**Storage Estimates:**

| Data Type | Initial | 6 Months | 1 Year |
|-----------|---------|----------|--------|
| Core data (SQLite) | 2 MB | 15 MB | 30 MB |
| Preferences | 50 KB | 100 KB | 150 KB |
| Images | 0 MB | 200 MB | 500 MB |
| **Total** | **2 MB** | **215 MB** | **530 MB** |

---

## 5. Data Flow Architecture

### 5.1 Pattern Selection Flow

```
+------------------------------------------------------------------+
|                    PATTERN SELECTION FLOW                         |
+------------------------------------------------------------------+

  [User Wakes Up]
        |
        v
  +------------------+
  | Check Context    |
  | - Time of day    |
  | - Day of week    |
  | - Calendar events|
  | - Yesterday's    |
  |   pattern/outcome|
  +--------+---------+
           |
           v
  +------------------+     +------------------+
  | Pattern Engine   |---->| Success Predictor|
  | Generate         |     | - Historical fit |
  | Recommendations  |     | - Context match  |
  +--------+---------+     +--------+---------+
           |                        |
           v                        v
  +------------------+     +------------------+
  | Present Options  |     | Confidence Score |
  | - Recommended    |     | per Pattern      |
  | - Alternatives   |     +------------------+
  +--------+---------+
           |
           v
  +------------------+
  | User Selects     |
  | Pattern          |
  +--------+---------+
           |
           v
  +------------------+     +------------------+
  | Generate Meals   |---->| Check Inventory  |
  | for Pattern      |     | Availability     |
  +--------+---------+     +--------+---------+
           |                        |
           v                        v
  +------------------+     +------------------+
  | Create Day Plan  |     | Flag Missing     |
  | - Meal schedule  |     | Items for        |
  | - Prep tasks     |     | Shopping List    |
  | - Notifications  |     +------------------+
  +------------------+
```

### 5.2 Meal Prep Orchestration Flow

```
+------------------------------------------------------------------+
|                    PREP ORCHESTRATION FLOW                        |
+------------------------------------------------------------------+

  [Sunday Prep Trigger]
        |
        v
  +------------------+
  | Load Week Plan   |
  | - All patterns   |
  | - All meals      |
  +--------+---------+
           |
           v
  +------------------+     +------------------+
  | Equipment Check  |---->| Conflict         |
  | - Availability   |     | Detection        |
  | - Status (clean) |     +--------+---------+
  +--------+---------+              |
           |                        v
           |              +------------------+
           |              | Suggest          |
           |              | Resolutions      |
           |              +------------------+
           v
  +------------------+
  | Generate         |
  | Prep Timeline    |
  +--------+---------+
           |
           v
  +------------------+     +------------------+
  | Optimize         |---->| Parallel Task    |
  | Task Order       |     | Identification   |
  +--------+---------+     +------------------+
           |
           v
  +------------------+
  | Create Gantt     |
  | Schedule         |
  +--------+---------+
           |
           v
  +------------------+     +------------------+
  | Start Prep       |---->| Timer Manager    |
  | Session          |     | - Multi-timer    |
  +--------+---------+     | - Audio alerts   |
           |               +------------------+
           v
  +------------------+     +------------------+
  | Track Progress   |---->| Notification     |
  | - Task complete  |     | Coordinator      |
  | - Photos         |     | - Next task      |
  | - Issues         |     | - Behind alert   |
  +--------+---------+     +------------------+
           |
           v
  +------------------+
  | Session Complete |
  | - Efficiency     |
  | - Inventory upd  |
  | - Learn for next |
  +------------------+
```

### 5.3 Sync Flow (Offline-First)

```
+------------------------------------------------------------------+
|                    OFFLINE-FIRST SYNC FLOW                        |
+------------------------------------------------------------------+

  [User Action]
        |
        v
  +------------------+
  | Local Write      |
  | (SQLite)         |
  +--------+---------+
           |
           +----------------------+
           |                      |
           v                      v
  +------------------+   +------------------+
  | Update UI        |   | Queue Sync Event |
  | Immediately      |   | (with timestamp) |
  +------------------+   +--------+---------+
                                  |
                                  v
                         +------------------+
                         | Check Network    |
                         +--------+---------+
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
           +------------------+       +------------------+
           | ONLINE           |       | OFFLINE          |
           +--------+---------+       +--------+---------+
                    |                          |
                    v                          v
           +------------------+       +------------------+
           | Process Queue    |       | Store in Queue   |
           | Send to Server   |       | Retry on Connect |
           +--------+---------+       +------------------+
                    |
                    v
           +------------------+
           | Conflict Check   |
           +--------+---------+
                    |
          +---------+---------+
          |                   |
          v                   v
  +------------------+  +------------------+
  | No Conflict      |  | Conflict Found   |
  | Apply Changes    |  +--------+---------+
  +------------------+           |
                                 v
                        +------------------+
                        | Resolution       |
                        | Strategy         |
                        +--------+---------+
                                 |
                    +------------+------------+
                    |            |            |
                    v            v            v
            [Last Write]  [Merge]     [User Choice]
                Wins
```

---

## 6. Technology Stack

### 6.1 Technology Selection Matrix

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Mobile Framework** | React Native + Expo | Cross-platform, native performance, large ecosystem |
| **State Management** | Zustand + persist middleware | Lightweight, TypeScript-first, built-in persistence |
| **Local Database** | expo-sqlite | Native SQLite, offline-first, complex queries |
| **UI Components** | React Native Paper + custom | Material Design, accessibility, theming |
| **Navigation** | React Navigation v6 | Standard, deep linking, type-safe |
| **Cloud Backend** | Supabase | PostgreSQL, real-time, auth, storage, free tier |
| **Image Processing** | ML Kit (OCR) + Vision API | On-device ML, receipt/label scanning |
| **Voice Control** | react-native-voice | Speech-to-text for hands-free |
| **Camera** | expo-camera + expo-barcode-scanner | Native camera, barcode scanning |
| **Notifications** | expo-notifications | Local + push, scheduling, actions |
| **Charts** | Victory Native | Performant, customizable analytics |
| **Testing** | Jest + React Native Testing Library | Unit + integration testing |

### 6.2 Architecture Decision Records (ADRs)

#### ADR-001: React Native over Flutter

**Status:** Accepted

**Context:** Need cross-platform mobile development with native performance.

**Decision:** Use React Native with Expo managed workflow.

**Rationale:**
- Larger ecosystem and community
- JavaScript/TypeScript familiar to team
- Expo simplifies build/deploy process
- Better support for native modules we need (camera, voice)

**Consequences:**
- (+) Faster development with Expo
- (+) Hot reloading for rapid iteration
- (-) Slightly larger bundle size than Flutter
- (-) May need to eject for advanced native features

---

#### ADR-002: SQLite for Local Storage

**Status:** Accepted

**Context:** Need robust offline storage with complex query capability.

**Decision:** Use SQLite via expo-sqlite for primary local storage.

**Rationale:**
- Complex queries (joins, aggregations) for analytics
- Proven reliability and performance
- Full offline capability
- Supports transactions for data integrity

**Consequences:**
- (+) Fast complex queries
- (+) ACID compliance
- (-) More setup than simple key-value stores
- (-) Need to manage migrations

---

#### ADR-003: Supabase for Backend

**Status:** Accepted

**Context:** Need cloud sync, authentication, and file storage.

**Decision:** Use Supabase as Backend-as-a-Service.

**Rationale:**
- PostgreSQL database (familiar SQL)
- Real-time subscriptions built-in
- Row-level security for data isolation
- Generous free tier for single-user
- Storage for images

**Consequences:**
- (+) Rapid backend setup
- (+) Real-time sync capability
- (+) Scales if multi-user future
- (-) Vendor dependency
- (-) Limited customization vs custom backend

---

#### ADR-004: Event-Driven Architecture for State

**Status:** Accepted

**Context:** Need real-time updates across components when state changes.

**Decision:** Implement event-driven architecture with Zustand stores and event emitter.

**Rationale:**
- Loose coupling between components
- Enables real-time pattern switching
- Supports undo/redo through event log
- Facilitates offline queue management

**Consequences:**
- (+) Decoupled components
- (+) Easy to add new features
- (-) More complex debugging
- (-) Need event tracing tools

---

## 7. API Specifications

### 7.1 Internal Service APIs

```typescript
// Pattern Engine API
interface PatternEngineAPI {
  // Pattern Selection
  getRecommendedPattern(context: DayContext): Promise<PatternRecommendation>;
  selectPattern(patternId: PatternType): Promise<DayPlan>;
  switchPattern(targetPattern: PatternType): Promise<TransitionPlan>;

  // Schedule Management
  getMealSchedule(patternId: PatternType, date: Date): Promise<MealSchedule>;
  adjustMealTime(mealId: string, newTime: Date): Promise<void>;

  // Analytics
  getPatternHistory(days: number): Promise<PatternUsageHistory>;
  getSuccessRate(patternId: PatternType): Promise<SuccessMetrics>;
}

// Inventory Manager API
interface InventoryAPI {
  // CRUD
  getInventory(filters?: InventoryFilters): Promise<InventoryItem[]>;
  addItem(item: NewInventoryItem): Promise<InventoryItem>;
  updateItem(id: string, updates: Partial<InventoryItem>): Promise<void>;
  removeItem(id: string, reason: string): Promise<void>;

  // Queries
  checkAvailability(ingredients: Ingredient[]): Promise<AvailabilityReport>;
  getExpiringItems(withinHours: number): Promise<InventoryItem[]>;
  getLowStockItems(): Promise<InventoryItem[]>;

  // Operations
  reconcileAfterMeal(mealLog: MealLog): Promise<void>;
  suggestSubstitutes(ingredient: Ingredient): Promise<Substitute[]>;
}

// Prep Orchestrator API
interface PrepOrchestratorAPI {
  // Planning
  generatePrepPlan(weekPlan: WeekPlan): Promise<PrepPlan>;
  optimizeSchedule(tasks: PrepTask[]): Promise<OptimizedSchedule>;

  // Session Management
  startSession(planId: string): Promise<PrepSession>;
  completeTask(sessionId: string, taskId: string): Promise<void>;
  pauseSession(sessionId: string): Promise<void>;
  resumeSession(sessionId: string): Promise<void>;

  // Timers
  setTimer(label: string, duration: number): Promise<Timer>;
  getActiveTimers(): Promise<Timer[]>;
}

// Meal Logger API
interface MealLoggerAPI {
  // Logging
  logMeal(log: NewMealLog): Promise<MealLog>;
  updateLog(id: string, updates: Partial<MealLog>): Promise<void>;
  addPhoto(logId: string, photo: ImageAsset): Promise<void>;

  // Queries
  getMealHistory(dateRange: DateRange): Promise<MealLog[]>;
  getNutritionSummary(date: Date): Promise<NutritionSummary>;
  getWeeklySummary(weekStart: Date): Promise<WeeklySummary>;
}
```

### 7.2 External Integration APIs

```typescript
// Cloud Sync API
interface SyncAPI {
  // Sync Operations
  pushChanges(changes: SyncChange[]): Promise<SyncResult>;
  pullChanges(since: Date): Promise<SyncChange[]>;
  resolveConflict(conflict: Conflict, resolution: Resolution): Promise<void>;

  // Status
  getSyncStatus(): Promise<SyncStatus>;
  getLastSyncTime(): Promise<Date>;
}

// Health Integration API
interface HealthIntegrationAPI {
  // Apple Health / Google Fit
  syncWeight(): Promise<void>;
  syncNutrition(log: MealLog): Promise<void>;
  syncWater(amount: number): Promise<void>;
  getActivityLevel(): Promise<ActivityData>;
}
```

---

## 8. User Interface Architecture

### 8.1 Screen Hierarchy

```
+------------------------------------------------------------------+
|                      UI SCREEN HIERARCHY                          |
+------------------------------------------------------------------+

                        [App Root]
                            |
            +---------------+---------------+
            |               |               |
        [Auth Flow]    [Main App]     [Onboarding]
            |               |
            |       +-------+-------+
            |       |               |
        [Login]  [Tab Navigator]  [Settings]
                    |
    +-------+-------+-------+-------+
    |       |       |       |       |
  [Home]  [Plan]  [Prep]  [Shop] [Track]
    |       |       |       |       |
    |       |       |       |       +-- Meal Log
    |       |       |       |       +-- Nutrition
    |       |       |       |       +-- Progress
    |       |       |       |       +-- Analytics
    |       |       |       |
    |       |       |       +-- Shopping List
    |       |       |       +-- Store Mode
    |       |       |       +-- Deal Scanner
    |       |       |       +-- Price History
    |       |       |
    |       |       +-- Week Prep
    |       |       +-- Prep Session
    |       |       +-- Timer Dashboard
    |       |       +-- Equipment Status
    |       |
    |       +-- Week Overview
    |       +-- Day Detail
    |       +-- Meal Detail
    |       +-- Component Picker
    |
    +-- Today Dashboard
    +-- Pattern Selector
    +-- Quick Actions
    +-- Inventory Status
```

### 8.2 Key Screen Wireframes

#### Home Dashboard
```
+----------------------------------+
|  [=]  Today - Traditional    [!] |
+----------------------------------+
|                                  |
|  +----------------------------+  |
|  | NEXT MEAL: Lunch (12:30)  |  |
|  | Mexican Power Bowl        |  |
|  | 850 cal | 60g protein     |  |
|  |                           |  |
|  | [View Details] [Swap]     |  |
|  +----------------------------+  |
|                                  |
|  Today's Progress               |
|  +----------------------------+  |
|  | Calories: 400/1800  [====]|  |
|  | Protein:  35/135g   [===] |  |
|  | Water:    32/125oz  [==]  |  |
|  +----------------------------+  |
|                                  |
|  Quick Actions                  |
|  +--------+ +--------+ +------+ |
|  |  Log   | | Switch | | Prep | |
|  |  Meal  | | Pattern| | Mode | |
|  +--------+ +--------+ +------+ |
|                                  |
|  Inventory Alerts               |
|  +----------------------------+  |
|  | ! Chicken expires tomorrow |  |
|  | ! Low on rice (2 servings) |  |
|  +----------------------------+  |
|                                  |
+----------------------------------+
|  [Home] [Plan] [Prep] [Shop] [+] |
+----------------------------------+
```

#### Pattern Selector
```
+----------------------------------+
|  [<]  Select Pattern         [?] |
+----------------------------------+
|                                  |
|  Recommended for Today:         |
|  +----------------------------+  |
|  | * TRADITIONAL             |  |
|  |   Best fit: 87%           |  |
|  |   Regular schedule, office|  |
|  +----------------------------+  |
|                                  |
|  Other Options:                 |
|  +----------------------------+  |
|  |   IF NOON START           |  |
|  |   Best fit: 72%           |  |
|  |   Not hungry mornings     |  |
|  +----------------------------+  |
|  +----------------------------+  |
|  |   GRAZING MINI            |  |
|  |   Best fit: 65%           |  |
|  |   Steady energy needs     |  |
|  +----------------------------+  |
|  +----------------------------+  |
|  |   BIG BREAKFAST           |  |
|  |   Best fit: 45%           |  |
|  |   Morning workouts        |  |
|  +----------------------------+  |
|                                  |
|  [View All 7 Patterns]          |
|                                  |
+----------------------------------+
```

---

## 9. Scalability Considerations

### 9.1 Current Single-User Design

The initial architecture targets a single user (Brandon) with focus on:
- Local-first data storage
- Minimal cloud dependencies
- Simple sync model

### 9.2 Multi-User Evolution Path

```
+------------------------------------------------------------------+
|                    SCALABILITY EVOLUTION                          |
+------------------------------------------------------------------+

Phase 1: Single User (Current)
+----------------------------------+
| - Local SQLite                   |
| - Optional cloud backup          |
| - Single device primary          |
+----------------------------------+
                |
                v
Phase 2: Multi-Device Sync
+----------------------------------+
| - Real-time Supabase sync        |
| - Conflict resolution            |
| - Cross-device notifications     |
+----------------------------------+
                |
                v
Phase 3: Household Sharing
+----------------------------------+
| - Shared meal plans              |
| - Individual preferences         |
| - Inventory collaboration        |
| - Role-based access              |
+----------------------------------+
                |
                v
Phase 4: Public Platform
+----------------------------------+
| - Multi-tenant architecture      |
| - Recipe/template marketplace    |
| - Community features             |
| - Premium subscriptions          |
+----------------------------------+
```

### 9.3 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| App launch | < 2 seconds | Cold start to interactive |
| Pattern switch | < 300ms | UI response time |
| Meal logging | < 100ms | Tap to confirmed |
| Complex queries | < 500ms | Analytics calculations |
| Image capture | < 1 second | Photo to preview |
| Sync operation | < 5 seconds | Full sync cycle |
| Offline startup | < 1 second | No network available |

---

## 10. Security Architecture

### 10.1 Data Protection

```typescript
interface SecurityArchitecture {
  localStorage: {
    encryption: 'SQLCipher for SQLite',
    keyStorage: 'Secure Enclave / Keystore',
    biometricLock: 'optional'
  };

  cloudSync: {
    transport: 'TLS 1.3',
    authentication: 'Supabase Auth (JWT)',
    authorization: 'Row Level Security (RLS)'
  };

  sensitiveData: {
    healthData: 'encrypted at rest',
    photos: 'encrypted in transit',
    credentials: 'never stored locally'
  };
}
```

### 10.2 Privacy Considerations

- All meal/nutrition data stays on device by default
- Cloud sync is opt-in
- No analytics tracking without consent
- Export all data capability (GDPR compliance ready)
- Delete account removes all cloud data

---

## 11. Integration Points

### 11.1 Current Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| Apple Health | Weight, nutrition sync | Planned |
| Google Fit | Weight, nutrition sync | Planned |
| Calendar | Event-aware meal planning | Planned |
| Camera | Photo capture, OCR | Core feature |
| Notifications | Meal/prep reminders | Core feature |

### 11.2 Future Integration Opportunities

| Integration | Value | Complexity |
|-------------|-------|------------|
| Grocery Store APIs | Automatic price tracking | High |
| Smart Scale | Auto weight logging | Medium |
| Smart Fridge | Inventory automation | High |
| Meal Delivery | Backup meal options | Medium |
| Recipe Websites | Import recipes | Medium |

---

## 12. Deployment Architecture

### 12.1 Build & Release Pipeline

```
+------------------------------------------------------------------+
|                    CI/CD PIPELINE                                 |
+------------------------------------------------------------------+

  [Git Push]
      |
      v
  +------------------+
  | GitHub Actions   |
  | - Lint           |
  | - Type Check     |
  | - Unit Tests     |
  +--------+---------+
           |
           v
  +------------------+     +------------------+
  | Build            |     | Integration      |
  | - iOS            |     | Tests            |
  | - Android        |     | (Detox)          |
  +--------+---------+     +------------------+
           |
           v
  +------------------+
  | EAS Build        |
  | (Expo)           |
  +--------+---------+
           |
     +-----+-----+
     |           |
     v           v
  [TestFlight] [Internal
               Testing]
     |           |
     +-----+-----+
           |
           v
  +------------------+
  | App Store /      |
  | Play Store       |
  +------------------+
```

### 12.2 Environment Configuration

| Environment | Purpose | Backend |
|-------------|---------|---------|
| Development | Local development | Local Supabase |
| Staging | Pre-release testing | Staging Supabase |
| Production | Live app | Production Supabase |

---

## 13. Monitoring & Observability

### 13.1 Application Monitoring

```typescript
interface MonitoringStrategy {
  errorTracking: {
    service: 'Sentry',
    captureScope: ['crashes', 'exceptions', 'unhandledRejections'],
    userContext: 'anonymized'
  };

  analytics: {
    service: 'optional (privacy-first)',
    events: ['pattern_selected', 'meal_logged', 'prep_completed'],
    noPersonalData: true
  };

  performance: {
    appStartup: true,
    screenLoadTimes: true,
    apiLatency: true,
    offlineUsage: true
  };
}
```

### 13.2 Health Metrics

| Metric | Alert Threshold |
|--------|-----------------|
| Crash-free rate | < 99.5% |
| API error rate | > 1% |
| Sync failure rate | > 5% |
| App not responding | > 0.5% |

---

## 14. Architecture Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Expo limitations require ejecting | High | Medium | Design for eject-ability, minimize native dependencies |
| SQLite corruption | High | Low | Regular backups, transaction safety, recovery procedures |
| Supabase vendor lock-in | Medium | Medium | Abstract backend layer, standard SQL |
| Offline sync conflicts | Medium | High | Clear conflict resolution rules, user notification |
| Performance on older devices | Medium | Medium | Performance budgets, lazy loading, profiling |

---

## 15. Appendices

### A. Glossary

| Term | Definition |
|------|------------|
| Pattern | One of 7 meal timing/structure approaches |
| Component | Individual food item with nutritional data |
| Prep Session | Scheduled batch cooking/preparation time |
| Meal Log | Record of actual meal consumption |
| Sync Queue | Local queue of changes pending cloud sync |

### B. Related Documents

- PRD VERSION 6.md - Product requirements
- SUPPLEMENT 2 - User stories and workflows
- SUPPLEMENT 3 - Equipment management
- THE COMPLETE FLEXIBLE EATING SYSTEM - Domain knowledge

### C. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Nov 2025 | System Architect | Initial architecture |

---

*This architecture document serves as the technical foundation for the Meal Assistant application. All implementation decisions should align with the patterns and principles defined herein.*
