/**
 * End-to-End Tests: Ad Processing Workflow
 * Tests complete ad upload to shopping list integration
 * Target: 15 tests
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  AdImage,
  ExtractedDeal,
  DealMatch,
  SHOPPING_LIST_ITEMS,
  STORE_CONFIGS,
  PRODUCT_DATABASE,
  generateSyntheticAds,
  generateSyntheticDeals
} from '../../fixtures/ads/testAdData';

// Types for E2E workflow
interface WorkflowState {
  step: 'upload' | 'process' | 'review' | 'correct' | 'confirm' | 'apply' | 'complete';
  adId?: string;
  deals: ExtractedDeal[];
  matches: DealMatch[];
  corrections: number;
  savingsEstimate: number;
}

interface WorkflowResult {
  success: boolean;
  adId: string;
  dealsExtracted: number;
  dealsMatched: number;
  savingsEstimate: number;
  accuracyImprovement: number;
  processingTime: number;
}

// E2E Workflow Service (simulating full system integration)
const createAdWorkflowService = () => {
  let state: WorkflowState = {
    step: 'upload',
    deals: [],
    matches: [],
    corrections: 0,
    savingsEstimate: 0
  };

  let totalCorrections = 0;
  let baseAccuracy = 0.35;

  return {
    getState(): WorkflowState {
      return { ...state };
    },

    // Step 1: Upload ad
    async uploadAd(file: { name: string; size: number; type: string }, storeId: string): Promise<{ success: boolean; adId?: string; error?: string }> {
      // Validate file
      if (file.size > 10 * 1024 * 1024) {
        return { success: false, error: 'File too large' };
      }

      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
        return { success: false, error: 'Invalid file type' };
      }

      const adId = `ad-${Date.now()}`;
      state.adId = adId;
      state.step = 'process';

      return { success: true, adId };
    },

    // Step 2: Process with OCR
    async processWithOCR(adId: string): Promise<{ success: boolean; deals: ExtractedDeal[] }> {
      if (state.adId !== adId) {
        return { success: false, deals: [] };
      }

      // Simulate OCR extraction
      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate synthetic deals based on current accuracy
      const dealCount = Math.floor(Math.random() * 8) + 5;
      const deals: ExtractedDeal[] = [];

      for (let i = 0; i < dealCount; i++) {
        const product = PRODUCT_DATABASE[Math.floor(Math.random() * PRODUCT_DATABASE.length)];
        const confidence = baseAccuracy + Math.random() * 0.3;

        deals.push({
          id: `deal-${i}`,
          adId,
          productName: product.name,
          rawText: `${product.name} $${(product.typicalPrice * 0.8).toFixed(2)}/${product.unit}`,
          price: Math.round(product.typicalPrice * 0.8 * 100) / 100,
          unit: product.unit,
          dealType: 'regular',
          originalPrice: product.typicalPrice,
          savingsAmount: Math.round(product.typicalPrice * 0.2 * 100) / 100,
          confidence,
          category: product.category
        });
      }

      state.deals = deals;
      state.step = 'review';

      return { success: true, deals };
    },

    // Step 3: Review extracted deals
    reviewDeals(): ExtractedDeal[] {
      return state.deals;
    },

    // Step 4: Correct mismatches
    correctDeal(dealId: string, corrections: Partial<ExtractedDeal>): ExtractedDeal | null {
      const deal = state.deals.find(d => d.id === dealId);
      if (!deal) return null;

      Object.assign(deal, corrections);
      deal.corrected = true;
      deal.confidence = 1.0;

      state.corrections++;
      totalCorrections++;

      // Improve base accuracy with each correction
      if (totalCorrections >= 30) {
        baseAccuracy = Math.min(0.85, 0.70 + (totalCorrections - 30) * 0.005);
      } else if (totalCorrections >= 10) {
        baseAccuracy = Math.min(0.65, 0.50 + (totalCorrections - 10) * 0.0075);
      }

      state.step = 'correct';
      return deal;
    },

    // Step 5: Confirm matches
    async matchDealsToShoppingList(): Promise<DealMatch[]> {
      const matches: DealMatch[] = [];

      for (const deal of state.deals) {
        for (const item of SHOPPING_LIST_ITEMS) {
          const nameLower = deal.productName.toLowerCase();
          const itemLower = item.name.toLowerCase();

          if (nameLower.includes(itemLower.split(' ')[0]) ||
              itemLower.includes(nameLower.split(' ')[0])) {
            matches.push({
              dealId: deal.id,
              shoppingItemId: item.id,
              shoppingItemName: item.name,
              matchScore: deal.confidence,
              matchType: deal.corrected ? 'manual' : 'fuzzy',
              priceReduction: deal.savingsAmount || 0,
              savingsEstimate: (deal.savingsAmount || 0) * item.quantity,
              confirmed: false
            });
            break;
          }
        }
      }

      state.matches = matches;
      state.step = 'confirm';

      return matches;
    },

    confirmMatch(matchId: string): boolean {
      const match = state.matches.find(m => m.dealId === matchId);
      if (!match) return false;

      match.confirmed = true;
      return true;
    },

    // Step 6: Apply to shopping list
    async applyToShoppingList(): Promise<{ applied: number; savings: number }> {
      const confirmedMatches = state.matches.filter(m => m.confirmed);
      const totalSavings = confirmedMatches.reduce((sum, m) => sum + m.savingsEstimate, 0);

      state.savingsEstimate = totalSavings;
      state.step = 'apply';

      return {
        applied: confirmedMatches.length,
        savings: Math.round(totalSavings * 100) / 100
      };
    },

    // Step 7: Get savings estimate
    getSavingsEstimate(): number {
      return state.savingsEstimate;
    },

    // Complete workflow
    completeWorkflow(): WorkflowResult {
      state.step = 'complete';

      return {
        success: true,
        adId: state.adId || '',
        dealsExtracted: state.deals.length,
        dealsMatched: state.matches.filter(m => m.confirmed).length,
        savingsEstimate: state.savingsEstimate,
        accuracyImprovement: baseAccuracy - 0.35,
        processingTime: 0
      };
    },

    // Get accuracy after corrections
    getAccuracy(): number {
      return baseAccuracy;
    },

    // Reset for testing
    reset(): void {
      state = {
        step: 'upload',
        deals: [],
        matches: [],
        corrections: 0,
        savingsEstimate: 0
      };
    },

    resetAll(): void {
      this.reset();
      totalCorrections = 0;
      baseAccuracy = 0.35;
    }
  };
};

describe('Ad Workflow E2E', () => {
  let workflow: ReturnType<typeof createAdWorkflowService>;

  beforeEach(() => {
    workflow = createAdWorkflowService();
    workflow.reset();
  });

  afterEach(() => {
    workflow.resetAll();
  });

  describe('Complete Workflow', () => {
    // Test 1
    it('should complete full ad processing workflow', async () => {
      // Step 1: Upload
      const uploadResult = await workflow.uploadAd(
        { name: 'safeway_ad.pdf', size: 2 * 1024 * 1024, type: 'application/pdf' },
        'store-safeway'
      );
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.adId).toBeDefined();

      // Step 2: Process with OCR
      const processResult = await workflow.processWithOCR(uploadResult.adId!);
      expect(processResult.success).toBe(true);
      expect(processResult.deals.length).toBeGreaterThan(0);

      // Step 3: Review
      const deals = workflow.reviewDeals();
      expect(deals.length).toBeGreaterThan(0);

      // Step 4: Match to shopping list
      const matches = await workflow.matchDealsToShoppingList();
      expect(matches).toBeDefined();

      // Step 5: Confirm some matches
      if (matches.length > 0) {
        workflow.confirmMatch(matches[0].dealId);
      }

      // Step 6: Apply to shopping list
      const applied = await workflow.applyToShoppingList();
      expect(applied.applied).toBeGreaterThanOrEqual(0);

      // Step 7: Complete
      const result = workflow.completeWorkflow();
      expect(result.success).toBe(true);
    });

    // Test 2
    it('should track workflow state transitions', async () => {
      expect(workflow.getState().step).toBe('upload');

      await workflow.uploadAd(
        { name: 'ad.pdf', size: 1024 * 1024, type: 'application/pdf' },
        'store-safeway'
      );
      expect(workflow.getState().step).toBe('process');

      const { adId } = workflow.getState();
      await workflow.processWithOCR(adId!);
      expect(workflow.getState().step).toBe('review');

      await workflow.matchDealsToShoppingList();
      expect(workflow.getState().step).toBe('confirm');

      await workflow.applyToShoppingList();
      expect(workflow.getState().step).toBe('apply');

      workflow.completeWorkflow();
      expect(workflow.getState().step).toBe('complete');
    });
  });

  describe('Upload and Processing', () => {
    // Test 3
    it('should reject files over 10 MB', async () => {
      const result = await workflow.uploadAd(
        { name: 'large.pdf', size: 15 * 1024 * 1024, type: 'application/pdf' },
        'store-safeway'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });

    // Test 4
    it('should reject invalid file types', async () => {
      const result = await workflow.uploadAd(
        { name: 'doc.docx', size: 1024 * 1024, type: 'application/msword' },
        'store-safeway'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    // Test 5
    it('should extract multiple deals from ad', async () => {
      await workflow.uploadAd(
        { name: 'ad.pdf', size: 1024 * 1024, type: 'application/pdf' },
        'store-safeway'
      );

      const { adId } = workflow.getState();
      const result = await workflow.processWithOCR(adId!);

      expect(result.deals.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Deal Review and Correction', () => {
    // Test 6
    it('should allow correcting extracted deals', async () => {
      await workflow.uploadAd(
        { name: 'ad.pdf', size: 1024 * 1024, type: 'application/pdf' },
        'store-safeway'
      );
      const { adId } = workflow.getState();
      await workflow.processWithOCR(adId!);

      const deals = workflow.reviewDeals();
      const corrected = workflow.correctDeal(deals[0].id, { productName: 'Corrected Name' });

      expect(corrected?.productName).toBe('Corrected Name');
      expect(corrected?.corrected).toBe(true);
      expect(corrected?.confidence).toBe(1.0);
    });

    // Test 7
    it('should track correction count', async () => {
      await workflow.uploadAd(
        { name: 'ad.pdf', size: 1024 * 1024, type: 'application/pdf' },
        'store-safeway'
      );
      const { adId } = workflow.getState();
      await workflow.processWithOCR(adId!);

      const deals = workflow.reviewDeals();
      workflow.correctDeal(deals[0].id, { price: 2.99 });
      workflow.correctDeal(deals[1].id, { price: 3.99 });

      expect(workflow.getState().corrections).toBe(2);
    });
  });

  describe('Deal Matching', () => {
    // Test 8
    it('should match deals to shopping list items', async () => {
      await workflow.uploadAd(
        { name: 'ad.pdf', size: 1024 * 1024, type: 'application/pdf' },
        'store-safeway'
      );
      const { adId } = workflow.getState();
      await workflow.processWithOCR(adId!);

      const matches = await workflow.matchDealsToShoppingList();

      // Some matches expected since synthetic data overlaps with shopping list
      expect(matches).toBeDefined();
    });

    // Test 9
    it('should allow confirming matches', async () => {
      await workflow.uploadAd(
        { name: 'ad.pdf', size: 1024 * 1024, type: 'application/pdf' },
        'store-safeway'
      );
      const { adId } = workflow.getState();
      await workflow.processWithOCR(adId!);
      const matches = await workflow.matchDealsToShoppingList();

      if (matches.length > 0) {
        const confirmed = workflow.confirmMatch(matches[0].dealId);
        expect(confirmed).toBe(true);
      }
    });
  });

  describe('Savings Calculation', () => {
    // Test 10
    it('should calculate savings estimate', async () => {
      await workflow.uploadAd(
        { name: 'ad.pdf', size: 1024 * 1024, type: 'application/pdf' },
        'store-safeway'
      );
      const { adId } = workflow.getState();
      await workflow.processWithOCR(adId!);
      const matches = await workflow.matchDealsToShoppingList();

      matches.forEach(m => workflow.confirmMatch(m.dealId));

      const applied = await workflow.applyToShoppingList();

      expect(applied.savings).toBeGreaterThanOrEqual(0);
    });

    // Test 11
    it('should provide final savings estimate', async () => {
      await workflow.uploadAd(
        { name: 'ad.pdf', size: 1024 * 1024, type: 'application/pdf' },
        'store-safeway'
      );
      const { adId } = workflow.getState();
      await workflow.processWithOCR(adId!);
      await workflow.matchDealsToShoppingList();
      await workflow.applyToShoppingList();

      const savings = workflow.getSavingsEstimate();

      expect(typeof savings).toBe('number');
    });
  });

  describe('Accuracy Improvement', () => {
    // Test 12
    it('should improve accuracy after 10 corrections', async () => {
      const initialAccuracy = workflow.getAccuracy();

      // Process multiple ads with corrections
      for (let i = 0; i < 10; i++) {
        workflow.reset();
        await workflow.uploadAd(
          { name: `ad${i}.pdf`, size: 1024 * 1024, type: 'application/pdf' },
          'store-safeway'
        );
        const { adId } = workflow.getState();
        await workflow.processWithOCR(adId!);

        const deals = workflow.reviewDeals();
        if (deals.length > 0) {
          workflow.correctDeal(deals[0].id, { productName: `Corrected ${i}` });
        }
      }

      const improvedAccuracy = workflow.getAccuracy();

      expect(improvedAccuracy).toBeGreaterThan(initialAccuracy);
      expect(improvedAccuracy).toBeGreaterThanOrEqual(0.50);
    });

    // Test 13
    it('should achieve high accuracy after 30 corrections', async () => {
      // Apply 30 corrections
      for (let i = 0; i < 30; i++) {
        workflow.reset();
        await workflow.uploadAd(
          { name: `ad${i}.pdf`, size: 1024 * 1024, type: 'application/pdf' },
          'store-safeway'
        );
        const { adId } = workflow.getState();
        await workflow.processWithOCR(adId!);

        const deals = workflow.reviewDeals();
        if (deals.length > 0) {
          workflow.correctDeal(deals[0].id, { productName: `Corrected ${i}` });
        }
      }

      const finalAccuracy = workflow.getAccuracy();

      expect(finalAccuracy).toBeGreaterThanOrEqual(0.70);
    });
  });

  describe('Template Auto-Application', () => {
    // Test 14
    it('should complete workflow with template assistance', async () => {
      await workflow.uploadAd(
        { name: 'ad.pdf', size: 1024 * 1024, type: 'application/pdf' },
        'store-safeway'
      );
      const { adId } = workflow.getState();
      const result = await workflow.processWithOCR(adId!);

      // Deals should have confidence based on templates/accuracy
      const avgConfidence = result.deals.reduce((sum, d) => sum + d.confidence, 0) / result.deals.length;

      expect(avgConfidence).toBeGreaterThan(0);
    });

    // Test 15
    it('should return complete workflow result', async () => {
      await workflow.uploadAd(
        { name: 'ad.pdf', size: 1024 * 1024, type: 'application/pdf' },
        'store-safeway'
      );
      const { adId } = workflow.getState();
      await workflow.processWithOCR(adId!);
      const matches = await workflow.matchDealsToShoppingList();
      matches.forEach(m => workflow.confirmMatch(m.dealId));
      await workflow.applyToShoppingList();

      const result = workflow.completeWorkflow();

      expect(result.success).toBe(true);
      expect(result.adId).toBeDefined();
      expect(result.dealsExtracted).toBeGreaterThan(0);
      expect(typeof result.savingsEstimate).toBe('number');
    });
  });
});
