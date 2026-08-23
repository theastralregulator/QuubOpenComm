/**
 * OpenComm Animated Loader Component
 * Animation concept adapted from Uiverse.io / SelfMadeSystem.
 * Premium brand-aligned SVG wordmark loader.
 */

import React, { useId, useState, useEffect } from 'react';
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

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if ('addListener' in mediaQuery) {
      (mediaQuery as any).addListener(handleChange);
      return () => (mediaQuery as any).removeListener(handleChange);
    }
  }, []);

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

              {!prefersReducedMotion && (
                <animateTransform
                  attributeName="gradientTransform"
                  type="rotate"
                  values="0 170 37.5; 180 170 37.5; 360 170 37.5"
                  dur="8s"
                  repeatCount="indefinite"
                />
              )}
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
