import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';
import { AdTemplate } from '../../types/ads.types';
import { AccuracySparkline } from './AccuracyChart';

export interface TemplateCardProps {
  template: AdTemplate;
  onPress?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onTest?: () => void;
  showActions?: boolean;
  compact?: boolean;
  style?: ViewStyle;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onPress,
  onDownload,
  onShare,
  onTest,
  showActions = true,
  compact = false,
  style,
}) => {
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <View style={styles.starsContainer}>
        {Array(fullStars)
          .fill(null)
          .map((_, i) => (
            <Text key={`full-${i}`} style={styles.starFull}>
              {'\u2605'}
            </Text>
          ))}
        {hasHalfStar && <Text style={styles.starHalf}>{'\u2606'}</Text>}
        {Array(emptyStars)
          .fill(null)
          .map((_, i) => (
            <Text key={`empty-${i}`} style={styles.starEmpty}>
              {'\u2606'}
            </Text>
          ))}
        <Text style={styles.ratingText}>({template.averageRating.toFixed(1)})</Text>
      </View>
    );
  };

  if (compact) {
    return (
      <Card onPress={onPress} variant="outlined" style={[styles.compactCard, style]}>
        <View style={styles.compactContent}>
          <View style={styles.compactInfo}>
            <Text style={styles.compactName} numberOfLines={1}>
              {template.name}
            </Text>
            <Text style={styles.compactStore}>{template.storeName}</Text>
          </View>
          <View style={styles.compactStats}>
            <Text style={styles.compactAccuracy}>{Math.round(template.accuracy)}%</Text>
            {renderStars(template.averageRating)}
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card onPress={onPress} variant="elevated" style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.name} numberOfLines={2}>
            {template.name}
          </Text>
          <Text style={styles.storeName}>{template.storeName}</Text>
        </View>
        <View style={styles.badges}>
          {template.isPublic && (
            <Badge text="Public" variant="info" size="small" />
          )}
          <Badge
            text={`v${template.version}`}
            variant="default"
            size="small"
            style={{ marginLeft: spacing.xs }}
          />
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(template.accuracy)}%</Text>
          <Text style={styles.statLabel}>Accuracy</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{template.usageCount}</Text>
          <Text style={styles.statLabel}>Uses</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{template.successfulExtractions}</Text>
          <Text style={styles.statLabel}>Successful</Text>
        </View>
      </View>

      <View style={styles.ratingRow}>
        {renderStars(template.averageRating)}
        <Text style={styles.reviewCount}>
          {template.ratings.length} reviews
        </Text>
      </View>

      {template.versionHistory.length > 0 && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartLabel}>Accuracy over versions</Text>
          <AccuracySparkline
            data={template.versionHistory.map(v => v.accuracy)}
            width={100}
            height={24}
          />
        </View>
      )}

      {template.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {template.tags.slice(0, 3).map(tag => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {template.tags.length > 3 && (
            <Text style={styles.moreTagsText}>+{template.tags.length - 3}</Text>
          )}
        </View>
      )}

      {showActions && (
        <View style={styles.actions}>
          {onTest && (
            <TouchableOpacity style={styles.actionButton} onPress={onTest}>
              <Text style={styles.actionIcon}>{'\u{1F9EA}'}</Text>
              <Text style={styles.actionText}>Test</Text>
            </TouchableOpacity>
          )}
          {onShare && !template.isPublic && (
            <TouchableOpacity style={styles.actionButton} onPress={onShare}>
              <Text style={styles.actionIcon}>{'\u{1F4E4}'}</Text>
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          )}
          {onDownload && template.isPublic && (
            <TouchableOpacity style={styles.actionButton} onPress={onDownload}>
              <Text style={styles.actionIcon}>{'\u{2B07}'}</Text>
              <Text style={styles.actionText}>Download</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={styles.updatedText}>
        Updated {formatRelativeTime(template.updatedAt)}
      </Text>
    </Card>
  );
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  compactCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  compactContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  compactStore: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  compactStats: {
    alignItems: 'flex-end',
  },
  compactAccuracy: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.primary.main,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  titleContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    ...typography.h3,
    color: colors.text.primary,
  },
  storeName: {
    ...typography.body2,
    color: colors.text.secondary,
    marginTop: spacing.xs / 2,
  },
  badges: {
    flexDirection: 'row',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing.md,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs / 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starFull: {
    color: colors.warning,
    fontSize: 14,
  },
  starHalf: {
    color: colors.warning,
    fontSize: 14,
  },
  starEmpty: {
    color: colors.text.disabled,
    fontSize: 14,
  },
  ratingText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  reviewCount: {
    ...typography.caption,
    color: colors.text.disabled,
    marginLeft: spacing.sm,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  chartLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  tag: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.xs,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  tagText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  moreTagsText: {
    ...typography.caption,
    color: colors.text.disabled,
    alignSelf: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.md,
  },
  actionIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  actionText: {
    ...typography.body2,
    color: colors.primary.main,
    fontWeight: '600',
  },
  updatedText: {
    ...typography.caption,
    color: colors.text.disabled,
  },
});
