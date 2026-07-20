import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import OpenCommLogo from '../common/OpenCommLogo';
import { getTimeGreeting } from '../../lib/time';

interface HeroSectionProps {
  userFullName?: string;
  isLoggedIn?: boolean;
  onAboutClick?: () => void;
}

export default function HeroSection({
  userFullName,
  isLoggedIn = false,
  onAboutClick,
}: HeroSectionProps) {
  const [greeting, setGreeting] = useState<string>(() => getTimeGreeting());
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const updateGreeting = () => {
      setGreeting(getTimeGreeting());
    };

    updateGreeting();

    // Re-check time boundary every 30 seconds
    const interval = setInterval(updateGreeting, 30000);

    // Update greeting when tab regains focus
    const handleFocus = () => updateGreeting();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Format greeting display:
  // Logged-in  -> "Good Morning, Sabin Saji"
  // Logged-out -> "Good Morning"
  const greetingText = isLoggedIn && userFullName && userFullName.trim().length > 0
    ? `${greeting}, ${userFullName.trim()}`
    : greeting;

  // Ambient glow animation — disabled when prefers-reduced-motion is set
  const blobAnimation = prefersReducedMotion
    ? {}
    : {
        animate: {
          scale: [1, 1.15, 1],
          opacity: [0.15, 0.25, 0.15],
          x: [0, 15, 0],
          y: [0, -10, 0],
        },
        transition: { duration: 10, repeat: Infinity, ease: 'easeInOut' as const },
      };

  const blobAnimation2 = prefersReducedMotion
    ? {}
    : {
        animate: {
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
          x: [0, -15, 0],
          y: [0, 10, 0],
        },
        transition: { duration: 12, repeat: Infinity, ease: 'easeInOut' as const, delay: 1 },
      };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500/8 via-purple-500/5 to-blue-500/10 dark:from-[#0c101d] dark:via-[#111628] dark:to-[#080a12] rounded-2xl md:rounded-3xl border border-indigo-500/10 dark:border-indigo-500/20 p-5 sm:p-6 md:p-8 text-left shadow-lg backdrop-blur-xl transition-all duration-300 min-h-[220px] sm:min-h-[240px] md:min-h-[260px] flex flex-col justify-center">

      {/* Layered Floating Ambient Lights — respect prefers-reduced-motion */}
      <motion.div
        {...blobAnimation}
        className="absolute -top-16 -right-16 w-72 h-72 sm:w-96 sm:h-96 bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-blue-500/10 rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        {...blobAnimation2}
        className="absolute -bottom-20 -left-20 w-72 h-72 sm:w-96 sm:h-96 bg-gradient-to-tr from-blue-500/20 via-indigo-500/15 to-purple-500/10 rounded-full blur-3xl pointer-events-none"
      />
      {/* Radial center glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 bg-indigo-500/5 dark:bg-indigo-400/8 rounded-full blur-2xl pointer-events-none" />
      {/* Subtle overlay gradient for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-white/70 dark:from-transparent dark:via-transparent dark:to-[#080a12]/50 pointer-events-none" />

      {/* Content Container */}
      <div className="relative z-10 space-y-3 sm:space-y-4">

        {/* Row 1: "BUILD BETTER WORK CONNECTIONS" pill — always its own row */}
        <div>
          <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 dark:from-indigo-400/15 dark:via-purple-400/15 dark:to-blue-400/15 backdrop-blur-md border border-indigo-500/15 dark:border-indigo-400/20 shadow-sm">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 dark:from-indigo-400 dark:via-purple-300 dark:to-blue-400 bg-clip-text text-transparent font-extrabold text-[9px] sm:text-[10px] uppercase tracking-widest font-mono">
              BUILD BETTER WORK CONNECTIONS
            </span>
          </div>
        </div>

        {/* Row 2: Time greeting — always below the pill (own row) */}
        <div>
          <span className="text-sm sm:text-base md:text-lg font-bold tracking-wide text-indigo-600 dark:text-purple-300 drop-shadow-[0_2px_8px_rgba(99,102,241,0.25)]">
            {greetingText}
          </span>
        </div>

        {/* Row 3: Main heading with logo inline */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-display font-extrabold tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-3 sm:gap-4 leading-none">
          <span>Welcome to</span>
          <OpenCommLogo variant="hero" className="inline-flex items-center -mt-1" />
        </h1>

        {/* Row 4: Short description */}
        <p className="text-sm sm:text-base font-medium text-slate-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
          OpenComm helps people discover trusted professionals, meaningful work opportunities, and better ways to connect and collaborate.
        </p>

        {/* Row 5: About OpenComm CTA button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onAboutClick}
            className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] transition-all cursor-pointer flex items-center space-x-2 border border-white/15 shadow-sm"
          >
            <span>About OpenComm</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
