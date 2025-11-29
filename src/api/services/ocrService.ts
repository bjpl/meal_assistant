/**
 * OCR Service
 * Handles text extraction from ad images and PDFs
 * Implements progressive accuracy improvement: 30% -> 85%
 */

import { v4 as uuidv4 } from 'uuid';

// Price extraction patterns
export const PRICE_PATTERNS = [
  /\$(\d+)\.(\d{2})/g,
  /(\d+)¢/g,
  /(\d+)\s*for\s*\$(\d+)/gi,
  /buy\s*(\d+)\s*get\s*(\d+)\s*free/gi,
  /(\d+)%\s*off/gi,
  /save\s*\$(\d+\.?\d*)/gi,
  /was\s*\$(\d+\.?\d*)/gi,
  /now\s*\$(\d+\.?\d*)/gi,
  /reg\.?\s*\$(\d+\.?\d*)/gi,
  /sale\s*\$(\d+\.?\d*)/gi
];

// Product name patterns
export const PRODUCT_PATTERNS = [
  /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+/gm,
  /(?:brand|product):\s*([^\n]+)/gi,
  /(\d+)\s*(oz|lb|ct|pk|pack)/gi
];

interface Deal {
  product_name: string;
  price: number | null;
  savings_percent: number | null;
  deal_type: string;
  deal_text_raw: string;
  page_number: number;
  extraction_method?: string;
  confidence_boost?: number;
  confidence_score?: number;
  id?: string;
}

interface Template {
  id: string;
  extraction_rules_json?: {
    price_patterns?: string[];
    field_mappings?: Record<string, any>;
  };
}

interface OCRResult {
  text: string;
  confidence: number;
  pageCount: number;
  language: string;
}

interface ProcessAdResult {
  success: boolean;
  storeId?: string | null;
  templateId?: string | null;
  ocrConfidence?: number;
  overallConfidence?: number;
  text?: string;
  deals?: Deal[];
  metadata?: {
    processingTime: number;
    extractionMethod: string;
    pageCount: number;
  };
  error?: string;
  processingTime?: number;
}

export class OCRService {
  private templates: Map<string, Template>;

  constructor() {
    this.templates = new Map();
  }

  /**
   * Process an ad file and extract deals
   */
  async processAd(
    _fileUrl: string,
    storeId: string | null = null,
    options: { useML?: boolean } = {}
  ): Promise<ProcessAdResult> {
    const startTime = Date.now();

    try {
      const fileContent = await this.fetchFile(_fileUrl);
      const identifiedStore = storeId || await this.identifyStore(fileContent);
      const template = identifiedStore ? await this.getTemplate(identifiedStore) : null;
      const ocrResult = await this.extractText(fileContent, options);
      const deals = await this.extractDeals(ocrResult.text, template, options);
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
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Fetch file content
   */
  async fetchFile(_fileUrl: string): Promise<Buffer> {
    return Buffer.from('mock file content');
  }

  /**
   * Identify store from ad image/logo
   */
  async identifyStore(_fileContent: Buffer): Promise<string | null> {
    return null;
  }

  /**
   * Get template for a store
   */
  async getTemplate(storeId: string): Promise<Template | null> {
    return this.templates.get(storeId) || null;
  }

  /**
   * Extract text from file using OCR
   */
  async extractText(_fileContent: Buffer, _options: any = {}): Promise<OCRResult> {
    const mockText = this.generateMockAdText();

    return {
      text: mockText,
      confidence: 75 + Math.floor(Math.random() * 20),
      pageCount: 1,
      language: 'eng'
    };
  }

  /**
   * Extract deals from OCR text using progressive methods
   */
  async extractDeals(
    text: string,
    template: Template | null = null,
    options: { useML?: boolean } = {}
  ): Promise<Deal[]> {
    const deals: Deal[] = [];

    // Phase 1: Regex-based extraction
    const regexDeals = this.extractWithRegex(text);
    deals.push(...regexDeals.map(d => ({ ...d, extraction_method: 'regex' })));

    // Phase 2: Template-based extraction
    if (template) {
      const templateDeals = this.extractWithTemplate(text, template);
      this.mergeDeals(deals, templateDeals, 'template');
    }

    // Phase 3: ML-based extraction
    if (options.useML) {
      const mlDeals = await this.extractWithML(text);
      this.mergeDeals(deals, mlDeals, 'ml');
    }

    return deals.map(deal => ({
      id: uuidv4(),
      ...deal,
      confidence_score: this.calculateDealConfidence(deal)
    }));
  }

  /**
   * Phase 1: Regex-based deal extraction
   */
  extractWithRegex(text: string): Deal[] {
    const deals: Deal[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of PRICE_PATTERNS) {
        pattern.lastIndex = 0;
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
   */
  parsePriceMatch(match: RegExpMatchArray, line: string, lineIndex: number, lines: string[]): Deal | null {
    const rawMatch = match[0];

    let price: number | null = null;
    let savingsPercent: number | null = null;
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

    let productName = '';

    if (lineIndex > 0) {
      const prevLine = lines[lineIndex - 1].trim();
      if (prevLine && !this.looksLikePrice(prevLine)) {
        productName = prevLine;
      }
    }

    if (!productName && match.index !== undefined) {
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
   */
  looksLikePrice(text: string): boolean {
    return /^\$?\d+\.?\d*\s*$/.test(text.trim()) ||
           /^\d+¢\s*$/.test(text.trim()) ||
           /^\d+%\s*off\s*$/i.test(text.trim());
  }

  /**
   * Clean and normalize product name
   */
  cleanProductName(name: string): string {
    return name
      .replace(/[^\w\s'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  /**
   * Phase 2: Template-based deal extraction
   */
  extractWithTemplate(text: string, template: Template): Deal[] {
    const deals: Deal[] = [];

    if (!template || !template.extraction_rules_json) {
      return deals;
    }

    const rules = template.extraction_rules_json;

    if (rules.price_patterns) {
      for (const patternStr of rules.price_patterns) {
        try {
          const pattern = new RegExp(patternStr, 'gi');
          const matches = [...text.matchAll(pattern)];
          for (const match of matches) {
            const deal = this.parsePriceMatch(match, text, 0, text.split('\n'));
            if (deal) {
              deals.push({ ...deal, confidence_boost: 15 });
            }
          }
        } catch (e) {
          // Invalid pattern, skip
        }
      }
    }

    return deals;
  }

  /**
   * Phase 3: ML-based deal extraction
   */
  async extractWithML(_text: string): Promise<Deal[]> {
    return [];
  }

  /**
   * Merge deals from different extraction methods
   */
  mergeDeals(existingDeals: Deal[], newDeals: Deal[], method: string): void {
    for (const newDeal of newDeals) {
      const existing = existingDeals.find(d =>
        this.similarProducts(d.product_name, newDeal.product_name)
      );

      if (existing) {
        if (this.getMethodPriority(method) > this.getMethodPriority(existing.extraction_method || 'regex')) {
          Object.assign(existing, newDeal, { extraction_method: method });
        }
      } else {
        existingDeals.push({ ...newDeal, extraction_method: method });
      }
    }
  }

  /**
   * Check if two product names are similar
   */
  similarProducts(name1: string, name2: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    return n1.includes(n2) || n2.includes(n1) || this.levenshteinSimilarity(n1, n2) > 0.7;
  }

  /**
   * Calculate Levenshtein similarity ratio
   */
  levenshteinSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];
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
   */
  getMethodPriority(method: string): number {
    const priorities: Record<string, number> = {
      regex: 1,
      template: 2,
      ml: 3,
      manual: 4
    };
    return priorities[method] || 0;
  }

  /**
   * Calculate confidence score for a deal
   */
  calculateDealConfidence(deal: Deal): number {
    let confidence = 30;

    if (deal.extraction_method === 'template') confidence += 20;
    if (deal.extraction_method === 'ml') confidence += 35;
    if (deal.extraction_method === 'manual') confidence = 100;

    if (deal.price) confidence += 10;
    if (deal.product_name && deal.product_name.length > 3) confidence += 10;
    if (deal.savings_percent) confidence += 5;

    if (deal.confidence_boost) confidence += deal.confidence_boost;

    return Math.min(100, confidence);
  }

  /**
   * Calculate overall confidence for all deals
   */
  calculateOverallConfidence(deals: Deal[]): number {
    if (deals.length === 0) return 0;
    const sum = deals.reduce((acc, d) => acc + (d.confidence_score || 0), 0);
    return Math.round(sum / deals.length);
  }

  /**
   * Generate mock ad text for development
   */
  generateMockAdText(): string {
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
export const ocrService = new OCRService();
