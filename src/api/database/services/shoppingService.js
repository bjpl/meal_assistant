/**
 * Shopping List Database Service
 * Handles all shopping list-related database operations
 */

const { query, transaction } = require('../connection');

const shoppingService = {
  /**
   * Create shopping list
   * @param {Object} list - List data
   * @returns {Promise<Object>} Created list
   */
  async create(list) {
    return transaction(async (client) => {
      // Create list
      const listResult = await client.query(
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
   * @param {string} id - List UUID
   * @param {Object} client - Optional transaction client
   * @returns {Promise<Object|null>} List with items
   */
  async findById(id, client = null) {
    const db = client || { query };

    const listResult = await db.query(
      'SELECT * FROM shopping_lists WHERE id = $1',
      [id]
    );

    if (listResult.rows.length === 0) return null;

    const itemsResult = await db.query(
      'SELECT * FROM shopping_list_items WHERE list_id = $1 ORDER BY category, name',
      [id]
    );

    return this._formatList(listResult.rows[0], itemsResult.rows);
  },

  /**
   * Find lists by user
   * @param {string} userId - User UUID
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Lists
   */
  async findByUser(userId, options = {}) {
    let whereClause = 'WHERE sl.user_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (options.status) {
      whereClause += ` AND sl.status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    const result = await query(
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
   * @param {string} id - List UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated list
   */
  async update(id, updates) {
    const allowedFields = [
      'status', 'total_estimated', 'total_actual', 'notes'
    ];

    const setClauses = [];
    const values = [];
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
   * @param {string} listId - List UUID
   * @param {string} itemId - Item UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated item
   */
  async updateItem(listId, itemId, updates) {
    const allowedFields = [
      'name', 'category', 'quantity', 'unit', 'estimated_price',
      'actual_price', 'purchased', 'store', 'notes'
    ];

    const setClauses = [];
    const values = [];
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
   * @param {string} id - List UUID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    return transaction(async (client) => {
      // Delete items first
      await client.query('DELETE FROM shopping_list_items WHERE list_id = $1', [id]);

      // Delete list
      const result = await client.query('DELETE FROM shopping_lists WHERE id = $1', [id]);

      return result.rowCount > 0;
    });
  },

  /**
   * Recalculate list totals
   * @private
   */
  async _recalculateTotals(listId) {
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
  _formatList(listRow, itemRows) {
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
  _formatItem(row) {
    if (!row) return null;

    return {
      id: row.id,
      listId: row.list_id,
      name: row.name,
      category: row.category,
      quantity: parseFloat(row.quantity),
      unit: row.unit,
      estimatedPrice: row.estimated_price ? parseFloat(row.estimated_price) : null,
      actualPrice: row.actual_price ? parseFloat(row.actual_price) : null,
      purchased: row.purchased,
      store: row.store,
      notes: row.notes,
      purchasedAt: row.purchased_at
    };
  }
};

module.exports = shoppingService;
