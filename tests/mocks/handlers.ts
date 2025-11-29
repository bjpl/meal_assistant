import { http, HttpResponse } from 'msw';

// Mock data generators
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockTokens = {
  accessToken: 'mock-access-token-abc123',
  refreshToken: 'mock-refresh-token-xyz789',
  expiresIn: 3600,
};

const mockPatterns = [
  {
    id: 'pattern-1',
    code: 'BALANCED',
    name: 'Balanced Diet',
    description: 'A balanced approach to nutrition',
    nutritionGoals: {
      calories: 2000,
      protein: 150,
      carbs: 250,
      fat: 65,
    },
    preferences: {
      mealFrequency: 3,
      snackAllowed: true,
      preferredMealTimes: ['08:00', '13:00', '19:00'],
    },
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'pattern-2',
    code: 'LOWCARB',
    name: 'Low Carb',
    description: 'Reduced carbohydrate intake',
    nutritionGoals: {
      calories: 1800,
      protein: 140,
      carbs: 100,
      fat: 90,
    },
    preferences: {
      mealFrequency: 3,
      snackAllowed: false,
      preferredMealTimes: ['07:00', '12:00', '18:00'],
    },
    isActive: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

const mockMeals = [
  {
    id: 'meal-1',
    name: 'Grilled Chicken Salad',
    type: 'lunch',
    date: new Date().toISOString().split('T')[0],
    time: '13:00',
    nutrition: {
      calories: 450,
      protein: 35,
      carbs: 25,
      fat: 20,
    },
    ingredients: [
      { name: 'Chicken Breast', amount: '150g' },
      { name: 'Mixed Greens', amount: '100g' },
      { name: 'Olive Oil', amount: '10ml' },
    ],
    isLogged: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'meal-2',
    name: 'Oatmeal with Berries',
    type: 'breakfast',
    date: new Date().toISOString().split('T')[0],
    time: '08:00',
    nutrition: {
      calories: 320,
      protein: 12,
      carbs: 55,
      fat: 8,
    },
    ingredients: [
      { name: 'Oats', amount: '50g' },
      { name: 'Blueberries', amount: '100g' },
      { name: 'Milk', amount: '200ml' },
    ],
    isLogged: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockInventoryItems = [
  {
    id: 'item-1',
    name: 'Chicken Breast',
    quantity: 500,
    unit: 'g',
    category: 'protein',
    expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    purchaseDate: new Date().toISOString(),
    barcode: '123456789',
    location: 'refrigerator',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item-2',
    name: 'Oats',
    quantity: 1000,
    unit: 'g',
    category: 'grains',
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    purchaseDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    barcode: '987654321',
    location: 'pantry',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item-3',
    name: 'Milk',
    quantity: 1,
    unit: 'L',
    category: 'dairy',
    expirationDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    purchaseDate: new Date().toISOString(),
    barcode: '555666777',
    location: 'refrigerator',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockHydrationLogs = [
  {
    id: 'hydration-1',
    amount: 250,
    unit: 'ml',
    timestamp: new Date().toISOString(),
    type: 'water',
  },
  {
    id: 'hydration-2',
    amount: 500,
    unit: 'ml',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    type: 'water',
  },
];

const mockCaffeineLogs = [
  {
    id: 'caffeine-1',
    amount: 95,
    unit: 'mg',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    source: 'coffee',
  },
];

const mockShoppingLists = [
  {
    id: 'list-1',
    name: 'Weekly Groceries',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'list-item-1',
        name: 'Chicken Breast',
        quantity: 1000,
        unit: 'g',
        category: 'protein',
        checked: false,
        notes: 'Organic preferred',
      },
      {
        id: 'list-item-2',
        name: 'Brown Rice',
        quantity: 500,
        unit: 'g',
        category: 'grains',
        checked: true,
        notes: '',
      },
    ],
  },
];

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

export const handlers = [
  // Auth endpoints
  http.post(`${BASE_URL}/auth/register`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string; name?: string };

    if (!body.email || !body.password) {
      return HttpResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (body.email === 'existing@example.com') {
      return HttpResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    return HttpResponse.json({
      user: { ...mockUser, email: body.email, name: body.name || 'Test User' },
      ...mockTokens,
    }, { status: 201 });
  }),

  http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };

    if (!body.email || !body.password) {
      return HttpResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (body.email === 'wrong@example.com' || body.password === 'wrongpassword') {
      return HttpResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      user: mockUser,
      ...mockTokens,
    });
  }),

  http.post(`${BASE_URL}/auth/logout`, () => {
    return HttpResponse.json({ message: 'Logged out successfully' });
  }),

  http.get(`${BASE_URL}/auth/me`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return HttpResponse.json({ user: mockUser });
  }),

  http.post(`${BASE_URL}/auth/password`, async ({ request }) => {
    const body = await request.json() as { currentPassword: string; newPassword: string };

    if (body.currentPassword === 'wrongpassword') {
      return HttpResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    return HttpResponse.json({ message: 'Password updated successfully' });
  }),

  http.post(`${BASE_URL}/auth/refresh`, async ({ request }) => {
    const body = await request.json() as { refreshToken: string };

    if (!body.refreshToken || body.refreshToken === 'invalid-token') {
      return HttpResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      accessToken: 'new-mock-access-token',
      expiresIn: 3600,
    });
  }),

  // Pattern endpoints
  http.get(`${BASE_URL}/patterns`, () => {
    return HttpResponse.json({ patterns: mockPatterns });
  }),

  http.get(`${BASE_URL}/patterns/:patternCode`, ({ params }) => {
    const pattern = mockPatterns.find(p => p.code === params.patternCode);

    if (!pattern) {
      return HttpResponse.json(
        { error: 'Pattern not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ pattern });
  }),

  http.get(`${BASE_URL}/patterns/preferences`, () => {
    return HttpResponse.json({
      preferences: mockPatterns[0].preferences,
    });
  }),

  http.put(`${BASE_URL}/patterns/preferences`, async ({ request }) => {
    const body = await request.json();

    return HttpResponse.json({
      preferences: { ...mockPatterns[0].preferences, ...body },
    });
  }),

  http.get(`${BASE_URL}/patterns/preferences/default`, () => {
    return HttpResponse.json({
      preferences: {
        mealFrequency: 3,
        snackAllowed: true,
        preferredMealTimes: ['08:00', '13:00', '19:00'],
        dietaryRestrictions: [],
      },
    });
  }),

  http.get(`${BASE_URL}/patterns/daily`, () => {
    const today = new Date().toISOString().split('T')[0];
    return HttpResponse.json({
      pattern: mockPatterns[0],
      date: today,
      meals: mockMeals,
      nutritionSummary: {
        calories: 770,
        protein: 47,
        carbs: 80,
        fat: 28,
      },
    });
  }),

  http.post(`${BASE_URL}/patterns/daily/:date/rating`, async ({ params, request }) => {
    const body = await request.json() as { rating: number; notes?: string };

    if (body.rating < 1 || body.rating > 5) {
      return HttpResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      date: params.date,
      rating: body.rating,
      notes: body.notes,
    });
  }),

  http.get(`${BASE_URL}/patterns/history`, ({ request }) => {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '7', 10);

    const history = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        date: date.toISOString().split('T')[0],
        pattern: mockPatterns[0],
        adherence: Math.floor(Math.random() * 30) + 70,
        rating: Math.floor(Math.random() * 2) + 4,
      };
    });

    return HttpResponse.json({ history });
  }),

  http.get(`${BASE_URL}/patterns/statistics`, ({ request }) => {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'week';

    return HttpResponse.json({
      period,
      averageAdherence: 85,
      averageRating: 4.2,
      totalMeals: 21,
      nutritionAverages: {
        calories: 1950,
        protein: 145,
        carbs: 230,
        fat: 68,
      },
    });
  }),

  // Meal endpoints
  http.get(`${BASE_URL}/meals/today`, () => {
    return HttpResponse.json({
      meals: mockMeals,
      date: new Date().toISOString().split('T')[0],
    });
  }),

  http.get(`${BASE_URL}/meals`, ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    return HttpResponse.json({
      meals: mockMeals,
      startDate,
      endDate,
    });
  }),

  http.post(`${BASE_URL}/meals`, async ({ request }) => {
    const body = await request.json() as any;

    const newMeal = {
      id: `meal-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ meal: newMeal }, { status: 201 });
  }),

  http.get(`${BASE_URL}/meals/:mealId`, ({ params }) => {
    const meal = mockMeals.find(m => m.id === params.mealId);

    if (!meal) {
      return HttpResponse.json(
        { error: 'Meal not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ meal });
  }),

  http.put(`${BASE_URL}/meals/:mealId`, async ({ params, request }) => {
    const body = await request.json() as any;
    const meal = mockMeals.find(m => m.id === params.mealId);

    if (!meal) {
      return HttpResponse.json(
        { error: 'Meal not found' },
        { status: 404 }
      );
    }

    const updatedMeal = {
      ...meal,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ meal: updatedMeal });
  }),

  http.delete(`${BASE_URL}/meals/:mealId`, ({ params }) => {
    const meal = mockMeals.find(m => m.id === params.mealId);

    if (!meal) {
      return HttpResponse.json(
        { error: 'Meal not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ message: 'Meal deleted successfully' });
  }),

  // Inventory endpoints
  http.get(`${BASE_URL}/inventory`, ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    let items = mockInventoryItems;
    if (category) {
      items = items.filter(item => item.category === category);
    }

    return HttpResponse.json({ items });
  }),

  http.post(`${BASE_URL}/inventory`, async ({ request }) => {
    const body = await request.json() as any;

    const newItem = {
      id: `item-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ item: newItem }, { status: 201 });
  }),

  http.get(`${BASE_URL}/inventory/:itemId`, ({ params }) => {
    const item = mockInventoryItems.find(i => i.id === params.itemId);

    if (!item) {
      return HttpResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ item });
  }),

  http.put(`${BASE_URL}/inventory/:itemId`, async ({ params, request }) => {
    const body = await request.json() as any;
    const item = mockInventoryItems.find(i => i.id === params.itemId);

    if (!item) {
      return HttpResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    const updatedItem = {
      ...item,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ item: updatedItem });
  }),

  http.delete(`${BASE_URL}/inventory/:itemId`, ({ params }) => {
    const item = mockInventoryItems.find(i => i.id === params.itemId);

    if (!item) {
      return HttpResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ message: 'Item deleted successfully' });
  }),

  http.post(`${BASE_URL}/inventory/:itemId/consume`, async ({ params, request }) => {
    const body = await request.json() as { amount: number };
    const item = mockInventoryItems.find(i => i.id === params.itemId);

    if (!item) {
      return HttpResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    if (body.amount > item.quantity) {
      return HttpResponse.json(
        { error: 'Insufficient quantity' },
        { status: 400 }
      );
    }

    const updatedItem = {
      ...item,
      quantity: item.quantity - body.amount,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ item: updatedItem });
  }),

  http.get(`${BASE_URL}/inventory/expiring`, ({ request }) => {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '7', 10);

    const expiringItems = mockInventoryItems.filter(item => {
      const daysUntilExpiry = Math.floor(
        (new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry <= days;
    });

    return HttpResponse.json({ items: expiringItems });
  }),

  http.get(`${BASE_URL}/inventory/barcode/:barcode`, ({ params }) => {
    const item = mockInventoryItems.find(i => i.barcode === params.barcode);

    if (!item) {
      return HttpResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ item });
  }),

  // Hydration endpoints
  http.get(`${BASE_URL}/hydration`, ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    return HttpResponse.json({
      logs: mockHydrationLogs,
      startDate,
      endDate,
    });
  }),

  http.post(`${BASE_URL}/hydration`, async ({ request }) => {
    const body = await request.json() as any;

    const newLog = {
      id: `hydration-${Date.now()}`,
      ...body,
      timestamp: new Date().toISOString(),
    };

    return HttpResponse.json({ log: newLog }, { status: 201 });
  }),

  http.get(`${BASE_URL}/hydration/today`, () => {
    const totalAmount = mockHydrationLogs.reduce((sum, log) => sum + log.amount, 0);

    return HttpResponse.json({
      logs: mockHydrationLogs,
      total: totalAmount,
      goal: 2000,
      percentage: Math.round((totalAmount / 2000) * 100),
    });
  }),

  http.get(`${BASE_URL}/hydration/goals`, () => {
    return HttpResponse.json({
      daily: 2000,
      unit: 'ml',
      reminderInterval: 60,
    });
  }),

  http.put(`${BASE_URL}/hydration/goals`, async ({ request }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      daily: body.daily || 2000,
      unit: body.unit || 'ml',
      reminderInterval: body.reminderInterval || 60,
    });
  }),

  http.get(`${BASE_URL}/hydration/trends`, ({ request }) => {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '7', 10);

    const trends = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        date: date.toISOString().split('T')[0],
        amount: Math.floor(Math.random() * 500) + 1500,
        goal: 2000,
      };
    });

    return HttpResponse.json({ trends });
  }),

  // Caffeine endpoints
  http.get(`${BASE_URL}/caffeine`, ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    return HttpResponse.json({
      logs: mockCaffeineLogs,
      startDate,
      endDate,
    });
  }),

  http.post(`${BASE_URL}/caffeine`, async ({ request }) => {
    const body = await request.json() as any;

    const newLog = {
      id: `caffeine-${Date.now()}`,
      ...body,
      timestamp: new Date().toISOString(),
    };

    return HttpResponse.json({ log: newLog }, { status: 201 });
  }),

  http.get(`${BASE_URL}/caffeine/today`, () => {
    const totalAmount = mockCaffeineLogs.reduce((sum, log) => sum + log.amount, 0);

    return HttpResponse.json({
      logs: mockCaffeineLogs,
      total: totalAmount,
      limit: 400,
      percentage: Math.round((totalAmount / 400) * 100),
    });
  }),

  // Shopping endpoints
  http.get(`${BASE_URL}/shopping/current`, () => {
    const currentList = mockShoppingLists.find(list => list.status === 'active');

    if (!currentList) {
      return HttpResponse.json(
        { error: 'No active shopping list' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ list: currentList });
  }),

  http.get(`${BASE_URL}/shopping`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    let lists = mockShoppingLists;
    if (status) {
      lists = lists.filter(list => list.status === status);
    }

    return HttpResponse.json({ lists });
  }),

  http.post(`${BASE_URL}/shopping`, async ({ request }) => {
    const body = await request.json() as any;

    const newList = {
      id: `list-${Date.now()}`,
      ...body,
      status: 'active',
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ list: newList }, { status: 201 });
  }),

  http.get(`${BASE_URL}/shopping/:listId`, ({ params }) => {
    const list = mockShoppingLists.find(l => l.id === params.listId);

    if (!list) {
      return HttpResponse.json(
        { error: 'Shopping list not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ list });
  }),

  http.delete(`${BASE_URL}/shopping/:listId`, ({ params }) => {
    const list = mockShoppingLists.find(l => l.id === params.listId);

    if (!list) {
      return HttpResponse.json(
        { error: 'Shopping list not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ message: 'Shopping list deleted successfully' });
  }),

  http.post(`${BASE_URL}/shopping/:listId/items`, async ({ params, request }) => {
    const body = await request.json() as any;
    const list = mockShoppingLists.find(l => l.id === params.listId);

    if (!list) {
      return HttpResponse.json(
        { error: 'Shopping list not found' },
        { status: 404 }
      );
    }

    const newItem = {
      id: `list-item-${Date.now()}`,
      ...body,
      checked: false,
    };

    return HttpResponse.json({ item: newItem }, { status: 201 });
  }),

  http.put(`${BASE_URL}/shopping/:listId/items/:itemId`, async ({ params, request }) => {
    const body = await request.json() as any;
    const list = mockShoppingLists.find(l => l.id === params.listId);

    if (!list) {
      return HttpResponse.json(
        { error: 'Shopping list not found' },
        { status: 404 }
      );
    }

    const item = list.items.find(i => i.id === params.itemId);

    if (!item) {
      return HttpResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    const updatedItem = { ...item, ...body };

    return HttpResponse.json({ item: updatedItem });
  }),

  http.delete(`${BASE_URL}/shopping/:listId/items/:itemId`, ({ params }) => {
    const list = mockShoppingLists.find(l => l.id === params.listId);

    if (!list) {
      return HttpResponse.json(
        { error: 'Shopping list not found' },
        { status: 404 }
      );
    }

    const item = list.items.find(i => i.id === params.itemId);

    if (!item) {
      return HttpResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({ message: 'Item deleted successfully' });
  }),

  http.post(`${BASE_URL}/shopping/:listId/complete`, ({ params }) => {
    const list = mockShoppingLists.find(l => l.id === params.listId);

    if (!list) {
      return HttpResponse.json(
        { error: 'Shopping list not found' },
        { status: 404 }
      );
    }

    const completedList = {
      ...list,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ list: completedList });
  }),

  http.get(`${BASE_URL}/shopping/history`, ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    const completedLists = mockShoppingLists
      .filter(list => list.status === 'completed')
      .slice(0, limit);

    return HttpResponse.json({ lists: completedLists });
  }),
];
