import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { Input } from '../base/Input';
import { Badge } from '../base/Badge';
import { Slider } from '../base/Slider';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { InventoryItem } from '../../types';

interface QuickAddModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: Omit<InventoryItem, 'id'>) => void;
  onScanBarcode?: () => void;
  recentItems?: InventoryItem[];
}

type LocationType = 'fridge' | 'freezer' | 'pantry';
type CategoryType = 'protein' | 'carb' | 'vegetable' | 'fruit' | 'dairy' | 'pantry' | 'frozen' | 'leftover';

const categories: { value: CategoryType; label: string; icon: string }[] = [
  { value: 'protein', label: 'Protein', icon: '\u{1F357}' },
  { value: 'carb', label: 'Carbs', icon: '\u{1F35E}' },
  { value: 'vegetable', label: 'Vegetable', icon: '\u{1F966}' },
  { value: 'fruit', label: 'Fruit', icon: '\u{1F34E}' },
  { value: 'dairy', label: 'Dairy', icon: '\u{1F95B}' },
  { value: 'pantry', label: 'Pantry', icon: '\u{1F3FA}' },
  { value: 'frozen', label: 'Frozen', icon: '\u2744' },
  { value: 'leftover', label: 'Leftover', icon: '\u{1F37D}' },
];

const locations: { value: LocationType; label: string; icon: string }[] = [
  { value: 'fridge', label: 'Fridge', icon: '\u{1F9CA}' },
  { value: 'freezer', label: 'Freezer', icon: '\u2744' },
  { value: 'pantry', label: 'Pantry', icon: '\u{1F3E0}' },
];

const commonUnits = ['lbs', 'oz', 'cups', 'count', 'bags', 'cans', 'bottles', 'containers'];

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  visible,
  onClose,
  onAdd,
  onScanBarcode,
  recentItems = [],
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<CategoryType>('protein');
  const [location, setLocation] = useState<LocationType>('fridge');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('count');
  const [daysUntilExpiry, setDaysUntilExpiry] = useState(7);
  const [hasExpiry, setHasExpiry] = useState(true);
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');

  const resetForm = () => {
    setName('');
    setCategory('protein');
    setLocation('fridge');
    setQuantity(1);
    setUnit('count');
    setDaysUntilExpiry(7);
    setHasExpiry(true);
    setPrice('');
    setStore('');
  };

  const handleAdd = () => {
    const expiryDate = hasExpiry
      ? new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : undefined;

    const newItem: Omit<InventoryItem, 'id'> = {
      name,
      category,
      quantity,
      unit,
      expiryDate,
      purchaseDate: new Date().toISOString().split('T')[0],
      location,
      pricePerUnit: price ? parseFloat(price) : undefined,
      store: store || undefined,
    };

    onAdd(newItem);
    resetForm();
    onClose();
  };

  const handleQuickAdd = (item: InventoryItem) => {
    const newItem: Omit<InventoryItem, 'id'> = {
      name: item.name,
      category: item.category,
      quantity: 1,
      unit: item.unit,
      purchaseDate: new Date().toISOString().split('T')[0],
      location: item.location,
      pricePerUnit: item.pricePerUnit,
      store: item.store,
    };
    onAdd(newItem);
  };

  const isValid = name.trim().length > 0 && quantity > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Add Item</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.closeIcon}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              {onScanBarcode && (
                <Button
                  title="Scan Barcode"
                  onPress={onScanBarcode}
                  variant="outline"
                  icon={<Text style={styles.buttonIcon}>{'\u{1F4F7}'}</Text>}
                  style={styles.quickButton}
                />
              )}
            </View>

            {/* Recent Items */}
            {recentItems.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Items</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {recentItems.slice(0, 5).map((item) => (
                    <Card
                      key={item.id}
                      onPress={() => handleQuickAdd(item)}
                      variant="filled"
                      style={styles.recentCard}
                    >
                      <Text style={styles.recentName}>{item.name}</Text>
                      <Text style={styles.recentUnit}>{item.unit}</Text>
                    </Card>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Name Input */}
            <Input
              label="Item Name"
              placeholder="e.g., Chicken Breast"
              value={name}
              onChangeText={setName}
              containerStyle={styles.input}
            />

            {/* Category Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category</Text>
              <View style={styles.optionsGrid}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => setCategory(cat.value)}
                    style={[
                      styles.optionItem,
                      category === cat.value && styles.optionSelected,
                    ]}
                  >
                    <Text style={styles.optionIcon}>{cat.icon}</Text>
                    <Text
                      style={[
                        styles.optionLabel,
                        category === cat.value && styles.optionLabelSelected,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Location Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Storage Location</Text>
              <View style={styles.locationRow}>
                {locations.map((loc) => (
                  <TouchableOpacity
                    key={loc.value}
                    onPress={() => setLocation(loc.value)}
                    style={[
                      styles.locationItem,
                      location === loc.value && styles.locationSelected,
                    ]}
                  >
                    <Text style={styles.locationIcon}>{loc.icon}</Text>
                    <Text
                      style={[
                        styles.locationLabel,
                        location === loc.value && styles.locationLabelSelected,
                      ]}
                    >
                      {loc.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Quantity */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quantity</Text>
              <View style={styles.quantityRow}>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    onPress={() => setQuantity(Math.max(0.5, quantity - 0.5))}
                    style={styles.quantityButton}
                  >
                    <Text style={styles.quantityButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.quantityValue}>{quantity}</Text>
                  <TouchableOpacity
                    onPress={() => setQuantity(quantity + 0.5)}
                    style={styles.quantityButton}
                  >
                    <Text style={styles.quantityButtonText}>+</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {commonUnits.map((u) => (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setUnit(u)}
                      style={[
                        styles.unitButton,
                        unit === u && styles.unitButtonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.unitText,
                          unit === u && styles.unitTextSelected,
                        ]}
                      >
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Expiry */}
            <View style={styles.section}>
              <View style={styles.expiryHeader}>
                <Text style={styles.sectionTitle}>Expiry Date</Text>
                <TouchableOpacity onPress={() => setHasExpiry(!hasExpiry)}>
                  <Badge
                    text={hasExpiry ? 'Yes' : 'No'}
                    variant={hasExpiry ? 'success' : 'default'}
                  />
                </TouchableOpacity>
              </View>

              {hasExpiry && (
                <Slider
                  value={daysUntilExpiry}
                  onValueChange={setDaysUntilExpiry}
                  min={1}
                  max={30}
                  step={1}
                  label={`Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`}
                  leftLabel="1 day"
                  rightLabel="30 days"
                />
              )}
            </View>

            {/* Optional: Price and Store */}
            <View style={styles.optionalSection}>
              <Text style={styles.sectionTitle}>Optional Details</Text>
              <View style={styles.optionalRow}>
                <Input
                  label="Price"
                  placeholder="0.00"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  leftIcon={<Text>$</Text>}
                  containerStyle={styles.priceInput}
                />
                <Input
                  label="Store"
                  placeholder="Costco"
                  value={store}
                  onChangeText={setStore}
                  containerStyle={styles.storeInput}
                />
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                title="Cancel"
                onPress={() => {
                  resetForm();
                  onClose();
                }}
                variant="outline"
                style={styles.actionButton}
              />
              <Button
                title="Add Item"
                onPress={handleAdd}
                disabled={!isValid}
                style={styles.actionButton}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  closeIcon: {
    fontSize: 20,
    color: colors.text.secondary,
    padding: spacing.xs,
  },
  quickActions: {
    marginBottom: spacing.md,
  },
  quickButton: {
    marginBottom: spacing.sm,
  },
  buttonIcon: {
    marginRight: spacing.xs,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    marginBottom: spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optionItem: {
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    minWidth: 70,
  },
  optionSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.main + '10',
  },
  optionIcon: {
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  optionLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  optionLabelSelected: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  locationItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  locationSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.main + '10',
  },
  locationIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  locationLabel: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  locationLabelSelected: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  quantityRow: {
    gap: spacing.sm,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    color: colors.text.inverse,
    fontSize: 24,
    fontWeight: '600',
  },
  quantityValue: {
    ...typography.h2,
    color: colors.text.primary,
    marginHorizontal: spacing.lg,
    minWidth: 60,
    textAlign: 'center',
  },
  unitButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginRight: spacing.xs,
  },
  unitButtonSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.main + '10',
  },
  unitText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  unitTextSelected: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  expiryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  optionalSection: {
    marginBottom: spacing.md,
  },
  optionalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priceInput: {
    flex: 1,
    marginBottom: 0,
  },
  storeInput: {
    flex: 2,
    marginBottom: 0,
  },
  recentCard: {
    padding: spacing.sm,
    marginRight: spacing.sm,
    alignItems: 'center',
    minWidth: 80,
  },
  recentName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  recentUnit: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
});
