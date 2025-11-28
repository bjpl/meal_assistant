/**
 * Health Check Routes
 * Endpoints for monitoring and health checks
 */

const express = require('express');
const router = express.Router();

// In-memory metrics (would be replaced with actual metrics in production)
const startTime = Date.now();
let requestCount = 0;

/**
 * @route GET /health
 * @desc Basic health check endpoint
 * @access Public
 */
router.get('/', (req, res) => {
  requestCount++;
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000)
  });
});

/**
 * @route GET /health/ready
 * @desc Readiness probe - checks if app can serve traffic
 * @access Public
 */
router.get('/ready', async (req, res) => {
  requestCount++;
  try {
    // Check database connection
    const dbHealthy = await checkDatabaseConnection();

    // Check Redis connection
    const redisHealthy = await checkRedisConnection();

    // Check ML service
    const mlHealthy = await checkMLService();

    const isReady = dbHealthy && redisHealthy;

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        redis: redisHealthy ? 'healthy' : 'unhealthy',
        ml_service: mlHealthy ? 'healthy' : 'degraded'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @route GET /health/live
 * @desc Liveness probe - checks if app is running
 * @access Public
 */
router.get('/live', (req, res) => {
  requestCount++;
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route GET /health/metrics
 * @desc Prometheus-compatible metrics endpoint
 * @access Public (should be restricted in production)
 */
router.get('/metrics', async (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const memoryUsage = process.memoryUsage();

  const metrics = `
# HELP meal_assistant_uptime_seconds Time since application started
# TYPE meal_assistant_uptime_seconds gauge
meal_assistant_uptime_seconds ${uptime}

# HELP meal_assistant_request_total Total number of health check requests
# TYPE meal_assistant_request_total counter
meal_assistant_request_total ${requestCount}

# HELP meal_assistant_memory_heap_used_bytes Memory heap used in bytes
# TYPE meal_assistant_memory_heap_used_bytes gauge
meal_assistant_memory_heap_used_bytes ${memoryUsage.heapUsed}

# HELP meal_assistant_memory_heap_total_bytes Memory heap total in bytes
# TYPE meal_assistant_memory_heap_total_bytes gauge
meal_assistant_memory_heap_total_bytes ${memoryUsage.heapTotal}

# HELP meal_assistant_memory_rss_bytes Resident set size in bytes
# TYPE meal_assistant_memory_rss_bytes gauge
meal_assistant_memory_rss_bytes ${memoryUsage.rss}

# HELP meal_assistant_memory_external_bytes External memory in bytes
# TYPE meal_assistant_memory_external_bytes gauge
meal_assistant_memory_external_bytes ${memoryUsage.external}

# HELP nodejs_version_info Node.js version
# TYPE nodejs_version_info gauge
nodejs_version_info{version="${process.version}"} 1
`.trim();

  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(metrics);
});

/**
 * @route GET /health/info
 * @desc Application info endpoint
 * @access Public
 */
router.get('/info', (req, res) => {
  requestCount++;
  const packageJson = require('../../../package.json');

  res.json({
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// Health Check Helper Functions
// =============================================================================

async function checkDatabaseConnection() {
  try {
    // In production, this would check actual database connection
    // Example: await db.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return false;
  }
}

async function checkRedisConnection() {
  try {
    // In production, this would check actual Redis connection
    // Example: await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error.message);
    return false;
  }
}

async function checkMLService() {
  try {
    // In production, this would check ML service availability
    // Example: await fetch(process.env.ML_SERVICE_URL + '/health');
    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    // For now, return true as ML service is optional
    return true;
  } catch (error) {
    console.error('ML service health check failed:', error.message);
    return false;
  }
}

module.exports = router;
