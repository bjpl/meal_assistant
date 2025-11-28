import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HydrationTracker } from '../components/hydration/HydrationTracker';
import { CaffeineMonitor } from '../components/hydration/CaffeineMonitor';
import { HydrationTrends } from '../components/hydration/HydrationTrends';
import { colors, spacing, typography, borderRadius } from '../utils/theme';

type Tab = 'tracker' | 'caffeine' | 'trends';

export const HydrationScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('tracker');

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'tracker', label: 'Water', icon: '\u{1F4A7}' },
    { id: 'caffeine', label: 'Caffeine', icon: '\u{2615}' },
    { id: 'trends', label: 'Trends', icon: '\u{1F4CA}' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'tracker':
        return (
          <HydrationTracker
            onNavigateToCaffeine={() => setActiveTab('caffeine')}
          />
        );
      case 'caffeine':
        return (
          <CaffeineMonitor
            onBack={() => setActiveTab('tracker')}
          />
        );
      case 'trends':
        return <HydrationTrends />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Hydration</Text>
        <Text style={styles.subtitle}>Track water and caffeine intake</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.id && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.info + '20',
    borderWidth: 1,
    borderColor: colors.info,
  },
  tabIcon: {
    fontSize: 18,
  },
  tabLabel: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tabLabelActive: {
    color: colors.info,
  },
  content: {
    flex: 1,
  },
});

export default HydrationScreen;
