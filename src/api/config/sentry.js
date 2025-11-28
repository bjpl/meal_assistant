/**
 * Sentry Error Tracking Configuration
 * Initializes Sentry for error monitoring and performance tracking
 */

const Sentry = require('@sentry/node');

/**
 * Initialize Sentry error tracking
 * Call this early in your application startup
 */
function initSentry(app) {
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

/**
 * Sentry request handler middleware
 * Add this before your routes
 */
function sentryRequestHandler() {
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
function sentryTracingHandler() {
  return Sentry.Handlers.tracingHandler();
}

/**
 * Sentry error handler middleware
 * Add this after your routes, before other error handlers
 */
function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Report all 4xx and 5xx errors
      return error.status >= 400;
    },
  });
}

/**
 * Capture exception manually
 */
function captureException(error, context = {}) {
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
function captureMessage(message, level = 'info', context = {}) {
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

/**
 * Set user context for error reporting
 */
function setUser(user) {
  Sentry.setUser(user);
}

/**
 * Clear user context
 */
function clearUser() {
  Sentry.setUser(null);
}

module.exports = {
  initSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  Sentry,
};
