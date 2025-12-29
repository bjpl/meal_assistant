/**
 * Flyer Upload Modal
 * Allows users to manually enter deals from store flyers/ads
 * with guided UX and tooltips
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { Badge } from '../base/Badge';
import { FeatureCallout } from '../base/Tooltip';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { AppDispatch } from '../../store';
import {
  ingestFlyerDeals,
  selectRetailers,
  selectPriceLoading,
  selectUploadProgress,
  ExtractedDeal,
} from '../../store/slices/priceSlice';

interface FlyerUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface DealEntry {
  id: string;
  productName: string;
  originalPrice: string;
  salePrice: string;
  unit: string;
}

export const FlyerUploadModal: React.FC<FlyerUploadModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const retailers = useSelector(selectRetailers);
  const loading = useSelector(selectPriceLoading);
  const uploadProgress = useSelector(selectUploadProgress);

  // Form state
  const [selectedRetailer, setSelectedRetailer] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deals, setDeals] = useState<DealEntry[]>([
    { id: '1', productName: '', originalPrice: '', salePrice: '', unit: 'each' },
  ]);
  const [step, setStep] = useState<'info' | 'retailer' | 'dates' | 'deals' | 'review'>('info');

  const resetForm = useCallback(() => {
    setSelectedRetailer('');
    setStartDate('');
    setEndDate('');
    setDeals([{ id: '1', productName: '', originalPrice: '', salePrice: '', unit: 'each' }]);
    setStep('info');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const addDealRow = useCallback(() => {
    setDeals((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        productName: '',
        originalPrice: '',
        salePrice: '',
        unit: 'each',
      },
    ]);
  }, []);

  const removeDealRow = useCallback((id: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const updateDeal = useCallback(
    (id: string, field: keyof DealEntry, value: string) => {
      setDeals((prev) =>
        prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
      );
    },
    []
  );

  const validateDeals = useCallback(() => {
    const validDeals = deals.filter(
      (d) => d.productName.trim() && d.salePrice.trim()
    );
    return validDeals.length > 0;
  }, [deals]);

  const handleSubmit = useCallback(async () => {
    if (!selectedRetailer) {
      Alert.alert('Missing Info', 'Please select a retailer');
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert('Missing Info', 'Please enter the sale dates');
      return;
    }
    if (!validateDeals()) {
      Alert.alert('Missing Info', 'Please enter at least one deal');
      return;
    }

    const extractedDeals: ExtractedDeal[] = deals
      .filter((d) => d.productName.trim() && d.salePrice.trim())
      .map((d) => ({
        productName: d.productName.trim(),
        originalPrice: d.originalPrice ? parseFloat(d.originalPrice) : undefined,
        salePrice: parseFloat(d.salePrice),
        unit: d.unit,
      }));

    try {
      await dispatch(
        ingestFlyerDeals({
          extractedDeals,
          retailerId: selectedRetailer,
          startDate,
          endDate,
        })
      ).unwrap();

      Alert.alert(
        'Success!',
        `${extractedDeals.length} deals uploaded successfully. They'll now appear in price tracking.`,
        [
          {
            text: 'Great!',
            onPress: () => {
              handleClose();
              onSuccess?.();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Please try again');
    }
  }, [
    selectedRetailer,
    startDate,
    endDate,
    deals,
    validateDeals,
    dispatch,
    handleClose,
    onSuccess,
  ]);

  const renderInfoStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Add Deals from Store Flyers</Text>
      <Text style={styles.stepDescription}>
        Enter deals from weekly ads to build your price history database and get
        better deal recommendations.
      </Text>

      <FeatureCallout
        variant="tip"
        title="Why add flyer deals?"
        description="The more price data you add, the better the app can identify true deals vs fake sales, predict future prices, and recommend when to stock up."
      />

      <FeatureCallout
        variant="info"
        title="What you'll need"
        description="Have your store's weekly ad handy - physical flyer, email, or app. You'll enter the store, sale dates, and individual deals."
      />

      <View style={styles.exampleCard}>
        <Text style={styles.exampleTitle}>Example Entry:</Text>
        <View style={styles.exampleRow}>
          <Text style={styles.exampleLabel}>Store:</Text>
          <Text style={styles.exampleValue}>Safeway</Text>
        </View>
        <View style={styles.exampleRow}>
          <Text style={styles.exampleLabel}>Dates:</Text>
          <Text style={styles.exampleValue}>Dec 25 - Dec 31</Text>
        </View>
        <View style={styles.exampleRow}>
          <Text style={styles.exampleLabel}>Deal:</Text>
          <Text style={styles.exampleValue}>Chicken Breast $2.99/lb (was $4.99)</Text>
        </View>
      </View>

      <Button
        title="Get Started"
        onPress={() => setStep('retailer')}
        fullWidth
        style={styles.nextButton}
      />
    </View>
  );

  const renderRetailerStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Store</Text>
      <Text style={styles.stepDescription}>
        Which store is this ad from?
      </Text>

      <View style={styles.retailerGrid}>
        {retailers.map((retailer) => (
          <TouchableOpacity
            key={retailer.id}
            style={[
              styles.retailerCard,
              selectedRetailer === retailer.id && styles.retailerCardSelected,
            ]}
            onPress={() => setSelectedRetailer(retailer.id)}
          >
            <Text style={styles.retailerIcon}>{'\u{1F3EA}'}</Text>
            <Text
              style={[
                styles.retailerName,
                selectedRetailer === retailer.id && styles.retailerNameSelected,
              ]}
            >
              {retailer.name}
            </Text>
            {selectedRetailer === retailer.id && (
              <View style={styles.checkmark}>
                <Text style={styles.checkmarkText}>{'\u2713'}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <Button
          title="Back"
          variant="ghost"
          onPress={() => setStep('info')}
          style={styles.backButton}
        />
        <Button
          title="Next"
          onPress={() => setStep('dates')}
          disabled={!selectedRetailer}
          style={styles.nextButtonHalf}
        />
      </View>
    </View>
  );

  const renderDatesStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Sale Dates</Text>
      <Text style={styles.stepDescription}>
        When does this ad run? Check the flyer for dates.
      </Text>

      <FeatureCallout
        variant="tip"
        title="Tip"
        description="Most weekly ads run Wednesday to Tuesday or Sunday to Saturday. Check the top of the flyer for exact dates."
        dismissible={false}
      />

      <View style={styles.dateInputs}>
        <View style={styles.dateField}>
          <Text style={styles.inputLabel}>Start Date</Text>
          <TextInput
            style={styles.dateInput}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.text.disabled}
          />
          <Text style={styles.inputHint}>e.g., 2025-12-25</Text>
        </View>
        <View style={styles.dateField}>
          <Text style={styles.inputLabel}>End Date</Text>
          <TextInput
            style={styles.dateInput}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.text.disabled}
          />
          <Text style={styles.inputHint}>e.g., 2025-12-31</Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Button
          title="Back"
          variant="ghost"
          onPress={() => setStep('retailer')}
          style={styles.backButton}
        />
        <Button
          title="Next"
          onPress={() => setStep('deals')}
          disabled={!startDate || !endDate}
          style={styles.nextButtonHalf}
        />
      </View>
    </View>
  );

  const renderDealsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Enter Deals</Text>
      <Text style={styles.stepDescription}>
        Add the deals you want to track. Focus on items you buy regularly.
      </Text>

      <FeatureCallout
        variant="tip"
        title="Pro tip"
        description="You don't need to enter every deal - just the items you care about. Quality over quantity!"
        dismissible={false}
      />

      <ScrollView style={styles.dealsContainer}>
        {deals.map((deal, index) => (
          <Card key={deal.id} variant="outlined" style={styles.dealCard}>
            <View style={styles.dealHeader}>
              <Badge text={`Deal ${index + 1}`} size="small" variant="info" />
              {deals.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeDealRow(deal.id)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>{'\u2715'}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.dealForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Name *</Text>
                <TextInput
                  style={styles.input}
                  value={deal.productName}
                  onChangeText={(v) => updateDeal(deal.id, 'productName', v)}
                  placeholder="e.g., Chicken Breast"
                  placeholderTextColor={colors.text.disabled}
                />
              </View>

              <View style={styles.priceRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Sale Price *</Text>
                  <TextInput
                    style={styles.input}
                    value={deal.salePrice}
                    onChangeText={(v) => updateDeal(deal.id, 'salePrice', v)}
                    placeholder="2.99"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.sm }]}>
                  <Text style={styles.inputLabel}>Original Price</Text>
                  <TextInput
                    style={styles.input}
                    value={deal.originalPrice}
                    onChangeText={(v) => updateDeal(deal.id, 'originalPrice', v)}
                    placeholder="4.99"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Unit</Text>
                <View style={styles.unitOptions}>
                  {['each', 'lb', 'oz', 'pack'].map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        styles.unitButton,
                        deal.unit === unit && styles.unitButtonSelected,
                      ]}
                      onPress={() => updateDeal(deal.id, 'unit', unit)}
                    >
                      <Text
                        style={[
                          styles.unitButtonText,
                          deal.unit === unit && styles.unitButtonTextSelected,
                        ]}
                      >
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </Card>
        ))}

        <TouchableOpacity style={styles.addDealButton} onPress={addDealRow}>
          <Text style={styles.addDealIcon}>{'\u002B'}</Text>
          <Text style={styles.addDealText}>Add Another Deal</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.buttonRow}>
        <Button
          title="Back"
          variant="ghost"
          onPress={() => setStep('dates')}
          style={styles.backButton}
        />
        <Button
          title="Review"
          onPress={() => setStep('review')}
          disabled={!validateDeals()}
          style={styles.nextButtonHalf}
        />
      </View>
    </View>
  );

  const renderReviewStep = () => {
    const retailerName = retailers.find((r) => r.id === selectedRetailer)?.name;
    const validDeals = deals.filter((d) => d.productName.trim() && d.salePrice.trim());

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Review & Submit</Text>
        <Text style={styles.stepDescription}>
          Double-check your entries before uploading.
        </Text>

        <Card variant="filled" style={styles.reviewCard}>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Store</Text>
            <Text style={styles.reviewValue}>{retailerName}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Sale Period</Text>
            <Text style={styles.reviewValue}>{startDate} to {endDate}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Deals</Text>
            <Text style={styles.reviewValue}>{validDeals.length} items</Text>
          </View>
        </Card>

        <Text style={styles.dealsPreviewTitle}>Deals to Upload:</Text>
        <ScrollView style={styles.dealsPreview}>
          {validDeals.map((deal, index) => (
            <View key={deal.id} style={styles.dealPreviewRow}>
              <Text style={styles.dealPreviewName}>{deal.productName}</Text>
              <Text style={styles.dealPreviewPrice}>
                ${deal.salePrice}
                {deal.originalPrice && (
                  <Text style={styles.dealPreviewOriginal}>
                    {' '}(was ${deal.originalPrice})
                  </Text>
                )}
                /{deal.unit}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.buttonRow}>
          <Button
            title="Back"
            variant="ghost"
            onPress={() => setStep('deals')}
            style={styles.backButton}
          />
          <Button
            title={loading ? 'Uploading...' : 'Upload Deals'}
            onPress={handleSubmit}
            disabled={loading}
            style={styles.nextButtonHalf}
          />
        </View>

        {loading && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeIcon}>{'\u2715'}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Flyer Deals</Text>
            <View style={styles.stepIndicator}>
              {['info', 'retailer', 'dates', 'deals', 'review'].map((s, i) => (
                <View
                  key={s}
                  style={[
                    styles.stepDot,
                    ['info', 'retailer', 'dates', 'deals', 'review'].indexOf(step) >= i &&
                      styles.stepDotActive,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {step === 'info' && renderInfoStep()}
            {step === 'retailer' && renderRetailerStep()}
            {step === 'dates' && renderDatesStep()}
            {step === 'deals' && renderDealsStep()}
            {step === 'review' && renderReviewStep()}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeIcon: {
    fontSize: 20,
    color: colors.text.secondary,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.light,
  },
  stepDotActive: {
    backgroundColor: colors.primary.main,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: spacing.md,
  },
  stepTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  stepDescription: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  exampleCard: {
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  exampleTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  exampleRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  exampleLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    width: 60,
  },
  exampleValue: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '500',
  },
  nextButton: {
    marginTop: spacing.md,
  },
  retailerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  retailerCard: {
    width: '47%',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  retailerCardSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.main + '10',
  },
  retailerIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  retailerName: {
    ...typography.body2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  retailerNameSelected: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  checkmark: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  backButton: {
    flex: 1,
  },
  nextButtonHalf: {
    flex: 2,
  },
  dateInputs: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dateField: {
    flex: 1,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  dateInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body1,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  inputHint: {
    ...typography.caption,
    color: colors.text.disabled,
    marginTop: spacing.xs / 2,
    fontSize: 10,
  },
  dealsContainer: {
    maxHeight: 400,
    marginBottom: spacing.md,
  },
  dealCard: {
    marginBottom: spacing.md,
  },
  dealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  removeButton: {
    padding: spacing.xs,
  },
  removeButtonText: {
    fontSize: 16,
    color: colors.error,
  },
  dealForm: {
    gap: spacing.sm,
  },
  inputGroup: {
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body1,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  priceRow: {
    flexDirection: 'row',
  },
  unitOptions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  unitButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  unitButtonSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  unitButtonText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  unitButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  addDealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
  },
  addDealIcon: {
    fontSize: 20,
    color: colors.primary.main,
    marginRight: spacing.xs,
  },
  addDealText: {
    ...typography.body2,
    color: colors.primary.main,
    fontWeight: '600',
  },
  reviewCard: {
    marginBottom: spacing.lg,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  reviewLabel: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  reviewValue: {
    ...typography.body2,
    color: colors.text.primary,
    fontWeight: '600',
  },
  dealsPreviewTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  dealsPreview: {
    maxHeight: 200,
    marginBottom: spacing.md,
  },
  dealPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  dealPreviewName: {
    ...typography.body2,
    color: colors.text.primary,
    flex: 1,
  },
  dealPreviewPrice: {
    ...typography.body2,
    color: colors.success,
    fontWeight: '600',
  },
  dealPreviewOriginal: {
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
    fontWeight: '400',
  },
  progressContainer: {
    height: 4,
    backgroundColor: colors.border.light,
    borderRadius: 2,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary.main,
  },
});

export default FlyerUploadModal;
