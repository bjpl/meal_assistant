/**
 * Pattern Database Service
 * Handles all eating pattern-related database operations
 */

const { query, transaction } = require('../connection');

const patternService = {
  /**
   * Get all available eating patterns
   * @returns {Promise<Array>} List of eating patterns
   */
  async getAll() {
    const result = await query(
      `SELECT id, code, name, description, optimal_for,
              eating_window_start, eating_window_end, is_intermittent_fasting,
              meal_structure, total_calories, total_protein_g, is_active
       FROM eating_patterns
       WHERE is_active = TRUE
       ORDER BY code`
    );

    return result.rows.map(this._formatPattern);
  },

  /**
   * Get pattern by code (A, B, C, D, E, F, G)
   * @param {string} code - Pattern code
   * @returns {Promise<Object|null>} Pattern object
   */
  async getByCode(code) {
    const result = await query(
      `SELECT id, code, name, description, optimal_for,
              eating_window_start, eating_window_end, is_intermittent_fasting,
              meal_structure, total_calories, total_protein_g
       FROM eating_patterns WHERE code = $1 AND is_active = TRUE`,
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) return null;
    return this._formatPattern(result.rows[0]);
  },

  /**
   * Get pattern by ID
   * @param {string} id - Pattern UUID
   * @returns {Promise<Object|null>} Pattern object
   */
  async getById(id) {
    const result = await query(
      `SELECT id, code, name, description, optimal_for,
              eating_window_start, eating_window_end, is_intermittent_fasting,
              meal_structure, total_calories, total_protein_g
       FROM eating_patterns WHERE id = $1 AND is_active = TRUE`,
      [id]
    );

    if (result.rows.length === 0) return null;
    return this._formatPattern(result.rows[0]);
  },

  /**
   * Get user's pattern preferences
   * @param {string} userId - User UUID
   * @returns {Promise<Array>} User pattern preferences
   */
  async getUserPreferences(userId) {
    const result = await query(
      `SELECT upp.id, upp.preference_rank, upp.is_default,
              upp.custom_meal_times, upp.custom_calories, upp.notes,
              ep.code, ep.name, ep.description, ep.meal_structure
       FROM user_pattern_preferences upp
       JOIN eating_patterns ep ON upp.pattern_id = ep.id
       WHERE upp.user_id = $1
       ORDER BY upp.preference_rank`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      patternCode: row.code,
      patternName: row.name,
      description: row.description,
      preferenceRank: row.preference_rank,
      isDefault: row.is_default,
      customMealTimes: row.custom_meal_times,
      customCalories: row.custom_calories,
      notes: row.notes,
      mealStructure: row.meal_structure
    }));
  },

  /**
   * Set user's default pattern
   * @param {string} userId - User UUID
   * @param {string} patternCode - Pattern code (A-G)
   * @returns {Promise<Object>} Updated preference
   */
  async setUserDefaultPattern(userId, patternCode) {
    return transaction(async (client) => {
      // Get pattern ID from code
      const patternResult = await client.query(
        'SELECT id FROM eating_patterns WHERE code = $1',
        [patternCode.toUpperCase()]
      );

      if (patternResult.rows.length === 0) {
        throw new Error(`Pattern ${patternCode} not found`);
      }

      const patternId = patternResult.rows[0].id;

      // Remove current default
      await client.query(
        'UPDATE user_pattern_preferences SET is_default = FALSE WHERE user_id = $1',
        [userId]
      );

      // Upsert new default
      const result = await client.query(
        `INSERT INTO user_pattern_preferences (user_id, pattern_id, is_default, preference_rank)
         VALUES ($1, $2, TRUE, 1)
         ON CONFLICT (user_id, pattern_id)
         DO UPDATE SET is_default = TRUE, preference_rank = 1
         RETURNING id`,
        [userId, patternId]
      );

      return { success: true, preferenceId: result.rows[0].id };
    });
  },

  /**
   * Record daily pattern selection
   * @param {string} userId - User UUID
   * @param {string} patternCode - Pattern code
   * @param {string} date - Date (YYYY-MM-DD)
   * @param {Object} factors - Decision factors
   * @returns {Promise<Object>} Created selection record
   */
  async recordDailySelection(userId, patternCode, date, factors = {}) {
    const patternResult = await query(
      'SELECT id FROM eating_patterns WHERE code = $1',
      [patternCode.toUpperCase()]
    );

    if (patternResult.rows.length === 0) {
      throw new Error(`Pattern ${patternCode} not found`);
    }

    const result = await query(
      `INSERT INTO daily_pattern_selections
       (user_id, pattern_id, date, morning_hunger_level, schedule_type,
        exercise_timing, previous_day_outcome)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         pattern_id = EXCLUDED.pattern_id,
         morning_hunger_level = EXCLUDED.morning_hunger_level,
         schedule_type = EXCLUDED.schedule_type,
         exercise_timing = EXCLUDED.exercise_timing,
         previous_day_outcome = EXCLUDED.previous_day_outcome
       RETURNING id, date`,
      [
        userId,
        patternResult.rows[0].id,
        date,
        factors.morningHunger || null,
        factors.scheduleType || null,
        factors.exerciseTiming || null,
        factors.previousDayOutcome || null
      ]
    );

    return {
      id: result.rows[0].id,
      date: result.rows[0].date,
      patternCode
    };
  },

  /**
   * Update daily pattern rating
   * @param {string} userId - User UUID
   * @param {string} date - Date (YYYY-MM-DD)
   * @param {Object} ratings - Rating values
   * @returns {Promise<Object>} Updated record
   */
  async updateDailyRating(userId, date, ratings) {
    const result = await query(
      `UPDATE daily_pattern_selections
       SET adherence_rating = $1, energy_rating = $2, satisfaction_rating = $3, notes = $4
       WHERE user_id = $5 AND date = $6
       RETURNING id, adherence_rating, energy_rating, satisfaction_rating`,
      [
        ratings.adherence,
        ratings.energy,
        ratings.satisfaction,
        ratings.notes || null,
        userId,
        date
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('No pattern selection found for this date');
    }

    return result.rows[0];
  },

  /**
   * Get user's pattern history
   * @param {string} userId - User UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Pattern selection history
   */
  async getHistory(userId, options = {}) {
    const { startDate, endDate, limit = 30 } = options;

    let whereClause = 'WHERE dps.user_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (startDate) {
      whereClause += ` AND dps.date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      whereClause += ` AND dps.date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    params.push(limit);

    const result = await query(
      `SELECT dps.id, dps.date, ep.code as pattern_code, ep.name as pattern_name,
              dps.morning_hunger_level, dps.schedule_type, dps.exercise_timing,
              dps.adherence_rating, dps.energy_rating, dps.satisfaction_rating, dps.notes
       FROM daily_pattern_selections dps
       JOIN eating_patterns ep ON dps.pattern_id = ep.id
       ${whereClause}
       ORDER BY dps.date DESC
       LIMIT $${paramIndex}`,
      params
    );

    return result.rows.map(row => ({
      id: row.id,
      date: row.date,
      patternCode: row.pattern_code,
      patternName: row.pattern_name,
      factors: {
        morningHunger: row.morning_hunger_level,
        scheduleType: row.schedule_type,
        exerciseTiming: row.exercise_timing
      },
      ratings: {
        adherence: row.adherence_rating,
        energy: row.energy_rating,
        satisfaction: row.satisfaction_rating
      },
      notes: row.notes
    }));
  },

  /**
   * Get pattern statistics for user
   * @param {string} userId - User UUID
   * @param {number} days - Number of days to analyze
   * @returns {Promise<Object>} Pattern usage statistics
   */
  async getStatistics(userId, days = 30) {
    const result = await query(
      `SELECT ep.code as pattern_code, ep.name as pattern_name,
              COUNT(*) as times_used,
              ROUND(AVG(dps.adherence_rating)::numeric, 1) as avg_adherence,
              ROUND(AVG(dps.energy_rating)::numeric, 1) as avg_energy,
              ROUND(AVG(dps.satisfaction_rating)::numeric, 1) as avg_satisfaction,
              MAX(dps.date) as last_used
       FROM daily_pattern_selections dps
       JOIN eating_patterns ep ON dps.pattern_id = ep.id
       WHERE dps.user_id = $1 AND dps.date >= CURRENT_DATE - $2::integer
       GROUP BY ep.code, ep.name
       ORDER BY times_used DESC`,
      [userId, days]
    );

    return result.rows.map(row => ({
      patternCode: row.pattern_code,
      patternName: row.pattern_name,
      timesUsed: parseInt(row.times_used),
      averageAdherence: parseFloat(row.avg_adherence) || null,
      averageEnergy: parseFloat(row.avg_energy) || null,
      averageSatisfaction: parseFloat(row.avg_satisfaction) || null,
      lastUsed: row.last_used
    }));
  },

  /**
   * Format pattern for API response
   * @private
   */
  _formatPattern(row) {
    return {
      id: row.code, // Use code as ID for mobile compatibility
      dbId: row.id,
      name: row.name,
      description: row.description,
      optimalFor: row.optimal_for || [],
      meals: row.meal_structure?.meals || [],
      eatingWindow: {
        start: row.eating_window_start,
        end: row.eating_window_end
      },
      isFastingPattern: row.is_intermittent_fasting,
      totalCalories: row.total_calories,
      totalProtein: row.total_protein_g
    };
  }
};

module.exports = patternService;
