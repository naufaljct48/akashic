import React from 'react';
import { cn } from '@/lib/utils/cn';

interface AkashicLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/**
 * The press mark.
 *
 * A publisher's colophon, not a product logo: a solid ink plate, the A cut out
 * of it so the paper shows through, and the registration ticks a press uses to
 * line one plate up against the next. Ink and spot come from the surrounding
 * view, so the mark takes the issue's color like everything else on the page.
 */
export function AkashicLogo({ size = 24, className, ...props }: AkashicLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none', className)}
      aria-hidden="true"
      {...props}
    >
      {/* The inked plate */}
      <rect x="3" y="3" width="26" height="26" fill="currentColor" />

      {/* The A, knocked out so the paper reads through it */}
      <path
        d="M16 7.5L23.4 25h-4.2l-1.15-3.1h-3.9L12.8 25H8.6L16 7.5Zm0 6.6-1.25 3.5h2.5L16 14.1Z"
        fill="var(--paper)"
      />

      {/* Registration ticks, one plate aligning to the next */}
      <path d="M0 16h3M29 16h3M16 0v3M16 29v3" stroke="var(--spot)" strokeWidth="1.5" />
    </svg>
  );
}
