import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { IconButton } from '../base/IconButton';
import { HydrationGoalRing } from './HydrationGoalRing';
import {
  logWater,
  undoLastEntry,
  deleteEntry,
  selectHydrationProgress,
} from '../../store/slices/hydrationSlice';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { RootState } from '../../store';
import { HydrationLog } from '../../types';

// Quick-add amount options in oz
const QUICK_ADD_AMOUNTS = [
  { oz: 8, label: '8 oz', icon: '\u{1F964}', description: 'Cup' },
  { oz: 16, label: '16 oz', icon: '\u{1F95B}', description: 'Bottle' },
  { oz: 24, label: '24 oz', icon: '\u{1F4A7}', description: 'Large' },
  { oz: 32, label: '32 oz', icon: '\u{1FAD9}', description: 'Quart' },
];

export interface HydrationTrackerProps {
  onNavigateToCaffeine?: () => void;
}

export const HydrationTracker: React.FC<HydrationTrackerProps> = ({
  onNavigateToCaffeine,
}) => {
  const dispatch = useDispatch();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  const { todayLogs, waterToday, goal } = useSelector(
    (state: RootState) => state.hydration
  );
  const progress = useSelector((state: RootState) =>
    selectHydrationProgress(state)
  );

  const handleQuickAdd = (oz: number) => {
    dispatch(logWater(oz));
  };

  const handleCustomAdd = () => {
    const amount = parseInt(customAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid number of ounces.');
      return;
    }
    dispatch(logWater(amount));
    setCustomAmount('');
    setShowCustomInput(false);
  };

  const handleUndo = () => {
    if (todayLogs.length === 0) {
      Alert.alert('Nothing to Undo', 'No entries logged today.');
      return;
    }
    dispatch(undoLastEntry());
  };

  const handleDeleteEntry = (id: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => dispatch(deleteEntry(id)),
        },
      ]
    );
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
      water: '\u{1F4A7}',
      coffee: '\u{2615}',
      tea: '\u{1F375}',
      soda: '\u{1F964}',
      energy_drink: '\u{26A1}',
      juice: '\u{1F34A}',
      other: '\u{1F37A}',
    };
    return icons[type] || '\u{1F4A7}';
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Progress Ring */}
      <View style={styles.progressSection}>
        <HydrationGoalRing
          progress={progress.percent_of_goal}
          currentOz={waterToday}
          goalOz={goal.daily_water_oz}
          size={220}
          animated
        />
      </View>

      {/* Quick Add Buttons */}
      <Card variant="outlined" style={styles.quickAddCard}>
        <Text style={styles.sectionTitle}>Quick Add Water</Text>
        <View style={styles.quickAddGrid}>
          {QUICK_ADD_AMOUNTS.map((amount) => (
            <TouchableOpacity
              key={amount.oz}
              style={styles.quickAddButton}
              onPress={() => handleQuickAdd(amount.oz)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickAddIcon}>{amount.icon}</Text>
              <Text style={styles.quickAddLabel}>{amount.label}</Text>
              <Text style={styles.quickAddDesc}>{amount.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Amount */}
        {showCustomInput ? (
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customInput}
              value={customAmount}
              onChangeText={setCustomAmount}
              placeholder="Enter oz"
              keyboardType="number-pad"
              autoFocus
            />
            <Button
              title="Add"
              onPress={handleCustomAdd}
              size="small"
              style={styles.customAddButton}
            />
            <IconButton
              icon={'\u{2715}'}
              onPress={() => setShowCustomInput(false)}
              variant="ghost"
              size="small"
            />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.customButton}
            onPress={() => setShowCustomInput(true)}
          >
            <Text style={styles.customButtonText}>+ Custom Amount</Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <Button
          title="Undo Last"
          onPress={handleUndo}
          variant="secondary"
          size="small"
          icon={<Text style={styles.buttonIcon}>{'\u{21A9}'}</Text>}
          style={styles.actionButton}
          disabled={todayLogs.length === 0}
        />
        {onNavigateToCaffeine && (
          <Button
            title="Log Caffeine"
            onPress={onNavigateToCaffeine}
            variant="secondary"
            size="small"
            icon={<Text style={styles.buttonIcon}>{'\u{2615}'}</Text>}
            style={styles.actionButton}
          />
        )}
      </View>

      {/* Today's History */}
      <Card variant="filled" style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Today's Log</Text>
          <Text style={styles.entryCount}>{todayLogs.length} entries</Text>
        </View>

        {todayLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\u{1F4A7}'}</Text>
            <Text style={styles.emptyText}>No entries yet today</Text>
            <Text style={styles.emptySubtext}>
              Tap a button above to log your first drink!
            </Text>
          </View>
        ) : (
          todayLogs.slice(0, 10).map((log: HydrationLog) => (
            <View key={log.id} style={styles.logEntry}>
              <Text style={styles.logIcon}>{getBeverageIcon(log.type)}</Text>
              <View style={styles.logContent}>
                <Text style={styles.logAmount}>{log.amount_oz} oz</Text>
                <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
              </View>
              {log.caffeine_mg > 0 && (
                <Text style={styles.logCaffeine}>{log.caffeine_mg}mg</Text>
              )}
              <IconButton
                icon={'\u{1F5D1}'}
                onPress={() => handleDeleteEntry(log.id)}
                variant="ghost"
                size="small"
              />
            </View>
          ))
        )}

        {todayLogs.length > 10 && (
          <Text style={styles.moreEntries}>
            + {todayLogs.length - 10} more entries
          </Text>
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
  progressSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingTop: spacing.xl,
  },
  quickAddCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  quickAddGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  quickAddButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginHorizontal: spacing.xs,
    backgroundColor: colors.info + '15',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.info + '30',
  },
  quickAddIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  quickAddLabel: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.info,
  },
  quickAddDesc: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  customButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  customButtonText: {
    ...typography.body2,
    color: colors.info,
    fontWeight: '600',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  customInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    ...typography.body1,
  },
  customAddButton: {
    marginRight: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  buttonIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  historyCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  entryCount: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
    opacity: 0.5,
  },
  emptyText: {
    ...typography.body1,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'center',
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  logIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  logContent: {
    flex: 1,
  },
  logAmount: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  logTime: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  logCaffeine: {
    ...typography.caption,
    color: colors.patterns.G, // Brown for caffeine
    marginRight: spacing.sm,
    fontWeight: '600',
  },
  moreEntries: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingTop: spacing.sm,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});

export default HydrationTracker;
