import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import blackTextLogo from '../../assets/opencomm-dark-wordmark.png';  // Black "Open" text -> for Light theme
import whiteTextLogo from '../../assets/opencomm-light-wordmark.png'; // White "Open" text -> for Dark theme

interface OpenCommLogoProps {
  variant?: 'navbar' | 'mobile-navbar' | 'auth' | 'footer' | 'hero' | 'custom';
  className?: string;
  themeMode?: 'light' | 'dark';
  isLoggedIn?: boolean;
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
  themeMode = 'light',
  isLoggedIn = false,
  onClick,
}: OpenCommLogoProps) {
  const determineIsDark = (): boolean => {
    // Public/Logged-out pages are ALWAYS Light Theme -> return false (black logo)
    if (!isLoggedIn) return false;
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  };

  const [isDark, setIsDark] = useState<boolean>(determineIsDark);

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(determineIsDark());
    };

    updateTheme();

    if (!isLoggedIn) return;

    // Observe root documentElement class attribute mutations for authenticated dark mode
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

    return () => {
      if (observer) observer.disconnect();
    };
  }, [themeMode, isLoggedIn]);

  // Select logo asset:
  // Dark mode (authenticated only) -> white "Open" text (whiteTextLogo)
  // Light mode (default & public) -> black "Open" text (blackTextLogo)
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
      sizeClass = 'h-7 sm:h-8 md:h-10 w-auto max-w-[150px] sm:max-w-[200px]';
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
