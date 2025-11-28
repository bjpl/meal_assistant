/**
 * Meal Database Service
 * Handles all meal-related database operations
 */

const { query, transaction } = require('../connection');

const mealService = {
  /**
   * Create a meal record
   * @param {Object} meal - Meal data
   * @returns {Promise<Object>} Created meal
   */
  async create(meal) {
    const result = await query(
      `INSERT INTO meals (
        id, user_id, pattern_id, date, meal_index,
        name, time, calories, protein_g, carbs_g, fat_g,
        status, category
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        meal.id,
        meal.userId,
        meal.patternId,
        meal.date,
        meal.index,
        meal.name,
        meal.time,
        meal.calories,
        meal.protein,
        meal.carbs || null,
        meal.fat || null,
        meal.status || 'pending',
        meal.category || null
      ]
    );

    return this._formatMeal(result.rows[0]);
  },

  /**
   * Find meal by ID
   * @param {string} id - Meal UUID
   * @returns {Promise<Object|null>} Meal object
   */
  async findById(id) {
    const result = await query(
      `SELECT m.*, dps.pattern_id
       FROM meals m
       LEFT JOIN daily_pattern_selections dps ON m.pattern_id = dps.id
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;
    return this._formatMeal(result.rows[0]);
  },

  /**
   * Find meals by pattern
   * @param {string} patternId - Pattern selection UUID
   * @returns {Promise<Array>} Meals
   */
  async findByPattern(patternId) {
    const result = await query(
      `SELECT * FROM meals
       WHERE pattern_id = $1
       ORDER BY meal_index`,
      [patternId]
    );

    return result.rows.map(this._formatMeal);
  },

  /**
   * Find today's meals for user
   * @param {string} userId - User UUID
   * @returns {Promise<Array>} Today's meals
   */
  async findTodayMeals(userId) {
    const today = new Date().toISOString().split('T')[0];

    const result = await query(
      `SELECT m.* FROM meals m
       JOIN daily_pattern_selections dps ON m.pattern_id = dps.id
       WHERE dps.user_id = $1 AND dps.date = $2
       ORDER BY m.meal_index`,
      [userId, today]
    );

    return result.rows.map(this._formatMeal);
  },

  /**
   * Update meal
   * @param {string} id - Meal UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated meal
   */
  async update(id, updates) {
    const allowedFields = [
      'status', 'actual_calories', 'actual_protein_g', 'actual_carbs_g', 'actual_fat_g',
      'rating', 'notes', 'photo_url', 'logged_at'
    ];

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      // Convert camelCase to snake_case
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    // Handle substitutions separately (JSONB field)
    if (updates.substitutions) {
      setClauses.push(`substitutions = $${paramIndex}`);
      values.push(JSON.stringify(updates.substitutions));
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    // Set logged_at if status is being changed
    if (updates.status && !updates.logged_at) {
      setClauses.push(`logged_at = CURRENT_TIMESTAMP`);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE meals SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return this._formatMeal(result.rows[0]);
  },

  /**
   * Log meal consumption
   * @param {string} mealId - Meal UUID
   * @param {Object} logData - Consumption data
   * @returns {Promise<Object>} Updated meal
   */
  async logMeal(mealId, logData) {
    return this.update(mealId, {
      status: logData.status || 'completed',
      actualCalories: logData.actualCalories,
      actualProtein: logData.actualProtein,
      actualCarbs: logData.actualCarbs,
      actualFat: logData.actualFat,
      rating: logData.rating,
      notes: logData.notes,
      photoUrl: logData.photoUrl,
      substitutions: logData.substitutions,
      logged_at: new Date().toISOString()
    });
  },

  /**
   * Add substitution to meal
   * @param {string} mealId - Meal UUID
   * @param {Object} substitution - Substitution data
   * @returns {Promise<Object>} Updated meal
   */
  async addSubstitution(mealId, substitution) {
    // First get current substitutions
    const meal = await this.findById(mealId);
    if (!meal) throw new Error('Meal not found');

    const currentSubs = meal.substitutions || [];
    const newSubs = [...currentSubs, {
      ...substitution,
      timestamp: new Date().toISOString()
    }];

    return this.update(mealId, {
      substitutions: newSubs,
      calories: meal.calories + (substitution.calorieAdjustment || 0),
      protein: meal.protein + (substitution.proteinAdjustment || 0)
    });
  },

  /**
   * Delete meal
   * @param {string} id - Meal UUID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    const result = await query(
      'DELETE FROM meals WHERE id = $1',
      [id]
    );

    return result.rowCount > 0;
  },

  /**
   * Format meal for API response
   * @private
   */
  _formatMeal(row) {
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      patternId: row.pattern_id,
      date: row.date,
      index: row.meal_index,
      name: row.name,
      time: row.time,
      calories: row.calories,
      protein: row.protein_g,
      carbs: row.carbs_g,
      fat: row.fat_g,
      status: row.status,
      category: row.category,
      actualCalories: row.actual_calories,
      actualProtein: row.actual_protein_g,
      actualCarbs: row.actual_carbs_g,
      actualFat: row.actual_fat_g,
      rating: row.rating,
      notes: row.notes,
      photoUrl: row.photo_url,
      substitutions: row.substitutions || [],
      logged: row.logged_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};

module.exports = mealService;
