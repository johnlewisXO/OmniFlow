import React, { useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICON_MAP } from '../../constants';
import {
  GLASS_SPRING,
  GlassSurface,
  GlassBubble,
  FluidCollapse,
  AnimatedViewStage,
  FloatingGlassDock,
} from './LiquidGlass';

export { GLASS_SPRING, GlassSurface, GlassBubble, FluidCollapse, AnimatedViewStage, FloatingGlassDock };

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  actions,
  className = '',
}) => (
  <div className={`flex flex-col sm:flex-row sm:items-end justify-between gap-3 ${className}`}>
    <div className="min-w-0 space-y-0.5">
      {eyebrow && (
        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {eyebrow}
        </p>
      )}
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] truncate">
        {title}
      </h1>
      {subtitle && (
        <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] max-w-2xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
    {actions && (
      <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>
    )}
  </div>
);

export interface InlineKpiItem {
  id: string;
  label: string;
  value: string | number;
  sublabel?: string;
  delta?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'lime';
  visual?: React.ReactNode;
  onClick?: () => void;
}

export const InlineKpiStrip: React.FC<{
  items: InlineKpiItem[];
  className?: string;
}> = ({ items, className = '' }) => {
  const toneDotClass: Record<NonNullable<InlineKpiItem['tone']>, string> = {
    default: 'bg-[var(--text-primary)]',
    success: 'bg-emerald-600 dark:bg-emerald-400',
    warning: 'bg-amber-600 dark:bg-amber-400',
    danger: 'bg-rose-600 dark:bg-rose-400',
    lime: 'bg-[var(--accent-lime)] ring-1 ring-[var(--accent-ink)]/20',
  };

  return (
    <div
      className={`editorial-surface px-4 py-3 sm:px-5 sm:py-3.5 ${className}`}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center lg:justify-between gap-4 lg:gap-0 lg:divide-x lg:divide-[var(--border-hairline)]">
        {items.map((item, idx) => {
          if (item.onClick) {
            return (
              <motion.button
                key={item.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={GLASS_SPRING.micro}
                onClick={item.onClick}
                className={`flex items-center gap-3 text-left min-w-0 cursor-pointer group rounded-xl py-1 -my-1 px-1.5 -mx-1.5 hover:bg-[var(--bg-sage)]/45 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] ${
                  idx > 0 ? 'lg:pl-5' : ''
                } ${idx < items.length - 1 ? 'lg:pr-5' : ''}`}
              >
                {item.visual ? (
                  <div className="shrink-0">{item.visual}</div>
                ) : item.tone ? (
                  <div className="w-8 h-8 rounded-full bg-[var(--surface-nested-subtle)] border border-[var(--border-hairline)] flex items-center justify-center shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${toneDotClass[item.tone]}`} />
                  </div>
                ) : null}

                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[var(--text-muted)] truncate">
                    {item.label}
                  </p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-lg sm:text-xl font-bold font-mono tabular-nums tracking-tight text-[var(--text-primary)] group-hover:opacity-80">
                      {item.value}
                    </span>
                    {item.delta && (
                      <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                        {item.delta}
                      </span>
                    )}
                  </div>
                  {item.sublabel && (
                    <p className="text-[11px] text-[var(--text-secondary)] truncate">
                      {item.sublabel}
                    </p>
                  )}
                </div>
              </motion.button>
            );
          }

          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 text-left min-w-0 ${
                idx > 0 ? 'lg:pl-5' : ''
              } ${idx < items.length - 1 ? 'lg:pr-5' : ''}`}
            >
              {item.visual ? (
                <div className="shrink-0">{item.visual}</div>
              ) : item.tone ? (
                <div className="w-8 h-8 rounded-full bg-[var(--surface-nested-subtle)] border border-[var(--border-hairline)] flex items-center justify-center shrink-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${toneDotClass[item.tone]}`} />
                </div>
              ) : null}

              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[var(--text-muted)] truncate">
                  {item.label}
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-lg sm:text-xl font-bold font-mono tabular-nums tracking-tight text-[var(--text-primary)]">
                    {item.value}
                  </span>
                  {item.delta && (
                    <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                      {item.delta}
                    </span>
                  )}
                </div>
                {item.sublabel && (
                  <p className="text-[11px] text-[var(--text-secondary)] truncate">
                    {item.sublabel}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface SegmentedTabOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export function SegmentedTabs<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: {
  options: readonly SegmentedTabOption<string>[];
  value: T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (val: any) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const pillId = useId();

  return (
    <div
      role="tablist"
      className={`relative inline-flex items-center gap-0.5 p-1 rounded-full bg-[var(--surface-glass-1)] backdrop-blur-md border border-[var(--glass-border)] shadow-[inset_0_1px_0_var(--glass-highlight)] overflow-x-auto scrollbar-none max-w-full ${className}`}
    >
      {options.map(opt => {
        const active = opt.id === value;
        return (
          <motion.button
            key={opt.id}
            role="tab"
            aria-selected={active}
            type="button"
            whileTap={{ scale: 0.965 }}
            transition={GLASS_SPRING.micro}
            onClick={() => onChange(opt.id as T)}
            className={`relative inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer ${
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'
            } ${
              active
                ? 'text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`segmented-active-${pillId}`}
                transition={GLASS_SPRING.morph}
                className="absolute inset-0 rounded-full bg-[var(--surface-glass-3)] border border-[var(--glass-border-strong)] shadow-[0_3px_10px_-3px_rgba(0,0,0,0.14),inset_0_1px_0_var(--glass-highlight)]"
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {opt.icon && (
                <span
                  className={`inline-flex items-center justify-center shrink-0 transition-colors ${
                    active ? 'text-[var(--accent-text)]' : 'text-[var(--text-secondary)] opacity-80'
                  }`}
                >
                  {opt.icon}
                </span>
              )}
              <span>{opt.label}</span>
              {opt.count !== undefined && (
                <span className="font-mono tabular-nums text-[10px] opacity-70">
                  {opt.count}
                </span>
              )}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export const HairlineCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}> = ({ children, className = '', padding = 'md', interactive = false }) => {
  const padMap = {
    none: '',
    sm: 'p-3.5',
    md: 'p-4 sm:p-5',
    lg: 'p-5 sm:p-6',
  };
  return (
    <div
      className={`editorial-surface ${interactive ? 'glass-interactive-card' : ''} ${padMap[padding]} ${className}`}
    >
      {children}
    </div>
  );
};

export const LiquidBezelSection: React.FC<{
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  bezelRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}> = ({
  title,
  subtitle,
  eyebrow,
  icon,
  bezelRight,
  children,
  className = '',
  bodyClassName = 'p-4 sm:p-5',
}) => {
  return (
    <section className={`liquid-bezel-section overflow-hidden ${className}`}>
      {/* Sculpted Bezel Top Crest with Exact 1:1 Concentric R=32 Circular S-Curve Transition */}
      <div className="flex flex-col md:flex-row md:items-start justify-between">
        <div className="flex items-start shrink-0 max-w-full">
          <div className="bg-[var(--bg-bezel)] text-[#F4F5F0] pl-4 pr-3 sm:pl-5 h-[64px] flex items-center gap-3 min-w-0">
            {icon && (
              <div className="w-9 h-9 rounded-full bg-[var(--accent-lime)] text-[var(--accent-ink)] flex items-center justify-center shrink-0 shadow-xs">
                {icon}
              </div>
            )}
            <div className="min-w-0 leading-tight">
              {eyebrow && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60 truncate">
                  {eyebrow}
                </p>
              )}
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-[11px] text-white/70 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Exact 1:1 Circular R=32 S-Curve Wing (Desktop/Tablet) */}
          <svg
            viewBox="0 0 64 64"
            className="hidden md:block w-[64px] h-[64px] shrink-0 -ml-[0.5px] pointer-events-none"
            aria-hidden="true"
          >
            <path
              d="M -0.5,0 L 64,0 A 32 32 0 0 0 32 32 A 32 32 0 0 1 0 64 L -0.5,64 Z"
              fill="var(--bg-bezel)"
            />
          </svg>
        </div>

        {bezelRight && (
          <div className="flex-1 min-w-0 min-h-[64px] px-4 py-2.5 md:py-2 md:pr-5 flex items-center justify-start md:justify-end gap-2 flex-wrap">
            {bezelRight}
          </div>
        )}
      </div>

      <div className={`border-t border-[var(--border-hairline)]/65 ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
};

export const LiquidBezelCard: React.FC<{
  cornerLabel?: React.ReactNode;
  cornerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}> = ({ cornerLabel, cornerAction, children, className = '', interactive = false }) => {
  return (
    <div
      className={`liquid-glass-card ${interactive ? 'glass-interactive-card' : ''} overflow-hidden flex flex-col ${className}`}
    >
      {(cornerLabel || cornerAction) && (
        <div className="flex items-start justify-end">
          <div className="flex items-stretch">
            <svg
              viewBox="0 0 28 28"
              className="w-[28px] h-[28px] shrink-0 -mr-[0.5px] pointer-events-none block"
              aria-hidden="true"
            >
              <path
                d="M 0,0 L 28.5,0 L 28.5,28 L 28,28 A 14 14 0 0 1 14 14 A 14 14 0 0 0 0 0 Z"
                fill="var(--bg-bezel)"
              />
            </svg>
            <div className="bg-[var(--bg-bezel)] text-[#F4F5F0] h-[28px] pr-3 pl-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
              {cornerLabel}
              {cornerAction}
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 px-4 pb-4 pt-1 flex flex-col">
        {children}
      </div>
    </div>
  );
};

export const StatusDot: React.FC<{
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'lime';
  label: string;
  className?: string;
}> = ({ tone, label, className = '' }) => {
  const dotColors: Record<typeof tone, string> = {
    success: 'bg-emerald-600 dark:bg-emerald-400',
    warning: 'bg-amber-600 dark:bg-amber-400',
    danger: 'bg-rose-600 dark:bg-rose-400',
    neutral: 'bg-[var(--text-muted)]',
    lime: 'bg-[var(--accent-lime)] ring-1 ring-[var(--accent-ink)]/30',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] ${className}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColors[tone]}`} />
      <span className="truncate">{label}</span>
    </span>
  );
};

export const SlideOverDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}> = ({ isOpen, onClose, title, subtitle, children, footer, widthClass = 'max-w-lg' }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="slideover-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={GLASS_SPRING.scrim}
          className="fixed inset-0 z-50 flex justify-end p-0 sm:p-2.5 bg-black/40 backdrop-blur-[5px]"
          onClick={onClose}
        >
          <motion.aside
            key="slideover-aside"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={GLASS_SPRING.spatial}
            onClick={e => e.stopPropagation()}
            className={`relative z-10 w-full ${widthClass} h-full liquid-glass-overlay sm:rounded-[24px] flex flex-col overflow-hidden`}
          >
            <div className="px-5 py-4 border-b border-[var(--border-hairline)]/80 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[var(--text-primary)] truncate">{title}</h2>
                {subtitle && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">{subtitle}</p>
                )}
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                transition={GLASS_SPRING.micro}
                onClick={onClose}
                className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)]/80 transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                <ICON_MAP.XMarkIcon className="w-4 h-4" />
              </motion.button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-5">
              {children}
            </div>

            {footer && (
              <div className="px-5 py-3.5 border-t border-[var(--border-hairline)]/80 bg-[var(--bg-surface-subtle)]/55 shrink-0">
                {footer}
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
