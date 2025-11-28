import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/base/Card';
import { Button } from '../../components/base/Button';
import { Badge } from '../../components/base/Badge';
import { AnnotationCanvas, AnnotationLabelSelector } from '../../components/ads/AnnotationCanvas';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { TemplateAnnotation, AnnotationLabel } from '../../types/ads.types';

export interface AdAnnotationScreenProps {
  navigation: any;
  route: {
    params: {
      adId: string;
      imageUri: string;
      storeId: string;
      storeName: string;
      totalPages?: number;
    };
  };
}

export const AdAnnotationScreen: React.FC<AdAnnotationScreenProps> = ({
  navigation,
  route,
}) => {
  const { imageUri, storeId, storeName, totalPages = 1 } = route.params;

  const [mode, setMode] = useState<'view' | 'draw' | 'edit'>('draw');
  const [annotations, setAnnotations] = useState<TemplateAnnotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | undefined>();
  const [currentLabel, setCurrentLabel] = useState<AnnotationLabel>('individual_deal');
  const [currentPage, setCurrentPage] = useState(1);
  const [trainMode, setTrainMode] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState(`${storeName} Weekly Layout`);
  const [isPublic, setIsPublic] = useState(false);

  const handleAddAnnotation = (annotation: Omit<TemplateAnnotation, 'id'>) => {
    const newAnnotation: TemplateAnnotation = {
      ...annotation,
      id: `ann-${Date.now()}`,
    };
    setAnnotations(prev => [...prev, newAnnotation]);
  };

  const handleRemoveAnnotation = (annotationId: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== annotationId));
    setSelectedAnnotationId(undefined);
  };

  const handleUpdateAnnotation = (
    annotationId: string,
    updates: Partial<TemplateAnnotation>
  ) => {
    setAnnotations(prev =>
      prev.map(a => (a.id === annotationId ? { ...a, ...updates } : a))
    );
  };

  const handleSaveTemplate = () => {
    if (annotations.length < 3) {
      // Show warning - need at least 3 deals
      return;
    }
    setShowSaveModal(true);
  };

  const handleConfirmSave = () => {
    // Save template to store
    const template = {
      name: templateName,
      storeId,
      storeName,
      annotations,
      isPublic,
    };
    console.log('Saving template:', template);
    setShowSaveModal(false);
    navigation.navigate('TemplateManager', { newTemplate: template });
  };

  const handleTestTemplate = () => {
    navigation.navigate('AdProcessing', {
      adId: `test-${Date.now()}`,
      storeId,
      storeName,
      testMode: true,
      annotations,
    });
  };

  const annotationsByType = {
    page: annotations.filter(a => a.type === 'page'),
    block: annotations.filter(a => a.type === 'block'),
    component: annotations.filter(a => a.type === 'component'),
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>{'\u2190'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Annotate Ad</Text>
          <Text style={styles.subtitle}>{storeName}</Text>
        </View>
        <TouchableOpacity onPress={handleSaveTemplate}>
          <Text style={styles.saveButton}>{'\u{1F4BE}'}</Text>
        </TouchableOpacity>
      </View>

      {/* Train Mode Toggle */}
      <View style={styles.trainModeRow}>
        <View style={styles.trainModeInfo}>
          <Text style={styles.trainModeLabel}>Train Mode</Text>
          <Text style={styles.trainModeHint}>
            Tag 3+ deals to create a template
          </Text>
        </View>
        <Switch
          value={trainMode}
          onValueChange={setTrainMode}
          trackColor={{ false: colors.border.medium, true: colors.primary.main }}
          thumbColor={colors.background.primary}
        />
      </View>

      {/* Mode Selector */}
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'view' && styles.modeButtonActive]}
          onPress={() => setMode('view')}
        >
          <Text style={[styles.modeText, mode === 'view' && styles.modeTextActive]}>
            {'\u{1F441}'} View
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'draw' && styles.modeButtonActive]}
          onPress={() => setMode('draw')}
        >
          <Text style={[styles.modeText, mode === 'draw' && styles.modeTextActive]}>
            {'\u270E'} Draw
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'edit' && styles.modeButtonActive]}
          onPress={() => setMode('edit')}
        >
          <Text style={[styles.modeText, mode === 'edit' && styles.modeTextActive]}>
            {'\u2699'} Edit
          </Text>
        </TouchableOpacity>
      </View>

      {/* Label Selector (when in draw mode) */}
      {mode === 'draw' && (
        <AnnotationLabelSelector
          selectedLabel={currentLabel}
          onSelectLabel={setCurrentLabel}
        />
      )}

      {/* Canvas */}
      <AnnotationCanvas
        imageUri={imageUri || 'https://via.placeholder.com/400x600'}
        annotations={annotations}
        onAddAnnotation={handleAddAnnotation}
        onRemoveAnnotation={handleRemoveAnnotation}
        onUpdateAnnotation={handleUpdateAnnotation}
        selectedAnnotationId={selectedAnnotationId}
        onSelectAnnotation={setSelectedAnnotationId}
        mode={mode}
        currentLabel={currentLabel}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        style={styles.canvas}
      />

      {/* Annotation Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{annotationsByType.block.length}</Text>
          <Text style={styles.summaryLabel}>Deals</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{annotationsByType.component.length}</Text>
          <Text style={styles.summaryLabel}>Details</Text>
        </View>
        <View style={styles.summaryItem}>
          <Badge
            text={annotations.length >= 3 ? 'Ready' : `${3 - annotations.length} more`}
            variant={annotations.length >= 3 ? 'success' : 'warning'}
            size="small"
          />
          <Text style={styles.summaryLabel}>Template</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {annotations.length >= 3 && (
          <Button
            title="Test Template"
            onPress={handleTestTemplate}
            variant="outline"
            style={styles.actionButton}
          />
        )}
        <Button
          title={annotations.length >= 3 ? 'Save Template' : 'Add More Deals'}
          onPress={handleSaveTemplate}
          disabled={annotations.length < 3}
          style={styles.actionButton}
        />
      </View>

      {/* Save Template Modal */}
      <Modal
        visible={showSaveModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Template</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Template Name</Text>
              <TextInput
                style={styles.textInput}
                value={templateName}
                onChangeText={setTemplateName}
                placeholder="e.g., Whole Foods Weekly Layout"
                placeholderTextColor={colors.text.disabled}
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.formLabel}>Share Publicly</Text>
                  <Text style={styles.formHint}>
                    Help others by sharing your template
                  </Text>
                </View>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: colors.border.medium, true: colors.primary.main }}
                />
              </View>
            </View>

            <View style={styles.templateStats}>
              <View style={styles.templateStat}>
                <Text style={styles.templateStatValue}>{annotations.length}</Text>
                <Text style={styles.templateStatLabel}>Annotations</Text>
              </View>
              <View style={styles.templateStat}>
                <Text style={styles.templateStatValue}>{annotationsByType.block.length}</Text>
                <Text style={styles.templateStatLabel}>Deals Tagged</Text>
              </View>
              <View style={styles.templateStat}>
                <Text style={styles.templateStatValue}>{totalPages}</Text>
                <Text style={styles.templateStatLabel}>Pages</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowSaveModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Save"
                onPress={handleConfirmSave}
                style={styles.modalButton}
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
  headerCenter: {
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  saveButton: {
    fontSize: 24,
    padding: spacing.xs,
  },
  trainModeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.warning + '15',
    borderBottomWidth: 1,
    borderBottomColor: colors.warning + '30',
  },
  trainModeInfo: {
    flex: 1,
  },
  trainModeLabel: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  trainModeHint: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.background.primary,
    padding: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  modeButtonActive: {
    backgroundColor: colors.primary.main + '15',
  },
  modeText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  modeTextActive: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  canvas: {
    flex: 1,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs / 2,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalContent: {
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  formHint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs / 2,
  },
  textInput: {
    ...typography.body1,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    color: colors.text.primary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  templateStat: {
    alignItems: 'center',
  },
  templateStatValue: {
    ...typography.h3,
    color: colors.primary.main,
  },
  templateStatLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});

export default AdAnnotationScreen;
