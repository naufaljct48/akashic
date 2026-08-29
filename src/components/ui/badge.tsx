import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'manhwa' | 'manga' | 'manhua' | 'trope' | 'status' | 'outline';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'default',
  size = 'sm',
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default:
      'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] border-[var(--border-subtle)]',
    manhwa:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800/60 font-mono-data font-semibold',
    manga:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/60 font-mono-data font-semibold',
    manhua:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/60 font-mono-data font-semibold',
    trope:
      'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-muted)]',
    status:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50 font-mono-data font-semibold',
    outline:
      'bg-transparent text-[var(--text-secondary)] border-[var(--border-subtle)]',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 rounded-md gap-1',
    md: 'text-xs px-2.5 py-1 rounded-lg gap-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium border tracking-wide select-none transition-colors shadow-2xs',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
