/**
 * Integration Tests for Meal Assistant API
 * Tests all major endpoints and workflows
 */

const request = require('supertest');
const app = require('../../src/api/server');
const { clearAll } = require('../../src/api/services/dataStore');

describe('Meal Assistant API', () => {
  let authToken;
  let userId;
  let patternId;
  let mealId;
  let inventoryId;
  let prepSessionId;
  let shoppingListId;

  beforeAll(async () => {
    clearAll();
  });

  afterAll(() => {
    clearAll();
  });

  // =========================================
  // Authentication Tests
  // =========================================
  describe('Authentication', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'brandon@test.com',
            password: 'securepass123',
            name: 'Brandon',
            profile: {
              weight: 250,
              height: 70,
              targetCalories: 1800,
              targetProtein: 135
            }
          });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('User registered successfully');
        expect(res.body.token).toBeDefined();
        expect(res.body.user.email).toBe('brandon@test.com');
        expect(res.body.user.profile.targetCalories).toBe(1800);

        authToken = res.body.token;
        userId = res.body.user.id;
      });

      it('should reject duplicate email', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'brandon@test.com',
            password: 'anotherpass123'
          });

        expect(res.status).toBe(409);
      });

      it('should validate required fields', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@test.com'
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'brandon@test.com',
            password: 'securepass123'
          });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        authToken = res.body.token;
      });

      it('should reject invalid credentials', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'brandon@test.com',
            password: 'wrongpassword'
          });

        expect(res.status).toBe(401);
      });
    });

    describe('GET /api/auth/me', () => {
      it('should return current user profile', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe('brandon@test.com');
      });

      it('should reject without token', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
      });
    });
  });

  // =========================================
  // Pattern Tests
  // =========================================
  describe('Patterns', () => {
    describe('GET /api/patterns', () => {
      it('should return all pattern types', async () => {
        const res = await request(app)
          .get('/api/patterns')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.patterns).toHaveLength(7);
        expect(res.body.patterns.map(p => p.type)).toContain('traditional');
        expect(res.body.patterns.map(p => p.type)).toContain('if_noon');
      });
    });

    describe('POST /api/patterns/select', () => {
      it('should select a pattern for today', async () => {
        const today = new Date().toISOString().split('T')[0];

        const res = await request(app)
          .post('/api/patterns/select')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            patternType: 'traditional',
            date: today
          });

        expect(res.status).toBe(201);
        expect(res.body.pattern.patternType).toBe('traditional');
        expect(res.body.pattern.meals).toHaveLength(3);

        patternId = res.body.pattern.id;
        mealId = res.body.pattern.meals[0].id;
      });

      it('should reject duplicate pattern for same date', async () => {
        const today = new Date().toISOString().split('T')[0];

        const res = await request(app)
          .post('/api/patterns/select')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            patternType: 'reversed',
            date: today
          });

        expect(res.status).toBe(409);
      });

      it('should validate pattern type', async () => {
        const res = await request(app)
          .post('/api/patterns/select')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            patternType: 'invalid_pattern',
            date: '2024-01-15'
          });

        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/patterns/:id/meals', () => {
      it('should return pattern meal structure', async () => {
        const res = await request(app)
          .get(`/api/patterns/${patternId}/meals`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.patternType).toBe('traditional');
        expect(res.body.meals).toHaveLength(3);
        expect(res.body.summary.totalCalories).toBe(1800);
        expect(res.body.summary.totalProtein).toBe(135);
      });
    });

    describe('POST /api/patterns/switch', () => {
      it('should switch to a different pattern', async () => {
        const res = await request(app)
          .post('/api/patterns/switch')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            currentPatternId: patternId,
            newPatternType: 'grazing_mini',
            reason: 'Changed plans'
          });

        expect(res.status).toBe(200);
        expect(res.body.newPattern.patternType).toBe('grazing_mini');
        expect(res.body.adjustments).toBeDefined();
      });
    });
  });

  // =========================================
  // Meal Tests
  // =========================================
  describe('Meals', () => {
    describe('GET /api/meals/today', () => {
      it('should return today\'s meals', async () => {
        const res = await request(app)
          .get('/api/meals/today')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.meals).toBeDefined();
      });
    });

    describe('POST /api/meals/log', () => {
      it('should log a meal', async () => {
        // First get a valid meal ID from current pattern
        const patternRes = await request(app)
          .post('/api/patterns/select')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            patternType: 'big_breakfast',
            date: '2024-01-16'
          });

        const testMealId = patternRes.body.pattern.meals[0].id;

        const res = await request(app)
          .post('/api/meals/log')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            mealId: testMealId,
            status: 'completed',
            actualCalories: 820,
            actualProtein: 55,
            rating: 4,
            notes: 'Great breakfast bowl'
          });

        expect(res.status).toBe(200);
        expect(res.body.meal.status).toBe('completed');
        expect(res.body.meal.actualCalories).toBe(820);
        expect(res.body.analysis).toBeDefined();
      });
    });

    describe('PUT /api/meals/:id/substitute', () => {
      it('should record ingredient substitution', async () => {
        const patternRes = await request(app)
          .post('/api/patterns/select')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            patternType: 'reversed',
            date: '2024-01-17'
          });

        const testMealId = patternRes.body.pattern.meals[1].id;

        const res = await request(app)
          .put(`/api/meals/${testMealId}/substitute`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ingredientName: 'Salmon',
            substituteName: 'Tilapia',
            reason: 'Salmon not available',
            calorieAdjustment: -40,
            proteinAdjustment: 5
          });

        expect(res.status).toBe(200);
        expect(res.body.substitution.original).toBe('Salmon');
        expect(res.body.substitution.replacement).toBe('Tilapia');
      });
    });
  });

  // =========================================
  // Inventory Tests
  // =========================================
  describe('Inventory', () => {
    describe('POST /api/inventory', () => {
      it('should add an inventory item', async () => {
        const res = await request(app)
          .post('/api/inventory')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Chicken Breast',
            category: 'protein',
            quantity: 24,
            unit: 'oz',
            expiryDate: '2024-01-20',
            location: 'refrigerator',
            purchasePrice: 12.99,
            store: 'Costco'
          });

        expect(res.status).toBe(201);
        expect(res.body.item.name).toBe('Chicken Breast');
        inventoryId = res.body.item.id;
      });
    });

    describe('POST /api/inventory/batch', () => {
      it('should add multiple inventory items', async () => {
        const res = await request(app)
          .post('/api/inventory/batch')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            items: [
              { name: 'Rice', category: 'carbohydrate', quantity: 10, unit: 'cup', location: 'pantry' },
              { name: 'Black Beans', category: 'protein', quantity: 4, unit: 'can', location: 'pantry' },
              { name: 'Eggs', category: 'protein', quantity: 12, unit: 'count', expiryDate: '2024-01-25', location: 'refrigerator' }
            ]
          });

        expect(res.status).toBe(201);
        expect(res.body.items).toHaveLength(3);
        expect(res.body.summary.count).toBe(3);
      });
    });

    describe('GET /api/inventory', () => {
      it('should return all inventory items', async () => {
        const res = await request(app)
          .get('/api/inventory')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items.length).toBeGreaterThanOrEqual(4);
        expect(res.body.byCategory).toBeDefined();
        expect(res.body.summary.totalItems).toBeGreaterThanOrEqual(4);
      });
    });

    describe('GET /api/inventory/expiring', () => {
      it('should return expiring items', async () => {
        const res = await request(app)
          .get('/api/inventory/expiring?hours=168')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toBeDefined();
        expect(res.body.recommendations).toBeDefined();
      });
    });

    describe('PUT /api/inventory/:id', () => {
      it('should update inventory item', async () => {
        const res = await request(app)
          .put(`/api/inventory/${inventoryId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            quantity: 18
          });

        expect(res.status).toBe(200);
        expect(res.body.item.quantity).toBe(18);
      });
    });

    describe('POST /api/inventory/consume', () => {
      it('should consume inventory from meal', async () => {
        // Create a pattern and get meal ID
        const patternRes = await request(app)
          .post('/api/patterns/select')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            patternType: 'traditional',
            date: '2024-01-18'
          });

        const testMealId = patternRes.body.pattern.meals[0].id;

        const res = await request(app)
          .post('/api/inventory/consume')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            mealId: testMealId,
            items: [
              { inventoryId: inventoryId, quantityUsed: 6 }
            ]
          });

        expect(res.status).toBe(200);
        expect(res.body.consumed).toHaveLength(1);
        expect(res.body.consumed[0].remaining).toBe(12); // 18 - 6
      });
    });
  });

  // =========================================
  // Prep Tests
  // =========================================
  describe('Prep', () => {
    describe('POST /api/prep/schedule', () => {
      it('should generate prep schedule', async () => {
        const res = await request(app)
          .post('/api/prep/schedule')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            patternType: 'traditional',
            date: '2024-01-19'
          });

        expect(res.status).toBe(201);
        expect(res.body.session.tasks).toBeDefined();
        expect(res.body.session.tasks.length).toBeGreaterThan(0);
        expect(res.body.timeline).toBeDefined();

        prepSessionId = res.body.session.id;
      });
    });

    describe('GET /api/prep/equipment', () => {
      it('should return equipment status', async () => {
        const res = await request(app)
          .get('/api/prep/equipment')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.summary).toBeDefined();
        expect(res.body.byState).toBeDefined();
      });
    });

    describe('POST /api/prep/start', () => {
      it('should start prep session', async () => {
        const res = await request(app)
          .post('/api/prep/start')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            sessionId: prepSessionId
          });

        expect(res.status).toBe(200);
        expect(res.body.session.status).toBe('in_progress');
        expect(res.body.currentTask).toBeDefined();
      });
    });

    describe('PUT /api/prep/task/:id', () => {
      it('should update task status', async () => {
        // Get the session to find task ID
        const sessionRes = await request(app)
          .get(`/api/prep/${prepSessionId}`)
          .set('Authorization', `Bearer ${authToken}`);

        const taskId = sessionRes.body.session.tasks[0].id;

        const res = await request(app)
          .put(`/api/prep/task/${taskId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            status: 'completed',
            actualDuration: 12
          });

        expect(res.status).toBe(200);
        expect(res.body.task.status).toBe('completed');
        expect(res.body.progress).toBeDefined();
      });
    });

    describe('GET /api/prep/conflicts', () => {
      it('should detect equipment conflicts', async () => {
        const res = await request(app)
          .get('/api/prep/conflicts?patternType=traditional')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.hasConflicts).toBeDefined();
        expect(res.body.requiredEquipment).toBeDefined();
      });
    });
  });

  // =========================================
  // Shopping Tests
  // =========================================
  describe('Shopping', () => {
    describe('GET /api/shopping/generate', () => {
      it('should generate shopping items from patterns', async () => {
        const res = await request(app)
          .get('/api/shopping/generate?startDate=2024-01-15&endDate=2024-01-21')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toBeDefined();
        expect(res.body.patterns).toBeDefined();
      });
    });

    describe('POST /api/shopping/generate', () => {
      it('should create shopping list from patterns', async () => {
        const res = await request(app)
          .post('/api/shopping/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            patterns: [
              { patternType: 'traditional', date: '2024-01-22' },
              { patternType: 'if_noon', date: '2024-01-23' }
            ],
            excludeInventory: true
          });

        expect(res.status).toBe(201);
        expect(res.body.list.items).toBeDefined();
        expect(res.body.list.items.length).toBeGreaterThan(0);

        shoppingListId = res.body.list.id;
      });
    });

    describe('POST /api/shopping/optimize', () => {
      it('should optimize shopping list by store', async () => {
        const res = await request(app)
          .post('/api/shopping/optimize')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            listId: shoppingListId,
            stores: ['Costco', 'Safeway', 'Whole Foods'],
            weights: {
              price: 0.5,
              distance: 0.2,
              quality: 0.2,
              time: 0.1
            }
          });

        expect(res.status).toBe(200);
        expect(res.body.byStore).toBeDefined();
        expect(res.body.summary.distribution).toHaveLength(3);
      });
    });

    describe('PUT /api/shopping/check/:id', () => {
      it('should mark item as purchased', async () => {
        // Get shopping list to find item ID
        const listRes = await request(app)
          .get(`/api/shopping/${shoppingListId}`)
          .set('Authorization', `Bearer ${authToken}`);

        const itemId = listRes.body.list.items[0].id;

        const res = await request(app)
          .put(`/api/shopping/check/${itemId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            purchased: true,
            actualPrice: 4.99,
            store: 'Costco'
          });

        expect(res.status).toBe(200);
        expect(res.body.item.purchased).toBe(true);
        expect(res.body.progress).toBeDefined();
      });
    });
  });

  // =========================================
  // Analytics Tests
  // =========================================
  describe('Analytics', () => {
    describe('GET /api/analytics/patterns', () => {
      it('should return pattern analytics', async () => {
        const res = await request(app)
          .get('/api/analytics/patterns')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.stats).toBeDefined();
        expect(res.body.overall).toBeDefined();
        expect(res.body.rankings).toBeDefined();
      });
    });

    describe('GET /api/analytics/weight', () => {
      it('should return weight trend data', async () => {
        const res = await request(app)
          .get('/api/analytics/weight')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.current).toBeDefined();
        expect(res.body.trend).toBeDefined();
        expect(res.body.projection).toBeDefined();
      });
    });

    describe('GET /api/analytics/adherence', () => {
      it('should return adherence rates', async () => {
        const res = await request(app)
          .get('/api/analytics/adherence')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.overall).toBeDefined();
        expect(res.body.byDayOfWeek).toBeDefined();
        expect(res.body.streaks).toBeDefined();
      });
    });

    describe('GET /api/analytics/summary', () => {
      it('should return analytics summary', async () => {
        const res = await request(app)
          .get('/api/analytics/summary?days=30')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.period).toBeDefined();
        expect(res.body.summary).toBeDefined();
        expect(res.body.quickStats).toBeDefined();
      });
    });
  });

  // =========================================
  // Error Handling Tests
  // =========================================
  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app)
        .get('/api/unknown/route')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });

    it('should return 401 for unauthorized requests', async () => {
      const res = await request(app)
        .get('/api/patterns')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });

    it('should handle malformed JSON', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(res.status).toBe(400);
    });
  });

  // =========================================
  // Health Check Tests
  // =========================================
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.timestamp).toBeDefined();
    });
  });
});
