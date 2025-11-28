import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { Badge } from '../base/Badge';
import { ProgressBar } from '../base/ProgressBar';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { PatternRecommendation } from '../../types/analytics.types';
import { PatternId } from '../../types';

interface RecommendationCardProps {
  recommendation: PatternRecommendation;
  onAccept?: (patternId: PatternId) => void;
  onOverride?: () => void;
  onViewAlternatives?: () => void;
}

const PATTERN_COLORS: Record<PatternId, string> = {
  A: colors.patterns.A,
  B: colors.patterns.B,
  C: colors.patterns.C,
  D: colors.patterns.D,
  E: colors.patterns.E,
  F: colors.patterns.F,
  G: colors.patterns.G,
};

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onAccept,
  onOverride,
  onViewAlternatives,
}) => {
  const {
    recommendedPattern,
    patternName,
    confidence,
    reasoning,
    contextFactors,
    fatigueWarning,
    consecutiveDays,
    alternativePatterns,
  } = recommendation;

  const getConfidenceColor = (conf: number) => {
    if (conf >= 80) return colors.success;
    if (conf >= 60) return colors.info;
    if (conf >= 40) return colors.warning;
    return colors.error;
  };

  return (
    <Card
      variant="elevated"
      style={styles.container}
      accentColor={PATTERN_COLORS[recommendedPattern]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>{'\u{1F9E0}'}</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>AI Recommendation</Text>
          <Text style={styles.subtitle}>Based on your context and history</Text>
        </View>
      </View>

      {/* Main Recommendation */}
      <View style={styles.mainRecommendation}>
        <View
          style={[
            styles.patternBadge,
            { backgroundColor: PATTERN_COLORS[recommendedPattern] },
          ]}
        >
          <Text style={styles.patternLetter}>{recommendedPattern}</Text>
        </View>
        <View style={styles.patternInfo}>
          <Text style={styles.patternName}>Pattern {recommendedPattern}: {patternName}</Text>
          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>Confidence:</Text>
            <ProgressBar
              progress={confidence}
              color={getConfidenceColor(confidence)}
              height={6}
              style={styles.confidenceBar}
            />
            <Text
              style={[
                styles.confidenceValue,
                { color: getConfidenceColor(confidence) },
              ]}
            >
              {confidence}%
            </Text>
          </View>
        </View>
      </View>

      {/* Fatigue Warning */}
      {fatigueWarning && (
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>{'\u26A0'}</Text>
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Pattern Fatigue Detected</Text>
            <Text style={styles.warningText}>
              You have used Pattern {recommendedPattern} for {consecutiveDays} consecutive days.
              Consider switching to avoid monotony and maintain effectiveness.
            </Text>
          </View>
        </View>
      )}

      {/* Context Factors */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Context Factors</Text>
        <View style={styles.factorList}>
          {contextFactors.map((factor, index) => (
            <View key={index} style={styles.factorItem}>
              <Text style={styles.factorIcon}>{'\u2713'}</Text>
              <Text style={styles.factorText}>{factor}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Reasoning */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Why This Pattern?</Text>
        <View style={styles.reasoningList}>
          {reasoning.map((reason, index) => (
            <View key={index} style={styles.reasoningItem}>
              <Text style={styles.reasoningBullet}>{index + 1}.</Text>
              <Text style={styles.reasoningText}>{reason}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Alternatives */}
      {alternativePatterns.length > 0 && (
        <View style={styles.alternativesSection}>
          <Text style={styles.sectionTitle}>Alternatives</Text>
          <View style={styles.alternativesList}>
            {alternativePatterns.map((pattern) => (
              <TouchableOpacity
                key={pattern}
                style={[
                  styles.alternativeChip,
                  { borderColor: PATTERN_COLORS[pattern] },
                ]}
                onPress={onViewAlternatives}
              >
                <View
                  style={[
                    styles.alternativeDot,
                    { backgroundColor: PATTERN_COLORS[pattern] },
                  ]}
                />
                <Text style={styles.alternativeText}>Pattern {pattern}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={`Use Pattern ${recommendedPattern}`}
          onPress={() => onAccept?.(recommendedPattern)}
          style={styles.acceptButton}
        />
        <View style={styles.secondaryActions}>
          <Button
            title="Choose Different"
            variant="secondary"
            size="small"
            onPress={onOverride}
          />
          {alternativePatterns.length > 0 && (
            <Button
              title="View Alternatives"
              variant="ghost"
              size="small"
              onPress={onViewAlternatives}
            />
          )}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerIcon: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  mainRecommendation: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  patternBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  patternLetter: {
    ...typography.h2,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  patternInfo: {
    flex: 1,
  },
  patternName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  confidenceBar: {
    flex: 1,
    marginRight: spacing.sm,
  },
  confidenceValue: {
    ...typography.body2,
    fontWeight: '600',
    width: 40,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.warning + '15',
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
    color: colors.warning,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  warningText: {
    ...typography.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  factorList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.full,
  },
  factorIcon: {
    color: colors.success,
    marginRight: spacing.xs,
    fontWeight: '700',
  },
  factorText: {
    ...typography.caption,
    color: colors.text.primary,
  },
  reasoningList: {
    gap: spacing.xs,
  },
  reasoningItem: {
    flexDirection: 'row',
  },
  reasoningBullet: {
    ...typography.body2,
    color: colors.text.disabled,
    width: 20,
  },
  reasoningText: {
    ...typography.body2,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },
  alternativesSection: {
    marginBottom: spacing.md,
  },
  alternativesList: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  alternativeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    backgroundColor: colors.background.primary,
  },
  alternativeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.xs,
  },
  alternativeText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.sm,
  },
  acceptButton: {
    width: '100%',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
