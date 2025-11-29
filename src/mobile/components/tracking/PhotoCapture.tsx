import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import { Button } from '../base/Button';
import { IconButton } from '../base/IconButton';
import { colors, spacing, borderRadius } from '../../utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface PhotoCaptureProps {
  onPhotoTaken: (uri: string) => void;
  onCancel: () => void;
  visible: boolean;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  onPhotoTaken,
  onCancel,
  visible,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [facing, setFacing] = useState<CameraType>(CameraType.back);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const cameraRef = useRef<Camera>(null);

  React.useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      if (photo?.uri) {
        setPreviewUri(photo.uri);
      }
    }
  };

  const confirmPhoto = () => {
    if (previewUri) {
      onPhotoTaken(previewUri);
      setPreviewUri(null);
    }
  };

  const retakePhoto = () => {
    setPreviewUri(null);
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === CameraType.back ? CameraType.front : CameraType.back));
  };

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.centered}>
          <Text style={styles.text}>Requesting camera permission...</Text>
        </View>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.centered}>
          <Text style={styles.text}>Camera access denied</Text>
          <Text style={styles.subtext}>
            Please enable camera access in your device settings
          </Text>
          <Button title="Close" onPress={onCancel} style={styles.closeButton} />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {previewUri ? (
          // Preview Mode
          <View style={styles.previewContainer}>
            <Image source={{ uri: previewUri }} style={styles.preview} />
            <View style={styles.previewOverlay}>
              <Text style={styles.previewTitle}>Looking good?</Text>
              <Text style={styles.previewSubtitle}>
                Make sure your meal is clearly visible
              </Text>
            </View>
            <View style={styles.previewActions}>
              <Button
                title="Retake"
                onPress={retakePhoto}
                variant="outline"
                style={styles.previewButton}
              />
              <Button
                title="Use Photo"
                onPress={confirmPhoto}
                style={styles.previewButton}
              />
            </View>
          </View>
        ) : (
          // Camera Mode
          <Camera
            ref={cameraRef}
            style={styles.camera}
            type={facing}
          >
            {/* Guide Overlay */}
            <View style={styles.guideOverlay}>
              <View style={styles.guideFrame}>
                <View style={styles.guideCorner} />
                <View style={[styles.guideCorner, styles.topRight]} />
                <View style={[styles.guideCorner, styles.bottomLeft]} />
                <View style={[styles.guideCorner, styles.bottomRight]} />
              </View>
              <Text style={styles.guideText}>
                Position your meal within the frame
              </Text>
            </View>

            {/* Top Controls */}
            <View style={styles.topControls}>
              <IconButton
                icon={'\u2715'}
                onPress={onCancel}
                variant="ghost"
                size="large"
                style={styles.controlButton}
              />
              <IconButton
                icon={'\u{1F504}'}
                onPress={toggleCameraFacing}
                variant="ghost"
                size="large"
                style={styles.controlButton}
              />
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
              <View style={styles.captureRow}>
                <View style={styles.spacer} />
                <TouchableOpacity
                  onPress={takePicture}
                  style={styles.captureButton}
                >
                  <View style={styles.captureInner} />
                </TouchableOpacity>
                <View style={styles.spacer} />
              </View>
              <Text style={styles.tipText}>
                Tip: Good lighting helps with nutrition detection
              </Text>
            </View>
          </Camera>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.text.primary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.text.primary,
    padding: spacing.lg,
  },
  text: {
    color: colors.text.inverse,
    fontSize: 18,
    textAlign: 'center',
  },
  subtext: {
    color: colors.text.disabled,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  closeButton: {
    marginTop: spacing.lg,
  },
  camera: {
    flex: 1,
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideFrame: {
    width: SCREEN_WIDTH - spacing.xl * 2,
    height: SCREEN_WIDTH - spacing.xl * 2,
    borderWidth: 0,
    position: 'relative',
  },
  guideCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.text.inverse,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    top: 0,
    left: 0,
  },
  topRight: {
    borderLeftWidth: 0,
    borderRightWidth: 3,
    left: undefined,
    right: 0,
  },
  bottomLeft: {
    borderTopWidth: 0,
    borderBottomWidth: 3,
    top: undefined,
    bottom: 0,
  },
  bottomRight: {
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    top: undefined,
    left: undefined,
    bottom: 0,
    right: 0,
  },
  guideText: {
    color: colors.text.inverse,
    fontSize: 14,
    marginTop: spacing.md,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingTop: spacing.xxl,
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  captureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.text.inverse,
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.text.inverse,
  },
  tipText: {
    color: colors.text.inverse,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
    opacity: 0.8,
  },
  previewContainer: {
    flex: 1,
  },
  preview: {
    flex: 1,
    resizeMode: 'cover',
  },
  previewOverlay: {
    position: 'absolute',
    top: spacing.xxl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  previewTitle: {
    color: colors.text.inverse,
    fontSize: 24,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  previewSubtitle: {
    color: colors.text.inverse,
    fontSize: 14,
    marginTop: spacing.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  previewActions: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
  previewButton: {
    flex: 1,
  },
});
