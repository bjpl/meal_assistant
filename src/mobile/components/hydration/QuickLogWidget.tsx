import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Card } from '../base/Card';
import { ProgressBar } from '../base/ProgressBar';
import { logWater, selectHydrationProgress } from '../../store/slices/hydrationSlice';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { RootState } from '../../store';

export interface QuickLogWidgetProps {
  style?: ViewStyle;
  onPress?: () => void;
  compact?: boolean;
}

const QUICK_AMOUNTS = [
  { oz: 8, icon: '\u{1F964}' },
  { oz: 16, icon: '\u{1F95B}' },
];

export const QuickLogWidget: React.FC<QuickLogWidgetProps> = ({
  style,
  onPress,
  compact = false,
}) => {
  const dispatch = useDispatch();
  const { waterToday, goal } = useSelector(
    (state: RootState) => state.hydration
  );
  const progress = useSelector((state: RootState) =>
    selectHydrationProgress(state)
  );

  const handleQuickAdd = (oz: number) => {
    dispatch(logWater(oz));
  };

  const remainingOz = Math.max(0, goal.daily_water_oz - waterToday);

  if (compact) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <Card variant="outlined" style={[styles.compactContainer, style]}>
          <View style={styles.compactHeader}>
            <Text style={styles.compactIcon}>{'\u{1F4A7}'}</Text>
            <View style={styles.compactInfo}>
              <Text style={styles.compactTitle}>Hydration</Text>
              <Text style={styles.compactProgress}>
                {waterToday} / {goal.daily_water_oz} oz
              </Text>
            </View>
            <Text style={styles.compactPercent}>{progress.percent_of_goal}%</Text>
          </View>
          <ProgressBar
            progress={progress.percent_of_goal}
            color={colors.info}
            height={6}
          />
        </Card>
      </TouchableOpacity>
    );
  }

  return (
    <Card
      variant="elevated"
      style={[styles.container, style]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{'\u{1F4A7}'}</Text>
          <Text style={styles.title}>Hydration</Text>
        </View>
        <Text style={styles.percentage}>{progress.percent_of_goal}%</Text>
      </View>

      <ProgressBar
        progress={progress.percent_of_goal}
        color={colors.info}
        height={10}
        style={styles.progressBar}
      />

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{waterToday}</Text>
          <Text style={styles.statLabel}>oz today</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{remainingOz}</Text>
          <Text style={styles.statLabel}>oz to go</Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        {QUICK_AMOUNTS.map((amount) => (
          <TouchableOpacity
            key={amount.oz}
            style={styles.quickButton}
            onPress={() => handleQuickAdd(amount.oz)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickIcon}>{amount.icon}</Text>
            <Text style={styles.quickLabel}>+{amount.oz}oz</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  compactContainer: {
    padding: spacing.sm,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  compactIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  compactProgress: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  compactPercent: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.info,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  percentage: {
    ...typography.h2,
    color: colors.info,
    fontWeight: '700',
  },
  progressBar: {
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border.light,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.info + '15',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.info + '30',
  },
  quickIcon: {
    fontSize: 18,
    marginRight: spacing.xs,
  },
  quickLabel: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.info,
  },
});

export default QuickLogWidget;
