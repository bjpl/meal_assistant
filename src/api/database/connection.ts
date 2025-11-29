/**
 * PostgreSQL Database Connection
 * Provides connection pooling and query utilities for the API
 */

import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';

/**
 * Database configuration interface
 */
export interface DatabaseConfig extends PoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  ssl: boolean | { rejectUnauthorized: boolean };
}

// Database configuration from environment variables
const config: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'meal_assistant',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',

  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),

  // SSL configuration for production
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false,
};

// Create connection pool
const pool = new Pool(config);

// Log pool errors
pool.on('error', (err: Error) => {
  console.error('Unexpected database pool error:', err);
});

// Log when client connects (development only)
if (process.env.NODE_ENV === 'development') {
  pool.on('connect', () => {
    console.log('Database client connected');
  });
}

/**
 * Execute a query with parameters
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('Query executed:', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Database query error:', { text: text.substring(0, 100), error: errorMessage });
    throw error;
  }
}

/**
 * Extended pool client interface with release tracking
 */
export interface ExtendedPoolClient extends PoolClient {
  release: (err?: Error | boolean) => void;
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<ExtendedPoolClient> {
  const client = await pool.connect() as ExtendedPoolClient;
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);

  // Track query timeout
  const timeout = setTimeout(() => {
    console.error('Client has been checked out for more than 30 seconds!');
  }, 30000);

  // Wrap release to clear timeout
  client.release = (err?: Error | boolean) => {
    clearTimeout(timeout);
    client.query = originalQuery;
    client.release = originalRelease;
    return originalRelease(err);
  };

  return client;
}

/**
 * Execute a transaction with automatic commit/rollback
 */
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Database health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  timestamp?: Date;
  poolSize?: number;
  idleCount?: number;
  waitingCount?: number;
  error?: string;
}

/**
 * Check database connection health
 */
export async function healthCheck(): Promise<HealthCheckResult> {
  try {
    const result = await query<{ time: Date }>('SELECT NOW() as time');
    return {
      healthy: true,
      timestamp: result.rows[0].time,
      poolSize: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      healthy: false,
      error: errorMessage
    };
  }
}

/**
 * Close all pool connections
 */
export async function close(): Promise<void> {
  await pool.end();
  console.log('Database pool closed');
}

export { pool };
