import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { Button } from '../base/Button';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { PrepTask } from '../../types';

interface TaskCardProps {
  task: PrepTask;
  onPress?: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
  isCurrentTask?: boolean;
  showActions?: boolean;
  variant?: 'compact' | 'detailed';
}

const statusColors = {
  pending: colors.text.disabled,
  'in-progress': colors.warning,
  completed: colors.success,
};

const statusIcons = {
  pending: '\u{1F55B}',
  'in-progress': '\u{1F3C3}',
  completed: '\u2713',
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onPress,
  onComplete,
  onSkip,
  isCurrentTask = false,
  showActions = false,
  variant = 'compact',
}) => {
  const getStatusBadge = () => {
    return (
      <Badge
        text={task.status.replace('-', ' ')}
        customColor={statusColors[task.status]}
        size="small"
      />
    );
  };

  if (variant === 'compact') {
    return (
      <TouchableOpacity onPress={onPress} disabled={!onPress}>
        <Card
          variant={isCurrentTask ? 'elevated' : 'outlined'}
          style={StyleSheet.flatten([
            styles.compactCard,
            task.status === 'completed' && styles.completedCard,
            isCurrentTask && styles.currentCard,
          ])}
        >
          <View style={styles.compactRow}>
            {/* Status Icon */}
            <View
              style={[
                styles.statusIcon,
                { backgroundColor: statusColors[task.status] + '20' },
              ]}
            >
              <Text style={[styles.statusIconText, { color: statusColors[task.status] }]}>
                {statusIcons[task.status]}
              </Text>
            </View>

            {/* Task Info */}
            <View style={styles.compactInfo}>
              <Text
                style={[
                  styles.compactTitle,
                  task.status === 'completed' && styles.completedText,
                ]}
                numberOfLines={1}
              >
                {task.title}
              </Text>
              <View style={styles.compactMeta}>
                <Text style={styles.compactDuration}>{task.duration} min</Text>
                {task.equipment.length > 0 && (
                  <Text style={styles.compactEquipment} numberOfLines={1}>
                    {task.equipment.join(', ')}
                  </Text>
                )}
              </View>
            </View>

            {/* Checkbox */}
            {onComplete && task.status !== 'completed' && (
              <TouchableOpacity
                onPress={onComplete}
                style={styles.checkbox}
              >
                <Text style={styles.checkboxText}>{'\u25CB'}</Text>
              </TouchableOpacity>
            )}
            {task.status === 'completed' && (
              <View style={styles.completedCheckbox}>
                <Text style={styles.completedCheckboxText}>{'\u2713'}</Text>
              </View>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  }

  return (
    <Card
      onPress={onPress}
      variant={isCurrentTask ? 'elevated' : 'outlined'}
      accentColor={isCurrentTask ? colors.warning : undefined}
      style={StyleSheet.flatten([
        styles.detailedCard,
        task.status === 'completed' && styles.completedCard,
        isCurrentTask && styles.currentCard,
      ])}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {isCurrentTask && (
            <Text style={styles.currentLabel}>NOW</Text>
          )}
          <Text style={styles.order}>Step {task.order}</Text>
        </View>
        {getStatusBadge()}
      </View>

      {/* Title */}
      <Text
        style={[
          styles.title,
          task.status === 'completed' && styles.completedText,
        ]}
      >
        {task.title}
      </Text>

      {/* Description */}
      <Text style={styles.description}>{task.description}</Text>

      {/* Meta Info */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>{'\u23F1'}</Text>
          <Text style={styles.metaText}>{task.duration} minutes</Text>
        </View>
        {task.parallelGroup && (
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>{'\u2194'}</Text>
            <Text style={styles.metaText}>Can run parallel</Text>
          </View>
        )}
      </View>

      {/* Equipment */}
      {task.equipment.length > 0 && (
        <View style={styles.equipmentSection}>
          <Text style={styles.equipmentLabel}>Equipment:</Text>
          <View style={styles.equipmentList}>
            {task.equipment.map((eq, index) => (
              <Badge
                key={index}
                text={eq}
                size="small"
                variant="info"
                style={styles.equipmentBadge}
              />
            ))}
          </View>
        </View>
      )}

      {/* Dependencies */}
      {task.dependencies.length > 0 && (
        <View style={styles.dependencyNote}>
          <Text style={styles.dependencyIcon}>{'\u26A0'}</Text>
          <Text style={styles.dependencyText}>
            Requires completion of previous steps
          </Text>
        </View>
      )}

      {/* Actions */}
      {showActions && task.status !== 'completed' && (
        <View style={styles.actions}>
          {onSkip && (
            <Button
              title="Skip"
              onPress={onSkip}
              variant="ghost"
              size="small"
            />
          )}
          {onComplete && (
            <Button
              title="Mark Complete"
              onPress={onComplete}
              size="small"
              style={styles.completeButton}
            />
          )}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  compactCard: {
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  completedCard: {
    opacity: 0.7,
  },
  currentCard: {
    borderColor: colors.warning,
    borderWidth: 2,
    backgroundColor: colors.warning + '10',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  statusIconText: {
    fontSize: 18,
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: colors.text.secondary,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  compactDuration: {
    ...typography.caption,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  compactEquipment: {
    ...typography.caption,
    color: colors.text.disabled,
    flex: 1,
  },
  checkbox: {
    padding: spacing.xs,
  },
  checkboxText: {
    fontSize: 24,
    color: colors.border.medium,
  },
  completedCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedCheckboxText: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  detailedCard: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  currentLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.warning,
    letterSpacing: 1,
  },
  order: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  equipmentSection: {
    marginBottom: spacing.sm,
  },
  equipmentLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  equipmentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  equipmentBadge: {
    marginBottom: spacing.xs,
  },
  dependencyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  dependencyIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  dependencyText: {
    ...typography.caption,
    color: colors.warning,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.sm,
  },
  completeButton: {
    minWidth: 120,
  },
});
