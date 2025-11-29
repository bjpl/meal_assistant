import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { Badge } from '../base/Badge';
import { Input } from '../base/Input';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';

interface ScannedItem {
  name: string;
  price: number;
  quantity?: number;
  matched?: boolean;
  shoppingItemId?: string;
}

interface ReceiptScannerProps {
  visible: boolean;
  onClose: () => void;
  onItemsExtracted: (items: ScannedItem[]) => void;
  expectedItems?: { id: string; name: string; estimatedPrice: number }[];
}

export const ReceiptScanner: React.FC<ReceiptScannerProps> = ({
  visible,
  onClose,
  onItemsExtracted,
  expectedItems = [],
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ScannedItem[]>([]);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [step, setStep] = useState<'capture' | 'review' | 'match'>('capture');

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleCapture = async () => {
    // In production, this would capture from camera ref
    // For now, simulate with image picker
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      processImage(result.assets[0].uri);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      processImage(result.assets[0].uri);
    }
  };

  const processImage = async (imageUri: string) => {
    setIsProcessing(true);
    setStep('review');

    // Simulate OCR processing
    // In production, this would call an OCR API
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock extracted items
    const mockItems: ScannedItem[] = [
      { name: 'Chicken Breast', price: 19.99, quantity: 1 },
      { name: 'Basmati Rice', price: 12.99, quantity: 1 },
      { name: 'Greek Yogurt', price: 8.94, quantity: 6 },
      { name: 'Bell Peppers', price: 5.94, quantity: 6 },
      { name: 'Broccoli', price: 3.98, quantity: 2 },
    ];

    // Try to match with expected items
    const matchedItems = mockItems.map((item) => {
      const match = expectedItems.find(
        (expected) =>
          expected.name.toLowerCase().includes(item.name.toLowerCase()) ||
          item.name.toLowerCase().includes(expected.name.toLowerCase())
      );
      return {
        ...item,
        matched: !!match,
        shoppingItemId: match?.id,
      };
    });

    setExtractedItems(matchedItems);
    setIsProcessing(false);
    setStep('match');
  };

  const handleItemEdit = (index: number, field: 'name' | 'price', value: string) => {
    setExtractedItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, [field]: field === 'price' ? parseFloat(value) || 0 : value }
          : item
      )
    );
  };

  const handleRemoveItem = (index: number) => {
    setExtractedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    onItemsExtracted(extractedItems);
    resetScanner();
  };

  const resetScanner = () => {
    setCapturedImage(null);
    setExtractedItems([]);
    setStep('capture');
    setEditingItem(null);
  };

  const getTotalAmount = () => {
    return extractedItems.reduce((sum, item) => sum + item.price, 0);
  };

  if (!visible) return null;

  if (hasPermission === null || hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionIcon}>{'\u{1F4F8}'}</Text>
            <Text style={styles.permissionTitle}>
              {hasPermission === null ? 'Checking permissions...' : 'Camera Access Required'}
            </Text>
            {hasPermission === false && (
              <>
                <Text style={styles.permissionText}>
                  Please enable camera access to scan receipts.
                </Text>
                <Button
                  title="Choose from Gallery"
                  onPress={handlePickImage}
                  style={styles.galleryButton}
                />
              </>
            )}
            <Button title="Close" onPress={onClose} variant="ghost" />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeIcon}>{'\u2715'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {step === 'capture' && 'Scan Receipt'}
            {step === 'review' && 'Processing...'}
            {step === 'match' && 'Review Items'}
          </Text>
          <View style={styles.headerRight} />
        </View>

        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          {['capture', 'review', 'match'].map((s, index) => (
            <React.Fragment key={s}>
              <View
                style={[
                  styles.stepDot,
                  (step === s || index < ['capture', 'review', 'match'].indexOf(step)) &&
                    styles.stepDotActive,
                ]}
              >
                <Text style={styles.stepNumber}>{index + 1}</Text>
              </View>
              {index < 2 && (
                <View
                  style={[
                    styles.stepLine,
                    index < ['capture', 'review', 'match'].indexOf(step) &&
                      styles.stepLineActive,
                  ]}
                />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Capture Step */}
        {step === 'capture' && (
          <View style={styles.captureContainer}>
            <Camera
              style={styles.camera}
              type={CameraType.back}
            >
              <View style={styles.cameraOverlay}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <Text style={styles.scanHint}>
                  Position receipt within the frame
                </Text>
              </View>
            </Camera>

            <View style={styles.captureActions}>
              <Button
                title="Take Photo"
                onPress={handleCapture}
                icon={<Text style={styles.buttonIcon}>{'\u{1F4F7}'}</Text>}
                fullWidth
              />
              <Button
                title="Choose from Gallery"
                onPress={handlePickImage}
                variant="outline"
                fullWidth
                style={styles.galleryButton}
              />
            </View>
          </View>
        )}

        {/* Processing Step */}
        {step === 'review' && isProcessing && (
          <View style={styles.processingContainer}>
            {capturedImage && (
              <Image source={{ uri: capturedImage }} style={styles.previewImage} />
            )}
            <View style={styles.processingOverlay}>
              <Text style={styles.processingIcon}>{'\u{1F50D}'}</Text>
              <Text style={styles.processingText}>Extracting items...</Text>
              <Text style={styles.processingHint}>
                Using OCR to read your receipt
              </Text>
            </View>
          </View>
        )}

        {/* Match Step */}
        {step === 'match' && (
          <ScrollView style={styles.matchContainer}>
            {/* Summary */}
            <Card variant="elevated" style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{extractedItems.length}</Text>
                  <Text style={styles.summaryLabel}>Items Found</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {extractedItems.filter((i) => i.matched).length}
                  </Text>
                  <Text style={styles.summaryLabel}>Matched</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    ${getTotalAmount().toFixed(2)}
                  </Text>
                  <Text style={styles.summaryLabel}>Total</Text>
                </View>
              </View>
            </Card>

            {/* Items List */}
            <Text style={styles.itemsTitle}>Extracted Items</Text>
            {extractedItems.map((item, index) => (
              <Card
                key={index}
                variant="outlined"
                style={StyleSheet.flatten([styles.itemCard, item.matched && styles.itemMatched])}
              >
                {editingItem === index ? (
                  <View style={styles.editForm}>
                    <Input
                      label="Item Name"
                      value={item.name}
                      onChangeText={(value) => handleItemEdit(index, 'name', value)}
                      containerStyle={styles.editInput}
                    />
                    <Input
                      label="Price"
                      value={item.price.toString()}
                      onChangeText={(value) => handleItemEdit(index, 'price', value)}
                      keyboardType="decimal-pad"
                      leftIcon={<Text>$</Text>}
                      containerStyle={styles.editInput}
                    />
                    <Button
                      title="Done"
                      onPress={() => setEditingItem(null)}
                      size="small"
                    />
                  </View>
                ) : (
                  <View style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      {item.matched && (
                        <Badge text="Matched" variant="success" size="small" />
                      )}
                    </View>
                    <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        onPress={() => setEditingItem(index)}
                        style={styles.actionButton}
                      >
                        <Text style={styles.actionIcon}>{'\u270F'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveItem(index)}
                        style={styles.actionButton}
                      >
                        <Text style={styles.actionIcon}>{'\u{1F5D1}'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </Card>
            ))}

            {/* Actions */}
            <View style={styles.matchActions}>
              <Button
                title="Rescan"
                onPress={resetScanner}
                variant="outline"
                style={styles.matchButton}
              />
              <Button
                title="Confirm Items"
                onPress={handleConfirm}
                style={styles.matchButton}
              />
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 50,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeIcon: {
    fontSize: 24,
    color: colors.text.primary,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  headerRight: {
    width: 32,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.primary.main,
  },
  stepNumber: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border.light,
  },
  stepLineActive: {
    backgroundColor: colors.primary.main,
  },
  captureContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: '80%',
    height: '60%',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.text.inverse,
    borderWidth: 3,
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanHint: {
    ...typography.body2,
    color: colors.text.inverse,
    marginTop: spacing.lg,
  },
  captureActions: {
    padding: spacing.md,
    backgroundColor: colors.background.primary,
  },
  galleryButton: {
    marginTop: spacing.sm,
  },
  buttonIcon: {
    marginRight: spacing.xs,
  },
  processingContainer: {
    flex: 1,
    position: 'relative',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  processingText: {
    ...typography.h3,
    color: colors.text.inverse,
    marginBottom: spacing.xs,
  },
  processingHint: {
    ...typography.body2,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  matchContainer: {
    flex: 1,
    padding: spacing.md,
  },
  summaryCard: {
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
  itemsTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  itemMatched: {
    borderColor: colors.success,
    backgroundColor: colors.success + '05',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemName: {
    ...typography.body1,
    color: colors.text.primary,
  },
  itemPrice: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  itemActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: spacing.xs,
  },
  actionIcon: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  editForm: {
    gap: spacing.sm,
  },
  editInput: {
    marginBottom: 0,
  },
  matchActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
  matchButton: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  permissionTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  permissionText: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
