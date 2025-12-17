# Tactical Implementation Guide - Meal Assistant

## Quick Reference: What to Do Right Now

**Status**: 75% of code exists, needs activation and integration
**Next Action**: Activate existing routes (2 hours, massive impact)
**Blocking Issue**: None - can start immediately

---

## Pre-Flight Checklist

Before starting implementation, verify:

```bash
# 1. Dependencies installed
cd /mnt/c/Users/brand/Development/Project_Workspace/active-development/meal_assistant
npm install

# 2. Database running
docker-compose up -d postgres
# OR check Railway database connection

# 3. Environment variables set
cat .env
# Required: DATABASE_URL, JWT_SECRET, PORT

# 4. TypeScript compiles
npm run typecheck

# 5. Current tests pass
npm run test:unit

# 6. ML service available (optional for Phase 1)
cd src/ml
python -m pip install -r requirements.txt
uvicorn inference.api:app --reload
# Should start on http://localhost:8000
```

**Expected Time**: 15 minutes
**Status**: ✅ Most already configured

---

## Phase 1: Activate Existing Routes (2 hours)

### Files to Modify

**Single File Change**: `src/api/server.ts`

### Step-by-Step Instructions

#### Step 1: Update Import Section (Lines 16-28)

**Current (lines 16-20):**
```typescript
// Route imports
const patternRoutes = require('./routes/patterns').default;
const mealRoutes = require('./routes/meals').default;
const authRoutes = require('./routes/auth').default;
const vectorRoutes = require('./routes/vector.routes').default;
```

**After - ADD these lines:**
```typescript
// Route imports
const patternRoutes = require('./routes/patterns').default;
const mealRoutes = require('./routes/meals').default;
const authRoutes = require('./routes/auth').default;
const vectorRoutes = require('./routes/vector.routes').default;

// NEW: Activate existing routes
const inventoryRoutes = require('./routes/inventory.routes').default;
const prepRoutes = require('./routes/prep.routes').default;
const shoppingRoutes = require('./routes/shopping.routes').default;
const analyticsRoutes = require('./routes/analytics.routes').default;
const hydrationRoutes = require('./routes/hydration.routes').default;
```

**Why**: These route files already exist but were commented out

---

#### Step 2: Update Route Mounting Section (Lines 68-80)

**Current (lines 68-71):**
```typescript
// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patterns', patternRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/vector', vectorRoutes);
```

**After - ADD these lines:**
```typescript
// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patterns', patternRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/vector', vectorRoutes);

// NEW: Mount activated routes
app.use('/api/inventory', inventoryRoutes);
app.use('/api/prep', prepRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/hydration', hydrationRoutes);
```

**Why**: This makes the routes accessible via HTTP

---

#### Step 3: Save and Build

```bash
# Save server.ts
# Then:

npm run build
# Should complete without errors

npm start
# Server should start on port 3000
```

**Expected Output:**
```
Meal Assistant API running on port 3000
Environment: development
```

---

#### Step 4: Test Each New Route

**4.1 Get Authentication Token:**
```bash
# If you have a test user:
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.token'

# Save the token
export TOKEN="<your-token-here>"

# If no test user exists, register one:
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"password123",
    "name":"Test User"
  }' | jq -r '.token'
```

**4.2 Test Inventory Route:**
```bash
curl http://localhost:3000/api/inventory \
  -H "Authorization: Bearer $TOKEN" \
  | jq

# Expected: [] or [inventory items]
# NOT expected: 404 or 500 error
```

**4.3 Test Shopping Route:**
```bash
curl http://localhost:3000/api/shopping \
  -H "Authorization: Bearer $TOKEN" \
  | jq

# Expected: [] or [shopping lists]
```

**4.4 Test Prep Route:**
```bash
curl http://localhost:3000/api/prep/tasks \
  -H "Authorization: Bearer $TOKEN" \
  | jq

# Expected: [] or [prep tasks]
```

**4.5 Test Analytics Route:**
```bash
curl http://localhost:3000/api/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN" \
  | jq

# Expected: Analytics object with stats
```

**4.6 Test Hydration Route:**
```bash
curl http://localhost:3000/api/hydration \
  -H "Authorization: Bearer $TOKEN" \
  | jq

# Expected: [] or [hydration logs]
```

---

#### Step 5: Fix Common Issues

**Issue 1: Module not found**
```
Error: Cannot find module './routes/inventory.routes'
```

**Solution:**
```bash
# Check if file has .ts extension
ls src/api/routes/inventory*

# Should show: inventory.routes.ts
# Import should be: './routes/inventory.routes'
```

---

**Issue 2: No default export**
```
Error: Cannot read property 'default' of undefined
```

**Solution:**
Open the route file and check the export:

```typescript
// Should have at bottom:
export default router;

// If it has:
export { router };

// Change imports in server.ts to:
const inventoryRoutes = require('./routes/inventory.routes').router;
```

---

**Issue 3: Database connection error**
```
Error: connect ECONNREFUSED
```

**Solution:**
```bash
# Check DATABASE_URL in .env
cat .env | grep DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# If Railway database:
# Get URL from Railway dashboard
# Update .env
```

---

#### Step 6: Verify Success

**Success Criteria:**
- ✅ Server starts without errors
- ✅ All 9 routes return 200 or 401 (not 404)
- ✅ TypeScript compiles without errors
- ✅ No console errors in server logs

**Completion Checklist:**
```bash
# Run this verification script:
echo "Testing activated routes..."

# Should all return valid responses (not 404):
curl -I http://localhost:3000/api/inventory -H "Authorization: Bearer $TOKEN"
curl -I http://localhost:3000/api/shopping -H "Authorization: Bearer $TOKEN"
curl -I http://localhost:3000/api/prep/tasks -H "Authorization: Bearer $TOKEN"
curl -I http://localhost:3000/api/analytics/dashboard -H "Authorization: Bearer $TOKEN"
curl -I http://localhost:3000/api/hydration -H "Authorization: Bearer $TOKEN"

echo "✅ Phase 1 Complete: 9/12 routes active (75%)"
```

**Time Invested**: 2 hours
**Value Delivered**: 5 major features now accessible
**Next Phase**: Create missing route files

---

## Phase 2: Create Missing Routes (6 hours)

### Files to Create

1. `src/api/routes/ads.routes.ts` - Ad upload and deal matching
2. `src/api/routes/templates.routes.ts` - Store ad templates
3. `src/api/routes/prices.routes.ts` - Price tracking and history
4. `src/api/routes/deals.routes.ts` - Deal aggregation

### Template for New Routes

**File**: `src/api/routes/ads.routes.ts`

```typescript
/**
 * Ad Routes
 * Endpoints for grocery ad upload and deal matching
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import axios from 'axios';

const router = Router();

// All ad routes require authentication
router.use(authenticate);

// ML service base URL
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * @route POST /api/ads/parse
 * @desc Upload and parse grocery ad
 * @access Private
 */
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { ad_text, store, coordinates } = req.body;

    if (!ad_text) {
      throw new ApiError(400, 'Ad text is required');
    }

    // Call ML service
    const response = await axios.post(
      `${ML_SERVICE_URL}/ml/ads/parse`,
      { ad_text, store, coordinates },
      { timeout: 30000 }
    );

    res.json(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'ML service error'
      );
    }
    throw error;
  }
});

/**
 * @route POST /api/ads/learn
 * @desc Submit correction for deal matching
 * @access Private
 */
router.post('/learn', async (req: Request, res: Response) => {
  try {
    const correction = req.body;

    const response = await axios.post(
      `${ML_SERVICE_URL}/ml/learn`,
      correction,
      { timeout: 10000 }
    );

    res.json(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'ML service error'
      );
    }
    throw error;
  }
});

/**
 * @route GET /api/ads/accuracy
 * @desc Get current accuracy statistics
 * @access Private
 */
router.get('/accuracy', async (req: Request, res: Response) => {
  try {
    const { store } = req.query;

    const response = await axios.get(
      `${ML_SERVICE_URL}/ml/accuracy`,
      {
        params: { store },
        timeout: 5000
      }
    );

    res.json(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'ML service error'
      );
    }
    throw error;
  }
});

/**
 * @route POST /api/ads/match
 * @desc Match deals to product catalog
 * @access Private
 */
router.post('/match', async (req: Request, res: Response) => {
  try {
    const { deals, top_k = 3 } = req.body;

    if (!deals || !Array.isArray(deals)) {
      throw new ApiError(400, 'Deals array is required');
    }

    const response = await axios.post(
      `${ML_SERVICE_URL}/ml/deals/match`,
      deals,
      {
        params: { top_k },
        timeout: 15000
      }
    );

    res.json(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'ML service error'
      );
    }
    throw error;
  }
});

export default router;
```

**Why This Works:**
1. ✅ Follows existing route pattern
2. ✅ Uses authentication middleware
3. ✅ Proxies to ML service (no business logic duplication)
4. ✅ Proper error handling
5. ✅ Timeout protection

---

### Create Remaining Routes

**File**: `src/api/routes/templates.routes.ts`

```typescript
/**
 * Template Routes
 * Endpoints for managing store ad templates
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import axios from 'axios';

const router = Router();
router.use(authenticate);

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * @route POST /api/templates/optimize
 * @desc Optimize templates for a store
 * @access Private
 */
router.post('/optimize', async (req: Request, res: Response) => {
  try {
    const { store, generate_synthetic = true } = req.body;

    if (!store) {
      throw new ApiError(400, 'Store name is required');
    }

    const response = await axios.post(
      `${ML_SERVICE_URL}/ml/templates/optimize`,
      {},
      {
        params: { store, generate_synthetic },
        timeout: 30000
      }
    );

    res.json(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'ML service error'
      );
    }
    throw error;
  }
});

/**
 * @route GET /api/templates/stats
 * @desc Get template statistics
 * @access Private
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(
      `${ML_SERVICE_URL}/ml/stats`,
      { timeout: 5000 }
    );

    res.json(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'ML service error'
      );
    }
    throw error;
  }
});

export default router;
```

---

**File**: `src/api/routes/prices.routes.ts`

```typescript
/**
 * Price Routes
 * Endpoints for price tracking and history
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import axios from 'axios';

const router = Router();
router.use(authenticate);

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * @route POST /api/prices/predict-cycle
 * @desc Predict next sale for an item
 * @access Private
 */
router.post('/predict-cycle', async (req: Request, res: Response) => {
  try {
    const { item_id, urgency = 'normal' } = req.body;

    if (!item_id) {
      throw new ApiError(400, 'Item ID is required');
    }

    const response = await axios.post(
      `${ML_SERVICE_URL}/ml/deals/cycle-predict`,
      { item_id, urgency },
      { timeout: 5000 }
    );

    res.json(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'ML service error'
      );
    }
    throw error;
  }
});

/**
 * @route GET /api/prices/upcoming
 * @desc Get upcoming predicted sales
 * @access Private
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const { days_ahead = 14, min_confidence = 0.5 } = req.query;

    const response = await axios.get(
      `${ML_SERVICE_URL}/ml/deals/upcoming`,
      {
        params: { days_ahead, min_confidence },
        timeout: 5000
      }
    );

    res.json(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'ML service error'
      );
    }
    throw error;
  }
});

export default router;
```

---

**File**: `src/api/routes/deals.routes.ts`

```typescript
/**
 * Deal Routes
 * Endpoints for deal aggregation and savings
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import axios from 'axios';

const router = Router();
router.use(authenticate);

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * @route POST /api/deals/savings/predict
 * @desc Predict savings from multi-store vs single-store
 * @access Private
 */
router.post('/savings/predict', async (req: Request, res: Response) => {
  try {
    const savingsRequest = req.body;

    const response = await axios.post(
      `${ML_SERVICE_URL}/ml/savings/predict`,
      savingsRequest,
      { timeout: 5000 }
    );

    res.json(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'ML service error'
      );
    }
    throw error;
  }
});

/**
 * @route POST /api/deals/worth-it
 * @desc Get recommendation if multi-store shopping is worth it
 * @access Private
 */
router.post('/worth-it', async (req: Request, res: Response) => {
  try {
    const worthItRequest = req.body;

    const response = await axios.post(
      `${ML_SERVICE_URL}/ml/route/worth-it`,
      worthItRequest,
      { timeout: 5000 }
    );

    res.json(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'ML service error'
      );
    }
    throw error;
  }
});

export default router;
```

---

### Mount New Routes in server.ts

**Add to imports section:**
```typescript
const adsRoutes = require('./routes/ads.routes').default;
const templatesRoutes = require('./routes/templates.routes').default;
const pricesRoutes = require('./routes/prices.routes').default;
const dealsRoutes = require('./routes/deals.routes').default;
```

**Add to mounting section:**
```typescript
app.use('/api/ads', adsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/prices', pricesRoutes);
app.use('/api/deals', dealsRoutes);
```

---

### Test New Routes

```bash
# Test ads
curl -X POST http://localhost:3000/api/ads/parse \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ad_text":"Chicken $2.99/lb"}'

# Test templates
curl -X POST http://localhost:3000/api/templates/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"store":"Walmart"}'

# Test prices
curl http://localhost:3000/api/prices/upcoming \
  -H "Authorization: Bearer $TOKEN"

# Test deals
curl -X POST http://localhost:3000/api/deals/worth-it \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stores": [],
    "total_items": 10,
    "value_priority": "balanced"
  }'
```

**Phase 2 Complete**: 12/12 routes active (100% API)

---

## Phase 3: Mobile Integration (8 hours)

### Strategy

Don't rewrite the mobile app - just connect existing screens to real API.

### File to Modify

**Primary**: `src/mobile/services/apiService.ts`

**Current** (likely using mock data):
```typescript
export const fetchDashboard = async () => {
  // Mock data
  return {
    currentPattern: 'moderate',
    adherence: 0.85,
    ...
  };
};
```

**After** (real API):
```typescript
import axios from 'axios';

const API_BASE = process.env.API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// Add auth token interceptor
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const fetchDashboard = async () => {
  const response = await api.get('/analytics/dashboard');
  return response.data;
};

export const fetchInventory = async () => {
  const response = await api.get('/inventory');
  return response.data;
};

export const createShoppingList = async (data: any) => {
  const response = await api.post('/shopping', data);
  return response.data;
};

// ... repeat for all endpoints
```

---

### Screen-by-Screen Connection

#### 1. Dashboard Screen
```typescript
// src/mobile/screens/DashboardScreen.tsx

// OLD:
const mockData = { ... };

// NEW:
import { fetchDashboard } from '../services/apiService';

useEffect(() => {
  const loadData = async () => {
    try {
      const data = await fetchDashboard();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      // Show error UI
    }
  };
  loadData();
}, []);
```

#### 2. Inventory Screen
```typescript
// src/mobile/screens/InventoryScreen.tsx

import { fetchInventory, addInventoryItem, updateInventoryItem } from '../services/apiService';

const InventoryScreen = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const data = await fetchInventory();
      setItems(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddItem = async (item) => {
    try {
      const newItem = await addInventoryItem(item);
      setItems([...items, newItem]);
    } catch (error) {
      console.error(error);
    }
  };

  // ... rest of component
};
```

#### 3-6. Repeat Pattern for Other Screens

**Shopping Screen**: Connect to `/api/shopping`
**Prep Screen**: Connect to `/api/prep/tasks`
**Analytics Screen**: Connect to `/api/analytics`
**Ads Screen**: Connect to `/api/ads/parse`

---

### Testing Mobile Integration

```bash
# 1. Start backend
npm start  # In project root

# 2. Start mobile app
cd src/mobile
npm start

# 3. Test in Expo
# - Press 'w' for web
# - Or scan QR code with Expo Go

# 4. Verify API calls
# - Open network tab in browser dev tools
# - Or check terminal logs
# - Should see API requests to http://localhost:3000
```

**Phase 3 Complete**: Mobile app uses real API

---

## Phase 4: Test Refactoring (16 hours)

### Current Problem

Tests use mocks instead of real implementation:

```typescript
// BAD: Current test
jest.mock('../services/patternService');

test('should get patterns', async () => {
  patternService.getPatterns.mockResolvedValue([{...}]);
  // Not testing real code!
});
```

### Solution Strategy

1. **Setup test database**
2. **Remove mocks**
3. **Use real services**
4. **Clean up after each test**

---

### Test Database Setup

**File**: `tests/setup.ts`

```typescript
import { Pool } from 'pg';

let testPool: Pool;

beforeAll(async () => {
  // Create test database connection
  testPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
  });

  // Run migrations
  await runMigrations(testPool);
});

afterAll(async () => {
  await testPool.end();
});

afterEach(async () => {
  // Clean up test data
  await testPool.query('DELETE FROM meals WHERE user_id LIKE $1', ['test-%']);
  await testPool.query('DELETE FROM patterns WHERE user_id LIKE $1', ['test-%']);
  await testPool.query('DELETE FROM inventory WHERE user_id LIKE $1', ['test-%']);
});
```

---

### Example: Refactor Pattern Service Test

**Before** (mock-based):
```typescript
jest.mock('../../src/api/database/services/patternService');

describe('Pattern Service', () => {
  it('should create pattern', async () => {
    patternService.createPattern.mockResolvedValue({ id: '123', ... });

    const result = await patternService.createPattern(data);
    expect(result.id).toBe('123');
  });
});
```

**After** (real implementation):
```typescript
import patternService from '../../src/api/database/services/patternService';
import { Pool } from 'pg';

describe('Pattern Service', () => {
  let testPool: Pool;
  let testUserId: string;

  beforeAll(async () => {
    testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  });

  beforeEach(async () => {
    // Create test user
    const result = await testPool.query(
      'INSERT INTO users (id, email, password) VALUES ($1, $2, $3) RETURNING id',
      [`test-${Date.now()}`, 'test@example.com', 'hash']
    );
    testUserId = result.rows[0].id;
  });

  afterEach(async () => {
    // Clean up
    await testPool.query('DELETE FROM patterns WHERE user_id = $1', [testUserId]);
    await testPool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('should create pattern', async () => {
    const data = {
      userId: testUserId,
      patternType: 'moderate',
      startDate: new Date(),
    };

    const result = await patternService.createPattern(data);

    expect(result.id).toBeDefined();
    expect(result.userId).toBe(testUserId);
    expect(result.patternType).toBe('moderate');

    // Verify in database
    const dbResult = await testPool.query(
      'SELECT * FROM patterns WHERE id = $1',
      [result.id]
    );
    expect(dbResult.rows.length).toBe(1);
  });
});
```

**Benefits:**
- ✅ Tests real code, not mocks
- ✅ Catches database issues
- ✅ Verifies data persistence
- ✅ Real confidence in code

---

### Prioritize Test Files

**High Priority** (Core functionality):
1. `tests/unit/auth.test.ts`
2. `tests/unit/patterns.test.ts`
3. `tests/unit/meals.test.ts`
4. `tests/integration/api-database.test.ts`

**Medium Priority**:
5. `tests/unit/inventory.test.ts`
6. `tests/unit/shopping.test.ts`
7. `tests/integration/redux-database.test.ts`

**Low Priority** (Can defer):
8. `tests/e2e/userJourneys.test.ts`
9. `tests/performance/benchmarks.test.ts`

---

### Run Tests Incrementally

```bash
# Test one file at a time
npm run test tests/unit/auth.test.ts

# Check coverage for that file
npm run test:coverage -- tests/unit/auth.test.ts

# Once passing, move to next file
npm run test tests/unit/patterns.test.ts

# Eventually run full suite
npm run test:coverage
```

**Phase 4 Complete**: 60%+ coverage with real tests

---

## Success Metrics Dashboard

Track progress with this checklist:

```
□ Phase 1: Activate Routes (2h)
  □ server.ts modified
  □ 9/12 routes active
  □ All routes tested with curl
  □ No TypeScript errors

□ Phase 2: Create Routes (6h)
  □ ads.routes.ts created
  □ templates.routes.ts created
  □ prices.routes.ts created
  □ deals.routes.ts created
  □ All 4 routes tested
  □ 12/12 routes active (100%)

□ Phase 3: ML Integration (4h)
  □ ML service running on port 8000
  □ Axios client configured
  □ Error handling added
  □ All ML endpoints tested

□ Phase 4: Mobile Connection (8h)
  □ apiService.ts updated
  □ Dashboard connected
  □ Inventory connected
  □ Shopping connected
  □ Prep connected
  □ Analytics connected
  □ Ads connected

□ Phase 5: Test Refactoring (16h)
  □ Test database setup
  □ Auth tests refactored
  □ Pattern tests refactored
  □ Meal tests refactored
  □ Integration tests refactored
  □ Coverage ≥ 60%

□ Phase 6: Deployment (3h)
  □ ML service Dockerfile created
  □ Railway ML service configured
  □ ML service deployed
  □ Main API connected to ML service

□ Phase 7: E2E Testing (8h)
  □ User journey tests passing
  □ Performance tests passing
  □ Security audit complete
  □ Bug fixes applied

□ Phase 8: Documentation (4h)
  □ API documentation written
  □ User guide created
  □ Demo video recorded
  □ README updated
  □ Live demo URL added

🎯 COMPLETE: Production-ready system
```

---

## Quick Command Reference

```bash
# Start development
npm run dev

# Build for production
npm run build

# Run tests
npm run test
npm run test:unit
npm run test:coverage

# Start mobile
cd src/mobile && npm start

# Start ML service
cd src/ml && uvicorn inference.api:app --reload

# Database
docker-compose up -d postgres
npm run db:migrate
npm run db:seed

# Deployment
docker-compose up -d  # Local
git push railway main # Railway

# Debugging
npm run lint
npm run typecheck
docker-compose logs -f api
```

---

## Emergency Rollback Plan

If something breaks:

```bash
# 1. Check what changed
git status
git diff

# 2. Rollback last commit
git reset --soft HEAD~1

# 3. Or revert specific file
git checkout HEAD -- src/api/server.ts

# 4. Restart services
docker-compose restart api

# 5. Check logs
docker-compose logs api
```

---

## Final Checklist Before Going Live

```bash
# 1. All routes respond
for route in auth patterns meals vector inventory prep shopping analytics hydration ads templates prices deals; do
  echo "Testing $route..."
  curl -I http://localhost:3000/api/$route -H "Authorization: Bearer $TOKEN"
done

# 2. Tests pass
npm run test:ci

# 3. Build succeeds
npm run build

# 4. TypeScript clean
npm run typecheck

# 5. No security issues
npm audit

# 6. Database migrations applied
npm run db:status

# 7. Environment variables set
cat .env | grep -E "(DATABASE_URL|JWT_SECRET|ML_SERVICE_URL)"

# 8. Mobile app works
cd src/mobile && npm start

# 9. Documentation updated
cat README.md | grep "Live Demo"

# 10. Deploy
git push railway main
```

---

This tactical guide provides:
- ✅ Step-by-step instructions for each phase
- ✅ Exact code to add/modify
- ✅ Testing procedures
- ✅ Common issues and solutions
- ✅ Success criteria
- ✅ Command reference
- ✅ Emergency procedures

**Ready to start?** Begin with Phase 1 (2 hours) for immediate impact.
