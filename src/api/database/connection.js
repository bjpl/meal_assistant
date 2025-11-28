/**
 * PostgreSQL Database Connection
 * Provides connection pooling and query utilities for the API
 */

const { Pool } = require('pg');

// Database configuration from environment variables
const config = {
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
pool.on('error', (err) => {
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
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('Query executed:', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }

    return result;
  } catch (error) {
    console.error('Database query error:', { text: text.substring(0, 100), error: error.message });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} Pool client
 */
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);

  // Track query timeout
  const timeout = setTimeout(() => {
    console.error('Client has been checked out for more than 30 seconds!');
  }, 30000);

  // Wrap release to clear timeout
  client.release = () => {
    clearTimeout(timeout);
    client.query = originalQuery;
    client.release = originalRelease;
    return originalRelease();
  };

  return client;
}

/**
 * Execute a transaction with automatic commit/rollback
 * @param {Function} callback - Async function receiving client
 * @returns {Promise<any>} Transaction result
 */
async function transaction(callback) {
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
 * Check database connection health
 * @returns {Promise<boolean>} Connection status
 */
async function healthCheck() {
  try {
    const result = await query('SELECT NOW() as time');
    return {
      healthy: true,
      timestamp: result.rows[0].time,
      poolSize: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
}

/**
 * Close all pool connections
 * @returns {Promise<void>}
 */
async function close() {
  await pool.end();
  console.log('Database pool closed');
}

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  healthCheck,
  close
};
