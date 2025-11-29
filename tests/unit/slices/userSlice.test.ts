/**
 * User Slice Tests
 * Comprehensive test suite for Redux userSlice
 * Coverage: Initial state, reducers, async thunks, error handling
 */

import { configureStore } from '@reduxjs/toolkit';
import userReducer, {
  setLoading,
  setError,
  setPreferences,
  setTargetCalories,
  setTargetProtein,
  setPrimaryPattern,
  setNotificationsEnabled,
  setMealReminder,
  setTheme,
  setUnits,
  updateProfile,
  setTargetWeight,
  completeOnboarding,
  setLastActiveDate,
  resetPreferences,
  registerUser,
  loginUser,
  logoutUser,
  fetchUserProfile,
  updatePassword,
} from '../../../src/mobile/store/slices/userSlice';
import { authApi } from '../../../src/mobile/services/apiService';

// Mock the authApi
jest.mock('../../../src/mobile/services/apiService', () => ({
  authApi: {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    updatePassword: jest.fn(),
  },
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

// Helper function to create a test store
function createTestStore() {
  return configureStore({
    reducer: {
      user: userReducer,
    },
  });
}

describe('userSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // INITIAL STATE TESTS
  // =============================================================================

  describe('Initial State', () => {
    it('should return default initial state', () => {
      const store = createTestStore();
      const state = store.getState().user;

      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.isAuthenticated).toBe(false);
      expect(state.onboardingComplete).toBe(false);
      expect(state.lastActiveDate).toBe(null);
    });

    it('should have default preferences in initial state', () => {
      const store = createTestStore();
      const state = store.getState().user;

      expect(state.preferences).toEqual({
        targetCalories: 1800,
        targetProtein: 135,
        primaryPattern: 'A',
        notificationsEnabled: true,
        mealReminders: {
          morning: '07:30',
          noon: '12:00',
          evening: '18:30',
        },
        theme: 'system',
        units: 'imperial',
      });
    });

    it('should have empty profile in initial state', () => {
      const store = createTestStore();
      const state = store.getState().user;

      expect(state.profile).toEqual({
        name: '',
        startWeight: 0,
        targetWeight: 0,
        height: 0,
        age: 0,
      });
    });
  });

  // =============================================================================
  // SYNCHRONOUS REDUCERS - LOADING & ERROR
  // =============================================================================

  describe('Synchronous Reducers - Loading & Error', () => {
    it('should set loading state', () => {
      const store = createTestStore();

      store.dispatch(setLoading(true));
      expect(store.getState().user.loading).toBe(true);

      store.dispatch(setLoading(false));
      expect(store.getState().user.loading).toBe(false);
    });

    it('should set error message', () => {
      const store = createTestStore();
      const errorMessage = 'Test error message';

      store.dispatch(setError(errorMessage));
      expect(store.getState().user.error).toBe(errorMessage);
    });

    it('should clear error message', () => {
      const store = createTestStore();

      store.dispatch(setError('Error'));
      expect(store.getState().user.error).toBe('Error');

      store.dispatch(setError(null));
      expect(store.getState().user.error).toBe(null);
    });
  });

  // =============================================================================
  // PREFERENCES MANAGEMENT
  // =============================================================================

  describe('Preferences Management', () => {
    it('should set partial preferences', () => {
      const store = createTestStore();

      store.dispatch(setPreferences({
        targetCalories: 2000,
        targetProtein: 150,
      }));

      const preferences = store.getState().user.preferences;
      expect(preferences.targetCalories).toBe(2000);
      expect(preferences.targetProtein).toBe(150);
      // Other preferences should remain unchanged
      expect(preferences.primaryPattern).toBe('A');
      expect(preferences.notificationsEnabled).toBe(true);
    });

    it('should set target calories', () => {
      const store = createTestStore();

      store.dispatch(setTargetCalories(2200));
      expect(store.getState().user.preferences.targetCalories).toBe(2200);
    });

    it('should set target protein', () => {
      const store = createTestStore();

      store.dispatch(setTargetProtein(160));
      expect(store.getState().user.preferences.targetProtein).toBe(160);
    });

    it('should set primary pattern', () => {
      const store = createTestStore();

      store.dispatch(setPrimaryPattern('B'));
      expect(store.getState().user.preferences.primaryPattern).toBe('B');
    });

    it('should set notifications enabled', () => {
      const store = createTestStore();

      store.dispatch(setNotificationsEnabled(false));
      expect(store.getState().user.preferences.notificationsEnabled).toBe(false);

      store.dispatch(setNotificationsEnabled(true));
      expect(store.getState().user.preferences.notificationsEnabled).toBe(true);
    });

    it('should set meal reminder for morning', () => {
      const store = createTestStore();

      store.dispatch(setMealReminder({ meal: 'morning', time: '08:00' }));
      expect(store.getState().user.preferences.mealReminders.morning).toBe('08:00');
    });

    it('should set meal reminder for noon', () => {
      const store = createTestStore();

      store.dispatch(setMealReminder({ meal: 'noon', time: '13:00' }));
      expect(store.getState().user.preferences.mealReminders.noon).toBe('13:00');
    });

    it('should set meal reminder for evening', () => {
      const store = createTestStore();

      store.dispatch(setMealReminder({ meal: 'evening', time: '19:00' }));
      expect(store.getState().user.preferences.mealReminders.evening).toBe('19:00');
    });

    it('should set theme to light', () => {
      const store = createTestStore();

      store.dispatch(setTheme('light'));
      expect(store.getState().user.preferences.theme).toBe('light');
    });

    it('should set theme to dark', () => {
      const store = createTestStore();

      store.dispatch(setTheme('dark'));
      expect(store.getState().user.preferences.theme).toBe('dark');
    });

    it('should set theme to system', () => {
      const store = createTestStore();

      store.dispatch(setTheme('system'));
      expect(store.getState().user.preferences.theme).toBe('system');
    });

    it('should set units to metric', () => {
      const store = createTestStore();

      store.dispatch(setUnits('metric'));
      expect(store.getState().user.preferences.units).toBe('metric');
    });

    it('should set units to imperial', () => {
      const store = createTestStore();

      store.dispatch(setUnits('imperial'));
      expect(store.getState().user.preferences.units).toBe('imperial');
    });

    it('should reset preferences to defaults', () => {
      const store = createTestStore();

      // Change some preferences
      store.dispatch(setTargetCalories(2500));
      store.dispatch(setTheme('dark'));
      store.dispatch(setUnits('metric'));

      // Reset preferences
      store.dispatch(resetPreferences());

      const preferences = store.getState().user.preferences;
      expect(preferences).toEqual({
        targetCalories: 1800,
        targetProtein: 135,
        primaryPattern: 'A',
        notificationsEnabled: true,
        mealReminders: {
          morning: '07:30',
          noon: '12:00',
          evening: '18:30',
        },
        theme: 'system',
        units: 'imperial',
      });
    });
  });

  // =============================================================================
  // PROFILE MANAGEMENT
  // =============================================================================

  describe('Profile Management', () => {
    it('should update profile with partial data', () => {
      const store = createTestStore();

      store.dispatch(updateProfile({
        name: 'John Doe',
        age: 30,
      }));

      const profile = store.getState().user.profile;
      expect(profile.name).toBe('John Doe');
      expect(profile.age).toBe(30);
      expect(profile.startWeight).toBe(0); // Unchanged
    });

    it('should update complete profile', () => {
      const store = createTestStore();

      store.dispatch(updateProfile({
        name: 'Jane Smith',
        startWeight: 180,
        targetWeight: 150,
        height: 65,
        age: 28,
        email: 'jane@example.com',
      }));

      const profile = store.getState().user.profile;
      expect(profile.name).toBe('Jane Smith');
      expect(profile.startWeight).toBe(180);
      expect(profile.targetWeight).toBe(150);
      expect(profile.height).toBe(65);
      expect(profile.age).toBe(28);
      expect(profile.email).toBe('jane@example.com');
    });

    it('should set target weight', () => {
      const store = createTestStore();

      store.dispatch(setTargetWeight(160));
      expect(store.getState().user.profile.targetWeight).toBe(160);
    });
  });

  // =============================================================================
  // ONBOARDING & ACTIVITY
  // =============================================================================

  describe('Onboarding & Activity', () => {
    it('should complete onboarding', () => {
      const store = createTestStore();

      expect(store.getState().user.onboardingComplete).toBe(false);

      store.dispatch(completeOnboarding());
      expect(store.getState().user.onboardingComplete).toBe(true);
    });

    it('should set last active date', () => {
      const store = createTestStore();
      const date = '2025-11-29';

      store.dispatch(setLastActiveDate(date));
      expect(store.getState().user.lastActiveDate).toBe(date);
    });
  });

  // =============================================================================
  // ASYNC THUNK: REGISTER USER
  // =============================================================================

  describe('registerUser async thunk', () => {
    it('should handle pending state', () => {
      const store = createTestStore();

      mockAuthApi.register.mockResolvedValue({
        data: {
          user: { name: 'Test User', email: 'test@example.com' },
          accessToken: 'token123',
        },
      });

      store.dispatch(registerUser({
        email: 'test@example.com',
        password: 'password123'
      }));

      const state = store.getState().user;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);
    });

    it('should handle successful registration', async () => {
      const store = createTestStore();

      mockAuthApi.register.mockResolvedValue({
        data: {
          user: { name: 'Test User', email: 'test@example.com' },
          accessToken: 'token123',
        },
      });

      await store.dispatch(registerUser({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      }));

      const state = store.getState().user;
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(true);
      expect(state.profile.name).toBe('Test User');
      expect(state.profile.email).toBe('test@example.com');
      expect(state.error).toBe(null);
    });

    it('should handle registration with name', async () => {
      const store = createTestStore();

      mockAuthApi.register.mockResolvedValue({
        data: {
          user: { name: 'John Doe', email: 'john@example.com' },
          accessToken: 'token456',
        },
      });

      await store.dispatch(registerUser({
        email: 'john@example.com',
        password: 'password456',
        name: 'John Doe'
      }));

      const state = store.getState().user;
      expect(state.profile.name).toBe('John Doe');
    });

    it('should handle registration error', async () => {
      const store = createTestStore();

      mockAuthApi.register.mockResolvedValue({
        error: 'Email already exists',
        message: 'Email already exists',
      });

      await store.dispatch(registerUser({
        email: 'existing@example.com',
        password: 'password123'
      }));

      const state = store.getState().user;
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Email already exists');
    });

    it('should handle registration with error code', async () => {
      const store = createTestStore();

      mockAuthApi.register.mockResolvedValue({
        error: 'INVALID_EMAIL',
        message: 'Invalid email format',
      });

      await store.dispatch(registerUser({
        email: 'invalid-email',
        password: 'password123'
      }));

      const state = store.getState().user;
      expect(state.error).toBe('Invalid email format');
    });
  });

  // =============================================================================
  // ASYNC THUNK: LOGIN USER
  // =============================================================================

  describe('loginUser async thunk', () => {
    it('should handle pending state', () => {
      const store = createTestStore();

      mockAuthApi.login.mockResolvedValue({
        data: {
          user: { name: 'Test User', email: 'test@example.com' },
          accessToken: 'token123',
        },
      });

      store.dispatch(loginUser({
        email: 'test@example.com',
        password: 'password123'
      }));

      const state = store.getState().user;
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);
    });

    it('should handle successful login', async () => {
      const store = createTestStore();

      mockAuthApi.login.mockResolvedValue({
        data: {
          user: { name: 'Jane Doe', email: 'jane@example.com' },
          accessToken: 'token789',
        },
      });

      await store.dispatch(loginUser({
        email: 'jane@example.com',
        password: 'password789'
      }));

      const state = store.getState().user;
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(true);
      expect(state.profile.name).toBe('Jane Doe');
      expect(state.profile.email).toBe('jane@example.com');
      expect(state.error).toBe(null);
    });

    it('should handle login with user without name', async () => {
      const store = createTestStore();

      mockAuthApi.login.mockResolvedValue({
        data: {
          user: { email: 'noname@example.com' },
          accessToken: 'token999',
        },
      });

      await store.dispatch(loginUser({
        email: 'noname@example.com',
        password: 'password999'
      }));

      const state = store.getState().user;
      expect(state.profile.name).toBe('');
      expect(state.profile.email).toBe('noname@example.com');
    });

    it('should handle login error', async () => {
      const store = createTestStore();

      mockAuthApi.login.mockResolvedValue({
        error: 'Invalid credentials',
        message: 'Invalid credentials',
      });

      await store.dispatch(loginUser({
        email: 'wrong@example.com',
        password: 'wrongpassword'
      }));

      const state = store.getState().user;
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Invalid credentials');
    });

    it('should handle login with network error', async () => {
      const store = createTestStore();

      mockAuthApi.login.mockResolvedValue({
        error: 'NETWORK_ERROR',
        message: 'Unable to connect to server',
      });

      await store.dispatch(loginUser({
        email: 'user@example.com',
        password: 'password'
      }));

      const state = store.getState().user;
      expect(state.error).toBe('Unable to connect to server');
    });
  });

  // =============================================================================
  // ASYNC THUNK: LOGOUT USER
  // =============================================================================

  describe('logoutUser async thunk', () => {
    it('should handle successful logout', async () => {
      const store = createTestStore();

      // First login
      store.dispatch(updateProfile({
        name: 'Test User',
        email: 'test@example.com',
        startWeight: 180,
      }));
      store.dispatch(setLoading(false));

      mockAuthApi.logout.mockResolvedValue({ data: true });

      await store.dispatch(logoutUser(false));

      const state = store.getState().user;
      expect(state.isAuthenticated).toBe(false);
      expect(state.profile.name).toBe('');
      expect(state.profile.email).toBeUndefined();
      expect(state.profile.startWeight).toBe(0);
    });

    it('should handle logout with all devices flag', async () => {
      const store = createTestStore();

      mockAuthApi.logout.mockResolvedValue({ data: true });

      await store.dispatch(logoutUser(true));

      expect(mockAuthApi.logout).toHaveBeenCalledWith(true);
    });

    it('should handle logout without all devices flag', async () => {
      const store = createTestStore();

      mockAuthApi.logout.mockResolvedValue({ data: true });

      await store.dispatch(logoutUser());

      expect(mockAuthApi.logout).toHaveBeenCalledWith(false);
    });

    it('should reset profile to initial state on logout', async () => {
      const store = createTestStore();

      // Set some profile data
      store.dispatch(updateProfile({
        name: 'User',
        startWeight: 200,
        targetWeight: 180,
        height: 70,
        age: 35,
      }));

      mockAuthApi.logout.mockResolvedValue({ data: true });

      await store.dispatch(logoutUser());

      const state = store.getState().user;
      expect(state.profile).toEqual({
        name: '',
        startWeight: 0,
        targetWeight: 0,
        height: 0,
        age: 0,
      });
    });
  });

  // =============================================================================
  // ASYNC THUNK: FETCH USER PROFILE
  // =============================================================================

  describe('fetchUserProfile async thunk', () => {
    it('should handle pending state', () => {
      const store = createTestStore();

      mockAuthApi.getProfile.mockResolvedValue({
        data: {
          user: { name: 'Profile User', email: 'profile@example.com' },
        },
      });

      store.dispatch(fetchUserProfile());

      const state = store.getState().user;
      expect(state.loading).toBe(true);
    });

    it('should handle successful profile fetch', async () => {
      const store = createTestStore();

      mockAuthApi.getProfile.mockResolvedValue({
        data: {
          user: { name: 'Fetched User', email: 'fetched@example.com' },
        },
      });

      await store.dispatch(fetchUserProfile());

      const state = store.getState().user;
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(true);
      expect(state.profile.name).toBe('Fetched User');
      expect(state.profile.email).toBe('fetched@example.com');
    });

    it('should handle profile fetch without name', async () => {
      const store = createTestStore();

      mockAuthApi.getProfile.mockResolvedValue({
        data: {
          user: { email: 'onlyemail@example.com' },
        },
      });

      await store.dispatch(fetchUserProfile());

      const state = store.getState().user;
      expect(state.profile.name).toBe('');
      expect(state.profile.email).toBe('onlyemail@example.com');
    });

    it('should handle profile fetch error', async () => {
      const store = createTestStore();

      mockAuthApi.getProfile.mockResolvedValue({
        error: 'Unauthorized',
        message: 'Unauthorized',
      });

      await store.dispatch(fetchUserProfile());

      const state = store.getState().user;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Unauthorized');
    });

    it('should handle token expired error', async () => {
      const store = createTestStore();

      mockAuthApi.getProfile.mockResolvedValue({
        error: 'TOKEN_EXPIRED',
        message: 'Session expired',
      });

      await store.dispatch(fetchUserProfile());

      const state = store.getState().user;
      expect(state.error).toBe('Session expired');
    });

    it('should maintain existing profile data on error', async () => {
      const store = createTestStore();

      // Set initial profile
      store.dispatch(updateProfile({
        name: 'Existing User',
        startWeight: 175,
      }));

      mockAuthApi.getProfile.mockResolvedValue({
        error: 'Network error',
      });

      await store.dispatch(fetchUserProfile());

      const state = store.getState().user;
      expect(state.profile.name).toBe('Existing User');
      expect(state.profile.startWeight).toBe(175);
    });
  });

  // =============================================================================
  // ASYNC THUNK: UPDATE PASSWORD
  // =============================================================================

  describe('updatePassword async thunk', () => {
    it('should handle successful password update', async () => {
      const store = createTestStore();

      mockAuthApi.updatePassword.mockResolvedValue({ data: true });

      await store.dispatch(updatePassword({
        currentPassword: 'oldpass123',
        newPassword: 'newpass456',
      }));

      const state = store.getState().user;
      expect(state.error).toBe(null);
    });

    it('should handle password update error', async () => {
      const store = createTestStore();

      mockAuthApi.updatePassword.mockResolvedValue({
        error: 'Current password is incorrect',
        message: 'Current password is incorrect',
      });

      await store.dispatch(updatePassword({
        currentPassword: 'wrongpass',
        newPassword: 'newpass456',
      }));

      const state = store.getState().user;
      expect(state.error).toBe('Current password is incorrect');
    });

    it('should handle weak password error', async () => {
      const store = createTestStore();

      mockAuthApi.updatePassword.mockResolvedValue({
        error: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters',
      });

      await store.dispatch(updatePassword({
        currentPassword: 'oldpass123',
        newPassword: '123',
      }));

      const state = store.getState().user;
      expect(state.error).toBe('Password must be at least 8 characters');
    });

    it('should clear previous error on successful update', async () => {
      const store = createTestStore();

      // Set an error first
      store.dispatch(setError('Previous error'));
      expect(store.getState().user.error).toBe('Previous error');

      mockAuthApi.updatePassword.mockResolvedValue({ data: true });

      await store.dispatch(updatePassword({
        currentPassword: 'oldpass123',
        newPassword: 'newpass456',
      }));

      const state = store.getState().user;
      expect(state.error).toBe(null);
    });
  });

  // =============================================================================
  // COMPLEX SCENARIOS
  // =============================================================================

  describe('Complex Scenarios', () => {
    it('should handle complete user flow: register -> update profile -> logout', async () => {
      const store = createTestStore();

      // Register
      mockAuthApi.register.mockResolvedValue({
        data: {
          user: { name: 'New User', email: 'new@example.com' },
          accessToken: 'token',
        },
      });
      await store.dispatch(registerUser({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User'
      }));

      expect(store.getState().user.isAuthenticated).toBe(true);

      // Update profile
      store.dispatch(updateProfile({
        startWeight: 180,
        targetWeight: 160,
        height: 68,
        age: 30,
      }));

      const profileAfterUpdate = store.getState().user.profile;
      expect(profileAfterUpdate.startWeight).toBe(180);
      expect(profileAfterUpdate.targetWeight).toBe(160);

      // Logout
      mockAuthApi.logout.mockResolvedValue({ data: true });
      await store.dispatch(logoutUser());

      expect(store.getState().user.isAuthenticated).toBe(false);
      expect(store.getState().user.profile.startWeight).toBe(0);
    });

    it('should maintain preferences through authentication changes', async () => {
      const store = createTestStore();

      // Set custom preferences
      store.dispatch(setTargetCalories(2200));
      store.dispatch(setTheme('dark'));
      store.dispatch(setUnits('metric'));

      // Login
      mockAuthApi.login.mockResolvedValue({
        data: {
          user: { name: 'User', email: 'user@example.com' },
          accessToken: 'token',
        },
      });
      await store.dispatch(loginUser({
        email: 'user@example.com',
        password: 'password'
      }));

      // Preferences should be maintained
      const prefs = store.getState().user.preferences;
      expect(prefs.targetCalories).toBe(2200);
      expect(prefs.theme).toBe('dark');
      expect(prefs.units).toBe('metric');

      // Logout
      mockAuthApi.logout.mockResolvedValue({ data: true });
      await store.dispatch(logoutUser());

      // Preferences should still be maintained after logout
      const prefsAfterLogout = store.getState().user.preferences;
      expect(prefsAfterLogout.targetCalories).toBe(2200);
      expect(prefsAfterLogout.theme).toBe('dark');
      expect(prefsAfterLogout.units).toBe('metric');
    });

    it('should handle sequential async operations correctly', async () => {
      const store = createTestStore();

      // Register
      mockAuthApi.register.mockResolvedValue({
        data: {
          user: { name: 'User1', email: 'user1@example.com' },
          accessToken: 'token1',
        },
      });
      await store.dispatch(registerUser({
        email: 'user1@example.com',
        password: 'pass1'
      }));

      expect(store.getState().user.isAuthenticated).toBe(true);

      // Fetch profile
      mockAuthApi.getProfile.mockResolvedValue({
        data: {
          user: { name: 'Updated User1', email: 'user1@example.com' },
        },
      });
      await store.dispatch(fetchUserProfile());

      expect(store.getState().user.profile.name).toBe('Updated User1');

      // Update password
      mockAuthApi.updatePassword.mockResolvedValue({ data: true });
      await store.dispatch(updatePassword({
        currentPassword: 'pass1',
        newPassword: 'newpass1',
      }));

      expect(store.getState().user.error).toBe(null);

      // Logout
      mockAuthApi.logout.mockResolvedValue({ data: true });
      await store.dispatch(logoutUser());

      expect(store.getState().user.isAuthenticated).toBe(false);
    });

    it('should handle error recovery flow', async () => {
      const store = createTestStore();

      // Failed login
      mockAuthApi.login.mockResolvedValue({
        error: 'Invalid credentials',
      });
      await store.dispatch(loginUser({
        email: 'user@example.com',
        password: 'wrongpass'
      }));

      expect(store.getState().user.error).toBe('Invalid credentials');
      expect(store.getState().user.isAuthenticated).toBe(false);

      // Clear error
      store.dispatch(setError(null));
      expect(store.getState().user.error).toBe(null);

      // Successful login
      mockAuthApi.login.mockResolvedValue({
        data: {
          user: { name: 'User', email: 'user@example.com' },
          accessToken: 'token',
        },
      });
      await store.dispatch(loginUser({
        email: 'user@example.com',
        password: 'correctpass'
      }));

      expect(store.getState().user.isAuthenticated).toBe(true);
      expect(store.getState().user.error).toBe(null);
    });
  });

  // =============================================================================
  // EDGE CASES
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle empty meal reminder values', () => {
      const store = createTestStore();

      store.dispatch(setMealReminder({ meal: 'morning', time: '' }));
      expect(store.getState().user.preferences.mealReminders.morning).toBe('');
    });

    it('should handle zero values in profile', () => {
      const store = createTestStore();

      store.dispatch(updateProfile({
        startWeight: 0,
        targetWeight: 0,
        height: 0,
        age: 0,
      }));

      const profile = store.getState().user.profile;
      expect(profile.startWeight).toBe(0);
      expect(profile.targetWeight).toBe(0);
      expect(profile.height).toBe(0);
      expect(profile.age).toBe(0);
    });

    it('should handle multiple preference updates in sequence', () => {
      const store = createTestStore();

      store.dispatch(setTargetCalories(2000));
      store.dispatch(setTargetCalories(2200));
      store.dispatch(setTargetCalories(1900));

      expect(store.getState().user.preferences.targetCalories).toBe(1900);
    });

    it('should handle API response without data field', async () => {
      const store = createTestStore();

      mockAuthApi.login.mockResolvedValue({} as any);

      await store.dispatch(loginUser({
        email: 'test@example.com',
        password: 'password'
      }));

      const state = store.getState().user;
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should preserve existing profile fields when updating subset', () => {
      const store = createTestStore();

      // Set initial profile
      store.dispatch(updateProfile({
        name: 'Original Name',
        startWeight: 200,
        targetWeight: 180,
        height: 70,
        age: 35,
      }));

      // Update only one field
      store.dispatch(updateProfile({
        targetWeight: 175,
      }));

      const profile = store.getState().user.profile;
      expect(profile.name).toBe('Original Name');
      expect(profile.startWeight).toBe(200);
      expect(profile.targetWeight).toBe(175);
      expect(profile.height).toBe(70);
      expect(profile.age).toBe(35);
    });

    it('should handle last active date with different formats', () => {
      const store = createTestStore();

      const iso8601 = '2025-11-29T12:00:00Z';
      store.dispatch(setLastActiveDate(iso8601));
      expect(store.getState().user.lastActiveDate).toBe(iso8601);

      const dateOnly = '2025-11-29';
      store.dispatch(setLastActiveDate(dateOnly));
      expect(store.getState().user.lastActiveDate).toBe(dateOnly);
    });
  });
});
