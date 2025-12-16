/**
 * Meal Prep Routes
 * Endpoints for managing meal preparation sessions and tasks
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import prepService from '../database/services/prepService';

// Extend prepService with missing methods
const extendedPrepService = {
  ...prepService,

  async findUpcoming(userId: string, days: number): Promise<any[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const sessions = await prepService.findByUser(userId);
    return sessions.filter(s => {
      const sessionDate = new Date(s.date);
      return sessionDate >= now && sessionDate <= futureDate;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  async addTask(sessionId: string, task: any): Promise<any> {
    const session = await prepService.findById(sessionId);
    if (!session) return null;
    const tasks = [...(session.tasks || []), task];
    return prepService.update(sessionId, { tasks: JSON.stringify(tasks) });
  }
};
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All prep routes require authentication
router.use(authenticate);

/**
 * @route GET /api/prep
 * @desc Get all prep sessions for user
 * @access Private
 */
router.get('/', async (req: Request, res: Response) => {
  const { status, upcoming } = req.query;

  let sessions = await extendedPrepService.findByUser(req.user!.id, {
    status: status as string
  });

  // Filter to upcoming if requested
  if (upcoming === 'true') {
    const now = new Date();
    sessions = sessions.filter(s => new Date(s.scheduledDate) >= now);
  }

  res.json({
    sessions,
    summary: {
      total: sessions.length,
      planned: sessions.filter(s => s.status === 'planned').length,
      inProgress: sessions.filter(s => s.status === 'in_progress').length,
      completed: sessions.filter(s => s.status === 'completed').length
    }
  });
});

/**
 * @route GET /api/prep/upcoming
 * @desc Get upcoming prep sessions
 * @access Private
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 7;
  const sessions = await extendedPrepService.findUpcoming(req.user!.id, days);

  res.json({
    sessions,
    nextSession: sessions[0] || null,
    totalPlanned: sessions.length
  });
});

/**
 * @route GET /api/prep/:id
 * @desc Get specific prep session
 * @access Private
 */
router.get('/:id', async (req: Request, res: Response) => {
  const session = await extendedPrepService.findById(req.params.id);

  if (!session) {
    throw new ApiError(404, 'Prep session not found');
  }

  if (session.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  // Calculate time estimates
  const totalMinutes = session.tasks?.reduce((sum: number, task: any) =>
    sum + (task.estimatedMinutes || 0), 0) || 0;

  res.json({
    session,
    estimates: {
      totalMinutes,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      tasksCount: session.tasks?.length || 0
    }
  });
});

/**
 * @route POST /api/prep
 * @desc Create new prep session
 * @access Private
 */
router.post('/', async (req: Request, res: Response) => {
  const {
    name,
    scheduledDate,
    scheduledStartTime,
    scheduledEndTime,
    notes,
    tasks
  } = req.body;

  if (!scheduledDate) {
    throw new ApiError(400, 'Scheduled date is required');
  }

  const sessionTasks = tasks?.map((task: any) => ({
    id: uuidv4(),
    name: task.name,
    description: task.description,
    estimatedMinutes: task.estimatedMinutes || 15,
    category: task.category || 'general',
    equipment: task.equipment || [],
    ingredients: task.ingredients || [],
    status: 'pending',
    order: task.order || 0
  })) || [];

  // Build notes with time info if provided
  let sessionNotes = name ? `${name}\n${notes || ''}` : (notes || '');
  if (scheduledStartTime || scheduledEndTime) {
    sessionNotes += `\nScheduled: ${scheduledStartTime || 'TBD'} - ${scheduledEndTime || 'TBD'}`;
  }

  const session = await extendedPrepService.create({
    id: uuidv4(),
    userId: req.user!.id,
    date: new Date(scheduledDate),
    status: 'planned',
    notes: sessionNotes.trim() || undefined,
    tasks: sessionTasks
  });

  res.status(201).json({
    message: 'Prep session created',
    session
  });
});

/**
 * @route PUT /api/prep/:id
 * @desc Update prep session
 * @access Private
 */
router.put('/:id', async (req: Request, res: Response) => {
  const session = await extendedPrepService.findById(req.params.id);

  if (!session) {
    throw new ApiError(404, 'Prep session not found');
  }

  if (session.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const updated = await extendedPrepService.update(req.params.id, req.body);

  res.json({
    message: 'Prep session updated',
    session: updated
  });
});

/**
 * @route POST /api/prep/:id/start
 * @desc Start a prep session
 * @access Private
 */
router.post('/:id/start', async (req: Request, res: Response) => {
  const session = await extendedPrepService.findById(req.params.id);

  if (!session) {
    throw new ApiError(404, 'Prep session not found');
  }

  if (session.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  if (session.status !== 'planned') {
    throw new ApiError(400, 'Session has already been started or completed');
  }

  const updated = await prepService.update(req.params.id, {
    status: 'in_progress',
    actualStartTime: new Date()
  });

  res.json({
    message: 'Prep session started',
    session: updated,
    tip: 'Start with tasks that need the most time (like marinating or slow cooking)'
  });
});

/**
 * @route POST /api/prep/:id/complete
 * @desc Complete a prep session
 * @access Private
 */
router.post('/:id/complete', async (req: Request, res: Response) => {
  const { notes } = req.body;
  const session = await extendedPrepService.findById(req.params.id);

  if (!session) {
    throw new ApiError(404, 'Prep session not found');
  }

  if (session.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const actualEnd = new Date();
  const actualStart = session.actualStartTime ? new Date(session.actualStartTime) : actualEnd;
  const actualDurationMinutes = Math.round((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60));

  const updated = await prepService.update(req.params.id, {
    status: 'completed',
    actualEndTime: actualEnd,
    notes: notes ? `${session.notes || ''}\n\nCompletion notes: ${notes}` : session.notes
  });

  // Calculate stats
  const completedTasks = session.tasks?.filter((t: any) => t.status === 'completed').length || 0;
  const totalTasks = session.tasks?.length || 0;

  res.json({
    message: 'Prep session completed!',
    session: updated,
    summary: {
      actualDurationMinutes,
      tasksCompleted: completedTasks,
      totalTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100
    }
  });
});

/**
 * @route PUT /api/prep/:sessionId/tasks/:taskId
 * @desc Update a task within a prep session
 * @access Private
 */
router.put('/:sessionId/tasks/:taskId', async (req: Request, res: Response) => {
  const session = await prepService.findById(req.params.sessionId);

  if (!session) {
    throw new ApiError(404, 'Prep session not found');
  }

  if (session.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const updated = await extendedPrepService.updateTask(
    req.params.sessionId,
    req.params.taskId,
    req.body
  );

  res.json({
    message: 'Task updated',
    session: updated
  });
});

/**
 * @route POST /api/prep/:sessionId/tasks/:taskId/complete
 * @desc Mark a task as completed
 * @access Private
 */
router.post('/:sessionId/tasks/:taskId/complete', async (req: Request, res: Response) => {
  const { actualMinutes, notes } = req.body;
  const session = await prepService.findById(req.params.sessionId);

  if (!session) {
    throw new ApiError(404, 'Prep session not found');
  }

  if (session.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const updated = await extendedPrepService.updateTask(
    req.params.sessionId,
    req.params.taskId,
    {
      status: 'completed',
      actualMinutes,
      completedAt: new Date(),
      notes
    }
  );

  // Check if all tasks completed
  const allCompleted = updated?.tasks?.every((t: any) => t.status === 'completed');

  res.json({
    message: 'Task completed',
    session: updated,
    allTasksCompleted: allCompleted,
    suggestion: allCompleted ? 'All tasks done! Complete the prep session.' : null
  });
});

/**
 * @route POST /api/prep/:id/tasks
 * @desc Add a task to prep session
 * @access Private
 */
router.post('/:id/tasks', async (req: Request, res: Response) => {
  const session = await extendedPrepService.findById(req.params.id);

  if (!session) {
    throw new ApiError(404, 'Prep session not found');
  }

  if (session.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  const { name, description, estimatedMinutes, category, equipment, ingredients } = req.body;

  if (!name) {
    throw new ApiError(400, 'Task name is required');
  }

  const newTask = {
    id: uuidv4(),
    name,
    description,
    estimatedMinutes: estimatedMinutes || 15,
    category: category || 'general',
    equipment: equipment || [],
    ingredients: ingredients || [],
    status: 'pending',
    order: (session.tasks?.length || 0) + 1
  };

  const updated = await extendedPrepService.addTask(req.params.id, newTask);

  res.status(201).json({
    message: 'Task added',
    session: updated,
    task: newTask
  });
});

/**
 * @route DELETE /api/prep/:id
 * @desc Delete prep session
 * @access Private
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const session = await extendedPrepService.findById(req.params.id);

  if (!session) {
    throw new ApiError(404, 'Prep session not found');
  }

  if (session.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  await extendedPrepService.delete(req.params.id);

  res.json({ message: 'Prep session deleted' });
});

/**
 * @route GET /api/prep/templates
 * @desc Get prep session templates
 * @access Private
 */
router.get('/templates/list', async (_req: Request, res: Response) => {
  // Return common prep session templates
  const templates = [
    {
      id: 'weekly-protein',
      name: 'Weekly Protein Prep',
      description: 'Batch cook proteins for the week',
      estimatedMinutes: 120,
      tasks: [
        { name: 'Season chicken breasts', estimatedMinutes: 10, category: 'prep' },
        { name: 'Bake chicken', estimatedMinutes: 45, category: 'cook' },
        { name: 'Cook ground turkey', estimatedMinutes: 20, category: 'cook' },
        { name: 'Portion and store', estimatedMinutes: 15, category: 'storage' }
      ]
    },
    {
      id: 'veggie-prep',
      name: 'Vegetable Prep',
      description: 'Wash, chop, and store vegetables',
      estimatedMinutes: 45,
      tasks: [
        { name: 'Wash all vegetables', estimatedMinutes: 10, category: 'prep' },
        { name: 'Chop onions and peppers', estimatedMinutes: 15, category: 'prep' },
        { name: 'Prepare salad greens', estimatedMinutes: 10, category: 'prep' },
        { name: 'Store in containers', estimatedMinutes: 10, category: 'storage' }
      ]
    },
    {
      id: 'grain-batch',
      name: 'Grain Batch Cooking',
      description: 'Cook grains for the week',
      estimatedMinutes: 60,
      tasks: [
        { name: 'Cook rice', estimatedMinutes: 25, category: 'cook' },
        { name: 'Cook quinoa', estimatedMinutes: 20, category: 'cook' },
        { name: 'Portion and cool', estimatedMinutes: 15, category: 'storage' }
      ]
    }
  ];

  res.json({ templates });
});

export default router;
