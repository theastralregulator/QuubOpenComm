/**
 * OpenComm Animated Loader Component
 * Animation concept adapted from Uiverse.io / SelfMadeSystem.
 * Premium brand-aligned SVG wordmark loader.
 */

import React, { useId } from 'react';
import './OpenCommAnimatedLoader.css';

export interface OpenCommAnimatedLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  fullscreen?: boolean;
  label?: string;
  className?: string;
}

export default function OpenCommAnimatedLoader({
  size = 'md',
  fullscreen = false,
  label,
  className = ''
}: OpenCommAnimatedLoaderProps) {
  const reactId = useId();
  const safeId = reactId.replace(/:/g, '');
  const gradientId = `opencomm-loader-gradient-${safeId}`;

  const sizeClass = 
    size === 'sm' ? 'opencomm-loader-size-sm' :
    size === 'lg' ? 'opencomm-loader-size-lg' :
    'opencomm-loader-size-md';

  const containerClass = fullscreen
    ? `opencomm-loader-fullscreen ${className}`.trim()
    : `opencomm-loader-container ${className}`.trim();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label || 'Loading OpenComm'}
      className={containerClass}
    >
      <div className="opencomm-loader-wrapper">
        <svg
          viewBox="0 0 340 75"
          aria-hidden="true"
          className={`opencomm-loader-svg ${sizeClass}`}
        >
          <defs>
            <linearGradient
              id={gradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="35%" stopColor="#7C3AED" />
              <stop offset="65%" stopColor="#A855F7" />
              <stop offset="85%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
          </defs>

          {/* Base Track */}
          <text
            x="50%"
            y="55%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="opencomm-loader-base"
          >
            OpenComm
          </text>

          {/* Subtle Glow Layer */}
          <text
            x="50%"
            y="55%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="opencomm-loader-glow"
            stroke={`url(#${gradientId})`}
          >
            OpenComm
          </text>

          {/* Subtle Fill Layer */}
          <text
            x="50%"
            y="55%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="opencomm-loader-fill"
            fill={`url(#${gradientId})`}
          >
            OpenComm
          </text>

          {/* Animated Tracing Stroke */}
          <text
            x="50%"
            y="55%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="opencomm-loader-trace"
            stroke={`url(#${gradientId})`}
          >
            OpenComm
          </text>
        </svg>

        {label ? (
          <span className="opencomm-loader-label">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
