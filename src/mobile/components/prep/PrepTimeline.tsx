import React from 'react';
import { View, Text, StyleSheet, ScrollView, ViewStyle } from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { ProgressBar } from '../base/ProgressBar';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { PrepTask } from '../../types';

export interface PrepTimelineProps {
  tasks: PrepTask[];
  currentTaskId?: string;
  totalDuration: number;
  elapsedTime: number;
  onTaskPress?: (taskId: string) => void;
}

export const PrepTimeline: React.FC<PrepTimelineProps> = ({
  tasks,
  currentTaskId,
  totalDuration,
  elapsedTime,
  onTaskPress,
}) => {
  const getTaskStatusColor = (status: PrepTask['status']): string => {
    switch (status) {
      case 'completed':
        return colors.success;
      case 'in-progress':
        return colors.warning;
      case 'pending':
        return colors.border.medium;
    }
  };

  const getTaskStatusIcon = (status: PrepTask['status']): string => {
    switch (status) {
      case 'completed':
        return '\u2713';
      case 'in-progress':
        return '\u25B6';
      case 'pending':
        return '';
    }
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const progress = (completedTasks / tasks.length) * 100;

  return (
    <View style={styles.container}>
      {/* Progress Header */}
      <Card variant="elevated" style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Prep Progress</Text>
          <Text style={styles.progressTime}>
            {formatTime(elapsedTime)} / {formatTime(totalDuration)}
          </Text>
        </View>
        <ProgressBar
          progress={progress}
          showPercentage
          height={10}
          color={colors.primary.main}
        />
        <View style={styles.progressStats}>
          <Text style={styles.progressStat}>
            {completedTasks}/{tasks.length} tasks complete
          </Text>
          <Text style={styles.progressStat}>
            ~{formatTime(totalDuration - elapsedTime)} remaining
          </Text>
        </View>
      </Card>

      {/* Timeline */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {tasks.map((task, index) => {
          const isActive = task.id === currentTaskId;
          const statusColor = getTaskStatusColor(task.status);

          return (
            <View key={task.id} style={styles.timelineItem}>
              {/* Timeline Line */}
              <View style={styles.timelineTrack}>
                {index > 0 && (
                  <View
                    style={[
                      styles.timelineLine,
                      styles.timelineLineTop,
                      tasks[index - 1].status === 'completed' && styles.timelineLineComplete,
                    ]}
                  />
                )}
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: statusColor },
                    isActive && styles.timelineDotActive,
                  ]}
                >
                  <Text style={styles.timelineDotText}>
                    {getTaskStatusIcon(task.status)}
                  </Text>
                </View>
                {index < tasks.length - 1 && (
                  <View
                    style={[
                      styles.timelineLine,
                      styles.timelineLineBottom,
                      task.status === 'completed' && styles.timelineLineComplete,
                    ]}
                  />
                )}
              </View>

              {/* Task Card */}
              <Card
                onPress={() => onTaskPress?.(task.id)}
                variant={isActive ? 'elevated' : 'outlined'}
                style={[
                  styles.taskCard,
                  isActive && styles.taskCardActive,
                  task.status === 'completed' && styles.taskCardComplete,
                ] as ViewStyle}
              >
                <View style={styles.taskHeader}>
                  <Text
                    style={[
                      styles.taskTitle,
                      task.status === 'completed' && styles.taskTitleComplete,
                    ]}
                  >
                    {task.title}
                  </Text>
                  <Badge
                    text={formatTime(task.duration)}
                    size="small"
                    customColor={statusColor}
                  />
                </View>

                <Text
                  style={[
                    styles.taskDescription,
                    task.status === 'completed' && styles.taskDescriptionComplete,
                  ]}
                  numberOfLines={2}
                >
                  {task.description}
                </Text>

                {/* Equipment */}
                {task.equipment.length > 0 && (
                  <View style={styles.taskEquipment}>
                    <Text style={styles.taskEquipmentLabel}>Equipment:</Text>
                    <Text style={styles.taskEquipmentList}>
                      {task.equipment.join(', ')}
                    </Text>
                  </View>
                )}

                {/* Parallel Group Indicator */}
                {task.parallelGroup && (
                  <View style={styles.parallelIndicator}>
                    <Text style={styles.parallelIcon}>{'\u2194'}</Text>
                    <Text style={styles.parallelText}>
                      Can run with other tasks
                    </Text>
                  </View>
                )}
              </Card>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressCard: {
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  progressTime: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  progressStat: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  timelineTrack: {
    width: 40,
    alignItems: 'center',
  },
  timelineLine: {
    width: 2,
    backgroundColor: colors.border.light,
  },
  timelineLineTop: {
    height: 20,
  },
  timelineLineBottom: {
    flex: 1,
    minHeight: 20,
  },
  timelineLineComplete: {
    backgroundColor: colors.success,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotActive: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.warning,
    backgroundColor: colors.text.inverse,
  },
  timelineDotText: {
    color: colors.text.inverse,
    fontSize: 12,
    fontWeight: '600',
  },
  taskCard: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  taskCardActive: {
    borderColor: colors.warning,
    borderWidth: 2,
  },
  taskCardComplete: {
    opacity: 0.7,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  taskTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  taskTitleComplete: {
    textDecorationLine: 'line-through',
    color: colors.text.secondary,
  },
  taskDescription: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  taskDescriptionComplete: {
    color: colors.text.disabled,
  },
  taskEquipment: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  taskEquipmentLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  taskEquipmentList: {
    ...typography.caption,
    color: colors.text.primary,
    flex: 1,
  },
  parallelIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  parallelIcon: {
    fontSize: 12,
    marginRight: spacing.xs,
    color: colors.info,
  },
  parallelText: {
    ...typography.caption,
    color: colors.info,
  },
});
