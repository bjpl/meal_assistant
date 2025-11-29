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

import { v4 as uuidv4 } from 'uuid';
import { priceIntelligenceService, DataQualityStatusResponse } from './priceIntelligence';

/**
 * Common receipt patterns for parsing
 */
export const RECEIPT_PATTERNS = {
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
 * Component name normalization mappings
 */
const COMPONENT_ALIASES: Record<string, string> = {
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
  'tom': 'tomato'
};

/**
 * Processing status
 */
export type ProcessingStatus = 'processing' | 'completed' | 'failed';

/**
 * Receipt scan record
 */
export interface ReceiptScan {
  id: string;
  userId: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  processingStatus: ProcessingStatus;
  rawText?: string;
  storeId?: string | null;
  storeName?: string;
  storeAddress?: string | null;
  receiptDate?: string;
  receiptTotal?: number;
  receiptTax?: number;
  receiptSubtotal?: number;
  extractedItems?: ExtractedItem[];
  itemsFound?: number;
  itemsMatched?: number;
  pricesCaptured?: number;
  confidenceScore?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extracted item
 */
export interface ExtractedItem {
  id: string;
  rawLine: string;
  productName: string;
  normalizedName: string;
  quantity: number;
  unit: string;
  price: number;
  unitPrice: number;
  confidence: number;
}

/**
 * Matched item
 */
export interface MatchedItem extends ExtractedItem {
  matched: boolean;
  componentId: string | null;
  componentName: string | null;
  matchConfidence: number;
  matchType: 'none' | 'exact' | 'partial' | 'manual';
}

/**
 * Store information
 */
export interface StoreInfo {
  storeId: string | null;
  storeName: string;
  address: string | null;
  confidence: number;
}

/**
 * Receipt metadata
 */
export interface ReceiptMetadata {
  date: string | null;
  total: number | null;
  tax: number | null;
  subtotal: number | null;
}

/**
 * Captured price result
 */
export interface CapturedPrice {
  itemId: string;
  componentId: string;
  price: number;
  priceRecordId: string;
  dataQuality: DataQualityStatusResponse;
}

/**
 * Process receipt options
 */
export interface ProcessReceiptOptions {
  userId: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  rawText?: string | null;
  storeId?: string | null;
  storeHint?: string | null;
}

/**
 * Process receipt result
 */
export interface ProcessReceiptResult {
  success: boolean;
  scan?: {
    id: string;
    processingStatus: ProcessingStatus;
    storeIdentified: string;
    receiptDate?: string;
    receiptTotal?: number;
    itemsFound: number;
    itemsMatched: number;
    pricesCaptured: number;
    confidenceScore: number;
  };
  items?: MatchedItem[];
  metadata?: ReceiptMetadata;
  pricesCaptured?: CapturedPrice[];
  scanId?: string;
  error?: string;
  processingStatus?: ProcessingStatus;
}

/**
 * Component mapping
 */
interface ComponentMapping {
  keywords: string[];
  componentId: string;
  componentName: string;
}

/**
 * Component match
 */
interface ComponentMatch {
  componentId: string;
  componentName: string;
  confidence: number;
  type: 'exact' | 'partial';
}

/**
 * Item correction
 */
export interface ItemCorrection {
  productName?: string;
  price?: number;
  quantity?: number;
  componentId?: string;
}

/**
 * In-memory storage for receipt scans
 */
const receiptStore: {
  scans: Map<string, ReceiptScan>;
  extractedItems: Map<string, MatchedItem[]>;
} = {
  scans: new Map(),
  extractedItems: new Map()
};

export class ReceiptOcrService {
  constructor() {
    // Component and store libraries would be populated from database in production
  }

  /**
   * Process a receipt image and extract prices
   */
  async processReceipt(options: ProcessReceiptOptions): Promise<ProcessReceiptResult> {
    const {
      userId,
      fileUrl,
      fileType,
      fileSize,
      rawText = null,
      storeId = null,
      storeHint = null
    } = options;

    const scanId = uuidv4();

    // Create scan record
    const scan: ReceiptScan = {
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
      scan.receiptDate = metadata.date || undefined;
      scan.receiptTotal = metadata.total || undefined;
      scan.receiptTax = metadata.tax || undefined;
      scan.receiptSubtotal = metadata.subtotal || undefined;

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
        scan.storeId || null,
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
          storeIdentified: scan.storeName || 'Unknown',
          receiptDate: scan.receiptDate,
          receiptTotal: scan.receiptTotal,
          itemsFound: scan.itemsFound || 0,
          itemsMatched: scan.itemsMatched || 0,
          pricesCaptured: scan.pricesCaptured || 0,
          confidenceScore: scan.confidenceScore || 0
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
      scan.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      scan.updatedAt = new Date().toISOString();

      return {
        success: false,
        scanId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingStatus: 'failed'
      };
    }
  }

  /**
   * Extract text from receipt image
   * In production, integrate with Google Vision, AWS Textract, or similar
   */
  private async extractText(_fileUrl: string, _fileType: string): Promise<string> {
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
   */
  private identifyStore(text: string, providedStoreId: string | null, storeHint: string | null): StoreInfo {
    // If store ID provided, use it
    if (providedStoreId) {
      return {
        storeId: providedStoreId,
        storeName: 'Unknown',
        address: null,
        confidence: 100
      };
    }

    // Try to match store from text
    for (const pattern of RECEIPT_PATTERNS.STORE_HEADERS) {
      const match = text.match(pattern);
      if (match) {
        return {
          storeId: null,
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
   */
  private extractAddress(text: string): string | null {
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
   */
  private extractMetadata(text: string): ReceiptMetadata {
    const metadata: ReceiptMetadata = {
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
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        metadata.date = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }
    }

    // Extract total
    const totalMatch = text.match(RECEIPT_PATTERNS.TOTAL);
    if (totalMatch) {
      const totalStr = totalMatch[2] || totalMatch[0].match(/\d+\.\d{2}/)?.[0];
      metadata.total = totalStr ? parseFloat(totalStr) : null;
    }

    // Extract tax
    const taxMatch = text.match(RECEIPT_PATTERNS.TAX);
    if (taxMatch) {
      const taxStr = taxMatch[2] || taxMatch[0].match(/\d+\.\d{2}/)?.[0];
      metadata.tax = taxStr ? parseFloat(taxStr) : null;
    }

    // Calculate subtotal if not found
    if (metadata.total && metadata.tax && !metadata.subtotal) {
      metadata.subtotal = Math.round((metadata.total - metadata.tax) * 100) / 100;
    }

    return metadata;
  }

  /**
   * Extract line items from receipt text
   */
  private async extractLineItems(text: string): Promise<ExtractedItem[]> {
    const items: ExtractedItem[] = [];
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
   */
  private isMetaLine(line: string): boolean {
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
   */
  private parseItemLine(line: string): ExtractedItem | null {
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
   */
  private cleanProductName(name: string): string {
    return name
      .replace(/\s+/g, ' ')           // Multiple spaces to single
      .replace(/[^\w\s\-']/g, '')     // Remove special chars except dash and apostrophe
      .trim();
  }

  /**
   * Normalize product name for matching
   */
  private normalizeProductName(name: string): string {
    let normalized = name.toLowerCase();

    // Expand abbreviations
    for (const [abbr, full] of Object.entries(COMPONENT_ALIASES)) {
      normalized = normalized.replace(new RegExp(`\\b${abbr}\\b`, 'gi'), full);
    }

    return normalized.trim();
  }

  /**
   * Calculate confidence for extracted item
   */
  private calculateItemConfidence(name: string, price: number): number {
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
   */
  private async matchToComponents(items: ExtractedItem[], _userId: string): Promise<MatchedItem[]> {
    const matchedItems: MatchedItem[] = [];

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
   */
  private async findBestComponentMatch(normalizedName: string): Promise<ComponentMatch | null> {
    // In production, this would query the components table with fuzzy matching
    // For now, use simple keyword matching

    // Common components mapping (simplified)
    const componentMappings: ComponentMapping[] = [
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

    let bestMatch: ComponentMatch | null = null;
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
   */
  private async capturePrices(
    matchedItems: MatchedItem[],
    storeId: string | null,
    receiptDate: string | undefined,
    userId: string
  ): Promise<CapturedPrice[]> {
    const capturedPrices: CapturedPrice[] = [];

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
              isDeal: false,
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
          console.error(`Failed to capture price for ${item.productName}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }

    return capturedPrices;
  }

  /**
   * Calculate overall scan confidence
   */
  private calculateConfidence(scan: ReceiptScan): number {
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
    if (scan.itemsFound && scan.itemsFound > 0 && scan.itemsMatched !== undefined) {
      const matchRate = scan.itemsMatched / scan.itemsFound;
      score += Math.round(matchRate * 10);
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get scan details
   */
  async getScanDetails(scanId: string): Promise<{ error?: string; scan?: Partial<ReceiptScan>; items?: MatchedItem[] }> {
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
   */
  async listUserScans(userId: string, options: {
    status?: ProcessingStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ scans: ReceiptScan[]; total: number; hasMore: boolean }> {
    const { status, limit = 20, offset = 0 } = options;

    let scans = Array.from(receiptStore.scans.values())
      .filter(s => s.userId === userId);

    if (status) {
      scans = scans.filter(s => s.processingStatus === status);
    }

    // Sort by date descending
    scans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      scans: scans.slice(offset, offset + limit),
      total: scans.length,
      hasMore: offset + limit < scans.length
    };
  }

  /**
   * Manually correct an extracted item
   */
  async correctItem(
    scanId: string,
    itemId: string,
    corrections: ItemCorrection
  ): Promise<{ error?: string; success?: boolean; item?: MatchedItem }> {
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
export const receiptOcrService = new ReceiptOcrService();
