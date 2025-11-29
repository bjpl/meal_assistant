/**
 * Analytics Database Service
 * Handles all analytics and statistics queries
 */

import { query } from '../connection';
import { QueryResult } from 'pg';

interface PatternStatRow {
  pattern_code: string;
  pattern_name: string;
  usage_count: string;
  avg_adherence: string | null;
  avg_energy: string | null;
  avg_satisfaction: string | null;
}

interface AdherenceStatRow {
  total_meals: string;
  completed_meals: string;
  skipped_meals: string;
  partial_meals: string;
}

interface WeightLogRow {
  weight_kg: number;
  measured_at: Date;
}

interface NutritionSummaryRow {
  total_calories: string;
  total_protein: string;
  total_carbs: string;
  total_fat: string;
  meals_completed: string;
}

interface WeeklyTrendRow {
  week_start: Date;
  avg_calories: string;
  avg_protein: string;
  adherence_rate: number;
}

interface AnalyticsOptions {
  startDate?: string;
  endDate?: string;
}

const analyticsService = {
  /**
   * Get pattern usage statistics
   * @param userId - User UUID
   * @param options - Query options
   * @returns Pattern statistics
   */
  async getPatternStats(userId: string, options: AnalyticsOptions = {}): Promise<Record<string, any>> {
    const { startDate, endDate } = options;

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

    const result: QueryResult<PatternStatRow> = await query(
      `SELECT ep.code as pattern_code,
              ep.name as pattern_name,
              COUNT(*) as usage_count,
              ROUND(AVG(dps.adherence_rating)::numeric, 1) as avg_adherence,
              ROUND(AVG(dps.energy_rating)::numeric, 1) as avg_energy,
              ROUND(AVG(dps.satisfaction_rating)::numeric, 1) as avg_satisfaction
       FROM daily_pattern_selections dps
       JOIN eating_patterns ep ON dps.pattern_id = ep.id
       ${whereClause}
       GROUP BY ep.code, ep.name
       ORDER BY usage_count DESC`,
      params
    );

    const stats: Record<string, any> = {};
    result.rows.forEach(row => {
      stats[row.pattern_code] = {
        count: parseInt(row.usage_count),
        adherenceRate: parseFloat(row.avg_adherence || '0'),
        avgRating: (
          (parseFloat(row.avg_adherence || '0') +
          parseFloat(row.avg_energy || '0') +
          parseFloat(row.avg_satisfaction || '0'))
        ) / 3,
        completed: parseInt(row.usage_count) // Simplified - could enhance with actual completion tracking
      };
    });

    return stats;
  },

  /**
   * Get adherence statistics
   * @param userId - User UUID
   * @param options - Query options
   * @returns Adherence stats
   */
  async getAdherenceStats(userId: string, options: AnalyticsOptions = {}): Promise<any> {
    const { startDate, endDate } = options;

    let whereClause = 'WHERE m.user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (startDate) {
      whereClause += ` AND m.date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND m.date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const result: QueryResult<AdherenceStatRow> = await query(
      `SELECT
        COUNT(*) as total_meals,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_meals,
        COUNT(CASE WHEN status = 'skipped' THEN 1 END) as skipped_meals,
        COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_meals
       FROM meals m
       ${whereClause}`,
      params
    );

    const row = result.rows[0];
    const totalMeals = parseInt(row.total_meals) || 0;
    const completedMeals = parseInt(row.completed_meals) || 0;
    const skippedMeals = parseInt(row.skipped_meals) || 0;
    const partialMeals = parseInt(row.partial_meals) || 0;

    return {
      totalMeals,
      completedMeals,
      skippedMeals,
      partialMeals,
      adherenceRate: totalMeals > 0 ? completedMeals / totalMeals : 0,
      completionRate: totalMeals > 0 ? (completedMeals + partialMeals) / totalMeals : 0
    };
  },

  /**
   * Get weight trend data
   * @param userId - User UUID
   * @param options - Query options
   * @returns Weight trend data
   */
  async getWeightTrend(userId: string, options: AnalyticsOptions = {}): Promise<any> {
    // Get current weight from user profile
    const userResult: QueryResult = await query(
      'SELECT current_weight_kg, target_weight_kg FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];

    // Get weight log history if available
    const logsResult: QueryResult<WeightLogRow> = await query(
      `SELECT weight_kg, measured_at
       FROM weight_logs
       WHERE user_id = $1
       ORDER BY measured_at DESC
       LIMIT 30`,
      [userId]
    );

    const dataPoints = logsResult.rows.map(row => ({
      date: row.measured_at,
      weight: parseFloat(row.weight_kg.toString())
    }));

    // Calculate trend
    let trend = 'stable';
    let weeklyChange = 0;

    if (dataPoints.length >= 2) {
      const latest = dataPoints[0].weight;
      const weekAgo = dataPoints.find((_, idx) => idx === 6)?.weight || dataPoints[dataPoints.length - 1].weight;
      weeklyChange = latest - weekAgo;

      if (weeklyChange < -0.5) trend = 'decreasing';
      else if (weeklyChange > 0.5) trend = 'increasing';
    }

    return {
      current: user.current_weight_kg ? parseFloat(user.current_weight_kg) : null,
      target: user.target_weight_kg ? parseFloat(user.target_weight_kg) : null,
      trend,
      weeklyChange,
      dataPoints
    };
  },

  /**
   * Get nutrition summary
   * @param userId - User UUID
   * @param date - Date (YYYY-MM-DD)
   * @returns Nutrition summary for date
   */
  async getNutritionSummary(userId: string, date: string): Promise<any> {
    const result: QueryResult<NutritionSummaryRow> = await query(
      `SELECT
        SUM(COALESCE(actual_calories, calories)) as total_calories,
        SUM(COALESCE(actual_protein_g, protein_g)) as total_protein,
        SUM(COALESCE(actual_carbs_g, carbs_g)) as total_carbs,
        SUM(COALESCE(actual_fat_g, fat_g)) as total_fat,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as meals_completed
       FROM meals
       WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );

    const row = result.rows[0];

    return {
      calories: parseInt(row.total_calories) || 0,
      protein: parseFloat(row.total_protein) || 0,
      carbs: parseFloat(row.total_carbs) || 0,
      fat: parseFloat(row.total_fat) || 0,
      mealsCompleted: parseInt(row.meals_completed) || 0
    };
  },

  /**
   * Get weekly nutrition trends
   * @param userId - User UUID
   * @param weeks - Number of weeks to analyze
   * @returns Weekly nutrition data
   */
  async getWeeklyTrends(userId: string, weeks: number = 4): Promise<any[]> {
    const result: QueryResult<WeeklyTrendRow> = await query(
      `SELECT
        DATE_TRUNC('week', m.date) as week_start,
        ROUND(AVG(COALESCE(m.actual_calories, m.calories))::numeric, 0) as avg_calories,
        ROUND(AVG(COALESCE(m.actual_protein_g, m.protein_g))::numeric, 1) as avg_protein,
        COUNT(CASE WHEN m.status = 'completed' THEN 1 END)::float /
          COUNT(*)::float as adherence_rate
       FROM meals m
       WHERE m.user_id = $1
       AND m.date >= CURRENT_DATE - INTERVAL '${weeks} weeks'
       GROUP BY week_start
       ORDER BY week_start DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      weekStart: row.week_start,
      avgCalories: parseInt(row.avg_calories) || 0,
      avgProtein: parseFloat(row.avg_protein) || 0,
      adherenceRate: parseFloat(row.adherence_rate.toString()) || 0
    }));
  }
};

export default analyticsService;
