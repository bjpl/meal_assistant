/**
 * Pattern Database Service
 * Handles all eating pattern-related database operations
 */

import { query, transaction } from '../connection';
import { QueryResult, PoolClient } from 'pg';

interface EatingPattern {
  id: string;
  code: string;
  name: string;
  description: string;
  optimal_for: string[] | null;
  eating_window_start: string;
  eating_window_end: string;
  is_intermittent_fasting: boolean;
  meal_structure: {
    meals: any[];
  };
  total_calories: number;
  total_protein_g: number;
  is_active?: boolean;
}

interface UserPatternPreference {
  id: string;
  preference_rank: number;
  is_default: boolean;
  custom_meal_times: any;
  custom_calories: number | null;
  notes: string | null;
  code: string;
  name: string;
  description: string;
  meal_structure: any;
}

interface DailyPatternSelection {
  id: string;
  date: Date;
  pattern_code?: string;
}

interface PatternStatRow {
  pattern_code: string;
  pattern_name: string;
  times_used: string;
  avg_adherence: string | null;
  avg_energy: string | null;
  avg_satisfaction: string | null;
  last_used: Date;
}

interface HistoryOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
}

const patternService = {
  /**
   * Get all available eating patterns
   * @returns List of eating patterns
   */
  async getAll(): Promise<any[]> {
    const result: QueryResult<EatingPattern> = await query(
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
   * @param code - Pattern code
   * @returns Pattern object
   */
  async getByCode(code: string): Promise<any | null> {
    const result: QueryResult<EatingPattern> = await query(
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
   * @param id - Pattern UUID
   * @returns Pattern object
   */
  async getById(id: string): Promise<any | null> {
    const result: QueryResult<EatingPattern> = await query(
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
   * @param userId - User UUID
   * @returns User pattern preferences
   */
  async getUserPreferences(userId: string): Promise<any[]> {
    const result: QueryResult<UserPatternPreference> = await query(
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
   * @param userId - User UUID
   * @param patternCode - Pattern code (A-G)
   * @returns Updated preference
   */
  async setUserDefaultPattern(userId: string, patternCode: string): Promise<{ success: boolean; preferenceId: string }> {
    return transaction(async (client: PoolClient) => {
      // Get pattern ID from code
      const patternResult: QueryResult<{ id: string }> = await client.query(
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
      const result: QueryResult<{ id: string }> = await client.query(
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
   * @param userId - User UUID
   * @param patternCode - Pattern code
   * @param date - Date (YYYY-MM-DD)
   * @param factors - Decision factors
   * @returns Created selection record
   */
  async recordDailySelection(
    userId: string,
    patternCode: string,
    date: string,
    factors: Record<string, any> = {}
  ): Promise<{ id: string; date: Date; patternCode: string }> {
    const patternResult: QueryResult<{ id: string }> = await query(
      'SELECT id FROM eating_patterns WHERE code = $1',
      [patternCode.toUpperCase()]
    );

    if (patternResult.rows.length === 0) {
      throw new Error(`Pattern ${patternCode} not found`);
    }

    const result: QueryResult<DailyPatternSelection> = await query(
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
   * @param userId - User UUID
   * @param date - Date (YYYY-MM-DD)
   * @param ratings - Rating values
   * @returns Updated record
   */
  async updateDailyRating(userId: string, date: string, ratings: Record<string, any>): Promise<any> {
    const result: QueryResult = await query(
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
   * @param userId - User UUID
   * @param options - Query options
   * @returns Pattern selection history
   */
  async getHistory(userId: string, options: HistoryOptions = {}): Promise<any[]> {
    const { startDate, endDate, limit = 30 } = options;

    let whereClause = 'WHERE dps.user_id = $1';
    const params: any[] = [userId];
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

    const result: QueryResult = await query(
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
   * @param userId - User UUID
   * @param days - Number of days to analyze
   * @returns Pattern usage statistics
   */
  async getStatistics(userId: string, days: number = 30): Promise<any[]> {
    const result: QueryResult<PatternStatRow> = await query(
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
      averageAdherence: parseFloat(row.avg_adherence || '0'),
      averageEnergy: parseFloat(row.avg_energy || '0'),
      averageSatisfaction: parseFloat(row.avg_satisfaction || '0'),
      lastUsed: row.last_used
    }));
  },

  /**
   * Format pattern for API response
   * @private
   */
  _formatPattern(row: EatingPattern): any {
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

export default patternService;
