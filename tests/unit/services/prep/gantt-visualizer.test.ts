/**
 * Gantt Visualizer Tests
 * Comprehensive tests for visual timeline generation
 */

import { GanttVisualizer } from '../../../../src/services/prep/gantt-visualizer';
import { Timeline, TimeSlot, PrepTask, EquipmentUsage } from '../../../../src/types/prep.types';

describe('GanttVisualizer', () => {
  let visualizer: GanttVisualizer;
  let mockTimeline: Timeline;
  let mockTasks: PrepTask[];

  beforeEach(() => {
    visualizer = new GanttVisualizer();

    mockTasks = [
      {
        id: 'task-1',
        name: 'Chop Vegetables',
        type: 'prep',
        duration: 10,
        equipment: ['cutting-board-1'],
        dependencies: [],
        priority: 'medium',
        requiresAttention: true,
        canParallel: true,
        cleaningTime: 2
      },
      {
        id: 'task-2',
        name: 'Boil Water',
        type: 'cook',
        duration: 15,
        equipment: ['burner-1', 'pot-large'],
        dependencies: [],
        priority: 'high',
        requiresAttention: false,
        canParallel: true,
        cleaningTime: 5
      },
      {
        id: 'task-3',
        name: 'Simmer Sauce',
        type: 'simmer',
        duration: 20,
        equipment: ['burner-2'],
        dependencies: ['task-1'],
        priority: 'medium',
        requiresAttention: false,
        canParallel: true,
        temperature: 325,
        notes: 'Stir occasionally',
        cleaningTime: 3
      }
    ];

    const now = new Date();
    const slots: TimeSlot[] = [
      { taskId: 'task-1', startTime: 0, endTime: 10, equipment: ['cutting-board-1'], isCleanup: false },
      { taskId: 'task-1-cleanup', startTime: 10, endTime: 12, equipment: ['cutting-board-1'], isCleanup: true },
      { taskId: 'task-2', startTime: 0, endTime: 15, equipment: ['burner-1', 'pot-large'], isCleanup: false },
      { taskId: 'task-3', startTime: 12, endTime: 32, equipment: ['burner-2'], isCleanup: false }
    ];
    mockTimeline = {
      id: 'timeline-1',
      totalDuration: 45,
      startTime: now,
      endTime: new Date(now.getTime() + 45 * 60000),
      slots,
      equipmentUsage: [
        {
          equipmentId: 'cutting-board-1',
          slots: slots.filter(s => s.equipment.includes('cutting-board-1')),
          utilizationPercent: 26.7
        },
        {
          equipmentId: 'burner-1',
          slots: slots.filter(s => s.equipment.includes('burner-1')),
          utilizationPercent: 33.3
        },
        {
          equipmentId: 'pot-large',
          slots: slots.filter(s => s.equipment.includes('pot-large')),
          utilizationPercent: 33.3
        },
        {
          equipmentId: 'burner-2',
          slots: slots.filter(s => s.equipment.includes('burner-2')),
          utilizationPercent: 44.4
        }
      ] as EquipmentUsage[],
      parallelTasks: [['task-1', 'task-2']],
      criticalPath: ['task-1', 'task-3']
    };
  });

  describe('generateChart', () => {
    test('should generate chart with combined view by default', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      expect(chart).toBeDefined();
      expect(chart.rows.length).toBeGreaterThan(0);
      expect(chart.totalDuration).toBe(45);
    });

    test('should generate chart with equipment view', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks, 'equipment');
      expect(chart.rows.every(r => r.type === 'equipment')).toBe(true);
    });

    test('should generate chart with task view', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks, 'task');
      expect(chart.rows.every(r => r.type === 'task')).toBe(true);
    });

    test('should generate milestones', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      expect(chart.milestones.length).toBeGreaterThanOrEqual(2);
      expect(chart.milestones[0].label).toBe('Start');
      expect(chart.milestones[chart.milestones.length - 1].label).toBe('Complete');
    });

    test('should calculate correct time scale', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      expect(chart.timeScale).toBeGreaterThan(0);
    });
  });

  describe('Equipment Rows', () => {
    test('should create rows for each equipment used', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks, 'equipment');
      expect(chart.rows.length).toBe(4); // 4 equipment pieces used
    });

    test('should include segments for each task on equipment', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks, 'equipment');
      const burner1Row = chart.rows.find(r => r.id === 'burner-1');
      expect(burner1Row?.segments.length).toBeGreaterThanOrEqual(1);
    });

    test('should mark cleanup segments correctly', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks, 'equipment');
      const cuttingBoardRow = chart.rows.find(r => r.id === 'cutting-board-1');
      const cleanupSegment = cuttingBoardRow?.segments.find(s => s.isCleanup);
      expect(cleanupSegment).toBeDefined();
    });

    test('should format equipment labels nicely', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks, 'equipment');
      const burner1Row = chart.rows.find(r => r.id === 'burner-1');
      expect(burner1Row?.label).toBe('Front Left');
    });
  });

  describe('Task Rows', () => {
    test('should create rows for each task', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks, 'task');
      // Should have 3 base tasks (not counting cleanup as separate tasks)
      expect(chart.rows.length).toBeGreaterThanOrEqual(3);
    });

    test('should include cleanup in task rows', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks, 'task');
      const task1Row = chart.rows.find(r => r.id === 'task-1');
      const cleanupSegment = task1Row?.segments.find(s => s.isCleanup);
      expect(cleanupSegment).toBeDefined();
    });

    test('should assign correct colors by task type', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks, 'task');
      const prepRow = chart.rows.find(r => r.id === 'task-1');
      const prepSegment = prepRow?.segments.find(s => !s.isCleanup);
      expect(prepSegment?.color).toBe('#4CAF50'); // Green for prep
    });
  });

  describe('Segments', () => {
    test('should have correct start and end times', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks, 'task');
      const task2Row = chart.rows.find(r => r.id === 'task-2');
      const segment = task2Row?.segments[0];
      expect(segment?.startTime).toBe(0);
      expect(segment?.endTime).toBe(15);
    });

    test('should generate tooltip with task info', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks, 'task');
      const task3Row = chart.rows.find(r => r.id === 'task-3');
      const segment = task3Row?.segments.find(s => !s.isCleanup);
      expect(segment?.tooltip).toContain('Simmer Sauce');
      expect(segment?.tooltip).toContain('Temperature: 325F');
      expect(segment?.tooltip).toContain('Stir occasionally');
    });
  });

  describe('Milestones', () => {
    test('should include start milestone at time 0', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const startMilestone = chart.milestones.find(m => m.time === 0);
      expect(startMilestone?.label).toBe('Start');
    });

    test('should include complete milestone at total duration', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const endMilestone = chart.milestones.find(m => m.time === 45);
      expect(endMilestone?.label).toBe('Complete');
    });

    test('should include critical path milestones', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      // Should have milestones for critical path tasks
      expect(chart.milestones.length).toBeGreaterThan(2);
    });

    test('should sort milestones by time', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      for (let i = 1; i < chart.milestones.length; i++) {
        expect(chart.milestones[i].time).toBeGreaterThanOrEqual(chart.milestones[i - 1].time);
      }
    });
  });

  describe('toAscii', () => {
    test('should generate ASCII visualization', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const ascii = visualizer.toAscii(chart);
      expect(typeof ascii).toBe('string');
      expect(ascii.length).toBeGreaterThan(0);
    });

    test('should include time header', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const ascii = visualizer.toAscii(chart);
      expect(ascii).toContain('0');
    });

    test('should include row labels', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const ascii = visualizer.toAscii(chart);
      expect(ascii).toContain('|');
    });

    test('should show total duration', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const ascii = visualizer.toAscii(chart);
      expect(ascii).toContain('Total: 45 minutes');
    });

    test('should include milestones section', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const ascii = visualizer.toAscii(chart);
      expect(ascii).toContain('Milestones:');
    });

    test('should respect width parameter', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const ascii = visualizer.toAscii(chart, 60);
      const lines = ascii.split('\n');
      const chartLine = lines.find(l => l.includes('|'));
      // Allow some overhead for labels and borders (typically ~20% extra)
      expect(chartLine?.length).toBeLessThanOrEqual(75);
    });
  });

  describe('toHtml', () => {
    test('should generate HTML visualization', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const html = visualizer.toHtml(chart);
      expect(html).toContain('<div class="gantt-chart"');
      expect(html).toContain('</div>');
    });

    test('should include styles', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const html = visualizer.toHtml(chart);
      expect(html).toContain('<style>');
      expect(html).toContain('.gantt-row');
      expect(html).toContain('.gantt-segment');
    });

    test('should include time header', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const html = visualizer.toHtml(chart);
      expect(html).toContain('gantt-time-header');
    });

    test('should include segments with colors', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const html = visualizer.toHtml(chart);
      expect(html).toContain('background:');
      expect(html).toContain('gantt-segment');
    });

    test('should include tooltips', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const html = visualizer.toHtml(chart);
      expect(html).toContain('title=');
    });
  });

  describe('toJson', () => {
    test('should serialize chart to JSON', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      const json = visualizer.toJson(chart);
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.rows).toBeDefined();
      expect(parsed.totalDuration).toBe(45);
    });
  });

  describe('Time Scale Calculation', () => {
    test('should use 5 min scale for durations <= 30 min', () => {
      const shortTimeline = { ...mockTimeline, totalDuration: 25 };
      const chart = visualizer.generateChart(shortTimeline, mockTasks);
      expect(chart.timeScale).toBe(5);
    });

    test('should use 10 min scale for durations <= 60 min', () => {
      const chart = visualizer.generateChart(mockTimeline, mockTasks);
      expect(chart.timeScale).toBe(10);
    });

    test('should use 15 min scale for durations <= 120 min', () => {
      const longTimeline = { ...mockTimeline, totalDuration: 100 };
      const chart = visualizer.generateChart(longTimeline, mockTasks);
      expect(chart.timeScale).toBe(15);
    });

    test('should use 20 min scale for durations <= 180 min', () => {
      const longTimeline = { ...mockTimeline, totalDuration: 150 };
      const chart = visualizer.generateChart(longTimeline, mockTasks);
      expect(chart.timeScale).toBe(20);
    });

    test('should use 30 min scale for longer durations', () => {
      const veryLongTimeline = { ...mockTimeline, totalDuration: 240 };
      const chart = visualizer.generateChart(veryLongTimeline, mockTasks);
      expect(chart.timeScale).toBe(30);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty timeline', () => {
      const emptyTimeline: Timeline = {
        ...mockTimeline,
        slots: [],
        equipmentUsage: []
      };
      const chart = visualizer.generateChart(emptyTimeline, []);
      expect(chart.rows).toHaveLength(0);
    });

    test('should handle tasks without notes', () => {
      const taskWithoutNotes = { ...mockTasks[0], notes: undefined };
      const chart = visualizer.generateChart(mockTimeline, [taskWithoutNotes]);
      expect(chart).toBeDefined();
    });

    test('should handle tasks without temperature', () => {
      const taskWithoutTemp = { ...mockTasks[0], temperature: undefined };
      const chart = visualizer.generateChart(mockTimeline, [taskWithoutTemp]);
      expect(chart).toBeDefined();
    });

    test('should handle unknown equipment IDs in label formatting', () => {
      const customTimeline = {
        ...mockTimeline,
        equipmentUsage: [{ equipmentId: 'custom-equipment', slots: [], utilizationPercent: 50 }]
      };
      const chart = visualizer.generateChart(customTimeline, mockTasks, 'equipment');
      const row = chart.rows.find(r => r.id === 'custom-equipment');
      expect(row?.label).toBe('Custom Equipment');
    });
  });
});
