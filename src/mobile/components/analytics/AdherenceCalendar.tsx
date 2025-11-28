import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '../base/Card';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { DailyStats, PatternId } from '../../types';

export interface AdherenceCalendarProps {
  stats: DailyStats[];
  month: Date;
  onDayPress?: (date: string) => void;
  onMonthChange?: (direction: 'prev' | 'next') => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AdherenceCalendar: React.FC<AdherenceCalendarProps> = ({
  stats,
  month,
  onDayPress,
  onMonthChange,
}) => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const getStatForDate = (day: number): DailyStats | undefined => {
    const dateString = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return stats.find(s => s.date === dateString);
  };

  const getAdherenceColor = (adherence: number): string => {
    if (adherence >= 90) return colors.success;
    if (adherence >= 70) return colors.primary.light;
    if (adherence >= 50) return colors.warning;
    if (adherence > 0) return colors.error + '80';
    return colors.background.tertiary;
  };

  const today = new Date();
  const isToday = (day: number): boolean => {
    return (
      today.getFullYear() === year &&
      today.getMonth() === monthIndex &&
      today.getDate() === day
    );
  };

  const isFuture = (day: number): boolean => {
    const date = new Date(year, monthIndex, day);
    return date > today;
  };

  const renderCalendarDays = () => {
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStat = getStatForDate(day);
      const adherence = dayStat?.adherenceScore || 0;
      const isCurrentDay = isToday(day);
      const isFutureDay = isFuture(day);

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.dayCell,
            !isFutureDay && {
              backgroundColor: getAdherenceColor(adherence),
            },
            isCurrentDay && styles.todayCell,
          ]}
          onPress={() => {
            if (!isFutureDay && dayStat) {
              onDayPress?.(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
            }
          }}
          disabled={isFutureDay}
        >
          <Text
            style={[
              styles.dayText,
              adherence >= 70 && !isFutureDay && styles.dayTextLight,
              isFutureDay && styles.dayTextFuture,
              isCurrentDay && styles.todayText,
            ]}
          >
            {day}
          </Text>
          {dayStat && (
            <Text
              style={[
                styles.patternIndicator,
                { color: colors.patterns[dayStat.patternId as PatternId] },
              ]}
            >
              {dayStat.patternId}
            </Text>
          )}
        </TouchableOpacity>
      );
    }

    return days;
  };

  // Calculate monthly stats
  const monthStats = stats.filter(s => {
    const date = new Date(s.date);
    return date.getFullYear() === year && date.getMonth() === monthIndex;
  });
  const avgAdherence = monthStats.length > 0
    ? Math.round(monthStats.reduce((sum, s) => sum + s.adherenceScore, 0) / monthStats.length)
    : 0;
  const daysTracked = monthStats.length;

  return (
    <Card variant="outlined" style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => onMonthChange?.('prev')}
          style={styles.navButton}
        >
          <Text style={styles.navText}>{'\u276E'}</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthName}</Text>
        <TouchableOpacity
          onPress={() => onMonthChange?.('next')}
          style={styles.navButton}
        >
          <Text style={styles.navText}>{'\u276F'}</Text>
        </TouchableOpacity>
      </View>

      {/* Days of week header */}
      <View style={styles.weekHeader}>
        {DAYS_OF_WEEK.map(day => (
          <Text key={day} style={styles.weekDayText}>
            {day}
          </Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.calendarGrid}>{renderCalendarDays()}</View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={styles.legendText}>90%+</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary.light }]} />
          <Text style={styles.legendText}>70-89%</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendText}>50-69%</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.error + '80' }]} />
          <Text style={styles.legendText}>&lt;50%</Text>
        </View>
      </View>

      {/* Monthly Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{daysTracked}</Text>
          <Text style={styles.summaryLabel}>Days Tracked</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text
            style={[
              styles.summaryValue,
              { color: getAdherenceColor(avgAdherence) },
            ]}
          >
            {avgAdherence}%
          </Text>
          <Text style={styles.summaryLabel}>Avg Adherence</Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  navButton: {
    padding: spacing.sm,
  },
  navText: {
    fontSize: 18,
    color: colors.primary.main,
  },
  monthTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    marginBottom: 2,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: colors.primary.main,
  },
  dayText: {
    ...typography.body2,
    color: colors.text.primary,
  },
  dayTextLight: {
    color: colors.text.inverse,
  },
  dayTextFuture: {
    color: colors.text.disabled,
  },
  todayText: {
    fontWeight: '700',
  },
  patternIndicator: {
    fontSize: 8,
    fontWeight: '700',
    position: 'absolute',
    bottom: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.xs / 2,
  },
  legendText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.xl,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.h2,
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
});
