/**
 * Prep Session Database Service
 * Handles all meal prep session-related database operations
 */

import { query, transaction } from '../connection';
import { QueryResult } from 'pg';

type PoolClient = any;

interface PrepSession {
  id: string;
  user_id: string;
  date: Date;
  status: string;
  total_duration_minutes: number | null;
  equipment_used: any;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PrepTask {
  id: string;
  session_id: string;
  task_name: string;
  task_type: string;
  status: string;
  duration_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
  actual_start_time: Date | null;
  actual_end_time: Date | null;
  dependencies: any;
  equipment_required: any;
  notes: string | null;
}

interface PrepSessionInput {
  id: string;
  userId: string;
  date: Date;
  status?: string;
  totalDuration?: number;
  equipmentUsed?: any[];
  notes?: string;
  tasks?: PrepTaskInput[];
}

interface PrepTaskInput {
  id: string;
  name: string;
  type?: string;
  status?: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
  dependencies?: any[];
  equipment?: any[];
  notes?: string;
}

interface PrepSessionFilterOptions {
  date?: string;
  status?: string;
}

const prepService = {
  /**
   * Create prep session
   * @param session - Session data
   * @returns Created session
   */
  async create(session: PrepSessionInput): Promise<any> {
    return transaction(async (client: PoolClient) => {
      // Create session
      const sessionResult: QueryResult<PrepSession> = await client.query(
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
   * @param id - Session UUID
   * @param client - Optional transaction client
   * @returns Session with tasks
   */
  async findById(id: string, client: PoolClient | null = null): Promise<any | null> {
    const executeQuery = client ? client.query.bind(client) : query;

    const sessionResult: QueryResult<PrepSession> = await executeQuery(
      'SELECT * FROM prep_sessions WHERE id = $1',
      [id]
    );

    if (sessionResult.rows.length === 0) return null;

    const tasksResult: QueryResult<PrepTask> = await executeQuery(
      'SELECT * FROM prep_tasks WHERE session_id = $1 ORDER BY start_time',
      [id]
    );

    return this._formatSession(sessionResult.rows[0], tasksResult.rows);
  },

  /**
   * Find sessions by user
   * @param userId - User UUID
   * @param options - Filter options
   * @returns Sessions
   */
  async findByUser(userId: string, options: PrepSessionFilterOptions = {}): Promise<any[]> {
    let whereClause = 'WHERE ps.user_id = $1';
    const params: any[] = [userId];
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

    const result: QueryResult = await query(
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
   * @param id - Session UUID
   * @param updates - Fields to update
   * @returns Updated session
   */
  async update(id: string, updates: Record<string, any>): Promise<any | null> {
    const allowedFields = [
      'status', 'total_duration_minutes', 'equipment_used', 'notes'
    ];

    const setClauses: string[] = [];
    const values: any[] = [];
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
   * @param sessionId - Session UUID
   * @param taskId - Task UUID
   * @param updates - Fields to update
   * @returns Updated task
   */
  async updateTask(sessionId: string, taskId: string, updates: Record<string, any>): Promise<any> {
    const allowedFields = [
      'task_name', 'status', 'duration_minutes', 'start_time', 'end_time',
      'actual_start_time', 'actual_end_time', 'notes'
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
      return this.findById(sessionId);
    }

    values.push(taskId);

    const result: QueryResult<PrepTask> = await query(
      `UPDATE prep_tasks SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return this._formatTask(result.rows[0]);
  },

  /**
   * Delete session
   * @param id - Session UUID
   * @returns Success status
   */
  async delete(id: string): Promise<boolean> {
    return transaction(async (client: PoolClient) => {
      // Delete tasks first
      await client.query('DELETE FROM prep_tasks WHERE session_id = $1', [id]);

      // Delete session
      const result: QueryResult = await client.query('DELETE FROM prep_sessions WHERE id = $1', [id]);

      return result.rowCount !== null && result.rowCount > 0;
    });
  },

  /**
   * Format session for API response
   * @private
   */
  _formatSession(sessionRow: any, taskRows: any[]): any {
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
  _formatTask(row: PrepTask | null): any {
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

export default prepService;
