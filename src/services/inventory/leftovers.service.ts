/**
 * Leftover Management Service
 * Handles tracking, prioritization, and suggestions for leftover meals
 */

import {
  InventoryItem,
  LeftoverItem,
  MealSuggestion,
  UnitType
} from '../../types/inventory.types';
import { inventoryTrackingService } from './tracking.service';

/**
 * Portion size mapping to approximate quantities
 */
const PORTION_QUANTITIES: Record<'small' | 'medium' | 'large', number> = {
  small: 0.5,   // ~0.5 servings
  medium: 1.0,  // ~1 serving
  large: 2.0   // ~2 servings
};

/**
 * Maximum safe reheating counts by food type
 */
const MAX_REHEATINGS: Record<string, number> = {
  rice: 1,
  chicken: 2,
  beef: 2,
  pork: 2,
  fish: 1,
  vegetables: 3,
  soup: 3,
  pasta: 2,
  default: 2
};

/**
 * Shelf life in days for leftovers by type
 */
const LEFTOVER_SHELF_LIFE: Record<string, number> = {
  rice: 2,
  chicken: 3,
  beef: 4,
  pork: 4,
  fish: 2,
  vegetables: 4,
  soup: 4,
  pasta: 4,
  default: 3
};

/**
 * Generate unique ID
 */
const generateId = (): string => {
  return `left_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * LeftoverManagementService class
 * Specialized service for managing meal leftovers
 */
export class LeftoverManagementService {
  private consumptionRates: Map<string, number[]> = new Map();

  constructor() {
    this.loadConsumptionRates();
  }

  /**
   * Load consumption rate history from storage
   */
  private loadConsumptionRates(): void {
    try {
      const stored = localStorage.getItem('meal_assistant_consumption_rates');
      if (stored) {
        const data = JSON.parse(stored);
        Object.entries(data).forEach(([key, rates]) => {
          this.consumptionRates.set(key, rates as number[]);
        });
      }
    } catch (error) {
      console.error('Failed to load consumption rates:', error);
    }
  }

  /**
   * Save consumption rates to storage
   */
  private saveConsumptionRates(): void {
    try {
      const data: Record<string, number[]> = {};
      this.consumptionRates.forEach((rates, key) => {
        data[key] = rates.slice(-20); // Keep last 20 data points
      });
      localStorage.setItem('meal_assistant_consumption_rates', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save consumption rates:', error);
    }
  }

  /**
   * Create a new leftover entry from a meal
   */
  public createLeftover(data: {
    mealId: string;
    mealName: string;
    portionEstimate: 'small' | 'medium' | 'large';
    notes?: string;
    reheatingInstructions?: string;
  }): LeftoverItem {
    const now = new Date();
    const mealType = this.detectMealType(data.mealName);
    const shelfLife = LEFTOVER_SHELF_LIFE[mealType] || LEFTOVER_SHELF_LIFE.default;

    const useByDate = new Date(now);
    useByDate.setDate(useByDate.getDate() + shelfLife);

    const leftoverData: Partial<InventoryItem> = {
      name: `${data.mealName} (Leftover)`,
      quantity: PORTION_QUANTITIES[data.portionEstimate],
      unit: 'servings' as UnitType,
      location: 'fridge',
      category: 'leftovers',
      purchaseDate: now,
      expiryDate: useByDate,
      isLeftover: true,
      originalMealId: data.mealId,
      notes: data.notes,
      cost: 0 // Leftovers don't add to cost
    };

    const item = inventoryTrackingService.addItem(leftoverData);

    // Cast to LeftoverItem with additional properties
    const leftover: LeftoverItem = {
      ...item,
      isLeftover: true,
      originalMealId: data.mealId,
      originalMealName: data.mealName,
      portionEstimate: data.portionEstimate,
      recommendedUseByDate: useByDate,
      reheatingInstructions: data.reheatingInstructions || this.getDefaultReheatingInstructions(mealType),
      timesReheated: 0,
      maxReheatings: MAX_REHEATINGS[mealType] || MAX_REHEATINGS.default
    };

    // Store extended leftover data
    this.storeLeftoverMetadata(leftover);

    return leftover;
  }

  /**
   * Store extended leftover metadata
   */
  private storeLeftoverMetadata(leftover: LeftoverItem): void {
    try {
      const metadataKey = `meal_assistant_leftover_${leftover.id}`;
      const metadata = {
        originalMealName: leftover.originalMealName,
        portionEstimate: leftover.portionEstimate,
        recommendedUseByDate: leftover.recommendedUseByDate,
        reheatingInstructions: leftover.reheatingInstructions,
        timesReheated: leftover.timesReheated,
        maxReheatings: leftover.maxReheatings
      };
      localStorage.setItem(metadataKey, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to store leftover metadata:', error);
    }
  }

  /**
   * Get leftover metadata
   */
  private getLeftoverMetadata(itemId: string): Partial<LeftoverItem> | null {
    try {
      const stored = localStorage.getItem(`meal_assistant_leftover_${itemId}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get all leftovers with full metadata
   */
  public getAllLeftovers(): LeftoverItem[] {
    const items = inventoryTrackingService.getItems({ isLeftover: true });

    return items.map(item => {
      const metadata = this.getLeftoverMetadata(item.id);
      return {
        ...item,
        isLeftover: true as const,
        originalMealId: item.originalMealId || '',
        originalMealName: metadata?.originalMealName || item.name.replace(' (Leftover)', ''),
        portionEstimate: metadata?.portionEstimate || 'medium',
        recommendedUseByDate: metadata?.recommendedUseByDate
          ? new Date(metadata.recommendedUseByDate)
          : item.expiryDate,
        reheatingInstructions: metadata?.reheatingInstructions,
        timesReheated: metadata?.timesReheated || 0,
        maxReheatings: metadata?.maxReheatings || 2
      } as LeftoverItem;
    }).sort((a, b) =>
      a.recommendedUseByDate.getTime() - b.recommendedUseByDate.getTime()
    );
  }

  /**
   * Get leftovers that should be prioritized in meal planning
   */
  public getPrioritizedLeftovers(): LeftoverItem[] {
    const leftovers = this.getAllLeftovers();
    const now = new Date();

    return leftovers.filter(leftover => {
      const daysUntilExpiry = Math.floor(
        (leftover.recommendedUseByDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      // Prioritize if expiring within 2 days or already past recommended date
      return daysUntilExpiry <= 2;
    });
  }

  /**
   * Record reheating of a leftover
   */
  public recordReheating(leftoverId: string): {
    success: boolean;
    message: string;
    canReheatAgain: boolean;
  } {
    const item = inventoryTrackingService.getItem(leftoverId);
    if (!item || !item.isLeftover) {
      return {
        success: false,
        message: 'Leftover not found',
        canReheatAgain: false
      };
    }

    const metadata = this.getLeftoverMetadata(leftoverId);
    const timesReheated = (metadata?.timesReheated || 0) + 1;
    const maxReheatings = metadata?.maxReheatings || 2;

    // Update metadata
    this.storeLeftoverMetadata({
      ...item,
      isLeftover: true,
      originalMealId: item.originalMealId || '',
      originalMealName: metadata?.originalMealName || item.name,
      portionEstimate: metadata?.portionEstimate || 'medium',
      recommendedUseByDate: metadata?.recommendedUseByDate
        ? new Date(metadata.recommendedUseByDate)
        : item.expiryDate,
      reheatingInstructions: metadata?.reheatingInstructions,
      timesReheated,
      maxReheatings
    });

    const canReheatAgain = timesReheated < maxReheatings;
    let message = `Reheated ${timesReheated}/${maxReheatings} times.`;

    if (!canReheatAgain) {
      message += ' This should be consumed or discarded after this reheating.';
    }

    return {
      success: true,
      message,
      canReheatAgain
    };
  }

  /**
   * Consume leftover (partial or full)
   */
  public consumeLeftover(
    leftoverId: string,
    portionConsumed: 'all' | 'half' | 'quarter'
  ): boolean {
    const item = inventoryTrackingService.getItem(leftoverId);
    if (!item) return false;

    const consumptionMultiplier = {
      all: 1,
      half: 0.5,
      quarter: 0.25
    };

    const amountConsumed = item.quantity * consumptionMultiplier[portionConsumed];

    // Track consumption rate
    this.trackConsumption(item.name, amountConsumed);

    if (portionConsumed === 'all') {
      inventoryTrackingService.removeItem(leftoverId, 'Consumed');
      localStorage.removeItem(`meal_assistant_leftover_${leftoverId}`);
    } else {
      inventoryTrackingService.deductQuantity(
        leftoverId,
        amountConsumed,
        'meal_log'
      );
    }

    return true;
  }

  /**
   * Track consumption rate for predictions
   */
  private trackConsumption(itemName: string, amount: number): void {
    const key = itemName.toLowerCase().replace(' (leftover)', '');
    const rates = this.consumptionRates.get(key) || [];
    rates.push(amount);
    this.consumptionRates.set(key, rates);
    this.saveConsumptionRates();
  }

  /**
   * Get average consumption rate for an item type
   */
  public getAverageConsumptionRate(itemName: string): number {
    const key = itemName.toLowerCase().replace(' (leftover)', '');
    const rates = this.consumptionRates.get(key) || [];

    if (rates.length === 0) return 1; // Default to 1 serving

    return rates.reduce((a, b) => a + b, 0) / rates.length;
  }

  /**
   * Suggest meals that incorporate leftovers
   */
  public suggestMealsForLeftovers(): MealSuggestion[] {
    const leftovers = this.getPrioritizedLeftovers();
    if (leftovers.length === 0) return [];

    const suggestions: MealSuggestion[] = [];

    // Group leftovers by what they could combine into
    const byType = this.groupLeftoversByType(leftovers);

    // Generate suggestions based on combinations
    if (byType.protein.length > 0 && byType.starch.length > 0) {
      suggestions.push({
        mealName: 'Leftover Bowl',
        usesItems: [...byType.protein, ...byType.starch].map(l => l.id),
        priority: 3,
        prepTime: 10
      });
    }

    if (byType.protein.length > 0) {
      suggestions.push({
        mealName: 'Leftover Stir Fry',
        usesItems: byType.protein.map(l => l.id),
        priority: 2,
        prepTime: 15
      });
    }

    if (byType.soup.length > 0) {
      suggestions.push({
        mealName: 'Reheat Soup',
        usesItems: byType.soup.map(l => l.id),
        priority: 1,
        prepTime: 5
      });
    }

    // Add generic suggestions for any leftovers
    leftovers.forEach(leftover => {
      const alreadySuggested = suggestions.some(s =>
        s.usesItems.includes(leftover.id)
      );

      if (!alreadySuggested) {
        suggestions.push({
          mealName: `Reheat: ${leftover.originalMealName}`,
          usesItems: [leftover.id],
          priority: 1,
          prepTime: 5
        });
      }
    });

    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Group leftovers by food type
   */
  private groupLeftoversByType(leftovers: LeftoverItem[]): {
    protein: LeftoverItem[];
    starch: LeftoverItem[];
    soup: LeftoverItem[];
    other: LeftoverItem[];
  } {
    const groups = {
      protein: [] as LeftoverItem[],
      starch: [] as LeftoverItem[],
      soup: [] as LeftoverItem[],
      other: [] as LeftoverItem[]
    };

    const typeKeywords = {
      protein: ['chicken', 'beef', 'pork', 'fish', 'tofu', 'shrimp', 'turkey'],
      starch: ['rice', 'pasta', 'noodles', 'potato', 'bread', 'quinoa'],
      soup: ['soup', 'stew', 'broth', 'chili']
    };

    leftovers.forEach(leftover => {
      const name = leftover.originalMealName.toLowerCase();
      let categorized = false;

      for (const [type, keywords] of Object.entries(typeKeywords)) {
        if (keywords.some(kw => name.includes(kw))) {
          groups[type as keyof typeof groups].push(leftover);
          categorized = true;
          break;
        }
      }

      if (!categorized) {
        groups.other.push(leftover);
      }
    });

    return groups;
  }

  /**
   * Detect meal type from name for shelf life estimation
   */
  private detectMealType(mealName: string): string {
    const name = mealName.toLowerCase();

    if (name.includes('rice')) return 'rice';
    if (name.includes('chicken')) return 'chicken';
    if (name.includes('beef')) return 'beef';
    if (name.includes('pork')) return 'pork';
    if (name.includes('fish') || name.includes('salmon') || name.includes('tuna')) return 'fish';
    if (name.includes('soup') || name.includes('stew')) return 'soup';
    if (name.includes('pasta') || name.includes('noodle')) return 'pasta';
    if (name.includes('vegetable') || name.includes('salad')) return 'vegetables';

    return 'default';
  }

  /**
   * Get default reheating instructions by food type
   */
  private getDefaultReheatingInstructions(mealType: string): string {
    const instructions: Record<string, string> = {
      rice: 'Add 1-2 tbsp water, cover, and microwave for 2-3 minutes. Stir halfway through.',
      chicken: 'Microwave on 70% power for 2-3 minutes, or reheat in covered pan with splash of broth.',
      beef: 'Reheat in covered pan over medium heat, or microwave on 70% power for 2-3 minutes.',
      pork: 'Reheat in covered pan over medium heat, or microwave on 70% power for 2-3 minutes.',
      fish: 'Reheat gently in oven at 275°F for 10-15 minutes. Avoid microwave if possible.',
      soup: 'Reheat in saucepan over medium heat, stirring occasionally, until simmering.',
      pasta: 'Add splash of water or sauce, cover, and microwave for 2-3 minutes.',
      vegetables: 'Microwave covered for 1-2 minutes, or sauté briefly in pan.',
      default: 'Microwave covered for 2-3 minutes, checking and stirring halfway through.'
    };

    return instructions[mealType] || instructions.default;
  }

  /**
   * Update portion estimate for a leftover
   */
  public updatePortionEstimate(
    leftoverId: string,
    newEstimate: 'small' | 'medium' | 'large'
  ): boolean {
    const item = inventoryTrackingService.getItem(leftoverId);
    if (!item) return false;

    const metadata = this.getLeftoverMetadata(leftoverId);
    const newQuantity = PORTION_QUANTITIES[newEstimate];

    inventoryTrackingService.updateItem(leftoverId, { quantity: newQuantity });

    if (metadata) {
      this.storeLeftoverMetadata({
        ...item,
        isLeftover: true,
        originalMealId: item.originalMealId || '',
        originalMealName: metadata.originalMealName || item.name,
        portionEstimate: newEstimate,
        recommendedUseByDate: metadata.recommendedUseByDate
          ? new Date(metadata.recommendedUseByDate)
          : item.expiryDate,
        reheatingInstructions: metadata.reheatingInstructions,
        timesReheated: metadata.timesReheated || 0,
        maxReheatings: metadata.maxReheatings || 2
      });
    }

    return true;
  }

  /**
   * Get leftover statistics
   */
  public getLeftoverStats(): {
    totalLeftovers: number;
    prioritized: number;
    averageLifespan: number;
    consumptionRate: number;
  } {
    const leftovers = this.getAllLeftovers();
    const prioritized = this.getPrioritizedLeftovers();

    // Calculate average time leftovers are kept
    let totalDays = 0;
    let countWithDates = 0;

    leftovers.forEach(l => {
      if (l.originalMealId) {
        const created = inventoryTrackingService.getItem(l.id)?.createdAt;
        if (created) {
          totalDays += Math.floor(
            (new Date().getTime() - new Date(created).getTime()) / (1000 * 60 * 60 * 24)
          );
          countWithDates++;
        }
      }
    });

    // Calculate overall consumption rate
    let totalRates = 0;
    let rateCount = 0;
    this.consumptionRates.forEach(rates => {
      totalRates += rates.reduce((a, b) => a + b, 0);
      rateCount += rates.length;
    });

    return {
      totalLeftovers: leftovers.length,
      prioritized: prioritized.length,
      averageLifespan: countWithDates > 0 ? totalDays / countWithDates : 0,
      consumptionRate: rateCount > 0 ? totalRates / rateCount : 1
    };
  }
}

// Export singleton instance
export const leftoverManagementService = new LeftoverManagementService();
