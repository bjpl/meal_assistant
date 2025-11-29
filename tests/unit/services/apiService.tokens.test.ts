/**
 * Token Management Tests for apiService
 */

import AsyncStorageMock, { mockStorage } from '../../setup/asyncStorage.mock';
import {
  mockFetch,
  createMockResponse,
  createMockErrorResponse,
  createMockTokenResponse,
  STORAGE_KEYS,
} from '../../mocks/apiMocks';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => AsyncStorageMock);

// Mock global fetch
global.fetch = mockFetch as any;

// Import API service after mocks
import {
  initializeAuth,
  authApi,
} from '../../../src/mobile/services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('apiService - Token Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    mockFetch.mockReset();
  });

  describe('initializeAuth', () => {
    it('should load tokens from AsyncStorage successfully', async () => {
      // Arrange
      mockStorage.set(STORAGE_KEYS.ACCESS_TOKEN, 'stored-access-token');
      mockStorage.set(STORAGE_KEYS.REFRESH_TOKEN, 'stored-refresh-token');

      // Act
      const result = await initializeAuth();

      // Assert
      expect(result).toBe(true);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.ACCESS_TOKEN);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN);
    });

    it('should return false when no tokens are stored', async () => {
      // Act
      const result = await initializeAuth();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false and handle errors gracefully', async () => {
      // Arrange
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      // Act
      const result = await initializeAuth();

      // Assert
      expect(result).toBe(false);
    });

    it('should load only access token if refresh token is missing', async () => {
      // Arrange
      mockStorage.set(STORAGE_KEYS.ACCESS_TOKEN, 'stored-access-token');

      // Act
      const result = await initializeAuth();

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('storeTokens (via authApi.login)', () => {
    it('should store tokens in AsyncStorage after successful login', async () => {
      // Arrange
      const tokenResponse = createMockTokenResponse();
      const userData = { id: '1', email: 'test@example.com' };
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ ...tokenResponse, user: userData })
      );

      // Act
      await authApi.login('test@example.com', 'password123');

      // Assert
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ACCESS_TOKEN,
        tokenResponse.accessToken
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.REFRESH_TOKEN,
        tokenResponse.refreshToken
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.USER,
        JSON.stringify(userData)
      );
    });

    it('should store tokens in AsyncStorage after successful registration', async () => {
      // Arrange
      const tokenResponse = createMockTokenResponse();
      const userData = { id: '1', email: 'new@example.com' };
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ ...tokenResponse, user: userData })
      );

      // Act
      await authApi.register('new@example.com', 'password123', { name: 'Test User' });

      // Assert
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ACCESS_TOKEN,
        tokenResponse.accessToken
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.REFRESH_TOKEN,
        tokenResponse.refreshToken
      );
    });
  });

  describe('clearTokens (via authApi.logout)', () => {
    it('should remove all tokens from AsyncStorage on logout', async () => {
      // Arrange
      mockStorage.set(STORAGE_KEYS.ACCESS_TOKEN, 'token1');
      mockStorage.set(STORAGE_KEYS.REFRESH_TOKEN, 'token2');
      mockStorage.set(STORAGE_KEYS.USER, '{"id":"1"}');
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      // Act
      await authApi.logout();

      // Assert
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.ACCESS_TOKEN);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.USER);
    });

    it('should clear tokens even if logout request fails', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce(createMockErrorResponse({ error: 'Logout failed' }));

      // Act
      await authApi.logout();

      // Assert
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.ACCESS_TOKEN);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN);
    });
  });
});
