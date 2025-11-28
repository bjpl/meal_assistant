/**
 * Gantt Chart Visualizer
 * Generates visual timeline representations for prep schedules
 */

import {
  Timeline,
  TimeSlot,
  GanttChart,
  GanttRow,
  GanttSegment,
  PrepTask
} from '../../types/prep.types';

// ============================================================================
// Color Schemes
// ============================================================================

const TASK_COLORS: Record<string, string> = {
  prep: '#4CAF50',      // Green
  cook: '#FF9800',      // Orange
  bake: '#F44336',      // Red
  simmer: '#9C27B0',    // Purple
  rest: '#607D8B',      // Gray
  assemble: '#2196F3',  // Blue
  clean: '#795548',     // Brown
  default: '#9E9E9E'    // Default gray
};

const CLEANUP_COLOR = '#BDBDBD'; // Light gray

// ============================================================================
// Gantt Visualizer Class
// ============================================================================

export class GanttVisualizer {
  // --------------------------------------------------------------------------
  // Main Chart Generation
  // --------------------------------------------------------------------------

  generateChart(
    timeline: Timeline,
    tasks: PrepTask[],
    viewMode: 'equipment' | 'task' | 'combined' = 'combined'
  ): GanttChart {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    let rows: GanttRow[] = [];

    switch (viewMode) {
      case 'equipment':
        rows = this.generateEquipmentRows(timeline, taskMap);
        break;
      case 'task':
        rows = this.generateTaskRows(timeline, taskMap);
        break;
      case 'combined':
        rows = [
          ...this.generateTaskRows(timeline, taskMap),
          ...this.generateEquipmentRows(timeline, taskMap)
        ];
        break;
    }

    const milestones = this.generateMilestones(timeline, taskMap);

    return {
      rows,
      totalDuration: timeline.totalDuration,
      timeScale: this.calculateTimeScale(timeline.totalDuration),
      milestones
    };
  }

  // --------------------------------------------------------------------------
  // Equipment-based Rows
  // --------------------------------------------------------------------------

  private generateEquipmentRows(
    timeline: Timeline,
    taskMap: Map<string, PrepTask>
  ): GanttRow[] {
    const rows: GanttRow[] = [];

    for (const usage of timeline.equipmentUsage) {
      const segments: GanttSegment[] = [];

      for (const slot of usage.slots) {
        const task = taskMap.get(slot.taskId.replace('-cleanup', ''));
        segments.push({
          taskId: slot.taskId,
          taskName: task?.name || slot.taskId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          color: slot.isCleanup
            ? CLEANUP_COLOR
            : TASK_COLORS[task?.type || 'default'] || TASK_COLORS.default,
          isCleanup: slot.isCleanup,
          tooltip: this.generateTooltip(slot, task)
        });
      }

      rows.push({
        id: usage.equipmentId,
        label: this.formatEquipmentLabel(usage.equipmentId),
        type: 'equipment',
        segments
      });
    }

    return rows;
  }

  // --------------------------------------------------------------------------
  // Task-based Rows
  // --------------------------------------------------------------------------

  private generateTaskRows(
    timeline: Timeline,
    taskMap: Map<string, PrepTask>
  ): GanttRow[] {
    const rows: GanttRow[] = [];
    const processedTasks = new Set<string>();

    for (const slot of timeline.slots) {
      const baseTaskId = slot.taskId.replace('-cleanup', '');
      if (processedTasks.has(baseTaskId)) continue;

      const task = taskMap.get(baseTaskId);
      if (!task) continue;

      processedTasks.add(baseTaskId);

      // Find all slots for this task (including cleanup)
      const taskSlots = timeline.slots.filter(s =>
        s.taskId === baseTaskId || s.taskId === `${baseTaskId}-cleanup`
      );

      const segments: GanttSegment[] = taskSlots.map(s => ({
        taskId: s.taskId,
        taskName: s.isCleanup ? `${task.name} (cleanup)` : task.name,
        startTime: s.startTime,
        endTime: s.endTime,
        color: s.isCleanup ? CLEANUP_COLOR : TASK_COLORS[task.type] || TASK_COLORS.default,
        isCleanup: s.isCleanup,
        tooltip: this.generateTooltip(s, task)
      }));

      rows.push({
        id: baseTaskId,
        label: task.name,
        type: 'task',
        segments
      });
    }

    return rows;
  }

  // --------------------------------------------------------------------------
  // Milestones
  // --------------------------------------------------------------------------

  private generateMilestones(
    timeline: Timeline,
    taskMap: Map<string, PrepTask>
  ): { time: number; label: string }[] {
    const milestones: { time: number; label: string }[] = [];

    // Start milestone
    milestones.push({ time: 0, label: 'Start' });

    // Find critical path completion points
    for (const taskId of timeline.criticalPath) {
      const slot = timeline.slots.find(s => s.taskId === taskId);
      const task = taskMap.get(taskId);
      if (slot && task) {
        milestones.push({
          time: slot.endTime,
          label: `${task.name} done`
        });
      }
    }

    // End milestone
    milestones.push({
      time: timeline.totalDuration,
      label: 'Complete'
    });

    // Remove duplicates and sort
    const unique = new Map<number, string>();
    for (const m of milestones) {
      if (!unique.has(m.time) || m.label === 'Complete' || m.label === 'Start') {
        unique.set(m.time, m.label);
      }
    }

    return Array.from(unique.entries())
      .map(([time, label]) => ({ time, label }))
      .sort((a, b) => a.time - b.time);
  }

  // --------------------------------------------------------------------------
  // Formatting Helpers
  // --------------------------------------------------------------------------

  private formatEquipmentLabel(equipmentId: string): string {
    const labels: Record<string, string> = {
      'burner-1': 'Front Left',
      'burner-2': 'Front Right',
      'burner-3': 'Back Left',
      'burner-4': 'Back Right',
      'oven': 'Oven',
      'oven-rack-1': 'Upper Rack',
      'oven-rack-2': 'Lower Rack',
      'microwave': 'Microwave',
      'instant-pot': 'Instant Pot',
      'rice-cooker': 'Rice Cooker',
      'air-fryer': 'Air Fryer'
    };

    return labels[equipmentId] || equipmentId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generateTooltip(slot: TimeSlot, task?: PrepTask): string {
    const lines = [
      task?.name || slot.taskId,
      `${slot.startTime} - ${slot.endTime} min`,
      `Duration: ${slot.endTime - slot.startTime} min`
    ];

    if (task) {
      lines.push(`Type: ${task.type}`);
      if (task.temperature) {
        lines.push(`Temperature: ${task.temperature}F`);
      }
      if (task.notes) {
        lines.push(`Notes: ${task.notes}`);
      }
    }

    if (slot.isCleanup) {
      lines.push('(Cleanup time)');
    }

    return lines.join('\n');
  }

  private calculateTimeScale(totalDuration: number): number {
    // Return minutes per visual unit for readable display
    if (totalDuration <= 30) return 5;
    if (totalDuration <= 60) return 10;
    if (totalDuration <= 120) return 15;
    if (totalDuration <= 180) return 20;
    return 30;
  }

  // --------------------------------------------------------------------------
  // ASCII Visualization (for terminal/text output)
  // --------------------------------------------------------------------------

  toAscii(chart: GanttChart, width: number = 80): string {
    const lines: string[] = [];
    const labelWidth = 15;
    const chartWidth = width - labelWidth - 3;

    // Time header
    const timeHeader = this.generateTimeHeader(chart.totalDuration, chartWidth);
    lines.push(' '.repeat(labelWidth) + ' | ' + timeHeader);
    lines.push('-'.repeat(width));

    // Rows
    for (const row of chart.rows) {
      const label = row.label.substring(0, labelWidth).padEnd(labelWidth);
      const bar = this.generateAsciiBar(row.segments, chart.totalDuration, chartWidth);
      lines.push(`${label} | ${bar}`);
    }

    // Footer
    lines.push('-'.repeat(width));
    lines.push(`Total: ${chart.totalDuration} minutes`);

    // Milestones
    if (chart.milestones.length > 0) {
      lines.push('');
      lines.push('Milestones:');
      for (const m of chart.milestones) {
        lines.push(`  ${m.time.toString().padStart(3)} min: ${m.label}`);
      }
    }

    return lines.join('\n');
  }

  private generateTimeHeader(totalDuration: number, width: number): string {
    const marks: string[] = [];
    const step = Math.ceil(totalDuration / 6);

    for (let t = 0; t <= totalDuration; t += step) {
      const pos = Math.floor((t / totalDuration) * (width - 4));
      const label = t.toString();
      marks[pos] = label;
    }

    let header = '';
    for (let i = 0; i < width; i++) {
      header += marks[i] || ' ';
    }

    return header;
  }

  private generateAsciiBar(
    segments: GanttSegment[],
    totalDuration: number,
    width: number
  ): string {
    const bar: string[] = new Array(width).fill(' ');

    for (const segment of segments) {
      const startPos = Math.floor((segment.startTime / totalDuration) * width);
      const endPos = Math.floor((segment.endTime / totalDuration) * width);
      const char = segment.isCleanup ? '-' : '#';

      for (let i = startPos; i < endPos && i < width; i++) {
        bar[i] = char;
      }
    }

    return bar.join('');
  }

  // --------------------------------------------------------------------------
  // HTML Visualization
  // --------------------------------------------------------------------------

  toHtml(chart: GanttChart): string {
    const rowHeight = 30;
    const headerHeight = 40;
    const totalHeight = headerHeight + (chart.rows.length * rowHeight) + 20;

    let html = `
<div class="gantt-chart" style="font-family: sans-serif; position: relative; width: 100%; height: ${totalHeight}px;">
  <style>
    .gantt-row { display: flex; align-items: center; height: ${rowHeight}px; border-bottom: 1px solid #eee; }
    .gantt-label { width: 120px; padding-right: 10px; text-align: right; font-size: 12px; }
    .gantt-bar-container { flex: 1; position: relative; height: 20px; background: #f5f5f5; }
    .gantt-segment { position: absolute; height: 100%; border-radius: 3px; }
    .gantt-segment:hover { opacity: 0.8; cursor: pointer; }
    .gantt-milestone { position: absolute; width: 2px; background: #333; height: 100%; }
    .gantt-time-header { display: flex; height: ${headerHeight}px; border-bottom: 2px solid #333; }
    .gantt-time-label { position: absolute; font-size: 10px; transform: translateX(-50%); }
  </style>
`;

    // Time header
    html += `<div class="gantt-time-header" style="padding-left: 130px; position: relative;">`;
    for (let t = 0; t <= chart.totalDuration; t += chart.timeScale) {
      const pos = (t / chart.totalDuration) * 100;
      html += `<span class="gantt-time-label" style="left: ${pos}%">${t}m</span>`;
    }
    html += `</div>`;

    // Rows
    for (const row of chart.rows) {
      html += `<div class="gantt-row">`;
      html += `<div class="gantt-label">${row.label}</div>`;
      html += `<div class="gantt-bar-container">`;

      for (const segment of row.segments) {
        const left = (segment.startTime / chart.totalDuration) * 100;
        const width = ((segment.endTime - segment.startTime) / chart.totalDuration) * 100;
        html += `
          <div class="gantt-segment"
               style="left: ${left}%; width: ${width}%; background: ${segment.color};"
               title="${segment.tooltip.replace(/"/g, '&quot;').replace(/\n/g, '&#10;')}">
          </div>`;
      }

      html += `</div></div>`;
    }

    html += `</div>`;
    return html;
  }

  // --------------------------------------------------------------------------
  // JSON Export
  // --------------------------------------------------------------------------

  toJson(chart: GanttChart): string {
    return JSON.stringify(chart, null, 2);
  }
}
