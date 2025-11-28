/**
 * OCR Service
 * Handles text extraction from ad images and PDFs
 * Implements progressive accuracy improvement: 30% -> 85%
 */

const { v4: uuidv4 } = require('uuid');

// In production, use actual Tesseract.js and pdf-parse
// const Tesseract = require('tesseract.js');
// const pdfParse = require('pdf-parse');

// Price extraction patterns
const PRICE_PATTERNS = [
  /\$(\d+)\.(\d{2})/g,                    // $X.XX
  /(\d+)¢/g,                               // X¢
  /(\d+)\s*for\s*\$(\d+)/gi,              // X for $Y
  /buy\s*(\d+)\s*get\s*(\d+)\s*free/gi,   // Buy X Get Y Free
  /(\d+)%\s*off/gi,                        // X% off
  /save\s*\$(\d+\.?\d*)/gi,               // Save $X
  /was\s*\$(\d+\.?\d*)/gi,                // Was $X
  /now\s*\$(\d+\.?\d*)/gi,                // Now $X
  /reg\.?\s*\$(\d+\.?\d*)/gi,             // Reg. $X
  /sale\s*\$(\d+\.?\d*)/gi                // Sale $X
];

// Product name patterns
const PRODUCT_PATTERNS = [
  /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+/gm,  // Capitalized words
  /(?:brand|product):\s*([^\n]+)/gi,         // Brand: X
  /(\d+)\s*(oz|lb|ct|pk|pack)/gi             // Size indicators
];

class OCRService {
  constructor() {
    this.templates = new Map();
    this.extractionMethods = ['regex', 'template', 'ml'];
  }

  /**
   * Process an ad file and extract deals
   * @param {string} fileUrl - URL of the file to process
   * @param {string} storeId - Store ID (optional)
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing results
   */
  async processAd(fileUrl, storeId = null, options = {}) {
    const startTime = Date.now();

    try {
      // 1. Download/fetch the file
      const fileContent = await this.fetchFile(fileUrl);

      // 2. Identify store (if not provided)
      const identifiedStore = storeId || await this.identifyStore(fileContent);

      // 3. Check for existing template
      const template = identifiedStore ? await this.getTemplate(identifiedStore) : null;

      // 4. Extract text using OCR
      const ocrResult = await this.extractText(fileContent, options);

      // 5. Parse deals using progressive extraction
      const deals = await this.extractDeals(ocrResult.text, template, options);

      // 6. Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence(deals);

      return {
        success: true,
        storeId: identifiedStore,
        templateId: template?.id || null,
        ocrConfidence: ocrResult.confidence,
        overallConfidence,
        text: ocrResult.text,
        deals,
        metadata: {
          processingTime: Date.now() - startTime,
          extractionMethod: template ? 'template' : 'regex',
          pageCount: ocrResult.pageCount || 1
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Fetch file content (simulated for development)
   * @param {string} fileUrl - File URL
   * @returns {Promise<Buffer>} File content
   */
  async fetchFile(fileUrl) {
    // In production, fetch actual file
    // For development, return mock data
    return Buffer.from('mock file content');
  }

  /**
   * Identify store from ad image/logo
   * @param {Buffer} fileContent - File content
   * @returns {Promise<string|null>} Store ID or null
   */
  async identifyStore(fileContent) {
    // In production, use logo recognition or text matching
    // For development, return null (unknown store)
    return null;
  }

  /**
   * Get template for a store
   * @param {string} storeId - Store ID
   * @returns {Promise<Object|null>} Template or null
   */
  async getTemplate(storeId) {
    return this.templates.get(storeId) || null;
  }

  /**
   * Extract text from file using OCR
   * @param {Buffer} fileContent - File content
   * @param {Object} options - OCR options
   * @returns {Promise<Object>} OCR result
   */
  async extractText(fileContent, options = {}) {
    // In production, use Tesseract.js
    // const { data: { text, confidence } } = await Tesseract.recognize(
    //   fileContent,
    //   'eng',
    //   { logger: m => console.log(m) }
    // );

    // For development, return simulated data
    const mockText = this.generateMockAdText();

    return {
      text: mockText,
      confidence: 75 + Math.floor(Math.random() * 20), // 75-95%
      pageCount: 1,
      language: 'eng'
    };
  }

  /**
   * Extract deals from OCR text using progressive methods
   * Phase 1: Regex patterns (30-40% accuracy)
   * Phase 2: Template matching (50-60% accuracy)
   * Phase 3: ML model (70-85% accuracy)
   * @param {string} text - OCR extracted text
   * @param {Object} template - Store template (optional)
   * @param {Object} options - Extraction options
   * @returns {Promise<Array>} Extracted deals
   */
  async extractDeals(text, template = null, options = {}) {
    const deals = [];

    // Phase 1: Regex-based extraction (baseline 30-40% accuracy)
    const regexDeals = this.extractWithRegex(text);
    deals.push(...regexDeals.map(d => ({ ...d, extraction_method: 'regex' })));

    // Phase 2: Template-based extraction (improves to 50-60%)
    if (template) {
      const templateDeals = this.extractWithTemplate(text, template);
      // Merge with regex results, preferring template when conflict
      this.mergeDeals(deals, templateDeals, 'template');
    }

    // Phase 3: ML-based extraction (future implementation, 70-85%)
    if (options.useML) {
      const mlDeals = await this.extractWithML(text);
      this.mergeDeals(deals, mlDeals, 'ml');
    }

    // Assign IDs and calculate confidence scores
    return deals.map(deal => ({
      id: uuidv4(),
      ...deal,
      confidence_score: this.calculateDealConfidence(deal)
    }));
  }

  /**
   * Phase 1: Regex-based deal extraction
   * @param {string} text - OCR text
   * @returns {Array} Extracted deals
   */
  extractWithRegex(text) {
    const deals = [];
    const lines = text.split('\n').filter(line => line.trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for price patterns
      for (const pattern of PRICE_PATTERNS) {
        pattern.lastIndex = 0; // Reset regex
        const matches = [...line.matchAll(pattern)];

        for (const match of matches) {
          const deal = this.parsePriceMatch(match, line, i, lines);
          if (deal) {
            deals.push(deal);
          }
        }
      }
    }

    return deals;
  }

  /**
   * Parse a price match into a deal object
   * @param {Array} match - Regex match
   * @param {string} line - Current line
   * @param {number} lineIndex - Line index
   * @param {Array} lines - All lines
   * @returns {Object|null} Deal object or null
   */
  parsePriceMatch(match, line, lineIndex, lines) {
    const rawMatch = match[0];

    // Extract price value
    let price = null;
    let savingsPercent = null;
    let dealType = 'sale';

    if (rawMatch.includes('$')) {
      const priceMatch = rawMatch.match(/\$(\d+\.?\d*)/);
      if (priceMatch) {
        price = parseFloat(priceMatch[1]);
      }
    } else if (rawMatch.includes('¢')) {
      const centMatch = rawMatch.match(/(\d+)¢/);
      if (centMatch) {
        price = parseFloat(centMatch[1]) / 100;
      }
    } else if (rawMatch.toLowerCase().includes('% off')) {
      const percentMatch = rawMatch.match(/(\d+)%/);
      if (percentMatch) {
        savingsPercent = parseInt(percentMatch[1]);
        dealType = 'percent_off';
      }
    } else if (rawMatch.toLowerCase().includes('buy') && rawMatch.toLowerCase().includes('get')) {
      dealType = 'bogo';
    }

    // Try to extract product name from context
    let productName = '';

    // Check previous line for product name
    if (lineIndex > 0) {
      const prevLine = lines[lineIndex - 1].trim();
      if (prevLine && !this.looksLikePrice(prevLine)) {
        productName = prevLine;
      }
    }

    // If no product name from previous line, try current line before price
    if (!productName) {
      const beforePrice = line.substring(0, match.index).trim();
      if (beforePrice && !this.looksLikePrice(beforePrice)) {
        productName = beforePrice;
      }
    }

    if (!productName || productName.length < 2) {
      return null;
    }

    return {
      product_name: this.cleanProductName(productName),
      price,
      savings_percent: savingsPercent,
      deal_type: dealType,
      deal_text_raw: line,
      page_number: 1
    };
  }

  /**
   * Check if text looks like a price
   * @param {string} text - Text to check
   * @returns {boolean} True if looks like price
   */
  looksLikePrice(text) {
    return /^\$?\d+\.?\d*\s*$/.test(text.trim()) ||
           /^\d+¢\s*$/.test(text.trim()) ||
           /^\d+%\s*off\s*$/i.test(text.trim());
  }

  /**
   * Clean and normalize product name
   * @param {string} name - Raw product name
   * @returns {string} Cleaned name
   */
  cleanProductName(name) {
    return name
      .replace(/[^\w\s'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  /**
   * Phase 2: Template-based deal extraction
   * @param {string} text - OCR text
   * @param {Object} template - Store template
   * @returns {Array} Extracted deals
   */
  extractWithTemplate(text, template) {
    const deals = [];

    if (!template || !template.extraction_rules_json) {
      return deals;
    }

    const rules = template.extraction_rules_json;

    // Apply custom price patterns from template
    if (rules.price_patterns) {
      for (const patternStr of rules.price_patterns) {
        try {
          const pattern = new RegExp(patternStr, 'gi');
          const matches = [...text.matchAll(pattern)];
          for (const match of matches) {
            const deal = this.parsePriceMatch(match, text, 0, text.split('\n'));
            if (deal) {
              deals.push({ ...deal, confidence_boost: 15 }); // Template gives confidence boost
            }
          }
        } catch (e) {
          // Invalid pattern, skip
        }
      }
    }

    // Apply field mappings
    if (rules.field_mappings) {
      // Process structured fields based on template
    }

    return deals;
  }

  /**
   * Phase 3: ML-based deal extraction (placeholder)
   * @param {string} text - OCR text
   * @returns {Promise<Array>} Extracted deals
   */
  async extractWithML(text) {
    // In production, call ML model API
    // For development, return empty array
    return [];
  }

  /**
   * Merge deals from different extraction methods
   * @param {Array} existingDeals - Existing deals array
   * @param {Array} newDeals - New deals to merge
   * @param {string} method - Extraction method
   */
  mergeDeals(existingDeals, newDeals, method) {
    for (const newDeal of newDeals) {
      const existing = existingDeals.find(d =>
        this.similarProducts(d.product_name, newDeal.product_name)
      );

      if (existing) {
        // Update with higher confidence method
        if (this.getMethodPriority(method) > this.getMethodPriority(existing.extraction_method)) {
          Object.assign(existing, newDeal, { extraction_method: method });
        }
      } else {
        existingDeals.push({ ...newDeal, extraction_method: method });
      }
    }
  }

  /**
   * Check if two product names are similar
   * @param {string} name1 - First name
   * @param {string} name2 - Second name
   * @returns {boolean} True if similar
   */
  similarProducts(name1, name2) {
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    return n1.includes(n2) || n2.includes(n1) || this.levenshteinSimilarity(n1, n2) > 0.7;
  }

  /**
   * Calculate Levenshtein similarity ratio
   * @param {string} s1 - First string
   * @param {string} s2 - Second string
   * @returns {number} Similarity ratio (0-1)
   */
  levenshteinSimilarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   * @param {string} s1 - First string
   * @param {string} s2 - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Get priority of extraction method
   * @param {string} method - Method name
   * @returns {number} Priority (higher is better)
   */
  getMethodPriority(method) {
    const priorities = { regex: 1, template: 2, ml: 3, manual: 4 };
    return priorities[method] || 0;
  }

  /**
   * Calculate confidence score for a deal
   * @param {Object} deal - Deal object
   * @returns {number} Confidence score (0-100)
   */
  calculateDealConfidence(deal) {
    let confidence = 30; // Base confidence

    // Method bonus
    if (deal.extraction_method === 'template') confidence += 20;
    if (deal.extraction_method === 'ml') confidence += 35;
    if (deal.extraction_method === 'manual') confidence = 100;

    // Field presence bonuses
    if (deal.price) confidence += 10;
    if (deal.product_name && deal.product_name.length > 3) confidence += 10;
    if (deal.savings_percent || deal.savings_amount) confidence += 5;

    // Template confidence boost
    if (deal.confidence_boost) confidence += deal.confidence_boost;

    return Math.min(100, confidence);
  }

  /**
   * Calculate overall confidence for all deals
   * @param {Array} deals - Array of deals
   * @returns {number} Overall confidence (0-100)
   */
  calculateOverallConfidence(deals) {
    if (deals.length === 0) return 0;
    const sum = deals.reduce((acc, d) => acc + (d.confidence_score || 0), 0);
    return Math.round(sum / deals.length);
  }

  /**
   * Apply user correction to a deal
   * @param {Object} originalDeal - Original deal
   * @param {Object} correction - User's corrections
   * @returns {Object} Corrected deal
   */
  applyCorrection(originalDeal, correction) {
    const original_values = {};

    for (const [key, value] of Object.entries(correction)) {
      if (originalDeal[key] !== value) {
        original_values[key] = originalDeal[key];
      }
    }

    return {
      ...originalDeal,
      ...correction,
      user_corrected: true,
      correction_timestamp: new Date().toISOString(),
      original_values,
      confidence_score: 100 // User-corrected is 100% confident
    };
  }

  /**
   * Generate mock ad text for development
   * @returns {string} Mock ad text
   */
  generateMockAdText() {
    return `
WEEKLY SPECIALS - Valid 11/20 - 11/26

Boneless Chicken Breast
$2.99 per lb
Save $1.50

Gala Apples
99¢ per lb

Large Eggs 18ct
$3.49
Reg. $4.99

Ground Beef 80/20
$4.99 per lb
Family Pack

Milk Gallon
$2.99
Buy 2 Get 1 Free

Bread White
$1.99

Bananas
59¢ per lb

Orange Juice 64oz
$3.99
25% off

Canned Tomatoes
2 for $3

Pasta 16oz
$1.29
    `.trim();
  }
}

// Singleton instance
const ocrService = new OCRService();

module.exports = {
  OCRService,
  ocrService,
  PRICE_PATTERNS,
  PRODUCT_PATTERNS
};
