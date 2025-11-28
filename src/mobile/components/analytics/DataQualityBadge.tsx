import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';
import { DataQualityLevel, DATA_QUALITY_THRESHOLDS } from '../../types/analytics.types';

interface DataQualityBadgeProps {
  level: DataQualityLevel;
  pointsCount: number;
  pointsNeeded?: number;
  showCount?: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

const QUALITY_CONFIG: Record<DataQualityLevel, {
  label: string;
  color: string;
  icon: string;
  description: string;
}> = {
  insufficient: {
    label: 'Insufficient',
    color: colors.error,
    icon: '\u26A0',
    description: 'Not enough data for reliable analysis',
  },
  emerging: {
    label: 'Emerging',
    color: colors.warning,
    icon: '\u{1F331}',
    description: 'Building confidence, more data helps',
  },
  reliable: {
    label: 'Reliable',
    color: colors.info,
    icon: '\u2713',
    description: 'Good data quality for analysis',
  },
  mature: {
    label: 'Mature',
    color: colors.success,
    icon: '\u2605',
    description: 'Excellent data quality with predictions',
  },
};

export const DataQualityBadge: React.FC<DataQualityBadgeProps> = ({
  level,
  pointsCount,
  pointsNeeded = 0,
  showCount = true,
  size = 'medium',
  style,
}) => {
  const config = QUALITY_CONFIG[level];

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: 2,
          paddingHorizontal: spacing.xs,
          fontSize: 10,
          iconSize: 10,
        };
      case 'large':
        return {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          fontSize: 14,
          iconSize: 16,
        };
      default:
        return {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          fontSize: 12,
          iconSize: 14,
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
            backgroundColor: config.color + '15',
            borderColor: config.color + '40',
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
          },
        ]}
      >
        <Text style={[styles.icon, { fontSize: sizeStyles.iconSize }]}>
          {config.icon}
        </Text>
        <Text
          style={[
            styles.label,
            { fontSize: sizeStyles.fontSize, color: config.color },
          ]}
        >
          {config.label}
        </Text>
        {showCount && (
          <Text
            style={[
              styles.count,
              { fontSize: sizeStyles.fontSize - 2, color: config.color },
            ]}
          >
            ({pointsCount} pts)
          </Text>
        )}
      </View>
      {level === 'insufficient' && pointsNeeded > 0 && (
        <Text style={styles.hint}>
          Need {pointsNeeded} more price points
        </Text>
      )}
    </View>
  );
};

interface DataQualityIndicatorProps {
  level: DataQualityLevel;
  pointsCount: number;
  style?: ViewStyle;
}

export const DataQualityIndicator: React.FC<DataQualityIndicatorProps> = ({
  level,
  pointsCount,
  style,
}) => {
  const config = QUALITY_CONFIG[level];
  const maxPoints = DATA_QUALITY_THRESHOLDS.mature;
  const percentage = Math.min((pointsCount / maxPoints) * 100, 100);

  return (
    <View style={[styles.indicatorContainer, style]}>
      <View style={styles.indicatorHeader}>
        <Text style={styles.indicatorLabel}>Data Quality</Text>
        <Text style={[styles.indicatorStatus, { color: config.color }]}>
          {config.label}
        </Text>
      </View>
      <View style={styles.indicatorTrack}>
        <View
          style={[
            styles.indicatorFill,
            { width: `${percentage}%`, backgroundColor: config.color },
          ]}
        />
        {/* Threshold markers */}
        <View style={[styles.marker, { left: `${(5 / maxPoints) * 100}%` }]} />
        <View style={[styles.marker, { left: `${(10 / maxPoints) * 100}%` }]} />
        <View style={[styles.marker, { left: `${(20 / maxPoints) * 100}%` }]} />
      </View>
      <View style={styles.indicatorLabels}>
        <Text style={styles.indicatorLabelText}>0</Text>
        <Text style={styles.indicatorLabelText}>{maxPoints}+ points</Text>
      </View>
      <Text style={styles.indicatorDescription}>{config.description}</Text>
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
    borderWidth: 1,
  },
  icon: {
    marginRight: spacing.xs,
  },
  label: {
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  count: {
    marginLeft: spacing.xs,
    opacity: 0.8,
  },
  hint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  indicatorContainer: {
    width: '100%',
  },
  indicatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  indicatorLabel: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  indicatorStatus: {
    ...typography.body2,
    fontWeight: '600',
  },
  indicatorTrack: {
    height: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  indicatorFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.background.primary,
  },
  indicatorLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  indicatorLabelText: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 10,
  },
  indicatorDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
