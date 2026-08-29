import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'spot';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

/**
 * A printed control. Solid ink or a ruled field — no radius past 2px, no
 * gradient, no shadow. Press feedback is the ink setting: it darkens and drops
 * a hair, the way a stamp meets paper.
 */
export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'stamp inline-flex items-center justify-center border transition-[background-color,color,border-color,transform] duration-150 ' +
    'active:translate-y-px disabled:opacity-40 disabled:pointer-events-none cursor-pointer select-none';

  const sizeStyles = {
    sm: 'text-[10px] px-2.5 py-1.5 gap-1.5',
    md: 'text-[11px] px-3.5 py-2 gap-2',
    lg: 'text-xs px-5 py-2.5 gap-2.5',
    icon: 'p-2 gap-0',
  };

  const variantStyles = {
    primary: 'bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)] hover:bg-[var(--ink-soft)] hover:border-[var(--ink-soft)]',
    spot: 'bg-[var(--spot)] text-[var(--on-spot)] border-[var(--spot)] hover:opacity-90',
    secondary:
      'bg-[var(--paper-sheet)] text-[var(--ink)] border-[var(--rule)] hover:border-[var(--ink)]',
    ghost:
      'bg-transparent text-[var(--ink-soft)] border-transparent hover:text-[var(--ink)] hover:border-[var(--rule)]',
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
