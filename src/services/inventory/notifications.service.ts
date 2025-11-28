/**
 * Inventory Notification Service
 * Handles push notifications, alerts, and reminders for inventory events
 */

import { ShoppingListItem } from '../../types/inventory.types';
import { expiryPreventionService } from './expiry.service';
import { predictiveAnalyticsService } from './predictions.service';

/**
 * Notification priority levels
 */
type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Notification types
 */
type NotificationType =
  | 'expiry_warning'
  | 'expiry_critical'
  | 'depletion_alert'
  | 'shopping_reminder'
  | 'leftover_reminder'
  | 'freezer_suggestion';

/**
 * Notification entry
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;
  itemId?: string;
  itemName?: string;
  actionUrl?: string;
  actions?: { label: string; action: string }[];
  createdAt: Date;
  scheduledFor?: Date;
  delivered: boolean;
  deliveredAt?: Date;
  dismissed: boolean;
  dismissedAt?: Date;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  enabled: boolean;
  expiryWarnings: boolean;
  expiryWarningHours: number;  // Hours before expiry to notify
  depletionAlerts: boolean;
  depletionAlertDays: number;  // Days before depletion to notify
  shoppingReminders: boolean;
  leftoverReminders: boolean;
  quietHoursStart?: number;  // Hour (0-23)
  quietHoursEnd?: number;
  maxNotificationsPerDay: number;
}

/**
 * Generate unique ID
 */
const generateId = (): string => {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * InventoryNotificationService class
 * Manages all notification-related operations
 */
export class InventoryNotificationService {
  private notifications: Map<string, Notification> = new Map();
  private preferences: NotificationPreferences;
  private checkInterval: NodeJS.Timeout | null = null;
  private notificationsToday: number = 0;
  private lastResetDate: string = '';
  private permissionGranted: boolean = false;

  constructor() {
    this.preferences = this.loadPreferences();
    this.loadNotifications();
    this.checkPermission();
    this.resetDailyCount();
  }

  /**
   * Load preferences from storage
   */
  private loadPreferences(): NotificationPreferences {
    try {
      const stored = localStorage.getItem('meal_assistant_notification_prefs');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }

    return {
      enabled: true,
      expiryWarnings: true,
      expiryWarningHours: 48,
      depletionAlerts: true,
      depletionAlertDays: 3,
      shoppingReminders: true,
      leftoverReminders: true,
      quietHoursStart: 22,
      quietHoursEnd: 8,
      maxNotificationsPerDay: 10
    };
  }

  /**
   * Save preferences to storage
   */
  private savePreferences(): void {
    try {
      localStorage.setItem('meal_assistant_notification_prefs',
        JSON.stringify(this.preferences));
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  }

  /**
   * Load notifications from storage
   */
  private loadNotifications(): void {
    try {
      const stored = localStorage.getItem('meal_assistant_notifications');
      if (stored) {
        const data = JSON.parse(stored);
        data.forEach((notif: Notification) => {
          notif.createdAt = new Date(notif.createdAt);
          if (notif.scheduledFor) notif.scheduledFor = new Date(notif.scheduledFor);
          if (notif.deliveredAt) notif.deliveredAt = new Date(notif.deliveredAt);
          if (notif.dismissedAt) notif.dismissedAt = new Date(notif.dismissedAt);
          this.notifications.set(notif.id, notif);
        });
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  /**
   * Save notifications to storage
   */
  private saveNotifications(): void {
    try {
      const data = Array.from(this.notifications.values())
        .slice(-200); // Keep last 200 notifications
      localStorage.setItem('meal_assistant_notifications', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save notifications:', error);
    }
  }

  /**
   * Check and request notification permission
   */
  public async checkPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported in this browser');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permissionGranted = true;
      return true;
    }

    if (Notification.permission === 'denied') {
      this.permissionGranted = false;
      return false;
    }

    // Request permission
    try {
      const result = await Notification.requestPermission();
      this.permissionGranted = result === 'granted';
      return this.permissionGranted;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  /**
   * Reset daily notification count
   */
  private resetDailyCount(): void {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.notificationsToday = 0;
      this.lastResetDate = today;
    }
  }

  /**
   * Check if currently in quiet hours
   */
  private isQuietHours(): boolean {
    if (this.preferences.quietHoursStart === undefined ||
        this.preferences.quietHoursEnd === undefined) {
      return false;
    }

    const hour = new Date().getHours();
    const start = this.preferences.quietHoursStart;
    const end = this.preferences.quietHoursEnd;

    if (start < end) {
      return hour >= start && hour < end;
    } else {
      // Quiet hours span midnight
      return hour >= start || hour < end;
    }
  }

  /**
   * Can send notification based on limits and preferences
   */
  private canSendNotification(): boolean {
    this.resetDailyCount();

    if (!this.preferences.enabled) return false;
    if (this.notificationsToday >= this.preferences.maxNotificationsPerDay) return false;
    if (this.isQuietHours()) return false;

    return true;
  }

  /**
   * Create and send a notification
   */
  private async sendNotification(
    type: NotificationType,
    title: string,
    body: string,
    options?: {
      priority?: NotificationPriority;
      itemId?: string;
      itemName?: string;
      actions?: { label: string; action: string }[];
      scheduleFor?: Date;
    }
  ): Promise<Notification | null> {
    const notification: Notification = {
      id: generateId(),
      type,
      title,
      body,
      priority: options?.priority || 'normal',
      itemId: options?.itemId,
      itemName: options?.itemName,
      actions: options?.actions,
      createdAt: new Date(),
      scheduledFor: options?.scheduleFor,
      delivered: false,
      dismissed: false
    };

    this.notifications.set(notification.id, notification);

    // If scheduled for later, don't deliver now
    if (options?.scheduleFor && options.scheduleFor > new Date()) {
      this.saveNotifications();
      return notification;
    }

    // Deliver notification
    await this.deliverNotification(notification);
    return notification;
  }

  /**
   * Actually deliver the notification
   */
  private async deliverNotification(notification: Notification): Promise<boolean> {
    if (!this.canSendNotification()) {
      return false;
    }

    // Send browser notification if permission granted
    if (this.permissionGranted && 'Notification' in window) {
      try {
        const browserNotif = new Notification(notification.title, {
          body: notification.body,
          icon: '/icons/inventory-notification.png',
          badge: '/icons/badge.png',
          tag: notification.id,
          requireInteraction: notification.priority === 'urgent'
        });

        browserNotif.onclick = () => {
          window.focus();
          // Could navigate to relevant item/section
        };
      } catch (error) {
        console.error('Failed to send browser notification:', error);
      }
    }

    // Update notification state
    notification.delivered = true;
    notification.deliveredAt = new Date();
    this.notificationsToday++;
    this.saveNotifications();

    return true;
  }

  /**
   * Start periodic notification checks
   */
  public startNotificationChecks(intervalMinutes: number = 30): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Run immediately
    this.checkForNotifications();

    // Then run periodically
    this.checkInterval = setInterval(() => {
      this.checkForNotifications();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop periodic checks
   */
  public stopNotificationChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check for and send due notifications
   */
  public async checkForNotifications(): Promise<void> {
    await this.checkExpiryAlerts();
    await this.checkDepletionAlerts();
    await this.deliverScheduledNotifications();
  }

  /**
   * Check for expiry alerts
   */
  private async checkExpiryAlerts(): Promise<void> {
    if (!this.preferences.expiryWarnings) return;

    const alerts = expiryPreventionService.getActiveAlerts();
    const now = new Date();

    for (const alert of alerts) {
      // Check if we already sent a notification for this alert
      const existingNotif = Array.from(this.notifications.values()).find(
        n => n.itemId === alert.itemId &&
             n.type.startsWith('expiry_') &&
             !n.dismissed &&
             n.deliveredAt &&
             (now.getTime() - n.deliveredAt.getTime()) < 12 * 60 * 60 * 1000 // Within 12 hours
      );

      if (existingNotif) continue;

      const hoursUntilExpiry = alert.daysUntilExpiry * 24;

      if (alert.alertType === 'expired') {
        await this.sendNotification(
          'expiry_critical',
          `${alert.itemName} has expired`,
          'Check if it\'s still safe to use or dispose of it.',
          {
            priority: 'urgent',
            itemId: alert.itemId,
            itemName: alert.itemName,
            actions: [
              { label: 'View Item', action: 'view' },
              { label: 'Mark as Waste', action: 'waste' }
            ]
          }
        );
      } else if (hoursUntilExpiry <= this.preferences.expiryWarningHours) {
        const priority: NotificationPriority = alert.alertType === 'critical' ? 'high' : 'normal';
        const timeText = alert.daysUntilExpiry <= 1
          ? 'today'
          : `in ${alert.daysUntilExpiry} days`;

        await this.sendNotification(
          alert.alertType === 'critical' ? 'expiry_critical' : 'expiry_warning',
          `${alert.itemName} expires ${timeText}`,
          `Use it soon! ${alert.suggestedActions[0] || ''}`,
          {
            priority,
            itemId: alert.itemId,
            itemName: alert.itemName,
            actions: [
              { label: 'View Suggestions', action: 'suggestions' },
              { label: 'Dismiss', action: 'dismiss' }
            ]
          }
        );
      }
    }
  }

  /**
   * Check for depletion alerts
   */
  private async checkDepletionAlerts(): Promise<void> {
    if (!this.preferences.depletionAlerts) return;

    const depletions = predictiveAnalyticsService.getUpcomingDepletions(
      this.preferences.depletionAlertDays
    );
    const now = new Date();

    for (const prediction of depletions) {
      // Check if we already sent a notification for this item
      const existingNotif = Array.from(this.notifications.values()).find(
        n => n.itemId === prediction.itemId &&
             n.type === 'depletion_alert' &&
             !n.dismissed &&
             n.deliveredAt &&
             (now.getTime() - n.deliveredAt.getTime()) < 24 * 60 * 60 * 1000 // Within 24 hours
      );

      if (existingNotif) continue;

      const daysUntilDepletion = Math.ceil(
        (prediction.predictedDepletionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      await this.sendNotification(
        'depletion_alert',
        `Running low on items`,
        `Based on your usage, you'll run out of some items in ${daysUntilDepletion} days.`,
        {
          priority: daysUntilDepletion <= 1 ? 'high' : 'normal',
          itemId: prediction.itemId,
          actions: [
            { label: 'View Shopping List', action: 'shopping' },
            { label: 'Dismiss', action: 'dismiss' }
          ]
        }
      );

      // Only send one depletion alert per check to avoid flooding
      break;
    }
  }

  /**
   * Deliver scheduled notifications that are due
   */
  private async deliverScheduledNotifications(): Promise<void> {
    const now = new Date();

    for (const notification of this.notifications.values()) {
      if (notification.scheduledFor &&
          notification.scheduledFor <= now &&
          !notification.delivered) {
        await this.deliverNotification(notification);
      }
    }
  }

  /**
   * Create a shopping reminder notification
   */
  public async createShoppingReminder(
    items: ShoppingListItem[],
    scheduleFor?: Date
  ): Promise<Notification | null> {
    if (!this.preferences.shoppingReminders) return null;

    const urgentItems = items.filter(i => i.priority === 'urgent' || i.priority === 'high');
    const itemCount = items.length;
    const urgentCount = urgentItems.length;

    let body = `You have ${itemCount} items on your shopping list.`;
    if (urgentCount > 0) {
      body += ` ${urgentCount} need attention soon.`;
    }

    return this.sendNotification(
      'shopping_reminder',
      'Shopping List Reminder',
      body,
      {
        priority: urgentCount > 0 ? 'high' : 'normal',
        scheduleFor,
        actions: [
          { label: 'View List', action: 'shopping' },
          { label: 'Dismiss', action: 'dismiss' }
        ]
      }
    );
  }

  /**
   * Create a leftover reminder
   */
  public async createLeftoverReminder(
    itemName: string,
    itemId: string,
    daysUntilExpiry: number
  ): Promise<Notification | null> {
    if (!this.preferences.leftoverReminders) return null;

    return this.sendNotification(
      'leftover_reminder',
      'Use your leftovers!',
      `${itemName} should be consumed within ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}.`,
      {
        priority: daysUntilExpiry <= 1 ? 'high' : 'normal',
        itemId,
        itemName,
        actions: [
          { label: 'View Suggestions', action: 'suggestions' },
          { label: 'Dismiss', action: 'dismiss' }
        ]
      }
    );
  }

  /**
   * Dismiss a notification
   */
  public dismissNotification(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);
    if (!notification) return false;

    notification.dismissed = true;
    notification.dismissedAt = new Date();
    this.saveNotifications();
    return true;
  }

  /**
   * Get all active (undelivered or undismissed) notifications
   */
  public getActiveNotifications(): Notification[] {
    return Array.from(this.notifications.values())
      .filter(n => !n.dismissed)
      .sort((a, b) => {
        // Priority order
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // Then by date (newest first)
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  /**
   * Get notification history
   */
  public getNotificationHistory(limit: number = 50): Notification[] {
    return Array.from(this.notifications.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Update preferences
   */
  public updatePreferences(updates: Partial<NotificationPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    this.savePreferences();
  }

  /**
   * Get current preferences
   */
  public getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Get notification statistics
   */
  public getStats(): {
    totalSent: number;
    sentToday: number;
    dismissed: number;
    active: number;
    byType: Record<string, number>;
  } {
    this.resetDailyCount();

    const all = Array.from(this.notifications.values());
    const byType: Record<string, number> = {};

    all.forEach(n => {
      if (n.delivered) {
        byType[n.type] = (byType[n.type] || 0) + 1;
      }
    });

    return {
      totalSent: all.filter(n => n.delivered).length,
      sentToday: this.notificationsToday,
      dismissed: all.filter(n => n.dismissed).length,
      active: all.filter(n => !n.dismissed && n.delivered).length,
      byType
    };
  }

  /**
   * Clear all notifications
   */
  public clearAll(): void {
    this.notifications.clear();
    localStorage.removeItem('meal_assistant_notifications');
  }
}

// Export singleton instance
export const inventoryNotificationService = new InventoryNotificationService();
