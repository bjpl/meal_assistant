/**
 * User Database Service
 * Handles all user-related database operations
 */

const { query, transaction } = require('../connection');
const { hashPassword, comparePassword } = require('../../middleware/auth');

const userService = {
  /**
   * Create a new user
   * @param {string} email - User email
   * @param {string} password - Plain text password
   * @param {Object} profile - Optional profile data
   * @returns {Promise<Object>} Created user (without password)
   */
  async create(email, password, profile = {}) {
    const passwordHash = await hashPassword(password);

    const result = await query(
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
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object with password hash
   */
  async findByEmail(email) {
    const result = await query(
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
   * @param {string} id - User UUID
   * @returns {Promise<Object|null>} User object (without password)
   */
  async findById(id) {
    const result = await query(
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
   * @param {string} email - User email
   * @param {string} password - Plain text password
   * @returns {Promise<Object|null>} User if password matches, null otherwise
   */
  async verifyPassword(email, password) {
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
   * @param {string} id - User UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user
   */
  async update(id, updates) {
    const allowedFields = [
      'full_name', 'current_weight_kg', 'target_weight_kg',
      'daily_calorie_target', 'daily_protein_target_g',
      'preferred_units', 'timezone'
    ];

    const setClauses = [];
    const values = [];
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

    const result = await query(
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
   * @param {string} id - User UUID
   * @param {string} newPassword - New plain text password
   * @returns {Promise<boolean>} Success status
   */
  async updatePassword(id, newPassword) {
    const passwordHash = await hashPassword(newPassword);

    const result = await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, id]
    );

    return result.rowCount > 0;
  },

  /**
   * Verify user email
   * @param {string} id - User UUID
   * @returns {Promise<boolean>} Success status
   */
  async verifyEmail(id) {
    const result = await query(
      'UPDATE users SET is_email_verified = TRUE, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return result.rowCount > 0;
  },

  /**
   * Get user dietary restrictions
   * @param {string} userId - User UUID
   * @returns {Promise<Array>} Dietary restrictions
   */
  async getDietaryRestrictions(userId) {
    const result = await query(
      `SELECT id, restriction_type, name, severity, notes, created_at
       FROM user_dietary_restrictions WHERE user_id = $1`,
      [userId]
    );

    return result.rows;
  },

  /**
   * Add dietary restriction
   * @param {string} userId - User UUID
   * @param {Object} restriction - Restriction data
   * @returns {Promise<Object>} Created restriction
   */
  async addDietaryRestriction(userId, restriction) {
    const result = await query(
      `INSERT INTO user_dietary_restrictions (user_id, restriction_type, name, severity, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, restriction_type, name, severity, notes, created_at`,
      [userId, restriction.type, restriction.name, restriction.severity, restriction.notes]
    );

    return result.rows[0];
  },

  /**
   * Delete user (soft delete - set inactive)
   * @param {string} id - User UUID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    const result = await query(
      'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return result.rowCount > 0;
  },

  /**
   * Format user object for API response
   * @private
   */
  _formatUser(row) {
    if (!row) return null;

    // Remove password hash and format response
    const { password_hash, ...user } = row;

    return {
      id: user.id,
      email: user.email,
      profile: {
        name: user.full_name,
        weight: user.current_weight_kg ? Math.round(user.current_weight_kg * 2.20462) : null, // Convert to lbs
        targetWeight: user.target_weight_kg ? Math.round(user.target_weight_kg * 2.20462) : null,
        targetCalories: user.daily_calorie_target,
        targetProtein: user.daily_protein_target_g,
        units: user.preferred_units,
        timezone: user.timezone
      },
      isActive: user.is_active,
      isEmailVerified: user.is_email_verified,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  }
};

module.exports = userService;
