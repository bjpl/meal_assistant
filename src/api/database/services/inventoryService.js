/**
 * Inventory Database Service
 * Handles all inventory-related database operations
 */

const { query, transaction } = require('../connection');

const inventoryService = {
  /**
   * Create inventory item
   * @param {Object} item - Item data
   * @returns {Promise<Object>} Created item
   */
  async create(item) {
    const result = await query(
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
   * @param {Array} items - Array of items
   * @returns {Promise<Array>} Created items
   */
  async createBatch(items) {
    return transaction(async (client) => {
      const created = [];

      for (const item of items) {
        const result = await client.query(
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
   * @param {string} id - Item UUID
   * @returns {Promise<Object|null>} Item object
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM inventory_items WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;
    return this._formatItem(result.rows[0]);
  },

  /**
   * Find items by user with optional filters
   * @param {string} userId - User UUID
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Items
   */
  async findByUser(userId, options = {}) {
    let whereClause = 'WHERE user_id = $1';
    const params = [userId];
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

    const result = await query(
      `SELECT * FROM inventory_items ${whereClause} ORDER BY created_at DESC`,
      params
    );

    return result.rows.map(row => this._formatItem(row));
  },

  /**
   * Find items expiring within specified hours
   * @param {string} userId - User UUID
   * @param {number} hoursAhead - Hours to look ahead
   * @returns {Promise<Array>} Expiring items
   */
  async findExpiring(userId, hoursAhead = 48) {
    const result = await query(
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
   * @param {string} id - Item UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated item
   */
  async update(id, updates) {
    const allowedFields = [
      'name', 'category', 'subcategory', 'quantity', 'unit',
      'location', 'purchase_date', 'expiry_date', 'purchase_price',
      'barcode', 'notes'
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

    const result = await query(
      `UPDATE inventory_items SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return this._formatItem(result.rows[0]);
  },

  /**
   * Consume quantity from inventory
   * @param {string} id - Item UUID
   * @param {number} quantity - Quantity to consume
   * @returns {Promise<Object>} Updated item
   */
  async consume(id, quantity) {
    const result = await query(
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
   * @param {string} id - Item UUID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    const result = await query(
      'DELETE FROM inventory_items WHERE id = $1',
      [id]
    );

    return result.rowCount > 0;
  },

  /**
   * Format item for API response
   * @private
   */
  _formatItem(row) {
    if (!row) return null;

    // Calculate expiry status
    let expiryStatus = 'fresh';
    if (row.expiry_date) {
      const now = new Date();
      const expiry = new Date(row.expiry_date);
      const hoursUntilExpiry = (expiry - now) / (1000 * 60 * 60);

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
      quantity: parseFloat(row.quantity),
      unit: row.unit,
      location: row.location,
      purchaseDate: row.purchase_date,
      expiryDate: row.expiry_date,
      expiryStatus,
      purchasePrice: row.purchase_price ? parseFloat(row.purchase_price) : null,
      barcode: row.barcode,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};

module.exports = inventoryService;
