/**
 * Price Intelligence Validation Schemas
 * Week 7-8: Schemas for price tracking and deal quality endpoints
 */

const Joi = require('joi');

// =============================================================================
// PRICE CAPTURE SCHEMAS
// =============================================================================

/**
 * Schema for capturing a price point
 * POST /api/prices/capture
 */
const priceCaptureSchema = Joi.object({
  componentId: Joi.string()
    .required()
    .messages({
      'any.required': 'Component ID is required'
    }),

  storeId: Joi.string()
    .allow(null)
    .optional()
    .messages({
      'string.base': 'Store ID must be a string'
    }),

  price: Joi.number()
    .min(0.01)
    .max(10000)
    .required()
    .messages({
      'number.min': 'Price must be at least $0.01',
      'number.max': 'Price cannot exceed $10,000',
      'any.required': 'Price is required'
    }),

  source: Joi.string()
    .valid('ad', 'receipt', 'manual', 'api')
    .required()
    .messages({
      'any.only': 'Source must be one of: ad, receipt, manual, api',
      'any.required': 'Price source is required'
    }),

  quantity: Joi.number()
    .min(0.01)
    .max(1000)
    .default(1)
    .messages({
      'number.min': 'Quantity must be greater than 0',
      'number.max': 'Quantity cannot exceed 1000'
    }),

  unit: Joi.string()
    .valid('count', 'oz', 'lb', 'g', 'kg', 'cup', 'tbsp', 'tsp', 'ml', 'l', 'each', 'pack')
    .default('count')
    .messages({
      'any.only': 'Invalid unit type'
    }),

  isDeal: Joi.boolean()
    .default(false),

  originalPrice: Joi.number()
    .min(0)
    .max(10000)
    .when('isDeal', {
      is: true,
      then: Joi.optional(),
      otherwise: Joi.forbidden()
    })
    .messages({
      'number.min': 'Original price must be non-negative',
      'number.max': 'Original price cannot exceed $10,000'
    }),

  recordedDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .default(() => new Date().toISOString().split('T')[0])
    .messages({
      'string.pattern.base': 'Date must be in YYYY-MM-DD format'
    }),

  sourceReferenceId: Joi.string()
    .uuid()
    .optional()
    .allow(null),

  notes: Joi.string()
    .max(1000)
    .optional()
    .allow('')
});

/**
 * Schema for price history query parameters
 * GET /api/prices/history/:componentId
 */
const priceHistoryQuerySchema = Joi.object({
  storeId: Joi.string()
    .optional()
    .allow(null, ''),

  startDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Start date must be in YYYY-MM-DD format'
    }),

  endDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': 'End date must be in YYYY-MM-DD format'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(500)
    .default(100)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 500'
    })
});

// =============================================================================
// DEAL ASSESSMENT SCHEMAS
// =============================================================================

/**
 * Schema for assessing a deal
 * POST /api/deals/assess
 */
const dealAssessSchema = Joi.object({
  dealPrice: Joi.number()
    .min(0.01)
    .max(10000)
    .required()
    .messages({
      'number.min': 'Deal price must be at least $0.01',
      'number.max': 'Deal price cannot exceed $10,000',
      'any.required': 'Deal price is required'
    }),

  componentId: Joi.string()
    .required()
    .messages({
      'any.required': 'Component ID is required'
    }),

  storeId: Joi.string()
    .optional()
    .allow(null),

  adDealId: Joi.string()
    .uuid()
    .optional()
    .allow(null),

  regularPrice: Joi.number()
    .min(0)
    .max(10000)
    .optional()
    .allow(null)
    .messages({
      'number.min': 'Regular price must be non-negative',
      'number.max': 'Regular price cannot exceed $10,000'
    }),

  storageDays: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(90)
    .messages({
      'number.min': 'Storage days must be at least 1',
      'number.max': 'Storage days cannot exceed 365'
    }),

  weeklyUsage: Joi.number()
    .min(0.1)
    .max(100)
    .default(1)
    .messages({
      'number.min': 'Weekly usage must be at least 0.1',
      'number.max': 'Weekly usage cannot exceed 100'
    }),

  unit: Joi.string()
    .valid('count', 'oz', 'lb', 'g', 'kg', 'cup', 'each', 'pack')
    .default('count')
});

/**
 * Schema for sale prediction request
 * POST /api/deals/cycle/predict
 */
const salePredictSchema = Joi.object({
  componentId: Joi.string()
    .required()
    .messages({
      'any.required': 'Component ID is required'
    }),

  storeId: Joi.string()
    .optional()
    .allow(null, '')
});

// =============================================================================
// RECEIPT SCHEMAS
// =============================================================================

/**
 * Schema for receipt scan request
 * POST /api/prices/receipt/scan
 */
const receiptScanSchema = Joi.object({
  fileUrl: Joi.string()
    .uri()
    .required()
    .messages({
      'string.uri': 'File URL must be a valid URL',
      'any.required': 'File URL is required'
    }),

  fileType: Joi.string()
    .valid('image/jpeg', 'image/png', 'image/gif', 'application/pdf')
    .default('image/jpeg')
    .messages({
      'any.only': 'File type must be JPEG, PNG, GIF, or PDF'
    }),

  fileSize: Joi.number()
    .integer()
    .min(0)
    .max(20 * 1024 * 1024) // 20 MB
    .optional()
    .messages({
      'number.max': 'File size cannot exceed 20 MB'
    }),

  storeId: Joi.string()
    .optional()
    .allow(null, ''),

  storeHint: Joi.string()
    .max(100)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Store hint cannot exceed 100 characters'
    }),

  rawText: Joi.string()
    .max(50000)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Raw text cannot exceed 50,000 characters'
    })
});

/**
 * Schema for correcting a receipt item
 * PUT /api/prices/receipt/:scanId/item/:itemId
 */
const receiptItemCorrectSchema = Joi.object({
  productName: Joi.string()
    .min(2)
    .max(255)
    .optional()
    .messages({
      'string.min': 'Product name must be at least 2 characters',
      'string.max': 'Product name cannot exceed 255 characters'
    }),

  price: Joi.number()
    .min(0)
    .max(10000)
    .optional()
    .messages({
      'number.min': 'Price must be non-negative',
      'number.max': 'Price cannot exceed $10,000'
    }),

  quantity: Joi.number()
    .min(0.01)
    .max(1000)
    .optional()
    .messages({
      'number.min': 'Quantity must be greater than 0',
      'number.max': 'Quantity cannot exceed 1000'
    }),

  componentId: Joi.string()
    .optional()
    .allow(null)
}).min(1).messages({
  'object.min': 'At least one field must be provided for correction'
});

// =============================================================================
// PRICE ALERT SCHEMAS
// =============================================================================

/**
 * Schema for creating a price alert
 * POST /api/prices/alerts
 */
const priceAlertCreateSchema = Joi.object({
  componentId: Joi.string()
    .required()
    .messages({
      'any.required': 'Component ID is required'
    }),

  storeId: Joi.string()
    .optional()
    .allow(null),

  alertType: Joi.string()
    .valid('price_drop', 'target_price', 'deal_quality', 'below_average')
    .required()
    .messages({
      'any.only': 'Alert type must be one of: price_drop, target_price, deal_quality, below_average',
      'any.required': 'Alert type is required'
    }),

  targetPrice: Joi.number()
    .min(0.01)
    .max(10000)
    .when('alertType', {
      is: 'target_price',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'any.required': 'Target price is required for target_price alerts'
    }),

  percentageDrop: Joi.number()
    .min(1)
    .max(90)
    .when('alertType', {
      is: 'price_drop',
      then: Joi.required().default(20),
      otherwise: Joi.optional()
    })
    .messages({
      'number.min': 'Percentage drop must be at least 1%',
      'number.max': 'Percentage drop cannot exceed 90%',
      'any.required': 'Percentage drop is required for price_drop alerts'
    }),

  minQualityScore: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .when('alertType', {
      is: 'deal_quality',
      then: Joi.required().default(7),
      otherwise: Joi.optional()
    })
    .messages({
      'number.min': 'Minimum quality score must be at least 1',
      'number.max': 'Minimum quality score cannot exceed 10'
    }),

  notifyEmail: Joi.boolean()
    .default(true),

  notifyPush: Joi.boolean()
    .default(true)
});

/**
 * Schema for updating a price alert
 * PUT /api/prices/alerts/:alertId
 */
const priceAlertUpdateSchema = Joi.object({
  targetPrice: Joi.number()
    .min(0.01)
    .max(10000)
    .optional(),

  percentageDrop: Joi.number()
    .min(1)
    .max(90)
    .optional(),

  minQualityScore: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .optional(),

  isActive: Joi.boolean()
    .optional(),

  notifyEmail: Joi.boolean()
    .optional(),

  notifyPush: Joi.boolean()
    .optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// =============================================================================
// BATCH OPERATIONS SCHEMAS
// =============================================================================

/**
 * Schema for batch price capture
 * POST /api/prices/capture/batch
 */
const priceBatchCaptureSchema = Joi.object({
  prices: Joi.array()
    .items(priceCaptureSchema)
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one price is required',
      'array.max': 'Cannot capture more than 100 prices at once',
      'any.required': 'Prices array is required'
    })
});

/**
 * Schema for batch deal assessment
 * POST /api/deals/assess/batch
 */
const dealBatchAssessSchema = Joi.object({
  deals: Joi.array()
    .items(dealAssessSchema)
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.min': 'At least one deal is required',
      'array.max': 'Cannot assess more than 50 deals at once',
      'any.required': 'Deals array is required'
    })
});

module.exports = {
  // Price capture
  priceCaptureSchema,
  priceHistoryQuerySchema,
  priceBatchCaptureSchema,

  // Deal assessment
  dealAssessSchema,
  salePredictSchema,
  dealBatchAssessSchema,

  // Receipt
  receiptScanSchema,
  receiptItemCorrectSchema,

  // Alerts
  priceAlertCreateSchema,
  priceAlertUpdateSchema
};
