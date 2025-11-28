import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../../utils/theme';
import { OptimizedRoute, RouteStop } from '../../types/optimization.types';
import { Card } from '../base/Card';
import { Button } from '../base/Button';

// ============================================
// Types
// ============================================
export interface RoutePreviewProps {
  route: OptimizedRoute | null;
  onViewFullRoute: () => void;
  onStartShopping: (storeId: string) => void;
}

interface RouteStopCardProps {
  stop: RouteStop;
  isFirst: boolean;
  isLast: boolean;
  onStart: () => void;
}

interface RouteSummaryProps {
  totalDistance: number;
  totalDuration: number;
  totalSpend: number;
  savings: number;
  storeCount: number;
}

// ============================================
// Helper Functions
// ============================================
const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatCurrency = (value: number): string => {
  return `$${value.toFixed(2)}`;
};

// ============================================
// Sub-Components
// ============================================
const RouteStopCard: React.FC<RouteStopCardProps> = ({
  stop,
  isFirst,
  isLast,
  onStart,
}) => (
  <View style={styles.stopCard}>
    {/* Timeline connector */}
    <View style={styles.timeline}>
      <View style={[styles.timelineDot, isFirst && styles.timelineDotFirst]} />
      {!isLast && <View style={styles.timelineLine} />}
    </View>

    {/* Stop content */}
    <View style={styles.stopContent}>
      <View style={styles.stopHeader}>
        <View style={styles.orderBadge}>
          <Text style={styles.orderNumber}>{stop.order}</Text>
        </View>
        <View style={styles.stopInfo}>
          <Text style={styles.stopName}>{stop.storeName}</Text>
          <Text style={styles.stopArrival}>
            Arrive ~{formatTime(stop.estimatedArrival)}
          </Text>
        </View>
      </View>

      <View style={styles.stopDetails}>
        <View style={styles.stopStat}>
          <Text style={styles.stopStatValue}>{stop.itemCount}</Text>
          <Text style={styles.stopStatLabel}>items</Text>
        </View>
        <View style={styles.stopStatDivider} />
        <View style={styles.stopStat}>
          <Text style={styles.stopStatValue}>{formatDuration(stop.estimatedDuration)}</Text>
          <Text style={styles.stopStatLabel}>shopping</Text>
        </View>
        <View style={styles.stopStatDivider} />
        <View style={styles.stopStat}>
          <Text style={styles.stopStatValue}>{formatCurrency(stop.estimatedSpend)}</Text>
          <Text style={styles.stopStatLabel}>estimate</Text>
        </View>
      </View>

      {isFirst && (
        <Button
          title="Start Here"
          onPress={onStart}
          variant="primary"
          size="small"
          style={styles.startButton}
        />
      )}
    </View>
  </View>
);

const RouteSummary: React.FC<RouteSummaryProps> = ({
  totalDistance,
  totalDuration,
  totalSpend,
  savings,
  storeCount,
}) => (
  <Card variant="elevated" padding="medium" style={styles.summaryCard}>
    <Text style={styles.summaryTitle}>Trip Summary</Text>

    <View style={styles.summaryGrid}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>{storeCount}</Text>
        <Text style={styles.summaryLabel}>Stores</Text>
      </View>

      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>{totalDistance.toFixed(1)} mi</Text>
        <Text style={styles.summaryLabel}>Distance</Text>
      </View>

      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>{formatDuration(totalDuration)}</Text>
        <Text style={styles.summaryLabel}>Total Time</Text>
      </View>

      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>{formatCurrency(totalSpend)}</Text>
        <Text style={styles.summaryLabel}>Est. Spend</Text>
      </View>
    </View>

    {savings > 0 && (
      <View style={styles.savingsBanner}>
        <Text style={styles.savingsText}>
          Saving {formatCurrency(savings)} with this route!
        </Text>
      </View>
    )}
  </Card>
);

// ============================================
// Map Preview (Placeholder)
// ============================================
const MapPreview: React.FC<{ stops: RouteStop[]; onPress: () => void }> = ({
  stops,
  onPress,
}) => (
  <TouchableOpacity
    style={styles.mapPreview}
    onPress={onPress}
    activeOpacity={0.8}
  >
    {/* Simple visual representation of route */}
    <View style={styles.mapPlaceholder}>
      <View style={styles.mapRoute}>
        {stops.map((stop, index) => (
          <React.Fragment key={stop.storeId}>
            {index > 0 && <View style={styles.mapRouteLine} />}
            <View style={styles.mapPin}>
              <Text style={styles.mapPinText}>{stop.order}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
      <View style={styles.mapOverlay}>
        <Text style={styles.mapOverlayText}>Tap for full map</Text>
      </View>
    </View>
  </TouchableOpacity>
);

// ============================================
// Main Component
// ============================================
export const RoutePreview: React.FC<RoutePreviewProps> = ({
  route,
  onViewFullRoute,
  onStartShopping,
}) => {
  if (!route || route.stops.length === 0) {
    return (
      <Card variant="outlined" padding="large" style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No Route Available</Text>
        <Text style={styles.emptyText}>
          Add items to your shopping list to generate an optimized route
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Optimized Route</Text>
        <TouchableOpacity onPress={onViewFullRoute}>
          <Text style={styles.viewMapLink}>View Map</Text>
        </TouchableOpacity>
      </View>

      {/* Map Preview */}
      <MapPreview stops={route.stops} onPress={onViewFullRoute} />

      {/* Summary */}
      <RouteSummary
        totalDistance={route.totalDistance}
        totalDuration={route.totalDuration}
        totalSpend={route.totalSpend}
        savings={route.savings}
        storeCount={route.stops.length}
      />

      {/* Route Stops */}
      <View style={styles.stopsContainer}>
        <Text style={styles.stopsTitle}>Visit Order</Text>
        {route.stops.map((stop, index) => (
          <RouteStopCard
            key={stop.storeId}
            stop={stop}
            isFirst={index === 0}
            isLast={index === route.stops.length - 1}
            onStart={() => onStartShopping(stop.storeId)}
          />
        ))}
      </View>

      {/* Start Button */}
      <View style={styles.actionContainer}>
        <Button
          title="Start Shopping Trip"
          onPress={() => onStartShopping(route.stops[0].storeId)}
          variant="primary"
          size="large"
          fullWidth
        />
      </View>
    </View>
  );
};

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  viewMapLink: {
    ...typography.body2,
    color: colors.primary.main,
    fontWeight: '600',
  },
  mapPreview: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    height: 120,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  mapRouteLine: {
    width: 30,
    height: 2,
    backgroundColor: colors.primary.main,
  },
  mapPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  mapPinText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary.contrast,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: spacing.xs,
  },
  mapOverlayText: {
    ...typography.caption,
    color: colors.text.inverse,
    textAlign: 'center',
  },
  summaryCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.text.primary,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  savingsBanner: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.success + '15',
    borderRadius: borderRadius.md,
  },
  savingsText: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.success,
    textAlign: 'center',
  },
  stopsContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  stopsTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  stopCard: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  timeline: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary.main,
    zIndex: 1,
  },
  timelineDotFirst: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.primary.light,
    backgroundColor: colors.primary.main,
  },
  timelineLine: {
    position: 'absolute',
    top: 12,
    bottom: -spacing.sm,
    width: 2,
    backgroundColor: colors.primary.light,
  },
  stopContent: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  orderNumber: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary.contrast,
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  stopArrival: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  stopDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  stopStat: {
    alignItems: 'center',
    flex: 1,
  },
  stopStatValue: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.primary,
  },
  stopStatLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  stopStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border.light,
  },
  startButton: {
    marginTop: spacing.sm,
  },
  actionContainer: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  emptyState: {
    marginHorizontal: spacing.md,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

export default RoutePreview;
