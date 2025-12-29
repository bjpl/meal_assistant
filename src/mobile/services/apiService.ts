/**
 * API Service for Mobile App
 * Handles all HTTP communication with the backend API
 * Features: retry logic, caching, request deduplication, offline queue
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
const API_TIMEOUT = parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || '30000', 10);
const MAX_RETRIES = parseInt(process.env.EXPO_PUBLIC_MAX_RETRIES || '3', 10);
const CACHE_TTL = parseInt(process.env.EXPO_PUBLIC_CACHE_TTL || '300000', 10); // 5 minutes

const STORAGE_KEYS = {
  ACCESS_TOKEN: '@meal_assistant:access_token',
  REFRESH_TOKEN: '@meal_assistant:refresh_token',
  USER: '@meal_assistant:user',
  OFFLINE_QUEUE: '@meal_assistant:offline_queue',
  REQUEST_CACHE: '@meal_assistant:request_cache',
};

// Types
interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  tokenType: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  fromCache?: boolean;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipRefresh?: boolean;
  skipCache?: boolean;
  skipRetry?: boolean;
  retryCount?: number;
  cacheKey?: string;
  cacheTTL?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface OfflineQueueItem {
  id: string;
  endpoint: string;
  options: RequestOptions;
  timestamp: number;
  retryCount: number;
}

// In-memory request deduplication
const pendingRequests = new Map<string, Promise<ApiResponse<any>>>();

// In-memory cache
const memoryCache = new Map<string, CacheEntry<any>>();

// Offline queue
let offlineQueue: OfflineQueueItem[] = [];
let isOnline = true;

// Logger for debugging
const logger = {
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${message}`, data || '');
    }
  },
  error: (message: string, error?: any) => {
    console.error(`[API Error] ${message}`, error || '');
  },
};

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

/**
 * Process failed request queue after token refresh
 */
const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Initialize tokens from storage on app start
 */
export async function initializeAuth(): Promise<boolean> {
  try {
    const [storedAccessToken, storedRefreshToken] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
      AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
    ]);

    accessToken = storedAccessToken;
    refreshToken = storedRefreshToken;

    return !!accessToken;
  } catch (error) {
    console.error('Failed to initialize auth:', error);
    return false;
  }
}

/**
 * Store tokens after login/registration
 */
async function storeTokens(tokens: TokenResponse): Promise<void> {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;

  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken),
    AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken),
  ]);
}

/**
 * Clear tokens on logout
 */
async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;

  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
    AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
    AsyncStorage.removeItem(STORAGE_KEYS.USER),
  ]);
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<string> {
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    // Refresh token is invalid, clear everything
    await clearTokens();
    throw new Error('Session expired. Please login again.');
  }

  const data = await response.json();
  await storeTokens(data);

  return data.accessToken;
}

// =============================================================================
// CACHING UTILITIES
// =============================================================================

/**
 * Generate a cache key from endpoint and options
 */
function generateCacheKey(endpoint: string, options?: RequestOptions): string {
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.stringify(options.body) : '';
  return `${method}:${endpoint}:${body}`;
}

/**
 * Get cached response if valid
 */
function getCachedResponse<T>(cacheKey: string): T | null {
  const entry = memoryCache.get(cacheKey);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    memoryCache.delete(cacheKey);
    return null;
  }

  logger.debug(`Cache hit: ${cacheKey}`);
  return entry.data;
}

/**
 * Cache a response
 */
function cacheResponse<T>(cacheKey: string, data: T, ttl: number = CACHE_TTL): void {
  memoryCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl,
  });
  logger.debug(`Cached response: ${cacheKey}`);
}

/**
 * Clear all cached responses
 */
export function clearCache(): void {
  memoryCache.clear();
  logger.debug('Cache cleared');
}

/**
 * Clear cache for specific endpoint pattern
 */
export function invalidateCache(pattern: string): void {
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }
  logger.debug(`Invalidated cache for pattern: ${pattern}`);
}

// =============================================================================
// OFFLINE QUEUE MANAGEMENT
// =============================================================================

/**
 * Load offline queue from storage
 */
async function loadOfflineQueue(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    if (stored) {
      offlineQueue = JSON.parse(stored);
      logger.debug(`Loaded ${offlineQueue.length} queued requests`);
    }
  } catch (error) {
    logger.error('Failed to load offline queue', error);
  }
}

/**
 * Save offline queue to storage
 */
async function saveOfflineQueue(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(offlineQueue));
  } catch (error) {
    logger.error('Failed to save offline queue', error);
  }
}

/**
 * Add request to offline queue
 */
async function queueOfflineRequest(endpoint: string, options: RequestOptions): Promise<void> {
  const item: OfflineQueueItem = {
    id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    endpoint,
    options: { ...options, body: options.body },
    timestamp: Date.now(),
    retryCount: 0,
  };

  offlineQueue.push(item);
  await saveOfflineQueue();
  logger.debug(`Queued offline request: ${endpoint}`);
}

/**
 * Process offline queue when back online
 */
export async function processOfflineQueue(): Promise<{ success: number; failed: number }> {
  if (offlineQueue.length === 0) {
    return { success: 0, failed: 0 };
  }

  logger.debug(`Processing ${offlineQueue.length} queued requests`);
  let success = 0;
  let failed = 0;
  const remainingQueue: OfflineQueueItem[] = [];

  for (const item of offlineQueue) {
    try {
      await request(item.endpoint, { ...item.options, skipRetry: true });
      success++;
    } catch (error) {
      item.retryCount++;
      if (item.retryCount < MAX_RETRIES) {
        remainingQueue.push(item);
      } else {
        failed++;
        logger.error(`Failed to process queued request after ${MAX_RETRIES} attempts: ${item.endpoint}`);
      }
    }
  }

  offlineQueue = remainingQueue;
  await saveOfflineQueue();

  return { success, failed };
}

/**
 * Set online status and process queue if back online
 */
export async function setOnlineStatus(online: boolean): Promise<void> {
  const wasOffline = !isOnline;
  isOnline = online;

  if (online && wasOffline) {
    logger.debug('Back online, processing offline queue');
    await processOfflineQueue();
  }
}

/**
 * Get offline queue status
 */
export function getOfflineQueueStatus(): { count: number; items: OfflineQueueItem[] } {
  return { count: offlineQueue.length, items: [...offlineQueue] };
}

// =============================================================================
// RETRY LOGIC
// =============================================================================

/**
 * Delay helper for retry backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}

/**
 * Check if error is retryable
 */
function isRetryableError(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

// =============================================================================
// REQUEST WITH TIMEOUT
// =============================================================================

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = API_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Make authenticated API request with automatic token refresh, retry, and caching
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    skipAuth = false,
    skipRefresh = false,
    skipCache = false,
    skipRetry = false,
    retryCount = 0,
    cacheKey: customCacheKey,
    cacheTTL = CACHE_TTL,
    ...fetchOptions
  } = options;

  const method = fetchOptions.method || 'GET';
  const isReadRequest = method === 'GET';
  const cacheKey = customCacheKey || generateCacheKey(endpoint, options);

  // Request deduplication for GET requests
  if (isReadRequest && pendingRequests.has(cacheKey)) {
    logger.debug(`Deduplicating request: ${cacheKey}`);
    return pendingRequests.get(cacheKey)!;
  }

  // Check cache for GET requests
  if (isReadRequest && !skipCache) {
    const cached = getCachedResponse<T>(cacheKey);
    if (cached) {
      return { data: cached, fromCache: true };
    }
  }

  // Check if offline - queue write requests
  if (!isOnline && !isReadRequest) {
    await queueOfflineRequest(endpoint, options);
    return {
      error: 'Offline',
      code: 'OFFLINE_QUEUED',
      message: 'Request queued for when you are back online.',
    };
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  // Add authorization header if authenticated
  if (!skipAuth && accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  // Create the request promise
  const requestPromise = (async (): Promise<ApiResponse<T>> => {
    try {
      logger.debug(`Request: ${method} ${endpoint}`);
      const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
      });

      // Handle token expiration
      if (response.status === 401 && !skipRefresh && refreshToken) {
        const errorData = await response.json();

        if (errorData.code === 'TOKEN_EXPIRED') {
          // Token expired, try to refresh
          if (isRefreshing) {
            // Wait for the ongoing refresh
            return new Promise((resolve, reject) => {
              failedQueue.push({
                resolve: async (newToken) => {
                  (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
                  const retryResponse = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
                    ...fetchOptions,
                    headers,
                  });
                  resolve({ data: await retryResponse.json() });
                },
                reject: (error) => reject(error),
              });
            });
          }

          isRefreshing = true;

          try {
            const newToken = await refreshAccessToken();
            processQueue(null, newToken);

            // Retry original request with new token
            (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
            const retryResponse = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
              ...fetchOptions,
              headers,
            });

            const data = await retryResponse.json();

            // Cache successful GET responses
            if (isReadRequest && retryResponse.ok && !skipCache) {
              cacheResponse(cacheKey, data, cacheTTL);
            }

            return { data };
          } catch (refreshError) {
            processQueue(refreshError as Error, null);
            return {
              error: 'Session expired',
              code: 'SESSION_EXPIRED',
              message: 'Please login again.',
            };
          } finally {
            isRefreshing = false;
          }
        }

        return {
          error: errorData.error,
          code: errorData.code,
          message: errorData.message,
        };
      }

      // Handle retryable errors
      if (!skipRetry && isRetryableError(response.status) && retryCount < MAX_RETRIES) {
        const delayMs = getRetryDelay(retryCount);
        logger.debug(`Retrying request (${retryCount + 1}/${MAX_RETRIES}) after ${delayMs}ms`);
        await delay(delayMs);
        return request<T>(endpoint, { ...options, retryCount: retryCount + 1 });
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.error || 'Request failed',
          code: data.code,
          message: data.message,
        };
      }

      // Cache successful GET responses
      if (isReadRequest && !skipCache) {
        cacheResponse(cacheKey, data, cacheTTL);
      }

      // Invalidate cache on successful mutations
      if (!isReadRequest) {
        const resourcePath = endpoint.split('/').slice(0, 3).join('/');
        invalidateCache(resourcePath);
      }

      logger.debug(`Response: ${method} ${endpoint} - OK`);
      return { data };
    } catch (error: any) {
      // Handle abort/timeout
      if (error.name === 'AbortError') {
        logger.error(`Request timeout: ${endpoint}`);

        // Retry on timeout
        if (!skipRetry && retryCount < MAX_RETRIES) {
          const delayMs = getRetryDelay(retryCount);
          await delay(delayMs);
          return request<T>(endpoint, { ...options, retryCount: retryCount + 1 });
        }

        return {
          error: 'Request timeout',
          code: 'TIMEOUT',
          message: 'The request took too long. Please try again.',
        };
      }

      // Handle network errors - queue write requests for offline
      if (!isReadRequest && !isOnline) {
        await queueOfflineRequest(endpoint, options);
        return {
          error: 'Offline',
          code: 'OFFLINE_QUEUED',
          message: 'Request queued for when you are back online.',
        };
      }

      logger.error(`API request failed: ${endpoint}`, error);
      return {
        error: 'Network error',
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to server. Please check your connection.',
      };
    }
  })();

  // Store pending request for deduplication
  if (isReadRequest) {
    pendingRequests.set(cacheKey, requestPromise);
    requestPromise.finally(() => {
      pendingRequests.delete(cacheKey);
    });
  }

  return requestPromise;
}

// =============================================================================
// AUTH API
// =============================================================================

export const authApi = {
  async register(email: string, password: string, profile?: { name?: string }) {
    const response = await request<{ user: any } & TokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...profile }),
      skipAuth: true,
    });

    if (response.data) {
      await storeTokens(response.data);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data.user));
    }

    return response;
  },

  async login(email: string, password: string) {
    const response = await request<{ user: any } & TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });

    if (response.data) {
      await storeTokens(response.data);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data.user));
    }

    return response;
  },

  async logout(allDevices = false) {
    const response = await request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken, allDevices }),
    });

    await clearTokens();
    return response;
  },

  async getProfile() {
    return request<{ user: any }>('/auth/me');
  },

  async updatePassword(currentPassword: string, newPassword: string) {
    return request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};

// =============================================================================
// PATTERNS API
// =============================================================================

export const patternsApi = {
  async getAll() {
    return request<any[]>('/patterns');
  },

  async getById(patternCode: string) {
    return request<any>(`/patterns/${patternCode}`);
  },

  async getUserPreferences() {
    return request<any[]>('/patterns/preferences');
  },

  async setDefaultPattern(patternCode: string) {
    return request('/patterns/preferences/default', {
      method: 'POST',
      body: JSON.stringify({ patternCode }),
    });
  },

  async selectPatternForToday(patternCode: string, factors?: any) {
    const date = new Date().toISOString().split('T')[0];
    return request('/patterns/daily', {
      method: 'POST',
      body: JSON.stringify({ patternCode, date, factors }),
    });
  },

  async ratePattern(date: string, ratings: any) {
    return request(`/patterns/daily/${date}/rating`, {
      method: 'PUT',
      body: JSON.stringify(ratings),
    });
  },

  async getHistory(options?: { startDate?: string; endDate?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    if (options?.limit) params.append('limit', options.limit.toString());

    return request<any[]>(`/patterns/history?${params}`);
  },

  async getStatistics(days = 30) {
    return request<any>(`/patterns/statistics?days=${days}`);
  },
};

// =============================================================================
// MEALS API
// =============================================================================

export const mealsApi = {
  async getTodayMeals() {
    return request<any[]>('/meals/today');
  },

  async logMeal(mealData: any) {
    return request('/meals', {
      method: 'POST',
      body: JSON.stringify(mealData),
    });
  },

  async updateMeal(mealId: string, updates: any) {
    return request(`/meals/${mealId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async getMealHistory(options?: { startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    return request<any[]>(`/meals?${params}`);
  },
};

// =============================================================================
// INVENTORY API
// =============================================================================

export const inventoryApi = {
  async getAll(options?: { category?: string; location?: string }) {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.location) params.append('location', options.location);

    return request<any[]>(`/inventory?${params}`);
  },

  async addItem(item: any) {
    return request('/inventory', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  async updateItem(itemId: string, updates: any) {
    return request(`/inventory/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async consumeItem(itemId: string, quantity: number) {
    return request(`/inventory/${itemId}/consume`, {
      method: 'POST',
      body: JSON.stringify({ quantity }),
    });
  },

  async deleteItem(itemId: string) {
    return request(`/inventory/${itemId}`, {
      method: 'DELETE',
    });
  },

  async getExpiring(hoursAhead = 48) {
    return request<any[]>(`/inventory/expiring?hours=${hoursAhead}`);
  },

  async scanBarcode(barcode: string) {
    return request<any>(`/inventory/barcode/${barcode}`);
  },
};

// =============================================================================
// HYDRATION API
// =============================================================================

export const hydrationApi = {
  async logWater(amountOz: number, beverageType = 'water', notes?: string) {
    return request('/hydration', {
      method: 'POST',
      body: JSON.stringify({ amount_oz: amountOz, beverage_type: beverageType, notes }),
    });
  },

  async getTodayProgress() {
    return request<any>('/hydration/today');
  },

  async getGoals() {
    return request<any>('/hydration/goals');
  },

  async updateGoals(goals: any) {
    return request('/hydration/goals', {
      method: 'PUT',
      body: JSON.stringify(goals),
    });
  },

  async getTrends() {
    return request<any>('/hydration/trends');
  },

  async logCaffeine(beverageType: string, volumeOz: number, caffeineMg?: number) {
    return request('/caffeine', {
      method: 'POST',
      body: JSON.stringify({ beverage_type: beverageType, volume_oz: volumeOz, caffeine_mg: caffeineMg }),
    });
  },

  async getCaffeineProgress() {
    return request<any>('/caffeine/today');
  },
};

// =============================================================================
// ANALYTICS API
// =============================================================================

export const analyticsApi = {
  async getPatternStats(days = 30) {
    return request<any>(`/analytics/patterns?days=${days}`);
  },

  async getWeightTrend() {
    return request<any>('/analytics/weight');
  },

  async getAdherenceStats(options?: { startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    return request<any>(`/analytics/adherence?${params}`);
  },

  async getNutritionSummary(date?: string) {
    const params = date ? `?date=${date}` : '';
    return request<any>(`/analytics/nutrition${params}`);
  },

  async getMLRecommendations() {
    return request<any>('/ml/recommendations');
  },

  async trainModel(data: any) {
    return request('/ml/train', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// =============================================================================
// SHOPPING API
// =============================================================================

export const shoppingApi = {
  async getCurrentList() {
    return request<any>('/shopping/current');
  },

  async createList(list: any) {
    return request('/shopping', {
      method: 'POST',
      body: JSON.stringify(list),
    });
  },

  async updateList(listId: string, updates: any) {
    return request(`/shopping/${listId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async addItem(listId: string, item: any) {
    return request(`/shopping/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  async updateItem(listId: string, itemId: string, updates: any) {
    return request(`/shopping/${listId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async removeItem(listId: string, itemId: string) {
    return request(`/shopping/${listId}/items/${itemId}`, {
      method: 'DELETE',
    });
  },

  async completeList(listId: string) {
    return request(`/shopping/${listId}/complete`, {
      method: 'POST',
    });
  },

  async getPastLists(limit = 10) {
    return request<any[]>(`/shopping/history?limit=${limit}`);
  },
};

// =============================================================================
// PREP API
// =============================================================================

export const prepApi = {
  async getCurrentSession() {
    return request<any>('/prep/current');
  },

  async startSession(session: any) {
    return request('/prep/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    });
  },

  async updateSession(sessionId: string, updates: any) {
    return request(`/prep/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async endSession(sessionId: string) {
    return request(`/prep/sessions/${sessionId}/end`, {
      method: 'POST',
    });
  },

  async updateTaskStatus(sessionId: string, taskId: string, status: string) {
    return request(`/prep/sessions/${sessionId}/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  async getTemplates() {
    return request<any[]>('/prep/templates');
  },

  async createTemplate(template: any) {
    return request('/prep/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  },

  async getPastSessions(limit = 10) {
    return request<any[]>(`/prep/sessions?limit=${limit}`);
  },
};

// =============================================================================
// ADS API
// =============================================================================

export const adsApi = {
  async uploadAd(formData: FormData) {
    return request('/ads/upload', {
      method: 'POST',
      body: formData as any,
      headers: {}, // Let browser set Content-Type for FormData
    });
  },

  async processAd(adId: string) {
    return request(`/ads/${adId}/process`, {
      method: 'POST',
    });
  },

  async getUploadedAds() {
    return request<any[]>('/ads');
  },

  async getAdDeals(adId: string) {
    return request<any[]>(`/ads/${adId}/deals`);
  },

  async reviewDeal(adId: string, dealId: string, action: string, corrections?: any) {
    return request(`/ads/${adId}/deals/${dealId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, corrections }),
    });
  },

  async getTemplates() {
    return request<any[]>('/ads/templates');
  },

  async createTemplate(template: any) {
    return request('/ads/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  },

  async getAccuracyStats() {
    return request<any>('/ads/accuracy');
  },
};

// =============================================================================
// OPTIMIZATION API
// =============================================================================

export const optimizationApi = {
  async calculateOptimization(items: any[], weights: any) {
    return request('/optimization/calculate', {
      method: 'POST',
      body: JSON.stringify({ items, weights }),
    });
  },

  async getOptimizedRoute(storeIds: string[]) {
    return request('/optimization/route', {
      method: 'POST',
      body: JSON.stringify({ storeIds }),
    });
  },

  async getStores(location?: { lat: number; lng: number }) {
    const params = location ? `?lat=${location.lat}&lng=${location.lng}` : '';
    return request<any[]>(`/optimization/stores${params}`);
  },

  async saveWeightPreset(preset: any) {
    return request('/optimization/presets', {
      method: 'POST',
      body: JSON.stringify(preset),
    });
  },

  async getWeightPresets() {
    return request<any[]>('/optimization/presets');
  },
};

// =============================================================================
// EVENTS API
// =============================================================================

export const eventsApi = {
  async getEvents() {
    return request<any[]>('/events');
  },

  async createEvent(event: any) {
    return request('/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  },

  async updateEvent(eventId: string, updates: any) {
    return request(`/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteEvent(eventId: string) {
    return request(`/events/${eventId}`, {
      method: 'DELETE',
    });
  },

  async getStrategy(eventId: string) {
    return request<any>(`/events/${eventId}/strategy`);
  },

  async getRecoveryPlan(eventId: string) {
    return request<any>(`/events/${eventId}/recovery`);
  },
};

// API Client for services that need raw HTTP access (used by vectorSearchService)
export const apiClient = {
  async get<T>(endpoint: string, options?: { params?: Record<string, any> }): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (options?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return request<T>(url, { method: 'GET' });
  },

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// Export default API object
export default {
  auth: authApi,
  patterns: patternsApi,
  meals: mealsApi,
  inventory: inventoryApi,
  hydration: hydrationApi,
  analytics: analyticsApi,
  shopping: shoppingApi,
  prep: prepApi,
  ads: adsApi,
  optimization: optimizationApi,
  events: eventsApi,
  initializeAuth,
  clearCache,
  invalidateCache,
  setOnlineStatus,
  processOfflineQueue,
  getOfflineQueueStatus,
};
