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
import { StarRating } from '../base/StarRating';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { PatternStats, PatternId } from '../../types';

interface PatternEffectivenessProps {
  stats: PatternStats[];
  onPatternPress?: (patternId: PatternId) => void;
  showRecommendation?: boolean;
}

const patternNames: Record<PatternId, string> = {
  A: 'Traditional',
  B: 'Reversed',
  C: 'Fasting',
  D: 'Protein Focus',
  E: 'Grazing',
  F: 'OMAD',
  G: 'Flexible',
};

export const PatternEffectiveness: React.FC<PatternEffectivenessProps> = ({
  stats,
  onPatternPress,
  showRecommendation = true,
}) => {
  // Sort by effectiveness (combination of adherence and satisfaction)
  const sortedStats = [...stats].sort((a, b) => {
    const scoreA = a.adherenceRate * 0.6 + a.averageSatisfaction * 20 * 0.4;
    const scoreB = b.adherenceRate * 0.6 + b.averageSatisfaction * 20 * 0.4;
    return scoreB - scoreA;
  });

  const bestPattern = sortedStats[0];
  const averageAdherence = stats.reduce((sum, s) => sum + s.adherenceRate, 0) / stats.length;
  const averageSatisfaction = stats.reduce((sum, s) => sum + s.averageSatisfaction, 0) / stats.length;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getEffectivenessLabel = (adherence: number, satisfaction: number): { text: string; color: string } => {
    const score = adherence * 0.6 + satisfaction * 20 * 0.4;
    if (score >= 85) return { text: 'Excellent', color: colors.success };
    if (score >= 70) return { text: 'Good', color: colors.info };
    if (score >= 55) return { text: 'Fair', color: colors.warning };
    return { text: 'Needs Work', color: colors.error };
  };

  return (
    <Card variant="outlined" style={styles.container}>
      <Text style={styles.title}>Pattern Effectiveness</Text>
      <Text style={styles.subtitle}>
        How well each pattern works for you
      </Text>

      {/* Summary Stats */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{Math.round(averageAdherence)}%</Text>
          <Text style={styles.summaryLabel}>Avg Adherence</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{averageSatisfaction.toFixed(1)}</Text>
          <Text style={styles.summaryLabel}>Avg Rating</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{stats.reduce((sum, s) => sum + s.timesUsed, 0)}</Text>
          <Text style={styles.summaryLabel}>Total Uses</Text>
        </View>
      </View>

      {/* Pattern List */}
      <ScrollView style={styles.patternList} showsVerticalScrollIndicator={false}>
        {sortedStats.map((stat, index) => {
          const effectiveness = getEffectivenessLabel(stat.adherenceRate, stat.averageSatisfaction);

          return (
            <Card
              key={stat.patternId}
              onPress={() => onPatternPress && onPatternPress(stat.patternId)}
              variant="filled"
              style={styles.patternCard}
            >
              {/* Rank Indicator */}
              {index === 0 && (
                <View style={styles.rankBadge}>
                  <Text style={styles.rankIcon}>{'\u{1F3C6}'}</Text>
                </View>
              )}

              <View style={styles.patternHeader}>
                <View style={styles.patternIdentity}>
                  <View
                    style={[
                      styles.patternDot,
                      { backgroundColor: colors.patterns[stat.patternId] },
                    ]}
                  />
                  <View>
                    <Text style={styles.patternName}>
                      Pattern {stat.patternId}: {patternNames[stat.patternId]}
                    </Text>
                    <Text style={styles.patternMeta}>
                      Used {stat.timesUsed} time{stat.timesUsed !== 1 ? 's' : ''} - Last: {formatDate(stat.lastUsed)}
                    </Text>
                  </View>
                </View>
                <Badge
                  text={effectiveness.text}
                  customColor={effectiveness.color}
                  size="small"
                />
              </View>

              {/* Metrics */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <View style={styles.metricHeader}>
                    <Text style={styles.metricLabel}>Adherence</Text>
                    <Text style={styles.metricValue}>{stat.adherenceRate}%</Text>
                  </View>
                  <ProgressBar
                    progress={stat.adherenceRate}
                    height={6}
                    color={
                      stat.adherenceRate >= 85
                        ? colors.success
                        : stat.adherenceRate >= 70
                        ? colors.info
                        : colors.warning
                    }
                  />
                </View>

                <View style={styles.metricItem}>
                  <View style={styles.metricHeader}>
                    <Text style={styles.metricLabel}>Satisfaction</Text>
                    <Text style={styles.metricValue}>{stat.averageSatisfaction.toFixed(1)}/5</Text>
                  </View>
                  <StarRating
                    rating={Math.round(stat.averageSatisfaction)}
                    size={14}
                  />
                </View>

                <View style={styles.metricItem}>
                  <View style={styles.metricHeader}>
                    <Text style={styles.metricLabel}>Energy</Text>
                    <Text style={styles.metricValue}>{stat.averageEnergy}%</Text>
                  </View>
                  <ProgressBar
                    progress={stat.averageEnergy}
                    height={6}
                    color={colors.secondary.main}
                  />
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>

      {/* Recommendation */}
      {showRecommendation && bestPattern && (
        <View style={styles.recommendation}>
          <Text style={styles.recommendationIcon}>{'\u{1F4A1}'}</Text>
          <View style={styles.recommendationContent}>
            <Text style={styles.recommendationTitle}>Recommendation</Text>
            <Text style={styles.recommendationText}>
              <Text style={styles.recommendationBold}>
                Pattern {bestPattern.patternId} ({patternNames[bestPattern.patternId]})
              </Text>{' '}
              shows your best results with {bestPattern.adherenceRate}% adherence and{' '}
              {bestPattern.averageSatisfaction.toFixed(1)} star satisfaction. Consider using it more often!
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
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
  patternList: {
    maxHeight: 400,
  },
  patternCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 1,
  },
  rankIcon: {
    fontSize: 20,
  },
  patternHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  patternIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  patternDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: spacing.sm,
  },
  patternName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  patternMeta: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  metricsGrid: {
    gap: spacing.sm,
  },
  metricItem: {
    marginBottom: spacing.xs,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  metricValue: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  recommendation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.info + '10',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.info + '30',
  },
  recommendationIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.info,
    marginBottom: spacing.xs,
  },
  recommendationText: {
    ...typography.body2,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  recommendationBold: {
    fontWeight: '600',
    color: colors.text.primary,
  },
});
