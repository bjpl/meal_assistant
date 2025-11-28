/**
 * Winston Logger Configuration
 * Structured logging for the API service
 */

const winston = require('winston');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define log format for console (development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'meal-assistant-api',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: []
});

// Console transport (always enabled in development, optional in production)
if (process.env.NODE_ENV !== 'production' || process.env.LOG_TO_CONSOLE === 'true') {
  logger.add(new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat
  }));
}

// File transport for production
if (process.env.NODE_ENV === 'production') {
  // Error log
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true
  }));

  // Combined log
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true
  }));
}

// =============================================================================
// Helper Methods
// =============================================================================

/**
 * Log HTTP request
 */
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('user-agent'),
    ip: req.ip || req.connection?.remoteAddress,
    userId: req.user?.id || 'anonymous'
  };

  if (res.statusCode >= 500) {
    logger.error('Request failed', logData);
  } else if (res.statusCode >= 400) {
    logger.warn('Request error', logData);
  } else {
    logger.info('Request completed', logData);
  }
};

/**
 * Log API error
 */
logger.logError = (error, req = null) => {
  const logData = {
    error: error.message,
    stack: error.stack,
    code: error.code || error.statusCode
  };

  if (req) {
    logData.method = req.method;
    logData.url = req.originalUrl;
    logData.userId = req.user?.id || 'anonymous';
  }

  logger.error('Application error', logData);
};

/**
 * Log database query
 */
logger.logQuery = (query, duration, success = true) => {
  logger.debug('Database query', {
    query: query.substring(0, 200), // Truncate long queries
    duration: `${duration}ms`,
    success
  });
};

/**
 * Log external API call
 */
logger.logExternalCall = (service, endpoint, duration, success = true) => {
  logger.info('External API call', {
    service,
    endpoint,
    duration: `${duration}ms`,
    success
  });
};

/**
 * Log authentication event
 */
logger.logAuth = (event, userId, success = true, details = {}) => {
  logger.info('Authentication event', {
    event,
    userId,
    success,
    ...details
  });
};

/**
 * Log business event
 */
logger.logEvent = (eventType, data = {}) => {
  logger.info('Business event', {
    eventType,
    ...data
  });
};

module.exports = logger;
