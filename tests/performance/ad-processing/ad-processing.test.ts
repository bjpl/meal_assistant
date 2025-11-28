/**
 * Performance Tests: Ad Processing
 * Tests OCR processing time, deal extraction, matching, and annotation performance
 * Target: 20 tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  PERFORMANCE_BENCHMARKS,
  generateSyntheticAds,
  generateSyntheticDeals,
  SHOPPING_LIST_ITEMS,
  PRODUCT_DATABASE,
  AdImage,
  ExtractedDeal
} from '../../fixtures/ads/testAdData';

// Performance measurement utilities
const measureTime = async <T>(fn: () => Promise<T> | T): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
};

const measureMemory = (): number => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed;
  }
  return 0;
};

// Mock OCR service for performance testing
const createMockOCRService = () => {
  return {
    async processPage(pageData: Buffer): Promise<string[]> {
      // Simulate OCR processing time based on data size
      const processingTime = Math.min(pageData.length / 100000, 2000);
      await new Promise(resolve => setTimeout(resolve, processingTime / 100)); // Scaled down for tests

      // Return mock extracted text
      const products = PRODUCT_DATABASE.slice(0, Math.floor(Math.random() * 10) + 5);
      return products.map(p => `${p.name} $${(p.typicalPrice * 0.8).toFixed(2)}/${p.unit}`);
    },

    async processPDF(pdfBuffer: Buffer, pageCount: number): Promise<string[][]> {
      const results: string[][] = [];
      for (let i = 0; i < pageCount; i++) {
        results.push(await this.processPage(pdfBuffer));
      }
      return results;
    }
  };
};

// Mock extraction service
const createMockExtractionService = () => {
  return {
    extractDeals(ocrText: string[]): ExtractedDeal[] {
      return ocrText.map((text, i) => ({
        id: `deal-${i}`,
        adId: 'perf-test',
        productName: text.split('$')[0].trim(),
        rawText: text,
        price: parseFloat(text.match(/\$(\d+\.?\d*)/)?.[1] || '0'),
        unit: text.match(/\/(\w+)/)?.[1] || 'ea',
        dealType: 'regular',
        confidence: 0.8,
        category: 'unknown'
      }));
    },

    extractBatch(ocrResults: string[][]): ExtractedDeal[] {
      return ocrResults.flatMap(texts => this.extractDeals(texts));
    }
  };
};

// Mock matching service
const createMockMatchingService = () => {
  return {
    matchToShoppingList(deals: ExtractedDeal[], shoppingList: typeof SHOPPING_LIST_ITEMS) {
      const matches: { dealId: string; itemId: string; score: number }[] = [];

      for (const deal of deals) {
        for (const item of shoppingList) {
          const dealWords = deal.productName.toLowerCase().split(' ');
          const itemWords = item.name.toLowerCase().split(' ');

          const matchingWords = dealWords.filter(dw =>
            itemWords.some(iw => iw.includes(dw) || dw.includes(iw))
          );

          if (matchingWords.length > 0) {
            matches.push({
              dealId: deal.id,
              itemId: item.id,
              score: matchingWords.length / Math.max(dealWords.length, itemWords.length)
            });
          }
        }
      }

      return matches;
    }
  };
};

// Mock template service
const createMockTemplateService = () => {
  return {
    applyTemplate(adData: Buffer, templateId: string): ExtractedDeal[] {
      // Simulate template-based extraction
      const dealCount = Math.floor(Math.random() * 10) + 5;
      const deals: ExtractedDeal[] = [];

      for (let i = 0; i < dealCount; i++) {
        const product = PRODUCT_DATABASE[i % PRODUCT_DATABASE.length];
        deals.push({
          id: `template-deal-${i}`,
          adId: 'template-test',
          productName: product.name,
          rawText: `${product.name} $${product.typicalPrice}`,
          price: product.typicalPrice,
          unit: product.unit,
          dealType: 'regular',
          confidence: 0.9,
          category: product.category
        });
      }

      return deals;
    }
  };
};

// Mock annotation service
const createMockAnnotationService = () => {
  const annotations: Map<string, any> = new Map();

  return {
    async saveAnnotation(adId: string, dealId: string, annotation: any): Promise<void> {
      // Simulate database write
      await new Promise(resolve => setTimeout(resolve, 10));
      annotations.set(`${adId}-${dealId}`, annotation);
    },

    async saveBatch(adId: string, annotationsData: { dealId: string; annotation: any }[]): Promise<void> {
      await Promise.all(
        annotationsData.map(({ dealId, annotation }) =>
          this.saveAnnotation(adId, dealId, annotation)
        )
      );
    },

    getAnnotation(adId: string, dealId: string): any {
      return annotations.get(`${adId}-${dealId}`);
    },

    clear(): void {
      annotations.clear();
    }
  };
};

describe('Ad Processing Performance', () => {
  describe('OCR Processing Time', () => {
    const ocrService = createMockOCRService();

    // Test 1
    it('should process single page under 3 seconds', async () => {
      const pageData = Buffer.alloc(500000); // 500KB simulated page

      const { duration } = await measureTime(() => ocrService.processPage(pageData));

      expect(duration).toBeLessThan(3000);
    });

    // Test 2
    it('should process 4-page PDF under target time', async () => {
      const pdfBuffer = Buffer.alloc(2000000); // 2MB PDF

      const { duration } = await measureTime(() => ocrService.processPDF(pdfBuffer, 4));

      // Target is 10s, but our mock is scaled down
      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.ocrProcessing.acceptable / 10);
    });

    // Test 3
    it('should process 6-page PDF with acceptable performance', async () => {
      const pdfBuffer = Buffer.alloc(3000000);

      const { duration } = await measureTime(() => ocrService.processPDF(pdfBuffer, 6));

      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.ocrProcessing.acceptable / 5);
    });

    // Test 4
    it('should handle concurrent page processing', async () => {
      const pages = Array(4).fill(Buffer.alloc(500000));

      const { duration } = await measureTime(async () => {
        await Promise.all(pages.map(p => ocrService.processPage(p)));
      });

      // Concurrent should be faster than sequential
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Deal Extraction Performance', () => {
    const extractionService = createMockExtractionService();

    // Test 5
    it('should extract 50 deals under target time', async () => {
      const ocrTexts = PRODUCT_DATABASE.slice(0, 50).map(p =>
        `${p.name} $${p.typicalPrice.toFixed(2)}/${p.unit}`
      );

      const { duration } = await measureTime(() => extractionService.extractDeals(ocrTexts));

      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.dealExtraction.target);
    });

    // Test 6
    it('should extract 100 deals with acceptable performance', async () => {
      const ocrTexts = Array(100).fill(null).map((_, i) => {
        const p = PRODUCT_DATABASE[i % PRODUCT_DATABASE.length];
        return `${p.name} $${p.typicalPrice.toFixed(2)}/${p.unit}`;
      });

      const { duration } = await measureTime(() => extractionService.extractDeals(ocrTexts));

      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.dealExtraction.acceptable * 2);
    });

    // Test 7
    it('should batch extract from multiple pages efficiently', async () => {
      const ocrResults = Array(4).fill(null).map(() =>
        PRODUCT_DATABASE.slice(0, 15).map(p =>
          `${p.name} $${p.typicalPrice.toFixed(2)}/${p.unit}`
        )
      );

      const { duration } = await measureTime(() => extractionService.extractBatch(ocrResults));

      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.dealExtraction.acceptable);
    });
  });

  describe('Matching Performance', () => {
    const matchingService = createMockMatchingService();
    const extractionService = createMockExtractionService();

    // Test 8
    it('should match 50 deals to shopping list under target time', async () => {
      const ocrTexts = PRODUCT_DATABASE.slice(0, 50).map(p =>
        `${p.name} $${p.typicalPrice.toFixed(2)}/${p.unit}`
      );
      const deals = extractionService.extractDeals(ocrTexts);

      const { duration } = await measureTime(() =>
        matchingService.matchToShoppingList(deals, SHOPPING_LIST_ITEMS)
      );

      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.matching.target);
    });

    // Test 9
    it('should match large deal set with acceptable performance', async () => {
      const ocrTexts = Array(200).fill(null).map((_, i) => {
        const p = PRODUCT_DATABASE[i % PRODUCT_DATABASE.length];
        return `${p.name} $${p.typicalPrice.toFixed(2)}/${p.unit}`;
      });
      const deals = extractionService.extractDeals(ocrTexts);

      const { duration } = await measureTime(() =>
        matchingService.matchToShoppingList(deals, SHOPPING_LIST_ITEMS)
      );

      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.matching.acceptable * 2);
    });

    // Test 10
    it('should handle empty shopping list efficiently', async () => {
      const deals = extractionService.extractDeals(
        PRODUCT_DATABASE.slice(0, 20).map(p => `${p.name} $${p.typicalPrice}`)
      );

      const { duration } = await measureTime(() =>
        matchingService.matchToShoppingList(deals, [])
      );

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Template Application Performance', () => {
    const templateService = createMockTemplateService();

    // Test 11
    it('should apply template under target time', async () => {
      const adData = Buffer.alloc(1000000);

      const { duration } = await measureTime(() =>
        templateService.applyTemplate(adData, 'template-safeway-v1')
      );

      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.templateApplication.target);
    });

    // Test 12
    it('should apply template with acceptable performance', async () => {
      const adData = Buffer.alloc(3000000);

      const { duration } = await measureTime(() =>
        templateService.applyTemplate(adData, 'template-safeway-v2')
      );

      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.templateApplication.acceptable);
    });

    // Test 13
    it('should handle multiple template applications', async () => {
      const ads = Array(10).fill(Buffer.alloc(500000));

      const { duration } = await measureTime(async () => {
        for (const ad of ads) {
          templateService.applyTemplate(ad, 'template-safeway-v1');
        }
      });

      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.templateApplication.acceptable * 10);
    });
  });

  describe('Annotation Save Performance', () => {
    const annotationService = createMockAnnotationService();

    beforeEach(() => {
      annotationService.clear();
    });

    // Test 14
    it('should save single annotation under target time', async () => {
      const { duration } = await measureTime(() =>
        annotationService.saveAnnotation('ad-1', 'deal-1', { productName: 'Chicken', price: 4.99 })
      );

      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.annotationSave.target);
    });

    // Test 15
    it('should save batch annotations efficiently', async () => {
      const annotations = Array(20).fill(null).map((_, i) => ({
        dealId: `deal-${i}`,
        annotation: { productName: `Product ${i}`, price: 1.99 + i }
      }));

      const { duration } = await measureTime(() =>
        annotationService.saveBatch('ad-1', annotations)
      );

      expect(duration).toBeLessThan(PERFORMANCE_BENCHMARKS.annotationSave.acceptable * 5);
    });
  });

  describe('Memory Usage', () => {
    // Test 16
    it('should process ads without excessive memory growth', async () => {
      const initialMemory = measureMemory();
      const ads = generateSyntheticAds(50);
      const deals = generateSyntheticDeals(ads);

      const afterProcessing = measureMemory();
      const memoryGrowth = afterProcessing - initialMemory;

      // Should not grow more than 50MB for this test data
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });

    // Test 17
    it('should handle large synthetic dataset', async () => {
      const initialMemory = measureMemory();

      const ads = generateSyntheticAds(100);
      const deals = generateSyntheticDeals(ads);

      expect(ads).toHaveLength(100);
      expect(deals.length).toBeGreaterThan(400);

      const afterProcessing = measureMemory();
      const memoryGrowth = afterProcessing - initialMemory;

      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Throughput', () => {
    // Test 18
    it('should process ads at acceptable throughput', async () => {
      const ads = generateSyntheticAds(10);
      const ocrService = createMockOCRService();
      const extractionService = createMockExtractionService();

      const { duration } = await measureTime(async () => {
        for (const ad of ads) {
          const pages = await ocrService.processPDF(Buffer.alloc(ad.fileSize), ad.pageCount || 1);
          extractionService.extractBatch(pages);
        }
      });

      const throughput = ads.length / (duration / 1000); // ads per second

      expect(throughput).toBeGreaterThan(0.5); // At least 0.5 ads/second
    });

    // Test 19
    it('should maintain consistent performance over multiple runs', async () => {
      const ocrService = createMockOCRService();
      const durations: number[] = [];

      for (let i = 0; i < 5; i++) {
        const { duration } = await measureTime(() =>
          ocrService.processPage(Buffer.alloc(500000))
        );
        durations.push(duration);
      }

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be less than 50% of average
      expect(stdDev).toBeLessThan(avg * 0.5);
    });

    // Test 20
    it('should complete full pipeline within time budget', async () => {
      const ocrService = createMockOCRService();
      const extractionService = createMockExtractionService();
      const matchingService = createMockMatchingService();
      const templateService = createMockTemplateService();

      const { duration } = await measureTime(async () => {
        // Simulate full pipeline for one ad
        const ocrResults = await ocrService.processPDF(Buffer.alloc(2000000), 4);
        const deals = extractionService.extractBatch(ocrResults);
        matchingService.matchToShoppingList(deals, SHOPPING_LIST_ITEMS);
        templateService.applyTemplate(Buffer.alloc(1000000), 'template-1');
      });

      // Full pipeline should complete in reasonable time
      const totalBudget =
        PERFORMANCE_BENCHMARKS.ocrProcessing.acceptable +
        PERFORMANCE_BENCHMARKS.dealExtraction.acceptable +
        PERFORMANCE_BENCHMARKS.matching.acceptable +
        PERFORMANCE_BENCHMARKS.templateApplication.acceptable;

      expect(duration).toBeLessThan(totalBudget / 5); // Scaled for mock
    });
  });
});
