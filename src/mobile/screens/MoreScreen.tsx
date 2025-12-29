import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/base/Card';
import { colors, spacing, typography, borderRadius } from '../utils/theme';

interface MoreScreenProps {
  navigation?: any;
}

interface MenuItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  screen?: string;
  action?: () => void;
}

export const MoreScreen: React.FC<MoreScreenProps> = ({ navigation }) => {
  const menuItems: MenuItem[] = [
    {
      id: 'settings',
      title: 'Settings',
      description: 'Account and app preferences',
      icon: '\u{2699}',
      screen: 'Settings',
    },
    {
      id: 'social-events',
      title: 'Social Events',
      description: 'Plan ahead for special occasions',
      icon: '\u{1F389}',
      screen: 'SocialEvent',
    },
    {
      id: 'price-history',
      title: 'Price History',
      description: 'Track prices and find the best deals',
      icon: '\u{1F4CA}',
      screen: 'PriceHistory',
    },
    {
      id: 'store-optimizer',
      title: 'Store Optimizer',
      description: 'Optimize shopping across multiple stores',
      icon: '\u{1F6D2}',
      screen: 'StoreOptimizer',
    },
  ];

  const handleItemPress = (item: MenuItem) => {
    if (item.screen && navigation) {
      navigation.navigate(item.screen);
    } else if (item.action) {
      item.action();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>More</Text>
          <Text style={styles.subtitle}>Additional features and settings</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
            >
              <Card variant="outlined" style={styles.menuCard}>
                <View style={styles.menuItem}>
                  <View style={styles.iconContainer}>
                    <Text style={styles.menuIcon}>{item.icon}</Text>
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    <Text style={styles.menuDescription}>
                      {item.description}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>{'\u276F'}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Meal Assistant v1.0.0</Text>
          <Text style={styles.appDescription}>
            7-pattern flexible eating system
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    padding: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  menuList: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  menuCard: {
    marginBottom: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.light + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuIcon: {
    fontSize: 24,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },
  menuDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  chevron: {
    fontSize: 18,
    color: colors.text.disabled,
    marginLeft: spacing.sm,
  },
  appInfo: {
    alignItems: 'center',
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  appVersion: {
    ...typography.caption,
    color: colors.text.disabled,
    marginBottom: spacing.xs,
  },
  appDescription: {
    ...typography.caption,
    color: colors.text.disabled,
  },
});
