import React from 'react';

interface FlagIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

export function IndonesiaFlag({ size = 16, className, ...props }: FlagIconProps) {
  return (
    <svg
      width={size}
      height={(size * 3) / 4}
      viewBox="0 0 640 480"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }}
      {...props}
    >
      <g fillRule="evenodd" strokeWidth="1pt">
        <path fill="#e70011" d="M0 0h640v240H0z" />
        <path fill="#ffffff" d="M0 240h640v240H0z" />
      </g>
    </svg>
  );
}

export function UKFlag({ size = 16, className, ...props }: FlagIconProps) {
  return (
    <svg
      width={size}
      height={(size * 3) / 4}
      viewBox="0 0 640 480"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }}
      {...props}
    >
      <path fill="#012169" d="M0 0h640v480H0z" />
      <path
        fill="#FFF"
        d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-179L0 64V0h75z"
      />
      <path
        fill="#C8102E"
        d="m424 288 216 159v33h-44L380 318l44-30zM640 0v10L440 160l-30-22L618 0h22zM0 480v-11l200-149 31 23L24 480H0zm0-480l226 169-42 31L0 61V0z"
      />
      <path fill="#FFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z" />
      <path fill="#C8102E" d="M267 0v480h106V0H267zM0 187v106h640V187H0z" />
    </svg>
  );
}
