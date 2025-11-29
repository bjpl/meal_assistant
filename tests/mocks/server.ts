import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW Server for Node.js environment (Jest tests)
 *
 * This server intercepts HTTP requests during test execution
 * and returns mock responses based on the handlers defined.
 *
 * Usage in tests:
 *
 * import { server } from 'tests/mocks/server';
 *
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 */
export const server = setupServer(...handlers);

/**
 * Helper function to override handlers for specific tests
 *
 * Example:
 * import { server, overrideHandlers } from 'tests/mocks/server';
 * import { http, HttpResponse } from 'msw';
 *
 * test('handles error response', async () => {
 *   overrideHandlers(
 *     http.get('/api/meals/today', () => {
 *       return HttpResponse.json(
 *         { error: 'Server error' },
 *         { status: 500 }
 *       );
 *     })
 *   );
 *
 *   // Your test code here
 * });
 */
export function overrideHandlers(...newHandlers: Parameters<typeof server.use>) {
  server.use(...newHandlers);
}

/**
 * Helper to add temporary request handlers
 * Automatically resets after the current test
 */
export function useHandlers(...newHandlers: Parameters<typeof server.use>) {
  server.use(...newHandlers);
}

/**
 * Helper to reset handlers to initial state
 */
export function resetHandlers() {
  server.resetHandlers();
}

/**
 * Helper to completely reset the server
 * (clears all runtime handlers and restores initial ones)
 */
export function restoreHandlers() {
  server.restoreHandlers();
}
