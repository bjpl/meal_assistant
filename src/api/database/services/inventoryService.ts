/**
 * Inventory Database Service
 * Handles all inventory-related database operations
 */

import { query, transaction } from '../connection';
import { QueryResult, PoolClient } from 'pg';

interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  subcategory: string | null;
  quantity: number;
  unit: string;
  location: string;
  purchase_date: Date | null;
  expiry_date: Date | null;
  purchase_price: number | null;
  barcode: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface InventoryItemInput {
  id: string;
  userId: string;
  name: string;
  category: string;
  subcategory?: string;
  quantity: number;
  unit: string;
  location?: string;
  purchaseDate?: Date;
  expiryDate?: Date;
  purchasePrice?: number;
  barcode?: string;
  notes?: string;
}

interface InventoryFilterOptions {
  category?: string;
  location?: string;
}

const inventoryService = {
  /**
   * Create inventory item
   * @param item - Item data
   * @returns Created item
   */
  async create(item: InventoryItemInput): Promise<any> {
    const result: QueryResult<InventoryItem> = await query(
      `INSERT INTO inventory_items (
        id, user_id, name, category, subcategory,
        quantity, unit, location, purchase_date, expiry_date,
        purchase_price, barcode, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        item.id,
        item.userId,
        item.name,
        item.category,
        item.subcategory || null,
        item.quantity,
        item.unit,
        item.location || 'pantry',
        item.purchaseDate || null,
        item.expiryDate || null,
        item.purchasePrice || null,
        item.barcode || null,
        item.notes || null
      ]
    );

    return this._formatItem(result.rows[0]);
  },

  /**
   * Create multiple items in batch
   * @param items - Array of items
   * @returns Created items
   */
  async createBatch(items: InventoryItemInput[]): Promise<any[]> {
    return transaction(async (client: PoolClient) => {
      const created: any[] = [];

      for (const item of items) {
        const result: QueryResult<InventoryItem> = await client.query(
          `INSERT INTO inventory_items (
            id, user_id, name, category, subcategory,
            quantity, unit, location, purchase_date, expiry_date,
            purchase_price, barcode, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *`,
          [
            item.id,
            item.userId,
            item.name,
            item.category,
            item.subcategory || null,
            item.quantity,
            item.unit,
            item.location || 'pantry',
            item.purchaseDate || null,
            item.expiryDate || null,
            item.purchasePrice || null,
            item.barcode || null,
            item.notes || null
          ]
        );

        created.push(this._formatItem(result.rows[0]));
      }

      return created;
    });
  },

  /**
   * Find item by ID
   * @param id - Item UUID
   * @returns Item object
   */
  async findById(id: string): Promise<any | null> {
    const result: QueryResult<InventoryItem> = await query(
      'SELECT * FROM inventory_items WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;
    return this._formatItem(result.rows[0]);
  },

  /**
   * Find items by user with optional filters
   * @param userId - User UUID
   * @param options - Filter options
   * @returns Items
   */
  async findByUser(userId: string, options: InventoryFilterOptions = {}): Promise<any[]> {
    let whereClause = 'WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options.category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(options.category);
      paramIndex++;
    }

    if (options.location) {
      whereClause += ` AND location = $${paramIndex}`;
      params.push(options.location);
      paramIndex++;
    }

    const result: QueryResult<InventoryItem> = await query(
      `SELECT * FROM inventory_items ${whereClause} ORDER BY created_at DESC`,
      params
    );

    return result.rows.map(row => this._formatItem(row));
  },

  /**
   * Find items expiring within specified hours
   * @param userId - User UUID
   * @param hoursAhead - Hours to look ahead
   * @returns Expiring items
   */
  async findExpiring(userId: string, hoursAhead: number = 48): Promise<any[]> {
    const result: QueryResult<InventoryItem> = await query(
      `SELECT * FROM inventory_items
       WHERE user_id = $1
       AND expiry_date IS NOT NULL
       AND expiry_date <= NOW() + INTERVAL '${hoursAhead} hours'
       AND expiry_date > NOW()
       AND quantity > 0
       ORDER BY expiry_date ASC`,
      [userId]
    );

    return result.rows.map(this._formatItem);
  },

  /**
   * Update item
   * @param id - Item UUID
   * @param updates - Fields to update
   * @returns Updated item
   */
  async update(id: string, updates: Record<string, any>): Promise<any | null> {
    const allowedFields = [
      'name', 'category', 'subcategory', 'quantity', 'unit',
      'location', 'purchase_date', 'expiry_date', 'purchase_price',
      'barcode', 'notes'
    ];

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result: QueryResult<InventoryItem> = await query(
      `UPDATE inventory_items SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return this._formatItem(result.rows[0]);
  },

  /**
   * Consume quantity from inventory
   * @param id - Item UUID
   * @param quantity - Quantity to consume
   * @returns Updated item
   */
  async consume(id: string, quantity: number): Promise<any> {
    const result: QueryResult<InventoryItem> = await query(
      `UPDATE inventory_items
       SET quantity = GREATEST(0, quantity - $1),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [quantity, id]
    );

    return this._formatItem(result.rows[0]);
  },

  /**
   * Delete item
   * @param id - Item UUID
   * @returns Success status
   */
  async delete(id: string): Promise<boolean> {
    const result: QueryResult = await query(
      'DELETE FROM inventory_items WHERE id = $1',
      [id]
    );

    return result.rowCount !== null && result.rowCount > 0;
  },

  /**
   * Format item for API response
   * @private
   */
  _formatItem(row: InventoryItem | null): any {
    if (!row) return null;

    // Calculate expiry status
    let expiryStatus = 'fresh';
    if (row.expiry_date) {
      const now = new Date();
      const expiry = new Date(row.expiry_date);
      const hoursUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilExpiry < 0) {
        expiryStatus = 'expired';
      } else if (hoursUntilExpiry < 24) {
        expiryStatus = 'urgent';
      } else if (hoursUntilExpiry < 48) {
        expiryStatus = 'expiring';
      }
    }

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory,
      quantity: parseFloat(row.quantity.toString()),
      unit: row.unit,
      location: row.location,
      purchaseDate: row.purchase_date,
      expiryDate: row.expiry_date,
      expiryStatus,
      purchasePrice: row.purchase_price ? parseFloat(row.purchase_price.toString()) : null,
      barcode: row.barcode,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};

export default inventoryService;
