import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { Equipment } from '../../types';

export interface EquipmentStatusProps {
  equipment: Equipment[];
  onEquipmentPress?: (equipmentId: string) => void;
}

const getStatusColor = (status: Equipment['status']): string => {
  switch (status) {
    case 'available':
      return colors.success;
    case 'in-use':
      return colors.warning;
    case 'dirty':
      return colors.error;
    case 'unavailable':
      return colors.text.disabled;
  }
};

const getStatusLabel = (status: Equipment['status']): string => {
  switch (status) {
    case 'available':
      return 'Ready';
    case 'in-use':
      return 'In Use';
    case 'dirty':
      return 'Needs Cleaning';
    case 'unavailable':
      return 'Unavailable';
  }
};

export const EquipmentStatus: React.FC<EquipmentStatusProps> = ({
  equipment,
  onEquipmentPress,
}) => {
  const availableCount = equipment.filter(e => e.status === 'available').length;
  const inUseCount = equipment.filter(e => e.status === 'in-use').length;
  const dirtyCount = equipment.filter(e => e.status === 'dirty').length;

  return (
    <Card variant="outlined" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Equipment Status</Text>
        <View style={styles.summary}>
          <View style={[styles.summaryDot, { backgroundColor: colors.success }]} />
          <Text style={styles.summaryText}>{availableCount}</Text>
          <View style={[styles.summaryDot, { backgroundColor: colors.warning }]} />
          <Text style={styles.summaryText}>{inUseCount}</Text>
          {dirtyCount > 0 && (
            <>
              <View style={[styles.summaryDot, { backgroundColor: colors.error }]} />
              <Text style={styles.summaryText}>{dirtyCount}</Text>
            </>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.equipmentScroll}
      >
        {equipment.map((item) => {
          const statusColor = getStatusColor(item.status);
          return (
            <Card
              key={item.id}
              onPress={() => onEquipmentPress?.(item.id)}
              variant="filled"
              style={[
                styles.equipmentCard,
                { borderColor: statusColor, borderWidth: 2 },
              ]}
            >
              <Text style={styles.equipmentIcon}>{item.icon}</Text>
              <Text style={styles.equipmentName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={[styles.statusIndicator, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
              </View>
              {item.currentTask && (
                <Text style={styles.taskLabel} numberOfLines={1}>
                  {item.currentTask}
                </Text>
              )}
            </Card>
          );
        })}
      </ScrollView>
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
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: spacing.sm,
    marginRight: spacing.xs / 2,
  },
  summaryText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  equipmentScroll: {
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  equipmentCard: {
    width: 100,
    alignItems: 'center',
    padding: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: borderRadius.md,
  },
  equipmentIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  equipmentName: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  statusIndicator: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.text.inverse,
    fontWeight: '600',
  },
  taskLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
