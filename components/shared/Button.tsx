import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'lime';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold text-xs sm:text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-all duration-150 ease-out active:scale-[0.98] cursor-pointer';

  const variantStyles = {
    primary:
      'bg-[#191B17] text-white hover:bg-[#2C3028] dark:bg-[#CCF048] dark:text-[#131511] dark:hover:bg-[#D8F568] border border-transparent shadow-xs',
    lime:
      'bg-[var(--accent-lime)] text-[var(--accent-ink)] hover:bg-[var(--accent-lime-hover)] border border-[var(--accent-ink)]/15 shadow-xs',
    secondary:
      'bg-[var(--bg-sage)] text-[var(--text-primary)] hover:bg-[var(--bg-sage-hover)] border border-[var(--border-hairline)]',
    outline:
      'bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-hairline)] hover:border-[var(--border-strong)]',
    ghost:
      'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sage)]',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 border border-transparent shadow-xs',
  };

  const sizeStyles = {
    sm: 'h-8 px-3.5 text-xs',
    md: 'h-9 px-4 py-2',
    lg: 'h-10 px-5 text-sm',
    icon: 'h-9 w-9 p-0',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className || ''}`}
      {...props}
    >
      {children}
    </button>
  );
};
