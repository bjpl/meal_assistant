import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';
import { ConfidenceLevel } from '../../types/ads.types';

export interface ConfidenceIndicatorProps {
  confidence: number; // 0-100
  level?: ConfidenceLevel;
  showPercentage?: boolean;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

const confidenceConfig = {
  high: {
    color: colors.success,
    backgroundColor: colors.success + '20',
    label: 'High confidence',
  },
  medium: {
    color: colors.warning,
    backgroundColor: colors.warning + '20',
    label: 'Suggested - verify',
  },
  low: {
    color: colors.error,
    backgroundColor: colors.error + '20',
    label: 'Please review carefully',
  },
};

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  level,
  showPercentage = true,
  showLabel = false,
  size = 'medium',
  style,
}) => {
  const getLevel = (): ConfidenceLevel => {
    if (level) return level;
    if (confidence >= 70) return 'high';
    if (confidence >= 50) return 'medium';
    return 'low';
  };

  const currentLevel = getLevel();
  const config = confidenceConfig[currentLevel];

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          dotSize: 8,
          fontSize: 10,
          padding: spacing.xs,
          gap: spacing.xs / 2,
        };
      case 'large':
        return {
          dotSize: 16,
          fontSize: 14,
          padding: spacing.sm,
          gap: spacing.sm,
        };
      default:
        return {
          dotSize: 12,
          fontSize: 12,
          padding: spacing.xs,
          gap: spacing.xs,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.badge,
          {
            backgroundColor: config.backgroundColor,
            paddingVertical: sizeStyles.padding,
            paddingHorizontal: sizeStyles.padding * 1.5,
          },
        ]}
      >
        <View
          style={[
            styles.dot,
            {
              width: sizeStyles.dotSize,
              height: sizeStyles.dotSize,
              backgroundColor: config.color,
              marginRight: sizeStyles.gap,
            },
          ]}
        />
        {showPercentage && (
          <Text
            style={[
              styles.percentage,
              {
                color: config.color,
                fontSize: sizeStyles.fontSize,
              },
            ]}
          >
            {Math.round(confidence)}%
          </Text>
        )}
      </View>
      {showLabel && (
        <Text
          style={[
            styles.label,
            {
              color: config.color,
              fontSize: sizeStyles.fontSize - 2,
            },
          ]}
        >
          {config.label}
        </Text>
      )}
    </View>
  );
};

// Horizontal bar variant for detailed view
export const ConfidenceBar: React.FC<{
  confidence: number;
  style?: ViewStyle;
}> = ({ confidence, style }) => {
  const getColor = () => {
    if (confidence >= 70) return colors.success;
    if (confidence >= 50) return colors.warning;
    return colors.error;
  };

  return (
    <View style={[styles.barContainer, style]}>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.min(confidence, 100)}%`,
              backgroundColor: getColor(),
            },
          ]}
        />
      </View>
      <Text style={[styles.barText, { color: getColor() }]}>
        {Math.round(confidence)}%
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  dot: {
    borderRadius: borderRadius.full,
  },
  percentage: {
    fontWeight: '600',
  },
  label: {
    marginTop: spacing.xs / 2,
    fontWeight: '500',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  barFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  barText: {
    ...typography.caption,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
});
