import React from 'react';
import { Link } from 'react-router-dom';
import openCommLogo from '../../assets/opencomm-dark-wordmark.png'; // Approved Light logo: Black "Open" + gradient "Comm"

interface OpenCommLogoProps {
  variant?: 'navbar' | 'mobile-navbar' | 'auth' | 'footer' | 'hero' | 'custom';
  className?: string;
  isLoggedIn?: boolean;
  themeMode?: string;
  onClick?: () => void;
}

export default function OpenCommLogo({
  variant = 'navbar',
  className = '',
  onClick,
}: OpenCommLogoProps) {
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
      sizeClass = 'h-5 sm:h-6 md:h-8 w-auto max-w-[125px] sm:max-w-[160px] md:max-w-[200px]';
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
        src={openCommLogo}
        alt="OpenComm"
        loading="eager"
        className={`object-contain pointer-events-none transition-all duration-200 ${sizeClass}`}
      />
    </Link>
  );
}
