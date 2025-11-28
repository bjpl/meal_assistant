/**
 * Prep Routes
 * Endpoints for meal preparation scheduling and task management
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate, prepScheduleSchema, prepTaskUpdateSchema } = require('../validators');
const { prepService, equipmentService, patternService } = require('../services/dataStore');
const { createPrepSession, PatternConfigs } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

// All prep routes require authentication
router.use(authenticate);

/**
 * @route GET /api/prep
 * @desc Get all prep sessions for user
 * @access Private
 */
router.get('/', (req, res) => {
  const { date, status } = req.query;

  const sessions = prepService.findByUser(req.user.id, { date, status });

  res.json({
    sessions,
    count: sessions.length
  });
});

/**
 * @route POST /api/prep/schedule
 * @desc Generate a prep timeline for a pattern
 * @access Private
 */
router.post('/schedule', validate(prepScheduleSchema), (req, res) => {
  const { patternType, date, targetMeals, preferences } = req.body;

  const config = PatternConfigs[patternType];
  if (!config) {
    throw new ApiError(400, 'Invalid pattern type');
  }

  // Generate prep tasks based on pattern
  const tasks = generatePrepTasks(config, preferences);

  // Check for equipment conflicts
  const requiredEquipment = [...new Set(tasks.flatMap(t => t.equipment))];
  const conflicts = equipmentService.checkConflicts(req.user.id, requiredEquipment);

  const session = createPrepSession(req.user.id, {
    patternType,
    date,
    targetMeals: targetMeals || config.meals.map(m => m.name),
    tasks,
    equipment: requiredEquipment,
    estimatedDuration: tasks.reduce((sum, t) => sum + t.duration, 0)
  });

  prepService.create(session);

  res.status(201).json({
    message: 'Prep schedule created',
    session,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
    timeline: generateTimeline(session.tasks)
  });
});

/**
 * @route GET /api/prep/equipment
 * @desc Check equipment availability
 * @access Private
 */
router.get('/equipment', (req, res) => {
  const equipment = equipmentService.findByUser(req.user.id);

  const available = equipment.filter(e => e.state === 'clean');
  const inUse = equipment.filter(e => e.state === 'in_use');
  const dirty = equipment.filter(e => e.state === 'dirty');
  const inDishwasher = equipment.filter(e => e.state === 'dishwasher');

  res.json({
    equipment,
    summary: {
      available: available.length,
      inUse: inUse.length,
      dirty: dirty.length,
      inDishwasher: inDishwasher.length
    },
    byState: {
      available: available.map(e => e.name),
      inUse: inUse.map(e => e.name),
      dirty: dirty.map(e => e.name),
      inDishwasher: inDishwasher.map(e => e.name)
    }
  });
});

/**
 * @route POST /api/prep/start
 * @desc Start a prep session
 * @access Private
 */
router.post('/start', (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    throw new ApiError(400, 'Session ID required');
  }

  const session = prepService.findById(sessionId);
  if (!session) {
    throw new ApiError(404, 'Prep session not found');
  }

  if (session.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  if (session.status === 'in_progress') {
    throw new ApiError(400, 'Session already started');
  }

  if (session.status === 'completed') {
    throw new ApiError(400, 'Session already completed');
  }

  // Start the first task
  const updatedSession = prepService.update(sessionId, {
    status: 'in_progress',
    startedAt: new Date().toISOString()
  });

  // Mark first task as in progress
  if (updatedSession.tasks.length > 0) {
    prepService.updateTask(sessionId, updatedSession.tasks[0].id, {
      status: 'in_progress',
      startedAt: new Date().toISOString()
    });
  }

  const refreshedSession = prepService.findById(sessionId);

  res.json({
    message: 'Prep session started',
    session: refreshedSession,
    currentTask: refreshedSession.tasks[0],
    estimatedCompletion: new Date(
      Date.now() + refreshedSession.estimatedDuration * 60 * 1000
    ).toISOString()
  });
});

/**
 * @route PUT /api/prep/task/:id
 * @desc Update a prep task status
 * @access Private
 */
router.put('/task/:id', validate(prepTaskUpdateSchema), (req, res) => {
  const { status, notes, actualDuration } = req.body;
  const taskId = req.params.id;

  // Find the session containing this task
  const sessions = prepService.findByUser(req.user.id);
  let targetSession = null;
  let taskIndex = -1;

  for (const session of sessions) {
    const idx = session.tasks.findIndex(t => t.id === taskId);
    if (idx >= 0) {
      targetSession = session;
      taskIndex = idx;
      break;
    }
  }

  if (!targetSession) {
    throw new ApiError(404, 'Task not found');
  }

  const updates = { status };
  if (notes) updates.notes = notes;
  if (actualDuration) updates.actualDuration = actualDuration;

  if (status === 'completed') {
    updates.completedAt = new Date().toISOString();
  }

  const updatedTask = prepService.updateTask(targetSession.id, taskId, updates);

  // Check if all tasks are complete
  const refreshedSession = prepService.findById(targetSession.id);
  const allComplete = refreshedSession.tasks.every(t =>
    t.status === 'completed' || t.status === 'skipped'
  );

  if (allComplete) {
    prepService.update(targetSession.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      actualDuration: refreshedSession.tasks.reduce((sum, t) =>
        sum + (t.actualDuration || t.duration), 0
      )
    });
  } else if (status === 'completed') {
    // Start next pending task
    const nextTask = refreshedSession.tasks.find(t => t.status === 'pending');
    if (nextTask) {
      prepService.updateTask(targetSession.id, nextTask.id, {
        status: 'in_progress',
        startedAt: new Date().toISOString()
      });
    }
  }

  const finalSession = prepService.findById(targetSession.id);

  res.json({
    message: 'Task updated',
    task: updatedTask,
    session: finalSession,
    progress: {
      completed: finalSession.tasks.filter(t => t.status === 'completed').length,
      total: finalSession.tasks.length,
      percentage: Math.round(
        (finalSession.tasks.filter(t => t.status === 'completed').length /
         finalSession.tasks.length) * 100
      )
    }
  });
});

/**
 * @route GET /api/prep/conflicts
 * @desc Detect equipment conflicts for a potential prep session
 * @access Private
 */
router.get('/conflicts', (req, res) => {
  const { patternType } = req.query;

  if (!patternType) {
    throw new ApiError(400, 'Pattern type required');
  }

  const config = PatternConfigs[patternType];
  if (!config) {
    throw new ApiError(400, 'Invalid pattern type');
  }

  // Generate tasks to determine required equipment
  const tasks = generatePrepTasks(config);
  const requiredEquipment = [...new Set(tasks.flatMap(t => t.equipment))];

  const conflicts = equipmentService.checkConflicts(req.user.id, requiredEquipment);
  const allEquipment = equipmentService.findByUser(req.user.id);

  // Suggest alternatives
  const suggestions = conflicts.map(conflict => {
    const alternatives = allEquipment.filter(e =>
      e.type === allEquipment.find(eq => eq.name === conflict.equipment)?.type &&
      e.state === 'clean' &&
      e.name !== conflict.equipment
    );

    return {
      equipment: conflict.equipment,
      currentState: conflict.currentState,
      alternatives: alternatives.map(a => a.name),
      resolution: conflict.currentState === 'dirty'
        ? 'Wash before starting prep'
        : conflict.currentState === 'dishwasher'
          ? 'Wait for dishwasher cycle to complete'
          : 'Wait for current use to complete'
    };
  });

  res.json({
    hasConflicts: conflicts.length > 0,
    conflicts: suggestions,
    requiredEquipment,
    readyEquipment: allEquipment
      .filter(e => e.state === 'clean')
      .map(e => e.name)
  });
});

/**
 * @route GET /api/prep/:id
 * @desc Get a specific prep session
 * @access Private
 */
router.get('/:id', (req, res) => {
  const session = prepService.findById(req.params.id);

  if (!session) {
    throw new ApiError(404, 'Prep session not found');
  }

  if (session.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  res.json({
    session,
    progress: {
      completed: session.tasks.filter(t => t.status === 'completed').length,
      total: session.tasks.length,
      currentTask: session.tasks.find(t => t.status === 'in_progress')
    }
  });
});

// Helper function to generate prep tasks based on pattern
function generatePrepTasks(config, preferences = {}) {
  const tasks = [];

  // Add standard prep tasks based on meal structure
  if (config.meals.some(m => m.calories >= 800)) {
    // Large meal - needs protein prep, carb prep, vegetable prep
    tasks.push({
      name: 'Prep protein (marinate/season)',
      duration: 10,
      equipment: ['cutting board', 'knife', 'bowl']
    });
    tasks.push({
      name: 'Start rice/carbs',
      duration: 5,
      equipment: ['rice cooker']
    });
  }

  // Add vegetable prep
  tasks.push({
    name: 'Wash and prep vegetables',
    duration: 15,
    equipment: ['cutting board', 'knife', 'colander']
  });

  // Add cooking tasks
  tasks.push({
    name: 'Cook protein',
    duration: 20,
    equipment: ['pan', 'stove']
  });

  tasks.push({
    name: 'Cook vegetables',
    duration: 10,
    equipment: ['pan', 'stove'],
    dependencies: ['Cook protein']
  });

  // Add assembly
  tasks.push({
    name: 'Assemble meals',
    duration: 10,
    equipment: ['plates', 'containers']
  });

  // Add cleanup
  tasks.push({
    name: 'Clean up',
    duration: 15,
    equipment: []
  });

  // Adjust based on preferences
  if (preferences?.batchCooking) {
    tasks.forEach(t => {
      t.duration = Math.ceil(t.duration * 1.5);
    });
    tasks.unshift({
      name: 'Prep for batch cooking',
      duration: 20,
      equipment: ['cutting board', 'knife', 'multiple containers']
    });
  }

  return tasks;
}

// Helper function to generate timeline
function generateTimeline(tasks) {
  let currentTime = new Date();

  return tasks.map(task => {
    const start = new Date(currentTime);
    currentTime = new Date(currentTime.getTime() + task.duration * 60 * 1000);

    return {
      task: task.name,
      startTime: start.toISOString(),
      endTime: currentTime.toISOString(),
      duration: task.duration,
      equipment: task.equipment
    };
  });
}

module.exports = router;
