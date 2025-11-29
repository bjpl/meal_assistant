/**
 * Sentry Error Tracking Configuration
 * Initializes Sentry for error monitoring and performance tracking
 */

import * as Sentry from '@sentry/node';
import { Express, Request, Response, NextFunction, ErrorRequestHandler } from 'express';

// =============================================================================
// Type Definitions
// =============================================================================

interface SentryContext {
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

type SentryLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize Sentry error tracking
 * Call this early in your application startup
 */
export function initSentry(app?: Express): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '1.0.0',

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session tracking
    autoSessionTracking: true,

    // Integrations
    integrations: [
      // HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // Express middleware tracing
      ...(app ? [new Sentry.Integrations.Express({ app })] : []),
    ],

    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request && event.request.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      'Request aborted',
      'Network request failed',
      'ResizeObserver loop',
    ],
  });

  console.log('Sentry error tracking initialized');
}

// =============================================================================
// Middleware Functions
// =============================================================================

/**
 * Sentry request handler middleware
 * Add this before your routes
 */
export function sentryRequestHandler(): (req: Request, res: Response, next: NextFunction) => void {
  return Sentry.Handlers.requestHandler({
    // Include user info in error reports
    user: ['id', 'email'],
    // Include IP address
    ip: true,
  });
}

/**
 * Sentry tracing handler middleware
 * Add this before your routes
 */
export function sentryTracingHandler(): (req: Request, res: Response, next: NextFunction) => void {
  return Sentry.Handlers.tracingHandler();
}

/**
 * Sentry error handler middleware
 * Add this after your routes, before other error handlers
 */
export function sentryErrorHandler(): ErrorRequestHandler {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Report all 4xx and 5xx errors
      const statusCode = (error as any).status || (error as any).statusCode || 500;
      return statusCode >= 400;
    },
  });
}

// =============================================================================
// Manual Error Capture
// =============================================================================

/**
 * Capture exception manually
 */
export function captureException(error: Error, context: SentryContext = {}): void {
  Sentry.withScope((scope) => {
    if (context.user) {
      scope.setUser(context.user);
    }
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture message manually
 */
export function captureMessage(
  message: string,
  level: SentryLevel = 'info',
  context: SentryContext = {}
): void {
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    Sentry.captureMessage(message);
  });
}

// =============================================================================
// User Context Management
// =============================================================================

/**
 * Set user context for error reporting
 */
export function setUser(user: {
  id?: string;
  email?: string;
  username?: string;
  [key: string]: any;
}): void {
  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

// Export the Sentry instance for advanced usage
export { Sentry };
