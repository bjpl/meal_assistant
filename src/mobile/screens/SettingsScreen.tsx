/**
 * Settings Screen
 * Account settings, preferences, and app configuration
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Input } from '../components/base/Input';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import { RootState, AppDispatch } from '../store';
import {
  updateProfile,
  logout,
  selectUser,
  selectIsAuthenticated,
} from '../store/slices/userSlice';
import {
  areNotificationsEnabled,
  setNotificationsEnabled,
  getNotificationSchedule,
  updateNotificationSchedule,
  MealReminder,
} from '../services/notificationService';

interface SettingsScreenProps {
  navigation?: any;
}

type ThemeOption = 'light' | 'dark' | 'system';
type UnitOption = 'imperial' | 'metric';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // Profile state
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Preferences state
  const [theme, setTheme] = useState<ThemeOption>('system');
  const [units, setUnits] = useState<UnitOption>('imperial');
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [mealReminders, setMealReminders] = useState<MealReminder[]>([]);

  // UI state
  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load notification settings
      const enabled = await areNotificationsEnabled();
      setNotificationsOn(enabled);

      const schedule = await getNotificationSchedule();
      setMealReminders(schedule.mealReminders);

      // Load user preferences
      if (user?.preferences) {
        setTheme(user.preferences.theme || 'system');
        setUnits(user.preferences.units || 'imperial');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSettings();
    setRefreshing(false);
  }, []);

  const handleSaveProfile = async () => {
    if (!fullName.trim() || !email.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      await dispatch(
        updateProfile({
          fullName: fullName.trim(),
          email: email.trim(),
        })
      ).unwrap();
      setIsEditingProfile(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsOn(enabled);
    await setNotificationsEnabled(enabled);
  };

  const handleUpdateReminderTime = async (id: string, time: string) => {
    const updatedReminders = mealReminders.map((r) =>
      r.id === id ? { ...r, time } : r
    );
    setMealReminders(updatedReminders);
    await updateNotificationSchedule({ mealReminders: updatedReminders });
  };

  const handleToggleReminder = async (id: string, enabled: boolean) => {
    const updatedReminders = mealReminders.map((r) =>
      r.id === id ? { ...r, enabled } : r
    );
    setMealReminders(updatedReminders);
    await updateNotificationSchedule({ mealReminders: updatedReminders });
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await dispatch(logout());
          navigation?.reset({
            index: 0,
            routes: [{ name: 'Onboarding' }],
          });
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              'Type "DELETE" to confirm account deletion',
              [{ text: 'Cancel', style: 'cancel' }]
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your account and preferences</Text>
      </View>

      {/* Profile Section */}
      <Card variant="outlined" style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Profile</Text>
          {!isEditingProfile && (
            <TouchableOpacity onPress={() => setIsEditingProfile(true)}>
              <Text style={styles.editButton}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {isEditingProfile ? (
          <View style={styles.editForm}>
            <Input
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your name"
              autoCapitalize="words"
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.editActions}>
              <Button
                title="Cancel"
                variant="secondary"
                size="small"
                onPress={() => {
                  setIsEditingProfile(false);
                  setFullName(user?.fullName || '');
                  setEmail(user?.email || '');
                }}
              />
              <Button
                title={isSaving ? 'Saving...' : 'Save'}
                size="small"
                onPress={handleSaveProfile}
                disabled={isSaving}
              />
            </View>
          </View>
        ) : (
          <View style={styles.profileInfo}>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Name</Text>
              <Text style={styles.profileValue}>{user?.fullName || 'Not set'}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Email</Text>
              <Text style={styles.profileValue}>{user?.email || 'Not set'}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Member since</Text>
              <Text style={styles.profileValue}>
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : 'N/A'}
              </Text>
            </View>
          </View>
        )}
      </Card>

      {/* Notifications Section */}
      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Enable Notifications</Text>
            <Text style={styles.settingDescription}>
              Receive meal reminders and updates
            </Text>
          </View>
          <Switch
            value={notificationsOn}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: colors.border, true: colors.primary.main }}
          />
        </View>

        {notificationsOn && (
          <View style={styles.remindersSection}>
            <Text style={styles.remindersTitle}>Meal Reminders</Text>
            {mealReminders.map((reminder) => (
              <View key={reminder.id} style={styles.reminderRow}>
                <View style={styles.reminderInfo}>
                  <Text style={styles.reminderType}>
                    {reminder.type.charAt(0).toUpperCase() + reminder.type.slice(1)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      // Show time picker - simplified for now
                      Alert.prompt(
                        'Set Time',
                        'Enter time in HH:MM format',
                        (time) => {
                          if (time && /^\d{2}:\d{2}$/.test(time)) {
                            handleUpdateReminderTime(reminder.id, time);
                          }
                        },
                        'plain-text',
                        reminder.time
                      );
                    }}
                  >
                    <Text style={styles.reminderTime}>{reminder.time}</Text>
                  </TouchableOpacity>
                </View>
                <Switch
                  value={reminder.enabled}
                  onValueChange={(enabled) =>
                    handleToggleReminder(reminder.id, enabled)
                  }
                  trackColor={{ false: colors.border, true: colors.primary.main }}
                />
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Appearance Section */}
      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Theme</Text>
            <Text style={styles.settingDescription}>Choose app appearance</Text>
          </View>
          <View style={styles.themeOptions}>
            {(['light', 'dark', 'system'] as ThemeOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.themeOption,
                  theme === option && styles.themeOptionSelected,
                ]}
                onPress={() => setTheme(option)}
              >
                <Text
                  style={[
                    styles.themeOptionText,
                    theme === option && styles.themeOptionTextSelected,
                  ]}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Units</Text>
            <Text style={styles.settingDescription}>
              Weight and measurement units
            </Text>
          </View>
          <View style={styles.unitOptions}>
            {(['imperial', 'metric'] as UnitOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.unitOption,
                  units === option && styles.unitOptionSelected,
                ]}
                onPress={() => setUnits(option)}
              >
                <Text
                  style={[
                    styles.unitOptionText,
                    units === option && styles.unitOptionTextSelected,
                  ]}
                >
                  {option === 'imperial' ? 'lbs/oz' : 'kg/g'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Card>

      {/* Data & Privacy Section */}
      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>Data & Privacy</Text>

        <TouchableOpacity style={styles.linkRow}>
          <Text style={styles.linkText}>Export My Data</Text>
          <Text style={styles.linkArrow}>&gt;</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow}>
          <Text style={styles.linkText}>Privacy Policy</Text>
          <Text style={styles.linkArrow}>&gt;</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow}>
          <Text style={styles.linkText}>Terms of Service</Text>
          <Text style={styles.linkArrow}>&gt;</Text>
        </TouchableOpacity>
      </Card>

      {/* Account Actions */}
      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <Button
          title="Change Password"
          variant="secondary"
          onPress={() => navigation?.navigate('ChangePassword')}
          style={styles.accountButton}
        />

        <Button
          title="Logout"
          variant="secondary"
          onPress={handleLogout}
          style={styles.accountButton}
        />

        <Button
          title="Delete Account"
          variant="ghost"
          onPress={handleDeleteAccount}
          style={[styles.accountButton, styles.deleteButton]}
        />
      </Card>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appVersion}>Meal Assistant v1.0.0</Text>
        <Text style={styles.appCopyright}>Built with care for healthy eating</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  editButton: {
    ...typography.body2,
    color: colors.primary.main,
    fontWeight: '600',
  },
  editForm: {
    gap: spacing.sm,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  profileInfo: {
    gap: spacing.sm,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  profileLabel: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  profileValue: {
    ...typography.body2,
    color: colors.text.primary,
    fontWeight: '500',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    ...typography.body1,
    color: colors.text.primary,
    fontWeight: '500',
  },
  settingDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  remindersSection: {
    marginTop: spacing.md,
  },
  remindersTitle: {
    ...typography.body2,
    color: colors.text.secondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  reminderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  reminderType: {
    ...typography.body2,
    color: colors.text.primary,
    width: 80,
  },
  reminderTime: {
    ...typography.body2,
    color: colors.primary.main,
    fontWeight: '600',
  },
  themeOptions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  themeOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeOptionSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  themeOptionText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  themeOptionTextSelected: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  unitOptions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  unitOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitOptionSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  unitOptionText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  unitOptionTextSelected: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkText: {
    ...typography.body1,
    color: colors.text.primary,
  },
  linkArrow: {
    ...typography.body1,
    color: colors.text.disabled,
  },
  accountButton: {
    marginBottom: spacing.sm,
  },
  deleteButton: {
    marginTop: spacing.md,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  appVersion: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  appCopyright: {
    ...typography.caption,
    color: colors.text.disabled,
    marginTop: spacing.xs,
  },
});

export default SettingsScreen;
