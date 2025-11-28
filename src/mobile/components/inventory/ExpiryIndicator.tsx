import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { ExpiryStatus } from '../../types';

export interface ExpiryIndicatorProps {
  expiryDate: string;
  variant?: 'badge' | 'bar' | 'dot';
  showDaysLeft?: boolean;
}

const calculateDaysUntilExpiry = (expiryDate: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getExpiryStatus = (daysLeft: number): ExpiryStatus => {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 3) return 'expiring-soon';
  return 'fresh';
};

const getStatusColor = (status: ExpiryStatus): string => {
  switch (status) {
    case 'expired':
      return colors.expiry.expired;
    case 'expiring-soon':
      return colors.expiry.expiringSoon;
    case 'fresh':
      return colors.expiry.fresh;
  }
};

const getStatusLabel = (daysLeft: number): string => {
  if (daysLeft < 0) return `Expired ${Math.abs(daysLeft)}d ago`;
  if (daysLeft === 0) return 'Expires today';
  if (daysLeft === 1) return 'Expires tomorrow';
  return `${daysLeft} days left`;
};

export const ExpiryIndicator: React.FC<ExpiryIndicatorProps> = ({
  expiryDate,
  variant = 'badge',
  showDaysLeft = true,
}) => {
  const daysLeft = calculateDaysUntilExpiry(expiryDate);
  const status = getExpiryStatus(daysLeft);
  const statusColor = getStatusColor(status);
  const statusLabel = getStatusLabel(daysLeft);

  if (variant === 'dot') {
    return (
      <View style={[styles.dot, { backgroundColor: statusColor }]} />
    );
  }

  if (variant === 'bar') {
    const maxDays = 14;
    const barWidth = Math.max(0, Math.min(100, (daysLeft / maxDays) * 100));

    return (
      <View style={styles.barContainer}>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${barWidth}%`,
                backgroundColor: statusColor,
              },
            ]}
          />
        </View>
        {showDaysLeft && (
          <Text style={[styles.barLabel, { color: statusColor }]}>
            {statusLabel}
          </Text>
        )}
      </View>
    );
  }

  // Badge variant (default)
  return (
    <View style={[styles.badge, { backgroundColor: statusColor }]}>
      <Text style={styles.badgeText}>
        {showDaysLeft ? statusLabel : status}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '600',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  barContainer: {
    width: '100%',
  },
  barTrack: {
    height: 4,
    backgroundColor: colors.background.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  barLabel: {
    ...typography.caption,
    marginTop: spacing.xs / 2,
  },
});
