/**
 * Optimization Validation Schemas
 * Week 5-6 Implementation - PRD User Story 1.1
 *
 * Joi schemas for multi-store optimization endpoints
 */

import Joi from 'joi';

// Weight object schema (reusable)
export const weightsSchema = Joi.object({
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
});

// Location schema (reusable)
export const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  address: Joi.string().max(500).optional()
});

// Store schema (reusable)
export const storeSchema = Joi.object({
  id: Joi.string().uuid().required(),
  name: Joi.string().max(255).required(),
  address: Joi.string().max(500).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  location: locationSchema.optional(),
  storeType: Joi.string().valid(
    'grocery', 'discount', 'warehouse', 'organic', 'specialty'
  ).optional(),
  avgVisitDuration: Joi.number().min(5).max(120).optional(),
  rating: Joi.number().min(1).max(5).optional()
});

// Item schema (reusable)
export const itemSchema = Joi.object({
  id: Joi.string().uuid().required(),
  name: Joi.string().max(255).required(),
  category: Joi.string().max(100).optional(),
  quantity: Joi.number().min(0).optional(),
  unit: Joi.string().max(20).optional(),
  estimatedPrice: Joi.number().min(0).optional()
});

/**
 * Schema for POST /api/optimization/weights
 * Create or update a weight profile
 */
export const weightProfileSchema = Joi.object({
  profileName: Joi.string()
    .valid('balanced', 'cost_focused', 'time_focused', 'quality_focused', 'custom')
    .required()
    .messages({
      'any.only': 'Profile name must be balanced, cost_focused, time_focused, quality_focused, or custom'
    }),
  displayName: Joi.string()
    .min(2)
    .max(100)
    .optional(),
  weights: weightsSchema.required(),
  isDefault: Joi.boolean()
    .default(false),
  isActive: Joi.boolean()
    .default(false)
});

/**
 * Schema for POST /api/optimization/distribute
 * Optimize shopping list distribution across stores
 */
export const distributeSchema = Joi.object({
  shoppingListId: Joi.string()
    .uuid()
    .required()
    .messages({
      'any.required': 'Shopping list ID is required'
    }),
  items: Joi.array()
    .items(itemSchema)
    .min(1)
    .max(200)
    .required()
    .messages({
      'array.min': 'At least one item is required',
      'array.max': 'Maximum 200 items per optimization'
    }),
  stores: Joi.array()
    .items(storeSchema)
    .min(1)
    .max(10)
    .required()
    .messages({
      'array.min': 'At least one store is required',
      'array.max': 'Maximum 10 stores per optimization'
    }),
  weights: weightsSchema.optional(),
  profileId: Joi.string()
    .uuid()
    .optional(),
  userLocation: locationSchema.optional()
});

/**
 * Schema for PUT /api/optimization/reassign
 * Reassign an item from one store to another
 */
export const reassignSchema = Joi.object({
  assignmentId: Joi.string()
    .uuid()
    .required()
    .messages({
      'any.required': 'Assignment ID is required'
    }),
  fromStoreId: Joi.string()
    .uuid()
    .required(),
  toStoreId: Joi.string()
    .uuid()
    .required(),
  reason: Joi.string()
    .max(500)
    .optional(),
  stores: Joi.array()
    .items(storeSchema)
    .min(1)
    .required()
    .messages({
      'any.required': 'Store list is required for price lookup'
    })
});

/**
 * Schema for POST /api/optimization/route
 * Calculate optimal route through stores
 */
export const routeSchema = Joi.object({
  stores: Joi.array()
    .items(storeSchema)
    .min(1)
    .max(10)
    .required()
    .messages({
      'array.min': 'At least one store is required',
      'array.max': 'Maximum 10 stores per route'
    }),
  startLocation: locationSchema.required()
    .messages({
      'any.required': 'Start location is required'
    }),
  options: Joi.object({
    optimize: Joi.string().valid('distance', 'time').default('distance'),
    includeTraffic: Joi.boolean().default(false),
    departureTime: Joi.date().iso().optional(),
    returnToStart: Joi.boolean().default(false)
  }).optional()
});

/**
 * Schema for POST /api/optimization/estimate-savings
 * Calculate potential savings from multi-store shopping
 */
export const savingsEstimateSchema = Joi.object({
  items: Joi.array()
    .items(itemSchema)
    .min(1)
    .max(200)
    .required()
    .messages({
      'array.min': 'At least one item is required for estimate'
    }),
  stores: Joi.array()
    .items(storeSchema)
    .min(2)
    .max(10)
    .required()
    .messages({
      'array.min': 'At least two stores are required to compare savings',
      'array.max': 'Maximum 10 stores per estimate'
    }),
  weights: weightsSchema.optional()
});

/**
 * Schema for POST /api/optimization/route/directions
 * Get turn-by-turn directions for a route
 */
export const directionsSchema = Joi.object({
  stores: Joi.array()
    .items(storeSchema)
    .min(1)
    .max(10)
    .optional(),
  startLocation: locationSchema.required()
    .messages({
      'any.required': 'Start location is required for directions'
    }),
  routeId: Joi.string()
    .uuid()
    .optional()
}).or('stores', 'routeId')
  .messages({
    'object.missing': 'Either stores array or routeId must be provided'
  });

/**
 * Schema for store rating submission
 */
export const storeRatingSchema = Joi.object({
  storeId: Joi.string()
    .uuid()
    .required(),
  overallRating: Joi.number()
    .min(1)
    .max(5)
    .required(),
  priceRating: Joi.number()
    .min(1)
    .max(5)
    .optional(),
  qualityRating: Joi.number()
    .min(1)
    .max(5)
    .optional(),
  serviceRating: Joi.number()
    .min(1)
    .max(5)
    .optional(),
  avgVisitDurationMinutes: Joi.number()
    .min(5)
    .max(120)
    .optional(),
  notes: Joi.string()
    .max(1000)
    .optional()
});
