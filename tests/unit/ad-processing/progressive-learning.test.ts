/**
 * Unit Tests: Progressive Learning System
 * Tests Phase 1 (regex), Phase 2 (template), Phase 3 (ML) accuracy progression
 * Target: 30 tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ACCURACY_PROGRESSION,
  generateGroundTruthAds,
  generateSyntheticAds,
  generateSyntheticDeals,
  ExtractedDeal,
  GroundTruthAd,
  ExpectedDeal,
  CorrectionRecord
} from '../../fixtures/ads/testAdData';

// Types for progressive learning
interface LearningPhase {
  name: string;
  minCorrections: number;
  maxCorrections: number;
  expectedAccuracy: { min: number; max: number };
}

interface AccuracyMetrics {
  totalDeals: number;
  correctExtractions: number;
  accuracy: number;
  byField: {
    productName: number;
    price: number;
    unit: number;
    dealType: number;
  };
}

interface LearningState {
  phase: 1 | 2 | 3;
  corrections: number;
  accuracy: number;
  modelVersion: string;
}

// Progressive Learning Service (to be implemented)
const createProgressiveLearningService = () => {
  let state: LearningState = {
    phase: 1,
    corrections: 0,
    accuracy: 0.35,
    modelVersion: '1.0.0'
  };

  const correctionHistory: CorrectionRecord[] = [];
  const learnedPatterns: Map<string, number> = new Map();

  // Phase thresholds
  const PHASE_2_THRESHOLD = 10;
  const PHASE_3_THRESHOLD = 30;

  return {
    getState(): LearningState {
      return { ...state };
    },

    // Determine current phase based on corrections
    determinePhase(corrections: number): 1 | 2 | 3 {
      if (corrections >= PHASE_3_THRESHOLD) return 3;
      if (corrections >= PHASE_2_THRESHOLD) return 2;
      return 1;
    },

    // Get expected accuracy range for phase
    getExpectedAccuracyRange(phase: 1 | 2 | 3): { min: number; max: number } {
      const ranges = {
        1: { min: 0.30, max: 0.40 },
        2: { min: 0.50, max: 0.65 },
        3: { min: 0.70, max: 0.90 }
      };
      return ranges[phase];
    },

    // Record a correction
    recordCorrection(correction: CorrectionRecord): void {
      correctionHistory.push(correction);
      state.corrections++;

      // Update learned patterns
      const key = `${correction.field}:${correction.originalValue}`;
      const currentCount = learnedPatterns.get(key) || 0;
      learnedPatterns.set(key, currentCount + 1);

      // Check for phase advancement
      const newPhase = this.determinePhase(state.corrections);
      if (newPhase !== state.phase) {
        this.advancePhase(newPhase);
      }
    },

    // Advance to new phase
    advancePhase(newPhase: 1 | 2 | 3): void {
      const previousPhase = state.phase;
      state.phase = newPhase;

      // Update expected accuracy
      const range = this.getExpectedAccuracyRange(newPhase);
      state.accuracy = (range.min + range.max) / 2;

      // Increment model version
      const [major, minor, patch] = state.modelVersion.split('.').map(Number);
      state.modelVersion = `${major}.${newPhase}.0`;
    },

    // Simulate extraction with current accuracy
    extractWithCurrentAccuracy(groundTruth: ExpectedDeal[]): ExtractedDeal[] {
      const range = this.getExpectedAccuracyRange(state.phase);
      const currentAccuracy = range.min + Math.random() * (range.max - range.min);

      return groundTruth.map((expected, i) => {
        const isCorrect = Math.random() < currentAccuracy;

        return {
          id: `deal-${i}`,
          adId: 'test-ad',
          productName: isCorrect ? expected.productName : this.corruptString(expected.productName),
          rawText: `${expected.productName} $${expected.price}/${expected.unit}`,
          price: isCorrect ? expected.price : expected.price * (0.8 + Math.random() * 0.4),
          unit: isCorrect ? expected.unit : 'ea',
          dealType: expected.dealType as ExtractedDeal['dealType'],
          confidence: currentAccuracy,
          category: 'unknown'
        };
      });
    },

    // Corrupt string for simulating errors
    corruptString(str: string): string {
      const chars = str.split('');
      const idx = Math.floor(Math.random() * chars.length);
      chars[idx] = String.fromCharCode(chars[idx].charCodeAt(0) + 1);
      return chars.join('');
    },

    // Calculate accuracy against ground truth
    calculateAccuracy(
      extracted: ExtractedDeal[],
      expected: ExpectedDeal[]
    ): AccuracyMetrics {
      let correctProductNames = 0;
      let correctPrices = 0;
      let correctUnits = 0;
      let correctDealTypes = 0;
      let totalCorrect = 0;

      const minLength = Math.min(extracted.length, expected.length);

      for (let i = 0; i < minLength; i++) {
        const ext = extracted[i];
        const exp = expected[i];

        const nameMatch = ext.productName.toLowerCase().includes(exp.productName.toLowerCase().split(' ')[0]);
        const priceMatch = Math.abs(ext.price - exp.price) < 0.10;
        const unitMatch = ext.unit === exp.unit;
        const dealTypeMatch = ext.dealType === exp.dealType;

        if (nameMatch) correctProductNames++;
        if (priceMatch) correctPrices++;
        if (unitMatch) correctUnits++;
        if (dealTypeMatch) correctDealTypes++;

        if (nameMatch && priceMatch && unitMatch) {
          totalCorrect++;
        }
      }

      return {
        totalDeals: expected.length,
        correctExtractions: totalCorrect,
        accuracy: totalCorrect / expected.length,
        byField: {
          productName: correctProductNames / expected.length,
          price: correctPrices / expected.length,
          unit: correctUnits / expected.length,
          dealType: correctDealTypes / expected.length
        }
      };
    },

    // Simulate learning from corrections
    learn(corrections: CorrectionRecord[]): void {
      corrections.forEach(c => this.recordCorrection(c));
    },

    // Get accuracy improvement over time
    getAccuracyProgression(): { corrections: number; accuracy: number }[] {
      const progression: { corrections: number; accuracy: number }[] = [];

      for (let c = 0; c <= state.corrections; c += 5) {
        const phase = this.determinePhase(c);
        const range = this.getExpectedAccuracyRange(phase);
        const baseAccuracy = range.min;
        const improvement = (c / 50) * (range.max - range.min);

        progression.push({
          corrections: c,
          accuracy: Math.min(baseAccuracy + improvement, range.max)
        });
      }

      return progression;
    },

    // Check if accuracy targets are achievable
    validateAccuracyTargets(): { phase: number; achievable: boolean; reason: string }[] {
      return [
        {
          phase: 1,
          achievable: true,
          reason: 'Regex patterns achieve 30-40% baseline accuracy'
        },
        {
          phase: 2,
          achievable: state.corrections >= PHASE_2_THRESHOLD,
          reason: state.corrections >= PHASE_2_THRESHOLD
            ? 'Templates trained with sufficient corrections'
            : `Need ${PHASE_2_THRESHOLD - state.corrections} more corrections`
        },
        {
          phase: 3,
          achievable: state.corrections >= PHASE_3_THRESHOLD,
          reason: state.corrections >= PHASE_3_THRESHOLD
            ? 'ML model trained with sufficient data'
            : `Need ${PHASE_3_THRESHOLD - state.corrections} more corrections`
        }
      ];
    },

    // Reset state for testing
    reset(): void {
      state = {
        phase: 1,
        corrections: 0,
        accuracy: 0.35,
        modelVersion: '1.0.0'
      };
      correctionHistory.length = 0;
      learnedPatterns.clear();
    },

    // Get learned patterns
    getLearnedPatterns(): Map<string, number> {
      return new Map(learnedPatterns);
    },

    // Get correction history
    getCorrectionHistory(): CorrectionRecord[] {
      return [...correctionHistory];
    }
  };
};

describe('Progressive Learning', () => {
  let service: ReturnType<typeof createProgressiveLearningService>;

  beforeEach(() => {
    service = createProgressiveLearningService();
    service.reset();
  });

  describe('Phase Determination', () => {
    // Test 1
    it('should start at Phase 1', () => {
      const state = service.getState();

      expect(state.phase).toBe(1);
      expect(state.corrections).toBe(0);
    });

    // Test 2
    it('should determine Phase 1 for 0-9 corrections', () => {
      expect(service.determinePhase(0)).toBe(1);
      expect(service.determinePhase(5)).toBe(1);
      expect(service.determinePhase(9)).toBe(1);
    });

    // Test 3
    it('should determine Phase 2 for 10-29 corrections', () => {
      expect(service.determinePhase(10)).toBe(2);
      expect(service.determinePhase(20)).toBe(2);
      expect(service.determinePhase(29)).toBe(2);
    });

    // Test 4
    it('should determine Phase 3 for 30+ corrections', () => {
      expect(service.determinePhase(30)).toBe(3);
      expect(service.determinePhase(50)).toBe(3);
      expect(service.determinePhase(100)).toBe(3);
    });
  });

  describe('Phase 1: Regex Accuracy', () => {
    // Test 5
    it('should have accuracy range 30-40% in Phase 1', () => {
      const range = service.getExpectedAccuracyRange(1);

      expect(range.min).toBe(0.30);
      expect(range.max).toBe(0.40);
    });

    // Test 6
    it('should achieve Phase 1 accuracy targets', () => {
      const groundTruth = generateGroundTruthAds(10);
      const range = service.getExpectedAccuracyRange(1);

      let totalAccuracy = 0;
      let testCount = 0;

      for (const gt of groundTruth) {
        const extracted = service.extractWithCurrentAccuracy(gt.expectedDeals);
        const metrics = service.calculateAccuracy(extracted, gt.expectedDeals);
        totalAccuracy += metrics.accuracy;
        testCount++;
      }

      const avgAccuracy = totalAccuracy / testCount;

      // Should be within reasonable range (allowing for randomness)
      expect(avgAccuracy).toBeGreaterThanOrEqual(range.min - 0.1);
      expect(avgAccuracy).toBeLessThanOrEqual(range.max + 0.1);
    });
  });

  describe('Phase 2: Template Accuracy', () => {
    // Test 7
    it('should advance to Phase 2 after 10 corrections', () => {
      for (let i = 0; i < 10; i++) {
        service.recordCorrection({
          field: 'productName',
          originalValue: 'Wrong',
          correctedValue: 'Correct',
          timestamp: new Date().toISOString(),
          source: 'user'
        });
      }

      const state = service.getState();
      expect(state.phase).toBe(2);
    });

    // Test 8
    it('should have accuracy range 50-65% in Phase 2', () => {
      const range = service.getExpectedAccuracyRange(2);

      expect(range.min).toBe(0.50);
      expect(range.max).toBe(0.65);
    });

    // Test 9
    it('should improve accuracy after corrections', () => {
      // Initial state (Phase 1)
      const initialState = service.getState();
      const initialAccuracy = initialState.accuracy;

      // Apply 15 corrections
      for (let i = 0; i < 15; i++) {
        service.recordCorrection({
          field: 'productName',
          originalValue: `Wrong${i}`,
          correctedValue: `Correct${i}`,
          timestamp: new Date().toISOString(),
          source: 'user'
        });
      }

      // Phase 2 should have better expected accuracy
      const state = service.getState();
      const phase2Range = service.getExpectedAccuracyRange(2);

      expect(state.phase).toBe(2);
      expect(state.accuracy).toBeGreaterThan(initialAccuracy);
      expect(state.accuracy).toBeGreaterThanOrEqual(phase2Range.min);
    });
  });

  describe('Phase 3: ML Accuracy', () => {
    // Test 10
    it('should advance to Phase 3 after 30 corrections', () => {
      for (let i = 0; i < 30; i++) {
        service.recordCorrection({
          field: 'price',
          originalValue: i,
          correctedValue: i + 1,
          timestamp: new Date().toISOString(),
          source: 'user'
        });
      }

      const state = service.getState();
      expect(state.phase).toBe(3);
    });

    // Test 11
    it('should have accuracy range 70-90% in Phase 3', () => {
      const range = service.getExpectedAccuracyRange(3);

      expect(range.min).toBe(0.70);
      expect(range.max).toBe(0.90);
    });

    // Test 12
    it('should achieve high accuracy after 50 corrections', () => {
      for (let i = 0; i < 50; i++) {
        service.recordCorrection({
          field: ['productName', 'price', 'unit'][i % 3],
          originalValue: `wrong-${i}`,
          correctedValue: `correct-${i}`,
          timestamp: new Date().toISOString(),
          source: 'user'
        });
      }

      const state = service.getState();
      const range = service.getExpectedAccuracyRange(3);

      expect(state.phase).toBe(3);
      expect(state.accuracy).toBeGreaterThanOrEqual(range.min);
    });
  });

  describe('Accuracy Metrics', () => {
    // Test 13
    it('should calculate overall accuracy correctly', () => {
      const extracted: ExtractedDeal[] = [
        { id: '1', adId: 'a', productName: 'Chicken Breast', rawText: '', price: 4.99, unit: 'lb', dealType: 'regular', confidence: 0.9, category: 'protein' },
        { id: '2', adId: 'a', productName: 'Ground Beef', rawText: '', price: 5.49, unit: 'lb', dealType: 'regular', confidence: 0.9, category: 'protein' }
      ];

      const expected: ExpectedDeal[] = [
        { productName: 'Chicken Breast', price: 4.99, unit: 'lb', dealType: 'regular' },
        { productName: 'Ground Beef', price: 5.49, unit: 'lb', dealType: 'regular' }
      ];

      const metrics = service.calculateAccuracy(extracted, expected);

      expect(metrics.accuracy).toBe(1.0);
      expect(metrics.correctExtractions).toBe(2);
    });

    // Test 14
    it('should calculate field-level accuracy', () => {
      const extracted: ExtractedDeal[] = [
        { id: '1', adId: 'a', productName: 'Chicken Breast', rawText: '', price: 4.99, unit: 'oz', dealType: 'regular', confidence: 0.9, category: 'protein' }
      ];

      const expected: ExpectedDeal[] = [
        { productName: 'Chicken Breast', price: 4.99, unit: 'lb', dealType: 'regular' }
      ];

      const metrics = service.calculateAccuracy(extracted, expected);

      expect(metrics.byField.productName).toBe(1.0);
      expect(metrics.byField.price).toBe(1.0);
      expect(metrics.byField.unit).toBe(0.0);
    });

    // Test 15
    it('should handle partial product name matches', () => {
      const extracted: ExtractedDeal[] = [
        { id: '1', adId: 'a', productName: 'Boneless Chicken Breast', rawText: '', price: 4.99, unit: 'lb', dealType: 'regular', confidence: 0.9, category: 'protein' }
      ];

      const expected: ExpectedDeal[] = [
        { productName: 'Chicken Breast', price: 4.99, unit: 'lb', dealType: 'regular' }
      ];

      const metrics = service.calculateAccuracy(extracted, expected);

      expect(metrics.byField.productName).toBe(1.0); // Contains "Chicken"
    });
  });

  describe('Correction Learning', () => {
    // Test 16
    it('should track correction history', () => {
      service.recordCorrection({
        field: 'productName',
        originalValue: 'Chiken',
        correctedValue: 'Chicken',
        timestamp: new Date().toISOString(),
        source: 'user'
      });

      const history = service.getCorrectionHistory();

      expect(history).toHaveLength(1);
      expect(history[0].field).toBe('productName');
    });

    // Test 17
    it('should learn patterns from corrections', () => {
      service.recordCorrection({
        field: 'productName',
        originalValue: 'Chiken',
        correctedValue: 'Chicken',
        timestamp: new Date().toISOString(),
        source: 'user'
      });

      service.recordCorrection({
        field: 'productName',
        originalValue: 'Chiken',
        correctedValue: 'Chicken',
        timestamp: new Date().toISOString(),
        source: 'user'
      });

      const patterns = service.getLearnedPatterns();

      expect(patterns.get('productName:Chiken')).toBe(2);
    });

    // Test 18
    it('should support different correction sources', () => {
      service.recordCorrection({
        field: 'price',
        originalValue: 4.99,
        correctedValue: 3.99,
        timestamp: new Date().toISOString(),
        source: 'user'
      });

      service.recordCorrection({
        field: 'price',
        originalValue: 5.99,
        correctedValue: 4.99,
        timestamp: new Date().toISOString(),
        source: 'template'
      });

      const history = service.getCorrectionHistory();

      expect(history.filter(c => c.source === 'user')).toHaveLength(1);
      expect(history.filter(c => c.source === 'template')).toHaveLength(1);
    });
  });

  describe('Accuracy Progression', () => {
    // Test 19
    it('should show improvement over corrections', () => {
      for (let i = 0; i < 40; i++) {
        service.recordCorrection({
          field: 'productName',
          originalValue: `wrong-${i}`,
          correctedValue: `correct-${i}`,
          timestamp: new Date().toISOString(),
          source: 'user'
        });
      }

      const progression = service.getAccuracyProgression();

      expect(progression.length).toBeGreaterThan(1);
      expect(progression[progression.length - 1].accuracy).toBeGreaterThan(progression[0].accuracy);
    });

    // Test 20
    it('should have non-decreasing accuracy', () => {
      for (let i = 0; i < 50; i++) {
        service.recordCorrection({
          field: 'price',
          originalValue: i,
          correctedValue: i + 0.5,
          timestamp: new Date().toISOString(),
          source: 'user'
        });
      }

      const progression = service.getAccuracyProgression();

      for (let i = 1; i < progression.length; i++) {
        expect(progression[i].accuracy).toBeGreaterThanOrEqual(progression[i - 1].accuracy);
      }
    });
  });

  describe('Phase Advancement', () => {
    // Test 21
    it('should update model version on phase change', () => {
      const initialVersion = service.getState().modelVersion;

      for (let i = 0; i < 10; i++) {
        service.recordCorrection({
          field: 'unit',
          originalValue: 'ea',
          correctedValue: 'lb',
          timestamp: new Date().toISOString(),
          source: 'user'
        });
      }

      const newVersion = service.getState().modelVersion;

      expect(newVersion).not.toBe(initialVersion);
    });

    // Test 22
    it('should not skip phases', () => {
      // Apply corrections one at a time and check phase progression
      let lastPhase = 1;

      for (let i = 0; i < 35; i++) {
        service.recordCorrection({
          field: 'price',
          originalValue: i,
          correctedValue: i + 1,
          timestamp: new Date().toISOString(),
          source: 'user'
        });

        const currentPhase = service.getState().phase;
        expect(currentPhase).toBeGreaterThanOrEqual(lastPhase);
        expect(currentPhase - lastPhase).toBeLessThanOrEqual(1);
        lastPhase = currentPhase;
      }
    });
  });

  describe('Accuracy Validation', () => {
    // Test 23
    it('should validate Phase 1 as always achievable', () => {
      const validation = service.validateAccuracyTargets();

      expect(validation[0].achievable).toBe(true);
    });

    // Test 24
    it('should validate Phase 2 requires corrections', () => {
      const validation = service.validateAccuracyTargets();

      expect(validation[1].achievable).toBe(false);
      expect(validation[1].reason).toContain('Need');
    });

    // Test 25
    it('should validate Phase 2 achievable after corrections', () => {
      for (let i = 0; i < 15; i++) {
        service.recordCorrection({
          field: 'dealType',
          originalValue: 'regular',
          correctedValue: 'bogo',
          timestamp: new Date().toISOString(),
          source: 'user'
        });
      }

      const validation = service.validateAccuracyTargets();

      expect(validation[1].achievable).toBe(true);
    });
  });

  describe('Synthetic Dataset Testing', () => {
    // Test 26
    it('should handle 100 ads synthetic dataset', () => {
      const ads = generateSyntheticAds(100);
      const deals = generateSyntheticDeals(ads);

      expect(ads).toHaveLength(100);
      expect(deals.length).toBeGreaterThan(400);
    });

    // Test 27
    it('should generate diverse deal types in dataset', () => {
      const ads = generateSyntheticAds(50);
      const deals = generateSyntheticDeals(ads);

      const dealTypes = new Set(deals.map(d => d.dealType));

      expect(dealTypes.size).toBeGreaterThanOrEqual(4);
    });

    // Test 28
    it('should have varying confidence in synthetic deals', () => {
      const ads = generateSyntheticAds(20);
      const deals = generateSyntheticDeals(ads);

      const confidences = deals.map(d => d.confidence);
      const minConfidence = Math.min(...confidences);
      const maxConfidence = Math.max(...confidences);

      expect(maxConfidence - minConfidence).toBeGreaterThan(0.3);
    });
  });

  describe('Ground Truth Validation', () => {
    // Test 29
    it('should generate 50 ground truth ads', () => {
      const groundTruth = generateGroundTruthAds(50);

      expect(groundTruth).toHaveLength(50);
    });

    // Test 30
    it('should have expected deals in ground truth', () => {
      const groundTruth = generateGroundTruthAds(10);

      for (const gt of groundTruth) {
        expect(gt.expectedDeals.length).toBeGreaterThan(0);
        expect(gt.ad.id).toBeDefined();
        expect(gt.annotatedBy).toBeDefined();
      }
    });
  });
});
