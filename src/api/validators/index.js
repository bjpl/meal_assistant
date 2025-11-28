/**
 * Input Validation Schemas
 * Using Joi for request validation
 */

const Joi = require('joi');
const { PatternType } = require('../models');

// Pattern validation
const patternSelectSchema = Joi.object({
  patternType: Joi.string()
    .valid(...Object.values(PatternType))
    .required()
    .messages({
      'any.only': 'Pattern must be one of: traditional, reversed, if_noon, grazing_mini, grazing_platter, big_breakfast, morning_feast'
    }),
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .default(() => new Date().toISOString().split('T')[0])
    .messages({
      'string.pattern.base': 'Date must be in YYYY-MM-DD format'
    })
});

const patternSwitchSchema = Joi.object({
  currentPatternId: Joi.string().uuid().required(),
  newPatternType: Joi.string()
    .valid(...Object.values(PatternType))
    .required(),
  reason: Joi.string().max(500).optional()
});

// Meal validation
const mealLogSchema = Joi.object({
  mealId: Joi.string().uuid().required(),
  status: Joi.string()
    .valid('completed', 'partial', 'skipped')
    .required(),
  actualCalories: Joi.number().min(0).max(5000).optional(),
  actualProtein: Joi.number().min(0).max(500).optional(),
  rating: Joi.number().min(1).max(5).optional(),
  notes: Joi.string().max(1000).optional(),
  photoUrl: Joi.string().uri().optional(),
  substitutions: Joi.array().items(
    Joi.object({
      original: Joi.string().required(),
      replacement: Joi.string().required(),
      reason: Joi.string().optional()
    })
  ).optional()
});

const mealSubstituteSchema = Joi.object({
  ingredientName: Joi.string().required(),
  substituteName: Joi.string().required(),
  reason: Joi.string().max(500).optional(),
  calorieAdjustment: Joi.number().optional(),
  proteinAdjustment: Joi.number().optional()
});

// Inventory validation
const inventoryItemSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  category: Joi.string()
    .valid('protein', 'carbohydrate', 'vegetable', 'fruit', 'fat', 'dairy', 'beverage', 'condiment', 'spice', 'other')
    .required(),
  quantity: Joi.number().min(0).required(),
  unit: Joi.string()
    .valid('count', 'oz', 'lb', 'g', 'kg', 'cup', 'tbsp', 'tsp', 'ml', 'l')
    .required(),
  expiryDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  location: Joi.string()
    .valid('pantry', 'refrigerator', 'freezer', 'counter')
    .default('pantry'),
  purchaseDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  purchasePrice: Joi.number().min(0).optional(),
  store: Joi.string().max(100).optional(),
  notes: Joi.string().max(500).optional()
});

const inventoryBatchSchema = Joi.object({
  items: Joi.array()
    .items(inventoryItemSchema)
    .min(1)
    .max(100)
    .required()
});

const inventoryUpdateSchema = Joi.object({
  quantity: Joi.number().min(0).optional(),
  expiryDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  location: Joi.string()
    .valid('pantry', 'refrigerator', 'freezer', 'counter')
    .optional(),
  notes: Joi.string().max(500).optional()
}).min(1);

const inventoryConsumeSchema = Joi.object({
  mealId: Joi.string().uuid().required(),
  items: Joi.array().items(
    Joi.object({
      inventoryId: Joi.string().uuid().required(),
      quantityUsed: Joi.number().min(0).required()
    })
  ).min(1).required()
});

// Prep validation
const prepScheduleSchema = Joi.object({
  patternType: Joi.string()
    .valid(...Object.values(PatternType))
    .required(),
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  targetMeals: Joi.array()
    .items(Joi.string())
    .optional(),
  preferences: Joi.object({
    maxDuration: Joi.number().min(30).max(480).optional(),
    batchCooking: Joi.boolean().optional(),
    equipmentAvailable: Joi.array().items(Joi.string()).optional()
  }).optional()
});

const prepTaskUpdateSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'in_progress', 'completed', 'skipped')
    .required(),
  notes: Joi.string().max(500).optional(),
  actualDuration: Joi.number().min(0).optional()
});

// Shopping validation
const shoppingGenerateSchema = Joi.object({
  patterns: Joi.array()
    .items(
      Joi.object({
        patternType: Joi.string()
          .valid(...Object.values(PatternType))
          .required(),
        date: Joi.string()
          .pattern(/^\d{4}-\d{2}-\d{2}$/)
          .required()
      })
    )
    .min(1)
    .max(7)
    .required(),
  excludeInventory: Joi.boolean().default(true)
});

const shoppingOptimizeSchema = Joi.object({
  listId: Joi.string().uuid().required(),
  stores: Joi.array()
    .items(Joi.string())
    .min(1)
    .required(),
  weights: Joi.object({
    price: Joi.number().min(0).max(1).required(),
    distance: Joi.number().min(0).max(1).required(),
    quality: Joi.number().min(0).max(1).required(),
    time: Joi.number().min(0).max(1).required()
  }).custom((value, helpers) => {
    const sum = value.price + value.distance + value.quality + value.time;
    if (Math.abs(sum - 1) > 0.01) {
      return helpers.error('any.custom', { message: 'Weights must sum to 1.0' });
    }
    return value;
  }).optional()
});

const shoppingCheckSchema = Joi.object({
  purchased: Joi.boolean().required(),
  actualPrice: Joi.number().min(0).optional(),
  store: Joi.string().max(100).optional(),
  notes: Joi.string().max(500).optional()
});

// Analytics query params validation
const analyticsQuerySchema = Joi.object({
  startDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  patternType: Joi.string()
    .valid(...Object.values(PatternType))
    .optional(),
  granularity: Joi.string()
    .valid('day', 'week', 'month')
    .default('day')
});

// Auth validation
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
  name: Joi.string().min(1).max(100).optional(),
  profile: Joi.object({
    weight: Joi.number().min(50).max(500).optional(),
    height: Joi.number().min(36).max(96).optional(),
    targetCalories: Joi.number().min(1200).max(4000).optional(),
    targetProtein: Joi.number().min(50).max(300).optional()
  }).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// =============================================================================
// Hydration & Caffeine Validation Schemas (Week 1-2 Option B)
// =============================================================================

// Log water or non-caffeinated beverage intake
const hydrationLogSchema = Joi.object({
  amount_oz: Joi.number()
    .min(1)
    .max(128)
    .required()
    .messages({
      'number.min': 'Amount must be at least 1 oz',
      'number.max': 'Amount cannot exceed 128 oz',
      'any.required': 'Amount in oz is required'
    }),
  beverage_type: Joi.string()
    .valid('water', 'tea', 'other')
    .default('water')
    .messages({
      'any.only': 'Beverage type must be water, tea, or other'
    }),
  timestamp: Joi.string()
    .isoDate()
    .optional()
    .messages({
      'string.isoDate': 'Timestamp must be a valid ISO date'
    }),
  notes: Joi.string()
    .max(500)
    .optional()
});

// Log caffeinated beverage intake
const caffeineLogSchema = Joi.object({
  beverage_type: Joi.string()
    .valid('coffee', 'tea', 'soda', 'energy_drink', 'other')
    .required()
    .messages({
      'any.only': 'Beverage type must be coffee, tea, soda, energy_drink, or other',
      'any.required': 'Beverage type is required'
    }),
  volume_oz: Joi.number()
    .min(1)
    .max(64)
    .required()
    .messages({
      'number.min': 'Volume must be at least 1 oz',
      'number.max': 'Volume cannot exceed 64 oz',
      'any.required': 'Volume in oz is required'
    }),
  caffeine_mg: Joi.number()
    .min(0)
    .max(1000)
    .optional()
    .messages({
      'number.min': 'Caffeine cannot be negative',
      'number.max': 'Caffeine cannot exceed 1000mg'
    }),
  timestamp: Joi.string()
    .isoDate()
    .optional(),
  notes: Joi.string()
    .max(500)
    .optional()
});

// Update hydration goals
const hydrationGoalsUpdateSchema = Joi.object({
  daily_water_oz: Joi.number()
    .min(32)
    .max(256)
    .optional()
    .messages({
      'number.min': 'Daily water goal must be at least 32 oz',
      'number.max': 'Daily water goal cannot exceed 256 oz'
    }),
  daily_caffeine_limit_mg: Joi.number()
    .min(0)
    .max(600)
    .optional()
    .messages({
      'number.min': 'Caffeine limit cannot be negative',
      'number.max': 'Caffeine limit cannot exceed 600mg'
    }),
  personalized_formula_enabled: Joi.boolean()
    .optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided'
});

// Query params for hydration trends
const hydrationTrendsQuerySchema = Joi.object({
  period: Joi.string()
    .valid('week', 'month', 'all')
    .default('week'),
  start_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

// =============================================================================
// Weekly Ads Validation Schemas (Week 3-4)
// =============================================================================

// Upload a weekly ad
const adUploadSchema = Joi.object({
  fileData: Joi.string()
    .required()
    .messages({
      'any.required': 'File data (base64) is required'
    }),
  filename: Joi.string()
    .required()
    .pattern(/\.(pdf|jpg|jpeg|png|gif)$/i)
    .messages({
      'any.required': 'Filename is required',
      'string.pattern.base': 'File must be PDF, JPG, JPEG, PNG, or GIF'
    }),
  fileSize: Joi.number()
    .required()
    .min(1)
    .max(10 * 1024 * 1024) // 10 MB
    .messages({
      'number.max': 'File size cannot exceed 10 MB'
    }),
  storeId: Joi.string()
    .uuid()
    .optional()
    .allow(null),
  adPeriod: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Ad period must be in YYYY-MM-DD format'
    })
});

// Process an ad
const adProcessSchema = Joi.object({
  useML: Joi.boolean()
    .default(false),
  forceReprocess: Joi.boolean()
    .default(false)
});

// Correct a deal
const dealCorrectSchema = Joi.object({
  productName: Joi.string()
    .min(2)
    .max(500)
    .optional(),
  price: Joi.number()
    .min(0)
    .max(10000)
    .optional(),
  category: Joi.string()
    .max(100)
    .optional(),
  brand: Joi.string()
    .max(255)
    .optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for correction'
});

// Match deals to shopping list
const dealMatchSchema = Joi.object({
  shoppingListId: Joi.string()
    .uuid()
    .required()
    .messages({
      'any.required': 'Shopping list ID is required'
    }),
  shoppingItems: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().uuid().required(),
        name: Joi.string().required(),
        quantity: Joi.number().optional(),
        unit: Joi.string().optional(),
        category: Joi.string().optional(),
        brand: Joi.string().optional()
      })
    )
    .min(1)
    .required()
    .messages({
      'any.required': 'Shopping items are required',
      'array.min': 'At least one shopping item is required'
    }),
  minConfidence: Joi.number()
    .min(0)
    .max(100)
    .default(50),
  autoApply: Joi.boolean()
    .default(false)
});

// Create a template
const templateCreateSchema = Joi.object({
  storeId: Joi.string()
    .uuid()
    .optional()
    .allow(null),
  templateName: Joi.string()
    .min(3)
    .max(255)
    .required()
    .messages({
      'any.required': 'Template name is required',
      'string.min': 'Template name must be at least 3 characters'
    }),
  layoutType: Joi.string()
    .valid('grid', 'list', 'mixed', 'circular', 'custom')
    .default('mixed'),
  extractionRules: Joi.object({
    price_patterns: Joi.array().items(Joi.string()).optional(),
    product_regions: Joi.array().items(Joi.object()).optional(),
    field_mappings: Joi.object().optional()
  }).optional(),
  pageStructure: Joi.object().optional()
});

// Update a template
const templateUpdateSchema = Joi.object({
  templateName: Joi.string()
    .min(3)
    .max(255)
    .optional(),
  layoutType: Joi.string()
    .valid('grid', 'list', 'mixed', 'circular', 'custom')
    .optional(),
  extractionRules: Joi.object().optional(),
  pageStructure: Joi.object().optional(),
  isPublic: Joi.boolean().optional()
}).min(1);

// A/B test a template
const templateTestSchema = Joi.object({
  adId: Joi.string()
    .uuid()
    .required()
    .messages({
      'any.required': 'Ad ID is required for testing'
    }),
  variantRules: Joi.object()
    .required()
    .messages({
      'any.required': 'Variant rules are required'
    })
});

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      error.isJoi = true;
      return next(error);
    }

    req[property] = value;
    next();
  };
}

// Multi-Store Optimization Schemas (Week 5-6)
const {
  weightProfileSchema,
  distributeSchema,
  reassignSchema,
  routeSchema,
  savingsEstimateSchema,
  directionsSchema,
  storeRatingSchema,
  weightsSchema,
  locationSchema,
  storeSchema,
  itemSchema: optimizationItemSchema
} = require('./optimizationSchemas');

// Price Intelligence Schemas (Week 7-8)
const {
  priceCaptureSchema,
  priceHistoryQuerySchema,
  priceBatchCaptureSchema,
  dealAssessSchema,
  salePredictSchema,
  dealBatchAssessSchema,
  receiptScanSchema,
  receiptItemCorrectSchema,
  priceAlertCreateSchema,
  priceAlertUpdateSchema
} = require('./priceSchemas');

module.exports = {
  // Schemas
  patternSelectSchema,
  patternSwitchSchema,
  mealLogSchema,
  mealSubstituteSchema,
  inventoryItemSchema,
  inventoryBatchSchema,
  inventoryUpdateSchema,
  inventoryConsumeSchema,
  prepScheduleSchema,
  prepTaskUpdateSchema,
  shoppingGenerateSchema,
  shoppingOptimizeSchema,
  shoppingCheckSchema,
  analyticsQuerySchema,
  registerSchema,
  loginSchema,
  // Hydration & Caffeine Schemas (Week 1-2 Option B)
  hydrationLogSchema,
  caffeineLogSchema,
  hydrationGoalsUpdateSchema,
  hydrationTrendsQuerySchema,
  // Weekly Ads Schemas (Week 3-4)
  adUploadSchema,
  adProcessSchema,
  dealCorrectSchema,
  dealMatchSchema,
  templateCreateSchema,
  templateUpdateSchema,
  templateTestSchema,
  // Multi-Store Optimization Schemas (Week 5-6)
  weightProfileSchema,
  distributeSchema,
  reassignSchema,
  routeSchema,
  savingsEstimateSchema,
  directionsSchema,
  storeRatingSchema,
  weightsSchema,
  locationSchema,
  storeSchema,
  optimizationItemSchema,
  // Price Intelligence Schemas (Week 7-8)
  priceCaptureSchema,
  priceHistoryQuerySchema,
  priceBatchCaptureSchema,
  dealAssessSchema,
  salePredictSchema,
  dealBatchAssessSchema,
  receiptScanSchema,
  receiptItemCorrectSchema,
  priceAlertCreateSchema,
  priceAlertUpdateSchema,
  // Middleware factory
  validate
};
