import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Vibration,
} from 'react-native';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { ProgressBar } from '../base/ProgressBar';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';

interface TimerWidgetProps {
  initialSeconds?: number;
  taskName?: string;
  onComplete?: () => void;
  onCancel?: () => void;
  autoStart?: boolean;
  showControls?: boolean;
  variant?: 'compact' | 'full';
}

export const TimerWidget: React.FC<TimerWidgetProps> = ({
  initialSeconds = 300,
  taskName,
  onComplete,
  onCancel,
  autoStart = false,
  showControls = true,
  variant = 'full',
}) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isPaused, setIsPaused] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const progress = ((initialSeconds - seconds) / initialSeconds) * 100;
  const isComplete = seconds <= 0;
  const isWarning = seconds > 0 && seconds <= 30;

  useEffect(() => {
    if (isRunning && !isPaused && seconds > 0) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            Vibration.vibrate([0, 500, 200, 500, 200, 500]);
            if (onComplete) onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, isPaused]);

  useEffect(() => {
    if (isWarning && isRunning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isWarning, isRunning]);

  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleReset = () => {
    setSeconds(initialSeconds);
    setIsRunning(false);
    setIsPaused(false);
  };

  const handleCancel = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (onCancel) onCancel();
  };

  const addTime = (extraSeconds: number) => {
    setSeconds((prev) => prev + extraSeconds);
  };

  const getTimerColor = (): string => {
    if (isComplete) return colors.success;
    if (isWarning) return colors.error;
    return colors.primary.main;
  };

  if (variant === 'compact') {
    return (
      <Card
        variant="filled"
        style={[
          styles.compactCard,
          isWarning && styles.warningCard,
          isComplete && styles.completeCard,
        ]}
      >
        <View style={styles.compactRow}>
          <View style={styles.compactInfo}>
            {taskName && (
              <Text style={styles.compactTaskName} numberOfLines={1}>
                {taskName}
              </Text>
            )}
            <Text style={[styles.compactTime, { color: getTimerColor() }]}>
              {formatTime(seconds)}
            </Text>
          </View>
          {!isComplete && showControls && (
            <Button
              title={!isRunning ? '\u25B6' : isPaused ? '\u25B6' : '\u23F8'}
              onPress={!isRunning ? handleStart : isPaused ? handleResume : handlePause}
              variant="ghost"
              size="small"
            />
          )}
          {isComplete && (
            <Text style={styles.completeIcon}>{'\u2713'}</Text>
          )}
        </View>
        <ProgressBar
          progress={progress}
          height={4}
          color={getTimerColor()}
        />
      </Card>
    );
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      <Card
        variant="elevated"
        style={[
          styles.card,
          isWarning && styles.warningCard,
          isComplete && styles.completeCard,
        ]}
      >
        {/* Task Name */}
        {taskName && (
          <Text style={styles.taskName}>{taskName}</Text>
        )}

        {/* Timer Display */}
        <View style={styles.timerContainer}>
          <Text style={[styles.timerText, { color: getTimerColor() }]}>
            {formatTime(seconds)}
          </Text>
          {isComplete && (
            <Text style={styles.completeText}>Time's Up!</Text>
          )}
          {isWarning && !isComplete && (
            <Text style={styles.warningText}>Almost done!</Text>
          )}
        </View>

        {/* Progress */}
        <ProgressBar
          progress={progress}
          height={8}
          color={getTimerColor()}
          style={styles.progressBar}
        />

        {/* Quick Add Time */}
        {isRunning && !isComplete && (
          <View style={styles.quickAddRow}>
            <Text style={styles.quickAddLabel}>Add time:</Text>
            {[30, 60, 300].map((secs) => (
              <Button
                key={secs}
                title={`+${secs >= 60 ? `${secs / 60}m` : `${secs}s`}`}
                onPress={() => addTime(secs)}
                variant="outline"
                size="small"
                style={styles.quickAddButton}
              />
            ))}
          </View>
        )}

        {/* Controls */}
        {showControls && (
          <View style={styles.controls}>
            {!isRunning && !isComplete && (
              <Button
                title="Start"
                onPress={handleStart}
                icon={<Text style={styles.buttonIcon}>{'\u25B6'}</Text>}
                fullWidth
              />
            )}

            {isRunning && !isPaused && !isComplete && (
              <View style={styles.runningControls}>
                <Button
                  title="Pause"
                  onPress={handlePause}
                  variant="outline"
                  style={styles.controlButton}
                  icon={<Text style={styles.buttonIcon}>{'\u23F8'}</Text>}
                />
                <Button
                  title="Cancel"
                  onPress={handleCancel}
                  variant="ghost"
                  style={styles.controlButton}
                />
              </View>
            )}

            {isPaused && !isComplete && (
              <View style={styles.pausedControls}>
                <Button
                  title="Resume"
                  onPress={handleResume}
                  style={styles.controlButton}
                  icon={<Text style={styles.buttonIcon}>{'\u25B6'}</Text>}
                />
                <Button
                  title="Reset"
                  onPress={handleReset}
                  variant="outline"
                  style={styles.controlButton}
                />
              </View>
            )}

            {isComplete && (
              <View style={styles.completeControls}>
                <Button
                  title="Done"
                  onPress={onComplete}
                  style={styles.controlButton}
                />
                <Button
                  title="Reset"
                  onPress={handleReset}
                  variant="outline"
                  style={styles.controlButton}
                />
              </View>
            )}
          </View>
        )}
      </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  card: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  warningCard: {
    backgroundColor: colors.error + '10',
    borderColor: colors.error,
  },
  completeCard: {
    backgroundColor: colors.success + '10',
    borderColor: colors.success,
  },
  taskName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  timerText: {
    fontSize: 56,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  warningText: {
    ...typography.body2,
    color: colors.error,
    marginTop: spacing.xs,
  },
  completeText: {
    ...typography.body2,
    color: colors.success,
    marginTop: spacing.xs,
  },
  progressBar: {
    width: '100%',
    marginBottom: spacing.md,
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  quickAddLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  quickAddButton: {
    paddingHorizontal: spacing.sm,
  },
  controls: {
    width: '100%',
  },
  runningControls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pausedControls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  completeControls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlButton: {
    flex: 1,
  },
  buttonIcon: {
    marginRight: spacing.xs,
  },
  compactCard: {
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  compactInfo: {
    flex: 1,
  },
  compactTaskName: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  compactTime: {
    ...typography.h3,
    fontVariant: ['tabular-nums'],
  },
  completeIcon: {
    fontSize: 24,
    color: colors.success,
  },
});
