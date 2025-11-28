/**
 * Receipt OCR Service
 * Week 7-8: Extract prices from receipt photos
 *
 * Key features:
 * - Receipt image processing and text extraction
 * - Store identification
 * - Line item parsing (product name, quantity, price)
 * - Component matching for price intelligence
 * - Multi-item receipt handling
 */

const { v4: uuidv4 } = require('uuid');
const { priceIntelligenceService } = require('./priceIntelligence');

/**
 * Common receipt patterns for parsing
 */
const RECEIPT_PATTERNS = {
  // Price patterns: $X.XX, X.XX, etc.
  PRICE: /\$?\d{1,4}\.\d{2}/g,

  // Quantity patterns: Xkg, X lb, X oz, etc.
  QUANTITY: /(\d+\.?\d*)\s*(kg|lb|lbs|oz|g|ml|l|ct|count|ea|each|pack|pk)/gi,

  // Common store header patterns
  STORE_HEADERS: [
    /walmart/i,
    /target/i,
    /kroger/i,
    /costco/i,
    /whole\s*foods/i,
    /safeway/i,
    /trader\s*joe'?s?/i,
    /aldi/i,
    /publix/i,
    /wegmans/i,
    /h-?e-?b/i,
    /albertsons/i
  ],

  // Date patterns
  DATE: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g,

  // Total patterns
  TOTAL: /(total|subtotal|sub-?total|amount\s*due|balance\s*due)[:\s]*\$?(\d+\.\d{2})/gi,

  // Tax patterns
  TAX: /(tax|sales\s*tax)[:\s]*\$?(\d+\.\d{2})/gi
};

/**
 * In-memory storage for receipt scans
 */
const receiptStore = {
  scans: new Map(),
  extractedItems: new Map()
};

/**
 * Component name normalization mappings
 */
const COMPONENT_ALIASES = {
  // Proteins
  'chkn': 'chicken',
  'chk': 'chicken',
  'bnls': 'boneless',
  'sklss': 'skinless',
  'brst': 'breast',
  'thgh': 'thigh',
  'brf': 'beef',
  'grnd': 'ground',
  'trky': 'turkey',
  'pork': 'pork',
  'slmn': 'salmon',

  // Dairy
  'mlk': 'milk',
  'chz': 'cheese',
  'ygt': 'yogurt',
  'org': 'organic',

  // Produce
  'veg': 'vegetables',
  'frt': 'fruit',
  'bnn': 'banana',
  'apl': 'apple',
  'org': 'organic',
  'tom': 'tomato'
};

class ReceiptOcrService {
  constructor() {
    this.componentLibrary = new Map(); // Should be populated from database
    this.storeLibrary = new Map();     // Store name -> store ID mapping
  }

  /**
   * Process a receipt image and extract prices
   * @param {Object} options - Processing options
   * @returns {Object} Extraction results
   */
  async processReceipt(options) {
    const {
      userId,
      fileUrl,
      fileType,
      fileSize,
      rawText = null,  // If OCR already performed
      storeId = null,
      storeHint = null // User-provided store name hint
    } = options;

    const scanId = uuidv4();

    // Create scan record
    const scan = {
      id: scanId,
      userId,
      fileUrl,
      fileType,
      fileSize,
      processingStatus: 'processing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    receiptStore.scans.set(scanId, scan);

    try {
      // Step 1: Extract text (simulated - in production, use cloud OCR service)
      const text = rawText || await this.extractText(fileUrl, fileType);
      scan.rawText = text;

      // Step 2: Identify store
      const storeInfo = this.identifyStore(text, storeId, storeHint);
      scan.storeId = storeInfo.storeId;
      scan.storeName = storeInfo.storeName;
      scan.storeAddress = storeInfo.address;

      // Step 3: Extract receipt metadata
      const metadata = this.extractMetadata(text);
      scan.receiptDate = metadata.date;
      scan.receiptTotal = metadata.total;
      scan.receiptTax = metadata.tax;
      scan.receiptSubtotal = metadata.subtotal;

      // Step 4: Extract line items
      const items = await this.extractLineItems(text);
      scan.extractedItems = items;
      scan.itemsFound = items.length;

      // Step 5: Match items to components
      const matchedItems = await this.matchToComponents(items, userId);
      scan.itemsMatched = matchedItems.filter(i => i.matched).length;

      // Step 6: Capture prices for matched items
      const capturedPrices = await this.capturePrices(
        matchedItems,
        scan.storeId,
        scan.receiptDate,
        userId
      );
      scan.pricesCaptured = capturedPrices.length;

      // Update scan status
      scan.processingStatus = 'completed';
      scan.confidenceScore = this.calculateConfidence(scan);
      scan.updatedAt = new Date().toISOString();

      // Store extracted items
      receiptStore.extractedItems.set(scanId, matchedItems);

      return {
        success: true,
        scan: {
          id: scanId,
          processingStatus: scan.processingStatus,
          storeIdentified: scan.storeName,
          receiptDate: scan.receiptDate,
          receiptTotal: scan.receiptTotal,
          itemsFound: scan.itemsFound,
          itemsMatched: scan.itemsMatched,
          pricesCaptured: scan.pricesCaptured,
          confidenceScore: scan.confidenceScore
        },
        items: matchedItems,
        metadata: {
          date: metadata.date,
          total: metadata.total,
          tax: metadata.tax,
          subtotal: metadata.subtotal
        },
        pricesCaptured: capturedPrices
      };

    } catch (error) {
      scan.processingStatus = 'failed';
      scan.errorMessage = error.message;
      scan.updatedAt = new Date().toISOString();

      return {
        success: false,
        scanId,
        error: error.message,
        processingStatus: 'failed'
      };
    }
  }

  /**
   * Extract text from receipt image
   * In production, integrate with Google Vision, AWS Textract, or similar
   * @private
   */
  async extractText(fileUrl, fileType) {
    // Simulated OCR result - in production, call cloud OCR API
    // This would return the raw text extracted from the image

    // For demo purposes, return a sample receipt text
    return `
      WALMART
      1234 Main Street
      Anytown, ST 12345

      Date: 11/22/2025

      CHICKEN BREAST BNLS    2.5 LB @ $3.99/LB    $9.98
      EGGS LARGE 18CT                              $4.29
      ORGANIC MILK GAL                             $5.99
      BROWN RICE 2LB                               $3.49
      BROCCOLI CROWNS                              $2.99
      GROUND BEEF 93%        1.5 LB @ $5.99/LB    $8.99
      CHEDDAR CHEESE SHRD                          $4.49
      GREEK YOGURT PLAIN                           $3.99
      BLACK BEANS 15OZ                             $1.29
      AVOCADOS 3CT                                 $4.99

      SUBTOTAL                                    $50.49
      TAX                                          $3.54
      TOTAL                                       $54.03

      Thank you for shopping at Walmart!
    `;
  }

  /**
   * Identify store from receipt text
   * @private
   */
  identifyStore(text, providedStoreId, storeHint) {
    // If store ID provided, use it
    if (providedStoreId) {
      return {
        storeId: providedStoreId,
        storeName: null,
        address: null,
        confidence: 100
      };
    }

    // Try to match store from text
    for (const pattern of RECEIPT_PATTERNS.STORE_HEADERS) {
      const match = text.match(pattern);
      if (match) {
        return {
          storeId: null, // Would look up in database
          storeName: match[0],
          address: this.extractAddress(text),
          confidence: 90
        };
      }
    }

    // Use hint if provided
    if (storeHint) {
      return {
        storeId: null,
        storeName: storeHint,
        address: this.extractAddress(text),
        confidence: 70
      };
    }

    return {
      storeId: null,
      storeName: 'Unknown Store',
      address: null,
      confidence: 0
    };
  }

  /**
   * Extract store address from text
   * @private
   */
  extractAddress(text) {
    // Look for address pattern (simplified)
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      if (/\d+\s+\w+\s+(street|st|avenue|ave|road|rd|blvd|drive|dr)/i.test(lines[i])) {
        return lines[i];
      }
    }

    return null;
  }

  /**
   * Extract receipt metadata (date, total, tax)
   * @private
   */
  extractMetadata(text) {
    const metadata = {
      date: null,
      total: null,
      tax: null,
      subtotal: null
    };

    // Extract date
    const dateMatch = text.match(RECEIPT_PATTERNS.DATE);
    if (dateMatch) {
      // Parse and format date
      const parts = dateMatch[0].split(/[\/\-]/);
      if (parts.length === 3) {
        let year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        metadata.date = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }
    }

    // Extract total
    const totalMatch = text.match(RECEIPT_PATTERNS.TOTAL);
    if (totalMatch) {
      metadata.total = parseFloat(totalMatch[2] || totalMatch[0].match(/\d+\.\d{2}/)?.[0]);
    }

    // Extract tax
    const taxMatch = text.match(RECEIPT_PATTERNS.TAX);
    if (taxMatch) {
      metadata.tax = parseFloat(taxMatch[2] || taxMatch[0].match(/\d+\.\d{2}/)?.[0]);
    }

    // Calculate subtotal if not found
    if (metadata.total && metadata.tax && !metadata.subtotal) {
      metadata.subtotal = Math.round((metadata.total - metadata.tax) * 100) / 100;
    }

    return metadata;
  }

  /**
   * Extract line items from receipt text
   * @private
   */
  async extractLineItems(text) {
    const items = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    for (const line of lines) {
      // Skip header/footer lines
      if (this.isMetaLine(line)) continue;

      // Try to extract item from line
      const item = this.parseItemLine(line);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Check if line is metadata (store name, address, total, etc.)
   * @private
   */
  isMetaLine(line) {
    const metaPatterns = [
      /^(walmart|target|kroger|costco|whole\s*foods)/i,
      /^\d+\s+\w+\s+(street|st|avenue|ave)/i,
      /^(subtotal|total|tax|thank|date:|store)/i,
      /^\*{3,}/,
      /^-{3,}/,
      /^#{3,}/
    ];

    return metaPatterns.some(p => p.test(line));
  }

  /**
   * Parse a single item line
   * @private
   */
  parseItemLine(line) {
    // Match price at end of line
    const priceMatch = line.match(/\$?(\d{1,4}\.\d{2})\s*$/);
    if (!priceMatch) return null;

    const price = parseFloat(priceMatch[1]);
    let remaining = line.replace(priceMatch[0], '').trim();

    // Try to extract quantity and unit price
    let quantity = 1;
    let unit = 'count';
    let unitPrice = price;

    // Look for "X.XX LB @ $X.XX/LB" pattern
    const weightMatch = remaining.match(/(\d+\.?\d*)\s*(lb|lbs|kg|oz)\s*@\s*\$?(\d+\.\d{2})/i);
    if (weightMatch) {
      quantity = parseFloat(weightMatch[1]);
      unit = weightMatch[2].toLowerCase();
      unitPrice = parseFloat(weightMatch[3]);
      remaining = remaining.replace(weightMatch[0], '').trim();
    }

    // Look for count pattern (e.g., "18CT", "3PK")
    const countMatch = remaining.match(/(\d+)\s*(ct|pk|pack|count|ea)/i);
    if (countMatch) {
      quantity = parseInt(countMatch[1]);
      unit = 'count';
      unitPrice = price / quantity;
      remaining = remaining.replace(countMatch[0], '').trim();
    }

    // Clean up product name
    const productName = this.cleanProductName(remaining);

    if (!productName || productName.length < 2) return null;

    return {
      id: uuidv4(),
      rawLine: line,
      productName,
      normalizedName: this.normalizeProductName(productName),
      quantity,
      unit,
      price,
      unitPrice: Math.round(unitPrice * 100) / 100,
      confidence: this.calculateItemConfidence(productName, price)
    };
  }

  /**
   * Clean product name from receipt abbreviations
   * @private
   */
  cleanProductName(name) {
    return name
      .replace(/\s+/g, ' ')           // Multiple spaces to single
      .replace(/[^\w\s\-']/g, '')     // Remove special chars except dash and apostrophe
      .trim();
  }

  /**
   * Normalize product name for matching
   * @private
   */
  normalizeProductName(name) {
    let normalized = name.toLowerCase();

    // Expand abbreviations
    for (const [abbr, full] of Object.entries(COMPONENT_ALIASES)) {
      normalized = normalized.replace(new RegExp(`\\b${abbr}\\b`, 'gi'), full);
    }

    return normalized.trim();
  }

  /**
   * Calculate confidence for extracted item
   * @private
   */
  calculateItemConfidence(name, price) {
    let confidence = 70; // Base confidence

    // Higher confidence if price is reasonable
    if (price >= 0.50 && price <= 100) {
      confidence += 10;
    }

    // Higher confidence if name has multiple words
    if (name.split(' ').length >= 2) {
      confidence += 10;
    }

    // Lower confidence for very short names
    if (name.length < 4) {
      confidence -= 20;
    }

    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Match extracted items to component library
   * @private
   */
  async matchToComponents(items, userId) {
    const matchedItems = [];

    for (const item of items) {
      const match = await this.findBestComponentMatch(item.normalizedName);

      matchedItems.push({
        ...item,
        matched: match !== null,
        componentId: match?.componentId || null,
        componentName: match?.componentName || null,
        matchConfidence: match?.confidence || 0,
        matchType: match?.type || 'none'
      });
    }

    return matchedItems;
  }

  /**
   * Find best matching component for an item name
   * @private
   */
  async findBestComponentMatch(normalizedName) {
    // In production, this would query the components table with fuzzy matching
    // For now, use simple keyword matching

    // Common components mapping (simplified)
    const componentMappings = [
      { keywords: ['chicken', 'breast'], componentId: 'chicken-breast-001', componentName: 'Chicken Breast' },
      { keywords: ['chicken', 'thigh'], componentId: 'chicken-thigh-001', componentName: 'Chicken Thigh' },
      { keywords: ['ground', 'beef'], componentId: 'ground-beef-001', componentName: 'Ground Beef' },
      { keywords: ['salmon'], componentId: 'salmon-001', componentName: 'Salmon' },
      { keywords: ['eggs'], componentId: 'eggs-001', componentName: 'Eggs' },
      { keywords: ['milk'], componentId: 'milk-001', componentName: 'Milk' },
      { keywords: ['rice'], componentId: 'rice-001', componentName: 'Rice' },
      { keywords: ['broccoli'], componentId: 'broccoli-001', componentName: 'Broccoli' },
      { keywords: ['cheese'], componentId: 'cheese-001', componentName: 'Cheese' },
      { keywords: ['yogurt'], componentId: 'yogurt-001', componentName: 'Yogurt' },
      { keywords: ['black', 'beans'], componentId: 'black-beans-001', componentName: 'Black Beans' },
      { keywords: ['avocado'], componentId: 'avocado-001', componentName: 'Avocado' }
    ];

    let bestMatch = null;
    let bestScore = 0;

    for (const mapping of componentMappings) {
      let score = 0;
      let matched = 0;

      for (const keyword of mapping.keywords) {
        if (normalizedName.includes(keyword)) {
          matched++;
          score += 30;
        }
      }

      // All keywords must match for a valid match
      if (matched === mapping.keywords.length && score > bestScore) {
        bestScore = score;
        bestMatch = {
          componentId: mapping.componentId,
          componentName: mapping.componentName,
          confidence: Math.min(100, score),
          type: score >= 60 ? 'exact' : 'partial'
        };
      }
    }

    return bestMatch;
  }

  /**
   * Capture prices from matched items
   * @private
   */
  async capturePrices(matchedItems, storeId, receiptDate, userId) {
    const capturedPrices = [];

    for (const item of matchedItems) {
      if (item.matched && item.componentId) {
        try {
          const result = await priceIntelligenceService.capturePrice(
            item.componentId,
            storeId,
            item.price,
            'receipt',
            {
              quantity: item.quantity,
              unit: item.unit,
              isDeal: false, // Regular purchase, not a deal
              capturedBy: userId,
              recordedDate: receiptDate || new Date().toISOString().split('T')[0]
            }
          );

          capturedPrices.push({
            itemId: item.id,
            componentId: item.componentId,
            price: item.price,
            priceRecordId: result.price.id,
            dataQuality: result.dataQuality
          });
        } catch (error) {
          console.error(`Failed to capture price for ${item.productName}:`, error.message);
        }
      }
    }

    return capturedPrices;
  }

  /**
   * Calculate overall scan confidence
   * @private
   */
  calculateConfidence(scan) {
    let score = 50; // Base score

    // Store identified
    if (scan.storeName && scan.storeName !== 'Unknown Store') {
      score += 15;
    }

    // Date extracted
    if (scan.receiptDate) {
      score += 10;
    }

    // Total matches items
    if (scan.receiptTotal && scan.extractedItems) {
      const itemTotal = scan.extractedItems.reduce((sum, i) => sum + i.price, 0);
      if (Math.abs(itemTotal - scan.receiptTotal) < 5) {
        score += 15;
      }
    }

    // Good match rate
    if (scan.itemsFound > 0) {
      const matchRate = scan.itemsMatched / scan.itemsFound;
      score += Math.round(matchRate * 10);
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get scan details
   * @param {string} scanId - Scan ID
   * @returns {Object} Scan details with items
   */
  async getScanDetails(scanId) {
    const scan = receiptStore.scans.get(scanId);
    const items = receiptStore.extractedItems.get(scanId);

    if (!scan) {
      return { error: 'Scan not found' };
    }

    return {
      scan: {
        id: scan.id,
        userId: scan.userId,
        storeName: scan.storeName,
        storeId: scan.storeId,
        receiptDate: scan.receiptDate,
        receiptTotal: scan.receiptTotal,
        receiptTax: scan.receiptTax,
        receiptSubtotal: scan.receiptSubtotal,
        processingStatus: scan.processingStatus,
        itemsFound: scan.itemsFound,
        itemsMatched: scan.itemsMatched,
        pricesCaptured: scan.pricesCaptured,
        confidenceScore: scan.confidenceScore,
        createdAt: scan.createdAt
      },
      items: items || []
    };
  }

  /**
   * List user's receipt scans
   * @param {string} userId - User ID
   * @param {Object} options - Filter options
   * @returns {Array} List of scans
   */
  async listUserScans(userId, options = {}) {
    const { status, limit = 20, offset = 0 } = options;

    let scans = Array.from(receiptStore.scans.values())
      .filter(s => s.userId === userId);

    if (status) {
      scans = scans.filter(s => s.processingStatus === status);
    }

    // Sort by date descending
    scans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      scans: scans.slice(offset, offset + limit),
      total: scans.length,
      hasMore: offset + limit < scans.length
    };
  }

  /**
   * Manually correct an extracted item
   * @param {string} scanId - Scan ID
   * @param {string} itemId - Item ID
   * @param {Object} corrections - Corrections to apply
   * @returns {Object} Updated item
   */
  async correctItem(scanId, itemId, corrections) {
    const items = receiptStore.extractedItems.get(scanId);
    if (!items) {
      return { error: 'Scan not found' };
    }

    const itemIndex = items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) {
      return { error: 'Item not found' };
    }

    const item = items[itemIndex];

    // Apply corrections
    if (corrections.productName) {
      item.productName = corrections.productName;
      item.normalizedName = this.normalizeProductName(corrections.productName);
    }
    if (corrections.price !== undefined) {
      item.price = corrections.price;
    }
    if (corrections.quantity !== undefined) {
      item.quantity = corrections.quantity;
    }
    if (corrections.componentId) {
      item.componentId = corrections.componentId;
      item.matched = true;
      item.matchType = 'manual';
      item.matchConfidence = 100;
    }

    items[itemIndex] = item;
    receiptStore.extractedItems.set(scanId, items);

    return { success: true, item };
  }
}

// Export singleton instance
const receiptOcrService = new ReceiptOcrService();

module.exports = {
  ReceiptOcrService,
  receiptOcrService,
  RECEIPT_PATTERNS
};
