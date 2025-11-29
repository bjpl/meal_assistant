/**
 * A/B Testing Service
 * Manages template A/B tests with automatic winner selection
 */

import { v4 as uuidv4 } from 'uuid';
import { createABTest, TemplateStatus, ABTest, ABTestConfig, ABTestAnalysis, RolloutConfig } from './templateTypes';
import templateService from './templateService';

// In-memory storage for A/B tests
const abTestStore = new Map<string, ABTest>();
const activeTestsByStore = new Map<string, string>(); // storeId -> activeTestId

/**
 * Test result interface
 */
interface ExtractionResult {
  success: boolean;
  accuracy?: number;
}

/**
 * Record result response
 */
interface RecordResultResponse {
  test: ABTest;
  concluded: boolean;
}

/**
 * Conclusion result
 */
interface ConclusionResult {
  test_id: string;
  winner: 'control' | 'variant';
  winning_template_id: string;
  analysis: ABTestAnalysis;
  concluded_at: string;
}

/**
 * Test options
 */
interface TestOptions {
  status?: 'pending' | 'running' | 'completed' | 'cancelled';
}

/**
 * ABTestService class for managing template A/B tests
 */
class ABTestService {
  /**
   * Create a new A/B test
   */
  async createTest(
    controlTemplateId: string,
    variantTemplateId: string,
    config: ABTestConfig = {}
  ): Promise<ABTest> {
    // Validate both templates exist
    const control = await templateService.getTemplate(controlTemplateId);
    const variant = await templateService.getTemplate(variantTemplateId);

    if (!control) {
      throw new Error(`Control template not found: ${controlTemplateId}`);
    }
    if (!variant) {
      throw new Error(`Variant template not found: ${variantTemplateId}`);
    }

    // Verify both are for same store
    if (control.store_id !== variant.store_id) {
      throw new Error('Control and variant must be for the same store');
    }

    // Check for existing active test on this store
    const existingTestId = activeTestsByStore.get(control.store_id);
    if (existingTestId) {
      const existing = abTestStore.get(existingTestId);
      if (existing && (existing.status === 'running' || existing.status === 'pending')) {
        throw new Error(`Active A/B test already exists for store: ${control.store_id}`);
      }
    }

    // Create the test
    const test = createABTest(controlTemplateId, variantTemplateId, {
      ...config,
      store_id: control.store_id
    } as ABTestConfig);

    abTestStore.set(test.id, test);

    return test;
  }

  /**
   * Start an A/B test
   */
  async startTest(testId: string): Promise<ABTest> {
    const test = abTestStore.get(testId);
    if (!test) {
      throw new Error(`A/B test not found: ${testId}`);
    }

    if (test.status !== 'pending') {
      throw new Error(`Test cannot be started, current status: ${test.status}`);
    }

    // Get templates to update their status
    const control = await templateService.getTemplate(test.control_template_id);
    const variant = await templateService.getTemplate(test.variant_template_id);

    if (control) {
      control.status = TemplateStatus.TESTING;
      await templateService.shareTemplate(control.id, control.is_public);
    }
    if (variant) {
      variant.status = TemplateStatus.TESTING;
      await templateService.shareTemplate(variant.id, variant.is_public);
    }

    // Update test status
    test.status = 'running';
    test.started_at = new Date().toISOString();
    if (!test.store_id && control) {
      test.store_id = control.store_id;
    }
    abTestStore.set(testId, test);

    // Register as active test for store
    if (test.store_id) {
      activeTestsByStore.set(test.store_id, testId);
    }

    return test;
  }

  /**
   * Route an ad to either control or variant based on traffic split
   */
  async routeAd(storeId: string): Promise<{
    test_id: string;
    template_id: string;
    group: 'control' | 'variant';
  } | null> {
    const testId = activeTestsByStore.get(storeId);
    if (!testId) {
      return null;
    }

    const test = abTestStore.get(testId);
    if (!test || test.status !== 'running') {
      return null;
    }

    // Determine which template to use based on traffic split
    const useVariant = Math.random() < test.traffic_split;

    return {
      test_id: test.id,
      template_id: useVariant ? test.variant_template_id : test.control_template_id,
      group: useVariant ? 'variant' : 'control'
    };
  }

  /**
   * Record extraction result for A/B test
   */
  async recordResult(
    testId: string,
    group: 'control' | 'variant',
    result: ExtractionResult
  ): Promise<RecordResultResponse> {
    const test = abTestStore.get(testId);
    if (!test) {
      throw new Error(`A/B test not found: ${testId}`);
    }

    if (test.status !== 'running') {
      throw new Error('Test is not running');
    }

    const results = group === 'variant' ? test.variant_results : test.control_results;

    results.impressions++;

    if (result.success) {
      results.successful_extractions++;
    }

    if (result.accuracy !== undefined && result.accuracy !== null) {
      results.accuracy_sum += result.accuracy;
      results.avg_accuracy = results.accuracy_sum / results.impressions;
    }

    abTestStore.set(testId, test);

    // Check if we should conclude the test
    const shouldConclude = await this.checkTestCompletion(testId);

    return {
      test,
      concluded: shouldConclude
    };
  }

  /**
   * Check if test should be concluded based on sample size
   */
  async checkTestCompletion(testId: string): Promise<boolean> {
    const test = abTestStore.get(testId);
    if (!test) return false;

    const minSamples = test.min_sample_size;
    const controlCount = test.control_results.impressions;
    const variantCount = test.variant_results.impressions;

    // Check if both groups have minimum samples
    if (controlCount >= minSamples && variantCount >= minSamples) {
      await this.concludeTest(testId);
      return true;
    }

    return false;
  }

  /**
   * Conclude A/B test and determine winner
   */
  async concludeTest(testId: string): Promise<ConclusionResult> {
    const test = abTestStore.get(testId);
    if (!test) {
      throw new Error(`A/B test not found: ${testId}`);
    }

    if (test.status !== 'running') {
      throw new Error('Test is not running');
    }

    // Calculate statistical significance
    const analysis = this.analyzeResults(test);

    // Determine winner
    let winner: 'control' | 'variant';
    let winningTemplateId: string;

    if (analysis.significant) {
      if (analysis.variant_better) {
        winner = 'variant';
        winningTemplateId = test.variant_template_id;
      } else {
        winner = 'control';
        winningTemplateId = test.control_template_id;
      }
    } else {
      // No significant difference, keep control
      winner = 'control';
      winningTemplateId = test.control_template_id;
    }

    // Update test
    test.status = 'completed';
    test.winner = winner;
    test.winning_template_id = winningTemplateId;
    test.completed_at = new Date().toISOString();
    test.analysis = analysis;
    abTestStore.set(testId, test);

    // Remove from active tests
    if (test.store_id) {
      activeTestsByStore.delete(test.store_id);
    }

    // Update template statuses
    await this.applyTestResults(test);

    return {
      test_id: testId,
      winner,
      winning_template_id: winningTemplateId,
      analysis,
      concluded_at: test.completed_at
    };
  }

  /**
   * Analyze A/B test results for statistical significance
   */
  analyzeResults(test: ABTest): ABTestAnalysis {
    const control = test.control_results;
    const variant = test.variant_results;

    // Calculate success rates
    const controlRate = control.impressions > 0
      ? control.successful_extractions / control.impressions
      : 0;
    const variantRate = variant.impressions > 0
      ? variant.successful_extractions / variant.impressions
      : 0;

    // Calculate accuracy difference
    const accuracyDiff = (variant.avg_accuracy || 0) - (control.avg_accuracy || 0);
    const successRateDiff = variantRate - controlRate;

    // Simplified statistical significance check
    const totalSamples = control.impressions + variant.impressions;
    const pooledRate = (control.successful_extractions + variant.successful_extractions) / totalSamples;

    // Standard error calculation
    const se = Math.sqrt(
      pooledRate * (1 - pooledRate) * (1/control.impressions + 1/variant.impressions)
    );

    // Z-score
    const zScore = se > 0 ? successRateDiff / se : 0;

    // For 95% confidence, z > 1.96
    const significant = Math.abs(zScore) > 1.96;
    const confidenceLevel = this.zToConfidence(Math.abs(zScore));

    return {
      control: {
        impressions: control.impressions,
        success_rate: controlRate,
        avg_accuracy: control.avg_accuracy
      },
      variant: {
        impressions: variant.impressions,
        success_rate: variantRate,
        avg_accuracy: variant.avg_accuracy
      },
      success_rate_diff: successRateDiff,
      accuracy_diff: accuracyDiff,
      z_score: zScore,
      significant,
      confidence_level: confidenceLevel,
      variant_better: variantRate > controlRate ||
        (variantRate === controlRate && (variant.avg_accuracy || 0) > (control.avg_accuracy || 0))
    };
  }

  /**
   * Convert z-score to confidence level
   */
  zToConfidence(z: number): number {
    if (z >= 2.576) return 0.99;
    if (z >= 1.96) return 0.95;
    if (z >= 1.645) return 0.90;
    if (z >= 1.28) return 0.80;
    return 0.5 + (z / 4); // Rough approximation for lower values
  }

  /**
   * Apply test results by updating template statuses
   */
  async applyTestResults(test: ABTest): Promise<void> {
    const control = await templateService.getTemplate(test.control_template_id);
    const variant = await templateService.getTemplate(test.variant_template_id);

    if (test.winner === 'variant') {
      // Variant wins: activate variant, deprecate control
      if (variant) {
        variant.status = TemplateStatus.ACTIVE;
      }
      if (control) {
        control.status = TemplateStatus.DEPRECATED;
      }
    } else {
      // Control wins: keep control active, archive variant
      if (control) {
        control.status = TemplateStatus.ACTIVE;
      }
      if (variant) {
        variant.status = TemplateStatus.ARCHIVED;
      }
    }
  }

  /**
   * Cancel an A/B test
   */
  async cancelTest(testId: string): Promise<ABTest> {
    const test = abTestStore.get(testId);
    if (!test) {
      throw new Error(`A/B test not found: ${testId}`);
    }

    if (test.status === 'completed') {
      throw new Error('Cannot cancel completed test');
    }

    test.status = 'cancelled';
    test.completed_at = new Date().toISOString();
    abTestStore.set(testId, test);

    // Remove from active tests
    if (test.store_id) {
      activeTestsByStore.delete(test.store_id);
    }

    // Restore original template statuses
    const control = await templateService.getTemplate(test.control_template_id);
    if (control) {
      control.status = TemplateStatus.ACTIVE;
    }

    return test;
  }

  /**
   * Get A/B test by ID
   */
  async getTest(testId: string): Promise<ABTest | null> {
    return abTestStore.get(testId) || null;
  }

  /**
   * Get all tests for a store
   */
  async getTestsByStore(storeId: string, options: TestOptions = {}): Promise<ABTest[]> {
    const tests = Array.from(abTestStore.values())
      .filter(t => t.store_id === storeId);

    if (options.status) {
      return tests.filter(t => t.status === options.status);
    }

    return tests.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  /**
   * Get active test for a store
   */
  async getActiveTest(storeId: string): Promise<ABTest | null> {
    const testId = activeTestsByStore.get(storeId);
    return testId ? (abTestStore.get(testId) || null) : null;
  }

  /**
   * Get tests by user
   */
  async getTestsByUser(userId: string, options: TestOptions = {}): Promise<ABTest[]> {
    const tests = Array.from(abTestStore.values())
      .filter(t => t.created_by === userId);

    if (options.status) {
      return tests.filter(t => t.status === options.status);
    }

    return tests.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  /**
   * Gradual rollout of winning template
   */
  async createGradualRollout(
    testId: string,
    targetPercentage: number = 100,
    stepSize: number = 10
  ): Promise<RolloutConfig> {
    const test = abTestStore.get(testId);
    if (!test) {
      throw new Error(`A/B test not found: ${testId}`);
    }

    if (test.status !== 'completed' || !test.winning_template_id) {
      throw new Error('Test must be completed with a winner');
    }

    const rollout: RolloutConfig = {
      id: uuidv4(),
      test_id: testId,
      template_id: test.winning_template_id,
      store_id: test.store_id || '',
      target_percentage: targetPercentage,
      current_percentage: 0,
      step_size: stepSize,
      status: 'pending',
      steps: [],
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null
    };

    // Generate rollout steps
    for (let pct = stepSize; pct <= targetPercentage; pct += stepSize) {
      rollout.steps.push({
        percentage: Math.min(pct, targetPercentage),
        status: 'pending',
        scheduled_at: null,
        executed_at: null
      });
    }

    // Store rollout (in a real system this would be persisted)
    test.rollout = rollout;
    abTestStore.set(testId, test);

    return rollout;
  }

  /**
   * Execute next rollout step
   */
  async executeRolloutStep(testId: string): Promise<RolloutConfig> {
    const test = abTestStore.get(testId);
    if (!test || !test.rollout) {
      throw new Error('Rollout not found');
    }

    const rollout = test.rollout;
    const nextStep = rollout.steps.find(s => s.status === 'pending');

    if (!nextStep) {
      rollout.status = 'completed';
      rollout.completed_at = new Date().toISOString();
      abTestStore.set(testId, test);
      return rollout;
    }

    // Execute step
    nextStep.status = 'completed';
    nextStep.executed_at = new Date().toISOString();
    rollout.current_percentage = nextStep.percentage;

    if (rollout.status === 'pending') {
      rollout.status = 'in_progress';
      rollout.started_at = new Date().toISOString();
    }

    abTestStore.set(testId, test);
    return rollout;
  }

  /**
   * Clear all tests (for testing)
   */
  clearAll(): void {
    abTestStore.clear();
    activeTestsByStore.clear();
  }
}

// Export singleton instance
const abTestServiceInstance = new ABTestService();
export default abTestServiceInstance;
export { ABTestService, abTestStore };
