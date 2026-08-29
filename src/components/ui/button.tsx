import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'crimson';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer active:scale-[0.98] select-none';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 rounded-lg gap-1.5',
    md: 'text-sm px-3.5 py-2 rounded-xl gap-2',
    lg: 'text-base px-5 py-2.5 rounded-xl gap-2.5',
    icon: 'p-2 rounded-lg',
  };

  const variantStyles = {
    primary:
      'bg-[var(--text-primary)] text-[var(--bg-surface)] hover:opacity-90 border border-transparent shadow-xs font-semibold',
    secondary:
      'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-muted)]',
    ghost:
      'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)]',
    danger:
      'bg-red-950/80 text-red-200 border border-red-800/60 hover:bg-red-900',
    crimson:
      'bg-[#ff334b] text-white hover:bg-[#e0263c] border border-transparent shadow-xs font-semibold',
  };

  return (
    <button
      className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
