/**
 * A/B Test Service Tests
 * Tests for A/B testing functionality
 */

const abTestService = require('../../../src/api/services/templates/abTestService');
const templateService = require('../../../src/api/services/templates/templateService');
const { TemplateStatus } = require('../../../src/api/services/templates/templateTypes');

describe('ABTestService', () => {
  let controlTemplate, variantTemplate;

  beforeEach(async () => {
    templateService.clearAll();
    abTestService.clearAll();

    // Create test templates
    controlTemplate = await templateService.createTemplate('user-1', 'store-1', {
      name: 'Control Template',
      examples: [{ price_text: '$1' }, { price_text: '$2' }, { price_text: '$3' }]
    });
    controlTemplate.status = TemplateStatus.ACTIVE;

    variantTemplate = await templateService.createTemplate('user-1', 'store-1', {
      name: 'Variant Template',
      examples: [{ price_text: '$4' }, { price_text: '$5' }, { price_text: '$6' }]
    });
  });

  describe('createTest', () => {
    it('should create an A/B test', async () => {
      const test = await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        {
          name: 'Test Experiment',
          user_id: 'user-1',
          min_sample_size: 50
        }
      );

      expect(test).toBeDefined();
      expect(test.id).toBeDefined();
      expect(test.control_template_id).toBe(controlTemplate.id);
      expect(test.variant_template_id).toBe(variantTemplate.id);
      expect(test.status).toBe('pending');
      expect(test.traffic_split).toBe(0.5);
    });

    it('should reject test with templates from different stores', async () => {
      const otherStoreTemplate = await templateService.createTemplate('user-1', 'other-store', {
        examples: [{ price_text: '$1' }, { price_text: '$2' }, { price_text: '$3' }]
      });

      await expect(
        abTestService.createTest(controlTemplate.id, otherStoreTemplate.id)
      ).rejects.toThrow('same store');
    });

    it('should reject if active test exists for store', async () => {
      // Create and start first test
      const test1 = await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        { user_id: 'user-1' }
      );
      await abTestService.startTest(test1.id);

      // Create new variant for second test
      const variant2 = await templateService.createTemplate('user-1', 'store-1', {
        examples: [{ price_text: '$7' }, { price_text: '$8' }, { price_text: '$9' }]
      });

      // Should reject because test1 is running
      await expect(
        abTestService.createTest(controlTemplate.id, variant2.id, { user_id: 'user-1' })
      ).rejects.toThrow('Active A/B test already exists');
    });
  });

  describe('startTest', () => {
    it('should start a pending test', async () => {
      const test = await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        { user_id: 'user-1' }
      );

      const started = await abTestService.startTest(test.id);

      expect(started.status).toBe('running');
      expect(started.started_at).toBeDefined();
    });

    it('should update template statuses to testing', async () => {
      const test = await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        { user_id: 'user-1' }
      );

      await abTestService.startTest(test.id);

      const control = await templateService.getTemplate(controlTemplate.id);
      const variant = await templateService.getTemplate(variantTemplate.id);

      expect(control.status).toBe(TemplateStatus.TESTING);
      expect(variant.status).toBe(TemplateStatus.TESTING);
    });

    it('should reject starting non-pending test', async () => {
      const test = await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        { user_id: 'user-1' }
      );
      await abTestService.startTest(test.id);

      await expect(
        abTestService.startTest(test.id)
      ).rejects.toThrow('cannot be started');
    });
  });

  describe('routeAd', () => {
    it('should return null when no active test', async () => {
      const routing = await abTestService.routeAd('store-1');
      expect(routing).toBeNull();
    });

    it('should route to control or variant based on split', async () => {
      const test = await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        { user_id: 'user-1' }
      );
      await abTestService.startTest(test.id);

      // Run many routing decisions
      const results = { control: 0, variant: 0 };
      for (let i = 0; i < 100; i++) {
        const routing = await abTestService.routeAd('store-1');
        if (routing && routing.group) {
          results[routing.group]++;
        }
      }

      // Should be roughly 50/50
      expect(results.control).toBeGreaterThan(20);
      expect(results.variant).toBeGreaterThan(20);
    });
  });

  describe('recordResult', () => {
    let test;

    beforeEach(async () => {
      test = await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        { user_id: 'user-1', min_sample_size: 10 }
      );
      await abTestService.startTest(test.id);
    });

    it('should record results for control group', async () => {
      const result = await abTestService.recordResult(test.id, 'control', {
        success: true,
        accuracy: 0.85
      });

      expect(result.test.control_results.impressions).toBe(1);
      expect(result.test.control_results.successful_extractions).toBe(1);
      expect(result.test.control_results.avg_accuracy).toBe(0.85);
    });

    it('should record results for variant group', async () => {
      const result = await abTestService.recordResult(test.id, 'variant', {
        success: true,
        accuracy: 0.90
      });

      expect(result.test.variant_results.impressions).toBe(1);
    });

    it('should auto-conclude when min samples reached', async () => {
      // Record enough samples for both groups
      for (let i = 0; i < 10; i++) {
        await abTestService.recordResult(test.id, 'control', {
          success: true,
          accuracy: 0.80
        });
      }

      for (let i = 0; i < 9; i++) {
        await abTestService.recordResult(test.id, 'variant', {
          success: true,
          accuracy: 0.85
        });
      }

      // This should trigger conclusion
      const result = await abTestService.recordResult(test.id, 'variant', {
        success: true,
        accuracy: 0.85
      });

      expect(result.concluded).toBe(true);
    });
  });

  describe('concludeTest', () => {
    let test;

    beforeEach(async () => {
      test = await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        { user_id: 'user-1' }
      );
      await abTestService.startTest(test.id);
    });

    it('should conclude test and determine winner', async () => {
      // Add some results
      for (let i = 0; i < 50; i++) {
        await abTestService.recordResult(test.id, 'control', {
          success: Math.random() > 0.3,
          accuracy: 0.75 + Math.random() * 0.1
        });
        await abTestService.recordResult(test.id, 'variant', {
          success: Math.random() > 0.2,
          accuracy: 0.80 + Math.random() * 0.1
        });
      }

      const result = await abTestService.concludeTest(test.id);

      expect(result.winner).toBeDefined();
      expect(result.winning_template_id).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.analysis.significant).toBeDefined();
    });

    it('should reject concluding non-running test', async () => {
      await abTestService.cancelTest(test.id);

      await expect(
        abTestService.concludeTest(test.id)
      ).rejects.toThrow('not running');
    });
  });

  describe('cancelTest', () => {
    it('should cancel a running test', async () => {
      const test = await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        { user_id: 'user-1' }
      );
      await abTestService.startTest(test.id);

      const cancelled = await abTestService.cancelTest(test.id);

      expect(cancelled.status).toBe('cancelled');
    });

    it('should restore control template status', async () => {
      const test = await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        { user_id: 'user-1' }
      );
      await abTestService.startTest(test.id);
      await abTestService.cancelTest(test.id);

      const control = await templateService.getTemplate(controlTemplate.id);
      expect(control.status).toBe(TemplateStatus.ACTIVE);
    });
  });

  describe('analyzeResults', () => {
    it('should calculate statistical significance', async () => {
      const test = await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        { user_id: 'user-1' }
      );
      await abTestService.startTest(test.id);

      // Add significant difference in results
      for (let i = 0; i < 100; i++) {
        await abTestService.recordResult(test.id, 'control', {
          success: Math.random() > 0.5,
          accuracy: 0.70
        });
        await abTestService.recordResult(test.id, 'variant', {
          success: Math.random() > 0.2,
          accuracy: 0.90
        });
      }

      const updatedTest = await abTestService.getTest(test.id);
      const analysis = abTestService.analyzeResults(updatedTest);

      expect(analysis.control.impressions).toBe(100);
      expect(analysis.variant.impressions).toBe(100);
      expect(analysis.variant_better).toBe(true);
    });
  });

  describe('gradual rollout', () => {
    it('should create gradual rollout configuration', async () => {
      const test = await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        { user_id: 'user-1' }
      );
      await abTestService.startTest(test.id);

      // Manually set winner for testing
      const testObj = await abTestService.getTest(test.id);
      testObj.status = 'completed';
      testObj.winner = 'variant';
      testObj.winning_template_id = variantTemplate.id;

      const rollout = await abTestService.createGradualRollout(test.id, 100, 20);

      expect(rollout.target_percentage).toBe(100);
      expect(rollout.step_size).toBe(20);
      expect(rollout.steps.length).toBe(5);
      expect(rollout.steps[0].percentage).toBe(20);
      expect(rollout.steps[4].percentage).toBe(100);
    });

    it('should execute rollout steps', async () => {
      const test = await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        { user_id: 'user-1' }
      );
      await abTestService.startTest(test.id);

      const testObj = await abTestService.getTest(test.id);
      testObj.status = 'completed';
      testObj.winner = 'variant';
      testObj.winning_template_id = variantTemplate.id;

      await abTestService.createGradualRollout(test.id, 100, 25);

      // Execute first step
      const rollout1 = await abTestService.executeRolloutStep(test.id);
      expect(rollout1.current_percentage).toBe(25);
      expect(rollout1.status).toBe('in_progress');

      // Execute remaining steps
      await abTestService.executeRolloutStep(test.id);
      await abTestService.executeRolloutStep(test.id);
      await abTestService.executeRolloutStep(test.id);
      // After 4 steps (25, 50, 75, 100), need one more call to complete
      const finalRollout = await abTestService.executeRolloutStep(test.id);

      expect(finalRollout.status).toBe('completed');
      expect(finalRollout.current_percentage).toBe(100);
    });
  });

  describe('getters', () => {
    it('should get active test for store', async () => {
      // Clear any previous tests
      abTestService.clearAll();
      templateService.clearAll();

      // Recreate templates for this test
      const control = await templateService.createTemplate('user-1', 'store-1', {
        name: 'Control Template',
        examples: [{ price_text: '$1' }, { price_text: '$2' }, { price_text: '$3' }]
      });
      control.status = TemplateStatus.ACTIVE;

      const variant = await templateService.createTemplate('user-1', 'store-1', {
        name: 'Variant Template',
        examples: [{ price_text: '$4' }, { price_text: '$5' }, { price_text: '$6' }]
      });

      const test = await abTestService.createTest(
        control.id,
        variant.id,
        { user_id: 'user-1' }
      );
      await abTestService.startTest(test.id);

      const active = await abTestService.getActiveTest('store-1');

      expect(active).toBeDefined();
      expect(active.id).toBe(test.id);
    });

    it('should get tests by user', async () => {
      await abTestService.createTest(
        controlTemplate.id,
        variantTemplate.id,
        { user_id: 'user-1' }
      );

      const tests = await abTestService.getTestsByUser('user-1');

      expect(tests.length).toBe(1);
    });
  });
});
