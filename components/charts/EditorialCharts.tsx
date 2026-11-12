import React, { useState } from 'react';
import { Avatar } from '../shared/Avatar';
import { User } from '../../types';

/**
 * Shared Recharts Theme Tokens for Editorial Stone, Sage & Lime
 */
export const getEditorialChartTheme = (darkMode: boolean) => ({
  gridStroke: darkMode ? '#2B3026' : '#E3E5DD',
  axisColor: darkMode ? '#9CA192' : '#6A7062',
  tooltipStyle: {
    backgroundColor: darkMode ? '#1A1D17' : '#FFFFFF',
    borderColor: darkMode ? '#3B4234' : '#CFD3C6',
    borderRadius: '12px',
    color: darkMode ? '#F2F3EE' : '#191B17',
    boxShadow: darkMode ? '0 16px 36px rgba(0,0,0,0.65)' : '0 14px 32px rgba(25,27,23,0.12)',
    fontSize: '12px',
    padding: '8px 12px',
  },
  series: {
    charcoal: darkMode ? '#E5E7DF' : '#191B17',
    sage: darkMode ? '#8DA36D' : '#6F8254',
    lime: '#C7EB36',
    emerald: darkMode ? '#34D399' : '#1D7A46',
    amber: darkMode ? '#FBBF24' : '#B45309',
    crimson: darkMode ? '#FB7185' : '#BE123C',
    muted: darkMode ? '#4E5446' : '#B6BBB0',
  },
});

/**
 * 1. Radial Progress Ring (Nova Platform signature compact donut indicator)
 */
export const RadialProgressRing: React.FC<{
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: 'charcoal' | 'lime' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
  sublabel?: string;
  className?: string;
}> = ({
  value,
  size = 48,
  strokeWidth = 5,
  tone = 'charcoal',
  showLabel = true,
  sublabel,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColorMap: Record<typeof tone, string> = {
    charcoal: 'var(--text-primary)',
    lime: 'var(--accent-lime)',
    success: '#1D7A46',
    warning: '#B45309',
    danger: '#BE123C',
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90 transform">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-hairline)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColorMap[tone]}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span
            className="font-mono font-bold tabular-nums text-[var(--text-primary)]"
            style={{ fontSize: size >= 76 ? '16px' : size >= 52 ? '11px' : '9px' }}
          >
            {clamped}%
          </span>
          {sublabel && size >= 72 && (
            <span className="text-[9px] text-[var(--text-muted)] mt-0.5">{sublabel}</span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 2. Radial Health Tick-Arc Gauge (36-tick semi-circle gauge inspired by reference #1)
 */
export interface HealthBreakdownSegment {
  id: string;
  label: string;
  count: number;
  tone: 'on_track' | 'at_risk' | 'delayed';
}

export const RadialHealthTickArc: React.FC<{
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
  const totalTicks = 32;
  const filledTicks = Math.round((clamped / 100) * totalTicks);

  const cx = 120;
  const cy = 112;
  const rInner = 76;
  const rOuter = 94;

  const toneDotColors: Record<HealthBreakdownSegment['tone'], string> = {
    on_track: 'bg-[#7F9460] dark:bg-[#CCF048]',
    at_risk: 'bg-amber-500',
    delayed: 'bg-rose-600',
  };

  return (
    <div className={`editorial-surface p-4 sm:p-5 flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
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

      <div className="flex flex-col items-center justify-center my-1">
        <svg viewBox="0 0 240 132" className="w-full max-w-[235px] h-auto overflow-visible">
          {Array.from({ length: totalTicks }).map((_, idx) => {
            const angleDeg = -180 + (idx / (totalTicks - 1)) * 180;
            const rad = (angleDeg * Math.PI) / 180;
            const x1 = cx + Math.cos(rad) * rInner;
            const y1 = cy + Math.sin(rad) * rInner;
            const x2 = cx + Math.cos(rad) * rOuter;
            const y2 = cy + Math.sin(rad) * rOuter;
            const isActive = idx < filledTicks;

            let stroke = 'var(--border-hairline)';
            if (isActive) {
              if (clamped >= 70) stroke = idx > filledTicks - 4 ? '#C7EB36' : '#6E8252';
              else if (clamped >= 45) stroke = '#D97706';
              else stroke = '#BE123C';
            }

            return (
              <line
                key={idx}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={3.5}
                strokeLinecap="round"
                className="transition-colors duration-300"
              />
            );
          })}
          <text
            x={cx}
            y={cy - 14}
            textAnchor="middle"
            className="fill-[var(--text-primary)] font-mono font-bold"
            style={{ fontSize: '28px', fontVariantNumeric: 'tabular-nums' }}
          >
            {clamped}%
          </text>
          <text
            x={cx}
            y={cy + 6}
            textAnchor="middle"
            className="fill-[var(--text-muted)] font-sans"
            style={{ fontSize: '11px' }}
          >
            on-schedule ratio
          </text>
        </svg>
      </div>

      <div className="space-y-1.5 pt-3 border-t border-[var(--border-hairline)]">
        {segments.map(seg => {
          const Tag = onSegmentClick ? 'button' : 'div';
          return (
            <Tag
              key={seg.id}
              type={onSegmentClick ? 'button' : undefined}
              onClick={onSegmentClick ? () => onSegmentClick(seg.id) : undefined}
              className={`w-full flex items-center justify-between text-xs py-1 px-1.5 rounded-lg transition-colors ${
                onSegmentClick ? 'hover:bg-[var(--bg-sage)] cursor-pointer' : ''
              }`}
            >
              <span className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                <span className={`w-2 h-2 rounded-full ${toneDotColors[seg.tone]}`} />
                <span>{seg.label}</span>
              </span>
              <span className="font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                {seg.count}
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
    if (ratio <= 0.25) return 'bg-[#DDE5CE] dark:bg-[#2F3925] border border-transparent';
    if (ratio <= 0.55) return 'bg-[#9DB37D] dark:bg-[#5E7442] border border-transparent';
    if (ratio <= 0.8) return 'bg-[#C7EB36] dark:bg-[#B4DC2E] border border-transparent';
    return 'bg-[#191B17] dark:bg-[#E1FA70] border border-transparent';
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
          <span className="w-3 h-3 rounded-[3px] bg-[#DDE5CE] dark:bg-[#2F3925]" />
          <span className="w-3 h-3 rounded-[3px] bg-[#9DB37D] dark:bg-[#5E7442]" />
          <span className="w-3 h-3 rounded-[3px] bg-[#C7EB36] dark:bg-[#B4DC2E]" />
          <span className="w-3 h-3 rounded-[3px] bg-[#191B17] dark:bg-[#E1FA70]" />
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
    sage: 'bg-[#7A8F5B] dark:bg-[#9DB37D]',
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
