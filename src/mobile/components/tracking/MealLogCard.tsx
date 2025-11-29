import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { StarRating } from '../base/StarRating';
import { ProgressBar } from '../base/ProgressBar';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { MealLog, PatternId } from '../../types';

interface MealLogCardProps {
  log: MealLog;
  onPress?: () => void;
  onLongPress?: () => void;
  variant?: 'compact' | 'detailed';
  showPhoto?: boolean;
}

const mealTypeLabels = {
  morning: 'Breakfast',
  noon: 'Lunch',
  evening: 'Dinner',
  snack: 'Snack',
};

const mealTypeIcons = {
  morning: '\u2600',
  noon: '\u{1F31E}',
  evening: '\u{1F319}',
  snack: '\u{1F34E}',
};

export const MealLogCard: React.FC<MealLogCardProps> = ({
  log,
  onPress,
  onLongPress,
  variant = 'compact',
  showPhoto = true,
}) => {
  const totalCalories = log.components.reduce((sum, c) => sum + c.calories, 0);
  const totalProtein = log.components.reduce((sum, c) => sum + c.protein, 0);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (variant === 'compact') {
    return (
      <Card
        onPress={onPress}
        onLongPress={onLongPress}
        variant="outlined"
        style={styles.compactCard}
      >
        <View style={styles.compactRow}>
          {showPhoto && log.photoUri && (
            <Image
              source={{ uri: log.photoUri }}
              style={styles.compactPhoto}
            />
          )}
          {showPhoto && !log.photoUri && (
            <View style={styles.compactPhotoPlaceholder}>
              <Text style={styles.placeholderIcon}>
                {mealTypeIcons[log.mealType]}
              </Text>
            </View>
          )}

          <View style={styles.compactContent}>
            <View style={styles.compactHeader}>
              <Text style={styles.compactTitle}>
                {mealTypeLabels[log.mealType]}
              </Text>
              <Badge
                text={`Pattern ${log.patternId}`}
                size="small"
                customColor={colors.patterns[log.patternId]}
              />
            </View>
            <Text style={styles.compactTime}>
              {formatDate(log.date)} at {formatTime(log.createdAt)}
            </Text>
            <View style={styles.compactStats}>
              <Text style={styles.compactStat}>
                {totalCalories} cal
              </Text>
              <Text style={styles.compactDivider}>|</Text>
              <Text style={styles.compactStat}>
                {totalProtein}g protein
              </Text>
              <View style={styles.compactRating}>
                <StarRating
                  rating={log.satisfaction}
                  size={14}
                  readOnly
                />
              </View>
            </View>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card
      onPress={onPress}
      onLongPress={onLongPress}
      variant="elevated"
      style={styles.detailedCard}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.mealIcon}>{mealTypeIcons[log.mealType]}</Text>
          <View>
            <Text style={styles.mealTitle}>{mealTypeLabels[log.mealType]}</Text>
            <Text style={styles.mealTime}>
              {formatDate(log.date)} at {formatTime(log.createdAt)}
            </Text>
          </View>
        </View>
        <Badge
          text={`Pattern ${log.patternId}`}
          customColor={colors.patterns[log.patternId]}
        />
      </View>

      {/* Photo */}
      {showPhoto && log.photoUri && (
        <Image source={{ uri: log.photoUri }} style={styles.photo} />
      )}

      {/* Nutrition */}
      <View style={styles.nutritionSection}>
        <View style={styles.nutritionItem}>
          <Text style={styles.nutritionValue}>{totalCalories}</Text>
          <Text style={styles.nutritionLabel}>calories</Text>
        </View>
        <View style={styles.nutritionDivider} />
        <View style={styles.nutritionItem}>
          <Text style={styles.nutritionValue}>{totalProtein}g</Text>
          <Text style={styles.nutritionLabel}>protein</Text>
        </View>
        <View style={styles.nutritionDivider} />
        <View style={styles.nutritionItem}>
          <Text style={styles.nutritionValue}>{log.components.length}</Text>
          <Text style={styles.nutritionLabel}>components</Text>
        </View>
      </View>

      {/* Components List */}
      <View style={styles.componentsSection}>
        <Text style={styles.sectionTitle}>Components</Text>
        {log.components.map((component, index) => (
          <View key={index} style={styles.componentRow}>
            <View style={styles.componentInfo}>
              <Text style={styles.componentName}>{component.name}</Text>
              {component.substituted && (
                <Badge text="Substituted" size="small" variant="warning" />
              )}
            </View>
            <Text style={styles.componentCalories}>
              {component.calories} cal
            </Text>
          </View>
        ))}
      </View>

      {/* Metrics */}
      <View style={styles.metricsSection}>
        <Text style={styles.sectionTitle}>How You Felt</Text>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Satisfaction</Text>
          <StarRating rating={log.satisfaction} size={18} readOnly />
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Energy Level</Text>
          <View style={styles.metricBarContainer}>
            <ProgressBar
              progress={log.energyLevel}
              height={8}
              color={colors.secondary.main}
            />
          </View>
          <Text style={styles.metricValue}>{log.energyLevel}%</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Hunger Before</Text>
          <View style={styles.metricBarContainer}>
            <ProgressBar
              progress={log.hungerBefore}
              height={8}
              color={colors.warning}
            />
          </View>
          <Text style={styles.metricValue}>{log.hungerBefore}%</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Hunger After</Text>
          <View style={styles.metricBarContainer}>
            <ProgressBar
              progress={log.hungerAfter}
              height={8}
              color={colors.success}
            />
          </View>
          <Text style={styles.metricValue}>{log.hungerAfter}%</Text>
        </View>
      </View>

      {/* Notes */}
      {log.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notesText}>{log.notes}</Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  compactCard: {
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactPhoto: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
  },
  compactPhotoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  placeholderIcon: {
    fontSize: 24,
  },
  compactContent: {
    flex: 1,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  compactTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  compactTime: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  compactStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactStat: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  compactDivider: {
    ...typography.caption,
    color: colors.border.medium,
    marginHorizontal: spacing.xs,
  },
  compactRating: {
    marginLeft: 'auto',
  },
  detailedCard: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealIcon: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  mealTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  mealTime: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  nutritionSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing.md,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    ...typography.h2,
    color: colors.text.primary,
  },
  nutritionLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  nutritionDivider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
  componentsSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  componentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  componentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  componentName: {
    ...typography.body2,
    color: colors.text.primary,
  },
  componentCalories: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  metricsSection: {
    marginBottom: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  metricLabel: {
    ...typography.body2,
    color: colors.text.secondary,
    width: 100,
  },
  metricBarContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  metricValue: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    width: 40,
    textAlign: 'right',
  },
  notesSection: {
    backgroundColor: colors.background.secondary,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  notesText: {
    ...typography.body2,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
});
