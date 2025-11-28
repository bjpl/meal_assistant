import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/base/Card';
import { Button } from '../../components/base/Button';
import { Input } from '../../components/base/Input';
import { Badge } from '../../components/base/Badge';
import { AdUploader, RecentUploads } from '../../components/ads/AdUploader';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';

// Mock store data
const stores = [
  { id: 'costco', name: 'Costco' },
  { id: 'safeway', name: 'Safeway' },
  { id: 'wholefoods', name: 'Whole Foods' },
  { id: 'walmart', name: 'Walmart' },
  { id: 'kroger', name: 'Kroger' },
  { id: 'target', name: 'Target' },
  { id: 'kyopo', name: 'Kyopo' },
  { id: 'megamart', name: 'Megamart' },
];

// Mock recent uploads
const mockRecentUploads = [
  {
    id: 'ad-1',
    storeName: 'Costco',
    uploadedAt: new Date(Date.now() - 3600000).toISOString(),
    status: 'ready',
    dealsCount: 12,
  },
  {
    id: 'ad-2',
    storeName: 'Safeway',
    uploadedAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'reviewed',
    dealsCount: 8,
  },
  {
    id: 'ad-3',
    storeName: 'Whole Foods',
    uploadedAt: new Date(Date.now() - 172800000).toISOString(),
    status: 'processing',
    dealsCount: 0,
  },
];

export interface AdUploadScreenProps {
  navigation: any;
}

export const AdUploadScreen: React.FC<AdUploadScreenProps> = ({ navigation }) => {
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    type: 'pdf' | 'image';
    name: string;
  } | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [adPeriodStart, setAdPeriodStart] = useState(getThisWeekStart());
  const [adPeriodEnd, setAdPeriodEnd] = useState(getThisWeekEnd());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function getThisWeekStart(): string {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek;
    const sunday = new Date(now.setDate(diff));
    return formatDate(sunday);
  }

  function getThisWeekEnd(): string {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + 6;
    const saturday = new Date(now.setDate(diff));
    return formatDate(saturday);
  }

  function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  const handleFileSelect = (file: { uri: string; type: 'pdf' | 'image'; name: string }) => {
    setSelectedFile(file.uri ? file : null);
    setError(null);
  };

  const handleCameraCapture = () => {
    // In real app, would open camera
    setSelectedFile({
      uri: 'file://camera-capture.jpg',
      type: 'image',
      name: 'camera_capture.jpg',
    });
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedStore) {
      setError('Please select a file and store');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setUploadProgress(i);
      }

      // Navigate to processing screen
      navigation.navigate('AdProcessing', {
        adId: `ad-${Date.now()}`,
        storeId: selectedStore,
        storeName: stores.find(s => s.id === selectedStore)?.name,
      });
    } catch (err) {
      setError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRecentSelect = (adId: string) => {
    const upload = mockRecentUploads.find(u => u.id === adId);
    if (upload?.status === 'ready') {
      navigation.navigate('DealReview', { adId });
    } else if (upload?.status === 'processing') {
      navigation.navigate('AdProcessing', { adId });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Upload Ad</Text>
          <Text style={styles.subtitle}>
            Scan your weekly ad to find matching deals
          </Text>
        </View>

        {/* File Upload */}
        <AdUploader
          onFileSelect={handleFileSelect}
          onCameraCapture={handleCameraCapture}
          onUpload={handleUpload}
          selectedFile={selectedFile}
          uploadProgress={uploadProgress}
          isUploading={isUploading}
          error={error || undefined}
        />

        {/* Store Selection */}
        <Card variant="outlined" style={styles.section}>
          <Text style={styles.sectionTitle}>Select Store</Text>
          <TouchableOpacity
            style={styles.storeSelector}
            onPress={() => setShowStorePicker(true)}
          >
            {selectedStore ? (
              <View style={styles.selectedStore}>
                <Text style={styles.selectedStoreText}>
                  {stores.find(s => s.id === selectedStore)?.name}
                </Text>
                <Badge text="Selected" variant="success" size="small" />
              </View>
            ) : (
              <Text style={styles.storePlaceholder}>Tap to select store</Text>
            )}
            <Text style={styles.chevron}>{'\u276F'}</Text>
          </TouchableOpacity>
        </Card>

        {/* Ad Period */}
        <Card variant="outlined" style={styles.section}>
          <Text style={styles.sectionTitle}>Ad Period</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <TouchableOpacity style={styles.dateInput}>
                <Text style={styles.dateText}>{adPeriodStart}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.dateSeparator}>to</Text>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>End Date</Text>
              <TouchableOpacity style={styles.dateInput}>
                <Text style={styles.dateText}>{adPeriodEnd}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.quickDateButtons}>
            <TouchableOpacity
              style={styles.quickDateButton}
              onPress={() => {
                setAdPeriodStart(getThisWeekStart());
                setAdPeriodEnd(getThisWeekEnd());
              }}
            >
              <Text style={styles.quickDateText}>This Week</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickDateButton}>
              <Text style={styles.quickDateText}>Next Week</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Upload Button */}
        <Button
          title={isUploading ? 'Uploading...' : 'Upload & Process Ad'}
          onPress={handleUpload}
          fullWidth
          disabled={!selectedFile || !selectedStore || isUploading}
          loading={isUploading}
          style={styles.uploadButton}
        />

        {/* Processing Time Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>{'\u{23F1}'}</Text>
          <Text style={styles.infoText}>
            Processing typically takes less than 10 seconds
          </Text>
        </View>

        {/* Recent Uploads */}
        <RecentUploads
          uploads={mockRecentUploads}
          onSelect={handleRecentSelect}
          style={styles.recentSection}
        />
      </ScrollView>

      {/* Store Picker Modal */}
      <Modal
        visible={showStorePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowStorePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Store</Text>
              <TouchableOpacity onPress={() => setShowStorePicker(false)}>
                <Text style={styles.modalClose}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.storeList}>
              {stores.map(store => (
                <TouchableOpacity
                  key={store.id}
                  style={[
                    styles.storeOption,
                    selectedStore === store.id && styles.storeOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedStore(store.id);
                    setShowStorePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.storeOptionText,
                      selectedStore === store.id && styles.storeOptionTextSelected,
                    ]}
                  >
                    {store.name}
                  </Text>
                  {selectedStore === store.id && (
                    <Text style={styles.storeCheckmark}>{'\u2713'}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button
              title="Add New Store"
              onPress={() => {}}
              variant="outline"
              fullWidth
              style={styles.addStoreButton}
            />
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    padding: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  section: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  storeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  selectedStore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectedStoreText: {
    ...typography.body1,
    color: colors.text.primary,
    fontWeight: '600',
  },
  storePlaceholder: {
    ...typography.body1,
    color: colors.text.disabled,
  },
  chevron: {
    color: colors.text.disabled,
    fontSize: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateField: {
    flex: 1,
  },
  dateLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  dateText: {
    ...typography.body2,
    color: colors.text.primary,
  },
  dateSeparator: {
    ...typography.body2,
    color: colors.text.secondary,
    marginHorizontal: spacing.md,
  },
  quickDateButtons: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  quickDateButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.full,
  },
  quickDateText: {
    ...typography.caption,
    color: colors.primary.main,
    fontWeight: '600',
  },
  uploadButton: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  infoText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  recentSection: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  modalClose: {
    fontSize: 20,
    color: colors.text.secondary,
    padding: spacing.xs,
  },
  storeList: {
    maxHeight: 300,
  },
  storeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  storeOptionSelected: {
    backgroundColor: colors.primary.main + '10',
  },
  storeOptionText: {
    ...typography.body1,
    color: colors.text.primary,
  },
  storeOptionTextSelected: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  storeCheckmark: {
    color: colors.primary.main,
    fontSize: 20,
    fontWeight: '700',
  },
  addStoreButton: {
    margin: spacing.md,
  },
});

export default AdUploadScreen;
