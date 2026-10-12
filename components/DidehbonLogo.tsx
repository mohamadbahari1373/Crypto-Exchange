'use client';

import React from 'react';

export interface DidehbonLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  lang?: 'fa' | 'en';
  showText?: boolean;
  variant?: 'full' | 'compact' | 'icon';
  withGlow?: boolean;
  showDomain?: boolean;
  className?: string;
  isDark?: boolean;
}

export function DidehbonLogoIcon({
  size = 'md',
  withGlow = false,
  className = '',
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  withGlow?: boolean;
  className?: string;
}) {
  const pixelSizes = {
    xs: 20,
    sm: 26,
    md: 36,
    lg: 48,
    xl: 64,
  };

  const px = typeof size === 'number' ? size : pixelSizes[size] || 36;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: px, height: px }}
    >
      {/* Background ambient pulse glow */}
      {withGlow && (
        <div
          className="absolute inset-0 rounded-full blur-md opacity-75 bg-gradient-to-tr from-cyan-500/40 via-blue-600/40 to-indigo-500/30 animate-pulse pointer-events-none"
        />
      )}

      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-[0_2px_8px_rgba(6,182,212,0.4)]"
      >
        <defs>
          {/* Main cyan to electric indigo gradient */}
          <linearGradient id="didehbon_cyan_indigo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="45%" stopColor="#06b6d4" />
            <stop offset="85%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>

          {/* Core glow gradient */}
          <radialGradient id="didehbon_core_glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="1" />
            <stop offset="45%" stopColor="#06b6d4" stopOpacity="0.85" />
            <stop offset="80%" stopColor="#2563eb" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
          </radialGradient>

          {/* Golden/Amber accent for high-value signal */}
          <linearGradient id="didehbon_signal" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>

        {/* Outer stylized Eye / Sentinel Wings Arc - Upper Curve */}
        <path
          d="M 12 50 C 26 24, 74 24, 88 50 C 72 32, 28 32, 12 50 Z"
          fill="url(#didehbon_cyan_indigo)"
          opacity="0.95"
        />

        {/* Outer stylized Eye / Sentinel Wings Arc - Lower Curve */}
        <path
          d="M 12 50 C 26 76, 74 76, 88 50 C 72 68, 28 68, 12 50 Z"
          fill="url(#didehbon_cyan_indigo)"
          opacity="0.85"
        />

        {/* Outer Radar Reticle Ring with Gap Marks */}
        <circle
          cx="50"
          cy="50"
          r="34"
          stroke="url(#didehbon_cyan_indigo)"
          strokeWidth="2"
          strokeDasharray="6 4"
          strokeOpacity="0.6"
        />

        {/* Inner Observation Ring */}
        <circle
          cx="50"
          cy="50"
          r="24"
          stroke="#06b6d4"
          strokeWidth="2.5"
          fill="none"
          strokeOpacity="0.8"
        />

        {/* Crosshair Sentinel Reticle Axes */}
        <line x1="50" y1="18" x2="50" y2="28" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="50" y1="72" x2="50" y2="82" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="18" y1="50" x2="28" y2="50" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="72" y1="50" x2="82" y2="50" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />

        {/* Radiant Core / Iris Field */}
        <circle cx="50" cy="50" r="16" fill="url(#didehbon_core_glow)" />

        {/* Concentric Pupil Core */}
        <circle cx="50" cy="50" r="8" fill="#0891b2" />
        <circle cx="50" cy="50" r="4.5" fill="#f0fdfa" />

        {/* Tactical Angle Sentinel Corner Brackets */}
        <path d="M 32 38 L 32 32 L 38 32" stroke="#67e8f9" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 68 38 L 68 32 L 62 32" stroke="#67e8f9" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 32 62 L 32 68 L 38 68" stroke="#67e8f9" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 68 62 L 68 68 L 62 68" stroke="#67e8f9" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function DidehbonLogo({
  size = 'md',
  lang = 'fa',
  showText = true,
  variant = 'full',
  withGlow = true,
  showDomain = true,
  className = '',
}: DidehbonLogoProps) {
  const isEn = lang === 'en';

  if (!showText || variant === 'icon') {
    return <DidehbonLogoIcon size={size} withGlow={withGlow} className={className} />;
  }

  // Size styling configuration
  const typographySizes = {
    xs: {
      title: 'text-sm font-bold',
      domain: 'text-[9px]',
      gap: 'gap-1.5',
    },
    sm: {
      title: 'text-base font-extrabold',
      domain: 'text-[10px]',
      gap: 'gap-2',
    },
    md: {
      title: 'text-xl font-black tracking-tight',
      domain: 'text-xs',
      gap: 'gap-2.5',
    },
    lg: {
      title: 'text-2xl font-black tracking-tight',
      domain: 'text-sm',
      gap: 'gap-3',
    },
    xl: {
      title: 'text-3xl font-black tracking-tight',
      domain: 'text-base',
      gap: 'gap-3.5',
    },
  };

  const style = typographySizes[size] || typographySizes.md;

  return (
    <div
      className={`inline-flex items-center ${style.gap} select-none ${className}`}
      dir={isEn ? 'ltr' : 'rtl'}
    >
      {/* Eye / Sentinel Icon */}
      <DidehbonLogoIcon size={size} withGlow={withGlow} />

      {/* Brand Title and Domain */}
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-center gap-1.5">
          <span
            className={`${style.title} bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400 bg-clip-text text-transparent drop-shadow-sm font-bold`}
          >
            {isEn ? 'DIDEHBON' : 'دیده بُن'}
          </span>
          {/* Live Sentinel Badge */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
        </div>

        {showDomain && (
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className={`${style.domain} font-mono tracking-wider text-cyan-400/90 hover:text-cyan-300 font-semibold`}
            >
              didehbon.ir
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
