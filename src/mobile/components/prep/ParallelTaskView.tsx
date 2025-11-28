import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { ProgressBar } from '../base/ProgressBar';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { PrepTask } from '../../types';

interface ParallelTaskViewProps {
  tasks: PrepTask[];
  currentTime: number; // minutes elapsed
  onTaskPress?: (taskId: string) => void;
}

interface TimeSlot {
  startTime: number;
  endTime: number;
  tasks: PrepTask[];
}

export const ParallelTaskView: React.FC<ParallelTaskViewProps> = ({
  tasks,
  currentTime,
  onTaskPress,
}) => {
  // Calculate time slots for visualization
  const calculateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    let time = 0;

    // Group tasks by parallel group or sequential order
    const taskGroups: PrepTask[][] = [];
    let currentGroup: PrepTask[] = [];
    let currentParallelGroup: string | undefined = undefined;

    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);

    sortedTasks.forEach((task) => {
      if (task.parallelGroup) {
        if (task.parallelGroup === currentParallelGroup) {
          currentGroup.push(task);
        } else {
          if (currentGroup.length > 0) {
            taskGroups.push(currentGroup);
          }
          currentGroup = [task];
          currentParallelGroup = task.parallelGroup;
        }
      } else {
        if (currentGroup.length > 0) {
          taskGroups.push(currentGroup);
        }
        taskGroups.push([task]);
        currentGroup = [];
        currentParallelGroup = undefined;
      }
    });

    if (currentGroup.length > 0) {
      taskGroups.push(currentGroup);
    }

    // Calculate time slots
    taskGroups.forEach((group) => {
      const maxDuration = Math.max(...group.map((t) => t.duration));
      slots.push({
        startTime: time,
        endTime: time + maxDuration,
        tasks: group,
      });
      time += maxDuration;
    });

    return slots;
  };

  const timeSlots = calculateTimeSlots();
  const totalDuration = timeSlots.length > 0
    ? timeSlots[timeSlots.length - 1].endTime
    : 0;

  const getTaskProgress = (task: PrepTask, slotStartTime: number): number => {
    if (task.status === 'completed') return 100;
    if (task.status === 'pending') return 0;

    const taskElapsed = currentTime - slotStartTime;
    if (taskElapsed <= 0) return 0;
    return Math.min(100, (taskElapsed / task.duration) * 100);
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getTaskColor = (task: PrepTask): string => {
    switch (task.status) {
      case 'completed':
        return colors.success;
      case 'in-progress':
        return colors.warning;
      default:
        return colors.info;
    }
  };

  return (
    <Card variant="outlined" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Timeline View</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>Done</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
            <Text style={styles.legendText}>Active</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
            <Text style={styles.legendText}>Pending</Text>
          </View>
        </View>
      </View>

      {/* Progress indicator */}
      <View style={styles.progressSection}>
        <ProgressBar
          progress={(currentTime / totalDuration) * 100}
          height={6}
          color={colors.primary.main}
        />
        <View style={styles.timeLabels}>
          <Text style={styles.timeLabel}>0m</Text>
          <Text style={styles.currentTime}>Now: {formatTime(currentTime)}</Text>
          <Text style={styles.timeLabel}>{formatTime(totalDuration)}</Text>
        </View>
      </View>

      {/* Timeline */}
      <ScrollView style={styles.timelineScroll} showsVerticalScrollIndicator={false}>
        {timeSlots.map((slot, slotIndex) => (
          <View key={slotIndex} style={styles.timeSlot}>
            {/* Time marker */}
            <View style={styles.timeMarker}>
              <Text style={styles.timeMarkerText}>{formatTime(slot.startTime)}</Text>
              <View style={styles.timeMarkerLine} />
            </View>

            {/* Tasks in this slot */}
            <View style={styles.slotTasks}>
              {slot.tasks.length > 1 && (
                <Badge
                  text={`${slot.tasks.length} parallel tasks`}
                  size="small"
                  variant="info"
                  style={styles.parallelBadge}
                />
              )}

              {slot.tasks.map((task) => {
                const progress = getTaskProgress(task, slot.startTime);
                const taskColor = getTaskColor(task);

                return (
                  <Card
                    key={task.id}
                    onPress={() => onTaskPress && onTaskPress(task.id)}
                    variant="filled"
                    style={[
                      styles.taskCard,
                      { borderLeftColor: taskColor },
                    ]}
                  >
                    <View style={styles.taskHeader}>
                      <Text
                        style={[
                          styles.taskTitle,
                          task.status === 'completed' && styles.completedText,
                        ]}
                        numberOfLines={1}
                      >
                        {task.title}
                      </Text>
                      <Text style={styles.taskDuration}>
                        {task.duration}m
                      </Text>
                    </View>

                    <ProgressBar
                      progress={progress}
                      height={4}
                      color={taskColor}
                      style={styles.taskProgress}
                    />

                    {task.equipment.length > 0 && (
                      <View style={styles.taskEquipment}>
                        {task.equipment.slice(0, 2).map((eq, i) => (
                          <Text key={i} style={styles.equipmentText}>
                            {eq}
                            {i < Math.min(task.equipment.length, 2) - 1 ? ', ' : ''}
                          </Text>
                        ))}
                        {task.equipment.length > 2 && (
                          <Text style={styles.equipmentMore}>
                            +{task.equipment.length - 2}
                          </Text>
                        )}
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          </View>
        ))}

        {/* End marker */}
        <View style={styles.endMarker}>
          <View style={styles.timeMarker}>
            <Text style={styles.timeMarkerText}>{formatTime(totalDuration)}</Text>
            <View style={styles.timeMarkerLine} />
          </View>
          <View style={styles.endContent}>
            <Text style={styles.endIcon}>{'\u{1F389}'}</Text>
            <Text style={styles.endText}>Complete!</Text>
          </View>
        </View>
      </ScrollView>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {tasks.filter((t) => t.status === 'completed').length}/{tasks.length}
          </Text>
          <Text style={styles.summaryLabel}>Tasks Done</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {formatTime(Math.max(0, totalDuration - currentTime))}
          </Text>
          <Text style={styles.summaryLabel}>Remaining</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {tasks.filter((t) => t.parallelGroup).length > 0 ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.summaryLabel}>Parallel</Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  legendText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  timeLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  currentTime: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary.main,
  },
  timelineScroll: {
    maxHeight: 400,
  },
  timeSlot: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  timeMarker: {
    width: 50,
    alignItems: 'flex-end',
    paddingRight: spacing.sm,
  },
  timeMarkerText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  timeMarkerLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border.light,
    marginTop: spacing.xs,
  },
  slotTasks: {
    flex: 1,
    paddingLeft: spacing.sm,
  },
  parallelBadge: {
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  taskCard: {
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.info,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  taskTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: colors.text.secondary,
  },
  taskDuration: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  taskProgress: {
    marginBottom: spacing.xs,
  },
  taskEquipment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipmentText: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  equipmentMore: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  endMarker: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  endContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.sm,
  },
  endIcon: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  endText: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.success,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginTop: spacing.md,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
});
