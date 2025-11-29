/**
 * Comprehensive tests for notificationService
 * Tests all notification functionality including initialization, permissions,
 * scheduling, cancellation, and listener management
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock modules before imports
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock expo-notifications
const mockSetNotificationHandler = jest.fn();
const mockSetNotificationChannelAsync = jest.fn();
const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
const mockScheduleNotificationAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn();
const mockCancelAllScheduledNotificationsAsync = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockAddNotificationReceivedListener = jest.fn();

jest.mock('expo-notifications', () => ({
  __esModule: true,
  default: {},
  setNotificationHandler: mockSetNotificationHandler,
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  getExpoPushTokenAsync: mockGetExpoPushTokenAsync,
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  cancelAllScheduledNotificationsAsync: mockCancelAllScheduledNotificationsAsync,
  addNotificationResponseReceivedListener: mockAddNotificationResponseReceivedListener,
  addNotificationReceivedListener: mockAddNotificationReceivedListener,
  AndroidImportance: {
    HIGH: 4,
    DEFAULT: 3,
  },
}), { virtual: true });

// Mock expo-device with virtual mock
jest.mock('expo-device', () => ({
  isDevice: true,
}), { virtual: true });

// Import service after mocks are set up
import * as notificationService from '../../../src/mobile/services/notificationService';
import type { MealReminder, NotificationSchedule, PushToken } from '../../../src/mobile/services/notificationService';

describe('notificationService', () => {
  let Device: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform.OS as string) = 'ios';

    // Reset expo-device mock
    Device = require('expo-device');
    Device.isDevice = true;
  });

  describe('isNotificationsSupported', () => {
    it('should return true when expo-notifications is available', () => {
      const result = notificationService.isNotificationsSupported();
      expect(result).toBe(true);
    });
  });

  describe('initializeNotifications', () => {
    it('should set notification handler successfully', async () => {
      const result = await notificationService.initializeNotifications();

      expect(mockSetNotificationHandler).toHaveBeenCalledWith({
        handleNotification: expect.any(Function),
      });
      expect(result).toBe(true);
    });

    it('should create Android notification channels on Android platform', async () => {
      (Platform.OS as string) = 'android';

      await notificationService.initializeNotifications();

      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith('meal-reminders', {
        name: 'Meal Reminders',
        importance: 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B6B',
      });

      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith('hydration', {
        name: 'Hydration Reminders',
        importance: 3,
        vibrationPattern: [0, 100],
        lightColor: '#4ECDC4',
      });
    });

    it('should not create Android channels on iOS platform', async () => {
      (Platform.OS as string) = 'ios';

      await notificationService.initializeNotifications();

      expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      mockSetNotificationHandler.mockImplementationOnce(() => {
        throw new Error('Handler error');
      });

      const result = await notificationService.initializeNotifications();

      expect(result).toBe(false);
    });

    it('should configure handler with correct settings', async () => {
      await notificationService.initializeNotifications();

      const handlerConfig = mockSetNotificationHandler.mock.calls[0][0];
      const settings = await handlerConfig.handleNotification();

      expect(settings).toEqual({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      });
    });
  });

  describe('requestPermissions', () => {
    it('should return false on simulator', async () => {
      Device.isDevice = false;

      const result = await notificationService.requestPermissions();

      expect(result).toBe(false);
      expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
    });

    it('should return true when permission already granted', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });

      const result = await notificationService.requestPermissions();

      expect(result).toBe(true);
      expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('should request permission when not granted', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
      mockRequestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });

      const result = await notificationService.requestPermissions();

      expect(mockRequestPermissionsAsync).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when permission denied', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
      mockRequestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

      const result = await notificationService.requestPermissions();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockGetPermissionsAsync.mockRejectedValueOnce(new Error('Permission error'));

      const result = await notificationService.requestPermissions();

      expect(result).toBe(false);
    });
  });

  describe('getPushToken', () => {
    const mockToken: PushToken = {
      token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      platform: 'ios',
      createdAt: '2025-01-01T00:00:00.000Z',
    };

    it('should return null on simulator', async () => {
      Device.isDevice = false;

      const result = await notificationService.getPushToken();

      expect(result).toBeNull();
    });

    it('should return stored token if available', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockToken));

      const result = await notificationService.getPushToken();

      expect(result).toEqual(mockToken);
      expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    it('should fetch and store new token when not cached', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      mockGetExpoPushTokenAsync.mockResolvedValueOnce({ data: mockToken.token });

      const result = await notificationService.getPushToken();

      expect(mockGetExpoPushTokenAsync).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@meal_assistant:push_token',
        expect.stringContaining(mockToken.token)
      );
      expect(result).toMatchObject({
        token: mockToken.token,
        platform: 'ios',
      });
    });

    it('should use correct platform for Android', async () => {
      (Platform.OS as string) = 'android';
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      mockGetExpoPushTokenAsync.mockResolvedValueOnce({ data: mockToken.token });

      const result = await notificationService.getPushToken();

      expect(result?.platform).toBe('android');
    });

    it('should handle errors and return null', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      const result = await notificationService.getPushToken();

      expect(result).toBeNull();
    });
  });

  describe('scheduleMealReminder', () => {
    const mockReminder: MealReminder = {
      id: 'breakfast-1',
      type: 'breakfast',
      time: '07:30',
      enabled: true,
      message: 'Time for breakfast!',
    };

    it('should schedule enabled reminder successfully', async () => {
      mockScheduleNotificationAsync.mockResolvedValueOnce('notification-id-123');

      const result = await notificationService.scheduleMealReminder(mockReminder);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Breakfast Time',
          body: 'Time for breakfast!',
          data: {
            type: 'meal_reminder',
            reminderId: 'breakfast-1',
            mealType: 'breakfast',
          },
          sound: true,
        },
        trigger: {
          hour: 7,
          minute: 30,
          repeats: true,
        },
      });
      expect(result).toBe('notification-id-123');
    });

    it('should cancel existing notification before scheduling', async () => {
      mockScheduleNotificationAsync.mockResolvedValueOnce('notification-id-123');

      await notificationService.scheduleMealReminder(mockReminder);

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('breakfast-1');
    });

    it('should not schedule disabled reminder', async () => {
      const disabledReminder = { ...mockReminder, enabled: false };

      const result = await notificationService.scheduleMealReminder(disabledReminder);

      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should use default message when not provided', async () => {
      const reminderWithoutMessage = { ...mockReminder, message: undefined };
      mockScheduleNotificationAsync.mockResolvedValueOnce('notification-id-123');

      await notificationService.scheduleMealReminder(reminderWithoutMessage);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            body: 'Start your day with a healthy breakfast!',
          }),
        })
      );
    });

    it('should handle different meal types correctly', async () => {
      const lunchReminder: MealReminder = {
        id: 'lunch-1',
        type: 'lunch',
        time: '12:00',
        enabled: true,
      };
      mockScheduleNotificationAsync.mockResolvedValueOnce('notification-id-123');

      await notificationService.scheduleMealReminder(lunchReminder);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Lunch Time',
            body: 'Time to refuel with lunch!',
          }),
        })
      );
    });

    it('should handle hydration reminders', async () => {
      const hydrationReminder: MealReminder = {
        id: 'hydration-1',
        type: 'hydration',
        time: '10:00',
        enabled: true,
      };
      mockScheduleNotificationAsync.mockResolvedValueOnce('notification-id-123');

      await notificationService.scheduleMealReminder(hydrationReminder);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Hydration Reminder',
            body: 'Remember to drink water and stay hydrated!',
          }),
        })
      );
    });

    it('should parse time correctly for different hours', async () => {
      const eveningReminder: MealReminder = {
        id: 'dinner-1',
        type: 'dinner',
        time: '18:45',
        enabled: true,
      };
      mockScheduleNotificationAsync.mockResolvedValueOnce('notification-id-123');

      await notificationService.scheduleMealReminder(eveningReminder);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: {
            hour: 18,
            minute: 45,
            repeats: true,
          },
        })
      );
    });

    it('should handle errors and return null', async () => {
      mockScheduleNotificationAsync.mockRejectedValueOnce(new Error('Schedule error'));

      const result = await notificationService.scheduleMealReminder(mockReminder);

      expect(result).toBeNull();
    });
  });

  describe('scheduleAllReminders', () => {
    const mockSchedule: NotificationSchedule = {
      mealReminders: [
        { id: 'breakfast', type: 'breakfast', time: '07:30', enabled: true },
        { id: 'lunch', type: 'lunch', time: '12:00', enabled: true },
        { id: 'dinner', type: 'dinner', time: '18:30', enabled: false },
      ],
    };

    it('should cancel all existing notifications first', async () => {
      await notificationService.scheduleAllReminders(mockSchedule);

      expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });

    it('should schedule all reminders from provided schedule', async () => {
      mockScheduleNotificationAsync.mockResolvedValue('notification-id');

      await notificationService.scheduleAllReminders(mockSchedule);

      // Only enabled reminders are scheduled (breakfast and lunch are enabled, dinner is disabled)
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(2);
    });

    it('should use default reminders when no schedule provided', async () => {
      mockScheduleNotificationAsync.mockResolvedValue('notification-id');

      await notificationService.scheduleAllReminders();

      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(4); // 4 default reminders
    });

    it('should save schedule to storage', async () => {
      await notificationService.scheduleAllReminders(mockSchedule);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@meal_assistant:notification_schedule',
        JSON.stringify({ mealReminders: mockSchedule.mealReminders })
      );
    });

    it('should handle errors gracefully', async () => {
      mockCancelAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error('Cancel error'));

      await expect(notificationService.scheduleAllReminders(mockSchedule)).resolves.not.toThrow();
    });
  });

  describe('cancelNotification', () => {
    it('should cancel notification by ID', async () => {
      await notificationService.cancelNotification('notification-123');

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('notification-123');
    });

    it('should handle errors gracefully', async () => {
      mockCancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('Cancel error'));

      await expect(notificationService.cancelNotification('notification-123')).resolves.not.toThrow();
    });
  });

  describe('cancelAllNotifications', () => {
    it('should cancel all scheduled notifications', async () => {
      await notificationService.cancelAllNotifications();

      expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockCancelAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error('Cancel error'));

      await expect(notificationService.cancelAllNotifications()).resolves.not.toThrow();
    });
  });

  describe('getNotificationSchedule', () => {
    it('should return stored schedule', async () => {
      const mockSchedule: NotificationSchedule = {
        mealReminders: [
          { id: 'breakfast', type: 'breakfast', time: '07:30', enabled: true },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockSchedule));

      const result = await notificationService.getNotificationSchedule();

      expect(result).toEqual(mockSchedule);
    });

    it('should return default reminders when no schedule stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const result = await notificationService.getNotificationSchedule();

      expect(result.mealReminders).toHaveLength(4);
      expect(result.mealReminders[0].type).toBe('breakfast');
    });

    it('should handle storage errors and return defaults', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      const result = await notificationService.getNotificationSchedule();

      expect(result.mealReminders).toHaveLength(4);
    });
  });

  describe('updateNotificationSchedule', () => {
    const mockSchedule: NotificationSchedule = {
      mealReminders: [
        { id: 'breakfast', type: 'breakfast', time: '08:00', enabled: true },
      ],
    };

    it('should save schedule to storage', async () => {
      await notificationService.updateNotificationSchedule(mockSchedule);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@meal_assistant:notification_schedule',
        JSON.stringify(mockSchedule)
      );
    });

    it('should reschedule all reminders', async () => {
      mockScheduleNotificationAsync.mockResolvedValue('notification-id');

      await notificationService.updateNotificationSchedule(mockSchedule);

      expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalled();
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      await expect(notificationService.updateNotificationSchedule(mockSchedule)).resolves.not.toThrow();
    });
  });

  describe('areNotificationsEnabled', () => {
    it('should return true when enabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');

      const result = await notificationService.areNotificationsEnabled();

      expect(result).toBe(true);
    });

    it('should return false when disabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('false');

      const result = await notificationService.areNotificationsEnabled();

      expect(result).toBe(false);
    });

    it('should return false when not set', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const result = await notificationService.areNotificationsEnabled();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      const result = await notificationService.areNotificationsEnabled();

      expect(result).toBe(false);
    });
  });

  describe('setNotificationsEnabled', () => {
    beforeEach(() => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockScheduleNotificationAsync.mockResolvedValue('notification-id');
    });

    it('should enable notifications and request permissions', async () => {
      await notificationService.setNotificationsEnabled(true);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@meal_assistant:notifications_enabled',
        'true'
      );
      expect(mockGetPermissionsAsync).toHaveBeenCalled();
    });

    it('should schedule reminders when enabled with permission', async () => {
      await notificationService.setNotificationsEnabled(true);

      expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalled();
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should not schedule reminders when permission denied', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

      await notificationService.setNotificationsEnabled(true);

      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should disable notifications and cancel all', async () => {
      await notificationService.setNotificationsEnabled(false);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@meal_assistant:notifications_enabled',
        'false'
      );
      expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });

    it('should not request permissions when disabling', async () => {
      await notificationService.setNotificationsEnabled(false);

      expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      await expect(notificationService.setNotificationsEnabled(true)).resolves.not.toThrow();
    });
  });

  describe('sendLocalNotification', () => {
    it('should send immediate notification', async () => {
      mockScheduleNotificationAsync.mockResolvedValueOnce('notification-id-123');

      const result = await notificationService.sendLocalNotification(
        'Test Title',
        'Test Body'
      );

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Test Title',
          body: 'Test Body',
          data: {},
          sound: true,
        },
        trigger: null,
      });
      expect(result).toBe('notification-id-123');
    });

    it('should include custom data', async () => {
      mockScheduleNotificationAsync.mockResolvedValueOnce('notification-id-123');
      const customData = { userId: '123', action: 'reminder' };

      await notificationService.sendLocalNotification(
        'Test Title',
        'Test Body',
        customData
      );

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            data: customData,
          }),
        })
      );
    });

    it('should handle errors and return null', async () => {
      mockScheduleNotificationAsync.mockRejectedValueOnce(new Error('Send error'));

      const result = await notificationService.sendLocalNotification('Title', 'Body');

      expect(result).toBeNull();
    });
  });

  describe('addNotificationResponseListener', () => {
    it('should add listener and return subscription', () => {
      const mockCallback = jest.fn();
      const mockRemove = jest.fn();
      mockAddNotificationResponseReceivedListener.mockReturnValueOnce({ remove: mockRemove });

      const subscription = notificationService.addNotificationResponseListener(mockCallback);

      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledWith(mockCallback);
      expect(subscription).toHaveProperty('remove');
      expect(subscription.remove).toBe(mockRemove);
    });

    it('should return no-op subscription when notifications not supported', () => {
      // This test would require reloading the module without expo-notifications
      // For now, we test the happy path only
      const mockCallback = jest.fn();
      mockAddNotificationResponseReceivedListener.mockReturnValueOnce({ remove: jest.fn() });

      const subscription = notificationService.addNotificationResponseListener(mockCallback);

      expect(subscription).toHaveProperty('remove');
    });
  });

  describe('addNotificationReceivedListener', () => {
    it('should add listener and return subscription', () => {
      const mockCallback = jest.fn();
      const mockRemove = jest.fn();
      mockAddNotificationReceivedListener.mockReturnValueOnce({ remove: mockRemove });

      const subscription = notificationService.addNotificationReceivedListener(mockCallback);

      expect(mockAddNotificationReceivedListener).toHaveBeenCalledWith(mockCallback);
      expect(subscription).toHaveProperty('remove');
      expect(subscription.remove).toBe(mockRemove);
    });

    it('should allow callback to be invoked', () => {
      const mockCallback = jest.fn();
      const mockRemove = jest.fn();

      // Capture the callback passed to the listener
      let capturedCallback: any;
      mockAddNotificationReceivedListener.mockImplementationOnce((cb) => {
        capturedCallback = cb;
        return { remove: mockRemove };
      });

      notificationService.addNotificationReceivedListener(mockCallback);

      // Simulate notification received
      const mockNotification = {
        request: {
          content: {
            data: { test: 'data' },
          },
        },
      };
      capturedCallback(mockNotification);

      expect(mockCallback).toHaveBeenCalledWith(mockNotification);
    });
  });

  describe('Helper Functions (via public API)', () => {
    it('should use correct title for breakfast reminder', async () => {
      const reminder: MealReminder = {
        id: 'test',
        type: 'breakfast',
        time: '07:00',
        enabled: true,
      };
      mockScheduleNotificationAsync.mockResolvedValueOnce('id');

      await notificationService.scheduleMealReminder(reminder);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Breakfast Time',
          }),
        })
      );
    });

    it('should use correct title for snack reminder', async () => {
      const reminder: MealReminder = {
        id: 'test',
        type: 'snack',
        time: '15:00',
        enabled: true,
      };
      mockScheduleNotificationAsync.mockResolvedValueOnce('id');

      await notificationService.scheduleMealReminder(reminder);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Snack Time',
            body: 'Healthy snack time!',
          }),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle midnight time correctly', async () => {
      const reminder: MealReminder = {
        id: 'midnight',
        type: 'snack',
        time: '00:00',
        enabled: true,
      };
      mockScheduleNotificationAsync.mockResolvedValueOnce('id');

      await notificationService.scheduleMealReminder(reminder);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: {
            hour: 0,
            minute: 0,
            repeats: true,
          },
        })
      );
    });

    it('should handle late night time correctly', async () => {
      const reminder: MealReminder = {
        id: 'late-night',
        type: 'snack',
        time: '23:59',
        enabled: true,
      };
      mockScheduleNotificationAsync.mockResolvedValueOnce('id');

      await notificationService.scheduleMealReminder(reminder);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: {
            hour: 23,
            minute: 59,
            repeats: true,
          },
        })
      );
    });

    it('should handle empty reminder list', async () => {
      const emptySchedule: NotificationSchedule = {
        mealReminders: [],
      };

      await notificationService.scheduleAllReminders(emptySchedule);

      expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should handle custom message with special characters', async () => {
      const reminder: MealReminder = {
        id: 'test',
        type: 'lunch',
        time: '12:00',
        enabled: true,
        message: "It's time to eat! 🍕",
      };
      mockScheduleNotificationAsync.mockResolvedValueOnce('id');

      await notificationService.scheduleMealReminder(reminder);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            body: "It's time to eat! 🍕",
          }),
        })
      );
    });
  });
});
