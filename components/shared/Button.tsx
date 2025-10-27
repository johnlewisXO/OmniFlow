
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
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
  const baseStyles = "inline-flex items-center justify-center rounded-squircle-sm font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background transition-all duration-300 ease-out transform hover:scale-[1.02]";

  const variantStyles = {
    primary: "bg-gradient-to-br from-accent to-accent-dark text-white shadow-glass hover:from-accent-light hover:to-accent focus:ring-accent",
    secondary: "bg-transparent border border-accent/60 text-accent hover:bg-accent/10 dark:text-accent-light dark:border-accent-light/60 dark:hover:bg-accent-light/10 backdrop-blur-sm", // Outlined glass
    outline: "border border-foreground/30 text-foreground/80 hover:bg-foreground/5 dark:border-foreground/40 dark:text-foreground/80 dark:hover:bg-foreground/10 bg-transparent", // More generic outline
    ghost: "hover:bg-accent/10 text-accent dark:hover:bg-accent-light/10 dark:text-accent-light",
    danger: "bg-status-error text-white hover:bg-opacity-80 dark:bg-opacity-90 dark:hover:bg-opacity-100 shadow-glass",
  };

  const sizeStyles = {
    sm: "h-9 px-3.5",
    md: "h-10 px-5 py-2.5",
    lg: "h-11 px-6 text-base",
    icon: "h-10 w-10",
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
