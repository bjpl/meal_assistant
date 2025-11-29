import { configureStore } from '@reduxjs/toolkit';
import eventsReducer, {
  createEvent,
  updateEvent,
  deleteEvent,
  updateBankingStrategy,
  updateRecoveryPlan,
  setDailyBudget,
  markEventCompleted,
  setLoading,
  setError,
  clearEvents,
  fetchEvents,
  createEventAsync,
  updateEventAsync,
  deleteEventAsync,
  fetchEventStrategy,
  fetchRecoveryPlan,
  selectEvents,
  selectUpcomingEvents,
  selectEventById,
  selectStrategyForEvent,
  selectRecoveryPlanForEvent,
} from '../../../src/mobile/store/slices/eventsSlice';
import type {
  SocialEvent,
  CalorieBankingStrategy,
  RecoveryPlan,
  EventMealType,
  CalorieEstimate,
} from '../../../src/mobile/types/analytics.types';
import { eventsApi } from '../../../src/mobile/services/apiService';

// Mock the API service
jest.mock('../../../src/mobile/services/apiService', () => ({
  eventsApi: {
    getEvents: jest.fn(),
    createEvent: jest.fn(),
    updateEvent: jest.fn(),
    deleteEvent: jest.fn(),
    getStrategy: jest.fn(),
    getRecoveryPlan: jest.fn(),
  },
}));

describe('eventsSlice', () => {
  let store: ReturnType<typeof configureStore>;

  // Helper to create mock event
  const createMockEvent = (
    overrides: Partial<SocialEvent> = {}
  ): Omit<SocialEvent, 'id'> => ({
    name: 'Test Event',
    date: '2025-12-01',
    time: '19:00',
    mealType: 'dinner' as EventMealType,
    estimatedCalories: 1200,
    calorieEstimateType: 'heavy' as CalorieEstimate,
    nutritionAvailable: false,
    ...overrides,
  });

  // Helper to create full event with ID
  const createFullMockEvent = (overrides: Partial<SocialEvent> = {}): SocialEvent => ({
    id: 'event-123',
    ...createMockEvent(overrides),
  });

  beforeEach(() => {
    store = configureStore({
      reducer: {
        events: eventsReducer,
      },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =============================================================================
  // INITIAL STATE TESTS
  // =============================================================================

  describe('Initial State', () => {
    it('should return initial state', () => {
      const state = store.getState().events;
      expect(state.events).toEqual([]);
      expect(state.strategies).toEqual({});
      expect(state.recoveryPlans).toEqual({});
      expect(state.dailyBudget).toBe(1800);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });

    it('should have empty events array initially', () => {
      const state = store.getState().events;
      expect(Array.isArray(state.events)).toBe(true);
      expect(state.events.length).toBe(0);
    });

    it('should have default daily budget of 1800', () => {
      const state = store.getState().events;
      expect(state.dailyBudget).toBe(1800);
    });
  });

  // =============================================================================
  // CREATE EVENT TESTS
  // =============================================================================

  describe('createEvent reducer', () => {
    it('should add event to state', () => {
      const eventData = createMockEvent();
      store.dispatch(createEvent(eventData));

      const state = store.getState().events;
      expect(state.events).toHaveLength(1);
      expect(state.events[0].name).toBe('Test Event');
      expect(state.events[0].id).toContain('event-');
    });

    it('should generate banking strategy for new event', () => {
      const eventData = createMockEvent();
      store.dispatch(createEvent(eventData));

      const state = store.getState().events;
      const eventId = state.events[0].id;
      expect(state.strategies[eventId]).toBeDefined();
      expect(state.strategies[eventId].eventCalories).toBe(1200);
    });

    it('should generate recovery plan for new event', () => {
      const eventData = createMockEvent();
      store.dispatch(createEvent(eventData));

      const state = store.getState().events;
      const eventId = state.events[0].id;
      expect(state.recoveryPlans[eventId]).toBeDefined();
      expect(state.recoveryPlans[eventId].eventId).toBe(eventId);
    });

    it('should create IDs containing event- prefix', () => {
      const event1 = createMockEvent({ name: 'Event 1' });
      const event2 = createMockEvent({ name: 'Event 2' });

      store.dispatch(createEvent(event1));
      store.dispatch(createEvent(event2));

      const state = store.getState().events;
      expect(state.events).toHaveLength(2);
      expect(state.events[0].id).toContain('event-');
      expect(state.events[1].id).toContain('event-');
      // IDs should be strings with numeric timestamps
      expect(state.events[0].id).toMatch(/^event-\d+$/);
      expect(state.events[1].id).toMatch(/^event-\d+$/);
    });

    it('should handle breakfast event type', () => {
      const eventData = createMockEvent({
        mealType: 'breakfast',
        estimatedCalories: 600,
      });
      store.dispatch(createEvent(eventData));

      const state = store.getState().events;
      expect(state.events[0].mealType).toBe('breakfast');
      expect(state.strategies[state.events[0].id].eventCalories).toBe(600);
    });

    it('should handle light calorie estimate', () => {
      const eventData = createMockEvent({
        estimatedCalories: 600,
        calorieEstimateType: 'light',
      });
      store.dispatch(createEvent(eventData));

      const state = store.getState().events;
      expect(state.events[0].calorieEstimateType).toBe('light');
    });
  });

  // =============================================================================
  // UPDATE EVENT TESTS
  // =============================================================================

  describe('updateEvent reducer', () => {
    it('should update existing event', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      const updatedEvent: SocialEvent = {
        ...state1.events[0],
        name: 'Updated Event',
        estimatedCalories: 1500,
      };

      store.dispatch(updateEvent(updatedEvent));

      const state2 = store.getState().events;
      expect(state2.events[0].name).toBe('Updated Event');
      expect(state2.events[0].estimatedCalories).toBe(1500);
    });

    it('should recalculate strategy when event updated', () => {
      store.dispatch(createEvent(createMockEvent({ estimatedCalories: 800 })));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      const updatedEvent: SocialEvent = {
        ...state1.events[0],
        estimatedCalories: 1500,
      };

      store.dispatch(updateEvent(updatedEvent));

      const state2 = store.getState().events;
      expect(state2.strategies[eventId].eventCalories).toBe(1500);
    });

    it('should recalculate recovery plan when event updated', () => {
      store.dispatch(createEvent(createMockEvent({ estimatedCalories: 800 })));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;
      const originalPlan = state1.recoveryPlans[eventId];

      const updatedEvent: SocialEvent = {
        ...state1.events[0],
        estimatedCalories: 1200, // Now heavy meal (>1000)
      };

      store.dispatch(updateEvent(updatedEvent));

      const state2 = store.getState().events;
      expect(state2.recoveryPlans[eventId].nextDayPattern).toBe('C'); // Heavy meal pattern
    });

    it('should not modify state if event not found', () => {
      store.dispatch(createEvent(createMockEvent()));
      const stateBefore = store.getState().events;

      const nonExistentEvent = createFullMockEvent({ id: 'nonexistent' });
      store.dispatch(updateEvent(nonExistentEvent));

      const stateAfter = store.getState().events;
      expect(stateAfter.events).toEqual(stateBefore.events);
    });

    it('should update event date', () => {
      store.dispatch(createEvent(createMockEvent({ date: '2025-12-01' })));
      const state1 = store.getState().events;

      const updatedEvent: SocialEvent = {
        ...state1.events[0],
        date: '2025-12-15',
      };

      store.dispatch(updateEvent(updatedEvent));

      const state2 = store.getState().events;
      expect(state2.events[0].date).toBe('2025-12-15');
    });
  });

  // =============================================================================
  // DELETE EVENT TESTS
  // =============================================================================

  describe('deleteEvent reducer', () => {
    it('should remove event from state', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      store.dispatch(deleteEvent(eventId));

      const state2 = store.getState().events;
      expect(state2.events).toHaveLength(0);
    });

    it('should remove associated strategy', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      expect(state1.strategies[eventId]).toBeDefined();

      store.dispatch(deleteEvent(eventId));

      const state2 = store.getState().events;
      expect(state2.strategies[eventId]).toBeUndefined();
    });

    it('should remove associated recovery plan', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      expect(state1.recoveryPlans[eventId]).toBeDefined();

      store.dispatch(deleteEvent(eventId));

      const state2 = store.getState().events;
      expect(state2.recoveryPlans[eventId]).toBeUndefined();
    });

    it('should delete specified event by ID', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      expect(state1.events).toHaveLength(1);
      expect(state1.strategies[eventId]).toBeDefined();
      expect(state1.recoveryPlans[eventId]).toBeDefined();

      // Delete the event
      store.dispatch(deleteEvent(eventId));

      const state2 = store.getState().events;
      expect(state2.events).toHaveLength(0);
      expect(state2.strategies[eventId]).toBeUndefined();
      expect(state2.recoveryPlans[eventId]).toBeUndefined();
    });

    it('should handle deleting nonexistent event gracefully', () => {
      store.dispatch(createEvent(createMockEvent()));
      const stateBefore = store.getState().events;

      store.dispatch(deleteEvent('nonexistent-id'));

      const stateAfter = store.getState().events;
      expect(stateAfter.events).toHaveLength(1);
    });
  });

  // =============================================================================
  // BANKING STRATEGY TESTS
  // =============================================================================

  describe('updateBankingStrategy reducer', () => {
    it('should update banking strategy for event', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      const updates: Partial<CalorieBankingStrategy> = {
        allocatedToEvent: 1300,
        isAchievable: false,
      };

      store.dispatch(updateBankingStrategy({ eventId, updates }));

      const state2 = store.getState().events;
      expect(state2.strategies[eventId].allocatedToEvent).toBe(1300);
      expect(state2.strategies[eventId].isAchievable).toBe(false);
    });

    it('should not create strategy if event does not exist', () => {
      const updates: Partial<CalorieBankingStrategy> = {
        allocatedToEvent: 1300,
      };

      store.dispatch(updateBankingStrategy({ eventId: 'nonexistent', updates }));

      const state = store.getState().events;
      expect(state.strategies['nonexistent']).toBeUndefined();
    });

    it('should partially update strategy without losing other fields', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;
      const originalCalories = state1.strategies[eventId].eventCalories;

      const updates: Partial<CalorieBankingStrategy> = {
        allocatedToEvent: 1100,
      };

      store.dispatch(updateBankingStrategy({ eventId, updates }));

      const state2 = store.getState().events;
      expect(state2.strategies[eventId].allocatedToEvent).toBe(1100);
      expect(state2.strategies[eventId].eventCalories).toBe(originalCalories);
    });

    it('should update warnings in banking strategy', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      const updates: Partial<CalorieBankingStrategy> = {
        warnings: ['Custom warning'],
      };

      store.dispatch(updateBankingStrategy({ eventId, updates }));

      const state2 = store.getState().events;
      expect(state2.strategies[eventId].warnings).toEqual(['Custom warning']);
    });
  });

  // =============================================================================
  // RECOVERY PLAN TESTS
  // =============================================================================

  describe('updateRecoveryPlan reducer', () => {
    it('should update recovery plan for event', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      const updates: Partial<RecoveryPlan> = {
        nextDayPattern: 'B',
        hydrationGoal: 90,
      };

      store.dispatch(updateRecoveryPlan({ eventId, updates }));

      const state2 = store.getState().events;
      expect(state2.recoveryPlans[eventId].nextDayPattern).toBe('B');
      expect(state2.recoveryPlans[eventId].hydrationGoal).toBe(90);
    });

    it('should not create plan if event does not exist', () => {
      const updates: Partial<RecoveryPlan> = {
        nextDayPattern: 'B',
      };

      store.dispatch(updateRecoveryPlan({ eventId: 'nonexistent', updates }));

      const state = store.getState().events;
      expect(state.recoveryPlans['nonexistent']).toBeUndefined();
    });

    it('should update damage control tips', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      const updates: Partial<RecoveryPlan> = {
        damageControlTips: ['Tip 1', 'Tip 2', 'Tip 3'],
      };

      store.dispatch(updateRecoveryPlan({ eventId, updates }));

      const state2 = store.getState().events;
      expect(state2.recoveryPlans[eventId].damageControlTips).toHaveLength(3);
      expect(state2.recoveryPlans[eventId].damageControlTips[0]).toBe('Tip 1');
    });

    it('should update activity suggestion', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      const updates: Partial<RecoveryPlan> = {
        activitySuggestion: '45-minute jog',
      };

      store.dispatch(updateRecoveryPlan({ eventId, updates }));

      const state2 = store.getState().events;
      expect(state2.recoveryPlans[eventId].activitySuggestion).toBe('45-minute jog');
    });
  });

  // =============================================================================
  // DAILY BUDGET TESTS
  // =============================================================================

  describe('setDailyBudget reducer', () => {
    it('should update daily budget', () => {
      store.dispatch(setDailyBudget(2000));

      const state = store.getState().events;
      expect(state.dailyBudget).toBe(2000);
    });

    it('should recalculate all strategies when budget changes', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      const strategy1 = state1.strategies[eventId];
      expect(strategy1.dailyBudget).toBe(1800);

      store.dispatch(setDailyBudget(2000));

      const state2 = store.getState().events;
      const strategy2 = state2.strategies[eventId];
      expect(strategy2.dailyBudget).toBe(2000);
    });

    it('should recalculate strategies for multiple events', () => {
      store.dispatch(createEvent(createMockEvent({ name: 'Event 1' })));
      store.dispatch(createEvent(createMockEvent({ name: 'Event 2' })));

      const state1 = store.getState().events;
      const event1Id = state1.events[0].id;
      const event2Id = state1.events[1].id;

      store.dispatch(setDailyBudget(2200));

      const state2 = store.getState().events;
      expect(state2.strategies[event1Id].dailyBudget).toBe(2200);
      expect(state2.strategies[event2Id].dailyBudget).toBe(2200);
    });

    it('should handle budget reduction', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      store.dispatch(setDailyBudget(1500));

      const state2 = store.getState().events;
      expect(state2.strategies[eventId].dailyBudget).toBe(1500);
    });
  });

  // =============================================================================
  // UTILITY REDUCER TESTS
  // =============================================================================

  describe('Utility reducers', () => {
    it('should mark event as completed', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      store.dispatch(createEvent(createMockEvent({ name: 'Complete Me' })));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      store.dispatch(markEventCompleted(eventId));

      expect(consoleSpy).toHaveBeenCalledWith('Event completed:', 'Complete Me');
      consoleSpy.mockRestore();
    });

    it('should set loading state', () => {
      store.dispatch(setLoading(true));
      expect(store.getState().events.loading).toBe(true);

      store.dispatch(setLoading(false));
      expect(store.getState().events.loading).toBe(false);
    });

    it('should set error state', () => {
      store.dispatch(setError('Test error'));
      expect(store.getState().events.error).toBe('Test error');

      store.dispatch(setError(null));
      expect(store.getState().events.error).toBe(null);
    });

    it('should clear all events', () => {
      store.dispatch(createEvent(createMockEvent({ name: 'Event 1' })));
      store.dispatch(createEvent(createMockEvent({ name: 'Event 2' })));

      const state1 = store.getState().events;
      expect(state1.events).toHaveLength(2);

      store.dispatch(clearEvents());

      const state2 = store.getState().events;
      expect(state2.events).toHaveLength(0);
      expect(state2.strategies).toEqual({});
      expect(state2.recoveryPlans).toEqual({});
    });

    it('should clear strategies and plans when clearing events', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      expect(Object.keys(state1.strategies).length).toBeGreaterThan(0);
      expect(Object.keys(state1.recoveryPlans).length).toBeGreaterThan(0);

      store.dispatch(clearEvents());

      const state2 = store.getState().events;
      expect(Object.keys(state2.strategies).length).toBe(0);
      expect(Object.keys(state2.recoveryPlans).length).toBe(0);
    });
  });

  // =============================================================================
  // ASYNC THUNK TESTS - fetchEvents
  // =============================================================================

  describe('fetchEvents thunk', () => {
    it('should handle successful fetch', async () => {
      const mockEvents: SocialEvent[] = [
        createFullMockEvent({ name: 'Event 1' }),
        createFullMockEvent({ name: 'Event 2', id: 'event-456' }),
      ];

      (eventsApi.getEvents as jest.Mock).mockResolvedValue({
        data: mockEvents,
        error: null,
      });

      await store.dispatch(fetchEvents());

      const state = store.getState().events;
      expect(state.events).toHaveLength(2);
      expect(state.events[0].name).toBe('Event 1');
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });

    it('should set loading to true when pending', async () => {
      let resolvePromise: () => void;
      const promise = new Promise<{ data: any; error: null }>((resolve) => {
        resolvePromise = () => resolve({ data: [], error: null });
      });

      (eventsApi.getEvents as jest.Mock).mockReturnValue(promise);

      const dispatchPromise = store.dispatch(fetchEvents());

      // Check loading state before resolving
      expect(store.getState().events.loading).toBe(true);

      resolvePromise!();
      await dispatchPromise;
    });

    it('should handle fetch error', async () => {
      (eventsApi.getEvents as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Network error',
        message: 'Failed to fetch events',
      });

      await store.dispatch(fetchEvents());

      const state = store.getState().events;
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to fetch events');
    });

    it('should use error field if message not provided', async () => {
      (eventsApi.getEvents as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Network error',
      });

      await store.dispatch(fetchEvents());

      const state = store.getState().events;
      expect(state.error).toBe('Network error');
    });
  });

  // =============================================================================
  // ASYNC THUNK TESTS - createEventAsync
  // =============================================================================

  describe('createEventAsync thunk', () => {
    it('should handle successful event creation', async () => {
      const newEvent = createFullMockEvent();
      (eventsApi.createEvent as jest.Mock).mockResolvedValue({
        data: newEvent,
        error: null,
      });

      await store.dispatch(createEventAsync(createMockEvent()));

      const state = store.getState().events;
      expect(state.events).toHaveLength(1);
      expect(state.events[0].id).toBe('event-123');
      expect(state.strategies['event-123']).toBeDefined();
      expect(state.recoveryPlans['event-123']).toBeDefined();
      expect(state.loading).toBe(false);
    });

    it('should set loading during creation', async () => {
      let resolvePromise: () => void;
      const promise = new Promise<{ data: SocialEvent; error: null }>((resolve) => {
        resolvePromise = () => resolve({ data: createFullMockEvent(), error: null });
      });

      (eventsApi.createEvent as jest.Mock).mockReturnValue(promise);

      const dispatchPromise = store.dispatch(createEventAsync(createMockEvent()));

      // Check loading state before resolving
      expect(store.getState().events.loading).toBe(true);

      resolvePromise!();
      await dispatchPromise;
    });

    it('should handle creation error', async () => {
      (eventsApi.createEvent as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Creation failed',
        message: 'Unable to create event',
      });

      await store.dispatch(createEventAsync(createMockEvent()));

      const state = store.getState().events;
      expect(state.events).toHaveLength(0);
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Unable to create event');
    });

    it('should generate strategy and plan for new async event', async () => {
      const newEvent = createFullMockEvent();
      (eventsApi.createEvent as jest.Mock).mockResolvedValue({
        data: newEvent,
        error: null,
      });

      await store.dispatch(createEventAsync(createMockEvent()));

      const state = store.getState().events;
      expect(state.strategies['event-123']).toBeDefined();
      expect(state.strategies['event-123'].eventCalories).toBe(1200);
      expect(state.recoveryPlans['event-123']).toBeDefined();
      expect(state.recoveryPlans['event-123'].eventId).toBe('event-123');
    });
  });

  // =============================================================================
  // ASYNC THUNK TESTS - updateEventAsync
  // =============================================================================

  describe('updateEventAsync thunk', () => {
    it('should handle successful event update', async () => {
      // Create initial event
      store.dispatch(createEvent(createMockEvent({ name: 'Original' })));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      (eventsApi.updateEvent as jest.Mock).mockResolvedValue({
        data: { name: 'Updated' },
        error: null,
      });

      await store.dispatch(
        updateEventAsync({ eventId, updates: { name: 'Updated' } })
      );

      const state2 = store.getState().events;
      expect(state2.events[0].name).toBe('Updated');
    });

    it('should recalculate strategy and plan on async update', async () => {
      store.dispatch(createEvent(createMockEvent({ estimatedCalories: 800 })));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      (eventsApi.updateEvent as jest.Mock).mockResolvedValue({
        data: { estimatedCalories: 1300 },
        error: null,
      });

      await store.dispatch(
        updateEventAsync({ eventId, updates: { estimatedCalories: 1300 } })
      );

      const state2 = store.getState().events;
      expect(state2.strategies[eventId].eventCalories).toBe(1300);
    });

    it('should handle update error', async () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      (eventsApi.updateEvent as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Update failed',
        message: 'Unable to update event',
      });

      await store.dispatch(
        updateEventAsync({ eventId, updates: { name: 'Failed' } })
      );

      const state2 = store.getState().events;
      expect(state2.events[0].name).toBe('Test Event'); // Unchanged
    });
  });

  // =============================================================================
  // ASYNC THUNK TESTS - deleteEventAsync
  // =============================================================================

  describe('deleteEventAsync thunk', () => {
    it('should handle successful event deletion', async () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      (eventsApi.deleteEvent as jest.Mock).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await store.dispatch(deleteEventAsync(eventId));

      const state2 = store.getState().events;
      expect(state2.events).toHaveLength(0);
      expect(state2.strategies[eventId]).toBeUndefined();
      expect(state2.recoveryPlans[eventId]).toBeUndefined();
    });

    it('should handle deletion error', async () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;
      const eventId = state1.events[0].id;

      (eventsApi.deleteEvent as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Deletion failed',
        message: 'Unable to delete event',
      });

      await store.dispatch(deleteEventAsync(eventId));

      const state2 = store.getState().events;
      expect(state2.events).toHaveLength(1); // Still there
    });
  });

  // =============================================================================
  // ASYNC THUNK TESTS - fetchEventStrategy
  // =============================================================================

  describe('fetchEventStrategy thunk', () => {
    it('should fetch and store strategy', async () => {
      const mockStrategy: CalorieBankingStrategy = {
        eventId: 'event-123',
        eventCalories: 1200,
        dailyBudget: 1800,
        allocatedToEvent: 1100,
        otherMeals: [],
        totalReduction: 250,
        remainingForEvent: 1100,
        isAchievable: true,
        warnings: [],
      };

      (eventsApi.getStrategy as jest.Mock).mockResolvedValue({
        data: mockStrategy,
        error: null,
      });

      await store.dispatch(fetchEventStrategy('event-123'));

      const state = store.getState().events;
      expect(state.strategies['event-123']).toEqual(mockStrategy);
    });

    it('should handle strategy fetch error', async () => {
      (eventsApi.getStrategy as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Fetch failed',
      });

      await store.dispatch(fetchEventStrategy('event-123'));

      const state = store.getState().events;
      expect(state.strategies['event-123']).toBeUndefined();
    });
  });

  // =============================================================================
  // ASYNC THUNK TESTS - fetchRecoveryPlan
  // =============================================================================

  describe('fetchRecoveryPlan thunk', () => {
    it('should fetch and store recovery plan', async () => {
      const mockPlan: RecoveryPlan = {
        eventId: 'event-123',
        nextDayPattern: 'C',
        patternName: 'Intermittent Fasting',
        suggestedMeals: [],
        noWeighFor: 48,
        damageControlTips: ['Tip 1'],
        hydrationGoal: 100,
      };

      (eventsApi.getRecoveryPlan as jest.Mock).mockResolvedValue({
        data: mockPlan,
        error: null,
      });

      await store.dispatch(fetchRecoveryPlan('event-123'));

      const state = store.getState().events;
      expect(state.recoveryPlans['event-123']).toEqual(mockPlan);
    });

    it('should handle recovery plan fetch error', async () => {
      (eventsApi.getRecoveryPlan as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Fetch failed',
      });

      await store.dispatch(fetchRecoveryPlan('event-123'));

      const state = store.getState().events;
      expect(state.recoveryPlans['event-123']).toBeUndefined();
    });
  });

  // =============================================================================
  // SELECTOR TESTS
  // =============================================================================

  describe('Selectors', () => {
    let pastEventId: string;
    let futureEventId: string;

    beforeEach(() => {
      // Add some events
      store.dispatch(createEvent(createMockEvent({
        name: 'Past Event',
        date: '2020-01-01'
      })));

      store.dispatch(createEvent(createMockEvent({
        name: 'Future Event',
        date: '2030-12-31'
      })));

      const state = store.getState().events;
      // Find events by name to ensure correct assignment
      const pastEvent = state.events.find(e => e.name === 'Past Event');
      const futureEvent = state.events.find(e => e.name === 'Future Event');

      pastEventId = pastEvent!.id;
      futureEventId = futureEvent!.id;
    });

    it('selectEvents should return all events', () => {
      const events = selectEvents(store.getState());
      expect(events).toHaveLength(2);
    });

    it('selectUpcomingEvents should return only future events', () => {
      const upcomingEvents = selectUpcomingEvents(store.getState());
      expect(upcomingEvents).toHaveLength(1);
      expect(upcomingEvents[0].name).toBe('Future Event');
    });

    it('selectEventById should return specific event', () => {
      const state = store.getState();
      const event = selectEventById(futureEventId)(state);
      expect(event).toBeDefined();
      // Verify we can find the event
      const allEvents = selectEvents(state);
      const foundEvent = allEvents.find(e => e.id === futureEventId);
      expect(foundEvent).toBeDefined();
      expect(event).toEqual(foundEvent);
    });

    it('selectEventById should return undefined for nonexistent event', () => {
      const event = selectEventById('nonexistent')(store.getState());
      expect(event).toBeUndefined();
    });

    it('selectStrategyForEvent should return strategy', () => {
      const strategy = selectStrategyForEvent(pastEventId)(store.getState());
      expect(strategy).toBeDefined();
      expect(strategy?.eventId).toBe(pastEventId);
    });

    it('selectRecoveryPlanForEvent should return recovery plan', () => {
      const plan = selectRecoveryPlanForEvent(futureEventId)(store.getState());
      expect(plan).toBeDefined();
      expect(plan?.eventId).toBe(futureEventId);
    });
  });

  // =============================================================================
  // BANKING STRATEGY CALCULATION TESTS
  // =============================================================================

  describe('Banking strategy calculation', () => {
    it('should calculate strategy with correct calorie values', () => {
      store.dispatch(createEvent(createMockEvent({ estimatedCalories: 900 })));
      const state = store.getState().events;
      const eventId = state.events[0].id;
      const strategy = state.strategies[eventId];

      expect(strategy).toBeDefined();
      expect(strategy.eventCalories).toBe(900);
      expect(strategy.dailyBudget).toBe(1800);
    });

    it('should flag high calorie events with warnings', () => {
      store.dispatch(createEvent(createMockEvent({ estimatedCalories: 1500 })));
      const state = store.getState().events;
      const eventId = state.events[0].id;
      const strategy = state.strategies[eventId];

      expect(strategy.warnings.length).toBeGreaterThan(0);
      expect(strategy.warnings.some(w => w.includes('High calorie'))).toBe(true);
    });

    it('should calculate meal reductions correctly', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state = store.getState().events;
      const eventId = state.events[0].id;
      const strategy = state.strategies[eventId];

      expect(strategy.otherMeals).toHaveLength(2);
      expect(strategy.otherMeals[0].mealType).toBe('morning');
      expect(strategy.otherMeals[1].mealType).toBe('noon');
    });

    it('should calculate 20% reduction for other meals', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state = store.getState().events;
      const eventId = state.events[0].id;
      const strategy = state.strategies[eventId];

      const morningMeal = strategy.otherMeals.find(m => m.mealType === 'morning');
      expect(morningMeal?.reductionPercent).toBe(20);
      expect(morningMeal?.reducedCalories).toBe(Math.round(400 * 0.8));
    });
  });

  // =============================================================================
  // RECOVERY PLAN GENERATION TESTS
  // =============================================================================

  describe('Recovery plan generation', () => {
    it('should generate IF pattern for heavy meals (>1000 cal)', () => {
      store.dispatch(createEvent(createMockEvent({ estimatedCalories: 1500 })));
      const state = store.getState().events;
      const eventId = state.events[0].id;
      const plan = state.recoveryPlans[eventId];

      expect(plan.nextDayPattern).toBe('C');
      expect(plan.patternName).toBe('Intermittent Fasting');
    });

    it('should generate Traditional pattern for moderate meals (<1000 cal)', () => {
      store.dispatch(createEvent(createMockEvent({ estimatedCalories: 800 })));
      const state = store.getState().events;
      const eventId = state.events[0].id;
      const plan = state.recoveryPlans[eventId];

      expect(plan.nextDayPattern).toBe('A');
      expect(plan.patternName).toBe('Traditional');
    });

    it('should suggest skipping breakfast for heavy meals', () => {
      store.dispatch(createEvent(createMockEvent({ estimatedCalories: 1200 })));
      const state = store.getState().events;
      const eventId = state.events[0].id;
      const plan = state.recoveryPlans[eventId];

      const breakfastMeal = plan.suggestedMeals.find(m => m.mealType === 'morning');
      expect(breakfastMeal?.calories).toBe(0);
      expect(breakfastMeal?.description).toContain('Skip breakfast');
    });

    it('should include damage control tips', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state = store.getState().events;
      const eventId = state.events[0].id;
      const plan = state.recoveryPlans[eventId];

      expect(plan.damageControlTips).toBeDefined();
      expect(plan.damageControlTips.length).toBeGreaterThan(0);
    });

    it('should set higher hydration goal for heavy meals', () => {
      store.dispatch(createEvent(createMockEvent({ estimatedCalories: 1500 })));
      const state = store.getState().events;

      // Heavy meals (>1000 cal) should get 100oz hydration goal
      const eventId = state.events[0].id;
      expect(state.recoveryPlans[eventId].hydrationGoal).toBe(100);
    });

    it('should set standard hydration goal for light meals', () => {
      store.dispatch(createEvent(createMockEvent({ estimatedCalories: 800 })));
      const state = store.getState().events;

      // Light meals (<1000 cal) should get 80oz hydration goal
      const eventId = state.events[0].id;
      expect(state.recoveryPlans[eventId].hydrationGoal).toBe(80);
    });

    it('should include activity suggestion', () => {
      store.dispatch(createEvent(createMockEvent()));
      const state = store.getState().events;
      const eventId = state.events[0].id;
      const plan = state.recoveryPlans[eventId];

      expect(plan.activitySuggestion).toBeDefined();
      expect(plan.activitySuggestion).toContain('walk');
    });
  });

  // =============================================================================
  // ERROR HANDLING TESTS
  // =============================================================================

  describe('Error handling', () => {
    it('should clear error on successful operation', async () => {
      store.dispatch(setError('Previous error'));
      expect(store.getState().events.error).toBe('Previous error');

      (eventsApi.getEvents as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      await store.dispatch(fetchEvents());

      expect(store.getState().events.error).toBe(null);
    });

    it('should preserve events on fetch error', async () => {
      store.dispatch(createEvent(createMockEvent()));
      const state1 = store.getState().events;

      (eventsApi.getEvents as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Network error',
      });

      await store.dispatch(fetchEvents());

      const state2 = store.getState().events;
      expect(state2.events).toEqual(state1.events);
    });

    it('should handle null/undefined payload gracefully in fetchEvents', async () => {
      (eventsApi.getEvents as jest.Mock).mockResolvedValue({
        data: null,
        error: null,
      });

      await store.dispatch(fetchEvents());

      const state = store.getState().events;
      expect(state.events).toEqual([]); // Should not crash
    });
  });
});
