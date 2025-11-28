/**
 * Unit Tests: Deal Matching
 * Tests fuzzy product matching, category matching, and shopping list integration
 * Target: 35 tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ExtractedDeal,
  DealMatch,
  SHOPPING_LIST_ITEMS,
  PRODUCT_DATABASE,
  generateSyntheticAds,
  generateSyntheticDeals
} from '../../fixtures/ads/testAdData';

// Types for matching service
interface MatchResult {
  matches: DealMatch[];
  unmatchedDeals: string[];
  unmatchedItems: string[];
  totalSavings: number;
}

interface FuzzyMatchScore {
  score: number;
  matchType: 'exact' | 'fuzzy' | 'category' | 'none';
  confidence: number;
}

// Deal Matching Service (to be implemented)
const createDealMatchingService = () => {
  const FUZZY_THRESHOLD = 0.6;
  const CATEGORY_BOOST = 0.1;

  return {
    // Calculate Levenshtein distance for fuzzy matching
    levenshteinDistance(s1: string, s2: string): number {
      const m = s1.length;
      const n = s2.length;
      const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;

      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (s1[i - 1] === s2[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1];
          } else {
            dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
          }
        }
      }

      return dp[m][n];
    },

    // Calculate similarity score (0-1)
    calculateSimilarity(s1: string, s2: string): number {
      const str1 = s1.toLowerCase().trim();
      const str2 = s2.toLowerCase().trim();

      if (str1 === str2) return 1.0;

      const maxLen = Math.max(str1.length, str2.length);
      if (maxLen === 0) return 1.0;

      const distance = this.levenshteinDistance(str1, str2);
      return 1 - (distance / maxLen);
    },

    // Tokenize and match individual words
    tokenMatch(dealName: string, itemName: string): number {
      const dealTokens = dealName.toLowerCase().split(/\s+/);
      const itemTokens = itemName.toLowerCase().split(/\s+/);

      let matchedTokens = 0;
      for (const itemToken of itemTokens) {
        for (const dealToken of dealTokens) {
          if (dealToken.includes(itemToken) || itemToken.includes(dealToken)) {
            matchedTokens++;
            break;
          }
        }
      }

      return matchedTokens / Math.max(itemTokens.length, 1);
    },

    // Check if categories match
    categoriesMatch(dealCategory: string, itemCategory: string): boolean {
      const categoryMappings: Record<string, string[]> = {
        'protein': ['meat', 'poultry', 'seafood', 'eggs', 'protein'],
        'dairy': ['dairy', 'milk', 'cheese', 'yogurt'],
        'produce': ['produce', 'vegetables', 'fruits', 'fresh'],
        'grains': ['grains', 'bread', 'pasta', 'rice', 'cereal'],
        'pantry': ['pantry', 'canned', 'dry goods', 'staples'],
        'beverages': ['beverages', 'drinks', 'juice', 'soda'],
        'frozen': ['frozen', 'ice cream']
      };

      const normalizedDeal = dealCategory.toLowerCase();
      const normalizedItem = itemCategory.toLowerCase();

      if (normalizedDeal === normalizedItem) return true;

      for (const [, aliases] of Object.entries(categoryMappings)) {
        if (aliases.includes(normalizedDeal) && aliases.includes(normalizedItem)) {
          return true;
        }
      }

      return false;
    },

    // Calculate fuzzy match score
    calculateMatchScore(deal: ExtractedDeal, item: { name: string; category: string }): FuzzyMatchScore {
      const nameSimilarity = this.calculateSimilarity(deal.productName, item.name);
      const tokenScore = this.tokenMatch(deal.productName, item.name);
      const categoryMatches = this.categoriesMatch(deal.category, item.category);

      // Combine scores
      let score = Math.max(nameSimilarity, tokenScore);
      let matchType: FuzzyMatchScore['matchType'] = 'none';

      // Exact match
      if (nameSimilarity === 1.0) {
        matchType = 'exact';
        score = 1.0;
      }
      // Fuzzy match
      else if (score >= FUZZY_THRESHOLD) {
        matchType = 'fuzzy';
        if (categoryMatches) {
          score = Math.min(score + CATEGORY_BOOST, 1.0);
        }
      }
      // Category-only match
      else if (categoryMatches && score >= 0.3) {
        matchType = 'category';
        score = Math.max(score, 0.4);
      }

      return {
        score,
        matchType,
        confidence: score * deal.confidence
      };
    },

    // Check if price is reasonable
    isPriceReasonable(dealPrice: number, typicalPrice?: number): boolean {
      if (!typicalPrice) return true;

      // Price should be within 10% to 80% of typical price
      const minReasonable = typicalPrice * 0.1;
      const maxReasonable = typicalPrice * 1.2;

      return dealPrice >= minReasonable && dealPrice <= maxReasonable;
    },

    // Calculate savings
    calculateSavings(deal: ExtractedDeal, quantity: number): number {
      if (deal.savingsAmount) {
        return deal.savingsAmount * quantity;
      }
      if (deal.originalPrice && deal.price) {
        return (deal.originalPrice - deal.price) * quantity;
      }
      if (deal.dealType === 'bogo') {
        return deal.price * Math.floor(quantity / 2);
      }
      return 0;
    },

    // Match single deal to shopping list
    matchDealToList(
      deal: ExtractedDeal,
      shoppingList: typeof SHOPPING_LIST_ITEMS
    ): DealMatch | null {
      let bestMatch: DealMatch | null = null;
      let bestScore = 0;

      for (const item of shoppingList) {
        const matchResult = this.calculateMatchScore(deal, item);

        if (matchResult.score > bestScore && matchResult.matchType !== 'none') {
          bestScore = matchResult.score;
          bestMatch = {
            dealId: deal.id,
            shoppingItemId: item.id,
            shoppingItemName: item.name,
            matchScore: matchResult.score,
            matchType: matchResult.matchType,
            priceReduction: deal.originalPrice ? deal.originalPrice - deal.price : 0,
            savingsEstimate: this.calculateSavings(deal, item.quantity),
            confirmed: false
          };
        }
      }

      return bestMatch;
    },

    // Match all deals to shopping list
    matchDealsToList(
      deals: ExtractedDeal[],
      shoppingList: typeof SHOPPING_LIST_ITEMS
    ): MatchResult {
      const matches: DealMatch[] = [];
      const matchedDealIds = new Set<string>();
      const matchedItemIds = new Set<string>();

      // Sort deals by confidence (highest first)
      const sortedDeals = [...deals].sort((a, b) => b.confidence - a.confidence);

      for (const deal of sortedDeals) {
        const match = this.matchDealToList(deal, shoppingList);

        if (match && !matchedItemIds.has(match.shoppingItemId)) {
          matches.push(match);
          matchedDealIds.add(deal.id);
          matchedItemIds.add(match.shoppingItemId);
        }
      }

      const unmatchedDeals = deals
        .filter(d => !matchedDealIds.has(d.id))
        .map(d => d.id);

      const unmatchedItems = shoppingList
        .filter(i => !matchedItemIds.has(i.id))
        .map(i => i.id);

      const totalSavings = matches.reduce((sum, m) => sum + m.savingsEstimate, 0);

      return {
        matches,
        unmatchedDeals,
        unmatchedItems,
        totalSavings
      };
    },

    // User correction workflow
    applyUserCorrection(
      match: DealMatch,
      correctedItemId: string,
      correctedItemName: string
    ): DealMatch {
      return {
        ...match,
        shoppingItemId: correctedItemId,
        shoppingItemName: correctedItemName,
        matchType: 'manual',
        matchScore: 1.0,
        confirmed: true
      };
    },

    // Confirm a match
    confirmMatch(match: DealMatch): DealMatch {
      return {
        ...match,
        confirmed: true
      };
    },

    // Reject a match
    rejectMatch(match: DealMatch): null {
      return null;
    },

    // Get match confidence level
    getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
      if (score >= 0.8) return 'high';
      if (score >= 0.6) return 'medium';
      return 'low';
    }
  };
};

describe('Deal Matching', () => {
  let service: ReturnType<typeof createDealMatchingService>;

  beforeEach(() => {
    service = createDealMatchingService();
  });

  describe('Similarity Calculation', () => {
    // Test 1
    it('should return 1.0 for exact matches', () => {
      const score = service.calculateSimilarity('Chicken Breast', 'Chicken Breast');

      expect(score).toBe(1.0);
    });

    // Test 2
    it('should return 1.0 for case-insensitive matches', () => {
      const score = service.calculateSimilarity('CHICKEN BREAST', 'chicken breast');

      expect(score).toBe(1.0);
    });

    // Test 3
    it('should handle partial matches', () => {
      const score = service.calculateSimilarity('Chicken Breast', 'Chicken');

      expect(score).toBeGreaterThanOrEqual(0.5);
    });

    // Test 4
    it('should return low score for different products', () => {
      const score = service.calculateSimilarity('Chicken Breast', 'Beef Steak');

      expect(score).toBeLessThan(0.5);
    });

    // Test 5
    it('should handle empty strings', () => {
      const score = service.calculateSimilarity('', '');

      expect(score).toBe(1.0);
    });
  });

  describe('Token Matching', () => {
    // Test 6
    it('should match when key tokens present', () => {
      const score = service.tokenMatch('Boneless Skinless Chicken Breast', 'Chicken Breast');

      expect(score).toBeGreaterThanOrEqual(0.5);
    });

    // Test 7
    it('should match partial tokens', () => {
      const score = service.tokenMatch('Ground Beef 80/20', 'Ground Beef');

      expect(score).toBe(1.0);
    });

    // Test 8
    it('should handle brand names', () => {
      const score = service.tokenMatch('Oscar Mayer Bacon', 'Bacon');

      expect(score).toBeGreaterThan(0);
    });
  });

  describe('Category Matching', () => {
    // Test 9
    it('should match identical categories', () => {
      const matches = service.categoriesMatch('protein', 'protein');

      expect(matches).toBe(true);
    });

    // Test 10
    it('should match related categories', () => {
      const matches = service.categoriesMatch('meat', 'protein');

      expect(matches).toBe(true);
    });

    // Test 11
    it('should not match unrelated categories', () => {
      const matches = service.categoriesMatch('dairy', 'produce');

      expect(matches).toBe(false);
    });

    // Test 12
    it('should handle case insensitivity', () => {
      const matches = service.categoriesMatch('PROTEIN', 'Protein');

      expect(matches).toBe(true);
    });
  });

  describe('Match Score Calculation', () => {
    // Test 13
    it('should return exact match for identical names', () => {
      const deal: ExtractedDeal = {
        id: 'deal-1',
        adId: 'ad-1',
        productName: 'Chicken Breast',
        rawText: 'Chicken Breast $4.99/lb',
        price: 4.99,
        unit: 'lb',
        dealType: 'regular',
        confidence: 0.9,
        category: 'protein'
      };

      const item = { name: 'Chicken Breast', category: 'protein' };
      const result = service.calculateMatchScore(deal, item);

      expect(result.matchType).toBe('exact');
      expect(result.score).toBe(1.0);
    });

    // Test 14
    it('should return fuzzy match for similar names', () => {
      const deal: ExtractedDeal = {
        id: 'deal-1',
        adId: 'ad-1',
        productName: 'Boneless Chicken Breast',
        rawText: 'Boneless Chicken Breast $4.99/lb',
        price: 4.99,
        unit: 'lb',
        dealType: 'regular',
        confidence: 0.9,
        category: 'protein'
      };

      const item = { name: 'Chicken Breast', category: 'protein' };
      const result = service.calculateMatchScore(deal, item);

      expect(result.matchType).toBe('fuzzy');
      expect(result.score).toBeGreaterThan(0.6);
    });

    // Test 15
    it('should boost score for matching categories', () => {
      const deal: ExtractedDeal = {
        id: 'deal-1',
        adId: 'ad-1',
        productName: 'Turkey Breast',
        rawText: 'Turkey Breast $5.99/lb',
        price: 5.99,
        unit: 'lb',
        dealType: 'regular',
        confidence: 0.9,
        category: 'protein'
      };

      const matchingCategory = { name: 'Chicken Breast', category: 'protein' };
      const differentCategory = { name: 'Chicken Breast', category: 'dairy' };

      const scoreWithCategory = service.calculateMatchScore(deal, matchingCategory);
      const scoreWithoutCategory = service.calculateMatchScore(deal, differentCategory);

      expect(scoreWithCategory.score).toBeGreaterThanOrEqual(scoreWithoutCategory.score);
    });
  });

  describe('Price Reasonableness', () => {
    // Test 16
    it('should accept normal sale prices', () => {
      const reasonable = service.isPriceReasonable(3.99, 4.99);

      expect(reasonable).toBe(true);
    });

    // Test 17
    it('should accept deep discount prices', () => {
      const reasonable = service.isPriceReasonable(1.99, 4.99);

      expect(reasonable).toBe(true);
    });

    // Test 18
    it('should reject suspiciously low prices', () => {
      const reasonable = service.isPriceReasonable(0.01, 4.99);

      expect(reasonable).toBe(false);
    });

    // Test 19
    it('should reject inflated prices', () => {
      const reasonable = service.isPriceReasonable(10.00, 4.99);

      expect(reasonable).toBe(false);
    });

    // Test 20
    it('should accept when no typical price provided', () => {
      const reasonable = service.isPriceReasonable(100.00, undefined);

      expect(reasonable).toBe(true);
    });
  });

  describe('Savings Calculation', () => {
    // Test 21
    it('should calculate savings from explicit savingsAmount', () => {
      const deal: ExtractedDeal = {
        id: 'deal-1',
        adId: 'ad-1',
        productName: 'Chicken',
        rawText: '',
        price: 3.99,
        unit: 'lb',
        dealType: 'regular',
        confidence: 0.9,
        category: 'protein',
        savingsAmount: 1.00
      };

      const savings = service.calculateSavings(deal, 3);

      expect(savings).toBe(3.00);
    });

    // Test 22
    it('should calculate savings from price difference', () => {
      const deal: ExtractedDeal = {
        id: 'deal-1',
        adId: 'ad-1',
        productName: 'Chicken',
        rawText: '',
        price: 3.99,
        unit: 'lb',
        dealType: 'regular',
        confidence: 0.9,
        category: 'protein',
        originalPrice: 4.99
      };

      const savings = service.calculateSavings(deal, 2);

      expect(savings).toBe(2.00);
    });

    // Test 23
    it('should calculate BOGO savings correctly', () => {
      const deal: ExtractedDeal = {
        id: 'deal-1',
        adId: 'ad-1',
        productName: 'Ice Cream',
        rawText: '',
        price: 4.99,
        unit: 'ea',
        dealType: 'bogo',
        confidence: 0.9,
        category: 'frozen'
      };

      const savings = service.calculateSavings(deal, 4);

      expect(savings).toBe(9.98); // 2 free items
    });
  });

  describe('Shopping List Matching', () => {
    // Test 24
    it('should match deal to shopping list item', () => {
      const deal: ExtractedDeal = {
        id: 'deal-1',
        adId: 'ad-1',
        productName: 'Chicken Breast',
        rawText: '',
        price: 2.99,
        unit: 'lb',
        dealType: 'regular',
        confidence: 0.9,
        category: 'protein',
        originalPrice: 4.99
      };

      const match = service.matchDealToList(deal, SHOPPING_LIST_ITEMS);

      expect(match).not.toBeNull();
      expect(match?.shoppingItemName).toBe('Chicken Breast');
    });

    // Test 25
    it('should return null for no matches', () => {
      const deal: ExtractedDeal = {
        id: 'deal-1',
        adId: 'ad-1',
        productName: 'Caviar',
        rawText: '',
        price: 99.99,
        unit: 'oz',
        dealType: 'regular',
        confidence: 0.9,
        category: 'seafood'
      };

      const match = service.matchDealToList(deal, SHOPPING_LIST_ITEMS);

      expect(match).toBeNull();
    });

    // Test 26
    it('should match multiple deals to list', () => {
      const deals: ExtractedDeal[] = [
        {
          id: 'deal-1',
          adId: 'ad-1',
          productName: 'Chicken Breast',
          rawText: '',
          price: 2.99,
          unit: 'lb',
          dealType: 'regular',
          confidence: 0.9,
          category: 'protein'
        },
        {
          id: 'deal-2',
          adId: 'ad-1',
          productName: 'Ground Beef 80/20',
          rawText: '',
          price: 4.49,
          unit: 'lb',
          dealType: 'regular',
          confidence: 0.85,
          category: 'protein'
        },
        {
          id: 'deal-3',
          adId: 'ad-1',
          productName: 'Bananas',
          rawText: '',
          price: 0.49,
          unit: 'lb',
          dealType: 'regular',
          confidence: 0.95,
          category: 'produce'
        }
      ];

      const result = service.matchDealsToList(deals, SHOPPING_LIST_ITEMS);

      expect(result.matches.length).toBeGreaterThanOrEqual(2);
    });

    // Test 27
    it('should calculate total savings', () => {
      const deals: ExtractedDeal[] = [
        {
          id: 'deal-1',
          adId: 'ad-1',
          productName: 'Chicken Breast',
          rawText: '',
          price: 2.99,
          unit: 'lb',
          dealType: 'regular',
          confidence: 0.9,
          category: 'protein',
          originalPrice: 4.99
        }
      ];

      const result = service.matchDealsToList(deals, SHOPPING_LIST_ITEMS);

      expect(result.totalSavings).toBeGreaterThan(0);
    });

    // Test 28
    it('should track unmatched deals', () => {
      const deals: ExtractedDeal[] = [
        {
          id: 'deal-1',
          adId: 'ad-1',
          productName: 'Exotic Fruit',
          rawText: '',
          price: 9.99,
          unit: 'ea',
          dealType: 'regular',
          confidence: 0.9,
          category: 'produce'
        }
      ];

      const result = service.matchDealsToList(deals, SHOPPING_LIST_ITEMS);

      expect(result.unmatchedDeals).toContain('deal-1');
    });

    // Test 29
    it('should track unmatched shopping items', () => {
      const result = service.matchDealsToList([], SHOPPING_LIST_ITEMS);

      expect(result.unmatchedItems.length).toBe(SHOPPING_LIST_ITEMS.length);
    });
  });

  describe('User Corrections', () => {
    // Test 30
    it('should apply user correction to match', () => {
      const match: DealMatch = {
        dealId: 'deal-1',
        shoppingItemId: 'shop-001',
        shoppingItemName: 'Chicken Breast',
        matchScore: 0.7,
        matchType: 'fuzzy',
        priceReduction: 1.00,
        savingsEstimate: 3.00,
        confirmed: false
      };

      const corrected = service.applyUserCorrection(match, 'shop-002', 'Ground Beef');

      expect(corrected.shoppingItemId).toBe('shop-002');
      expect(corrected.shoppingItemName).toBe('Ground Beef');
      expect(corrected.matchType).toBe('manual');
      expect(corrected.confirmed).toBe(true);
    });

    // Test 31
    it('should confirm a match', () => {
      const match: DealMatch = {
        dealId: 'deal-1',
        shoppingItemId: 'shop-001',
        shoppingItemName: 'Chicken Breast',
        matchScore: 0.9,
        matchType: 'exact',
        priceReduction: 1.00,
        savingsEstimate: 3.00,
        confirmed: false
      };

      const confirmed = service.confirmMatch(match);

      expect(confirmed.confirmed).toBe(true);
    });

    // Test 32
    it('should reject a match', () => {
      const match: DealMatch = {
        dealId: 'deal-1',
        shoppingItemId: 'shop-001',
        shoppingItemName: 'Chicken Breast',
        matchScore: 0.5,
        matchType: 'fuzzy',
        priceReduction: 1.00,
        savingsEstimate: 3.00,
        confirmed: false
      };

      const rejected = service.rejectMatch(match);

      expect(rejected).toBeNull();
    });
  });

  describe('Confidence Levels', () => {
    // Test 33
    it('should return high for scores >= 0.8', () => {
      expect(service.getConfidenceLevel(0.8)).toBe('high');
      expect(service.getConfidenceLevel(0.95)).toBe('high');
    });

    // Test 34
    it('should return medium for scores 0.6-0.8', () => {
      expect(service.getConfidenceLevel(0.6)).toBe('medium');
      expect(service.getConfidenceLevel(0.75)).toBe('medium');
    });

    // Test 35
    it('should return low for scores < 0.6', () => {
      expect(service.getConfidenceLevel(0.5)).toBe('low');
      expect(service.getConfidenceLevel(0.3)).toBe('low');
    });
  });
});
