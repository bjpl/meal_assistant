import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { ProgressBar } from '../base/ProgressBar';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

export interface AdUploaderProps {
  onFileSelect: (file: { uri: string; type: 'pdf' | 'image'; name: string }) => void;
  onCameraCapture: () => void;
  onUpload: () => void;
  selectedFile?: { uri: string; type: 'pdf' | 'image'; name: string } | null;
  uploadProgress?: number;
  isUploading?: boolean;
  error?: string;
  style?: ViewStyle;
}

export const AdUploader: React.FC<AdUploaderProps> = ({
  onFileSelect,
  onCameraCapture,
  onUpload,
  selectedFile,
  uploadProgress = 0,
  isUploading = false,
  error,
  style,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  // Simulated file picker - in real app would use react-native-document-picker
  const handleFilePicker = () => {
    // Mock file selection
    onFileSelect({
      uri: 'file://mock-ad.pdf',
      type: 'pdf',
      name: 'weekly_ad.pdf',
    });
  };

  // Simulated image picker - in real app would use react-native-image-picker
  const handleImagePicker = () => {
    onFileSelect({
      uri: 'file://mock-ad-image.jpg',
      type: 'image',
      name: 'ad_photo.jpg',
    });
  };

  return (
    <View style={[styles.container, style]}>
      {/* Drop zone */}
      <TouchableOpacity
        style={[
          styles.dropZone,
          isDragging && styles.dropZoneDragging,
          selectedFile && styles.dropZoneWithFile,
        ]}
        onPress={handleFilePicker}
        activeOpacity={0.7}
      >
        {selectedFile ? (
          <View style={styles.previewContainer}>
            {selectedFile.type === 'image' ? (
              <Image
                source={{ uri: selectedFile.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.pdfPreview}>
                <Text style={styles.pdfIcon}>{'\u{1F4C4}'}</Text>
                <Text style={styles.fileName}>{selectedFile.name}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => onFileSelect({ uri: '', type: 'pdf', name: '' })}
            >
              <Text style={styles.clearButtonText}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.dropZoneContent}>
            <Text style={styles.dropIcon}>{'\u{1F4E5}'}</Text>
            <Text style={styles.dropTitle}>Drop ad here</Text>
            <Text style={styles.dropSubtitle}>or tap to browse files</Text>
            <Text style={styles.supportedFormats}>
              Supports PDF, JPG, PNG
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Alternative upload options */}
      <View style={styles.optionsRow}>
        <TouchableOpacity style={styles.optionButton} onPress={handleImagePicker}>
          <Text style={styles.optionIcon}>{'\u{1F5BC}'}</Text>
          <Text style={styles.optionText}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionButton} onPress={onCameraCapture}>
          <Text style={styles.optionIcon}>{'\u{1F4F7}'}</Text>
          <Text style={styles.optionText}>Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionButton} onPress={handleFilePicker}>
          <Text style={styles.optionIcon}>{'\u{1F4C1}'}</Text>
          <Text style={styles.optionText}>Files</Text>
        </TouchableOpacity>
      </View>

      {/* Upload progress */}
      {isUploading && (
        <Card variant="filled" style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <ActivityIndicator size="small" color={colors.primary.main} />
            <Text style={styles.progressText}>Uploading...</Text>
          </View>
          <ProgressBar progress={uploadProgress} height={8} />
          <Text style={styles.progressPercent}>{Math.round(uploadProgress)}%</Text>
        </Card>
      )}

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>{'\u26A0'}</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Upload button */}
      {selectedFile && !isUploading && (
        <Button
          title="Upload Ad"
          onPress={onUpload}
          fullWidth
          disabled={!selectedFile.uri}
          style={styles.uploadButton}
        />
      )}
    </View>
  );
};

// Recent uploads component
export const RecentUploads: React.FC<{
  uploads: Array<{
    id: string;
    storeName: string;
    thumbnailUri?: string;
    uploadedAt: string;
    status: string;
    dealsCount?: number;
  }>;
  onSelect: (id: string) => void;
  style?: ViewStyle;
}> = ({ uploads, onSelect, style }) => {
  if (uploads.length === 0) {
    return (
      <View style={[styles.emptyUploads, style]}>
        <Text style={styles.emptyText}>No recent uploads</Text>
      </View>
    );
  }

  return (
    <View style={[styles.recentContainer, style]}>
      <Text style={styles.recentTitle}>Recent Uploads</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {uploads.map(upload => (
          <TouchableOpacity
            key={upload.id}
            style={styles.recentCard}
            onPress={() => onSelect(upload.id)}
          >
            <View style={styles.recentThumbnail}>
              {upload.thumbnailUri ? (
                <Image
                  source={{ uri: upload.thumbnailUri }}
                  style={styles.recentImage}
                />
              ) : (
                <Text style={styles.recentIcon}>{'\u{1F4C4}'}</Text>
              )}
            </View>
            <Text style={styles.recentStore} numberOfLines={1}>
              {upload.storeName}
            </Text>
            <Text style={styles.recentDate}>
              {formatRelativeDate(upload.uploadedAt)}
            </Text>
            {upload.dealsCount !== undefined && (
              <Text style={styles.recentDeals}>
                {upload.dealsCount} deals
              </Text>
            )}
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    upload.status === 'ready'
                      ? colors.success
                      : upload.status === 'processing'
                      ? colors.warning
                      : upload.status === 'error'
                      ? colors.error
                      : colors.text.disabled,
                },
              ]}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border.medium,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.secondary,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  dropZoneDragging: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.main + '10',
  },
  dropZoneWithFile: {
    borderStyle: 'solid',
    borderColor: colors.primary.main,
    padding: spacing.md,
  },
  dropZoneContent: {
    alignItems: 'center',
  },
  dropIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  dropTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  dropSubtitle: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  supportedFormats: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  previewContainer: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.md,
  },
  pdfPreview: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    width: '100%',
  },
  pdfIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  fileName: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  clearButton: {
    position: 'absolute',
    top: -spacing.sm,
    right: -spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  optionButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  optionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  optionText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  progressCard: {
    marginTop: spacing.md,
    padding: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressText: {
    ...typography.body2,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  progressPercent: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  errorText: {
    ...typography.body2,
    color: colors.error,
    flex: 1,
  },
  uploadButton: {
    marginTop: spacing.md,
  },
  recentContainer: {
    marginTop: spacing.lg,
  },
  recentTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  recentCard: {
    width: 100,
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  recentThumbnail: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  recentImage: {
    width: '100%',
    height: '100%',
  },
  recentIcon: {
    fontSize: 32,
  },
  recentStore: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  recentDate: {
    ...typography.caption,
    fontSize: 10,
    color: colors.text.disabled,
  },
  recentDeals: {
    ...typography.caption,
    fontSize: 10,
    color: colors.primary.main,
  },
  statusDot: {
    position: 'absolute',
    top: 4,
    right: 14,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  emptyUploads: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body2,
    color: colors.text.disabled,
  },
});
