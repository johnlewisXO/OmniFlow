import React, { useEffect } from 'react';
import { ICON_MAP } from '../../constants';

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
          const Tag = item.onClick ? 'button' : 'div';
          return (
            <Tag
              key={item.id}
              type={item.onClick ? 'button' : undefined}
              onClick={item.onClick}
              className={`flex items-center gap-3 text-left min-w-0 ${
                idx > 0 ? 'lg:pl-5' : ''
              } ${idx < items.length - 1 ? 'lg:pr-5' : ''} ${
                item.onClick
                  ? 'cursor-pointer group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]'
                  : ''
              }`}
            >
              {item.visual ? (
                <div className="shrink-0">{item.visual}</div>
              ) : item.tone ? (
                <div className="w-8 h-8 rounded-full bg-[var(--bg-sage)] flex items-center justify-center shrink-0">
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
            </Tag>
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
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-0.5 p-1 rounded-full bg-[var(--bg-sage)] border border-[var(--border-hairline)] overflow-x-auto scrollbar-none max-w-full ${className}`}
    >
      {options.map(opt => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.id as T)}
            className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'
            } ${
              active
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-xs border border-[var(--border-hairline)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
            }`}
          >
            {opt.icon && <span className="shrink-0 opacity-80">{opt.icon}</span>}
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span className="font-mono tabular-nums text-[10px] opacity-70">
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const HairlineCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}> = ({ children, className = '', padding = 'md' }) => {
  const padMap = {
    none: '',
    sm: 'p-3.5',
    md: 'p-4 sm:p-5',
    lg: 'p-5 sm:p-6',
  };
  return (
    <div className={`editorial-surface ${padMap[padding]} ${className}`}>
      {children}
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fadeIn">
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full ${widthClass} h-full bg-[var(--bg-surface)] border-l border-[var(--border-hairline)] shadow-2xl flex flex-col`}
      >
        <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--text-primary)] truncate">{title}</h2>
            {subtitle && (
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)] transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <ICON_MAP.XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-5">
          {children}
        </div>

        {footer && (
          <div className="px-5 py-3.5 border-t border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] shrink-0">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
};
