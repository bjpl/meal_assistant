/**
 * Error Handling Middleware
 * Centralized error handling for the API
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details: any;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, details: any = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not found handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested resource ${req.method} ${req.originalUrl} was not found`,
    timestamp: new Date().toISOString()
  });
}

/**
 * Joi validation error interface
 */
interface JoiError extends Error {
  isJoi: boolean;
  details: Array<{
    path: string[];
    message: string;
  }>;
}

/**
 * Global error handler middleware
 */
export function errorHandler(err: Error | ApiError | JoiError, req: Request, res: Response, _next: NextFunction): void {
  // Log error for debugging (in production, send to logging service)
  if (process.env.NODE_ENV !== 'test') {
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }

  // Handle Joi validation errors
  if ('isJoi' in err && err.isJoi) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'The request data is invalid',
      details: err.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      })),
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle custom API errors
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Invalid Token',
      message: 'The authentication token is invalid',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Token Expired',
      message: 'The authentication token has expired',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle syntax errors in JSON
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    res.status(400).json({
      error: 'Invalid JSON',
      message: 'The request body contains invalid JSON',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Default to 500 internal server error
  const statusCode = 'statusCode' in err ? (err as any).statusCode : 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : err.message;

  res.status(statusCode).json({
    error: 'Internal Server Error',
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
}

/**
 * Async handler wrapper to catch async errors
 */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
