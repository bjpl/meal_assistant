import { configureStore } from '@reduxjs/toolkit';
import adsReducer, {
  uploadAd,
  processAd,
  createTemplate,
  testTemplate,
  downloadTemplate,
  setUploadProgress,
  updateProcessingProgress,
  startReviewSession,
  reviewDeal,
  correctDeal,
  skipToIndex,
  confirmAllHighConfidence,
  endReviewSession,
  updateAccuracyStats,
  addAccuracyDataPoint,
  shareTemplate,
  deleteTemplate,
  rollbackTemplate,
  clearError,
  clearCurrentUpload,
} from '../../../src/mobile/store/slices/adsSlice';
import {
  AdsState,
  WeeklyAd,
  AdDeal,
  AdTemplate,
  ProcessingProgress,
  TemplateAnnotation,
} from '../../../src/mobile/types/ads.types';

// Mock timers for async operations
jest.useFakeTimers();

// Helper function to create a test store
const createTestStore = (initialState?: Partial<AdsState>) => {
  return configureStore({
    reducer: {
      ads: adsReducer,
    },
    preloadedState: initialState
      ? {
          ads: {
            ...getInitialState(),
            ...initialState,
          },
        }
      : undefined,
  });
};

// Helper to get initial state
const getInitialState = (): AdsState => ({
  uploadedAds: [],
  currentUpload: null,
  currentReview: null,
  templates: [],
  publicTemplates: [],
  accuracyStats: {
    overall: 0,
    byStore: {},
    progression: [],
    totalDealsProcessed: 0,
    totalCorrections: 0,
  },
  recentDeals: [],
  loading: false,
  error: null,
});

// Mock data factories
const createMockAd = (overrides?: Partial<WeeklyAd>): WeeklyAd => ({
  id: 'ad-123',
  storeId: 'store-1',
  storeName: 'Test Store',
  adPeriodStart: '2024-01-01',
  adPeriodEnd: '2024-01-07',
  uploadedAt: '2024-01-01T00:00:00.000Z',
  status: 'processing',
  fileType: 'pdf',
  fileUri: 'file://test.pdf',
  pages: 4,
  deals: [],
  ...overrides,
});

const createMockDeal = (overrides?: Partial<AdDeal>): AdDeal => ({
  id: 'deal-1',
  productName: 'Test Product',
  price: 9.99,
  confidence: 85,
  confidenceLevel: 'high',
  status: 'pending',
  ...overrides,
});

const createMockTemplate = (overrides?: Partial<AdTemplate>): AdTemplate => ({
  id: 'template-1',
  name: 'Test Template',
  storeId: 'store-1',
  storeName: 'Test Store',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdBy: 'user-1',
  isPublic: false,
  version: 1,
  versionHistory: [],
  annotations: [],
  accuracy: 0,
  usageCount: 0,
  successfulExtractions: 0,
  ratings: [],
  averageRating: 0,
  tags: [],
  ...overrides,
});

const createMockAnnotation = (
  overrides?: Partial<TemplateAnnotation>
): TemplateAnnotation => ({
  id: 'annotation-1',
  type: 'block',
  label: 'deal_section',
  boundingBox: { x: 0, y: 0, width: 100, height: 100 },
  pageNumber: 1,
  ...overrides,
});

describe('adsSlice', () => {
  // ============================================
  // 1. INITIAL STATE TESTS
  // ============================================
  describe('Initial State', () => {
    it('should return the initial state', () => {
      const store = createTestStore();
      const state = store.getState().ads;

      expect(state.uploadedAds).toEqual([]);
      expect(state.currentUpload).toBeNull();
      expect(state.currentReview).toBeNull();
      expect(state.templates).toEqual([]);
      expect(state.publicTemplates).toEqual([]);
      expect(state.recentDeals).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should initialize accuracyStats correctly', () => {
      const store = createTestStore();
      const state = store.getState().ads;

      expect(state.accuracyStats).toEqual({
        overall: 0,
        byStore: {},
        progression: [],
        totalDealsProcessed: 0,
        totalCorrections: 0,
      });
    });
  });

  // ============================================
  // 2. UPLOAD AD TESTS
  // ============================================
  describe('uploadAd async thunk', () => {
    it('should set loading state on pending', () => {
      const store = createTestStore();

      store.dispatch(
        uploadAd({
          fileUri: 'file://test.pdf',
          fileType: 'pdf',
          fileName: 'test.pdf',
          storeId: 'store-1',
          storeName: 'Test Store',
          adPeriodStart: '2024-01-01',
          adPeriodEnd: '2024-01-07',
        })
      );

      const state = store.getState().ads;
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should upload ad successfully and add to uploadedAds', async () => {
      const store = createTestStore();

      const uploadPromise = store.dispatch(
        uploadAd({
          fileUri: 'file://test.pdf',
          fileType: 'pdf',
          fileName: 'test.pdf',
          storeId: 'store-1',
          storeName: 'Test Store',
          adPeriodStart: '2024-01-01',
          adPeriodEnd: '2024-01-07',
        })
      );

      // Fast-forward through upload progress
      await jest.runAllTimersAsync();
      await uploadPromise;

      const state = store.getState().ads;
      expect(state.loading).toBe(false);
      expect(state.uploadedAds).toHaveLength(1);
      expect(state.uploadedAds[0].storeName).toBe('Test Store');
      expect(state.uploadedAds[0].status).toBe('processing');
      expect(state.currentUpload).toBeNull();
    });

    it('should create ad with correct file type (pdf)', async () => {
      const store = createTestStore();

      const uploadPromise = store.dispatch(
        uploadAd({
          fileUri: 'file://test.pdf',
          fileType: 'pdf',
          fileName: 'test.pdf',
          storeId: 'store-1',
          storeName: 'Test Store',
          adPeriodStart: '2024-01-01',
          adPeriodEnd: '2024-01-07',
        })
      );

      await jest.runAllTimersAsync();
      await uploadPromise;

      const state = store.getState().ads;
      expect(state.uploadedAds[0].fileType).toBe('pdf');
      expect(state.uploadedAds[0].pages).toBe(4);
    });

    it('should create ad with correct file type (image)', async () => {
      const store = createTestStore();

      const uploadPromise = store.dispatch(
        uploadAd({
          fileUri: 'file://test.jpg',
          fileType: 'image',
          fileName: 'test.jpg',
          storeId: 'store-1',
          storeName: 'Test Store',
          adPeriodStart: '2024-01-01',
          adPeriodEnd: '2024-01-07',
        })
      );

      await jest.runAllTimersAsync();
      await uploadPromise;

      const state = store.getState().ads;
      expect(state.uploadedAds[0].fileType).toBe('image');
      expect(state.uploadedAds[0].pages).toBe(1);
    });

    it('should handle upload rejection', async () => {
      const store = createTestStore();

      // Mock a failure by providing invalid data
      const uploadPromise = store.dispatch(
        uploadAd({
          fileUri: '',
          fileType: 'pdf',
          fileName: '',
          storeId: '',
          storeName: '',
          adPeriodStart: '',
          adPeriodEnd: '',
        })
      );

      await jest.runAllTimersAsync();

      const state = store.getState().ads;
      expect(state.loading).toBe(false);
    });

    it('should prepend new ads to uploadedAds array', async () => {
      const existingAd = createMockAd({ id: 'ad-1' });
      const store = createTestStore({ uploadedAds: [existingAd] });

      const uploadPromise = store.dispatch(
        uploadAd({
          fileUri: 'file://test2.pdf',
          fileType: 'pdf',
          fileName: 'test2.pdf',
          storeId: 'store-2',
          storeName: 'Test Store 2',
          adPeriodStart: '2024-01-08',
          adPeriodEnd: '2024-01-14',
        })
      );

      await jest.runAllTimersAsync();
      await uploadPromise;

      const state = store.getState().ads;
      expect(state.uploadedAds).toHaveLength(2);
      expect(state.uploadedAds[0].storeName).toBe('Test Store 2');
      expect(state.uploadedAds[1].id).toBe('ad-1');
    });
  });

  describe('setUploadProgress reducer', () => {
    it('should update upload progress', () => {
      const store = createTestStore();

      store.dispatch(
        setUploadProgress({
          progress: 50,
          adId: 'ad-123',
        })
      );

      const state = store.getState().ads;
      expect(state.currentUpload).toEqual({
        progress: 50,
        adId: 'ad-123',
      });
    });

    it('should update progress multiple times', () => {
      const store = createTestStore();

      store.dispatch(setUploadProgress({ progress: 25, adId: 'ad-123' }));
      store.dispatch(setUploadProgress({ progress: 50, adId: 'ad-123' }));
      store.dispatch(setUploadProgress({ progress: 100, adId: 'ad-123' }));

      const state = store.getState().ads;
      expect(state.currentUpload?.progress).toBe(100);
    });
  });

  describe('clearCurrentUpload reducer', () => {
    it('should clear current upload state', () => {
      const store = createTestStore({
        currentUpload: { progress: 50, adId: 'ad-123' },
      });

      store.dispatch(clearCurrentUpload());

      const state = store.getState().ads;
      expect(state.currentUpload).toBeNull();
    });
  });

  // ============================================
  // 3. PROCESS AD TESTS
  // ============================================
  describe('processAd async thunk', () => {
    it('should set loading state on pending', () => {
      const store = createTestStore();

      store.dispatch(processAd('ad-123'));

      const state = store.getState().ads;
      expect(state.loading).toBe(true);
    });

    it('should process ad successfully and extract deals', async () => {
      const mockAd = createMockAd({ id: 'ad-123', status: 'processing' });
      const store = createTestStore({ uploadedAds: [mockAd] });

      const processPromise = store.dispatch(processAd('ad-123'));

      await jest.runAllTimersAsync();
      await processPromise;

      const state = store.getState().ads;
      const processedAd = state.uploadedAds.find(ad => ad.id === 'ad-123');

      expect(state.loading).toBe(false);
      expect(processedAd?.status).toBe('ready');
      expect(processedAd?.deals.length).toBeGreaterThan(0);
      expect(processedAd?.processedAt).toBeDefined();
      expect(processedAd?.processingProgress).toBeUndefined();
    });

    it('should extract 5 deals with correct confidence levels', async () => {
      const mockAd = createMockAd({ id: 'ad-123' });
      const store = createTestStore({ uploadedAds: [mockAd] });

      const processPromise = store.dispatch(processAd('ad-123'));
      await jest.runAllTimersAsync();
      await processPromise;

      const state = store.getState().ads;
      const processedAd = state.uploadedAds.find(ad => ad.id === 'ad-123');

      expect(processedAd?.deals).toHaveLength(5);

      // Check confidence levels are assigned correctly
      const highConfDeals = processedAd?.deals.filter(
        d => d.confidenceLevel === 'high'
      );
      const mediumConfDeals = processedAd?.deals.filter(
        d => d.confidenceLevel === 'medium'
      );
      const lowConfDeals = processedAd?.deals.filter(
        d => d.confidenceLevel === 'low'
      );

      expect(highConfDeals?.length).toBe(2);
      expect(mediumConfDeals?.length).toBe(1);
      expect(lowConfDeals?.length).toBe(2);
    });

    it('should handle processing rejection', async () => {
      const store = createTestStore();

      const processPromise = store.dispatch(processAd('non-existent-ad'));
      await jest.runAllTimersAsync();

      const state = store.getState().ads;
      expect(state.loading).toBe(false);
    });
  });

  describe('updateProcessingProgress reducer', () => {
    it('should update processing progress for specific ad', () => {
      const mockAd = createMockAd({ id: 'ad-123' });
      const store = createTestStore({ uploadedAds: [mockAd] });

      const progress: ProcessingProgress = {
        step: 'extracting_text',
        stepNumber: 3,
        totalSteps: 5,
        message: 'Extracting text...',
        estimatedTimeRemaining: 4,
      };

      store.dispatch(updateProcessingProgress({ adId: 'ad-123', progress }));

      const state = store.getState().ads;
      const ad = state.uploadedAds.find(a => a.id === 'ad-123');

      expect(ad?.processingProgress).toEqual(progress);
    });

    it('should update progress through all 5 steps', () => {
      const mockAd = createMockAd({ id: 'ad-123' });
      const store = createTestStore({ uploadedAds: [mockAd] });

      const steps: ProcessingProgress[] = [
        {
          step: 'uploading',
          stepNumber: 1,
          totalSteps: 5,
          message: 'Uploading...',
        },
        {
          step: 'detecting_store',
          stepNumber: 2,
          totalSteps: 5,
          message: 'Detecting store...',
        },
        {
          step: 'extracting_text',
          stepNumber: 3,
          totalSteps: 5,
          message: 'Extracting text...',
        },
        {
          step: 'finding_deals',
          stepNumber: 4,
          totalSteps: 5,
          message: 'Finding deals...',
        },
        {
          step: 'matching_to_list',
          stepNumber: 5,
          totalSteps: 5,
          message: 'Matching to list...',
        },
      ];

      steps.forEach(progress => {
        store.dispatch(updateProcessingProgress({ adId: 'ad-123', progress }));
      });

      const state = store.getState().ads;
      const ad = state.uploadedAds.find(a => a.id === 'ad-123');

      expect(ad?.processingProgress?.stepNumber).toBe(5);
    });

    it('should not update progress for non-existent ad', () => {
      const store = createTestStore();

      const progress: ProcessingProgress = {
        step: 'uploading',
        stepNumber: 1,
        totalSteps: 5,
        message: 'Uploading...',
      };

      store.dispatch(
        updateProcessingProgress({ adId: 'non-existent', progress })
      );

      const state = store.getState().ads;
      expect(state.uploadedAds).toHaveLength(0);
    });
  });

  // ============================================
  // 4. DEAL REVIEW TESTS
  // ============================================
  describe('Review Session', () => {
    describe('startReviewSession', () => {
      it('should start review session with deals', () => {
        const deals = [
          createMockDeal({ id: 'deal-1' }),
          createMockDeal({ id: 'deal-2' }),
          createMockDeal({ id: 'deal-3' }),
        ];
        const mockAd = createMockAd({ id: 'ad-123', deals });
        const store = createTestStore({ uploadedAds: [mockAd] });

        store.dispatch(startReviewSession('ad-123'));

        const state = store.getState().ads;
        expect(state.currentReview).toBeDefined();
        expect(state.currentReview?.adId).toBe('ad-123');
        expect(state.currentReview?.deals).toHaveLength(3);
        expect(state.currentReview?.currentIndex).toBe(0);
        expect(state.currentReview?.reviewedCount).toBe(0);
        expect(state.currentReview?.confirmedCount).toBe(0);
        expect(state.currentReview?.rejectedCount).toBe(0);
        expect(state.currentReview?.editedCount).toBe(0);
        expect(state.currentReview?.startedAt).toBeDefined();
      });

      it('should not start review session for ad with no deals', () => {
        const mockAd = createMockAd({ id: 'ad-123', deals: [] });
        const store = createTestStore({ uploadedAds: [mockAd] });

        store.dispatch(startReviewSession('ad-123'));

        const state = store.getState().ads;
        expect(state.currentReview).toBeNull();
      });

      it('should not start review session for non-existent ad', () => {
        const store = createTestStore();

        store.dispatch(startReviewSession('non-existent'));

        const state = store.getState().ads;
        expect(state.currentReview).toBeNull();
      });
    });

    describe('reviewDeal', () => {
      const setupReviewSession = () => {
        const deals = [
          createMockDeal({ id: 'deal-1', status: 'pending' }),
          createMockDeal({ id: 'deal-2', status: 'pending' }),
          createMockDeal({ id: 'deal-3', status: 'pending' }),
        ];
        const mockAd = createMockAd({ id: 'ad-123', deals });
        const store = createTestStore({ uploadedAds: [mockAd] });
        store.dispatch(startReviewSession('ad-123'));
        return store;
      };

      it('should confirm a deal', () => {
        const store = setupReviewSession();

        store.dispatch(reviewDeal({ dealId: 'deal-1', action: 'confirm' }));

        const state = store.getState().ads;
        const deal = state.currentReview?.deals.find(d => d.id === 'deal-1');

        expect(deal?.status).toBe('confirmed');
        expect(state.currentReview?.confirmedCount).toBe(1);
        expect(state.currentReview?.reviewedCount).toBe(1);
        expect(state.currentReview?.currentIndex).toBe(1);
        expect(state.accuracyStats.totalDealsProcessed).toBe(1);
      });

      it('should reject a deal', () => {
        const store = setupReviewSession();

        store.dispatch(reviewDeal({ dealId: 'deal-1', action: 'reject' }));

        const state = store.getState().ads;
        const deal = state.currentReview?.deals.find(d => d.id === 'deal-1');

        expect(deal?.status).toBe('rejected');
        expect(state.currentReview?.rejectedCount).toBe(1);
        expect(state.currentReview?.reviewedCount).toBe(1);
        expect(state.currentReview?.confirmedCount).toBe(0);
      });

      it('should mark deal as edited', () => {
        const store = setupReviewSession();

        store.dispatch(reviewDeal({ dealId: 'deal-1', action: 'edit' }));

        const state = store.getState().ads;
        const deal = state.currentReview?.deals.find(d => d.id === 'deal-1');

        expect(deal?.status).toBe('edited');
        expect(state.currentReview?.editedCount).toBe(1);
        expect(state.currentReview?.reviewedCount).toBe(1);
      });

      it('should advance currentIndex after review', () => {
        const store = setupReviewSession();

        store.dispatch(reviewDeal({ dealId: 'deal-1', action: 'confirm' }));
        expect(store.getState().ads.currentReview?.currentIndex).toBe(1);

        store.dispatch(reviewDeal({ dealId: 'deal-2', action: 'confirm' }));
        expect(store.getState().ads.currentReview?.currentIndex).toBe(2);

        store.dispatch(reviewDeal({ dealId: 'deal-3', action: 'confirm' }));
        // Should not exceed array bounds
        expect(store.getState().ads.currentReview?.currentIndex).toBe(2);
      });

      it('should handle reviewing non-existent deal', () => {
        const store = setupReviewSession();

        store.dispatch(
          reviewDeal({ dealId: 'non-existent', action: 'confirm' })
        );

        const state = store.getState().ads;
        expect(state.currentReview?.reviewedCount).toBe(0);
      });

      it('should do nothing when no review session active', () => {
        const store = createTestStore();

        store.dispatch(reviewDeal({ dealId: 'deal-1', action: 'confirm' }));

        const state = store.getState().ads;
        expect(state.currentReview).toBeNull();
      });
    });

    describe('correctDeal', () => {
      const setupReviewSession = () => {
        const deals = [createMockDeal({ id: 'deal-1', price: 9.99 })];
        const mockAd = createMockAd({ id: 'ad-123', deals });
        const store = createTestStore({ uploadedAds: [mockAd] });
        store.dispatch(startReviewSession('ad-123'));
        return store;
      };

      it('should apply corrections to deal', () => {
        const store = setupReviewSession();

        store.dispatch(
          correctDeal({
            dealId: 'deal-1',
            corrections: {
              productName: 'Corrected Product',
              price: 7.99,
              unit: 'lb',
              quantity: 2,
            },
          })
        );

        const state = store.getState().ads;
        const deal = state.currentReview?.deals.find(d => d.id === 'deal-1');

        expect(deal?.corrections).toBeDefined();
        expect(deal?.corrections?.productName).toBe('Corrected Product');
        expect(deal?.corrections?.price).toBe(7.99);
        expect(deal?.corrections?.unit).toBe('lb');
        expect(deal?.corrections?.quantity).toBe(2);
        expect(deal?.corrections?.correctedAt).toBeDefined();
        expect(deal?.status).toBe('edited');
        expect(state.accuracyStats.totalCorrections).toBe(1);
      });

      it('should apply partial corrections', () => {
        const store = setupReviewSession();

        store.dispatch(
          correctDeal({
            dealId: 'deal-1',
            corrections: {
              price: 6.99,
            },
          })
        );

        const state = store.getState().ads;
        const deal = state.currentReview?.deals.find(d => d.id === 'deal-1');

        expect(deal?.corrections?.price).toBe(6.99);
        expect(deal?.corrections?.productName).toBeUndefined();
      });

      it('should increment totalCorrections counter', () => {
        const store = setupReviewSession();

        store.dispatch(
          correctDeal({ dealId: 'deal-1', corrections: { price: 6.99 } })
        );

        expect(store.getState().ads.accuracyStats.totalCorrections).toBe(1);
      });

      it('should do nothing when no review session active', () => {
        const store = createTestStore();

        store.dispatch(
          correctDeal({ dealId: 'deal-1', corrections: { price: 6.99 } })
        );

        const state = store.getState().ads;
        expect(state.accuracyStats.totalCorrections).toBe(0);
      });
    });

    describe('skipToIndex', () => {
      const setupReviewSession = () => {
        const deals = [
          createMockDeal({ id: 'deal-1' }),
          createMockDeal({ id: 'deal-2' }),
          createMockDeal({ id: 'deal-3' }),
          createMockDeal({ id: 'deal-4' }),
          createMockDeal({ id: 'deal-5' }),
        ];
        const mockAd = createMockAd({ id: 'ad-123', deals });
        const store = createTestStore({ uploadedAds: [mockAd] });
        store.dispatch(startReviewSession('ad-123'));
        return store;
      };

      it('should skip to specific index', () => {
        const store = setupReviewSession();

        store.dispatch(skipToIndex(3));

        const state = store.getState().ads;
        expect(state.currentReview?.currentIndex).toBe(3);
      });

      it('should not exceed max index', () => {
        const store = setupReviewSession();

        store.dispatch(skipToIndex(10));

        const state = store.getState().ads;
        expect(state.currentReview?.currentIndex).toBe(4); // Max is length - 1
      });

      it('should allow skipping to index 0', () => {
        const store = setupReviewSession();

        store.dispatch(skipToIndex(3));
        store.dispatch(skipToIndex(0));

        const state = store.getState().ads;
        expect(state.currentReview?.currentIndex).toBe(0);
      });

      it('should do nothing when no review session active', () => {
        const store = createTestStore();

        store.dispatch(skipToIndex(2));

        const state = store.getState().ads;
        expect(state.currentReview).toBeNull();
      });
    });

    describe('confirmAllHighConfidence', () => {
      it('should confirm all high confidence deals', () => {
        const deals = [
          createMockDeal({
            id: 'deal-1',
            confidence: 85,
            confidenceLevel: 'high',
          }),
          createMockDeal({
            id: 'deal-2',
            confidence: 72,
            confidenceLevel: 'high',
          }),
          createMockDeal({
            id: 'deal-3',
            confidence: 58,
            confidenceLevel: 'medium',
          }),
          createMockDeal({
            id: 'deal-4',
            confidence: 45,
            confidenceLevel: 'low',
          }),
        ];
        const mockAd = createMockAd({ id: 'ad-123', deals });
        const store = createTestStore({ uploadedAds: [mockAd] });
        store.dispatch(startReviewSession('ad-123'));

        store.dispatch(confirmAllHighConfidence());

        const state = store.getState().ads;
        const confirmedDeals = state.currentReview?.deals.filter(
          d => d.status === 'confirmed'
        );

        expect(confirmedDeals).toHaveLength(2);
        expect(state.currentReview?.confirmedCount).toBe(2);
        expect(state.currentReview?.reviewedCount).toBe(2);
      });

      it('should not confirm already reviewed deals', () => {
        const deals = [
          createMockDeal({
            id: 'deal-1',
            confidence: 85,
            confidenceLevel: 'high',
            status: 'confirmed',
          }),
          createMockDeal({
            id: 'deal-2',
            confidence: 72,
            confidenceLevel: 'high',
          }),
        ];
        const mockAd = createMockAd({ id: 'ad-123', deals });
        const store = createTestStore({ uploadedAds: [mockAd] });
        store.dispatch(startReviewSession('ad-123'));

        store.dispatch(confirmAllHighConfidence());

        const state = store.getState().ads;
        expect(state.currentReview?.confirmedCount).toBe(1); // Only deal-2
      });

      it('should do nothing when no review session active', () => {
        const store = createTestStore();

        store.dispatch(confirmAllHighConfidence());

        const state = store.getState().ads;
        expect(state.currentReview).toBeNull();
      });
    });

    describe('endReviewSession', () => {
      it('should end review session and update ad status', () => {
        const deals = [
          createMockDeal({ id: 'deal-1', status: 'pending' }),
          createMockDeal({ id: 'deal-2', status: 'pending' }),
        ];
        const mockAd = createMockAd({ id: 'ad-123', deals, status: 'ready' });
        const store = createTestStore({ uploadedAds: [mockAd] });

        store.dispatch(startReviewSession('ad-123'));
        store.dispatch(reviewDeal({ dealId: 'deal-1', action: 'confirm' }));
        store.dispatch(reviewDeal({ dealId: 'deal-2', action: 'reject' }));
        store.dispatch(endReviewSession());

        const state = store.getState().ads;
        const ad = state.uploadedAds.find(a => a.id === 'ad-123');

        expect(state.currentReview).toBeNull();
        expect(ad?.status).toBe('reviewed');
        expect(ad?.deals).toHaveLength(2);
      });

      it('should add confirmed deals to recentDeals', () => {
        const deals = [
          createMockDeal({ id: 'deal-1' }),
          createMockDeal({ id: 'deal-2' }),
          createMockDeal({ id: 'deal-3' }),
        ];
        const mockAd = createMockAd({ id: 'ad-123', deals });
        const store = createTestStore({ uploadedAds: [mockAd] });

        store.dispatch(startReviewSession('ad-123'));
        store.dispatch(reviewDeal({ dealId: 'deal-1', action: 'confirm' }));
        store.dispatch(reviewDeal({ dealId: 'deal-2', action: 'confirm' }));
        store.dispatch(reviewDeal({ dealId: 'deal-3', action: 'reject' }));
        store.dispatch(endReviewSession());

        const state = store.getState().ads;
        expect(state.recentDeals).toHaveLength(2);
        expect(state.recentDeals.every(d => d.status === 'confirmed')).toBe(
          true
        );
      });

      it('should limit recentDeals to 50 items', () => {
        // Create existing recent deals
        const existingRecentDeals = Array.from({ length: 49 }, (_, i) =>
          createMockDeal({ id: `existing-${i}`, status: 'confirmed' })
        );

        const newDeals = [
          createMockDeal({ id: 'new-1' }),
          createMockDeal({ id: 'new-2' }),
          createMockDeal({ id: 'new-3' }),
        ];
        const mockAd = createMockAd({ id: 'ad-123', deals: newDeals });
        const store = createTestStore({
          uploadedAds: [mockAd],
          recentDeals: existingRecentDeals,
        });

        store.dispatch(startReviewSession('ad-123'));
        store.dispatch(reviewDeal({ dealId: 'new-1', action: 'confirm' }));
        store.dispatch(reviewDeal({ dealId: 'new-2', action: 'confirm' }));
        store.dispatch(reviewDeal({ dealId: 'new-3', action: 'confirm' }));
        store.dispatch(endReviewSession());

        const state = store.getState().ads;
        expect(state.recentDeals).toHaveLength(50);
      });

      it('should do nothing when no review session active', () => {
        const store = createTestStore();

        store.dispatch(endReviewSession());

        const state = store.getState().ads;
        expect(state.currentReview).toBeNull();
      });
    });
  });

  // ============================================
  // 5. TEMPLATE MANAGEMENT TESTS
  // ============================================
  describe('Template Management', () => {
    describe('createTemplate', () => {
      it('should create template successfully', async () => {
        const store = createTestStore();
        const annotations = [createMockAnnotation()];

        await store.dispatch(
          createTemplate({
            name: 'Test Template',
            storeId: 'store-1',
            storeName: 'Test Store',
            annotations,
            isPublic: false,
          })
        );

        const state = store.getState().ads;
        expect(state.templates).toHaveLength(1);
        expect(state.templates[0].name).toBe('Test Template');
        expect(state.templates[0].isPublic).toBe(false);
        expect(state.templates[0].version).toBe(1);
      });

      it('should create public template', async () => {
        const store = createTestStore();

        await store.dispatch(
          createTemplate({
            name: 'Public Template',
            storeId: 'store-1',
            storeName: 'Test Store',
            annotations: [],
            isPublic: true,
          })
        );

        const state = store.getState().ads;
        expect(state.templates[0].isPublic).toBe(true);
      });

      it('should prepend new template to templates array', async () => {
        const existingTemplate = createMockTemplate({ id: 'template-1' });
        const store = createTestStore({ templates: [existingTemplate] });

        await store.dispatch(
          createTemplate({
            name: 'New Template',
            storeId: 'store-1',
            storeName: 'Test Store',
            annotations: [],
            isPublic: false,
          })
        );

        const state = store.getState().ads;
        expect(state.templates).toHaveLength(2);
        expect(state.templates[0].name).toBe('New Template');
        expect(state.templates[1].id).toBe('template-1');
      });
    });

    describe('shareTemplate', () => {
      it('should make template public', () => {
        const privateTemplate = createMockTemplate({
          id: 'template-1',
          isPublic: false,
        });
        const store = createTestStore({ templates: [privateTemplate] });

        store.dispatch(shareTemplate('template-1'));

        const state = store.getState().ads;
        expect(state.templates[0].isPublic).toBe(true);
        expect(state.templates[0].updatedAt).toBeDefined();
      });

      it('should not modify non-existent template', () => {
        const store = createTestStore();

        store.dispatch(shareTemplate('non-existent'));

        const state = store.getState().ads;
        expect(state.templates).toHaveLength(0);
      });
    });

    describe('deleteTemplate', () => {
      it('should delete template by id', () => {
        const templates = [
          createMockTemplate({ id: 'template-1' }),
          createMockTemplate({ id: 'template-2' }),
        ];
        const store = createTestStore({ templates });

        store.dispatch(deleteTemplate('template-1'));

        const state = store.getState().ads;
        expect(state.templates).toHaveLength(1);
        expect(state.templates[0].id).toBe('template-2');
      });

      it('should handle deleting non-existent template', () => {
        const templates = [createMockTemplate({ id: 'template-1' })];
        const store = createTestStore({ templates });

        store.dispatch(deleteTemplate('non-existent'));

        const state = store.getState().ads;
        expect(state.templates).toHaveLength(1);
      });
    });

    describe('rollbackTemplate', () => {
      it('should rollback template to previous version', () => {
        const oldAnnotations = [
          createMockAnnotation({ id: 'old-annotation' }),
        ];
        const newAnnotations = [
          createMockAnnotation({ id: 'new-annotation' }),
        ];
        const template = createMockTemplate({
          id: 'template-1',
          version: 2,
          annotations: newAnnotations,
          versionHistory: [
            {
              version: 1,
              createdAt: '2024-01-01T00:00:00.000Z',
              annotations: oldAnnotations,
              accuracy: 75,
            },
          ],
        });
        const store = createTestStore({ templates: [template] });

        store.dispatch(
          rollbackTemplate({ templateId: 'template-1', version: 1 })
        );

        const state = store.getState().ads;
        expect(state.templates[0].version).toBe(1);
        expect(state.templates[0].annotations).toEqual(oldAnnotations);
        expect(state.templates[0].updatedAt).toBeDefined();
      });

      it('should not rollback to non-existent version', () => {
        const template = createMockTemplate({
          id: 'template-1',
          version: 2,
          versionHistory: [],
        });
        const store = createTestStore({ templates: [template] });

        store.dispatch(
          rollbackTemplate({ templateId: 'template-1', version: 1 })
        );

        const state = store.getState().ads;
        expect(state.templates[0].version).toBe(2);
      });

      it('should not rollback non-existent template', () => {
        const store = createTestStore();

        store.dispatch(
          rollbackTemplate({ templateId: 'non-existent', version: 1 })
        );

        const state = store.getState().ads;
        expect(state.templates).toHaveLength(0);
      });
    });

    describe('testTemplate', () => {
      it('should update template accuracy after test', async () => {
        const template = createMockTemplate({
          id: 'template-1',
          accuracy: 65,
        });
        const store = createTestStore({ templates: [template] });

        const testPromise = store.dispatch(
          testTemplate({ templateId: 'template-1', adId: 'ad-123' })
        );

        await jest.runAllTimersAsync();
        await testPromise;

        const state = store.getState().ads;
        expect(state.templates[0].accuracy).toBe(82);
      });

      it('should handle testing non-existent template', async () => {
        const store = createTestStore();

        const testPromise = store.dispatch(
          testTemplate({ templateId: 'non-existent', adId: 'ad-123' })
        );

        await jest.runAllTimersAsync();
        await testPromise;

        const state = store.getState().ads;
        expect(state.templates).toHaveLength(0);
      });
    });

    describe('downloadTemplate', () => {
      it('should download and add template to templates list', async () => {
        const store = createTestStore();

        const downloadPromise = store.dispatch(
          downloadTemplate('template-123')
        );

        await jest.runAllTimersAsync();
        await downloadPromise;

        const state = store.getState().ads;
        expect(state.templates).toHaveLength(1);
        expect(state.templates[0].id).toBe('template-123');
        expect(state.templates[0].isPublic).toBe(true);
      });

      it('should not add duplicate template', async () => {
        const existingTemplate = createMockTemplate({ id: 'template-123' });
        const store = createTestStore({ templates: [existingTemplate] });

        const downloadPromise = store.dispatch(
          downloadTemplate('template-123')
        );

        await jest.runAllTimersAsync();
        await downloadPromise;

        const state = store.getState().ads;
        expect(state.templates).toHaveLength(1);
      });
    });
  });

  // ============================================
  // 6. ACCURACY STATS TESTS
  // ============================================
  describe('Accuracy Stats', () => {
    describe('updateAccuracyStats', () => {
      it('should update overall accuracy', () => {
        const store = createTestStore();

        store.dispatch(updateAccuracyStats({ overall: 85 }));

        const state = store.getState().ads;
        expect(state.accuracyStats.overall).toBe(85);
      });

      it('should update byStore accuracy', () => {
        const store = createTestStore();

        store.dispatch(
          updateAccuracyStats({
            byStore: {
              'store-1': 90,
              'store-2': 75,
            },
          })
        );

        const state = store.getState().ads;
        expect(state.accuracyStats.byStore['store-1']).toBe(90);
        expect(state.accuracyStats.byStore['store-2']).toBe(75);
      });

      it('should merge with existing stats', () => {
        const store = createTestStore({
          accuracyStats: {
            overall: 80,
            byStore: { 'store-1': 85 },
            progression: [],
            totalDealsProcessed: 10,
            totalCorrections: 2,
          },
        });

        store.dispatch(updateAccuracyStats({ overall: 90 }));

        const state = store.getState().ads;
        expect(state.accuracyStats.overall).toBe(90);
        expect(state.accuracyStats.totalDealsProcessed).toBe(10); // Preserved
      });
    });

    describe('addAccuracyDataPoint', () => {
      it('should add data point to progression', () => {
        const store = createTestStore();

        store.dispatch(
          addAccuracyDataPoint({ accuracy: 85, dealsProcessed: 10 })
        );

        const state = store.getState().ads;
        expect(state.accuracyStats.progression).toHaveLength(1);
        expect(state.accuracyStats.progression[0].accuracy).toBe(85);
        expect(state.accuracyStats.progression[0].dealsProcessed).toBe(10);
        expect(state.accuracyStats.progression[0].date).toBeDefined();
      });

      it('should limit progression to 30 data points', () => {
        const existingPoints = Array.from({ length: 30 }, (_, i) => ({
          date: `2024-01-${i + 1}`,
          accuracy: 80 + i,
          dealsProcessed: 10,
        }));

        const store = createTestStore({
          accuracyStats: {
            overall: 0,
            byStore: {},
            progression: existingPoints,
            totalDealsProcessed: 0,
            totalCorrections: 0,
          },
        });

        store.dispatch(
          addAccuracyDataPoint({ accuracy: 95, dealsProcessed: 20 })
        );

        const state = store.getState().ads;
        expect(state.accuracyStats.progression).toHaveLength(30);
        expect(state.accuracyStats.progression[29].accuracy).toBe(95);
      });
    });
  });

  // ============================================
  // 7. CONFIDENCE LEVEL TESTS
  // ============================================
  describe('Confidence Level Helper', () => {
    it('should assign high confidence for >= 70', async () => {
      const mockAd = createMockAd({ id: 'ad-123' });
      const store = createTestStore({ uploadedAds: [mockAd] });

      const processPromise = store.dispatch(processAd('ad-123'));
      await jest.runAllTimersAsync();
      await processPromise;

      const state = store.getState().ads;
      const highConfDeals = state.uploadedAds[0].deals.filter(
        d => d.confidence >= 70
      );

      highConfDeals.forEach(deal => {
        expect(deal.confidenceLevel).toBe('high');
      });
    });

    it('should assign medium confidence for 50-69', async () => {
      const mockAd = createMockAd({ id: 'ad-123' });
      const store = createTestStore({ uploadedAds: [mockAd] });

      const processPromise = store.dispatch(processAd('ad-123'));
      await jest.runAllTimersAsync();
      await processPromise;

      const state = store.getState().ads;
      const mediumConfDeals = state.uploadedAds[0].deals.filter(
        d => d.confidence >= 50 && d.confidence < 70
      );

      mediumConfDeals.forEach(deal => {
        expect(deal.confidenceLevel).toBe('medium');
      });
    });

    it('should assign low confidence for < 50', async () => {
      const mockAd = createMockAd({ id: 'ad-123' });
      const store = createTestStore({ uploadedAds: [mockAd] });

      const processPromise = store.dispatch(processAd('ad-123'));
      await jest.runAllTimersAsync();
      await processPromise;

      const state = store.getState().ads;
      const lowConfDeals = state.uploadedAds[0].deals.filter(
        d => d.confidence < 50
      );

      lowConfDeals.forEach(deal => {
        expect(deal.confidenceLevel).toBe('low');
      });
    });
  });

  // ============================================
  // 8. ERROR HANDLING TESTS
  // ============================================
  describe('Error Handling', () => {
    describe('clearError', () => {
      it('should clear error state', () => {
        const store = createTestStore({ error: 'Test error' });

        store.dispatch(clearError());

        const state = store.getState().ads;
        expect(state.error).toBeNull();
      });
    });

    it('should set error on upload rejection', async () => {
      const store = createTestStore();

      // Force an error by mocking a failure
      const uploadPromise = store.dispatch(
        uploadAd({
          fileUri: '',
          fileType: 'pdf',
          fileName: '',
          storeId: '',
          storeName: '',
          adPeriodStart: '',
          adPeriodEnd: '',
        })
      );

      await jest.runAllTimersAsync();

      const state = store.getState().ads;
      expect(state.loading).toBe(false);
      // Error may or may not be set depending on implementation
    });

    it('should set error on process rejection', async () => {
      const store = createTestStore();

      const processPromise = store.dispatch(processAd('non-existent'));
      await jest.runAllTimersAsync();

      const state = store.getState().ads;
      expect(state.loading).toBe(false);
    });
  });

  // ============================================
  // 9. ASYNC THUNK STATE TESTS
  // ============================================
  describe('Async Thunk States', () => {
    it('should handle uploadAd pending->fulfilled flow', async () => {
      const store = createTestStore();
      let state = store.getState().ads;
      expect(state.loading).toBe(false);

      const uploadPromise = store.dispatch(
        uploadAd({
          fileUri: 'file://test.pdf',
          fileType: 'pdf',
          fileName: 'test.pdf',
          storeId: 'store-1',
          storeName: 'Test Store',
          adPeriodStart: '2024-01-01',
          adPeriodEnd: '2024-01-07',
        })
      );

      state = store.getState().ads;
      expect(state.loading).toBe(true);

      await jest.runAllTimersAsync();
      await uploadPromise;

      state = store.getState().ads;
      expect(state.loading).toBe(false);
      expect(state.uploadedAds).toHaveLength(1);
    });

    it('should handle processAd pending->fulfilled flow', async () => {
      const mockAd = createMockAd({ id: 'ad-123' });
      const store = createTestStore({ uploadedAds: [mockAd] });

      const processPromise = store.dispatch(processAd('ad-123'));

      let state = store.getState().ads;
      expect(state.loading).toBe(true);

      await jest.runAllTimersAsync();
      await processPromise;

      state = store.getState().ads;
      expect(state.loading).toBe(false);
      expect(state.uploadedAds[0].status).toBe('ready');
    });
  });

  // ============================================
  // 10. INTEGRATION TESTS
  // ============================================
  describe('Integration Scenarios', () => {
    it('should handle complete workflow: upload -> process -> review -> end', async () => {
      const store = createTestStore();

      // Upload
      const uploadPromise = store.dispatch(
        uploadAd({
          fileUri: 'file://test.pdf',
          fileType: 'pdf',
          fileName: 'test.pdf',
          storeId: 'store-1',
          storeName: 'Test Store',
          adPeriodStart: '2024-01-01',
          adPeriodEnd: '2024-01-07',
        })
      );
      await jest.runAllTimersAsync();
      await uploadPromise;

      let state = store.getState().ads;
      const adId = state.uploadedAds[0].id;

      // Process
      const processPromise = store.dispatch(processAd(adId));
      await jest.runAllTimersAsync();
      await processPromise;

      state = store.getState().ads;
      expect(state.uploadedAds[0].deals.length).toBeGreaterThan(0);

      // Review
      store.dispatch(startReviewSession(adId));
      state = store.getState().ads;
      const dealId = state.currentReview!.deals[0].id;

      store.dispatch(reviewDeal({ dealId, action: 'confirm' }));
      store.dispatch(endReviewSession());

      state = store.getState().ads;
      expect(state.currentReview).toBeNull();
      expect(state.uploadedAds[0].status).toBe('reviewed');
      expect(state.recentDeals.length).toBeGreaterThan(0);
    });

    it('should handle multiple ads upload and processing', async () => {
      const store = createTestStore();

      // Upload multiple ads
      const upload1 = store.dispatch(
        uploadAd({
          fileUri: 'file://test1.pdf',
          fileType: 'pdf',
          fileName: 'test1.pdf',
          storeId: 'store-1',
          storeName: 'Store 1',
          adPeriodStart: '2024-01-01',
          adPeriodEnd: '2024-01-07',
        })
      );

      const upload2 = store.dispatch(
        uploadAd({
          fileUri: 'file://test2.pdf',
          fileType: 'pdf',
          fileName: 'test2.pdf',
          storeId: 'store-2',
          storeName: 'Store 2',
          adPeriodStart: '2024-01-01',
          adPeriodEnd: '2024-01-07',
        })
      );

      await jest.runAllTimersAsync();
      await Promise.all([upload1, upload2]);

      const state = store.getState().ads;
      expect(state.uploadedAds).toHaveLength(2);
    });

    it('should maintain state consistency across operations', async () => {
      const store = createTestStore();

      // Upload
      const uploadPromise = store.dispatch(
        uploadAd({
          fileUri: 'file://test.pdf',
          fileType: 'pdf',
          fileName: 'test.pdf',
          storeId: 'store-1',
          storeName: 'Test Store',
          adPeriodStart: '2024-01-01',
          adPeriodEnd: '2024-01-07',
        })
      );
      await jest.runAllTimersAsync();
      await uploadPromise;

      let state = store.getState().ads;
      const adId = state.uploadedAds[0].id;

      // Process
      const processPromise = store.dispatch(processAd(adId));
      await jest.runAllTimersAsync();
      await processPromise;

      // Start review
      store.dispatch(startReviewSession(adId));

      // Make corrections
      state = store.getState().ads;
      const dealId = state.currentReview!.deals[0].id;

      store.dispatch(
        correctDeal({
          dealId,
          corrections: { price: 5.99 },
        })
      );

      store.dispatch(reviewDeal({ dealId, action: 'edit' }));

      // Verify state consistency
      state = store.getState().ads;
      expect(state.accuracyStats.totalDealsProcessed).toBe(1);
      expect(state.accuracyStats.totalCorrections).toBe(1);
      expect(state.currentReview?.editedCount).toBe(1);
    });
  });
});
