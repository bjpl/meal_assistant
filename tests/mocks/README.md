# MSW Mock Setup

Mock Service Worker (MSW) configuration for API integration testing.

## Files

- **handlers.ts** - HTTP request handlers with mock data for all API endpoints
- **server.ts** - MSW server setup for Node.js/Jest environment
- **browser.ts** - MSW worker setup for browser/React Native environment
- **../setup/msw.ts** - Jest test setup configuration

## Usage

### In Jest Tests

MSW is automatically configured if you have the setup file in `jest.config.js`:

```typescript
// jest.config.js
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/tests/setup/msw.ts'],
  // ...
};
```

Then use in your tests:

```typescript
import { apiService } from '@/services/apiService';

describe('API Integration Tests', () => {
  test('fetches meals successfully', async () => {
    const meals = await apiService.meals.getToday();
    expect(meals).toHaveLength(2);
  });
});
```

### Override Handlers for Specific Tests

```typescript
import { server } from 'tests/mocks/server';
import { http, HttpResponse } from 'msw';

test('handles API error', async () => {
  // Override handler for this test only
  server.use(
    http.get('http://localhost:3000/api/meals/today', () => {
      return HttpResponse.json(
        { error: 'Server error' },
        { status: 500 }
      );
    })
  );

  // Test error handling
  await expect(apiService.meals.getToday()).rejects.toThrow();
});
```

### In React Native Development

Enable mocking in development mode:

```typescript
// App.tsx or index.js
import { startMocking } from './tests/mocks/browser';

if (__DEV__ && process.env.ENABLE_MSW === 'true') {
  startMocking({
    onUnhandledRequest: 'warn',
  }).then(() => {
    console.log('MSW mocking enabled');
  });
}
```

## Available Endpoints

All endpoints from `apiService.ts` are mocked:

### Auth
- POST /auth/register
- POST /auth/login
- POST /auth/logout
- GET /auth/me
- POST /auth/password
- POST /auth/refresh

### Patterns
- GET /patterns
- GET /patterns/:patternCode
- GET /patterns/preferences
- PUT /patterns/preferences
- GET /patterns/preferences/default
- GET /patterns/daily
- POST /patterns/daily/:date/rating
- GET /patterns/history
- GET /patterns/statistics

### Meals
- GET /meals/today
- GET /meals
- POST /meals
- GET /meals/:mealId
- PUT /meals/:mealId
- DELETE /meals/:mealId

### Inventory
- GET /inventory
- POST /inventory
- GET /inventory/:itemId
- PUT /inventory/:itemId
- DELETE /inventory/:itemId
- POST /inventory/:itemId/consume
- GET /inventory/expiring
- GET /inventory/barcode/:barcode

### Hydration
- GET /hydration
- POST /hydration
- GET /hydration/today
- GET /hydration/goals
- PUT /hydration/goals
- GET /hydration/trends

### Caffeine
- GET /caffeine
- POST /caffeine
- GET /caffeine/today

### Shopping
- GET /shopping/current
- GET /shopping
- POST /shopping
- GET /shopping/:listId
- DELETE /shopping/:listId
- POST /shopping/:listId/items
- PUT /shopping/:listId/items/:itemId
- DELETE /shopping/:listId/items/:itemId
- POST /shopping/:listId/complete
- GET /shopping/history

## Mock Data

Mock data is defined in `handlers.ts` and includes:

- **mockUser** - Test user account
- **mockTokens** - Auth tokens
- **mockPatterns** - Nutrition patterns (BALANCED, LOWCARB)
- **mockMeals** - Sample meals with nutrition data
- **mockInventoryItems** - Pantry items with expiration dates
- **mockHydrationLogs** - Water intake logs
- **mockCaffeineLogs** - Caffeine consumption logs
- **mockShoppingLists** - Shopping lists with items

## Error Scenarios

Handlers include error cases for testing:

- **Auth**: Invalid credentials, existing user
- **Patterns**: Pattern not found
- **Meals**: Meal not found
- **Inventory**: Insufficient quantity, item not found
- **Validation**: Missing required fields, invalid data

## Configuration

Set `API_BASE_URL` environment variable to customize the base URL:

```bash
export API_BASE_URL=http://localhost:3000/api
```

Default: `http://localhost:3000/api`
