import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/base/Card';
import { Button } from '../../components/base/Button';
import { Badge } from '../../components/base/Badge';
import { Input } from '../../components/base/Input';
import { TemplateCard } from '../../components/ads/TemplateCard';
import { AccuracyChart } from '../../components/ads/AccuracyChart';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { AdTemplate, AccuracyPoint } from '../../types/ads.types';

// Mock templates data
const mockTemplates: AdTemplate[] = [
  {
    id: 'template-1',
    name: 'Costco Monthly Coupon Book',
    storeId: 'costco',
    storeName: 'Costco',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'current-user',
    isPublic: false,
    version: 3,
    versionHistory: [
      { version: 1, createdAt: '', annotations: [], accuracy: 65 },
      { version: 2, createdAt: '', annotations: [], accuracy: 72 },
      { version: 3, createdAt: '', annotations: [], accuracy: 82 },
    ],
    annotations: [],
    accuracy: 82,
    usageCount: 12,
    successfulExtractions: 10,
    ratings: [],
    averageRating: 4.5,
    tags: ['coupon-book', 'monthly'],
  },
  {
    id: 'template-2',
    name: 'Safeway Weekly Circular',
    storeId: 'safeway',
    storeName: 'Safeway',
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    createdBy: 'current-user',
    isPublic: true,
    version: 2,
    versionHistory: [
      { version: 1, createdAt: '', annotations: [], accuracy: 58 },
      { version: 2, createdAt: '', annotations: [], accuracy: 75 },
    ],
    annotations: [],
    accuracy: 75,
    usageCount: 45,
    successfulExtractions: 34,
    ratings: [
      { userId: 'user-1', rating: 4, createdAt: '' },
      { userId: 'user-2', rating: 5, createdAt: '' },
    ],
    averageRating: 4.5,
    tags: ['weekly', 'produce'],
  },
];

const mockPublicTemplates: AdTemplate[] = [
  {
    id: 'public-1',
    name: 'Whole Foods Standard Layout',
    storeId: 'wholefoods',
    storeName: 'Whole Foods',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    createdBy: 'community',
    isPublic: true,
    version: 5,
    versionHistory: [],
    annotations: [],
    accuracy: 88,
    usageCount: 234,
    successfulExtractions: 206,
    ratings: [],
    averageRating: 4.7,
    tags: ['weekly-ad', 'organic'],
  },
  {
    id: 'public-2',
    name: 'Kroger Digital Circular',
    storeId: 'kroger',
    storeName: 'Kroger',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    createdBy: 'community',
    isPublic: true,
    version: 8,
    versionHistory: [],
    annotations: [],
    accuracy: 91,
    usageCount: 567,
    successfulExtractions: 516,
    ratings: [],
    averageRating: 4.8,
    tags: ['digital', 'weekly'],
  },
];

const mockAccuracyData: AccuracyPoint[] = [
  { date: new Date(Date.now() - 28 * 86400000).toISOString(), accuracy: 58, dealsProcessed: 15 },
  { date: new Date(Date.now() - 21 * 86400000).toISOString(), accuracy: 65, dealsProcessed: 22 },
  { date: new Date(Date.now() - 14 * 86400000).toISOString(), accuracy: 72, dealsProcessed: 18 },
  { date: new Date(Date.now() - 7 * 86400000).toISOString(), accuracy: 78, dealsProcessed: 25 },
  { date: new Date().toISOString(), accuracy: 82, dealsProcessed: 20 },
];

type TabType = 'my' | 'public';

export interface TemplateManagerScreenProps {
  navigation: any;
  route?: {
    params?: {
      newTemplate?: any;
    };
  };
}

export const TemplateManagerScreen: React.FC<TemplateManagerScreenProps> = ({
  navigation,
  route,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('my');
  const [templates, setTemplates] = useState<AdTemplate[]>(mockTemplates);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<AdTemplate | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const filteredTemplates = (activeTab === 'my' ? templates : mockPublicTemplates).filter(
    t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.storeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTemplatePress = (template: AdTemplate) => {
    setSelectedTemplate(template);
  };

  const handleTestTemplate = (templateId: string) => {
    navigation.navigate('AdUpload', { testTemplateId: templateId });
  };

  const handleShareTemplate = (templateId: string) => {
    setTemplates(prev =>
      prev.map(t =>
        t.id === templateId ? { ...t, isPublic: true, updatedAt: new Date().toISOString() } : t
      )
    );
  };

  const handleDownloadTemplate = (template: AdTemplate) => {
    // Add to my templates
    const downloadedTemplate = {
      ...template,
      id: `downloaded-${Date.now()}`,
      createdBy: 'current-user',
      isPublic: false,
    };
    setTemplates(prev => [...prev, downloadedTemplate]);
  };

  const handleDeleteTemplate = () => {
    if (selectedTemplate) {
      setTemplates(prev => prev.filter(t => t.id !== selectedTemplate.id));
      setSelectedTemplate(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleRollback = (version: number) => {
    if (selectedTemplate) {
      const versionData = selectedTemplate.versionHistory.find(v => v.version === version);
      if (versionData) {
        setTemplates(prev =>
          prev.map(t =>
            t.id === selectedTemplate.id
              ? {
                  ...t,
                  version: versionData.version,
                  accuracy: versionData.accuracy,
                  annotations: versionData.annotations,
                  updatedAt: new Date().toISOString(),
                }
              : t
          )
        );
        setShowVersionHistory(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Templates</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdAnnotation', { newTemplate: true })}>
          <Text style={styles.addButton}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Accuracy Overview */}
      <Card variant="elevated" style={styles.accuracyCard}>
        <AccuracyChart
          data={mockAccuracyData}
          height={100}
          showLabels={false}
        />
      </Card>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.tabActive]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
            My Templates ({templates.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'public' && styles.tabActive]}
          onPress={() => setActiveTab('public')}
        >
          <Text style={[styles.tabText, activeTab === 'public' && styles.tabTextActive]}>
            Community
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search templates..."
          style={styles.searchInput}
        />
      </View>

      {/* Templates List */}
      <FlatList
        data={filteredTemplates}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TemplateCard
            template={item}
            onPress={() => handleTemplatePress(item)}
            onTest={() => handleTestTemplate(item.id)}
            onShare={activeTab === 'my' && !item.isPublic ? () => handleShareTemplate(item.id) : undefined}
            onDownload={activeTab === 'public' ? () => handleDownloadTemplate(item) : undefined}
            style={styles.templateCard}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\u{1F4C2}'}</Text>
            <Text style={styles.emptyTitle}>No templates found</Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'my'
                ? 'Create your first template by annotating an ad'
                : 'Try a different search term'}
            </Text>
            {activeTab === 'my' && (
              <Button
                title="Create Template"
                onPress={() => navigation.navigate('AdUpload')}
                style={styles.emptyButton}
              />
            )}
          </View>
        }
      />

      {/* Template Detail Modal */}
      <Modal
        visible={!!selectedTemplate}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedTemplate(null)}
      >
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={styles.modalContent}>
            {selectedTemplate && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedTemplate.name}</Text>
                  <TouchableOpacity onPress={() => setSelectedTemplate(null)}>
                    <Text style={styles.modalClose}>{'\u2715'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Store</Text>
                  <Text style={styles.detailValue}>{selectedTemplate.storeName}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Accuracy</Text>
                  <Text style={[styles.detailValue, { color: colors.success }]}>
                    {selectedTemplate.accuracy}%
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Version</Text>
                  <TouchableOpacity
                    onPress={() => setShowVersionHistory(true)}
                    style={styles.versionButton}
                  >
                    <Text style={styles.detailValue}>v{selectedTemplate.version}</Text>
                    <Text style={styles.versionArrow}>{'\u276F'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Used</Text>
                  <Text style={styles.detailValue}>
                    {selectedTemplate.usageCount} times ({selectedTemplate.successfulExtractions} successful)
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <Button
                    title="Test"
                    onPress={() => {
                      setSelectedTemplate(null);
                      handleTestTemplate(selectedTemplate.id);
                    }}
                    variant="outline"
                    style={styles.modalAction}
                  />
                  <Button
                    title="Edit"
                    onPress={() => {
                      setSelectedTemplate(null);
                      navigation.navigate('AdAnnotation', { templateId: selectedTemplate.id });
                    }}
                    style={styles.modalAction}
                  />
                </View>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => setShowDeleteConfirm(true)}
                >
                  <Text style={styles.deleteText}>{'\u{1F5D1}'} Delete Template</Text>
                </TouchableOpacity>
              </>
            )}
          </Card>
        </View>
      </Modal>

      {/* Version History Modal */}
      <Modal
        visible={showVersionHistory}
        animationType="slide"
        transparent
        onRequestClose={() => setShowVersionHistory(false)}
      >
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Version History</Text>
              <TouchableOpacity onPress={() => setShowVersionHistory(false)}>
                <Text style={styles.modalClose}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.versionList}>
              {selectedTemplate?.versionHistory.map((version, index) => (
                <View
                  key={version.version}
                  style={[
                    styles.versionItem,
                    index < (selectedTemplate?.versionHistory.length ?? 1) - 1 && styles.versionItemBorder,
                  ]}
                >
                  <View style={styles.versionInfo}>
                    <Text style={styles.versionNumber}>v{version.version}</Text>
                    <Text style={styles.versionAccuracy}>{version.accuracy}% accuracy</Text>
                  </View>
                  {version.version !== selectedTemplate?.version && (
                    <Button
                      title="Rollback"
                      onPress={() => handleRollback(version.version)}
                      variant="outline"
                      size="small"
                    />
                  )}
                  {version.version === selectedTemplate?.version && (
                    <Badge text="Current" variant="success" size="small" />
                  )}
                </View>
              ))}
            </ScrollView>
          </Card>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Delete Template?</Text>
            <Text style={styles.confirmText}>
              This action cannot be undone. The template "{selectedTemplate?.name}" will be permanently deleted.
            </Text>
            <View style={styles.confirmActions}>
              <Button
                title="Cancel"
                onPress={() => setShowDeleteConfirm(false)}
                variant="outline"
                style={styles.confirmAction}
              />
              <Button
                title="Delete"
                onPress={handleDeleteTemplate}
                style={[styles.confirmAction, styles.deleteConfirmButton]}
              />
            </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    fontSize: 24,
    color: colors.text.primary,
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  addButton: {
    fontSize: 28,
    color: colors.primary.main,
    padding: spacing.xs,
  },
  accuracyCard: {
    margin: spacing.md,
    padding: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary.main,
  },
  tabText: {
    ...typography.body1,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  searchContainer: {
    padding: spacing.md,
    backgroundColor: colors.background.primary,
  },
  searchInput: {
    backgroundColor: colors.background.secondary,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  templateCard: {
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyButton: {
    minWidth: 150,
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
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  detailLabel: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  detailValue: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  versionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  versionArrow: {
    color: colors.text.disabled,
    marginLeft: spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  modalAction: {
    flex: 1,
  },
  deleteButton: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  deleteText: {
    ...typography.body2,
    color: colors.error,
  },
  versionList: {
    maxHeight: 300,
  },
  versionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  versionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  versionInfo: {},
  versionNumber: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  versionAccuracy: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  confirmModal: {
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  confirmTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  confirmText: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  confirmAction: {
    flex: 1,
  },
  deleteConfirmButton: {
    backgroundColor: colors.error,
  },
});

export default TemplateManagerScreen;
