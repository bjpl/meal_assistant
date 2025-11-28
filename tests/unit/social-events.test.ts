/**
 * Unit Tests: Social Event Planning
 * Tests for calorie banking, recovery plans, event logging, restaurant research
 * Target: 25 tests | Coverage: 90%+
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================================
// Types
// ============================================================================

interface SocialEvent {
  id: string;
  name: string;
  date: Date;
  type: 'restaurant' | 'party' | 'barbecue' | 'holiday' | 'date_night' | 'work_event' | 'other';
  estimatedCalories: number;
  estimatedProtein?: number;
  venue?: string;
  cuisineType?: string;
  notes?: string;
  completed: boolean;
  actualCalories?: number;
  actualProtein?: number;
}

interface CalorieBankingPlan {
  eventId: string;
  eventDate: Date;
  targetBankedCalories: number;
  daysToBank: number;
  dailyReduction: number;
  startDate: Date;
  dailyTargets: Array<{
    date: Date;
    targetCalories: number;
    bankedCalories: number;
  }>;
  recommendations: string[];
}

interface RecoveryPlan {
  eventId: string;
  eventName: string;
  excessCalories: number;
  recoveryDays: number;
  dailyDeficit: number;
  recoveryTargets: Array<{
    date: Date;
    targetCalories: number;
    targetProtein: number;
    patternSuggestion: string;
  }>;
  strategies: string[];
  expectedRecoveryDate: Date;
}

interface RestaurantResearch {
  venue: string;
  cuisineType: string;
  healthyOptions: Array<{
    name: string;
    estimatedCalories: number;
    estimatedProtein: number;
    notes: string;
  }>;
  itemsToAvoid: string[];
  tips: string[];
  avgMealCalories: number;
}

interface EventLog {
  eventId: string;
  plannedCalories: number;
  actualCalories: number;
  variance: number;
  percentVariance: number;
  wasSuccessful: boolean;
  lessons: string[];
  timestamp: Date;
}

// ============================================================================
// Social Event Planning Service
// ============================================================================

const createSocialEventService = () => {
  const events: SocialEvent[] = [];
  const bankingPlans: Map<string, CalorieBankingPlan> = new Map();
  const recoveryPlans: Map<string, RecoveryPlan> = new Map();
  const eventLogs: EventLog[] = [];
  const userDailyCalories = 2000;
  const userDailyProtein = 130;

  // Restaurant database (mock)
  const restaurantData: Map<string, RestaurantResearch> = new Map();

  return {
    // Add event
    addEvent(event: Omit<SocialEvent, 'id' | 'completed'>): SocialEvent {
      const newEvent: SocialEvent = {
        ...event,
        id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        completed: false
      };
      events.push(newEvent);
      return newEvent;
    },

    // Get upcoming events
    getUpcomingEvents(days: number = 30): SocialEvent[] {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + days);

      return events
        .filter(e => !e.completed && e.date >= new Date() && e.date <= cutoff)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    },

    // Calculate calorie banking plan
    createBankingPlan(eventId: string, bankingDays: number = 3): CalorieBankingPlan | null {
      const event = events.find(e => e.id === eventId);
      if (!event) return null;

      const excessCalories = Math.max(0, event.estimatedCalories - userDailyCalories);
      const targetBankedCalories = Math.round(excessCalories * 0.7); // Bank 70% of excess

      if (targetBankedCalories < 100) {
        // Not worth banking for small amounts
        return null;
      }

      const dailyReduction = Math.round(targetBankedCalories / bankingDays);

      // Cap daily reduction to avoid extreme deficit
      const maxDailyReduction = Math.round(userDailyCalories * 0.25); // Max 25% reduction
      const actualDailyReduction = Math.min(dailyReduction, maxDailyReduction);
      const actualBankedCalories = actualDailyReduction * bankingDays;

      const startDate = new Date(event.date);
      startDate.setDate(startDate.getDate() - bankingDays);

      const dailyTargets = [];
      for (let i = 0; i < bankingDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dailyTargets.push({
          date,
          targetCalories: userDailyCalories - actualDailyReduction,
          bankedCalories: actualDailyReduction
        });
      }

      const recommendations: string[] = [];
      if (actualDailyReduction >= 300) {
        recommendations.push('Consider skipping snacks during banking days');
      }
      if (bankingDays >= 5) {
        recommendations.push('Increase water intake to manage hunger');
      }
      recommendations.push('Focus on high-protein, low-calorie meals');
      recommendations.push('Avoid alcohol during banking period');

      const plan: CalorieBankingPlan = {
        eventId,
        eventDate: event.date,
        targetBankedCalories: actualBankedCalories,
        daysToBank: bankingDays,
        dailyReduction: actualDailyReduction,
        startDate,
        dailyTargets,
        recommendations
      };

      bankingPlans.set(eventId, plan);
      return plan;
    },

    // Get banking plan
    getBankingPlan(eventId: string): CalorieBankingPlan | undefined {
      return bankingPlans.get(eventId);
    },

    // Create recovery plan after event
    createRecoveryPlan(eventId: string, actualCalories: number): RecoveryPlan {
      const event = events.find(e => e.id === eventId);
      const excessCalories = actualCalories - userDailyCalories;

      // Calculate recovery days (aim for 300-500 cal deficit per day)
      const targetDailyDeficit = 400;
      const recoveryDays = Math.max(1, Math.ceil(excessCalories / targetDailyDeficit));
      const dailyDeficit = Math.round(excessCalories / recoveryDays);

      const recoveryTargets = [];
      const strategies: string[] = [];

      for (let i = 0; i < recoveryDays; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i + 1);

        let patternSuggestion = 'traditional';
        if (dailyDeficit > 400) {
          patternSuggestion = 'if-16-8';
        } else if (dailyDeficit > 300) {
          patternSuggestion = 'light';
        }

        recoveryTargets.push({
          date,
          targetCalories: userDailyCalories - dailyDeficit,
          targetProtein: userDailyProtein, // Maintain protein
          patternSuggestion
        });
      }

      // Generate strategies
      if (excessCalories > 1500) {
        strategies.push('Consider adding extra cardio sessions');
        strategies.push('Focus on very lean proteins and vegetables');
      }
      if (excessCalories > 1000) {
        strategies.push('Try intermittent fasting pattern for faster recovery');
        strategies.push('Avoid liquid calories completely');
      }
      strategies.push('Increase water intake');
      strategies.push('Get adequate sleep to regulate hunger hormones');

      const expectedRecoveryDate = new Date();
      expectedRecoveryDate.setDate(expectedRecoveryDate.getDate() + recoveryDays);

      const plan: RecoveryPlan = {
        eventId,
        eventName: event?.name || 'Unknown Event',
        excessCalories,
        recoveryDays,
        dailyDeficit,
        recoveryTargets,
        strategies,
        expectedRecoveryDate
      };

      recoveryPlans.set(eventId, plan);
      return plan;
    },

    // Get recovery plan
    getRecoveryPlan(eventId: string): RecoveryPlan | undefined {
      return recoveryPlans.get(eventId);
    },

    // Log event completion
    logEventCompletion(eventId: string, actualCalories: number, actualProtein?: number): EventLog {
      const event = events.find(e => e.id === eventId);
      if (event) {
        event.completed = true;
        event.actualCalories = actualCalories;
        event.actualProtein = actualProtein;
      }

      const plannedCalories = event?.estimatedCalories || 0;
      const variance = actualCalories - plannedCalories;
      const percentVariance = plannedCalories > 0
        ? Math.round((variance / plannedCalories) * 100)
        : 0;

      const wasSuccessful = Math.abs(percentVariance) <= 20;

      const lessons: string[] = [];
      if (variance > 500) {
        lessons.push('Event had more calories than expected - adjust estimates for similar events');
      }
      if (variance < -300) {
        lessons.push('Good restraint! Maintained control at social event');
      }
      if (!wasSuccessful && variance > 0) {
        lessons.push('Consider banking more calories before similar events');
      }

      const log: EventLog = {
        eventId,
        plannedCalories,
        actualCalories,
        variance,
        percentVariance,
        wasSuccessful,
        lessons,
        timestamp: new Date()
      };

      eventLogs.push(log);
      return log;
    },

    // Get event log history
    getEventLogs(): EventLog[] {
      return [...eventLogs];
    },

    // Add restaurant research
    addRestaurantResearch(research: RestaurantResearch): void {
      restaurantData.set(research.venue.toLowerCase(), research);
    },

    // Get restaurant research
    getRestaurantResearch(venue: string): RestaurantResearch | null {
      return restaurantData.get(venue.toLowerCase()) || null;
    },

    // Generate restaurant recommendations
    generateRestaurantTips(cuisineType: string): string[] {
      const tips: string[] = [];

      switch (cuisineType.toLowerCase()) {
        case 'italian':
          tips.push('Order grilled fish or chicken instead of pasta');
          tips.push('Ask for dressing on the side');
          tips.push('Split dessert or skip it');
          tips.push('Avoid breadsticks or limit to one');
          break;
        case 'mexican':
          tips.push('Choose corn tortillas over flour');
          tips.push('Go for fajitas (hold the tortillas) or grilled proteins');
          tips.push('Skip the chips and queso');
          tips.push('Ask for guacamole instead of sour cream');
          break;
        case 'chinese':
          tips.push('Choose steamed dishes over fried');
          tips.push('Ask for sauce on the side');
          tips.push('Start with hot and sour soup');
          tips.push('Avoid fried rice - get steamed rice instead');
          break;
        case 'japanese':
          tips.push('Sashimi is lower calorie than rolls');
          tips.push('Avoid tempura items');
          tips.push('Edamame is a great low-calorie starter');
          tips.push('Go easy on the soy sauce (sodium)');
          break;
        case 'american':
          tips.push('Order grilled instead of fried');
          tips.push('Substitute fries for side salad');
          tips.push('Ask for half portions or take half home');
          tips.push('Avoid creamy soups and dressings');
          break;
        default:
          tips.push('Ask about preparation methods');
          tips.push('Request sauces on the side');
          tips.push('Start with a salad to fill up');
          tips.push('Drink water instead of sugary beverages');
      }

      return tips;
    },

    // Estimate calories for event type
    estimateEventCalories(eventType: SocialEvent['type'], duration: number = 2): number {
      let baseCalories: number;

      switch (eventType) {
        case 'restaurant':
          baseCalories = 1200; // Typical restaurant meal
          break;
        case 'party':
          baseCalories = 800 + (duration * 200); // Grazing effect
          break;
        case 'barbecue':
          baseCalories = 1500; // Typically heavy
          break;
        case 'holiday':
          baseCalories = 2500; // Multiple courses
          break;
        case 'date_night':
          baseCalories = 1000; // Restaurant with drinks
          break;
        case 'work_event':
          baseCalories = 600; // Usually lighter
          break;
        default:
          baseCalories = 800;
      }

      return Math.round(baseCalories);
    },

    // Get success rate for social events
    getEventSuccessRate(): { rate: number; total: number; successful: number } {
      if (eventLogs.length === 0) {
        return { rate: 0, total: 0, successful: 0 };
      }

      const successful = eventLogs.filter(l => l.wasSuccessful).length;
      const rate = successful / eventLogs.length;

      return {
        rate: Math.round(rate * 100) / 100,
        total: eventLogs.length,
        successful
      };
    },

    // Clear data
    clearData(): void {
      events.length = 0;
      bankingPlans.clear();
      recoveryPlans.clear();
      eventLogs.length = 0;
      restaurantData.clear();
    },

    // Get all events
    getAllEvents(): SocialEvent[] {
      return [...events];
    }
  };
};

// ============================================================================
// Test Suite: Social Event Planning
// ============================================================================

describe('Social Event Planning', () => {
  let service: ReturnType<typeof createSocialEventService>;

  beforeEach(() => {
    service = createSocialEventService();
  });

  // ==========================================================================
  // Calorie Banking Tests (7 tests)
  // ==========================================================================
  describe('Calorie Banking', () => {
    it('should create banking plan for large event', () => {
      const event = service.addEvent({
        name: 'Birthday Party',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        type: 'party',
        estimatedCalories: 3000
      });

      const plan = service.createBankingPlan(event.id, 5);

      expect(plan).not.toBeNull();
      expect(plan!.targetBankedCalories).toBeGreaterThan(0);
    });

    it('should calculate daily reduction correctly', () => {
      const event = service.addEvent({
        name: 'Wedding',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        type: 'party',
        estimatedCalories: 3500
      });

      const plan = service.createBankingPlan(event.id, 5);

      expect(plan!.dailyReduction).toBeGreaterThan(0);
      expect(plan!.dailyReduction).toBeLessThanOrEqual(500); // Max 25% of 2000
    });

    it('should not bank for small calorie events', () => {
      const event = service.addEvent({
        name: 'Light Lunch',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        type: 'work_event',
        estimatedCalories: 2100 // Only 100 over daily target
      });

      const plan = service.createBankingPlan(event.id, 3);

      expect(plan).toBeNull();
    });

    it('should generate daily targets', () => {
      const event = service.addEvent({
        name: 'Dinner Party',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        type: 'party',
        estimatedCalories: 3000
      });

      const plan = service.createBankingPlan(event.id, 3);

      expect(plan!.dailyTargets).toHaveLength(3);
      expect(plan!.dailyTargets[0].targetCalories).toBeLessThan(2000);
    });

    it('should provide recommendations', () => {
      const event = service.addEvent({
        name: 'Holiday Feast',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        type: 'holiday',
        estimatedCalories: 4000
      });

      const plan = service.createBankingPlan(event.id, 5);

      expect(plan!.recommendations.length).toBeGreaterThan(0);
    });

    it('should cap daily reduction to avoid extreme deficit', () => {
      const event = service.addEvent({
        name: 'Huge Feast',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        type: 'holiday',
        estimatedCalories: 5000
      });

      const plan = service.createBankingPlan(event.id, 3);

      // Should not reduce more than 25% per day (500 cal)
      expect(plan!.dailyReduction).toBeLessThanOrEqual(500);
    });

    it('should retrieve saved banking plan', () => {
      const event = service.addEvent({
        name: 'Test Event',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        type: 'party',
        estimatedCalories: 3000
      });

      service.createBankingPlan(event.id, 3);
      const plan = service.getBankingPlan(event.id);

      expect(plan).toBeDefined();
      expect(plan!.eventId).toBe(event.id);
    });
  });

  // ==========================================================================
  // Recovery Plan Tests (6 tests)
  // ==========================================================================
  describe('Recovery Plans', () => {
    it('should create recovery plan for excess calories', () => {
      const event = service.addEvent({
        name: 'Party',
        date: new Date(),
        type: 'party',
        estimatedCalories: 2000
      });

      const plan = service.createRecoveryPlan(event.id, 3500);

      expect(plan.excessCalories).toBe(1500);
      expect(plan.recoveryDays).toBeGreaterThan(0);
    });

    it('should calculate appropriate recovery days', () => {
      const event = service.addEvent({
        name: 'Event',
        date: new Date(),
        type: 'party',
        estimatedCalories: 2000
      });

      // 800 excess = about 2 days at 400 deficit
      const plan = service.createRecoveryPlan(event.id, 2800);

      expect(plan.recoveryDays).toBe(2);
    });

    it('should suggest patterns based on deficit needed', () => {
      const event = service.addEvent({
        name: 'Big Event',
        date: new Date(),
        type: 'holiday',
        estimatedCalories: 2000
      });

      const plan = service.createRecoveryPlan(event.id, 4000);

      expect(plan.recoveryTargets[0].patternSuggestion).toBeDefined();
    });

    it('should maintain protein target during recovery', () => {
      const event = service.addEvent({
        name: 'Event',
        date: new Date(),
        type: 'party',
        estimatedCalories: 2000
      });

      const plan = service.createRecoveryPlan(event.id, 3000);

      expect(plan.recoveryTargets[0].targetProtein).toBe(130);
    });

    it('should provide recovery strategies', () => {
      const event = service.addEvent({
        name: 'Event',
        date: new Date(),
        type: 'party',
        estimatedCalories: 2000
      });

      const plan = service.createRecoveryPlan(event.id, 3500);

      expect(plan.strategies.length).toBeGreaterThan(0);
    });

    it('should calculate expected recovery date', () => {
      const event = service.addEvent({
        name: 'Event',
        date: new Date(),
        type: 'party',
        estimatedCalories: 2000
      });

      const plan = service.createRecoveryPlan(event.id, 3000);

      expect(plan.expectedRecoveryDate).toBeInstanceOf(Date);
      expect(plan.expectedRecoveryDate > new Date()).toBe(true);
    });
  });

  // ==========================================================================
  // Event Logging Tests (5 tests)
  // ==========================================================================
  describe('Event Logging', () => {
    it('should log event completion', () => {
      const event = service.addEvent({
        name: 'Dinner',
        date: new Date(),
        type: 'restaurant',
        estimatedCalories: 1200
      });

      const log = service.logEventCompletion(event.id, 1400);

      expect(log.actualCalories).toBe(1400);
      expect(log.plannedCalories).toBe(1200);
    });

    it('should calculate variance', () => {
      const event = service.addEvent({
        name: 'Dinner',
        date: new Date(),
        type: 'restaurant',
        estimatedCalories: 1000
      });

      const log = service.logEventCompletion(event.id, 1500);

      expect(log.variance).toBe(500);
      expect(log.percentVariance).toBe(50);
    });

    it('should determine success status', () => {
      const event = service.addEvent({
        name: 'Dinner',
        date: new Date(),
        type: 'restaurant',
        estimatedCalories: 1000
      });

      // Within 20% is successful
      const log = service.logEventCompletion(event.id, 1150);

      expect(log.wasSuccessful).toBe(true);
    });

    it('should mark unsuccessful for large variance', () => {
      const event = service.addEvent({
        name: 'Dinner',
        date: new Date(),
        type: 'restaurant',
        estimatedCalories: 1000
      });

      // Over 20% variance
      const log = service.logEventCompletion(event.id, 1500);

      expect(log.wasSuccessful).toBe(false);
    });

    it('should provide lessons learned', () => {
      const event = service.addEvent({
        name: 'Dinner',
        date: new Date(),
        type: 'restaurant',
        estimatedCalories: 1000
      });

      const log = service.logEventCompletion(event.id, 2000);

      expect(log.lessons.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Restaurant Research Tests (4 tests)
  // ==========================================================================
  describe('Restaurant Research', () => {
    it('should store and retrieve restaurant research', () => {
      const research: RestaurantResearch = {
        venue: 'Olive Garden',
        cuisineType: 'Italian',
        healthyOptions: [
          { name: 'Grilled Salmon', estimatedCalories: 450, estimatedProtein: 40, notes: 'Good choice' }
        ],
        itemsToAvoid: ['Alfredo pasta'],
        tips: ['Skip breadsticks'],
        avgMealCalories: 1200
      };

      service.addRestaurantResearch(research);
      const retrieved = service.getRestaurantResearch('Olive Garden');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.healthyOptions).toHaveLength(1);
    });

    it('should return null for unknown restaurant', () => {
      const research = service.getRestaurantResearch('Unknown Place');

      expect(research).toBeNull();
    });

    it('should generate cuisine-specific tips', () => {
      const italianTips = service.generateRestaurantTips('italian');
      const mexicanTips = service.generateRestaurantTips('mexican');

      expect(italianTips.length).toBeGreaterThan(0);
      expect(mexicanTips.length).toBeGreaterThan(0);
      expect(italianTips).not.toEqual(mexicanTips);
    });

    it('should provide default tips for unknown cuisine', () => {
      const tips = service.generateRestaurantTips('unknown-cuisine');

      expect(tips.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Event Estimation and Statistics Tests (3 tests)
  // ==========================================================================
  describe('Event Estimation', () => {
    it('should estimate calories by event type', () => {
      const restaurant = service.estimateEventCalories('restaurant');
      const holiday = service.estimateEventCalories('holiday');
      const workEvent = service.estimateEventCalories('work_event');

      expect(holiday).toBeGreaterThan(restaurant);
      expect(restaurant).toBeGreaterThan(workEvent);
    });

    it('should calculate event success rate', () => {
      // Add some completed events
      const event1 = service.addEvent({
        name: 'Dinner 1',
        date: new Date(),
        type: 'restaurant',
        estimatedCalories: 1000
      });
      service.logEventCompletion(event1.id, 1100); // Success

      const event2 = service.addEvent({
        name: 'Dinner 2',
        date: new Date(),
        type: 'restaurant',
        estimatedCalories: 1000
      });
      service.logEventCompletion(event2.id, 2000); // Failure

      const stats = service.getEventSuccessRate();

      expect(stats.total).toBe(2);
      expect(stats.successful).toBe(1);
      expect(stats.rate).toBe(0.5);
    });

    it('should get upcoming events sorted by date', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      service.addEvent({
        name: 'Later Event',
        date: nextWeek,
        type: 'party',
        estimatedCalories: 2000
      });

      service.addEvent({
        name: 'Sooner Event',
        date: tomorrow,
        type: 'restaurant',
        estimatedCalories: 1200
      });

      const upcoming = service.getUpcomingEvents();

      expect(upcoming).toHaveLength(2);
      expect(upcoming[0].name).toBe('Sooner Event');
    });
  });
});
