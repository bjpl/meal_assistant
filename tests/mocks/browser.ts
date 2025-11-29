import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * MSW Browser Worker for React Native testing and development
 *
 * This worker intercepts HTTP requests in the browser/React Native environment
 * and returns mock responses based on the handlers defined.
 *
 * Note: For React Native, MSW browser mode can be used with react-native-url-polyfill
 * or similar polyfills to enable service worker-like behavior.
 *
 * Usage in development or Storybook:
 *
 * import { worker } from 'tests/mocks/browser';
 *
 * if (__DEV__) {
 *   worker.start({
 *     onUnhandledRequest: 'warn',
 *   });
 * }
 */
export const worker = setupWorker(...handlers);

/**
 * Start the MSW worker with default options
 *
 * Options:
 * - onUnhandledRequest: 'warn' | 'error' | 'bypass'
 *   Controls what happens when a request doesn't match any handler
 *
 * - quiet: boolean
 *   Suppress console output from MSW
 */
export async function startMocking(options?: {
  onUnhandledRequest?: 'warn' | 'error' | 'bypass';
  quiet?: boolean;
}) {
  return worker.start({
    onUnhandledRequest: options?.onUnhandledRequest || 'warn',
    quiet: options?.quiet || false,
  });
}

/**
 * Stop the MSW worker
 */
export async function stopMocking() {
  return worker.stop();
}

/**
 * Helper to add temporary request handlers in browser environment
 */
export function useHandlers(...newHandlers: Parameters<typeof worker.use>) {
  worker.use(...newHandlers);
}

/**
 * Helper to reset handlers to initial state in browser environment
 */
export function resetHandlers() {
  worker.resetHandlers();
}

/**
 * Helper to completely reset the worker
 * (clears all runtime handlers and restores initial ones)
 */
export function restoreHandlers() {
  worker.restoreHandlers();
}

/**
 * Example integration with React Native:
 *
 * // In your app entry point (e.g., App.tsx or index.js):
 *
 * import { startMocking } from './tests/mocks/browser';
 *
 * // Enable mocking in development mode
 * if (__DEV__ && process.env.ENABLE_MSW === 'true') {
 *   startMocking({
 *     onUnhandledRequest: 'warn',
 *     quiet: false,
 *   }).then(() => {
 *     console.log('MSW mocking enabled');
 *   });
 * }
 *
 * // Your app component
 * export default function App() {
 *   // ...
 * }
 */
