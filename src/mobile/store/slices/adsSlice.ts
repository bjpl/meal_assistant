import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  AdsState,
  WeeklyAd,
  AdDeal,
  AdTemplate,
  DealReviewSession,
  AccuracyStats,
  TemplateAnnotation,
  ProcessingProgress,
  ConfidenceLevel,
} from '../../types/ads.types';

const initialState: AdsState = {
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
};

// Helper function to determine confidence level
const getConfidenceLevel = (confidence: number): ConfidenceLevel => {
  if (confidence >= 70) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
};

// Async thunks for API calls
export const uploadAd = createAsyncThunk(
  'ads/uploadAd',
  async (
    params: {
      fileUri: string;
      fileType: 'pdf' | 'image';
      fileName: string;
      storeId: string;
      storeName: string;
      adPeriodStart: string;
      adPeriodEnd: string;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const adId = `ad-${Date.now()}`;

      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 20) {
        dispatch(setUploadProgress({ progress, adId }));
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const newAd: WeeklyAd = {
        id: adId,
        storeId: params.storeId,
        storeName: params.storeName,
        adPeriodStart: params.adPeriodStart,
        adPeriodEnd: params.adPeriodEnd,
        uploadedAt: new Date().toISOString(),
        status: 'processing',
        fileType: params.fileType,
        fileUri: params.fileUri,
        pages: params.fileType === 'pdf' ? 4 : 1,
        deals: [],
      };

      return newAd;
    } catch (error) {
      return rejectWithValue('Failed to upload ad');
    }
  }
);

export const processAd = createAsyncThunk(
  'ads/processAd',
  async (adId: string, { dispatch, getState, rejectWithValue }) => {
    try {
      const steps: ProcessingProgress[] = [
        { step: 'uploading', stepNumber: 1, totalSteps: 5, message: 'Uploading...', estimatedTimeRemaining: 8 },
        { step: 'detecting_store', stepNumber: 2, totalSteps: 5, message: 'Detecting store...', estimatedTimeRemaining: 6 },
        { step: 'extracting_text', stepNumber: 3, totalSteps: 5, message: 'Extracting text...', estimatedTimeRemaining: 4 },
        { step: 'finding_deals', stepNumber: 4, totalSteps: 5, message: 'Finding deals...', estimatedTimeRemaining: 2 },
        { step: 'matching_to_list', stepNumber: 5, totalSteps: 5, message: 'Matching to list...', estimatedTimeRemaining: 1 },
      ];

      for (const progress of steps) {
        dispatch(updateProcessingProgress({ adId, progress }));
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Simulated extracted deals
      const mockDeals: AdDeal[] = [
        {
          id: `deal-${Date.now()}-1`,
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
        },
        {
          id: `deal-${Date.now()}-2`,
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
          id: `deal-${Date.now()}-3`,
          productName: 'Basmati Rice 5lb',
          price: 6.99,
          confidence: 58,
          confidenceLevel: 'medium',
          matchedShoppingListItemId: '4',
          matchedShoppingListItemName: 'Basmati Rice',
          status: 'pending',
        },
        {
          id: `deal-${Date.now()}-4`,
          productName: 'Bell Peppers 3-pack',
          price: 3.99,
          originalPrice: 4.99,
          confidence: 45,
          confidenceLevel: 'low',
          status: 'pending',
        },
        {
          id: `deal-${Date.now()}-5`,
          productName: 'Extra Virgin Olive Oil',
          price: 9.99,
          unit: '750ml',
          confidence: 38,
          confidenceLevel: 'low',
          status: 'pending',
        },
      ];

      return { adId, deals: mockDeals };
    } catch (error) {
      return rejectWithValue('Failed to process ad');
    }
  }
);

export const createTemplate = createAsyncThunk(
  'ads/createTemplate',
  async (
    params: {
      name: string;
      storeId: string;
      storeName: string;
      annotations: TemplateAnnotation[];
      isPublic: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      const template: AdTemplate = {
        id: `template-${Date.now()}`,
        name: params.name,
        storeId: params.storeId,
        storeName: params.storeName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'current-user',
        isPublic: params.isPublic,
        version: 1,
        versionHistory: [],
        annotations: params.annotations,
        accuracy: 0,
        usageCount: 0,
        successfulExtractions: 0,
        ratings: [],
        averageRating: 0,
        tags: [],
      };
      return template;
    } catch (error) {
      return rejectWithValue('Failed to create template');
    }
  }
);

export const testTemplate = createAsyncThunk(
  'ads/testTemplate',
  async (
    params: { templateId: string; adId: string },
    { rejectWithValue }
  ) => {
    try {
      // Simulate template testing
      await new Promise(resolve => setTimeout(resolve, 2000));
      return {
        templateId: params.templateId,
        beforeAccuracy: 65,
        afterAccuracy: 82,
        improvementPercent: 26,
      };
    } catch (error) {
      return rejectWithValue('Failed to test template');
    }
  }
);

export const downloadTemplate = createAsyncThunk(
  'ads/downloadTemplate',
  async (templateId: string, { rejectWithValue }) => {
    try {
      // Simulate download
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Return mock template data
      const template: AdTemplate = {
        id: templateId,
        name: 'Community Template',
        storeId: 'store-1',
        storeName: 'Whole Foods',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'community-user',
        isPublic: true,
        version: 3,
        versionHistory: [],
        annotations: [],
        accuracy: 78,
        usageCount: 245,
        successfulExtractions: 190,
        ratings: [],
        averageRating: 4.2,
        tags: ['weekly-ad', 'produce'],
      };
      return template;
    } catch (error) {
      return rejectWithValue('Failed to download template');
    }
  }
);

const adsSlice = createSlice({
  name: 'ads',
  initialState,
  reducers: {
    setUploadProgress: (
      state,
      action: PayloadAction<{ progress: number; adId: string }>
    ) => {
      state.currentUpload = {
        progress: action.payload.progress,
        adId: action.payload.adId,
      };
    },

    updateProcessingProgress: (
      state,
      action: PayloadAction<{ adId: string; progress: ProcessingProgress }>
    ) => {
      const ad = state.uploadedAds.find(a => a.id === action.payload.adId);
      if (ad) {
        ad.processingProgress = action.payload.progress;
      }
    },

    startReviewSession: (state, action: PayloadAction<string>) => {
      const ad = state.uploadedAds.find(a => a.id === action.payload);
      if (ad && ad.deals.length > 0) {
        state.currentReview = {
          adId: action.payload,
          deals: ad.deals,
          currentIndex: 0,
          reviewedCount: 0,
          confirmedCount: 0,
          rejectedCount: 0,
          editedCount: 0,
          startedAt: new Date().toISOString(),
        };
      }
    },

    reviewDeal: (
      state,
      action: PayloadAction<{
        dealId: string;
        action: 'confirm' | 'reject' | 'edit';
      }>
    ) => {
      if (!state.currentReview) return;

      const deal = state.currentReview.deals.find(
        d => d.id === action.payload.dealId
      );
      if (deal) {
        deal.status = action.payload.action === 'edit' ? 'edited' : action.payload.action === 'confirm' ? 'confirmed' : 'rejected';
        state.currentReview.reviewedCount++;

        if (action.payload.action === 'confirm') {
          state.currentReview.confirmedCount++;
        } else if (action.payload.action === 'reject') {
          state.currentReview.rejectedCount++;
        } else {
          state.currentReview.editedCount++;
        }

        // Move to next deal
        if (state.currentReview.currentIndex < state.currentReview.deals.length - 1) {
          state.currentReview.currentIndex++;
        }

        // Update accuracy stats
        state.accuracyStats.totalDealsProcessed++;
      }
    },

    correctDeal: (
      state,
      action: PayloadAction<{
        dealId: string;
        corrections: {
          productName?: string;
          price?: number;
          unit?: string;
          quantity?: number;
        };
      }>
    ) => {
      if (!state.currentReview) return;

      const deal = state.currentReview.deals.find(
        d => d.id === action.payload.dealId
      );
      if (deal) {
        deal.corrections = {
          ...action.payload.corrections,
          correctedAt: new Date().toISOString(),
        };
        deal.status = 'edited';
        state.accuracyStats.totalCorrections++;
      }
    },

    skipToIndex: (state, action: PayloadAction<number>) => {
      if (state.currentReview) {
        state.currentReview.currentIndex = Math.min(
          action.payload,
          state.currentReview.deals.length - 1
        );
      }
    },

    confirmAllHighConfidence: (state) => {
      if (!state.currentReview) return;

      state.currentReview.deals.forEach(deal => {
        if (deal.confidenceLevel === 'high' && deal.status === 'pending') {
          deal.status = 'confirmed';
          state.currentReview!.confirmedCount++;
          state.currentReview!.reviewedCount++;
        }
      });
    },

    endReviewSession: (state) => {
      if (state.currentReview) {
        // Update the ad with reviewed deals
        const ad = state.uploadedAds.find(a => a.id === state.currentReview!.adId);
        if (ad) {
          ad.deals = state.currentReview.deals;
          ad.status = 'reviewed';
        }

        // Update recent deals
        state.recentDeals = [
          ...state.currentReview.deals.filter(d => d.status === 'confirmed'),
          ...state.recentDeals,
        ].slice(0, 50);

        state.currentReview = null;
      }
    },

    updateAccuracyStats: (state, action: PayloadAction<Partial<AccuracyStats>>) => {
      state.accuracyStats = { ...state.accuracyStats, ...action.payload };
    },

    addAccuracyDataPoint: (state, action: PayloadAction<{ accuracy: number; dealsProcessed: number }>) => {
      state.accuracyStats.progression.push({
        date: new Date().toISOString(),
        accuracy: action.payload.accuracy,
        dealsProcessed: action.payload.dealsProcessed,
      });
      // Keep last 30 data points
      if (state.accuracyStats.progression.length > 30) {
        state.accuracyStats.progression = state.accuracyStats.progression.slice(-30);
      }
    },

    shareTemplate: (state, action: PayloadAction<string>) => {
      const template = state.templates.find(t => t.id === action.payload);
      if (template) {
        template.isPublic = true;
        template.updatedAt = new Date().toISOString();
      }
    },

    deleteTemplate: (state, action: PayloadAction<string>) => {
      state.templates = state.templates.filter(t => t.id !== action.payload);
    },

    rollbackTemplate: (
      state,
      action: PayloadAction<{ templateId: string; version: number }>
    ) => {
      const template = state.templates.find(t => t.id === action.payload.templateId);
      if (template) {
        const versionData = template.versionHistory.find(
          v => v.version === action.payload.version
        );
        if (versionData) {
          template.annotations = versionData.annotations;
          template.version = versionData.version;
          template.updatedAt = new Date().toISOString();
        }
      }
    },

    clearError: (state) => {
      state.error = null;
    },

    clearCurrentUpload: (state) => {
      state.currentUpload = null;
    },
  },
  extraReducers: builder => {
    builder
      // Upload Ad
      .addCase(uploadAd.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadAd.fulfilled, (state, action) => {
        state.loading = false;
        state.uploadedAds.unshift(action.payload);
        state.currentUpload = null;
      })
      .addCase(uploadAd.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.currentUpload = { progress: 0, error: action.payload as string };
      })
      // Process Ad
      .addCase(processAd.pending, state => {
        state.loading = true;
      })
      .addCase(processAd.fulfilled, (state, action) => {
        state.loading = false;
        const ad = state.uploadedAds.find(a => a.id === action.payload.adId);
        if (ad) {
          ad.deals = action.payload.deals;
          ad.status = 'ready';
          ad.processedAt = new Date().toISOString();
          ad.processingProgress = undefined;
        }
      })
      .addCase(processAd.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create Template
      .addCase(createTemplate.fulfilled, (state, action) => {
        state.templates.unshift(action.payload);
      })
      // Test Template
      .addCase(testTemplate.fulfilled, (state, action) => {
        const template = state.templates.find(
          t => t.id === action.payload.templateId
        );
        if (template) {
          template.accuracy = action.payload.afterAccuracy;
        }
      })
      // Download Template
      .addCase(downloadTemplate.fulfilled, (state, action) => {
        if (!state.templates.find(t => t.id === action.payload.id)) {
          state.templates.push(action.payload);
        }
      });
  },
});

export const {
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
} = adsSlice.actions;

export default adsSlice.reducer;
