/**
 * Prep Session Database Service
 * Handles all meal prep session-related database operations
 */

const { query, transaction } = require('../connection');

const prepService = {
  /**
   * Create prep session
   * @param {Object} session - Session data
   * @returns {Promise<Object>} Created session
   */
  async create(session) {
    return transaction(async (client) => {
      // Create session
      const sessionResult = await client.query(
        `INSERT INTO prep_sessions (
          id, user_id, date, status, total_duration_minutes,
          equipment_used, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          session.id,
          session.userId,
          session.date,
          session.status || 'planned',
          session.totalDuration || null,
          JSON.stringify(session.equipmentUsed || []),
          session.notes || null
        ]
      );

      const createdSession = sessionResult.rows[0];

      // Create tasks if provided
      if (session.tasks && session.tasks.length > 0) {
        for (const task of session.tasks) {
          await client.query(
            `INSERT INTO prep_tasks (
              id, session_id, task_name, task_type, status,
              duration_minutes, start_time, end_time,
              dependencies, equipment_required, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              task.id,
              createdSession.id,
              task.name,
              task.type || 'prep',
              task.status || 'pending',
              task.duration || null,
              task.startTime || null,
              task.endTime || null,
              JSON.stringify(task.dependencies || []),
              JSON.stringify(task.equipment || []),
              task.notes || null
            ]
          );
        }
      }

      return this.findById(createdSession.id, client);
    });
  },

  /**
   * Find session by ID
   * @param {string} id - Session UUID
   * @param {Object} client - Optional transaction client
   * @returns {Promise<Object|null>} Session with tasks
   */
  async findById(id, client = null) {
    const db = client || { query };

    const sessionResult = await db.query(
      'SELECT * FROM prep_sessions WHERE id = $1',
      [id]
    );

    if (sessionResult.rows.length === 0) return null;

    const tasksResult = await db.query(
      'SELECT * FROM prep_tasks WHERE session_id = $1 ORDER BY start_time',
      [id]
    );

    return this._formatSession(sessionResult.rows[0], tasksResult.rows);
  },

  /**
   * Find sessions by user
   * @param {string} userId - User UUID
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Sessions
   */
  async findByUser(userId, options = {}) {
    let whereClause = 'WHERE ps.user_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (options.date) {
      whereClause += ` AND ps.date = $${paramIndex}`;
      params.push(options.date);
      paramIndex++;
    }

    if (options.status) {
      whereClause += ` AND ps.status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    const result = await query(
      `SELECT ps.*,
              (SELECT json_agg(pt.* ORDER BY pt.start_time)
               FROM prep_tasks pt WHERE pt.session_id = ps.id) as tasks
       FROM prep_sessions ps
       ${whereClause}
       ORDER BY ps.date DESC`,
      params
    );

    return result.rows.map(row => this._formatSession(row, row.tasks || []));
  },

  /**
   * Update session
   * @param {string} id - Session UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated session
   */
  async update(id, updates) {
    const allowedFields = [
      'status', 'total_duration_minutes', 'equipment_used', 'notes'
    ];

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

      if (allowedFields.includes(dbKey)) {
        // Handle JSON fields
        if (dbKey === 'equipment_used' && typeof value === 'object') {
          setClauses.push(`${dbKey} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          setClauses.push(`${dbKey} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await query(
      `UPDATE prep_sessions SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}`,
      values
    );

    return this.findById(id);
  },

  /**
   * Update task
   * @param {string} sessionId - Session UUID
   * @param {string} taskId - Task UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated task
   */
  async updateTask(sessionId, taskId, updates) {
    const allowedFields = [
      'task_name', 'status', 'duration_minutes', 'start_time', 'end_time',
      'actual_start_time', 'actual_end_time', 'notes'
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
      return this.findById(sessionId);
    }

    values.push(taskId);

    const result = await query(
      `UPDATE prep_tasks SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return this._formatTask(result.rows[0]);
  },

  /**
   * Delete session
   * @param {string} id - Session UUID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    return transaction(async (client) => {
      // Delete tasks first
      await client.query('DELETE FROM prep_tasks WHERE session_id = $1', [id]);

      // Delete session
      const result = await client.query('DELETE FROM prep_sessions WHERE id = $1', [id]);

      return result.rowCount > 0;
    });
  },

  /**
   * Format session for API response
   * @private
   */
  _formatSession(sessionRow, taskRows) {
    if (!sessionRow) return null;

    return {
      id: sessionRow.id,
      userId: sessionRow.user_id,
      date: sessionRow.date,
      status: sessionRow.status,
      totalDuration: sessionRow.total_duration_minutes,
      equipmentUsed: sessionRow.equipment_used || [],
      notes: sessionRow.notes,
      tasks: taskRows.map(this._formatTask),
      createdAt: sessionRow.created_at,
      updatedAt: sessionRow.updated_at
    };
  },

  /**
   * Format task for API response
   * @private
   */
  _formatTask(row) {
    if (!row) return null;

    return {
      id: row.id,
      sessionId: row.session_id,
      name: row.task_name,
      type: row.task_type,
      status: row.status,
      duration: row.duration_minutes,
      startTime: row.start_time,
      endTime: row.end_time,
      actualStartTime: row.actual_start_time,
      actualEndTime: row.actual_end_time,
      dependencies: row.dependencies || [],
      equipment: row.equipment_required || [],
      notes: row.notes
    };
  }
};

module.exports = prepService;
