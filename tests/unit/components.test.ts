/**
 * Unit Tests: Component Library
 * Tests for Button, Card, Input, Badge, ProgressBar, and other UI components
 * Target: 90% coverage
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock Component Types
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: string;
}

interface CardProps {
  title?: string;
  subtitle?: string;
  elevated?: boolean;
  clickable?: boolean;
}

interface InputProps {
  type?: 'text' | 'number' | 'email' | 'password';
  value?: string | number;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  text: string;
}

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'error';
}

// Component Utility Functions
const createComponentUtils = () => ({
  // Button utilities
  button: {
    getVariantClasses(variant: ButtonProps['variant'] = 'primary'): string[] {
      const classes: Record<string, string[]> = {
        primary: ['bg-blue-600', 'text-white', 'hover:bg-blue-700'],
        secondary: ['bg-gray-200', 'text-gray-800', 'hover:bg-gray-300'],
        outline: ['border-2', 'border-blue-600', 'text-blue-600'],
        ghost: ['bg-transparent', 'text-gray-600', 'hover:bg-gray-100'],
        danger: ['bg-red-600', 'text-white', 'hover:bg-red-700']
      };
      return classes[variant] || classes.primary;
    },

    getSizeClasses(size: ButtonProps['size'] = 'md'): string[] {
      const classes: Record<string, string[]> = {
        sm: ['px-3', 'py-1', 'text-sm'],
        md: ['px-4', 'py-2', 'text-base'],
        lg: ['px-6', 'py-3', 'text-lg']
      };
      return classes[size] || classes.md;
    },

    isInteractive(props: ButtonProps): boolean {
      return !props.disabled && !props.loading;
    },

    getAriaAttributes(props: ButtonProps): Record<string, string | boolean> {
      return {
        'aria-disabled': props.disabled || false,
        'aria-busy': props.loading || false,
        role: 'button'
      };
    }
  },

  // Card utilities
  card: {
    getElevationClasses(elevated: boolean = false): string[] {
      return elevated
        ? ['shadow-lg', 'hover:shadow-xl', 'transition-shadow']
        : ['shadow', 'border', 'border-gray-200'];
    },

    getClickableClasses(clickable: boolean = false): string[] {
      return clickable
        ? ['cursor-pointer', 'hover:scale-[1.02]', 'transition-transform']
        : [];
    },

    hasHeader(props: CardProps): boolean {
      return !!props.title || !!props.subtitle;
    }
  },

  // Input utilities
  input: {
    getTypeAttributes(type: InputProps['type'] = 'text'): Record<string, any> {
      const attributes: Record<string, Record<string, any>> = {
        text: { inputMode: 'text' },
        number: { inputMode: 'numeric', pattern: '[0-9]*' },
        email: { inputMode: 'email', autoComplete: 'email' },
        password: { autoComplete: 'current-password' }
      };
      return attributes[type] || attributes.text;
    },

    validate(type: InputProps['type'], value: string): { valid: boolean; error?: string } {
      if (!value) return { valid: true };

      switch (type) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(value)
            ? { valid: true }
            : { valid: false, error: 'Invalid email format' };
        case 'number':
          return !isNaN(Number(value))
            ? { valid: true }
            : { valid: false, error: 'Must be a valid number' };
        default:
          return { valid: true };
      }
    },

    getStateClasses(error?: string, disabled?: boolean): string[] {
      if (disabled) return ['bg-gray-100', 'cursor-not-allowed', 'opacity-50'];
      if (error) return ['border-red-500', 'focus:ring-red-500'];
      return ['border-gray-300', 'focus:ring-blue-500', 'focus:border-blue-500'];
    }
  },

  // Badge utilities
  badge: {
    getVariantClasses(variant: BadgeProps['variant'] = 'neutral'): string[] {
      const classes: Record<string, string[]> = {
        success: ['bg-green-100', 'text-green-800'],
        warning: ['bg-yellow-100', 'text-yellow-800'],
        error: ['bg-red-100', 'text-red-800'],
        info: ['bg-blue-100', 'text-blue-800'],
        neutral: ['bg-gray-100', 'text-gray-800']
      };
      return classes[variant] || classes.neutral;
    },

    getSizeClasses(size: BadgeProps['size'] = 'md'): string[] {
      const classes: Record<string, string[]> = {
        sm: ['px-2', 'py-0.5', 'text-xs'],
        md: ['px-2.5', 'py-1', 'text-sm'],
        lg: ['px-3', 'py-1.5', 'text-base']
      };
      return classes[size] || classes.md;
    },

    truncateText(text: string, maxLength: number = 20): string {
      return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
    }
  },

  // ProgressBar utilities
  progressBar: {
    calculatePercentage(value: number, max: number = 100): number {
      if (max <= 0) return 0;
      return Math.min(100, Math.max(0, (value / max) * 100));
    },

    getColorClasses(color: ProgressBarProps['color'] = 'primary', percentage: number): string[] {
      // Dynamic color based on percentage if using auto-color
      if (color === 'primary') {
        if (percentage < 33) return ['bg-red-500'];
        if (percentage < 66) return ['bg-yellow-500'];
        return ['bg-green-500'];
      }

      const classes: Record<string, string[]> = {
        primary: ['bg-blue-600'],
        success: ['bg-green-500'],
        warning: ['bg-yellow-500'],
        error: ['bg-red-500']
      };
      return classes[color] || classes.primary;
    },

    formatLabel(value: number, max: number): string {
      const percentage = this.calculatePercentage(value, max);
      return `${Math.round(percentage)}%`;
    },

    getAriaAttributes(value: number, max: number): Record<string, any> {
      return {
        role: 'progressbar',
        'aria-valuenow': value,
        'aria-valuemin': 0,
        'aria-valuemax': max
      };
    }
  }
});

describe('Component Library', () => {
  let utils: ReturnType<typeof createComponentUtils>;

  beforeEach(() => {
    utils = createComponentUtils();
  });

  describe('Button Component', () => {
    it('should return primary variant classes by default', () => {
      const classes = utils.button.getVariantClasses();

      expect(classes).toContain('bg-blue-600');
      expect(classes).toContain('text-white');
    });

    it('should return correct classes for each variant', () => {
      expect(utils.button.getVariantClasses('primary')).toContain('bg-blue-600');
      expect(utils.button.getVariantClasses('secondary')).toContain('bg-gray-200');
      expect(utils.button.getVariantClasses('outline')).toContain('border-blue-600');
      expect(utils.button.getVariantClasses('ghost')).toContain('bg-transparent');
      expect(utils.button.getVariantClasses('danger')).toContain('bg-red-600');
    });

    it('should return correct size classes', () => {
      expect(utils.button.getSizeClasses('sm')).toContain('text-sm');
      expect(utils.button.getSizeClasses('md')).toContain('text-base');
      expect(utils.button.getSizeClasses('lg')).toContain('text-lg');
    });

    it('should determine interactivity correctly', () => {
      expect(utils.button.isInteractive({ children: 'Test' })).toBe(true);
      expect(utils.button.isInteractive({ children: 'Test', disabled: true })).toBe(false);
      expect(utils.button.isInteractive({ children: 'Test', loading: true })).toBe(false);
    });

    it('should generate aria attributes', () => {
      const attrs = utils.button.getAriaAttributes({ children: 'Test', disabled: true });

      expect(attrs['aria-disabled']).toBe(true);
      expect(attrs.role).toBe('button');
    });
  });

  describe('Card Component', () => {
    it('should return elevation classes for elevated cards', () => {
      const elevated = utils.card.getElevationClasses(true);
      const flat = utils.card.getElevationClasses(false);

      expect(elevated).toContain('shadow-lg');
      expect(flat).toContain('shadow');
    });

    it('should return clickable classes', () => {
      const clickable = utils.card.getClickableClasses(true);
      const notClickable = utils.card.getClickableClasses(false);

      expect(clickable).toContain('cursor-pointer');
      expect(notClickable).toHaveLength(0);
    });

    it('should detect header presence', () => {
      expect(utils.card.hasHeader({ title: 'Title' })).toBe(true);
      expect(utils.card.hasHeader({ subtitle: 'Subtitle' })).toBe(true);
      expect(utils.card.hasHeader({})).toBe(false);
    });
  });

  describe('Input Component', () => {
    it('should return type-specific attributes', () => {
      expect(utils.input.getTypeAttributes('number').inputMode).toBe('numeric');
      expect(utils.input.getTypeAttributes('email').inputMode).toBe('email');
    });

    it('should validate email format', () => {
      expect(utils.input.validate('email', 'test@example.com').valid).toBe(true);
      expect(utils.input.validate('email', 'invalid').valid).toBe(false);
    });

    it('should validate number format', () => {
      expect(utils.input.validate('number', '123').valid).toBe(true);
      expect(utils.input.validate('number', 'abc').valid).toBe(false);
    });

    it('should validate empty values', () => {
      expect(utils.input.validate('email', '').valid).toBe(true);
    });

    it('should return correct state classes', () => {
      const errorClasses = utils.input.getStateClasses('Error message');
      const disabledClasses = utils.input.getStateClasses(undefined, true);
      const normalClasses = utils.input.getStateClasses();

      expect(errorClasses).toContain('border-red-500');
      expect(disabledClasses).toContain('cursor-not-allowed');
      expect(normalClasses).toContain('border-gray-300');
    });
  });

  describe('Badge Component', () => {
    it('should return correct variant classes', () => {
      expect(utils.badge.getVariantClasses('success')).toContain('bg-green-100');
      expect(utils.badge.getVariantClasses('warning')).toContain('bg-yellow-100');
      expect(utils.badge.getVariantClasses('error')).toContain('bg-red-100');
      expect(utils.badge.getVariantClasses('info')).toContain('bg-blue-100');
      expect(utils.badge.getVariantClasses('neutral')).toContain('bg-gray-100');
    });

    it('should return correct size classes', () => {
      expect(utils.badge.getSizeClasses('sm')).toContain('text-xs');
      expect(utils.badge.getSizeClasses('md')).toContain('text-sm');
      expect(utils.badge.getSizeClasses('lg')).toContain('text-base');
    });

    it('should truncate long text', () => {
      const longText = 'This is a very long badge text that should be truncated';
      const truncated = utils.badge.truncateText(longText, 20);

      expect(truncated.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(truncated).toContain('...');
    });

    it('should not truncate short text', () => {
      const shortText = 'Short';
      const result = utils.badge.truncateText(shortText);

      expect(result).toBe(shortText);
    });
  });

  describe('ProgressBar Component', () => {
    it('should calculate percentage correctly', () => {
      expect(utils.progressBar.calculatePercentage(50, 100)).toBe(50);
      expect(utils.progressBar.calculatePercentage(25, 50)).toBe(50);
      expect(utils.progressBar.calculatePercentage(100, 100)).toBe(100);
    });

    it('should clamp percentage to 0-100', () => {
      expect(utils.progressBar.calculatePercentage(150, 100)).toBe(100);
      expect(utils.progressBar.calculatePercentage(-10, 100)).toBe(0);
    });

    it('should handle zero max value', () => {
      expect(utils.progressBar.calculatePercentage(50, 0)).toBe(0);
    });

    it('should return dynamic color classes for primary', () => {
      const low = utils.progressBar.getColorClasses('primary', 20);
      const mid = utils.progressBar.getColorClasses('primary', 50);
      const high = utils.progressBar.getColorClasses('primary', 80);

      expect(low).toContain('bg-red-500');
      expect(mid).toContain('bg-yellow-500');
      expect(high).toContain('bg-green-500');
    });

    it('should return static color classes for other variants', () => {
      expect(utils.progressBar.getColorClasses('success', 50)).toContain('bg-green-500');
      expect(utils.progressBar.getColorClasses('warning', 50)).toContain('bg-yellow-500');
      expect(utils.progressBar.getColorClasses('error', 50)).toContain('bg-red-500');
    });

    it('should format label correctly', () => {
      expect(utils.progressBar.formatLabel(50, 100)).toBe('50%');
      expect(utils.progressBar.formatLabel(33, 100)).toBe('33%');
    });

    it('should generate aria attributes', () => {
      const attrs = utils.progressBar.getAriaAttributes(50, 100);

      expect(attrs.role).toBe('progressbar');
      expect(attrs['aria-valuenow']).toBe(50);
      expect(attrs['aria-valuemin']).toBe(0);
      expect(attrs['aria-valuemax']).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown variant gracefully', () => {
      // @ts-expect-error Testing invalid variant
      const classes = utils.button.getVariantClasses('unknown');
      expect(classes).toEqual(utils.button.getVariantClasses('primary'));
    });

    it('should handle undefined size', () => {
      const classes = utils.button.getSizeClasses(undefined);
      expect(classes).toEqual(utils.button.getSizeClasses('md'));
    });

    it('should handle empty text truncation', () => {
      const result = utils.badge.truncateText('');
      expect(result).toBe('');
    });
  });
});
