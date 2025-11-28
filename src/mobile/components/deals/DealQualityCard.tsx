import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { ProgressBar } from '../base/ProgressBar';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { DealQualityScore, DealAssessment } from '../../types/analytics.types';

interface DealQualityCardProps {
  itemName: string;
  originalPrice: number;
  salePrice: number;
  quality: DealQualityScore;
  onPress?: () => void;
}

const ASSESSMENT_CONFIG: Record<DealAssessment, {
  label: string;
  color: string;
  icon: string;
}> = {
  excellent: { label: 'Excellent Deal', color: colors.success, icon: '\u{1F31F}' },
  good: { label: 'Good Deal', color: colors.info, icon: '\u{1F44D}' },
  average: { label: 'Average Deal', color: colors.warning, icon: '\u{1F914}' },
  poor: { label: 'Poor Deal', color: colors.error, icon: '\u{1F44E}' },
  fake: { label: 'Fake Deal', color: '#9E9E9E', icon: '\u26A0' },
};

export const DealQualityCard: React.FC<DealQualityCardProps> = ({
  itemName,
  originalPrice,
  salePrice,
  quality,
  onPress,
}) => {
  const config = ASSESSMENT_CONFIG[quality.assessment];
  const displayedSavings = ((originalPrice - salePrice) / originalPrice) * 100;

  const getScoreColor = (score: number) => {
    if (score >= 8) return colors.success;
    if (score >= 6) return colors.info;
    if (score >= 4) return colors.warning;
    return colors.error;
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(0)}%`;
  };

  return (
    <Card
      variant="outlined"
      style={styles.container}
      onPress={onPress}
      accentColor={config.color}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={styles.itemName}>{itemName}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.originalPrice}>${originalPrice.toFixed(2)}</Text>
            <Text style={styles.arrow}>{'\u2192'}</Text>
            <Text style={styles.salePrice}>${salePrice.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.scoreSection}>
          <View
            style={[
              styles.scoreBadge,
              { backgroundColor: getScoreColor(quality.score) },
            ]}
          >
            <Text style={styles.scoreValue}>{quality.score}</Text>
            <Text style={styles.scoreMax}>/10</Text>
          </View>
        </View>
      </View>

      {/* Assessment Badge */}
      <View style={styles.assessmentRow}>
        <Text style={styles.assessmentIcon}>{config.icon}</Text>
        <Badge
          text={config.label}
          customColor={config.color}
          size="medium"
        />
        {quality.isFakeDeal && (
          <Badge
            text="INFLATED ORIGINAL"
            variant="error"
            size="small"
            style={styles.warningBadge}
          />
        )}
      </View>

      {/* Comparison Bars */}
      <View style={styles.comparisonsSection}>
        <Text style={styles.sectionTitle}>Price Comparison</Text>

        <View style={styles.comparisonItem}>
          <View style={styles.comparisonHeader}>
            <Text style={styles.comparisonLabel}>vs 30-Day Average</Text>
            <Text
              style={[
                styles.comparisonValue,
                { color: quality.vs30DayAvg < 0 ? colors.success : colors.error },
              ]}
            >
              {formatPercent(quality.vs30DayAvg)}
            </Text>
          </View>
          <ProgressBar
            progress={Math.min(Math.abs(quality.vs30DayAvg), 50) * 2}
            color={quality.vs30DayAvg < 0 ? colors.success : colors.error}
            height={6}
          />
        </View>

        <View style={styles.comparisonItem}>
          <View style={styles.comparisonHeader}>
            <Text style={styles.comparisonLabel}>vs 90-Day Average</Text>
            <Text
              style={[
                styles.comparisonValue,
                { color: quality.vs90DayAvg < 0 ? colors.success : colors.error },
              ]}
            >
              {formatPercent(quality.vs90DayAvg)}
            </Text>
          </View>
          <ProgressBar
            progress={Math.min(Math.abs(quality.vs90DayAvg), 50) * 2}
            color={quality.vs90DayAvg < 0 ? colors.success : colors.error}
            height={6}
          />
        </View>

        <View style={styles.comparisonItem}>
          <View style={styles.comparisonHeader}>
            <Text style={styles.comparisonLabel}>vs Historical Low</Text>
            <Text
              style={[
                styles.comparisonValue,
                { color: quality.vsHistoricalLow <= 0 ? colors.success : colors.warning },
              ]}
            >
              {formatPercent(quality.vsHistoricalLow)}
            </Text>
          </View>
          <ProgressBar
            progress={Math.min(Math.abs(quality.vsHistoricalLow), 50) * 2}
            color={quality.vsHistoricalLow <= 0 ? colors.success : colors.warning}
            height={6}
          />
        </View>
      </View>

      {/* True Savings */}
      <View style={styles.trueSavingsSection}>
        <View style={styles.savingsRow}>
          <View>
            <Text style={styles.savingsLabel}>Advertised Savings</Text>
            <Text style={styles.advertisedSavings}>
              {displayedSavings.toFixed(0)}% off
            </Text>
          </View>
          <View style={styles.savingsDivider} />
          <View>
            <Text style={styles.savingsLabel}>True Savings</Text>
            <Text
              style={[
                styles.trueSavings,
                { color: quality.trueSavings > 0 ? colors.success : colors.error },
              ]}
            >
              {quality.trueSavings.toFixed(0)}%
            </Text>
          </View>
        </View>
        {quality.trueSavings < displayedSavings && (
          <Text style={styles.savingsNote}>
            * Based on actual price history, not inflated "original" price
          </Text>
        )}
      </View>

      {/* Warnings */}
      {quality.warnings.length > 0 && (
        <View style={styles.warningsSection}>
          {quality.warnings.map((warning, index) => (
            <View key={index} style={styles.warningItem}>
              <Text style={styles.warningIcon}>{'\u26A0'}</Text>
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  titleSection: {
    flex: 1,
  },
  itemName: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  originalPrice: {
    ...typography.body1,
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
  },
  arrow: {
    color: colors.text.disabled,
  },
  salePrice: {
    ...typography.h3,
    color: colors.success,
    fontWeight: '700',
  },
  scoreSection: {
    alignItems: 'center',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  scoreValue: {
    ...typography.h2,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  scoreMax: {
    ...typography.body2,
    color: 'rgba(255,255,255,0.8)',
  },
  assessmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  assessmentIcon: {
    fontSize: 20,
  },
  warningBadge: {
    marginLeft: 'auto',
  },
  comparisonsSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  comparisonItem: {
    marginBottom: spacing.sm,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  comparisonLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  comparisonValue: {
    ...typography.body2,
    fontWeight: '600',
  },
  trueSavingsSection: {
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  savingsDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },
  savingsLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  advertisedSavings: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
  },
  trueSavings: {
    ...typography.h3,
    fontWeight: '700',
    textAlign: 'center',
  },
  savingsNote: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  warningsSection: {
    padding: spacing.sm,
    backgroundColor: colors.warning + '10',
    borderRadius: borderRadius.md,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  warningIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
    color: colors.warning,
  },
  warningText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
  },
});
