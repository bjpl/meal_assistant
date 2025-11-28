export { TutorialOverlay, type TutorialStepData } from './TutorialOverlay';
export { FeatureSpotlight } from './FeatureSpotlight';
export { TutorialStep } from './TutorialStep';

// Tutorial content definitions
export const TUTORIALS = {
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard Tour',
    feature: 'dashboard',
    steps: [
      {
        id: 'dashboard-1',
        title: 'Welcome to Your Dashboard',
        description: 'This is your home base. See your daily progress, current pattern, and quick actions all in one place.',
        position: 'center' as const,
      },
      {
        id: 'dashboard-2',
        title: 'Pattern Selection',
        description: 'Tap here to view all 7 eating patterns or switch your pattern for today. The app will recalculate your remaining meals.',
        position: 'top' as const,
      },
      {
        id: 'dashboard-3',
        title: 'Quick Actions',
        description: 'Use these buttons to quickly log a meal, check your inventory, or view your shopping list.',
        position: 'bottom' as const,
      },
    ],
  },
  mealLogging: {
    id: 'mealLogging',
    name: 'Meal Logging',
    feature: 'tracking',
    steps: [
      {
        id: 'meal-1',
        title: 'Log Your Meals',
        description: 'Tap the camera icon to snap a photo of your meal. This helps you track what you eat and see patterns over time.',
        position: 'center' as const,
      },
      {
        id: 'meal-2',
        title: 'Rate Your Experience',
        description: 'After eating, rate your satisfaction and energy level. This data helps identify which patterns work best for you.',
        position: 'bottom' as const,
      },
      {
        id: 'meal-3',
        title: 'Make Substitutions',
        description: 'If you made changes to the planned meal, log the substitutions to keep your nutrition tracking accurate.',
        position: 'bottom' as const,
      },
    ],
  },
  inventory: {
    id: 'inventory',
    name: 'Inventory Management',
    feature: 'inventory',
    steps: [
      {
        id: 'inventory-1',
        title: 'Track Your Inventory',
        description: 'Keep track of what is in your fridge, freezer, and pantry. The app will warn you about expiring items.',
        position: 'center' as const,
      },
      {
        id: 'inventory-2',
        title: 'Barcode Scanning',
        description: 'Tap the barcode icon to quickly add items. Just scan the product and we will fill in the details.',
        position: 'top' as const,
      },
      {
        id: 'inventory-3',
        title: 'Expiry Tracking',
        description: 'Items turning yellow are expiring soon. Use them first to reduce food waste!',
        position: 'center' as const,
      },
    ],
  },
  shopping: {
    id: 'shopping',
    name: 'Smart Shopping',
    feature: 'shopping',
    steps: [
      {
        id: 'shopping-1',
        title: 'Your Shopping List',
        description: 'Your list is automatically generated based on your meal plan. Items are grouped by store section.',
        position: 'center' as const,
      },
      {
        id: 'shopping-2',
        title: 'Upload Store Ads',
        description: 'Take a photo of store flyers to find deals. We will match sales to items on your list.',
        position: 'top' as const,
      },
      {
        id: 'shopping-3',
        title: 'Multi-Store Optimization',
        description: 'The app can split your list across stores to maximize savings. You decide if the extra stops are worth it.',
        position: 'bottom' as const,
      },
    ],
  },
  analytics: {
    id: 'analytics',
    name: 'Progress Analytics',
    feature: 'analytics',
    steps: [
      {
        id: 'analytics-1',
        title: 'Track Your Progress',
        description: 'View your weight trends, adherence rates, and pattern effectiveness over time.',
        position: 'center' as const,
      },
      {
        id: 'analytics-2',
        title: 'Pattern Insights',
        description: 'See which eating patterns give you the best energy and satisfaction. Use this data to optimize your schedule.',
        position: 'bottom' as const,
      },
      {
        id: 'analytics-3',
        title: 'Weekly Reports',
        description: 'Get a summary of your week including calories consumed, protein intake, and spending on groceries.',
        position: 'bottom' as const,
      },
    ],
  },
};
