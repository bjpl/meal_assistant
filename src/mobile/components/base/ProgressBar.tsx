import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

export interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  color?: string;
  backgroundColor?: string;
  height?: number;
  style?: ViewStyle;
  segments?: { value: number; color: string; label?: string }[];
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  showPercentage = false,
  color = colors.primary.main,
  backgroundColor = colors.background.tertiary,
  height = 8,
  style,
  segments,
}) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  const getProgressColor = () => {
    if (clampedProgress >= 100) return colors.success;
    if (clampedProgress >= 80) return colors.primary.main;
    if (clampedProgress >= 50) return colors.warning;
    return color;
  };

  return (
    <View style={[styles.container, style]}>
      {(label || showPercentage) && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          {showPercentage && (
            <Text style={styles.percentage}>{Math.round(clampedProgress)}%</Text>
          )}
        </View>
      )}
      <View
        style={[
          styles.track,
          { backgroundColor, height, borderRadius: height / 2 },
        ]}
      >
        {segments ? (
          // Render segmented progress bar
          <View style={styles.segmentContainer}>
            {segments.map((segment, index) => (
              <View
                key={index}
                style={[
                  styles.segment,
                  {
                    width: `${segment.value}%`,
                    backgroundColor: segment.color,
                    borderTopLeftRadius: index === 0 ? height / 2 : 0,
                    borderBottomLeftRadius: index === 0 ? height / 2 : 0,
                    borderTopRightRadius:
                      index === segments.length - 1 ? height / 2 : 0,
                    borderBottomRightRadius:
                      index === segments.length - 1 ? height / 2 : 0,
                  },
                ]}
              />
            ))}
          </View>
        ) : (
          // Render simple progress bar
          <View
            style={[
              styles.fill,
              {
                width: `${clampedProgress}%`,
                backgroundColor: getProgressColor(),
                height,
                borderRadius: height / 2,
              },
            ]}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  percentage: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  segmentContainer: {
    flexDirection: 'row',
    height: '100%',
  },
  segment: {
    height: '100%',
  },
});
