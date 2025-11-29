/**
 * Hydration Tracking Database Service
 * Handles hydration logging and goal tracking
 */

import { query } from '../connection';
import { QueryResult } from 'pg';
import { v4 as uuidv4 } from 'uuid';

interface HydrationLog {
  id: string;
  user_id: string;
  logged_at: Date;
  amount_oz: number;
  beverage_type: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface HydrationGoal {
  id: string;
  user_id: string;
  daily_water_oz: number;
  daily_caffeine_limit_mg: number;
  personalized_formula_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

interface HydrationLogInput {
  timestamp?: string;
  amount_oz: number;
  beverage_type?: string;
  notes?: string;
}

interface HydrationTrendOptions {
  // Reserved for future options
}

const hydrationService = {
  // Default caffeine content per 8oz (mg)
  CAFFEINE_DEFAULTS: {
    coffee: 95,
    tea: 47,
    soda: 30,
    energy_drink: 80,
    other: 0
  },

  /**
   * Log hydration entry
   * @param userId - User UUID
   * @param entry - Hydration entry data
   * @returns Created log entry
   */
  async log(userId: string, entry: HydrationLogInput): Promise<any> {
    const result: QueryResult<HydrationLog> = await query(
      `INSERT INTO hydration_logs (
        id, user_id, logged_at, amount_oz, beverage_type, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        uuidv4(),
        userId,
        entry.timestamp || new Date().toISOString(),
        entry.amount_oz,
        entry.beverage_type || 'water',
        entry.notes || null
      ]
    );

    return this._formatLog(result.rows[0]);
  },

  /**
   * Find log by ID
   * @param id - Log UUID
   * @returns Log entry
   */
  async findById(id: string): Promise<any | null> {
    const result: QueryResult<HydrationLog> = await query(
      'SELECT * FROM hydration_logs WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;
    return this._formatLog(result.rows[0]);
  },

  /**
   * Find today's logs for user
   * @param userId - User UUID
   * @returns Today's logs
   */
  async findTodayLogs(userId: string): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];

    const result: QueryResult<HydrationLog> = await query(
      `SELECT * FROM hydration_logs
       WHERE user_id = $1
       AND DATE(logged_at) = $2
       ORDER BY logged_at DESC`,
      [userId, today]
    );

    return result.rows.map(this._formatLog);
  },

  /**
   * Get today's hydration progress
   * @param userId - User UUID
   * @returns Progress data
   */
  async getTodayProgress(userId: string): Promise<any> {
    const logs = await this.findTodayLogs(userId);
    const goals = await this.getGoals(userId);

    const totalOz = logs.reduce((sum: number, log: any) => sum + log.amountOz, 0);
    const goalOz = goals.dailyWaterOz;
    const percentage = Math.min(100, Math.round((totalOz / goalOz) * 100));
    const remaining = Math.max(0, goalOz - totalOz);

    return {
      total_oz: totalOz,
      goal_oz: goalOz,
      percentage,
      remaining,
      entries: logs
    };
  },

  /**
   * Get user's hydration goals
   * @param userId - User UUID
   * @returns Goals
   */
  async getGoals(userId: string): Promise<any> {
    const result: QueryResult<HydrationGoal> = await query(
      'SELECT * FROM hydration_goals WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length > 0) {
      return this._formatGoals(result.rows[0]);
    }

    // Create default goals based on user weight
    const userResult: QueryResult = await query(
      'SELECT current_weight_kg FROM users WHERE id = $1',
      [userId]
    );

    const weightLbs = userResult.rows[0]?.current_weight_kg
      ? Math.round(userResult.rows[0].current_weight_kg * 2.20462)
      : 250;

    const calculatedOz = Math.max(64, Math.round(weightLbs / 2));

    const createResult: QueryResult<HydrationGoal> = await query(
      `INSERT INTO hydration_goals (
        id, user_id, daily_water_oz, daily_caffeine_limit_mg, personalized_formula_enabled
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [uuidv4(), userId, calculatedOz, 400, true]
    );

    return this._formatGoals(createResult.rows[0]);
  },

  /**
   * Update hydration goals
   * @param userId - User UUID
   * @param updates - Goal updates
   * @returns Updated goals
   */
  async updateGoals(userId: string, updates: Record<string, any>): Promise<any> {
    const current = await this.getGoals(userId);

    const allowedFields = [
      'daily_water_oz', 'daily_caffeine_limit_mg', 'personalized_formula_enabled'
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
      return current;
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result: QueryResult<HydrationGoal> = await query(
      `UPDATE hydration_goals SET ${setClauses.join(', ')}
       WHERE user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    return this._formatGoals(result.rows[0]);
  },

  /**
   * Get hydration trends
   * @param userId - User UUID
   * @param options - Query options
   * @returns Trend data
   */
  async getTrends(userId: string, _options: HydrationTrendOptions = {}): Promise<any> {
    const result: QueryResult = await query(
      `SELECT
        DATE(logged_at) as date,
        SUM(amount_oz) as total_oz
       FROM hydration_logs
       WHERE user_id = $1
       AND logged_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(logged_at)
       ORDER BY date DESC`,
      [userId]
    );

    const goals = await this.getGoals(userId);
    const weeklyData = result.rows.map(row => ({
      date: row.date,
      total_oz: parseFloat(row.total_oz),
      goal_oz: goals.dailyWaterOz,
      adherence_rate: Math.min(100, Math.round((parseFloat(row.total_oz) / goals.dailyWaterOz) * 100))
    }));

    // Hourly patterns
    const hourlyResult: QueryResult = await query(
      `SELECT
        EXTRACT(HOUR FROM logged_at) as hour,
        SUM(amount_oz) as total_oz
       FROM hydration_logs
       WHERE user_id = $1
       AND logged_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY hour
       ORDER BY hour`,
      [userId]
    );

    const hourlyPatterns: Record<string, number> = {};
    hourlyResult.rows.forEach(row => {
      hourlyPatterns[row.hour] = parseFloat(row.total_oz);
    });

    const avgDaily = weeklyData.length > 0
      ? Math.round(weeklyData.reduce((sum: number, d: any) => sum + d.total_oz, 0) / weeklyData.length)
      : 0;

    const avgAdherence = weeklyData.length > 0
      ? Math.round(weeklyData.reduce((sum: number, d: any) => sum + d.adherence_rate, 0) / weeklyData.length)
      : 0;

    return {
      weekly: weeklyData,
      avg_daily_oz: avgDaily,
      adherence_rate: avgAdherence,
      hourly_patterns: hourlyPatterns
    };
  },

  /**
   * Delete log entry
   * @param id - Log UUID
   * @returns Success status
   */
  async delete(id: string): Promise<boolean> {
    const result: QueryResult = await query(
      'DELETE FROM hydration_logs WHERE id = $1',
      [id]
    );

    return result.rowCount !== null && result.rowCount > 0;
  },

  /**
   * Format log for API response
   * @private
   */
  _formatLog(row: HydrationLog | null): any {
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      loggedAt: row.logged_at,
      amountOz: parseFloat(row.amount_oz.toString()),
      beverageType: row.beverage_type,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  /**
   * Format goals for API response
   * @private
   */
  _formatGoals(row: HydrationGoal | null): any {
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      dailyWaterOz: parseInt(row.daily_water_oz.toString()),
      dailyCaffeineLimitMg: parseInt(row.daily_caffeine_limit_mg.toString()),
      personalizedFormulaEnabled: row.personalized_formula_enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};

export default hydrationService;
