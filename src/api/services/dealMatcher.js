/**
 * Deal Matcher Service
 * Matches extracted ad deals to shopping list items
 * Uses fuzzy matching algorithms for product name similarity
 */

const { v4: uuidv4 } = require('uuid');

// Match method priorities (higher = more reliable)
const MATCH_METHODS = {
  exact: { priority: 5, minConfidence: 95 },
  fuzzy_high: { priority: 4, minConfidence: 80 },
  fuzzy_medium: { priority: 3, minConfidence: 65 },
  category: { priority: 2, minConfidence: 50 },
  brand: { priority: 2, minConfidence: 55 },
  ml: { priority: 4, minConfidence: 75 }
};

// Category mappings for fallback matching
const CATEGORY_KEYWORDS = {
  protein: ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp', 'eggs', 'turkey', 'bacon', 'ham', 'sausage'],
  dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'sour cream'],
  produce: ['apple', 'banana', 'orange', 'lettuce', 'tomato', 'onion', 'potato', 'carrot', 'broccoli', 'spinach'],
  grains: ['bread', 'rice', 'pasta', 'oats', 'cereal', 'flour', 'tortilla'],
  beverages: ['juice', 'water', 'soda', 'coffee', 'tea'],
  canned: ['beans', 'soup', 'tomatoes', 'corn', 'tuna'],
  frozen: ['ice cream', 'frozen', 'pizza'],
  snacks: ['chips', 'crackers', 'cookies', 'candy']
};

class DealMatcher {
  constructor() {
    this.correctionHistory = [];
  }

  /**
   * Match deals to shopping list items
   * @param {Array} deals - Array of ad deals
   * @param {string} shoppingListId - Shopping list ID
   * @param {Array} shoppingItems - Shopping list items
   * @param {Object} options - Matching options
   * @returns {Promise<Object>} Match results
   */
  async matchToShoppingList(deals, shoppingListId, shoppingItems, options = {}) {
    const matches = [];
    const unmatched = [];
    const minConfidence = options.minConfidence || 50;

    for (const item of shoppingItems) {
      const itemMatches = this.findMatchesForItem(item, deals, minConfidence);

      if (itemMatches.length > 0) {
        // Take best match
        const bestMatch = itemMatches[0];
        matches.push({
          id: uuidv4(),
          shopping_list_item_id: item.id,
          shopping_item_name: item.name,
          ad_deal_id: bestMatch.deal.id,
          deal_product_name: bestMatch.deal.product_name,
          match_confidence: bestMatch.confidence,
          match_method: bestMatch.method,
          match_factors: bestMatch.factors,
          potential_savings: bestMatch.deal.savings_amount || null,
          deal_price: bestMatch.deal.price,
          user_confirmed: false,
          auto_applied: false,
          all_candidates: itemMatches.slice(0, 5) // Top 5 candidates
        });
      } else {
        unmatched.push({
          shopping_list_item_id: item.id,
          shopping_item_name: item.name,
          reason: 'No deals found matching this item'
        });
      }
    }

    // Calculate summary statistics
    const totalPotentialSavings = matches.reduce((sum, m) => sum + (m.potential_savings || 0), 0);
    const avgConfidence = matches.length > 0
      ? Math.round(matches.reduce((sum, m) => sum + m.match_confidence, 0) / matches.length)
      : 0;

    return {
      shoppingListId,
      matches,
      unmatched,
      summary: {
        totalItems: shoppingItems.length,
        matchedItems: matches.length,
        unmatchedItems: unmatched.length,
        matchRate: Math.round((matches.length / shoppingItems.length) * 100),
        totalPotentialSavings,
        averageConfidence: avgConfidence
      }
    };
  }

  /**
   * Find all matching deals for a shopping item
   * @param {Object} item - Shopping list item
   * @param {Array} deals - Available deals
   * @param {number} minConfidence - Minimum confidence threshold
   * @returns {Array} Sorted matches
   */
  findMatchesForItem(item, deals, minConfidence = 50) {
    const matches = [];

    for (const deal of deals) {
      const matchResult = this.calculateMatch(item, deal);

      if (matchResult.confidence >= minConfidence) {
        matches.push({
          deal,
          ...matchResult
        });
      }
    }

    // Sort by confidence (descending), then by savings (descending)
    return matches.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return (b.deal.savings_amount || 0) - (a.deal.savings_amount || 0);
    });
  }

  /**
   * Calculate match between shopping item and deal
   * @param {Object} item - Shopping list item
   * @param {Object} deal - Ad deal
   * @returns {Object} Match result with confidence and method
   */
  calculateMatch(item, deal) {
    const itemName = this.normalizeName(item.name);
    const dealName = this.normalizeName(deal.product_name);
    const factors = {};

    // Try exact match first
    if (itemName === dealName) {
      return {
        confidence: 100,
        method: 'exact',
        factors: { exactMatch: true }
      };
    }

    // Calculate similarity score
    let confidence = 0;
    let method = 'fuzzy_medium';

    // String similarity
    const similarity = this.calculateSimilarity(itemName, dealName);
    factors.stringSimilarity = Math.round(similarity * 100);

    // Word overlap
    const itemWords = new Set(itemName.split(/\s+/));
    const dealWords = new Set(dealName.split(/\s+/));
    const commonWords = [...itemWords].filter(w => dealWords.has(w));
    const wordOverlap = commonWords.length / Math.max(itemWords.size, dealWords.size);
    factors.wordOverlap = Math.round(wordOverlap * 100);

    // Containment check
    const containment = itemName.includes(dealName) || dealName.includes(itemName);
    factors.containment = containment;

    // Brand matching
    if (item.brand && deal.product_brand) {
      const brandMatch = this.normalizeName(item.brand) === this.normalizeName(deal.product_brand);
      factors.brandMatch = brandMatch;
      if (brandMatch) confidence += 15;
    }

    // Category matching
    const itemCategory = this.inferCategory(itemName);
    const dealCategory = this.inferCategory(dealName);
    const categoryMatch = itemCategory && dealCategory && itemCategory === dealCategory;
    factors.categoryMatch = categoryMatch;

    // Calculate final confidence
    if (containment) {
      confidence = Math.max(85, confidence);
      method = 'fuzzy_high';
    } else if (similarity > 0.8) {
      confidence = Math.max(75, similarity * 90);
      method = 'fuzzy_high';
    } else if (wordOverlap > 0.5) {
      confidence = Math.max(60, wordOverlap * 75);
      method = 'fuzzy_medium';
    } else if (categoryMatch && similarity > 0.4) {
      confidence = Math.max(50, similarity * 60);
      method = 'category';
    } else {
      confidence = similarity * 50;
      method = 'fuzzy_medium';
    }

    return {
      confidence: Math.round(Math.min(99, confidence)), // Max 99 for non-exact
      method,
      factors
    };
  }

  /**
   * Normalize product name for comparison
   * @param {string} name - Product name
   * @returns {string} Normalized name
   */
  normalizeName(name) {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Remove special chars
      .replace(/\s+/g, ' ')       // Normalize spaces
      .replace(/\b(oz|lb|ct|pk|pack|count)\b/gi, '') // Remove units
      .replace(/\d+/g, '')        // Remove numbers
      .trim();
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * @param {string} s1 - First string
   * @param {string} s2 - Second string
   * @returns {number} Similarity ratio (0-1)
   */
  calculateSimilarity(s1, s2) {
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein edit distance
   * @param {string} s1 - First string
   * @param {string} s2 - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(s1, s2) {
    const matrix = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  /**
   * Infer category from product name
   * @param {string} name - Product name
   * @returns {string|null} Category or null
   */
  inferCategory(name) {
    const normalized = name.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (normalized.includes(keyword)) {
          return category;
        }
      }
    }

    return null;
  }

  /**
   * Apply user correction to a deal match
   * @param {string} dealId - Deal ID
   * @param {Object} correction - User's corrections
   * @returns {Object} Updated deal
   */
  async applyCorrection(dealId, correction) {
    const correctionRecord = {
      id: uuidv4(),
      dealId,
      correction,
      timestamp: new Date().toISOString()
    };

    this.correctionHistory.push(correctionRecord);

    // In production, update the database and potentially retrain template
    return {
      success: true,
      correctionId: correctionRecord.id,
      updatedFields: Object.keys(correction)
    };
  }

  /**
   * Confirm a deal match
   * @param {string} matchId - Match ID
   * @param {boolean} confirmed - Confirmation status
   * @returns {Object} Updated match
   */
  async confirmMatch(matchId, confirmed = true) {
    return {
      matchId,
      user_confirmed: confirmed,
      confirmed_at: new Date().toISOString()
    };
  }

  /**
   * Auto-apply high-confidence matches
   * @param {Array} matches - Array of matches
   * @param {number} threshold - Confidence threshold for auto-apply
   * @returns {Object} Auto-apply results
   */
  autoApplyMatches(matches, threshold = 90) {
    const applied = [];
    const pending = [];

    for (const match of matches) {
      if (match.match_confidence >= threshold) {
        applied.push({
          ...match,
          auto_applied: true,
          applied_at: new Date().toISOString()
        });
      } else {
        pending.push(match);
      }
    }

    return {
      applied,
      pending,
      autoAppliedCount: applied.length,
      pendingReviewCount: pending.length
    };
  }

  /**
   * Get correction statistics for template improvement
   * @param {string} templateId - Template ID
   * @returns {Object} Correction statistics
   */
  getCorrectionStats(templateId) {
    const templateCorrections = this.correctionHistory.filter(
      c => c.templateId === templateId
    );

    const fieldCounts = {};
    for (const correction of templateCorrections) {
      for (const field of Object.keys(correction.correction || {})) {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      }
    }

    return {
      templateId,
      totalCorrections: templateCorrections.length,
      fieldCounts,
      mostCorrectedFields: Object.entries(fieldCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([field, count]) => ({ field, count }))
    };
  }

  /**
   * Find deals for a specific component
   * @param {string} componentId - Component ID
   * @param {Array} deals - Available deals
   * @param {string} componentName - Component name
   * @returns {Array} Matching deals
   */
  findDealsForComponent(componentId, deals, componentName) {
    return this.findMatchesForItem(
      { id: componentId, name: componentName },
      deals,
      40 // Lower threshold for component matching
    );
  }
}

// Singleton instance
const dealMatcher = new DealMatcher();

module.exports = {
  DealMatcher,
  dealMatcher,
  MATCH_METHODS,
  CATEGORY_KEYWORDS
};
