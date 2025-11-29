import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Camera, CameraType,  } from 'expo-camera';
import { Button } from '../base/Button';
import { Card } from '../base/Card';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';

interface BarcodeScannerProps {
  visible: boolean;
  onBarcodeScanned: (barcode: string, type: string) => void;
  onClose: () => void;
  onManualEntry?: () => void;
}

interface ProductLookup {
  name: string;
  brand?: string;
  category?: string;
  servingSize?: string;
  calories?: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCANNER_SIZE = SCREEN_WIDTH * 0.7;

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  visible,
  onBarcodeScanned,
  onClose,
  onManualEntry,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanLineAnimation] = useState(new Animated.Value(0));
  const [lastScannedProduct, setLastScannedProduct] = useState<ProductLookup | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    if (visible && !scanned) {
      startScanAnimation();
    }
  }, [visible, scanned]);

  const startScanAnimation = () => {
    scanLineAnimation.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);

    // Mock product lookup - in production this would call an API
    const mockProduct: ProductLookup = {
      name: 'Product from barcode',
      brand: 'Brand Name',
      category: 'pantry',
      servingSize: '1 serving',
      calories: 150,
    };

    setLastScannedProduct(mockProduct);
    onBarcodeScanned(data, type);
  };

  const handleRescan = () => {
    setScanned(false);
    setLastScannedProduct(null);
    startScanAnimation();
  };

  const translateY = scanLineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCANNER_SIZE - 4],
  });

  if (!visible) return null;

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.container}>
          <Text style={styles.message}>Requesting camera permission...</Text>
        </View>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.container}>
          <View style={styles.noPermission}>
            <Text style={styles.noPermissionIcon}>{'\u{1F4F7}'}</Text>
            <Text style={styles.noPermissionTitle}>Camera Access Required</Text>
            <Text style={styles.noPermissionText}>
              Please enable camera access in your device settings to scan barcodes.
            </Text>
            {onManualEntry && (

              <Button

                title="Enter Manually"

                onPress={onManualEntry}

                variant="outline"

                style={styles.manualButton}

              />

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
        <Camera
          style={StyleSheet.absoluteFill}
          type={CameraType.back}
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          barCodeScannerSettings={{
            barCodeTypes: [
              'upc_a',
              'upc_e',
              'ean13',
              'ean8',
              'code128',
              'code39',
              'code93',
            ],
          }}
        />

        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Top Section */}
          <View style={styles.topOverlay}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeIcon}>{'\u2715'}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Scan Barcode</Text>
            <Text style={styles.instructions}>
              Position the barcode within the frame
            </Text>
          </View>

          {/* Scanner Frame */}
          <View style={styles.scannerContainer}>
            <View style={styles.scannerFrame}>
              {/* Corner decorations */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />

              {/* Scanning line */}
              {!scanned && (
                <Animated.View
                  style={[
                    styles.scanLine,
                    { transform: [{ translateY }] },
                  ]}
                />
              )}

              {/* Success indicator */}
              {scanned && (
                <View style={styles.scannedIndicator}>
                  <Text style={styles.scannedIcon}>{'\u2713'}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Bottom Section */}
          <View style={styles.bottomOverlay}>
            {!scanned ? (
              <>
                <Text style={styles.hint}>
                  Works with UPC, EAN, Code 128, and more
                </Text>
                {onManualEntry && (
                  <Button
                    title="Enter Manually"
                    onPress={onManualEntry}
                    variant="outline"
                    style={styles.actionButton}
                  />
                )}
              </>
            ) : (
              <Card variant="elevated" style={styles.resultCard}>
                {lastScannedProduct ? (
                  <>
                    <Text style={styles.resultTitle}>Product Found</Text>
                    <Text style={styles.productName}>{lastScannedProduct.name}</Text>
                    {lastScannedProduct.brand && (
                      <Text style={styles.productBrand}>{lastScannedProduct.brand}</Text>
                    )}
                    <View style={styles.resultActions}>
                      <Button
                        title="Scan Another"
                        onPress={handleRescan}
                        variant="outline"
                        style={styles.resultButton}
                      />
                      <Button
                        title="Add to Inventory"
                        onPress={onClose}
                        style={styles.resultButton}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.resultTitle}>Product Not Found</Text>
                    <Text style={styles.resultText}>
                      We could not find this product in our database.
                    </Text>
                    <View style={styles.resultActions}>
                      <Button
                        title="Scan Again"
                        onPress={handleRescan}
                        variant="outline"
                        style={styles.resultButton}
                      />
                      {onManualEntry && (
                        <Button
                          title="Add Manually"
                          onPress={onManualEntry}
                          style={styles.resultButton}
                        />
                      )}
                    </View>
                  </>
                )}
              </Card>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topOverlay: {
    paddingTop: 60,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingBottom: spacing.lg,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: spacing.md,
    padding: spacing.sm,
    zIndex: 1,
  },
  closeIcon: {
    fontSize: 24,
    color: colors.text.inverse,
  },
  title: {
    ...typography.h2,
    color: colors.text.inverse,
    textAlign: 'center',
  },
  instructions: {
    ...typography.body2,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  scannerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrame: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.primary.main,
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: colors.primary.main,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  scannedIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannedIcon: {
    fontSize: 40,
    color: colors.text.inverse,
  },
  bottomOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: 40,
  },
  hint: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  actionButton: {
    borderColor: colors.text.inverse,
  },
  message: {
    ...typography.body1,
    color: colors.text.inverse,
    textAlign: 'center',
  },
  noPermission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  noPermissionIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  noPermissionTitle: {
    ...typography.h2,
    color: colors.text.inverse,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  noPermissionText: {
    ...typography.body2,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  manualButton: {
    marginBottom: spacing.sm,
    borderColor: colors.text.inverse,
  },
  resultCard: {
    padding: spacing.md,
  },
  resultTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  productName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  productBrand: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  resultText: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  resultButton: {
    flex: 1,
  },
});
