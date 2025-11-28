/**
 * Test Fixtures: Ad Processing System
 * Synthetic dataset for ad OCR, deal extraction, and progressive learning tests
 * Contains 100 ads with 500+ deals for comprehensive testing
 */

// Types for ad system
export interface AdImage {
  id: string;
  storeId: string;
  storeName: string;
  filename: string;
  fileSize: number; // bytes
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  pageCount?: number;
  uploadDate: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ExtractedDeal {
  id: string;
  adId: string;
  productName: string;
  rawText: string;
  price: number;
  unit: string;
  dealType: 'regular' | 'bogo' | 'multi-buy' | 'percent-off' | 'dollar-off';
  quantity?: number;
  originalPrice?: number;
  savingsAmount?: number;
  savingsPercent?: number;
  confidence: number; // 0-1
  category: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  validFrom?: string;
  validTo?: string;
  corrected?: boolean;
  correctionHistory?: CorrectionRecord[];
}

export interface CorrectionRecord {
  field: string;
  originalValue: any;
  correctedValue: any;
  timestamp: string;
  source: 'user' | 'template' | 'ml';
}

export interface DealMatch {
  dealId: string;
  shoppingItemId: string;
  shoppingItemName: string;
  matchScore: number; // 0-1
  matchType: 'exact' | 'fuzzy' | 'category' | 'manual';
  priceReduction: number;
  savingsEstimate: number;
  confirmed: boolean;
}

export interface AdTemplate {
  id: string;
  storeId: string;
  storeName: string;
  version: string;
  regions: TemplateRegion[];
  accuracy: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'active' | 'testing' | 'deprecated';
}

export interface TemplateRegion {
  id: string;
  name: string;
  type: 'product' | 'price' | 'unit' | 'deal-type' | 'date';
  coordinates: { x: number; y: number; width: number; height: number };
  extractionPattern?: string;
  confidence: number;
}

export interface GroundTruthAd {
  ad: AdImage;
  expectedDeals: ExpectedDeal[];
  annotatedBy: string;
  annotatedAt: string;
}

export interface ExpectedDeal {
  productName: string;
  price: number;
  unit: string;
  dealType: string;
  quantity?: number;
}

// Store configurations for different ad formats
export const STORE_CONFIGS = {
  safeway: {
    id: 'store-safeway',
    name: 'Safeway',
    adFormat: 'multi-page-pdf',
    pricePatterns: ['$X.XX', '$X.XX/lb', 'X for $Y'],
    dealTypes: ['weekly-special', 'club-price', 'personalized'],
    avgDealsPerPage: 8
  },
  walmart: {
    id: 'store-walmart',
    name: 'Walmart',
    adFormat: 'single-page-pdf',
    pricePatterns: ['$X.XX', 'Rollback $X.XX', 'Was $X Now $Y'],
    dealTypes: ['rollback', 'clearance', 'everyday-low'],
    avgDealsPerPage: 12
  },
  kroger: {
    id: 'store-kroger',
    name: 'Kroger',
    adFormat: 'multi-page-pdf',
    pricePatterns: ['$X.XX', 'X/$Y', 'Buy X Get X Free'],
    dealTypes: ['weekly', 'digital-coupon', 'fuel-points'],
    avgDealsPerPage: 10
  },
  costco: {
    id: 'store-costco',
    name: 'Costco',
    adFormat: 'multi-page-pdf',
    pricePatterns: ['$XX.XX', '$X.XX OFF', 'INSTANT SAVINGS'],
    dealTypes: ['instant-savings', 'member-only'],
    avgDealsPerPage: 6
  },
  aldi: {
    id: 'store-aldi',
    name: 'Aldi',
    adFormat: 'single-page-image',
    pricePatterns: ['$X.XX', '$X.XX each'],
    dealTypes: ['weekly-special', 'aldi-finds'],
    avgDealsPerPage: 15
  }
};

// Raw OCR text samples for testing regex extraction
export const OCR_TEXT_SAMPLES = {
  simplePrices: [
    'Chicken Breast $4.99/lb',
    'Ground Beef $5.49 per lb',
    'Eggs $3.99 dozen',
    'Milk $2.99 gal',
    'Bread $2.49 each'
  ],
  multiBuyDeals: [
    'Yogurt 10 for $10',
    'Soda 2/$5',
    'Cereal 3 for $9',
    'Pasta Buy 2 Get 1 Free',
    'Soup 5/$5'
  ],
  bogoDeals: [
    'Ice Cream BOGO',
    'Buy One Get One Free - Chips',
    'BOGO 50% Off Cookies',
    'Buy 1 Get 1 Half Price',
    'B1G1 Pizza'
  ],
  percentOffDeals: [
    'Produce 20% Off',
    'Meat Department 25% OFF',
    '30% Off All Frozen',
    'Save 15% on Dairy',
    '50% Off Clearance'
  ],
  dollarOffDeals: [
    'Save $1 on Any Cereal',
    '$2 OFF Detergent',
    '$5 Off $25 Purchase',
    'Instant Savings: $3 Off',
    '$1.50 Off with Digital Coupon'
  ],
  complexFormats: [
    'Boneless Skinless Chicken Breast Family Pack $2.99/lb SAVE $2.00',
    'Oscar Mayer Bacon 12 oz $4.99 When You Buy 2',
    'Coca-Cola 12pk 12oz cans 3/$12 Must Buy 3',
    'Ground Turkey 93% Lean $5.99/lb Reg $7.99',
    'Fresh Strawberries 1lb pkg 2/$5 or $2.99 each'
  ],
  noisyOCR: [
    'Ch1cken Br3ast $4.99/1b', // OCR errors
    'Ground B e e f $5.49 per lb', // spacing errors
    'Eggs $3 .99 dozen', // decimal spacing
    'Mi1k $2.99 ga1', // l/1 confusion
    'Bread $2,49 each' // comma instead of period
  ]
};

// Generate synthetic ads (100 ads total)
export function generateSyntheticAds(count: number = 100): AdImage[] {
  const ads: AdImage[] = [];
  const stores = Object.values(STORE_CONFIGS);

  for (let i = 0; i < count; i++) {
    const store = stores[i % stores.length];
    const isPdf = Math.random() > 0.3;

    ads.push({
      id: `ad-${String(i + 1).padStart(4, '0')}`,
      storeId: store.id,
      storeName: store.name,
      filename: `${store.name.toLowerCase()}_ad_week${Math.floor(i / stores.length) + 1}.${isPdf ? 'pdf' : 'jpg'}`,
      fileSize: isPdf ? Math.floor(Math.random() * 5000000) + 500000 : Math.floor(Math.random() * 2000000) + 100000,
      mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
      pageCount: isPdf ? Math.floor(Math.random() * 6) + 2 : undefined,
      uploadDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed'
    });
  }

  return ads;
}

// Generate synthetic deals (500+ deals)
export function generateSyntheticDeals(ads: AdImage[]): ExtractedDeal[] {
  const deals: ExtractedDeal[] = [];
  const products = PRODUCT_DATABASE;
  const dealTypes: ExtractedDeal['dealType'][] = ['regular', 'bogo', 'multi-buy', 'percent-off', 'dollar-off'];

  let dealCounter = 0;

  for (const ad of ads) {
    const dealsPerAd = Math.floor(Math.random() * 8) + 4; // 4-12 deals per ad

    for (let i = 0; i < dealsPerAd; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const dealType = dealTypes[Math.floor(Math.random() * dealTypes.length)];
      const basePrice = product.typicalPrice;

      let price = basePrice;
      let originalPrice: number | undefined;
      let quantity: number | undefined;
      let savingsAmount: number | undefined;
      let savingsPercent: number | undefined;
      let rawText = '';

      switch (dealType) {
        case 'regular':
          price = basePrice * (0.8 + Math.random() * 0.3);
          rawText = `${product.name} $${price.toFixed(2)}/${product.unit}`;
          break;
        case 'bogo':
          originalPrice = basePrice;
          savingsPercent = 50;
          savingsAmount = basePrice / 2;
          rawText = `${product.name} BOGO $${basePrice.toFixed(2)}`;
          break;
        case 'multi-buy':
          quantity = Math.floor(Math.random() * 4) + 2;
          price = (basePrice * quantity) * 0.75;
          rawText = `${product.name} ${quantity}/$${price.toFixed(2)}`;
          break;
        case 'percent-off':
          savingsPercent = [10, 15, 20, 25, 30, 50][Math.floor(Math.random() * 6)];
          originalPrice = basePrice;
          price = basePrice * (1 - savingsPercent / 100);
          savingsAmount = originalPrice - price;
          rawText = `${product.name} ${savingsPercent}% OFF - Now $${price.toFixed(2)}`;
          break;
        case 'dollar-off':
          savingsAmount = [0.5, 1, 1.5, 2, 3, 5][Math.floor(Math.random() * 6)];
          originalPrice = basePrice;
          price = Math.max(0.99, basePrice - savingsAmount);
          savingsPercent = (savingsAmount / originalPrice) * 100;
          rawText = `${product.name} $${savingsAmount.toFixed(2)} OFF - $${price.toFixed(2)}`;
          break;
      }

      deals.push({
        id: `deal-${String(++dealCounter).padStart(5, '0')}`,
        adId: ad.id,
        productName: product.name,
        rawText,
        price: Math.round(price * 100) / 100,
        unit: product.unit,
        dealType,
        quantity,
        originalPrice: originalPrice ? Math.round(originalPrice * 100) / 100 : undefined,
        savingsAmount: savingsAmount ? Math.round(savingsAmount * 100) / 100 : undefined,
        savingsPercent: savingsPercent ? Math.round(savingsPercent * 10) / 10 : undefined,
        confidence: 0.3 + Math.random() * 0.6, // 0.3-0.9 initial confidence
        category: product.category,
        validFrom: ad.uploadDate,
        validTo: new Date(new Date(ad.uploadDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
  }

  return deals;
}

// Product database for realistic deal generation
export const PRODUCT_DATABASE = [
  // Proteins
  { name: 'Chicken Breast', category: 'protein', unit: 'lb', typicalPrice: 4.99 },
  { name: 'Ground Beef 80/20', category: 'protein', unit: 'lb', typicalPrice: 5.49 },
  { name: 'Pork Chops', category: 'protein', unit: 'lb', typicalPrice: 3.99 },
  { name: 'Salmon Fillet', category: 'protein', unit: 'lb', typicalPrice: 9.99 },
  { name: 'Large Eggs', category: 'protein', unit: 'doz', typicalPrice: 3.99 },
  { name: 'Bacon', category: 'protein', unit: 'pkg', typicalPrice: 6.99 },
  { name: 'Ground Turkey', category: 'protein', unit: 'lb', typicalPrice: 5.99 },
  { name: 'Tilapia', category: 'protein', unit: 'lb', typicalPrice: 6.99 },

  // Dairy
  { name: 'Whole Milk', category: 'dairy', unit: 'gal', typicalPrice: 4.29 },
  { name: 'Greek Yogurt', category: 'dairy', unit: 'cup', typicalPrice: 1.29 },
  { name: 'Cheddar Cheese', category: 'dairy', unit: 'lb', typicalPrice: 5.99 },
  { name: 'Butter', category: 'dairy', unit: 'lb', typicalPrice: 4.99 },
  { name: 'Cream Cheese', category: 'dairy', unit: 'pkg', typicalPrice: 2.99 },

  // Produce
  { name: 'Bananas', category: 'produce', unit: 'lb', typicalPrice: 0.59 },
  { name: 'Apples', category: 'produce', unit: 'lb', typicalPrice: 1.99 },
  { name: 'Strawberries', category: 'produce', unit: 'pkg', typicalPrice: 3.99 },
  { name: 'Broccoli', category: 'produce', unit: 'lb', typicalPrice: 2.49 },
  { name: 'Spinach', category: 'produce', unit: 'pkg', typicalPrice: 3.49 },
  { name: 'Avocados', category: 'produce', unit: 'ea', typicalPrice: 1.49 },
  { name: 'Tomatoes', category: 'produce', unit: 'lb', typicalPrice: 2.99 },
  { name: 'Potatoes', category: 'produce', unit: 'lb', typicalPrice: 0.99 },

  // Grains
  { name: 'White Rice', category: 'grains', unit: 'lb', typicalPrice: 1.49 },
  { name: 'Bread', category: 'grains', unit: 'loaf', typicalPrice: 2.99 },
  { name: 'Pasta', category: 'grains', unit: 'pkg', typicalPrice: 1.49 },
  { name: 'Cereal', category: 'grains', unit: 'box', typicalPrice: 4.49 },
  { name: 'Oatmeal', category: 'grains', unit: 'pkg', typicalPrice: 3.99 },

  // Pantry
  { name: 'Black Beans', category: 'pantry', unit: 'can', typicalPrice: 1.29 },
  { name: 'Olive Oil', category: 'pantry', unit: 'bottle', typicalPrice: 8.99 },
  { name: 'Peanut Butter', category: 'pantry', unit: 'jar', typicalPrice: 3.99 },
  { name: 'Tomato Sauce', category: 'pantry', unit: 'can', typicalPrice: 1.99 },
  { name: 'Soup', category: 'pantry', unit: 'can', typicalPrice: 2.49 },

  // Beverages
  { name: 'Orange Juice', category: 'beverages', unit: 'gal', typicalPrice: 4.99 },
  { name: 'Soda 12pk', category: 'beverages', unit: 'pk', typicalPrice: 5.99 },
  { name: 'Coffee', category: 'beverages', unit: 'bag', typicalPrice: 9.99 },
  { name: 'Bottled Water 24pk', category: 'beverages', unit: 'pk', typicalPrice: 4.99 },

  // Frozen
  { name: 'Frozen Pizza', category: 'frozen', unit: 'ea', typicalPrice: 5.99 },
  { name: 'Ice Cream', category: 'frozen', unit: 'pint', typicalPrice: 4.99 },
  { name: 'Frozen Vegetables', category: 'frozen', unit: 'bag', typicalPrice: 2.49 },
  { name: 'Frozen Waffles', category: 'frozen', unit: 'box', typicalPrice: 3.49 }
];

// Ground truth dataset for accuracy validation (50 manually annotated ads)
export const GROUND_TRUTH_ADS: GroundTruthAd[] = [
  {
    ad: {
      id: 'gt-ad-001',
      storeId: 'store-safeway',
      storeName: 'Safeway',
      filename: 'safeway_test_ad_1.pdf',
      fileSize: 2500000,
      mimeType: 'application/pdf',
      pageCount: 4,
      uploadDate: '2024-01-15T00:00:00Z',
      status: 'completed'
    },
    expectedDeals: [
      { productName: 'Chicken Breast', price: 2.99, unit: 'lb', dealType: 'regular' },
      { productName: 'Ground Beef 80/20', price: 4.49, unit: 'lb', dealType: 'regular' },
      { productName: 'Large Eggs', price: 2.99, unit: 'doz', dealType: 'regular' },
      { productName: 'Greek Yogurt', price: 1.00, unit: 'cup', dealType: 'multi-buy', quantity: 10 },
      { productName: 'Bananas', price: 0.49, unit: 'lb', dealType: 'regular' },
      { productName: 'Bread', price: 1.99, unit: 'loaf', dealType: 'bogo' },
      { productName: 'Ice Cream', price: 2.50, unit: 'pint', dealType: 'bogo' },
      { productName: 'Soda 12pk', price: 4.00, unit: 'pk', dealType: 'multi-buy', quantity: 3 }
    ],
    annotatedBy: 'qa-team',
    annotatedAt: '2024-01-20T10:00:00Z'
  },
  {
    ad: {
      id: 'gt-ad-002',
      storeId: 'store-kroger',
      storeName: 'Kroger',
      filename: 'kroger_test_ad_1.pdf',
      fileSize: 3200000,
      mimeType: 'application/pdf',
      pageCount: 6,
      uploadDate: '2024-01-22T00:00:00Z',
      status: 'completed'
    },
    expectedDeals: [
      { productName: 'Pork Chops', price: 2.99, unit: 'lb', dealType: 'regular' },
      { productName: 'Salmon Fillet', price: 7.99, unit: 'lb', dealType: 'percent-off' },
      { productName: 'Whole Milk', price: 2.99, unit: 'gal', dealType: 'regular' },
      { productName: 'Cheddar Cheese', price: 4.99, unit: 'lb', dealType: 'dollar-off' },
      { productName: 'Strawberries', price: 2.50, unit: 'pkg', dealType: 'multi-buy', quantity: 2 },
      { productName: 'Cereal', price: 2.99, unit: 'box', dealType: 'multi-buy', quantity: 3 },
      { productName: 'Pasta', price: 1.00, unit: 'pkg', dealType: 'regular' },
      { productName: 'Tomato Sauce', price: 0.99, unit: 'can', dealType: 'multi-buy', quantity: 5 },
      { productName: 'Coffee', price: 6.99, unit: 'bag', dealType: 'dollar-off' }
    ],
    annotatedBy: 'qa-team',
    annotatedAt: '2024-01-23T14:30:00Z'
  }
  // ... Additional 48 ground truth ads would be added here
];

// Generate remaining ground truth ads
export function generateGroundTruthAds(count: number = 50): GroundTruthAd[] {
  const groundTruth: GroundTruthAd[] = [...GROUND_TRUTH_ADS];
  const stores = Object.values(STORE_CONFIGS);

  for (let i = groundTruth.length; i < count; i++) {
    const store = stores[i % stores.length];
    const dealCount = Math.floor(Math.random() * 6) + 5; // 5-10 deals
    const expectedDeals: ExpectedDeal[] = [];

    const usedProducts = new Set<string>();
    for (let j = 0; j < dealCount; j++) {
      let product = PRODUCT_DATABASE[Math.floor(Math.random() * PRODUCT_DATABASE.length)];
      while (usedProducts.has(product.name)) {
        product = PRODUCT_DATABASE[Math.floor(Math.random() * PRODUCT_DATABASE.length)];
      }
      usedProducts.add(product.name);

      const dealTypes: ExpectedDeal['dealType'][] = ['regular', 'bogo', 'multi-buy', 'percent-off', 'dollar-off'];
      const dealType = dealTypes[Math.floor(Math.random() * dealTypes.length)];

      let price = product.typicalPrice * (0.7 + Math.random() * 0.2);
      let quantity: number | undefined;

      if (dealType === 'multi-buy') {
        quantity = Math.floor(Math.random() * 4) + 2;
        price = price * quantity * 0.8;
      }

      expectedDeals.push({
        productName: product.name,
        price: Math.round(price * 100) / 100,
        unit: product.unit,
        dealType,
        quantity
      });
    }

    groundTruth.push({
      ad: {
        id: `gt-ad-${String(i + 1).padStart(3, '0')}`,
        storeId: store.id,
        storeName: store.name,
        filename: `${store.name.toLowerCase()}_gt_ad_${i + 1}.pdf`,
        fileSize: Math.floor(Math.random() * 4000000) + 1000000,
        mimeType: 'application/pdf',
        pageCount: Math.floor(Math.random() * 4) + 2,
        uploadDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      },
      expectedDeals,
      annotatedBy: 'qa-team',
      annotatedAt: new Date().toISOString()
    });
  }

  return groundTruth;
}

// Shopping list items for matching tests
export const SHOPPING_LIST_ITEMS = [
  { id: 'shop-001', name: 'Chicken Breast', quantity: 3, unit: 'lb', category: 'protein' },
  { id: 'shop-002', name: 'Ground Beef', quantity: 2, unit: 'lb', category: 'protein' },
  { id: 'shop-003', name: 'Eggs', quantity: 2, unit: 'doz', category: 'protein' },
  { id: 'shop-004', name: 'Milk', quantity: 1, unit: 'gal', category: 'dairy' },
  { id: 'shop-005', name: 'Yogurt', quantity: 10, unit: 'cup', category: 'dairy' },
  { id: 'shop-006', name: 'Cheese', quantity: 1, unit: 'lb', category: 'dairy' },
  { id: 'shop-007', name: 'Bananas', quantity: 3, unit: 'lb', category: 'produce' },
  { id: 'shop-008', name: 'Broccoli', quantity: 2, unit: 'lb', category: 'produce' },
  { id: 'shop-009', name: 'Rice', quantity: 5, unit: 'lb', category: 'grains' },
  { id: 'shop-010', name: 'Bread', quantity: 2, unit: 'loaf', category: 'grains' },
  { id: 'shop-011', name: 'Black Beans', quantity: 4, unit: 'can', category: 'pantry' },
  { id: 'shop-012', name: 'Olive Oil', quantity: 1, unit: 'bottle', category: 'pantry' },
  { id: 'shop-013', name: 'Orange Juice', quantity: 1, unit: 'gal', category: 'beverages' },
  { id: 'shop-014', name: 'Coffee', quantity: 1, unit: 'bag', category: 'beverages' },
  { id: 'shop-015', name: 'Frozen Pizza', quantity: 2, unit: 'ea', category: 'frozen' }
];

// Template fixtures
export const AD_TEMPLATES: AdTemplate[] = [
  {
    id: 'template-safeway-v1',
    storeId: 'store-safeway',
    storeName: 'Safeway',
    version: '1.0.0',
    regions: [
      { id: 'r1', name: 'Product Name', type: 'product', coordinates: { x: 10, y: 10, width: 200, height: 30 }, extractionPattern: '[A-Za-z\\s]+', confidence: 0.85 },
      { id: 'r2', name: 'Price', type: 'price', coordinates: { x: 220, y: 10, width: 80, height: 30 }, extractionPattern: '\\$?\\d+\\.?\\d*', confidence: 0.90 },
      { id: 'r3', name: 'Unit', type: 'unit', coordinates: { x: 300, y: 10, width: 50, height: 30 }, extractionPattern: '(lb|oz|ea|pkg|gal|doz)', confidence: 0.88 }
    ],
    accuracy: 0.52,
    usageCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    status: 'active'
  },
  {
    id: 'template-safeway-v2',
    storeId: 'store-safeway',
    storeName: 'Safeway',
    version: '1.1.0',
    regions: [
      { id: 'r1', name: 'Product Name', type: 'product', coordinates: { x: 10, y: 10, width: 200, height: 30 }, extractionPattern: '[A-Za-z\\s]+', confidence: 0.88 },
      { id: 'r2', name: 'Price', type: 'price', coordinates: { x: 220, y: 10, width: 80, height: 30 }, extractionPattern: '\\$?\\d+\\.?\\d*', confidence: 0.92 },
      { id: 'r3', name: 'Unit', type: 'unit', coordinates: { x: 300, y: 10, width: 50, height: 30 }, extractionPattern: '(lb|oz|ea|pkg|gal|doz|per\\s+lb)', confidence: 0.90 },
      { id: 'r4', name: 'Deal Type', type: 'deal-type', coordinates: { x: 10, y: 45, width: 150, height: 20 }, extractionPattern: '(BOGO|\\d+\\s*for|Buy\\s+\\d+)', confidence: 0.85 }
    ],
    accuracy: 0.58,
    usageCount: 15,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z',
    status: 'active'
  }
];

// Accuracy progression data for testing progressive learning
export const ACCURACY_PROGRESSION = {
  phase1_regex: {
    name: 'Phase 1: Regex Only',
    expectedAccuracyRange: { min: 0.30, max: 0.40 },
    corrections: 0
  },
  phase2_template_10: {
    name: 'Phase 2: Template (10 corrections)',
    expectedAccuracyRange: { min: 0.50, max: 0.60 },
    corrections: 10
  },
  phase2_template_20: {
    name: 'Phase 2: Template (20 corrections)',
    expectedAccuracyRange: { min: 0.55, max: 0.65 },
    corrections: 20
  },
  phase3_ml_30: {
    name: 'Phase 3: ML (30 corrections)',
    expectedAccuracyRange: { min: 0.70, max: 0.85 },
    corrections: 30
  },
  phase3_ml_50: {
    name: 'Phase 3: ML (50 corrections)',
    expectedAccuracyRange: { min: 0.75, max: 0.90 },
    corrections: 50
  }
};

// Performance benchmarks
export const PERFORMANCE_BENCHMARKS = {
  ocrProcessing: {
    target: 10000, // ms for 4-page PDF
    acceptable: 15000
  },
  dealExtraction: {
    target: 2000, // ms for 50 deals
    acceptable: 3000
  },
  matching: {
    target: 1000, // ms for full shopping list
    acceptable: 1500
  },
  templateApplication: {
    target: 500, // ms
    acceptable: 750
  },
  annotationSave: {
    target: 200, // ms
    acceptable: 300
  }
};

// Export convenience functions
export const testData = {
  generateAds: generateSyntheticAds,
  generateDeals: generateSyntheticDeals,
  generateGroundTruth: generateGroundTruthAds,
  stores: STORE_CONFIGS,
  products: PRODUCT_DATABASE,
  ocrSamples: OCR_TEXT_SAMPLES,
  shoppingList: SHOPPING_LIST_ITEMS,
  templates: AD_TEMPLATES,
  accuracyTargets: ACCURACY_PROGRESSION,
  benchmarks: PERFORMANCE_BENCHMARKS,
  groundTruth: GROUND_TRUTH_ADS
};

export default testData;
