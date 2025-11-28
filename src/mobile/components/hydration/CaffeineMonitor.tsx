import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { ProgressBar } from '../base/ProgressBar';
import { Badge } from '../base/Badge';
import {
  logCaffeine,
  selectHydrationProgress,
  selectRemainingCaffeine,
} from '../../store/slices/hydrationSlice';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { RootState } from '../../store';
import { BeverageType, CAFFEINE_CONTENT, BEVERAGE_LABELS, HydrationLog } from '../../types';

// Beverage options with caffeine content
const BEVERAGE_OPTIONS: Array<{
  type: BeverageType;
  icon: string;
  defaultOz: number;
  caffeinePerServing: number;
}> = [
  { type: 'coffee', icon: '\u{2615}', defaultOz: 8, caffeinePerServing: 95 },
  { type: 'tea', icon: '\u{1F375}', defaultOz: 8, caffeinePerServing: 47 },
  { type: 'soda', icon: '\u{1F964}', defaultOz: 12, caffeinePerServing: 30 },
  { type: 'energy_drink', icon: '\u{26A1}', defaultOz: 8, caffeinePerServing: 150 },
];

const VOLUME_OPTIONS = [
  { oz: 8, label: 'Small (8oz)' },
  { oz: 12, label: 'Medium (12oz)' },
  { oz: 16, label: 'Large (16oz)' },
  { oz: 20, label: 'XL (20oz)' },
];

export interface CaffeineMonitorProps {
  onBack?: () => void;
}

export const CaffeineMonitor: React.FC<CaffeineMonitorProps> = ({ onBack }) => {
  const dispatch = useDispatch();
  const [selectedBeverage, setSelectedBeverage] = useState<BeverageType | null>(null);
  const [selectedVolume, setSelectedVolume] = useState<number>(8);

  const { caffeineToday, goal, todayLogs } = useSelector(
    (state: RootState) => state.hydration
  );
  const progress = useSelector((state: RootState) =>
    selectHydrationProgress(state)
  );
  const remainingCaffeine = useSelector((state: RootState) =>
    selectRemainingCaffeine(state)
  );

  // Filter caffeine entries only
  const caffeineEntries = todayLogs.filter(
    (log: HydrationLog) => log.caffeine_mg > 0
  );

  const calculateCaffeine = (type: BeverageType, oz: number): number => {
    const basePerOz: Record<BeverageType, number> = {
      coffee: 95 / 8,
      tea: 47 / 8,
      soda: 30 / 12,
      energy_drink: 150 / 8,
      water: 0,
      juice: 0,
      other: 0,
    };
    return Math.round((basePerOz[type] || 0) * oz);
  };

  const handleLogCaffeine = () => {
    if (!selectedBeverage) {
      Alert.alert('Select Beverage', 'Please select a beverage type first.');
      return;
    }

    const caffeineMg = calculateCaffeine(selectedBeverage, selectedVolume);

    // Check if this would exceed the limit
    if (caffeineMg > remainingCaffeine) {
      Alert.alert(
        'Caffeine Warning',
        `This drink contains ${caffeineMg}mg of caffeine, which would exceed your daily limit by ${caffeineMg - remainingCaffeine}mg. Log anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log Anyway',
            style: 'destructive',
            onPress: () => {
              dispatch(
                logCaffeine({
                  beverage_type: selectedBeverage,
                  volume_oz: selectedVolume,
                  caffeine_mg: caffeineMg,
                })
              );
              setSelectedBeverage(null);
            },
          },
        ]
      );
      return;
    }

    // Check if approaching limit
    if (caffeineToday + caffeineMg >= goal.caffeine_warning_mg) {
      Alert.alert(
        'Approaching Limit',
        `After this drink, you'll have ${caffeineToday + caffeineMg}mg of caffeine (${goal.daily_caffeine_limit_mg - caffeineToday - caffeineMg}mg remaining).`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log',
            onPress: () => {
              dispatch(
                logCaffeine({
                  beverage_type: selectedBeverage,
                  volume_oz: selectedVolume,
                  caffeine_mg: caffeineMg,
                })
              );
              setSelectedBeverage(null);
            },
          },
        ]
      );
      return;
    }

    dispatch(
      logCaffeine({
        beverage_type: selectedBeverage,
        volume_oz: selectedVolume,
        caffeine_mg: caffeineMg,
      })
    );
    setSelectedBeverage(null);
  };

  const getStatusColor = () => {
    if (progress.caffeine_status === 'limit') return colors.error;
    if (progress.caffeine_status === 'warning') return colors.warning;
    return colors.patterns.G; // Brown for caffeine
  };

  const getStatusText = () => {
    if (progress.caffeine_status === 'limit') return 'Limit Reached';
    if (progress.caffeine_status === 'warning') return 'Approaching Limit';
    return 'Safe';
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getBeverageIcon = (type: string) => {
    const icons: Record<string, string> = {
      coffee: '\u{2615}',
      tea: '\u{1F375}',
      soda: '\u{1F964}',
      energy_drink: '\u{26A1}',
    };
    return icons[type] || '\u{2615}';
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header with Back */}
      {onBack && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backIcon}>{'\u{2190}'}</Text>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Caffeine Status Card */}
      <Card variant="elevated" style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusIcon}>{'\u{2615}'}</Text>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>Caffeine Today</Text>
            <Badge
              text={getStatusText()}
              customColor={getStatusColor()}
              size="small"
            />
          </View>
        </View>

        <View style={styles.statusNumbers}>
          <Text style={[styles.caffeineAmount, { color: getStatusColor() }]}>
            {caffeineToday}
          </Text>
          <Text style={styles.caffeineUnit}>
            / {goal.daily_caffeine_limit_mg} mg
          </Text>
        </View>

        <ProgressBar
          progress={(caffeineToday / goal.daily_caffeine_limit_mg) * 100}
          color={getStatusColor()}
          height={12}
          style={styles.caffeineBar}
        />

        {/* Warning threshold indicator */}
        <View style={styles.thresholdIndicator}>
          <View
            style={[
              styles.thresholdLine,
              {
                left: `${(goal.caffeine_warning_mg / goal.daily_caffeine_limit_mg) * 100}%`,
              },
            ]}
          />
          <Text style={styles.thresholdLabel}>
            Warning at {goal.caffeine_warning_mg}mg
          </Text>
        </View>

        <Text style={styles.remainingText}>
          {remainingCaffeine > 0
            ? `${remainingCaffeine}mg remaining today`
            : 'Daily limit reached'}
        </Text>
      </Card>

      {/* Beverage Selection */}
      <Card variant="outlined" style={styles.selectionCard}>
        <Text style={styles.sectionTitle}>Log Caffeine</Text>

        {/* Beverage Type */}
        <Text style={styles.subsectionTitle}>Select Beverage</Text>
        <View style={styles.beverageGrid}>
          {BEVERAGE_OPTIONS.map((beverage) => (
            <TouchableOpacity
              key={beverage.type}
              style={[
                styles.beverageButton,
                selectedBeverage === beverage.type && styles.beverageSelected,
              ]}
              onPress={() => setSelectedBeverage(beverage.type)}
            >
              <Text style={styles.beverageIcon}>{beverage.icon}</Text>
              <Text
                style={[
                  styles.beverageLabel,
                  selectedBeverage === beverage.type && styles.beverageLabelSelected,
                ]}
              >
                {BEVERAGE_LABELS[beverage.type]}
              </Text>
              <Text style={styles.beverageCaffeine}>
                {beverage.caffeinePerServing}mg/{beverage.defaultOz}oz
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Volume Selection */}
        {selectedBeverage && (
          <>
            <Text style={styles.subsectionTitle}>Select Size</Text>
            <View style={styles.volumeRow}>
              {VOLUME_OPTIONS.map((vol) => (
                <TouchableOpacity
                  key={vol.oz}
                  style={[
                    styles.volumeButton,
                    selectedVolume === vol.oz && styles.volumeSelected,
                  ]}
                  onPress={() => setSelectedVolume(vol.oz)}
                >
                  <Text
                    style={[
                      styles.volumeLabel,
                      selectedVolume === vol.oz && styles.volumeLabelSelected,
                    ]}
                  >
                    {vol.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Caffeine Preview */}
            <View style={styles.preview}>
              <Text style={styles.previewLabel}>Caffeine in this drink:</Text>
              <Text style={styles.previewAmount}>
                {calculateCaffeine(selectedBeverage, selectedVolume)}mg
              </Text>
            </View>

            <Button
              title="Log Caffeine"
              onPress={handleLogCaffeine}
              style={styles.logButton}
            />
          </>
        )}
      </Card>

      {/* Today's Caffeine Entries */}
      <Card variant="filled" style={styles.entriesCard}>
        <Text style={styles.sectionTitle}>Today's Caffeine</Text>

        {caffeineEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\u{2615}'}</Text>
            <Text style={styles.emptyText}>No caffeine logged today</Text>
          </View>
        ) : (
          caffeineEntries.map((entry: HydrationLog) => (
            <View key={entry.id} style={styles.entryRow}>
              <Text style={styles.entryIcon}>{getBeverageIcon(entry.type)}</Text>
              <View style={styles.entryContent}>
                <Text style={styles.entryType}>
                  {BEVERAGE_LABELS[entry.type]}
                </Text>
                <Text style={styles.entryTime}>{formatTime(entry.timestamp)}</Text>
              </View>
              <View style={styles.entryAmounts}>
                <Text style={styles.entryCaffeine}>{entry.caffeine_mg}mg</Text>
                <Text style={styles.entryVolume}>{entry.amount_oz}oz</Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: colors.info,
    marginRight: spacing.xs,
  },
  backText: {
    ...typography.body1,
    color: colors.info,
  },
  statusCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  statusNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  caffeineAmount: {
    ...typography.h1,
    fontWeight: '700',
  },
  caffeineUnit: {
    ...typography.body1,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  caffeineBar: {
    marginBottom: spacing.sm,
  },
  thresholdIndicator: {
    position: 'relative',
    height: 20,
    marginBottom: spacing.xs,
  },
  thresholdLine: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: 10,
    backgroundColor: colors.warning,
  },
  thresholdLabel: {
    ...typography.caption,
    color: colors.warning,
    position: 'absolute',
    top: 10,
    left: 0,
  },
  remainingText: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  selectionCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  subsectionTitle: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  beverageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  beverageButton: {
    width: '48%',
    padding: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  beverageSelected: {
    borderColor: colors.patterns.G,
    backgroundColor: colors.patterns.G + '15',
  },
  beverageIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  beverageLabel: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  beverageLabelSelected: {
    color: colors.patterns.G,
  },
  beverageCaffeine: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  volumeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  volumeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  volumeSelected: {
    backgroundColor: colors.patterns.G + '20',
    borderColor: colors.patterns.G,
  },
  volumeLabel: {
    ...typography.caption,
    color: colors.text.primary,
  },
  volumeLabelSelected: {
    color: colors.patterns.G,
    fontWeight: '600',
  },
  preview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  previewLabel: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  previewAmount: {
    ...typography.h3,
    color: colors.patterns.G,
    fontWeight: '700',
  },
  logButton: {
    marginTop: spacing.md,
  },
  entriesCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
    opacity: 0.5,
  },
  emptyText: {
    ...typography.body1,
    color: colors.text.secondary,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  entryIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  entryContent: {
    flex: 1,
  },
  entryType: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  entryTime: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  entryAmounts: {
    alignItems: 'flex-end',
  },
  entryCaffeine: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.patterns.G,
  },
  entryVolume: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});

export default CaffeineMonitor;
