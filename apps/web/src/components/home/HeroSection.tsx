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
          scale: [1, 1.15, 1],
          opacity: [0.4, 0.65, 0.4],
          x: [0, 18, 0],
          y: [0, -10, 0],
        },
        transition: { duration: 10, repeat: Infinity, ease: 'easeInOut' as const },
      };

  const glowAnimation2 = prefersReducedMotion
    ? {}
    : {
        animate: {
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.55, 0.3],
          x: [0, -18, 0],
          y: [0, 10, 0],
        },
        transition: { duration: 12, repeat: Infinity, ease: 'easeInOut' as const, delay: 1 },
      };

  return (
    <div 
      className="relative w-full overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl border border-indigo-500/25 dark:border-indigo-400/25 p-3 sm:p-4.5 md:p-6 text-left shadow-sm shadow-indigo-500/5 transition-all duration-300 aspect-[16/9] min-h-[160px] sm:min-h-[190px] md:min-h-[240px] max-h-[245px] sm:max-h-[300px] md:max-h-[380px] flex flex-col justify-center dark:from-[#0b0e1e] dark:via-[#10152b] dark:to-[#070914]"
      style={{
        background: 'radial-gradient(circle at 15% 20%, rgba(37, 99, 235, 0.16), transparent 38%), radial-gradient(circle at 85% 25%, rgba(168, 85, 247, 0.16), transparent 40%), radial-gradient(circle at 55% 90%, rgba(99, 102, 241, 0.10), transparent 42%), linear-gradient(135deg, #ffffff 0%, #f5f7ff 48%, #faf5ff 100%)'
      }}
    >

      {/* Layer 1: Blue & Purple Floating Radial Glows */}
      <motion.div
        {...glowAnimation1}
        className="absolute -top-16 -right-16 w-56 h-56 sm:w-80 sm:h-80 bg-gradient-to-br from-indigo-500/30 via-purple-500/25 to-blue-500/15 rounded-full blur-2xl pointer-events-none z-0"
      />
      <motion.div
        {...glowAnimation2}
        className="absolute -bottom-16 -left-16 w-56 h-56 sm:w-80 sm:h-80 bg-gradient-to-tr from-blue-600/25 via-indigo-500/20 to-purple-600/15 rounded-full blur-2xl pointer-events-none z-0"
      />

      {/* Layer 2: Subtle Mesh Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.05] dark:opacity-[0.09] pointer-events-none z-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:14px_14px]" 
      />

      {/* Layer 3: Content Container (Exact Content Order) */}
      <div className="relative z-10 space-y-1 sm:space-y-1.5 md:space-y-2.5 my-auto">

        {/* 1. Label: "BUILD BETTER WORK CONNECTIONS" */}
        <div>
          <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/12 via-purple-500/12 to-blue-500/12 dark:from-indigo-400/20 dark:via-purple-400/20 dark:to-blue-400/20 backdrop-blur-md border border-indigo-500/20 dark:border-indigo-400/25 shadow-2xs">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 dark:from-indigo-300 dark:via-purple-200 dark:to-blue-300 bg-clip-text text-transparent font-extrabold text-[9px] sm:text-[10px] uppercase tracking-widest font-mono">
              BUILD BETTER WORK CONNECTIONS
            </span>
          </div>
        </div>

        {/* 2. Time Greeting: "Good Morning" */}
        <div>
          <span className="text-[12px] sm:text-[13px] md:text-sm font-bold tracking-wide text-indigo-600 dark:text-purple-300 drop-shadow-[0_2px_8px_rgba(99,102,241,0.25)]">
            {greetingText}
          </span>
        </div>

        {/* 3. Main Heading: "Welcome to" + OpenComm Logo Image (Baseline Aligned) */}
        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5 sm:gap-2 leading-none">
          <span>Welcome to</span>
          <OpenCommLogo variant="hero" isLoggedIn={isLoggedIn} className="inline-flex items-center" />
        </h1>

        {/* 4. Short Description (Compact 12px-14px font size) */}
        <p className="text-[12px] sm:text-[13px] md:text-[14px] font-medium text-slate-700 dark:text-zinc-200 leading-snug sm:leading-relaxed max-w-[650px]">
          OpenComm helps people discover trusted professionals, meaningful work opportunities, and better ways to connect and collaborate.
        </p>

        {/* 5. CTA Button: "About OpenComm" (Compact height & padding) */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={onAboutClick}
            className="h-8 sm:h-9 px-3 sm:px-3.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:shadow-md hover:shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center space-x-1 border border-white/20 shadow-2xs"
          >
            <span>About OpenComm</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
