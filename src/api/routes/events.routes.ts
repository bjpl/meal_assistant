/**
 * Social Events Routes
 * Endpoints for managing social eating events and strategies
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';

const router = Router();

// Validation schemas
const eventCreateSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  eventType: Joi.string().valid('birthday', 'holiday', 'party', 'dinner_out', 'celebration', 'other').required(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  time: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  location: Joi.string().max(500).optional(),
  expectedCalories: Joi.number().min(0).max(5000).optional(),
  notes: Joi.string().max(1000).optional()
});

const eventUpdateSchema = Joi.object({
  title: Joi.string().min(2).max(200).optional(),
  eventType: Joi.string().valid('birthday', 'holiday', 'party', 'dinner_out', 'celebration', 'other').optional(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  location: Joi.string().max(500).optional(),
  expectedCalories: Joi.number().min(0).max(5000).optional(),
  notes: Joi.string().max(1000).optional()
}).min(1);

// Mock service
const eventService = {
  findByUser: async (userId: string, filters: any) => {
    return [{
      id: uuidv4(),
      userId,
      title: 'Birthday Party',
      eventType: 'birthday',
      date: '2025-12-30',
      ...filters
    }];
  },
  findById: async (id: string) => ({
    id,
    userId: 'user123',
    title: 'Holiday Dinner',
    eventType: 'holiday',
    date: '2025-12-25'
  }),
  create: async (data: any) => ({ id: uuidv4(), ...data }),
  update: async (id: string, data: any) => ({ id, ...data }),
  delete: async (id: string) => ({ id })
};

const strategyService = {
  generateStrategy: async (eventId: string, event: any) => ({
    eventId,
    strategy: 'bank_calories',
    preparation: {
      daysBefore: 1,
      calorieAdjustment: -200,
      recommendation: 'Reduce daily calories by 200 for 1 day before event'
    },
    duringEvent: {
      focusOn: ['protein', 'vegetables'],
      limit: ['refined_carbs', 'alcohol'],
      tips: ['Eat slowly', 'Stay hydrated', 'Choose smaller portions']
    },
    estimatedImpact: {
      totalCalories: event.expectedCalories || 2500,
      netImpact: '+500 above normal',
      weeklyAverage: 'Within target'
    }
  }),
  generateRecovery: async (eventId: string) => ({
    eventId,
    recovery: {
      duration: '2 days',
      dailyCalories: 1800,
      proteinTarget: 140,
      hydration: 'Increase water by 20oz/day',
      exercise: 'Light cardio recommended',
      meals: [
        { name: 'Breakfast', focus: 'High protein, low sugar' },
        { name: 'Lunch', focus: 'Vegetables and lean protein' },
        { name: 'Dinner', focus: 'Light, balanced meal' }
      ]
    }
  })
};

// Validation middleware
function validate(schema: Joi.Schema) {
  return (req: Request, _res: Response, next: any) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      throw new ApiError(400, 'Validation failed', { details: error.details });
    }
    req.body = value;
    next();
  };
}

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/events
 * @desc List social events for user
 * @access Private
 */
router.get('/', async (req: Request, res: Response) => {
  const { upcoming = 'true', past = 'false', eventType, limit = '20' } = req.query;

  const events = await eventService.findByUser(req.user!.id, {
    upcoming: upcoming === 'true',
    past: past === 'true',
    eventType
  });

  const filtered = events.slice(0, parseInt(limit as string));

  res.json({
    events: filtered,
    count: filtered.length,
    filters: { upcoming, past, eventType }
  });
});

/**
 * @route POST /api/events
 * @desc Create a social event
 * @access Private
 */
router.post('/', validate(eventCreateSchema), async (req: Request, res: Response) => {
  const { title, eventType, date, time, location, expectedCalories, notes } = req.body;

  const event = await eventService.create({
    userId: req.user!.id,
    title,
    eventType,
    date,
    time,
    location,
    expectedCalories,
    notes,
    createdAt: new Date().toISOString()
  });

  res.status(201).json({
    message: 'Event created successfully',
    event
  });
});

/**
 * @route PUT /api/events/:eventId
 * @desc Update an event
 * @access Private
 */
router.put('/:eventId', validate(eventUpdateSchema), async (req: Request, res: Response) => {
  const { eventId } = req.params;

  const event = await eventService.findById(eventId);

  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  if (event.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const updated = await eventService.update(eventId, {
    ...req.body,
    updatedAt: new Date().toISOString()
  });

  res.json({
    message: 'Event updated successfully',
    event: updated
  });
});

/**
 * @route DELETE /api/events/:eventId
 * @desc Delete an event
 * @access Private
 */
router.delete('/:eventId', async (req: Request, res: Response) => {
  const { eventId } = req.params;

  const event = await eventService.findById(eventId);

  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  if (event.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  await eventService.delete(eventId);

  res.json({
    message: 'Event deleted successfully',
    deletedId: eventId
  });
});

/**
 * @route GET /api/events/:eventId/strategy
 * @desc Get eating strategy for an event
 * @access Private
 */
router.get('/:eventId/strategy', async (req: Request, res: Response) => {
  const { eventId } = req.params;

  const event = await eventService.findById(eventId);

  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  if (event.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const strategy = await strategyService.generateStrategy(eventId, event);

  res.json({
    event: {
      id: event.id,
      title: event.title,
      date: event.date,
      eventType: event.eventType
    },
    strategy
  });
});

/**
 * @route GET /api/events/:eventId/recovery
 * @desc Get recovery plan after event
 * @access Private
 */
router.get('/:eventId/recovery', async (req: Request, res: Response) => {
  const { eventId } = req.params;

  const event = await eventService.findById(eventId);

  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  if (event.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const recovery = await strategyService.generateRecovery(eventId);

  res.json({
    event: {
      id: event.id,
      title: event.title,
      date: event.date
    },
    recovery
  });
});

export default router;
