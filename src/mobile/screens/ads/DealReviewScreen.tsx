import React, { useState, useCallback } from 'react';
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
import { Badge } from '../../components/base/Badge';
import { ProgressBar } from '../../components/base/ProgressBar';
import { DealCard, DealCardStack } from '../../components/ads/DealCard';
import { ConfidenceIndicator } from '../../components/ads/ConfidenceIndicator';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { AdDeal, ConfidenceLevel } from '../../types/ads.types';

// Mock deals data
const mockDeals: AdDeal[] = [
  {
    id: 'deal-1',
    productName: 'Organic Chicken Breast',
    price: 8.99,
    originalPrice: 12.99,
    unit: 'lb',
    savingsClaim: 'Save $4.00/lb',
    confidence: 85,
    confidenceLevel: 'high',
    matchedShoppingListItemId: '1',
    matchedShoppingListItemName: 'Chicken Breast',
    status: 'pending',
    imageSnippetUri: 'https://via.placeholder.com/200x100',
  },
  {
    id: 'deal-2',
    productName: 'Greek Yogurt 32oz',
    price: 4.99,
    originalPrice: 6.49,
    unit: 'each',
    savingsClaim: '23% OFF',
    confidence: 72,
    confidenceLevel: 'high',
    matchedShoppingListItemId: '3',
    matchedShoppingListItemName: 'Greek Yogurt',
    status: 'pending',
  },
  {
    id: 'deal-3',
    productName: 'Basmati Rice 5lb',
    price: 6.99,
    confidence: 58,
    confidenceLevel: 'medium',
    matchedShoppingListItemId: '4',
    matchedShoppingListItemName: 'Basmati Rice',
    status: 'pending',
  },
  {
    id: 'deal-4',
    productName: 'Bell Peppers 3-pack',
    price: 3.99,
    originalPrice: 4.99,
    confidence: 45,
    confidenceLevel: 'low',
    status: 'pending',
  },
  {
    id: 'deal-5',
    productName: 'Extra Virgin Olive Oil',
    price: 9.99,
    unit: '750ml',
    confidence: 38,
    confidenceLevel: 'low',
    status: 'pending',
  },
];

type ViewMode = 'swipe' | 'list';
type FilterMode = 'all' | 'low' | 'matched';

export interface DealReviewScreenProps {
  navigation: any;
  route: {
    params: {
      adId: string;
    };
  };
}

export const DealReviewScreen: React.FC<DealReviewScreenProps> = ({
  navigation,
  route,
}) => {
  const { adId } = route.params;
  const [deals, setDeals] = useState<AdDeal[]>(mockDeals);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('swipe');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showBatchActions, setShowBatchActions] = useState(false);

  const reviewedCount = deals.filter(d => d.status !== 'pending').length;
  const confirmedCount = deals.filter(d => d.status === 'confirmed').length;
  const rejectedCount = deals.filter(d => d.status === 'rejected').length;
  const editedCount = deals.filter(d => d.status === 'edited').length;
  const progress = (reviewedCount / deals.length) * 100;

  const filteredDeals = deals.filter(deal => {
    if (filterMode === 'low') return deal.confidenceLevel === 'low';
    if (filterMode === 'matched') return !!deal.matchedShoppingListItemId;
    return true;
  });

  const handleConfirm = useCallback((dealId: string) => {
    setDeals(prev =>
      prev.map(d =>
        d.id === dealId ? { ...d, status: 'confirmed' } : d
      )
    );
    if (viewMode === 'swipe') {
      setCurrentIndex(prev => Math.min(prev + 1, deals.length - 1));
    }
  }, [viewMode, deals.length]);

  const handleReject = useCallback((dealId: string) => {
    setDeals(prev =>
      prev.map(d =>
        d.id === dealId ? { ...d, status: 'rejected' } : d
      )
    );
    if (viewMode === 'swipe') {
      setCurrentIndex(prev => Math.min(prev + 1, deals.length - 1));
    }
  }, [viewMode, deals.length]);

  const handleEdit = useCallback((dealId: string, corrections: any) => {
    setDeals(prev =>
      prev.map(d =>
        d.id === dealId
          ? {
              ...d,
              status: 'edited',
              corrections: {
                ...corrections,
                correctedAt: new Date().toISOString(),
              },
              productName: corrections.productName || d.productName,
              price: corrections.price || d.price,
              unit: corrections.unit || d.unit,
            }
          : d
      )
    );
  }, []);

  const handleConfirmAllHighConfidence = () => {
    setDeals(prev =>
      prev.map(d =>
        d.confidenceLevel === 'high' && d.status === 'pending'
          ? { ...d, status: 'confirmed' }
          : d
      )
    );
    setShowBatchActions(false);
  };

  const handleReviewLowConfidence = () => {
    setFilterMode('low');
    setCurrentIndex(0);
    setShowBatchActions(false);
  };

  const handleFinishReview = () => {
    navigation.navigate('Shopping', {
      newDeals: deals.filter(d => d.status === 'confirmed'),
    });
  };

  const renderSwipeView = () => (
    <View style={styles.swipeContainer}>
      {currentIndex < deals.length ? (
        <DealCardStack
          deals={deals}
          currentIndex={currentIndex}
          onConfirm={handleConfirm}
          onReject={handleReject}
          onEdit={handleEdit}
        />
      ) : (
        <Card variant="filled" style={styles.completeCard}>
          <Text style={styles.completeIcon}>{'\u{1F389}'}</Text>
          <Text style={styles.completeTitle}>All deals reviewed!</Text>
          <Text style={styles.completeSubtitle}>
            {confirmedCount} confirmed, {rejectedCount} rejected
          </Text>
        </Card>
      )}

      <View style={styles.swipeIndicators}>
        <View style={styles.swipeIndicator}>
          <Text style={styles.rejectIcon}>{'\u2715'}</Text>
          <Text style={styles.swipeLabel}>Reject</Text>
        </View>
        <Text style={styles.swipeDivider}>|</Text>
        <View style={styles.swipeIndicator}>
          <Text style={styles.confirmIcon}>{'\u2713'}</Text>
          <Text style={styles.swipeLabel}>Confirm</Text>
        </View>
      </View>
    </View>
  );

  const renderListView = () => (
    <ScrollView style={styles.listContainer}>
      {filteredDeals.map(deal => (
        <Card
          key={deal.id}
          variant={deal.status === 'pending' ? 'outlined' : 'filled'}
          style={[
            styles.listCard,
            deal.status === 'confirmed' && styles.listCardConfirmed,
            deal.status === 'rejected' && styles.listCardRejected,
          ]}
        >
          <View style={styles.listCardHeader}>
            <ConfidenceIndicator
              confidence={deal.confidence}
              level={deal.confidenceLevel}
              size="small"
            />
            {deal.status !== 'pending' && (
              <Badge
                text={deal.status}
                variant={
                  deal.status === 'confirmed'
                    ? 'success'
                    : deal.status === 'rejected'
                    ? 'error'
                    : 'warning'
                }
                size="small"
              />
            )}
          </View>

          <Text style={styles.listProductName}>{deal.productName}</Text>

          <View style={styles.listPriceRow}>
            <Text style={styles.listPrice}>${deal.price.toFixed(2)}</Text>
            {deal.unit && <Text style={styles.listUnit}>/ {deal.unit}</Text>}
            {deal.originalPrice && (
              <Text style={styles.listOriginalPrice}>
                ${deal.originalPrice.toFixed(2)}
              </Text>
            )}
          </View>

          {deal.matchedShoppingListItemName && (
            <View style={styles.listMatch}>
              <Text style={styles.listMatchIcon}>{'\u{1F3AF}'}</Text>
              <Text style={styles.listMatchText}>
                {deal.matchedShoppingListItemName}
              </Text>
            </View>
          )}

          {deal.status === 'pending' && (
            <View style={styles.listActions}>
              <TouchableOpacity
                style={[styles.listActionButton, styles.listRejectButton]}
                onPress={() => handleReject(deal.id)}
              >
                <Text style={styles.listRejectText}>{'\u2715'} Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.listActionButton, styles.listConfirmButton]}
                onPress={() => handleConfirm(deal.id)}
              >
                <Text style={styles.listConfirmText}>{'\u2713'} Confirm</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Review Deals</Text>
          <TouchableOpacity onPress={() => setShowBatchActions(true)}>
            <Text style={styles.menuButton}>{'\u22EE'}</Text>
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <Card variant="filled" style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {reviewedCount} of {deals.length} reviewed
            </Text>
            <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
          </View>
          <ProgressBar progress={progress} height={6} />
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.success }]}>
                {confirmedCount}
              </Text>
              <Text style={styles.statLabel}>Confirmed</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.error }]}>
                {rejectedCount}
              </Text>
              <Text style={styles.statLabel}>Rejected</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.warning }]}>
                {editedCount}
              </Text>
              <Text style={styles.statLabel}>Edited</Text>
            </View>
          </View>
        </Card>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'swipe' && styles.toggleButtonActive]}
          onPress={() => setViewMode('swipe')}
        >
          <Text style={[styles.toggleText, viewMode === 'swipe' && styles.toggleTextActive]}>
            {'\u{1F4F1}'} Swipe
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
            {'\u{1F4CB}'} List
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter (list view only) */}
      {viewMode === 'list' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.filterButton, filterMode === 'all' && styles.filterButtonActive]}
            onPress={() => setFilterMode('all')}
          >
            <Text style={[styles.filterText, filterMode === 'all' && styles.filterTextActive]}>
              All ({deals.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterMode === 'low' && styles.filterButtonActive]}
            onPress={() => setFilterMode('low')}
          >
            <Text style={[styles.filterText, filterMode === 'low' && styles.filterTextActive]}>
              Low Confidence ({deals.filter(d => d.confidenceLevel === 'low').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterMode === 'matched' && styles.filterButtonActive]}
            onPress={() => setFilterMode('matched')}
          >
            <Text style={[styles.filterText, filterMode === 'matched' && styles.filterTextActive]}>
              Matched ({deals.filter(d => d.matchedShoppingListItemId).length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Main Content */}
      {viewMode === 'swipe' ? renderSwipeView() : renderListView()}

      {/* Finish Button */}
      <View style={styles.footer}>
        <Button
          title={reviewedCount === deals.length ? 'Finish Review' : `Skip Remaining (${deals.length - reviewedCount})`}
          onPress={handleFinishReview}
          fullWidth
        />
      </View>

      {/* Batch Actions Modal */}
      <Modal
        visible={showBatchActions}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBatchActions(false)}
      >
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={styles.modalContent}>
            <Text style={styles.modalTitle}>Quick Actions</Text>

            <TouchableOpacity
              style={styles.batchAction}
              onPress={handleConfirmAllHighConfidence}
            >
              <Text style={styles.batchActionIcon}>{'\u2705'}</Text>
              <View style={styles.batchActionText}>
                <Text style={styles.batchActionTitle}>
                  Confirm All High Confidence
                </Text>
                <Text style={styles.batchActionSubtitle}>
                  Auto-confirm {deals.filter(d => d.confidenceLevel === 'high' && d.status === 'pending').length} deals with 70%+ confidence
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.batchAction}
              onPress={handleReviewLowConfidence}
            >
              <Text style={styles.batchActionIcon}>{'\u{1F50D}'}</Text>
              <View style={styles.batchActionText}>
                <Text style={styles.batchActionTitle}>
                  Review Low Confidence Only
                </Text>
                <Text style={styles.batchActionSubtitle}>
                  Focus on {deals.filter(d => d.confidenceLevel === 'low').length} deals that need attention
                </Text>
              </View>
            </TouchableOpacity>

            <Button
              title="Cancel"
              onPress={() => setShowBatchActions(false)}
              variant="ghost"
              fullWidth
              style={styles.modalCancel}
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
  header: {
    padding: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  menuButton: {
    fontSize: 24,
    color: colors.text.primary,
    padding: spacing.xs,
  },
  progressCard: {
    padding: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  progressPercent: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.primary.main,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.xs / 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  toggleButtonActive: {
    backgroundColor: colors.background.primary,
  },
  toggleText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  toggleTextActive: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  filterScroll: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  filterButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  filterButtonActive: {
    backgroundColor: colors.primary.main,
  },
  filterText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: colors.text.inverse,
  },
  swipeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  swipeIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.full,
  },
  swipeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  rejectIcon: {
    fontSize: 20,
    color: colors.error,
    marginRight: spacing.xs,
  },
  confirmIcon: {
    fontSize: 20,
    color: colors.success,
    marginRight: spacing.xs,
  },
  swipeLabel: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  swipeDivider: {
    color: colors.border.medium,
    marginHorizontal: spacing.sm,
  },
  completeCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  completeIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  completeTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  completeSubtitle: {
    ...typography.body1,
    color: colors.text.secondary,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  listCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  listCardConfirmed: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  listCardRejected: {
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
    opacity: 0.6,
  },
  listCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  listProductName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  listPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  listPrice: {
    ...typography.h3,
    color: colors.primary.main,
  },
  listUnit: {
    ...typography.body2,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  listOriginalPrice: {
    ...typography.body2,
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
    marginLeft: spacing.sm,
  },
  listMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    marginBottom: spacing.sm,
  },
  listMatchIcon: {
    fontSize: 12,
    marginRight: spacing.xs,
  },
  listMatchText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  listActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  listActionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  listRejectButton: {
    backgroundColor: colors.error + '15',
  },
  listConfirmButton: {
    backgroundColor: colors.success + '15',
  },
  listRejectText: {
    ...typography.body2,
    color: colors.error,
    fontWeight: '600',
  },
  listConfirmText: {
    ...typography.body2,
    color: colors.success,
    fontWeight: '600',
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
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
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  batchAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  batchActionIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  batchActionText: {
    flex: 1,
  },
  batchActionTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  batchActionSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs / 2,
  },
  modalCancel: {
    marginTop: spacing.md,
  },
});

export default DealReviewScreen;
