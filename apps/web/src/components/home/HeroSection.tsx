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

  // Slow ambient glow animation (respects prefers-reduced-motion)
  const glowAnimation1 = prefersReducedMotion
    ? {}
    : {
        animate: {
          scale: [1, 1.18, 1],
          opacity: [0.35, 0.55, 0.35],
          x: [0, 20, 0],
          y: [0, -12, 0],
        },
        transition: { duration: 10, repeat: Infinity, ease: 'easeInOut' as const },
      };

  const glowAnimation2 = prefersReducedMotion
    ? {}
    : {
        animate: {
          scale: [1, 1.22, 1],
          opacity: [0.25, 0.45, 0.25],
          x: [0, -20, 0],
          y: [0, 12, 0],
        },
        transition: { duration: 12, repeat: Infinity, ease: 'easeInOut' as const, delay: 1 },
      };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl md:rounded-3xl border border-indigo-500/20 dark:border-indigo-400/25 p-5 sm:p-7 md:p-8 text-left shadow-xl transition-all duration-300 bg-gradient-to-br from-indigo-50/80 via-purple-50/50 via-white to-blue-50/80 dark:from-[#0b0e1e] dark:via-[#10152b] dark:to-[#070914] aspect-auto md:aspect-[16/9] min-h-[360px] sm:min-h-[320px] md:min-h-[280px] max-h-[500px] md:max-h-[430px] flex flex-col justify-center">

      {/* Layer 1: Blue & Purple Radial Glows */}
      <motion.div
        {...glowAnimation1}
        className="absolute -top-20 -right-20 w-80 h-80 sm:w-[420px] sm:h-[420px] bg-gradient-to-br from-indigo-500/45 via-purple-500/30 to-blue-500/20 rounded-full blur-3xl pointer-events-none z-0"
      />
      <motion.div
        {...glowAnimation2}
        className="absolute -bottom-24 -left-24 w-80 h-80 sm:w-[420px] sm:h-[420px] bg-gradient-to-tr from-blue-600/35 via-indigo-500/25 to-purple-600/20 rounded-full blur-3xl pointer-events-none z-0"
      />

      {/* Layer 2: Center Mesh Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.08] pointer-events-none z-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px]" 
      />

      {/* Layer 3: Glass highlight overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-white/80 dark:from-transparent dark:via-transparent dark:to-[#070914]/60 pointer-events-none z-0" />

      {/* Layer 4: Content Container (Exact Content Order) */}
      <div className="relative z-10 space-y-2.5 sm:space-y-3 md:space-y-3.5 my-auto">

        {/* 1. Label: "BUILD BETTER WORK CONNECTIONS" (Always on its own top row) */}
        <div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/12 via-purple-500/12 to-blue-500/12 dark:from-indigo-400/20 dark:via-purple-400/20 dark:to-blue-400/20 backdrop-blur-md border border-indigo-500/20 dark:border-indigo-400/25 shadow-xs">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 dark:from-indigo-300 dark:via-purple-200 dark:to-blue-300 bg-clip-text text-transparent font-extrabold text-[9px] sm:text-[10px] uppercase tracking-widest font-mono">
              BUILD BETTER WORK CONNECTIONS
            </span>
          </div>
        </div>

        {/* 2. Time Greeting: "Good Morning" (Always on its own row below label on mobile) */}
        <div>
          <span className="text-xs sm:text-sm md:text-base font-bold tracking-wide text-indigo-600 dark:text-purple-300 drop-shadow-[0_2px_8px_rgba(99,102,241,0.3)]">
            {greetingText}
          </span>
        </div>

        {/* 3. Main Heading: "Welcome to" + OpenComm Logo Image */}
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-2 sm:gap-3 leading-none">
          <span>Welcome to</span>
          <OpenCommLogo variant="hero" className="inline-flex items-center -mt-0.5 sm:-mt-1" />
        </h1>

        {/* 4. Short Description (Responsive typography: 15-17px mobile, 18-20px desktop) */}
        <p className="text-[14px] sm:text-[15px] md:text-[17px] lg:text-[18px] font-medium text-slate-700 dark:text-zinc-200 leading-relaxed max-w-[720px]">
          OpenComm helps people discover trusted professionals, meaningful work opportunities, and better ways to connect and collaborate.
        </p>

        {/* 5. CTA Button: "About OpenComm" */}
        <div className="pt-0.5 sm:pt-1">
          <button
            type="button"
            onClick={onAboutClick}
            className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] transition-all cursor-pointer flex items-center space-x-1.5 border border-white/20 shadow-md"
          >
            <span>About OpenComm</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
