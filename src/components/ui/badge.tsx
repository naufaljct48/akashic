import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'manhwa' | 'manga' | 'manhua' | 'trope' | 'status' | 'outline' | 'spot';
  size?: 'sm' | 'md';
}

/**
 * A printed tag: hairline rule, square corners, tracked caps. The three format
 * variants each get their own process ink so a reader learns the origin by
 * color before reading the word.
 */
export function Badge({
  className,
  variant = 'default',
  size = 'sm',
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: 'border-[var(--rule)] text-[var(--ink-soft)]',
    manhwa: 'border-[var(--ink-blue)] text-[var(--ink-blue)]',
    manga: 'border-[var(--ink-vermilion)] text-[var(--ink-vermilion)]',
    manhua: 'border-[var(--ink-gold)] text-[var(--ink-gold)]',
    trope: 'border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)]',
    status: 'border-[var(--ink-green)] text-[var(--ink-green)]',
    outline: 'border-[var(--rule)] text-[var(--ink-faint)]',
    spot: 'border-[var(--spot-text)] text-[var(--spot-text)]',
  };

  const sizeStyles = {
    sm: 'text-[9px] px-1.5 py-[3px] gap-1',
    md: 'text-[11px] px-2 py-1 gap-1.5',
  };

  return (
    <span
      className={cn(
        'stamp inline-flex items-center border leading-none select-none transition-colors',
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
