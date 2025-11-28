import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Badge } from '../components/base/Badge';
import { PrepTimeline } from '../components/prep/PrepTimeline';
import { EquipmentStatus } from '../components/prep/EquipmentStatus';
import { colors, spacing, typography } from '../utils/theme';
import { PrepTask, Equipment, PrepSession } from '../types';

// Sample data
const sampleEquipment: Equipment[] = [
  { id: '1', name: 'Stovetop', status: 'available', icon: '\u{1F373}' },
  { id: '2', name: 'Oven', status: 'in-use', icon: '\u{1F3ED}', currentTask: 'Roasting vegetables' },
  { id: '3', name: 'Rice Cooker', status: 'in-use', icon: '\u{1F35A}', currentTask: 'Cooking rice' },
  { id: '4', name: 'Cutting Board', status: 'available', icon: '\u{1F52A}' },
  { id: '5', name: 'Blender', status: 'available', icon: '\u{1F964}' },
  { id: '6', name: 'Instant Pot', status: 'dirty', icon: '\u{1F372}' },
];

const sampleTasks: PrepTask[] = [
  {
    id: '1',
    title: 'Prep vegetables',
    description: 'Wash and chop bell peppers, broccoli, and carrots for roasting',
    duration: 15,
    equipment: ['Cutting Board', 'Knife'],
    ingredientIds: ['veg-1', 'veg-2', 'veg-3'],
    dependencies: [],
    status: 'completed',
    order: 1,
  },
  {
    id: '2',
    title: 'Start rice cooker',
    description: 'Rinse 2 cups basmati rice and add to rice cooker with 2.5 cups water',
    duration: 5,
    equipment: ['Rice Cooker'],
    ingredientIds: ['rice-1'],
    dependencies: [],
    status: 'completed',
    order: 2,
    parallelGroup: 'A',
  },
  {
    id: '3',
    title: 'Roast vegetables',
    description: 'Toss vegetables with olive oil, salt, and pepper. Roast at 425F for 25 minutes',
    duration: 30,
    equipment: ['Oven', 'Baking Sheet'],
    ingredientIds: ['veg-1', 'veg-2', 'veg-3', 'oil-1'],
    dependencies: ['1'],
    status: 'in-progress',
    order: 3,
    parallelGroup: 'A',
  },
  {
    id: '4',
    title: 'Season chicken',
    description: 'Pat dry chicken breasts, season with salt, pepper, garlic powder, and paprika',
    duration: 10,
    equipment: ['Cutting Board'],
    ingredientIds: ['chicken-1'],
    dependencies: [],
    status: 'pending',
    order: 4,
  },
  {
    id: '5',
    title: 'Grill chicken',
    description: 'Grill chicken breasts 6-7 minutes per side until internal temp reaches 165F',
    duration: 20,
    equipment: ['Stovetop', 'Grill Pan'],
    ingredientIds: ['chicken-1'],
    dependencies: ['4'],
    status: 'pending',
    order: 5,
  },
  {
    id: '6',
    title: 'Prepare sauce',
    description: 'Mix Greek yogurt, lemon juice, garlic, and herbs for dipping sauce',
    duration: 5,
    equipment: ['Mixing Bowl'],
    ingredientIds: ['yogurt-1', 'lemon-1'],
    dependencies: [],
    status: 'pending',
    order: 6,
    parallelGroup: 'B',
  },
  {
    id: '7',
    title: 'Plate and portion',
    description: 'Divide rice, vegetables, and chicken into 4 meal prep containers',
    duration: 10,
    equipment: ['Meal Prep Containers'],
    ingredientIds: [],
    dependencies: ['2', '3', '5'],
    status: 'pending',
    order: 7,
  },
];

export const PrepScreen: React.FC = () => {
  const [tasks, setTasks] = useState<PrepTask[]>(sampleTasks);
  const [equipment, setEquipment] = useState<Equipment[]>(sampleEquipment);
  const [isActive, setIsActive] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(25);
  const [currentTaskId, setCurrentTaskId] = useState('3');

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

  const handleCompleteTask = (taskId: string) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, status: 'completed' } : task
      )
    );

    // Find next pending task
    const currentIndex = tasks.findIndex(t => t.id === taskId);
    const nextTask = tasks.find((t, i) => i > currentIndex && t.status === 'pending');
    if (nextTask) {
      setCurrentTaskId(nextTask.id);
      setTasks(prev =>
        prev.map(task =>
          task.id === nextTask.id ? { ...task, status: 'in-progress' } : task
        )
      );
    }
  };

  const handleStartSession = () => {
    setIsActive(true);
    const firstPending = tasks.find(t => t.status === 'pending');
    if (firstPending) {
      setCurrentTaskId(firstPending.id);
      setTasks(prev =>
        prev.map(task =>
          task.id === firstPending.id ? { ...task, status: 'in-progress' } : task
        )
      );
    }
  };

  const handlePauseSession = () => {
    setIsActive(false);
  };

  const handleEndSession = () => {
    Alert.alert(
      'End Prep Session',
      'Are you sure you want to end this prep session? Any incomplete tasks will be marked as pending.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: () => {
            setIsActive(false);
            setTasks(prev =>
              prev.map(task =>
                task.status === 'in-progress' ? { ...task, status: 'pending' } : task
              )
            );
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
                onPress={() => {}}
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
              onPress={() => {}}
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
