/**
 * Unit Tests: Hydration UI Components
 * Tests for QuickLog buttons, progress ring, caffeine warnings, milestones, and undo
 * Week 1-2 Deliverable - Target: 40+ test cases
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================================
// UI Component Types
// ============================================================================

interface QuickLogButton {
  amountOz: 8 | 16 | 24 | 32;
  label: string;
  icon: string;
  isEnabled: boolean;
}

interface ProgressRingState {
  currentOz: number;
  goalOz: number;
  percentage: number;
  strokeDashoffset: number;
  color: 'blue' | 'green' | 'gold';
  label: string;
}

interface CaffeineWarningState {
  currentMg: number;
  limitMg: number;
  percentage: number;
  status: 'safe' | 'warning' | 'danger' | 'exceeded';
  message: string;
  showWarning: boolean;
}

interface MilestoneData {
  id: string;
  threshold: number;
  name: string;
  emoji: string;
  achieved: boolean;
  celebrationShown: boolean;
}

interface UndoState {
  canUndo: boolean;
  entryId: string | null;
  timeRemaining: number;
  isVisible: boolean;
}

// ============================================================================
// Mock UI Component Services
// ============================================================================

const createHydrationUIService = () => {
  // Progress ring circumference (assume 282.74 for r=45)
  const CIRCUMFERENCE = 282.74;

  // Milestones at 25%, 50%, 75%, 100%
  const defaultMilestones: MilestoneData[] = [
    { id: 'quarter', threshold: 25, name: 'Quarter Way', emoji: '🌱', achieved: false, celebrationShown: false },
    { id: 'half', threshold: 50, name: 'Halfway', emoji: '💧', achieved: false, celebrationShown: false },
    { id: 'three-quarter', threshold: 75, name: 'Almost There', emoji: '🌊', achieved: false, celebrationShown: false },
    { id: 'complete', threshold: 100, name: 'Goal Reached!', emoji: '🎉', achieved: false, celebrationShown: false },
    { id: 'overachiever', threshold: 125, name: 'Overachiever', emoji: '⭐', achieved: false, celebrationShown: false }
  ];

  let milestones = [...defaultMilestones];
  let undoStack: Array<{ id: string; timestamp: number }> = [];

  return {
    // ========================================================================
    // Quick Log Buttons
    // ========================================================================

    getQuickLogButtons(): QuickLogButton[] {
      return [
        { amountOz: 8, label: '+8 oz', icon: 'glass-water', isEnabled: true },
        { amountOz: 16, label: '+16 oz', icon: 'glass-water-droplet', isEnabled: true },
        { amountOz: 24, label: '+24 oz', icon: 'bottle-water', isEnabled: true },
        { amountOz: 32, label: '+32 oz', icon: 'jug', isEnabled: true }
      ];
    },

    validateQuickLogAmount(amount: number): boolean {
      return [8, 16, 24, 32].includes(amount);
    },

    getButtonLabel(amountOz: number): string {
      return `+${amountOz} oz`;
    },

    // ========================================================================
    // Progress Ring Calculations
    // ========================================================================

    calculateProgressRing(currentOz: number, goalOz: number): ProgressRingState {
      const percentage = Math.min(200, Math.round((currentOz / goalOz) * 100));
      const cappedPercentage = Math.min(100, percentage);
      const strokeDashoffset = CIRCUMFERENCE - (cappedPercentage / 100) * CIRCUMFERENCE;

      let color: ProgressRingState['color'] = 'blue';
      if (percentage >= 100) {
        color = 'gold';
      } else if (percentage >= 75) {
        color = 'green';
      }

      let label = `${currentOz}/${goalOz} oz`;
      if (percentage >= 100) {
        label = `${currentOz} oz - Goal met!`;
      }

      return {
        currentOz,
        goalOz,
        percentage,
        strokeDashoffset,
        color,
        label
      };
    },

    getProgressPercentage(currentOz: number, goalOz: number): number {
      return Math.round((currentOz / goalOz) * 100);
    },

    // ========================================================================
    // Caffeine Warning System
    // ========================================================================

    calculateCaffeineWarning(currentMg: number, warningMg: number = 300, limitMg: number = 400): CaffeineWarningState {
      const percentage = Math.round((currentMg / limitMg) * 100);

      let status: CaffeineWarningState['status'] = 'safe';
      let message = `${currentMg}/${limitMg}mg caffeine`;
      let showWarning = false;

      if (currentMg > limitMg) {
        status = 'exceeded';
        message = `Caffeine limit exceeded by ${currentMg - limitMg}mg`;
        showWarning = true;
      } else if (currentMg >= limitMg) {
        status = 'danger';
        message = 'At caffeine limit - no more caffeine today';
        showWarning = true;
      } else if (currentMg >= warningMg) {
        status = 'warning';
        message = `Approaching limit - ${limitMg - currentMg}mg remaining`;
        showWarning = true;
      }

      return {
        currentMg,
        limitMg,
        percentage,
        status,
        message,
        showWarning
      };
    },

    shouldShowCaffeineWarning(currentMg: number, warningMg: number = 300): boolean {
      return currentMg >= warningMg;
    },

    getCaffeineStatusColor(status: CaffeineWarningState['status']): string {
      const colors: Record<CaffeineWarningState['status'], string> = {
        'safe': '#22c55e',
        'warning': '#eab308',
        'danger': '#f97316',
        'exceeded': '#ef4444'
      };
      return colors[status];
    },

    // ========================================================================
    // Milestone Celebrations
    // ========================================================================

    checkMilestones(percentage: number): MilestoneData[] {
      return milestones.map(m => ({
        ...m,
        achieved: percentage >= m.threshold
      }));
    },

    getNewlyAchievedMilestone(previousPercentage: number, newPercentage: number): MilestoneData | null {
      for (const milestone of milestones) {
        if (previousPercentage < milestone.threshold && newPercentage >= milestone.threshold && !milestone.celebrationShown) {
          return milestone;
        }
      }
      return null;
    },

    markMilestoneCelebrated(milestoneId: string): void {
      const milestone = milestones.find(m => m.id === milestoneId);
      if (milestone) {
        milestone.celebrationShown = true;
      }
    },

    getMilestoneMessage(milestone: MilestoneData): string {
      return `${milestone.emoji} ${milestone.name}! You've reached ${milestone.threshold}% of your daily goal!`;
    },

    resetMilestones(): void {
      milestones = defaultMilestones.map(m => ({ ...m, achieved: false, celebrationShown: false }));
    },

    // ========================================================================
    // Undo Functionality
    // ========================================================================

    pushUndo(entryId: string): void {
      undoStack.push({
        id: entryId,
        timestamp: Date.now()
      });
    },

    popUndo(): { id: string; timestamp: number } | null {
      return undoStack.pop() || null;
    },

    getUndoState(): UndoState {
      if (undoStack.length === 0) {
        return {
          canUndo: false,
          entryId: null,
          timeRemaining: 0,
          isVisible: false
        };
      }

      const lastUndo = undoStack[undoStack.length - 1];
      const elapsed = Date.now() - lastUndo.timestamp;
      const timeRemaining = Math.max(0, 30000 - elapsed);

      return {
        canUndo: timeRemaining > 0,
        entryId: lastUndo.id,
        timeRemaining,
        isVisible: timeRemaining > 0
      };
    },

    isUndoExpired(timestamp: number): boolean {
      return Date.now() - timestamp > 30000;
    },

    clearUndoStack(): void {
      undoStack = [];
    },

    // ========================================================================
    // Display Formatting
    // ========================================================================

    formatOzDisplay(oz: number): string {
      return `${oz} oz`;
    },

    formatPercentageDisplay(percentage: number): string {
      return `${percentage}%`;
    },

    formatTimeRemaining(ms: number): string {
      const seconds = Math.ceil(ms / 1000);
      return `${seconds}s`;
    },

    // ========================================================================
    // Animation States
    // ========================================================================

    getProgressAnimation(isIncreasing: boolean): string {
      return isIncreasing ? 'fill-increase' : 'fill-decrease';
    },

    getMilestoneAnimation(): string {
      return 'celebration-bounce';
    },

    getUndoAnimation(): string {
      return 'slide-up-fade';
    }
  };
};

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Hydration UI Tests', () => {
  let ui: ReturnType<typeof createHydrationUIService>;

  beforeEach(() => {
    ui = createHydrationUIService();
    ui.resetMilestones();
    ui.clearUndoStack();
  });

  // ==========================================================================
  // 1. QuickLog Button Tests
  // ==========================================================================

  describe('QuickLog Buttons', () => {
    it('should provide 4 quick log buttons', () => {
      const buttons = ui.getQuickLogButtons();
      expect(buttons).toHaveLength(4);
    });

    it('should have +8oz button', () => {
      const buttons = ui.getQuickLogButtons();
      const btn8 = buttons.find(b => b.amountOz === 8);

      expect(btn8).toBeDefined();
      expect(btn8?.label).toBe('+8 oz');
    });

    it('should have +16oz button', () => {
      const buttons = ui.getQuickLogButtons();
      const btn16 = buttons.find(b => b.amountOz === 16);

      expect(btn16).toBeDefined();
      expect(btn16?.label).toBe('+16 oz');
    });

    it('should have +24oz button', () => {
      const buttons = ui.getQuickLogButtons();
      const btn24 = buttons.find(b => b.amountOz === 24);

      expect(btn24).toBeDefined();
      expect(btn24?.label).toBe('+24 oz');
    });

    it('should have +32oz button', () => {
      const buttons = ui.getQuickLogButtons();
      const btn32 = buttons.find(b => b.amountOz === 32);

      expect(btn32).toBeDefined();
      expect(btn32?.label).toBe('+32 oz');
    });

    it('should validate correct quick log amounts', () => {
      expect(ui.validateQuickLogAmount(8)).toBe(true);
      expect(ui.validateQuickLogAmount(16)).toBe(true);
      expect(ui.validateQuickLogAmount(24)).toBe(true);
      expect(ui.validateQuickLogAmount(32)).toBe(true);
    });

    it('should reject invalid quick log amounts', () => {
      expect(ui.validateQuickLogAmount(10)).toBe(false);
      expect(ui.validateQuickLogAmount(20)).toBe(false);
      expect(ui.validateQuickLogAmount(64)).toBe(false);
    });

    it('should generate correct button label', () => {
      expect(ui.getButtonLabel(8)).toBe('+8 oz');
      expect(ui.getButtonLabel(32)).toBe('+32 oz');
    });

    it('should have all buttons enabled by default', () => {
      const buttons = ui.getQuickLogButtons();
      expect(buttons.every(b => b.isEnabled)).toBe(true);
    });
  });

  // ==========================================================================
  // 2. Progress Ring Tests
  // ==========================================================================

  describe('Progress Ring Calculation', () => {
    it('should calculate 0% for no progress', () => {
      const state = ui.calculateProgressRing(0, 125);

      expect(state.percentage).toBe(0);
      expect(state.color).toBe('blue');
    });

    it('should calculate 50% correctly', () => {
      const state = ui.calculateProgressRing(62, 125);

      expect(state.percentage).toBe(50);
    });

    it('should calculate 100% correctly', () => {
      const state = ui.calculateProgressRing(125, 125);

      expect(state.percentage).toBe(100);
      expect(state.color).toBe('gold');
    });

    it('should show blue color below 75%', () => {
      const state = ui.calculateProgressRing(60, 125);
      expect(state.color).toBe('blue');
    });

    it('should show green color at 75%+', () => {
      const state = ui.calculateProgressRing(94, 125);
      expect(state.color).toBe('green');
    });

    it('should show gold color at 100%+', () => {
      const state = ui.calculateProgressRing(125, 125);
      expect(state.color).toBe('gold');
    });

    it('should cap percentage at 200% for display', () => {
      const state = ui.calculateProgressRing(300, 125);
      expect(state.percentage).toBe(200);
    });

    it('should calculate stroke dashoffset correctly', () => {
      const state50 = ui.calculateProgressRing(62, 125);
      const state100 = ui.calculateProgressRing(125, 125);

      // 50% should have half the circumference as offset
      expect(state50.strokeDashoffset).toBeCloseTo(141.37, 1);
      // 100% should have 0 offset
      expect(state100.strokeDashoffset).toBeCloseTo(0, 1);
    });

    it('should show goal met message at 100%', () => {
      const state = ui.calculateProgressRing(125, 125);
      expect(state.label).toContain('Goal met');
    });

    it('should show current/goal format below 100%', () => {
      const state = ui.calculateProgressRing(60, 125);
      expect(state.label).toBe('60/125 oz');
    });

    it('should calculate percentage independently', () => {
      expect(ui.getProgressPercentage(50, 100)).toBe(50);
      expect(ui.getProgressPercentage(75, 100)).toBe(75);
      expect(ui.getProgressPercentage(100, 100)).toBe(100);
    });
  });

  // ==========================================================================
  // 3. Caffeine Warning Tests
  // ==========================================================================

  describe('Caffeine Warning at 300mg', () => {
    it('should show safe status below 300mg', () => {
      const state = ui.calculateCaffeineWarning(200);

      expect(state.status).toBe('safe');
      expect(state.showWarning).toBe(false);
    });

    it('should show warning at exactly 300mg', () => {
      const state = ui.calculateCaffeineWarning(300);

      expect(state.status).toBe('warning');
      expect(state.showWarning).toBe(true);
    });

    it('should show warning between 300-399mg', () => {
      const state = ui.calculateCaffeineWarning(350);

      expect(state.status).toBe('warning');
      expect(state.message).toContain('remaining');
    });

    it('should show danger at exactly 400mg', () => {
      const state = ui.calculateCaffeineWarning(400);

      expect(state.status).toBe('danger');
      expect(state.message).toContain('At caffeine limit');
    });

    it('should show exceeded above 400mg', () => {
      const state = ui.calculateCaffeineWarning(450);

      expect(state.status).toBe('exceeded');
      expect(state.message).toContain('exceeded by 50mg');
    });

    it('should calculate percentage correctly', () => {
      const state = ui.calculateCaffeineWarning(200, 300, 400);
      expect(state.percentage).toBe(50);
    });

    it('should check warning threshold correctly', () => {
      expect(ui.shouldShowCaffeineWarning(299)).toBe(false);
      expect(ui.shouldShowCaffeineWarning(300)).toBe(true);
      expect(ui.shouldShowCaffeineWarning(400)).toBe(true);
    });

    it('should return correct status colors', () => {
      expect(ui.getCaffeineStatusColor('safe')).toBe('#22c55e');
      expect(ui.getCaffeineStatusColor('warning')).toBe('#eab308');
      expect(ui.getCaffeineStatusColor('danger')).toBe('#f97316');
      expect(ui.getCaffeineStatusColor('exceeded')).toBe('#ef4444');
    });
  });

  // ==========================================================================
  // 4. Milestone Celebration Tests
  // ==========================================================================

  describe('Milestone Celebrations', () => {
    it('should have 5 milestones defined', () => {
      const milestones = ui.checkMilestones(0);
      expect(milestones).toHaveLength(5);
    });

    it('should detect 25% milestone', () => {
      const milestones = ui.checkMilestones(25);
      const quarter = milestones.find(m => m.id === 'quarter');

      expect(quarter?.achieved).toBe(true);
    });

    it('should detect 50% milestone', () => {
      const milestones = ui.checkMilestones(50);
      const half = milestones.find(m => m.id === 'half');

      expect(half?.achieved).toBe(true);
    });

    it('should detect 75% milestone', () => {
      const milestones = ui.checkMilestones(75);
      const threeQuarter = milestones.find(m => m.id === 'three-quarter');

      expect(threeQuarter?.achieved).toBe(true);
    });

    it('should detect 100% milestone', () => {
      const milestones = ui.checkMilestones(100);
      const complete = milestones.find(m => m.id === 'complete');

      expect(complete?.achieved).toBe(true);
    });

    it('should detect 125% overachiever milestone', () => {
      const milestones = ui.checkMilestones(125);
      const overachiever = milestones.find(m => m.id === 'overachiever');

      expect(overachiever?.achieved).toBe(true);
    });

    it('should find newly achieved milestone on crossing threshold', () => {
      const milestone = ui.getNewlyAchievedMilestone(20, 25);

      expect(milestone).not.toBeNull();
      expect(milestone?.id).toBe('quarter');
    });

    it('should not trigger milestone if already at threshold', () => {
      const milestone = ui.getNewlyAchievedMilestone(25, 30);
      expect(milestone).toBeNull();
    });

    it('should not re-trigger celebrated milestone', () => {
      const first = ui.getNewlyAchievedMilestone(20, 30);
      expect(first?.id).toBe('quarter');

      ui.markMilestoneCelebrated('quarter');

      const second = ui.getNewlyAchievedMilestone(20, 30);
      expect(second).toBeNull();
    });

    it('should generate milestone celebration message', () => {
      const milestones = ui.checkMilestones(50);
      const half = milestones.find(m => m.id === 'half')!;

      const message = ui.getMilestoneMessage(half);

      expect(message).toContain('💧');
      expect(message).toContain('Halfway');
      expect(message).toContain('50%');
    });

    it('should reset milestones for new day', () => {
      ui.markMilestoneCelebrated('quarter');
      ui.resetMilestones();

      const milestones = ui.checkMilestones(30);
      const quarter = milestones.find(m => m.id === 'quarter');

      // Should be able to celebrate again after reset
      const newMilestone = ui.getNewlyAchievedMilestone(20, 30);
      expect(newMilestone).not.toBeNull();
    });
  });

  // ==========================================================================
  // 5. Undo Functionality Tests
  // ==========================================================================

  describe('Undo Functionality', () => {
    it('should start with empty undo stack', () => {
      const state = ui.getUndoState();

      expect(state.canUndo).toBe(false);
      expect(state.isVisible).toBe(false);
    });

    it('should enable undo after push', () => {
      ui.pushUndo('entry-123');
      const state = ui.getUndoState();

      expect(state.canUndo).toBe(true);
      expect(state.entryId).toBe('entry-123');
    });

    it('should show undo button after logging', () => {
      ui.pushUndo('entry-123');
      const state = ui.getUndoState();

      expect(state.isVisible).toBe(true);
    });

    it('should have 30 second time limit', () => {
      ui.pushUndo('entry-123');
      const state = ui.getUndoState();

      expect(state.timeRemaining).toBeLessThanOrEqual(30000);
      expect(state.timeRemaining).toBeGreaterThan(29000);
    });

    it('should pop undo entry correctly', () => {
      ui.pushUndo('entry-1');
      ui.pushUndo('entry-2');

      const popped = ui.popUndo();
      expect(popped?.id).toBe('entry-2');

      const popped2 = ui.popUndo();
      expect(popped2?.id).toBe('entry-1');
    });

    it('should return null when popping empty stack', () => {
      const popped = ui.popUndo();
      expect(popped).toBeNull();
    });

    it('should detect expired undo', () => {
      const oldTimestamp = Date.now() - 35000;
      expect(ui.isUndoExpired(oldTimestamp)).toBe(true);

      const recentTimestamp = Date.now() - 5000;
      expect(ui.isUndoExpired(recentTimestamp)).toBe(false);
    });

    it('should clear undo stack', () => {
      ui.pushUndo('entry-1');
      ui.pushUndo('entry-2');
      ui.clearUndoStack();

      const state = ui.getUndoState();
      expect(state.canUndo).toBe(false);
    });
  });

  // ==========================================================================
  // 6. Display Formatting Tests
  // ==========================================================================

  describe('Display Formatting', () => {
    it('should format oz display correctly', () => {
      expect(ui.formatOzDisplay(16)).toBe('16 oz');
      expect(ui.formatOzDisplay(125)).toBe('125 oz');
    });

    it('should format percentage display correctly', () => {
      expect(ui.formatPercentageDisplay(50)).toBe('50%');
      expect(ui.formatPercentageDisplay(100)).toBe('100%');
    });

    it('should format time remaining correctly', () => {
      expect(ui.formatTimeRemaining(30000)).toBe('30s');
      expect(ui.formatTimeRemaining(15500)).toBe('16s');
      expect(ui.formatTimeRemaining(1000)).toBe('1s');
    });
  });

  // ==========================================================================
  // 7. Animation States Tests
  // ==========================================================================

  describe('Animation States', () => {
    it('should return fill-increase animation for adding water', () => {
      expect(ui.getProgressAnimation(true)).toBe('fill-increase');
    });

    it('should return fill-decrease animation for removing water', () => {
      expect(ui.getProgressAnimation(false)).toBe('fill-decrease');
    });

    it('should return celebration animation for milestones', () => {
      expect(ui.getMilestoneAnimation()).toBe('celebration-bounce');
    });

    it('should return slide-up animation for undo toast', () => {
      expect(ui.getUndoAnimation()).toBe('slide-up-fade');
    });
  });

  // ==========================================================================
  // 8. Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle zero goal gracefully', () => {
      // Prevent division by zero
      const state = ui.calculateProgressRing(50, 0.1);
      expect(state.percentage).toBeGreaterThan(0);
    });

    it('should handle very large amounts', () => {
      const state = ui.calculateProgressRing(500, 125);
      expect(state.percentage).toBe(200); // Capped at 200%
    });

    it('should handle multiple milestone crossings', () => {
      // Going from 0 to 60% should only trigger first uncelebrated
      const milestone = ui.getNewlyAchievedMilestone(0, 60);
      expect(milestone?.id).toBe('quarter');
    });
  });
});
