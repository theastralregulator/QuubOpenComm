import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import darkLogo from '../../assets/opencomm-dark-wordmark.png';
import lightLogo from '../../assets/opencomm-light-wordmark.png';

interface OpenCommLogoProps {
  variant?: 'navbar' | 'mobile-navbar' | 'auth' | 'footer' | 'hero' | 'custom';
  className?: string;
  themeMode?: 'light' | 'dark' | 'system';
  onClick?: (e?: React.MouseEvent) => void;
}

// Preload both logo image assets once on module load to prevent flicker
if (typeof window !== 'undefined') {
  const imgDark = new Image();
  imgDark.src = darkLogo;
  const imgLight = new Image();
  imgLight.src = lightLogo;
}

export default function OpenCommLogo({
  variant = 'navbar',
  className = '',
  themeMode,
  onClick
}: OpenCommLogoProps) {
  const determineIsDark = (): boolean => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    if (typeof document !== 'undefined') {
      if (document.documentElement.classList.contains('dark')) return true;
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  };

  const [isDark, setIsDark] = useState<boolean>(determineIsDark);

  useEffect(() => {
    // Re-evaluate immediately whenever themeMode prop changes
    setIsDark(determineIsDark());

    if (typeof document === 'undefined') return;

    const checkDark = () => {
      setIsDark(determineIsDark());
    };

    // 1. Observe root <html> element class mutations (when theme toggle adds/removes 'dark' class)
    const observer = new MutationObserver(() => {
      checkDark();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    // 2. Listen to system color scheme changes if in system mode
    let mediaQuery: MediaQueryList | null = null;
    if (typeof window !== 'undefined' && window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleMediaChange = () => {
        if (!themeMode || themeMode === 'system') {
          checkDark();
        }
      };
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleMediaChange);
      } else if ((mediaQuery as any).addListener) {
        (mediaQuery as any).addListener(handleMediaChange);
      }
    }

    return () => {
      observer.disconnect();
      if (mediaQuery) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', checkDark);
        } else if ((mediaQuery as any).removeListener) {
          (mediaQuery as any).removeListener(checkDark);
        }
      }
    };
  }, [themeMode]);

  const currentLogo = isDark ? darkLogo : lightLogo;

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
        className={`object-contain pointer-events-none transition-opacity duration-150 ${sizeClass}`}
      />
    </Link>
  );
}
