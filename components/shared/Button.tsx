import React from 'react';
import { motion } from 'motion/react';
import { GLASS_SPRING } from './LiquidGlass';
import { ICON_MAP } from '../../constants';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'lime'
  | 'subtle';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: React.ReactNode;
}

const BASE_BUTTON_STYLES =
  'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold tracking-[-0.005em] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] ' +
  'disabled:opacity-50 disabled:pointer-events-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out ' +
  'cursor-pointer select-none whitespace-nowrap backdrop-blur-md';

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] hover:bg-[var(--accent-cta-hover)] ' +
    'border border-white/20 dark:border-white/15 ' +
    'shadow-[0_8px_20px_-6px_rgba(var(--primary-rgb),0.40),inset_0_1px_0_rgba(255,255,255,0.32)]',
  lime:
    'bg-[var(--accent-lime)] text-[var(--accent-ink)] hover:bg-[var(--accent-lime-hover)] ' +
    'border border-[var(--accent-ink)]/18 ' +
    'shadow-[0_8px_18px_-6px_rgba(var(--primary-rgb),0.34),inset_0_1px_0_rgba(255,255,255,0.62)]',
  secondary:
    'bg-[var(--surface-glass-2)] hover:bg-[var(--surface-glass-3)] text-[var(--text-primary)] ' +
    'border border-[var(--glass-border)] hover:border-[var(--glass-border-strong)] ' +
    'shadow-[0_4px_12px_-6px_rgba(12,16,22,0.16),inset_0_1px_0_var(--glass-highlight)]',
  outline:
    'glass-bubble-control text-[var(--text-primary)] border border-[var(--glass-border-strong)] ' +
    'hover:border-[var(--accent-border)] shadow-[inset_0_1px_0_var(--glass-highlight)]',
  subtle:
    'bg-[var(--surface-nested-subtle)] hover:bg-[var(--surface-glass-2)] text-[var(--text-primary)] ' +
    'border border-[var(--border-hairline)] hover:border-[var(--glass-border)] ' +
    'shadow-[inset_0_1px_0_var(--glass-highlight)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] ' +
    'hover:bg-[var(--surface-nested-subtle)] border border-transparent hover:border-[var(--border-hairline)]',
  danger:
    'bg-rose-600/95 text-white hover:bg-rose-600 border border-white/20 ' +
    'shadow-[0_8px_18px_-6px_rgba(225,29,72,0.42),inset_0_1px_0_rgba(255,255,255,0.28)]',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  xs: 'min-h-[40px] lg:min-h-[28px] px-2.5 text-[11px]',
  sm: 'min-h-[44px] lg:min-h-[32px] px-3.5 text-xs',
  md: 'min-h-[44px] lg:min-h-[36px] px-4 py-1.5 text-xs sm:text-[13px]',
  lg: 'min-h-[44px] lg:min-h-[42px] px-5 text-sm',
  icon: 'h-11 w-11 lg:h-9 lg:w-9 p-0',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className,
  disabled,
  type = 'button',
  ...props
}) => {
  const isDisabled = Boolean(disabled || isLoading);
  return (
    <motion.button
      type={type}
      whileTap={isDisabled ? undefined : { scale: 0.96 }}
      whileHover={isDisabled ? undefined : { y: -0.5 }}
      transition={GLASS_SPRING.micro}
      disabled={isDisabled}
      className={`${BASE_BUTTON_STYLES} ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className || ''}`}
      {...(props as any)}
    >
      {isLoading && <ICON_MAP.SpinnerIcon className="w-3.5 h-3.5 animate-spin shrink-0" />}
      {children}
    </motion.button>
  );
};

export type IconButtonVariant = 'glass' | 'primary' | 'lime' | 'ghost' | 'danger' | 'subtle';
export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  isLoading?: boolean;
  children: React.ReactNode;
}

const ICON_VARIANT_STYLES: Record<IconButtonVariant, string> = {
  glass:
    'glass-bubble-control text-[var(--text-secondary)] hover:text-[var(--text-primary)] ' +
    'border border-[var(--glass-border)] hover:border-[var(--glass-border-strong)] shadow-[inset_0_1px_0_var(--glass-highlight)]',
  subtle:
    'bg-[var(--surface-nested-subtle)] hover:bg-[var(--surface-glass-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] ' +
    'border border-[var(--border-hairline)] hover:border-[var(--glass-border-strong)] shadow-[inset_0_1px_0_var(--glass-highlight)]',
  primary:
    'bg-[var(--accent-cta)] text-[var(--accent-cta-ink)] hover:bg-[var(--accent-cta-hover)] ' +
    'border border-white/20 shadow-[0_6px_16px_-6px_rgba(var(--primary-rgb),0.40),inset_0_1px_0_rgba(255,255,255,0.32)]',
  lime:
    'bg-[var(--accent-lime)] text-[var(--accent-ink)] hover:bg-[var(--accent-lime-hover)] ' +
    'border border-[var(--accent-ink)]/18 shadow-[0_6px_14px_-6px_rgba(var(--primary-rgb),0.32),inset_0_1px_0_rgba(255,255,255,0.58)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-nested-subtle)] ' +
    'border border-transparent hover:border-[var(--border-hairline)]',
  danger:
    'bg-rose-600/15 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white ' +
    'border border-rose-500/25 hover:border-rose-500/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
};

const ICON_SIZE_STYLES: Record<IconButtonSize, string> = {
  xs: 'h-9 w-9 lg:h-7 lg:w-7',
  sm: 'h-10 w-10 lg:h-8 lg:w-8',
  md: 'h-11 w-11 lg:h-9 lg:w-9',
  lg: 'h-11 w-11 lg:h-10 lg:w-10',
};

export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'glass',
  size = 'md',
  isLoading = false,
  children,
  className,
  disabled,
  type = 'button',
  ...props
}) => {
  const isDisabled = Boolean(disabled || isLoading);
  return (
    <motion.button
      type={type}
      whileTap={isDisabled ? undefined : { scale: 0.92 }}
      transition={GLASS_SPRING.micro}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center rounded-full shrink-0 cursor-pointer select-none backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] disabled:opacity-50 disabled:pointer-events-none ${ICON_VARIANT_STYLES[variant]} ${ICON_SIZE_STYLES[size]} ${className || ''}`}
      {...(props as any)}
    >
      {isLoading ? <ICON_MAP.SpinnerIcon className="w-4 h-4 animate-spin" /> : children}
    </motion.button>
  );
};
