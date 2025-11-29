/**
 * Winston Logger Configuration
 * Structured logging for the API service
 */

import winston from 'winston';
import { Request, Response } from 'express';

// =============================================================================
// Type Definitions
// =============================================================================

interface RequestLogData {
  method: string;
  url: string;
  statusCode: number;
  responseTime: string;
  userAgent?: string;
  ip?: string;
  userId: string;
}

interface ErrorLogData {
  error: string;
  stack?: string;
  code?: string | number;
  method?: string;
  url?: string;
  userId?: string;
}

interface QueryLogData {
  query: string;
  duration: string;
  success: boolean;
}

interface ExternalCallLogData {
  service: string;
  endpoint: string;
  duration: string;
  success: boolean;
}

interface AuthLogData {
  event: string;
  userId: string;
  success: boolean;
  [key: string]: any;
}

interface EventLogData {
  eventType: string;
  [key: string]: any;
}

// Extended logger interface with custom methods
export interface ExtendedLogger extends winston.Logger {
  logRequest(req: Request, res: Response, responseTime: number): void;
  logError(error: Error & { code?: string | number; statusCode?: number }, req?: Request | null): void;
  logQuery(query: string, duration: number, success?: boolean): void;
  logExternalCall(service: string, endpoint: string, duration: number, success?: boolean): void;
  logAuth(event: string, userId: string, success?: boolean, details?: Record<string, any>): void;
  logEvent(eventType: string, data?: Record<string, any>): void;
}

// =============================================================================
// Winston Logger Setup
// =============================================================================

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
}) as ExtendedLogger;

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
logger.logRequest = (req: Request, res: Response, responseTime: number): void => {
  const logData: RequestLogData = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('user-agent'),
    ip: req.ip || (req.connection as any)?.remoteAddress,
    userId: (req as any).user?.id || 'anonymous'
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
logger.logError = (
  error: Error & { code?: string | number; statusCode?: number },
  req: Request | null = null
): void => {
  const logData: ErrorLogData = {
    error: error.message,
    stack: error.stack,
    code: error.code || error.statusCode
  };

  if (req) {
    logData.method = req.method;
    logData.url = req.originalUrl;
    logData.userId = (req as any).user?.id || 'anonymous';
  }

  logger.error('Application error', logData);
};

/**
 * Log database query
 */
logger.logQuery = (query: string, duration: number, success: boolean = true): void => {
  const logData: QueryLogData = {
    query: query.substring(0, 200), // Truncate long queries
    duration: `${duration}ms`,
    success
  };

  logger.debug('Database query', logData);
};

/**
 * Log external API call
 */
logger.logExternalCall = (
  service: string,
  endpoint: string,
  duration: number,
  success: boolean = true
): void => {
  const logData: ExternalCallLogData = {
    service,
    endpoint,
    duration: `${duration}ms`,
    success
  };

  logger.info('External API call', logData);
};

/**
 * Log authentication event
 */
logger.logAuth = (
  event: string,
  userId: string,
  success: boolean = true,
  details: Record<string, any> = {}
): void => {
  const logData: AuthLogData = {
    event,
    userId,
    success,
    ...details
  };

  logger.info('Authentication event', logData);
};

/**
 * Log business event
 */
logger.logEvent = (eventType: string, data: Record<string, any> = {}): void => {
  const logData: EventLogData = {
    eventType,
    ...data
  };

  logger.info('Business event', logData);
};

export default logger;
