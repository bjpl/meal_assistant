/**
 * Barcode Scanning Service
 * Handles barcode scanning, product lookup, and integration with OpenFoodFacts API
 */

import {
  BarcodeScanResult,
  InventoryItem,
  InventoryCategory,
  UnitType,
  NutritionInfo
} from '../../types/inventory.types';
import { inventoryTrackingService } from './tracking.service';

/**
 * Local barcode cache interface
 */
interface CachedProduct {
  barcode: string;
  name: string;
  brand?: string;
  category?: InventoryCategory;
  defaultUnit: UnitType;
  defaultQuantity: number;
  typicalExpiryDays: number;
  nutritionPer100g?: NutritionInfo;
  imageUrl?: string;
  lastUpdated: Date;
}

/**
 * OpenFoodFacts API response interface (simplified)
 */
interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
  categories?: string;
  quantity?: string;
  image_url?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    fiber_100g?: number;
    sodium_100g?: number;
    sugars_100g?: number;
  };
}

/**
 * Category mapping from OpenFoodFacts categories
 */
const CATEGORY_MAPPING: Record<string, InventoryCategory> = {
  'meats': 'protein',
  'meat': 'protein',
  'poultry': 'protein',
  'seafood': 'protein',
  'fish': 'protein',
  'eggs': 'protein',
  'dairy': 'dairy',
  'milk': 'dairy',
  'cheese': 'dairy',
  'yogurt': 'dairy',
  'fruits': 'produce',
  'vegetables': 'produce',
  'produce': 'produce',
  'grains': 'grains',
  'bread': 'grains',
  'cereals': 'grains',
  'pasta': 'grains',
  'rice': 'grains',
  'condiments': 'condiments',
  'sauces': 'condiments',
  'beverages': 'beverages',
  'drinks': 'beverages',
  'frozen': 'frozen',
  'snacks': 'snacks'
};

/**
 * Default expiry days by category
 */
const DEFAULT_EXPIRY_DAYS: Record<InventoryCategory, number> = {
  protein: 4,
  dairy: 10,
  produce: 7,
  grains: 180,
  condiments: 365,
  beverages: 180,
  frozen: 180,
  snacks: 90,
  leftovers: 3,
  prepared: 4,
  other: 30
};

/**
 * BarcodeScanningService class
 * Handles all barcode-related operations
 */
export class BarcodeScanningService {
  private localCache: Map<string, CachedProduct> = new Map();
  private pendingScans: Map<string, Promise<BarcodeScanResult>> = new Map();
  private apiBaseUrl = 'https://world.openfoodfacts.org/api/v0/product';

  constructor() {
    this.loadCache();
  }

  /**
   * Load cached products from local storage
   */
  private loadCache(): void {
    try {
      const stored = localStorage.getItem('meal_assistant_barcode_cache');
      if (stored) {
        const data = JSON.parse(stored);
        Object.entries(data).forEach(([barcode, product]) => {
          const cached = product as CachedProduct;
          cached.lastUpdated = new Date(cached.lastUpdated);
          this.localCache.set(barcode, cached);
        });
      }
    } catch (error) {
      console.error('Failed to load barcode cache:', error);
    }
  }

  /**
   * Save cache to local storage
   */
  private saveCache(): void {
    try {
      const data: Record<string, CachedProduct> = {};
      this.localCache.forEach((product, barcode) => {
        data[barcode] = product;
      });
      localStorage.setItem('meal_assistant_barcode_cache', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save barcode cache:', error);
    }
  }

  /**
   * Scan a barcode and look up product information
   */
  public async scanBarcode(barcode: string): Promise<BarcodeScanResult> {
    // Normalize barcode
    const normalizedBarcode = barcode.replace(/[^0-9]/g, '');

    if (!normalizedBarcode || normalizedBarcode.length < 8) {
      return { barcode: normalizedBarcode, found: false };
    }

    // Check if already scanning this barcode
    const pending = this.pendingScans.get(normalizedBarcode);
    if (pending) {
      return pending;
    }

    // Check local cache first
    const cached = this.localCache.get(normalizedBarcode);
    if (cached && this.isCacheValid(cached)) {
      return {
        barcode: normalizedBarcode,
        found: true,
        product: {
          name: cached.name,
          brand: cached.brand,
          category: cached.category,
          defaultUnit: cached.defaultUnit,
          defaultQuantity: cached.defaultQuantity,
          typicalExpiryDays: cached.typicalExpiryDays,
          nutritionPer100g: cached.nutritionPer100g,
          imageUrl: cached.imageUrl
        },
        source: 'local_cache'
      };
    }

    // Check if product already exists in inventory
    const existingItem = inventoryTrackingService.findByBarcode(normalizedBarcode);
    if (existingItem) {
      return {
        barcode: normalizedBarcode,
        found: true,
        product: {
          name: existingItem.name,
          brand: existingItem.brand,
          category: existingItem.category,
          defaultUnit: existingItem.unit,
          defaultQuantity: 1,
          typicalExpiryDays: this.calculateExpiryDays(existingItem),
          nutritionPer100g: existingItem.nutritionPer100g,
          imageUrl: existingItem.imageUrl
        },
        source: 'local_cache'
      };
    }

    // Fetch from OpenFoodFacts API
    const fetchPromise = this.fetchFromOpenFoodFacts(normalizedBarcode);
    this.pendingScans.set(normalizedBarcode, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      this.pendingScans.delete(normalizedBarcode);
    }
  }

  /**
   * Check if cached product is still valid (less than 30 days old)
   */
  private isCacheValid(cached: CachedProduct): boolean {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return cached.lastUpdated > thirtyDaysAgo;
  }

  /**
   * Calculate expiry days from existing item
   */
  private calculateExpiryDays(item: InventoryItem): number {
    const daysDiff = Math.floor(
      (item.expiryDate.getTime() - item.purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysDiff > 0 ? daysDiff : DEFAULT_EXPIRY_DAYS[item.category];
  }

  /**
   * Fetch product from OpenFoodFacts API
   */
  private async fetchFromOpenFoodFacts(barcode: string): Promise<BarcodeScanResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${barcode}.json`, {
        headers: {
          'User-Agent': 'MealAssistant/1.0 (https://meal-assistant.app)'
        }
      });

      if (!response.ok) {
        return { barcode, found: false };
      }

      const data = await response.json();

      if (data.status !== 1 || !data.product) {
        return { barcode, found: false };
      }

      const product = data.product as OpenFoodFactsProduct;
      const parsedProduct = this.parseOpenFoodFactsProduct(product);

      // Cache the result
      this.localCache.set(barcode, {
        barcode,
        ...parsedProduct,
        lastUpdated: new Date()
      });
      this.saveCache();

      return {
        barcode,
        found: true,
        product: parsedProduct,
        source: 'openfoodfacts'
      };
    } catch (error) {
      console.error('OpenFoodFacts API error:', error);
      return { barcode, found: false };
    }
  }

  /**
   * Parse OpenFoodFacts product data
   */
  private parseOpenFoodFactsProduct(product: OpenFoodFactsProduct): Omit<CachedProduct, 'barcode' | 'lastUpdated'> {
    // Parse category
    const category = this.parseCategory(product.categories);

    // Parse nutrition
    const nutrition = product.nutriments ? {
      calories: product.nutriments['energy-kcal_100g'] || 0,
      protein: product.nutriments.proteins_100g || 0,
      carbs: product.nutriments.carbohydrates_100g || 0,
      fat: product.nutriments.fat_100g || 0,
      fiber: product.nutriments.fiber_100g,
      sodium: product.nutriments.sodium_100g,
      sugar: product.nutriments.sugars_100g
    } : undefined;

    // Parse quantity and unit
    const { quantity, unit } = this.parseQuantity(product.quantity);

    return {
      name: product.product_name || 'Unknown Product',
      brand: product.brands,
      category,
      defaultUnit: unit,
      defaultQuantity: quantity,
      typicalExpiryDays: DEFAULT_EXPIRY_DAYS[category],
      nutritionPer100g: nutrition,
      imageUrl: product.image_url
    };
  }

  /**
   * Parse category from OpenFoodFacts categories string
   */
  private parseCategory(categoriesStr?: string): InventoryCategory {
    if (!categoriesStr) return 'other';

    const categories = categoriesStr.toLowerCase().split(',');

    for (const cat of categories) {
      const trimmed = cat.trim();
      for (const [keyword, mappedCategory] of Object.entries(CATEGORY_MAPPING)) {
        if (trimmed.includes(keyword)) {
          return mappedCategory;
        }
      }
    }

    return 'other';
  }

  /**
   * Parse quantity string to number and unit
   */
  private parseQuantity(quantityStr?: string): { quantity: number; unit: UnitType } {
    if (!quantityStr) {
      return { quantity: 1, unit: 'count' };
    }

    const str = quantityStr.toLowerCase();

    // Try to extract number and unit
    const match = str.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb|count|pieces?)?/);

    if (!match) {
      return { quantity: 1, unit: 'count' };
    }

    const num = parseFloat(match[1]);
    const unitStr = match[2] || '';

    let unit: UnitType = 'count';
    if (unitStr.includes('kg')) unit = 'kg';
    else if (unitStr.includes('g')) unit = 'g';
    else if (unitStr.includes('l') && !unitStr.includes('ml')) unit = 'l';
    else if (unitStr.includes('ml')) unit = 'ml';
    else if (unitStr.includes('oz')) unit = 'oz';
    else if (unitStr.includes('lb')) unit = 'lb';
    else if (unitStr.includes('piece') || unitStr.includes('count')) unit = 'count';

    return { quantity: num, unit };
  }

  /**
   * Add scanned product to inventory
   */
  public async addScannedToInventory(
    barcode: string,
    overrides?: Partial<InventoryItem>
  ): Promise<InventoryItem | null> {
    const scanResult = await this.scanBarcode(barcode);

    if (!scanResult.found || !scanResult.product) {
      return null;
    }

    const { product } = scanResult;
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + product.typicalExpiryDays);

    return inventoryTrackingService.addItem({
      name: product.name,
      barcode,
      brand: product.brand,
      category: product.category,
      quantity: product.defaultQuantity,
      unit: product.defaultUnit,
      expiryDate,
      nutritionPer100g: product.nutritionPer100g,
      imageUrl: product.imageUrl,
      ...overrides
    });
  }

  /**
   * Manually add product to cache
   */
  public addToCache(product: CachedProduct): void {
    this.localCache.set(product.barcode, {
      ...product,
      lastUpdated: new Date()
    });
    this.saveCache();
  }

  /**
   * Search cached products by name
   */
  public searchCache(query: string): CachedProduct[] {
    const searchTerm = query.toLowerCase();
    const results: CachedProduct[] = [];

    this.localCache.forEach(product => {
      if (
        product.name.toLowerCase().includes(searchTerm) ||
        product.brand?.toLowerCase().includes(searchTerm)
      ) {
        results.push(product);
      }
    });

    return results;
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    totalCached: number;
    byCategory: Record<string, number>;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const byCategory: Record<string, number> = {};
    let oldest: Date | null = null;
    let newest: Date | null = null;

    this.localCache.forEach(product => {
      byCategory[product.category || 'other'] = (byCategory[product.category || 'other'] || 0) + 1;

      if (!oldest || product.lastUpdated < oldest) {
        oldest = product.lastUpdated;
      }
      if (!newest || product.lastUpdated > newest) {
        newest = product.lastUpdated;
      }
    });

    return {
      totalCached: this.localCache.size,
      byCategory,
      oldestEntry: oldest,
      newestEntry: newest
    };
  }

  /**
   * Clear expired cache entries
   */
  public cleanCache(): number {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let removed = 0;

    this.localCache.forEach((product, barcode) => {
      if (product.lastUpdated < thirtyDaysAgo) {
        this.localCache.delete(barcode);
        removed++;
      }
    });

    if (removed > 0) {
      this.saveCache();
    }

    return removed;
  }

  /**
   * Export cache for backup
   */
  public exportCache(): string {
    const data: Record<string, CachedProduct> = {};
    this.localCache.forEach((product, barcode) => {
      data[barcode] = product;
    });
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import cache from backup
   */
  public importCache(jsonData: string): number {
    try {
      const data = JSON.parse(jsonData);
      let imported = 0;

      Object.entries(data).forEach(([barcode, product]) => {
        const cached = product as CachedProduct;
        cached.lastUpdated = new Date(cached.lastUpdated);
        this.localCache.set(barcode, cached);
        imported++;
      });

      this.saveCache();
      return imported;
    } catch (error) {
      console.error('Failed to import cache:', error);
      return 0;
    }
  }

  /**
   * Clear entire cache
   */
  public clearCache(): void {
    this.localCache.clear();
    localStorage.removeItem('meal_assistant_barcode_cache');
  }
}

// Export singleton instance
export const barcodeScanningService = new BarcodeScanningService();
