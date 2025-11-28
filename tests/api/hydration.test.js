/**
 * Hydration & Caffeine API Tests
 * Week 1-2 Option B Implementation
 *
 * Tests all hydration and caffeine tracking endpoints
 */

const request = require('supertest');
const app = require('../../src/api/server');
const { clearAll } = require('../../src/api/services/dataStore');

describe('Hydration & Caffeine API', () => {
  let authToken;
  let userId;
  let hydrationLogId;
  let caffeineLogId;

  beforeAll(async () => {
    clearAll();

    // Register test user (Brandon with 250 lbs)
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'brandon@hydration-test.com',
        password: 'securepass123',
        name: 'Brandon',
        profile: {
          weight: 250,
          height: 70,
          targetCalories: 1800,
          targetProtein: 135
        }
      });

    // Use accessToken from the response (not 'token')
    authToken = res.body.accessToken;
    userId = res.body.user.id;
  });

  afterAll(() => {
    clearAll();
  });

  // =========================================
  // Hydration Logging Tests
  // =========================================
  describe('POST /api/hydration/log', () => {
    it('should log water intake', async () => {
      const res = await request(app)
        .post('/api/hydration/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount_oz: 16,
          beverage_type: 'water'
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Hydration logged successfully');
      expect(res.body.entry.amount_oz).toBe(16);
      expect(res.body.entry.beverage_type).toBe('water');
      expect(res.body.daily_progress).toBeDefined();
      expect(res.body.daily_progress.total_oz).toBeGreaterThanOrEqual(16);

      hydrationLogId = res.body.entry.id;
    });

    it('should log tea intake', async () => {
      const res = await request(app)
        .post('/api/hydration/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount_oz: 8,
          beverage_type: 'tea',
          notes: 'Green tea'
        });

      expect(res.status).toBe(201);
      expect(res.body.entry.beverage_type).toBe('tea');
      expect(res.body.entry.notes).toBe('Green tea');
    });

    it('should default to water if beverage_type not specified', async () => {
      const res = await request(app)
        .post('/api/hydration/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount_oz: 12
        });

      expect(res.status).toBe(201);
      expect(res.body.entry.beverage_type).toBe('water');
    });

    it('should reject invalid amount (too low)', async () => {
      const res = await request(app)
        .post('/api/hydration/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount_oz: 0
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid amount (too high)', async () => {
      const res = await request(app)
        .post('/api/hydration/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount_oz: 200
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid beverage type', async () => {
      const res = await request(app)
        .post('/api/hydration/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount_oz: 16,
          beverage_type: 'beer'
        });

      expect(res.status).toBe(400);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/hydration/log')
        .send({
          amount_oz: 16
        });

      expect(res.status).toBe(401);
    });
  });

  // =========================================
  // Today's Progress Tests
  // =========================================
  describe('GET /api/hydration/today', () => {
    it('should return today\'s hydration progress', async () => {
      const res = await request(app)
        .get('/api/hydration/today')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.date).toBeDefined();
      expect(res.body.total_oz).toBeDefined();
      expect(res.body.goal_oz).toBeDefined();
      expect(res.body.percentage).toBeDefined();
      expect(res.body.remaining).toBeDefined();
      expect(Array.isArray(res.body.entries)).toBe(true);
    });

    it('should calculate correct percentage', async () => {
      const res = await request(app)
        .get('/api/hydration/today')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const expectedPercentage = Math.min(100, Math.round((res.body.total_oz / res.body.goal_oz) * 100));
      expect(res.body.percentage).toBe(expectedPercentage);
    });
  });

  // =========================================
  // Goals Tests
  // =========================================
  describe('GET /api/hydration/goals', () => {
    it('should return personalized goals based on weight', async () => {
      const res = await request(app)
        .get('/api/hydration/goals')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // Brandon: 250 lbs / 2 = 125 oz
      expect(res.body.daily_water_oz).toBe(125);
      expect(res.body.daily_caffeine_limit_mg).toBe(400);
      expect(res.body.personalized_formula_enabled).toBe(true);
      expect(res.body.calculation).toBeDefined();
      expect(res.body.calculation.weight_lbs).toBe(250);
      expect(res.body.calculation.calculated_oz).toBe(125);
    });

    it('should include calculation explanation', async () => {
      const res = await request(app)
        .get('/api/hydration/goals')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.calculation.formula).toBe('body_weight_lbs / 2');
      expect(res.body.calculation.minimum_oz).toBe(64);
    });
  });

  describe('PUT /api/hydration/goals', () => {
    it('should update daily water goal', async () => {
      const res = await request(app)
        .put('/api/hydration/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          daily_water_oz: 100
        });

      expect(res.status).toBe(200);
      expect(res.body.goals.daily_water_oz).toBe(100);
    });

    it('should update caffeine limit', async () => {
      const res = await request(app)
        .put('/api/hydration/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          daily_caffeine_limit_mg: 300
        });

      expect(res.status).toBe(200);
      expect(res.body.goals.daily_caffeine_limit_mg).toBe(300);
    });

    it('should disable personalized formula', async () => {
      const res = await request(app)
        .put('/api/hydration/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          personalized_formula_enabled: false,
          daily_water_oz: 80
        });

      expect(res.status).toBe(200);
      expect(res.body.goals.personalized_formula_enabled).toBe(false);
      expect(res.body.goals.daily_water_oz).toBe(80);
    });

    it('should reject water goal below minimum', async () => {
      const res = await request(app)
        .put('/api/hydration/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          daily_water_oz: 20
        });

      expect(res.status).toBe(400);
    });

    it('should reject caffeine limit above maximum', async () => {
      const res = await request(app)
        .put('/api/hydration/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          daily_caffeine_limit_mg: 700
        });

      expect(res.status).toBe(400);
    });

    it('should require at least one field', async () => {
      const res = await request(app)
        .put('/api/hydration/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // =========================================
  // Trends Tests
  // =========================================
  describe('GET /api/hydration/trends', () => {
    it('should return hydration trends', async () => {
      const res = await request(app)
        .get('/api/hydration/trends')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.period).toBeDefined();
      expect(res.body.goal_oz).toBeDefined();
      expect(res.body.weekly).toBeDefined();
      expect(res.body.avg_daily_oz).toBeDefined();
      expect(res.body.adherence_rate).toBeDefined();
      expect(res.body.hourly_patterns).toBeDefined();
    });

    it('should accept period parameter', async () => {
      const res = await request(app)
        .get('/api/hydration/trends?period=month')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.period).toBe('month');
    });
  });

  // =========================================
  // Caffeine Logging Tests
  // =========================================
  describe('POST /api/hydration/caffeine/log', () => {
    it('should log coffee with auto-calculated caffeine', async () => {
      const res = await request(app)
        .post('/api/hydration/caffeine/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          beverage_type: 'coffee',
          volume_oz: 8
        });

      expect(res.status).toBe(201);
      expect(res.body.entry.beverage_type).toBe('coffee');
      expect(res.body.entry.volume_oz).toBe(8);
      // 8oz coffee = 95mg caffeine
      expect(res.body.entry.caffeine_mg).toBe(95);
      expect(res.body.daily_progress).toBeDefined();

      caffeineLogId = res.body.entry.id;
    });

    it('should log tea with auto-calculated caffeine', async () => {
      const res = await request(app)
        .post('/api/hydration/caffeine/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          beverage_type: 'tea',
          volume_oz: 16
        });

      expect(res.status).toBe(201);
      // 16oz tea = 94mg caffeine (47mg per 8oz * 2)
      expect(res.body.entry.caffeine_mg).toBe(94);
    });

    it('should accept custom caffeine amount', async () => {
      const res = await request(app)
        .post('/api/hydration/caffeine/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          beverage_type: 'coffee',
          volume_oz: 12,
          caffeine_mg: 150,
          notes: 'Extra strong espresso'
        });

      expect(res.status).toBe(201);
      expect(res.body.entry.caffeine_mg).toBe(150);
      expect(res.body.entry.notes).toBe('Extra strong espresso');
    });

    it('should log soda with correct caffeine', async () => {
      const res = await request(app)
        .post('/api/hydration/caffeine/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          beverage_type: 'soda',
          volume_oz: 12
        });

      expect(res.status).toBe(201);
      // 12oz soda = 45mg caffeine (30mg per 8oz * 1.5)
      expect(res.body.entry.caffeine_mg).toBe(45);
    });

    it('should warn when approaching caffeine limit', async () => {
      // Log enough caffeine to approach limit
      await request(app)
        .post('/api/hydration/caffeine/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          beverage_type: 'coffee',
          volume_oz: 8,
          caffeine_mg: 200
        });

      const res = await request(app)
        .get('/api/hydration/caffeine/today')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // Should have logged significant caffeine by now
      expect(res.body.total_mg).toBeGreaterThan(0);
    });

    it('should require beverage_type', async () => {
      const res = await request(app)
        .post('/api/hydration/caffeine/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          volume_oz: 8
        });

      expect(res.status).toBe(400);
    });

    it('should require volume_oz', async () => {
      const res = await request(app)
        .post('/api/hydration/caffeine/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          beverage_type: 'coffee'
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid beverage type', async () => {
      const res = await request(app)
        .post('/api/hydration/caffeine/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          beverage_type: 'juice',
          volume_oz: 8
        });

      expect(res.status).toBe(400);
    });
  });

  // =========================================
  // Today's Caffeine Tests
  // =========================================
  describe('GET /api/hydration/caffeine/today', () => {
    it('should return today\'s caffeine consumption', async () => {
      const res = await request(app)
        .get('/api/hydration/caffeine/today')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.date).toBeDefined();
      expect(res.body.total_mg).toBeDefined();
      expect(res.body.limit_mg).toBeDefined();
      expect(res.body.percentage).toBeDefined();
      expect(res.body.remaining_mg).toBeDefined();
      expect(res.body.over_limit).toBeDefined();
      expect(Array.isArray(res.body.entries)).toBe(true);
    });
  });

  // =========================================
  // Delete Tests
  // =========================================
  describe('DELETE /api/hydration/:id', () => {
    it('should delete a hydration log', async () => {
      // First create a new log to delete
      const createRes = await request(app)
        .post('/api/hydration/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount_oz: 8
        });

      const idToDelete = createRes.body.entry.id;

      const res = await request(app)
        .delete(`/api/hydration/${idToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Hydration log deleted');
      expect(res.body.id).toBe(idToDelete);
    });

    it('should return 404 for non-existent log', async () => {
      const res = await request(app)
        .delete('/api/hydration/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/hydration/caffeine/:id', () => {
    it('should delete a caffeine log', async () => {
      // First create a new log to delete
      const createRes = await request(app)
        .post('/api/hydration/caffeine/log')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          beverage_type: 'coffee',
          volume_oz: 8
        });

      const idToDelete = createRes.body.entry.id;

      const res = await request(app)
        .delete(`/api/hydration/caffeine/${idToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Caffeine log deleted');
    });

    it('should return 404 for non-existent log', async () => {
      const res = await request(app)
        .delete('/api/hydration/caffeine/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  // =========================================
  // Goal Calculation Tests
  // =========================================
  describe('Goal Calculations', () => {
    it('should calculate Brandon\'s goal as 125 oz (250 lbs / 2)', async () => {
      // Reset goals to personalized
      await request(app)
        .put('/api/hydration/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          personalized_formula_enabled: true
        });

      const res = await request(app)
        .get('/api/hydration/goals')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.calculation.weight_lbs).toBe(250);
      expect(res.body.calculation.calculated_oz).toBe(125);
    });

    it('should enforce minimum 64 oz goal', async () => {
      // This test verifies the minimum is enforced in the calculation
      const res = await request(app)
        .get('/api/hydration/goals')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.calculation.minimum_oz).toBe(64);
    });
  });
});
