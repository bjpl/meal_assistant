/**
 * Seeders Unit Tests
 * Tests data seeding functionality
 */

import {
  seedPatterns,
  clearPatterns,
  verifyPatterns,
  getPatternById,
  getAllPatterns
} from '../../../../src/services/vector/seeders/patterns.seeder';

import {
  seedIngredients,
  clearIngredients,
  verifyIngredients,
  getIngredientById,
  getIngredientsByCategory,
  getAllIngredients
} from '../../../../src/services/vector/seeders/ingredients.seeder';

import {
  seedGraph,
  clearGraph,
  verifyGraph
} from '../../../../src/services/vector/seeders/graph.seeder';

import { ruVectorService } from '../../../../src/services/vector/core/ruvector.service';
import { graphService } from '../../../../src/services/vector/graph/graph.service';

describe('Seeders', () => {
  beforeAll(async () => {
    // Initialize services
    await ruVectorService.initialize();
    await graphService.initialize();
  });

  afterAll(async () => {
    // Clean up
    await clearGraph();
    await clearPatterns();
    await clearIngredients();
    await ruVectorService.close();
    await graphService.close();
  });

  describe('Pattern Seeder', () => {
    afterEach(async () => {
      await clearPatterns();
    });

    it('should seed all 7 meal patterns', async () => {
      await seedPatterns();

      const patterns = getAllPatterns();
      expect(patterns).toHaveLength(7);
      expect(patterns.map(p => p.id).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    });

    it('should create embeddings for each pattern', async () => {
      await seedPatterns();

      const patternA = await ruVectorService.get('meal_patterns', 'pattern_A');
      expect(patternA).toBeDefined();
      expect(patternA?.embedding).toBeInstanceOf(Array);
      expect(patternA?.embedding.length).toBe(384); // MiniLM embedding dimension
    });

    it('should store correct metadata', async () => {
      await seedPatterns();

      const patternC = await ruVectorService.get('meal_patterns', 'pattern_C');
      expect(patternC?.metadata.name).toBe('Intermittent Fasting');
      expect(patternC?.metadata.totalCalories).toBe(1800);
      expect(patternC?.metadata.mealsCount).toBe(2);
      expect(patternC?.metadata.tags).toContain('intermittent-fasting');
    });

    it('should verify seeded patterns', async () => {
      await seedPatterns();

      const verified = await verifyPatterns();
      expect(verified).toBe(true);
    });

    it('should get pattern by ID', () => {
      const pattern = getPatternById('D');
      expect(pattern).toBeDefined();
      expect(pattern?.name).toBe('Grazing - 4 Mini Meals');
    });

    it('should clear all patterns', async () => {
      await seedPatterns();
      await clearPatterns();

      const pattern = await ruVectorService.get('meal_patterns', 'pattern_A');
      expect(pattern).toBeNull();
    });
  });

  describe('Ingredient Seeder', () => {
    afterEach(async () => {
      await clearIngredients();
    });

    it('should seed multiple ingredients', async () => {
      await seedIngredients();

      const ingredients = getAllIngredients();
      expect(ingredients.length).toBeGreaterThan(30); // We have 35+ ingredients
    });

    it('should create embeddings for each ingredient', async () => {
      await seedIngredients();

      const chicken = await ruVectorService.get('ingredients', 'ingredient_chicken-breast');
      expect(chicken).toBeDefined();
      expect(chicken?.embedding).toBeInstanceOf(Array);
      expect(chicken?.embedding.length).toBe(384);
    });

    it('should store nutritional data', async () => {
      await seedIngredients();

      const salmon = await ruVectorService.get('ingredients', 'ingredient_salmon');
      expect(salmon?.metadata.calories).toBe(208);
      expect(salmon?.metadata.protein).toBe(20);
      expect(salmon?.metadata.fat).toBe(13);
      expect(salmon?.metadata.category).toBe('protein');
    });

    it('should categorize ingredients correctly', () => {
      const proteins = getIngredientsByCategory('protein');
      const vegetables = getIngredientsByCategory('vegetable');
      const carbs = getIngredientsByCategory('carb');

      expect(proteins.length).toBeGreaterThan(0);
      expect(vegetables.length).toBeGreaterThan(0);
      expect(carbs.length).toBeGreaterThan(0);

      proteins.forEach(p => expect(p.category).toBe('protein'));
      vegetables.forEach(v => expect(v.category).toBe('vegetable'));
      carbs.forEach(c => expect(c.category).toBe('carb'));
    });

    it('should verify seeded ingredients', async () => {
      await seedIngredients();

      const verified = await verifyIngredients();
      expect(verified).toBe(true);
    });

    it('should get ingredient by ID', () => {
      const tofu = getIngredientById('tofu');
      expect(tofu).toBeDefined();
      expect(tofu?.name).toBe('Tofu');
      expect(tofu?.tags).toContain('vegetarian');
    });

    it('should clear all ingredients', async () => {
      await seedIngredients();
      await clearIngredients();

      const chicken = await ruVectorService.get('ingredients', 'ingredient_chicken-breast');
      expect(chicken).toBeNull();
    });
  });

  describe('Graph Seeder', () => {
    afterEach(async () => {
      await clearGraph();
    });

    it('should seed knowledge graph', async () => {
      await seedGraph();

      const stats = await graphService.getStats();
      expect(stats.totalNodes).toBeGreaterThan(0);
      expect(stats.totalEdges).toBeGreaterThan(0);
    });

    it('should create ingredient nodes', async () => {
      await seedGraph();

      const chickenNode = await graphService.getNode('chicken-breast');
      expect(chickenNode).toBeDefined();
      expect(chickenNode?.type).toBe('Ingredient');
      expect(chickenNode?.properties.name).toBe('Chicken Breast');
    });

    it('should create pattern nodes', async () => {
      await seedGraph();

      const patternNode = await graphService.getNode('pattern_A');
      expect(patternNode).toBeDefined();
      expect(patternNode?.type).toBe('MealPattern');
      expect(patternNode?.properties.name).toBe('Traditional');
    });

    it('should create substitution relationships', async () => {
      await seedGraph();

      const substitutions = await graphService.findSubstitutions('chicken-breast');
      expect(substitutions.length).toBeGreaterThan(0);

      const turkeySubstitution = substitutions.find(s => s.toId === 'turkey-breast');
      expect(turkeySubstitution).toBeDefined();
      expect(turkeySubstitution?.score).toBeGreaterThan(0.8);
    });

    it('should create pattern-ingredient relationships', async () => {
      await seedGraph();

      const patternIngredients = await graphService.findPath('chicken-breast', 'pattern_A');
      expect(patternIngredients).toBeDefined();
      expect(patternIngredients?.path.length).toBeGreaterThan(0);
    });

    it('should create flavor pairings', async () => {
      await seedGraph();

      const pairings = await graphService.getPairings('chicken-breast');
      expect(pairings.length).toBeGreaterThan(0);

      const broccoliPairing = pairings.find(p => p.ingredient === 'broccoli');
      expect(broccoliPairing).toBeDefined();
    });

    it('should verify graph structure', async () => {
      await seedGraph();

      const verified = await verifyGraph();
      expect(verified).toBe(true);
    });

    it('should clear graph', async () => {
      await seedGraph();

      const statsBefore = await graphService.getStats();
      expect(statsBefore.totalNodes).toBeGreaterThan(0);

      await clearGraph();

      const statsAfter = await graphService.getStats();
      expect(statsAfter.totalNodes).toBe(0);
      expect(statsAfter.totalEdges).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should seed all data sources together', async () => {
      await seedPatterns();
      await seedIngredients();
      await seedGraph();

      const patternsVerified = await verifyPatterns();
      const ingredientsVerified = await verifyIngredients();
      const graphVerified = await verifyGraph();

      expect(patternsVerified).toBe(true);
      expect(ingredientsVerified).toBe(true);
      expect(graphVerified).toBe(true);
    });

    it('should support semantic search across patterns', async () => {
      await seedPatterns();

      const results = await ruVectorService.search('meal_patterns', {
        text: 'intermittent fasting skip breakfast',
        topK: 3
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.id).toBe('C'); // Pattern C is IF
    });

    it('should support semantic search across ingredients', async () => {
      await seedIngredients();

      const results = await ruVectorService.search('ingredients', {
        text: 'high protein lean poultry',
        topK: 5
      });

      expect(results.length).toBeGreaterThan(0);

      const topResults = results.slice(0, 2).map(r => r.metadata.id);
      expect(topResults).toContain('chicken-breast');
    });

    it('should support graph traversal for substitutions', async () => {
      await seedGraph();

      const path = await graphService.findPath('chicken-breast', 'tofu');
      expect(path).toBeDefined();
      expect(path?.path.length).toBeGreaterThan(0);
    });
  });
});
