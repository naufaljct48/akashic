import React from 'react';
import { cn } from '@/lib/utils/cn';

interface AkashicLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
  withGlow?: boolean;
}

export function AkashicLogo({
  size = 24,
  className,
  withGlow = false,
  ...props
}: AkashicLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none transition-transform', className)}
      {...props}
    >
      <defs>
        <linearGradient id="akashic-crimson" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff334b" />
          <stop offset="1" stopColor="#b91c1c" />
        </linearGradient>
        {withGlow && (
          <filter id="crimson-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ff334b" floodOpacity="0.6" />
          </filter>
        )}
      </defs>

      {/* Outer Hexagonal Grimoire Diamond */}
      <path
        d="M16 2L29 9.5V22.5L16 30L3 22.5V9.5L16 2Z"
        fill="#121215"
        stroke="#27272a"
        strokeWidth="1.5"
      />

      {/* Stylized Geometric 'A' Glyph */}
      <path
        d="M16 6L24 22H19.5L17.5 17.5H14.5L12.5 22H8L16 6Z"
        fill="url(#akashic-crimson)"
        filter={withGlow ? 'url(#crimson-glow)' : undefined}
      />

      {/* Internal Akashic Portal Aperture */}
      <polygon
        points="16,11 18.2,15.5 13.8,15.5"
        fill="#09090b"
      />

      {/* Core Cosmic Spark Dot */}
      <circle cx="16" cy="13.5" r="1" fill="#ffffff" />

      {/* Tactical Sub-lines */}
      <line x1="7" y1="25" x2="25" y2="25" stroke="#ff334b" strokeWidth="1" strokeOpacity="0.4" />
    </svg>
  );
}
