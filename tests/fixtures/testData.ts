/**
 * Test Fixtures
 * Reusable test data for all test suites
 */

// Pattern fixtures
export const PATTERNS = {
  traditional: {
    id: 'traditional',
    name: 'Traditional',
    description: '3 balanced meals per day',
    meals: 3,
    targetCalories: 2000,
    targetProtein: 130,
    mealTimes: ['08:00', '12:30', '18:30'],
    successRate: 0.85
  },
  if16_8: {
    id: 'if-16-8',
    name: 'Intermittent Fasting 16:8',
    description: '16 hour fast, 8 hour eating window',
    meals: 2,
    targetCalories: 1800,
    targetProtein: 130,
    mealTimes: ['12:00', '19:00'],
    restrictions: ['no-breakfast'],
    successRate: 0.72
  },
  grazing: {
    id: 'grazing',
    name: 'Grazing',
    description: '5-6 small meals throughout day',
    meals: 5,
    targetCalories: 2000,
    targetProtein: 130,
    mealTimes: ['08:00', '10:30', '13:00', '15:30', '18:00'],
    successRate: 0.68
  },
  keto: {
    id: 'keto',
    name: 'Keto Pattern',
    description: 'High fat, very low carb',
    meals: 3,
    targetCalories: 1800,
    targetProtein: 100,
    mealTimes: ['08:00', '13:00', '18:00'],
    restrictions: ['low-carb', 'high-fat'],
    successRate: 0.62
  },
  omad: {
    id: 'omad',
    name: 'One Meal A Day',
    description: 'Single large meal',
    meals: 1,
    targetCalories: 1800,
    targetProtein: 130,
    mealTimes: ['18:00'],
    restrictions: ['fasting-required'],
    successRate: 0.55
  },
  workout: {
    id: 'workout',
    name: 'Workout Day',
    description: 'Higher calories for training',
    meals: 4,
    targetCalories: 2200,
    targetProtein: 150,
    mealTimes: ['07:00', '11:00', '15:00', '19:00'],
    successRate: 0.78
  },
  light: {
    id: 'light',
    name: 'Light Day',
    description: 'Lower calorie recovery day',
    meals: 3,
    targetCalories: 1600,
    targetProtein: 120,
    mealTimes: ['09:00', '13:00', '18:00'],
    successRate: 0.80
  }
};

// Inventory fixtures
export const INVENTORY_ITEMS = {
  chickenBreast: {
    id: 'inv-chicken-001',
    name: 'Chicken Breast',
    quantity: 2,
    unit: 'lbs',
    expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'fridge',
    category: 'protein',
    costPerUnit: 4.99
  },
  rice: {
    id: 'inv-rice-001',
    name: 'Brown Rice',
    quantity: 5,
    unit: 'cups',
    expiryDate: null,
    location: 'pantry',
    category: 'grains',
    costPerUnit: 0.50
  },
  blackBeans: {
    id: 'inv-beans-001',
    name: 'Black Beans',
    quantity: 4,
    unit: 'cans',
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'pantry',
    category: 'protein',
    costPerUnit: 1.29
  },
  eggs: {
    id: 'inv-eggs-001',
    name: 'Eggs',
    quantity: 12,
    unit: 'count',
    expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'fridge',
    category: 'protein',
    costPerUnit: 0.25
  },
  vegetables: {
    id: 'inv-veggies-001',
    name: 'Mixed Vegetables',
    quantity: 2,
    unit: 'lbs',
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'fridge',
    category: 'produce',
    costPerUnit: 2.00
  },
  expiringItem: {
    id: 'inv-expiring-001',
    name: 'Fresh Fish',
    quantity: 1,
    unit: 'lbs',
    expiryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'fridge',
    category: 'protein',
    costPerUnit: 12.99
  },
  expiredItem: {
    id: 'inv-expired-001',
    name: 'Old Yogurt',
    quantity: 2,
    unit: 'cups',
    expiryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'fridge',
    category: 'dairy',
    costPerUnit: 1.50
  }
};

// Meal fixtures
export const MEALS = {
  mexicanBowl: {
    id: 'meal-mexican-001',
    name: 'Mexican Bowl',
    calories: 650,
    protein: 45,
    carbs: 65,
    fat: 22,
    pattern: 'traditional',
    ingredients: [
      { id: 'inv-chicken-001', name: 'Chicken Breast', quantity: 0.5, unit: 'lbs' },
      { id: 'inv-rice-001', name: 'Brown Rice', quantity: 1, unit: 'cup' },
      { id: 'inv-beans-001', name: 'Black Beans', quantity: 0.5, unit: 'can' }
    ]
  },
  proteinShake: {
    id: 'meal-shake-001',
    name: 'Protein Shake',
    calories: 200,
    protein: 35,
    carbs: 8,
    fat: 3,
    pattern: 'workout',
    ingredients: []
  },
  eggsBreakfast: {
    id: 'meal-eggs-001',
    name: 'Eggs and Toast',
    calories: 450,
    protein: 28,
    carbs: 35,
    fat: 22,
    pattern: 'traditional',
    ingredients: [
      { id: 'inv-eggs-001', name: 'Eggs', quantity: 3, unit: 'count' }
    ]
  },
  largeDinner: {
    id: 'meal-dinner-001',
    name: 'Large IF Dinner',
    calories: 1100,
    protein: 70,
    carbs: 85,
    fat: 45,
    pattern: 'if-16-8',
    ingredients: [
      { id: 'inv-chicken-001', name: 'Chicken Breast', quantity: 0.75, unit: 'lbs' },
      { id: 'inv-rice-001', name: 'Brown Rice', quantity: 1.5, unit: 'cup' },
      { id: 'inv-veggies-001', name: 'Mixed Vegetables', quantity: 0.5, unit: 'lbs' }
    ]
  }
};

// Equipment fixtures
export const EQUIPMENT = {
  oven: {
    id: 'equip-oven-001',
    name: 'Oven',
    type: 'appliance',
    status: 'clean',
    capacity: '5 cu ft',
    quantity: 1
  },
  stovetop: {
    id: 'equip-stovetop-001',
    name: 'Stovetop',
    type: 'appliance',
    status: 'clean',
    quantity: 4
  },
  potLarge: {
    id: 'equip-pot-large-001',
    name: 'Large Pot (8qt)',
    type: 'cookware',
    status: 'clean',
    capacity: '8qt',
    quantity: 1
  },
  potMedium: {
    id: 'equip-pot-medium-001',
    name: 'Medium Pot (4qt)',
    type: 'cookware',
    status: 'clean',
    capacity: '4qt',
    quantity: 2
  },
  sheetPan: {
    id: 'equip-sheet-pan-001',
    name: 'Sheet Pan',
    type: 'cookware',
    status: 'clean',
    quantity: 3
  },
  cuttingBoard: {
    id: 'equip-cutting-board-001',
    name: 'Cutting Board',
    type: 'tool',
    status: 'clean',
    quantity: 2
  },
  riceCooker: {
    id: 'equip-rice-cooker-001',
    name: 'Rice Cooker',
    type: 'appliance',
    status: 'clean',
    capacity: '10 cups',
    quantity: 1
  }
};

// Recipe/Prep Task fixtures
export const PREP_TASKS = {
  mexicanBowlTasks: [
    { id: 'mb-rice', name: 'Cook Rice', duration: 30, equipment: ['pot-medium', 'stovetop'], dependencies: [], canParallel: true, cleaningTime: 2 },
    { id: 'mb-beans', name: 'Heat Beans', duration: 15, equipment: ['pot-small', 'stovetop'], dependencies: [], canParallel: true, cleaningTime: 2 },
    { id: 'mb-onions', name: 'Caramelize Onions', duration: 45, equipment: ['pan', 'stovetop'], dependencies: [], canParallel: true, cleaningTime: 3 },
    { id: 'mb-chop', name: 'Chop Vegetables', duration: 10, equipment: ['cutting-board', 'knife'], dependencies: [], canParallel: true, cleaningTime: 1 },
    { id: 'mb-assemble', name: 'Assemble Bowls', duration: 5, equipment: ['bowls'], dependencies: ['mb-rice', 'mb-beans', 'mb-onions', 'mb-chop'], canParallel: false, cleaningTime: 0 }
  ],
  roastedVegetablesTasks: [
    { id: 'rv-preheat', name: 'Preheat Oven', duration: 10, equipment: ['oven'], dependencies: [], canParallel: true, cleaningTime: 0 },
    { id: 'rv-prep', name: 'Prep Vegetables', duration: 15, equipment: ['cutting-board', 'knife'], dependencies: [], canParallel: true, cleaningTime: 1 },
    { id: 'rv-season', name: 'Season & Toss', duration: 5, equipment: ['mixing-bowl'], dependencies: ['rv-prep'], canParallel: false, cleaningTime: 1 },
    { id: 'rv-roast', name: 'Roast in Oven', duration: 30, equipment: ['oven', 'sheet-pan'], dependencies: ['rv-preheat', 'rv-season'], canParallel: true, cleaningTime: 3 }
  ]
};

// User profile fixture
export const USER_PROFILE = {
  id: 'user-brandon',
  name: 'Brandon',
  bodyWeight: 250,
  targetWeight: 200,
  height: 72, // inches
  age: 35,
  activityLevel: 'moderate',
  targetCalories: 2000,
  targetProtein: 130,
  hydrationTarget: 125, // oz (250 / 2)
  caffeineLimit: 400
};

// Store data fixtures
export const STORES = {
  costco: {
    id: 'store-costco',
    name: 'Costco',
    type: 'wholesale',
    frequency: 'monthly',
    strengths: ['bulk rice', 'proteins', 'cheese']
  },
  safeway: {
    id: 'store-safeway',
    name: 'Safeway',
    type: 'traditional',
    frequency: 'weekly',
    strengths: ['weekly deals', 'variety']
  },
  walmart: {
    id: 'store-walmart',
    name: 'Walmart',
    type: 'discount',
    frequency: 'biweekly',
    strengths: ['lowest prices']
  },
  wholefoods: {
    id: 'store-wholefoods',
    name: 'Whole Foods',
    type: 'premium',
    frequency: 'weekly',
    strengths: ['organic', 'prepared foods']
  }
};

// Nutrition reference data
export const NUTRITION_REFERENCE = {
  dailyTargets: {
    calories: { min: 1200, target: 2000, max: 2500 },
    protein: { min: 100, target: 130, max: 180 },
    carbs: { min: 100, target: 250, max: 350 },
    fat: { min: 40, target: 65, max: 100 }
  },
  macroCalories: {
    protein: 4, // cal per gram
    carbs: 4,
    fat: 9
  },
  hydration: {
    minimum: 64, // oz
    formula: (weightLbs: number) => Math.round(weightLbs / 2),
    caffeineLimit: 400,
    caffeineWarning: 300
  }
};

// Test scenarios
export const TEST_SCENARIOS = {
  normalDay: {
    pattern: 'traditional',
    meals: [
      { ...MEALS.eggsBreakfast, time: '08:00' },
      { calories: 600, protein: 40, carbs: 50, fat: 25, time: '12:30' },
      { ...MEALS.mexicanBowl, time: '18:30' }
    ],
    expectedCalories: 1700,
    expectedProtein: 113
  },
  ifDay: {
    pattern: 'if-16-8',
    meals: [
      { calories: 800, protein: 55, carbs: 60, fat: 35, time: '12:00' },
      { ...MEALS.largeDinner, time: '19:00' }
    ],
    expectedCalories: 1900,
    expectedProtein: 125
  },
  patternSwitch: {
    initialPattern: 'traditional',
    switchTime: '10:00',
    newPattern: 'if-16-8',
    preSwitchMeals: [{ ...MEALS.eggsBreakfast }],
    expectedRemainingMeals: 2
  }
};

export default {
  PATTERNS,
  INVENTORY_ITEMS,
  MEALS,
  EQUIPMENT,
  PREP_TASKS,
  USER_PROFILE,
  STORES,
  NUTRITION_REFERENCE,
  TEST_SCENARIOS
};
