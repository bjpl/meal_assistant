import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, spacing, typography } from '../../utils/theme';

export interface HydrationGoalRingProps {
  progress: number; // 0-100+
  currentOz: number;
  goalOz: number;
  size?: number;
  strokeWidth?: number;
  style?: ViewStyle;
  showMilestones?: boolean;
  animated?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MILESTONES = [25, 50, 75, 100];
const MILESTONE_MESSAGES = {
  25: 'Great start!',
  50: 'Halfway there!',
  75: 'Almost done!',
  100: 'Goal reached!',
};

export const HydrationGoalRing: React.FC<HydrationGoalRingProps> = ({
  progress,
  currentOz,
  goalOz,
  size = 200,
  strokeWidth = 16,
  style,
  showMilestones = true,
  animated = true,
}) => {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const celebrationScale = useRef(new Animated.Value(1)).current;
  const prevProgressRef = useRef(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Clamp progress for display (allow overflow for celebration)
  const displayProgress = Math.min(progress, 100);
  const remainingOz = Math.max(0, goalOz - currentOz);

  // Determine current milestone
  const currentMilestone = MILESTONES.find(
    (m) => progress >= m && prevProgressRef.current < m
  );

  useEffect(() => {
    if (animated) {
      // Animate progress ring
      Animated.timing(animatedProgress, {
        toValue: displayProgress,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      // Celebration animation on milestone
      if (currentMilestone) {
        Animated.sequence([
          Animated.timing(celebrationScale, {
            toValue: 1.1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(celebrationScale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      animatedProgress.setValue(displayProgress);
    }

    prevProgressRef.current = progress;
  }, [progress, displayProgress, animated, currentMilestone]);

  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  const getProgressColor = () => {
    if (progress >= 100) return colors.success;
    if (progress >= 75) return '#4CAF50';
    if (progress >= 50) return colors.info;
    return colors.info;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { width: size, height: size },
        { transform: [{ scale: celebrationScale }] },
        style,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#2196F3" />
            <Stop offset="100%" stopColor="#00BCD4" />
          </LinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.background.tertiary}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${center} ${center})`}
        />

        {/* Milestone markers */}
        {showMilestones &&
          MILESTONES.map((milestone) => {
            const angle = (milestone / 100) * 360 - 90;
            const rad = (angle * Math.PI) / 180;
            const markerRadius = radius + strokeWidth / 2 + 8;
            const x = center + markerRadius * Math.cos(rad);
            const y = center + markerRadius * Math.sin(rad);

            return (
              <Circle
                key={milestone}
                cx={x}
                cy={y}
                r={4}
                fill={progress >= milestone ? getProgressColor() : colors.border.light}
              />
            );
          })}
      </Svg>

      {/* Center content */}
      <View style={styles.centerContent}>
        <Text style={styles.percentage}>{Math.round(progress)}%</Text>
        <Text style={styles.currentAmount}>{currentOz} oz</Text>
        {remainingOz > 0 ? (
          <Text style={styles.remaining}>{remainingOz} oz to go</Text>
        ) : (
          <Text style={[styles.remaining, styles.completed]}>Goal complete!</Text>
        )}
      </View>

      {/* Milestone celebration */}
      {currentMilestone && showMilestones && (
        <View style={styles.milestonePopup}>
          <Text style={styles.milestoneText}>
            {MILESTONE_MESSAGES[currentMilestone as keyof typeof MILESTONE_MESSAGES]}
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentage: {
    ...typography.h1,
    color: colors.info,
    fontWeight: '700',
  },
  currentAmount: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  remaining: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  completed: {
    color: colors.success,
    fontWeight: '600',
  },
  milestonePopup: {
    position: 'absolute',
    bottom: -spacing.lg,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.lg,
  },
  milestoneText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '600',
  },
});

export default HydrationGoalRing;
