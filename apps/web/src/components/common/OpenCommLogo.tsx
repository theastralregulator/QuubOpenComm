import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import blackTextLogo from '../../assets/opencomm-dark-wordmark.png';  // Black "Open" text -> for Light theme
import whiteTextLogo from '../../assets/opencomm-light-wordmark.png'; // White "Open" text -> for Dark theme

interface OpenCommLogoProps {
  variant?: 'navbar' | 'mobile-navbar' | 'auth' | 'footer' | 'hero' | 'custom';
  className?: string;
  themeMode?: 'light' | 'dark' | 'system';
  onClick?: () => void;
}

// Preload both logo image assets eagerly on module load to prevent flicker
if (typeof window !== 'undefined') {
  const imgDark = new Image();
  imgDark.src = whiteTextLogo;
  const imgLight = new Image();
  imgLight.src = blackTextLogo;
}

export default function OpenCommLogo({
  variant = 'navbar',
  className = '',
  themeMode,
  onClick,
}: OpenCommLogoProps) {
  const determineIsDark = (): boolean => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    if (themeMode === 'system') {
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return false;
    }
    if (typeof document !== 'undefined') {
      if (document.documentElement.classList.contains('dark')) {
        return true;
      }
      if (document.documentElement.classList.contains('light')) {
        return false;
      }
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    }
    return false;
  };

  const [isDark, setIsDark] = useState<boolean>(determineIsDark);

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(determineIsDark());
    };

    updateTheme();

    if (themeMode === 'dark' || themeMode === 'light') {
      return;
    }

    // 1. Observe root documentElement class attribute mutations (for instant theme toggle)
    let observer: MutationObserver | null = null;
    if (typeof document !== 'undefined') {
      observer = new MutationObserver(() => {
        updateTheme();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    // 2. Observe system color scheme changes if theme is system or unassigned
    let mediaQuery: MediaQueryList | null = null;
    if (typeof window !== 'undefined') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleMediaChange = () => updateTheme();
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleMediaChange);
      } else {
        mediaQuery.addListener(handleMediaChange);
      }

      return () => {
        if (observer) observer.disconnect();
        if (mediaQuery) {
          if (mediaQuery.removeEventListener) {
            mediaQuery.removeEventListener('change', handleMediaChange);
          } else {
            mediaQuery.removeListener(handleMediaChange);
          }
        }
      };
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, [themeMode]);

  // Select logo asset:
  // Dark mode -> white "Open" text (whiteTextLogo)
  // Light mode -> black "Open" text (blackTextLogo)
  const currentLogo = isDark ? whiteTextLogo : blackTextLogo;

  let sizeClass = '';
  switch (variant) {
    case 'navbar':
      sizeClass = 'h-7 md:h-8 w-auto max-w-[145px] sm:max-w-[170px]';
      break;
    case 'mobile-navbar':
      sizeClass = 'h-6 sm:h-7 w-auto max-w-[115px] sm:max-w-[135px]';
      break;
    case 'auth':
      sizeClass = 'h-9 sm:h-10 w-auto max-w-[180px] sm:max-w-[210px]';
      break;
    case 'footer':
      sizeClass = 'h-6 sm:h-7 w-auto max-w-[130px] sm:max-w-[150px]';
      break;
    case 'hero':
      sizeClass = 'h-8 sm:h-9 md:h-11 w-auto max-w-[180px] sm:max-w-[230px]';
      break;
    case 'custom':
    default:
      sizeClass = '';
      break;
  }

  return (
    <Link
      to="/"
      onClick={onClick}
      aria-label="Go to OpenComm home"
      className={`inline-flex items-center outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg shrink-0 select-none ${className}`}
    >
      <img
        src={currentLogo}
        alt="OpenComm"
        loading="eager"
        className={`object-contain pointer-events-none transition-all duration-200 ${sizeClass}`}
      />
    </Link>
  );
}
