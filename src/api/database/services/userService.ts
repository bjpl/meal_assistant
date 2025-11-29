/**
 * User Database Service
 * Handles all user-related database operations
 */

import { query } from '../connection';
import { QueryResult } from 'pg';
import { hashPassword, comparePassword } from '../../middleware/auth';

interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  daily_calorie_target: number;
  daily_protein_target_g: number;
  preferred_units: string;
  timezone: string;
  is_active: boolean;
  is_email_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface UserProfile {
  name?: string;
  weight?: number;
  targetWeight?: number;
  targetCalories?: number;
  targetProtein?: number;
  units?: string;
  timezone?: string;
}

interface DietaryRestriction {
  id: string;
  restriction_type: string;
  name: string;
  severity: string;
  notes: string | null;
  created_at: Date;
}

interface DietaryRestrictionInput {
  type: string;
  name: string;
  severity: string;
  notes?: string;
}

interface FormattedUser {
  id: string;
  email: string;
  profile: {
    name: string | null;
    weight: number | null;
    targetWeight: number | null;
    targetCalories: number;
    targetProtein: number;
    units: string;
    timezone: string;
  };
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userService = {
  /**
   * Create a new user
   * @param email - User email
   * @param password - Plain text password
   * @param profile - Optional profile data
   * @returns Created user (without password)
   */
  async create(email: string, password: string, profile: UserProfile = {}): Promise<FormattedUser> {
    const passwordHash = await hashPassword(password);

    const result: QueryResult<User> = await query(
      `INSERT INTO users (
        email, password_hash, full_name,
        current_weight_kg, target_weight_kg,
        daily_calorie_target, daily_protein_target_g,
        preferred_units, timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, email, full_name, current_weight_kg, target_weight_kg,
                daily_calorie_target, daily_protein_target_g, preferred_units,
                timezone, created_at, updated_at`,
      [
        email,
        passwordHash,
        profile.name || null,
        profile.weight ? profile.weight * 0.453592 : null, // Convert lbs to kg if provided
        profile.targetWeight ? profile.targetWeight * 0.453592 : null,
        profile.targetCalories || 1800,
        profile.targetProtein || 135,
        profile.units || 'imperial',
        profile.timezone || 'America/New_York'
      ]
    );

    return this._formatUser(result.rows[0]);
  },

  /**
   * Find user by email
   * @param email - User email
   * @returns User object with password hash
   */
  async findByEmail(email: string): Promise<User | null> {
    const result: QueryResult<User> = await query(
      `SELECT id, email, password_hash, full_name, current_weight_kg,
              target_weight_kg, daily_calorie_target, daily_protein_target_g,
              preferred_units, timezone, is_active, is_email_verified,
              last_login_at, created_at, updated_at
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
  },

  /**
   * Find user by ID
   * @param id - User UUID
   * @returns User object (without password)
   */
  async findById(id: string): Promise<FormattedUser | null> {
    const result: QueryResult<User> = await query(
      `SELECT id, email, full_name, current_weight_kg, target_weight_kg,
              daily_calorie_target, daily_protein_target_g, preferred_units,
              timezone, is_active, is_email_verified, last_login_at,
              created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;
    return this._formatUser(result.rows[0]);
  },

  /**
   * Verify user password
   * @param email - User email
   * @param password - Plain text password
   * @returns User if password matches, null otherwise
   */
  async verifyPassword(email: string, password: string): Promise<FormattedUser | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return null;

    // Update last login
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    return this._formatUser(user);
  },

  /**
   * Update user profile
   * @param id - User UUID
   * @param updates - Fields to update
   * @returns Updated user
   */
  async update(id: string, updates: Partial<Record<string, any>>): Promise<FormattedUser | null> {
    const allowedFields = [
      'full_name', 'current_weight_kg', 'target_weight_kg',
      'daily_calorie_target', 'daily_protein_target_g',
      'preferred_units', 'timezone'
    ];

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result: QueryResult<User> = await query(
      `UPDATE users SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, email, full_name, current_weight_kg, target_weight_kg,
                 daily_calorie_target, daily_protein_target_g, preferred_units,
                 timezone, created_at, updated_at`,
      values
    );

    return this._formatUser(result.rows[0]);
  },

  /**
   * Update user password
   * @param id - User UUID
   * @param newPassword - New plain text password
   * @returns Success status
   */
  async updatePassword(id: string, newPassword: string): Promise<boolean> {
    const passwordHash = await hashPassword(newPassword);

    const result: QueryResult = await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, id]
    );

    return result.rowCount !== null && result.rowCount > 0;
  },

  /**
   * Verify user email
   * @param id - User UUID
   * @returns Success status
   */
  async verifyEmail(id: string): Promise<boolean> {
    const result: QueryResult = await query(
      'UPDATE users SET is_email_verified = TRUE, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return result.rowCount !== null && result.rowCount > 0;
  },

  /**
   * Get user dietary restrictions
   * @param userId - User UUID
   * @returns Dietary restrictions
   */
  async getDietaryRestrictions(userId: string): Promise<DietaryRestriction[]> {
    const result: QueryResult<DietaryRestriction> = await query(
      `SELECT id, restriction_type, name, severity, notes, created_at
       FROM user_dietary_restrictions WHERE user_id = $1`,
      [userId]
    );

    return result.rows;
  },

  /**
   * Add dietary restriction
   * @param userId - User UUID
   * @param restriction - Restriction data
   * @returns Created restriction
   */
  async addDietaryRestriction(userId: string, restriction: DietaryRestrictionInput): Promise<DietaryRestriction> {
    const result: QueryResult<DietaryRestriction> = await query(
      `INSERT INTO user_dietary_restrictions (user_id, restriction_type, name, severity, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, restriction_type, name, severity, notes, created_at`,
      [userId, restriction.type, restriction.name, restriction.severity, restriction.notes]
    );

    return result.rows[0];
  },

  /**
   * Delete user (soft delete - set inactive)
   * @param id - User UUID
   * @returns Success status
   */
  async delete(id: string): Promise<boolean> {
    const result: QueryResult = await query(
      'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return result.rowCount !== null && result.rowCount > 0;
  },

  /**
   * Format user object for API response
   * @private
   */
  _formatUser(row: User | null): FormattedUser {
    if (!row) {
      throw new Error('Cannot format null user');
    }

    return {
      id: row.id,
      email: row.email,
      profile: {
        name: row.full_name,
        weight: row.current_weight_kg ? Math.round(row.current_weight_kg * 2.20462) : null, // Convert to lbs
        targetWeight: row.target_weight_kg ? Math.round(row.target_weight_kg * 2.20462) : null,
        targetCalories: row.daily_calorie_target,
        targetProtein: row.daily_protein_target_g,
        units: row.preferred_units,
        timezone: row.timezone
      },
      isActive: row.is_active,
      isEmailVerified: row.is_email_verified,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};

export default userService;
