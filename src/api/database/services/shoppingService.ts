/**
 * Shopping List Database Service
 * Handles all shopping list-related database operations
 */

import { query, transaction } from '../connection';
import { QueryResult, PoolClient } from 'pg';

interface ShoppingList {
  id: string;
  user_id: string;
  week_of: Date;
  status: string;
  total_estimated: number;
  total_actual: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ShoppingListItem {
  id: string;
  list_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  estimated_price: number | null;
  actual_price: number | null;
  purchased: boolean;
  store: string | null;
  notes: string | null;
  purchased_at: Date | null;
}

interface ShoppingListInput {
  id: string;
  userId: string;
  weekOf: Date;
  status?: string;
  totalEstimated?: number;
  totalActual?: number;
  notes?: string;
  items?: ShoppingListItemInput[];
}

interface ShoppingListItemInput {
  id: string;
  name: string;
  category?: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number;
  actualPrice?: number;
  purchased?: boolean;
  store?: string;
  notes?: string;
}

interface ShoppingListFilterOptions {
  status?: string;
}

const shoppingService = {
  /**
   * Create shopping list
   * @param list - List data
   * @returns Created list
   */
  async create(list: ShoppingListInput): Promise<any> {
    return transaction(async (client: PoolClient) => {
      // Create list
      const listResult: QueryResult<ShoppingList> = await client.query(
        `INSERT INTO shopping_lists (
          id, user_id, week_of, status, total_estimated, total_actual, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          list.id,
          list.userId,
          list.weekOf,
          list.status || 'draft',
          list.totalEstimated || 0,
          list.totalActual || 0,
          list.notes || null
        ]
      );

      const createdList = listResult.rows[0];

      // Create items if provided
      if (list.items && list.items.length > 0) {
        for (const item of list.items) {
          await client.query(
            `INSERT INTO shopping_list_items (
              id, list_id, name, category, quantity, unit,
              estimated_price, actual_price, purchased, store, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              item.id,
              createdList.id,
              item.name,
              item.category || 'other',
              item.quantity,
              item.unit,
              item.estimatedPrice || null,
              item.actualPrice || null,
              item.purchased || false,
              item.store || null,
              item.notes || null
            ]
          );
        }
      }

      return this.findById(createdList.id, client);
    });
  },

  /**
   * Find list by ID
   * @param id - List UUID
   * @param client - Optional transaction client
   * @returns List with items
   */
  async findById(id: string, client: PoolClient | null = null): Promise<any | null> {
    const db = client || { query };

    const listResult: QueryResult<ShoppingList> = await db.query(
      'SELECT * FROM shopping_lists WHERE id = $1',
      [id]
    );

    if (listResult.rows.length === 0) return null;

    const itemsResult: QueryResult<ShoppingListItem> = await db.query(
      'SELECT * FROM shopping_list_items WHERE list_id = $1 ORDER BY category, name',
      [id]
    );

    return this._formatList(listResult.rows[0], itemsResult.rows);
  },

  /**
   * Find lists by user
   * @param userId - User UUID
   * @param options - Filter options
   * @returns Lists
   */
  async findByUser(userId: string, options: ShoppingListFilterOptions = {}): Promise<any[]> {
    let whereClause = 'WHERE sl.user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options.status) {
      whereClause += ` AND sl.status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    const result: QueryResult = await query(
      `SELECT sl.*,
              (SELECT json_agg(sli.* ORDER BY sli.category, sli.name)
               FROM shopping_list_items sli WHERE sli.list_id = sl.id) as items
       FROM shopping_lists sl
       ${whereClause}
       ORDER BY sl.week_of DESC`,
      params
    );

    return result.rows.map(row => this._formatList(row, row.items || []));
  },

  /**
   * Update list
   * @param id - List UUID
   * @param updates - Fields to update
   * @returns Updated list
   */
  async update(id: string, updates: Record<string, any>): Promise<any | null> {
    const allowedFields = [
      'status', 'total_estimated', 'total_actual', 'notes'
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

    await query(
      `UPDATE shopping_lists SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}`,
      values
    );

    return this.findById(id);
  },

  /**
   * Update list item
   * @param listId - List UUID
   * @param itemId - Item UUID
   * @param updates - Fields to update
   * @returns Updated item
   */
  async updateItem(listId: string, itemId: string, updates: Record<string, any>): Promise<any | null> {
    const allowedFields = [
      'name', 'category', 'quantity', 'unit', 'estimated_price',
      'actual_price', 'purchased', 'store', 'notes'
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
      return this.findById(listId);
    }

    // Set purchased_at if marking as purchased
    if (updates.purchased === true) {
      setClauses.push(`purchased_at = CURRENT_TIMESTAMP`);
    } else if (updates.purchased === false) {
      setClauses.push(`purchased_at = NULL`);
    }

    values.push(itemId);

    await query(
      `UPDATE shopping_list_items SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}`,
      values
    );

    // Recalculate list totals
    await this._recalculateTotals(listId);

    return this.findById(listId);
  },

  /**
   * Delete list
   * @param id - List UUID
   * @returns Success status
   */
  async delete(id: string): Promise<boolean> {
    return transaction(async (client: PoolClient) => {
      // Delete items first
      await client.query('DELETE FROM shopping_list_items WHERE list_id = $1', [id]);

      // Delete list
      const result: QueryResult = await client.query('DELETE FROM shopping_lists WHERE id = $1', [id]);

      return result.rowCount !== null && result.rowCount > 0;
    });
  },

  /**
   * Recalculate list totals
   * @private
   */
  async _recalculateTotals(listId: string): Promise<void> {
    await query(
      `UPDATE shopping_lists
       SET total_actual = (
         SELECT COALESCE(SUM(actual_price), 0)
         FROM shopping_list_items
         WHERE list_id = $1 AND purchased = true AND actual_price IS NOT NULL
       )
       WHERE id = $1`,
      [listId]
    );
  },

  /**
   * Format list for API response
   * @private
   */
  _formatList(listRow: any, itemRows: any[]): any {
    if (!listRow) return null;

    return {
      id: listRow.id,
      userId: listRow.user_id,
      weekOf: listRow.week_of,
      status: listRow.status,
      totalEstimated: listRow.total_estimated ? parseFloat(listRow.total_estimated) : 0,
      totalActual: listRow.total_actual ? parseFloat(listRow.total_actual) : 0,
      notes: listRow.notes,
      items: itemRows.map(this._formatItem),
      createdAt: listRow.created_at,
      updatedAt: listRow.updated_at
    };
  },

  /**
   * Format item for API response
   * @private
   */
  _formatItem(row: ShoppingListItem | null): any {
    if (!row) return null;

    return {
      id: row.id,
      listId: row.list_id,
      name: row.name,
      category: row.category,
      quantity: parseFloat(row.quantity.toString()),
      unit: row.unit,
      estimatedPrice: row.estimated_price ? parseFloat(row.estimated_price.toString()) : null,
      actualPrice: row.actual_price ? parseFloat(row.actual_price.toString()) : null,
      purchased: row.purchased,
      store: row.store,
      notes: row.notes,
      purchasedAt: row.purchased_at
    };
  }
};

export default shoppingService;
