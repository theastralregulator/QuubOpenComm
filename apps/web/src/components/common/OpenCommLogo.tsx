import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import darkLogo from '../../assets/opencomm-dark-wordmark.png';
import lightLogo from '../../assets/opencomm-light-wordmark.png';

interface OpenCommLogoProps {
  variant?: 'navbar' | 'mobile-navbar' | 'auth' | 'footer' | 'hero' | 'custom';
  className?: string;
  themeMode?: 'light' | 'dark' | 'system';
  onClick?: () => void;
}

// Preload both logo image assets once on module load
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
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (themeMode === 'dark') {
      setIsDark(true);
      return;
    }
    if (themeMode === 'light') {
      setIsDark(false);
      return;
    }

    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkDark();

    // Observe root element class mutations (for theme toggle without page reload)
    const observer = new MutationObserver(() => {
      checkDark();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
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
      sizeClass = 'h-10 sm:h-12 md:h-14 w-auto max-w-[210px] sm:max-w-[260px]';
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
