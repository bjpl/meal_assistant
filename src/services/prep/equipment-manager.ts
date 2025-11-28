/**
 * Equipment Manager
 * Manages kitchen equipment inventory, status tracking, and alternatives
 */

import {
  Equipment,
  EquipmentInventory,
  EquipmentStatus,
  EquipmentCategory
} from '../../types/prep.types';

// ============================================================================
// Default Kitchen Equipment
// ============================================================================

const DEFAULT_EQUIPMENT: Equipment[] = [
  // Stovetop
  { id: 'burner-1', name: 'Front Left Burner', category: 'stovetop', status: 'clean', cleaningTime: 2 },
  { id: 'burner-2', name: 'Front Right Burner', category: 'stovetop', status: 'clean', cleaningTime: 2 },
  { id: 'burner-3', name: 'Back Left Burner', category: 'stovetop', status: 'clean', cleaningTime: 2 },
  { id: 'burner-4', name: 'Back Right Burner', category: 'stovetop', status: 'clean', cleaningTime: 2 },

  // Oven
  { id: 'oven', name: 'Oven', category: 'oven', slots: 2, status: 'clean', cleaningTime: 10 },
  { id: 'oven-rack-1', name: 'Upper Oven Rack', category: 'oven', status: 'clean', cleaningTime: 5 },
  { id: 'oven-rack-2', name: 'Lower Oven Rack', category: 'oven', status: 'clean', cleaningTime: 5 },

  // Appliances
  { id: 'microwave', name: 'Microwave', category: 'microwave', status: 'clean', cleaningTime: 3 },
  { id: 'instant-pot', name: 'Instant Pot', category: 'appliance', status: 'clean', cleaningTime: 8, alternatives: ['dutch-oven'] },
  { id: 'rice-cooker', name: 'Rice Cooker', category: 'appliance', status: 'clean', cleaningTime: 5, alternatives: ['pot-large'] },
  { id: 'air-fryer', name: 'Air Fryer', category: 'appliance', status: 'clean', cleaningTime: 5, alternatives: ['oven'] },
  { id: 'blender', name: 'Blender', category: 'appliance', status: 'clean', cleaningTime: 3 },
  { id: 'food-processor', name: 'Food Processor', category: 'appliance', status: 'clean', cleaningTime: 8, alternatives: ['blender'] },

  // Cookware
  { id: 'pot-large', name: 'Large Pot', category: 'tool', status: 'clean', cleaningTime: 5 },
  { id: 'pot-medium', name: 'Medium Pot', category: 'tool', status: 'clean', cleaningTime: 4 },
  { id: 'pot-small', name: 'Small Pot', category: 'tool', status: 'clean', cleaningTime: 3 },
  { id: 'dutch-oven', name: 'Dutch Oven', category: 'tool', status: 'clean', cleaningTime: 8 },
  { id: 'skillet-large', name: 'Large Skillet', category: 'tool', status: 'clean', cleaningTime: 4 },
  { id: 'skillet-medium', name: 'Medium Skillet', category: 'tool', status: 'clean', cleaningTime: 3 },
  { id: 'wok', name: 'Wok', category: 'tool', status: 'clean', cleaningTime: 4, alternatives: ['skillet-large'] },
  { id: 'sheet-pan-1', name: 'Sheet Pan 1', category: 'tool', status: 'clean', cleaningTime: 3 },
  { id: 'sheet-pan-2', name: 'Sheet Pan 2', category: 'tool', status: 'clean', cleaningTime: 3 },
  { id: 'baking-dish', name: 'Baking Dish', category: 'tool', status: 'clean', cleaningTime: 4 },

  // Prep tools
  { id: 'cutting-board-1', name: 'Large Cutting Board', category: 'tool', status: 'clean', cleaningTime: 2 },
  { id: 'cutting-board-2', name: 'Small Cutting Board', category: 'tool', status: 'clean', cleaningTime: 2 },
  { id: 'mixing-bowl-large', name: 'Large Mixing Bowl', category: 'tool', status: 'clean', cleaningTime: 2 },
  { id: 'mixing-bowl-medium', name: 'Medium Mixing Bowl', category: 'tool', status: 'clean', cleaningTime: 2 },
  { id: 'colander', name: 'Colander', category: 'tool', status: 'clean', cleaningTime: 2 },
  { id: 'strainer', name: 'Fine Mesh Strainer', category: 'tool', status: 'clean', cleaningTime: 3 },

  // Surfaces
  { id: 'counter-main', name: 'Main Counter', category: 'surface', capacity: 4, status: 'clean', cleaningTime: 2 },
  { id: 'counter-prep', name: 'Prep Counter', category: 'surface', capacity: 2, status: 'clean', cleaningTime: 2 },
];

// ============================================================================
// Equipment Manager Class
// ============================================================================

export class EquipmentManager {
  private inventory: EquipmentInventory;

  constructor(customEquipment?: Equipment[]) {
    this.inventory = {
      items: customEquipment || [...DEFAULT_EQUIPMENT],
      lastUpdated: new Date()
    };
  }

  // --------------------------------------------------------------------------
  // Inventory Management
  // --------------------------------------------------------------------------

  getAll(): Equipment[] {
    return [...this.inventory.items];
  }

  getById(id: string): Equipment | undefined {
    return this.inventory.items.find(e => e.id === id);
  }

  getByCategory(category: EquipmentCategory): Equipment[] {
    return this.inventory.items.filter(e => e.category === category);
  }

  getAvailable(): Equipment[] {
    return this.inventory.items.filter(e =>
      e.status === 'clean' || e.status === 'dirty'
    );
  }

  getClean(): Equipment[] {
    return this.inventory.items.filter(e => e.status === 'clean');
  }

  // --------------------------------------------------------------------------
  // Status Management
  // --------------------------------------------------------------------------

  updateStatus(id: string, status: EquipmentStatus): boolean {
    const equipment = this.inventory.items.find(e => e.id === id);
    if (!equipment) return false;

    equipment.status = status;
    this.inventory.lastUpdated = new Date();
    return true;
  }

  markInUse(id: string): boolean {
    return this.updateStatus(id, 'in_use');
  }

  markDirty(id: string): boolean {
    return this.updateStatus(id, 'dirty');
  }

  markClean(id: string): boolean {
    return this.updateStatus(id, 'clean');
  }

  markUnavailable(id: string): boolean {
    return this.updateStatus(id, 'unavailable');
  }

  // --------------------------------------------------------------------------
  // Alternative Equipment
  // --------------------------------------------------------------------------

  getAlternatives(id: string): Equipment[] {
    const equipment = this.getById(id);
    if (!equipment?.alternatives) return [];

    return equipment.alternatives
      .map(altId => this.getById(altId))
      .filter((e): e is Equipment => e !== undefined);
  }

  findAvailableAlternative(id: string): Equipment | undefined {
    const alternatives = this.getAlternatives(id);
    return alternatives.find(e => e.status === 'clean');
  }

  suggestAlternatives(ids: string[]): Map<string, Equipment | undefined> {
    const suggestions = new Map<string, Equipment | undefined>();

    for (const id of ids) {
      const equipment = this.getById(id);
      if (!equipment || equipment.status !== 'clean') {
        suggestions.set(id, this.findAvailableAlternative(id));
      }
    }

    return suggestions;
  }

  // --------------------------------------------------------------------------
  // Capacity Checking
  // --------------------------------------------------------------------------

  checkCapacity(id: string, slotsNeeded: number = 1): boolean {
    const equipment = this.getById(id);
    if (!equipment) return false;

    if (equipment.slots !== undefined) {
      return equipment.slots >= slotsNeeded;
    }

    if (equipment.capacity !== undefined) {
      return equipment.capacity >= slotsNeeded;
    }

    return true; // Single-slot equipment
  }

  getAvailableSlots(id: string): number {
    const equipment = this.getById(id);
    if (!equipment) return 0;

    if (equipment.status !== 'clean') return 0;

    return equipment.slots ?? equipment.capacity ?? 1;
  }

  // --------------------------------------------------------------------------
  // Burner Coordination
  // --------------------------------------------------------------------------

  getAvailableBurners(): Equipment[] {
    return this.inventory.items.filter(e =>
      e.category === 'stovetop' && e.status === 'clean'
    );
  }

  allocateBurner(): Equipment | undefined {
    const burners = this.getAvailableBurners();
    if (burners.length === 0) return undefined;

    // Prefer front burners for accessibility
    const frontBurner = burners.find(b => b.id.includes('front'));
    return frontBurner || burners[0];
  }

  // --------------------------------------------------------------------------
  // Cleaning Time Estimation
  // --------------------------------------------------------------------------

  getTotalCleaningTime(ids: string[]): number {
    return ids.reduce((total, id) => {
      const equipment = this.getById(id);
      return total + (equipment?.cleaningTime || 0);
    }, 0);
  }

  getDirtyEquipment(): Equipment[] {
    return this.inventory.items.filter(e => e.status === 'dirty');
  }

  // --------------------------------------------------------------------------
  // Equipment Addition/Removal
  // --------------------------------------------------------------------------

  addEquipment(equipment: Equipment): void {
    const existing = this.getById(equipment.id);
    if (existing) {
      Object.assign(existing, equipment);
    } else {
      this.inventory.items.push(equipment);
    }
    this.inventory.lastUpdated = new Date();
  }

  removeEquipment(id: string): boolean {
    const index = this.inventory.items.findIndex(e => e.id === id);
    if (index === -1) return false;

    this.inventory.items.splice(index, 1);
    this.inventory.lastUpdated = new Date();
    return true;
  }

  // --------------------------------------------------------------------------
  // Serialization
  // --------------------------------------------------------------------------

  toJSON(): EquipmentInventory {
    return { ...this.inventory };
  }

  static fromJSON(data: EquipmentInventory): EquipmentManager {
    const manager = new EquipmentManager(data.items);
    manager.inventory.lastUpdated = new Date(data.lastUpdated);
    return manager;
  }

  // --------------------------------------------------------------------------
  // Reset
  // --------------------------------------------------------------------------

  resetAllToClean(): void {
    this.inventory.items.forEach(e => {
      if (e.status !== 'unavailable') {
        e.status = 'clean';
      }
    });
    this.inventory.lastUpdated = new Date();
  }
}
