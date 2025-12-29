import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Badge } from '../components/base/Badge';
import { PrepTimeline } from '../components/prep/PrepTimeline';
import { EquipmentStatus } from '../components/prep/EquipmentStatus';
import { colors, spacing, typography } from '../utils/theme';
import { PrepTask, Equipment, PrepSession } from '../types';
import { RootState, AppDispatch } from '../store';
import {
  fetchCurrentSession,
  startSessionAsync,
  endSessionAsync,
  completeTask,
  selectCurrentSession,
  selectPrepLoading,
} from '../store/slices/prepSlice';

export const PrepScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const session = useSelector(selectCurrentSession);
  const loading = useSelector(selectPrepLoading);

  const tasks = session?.tasks || [];
  const equipment = session?.equipmentUsed || [];
  const [isActive, setIsActive] = useState(session?.status === 'in-progress');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState(
    tasks.find(t => t.status === 'in-progress')?.id || ''
  );

  useEffect(() => {
    dispatch(fetchCurrentSession());
  }, [dispatch]);

  const totalDuration = tasks.reduce((sum, t) => sum + t.duration, 0);
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  // Timer effect
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isActive]);

  const handleCompleteTask = async (taskId: string) => {
    if (!session) return;
    try {
      await dispatch(completeTask({ sessionId: session.id, taskId })).unwrap();

      // Find next pending task
      const currentIndex = tasks.findIndex(t => t.id === taskId);
      const nextTask = tasks.find((t, i) => i > currentIndex && t.status === 'pending');
      if (nextTask) {
        setCurrentTaskId(nextTask.id);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to complete task');
    }
  };

  const handleStartSession = async () => {
    if (!session) return;
    try {
      await dispatch(startSessionAsync({
        date: session.date,
        patternId: session.patternId,
        tasks: session.tasks,
        totalDuration: session.totalDuration,
        equipmentUsed: session.equipmentUsed,
      })).unwrap();
      setIsActive(true);
      const firstPending = tasks.find(t => t.status === 'pending');
      if (firstPending) {
        setCurrentTaskId(firstPending.id);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start session');
    }
  };

  const handlePauseSession = () => {
    setIsActive(false);
  };

  const handleSkipTask = useCallback((taskId: string) => {
    if (!session) return;
    Alert.alert(
      'Skip Task',
      'Are you sure you want to skip this task? You can come back to it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: async () => {
            // Find next pending task
            const currentIndex = tasks.findIndex(t => t.id === taskId);
            const nextTask = tasks.find((t, i) => i > currentIndex && t.status === 'pending');
            if (nextTask) {
              setCurrentTaskId(nextTask.id);
            }
          },
        },
      ]
    );
  }, [session, tasks]);

  const handleViewPreparedMeals = useCallback(() => {
    // Navigate to inventory or show prepared meals
    Alert.alert(
      'Prepared Meals',
      'Your prepped meals are stored in the Kitchen inventory. Would you like to view them?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'View Kitchen',
          onPress: () => (navigation as any).navigate?.('Kitchen'),
        },
      ]
    );
  }, [navigation]);

  const handleEndSession = () => {
    if (!session) return;
    Alert.alert(
      'End Prep Session',
      'Are you sure you want to end this prep session? Any incomplete tasks will be marked as pending.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(endSessionAsync(session.id)).unwrap();
              setIsActive(false);
            } catch (error) {
              Alert.alert('Error', 'Failed to end session');
            }
          },
        },
      ]
    );
  };

  const currentTask = tasks.find(t => t.id === currentTaskId);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Meal Prep</Text>
            <Text style={styles.subtitle}>Sunday batch cooking session</Text>
          </View>
          <Badge
            text={isActive ? 'Active' : 'Paused'}
            variant={isActive ? 'success' : 'warning'}
          />
        </View>

        {/* Current Task Highlight */}
        {currentTask && isActive && (
          <Card variant="elevated" style={styles.currentTaskCard} accentColor={colors.warning}>
            <View style={styles.currentTaskHeader}>
              <Text style={styles.currentTaskLabel}>NOW</Text>
              <Text style={styles.currentTaskDuration}>{currentTask.duration} min</Text>
            </View>
            <Text style={styles.currentTaskTitle}>{currentTask.title}</Text>
            <Text style={styles.currentTaskDescription}>{currentTask.description}</Text>

            {currentTask.equipment.length > 0 && (
              <View style={styles.currentTaskEquipment}>
                <Text style={styles.equipmentLabel}>Using: </Text>
                {currentTask.equipment.map((eq, i) => (
                  <Badge
                    key={eq}
                    text={eq}
                    size="small"
                    variant="info"
                    style={{ marginRight: spacing.xs }}
                  />
                ))}
              </View>
            )}

            <View style={styles.currentTaskActions}>
              <Button
                title="Mark Complete"
                onPress={() => handleCompleteTask(currentTask.id)}
                style={{ flex: 1 }}
              />
              <Button
                title="Skip"
                onPress={() => handleSkipTask(currentTask.id)}
                variant="outline"
                style={{ marginLeft: spacing.sm }}
              />
            </View>
          </Card>
        )}

        {/* Session Controls */}
        <View style={styles.sessionControls}>
          {!isActive ? (
            <Button
              title="Start Session"
              onPress={handleStartSession}
              fullWidth
              icon={<Text style={styles.controlIcon}>{'\u25B6'}</Text>}
            />
          ) : (
            <View style={styles.controlRow}>
              <Button
                title="Pause"
                onPress={handlePauseSession}
                variant="outline"
                style={{ flex: 1 }}
                icon={<Text style={styles.controlIcon}>{'\u23F8'}</Text>}
              />
              <Button
                title="End Session"
                onPress={handleEndSession}
                variant="secondary"
                style={{ flex: 1, marginLeft: spacing.sm }}
                icon={<Text style={styles.controlIcon}>{'\u23F9'}</Text>}
              />
            </View>
          )}
        </View>

        {/* Equipment Status */}
        <View style={styles.section}>
          <EquipmentStatus
            equipment={equipment}
            onEquipmentPress={(id) => console.log('Equipment pressed:', id)}
          />
        </View>

        {/* Parallel Tasks Notice */}
        {tasks.some(t => t.parallelGroup && t.status !== 'completed') && (
          <Card variant="filled" style={styles.parallelNotice}>
            <Text style={styles.parallelIcon}>{'\u2194'}</Text>
            <View style={styles.parallelContent}>
              <Text style={styles.parallelTitle}>Parallel Tasks Available</Text>
              <Text style={styles.parallelText}>
                Some tasks can run simultaneously to save time
              </Text>
            </View>
          </Card>
        )}

        {/* Task Timeline */}
        <View style={styles.section}>
          <PrepTimeline
            tasks={tasks}
            currentTaskId={currentTaskId}
            totalDuration={totalDuration}
            elapsedTime={elapsedTime}
            onTaskPress={(taskId) => {
              const task = tasks.find(t => t.id === taskId);
              if (task?.status === 'pending') {
                Alert.alert(
                  task.title,
                  `${task.description}\n\nDuration: ${task.duration} minutes\nEquipment: ${task.equipment.join(', ') || 'None'}`,
                  [{ text: 'OK' }]
                );
              }
            }}
          />
        </View>

        {/* Completion Summary */}
        {completedTasks === tasks.length && (
          <Card variant="elevated" style={styles.completionCard}>
            <Text style={styles.completionIcon}>{'\u{1F389}'}</Text>
            <Text style={styles.completionTitle}>All Done!</Text>
            <Text style={styles.completionText}>
              You completed your meal prep in {elapsedTime} minutes.
              {'\n'}Great job getting ahead for the week!
            </Text>
            <Button
              title="View Prepared Meals"
              onPress={handleViewPreparedMeals}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        <View style={styles.bottomSpacer} />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  currentTaskCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.warning + '10',
  },
  currentTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  currentTaskLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.warning,
    letterSpacing: 1,
  },
  currentTaskDuration: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  currentTaskTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  currentTaskDescription: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  currentTaskEquipment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  equipmentLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  currentTaskActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.md,
  },
  sessionControls: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  controlRow: {
    flexDirection: 'row',
  },
  controlIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.md,
  },
  parallelNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.sm,
  },
  parallelIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
    color: colors.info,
  },
  parallelContent: {
    flex: 1,
  },
  parallelTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  parallelText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  completionCard: {
    marginHorizontal: spacing.md,
    alignItems: 'center',
    padding: spacing.lg,
  },
  completionIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  completionTitle: {
    ...typography.h2,
    color: colors.success,
    marginBottom: spacing.xs,
  },
  completionText: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});
