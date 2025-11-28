/**
 * Notification Service for Mobile App
 * Handles push notifications, local notifications, and meal reminders
 * Uses expo-notifications for cross-platform support
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Check if expo-notifications is available
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;

try {
  // Dynamic import to handle cases where expo-notifications is not installed
  Notifications = require('expo-notifications');
  Device = require('expo-device');
} catch {
  console.warn('expo-notifications not available. Push notifications disabled.');
}

// Types
export interface MealReminder {
  id: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'hydration';
  time: string; // HH:mm format
  enabled: boolean;
  patternId?: string;
  message?: string;
}

export interface NotificationSchedule {
  mealReminders: MealReminder[];
  hydrationInterval?: number; // minutes
  dailySummaryTime?: string; // HH:mm
  weeklyReportDay?: number; // 0-6 (Sunday-Saturday)
}

export interface PushToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  createdAt: string;
}

// Storage keys
const STORAGE_KEYS = {
  PUSH_TOKEN: '@meal_assistant:push_token',
  NOTIFICATION_SCHEDULE: '@meal_assistant:notification_schedule',
  NOTIFICATIONS_ENABLED: '@meal_assistant:notifications_enabled',
};

// Default meal reminder times
const DEFAULT_REMINDERS: MealReminder[] = [
  { id: 'morning', type: 'breakfast', time: '07:30', enabled: true, message: 'Time for breakfast!' },
  { id: 'noon', type: 'lunch', time: '12:00', enabled: true, message: 'Lunch time!' },
  { id: 'evening', type: 'dinner', time: '18:30', enabled: true, message: 'Dinner time!' },
  { id: 'hydration', type: 'hydration', time: '10:00', enabled: true, message: 'Remember to drink water!' },
];

// Logger
const logger = {
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Notifications] ${message}`, data || '');
    }
  },
  error: (message: string, error?: unknown) => {
    console.error(`[Notifications Error] ${message}`, error || '');
  },
};

/**
 * Check if notifications are supported
 */
export function isNotificationsSupported(): boolean {
  return Notifications !== null;
}

/**
 * Initialize notification service
 * Sets up notification handlers and channels
 */
export async function initializeNotifications(): Promise<boolean> {
  if (!Notifications) {
    logger.debug('Notifications not available');
    return false;
  }

  try {
    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Create Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('meal-reminders', {
        name: 'Meal Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B6B',
      });

      await Notifications.setNotificationChannelAsync('hydration', {
        name: 'Hydration Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 100],
        lightColor: '#4ECDC4',
      });
    }

    logger.debug('Notifications initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize notifications', error);
    return false;
  }
}

/**
 * Request notification permissions
 */
export async function requestPermissions(): Promise<boolean> {
  if (!Notifications || !Device) {
    return false;
  }

  try {
    // Check if physical device (notifications don't work on simulator)
    if (!Device.isDevice) {
      logger.debug('Not a physical device, skipping permission request');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.debug('Permission not granted');
      return false;
    }

    logger.debug('Permission granted');
    return true;
  } catch (error) {
    logger.error('Failed to request permissions', error);
    return false;
  }
}

/**
 * Get push notification token
 */
export async function getPushToken(): Promise<PushToken | null> {
  if (!Notifications || !Device) {
    return null;
  }

  try {
    if (!Device.isDevice) {
      return null;
    }

    // Check for existing token
    const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
    if (storedToken) {
      return JSON.parse(storedToken);
    }

    // Get new token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken: PushToken = {
      token: tokenData.data,
      platform: Platform.OS as 'ios' | 'android' | 'web',
      createdAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, JSON.stringify(pushToken));
    logger.debug('Push token obtained', { token: pushToken.token.slice(0, 20) + '...' });

    return pushToken;
  } catch (error) {
    logger.error('Failed to get push token', error);
    return null;
  }
}

/**
 * Schedule a meal reminder notification
 */
export async function scheduleMealReminder(reminder: MealReminder): Promise<string | null> {
  if (!Notifications) {
    return null;
  }

  try {
    // Parse time
    const [hours, minutes] = reminder.time.split(':').map(Number);

    // Cancel existing notification for this reminder
    await cancelNotification(reminder.id);

    if (!reminder.enabled) {
      return null;
    }

    // Schedule daily notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: getReminderTitle(reminder.type),
        body: reminder.message || getDefaultMessage(reminder.type),
        data: { type: 'meal_reminder', reminderId: reminder.id, mealType: reminder.type },
        sound: true,
      },
      trigger: {
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });

    logger.debug('Scheduled meal reminder', { id: notificationId, time: reminder.time });
    return notificationId;
  } catch (error) {
    logger.error('Failed to schedule meal reminder', error);
    return null;
  }
}

/**
 * Schedule all meal reminders from schedule
 */
export async function scheduleAllReminders(schedule?: NotificationSchedule): Promise<void> {
  if (!Notifications) {
    return;
  }

  try {
    const reminders = schedule?.mealReminders || DEFAULT_REMINDERS;

    // Cancel all existing scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule each reminder
    for (const reminder of reminders) {
      await scheduleMealReminder(reminder);
    }

    // Save schedule
    await AsyncStorage.setItem(
      STORAGE_KEYS.NOTIFICATION_SCHEDULE,
      JSON.stringify({ mealReminders: reminders })
    );

    logger.debug('All reminders scheduled', { count: reminders.length });
  } catch (error) {
    logger.error('Failed to schedule all reminders', error);
  }
}

/**
 * Cancel a specific notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  if (!Notifications) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    logger.debug('Cancelled notification', { id: notificationId });
  } catch (error) {
    logger.error('Failed to cancel notification', error);
  }
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  if (!Notifications) {
    return;
  }

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    logger.debug('All notifications cancelled');
  } catch (error) {
    logger.error('Failed to cancel all notifications', error);
  }
}

/**
 * Get notification schedule
 */
export async function getNotificationSchedule(): Promise<NotificationSchedule> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_SCHEDULE);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    logger.error('Failed to get notification schedule', error);
  }

  return { mealReminders: DEFAULT_REMINDERS };
}

/**
 * Update notification schedule
 */
export async function updateNotificationSchedule(
  schedule: NotificationSchedule
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.NOTIFICATION_SCHEDULE,
      JSON.stringify(schedule)
    );
    await scheduleAllReminders(schedule);
  } catch (error) {
    logger.error('Failed to update notification schedule', error);
  }
}

/**
 * Check if notifications are enabled
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
    return stored === 'true';
  } catch {
    return false;
  }
}

/**
 * Set notifications enabled state
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, String(enabled));

    if (enabled) {
      const hasPermission = await requestPermissions();
      if (hasPermission) {
        await scheduleAllReminders();
      }
    } else {
      await cancelAllNotifications();
    }
  } catch (error) {
    logger.error('Failed to set notifications enabled', error);
  }
}

/**
 * Send immediate local notification
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string | null> {
  if (!Notifications) {
    return null;
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null, // Immediate
    });

    logger.debug('Sent local notification', { id: notificationId });
    return notificationId;
  } catch (error) {
    logger.error('Failed to send local notification', error);
    return null;
  }
}

/**
 * Add notification response listener
 */
export function addNotificationResponseListener(
  callback: (response: { notification: { request: { content: { data: Record<string, unknown> } } } }) => void
): { remove: () => void } {
  if (!Notifications) {
    return { remove: () => {} };
  }

  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add notification received listener
 */
export function addNotificationReceivedListener(
  callback: (notification: { request: { content: { data: Record<string, unknown> } } }) => void
): { remove: () => void } {
  if (!Notifications) {
    return { remove: () => {} };
  }

  return Notifications.addNotificationReceivedListener(callback);
}

// Helper functions
function getReminderTitle(type: MealReminder['type']): string {
  switch (type) {
    case 'breakfast':
      return 'Breakfast Time';
    case 'lunch':
      return 'Lunch Time';
    case 'dinner':
      return 'Dinner Time';
    case 'snack':
      return 'Snack Time';
    case 'hydration':
      return 'Hydration Reminder';
    default:
      return 'Meal Reminder';
  }
}

function getDefaultMessage(type: MealReminder['type']): string {
  switch (type) {
    case 'breakfast':
      return 'Start your day with a healthy breakfast!';
    case 'lunch':
      return 'Time to refuel with lunch!';
    case 'dinner':
      return 'Enjoy a nutritious dinner!';
    case 'snack':
      return 'Healthy snack time!';
    case 'hydration':
      return 'Remember to drink water and stay hydrated!';
    default:
      return 'Time to eat!';
  }
}

export default {
  isNotificationsSupported,
  initializeNotifications,
  requestPermissions,
  getPushToken,
  scheduleMealReminder,
  scheduleAllReminders,
  cancelNotification,
  cancelAllNotifications,
  getNotificationSchedule,
  updateNotificationSchedule,
  areNotificationsEnabled,
  setNotificationsEnabled,
  sendLocalNotification,
  addNotificationResponseListener,
  addNotificationReceivedListener,
};
