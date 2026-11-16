import React, { useState } from 'react';
import { Avatar } from '../shared/Avatar';
import { User } from '../../types';

/**
 * Shared Recharts Theme Tokens for Adaptive Liquid Glass Palettes
 */
export const getEditorialChartTheme = (darkMode: boolean) => {
  const readCssVar = (name: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback;
    const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return val || fallback;
  };
  const lime = readCssVar('--accent-lime', darkMode ? '#CCF048' : '#D4F542');
  const sage = readCssVar('--chart-sage', darkMode ? '#8DA36D' : '#6F8254');
  const glassSurface = readCssVar('--surface-glass-3', darkMode ? 'rgba(22, 26, 30, 0.86)' : 'rgba(255, 255, 255, 0.88)');
  const hairline = readCssVar('--border-hairline', darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(25,27,23,0.1)');
  const glassBorderStrong = readCssVar('--glass-border-strong', darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(25,27,23,0.18)');
  const textPrimary = readCssVar('--text-primary', darkMode ? '#F2F3EE' : '#191B17');
  const textSecondary = readCssVar('--text-secondary', darkMode ? '#9CA192' : '#6A7062');
  const textDisabled = readCssVar('--text-disabled', darkMode ? '#4E5446' : '#B6BBB0');

  return {
    gridStroke: hairline,
    axisColor: textSecondary,
    tooltipStyle: {
      backgroundColor: glassSurface,
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      border: `1px solid ${glassBorderStrong}`,
      borderRadius: '14px',
      color: textPrimary,
      boxShadow: darkMode
        ? '0 18px 40px -8px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.18)'
        : '0 16px 36px -8px rgba(25,27,23,0.14), inset 0 1px 0 rgba(255,255,255,0.72)',
      fontSize: '12px',
      padding: '8px 12px',
    },
    series: {
      charcoal: textPrimary,
      sage,
      lime,
      emerald: darkMode ? '#34D399' : '#1D7A46',
      amber: darkMode ? '#FBBF24' : '#B45309',
      crimson: darkMode ? '#FB7185' : '#BE123C',
      muted: textDisabled,
    },
  };
};

/**
 * 1. Liquid Metric Progress (Adaptive Liquid Glass capsule bar with specular rim)
 */
export const LiquidMetricProgress: React.FC<{
  value: number;
  tone?: 'charcoal' | 'lime' | 'success' | 'warning' | 'danger';
  compact?: boolean;
  showValue?: boolean;
  sublabel?: string;
  className?: string;
}> = ({
  value,
  tone = 'lime',
  compact = false,
  showValue,
  sublabel,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const shouldShowValue = showValue !== undefined ? showValue : !compact;

  const fillStyleMap: Record<typeof tone, string> = {
    charcoal: 'linear-gradient(90deg, var(--accent-cta) 0%, var(--chart-sage) 100%)',
    lime: 'linear-gradient(90deg, var(--accent-lime) 0%, var(--chart-sage) 100%)',
    success: 'linear-gradient(90deg, #10B981 0%, #34D399 100%)',
    warning: 'linear-gradient(90deg, #D97706 0%, #FBBF24 100%)',
    danger: 'linear-gradient(90deg, #BE123C 0%, #FB7185 100%)',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 min-w-0 ${compact ? 'w-16 sm:w-20 shrink-0' : 'w-full'} ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`relative flex-1 rounded-full overflow-hidden backdrop-blur-md bg-[var(--surface-nested-subtle)] border border-[var(--glass-border)] shadow-[inset_0_1px_1px_rgba(0,0,0,0.08)] ${
          compact ? 'h-2' : 'h-2.5'
        }`}
      >
        <div
          className="relative h-full rounded-full transition-[width] duration-500 ease-out shadow-[0_0_10px_-2px_rgba(var(--primary-rgb),0.45)]"
          style={{
            width: `${clamped}%`,
            background: fillStyleMap[tone],
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0.5 top-0 h-[42%] rounded-full bg-white/40"
          />
        </div>
      </div>

      {shouldShowValue && (
        <div className="flex items-baseline gap-1 shrink-0 leading-none">
          <span className="text-xs font-mono font-bold tabular-nums text-[var(--text-primary)]">
            {clamped}%
          </span>
          {sublabel && (
            <span className="text-[10px] text-[var(--text-muted)]">{sublabel}</span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 2. Liquid Health Distribution (Segmented glass telemetry bar + benchmark + clickable rows)
 */
export interface HealthBreakdownSegment {
  id: string;
  label: string;
  count: number;
  tone: 'on_track' | 'at_risk' | 'delayed';
}

export const LiquidHealthDistribution: React.FC<{
  percentage: number;
  title?: string;
  statusLabel?: string;
  segments: HealthBreakdownSegment[];
  onSegmentClick?: (segmentId: string) => void;
  className?: string;
}> = ({
  percentage,
  title = 'Project Health',
  statusLabel = 'Healthy',
  segments,
  onSegmentClick,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const totalCount = Math.max(
    1,
    segments.reduce((acc, seg) => acc + Math.max(0, seg.count), 0)
  );

  const toneDotColors: Record<HealthBreakdownSegment['tone'], string> = {
    on_track: 'bg-[var(--chart-sage)] dark:bg-[var(--accent-lime)]',
    at_risk: 'bg-amber-500',
    delayed: 'bg-rose-600',
  };

  const toneBarGradients: Record<HealthBreakdownSegment['tone'], string> = {
    on_track: 'linear-gradient(90deg, var(--chart-sage) 0%, var(--accent-lime) 100%)',
    at_risk: 'linear-gradient(90deg, #D97706 0%, #FBBF24 100%)',
    delayed: 'linear-gradient(90deg, #BE123C 0%, #FB7185 100%)',
  };

  return (
    <div className={`editorial-surface p-4 sm:p-5 flex flex-col justify-between gap-4 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
          <span
            className={`w-2 h-2 rounded-full ${
              clamped >= 70
                ? 'bg-emerald-600 dark:bg-emerald-400'
                : clamped >= 45
                ? 'bg-amber-500'
                : 'bg-rose-600'
            }`}
          />
          {statusLabel}
        </span>
      </div>

      {/* Hero Readout + Interactive Multi-Segment Liquid Glass Capsule */}
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-bold tabular-nums text-3xl sm:text-[34px] tracking-tight text-[var(--text-primary)] leading-none">
              {clamped}%
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">on-schedule ratio</span>
          </div>
          <span className="text-[10px] font-mono tabular-nums text-[var(--text-muted)]">
            Target 75%
          </span>
        </div>

        <div className="relative h-4 rounded-full p-0.5 backdrop-blur-md bg-[var(--surface-nested-subtle)] border border-[var(--glass-border)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] flex items-center gap-0.5 overflow-hidden">
          {segments.map(seg => {
            if (seg.count <= 0) return null;
            const sharePct = Math.max(4, (seg.count / totalCount) * 100);
            const Tag = onSegmentClick ? 'button' : 'div';
            return (
              <Tag
                key={seg.id}
                type={onSegmentClick ? 'button' : undefined}
                onClick={onSegmentClick ? () => onSegmentClick(seg.id) : undefined}
                title={`${seg.label}: ${seg.count} (${Math.round((seg.count / totalCount) * 100)}%)`}
                className={`relative h-full rounded-full transition-[width,filter,transform] duration-400 ease-out overflow-hidden ${
                  onSegmentClick ? 'cursor-pointer hover:brightness-110' : ''
                }`}
                style={{
                  width: `${sharePct}%`,
                  background: toneBarGradients[seg.tone],
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0.5 top-0 h-[40%] rounded-full bg-white/35"
                />
              </Tag>
            );
          })}
          {/* 75% Benchmark Marker */}
          <span
            aria-hidden="true"
            title="75% Benchmark"
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-[var(--text-primary)]/45"
            style={{ left: '75%' }}
          />
        </div>
      </div>

      {/* Clean Clickable Breakdown Rows */}
      <div className="space-y-1 pt-2.5 border-t border-[var(--border-hairline)]">
        {segments.map(seg => {
          const sharePct = Math.round((seg.count / totalCount) * 100);
          const Tag = onSegmentClick ? 'button' : 'div';
          return (
            <Tag
              key={seg.id}
              type={onSegmentClick ? 'button' : undefined}
              onClick={onSegmentClick ? () => onSegmentClick(seg.id) : undefined}
              className={`w-full flex items-center justify-between text-xs py-1.5 px-2 rounded-xl transition-colors ${
                onSegmentClick ? 'hover:bg-[var(--bg-sage)] cursor-pointer' : ''
              }`}
            >
              <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                <span className={`w-2 h-2 rounded-full ${toneDotColors[seg.tone]}`} />
                <span>{seg.label}</span>
              </span>
              <span className="inline-flex items-center gap-2 font-mono tabular-nums">
                <span className="text-[11px] text-[var(--text-muted)]">{sharePct}%</span>
                <span className="font-semibold text-[var(--text-primary)] min-w-[20px] text-right">
                  {seg.count}
                </span>
              </span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 3. Liquid Segmented Distribution (Replaces Pie/Donut charts across Reports & Gantt analytics)
 */
export interface DistributionSegmentItem {
  id?: string;
  name?: string;
  label?: string;
  value: number;
  color: string;
  [key: string]: any;
}

export const LiquidSegmentedDistribution: React.FC<{
  segments: DistributionSegmentItem[];
  totalLabel?: string;
  compact?: boolean;
  onSegmentClick?: (segment: DistributionSegmentItem) => void;
  className?: string;
}> = ({
  segments,
  totalLabel = 'Tasks',
  compact = false,
  onSegmentClick,
  className = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const safeTotal = Math.max(1, total);

  if (segments.length === 0 || total === 0) {
    return (
      <div className={`flex flex-col items-center justify-center text-center py-6 ${className}`}>
        <span className="text-xs font-medium text-[var(--text-muted)]">
          No {totalLabel.toLowerCase()} recorded in this scope.
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col justify-between ${compact ? 'gap-2.5' : 'gap-4'} ${className}`}>
      {/* Total Readout */}
      {!compact && (
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold tabular-nums text-[var(--text-primary)]">
              {total}
            </span>
            <span className="text-xs text-[var(--text-muted)]">{totalLabel}</span>
          </div>
          {hoveredIdx !== null && segments[hoveredIdx] && (
            <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
              {segments[hoveredIdx].label || segments[hoveredIdx].name}:{' '}
              {Math.round((segments[hoveredIdx].value / safeTotal) * 100)}%
            </span>
          )}
        </div>
      )}

      {/* Interactive Stacked Liquid Glass Capsule Bar */}
      <div
        className={`relative w-full rounded-full p-0.5 backdrop-blur-md bg-[var(--surface-nested-subtle)] border border-[var(--glass-border)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] flex items-center gap-0.5 overflow-hidden ${
          compact ? 'h-3' : 'h-4'
        }`}
      >
        {segments.map((seg, idx) => {
          const pct = Math.max(3, (seg.value / safeTotal) * 100);
          const displayLabel = seg.label || seg.name || 'Segment';
          const Tag = onSegmentClick ? 'button' : 'div';
          return (
            <Tag
              key={seg.id || displayLabel || idx}
              type={onSegmentClick ? 'button' : undefined}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={onSegmentClick ? () => onSegmentClick(seg) : undefined}
              title={`${displayLabel}: ${seg.value} (${Math.round((seg.value / safeTotal) * 100)}%)`}
              className={`relative h-full rounded-full transition-[width,filter,opacity] duration-300 ease-out overflow-hidden ${
                onSegmentClick ? 'cursor-pointer hover:brightness-110' : ''
              } ${hoveredIdx !== null && hoveredIdx !== idx ? 'opacity-65' : 'opacity-100'}`}
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color,
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0.5 top-0 h-[42%] rounded-full bg-white/35"
              />
            </Tag>
          );
        })}
      </div>

      {/* Category Breakdown Rows */}
      <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
        {segments.map((seg, idx) => {
          const sharePct = Math.round((seg.value / safeTotal) * 100);
          const displayLabel = seg.label || seg.name || 'Segment';
          const Tag = onSegmentClick ? 'button' : 'div';
          return (
            <Tag
              key={seg.id || displayLabel || idx}
              type={onSegmentClick ? 'button' : undefined}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={onSegmentClick ? () => onSegmentClick(seg) : undefined}
              className={`w-full flex items-center justify-between gap-2 text-xs ${
                compact ? 'py-0.5 px-1 rounded-lg' : 'py-1.5 px-2.5 rounded-xl border border-transparent'
              } transition-colors ${
                onSegmentClick
                  ? 'hover:bg-[var(--bg-sage)] hover:border-[var(--border-hairline)] cursor-pointer'
                  : ''
              } ${hoveredIdx === idx ? 'bg-[var(--bg-surface-subtle)]' : ''}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="font-medium text-[var(--text-secondary)] truncate">
                  {displayLabel}
                </span>
              </span>
              <span className="flex items-center gap-2.5 font-mono tabular-nums shrink-0">
                <span className="text-[11px] text-[var(--text-muted)]">{sharePct}%</span>
                <span className="font-bold text-[var(--text-primary)] min-w-[20px] text-right">
                  {seg.value}
                </span>
              </span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 3. Hatched Activity & Velocity Heatmap (15-week grid with diagonal empty cells & sage/lime fills)
 */
export interface HeatmapDayCell {
  dateKey: string;
  label: string;
  count: number;
  points?: number;
}

export const HatchedActivityHeatmap: React.FC<{
  cells: HeatmapDayCell[];
  title?: string;
  subtitle?: string;
  onCellClick?: (cell: HeatmapDayCell) => void;
  className?: string;
}> = ({
  cells,
  title = 'Activity Velocity',
  subtitle,
  onCellClick,
  className = '',
}) => {
  const [hoveredCell, setHoveredCell] = useState<HeatmapDayCell | null>(null);

  // Organize into columns of 7 days (weeks)
  const weeks: HeatmapDayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const maxCount = Math.max(1, ...cells.map(c => c.count));

  const getCellLevelClass = (count: number) => {
    if (count <= 0) return 'heatmap-hatched-empty border border-[var(--border-hairline)]';
    const ratio = count / maxCount;
    if (ratio <= 0.25) return 'bg-[var(--heat-1)] border border-transparent';
    if (ratio <= 0.55) return 'bg-[var(--heat-2)] border border-transparent';
    if (ratio <= 0.8) return 'bg-[var(--heat-3)] border border-transparent';
    return 'bg-[var(--heat-4)] border border-transparent';
  };

  const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className={`editorial-surface p-4 sm:p-5 flex flex-col justify-between ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {hoveredCell
              ? `${hoveredCell.label}: ${hoveredCell.count} completed${
                  hoveredCell.points ? ` · ${hoveredCell.points} pts` : ''
                }`
              : subtitle || `${cells.reduce((acc, c) => acc + c.count, 0)} deliveries tracked across ${weeks.length} weeks`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <span>Less</span>
          <span className="w-3 h-3 rounded-[3px] heatmap-hatched-empty border border-[var(--border-hairline)]" />
          <span className="w-3 h-3 rounded-[3px] bg-[var(--heat-1)]" />
          <span className="w-3 h-3 rounded-[3px] bg-[var(--heat-2)]" />
          <span className="w-3 h-3 rounded-[3px] bg-[var(--heat-3)]" />
          <span className="w-3 h-3 rounded-[3px] bg-[var(--heat-4)]" />
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-none pb-1">
        <div className="inline-flex items-start gap-2 min-w-full">
          <div className="flex flex-col gap-1.5 pt-0.5 pr-1">
            {dayLetters.map((d, i) => (
              <span
                key={i}
                className="h-3.5 text-[9px] font-mono leading-[14px] text-[var(--text-muted)] select-none"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, weeks.length)}, minmax(14px, 1fr))` }}>
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1.5">
                {week.map(cell => (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => onCellClick?.(cell)}
                    title={`${cell.label}: ${cell.count} tasks`}
                    className={`w-full h-3.5 min-w-[12px] rounded-[4px] transition-transform duration-150 hover:scale-110 cursor-pointer ${getCellLevelClass(
                      cell.count
                    )}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 4. Slim Progress & Allocation Bar
 */
export const SlimProgressBar: React.FC<{
  value: number;
  tone?: 'charcoal' | 'lime' | 'sage' | 'warning' | 'danger';
  showPercent?: boolean;
  heightClass?: string;
  className?: string;
}> = ({
  value,
  tone = 'charcoal',
  showPercent = false,
  heightClass = 'h-1.5',
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const fillMap: Record<typeof tone, string> = {
    charcoal: 'bg-[var(--text-primary)]',
    lime: 'bg-[var(--accent-lime)]',
    sage: 'bg-[var(--chart-sage)]',
    warning: 'bg-amber-600 dark:bg-amber-400',
    danger: 'bg-rose-600 dark:bg-rose-500',
  };

  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <div className={`flex-1 bg-[var(--bg-sage)] rounded-full overflow-hidden ${heightClass}`}>
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${fillMap[tone]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showPercent && (
        <span className="text-[11px] font-mono font-semibold tabular-nums text-[var(--text-secondary)] shrink-0 w-8 text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
};

/**
 * 5. Interactive Milestone & Phase Timeline (Nova Platform signature phase nodes + lime milestone flags)
 */
export interface TimelineMilestoneFlag {
  id: string;
  label: string;
  dateLabel: string;
  positionPct: number;
}

export interface TimelinePhaseNode {
  id: string;
  stepNumber: string;
  title: string;
  dateRange: string;
  taskCount: number;
  progressPct: number;
  assignees: Partial<User>[];
  row: 0 | 1;
  leftPct: number;
  onClick?: () => void;
}

export const MilestonePhaseTimeline: React.FC<{
  milestones: TimelineMilestoneFlag[];
  phases: TimelinePhaseNode[];
  axisLabels: string[];
  className?: string;
}> = ({ milestones, phases, axisLabels, className = '' }) => {
  return (
    <div className={`editorial-surface p-4 sm:p-5 overflow-x-auto scrollbar-thin ${className}`}>
      <div className="min-w-[680px]">
        {/* Axis Headers */}
        <div className="grid grid-cols-6 text-[11px] font-mono text-[var(--text-muted)] pb-2 border-b border-[var(--border-hairline)]">
          {axisLabels.map((lbl, idx) => (
            <span key={idx}>{lbl}</span>
          ))}
        </div>

        {/* Lime Milestone Flags Rail */}
        <div className="relative h-14 border-b border-[var(--border-hairline)]">
          {milestones.map(m => (
            <div
              key={m.id}
              className="absolute top-2.5 flex items-center gap-2 -translate-x-2"
              style={{ left: `${Math.min(86, Math.max(4, m.positionPct))}%` }}
            >
              <span className="w-6 h-6 rounded-lg bg-[var(--accent-lime)] text-[var(--accent-ink)] flex items-center justify-center shadow-xs shrink-0">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18m0-13h12l-2.5 4L15 16H3" />
                </svg>
              </span>
              <div className="leading-tight whitespace-nowrap">
                <p className="text-[11px] font-semibold text-[var(--text-primary)]">{m.label}</p>
                <p className="text-[10px] font-mono text-[var(--text-muted)]">{m.dateLabel}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Two-Row Connected Phase Cards */}
        <div className="relative pt-5 pb-2 space-y-4">
          {([0, 1] as const).map(rowIdx => {
            const rowPhases = phases.filter(p => p.row === rowIdx);
            return (
              <div key={rowIdx} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {rowPhases.map((phase, pIdx) => (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={phase.onClick}
                    className={`text-left editorial-surface-subtle p-3.5 hover:border-[var(--border-strong)] transition-all cursor-pointer group ${
                      rowIdx === 1 && pIdx === 0 ? 'md:translate-x-6' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono font-semibold text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--bg-sage)]">
                          {phase.stepNumber}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:underline">
                            {phase.title}
                          </p>
                          <p className="text-[10px] font-mono text-[var(--text-muted)]">
                            {phase.dateRange}
                          </p>
                        </div>
                      </div>
                      {phase.progressPct >= 100 && (
                        <span className="w-5 h-5 rounded-full bg-[var(--bg-sage)] text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                          ✓
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex -space-x-1.5">
                        {phase.assignees.slice(0, 3).map((u, idx) => (
                          <div key={u.id || idx} className="ring-2 ring-[var(--bg-surface)] rounded-full">
                            <Avatar user={u as User} size="xs" disableHoverCard />
                          </div>
                        ))}
                      </div>
                      <span className="text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                        {phase.taskCount} tasks
                      </span>
                    </div>

                    <SlimProgressBar
                      value={phase.progressPct}
                      tone={phase.progressPct >= 80 ? 'sage' : 'charcoal'}
                      showPercent
                      heightClass="h-1"
                    />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
